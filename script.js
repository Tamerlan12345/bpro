// --- Configuration ---
// WARNING: Storing API keys in client-side code is insecure and should be avoided in production.
// This key is visible to anyone who views the page source.
const API_KEY = 'AIzaSyCisFe9LE9ykOlc7JOn7NEJQDJ3LaMMFqI';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Initialize Mermaid.js
mermaid.initialize({ startOnLoad: true });

let lastSuggestions = []; // To store the latest suggestions for applying them later

// --- DOM Elements ---
const processNameInput = document.getElementById('process-name');
const processDescriptionInput = document.getElementById('process-description');
const buildBtn = document.getElementById('build-btn');
const improveBtn = document.getElementById('improve-btn');
const downloadBtn = document.getElementById('download-btn');
const diagramContainer = document.getElementById('diagram-container');
const suggestionsText = document.getElementById('suggestions-text');
const suggestionsContainer = document.getElementById('suggestions-container');
const applyImprovementsBtn = document.getElementById('apply-improvements-btn');

// --- Event Listeners ---

buildBtn.addEventListener('click', async () => {
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
        const suggestions = JSON.parse(cleanedJson);
        lastSuggestions = suggestions; // Store for later use
        renderSuggestions(suggestions); // This function will be properly implemented in the next step
    } catch (error) {
        setError(suggestionsText, 'Не удалось получить или обработать предложения. Проверьте консоль для деталей.');
        console.error('Error getting or parsing suggestions:', error);
        lastSuggestions = []; // Reset on error
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
    if (!originalProcess.trim() || lastSuggestions.length === 0) {
        alert('Нет исходного процесса или предложений для применения.');
        return;
    }

    setLoading(diagramContainer, 'Применяю улучшения и перестраиваю схему...');

    // Hide the optimized process container until it's ready
    const optimizedContainer = document.getElementById('optimized-process-container');
    if(optimizedContainer) optimizedContainer.style.display = 'none';


    try {
        const optimizedProcess = await getOptimizedProcess(originalProcess, lastSuggestions);

        // This part will be fully implemented in the next step
        const optimizedProcessText = document.getElementById('optimized-process-text');
        if(optimizedProcessText) {
            optimizedProcessText.textContent = optimizedProcess;
            optimizedContainer.style.display = 'block';
        }

        // Update diagram with the new process
        const mermaidCode = await getMermaidCode(optimizedProcess);
        renderDiagram(mermaidCode);

    } catch (error) {
        setError(diagramContainer, 'Не удалось применить улучшения.');
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
    const prompt = `Ты — эксперт по оптимизации бизнес-процессов. Проанализируй следующий процесс. Верни результат в виде чистого JSON-массива, без каких-либо дополнительных текстовых пояснений или markdown-форматирования. Каждый объект в массиве должен содержать поля: "step_number" (номер шага из исходного процесса, к которому относится улучшение, или null, если улучшение общее), "category" (одно из значений: 'Автоматизация', 'Упрощение', 'Устранение дублирования', 'Повышение контроля', 'Снижение рисков'), "suggestion_text" (текстовое описание предложения по улучшению), и "benefit" (краткое описание ожидаемой выгоды).

Описание процесса:
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

function renderSuggestions(suggestions) {
    suggestionsText.innerHTML = ''; // Clear previous content

    if (!suggestions || suggestions.length === 0) {
        suggestionsText.innerHTML = '<p>Предложений по оптимизации не найдено.</p>';
        return;
    }

    const categoryIcons = {
        'Автоматизация': '⚙️',
        'Упрощение': '✨',
        'Устранение дублирования': '🗑️',
        'Повышение контроля': '👁️',
        'Снижение рисков': '🛡️'
    };

    const cardsHtml = suggestions.map(suggestion => {
        const icon = categoryIcons[suggestion.category] || '💡';
        const stepLink = suggestion.step_number ?
            `<div class="suggestion-step">Относится к шагу №${suggestion.step_number}</div>` : '';

        return `
            <div class="suggestion-card">
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
        `;
    }).join('');

    suggestionsText.innerHTML = cardsHtml;

    if (suggestions && suggestions.length > 0) {
        applyImprovementsBtn.style.display = 'block';
    } else {
        applyImprovementsBtn.style.display = 'none';
    }
}

console.log("Process builder script loaded and initialized.");
