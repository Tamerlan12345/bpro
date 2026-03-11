const fs = require('fs');
const htmlparser2 = require('htmlparser2');

const html = fs.readFileSync('backend/public/index.html', 'utf8');

let indent = 0;
let out = '';
const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
        if (['meta', 'link', 'br', 'hr', 'img', 'input', 'path', 'circle', 'line', 'polyline'].includes(name)) return;
        const idStr = attribs.id ? ` id="${attribs.id}"` : '';
        const classStr = attribs.class ? ` class="${attribs.class}"` : '';
        out += '  '.repeat(indent) + `<${name}${idStr}${classStr}>\n`;
        indent++;
    },
    onclosetag(name) {
        if (['meta', 'link', 'br', 'hr', 'img', 'input', 'path', 'circle', 'line', 'polyline'].includes(name)) return;
        indent--;
        out += '  '.repeat(indent) + `</${name}>\n`;
    }
});
parser.write(html);
parser.end();
fs.writeFileSync('parsed_tree.txt', out);
