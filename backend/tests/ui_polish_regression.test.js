const fs = require('fs');
const path = require('path');

describe('ui polish regression', () => {
    const stylePath = path.join(__dirname, '..', 'public', 'style.css');
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    test('uses release design tokens for primary and text colors', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');

        expect(styleSource).toContain('--primary-color: #3b82f6;');
        expect(styleSource).toContain('--text-color: #1e293b;');
    });

    test('does not use browser alert dialogs in client flows', () => {
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        expect(scriptSource).not.toContain('alert(');
    });

    test('keeps z-index order context menu > modal > notification', () => {
        const styleSource = fs.readFileSync(stylePath, 'utf8');
        const tokenValue = (name) => {
            const regex = new RegExp(`--${name}:\\s*(-?\\d+)`);
            const match = styleSource.match(regex);
            return match ? Number.parseInt(match[1], 10) : null;
        };

        const notification = tokenValue('z-notification');
        const modal = tokenValue('z-modal');
        const contextMenu = tokenValue('z-context-menu');

        expect(notification).not.toBeNull();
        expect(modal).not.toBeNull();
        expect(contextMenu).not.toBeNull();
        expect(modal).toBeGreaterThan(notification);
        expect(contextMenu).toBeGreaterThan(modal);
        expect(styleSource).toContain('z-index: var(--z-notification);');
    });

    test('avoids inline display none in index bootstrap markup', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).not.toMatch(/style="[^"]*display\s*:\s*none/i);
    });
});
