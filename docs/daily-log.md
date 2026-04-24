DAY 1 – Project Setup + GitHub + Backend Skeleton
Objective:
Start the project properly, create folder structure, set up GitHub repo, and get backend running.
What I Did:
Created the main project folder structure (backend, frontend, docs).
Initialized Git locally and created a new GitHub repository.
Connected local project to GitHub (first push done).
Set up Node.js + Express backend with basic server file (app.js).
Added CORS and JSON middleware.
Created routes folder structure and confirmed server runs successfully.
Testing Done:
Started server and checked basic health route in browser/Postman.
Challenges Faced:
Confusion about GitHub repo creation and first push steps.
How I Solved It:
Followed a clean flow: git init → add → commit → remote add → push.
Status:
Backend base setup completed and pushed to GitHub.

DAY 2 – OCR Route (Tesseract.js) + Image Upload Handling
Objective:
Implement OCR extraction and confirm handwritten image upload works end-to-end.
What I Did:
Added Multer file upload configuration and created uploads folder.
Built OCR route: POST /api/ocr/extract.
Integrated Tesseract.js to read uploaded image and extract text.
Returned extracted text and OCR confidence in the response.
Added basic validation: if no file uploaded, return a user-friendly error.
Testing Done:
Tested OCR route using Postman with JPG/PNG images.
Verified text output and confidence values.
Challenges Faced:
OCR output was inconsistent when images had shadows or were blurred.
How I Solved It:
Documented photo-taking tips to improve OCR quality (good light, no shadow, clear focus).
Status:
OCR route completed and pushed to GitHub.

DAY 3 – Full Evaluation API (OCR + AI) with Fallback Reliability
Objective:
Build the complete pipeline: upload answer sheet → OCR → AI evaluation → marks + feedback.
What I Did:
Built Full Evaluation route: POST /api/full-evaluate.
Implemented OCR inside this route to extract the student answer text.
Created a structured evaluation prompt using: subject, question, model answer, max marks, student answer.
Integrated Sarvam AI as primary evaluation API.
Added Google Gemini as backup AI when Sarvam fails (timeout/error).
Implemented safe JSON extraction and parsing for AI output.
Testing Done:
Tested with 2–3 sample answers and verified marks + reasoning returned in JSON.
Tested fallback by simulating Sarvam failure and confirming Gemini response works.
Challenges Faced:
AI sometimes returned extra text before JSON, causing JSON parse failure.
How I Solved It:
Added JSON extraction using regex and safe fallback output if parsing fails.
Status:
Backend evaluation pipeline completed and pushed to GitHub.

DAY 4 – Frontend Setup + Step 1 (Exam Details Wizard)
Objective:
Create React frontend and implement the first step of the 3-step flow.
What I Did:
Created React app and installed axios.
Designed the 3-step wizard layout (StepBar + main card layout).
Implemented Step 1 form (subject, question, model answer, max marks).
Added validation messages for empty question/model answer.
Built smooth step navigation from Step 1 → Step 2.
Testing Done:
Verified form validation and wizard step navigation works.
Challenges Faced:
Managing form state across steps without losing inputs.
How I Solved It:
Used a single formData state in App.jsx and passed it to components.
Status:
Frontend base + Step 1 completed and pushed to GitHub.

DAY 5 – Step 2 Upload UI + Backend Connection (FormData)
Objective:
Implement image upload, preview, and connect frontend to backend evaluation API.
What I Did:
Implemented Step2Upload component with file input and image preview.
Added user tips for better OCR results (lighting, shadows, flat sheet).
Implemented API call using axios + FormData to /api/full-evaluate.
Added loading state (Evaluating…) and error handling.
On success, automatically moved user to Step 3 and stored result.
Testing Done:
Tested uploading images and confirmed backend returns evaluation result.
Verified frontend transitions from Step 2 → Step 3 correctly.
Challenges Faced:
CORS errors during API calls.
FormData issues when sending file + text together.
How I Solved It:
Updated backend CORS allowed origins.
Ensured correct field names and multipart/form-data handling.
Status:
Upload + API integration completed and pushed to GitHub.

DAY 6 – Step 3 Results UI + Edge Case Handling + Full Testing
Objective:
Display results in a clear judge-friendly way and test multiple real scenarios.
What I Did:
Implemented Step3Results UI to show marks, feedback, reasoning, confidence, improvements.
Added key points covered and key points missed sections.
Improved visual clarity using score color and confidence badge.
Verified blank/unreadable OCR case returns 0 marks with proper guidance.
Added reset flow to evaluate another answer sheet easily.
Testing Done (5 Scenarios):
Normal partial answer
Perfect answer
Wrong/off-topic answer
Blank paper / no text extracted
Unclear handwriting (low confidence)
Challenges Faced:
OCR sometimes extracted random noise text from background.
How I Solved It:
Added minimum extracted text length check before AI evaluation.
Status:
End-to-end flow stable and pushed to GitHub.

DAY 7 – Final Documentation + Screenshots + Submission Readiness
Objective:
Make the project submission-ready with clear documentation and demo proof.
What I Did:
Wrote final architecture document in simple and clear format.
Wrote API report explaining endpoints, inputs, outputs, and edge cases.
Created daily progress log showing effort, issues, and fixes.
Finalized README with: project overview, features, setup steps, API endpoints.
Added screenshots folder and placed Step 1, Step 2, Step 3 screenshots.
Final GitHub push done with clean commit message.
Final Checks:
Confirmed .env is not pushed (API keys safe).
Confirmed project runs locally (frontend + backend).
Confirmed README screenshots paths are correct.
Reflection / Learning:
This project taught me how OCR works in real use, how to integrate LLM APIs safely, and how to build a reliable system using fallback strategies. The most important learning was that prompt design and error handling matter as much as coding.
Status:
Project fully completed, documented, and submission-ready.
