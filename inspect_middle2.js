const fs = require('fs');
const lines = fs.readFileSync('backend/public/index.html', 'utf8').split('\n');
console.log(lines.slice(110, 125).join('\n'));
