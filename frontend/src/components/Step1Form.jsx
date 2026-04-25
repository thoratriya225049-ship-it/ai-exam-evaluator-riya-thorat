const Step1Form = ({ formData, setFormData, onNext, error, setError }) => {

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { question: '', modelAnswer: '', maxMarks: 5 }
      ]
    })
  }

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) return
    const updated = formData.questions.filter((_, i) => i !== index)
    setFormData({ ...formData, questions: updated })
  }

  const updateQuestion = (index, field, value) => {
    const updated = formData.questions.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    )
    setFormData({ ...formData, questions: updated })
  }

  const handleNext = () => {
    if (!formData.studentName.trim()) { setError('Please enter student name'); return }
    if (!formData.chapter.trim()) { setError('Please enter chapter name'); return }
    if (!formData.questionPaper.trim()) { setError('Please enter question paper title'); return }
    for (let i = 0; i < formData.questions.length; i++) {
      if (!formData.questions[i].question.trim()) { setError(`Please enter question ${i + 1}`); return }
      if (!formData.questions[i].modelAnswer.trim()) { setError(`Please enter model answer for question ${i + 1}`); return }
    }
    setError('')
    onNext()
  }

  return (
    <div className="step-content">
      <div className="form-header">
        <h2>Exam Details</h2>
        <p className="subtitle">Enter student and exam information for SSC/HSC board evaluation</p>
      </div>

      <div className="board-info-banner">
        Maharashtra State Board of Secondary &amp; Higher Secondary Education
      </div>

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

      <div className="section-title">Exam Information</div>

      <div className="field-row">
        <div className="field">
          <label>Subject</label>
          <div className="select-wrapper">
            <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })}>
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

      <div className="field-row">
        <div className="field">
          <label>Chapter</label>
          <input
            type="text"
            placeholder="e.g. Chapter 3 — Life Processes"
            value={formData.chapter}
            onChange={e => setFormData({ ...formData, chapter: e.target.value })}
          />
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
      </div>

      <div className="field">
        <label>Lesson Content / Textbook Passage <span className="optional-tag">Optional — improves AI accuracy</span></label>
        <textarea
          placeholder="Paste relevant textbook content, lesson notes, or subject material here. This helps the AI evaluate answers more accurately against the actual syllabus..."
          value={formData.lessonContent}
          onChange={e => setFormData({ ...formData, lessonContent: e.target.value })}
          rows={4}
        />
      </div>

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