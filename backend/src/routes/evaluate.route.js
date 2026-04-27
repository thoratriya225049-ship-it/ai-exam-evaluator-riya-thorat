import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '../logger.js'
import { metrics } from '../metrics.js'
import { sanitizeText, sanitizeFields } from '../sanitize.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ── Evaluation Cache ──────────────────────────────────────────────────────────
const evaluationCache = new Map()

const getCacheKey = (questionText, modelAnswer, studentAnswer, maxMarks, lessonContent) => {
  const raw = `${questionText}||${modelAnswer}||${studentAnswer}||${maxMarks}||${lessonContent}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

const EVALUATIONS_FILE = path.join(__dirname, '../evaluations.json')

const saveEvaluation = (data) => {
  try {
    let evaluations = []
    try { evaluations = JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf8')) }
    catch { evaluations = [] }
    evaluations.unshift({ id: Date.now().toString(), savedAt: new Date().toISOString(), ...data })
    if (evaluations.length > 50) evaluations = evaluations.slice(0, 50)
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(evaluations, null, 2))
  } catch (e) { console.error('Failed to save evaluation:', e.message) }
}

// ── Multer ────────────────────────────────────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_SIZE = 5 * 1024 * 1024

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.fieldname + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true)
  } else {
    const err = new Error('Only JPG and PNG images are allowed.')
    err.code = 'INVALID_TYPE'
    cb(err, false)
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })

const uploadFiles = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5 MB.' })
    if (err.code === 'INVALID_TYPE')
      return res.status(415).json({ success: false, error: err.message })
    return res.status(400).json({ success: false, error: err.message })
  })
}

// ── Validation ────────────────────────────────────────────────────────────────
const validateFields = (body, questions) => {
  const errors = []
  if (!body.subject?.trim())     errors.push('subject is required')
  if (!body.studentName?.trim()) errors.push('studentName is required')
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('At least one question is required')
  } else {
    questions.forEach((q, i) => {
      if (!q.question?.trim())    errors.push(`Question ${i + 1}: question text is required`)
      if (!q.modelAnswer?.trim()) errors.push(`Question ${i + 1}: modelAnswer is required`)
      const m = Number(q.maxMarks)
      if (isNaN(m) || m < 1 || m > 50)
        errors.push(`Question ${i + 1}: maxMarks must be between 1 and 50`)
    })
  }
  return errors
}

// ── Safe fallback ─────────────────────────────────────────────────────────────
const buildFallback = (maxMarks, reason) => ({
  marks: 0,
  maxMarks: parseInt(maxMarks),
  feedback: 'AI could not evaluate this answer. Please review manually.',
  reasoning: reason || 'Evaluation failed after retry.',
  confidence: 'LOW',
  confidence_reason: 'Parse or network failure',
  improvements: 'Please re-submit or review the answer sheet manually.',
  key_points_covered: 'Unable to determine',
  key_points_missed: 'Unable to determine',
  ai_provider: 'gemini',
  _fallback: true,
})

// ── Prompt builder ────────────────────────────────────────────────────────────
const buildPrompt = (
  subject, language, className, chapter, questionPaper,
  lessonContent, questionText, modelAnswer, studentAnswer,
  maxMarks, questionNumber, totalQuestions
) => `
You are a FAIR and STRICT examiner for Maharashtra State Board ${className} ${subject} examination.
The student has written their answer in ${language}.
Chapter: ${chapter}
Question Paper: ${questionPaper}
${lessonContent ? `\nLESSON CONTENT / TEXTBOOK REFERENCE:\n${lessonContent}\n` : ''}

YOU ARE EVALUATING: Question ${questionNumber} of ${totalQuestions}

QUESTION ${questionNumber}: ${questionText}

MODEL ANSWER (Correct Answer):
${modelAnswer}

STUDENT'S FULL ANSWER SHEET (Extracted from handwriting — may have OCR errors):
${studentAnswer}

IMPORTANT INSTRUCTIONS:
1. The answer sheet may contain answers for multiple questions. Find and evaluate ONLY the answer for Question ${questionNumber} ("${questionText}").
2. The student answer was extracted by OCR from handwriting — it may have minor spelling or formatting errors. Judge the MEANING and CONTENT, not spelling.
3. Be FAIR — if the student has covered the key concepts in their own words, give them credit even if wording differs from the model answer.
4. Give 0 marks ONLY if the student truly did not answer the question or wrote completely irrelevant content.

MAXIMUM MARKS: ${maxMarks}

MARKING SCHEME:
- Full marks: Student covered ALL key points from model answer
- Partial marks: Student covered SOME key points — award proportionally
- marks = (key points covered / total key points) × ${maxMarks}, rounded to nearest 0.5
- Minimum marks for a relevant attempt: 0.5 (never give 0 if student wrote something relevant)

KEY POINTS RULES (you MUST fill both fields):
- key_points_covered: List every correct concept the student mentioned, comma-separated.
  Example: "Defined photosynthesis, Mentioned sunlight as energy source, Wrote chemical equation"
  NEVER leave this empty. If student wrote anything relevant, list what they got right.
- key_points_missed: List every key point from the model answer the student did NOT cover, comma-separated.
  If nothing was missed write exactly: "None — all key points covered"

Return ONLY valid JSON. No markdown. No backticks. No extra text. Start with { end with }.

{
  "marks": <number 0–${maxMarks}>,
  "feedback": "<2–3 sentences as examiner>",
  "reasoning": "<step-by-step calculation: how many points covered out of total, marks calculation>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why>",
  "improvements": "<specific points to add for full marks>",
  "key_points_covered": "<comma separated list>",
  "key_points_missed": "<comma separated list or 'None — all key points covered'>"
}
`

// ── Retry prompt ──────────────────────────────────────────────────────────────
const buildRetryPrompt = (questionText, modelAnswer, studentAnswer, maxMarks, questionNumber) => `
Evaluate this student answer and return ONLY a JSON object.

QUESTION ${questionNumber}: ${questionText}
MODEL ANSWER: ${modelAnswer}
STUDENT ANSWER: ${studentAnswer}
MAX MARKS: ${maxMarks}

Be fair — give credit for relevant content even if wording differs.
Give 0 only if completely irrelevant.

Return ONLY this JSON with values filled in:
{"marks":0,"feedback":"","reasoning":"","confidence":"MEDIUM","confidence_reason":"retry evaluation","improvements":"","key_points_covered":"","key_points_missed":""}
`

// ── Gemini call — temperature 0 = deterministic ───────────────────────────────
// FIXED: was 'gemini-2.5-flash-lite-lite' (invalid) — now correct model name
const callGemini = async (prompt) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0, topP: 1, topK: 1 }
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ── OCR — temperature 0 = same image always gives same text ──────────────────
// FIXED: was 'gemini-2.5-flash-lite' (invalid) — now correct model name
const ocrImage = async (filePath, mimeType, language) => {
  const imageData = fs.readFileSync(filePath)
  const base64Image = imageData.toString('base64')
  const visionModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0, topP: 1, topK: 1 }
  })
  const ocrResult = await visionModel.generateContent([
    `Extract ALL handwritten text from this answer sheet exactly as written. The student may have written in ${language}. Return only the extracted text, nothing else.`,
    { inlineData: { data: base64Image, mimeType } }
  ])
  return ocrResult.response.text().trim()
}

// ── Parse + validate AI response ──────────────────────────────────────────────
const VALID_CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW'])

const parseAndValidate = (raw, maxMarks) => {
  const cleaned = raw
    .replace(/```json/gi, '').replace(/```/g, '')
    .replace(/^\s*`+/g, '').replace(/`+\s*$/g, '').trim()

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in AI response')

  const ev = JSON.parse(match[0])
  const iMax = parseInt(maxMarks)

  ev.maxMarks = iMax
  ev.marks = Math.min(Math.max(Number(ev.marks) || 0, 0), iMax)
  ev.marks = Math.round(ev.marks * 2) / 2

  if (!VALID_CONFIDENCE.has(ev.confidence)) ev.confidence = 'MEDIUM'

  const strFields = ['feedback', 'reasoning', 'confidence_reason', 'improvements']
  for (const f of strFields) {
    if (!ev[f] || typeof ev[f] !== 'string' || !ev[f].trim()) ev[f] = 'Not provided'
  }
  // Only replace key points if truly empty — preserve "None — all key points covered"
  // Normalize key points — AI may return array, newline list, or comma list
  const normalizePoints = (val) => {
    if (!val) return null
    if (Array.isArray(val)) {
      const joined = val.filter(v => v && String(v).trim()).join(', ')
      return joined || null
    }
    const s = String(val).trim()
    if (!s) return null
    // Only replace truly empty/fallback values
    const FALLBACKS = ['See reasoning for details', 'Unable to determine', 'N/A', 'n/a']
    if (FALLBACKS.includes(s)) return null
    return s
  }
  ev.key_points_covered = normalizePoints(ev.key_points_covered) || 'See reasoning for details'
  ev.key_points_missed  = normalizePoints(ev.key_points_missed)  || 'See reasoning for details'

  return ev
}

// ── Main route ────────────────────────────────────────────────────────────────
router.post('/full-evaluate', uploadFiles, async (req, res) => {
  const rid = req.requestId || 'unknown'
  const reqStart = Date.now()
  metrics.inc('evalRequests')

  try {
    let questions
    try { questions = JSON.parse(req.body.questions || '[]') }
    catch { return res.status(400).json({ success: false, error: 'Invalid questions JSON.' }) }

    const sanitized = sanitizeFields({
      subject:       req.body.subject       || '',
      language:      req.body.language      || 'English',
      studentName:   req.body.studentName   || '',
      className:     req.body.className     || '',
      chapter:       req.body.chapter       || '',
      questionPaper: req.body.questionPaper || '',
      lessonContent: req.body.lessonContent || '',
      examType:      req.body.examType      || '',
    })

    let lessonContentUsed = sanitized.lessonContent
    const lessonContentTruncated = lessonContentUsed.length > 500
    if (lessonContentTruncated) lessonContentUsed = lessonContentUsed.substring(0, 500)

    const sanitizedQuestions = questions.map(q => ({
      question:    sanitizeText(q.question    || ''),
      modelAnswer: sanitizeText(q.modelAnswer || ''),
      maxMarks:    q.maxMarks,
    }))

    const validationErrors = validateFields(sanitized, sanitizedQuestions)
    if (validationErrors.length > 0)
      return res.status(400).json({ success: false, error: validationErrors.join('. ') })

    const { subject, language, studentName, className, chapter, questionPaper, examType } = sanitized

    const files = req.files || []
    if (files.length === 0)
      return res.status(400).json({ success: false, error: 'Please upload at least one answer sheet image.' })

    // OCR each unique file exactly once — reuse text for all questions sharing same image
    const ocrCache = new Map()

    const getOCRForFile = async (file, qLabel) => {
      if (ocrCache.has(file.path)) {
        logger.info(rid, 'ocr_cache_hit', { question: qLabel })
        return ocrCache.get(file.path)
      }
      logger.info(rid, 'ocr_start', { question: qLabel, file: file.filename })
      const ocrStart = Date.now()
      const text = await ocrImage(file.path, file.mimetype, language)
      const ocrMs = Date.now() - ocrStart
      metrics.recordDuration('ocr', ocrMs)
      const confidence = text.length > 200 ? 'HIGH' : text.length > 50 ? 'MEDIUM' : 'LOW'
      logger.info(rid, 'ocr_complete', { question: qLabel, textLength: text.length, confidence, ocr_ms: ocrMs })
      const entry = { text, confidence, ocrMs }
      ocrCache.set(file.path, entry)
      return entry
    }

    const getFileForQuestion = (index) => {
      const perQ = files.find(f => f.fieldname === `answerSheet_${index}`)
      if (perQ) return perQ
      return files.find(f => f.fieldname === 'answerSheet') || null
    }

    logger.info(rid, 'eval_start', { questionCount: sanitizedQuestions.length, fileCount: files.length })

    const results = []
    const totalQuestions = sanitizedQuestions.length

    for (let i = 0; i < sanitizedQuestions.length; i++) {
      const q = sanitizedQuestions[i]
      const questionNumber = i + 1
      const qLabel = `Q${questionNumber}/${totalQuestions}`
      const file = getFileForQuestion(i)

      let extractedText = ''
      let ocrConfidence = 'LOW'

      if (file) {
        const ocr = await getOCRForFile(file, qLabel)
        extractedText = ocr.text
        ocrConfidence = ocr.confidence
      }

      if (!extractedText || extractedText.length < 5) {
        metrics.inc('blankAnswerCount')
        results.push({
          question: q.question, studentAnswer: '', ocrConfidence: 'LOW',
          evaluation: {
            ...buildFallback(q.maxMarks, 'No text extracted from image.'),
            feedback: 'Answer sheet appears blank or text could not be read.',
            improvements: 'Write clearly with dark ink and ensure good lighting.',
            key_points_covered: 'None', key_points_missed: 'All points missing',
          }
        })
        continue
      }

      const cacheKey = getCacheKey(q.question, q.modelAnswer, extractedText, q.maxMarks, lessonContentUsed)

      if (evaluationCache.has(cacheKey)) {
        logger.info(rid, 'eval_cache_hit', { question: qLabel })
        results.push({
          question: q.question, studentAnswer: extractedText, ocrConfidence,
          evaluation: { ...evaluationCache.get(cacheKey), _cached: true }
        })
        continue
      }

      logger.info(rid, 'ai_question_start', { question: qLabel })
      const aiStart = Date.now()

      const prompt = buildPrompt(
        subject, language, className, chapter, questionPaper,
        lessonContentUsed, q.question, q.modelAnswer, extractedText,
        q.maxMarks, questionNumber, totalQuestions
      )

      let evaluation
      const aiProvider = 'gemini'

      try {
        metrics.inc('geminiUsed')
        const raw = await callGemini(prompt)
        const aiMs = Date.now() - aiStart
        metrics.recordDuration('ai', aiMs)

        try {
          evaluation = parseAndValidate(raw, q.maxMarks)
          logger.info(rid, 'ai_question_complete', {
            question: qLabel, marks: evaluation.marks, confidence: evaluation.confidence, ai_ms: aiMs,
          })
        } catch (parseErr) {
          metrics.inc('parseFail')
          metrics.inc('retryCount')
          logger.warn(rid, 'ai_parse_fail_retrying', { question: qLabel, error: parseErr.message })
          try {
            const retryRaw = await callGemini(
              buildRetryPrompt(q.question, q.modelAnswer, extractedText, q.maxMarks, questionNumber)
            )
            evaluation = parseAndValidate(retryRaw, q.maxMarks)
            logger.info(rid, 'ai_retry_success', { question: qLabel })
          } catch {
            metrics.inc('parseFail')
            logger.error(rid, 'ai_retry_failed', { question: qLabel })
            evaluation = buildFallback(q.maxMarks, 'AI returned unparseable response after retry.')
          }
        }
      } catch (networkErr) {
        const aiMs = Date.now() - aiStart
        metrics.recordDuration('ai', aiMs)
        logger.error(rid, 'ai_network_error', { question: qLabel, error: networkErr.message })
        evaluation = buildFallback(q.maxMarks, `AI call failed: ${networkErr.message}`)
      }

      evaluation.ai_provider = aiProvider
      evaluation.timing = { ocr_ms: 0, ai_ms: Date.now() - aiStart, total_ms: Date.now() - reqStart }
      evaluationCache.set(cacheKey, evaluation)
      results.push({ question: q.question, studentAnswer: extractedText, ocrConfidence, evaluation })
    }

    const totalMarks    = sanitizedQuestions.reduce((s, q) => s + parseInt(q.maxMarks), 0)
    const totalObtained = results.reduce((s, r) => s + (r.evaluation.marks || 0), 0)
    const totalMs       = Date.now() - reqStart
    metrics.recordDuration('req', totalMs)

    const ocrLevels = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    const overallOcr = results.reduce((worst, r) =>
      ocrLevels[r.ocrConfidence] < ocrLevels[worst] ? r.ocrConfidence : worst, 'HIGH')

    logger.info(rid, 'eval_complete', { studentName, totalObtained, totalMarks, total_ms: totalMs })

    const responseData = {
      success: true,
      studentName, className, chapter, questionPaper, examType, subject, language,
      totalMarks, totalObtained, ocrConfidence: overallOcr, lessonContentTruncated, results,
    }

    saveEvaluation({
      studentName, className, chapter, questionPaper, examType, subject, language,
      totalMarks, totalObtained, ocrConfidence: overallOcr, questionCount: results.length, results,
    })

    res.json(responseData)

  } catch (error) {
    const totalMs = Date.now() - reqStart
    metrics.recordDuration('req', totalMs)
    logger.error(rid, 'route_error', { message: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router