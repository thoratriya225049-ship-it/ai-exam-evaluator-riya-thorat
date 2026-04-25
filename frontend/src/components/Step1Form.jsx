const Step1Form = ({ formData, setFormData, onNext, error, setError }) => {

  const handleNext = () => {
    if (!formData.question.trim()) {
      setError('Please enter the question')
      return
    }
    if (!formData.modelAnswer.trim()) {
      setError('Please enter the model answer')
      return
    }
    setError('')
    onNext()
  }

  return (
    <div className="step-content">
      <h2>Step 1: Enter Exam Details</h2>
      <p className="subtitle">
        Enter the question and correct model answer.
        AI will compare the student's answer against this.
      </p>

      {/* Subject */}
      <div className="field">
        <label>Subject</label>
        <div className="select-wrapper">
          <select
            value={formData.subject}
            onChange={e => setFormData({ ...formData, subject: e.target.value })}
          >
            <option value="English">English</option>
            <option value="Science">Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="History">History</option>
            <option value="Geography">Geography</option>
            <option value="Hindi">Hindi</option>
            <option value="Marathi">Marathi</option>
          </select>
          <span className="select-arrow">▼</span>
        </div>
      </div>

      {/* Question */}
      <div className="field">
        <label>Question</label>
        <input
          type="text"
          placeholder="e.g. What is photosynthesis?"
          value={formData.question}
          onChange={e => setFormData({ ...formData, question: e.target.value })}
        />
      </div>

      {/* Model Answer */}
      <div className="field">
        <label>Model Answer (Correct Answer)</label>
        <textarea
          placeholder="Enter the complete correct answer here..."
          value={formData.modelAnswer}
          onChange={e => setFormData({ ...formData, modelAnswer: e.target.value })}
          rows={5}
        />
      </div>

      {/* Max Marks */}
      <div className="field">
        <label>Maximum Marks</label>
        <input
          type="number"
          value={formData.maxMarks}
          onChange={e => setFormData({ ...formData, maxMarks: e.target.value })}
          min={1}
          max={10}
        />
      </div>

      {error && <p className="error">⚠️ {error}</p>}

      <button className="btn-primary" onClick={handleNext}>
        Next: Upload Answer Sheet →
      </button>
    </div>
  )
}

export default Step1Form