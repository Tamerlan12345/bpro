const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { fetchWithRetry } = require('../utils/resilientFetch');

let PDFParseClass = null;
async function getPdfParser() {
    if (PDFParseClass) {
        return PDFParseClass;
    }

    try {
        // pdf-parse v2+ exports a class PDFParse
        const loaded = require('pdf-parse');
        if (loaded.PDFParse) {
            PDFParseClass = loaded.PDFParse;
        } else if (typeof loaded === 'function') {
            // Fallback for v1 if somehow it's downgraded
            PDFParseClass = loaded;
        } else {
            throw new Error('Could not find PDFParse class or function in pdf-parse module');
        }
    } catch (error) {
        console.error('Failed to load pdf-parse:', error);
        throw error;
    }
    return PDFParseClass;
}

async function extractTextFromFile(filePath, mimeType) {
    const isWord = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   filePath.toLowerCase().endsWith('.docx');
    
    const isPdf = mimeType === 'application/pdf' || 
                  filePath.toLowerCase().endsWith('.pdf');

    console.log(`Extracting text from: ${filePath} (mimetype: ${mimeType})`);

    if (isWord) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            if (result.messages && result.messages.length > 0) {
                console.warn('Mammoth extraction warnings:', result.messages);
            }
            return result.value || '';
        } catch (error) {
            console.error('Mammoth extraction error:', error);
            return '';
        }
    } else if (isPdf) {
        let parser = null;
        try {
            console.log(`Extracting PDF text from: ${filePath}`);
            const dataBuffer = fs.readFileSync(filePath);
            const PDFParse = await getPdfParser();
            
            // Handle both v2 (class) and v1 (function)
            if (PDFParse.prototype && PDFParse.prototype.getText) {
                parser = new PDFParse({ data: dataBuffer });
                const data = await parser.getText();
                return data.text || '';
            } else {
                // v1 fallback
                const data = await PDFParse(dataBuffer);
                return data.text || '';
            }
        } catch (error) {
            console.error('PDF extraction error:', error);
            return '';
        } finally {
            if (parser && typeof parser.destroy === 'function') {
                await parser.destroy();
            }
        }
    }

    // Default fallback for plain text files
    try {
        const ext = path.extname(filePath).toLowerCase();
        const binaryExts = ['.doc', '.xls', '.xlsx', '.ppt', '.pptx', '.bin', '.exe', '.zip', '.rar'];
        
        if (binaryExts.includes(ext)) {
            console.warn(`Attempted to read binary file as text: ${filePath}. Unsupported format.`);
            return '';
        }

        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) { // 10MB limit for text files
            console.warn(`Text file too large: ${filePath}`);
            return '';
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('File read error:', error);
        return '';
    }
}

async function callGoogleAPI(prompt, apiKey) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const apiResponse = await fetchWithRetry(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }, {
        fetchImpl: fetch,
        retries: 2,
        timeoutMs: 15000,
        retryDelayMs: 300
    });
    if (!apiResponse.ok) throw new Error(apiResponse.statusText);
    const data = await apiResponse.json();
    return data.candidates[0].content.parts[0].text;
}

async function processTextBlock(textBlock, apiKey, blockIndex) {
    const prompt = `Ты — эксперт по анализу бизнес-процессов.
Проанализируй следующую часть документа (Часть ${blockIndex}). Извлеки все шаги процесса, артефакты, системы (MyCent, 1C и др.) и роли.
Особое внимание удели строгой последовательности (Sequential Order) действий и пропиши скрытые условия ветвления (IF-THEN-ELSE).
Ответь в структурированном текстовом формате:
Название промежуточных процессов/шагов.
Участники и Системы.
Действия по порядку с условиями IF-THEN-ELSE.
Входящие/исходящие документы (артефакты).
Упоминания других бизнес-процессов для построения сквозной карты.

ТЕКСТ (Часть ${blockIndex}):
${textBlock}
`;
    return await callGoogleAPI(prompt, apiKey);
}

async function parseDocumentsWithAI(files, processEnvGoogleApiKey) {
    const results = { departments: [], processes: [] };
    const deptSet = new Set();
    const MAX_CHUNK_LENGTH = 100000; // rough equivalent for ~30k tokens

    // Process each document individually (1 file = 1 process)
    for (const file of files) {
        try {
            const text = await extractTextFromFile(file.path, file.mimetype);
            if (!text || !text.trim()) continue;

            let finalAnalysisContent = text;

            // Map-Reduce logic
            if (text.length > MAX_CHUNK_LENGTH) {
                console.log(`File ${file.originalname} is large (${text.length} chars). Applying Map-Reduce strategy.`);
                const chunks = [];
                for (let i = 0; i < text.length; i += MAX_CHUNK_LENGTH) {
                    chunks.push(text.substring(i, i + MAX_CHUNK_LENGTH));
                }

                let blockResults = [];
                for (let i = 0; i < chunks.length; i++) {
                    console.log(`Processing block ${i + 1}/${chunks.length} for ${file.originalname}...`);
                    try {
                        const blockResult = await processTextBlock(chunks[i], processEnvGoogleApiKey, i + 1);
                        blockResults.push(`--- ИТОГИ ЧАСТИ ${i + 1} ---\n${blockResult}`);
                    } catch (e) {
                        console.error(`Error processing block ${i + 1}:`, e);
                    }
                }
                finalAnalysisContent = blockResults.join('\n\n');
            } else {
                finalAnalysisContent = text;
            }

            // Enhanced prompt for more detailed extraction
            const prompt = `
Ты — элитный бизнес-архитектор и эксперт по BPMN. Твоя задача: провести глубокий анализ документа и извлечь полную структуру бизнес-процесса.

ИНСТРУКЦИИ:
1.  **Название и Департамент**: Извлеки название процесса и укажи соответствующий отдел. Если отдел не указан, определи его по смыслу.
2.  **Цель процесса**: Сформулируй краткую бизнес-цель.
3.  **Участники**: Перечисли все роли и системы, задействованные в процессе.
4.  **Описание (Markdown)**: 
    *   Создай пошаговый алгоритм (Sequential Order). 
    *   Явно выдели условия IF-THEN-ELSE для всех развилок.
    *   Используй таблицы или списки для наглядности.
5.  **Межпроцессные связи**: Найди любые ссылки на другие процессы (куда передаются данные на входе/выходе).
6.  **Формат**: Ответ СТРОГО в JSON.

ФОРМАТ ОТВЕТА (JSON):
{
  "department": "Название департамента",
  "process": {
    "name": "Название процесса",
    "goal": "Краткая бизнес-цель",
    "owner": "Роль владельца процесса",
    "participants": ["Роль 1", "Роль 2", "Система X"],
    "description": "ПОЛНОЕ И ПОДРОБНОЕ ОПИСАНИЕ С ИСПОЛЬЗОВАНИЕМ MARKDOWN с учетом IF-THEN-ELSE и строгой последовательности.",
    "connections": ["Связанный процесс 1", "Связанный процесс 2"]
  }
}

ДАННЫЕ ДЛЯ АНАЛИЗА:
${finalAnalysisContent}
`;

            let jsonText = await callGoogleAPI(prompt, processEnvGoogleApiKey);
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Could not find JSON structure in AI response");
            const parsed = JSON.parse(jsonMatch[0]);

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
