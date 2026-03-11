const fs = require('fs');
const html = fs.readFileSync('backend/public/index.html', 'utf8');
const lines = html.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // very basic matching just for main structural div tags.
    // this ignores attributes containing > etc.
    let m;
    const re = /<\/?(div|main|header|body|html|section)[^>]*>/gi;
    while ((m = re.exec(line)) !== null) {
        let tag = m[0];
        let name = m[1].toLowerCase();

        if (tag.startsWith('</')) {
            if (stack.length > 0 && stack[stack.length - 1].name === name) {
                stack.pop();
            } else {
                console.log(`Unmatched closing tag ${tag} at line ${i + 1}`);
                if (stack.length > 0) {
                    console.log(`  Expected closing for ${stack[stack.length - 1].tag} from line ${stack[stack.length - 1].line}`);
                }
            }
        } else if (!tag.endsWith('/>')) {
            stack.push({name: name, line: i + 1, tag: tag});
        }
    }
}
if (stack.length > 0) {
    console.log("Unclosed tags remaining:");
    stack.forEach(s => console.log(`Line ${s.line}: ${s.tag}`));
} else {
    console.log("Tags balanced.");
}
