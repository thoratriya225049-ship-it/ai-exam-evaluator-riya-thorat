import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_FILE = path.join(__dirname, '../templates.json')

const readTemplates = () => {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'))
  } catch {
    return []
  }
}

const writeTemplates = (data) => {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2))
}

// GET /api/templates
router.get('/templates', (req, res) => {
  try {
    const templates = readTemplates()
    res.json({ success: true, templates })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/templates
router.post('/templates', (req, res) => {
  try {
    const { name, grade, subject, chapter, examType, questions } = req.body

    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Template name is required' })
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required' })
    if (!questions?.length) return res.status(400).json({ success: false, error: 'At least one question is required' })

    const templates = readTemplates()
    const newTemplate = {
      id: Date.now().toString(),
      name: name.trim(),
      grade: grade || '10th SSC',
      subject: subject.trim(),
      chapter: chapter?.trim() || '',
      examType: examType?.trim() || '',
      questions,
      createdAt: new Date().toISOString()
    }

    templates.unshift(newTemplate)
    writeTemplates(templates)

    res.json({ success: true, template: newTemplate })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// DELETE /api/templates/:id
router.delete('/templates/:id', (req, res) => {
  try {
    const templates = readTemplates()
    const filtered = templates.filter(t => t.id !== req.params.id)
    writeTemplates(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router