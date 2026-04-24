
import express from 'express'
import multer from 'multer'
import Tesseract from 'tesseract.js'
import axios from 'axios'
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
const upload = multer({ storage })

const callAI = async (prompt) => {

  // Try Sarvam AI first
  try {
    console.log('🤖 Calling Sarvam AI...')
    const response = await axios.post(
      'https://api.sarvam.ai/v1/chat/completions',
      {
        model: "sarvam-2b-v0.5",
        messages: [
          {
            role: "system",
            content: "You are a strict Maharashtra SSC/HSC board examiner. Always respond in valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.SARVAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )
    console.log(' Sarvam AI responded')
    return response.data.choices[0].message.content

  } catch (sarvamError) {
  
    console.log(' Sarvam failed:', sarvamError.message)
    console.log(' Trying Gemini backup...')

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600
        }
      },
      { timeout: 15000 }
    )

    console.log(' Gemini responded')
    return geminiResponse.data.candidates[0].content.parts[0].text
  }
}


const buildPrompt = (subject, questionText, modelAnswer, studentAnswer, maxMarks) => {
  return `
You are a strict but fair examiner for Maharashtra SSC Board ${subject} examination.

QUESTION: ${questionText}

MODEL ANSWER (Correct Answer): 
${modelAnswer}

STUDENT'S ANSWER (Extracted from handwriting): 
${studentAnswer}

MAXIMUM MARKS: ${maxMarks}

EVALUATION INSTRUCTIONS:
- Compare student answer with model answer carefully
- Give marks based on how many key points are covered
- Be strict but fair
- Consider partial marks for partial answers

RESPOND ONLY IN THIS EXACT JSON FORMAT (no other text):
{
  "marks": <number between 0 and ${maxMarks}>,
  "feedback": "<2-3 sentences about what student did well and what was missing>",
  "reasoning": "<step by step explanation of exactly why these marks>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why you gave this confidence level>",
  "improvements": "<specific things student should add to get full marks>",
  "key_points_covered": "<which key points from model answer were in student answer>",
  "key_points_missed": "<which key points were missing>"
}
`
}


router.post('/full-evaluate', upload.single('answerSheet'), async (req, res) => {
  try {
    const { modelAnswer, maxMarks, subject, questionText } = req.body

    // ── Validation ──
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an answer sheet image'
      })
    }

    if (!modelAnswer || !questionText) {
      return res.status(400).json({
        success: false,
        error: 'Question and model answer are required'
      })
    }

 
    console.log('\n STEP 1: Extracting text from image...')
    const ocrResult = await Tesseract.recognize(
      req.file.path,
      'eng',
      { logger: m => process.stdout.write('.') }
    )
    const studentAnswer = ocrResult.data.text.trim()
    console.log('\n OCR Complete')
    console.log('Extracted:', studentAnswer.substring(0, 100) + '...')


    if (!studentAnswer || studentAnswer.length < 5) {
      return res.json({
        success: true,
        studentAnswer: '',
        subject,
        question: questionText,
        evaluation: {
          marks: 0,
          maxMarks: parseInt(maxMarks),
          feedback: 'The answer sheet appears to be blank or the handwriting could not be read clearly.',
          reasoning: 'OCR system could not extract any meaningful text from the uploaded image.',
          confidence: 'LOW',
          confidence_reason: 'No text found in image',
          improvements: 'Please write clearly with dark ink. Ensure good lighting when taking photo.',
          key_points_covered: 'None',
          key_points_missed: 'All points missing'
        }
      })
    }

    console.log('\n STEP 2: Sending to AI for evaluation...')
    const prompt = buildPrompt(
      subject,
      questionText,
      modelAnswer,
      studentAnswer,
      maxMarks
    )
    const aiResponse = await callAI(prompt)

    
    let evaluation
    try {
     
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      evaluation = JSON.parse(jsonMatch[0])
      evaluation.maxMarks = parseInt(maxMarks)

      
      if (evaluation.marks > parseInt(maxMarks)) {
        evaluation.marks = parseInt(maxMarks)
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message)
      
      evaluation = {
        marks: 0,
        maxMarks: parseInt(maxMarks),
        feedback: 'AI evaluation completed but response format was unexpected.',
        reasoning: aiResponse.substring(0, 200),
        confidence: 'LOW',
        confidence_reason: 'Response parsing failed',
        improvements: 'Please try again',
        key_points_covered: 'Unable to determine',
        key_points_missed: 'Unable to determine'
      }
    }

    
    console.log('\n✅ STEP 3: Evaluation complete!')
    console.log(`Marks: ${evaluation.marks}/${maxMarks}`)

    res.json({
      success: true,
      subject,
      question: questionText,
      studentAnswer,
      evaluation
    })

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router