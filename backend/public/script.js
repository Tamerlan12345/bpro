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

    const editDiagramBtn = document.getElementById('edit-diagram-btn');
    const saveMermaidChangesBtn = document.getElementById('save-mermaid-changes-btn');
    const cancelMermaidEditBtn = document.getElementById('cancel-mermaid-edit-btn');

    const notificationContainer = document.getElementById('notification-container');

    // Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ СЃС‚РёР»Рё РґР»СЏ С„РёРєСЃР° "СЃСЉРµРґР°РЅРёСЏ" С‚РµРєСЃС‚Р° РІ РєРЅРѕРїРєР°С… С‚СѓР»Р±Р°СЂРѕРІ
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
        /* Sequence flow labels (РґР°/РЅРµС‚): bigger, visible */
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

    function setButtonLoading(button, isLoading, loadingText = 'Р—Р°РіСЂСѓР·РєР°...') {
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
                reject(new Error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р±РёР±Р»РёРѕС‚РµРєСѓ BPMN. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ.'));
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
        currentDiagramScale = Number(Math.max(0.5, Math.min(scale, 2.4)).toFixed(2));
        stage.style.transform = `scale(${currentDiagramScale})`;
        stage.style.width = `${Math.round((currentDiagramModel?.viewBox?.width || stage.offsetWidth) * currentDiagramScale)}px`;
        stage.style.height = `${Math.round((currentDiagramModel?.viewBox?.height || stage.offsetHeight) * currentDiagramScale)}px`;
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
        currentDiagramScale = 1;
        setLockedDiagramScale(1);
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
                    updateDiagramToolbarState();
                }
            } else {
                diagramContainer.innerHTML = `<div class="error-text">Rendering still failed after repair: ${error.message}</div>`;
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
        bpmnModeler = new window.BpmnJS({ container: diagramContainer, keyboard: { bindTo: document } });
        bpmnViewer = bpmnModeler;

        try {
            await bpmnModeler.importXML(currentDiagramXml);
            safelyFitBpmnViewport(bpmnModeler, diagramContainer);
        } catch (error) {
            console.error(error);
            showNotification(`Failed to open the diagram editor: ${error.message}`, 'error');
            diagramMode = 'view';
            renderLockedDiagramView(editingBaselineDiagramXml || currentDiagramXml);
            return;
        }

        updateDiagramToolbarState();
    }

    function cancelInlineDiagramEdit() {
        if (diagramMode !== 'edit') return;
        renderLockedDiagramView(editingBaselineDiagramXml || currentDiagramXml || getEmptyBpmnTemplate());
    }

    async function saveInlineDiagramEdit() {
        const process_text = processDescriptionInput.value;

        setButtonLoading(saveMermaidChangesBtn, true, 'Saving...');
        try {
            const xml = await getCurrentDiagramXml();

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text, mermaid_code: xml })
            });
            currentDiagramXml = xml;
            editingBaselineDiagramXml = xml;
            showNotification('Diagram changes were saved successfully.', 'success');
            await loadChatData();
        } catch (error) {
            showNotification(`Failed to save the diagram: ${error.message}`, 'error');
        } finally {
            setButtonLoading(saveMermaidChangesBtn, false);
        }
    }

    function zoomActiveDiagram(factor) {
        if (diagramMode === 'edit' && bpmnViewer) {
            const canvas = bpmnViewer.get('canvas');
            canvas.zoom(canvas.zoom() * factor);
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

    async function downloadCurrentVsdx() {
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
        //    completely empty (no targetRef/sourceRef content) вЂ“ they cause parse errors.
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

        return xml;
    }

    function normalizeGeneratedBpmnXml(xml) {
        if (typeof xml !== 'string') {
            return xml;
        }

        xml = extractPureBpmnXml(xml);
        xml = sanitizeBpmnXml(xml);

        if (typeof normalizeBpmnVerticalLayout !== 'function') {
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
        const prompt = `РўС‹ вЂ” СЌР»РёС‚РЅС‹Р№ Р±РёР·РЅРµСЃ-Р°РЅР°Р»РёС‚РёРє Рё СЌРєСЃРїРµСЂС‚ РїРѕ BPMN. РўРІРѕСЏ Р·Р°РґР°С‡Р° вЂ” РІР·СЏС‚СЊ СЃС‹СЂРѕРµ РѕРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР° РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РїСЂРµРІСЂР°С‚РёС‚СЊ РµРіРѕ РІ РґРІР° Р°СЂС‚РµС„Р°РєС‚Р°:
1.  РЎС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅРѕРµ РѕРїРёСЃР°РЅРёРµ С€Р°РіРѕРІ Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃР° РІ С„РѕСЂРјР°С‚Рµ Markdown.
2.  РљРѕРґ РґРёР°РіСЂР°РјРјС‹ РІ СЃС‚СЂРѕРіРѕРј СЃС‚Р°РЅРґР°СЂС‚Рµ BPMN 2.0 XML (РЅР° РѕСЃРЅРѕРІРµ РєРѕС‚РѕСЂРѕРіРѕ Р±СѓРґРµС‚ СЃС‚СЂРѕРёС‚СЊСЃСЏ РІРёР·СѓР°Р»СЊРЅР°СЏ СЃС…РµРјР°).

РўС‹ РґРѕР»Р¶РµРЅ РЎРўР РћР“Рћ СЃР»РµРґРѕРІР°С‚СЊ СЌС‚РёРј РїСЂР°РІРёР»Р°Рј:

### РџР РђР’РР›Рђ Р”Р›РЇ РўР•РљРЎРўРћР’РћР“Рћ РћРџРРЎРђРќРРЇ:
РСЃРїРѕР»СЊР·СѓР№ СЃР»РµРґСѓСЋС‰РёР№ С€Р°Р±Р»РѕРЅ Markdown, РґРѕРґСѓРјС‹РІР°СЏ РЅРµРґРѕСЃС‚Р°СЋС‰РёРµ РґРµС‚Р°Р»Рё РЅР° РѕСЃРЅРѕРІРµ РєРѕРЅС‚РµРєСЃС‚Р°:

\`\`\`markdown
### 4. РќР°С‡Р°Р»СЊРЅРѕРµ СЃРѕР±С‹С‚РёРµ (РўСЂРёРіРіРµСЂ):
[Р§С‚Рѕ Р·Р°РїСѓСЃРєР°РµС‚ РїСЂРѕС†РµСЃСЃ]

### 5. РџРѕС€Р°РіРѕРІРѕРµ РѕРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР°:
* **РЁР°Рі [РќРѕРјРµСЂ]. [РќР°Р·РІР°РЅРёРµ С€Р°РіР°]**
    * **Р”РµР№СЃС‚РІРёРµ:** [РћРїРёСЃР°РЅРёРµ РґРµР№СЃС‚РІРёСЏ]
    * **РСЃРїРѕР»РЅРёС‚РµР»СЊ:** [Р РѕР»СЊ, РµСЃР»Рё РјРѕР¶РЅРѕ РѕРїСЂРµРґРµР»РёС‚СЊ РёР· РєРѕРЅС‚РµРєСЃС‚Р°]
    * **РЈСЃР»РѕРІРёСЏ/РџРµСЂРµС…РѕРґ:** [РћРїРёСЃР°РЅРёРµ Р»РѕРіРёРєРё РїРµСЂРµС…РѕРґР° РёР»Рё РІРµС‚РІР»РµРЅРёСЏ]

### 6. Р—Р°РІРµСЂС€Р°СЋС‰РµРµ СЃРѕР±С‹С‚РёРµ Рё СЂРµР·СѓР»СЊС‚Р°С‚С‹:
[Р§РµРј Р·Р°РєР°РЅС‡РёРІР°РµС‚СЃСЏ РїСЂРѕС†РµСЃСЃ Рё РєР°РєРёРµ Сѓ РЅРµРіРѕ РёСЃС…РѕРґС‹]
\`\`\`

**Р’РђР–РќРћ:** Р•СЃР»Рё РІРѕ РІС…РѕРґРЅС‹С… РґР°РЅРЅС‹С… РїСЂРёСЃСѓС‚СЃС‚РІСѓРµС‚ СЃРµРєС†РёСЏ \`### РџСЂРµРґР»РѕР¶РµРЅРёСЏ РїРѕ СѓР»СѓС‡С€РµРЅРёСЋ:\`, С‚С‹ РґРѕР»Р¶РµРЅ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїРµСЂРµС‡РёСЃР»РµРЅРЅС‹Рµ РІ РЅРµР№ РїСѓРЅРєС‚С‹ РєР°Рє РїСЂСЏРјРѕРµ СЂСѓРєРѕРІРѕРґСЃС‚РІРѕ РґР»СЏ СѓР»СѓС‡С€РµРЅРёСЏ Рё РїРµСЂРµРїРёСЃС‹РІР°РЅРёСЏ РѕСЃРЅРѕРІРЅРѕРіРѕ РѕРїРёСЃР°РЅРёСЏ РїСЂРѕС†РµСЃСЃР°. РРЅС‚РµРіСЂРёСЂСѓР№ СЌС‚Рё СѓР»СѓС‡С€РµРЅРёСЏ РІ РёС‚РѕРіРѕРІС‹Р№ \`standardDescription\`. РЎР°РјСѓ СЃРµРєС†РёСЋ \`### РџСЂРµРґР»РѕР¶РµРЅРёСЏ РїРѕ СѓР»СѓС‡С€РµРЅРёСЋ:\` РІ СЃРІРѕР№ С„РёРЅР°Р»СЊРЅС‹Р№ РѕС‚РІРµС‚ РІРєР»СЋС‡Р°С‚СЊ РќР• РќРЈР–РќРћ.

### РџР РђР’РР›Рђ Р”Р›РЇ BPMN 2.0 XML:
- Р’РµСЂРЅРё РІР°Р»РёРґРЅС‹Р№, РєРѕСЂСЂРµРєС‚РЅС‹Р№ Рё РїРѕР»РЅС‹Р№ XML РґРѕРєСѓРјРµРЅС‚.
- РћР±СЏР·Р°С‚РµР»СЊРЅРѕ РІРєР»СЋС‡Рё Р±Р»РѕРє <bpmndi:BPMNDiagram> Рё <bpmndi:BPMNPlane>.
- Р”Р»СЏ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р° (task, startEvent, endEvent, gateway) Рё РґР»СЏ РєР°Р¶РґРѕР№ СЃРІСЏР·Рё (sequenceFlow) Р”РћР›Р–РќР« Р±С‹С‚СЊ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅС‹ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёРµ СЌР»РµРјРµРЅС‚С‹ DI (BPMNShape СЃ dc:Bounds Рё BPMNEdge СЃ di:waypoint) СЃ РјР°С‚РµРјР°С‚РёС‡РµСЃРєРё РєРѕСЂСЂРµРєС‚РЅС‹РјРё РєРѕРѕСЂРґРёРЅР°С‚Р°РјРё X Рё Y.
- Р’РђР–РќРћ: РљРѕРѕСЂРґРёРЅР°С‚С‹ СЌР»РµРјРµРЅС‚РѕРІ РІС‹СЃС‚Р°РІР»СЏР№ РїСЂРёР±Р»РёР·РёС‚РµР»СЊРЅРѕ СЃРІРµСЂС…Сѓ РІРЅРёР· вЂ” С‚РѕС‡РЅР°СЏ СЂР°СЃРєР»Р°РґРєР° Р±СѓРґРµС‚ РІС‹РїРѕР»РЅРµРЅР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
- Р’РђР–РќРћ: РЈ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р° СЃРїРёСЃРєРё <incoming> Рё <outgoing> РґРѕР»Р¶РЅС‹ С‚РѕС‡РЅРѕ СЃРѕРѕС‚РІРµС‚СЃС‚РІРѕРІР°С‚СЊ СЂРµР°Р»СЊРЅС‹Рј <bpmn2:sequenceFlow sourceRef/targetRef>. РќРµ РґРѕРїСѓСЃРєР°Р№ СЃСЃС‹Р»РѕРє РЅР° С‡СѓР¶РёРµ РёР»Рё РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ РїРѕС‚РѕРєРё.
- Р’РђР–РќРћ: РСЃРїРѕР»СЊР·СѓР№ С‚РµРі <bpmn2:task> (РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРё) РґР»СЏ РѕСЃРЅРѕРІРЅС‹С… С€Р°РіРѕРІ РїСЂРѕС†РµСЃСЃР°. РљСЂСѓРіР°РјРё (<bpmn2:startEvent> Рё <bpmn2:endEvent>) РґРµР»Р°Р№ С‚РѕР»СЊРєРѕ РЅР°С‡Р°Р»Рѕ Рё РєРѕРЅРµС†.
- Р’РђР–РќРћ: РќРµ РёСЃРїРѕР»СЊР·СѓР№ intermediate events, boundary events Рё РґСЂСѓРіРёРµ РєСЂСѓРіРё РІРЅСѓС‚СЂРё РїСЂРѕС†РµСЃСЃР°, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЏРІРЅРѕ РЅРµ РїСЂРѕСЃРёР» СЃРѕР±С‹С‚РёРµ. Р’ С‚РёРїРѕРІРѕРј Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃРµ РєСЂСѓРіРё РґРѕРїСѓСЃС‚РёРјС‹ С‚РѕР»СЊРєРѕ РґР»СЏ РЅР°С‡Р°Р»Р° Рё Р·Р°РІРµСЂС€РµРЅРёСЏ РїСЂРѕС†РµСЃСЃР°.
- Р’РђР–РќРћ: Р РµС€РµРЅРёСЏ Рё РІРµС‚РІР»РµРЅРёСЏ Р”РћР›Р–РќР« РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РµРі <bpmn2:exclusiveGateway>.
- Р’РђР–РќРћ: РљР°Р¶РґС‹Р№ <bpmn2:exclusiveGateway> РґРѕР»Р¶РµРЅ РёРјРµС‚СЊ РєРѕСЂРѕС‚РєРёР№ РІРѕРїСЂРѕСЃ РІ Р°С‚СЂРёР±СѓС‚Рµ name, РЅР°РїСЂРёРјРµСЂ "Р”РѕРєСѓРјРµРЅС‚ РєРѕСЂСЂРµРєС‚РµРЅ?" РёР»Рё "РЎРѕРіР»Р°СЃРѕРІР°РЅРѕ?".
- Р’РђР–РќРћ: РџРѕРґРїРёСЃРё "РґР°"/"РЅРµС‚" (Р°С‚СЂРёР±СѓС‚ name) Рё СЌР»РµРјРµРЅС‚С‹ <bpmn2:conditionExpression> РјРѕРіСѓС‚ Р±С‹С‚СЊ РўРћР›Р¬РљРћ Сѓ СЃРІСЏР·РµР№ (<bpmn2:sequenceFlow>), РёСЃС…РѕРґСЏС‰РёС… РёР· С€Р»СЋР·Р° <bpmn2:exclusiveGateway>. РћР±С‹С‡РЅС‹Рµ Р·Р°РґР°С‡Рё РЅРµ РјРѕРіСѓС‚ СЃРѕРґРµСЂР¶Р°С‚СЊ СѓСЃР»РѕРІРёСЏ РїРµСЂРµС…РѕРґР°.
- Р’РђР–РќРћ: Р•СЃР»Рё Сѓ <bpmn2:exclusiveGateway> РґРІР° РёСЃС…РѕРґСЏС‰РёС… РїРѕС‚РѕРєР°, РѕРґРёРЅ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїРѕРјРµС‡РµРЅ "РґР°", РІС‚РѕСЂРѕР№ "РЅРµС‚".
- Р’РђР–РќРћ: Р•СЃР»Рё РѕРґРЅР° РІРµС‚РєР° РїРѕСЃР»Рµ gateway РІРѕР·РІСЂР°С‰Р°РµС‚ РїСЂРѕС†РµСЃСЃ РЅР° РїСЂРµРґС‹РґСѓС‰РёР№ С€Р°Рі РґР»СЏ РґРѕСЂР°Р±РѕС‚РєРё/РїРѕРІС‚РѕСЂРЅРѕРіРѕ СЃРѕРіР»Р°СЃРѕРІР°РЅРёСЏ, РїРѕРєР°Р·С‹РІР°Р№ РѕСЃРЅРѕРІРЅРѕРµ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ РїСЂРѕС†РµСЃСЃР° РїСЂСЏРјРѕ РїРѕРґ gateway, Р° РІРѕР·РІСЂР°С‚РЅСѓСЋ РІРµС‚РєСѓ СѓРІРѕРґРё РІ СЃС‚РѕСЂРѕРЅСѓ СЃ РїРѕРЅСЏС‚РЅРѕР№ СЃС‚СЂРµР»РєРѕР№ РІРѕР·РІСЂР°С‚Р°.
- Р’РђР–РќРћ: Р•СЃР»Рё РґРІРµ РІРµС‚РєРё РїРѕСЃР»Рµ gateway РїРѕС‚РѕРј СЃС…РѕРґСЏС‚СЃСЏ РІ РѕРґРёРЅ РѕР±С‰РёР№ С€Р°Рі, РїРѕРєР°Р·С‹РІР°Р№ РёС… РєР°Рє РґРІРµ РѕС‚РґРµР»СЊРЅС‹Рµ Р±РѕРєРѕРІС‹Рµ РІРµС‚РєРё, Р° РѕР±С‰РёР№ СЃР»РµРґСѓСЋС‰РёР№ С€Р°Рі СЂР°СЃРїРѕР»Р°РіР°Р№ РЅРёР¶Рµ РїРѕ С†РµРЅС‚СЂСѓ.
- Р’РђР–РќРћ: РћСЃРЅРѕРІРЅРѕР№ РїРѕС‚РѕРє СЃС‚СЂРѕР№ СЃРІРµСЂС…Сѓ РІРЅРёР·. РџРѕСЃР»Рµ gateway РІРµС‚РєРё СЂР°Р·РІРѕРґРё РІ СЃС‚РѕСЂРѕРЅС‹ Рё Р·Р°С‚РµРј РІРѕР·РІСЂР°С‰Р°Р№ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ РїСЂРѕС†РµСЃСЃР° РІРЅРёР·. РќРµ РІС‹С‚СЏРіРёРІР°Р№ РІРµСЃСЊ РїСЂРѕС†РµСЃСЃ РІ РґР»РёРЅРЅСѓСЋ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅСѓСЋ Р»РёРЅРёСЋ.
- Р’РђР–РќРћ: РЎРўР РћР“РђРЇ РџР РР’РЇР—РљРђ Р›РћР“РР§Р•РЎРљРРҐ Р‘Р›РћРљРћР’ (Р‘РђР—Рђ):
  1) Р’С…РѕРґ/РІС‹С…РѕРґ РїСЂРѕС†РµСЃСЃР° = СЃС‚СЂРѕРіРѕ <bpmn2:startEvent> Рё <bpmn2:endEvent> (РљСЂСѓРі).
  2) Р”РµР№СЃС‚РІРёРµ/С€Р°Рі РїСЂРѕС†РµСЃСЃР° = СЃС‚СЂРѕРіРѕ <bpmn2:task> (РџСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє). РљР°Р¶РґС‹Р№ task РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РІ name РєСЂР°С‚РєРѕРµ РЅР°Р·РІР°РЅРёРµ РґРµР№СЃС‚РІРёСЏ.
  3) Р”РѕРєСѓРјРµРЅС‚ (С„РѕСЂРјР°, Р·Р°СЏРІР»РµРЅРёРµ, Р°РєС‚, Р·Р°РїРёСЃСЊ) = СЃС‚СЂРѕРіРѕ <bpmn2:dataObjectReference> + <bpmn2:dataObject>. РљР°Р¶РґС‹Р№ РґРѕРєСѓРјРµРЅС‚, СѓРїРѕРјСЏРЅСѓС‚С‹Р№ РІ РїСЂРѕС†РµСЃСЃРµ, РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚СЂР°Р¶С‘РЅ РєР°Рє dataObjectReference СЃ name РґРѕРєСѓРјРµРЅС‚Р°. Р”Р»СЏ СЃРІСЏР·Рё СЃ task РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:dataOutputAssociation> РёР»Рё <bpmn2:dataInputAssociation>. Р”Р»СЏ РєР°Р¶РґРѕРіРѕ dataObjectReference Рё РєР°Р¶РґРѕР№ dataOutputAssociation/dataInputAssociation РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РіРµРЅРµСЂРёСЂСѓР№ BPMNShape (dc:Bounds) Рё BPMNEdge (di:waypoint) РІ Р±Р»РѕРєРµ bpmndi.
  4) РЎСЃС‹Р»РєР° РЅР° РґСЂСѓРіРѕР№ Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃ = СЃС‚СЂРѕРіРѕ <bpmn2:callActivity> (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РєР°Рє task СЃ РґРІРѕР№РЅРѕР№ СЂР°РјРєРѕР№). РђС‚СЂРёР±СѓС‚ calledElement СѓРєР°Р·С‹РІР°Р№ РєР°Рє РєРѕРґ РїСЂРѕС†РµСЃСЃР°.
  5) Р›РѕРіРёС‡РµСЃРєРёР№ Р±Р»РѕРє РР›Р = СЃС‚СЂРѕРіРѕ <bpmn2:exclusiveGateway> (Р РѕРјР±). РђС‚СЂРёР±СѓС‚ name вЂ” РєСЂР°С‚РєРёР№ РІРѕРїСЂРѕСЃ.
  6) Р‘Р°Р·Р° РґР°РЅРЅС‹С… (Р‘Р”, РљРРђРЎ, С…СЂР°РЅРёР»РёС‰Рµ) = СЃС‚СЂРѕРіРѕ <bpmn2:dataStoreReference> (Р¦РёР»РёРЅРґСЂ). Р”Р»СЏ СЃРІСЏР·Рё СЃ task РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:dataOutputAssociation>. Р”Р»СЏ dataStoreReference РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РіРµРЅРµСЂРёСЂСѓР№ BPMNShape (dc:Bounds) РІ Р±Р»РѕРєРµ bpmndi.
  7) Р—РѕРЅР° РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё/СЂРѕР»Рё = РµСЃР»Рё РІ РѕРїРёСЃР°РЅРёРё РїСЂРѕС†РµСЃСЃР° СѓРїРѕРјРёРЅР°СЋС‚СЃСЏ РєРѕРЅРєСЂРµС‚РЅС‹Рµ СЂРѕР»Рё РёР»Рё РїРѕРґСЂР°Р·РґРµР»РµРЅРёСЏ, РѕР±РѕСЂР°С‡РёРІР°Р№ РїСЂРѕС†РµСЃСЃ РІ <bpmn2:collaboration> СЃ <bpmn2:participant> Рё РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:laneSet> СЃ <bpmn2:lane> РІРЅСѓС‚СЂРё process. РљР°Р¶РґР°СЏ СЂРѕР»СЊ = РѕС‚РґРµР»СЊРЅС‹Р№ lane. Р•СЃР»Рё СЂРѕР»Рё РЅРµ СѓРїРѕРјСЏРЅСѓС‚С‹, РёСЃРїРѕР»СЊР·СѓР№ РїСЂРѕСЃС‚РѕР№ process Р±РµР· lanes.
  8) РќР°РїСЂР°РІР»СЏСЋС‰РёРµ (СЃС‚СЂРµР»РєРё РїРѕС‚РѕРєР°) = <bpmn2:sequenceFlow> РґР»СЏ СЃРІСЏР·Рё СЌР»РµРјРµРЅС‚РѕРІ РїСЂРѕС†РµСЃСЃР°. Р”Р»СЏ СЃРІСЏР·Рё СЃ РґР°РЅРЅС‹РјРё = <bpmn2:association> РёР»Рё dataOutputAssociation/dataInputAssociation.
- Р‘РµР· РєРѕРѕСЂРґРёРЅР°С‚ (DI) РІРёР·СѓР°Р»СЊРЅС‹Р№ СЂРµРґР°РєС‚РѕСЂ РЅРµ СЃРјРѕР¶РµС‚ РѕС‚РѕР±СЂР°Р·РёС‚СЊ СЃС…РµРјСѓ! РџСЂРѕСЏРІРё РјР°С‚РµРјР°С‚РёС‡РµСЃРєСѓСЋ С‚РѕС‡РЅРѕСЃС‚СЊ.
- РќРµ РѕР±СЂРµР·Р°Р№ XML, РІРµСЂРЅРё РµРіРѕ РїРѕР»РЅРѕСЃС‚СЊСЋ.


Р¤РћР РњРђРў РћРўР’Р•РўРђ:
РўРІРѕР№ РѕС‚РІРµС‚ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ JSON-РѕР±СЉРµРєС‚РѕРј Рё РўРћР›Р¬РљРћ РёРј. РќРёРєР°РєРёС… РѕР±СЉСЏСЃРЅРµРЅРёР№. РЎС‚СЂСѓРєС‚СѓСЂР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ СЃР»РµРґСѓСЋС‰РµР№:
{
"standardDescription": "...", // Р—РґРµСЃСЊ Markdown-С‚РµРєСЃС‚
"mermaidCode": "..." // Р—РґРµСЃСЊ СЂР°Р·РјРµСЃС‚Рё BPMN XML РєРѕРґ (РЅР°Р·РІР°РЅРёРµ РєР»СЋС‡Р° РѕСЃС‚Р°Р»РѕСЃСЊ mermaidCode РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё)
}

РРЎРҐРћР”РќР«Р™ РџР РћР¦Р•РЎРЎ РћРў РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ:
"${processDescription}"`;
        return callGeminiAPI(prompt, { chatId }).then(response => {
            // AI responses can sometimes include markdown wrappers. Find the JSON block.
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Invalid response from AI, no JSON object found. Raw response:", response);
                throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РєРѕСЂСЂРµРєС‚РЅС‹Р№ JSON-РѕР±СЉРµРєС‚ РѕС‚ AI.");
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
                throw new Error("РћС€РёР±РєР° РїР°СЂСЃРёРЅРіР° JSON РѕС‚РІРµС‚Р° РѕС‚ AI.");
            }
        });
    }

    async function getFixedBpmnCode(brokenCode, errorMessage) {
        const prompt = `РўС‹ вЂ” СЌРєСЃРїРµСЂС‚ РїРѕ BPMN 2.0. РўРµР±Рµ РґР°Р»Рё BPMN XML СЃ РѕС€РёР±РєРѕР№. РўРІРѕСЏ Р·Р°РґР°С‡Р° вЂ” РРЎРџР РђР’РРўР¬ Р•Р“Рћ.

РќР•РРЎРџР РђР’РќР«Р™ РљРћР”:
\`\`\`
${brokenCode}
\`\`\`

РЎРћРћР‘Р©Р•РќРР• РћР‘ РћРЁРР‘РљР•:
"${errorMessage}"

РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ РѕС€РёР±РєСѓ Рё РІРµСЂРЅРё РРЎРџР РђР’Р›Р•РќРќР«Р™ РєРѕРґ. РЈР±РµРґРёСЃСЊ, С‡С‚Рѕ РґРѕР±Р°РІР»РµРЅС‹ РІСЃРµ DI С‚РµРіРё СЃ РєРѕРѕСЂРґРёРЅР°С‚Р°РјРё (BPMNShape, dc:Bounds, BPMNEdge, di:waypoint).
РЎРЅР°С‡Р°Р»Р° СѓР±РµСЂРё РЅРµРІР°Р»РёРґРЅС‹Рµ СѓСЃР»РѕРІРЅС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ Рё conditionExpression, Р° РЅРµ РїРµСЂРµСЃС‚СЂР°РёРІР°Р№ С‚РѕРїРѕР»РѕРіРёСЋ Р±РµР· РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё.
РЎРІРµСЂСЊ <incoming>/<outgoing> Сѓ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р° СЃ СЂРµР°Р»СЊРЅС‹РјРё sequenceFlow sourceRef/targetRef Рё РёСЃРїСЂР°РІСЊ РЅРµСЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ.
РџРѕРґРїРёСЃРё "РґР°"/"РЅРµС‚" Рё СЌР»РµРјРµРЅС‚С‹ <bpmn2:conditionExpression> РґРѕРїСѓСЃС‚РёРјС‹ С‚РѕР»СЊРєРѕ Сѓ sequenceFlow, РёСЃС…РѕРґСЏС‰РёС… РёР· <bpmn2:exclusiveGateway>.
Р•СЃР»Рё РѕРЅРё СЃС‚РѕСЏС‚ РїРѕСЃР»Рµ РѕР±С‹С‡РЅРѕРіРѕ task, СѓРґР°Р»Рё РёС…. Р”РѕР±Р°РІР»СЏР№ gateway С‚РѕР»СЊРєРѕ РµСЃР»Рё РІ СЃР°РјРѕРј РїСЂРѕС†РµСЃСЃРµ СЏРІРЅРѕ РµСЃС‚СЊ СЂРµС€РµРЅРёРµ РёР»Рё СЂР°Р·РІРёР»РєР°.
РќРµ РёСЃРїРѕР»СЊР·СѓР№ Р»РёС€РЅРёРµ РєСЂСѓРіРё РІРЅСѓС‚СЂРё РїСЂРѕС†РµСЃСЃР°: РєСЂСѓРіРё РґРѕРїСѓСЃС‚РёРјС‹ С‚РѕР»СЊРєРѕ РґР»СЏ <bpmn2:startEvent> Рё <bpmn2:endEvent>, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЏРІРЅРѕ РЅРµ РѕРїРёСЃР°Р» СЃРїРµС†РёР°Р»СЊРЅРѕРµ СЃРѕР±С‹С‚РёРµ.
РљР°Р¶РґС‹Р№ <bpmn2:exclusiveGateway> РґРѕР»Р¶РµРЅ РёРјРµС‚СЊ РїРѕРЅСЏС‚РЅС‹Р№ РІРѕРїСЂРѕСЃ РІ name. Р•СЃР»Рё РµСЃС‚СЊ РґРІРµ РІРµС‚РєРё СЂРµС€РµРЅРёСЏ, РѕРЅРё РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РїРѕРјРµС‡РµРЅС‹ "РґР°" Рё "РЅРµС‚".
Р•СЃР»Рё РѕРґРЅР° РІРµС‚РєР° РѕР·РЅР°С‡Р°РµС‚ РІРѕР·РІСЂР°С‚ РЅР° РґРѕСЂР°Р±РѕС‚РєСѓ, РѕСЃС‚Р°РІР»СЏР№ РѕСЃРЅРѕРІРЅРѕРµ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ РїРѕРґ gateway, Р° РІРѕР·РІСЂР°С‚РЅСѓСЋ РІРµС‚РєСѓ РґРµР»Р°Р№ Р±РѕРєРѕРІРѕР№ Рё РІРѕР·РІСЂР°С‰Р°СЋС‰РµР№СЃСЏ Рє РїСЂРµРґС‹РґСѓС‰РµРјСѓ С€Р°РіСѓ.
Р•СЃР»Рё РґРІРµ РІРµС‚РєРё РїРѕСЃР»Рµ gateway СЃС…РѕРґСЏС‚СЃСЏ РІ РѕРґРёРЅ РѕР±С‰РёР№ С€Р°Рі, СЂР°СЃРїРѕР»Р°РіР°Р№ РёС… РїРѕ СЂР°Р·РЅС‹Рј СЃС‚РѕСЂРѕРЅР°Рј Рё СЃРѕРµРґРёРЅСЏР№ СЃ РѕР±С‰РёРј С€Р°РіРѕРј РЅРёР¶Рµ.
РЎРѕС…СЂР°РЅРё РІРµСЂС‚РёРєР°Р»СЊРЅСѓСЋ РєРѕРјРїРѕР·РёС†РёСЋ: РѕСЃРЅРѕРІРЅРѕР№ РїРѕС‚РѕРє СЃРІРµСЂС…Сѓ РІРЅРёР·, РІРµС‚РєРё РїРѕСЃР»Рµ gateway РІ СЃС‚РѕСЂРѕРЅС‹, Р·Р°С‚РµРј РїСЂРѕРґРѕР»Р¶РµРЅРёРµ СЃРЅРѕРІР° РІРЅРёР·.
Р’РђР–РќРћ: РЎРўР РћР“РђРЇ РџР РР’РЇР—РљРђ Р›РћР“РР§Р•РЎРљРРҐ Р‘Р›РћРљРћР’ (Р‘РђР—Рђ): Р’С…РѕРґ/РІС‹С…РѕРґ = <bpmn2:startEvent>/<bpmn2:endEvent>, РЁР°Рі = <bpmn2:task>, Р”РѕРєСѓРјРµРЅС‚ = <bpmn2:dataObjectReference> + <bpmn2:dataObject> (СЃ BPMNShape РІ DI-Р±Р»РѕРєРµ), РЎСЃС‹Р»РєР° РЅР° РїСЂРѕС†РµСЃСЃ = СЃС‚СЂРѕРіРѕ <bpmn2:callActivity> (РґРІРѕР№РЅР°СЏ СЂР°РјРєР°), Р›РѕРіРёС‡РµСЃРєРѕРµ РР›Р = <bpmn2:exclusiveGateway>, Р‘Р°Р·Р° РґР°РЅРЅС‹С… = <bpmn2:dataStoreReference> (СЃ BPMNShape РІ DI-Р±Р»РѕРєРµ). Р•СЃР»Рё РµСЃС‚СЊ СЂРѕР»Рё, РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:laneSet>/<bpmn2:lane>.

РћС‚РІРµС‚ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РўРћР›Р¬РљРћ РРЎРџР РђР’Р›Р•РќРќР«Р™ РєРѕРґ BPMN XML, Р±РµР· РѕР±СЉСЏСЃРЅРµРЅРёР№ Рё markdown.`;
        return callGeminiAPI(prompt, { chatId }).then(code => normalizeGeneratedBpmnXml(code.replace(/```xml/g, '').replace(/```/g, '').trim()));
    }

    async function generateDiagramFromText(processDescription) {
        const prompt = `РўС‹ вЂ” СЌР»РёС‚РЅС‹Р№ Р±РёР·РЅРµСЃ-Р°РЅР°Р»РёС‚РёРє. РўРІРѕСЏ Р·Р°РґР°С‡Р° вЂ” РІР·СЏС‚СЊ РѕРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР° РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РїСЂРµРІСЂР°С‚РёС‚СЊ РµРіРѕ РІ РєРѕРґ РґР»СЏ РґРёР°РіСЂР°РјРјС‹ РІ СЃС‚СЂРѕРіРѕРј СЃС‚Р°РЅРґР°СЂС‚Рµ BPMN 2.0 XML.
РћР±СЏР·Р°С‚РµР»СЊРЅРѕ РІРєР»СЋС‡Рё Р±Р»РѕРє <bpmndi:BPMNDiagram> Рё СЃРіРµРЅРµСЂРёСЂСѓР№ РєРѕРѕСЂРґРёРЅР°С‚С‹ (Bounds/waypoint) РґР»СЏ РІСЃРµС… СЌР»РµРјРµРЅС‚РѕРІ, С‡С‚РѕР±С‹ РґРёР°РіСЂР°РјРјР° РѕС‚РѕР±СЂР°Р¶Р°Р»Р°СЃСЊ РІРёР·СѓР°Р»СЊРЅРѕ. 
Р’РђР–РќРћ: РљРѕРѕСЂРґРёРЅР°С‚С‹ СЌР»РµРјРµРЅС‚РѕРІ РІС‹СЃС‚Р°РІР»СЏР№ РїСЂРёР±Р»РёР·РёС‚РµР»СЊРЅРѕ СЃРІРµСЂС…Сѓ РІРЅРёР· вЂ” С‚РѕС‡РЅР°СЏ СЂР°СЃРєР»Р°РґРєР° Р±СѓРґРµС‚ РІС‹РїРѕР»РЅРµРЅР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
Р’РђР–РќРћ: РЎРїРёСЃРєРё <incoming> Рё <outgoing> Сѓ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р° РґРѕР»Р¶РЅС‹ С‚РѕС‡РЅРѕ СЃРѕРІРїР°РґР°С‚СЊ СЃ СЂРµР°Р»СЊРЅС‹РјРё sequenceFlow sourceRef/targetRef.
Р’РђР–РќРћ: РСЃРїРѕР»СЊР·СѓР№ <bpmn2:task> (РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРё) РґР»СЏ РѕСЃРЅРѕРІРЅС‹С… С€Р°РіРѕРІ РїСЂРѕС†РµСЃСЃР°. РљСЂСѓРіР°РјРё (<bpmn2:startEvent> Рё <bpmn2:endEvent>) РґРµР»Р°Р№ С‚РѕР»СЊРєРѕ РЅР°С‡Р°Р»Рѕ Рё РєРѕРЅРµС†.
Р’РђР–РќРћ: РќРµ РёСЃРїРѕР»СЊР·СѓР№ intermediate events, boundary events Рё РґСЂСѓРіРёРµ РєСЂСѓРіРё РІРЅСѓС‚СЂРё РїСЂРѕС†РµСЃСЃР°, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЏРІРЅРѕ РЅРµ РїСЂРѕСЃРёР» СЃРѕР±С‹С‚РёРµ. Р’ С‚РёРїРѕРІРѕРј Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃРµ РєСЂСѓРіРё РґРѕРїСѓСЃС‚РёРјС‹ С‚РѕР»СЊРєРѕ РґР»СЏ РЅР°С‡Р°Р»Р° Рё Р·Р°РІРµСЂС€РµРЅРёСЏ РїСЂРѕС†РµСЃСЃР°.
Р’РђР–РќРћ: Р РµС€РµРЅРёСЏ Рё РІРµС‚РІР»РµРЅРёСЏ Р”РћР›Р–РќР« РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РµРі <bpmn2:exclusiveGateway>. РџРѕРґРїРёСЃРё "РґР°"/"РЅРµС‚" Рё С‚РµРіРё <bpmn2:conditionExpression> РјРѕР¶РЅРѕ РїСЂРёРјРµРЅСЏС‚СЊ РўРћР›Р¬РљРћ Рє СЃРІСЏР·СЏРј, РёСЃС…РѕРґСЏС‰РёРј РёР· С€Р»СЋР·Р°.
Р’РђР–РќРћ: РљР°Р¶РґС‹Р№ <bpmn2:exclusiveGateway> РґРѕР»Р¶РµРЅ РёРјРµС‚СЊ РєРѕСЂРѕС‚РєРёР№ РІРѕРїСЂРѕСЃ РІ Р°С‚СЂРёР±СѓС‚Рµ name. Р•СЃР»Рё РёР· РЅРµРіРѕ РІС‹С…РѕРґСЏС‚ РґРІРµ РІРµС‚РєРё, РѕРґРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ "РґР°", РґСЂСѓРіР°СЏ "РЅРµС‚".
Р’РђР–РќРћ: Р•СЃР»Рё РѕРґРЅР° РІРµС‚РєР° РїРѕСЃР»Рµ gateway РІРѕР·РІСЂР°С‰Р°РµС‚ РїСЂРѕС†РµСЃСЃ РЅР° РґРѕСЂР°Р±РѕС‚РєСѓ, РѕСЃРЅРѕРІРЅРѕРµ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ СЂР°Р·РјРµС‰Р°Р№ РїСЂСЏРјРѕ РїРѕРґ gateway, Р° РІРѕР·РІСЂР°С‚РЅСѓСЋ РІРµС‚РєСѓ СѓРІРѕРґРё РІ СЃС‚РѕСЂРѕРЅСѓ Рё РІРѕР·РІСЂР°С‰Р°Р№ Рє РЅСѓР¶РЅРѕРјСѓ РїСЂРµРґС‹РґСѓС‰РµРјСѓ С€Р°РіСѓ.
Р’РђР–РќРћ: Р•СЃР»Рё РґРІРµ РІРµС‚РєРё РїРѕСЃР»Рµ gateway РїРѕС‚РѕРј СЃС…РѕРґСЏС‚СЃСЏ РІ РѕРґРёРЅ РѕР±С‰РёР№ С€Р°Рі, РїРѕРєР°Р·С‹РІР°Р№ РѕР±Рµ РІРµС‚РєРё РѕС‚РґРµР»СЊРЅРѕ РїРѕ СЃС‚РѕСЂРѕРЅР°Рј, Р° С‚РѕС‡РєСѓ РїСЂРѕРґРѕР»Р¶РµРЅРёСЏ РїСЂРѕС†РµСЃСЃР° СЂР°СЃРїРѕР»Р°РіР°Р№ РЅРёР¶Рµ РїРѕ С†РµРЅС‚СЂСѓ.
Р’РђР–РќРћ: РћСЃРЅРѕРІРЅРѕР№ РїРѕС‚РѕРє СЃС‚СЂРѕР№ СЃРІРµСЂС…Сѓ РІРЅРёР·. РџРѕСЃР»Рµ gateway РІРµС‚РєРё СЂР°Р·РІРѕРґРё РІ СЃС‚РѕСЂРѕРЅС‹ Рё Р·Р°С‚РµРј РІРѕР·РІСЂР°С‰Р°Р№ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ РїСЂРѕС†РµСЃСЃР° РІРЅРёР·, Р° РЅРµ РІ РґР»РёРЅРЅСѓСЋ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅСѓСЋ Р»РёРЅРёСЋ.
Р’РђР–РќРћ: РЎРўР РћР“РђРЇ РџР РР’РЇР—РљРђ Р›РћР“РР§Р•РЎРљРРҐ Р‘Р›РћРљРћР’ (Р‘РђР—Рђ):
  1) Р’С…РѕРґ/РІС‹С…РѕРґ РїСЂРѕС†РµСЃСЃР° = СЃС‚СЂРѕРіРѕ <bpmn2:startEvent> Рё <bpmn2:endEvent> (РљСЂСѓРі).
  2) Р”РµР№СЃС‚РІРёРµ/С€Р°Рі РїСЂРѕС†РµСЃСЃР° = СЃС‚СЂРѕРіРѕ <bpmn2:task> (РџСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє). РљР°Р¶РґС‹Р№ task РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РІ name РєСЂР°С‚РєРѕРµ РЅР°Р·РІР°РЅРёРµ РґРµР№СЃС‚РІРёСЏ.
  3) Р”РѕРєСѓРјРµРЅС‚ (С„РѕСЂРјР°, Р·Р°СЏРІР»РµРЅРёРµ, Р°РєС‚, Р·Р°РїРёСЃСЊ) = СЃС‚СЂРѕРіРѕ <bpmn2:dataObjectReference> + <bpmn2:dataObject>. РљР°Р¶РґС‹Р№ РґРѕРєСѓРјРµРЅС‚, СѓРїРѕРјСЏРЅСѓС‚С‹Р№ РІ РїСЂРѕС†РµСЃСЃРµ, РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚СЂР°Р¶С‘РЅ РєР°Рє dataObjectReference СЃ name РґРѕРєСѓРјРµРЅС‚Р°. Р”Р»СЏ СЃРІСЏР·Рё СЃ task РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:dataOutputAssociation> РёР»Рё <bpmn2:dataInputAssociation>. Р”Р»СЏ РєР°Р¶РґРѕРіРѕ dataObjectReference Рё РєР°Р¶РґРѕР№ dataOutputAssociation/dataInputAssociation РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РіРµРЅРµСЂРёСЂСѓР№ BPMNShape (dc:Bounds) Рё BPMNEdge (di:waypoint) РІ Р±Р»РѕРєРµ bpmndi.
  4) РЎСЃС‹Р»РєР° РЅР° РґСЂСѓРіРѕР№ Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃ = СЃС‚СЂРѕРіРѕ <bpmn2:callActivity> (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РєР°Рє task СЃ РґРІРѕР№РЅРѕР№ СЂР°РјРєРѕР№). РђС‚СЂРёР±СѓС‚ calledElement СѓРєР°Р·С‹РІР°Р№ РєР°Рє РєРѕРґ РїСЂРѕС†РµСЃСЃР°.
  5) Р›РѕРіРёС‡РµСЃРєРёР№ Р±Р»РѕРє РР›Р = СЃС‚СЂРѕРіРѕ <bpmn2:exclusiveGateway> (Р РѕРјР±). РђС‚СЂРёР±СѓС‚ name вЂ” РєСЂР°С‚РєРёР№ РІРѕРїСЂРѕСЃ.
  6) Р‘Р°Р·Р° РґР°РЅРЅС‹С… (Р‘Р”, РљРРђРЎ, С…СЂР°РЅРёР»РёС‰Рµ) = СЃС‚СЂРѕРіРѕ <bpmn2:dataStoreReference> (Р¦РёР»РёРЅРґСЂ). Р”Р»СЏ СЃРІСЏР·Рё СЃ task РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:dataOutputAssociation>. Р”Р»СЏ dataStoreReference РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РіРµРЅРµСЂРёСЂСѓР№ BPMNShape (dc:Bounds) РІ Р±Р»РѕРєРµ bpmndi.
  7) Р—РѕРЅР° РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё/СЂРѕР»Рё = РµСЃР»Рё РІ РѕРїРёСЃР°РЅРёРё РїСЂРѕС†РµСЃСЃР° СѓРїРѕРјРёРЅР°СЋС‚СЃСЏ РєРѕРЅРєСЂРµС‚РЅС‹Рµ СЂРѕР»Рё РёР»Рё РїРѕРґСЂР°Р·РґРµР»РµРЅРёСЏ, РѕР±РѕСЂР°С‡РёРІР°Р№ РїСЂРѕС†РµСЃСЃ РІ <bpmn2:collaboration> СЃ <bpmn2:participant> Рё РёСЃРїРѕР»СЊР·СѓР№ <bpmn2:laneSet> СЃ <bpmn2:lane> РІРЅСѓС‚СЂРё process. РљР°Р¶РґР°СЏ СЂРѕР»СЊ = РѕС‚РґРµР»СЊРЅС‹Р№ lane. Р•СЃР»Рё СЂРѕР»Рё РЅРµ СѓРїРѕРјСЏРЅСѓС‚С‹, РёСЃРїРѕР»СЊР·СѓР№ РїСЂРѕСЃС‚РѕР№ process Р±РµР· lanes.
  8) РќР°РїСЂР°РІР»СЏСЋС‰РёРµ (СЃС‚СЂРµР»РєРё РїРѕС‚РѕРєР°) = <bpmn2:sequenceFlow> РґР»СЏ СЃРІСЏР·Рё СЌР»РµРјРµРЅС‚РѕРІ РїСЂРѕС†РµСЃСЃР°. Р”Р»СЏ СЃРІСЏР·Рё СЃ РґР°РЅРЅС‹РјРё = <bpmn2:association> РёР»Рё dataOutputAssociation/dataInputAssociation.

Р¤РћР РњРђРў РћРўР’Р•РўРђ:
РўРІРѕР№ РѕС‚РІРµС‚ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РўРћР›Р¬РљРћ РєРѕРґ BPMN 2.0 XML, Р±РµР· РѕР±СЉСЏСЃРЅРµРЅРёР№ Рё markdown.

РРЎРҐРћР”РќР«Р™ РџР РћР¦Р•РЎРЎ РћРў РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ:
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

        setButtonLoading(userLoginBtn, true, 'Р’С…РѕРґ...');
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
            userError.textContent = `РћС€РёР±РєР° РІС…РѕРґР°: ${error.message}`;
        } finally {
            setButtonLoading(userLoginBtn, false);
        }
    }

    async function loadDepartmentsForSelection() {
        try {
            const response = await fetchWithAuth('/api/departments');
            const departments = await response.json();
            if (departments.length === 0) {
                departmentSelectionContainer.innerHTML = '<p class="placeholder-text">Р”Р»СЏ РІР°СЃ РЅРµ РЅР°Р·РЅР°С‡РµРЅРѕ РЅРё РѕРґРЅРѕРіРѕ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°.</p>';
                return;
            }
            departmentSelectionContainer.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span class="dept-icon">рџЏў</span>
                    <span class="dept-name">${dept.name}</span>
                </div>
            `).join('');
        } catch (error) {
            departmentSelectionError.textContent = `РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚С‹: ${error.message}`;
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
                chatSelectionContainer.innerHTML = '<p class="placeholder-text">Р”Р»СЏ СЌС‚РѕРіРѕ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… С‡Р°С‚РѕРІ.</p>';
                return;
            }

            chatSelectionContainer.innerHTML = activeChats.map(chat => `
                <div class="chat-card" data-chat-id="${chat.id}" data-chat-name="${chat.name}">
                    <span class="chat-icon">рџ’¬</span>
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
            chatError.textContent = `РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С‡Р°С‚С‹: ${error.message}`;
        }
    }

    async function handleChatLogin() {
        const selectedChatCard = document.querySelector('.chat-card.selected');
        if (!selectedChatCard) {
            chatError.textContent = 'РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ С‡Р°С‚';
            return;
        }

        const password = chatPasswordInput.value;
        if (!password) {
            chatError.textContent = 'РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІРІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ';
            return;
        }

        setButtonLoading(chatLoginBtn, true, 'Р’С…РѕРґ...');
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
            chatError.textContent = `РћС€РёР±РєР° РІС…РѕРґР° РІ С‡Р°С‚: ${error.message}`;
        } finally {
            setButtonLoading(chatLoginBtn, false);
        }
    }

    function showMainApp(chatName) {
        authWrapper.style.display = 'none';
        mainContainer.style.display = 'block';
        if (backToAdminBtn) backToAdminBtn.style.display = 'none'; // РЎРєСЂС‹РІР°РµРј СЃС‚Р°СЂСѓСЋ РєРЅРѕРїРєСѓ, РµСЃР»Рё РѕРЅР° РµСЃС‚СЊ РІ HTML

        const deptName = selectedDepartment ? selectedDepartment.name : 'Р”РµРїР°СЂС‚Р°РјРµРЅС‚';
        chatNameHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="universal-back-btn" class="button-secondary" style="padding: 6px 14px; font-size: 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <span style="font-size: 16px;">в¬…</span> РќР°Р·Р°Рґ
                </button>
                <div style="font-size: 18px;">
                    <span id="breadcrumb-back" style="cursor:pointer; color: #3b82f6; transition: color 0.2s;" title="Р’РµСЂРЅСѓС‚СЊСЃСЏ РЅР°Р·Р°Рґ" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#3b82f6'">
                        рџЏў ${escapeHtml(deptName)}
                    </span> 
                    <span style="color: #94a3b8; margin: 0 8px;">/</span> 
                    рџ’¬ ${escapeHtml(chatName)}
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
                <span style="${i === 0 ? 'font-weight: 600; color: #065f46;' : ''}">Р’РµСЂСЃРёСЏ РѕС‚ ${new Date(v.created_at).toLocaleString()} ${i === 0 ? 'в­ђпёЏ' : ''}</span>
                <button class="button-small">РџРѕСЃРјРѕС‚СЂРµС‚СЊ</button>
            </div>`).join('') || '<p>РќРµС‚ СЃРѕС…СЂР°РЅРµРЅРЅС‹С… РІРµСЂСЃРёР№.</p>';
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

        // Р’РћРЎРЎРўРђРќРћР’Р›Р•РќРР• РђР’РўРћРЎРћРҐР РђРќР•РќРРЇ
        const savedDraft = localStorage.getItem(`autosave_chat_${chatId}`);
        // Р•СЃР»Рё С‡РµСЂРЅРѕРІРёРє РЅРѕРІРµРµ Рё РјС‹ СЃРјРѕС‚СЂРёРј РёРјРµРЅРЅРѕ РїРѕСЃР»РµРґРЅСЋСЋ (Р°РєС‚СѓР°Р»СЊРЅСѓСЋ) РІРµСЂСЃРёСЋ
        if (savedDraft && savedDraft !== version.process_text && version.id === chatVersions[0]?.id) {
            showNotification('Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅ РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹Р№ С‡РµСЂРЅРѕРІРёРє', 'info');
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

        // Р•СЃР»Рё РІРєР»СЋС‡РµРЅ СЂРµР¶РёРј РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂР°, РѕР±РЅРѕРІР»СЏРµРј РµРіРѕ
        if (typeof isPreviewMode !== 'undefined' && isPreviewMode) {
            previewContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(processDescriptionInput.value || '*РџСѓСЃС‚Рѕ*') : processDescriptionInput.value;
        }
    }

    function renderComments(comments) {
        commentsContainer.innerHTML = comments.map(c => `
            <div class="comment ${c.author_role}">
                <span class="comment-author">${c.author_role}</span>
                <p class="comment-text">${c.text}</p>
                <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
            </div>`).join('') || '<p>РќРµС‚ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ.</p>';
    }

    async function handleSaveVersion(button = saveVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("РќРµР»СЊР·СЏ СЃРѕС…СЂР°РЅРёС‚СЊ РїСѓСЃС‚СѓСЋ РІРµСЂСЃРёСЋ.", "error");
            return;
        }

        setButtonLoading(button, true, 'Copilot РїСЂРѕРІРµСЂСЏРµС‚...');
        try {
            const copilotRes = await fetchWithAuth(`/api/chats/${chatId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text })
            });
            const validateData = await copilotRes.json();

            if (validateData.analysis && validateData.analysis.trim() !== 'РћС€РёР±РѕРє РЅРµ РЅР°Р№РґРµРЅРѕ' && validateData.analysis.trim().length > 3) {
                const proceed = confirm(`вљ пёЏ Р’РЅРёРјР°РЅРёРµ РѕС‚ AI Copilot:\n\n${validateData.analysis}\n\nР’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ РїСЂРѕРґРѕР»Р¶РёС‚СЊ СЃРѕС…СЂР°РЅРµРЅРёРµ?`);
                if (!proceed) {
                    setButtonLoading(button, false);
                    return;
                }
            }

            setButtonLoading(button, true, 'РЎРѕС…СЂР°РЅРµРЅРёРµ СЃ РР...');
            const result = await generateProcessArtifacts(process_text);
            const { standardDescription, mermaidCode } = result;

            if (!standardDescription || !mermaidCode) {
                throw new Error("РџРѕР»СѓС‡РµРЅРЅС‹Р№ РѕС‚ AI JSON РЅРµ СЃРѕРґРµСЂР¶РёС‚ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РїРѕР»РµР№ standardDescription РёР»Рё mermaidCode.");
            }

            processDescriptionInput.value = standardDescription; // Update the text area

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: standardDescription, mermaid_code: mermaidCode })
            });
            localStorage.removeItem(`autosave_chat_${chatId}`);
            showNotification("Р’РµСЂСЃРёСЏ СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅР°.", "success");

            await loadChatData();
        } catch (error) {
            showNotification(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleRenderDiagram(button) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("РћРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР° РїСѓСЃС‚РѕРµ.", "error");
            return;
        }
        setButtonLoading(button, true, 'РЎРѕР·РґР°РЅРёРµ СЃС…РµРјС‹...');
        const timeoutId = setTimeout(() => {
            setButtonLoading(button, false);
            showNotification('Р“РµРЅРµСЂР°С†РёСЏ Р·Р°РЅСЏР»Р° СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ РІСЂРµРјРµРЅРё. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·.', 'error');
        }, 60000);
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            if (mermaidCode) {
                diagramPlaceholder.style.display = 'none';
                diagramContainer.style.display = 'block';
                await renderDiagramView(mermaidCode);
            } else {
                showNotification('РР РЅРµ РІРµСЂРЅСѓР» РєРѕРґ СЃС…РµРјС‹. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·.', 'error');
            }
        } catch (error) {
            showNotification(`РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ СЃС…РµРјС‹: ${error.message}`, "error");
        } finally {
            clearTimeout(timeoutId);
            setButtonLoading(button, false);
        }
    }

    async function handleUpdateStatus(status, button) {
        if (!button) return;
        setButtonLoading(button, true, 'РћР±РЅРѕРІР»РµРЅРёРµ...');
        try {
            await handleSaveRawVersion();

            await fetchWithAuth(`/api/chats/${chatId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            showNotification(`РЎС‚Р°С‚СѓСЃ С‡Р°С‚Р° РѕР±РЅРѕРІР»РµРЅ РЅР°: ${status}`, 'success');
            await loadChatData(); // Reload to reflect new status and UI state
        } catch (error) {
            showNotification(`РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР°: ${error.message}`, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleAddComment() {
        const text = commentInput.value;
        if (!text.trim()) return;
        setButtonLoading(addCommentBtn, true, 'РћС‚РїСЂР°РІРєР°...');
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
        draft: { text: 'Р§РµСЂРЅРѕРІРёРє', color: 'var(--secondary-color)' },
        pending_review: { text: 'РќР° РїСЂРѕРІРµСЂРєРµ', color: 'var(--color-warning)' },
        needs_revision: { text: 'РќСѓР¶РЅС‹ РїСЂР°РІРєРё', color: 'var(--color-danger)' },
        completed: { text: 'Р—Р°РІРµСЂС€РµРЅ', color: 'var(--color-success)' },
        archived: { text: 'Р’ Р°СЂС…РёРІРµ', color: 'var(--secondary-color)' }
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

        setButtonLoading(button, true, 'РЎРѕС…СЂР°РЅРµРЅРёРµ...');
        try {
            const response = await fetchWithAuth(`/api/chats/${chatId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ final_text: text, status: status })
            });
            const data = await response.json();
            showNotification('РўСЂР°РЅСЃРєСЂРёР±Р°С†РёСЏ СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅР°!', 'success');
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
            showNotification(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С‚СЂР°РЅСЃРєСЂРёР±Р°С†РёРё: ${error.message}`, 'error');
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
            showNotification(`РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… Р°РґРјРёРЅ-РїР°РЅРµР»Рё: ${error.message}`, 'error');
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
                    <td>${user.role === 'admin' ? 'РђРґРјРёРЅ' : 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}</td>
                    <td>${user.department_name || '-'}</td>
                    <td>
                        <button class="button-small change-password-btn" data-user-id="${user.id}">РџР°СЂРѕР»СЊ</button>
                        <button class="button-small delete-user-btn" data-user-id="${user.id}" ${user.id === sessionUser.id ? 'disabled' : ''}>РЈРґР°Р»РёС‚СЊ</button>
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
            showNotification("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№", "error");
        }
    }

    async function handleCreateUser() {
        const full_name = newUserFullnameInput.value;
        const email = newUserEmailInput.value;
        const department_id = newUserDeptSelect.value || null;
        const password = newUserPasswordInput.value;
        const role = newUserRoleSelect.value;

        if (!full_name || !email || !password) {
            showNotification("Р¤РРћ, Email Рё РџР°СЂРѕР»СЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹", "error");
            return;
        }

        setButtonLoading(createUserBtn, true, 'РЎРѕР·РґР°РЅРёРµ...');
        try {
            await fetchWithAuth('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, email, password, department_id, role })
            });
            showNotification("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ", "success");
            // Clear form
            newUserFullnameInput.value = '';
            newUserEmailInput.value = '';
            newUserPasswordInput.value = '';
            // Reload user list and department owner select
            await loadAdminUsers();
        } catch (error) {
            showNotification(`РћС€РёР±РєР°: ${error.message}`, "error");
        } finally {
            setButtonLoading(createUserBtn, false);
        }
    }

    async function handleDeleteUser(userId) {
        if (!confirm('Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ СЌС‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ.')) return;

        try {
            await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
            showNotification('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»РµРЅ', 'success');
            await loadAdminUsers();
        } catch (error) {
            showNotification(`РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ: ${error.message}`, 'error');
        }
    }

    async function handleChangePassword(userId) {
        const newPassword = prompt('Р’РІРµРґРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ (РјРёРЅРёРјСѓРј 8 СЃРёРјРІРѕР»РѕРІ):');
        if (!newPassword) return;
        if (newPassword.length < 8) {
            showNotification('РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№', 'error');
            return;
        }

        try {
            await fetchWithAuth(`/api/admin/users/${userId}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            showNotification('РџР°СЂРѕР»СЊ РёР·РјРµРЅРµРЅ', 'success');
        } catch (error) {
            showNotification(`РћС€РёР±РєР° РёР·РјРµРЅРµРЅРёСЏ РїР°СЂРѕР»СЏ: ${error.message}`, 'error');
        }
    }

    async function loadAdminDepartments() {
        try {
            const deptsResponse = await fetchWithAuth('/api/departments');
            const departments = await deptsResponse.json();
            departmentList.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span>${dept.name}</span>
                    <button class="button-danger delete-department-btn" data-dept-id="${dept.id}" title="РЈРґР°Р»РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚">РЈРґР°Р»РёС‚СЊ</button>
                </div>`).join('');

            // Also update the department select for user creation
            newUserDeptSelect.innerHTML = '<option value="">Р‘РµР· РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');

        } catch (error) {
            departmentList.innerHTML = `<div class="error-text">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚С‹: ${error.message}</div>`;
        }
    }

    function renderAdminChatList(listElement, chats, listName) {
        const validChats = chats.filter(chat => chat.chats && chat.departments);
        if (validChats.length === 0) {
            listElement.innerHTML = '<li>РќРµС‚ С‡Р°С‚РѕРІ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ</li>';
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
        chatListHeader.textContent = `Р§Р°С‚С‹ РІ "${deptName}"`;
        selectedDepartmentNameSpan.textContent = deptName;
        createChatForm.style.display = 'block';
        chatList.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            const response = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
            const chats = await response.json();
            chatList.innerHTML = chats.length > 0 ? chats.map(chat => `
                <div class="chat-item" data-chat-id="${chat.id}">
                    <span>${chat.name}</span>
                    <button class="button-danger delete-chat-btn" data-chat-id="${chat.id}" title="РЈРґР°Р»РёС‚СЊ С‡Р°С‚">РЈРґР°Р»РёС‚СЊ</button>
                </div>
            `).join('') : '<div class="placeholder-text">РќРµС‚ С‡Р°С‚РѕРІ.</div>';
        } catch (error) {
            chatList.innerHTML = `<div class="error-text">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С‡Р°С‚С‹: ${error.message}</div>`;
        }
    }

    async function handleCreateDepartment() {
        const name = newDepartmentNameInput.value;
        const password = newDepartmentPasswordInput.value;
        const userId = userForNewDepartmentSelect.value;
        if (!name || !password || !userId) {
            showNotification('Р’СЃРµ РїРѕР»СЏ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ Р·Р°РїРѕР»РЅРµРЅС‹!', 'error');
            return;
        }
        setButtonLoading(createDepartmentBtn, true, 'РЎРѕР·РґР°РЅРёРµ...');
        try {
            await fetchWithAuth('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, user_id: userId })
            });
            newDepartmentNameInput.value = '';
            newDepartmentPasswordInput.value = '';
            showNotification('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ СЃРѕР·РґР°РЅ!', 'success');
            await loadAdminDepartments();
        } catch (error) {
            showNotification(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createDepartmentBtn, false);
        }
    }

    async function handleCreateChat() {
        const selectedDeptCard = document.querySelector('#department-list .department-card.selected');
        if (!selectedDeptCard) {
            showNotification('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ РґРµРїР°СЂС‚Р°РјРµРЅС‚!', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const name = newChatNameInput.value;
        const password = newChatPasswordInput.value;
        if (!name || !password) return;
        setButtonLoading(createChatBtn, true, 'РЎРѕР·РґР°РЅРёРµ...');
        try {
            await fetchWithAuth('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department_id: deptId, name, password })
            });
            newChatNameInput.value = '';
            newChatPasswordInput.value = '';
            showNotification('Р§Р°С‚ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ.', 'success');
            await loadChatListForAdminDepartment(deptId, selectedDeptCard.dataset.deptName);
        } catch (error) {
            showNotification(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‡Р°С‚: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createChatBtn, false);
        }
    }

    async function handleDeleteDepartment(e) {
        const button = e.target;
        const deptId = button.dataset.deptId;
        const deptCard = button.closest('.department-card');
        const deptName = deptCard.querySelector('span').textContent;

        if (confirm(`Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚ "${deptName}"? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ С‚Р°РєР¶Рµ СѓРґР°Р»РёС‚ РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ СЃ РЅРёРј С‡Р°С‚С‹.`)) {
            try {
                await fetchWithAuth(`/api/departments/${deptId}`, { method: 'DELETE' });
                showNotification(`Р”РµРїР°СЂС‚Р°РјРµРЅС‚ "${deptName}" СѓСЃРїРµС€РЅРѕ СѓРґР°Р»РµРЅ.`, 'success');
                await loadAdminDepartments();
                if (deptCard.classList.contains('selected')) {
                    chatList.innerHTML = '<div class="placeholder-text">Р’С‹Р±РµСЂРёС‚Рµ РґРµРїР°СЂС‚Р°РјРµРЅС‚, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ С‡Р°С‚С‹.</div>';
                    chatListHeader.textContent = 'Р§Р°С‚С‹';
                    createChatForm.style.display = 'none';
                }
            } catch (error) {
                showNotification(`РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°: ${error.message}`, 'error');
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
            showNotification('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ СЃРїРёСЃРєР°.', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const deptName = selectedDeptCard.dataset.deptName;

        if (confirm(`Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ С‡Р°С‚ "${chatName}"?`)) {
            try {
                await fetchWithAuth(`/api/chats/${chatId}`, { method: 'DELETE' });
                showNotification(`Р§Р°С‚ "${chatName}" СѓСЃРїРµС€РЅРѕ СѓРґР°Р»РµРЅ.`, 'success');
                await loadChatListForAdminDepartment(deptId, deptName);
            } catch (error) {
                showNotification(`РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ С‡Р°С‚Р°: ${error.message}`, 'error');
            }
        }
    }

    async function handleSaveRawVersion(button = saveRawVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("РќРµР»СЊР·СЏ СЃРѕС…СЂР°РЅРёС‚СЊ РїСѓСЃС‚СѓСЋ РІРµСЂСЃРёСЋ.", "error");
            return;
        }
        setButtonLoading(button, true, 'РЎРѕС…СЂР°РЅРµРЅРёРµ...');
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
            showNotification("Р’РµСЂСЃРёСЏ СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅР° (Р±РµР· РёР·РјРµРЅРµРЅРёР№ РѕС‚ РР).", "success");
            await loadChatData();
        } catch (error) {
            showNotification(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ: ${error.message}`, "error");
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
            selectedDepartment = { name: deptNameMatch || 'РђРґРјРёРЅ-РїР°РЅРµР»СЊ' };
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
            showNotification('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ.', 'error');
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
            showNotification('РќРµС‚ Р·Р°РїРёСЃР°РЅРЅРѕРіРѕ Р°СѓРґРёРѕ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё.', 'error');
            return;
        }

        setButtonLoading(processBtn, true, 'РћР±СЂР°Р±РѕС‚РєР°...');
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
                showNotification('РўСЂР°РЅСЃРєСЂРёР±Р°С†РёСЏ СѓСЃРїРµС€РЅРѕ Р·Р°РІРµСЂС€РµРЅР°.', 'success');
                transcriptionDisplay.textContent = data.transcript;
                processDescriptionInput.value = data.transcript;
                updateStepCounter();
                // Keep audio controls available
                processBtn.style.display = 'none'; // Hide process button after use
            } else {
                throw new Error(data.error || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            showNotification(`РћС€РёР±РєР° С‚СЂР°РЅСЃРєСЂРёР±Р°С†РёРё: ${error.message}`, 'error');
        } finally {
            // Stop animation timer
            clearInterval(transcriptionTimerInterval);
            transcriptionTimer.style.display = 'none';

            setButtonLoading(processBtn, false, 'РћР±СЂР°Р±РѕС‚Р°С‚СЊ');
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
            showNotification(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїРµСЂРІРѕРЅР°С‡Р°Р»СЊРЅСѓСЋ С‚СЂР°РЅСЃРєСЂРёР±Р°С†РёСЋ: ${error.message}`, 'error');
        }
    }


    function updateStepCounter() {
        if (!processDescriptionInput) return;
        const lines = processDescriptionInput.value.split('\n').filter(line => line.trim() !== '');
        stepCounter.textContent = `${lines.length} С€Р°РіРѕРІ`;
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
            throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё JSON-РјР°СЃСЃРёРІ СЃ СѓР»СѓС‡С€РµРЅРёСЏРјРё РІ РѕС‚РІРµС‚Рµ РР.');
        }

        const parsed = JSON.parse(arrayText);
        const normalized = normalizeSuggestions(parsed);
        if (normalized.length === 0) {
            throw new Error('РР РІРµСЂРЅСѓР» РѕС‚РІРµС‚, РЅРѕ РІ РЅРµРј РЅРµС‚ РІР°Р»РёРґРЅС‹С… РїСѓРЅРєС‚РѕРІ СѓР»СѓС‡С€РµРЅРёР№.');
        }
        return normalized;
    }

    async function getSuggestionsForProcess(processText) {
        const prompt = `РўС‹ вЂ” СЌР»РёС‚РЅС‹Р№ Р±РёР·РЅРµСЃ-Р°РЅР°Р»РёС‚РёРє. РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ СЃР»РµРґСѓСЋС‰РµРµ РѕРїРёСЃР°РЅРёРµ Р±РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃР° Рё РїСЂРµРґР»РѕР¶Рё 3-5 РєРѕРЅРєСЂРµС‚РЅС‹С…, РґРµР№СЃС‚РІРµРЅРЅС‹С… СѓР»СѓС‡С€РµРЅРёР№. Р”Р»СЏ РєР°Р¶РґРѕРіРѕ СѓР»СѓС‡С€РµРЅРёСЏ СѓРєР°Р¶Рё, РєР°РєСѓСЋ РїСЂРѕР±Р»РµРјСѓ РѕРЅРѕ СЂРµС€Р°РµС‚.

РћРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР°:
"${processText}"

РћС‚РІРµС‚ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ JSON-РјР°СЃСЃРёРІР°, РіРґРµ РєР°Р¶РґС‹Р№ РѕР±СЉРµРєС‚ СЃРѕРґРµСЂР¶РёС‚ РґРІР° РєР»СЋС‡Р°: "problem" Рё "suggestion".

РџСЂРёРјРµСЂ:
[
  {
    "problem": "Р СѓС‡РЅРѕР№ РІРІРѕРґ РґР°РЅРЅС‹С… РІ CRM, С‡С‚Рѕ РІРµРґРµС‚ Рє РѕС€РёР±РєР°Рј.",
    "suggestion": "РђРІС‚РѕРјР°С‚РёР·РёСЂРѕРІР°С‚СЊ РІРІРѕРґ РґР°РЅРЅС‹С… РІ CRM СЃ РїРѕРјРѕС‰СЊСЋ РёРЅС‚РµРіСЂР°С†РёРё РїРѕ API."
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

        throw new Error(`РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ СѓР»СѓС‡С€РµРЅРёР№: ${lastError?.message || 'РЅРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'}`);
    }

    async function handleImproveProcess() {
        const processText = processDescriptionInput.value;
        if (!processText.trim()) {
            showNotification("РћРїРёСЃР°РЅРёРµ РїСЂРѕС†РµСЃСЃР° РїСѓСЃС‚РѕРµ.", "error");
            return;
        }

        setButtonLoading(improveBtn, true, 'РђРЅР°Р»РёР·...');
        suggestionsContainer.innerHTML = ''; // Clear previous suggestions
        suggestionsControls.style.display = 'none';

        try {
            suggestions = await getSuggestionsForProcess(processText);
            renderSuggestions(suggestions);
            if (suggestions.length > 0) {
                suggestionsControls.style.display = 'flex';
            }
        } catch (error) {
            showNotification(`РћС€РёР±РєР° РїСЂРё РїРѕР»СѓС‡РµРЅРёРё СѓР»СѓС‡С€РµРЅРёР№: ${error.message}`, 'error');
        } finally {
            setButtonLoading(improveBtn, false);
        }
    }

    function renderSuggestions(suggestionsData) {
        suggestionsContainer.innerHTML = suggestionsData.map((s, index) => `
            <div class="suggestion-card">
                <input type="checkbox" id="suggestion-${index}" class="suggestion-checkbox" data-index="${index}">
                <label for="suggestion-${index}">
                    <p><strong>РџСЂРѕР±Р»РµРјР°:</strong> ${s.problem}</p>
                    <p><strong>Р РµС€РµРЅРёРµ:</strong> ${s.suggestion}</p>
                </label>
            </div>
        `).join('');
        updateSelectionCounter();
    }

    function updateSelectionCounter() {
        const selectedCount = suggestionsContainer.querySelectorAll('.suggestion-checkbox:checked').length;
        selectionCounter.textContent = `Р’С‹Р±СЂР°РЅРѕ: ${selectedCount}`;
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

        let improvementsText = "\n\n### РџСЂРµРґР»РѕР¶РµРЅРёСЏ РїРѕ СѓР»СѓС‡С€РµРЅРёСЋ:\n";
        selectedCheckboxes.forEach(checkbox => {
            const index = checkbox.dataset.index;
            const suggestion = suggestions[index];
            improvementsText += `* **РџСЂРѕР±Р»РµРјР°:** ${suggestion.problem}\n  * **Р РµС€РµРЅРёРµ:** ${suggestion.suggestion}\n`;
        });

        processDescriptionInput.value += improvementsText;
        updateStepCounter();
        suggestionsContainer.innerHTML = '';
        suggestionsControls.style.display = 'none';
        selectAllCheckbox.checked = false;
        showNotification("РЈР»СѓС‡С€РµРЅРёСЏ РґРѕР±Р°РІР»РµРЅС‹ РІ РѕРїРёСЃР°РЅРёРµ.", "success");
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
            showNotification('РРјСЏ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.', 'error');
            return;
        }

        setButtonLoading(saveDepartmentBtn, true, 'РЎРѕС…СЂР°РЅРµРЅРёРµ...');
        try {
            await fetchWithAuth(`/api/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            showNotification('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ СѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІР»РµРЅ.', 'success');
            closeEditDepartmentModal();
            await loadAdminDepartments(); // Refresh the list
        } catch (error) {
            showNotification(`РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ: ${error.message}`, 'error');
        } finally {
            setButtonLoading(saveDepartmentBtn, false);
        }
    }

    // --- РРќРЄР•РљР¦РР РќРћР’РћР“Рћ UI/UX ---

    // 1. РљРЅРѕРїРєР° Р·Р°РіСЂСѓР·РєРё Р°СѓРґРёРѕС„Р°Р№Р»Р°
    const fileUploadInput = document.createElement('input');
    fileUploadInput.type = 'file';
    fileUploadInput.accept = 'audio/*';
    fileUploadInput.style.display = 'none';

    const uploadAudioBtn = document.createElement('button');
    uploadAudioBtn.className = 'button-secondary';
    uploadAudioBtn.innerHTML = 'рџ“Ѓ Р—Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»';
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
            showNotification(`РђСѓРґРёРѕС„Р°Р№Р» ${file.name} РіРѕС‚РѕРІ Рє С‚СЂР°РЅСЃРєСЂРёР±Р°С†РёРё.`, 'info');
        }
    });

    // 2. РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ Markdown
    const previewContainer = document.createElement('div');
    previewContainer.className = 'markdown-body scroll-area';
    previewContainer.style.cssText = 'display: none; height: 400px; overflow-y: auto; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; background-color: #f8fafc;';
    processDescriptionInput.parentNode.insertBefore(previewContainer, processDescriptionInput.nextSibling);

    const togglePreviewBtn = document.createElement('button');
    togglePreviewBtn.className = 'button-secondary';
    togglePreviewBtn.style.marginBottom = '10px';
    togglePreviewBtn.innerHTML = 'рџ‘ЃпёЏ РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ Markdown';
    processDescriptionInput.parentNode.insertBefore(togglePreviewBtn, processDescriptionInput);

    let isPreviewMode = false;
    togglePreviewBtn.addEventListener('click', () => {
        isPreviewMode = !isPreviewMode;
        togglePreviewBtn.innerHTML = isPreviewMode ? 'вњЏпёЏ Р РµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ' : 'рџ‘ЃпёЏ РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ Markdown';
        processDescriptionInput.style.display = isPreviewMode ? 'none' : 'block';
        previewContainer.style.display = isPreviewMode ? 'block' : 'none';
        if (isPreviewMode) previewContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(processDescriptionInput.value || '*РџСѓСЃС‚Рѕ*') : processDescriptionInput.value;
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

    // 3. РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ
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
    downloadVsdxBtn.addEventListener('click', downloadCurrentVsdx);

    renderDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    regenerateDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    zoomInBtn.addEventListener('click', () => zoomActiveDiagram(1.1));
    zoomOutBtn.addEventListener('click', () => zoomActiveDiagram(0.9));

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
            if (!prompt) return showNotification('Р’РІРµРґРёС‚Рµ Р·Р°РїСЂРѕСЃ РґР»СЏ Р°РЅР°Р»РёР·Р°', 'error');

            runGlobalAuditBtn.disabled = true;
            runGlobalAuditBtn.innerHTML = '<span class="spinner"></span> РћР±СЂР°Р±РѕС‚РєР°...';
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
                    showNotification(error.error || 'РћС€РёР±РєР° Р°СѓРґРёС‚Р°', 'error');
                }
            } catch (err) {
                console.error(err);
                showNotification('РЎРµС‚РµРІР°СЏ РѕС€РёР±РєР° РїСЂРё Р°СѓРґРёС‚Рµ', 'error');
            } finally {
                runGlobalAuditBtn.disabled = false;
                runGlobalAuditBtn.innerHTML = 'рџљЂ Р—Р°РїСѓСЃС‚РёС‚СЊ РђРЅР°Р»РёР·';
            }
        });
    }

    const refreshMapBtn = document.getElementById('refresh-map-btn');
    const cyZoomIn = document.getElementById('cy-zoom-in');
    const cyZoomOut = document.getElementById('cy-zoom-out');
    const cyFit = document.getElementById('cy-fit');
    let cy; // Cytoscape instance
    const adminMapRootLabel = 'Р‘РёР·РЅРµСЃ-РїСЂРѕС†РµСЃСЃС‹\nРЎРµРЅС‚СЂР°СЃ РРЅС€СѓСЂР°РЅСЃ';

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

            // РљРћР РќР•Р’РћР™ РЈР—Р•Р›
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
                // РЎРІСЏР·СЊ РѕС‚ РєРѕСЂРЅСЏ Рє РґРµРїР°СЂС‚Р°РјРµРЅС‚Сѓ
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
                        description: proc.description || 'РћРїРёСЃР°РЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚',
                        goal: proc.goal || 'Р¦РµР»СЊ РЅРµ СѓРєР°Р·Р°РЅР°',
                        owner: proc.owner || 'РќРµ РЅР°Р·РЅР°С‡РµРЅ',
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
                            label: 'РџСЂРѕС†РµСЃСЃ'
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
                            label: 'Р§Р°С‚'
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

                // --- Р’РЎРџР›Р«Р’РђР®Р©Р•Р• РћРљРќРћ (TOOLTIP) Р”Р›РЇ Р”Р•РџРђР РўРђРњР•РќРўРћР’ ---
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

                    tooltip.innerHTML = `<strong>${node.data('rawName')}</strong>\n\n<b>Р’СЃРµРіРѕ РїСЂРѕС†РµСЃСЃРѕРІ:</b> ${processes}\n<b>Р’СЃРµРіРѕ С‡Р°С‚РѕРІ:</b> ${chats}\n\nРЈС‚РІРµСЂР¶РґРµРЅРЅС‹С…: ${stats.approved}\nР§РµСЂРЅРѕРІРёРєРѕРІ: ${stats.draft}\nРќР° РїСЂРѕРІРµСЂРєРµ: ${stats.pending_review}\nРќСѓР¶РЅС‹ РїСЂР°РІРєРё: ${stats.needs_revision}\nР—Р°РІРµСЂС€РµРЅРЅС‹С…: ${stats.completed || 0}`;
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
                toggleChatsMapBtn.innerText = 'рџ‘ЃпёЏ РЎРєСЂС‹С‚СЊ С‡Р°С‚С‹';
                document.querySelector('.map-controls').appendChild(toggleChatsMapBtn);

                let chatsVisible = true;
                toggleChatsMapBtn.onclick = () => {
                    chatsVisible = !chatsVisible;
                    toggleChatsMapBtn.innerText = chatsVisible ? 'рџ‘ЃпёЏ РЎРєСЂС‹С‚СЊ С‡Р°С‚С‹' : 'рџ‘ЃпёЏ РџРѕРєР°Р·Р°С‚СЊ С‡Р°С‚С‹';
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
                    exportPngBtn.innerHTML = 'рџ–јпёЏ Р­РєСЃРїРѕСЂС‚ PNG';
                    document.querySelector('.map-controls').appendChild(exportPngBtn);

                    exportPngBtn.onclick = () => {
                        const png64 = cy.png({ bg: '#f8fafc', full: true, scale: 2 });
                        const a = document.createElement('a');
                        a.href = png64;
                        a.download = 'РљР°СЂС‚Р°_РџСЂРѕС†РµСЃСЃРѕРІ.png';
                        a.click();
                    };
                }

                let shareBoardBtn = document.getElementById('cy-share-board');
                if (!shareBoardBtn) {
                    shareBoardBtn = document.createElement('button');
                    shareBoardBtn.id = 'cy-share-board';
                    shareBoardBtn.className = 'button-primary';
                    shareBoardBtn.innerHTML = 'рџ”— РџРѕРґРµР»РёС‚СЊСЃСЏ РґР°С€Р±РѕСЂРґРѕРј';
                    document.querySelector('.map-controls').appendChild(shareBoardBtn);

                    shareBoardBtn.onclick = () => {
                        const shareUrl = window.location.origin + '/dash';
                        navigator.clipboard.writeText(shareUrl).then(() => showNotification('РЎСЃС‹Р»РєР° РЅР° РґР°С€Р±РѕСЂРґ СЃРєРѕРїРёСЂРѕРІР°РЅР°!', 'success'));
                        window.open(shareUrl, '_blank');
                    };
                }

                const toggleCollapseBtn = document.getElementById('btn-toggle-collapse');
                if (toggleCollapseBtn) {
                    let isAllCollapsed = false;
                    toggleCollapseBtn.onclick = () => {
                        isAllCollapsed = !isAllCollapsed;
                        toggleCollapseBtn.innerText = isAllCollapsed ? 'Р Р°Р·РІРµСЂРЅСѓС‚СЊ РІСЃРµ' : 'РЎРІРµСЂРЅСѓС‚СЊ РІСЃРµ';
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

                // --- РР РћР¦Р•РќРљРђ РЎР’РЇР—Р•Р™ ---
                let aiLinkBtn = document.getElementById('cy-ai-link-btn');
                let toggleAiLinksBtn = document.getElementById('cy-toggle-ai-links');

                if (!aiLinkBtn) {
                    aiLinkBtn = document.createElement('button');
                    aiLinkBtn.id = 'cy-ai-link-btn';
                    aiLinkBtn.className = 'button-primary';
                    aiLinkBtn.innerHTML = 'рџЄ„ РЎРІСЏР·СЊ РїСЂРѕС†РµСЃСЃРѕРІ (РР)';
                    document.querySelector('.map-controls').appendChild(aiLinkBtn);

                    toggleAiLinksBtn = document.createElement('button');
                    toggleAiLinksBtn.id = 'cy-toggle-ai-links';
                    toggleAiLinksBtn.className = 'button-secondary';
                    toggleAiLinksBtn.style.display = 'none';
                    toggleAiLinksBtn.innerHTML = 'рџ‘ЃпёЏ РЎРєСЂС‹С‚СЊ СЃРІСЏР·Рё РР';
                    document.querySelector('.map-controls').appendChild(toggleAiLinksBtn);

                    aiLinkBtn.onclick = async () => {
                        const nodes = cy.nodes('.process');
                        if (nodes.length < 2) return showNotification('РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂРѕС†РµСЃСЃРѕРІ РґР»СЏ Р°РЅР°Р»РёР·Р°', 'error');

                        setButtonLoading(aiLinkBtn, true, 'РђРЅР°Р»РёР·...');
                        const processesData = nodes.map(n => ({ 
                            id: n.id(), 
                            name: n.data('rawName'), 
                            desc: n.data('description') 
                        }));

                        const prompt = `РўС‹ вЂ” Р±РёР·РЅРµСЃ-Р°СЂС…РёС‚РµРєС‚РѕСЂ. РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ СЌС‚РѕС‚ СЃРїРёСЃРѕРє РїСЂРѕС†РµСЃСЃРѕРІ Рё РЅР°Р№РґРё Р»РѕРіРёС‡РµСЃРєРёРµ СЃРІСЏР·Рё (РєС‚Рѕ РєРѕРјСѓ РїРµСЂРµРґР°РµС‚ РґР°РЅРЅС‹Рµ, РєС‚Рѕ Р·Р° РєРµРј СЃР»РµРґСѓРµС‚). 
Р’РµСЂРЅРё РЎРўР РћР“Рћ JSON-РјР°СЃСЃРёРІ РѕР±СЉРµРєС‚РѕРІ: [{"source": "id_РёСЃС‚РѕС‡РЅРёРєР°", "target": "id_С†РµР»Рё", "reason": "РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ СЃРІСЏР·Рё"}]. РќРµ РїРёС€Рё markdown, С‚РѕР»СЊРєРѕ РіРѕР»С‹Р№ JSON.
Р•СЃР»Рё СЃРІСЏР·РµР№ РЅРµС‚, РІРµСЂРЅРё РїСѓСЃС‚РѕР№ РјР°СЃСЃРёРІ [].
РџСЂРѕС†РµСЃСЃС‹: ${JSON.stringify(processesData)}`;

                        try {
                            const res = await callGeminiAPI(prompt);
                            // Р‘РѕР»РµРµ РЅР°РґРµР¶РЅРѕРµ РёР·РІР»РµС‡РµРЅРёРµ JSON (РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Рё РїСѓСЃС‚С‹Рµ РјР°СЃСЃРёРІС‹, Рё markdown-РѕР±РµСЂС‚РєРё)
                            const jsonMatch = res.match(/\[\s*([\s\S]*)\s*\]/);
                            if (!jsonMatch) throw new Error("Could not find JSON array in AI response");
                            
                            const links = JSON.parse(jsonMatch[0]);
                            if (!Array.isArray(links)) throw new Error("AI response is not an array");

                            if (links.length === 0) {
                                showNotification('РР РЅРµ РЅР°С€РµР» РЅРѕРІС‹С… Р»РѕРіРёС‡РµСЃРєРёС… СЃРІСЏР·РµР№', 'info');
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
                                    // Р”РѕР±Р°РІР»СЏРµРј РЅР° РєР°СЂС‚Сѓ, РµСЃР»Рё РµС‰Рµ РЅРµС‚
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

                                        // РЎРћРҐР РђРќР•РќРР• Р’ Р‘Р” Р”Р›РЇ РџР•Р РЎРРЎРўР•РќРўРќРћРЎРўР
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
                                showNotification(`РР РЅР°С€РµР» Рё СЃРѕС…СЂР°РЅРёР» ${addedCount} РЅРѕРІС‹С… СЃРІСЏР·РµР№!`, 'success');
                                toggleAiLinksBtn.style.display = 'inline-block';
                            } else {
                                showNotification('РќРѕРІС‹С… СЃРІСЏР·РµР№ РЅРµ РЅР°Р№РґРµРЅРѕ (РІСЃРµ СѓР¶Рµ РµСЃС‚СЊ РЅР° РєР°СЂС‚Рµ)', 'info');
                            }

                        } catch (e) {
                            console.error('AI Link Error:', e);
                            showNotification('РћС€РёР±РєР° Р°РЅР°Р»РёР·Р°: ' + e.message, 'error');
                        } finally {
                            setButtonLoading(aiLinkBtn, false, 'рџЄ„ РЎРІСЏР·СЊ РїСЂРѕС†РµСЃСЃРѕРІ (РР)');
                        }
                    };

                    let aiLinksVisible = true;
                    toggleAiLinksBtn.onclick = () => {
                        aiLinksVisible = !aiLinksVisible;
                        toggleAiLinksBtn.innerHTML = aiLinksVisible ? 'рџ‘ЃпёЏ РЎРєСЂС‹С‚СЊ СЃРІСЏР·Рё РР' : 'рџ‘ЃпёЏ РџРѕРєР°Р·Р°С‚СЊ СЃРІСЏР·Рё РР';
                        cy.edges().filter(e => !e.hasClass('root-edge') && !e.hasClass('dept-edge') && !e.hasClass('chat-edge')).style('display', aiLinksVisible ? 'element' : 'none');
                    };
                }

                // РЎРІРѕСЂР°С‡РёРІР°РЅРёРµ / Р Р°Р·РІРѕСЂР°С‡РёРІР°РЅРёРµ РїРѕ РєР»РёРєСѓ РЅР° РґРµРїР°СЂС‚Р°РјРµРЅС‚
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

                // UX: РР·РјРµРЅРµРЅРёРµ РєСѓСЂСЃРѕСЂР° РїСЂРё РЅР°РІРµРґРµРЅРёРё РЅР° СЌР»РµРјРµРЅС‚С‹
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
                                showNotification('РЎРІСЏР·СЊ СЃРѕР·РґР°РЅР°', 'success');
                            } else {
                                addedEles.remove();
                                showNotification('РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ СЃРІСЏР·Рё', 'error');
                            }
                        } catch (err) {
                            addedEles.remove();
                            showNotification('РћС€РёР±РєР°: ' + err.message, 'error');
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
                        showNotification('РЎРЅР°С‡Р°Р»Р° СЃРѕР·РґР°Р№С‚Рµ РґРµРїР°СЂС‚Р°РјРµРЅС‚ (Р§РµСЂРµР· Р°РґРјРёРЅ-РїР°РЅРµР»СЊ РёР»Рё РїРѕ РїСѓСЃС‚РѕРјСѓ РјРµСЃС‚Сѓ)', 'error');
                        return;
                    }
                    const deptId = depts[0].id().replace('dept_', ''); // Default to first dept
                    const name = prompt('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РЅРѕРІРѕРіРѕ РїСЂРѕС†РµСЃСЃР°:');
                    if (name) {
                        try {
                            await fetchWithAuth('/api/admin/processes', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, department_id: deptId, status: 'draft' })
                            });
                            showNotification('Р§РµСЂРЅРѕРІРёРє РїСЂРѕС†РµСЃСЃР° СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ', 'success');
                            loadProcessMap();
                        } catch (e) {
                            showNotification('РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РїСЂРѕС†РµСЃСЃР°', 'error');
                        }
                    }
                };

                const aiLayoutBtn = document.getElementById('cy-ai-layout');
                if (aiLayoutBtn) {
                    aiLayoutBtn.onclick = async function () {
                        const btn = this;
                        const originalText = btn.innerText;
                        btn.innerText = 'РР СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚...';
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
                                showNotification('РР РјР°РєРµС‚ РїСЂРёРјРµРЅРµРЅ', 'success');
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
                                showNotification('РћС€РёР±РєР° РґР°РЅРЅС‹С… РјР°РєРµС‚Р°', 'error');
                            }
                        } catch (e) {
                            showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
                        } finally {
                            btn.innerText = originalText;
                            btn.disabled = false;
                        }
                    };
                }

                const saveMapBtn = document.getElementById('save-map-btn');
                if (saveMapBtn) {
                    saveMapBtn.onclick = async () => {
                        setButtonLoading(saveMapBtn, true, 'РЎРѕС…СЂР°РЅРµРЅРёРµ...');
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
                                showNotification('РљРѕРѕСЂРґРёРЅР°С‚С‹ РІСЃРµР№ РєР°СЂС‚С‹ СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅС‹', 'success');
                            } else {
                                showNotification('РћС€РёР±РєР° РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё РєР°СЂС‚С‹', 'error');
                            }
                        } catch (e) {
                            showNotification('РћС€РёР±РєР° СЃРІСЏР·Рё: ' + e.message, 'error');
                        } finally {
                            setButtonLoading(saveMapBtn, false);
                        }
                    };
                }

                const autoLayoutBtn = document.getElementById('auto-layout-btn');
                if (autoLayoutBtn) {
                    autoLayoutBtn.onclick = async () => {
                        if (confirm('Р’С‹СЂРѕРІРЅСЏС‚СЊ РІСЃРµ РґРµРїР°СЂС‚Р°РјРµРЅС‚С‹ РїРѕ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё, Р° РёС… РїСЂРѕС†РµСЃСЃС‹ РЎРўР РћР“Рћ РІРµСЂС‚РёРєР°Р»СЊРЅРѕ РІРЅРёР·? (РўРµРєСѓС‰РёРµ РєРѕРѕСЂРґРёРЅР°С‚С‹ Р±СѓРґСѓС‚ РїРµСЂРµР·Р°РїРёСЃР°РЅС‹)')) {
                            // РљРђРЎРўРћРњРќР«Р™ РђР›Р“РћР РРўРњ РР”Р•РђР›Р¬РќРћР™ РР•Р РђР РҐРР
                            const depts = cy.nodes('.department').sort((a, b) => (a.data('rawName') || '').localeCompare(b.data('rawName') || ''));
                            const root = cy.getElementById('root_centras');

                            const spacingX = 300; // РћС‚СЃС‚СѓРї РјРµР¶РґСѓ РєРѕР»РѕРЅРєР°РјРё РґРµРїР°СЂС‚Р°РјРµРЅС‚РѕРІ
                            const startY = 130;   // Y РєРѕРѕСЂРґРёРЅР°С‚Р° РґРµРїР°СЂС‚Р°РјРµРЅС‚РѕРІ
                            const spacingY = 150;  // РЁР°Рі РїРѕ РІРµСЂС‚РёРєР°Р»Рё, С‡С‚РѕР±С‹ РјРµР¶РґСѓ СѓР·Р»Р°РјРё С‡РёС‚Р°Р»РёСЃСЊ СЃРІСЏР·Рё

                            let currentX = -((depts.length - 1) * spacingX) / 2; // Р¦РµРЅС‚СЂРёСЂСѓРµРј РІРµСЃСЊ Р±Р»РѕРє РїРѕ X=0

                            if (root.length) root.position({ x: 0, y: -100 });

                            cy.batch(() => {
                                depts.forEach(dept => {
                                    dept.position({ x: currentX, y: startY });

                                    const children = dept.outgoers('node.process, node.chat');
                                    let currentY = startY + spacingY;

                                    // РЎРЅР°С‡Р°Р»Р° РџСЂРѕС†РµСЃСЃС‹, Р·Р°С‚РµРј Р§Р°С‚С‹
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

                                // РћР±СЂР°Р±РѕС‚РєР° РїСЂРѕС†РµСЃСЃРѕРІ Р±РµР· РґРµРїР°СЂС‚Р°РјРµРЅС‚РѕРІ (СЃРёСЂРѕС‚С‹)
                                const floating = cy.nodes('.process, .chat').filter(n => n.incomers('.department').length === 0);
                                let floatY = startY;
                                floating.forEach(node => {
                                    node.position({ x: currentX, y: floatY });
                                    floatY += spacingY;
                                });
                            });

                            cy.fit(cy.nodes(), 50);

                            // РЎРѕС…СЂР°РЅСЏРµРј РЅРѕРІС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ РІ Р‘Р” РµРґРёРЅС‹Рј Р·Р°РїСЂРѕСЃРѕРј
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
                                showNotification('РђРІС‚Рѕ-РІС‹СЂР°РІРЅРёРІР°РЅРёРµ Рё СЃРѕС…СЂР°РЅРµРЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ', 'success');
                            } else {
                                showNotification('РћС€РёР±РєР° РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ РјР°РєРµС‚Р°', 'error');
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
                    const statusText = isApproved ? 'РћРґРѕР±СЂРµРЅ' : (statusMap[nodeData.status]?.text || 'Р§РµСЂРЅРѕРІРёРє');

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

                    let descHtml = marked.parse(descText || 'РћРїРёСЃР°РЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚');

                    let html = `
                        <div style="margin-bottom: 15px;">
                            <strong>РќР°Р·РІР°РЅРёРµ:</strong><br>
                            <input type="text" id="panel-proc-name" value="${nodeData.rawName || nodeData.name}" style="width: 100%; padding: 5px;" disabled>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>РўРёРї:</strong> ${isChat ? 'Р§Р°С‚' : 'РџСЂРѕС†РµСЃСЃ'}
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>РЎС‚Р°С‚СѓСЃ:</strong> <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        ${!isChat ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Р’Р»Р°РґРµР»РµС†:</strong><br>
                            <span>${nodeData.owner || 'РќРµ РЅР°Р·РЅР°С‡РµРЅ'}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Р¦РµР»СЊ:</strong><br>
                            <p>${nodeData.goal || 'Р¦РµР»СЊ РЅРµ СѓРєР°Р·Р°РЅР°'}</p>
                        </div>
                        ` : ''}
                        <div style="margin-bottom: 15px;">
                            <strong>РћРїРёСЃР°РЅРёРµ:</strong><br>
                            <div class="markdown-body scroll-area" style="max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 4px;">
                                ${descHtml}
                            </div>
                        </div>
                        <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
                            ${isChat ? `<button id="panel-go-chat" class="button-primary">РџРµСЂРµР№С‚Рё РІ С‡Р°С‚</button>` : ''}
                            ${!isChat
                            ? `<button id="panel-delete" class="button-danger">РЈРґР°Р»РёС‚СЊ РїСЂРѕС†РµСЃСЃ</button>`
                            : `<button id="panel-delete-chat" class="button-danger">РЈРґР°Р»РёС‚СЊ С‡Р°С‚</button>`}
                        </div>
                    `;
                    content.innerHTML = html;
                    panel.style.display = 'block';

                    if (isChat) {
                        document.getElementById('panel-go-chat').onclick = () => {
                            panel.style.display = 'none';
                            chatId = nodeData.id.replace('chat_', '');
                            selectedDepartment = { name: 'РљР°СЂС‚Р° РџСЂРѕС†РµСЃСЃРѕРІ' };
                            showMainApp(nodeData.rawName || nodeData.name);
                        };
                    }

                    if (!isChat) {
                        document.getElementById('panel-delete').onclick = async () => {
                            if (confirm(`РЈРґР°Р»РёС‚СЊ РїСЂРѕС†РµСЃСЃ "${nodeData.rawName || nodeData.name}"?`)) {
                                try {
                                    const res = await fetchWithAuth(`/api/admin/processes/${nodeData.id.replace('proc_', '')}`, { method: 'DELETE' });
                                    if (res.ok) {
                                        showNotification('РџСЂРѕС†РµСЃСЃ СѓРґР°Р»РµРЅ', 'success');
                                        panel.style.display = 'none';
                                        loadProcessMap();
                                    }
                                } catch (e) {
                                    showNotification('РћС€РёР±РєР°', 'error');
                                }
                            }
                        };
                    } else {
                        document.getElementById('panel-delete-chat').onclick = async () => {
                            if (confirm(`РЈРґР°Р»РёС‚СЊ С‡Р°С‚ "${nodeData.rawName || nodeData.name}"?`)) {
                                try {
                                    const res = await fetchWithAuth(`/api/chats/${nodeData.id.replace('chat_', '')}`, { method: 'DELETE' });
                                    if (res.ok) {
                                        showNotification('Р§Р°С‚ СѓРґР°Р»РµРЅ', 'success');
                                        panel.style.display = 'none';
                                        loadProcessMap();
                                    }
                                } catch (e) {
                                    showNotification('РћС€РёР±РєР°', 'error');
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
                        contextMenu.innerHTML = `<button id="ctx-add-dept" class="context-menu-action">вћ• Р”РѕР±Р°РІРёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚</button>`;

                        document.getElementById('ctx-add-dept').onclick = async () => {
                            contextMenu.style.display = 'none';
                            const name = prompt('РќР°Р·РІР°РЅРёРµ РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°:');
                            if (name) {
                                try {
                                    await fetchWithAuth('/api/departments', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name, password: '123', user_id: sessionUser.id })
                                    });
                                    showNotification('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ СЃРѕР·РґР°РЅ', 'success');
                                    loadProcessMap();
                                } catch (e) {
                                    showNotification('РћС€РёР±РєР°', 'error');
                                }
                            }
                        };
                    } else if (event.target.hasClass('department')) {
                        // Context menu for department
                        const deptId = event.target.id().replace('dept_', '');
                        const deptName = event.target.data('name');

                        // Improved interaction: use prompt for name but allow multiple actions
                        const action = prompt(`Р”РµРїР°СЂС‚Р°РјРµРЅС‚: ${deptName}\n1 - Р”РѕР±Р°РІРёС‚СЊ РїСЂРѕС†РµСЃСЃ\n2 - РЈРґР°Р»РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚\n\nР’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ РґРµР№СЃС‚РІРёСЏ (1 РёР»Рё 2):`);

                        if (action === '1') {
                            const name = prompt('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РЅРѕРІРѕРіРѕ РїСЂРѕС†РµСЃСЃР°:');
                            if (name) {
                                try {
                                    fetchWithAuth('/api/admin/processes', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name, department_id: deptId, status: 'draft' })
                                    }).then(() => {
                                        showNotification('Р§РµСЂРЅРѕРІРёРє РїСЂРѕС†РµСЃСЃР° СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ', 'success');
                                        loadProcessMap();
                                    });
                                } catch (e) {
                                    showNotification('РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РїСЂРѕС†РµСЃСЃР°', 'error');
                                }
                            }
                        } else if (action === '2') {
                            if (confirm(`Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ РґРµРїР°СЂС‚Р°РјРµРЅС‚ "${deptName}" Рё Р’РЎР• РµРіРѕ РїСЂРѕС†РµСЃСЃС‹?`)) {
                                try {
                                    fetchWithAuth(`/api/admin/departments/${deptId}`, { method: 'DELETE' }).then(() => {
                                        showNotification('Р”РµРїР°СЂС‚Р°РјРµРЅС‚ СѓРґР°Р»РµРЅ', 'success');
                                        loadProcessMap();
                                    });
                                } catch (e) {
                                    showNotification('РћС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё РґРµРїР°СЂС‚Р°РјРµРЅС‚Р°', 'error');
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
            console.error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РєР°СЂС‚С‹:', error);
            showNotification('РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РєР°СЂС‚С‹ РїСЂРѕС†РµСЃСЃРѕРІ', 'error');
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
                    cy.edges('[relation_type = "РЎРІСЏР·Р°РЅРѕ СЃ С‡Р°С‚РѕРј"]').style('display', 'element');
                } else {
                    cy.edges('[relation_type = "РЎРІСЏР·Р°РЅРѕ СЃ С‡Р°С‚РѕРј"]').style('display', 'none');
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
                return showNotification('РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С„Р°Р№Р» (.docx, .txt)', 'error');
            }

            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('documents', files[i]);
            }

            setButtonLoading(massUploadBtn, true, 'РђРЅР°Р»РёР·...');
            massUploadStatus.innerText = 'Р­С‚Р°Рї 1: РР·РІР»РµС‡РµРЅРёРµ С‚РµРєСЃС‚Р° Рё РР-Р°РЅР°Р»РёР·... РћР¶РёРґР°Р№С‚Рµ.';
            massUploadStatus.style.color = '#2a6fdb';

            try {
                const res = await fetch('/api/admin/parse-documents', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': csrfToken },
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ');

                const count = data.parsed?.processes?.length || 0;
                massUploadStatus.innerText = `вњ… РЈСЃРїРµС€РЅРѕ! Р”РѕР±Р°РІР»РµРЅРѕ РїСЂРѕС†РµСЃСЃРѕРІ: ${count}`;
                massUploadStatus.style.color = '#10b981';
                showNotification(`Р”РѕРєСѓРјРµРЅС‚С‹ РѕР±СЂР°Р±РѕС‚Р°РЅС‹. Р”РѕР±Р°РІР»РµРЅРѕ ${count} РїСЂРѕС†РµСЃСЃРѕРІ.`, 'success');

                setTimeout(() => {
                    loadProcessMap();
                    massUploadInput.value = '';
                }, 1500);
            } catch (error) {
                console.error('Upload Error:', error);
                massUploadStatus.innerText = `вќЊ РћС€РёР±РєР°: ${error.message}`;
                massUploadStatus.style.color = '#dc3545';
            } finally {
                setButtonLoading(massUploadBtn, false, 'РђРЅР°Р»РёР·РёСЂРѕРІР°С‚СЊ Рё РґРѕР±Р°РІРёС‚СЊ');
            }
        });
    }

    fetchCsrfToken();
    checkSession();
});
