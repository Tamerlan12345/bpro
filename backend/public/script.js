
document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    let suggestions = [];
    let currentDiagramScale = 1;
    let department = null;
    let chatId = null;

    // Login elements
    const loginContainer = document.getElementById('login-container');
    const departmentLogin = document.getElementById('department-login');
    const chatLogin = document.getElementById('chat-login');
    const departmentNameInput = document.getElementById('department-name');
    const departmentPasswordInput = document.getElementById('department-password');
    const departmentLoginBtn = document.getElementById('department-login-btn');
    const departmentError = document.getElementById('department-error');
    const chatSelect = document.getElementById('chat-select');
    const chatPasswordInput = document.getElementById('chat-password');
    const chatLoginBtn = document.getElementById('chat-login-btn');
    const chatError = document.getElementById('chat-error');
    const chatNameHeader = document.getElementById('chat-name-header');

    // Main app elements
    const mainContainer = document.querySelector('.container');
    const adminPanel = document.getElementById('admin-panel');
    const createChatForm = document.getElementById('create-chat-form');
    const newChatNameInput = document.getElementById('new-chat-name');
    const newChatPasswordInput = document.getElementById('new-chat-password');
    const createChatBtn = document.getElementById('create-chat-btn');
    const inReviewList = document.getElementById('in-review-list');
    const completedList = document.getElementById('completed-list');
    const actionButtons = document.getElementById('action-buttons');
    const saveVersionBtn = document.getElementById('save-version-btn');
    const sendReviewBtn = document.getElementById('send-review-btn');
    const completeBtn = document.getElementById('complete-btn');
    const archiveBtn = document.getElementById('archive-btn');
    const processDescriptionInput = document.getElementById('process-description');
    const improveBtn = document.getElementById('improve-btn');
    const versionHistoryContainer = document.getElementById('version-history-container');
    const commentsContainer = document.getElementById('comments-container');
    const commentInput = document.getElementById('comment-input');
    const addCommentBtn = document.getElementById('add-comment-btn');
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

    // Event Listeners
    departmentLoginBtn.addEventListener('click', handleDepartmentLogin);
    chatLoginBtn.addEventListener('click', handleChatLogin);
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
    saveVersionBtn.addEventListener('click', handleSaveVersion);
    sendReviewBtn.addEventListener('click', () => handleUpdateStatus('in_review'));
    completeBtn.addEventListener('click', () => handleUpdateStatus('completed'));
    archiveBtn.addEventListener('click', () => handleUpdateStatus('archived'));
    addCommentBtn.addEventListener('click', handleAddComment);
    inReviewList.addEventListener('click', handleAdminChatSelection);
    completedList.addEventListener('click', handleAdminChatSelection);
    versionHistoryContainer.addEventListener('click', handleVersionSelection);
    createChatBtn.addEventListener('click', handleCreateChat);


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

        let lastError = null;
        for (let i = 0; i < 3; i++) {
            try {
                const mermaidCode = await getMermaidCode(description);
                console.log("Generated Mermaid Code (Attempt " + (i + 1) + "):", mermaidCode);
                await renderDiagram(mermaidCode);
                diagramToolbar.style.display = 'flex';
                return; // Success
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                lastError = error;
            }
        }

        diagramContainer.innerHTML = '<p class="placeholder-text error">Не удалось построить схему после нескольких попыток.</p>';
        console.error('ОШИБКА:', lastError);
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
        const prompt = `Ты — эксперт по визуализации бизнес-процессов с помощью Mermaid.js. Твоя задача — создать семантически корректную и визуально насыщенную схему.
Инструкции:
1.  Используй синтаксис 'flowchart TD'.
2.  Для каждого шага процесса ОБЯЗАТЕЛЬНО включай текст шага внутрь узла. Пример: A["Клиент оставляет заявку"].
3.  Используй разные фигуры в зависимости от семантики шага:
    -   Если шаг описывает принятие решения (например, содержит слова "если", "да/нет", "проверка"), используй фигуру РОМБА: id{Текст}.
    -   Если шаг связан с базой данных, хранилищем или записью информации, используй фигуру ЦИЛИНДРА: id[(Текст)].
    -   Если шаг связан с документом, отчетом или бумажной работой, используй фигуру ДОКУМЕНТА: id>Текст].
    -   Для всех остальных стандартных шагов используй ПРЯМОУГОЛЬНИК: id["Текст"].
4.  Применяй стили к фигурам:
    -   Для ромбов (решения): style id fill:#E6E6FA,stroke:#333,stroke-width:2px
    -   Для цилиндров (БД): style id fill:#D3D3D3,stroke:#333,stroke-width:2px
    -   Для документов: style id fill:#FAFAC8,stroke:#333,stroke-width:2px
5.  Твой ответ должен содержать ТОЛЬКО код Mermaid.js, без каких-либо объяснений или \`\`\`mermaid ... \`\`\` оберток.

ОПИСАНИЕ ПРОЦЕССА:
"${processDescription}"`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }

    // --- Authentication Functions ---

    async function handleDepartmentLogin() {
        const name = departmentNameInput.value;
        const password = departmentPasswordInput.value;
        if (!name || !password) return;

        try {
            const response = await fetch('/api/auth/department', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });

            if (!response.ok) {
                departmentError.textContent = 'Неверные данные для входа';
                return;
            }

            const dept = await response.json();
            department = dept;
            departmentError.textContent = '';
            departmentLogin.style.display = 'none';
            chatLogin.style.display = 'block';
            await loadChats(department.id);
        } catch (error) {
            console.error('Department login error:', error);
            departmentError.textContent = 'Ошибка входа';
        }
    }

    async function loadChats(deptId) {
        try {
            const response = await fetch(`/api/chats?department_id=${deptId}`);
            const chats = await response.json();
            chatSelect.innerHTML = chats.map(chat => `<option value="${chat.id}">${chat.name}</option>`).join('');
        } catch (error) {
            console.error('Error loading chats:', error);
            chatError.textContent = 'Не удалось загрузить чаты';
        }
    }

    async function handleChatLogin() {
        const selectedChatId = chatSelect.value;
        const selectedChatName = chatSelect.options[chatSelect.selectedIndex].text;
        const password = chatPasswordInput.value;
        if (!selectedChatId || !password) return;

        try {
            const response = await fetch('/api/auth/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department_id: department.id, name: selectedChatName, password })
            });

            if (!response.ok) {
                chatError.textContent = 'Неверный пароль чата';
                return;
            }

            const chat = await response.json();
            chatId = chat.id;
            chatError.textContent = '';
            showMainApp(chat.name);
        } catch (error) {
            console.error('Chat login error:', error);
            chatError.textContent = 'Ошибка входа в чат';
        }
    }

    function showMainApp(chatName) {
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        chatNameHeader.textContent = `Чат: ${chatName}`;
        updateStepCounter();
        loadChatData();

        // TODO: This is an insecure way to determine roles and is for demonstration purposes only.
        // In a production environment, the user's role should be securely determined
        // based on the authenticated session and returned from the backend.
        if (department.name === 'admin') {
            adminPanel.style.display = 'block';
            loadAdminPanel();
            completeBtn.style.display = 'inline-block';
            archiveBtn.style.display = 'inline-block';
        }
    }

    async function loadChatData() {
        await loadVersions();
        await loadComments();
    }

    async function loadVersions() {
        const response = await fetch(`/api/chats/${chatId}/versions`);
        const versions = await response.json();
        renderVersions(versions);
    }

    function renderVersions(versions) {
        versionHistoryContainer.innerHTML = versions.map(v => `
            <div class="version-item" data-version-id="${v.id}">
                <span>Версия от ${new Date(v.created_at).toLocaleString()}</span>
                <button>Посмотреть</button>
            </div>
        `).join('');
    }

    async function loadComments() {
        const response = await fetch(`/api/chats/${chatId}/comments`);
        const comments = await response.json();
        renderComments(comments);
    }

    function renderComments(comments) {
        commentsContainer.innerHTML = comments.map(c => `
            <div class="comment ${c.author_role}">
                <span class="comment-author">${c.author_role}</span>
                <p class="comment-text">${c.text}</p>
                <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
            </div>
        `).join('');
    }

    async function handleSaveVersion() {
        const process_text = processDescriptionInput.value;
        const mermaid_code = await getMermaidCode(process_text);
        await fetch(`/api/chats/${chatId}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ process_text, mermaid_code })
        });
        await loadVersions();
    }

    async function handleUpdateStatus(status) {
        await fetch(`/api/chats/${chatId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, user_seen: false, admin_seen: false })
        });
        alert(`Статус чата обновлен на: ${status}`);
    }

    async function handleAddComment() {
        const text = commentInput.value;
        if (!text.trim()) return;
        const author_role = (department.name === 'admin') ? 'admin' : 'user';

        await fetch(`/api/chats/${chatId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author_role, text })
        });
        commentInput.value = '';
        await loadComments();
    }

    async function loadAdminPanel() {
        const inReviewResponse = await fetch('/api/admin/chats/in_review');
        const inReviewChats = await inReviewResponse.json();
        inReviewList.innerHTML = inReviewChats.map(chat => `<li><a href="#" data-chat-id="${chat.chat_id}">${chat.chats.name}</a></li>`).join('');

        const completedResponse = await fetch('/api/admin/chats/completed');
        const completedChats = await completedResponse.json();
        completedList.innerHTML = completedChats.map(chat => `<li><a href="#" data-chat-id="${chat.chat_id}">${chat.chats.name}</a></li>`).join('');
    }

    function openTab(evt, tabName) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-link");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    }

    function handleAdminChatSelection(e) {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            chatId = e.target.dataset.chatId;
            loadChatData();
        }
    }

    async function handleVersionSelection(e) {
        if (e.target.tagName === 'BUTTON') {
            const versionId = e.target.parentElement.dataset.versionId;
            const response = await fetch(`/api/chats/${chatId}/versions`);
            const versions = await response.json();
            const selectedVersion = versions.find(v => v.id == versionId);
            if (selectedVersion) {
                processDescriptionInput.value = selectedVersion.process_text;
                renderDiagram(selectedVersion.mermaid_code);
            }
        }
    }

    async function handleCreateChat() {
        const name = newChatNameInput.value;
        const password = newChatPasswordInput.value;
        if (!name || !password) return;

        await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department_id: department.id, name, password })
        });

        newChatNameInput.value = '';
        newChatPasswordInput.value = '';
        await loadChats(department.id);
    }

    // Initial setup
    // updateStepCounter(); // This will be called after login
});

