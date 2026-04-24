 AI Exam Evaluator — Architecture 

1. Architecture Overview
The AI Exam Evaluator follows a client–server architecture to automate the evaluation of handwritten exam answers using OCR and AI.
The system is organized into three logical layers:
Frontend (React.js): Handles user interaction and result display
Backend (Node.js + Express): Manages OCR, AI evaluation, and data flow
OCR & AI Services: Perform handwriting recognition and answer evaluation
This layered approach ensures clear separation of responsibilities, reliability, and explainable evaluation results.

2. High-Level Architecture Flow
Teacher
  ↓
React Frontend (3-Step Wizard)
  ↓
Node.js Backend (REST API)
  ├─ OCR (Tesseract.js)
  ├─ AI Evaluation (Sarvam AI)
  └─ Backup AI (Google Gemini)
  ↓
Evaluation Result (JSON)
  ↓
React Frontend (Marks, Feedback, Reasoning)

3. Frontend Layer (React.js)
Purpose
Provides a simple, guided workflow for teachers using a 3-step wizard, reducing user errors and training needs.
Key Components
Step1Form: Collects subject, question, model answer, and maximum marks
Step2Upload: Uploads handwritten answer sheet with image preview
Step3Results: Displays marks, feedback, reasoning, confidence, and improvements
StepBar: Shows progress across steps
Responsibilities
Input validation
Image preview handling
API communication using Axios
Clear presentation of explainable AI output

4. Backend Layer (Node.js + Express)
Purpose
Acts as the central orchestration layer, connecting frontend, OCR, and AI services.
Responsibilities
Accepts multipart form data (image + text)
Saves uploaded answer sheets
Extracts text using OCR
Builds structured AI evaluation prompts
Handles AI failures and fallbacks
Returns clean JSON responses
APIs
POST /api/ocr/extract – Extracts text using Tesseract.js
POST /api/full-evaluate – Complete OCR → AI → evaluation pipeline

5. OCR Layer (Tesseract.js)
Free, open-source, and offline
No external API cost
Suitable for clear handwritten or printed answers
Integrated directly with Node.js
Edge cases handled:
Unreadable or blank answers return safe default evaluation (0 marks with guidance).

6. AI Evaluation Layer
Primary AI: Sarvam AI (Indian academic context)
Backup AI: Google Gemini (used if Sarvam fails)
Evaluation Features
Fair and partial marking
Strict JSON-only responses
Explainable reasoning
Confidence scoring
Improvement suggestions

7. Explainable AI Design
Instead of only marks, the system provides:
Reasoning for marks awarded
Key points covered and missed
Actionable improvement suggestions
Confidence level with explanation
This ensures transparency, trust, and usability for teachers.

8. Architectural Strengths
Modular and layered design
Clear end-to-end data flow
Explainable AI implementation
Cost-effective (free OCR)
Reliable with AI fallback
Easy to extend for future enhancements

9. Summary
The AI Exam Evaluator architecture is simple, reliable, transparent, and scalable, making it suitable for real-world educational evaluation and demonstration in academic or judging environments.

