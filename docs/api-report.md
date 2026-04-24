
 AI Exam Evaluator — API Report

1. Introduction
This document describes the Application Programming Interfaces (APIs) used in the AI Exam Evaluator system.
The APIs enable communication between the React frontend and the Node.js backend, handling:
Handwritten answer sheet uploads
Text extraction using OCR
AI-based answer evaluation
Returning structured and explainable results to the user
All APIs follow a RESTful design and return responses in JSON format.

2. Base URL
All API endpoints are served from the following base URL:
http://localhost:3000/api

3. API Overview
Endpoint
Method
Purpose
/ocr/extract
POST
Extracts text from handwritten answer sheet
/full-evaluate
POST
Performs complete OCR + AI evaluation


4. OCR Extraction API
Endpoint
POST /api/ocr/extract
Purpose
This API extracts readable text from a handwritten answer sheet image using Tesseract.js OCR.

Request Details
Request Type: multipart/form-data
Required Parameter:
Parameter
Type
Description
image
Image file
Handwritten answer sheet (JPG / PNG)


Processing Steps
Image is uploaded and saved to the server
Tesseract.js processes the image
Extracted text and OCR confidence are generated

Success Response (JSON)
{
  "success": true,
  "text": "Extracted student answer text",
  "confidence": 82
}

Error Handling
Missing image file
Unsupported file type
OCR processing failure
User-friendly error messages are returned in all cases.

5. Full Evaluation API
Endpoint
POST /api/full-evaluate
Purpose
This is the core API of the system.
It performs end-to-end evaluation, including:
OCR text extraction
AI-based answer comparison
Marks calculation
Explainable feedback generation

Request Details
Request Type: multipart/form-data
Required Parameters:
Parameter
Type
Description
answerSheet
Image file
Handwritten answer sheet
subject
Text
Subject name
questionText
Text
Exam question
modelAnswer
Text
Correct answer
maxMarks
Number
Maximum marks


Processing Workflow
Image is uploaded and stored
OCR extracts the student’s answer
Backend builds structured AI prompt
Sarvam AI evaluates the answer
Google Gemini is used if Sarvam fails
Final evaluation result is returned

Success Response (JSON)
{
  "success": true,
  "subject": "English",
  "question": "What is photosynthesis?",
  "studentAnswer": "Plants use sunlight to make food",
  "evaluation": {
    "marks": 3,
    "maxMarks": 5,
    "feedback": "Basic concept understood but important details are missing.",
    "reasoning": "The student mentioned sunlight and food production but did not include chlorophyll and carbon dioxide.",
    "confidence": "MEDIUM",
    "confidence_reason": "The answer covers some but not all key points.",
    "improvements": "Include the role of chlorophyll and carbon dioxide.",
    "key_points_covered": "Sunlight, food production",
    "key_points_missed": "Chlorophyll, carbon dioxide, oxygen release"
  }
}

6. Edge Case Handling
Blank or unreadable handwriting:
Returns 0 marks with guidance for improvement.
AI service failure:
Automatic fallback to backup AI ensures evaluation continuity.
Unexpected AI output format:
Safe default response returned to prevent system failure.

7. API Design Highlights
Clean RESTful structure
JSON-based responses
Robust error handling
Explainable AI output
AI fallback for reliability
Easy frontend integration

8. Summary
The APIs of the AI Exam Evaluator provide a reliable, transparent, and structured interface for evaluating handwritten exam answers using OCR and AI, ensuring both automation and explainability for teachers.


