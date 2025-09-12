document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    let suggestions = [];
    let currentDiagramScale = 1;
    let department = null;
    let chatId = null;

    // Login elements
    const authWrapper = document.querySelector('.auth-wrapper');
    const loginContainer = document.getElementById('login-container');
    const departmentLogin = document.getElementById('department-login');
    const chatLogin = document.getElementById('chat-login');
    const departmentNameInput = document.getElementById('department-name');
    const departmentPasswordInput = document.getElementById('department-password');
    const departmentLoginBtn = document.getElementById('department-login-btn');
    const departmentError = document.getElementById('department-error');
    const chatSelectionContainer = document.getElementById('chat-selection-container');
    const chatPasswordInput = document.getElementById('chat-password');
    const chatLoginBtn = document.getElementById('chat-login-btn');
    const chatError = document.getElementById('chat-error');
    const chatNameHeader = document.getElementById('chat-name-header');

    // Main app elements
    const mainContainer = document.querySelector('.container');
    const adminPanel = document.getElementById('admin-panel');
    const createDepartmentForm = document.getElementById('create-department-form');
    const newDepartmentNameInput = document.getElementById('new-department-name');
    const newDepartmentPasswordInput = document.getElementById('new-department-password');
    const createDepartmentBtn = document.getElementById('create-department-btn');
    const createChatForm = document.getElementById('create-chat-form');
    const newChatNameInput = document.getElementById('new-chat-name');
    const newChatPasswordInput = document.getElementById('new-chat-password');
    const createChatBtn = document.getElementById('create-chat-btn');
    const departmentList = document.getElementById('department-list');
    const chatList = document.getElementById('chat-list');
    const chatListHeader = document.getElementById('chat-list-header');
    const selectedDepartmentName = document.getElementById('selected-department-name');
    const inReviewList = document.getElementById('in-review-list');
    const pendingList = document.getElementById('pending-list');
    const completedList = document.getElementById('completed-list');
    const inReviewTab = document.getElementById('in-review-tab');
    const pendingTab = document.getElementById('pending-tab');
    const completedTab = document.getElementById('completed-tab');
    const actionButtons = document.getElementById('action-buttons');
    const saveVersionBtn = document.getElementById('save-version-btn');
    const sendReviewBtn = document.getElementById('send-review-btn');
    const sendRevisionBtn = document.getElementById('send-revision-btn');
    const completeBtn = document.getElementById('complete-btn');
    const archiveBtn = document.getElementById('archive-btn');
    const backToAdminBtn = document.getElementById('back-to-admin-btn');
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
    const regenerateDiagramBtn = document.getElementById('regenerate-diagram-btn');
    const diagramContainer = document.getElementById('diagram-container');
    const diagramToolbar = document.getElementById('diagram-toolbar');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadVsdxBtn = document.getElementById('download-vsdx-btn');
    const resultsBlock = document.querySelector('.results-block');

    // Edit Department Modal Elements
    const editDepartmentModal = document.getElementById('edit-department-modal');
    const editDepartmentIdInput = document.getElementById('edit-department-id');
    const editDepartmentNameInput = document.getElementById('edit-department-name');
    const editDepartmentPasswordInput = document.getElementById('edit-department-password');
    const saveDepartmentBtn = document.getElementById('save-department-btn');
    const closeModalBtn = editDepartmentModal.querySelector('.close-btn');


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

    let lastGeneratedDescription = null;

    // Event Listeners
    departmentLoginBtn.addEventListener('click', handleDepartmentLogin);
    chatLoginBtn.addEventListener('click', handleChatLogin);
    processDescriptionInput.addEventListener('input', () => {
        updateStepCounter();
        if (lastGeneratedDescription !== null) {
            const currentDescription = processDescriptionInput.value;
            regenerateDiagramBtn.disabled = currentDescription.trim() === lastGeneratedDescription.trim();
        }
    });
    improveBtn.addEventListener('click', handleImproveRequest);
    applyImprovementsBtn.addEventListener('click', handleApplyImprovements);
    suggestionsContainer.addEventListener('click', handleCardSelection);
    selectAllCheckbox.addEventListener('change', handleSelectAll);
    renderDiagramBtn.addEventListener('click', handleRenderDiagram);
    regenerateDiagramBtn.addEventListener('click', handleRenderDiagram);
    zoomInBtn.addEventListener('click', () => zoomDiagram(1.1));
    zoomOutBtn.addEventListener('click', () => zoomDiagram(0.9));
    downloadPngBtn.addEventListener('click', downloadDiagramPNG);
    downloadSvgBtn.addEventListener('click', downloadDiagramSVG);
    downloadVsdxBtn.addEventListener('click', () => {
        alert('Экспорт в VSDX в данный момент не поддерживается. Рекомендуется использовать экспорт в SVG, так как этот формат можно импортировать в Visio.');
    });
    backToAdminBtn.addEventListener('click', () => {
        mainContainer.style.display = 'none';
        authWrapper.style.display = 'flex'; // Show the wrapper for login/admin
        adminPanel.style.display = 'block';
        backToAdminBtn.style.display = 'none';
    });
    saveVersionBtn.addEventListener('click', handleSaveVersion);
    sendReviewBtn.addEventListener('click', () => handleUpdateStatus('pending_review'));
    sendRevisionBtn.addEventListener('click', () => handleUpdateStatus('needs_revision'));
    completeBtn.addEventListener('click', () => handleUpdateStatus('completed'));
    archiveBtn.addEventListener('click', () => handleUpdateStatus('archived'));
    addCommentBtn.addEventListener('click', handleAddComment);
    inReviewList.addEventListener('click', handleAdminChatSelection);
    pendingList.addEventListener('click', handleAdminChatSelection);
    completedList.addEventListener('click', handleAdminChatSelection);
    versionHistoryContainer.addEventListener('click', handleVersionSelection);
    departmentList.addEventListener('click', handleDepartmentSelection);
    createChatBtn.addEventListener('click', handleCreateChat);
    createDepartmentBtn.addEventListener('click', handleCreateDepartment);
    inReviewTab.addEventListener('click', (event) => openTab(event, 'in-review'));
    pendingTab.addEventListener('click', (event) => openTab(event, 'pending'));
    completedTab.addEventListener('click', (event) => openTab(event, 'completed'));

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

    async function handleRenderDiagram(event) {
        const description = processDescriptionInput.value;
        if (!description.trim()) return;

        const clickedButton = event.currentTarget;
        setButtonLoading(clickedButton, true, 'Генерирую...');

        if (diagramContainer.style.display === 'none' || placeholderContent.style.display !== 'none') {
            placeholderContent.style.display = 'none';
            diagramContainer.style.display = 'flex';
            diagramContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        }

        diagramToolbar.style.display = 'flex';

        let lastError = null;
        for (let i = 0; i < 3; i++) {
            try {
                const mermaidCode = await getMermaidCode(description);
                if (!mermaidCode || mermaidCode.trim() === '') {
                    throw new Error("Generated Mermaid code is empty.");
                }
                console.log("Generated Mermaid Code (Attempt " + (i + 1) + "):", mermaidCode);
                await renderDiagram(mermaidCode);

                lastGeneratedDescription = description.trim();
                setButtonLoading(clickedButton, false, 'Перегенерировать');
                return;
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                lastError = error;
            }
        }

        diagramContainer.innerHTML = `<p class="placeholder-text error">Не удалось построить схему. Ошибка: ${lastError.message}</p>`;
        setButtonLoading(clickedButton, false, clickedButton.id === 'render-diagram-btn' ? 'Создать схему' : 'Перегенерировать');
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
            diagramToolbar.style.display = 'flex';
            renderDiagramBtn.style.display = 'none';
            regenerateDiagramBtn.disabled = true;
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
        console.log("Downloading PNG, SVG element:", svgElement);
        if (!svgElement) {
            alert("Сначала сгенерируйте схему.");
            return;
        }
        html2canvas(svgElement, { backgroundColor: null }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'process-diagram.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function downloadDiagramSVG() {
        const svgElement = diagramContainer.querySelector('svg');
        console.log("Downloading SVG, SVG element:", svgElement);
        if (!svgElement) {
            alert("Сначала сгенерируйте схему.");
            return;
        }
        const svgHeader = '<?xml version="1.0" standalone="no"?>\r\n';
        const svgData = svgHeader + new XMLSerializer().serializeToString(svgElement);
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
        const prompt = `Твоя задача — ПРЕОБРАЗОВАТЬ текстовое описание бизнес-процесса в код Mermaid.js для диаграммы 'flowchart TD'. Ты должен СТРОГО следовать этим правилам:

1.  **СИНТАКСИС И НАПРАВЛЕНИЕ:** Всегда используй 'flowchart TD'.

2.  **АНАЛИЗ СЕМАНТИКИ ШАГА ДЛЯ ВЫБОРА ФИГУРЫ:**
    *   **ПРЯМОУГОЛЬНИК (Стандартное действие):** \`id["Текст"]\`. Используй для большинства шагов, описывающих активное действие (например, "Отправить письмо", "Позвонить клиенту", "Создать отчет").
    *   **РОМБ (Решение или Условие):** \`id{Текст}\`. Используй ТОЛЬКО для шагов, где принимается решение. Ищи ключевые слова: "если", "проверить", "да/нет", "условие", "выбор", "валидация". Пример: \`B{Заявка корректна?}\`.
    *   **ЦИЛИНДР (Данные или Хранилище):** \`id[(Текст)]\`. Используй для шагов, обозначающих хранение, запись или извлечение данных. Ищи ключевые слова: "база данных", "БД", "система", "записать в", "сохранить", "получить из". Пример: \`C[(Сохранить данные в CRM)]\`.
    *   **ДОКУМЕНТ:** \`id>Текст]\`. Используй для шагов, связанных с документами. Ищи ключевые слова: "документ", "отчет", "счет", "форма", "заявка". Пример: \`D>Сформировать счет]\`.

3.  **СТИЛИЗАЦИЯ:** Обязательно применяй стили к фигурам ПОСЛЕ их определения.
    *   \`style id fill:#E6E6FA,stroke:#333,stroke-width:2px\` для РОМБОВ.
    *   \`style id fill:#D3D3D3,stroke:#333,stroke-width:2px\` для ЦИЛИНДРОВ.
    *   \`style id fill:#FAFAC8,stroke:#333,stroke-width:2px\` для ДОКУМЕНТОВ.

4.  **ФОРМАТ ОТВЕТА:**
    *   Твой ответ должен содержать **ТОЛЬКО** код Mermaid.js.
    *   **ЗАПРЕЩЕНО** включать в ответ любые объяснения, комментарии или markdown-обертки типа \`\`\`mermaid.

ИСХОДНЫЙ ПРОЦЕСС:
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

            if (department.name === 'admin') {
                // Admin Flow: Go directly to the admin panel
                loginContainer.style.display = 'none';
                adminPanel.style.display = 'block';
                mainContainer.style.display = 'none'; // Ensure user container is hidden
                loadAdminPanel();
            } else {
                // Regular User Flow: Proceed to chat selection
                departmentLogin.style.display = 'none';
                chatLogin.style.display = 'block';
                await loadChats(department.id);
            }
        } catch (error) {
            console.error('Department login error:', error);
            departmentError.textContent = 'Ошибка входа';
        }
    }

    const statusMap = {
        draft: { text: 'Черновик', color: 'grey' },
        pending_review: { text: 'На проверке', color: 'orange' },
        needs_revision: { text: 'Нужны правки', color: 'red' },
        completed: { text: 'Завершен', color: 'green' },
        archived: { text: 'В архиве', color: 'grey' }
    };

    function getStatusIndicator(status) {
        const statusInfo = statusMap[status] || { text: status, color: 'grey' };
        return `<span class="status-indicator" style="background-color: ${statusInfo.color};"></span> ${statusInfo.text}`;
    }

    async function loadChats(deptId) {
        try {
            const response = await fetch(`/api/chats?department_id=${deptId}`);
            const allChats = await response.json();

            // Filter out completed and archived chats for the department view
            const activeChats = allChats.filter(chat => {
                const status = chat.chat_statuses?.status || 'draft';
                return status !== 'completed' && status !== 'archived';
            });

            if (activeChats.length === 0) {
                chatSelectionContainer.innerHTML = '<p class="placeholder-text">Для этого департамента нет активных чатов.</p>';
                return;
            }

            chatSelectionContainer.innerHTML = activeChats.map(chat => {
                const status = chat.chat_statuses?.status || 'draft';
                return `
                <div class="chat-card" data-chat-id="${chat.id}" data-chat-name="${chat.name}">
                    <span class="chat-icon">💬</span>
                    <span class="chat-name">${chat.name}</span>
                    <div class="chat-status">${getStatusIndicator(status)}</div>
                </div>
            `}).join('');

            document.querySelectorAll('.chat-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
        } catch (error) {
            console.error('Error loading chats:', error);
            chatError.textContent = 'Не удалось загрузить чаты';
        }
    }

    async function handleChatLogin() {
        const selectedChatCard = document.querySelector('.chat-card.selected');
        if (!selectedChatCard) {
            chatError.textContent = 'Пожалуйста, выберите чат';
            return;
        }

        const selectedChatId = selectedChatCard.dataset.chatId;
        const selectedChatName = selectedChatCard.dataset.chatName;
        const password = chatPasswordInput.value;
        if (!password) {
            chatError.textContent = 'Пожалуйста, введите пароль';
            return;
        }

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
        authWrapper.style.display = 'none'; // Hide the whole login/admin section
        mainContainer.style.display = 'block';
        chatNameHeader.textContent = `Чат: ${chatName}`;
        updateStepCounter();
        loadChatData();

        // TODO: This is an insecure way to determine roles and is for demonstration purposes only.
        // In a production environment, the user's role should be securely determined
        // based on the authenticated session and returned from the backend.
        if (department.name === 'admin') {
            // This function is for showing the main app view.
            // The admin-specific buttons are handled in loadChatData now.
            // We should not be showing the admin panel here.
        }
    }

    let chatVersions = []; // Store versions to avoid re-fetching

    async function loadChatData() {
        // Fetch all data in parallel
        const [versionsResponse, commentsResponse, statusResponse] = await Promise.all([
            fetch(`/api/chats/${chatId}/versions`),
            fetch(`/api/chats/${chatId}/comments`),
            fetch(`/api/chats/${chatId}/status`)
        ]);

        // Process responses
        chatVersions = await versionsResponse.json();
        const comments = await commentsResponse.json();
        const { status } = await statusResponse.json();

        // Render data
        renderVersions(chatVersions);
        renderComments(comments);

        // Automatically display the latest version if it exists
        if (chatVersions.length > 0) {
            await displayVersion(chatVersions[0]);
        } else {
            // If no versions, ensure diagram is cleared
            await displayVersion(null);
        }

        // Determine editing permissions
        const userRole = department.name === 'admin' ? 'admin' : 'user';
        const isAdmin = userRole === 'admin';
        let isTextLocked = true;
        if (isAdmin) {
            // Admins can always edit text, but not save if completed/archived
            isTextLocked = (status === 'completed' || status === 'archived');
        } else {
            isTextLocked = !['draft', 'needs_revision'].includes(status);
        }
        setEditingLocked(isTextLocked, isAdmin);

        // Update button states based on status and role
        sendReviewBtn.style.display = (userRole === 'user' && (status === 'draft' || status === 'needs_revision')) ? 'inline-block' : 'none';
        sendRevisionBtn.style.display = (isAdmin && status === 'pending_review') ? 'inline-block' : 'none';
        completeBtn.style.display = (isAdmin && status === 'pending_review') ? 'inline-block' : 'none';
    }

    function renderVersions(versions) {
        versionHistoryContainer.innerHTML = versions.map(v => `
            <div class="version-item" data-version-id="${v.id}">
                <span>Версия от ${new Date(v.created_at).toLocaleString()}</span>
                <button>Посмотреть</button>
            </div>
        `).join('');
    }

    async function displayVersion(version) {
        if (!version) {
            // Reset the view if there is no version to display
            processDescriptionInput.value = '';
            updateStepCounter();
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block'; // Show the initial create button
            lastGeneratedDescription = null;
            return;
        }

        processDescriptionInput.value = version.process_text;
        updateStepCounter();

        if (version.mermaid_code && version.mermaid_code.trim() !== '') {
            placeholderContent.style.display = 'none';
            diagramContainer.style.display = 'flex';
            diagramContainer.innerHTML = '';
            await renderDiagram(version.mermaid_code);
            lastGeneratedDescription = version.process_text.trim();
        } else {
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block'; // Show the initial create button
            lastGeneratedDescription = null;
        }
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
        if (!process_text.trim()) {
            alert("Нельзя сохранить пустую версию.");
            return;
        }
        const mermaid_code = await getMermaidCode(process_text);
        const userRole = department.name === 'admin' ? 'admin' : 'user';
        const response = await fetch(`/api/chats/${chatId}/versions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': userRole
            },
            body: JSON.stringify({ process_text, mermaid_code })
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(`Ошибка сохранения: ${errorData.error}`);
            return;
        }

        await loadChatData();
    }

    async function handleUpdateStatus(status) {
        // Auto-save the current work before changing the status
        await handleSaveVersion();

        const userRole = department.name === 'admin' ? 'admin' : 'user';
        const response = await fetch(`/api/chats/${chatId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': userRole
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(`Ошибка обновления статуса: ${errorData.error}`);
            return;
        }

        alert(`Статус чата обновлен на: ${status}`);
        // The UI is already refreshed by the handleSaveVersion -> loadChatData call
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
        // Load departments
        const response = await fetch('/api/departments');
        const departments = await response.json();
        departmentList.innerHTML = departments.map(dept => `
            <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                <span>${dept.name}</span>
                <button class="edit-dept-btn" data-dept-id="${dept.id}" data-dept-name="${dept.name}">✏️ Редактировать</button>
            </div>
        `).join('');

        const renderChatList = (listElement, chats, listName) => {
            const validChats = chats.filter(chat => {
                if (!chat.chats) {
                    console.warn(`[Admin Panel] Chat with status '${chat.status}' and ID '${chat.chat_id}' will not be displayed in '${listName}' list because it has no associated chat data (orphaned status).`);
                    return false;
                }
                return true;
            });

            if (validChats.length === 0) {
                listElement.innerHTML = '<li>Нет чатов для отображения</li>';
                return;
            }

            listElement.innerHTML = validChats.map(chat => `
                <li>
                    <a href="#" data-chat-id="${chat.chat_id}">
                        <span>${chat.chats.name}</span>
                        <span class="chat-status-admin">${getStatusIndicator(chat.status)}</span>
                    </a>
                </li>
            `).join('');
        };

        // Load and render all chat lists
        try {
            const responses = await Promise.all([
                fetch('/api/admin/chats/in_review'),
                fetch('/api/admin/chats/completed'),
                fetch('/api/admin/chats/pending')
            ]);

            for (const res of responses) {
                if (!res.ok) {
                    const errorBody = await res.text();
                    throw new Error(`Failed to fetch ${res.url}: ${res.status} ${res.statusText}. Body: ${errorBody}`);
                }
            }

            const [inReviewChats, completedChats, pendingChats] = await Promise.all(
                responses.map(res => res.json())
            );

            renderChatList(inReviewList, inReviewChats, 'In Review');
            renderChatList(completedList, completedChats, 'Completed');
            renderChatList(pendingList, pendingChats, 'Pending');

        } catch (error) {
            console.error("Failed to load admin chat lists:", error);
            inReviewList.innerHTML = '<li>Ошибка загрузки</li>';
            completedList.innerHTML = '<li>Ошибка загрузки</li>';
            pendingList.innerHTML = '<li>Ошибка загрузки</li>';
        }
    }

    async function handleDepartmentSelection(e) {
        const editBtn = e.target.closest('.edit-dept-btn');
        if (editBtn) {
            const id = editBtn.dataset.deptId;
            const name = editBtn.dataset.deptName;
            openEditDepartmentModal(id, name);
            return;
        }

        const deptCard = e.target.closest('.department-card');
        if (!deptCard) return;

        document.querySelectorAll('.department-card').forEach(c => c.classList.remove('selected'));
        deptCard.classList.add('selected');

        const deptId = deptCard.dataset.deptId;
        const deptName = deptCard.dataset.deptName;

        chatListHeader.textContent = `Чаты в "${deptName}"`;
        selectedDepartmentName.textContent = deptName;
        createChatForm.style.display = 'block';

        const response = await fetch(`/api/chats?department_id=${deptId}`);
        const chats = await response.json();
        chatList.innerHTML = chats.map(chat => `<div class="chat-item">${chat.name}</div>`).join('');
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
            const chatName = e.target.querySelector('span').textContent;

            // Hide admin panel and show the main chat container
            authWrapper.style.display = 'none';
            mainContainer.style.display = 'block';

            // Set chat name and load its data
            chatNameHeader.textContent = `Чат: ${chatName}`;
            loadChatData();

            // Ensure admin-specific buttons are visible in the chat view
            completeBtn.style.display = 'inline-block';
            archiveBtn.style.display = 'inline-block';
            backToAdminBtn.style.display = 'block';
        }
    }

    async function handleVersionSelection(e) {
        if (e.target.tagName === 'BUTTON') {
            const versionId = e.target.parentElement.dataset.versionId;
            const selectedVersion = chatVersions.find(v => v.id == versionId);
            if (selectedVersion) {
                await displayVersion(selectedVersion);
            }
        }
    }

    async function handleCreateChat() {
        const selectedDeptCard = document.querySelector('.department-card.selected');
        if (!selectedDeptCard) {
            alert('Сначала выберите департамент!');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;

        const name = newChatNameInput.value;
        const password = newChatPasswordInput.value;
        if (!name || !password) return;

        await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department_id: deptId, name, password })
        });

        newChatNameInput.value = '';
        newChatPasswordInput.value = '';

        // Refresh the chat list for the currently selected department
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        selectedDeptCard.dispatchEvent(event);
    }

    async function handleCreateDepartment() {
        const name = newDepartmentNameInput.value;
        const password = newDepartmentPasswordInput.value;
        if (!name || !password) return;

        await fetch('/api/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });

        newDepartmentNameInput.value = '';
        newDepartmentPasswordInput.value = '';
        alert('Департамент создан!');
    }

    function setEditingLocked(isTextLocked, isAdmin) {
        // Text editing controls are locked based on the flag
        processDescriptionInput.disabled = isTextLocked;
        userPromptInput.disabled = isTextLocked;
        improveBtn.disabled = isTextLocked;
        applyImprovementsBtn.disabled = isTextLocked;
        saveVersionBtn.disabled = isTextLocked;
        sendReviewBtn.disabled = isTextLocked;

        const leftColumn = document.querySelector('.left-column');
        if (isTextLocked) {
            leftColumn.style.opacity = '0.6';
        } else {
            leftColumn.style.opacity = '1';
        }

        // For admins, diagram controls should always be interactive.
        // For users, they are locked when text editing is locked.
        if (isAdmin) {
            leftColumn.style.pointerEvents = 'auto';
        } else {
            leftColumn.style.pointerEvents = isTextLocked ? 'none' : 'auto';
        }
    }

    // --- Department Edit Modal Logic ---
    function openEditDepartmentModal(id, name) {
        editDepartmentIdInput.value = id;
        editDepartmentNameInput.value = name;
        editDepartmentPasswordInput.value = ''; // Clear password field
        editDepartmentModal.style.display = 'block';
    }

    function closeEditDepartmentModal() {
        editDepartmentModal.style.display = 'none';
    }

    async function handleSaveDepartment() {
        const id = editDepartmentIdInput.value;
        const name = editDepartmentNameInput.value;
        const password = editDepartmentPasswordInput.value;

        if (!name.trim()) {
            alert('Название департамента не может быть пустым.');
            return;
        }

        const body = { name: name.trim() };
        if (password) {
            body.password = password;
        }

        try {
            const response = await fetch(`/api/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                alert('Департамент успешно обновлен.');
                closeEditDepartmentModal();
                await loadAdminPanel(); // Refresh the department list
            } else {
                const errorData = await response.json();
                alert(`Ошибка обновления: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Failed to save department:', error);
            alert('Произошла ошибка при сохранении департамента.');
        }
    }

    closeModalBtn.addEventListener('click', closeEditDepartmentModal);
    saveDepartmentBtn.addEventListener('click', handleSaveDepartment);


    // Initial setup
    // updateStepCounter(); // This will be called after login
});
