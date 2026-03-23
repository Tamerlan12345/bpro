const fs = require('fs');
const path = require('path');

describe('session visibility regression', () => {
    test('bootstrap uses hidden-class helpers for auth screens', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'script.js'), 'utf8');

        expect(source).toContain("const showSection = (el, display = 'block') => {");
        expect(source).toContain("el.classList.remove('hidden');");
        expect(source).toContain("const hideSection = (el) => {");
        expect(source).toContain("el.classList.add('hidden');");
        expect(source).toContain('showSection(adminPanel);');
        expect(source).toContain('showSection(departmentSelection);');
        expect(source).toContain('showSection(chatLogin);');
    });
});
