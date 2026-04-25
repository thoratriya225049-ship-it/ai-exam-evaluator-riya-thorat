const Step3Results = ({ result, onReset }) => {
  const { evaluation, studentAnswer, subject, question } = result

  const percentage = (evaluation.marks / evaluation.maxMarks) * 100
  const scoreColor = percentage >= 70 ? '#22c55e' : percentage >= 40 ? '#f59e0b' : '#ef4444'

  const confidenceColor = {
    HIGH: '#22c55e',
    MEDIUM: '#f59e0b',
    LOW: '#ef4444'
  }

  const formatPoints = (points) => {
    if (!points || points === 'Unable to determine' || points === 'See reasoning for details') {
      return <p style={{ color: '#888' }}>See reasoning section for details</p>
    }
    return points.split(',').map((point, index) => (
      <p key={index} style={{ marginBottom: '4px' }}>• {point.trim()}</p>
    ))
  }

  return (
    <div className="step-content">
      <h2>Evaluation Complete</h2>

      {/* Score Card */}
      <div className="score-card" style={{ borderColor: scoreColor }}>
        <div className="score-display">
          <span className="marks-number" style={{ color: scoreColor }}>
            {evaluation.marks}
          </span>
          <span className="marks-total">/ {evaluation.maxMarks}</span>
        </div>
        <p className="score-subject">{subject} — {question}</p>
        <div
          className="confidence-badge"
          style={{ backgroundColor: confidenceColor[evaluation.confidence] }}
        >
          Confidence: {evaluation.confidence}
        </div>
      </div>

      {/* What AI Read */}
      <div className="result-card">
        <h3>What AI Read From Answer Sheet</h3>
        <p className="result-text">
          {studentAnswer || 'Could not extract text from image'}
        </p>
      </div>

      {/* Key Points */}
      <div className="result-row">
        <div className="result-card half green">
          <h3>Key Points Covered</h3>
          {formatPoints(evaluation.key_points_covered)}
        </div>
        <div className="result-card half red">
          <h3>Key Points Missed</h3>
          {formatPoints(evaluation.key_points_missed)}
        </div>
      </div>

      {/* Feedback */}
      <div className="result-card">
        <h3>Feedback</h3>
        <p>{evaluation.feedback}</p>
      </div>

      {/* Reasoning */}
      <div className="result-card highlight">
        <h3>Why These Marks Were Given (Explainable AI)</h3>
        <p>{evaluation.reasoning}</p>
      </div>

      {/* Improvements */}
      <div className="result-card">
        <h3>How To Improve</h3>
        <p>{evaluation.improvements}</p>
      </div>

      {/* Confidence Reason */}
      <div className="result-card">
        <h3>Confidence Note</h3>
        <p>{evaluation.confidence_reason}</p>
      </div>

      {/* Reset Button */}
      <button className="btn-primary" onClick={onReset}>
        Evaluate Another Answer Sheet
      </button>
    </div>
  )
}

export default Step3Results