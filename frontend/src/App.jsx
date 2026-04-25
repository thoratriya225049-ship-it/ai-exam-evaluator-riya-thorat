import { useState } from 'react'
import StepBar from './components/StepBar'
import Step1Form from './components/Step1Form'
import Step2Upload from './components/Step2Upload'
import Step3Results from './components/Step3Results'
import './App.css'

function App() {
  const [currentStep, setCurrentStep] = useState(1)

  const [formData, setFormData] = useState({
    studentName: '',
    className: '10th SSC',
    subject: 'Science',
    chapter: '',
    questionPaper: '',
    lessonContent: '',
    language: 'English',
    questions: [
      { question: '', modelAnswer: '', maxMarks: 5 }
    ]
  })

  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setCurrentStep(1)
    setImage(null)
    setImagePreview(null)
    setResult(null)
    setError('')
    setFormData({
      studentName: '',
      className: '10th SSC',
      subject: 'Science',
      chapter: '',
      questionPaper: '',
      lessonContent: '',
      language: 'English',
      questions: [
        { question: '', modelAnswer: '', maxMarks: 5 }
      ]
    })
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
        </div>
      </header>

      <StepBar currentStep={currentStep} />

      <div className="main-card">
        {currentStep === 1 && (
          <Step1Form
            formData={formData}
            setFormData={setFormData}
            onNext={() => setCurrentStep(2)}
            error={error}
            setError={setError}
          />
        )}
        {currentStep === 2 && (
          <Step2Upload
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
    </div>
  )
}

export default App