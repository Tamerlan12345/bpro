const fs = require('fs');
const path = require('path');

describe('bpmn render normalization regression', () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');

    test('render and editor normalize extracted xml before importing into bpmn-js', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('xml = normalizeGeneratedBpmnXml(extracted);');
        expect(scriptSource).toContain('xml = normalizeGeneratedBpmnXml(xml);');
    });
});
