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
  console.log('Calling Gemini AI...')
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('Gemini responded')
  return text
}

const buildPrompt = (subject, language, className, chapter, questionPaper, lessonContent, questionText, modelAnswer, studentAnswer, maxMarks) => {
  return `
You are a STRICT examiner for Maharashtra State Board ${className} ${subject} examination.
The student has written their answer in ${language}.
Chapter: ${chapter}
Question Paper: ${questionPaper}

${lessonContent ? `LESSON CONTENT / TEXTBOOK REFERENCE:\n${lessonContent}\n` : ''}

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
- marks = (points covered / total points) * ${maxMarks}
- Round to nearest 0.5
- Evaluate based on meaning even if written in ${language}
- Follow Maharashtra SSC/HSC board marking scheme strictly
${lessonContent ? '- Also cross-reference with the provided lesson content/textbook passage for accuracy' : ''}

KEY POINTS RULES (VERY IMPORTANT):
- key_points_covered: You MUST list every correct point the student mentioned, separated by commas. Example: "Defined photosynthesis correctly, Mentioned chlorophyll, Wrote the correct equation". NEVER leave this empty or write "See reasoning".
- key_points_missed: You MUST list every point from the model answer that the student missed or got wrong, separated by commas. Example: "Did not mention light energy, Missing role of stomata". NEVER leave this empty or write "See reasoning". If nothing was missed, write "None — all key points covered".

IMPORTANT: Respond with ONLY raw JSON. No markdown, no backticks. Start with { end with }

{
  "marks": <number between 0 and ${maxMarks}>,
  "feedback": "<2-3 sentences as an examiner>",
  "reasoning": "<step by step why these marks as per board standard>",
  "confidence": "<HIGH or MEDIUM or LOW>",
  "confidence_reason": "<why>",
  "improvements": "<what to add for full marks as per board standard>",
  "key_points_covered": "<comma separated list>",
  "key_points_missed": "<comma separated list>"
}
`
}

const parseAIResponse = (aiResponse, maxMarks) => {
  try {
    const cleaned = aiResponse
      .replace(/```json/g, '').replace(/```/g, '')
      .replace(/^\s*`+/g, '').replace(/`+\s*$/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const evaluation = JSON.parse(jsonMatch[0])
    evaluation.maxMarks = parseInt(maxMarks)
    if (evaluation.marks > parseInt(maxMarks)) evaluation.marks = parseInt(maxMarks)
    if (!evaluation.key_points_covered?.trim()) evaluation.key_points_covered = 'See reasoning for details'
    if (!evaluation.key_points_missed?.trim()) evaluation.key_points_missed = 'See reasoning for details'
    return evaluation
  } catch (e) {
    return {
      marks: 0, maxMarks: parseInt(maxMarks),
      feedback: 'Could not parse AI response.',
      reasoning: aiResponse.substring(0, 200),
      confidence: 'LOW', confidence_reason: 'Parse error',
      improvements: 'Please try again',
      key_points_covered: 'Unable to determine',
      key_points_missed: 'Unable to determine'
    }
  }
}

router.post('/full-evaluate', upload.single('answerSheet'), async (req, res) => {
  try {
    const { subject, language, studentName, className, chapter, questionPaper, lessonContent } = req.body
    const questions = JSON.parse(req.body.questions)

    if (!req.file) return res.status(400).json({ success: false, error: 'Please upload an answer sheet image' })
    if (!questions || questions.length === 0) return res.status(400).json({ success: false, error: 'Please add at least one question' })

    console.log('\nSTEP 1: Reading answer sheet with Gemini Vision...')
    const imageData = fs.readFileSync(req.file.path)
    const base64Image = imageData.toString('base64')

    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const ocrResult = await visionModel.generateContent([
      `Extract ALL handwritten text from this answer sheet exactly as written. The student may have written in ${language}. Return only the extracted text, nothing else.`,
      { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
    ])

    const fullExtractedText = ocrResult.response.text().trim()
    console.log('\nOCR Complete. Length:', fullExtractedText.length)

    if (!fullExtractedText || fullExtractedText.length < 5) {
      const emptyResults = questions.map(q => ({
        question: q.question,
        studentAnswer: '',
        evaluation: {
          marks: 0, maxMarks: parseInt(q.maxMarks),
          feedback: 'Answer sheet appears blank.',
          reasoning: 'No text extracted from image.',
          confidence: 'LOW', confidence_reason: 'No text found',
          improvements: 'Write clearly with dark ink.',
          key_points_covered: 'None', key_points_missed: 'All points missing'
        }
      }))
      return res.json({
        success: true, studentName, className, chapter, questionPaper, subject, language,
        totalMarks: questions.reduce((s, q) => s + parseInt(q.maxMarks), 0),
        totalObtained: 0, results: emptyResults
      })
    }

    console.log(`\nSTEP 2: Evaluating ${questions.length} question(s)...`)
    const results = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      console.log(`Evaluating Q${i + 1}/${questions.length}...`)
      const prompt = buildPrompt(
        subject, language, className, chapter, questionPaper,
        lessonContent || '', q.question, q.modelAnswer,
        fullExtractedText, q.maxMarks
      )
      const aiResponse = await callAI(prompt)
      const evaluation = parseAIResponse(aiResponse, q.maxMarks)
      results.push({ question: q.question, studentAnswer: fullExtractedText, evaluation })
    }

    const totalMarks = questions.reduce((s, q) => s + parseInt(q.maxMarks), 0)
    const totalObtained = results.reduce((s, r) => s + r.evaluation.marks, 0)

    console.log(`\nSTEP 3: Complete! ${totalObtained}/${totalMarks}`)

    res.json({
      success: true, studentName, className, chapter, questionPaper,
      subject, language, totalMarks, totalObtained, results
    })

  } catch (error) {
    console.error('\nError:', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router