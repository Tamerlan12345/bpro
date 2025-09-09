// /netlify/functions/generate.js

exports.handler = async function(event) {
  console.log('Function invoked. Method:', event.httpMethod);

  // 1. We only care about POST requests.
  if (event.httpMethod !== 'POST') {
    console.log('Responded with 405 Method Not Allowed.');
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2. Get the API key from environment variables.
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    console.error('ERROR: GOOGLE_API_KEY environment variable is not set.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: API key is not set.' }) };
  }
  console.log('API Key found.');

  // 3. Get the prompt from the request body.
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error('ERROR: Could not parse request body as JSON.', e);
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Could not parse JSON body.' }) };
  }

  const prompt = body.prompt;
  if (!prompt) {
    console.error('ERROR: "prompt" key is missing from request body.');
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: "prompt" is required.' }) };
  }
  console.log('Prompt received successfully.');

  // 4. Call the Google Gemini API.
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  try {
    console.log('Attempting to call Google Gemini API...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    console.log('Google API response status:', response.status);

    if (!response.ok) {
      // Forward the error from Google's API
      const errorData = await response.json();
      console.error('ERROR: Google API returned an error.', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify(errorData)
      };
    }

    const data = await response.json();
    console.log('Successfully received data from Google API.');

    // 5. Return the successful response to the frontend.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('FATAL: An unexpected error occurred while fetching from Google API.', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error: Failed to communicate with Google API.' })
    };
  }
};
