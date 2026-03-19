const fs = require('fs');

async function extractTextFromFile(filePath, mimeType) {
    console.warn('PDF and Word parsing are disabled due to missing dependencies. Falling back to text extraction.');
    // Fallback for text files
    return fs.readFileSync(filePath, 'utf8');
}

async function parseDocumentsWithAI(files, processEnvGoogleApiKey) {
    const results = { departments: [], processes: [] };
    const deptSet = new Set();
    
    // Process each document individually (1 file = 1 process)
    for (const file of files) {
        try {
            const text = await extractTextFromFile(file.path, file.mimetype);
            if (!text || !text.trim()) continue;

            const prompt = `
Ты опытный бизнес-архитектор. Прочитай следующий документ компании и выдели из него ОДИН ГЛАВНЫЙ бизнес-процесс.
Ответь СТРОГО в формате JSON без markdown блоков, следующего вида:
{
  "department": "Название Департамента, к которому относится процесс",
  "process": {
    "name": "Название процесса",
    "owner": "Владелец (роль/должность)",
    "description": "ПОЛНОЕ описание процесса в развернутом виде: шаги действий, логика ИЛИ/ЕСЛИ, важные нюансы из текста. Если текста много, составь выжимку, но не упускай суть.",
    "connections": ["Название другого процесса, с которым есть связь (из текста)"]
  }
}

ДОКУМЕНТ:
${text.substring(0, 900000)}
`;

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${processEnvGoogleApiKey}`;
            const apiResponse = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!apiResponse.ok) {
                console.error('LLM API error for file', file.originalname, apiResponse.statusText);
                continue;
            }

            const data = await apiResponse.json();
            let jsonText = data.candidates[0].content.parts[0].text;
            // Clean up markdown quotes if present
            jsonText = jsonText.replace(/^```json/m, '').replace(/```\s*$/m, '').trim();

            const parsed = JSON.parse(jsonText);
            
            if (parsed.department) {
                deptSet.add(parsed.department);
            }
            if (parsed.process && parsed.process.name) {
                parsed.process.department = parsed.department || 'Общий отдел';
                results.processes.push(parsed.process);
            }
        } catch (error) {
            console.error(`Failed to parse document ${file.originalname}:`, error);
        }
    }

    results.departments = Array.from(deptSet);
    return results;
}

module.exports = { parseDocumentsWithAI };
