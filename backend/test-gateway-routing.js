'use strict';
const { normalizeBpmnVerticalLayout } = require('./public/bpmn-vertical-layout.js');

const xml = `<?xml version='1.0' encoding='UTF-8'?>
<bpmn2:definitions xmlns:bpmn2='http://www.omg.org/spec/BPMN/20100524/MODEL'
  xmlns:bpmndi='http://www.omg.org/spec/BPMN/20100524/DI'
  xmlns:dc='http://www.omg.org/spec/DD/20100524/DC'
  xmlns:di='http://www.omg.org/spec/DD/20100524/DI'
  id='Def1' targetNamespace='http://bpmn.io/schema/bpmn'>
  <bpmn2:process id='P1' isExecutable='false'>
    <bpmn2:startEvent id='start1'><bpmn2:outgoing>f1</bpmn2:outgoing></bpmn2:startEvent>
    <bpmn2:task id='task1' name='Шаг 1'><bpmn2:incoming>f1</bpmn2:incoming><bpmn2:outgoing>f2</bpmn2:outgoing></bpmn2:task>
    <bpmn2:exclusiveGateway id='gw1' name='Документ корректен?'>
      <bpmn2:incoming>f2</bpmn2:incoming><bpmn2:outgoing>f3</bpmn2:outgoing><bpmn2:outgoing>f4</bpmn2:outgoing>
    </bpmn2:exclusiveGateway>
    <bpmn2:task id='task2' name='Следующий шаг'><bpmn2:incoming>f3</bpmn2:incoming><bpmn2:outgoing>f5</bpmn2:outgoing></bpmn2:task>
    <bpmn2:task id='task3' name='Запрос документов'><bpmn2:incoming>f4</bpmn2:incoming><bpmn2:outgoing>f6</bpmn2:outgoing></bpmn2:task>
    <bpmn2:endEvent id='end1'><bpmn2:incoming>f5</bpmn2:incoming></bpmn2:endEvent>
    <bpmn2:sequenceFlow id='f1' sourceRef='start1' targetRef='task1' />
    <bpmn2:sequenceFlow id='f2' sourceRef='task1' targetRef='gw1' />
    <bpmn2:sequenceFlow id='f3' name='да' sourceRef='gw1' targetRef='task2' />
    <bpmn2:sequenceFlow id='f4' name='нет' sourceRef='gw1' targetRef='task3' />
    <bpmn2:sequenceFlow id='f5' sourceRef='task2' targetRef='end1' />
    <bpmn2:sequenceFlow id='f6' sourceRef='task3' targetRef='gw1' />
  </bpmn2:process>
  <bpmndi:BPMNDiagram><bpmndi:BPMNPlane bpmnElement='P1'>
    <bpmndi:BPMNShape bpmnElement='start1'><dc:Bounds x='100' y='100' width='36' height='36'/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape bpmnElement='task1'><dc:Bounds x='60' y='200' width='160' height='80'/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape bpmnElement='gw1'><dc:Bounds x='120' y='340' width='72' height='72'/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape bpmnElement='task2'><dc:Bounds x='60' y='480' width='160' height='80'/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape bpmnElement='task3'><dc:Bounds x='300' y='480' width='160' height='80'/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape bpmnElement='end1'><dc:Bounds x='100' y='640' width='36' height='36'/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge bpmnElement='f1'><di:waypoint x='118' y='136'/><di:waypoint x='140' y='200'/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge bpmnElement='f2'><di:waypoint x='140' y='280'/><di:waypoint x='156' y='340'/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge bpmnElement='f3'><di:waypoint x='156' y='412'/><di:waypoint x='140' y='480'/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge bpmnElement='f4'><di:waypoint x='192' y='376'/><di:waypoint x='380' y='480'/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge bpmnElement='f5'><di:waypoint x='140' y='560'/><di:waypoint x='118' y='640'/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge bpmnElement='f6'><di:waypoint x='380' y='560'/><di:waypoint x='156' y='376'/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

function getBounds(xml, id) {
    // Match both single and double-quoted bpmnElement attribute
    const re = new RegExp(
        '<bpmndi:BPMNShape[^>]*bpmnElement=[\'"]' + id + '[\'"][^>]*>[\\s\\S]*?<dc:Bounds([^>]*)/?>', 'i'
    );
    const m = xml.match(re);
    if (!m) { console.log('NOT FOUND:', id); return null; }
    const attrs = {};
    String(m[1]).replace(/([a-z]+)=["']([^"']+)["']/gi, (_, k, v) => { attrs[k] = parseFloat(v); });
    return attrs;
}

const result = normalizeBpmnVerticalLayout(xml);

const gw = getBounds(result, 'gw1');
const yesTask = getBounds(result, 'task2');
const noTask = getBounds(result, 'task3');

console.log('Gateway(gw1)  x:', gw.x, ' y:', gw.y);
console.log('YES(task2)    x:', yesTask.x, ' y:', yesTask.y);
console.log('NO(task3)     x:', noTask.x, ' y:', noTask.y);

const gwCenterX = gw.x + 36;         // half of 72
const yesCenterX = yesTask.x + 80;   // half of 160
const noCenterX = noTask.x + 80;

// "да" must be roughly aligned with gateway (within 100px horizontally)
const yesIsAligned = Math.abs(yesCenterX - gwCenterX) < 100;
// "нет" must be displaced sideways from gateway (>100px)
const noIsSideways = Math.abs(noCenterX - gwCenterX) > 100;
// "да" Y must be BELOW gateway
const yesIsBelow = yesTask.y > gw.y;

console.log('');
console.log('[TEST] YES(да) aligned vertically with gateway:', yesIsAligned ? 'PASS' : 'FAIL');
console.log('[TEST] NO(нет) displaced sideways from gateway:', noIsSideways ? 'PASS' : 'FAIL');
console.log('[TEST] YES(да) is below gateway:', yesIsBelow ? 'PASS' : 'FAIL');

const allPass = yesIsAligned && noIsSideways && yesIsBelow;
console.log('');
console.log(allPass ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
process.exit(allPass ? 0 : 1);
