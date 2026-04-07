// Mirror of the updated sanitizeBpmnXml from script.js – must stay in sync
function sanitizeBpmnXml(xml) {
    if (typeof xml !== 'string') return xml;

    const countTagPairs = (fragment, tagName) => {
        const openRe = new RegExp(`<(?:bpmn\\d*:)?${tagName}(?=[\\s>])`, 'gi');
        const closeRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');

        return {
            openCount: (fragment.match(openRe) || []).length,
            closeCount: (fragment.match(closeRe) || []).length
        };
    };

    const mutableTags = [
        'dataInputAssociation', 'dataOutputAssociation', 'conditionExpression',
        'sourceRef', 'targetRef', 'flowNodeRef'
    ];

    // 1. Per-tag: detect the prefix used in the opening tag and normalise all closing tags.
    mutableTags.forEach(tagName => {
        const openTagRe = new RegExp(`<(?:(bpmn\\d*):)?${tagName}(?=[\\s>])`, 'i');
        const closeTagRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');
        const openMatch = xml.match(openTagRe);
        if (!openMatch) return;
        const prefix = openMatch[1] ? `${openMatch[1]}:` : '';
        xml = xml.replace(closeTagRe, `</${prefix}${tagName}>`);
    });

    // 2. Remove orphaned closing tags (more closes than opens).
    const orphanTags = [
        'dataInputAssociation', 'dataOutputAssociation', 'conditionExpression',
        'sourceRef', 'targetRef'
    ];
    orphanTags.forEach(tagName => {
        const closeRe = new RegExp(`<\\/(?:bpmn\\d*:)?${tagName}>`, 'gi');
        const openRe = new RegExp(`<(?:bpmn\\d*:)?${tagName}(?=[\\s>])`, 'gi');
        const openCount  = (xml.match(openRe)  || []).length;
        const closeCount = (xml.match(closeRe) || []).length;
        if (closeCount > openCount) {
            let surplus = closeCount - openCount;
            xml = xml.replace(closeRe, m => {
                if (surplus > 0) { surplus--; return ''; }
                return m;
            });
        }
    });

    // 3. Remove malformed association blocks where nested refs are unbalanced.
    ['dataInputAssociation', 'dataOutputAssociation'].forEach(tagName => {
        const blockRe = new RegExp(
            `<(?:bpmn\\d*:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:bpmn\\d*:)?${tagName}>`,
            'gi'
        );

        xml = xml.replace(blockRe, block => {
            const hasUnbalancedRefs = ['sourceRef', 'targetRef'].some(refTag => {
                const { openCount, closeCount } = countTagPairs(block, refTag);
                return openCount !== closeCount;
            });

            if (hasUnbalancedRefs) {
                return '';
            }

            const { openCount, closeCount } = countTagPairs(block, tagName);
            return openCount === 1 && closeCount === 1 ? block : '';
        });
    });

    // 4. Remove completely empty data association elements.
    xml = xml.replace(/<(?:bpmn\d*:)?dataInputAssociation[^>]*>\s*<\/(?:bpmn\d*:)?dataInputAssociation>/gi, '');
    xml = xml.replace(/<(?:bpmn\d*:)?dataOutputAssociation[^>]*>\s*<\/(?:bpmn\d*:)?dataOutputAssociation>/gi, '');

    return xml;
}

let passed = 0;
let failed = 0;

function test(name, input, expectFn) {
    const result = sanitizeBpmnXml(input);
    try {
        expectFn(result);
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        console.log(`   Result: ${result}`);
        failed++;
    }
}

// Test 1: namespace mismatch on closing tag (different prefix)
test('namespace mismatch fix (bpmn vs bpmn2)',
    `<bpmn:dataInputAssociation id="da1"><bpmn:sourceRef>x</bpmn:sourceRef></bpmn2:dataInputAssociation>`,
    r => {
        if (!r.includes('</bpmn:dataInputAssociation>')) throw new Error('Expected closing tag fixed to bpmn:dataInputAssociation');
        if (r.includes('</bpmn2:dataInputAssociation>')) throw new Error('Mismatched bpmn2 closing tag should be gone');
    }
);

// Test 2: orphaned closing tag (no opener)
test('orphaned closing tag removal',
    `<bpmn2:task id="t1"><bpmn2:incoming>f1</bpmn2:incoming></bpmn2:dataInputAssociation></bpmn2:task>`,
    r => {
        if (r.includes('</bpmn2:dataInputAssociation>')) throw new Error('Expected orphan removed');
    }
);

// Test 3: empty dataInputAssociation removed
test('empty dataInputAssociation removed',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"></bpmn2:dataInputAssociation></bpmn2:task>`,
    r => {
        if (r.includes('dataInputAssociation')) throw new Error('Expected empty element removed');
    }
);

// Test 4: valid dataInputAssociation preserved
test('valid dataInputAssociation preserved',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:sourceRef></bpmn2:dataInputAssociation></bpmn2:task>`,
    r => {
        if (!r.includes('dataInputAssociation')) throw new Error('Expected valid element kept');
        if (!r.includes('<bpmn2:sourceRef>')) throw new Error('Expected sourceRef preserved');
    }
);

// Test 5: real-world closing tag mismatch (bpmn: opener, bpmn2: closer)
test('real-world: bpmn: opener, bpmn2: closer fixed',
    `<bpmn2:task id="Task_1"><bpmn2:incoming>sf1</bpmn2:incoming><bpmn:dataInputAssociation id="dia_1"><bpmn:sourceRef>DataObjectReference_1</bpmn:sourceRef></bpmn2:dataInputAssociation></bpmn2:task>`,
    r => {
        if (r.includes('</bpmn2:dataInputAssociation>')) throw new Error('Mismatch closing tag should be fixed');
        if (!r.includes('<bpmn:dataInputAssociation')) throw new Error('Element should be preserved');
        if (!r.includes('DataObjectReference_1')) throw new Error('sourceRef content should be preserved');
    }
);

// Test 6: bpmn2: opener, bpmn: closer (reverse mismatch)
test('reverse: bpmn2: opener, bpmn: closer fixed',
    `<bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:sourceRef></bpmn:dataInputAssociation>`,
    r => {
        if (!r.includes('</bpmn2:dataInputAssociation>')) throw new Error('Expected closer normalised to bpmn2:');
        if (r.includes('</bpmn:dataInputAssociation>')) throw new Error('Mismatched bpmn: closer should be gone');
    }
);

// Test 7: conditionExpression orphan removal
test('conditionExpression orphan removed from non-gateway flow',
    `<bpmn2:sequenceFlow id="sf1" sourceRef="Task_1" targetRef="Task_2"></bpmn2:conditionExpression></bpmn2:sequenceFlow>`,
    r => {
        if (r.includes('</bpmn2:conditionExpression>')) throw new Error('Expected conditionExpression orphan removed');
    }
);

// Test 8: malformed dataInputAssociation with unclosed sourceRef removed
test('malformed dataInputAssociation with broken nested sourceRef removed',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:dataInputAssociation></bpmn2:task>`,
    r => {
        if (r.includes('dataInputAssociation')) throw new Error('Expected malformed association removed');
        if (r.includes('<bpmn2:sourceRef>')) throw new Error('Expected broken nested sourceRef removed with association');
    }
);

// Test 9: unprefixed opener keeps unprefixed closer
test('unprefixed dataInputAssociation opener normalises prefixed closer',
    `<dataInputAssociation id="x"><sourceRef>doc1</sourceRef></bpmn2:dataInputAssociation>`,
    r => {
        if (!r.includes('</dataInputAssociation>')) throw new Error('Expected closer normalised to unprefixed tag');
        if (r.includes('</bpmn2:dataInputAssociation>')) throw new Error('Prefixed closer should be replaced');
    }
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
