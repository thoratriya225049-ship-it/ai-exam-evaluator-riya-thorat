import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import { logger } from '../logger.js'
import { metrics } from '../metrics.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ── Multer: jpg/jpeg/png only, max 5 MB ──────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/jpg']
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
    const err = new Error('Only JPG and PNG images allowed.')
    err.code = 'INVALID_TYPE'
    cb(err, false)
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })

// Wraps multer with proper HTTP status codes
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

router.post('/extract', uploadSingle, async (req, res) => {
  const rid = req.requestId || 'unknown'
  metrics.inc('ocrRequests')

  try {
    if (!req.file) {
      logger.warn(rid, 'ocr_no_file')
      return res.status(400).json({ success: false, error: 'No image uploaded.' })
    }

    logger.info(rid, 'ocr_start', { file: req.file.filename, size: req.file.size })
    const start = Date.now()

    const imageData = fs.readFileSync(req.file.path)
    const base64Image = imageData.toString('base64')

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      'Extract all the handwritten text from this answer sheet exactly as written.',
      { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
    ])

    const extractedText = result.response.text()
    const ocrMs = Date.now() - start
    metrics.recordDuration('ocr', ocrMs)

    // Estimate confidence from extracted text length
    const confidence = extractedText.length > 200 ? 90
      : extractedText.length > 50 ? 65 : 30

    logger.info(rid, 'ocr_complete', {
      textLength: extractedText.length,
      confidence,
      ocr_ms: ocrMs,
    })

    res.json({ success: true, text: extractedText, confidence, ocr_ms: ocrMs })

  } catch (error) {
    logger.error(rid, 'ocr_error', { message: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router