import axios from 'axios'

const Step2Upload = ({
  image, setImage,
  imagePreview, setImagePreview,
  formData, setResult,
  loading, setLoading,
  error, setError,
  onBack, onSuccess
}) => {

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImage(file)
      setImagePreview(URL.createObjectURL(file))
      setError('')
    }
  }

  const handleEvaluate = async () => {
    if (!image) { setError('Please upload an answer sheet image'); return }
    setLoading(true)
    setError('')
    try {
      const data = new FormData()
      data.append('answerSheet', image)
      data.append('subject', formData.subject)
      data.append('language', formData.language)
      data.append('studentName', formData.studentName)
      data.append('className', formData.className)
      data.append('chapter', formData.chapter)
      data.append('questionPaper', formData.questionPaper)
      data.append('lessonContent', formData.lessonContent || '')
      data.append('questions', JSON.stringify(formData.questions))

      const response = await axios.post(
        'http://localhost:3000/api/full-evaluate',
        data,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setResult(response.data)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const totalMarks = formData.questions.reduce((sum, q) => sum + parseInt(q.maxMarks || 0), 0)

  return (
    <div className="step-content">
      <div className="form-header">
        <h2>Upload Answer Sheet</h2>
        <p className="subtitle">Upload a clear photo of the student's handwritten answer sheet</p>
      </div>

      <div className="student-summary-card">
        <div className="student-summary-header">
          <span>Exam Summary</span>
          <span className="class-badge">{formData.className}</span>
        </div>
        <div className="summary-grid">
          <div><span className="summary-label">Student</span><span className="summary-value">{formData.studentName}</span></div>
          <div><span className="summary-label">Subject</span><span className="summary-value">{formData.subject}</span></div>
          <div><span className="summary-label">Chapter</span><span className="summary-value">{formData.chapter}</span></div>
          <div><span className="summary-label">Question Paper</span><span className="summary-value">{formData.questionPaper}</span></div>
          <div><span className="summary-label">Questions</span><span className="summary-value">{formData.questions.length}</span></div>
          <div><span className="summary-label">Total Marks</span><span className="summary-value">{totalMarks}</span></div>
        </div>
      </div>

      <div className="upload-box" onClick={() => document.getElementById('fileInput').click()}>
        {imagePreview ? (
          <div className="image-preview-container">
            <img src={imagePreview} alt="Answer sheet" className="preview-img" />
            <p className="change-text">Click to change image</p>
          </div>
        ) : (
          <div className="upload-placeholder">
            <div className="upload-icon-svg">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="8" width="36" height="32" rx="4" stroke="#CBD5E1" strokeWidth="2"/>
                <path d="M16 28 L22 20 L28 26 L32 22 L40 30" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="17" cy="18" r="3" fill="#CBD5E1"/>
                <path d="M24 36 L24 42 M20 39 L24 43 L28 39" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="upload-text">Click to upload answer sheet</p>
            <p className="upload-hint">JPG or PNG — clear photo works best</p>
          </div>
        )}
      </div>

      <input id="fileInput" type="file" accept="image/jpeg,image/png,image/jpg"
        onChange={handleImageChange} style={{ display: 'none' }} />

      <div className="tips-box">
        <p className="tips-title">Tips for best results</p>
        <ul>
          <li>Good lighting — no shadows on the sheet</li>
          <li>Flat surface — no wrinkles or folds</li>
          <li>All answers visible in a single photo</li>
        </ul>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="loading-box">
          <div className="spinner" />
          <div className="loading-steps">
            <p>Reading handwriting with Gemini Vision OCR...</p>
            <p>Evaluating {formData.questions.length} question(s) with AI...</p>
            <p>Calculating marks as per SSC/HSC board standards...</p>
          </div>
        </div>
      )}

      <div className="button-row">
        <button className="btn-secondary" onClick={onBack} disabled={loading}>Back</button>
        <button className="btn-primary btn-row-item" onClick={handleEvaluate} disabled={loading}>
          {loading ? 'Evaluating...' : 'Evaluate Answer Sheet'}
        </button>
      </div>
    </div>
  )
}

export default Step2Upload