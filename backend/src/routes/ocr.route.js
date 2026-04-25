import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPG and PNG images allowed'))
    }
  }
})

router.post('/extract', upload.single('answerSheet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' })
    }

    console.log('Reading image:', req.file.filename)

    const imageData = fs.readFileSync(req.file.path)
    const base64Image = imageData.toString('base64')

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      'Extract all the handwritten text from this answer sheet exactly as written.',
      { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
    ])

    const extractedText = result.response.text()
    console.log('Text extracted successfully')

    res.json({ success: true, text: extractedText, confidence: 90 })

  } catch (error) {
    console.error('OCR Error:', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router