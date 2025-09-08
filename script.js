// --- Configuration ---
// WARNING: Storing API keys in client-side code is insecure and should be avoided in production.
// This key is visible to anyone who views the page source.
const API_KEY = 'AIzaSyCisFe9LE9ykOlc7JOn7NEJQDJ3LaMMFqI';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Initialize Mermaid.js
mermaid.initialize({ startOnLoad: true });

// --- DOM Elements ---
const processNameInput = document.getElementById('process-name');
const processDescriptionInput = document.getElementById('process-description');
const buildBtn = document.getElementById('build-btn');
const improveBtn = document.getElementById('improve-btn');
const downloadBtn = document.getElementById('download-btn');
const diagramContainer = document.getElementById('diagram-container');
const suggestionsText = document.getElementById('suggestions-text');
const suggestionsContainer = document.getElementById('suggestions-container');

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

    try {
        const suggestions = await getOptimizationSuggestions(description);
        suggestionsText.textContent = suggestions;
    } catch (error) {
        setError(suggestionsText, 'Не удалось получить предложения. Проверьте консоль для деталей.');
        console.error('Error getting suggestions:', error);
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
    const prompt = `Проанализируй следующее описание бизнес-процесса и предложи конкретные улучшения для его оптимизации. Сформулируй предложения в виде списка.

Описание процесса:
"${processDescription}"`;
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

console.log("Process builder script loaded and initialized.");
