import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})
const upload = multer({ storage })

const callAI = async (prompt) => {
  console.log('Calling Gemini AI for evaluation...')
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('Gemini evaluation responded')
  return text
}

const buildPrompt = (subject, questionText, modelAnswer, studentAnswer, maxMarks) => {
  return `
You are a STRICT examiner for Maharashtra SSC Board ${subject} examination.

QUESTION: ${questionText}

MODEL ANSWER (Correct Answer):
${modelAnswer}

STUDENT'S ANSWER (Extracted from handwriting):
${studentAnswer}

MAXIMUM MARKS: ${maxMarks}

STRICT EVALUATION RULES:
- Only give full marks if student answer covers ALL key points in model answer
- Deduct marks for every missing key point
- Deduct marks for every incorrect statement
- Partial answers get partial marks ONLY
- If student covers 50% of points, give 50% of marks
- If student covers 80% of points, give 80% of marks
- Be STRICT - do not give benefit of doubt
- Compare ONLY with the model answer provided

MARKING SCHEME:
- Count total key points in model answer
- Count how many key points student covered
- marks = (points covered / total points) * ${maxMarks}
- Round to nearest 0.5

KEY POINTS RULES:
- key_points_covered: List EVERY point the student got correct, separated by commas. Never leave empty.
- key_points_missed: List EVERY point the student missed, separated by commas. Never leave empty.

IMPORTANT: Respond with ONLY the raw JSON object below. No markdown, no code fences, no backticks, no explanation. Start your response with { and end with }

{
  "marks": <number between 0 and ${maxMarks}>,
  "feedback": "<2-3 sentences about what student did well and what was missing>",
  "reasoning": "<step by step explanation of exactly why these marks>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why you gave this confidence level>",
  "improvements": "<specific things student should add to get full marks>",
  "key_points_covered": "<comma separated list of key points student covered>",
  "key_points_missed": "<comma separated list of key points student missed>"
}
`
}

router.post('/full-evaluate', upload.single('answerSheet'), async (req, res) => {
  try {
    const { modelAnswer, maxMarks, subject, questionText } = req.body

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

    console.log('\n STEP 1: Extracting text from image using Gemini Vision...')
    const imageData = fs.readFileSync(req.file.path)
    const base64Image = imageData.toString('base64')

    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const ocrResult = await visionModel.generateContent([
      'Extract all handwritten text exactly as written from this answer sheet. Return only the extracted text, nothing else.',
      { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
    ])

    const studentAnswer = ocrResult.response.text().trim()
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

    console.log('\n STEP 2: Sending to Gemini for evaluation...')
    const prompt = buildPrompt(subject, questionText, modelAnswer, studentAnswer, maxMarks)
    const aiResponse = await callAI(prompt)
    console.log('AI Raw Response:', aiResponse.substring(0, 200))

    let evaluation
    try {
      const cleaned = aiResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^\s*`+/g, '')
        .replace(/`+\s*$/g, '')
        .trim()

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      evaluation = JSON.parse(jsonMatch[0])
      evaluation.maxMarks = parseInt(maxMarks)

      if (evaluation.marks > parseInt(maxMarks)) {
        evaluation.marks = parseInt(maxMarks)
      }

      // Ensure key points are never empty
      if (!evaluation.key_points_covered || evaluation.key_points_covered.trim() === '') {
        evaluation.key_points_covered = 'See reasoning for details'
      }
      if (!evaluation.key_points_missed || evaluation.key_points_missed.trim() === '') {
        evaluation.key_points_missed = 'See reasoning for details'
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

    console.log('\n STEP 3: Evaluation complete!')
    console.log(`Marks: ${evaluation.marks}/${maxMarks}`)

    res.json({
      success: true,
      subject,
      question: questionText,
      studentAnswer,
      evaluation
    })

  } catch (error) {
    console.error('\n Error:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router