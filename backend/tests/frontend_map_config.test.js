const fs = require('fs');
const path = require('path');

describe('frontend map config hygiene', () => {
    const files = [
        path.join(__dirname, '..', 'public', 'modules', 'map.js'),
        path.join(__dirname, '..', 'public', 'dash.js'),
        path.join(__dirname, '..', 'public', 'script.js')
    ];

    test('does not use deprecated wheel sensitivity override', () => {
        for (const file of files) {
            const source = fs.readFileSync(file, 'utf8');
            expect(source).not.toMatch(/wheelSensitivity\s*:/);
        }
    });

    test('does not use deprecated label size mapping and invalid shadow props', () => {
        for (const file of files) {
            const source = fs.readFileSync(file, 'utf8');
            expect(source).not.toMatch(/width\s*:\s*['\"]label['\"]/);
            expect(source).not.toMatch(/height\s*:\s*['\"]label['\"]/);
            expect(source).not.toMatch(/['\"]shadow-blur['\"]\s*:/);
            expect(source).not.toMatch(/['\"]shadow-color['\"]\s*:/);
            expect(source).not.toMatch(/['\"]shadow-opacity['\"]\s*:/);
            expect(source).not.toMatch(/['\"]shadow-offset-y['\"]\s*:/);
        }
    });

    test('does not map edge label on generic edge selector', () => {
        for (const file of files) {
            const source = fs.readFileSync(file, 'utf8');
            expect(source).not.toMatch(/selector\s*:\s*['\"]edge['\"][\s\S]{0,300}label\s*:\s*['\"]data\(label\)['\"]/);
        }
    });

    test('does not keep noisy bootstrap init log in main module', () => {
        const mainFile = path.join(__dirname, '..', 'public', 'modules', 'main.js');
        const source = fs.readFileSync(mainFile, 'utf8');
        expect(source).not.toContain('BizMap AI Initializing...');
    });
});