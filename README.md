AI Exam Evaluator
Automated Handwritten Answer Evaluation System
Maharashtra SSC / HSC Board
Developed by: Riya Thorat
________________________________________
Project Overview
AI Exam Evaluator is a full stack web application built as part of a technical assessment to explore how OCR and AI can assist teachers in evaluating handwritten exam answers.
The system extracts text from a student’s handwritten answer sheet and compares it with a model answer using AI. Based on this comparison, it generates:
•	Marks
•	Examiner feedback
•	Step by step reasoning
•	Key points covered and missed
•	Confidence level
•	Improvement suggestions
The goal of this project is not to replace teachers, but to reduce manual effort and provide clear, explainable assistance during evaluation.
________________________________________
Problem Statement
Manual evaluation of descriptive answer sheets is:
•	Time consuming
•	Repetitive
•	Prone to inconsistency when large volumes are involved
Teachers must also justify marks clearly, which becomes difficult under time pressure.
This project attempts to address this by providing initial AI assisted evaluation, while keeping the final decision with the teacher.
________________________________________
Scope & Design Decisions (Very Important)
This project is intentionally developed as a proof of concept, not a complete board exam correction system.
Key scope decisions:
•	Focus on individual questions or small sets of questions
•	Avoid full paper segmentation (detecting Q1, Q2, Q3 automatically)
•	Prioritize working core flow, explainability, and reliability
Some enhancements (multilingual OCR tuning, deterministic scoring, exhaustive testing) were identified but not completed due to time constraints and are documented honestly as future work.
________________________________________
What the System Currently Does Well
•	End to end working flow (UI → OCR → AI → result)
•	Structured, explainable evaluation
•	Confidence based results (HIGH / MEDIUM / LOW)
•	Clear feedback and reasoning
•	Exam templates to avoid repeated data entry
•	Evaluation history (date + marks)
•	PDF export of results
•	Automatic fallback if primary AI fails
________________________________________
Challenges Faced During Development
This project involved real debugging and iteration, not just feature implementation. Some key challenges were:
•	OCR issues:
Initial OCR using Tesseract.js frequently failed due to language data loading and inconsistent extraction. This led to switching to Gemini Vision for better reliability.
•	AI response formatting errors:
The AI sometimes returned extra text or malformed JSON. Regex based extraction and strict prompt tuning were added to handle this.
•	API failures & configuration issues:
Encountered invalid API keys, model not found errors, and rate limit issues while integrating Sarvam AI and Gemini.
•	CORS and routing bugs:
Frontend and backend communication initially failed due to incorrect CORS configuration and missing route registration.
•	Inconsistent scoring for identical inputs:
Observed that the same answer could sometimes receive slightly different marks due to the probabilistic nature of LLMs. A normalization layer was identified as a necessary next step but not implemented due to time constraints.
These challenges shaped many design decisions and improved understanding of real world system reliability.
________________________________________
Known Limitations (Current State)
•	Multilingual OCR (Hindi / Marathi handwritten answers):
Typed input works correctly, but handwritten OCR tuning for Devanagari scripts is pending.
•	Deterministic scoring:
Same input consistency normalization is planned but not yet implemented.
•	Comprehensive testing:
Core flows were tested manually, but full regression testing across all edge cases is still pending.
These are documented intentionally and treated as future enhancements, not hidden gaps.
________________________________________
Final Note
This project reflects practical learning, real debugging, and conscious engineering trade offs.
The focus was on building a clear, explainable, and reliable prototype suitable for an intern level technical assessment rather than claiming production readiness.
