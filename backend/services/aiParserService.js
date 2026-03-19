const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromFile(filePath, mimeType) {
    if (mimeType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType.includes('word')) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } else {
        // Fallback for txt
        return fs.readFileSync(filePath, 'utf8');
    }
}

async function parseDocumentsWithAI(files, processEnvGoogleApiKey) {
    let combinedText = '';
    
    // 1. Extract text from all files
    for (const file of files) {
        try {
            const text = await extractTextFromFile(file.path, file.mimetype);
            combinedText += `\n--- Document: ${file.originalname} ---\n${text}\n`;
        } catch (error) {
            console.error(`Failed to extract text from ${file.originalname}:`, error);
        }
    }

    if (!combinedText.trim()) throw new Error('No text extracted from documents.');
    
    // Chunking might be needed for very large texts, but Gemini 2.0 Flash has 1M context.
    const prompt = `
Ты опытный бизнес-архитектор. Прочитай следующие документы компании и выдели из них бизнес-процессы.
Ответь СТРОГО в формате JSON без markdown блоков, следующего вида:
{
  "departments": ["Название Департамента 1", ...],
  "processes": [
    {
      "name": "Название процесса",
      "owner": "Владелец",
      "department": "Название департамента",
      "connections": ["Название другого процесса, с которым есть связь"]
    }
  ]
}

ДОКУМЕНТЫ:
${combinedText.substring(0, 900000)} // Ограничим на всякий случай
`;

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${processEnvGoogleApiKey}`;
    
    const apiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!apiResponse.ok) {
        throw new Error('LLM parsing failed: ' + apiResponse.statusText);
    }
    
    const data = await apiResponse.json();
    let jsonText = data.candidates[0].content.parts[0].text;
    
    // Clean up markdown quotes if present
    jsonText = jsonText.replace(/^```json/m, '').replace(/```$/m, '').trim();
    
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error('Failed to parse LLM JSON response:', jsonText);
        throw new Error('LLM returned invalid JSON');
    }
}

module.exports = { parseDocumentsWithAI };
