import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import ocrRoute from './routes/ocr.route.js';
import evaluateRoute from './routes/evaluate.route.js';

dotenv.config();
const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

app.use('/api', ocrRoute);
app.use('/api', evaluateRoute);

app.get('/', (req, res) => {
  res.json({ message: 'AI Exam Evaluator Backend Running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});