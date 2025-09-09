// /netlify/functions/generate.js

exports.handler = async function(event) {
  // 1. We only care about POST requests.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2. Get the API key from environment variables.
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key is not set.' }) };
  }

  // 3. Get the prompt from the request body.
  const body = JSON.parse(event.body);
  const prompt = body.prompt;
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required.' }) };
  }

  // 4. Call the Google Gemini API.
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
      // Forward the error from Google's API
      const errorData = await response.json();
      return {
        statusCode: response.status,
        body: JSON.stringify(errorData)
      };
    }

    const data = await response.json();

    // 5. Return the successful response to the frontend.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch from Google API.' })
    };
  }
};
