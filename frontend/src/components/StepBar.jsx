const StepBar = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Exam Details' },
    { number: 2, label: 'Upload Sheet' },
    { number: 3, label: 'Results' }
  ]

  return (
    <div className="stepbar">
      {steps.map((step, index) => (
        <div key={step.number} className="stepbar-item">
          <div className="step-wrapper">
            <div className={`step-circle ${currentStep >= step.number ? 'active' : ''}`}>
              {currentStep > step.number ? '✓' : step.number}
            </div>
            <span className={`step-label ${currentStep >= step.number ? 'active' : ''}`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`step-line ${currentStep > step.number ? 'active' : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default StepBar