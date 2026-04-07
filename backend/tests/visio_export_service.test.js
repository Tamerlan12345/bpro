const JSZip = require('jszip');
const { createVsdxFromBpmnXml } = require('../services/visioExportService');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1">
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="Start_1" name="Старт" />
    <bpmn2:task id="Task_1" name="Проверить заявку" />
    <bpmn2:exclusiveGateway id="Gateway_1" name="Документ корректен?" />
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="520" y="80" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="460" y="180" width="160" height="90" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1"><dc:Bounds x="490" y="340" width="100" height="100" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="538" y="116" /><di:waypoint x="538" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="540" y="270" /><di:waypoint x="540" y="340" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

describe('visio export service', () => {
    test('builds a valid vsdx package with updated page payloads', async () => {
        const buffer = await createVsdxFromBpmnXml(xml);
        const zip = await JSZip.loadAsync(buffer);

        expect(zip.file('visio/pages/page1.xml')).toBeTruthy();
        expect(zip.file('visio/pages/pages.xml')).toBeTruthy();

        const page1 = await zip.file('visio/pages/page1.xml').async('string');
        const pages = await zip.file('visio/pages/pages.xml').async('string');

        expect(page1).toContain("Master='4'");
        expect(page1).toContain("Master='2'");
        expect(page1).toContain('Проверить заявку');
        expect(page1).toContain('Документ корректен?');
        expect(pages).toContain("PageWidth");
        expect(pages).toContain("PageHeight");
    });
});
