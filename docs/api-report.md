AI Exam Evaluator – API Report
________________________________________
Base URL
http://localhost:3000/api
________________________________________
POST /api/ocr/extract
Purpose:
Extract text from a handwritten answer image.
Request:
•	Content Type: multipart/form data
•	Field: image (JPG / PNG)
Response:
•	extractedText
•	ocrConfidence
Error Handling:
•	400 – Missing file
•	415 – Unsupported file type
•	OCR failure handled gracefully
________________________________________
POST /api/full-evaluate
Purpose:
Complete OCR + AI evaluation pipeline.
Request Fields:
•	answerSheet (image)
•	grade
•	subject
•	chapter
•	examType
•	questionText
•	modelAnswer
•	maxMarks
•	lessonContent (optional)
Processing Steps:
1.	Validate inputs
2.	OCR extraction
3.	Prompt construction
4.	Sarvam AI evaluation
5.	Gemini fallback if required
6.	JSON validation and sanitization
Response Fields:
•	marks
•	maxMarks
•	feedback
•	reasoning
•	confidence
•	confidenceReason
•	improvements
•	keyPointsCovered
•	keyPointsMissed
•	aiProvider
•	timing
________________________________________
GET /api/templates
Retrieve saved exam templates.
POST /api/templates
Save a new exam template.
GET /api/evaluations	
Retrieve evaluation history (date, marks, confidence).
GET /api/metrics
View usage metrics and fallback statistics.

