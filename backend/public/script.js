
document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';


    let suggestions = [];
    let currentDiagramScale = 1;


    const processDescriptionInput = document.getElementById('process-description');
    const improveBtn = document.getElementById('improve-btn');
    const stepCounter = document.getElementById('step-counter');
    const userPromptInput = document.getElementById('user-prompt');
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


    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        fontFamily: 'inherit',
        flowchart: { nodeSpacing: 50, rankSpacing: 60 },
        themeVariables: {
            primaryColor: '#FFFFFF',
            primaryTextColor: '#212529',
            primaryBorderColor: '#333333',
            lineColor: '#333333',
        }
    });


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


    function updateStepCounter() {
        const text = processDescriptionInput.value;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        stepCounter.textContent = `${lines.length} шагов`;
        improveBtn.disabled = lines.length === 0;
    }

    async function handleImproveRequest() {
        const description = processDescriptionInput.value;
        const userPrompt = userPromptInput.value;
        if (!description.trim()) return;

        setButtonLoading(improveBtn, true, 'Анализирую...');
        suggestionsContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        resultsBlock.innerHTML = `<h2>Результат</h2><p>Идет анализ и дополнение вашего процесса...</p>`;

        try {
            const rawJsonResponse = await getOptimizationSuggestions(description, userPrompt);
            const cleanedJson = rawJsonResponse.replace(/^```json\s*|```$/g, '').trim();
            const analysisResult = JSON.parse(cleanedJson);

            if (analysisResult.full_process_text) {
                processDescriptionInput.value = analysisResult.full_process_text;
                updateStepCounter();
                resultsBlock.innerHTML = `<h2>Результат</h2><p style="color: var(--primary-color);">✓ Процесс был автоматически дополнен ИИ. Теперь выберите улучшения.</p>`;
            }
            suggestions = analysisResult.suggestions || [];
            renderSuggestions(suggestions);
        } catch (error) {
            const errorMsg = 'Не удалось получить предложения. Проверьте API-ключ и откройте консоль разработчика (F12) для просмотра деталей ошибки.';
            resultsBlock.innerHTML = `<h2>Результат</h2><p class="placeholder-text error">${errorMsg}</p>`;
            suggestionsContainer.innerHTML = `<p class="placeholder-text error">${errorMsg}</p>`;
            console.error('ОШИБКА:', error);
        } finally {
            setButtonLoading(improveBtn, false, '✨ Предложить улучшения');
        }
    }

    async function handleApplyImprovements() {
        const selectedIndices = getSelectedSuggestionIndices();
        if (selectedIndices.length === 0) return;

        const selectedSuggestions = selectedIndices.map(index => suggestions[index]);
        setButtonLoading(applyImprovementsBtn, true, 'Применяю...');
        resultsBlock.innerHTML = `<h2>Результат</h2><p>Объединяем процесс с улучшениями...</p>`;

        try {
            const optimizedProcess = await getOptimizedProcess(processDescriptionInput.value, selectedSuggestions);
            processDescriptionInput.value = optimizedProcess;
            updateStepCounter();
            resultsBlock.innerHTML = `<h2>Результат</h2><p style="color: var(--accent-color); font-weight: 600;">✓ Успешно! Процесс в главном окне обновлен.</p>`;
            suggestionsContainer.innerHTML = '<p class="placeholder-text">Готово! Можете сгенерировать новую схему.</p>';
            suggestionsControls.style.display = 'none';
            applyImprovementsBtn.disabled = true;
        } catch (error) {
            resultsBlock.innerHTML = `<h2>Результат</h2><p class="placeholder-text error">Не удалось применить улучшения.</p>`;
            console.error('ОШИБКА:', error);
        } finally {
            setButtonLoading(applyImprovementsBtn, false, 'Применить выбранные улучшения');
        }
    }

    async function handleRenderDiagram() {
        const description = processDescriptionInput.value;
        if (!description.trim()) return;

        placeholderContent.style.display = 'none';
        diagramContainer.style.display = 'flex';
        diagramContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        diagramToolbar.style.display = 'none';

        try {
            const mermaidCode = await getMermaidCode(description);
            await renderDiagram(mermaidCode);
            diagramToolbar.style.display = 'flex';
        } catch (error) {
            diagramContainer.innerHTML = '<p class="placeholder-text error">Не удалось построить схему.</p>';
            console.error('ОШИБКА:', error);
        }
    }


    function handleCardSelection(e) {
        const card = e.target.closest('.suggestion-card');
        if (card) {
            card.classList.toggle('selected');
            updateSelectionState();
        }
    }

    function handleSelectAll() {
        const isChecked = selectAllCheckbox.checked;
        document.querySelectorAll('.suggestion-card').forEach(card => card.classList.toggle('selected', isChecked));
        updateSelectionState();
    }

    function updateSelectionState() {
        const selectedCards = document.querySelectorAll('.suggestion-card.selected');
        const totalCards = document.querySelectorAll('.suggestion-card').length;
        selectionCounter.textContent = `Выбрано: ${selectedCards.length} из ${totalCards}`;
        applyImprovementsBtn.disabled = selectedCards.length === 0;
        if (totalCards > 0) {
            selectAllCheckbox.checked = selectedCards.length === totalCards;
        }
    }

    function setButtonLoading(button, isLoading, loadingText) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.disabled = isLoading;
        if (isLoading) {
            button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        } else {
            button.innerHTML = button.dataset.originalText;
        }
    }

    function renderSuggestions(suggestionsData) {
        if (!suggestionsData || suggestionsData.length === 0) {
            suggestionsContainer.innerHTML = '<p class="placeholder-text">Предложений по оптимизации не найдено.</p>';
            suggestionsControls.style.display = 'none';
            return;
        }
        const categoryIcons = { 'Автоматизация': '⚙️', 'Упрощение': '✨', 'Устранение дублирования': '🗑️', 'Повышение контроля': '👁️', 'Снижение рисков': '🛡️', 'default': '💡' };
        suggestionsContainer.innerHTML = suggestionsData.map((s, index) => `
            <div class="suggestion-card" data-index="${index}">
                <div class="suggestion-header">
                    <span class="suggestion-icon">${categoryIcons[s.category] || categoryIcons['default']}</span>
                    <h4 class="suggestion-category">${s.category}</h4>
                </div>
                <p class="suggestion-text">${s.suggestion_text}</p>
                ${s.benefit ? `<small class="suggestion-benefit"><b>Выгода:</b> ${s.benefit}</small>` : ''}
            </div>`).join('');
        suggestionsControls.style.display = 'flex';
        updateSelectionState();
    }

    function getSelectedSuggestionIndices() {
        return Array.from(document.querySelectorAll('.suggestion-card.selected')).map(card => parseInt(card.dataset.index, 10));
    }

    async function renderDiagram(mermaidCode) {
        const id = `mermaid-graph-${Date.now()}`;
        diagramContainer.innerHTML = `<div id="${id}">${mermaidCode}</div>`;
        await mermaid.run({ nodes: [document.getElementById(id)] });
        const svg = diagramContainer.querySelector('svg');
        if(svg) {
            svg.style.maxWidth = '100%';
            currentDiagramScale = 1;
            zoomDiagram(1);
        }
    }

    function zoomDiagram(factor) {
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;
        currentDiagramScale *= factor;
        svg.style.transform = `scale(${currentDiagramScale})`;
    }

    function downloadDiagramPNG() {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) return;
        html2canvas(svgElement, {backgroundColor: null}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'process-diagram.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function downloadDiagramSVG() {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) return;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'process-diagram.svg';
        link.click();
        URL.revokeObjectURL(url);
    }


    async function callGeminiAPI(prompt) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // The serverless function expects a JSON body with a `prompt` key.
            body: JSON.stringify({ prompt: prompt })
        });
        if (!response.ok) {
            const errorData = await response.json();
            // The user will now see the more specific error message from the backend.
            const errorMessage = errorData.error ? errorData.error.message : 'Unknown API error';
            throw new Error(errorMessage);
        }
        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error('Invalid API response structure from Google');
        }
        return data.candidates[0].content.parts[0].text;
    }

    async function getOptimizationSuggestions(processDescription, userPrompt) {
        const prompt = `Ты — элитный методолог бизнес-процессов. Твоя задача — ДОПОЛНИТЬ и УЛУЧШИТЬ процесс. Если видишь логические пробелы, допиши шаги. Проанализируй уже дополненный тобой процесс и предложи улучшения. ИСХОДНЫЙ ПРОЦЕСС: "${processDescription}". КОНТЕКСТ ОТ ПОЛЬЗОВАТЕЛЯ: "${userPrompt}". Твой ответ ДОЛЖЕН БЫТЬ в формате чистого JSON с ДВУМЯ КЛЮЧАМИ: 1. "full_process_text": Строка, содержащая ПОЛНОСТЬЮ переписанный и дополненный тобой пошаговый текст процесса. 2. "suggestions": Массив объектов с предложениями по улучшению. Каждый объект: "category", "suggestion_text", "benefit".`;
        return callGeminiAPI(prompt);
    }

    async function getOptimizedProcess(originalProcess, suggestionsToApply) {
        const suggestionsText = suggestionsToApply.map(s => `- ${s.suggestion_text}`).join('\n');
        const prompt = `Ты — внимательный редактор. Аккуратно интегрируй улучшения в существующий текст процесса. Результат — ТОЛЬКО обновленный пошаговый список. ИСХОДНЫЙ ТЕКСТ: "${originalProcess}". УЛУЧШЕНИЯ ДЛЯ ВНЕДРЕНИЯ: "${suggestionsText}".`;
        return callGeminiAPI(prompt);
    }

    async function getMermaidCode(processDescription) {
        const prompt = `Преобразуй пошаговое описание процесса в код Mermaid.js (синтаксис flowchart TD). Правильно определи связи между шагами. Ответ должен содержать ТОЛЬКО код Mermaid. ОПИСАНИЕ: "${processDescription}"`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }


    updateStepCounter();
});

