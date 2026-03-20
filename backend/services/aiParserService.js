const fs = require('fs');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

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
    } else if (mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } catch (error) {
            console.error('PDF extraction error:', error);
            return '';
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

            // Enhanced prompt for more detailed extraction
            const prompt = `
Ты — ведущий бизнес-архитектор и методолог систем управления процессами. 
Твоя задача: провести глубокий анализ предоставленного документа и извлечь полную структуру бизнес-процесса для обучения ИИ-помощника.

ИНСТРУКЦИИ:
1. КОРНЕВЫЕ ДАННЫЕ: Определи название процесса, его стратегическую цель и владельца (роль).
2. ДЕПАРТАМЕНТ: Укажи, к какому функциональному направлению (департаменту) относится этот процесс.
3. ДЕТАЛИЗАЦИЯ ШАГОВ: Опиши каждый шаг процесса максимально подробно. Не просто "действие", а "кто делает", "что на входе", "какой результат".
4. СТРУКТУРА: Выдели участников (роли), используемые инструменты (ПО, формы), и контрольные точки (KPI/риски).
5. СВЯЗИ: Найди все упоминания взаимодействий с другими подразделениями или внешними системами (КИАС, MyCent, 1С, CRM и т.д.).
6. СТРОГОСТЬ ФОРМАТА: Твой ответ должен быть СТРОГО в формате JSON, без лишнего текста до или после.

ФОРМАТ ОТВЕТА (JSON):
{
  "department": "Название департамента",
  "process": {
    "name": "Название процесса",
    "goal": "Стратегическая цель процесса",
    "owner": "Владелец процесса (полная роль/должность)",
    "participants": ["Роль 1", "Роль 2", "Система X"],
    "description": "ПОЛНОЕ И ПОДРОБНОЕ ОПИСАНИЕ. Используй Markdown для оформления. Опиши логику переходов, условия (если/то), проверяемые документы и итоговые артефакты каждого подпроцесса. Описание должно быть достаточно подробным, чтобы на его основе ИИ мог консультировать сотрудников.",
    "connections": ["Связанный процесс 1", "Интеграция с системой Y"]
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
