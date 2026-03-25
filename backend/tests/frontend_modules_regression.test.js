const fs = require('fs');
const path = require('path');

describe('frontend modules regression', () => {
    const mapModulePath = path.join(__dirname, '..', 'public', 'modules', 'map.js');

    test('modular map sanitizes dynamic HTML before rendering tooltip and side panel', () => {
        const source = fs.readFileSync(mapModulePath, 'utf8');

        expect(source).toContain('const escapeHtml = (value) =>');
        expect(source).toContain("const safeRawName = escapeHtml(node.data('rawName'));");
        expect(source).toContain("const safeDescription = escapeHtml(desc);");
        expect(source).not.toContain("marked.parse(desc)");
        expect(source).not.toContain("${data.rawName || data.name}");
        expect(source).not.toContain("${data.goal}");
    });

    test('modular map keeps raw node names without emoji prefixes to match legacy client', () => {
        const source = fs.readFileSync(mapModulePath, 'utf8');

        expect(source).toContain('name: dept.name,');
        expect(source).toContain('name: proc.name,');
        expect(source).toContain('name: chat.name,');
    });
});
