import { useState, useEffect } from 'react'
import axios from 'axios'

const CHAPTERS = {
  Science: ['Ch 1 — Life Processes', 'Ch 2 — Control & Coordination', 'Ch 3 — Reproduction', 'Ch 4 — Heredity', 'Ch 5 — Light', 'Ch 6 — Electricity', 'Ch 7 — Magnetic Effects'],
  Mathematics: ['Ch 1 — Real Numbers', 'Ch 2 — Polynomials', 'Ch 3 — Linear Equations', 'Ch 4 — Quadratic Equations', 'Ch 5 — Arithmetic Progressions', 'Ch 6 — Triangles', 'Ch 7 — Coordinate Geometry'],
  English: ['Ch 1 — A Letter to God', 'Ch 2 — Nelson Mandela', 'Ch 3 — Two Stories about Flying', 'Ch 4 — From the Diary of Anne Frank', 'Ch 5 — Glimpses of India', 'Ch 6 — Mijbil the Otter'],
  Hindi: ['Ch 1 — Surdas', 'Ch 2 — Tulsidas', 'Ch 3 — Dev', 'Ch 4 — Jaishankar Prasad', 'Ch 5 — Sumitranandan Pant', 'Ch 6 — Mahadevi Verma'],
  Marathi: ['Ch 1 — Mazha Avadta Shikshak', 'Ch 2 — Shyam Chi Aai', 'Ch 3 — Chhatrapati Shivaji Maharaj', 'Ch 4 — Sant Tukaram', 'Ch 5 — Sant Dnyaneshwar'],
  History: ['Ch 1 — Historiography', 'Ch 2 — Indian Freedom Struggle', 'Ch 3 — World Wars', 'Ch 4 — United Nations', 'Ch 5 — Indian Constitution'],
  Geography: ['Ch 1 — Resources', 'Ch 2 — Forest & Wildlife', 'Ch 3 — Water Resources', 'Ch 4 — Agriculture', 'Ch 5 — Minerals & Energy'],
  Economics: ['Ch 1 — Development', 'Ch 2 — Sectors of Economy', 'Ch 3 — Money & Credit', 'Ch 4 — Globalisation', 'Ch 5 — Consumer Rights'],
  Biology: ['Ch 1 — Cell Biology', 'Ch 2 — Plant Physiology', 'Ch 3 — Human Physiology', 'Ch 4 — Genetics', 'Ch 5 — Evolution'],
  Physics: ['Ch 1 — Motion', 'Ch 2 — Force & Laws', 'Ch 3 — Gravitation', 'Ch 4 — Work & Energy', 'Ch 5 — Sound'],
  Chemistry: ['Ch 1 — Chemical Reactions', 'Ch 2 — Acids, Bases & Salts', 'Ch 3 — Metals & Non-metals', 'Ch 4 — Carbon Compounds', 'Ch 5 — Periodic Classification'],
}

const EXAM_TYPES = ['Unit Test 1', 'Unit Test 2', 'Semester 1', 'Semester 2', 'Final Exam', 'Practice Test', 'Revision Test']
const MAX_LESSON = 500

const Step1Form = ({ formData, setFormData, onNext, error, setError }) => {
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateMsg, setTemplateMsg] = useState('')

  useEffect(() => {
    axios.get('http://localhost:3000/api/templates')
      .then(res => setTemplates(res.data.templates || []))
      .catch(() => setTemplates([]))
  }, [])

  const loadTemplate = (templateId) => {
    if (!templateId) return
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    setFormData({
      ...formData,
      className: t.grade || formData.className,
      subject: t.subject || formData.subject,
      chapter: t.chapter || '',
      examType: t.examType || '',
      questions: t.questions || formData.questions,
    })
    setTemplateMsg(`✅ Template "${t.name}" loaded!`)
    setTimeout(() => setTemplateMsg(''), 3000)
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) { setTemplateMsg('❌ Please enter a template name'); return }
    try {
      await axios.post('http://localhost:3000/api/templates', {
        name: templateName.trim(),
        grade: formData.className,
        subject: formData.subject,
        chapter: formData.chapter,
        examType: formData.examType,
        questions: formData.questions,
      })
      setTemplateMsg(`✅ Template "${templateName}" saved!`)
      setTemplateName('')
      setShowSaveTemplate(false)
      const res = await axios.get('http://localhost:3000/api/templates')
      setTemplates(res.data.templates || [])
      setTimeout(() => setTemplateMsg(''), 3000)
    } catch {
      setTemplateMsg('❌ Failed to save template')
    }
  }

  const addQuestion = () => {
    setFormData({ ...formData, questions: [...formData.questions, { question: '', modelAnswer: '', maxMarks: 5 }] })
  }

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) return
    setFormData({ ...formData, questions: formData.questions.filter((_, i) => i !== index) })
  }

  const updateQuestion = (index, field, value) => {
    const updated = formData.questions.map((q, i) => i === index ? { ...q, [field]: value } : q)
    setFormData({ ...formData, questions: updated })
  }

  const handleNext = () => {
    if (!formData.studentName.trim()) { setError('Please enter student name'); return }
    if (!formData.chapter.trim()) { setError('Please select or enter a chapter'); return }
    if (!formData.questionPaper.trim()) { setError('Please enter question paper title'); return }
    for (let i = 0; i < formData.questions.length; i++) {
      if (!formData.questions[i].question.trim()) { setError(`Please enter question ${i + 1}`); return }
      if (!formData.questions[i].modelAnswer.trim()) { setError(`Please enter model answer for question ${i + 1}`); return }
    }
    setError('')
    onNext()
  }

  const chapters = CHAPTERS[formData.subject] || []
  const totalMarks = formData.questions.reduce((sum, q) => sum + parseInt(q.maxMarks || 0), 0)
  const lessonLen = formData.lessonContent?.length || 0
  const lessonOverLimit = lessonLen > MAX_LESSON

  return (
    <div className="step-content">
      <div className="form-header">
        <h2>Exam Details</h2>
        <p className="subtitle">Enter student and exam information for SSC/HSC board evaluation</p>
      </div>

      <div className="board-info-banner">
        Maharashtra State Board of Secondary &amp; Higher Secondary Education
      </div>

      {/* Fix 5: Template helper text */}
      <div className="template-section">
        <div className="template-helper-text">
          💡 <strong>Templates</strong> save your exam setup (questions + model answers + marks) so you don't need to retype for every student.
        </div>
        <div className="template-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Load Saved Template</label>
            <div className="select-wrapper">
              <select onChange={e => loadTemplate(e.target.value)} defaultValue="">
                <option value="">— Select a template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.subject} — {t.grade})</option>
                ))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
          <button className="btn-save-template" onClick={() => setShowSaveTemplate(!showSaveTemplate)}>
            💾 Save Template
          </button>
        </div>

        {showSaveTemplate && (
          <div className="save-template-box">
            <input
              type="text"
              placeholder="Template name e.g. Science Unit Test 1"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            />
            <button className="btn-confirm-save" onClick={saveTemplate}>Save</button>
          </div>
        )}

        {templateMsg && <p className="template-msg">{templateMsg}</p>}
      </div>

      {/* Student Info */}
      <div className="section-title">Student Information</div>
      <div className="field-row">
        <div className="field">
          <label>Student Full Name</label>
          <input
            type="text"
            placeholder="e.g. Riya Thorat"
            value={formData.studentName}
            onChange={e => setFormData({ ...formData, studentName: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Class</label>
          <div className="select-wrapper">
            <select value={formData.className} onChange={e => setFormData({ ...formData, className: e.target.value })}>
              <option value="10th SSC">10th SSC</option>
              <option value="12th HSC">12th HSC</option>
            </select>
            <span className="select-arrow">▼</span>
          </div>
        </div>
      </div>

      {/* Exam Info */}
      <div className="section-title">Exam Information</div>
      <div className="field-row">
        <div className="field">
          <label>Subject</label>
          <div className="select-wrapper">
            <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value, chapter: '' })}>
              <option value="Science">Science</option>
              <option value="Mathematics">Mathematics</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Marathi">Marathi</option>
              <option value="History">History &amp; Political Science</option>
              <option value="Geography">Geography</option>
              <option value="Economics">Economics</option>
              <option value="Biology">Biology</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
            </select>
            <span className="select-arrow">▼</span>
          </div>
        </div>
        <div className="field">
          <label>Exam Type</label>
          <div className="select-wrapper">
            <select value={formData.examType} onChange={e => setFormData({ ...formData, examType: e.target.value })}>
              {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="select-arrow">▼</span>
          </div>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Chapter</label>
          <div className="select-wrapper">
            <select value={formData.chapter} onChange={e => setFormData({ ...formData, chapter: e.target.value })}>
              <option value="">— Select Chapter —</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="select-arrow">▼</span>
          </div>
        </div>
        <div className="field">
          <label>Answer Language</label>
          <div className="select-wrapper">
            <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })}>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Marathi">Marathi</option>
            </select>
            <span className="select-arrow">▼</span>
          </div>
        </div>
      </div>

      <div className="field">
        <label>Question Paper Title</label>
        <input
          type="text"
          placeholder="e.g. Unit Test 2 — March 2025"
          value={formData.questionPaper}
          onChange={e => setFormData({ ...formData, questionPaper: e.target.value })}
        />
      </div>

      {/* Fix 4: Lesson content with proper limit feedback */}
      <div className="field">
        <label>
          Lesson Content / Textbook Passage
          <span className="optional-tag"> Optional — improves AI accuracy</span>
        </label>
        <textarea
          placeholder="Paste relevant textbook content or lesson notes here..."
          value={formData.lessonContent}
          onChange={e => setFormData({ ...formData, lessonContent: e.target.value })}
          rows={4}
        />
        <div className="lesson-counter-row">
          <span className={`char-count ${lessonOverLimit ? 'char-over' : ''}`}>
            {lessonLen} chars typed
          </span>
          {lessonOverLimit && (
            <span className="lesson-limit-msg">
              ⚠️ Only the first 500 characters will be used for evaluation
            </span>
          )}
        </div>
      </div>

      {/* Total Banner */}
      <div className="total-marks-banner">
        <span>Total Questions: {formData.questions.length}</span>
        <span>Total Marks: {totalMarks}</span>
        <span>Pass Marks (35%): {Math.ceil(totalMarks * 0.35)}</span>
      </div>

      {/* Questions */}
      <div className="section-title">Questions &amp; Model Answers</div>

      {formData.questions.map((q, index) => (
        <div key={index} className="question-card">
          <div className="question-header">
            <h3>Question {index + 1}</h3>
            {formData.questions.length > 1 && (
              <button className="btn-remove" onClick={() => removeQuestion(index)}>Remove</button>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Max Marks</label>
              <input
                type="number"
                value={q.maxMarks}
                onChange={e => updateQuestion(index, 'maxMarks', e.target.value)}
                min={1} max={20}
              />
            </div>
            <div className="field">
              <label>Question</label>
              <input
                type="text"
                placeholder="Enter the question here..."
                value={q.question}
                onChange={e => updateQuestion(index, 'question', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Model Answer (Correct Answer)</label>
            <textarea
              placeholder="Enter the complete correct answer here..."
              value={q.modelAnswer}
              onChange={e => updateQuestion(index, 'modelAnswer', e.target.value)}
              rows={4}
            />
          </div>
        </div>
      ))}

      <button className="btn-add-question" onClick={addQuestion}>
        + Add Another Question
      </button>

      {error && <p className="error">{error}</p>}

      <button className="btn-primary" onClick={handleNext}>
        Next: Upload Answer Sheet
      </button>
    </div>
  )
}

export default Step1Form