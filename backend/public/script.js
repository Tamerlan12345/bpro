document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    /* --- GLOBAL STATE --- */
    let sessionUser = null;
    let chatId = null;
    let selectedDepartment = null;
    let chatVersions = [];
    let panZoomState = { scale: 1, pX: 0, pY: 0, isDragging: false };
    let currentDiagramCode = 'flowchart TD\n  Start["Начало"] --> End["Конец"]';

    // Audio/Transcription State
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    let rerecordCount = 0;
    let timerInterval;
    let secondsRecorded = 0;
    let transcriptionTimerInterval;
    let suggestions = [];

    // Cache Elements
    const diagramContainer = document.getElementById('diagram-container');
    const floatingToolbar = document.getElementById('floating-toolbar');
    const splitViewContainer = document.getElementById('split-view-container');
    const splitViewTextarea = document.getElementById('split-view-textarea');
    const renderDiagramBtn = document.getElementById('render-diagram-btn');
    const placeholderContent = document.querySelector('.placeholder-content');

    // Auth & Layout Elements
    const authWrapper = document.querySelector('.auth-wrapper');
    const loginContainer = document.getElementById('login-container');
    const userLogin = document.getElementById('user-login');
    const departmentSelection = document.getElementById('department-selection');
    const departmentSelectionContainer = document.getElementById('department-selection-container');
    const chatLogin = document.getElementById('chat-login');
    const chatSelectionContainer = document.getElementById('chat-selection-container');
    const adminPanel = document.getElementById('admin-panel');
    const mainContainer = document.querySelector('.container');
    const leftColumn = document.querySelector('.left-column');
    const rightColumn = document.querySelector('.right-column');
    const leftPanelToggle = document.getElementById('left-panel-toggle');
    const rightPanelToggle = document.getElementById('right-panel-toggle');

    // Inputs
    const processDescriptionInput = document.getElementById('process-description');
    const commentInput = document.getElementById('comment-input');
    const transcriptionDisplay = document.querySelector('.transcription-display-area'); // Dynamically created in new HTML? No, removed in user HTML?
    // Wait, user HTML removed transcription-display-area div?
    // User HTML has: <div class="sidebar-block"> ... <textarea id="process-description"> ... </div>
    // It doesn't seem to have transcription-display. I should check if I need to add it back or if processDescription is enough.
    // User HTML preserved audio controls but simplified layout.

    // --- MERMAID EDITOR CLASS ---
    class MermaidEditor {
        constructor() {
            this.code = '';
        }

        setCode(code) {
            this.code = code || 'flowchart TD\n  Start["Начало"] --> End["Конец"]';
        }

        getCode() {
            return this.code;
        }

        updateNode(id, newText, newShape, newColor) {
            const lines = this.code.split('\n');
            let found = false;

            const shapes = {
                'rect': ['[', ']'],
                'rounded': ['(', ')'],
                'diamond': ['{', '}'],
                'database': ['[(', ')]']
            };
            const [open, close] = shapes[newShape] || ['[', ']'];

            const newLines = lines.map(line => {
                const regex = new RegExp(`^(\\s*${id})\\s*([\\(\\[\\{\\>]+)(.*)([\\)\\]\\}\\>]+)(.*)`, 'i');
                const match = line.match(regex);

                if (match) {
                    found = true;
                    const safeText = newText.replace(/"/g, '#quot;');
                    return `${match[1]}${open}"${safeText}"${close}${match[5]}`;
                }
                return line;
            });

            if (!found) {
                newLines.splice(1, 0, `  ${id}${open}"${newText}"${close}`);
            }

            const filteredLines = newLines.filter(l => !l.includes(`style ${id} `) && !l.includes(`:::color`)); // Basic cleanup

            if (newColor && newColor !== 'default') {
                const colorMap = {
                    'green': 'fill:#bbf7d0,stroke:#16a34a,stroke-width:2px',
                    'blue': 'fill:#bfdbfe,stroke:#2563eb,stroke-width:2px',
                    'red': 'fill:#fecaca,stroke:#dc2626,stroke-width:2px',
                    'yellow': 'fill:#fef08a,stroke:#ca8a04,stroke-width:2px'
                };
                filteredLines.push(`  style ${id} ${colorMap[newColor]}`);
            }

            this.code = filteredLines.join('\n');
            this.render();
        }

        updateEdge(edgeId, newText, newType, reverse) {
            const { source, target } = edgeId;
            let lines = this.code.split('\n');

            const types = {
                'solid': '-->',
                'dotted': '-.->',
                'thick': '==>'
            };
            const arrow = types[newType] || '-->';

            const linkRegex = new RegExp(`(${source})\\s*([-=.].+?)\\s*(${target})`);

            const newLines = lines.map(line => {
                const match = line.match(linkRegex);
                if (match) {
                    let src = match[1];
                    let tgt = match[3];

                    if (reverse) {
                        [src, tgt] = [tgt, src];
                    }

                    let newLink = '';
                    if (newText && newText.trim() !== '') {
                        if (newType === 'dotted') newLink = `-. "${newText}" .->`;
                        else if (newType === 'thick') newLink = `== "${newText}" ==>`;
                        else newLink = `-- "${newText}" -->`;
                    } else {
                        newLink = arrow;
                    }

                    return line.replace(match[0], `${src} ${newLink} ${tgt}`);
                }
                return line;
            });

            this.code = newLines.join('\n');
            this.render();
        }

        deleteNode(id) {
            const lines = this.code.split('\n');
            const newLines = lines.filter(line => {
                const isDef = line.trim().startsWith(id);
                const isLink = line.includes(id);
                return !isDef && !isLink;
            });
            this.code = newLines.join('\n');
            this.render();
        }

        deleteEdge(source, target) {
            const lines = this.code.split('\n');
            const linkRegex = new RegExp(`(${source})\\s*([-=.].+?)\\s*(${target})`);
            const newLines = lines.filter(line => !line.match(linkRegex));
            this.code = newLines.join('\n');
            this.render();
        }

        addNode(shape) {
            let idNum = 1;
            while (this.code.includes(`Node${idNum}`)) idNum++;
            const id = `Node${idNum}`;

            let def = `${id}["Новый шаг"]`;
            if (shape === 'diamond') def = `${id}{"Условие"}`;
            if (shape === 'rounded') def = `${id}("Начало")`;

            const lines = this.code.split('\n');
            lines.push(`  ${def}`);
            this.code = lines.join('\n');
            this.render();
        }

        async render() {
            currentDiagramCode = this.code;

            // Check visibility of placeholder
            if (this.code.trim() === '' || this.code.includes('Start["Начало"] --> End["Конец"]')) {
                 // Maybe show placeholder? But we want instant preview.
                 // If default code, show it.
            }
            placeholderContent.parentElement.style.display = 'none';
            diagramContainer.style.display = 'block';

            try {
                const { svg } = await mermaid.render(`mermaid-${Date.now()}`, this.code);
                diagramContainer.innerHTML = svg;

                const svgEl = diagramContainer.querySelector('svg');
                if (svgEl) {
                    svgEl.style.height = '100%';
                    svgEl.style.width = '100%';
                    updateTransform();
                    setupDiagramListeners();
                }

                if (splitViewContainer.style.display !== 'none') {
                    if (document.activeElement !== splitViewTextarea) {
                         splitViewTextarea.value = this.code;
                    }
                }

            } catch (e) {
                console.warn("Mermaid Render Error", e);
            }
        }
    }

    const editor = new MermaidEditor();

    // --- INITIALIZATION ---
    mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose', flowchart: { curve: 'stepBefore' } });

    // --- EVENT LISTENERS ---

    function setupDiagramListeners() {
        const nodes = document.querySelectorAll('.node');
        const edges = document.querySelectorAll('.edgePath');

        nodes.forEach(node => {
            node.addEventListener('click', (e) => {
                if (panZoomState.isDragging) return;
                e.stopPropagation();
                showNodeContext(node);
            });
        });

        edges.forEach(edge => {
            const path = edge.querySelector('path');
            if(path) {
                const clone = path.cloneNode();
                clone.classList.add('edge-hit-area');
                edge.appendChild(clone);
            }

            edge.addEventListener('click', (e) => {
                if (panZoomState.isDragging) return;
                e.stopPropagation();
                showEdgeContext(edge, e);
            });
        });
    }

    // --- CONTEXT MENUS LOGIC ---
    let activeNodeId = null;
    let activeEdgeIds = null;

    const nodeMenu = document.getElementById('node-context-menu');
    const edgeMenu = document.getElementById('edge-context-menu');
    const nodeText = document.getElementById('node-edit-text');
    const edgeText = document.getElementById('edge-edit-text');

    function showNodeContext(nodeEl) {
        hideContextMenus();
        const match = nodeEl.id.match(/^flowchart-(.+)-/);
        if (!match) return;
        activeNodeId = match[1];

        const textEl = nodeEl.querySelector('.nodeLabel');
        nodeText.value = textEl ? textEl.innerText : '';

        positionMenu(nodeMenu, nodeEl);
    }

    function showEdgeContext(edgeEl, event) {
        hideContextMenus();
        let src, tgt;
        edgeEl.classList.forEach(cls => {
            if (cls.startsWith('LS-')) src = cls.replace('LS-', '');
            if (cls.startsWith('LE-')) tgt = cls.replace('LE-', '');
        });

        if (!src || !tgt) return;
        activeEdgeIds = { source: src, target: tgt };

        edgeText.value = '';

        edgeMenu.style.display = 'block';
        edgeMenu.style.left = `${event.clientX + 10}px`;
        edgeMenu.style.top = `${event.clientY}px`;
    }

    function hideContextMenus() {
        nodeMenu.style.display = 'none';
        edgeMenu.style.display = 'none';
    }

    function positionMenu(menu, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        menu.style.display = 'block';
        const menuRect = menu.getBoundingClientRect();
        let left = rect.left + (rect.width / 2) - (menuRect.width / 2);
        let top = rect.top - menuRect.height - 10;

        if (left < 10) left = 10;
        if (top < 10) top = rect.bottom + 10;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    // --- REACTIVE UPDATES (Instant) ---

    nodeText.addEventListener('input', debounce((e) => {
        if(activeNodeId) editor.updateNode(activeNodeId, e.target.value, 'rect', null);
    }, 300));

    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if(activeNodeId) editor.updateNode(activeNodeId, nodeText.value, btn.dataset.shape, null);
        });
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if(activeNodeId) editor.updateNode(activeNodeId, nodeText.value, 'rect', btn.dataset.color);
        });
    });

    document.getElementById('node-delete-btn').addEventListener('click', () => {
        if(activeNodeId) {
            editor.deleteNode(activeNodeId);
            hideContextMenus();
        }
    });

    edgeText.addEventListener('input', debounce((e) => {
        if(activeEdgeIds) editor.updateEdge(activeEdgeIds, e.target.value, 'solid', false);
    }, 300));

    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if(activeEdgeIds) {
                edgeText.value = btn.dataset.text;
                editor.updateEdge(activeEdgeIds, btn.dataset.text, 'solid', false);
            }
        });
    });

    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if(activeEdgeIds) editor.updateEdge(activeEdgeIds, edgeText.value, btn.dataset.style, false);
        });
    });

    document.getElementById('edge-reverse-btn').addEventListener('click', () => {
        if(activeEdgeIds) {
            editor.updateEdge(activeEdgeIds, edgeText.value, 'solid', true);
            hideContextMenus();
        }
    });

    document.getElementById('edge-delete-btn').addEventListener('click', () => {
        if(activeEdgeIds) {
            editor.deleteEdge(activeEdgeIds.source, activeEdgeIds.target);
            hideContextMenus();
        }
    });

    document.querySelectorAll('.add-node-btn').forEach(btn => {
        btn.addEventListener('click', () => editor.addNode(btn.dataset.shape));
    });

    // Zoom Logic
    function updateTransform() {
        const svg = diagramContainer.querySelector('svg');
        if (svg) svg.style.transform = `translate(${panZoomState.pX}px, ${panZoomState.pY}px) scale(${panZoomState.scale})`;
    }
    document.getElementById('zoom-in-btn').addEventListener('click', () => { panZoomState.scale *= 1.2; updateTransform(); });
    document.getElementById('zoom-out-btn').addEventListener('click', () => { panZoomState.scale /= 1.2; updateTransform(); });
    document.getElementById('fit-screen-btn').addEventListener('click', () => { panZoomState = {scale:1, pX:0, pY:0}; updateTransform(); });


    // --- UTILS ---
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu') && !e.target.closest('.node') && !e.target.closest('.edgePath')) {
            hideContextMenus();
        }
    });

    diagramContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.context-menu')) return;
        if (e.ctrlKey || e.button === 1 || e.target === diagramContainer) {
            panZoomState.isDragging = true;
            panZoomState.startX = e.clientX - panZoomState.pX;
            panZoomState.startY = e.clientY - panZoomState.pY;
            diagramContainer.style.cursor = 'grabbing';
        }
    });
    window.addEventListener('mousemove', (e) => {
        if (!panZoomState.isDragging) return;
        panZoomState.pX = e.clientX - panZoomState.startX;
        panZoomState.pY = e.clientY - panZoomState.startY;
        updateTransform();
    });
    window.addEventListener('mouseup', () => {
        panZoomState.isDragging = false;
        diagramContainer.style.cursor = 'default';
    });

    // --- AUTH & API FUNCTIONS (Restored) ---

    async function fetchWithAuth(url, options = {}) {
        const finalOptions = { ...options, credentials: 'include' };
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP Error: ${response.status}` }));
            throw new Error(errorData.error || 'Network error');
        }
        return response;
    }

    function setButtonLoading(button, isLoading, loadingText = '...') {
        if (!button) return;
        if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
        button.disabled = isLoading;
        button.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : button.dataset.originalText;
    }

    async function checkSession() {
        try {
            const response = await fetchWithAuth('/api/auth/session');
            const data = await response.json();
            if (data.user) {
                sessionUser = data.user;
                document.getElementById('logout-btn').style.display = 'block';
                authWrapper.style.display = 'flex';
                if (sessionUser.role === 'admin') {
                    loginContainer.style.display = 'none';
                    adminPanel.style.display = 'block';
                    loadAdminPanel();
                } else {
                    loginContainer.style.display = 'none';
                    departmentSelection.style.display = 'block';
                    loadDepartments();
                }
            } else {
                loginContainer.style.display = 'block';
                authWrapper.style.display = 'flex';
            }
        } catch (error) {
            loginContainer.style.display = 'block';
            authWrapper.style.display = 'flex';
        }
    }

    // Login Events
    document.getElementById('user-login-btn').addEventListener('click', async () => {
        const name = document.getElementById('user-name').value;
        const password = document.getElementById('user-password').value;
        try {
            await fetchWithAuth('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            window.location.reload();
        } catch (e) {
            document.getElementById('user-error').textContent = e.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    });

    // Departments
    async function loadDepartments() {
        const res = await fetchWithAuth('/api/departments');
        const depts = await res.json();
        departmentSelectionContainer.innerHTML = depts.map(d =>
            `<div class="department-card" data-id="${d.id}"><span class="dept-name">${d.name}</span></div>`
        ).join('');

        document.querySelectorAll('.department-card').forEach(card => {
            card.addEventListener('click', () => {
                selectedDepartment = { id: card.dataset.id };
                departmentSelection.style.display = 'none';
                chatLogin.style.display = 'block';
                loadChats(selectedDepartment.id);
            });
        });
    }

    async function loadChats(deptId) {
        const res = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
        const chats = await res.json();
        chatSelectionContainer.innerHTML = chats.map(c =>
            `<div class="chat-card" data-id="${c.id}" data-name="${c.name}"><span>${c.name}</span></div>`
        ).join('');

        document.querySelectorAll('.chat-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
    }

    document.getElementById('chat-login-btn').addEventListener('click', async () => {
        const selected = document.querySelector('.chat-card.selected');
        if (!selected) return;
        const password = document.getElementById('chat-password').value;
        try {
            const res = await fetchWithAuth('/api/auth/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department_id: selectedDepartment.id,
                    name: selected.dataset.name,
                    password
                })
            });
            const chat = await res.json();
            chatId = chat.id;
            showMainApp(chat.name);
        } catch (e) {
            document.getElementById('chat-error').textContent = e.message;
        }
    });

    function showMainApp(name) {
        authWrapper.style.display = 'none';
        mainContainer.style.display = 'block'; // Or flex, depending on layout
        document.getElementById('chat-name-header').textContent = `Чат: ${name}`;

        // SHOW TOOLBAR
        if (floatingToolbar) floatingToolbar.style.display = 'flex';

        loadChatData();
    }

    async function loadChatData() {
        const res = await fetchWithAuth(`/api/chats/${chatId}/versions`);
        const versions = await res.json();
        chatVersions = versions;
        if (versions.length > 0) {
            editor.setCode(versions[0].mermaid_code);
            processDescriptionInput.value = versions[0].process_text;
        } else {
            // New chat
            editor.render(); // Render default or empty
        }
        renderComments(); // Placeholder call
    }

    // Admin Logic Simplified
    async function loadAdminPanel() {
        const pending = await (await fetchWithAuth('/api/admin/chats/pending')).json();
        const inReview = await (await fetchWithAuth('/api/admin/chats/in_review')).json();
        const completed = await (await fetchWithAuth('/api/admin/chats/completed')).json();

        const renderList = (list, elId) => {
            const el = document.getElementById(elId);
            if(el) el.innerHTML = list.map(c => `<li><a href="#" data-id="${c.chat_id}">${c.chats.name} (${c.departments.name})</a></li>`).join('');
        };
        renderList(pending, 'pending-list');
        renderList(inReview, 'in-review-list');
        renderList(completed, 'completed-list');

        // Click handler for lists
        document.querySelectorAll('.admin-list a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                chatId = a.dataset.id;
                showMainApp(a.innerText);
                document.getElementById('back-to-admin-btn').style.display = 'block';
            });
        });
    }

    document.getElementById('back-to-admin-btn').addEventListener('click', () => {
        mainContainer.style.display = 'none';
        authWrapper.style.display = 'flex';
        adminPanel.style.display = 'block';
        if (floatingToolbar) floatingToolbar.style.display = 'none';
    });

    // Init
    checkSession();

    // Panel Toggles
    if(leftPanelToggle) leftPanelToggle.addEventListener('click', () => { leftColumn.classList.toggle('panel-hidden-left'); });
    if(rightPanelToggle) rightPanelToggle.addEventListener('click', () => { rightColumn.classList.toggle('panel-hidden-right'); });

});
