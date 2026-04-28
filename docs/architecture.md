AI Exam Evaluator – System Architecture
________________________________________
Architecture Overview
The AI Exam Evaluator follows a client–server architecture with clearly separated layers.
The design emphasizes:
•	Simplicity
•	Reliability
•	Explainability
•	Ease of debugging
Rather than over engineering, the system was designed to clearly demonstrate the OCR → AI → evaluation pipeline.
________________________________________
High Level Flow
Teacher
↓
React Frontend (3 Step Wizard)
↓
Node.js + Express Backend
├── OCR Extraction
├── AI Evaluation
│ ├── Sarvam AI (Primary)
│ └── Google Gemini (Fallback)
↓
Evaluation Result (JSON)
↓
Frontend Display (Marks, Feedback, Confidence)
________________________________________
Frontend Layer (React.js)
Responsibilities
•	Collect student and exam information
•	Allow reuse of templates
•	Upload handwritten answer images
•	Display evaluation results clearly
•	Show confidence and warnings
•	Provide access to evaluation history
Key Components
•	Step1Form: Exam details, questions, model answers
•	Step2Upload: Image upload and preview
•	Step3Results: Evaluation output and confidence
•	StepBar: Step progress indicator
The 3 step flow was chosen to reduce confusion and match how teachers actually evaluate answers.
________________________________________
Backend Layer (Node.js + Express)
The backend acts as the orchestration layer.
Responsibilities
•	Handle file uploads
•	Validate inputs
•	Perform OCR extraction
•	Build AI evaluation prompts
•	Handle AI failures gracefully
•	Validate and sanitize AI output
•	Track templates, history, and basic metrics
________________________________________
OCR Layer (Key Learning Area)
OCR was initially implemented using Tesseract.js.
During testing, several issues were observed:
•	Language data loading failures
•	Inconsistent extraction quality
•	Increased debugging overhead
To improve stability, OCR extraction was shifted to Gemini Vision, which reduced setup issues and provided more consistent results.
OCR output is treated as an input signal, not final truth.
________________________________________
AI Evaluation Layer
•	Primary: Sarvam AI
•	Fallback: Google Gemini
AI is instructed to:
•	Return structured JSON only
•	Explain marks clearly
•	Identify key points covered/missed
•	Provide confidence level
Fallback ensures the system continues working even if one AI fails.
________________________________________
Architectural Strengths
•	Clear separation of concerns
•	Automatic fallback handling
•	Explainable AI output
•	Designed with future extensions in mind
•	Simple enough to debug and reason about
