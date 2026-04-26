import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EVALUATIONS_FILE = path.join(__dirname, '../evaluations.json')

const readEvaluations = () => {
  try {
    return JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf8'))
  } catch {
    return []
  }
}

// GET /api/evaluations
router.get('/evaluations', (req, res) => {
  try {
    const evaluations = readEvaluations()
    res.json({ success: true, evaluations: evaluations.slice(0, 20) })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/evaluations/:id
router.get('/evaluations/:id', (req, res) => {
  try {
    const evaluations = readEvaluations()
    const found = evaluations.find(e => e.id === req.params.id)
    if (!found) return res.status(404).json({ success: false, error: 'Evaluation not found' })
    res.json({ success: true, evaluation: found })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router