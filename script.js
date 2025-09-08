// --- Configuration ---
// WARNING: Storing API keys in client-side code is insecure and should be avoided in production.
// This key is visible to anyone who views the page source.
const API_KEY = 'AIzaSyCisFe9LE9ykOlc7JOn7NEJQDJ3LaMMFqI';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Initialize Mermaid.js
mermaid.initialize({ startOnLoad: true });

let lastAnalysisResult = {}; // To store the latest analysis for applying improvements

// --- DOM Elements ---
const processNameInput = document.getElementById('process-name');
const processDescriptionInput = document.getElementById('process-description');
const renderDiagramBtn = document.getElementById('render-diagram-btn');
const improveBtn = document.getElementById('improve-btn');
const downloadBtn = document.getElementById('download-btn');
const diagramContainer = document.getElementById('diagram-container');
const suggestionsText = document.getElementById('suggestions-text');
const suggestionsContainer = document.getElementById('suggestions-container');
const applyImprovementsBtn = document.getElementById('apply-improvements-btn');

// --- Event Listeners ---

renderDiagramBtn.addEventListener('click', async () => {
    const description = processDescriptionInput.value;
    if (!description.trim()) {
        alert('Пожалуйста, введите описание процесса.');
        return;
    }
    setLoading(diagramContainer, 'Генерирую схему...');
    downloadBtn.style.display = 'none';

    try {
        const mermaidCode = await getMermaidCode(description);
        renderDiagram(mermaidCode);
    } catch (error) {
        setError(diagramContainer, 'Не удалось сгенерировать схему. Проверьте консоль для деталей.');
        console.error('Error generating diagram:', error);
    }
});

improveBtn.addEventListener('click', async () => {
    const description = processDescriptionInput.value;
    if (!description.trim()) {
        alert('Пожалуйста, введите описание процесса.');
        return;
    }
    setLoading(suggestionsText, 'Анализирую процесс...');
    suggestionsText.innerHTML = ''; // Clear previous suggestions

    try {
        const suggestionsJSON = await getOptimizationSuggestions(description);
        // Attempt to clean the string if it's wrapped in markdown
        const cleanedJson = suggestionsJSON.replace(/^```json\s*|```$/g, '');
        const analysisData = JSON.parse(cleanedJson);
        lastAnalysisResult = analysisData; // Store for later use
        renderSuggestions(analysisData);
    } catch (error) {
        setError(suggestionsText, 'Не удалось получить или обработать предложения. Проверьте консоль для деталей.');
        console.error('Error getting or parsing suggestions:', error);
        lastAnalysisResult = {}; // Reset on error
    }
});

downloadBtn.addEventListener('click', () => {
    setLoading(diagramContainer, 'Создаю изображение...');
    html2canvas(diagramContainer.querySelector('.mermaid')).then(canvas => {
        const link = document.createElement('a');
        link.download = `${processNameInput.value || 'process-diagram'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        renderDiagram(diagramContainer.querySelector('.mermaid > svg').outerHTML, true); // Re-render to clean up
    }).catch(err => {
        console.error('Error creating image:', err);
        alert('Не удалось скачать схему.');
    });
});

applyImprovementsBtn.addEventListener('click', async () => {
    const originalProcess = processDescriptionInput.value;
    if (!originalProcess.trim() || !lastAnalysisResult.suggestions || lastAnalysisResult.suggestions.length === 0) {
        alert('Нет исходного процесса или предложений для применения.');
        return;
    }

    // Find all checkboxes and filter the suggestions
    const selectedCheckboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    const selectedSuggestions = Array.from(selectedCheckboxes).map(checkbox => {
        const index = parseInt(checkbox.dataset.suggestionIndex, 10);
        return lastAnalysisResult.suggestions[index];
    });

    if (selectedSuggestions.length === 0) {
        alert('Пожалуйста, выберите хотя бы одно улучшение для применения.');
        return;
    }

    setLoading(suggestionsText, 'Применяю выбранные улучшения...');

    try {
        const optimizedProcess = await getOptimizedProcess(originalProcess, selectedSuggestions);

        // Update the original textarea with the new process
        processDescriptionInput.value = optimizedProcess;

        // Clear the suggestions area after applying them
        suggestionsText.innerHTML = '<p>Улучшения применены. Вы можете обновить схему, нажав на соответствующую кнопку.</p>';
        document.getElementById('transformation-table-container').innerHTML = '';
        document.getElementById('rationale-container').innerHTML = '';
        applyImprovementsBtn.style.display = 'none';

    } catch (error) {
        setError(suggestionsText, 'Не удалось применить улучшения.');
        console.error('Error applying improvements:', error);
    }
});


// --- API Functions ---

async function callGeminiAPI(prompt) {
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function getMermaidCode(processDescription) {
    const prompt = `Преобразуй следующее текстовое описание бизнес-процесса в код для диаграммы Mermaid.js. Используй синтаксис flowchart (graph TD). Не включай ничего, кроме кода Mermaid, без кавычек или дополнительных пояснений.

Описание процесса:
"${processDescription}"`;

    let mermaidCode = await callGeminiAPI(prompt);
    // Clean up the response to ensure it's just the Mermaid code
    mermaidCode = mermaidCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    return mermaidCode;
}

async function getOptimizationSuggestions(processDescription) {
    const prompt = `Ты — методолог с глубоким пониманием архитектуры бизнес-процессов, знаток Miro, BPMN, Lean и TOGAF. Твоя задача — провести критический аудит следующего бизнес-процесса. Ответы должны быть лаконичными.

Проанализируй процесс на:
- Логичность и последовательность.
- Дублирование, пробелы, конфликты.
- Потенциал для оптимизации или удаления шагов.
- Применимость стандартов (BPMN, Lean).

Верни результат в виде ОДНОГО JSON-объекта без markdown-обертки. Объект должен содержать три ключа:
1.  \`suggestions\`: JSON-массив предложений. Каждый объект в массиве должен иметь поля: \`step_number\` (номер шага или null), \`category\` (выбери из: 'Автоматизация', 'Упрощение', 'Устранение дублирования', 'Повышение контроля', 'Снижение рисков'), \`suggestion_text\` (краткое описание) и \`benefit\` (ожидаемая выгода).
2.  \`transformation_table\`: Строка, содержащая Markdown-таблицу 'Было -> Стало' для 2-3 ключевых изменений.
3.  \`rationale\`: Строка с кратким обоснованием улучшений с точки зрения бизнес-логики.

Бизнес-процесс для анализа:
"${processDescription}"`;

    let jsonString = await callGeminiAPI(prompt);
    // Clean up the response to ensure it's just the JSON string
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return jsonString;
}

async function getOptimizedProcess(originalProcess, suggestions) {
    // Convert suggestions array to a simple text list for the prompt
    const suggestionsText = suggestions.map(s => {
        let context = s.step_number ? `(относится к шагу ${s.step_number})` : '(общее)';
        return `- ${s.suggestion_text} ${context}`;
    }).join('\n');

    const prompt = `На основе этого исходного процесса и этих рекомендаций создай новую, оптимизированную версию процесса.
Представь её в виде чёткого пошагового списка. Сохрани или адаптируй нумерацию шагов.
Не добавляй заголовок "Оптимизированный процесс" или что-либо лишнее, только шаги.
Ключевая задача - интегрировать предложенные улучшения в единый, логичный и последовательный новый процесс.

Исходный процесс:
"${originalProcess}"

Рекомендации:
"${suggestionsText}"`;

    return callGeminiAPI(prompt);
}


// --- UI Functions ---

function renderDiagram(content, isHtml = false) {
    if (!content) {
        setError(diagramContainer, 'Не удалось сгенерировать схему.');
        return;
    }

    diagramContainer.innerHTML = isHtml ? content : `<div class="mermaid">${content}</div>`;

    if (!isHtml) {
        mermaid.run({
            nodes: document.querySelectorAll('.mermaid'),
        });
    }

    diagramContainer.style.backgroundColor = '#fff';
    downloadBtn.style.display = 'block';
}

function setLoading(element, text) {
    element.innerHTML = `<div class="loading">${text}</div>`;
}

function setError(element, text) {
    element.innerHTML = `<div class="error">${text}</div>`;
}

function markdownTableToHtml(markdown) {
    if (!markdown) return '';

    const lines = markdown.trim().split('\n');
    if (lines.length < 2) return markdown; // Not a table

    const headerLine = lines[0].split('|').map(h => h.trim()).filter(h => h);
    const bodyLines = lines.slice(2);

    const headerHtml = `<thead><tr>${headerLine.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;

    const bodyHtml = bodyLines.map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length === headerLine.length) {
            return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        }
        return '';
    }).join('');

    return `<table class="comparison-table">${headerHtml}<tbody>${bodyHtml}</tbody></table>`;
}

function renderSuggestions(data) {
    const suggestions = data.suggestions;
    const transformationTable = data.transformation_table;
    const rationale = data.rationale;

    // Clear previous content
    suggestionsText.innerHTML = '';
    const tableContainer = document.getElementById('transformation-table-container');
    const rationaleContainer = document.getElementById('rationale-container');
    tableContainer.innerHTML = '';
    rationaleContainer.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        suggestionsText.innerHTML = '<p>Предложений по оптимизации не найдено.</p>';
        applyImprovementsBtn.style.display = 'none';
        return;
    }

    const categoryIcons = {
        'Автоматизация': '⚙️',
        'Упрощение': '✨',
        'Устранение дублирования': '🗑️',
        'Повышение контроля': '👁️',
        'Снижение рисков': '🛡️'
    };

    const cardsHtml = suggestions.map((suggestion, index) => {
        const icon = categoryIcons[suggestion.category] || '💡';
        const stepLink = suggestion.step_number ?
            `<div class="suggestion-step">Относится к шагу №${suggestion.step_number}</div>` : '';

        return `
            <div class="suggestion-card">
                <div style="display: flex; align-items: flex-start;">
                    <div class="checkbox-container">
                        <input type="checkbox" id="suggestion-${index}" class="suggestion-checkbox" data-suggestion-index="${index}" checked>
                    </div>
                    <div style="flex-grow: 1;">
                        <div class="suggestion-header">
                            <span class="suggestion-icon">${icon}</span>
                            <h4 class="suggestion-category">${suggestion.category}</h4>
                        </div>
                        <p class="suggestion-text">${suggestion.suggestion_text}</p>
                        <div class="suggestion-benefit">
                            <strong>Выгода:</strong> ${suggestion.benefit}
                        </div>
                        ${stepLink}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    suggestionsText.innerHTML = cardsHtml;

    if (transformationTable) {
        tableContainer.innerHTML = `<h4>Таблица «Было → Стало»</h4>` + markdownTableToHtml(transformationTable);
    }

    if (rationale) {
        rationaleContainer.innerHTML = `<h4>Обоснование</h4><p>${rationale}</p>`;
    }

    if (suggestions && suggestions.length > 0) {
        applyImprovementsBtn.style.display = 'block';
    } else {
        applyImprovementsBtn.style.display = 'none';
    }
}

console.log("Process builder script loaded and initialized.");
