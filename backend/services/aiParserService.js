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
Ты — элитный бизнес-архитектор и эксперт по автоматизации бизнес-процессов. 
Твоя задача: провести максимально подробный анализ предоставленного документа и извлечь полную структуру бизнес-процесса. 
Эта информация будет использована для обучения ИИ-агента, который должен понимать все нюансы работы.

ИНСТРУКЦИИ ПО ИЗВЛЕЧЕНИЮ:
1.  **Название и Департамент**: С высокой точностью определи название процесса и функциональный отдел (Департамент), к которому он относится.
2.  **Цель и Владелец**: Четко сформулируй бизнес-цель и роль Владельца процесса (тот, кто отвечает за результат).
3.  **Участники и Системы**: Перечисли ВСЕ роли (сотрудников) и ИТ-системы ( MyCent, 1C, КИАС, CRM и т.д.), упомянутые в документе.
4.  **Детальное Описание (Markdown)**: 
    *   Опиши процесс пошагово: Триггер -> Действия -> Результат.
    *   Для каждого шага укажи: КТО делает (Роль), В КАКОЙ системе, КАКОЙ результат (артефакт).
    *   Опиши логические ветвления (Если X, то Y) и условия выхода из процесса.
    *   Включи информацию о контрольных точках и KPI, если они есть.
5.  **Связи с другими процессами**: Найди и выдели упоминания других бизнес-процессов компании для построения сквозной карты.
6.  **Формат**: Ответ должен быть СТРОГО валидным JSON-объектом.

ФОРМАТ ОТВЕТА (JSON):
{
  "department": "Название департамента",
  "process": {
    "name": "Название процесса",
    "goal": "Краткая бизнес-цель",
    "owner": "Роль владельца процесса",
    "participants": ["Роль 1", "Роль 2", "Система X"],
    "description": "ПОЛНОЕ И ПОДРОБНОЕ ОПИСАНИЕ С ИСПОЛЬЗОВАНИЕМ MARKDOWN. Минимум 5-10 абзацев, если документ позволяет. Опиши все шаги, условия, проверки и итоговые результаты.",
    "connections": ["Связанный процесс 1", "Связанный процесс 2"]
  }
}

ДОКУМЕНТ ДЛЯ АНАЛИЗА:
${text.substring(0, 200000)}
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
