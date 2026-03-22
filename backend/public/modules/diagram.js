/**
 * Diagram Rendering & Manipulation module (BPMN, Mermaid, Cytoscape)
 */
import State from './state.js';
import { showNotification } from './ui.js';

export const exportToVisio = async () => {
    if (!State.bpmnViewer) {
        showNotification("Сначала сгенерируйте схему.", "error");
        return;
    }
    try {
        const { xml } = await State.bpmnViewer.saveXML({ format: true });
        const blob = new Blob([xml], { type: 'application/bpmn+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'business-process.bpmn';
        link.click();
        URL.revokeObjectURL(url);
        showNotification("BPMN XML успешно экспортирован для Visio.");
    } catch (err) {
        console.error(err);
        showNotification("Ошибка скачивания для Visio.", "error");
    }
};

export const renderBPMN = async (xml) => {
    if (!State.bpmnModeler && !State.bpmnViewer) {
        console.error('BPMN tool not initialized');
        return;
    }

    try {
        const tool = State.isPreviewMode ? State.bpmnViewer : State.bpmnModeler;
        await tool.importXML(xml);
        const canvas = tool.get('canvas');
        canvas.zoom('fit-viewport');
    } catch (err) {
        console.error('BPMN Import Error:', err);
        showNotification('Ошибка при загрузке BPMN схемы', 'error');
    }
};

export const exportDiagram = async (format = 'png') => {
    const container = document.getElementById('diagram-container');
    if (!container) return;

    try {
        const canvas = await html2canvas(container);
        const link = document.createElement('a');
        link.download = `process-map.${format}`;
        link.href = canvas.toDataURL(`image/${format}`);
        link.click();
        showNotification('Схема успешно экспортирована');
    } catch (err) {
        console.error('Export Error:', err);
        showNotification('Ошибка при экспорте схемы', 'error');
    }
};

export const initializeBPMN = () => {
    if (typeof BpmnJS === 'undefined') return false;
    
    const container = document.getElementById('diagram-container');
    if (!container) return false;

    State.bpmnModeler = new BpmnJS({
        container: container,
        keyboard: { bindTo: window }
    });
    
    State.bpmnViewer = new BpmnJS.NavigatedViewer({
        container: container
    });

    return true;
};

// ... more diagram helpers
