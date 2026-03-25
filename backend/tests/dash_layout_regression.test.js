const fs = require('fs');
const path = require('path');

describe('dash layout regression', () => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const dashPath = path.join(__dirname, '..', 'public', 'dash.js');
    const mapModulePath = path.join(__dirname, '..', 'public', 'modules', 'map.js');

    test('dash overlays keep map interactive and legend scrollable', () => {
        const serverSource = fs.readFileSync(serverPath, 'utf8');

        expect(serverSource).toContain('.overlay-layer {');
        expect(serverSource).toContain('pointer-events: none;');
        expect(serverSource).toContain('.overlay-layer .overlay-interactive');
        expect(serverSource).toContain('pointer-events: auto;');
        expect(serverSource).toContain('max-height: 30vh;');
        expect(serverSource).toContain('overflow-y: auto;');
    });

    test('dash side panel visibility relies on is-hidden class', () => {
        const serverSource = fs.readFileSync(serverPath, 'utf8');
        const dashSource = fs.readFileSync(dashPath, 'utf8');

        expect(serverSource).toContain('class="side-panel is-hidden"');
        expect(serverSource).not.toContain('id="dash-side-panel" class="side-panel" style="display: none;"');
        expect(dashSource).toContain("sidePanel.classList.add('is-hidden');");
        expect(dashSource).toContain("sidePanel.classList.remove('is-hidden');");
    });

    test('module map prevents duplicated legend mount on refresh', () => {
        const mapModuleSource = fs.readFileSync(mapModulePath, 'utf8');
        expect(mapModuleSource).toContain("if (container.querySelector('.cy-legend'))");
    });
});
