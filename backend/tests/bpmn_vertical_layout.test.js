const fs = require('fs');
const path = require('path');
const { normalizeBpmnVerticalLayout } = require('../public/bpmn-vertical-layout');

function extractShapeBounds(xml, bpmnElement) {
    const shapePattern = new RegExp(
        `<bpmndi:BPMNShape[^>]*bpmnElement="${bpmnElement}"[^>]*>([\\s\\S]*?)<\\/bpmndi:BPMNShape>`,
        'i'
    );
    const shapeMatch = xml.match(shapePattern);
    expect(shapeMatch).not.toBeNull();

    const boundsMatch = shapeMatch[1].match(
        /<dc:Bounds[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/i
    );
    expect(boundsMatch).not.toBeNull();

    return {
        x: Number.parseFloat(boundsMatch[1]),
        y: Number.parseFloat(boundsMatch[2]),
        width: Number.parseFloat(boundsMatch[3]),
        height: Number.parseFloat(boundsMatch[4])
    };
}

function extractWaypoints(xml, edgeId) {
    const edgePattern = new RegExp(
        `<bpmndi:BPMNEdge[^>]*bpmnElement="${edgeId}"[^>]*>([\\s\\S]*?)<\\/bpmndi:BPMNEdge>`,
        'i'
    );
    const edgeMatch = xml.match(edgePattern);
    expect(edgeMatch).not.toBeNull();

    return [...edgeMatch[1].matchAll(new RegExp('<di:waypoint[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*/?>', 'gi'))].map((match) => ({
        x: Number.parseFloat(match[1]),
        y: Number.parseFloat(match[2])
    }));
}

describe('normalizeBpmnVerticalLayout', () => {
    test('repositions a horizontal linear BPMN flow into a top-down layout', () => {
        const horizontalXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1">
      <bpmn2:outgoing>Flow_1</bpmn2:outgoing>
    </bpmn2:startEvent>
    <bpmn2:task id="Task_1" name="Step 1">
      <bpmn2:incoming>Flow_1</bpmn2:incoming>
      <bpmn2:outgoing>Flow_2</bpmn2:outgoing>
    </bpmn2:task>
    <bpmn2:task id="Task_2" name="Step 2">
      <bpmn2:incoming>Flow_2</bpmn2:incoming>
      <bpmn2:outgoing>Flow_3</bpmn2:outgoing>
    </bpmn2:task>
    <bpmn2:endEvent id="EndEvent_1">
      <bpmn2:incoming>Flow_3</bpmn2:incoming>
    </bpmn2:endEvent>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2" />
    <bpmn2:sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="EndEvent_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="220" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="380" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="560" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="136" y="138" />
        <di:waypoint x="220" y="138" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="320" y="138" />
        <di:waypoint x="380" y="138" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="480" y="138" />
        <di:waypoint x="560" y="138" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const normalizedXml = normalizeBpmnVerticalLayout(horizontalXml);

        const start = extractShapeBounds(normalizedXml, 'StartEvent_1');
        const task1 = extractShapeBounds(normalizedXml, 'Task_1');
        const task2 = extractShapeBounds(normalizedXml, 'Task_2');
        const end = extractShapeBounds(normalizedXml, 'EndEvent_1');

        const centerX = (shape) => shape.x + (shape.width / 2);
        expect(centerX(start)).toBeCloseTo(centerX(task1), 3);
        expect(centerX(task1)).toBeCloseTo(centerX(task2), 3);
        expect(centerX(task2)).toBeCloseTo(centerX(end), 3);

        expect(start.y).toBeLessThan(task1.y);
        expect(task1.y).toBeLessThan(task2.y);
        expect(task2.y).toBeLessThan(end.y);

        const flow1 = extractWaypoints(normalizedXml, 'Flow_1');
        const flow2 = extractWaypoints(normalizedXml, 'Flow_2');
        const flow3 = extractWaypoints(normalizedXml, 'Flow_3');

        expect(flow1).toHaveLength(2);
        expect(flow2).toHaveLength(2);
        expect(flow3).toHaveLength(2);

        expect(flow1[0].x).toBeCloseTo(flow1[1].x, 3);
        expect(flow2[0].x).toBeCloseTo(flow2[1].x, 3);
        expect(flow3[0].x).toBeCloseTo(flow3[1].x, 3);

        expect(flow1[0].y).toBeLessThan(flow1[1].y);
        expect(flow2[0].y).toBeLessThan(flow2[1].y);
        expect(flow3[0].y).toBeLessThan(flow3[1].y);
    });

    test('frontend generation flow normalizes BPMN xml before render and save', () => {
        const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');

        expect(scriptSource).toContain('function normalizeGeneratedBpmnXml(xml)');
        expect(scriptSource).toContain('parsedResponse.mermaidCode = normalizeGeneratedBpmnXml(parsedResponse.mermaidCode);');
        expect(scriptSource).toContain('normalizeGeneratedBpmnXml(code.replace(/```xml/g, \'\').replace(/```/g, \'\').trim())');
    });
});
