const fs = require('fs');
const path = require('path');

describe('bpmn render normalization regression', () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    test('render and editor normalize extracted xml before importing into bpmn-js', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('xml = normalizeGeneratedBpmnXml(extracted);');
        expect(scriptSource).toContain('return normalizeGeneratedBpmnXml(extractPureBpmnXml(xml));');
    });

    test('read-only bpmn render uses the doc-style presentation renderer', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('function renderLockedDiagramView(xml)');
        expect(scriptSource).toContain('diagramMode = \'view\';');
        expect(scriptSource).toContain('currentDiagramModel = window.BpmnPresentation.buildBpmnPresentationModel(xml);');
        expect(scriptSource).toContain('currentDiagramSvg = window.BpmnPresentation.renderDocStyleSvg(currentDiagramModel);');
        expect(scriptSource).toContain('diagramContainer.innerHTML = `<div class="doc-diagram-shell"><div class="doc-diagram-stage">${currentDiagramSvg}</div></div>`;');
    });

    test('visio download keeps the modern vsdx extension in the active client', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain("downloadBlob(blob, 'application/vnd.ms-visio.drawing', 'process-diagram.vsdx');");
    });

    test('toolbar labels the export button as vsdx in the active client', () => {
        const indexSource = fs.readFileSync(indexPath, 'utf8');

        expect(indexSource).toContain('title="Скачать VSDX"');
        expect(indexSource).toContain('aria-label="Скачать VSDX"');
        expect(indexSource).toContain('</svg> VSDX</button>');
    });
});
