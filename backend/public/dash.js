document.addEventListener('DOMContentLoaded', () => {
    let cy;

    fetch('/api/dash/map').then(r => r.json()).then(data => {
        const elements = [{ data: { id: 'root_centras', name: '👑 Процессы компании Сентрас', type: 'root' }, classes: 'root-node' }];

        (data.departments || []).forEach(dept => {
            elements.push({ data: { id: 'dept_' + dept.id, name: '🏢 ' + dept.name, rawName: dept.name }, position: (dept.x !== null && dept.y !== null) ? { x: parseFloat(dept.x), y: parseFloat(dept.y) } : undefined, classes: 'department' });
            elements.push({ data: { id: 'edge_root_dept_' + dept.id, source: 'root_centras', target: 'dept_' + dept.id }, classes: 'root-edge' });
        });

        (data.processes || []).forEach(proc => {
            elements.push({ data: { id: 'proc_' + proc.id, name: '⚙️ ' + proc.name, rawName: proc.name }, position: (proc.x !== null && proc.y !== null) ? { x: parseFloat(proc.x), y: parseFloat(proc.y) } : undefined, classes: 'process status-' + proc.status });
            if (proc.department_id) elements.push({ data: { id: 'edge_dept_proc_' + proc.id, source: 'dept_' + proc.department_id, target: 'proc_' + proc.id }, classes: 'dept-edge' });
        });

        (data.active_chats || []).forEach(chat => {
            elements.push({ data: { id: 'chat_' + chat.id, name: '💬 ' + chat.name, rawName: chat.name }, position: (chat.x !== null && chat.y !== null) ? { x: parseFloat(chat.x), y: parseFloat(chat.y) } : undefined, classes: 'chat status-' + chat.status });
            if (chat.department_id) elements.push({ data: { id: 'edge_dept_chat_' + chat.id, source: 'dept_' + chat.department_id, target: 'chat_' + chat.id }, classes: 'dept-edge chat-edge' });
        });

        (data.relations || []).forEach(rel => { elements.push({ data: { id: 'rel_' + rel.id, source: 'proc_' + rel.source_process_id, target: 'proc_' + rel.target_process_id, label: rel.relation_type || '' } }); });

        cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: [
                { selector: 'node', style: { 'text-wrap': 'wrap', 'text-valign': 'center', 'text-halign': 'center', 'width': 'label', 'height': 'label', 'font-family': 'system-ui, sans-serif' } },
                { selector: 'node.root-node', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#0f172a', 'color': '#ffffff', 'font-weight': 'bold', 'font-size': 20, 'padding': '25px', 'text-max-width': '300px', 'border-width': 2, 'border-color': '#334155' } },
                { selector: 'node.department', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#2563eb', 'color': '#ffffff', 'font-weight': '600', 'font-size': 16, 'padding': '20px', 'text-max-width': '220px', 'border-width': 3, 'border-color': '#1d4ed8' } },
                { selector: 'node.process', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#ffffff', 'border-width': 2, 'border-color': '#3b82f6', 'color': '#0f172a', 'text-max-width': '180px', 'font-size': 14, 'padding': '15px' } },
                { selector: 'node.chat', style: { 'label': 'data(name)', 'shape': 'round-rectangle', 'background-color': '#f8fafc', 'border-width': 2, 'border-style': 'dashed', 'border-color': '#0ea5e9', 'color': '#0369a1', 'text-max-width': '160px', 'font-size': 13, 'padding': '12px' } },
                { selector: 'node.status-approved', style: { 'border-width': 3, 'border-color': '#10b981', 'background-color': '#ecfdf5' } },
                { selector: 'node.status-draft', style: { 'border-width': 3, 'border-style': 'solid', 'border-color': '#f59e0b', 'background-color': '#fffbeb' } },
                { selector: 'node.status-needs_revision', style: { 'border-width': 3, 'border-color': '#ef4444', 'background-color': '#fef2f2' } },
                { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#94a3b8', 'line-color': '#cbd5e1', 'width': 2, 'font-size': 10, 'color': '#94a3b8', 'text-background-opacity': 1, 'text-background-color': '#fff', 'text-background-padding': 2 } },
                { selector: 'edge.root-edge', style: { 'curve-style': 'taxi', 'taxi-direction': 'vertical', 'target-arrow-shape': 'none', 'width': 3 } },
                { selector: 'edge.dept-edge', style: { 'curve-style': 'taxi', 'taxi-direction': 'vertical' } },
                { selector: 'edge.chat-edge', style: { 'line-style': 'dashed', 'line-color': '#7dd3fc', 'target-arrow-color': '#7dd3fc' } }
            ],
            layout: { name: elements.some(e => e.position) ? 'preset' : 'dagre', rankDir: 'TB', spacingFactor: 1.2, nodeSep: 80, rankSep: 100, padding: 50 },
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

        // Безопасное подключение обработчиков клика
        document.getElementById('btn-fit').addEventListener('click', () => { if (cy) cy.fit(); });
        document.getElementById('btn-zoom-in').addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 1.2); });
        document.getElementById('btn-zoom-out').addEventListener('click', () => { if (cy) cy.zoom(cy.zoom() * 0.8); });
    });
});