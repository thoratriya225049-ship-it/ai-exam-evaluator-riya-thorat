import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '../logger.js'
import { metrics } from '../metrics.js'
import { sanitizeText, sanitizeFields } from '../sanitize.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ── Multer: jpg/jpeg/png only, max 5 MB ──────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png']
const MAX_SIZE = 5 * 1024 * 1024

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
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

// Wraps multer so its errors return proper HTTP status codes
const uploadSingle = (req, res, next) => {
  upload.single('answerSheet')(req, res, (err) => {
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

// ── Input validation ──────────────────────────────────────────────────────────
const validateFields = (body, questions) => {
  const errors = []
  if (!body.subject?.trim())      errors.push('subject is required')
  if (!body.studentName?.trim())  errors.push('studentName is required')

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('At least one question is required')
  } else {
    questions.forEach((q, i) => {
      if (!q.question?.trim())    errors.push(`Question ${i + 1}: question text is required`)
      if (!q.modelAnswer?.trim()) errors.push(`Question ${i + 1}: modelAnswer is required`)
      const m = Number(q.maxMarks)
      if (isNaN(m) || m < 1 || m > 50) {
        errors.push(`Question ${i + 1}: maxMarks must be a number between 1 and 50`)
      }
    })
  }
  return errors
}

// ── Safe fallback evaluation (returned when AI completely fails) ──────────────
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

// ── Prompt builders ───────────────────────────────────────────────────────────
const buildPrompt = (subject, language, className, chapter, questionPaper, lessonContent, questionText, modelAnswer, studentAnswer, maxMarks) => `
You are a STRICT examiner for Maharashtra State Board ${className} ${subject} examination.
The student has written their answer in ${language}.
Chapter: ${chapter}
Question Paper: ${questionPaper}
${lessonContent ? `\nLESSON CONTENT / TEXTBOOK REFERENCE:\n${lessonContent}\n` : ''}

QUESTION: ${questionText}

MODEL ANSWER (Correct Answer):
${modelAnswer}

STUDENT'S ANSWER (Extracted from handwriting):
${studentAnswer}

MAXIMUM MARKS: ${maxMarks}

STRICT EVALUATION RULES (Maharashtra Board Standard):
- Only give full marks if student answer covers ALL key points
- Deduct marks for every missing key point
- Partial answers get partial marks ONLY
- marks = (points covered / total points) * ${maxMarks}, rounded to nearest 0.5
- Evaluate based on meaning even if written in ${language}
- Follow Maharashtra SSC/HSC board marking scheme strictly
${lessonContent ? '- Cross-reference with provided lesson content for accuracy' : ''}

KEY POINTS RULES (CRITICAL — never skip these):
- key_points_covered: List EVERY correct point the student mentioned, separated by commas. Example: "Defined photosynthesis correctly, Mentioned chlorophyll, Wrote correct equation". NEVER leave empty or write "See reasoning".
- key_points_missed: List EVERY point from the model answer that the student missed, separated by commas. Example: "Did not mention light energy, Missing role of stomata". If nothing was missed write "None — all key points covered".

Return ONLY valid JSON. No markdown. No backticks. No extra text. Start with { end with }.

{
  "marks": <number 0–${maxMarks}>,
  "feedback": "<2–3 sentences as examiner>",
  "reasoning": "<step-by-step marks breakdown>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why this confidence level>",
  "improvements": "<what to add for full marks>",
  "key_points_covered": "<comma separated list>",
  "key_points_missed": "<comma separated list>"
}
`

// Shorter stricter prompt used on retry
const buildRetryPrompt = (questionText, modelAnswer, studentAnswer, maxMarks) => `
Evaluate this student answer. Return ONLY a JSON object, nothing else.

QUESTION: ${questionText}
MODEL ANSWER: ${modelAnswer}
STUDENT ANSWER: ${studentAnswer}
MAX MARKS: ${maxMarks}

Return this exact JSON (fill in values):
{"marks":0,"feedback":"","reasoning":"","confidence":"LOW","confidence_reason":"","improvements":"","key_points_covered":"","key_points_missed":""}
`

// ── AI call ───────────────────────────────────────────────────────────────────
const callGemini = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ── Parse + validate AI response ─────────────────────────────────────────────
const VALID_CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW'])

const parseAndValidate = (raw, maxMarks) => {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*`+/g, '')
    .replace(/`+\s*$/g, '')
    .trim()

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in AI response')

  const ev = JSON.parse(match[0])
  const iMax = parseInt(maxMarks)

  // Clamp marks
  ev.maxMarks = iMax
  ev.marks = Math.min(Math.max(Number(ev.marks) || 0, 0), iMax)
  // Round to nearest 0.5
  ev.marks = Math.round(ev.marks * 2) / 2

  // Enforce confidence enum
  if (!VALID_CONFIDENCE.has(ev.confidence)) ev.confidence = 'LOW'

  // Fill required string fields with safe defaults if missing
  const strFields = ['feedback', 'reasoning', 'confidence_reason', 'improvements', 'key_points_covered', 'key_points_missed']
  for (const f of strFields) {
    if (!ev[f] || typeof ev[f] !== 'string' || !ev[f].trim()) {
      ev[f] = f === 'key_points_covered' || f === 'key_points_missed'
        ? 'See reasoning for details'
        : 'Not provided'
    }
  }

  return ev
}

// ── Main route ────────────────────────────────────────────────────────────────
router.post('/full-evaluate', uploadSingle, async (req, res) => {
  const rid = req.requestId || 'unknown'
  const reqStart = Date.now()
  metrics.inc('evalRequests')

  try {
    // Parse questions
    let questions
    try {
      questions = JSON.parse(req.body.questions || '[]')
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid questions JSON.' })
    }

    // Sanitize all text inputs
    const sanitized = sanitizeFields({
      subject:       req.body.subject       || '',
      language:      req.body.language      || 'English',
      studentName:   req.body.studentName   || '',
      className:     req.body.className     || '',
      chapter:       req.body.chapter       || '',
      questionPaper: req.body.questionPaper || '',
      lessonContent: req.body.lessonContent || '',
    })

    const sanitizedQuestions = questions.map(q => ({
      question:    sanitizeText(q.question    || ''),
      modelAnswer: sanitizeText(q.modelAnswer || ''),
      maxMarks:    q.maxMarks,
    }))

    // Validate
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an answer sheet image.' })
    }
    const validationErrors = validateFields(sanitized, sanitizedQuestions)
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, error: validationErrors.join('. ') })
    }

    const { subject, language, studentName, className, chapter, questionPaper, lessonContent } = sanitized

    // ── OCR ────────────────────────────────────────────────────────────────────
    logger.info(rid, 'ocr_start', { file: req.file.filename, size: req.file.size })
    const ocrStart = Date.now()

    const imageData = fs.readFileSync(req.file.path)
    const base64Image = imageData.toString('base64')
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const ocrResult = await visionModel.generateContent([
      `Extract ALL handwritten text from this answer sheet exactly as written. The student may have written in ${language}. Return only the extracted text, nothing else.`,
      { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
    ])

    const fullExtractedText = ocrResult.response.text().trim()
    const ocrMs = Date.now() - ocrStart
    metrics.recordDuration('ocr', ocrMs)

    // Estimate OCR confidence from text length
    const ocrConfidence = fullExtractedText.length > 200 ? 'HIGH'
      : fullExtractedText.length > 50 ? 'MEDIUM' : 'LOW'

    logger.info(rid, 'ocr_complete', {
      textLength: fullExtractedText.length,
      ocrConfidence,
      ocr_ms: ocrMs,
    })

    // ── Blank answer sheet ─────────────────────────────────────────────────────
    if (!fullExtractedText || fullExtractedText.length < 5) {
      metrics.inc('blankAnswerCount')
      logger.warn(rid, 'blank_answer_sheet')

      const emptyResults = sanitizedQuestions.map(q => ({
        question: q.question,
        studentAnswer: '',
        evaluation: {
          ...buildFallback(q.maxMarks, 'No text extracted from image.'),
          feedback: 'Answer sheet appears blank or text could not be read.',
          improvements: 'Write clearly with dark ink and ensure good lighting.',
          key_points_covered: 'None',
          key_points_missed: 'All points missing',
        }
      }))

      const totalMs = Date.now() - reqStart
      metrics.recordDuration('req', totalMs)

      return res.json({
        success: true, studentName, className, chapter, questionPaper, subject, language,
        totalMarks: sanitizedQuestions.reduce((s, q) => s + parseInt(q.maxMarks), 0),
        totalObtained: 0,
        ocrConfidence,
        results: emptyResults,
      })
    }

    // ── AI Evaluation loop ─────────────────────────────────────────────────────
    logger.info(rid, 'ai_eval_start', { questionCount: sanitizedQuestions.length })
    const results = []

    for (let i = 0; i < sanitizedQuestions.length; i++) {
      const q = sanitizedQuestions[i]
      const qLabel = `Q${i + 1}/${sanitizedQuestions.length}`

      logger.info(rid, 'ai_question_start', { question: qLabel })
      const aiStart = Date.now()

      const prompt = buildPrompt(
        subject, language, className, chapter, questionPaper,
        lessonContent, q.question, q.modelAnswer, fullExtractedText, q.maxMarks
      )

      let evaluation
      let aiProvider = 'gemini'

      try {
        // Primary call
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
          // Parse failed — retry once with shorter prompt
          metrics.inc('parseFail')
          metrics.inc('retryCount')
          logger.warn(rid, 'ai_parse_fail_retrying', { question: qLabel, error: parseErr.message })

          try {
            const retryPrompt = buildRetryPrompt(q.question, q.modelAnswer, fullExtractedText, q.maxMarks)
            metrics.inc('geminiUsed')
            const retryRaw = await callGemini(retryPrompt)
            evaluation = parseAndValidate(retryRaw, q.maxMarks)
            logger.info(rid, 'ai_retry_success', { question: qLabel })
          } catch (retryErr) {
            // Both attempts failed — use safe fallback
            metrics.inc('parseFail')
            logger.error(rid, 'ai_retry_failed', { question: qLabel, error: retryErr.message })
            evaluation = buildFallback(q.maxMarks, 'AI returned unparseable response after retry.')
          }
        }
      } catch (networkErr) {
        // Network/API error
        const aiMs = Date.now() - aiStart
        metrics.recordDuration('ai', aiMs)
        logger.error(rid, 'ai_network_error', { question: qLabel, error: networkErr.message })
        evaluation = buildFallback(q.maxMarks, `AI call failed: ${networkErr.message}`)
      }

      evaluation.ai_provider = aiProvider
      evaluation.timing = {
        ocr_ms: ocrMs,
        ai_ms: Date.now() - aiStart,
        total_ms: Date.now() - reqStart,
      }

      results.push({
        question: q.question,
        studentAnswer: fullExtractedText,
        evaluation,
      })
    }

    const totalMarks    = sanitizedQuestions.reduce((s, q) => s + parseInt(q.maxMarks), 0)
    const totalObtained = results.reduce((s, r) => s + (r.evaluation.marks || 0), 0)
    const totalMs       = Date.now() - reqStart
    metrics.recordDuration('req', totalMs)

    logger.info(rid, 'eval_complete', {
      studentName,
      totalObtained,
      totalMarks,
      total_ms: totalMs,
    })

    res.json({
      success: true,
      studentName, className, chapter, questionPaper, subject, language,
      totalMarks, totalObtained,
      ocrConfidence,
      results,
    })

  } catch (error) {
    const totalMs = Date.now() - reqStart
    metrics.recordDuration('req', totalMs)
    logger.error(rid, 'route_error', { message: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router