/**
 * Process Map module (Cytoscape)
 */
import State from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let cy = null;

export const initProcessMap = async (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const data = await api.apiFetch('/api/admin/map');
        console.log('Map data received:', data);
        if (!data || data.error) {
            console.error('Map data error or empty:', data);
            return;
        }

        const elements = buildElements(data);
        console.log(`Initializing Process Map in #${containerId} with ${elements.length} elements`);
        cy = cytoscape({
            container,
            elements,
            style: getMapStyle(),
            layout: { name: 'klay', padding: 50 },
            wheelSensitivity: 0.2
        });

        // Force resize and fit after a short delay to ensure dimensions are ready
        setTimeout(() => {
            if (cy) {
                cy.resize();
                cy.fit();
                console.log('Cytoscape map resized and fit');
            }
        }, 100);

        setupInteractions();
    } catch (err) {
        console.error('Failed to load process map:', err);
    }
};

const buildElements = (data) => {
    const { departments = [], processes = [], relations = [], active_chats = [] } = data;
    const elements = [];

    // 1. Departments (Containers)
    departments.forEach(dept => {
        elements.push({
            data: { id: `dept_${dept.id}`, name: dept.name, type: 'department' },
            classes: 'department'
        });
    });

    // 2. Processes (Approved)
    processes.forEach(proc => {
        elements.push({
            data: { 
                id: `proc_${proc.id}`, 
                name: proc.name, 
                type: 'process',
                parent: proc.department_id ? `dept_${proc.department_id}` : undefined
            },
            classes: `process status-${proc.status}`
        });
    });

    // 3. Active Chats (Drafts/In Review)
    active_chats.forEach(chat => {
        elements.push({
            data: { 
                id: `chat_${chat.id}`, 
                name: chat.name, 
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
                id: rel.id,
                source: `proc_${rel.source_process_id}`, 
                target: `proc_${rel.target_process_id}`,
                label: rel.relation_type
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
            'font-size': '12px',
            'color': '#0f172a',
            'width': 'label',
            'height': 'label',
            'padding': '15px',
            'border-width': 1,
            'border-color': '#e2e8f0',
            'background-color': '#ffffff',
            'shape': 'round-rectangle'
        }
    },
    {
        selector: ':parent',
        style: {
            'text-valign': 'top',
            'text-halign': 'center',
            'background-opacity': 0.05,
            'background-color': '#2563eb',
            'border-width': 2,
            'border-color': '#2563eb',
            'shape': 'rectangle',
            'padding': '30px'
        }
    },
    { 
        selector: '.status-approved', 
        style: { 'background-color': '#ecfdf5', 'border-color': '#10b981', 'border-width': 2 } 
    },
    { 
        selector: '.status-draft, .status-pending_review', 
        style: { 'background-color': '#fffbeb', 'border-color': '#f59e0b', 'border-width': 2 } 
    },
    { 
        selector: '.status-chat', 
        style: { 'border-style': 'dashed' } 
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
            'text-rotation': 'autorotate',
            'text-margin-y': -10
        }
    }
];

const setupInteractions = () => {
    if (!cy) return;
    cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        console.log('Tapped node:', node.data('name'));
    });
};
