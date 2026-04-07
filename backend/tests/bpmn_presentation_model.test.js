const { buildBpmnPresentationModel, renderDocStyleSvg } = require('../public/bpmn-presentation.js');

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:laneSet id="LaneSet_1">
      <bpmn2:lane id="Lane_1" name="Операционный отдел">
        <bpmn2:flowNodeRef>Task_1</bpmn2:flowNodeRef>
        <bpmn2:flowNodeRef>Gateway_1</bpmn2:flowNodeRef>
        <bpmn2:flowNodeRef>Call_1</bpmn2:flowNodeRef>
      </bpmn2:lane>
    </bpmn2:laneSet>
    <bpmn2:startEvent id="Start_1" name="Старт" />
    <bpmn2:task id="Task_1" name="Проверить заявку">
      <bpmn2:dataInputAssociation id="DIA_1">
        <bpmn2:sourceRef>DocRef_1</bpmn2:sourceRef>
      </bpmn2:dataInputAssociation>
    </bpmn2:task>
    <bpmn2:exclusiveGateway id="Gateway_1" name="Документ корректен?" />
    <bpmn2:callActivity id="Call_1" name="Передать в процесс согласования" calledElement="BP-42" />
    <bpmn2:dataObject id="Doc_1" />
    <bpmn2:dataObjectReference id="DocRef_1" name="Заявка" dataObjectRef="Doc_1" />
    <bpmn2:dataStoreReference id="Store_1" name="БД договоров" />
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1" />
    <bpmn2:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Call_1" name="да" />
    <bpmn2:sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_1" name="нет" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="520" y="80" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="460" y="180" width="160" height="100" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1"><dc:Bounds x="490" y="340" width="100" height="100" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Call_1_di" bpmnElement="Call_1"><dc:Bounds x="450" y="500" width="180" height="110" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="DocRef_1_di" bpmnElement="DocRef_1"><dc:Bounds x="700" y="195" width="110" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Store_1_di" bpmnElement="Store_1"><dc:Bounds x="760" y="510" width="120" height="90" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1"><dc:Bounds x="320" y="40" width="680" height="660" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="538" y="116" /><di:waypoint x="540" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="540" y="280" /><di:waypoint x="540" y="340" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="590" y="390" /><di:waypoint x="590" y="450" /><di:waypoint x="540" y="500" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="490" y="390" /><di:waypoint x="400" y="390" /><di:waypoint x="400" y="230" /><di:waypoint x="460" y="230" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

describe('bpmn presentation model', () => {
    test('collapses task and related document into a composite task node', () => {
        const model = buildBpmnPresentationModel(sampleXml);
        const taskNode = model.nodes.find((node) => node.id === 'Task_1');

        expect(taskNode).toBeTruthy();
        expect(taskNode.attachedDocuments).toEqual(['Заявка']);
        expect(model.nodes.find((node) => node.id === 'DocRef_1')).toBeUndefined();
    });

    test('preserves gateway branches and labels for yes/no routing', () => {
        const model = buildBpmnPresentationModel(sampleXml);
        const gateway = model.nodes.find((node) => node.id === 'Gateway_1');
        const edgeLabels = model.edges.map((edge) => edge.name);

        expect(gateway?.kind).toBe('gateway');
        expect(edgeLabels).toContain('да');
        expect(edgeLabels).toContain('нет');
    });

    test('maps call activities, databases, and lanes into doc-style primitives', () => {
        const model = buildBpmnPresentationModel(sampleXml);

        expect(model.nodes.find((node) => node.id === 'Call_1')?.kind).toBe('reference');
        expect(model.nodes.find((node) => node.id === 'Store_1')?.kind).toBe('database');
        expect(model.lanes).toHaveLength(1);
        expect(model.lanes[0].name).toBe('Операционный отдел');
    });

    test('renders SVG with responsibility axis and node geometry', () => {
        const model = buildBpmnPresentationModel(sampleXml);
        const svg = renderDocStyleSvg(model);

        expect(svg).toContain('Зона ответственности');
        expect(svg).toContain('doc-edge-line');
        expect(svg).toContain('Передать в процесс согласования');
    });
    test('uses a neutral office-like svg style for readability', () => {
        const model = buildBpmnPresentationModel(sampleXml);
        const svg = renderDocStyleSvg(model);

        expect(svg).toContain('.doc-root { font-family: "Manrope", "Segoe UI", sans-serif; }');
        expect(svg).toContain('.doc-node { stroke: #5f6b7a; stroke-width: 1.35; }');
        expect(svg).toContain('.task-shape { fill: #ffffff; }');
        expect(svg).toContain('.doc-edge-line { fill: none; stroke: #6a7482; stroke-width: 1.6; stroke-linecap: square; stroke-linejoin: miter; }');
        expect(svg).toContain('.doc-lane-boundary { stroke: #9aa4b2; stroke-width: 1; stroke-dasharray: 6 6; }');
        expect(svg).toContain('.responsibility-axis { stroke: #8fa2b2; stroke-width: 1.2; stroke-dasharray: 7 6; }');
    });
});
