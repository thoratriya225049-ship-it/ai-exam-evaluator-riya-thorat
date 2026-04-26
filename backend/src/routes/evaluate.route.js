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

// FIX 1: questionNumber removed from cache key.
// Same question + same answer + same model answer = same marks always.
// Question number is only used in the prompt to help AI find the right answer,
// but it should NOT affect whether we use a cached result.
const getCacheKey = (questionText, modelAnswer, studentAnswer, maxMarks, lessonContent) => {
  const raw = `${questionText}||${modelAnswer}||${studentAnswer}||${maxMarks}||${lessonContent}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

const EVALUATIONS_FILE = path.join(__dirname, '../evaluations.json')

const saveEvaluation = (data) => {
  try {
    let evaluations = []
    try {
      evaluations = JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf8'))
    } catch { evaluations = [] }
    evaluations.unshift({ id: Date.now().toString(), savedAt: new Date().toISOString(), ...data })
    if (evaluations.length > 50) evaluations = evaluations.slice(0, 50)
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(evaluations, null, 2))
  } catch (e) {
    console.error('Failed to save evaluation:', e.message)
  }
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
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5 MB.' })
    }
    if (err.code === 'INVALID_TYPE') {
      return res.status(415).json({ success: false, error: err.message })
    }
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
      if (isNaN(m) || m < 1 || m > 50) {
        errors.push(`Question ${i + 1}: maxMarks must be between 1 and 50`)
      }
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
You are a STRICT examiner for Maharashtra State Board ${className} ${subject} examination.
The student has written their answer in ${language}.
Chapter: ${chapter}
Question Paper: ${questionPaper}
${lessonContent ? `\nLESSON CONTENT / TEXTBOOK REFERENCE:\n${lessonContent}\n` : ''}

YOU ARE EVALUATING: Question ${questionNumber} of ${totalQuestions}

QUESTION ${questionNumber}: ${questionText}

MODEL ANSWER (Correct Answer):
${modelAnswer}

STUDENT'S FULL ANSWER SHEET (Extracted from handwriting):
${studentAnswer}

IMPORTANT INSTRUCTION:
The answer sheet above may contain answers for multiple questions.
You must find and evaluate ONLY the answer that corresponds to Question ${questionNumber} ("${questionText}").
Identify which part belongs to Question ${questionNumber} based on context, question number labels, or answer content.
Do NOT evaluate answers meant for other questions.

MAXIMUM MARKS: ${maxMarks}

STRICT EVALUATION RULES (Maharashtra Board Standard):
- Only give full marks if student answer covers ALL key points
- Deduct marks for every missing key point
- Partial answers get partial marks ONLY
- marks = (points covered / total points) * ${maxMarks}, rounded to nearest 0.5
- Evaluate based on meaning even if written in ${language}
${lessonContent ? '- Cross-reference with provided lesson content for accuracy' : ''}

KEY POINTS RULES (CRITICAL — never skip these):
- key_points_covered: List EVERY correct point the student mentioned, separated by commas.
  Example: "Defined photosynthesis correctly, Mentioned chlorophyll, Wrote correct equation"
  NEVER leave empty. NEVER write "See reasoning".
- key_points_missed: List EVERY point from the model answer the student missed, separated by commas.
  Example: "Did not mention light energy, Missing role of stomata"
  If nothing was missed write exactly: "None — all key points covered"

Return ONLY valid JSON. No markdown. No backticks. No extra text. Start with { end with }.

{
  "marks": <number 0-${maxMarks}>,
  "feedback": "<2-3 sentences as examiner>",
  "reasoning": "<step-by-step marks breakdown>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why this confidence level>",
  "improvements": "<what to add for full marks>",
  "key_points_covered": "<comma separated list of points covered>",
  "key_points_missed": "<comma separated list of points missed, or 'None — all key points covered'>"
}
`

// ── Retry prompt ──────────────────────────────────────────────────────────────
const buildRetryPrompt = (questionText, modelAnswer, studentAnswer, maxMarks, questionNumber) => `
Evaluate this student answer. Return ONLY a JSON object, nothing else.

YOU ARE EVALUATING: Question ${questionNumber}
QUESTION: ${questionText}
MODEL ANSWER: ${modelAnswer}
STUDENT ANSWER: ${studentAnswer}
MAX MARKS: ${maxMarks}

Return this exact JSON (fill in all values properly):
{"marks":0,"feedback":"","reasoning":"","confidence":"LOW","confidence_reason":"","improvements":"","key_points_covered":"","key_points_missed":""}
`

// ── Gemini call — temperature:0 for deterministic output ─────────────────────
const callGemini = async (prompt) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      topP: 1,
      topK: 1,
    }
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
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

  if (!VALID_CONFIDENCE.has(ev.confidence)) ev.confidence = 'LOW'

  // FIX 2: Only replace if truly empty/missing — do NOT replace valid values
  // like "None — all key points covered" which is a legitimate AI response
  const strFields = ['feedback', 'reasoning', 'confidence_reason', 'improvements']
  for (const f of strFields) {
    if (!ev[f] || typeof ev[f] !== 'string' || !ev[f].trim()) {
      ev[f] = 'Not provided'
    }
  }
  // Key points: only replace if completely missing or empty string
  if (!ev.key_points_covered || typeof ev.key_points_covered !== 'string' || !ev.key_points_covered.trim()) {
    ev.key_points_covered = 'See reasoning for details'
  }
  if (!ev.key_points_missed || typeof ev.key_points_missed !== 'string' || !ev.key_points_missed.trim()) {
    ev.key_points_missed = 'See reasoning for details'
  }

  return ev
}

// ── OCR a single image ────────────────────────────────────────────────────────
const ocrImage = async (filePath, mimeType, language) => {
  const imageData = fs.readFileSync(filePath)
  const base64Image = imageData.toString('base64')
  const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const ocrResult = await visionModel.generateContent([
    `Extract ALL handwritten text from this answer sheet exactly as written. The student may have written in ${language}. Return only the extracted text, nothing else.`,
    { inlineData: { data: base64Image, mimeType } }
  ])
  return ocrResult.response.text().trim()
}

// ── Main route ────────────────────────────────────────────────────────────────
router.post('/full-evaluate', uploadFiles, async (req, res) => {
  const rid = req.requestId || 'unknown'
  const reqStart = Date.now()
  metrics.inc('evalRequests')

  try {
    let questions
    try {
      questions = JSON.parse(req.body.questions || '[]')
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid questions JSON.' })
    }

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
    if (lessonContentTruncated) {
      lessonContentUsed = lessonContentUsed.substring(0, 500)
    }

    const sanitizedQuestions = questions.map(q => ({
      question:    sanitizeText(q.question    || ''),
      modelAnswer: sanitizeText(q.modelAnswer || ''),
      maxMarks:    q.maxMarks,
    }))

    const validationErrors = validateFields(sanitized, sanitizedQuestions)
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, error: validationErrors.join('. ') })
    }

    const { subject, language, studentName, className, chapter, questionPaper, examType } = sanitized

    const files = req.files || []
    const getFileForQuestion = (index) => {
      const perQ = files.find(f => f.fieldname === `answerSheet_${index}`)
      if (perQ) return perQ
      const single = files.find(f => f.fieldname === 'answerSheet')
      if (single) return single
      return null
    }

    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'Please upload at least one answer sheet image.' })
    }

    logger.info(rid, 'eval_start', { questionCount: sanitizedQuestions.length, fileCount: files.length })

    const results = []
    const totalQuestions = sanitizedQuestions.length

    for (let i = 0; i < sanitizedQuestions.length; i++) {
      const q = sanitizedQuestions[i]
      const questionNumber = i + 1
      const qLabel = `Q${questionNumber}/${totalQuestions}`
      const file = getFileForQuestion(i)

      // ── OCR ──
      let extractedText = ''
      let ocrConfidence = 'LOW'

      if (file) {
        logger.info(rid, 'ocr_start', { question: qLabel, file: file.filename })
        const ocrStart = Date.now()
        extractedText = await ocrImage(file.path, file.mimetype, language)
        const ocrMs = Date.now() - ocrStart
        metrics.recordDuration('ocr', ocrMs)

        ocrConfidence = extractedText.length > 200 ? 'HIGH'
          : extractedText.length > 50 ? 'MEDIUM' : 'LOW'

        logger.info(rid, 'ocr_complete', { question: qLabel, textLength: extractedText.length, ocrConfidence })
      }

      // Blank answer
      if (!extractedText || extractedText.length < 5) {
        metrics.inc('blankAnswerCount')
        results.push({
          question: q.question,
          studentAnswer: '',
          ocrConfidence: 'LOW',
          evaluation: {
            ...buildFallback(q.maxMarks, 'No text extracted from image.'),
            feedback: 'Answer sheet appears blank or text could not be read.',
            improvements: 'Write clearly with dark ink and ensure good lighting.',
            key_points_covered: 'None',
            key_points_missed: 'All points missing',
          }
        })
        continue
      }

      // ── Cache check — no questionNumber in key ──
      // Same question + same answer always gets same marks
      const cacheKey = getCacheKey(
        q.question, q.modelAnswer, extractedText,
        q.maxMarks, lessonContentUsed
      )

      if (evaluationCache.has(cacheKey)) {
        logger.info(rid, 'cache_hit', { question: qLabel })
        results.push({
          question: q.question,
          studentAnswer: extractedText,
          ocrConfidence,
          evaluation: { ...evaluationCache.get(cacheKey), _cached: true }
        })
        continue
      }

      // ── AI Evaluation ──
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
            question: qLabel,
            marks: evaluation.marks,
            confidence: evaluation.confidence,
            ai_ms: aiMs,
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
      evaluation.timing = {
        ocr_ms: 0,
        ai_ms: Date.now() - aiStart,
        total_ms: Date.now() - reqStart,
      }

      evaluationCache.set(cacheKey, evaluation)

      results.push({
        question: q.question,
        studentAnswer: extractedText,
        ocrConfidence,
        evaluation
      })
    }

    const totalMarks    = sanitizedQuestions.reduce((s, q) => s + parseInt(q.maxMarks), 0)
    const totalObtained = results.reduce((s, r) => s + (r.evaluation.marks || 0), 0)
    const totalMs       = Date.now() - reqStart
    metrics.recordDuration('req', totalMs)

    const ocrLevels = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    const overallOcr = results.reduce((worst, r) => {
      return ocrLevels[r.ocrConfidence] < ocrLevels[worst] ? r.ocrConfidence : worst
    }, 'HIGH')

    logger.info(rid, 'eval_complete', { studentName, totalObtained, totalMarks, total_ms: totalMs })

    const responseData = {
      success: true,
      studentName, className, chapter, questionPaper, examType, subject, language,
      totalMarks, totalObtained,
      ocrConfidence: overallOcr,
      lessonContentTruncated,
      results,
    }

    saveEvaluation({
      studentName, className, chapter, questionPaper, examType, subject, language,
      totalMarks, totalObtained, ocrConfidence: overallOcr,
      questionCount: results.length,
      results,
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