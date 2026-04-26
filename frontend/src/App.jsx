import { useState } from 'react'
import axios from 'axios'
import StepBar from './components/StepBar'
import Step1Form from './components/Step1Form'
import Step2Upload from './components/Step2Upload'
import Step3Results from './components/Step3Results'
import './App.css'

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)

  const [formData, setFormData] = useState({
    studentName: '',
    className: '10th SSC',
    subject: 'Science',
    chapter: '',
    questionPaper: '',
    examType: 'Unit Test 1',
    lessonContent: '',
    language: 'English',
    questions: [{ question: '', modelAnswer: '', maxMarks: 5 }]
  })

  // Fix 1: images is now an array (one per question)
  const [images, setImages] = useState([null])
  const [imagePreviews, setImagePreviews] = useState([null])

  // Keep single image for backward compatibility
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setCurrentStep(1)
    setImage(null)
    setImagePreview(null)
    setImages([null])
    setImagePreviews([null])
    setResult(null)
    setError('')
    setFormData({
      studentName: '',
      className: '10th SSC',
      subject: 'Science',
      chapter: '',
      questionPaper: '',
      examType: 'Unit Test 1',
      lessonContent: '',
      language: 'English',
      questions: [{ question: '', modelAnswer: '', maxMarks: 5 }]
    })
  }

  // Sync images array when questions change
  const handleSetFormData = (newData) => {
    const qCount = newData.questions?.length || 1
    setImages(prev => {
      const arr = [...prev]
      while (arr.length < qCount) arr.push(null)
      return arr.slice(0, qCount)
    })
    setImagePreviews(prev => {
      const arr = [...prev]
      while (arr.length < qCount) arr.push(null)
      return arr.slice(0, qCount)
    })
    setFormData(newData)
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await axios.get('http://localhost:3000/api/evaluations')
      setHistory(res.data.evaluations || [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistory = () => {
    setShowHistory(true)
    fetchHistory()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="board-header">
          <div className="header-emblem">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
              <circle cx="24" cy="24" r="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <path d="M24 8 L26 18 L36 18 L28 24 L31 34 L24 28 L17 34 L20 24 L12 18 L22 18 Z" fill="rgba(255,200,80,0.9)"/>
            </svg>
          </div>
          <div className="board-title">
            <h1>Maharashtra State Board</h1>
            <p>Secondary &amp; Higher Secondary Education</p>
            <span className="board-subtitle">AI-Powered Answer Sheet Evaluation System</span>
          </div>
          <button className="history-btn" onClick={openHistory}>
            📋 History
          </button>
        </div>
      </header>

      <StepBar currentStep={currentStep} />

      <div className="main-card">
        {currentStep === 1 && (
          <Step1Form
            formData={formData}
            setFormData={handleSetFormData}
            onNext={() => setCurrentStep(2)}
            error={error}
            setError={setError}
          />
        )}
        {currentStep === 2 && (
          <Step2Upload
            images={images}
            setImages={setImages}
            imagePreviews={imagePreviews}
            setImagePreviews={setImagePreviews}
            image={image}
            setImage={setImage}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            formData={formData}
            result={result}
            setResult={setResult}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            onBack={() => setCurrentStep(1)}
            onSuccess={() => setCurrentStep(3)}
          />
        )}
        {currentStep === 3 && (
          <Step3Results result={result} onReset={reset} />
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => { setShowHistory(false); setSelectedHistory(null) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Evaluation History</h2>
              <button className="modal-close" onClick={() => { setShowHistory(false); setSelectedHistory(null) }}>✕</button>
            </div>

            {selectedHistory ? (
              <div className="history-detail">
                <button className="btn-back-history" onClick={() => setSelectedHistory(null)}>← Back to list</button>
                <div className="history-detail-info">
                  <p><strong>Student:</strong> {selectedHistory.studentName}</p>
                  <p><strong>Subject:</strong> {selectedHistory.subject} — {selectedHistory.className}</p>
                  <p><strong>Score:</strong> {selectedHistory.totalObtained}/{selectedHistory.totalMarks}</p>
                  <p><strong>Date:</strong> {new Date(selectedHistory.savedAt).toLocaleString('en-IN')}</p>
                </div>
                <table className="summary-table" style={{ marginTop: '15px' }}>
                  <thead>
                    <tr><th>Q.No</th><th>Question</th><th>Marks</th><th>Confidence</th></tr>
                  </thead>
                  <tbody>
                    {selectedHistory.results?.map((r, i) => (
                      <tr key={i}>
                        <td>Q{i + 1}</td>
                        <td>{r.question?.substring(0, 40)}...</td>
                        <td>{r.evaluation?.marks}/{r.evaluation?.maxMarks}</td>
                        <td>{r.evaluation?.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="history-list">
                {historyLoading && <p className="history-loading">Loading...</p>}
                {!historyLoading && history.length === 0 && (
                  <p className="history-empty">No evaluations yet.</p>
                )}
                {history.map((item) => (
                  <div key={item.id} className="history-item" onClick={() => setSelectedHistory(item)}>
                    <div className="history-item-left">
                      <span className="history-student">{item.studentName}</span>
                      <span className="history-meta">{item.subject} — {item.className}</span>
                      <span className="history-meta">{new Date(item.savedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="history-item-right">
                      <span className="history-score">{item.totalObtained}/{item.totalMarks}</span>
                      <span className="history-questions">{item.questionCount} Q</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App