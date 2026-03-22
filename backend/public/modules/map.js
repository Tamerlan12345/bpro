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
        if (!data || data.error) return;

        const elements = buildElements(data);
        cy = cytoscape({
            container,
            elements,
            style: getMapStyle(),
            layout: { name: 'klay', padding: 50 }
        });

        setupInteractions();
    } catch (err) {
        console.error('Failed to load process map:', err);
    }
};

const buildElements = (data) => {
    const { departments = [], processes = [], relations = [], active_chats = [] } = data;
    const elements = [];

    // Root node
    elements.push({
        data: { id: 'root', name: 'Бизнес-процессы', type: 'root' },
        classes: 'root-node'
    });

    departments.forEach(dept => {
        elements.push({
            data: { id: `dept_${dept.id}`, name: dept.name, type: 'department' },
            classes: 'department'
        });
        elements.push({ data: { source: 'root', target: `dept_${dept.id}` } });
    });

    processes.forEach(proc => {
        elements.push({
            data: { id: `proc_${proc.id}`, name: proc.name, type: 'process' },
            classes: `process status-${proc.status}`
        });
        if (proc.department_id) {
            elements.push({ data: { source: `dept_${proc.department_id}`, target: `proc_${proc.id}` } });
        }
    });

    return elements;
};

const getMapStyle = () => [
    {
        selector: 'node',
        style: {
            'label': 'data(name)',
            'text-valign': 'center',
            'width': 'label',
            'height': 'label',
            'padding': '10px'
        }
    },
    { selector: '.department', style: { 'background-color': '#2563eb', 'color': '#fff' } },
    { selector: '.process', style: { 'background-color': '#fff', 'border-width': 1 } }
];

const setupInteractions = () => {
    if (!cy) return;
    cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        console.log('Tapped node:', node.data('name'));
    });
};
