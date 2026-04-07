const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { normalizeBpmnVerticalLayout } = require('../public/bpmn-vertical-layout.js');
const { buildBpmnPresentationModel, escapeXml } = require('../public/bpmn-presentation.js');

const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'visio-template.vsdx');
const VISIO_NS = 'http://schemas.microsoft.com/office/visio/2012/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PX_PER_INCH = 96;
const MIN_CONNECTOR_SIZE_IN = 0.04;

const MASTER_BY_KIND = {
    task: { id: 4, nameU: 'Process' },
    gateway: { id: 2, nameU: 'Decision' },
    document: { id: 7, nameU: 'Document' },
    reference: { id: 6, nameU: 'External Data' },
    database: { id: 11, nameU: 'Database' },
    event: { id: 14, nameU: 'On-page reference' },
    connector: { id: 5, nameU: 'Dynamic connector' }
};

function round(value) {
    return Number(value.toFixed(6));
}

function pxToIn(px) {
    return round(px / PX_PER_INCH);
}

function escapeVisioText(value) {
    return escapeXml(String(value || '').replace(/\r\n/g, '\n')).replace(/\n/g, '&#xA;');
}

function getNodeText(node) {
    if (node.attachedDocuments && node.attachedDocuments.length > 0) {
        return `${node.name}\nДокумент: ${node.attachedDocuments.join(', ')}`;
    }

    return node.name || node.id;
}

function toPageSpace(model) {
    const marginPx = 72;
    const rightRailPx = model.lanes.length ? 160 : 88;
    const widthPx = Math.max(model.bounds.width + rightRailPx, 960);
    const heightPx = Math.max(model.bounds.height, 720);
    const offsetX = marginPx - model.bounds.minX;
    const offsetY = marginPx - model.bounds.minY;

    return {
        widthPx,
        heightPx,
        offsetX,
        offsetY
    };
}

function toVisioPoint(point, pageSpace) {
    return {
        x: pxToIn(point.x + pageSpace.offsetX),
        y: pxToIn(pageSpace.heightPx - (point.y + pageSpace.offsetY))
    };
}

function buildNodeShapeXml(id, node, pageSpace) {
    const master = MASTER_BY_KIND[node.kind] || MASTER_BY_KIND.task;
    const leftPx = node.x + pageSpace.offsetX;
    const topPx = node.y + pageSpace.offsetY;
    const widthIn = pxToIn(Math.max(node.width, 34));
    const heightIn = pxToIn(Math.max(node.height, 34));
    const pinX = pxToIn(leftPx + node.width / 2);
    const pinY = pxToIn(pageSpace.heightPx - (topPx + node.height / 2));
    const locPinX = round(widthIn / 2);
    const locPinY = round(heightIn / 2);
    const label = escapeVisioText(getNodeText(node));

    return `
<Shape ID='${id}' NameU='${master.nameU}' Name='${escapeXml(node.name || node.id)}' Type='Shape' Master='${master.id}'>
  <Cell N='PinX' V='${pinX}'/>
  <Cell N='PinY' V='${pinY}'/>
  <Cell N='Width' V='${widthIn}'/>
  <Cell N='Height' V='${heightIn}'/>
  <Cell N='LocPinX' V='${locPinX}'/>
  <Cell N='LocPinY' V='${locPinY}'/>
  <Cell N='TxtPinX' V='${locPinX}'/>
  <Cell N='TxtPinY' V='${locPinY}'/>
  <Cell N='TxtWidth' V='${widthIn}'/>
  <Cell N='TxtHeight' V='${heightIn}'/>
  <Cell N='TxtLocPinX' V='${locPinX}'/>
  <Cell N='TxtLocPinY' V='${locPinY}'/>
  <Text>${label}</Text>
</Shape>`.trim();
}

function buildConnectorShapeXml(id, startPoint, endPoint, label, options = {}) {
    const beginX = round(startPoint.x);
    const beginY = round(startPoint.y);
    const endX = round(endPoint.x);
    const endY = round(endPoint.y);
    const widthIn = Math.max(Math.abs(endX - beginX), MIN_CONNECTOR_SIZE_IN);
    const heightIn = Math.max(Math.abs(endY - beginY), MIN_CONNECTOR_SIZE_IN);
    const pinX = round((beginX + endX) / 2);
    const pinY = round((beginY + endY) / 2);
    const locPinX = round(widthIn / 2);
    const locPinY = round(heightIn / 2);
    const connectorText = label ? `<Text>${escapeVisioText(label)}</Text>` : '';

    return `
<Shape ID='${id}' NameU='${MASTER_BY_KIND.connector.nameU}' Name='${escapeXml(label || `Flow ${id}`)}' Type='Shape' Master='${MASTER_BY_KIND.connector.id}'>
  <Cell N='PinX' V='${pinX}'/>
  <Cell N='PinY' V='${pinY}'/>
  <Cell N='Width' V='${round(widthIn)}'/>
  <Cell N='Height' V='${round(heightIn)}'/>
  <Cell N='LocPinX' V='${locPinX}'/>
  <Cell N='LocPinY' V='${locPinY}'/>
  <Cell N='BeginX' V='${beginX}'/>
  <Cell N='BeginY' V='${beginY}'/>
  <Cell N='EndX' V='${endX}'/>
  <Cell N='EndY' V='${endY}'/>
  <Cell N='LayerMember' V='1'/>
  <Cell N='LinePattern' V='${options.linePattern || 1}'/>
  <Cell N='BeginArrow' V='${options.beginArrow || 0}'/>
  <Cell N='EndArrow' V='${options.endArrow || 0}'/>
  <Cell N='LineWeight' V='${options.lineWeight || 0.010417}'/>
  ${connectorText}
</Shape>`.trim();
}

function buildEdgeSegments(edge, pageSpace, includeArrow) {
    const segments = [];
    const points = edge.points || [];
    if (points.length < 2) {
        return segments;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        if (!start || !end) continue;
        if (start.x === end.x && start.y === end.y) continue;

        segments.push({
            start: toVisioPoint(start, pageSpace),
            end: toVisioPoint(end, pageSpace),
            label: index === Math.floor((points.length - 2) / 2) ? edge.name : '',
            endArrow: includeArrow && index === points.length - 2 ? 5 : 0
        });
    }

    return segments;
}

function buildLaneDecorations(model, pageSpace, startingId) {
    if (!model.lanes.length) {
        return { nextId: startingId, shapes: [] };
    }

    const shapes = [];
    let nextId = startingId;
    const leftX = model.bounds.minX + 12;
    const rightX = model.bounds.maxX + 88;

    model.lanes.forEach((lane, index) => {
        if (index < model.lanes.length - 1) {
            shapes.push(buildConnectorShapeXml(
                nextId++,
                toVisioPoint({ x: leftX, y: lane.y + lane.height }, pageSpace),
                toVisioPoint({ x: rightX, y: lane.y + lane.height }, pageSpace),
                lane.name,
                { linePattern: 23, lineWeight: 0.006944 }
            ));
        }
    });

    shapes.push(buildConnectorShapeXml(
        nextId++,
        toVisioPoint({ x: rightX, y: model.bounds.minY - 18 }, pageSpace),
        toVisioPoint({ x: rightX, y: model.bounds.maxY + 36 }, pageSpace),
        'Зона ответственности',
        { linePattern: 23, lineWeight: 0.006944, endArrow: 5 }
    ));

    return { nextId, shapes };
}

function buildPage1Xml(model) {
    const pageSpace = toPageSpace(model);
    let nextId = 1;
    const shapes = [];

    model.nodes.forEach((node) => {
        shapes.push(buildNodeShapeXml(nextId++, node, pageSpace));
    });

    model.edges.forEach((edge) => {
        buildEdgeSegments(edge, pageSpace, true).forEach((segment) => {
            shapes.push(buildConnectorShapeXml(nextId++, segment.start, segment.end, segment.label, {
                endArrow: segment.endArrow,
                linePattern: 1
            }));
        });
    });

    const laneDecorations = buildLaneDecorations(model, pageSpace, nextId);
    shapes.push(...laneDecorations.shapes);

    return `<?xml version='1.0' encoding='utf-8' ?>\n<PageContents xmlns='${VISIO_NS}' xmlns:r='${REL_NS}' xml:space='preserve'><Shapes>${shapes.join('')}</Shapes></PageContents>`;
}

function replaceCellValue(xml, cellName, nextValue) {
    const value = escapeXml(String(nextValue));
    return xml.replace(
        new RegExp(`(<Cell N='${cellName}' V=')[^']+('(?:\\s[^>]*)?\\/>)`, 'i'),
        `$1${value}$2`
    );
}

function updatePagesXml(pagesXml, model) {
    const pageSpace = toPageSpace(model);
    const pageWidth = pxToIn(pageSpace.widthPx);
    const pageHeight = pxToIn(pageSpace.heightPx);
    const centerX = round(pageWidth / 2);
    const centerY = round(pageHeight / 2);

    let nextXml = pagesXml;
    nextXml = replaceCellValue(nextXml, 'PageWidth', pageWidth);
    nextXml = replaceCellValue(nextXml, 'PageHeight', pageHeight);
    nextXml = nextXml.replace(/(ViewCenterX=')[^']+(')/i, `$1${centerX}$2`);
    nextXml = nextXml.replace(/(ViewCenterY=')[^']+(')/i, `$1${centerY}$2`);
    return nextXml;
}

async function createVsdxFromBpmnXml(bpmnXml) {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(`Visio template not found at ${TEMPLATE_PATH}`);
    }

    const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(templateBuffer);
    const normalizedXml = normalizeBpmnVerticalLayout(String(bpmnXml || ''));
    const model = buildBpmnPresentationModel(normalizedXml);

    zip.file('visio/pages/page1.xml', buildPage1Xml(model));

    const pagesXml = await zip.file('visio/pages/pages.xml').async('string');
    zip.file('visio/pages/pages.xml', updatePagesXml(pagesXml, model));

    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

module.exports = {
    createVsdxFromBpmnXml
};
