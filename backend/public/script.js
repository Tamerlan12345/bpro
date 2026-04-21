document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    let csrfToken = null;
    let csrfTokenPromise = null;
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
    const downloadBpmnBtn = document.getElementById('download-bpmn-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadVsdxBtn = document.getElementById('download-vsdx-btn');
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
    const createDepartmentForm = document.getElementById('create-department-form');
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
    const createUserForm = document.getElementById('create-user-form');
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

    const editDiagramBtn = document.getElementById('edit-diagram-btn');
    const saveMermaidChangesBtn = document.getElementById('save-mermaid-changes-btn');
    const cancelMermaidEditBtn = document.getElementById('cancel-mermaid-edit-btn');

    const notificationContainer = document.getElementById('notification-container');

    // Глобальные стили для фикса "съедания" текста в кнопках тулбаров
    const globalStyle = document.createElement('style');
    globalStyle.innerHTML = `
        .cy-toolbar, .admin-section .toolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }
        .cy-toolbar button, .admin-section button { white-space: nowrap; min-width: max-content; padding: 6px 10px; font-size: 13px; }
        .cy-toolbar button.spinner { display: inline-flex; align-items: center; gap: 5px; }
        .cy-toolbar { margin-bottom: 10px; }
        #refresh-map-btn { display: inline-flex; align-items: center; gap: 5px; }
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
        #diagram-container .djs-palette, #diagram-container .bjs-powered-by { display: none; }
        #cy-tooltip {
            position: absolute; display: none; background: rgba(15, 23, 42, 0.95);
            color: #fff; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;
            pointer-events: none; z-index: var(--z-tooltip); backdrop-filter: blur(4px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); white-space: pre-wrap;
            border: 1px solid rgba(255,255,255,0.1);
        }
        /* BPMN gateway labels: bigger, bold, readable */
        .djs-label { font-family: 'Inter', 'Segoe UI', Arial, sans-serif !important; }
        .djs-element[data-element-id*="Gateway"] .djs-label,
        .djs-element[data-element-id*="gateway"] .djs-label {
            font-size: 13px !important;
            font-weight: 600 !important;
        }
        /* BPMN task labels: clean readable */
        .djs-element .djs-label {
            font-size: 13px !important;
            line-height: 1.3 !important;
        }
        /* Sequence flow labels (да/нет): bigger, visible */
        .djs-connection .djs-label {
            font-size: 12px !important;
            font-weight: 700 !important;
            fill: #1e293b !important;
        }
        /* Data object and data store styling */
        .djs-element[data-element-id*="DataObj"] .djs-visual,
        .djs-element[data-element-id*="dataObj"] .djs-visual,
        .djs-element[data-element-id*="DataStore"] .djs-visual,
        .djs-element[data-element-id*="dataStore"] .djs-visual {
            opacity: 1 !important;
        }

    `;
    document.head.appendChild(globalStyle);

    const escapeHtml = (str) => {
        if (!str) return str;
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const showSection = (el, display = 'block') => {
        if (!el) return;
        el.classList.remove('hidden');
        el.style.display = display;
    };

    const hideSection = (el) => {
        if (!el) return;
        el.classList.add('hidden');
        el.style.display = 'none';
    };

    const bindFormSubmit = (form, handler) => {
        if (!form) return;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            void handler();
        });
    };



    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fading-out');
            setTimeout(() => notification.remove(), 350);
        }, 4600);
    }

    async function fetchCsrfToken() {
        try {
            const response = await fetch('/api/csrf-token', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                csrfToken = data.csrfToken;
                return csrfToken;
            }
        } catch (error) {
            console.error('Error fetching CSRF token:', error);
        }
        return null;
    }

    async function ensureCsrfToken() {
        if (csrfToken) {
            return csrfToken;
        }

        if (!csrfTokenPromise) {
            csrfTokenPromise = fetchCsrfToken().finally(() => {
                csrfTokenPromise = null;
            });
        }

        return csrfTokenPromise;
    }

    async function fetchWithAuth(url, options = {}) {
        const finalOptions = { ...options, credentials: 'include' };

        if (finalOptions.method && finalOptions.method.toUpperCase() !== 'GET') {
            await ensureCsrfToken();
        }

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

    let bpmnScriptsLoaded = false;
    let bpmnLoadingPromise = null;
    let bpmnViewer = null;
    let bpmnModeler = null;
    let currentDiagramXml = '';
    let currentDiagramSvg = '';
    let currentDiagramModel = null;
    let currentChatStatus = null;
    let diagramMode = 'view';
    let lockedDiagramPanCleanup = null;
    let editingBaselineDiagramXml = '';

    function loadBpmnJs() {
        if (bpmnScriptsLoaded) return Promise.resolve();
        if (bpmnLoadingPromise) return bpmnLoadingPromise;

        bpmnLoadingPromise = new Promise((resolve, reject) => {
            const addCss = (href) => {
                if (!document.querySelector(`link[href='${href}']`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    document.head.appendChild(link);
                }
            };
            addCss('https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/assets/diagram-js.css');
            addCss('https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/assets/bpmn-js.css');
            addCss('https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/assets/bpmn-font/css/bpmn.css');

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bpmn-js@17.11.1/dist/bpmn-modeler.development.js';
            script.onload = () => {
                bpmnScriptsLoaded = true;
                resolve();
            };
            script.onerror = () => {
                bpmnLoadingPromise = null;
                reject(new Error('Не удалось загрузить библиотеку BPMN. Проверьте подключение к интернету.'));
            };
            document.head.appendChild(script);
        });
        return bpmnLoadingPromise;
    }

    function getEmptyBpmnTemplate() {
        return `<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="sample-diagram" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn2:process id="Process_1" isExecutable="false"><bpmn2:startEvent id="StartEvent_1"/></bpmn2:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds height="36.0" width="36.0" x="100.0" y="100.0"/></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>`;
    }

    function safelyFitBpmnViewport(viewerInstance, container = diagramContainer) {
        const canvas = viewerInstance.get('canvas');
        const viewbox = canvas.viewbox();
        const hasFiniteViewbox = viewbox
            && Number.isFinite(viewbox.width)
            && Number.isFinite(viewbox.height)
            && viewbox.width > 0
            && viewbox.height > 0;

        if (hasFiniteViewbox) {
            try {
                canvas.zoom('fit-viewport');
            } catch (error) {
                console.warn('BPMN fit-viewport fallback triggered:', error);
            }
        } else {
            canvas.zoom(1);
        }

        if (container) {
            container.style.overflow = 'auto';
        }
    }



    function destroyLockedDiagramPan() {
        if (typeof lockedDiagramPanCleanup === 'function') {
            lockedDiagramPanCleanup();
            lockedDiagramPanCleanup = null;
        }
    }

    function destroyBpmnEditor() {
        if (bpmnModeler) {
            try {
                bpmnModeler.destroy();
            } catch (error) {
                console.warn('Failed to destroy BPMN editor:', error);
            }
            bpmnModeler = null;
        }
        bpmnViewer = null;
    }

    function userCanEditDiagram() {
        if (!sessionUser || sessionUser.role !== 'admin') return false;
        if (!currentDiagramXml || !currentDiagramXml.trim()) return false;
        return !['completed', 'archived'].includes(currentChatStatus);
    }

    function updateDiagramToolbarState() {
        const hasDiagram = Boolean(currentDiagramXml && currentDiagramXml.trim());
        diagramToolbar.style.display = hasDiagram ? 'flex' : 'none';
        editDiagramBtn.style.display = hasDiagram && diagramMode === 'view' && userCanEditDiagram() ? 'inline-flex' : 'none';
        saveMermaidChangesBtn.style.display = hasDiagram && diagramMode === 'edit' ? 'inline-flex' : 'none';
        cancelMermaidEditBtn.style.display = hasDiagram && diagramMode === 'edit' ? 'inline-flex' : 'none';
        renderDiagramBtn.style.display = hasDiagram ? 'none' : 'block';
    }

    function setLockedDiagramScale(scale) {
        const stage = diagramContainer.querySelector('.doc-diagram-stage');
        if (!stage) return;
        currentDiagramScale = Number(Math.max(0.1, Math.min(scale, 4.0)).toFixed(2));
        stage.style.transform = `scale(${currentDiagramScale})`;
        const baseW = currentDiagramModel?.viewBox?.width || stage.offsetWidth;
        const baseH = currentDiagramModel?.viewBox?.height || stage.offsetHeight;
        stage.style.width = `${Math.round(baseW * currentDiagramScale)}px`;
        stage.style.height = `${Math.round(baseH * currentDiagramScale)}px`;
    }

    function computeFitScale() {
        if (!currentDiagramModel?.viewBox) return 1;
        const containerW = diagramContainer.clientWidth - 24;
        const containerH = diagramContainer.clientHeight - 24;
        const diagramW = currentDiagramModel.viewBox.width;
        const diagramH = currentDiagramModel.viewBox.height;
        if (!diagramW || !diagramH) return 1;
        const scaleX = containerW / diagramW;
        const scaleY = containerH / diagramH;
        return Math.min(scaleX, scaleY, 1);
    }

    function setupLockedDiagramPan() {
        destroyLockedDiagramPan();
        let isPointerDown = false;
        let startX = 0;
        let startY = 0;
        let startScrollLeft = 0;
        let startScrollTop = 0;

        const onPointerDown = (event) => {
            if (diagramMode !== 'view' || event.button !== 0) return;
            isPointerDown = true;
            startX = event.clientX;
            startY = event.clientY;
            startScrollLeft = diagramContainer.scrollLeft;
            startScrollTop = diagramContainer.scrollTop;
            diagramContainer.classList.add('is-panning');
        };

        const onPointerMove = (event) => {
            if (!isPointerDown) return;
            diagramContainer.scrollLeft = startScrollLeft - (event.clientX - startX);
            diagramContainer.scrollTop = startScrollTop - (event.clientY - startY);
        };

        const onPointerUp = () => {
            isPointerDown = false;
            diagramContainer.classList.remove('is-panning');
        };

        diagramContainer.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        lockedDiagramPanCleanup = () => {
            diagramContainer.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            diagramContainer.classList.remove('is-panning');
        };
    }

    async function validateBpmnXml(xml) {
        await loadBpmnJs();
        const scratch = document.createElement('div');
        scratch.style.position = 'absolute';
        scratch.style.left = '-99999px';
        scratch.style.top = '-99999px';
        scratch.style.width = '1px';
        scratch.style.height = '1px';
        document.body.appendChild(scratch);

        const validator = new window.BpmnJS({ container: scratch });
        try {
            await validator.importXML(xml);
        } finally {
            validator.destroy();
            scratch.remove();
        }
    }

    async function getCurrentDiagramXml() {
        if (diagramMode === 'edit' && bpmnModeler && typeof bpmnModeler.saveXML === 'function') {
            const { xml } = await bpmnModeler.saveXML({ format: true });
            return normalizeGeneratedBpmnXml(extractPureBpmnXml(xml));
        }

        return currentDiagramXml || '';
    }

    function downloadBlob(content, mimeType, fileName) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    function renderLockedDiagramView(xml) {
        destroyBpmnEditor();
        destroyLockedDiagramPan();
        diagramMode = 'view';
        currentDiagramModel = window.BpmnPresentation.buildBpmnPresentationModel(xml);
        currentDiagramSvg = window.BpmnPresentation.renderDocStyleSvg(currentDiagramModel);
        currentDiagramXml = xml;
        diagramContainer.innerHTML = `<div class="doc-diagram-shell"><div class="doc-diagram-stage">${currentDiagramSvg}</div></div>`;
        showSection(diagramContainer);
        // Auto-fit: compute scale so the whole diagram is visible without scrolling
        const fitScale = computeFitScale();
        currentDiagramScale = fitScale;
        setLockedDiagramScale(fitScale);
        diagramContainer.style.overflow = fitScale >= 1 ? 'auto' : 'hidden';
        setupLockedDiagramPan();
        updateDiagramToolbarState();
    }

    async function renderDiagramView(bpmnCode, isRetry = false) {
        diagramContainer.classList.remove('hidden');
        diagramContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            let xml;
            if (bpmnCode && bpmnCode.trim()) {
                const extracted = extractPureBpmnXml(bpmnCode);
                if (!extracted || !(/(<\?xml|<bpmn|<definitions)/i.test(extracted))) {
                    throw new Error('Unable to recognize BPMN XML. Ensure the diagram contains valid BPMN 2.0 XML.');
                }
                xml = normalizeGeneratedBpmnXml(extracted);
            } else {
                xml = getEmptyBpmnTemplate();
            }

            await validateBpmnXml(xml);
            renderLockedDiagramView(xml);
            regenerateDiagramBtn.disabled = false;
        } catch (error) {
            console.error('BPMN render error:', error);
            if (!isRetry) {
                try {
                    const fixedCode = await getFixedBpmnCode(bpmnCode, error.message);
                    showNotification('AI fixed the BPMN issue. Re-rendering now...', 'success');
                    await renderDiagramView(fixedCode, true);
                } catch (fixError) {
                    console.error('Failed to fix BPMN code:', fixError);
                    destroyBpmnEditor();
                    destroyLockedDiagramPan();
                    diagramMode = 'view';
                    currentDiagramSvg = '';
                    currentDiagramModel = null;
                    diagramContainer.innerHTML = `<div class="error-text">Failed to fix and render the diagram: ${fixError.message}</div>`;
                    regenerateDiagramBtn.disabled = false;
                    updateDiagramToolbarState();
                }
            } else {
                diagramContainer.innerHTML = `<div class="error-text">Rendering still failed after repair: ${error.message}</div>`;
                regenerateDiagramBtn.disabled = false;
                updateDiagramToolbarState();
            }
        }
    }

    async function openInlineDiagramEditor() {
        if (!currentDiagramXml) {
            showNotification('Generate the diagram first.', 'error');
            return;
        }

        destroyLockedDiagramPan();
        await loadBpmnJs();
        destroyBpmnEditor();

        diagramMode = 'edit';
        editingBaselineDiagramXml = currentDiagramXml;
        diagramContainer.innerHTML = '';
        // Ensure container has a fixed height so bpmn-js canvas renders correctly
        diagramContainer.style.height = Math.max(diagramContainer.clientHeight, 520) + 'px';
        diagramContainer.style.overflow = 'hidden';
        diagramContainer.classList.add('is-edit-mode');
        bpmnModeler = new window.BpmnJS({ container: diagramContainer, keyboard: { bindTo: document } });
        bpmnViewer = bpmnModeler;

        try {
            await bpmnModeler.importXML(currentDiagramXml);
            // Defer fit-viewport so bpmn-js canvas finishes painting first
            setTimeout(() => safelyFitBpmnViewport(bpmnModeler, diagramContainer), 50);
        } catch (error) {
            console.error(error);
            showNotification(`Failed to open the diagram editor: ${error.message}`, 'error');
            diagramMode = 'view';
            diagramContainer.style.height = '';
            diagramContainer.style.overflow = '';
            diagramContainer.classList.remove('is-edit-mode');
            renderLockedDiagramView(editingBaselineDiagramXml || currentDiagramXml);
            return;
        }

        updateDiagramToolbarState();
    }

    function cancelInlineDiagramEdit() {
        if (diagramMode !== 'edit') return;
        diagramContainer.style.height = '';
        diagramContainer.style.overflow = '';
        diagramContainer.classList.remove('is-edit-mode');
        renderLockedDiagramView(editingBaselineDiagramXml || currentDiagramXml || getEmptyBpmnTemplate());
    }

    async function saveInlineDiagramEdit() {
        const process_text = processDescriptionInput.value;

        setButtonLoading(saveMermaidChangesBtn, true, 'Saving...');
        try {
            let xml;
            if (diagramMode === 'edit' && bpmnModeler && typeof bpmnModeler.saveXML === 'function') {
                const { xml: rawXml } = await bpmnModeler.saveXML({ format: true });
                // Don't apply vertical layout re-normalization — preserve user's manual edits
                xml = extractPureBpmnXml(rawXml);
            } else {
                xml = currentDiagramXml || '';
            }

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text, mermaid_code: xml })
            });
            currentDiagramXml = xml;
            editingBaselineDiagramXml = xml;
            showNotification('Diagram changes were saved successfully.', 'success');

            // Reset container styles before re-rendering in view mode
            diagramContainer.style.height = '';
            diagramContainer.style.overflow = '';
            diagramContainer.classList.remove('is-edit-mode');

            renderLockedDiagramView(xml);
            updateDiagramToolbarState();
        } catch (error) {
            showNotification(`Failed to save the diagram: ${error.message}`, 'error');
        } finally {
            setButtonLoading(saveMermaidChangesBtn, false);
        }
    }

    function zoomActiveDiagram(factor) {
        if (diagramMode === 'edit' && bpmnViewer) {
            try {
                const canvas = bpmnViewer.get('canvas');
                const current = canvas.zoom();
                canvas.zoom(Number.isFinite(current) ? current * factor : factor);
            } catch (e) {
                console.warn('Zoom in edit mode failed:', e);
            }
            return;
        }

        setLockedDiagramScale(currentDiagramScale * factor);
    }

    async function downloadCurrentBpmnXml() {
        const xml = await getCurrentDiagramXml();
        if (!xml) {
            showNotification('Generate the diagram first.', 'error');
            return;
        }

        downloadBlob(xml, 'application/bpmn+xml;charset=utf-8', 'process-diagram.bpmn');
    }

    async function downloadCurrentVsd() {
        const xml = await getCurrentDiagramXml();
        if (!xml) {
            showNotification('Сначала сгенерируйте схему.', 'error');
            return;
        }

        const response = await fetchWithAuth(`/api/chats/${chatId}/exports/vsdx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bpmn_xml: xml })
        });
        const blob = await response.blob();
        downloadBlob(blob, 'application/vnd.ms-visio.drawing', 'process-diagram.vsdx');
    }

    async function downloadCurrentDiagram(format) {
        if (!currentDiagramXml) {
            showNotification('Сначала сгенерируйте схему.', 'error');
            return;
        }

        if (format === 'svg') {
            if (diagramMode === 'edit' && bpmnViewer && typeof bpmnViewer.saveSVG === 'function') {
                try {
                    const { svg } = await bpmnViewer.saveSVG();
                    downloadBlob(svg, 'image/svg+xml;charset=utf-8', 'process-diagram.svg');
                } catch (error) {
                    console.error(error);
                    showNotification(`Ошибка экспорта SVG: ${error.message}`, 'error');
                }
                return;
            }

            downloadBlob(currentDiagramSvg, 'image/svg+xml;charset=utf-8', 'process-diagram.svg');
            return;
        }

        if (format === 'png') {
            html2canvas(diagramContainer, { backgroundColor: '#ffffff' }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'process-diagram.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    }

    async function callGeminiAPI(prompt, options = {}) {
        const payload = { prompt: prompt };
        if (options.chatId) {
            payload.chat_id = options.chatId;
        }
        const response = await fetchWithAuth(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error('Invalid API response structure from Google');
        }
        return data.candidates[0].content.parts[0].text;
    }

        function extractPureBpmnXml(text) {
        if (typeof text !== 'string') return text;
        let xml = text.replace(/```(xml|bpmn)?/gi, '').replace(/```/g, '');
        const xmlStart = xml.search(/<\?xml|<bpmn\d*:definitions|<definitions/i);
        if (xmlStart !== -1) {
            xml = xml.substring(xmlStart);
        }
        const xmlEnd = xml.search(/<\/bpmn\d*:definitions>|<\/definitions>/i);
        if (xmlEnd !== -1) {
            const match = xml.match(/<\/bpmn\d*:definitions>|<\/definitions>/i);
            xml = xml.substring(0, xmlEnd + match[0].length);
        }
        return xml.trim();
    }
    /**
     * Sanitizes common structural XML errors introduced by AI-generated BPMN:
     * 1. Closing tag namespace mismatch  (<bpmn:dataInputAssociation> ... </bpmn2:dataInputAssociation>)
     * 2. Orphaned closing tags with no matching opener
     * 3. Malformed dataInputAssociation/dataOutputAssociation blocks with broken nested refs
     * 4. Broken BPMNEdge/di:waypoint DI fragments with unclosed waypoint tags
     */
    function sanitizeBpmnXml(xml) {
        if (typeof xml !== 'string') return xml;

        const countTagPairs = (fragment, tagName) => {
            const openRe = new RegExp(`<(?:bpmn\\d*:)?${tagName}(?=[\\s>])`, 'gi');
            const closeRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');

            return {
                openCount: (fragment.match(openRe) || []).length,
                closeCount: (fragment.match(closeRe) || []).length
            };
        };

        const normalizeWaypointTag = (attrs = '') => {
            const xMatch = attrs.match(/\bx\s*=\s*(["'])([^"']+)\1/i);
            const yMatch = attrs.match(/\by\s*=\s*(["'])([^"']+)\1/i);

            if (!xMatch || !yMatch) {
                return '';
            }

            const x = Number.parseFloat(xMatch[2]);
            const y = Number.parseFloat(yMatch[2]);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return '';
            }

            return `<di:waypoint x="${xMatch[2]}" y="${yMatch[2]}" />`;
        };

        const extractWaypointFragments = block => {
            const fragments = [...block.matchAll(/<(?:di:waypoint|waypoint|di)\b[^<>]*(?:\/?>)?/gi)]
                .map(match => match[0]);

            // Fallback for weird cases where the tag prefix is mangled but attributes survive.
            if (!fragments.length) {
                return [...block.matchAll(/<[^<>]{0,80}\bx\s*=\s*(["'])[^"']+\1[^<>]{0,80}\by\s*=\s*(["'])[^"']+\2[^<>]{0,80}(?:\/?>)?/gi)]
                    .map(match => match[0]);
            }

            return fragments;
        };

        const rebuildEdgeBlock = block => {
            const openTag = block.match(/^<bpmndi:BPMNEdge\b[^>]*>/i)?.[0];
            if (!openTag) return '';

            const labelBlock = block.match(/<bpmndi:BPMNLabel\b[\s\S]*?<\/bpmndi:BPMNLabel>/i)?.[0] || '';
            const normalizedWaypoints = extractWaypointFragments(block)
                .map(fragment => normalizeWaypointTag(fragment))
                .filter(Boolean);

            if (normalizedWaypoints.length < 2) {
                return '';
            }

            return `${openTag}${normalizedWaypoints.join('')}${labelBlock}</bpmndi:BPMNEdge>`;
        };

        // Tags where namespace prefix mismatches are common in AI-generated XML
        const mutableTags = [
            'dataInputAssociation', 'dataOutputAssociation', 'conditionExpression',
            'sourceRef', 'targetRef', 'flowNodeRef'
        ];

        // 1. Per-tag: detect the prefix used in the opening tag and normalise all
        //    closing tags for that tag to use the same prefix.
        mutableTags.forEach(tagName => {
            const openTagRe = new RegExp(`<(?:(bpmn\\d*):)?${tagName}(?=[\\s>])`, 'i');
            const closeTagRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');
            const openMatch = xml.match(openTagRe);
            if (!openMatch) return;                // tag not present в†’ skip
            const prefix = openMatch[1] ? `${openMatch[1]}:` : '';
            xml = xml.replace(closeTagRe, `</${prefix}${tagName}>`);
        });

        // 2. Remove orphaned closing tags (more closes than opens) for the same set.
        const orphanTags = [
            'dataInputAssociation', 'dataOutputAssociation', 'conditionExpression',
            'sourceRef', 'targetRef'
        ];
        orphanTags.forEach(tagName => {
            const closeRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');
            const openRe = new RegExp(`<(?:bpmn\\d*:)?${tagName}(?=[\\s>])`, 'gi');
            const openCount  = (xml.match(openRe)  || []).length;
            const closeCount = (xml.match(closeRe) || []).length;
            if (closeCount > openCount) {
                let surplus = closeCount - openCount;
                xml = xml.replace(closeRe, m => {
                    if (surplus > 0) { surplus--; return ''; }
                    return m;
                });
            }
        });

        // 3. Remove malformed association blocks where nested refs are unbalanced.
        //    completely empty (no targetRef/sourceRef content) – they cause parse errors.
        ['dataInputAssociation', 'dataOutputAssociation'].forEach(tagName => {
            const blockRe = new RegExp(
                `<(?:bpmn\\d*:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:bpmn\\d*:)?${tagName}>`,
                'gi'
            );

            xml = xml.replace(blockRe, block => {
                const hasUnbalancedRefs = ['sourceRef', 'targetRef'].some(refTag => {
                    const { openCount, closeCount } = countTagPairs(block, refTag);
                    return openCount !== closeCount;
                });

                if (hasUnbalancedRefs) {
                    return '';
                }

                const { openCount, closeCount } = countTagPairs(block, tagName);
                return openCount === 1 && closeCount === 1 ? block : '';
            });
        });

        xml = xml.replace(/<(?:bpmn\d*:)?dataInputAssociation[^>]*>\s*<\/(?:bpmn\d*:)?dataInputAssociation>/gi, '');
        xml = xml.replace(/<(?:bpmn\d*:)?dataOutputAssociation[^>]*>\s*<\/(?:bpmn\d*:)?dataOutputAssociation>/gi, '');

        // 4. Normalize malformed DI waypoints before the XML reaches bpmn-js.
        // 4a: self-closing properly formed  <di:waypoint x="…" y="…"/>  → keep via normalizeWaypointTag
        xml = xml.replace(/<(?:di:)?waypoint\b([^<>]*?)\/>/gi, (_, attrs) => normalizeWaypointTag(attrs) || '');
        // 4b: open+explicit-close pair  <di:waypoint …>…</di:waypoint>
        xml = xml.replace(/<(?:di:)?waypoint\b([^<>]*?)>\s*<\/(?:di:)?waypoint>/gi, (_, attrs) => normalizeWaypointTag(attrs) || '');
        // 4c: open tag (no self-close) followed immediately by another element (the primary unclosed-tag bug)
        xml = xml.replace(/<(di:waypoint|waypoint)\b([^<>]*?)>(?=\s*<)/gi, (_, _tag, attrs) => normalizeWaypointTag(attrs) || '');
        // 4d: orphaned closing tags left behind by earlier passes
        xml = xml.replace(/<\/(?:di:)?waypoint>/gi, '');

        // 5. Fix BPMNShape blocks — AI often produces open <dc:Bounds> without self-closing />
        //    which causes 'unparsable content </bpmndi:BPMNShape detected; nested error: unclosed tag'
        // 5a: Global: convert any open <dc:Bounds …> (with or without explicit close) to self-closing
        xml = xml.replace(/<dc:Bounds\b([^<>]*?)>\s*(?:<\/dc:Bounds>)?/gi, (_, attrs) => `<dc:Bounds${attrs}/>`);
        // 5b: In BPMNShape, fix <bpmndi:BPMNLabel> without closing tag (empty label blocks)
        xml = xml.replace(
            /<bpmndi:BPMNShape\b[^>]*>[\s\S]*?<\/bpmndi:BPMNShape>/gi,
            shapeBlock => {
                // Ensure BPMNLabel has a matching close tag
                const labelOpenCount  = (shapeBlock.match(/<bpmndi:BPMNLabel(?=[\s>])/gi) || []).length;
                const labelCloseCount = (shapeBlock.match(/<\/bpmndi:BPMNLabel>/gi) || []).length;
                if (labelOpenCount > labelCloseCount) {
                    // Append missing close tags before the Shape close
                    const missing = labelOpenCount - labelCloseCount;
                    return shapeBlock.replace(/<\/bpmndi:BPMNShape>/i,
                        `${'</bpmndi:BPMNLabel>'.repeat(missing)}</bpmndi:BPMNShape>`);
                }
                return shapeBlock;
            }
        );
        // 5c: BPMNShape open tag that was left without a matching close (bleeds into next shape)
        xml = xml.replace(
            /<bpmndi:BPMNShape\b[^>]*>[\s\S]*?(?=<bpmndi:BPMNShape\b|<\/bpmndi:BPMNPlane>|<\/bpmndi:BPMNDiagram>)/gi,
            block => {
                if (/<\/bpmndi:BPMNShape>/i.test(block)) return block; // already closed
                // Ensure dc:Bounds self-closes and close the Shape
                let fixed = block.replace(/<dc:Bounds\b([^<>]*?)>(?!\s*\/)/gi, (_, a) => `<dc:Bounds${a}/>`);
                return `${fixed}</bpmndi:BPMNShape>`;
            }
        );

        xml = xml.replace(/<bpmndi:BPMNEdge\b[^>]*>[\s\S]*?<\/bpmndi:BPMNEdge>/gi, block => {
            if (!/<(?:di:waypoint|waypoint|di)\b/i.test(block)) {
                return block;
            }

            return rebuildEdgeBlock(block);
        });

        // 6. Recover edge blocks that lost their explicit closing tag and now bleed into the next DI section.
        xml = xml.replace(
            /<bpmndi:BPMNEdge\b[^>]*>[\s\S]*?(?=(?:<bpmndi:BPMNEdge\b|<\/bpmndi:BPMNPlane>|<\/bpmndi:BPMNDiagram>|<\/bpmn\d*:definitions>|<\/definitions>))/gi,
            block => {
                if (/<\/bpmndi:BPMNEdge>/i.test(block)) {
                    return block;
                }

                if (!/<(?:di:waypoint|waypoint|di)\b/i.test(block)) {
                    return block;
                }

                return rebuildEdgeBlock(`${block}</bpmndi:BPMNEdge>`);
            }
        );

        return xml;
    }

    function normalizeGeneratedBpmnXml(xml, applyLayout = true) {
        if (typeof xml !== 'string') {
            return xml;
        }

        xml = extractPureBpmnXml(xml);
        xml = sanitizeBpmnXml(xml);

        if (!applyLayout || typeof normalizeBpmnVerticalLayout !== 'function') {
            return xml;
        }

        try {
            return normalizeBpmnVerticalLayout(xml);
        } catch (error) {
            console.warn('BPMN vertical normalization skipped:', error);
            return xml;
        }
    }

    async function generateProcessArtifacts(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик Сентрас Иншуранс и эксперт по BPMN. Твоя задача — взять сырое описание процесса от пользователя и превратить его в два артефакта:
1.  Структурированное описание шагов бизнес-процесса в формате Markdown.
2.  Код диаграммы в строгом стандарте BPMN 2.0 XML (на основе которого будет строиться визуальная схема).

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

**ВАЖНО:** Если во входных данных присутствует секция \`### Предложения по улучшению:\`, ты должен использовать перечисленные в ней пункты как прямое руководство для улучшения и переписывания основного описания процесса. Интегрируй эти улучшения в итоговый \`standardDescription\`. Саму секцию \`### Предложения по улучшению:\` в финальный ответ включать не нужно.

### ПРАВИЛА ДЛЯ BPMN 2.0 XML:
- Верни валидный, корректный и полный XML документ.
- Обязательно включи блок <bpmndi:BPMNDiagram> и <bpmndi:BPMNPlane>.
- Для каждого элемента (task, startEvent, endEvent, gateway) и для каждой связи (sequenceFlow) ДОЛЖНЫ быть сгенерированы соответствующие элементы DI (BPMNShape с dc:Bounds и BPMNEdge с di:waypoint) с математически корректными координатами X и Y.
- ВАЖНО: Координаты элементов выставляй приблизительно сверху вниз — точная раскладка будет выполнена автоматически.
- ВАЖНО: У каждого элемента списки <incoming> и <outgoing> должны точно соответствовать реальным <bpmn2:sequenceFlow sourceRef/targetRef>. Не допускай ссылок на чужие или дублирующиеся потоки.
- ВАЖНО: Используй тег <bpmn2:task> (прямоугольники) для основных шагов процесса. Кругами (<bpmn2:startEvent> и <bpmn2:endEvent>) делай только начало и конец.
- ВАЖНО: Не используй intermediate events, boundary events и другие круги внутри процесса, если пользователь явно не просил событие. В типовом бизнес-процессе круги допустимы только для начала и завершения процесса.
- ВАЖНО: Решения и ветвления ДОЛЖНЫ использовать тег <bpmn2:exclusiveGateway>.
- ВАЖНО: Каждый <bpmn2:exclusiveGateway> должен иметь короткий вопрос в атрибуте name, например "Документ корректен?" или "Согласовано?".
- ВАЖНО: Подписи "да"/"нет" (атрибут name) и элементы <bpmn2:conditionExpression> могут быть ТОЛЬКО у связей (<bpmn2:sequenceFlow>), исходящих из шлюза <bpmn2:exclusiveGateway>. Обычные задачи не могут содержать условия перехода.
- ВАЖНО: Если у <bpmn2:exclusiveGateway> два исходящих потока, один должен быть помечен "да", второй "нет".
- ВАЖНО: Если одна ветка после gateway возвращает процесс на предыдущий шаг для доработки/повторного согласования, показывай основное продолжение процесса прямо под gateway, а возвратную ветку уводи в сторону с понятной стрелкой возврата.
- ВАЖНО: Если две ветки после gateway потом сходятся в один общий шаг, показывай их как две отдельные боковые ветки, а общий следующий шаг располагай ниже по центру.
- ВАЖНО: Основной поток строй сверху вниз. После gateway ветки разводи в стороны и затем возвращай продолжение процесса вниз. Не вытягивай весь процесс в длинную горизонтальную линию.
- ВАЖНО: СТРОГАЯ ПРИВЯЗКА ЛОГИЧЕСКИХ БЛОКОВ (БАЗА):
  1) Вход/выход процесса = строго <bpmn2:startEvent> и <bpmn2:endEvent> (Круг). Использование других кругов/событий запрещено!
  2) Действие/шаг процесса = строго <bpmn2:task> (Прямоугольник). Каждый task должен содержать в name краткое название действия.
  2.1) Документы, заявки, полисы страхования = ИСПОЛЬЗУЙ <bpmn2:dataObjectReference>. Связывай их с <bpmn2:task> через <bpmn2:dataOutputAssociation> или <bpmn2:dataInputAssociation>. Документы обязательны, если в тексте упоминаются печатные формы или файлы.
  3) Ссылка на другой бизнес-процесс = строго <bpmn2:callActivity> (двойная рамка). Атрибут calledElement указывай как код процесса.
  4) Логический блок = строго <bpmn2:exclusiveGateway> (ромб). Атрибут name — краткий вопрос. Ветвь "Да" должна продолжать процесс строго ВНИЗ.
  5) База данных (БД, КИАС, хранилище) = строго <bpmn2:dataStoreReference> (цилиндр). Для связи с task используй <bpmn2:dataOutputAssociation>. Обязательно генерируй BPMNShape (dc:Bounds).
  6) Зона ответственности/роли = если в описании процесса упоминаются конкретные роли, оборачивай процесс в <bpmn2:collaboration> с <bpmn2:participant> и используй <bpmn2:laneSet> с <bpmn2:lane>.
  7) Направляющие (стрелки потока) = <bpmn2:sequenceFlow> для связи элементов процесса.
- Без координат (DI) визуальный редактор не сможет отобразить схему! Прояви математическую точность.
- Не обрезай XML, верни его полностью.


ФОРМАТ ОТВЕТА:
Твой ответ должен быть JSON-объектом и ТОЛЬКО им. Никаких объяснений. Структура должна быть следующей:
{
"standardDescription": "...", // Здесь Markdown-текст
"mermaidCode": "..." // Здесь размести BPMN XML код (название ключа осталось mermaidCode для совместимости)
}

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt, { chatId }).then(response => {
            // AI responses can sometimes include markdown wrappers. Find the JSON block.
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Invalid response from AI, no JSON object found. Raw response:", response);
                throw new Error("Не удалось получить корректный JSON-объект от AI.");
            }
            try {
                // Parse the extracted JSON string.
                const parsedResponse = JSON.parse(jsonMatch[0]);
                if (typeof parsedResponse.mermaidCode === 'string') {
                    parsedResponse.mermaidCode = normalizeGeneratedBpmnXml(parsedResponse.mermaidCode);
                }
                return parsedResponse;
            } catch (error) {
                console.error("Failed to parse JSON from AI response. Raw JSON string:", jsonMatch[0], "Error:", error);
                throw new Error("Ошибка парсинга JSON ответа от AI.");
            }
        });
    }

    async function getFixedBpmnCode(brokenCode, errorMessage) {
        const prompt = `Ты — эксперт по BPMN 2.0. Тебе дали BPMN XML с ошибкой. Твоя задача — ИСПРАВИТЬ ЕГО.

НЕИСПРАВНЫЙ КОД:
\`\`\`
${brokenCode}
\`\`\`

СООБЩЕНИЕ ОБ ОШИБКЕ:
"${errorMessage}"

Проанализируй ошибку и верни ИСПРАВЛЕННЫЙ код. Убедись, что добавлены все DI-теги с координатами (BPMNShape, dc:Bounds, BPMNEdge, di:waypoint).
Сначала убери невалидные условные атрибуты и conditionExpression, а не перестраивай топологию без необходимости.
Сверь <incoming>/<outgoing> у каждого элемента с реальными sequenceFlow sourceRef/targetRef и исправь несоответствия.
Подписи "да"/"нет" и элементы <bpmn2:conditionExpression> допустимы только у sequenceFlow, исходящих из <bpmn2:exclusiveGateway>.
Если они стоят после обычного task, удали их. Добавляй gateway только если в самом процессе явно есть решение или развилка.
Не используй лишние круги внутри процесса: круги допустимы только для <bpmn2:startEvent> и <bpmn2:endEvent>, если пользователь явно не описал специальное событие.
Каждый <bpmn2:exclusiveGateway> должен иметь понятный вопрос в name. Если есть две ветки решения, они должны быть помечены "да" и "нет".
Если одна ветка означает возврат на доработку, оставляй основное продолжение под gateway, а возвратную ветку делай боковой и возвращающейся к предыдущему шагу.
Если две ветки после gateway сходятся в один общий шаг, располагай их по разным сторонам и соединяй с общим шагом ниже.
Сохрани вертикальную композицию: основной поток (Да) строго сверху вниз. Ветки альтернативные (Нет) отводи ВПРАВО, затем продолжение снова вниз (если ветки сходятся). Если ветка (Нет) означает возврат на доработку — отводи её ВЛЕВО и возвращай вверх к предыдущему шагу.
ВАЖНО: СТРОГАЯ ПРИВЯЗКА ЛОГИЧЕСКИХ БЛОКОВ (БАЗА): Вход/выход = <bpmn2:startEvent>/<bpmn2:endEvent>, шаг = <bpmn2:task>, ссылка на процесс = строго <bpmn2:callActivity> (двойная рамка), логическое ИЛИ = <bpmn2:exclusiveGateway> (ветвь "Да" ВНИЗ, "Нет" ВПРАВО/ВЛЕВО), база данных (КИАС) = <bpmn2:dataStoreReference> (с BPMNShape в DI-блоке), Документы (договоры, полисы) = разрешено и нужно <bpmn2:dataObjectReference>. Если есть роли, используй <bpmn2:laneSet>/<bpmn2:lane>.

Ответ должен содержать ТОЛЬКО ИСПРАВЛЕННЫЙ код BPMN XML, без объяснений и markdown.`;
        return callGeminiAPI(prompt, { chatId }).then(code => normalizeGeneratedBpmnXml(code.replace(/```xml/g, '').replace(/```/g, '').trim()));
    }

    async function generateDiagramFromText(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик Сентрас Иншуранс. Твоя задача — взять описание процесса от пользователя и превратить его в код для диаграммы в строгом стандарте BPMN 2.0 XML.
Обязательно включи блок <bpmndi:BPMNDiagram> и сгенерируй координаты (Bounds/waypoint) для всех элементов, чтобы диаграмма отображалась визуально. 
ВАЖНО: Координаты элементов выставляй приблизительно сверху вниз — точная раскладка будет выполнена автоматически.
ВАЖНО: Списки <incoming> и <outgoing> у каждого элемента должны точно совпадать с реальными sequenceFlow sourceRef/targetRef.
ВАЖНО: Используй <bpmn2:task> (прямоугольники) для основных шагов процесса. Кругами (<bpmn2:startEvent> и <bpmn2:endEvent>) делай только начало и конец.
ВАЖНО: Не используй intermediate events, boundary events и другие круги внутри процесса, если пользователь явно не просил событие. В типовом бизнес-процессе круги допустимы только для начала и завершения процесса.
ВАЖНО: Решения и ветвления ДОЛЖНЫ использовать тег <bpmn2:exclusiveGateway>. Подписи "да"/"нет" и теги <bpmn2:conditionExpression> можно применять ТОЛЬКО к связям, исходящим из шлюза.
ВАЖНО: Каждый <bpmn2:exclusiveGateway> должен иметь короткий вопрос в атрибуте name. Если из него выходят две ветки, одна должна быть "да", другая "нет".
ВАЖНО: Если одна ветка после gateway возвращает процесс на доработку, основное продолжение размещай прямо под gateway, а возвратную ветку уводи в сторону и возвращай к нужному предыдущему шагу.
ВАЖНО: Если две ветки после gateway потом сходятся в один общий шаг, показывай обе ветки отдельно по сторонам, а точку продолжения процесса располагай ниже по центру.
ВАЖНО: Основной поток строй сверху вниз. После gateway ветки разводи в стороны и затем возвращай продолжение процесса вниз, а не в длинную горизонтальную линию.
ВАЖНО: СТРОГАЯ ПРИВЯЗКА ЛОГИЧЕСКИХ БЛОКОВ (БАЗА):
  1) Вход/выход процесса = строго <bpmn2:startEvent> и <bpmn2:endEvent> (Круг). Использование других событий запрещено.
  2) Действие/шаг = строго <bpmn2:task> (Прямоугольник). Каждый task должен содержать в name краткое название действия.
  2.1) Документы, заявки, полисы страхования = ИСПОЛЬЗУЙ <bpmn2:dataObjectReference>. Связывай их с <bpmn2:task> через <bpmn2:dataOutputAssociation> или <bpmn2:dataInputAssociation>. Документы обязательны для артефактов (договоры, полисы, акты).
  3) Ссылка на другой бизнес-процесс = строго <bpmn2:callActivity> (двойная рамка). Атрибут calledElement указывай как код процесса.
  4) Логический блок ИЛИ = строго <bpmn2:exclusiveGateway> (ромб). Атрибут name — краткий вопрос. Ветка "Да" идет строго ВНИЗ. Ветка "Нет" (отказ) идет ВПРАВО. Ветка возврата на доработку идет ВЛЕВО.
  5) База данных (БД, КИАС, хранилище) = строго <bpmn2:dataStoreReference> (цилиндр). Для связи с task используй <bpmn2:dataOutputAssociation>. Обязательно генерируй BPMNShape (dc:Bounds).
  6) Зона ответственности/роли = если в описании процесса упоминаются конкретные роли или подразделения, оборачивай процесс в <bpmn2:collaboration> с <bpmn2:participant> и используй <bpmn2:laneSet> с <bpmn2:lane> внутри process.
  7) Направляющие (стрелки потока) = <bpmn2:sequenceFlow> для связи элементов.

ФОРМАТ ОТВЕТА:
Твой ответ должен содержать ТОЛЬКО код BPMN 2.0 XML, без объяснений и markdown.

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt, { chatId }).then(code => normalizeGeneratedBpmnXml(code.replace(/```xml/g, '').replace(/```/g, '').trim()));
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
            showSection(logoutBtn, 'inline-flex');

            if (sessionUser.role === 'admin') {
                hideSection(loginContainer);
                showSection(adminPanel);
                await loadAdminPanel();
            } else {
                if (userLogin) userLogin.style.display = 'none';
                showSection(loginContainer, 'block');
                showSection(departmentSelection);
                hideSection(chatLogin);
                hideSection(adminPanel);
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
        hideSection(departmentSelection);
        showSection(chatLogin);
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
        if (backToAdminBtn) backToAdminBtn.style.display = 'none'; // Скрываем старую кнопку, если она есть в HTML

        const deptName = selectedDepartment ? selectedDepartment.name : 'Департамент';
        chatNameHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="universal-back-btn" class="button-secondary" style="padding: 6px 14px; font-size: 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <span style="font-size: 16px;">⬅</span> Назад
                </button>
                <div style="font-size: 18px;">
                    <span id="breadcrumb-back" style="cursor:pointer; color: #3b82f6; transition: color 0.2s;" title="Вернуться назад" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#3b82f6'">
                        🏢 ${escapeHtml(deptName)}
                    </span> 
                    <span style="color: #94a3b8; margin: 0 8px;">/</span> 
                    💬 ${escapeHtml(chatName)}
                </div>
            </div>
        `;

        const goBackHandler = () => {
            mainContainer.style.display = 'none';
            authWrapper.style.display = 'flex';
            if (sessionUser && sessionUser.role === 'admin') {
                showSection(adminPanel);
            } else {
                showSection(chatLogin);
            }
        };

        document.getElementById('universal-back-btn').addEventListener('click', goBackHandler);
        document.getElementById('breadcrumb-back').addEventListener('click', goBackHandler);

        updateStepCounter();
        loadChatData();
    }

    async function checkSession() {
        try {
            const response = await fetchWithAuth('/api/auth/session');
            const data = await response.json();
            if (data.user) {
                sessionUser = data.user;
                showSection(logoutBtn, 'inline-flex');
                authWrapper.style.display = 'flex'; // Keep the wrapper visible
                if (sessionUser.role === 'admin') {
                    hideSection(loginContainer);
                    showSection(adminPanel);
                    await loadAdminPanel();
                } else {
                    showSection(loginContainer, 'block');
                    if (userLogin) userLogin.style.display = 'none';
                    showSection(departmentSelection);
                    hideSection(chatLogin);
                    hideSection(adminPanel);
                    await loadDepartmentsForSelection();
                }
            } else {
                authWrapper.style.display = 'flex';
                mainContainer.style.display = 'none';
                showSection(loginContainer, 'block');
                if (userLogin) userLogin.style.display = 'block';
                hideSection(departmentSelection);
                hideSection(chatLogin);
                hideSection(adminPanel);
            }
        } catch (error) {
            authWrapper.style.display = 'flex';
            mainContainer.style.display = 'none';
            showSection(loginContainer, 'block');
            if (userLogin) userLogin.style.display = 'block';
            hideSection(departmentSelection);
            hideSection(chatLogin);
            hideSection(adminPanel);
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
            currentChatStatus = status;
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
                await displayVersion(null);
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
        versionHistoryContainer.innerHTML = versions.map((v, i) => `
            <div class="version-item" data-version-id="${v.id}" style="transition: all 0.2s; ${i === 0 ? 'border-left: 4px solid #10b981; background-color: #f0fdf4;' : 'border-left: 4px solid transparent;'}">
                <span style="${i === 0 ? 'font-weight: 600; color: #065f46;' : ''}">Версия от ${new Date(v.created_at).toLocaleString()} ${i === 0 ? '⭐️' : ''}</span>
                <button class="button-small">Посмотреть</button>
            </div>`).join('') || '<p>Нет сохраненных версий.</p>';
    }

    async function displayVersion(version) {
        if (!version) {
            processDescriptionInput.value = '';
            updateStepCounter();
            destroyBpmnEditor();
            destroyLockedDiagramPan();
            currentDiagramXml = '';
            currentDiagramSvg = '';
            currentDiagramModel = null;
            diagramMode = 'view';
            diagramPlaceholder.style.display = 'block';
            diagramContainer.classList.add('hidden');
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            updateDiagramToolbarState();
            return;
        }
        processDescriptionInput.value = version.process_text;

        // Восстановление автосохранения
        const savedDraft = localStorage.getItem(`autosave_chat_${chatId}`);
        // Если черновик новее и мы смотрим именно последнюю (актуальную) версию
        if (savedDraft && savedDraft !== version.process_text && version.id === chatVersions[0]?.id) {
            showNotification('Восстановлен несохраненный черновик', 'info');
            processDescriptionInput.value = savedDraft;
        }

        updateStepCounter();
        if (version.mermaid_code && version.mermaid_code.trim() !== '') {
            diagramPlaceholder.style.display = 'none';
            diagramContainer.classList.remove('hidden');
            diagramContainer.style.display = 'block';
            diagramContainer.innerHTML = '';
            await renderDiagramView(version.mermaid_code);
        } else {
            destroyBpmnEditor();
            destroyLockedDiagramPan();
            currentDiagramXml = '';
            currentDiagramSvg = '';
            currentDiagramModel = null;
            diagramMode = 'view';
            diagramPlaceholder.style.display = 'block';
            diagramContainer.classList.add('hidden');
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            updateDiagramToolbarState();
        }

        // Если включен режим предпросмотра, обновляем его
        if (typeof isPreviewMode !== 'undefined' && isPreviewMode) {
            previewContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(processDescriptionInput.value || '*Пусто*') : processDescriptionInput.value;
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
            localStorage.removeItem(`autosave_chat_${chatId}`);
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
        const timeoutId = setTimeout(() => {
            setButtonLoading(button, false);
            showNotification('Генерация заняла слишком много времени. Попробуйте ещё раз.', 'error');
        }, 60000);
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            if (mermaidCode) {
                diagramPlaceholder.style.display = 'none';
                diagramContainer.style.display = 'block';
                await renderDiagramView(mermaidCode);
                // Сохраняем новую схему в версию, чтобы она не потерялась после reload
                if (currentDiagramXml && chatId) {
                    try {
                        await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ process_text, mermaid_code: currentDiagramXml })
                        });
                        // Обновляем список версий в фоне без перерисовки всего UI
                        fetchWithAuth(`/api/chats/${chatId}/versions`)
                            .then(r => r.json())
                            .then(versions => {
                                chatVersions = versions;
                                renderVersions(versions);
                            })
                            .catch(() => {});
                        showNotification('Схема сгенерирована и сохранена.', 'success');
                    } catch (saveError) {
                        console.warn('Auto-save of regenerated diagram failed:', saveError);
                        showNotification('Схема создана, но не сохранена автоматически.', 'info');
                    }
                }
            } else {
                showNotification('ИИ не вернул код схемы. Попробуйте еще раз.', 'error');
            }
        } catch (error) {
            showNotification(`Ошибка создания схемы: ${error.message}`, "error");
        } finally {
            clearTimeout(timeoutId);
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
            if (status === 'pending_review') {
                sendRevisionBtn.style.display = 'inline-block';
                completeBtn.style.display = 'inline-block';
            }
            if (status === 'completed') {
                archiveBtn.style.display = 'inline-block';
            }
        } else {
            if (status === 'draft' || status === 'needs_revision') {
                sendReviewBtn.style.display = 'inline-block';
            }
        }

        updateDiagramToolbarState();
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
            showNotification("ФИО, Email и пароль обязательны", "error");
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

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all tabs and hide all content
                tabs.forEach(t => t.classList.remove('active'));
                hideSection(document.getElementById('in-review'));
                hideSection(document.getElementById('pending'));
                hideSection(document.getElementById('completed'));

                // Activate the clicked tab
                tab.classList.add('active');

                // Show the corresponding content
                if (tab.id === 'in-review-tab') {
                    showSection(document.getElementById('in-review'));
                } else if (tab.id === 'pending-tab') {
                    showSection(document.getElementById('pending'));
                } else if (tab.id === 'completed-tab') {
                    showSection(document.getElementById('completed'));
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
            let mermaid_code = await getCurrentDiagramXml();

            if (!mermaid_code) {
                mermaid_code = (chatVersions && chatVersions.length > 0) ? (chatVersions[0].mermaid_code || '') : '';
            }

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text, mermaid_code })
            });
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(`autosave_chat_${chatId}`);
            }
            showNotification("Версия успешно сохранена без изменений от ИИ.", "success");
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
            const deptNameMatch = link.querySelector('.chat-dept-name')?.textContent.replace(/[()]/g, '');
            selectedDepartment = { name: deptNameMatch || 'Админ-панель' };
            showMainApp(link.dataset.chatName);
        }
    }

    function resetAudioState() {
        audioBlob = null;
        audioChunks = [];
        rerecordCount = 0;
        processDescriptionInput.readOnly = false;
        transcriptionDisplay.textContent = ''; // Clear the display area
        if (fileUploadInput) fileUploadInput.value = '';

        startRecordBtn.style.display = 'block';
        if (typeof uploadAudioBtn !== 'undefined') uploadAudioBtn.style.display = 'inline-block';
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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                } 
            });
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
            if (typeof uploadAudioBtn !== 'undefined') uploadAudioBtn.style.display = 'none';
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
        if (fileUploadInput) fileUploadInput.value = '';

        listenBtn.style.display = 'none';
        processBtn.style.display = 'none';
        rerecordBtn.style.display = 'none';
        audioPlayback.style.display = 'none';
        partialTranscriptDisplay.textContent = '';
        if (typeof uploadAudioBtn !== 'undefined') uploadAudioBtn.style.display = 'none';

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

    function extractFirstJsonArray(text) {
        if (typeof text !== 'string') return null;

        let start = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === '[') {
                if (depth === 0) start = i;
                depth += 1;
                continue;
            }

            if (ch === ']') {
                if (depth > 0) depth -= 1;
                if (depth === 0 && start !== -1) {
                    return text.slice(start, i + 1);
                }
            }
        }

        return null;
    }

    function normalizeSuggestions(raw) {
        const candidates = Array.isArray(raw)
            ? raw
            : (raw && Array.isArray(raw.suggestions) ? raw.suggestions : []);

        return candidates
            .map(item => ({
                problem: String(item?.problem || item?.issue || '').trim(),
                suggestion: String(item?.suggestion || item?.solution || '').trim()
            }))
            .filter(item => item.problem && item.suggestion);
    }

    function parseSuggestionsResponse(responseText) {
        const text = String(responseText || '').trim();

        // 1) Try strict JSON parsing first (sometimes model returns pure JSON).
        try {
            const direct = JSON.parse(text);
            const normalized = normalizeSuggestions(direct);
            if (normalized.length > 0) return normalized;
        } catch (_error) {
            // Fallbacks below.
        }

        // 2) Try fenced block and first-array extraction from mixed text.
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        const source = fenced ? fenced[1] : text;
        const arrayText = extractFirstJsonArray(source);
        if (!arrayText) {
            throw new Error('Не удалось найти JSON-массив с улучшениями в ответе ИИ.');
        }

        const parsed = JSON.parse(arrayText);
        const normalized = normalizeSuggestions(parsed);
        if (normalized.length === 0) {
            throw new Error('ИИ вернул ответ, но в нем нет валидных пунктов улучшений.');
        }
        return normalized;
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
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const responseText = await callGeminiAPI(prompt, { chatId });
                return parseSuggestionsResponse(responseText);
            } catch (error) {
                lastError = error;
                console.error(`Suggestions parse/generate failed (attempt ${attempt})`, error);
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            }
        }

        throw new Error(`Ошибка получения улучшений: ${lastError?.message || 'неизвестная ошибка'}`);
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

    // --- Инициализация нового UI/UX ---

    // 1. Кнопка загрузки аудиофайла
    const fileUploadInput = document.createElement('input');
    fileUploadInput.type = 'file';
    fileUploadInput.accept = 'audio/*';
    fileUploadInput.style.display = 'none';

    const uploadAudioBtn = document.createElement('button');
    uploadAudioBtn.className = 'button-secondary';
    uploadAudioBtn.innerHTML = '📁 Загрузить файл';
    uploadAudioBtn.type = 'button';
    uploadAudioBtn.style.marginLeft = '10px';

    startRecordBtn.parentNode.insertBefore(uploadAudioBtn, startRecordBtn.nextSibling);
    startRecordBtn.parentNode.insertBefore(fileUploadInput, uploadAudioBtn);

    uploadAudioBtn.addEventListener('click', () => fileUploadInput.click());

    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            audioBlob = file;
            audioPlayback.src = URL.createObjectURL(file);
            audioPlayback.style.display = 'block';
            processBtn.style.display = 'inline-block';
            startRecordBtn.style.display = 'none';
            uploadAudioBtn.style.display = 'none';
            rerecordBtn.style.display = 'inline-block';
            showNotification(`Аудиофайл ${file.name} готов к транскрибации.`, 'info');
        }
    });

    // 2. Предпросмотр Markdown
    const previewContainer = document.createElement('div');
    previewContainer.className = 'markdown-body scroll-area';
    previewContainer.style.cssText = 'display: none; height: 400px; overflow-y: auto; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; background-color: #f8fafc;';
    processDescriptionInput.parentNode.insertBefore(previewContainer, processDescriptionInput.nextSibling);

    const togglePreviewBtn = document.createElement('button');
    togglePreviewBtn.className = 'button-secondary';
    togglePreviewBtn.style.marginBottom = '10px';
    togglePreviewBtn.innerHTML = '👁️ Предпросмотр Markdown';
    processDescriptionInput.parentNode.insertBefore(togglePreviewBtn, processDescriptionInput);

    let isPreviewMode = false;
    togglePreviewBtn.addEventListener('click', () => {
        isPreviewMode = !isPreviewMode;
        togglePreviewBtn.innerHTML = isPreviewMode ? '✏️ Режим редактирования' : '👁️ Предпросмотр Markdown';
        processDescriptionInput.style.display = isPreviewMode ? 'none' : 'block';
        previewContainer.style.display = isPreviewMode ? 'block' : 'none';
        if (isPreviewMode) previewContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(processDescriptionInput.value || '*Пусто*') : processDescriptionInput.value;
    });

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

    // 3. Автосохранение
    let autosaveTimeout;
    processDescriptionInput.addEventListener('input', () => {
        updateStepCounter();
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => { if (chatId) localStorage.setItem(`autosave_chat_${chatId}`, processDescriptionInput.value); }, 1000);
    });
    startRecordBtn.addEventListener('click', handleStartRecording);
    stopRecordBtn.addEventListener('click', handleStopRecording);
    listenBtn.addEventListener('click', () => audioPlayback.play());
    rerecordBtn.addEventListener('click', handleRerecord);
    processBtn.addEventListener('click', handleProcessAudio);
    bindFormSubmit(userLogin, handleUserLogin);
    logoutBtn.addEventListener('click', handleLogout);
    departmentSelectionContainer.addEventListener('click', handleDepartmentCardSelection);
    bindFormSubmit(chatLogin, handleChatLogin);
    bindFormSubmit(createDepartmentForm, handleCreateDepartment);
    bindFormSubmit(createUserForm, handleCreateUser);
    usersListBody.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        if (!userId) return;
        if (e.target.classList.contains('delete-user-btn')) handleDeleteUser(userId);
        if (e.target.classList.contains('change-password-btn')) handleChangePassword(userId);
    });
    departmentList.addEventListener('click', handleAdminDepartmentSelection);
    chatList.addEventListener('click', handleAdminChatListClick);
    bindFormSubmit(createChatForm, handleCreateChat);
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
    versionHistoryContainer.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON') {
            const versionId = e.target.parentElement.dataset.versionId;
            const selectedVersion = chatVersions.find(v => v.id == versionId);
            if (selectedVersion) {
                versionHistoryContainer.querySelectorAll('.version-item').forEach(el => {
                    el.style.borderLeft = '4px solid transparent';
                    el.style.backgroundColor = 'transparent';
                });
                e.target.parentElement.style.borderLeft = '4px solid #3b82f6';
                e.target.parentElement.style.backgroundColor = '#eff6ff';
                await displayVersion(selectedVersion);
            }
        }
    });
    downloadBpmnBtn.addEventListener('click', downloadCurrentBpmnXml);
    downloadPngBtn.addEventListener('click', () => downloadCurrentDiagram('png'));
    downloadSvgBtn.addEventListener('click', () => downloadCurrentDiagram('svg'));
    downloadVsdxBtn.addEventListener('click', downloadCurrentVsd);

    renderDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    regenerateDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    zoomInBtn.addEventListener('click', () => {
        zoomActiveDiagram(1.25);
        if (diagramContainer) diagramContainer.style.overflow = 'auto';
    });
    zoomOutBtn.addEventListener('click', () => {
        zoomActiveDiagram(0.8);
    });

    // Fit diagram back to container
    const fitDiagramBtn = document.getElementById('fit-diagram-btn');
    if (fitDiagramBtn) {
        fitDiagramBtn.addEventListener('click', () => {
            if (diagramMode === 'edit' && bpmnViewer) {
                safelyFitBpmnViewport(bpmnViewer, diagramContainer);
                return;
            }
            if (!currentDiagramModel) return;
            const fitScale = computeFitScale();
            currentDiagramScale = fitScale;
            setLockedDiagramScale(fitScale);
            diagramContainer.style.overflow = fitScale >= 1 ? 'auto' : 'hidden';
        });
    }

    // ===== DIAGRAM OVERLAY MODAL =====
    const diagramOverlayModal  = document.getElementById('diagram-overlay-modal');
    const diagramOverlayBody   = document.getElementById('diagram-overlay-body');
    const diagramOverlayTitle  = document.getElementById('diagram-overlay-title');
    const overlayModeLabel     = document.getElementById('overlay-mode-label');
    const overlayCloseBtn      = document.getElementById('overlay-close-btn');
    const overlayZoomInBtn     = document.getElementById('overlay-zoom-in-btn');
    const overlayZoomOutBtn    = document.getElementById('overlay-zoom-out-btn');
    const overlayFitBtn        = document.getElementById('overlay-fit-btn');
    const overlayEditBtn       = document.getElementById('overlay-edit-btn');
    const overlaySaveBtn       = document.getElementById('overlay-save-btn');

    let overlayBpmnModeler = null;
    let overlayScale = 1;

    function openDiagramOverlay() {
        if (!currentDiagramXml && !currentDiagramSvg) return;

        // Set title
        const titleEl = document.querySelector('.chat-header h2, #chat-title');
        if (diagramOverlayTitle && titleEl) diagramOverlayTitle.textContent = titleEl.textContent;

        // Render current SVG in overlay body (view mode)
        if (diagramOverlayBody) {
            diagramOverlayBody.innerHTML = '';
            if (currentDiagramSvg) {
                const shell = document.createElement('div');
                shell.className = 'doc-diagram-shell';
                const stage = document.createElement('div');
                stage.className = 'doc-diagram-stage';
                stage.innerHTML = currentDiagramSvg;
                shell.appendChild(stage);
                diagramOverlayBody.appendChild(shell);
                // Auto-fit into overlay body
                requestAnimationFrame(() => {
                    const bodyW = diagramOverlayBody.clientWidth - 32;
                    const bodyH = diagramOverlayBody.clientHeight - 32;
                    const svgEl = stage.querySelector('svg');
                    if (svgEl) {
                        const svgW = parseFloat(svgEl.getAttribute('width')) || svgEl.viewBox.baseVal.width || bodyW;
                        const svgH = parseFloat(svgEl.getAttribute('height')) || svgEl.viewBox.baseVal.height || bodyH;
                        overlayScale = Math.min(bodyW / svgW, bodyH / svgH, 1);
                        stage.style.transform = `scale(${overlayScale})`;
                        stage.style.transformOrigin = 'top left';
                        stage.style.width = `${Math.round(svgW * overlayScale)}px`;
                        stage.style.height = `${Math.round(svgH * overlayScale)}px`;
                    }
                });
            }
        }

        // Show/hide admin controls
        const isAdmin = sessionUser && sessionUser.role === 'admin';
        const canEdit = isAdmin && userCanEditDiagram();
        if (overlayEditBtn) overlayEditBtn.style.display = canEdit ? 'inline-flex' : 'none';
        if (overlaySaveBtn) overlaySaveBtn.style.display = 'none'; // hidden until edit mode

        if (overlayModeLabel) {
            overlayModeLabel.textContent = 'Просмотр';
            overlayModeLabel.className = 'overlay-mode-badge';
        }

        diagramOverlayModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeDiagramOverlay() {
        // Destroy modeler if open
        if (overlayBpmnModeler) {
            try { overlayBpmnModeler.destroy(); } catch {}
            overlayBpmnModeler = null;
        }
        if (diagramOverlayBody) diagramOverlayBody.innerHTML = '';
        if (diagramOverlayModal) diagramOverlayModal.classList.add('hidden');
        document.body.style.overflow = '';
        if (overlayModeLabel) {
            overlayModeLabel.textContent = 'Просмотр';
            overlayModeLabel.className = 'overlay-mode-badge';
        }
        if (overlaySaveBtn) overlaySaveBtn.style.display = 'none';
        if (overlayEditBtn && userCanEditDiagram()) overlayEditBtn.style.display = 'inline-flex';
    }

    async function openOverlayEditMode() {
        if (!currentDiagramXml) return;
        // Ensure bpmn-js is loaded
        await loadBpmnJs();
        if (!window.BpmnJS) {
            showNotification('BPMN редактор не загружен', 'error');
            return;
        }
        // Clear view-mode content
        if (diagramOverlayBody) {
            diagramOverlayBody.innerHTML = '';
            diagramOverlayBody.style.padding = '0';

            // Create bpmn-js modeler in the overlay
            overlayBpmnModeler = new window.BpmnJS({ container: diagramOverlayBody });
            try {
                await overlayBpmnModeler.importXML(currentDiagramXml);
                const canvas = overlayBpmnModeler.get('canvas');
                canvas.zoom('fit-viewport');
            } catch (err) {
                showNotification('Не удалось открыть редактор: ' + err.message, 'error');
                closeDiagramOverlay();
                return;
            }
        }

        if (overlayModeLabel) {
            overlayModeLabel.textContent = 'Редактирование';
            overlayModeLabel.className = 'overlay-mode-badge edit-mode';
        }

        if (overlayEditBtn) overlayEditBtn.style.display = 'none';
        if (overlaySaveBtn) overlaySaveBtn.style.display = 'inline-flex';
    }

    async function saveOverlayDiagram() {
        if (!overlayBpmnModeler) return;
        try {
            setButtonLoading(overlaySaveBtn, true);
            const { xml } = await overlayBpmnModeler.saveXML({ format: true });
            const normalized = normalizeGeneratedBpmnXml(xml, false);
            // Update global state
            currentDiagramXml = normalized;
            // Save as new version
            const descEl = document.getElementById('process-description');
            const processText = descEl ? (descEl.textContent || '') : '';
            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: processText, mermaid_code: normalized })
            });
            showNotification('Координаты сохранены как новая версия', 'success');
            closeDiagramOverlay();
            // Re-render with updated XML
            renderLockedDiagramView(normalized);
        } catch (err) {
            showNotification('Ошибка сохранения: ' + err.message, 'error');
        } finally {
            setButtonLoading(overlaySaveBtn, false);
        }
    }

    // Wire overlay buttons
    const fullscreenDiagramBtn = document.getElementById('fullscreen-diagram-btn');
    if (fullscreenDiagramBtn) {
        fullscreenDiagramBtn.addEventListener('click', openDiagramOverlay);
    }
    if (overlayCloseBtn) overlayCloseBtn.addEventListener('click', closeDiagramOverlay);
    if (overlayEditBtn) overlayEditBtn.addEventListener('click', openOverlayEditMode);
    if (overlaySaveBtn) overlaySaveBtn.addEventListener('click', saveOverlayDiagram);

    if (overlayZoomInBtn) {
        overlayZoomInBtn.addEventListener('click', () => {
            if (overlayBpmnModeler) {
                const canvas = overlayBpmnModeler.get('canvas');
                canvas.zoom(canvas.zoom() * 1.2);
            } else {
                const stage = diagramOverlayBody?.querySelector('.doc-diagram-stage');
                if (!stage) return;
                overlayScale = Math.min(overlayScale * 1.2, 4);
                stage.style.transform = `scale(${overlayScale})`;
            }
        });
    }

    if (overlayZoomOutBtn) {
        overlayZoomOutBtn.addEventListener('click', () => {
            if (overlayBpmnModeler) {
                const canvas = overlayBpmnModeler.get('canvas');
                canvas.zoom(canvas.zoom() * 0.8);
            } else {
                const stage = diagramOverlayBody?.querySelector('.doc-diagram-stage');
                if (!stage) return;
                overlayScale = Math.max(overlayScale * 0.8, 0.1);
                stage.style.transform = `scale(${overlayScale})`;
            }
        });
    }

    if (overlayFitBtn) {
        overlayFitBtn.addEventListener('click', () => {
            if (overlayBpmnModeler) {
                overlayBpmnModeler.get('canvas').zoom('fit-viewport');
            } else {
                const stage = diagramOverlayBody?.querySelector('.doc-diagram-stage');
                const svgEl = stage?.querySelector('svg');
                if (!stage || !svgEl) return;
                const bodyW = diagramOverlayBody.clientWidth - 32;
                const bodyH = diagramOverlayBody.clientHeight - 32;
                const svgW = parseFloat(svgEl.getAttribute('width')) || bodyW;
                const svgH = parseFloat(svgEl.getAttribute('height')) || bodyH;
                overlayScale = Math.min(bodyW / svgW, bodyH / svgH, 1);
                stage.style.transform = `scale(${overlayScale})`;
            }
        });
    }

    // Close overlay on backdrop click
    if (diagramOverlayModal) {
        diagramOverlayModal.querySelector('.diagram-overlay-backdrop')?.addEventListener('click', closeDiagramOverlay);
    }

    // Close on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && diagramOverlayModal && !diagramOverlayModal.classList.contains('hidden')) {
            closeDiagramOverlay();
        }
    });


    editDiagramBtn.addEventListener('click', openInlineDiagramEditor);
    cancelMermaidEditBtn.addEventListener('click', cancelInlineDiagramEdit);
    saveMermaidChangesBtn.addEventListener('click', saveInlineDiagramEdit);

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
    const adminMapRootLabel = 'Бизнес-процессы\nCentras Insurance';

    async function loadProcessMap() {
        if (!document.getElementById('cy')) return;
        try {
            const res = await fetchWithAuth(`/api/admin/map?t=${Date.now()}`, { cache: 'no-store' });
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
                data: { id: 'root_centras', name: adminMapRootLabel, type: 'root' },
                classes: 'root-node'
            });

            departments.forEach(dept => {
                elements.push({
                    data: { id: `dept_${dept.id}`, name: dept.name, type: 'department', collapsed: false, rawName: dept.name },
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
                        name: proc.name,
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
                        name: chat.name,
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
                                'line-height': 1.15,
                                'font-family': '"Manrope", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
                            }
                        },
                        {
                            selector: 'node.root-node',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#0f172a',
                                'color': '#ffffff',
                                'width': 260,
                                'height': 82,
                                'font-weight': 'bold',
                                'font-size': 16,
                                'padding': '16px',
                                'text-max-width': 240,
                                'border-width': 0
                            }
                        },
                        {
                            selector: 'node.department',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#2563eb',
                                'color': '#ffffff',
                                'width': 232,
                                'height': 76,
                                'font-weight': '600',
                                'font-size': 12,
                                'padding': '14px',
                                'text-max-width': 212,
                                'border-width': 0,
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
                                'border-width': 1,
                                'border-color': '#cbd5e1',
                                'color': '#1e293b',
                                'width': 208,
                                'height': 70,
                                'text-max-width': 188,
                                'font-size': 11,
                                'font-weight': '500',
                                'padding': '10px 14px'
                            }
                        },
                        {
                            selector: 'node.chat',
                            style: {
                                'label': 'data(name)',
                                'shape': 'round-rectangle',
                                'background-color': '#f8fafc',
                                'border-width': 2,
                                'border-style': 'dashed',
                                'border-color': '#94a3b8',
                                'color': '#475569',
                                'width': 176,
                                'height': 58,
                                'text-max-width': 156,
                                'font-size': 11,
                                'padding': '8px 12px'
                            }
                        },
                        { selector: 'node.status-approved', style: { 'border-width': 2, 'border-color': '#10b981', 'background-color': '#f0fdf4' } },
                        { selector: 'node.status-draft', style: { 'border-width': 2, 'border-color': '#f59e0b', 'background-color': '#fffbeb' } },
                        { selector: 'node.status-needs_revision', style: { 'border-width': 2, 'border-color': '#ef4444', 'background-color': '#fef2f2' } },
                        { selector: 'node.status-pending_review', style: { 'border-width': 2, 'border-color': '#3b82f6', 'background-color': '#eff6ff' } },
                        {
                            selector: 'edge',
                            style: {
                                'curve-style': 'bezier',
                                'target-arrow-shape': 'triangle',
                                'target-arrow-color': '#cbd5e1',
                                'line-color': '#e2e8f0',
                                'width': 2,
                                'text-background-opacity': 1,
                                'text-background-color': '#ffffff',
                                'text-background-padding': 3
                            }
                        },
                        {
                            selector: 'edge[label]',
                            style: {
                                'label': 'data(label)',
                                'font-size': 10,
                                'color': '#64748b',
                                'text-background-opacity': 1,
                                'text-background-color': '#ffffff',
                                'text-background-padding': 3
                            }
                        },
                        {
                            selector: 'edge.root-edge',
                            style: {
                                'line-color': '#94a3b8',
                                'width': 3,
                                'curve-style': 'taxi',
                                'taxi-direction': 'vertical',
                                'taxi-turn': 20,
                                'target-arrow-shape': 'none'
                            }
                        },
                        {
                            selector: 'edge.dept-edge',
                            style: {
                                'line-color': '#cbd5e1',
                                'target-arrow-color': '#cbd5e1',
                                'width': 1.5,
                                'curve-style': 'taxi',
                                'taxi-direction': 'vertical',
                                'line-style': 'solid',
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
                        name: elements.some(e => e.position) ? 'preset' : 'klay',
                        nodeDimensionsIncludeLabels: true,
                        klay: {
                            direction: 'DOWN',
                            spacing: 50,
                            edgeSpacingFactor: 1.0,
                            inLayerSpacingFactor: 1.0,
                            thoroughness: 10,
                            compactComponents: true
                        },
                        padding: 50,
                        fit: true
                    }
                });

                // --- ВСПЛЫВАЮЩЕЕ ОКНО (TOOLTIP) ДЛЯ ДЕПАРТАМЕНТОВ ---
                let tooltip = document.getElementById('cy-tooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'cy-tooltip';
                    document.body.appendChild(tooltip);
                }

                cy.on('mouseover', 'node.department', function (e) {
                    const node = e.target;
                    const outgoers = node.outgoers('node');
                    let processes = 0, chats = 0;
                    let stats = { approved: 0, draft: 0, needs_revision: 0, pending_review: 0 };

                    outgoers.forEach(n => {
                        if (n.hasClass('process')) processes++;
                        if (n.hasClass('chat')) chats++;
                        const st = n.data('status');
                        if (stats[st] !== undefined) stats[st]++;
                        else if (st === 'completed') stats['approved']++; // or track separately if needed
                    });

                    tooltip.innerHTML = `<strong>${node.data('rawName')}</strong>\n\n<b>Всего процессов:</b> ${processes}\n<b>Всего чатов:</b> ${chats}\n\nУтвержденных: ${stats.approved}\nЧерновиков: ${stats.draft}\nНа проверке: ${stats.pending_review}\nНужны правки: ${stats.needs_revision}\nЗавершенных: ${stats.completed || 0}`;
                    tooltip.style.display = 'block';
                });
                cy.on('mousemove', 'node.department', function (e) {
                    tooltip.style.left = (e.originalEvent.pageX + 15) + 'px';
                    tooltip.style.top = (e.originalEvent.pageY + 15) + 'px';
                });
                cy.on('mouseout', 'node.department', function () {
                    tooltip.style.display = 'none';
                });

                const toggleChatsMapBtn = document.createElement('button');
                toggleChatsMapBtn.id = 'cy-toggle-chats';
                toggleChatsMapBtn.className = 'button-secondary';
                toggleChatsMapBtn.innerText = '👁️ Скрыть чаты';
                document.querySelector('.map-controls').appendChild(toggleChatsMapBtn);

                let chatsVisible = true;
                toggleChatsMapBtn.onclick = () => {
                    chatsVisible = !chatsVisible;
                    toggleChatsMapBtn.innerText = chatsVisible ? '👁️ Скрыть чаты' : '👁️ Показать чаты';
                    if (cy) {
                        cy.elements('.chat').style('display', chatsVisible ? 'element' : 'none');
                        cy.elements('.chat-edge').style('display', chatsVisible ? 'element' : 'none');
                    }
                };

                const searchInput = document.getElementById('admin-map-search');
                if (searchInput) {
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
                        cy.edges().style('opacity', 0.15);
                    });
                }

                let exportPngBtn = document.getElementById('cy-export-png');
                if (!exportPngBtn) {
                    exportPngBtn = document.createElement('button');
                    exportPngBtn.id = 'cy-export-png';
                    exportPngBtn.className = 'button-secondary';
                    exportPngBtn.innerHTML = '🖼️ Экспорт PNG';
                    document.querySelector('.map-controls').appendChild(exportPngBtn);

                    exportPngBtn.onclick = () => {
                        const png64 = cy.png({ bg: '#f8fafc', full: true, scale: 2 });
                        const a = document.createElement('a');
                        a.href = png64;
                        a.download = 'Карта_Процессов.png';
                        a.click();
                    };
                }

                let shareBoardBtn = document.getElementById('cy-share-board');
                if (!shareBoardBtn) {
                    shareBoardBtn = document.createElement('button');
                    shareBoardBtn.id = 'cy-share-board';
                    shareBoardBtn.className = 'button-primary';
                    shareBoardBtn.innerHTML = '🔗 Поделиться дашбордом';
                    document.querySelector('.map-controls').appendChild(shareBoardBtn);

                    shareBoardBtn.onclick = () => {
                        const shareUrl = window.location.origin + '/dash';
                        navigator.clipboard.writeText(shareUrl).then(() => showNotification('Ссылка на дашборд скопирована!', 'success'));
                        window.open(shareUrl, '_blank');
                    };
                }

                const toggleCollapseBtn = document.getElementById('btn-toggle-collapse');
                if (toggleCollapseBtn) {
                    let isAllCollapsed = false;
                    toggleCollapseBtn.onclick = () => {
                        isAllCollapsed = !isAllCollapsed;
                        toggleCollapseBtn.innerText = isAllCollapsed ? 'Развернуть все' : 'Свернуть все';
                        if (cy) {
                            cy.nodes('.department').forEach(deptNode => {
                                const outEdges = deptNode.outgoers('edge.dept-edge');
                                const childNodes = outEdges.targets();
                                childNodes.style('display', isAllCollapsed ? 'none' : 'element');
                                outEdges.style('display', isAllCollapsed ? 'none' : 'element');
                                deptNode.data('collapsed', isAllCollapsed);
                                deptNode.style('opacity', isAllCollapsed ? 0.6 : 1);
                            });
                        }
                    };
                }

                // --- ИИ-оценка связей ---
                let aiLinkBtn = document.getElementById('cy-ai-link-btn');
                let toggleAiLinksBtn = document.getElementById('cy-toggle-ai-links');

                if (!aiLinkBtn) {
                    aiLinkBtn = document.createElement('button');
                    aiLinkBtn.id = 'cy-ai-link-btn';
                    aiLinkBtn.className = 'button-primary';
                    aiLinkBtn.innerHTML = '🧠 Связать процессы (ИИ)';
                    document.querySelector('.map-controls').appendChild(aiLinkBtn);

                    toggleAiLinksBtn = document.createElement('button');
                    toggleAiLinksBtn.id = 'cy-toggle-ai-links';
                    toggleAiLinksBtn.className = 'button-secondary';
                    toggleAiLinksBtn.style.display = 'none';
                    toggleAiLinksBtn.innerHTML = '👁️ Скрыть связи ИИ';
                    document.querySelector('.map-controls').appendChild(toggleAiLinksBtn);

                    aiLinkBtn.onclick = async () => {
                        const nodes = cy.nodes('.process');
                        if (nodes.length < 2) return showNotification('Недостаточно процессов для анализа', 'error');

                        setButtonLoading(aiLinkBtn, true, 'Анализ...');
                        const processesData = nodes.map(n => ({ 
                            id: n.id(), 
                            name: n.data('rawName'), 
                            desc: n.data('description') 
                        }));

                        const prompt = `Ты — бизнес-архитектор. Проанализируй этот список процессов и найди логические связи (кто кому передает данные, кто за кем следует). 
Верни СТРОГО JSON-массив объектов: [{"source": "id_источника", "target": "id_цели", "reason": "краткое описание связи"}]. Не пиши markdown, только голый JSON.
Если связей нет, верни пустой массив [].
Процессы: ${JSON.stringify(processesData)}`;

                        try {
                            const res = await callGeminiAPI(prompt);
                            // Более надежное извлечение JSON (поддерживает и пустые массивы, и markdown-обертки)
                            const jsonMatch = res.match(/\[\s*([\s\S]*)\s*\]/);
                            if (!jsonMatch) throw new Error("Could not find JSON array in AI response");
                            
                            const links = JSON.parse(jsonMatch[0]);
                            if (!Array.isArray(links)) throw new Error("AI response is not an array");

                            if (links.length === 0) {
                                showNotification('ИИ не нашел новых логических связей', 'info');
                                return;
                            }

                            let addedCount = 0;
                            let savedCount = 0;
                            const processedIds = new Set();
                            const savePromises = [];

                            for (const link of links) {
                                if (!link.source || !link.target || link.source === link.target) continue;

                                const edgeId = `ai_rel_${link.source}_${link.target}`;
                                if (processedIds.has(edgeId)) continue;
                                processedIds.add(edgeId);

                                const sourceNode = cy.getElementById(link.source);
                                const targetNode = cy.getElementById(link.target);

                                if (sourceNode.length && targetNode.length) {
                                    // Добавляем на карту, если еще нет
                                    if (cy.getElementById(edgeId).length === 0) {
                                        cy.add({
                                            data: { 
                                                id: edgeId, 
                                                source: link.source, 
                                                target: link.target, 
                                                label: link.reason || '' 
                                            },
                                            classes: 'ai-relation'
                                        });
                                        addedCount++;

                                        // Сохраняем связь в БД, чтобы она оставалась на карте после перезагрузки.
                                        const sourceId = link.source.replace('proc_', '');
                                        const targetId = link.target.replace('proc_', '');
                                        
                                        savePromises.push(
                                            fetchWithAuth('/api/admin/relations', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    source_process_id: sourceId,
                                                    target_process_id: targetId,
                                                    relation_type: link.reason || 'AI Link'
                                                })
                                            }).then(r => { if(r.ok) savedCount++; })
                                        );
                                    }
                                }
                            }

                            if (savePromises.length > 0) {
                                await Promise.all(savePromises);
                            }

                            if (addedCount > 0) {
                                showNotification(`ИИ нашел и сохранил ${addedCount} новых связей!`, 'success');
                                toggleAiLinksBtn.style.display = 'inline-block';
                            } else {
                                showNotification('Новых связей не найдено (все уже есть на карте)', 'info');
                            }

                        } catch (e) {
                            console.error('AI Link Error:', e);
                            showNotification('Ошибка анализа: ' + e.message, 'error');
                        } finally {
                            setButtonLoading(aiLinkBtn, false, '🧠 Связать процессы (ИИ)');
                        }
                    };

                    let aiLinksVisible = true;
                    toggleAiLinksBtn.onclick = () => {
                        aiLinksVisible = !aiLinksVisible;
                        toggleAiLinksBtn.innerHTML = aiLinksVisible ? '👁️ Скрыть связи ИИ' : '👁️ Показать связи ИИ';
                        cy.edges().filter(e => !e.hasClass('root-edge') && !e.hasClass('dept-edge') && !e.hasClass('chat-edge')).style('display', aiLinksVisible ? 'element' : 'none');
                    };
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

                // UX: меняем курсор при наведении на элементы
                cy.on('mouseover', 'node', () => document.body.style.cursor = 'pointer');
                cy.on('mouseout', 'node', () => document.body.style.cursor = 'default');

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
                        btn.innerText = 'ИИ рассчитывает...';
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
                                showNotification('ИИ-макет применен', 'success');
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

                const saveMapBtn = document.getElementById('save-map-btn');
                if (saveMapBtn) {
                    saveMapBtn.onclick = async () => {
                        setButtonLoading(saveMapBtn, true, 'Сохранение...');
                        try {
                            const departments = [];
                            const processes = [];
                            const chats = [];

                            cy.nodes('.department, .process, .chat').forEach(node => {
                                const pos = node.position();
                                if (node.hasClass('department')) {
                                    departments.push({ id: node.id().replace('dept_', ''), x: pos.x, y: pos.y });
                                } else if (node.hasClass('process')) {
                                    processes.push({ id: node.id().replace('proc_', ''), x: pos.x, y: pos.y });
                                } else if (node.hasClass('chat')) {
                                    chats.push({ id: node.id().replace('chat_', ''), x: pos.x, y: pos.y });
                                }
                            });

                            const res = await fetchWithAuth('/api/admin/map/positions/bulk', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ departments, processes, chats })
                            });

                            if (res.ok) {
                                showNotification('Координаты всей карты успешно сохранены', 'success');
                            } else {
                                showNotification('Ошибка при сохранении карты', 'error');
                            }
                        } catch (e) {
                            showNotification('Ошибка связи: ' + e.message, 'error');
                        } finally {
                            setButtonLoading(saveMapBtn, false);
                        }
                    };
                }

                const autoLayoutBtn = document.getElementById('auto-layout-btn');
                if (autoLayoutBtn) {
                    autoLayoutBtn.onclick = async () => {
                        if (confirm('Выровнять все департаменты по горизонтали, а их процессы СТРОГО вертикально вниз? (Текущие координаты будут перезаписаны)')) {
                            // Кастомный алгоритм идеальной иерархии
                            const depts = cy.nodes('.department').sort((a, b) => (a.data('rawName') || '').localeCompare(b.data('rawName') || ''));
                            const root = cy.getElementById('root_centras');

                            const spacingX = 300; // Отступ между колонками департаментов
                            const startY = 130;   // Y координата департаментов
                            const spacingY = 150;  // Шаг по вертикали, чтобы между узлами читались связи

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

                            // Сохраняем новые координаты в БД единым запросом
                            const departments = [];
                            const processes = [];
                            const chats = [];

                            cy.nodes('.department, .process, .chat').forEach(node => {
                                const pos = node.position();
                                if (node.hasClass('department')) {
                                    departments.push({ id: node.id().replace('dept_', ''), x: pos.x, y: pos.y });
                                } else if (node.hasClass('process')) {
                                    processes.push({ id: node.id().replace('proc_', ''), x: pos.x, y: pos.y });
                                } else if (node.hasClass('chat')) {
                                    chats.push({ id: node.id().replace('chat_', ''), x: pos.x, y: pos.y });
                                }
                            });

                            const res = await fetchWithAuth('/api/admin/map/positions/bulk', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ departments, processes, chats })
                            });

                            if (res.ok) {
                                showNotification('Авто-выравнивание и сохранение завершено', 'success');
                            } else {
                                showNotification('Ошибка при сохранении автоматического макета', 'error');
                            }
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

                const openSidePanel = async (nodeData) => {
                    const panel = document.getElementById('cy-side-panel');
                    const content = document.getElementById('panel-content');
                    const isChat = nodeData.type === 'chat';
                    const isApproved = nodeData.status === 'approved';
                    const statusClass = isApproved ? 'status-approved' : 'status-draft';
                    const statusText = isApproved ? 'Одобрен' : (statusMap[nodeData.status]?.text || 'Черновик');

                    let descText = nodeData.description;
                    if (isChat) {
                        try {
                            const res = await fetchWithAuth(`/api/chats/${nodeData.id.replace('chat_', '')}/versions`);
                            if (res.ok) {
                                const versions = await res.json();
                                if (versions.length > 0) descText = versions[0].process_text;
                            }
                        } catch (e) { console.error('Error fetching chat versions'); }
                    }

                    let descHtml = marked.parse(descText || 'Описание отсутствует');

                    let html = `
                        <div style="margin-bottom: 15px;">
                            <strong>Название:</strong><br>
                            <input type="text" id="panel-proc-name" value="${nodeData.rawName || nodeData.name}" style="width: 100%; padding: 5px;" disabled>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Тип:</strong> ${isChat ? 'Чат' : 'Процесс'}
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Статус:</strong> <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        ${!isChat ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Владелец:</strong><br>
                            <span>${nodeData.owner || 'Не назначен'}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Цель:</strong><br>
                            <p>${nodeData.goal || 'Цель не указана'}</p>
                        </div>
                        ` : ''}
                        <div style="margin-bottom: 15px;">
                            <strong>Описание:</strong><br>
                            <div class="markdown-body scroll-area" style="max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 4px;">
                                ${descHtml}
                            </div>
                        </div>
                        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
                            ${isChat ? `<button id="panel-go-chat" class="button-primary">Перейти в чат</button>` : ''}
                            ${!isChat
                            ? `<button id="panel-delete" class="button-danger">Удалить процесс</button>`
                            : `<button id="panel-delete-chat" class="button-danger">Удалить чат</button>`}
                        </div>
                    `;
                    content.innerHTML = html;
                    panel.style.display = 'block';

                    if (isChat) {
                        document.getElementById('panel-go-chat').onclick = () => {
                            panel.style.display = 'none';
                            chatId = nodeData.id.replace('chat_', '');
                            selectedDepartment = { name: 'Карта Процессов' };
                            showMainApp(nodeData.rawName || nodeData.name);
                        };
                    }

                    if (!isChat) {
                        document.getElementById('panel-delete').onclick = async () => {
                            if (confirm(`Удалить процесс "${nodeData.rawName || nodeData.name}"?`)) {
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
                    } else {
                        document.getElementById('panel-delete-chat').onclick = async () => {
                            if (confirm(`Удалить чат "${nodeData.rawName || nodeData.name}"?`)) {
                                try {
                                    const res = await fetchWithAuth(`/api/chats/${nodeData.id.replace('chat_', '')}`, { method: 'DELETE' });
                                    if (res.ok) {
                                        showNotification('Чат удален', 'success');
                                        panel.style.display = 'none';
                                        loadProcessMap();
                                    }
                                } catch (e) {
                                    showNotification('Ошибка', 'error');
                                }
                            }
                        };
                    }
                };

                cy.on('tap', 'node.process, node.chat', function (evt) {
                    openSidePanel(evt.target.data());
                });

                // Context menu for background (create department)
                const contextMenu = document.getElementById('cy-context-menu');
                cy.on('cxttap', function (event) {
                    if (event.target === cy) {
                        contextMenu.style.display = 'block';
                        contextMenu.style.left = event.renderedPosition.x + 'px';
                        contextMenu.style.top = event.renderedPosition.y + 'px';
                        contextMenu.innerHTML = `<button id="ctx-add-dept" class="context-menu-action">➕ Добавить департамент</button>`;

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
                    name: elements.some(e => e.position) ? 'preset' : 'klay',
                    nodeDimensionsIncludeLabels: true,
                    klay: {
                        direction: 'DOWN',
                        spacing: 50,
                        edgeSpacingFactor: 1.0,
                        inLayerSpacingFactor: 1.0,
                        thoroughness: 10,
                        compactComponents: true
                    },
                    padding: 50,
                    fit: true
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
        hideSection(adminViewUsers);
        hideSection(adminViewMap);
        // Remove active from all tabs
        [adminTabUsers, adminTabMap].forEach(t => {
            if (t) t.classList.remove('active');
        });

        if (targetTab === 'users') {
            showSection(adminViewUsers);
            if (adminTabUsers) adminTabUsers.classList.add('active');
        } else if (targetTab === 'map') {
            showSection(adminViewMap);
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
            massUploadStatus.innerText = 'Этап 1: извлечение текста и ИИ-анализ. Ожидайте.';
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
