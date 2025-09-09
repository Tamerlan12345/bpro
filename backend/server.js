// Загружаем переменные окружения из файла .env
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
// Важно: Укажите порт из переменных окружения или 3000 по умолчанию
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(express.json()); // Для парсинга JSON-тела запроса

// Настройка CORS: разрешаем запросы только с вашего фронтенд-домена
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5500' // Укажите URL вашего фронтенда
};
app.use(cors(corsOptions));


// --- Routes ---
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  // Проверка, что промпт и ключ API существуют
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY is not set!');
    return res.status(500).json({ error: 'API key is not configured on the server' });
  }

  try {
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('Google API Error:', errorData);
      return res.status(apiResponse.status).json({ error: 'Failed to fetch from Google API', details: errorData });
    }

    const data = await apiResponse.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- Server Activation ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
