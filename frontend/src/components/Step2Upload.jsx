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
    if (!image) {
      setError('Please upload an answer sheet image')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Build form data for file upload
      const data = new FormData()
      data.append('answerSheet', image)
      data.append('subject', formData.subject)
      data.append('questionText', formData.question)
      data.append('modelAnswer', formData.modelAnswer)
      data.append('maxMarks', formData.maxMarks)

      // Send to backend
      const response = await axios.post(
        'http://localhost:3000/api/full-evaluate',
        data,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setResult(response.data)
      onSuccess()

    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="step-content">
      <h2> Step 2: Upload Student Answer Sheet</h2>
      <p className="subtitle">
        Upload a clear photo or scan of the student's
        handwritten answer sheet
      </p>

      {/* Upload Box */}
      <div
        className="upload-box"
        onClick={() => document.getElementById('fileInput').click()}
      >
        {imagePreview ? (
          <div className="image-preview-container">
            <img src={imagePreview} alt="Answer sheet" className="preview-img" />
            <p className="change-text">Click to change image</p>
          </div>
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">📸</span>
            <p className="upload-text">Click to upload answer sheet</p>
            <p className="upload-hint">JPG or PNG • Clear photo works best</p>
          </div>
        )}
      </div>

      <input
        id="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />

      {/* Tips */}
      <div className="tips-box">
        <p> Tips for best results:</p>
        <ul>
          <li>Good lighting — no shadows</li>
          <li>Flat surface — no wrinkles</li>
          <li>Clear handwriting visible</li>
        </ul>
      </div>

      {error && <p className="error"> {error}</p>}

      {/* Loading State */}
      {loading && (
        <div className="loading-box">
          <div className="spinner" />
          <div className="loading-steps">
            <p> Reading handwriting with OCR...</p>
            <p> Sending to Sarvam AI...</p>
            <p> Calculating marks and feedback...</p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="button-row">
        <button
          className="btn-secondary"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          className="btn-primary"
          onClick={handleEvaluate}
          disabled={loading}
        >
          {loading ? ' Evaluating...' : ' Evaluate Answer'}
        </button>
      </div>
    </div>
  )
}

export default Step2Upload