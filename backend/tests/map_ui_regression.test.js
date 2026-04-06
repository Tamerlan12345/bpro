const fs = require('fs');
const path = require('path');

describe('map ui regression', () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
    const dashPath = path.join(__dirname, '..', 'public', 'dash.js');
    const moduleMapPath = path.join(__dirname, '..', 'public', 'modules', 'map.js');
    const serverPath = path.join(__dirname, '..', 'server.js');

    test('map node labels do not depend on emoji prefixes', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        const dashSource = fs.readFileSync(dashPath, 'utf8');

        expect(scriptSource).not.toMatch(/name:\s*['"`][рџЏўвљ™рџ’¬]/u);
        expect(dashSource).not.toMatch(/name:\s*['"`][рџЏўвљ™рџ’¬]/u);
    });

    test('map and dash use an explicit readable font stack with emoji fallback', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        const dashSource = fs.readFileSync(dashPath, 'utf8');
        const serverSource = fs.readFileSync(serverPath, 'utf8');

        expect(scriptSource).toContain(`'font-family': '\"Manrope\", \"Segoe UI\", \"Segoe UI Emoji\", \"Apple Color Emoji\", \"Noto Color Emoji\", sans-serif'`);
        expect(dashSource).toContain(`'font-family': '\"Manrope\", \"Segoe UI\", \"Segoe UI Emoji\", \"Apple Color Emoji\", \"Noto Color Emoji\", sans-serif'`);
        expect(serverSource).toContain('font-family: "Manrope", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;');
    });

    test('auto layout waits for all position saves before reporting success', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('await Promise.all(saveRequests);');
        expect(scriptSource).not.toContain("if (ep) fetchWithAuth(ep, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: pos.x, y: pos.y }) }).catch(e => e);");
    });

    test('cytoscape styles do not use invalid max-content dimensions', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        const dashSource = fs.readFileSync(dashPath, 'utf8');

        expect(scriptSource).not.toContain("'width': 'max-content'");
        expect(scriptSource).not.toContain("'height': 'max-content'");
        expect(scriptSource).not.toContain("'width': 'label'");
        expect(scriptSource).not.toContain("'height': 'label'");
        expect(dashSource).not.toContain("width: 'label'");
        expect(dashSource).not.toContain("height: 'label'");
    });

    test('bpmn rendering uses guarded fit logic instead of raw fit-viewport zoom', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('function safelyFitBpmnViewport(viewerInstance, container = diagramContainer)');
        expect(scriptSource).toContain('const canvas = viewerInstance.get(\'canvas\');');
        expect(scriptSource).toContain('Number.isFinite(viewbox.width)');
        expect(scriptSource).toContain('safelyFitBpmnViewport(bpmnViewer, container);');
        expect(scriptSource).toContain('safelyFitBpmnViewport(bpmnModeler, mermaidEditorPreview);');
        expect(scriptSource).not.toContain("bpmnViewer.get('canvas').zoom('fit-viewport');");
        expect(scriptSource).not.toContain("bpmnModeler.get('canvas').zoom('fit-viewport');");
        expect(scriptSource).not.toContain('const minReadableZoom = 0.3;');
        expect(scriptSource).not.toContain('canvas.zoom(minReadableZoom);');
    });

    test('dash and module map use miro node geometry for departments, processes and chats', () => {
        const dashSource = fs.readFileSync(dashPath, 'utf8');
        const mapModuleSource = fs.readFileSync(moduleMapPath, 'utf8');

        expect(dashSource).toContain("width: 280");
        expect(dashSource).toContain("height: 100");
        expect(dashSource).toContain("width: 240");
        expect(dashSource).toContain("height: 80");
        expect(dashSource).toContain("'border-style': 'dashed'");
        expect(dashSource).toContain("opacity: 0.8");

        expect(mapModuleSource).toContain("width: 280");
        expect(mapModuleSource).toContain("height: 100");
        expect(mapModuleSource).toContain("width: 240");
        expect(mapModuleSource).toContain("height: 80");
        expect(mapModuleSource).toContain("'border-style': 'dashed'");
        expect(mapModuleSource).toContain("opacity: 0.8");
    });
});

