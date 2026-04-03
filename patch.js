const fs = require('fs');
let content = fs.readFileSync('backend/public/script.js', 'utf8');
content = content.replace(/xml = xml\.replace\(\/\^```\(xml\|bpmn\)\?\\n\?\/i, ''\)\.replace\(\/\\n\?```\\s\*\$\/i, ''\)\.trim\(\);/g, 'xml = extractPureBpmnXml(xml);');
fs.writeFileSync('backend/public/script.js', content, 'utf8');
