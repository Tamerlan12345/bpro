document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    let csrfToken = null;
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null; // To store the final audio blob
    let rerecordCount = 0; // To count re-record attempts
    let suggestions = [];
    let currentDiagramScale = 1;
    let timerInterval;
    let secondsRecorded = 0;
    let transcriptionTimerInterval;
    let sessionUser = null; // Holds the logged-in user's session data
    let selectedDepartment = null; // Holds the department a user selects to work in
    let chatId = null;
    let chatVersions = []; // Store versions to avoid re-fetching


    const authWrapper = document.querySelector('.auth-wrapper');
    const loginContainer = document.getElementById('login-container');
    const userLogin = document.getElementById('user-login');
    const userEmailInput = document.getElementById('user-email');
    const userPasswordInput = document.getElementById('user-password');
    const userLoginBtn = document.getElementById('user-login-btn');
    const userError = document.getElementById('user-error');
    const departmentSelection = document.getElementById('department-selection');
    const departmentSelectionContainer = document.getElementById('department-selection-container');
    const departmentSelectionError = document.getElementById('department-selection-error');
    const chatLogin = document.getElementById('chat-login');
    const chatSelectionContainer = document.getElementById('chat-selection-container');
    const chatPasswordInput = document.getElementById('chat-password');
    const chatLoginBtn = document.getElementById('chat-login-btn');
    const chatError = document.getElementById('chat-error');
    const logoutBtn = document.getElementById('logout-btn');

    const mainContainer = document.querySelector('.container');
    const chatNameHeader = document.getElementById('chat-name-header');
    const processDescriptionInput = document.getElementById('process-description');
    const improveBtn = document.getElementById('improve-btn');
    const startRecordBtn = document.getElementById('start-record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const listenBtn = document.getElementById('listen-btn');
    const processBtn = document.getElementById('process-btn');
    const rerecordBtn = document.getElementById('rerecord-btn');
    const audioPlayback = document.getElementById('audio-playback');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingTimer = document.getElementById('recording-timer');
    const transcriptionDisplay = document.getElementById('transcription-display');
    const initialProcessBlock = document.getElementById('initial-process-block');
    const initialProcessContent = document.getElementById('initial-process-content');
    const transcriptionTimer = document.getElementById('transcription-timer');
    const partialTranscriptDisplay = document.getElementById('partial-transcript-display');
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
    const resultsBlock = document.querySelector('.results-block');
    const actionButtons = document.getElementById('action-buttons');
    const saveVersionBtn = document.getElementById('save-version-btn');
    const saveRawVersionBtn = document.getElementById('save-raw-version-btn');
    const sendReviewBtn = document.getElementById('send-review-btn');
    const sendRevisionBtn = document.getElementById('send-revision-btn');
    const completeBtn = document.getElementById('complete-btn');
    const archiveBtn = document.getElementById('archive-btn');

    const adminPanel = document.getElementById('admin-panel');
    const backToAdminBtn = document.getElementById('back-to-admin-btn');
    const userForNewDepartmentSelect = document.getElementById('user-for-new-department');
    const newDepartmentNameInput = document.getElementById('new-department-name');
    const newDepartmentPasswordInput = document.getElementById('new-department-password');
    const createDepartmentBtn = document.getElementById('create-department-btn');
    const departmentList = document.getElementById('department-list');
    const chatList = document.getElementById('chat-list');
    const chatListHeader = document.getElementById('chat-list-header');
    const selectedDepartmentNameSpan = document.getElementById('selected-department-name');
    const createChatForm = document.getElementById('create-chat-form');
    const newChatNameInput = document.getElementById('new-chat-name');
    const newChatPasswordInput = document.getElementById('new-chat-password');
    const createChatBtn = document.getElementById('create-chat-btn');
    const inReviewList = document.getElementById('in-review-list');
    const pendingList = document.getElementById('pending-list');
    const completedList = document.getElementById('completed-list');
    const inReviewTab = document.getElementById('in-review-tab');
    const pendingTab = document.getElementById('pending-tab');
    const completedTab = document.getElementById('completed-tab');

    const newUserFullnameInput = document.getElementById('new-user-fullname');
    const newUserEmailInput = document.getElementById('new-user-email');
    const newUserDeptSelect = document.getElementById('new-user-dept');
    const newUserPasswordInput = document.getElementById('new-user-password');
    const newUserRoleSelect = document.getElementById('new-user-role');
    const createUserBtn = document.getElementById('create-user-btn');
    const usersListBody = document.getElementById('users-list-body');

    const transcriptionReviewModal = document.getElementById('transcription-review-modal');
    const transcriptionTextArea = document.getElementById('transcription-text-area');
    const saveTranscriptionProgressBtn = document.getElementById('save-transcription-progress-btn');
    const finalizeTranscriptionBtn = document.getElementById('finalize-transcription-btn');
    const transcriptionModalButtons = document.getElementById('transcription-modal-buttons');
    const transcriptionFinalizedView = document.getElementById('transcription-finalized-view');
    const finalizedTextDisplay = transcriptionReviewModal.querySelector('.finalized-text-display');
    const closeTranscriptionModalBtn = transcriptionReviewModal.querySelector('.close-btn');

    const mermaidEditorModal = document.getElementById('mermaid-editor-modal');
    const editDiagramBtn = document.getElementById('edit-diagram-btn');
    const mermaidEditorTextarea = document.getElementById('mermaid-editor-textarea');
    const mermaidEditorPreview = document.getElementById('mermaid-editor-preview');
    const saveMermaidChangesBtn = document.getElementById('save-mermaid-changes-btn');
    const cancelMermaidEditBtn = document.getElementById('cancel-mermaid-edit-btn');
    const closeMermaidEditorBtn = mermaidEditorModal.querySelector('.close-btn');

    const notificationContainer = document.getElementById('notification-container');

    // Глобальные стили для фикса "съедания" текста в кнопках тулбаров
    const globalStyle = document.createElement('style');
    globalStyle.innerHTML = `
        .cy-toolbar, .admin-section .toolbar, #refresh-map-btn { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .cy-toolbar button, .admin-section button { white-space: nowrap; min-width: max-content; padding: 8px 14px; }
        .cy-toolbar button.spinner { display: inline-flex; align-items: center; gap: 5px; }
        .cy-toolbar { margin-bottom: 10px; }
        #cy {
            background-image: radial-gradient(#cbd5e1 1.5px, transparent 1.5px);
            background-size: 30px 30px;
            background-color: #f8fafc;
        }
        #cy-search-input {
            padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
            outline: none; font-family: inherit; font-size: 14px; width: 220px;
        }
        #cy-search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
    `;
    document.head.appendChild(globalStyle);



    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    async function fetchCsrfToken() {
        try {
            const response = await fetch('/api/csrf-token');
            if (response.ok) {
                const data = await response.json();
                csrfToken = data.csrfToken;
            }
        } catch (error) {
            console.error('Error fetching CSRF token:', error);
        }
    }

    async function fetchWithAuth(url, options = {}) {
        const finalOptions = { ...options, credentials: 'include' };

        if (csrfToken && finalOptions.method && finalOptions.method.toUpperCase() !== 'GET') {
            finalOptions.headers = {
                ...finalOptions.headers,
                'X-CSRF-Token': csrfToken
            };
        }

        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP Error: ${response.status} ${response.statusText}` }));
            throw new Error(errorData.error || 'An unknown network error occurred.');
        }
        return response;
    }

    function setButtonLoading(button, isLoading, loadingText = 'Загрузка...') {
        if (!button) return;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.disabled = isLoading;
        button.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : button.dataset.originalText;
    }


    mermaid.initialize({ startOnLoad: false, theme: 'base', fontFamily: 'inherit', flowchart: { nodeSpacing: 50, rankSpacing: 60, curve: 'stepBefore' }, themeVariables: { primaryColor: '#FFFFFF', primaryTextColor: '#212529', primaryBorderColor: '#333333', lineColor: '#333333' } });

    async function renderDiagram(mermaidCode, container = diagramContainer, isRetry = false) {
        container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            // The mermaid.render function is the modern, preferred way.
            const { svg } = await mermaid.render(`mermaid-graph-${Date.now()}`, mermaidCode);
            container.innerHTML = svg;

            // Post-render logic only for the main diagram container
            if (container === diagramContainer) {
                const svgElement = container.querySelector('svg');
                if (svgElement) {
                    svgElement.style.maxWidth = '100%';
                    currentDiagramScale = 1;
                    zoomDiagram(1);
                    diagramToolbar.style.display = 'flex';
                    renderDiagramBtn.style.display = 'none';
                    regenerateDiagramBtn.disabled = false;
                    if (sessionUser && sessionUser.role === 'admin') {
                        editDiagramBtn.style.display = 'inline-block';
                    }
                }
            }
        } catch (error) {
            console.error("Mermaid render error:", error);
            // If it's the first attempt, try to fix the code
            if (!isRetry) {
                try {
                    const fixedCode = await getFixedMermaidCode(mermaidCode, error.message);
                    showNotification("AI исправило ошибку в схеме. Повторный рендеринг...", "success");
                    await renderDiagram(fixedCode, container, true); // Retry with the fixed code
                } catch (fixError) {
                    console.error("Failed to get fixed mermaid code:", fixError);
                    container.innerHTML = `<div class="error-text">Не удалось исправить и отобразить схему: ${fixError.message}</div>`;
                }
            } else {
                // If it fails even after a retry, show the final error.
                container.innerHTML = `<div class="error-text">Ошибка рендеринга даже после исправления: ${error.message}</div>`;
            }
        }
    }

    let mermaidRenderTimeout;
    function handleMermaidEditorInput() {
        clearTimeout(mermaidRenderTimeout);
        mermaidRenderTimeout = setTimeout(() => {
            const code = mermaidEditorTextarea.value;
            renderDiagram(code, mermaidEditorPreview);
        }, 300); // Debounce for 300ms
    }

    function openMermaidEditor() {
        const latestVersion = chatVersions[0];
        if (!latestVersion || !latestVersion.mermaid_code) {
            showNotification("Нет схемы для редактирования.", "error");
            return;
        }
        mermaidEditorTextarea.value = latestVersion.mermaid_code;
        mermaidEditorModal.style.display = 'block';
        renderDiagram(latestVersion.mermaid_code, mermaidEditorPreview);
    }

    function closeMermaidEditor() {
        mermaidEditorModal.style.display = 'none';
    }

    async function handleSaveMermaidChanges() {
        const mermaid_code = mermaidEditorTextarea.value;
        const process_text = processDescriptionInput.value; // Keep the existing text description

        setButtonLoading(saveMermaidChangesBtn, true, 'Сохранение...');
        try {
            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text, mermaid_code })
            });
            showNotification("Изменения в схеме успешно сохранены.", "success");
            await loadChatData();
            closeMermaidEditor();
        } catch (error) {
            showNotification(`Ошибка сохранения схемы: ${error.message}`, "error");
        } finally {
            setButtonLoading(saveMermaidChangesBtn, false);
        }
    }

    function zoomDiagram(factor) {
        const svg = diagramContainer.querySelector('svg');
        if (svg) {
            currentDiagramScale *= factor;
            svg.style.transform = `scale(${currentDiagramScale})`;
        }
    }

    function downloadDiagram(format) {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) {
            alert("Сначала сгенерируйте схему.");
            return;
        }
        if (format === 'svg') {
            const svgHeader = '<?xml version="1.0" standalone="no"?>\r\n';
            const svgData = svgHeader + new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'process-diagram.svg';
            link.click();
            URL.revokeObjectURL(url);
        } else if (format === 'png') {
            html2canvas(svgElement, { backgroundColor: null }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'process-diagram.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    }


    async function callGeminiAPI(prompt) {
        const response = await fetchWithAuth(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error('Invalid API response structure from Google');
        }
        return data.candidates[0].content.parts[0].text;
    }

    async function generateProcessArtifacts(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик. Твоя задача — взять сырое описание процесса от пользователя и превратить его в два артефакта:
1.  Структурированное описание шагов бизнес-процесса в формате Markdown.
2.  Код для диаграммы flowchart TD на языке Mermaid.js.

Ты должен СТРОГО следовать этим правилам:

### ПРАВИЛА ДЛЯ ТЕКСТОВОГО ОПИСАНИЯ:
Используй следующий шаблон Markdown, додумывая недостающие детали на основе контекста:

\`\`\`markdown
### 4. Начальное событие (Триггер):
[Что запускает процесс]

### 5. Пошаговое описание процесса:
* **Шаг [Номер]. [Название шага]**
    * **Действие:** [Описание действия]
    * **Исполнитель:** [Роль, если можно определить из контекста]
    * **Условия/Переход:** [Описание логики перехода или ветвления]

### 6. Завершающее событие и результаты:
[Чем заканчивается процесс и какие у него исходы]
\`\`\`

**ВАЖНО:** Если во входных данных присутствует секция \`### Предложения по улучшению:\`, ты должен использовать перечисленные в ней пункты как прямое руководство для улучшения и переписывания основного описания процесса. Интегрируй эти улучшения в итоговый \`standardDescription\`. Саму секцию \`### Предложения по улучшению:\` в свой финальный ответ включать НЕ НУЖНО.

### ПРАВИЛА ДЛЯ MERMAID-КОДА:
СИНТАКСИС И СТИЛЬ:
- **Направление:** Всегда используй 'flowchart TD'.
- **Линии:** Все связи должны быть ПРЯМЫМИ. Используй \`-->\` для всех связей. Не используй другие типы стрелок.
- **Экранирование:** Внутри текстовых меток все специальные символы, особенно кавычки, должны быть экранированы с помощью HTML-кодов. Например, для кавычки (") используй #quot;.

ФИГУРЫ:
- ПРЯМОУГОЛЬНИК \`id["Текст"]\`: Для стандартных действий.
- РОМБ \`id{"Текст"}\`: ТОЛЬКО для решений и условий (если, проверить, да/нет).
- ЦИЛИНДР \`id[("Текст")]\`: Для баз данных, CRM, хранилищ.
- ДОКУМЕНТ \`id>Текст]\`: Для отчетов, счетов, заявок.

**КЛЮЧЕВОЕ ПРАВИЛО СТРОК:** Весь текст внутри фигур (внутри \`""\`, \`{}\`, \`()\`, \`>\`) ДОЛЖЕН быть заключен в стандартные двойные кавычки ASCII (\`"\`). Это самое важное правило. Пример: \`A["Это валидный текст"]\`.

**СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ СУЩНОСТЕЙ:**
- Если в тексте упоминаются "КИАС", "БД", "CRM", "база данных" или любая другая "система", используй для них фигуру **ЦИЛИНДР**.

СТИЛИЗАЦИЯ: Обязательно добавляй стили для ромбов, цилиндров и документов в конце кода.


ФОРМАТ ОТВЕТА:
Твой ответ должен быть JSON-объектом и ТОЛЬКО им. Никаких объяснений. Структура должна быть следующей:
{
"standardDescription": "...", // Здесь Markdown-текст
"mermaidCode": "..." // Здесь Mermaid-код
}

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt).then(response => {
            // AI responses can sometimes include markdown wrappers. Find the JSON block.
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Invalid response from AI, no JSON object found. Raw response:", response);
                throw new Error("Не удалось получить корректный JSON-объект от AI.");
            }
            try {
                // Parse the extracted JSON string.
                return JSON.parse(jsonMatch[0]);
            } catch (error) {
                console.error("Failed to parse JSON from AI response. Raw JSON string:", jsonMatch[0], "Error:", error);
                throw new Error("Ошибка парсинга JSON ответа от AI.");
            }
        });
    }

    async function getFixedMermaidCode(brokenCode, errorMessage) {
        const prompt = `Ты — эксперт по Mermaid.js. Тебе дали код с ошибкой. Твоя задача — ИСПРАВИТЬ ЕГО.

НЕИСПРАВНЫЙ КОД:
\`\`\`
${brokenCode}
\`\`\`

СООБЩЕНИЕ ОБ ОШИБКЕ:
"${errorMessage}"

Проанализируй ошибку и верни ИСПРАВЛЕННЫЙ код. Убедись, что:
1.  Синтаксис 'flowchart TD' правильный.
2.  **Критически важно:** Весь текст внутри фигур заключен в стандартные двойные кавычки ASCII (\`"\`). Например, \`A["Текст"]\`.
3.  Все специальные символы внутри текстовых меток (например, другие кавычки) экранированы с помощью HTML-кодов (например, \`#quot;\`).
4.  Связи между элементами определены правильно и являются прямыми (\`A --> B\`).
5.  Если упоминается "КИАС" или "база данных", используется фигура-цилиндр.
6.  Нет лишних символов или опечаток.

Ответ должен содержать ТОЛЬКО ИСПРАВЛЕННЫЙ код Mermaid.js, без объяснений и markdown.`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }

    async function generateDiagramFromText(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик. Твоя задача — взять описание процесса от пользователя и превратить его в код для диаграммы flowchart TD на языке Mermaid.js.

Ты должен СТРОГО следовать этим правилам:

### ПРАВИЛА ДЛЯ MERMAID-КОДА:
СИНТАКСИС И СТИЛЬ:
- **Направление:** Всегда используй 'flowchart TD'.
- **Линии:** Все связи должны быть ПРЯМЫМИ. Используй \`-->\` для всех связей. Не используй другие типы стрелок.
- **Экранирование:** Внутри текстовых меток все специальные символы, особенно кавычки, должны быть экранированы с помощью HTML-кодов. Например, для кавычки (") используй #quot;.

ФИГУРЫ:
- ПРЯМОУГОЛЬНИК \`id["Текст"]\`: Для стандартных действий.
- РОМБ \`id{"Текст"}\`: ТОЛЬКО для решений и условий (если, проверить, да/нет).
- ЦИЛИНДР \`id[("Текст")]\`: Для баз данных, CRM, хранилищ.
- ДОКУМЕНТ \`id>Текст]\`: Для отчетов, счетов, заявок.

**КЛЮЧЕВОЕ ПРАВИЛО СТРОК:** Весь текст внутри фигур (внутри \`""\`, \`{}\`, \`()\`, \`>\`) ДОЛЖЕН быть заключен в стандартные двойные кавычки ASCII (\`"\`). Это самое важное правило. Пример: \`A["Это валидный текст"]\`.

**СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ СУЩНОСТЕЙ:**
- Если в тексте упоминаются "КИАС", "БД", "CRM", "база данных" или любая другая "система", используй для них фигуру **ЦИЛИНДР**.

СТИЛИЗАЦИЯ: Обязательно добавляй стили для ромбов, цилиндров и документов в конце кода.

ФОРМАТ ОТВЕТА:
Твой ответ должен содержать ТОЛЬКО код Mermaid.js, без объяснений и markdown.

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }


    async function handleLogout() {
        try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed, but reloading anyway.', error);
        } finally {
            // Force a full reload to clear all state
            window.location.href = window.location.pathname;
        }
    }

    async function handleUserLogin() {
        const email = userEmailInput.value;
        const password = userPasswordInput.value;
        if (!email || !password) return;

        setButtonLoading(userLoginBtn, true, 'Вход...');
        try {
            const response = await fetchWithAuth('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const user = await response.json();
            sessionUser = user;
            userError.textContent = '';
            logoutBtn.style.display = 'block';

            if (sessionUser.role === 'admin') {
                loginContainer.style.display = 'none';
                adminPanel.style.display = 'block';
                await loadAdminPanel();
            } else {
                if (userLogin) userLogin.style.display = 'none';
                departmentSelection.style.display = 'block';
                await loadDepartmentsForSelection();
            }
        } catch (error) {
            userError.textContent = `Ошибка входа: ${error.message}`;
        } finally {
            setButtonLoading(userLoginBtn, false);
        }
    }

    async function loadDepartmentsForSelection() {
        try {
            const response = await fetchWithAuth('/api/departments');
            const departments = await response.json();
            if (departments.length === 0) {
                departmentSelectionContainer.innerHTML = '<p class="placeholder-text">Для вас не назначено ни одного департамента.</p>';
                return;
            }
            departmentSelectionContainer.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span class="dept-icon">🏢</span>
                    <span class="dept-name">${dept.name}</span>
                </div>
            `).join('');
        } catch (error) {
            departmentSelectionError.textContent = `Не удалось загрузить департаменты: ${error.message}`;
        }
    }

    function handleDepartmentCardSelection(e) {
        const card = e.target.closest('.department-card');
        if (!card) return;
        selectedDepartment = {
            id: card.dataset.deptId,
            name: card.dataset.deptName
        };
        departmentSelection.style.display = 'none';
        chatLogin.style.display = 'block';
        loadChats(selectedDepartment.id);
    }

    async function loadChats(deptId) {
        chatSelectionContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            const response = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
            const allChats = await response.json();
            const activeChats = allChats.filter(chat => {
                const status = chat.status || 'draft';
                return status !== 'completed' && status !== 'archived';
            });

            if (activeChats.length === 0) {
                chatSelectionContainer.innerHTML = '<p class="placeholder-text">Для этого департамента нет активных чатов.</p>';
                return;
            }

            chatSelectionContainer.innerHTML = activeChats.map(chat => `
                <div class="chat-card" data-chat-id="${chat.id}" data-chat-name="${chat.name}">
                    <span class="chat-icon">💬</span>
                    <span class="chat-name">${chat.name}</span>
                    <div class="chat-status">${getStatusIndicator(chat.status || 'draft')}</div>
                </div>
            `).join('');

            document.querySelectorAll('.chat-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
        } catch (error) {
            chatError.textContent = `Не удалось загрузить чаты: ${error.message}`;
        }
    }

    async function handleChatLogin() {
        const selectedChatCard = document.querySelector('.chat-card.selected');
        if (!selectedChatCard) {
            chatError.textContent = 'Пожалуйста, выберите чат';
            return;
        }

        const password = chatPasswordInput.value;
        if (!password) {
            chatError.textContent = 'Пожалуйста, введите пароль';
            return;
        }

        setButtonLoading(chatLoginBtn, true, 'Вход...');
        try {
            const response = await fetchWithAuth('/api/auth/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department_id: selectedDepartment.id,
                    name: selectedChatCard.dataset.chatName,
                    password
                })
            });
            const chat = await response.json();
            chatId = chat.id;
            chatError.textContent = '';
            showMainApp(chat.name);
        } catch (error) {
            chatError.textContent = `Ошибка входа в чат: ${error.message}`;
        } finally {
            setButtonLoading(chatLoginBtn, false);
        }
    }

    function showMainApp(chatName) {
        authWrapper.style.display = 'none';
        mainContainer.style.display = 'block';
        chatNameHeader.textContent = `Чат: ${chatName}`;
        updateStepCounter();
        loadChatData();
    }

    async function checkSession() {
        try {
            const response = await fetchWithAuth('/api/auth/session');
            const data = await response.json();
            if (data.user) {
                sessionUser = data.user;
                logoutBtn.style.display = 'block';
                authWrapper.style.display = 'flex'; // Keep the wrapper visible
                if (sessionUser.role === 'admin') {
                    loginContainer.style.display = 'none';
                    adminPanel.style.display = 'block';
                    await loadAdminPanel();
                } else {
                    loginContainer.style.display = 'block';
                    if (userLogin) userLogin.style.display = 'none';
                    departmentSelection.style.display = 'block';
                    await loadDepartmentsForSelection();
                }
            } else {
                authWrapper.style.display = 'flex';
                mainContainer.style.display = 'none';
                loginContainer.style.display = 'block';
                if (userLogin) userLogin.style.display = 'block';
                departmentSelection.style.display = 'none';
                chatLogin.style.display = 'none';
                adminPanel.style.display = 'none';
            }
        } catch (error) {
            authWrapper.style.display = 'flex';
            mainContainer.style.display = 'none';
            loginContainer.style.display = 'block';
            if (userLogin) userLogin.style.display = 'block';
            departmentSelection.style.display = 'none';
            chatLogin.style.display = 'none';
            adminPanel.style.display = 'none';
        }
    }


    async function loadChatData() {
        try {
            const [versionsResponse, commentsResponse, statusResponse, transcriptionResponse, initialProcessResponse] = await Promise.all([
                fetchWithAuth(`/api/chats/${chatId}/versions`),
                fetchWithAuth(`/api/chats/${chatId}/comments`),
                fetchWithAuth(`/api/chats/${chatId}/status`),
                fetchWithAuth(`/api/chats/${chatId}/transcription`).catch(err => null), // Allow it to fail if no transcription exists
                fetchWithAuth(`/api/chats/${chatId}/initial-process`).catch(err => null) // Fetch initial process
            ]);
            chatVersions = await versionsResponse.json();
            const comments = await commentsResponse.json();
            const { status } = await statusResponse.json();
            const transcriptionData = transcriptionResponse ? await transcriptionResponse.json() : null;
            const initialProcessData = initialProcessResponse ? await initialProcessResponse.json() : null;

            renderVersions(chatVersions);
            renderComments(comments);

            if (initialProcessData) {
                initialProcessBlock.style.display = 'block';
                initialProcessContent.textContent = initialProcessData.content;
            } else {
                initialProcessBlock.style.display = 'none';
            }

            if (transcriptionData && transcriptionData.status === 'finalized') {
                transcriptionDisplay.textContent = transcriptionData.final_text;
            }

            if (chatVersions.length > 0) {
                await displayVersion(chatVersions[0]);
            } else if (transcriptionData && transcriptionData.status === 'finalized') {
                // Otherwise, if no versions exist but a transcript does, use it as the initial value for Field 2
                processDescriptionInput.value = transcriptionData.final_text;
                updateStepCounter();
            } else {
                await displayVersion(null);
            }

            updateInterfaceForStatus(status, sessionUser.role);
        } catch (error) {
            showNotification(`Failed to load chat data: ${error.message}. Your session may have expired.`, 'error');
            setTimeout(() => window.location.reload(), 5000);
        }
    }

    function renderVersions(versions) {
        versionHistoryContainer.innerHTML = versions.map(v => `
            <div class="version-item" data-version-id="${v.id}">
                <span>Версия от ${new Date(v.created_at).toLocaleString()}</span>
                <button>Посмотреть</button>
            </div>`).join('') || '<p>Нет сохраненных версий.</p>';
    }

    async function displayVersion(version) {
        if (!version) {
            processDescriptionInput.value = '';
            updateStepCounter();
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block';
            return;
        }
        processDescriptionInput.value = version.process_text;
        updateStepCounter();
        if (version.mermaid_code && version.mermaid_code.trim() !== '') {
            placeholderContent.style.display = 'none';
            diagramContainer.style.display = 'flex';
            diagramContainer.innerHTML = '';
            await renderDiagram(version.mermaid_code);
        } else {
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block';
        }
    }

    function renderComments(comments) {
        commentsContainer.innerHTML = comments.map(c => `
            <div class="comment ${c.author_role}">
                <span class="comment-author">${c.author_role}</span>
                <p class="comment-text">${c.text}</p>
                <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
            </div>`).join('') || '<p>Нет комментариев.</p>';
    }

    async function handleSaveVersion(button = saveVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Нельзя сохранить пустую версию.", "error");
            return;
        }

        setButtonLoading(button, true, 'Copilot проверяет...');
        try {
            const copilotRes = await fetchWithAuth(`/api/chats/${chatId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text })
            });
            const validateData = await copilotRes.json();

            if (validateData.analysis && validateData.analysis.trim() !== 'Ошибок не найдено' && validateData.analysis.trim().length > 3) {
                const proceed = confirm(`⚠️ Внимание от AI Copilot:\n\n${validateData.analysis}\n\nВы уверены, что хотите продолжить сохранение?`);
                if (!proceed) {
                    setButtonLoading(button, false);
                    return;
                }
            }

            setButtonLoading(button, true, 'Сохранение с ИИ...');
            const result = await generateProcessArtifacts(process_text);
            const { standardDescription, mermaidCode } = result;

            if (!standardDescription || !mermaidCode) {
                throw new Error("Полученный от AI JSON не содержит обязательных полей standardDescription или mermaidCode.");
            }

            processDescriptionInput.value = standardDescription; // Update the text area

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: standardDescription, mermaid_code: mermaidCode })
            });
            showNotification("Версия успешно сохранена.", "success");

            await loadChatData();
        } catch (error) {
            showNotification(`Ошибка сохранения: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleRenderDiagram(button) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Описание процесса пустое.", "error");
            return;
        }
        setButtonLoading(button, true, 'Создание схемы...');
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            if (mermaidCode) {
                placeholderContent.style.display = 'none';
                diagramContainer.style.display = 'flex';
                await renderDiagram(mermaidCode);
            }
        } catch (error) {
            showNotification(`Ошибка создания схемы: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleUpdateStatus(status, button) {
        if (!button) return;
        setButtonLoading(button, true, 'Обновление...');
        try {
            await handleSaveRawVersion();

            await fetchWithAuth(`/api/chats/${chatId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            showNotification(`Статус чата обновлен на: ${status}`, 'success');
            await loadChatData(); // Reload to reflect new status and UI state
        } catch (error) {
            showNotification(`Ошибка обновления статуса: ${error.message}`, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleAddComment() {
        const text = commentInput.value;
        if (!text.trim()) return;
        setButtonLoading(addCommentBtn, true, 'Отправка...');
        try {
            await fetchWithAuth(`/api/chats/${chatId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            commentInput.value = '';
            const response = await fetchWithAuth(`/api/chats/${chatId}/comments`);
            const comments = await response.json();
            renderComments(comments);
        } catch (error) {
            showNotification(`Failed to add comment: ${error.message}`, 'error');
        } finally {
            setButtonLoading(addCommentBtn, false);
        }
    }

    function updateInterfaceForStatus(status, userRole) {
        const isAdmin = userRole === 'admin';
        let isTextLocked = true;

        if (isAdmin) {
            isTextLocked = (status === 'completed' || status === 'archived');
        } else {
            isTextLocked = !['draft', 'needs_revision'].includes(status);
        }

        [processDescriptionInput, userPromptInput, improveBtn, applyImprovementsBtn, saveVersionBtn].forEach(el => el.disabled = isTextLocked);
        document.querySelector('.left-column').style.opacity = isTextLocked ? '0.7' : '1';
        const isCommentingLocked = (status === 'archived');
        commentInput.disabled = isCommentingLocked;
        addCommentBtn.disabled = isCommentingLocked;

        [sendReviewBtn, sendRevisionBtn, completeBtn, archiveBtn].forEach(btn => btn.style.display = 'none');

        if (isAdmin) {
            editDiagramBtn.style.display = diagramToolbar.style.display === 'flex' ? 'inline-block' : 'none';
            if (status === 'pending_review') {
                sendRevisionBtn.style.display = 'inline-block';
                completeBtn.style.display = 'inline-block';
            }
            if (status === 'completed') {
                archiveBtn.style.display = 'inline-block';
            }
        } else {
            editDiagramBtn.style.display = 'none';
            if (status === 'draft' || status === 'needs_revision') {
                sendReviewBtn.style.display = 'inline-block';
            }
        }
    }

    const statusMap = {
        draft: { text: 'Черновик', color: 'var(--secondary-color)' },
        pending_review: { text: 'На проверке', color: 'var(--color-warning)' },
        needs_revision: { text: 'Нужны правки', color: 'var(--color-danger)' },
        completed: { text: 'Завершен', color: 'var(--color-success)' },
        archived: { text: 'В архиве', color: 'var(--secondary-color)' }
    };

    function getStatusIndicator(status) {
        const statusInfo = statusMap[status] || { text: status, color: 'grey' };
        return `<span class="status-indicator" style="background-color: ${statusInfo.color};"></span> ${statusInfo.text}`;
    }

    function openTranscriptionModal() {
        transcriptionReviewModal.style.display = 'block';
    }

    function closeTranscriptionModal() {
        transcriptionReviewModal.style.display = 'none';
    }

    function updateTranscriptionModalUI(data) {
        if (!data) {
            return;
        }

        openTranscriptionModal();
        transcriptionTextArea.value = data.final_text || data.transcribed_text || '';

        if (data.status === 'finalized') {
            transcriptionTextArea.style.display = 'none';
            transcriptionModalButtons.style.display = 'none';
            transcriptionFinalizedView.style.display = 'block';
            finalizedTextDisplay.textContent = data.final_text;
            // Also disable the main text area
            processDescriptionInput.value = data.final_text;
            processDescriptionInput.readOnly = true;
        } else {
            transcriptionTextArea.style.display = 'block';
            transcriptionModalButtons.style.display = 'block';
            transcriptionFinalizedView.style.display = 'none';
        }
    }

    async function handleSaveTranscription(isFinalizing = false) {
        const text = transcriptionTextArea.value;
        const status = isFinalizing ? 'finalized' : 'pending_review';
        const button = isFinalizing ? finalizeTranscriptionBtn : saveTranscriptionProgressBtn;

        setButtonLoading(button, true, 'Сохранение...');
        try {
            const response = await fetchWithAuth(`/api/chats/${chatId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ final_text: text, status: status })
            });
            const data = await response.json();
            showNotification('Транскрибация успешно сохранена!', 'success');
            updateTranscriptionModalUI(data);
            if (isFinalizing) {
                // Check if initial process already exists
                try {
                    const initResp = await fetchWithAuth(`/api/chats/${chatId}/initial-process`);
                    // If it exists, do nothing
                } catch (e) {
                    // If it doesn't exist, save it
                    if (e.message.includes('404')) {
                        await fetchWithAuth(`/api/chats/${chatId}/initial-process`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: text })
                        });
                    }
                }

                transcriptionDisplay.textContent = text;
                processDescriptionInput.value = text;
                updateStepCounter();
                closeTranscriptionModal();
            }
        } catch (error) {
            showNotification(`Ошибка сохранения транскрибации: ${error.message}`, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }


    async function loadAdminPanel() {
        try {
            await Promise.all([
                loadAdminUsers(),
                loadAdminDepartments()
            ]);

            const [inReviewResponse, completedResponse, pendingResponse] = await Promise.all([
                fetchWithAuth('/api/admin/chats/in_review'),
                fetchWithAuth('/api/admin/chats/completed'),
                fetchWithAuth('/api/admin/chats/pending')
            ]);
            const [inReviewChats, completedChats, pendingChats] = await Promise.all([inReviewResponse.json(), completedResponse.json(), pendingResponse.json()]);

            renderAdminChatList(inReviewList, inReviewChats, 'In Review');
            renderAdminChatList(completedList, completedChats, 'Completed');
            renderAdminChatList(pendingList, pendingChats, 'Pending');

            setupAdminTabs();

        } catch (error) {
            console.error("Failed to load admin panel data:", error);
            // Don't overwrite the whole panel if one fetch fails
            showNotification(`Ошибка загрузки данных админ-панели: ${error.message}`, 'error');
        }
    }

    async function loadAdminUsers() {
        try {
            const response = await fetchWithAuth('/api/admin/users');
            const users = await response.json();

            // Populate table
            usersListBody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.full_name || user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role === 'admin' ? 'Админ' : 'Пользователь'}</td>
                    <td>${user.department_name || '-'}</td>
                    <td>
                        <button class="button-small change-password-btn" data-user-id="${user.id}">Пароль</button>
                        <button class="button-small delete-user-btn" data-user-id="${user.id}" ${user.id === sessionUser.id ? 'disabled' : ''}>Удалить</button>
                    </td>
                </tr>
            `).join('');

            // Populate select for new department
            userForNewDepartmentSelect.innerHTML = users
                .filter(u => u.role === 'user')
                .map(u => `<option value="${u.id}">${u.full_name || u.name} (${u.email})</option>`)
                .join('');
        } catch (error) {
            console.error("Failed to load users:", error);
            showNotification("Не удалось загрузить список пользователей", "error");
        }
    }

    async function handleCreateUser() {
        const full_name = newUserFullnameInput.value;
        const email = newUserEmailInput.value;
        const department_id = newUserDeptSelect.value || null;
        const password = newUserPasswordInput.value;
        const role = newUserRoleSelect.value;

        if (!full_name || !email || !password) {
            showNotification("ФИО, Email и Пароль обязательны", "error");
            return;
        }

        setButtonLoading(createUserBtn, true, 'Создание...');
        try {
            await fetchWithAuth('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, email, password, department_id, role })
            });
            showNotification("Пользователь успешно создан", "success");
            // Clear form
            newUserFullnameInput.value = '';
            newUserEmailInput.value = '';
            newUserPasswordInput.value = '';
            // Reload user list and department owner select
            await loadAdminUsers();
        } catch (error) {
            showNotification(`Ошибка: ${error.message}`, "error");
        } finally {
            setButtonLoading(createUserBtn, false);
        }
    }

    async function handleDeleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие необратимо.')) return;

        try {
            await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
            showNotification('Пользователь удален', 'success');
            await loadAdminUsers();
        } catch (error) {
            showNotification(`Ошибка удаления: ${error.message}`, 'error');
        }
    }

    async function handleChangePassword(userId) {
        const newPassword = prompt('Введите новый пароль (минимум 8 символов):');
        if (!newPassword) return;
        if (newPassword.length < 8) {
            showNotification('Пароль слишком короткий', 'error');
            return;
        }

        try {
            await fetchWithAuth(`/api/admin/users/${userId}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            showNotification('Пароль изменен', 'success');
        } catch (error) {
            showNotification(`Ошибка изменения пароля: ${error.message}`, 'error');
        }
    }

    async function loadAdminDepartments() {
        try {
            const deptsResponse = await fetchWithAuth('/api/departments');
            const departments = await deptsResponse.json();
            departmentList.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span>${dept.name}</span>
                    <button class="button-danger delete-department-btn" data-dept-id="${dept.id}" title="Удалить департамент">Удалить</button>
                </div>`).join('');

            // Also update the department select for user creation
            newUserDeptSelect.innerHTML = '<option value="">Без департамента</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');

        } catch (error) {
            departmentList.innerHTML = `<div class="error-text">Не удалось загрузить департаменты: ${error.message}</div>`;
        }
    }

    function renderAdminChatList(listElement, chats, listName) {
        const validChats = chats.filter(chat => chat.chats && chat.departments);
        if (validChats.length === 0) {
            listElement.innerHTML = '<li>Нет чатов для отображения</li>';
            return;
        }
        listElement.innerHTML = validChats.map(chat => `
            <li>
                <a href="#" data-chat-id="${chat.chat_id}" data-chat-name="${chat.chats.name}">
                    <span>${chat.chats.name}</span>
                    <span class="chat-dept-name">(${chat.departments.name})</span>
                    <span class="chat-status-admin">${getStatusIndicator(chat.status)}</span>
                </a>
            </li>`).join('');
    }

    function setupAdminTabs() {
        const tabs = document.querySelectorAll('.admin-tabs .tab-link');
        const tabContents = document.querySelectorAll('.admin-section .tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all tabs and hide all content
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');

                // Activate the clicked tab
                tab.classList.add('active');

                // Show the corresponding content
                if (tab.id === 'in-review-tab') {
                    document.getElementById('in-review').style.display = 'block';
                } else if (tab.id === 'pending-tab') {
                    document.getElementById('pending').style.display = 'block';
                } else if (tab.id === 'completed-tab') {
                    document.getElementById('completed').style.display = 'block';
                }
            });
        });
    }

    async function handleAdminDepartmentSelection(e) {
        if (e.target.classList.contains('delete-department-btn')) {
            handleDeleteDepartment(e);
            return;
        }

        const deptCard = e.target.closest('.department-card');
        if (!deptCard) return;

        document.querySelectorAll('#department-list .department-card').forEach(c => c.classList.remove('selected'));
        deptCard.classList.add('selected');
        const deptId = deptCard.dataset.deptId;
        const deptName = deptCard.dataset.deptName;
        await loadChatListForAdminDepartment(deptId, deptName);
    }

    function handleAdminChatListClick(e) {
        if (e.target.classList.contains('delete-chat-btn')) {
            handleDeleteChat(e);
        }
    }

    async function loadChatListForAdminDepartment(deptId, deptName) {
        chatListHeader.textContent = `Чаты в "${deptName}"`;
        selectedDepartmentNameSpan.textContent = deptName;
        createChatForm.style.display = 'block';
        chatList.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            const response = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
            const chats = await response.json();
            chatList.innerHTML = chats.length > 0 ? chats.map(chat => `
                <div class="chat-item" data-chat-id="${chat.id}">
                    <span>${chat.name}</span>
                    <button class="button-danger delete-chat-btn" data-chat-id="${chat.id}" title="Удалить чат">Удалить</button>
                </div>
            `).join('') : '<div class="placeholder-text">Нет чатов.</div>';
        } catch (error) {
            chatList.innerHTML = `<div class="error-text">Не удалось загрузить чаты: ${error.message}</div>`;
        }
    }

    async function handleCreateDepartment() {
        const name = newDepartmentNameInput.value;
        const password = newDepartmentPasswordInput.value;
        const userId = userForNewDepartmentSelect.value;
        if (!name || !password || !userId) {
            showNotification('Все поля должны быть заполнены!', 'error');
            return;
        }
        setButtonLoading(createDepartmentBtn, true, 'Создание...');
        try {
            await fetchWithAuth('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, user_id: userId })
            });
            newDepartmentNameInput.value = '';
            newDepartmentPasswordInput.value = '';
            showNotification('Департамент создан!', 'success');
            await loadAdminDepartments();
        } catch (error) {
            showNotification(`Не удалось создать департамент: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createDepartmentBtn, false);
        }
    }

    async function handleCreateChat() {
        const selectedDeptCard = document.querySelector('#department-list .department-card.selected');
        if (!selectedDeptCard) {
            showNotification('Сначала выберите департамент!', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const name = newChatNameInput.value;
        const password = newChatPasswordInput.value;
        if (!name || !password) return;
        setButtonLoading(createChatBtn, true, 'Создание...');
        try {
            await fetchWithAuth('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department_id: deptId, name, password })
            });
            newChatNameInput.value = '';
            newChatPasswordInput.value = '';
            showNotification('Чат успешно создан.', 'success');
            await loadChatListForAdminDepartment(deptId, selectedDeptCard.dataset.deptName);
        } catch (error) {
            showNotification(`Не удалось создать чат: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createChatBtn, false);
        }
    }

    async function handleDeleteDepartment(e) {
        const button = e.target;
        const deptId = button.dataset.deptId;
        const deptCard = button.closest('.department-card');
        const deptName = deptCard.querySelector('span').textContent;

        if (confirm(`Вы уверены, что хотите удалить департамент "${deptName}"? Это действие также удалит все связанные с ним чаты.`)) {
            try {
                await fetchWithAuth(`/api/departments/${deptId}`, { method: 'DELETE' });
                showNotification(`Департамент "${deptName}" успешно удален.`, 'success');
                await loadAdminDepartments();
                if (deptCard.classList.contains('selected')) {
                    chatList.innerHTML = '<div class="placeholder-text">Выберите департамент, чтобы увидеть чаты.</div>';
                    chatListHeader.textContent = 'Чаты';
                    createChatForm.style.display = 'none';
                }
            } catch (error) {
                showNotification(`Ошибка удаления департамента: ${error.message}`, 'error');
            }
        }
    }

    async function handleDeleteChat(e) {
        const button = e.target;
        const chatId = button.dataset.chatId;
        const chatItem = button.closest('.chat-item');
        const chatName = chatItem.querySelector('span').textContent;
        const selectedDeptCard = document.querySelector('#department-list .department-card.selected');
        if (!selectedDeptCard) {
            showNotification('Не удалось определить департамент для обновления списка.', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const deptName = selectedDeptCard.dataset.deptName;

        if (confirm(`Вы уверены, что хотите удалить чат "${chatName}"?`)) {
            try {
                await fetchWithAuth(`/api/chats/${chatId}`, { method: 'DELETE' });
                showNotification(`Чат "${chatName}" успешно удален.`, 'success');
                await loadChatListForAdminDepartment(deptId, deptName);
            } catch (error) {
                showNotification(`Ошибка удаления чата: ${error.message}`, 'error');
            }
        }
    }

    async function handleSaveRawVersion(button = saveRawVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Нельзя сохранить пустую версию.", "error");
            return;
        }
        setButtonLoading(button, true, 'Сохранение...');
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: process_text, mermaid_code: mermaidCode })
            });
            showNotification("Версия успешно сохранена (без изменений от ИИ).", "success");
            await loadChatData();
        } catch (error) {
            showNotification(`Ошибка сохранения: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    function handleAdminChatSelection(e) {
        const link = e.target.closest('a');
        if (link) {
            e.preventDefault();
            chatId = link.dataset.chatId;
            authWrapper.style.display = 'none';
            mainContainer.style.display = 'block';
            chatNameHeader.textContent = `Чат: ${link.dataset.chatName}`;
            loadChatData();
            backToAdminBtn.style.display = 'block';
        }
    }

    function resetAudioState() {
        audioBlob = null;
        audioChunks = [];
        rerecordCount = 0;
        processDescriptionInput.readOnly = false;
        transcriptionDisplay.textContent = ''; // Clear the display area

        startRecordBtn.style.display = 'block';
        stopRecordBtn.style.display = 'none';
        listenBtn.style.display = 'none';
        processBtn.style.display = 'none'; // Use processBtn
        rerecordBtn.style.display = 'none';
        audioPlayback.style.display = 'none';
        recordingIndicator.style.display = 'none';
        partialTranscriptDisplay.textContent = '';
    }

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayback.src = audioUrl;

                stopRecordBtn.style.display = 'none';
                listenBtn.style.display = 'inline-block';
                processBtn.style.display = 'inline-block'; // Use processBtn
                rerecordBtn.style.display = 'inline-block';
                audioPlayback.style.display = 'block';

                if (rerecordCount >= 1) {
                    rerecordBtn.disabled = true;
                }
            };

            mediaRecorder.start();
            startRecordBtn.style.display = 'none';
            stopRecordBtn.style.display = 'block';
            recordingIndicator.style.display = 'inline';

            secondsRecorded = 0;
            recordingTimer.textContent = '00:00';
            timerInterval = setInterval(() => {
                secondsRecorded++;
                const minutes = Math.floor(secondsRecorded / 60).toString().padStart(2, '0');
                const seconds = (secondsRecorded % 60).toString().padStart(2, '0');
                recordingTimer.textContent = `${minutes}:${seconds}`;
            }, 1000);

        } catch (err) {
            console.error('Error starting recording:', err);
            showNotification('Не удалось получить доступ к микрофону.', 'error');
            resetAudioState();
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        clearInterval(timerInterval);
        recordingIndicator.style.display = 'none';
    };

    const handleRerecord = () => {
        rerecordCount++;
        audioBlob = null;
        audioChunks = [];

        listenBtn.style.display = 'none';
        processBtn.style.display = 'none';
        rerecordBtn.style.display = 'none';
        audioPlayback.style.display = 'none';
        partialTranscriptDisplay.textContent = '';

        handleStartRecording();
    };

    const handleProcessAudio = async () => {
        if (!audioBlob) {
            showNotification('Нет записанного аудио для обработки.', 'error');
            return;
        }

        setButtonLoading(processBtn, true, 'Обработка...');
        listenBtn.disabled = true;
        rerecordBtn.disabled = true;

        let secondsProcessing = 0;
        transcriptionTimer.textContent = `(0s)`;
        transcriptionTimer.style.display = 'inline';
        transcriptionTimerInterval = setInterval(() => {
            secondsProcessing++;
            transcriptionTimer.textContent = `(${secondsProcessing}s)`;
        }, 1000);

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetchWithAuth('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                showNotification('Транскрибация успешно завершена.', 'success');
                transcriptionDisplay.textContent = data.transcript;
                processDescriptionInput.value = data.transcript;
                updateStepCounter();
                // Keep audio controls available
                processBtn.style.display = 'none'; // Hide process button after use
            } else {
                throw new Error(data.error || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            showNotification(`Ошибка транскрибации: ${error.message}`, 'error');
        } finally {
            // Stop animation timer
            clearInterval(transcriptionTimerInterval);
            transcriptionTimer.style.display = 'none';

            setButtonLoading(processBtn, false, 'Обработать');
            listenBtn.disabled = false;
            // The user should be able to re-record even after a failed attempt
            rerecordBtn.disabled = false;
        }
    };

    async function initiateTranscriptionReview(rawText) {
        try {
            const response = await fetchWithAuth(`/api/chats/${chatId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcribed_text: rawText, final_text: rawText, status: 'pending_review' })
            });
            const data = await response.json();
            updateTranscriptionModalUI(data);
        } catch (error) {
            showNotification(`Не удалось сохранить первоначальную транскрибацию: ${error.message}`, 'error');
        }
    }


    function updateStepCounter() {
        if (!processDescriptionInput) return;
        const lines = processDescriptionInput.value.split('\n').filter(line => line.trim() !== '');
        stepCounter.textContent = `${lines.length} шагов`;
        improveBtn.disabled = lines.length === 0;
    }

    async function getSuggestionsForProcess(processText) {
        const prompt = `Ты — элитный бизнес-аналитик. Проанализируй следующее описание бизнес-процесса и предложи 3-5 конкретных, действенных улучшений. Для каждого улучшения укажи, какую проблему оно решает.

Описание процесса:
"${processText}"

Ответ должен быть в формате JSON-массива, где каждый объект содержит два ключа: "problem" и "suggestion".

Пример:
[
  {
    "problem": "Ручной ввод данных в CRM, что ведет к ошибкам.",
    "suggestion": "Автоматизировать ввод данных в CRM с помощью интеграции по API."
  }
]`;
        const responseText = await callGeminiAPI(prompt);
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error("Invalid response from AI, no JSON array found. Raw response:", responseText);
            throw new Error("Не удалось получить корректный JSON-массив от AI.");
        }
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error("Failed to parse JSON from AI response. Raw JSON string:", jsonMatch[0], "Error:", error);
            throw new Error("Ошибка парсинга JSON ответа от AI.");
        }
    }

    async function handleImproveProcess() {
        const processText = processDescriptionInput.value;
        if (!processText.trim()) {
            showNotification("Описание процесса пустое.", "error");
            return;
        }

        setButtonLoading(improveBtn, true, 'Анализ...');
        suggestionsContainer.innerHTML = ''; // Clear previous suggestions
        suggestionsControls.style.display = 'none';

        try {
            suggestions = await getSuggestionsForProcess(processText);
            renderSuggestions(suggestions);
            if (suggestions.length > 0) {
                suggestionsControls.style.display = 'flex';
            }
        } catch (error) {
            showNotification(`Ошибка при получении улучшений: ${error.message}`, 'error');
        } finally {
            setButtonLoading(improveBtn, false);
        }
    }

    function renderSuggestions(suggestionsData) {
        suggestionsContainer.innerHTML = suggestionsData.map((s, index) => `
            <div class="suggestion-card">
                <input type="checkbox" id="suggestion-${index}" class="suggestion-checkbox" data-index="${index}">
                <label for="suggestion-${index}">
                    <p><strong>Проблема:</strong> ${s.problem}</p>
                    <p><strong>Решение:</strong> ${s.suggestion}</p>
                </label>
            </div>
        `).join('');
        updateSelectionCounter();
    }

    function updateSelectionCounter() {
        const selectedCount = suggestionsContainer.querySelectorAll('.suggestion-checkbox:checked').length;
        selectionCounter.textContent = `Выбрано: ${selectedCount}`;
        applyImprovementsBtn.disabled = selectedCount === 0;
    }

    function handleSelectAllSuggestions() {
        const checkboxes = suggestionsContainer.querySelectorAll('.suggestion-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateSelectionCounter();
    }

    function handleApplyImprovements() {
        const selectedCheckboxes = suggestionsContainer.querySelectorAll('.suggestion-checkbox:checked');
        if (selectedCheckboxes.length === 0) return;

        let improvementsText = "\n\n### Предложения по улучшению:\n";
        selectedCheckboxes.forEach(checkbox => {
            const index = checkbox.dataset.index;
            const suggestion = suggestions[index];
            improvementsText += `* **Проблема:** ${suggestion.problem}\n  * **Решение:** ${suggestion.suggestion}\n`;
        });

        processDescriptionInput.value += improvementsText;
        updateStepCounter();
        suggestionsContainer.innerHTML = '';
        suggestionsControls.style.display = 'none';
        selectAllCheckbox.checked = false;
        showNotification("Улучшения добавлены в описание.", "success");
    }

    function openEditDepartmentModal(id, name) {
        editDepartmentIdInput.value = id;
        editDepartmentNameInput.value = name;
        editDepartmentPasswordInput.value = '';
        editDepartmentModal.style.display = 'block';
    }

    function closeEditDepartmentModal() {
        editDepartmentModal.style.display = 'none';
    }

    async function handleSaveDepartment() {
        const id = editDepartmentIdInput.value;
        const name = editDepartmentNameInput.value;
        const password = editDepartmentPasswordInput.value; // Can be empty

        if (!id || !name) {
            showNotification('Имя департамента не может быть пустым.', 'error');
            return;
        }

        setButtonLoading(saveDepartmentBtn, true, 'Сохранение...');
        try {
            await fetchWithAuth(`/api/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            showNotification('Департамент успешно обновлен.', 'success');
            closeEditDepartmentModal();
            await loadAdminDepartments(); // Refresh the list
        } catch (error) {
            showNotification(`Ошибка обновления: ${error.message}`, 'error');
        } finally {
            setButtonLoading(saveDepartmentBtn, false);
        }
    }

    improveBtn.addEventListener('click', handleImproveProcess);
    selectAllCheckbox.addEventListener('click', handleSelectAllSuggestions);
    applyImprovementsBtn.addEventListener('click', handleApplyImprovements);
    suggestionsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('suggestion-checkbox')) {
            updateSelectionCounter();
        }
    });
    closeTranscriptionModalBtn.addEventListener('click', closeTranscriptionModal);
    saveTranscriptionProgressBtn.addEventListener('click', () => handleSaveTranscription(false));
    finalizeTranscriptionBtn.addEventListener('click', () => handleSaveTranscription(true));
    processDescriptionInput.addEventListener('input', updateStepCounter);
    startRecordBtn.addEventListener('click', handleStartRecording);
    stopRecordBtn.addEventListener('click', handleStopRecording);
    listenBtn.addEventListener('click', () => audioPlayback.play());
    rerecordBtn.addEventListener('click', handleRerecord);
    processBtn.addEventListener('click', handleProcessAudio);
    userLoginBtn.addEventListener('click', handleUserLogin);
    logoutBtn.addEventListener('click', handleLogout);
    departmentSelectionContainer.addEventListener('click', handleDepartmentCardSelection);
    chatLoginBtn.addEventListener('click', handleChatLogin);
    createDepartmentBtn.addEventListener('click', handleCreateDepartment);
    createUserBtn.addEventListener('click', handleCreateUser);
    usersListBody.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        if (!userId) return;
        if (e.target.classList.contains('delete-user-btn')) handleDeleteUser(userId);
        if (e.target.classList.contains('change-password-btn')) handleChangePassword(userId);
    });
    departmentList.addEventListener('click', handleAdminDepartmentSelection);
    chatList.addEventListener('click', handleAdminChatListClick);
    createChatBtn.addEventListener('click', handleCreateChat);
    inReviewList.addEventListener('click', handleAdminChatSelection);
    pendingList.addEventListener('click', handleAdminChatSelection);
    completedList.addEventListener('click', handleAdminChatSelection);
    backToAdminBtn.addEventListener('click', () => { mainContainer.style.display = 'none'; authWrapper.style.display = 'flex'; adminPanel.style.display = 'block'; backToAdminBtn.style.display = 'none'; });
    // ... add other listeners for main app functionality
    saveVersionBtn.addEventListener('click', (e) => handleSaveVersion(e.target));
    saveRawVersionBtn.addEventListener('click', (e) => handleSaveRawVersion(e.target));
    addCommentBtn.addEventListener('click', handleAddComment);
    sendReviewBtn.addEventListener('click', (e) => handleUpdateStatus('pending_review', e.target));
    sendRevisionBtn.addEventListener('click', (e) => handleUpdateStatus('needs_revision', e.target));
    completeBtn.addEventListener('click', (e) => handleUpdateStatus('completed', e.target));
    archiveBtn.addEventListener('click', (e) => handleUpdateStatus('archived', e.target));
    versionHistoryContainer.addEventListener('click', async (e) => { if (e.target.tagName === 'BUTTON') { const versionId = e.target.parentElement.dataset.versionId; const selectedVersion = chatVersions.find(v => v.id == versionId); if (selectedVersion) await displayVersion(selectedVersion); } });
    downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));
    downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));

    renderDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    regenerateDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    zoomInBtn.addEventListener('click', () => zoomDiagram(1.1));
    zoomOutBtn.addEventListener('click', () => zoomDiagram(0.9));

    editDiagramBtn.addEventListener('click', openMermaidEditor);
    closeMermaidEditorBtn.addEventListener('click', closeMermaidEditor);
    cancelMermaidEditBtn.addEventListener('click', closeMermaidEditor);
    saveMermaidChangesBtn.addEventListener('click', handleSaveMermaidChanges);
    mermaidEditorTextarea.addEventListener('input', handleMermaidEditorInput);


    const globalAuditBtn = document.getElementById('global-audit-btn');
    const globalAuditModal = document.getElementById('global-audit-modal');
    const closeGlobalAuditModal = document.getElementById('close-global-audit-modal');
    const runGlobalAuditBtn = document.getElementById('run-global-audit-btn');
    const auditPrompt = document.getElementById('audit-prompt');
    const auditResultArea = document.getElementById('global-audit-result-area');
    const auditResultText = document.getElementById('global-audit-text');

    if (globalAuditBtn) {
        globalAuditBtn.addEventListener('click', () => {
            if (globalAuditModal) globalAuditModal.style.display = 'block';
        });
    }

    if (closeGlobalAuditModal) {
        closeGlobalAuditModal.addEventListener('click', () => {
            globalAuditModal.style.display = 'none';
        });
    }

    if (runGlobalAuditBtn) {
        runGlobalAuditBtn.addEventListener('click', async () => {
            const prompt = auditPrompt.value.trim();
            if (!prompt) return showNotification('Введите запрос для анализа', 'error');

            runGlobalAuditBtn.disabled = true;
            runGlobalAuditBtn.innerHTML = '<span class="spinner"></span> Обработка...';
            auditResultArea.style.display = 'none';

            try {
                const response = await fetch('/api/admin/audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                    body: JSON.stringify({ prompt })
                });

                if (response.ok) {
                    const data = await response.json();
                    auditResultText.innerText = data.result;
                    auditResultArea.style.display = 'block';
                } else {
                    const error = await response.json();
                    showNotification(error.error || 'Ошибка аудита', 'error');
                }
            } catch (err) {
                console.error(err);
                showNotification('Сетевая ошибка при аудите', 'error');
            } finally {
                runGlobalAuditBtn.disabled = false;
                runGlobalAuditBtn.innerHTML = '🚀 Запустить Анализ';
            }
        });
    }

    const refreshMapBtn = document.getElementById('refresh-map-btn');
    const cyZoomIn = document.getElementById('cy-zoom-in');
    const cyZoomOut = document.getElementById('cy-zoom-out');
    const cyFit = document.getElementById('cy-fit');
    let cy; // Cytoscape instance

    async function loadProcessMap() {
        if (!document.getElementById('cy')) return;
        try {
            const res = await fetchWithAuth('/api/admin/map');
            const data = await res.json();

            if (!data || data.error) {
                console.error('Map loading error or unauthorized:', data?.error);
                return;
            }

            const departments = data.departments || [];
            const processes = data.processes || [];
            const relations = data.relations || [];
            const active_chats = data.active_chats || [];

            const elements = [];

            // КОРНЕВОЙ УЗЕЛ
            elements.push({
                data: { id: 'root_centras', name: '👑 Процессы компании Сентрас', type: 'root' },
                classes: 'root-node'
            });

            departments.forEach(dept => {
                elements.push({
                    data: { id: `dept_${dept.id}`, name: '🏢 ' + dept.name, type: 'department', collapsed: false, rawName: dept.name },
                    position: (dept.x !== null && dept.y !== null) ? { x: parseFloat(dept.x), y: parseFloat(dept.y) } : undefined,
                    classes: 'department'
                });
                // Связь от корня к департаменту
                elements.push({
                    data: { id: `edge_root_dept_${dept.id}`, source: 'root_centras', target: `dept_${dept.id}` },
                    classes: 'root-edge'
                });
            });

            processes.forEach(proc => {
                elements.push({
                    data: {
                        id: `proc_${proc.id}`,
                        name: '⚙️ ' + proc.name,
                        rawName: proc.name,
                        description: proc.description || 'Описание отсутствует',
                        goal: proc.goal || 'Цель не указана',
                        owner: proc.owner || 'Не назначен',
                        status: proc.status,
                        type: 'process'
                    },
                    position: (proc.x !== null && proc.y !== null) ? { x: parseFloat(proc.x), y: parseFloat(proc.y) } : undefined,
                    classes: `process status-${proc.status}`
                });

                if (proc.department_id) {
                    elements.push({
                        data: {
                            id: `edge_dept_proc_${proc.id}`,
                            source: `dept_${proc.department_id}`,
                            target: `proc_${proc.id}`,
                            label: 'Процесс'
                        },
                        classes: 'dept-edge'
                    });
                }
            });

            active_chats.forEach(chat => {
                elements.push({
                    data: {
                        id: `chat_${chat.id}`,
                        name: '💬 ' + chat.name,
                        rawName: chat.name,
                        status: chat.status,
                        type: 'chat'
                    },
                    position: (chat.x !== null && chat.y !== null) ? { x: parseFloat(chat.x), y: parseFloat(chat.y) } : undefined,
                    classes: `chat status-${chat.status}`
                });

                if (chat.department_id) {
                    elements.push({
                        data: {
                            id: `edge_dept_chat_${chat.id}`,
                            source: `dept_${chat.department_id}`,
                            target: `chat_${chat.id}`,
                            label: 'Чат'
                        },
                        classes: 'dept-edge chat-edge'
                    });
                }
            });

            relations.forEach(rel => {
                elements.push({
                    data: {
                        id: `rel_${rel.id}`,
                        source: `proc_${rel.source_process_id}`,
                        target: `proc_${rel.target_process_id}`,
                        label: rel.relation_type || ''
                    }
                });
            });

            if (!cy) {
                // Initialize cytoscape
                cy = cytoscape({
                    container: document.getElementById('cy'),
                    elements: elements,
                    style: [
                        {
                            selector: 'node',
                            style: {
                                'text-wrap': 'wrap',
                                'text-valign': 'center',
                                'text-halign': 'center',
                                'width': 'label',
                                'height': 'label',
                                'font-family': 'system-ui, -apple-system, sans-serif'
                            }
                        },
                        {
                            selector: 'node.root-node',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#1e293b',
                                'color': '#ffffff',
                                'font-weight': 'bold',
                                'font-size': 20,
                                'padding': '25px',
                                'text-max-width': 280,
                                'border-width': 2,
                                'border-color': '#0f172a'
                            }
                        },
                        {
                            selector: 'node.department',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#2563eb',
                                'color': '#ffffff',
                                'font-weight': '600',
                                'font-size': 15,
                                'padding': '20px',
                                'text-max-width': 200,
                                'border-width': 3,
                                'border-color': '#1d4ed8',
                                'transition-property': 'opacity',
                                'transition-duration': '0.3s'
                            }
                        },
                        {
                            selector: 'node.process',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#ffffff',
                                'border-width': 2,
                                'border-color': '#3b82f6',
                                'color': '#1e293b',
                                'text-max-width': 160,
                                'font-size': 13,
                                'font-weight': '500',
                                'padding': '15px',
                                'background-opacity': 1
                            }
                        },
                        {
                            selector: 'node.chat',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#f0f9ff',
                                'border-width': 2,
                                'border-style': 'dashed',
                                'border-color': '#0ea5e9',
                                'color': '#0369a1',
                                'text-max-width': 140,
                                'font-size': 12,
                                'padding': '12px'
                            }
                        },
                        { selector: 'node.status-approved', style: { 'border-width': 3, 'border-color': '#10b981', 'background-color': '#ecfdf5' } },
                        { selector: 'node.status-draft', style: { 'border-width': 3, 'border-style': 'solid', 'border-color': '#f59e0b', 'background-color': '#fffbeb' } },
                        { selector: 'node.status-needs_revision', style: { 'border-width': 3, 'border-color': '#ef4444', 'background-color': '#fef2f2' } },
                        { selector: 'node.status-pending_review', style: { 'border-width': 3, 'border-color': '#8b5cf6', 'background-color': '#f5f3ff' } },
                        {
                            selector: 'edge',
                            style: {
                                'label': 'data(label)',
                                'curve-style': 'bezier',
                                'target-arrow-shape': 'triangle',
                                'target-arrow-color': '#94a3b8',
                                'line-color': '#cbd5e1',
                                'width': 2,
                                'font-size': 10,
                                'color': '#94a3b8',
                                'text-background-opacity': 1,
                                'text-background-color': '#fff',
                                'text-background-padding': 2,
                                'arrow-scale': 1.2
                            }
                        },
                        {
                            selector: 'edge.root-edge',
                            style: {
                                'line-color': '#94a3b8',
                                'width': 3,
                                'curve-style': 'taxi',
                                'taxi-direction': 'vertical',
                                'target-arrow-shape': 'none'
                            }
                        },
                        {
                            selector: 'edge.dept-edge',
                            style: {
                                'line-color': '#94a3b8',
                                'target-arrow-color': '#94a3b8',
                                'width': 2,
                                'curve-style': 'taxi',
                                'taxi-direction': 'vertical',
                                'line-style': 'solid',
                                'font-size': 10,
                                'color': '#94a3b8'
                            }
                        },
                        {
                            selector: 'edge.chat-edge',
                            style: {
                                'line-color': '#7dd3fc',
                                'target-arrow-color': '#7dd3fc',
                                'line-style': 'dashed'
                            }
                        }
                    ],
                    layout: {
                        name: elements.some(e => e.position) ? 'preset' : 'dagre',
                        rankDir: 'TB',
                        spacingFactor: 1.2,
                        nodeSep: 80,
                        rankSep: 100,
                        padding: 50,
                        fit: true
                    }
                });

                // --- ДОБАВЛЕНИЕ ЛЕГЕНДЫ И КНОПКИ СКРЫТИЯ ЧАТОВ ---
                if (!document.getElementById('cy-legend')) {
                    const legend = document.createElement('div');
                    legend.id = 'cy-legend';
                    legend.style.cssText = `position: absolute; bottom: 20px; right: 20px; background-color: rgba(255, 255, 255, 0.95); padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); z-index: 10; font-size: 13px; font-family: inherit; pointer-events: none; border: 1px solid #e2e8f0;`;
                    legend.innerHTML = `
                        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b;">Легенда статусов</h4>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #ecfdf5; border: 2px solid #10b981; margin-right: 10px; border-radius: 4px;"></span> Утвержден</div>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #fffbeb; border: 2px solid #f59e0b; margin-right: 10px; border-radius: 4px;"></span> Черновик</div>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #f5f3ff; border: 2px solid #8b5cf6; margin-right: 10px; border-radius: 4px;"></span> На проверке</div>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #fef2f2; border: 2px solid #ef4444; margin-right: 10px; border-radius: 4px;"></span> Нужны правки</div>
                        <div style="display: flex; align-items: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;"><span style="display:inline-block; width: 16px; height: 16px; background-color: #f0f9ff; border: 2px dashed #0ea5e9; margin-right: 10px; border-radius: 4px;"></span> Чат</div>
                        <div style="margin-top: 10px; color: #64748b; font-style: italic; font-size: 11px;">* Клик по департаменту скрывает его связи</div>
                    `;
                    document.getElementById('cy').appendChild(legend);
                }

                let toggleChatsMapBtn = document.getElementById('cy-toggle-chats');
                if (!toggleChatsMapBtn) {
                    const tb = document.getElementById('diagram-toolbar') || document.querySelector('.cy-toolbar') || document.getElementById('refresh-map-btn')?.parentElement;
                    if (tb) {
                        toggleChatsMapBtn = document.createElement('button');
                        toggleChatsMapBtn.id = 'cy-toggle-chats';
                        toggleChatsMapBtn.className = 'button-secondary';
                        toggleChatsMapBtn.style.marginLeft = '10px';
                        toggleChatsMapBtn.innerText = 'Скрыть чаты';
                        tb.appendChild(toggleChatsMapBtn);

                        let chatsVisible = true;
                        toggleChatsMapBtn.onclick = () => {
                            chatsVisible = !chatsVisible;
                            toggleChatsMapBtn.innerText = chatsVisible ? 'Скрыть чаты' : 'Показать чаты';
                            if (cy) {
                                cy.elements('.chat').style('display', chatsVisible ? 'element' : 'none');
                                cy.elements('.chat-edge').style('display', chatsVisible ? 'element' : 'none');
                            }
                        };
                    }
                }

                let searchInput = document.getElementById('cy-search-input');
                if (!searchInput) {
                    const tb = document.getElementById('diagram-toolbar') || document.querySelector('.cy-toolbar') || document.getElementById('refresh-map-btn')?.parentElement;
                    if (tb) {
                        searchInput = document.createElement('input');
                        searchInput.id = 'cy-search-input';
                        searchInput.type = 'text';
                        searchInput.placeholder = '🔍 Поиск процессов...';
                        searchInput.style.marginLeft = '10px';
                        tb.appendChild(searchInput);

                        searchInput.addEventListener('input', (e) => {
                            const val = e.target.value.toLowerCase();
                            if (!val) {
                                cy.nodes().style('opacity', 1);
                                cy.edges().style('opacity', 1);
                                return;
                            }
                            cy.nodes().forEach(n => {
                                const name = n.data('rawName') || n.data('name') || '';
                                if (name.toLowerCase().includes(val) || n.id() === 'root_centras') {
                                    n.style('opacity', 1);
                                } else {
                                    n.style('opacity', 0.15);
                                }
                            });
                            cy.edges().style('opacity', 0.15); // Затухание связей при поиске
                        });
                    }
                }

                let exportPngBtn = document.getElementById('cy-export-png');
                if (!exportPngBtn) {
                    const tb = document.getElementById('diagram-toolbar') || document.querySelector('.cy-toolbar') || document.getElementById('refresh-map-btn')?.parentElement;
                    if (tb) {
                        exportPngBtn = document.createElement('button');
                        exportPngBtn.id = 'cy-export-png';
                        exportPngBtn.className = 'button-secondary';
                        exportPngBtn.style.marginLeft = '10px';
                        exportPngBtn.innerHTML = '🖼️ Экспорт PNG';
                        tb.appendChild(exportPngBtn);

                        exportPngBtn.onclick = () => {
                            const png64 = cy.png({ bg: '#f8fafc', full: true, scale: 2 });
                            const a = document.createElement('a');
                            a.href = png64;
                            a.download = 'Карта_Процессов.png';
                            a.click();
                        };
                    }
                }

                let shareBoardBtn = document.getElementById('cy-share-board');
                if (!shareBoardBtn) {
                    const tb = document.getElementById('diagram-toolbar') || document.querySelector('.cy-toolbar') || document.getElementById('refresh-map-btn')?.parentElement;
                    if (tb) {
                        shareBoardBtn = document.createElement('button');
                        shareBoardBtn.id = 'cy-share-board';
                        shareBoardBtn.className = 'button-primary';
                        shareBoardBtn.style.marginLeft = '10px';
                        shareBoardBtn.innerHTML = '🔗 Поделиться дашбордом';
                        tb.appendChild(shareBoardBtn);

                        shareBoardBtn.onclick = () => {
                            const shareUrl = window.location.origin + '/dash';
                            navigator.clipboard.writeText(shareUrl).then(() => showNotification('Ссылка на дашборд скопирована!', 'success'));
                            window.open(shareUrl, '_blank');
                        };
                    }
                }

                // Сворачивание / Разворачивание по клику на департамент
                cy.on('tap', 'node.department', function (evt) {
                    const deptNode = evt.target;
                    const isCollapsed = deptNode.data('collapsed');
                    const outEdges = deptNode.outgoers('edge.dept-edge');
                    const childNodes = outEdges.targets();

                    if (isCollapsed) {
                        childNodes.style('display', 'element');
                        outEdges.style('display', 'element');
                        deptNode.data('collapsed', false);
                        deptNode.style('opacity', 1);
                    } else {
                        childNodes.style('display', 'none');
                        outEdges.style('display', 'none');
                        deptNode.data('collapsed', true);
                        deptNode.style('opacity', 0.6);
                    }
                });

                // Initialize edgehandles
                const eh = cy.edgehandles({
                    snap: true,
                    handleNodes: 'node.process',
                    handlePosition: function (node) { return 'right middle'; }, // sets position of handle
                    complete: async function (sourceNode, targetNode, addedEles) {
                        // when edge is completed, add relation via API
                        try {
                            const res = await fetchWithAuth('/api/admin/relations', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    source_process_id: sourceNode.id().replace('proc_', ''),
                                    target_process_id: targetNode.id().replace('proc_', ''),
                                    relation_type: 'Manual Link',
                                    is_manual: true
                                })
                            });
                            if (res.ok) {
                                showNotification('Связь создана', 'success');
                            } else {
                                addedEles.remove();
                                showNotification('Ошибка создания связи', 'error');
                            }
                        } catch (err) {
                            addedEles.remove();
                            showNotification('Ошибка: ' + err.message, 'error');
                        }
                    }
                });

                document.getElementById('cy-add-edge').onclick = function () {
                    const btn = this;
                    if (btn.classList.contains('active')) {
                        eh.disableDrawMode();
                        btn.classList.remove('active');
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                    } else {
                        eh.enableDrawMode();
                        btn.classList.add('active');
                        btn.style.backgroundColor = '#3b82f6';
                        btn.style.color = 'white';
                    }
                };

                document.getElementById('cy-add-node').onclick = async function () {
                    const depts = cy.nodes('.department');
                    if (depts.length === 0) {
                        showNotification('Сначала создайте департамент (Через админ-панель или по пустому месту)', 'error');
                        return;
                    }
                    const deptId = depts[0].id().replace('dept_', ''); // Default to first dept
                    const name = prompt('Введите название нового процесса:');
                    if (name) {
                        try {
                            await fetchWithAuth('/api/admin/processes', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, department_id: deptId, status: 'draft' })
                            });
                            showNotification('Черновик процесса успешно создан', 'success');
                            loadProcessMap();
                        } catch (e) {
                            showNotification('Ошибка создания процесса', 'error');
                        }
                    }
                };

                const aiLayoutBtn = document.getElementById('cy-ai-layout');
                if (aiLayoutBtn) {
                    aiLayoutBtn.onclick = async function () {
                        const btn = this;
                        const originalText = btn.innerText;
                        btn.innerText = '🪄 ИИ Думает...';
                        btn.disabled = true;

                        try {
                            const res = await fetchWithAuth('/api/admin/map/ai-layout', { method: 'POST' });
                            const data = await res.json();
                            if (data.layout && Array.isArray(data.layout)) {
                                cy.batch(() => {
                                    data.layout.forEach(item => {
                                        let eleType = item.type === 'process' ? 'proc_' : 'dept_';
                                        let ele = cy.getElementById(eleType + item.id);
                                        if (ele.length > 0) {
                                            ele.animate({ position: { x: item.x, y: item.y } }, { duration: 1000 });
                                        }
                                    });
                                });
                                showNotification('ИИ макет применен', 'success');
                                setTimeout(() => {
                                    data.layout.forEach(item => {
                                        let eleType = item.type === 'process' ? 'proc_' : 'dept_';
                                        let ele = cy.getElementById(eleType + item.id);
                                        if (ele.length > 0) {
                                            ele.emit('dragfree'); // trigger save
                                        }
                                    });
                                }, 1100);
                            } else {
                                showNotification('Ошибка данных макета', 'error');
                            }
                        } catch (e) {
                            showNotification('Ошибка: ' + e.message, 'error');
                        } finally {
                            btn.innerText = originalText;
                            btn.disabled = false;
                        }
                    };
                }

                const autoLayoutBtn = document.getElementById('auto-layout-btn');
                if (autoLayoutBtn) {
                    autoLayoutBtn.onclick = () => {
                        if (confirm('Выровнять все департаменты по горизонтали, а их процессы СТРОГО вертикально вниз? (Текущие координаты будут перезаписаны)')) {
                            // КАСТОМНЫЙ АЛГОРИТМ ИДЕАЛЬНОЙ ИЕРАРХИИ
                            const depts = cy.nodes('.department');
                            const root = cy.getElementById('root_centras');

                            const spacingX = 450; // Отступ между колонками департаментов
                            const startY = 150;   // Y координата департаментов
                            const spacingY = 120; // Шаг по вертикали для процессов

                            let currentX = -((depts.length - 1) * spacingX) / 2; // Центрируем весь блок по X=0

                            if (root.length) root.position({ x: 0, y: -100 });

                            cy.batch(() => {
                                depts.forEach(dept => {
                                    dept.position({ x: currentX, y: startY });

                                    const children = dept.outgoers('node.process, node.chat');
                                    let currentY = startY + spacingY;

                                    // Сначала Процессы, затем Чаты
                                    children.filter('.process').forEach(child => {
                                        child.position({ x: currentX, y: currentY });
                                        currentY += spacingY;
                                    });

                                    children.filter('.chat').forEach(child => {
                                        child.position({ x: currentX, y: currentY });
                                        currentY += spacingY;
                                    });

                                    currentX += spacingX;
                                });

                                // Обработка процессов без департаментов (сироты)
                                const floating = cy.nodes('.process, .chat').filter(n => n.incomers('.department').length === 0);
                                let floatY = startY;
                                floating.forEach(node => {
                                    node.position({ x: currentX, y: floatY });
                                    floatY += spacingY;
                                });
                            });

                            cy.fit(cy.nodes(), 50);

                            // Сохраняем новые координаты в БД
                            cy.nodes('.department, .process, .chat').forEach(node => {
                                const pos = node.position();
                                let ep = '';
                                if (node.hasClass('department')) ep = `/api/admin/departments/${node.id().replace('dept_', '')}/position`;
                                else if (node.hasClass('process')) ep = `/api/admin/processes/${node.id().replace('proc_', '')}/position`;
                                else if (node.hasClass('chat')) ep = `/api/admin/chats/${node.id().replace('chat_', '')}/position`;

                                if (ep) fetchWithAuth(ep, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: pos.x, y: pos.y }) }).catch(e => e);
                            });

                            showNotification('Авто-выравнивание завершено', 'success');
                        }
                    };
                }

                // Save node and department positions after drag
                cy.on('dragfree', 'node.process, node.department, node.chat', async function (evt) {
                    const node = evt.target;
                    const pos = node.position();

                    try {
                        if (node.hasClass('process')) {
                            const processId = node.id().replace('proc_', '');
                            await fetchWithAuth(`/api/admin/processes/${processId}/position`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ x: pos.x, y: pos.y })
                            });
                        } else if (node.hasClass('department')) {
                            const deptId = node.id().replace('dept_', '');
                            await fetchWithAuth(`/api/admin/departments/${deptId}/position`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ x: pos.x, y: pos.y })
                            });
                        } else if (node.hasClass('chat')) {
                            const chatId = node.id().replace('chat_', '');
                            await fetchWithAuth(`/api/admin/chats/${chatId}/position`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ x: pos.x, y: pos.y })
                            });
                        }
                    } catch (err) {
                        console.error('Failed to save position:', err);
                    }
                });

                // Close panel button logic
                document.getElementById('close-panel-btn').onclick = () => {
                    document.getElementById('cy-side-panel').style.display = 'none';
                };

                const openSidePanel = (nodeData) => {
                    const panel = document.getElementById('cy-side-panel');
                    const content = document.getElementById('panel-content');
                    const isApproved = nodeData.status === 'approved';
                    const statusClass = isApproved ? 'status-approved' : 'status-draft';
                    const statusText = isApproved ? 'Одобрен' : 'Черновик';

                    let html = `
                        <div style="margin-bottom: 15px;">
                            <strong>Название:</strong><br>
                            <input type="text" id="panel-proc-name" value="${nodeData.name}" style="width: 100%; padding: 5px;" disabled>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Статус:</strong> <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Владелец:</strong><br>
                            <span>${nodeData.owner || 'Не назначен'}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Цель:</strong><br>
                            <p>${nodeData.goal || 'Цель не указана'}</p>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Описание:</strong><br>
                            <div class="scroll-area" style="max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 4px;">
                                ${marked.parse(nodeData.description || 'Описание отсутствует')}
                            </div>
                        </div>
                        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
                            <button id="panel-go-chat" class="button-primary">Перейти в чат</button>
                            <button id="panel-delete" class="button-danger">Удалить процесс</button>
                        </div>
                    `;
                    content.innerHTML = html;
                    panel.style.display = 'block';

                    document.getElementById('panel-go-chat').onclick = () => {
                        panel.style.display = 'none';
                        showNotification(`Переход к процессу: ${nodeData.name}`, 'info');
                    };

                    document.getElementById('panel-delete').onclick = async () => {
                        if (confirm(`Удалить процесс "${nodeData.name}"?`)) {
                            try {
                                const res = await fetchWithAuth(`/api/admin/processes/${nodeData.id.replace('proc_', '')}`, { method: 'DELETE' });
                                if (res.ok) {
                                    showNotification('Процесс удален', 'success');
                                    panel.style.display = 'none';
                                    loadProcessMap();
                                }
                            } catch (e) {
                                showNotification('Ошибка', 'error');
                            }
                        }
                    };
                };

                cy.on('tap', 'node.process', function (evt) {
                    openSidePanel(evt.target.data());
                });

                // Context menu for background (create department)
                const contextMenu = document.getElementById('cy-context-menu');
                cy.on('cxttap', function (event) {
                    if (event.target === cy) {
                        contextMenu.style.display = 'block';
                        contextMenu.style.left = event.renderedPosition.x + 'px';
                        contextMenu.style.top = event.renderedPosition.y + 'px';
                        contextMenu.innerHTML = `<button id="ctx-add-dept" class="button-secondary" style="border: none; background: transparent; cursor: pointer; padding: 5px 10px; width: 100%; text-align: left;">➕ Добавить департамент</button>`;

                        document.getElementById('ctx-add-dept').onclick = async () => {
                            contextMenu.style.display = 'none';
                            const name = prompt('Название департамента:');
                            if (name) {
                                try {
                                    await fetchWithAuth('/api/departments', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name, password: '123', user_id: sessionUser.id })
                                    });
                                    showNotification('Департамент создан', 'success');
                                    loadProcessMap();
                                } catch (e) {
                                    showNotification('Ошибка', 'error');
                                }
                            }
                        };
                    } else if (event.target.hasClass('department')) {
                        // Context menu for department
                        const deptId = event.target.id().replace('dept_', '');
                        const deptName = event.target.data('name');

                        // Improved interaction: use prompt for name but allow multiple actions
                        const action = prompt(`Департамент: ${deptName}\n1 - Добавить процесс\n2 - Удалить департамент\n\nВведите номер действия (1 или 2):`);

                        if (action === '1') {
                            const name = prompt('Введите название нового процесса:');
                            if (name) {
                                try {
                                    fetchWithAuth('/api/admin/processes', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name, department_id: deptId, status: 'draft' })
                                    }).then(() => {
                                        showNotification('Черновик процесса успешно создан', 'success');
                                        loadProcessMap();
                                    });
                                } catch (e) {
                                    showNotification('Ошибка создания процесса', 'error');
                                }
                            }
                        } else if (action === '2') {
                            if (confirm(`Вы уверены, что хотите удалить департамент "${deptName}" и ВСЕ его процессы?`)) {
                                try {
                                    fetchWithAuth(`/api/admin/departments/${deptId}`, { method: 'DELETE' }).then(() => {
                                        showNotification('Департамент удален', 'success');
                                        loadProcessMap();
                                    });
                                } catch (e) {
                                    showNotification('Ошибка при удалении департамента', 'error');
                                }
                            }
                        }
                    } else {
                        contextMenu.style.display = 'none';
                    }
                });

                cy.on('tap', function (event) {
                    contextMenu.style.display = 'none';
                });

                // Keyboard controls
                window.addEventListener('keydown', (e) => {
                    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                    if (e.key === '+' || e.key === '=') cy.zoom(cy.zoom() * 1.2);
                    if (e.key === '-' || e.key === '_') cy.zoom(cy.zoom() * 0.8);
                });
            } else {
                cy.elements().remove();
                cy.add(elements);
                cy.layout({
                    name: elements.some(e => e.position) ? 'preset' : 'dagre',
                    rankDir: 'TB',
                    spacingFactor: 1.2,
                    nodeSep: 80,
                    rankSep: 100,
                    padding: 50
                }).run();
            }
        } catch (error) {
            console.error('Ошибка загрузки карты:', error);
            showNotification('Ошибка при загрузке карты процессов', 'error');
        }
    }

    if (refreshMapBtn) refreshMapBtn.addEventListener('click', loadProcessMap);
    if (cyZoomIn) cyZoomIn.addEventListener('click', () => cy.zoom(cy.zoom() * 1.2));
    if (cyZoomOut) cyZoomOut.addEventListener('click', () => cy.zoom(cy.zoom() * 0.8));
    if (cyFit) cyFit.addEventListener('click', () => cy.fit());

    // Quick hook to load map when admin panel starts
    window.loadProcessMap = loadProcessMap;

    const toggleChatLinks = document.getElementById('toggle-chat-links');
    if (toggleChatLinks) {
        toggleChatLinks.addEventListener('change', () => {
            if (cy) {
                if (toggleChatLinks.checked) {
                    cy.edges('[relation_type = "Связано с чатом"]').style('display', 'element');
                } else {
                    cy.edges('[relation_type = "Связано с чатом"]').style('display', 'none');
                }
            }
        });
    }

    // Admin Panel Tabs Logic
    const adminTabUsers = document.getElementById('admin-tab-users');
    const adminTabMap = document.getElementById('admin-tab-map');
    const adminViewUsers = document.getElementById('admin-view-users');
    const adminViewMap = document.getElementById('admin-view-map');

    function switchAdminTab(targetTab) {
        // Hide all views
        [adminViewUsers, adminViewMap].forEach(v => {
            if (v) v.style.display = 'none';
        });
        // Remove active from all tabs
        [adminTabUsers, adminTabMap].forEach(t => {
            if (t) t.classList.remove('active');
        });

        if (targetTab === 'users') {
            if (adminViewUsers) adminViewUsers.style.display = 'block';
            if (adminTabUsers) adminTabUsers.classList.add('active');
        } else if (targetTab === 'map') {
            if (adminViewMap) adminViewMap.style.display = 'block';
            if (adminTabMap) adminTabMap.classList.add('active');
            // Render cytoscape when tab becomes visible
            loadProcessMap();
        }
    }

    if (adminTabUsers) adminTabUsers.addEventListener('click', () => switchAdminTab('users'));
    if (adminTabMap) adminTabMap.addEventListener('click', () => switchAdminTab('map'));

    // Mass Upload Logic
    const massUploadBtn = document.getElementById('mass-upload-btn');
    const massUploadInput = document.getElementById('mass-upload-input');
    const massUploadStatus = document.getElementById('mass-upload-status');

    if (massUploadBtn) {
        massUploadBtn.addEventListener('click', async () => {
            const files = massUploadInput.files;
            if (!files || files.length === 0) {
                return showNotification('Пожалуйста, выберите хотя бы один файл (.docx, .txt)', 'error');
            }

            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('documents', files[i]);
            }

            setButtonLoading(massUploadBtn, true, 'Анализ...');
            massUploadStatus.innerText = 'Этап 1: Извлечение текста и ИИ-анализ... Ожидайте.';
            massUploadStatus.style.color = '#2a6fdb';

            try {
                const res = await fetch('/api/admin/parse-documents', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': csrfToken },
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка при загрузке');

                const count = data.parsed?.processes?.length || 0;
                massUploadStatus.innerText = `✅ Успешно! Добавлено процессов: ${count}`;
                massUploadStatus.style.color = '#10b981';
                showNotification(`Документы обработаны. Добавлено ${count} процессов.`, 'success');

                setTimeout(() => {
                    loadProcessMap();
                    massUploadInput.value = '';
                }, 1500);
            } catch (error) {
                console.error('Upload Error:', error);
                massUploadStatus.innerText = `❌ Ошибка: ${error.message}`;
                massUploadStatus.style.color = '#dc3545';
            } finally {
                setButtonLoading(massUploadBtn, false, 'Анализировать и добавить');
            }
        });
    }

    fetchCsrfToken();
    checkSession();
});
