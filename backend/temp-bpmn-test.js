const fs = require('fs');
const { normalizeBpmnVerticalLayout } = require('./public/bpmn-vertical-layout.js');
const xml = fs.readFileSync('tmp-normalized-bpmn.xml', 'utf8');
try {
    const res = normalizeBpmnVerticalLayout(xml);
    console.log('Length:', res.length);
} catch (e) {
    console.error('ERROR:', e.message);
}
