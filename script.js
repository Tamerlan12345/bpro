document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // WARNING: Storing API keys in client-side code is insecure. This is for demonstration purposes only.
    const API_KEY = 'AIzaSyCisFe9LE9ykOlc7JOn7NEJQDJ3LaMMFqI';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // --- State Management ---
    let lastAnalysisResult = {};
    let suggestions = [];
    let currentDiagramScale = 1;

    // --- DOM Elements ---
    const processDescriptionInput = document.getElementById('process-description');
    const improveBtn = document.getElementById('improve-btn');
    const stepCounter = document.getElementById('step-counter');

    const suggestionsContainer = document.getElementById('suggestions-container');
    const suggestionsControls = document.getElementById('suggestions-controls');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectionCounter = document.getElementById('selection-counter');
    const applyImprovementsBtn = document.getElementById('apply-improvements-btn');

    const diagramPlaceholder = document.getElementById('diagram-placeholder');
    const placeholderContent = document.querySelector('.placeholder-content');
    const renderDiagramBtn = document.getElementById('render-diagram-btn');
    const diagramContainer = document.getElementById('diagram-container');
    const diagramToolbar = document.getElementById('diagram-toolbar');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const resultsBlock = document.querySelector('.results-block');

    // --- Initialization ---
    mermaid.initialize({ startOnLoad: false, theme: 'base', fontFamily: 'inherit' });

    // --- Event Listeners ---
    processDescriptionInput.addEventListener('input', updateStepCounter);

    improveBtn.addEventListener('click', handleImproveRequest);

    applyImprovementsBtn.addEventListener('click', handleApplyImprovements);

    suggestionsContainer.addEventListener('click', handleCardSelection);

    selectAllCheckbox.addEventListener('change', handleSelectAll);

    renderDiagramBtn.addEventListener('click', handleRenderDiagram);

    zoomInBtn.addEventListener('click', () => zoomDiagram(1.1));
    zoomOutBtn.addEventListener('click', () => zoomDiagram(0.9));
    downloadPngBtn.addEventListener('click', downloadDiagramPNG);
    downloadSvgBtn.addEventListener('click', downloadDiagramSVG);

    // --- Core Functions ---

    function updateStepCounter() {
        const text = processDescriptionInput.value;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        stepCounter.textContent = `${lines.length} шагов`;
    }

    async function handleImproveRequest() {
        const description = processDescriptionInput.value;
        if (!description.trim()) {
            alert('Пожалуйста, введите описание процесса.');
            return;
        }

        setButtonLoading(improveBtn, true, 'Анализирую...');
        suggestionsContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        suggestionsControls.style.display = 'none';

        try {
            const suggestionsJSON = await getOptimizationSuggestions(description);
            const cleanedJson = suggestionsJSON.replace(/^```json\s*|```$/g, '');
            lastAnalysisResult = JSON.parse(cleanedJson);
            suggestions = lastAnalysisResult.suggestions || [];
            renderSuggestions(suggestions);
        } catch (error) {
            suggestionsContainer.innerHTML = '<p class="placeholder-text error">Не удалось получить предложения. Попробуйте снова.</p>';
            console.error('Error getting suggestions:', error);
        } finally {
            setButtonLoading(improveBtn, false, '✨ Предложить улучшения');
        }
    }

    function handleCardSelection(e) {
        const card = e.target.closest('.suggestion-card');
        if (!card) return;

        card.classList.toggle('selected');
        updateSelectionState();
    }

    function handleSelectAll() {
        const cards = document.querySelectorAll('.suggestion-card');
        cards.forEach(card => {
            if (selectAllCheckbox.checked) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        updateSelectionState();
    }

    async function handleApplyImprovements() {
        const selectedIndices = getSelectedSuggestionIndices();
        if (selectedIndices.length === 0) {
            alert('Пожалуйста, выберите хотя бы одно улучшение.');
            return;
        }

        const selectedSuggestions = selectedIndices.map(index => suggestions[index]);

        setButtonLoading(applyImprovementsBtn, true, 'Применяю...');

        try {
            const optimizedProcess = await getOptimizedProcess(processDescriptionInput.value, selectedSuggestions);
            resultsBlock.innerHTML = `
                <h2>Результат</h2>
                <p><strong>Обновленный процесс:</strong></p>
                <pre>${optimizedProcess}</pre>
            `;
            // Optionally update the textarea as well
            // processDescriptionInput.value = optimizedProcess;
            // updateStepCounter();
        } catch (error) {
            alert('Не удалось применить улучшения.');
            console.error('Error applying improvements:', error);
        } finally {
            setButtonLoading(applyImprovementsBtn, false, 'Применить выбранные улучшения');
        }
    }

    async function handleRenderDiagram() {
        const description = processDescriptionInput.value;
        if (!description.trim()) {
            alert('Необходимо описание процесса для построения схемы.');
            return;
        }

        placeholderContent.style.display = 'none';
        diagramContainer.style.display = 'flex';
        diagramContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        diagramToolbar.style.display = 'none';

        try {
            const mermaidCode = await getMermaidCode(description);
            renderDiagram(mermaidCode);
            diagramToolbar.style.display = 'flex';
        } catch(error) {
            diagramContainer.innerHTML = '<p class="placeholder-text error">Не удалось построить схему.</p>';
            console.error('Error rendering diagram:', error);
        }
    }


    // --- UI Update Functions ---

    function setButtonLoading(button, isLoading, loadingText) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || loadingText;
        }
    }

    function renderSuggestions(suggestionsData) {
        if (!suggestionsData || suggestionsData.length === 0) {
            suggestionsContainer.innerHTML = '<p class="placeholder-text">Предложений по оптимизации не найдено.</p>';
            return;
        }

        const categoryIcons = {
            'Автоматизация': '⚙️',
            'Упрощение': '✨',
            'Устранение дублирования': '🗑️',
            'Повышение контроля': '👁️',
            'Снижение рисков': '🛡️',
            'default': '💡'
        };

        suggestionsContainer.innerHTML = suggestionsData.map((s, index) => {
            const icon = categoryIcons[s.category] || categoryIcons['default'];
            return `
                <div class="suggestion-card" data-index="${index}">
                    <div class="suggestion-header">
                        <span class="suggestion-icon">${icon}</span>
                        <h4 class="suggestion-category">${s.category}</h4>
                    </div>
                    <p class="suggestion-text">${s.suggestion_text}</p>
                </div>
            `;
        }).join('');

        suggestionsControls.style.display = 'flex';
        updateSelectionState();
    }

    function updateSelectionState() {
        const selectedCards = document.querySelectorAll('.suggestion-card.selected');
        const totalCards = document.querySelectorAll('.suggestion-card').length;

        selectionCounter.textContent = `Выбрано: ${selectedCards.length} из ${totalCards}`;
        applyImprovementsBtn.disabled = selectedCards.length === 0;

        if (totalCards > 0 && selectedCards.length === totalCards) {
            selectAllCheckbox.checked = true;
        } else {
            selectAllCheckbox.checked = false;
        }
    }

    function getSelectedSuggestionIndices() {
        return Array.from(document.querySelectorAll('.suggestion-card.selected'))
            .map(card => parseInt(card.dataset.index, 10));
    }

    async function renderDiagram(mermaidCode) {
        const id = `mermaid-graph-${Date.now()}`;
        diagramContainer.innerHTML = `<div id="${id}">${mermaidCode}</div>`;
        await mermaid.run({ nodes: [document.getElementById(id)] });
        diagramContainer.querySelector('svg').style.maxWidth = '100%';
        currentDiagramScale = 1;
        zoomDiagram(1); // Apply initial scale
    }

    function zoomDiagram(factor) {
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;
        currentDiagramScale *= factor;
        svg.style.transform = `scale(${currentDiagramScale})`;
    }

    function downloadDiagramPNG() {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) {
            alert('Схема для скачивания не найдена.');
            return;
        }
        html2canvas(svgElement).then(canvas => {
            const link = document.createElement('a');
            link.download = 'process-diagram.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function downloadDiagramSVG() {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) {
            alert('Схема для скачивания не найдена.');
            return;
        }
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'process-diagram.svg';
        link.click();
        URL.revokeObjectURL(url);
    }

    // --- API Functions ---
    async function callGeminiAPI(prompt) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async function getMermaidCode(processDescription) {
        const prompt = `Преобразуй следующее текстовое описание бизнес-процесса в код для диаграммы Mermaid.js. Используй синтаксис flowchart (graph TD). Не включай ничего, кроме кода Mermaid, без markdown-обертки. Описание: "${processDescription}"`;
        let mermaidCode = await callGeminiAPI(prompt);
        return mermaidCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    }

    async function getOptimizationSuggestions(processDescription) {
        const prompt = `Ты — методолог бизнес-процессов. Проанализируй процесс и верни JSON-объект (без markdown) с ключом "suggestions": массив объектов, где каждый объект имеет поля "category" ('Автоматизация', 'Упрощение' и т.д.), "suggestion_text" (описание) и "benefit" (выгода). Процесс: "${processDescription}"`;
        return callGeminiAPI(prompt);
    }

    async function getOptimizedProcess(originalProcess, suggestionsToApply) {
        const suggestionsText = suggestionsToApply.map(s => `- ${s.suggestion_text}`).join('\n');
        const prompt = `На основе исходного процесса и этих рекомендаций, создай новую, оптимизированную версию процесса в виде пошагового списка. Не добавляй заголовков, только шаги. Исходный процесс: "${originalProcess}". Рекомендации: "${suggestionsText}"`;
        return callGeminiAPI(prompt);
    }

    // --- Initial UI State ---
    updateStepCounter();
});
