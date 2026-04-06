const fs = require('fs');
const path = require('path');

describe('bpmn render normalization regression', () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');

    test('render and editor normalize extracted xml before importing into bpmn-js', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('xml = normalizeGeneratedBpmnXml(extracted);');
        expect(scriptSource).toContain('xml = normalizeGeneratedBpmnXml(xml);');
    });

    test('read-only bpmn render replaces exclusive gateway marker with decision card overlay', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('function enhanceExclusiveGatewayPresentation(viewerInstance, container = diagramContainer)');
        expect(scriptSource).toContain("const gateways = elementRegistry.filter((element) => element.type === 'bpmn:ExclusiveGateway');");
        expect(scriptSource).toContain("gatewayVisual.style.opacity = '0';");
        expect(scriptSource).toContain("flowLabelGraphics.style.display = 'none';");
        expect(scriptSource).toContain("overlays.add(gateway, {");
        expect(scriptSource).toContain('gateway-decision-card');
        expect(scriptSource).toContain('enhanceExclusiveGatewayPresentation(bpmnViewer, container);');
    });
});
