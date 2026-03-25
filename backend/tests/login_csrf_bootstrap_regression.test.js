const fs = require('fs');
const path = require('path');

describe('login csrf bootstrap regression', () => {
    test('non-GET requests ensure a CSRF token before fetch', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'script.js'), 'utf8');

        expect(source).toContain('async function ensureCsrfToken()');
        expect(source).toContain('await ensureCsrfToken();');
        expect(source).toContain("finalOptions.method.toUpperCase() !== 'GET'");
    });
});
