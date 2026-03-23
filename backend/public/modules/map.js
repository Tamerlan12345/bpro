/**
 * Process Map module (Enhanced Cytoscape)
 */
import State from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let cy = null;
let tooltip = null;

export const initProcessMap = async (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create tooltip if not exists
    if (!document.getElementById('cy-tooltip')) {
        tooltip = document.createElement('div');
        tooltip.id = 'cy-tooltip';
        document.body.appendChild(tooltip);
    } else {
        tooltip = document.getElementById('cy-tooltip');
    }

    try {
        const data = await api.apiFetch('/api/admin/map');
        if (!data || data.error) {
            console.error('Map data error:', data);
            return;
        }

        const elements = buildElements(data);
        
        // Destroy existing instance if any
        if (cy) cy.destroy();

        cy = cytoscape({
            container,
            elements,
            style: getMapStyle(),
            layout: { 
                name: 'dagre', 
                rankDir: 'TB',
                spacingFactor: 1.2,
                padding: 50
            },
            wheelSensitivity: 0.15,
            selectionType: 'single'
        });

        setTimeout(() => {
            if (cy) {
                cy.resize();
                cy.fit();
            }
        }, 300);

        setupInteractions();
    } catch (err) {
        console.error('Failed to load process map:', err);
    }
};

const buildElements = (data) => {
    const { departments = [], processes = [], relations = [], active_chats = [] } = data;
    const elements = [];

    // Root node for the whole company (Matching dash.js style)
    elements.push({ 
        data: { id: 'root_company', name: '🏢 Бизнес-процессы BizPro AI', type: 'root' }, 
        classes: 'root-node' 
    });

    // 1. Departments
    departments.forEach(dept => {
        elements.push({
            data: { 
                id: `dept_${dept.id}`, 
                name: `🏢 ${dept.name}`, 
                rawName: dept.name,
                type: 'department', 
                collapsed: false 
            },
            classes: 'department'
        });
        // Edge from root to department (Taxi style)
        elements.push({ 
            data: { id: `edge_root_dept_${dept.id}`, source: 'root_company', target: `dept_${dept.id}` }, 
            classes: 'root-edge' 
        });
    });

    // 2. Processes (Approved)
    processes.forEach(proc => {
        elements.push({
            data: { 
                id: `proc_${proc.id}`, 
                name: `⚙️ ${proc.name}`, 
                rawName: proc.name,
                description: proc.description,
                goal: proc.goal,
                status: proc.status,
                type: 'process'
            },
            classes: `process status-${proc.status}`
        });
        if (proc.department_id) {
            elements.push({ 
                data: { id: `edge_dept_proc_${proc.id}`, source: `dept_${proc.department_id}`, target: `proc_${proc.id}` }, 
                classes: 'dept-edge' 
            });
        }
    });

    // 3. Active Chats (In Progress)
    active_chats.forEach(chat => {
        elements.push({
            data: { 
                id: `chat_${chat.id}`, 
                name: `💬 ${chat.name}`, 
                rawName: chat.name,
                description: chat.description,
                status: chat.status,
                type: 'chat'
            },
            classes: `process status-chat status-${chat.status}`
        });
        if (chat.department_id) {
            elements.push({ 
                data: { id: `edge_dept_chat_${chat.id}`, source: `dept_${chat.department_id}`, target: `chat_${chat.id}` }, 
                classes: 'dept-edge chat-edge' 
            });
        }
    });

    // 4. Relations (Inter-process)
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

    return elements;
};

const getMapStyle = () => [
    {
        selector: 'node',
        style: {
            'text-wrap': 'wrap',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 'label',
            'font-family': 'Manrope, system-ui, sans-serif',
            'shadow-blur': 12,
            'shadow-color': '#0f172a',
            'shadow-opacity': 0.08,
            'shadow-offset-y': 4
        }
    },
    {
        selector: 'node.root-node',
        style: {
            'label': 'data(name)',
            'shape': 'round-rectangle',
            'background-color': '#0f172a',
            'color': '#ffffff',
            'font-weight': 'bold',
            'font-size': 18,
            'padding': '20px',
            'text-max-width': 260,
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
            'font-weight': '600',
            'font-size': 14,
            'padding': '16px',
            'text-max-width': 200,
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
            'text-max-width': 170,
            'font-size': 13,
            'font-weight': '500',
            'padding': '12px 16px'
        }
    },
    {
        selector: 'node.status-approved',
        style: { 'border-width': 2, 'border-color': '#10b981', 'background-color': '#f0fdf4' }
    },
    {
        selector: 'node.status-draft',
        style: { 'border-width': 2, 'border-color': '#f59e0b', 'background-color': '#fffbeb' }
    },
    {
        selector: 'node.status-needs_revision',
        style: { 'border-width': 2, 'border-color': '#ef4444', 'background-color': '#fef2f2' }
    },
    {
        selector: 'node.status-pending_review',
        style: { 'border-width': 2, 'border-color': '#3b82f6', 'background-color': '#eff6ff' }
    },
    {
        selector: 'edge',
        style: {
            'label': 'data(label)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#cbd5e1',
            'line-color': '#e2e8f0',
            'width': 2,
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
            'curve-style': 'taxi',
            'taxi-direction': 'vertical',
            'taxi-turn': 20,
            'target-arrow-shape': 'none',
            'width': 3,
            'line-color': '#94a3b8'
        }
    },
    {
        selector: 'edge.dept-edge',
        style: {
            'curve-style': 'taxi',
            'taxi-direction': 'vertical',
            'width': 1.5,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1'
        }
    },
    {
        selector: 'edge.chat-edge',
        style: {
            'line-style': 'dashed',
            'line-color': '#7dd3fc',
            'target-arrow-color': '#7dd3fc'
        }
    }
];

const setupInteractions = () => {
    if (!cy) return;

    // 1. Tooltips for Department Stats
    cy.on('mouseover', 'node.department', function(e) {
        const node = e.target;
        const children = node.connectedEdges('.dept-edge').targets();
        let counts = { process: 0, chat: 0, approved: 0 };
        
        children.forEach(n => {
            if (n.data('type') === 'process') {
                counts.process++;
                if (n.data('status') === 'approved') counts.approved++;
            }
            if (n.data('type') === 'chat') counts.chat++;
        });

        tooltip.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
                ${node.data('rawName')}
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                <div>📊 Процессов: ${counts.process}</div>
                <div>✅ Утверждено: ${counts.approved}</div>
                <div>💬 Активных обсуждений: ${counts.chat}</div>
            </div>
        `;
        tooltip.style.display = 'block';
    });

    cy.on('mousemove', 'node.department', function(e) {
        tooltip.style.left = (e.originalEvent.pageX + 15) + 'px';
        tooltip.style.top = (e.originalEvent.pageY + 15) + 'px';
    });

    cy.on('mouseout', 'node.department', function() {
        tooltip.style.display = 'none';
    });

    // 2. Department Collapsing (Via Edges)
    cy.on('tap', 'node.department', function(e) {
        const node = e.target;
        const isCollapsed = node.data('collapsed');
        const edges = node.connectedEdges('.dept-edge');
        const children = edges.targets();

        if (isCollapsed) {
            children.show();
            edges.show();
            node.data('collapsed', false);
            node.style('background-color', '#2563eb');
        } else {
            children.hide();
            edges.hide();
            node.data('collapsed', true);
            node.style('background-color', '#94a3b8');
        }
    });

    // 3. Search Functionality
    const searchInput = document.getElementById('admin-map-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            if (!term) {
                cy.nodes().show();
                cy.edges().show();
                return;
            }

            cy.nodes().forEach(node => {
                const name = (node.data('name') || '').toLowerCase();
                const rawName = (node.data('rawName') || '').toLowerCase();
                if (name.includes(term) || rawName.includes(term)) {
                    node.show();
                    node.predecessors().show();
                } else {
                    node.hide();
                }
            });
            cy.edges().forEach(edge => {
                if (edge.source().hidden() || edge.target().hidden()) {
                    edge.hide();
                } else {
                    edge.show();
                }
            });
        };
    }

    // 4. Side Panel Details
    cy.on('tap', 'node.process, node.chat', function(e) {
        const node = e.target;
        showSidePanel(node.data());
    });

    cy.on('tap', function(e) {
        if (e.target === cy) {
            hideSidePanel();
            tooltip.style.display = 'none';
        }
    });

    const closeBtn = document.getElementById('close-panel-btn');
    if (closeBtn) {
        closeBtn.onclick = hideSidePanel;
    }

    // 5. Toolbar Listeners
    setupToolbar();

    cy.on('mouseover', 'node', () => document.body.style.cursor = 'pointer');
    cy.on('mouseout', 'node', () => document.body.style.cursor = 'default');
};

const setupToolbar = () => {
    const bind = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.onclick = (e) => { e.preventDefault(); handler(e); };
    };

    bind('cy-zoom-in', () => { if (cy) cy.zoom(cy.zoom() * 1.2); });
    bind('cy-zoom-out', () => { if (cy) cy.zoom(cy.zoom() * 0.8); });
    bind('cy-fit', () => { if (cy) cy.fit(); });
    
    bind('btn-toggle-collapse', (e) => {
        if (!cy) return;
        const depts = cy.nodes('.department');
        const anyExpanded = depts.some(d => !d.data('collapsed'));
        
        if (anyExpanded) {
            depts.forEach(d => { if (!d.data('collapsed')) d.emit('tap'); });
            e.target.innerText = '🔼 Развернуть все';
        } else {
            depts.forEach(d => { if (d.data('collapsed')) d.emit('tap'); });
            e.target.innerText = '🔽 Свернуть все';
        }
    });

    const handleAutoLayout = () => {
        if (cy) {
            cy.layout({ name: 'dagre', rankDir: 'TB', spacingFactor: 1.2, padding: 50 }).run();
            cy.fit();
        }
    };

    bind('auto-layout-btn', handleAutoLayout);
    bind('cy-ai-layout', handleAutoLayout); 
    
    bind('cy-add-node', () => {
        ui.showNotification('Добавление процесса вручную пока в разработке.', 'info');
    });

    bind('cy-add-edge', () => {
        ui.showNotification('Создание связей вручную пока в разработке.', 'info');
    });
};

const showSidePanel = (data) => {
    const panel = document.getElementById('cy-side-panel');
    const content = document.getElementById('panel-content');
    if (!panel || !content) return;

    const statusLabels = {
        'approved': 'Утвержден',
        'pending_review': 'На проверке',
        'draft': 'Черновик',
        'needs_revision': 'Нужны правки'
    };

    let desc = data.description || 'Описание отсутствует';
    let htmlDesc = typeof marked !== 'undefined' ? marked.parse(desc) : desc;

    content.innerHTML = `
        <div class="process-detail-item">
            <label>Тип</label>
            <div class="value">${data.type === 'chat' ? '💬 Активный чат' : '⚙️ Бизнес-процесс'}</div>
        </div>
        <div class="process-detail-item">
            <label>Название</label>
            <div class="value">${data.rawName}</div>
        </div>
        <div class="process-detail-item">
            <label>Статус</label>
            <div><span class="status-badge ${data.status}">${statusLabels[data.status] || data.status}</span></div>
        </div>
        ${data.goal ? `<div class="process-detail-item"><label>Цель</label><div class="value" style="font-weight: 400; font-size: 14px;">${data.goal}</div></div>` : ''}
        <div class="process-detail-item">
            <label>Описание</label>
            <div class="markdown-body" style="margin-top: 10px;">${htmlDesc}</div>
        </div>
        <div style="margin-top: 30px;">
            <button id="side-panel-open-chat" class="button-primary" style="width: 100%;">Перейти к чату</button>
        </div>
    `;

    const openChatBtn = document.getElementById('side-panel-open-chat');
    if (openChatBtn) {
        openChatBtn.onclick = () => {
            const chatId = data.type === 'chat' ? data.id.replace('chat_', '') : null;
            if (chatId) {
                window.dispatchEvent(new CustomEvent('open-chat', { detail: { id: chatId, name: data.rawName } }));
            } else {
                ui.showNotification('Переход к чату доступен только для активных обсуждений', 'info');
            }
        };
    }
    panel.classList.remove('hidden');
};

const hideSidePanel = () => {
    const panel = document.getElementById('cy-side-panel');
    if (panel) panel.classList.add('hidden');
};
