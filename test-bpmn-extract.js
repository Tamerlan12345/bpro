function extractPureBpmnXml(text) {
    if (typeof text !== 'string') return text;
    let xml = text.replace(/```(xml|bpmn)?/gi, '').replace(/```/g, '');
    const xmlStart = xml.search(/<\?xml|<bpmn\d*:definitions|<definitions/i);
    if (xmlStart !== -1) {
        xml = xml.substring(xmlStart);
    }
    const xmlEnd = xml.search(/<\/bpmn\d*:definitions>|<\/definitions>/i);
    if (xmlEnd !== -1) {
        const match = xml.match(/<\/bpmn\d*:definitions>|<\/definitions>/i);
        xml = xml.substring(0, xmlEnd + match[0].length);
    }
    return xml.trim();
}

// Test 1: Already valid BPMN XML (this simulates DB-stored data)
const test1 = '<?xml version="1.0"?><bpmn2:definitions xmlns:bpmn2="http://omg.org"><bpmn2:process></bpmn2:process></bpmn2:definitions>';
const res1 = extractPureBpmnXml(test1);
console.log("Test1 (valid xml):", res1.startsWith('<?xml') ? 'PASS' : 'FAIL - got: ' + res1.substring(0,50));

// Test 2: XML with text prefix (common Gemini response)
const test2 = 'Вот ваш BPMN:\n```xml\n<?xml version="1.0"?><bpmn2:definitions><bpmn2:process></bpmn2:process></bpmn2:definitions>\n```';
const res2 = extractPureBpmnXml(test2);
console.log("Test2 (text prefix):", res2.startsWith('<?xml') ? 'PASS' : 'FAIL - got: ' + res2.substring(0,100));

// Test 3: Totally plain text - no XML at all (Gemini error response) - should NOT crash
const test3 = "I cannot generate this right now.";
const res3 = extractPureBpmnXml(test3);
console.log("Test3 (no xml - should return as-is):", res3 === test3 ? 'PASS' : 'CHANGED: ' + res3.substring(0,50));

// Test 4: JSON containing BPMN code 
const test4 = JSON.stringify({mermaidCode: '<?xml version=\'1.0\'?><bpmn2:definitions><bpmn2:process></bpmn2:process></bpmn2:definitions>'});
const res4 = extractPureBpmnXml(test4);
console.log("Test4 (json with embedded bpmn):", res4.startsWith('<?xml') ? 'PASS' : 'FAIL - got: ' + res4.substring(0,100));

// Test 5: Empty string (should return empty)
const test5 = '';
const res5 = extractPureBpmnXml(test5);
console.log("Test5 (empty string):", res5 === '' ? 'PASS' : 'CHANGED: [' + res5 + ']');

// Test 6: BPMN WITHOUT <?xml prefix (just <bpmn2:definitions>)
const test6 = '<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn2:process/></bpmn2:definitions>';
const res6 = extractPureBpmnXml(test6);
console.log("Test6 (no xml decl, just definitions):", res6.startsWith('<bpmn2:definitions') ? 'PASS' : 'FAIL - got: ' + res6.substring(0,80));

console.log('\n--- renderDiagram logic simulation ---');
// Simulate what renderDiagram does: 
// if bpmnCode is empty after extraction -> falls through to getEmptyBpmnTemplate
function getEmptyBpmnTemplate() { return '<empty-template/>'; }
function simulateRenderDiagram(bpmnCode) {
    let xml = (bpmnCode && bpmnCode.trim()) ? bpmnCode : getEmptyBpmnTemplate();
    xml = extractPureBpmnXml(xml);
    // BUG: if extractPureBpmnXml returns empty, importXML would get empty string!
    if (!xml || !xml.trim()) {
        return 'EMPTY_XML_BUG - would show blank screen';
    }
    return 'OK: ' + xml.substring(0,40);
}

console.log("Empty BPMN code render:", simulateRenderDiagram(''));
console.log("Valid BPMN code render:", simulateRenderDiagram('<bpmn2:definitions><bpmn2:process/></bpmn2:definitions>'));
console.log("Plain text render (bad AI response):", simulateRenderDiagram('Sorry I cannot do that'));
