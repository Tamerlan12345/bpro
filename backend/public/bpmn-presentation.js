(function (globalScope) {
    function parseAttributes(fragment) {
        const attributes = {};
        if (!fragment) return attributes;

        const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g;
        let match = pattern.exec(fragment);
        while (match) {
            attributes[match[1]] = match[2];
            match = pattern.exec(fragment);
        }

        return attributes;
    }

    function escapeXml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function decodeXml(value) {
        return String(value || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, '\'')
            .replace(/&amp;/g, '&');
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function collectElementMeta(xml) {
        const meta = new Map();
        const pattern = /<(?!\/)(?:bpmn2?:)?([A-Za-z0-9_]+)\b([^>]*)>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const type = match[1];
            const attrs = parseAttributes(match[2]);
            if (attrs.id) {
                meta.set(attrs.id, {
                    id: attrs.id,
                    type,
                    name: decodeXml(attrs.name || ''),
                    calledElement: attrs.calledElement || ''
                });
            }
            match = pattern.exec(xml);
        }

        return meta;
    }

    function collectShapes(xml) {
        const shapes = [];
        const pattern = /<bpmndi:BPMNShape\b([^>]*)>([\s\S]*?)<\/bpmndi:BPMNShape>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const attrs = parseAttributes(match[1]);
            const boundsMatch = match[2].match(/<dc:Bounds\b([^>]*)\/?>/i);
            if (!attrs.bpmnElement || !boundsMatch) {
                match = pattern.exec(xml);
                continue;
            }

            const boundsAttrs = parseAttributes(boundsMatch[1]);
            const x = Number.parseFloat(boundsAttrs.x);
            const y = Number.parseFloat(boundsAttrs.y);
            const width = Number.parseFloat(boundsAttrs.width);
            const height = Number.parseFloat(boundsAttrs.height);
            if ([x, y, width, height].every(Number.isFinite)) {
                shapes.push({
                    id: attrs.bpmnElement,
                    x,
                    y,
                    width,
                    height
                });
            }

            match = pattern.exec(xml);
        }

        return shapes;
    }

    function collectEdges(xml) {
        const edges = [];
        const pattern = /<bpmndi:BPMNEdge\b([^>]*)>([\s\S]*?)<\/bpmndi:BPMNEdge>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const attrs = parseAttributes(match[1]);
            if (!attrs.bpmnElement) {
                match = pattern.exec(xml);
                continue;
            }

            const points = [...match[2].matchAll(/<di:waypoint\b([^>]*)\/?>/gi)]
                .map((pointMatch) => {
                    const pointAttrs = parseAttributes(pointMatch[1]);
                    const x = Number.parseFloat(pointAttrs.x);
                    const y = Number.parseFloat(pointAttrs.y);
                    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
                })
                .filter(Boolean);

            edges.push({
                id: attrs.bpmnElement,
                points
            });

            match = pattern.exec(xml);
        }

        return edges;
    }

    function collectSequenceFlows(xml) {
        const flows = new Map();
        const pattern = /<(?:bpmn2?:)?sequenceFlow\b([^>]*)\/?>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const attrs = parseAttributes(match[1]);
            if (attrs.id && attrs.sourceRef && attrs.targetRef) {
                flows.set(attrs.id, {
                    id: attrs.id,
                    sourceRef: attrs.sourceRef,
                    targetRef: attrs.targetRef,
                    name: decodeXml(attrs.name || '')
                });
            }
            match = pattern.exec(xml);
        }

        return flows;
    }

    function collectDataAssociations(xml) {
        const dataToTask = new Map();
        const pattern = /<(?:bpmn2?:)?(?:task|callActivity)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:bpmn2?:)?(?:task|callActivity)>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const taskId = match[1];
            const body = match[2];

            [...body.matchAll(/<(?:bpmn2?:)?targetRef>([^<]+)<\/(?:bpmn2?:)?targetRef>/gi)].forEach((refMatch) => {
                dataToTask.set(refMatch[1].trim(), taskId);
            });

            [...body.matchAll(/<(?:bpmn2?:)?sourceRef>([^<]+)<\/(?:bpmn2?:)?sourceRef>/gi)].forEach((refMatch) => {
                dataToTask.set(refMatch[1].trim(), taskId);
            });

            match = pattern.exec(xml);
        }

        return dataToTask;
    }

    function collectLaneRefs(xml) {
        const laneRefs = new Map();
        const pattern = /<(?:bpmn2?:)?lane\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:bpmn2?:)?lane>/gi;
        let match = pattern.exec(xml);

        while (match) {
            const refs = [...match[2].matchAll(/<(?:bpmn2?:)?flowNodeRef>([^<]+)<\/(?:bpmn2?:)?flowNodeRef>/gi)]
                .map((item) => item[1].trim())
                .filter(Boolean);
            laneRefs.set(match[1], refs);
            match = pattern.exec(xml);
        }

        return laneRefs;
    }

    function wrapSvgText(text, maxWidth, fontSize) {
        const value = String(text || '').trim();
        if (!value) return [];

        const approxChars = Math.max(8, Math.floor(maxWidth / Math.max(fontSize * 0.56, 1)));
        const words = value.split(/\s+/);
        const lines = [];
        let current = '';

        words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= approxChars || !current) {
                current = candidate;
                return;
            }
            lines.push(current);
            current = word;
        });

        if (current) {
            lines.push(current);
        }

        return lines.slice(0, 5);
    }

    function getNodeKind(type) {
        const normalized = String(type || '').toLowerCase();
        if (normalized === 'task') return 'task';
        if (normalized === 'callactivity') return 'reference';
        if (normalized === 'exclusivegateway') return 'gateway';
        if (normalized === 'dataobjectreference' || normalized === 'dataobject') return 'document';
        if (normalized === 'datastorereference') return 'database';
        if (normalized.endsWith('event')) return 'event';
        return 'task';
    }

    function buildLaneModels(laneShapes, laneRefs, nodeMap) {
        if (!laneShapes.length) {
            return [];
        }

        return laneShapes
            .map((shape) => {
                const refs = laneRefs.get(shape.id) || [];
                let minY = shape.y;
                let maxY = shape.y + shape.height;

                refs.forEach((refId) => {
                    const node = nodeMap.get(refId);
                    if (!node) return;
                    minY = Math.min(minY, node.y);
                    maxY = Math.max(maxY, node.y + node.height);
                });

                return {
                    id: shape.id,
                    name: shape.name || 'Зона ответственности',
                    x: shape.x,
                    y: minY,
                    width: shape.width,
                    height: Math.max(shape.height, maxY - minY)
                };
            })
            .sort((left, right) => left.y - right.y);
    }

    function buildBpmnPresentationModel(xml) {
        const elementMeta = collectElementMeta(xml);
        const sequenceFlows = collectSequenceFlows(xml);
        const shapeRecords = collectShapes(xml).map((shape) => {
            const meta = elementMeta.get(shape.id) || { type: 'task', name: shape.id };
            return {
                ...shape,
                type: meta.type,
                name: meta.name || shape.id,
                kind: getNodeKind(meta.type),
                calledElement: meta.calledElement || ''
            };
        });

        const laneShapes = shapeRecords.filter((shape) => String(shape.type || '').toLowerCase() === 'lane');
        const participantShapes = shapeRecords.filter((shape) => String(shape.type || '').toLowerCase() === 'participant');
        const rawNodes = shapeRecords.filter((shape) => !['lane', 'participant'].includes(String(shape.type || '').toLowerCase()));
        const dataAssociations = collectDataAssociations(xml);
        const attachedDocuments = new Map();
        const hiddenNodeIds = new Set();

        rawNodes.forEach((node) => {
            if (node.kind !== 'document') return;
            const taskId = dataAssociations.get(node.id);
            if (!taskId) return;

            const docs = attachedDocuments.get(taskId) || [];
            docs.push(node.name || 'Документ');
            attachedDocuments.set(taskId, docs);
            hiddenNodeIds.add(node.id);
        });

        const nodes = rawNodes
            .filter((node) => !hiddenNodeIds.has(node.id))
            .map((node) => ({
                ...node,
                attachedDocuments: attachedDocuments.get(node.id) || []
            }));

        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const laneRefs = collectLaneRefs(xml);
        const lanes = buildLaneModels(laneShapes, laneRefs, nodeMap);
        const edges = collectEdges(xml).map((edge) => {
            const flow = sequenceFlows.get(edge.id) || {};
            const sourceNode = nodeMap.get(flow.sourceRef);
            const targetNode = nodeMap.get(flow.targetRef);
            const points = edge.points.length >= 2
                ? edge.points
                : (sourceNode && targetNode
                    ? [
                        { x: sourceNode.x + sourceNode.width / 2, y: sourceNode.y + sourceNode.height / 2 },
                        { x: targetNode.x + targetNode.width / 2, y: targetNode.y + targetNode.height / 2 }
                    ]
                    : []);

            return {
                id: edge.id,
                name: flow.name || (elementMeta.get(edge.id)?.name || ''),
                sourceRef: flow.sourceRef || '',
                targetRef: flow.targetRef || '',
                points
            };
        });

        const metrics = {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity
        };

        nodes.forEach((node) => {
            metrics.minX = Math.min(metrics.minX, node.x);
            metrics.minY = Math.min(metrics.minY, node.y);
            metrics.maxX = Math.max(metrics.maxX, node.x + node.width);
            metrics.maxY = Math.max(metrics.maxY, node.y + node.height);
        });
        lanes.forEach((lane) => {
            metrics.minX = Math.min(metrics.minX, lane.x);
            metrics.minY = Math.min(metrics.minY, lane.y);
            metrics.maxX = Math.max(metrics.maxX, lane.x + lane.width);
            metrics.maxY = Math.max(metrics.maxY, lane.y + lane.height);
        });
        edges.forEach((edge) => {
            edge.points.forEach((point) => {
                metrics.minX = Math.min(metrics.minX, point.x);
                metrics.minY = Math.min(metrics.minY, point.y);
                metrics.maxX = Math.max(metrics.maxX, point.x);
                metrics.maxY = Math.max(metrics.maxY, point.y);
            });
        });
        participantShapes.forEach((shape) => {
            metrics.minX = Math.min(metrics.minX, shape.x);
            metrics.minY = Math.min(metrics.minY, shape.y);
            metrics.maxX = Math.max(metrics.maxX, shape.x + shape.width);
            metrics.maxY = Math.max(metrics.maxY, shape.y + shape.height);
        });

        if (!Number.isFinite(metrics.minX)) {
            metrics.minX = 0;
            metrics.minY = 0;
            metrics.maxX = 1200;
            metrics.maxY = 800;
        }

        const padding = {
            top: 96,
            right: lanes.length ? 210 : 120,
            bottom: 120,
            left: 96
        };

        return {
            nodes,
            edges,
            lanes,
            bounds: {
                minX: metrics.minX,
                minY: metrics.minY,
                maxX: metrics.maxX,
                maxY: metrics.maxY,
                width: (metrics.maxX - metrics.minX) + padding.left + padding.right,
                height: (metrics.maxY - metrics.minY) + padding.top + padding.bottom
            },
            viewBox: {
                x: metrics.minX - padding.left,
                y: metrics.minY - padding.top,
                width: (metrics.maxX - metrics.minX) + padding.left + padding.right,
                height: (metrics.maxY - metrics.minY) + padding.top + padding.bottom
            }
        };
    }

    function renderTextBlock(lines, x, y, className, lineHeight, anchor) {
        if (!lines.length) return '';
        const escapedClass = escapeXml(className || '');
        const position = anchor || 'middle';
        return `<text class="${escapedClass}" x="${x}" y="${y}" text-anchor="${position}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`;
    }

    function renderNode(node) {
        const x = node.x;
        const y = node.y;
        const width = node.width;
        const height = node.height;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const accessibleName = escapeXml(node.name || node.calledElement || node.id);
        const nodeAttributes = `data-node-id="${escapeXml(node.id)}" data-node-name="${accessibleName}" aria-label="${accessibleName}"`;

        if (node.kind === 'event') {
            const radius = Math.min(width, height) / 2;
            const isEndEvent = String(node.type || '').toLowerCase() === 'endevent';
            const inner = isEndEvent
                ? `<circle class="doc-node event-inner end-event-inner" cx="${centerX}" cy="${centerY}" r="${Math.max(radius - 4, radius * 0.8)}"></circle>`
                : '';
            const outerClass = isEndEvent ? 'event-outer end-event' : 'event-outer start-event';
            const textY = centerY + radius + 24;
            return `
                <g class="doc-node-group event" ${nodeAttributes}>
                    <circle class="doc-node ${outerClass}" cx="${centerX}" cy="${centerY}" r="${radius}"></circle>
                    ${inner}
                    ${renderTextBlock(wrapSvgText(node.name, 140, 14), centerX, textY, 'doc-label event-label', 16)}
                </g>
            `;
        }

        if (node.kind === 'gateway') {
            const points = [
                `${centerX},${y}`,
                `${x + width},${centerY}`,
                `${centerX},${y + height}`,
                `${x},${centerY}`
            ].join(' ');
            return `
                <g class="doc-node-group gateway" ${nodeAttributes}>
                    <polygon class="doc-node gateway-shape" points="${points}"></polygon>
                    ${renderTextBlock(wrapSvgText(node.name, width * 0.75, 14), centerX, centerY - 8, 'doc-label gateway-label', 16)}
                </g>
            `;
        }

        if (node.kind === 'reference') {
            return `
                <g class="doc-node-group reference" ${nodeAttributes}>
                    <rect class="doc-node reference-shape outer" x="${x}" y="${y}" width="${width}" height="${height}" rx="12" ry="12"></rect>
                    <rect class="doc-node reference-shape inner" x="${x + 4}" y="${y + 4}" width="${width - 8}" height="${height - 8}" rx="8" ry="8"></rect>
                    ${renderTextBlock(wrapSvgText(node.name || node.calledElement || 'Связанный процесс', width * 0.72, 14), centerX, centerY - 8, 'doc-label node-label', 16)}
                </g>
            `;
        }

        if (node.kind === 'database') {
            const ellipseHeight = Math.max(12, height * 0.22);
            const bottomY = y + height - ellipseHeight / 2;
            return `
                <g class="doc-node-group database" ${nodeAttributes}>
                    <ellipse class="doc-node database-cap" cx="${centerX}" cy="${y + ellipseHeight / 2}" rx="${width / 2}" ry="${ellipseHeight / 2}"></ellipse>
                    <path class="doc-node database-body" d="M ${x} ${y + ellipseHeight / 2} L ${x} ${bottomY} C ${x} ${bottomY + ellipseHeight / 2}, ${x + width} ${bottomY + ellipseHeight / 2}, ${x + width} ${bottomY} L ${x + width} ${y + ellipseHeight / 2}"></path>
                    <ellipse class="doc-node database-bottom" cx="${centerX}" cy="${bottomY}" rx="${width / 2}" ry="${ellipseHeight / 2}"></ellipse>
                    ${renderTextBlock(wrapSvgText(node.name, width * 0.72, 14), centerX, centerY - 8, 'doc-label node-label', 16)}
                </g>
            `;
        }

        if (node.kind === 'document') {
            const waveDepth = Math.max(10, height * 0.16);
            const path = [
                `M ${x} ${y}`,
                `L ${x + width} ${y}`,
                `L ${x + width} ${y + height - waveDepth}`,
                `C ${x + width * 0.78} ${y + height + waveDepth * 0.1}, ${x + width * 0.55} ${y + height - waveDepth * 1.1}, ${x + width * 0.32} ${y + height - waveDepth * 0.1}`,
                `C ${x + width * 0.2} ${y + height + waveDepth * 0.25}, ${x + width * 0.08} ${y + height - waveDepth * 0.8}, ${x} ${y + height - waveDepth}`,
                'Z'
            ].join(' ');

            return `
                <g class="doc-node-group document" ${nodeAttributes}>
                    <path class="doc-node document-shape" d="${path}"></path>
                    ${renderTextBlock(wrapSvgText(node.name, width * 0.75, 13), centerX, centerY - 8, 'doc-label node-label', 15)}
                </g>
            `;
        }

        if (node.attachedDocuments && node.attachedDocuments.length > 0) {
            const splitY = y + height * 0.58;
            const footerDepth = Math.max(8, height * 0.1);
            const footerPath = [
                `M ${x} ${splitY}`,
                `L ${x + width} ${splitY}`,
                `L ${x + width} ${y + height - footerDepth}`,
                `C ${x + width * 0.76} ${y + height + footerDepth * 0.1}, ${x + width * 0.54} ${y + height - footerDepth * 0.95}, ${x + width * 0.3} ${y + height - footerDepth * 0.1}`,
                `C ${x + width * 0.17} ${y + height + footerDepth * 0.18}, ${x + width * 0.05} ${y + height - footerDepth * 0.7}, ${x} ${y + height - footerDepth}`,
                'Z'
            ].join(' ');

            return `
                <g class="doc-node-group task composite" ${nodeAttributes}>
                    <rect class="doc-node task-shape" x="${x}" y="${y}" width="${width}" height="${height}" rx="12" ry="12"></rect>
                    <line class="doc-node composite-divider" x1="${x}" y1="${splitY}" x2="${x + width}" y2="${splitY}"></line>
                    <path class="doc-node document-footer" d="${footerPath}"></path>
                    ${renderTextBlock(wrapSvgText(node.name, width * 0.72, 14), centerX, y + 30, 'doc-label node-label', 16)}
                    ${renderTextBlock(wrapSvgText(node.attachedDocuments.join(', '), width * 0.72, 12), centerX, splitY + 22, 'doc-label document-label', 14)}
                </g>
            `;
        }

        return `
            <g class="doc-node-group task" ${nodeAttributes}>
                <rect class="doc-node task-shape" x="${x}" y="${y}" width="${width}" height="${height}" rx="12" ry="12"></rect>
                ${renderTextBlock(wrapSvgText(node.name, width * 0.72, 14), centerX, centerY - 8, 'doc-label node-label', 16)}
            </g>
        `;
    }

    function renderEdge(edge) {
        if (!edge.points || edge.points.length < 2) {
            return '';
        }

        const pointsAttr = edge.points.map((point) => `${point.x},${point.y}`).join(' ');
        const midIndex = Math.max(0, Math.floor((edge.points.length - 1) / 2));
        const anchor = edge.points[midIndex];
        const label = edge.name ? `
            <g class="doc-edge-label-group">
                <rect class="doc-edge-label-bg" x="${anchor.x - 28}" y="${anchor.y - 18}" width="56" height="24" rx="12" ry="12"></rect>
                <text class="doc-edge-label" x="${anchor.x}" y="${anchor.y - 2}" text-anchor="middle">${escapeXml(edge.name)}</text>
            </g>` : '';

        return `
            <g class="doc-edge-group">
                <polyline class="doc-edge-line" points="${pointsAttr}" marker-end="url(#doc-arrow)"></polyline>
                ${label}
            </g>
        `;
    }

    function renderDocStyleSvg(model) {
        const laneArrowX = model.viewBox.x + model.viewBox.width - 48;
        const laneTopY = model.viewBox.y + 24;
        const laneBottomY = model.viewBox.y + model.viewBox.height - 32;

        const laneMarkup = model.lanes.map((lane, index) => {
            const boundaryY = lane.y + lane.height;
            const showBoundary = index < model.lanes.length - 1;
            return `
                <g class="doc-lane-group">
                    <rect class="doc-lane-bg ${index % 2 === 0 ? 'even' : 'odd'}" x="${model.viewBox.x + 20}" y="${lane.y}" width="${model.viewBox.width - 96}" height="${lane.height}" rx="22" ry="22"></rect>
                    ${showBoundary ? `<line class="doc-lane-boundary" x1="${model.viewBox.x + 20}" y1="${boundaryY}" x2="${model.viewBox.x + model.viewBox.width - 96}" y2="${boundaryY}"></line>` : ''}
                    <text class="doc-lane-label" x="${laneArrowX - 20}" y="${lane.y + lane.height / 2}" text-anchor="end">${escapeXml(lane.name)}</text>
                </g>
            `;
        }).join('');

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${model.viewBox.width}" height="${model.viewBox.height}" viewBox="${model.viewBox.x} ${model.viewBox.y} ${model.viewBox.width} ${model.viewBox.height}" role="img" aria-label="Документ-стиль визуализации BPMN">
                <defs>
                    <marker id="doc-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                        <path d="M 0 0 L 12 6 L 0 12 z" fill="#6a7482"></path>
                    </marker>
                    <marker id="lane-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
                        <path d="M 0 0 L 12 6 L 0 12 z" fill="#8fa2b2"></path>
                    </marker>
                    <style>
                        .doc-root { font-family: "Manrope", "Segoe UI", sans-serif; }
                        .doc-node { stroke: #5f6b7a; stroke-width: 1.35; }
                        .task-shape { fill: #eefbee; stroke: #2e7d32; stroke-width: 2; }
                        .reference-shape.outer { fill: #ffffff; stroke: #1976d2; stroke-width: 2; }
                        .reference-shape.inner { fill: #e3f2fd; stroke: #1976d2; stroke-width: 1.5; }
                        .gateway-shape { fill: #f3e5f5; stroke: #8e24aa; stroke-width: 2; }
                        .document-shape, .document-footer { fill: #fbfbfd; }
                        .database-cap, .database-body, .database-bottom { fill: #ffffff; stroke: #0288d1; stroke-width: 1.5; }
                        .start-event { fill: #fffde7; stroke: #fbc02d; stroke-width: 3; }
                        .end-event { fill: #ffebee; stroke: #d32f2f; stroke-width: 2; }
                        .end-event-inner { fill: #ffebee; stroke: #d32f2f; stroke-width: 4; }
                        .composite-divider { stroke: #aeb7c2; stroke-width: 1; stroke-dasharray: 5 4; }
                        .doc-label { fill: #2f3a46; font-size: 13px; font-weight: 600; }
                        .document-label { font-size: 11px; font-weight: 500; fill: #556170; }
                        .gateway-label { font-size: 12px; }
                        .event-label { font-size: 12px; font-weight: 600; }
                        .doc-edge-line { fill: none; stroke: #6a7482; stroke-width: 1.6; stroke-linecap: square; stroke-linejoin: miter; }
                        .doc-edge-label-bg { fill: #ffffff; stroke: #c9d1da; stroke-width: 0.8; }
                        .doc-edge-label { fill: #44505e; font-size: 11px; font-weight: 600; dominant-baseline: middle; }
                        .doc-lane-bg { fill: rgba(255, 255, 255, 0.92); stroke: #d7dee6; stroke-width: 1; }
                        .doc-lane-bg.odd { fill: rgba(250, 251, 252, 0.96); }
                        .doc-lane-boundary { stroke: #9aa4b2; stroke-width: 1; stroke-dasharray: 6 6; }
                        .doc-lane-label { fill: #6c7886; font-size: 12px; font-weight: 600; dominant-baseline: middle; }
                        .responsibility-axis { stroke: #8fa2b2; stroke-width: 1.2; stroke-dasharray: 7 6; }
                        .responsibility-label { fill: #6f7d8b; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
                    </style>
                </defs>
                <g class="doc-root">
                    <rect x="${model.viewBox.x}" y="${model.viewBox.y}" width="${model.viewBox.width}" height="${model.viewBox.height}" fill="#ffffff"></rect>
                    ${laneMarkup}
                    ${model.lanes.length ? `
                        <g class="doc-responsibility">
                            <line class="responsibility-axis" x1="${laneArrowX}" y1="${laneTopY}" x2="${laneArrowX}" y2="${laneBottomY}" marker-end="url(#lane-arrow)"></line>
                            <text class="responsibility-label" transform="rotate(-90 ${laneArrowX + 22} ${(laneTopY + laneBottomY) / 2})" x="${laneArrowX + 22}" y="${(laneTopY + laneBottomY) / 2}" text-anchor="middle">Зона ответственности</text>
                        </g>` : ''}
                    <g class="doc-edges">${model.edges.map(renderEdge).join('')}</g>
                    <g class="doc-nodes">${model.nodes.map(renderNode).join('')}</g>
                </g>
            </svg>
        `.trim();
    }

    const api = {
        buildBpmnPresentationModel,
        renderDocStyleSvg,
        escapeXml
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    globalScope.BpmnPresentation = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
