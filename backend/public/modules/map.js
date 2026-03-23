/**
 * Process Map module
 */
import * as api from './api.js';
import * as ui from './ui.js';
import { buildStructuredLayout } from './map-layout.mjs';

let cy = null;
let tooltip = null;

const ROOT_ID = 'root_company';
const ROOT_LABEL = 'Бизнес-процессы АО СК Сентрас Иншуранс';

export const initProcessMap = async (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    ensureTooltip();
    resetToolbarState();

    try {
        const data = await api.apiFetch('/api/admin/map');
        if (!data || data.error) {
            console.error('Map data error:', data);
            return;
        }

        const elements = buildElements(data);

        if (cy) cy.destroy();

        cy = cytoscape({
            container,
            elements,
            style: getMapStyle(),
            layout: getInitialLayout(elements),
            selectionType: 'single',
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: false
        });

        setupInteractions();

        setTimeout(() => {
            if (!cy) return;
            cy.resize();
            cy.fit(undefined, 30);
        }, 300);
    } catch (err) {
        console.error('Failed to load process map:', err);
    }
};

const ensureTooltip = () => {
    if (!document.getElementById('cy-tooltip-style')) {
        const style = document.createElement('style');
        style.id = 'cy-tooltip-style';
        style.textContent = `
            #cy-tooltip {
                position: absolute;
                display: none;
                background: rgba(15, 23, 42, 0.95);
                color: #fff;
                padding: 12px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.5;
                pointer-events: none;
                z-index: 9999;
                backdrop-filter: blur(4px);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                white-space: pre-wrap;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
    }

    tooltip = document.getElementById('cy-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'cy-tooltip';
        document.body.appendChild(tooltip);
    }
};

const resetToolbarState = () => {
    const collapseBtn = document.getElementById('btn-toggle-collapse');
    if (collapseBtn) collapseBtn.innerText = '🔽 Свернуть все';
};

const buildElements = (data) => {
    const { departments = [], processes = [], relations = [], active_chats = [] } = data;
    const elements = [
        {
            data: { id: ROOT_ID, name: ROOT_LABEL, type: 'root' },
            classes: 'root-node'
        }
    ];

    departments.forEach((dept) => {
        elements.push({
            data: {
                id: `dept_${dept.id}`,
                name: `🏢 ${dept.name}`,
                rawName: dept.name,
                type: 'department',
                collapsed: false
            },
            position: toPosition(dept),
            classes: 'department'
        });
        elements.push({
            data: {
                id: `edge_root_dept_${dept.id}`,
                source: ROOT_ID,
                target: `dept_${dept.id}`
            },
            classes: 'root-edge'
        });
    });

    processes.forEach((proc) => {
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
            position: toPosition(proc),
            classes: `process status-${proc.status || 'draft'}`
        });

        if (proc.department_id) {
            elements.push({
                data: {
                    id: `edge_dept_proc_${proc.id}`,
                    source: `dept_${proc.department_id}`,
                    target: `proc_${proc.id}`
                },
                classes: 'dept-edge'
            });
        }
    });

    active_chats.forEach((chat) => {
        elements.push({
            data: {
                id: `chat_${chat.id}`,
                name: `💬 ${chat.name}`,
                rawName: chat.name,
                description: chat.description,
                status: chat.status,
                type: 'chat'
            },
            position: toPosition(chat),
            classes: `chat status-${chat.status || 'draft'}`
        });

        if (chat.department_id) {
            elements.push({
                data: {
                    id: `edge_dept_chat_${chat.id}`,
                    source: `dept_${chat.department_id}`,
                    target: `chat_${chat.id}`
                },
                classes: 'dept-edge chat-edge'
            });
        }
    });

    relations.forEach((rel) => {
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

const toPosition = (entity) => {
    if (entity?.x === null || entity?.y === null || entity?.x === undefined || entity?.y === undefined) {
        return undefined;
    }

    const x = Number.parseFloat(entity.x);
    const y = Number.parseFloat(entity.y);

    if (Number.isNaN(x) || Number.isNaN(y)) {
        return undefined;
    }

    return { x, y };
};

const getInitialLayout = (elements) => {
    const hasPresetPositions = elements.some((element) => element.position);
    if (hasPresetPositions) {
        return {
            name: 'preset',
            padding: 30,
            fit: true
        };
    }

    return {
        name: 'dagre',
        rankDir: 'TB',
        spacingFactor: 0.85,
        nodeSep: 40,
        rankSep: 70,
        padding: 30,
        fit: true
    };
};

const getAutoLayout = () => ({
    name: 'dagre',
    rankDir: 'TB',
    spacingFactor: 0.85,
    nodeSep: 40,
    rankSep: 70,
    padding: 30,
    fit: true
});

const getNodesByType = () => ({
    departments: cy ? cy.nodes('.department') : [],
    processes: cy ? cy.nodes('.process') : [],
    chats: cy ? cy.nodes('.chat') : []
});

const serializeNode = (node) => ({
    id: node.id().replace(/^(dept_|proc_|chat_)/, ''),
    name: node.data('name'),
    rawName: node.data('rawName'),
    departmentId: getDepartmentId(node)
});

const getDepartmentId = (node) => {
    if (!node || node.hasClass('department')) return null;

    const departmentNode = node
        .incomers('edge.dept-edge')
        .sources()
        .filter('.department')
        .first();

    if (!departmentNode || departmentNode.empty()) {
        return null;
    }

    return departmentNode.id().replace('dept_', '');
};

const getPositionEndpoint = (node) => {
    if (node.hasClass('department')) {
        return `/api/admin/departments/${node.id().replace('dept_', '')}/position`;
    }

    if (node.hasClass('process')) {
        return `/api/admin/processes/${node.id().replace('proc_', '')}/position`;
    }

    if (node.hasClass('chat')) {
        return `/api/admin/chats/${node.id().replace('chat_', '')}/position`;
    }

    return null;
};

const saveNodePosition = async (node) => {
    const endpoint = getPositionEndpoint(node);
    if (!endpoint) return;

    const { x, y } = node.position();
    await api.apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ x, y })
    });
};

const saveCurrentLayout = async () => {
    if (!cy) return;

    const nodesToSave = cy.nodes('.department, .process, .chat').toArray();
    for (const node of nodesToSave) {
        try {
            await saveNodePosition(node);
        } catch (error) {
            console.error(`Failed to save node position for ${node.id()}:`, error);
        }
    }
};

const applyStructuredLayout = async () => {
    if (!cy) return;

    const { departments, processes, chats } = getNodesByType();
    const layout = buildStructuredLayout({
        rootId: ROOT_ID,
        departments: departments.map(serializeNode),
        processes: processes.map(serializeNode),
        chats: chats.map(serializeNode)
    });

    cy.batch(() => {
        layout.forEach((item) => {
            const prefix = item.type === 'department'
                ? 'dept_'
                : item.type === 'process'
                    ? 'proc_'
                    : item.type === 'chat'
                        ? 'chat_'
                        : '';
            const nodeId = prefix ? `${prefix}${item.id}` : item.id;
            const node = cy.getElementById(nodeId);
            if (node && node.length) {
                node.position({ x: item.x, y: item.y });
            }
        });
    });

    cy.fit(cy.nodes(), 50);
    await saveCurrentLayout();
};

const getMapStyle = () => [
    {
        selector: 'node',
        style: {
            'text-wrap': 'wrap',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 'max-content',
            height: 'max-content',
            'font-family': 'system-ui, -apple-system, sans-serif'
        }
    },
    {
        selector: 'node.root-node',
        style: {
            label: 'data(name)',
            shape: 'round-rectangle',
            'background-color': '#0f172a',
            color: '#ffffff',
            'font-weight': 'bold',
            'font-size': 18,
            padding: '20px',
            'text-max-width': 260,
            'border-width': 0
        }
    },
    {
        selector: 'node.department',
        style: {
            label: 'data(name)',
            shape: 'round-rectangle',
            'background-color': '#2563eb',
            color: '#ffffff',
            'font-weight': '600',
            'font-size': 14,
            padding: '16px',
            'text-max-width': 200,
            'border-width': 0,
            'transition-property': 'opacity',
            'transition-duration': '0.3s'
        }
    },
    {
        selector: 'node.process',
        style: {
            label: 'data(name)',
            shape: 'round-rectangle',
            'background-color': '#ffffff',
            'border-width': 1,
            'border-color': '#cbd5e1',
            color: '#1e293b',
            'text-max-width': 170,
            'font-size': 13,
            'font-weight': '500',
            padding: '12px 16px'
        }
    },
    {
        selector: 'node.chat',
        style: {
            label: 'data(name)',
            shape: 'round-rectangle',
            'background-color': '#f8fafc',
            'border-width': 2,
            'border-style': 'dashed',
            'border-color': '#94a3b8',
            color: '#475569',
            'text-max-width': 150,
            'font-size': 12,
            padding: '10px 14px'
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
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#cbd5e1',
            'line-color': '#e2e8f0',
            width: 2,
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': 3
        }
    },
    {
        selector: 'edge[label]',
        style: {
            label: 'data(label)',
            'font-size': 10,
            color: '#64748b',
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
            width: 3,
            'line-color': '#94a3b8'
        }
    },
    {
        selector: 'edge.dept-edge',
        style: {
            'curve-style': 'taxi',
            'taxi-direction': 'vertical',
            width: 1.5,
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

    cy.removeAllListeners();

    cy.on('mouseover', 'node.department', (event) => {
        const node = event.target;
        const outgoers = node.outgoers('node');
        const stats = { approved: 0, draft: 0, needs_revision: 0, pending_review: 0 };
        let processes = 0;
        let chats = 0;

        outgoers.forEach((child) => {
            if (child.hasClass('process')) processes += 1;
            if (child.hasClass('chat')) chats += 1;

            const status = child.data('status');
            if (stats[status] !== undefined) {
                stats[status] += 1;
            }
        });

        tooltip.innerHTML = `<strong>🏢 ${node.data('rawName')}</strong>\n\n📊 <b>Всего процессов:</b> ${processes}\n💬 <b>Всего чатов:</b> ${chats}\n\n✅ Утвержденных: ${stats.approved}\n📝 Черновиков: ${stats.draft}\n⏳ На проверке: ${stats.pending_review}\n❌ Нужны правки: ${stats.needs_revision}`;
        tooltip.style.display = 'block';
    });

    cy.on('mousemove', 'node.department', (event) => {
        tooltip.style.left = `${event.originalEvent.pageX + 15}px`;
        tooltip.style.top = `${event.originalEvent.pageY + 15}px`;
    });

    cy.on('mouseout', 'node.department', () => {
        tooltip.style.display = 'none';
    });

    cy.on('tap', 'node.department', (event) => {
        toggleDepartment(event.target);
    });

    cy.on('tap', 'node.process, node.chat', (event) => {
        showSidePanel(event.target.data());
    });

    cy.on('tap', (event) => {
        if (event.target === cy) {
            hideSidePanel();
            tooltip.style.display = 'none';
        }
    });

    cy.on('mouseover', 'node', () => {
        document.body.style.cursor = 'pointer';
    });

    cy.on('mouseout', 'node', () => {
        document.body.style.cursor = 'default';
    });

    cy.on('dragfree', 'node.department, node.process, node.chat', async (event) => {
        try {
            await saveNodePosition(event.target);
        } catch (error) {
            console.error('Failed to persist node position:', error);
            ui.showNotification('Не удалось сохранить новую позицию узла.', 'error');
        }
    });

    bindSearch();
    bindPanelClose();
    setupToolbar();
};

const toggleDepartment = (deptNode, shouldCollapse) => {
    const collapse = typeof shouldCollapse === 'boolean' ? shouldCollapse : !deptNode.data('collapsed');
    const outEdges = deptNode.outgoers('edge.dept-edge');
    const childNodes = outEdges.targets();

    childNodes.style('display', collapse ? 'none' : 'element');
    outEdges.style('display', collapse ? 'none' : 'element');
    deptNode.data('collapsed', collapse);
    deptNode.style('opacity', collapse ? 0.6 : 1);
};

const bindSearch = () => {
    const searchInput = document.getElementById('admin-map-search');
    if (!searchInput) return;

    searchInput.oninput = (event) => {
        if (!cy) return;

        const value = event.target.value.trim().toLowerCase();
        if (!value) {
            cy.nodes().style('opacity', 1);
            cy.edges().style('opacity', 1);
            return;
        }

        cy.nodes().forEach((node) => {
            const name = node.data('rawName') || node.data('name') || '';
            node.style('opacity', name.toLowerCase().includes(value) || node.id() === ROOT_ID ? 1 : 0.15);
        });

        cy.edges().style('opacity', 0.15);
    };
};

const bindPanelClose = () => {
    const closeBtn = document.getElementById('close-panel-btn');
    if (closeBtn) {
        closeBtn.onclick = hideSidePanel;
    }
};

const setupToolbar = () => {
    const bind = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.onclick = (event) => {
                event.preventDefault();
                handler(event);
            };
        }
    };

    bind('cy-zoom-in', () => {
        if (cy) cy.zoom(cy.zoom() * 1.2);
    });

    bind('cy-zoom-out', () => {
        if (cy) cy.zoom(cy.zoom() * 0.8);
    });

    bind('cy-fit', () => {
        if (cy) cy.fit(undefined, 30);
    });

    bind('btn-toggle-collapse', (event) => {
        if (!cy) return;

        const departments = cy.nodes('.department');
        const shouldCollapse = departments.some((dept) => !dept.data('collapsed'));

        departments.forEach((dept) => {
            toggleDepartment(dept, shouldCollapse);
        });

        event.currentTarget.innerText = shouldCollapse ? '🔼 Развернуть все' : '🔽 Свернуть все';
    });

    const handleAutoLayout = async () => {
        if (!cy) return;

        try {
            await applyStructuredLayout();
            ui.showNotification('Карта выровнена по структуре и позиции сохранены.', 'success');
        } catch (error) {
            console.error('Failed to apply structured layout:', error);
            ui.showNotification('Не удалось выровнять карту.', 'error');
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
    const title = document.getElementById('panel-title');

    if (!panel || !content) return;

    const statusLabels = {
        approved: 'Утвержден',
        pending_review: 'На проверке',
        draft: 'Черновик',
        needs_revision: 'Нужны правки',
        completed: 'Завершен',
        archived: 'В архиве'
    };

    if (title) {
        title.textContent = data.type === 'chat' ? 'Детали чата' : 'Детали процесса';
    }

    const desc = data.description || 'Описание отсутствует';
    const htmlDesc = typeof marked !== 'undefined' ? marked.parse(desc) : desc;

    content.innerHTML = `
        <div class="process-detail-item">
            <label>Тип</label>
            <div class="value">${data.type === 'chat' ? '💬 Активный чат' : '⚙️ Бизнес-процесс'}</div>
        </div>
        <div class="process-detail-item">
            <label>Название</label>
            <div class="value">${data.rawName || data.name}</div>
        </div>
        <div class="process-detail-item">
            <label>Статус</label>
            <div><span class="status-badge ${data.status}">${statusLabels[data.status] || data.status || 'Не указан'}</span></div>
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
                ui.showNotification('Переход к чату доступен только для активных обсуждений.', 'info');
            }
        };
    }

    panel.classList.remove('hidden');
};

const hideSidePanel = () => {
    const panel = document.getElementById('cy-side-panel');
    if (panel) panel.classList.add('hidden');
};
