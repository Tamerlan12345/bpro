document.addEventListener('DOMContentLoaded', () => {
    const ROOT_ID = 'root_centras';
    let cy;
    let tooltip;

    const sharedLabelNodeStyle = {
        'text-wrap': 'wrap',
        'text-valign': 'center',
        'text-halign': 'center',
        padding: '16px',
        'line-height': 1.6,
        'font-family': '"Manrope", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    };

    const statusMap = {
        approved: 'Утвержден',
        draft: 'Черновик',
        needs_revision: 'Нужны правки',
        pending_review: 'На проверке',
        completed: 'Завершен',
        archived: 'В архиве'
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
                    z-index: 10;
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

    const buildElements = (data) => {
        const { departments = [], processes = [], relations = [], active_chats = [] } = data;
        const elements = [{ data: { id: ROOT_ID, name: 'Бизнес-процессы Сентрас Иншуранс', type: 'root' }, classes: 'root-node' }];

        departments.forEach((dept) => {
            elements.push({
                data: { id: `dept_${dept.id}`, name: dept.name, rawName: dept.name, collapsed: false, type: 'department' },
                position: toPosition(dept),
                classes: 'department'
            });
            elements.push({
                data: { id: `edge_root_dept_${dept.id}`, source: ROOT_ID, target: `dept_${dept.id}` },
                classes: 'root-edge'
            });
        });

        processes.forEach((proc) => {
            elements.push({
                data: {
                    id: `proc_${proc.id}`,
                    name: proc.name,
                    rawName: proc.name,
                    description: proc.description,
                    status: proc.status,
                    type: 'process'
                },
                position: toPosition(proc),
                classes: `process status-${proc.status || 'draft'}`
            });
            if (proc.department_id) {
                elements.push({
                    data: { id: `edge_dept_proc_${proc.id}`, source: `dept_${proc.department_id}`, target: `proc_${proc.id}` },
                    classes: 'dept-edge'
                });
            }
        });

        active_chats.forEach((chat) => {
            elements.push({
                data: {
                    id: `chat_${chat.id}`,
                    name: chat.name,
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
                    data: { id: `edge_dept_chat_${chat.id}`, source: `dept_${chat.department_id}`, target: `chat_${chat.id}` },
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

    const getStyle = () => ([
        { selector: 'node', style: sharedLabelNodeStyle },
        {
            selector: 'node.root-node',
            style: {
                label: 'data(name)',
                shape: 'round-rectangle',
                'background-color': '#0f172a',
                color: '#ffffff',
                width: 320,
                height: 96,
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
                width: 280,
                height: 100,
                'corner-radius': 12,
                'font-weight': '600',
                'font-size': 14,
                padding: '18px',
                'text-max-width': 240,
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
                width: 280,
                height: 110,
                'corner-radius': 8,
                'text-max-width': 240,
                'font-size': 13,
                'font-weight': '500',
                padding: '14px'
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
                width: 280,
                height: 110,
                'corner-radius': 8,
                'text-max-width': 240,
                'font-size': 12,
                padding: '12px',
                opacity: 0.8
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
    ]);

    const hideSidePanel = () => {
        const sidePanel = document.getElementById('dash-side-panel');
        if (!sidePanel) return;
        sidePanel.classList.add('is-hidden');
    };

    const showSidePanel = (nodeData) => {
        const sidePanel = document.getElementById('dash-side-panel');
        const panelTitle = document.getElementById('dash-panel-title');
        const panelContent = document.getElementById('dash-panel-content');
        if (!sidePanel || !panelTitle || !panelContent) return;

        const isChat = nodeData.type === 'chat';
        panelTitle.innerText = isChat ? 'Детали чата' : 'Детали процесса';

        const desc = nodeData.description || 'Описание отсутствует';
        const htmlDesc = typeof marked !== 'undefined' ? marked.parse(desc) : desc;

        panelContent.innerHTML = `
            <div class="process-detail-item">
                <label>Название</label>
                <div class="value">${nodeData.rawName || nodeData.name || 'Без названия'}</div>
            </div>
            <div class="process-detail-item">
                <label>Статус</label>
                <div class="value">${statusMap[nodeData.status] || nodeData.status || 'Не указан'}</div>
            </div>
            <div class="process-detail-item">
                <label>Текстовое описание</label>
                <div class="markdown-body">${htmlDesc}</div>
            </div>
        `;

        sidePanel.classList.remove('is-hidden');
    };

    fetch('/api/dash/map')
        .then((response) => response.json())
        .then((data) => {
            ensureTooltip();

            const elements = buildElements(data);
            const hasPreset = elements.some((item) => item.position);

            cy = cytoscape({
                container: document.getElementById('cy'),
                elements,
                style: getStyle(),
                layout: hasPreset
                    ? { name: 'preset', padding: 30, fit: true }
                    : { name: 'dagre', rankDir: 'TB', spacingFactor: 0.85, nodeSep: 40, rankSep: 70, padding: 30, fit: true },
                userZoomingEnabled: true,
                userPanningEnabled: true,
                boxSelectionEnabled: false
            });

            const searchInput = document.getElementById('dash-search');
            if (searchInput) {
                searchInput.addEventListener('input', (event) => {
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
                });
            }

            cy.on('mouseover', 'node.department', (event) => {
                const node = event.target;
                const outgoers = node.outgoers('node');
                const stats = { approved: 0, draft: 0, needs_revision: 0, pending_review: 0 };
                let processes = 0;
                let chats = 0;

                outgoers.forEach((child) => {
                    if (child.hasClass('process')) processes += 1;
                    if (child.hasClass('chat')) chats += 1;
                    const st = child.data('status');
                    if (stats[st] !== undefined) stats[st] += 1;
                });

                tooltip.innerHTML = `<strong>${node.data('rawName')}</strong>\n\n<b>Всего процессов:</b> ${processes}\n<b>Всего чатов:</b> ${chats}\n\nУтвержденных: ${stats.approved}\nЧерновиков: ${stats.draft}\nНа проверке: ${stats.pending_review}\nНужны правки: ${stats.needs_revision}`;
                tooltip.style.display = 'block';
            });

            cy.on('mousemove', 'node.department', (event) => {
                tooltip.style.left = `${event.originalEvent.pageX + 15}px`;
                tooltip.style.top = `${event.originalEvent.pageY + 15}px`;
            });

            cy.on('mouseout', 'node.department', () => {
                tooltip.style.display = 'none';
            });

            cy.on('tap', 'node.process, node.chat', (event) => {
                showSidePanel(event.target.data());
            });

            cy.on('tap', (event) => {
                if (event.target === cy) {
                    hideSidePanel();
                }
            });

            cy.on('tap', 'node.department', (event) => {
                const deptNode = event.target;
                const isCollapsed = deptNode.data('collapsed');
                const outEdges = deptNode.outgoers('edge.dept-edge');
                const childNodes = outEdges.targets();

                childNodes.style('display', isCollapsed ? 'element' : 'none');
                outEdges.style('display', isCollapsed ? 'element' : 'none');
                deptNode.data('collapsed', !isCollapsed);
                deptNode.style('opacity', isCollapsed ? 1 : 0.6);
            });

            const btnToggleCollapse = document.getElementById('btn-toggle-collapse');
            if (btnToggleCollapse) {
                btnToggleCollapse.addEventListener('click', () => {
                    const departments = cy.nodes('.department');
                    const shouldCollapse = departments.some((dept) => !dept.data('collapsed'));

                    departments.forEach((deptNode) => {
                        const outEdges = deptNode.outgoers('edge.dept-edge');
                        const childNodes = outEdges.targets();
                        childNodes.style('display', shouldCollapse ? 'none' : 'element');
                        outEdges.style('display', shouldCollapse ? 'none' : 'element');
                        deptNode.data('collapsed', shouldCollapse);
                        deptNode.style('opacity', shouldCollapse ? 0.6 : 1);
                    });

                    btnToggleCollapse.innerText = shouldCollapse ? 'Развернуть все' : 'Свернуть все';
                });
            }

            cy.on('mouseover', 'node', () => {
                document.body.style.cursor = 'pointer';
            });

            cy.on('mouseout', 'node', () => {
                document.body.style.cursor = 'default';
            });

            const panelCloseBtn = document.getElementById('dash-panel-close');
            if (panelCloseBtn) {
                panelCloseBtn.addEventListener('click', hideSidePanel);
            }

            const btnFit = document.getElementById('btn-fit');
            if (btnFit) btnFit.addEventListener('click', () => { if (cy) cy.fit(); });

            const btnZoomIn = document.getElementById('btn-zoom-in');
            if (btnZoomIn) btnZoomIn.addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 1.2); });

            const btnZoomOut = document.getElementById('btn-zoom-out');
            if (btnZoomOut) btnZoomOut.addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 0.8); });
        })
        .catch(() => {
            // Keep dashboard alive even when map data is temporarily unavailable.
            hideSidePanel();
        });
});
