/**
 * evaluate.test.js
 *
 * Jest + Supertest tests for the AI Exam Evaluator backend.
 * All external calls (Gemini AI) are mocked — no real API keys needed.
 *
 * Setup:
 *   npm install --save-dev jest supertest @jest/globals
 *   Add to package.json:  "test": "node --experimental-vm-modules node_modules/.bin/jest"
 */

import request from 'supertest'
import { jest } from '@jest/globals'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Mock @google/generative-ai before importing app ──────────────────────────
jest.unstable_mockModule('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn()
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    _mockGenerateContent: mockGenerateContent,   // exposed for per-test config
  }
})

// Dynamically import after mocking
const { default: app } = await import('./app.js')
const { _mockGenerateContent } = await import('@google/generative-ai')

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_QUESTION = JSON.stringify([{
  question:    'What is photosynthesis?',
  modelAnswer: 'Photosynthesis is the process by which plants make food using sunlight.',
  maxMarks:    5,
}])

// Path to a tiny valid PNG for upload tests (1x1 white pixel)
const TINY_PNG = path.join(__dirname, '__fixtures__', 'test.png')

// Create fixture dir + tiny PNG once
const fixtureDir = path.join(__dirname, '__fixtures__')
if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir, { recursive: true })
if (!fs.existsSync(TINY_PNG)) {
  // Minimal 1x1 PNG bytes
  const buf = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c49444154789c6260f8cfc00000000200016730145b0000000049454e44ae426082',
    'hex'
  )
  fs.writeFileSync(TINY_PNG, buf)
}

const goodOCRResponse = { response: { text: () => 'Photosynthesis is when plants make food from sunlight.' } }
const goodEvalJSON = JSON.stringify({
  marks: 4,
  feedback: 'Good answer.',
  reasoning: 'Covered main points.',
  confidence: 'HIGH',
  confidence_reason: 'Clear handwriting and relevant answer.',
  improvements: 'Add mention of chlorophyll.',
  key_points_covered: 'Defined photosynthesis, mentioned sunlight',
  key_points_missed: 'Did not mention chlorophyll',
})
const goodEvalResponse = { response: { text: () => goodEvalJSON } }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/metrics', () => {
  it('returns 200 with metrics object containing expected keys', async () => {
    const res = await request(app).get('/api/metrics')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.metrics).toHaveProperty('counters')
    expect(res.body.metrics).toHaveProperty('averageDurations')
    expect(res.body.metrics).toHaveProperty('uptime_s')
    expect(res.body.metrics.counters).toHaveProperty('totalRequests')
    expect(res.body.metrics.counters).toHaveProperty('evalRequests')
    expect(res.body.metrics.counters).toHaveProperty('geminiUsed')
  })
})

describe('POST /api/full-evaluate — validation', () => {
  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/full-evaluate')
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('questions', VALID_QUESTION)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/upload/i)
  })

  it('returns 400 when subject is missing', async () => {
    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('studentName', 'Riya')
      .field('questions', VALID_QUESTION)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/subject/i)
  })

  it('returns 400 when questions array is empty', async () => {
    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('questions', '[]')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when maxMarks is out of range', async () => {
    const badQ = JSON.stringify([{
      question: 'What is X?', modelAnswer: 'X is Y.', maxMarks: 999
    }])
    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('questions', badQ)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/maxMarks/i)
  })

  it('returns 415 when a non-image file is uploaded', async () => {
    const txtPath = path.join(fixtureDir, 'test.txt')
    fs.writeFileSync(txtPath, 'not an image')
    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', txtPath, { contentType: 'text/plain' })
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('questions', VALID_QUESTION)
    expect([400, 415]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /api/full-evaluate — AI evaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns successful evaluation with correct fields', async () => {
    // First call = OCR, second call = AI eval
    _mockGenerateContent
      .mockResolvedValueOnce(goodOCRResponse)
      .mockResolvedValueOnce(goodEvalResponse)

    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('className', '10th SSC')
      .field('chapter', 'Life Processes')
      .field('questionPaper', 'Unit Test 1')
      .field('language', 'English')
      .field('questions', VALID_QUESTION)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.results).toHaveLength(1)

    const ev = res.body.results[0].evaluation
    expect(ev).toHaveProperty('marks')
    expect(ev).toHaveProperty('feedback')
    expect(ev).toHaveProperty('confidence')
    expect(ev).toHaveProperty('key_points_covered')
    expect(ev).toHaveProperty('key_points_missed')
    expect(ev).toHaveProperty('ai_provider')
    expect(ev.marks).toBeGreaterThanOrEqual(0)
    expect(ev.marks).toBeLessThanOrEqual(5)
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(ev.confidence)
  })

  it('returns safe fallback when AI returns unparseable response (after retry)', async () => {
    _mockGenerateContent
      .mockResolvedValueOnce(goodOCRResponse)              // OCR succeeds
      .mockResolvedValueOnce({ response: { text: () => 'This is not JSON at all !!!' } })  // primary fails
      .mockResolvedValueOnce({ response: { text: () => 'Still not JSON !!!' } })           // retry also fails

    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('className', '10th SSC')
      .field('chapter', 'Ch1')
      .field('questionPaper', 'Test')
      .field('language', 'English')
      .field('questions', VALID_QUESTION)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const ev = res.body.results[0].evaluation
    // Safe fallback must have these fields
    expect(ev.marks).toBe(0)
    expect(ev.confidence).toBe('LOW')
    expect(ev._fallback).toBe(true)
  })

  it('returns blank answer response when OCR extracts no text', async () => {
    _mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '' } })  // OCR returns blank

    const res = await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('className', '10th SSC')
      .field('chapter', 'Ch1')
      .field('questionPaper', 'Test')
      .field('language', 'English')
      .field('questions', VALID_QUESTION)

    expect(res.status).toBe(200)
    expect(res.body.totalObtained).toBe(0)
    expect(res.body.results[0].evaluation.marks).toBe(0)
  })
})

describe('GET /api/metrics — counter increments', () => {
  it('evalRequests counter increases after each evaluation call', async () => {
    const before = (await request(app).get('/api/metrics')).body.metrics.counters.evalRequests

    _mockGenerateContent
      .mockResolvedValueOnce(goodOCRResponse)
      .mockResolvedValueOnce(goodEvalResponse)

    await request(app)
      .post('/api/full-evaluate')
      .attach('answerSheet', TINY_PNG)
      .field('subject', 'Science')
      .field('studentName', 'Riya')
      .field('className', '10th SSC')
      .field('chapter', 'Ch1')
      .field('questionPaper', 'Test')
      .field('language', 'English')
      .field('questions', VALID_QUESTION)

    const after = (await request(app).get('/api/metrics')).body.metrics.counters.evalRequests
    expect(after).toBeGreaterThan(before)
  })
})