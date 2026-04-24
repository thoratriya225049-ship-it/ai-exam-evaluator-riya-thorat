import { useState } from 'react'
import StepBar from './components/StepBar'
import Step1Form from './components/Step1Form'
import Step2Upload from './components/Step2Upload'
import Step3Results from './components/Step3Results'
import './App.css'

function App() {
 
  const [currentStep, setCurrentStep] = useState(1)

  
  const [formData, setFormData] = useState({
    subject: 'English',
    question: '',
    modelAnswer: '',
    maxMarks: 5
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
      subject: 'English',
      question: '',
      modelAnswer: '',
      maxMarks: 5
    })
  }

  return (
    <div className="app">

      {/* Header */}
      <header className="header">
        <h1>🎓 AI Exam Evaluator</h1>
        <p>Maharashtra SSC/HSC Board — Automated Answer Sheet Evaluation</p>
      </header>

      {/* Step Progress Bar */}
      <StepBar currentStep={currentStep} />

      {/* Main Card */}
      <div className="main-card">

        {/* Step 1 */}
        {currentStep === 1 && (
          <Step1Form
            formData={formData}
            setFormData={setFormData}
            onNext={() => setCurrentStep(2)}
            error={error}
            setError={setError}
          />
        )}

        {/* Step 2 */}
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

        {/* Step 3 */}
        {currentStep === 3 && (
          <Step3Results
            result={result}
            onReset={reset}
          />
        )}

      </div>
    </div>
  )
}

export default App