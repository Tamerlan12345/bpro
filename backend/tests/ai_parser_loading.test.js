const fs = require('fs');
const path = require('path');

describe('aiParserService loading strategy', () => {
    test('does not require pdf-parse at top-level to avoid test-time open handles', () => {
        const file = path.join(__dirname, '..', 'services', 'aiParserService.js');
        const source = fs.readFileSync(file, 'utf8');

        expect(source).not.toMatch(/^\s*const\s+pdf\s*=\s*require\(['\"]pdf-parse['\"]\);/m);
    });
});