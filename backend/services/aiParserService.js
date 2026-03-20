const fs = require('fs');
const mammoth = require('mammoth');

async function extractTextFromFile(filePath, mimeType) {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filePath.endsWith('.docx')) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            console.error('Mammoth extraction error:', error);
            // Fallback to text reading if mammoth fails
            return fs.readFileSync(filePath, 'utf8');
        }
    }
    
    // Default fallback for text files
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('File read error:', error);
        return '';
    }
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
Ты элитный бизнес-архитектор и системный аналитик. Твоя задача — проанализировать регламентирующий документ компании и извлечь из него структуру бизнес-процесса.

ИНСТРУКЦИИ:
1. Найди название процесса, его цель и владельца.
2. Детально опиши шаги процесса.
3. Выяви связи с другими процессами или системами (КИАС, MyCent, 1С и т.д.).
4. Ответ должен быть СТРОГО в формате JSON.

ФОРМАТ ОТВЕТА (JSON):
{
  "department": "Название департамента",
  "process": {
    "name": "Название процесса",
    "goal": "Цель процесса",
    "owner": "Владелец/Ответственный",
    "participants": ["Участник 1", "Участник 2"],
    "description": "Подробное текстовое описание по шагам. Используй Markdown для списков.",
    "connections": ["Связанный процесс или система 1", "Система 2"]
  }
}

ДОКУМЕНТ ДЛЯ АНАЛИЗА:
${text.substring(0, 50000)}
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
                // Incorporate goal and participants into description for UI compatibility if needed, 
                // but keep them in the object as well
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
