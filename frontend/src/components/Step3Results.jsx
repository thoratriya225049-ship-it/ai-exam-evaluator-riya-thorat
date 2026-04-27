const Step3Results = ({ result, onReset }) => {
  const {
    results, studentName, className, subject, language,
    chapter, questionPaper, totalMarks, totalObtained,
    ocrConfidence,
  } = result

  // ── jsPDF loader ────────────────────────────────────────────────────────────
  const loadJsPDF = () => {
    return new Promise((resolve, reject) => {
      if (window.jspdf) { resolve(window.jspdf.jsPDF); return }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload = () => resolve(window.jspdf.jsPDF)
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  const handleExportPDF = async () => {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pageW = 210
    const margin = 16
    const contentW = pageW - margin * 2
    let y = 0

    const addPage = () => { doc.addPage(); y = 16 }
    const checkY = (needed = 20) => { if (y + needed > 280) addPage() }

    // Header
    doc.setFillColor(15, 31, 61)
    doc.rect(0, 0, pageW, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Maharashtra State Board of Secondary & Higher Secondary Education', pageW / 2, 14, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('AI-Powered Answer Sheet Evaluation Report', pageW / 2, 22, { align: 'center' })
    doc.setFillColor(255, 160, 50)
    doc.rect(0, 35, pageW, 3, 'F')
    y = 46

    // Student info table
    doc.setTextColor(30, 30, 30)
    doc.setFillColor(245, 247, 250)
    doc.rect(margin, y, contentW, 32, 'F')
    doc.setDrawColor(220, 225, 235)
    doc.rect(margin, y, contentW, 32)

    const col = contentW / 3
    const infoItems = [
      ['Student Name', studentName || '-'],
      ['Class', className || '-'],
      ['Subject', subject || '-'],
      ['Chapter', chapter || '-'],
      ['Question Paper', questionPaper || '-'],
      ['Language', language || '-'],
    ]
    infoItems.forEach(([label, value], i) => {
      const cx = margin + (i % 3) * col + 6
      const cy = y + (i < 3 ? 10 : 22)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 130, 150)
      doc.text(label.toUpperCase(), cx, cy)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 31, 61)
      doc.text(String(value).substring(0, 28), cx, cy + 5)
    })
    y += 40

    // Score card
    checkY(30)
    const pct = Math.round((totalObtained / totalMarks) * 100)
    const scoreColor = pct >= 70 ? [22, 163, 74] : pct >= 35 ? [217, 119, 6] : [220, 38, 38]
    doc.setFillColor(...scoreColor)
    doc.roundedRect(margin, y, contentW, 26, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(`${totalObtained}/${totalMarks}`, margin + 12, y + 17)
    doc.setFontSize(11)
    doc.text(`${pct}%`, margin + 60, y + 17)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Generated: ${today}`, pageW - margin - 2, y + 17, { align: 'right' })
    y += 34

    // Summary table
    checkY(20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 31, 61)
    doc.text('Question-wise Marks Summary', margin, y)
    y += 6

    const cols = [12, 90, 22, 22, 28]
    const headers = ['Q.No', 'Question', 'Max Marks', 'Obtained', 'Confidence']
    doc.setFillColor(15, 31, 61)
    doc.rect(margin, y, contentW, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    let cx = margin + 3
    headers.forEach((h, i) => { doc.text(h, cx, y + 5.5); cx += cols[i] })
    y += 8

    results.forEach((r, i) => {
      checkY(10)
      doc.setFillColor(i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 251 : 247, i % 2 === 0 ? 252 : 250)
      doc.rect(margin, y, contentW, 8, 'F')
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      cx = margin + 3
      const row = [
        `Q${i + 1}`,
        r.question.substring(0, 42) + (r.question.length > 42 ? '...' : ''),
        String(r.evaluation.maxMarks),
        String(r.evaluation.marks),
        r.evaluation.confidence
      ]
      row.forEach((cell, ci) => { doc.text(cell, cx, y + 5.5); cx += cols[ci] })
      y += 8
    })

    // Total row
    checkY(10)
    doc.setFillColor(235, 240, 255)
    doc.rect(margin, y, contentW, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 31, 61)
    doc.text('TOTAL', margin + 3, y + 6)
    doc.text(String(totalMarks), margin + 3 + 12 + 90, y + 6)
    doc.text(String(totalObtained), margin + 3 + 12 + 90 + 22, y + 6)
    y += 16

    // Per-question detail
    results.forEach((r, i) => {
      checkY(40)
      doc.setFillColor(248, 249, 252)
      doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F')
      doc.setFillColor(...scoreColor)
      doc.roundedRect(margin, y, 3, 8, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 31, 61)
      doc.text(`Question ${i + 1}`, margin + 7, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...scoreColor)
      doc.text(`${r.evaluation.marks}/${r.evaluation.maxMarks}`, pageW - margin - 2, y + 5.5, { align: 'right' })
      y += 11

      const sections = [
        ['Question', r.question],
        ['Student Answer (OCR)', r.studentAnswer || 'Could not extract text'],
        ['Key Points Covered', r.evaluation.key_points_covered],
        ['Key Points Missed', r.evaluation.key_points_missed],
        ['Examiner Feedback', r.evaluation.feedback],
        ['Marks Reasoning', r.evaluation.reasoning],
        ['How to Improve', r.evaluation.improvements],
      ]

      sections.forEach(([label, text]) => {
        const lines = doc.splitTextToSize(String(text || '-'), contentW - 8)
        const blockH = lines.length * 4.5 + 10
        checkY(blockH)
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(225, 230, 240)
        doc.roundedRect(margin, y, contentW, blockH, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(100, 110, 130)
        doc.text(label.toUpperCase(), margin + 4, y + 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(30, 40, 60)
        doc.text(lines, margin + 4, y + 11)
        y += blockH + 4
      })
      y += 6
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFillColor(15, 31, 61)
      doc.rect(0, 287, pageW, 10, 'F')
      doc.setTextColor(180, 190, 210)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Maharashtra State Board — AI Evaluation Report', margin, 293)
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, 293, { align: 'right' })
    }

    const filename = `${studentName || 'Student'}_${subject}_Evaluation.pdf`
    doc.save(filename)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const percentage = (totalObtained / totalMarks) * 100
  const overallColor = percentage >= 70 ? '#16A34A' : percentage >= 35 ? '#D97706' : '#DC2626'
  const confidenceColor = { HIGH: '#16A34A', MEDIUM: '#D97706', LOW: '#DC2626' }

  const formatPoints = (points) => {
    const EMPTY_VALUES = [
      'Unable to determine', 'See reasoning for details',
      'See reasoning section for details', 'Not provided', 'N/A', 'n/a'
    ]
    const str = String(points || '').trim()
    if (!str || EMPTY_VALUES.includes(str)) {
      return <p style={{ color: '#9CA3AF', fontSize: '13px' }}>See reasoning section for details</p>
    }
    let items = []
    const lines = str.split('\n').map(p => p.replace(/^[\s\d\-\.\u2022\*]+/, '').trim()).filter(Boolean)
    if (lines.length > 1) {
      items = lines
    } else if (str.includes(',')) {
      items = str.split(',').map(p => p.trim()).filter(Boolean)
    } else {
      items = [str]
    }
    items = items.filter(p => p.length > 0)
    if (items.length === 0) {
      return <p style={{ color: '#9CA3AF', fontSize: '13px' }}>See reasoning section for details</p>
    }
    return items.map((point, index) => (
      <p key={index} style={{ marginBottom: '5px', fontSize: '13px', lineHeight: '1.6' }}>• {point}</p>
    ))
  }

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  // Count how many questions have LOW confidence
  const lowConfidenceCount = results.filter(r => r.evaluation.confidence === 'LOW').length

  return (
    <div className="step-content">
      <div id="results-content">

        {/* ── Official Header ── */}
        <div className="official-header">
          <div className="official-header-top">
            <div className="official-emblem">
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <path d="M24 8 L26 18 L36 18 L28 24 L31 34 L24 28 L17 34 L20 24 L12 18 L22 18 Z" fill="rgba(255,200,80,0.9)"/>
              </svg>
            </div>
            <div className="official-title">
              <h2>Maharashtra State Board of Secondary &amp; Higher Secondary Education</h2>
              <p>AI-Powered Answer Sheet Evaluation Report</p>
            </div>
          </div>
          <div className="official-divider" />
          <div className="official-subtitle">
            {className} Examination — {subject} | {chapter} | Date: {today}
          </div>
        </div>

        {/* ── Global LOW confidence warning banner ── */}
        {lowConfidenceCount > 0 && (
          <div className="confidence-warning-banner">
            <div className="confidence-warning-icon">!</div>
            <div>
              <strong>Manual Review Recommended</strong>
              <p>
                {lowConfidenceCount} question{lowConfidenceCount > 1 ? 's have' : ' has'} low AI
                confidence. Please verify {lowConfidenceCount > 1 ? 'these results' : 'this result'} manually
                before sharing with the student.
              </p>
            </div>
          </div>
        )}

        {/* ── Confidence Legend ── */}
        <div className="confidence-legend">
          <span className="legend-title">Confidence Guide:</span>
          <span className="legend-item legend-high">HIGH — AI is certain</span>
          <span className="legend-item legend-medium">MEDIUM — AI is fairly sure</span>
          <span className="legend-item legend-low">LOW — Manual review needed</span>
          {ocrConfidence && (
            <span className="legend-ocr">
              OCR Quality: <strong>{ocrConfidence}</strong>
            </span>
          )}
        </div>

        {/* ── Student Details ── */}
        <div className="student-detail-card">
          <div className="student-detail-grid">
            <div className="student-detail-item">
              <span className="detail-label">Student Name</span>
              <span className="detail-value">{studentName}</span>
            </div>
            <div className="student-detail-item">
              <span className="detail-label">Class</span>
              <span className="detail-value">{className}</span>
            </div>
            <div className="student-detail-item">
              <span className="detail-label">Subject</span>
              <span className="detail-value">{subject}</span>
            </div>
            <div className="student-detail-item">
              <span className="detail-label">Chapter</span>
              <span className="detail-value">{chapter}</span>
            </div>
            <div className="student-detail-item">
              <span className="detail-label">Question Paper</span>
              <span className="detail-value">{questionPaper}</span>
            </div>
            <div className="student-detail-item">
              <span className="detail-label">Medium</span>
              <span className="detail-value">{language}</span>
            </div>
          </div>
        </div>

        {/* ── Score Card ── */}
        <div className="board-score-card" style={{ borderColor: overallColor }}>
          <div className="board-score-top">
            <div className="score-left">
              <div className="big-score" style={{ color: overallColor }}>
                {totalObtained}<span className="score-slash">/{totalMarks}</span>
              </div>
              <div className="score-percentage">{Math.round(percentage)}% scored</div>
            </div>
            <div className="score-meta">
              <div className="score-meta-item">
                <span className="score-meta-label">Questions</span>
                <span className="score-meta-value">{results.length}</span>
              </div>
              <div className="score-meta-item">
                <span className="score-meta-label">Total Marks</span>
                <span className="score-meta-value">{totalMarks}</span>
              </div>
              <div className="score-meta-item">
                <span className="score-meta-label">Obtained</span>
                <span className="score-meta-value" style={{ color: overallColor }}>{totalObtained}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary Table ── */}
        <div className="result-card">
          <h3>Question-wise Marks Summary</h3>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Q.No</th>
                <th>Question</th>
                <th>Max Marks</th>
                <th>Obtained</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, index) => (
                <tr key={index}>
                  <td>Q{index + 1}</td>
                  <td>{r.question.substring(0, 50)}{r.question.length > 50 ? '...' : ''}</td>
                  <td>{r.evaluation.maxMarks}</td>
                  <td style={{ color: overallColor, fontWeight: 700 }}>{r.evaluation.marks}</td>
                  <td>
                    <span className="mini-badge" style={{ backgroundColor: confidenceColor[r.evaluation.confidence] }}>
                      {r.evaluation.confidence}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}><strong>TOTAL</strong></td>
                <td><strong>{totalMarks}</strong></td>
                <td><strong>{totalObtained}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Per-question Results ── */}
        {results.map((r, index) => (
          <div key={index} className="question-result-section">
            <div className="question-result-header">
              <h3>Question {index + 1}</h3>
              <span className="question-marks-badge" style={{ backgroundColor: overallColor }}>
                {r.evaluation.marks}/{r.evaluation.maxMarks}
              </span>
            </div>

            {/* LOW confidence inline warning */}
            {r.evaluation.confidence === 'LOW' && (
              <div className="low-confidence-alert">
                Low confidence — manual review recommended for this question.
              </div>
            )}

            {/* AI metadata row */}
            <div className="ai-meta-row">
              {r.evaluation.ai_provider && (
                <span className="ai-provider-tag">
                  AI: {r.evaluation.ai_provider === 'gemini' ? 'Gemini' : 'Sarvam'}
                </span>
              )}
              {r.evaluation.confidence && (
                <span
                  className="confidence-tag"
                  style={{ backgroundColor: confidenceColor[r.evaluation.confidence] + '20',
                           color: confidenceColor[r.evaluation.confidence],
                           border: `1px solid ${confidenceColor[r.evaluation.confidence]}40` }}
                >
                  Confidence: {r.evaluation.confidence}
                </span>
              )}
              {r.evaluation.timing?.total_ms && (
                <span className="timing-tag">
                  {(r.evaluation.timing.total_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            <p className="question-text">{r.question}</p>

            <div className="result-card">
              <h3>What AI Read from Answer Sheet</h3>
              <p className="result-text">{r.studentAnswer || 'Could not extract text'}</p>
            </div>

            <div className="result-row">
              <div className="result-card half green">
                <h3>Key Points Covered</h3>
                {formatPoints(r.evaluation.key_points_covered)}
              </div>
              <div className="result-card half red">
                <h3>Key Points Missed</h3>
                {formatPoints(r.evaluation.key_points_missed)}
              </div>
            </div>

            <div className="result-card">
              <h3>Examiner Feedback</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.7' }}>{r.evaluation.feedback}</p>
            </div>

            <div className="result-card highlight">
              <h3>Marks Reasoning</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.7' }}>{r.evaluation.reasoning}</p>
            </div>

            <div className="result-card">
              <h3>How to Improve</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.7' }}>{r.evaluation.improvements}</p>
            </div>
          </div>
        ))}

        <div className="official-footer">
          <p>This evaluation is generated by AI and is for reference purposes only.</p>
          <p>Maharashtra State Board of Secondary &amp; Higher Secondary Education</p>
          <p>Generated on: {today}</p>
        </div>

      </div>

      <div className="action-buttons">
        <button className="btn-export" onClick={handleExportPDF}>Export PDF Report</button>
        <button className="btn-primary action-btn" onClick={onReset}>Evaluate Another Student</button>
      </div>
    </div>
  )
}

export default Step3Results