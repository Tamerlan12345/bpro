const fs = require('fs');
const lines = fs.readFileSync('backend/public/index.html', 'utf8').split('\n');
console.log(lines.slice(225, 270).join('\n'));
