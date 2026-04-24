
import express from 'express'
import multer from 'multer'
import Tesseract from 'tesseract.js'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))


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


router.post('/extract', upload.single('image'), async (req, res) => {
  try {
   
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image uploaded'
      })
    }

    console.log('📸 Reading image:', req.file.filename)

  
    const result = await Tesseract.recognize(
      req.file.path,
      'eng', 
      { logger: m => console.log('OCR Progress:', m.status) }
    )

    const extractedText = result.data.text.trim()
    const confidence = result.data.confidence

    console.log('✅ Text extracted successfully')

    res.json({
      success: true,
      text: extractedText,
      confidence: Math.round(confidence)
    })

  } catch (error) {
    console.error('OCR Error:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router