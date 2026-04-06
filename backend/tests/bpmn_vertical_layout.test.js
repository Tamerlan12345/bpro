const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
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

function expectXmlToParse(xml) {
    const issues = [];
    new DOMParser({
        errorHandler: {
            warning: (message) => issues.push(message),
            error: (message) => issues.push(message),
            fatalError: (message) => issues.push(message)
        }
    }).parseFromString(xml, 'text/xml');

    expect(issues).toEqual([]);
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

        expect(normalizedXml.match(/<dc:Bounds\b[^>]*\/>/gi)).toHaveLength(4);

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

    test('repositions exclusive gateway branching into a top-down layout', () => {
        const branchXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions targetNamespace="http://bpmn.io/schema/bpmn" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"><bpmn2:outgoing>Flow_1</bpmn2:outgoing></bpmn2:startEvent>
    <bpmn2:exclusiveGateway id="Gateway_1"><bpmn2:incoming>Flow_1</bpmn2:incoming><bpmn2:outgoing>Flow_2</bpmn2:outgoing><bpmn2:outgoing>Flow_3</bpmn2:outgoing></bpmn2:exclusiveGateway>
    <bpmn2:task id="Task_Yes"><bpmn2:incoming>Flow_2</bpmn2:incoming></bpmn2:task>
    <bpmn2:task id="Task_No"><bpmn2:incoming>Flow_3</bpmn2:incoming></bpmn2:task>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Gateway_1" />
    <bpmn2:sequenceFlow id="Flow_2" name="да" sourceRef="Gateway_1" targetRef="Task_Yes" />
    <bpmn2:sequenceFlow id="Flow_3" name="нет" sourceRef="Gateway_1" targetRef="Task_No" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1"><dc:Bounds x="100" y="200" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Yes_di" bpmnElement="Task_Yes"><dc:Bounds x="10" y="300" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_No_di" bpmnElement="Task_No"><dc:Bounds x="150" y="300" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="118" y="136" />
        <di:waypoint x="125" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="125" y="250" />
        <di:waypoint x="60" y="300" />
        <bpmndi:BPMNLabel><dc:Bounds x="70" y="260" width="24" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="125" y="250" />
        <di:waypoint x="200" y="300" />
        <bpmndi:BPMNLabel><dc:Bounds x="160" y="260" width="30" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const result = normalizeBpmnVerticalLayout(branchXml);
        const start = extractShapeBounds(result, 'StartEvent_1');
        const gateway = extractShapeBounds(result, 'Gateway_1');
        const taskYes = extractShapeBounds(result, 'Task_Yes');
        const taskNo = extractShapeBounds(result, 'Task_No');
        const flow2 = extractWaypoints(result, 'Flow_2');
        const flow3 = extractWaypoints(result, 'Flow_3');

        const startCenterX = start.x + (start.width / 2);
        const gatewayCenterX = gateway.x + (gateway.width / 2);
        const yesCenterX = taskYes.x + (taskYes.width / 2);
        const noCenterX = taskNo.x + (taskNo.width / 2);

        expect(start.y).toBeLessThan(gateway.y);
        expect(gateway.y).toBeLessThan(taskYes.y);
        expect(gateway.y).toBeLessThan(taskNo.y);
        expect(taskYes.y).toBeCloseTo(taskNo.y, 3);
        expect(startCenterX).toBeCloseTo(gatewayCenterX, 3);
        expect(Math.min(yesCenterX, noCenterX)).toBeLessThan(gatewayCenterX);
        expect(Math.max(yesCenterX, noCenterX)).toBeGreaterThan(gatewayCenterX);
        expect(flow2.length).toBeGreaterThanOrEqual(4);
        expect(flow3.length).toBeGreaterThanOrEqual(4);
        expect(result).toMatch(/name="да"/i);
        expect(result).toMatch(/name="нет"/i);
    });

    test('keeps the main path vertical when a gateway has a loopback correction branch', () => {
        const loopbackXml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <bpmn2:task id="Task_Review" name="Review draft">
      <bpmn2:incoming>Flow_1</bpmn2:incoming>
      <bpmn2:outgoing>Flow_2</bpmn2:outgoing>
    </bpmn2:task>
    <bpmn2:exclusiveGateway id="Gateway_1" name="Approved?">
      <bpmn2:incoming>Flow_2</bpmn2:incoming>
      <bpmn2:outgoing>Flow_3</bpmn2:outgoing>
      <bpmn2:outgoing>Flow_4</bpmn2:outgoing>
    </bpmn2:exclusiveGateway>
    <bpmn2:task id="Task_Rework" name="Fix remarks">
      <bpmn2:incoming>Flow_3</bpmn2:incoming>
      <bpmn2:outgoing>Flow_5</bpmn2:outgoing>
    </bpmn2:task>
    <bpmn2:task id="Task_Approve" name="Approve document">
      <bpmn2:incoming>Flow_4</bpmn2:incoming>
      <bpmn2:outgoing>Flow_6</bpmn2:outgoing>
    </bpmn2:task>
    <bpmn2:endEvent id="EndEvent_1">
      <bpmn2:incoming>Flow_6</bpmn2:incoming>
    </bpmn2:endEvent>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_Review" />
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_Review" targetRef="Gateway_1" />
    <bpmn2:sequenceFlow id="Flow_3" name="нет" sourceRef="Gateway_1" targetRef="Task_Rework" />
    <bpmn2:sequenceFlow id="Flow_4" name="да" sourceRef="Gateway_1" targetRef="Task_Approve" />
    <bpmn2:sequenceFlow id="Flow_5" sourceRef="Task_Rework" targetRef="Task_Review" />
    <bpmn2:sequenceFlow id="Flow_6" sourceRef="Task_Approve" targetRef="EndEvent_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review"><dc:Bounds x="100" y="220" width="140" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1"><dc:Bounds x="130" y="360" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Rework_di" bpmnElement="Task_Rework"><dc:Bounds x="20" y="480" width="140" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_di" bpmnElement="Task_Approve"><dc:Bounds x="220" y="480" width="140" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="260" y="620" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="118" y="136" />
        <di:waypoint x="170" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="170" y="300" />
        <di:waypoint x="155" y="360" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="155" y="410" />
        <di:waypoint x="90" y="480" />
        <bpmndi:BPMNLabel><dc:Bounds x="95" y="428" width="30" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="155" y="410" />
        <di:waypoint x="290" y="480" />
        <bpmndi:BPMNLabel><dc:Bounds x="225" y="428" width="24" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="90" y="560" />
        <di:waypoint x="170" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="290" y="560" />
        <di:waypoint x="278" y="620" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const result = normalizeBpmnVerticalLayout(loopbackXml);
        const start = extractShapeBounds(result, 'StartEvent_1');
        const review = extractShapeBounds(result, 'Task_Review');
        const gateway = extractShapeBounds(result, 'Gateway_1');
        const rework = extractShapeBounds(result, 'Task_Rework');
        const approve = extractShapeBounds(result, 'Task_Approve');
        const end = extractShapeBounds(result, 'EndEvent_1');
        const loopback = extractWaypoints(result, 'Flow_5');

        const centerX = (shape) => shape.x + (shape.width / 2);

        expect(centerX(start)).toBeCloseTo(centerX(review), 3);
        expect(centerX(review)).toBeCloseTo(centerX(gateway), 3);
        expect(centerX(gateway)).toBeCloseTo(centerX(approve), 3);
        expect(centerX(approve)).toBeCloseTo(centerX(end), 3);
        expect(rework.y).toBeCloseTo(approve.y, 3);
        expect(centerX(rework)).toBeLessThan(centerX(gateway) - 40);
        expect(loopback.length).toBeGreaterThanOrEqual(4);
        expect(loopback[0].y).toBeGreaterThan(loopback[loopback.length - 1].y);
        expect(loopback.some((point) => point.x < centerX(gateway) - 60)).toBe(true);
    });

    test('sanitizes invalid condition labels on full-tag linear flows', () => {
        const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://bpmn.io/schema/bpmn" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:task id="Task_1"><bpmn2:outgoing>Flow_1</bpmn2:outgoing></bpmn2:task>
    <bpmn2:task id="Task_2"><bpmn2:incoming>Flow_1</bpmn2:incoming></bpmn2:task>
    <bpmn2:sequenceFlow id="Flow_1" name="да" sourceRef="Task_1" targetRef="Task_2">
      <bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">Some condition</bpmn2:conditionExpression>
    </bpmn2:sequenceFlow>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="100" y="100" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2"><dc:Bounds x="100" y="300" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <bpmndi:BPMNLabel><dc:Bounds x="120" y="200" width="20" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const result = normalizeBpmnVerticalLayout(invalidXml);

        expect(result).not.toMatch(/name="да"/i);
        expect(result).not.toMatch(/<bpmn2:conditionExpression/i);
        expect(result).not.toMatch(/<bpmndi:BPMNLabel>/i);
    });

    test('sanitizes invalid condition labels on self-closing linear flows', () => {
        const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions targetNamespace="http://bpmn.io/schema/bpmn" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:task id="Task_1"><bpmn2:outgoing>Flow_1</bpmn2:outgoing></bpmn2:task>
    <bpmn2:task id="Task_2"><bpmn2:incoming>Flow_1</bpmn2:incoming></bpmn2:task>
    <bpmn2:sequenceFlow id="Flow_1" name="нет" sourceRef="Task_1" targetRef="Task_2" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="100" y="100" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2"><dc:Bounds x="100" y="300" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <bpmndi:BPMNLabel><dc:Bounds x="120" y="200" width="20" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const result = normalizeBpmnVerticalLayout(invalidXml);

        expect(result).not.toMatch(/name="нет"/i);
        expect(result).not.toMatch(/<bpmndi:BPMNLabel>/i);
    });

    test('rebuilds BPMNEdge markup into valid XML when original waypoints use paired tags', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions targetNamespace="http://bpmn.io/schema/bpmn" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1"><bpmn2:outgoing>Flow_1</bpmn2:outgoing></bpmn2:startEvent>
    <bpmn2:task id="Task_1"><bpmn2:incoming>Flow_1</bpmn2:incoming><bpmn2:outgoing>Flow_2</bpmn2:outgoing></bpmn2:task>
    <bpmn2:endEvent id="EndEvent_1"><bpmn2:incoming>Flow_2</bpmn2:incoming></bpmn2:endEvent>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="100" y="120" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="220" y="100" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="380" y="120" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="136" y="138"></di:waypoint>
        <di:waypoint x="220" y="138"></di:waypoint>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="320" y="138"></di:waypoint>
        <di:waypoint x="380" y="138"></di:waypoint>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

        const result = normalizeBpmnVerticalLayout(xml);

        expectXmlToParse(result);
        expect(extractWaypoints(result, 'Flow_1')).toHaveLength(2);
        expect(extractWaypoints(result, 'Flow_2')).toHaveLength(2);
    });

    test('frontend generation flow normalizes BPMN xml before render and save', () => {
        const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        const indexPath = path.join(__dirname, '..', 'public', 'index.html');
        const indexSource = fs.readFileSync(indexPath, 'utf8');

        expect(scriptSource).toContain('function normalizeGeneratedBpmnXml(xml)');
        expect(scriptSource).toContain('parsedResponse.mermaidCode = normalizeGeneratedBpmnXml(parsedResponse.mermaidCode);');
        expect(scriptSource).toContain('normalizeGeneratedBpmnXml(code.replace(/```xml/g, \'\').replace(/```/g, \'\').trim())');
        expect(scriptSource).toContain('exclusiveGateway');
        expect(scriptSource).toContain('conditionExpression');
        expect(scriptSource).toContain('да"/"нет"');
        expect(scriptSource).toContain('круги допустимы только для начала и завершения процесса');
        expect(scriptSource).toContain('Каждый <bpmn2:exclusiveGateway> должен иметь короткий вопрос');
        expect(scriptSource).toContain('Основной поток строй сверху вниз');
        expect(indexSource).toContain('Событие (только старт/завершение)');
        expect(indexSource).toContain('Шлюз / решение (ромб с вопросом)');
    });
});
