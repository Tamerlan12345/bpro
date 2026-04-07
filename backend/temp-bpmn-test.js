// Mirror of the updated sanitizeBpmnXml from script.js - must stay in sync.
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

    const normalizeWaypointTag = (attrs = '') => {
        const xMatch = attrs.match(/\bx\s*=\s*(["'])([^"']+)\1/i);
        const yMatch = attrs.match(/\by\s*=\s*(["'])([^"']+)\1/i);

        if (!xMatch || !yMatch) {
            return '';
        }

        const x = Number.parseFloat(xMatch[2]);
        const y = Number.parseFloat(yMatch[2]);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return '';
        }

        return `<di:waypoint x="${xMatch[2]}" y="${yMatch[2]}" />`;
    };

    const extractWaypointFragments = block => {
        const fragments = [...block.matchAll(/<(?:di:waypoint|waypoint|di)\b[^<>]*(?:\/?>)?/gi)]
            .map(match => match[0]);

        if (!fragments.length) {
            return [...block.matchAll(/<[^<>]{0,80}\bx\s*=\s*(["'])[^"']+\1[^<>]{0,80}\by\s*=\s*(["'])[^"']+\2[^<>]{0,80}(?:\/?>)?/gi)]
                .map(match => match[0]);
        }

        return fragments;
    };

    const rebuildEdgeBlock = block => {
        const openTag = block.match(/^<bpmndi:BPMNEdge\b[^>]*>/i)?.[0];
        if (!openTag) return '';

        const labelBlock = block.match(/<bpmndi:BPMNLabel\b[\s\S]*?<\/bpmndi:BPMNLabel>/i)?.[0] || '';
        const normalizedWaypoints = extractWaypointFragments(block)
            .map(fragment => normalizeWaypointTag(fragment))
            .filter(Boolean);

        if (normalizedWaypoints.length < 2) {
            return '';
        }

        return `${openTag}${normalizedWaypoints.join('')}${labelBlock}</bpmndi:BPMNEdge>`;
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
        const openCount = (xml.match(openRe) || []).length;
        const closeCount = (xml.match(closeRe) || []).length;
        if (closeCount > openCount) {
            let surplus = closeCount - openCount;
            xml = xml.replace(closeRe, match => {
                if (surplus > 0) {
                    surplus--;
                    return '';
                }
                return match;
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

    // 5. Normalize malformed DI waypoints before the XML reaches bpmn-js.
    xml = xml.replace(/<(?:di:)?waypoint\b([^<>]*?)>\s*<\/(?:di:)?waypoint>/gi, (_, attrs) => normalizeWaypointTag(attrs) || '');
    xml = xml.replace(
        /<(?:di:)?waypoint\b([^<>]*?)>(?=\s*<(?:di:waypoint\b|bpmndi:BPMNLabel\b|\/bpmndi:BPMNEdge>))/gi,
        (_, attrs) => normalizeWaypointTag(attrs) || ''
    );
    xml = xml.replace(/<\/(?:di:)?waypoint>/gi, '');

    xml = xml.replace(/<bpmndi:BPMNEdge\b[^>]*>[\s\S]*?<\/bpmndi:BPMNEdge>/gi, block => {
        if (!/<(?:di:waypoint|waypoint|di)\b/i.test(block)) {
            return block;
        }

        return rebuildEdgeBlock(block);
    });

    xml = xml.replace(
        /<bpmndi:BPMNEdge\b[^>]*>[\s\S]*?(?=(?:<bpmndi:BPMNEdge\b|<\/bpmndi:BPMNPlane>|<\/bpmndi:BPMNDiagram>|<\/bpmn\d*:definitions>|<\/definitions>))/gi,
        block => {
            if (/<\/bpmndi:BPMNEdge>/i.test(block)) {
                return block;
            }

            if (!/<(?:di:waypoint|waypoint|di)\b/i.test(block)) {
                return block;
            }

            return rebuildEdgeBlock(`${block}</bpmndi:BPMNEdge>`);
        }
    );

    return xml;
}

let passed = 0;
let failed = 0;

function test(name, input, expectFn) {
    const result = sanitizeBpmnXml(input);
    try {
        expectFn(result);
        console.log(`PASS ${name}`);
        passed++;
    } catch (error) {
        console.log(`FAIL ${name}: ${error.message}`);
        console.log(`   Result: ${result}`);
        failed++;
    }
}

test(
    'namespace mismatch fix (bpmn vs bpmn2)',
    `<bpmn:dataInputAssociation id="da1"><bpmn:sourceRef>x</bpmn:sourceRef></bpmn2:dataInputAssociation>`,
    result => {
        if (!result.includes('</bpmn:dataInputAssociation>')) throw new Error('Expected closing tag fixed to bpmn:dataInputAssociation');
        if (result.includes('</bpmn2:dataInputAssociation>')) throw new Error('Mismatched bpmn2 closing tag should be gone');
    }
);

test(
    'orphaned closing tag removal',
    `<bpmn2:task id="t1"><bpmn2:incoming>f1</bpmn2:incoming></bpmn2:dataInputAssociation></bpmn2:task>`,
    result => {
        if (result.includes('</bpmn2:dataInputAssociation>')) throw new Error('Expected orphan removed');
    }
);

test(
    'empty dataInputAssociation removed',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"></bpmn2:dataInputAssociation></bpmn2:task>`,
    result => {
        if (result.includes('dataInputAssociation')) throw new Error('Expected empty element removed');
    }
);

test(
    'valid dataInputAssociation preserved',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:sourceRef></bpmn2:dataInputAssociation></bpmn2:task>`,
    result => {
        if (!result.includes('dataInputAssociation')) throw new Error('Expected valid element kept');
        if (!result.includes('<bpmn2:sourceRef>')) throw new Error('Expected sourceRef preserved');
    }
);

test(
    'real-world: bpmn opener, bpmn2 closer fixed',
    `<bpmn2:task id="Task_1"><bpmn2:incoming>sf1</bpmn2:incoming><bpmn:dataInputAssociation id="dia_1"><bpmn:sourceRef>DataObjectReference_1</bpmn:sourceRef></bpmn2:dataInputAssociation></bpmn2:task>`,
    result => {
        if (result.includes('</bpmn2:dataInputAssociation>')) throw new Error('Mismatch closing tag should be fixed');
        if (!result.includes('<bpmn:dataInputAssociation')) throw new Error('Element should be preserved');
        if (!result.includes('DataObjectReference_1')) throw new Error('sourceRef content should be preserved');
    }
);

test(
    'reverse: bpmn2 opener, bpmn closer fixed',
    `<bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:sourceRef></bpmn:dataInputAssociation>`,
    result => {
        if (!result.includes('</bpmn2:dataInputAssociation>')) throw new Error('Expected closer normalised to bpmn2');
        if (result.includes('</bpmn:dataInputAssociation>')) throw new Error('Mismatched bpmn closer should be gone');
    }
);

test(
    'conditionExpression orphan removed from non-gateway flow',
    `<bpmn2:sequenceFlow id="sf1" sourceRef="Task_1" targetRef="Task_2"></bpmn2:conditionExpression></bpmn2:sequenceFlow>`,
    result => {
        if (result.includes('</bpmn2:conditionExpression>')) throw new Error('Expected conditionExpression orphan removed');
    }
);

test(
    'malformed dataInputAssociation with broken nested sourceRef removed',
    `<bpmn2:task id="t1"><bpmn2:dataInputAssociation id="x"><bpmn2:sourceRef>doc1</bpmn2:dataInputAssociation></bpmn2:task>`,
    result => {
        if (result.includes('dataInputAssociation')) throw new Error('Expected malformed association removed');
        if (result.includes('<bpmn2:sourceRef>')) throw new Error('Expected broken nested sourceRef removed with association');
    }
);

test(
    'unprefixed dataInputAssociation opener normalises prefixed closer',
    `<dataInputAssociation id="x"><sourceRef>doc1</sourceRef></bpmn2:dataInputAssociation>`,
    result => {
        if (!result.includes('</dataInputAssociation>')) throw new Error('Expected closer normalised to unprefixed tag');
        if (result.includes('</bpmn2:dataInputAssociation>')) throw new Error('Prefixed closer should be replaced');
    }
);

test(
    'malformed BPMNEdge waypoint opener normalized',
    `<bpmndi:BPMNEdge id="edge_1" bpmnElement="flow_1"><di:waypoint x="10" y="20"><di:waypoint x="30" y="40" /></bpmndi:BPMNEdge>`,
    result => {
        const waypoints = result.match(/<di:waypoint\b[^>]*\/>/g) || [];
        if (waypoints.length !== 2) throw new Error('Expected two normalized self-closing waypoints');
        if (/<di:waypoint\b[^>]*[^\/]>(?!\s*<\/di:waypoint>)/i.test(result)) throw new Error('Broken opening waypoint should be gone');
    }
);

test(
    'waypoint missing closing angle bracket normalized',
    `<bpmndi:BPMNEdge id="edge_1b" bpmnElement="flow_1b"><di:waypoint x="10" y="20"\n<di:waypoint x="30" y="40" /></bpmndi:BPMNEdge>`,
    result => {
        const waypoints = result.match(/<di:waypoint\b[^>]*\/>/g) || [];
        if (waypoints.length !== 2) throw new Error('Expected malformed opener without > to be reconstructed');
        if (result.includes('edge_1b') === false) throw new Error('Edge should be preserved after reconstruction');
    }
);

test(
    'paired waypoint tags normalized',
    `<bpmndi:BPMNEdge id="edge_2" bpmnElement="flow_2"><di:waypoint x="1" y="2"></di:waypoint><di:waypoint x="3" y="4"></di:waypoint></bpmndi:BPMNEdge>`,
    result => {
        const waypoints = result.match(/<di:waypoint\b[^>]*\/>/g) || [];
        if (waypoints.length !== 2) throw new Error('Expected paired waypoints converted to self-closing tags');
        if (result.includes('</di:waypoint>')) throw new Error('Legacy closing waypoint tags should be removed');
    }
);

test(
    'edge missing explicit closing tag reconstructed before plane close',
    `<bpmndi:BPMNEdge id="edge_4" bpmnElement="flow_4"><di:waypoint x="10" y="20"><di:waypoint x="30" y="40" /></bpmndi:BPMNPlane>`,
    result => {
        if (!result.includes('</bpmndi:BPMNEdge></bpmndi:BPMNPlane>')) {
            throw new Error('Expected missing BPMNEdge closer to be restored before BPMNPlane close');
        }
    }
);

test(
    'edge with one valid waypoint removed',
    `<bpmndi:BPMNEdge id="edge_3" bpmnElement="flow_3"><di:waypoint x="10" y="20"></bpmndi:BPMNEdge>`,
    result => {
        if (result.includes('edge_3')) throw new Error('Malformed edge should be removed when it cannot be reconstructed');
    }
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
