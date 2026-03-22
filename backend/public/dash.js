document.addEventListener('DOMContentLoaded', () => {
    let cy;

    fetch('/api/dash/map').then(r => r.json()).then(data => {
        // Добавляем стили для тултипа прямо в dash
        const style = document.createElement('style');
        style.innerHTML = `
            #cy-tooltip {
                position: absolute; display: none; background: rgba(15, 23, 42, 0.95);
                color: #fff; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;
                pointer-events: none; z-index: 9999; backdrop-filter: blur(4px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.1);
            }
        `;
        document.head.appendChild(style);

        const elements = [{ data: { id: 'root_centras', name: 'Бизнес-процессы АО СК Сентрас Иншуранс', type: 'root' }, classes: 'root-node' }];

        (data.departments || []).forEach(dept => {
            elements.push({ data: { id: 'dept_' + dept.id, name: '🏢 ' + dept.name, rawName: dept.name, collapsed: false }, position: (dept.x !== null && dept.y !== null) ? { x: parseFloat(dept.x), y: parseFloat(dept.y) } : undefined, classes: 'department' });
            elements.push({ data: { id: 'edge_root_dept_' + dept.id, source: 'root_centras', target: 'dept_' + dept.id }, classes: 'root-edge' });
        });

        (data.processes || []).forEach(proc => {
            elements.push({ data: { id: 'proc_' + proc.id, name: '⚙️ ' + proc.name, rawName: proc.name, description: proc.description, status: proc.status, type: 'process' }, position: (proc.x !== null && proc.y !== null) ? { x: parseFloat(proc.x), y: parseFloat(proc.y) } : undefined, classes: 'process status-' + proc.status });
            if (proc.department_id) elements.push({ data: { id: 'edge_dept_proc_' + proc.id, source: 'dept_' + proc.department_id, target: 'proc_' + proc.id }, classes: 'dept-edge' });
        });

        (data.active_chats || []).forEach(chat => {
            elements.push({ data: { id: 'chat_' + chat.id, name: '💬 ' + chat.name, rawName: chat.name, description: chat.description, status: chat.status, type: 'chat' }, position: (chat.x !== null && chat.y !== null) ? { x: parseFloat(chat.x), y: parseFloat(chat.y) } : undefined, classes: 'chat status-' + chat.status });
            if (chat.department_id) elements.push({ data: { id: 'edge_dept_chat_' + chat.id, source: 'dept_' + chat.department_id, target: 'chat_' + chat.id }, classes: 'dept-edge chat-edge' });
        });

        (data.relations || []).forEach(rel => { elements.push({ data: { id: 'rel_' + rel.id, source: 'proc_' + rel.source_process_id, target: 'proc_' + rel.target_process_id, label: rel.relation_type || '' } }); });

        cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'text-wrap': 'wrap', 'text-valign': 'center', 'text-halign': 'center',
                        'width': 'label', 'height': 'label', 'font-family': 'system-ui, -apple-system, sans-serif',
                        'shadow-blur': 12, 'shadow-color': '#0f172a', 'shadow-opacity': 0.08, 'shadow-offset-y': 4
                    }
                },
                { selector: 'node.root-node', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#0f172a', 'color': '#ffffff', 'font-weight': 'bold', 'font-size': 18, 'padding': '20px', 'text-max-width': 260, 'border-width': 0 } },
                { selector: 'node.department', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#2563eb', 'color': '#ffffff', 'font-weight': '600', 'font-size': 14, 'padding': '16px', 'text-max-width': 200, 'border-width': 0, 'transition-property': 'opacity', 'transition-duration': '0.3s' } },
                { selector: 'node.process', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#ffffff', 'border-width': 1, 'border-color': '#cbd5e1', 'color': '#1e293b', 'text-max-width': 170, 'font-size': 13, 'font-weight': '500', 'padding': '12px 16px' } },
                { selector: 'node.chat', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#f8fafc', 'border-width': 2, 'border-style': 'dashed', 'border-color': '#94a3b8', 'color': '#475569', 'text-max-width': 150, 'font-size': 12, 'padding': '10px 14px' } },

                { selector: 'node.status-approved', style: { 'border-width': 2, 'border-color': '#10b981', 'background-color': '#f0fdf4' } },
                { selector: 'node.status-draft', style: { 'border-width': 2, 'border-color': '#f59e0b', 'background-color': '#fffbeb' } },
                { selector: 'node.status-needs_revision', style: { 'border-width': 2, 'border-color': '#ef4444', 'background-color': '#fef2f2' } },
                { selector: 'node.status-pending_review', style: { 'border-width': 2, 'border-color': '#3b82f6', 'background-color': '#eff6ff' } },

                { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#cbd5e1', 'line-color': '#e2e8f0', 'width': 2, 'font-size': 10, 'color': '#64748b', 'text-background-opacity': 1, 'text-background-color': '#ffffff', 'text-background-padding': 3 } },
                { selector: 'edge.root-edge', style: { 'curve-style': 'taxi', 'taxi-direction': 'vertical', 'target-arrow-shape': 'none', 'width': 3, 'line-color': '#94a3b8' } },
                { selector: 'edge.dept-edge', style: { 'curve-style': 'taxi', 'taxi-direction': 'vertical', 'width': 1.5, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1' } },
                { selector: 'edge.chat-edge', style: { 'line-style': 'dashed', 'line-color': '#7dd3fc', 'target-arrow-color': '#7dd3fc' } }
            ],
            layout: { name: elements.some(e => e.position) ? 'preset' : 'dagre', rankDir: 'TB', spacingFactor: 0.85, nodeSep: 40, rankSep: 70, padding: 30 },
            userZoomingEnabled: true, userPanningEnabled: true, boxSelectionEnabled: false
        });

        document.getElementById('dash-search').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            if (!val) {
                cy.nodes().style('opacity', 1); cy.edges().style('opacity', 1); return;
            }
            cy.nodes().forEach(n => {
                const name = n.data('rawName') || n.data('name') || '';
                if (name.toLowerCase().includes(val) || n.id() === 'root_centras') n.style('opacity', 1);
                else n.style('opacity', 0.15);
            });
            cy.edges().style('opacity', 0.15);
        });

        // --- ВСПЛЫВАЮЩЕЕ ОКНО (TOOLTIP) ДЛЯ ДЕПАРТАМЕНТОВ ---
        let tooltip = document.createElement('div');
        tooltip.id = 'cy-tooltip';
        document.body.appendChild(tooltip);

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
            });

            tooltip.innerHTML = `<strong>🏢 ${node.data('rawName')}</strong>\n\n📊 <b>Всего процессов:</b> ${processes}\n💬 <b>Всего чатов:</b> ${chats}\n\n✅ Утвержденных: ${stats.approved}\n📝 Черновиков: ${stats.draft}\n⏳ На проверке: ${stats.pending_review}\n❌ Нужны правки: ${stats.needs_revision}`;
            tooltip.style.display = 'block';
        });
        cy.on('mousemove', 'node.department', function (e) {
            tooltip.style.left = (e.originalEvent.pageX + 15) + 'px';
            tooltip.style.top = (e.originalEvent.pageY + 15) + 'px';
        });
        cy.on('mouseout', 'node.department', function () {
            tooltip.style.display = 'none';
        });

        const sidePanel = document.getElementById('dash-side-panel');
        const panelTitle = document.getElementById('dash-panel-title');
        const panelContent = document.getElementById('dash-panel-content');
        const panelCloseBtn = document.getElementById('dash-panel-close');

        panelCloseBtn.addEventListener('click', () => {
            sidePanel.style.display = 'none';
        });

        cy.on('tap', 'node.process, node.chat', function (evt) {
            const nodeData = evt.target.data();
            const isChat = nodeData.type === 'chat';

            panelTitle.innerText = isChat ? 'Детали чата' : 'Детали процесса';

            const statusMap = {
                'approved': 'Утвержден',
                'draft': 'Черновик',
                'needs_revision': 'Нужны правки',
                'pending_review': 'На проверке',
                'completed': 'Завершен',
                'archived': 'В архиве'
            };

            let desc = nodeData.description || 'Описание отсутствует';
            let htmlDesc = typeof marked !== 'undefined' ? marked.parse(desc) : desc;

            panelContent.innerHTML = `
                <div style="margin-bottom: 12px;"><strong>Название:</strong> ${nodeData.rawName}</div>
                <div style="margin-bottom: 12px;"><strong>Статус:</strong> ${statusMap[nodeData.status] || nodeData.status}</div>
                <div style="margin-bottom: 8px;"><strong>Текстовое описание:</strong></div>
                <div class="markdown-body">${htmlDesc}</div>
            `;
            sidePanel.style.display = 'flex';
        });

        // Индивидуальное сворачивание/разворачивание департаментов по клику
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

        // Глобальное сворачивание
        let isAllCollapsed = false;
        const btnToggleCollapse = document.getElementById('btn-toggle-collapse');
        if (btnToggleCollapse) {
            btnToggleCollapse.addEventListener('click', () => {
                isAllCollapsed = !isAllCollapsed;
                btnToggleCollapse.innerText = isAllCollapsed ? '🔼 Развернуть все' : '🔽 Свернуть все';
                cy.nodes('.department').forEach(deptNode => {
                    const outEdges = deptNode.outgoers('edge.dept-edge');
                    const childNodes = outEdges.targets();
                    childNodes.style('display', isAllCollapsed ? 'none' : 'element');
                    outEdges.style('display', isAllCollapsed ? 'none' : 'element');
                    deptNode.data('collapsed', isAllCollapsed);
                    deptNode.style('opacity', isAllCollapsed ? 0.6 : 1);
                });
            });
        }

        // UX: Изменение курсора при наведении на элементы
        cy.on('mouseover', 'node', () => document.body.style.cursor = 'pointer');
        cy.on('mouseout', 'node', () => document.body.style.cursor = 'default');

        // Безопасное подключение обработчиков клика
        document.getElementById('btn-fit').addEventListener('click', () => { if (cy) cy.fit(); });
        document.getElementById('btn-zoom-in').addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 1.2); });
        document.getElementById('btn-zoom-out').addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 0.8); });
    });
});