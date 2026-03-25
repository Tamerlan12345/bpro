const fs = require('fs');
const path = require('path');

describe('logout visibility regression', () => {
    test('logout button is revealed with hidden-class aware helper', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'script.js'), 'utf8');

        expect(source).toContain("showSection(logoutBtn, 'inline-flex');");
        expect(source).not.toContain("logoutBtn.style.display = 'block';");
    });
});
