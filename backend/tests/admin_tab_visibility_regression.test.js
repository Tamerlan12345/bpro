const fs = require('fs');
const path = require('path');

describe('admin tab visibility regression', () => {
    test('admin tab switching uses hidden-class aware helpers', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'script.js'), 'utf8');

        expect(source).toContain('hideSection(adminViewUsers);');
        expect(source).toContain('hideSection(adminViewMap);');
        expect(source).toContain('showSection(adminViewUsers);');
        expect(source).toContain('showSection(adminViewMap);');
        expect(source).toContain("hideSection(document.getElementById('in-review'));");
        expect(source).toContain("showSection(document.getElementById('in-review'));");
    });
});
