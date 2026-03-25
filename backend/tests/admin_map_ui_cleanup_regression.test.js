const fs = require('fs');
const path = require('path');

describe('admin map ui cleanup regression', () => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    const stylePath = path.join(__dirname, '..', 'public', 'style.css');
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');

    test('admin map uses a single static legend block', () => {
        const indexSource = fs.readFileSync(indexPath, 'utf8');
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(indexSource).toContain('id="cy-legend" class="cy-legend"');
        expect(scriptSource).not.toContain("document.getElementById('cy').appendChild(legend);");
        expect(scriptSource).not.toContain("if (!document.getElementById('cy-legend'))");
    });

    test('admin map toolbar stays inside the editor viewport', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');

        expect(styleSource).toContain('#cy-container .cy-toolbar {');
        expect(styleSource).toContain('top: 16px;');
        expect(styleSource).toContain('width: min(720px, calc(100% - 32px));');
        expect(styleSource).toContain('max-height: calc(100% - 32px);');
        expect(styleSource).toContain('overflow: auto;');
        expect(styleSource).toContain('align-content: flex-start;');
    });

    test('admin map root and child nodes keep a more compact geometry', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain("const adminMapRootLabel = 'Бизнес-процессы\\naws.centerinsurance';");
        expect(scriptSource).toContain("name: adminMapRootLabel");
        expect(scriptSource).toContain("'width': 260");
        expect(scriptSource).toContain("'height': 82");
        expect(scriptSource).toContain("'width': 232");
        expect(scriptSource).toContain("'height': 76");
        expect(scriptSource).toContain("'width': 208");
        expect(scriptSource).toContain("'height': 70");
        expect(scriptSource).toContain("'width': 176");
        expect(scriptSource).toContain("'height': 58");
    });

    test('admin auto layout leaves visible gaps between department children', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('const spacingY = 104;');
    });
});
