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
                name: 'klay', 
                padding: 60,
                klay: {
                    direction: 'DOWN',
                    spacing: 100,
                    borderSpacing: 40,
                    layoutHierarchy: true
                }
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

    // Root node for the whole company
    elements.push({ 
        data: { id: 'root_company', name: '🏢 BizPro AI Architecture', type: 'root' }, 
        classes: 'root-node' 
    });

    // 1. Departments (Compound Nodes)
    departments.forEach(dept => {
        elements.push({
            data: { 
                id: `dept_${dept.id}`, 
                name: `📁 ${dept.name}`, 
                rawName: dept.name,
                type: 'department', 
                parent: 'root_company',
                collapsed: false 
            },
            classes: 'department'
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
                type: 'process',
                parent: proc.department_id ? `dept_${proc.department_id}` : undefined
            },
            classes: `process status-${proc.status}`
        });
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
                type: 'chat',
                parent: chat.department_id ? `dept_${chat.department_id}` : undefined
            },
            classes: `process status-chat status-${chat.status}`
        });
    });

    // 4. Relations
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
            'label': 'data(name)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-family': 'Manrope, sans-serif',
            'font-size': '12px',
            'color': '#1e293b',
            'width': 'label',
            'height': 'label',
            'padding': '14px 20px',
            'border-width': 1,
            'border-color': '#e2e8f0',
            'background-color': '#ffffff',
            'shape': 'round-rectangle',
            'text-max-width': '160px',
            'text-wrap': 'wrap',
            'shadow-blur': 10,
            'shadow-color': 'rgba(0,0,0,0.05)',
            'shadow-opacity': 1,
            'shadow-offset-y': 2
        }
    },
    {
        selector: 'node.root-node',
        style: {
            'background-color': '#0f172a',
            'color': '#ffffff',
            'font-weight': '700',
            'font-size': '16px',
            'padding': '20px 30px'
        }
    },
    {
        selector: 'node.department',
        style: {
            'text-valign': 'top',
            'text-halign': 'center',
            'background-color': '#f1f5f9',
            'background-opacity': 0.6,
            'border-width': 2,
            'border-color': '#cbd5e1',
            'border-style': 'solid',
            'font-weight': '700',
            'padding': '40px'
        }
    },
    {
        selector: 'node.process',
        style: {
            'border-width': 2,
            'font-weight': '600'
        }
    },
    {
        selector: 'node.status-approved',
        style: {
            'border-color': '#10b981',
            'background-color': '#f0fdf4'
        }
    },
    {
        selector: 'node.status-pending_review',
        style: {
            'border-color': '#3b82f6',
            'background-color': '#eff6ff'
        }
    },
    {
        selector: 'node.status-draft',
        style: {
            'border-color': '#64748b',
            'background-color': '#f8fafc',
            'border-style': 'dashed'
        }
    },
    {
        selector: 'node.status-needs_revision',
        style: {
            'border-color': '#ef4444',
            'background-color': '#fef2f2'
        }
    },
    {
        selector: 'edge',
        style: {
            'width': 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#64748b',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': '2px'
        }
    }
];

const setupInteractions = () => {
    if (!cy) return;

    // 1. Tooltips for Department Stats
    cy.on('mouseover', 'node.department', function(e) {
        const node = e.target;
        const outgoers = node.descendants();
        let counts = { process: 0, chat: 0, approved: 0 };
        
        outgoers.forEach(n => {
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
            <div>📊 Процессов: ${counts.process}</div>
            <div>✅ Утверждено: ${counts.approved}</div>
            <div>💬 Активных обсуждений: ${counts.chat}</div>
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

    // 2. Department Collapsing
    cy.on('tap', 'node.department', function(e) {
        const node = e.target;
        // Don't toggle if we clicked on a child (though tap events usually bubble, we check target)
        if (e.target !== node) return;

        const isCollapsed = node.data('collapsed');
        const children = node.children();
        const descendantEdges = node.descendants().connectedEdges();

        if (isCollapsed) {
            children.show();
            descendantEdges.show();
            node.data('collapsed', false);
            node.style('background-opacity', 0.6);
        } else {
            children.hide();
            descendantEdges.hide();
            node.data('collapsed', true);
            node.style('background-opacity', 0.2);
        }
    });

    // 3. Side Panel for Process/Chat details
    cy.on('tap', 'node.process, node.chat', function(e) {
        const node = e.target;
        const data = node.data();
        showSidePanel(data);
    });

    // Close panel on background tap
    cy.on('tap', function(e) {
        if (e.target === cy) {
            hideSidePanel();
            tooltip.style.display = 'none';
        }
    });

    // Close button for side panel
    const closeBtn = document.getElementById('close-panel-btn');
    if (closeBtn) {
        closeBtn.onclick = hideSidePanel;
    }

    // 4. Toolbar Listeners
    setupToolbar();

    // UX: Cursor changes
    cy.on('mouseover', 'node', () => document.body.style.cursor = 'pointer');
    cy.on('mouseout', 'node', () => document.body.style.cursor = 'default');
};

const setupToolbar = () => {
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = (e) => {
                e.preventDefault();
                handler(e);
            };
        }
    };

    bind('cy-zoom-in', 'click', () => { if (cy) cy.zoom(cy.zoom() * 1.2); });
    bind('cy-zoom-out', 'click', () => { if (cy) cy.zoom(cy.zoom() * 0.8); });
    bind('cy-fit', 'click', () => { if (cy) cy.fit(); });
    
    // Auto-layout buttons
    const handleAutoLayout = () => {
        if (cy) {
            cy.layout({ 
                name: 'klay', 
                padding: 60,
                klay: {
                    direction: 'DOWN',
                    spacing: 120,
                    layoutHierarchy: true
                }
            }).run();
            cy.fit();
        }
    };

    bind('auto-layout-btn', 'click', handleAutoLayout);
    bind('cy-ai-layout', 'click', handleAutoLayout); // For now, use the same klay layout

    // Placeholder for add node/edge - these likely need API support or are UI only
    bind('cy-add-node', 'click', () => {
        ui.showNotification('Добавление процесса вручную пока в разработке. Пожалуйста, используйте чат или импорт.', 'info');
    });

    bind('cy-add-edge', 'click', () => {
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
        ${data.goal ? `
        <div class="process-detail-item">
            <label>Цель</label>
            <div class="value" style="font-weight: 400; font-size: 14px;">${data.goal}</div>
        </div>` : ''}
        <div class="process-detail-item">
            <label>Описание</label>
            <div class="markdown-body" style="margin-top: 10px;">
                ${htmlDesc}
            </div>
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
                window.dispatchEvent(new CustomEvent('open-chat', { 
                    detail: { id: chatId, name: data.rawName } 
                }));
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
