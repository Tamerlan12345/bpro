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

    function splitToken(token, maxChars) {
        const value = String(token || '');
        if (!value) return [];
        if (value.length <= maxChars) return [value];

        const chunks = [];
        let cursor = value;
        const sliceLength = Math.max(1, maxChars - 1);

        while (cursor.length > maxChars) {
            chunks.push(`${cursor.slice(0, sliceLength)}-`);
            cursor = cursor.slice(sliceLength);
        }

        if (cursor) {
            chunks.push(cursor);
        }

        return chunks;
    }

    function wrapSvgText(text, maxWidth, fontSize, maxLines) {
        const value = String(text || '').trim();
        if (!value) return [];

        const approxChars = Math.max(8, Math.floor(maxWidth / Math.max(fontSize * 0.62, 1)));
        const words = value
            .split(/\s+/)
            .flatMap((word) => splitToken(word, approxChars));
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

        const limit = Math.max(1, maxLines || 5);
        if (lines.length <= limit) {
            return lines;
        }

        const visible = lines.slice(0, limit);
        visible[limit - 1] = `${visible[limit - 1].replace(/[-\s]+$/g, '')}...`;
        return visible;
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

    function createMetrics() {
        return {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity
        };
    }

    function includePoint(metrics, x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }
        metrics.minX = Math.min(metrics.minX, x);
        metrics.minY = Math.min(metrics.minY, y);
        metrics.maxX = Math.max(metrics.maxX, x);
        metrics.maxY = Math.max(metrics.maxY, y);
    }

    function includeRect(metrics, x, y, width, height) {
        if (![x, y, width, height].every(Number.isFinite)) {
            return;
        }
        includePoint(metrics, x, y);
        includePoint(metrics, x + width, y + height);
    }

    function getEventLabelPadding(node) {
        if (node.kind !== 'event') {
            return null;
        }

        return {
            x: node.x - 12,
            y: node.y - 12,
            width: node.width + 24,
            height: node.height + 52
        };
    }

    function estimateEdgeLabelBounds(edge) {
        if (!edge.name || !Array.isArray(edge.points) || edge.points.length < 2) {
            return null;
        }

        let bestSegment = null;
        for (let index = 0; index < edge.points.length - 1; index += 1) {
            const start = edge.points[index];
            const end = edge.points[index + 1];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.abs(dx) + Math.abs(dy);

            if (!bestSegment || length > bestSegment.length) {
                bestSegment = { start, end, dx, dy, length };
            }
        }

        if (!bestSegment) {
            return null;
        }

        const width = Math.max(42, Math.min(120, 18 + (String(edge.name).length * 7)));
        const height = 20;
        const anchorX = bestSegment.start.x + (bestSegment.dx / 2);
        const anchorY = bestSegment.start.y + (bestSegment.dy / 2);

        if (Math.abs(bestSegment.dx) >= Math.abs(bestSegment.dy)) {
            return {
                x: anchorX - (width / 2),
                y: anchorY - 24,
                width,
                height
            };
        }

        return {
            x: anchorX + 12,
            y: anchorY - (height / 2),
            width,
            height
        };
    }

    function buildPresentationMetrics(nodes, edges, lanes, participantShapes) {
        const metrics = createMetrics();

        nodes.forEach((node) => {
            includeRect(metrics, node.x, node.y, node.width, node.height);

            const eventLabelPadding = getEventLabelPadding(node);
            if (eventLabelPadding) {
                includeRect(metrics, eventLabelPadding.x, eventLabelPadding.y, eventLabelPadding.width, eventLabelPadding.height);
            }
        });

        lanes.forEach((lane) => {
            includeRect(metrics, lane.x, lane.y, lane.width, lane.height);
        });

        participantShapes.forEach((shape) => {
            includeRect(metrics, shape.x, shape.y, shape.width, shape.height);
        });

        edges.forEach((edge) => {
            edge.points.forEach((point) => includePoint(metrics, point.x, point.y));
            if (edge.labelBounds) {
                includeRect(metrics, edge.labelBounds.x, edge.labelBounds.y, edge.labelBounds.width, edge.labelBounds.height);
            }
        });

        if (!Number.isFinite(metrics.minX)) {
            return {
                metrics: {
                    minX: 0,
                    minY: 0,
                    maxX: 1200,
                    maxY: 800
                },
                padding: {
                    top: 80,
                    right: 80,
                    bottom: 80,
                    left: 80
                }
            };
        }

        const spanX = Math.max(1, metrics.maxX - metrics.minX);
        const spanY = Math.max(1, metrics.maxY - metrics.minY);
        const baseHorizontalPadding = Math.max(56, Math.round(spanX * 0.06));
        const baseVerticalPadding = Math.max(56, Math.round(spanY * 0.08));
        const laneRightPadding = lanes.length ? 180 : 72;

        return {
            metrics,
            padding: {
                top: baseVerticalPadding,
                right: Math.max(baseHorizontalPadding, laneRightPadding),
                bottom: baseVerticalPadding,
                left: baseHorizontalPadding
            }
        };
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

            const nextEdge = {
                id: edge.id,
                name: flow.name || (elementMeta.get(edge.id)?.name || ''),
                sourceRef: flow.sourceRef || '',
                targetRef: flow.targetRef || '',
                points
            };

            return {
                ...nextEdge,
                labelBounds: estimateEdgeLabelBounds(nextEdge)
            };
        });
        const { metrics, padding } = buildPresentationMetrics(nodes, edges, lanes, participantShapes);

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

    function getCenteredTextY(centerY, lineHeight, lineCount) {
        return centerY - (((Math.max(lineCount, 1) - 1) * lineHeight) / 2);
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
            const lines = wrapSvgText(node.name, 140, 13, 3);
            const textY = centerY + radius + 24;
            return `
                <g class="doc-node-group event" ${nodeAttributes}>
                    <circle class="doc-node ${outerClass}" cx="${centerX}" cy="${centerY}" r="${radius}"></circle>
                    ${inner}
                    ${renderTextBlock(lines, centerX, textY, 'doc-label event-label', 15)}
                </g>
            `;
        }

        if (node.kind === 'gateway') {
            const lines = wrapSvgText(node.name, width * 0.68, 13, 3);
            const points = [
                `${centerX},${y}`,
                `${x + width},${centerY}`,
                `${centerX},${y + height}`,
                `${x},${centerY}`
            ].join(' ');
            return `
                <g class="doc-node-group gateway" ${nodeAttributes}>
                    <polygon class="doc-node gateway-shape" points="${points}"></polygon>
                    ${renderTextBlock(lines, centerX, getCenteredTextY(centerY, 15, lines.length), 'doc-label gateway-label', 15)}
                </g>
            `;
        }

        if (node.kind === 'reference') {
            const lines = wrapSvgText(node.name || node.calledElement || 'Linked process', width * 0.68, 13, 4);
            return `
                <g class="doc-node-group reference" ${nodeAttributes}>
                    <rect class="doc-node reference-shape outer" x="${x}" y="${y}" width="${width}" height="${height}" rx="8" ry="8"></rect>
                    <rect class="doc-node reference-shape inner" x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${height - 10}" rx="6" ry="6"></rect>
                    ${renderTextBlock(lines, centerX, getCenteredTextY(centerY, 15, lines.length), 'doc-label node-label', 15)}
                </g>
            `;
        }

        if (node.kind === 'database') {
            const ellipseHeight = Math.max(12, height * 0.22);
            const bottomY = y + height - ellipseHeight / 2;
            const lines = wrapSvgText(node.name, width * 0.66, 13, 4);
            return `
                <g class="doc-node-group database" ${nodeAttributes}>
                    <ellipse class="doc-node database-cap" cx="${centerX}" cy="${y + ellipseHeight / 2}" rx="${width / 2}" ry="${ellipseHeight / 2}"></ellipse>
                    <path class="doc-node database-body" d="M ${x} ${y + ellipseHeight / 2} L ${x} ${bottomY} C ${x} ${bottomY + ellipseHeight / 2}, ${x + width} ${bottomY + ellipseHeight / 2}, ${x + width} ${bottomY} L ${x + width} ${y + ellipseHeight / 2}"></path>
                    <ellipse class="doc-node database-bottom" cx="${centerX}" cy="${bottomY}" rx="${width / 2}" ry="${ellipseHeight / 2}"></ellipse>
                    ${renderTextBlock(lines, centerX, getCenteredTextY(centerY, 15, lines.length), 'doc-label node-label', 15)}
                </g>
            `;
        }

        if (node.kind === 'document') {
            const waveDepth = Math.max(10, height * 0.16);
            const lines = wrapSvgText(node.name, width * 0.72, 13, 4);
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
                    ${renderTextBlock(lines, centerX, getCenteredTextY(centerY, 15, lines.length), 'doc-label node-label', 15)}
                </g>
            `;
        }

        if (node.attachedDocuments && node.attachedDocuments.length > 0) {
            const splitY = y + Math.max(42, Math.min(height * 0.62, height - 28));
            const footerDepth = Math.max(8, height * 0.1);
            const headerLines = wrapSvgText(node.name, width * 0.7, 13, 3);
            const footerLines = wrapSvgText(node.attachedDocuments.join(', '), width * 0.7, 11, 3);
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
                    <rect class="doc-node task-shape" x="${x}" y="${y}" width="${width}" height="${splitY - y}" rx="8" ry="8"></rect>
                    <line class="doc-node composite-divider" x1="${x}" y1="${splitY}" x2="${x + width}" y2="${splitY}"></line>
                    <path class="doc-node document-footer" d="${footerPath}"></path>
                    ${renderTextBlock(headerLines, centerX, getCenteredTextY(y + ((splitY - y) / 2), 15, headerLines.length), 'doc-label node-label', 15)}
                    ${renderTextBlock(footerLines, centerX, getCenteredTextY(splitY + ((height - (splitY - y)) / 2), 13, footerLines.length), 'doc-label document-label', 13)}
                </g>
            `;
        }

        const lines = wrapSvgText(node.name, width * 0.7, 13, 5);
        return `
            <g class="doc-node-group task" ${nodeAttributes}>
                <rect class="doc-node task-shape" x="${x}" y="${y}" width="${width}" height="${height}" rx="8" ry="8"></rect>
                ${renderTextBlock(lines, centerX, getCenteredTextY(centerY, 15, lines.length), 'doc-label node-label', 15)}
            </g>
        `;
    }

    function renderEdge(edge) {
        if (!edge.points || edge.points.length < 2) {
            return '';
        }

        const pointsAttr = edge.points.map((point) => `${point.x},${point.y}`).join(' ');
        const labelBounds = edge.labelBounds || estimateEdgeLabelBounds(edge);
        const label = edge.name && labelBounds ? `
            <g class="doc-edge-label-group">
                <rect class="doc-edge-label-bg" x="${labelBounds.x}" y="${labelBounds.y}" width="${labelBounds.width}" height="${labelBounds.height}"></rect>
                <text class="doc-edge-label" x="${labelBounds.x + (labelBounds.width / 2)}" y="${labelBounds.y + (labelBounds.height / 2)}" text-anchor="middle">${escapeXml(edge.name)}</text>
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
                    <rect class="doc-lane-bg ${index % 2 === 0 ? 'even' : 'odd'}" x="${model.viewBox.x + 20}" y="${lane.y}" width="${model.viewBox.width - 96}" height="${lane.height}"></rect>
                    ${showBoundary ? `<line class="doc-lane-boundary" x1="${model.viewBox.x + 20}" y1="${boundaryY}" x2="${model.viewBox.x + model.viewBox.width - 96}" y2="${boundaryY}"></line>` : ''}
                    <text class="doc-lane-label" x="${laneArrowX - 20}" y="${lane.y + lane.height / 2}" text-anchor="end">${escapeXml(lane.name)}</text>
                </g>
            `;
        }).join('');

        const pad = 40;
        const vbX = Math.round(model.viewBox.x - pad);
        const vbY = Math.round(model.viewBox.y - pad);
        const vbW = Math.round(model.viewBox.width + pad * 2);
        const vbH = Math.round(model.viewBox.height + pad * 2);

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Документ-стиль визуализации BPMN">
                <defs>
                    <marker id="doc-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                        <path d="M 0 0 L 12 6 L 0 12 z" fill="#64748b"></path>
                    </marker>
                    <marker id="lane-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
                        <path d="M 0 0 L 12 6 L 0 12 z" fill="#94a3b8"></path>
                    </marker>
                    <style>
                        .doc-root { font-family: "Segoe UI", Arial, sans-serif; }
                        .doc-nodes > g { cursor: pointer; pointer-events: bounding-box; transition: opacity 0.2s; }
                        .doc-nodes > g:hover { opacity: 0.85; }
                        .doc-node { fill: #ffffff; stroke: #000000; stroke-width: 1.4; }
                        .task-shape { fill: #f8fafc; stroke: #334155; stroke-width: 1.8; rx: 8; ry: 8; }
                        .reference-shape.outer { fill: #f8fafc; stroke: #334155; stroke-width: 1.8; rx: 8; ry: 8; }
                        .reference-shape.inner { fill: none; stroke: #334155; stroke-width: 1.2; rx: 8; ry: 8; }
                        .gateway-shape { fill: #fffbeb; stroke: #d97706; stroke-width: 1.8; }
                        .document-shape, .document-footer { fill: #f8fafc; stroke: #334155; stroke-width: 1.4; }
                        .database-cap, .database-body, .database-bottom { fill: #f8fafc; stroke: #334155; stroke-width: 1.4; }
                        .start-event { fill: #ecfdf5; stroke: #10b981; stroke-width: 2.5; }
                        .end-event { fill: #fef2f2; stroke: #ef4444; stroke-width: 2.5; }
                        .end-event-inner { fill: none; stroke: #ef4444; stroke-width: 2; }
                        .composite-divider { stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 4 3; }
                        .doc-label { fill: #1e293b; font-size: 13px; font-weight: 500; pointer-events: none; }
                        .document-label { font-size: 11px; font-weight: 500; fill: #475569; }
                        .gateway-label { font-size: 11px; fill: #1e293b; }
                        .event-label { font-size: 11px; font-weight: 600; fill: #1e293b; }
                        .doc-edge-line { fill: none; stroke: #64748b; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
                        .doc-edge-label-bg { fill: #ffffff; stroke: #000000; stroke-width: 1; }
                        .doc-edge-label { fill: #000000; font-size: 11px; font-weight: 600; dominant-baseline: middle; }
                        .doc-lane-bg { fill: #ffffff; stroke: #000000; stroke-width: 1; }
                        .doc-lane-bg.odd { fill: #ffffff; }
                        .doc-lane-boundary { stroke: #000000; stroke-width: 1; stroke-dasharray: 6 4; }
                        .doc-lane-label { fill: #000000; font-size: 12px; font-weight: 600; dominant-baseline: middle; }
                        .responsibility-axis { stroke: #000000; stroke-width: 1.1; stroke-dasharray: 7 5; }
                        .responsibility-label { fill: #000000; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
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
