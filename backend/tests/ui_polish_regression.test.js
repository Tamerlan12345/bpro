const fs = require('fs');
const path = require('path');

describe('ui polish regression', () => {
    const stylePath = path.join(__dirname, '..', 'public', 'style.css');
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    test('uses release design tokens for primary and text colors', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');

        expect(styleSource).toContain('--primary: #3b82f6;');
        expect(styleSource).toContain('--bg-canvas: #f8fafc;');
        expect(styleSource).toContain('--text-main: #1e293b;');
        expect(styleSource).toContain('--primary-color: var(--primary);');
        expect(styleSource).toContain('--text-color: var(--text-main);');
    });

    test('does not use browser alert dialogs in client flows', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        expect(scriptSource).not.toContain('alert(');
    });

    test('keeps z-index order canvas < overlays < notification < controls <= side-panel < modal < context menu', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');
        const tokenValue = (name) => {
            const regex = new RegExp(`--${name}:\\s*(-?\\d+)`);
            const match = styleSource.match(regex);
            return match ? Number.parseInt(match[1], 10) : null;
        };

        const canvas = tokenValue('z-canvas');
        const overlayLabel = tokenValue('z-overlay-label');
        const controls = tokenValue('z-controls');
        const notification = tokenValue('z-notification');
        const sidePanel = tokenValue('z-side-panel');
        const modal = tokenValue('z-modal');
        const contextMenu = tokenValue('z-context-menu');

        expect(canvas).not.toBeNull();
        expect(overlayLabel).not.toBeNull();
        expect(controls).not.toBeNull();
        expect(notification).not.toBeNull();
        expect(sidePanel).not.toBeNull();
        expect(modal).not.toBeNull();
        expect(contextMenu).not.toBeNull();
        expect(canvas).toBeLessThan(overlayLabel);
        expect(overlayLabel).toBeLessThan(controls);
        expect(notification).toBeLessThan(controls);
        expect(sidePanel).toBeGreaterThanOrEqual(controls);
        expect(sidePanel).toBeGreaterThan(notification);
        expect(modal).toBeGreaterThan(notification);
        expect(contextMenu).toBeGreaterThan(modal);
        expect(styleSource).toContain('z-index: var(--z-notification);');
        expect(styleSource).toContain('z-index: var(--z-side-panel);');
    });

    test('supports class-driven visibility toggles with is-hidden utility', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');
        expect(styleSource).toContain('.is-hidden');
    });

    test('avoids inline display none in index bootstrap markup', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).not.toMatch(/style="[^"]*display\s*:\s*none/i);
    });
});

