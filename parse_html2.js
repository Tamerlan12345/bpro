const htmlparser2 = require("htmlparser2");
const fs = require('fs');

const html = fs.readFileSync('backend/public/index.html', 'utf8');

let stack = [];
let errors = [];

const parser = new htmlparser2.Parser({
    onopentag(name, attributes) {
        if (name === "meta" || name === "link" || name === "img" || name === "input" || name === "br" || name === "hr" || name === "circle" || name === "line" || name === "polyline" || name === "path") return;
        stack.push({ name, line: parser.startIndex, attrs: attributes });
    },
    onclosetag(name) {
        if (name === "meta" || name === "link" || name === "img" || name === "input" || name === "br" || name === "hr" || name === "circle" || name === "line" || name === "polyline" || name === "path") return;
        if (stack.length === 0) {
            errors.push(`Extra closing tag </${name}> at index ${parser.startIndex}`);
            return;
        }
        let top = stack.pop();
        if (top.name !== name) {
            errors.push(`Mismatched closing tag: expected </${top.name}> (from index ${top.line}) but got </${name}> at index ${parser.startIndex}`);
            // Simple recovery: pop until match
            let found = false;
            for(let i=stack.length-1; i>=0; i--) {
                if(stack[i].name === name) {
                    stack.splice(i);
                    found = true;
                    break;
                }
            }
            if (!found) stack.push(top); // restore if not found
        }
    }
}, { decodeEntities: true, recognizeSelfClosing: true });

parser.write(html);
parser.end();

console.log("Errors:", errors);
console.log("Remaining on stack:", stack.map(s => `<${s.name} ${s.attrs.id || s.attrs.class || ''}>`));
