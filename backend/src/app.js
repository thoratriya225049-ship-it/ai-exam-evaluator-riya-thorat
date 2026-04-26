import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { randomUUID } from 'crypto'
import ocrRoute from './routes/ocr.route.js'
import evaluateRoute from './routes/evaluate.route.js'
import { metrics } from './metrics.js'
import { logger } from './logger.js'

dotenv.config()
const app = express()

// ── Request ID middleware ────────────────────────────────────────────────────
// Attaches a unique requestId to every incoming request for log tracing.
app.use((req, res, next) => {
  req.requestId = randomUUID().slice(0, 8)   // short 8-char ID e.g. "a1b2c3d4"
  res.setHeader('X-Request-Id', req.requestId)
  metrics.inc('totalRequests')
  logger.info(req.requestId, 'request_received', {
    method: req.method,
    path: req.path,
  })
  next()
})

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ],
  credentials: true
}))

app.use(express.json())

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', ocrRoute)
app.use('/api', evaluateRoute)

// ── Metrics endpoint ─────────────────────────────────────────────────────────
// Returns live in-memory counters and average durations. No secrets exposed.
app.get('/api/metrics', (req, res) => {
  res.json({ success: true, metrics: metrics.snapshot() })
})

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'AI Exam Evaluator Backend Running' })
})

// ── Global error handler ─────────────────────────────────────────────────────
// Catches multer errors and any other unhandled errors from routes.
app.use((err, req, res, next) => {
  const rid = req.requestId || 'unknown'
  if (err.code === 'LIMIT_FILE_SIZE') {
    logger.warn(rid, 'file_too_large')
    return res.status(413).json({ success: false, error: 'File too large. Maximum allowed size is 5 MB.' })
  }
  if (err.code === 'INVALID_TYPE') {
    logger.warn(rid, 'invalid_file_type')
    return res.status(415).json({ success: false, error: err.message })
  }
  logger.error(rid, 'unhandled_error', { message: err.message })
  res.status(500).json({ success: false, error: err.message })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  logger.info('system', 'server_started', { port: PORT })
  console.log(` Server running on http://localhost:${PORT}`)
})

export default app   // exported for tests