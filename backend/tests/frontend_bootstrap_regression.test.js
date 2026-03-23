const fs = require('fs');
const path = require('path');

describe('frontend bootstrap regression', () => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    test('loads the full user-facing client bootstrap', () => {
        const html = fs.readFileSync(indexPath, 'utf8');

        expect(html).toContain('<script src="script.js?v=3"></script>');
        expect(html).not.toMatch(/^[ \t]*<script type="module" src="modules\/main\.js"><\/script>/m);
    });
});
