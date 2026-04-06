(function (globalScope) {
    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function parseAttributes(fragment) {
        const attributes = {};
        if (!fragment) return attributes;

        const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g;
        let match = attributePattern.exec(fragment);
        while (match) {
            attributes[match[1]] = match[2];
            match = attributePattern.exec(fragment);
        }

        return attributes;
    }

    function collectShapes(xml) {
        const shapes = [];
        const shapePattern = /<bpmndi:BPMNShape\b([^>]*)>([\s\S]*?)<\/bpmndi:BPMNShape>/gi;
        let match = shapePattern.exec(xml);

        while (match) {
            const shapeAttrs = parseAttributes(match[1]);
            const bpmnElement = shapeAttrs.bpmnElement;
            const boundsMatch = match[2].match(/<dc:Bounds\b([^>]*)\/?>/i);

            if (bpmnElement && boundsMatch) {
                const boundsAttrs = parseAttributes(boundsMatch[1]);
                const x = Number.parseFloat(boundsAttrs.x);
                const y = Number.parseFloat(boundsAttrs.y);
                const width = Number.parseFloat(boundsAttrs.width);
                const height = Number.parseFloat(boundsAttrs.height);

                if ([x, y, width, height].every(Number.isFinite)) {
                    shapes.push({
                        bpmnElement,
                        x,
                        y,
                        width,
                        height
                    });
                }
            }

            match = shapePattern.exec(xml);
        }

        return shapes;
    }

    function collectFlows(xml) {
        const flows = [];
        // Support bpmn:, bpmn2:, and no-prefix sequenceFlow
        const flowPattern = /<(?:bpmn2?:)?sequenceFlow\b([^>]*)\/?>/gi;
        let match = flowPattern.exec(xml);

        while (match) {
            const attrs = parseAttributes(match[1]);
            if (attrs.id && attrs.sourceRef && attrs.targetRef) {
                flows.push({
                    id: attrs.id,
                    sourceRef: attrs.sourceRef,
                    targetRef: attrs.targetRef
                });
            }
            match = flowPattern.exec(xml);
        }

        return flows;
    }

    function collectElementTypes(xml) {
        const types = new Map();
        // Support bpmn:, bpmn2:, and no-prefix elements
        const elementPattern = /<(?:bpmn2?:)?([A-Za-z0-9_]+)\b[^>]*\bid="([^"]+)"/gi;
        let match = elementPattern.exec(xml);

        while (match) {
            const tagName = match[1].toLowerCase();
            // Skip container tags that are not visual elements
            if (tagName !== 'definitions' && tagName !== 'process') {
                types.set(match[2], match[1]);
            }
            match = elementPattern.exec(xml);
        }

        return types;
    }

    function replaceShapeBounds(xml, bpmnElement, nextBounds) {
        const shapePattern = new RegExp(
            `(<bpmndi:BPMNShape\\b[^>]*bpmnElement="${bpmnElement}"[^>]*>[\\s\\S]*?<dc:Bounds\\b)([^>]*?)(?:\\/?>)([\\s\\S]*?<\\/bpmndi:BPMNShape>)`,
            'i'
        );

        return xml.replace(shapePattern, function (_match, prefix, _attrs, suffix) {
            const attrs = [
                `x="${nextBounds.x.toFixed(1)}"`,
                `y="${nextBounds.y.toFixed(1)}"`,
                `width="${nextBounds.width.toFixed(1)}"`,
                `height="${nextBounds.height.toFixed(1)}"`
            ].join(' ');
            return `${prefix} ${attrs} />${suffix}`;
        });
    }

    function replaceEdgeWaypoints(xml, flowId, waypoints) {
        const edgePattern = new RegExp(
            `(<bpmndi:BPMNEdge\\b[^>]*bpmnElement="${flowId}"[^>]*>)([\\s\\S]*?)(<\\/bpmndi:BPMNEdge>)`,
            'i'
        );

        return xml.replace(edgePattern, function (_match, openTag, innerContent, closeTag) {
            const remainingContent = innerContent.replace(/<di:waypoint\b[^>]*\/?>/gi, '').trim();
            const waypointMarkup = waypoints
                .map((point) => `        <di:waypoint x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" />`)
                .join('\n');
            const nextInner = remainingContent ? `${waypointMarkup}\n${remainingContent}` : waypointMarkup;
            return `${openTag}\n${nextInner}\n      ${closeTag}`;
        });
    }

    function buildLinearOrder(shapes, flows) {
        const shapeMap = new Map(shapes.map((shape) => [shape.bpmnElement, shape]));
        const outgoing = new Map();
        const indegree = new Map();

        flows.forEach((flow) => {
            if (!shapeMap.has(flow.sourceRef) || !shapeMap.has(flow.targetRef)) {
                return;
            }

            if (!outgoing.has(flow.sourceRef)) {
                outgoing.set(flow.sourceRef, []);
            }
            outgoing.get(flow.sourceRef).push(flow.targetRef);
            indegree.set(flow.targetRef, (indegree.get(flow.targetRef) || 0) + 1);
        });

        const preferredStarts = shapes
            .filter((shape) => !indegree.has(shape.bpmnElement))
            .sort((left, right) => left.y - right.y || left.x - right.x);

        const ordered = [];
        const visited = new Set();

        function walk(nodeId) {
            if (visited.has(nodeId) || !shapeMap.has(nodeId)) return;
            visited.add(nodeId);
            ordered.push(shapeMap.get(nodeId));

            const targets = outgoing.get(nodeId) || [];
            targets.forEach(walk);
        }

        preferredStarts.forEach((shape) => walk(shape.bpmnElement));

        shapes
            .slice()
            .sort((left, right) => left.y - right.y || left.x - right.x)
            .forEach((shape) => walk(shape.bpmnElement));

        return ordered;
    }

    function collectExclusiveGatewayIds(elementTypes) {
        const exclusiveGatewayIds = new Set();

        elementTypes.forEach((tagName, elementId) => {
            if (String(tagName).toLowerCase().includes('exclusivegateway')) {
                exclusiveGatewayIds.add(elementId);
            }
        });

        return exclusiveGatewayIds;
    }

    function hasNonLinearTopology(elementTypes, flows) {
        const outgoingCounts = new Map();
        const incomingCounts = new Map();

        for (const tagName of elementTypes.values()) {
            if (String(tagName).toLowerCase().includes('gateway')) {
                return true;
            }
        }

        flows.forEach((flow) => {
            outgoingCounts.set(flow.sourceRef, (outgoingCounts.get(flow.sourceRef) || 0) + 1);
            incomingCounts.set(flow.targetRef, (incomingCounts.get(flow.targetRef) || 0) + 1);
        });

        for (const count of outgoingCounts.values()) {
            if (count > 1) {
                return true;
            }
        }

        for (const count of incomingCounts.values()) {
            if (count > 1) {
                return true;
            }
        }

        return false;
    }

    function sanitizeConditionFlows(xml, flows, elementTypes) {
        if (typeof xml !== 'string') {
            return { xml, sanitizedFlowIds: new Set() };
        }

        const exclusiveGatewayIds = collectExclusiveGatewayIds(elementTypes);
        const sanitizedFlowIds = new Set();
        let sanitizedXml = xml;

        flows.forEach((flow) => {
            if (exclusiveGatewayIds.has(flow.sourceRef)) {
                return;
            }

            const flowIdPattern = escapeRegExp(flow.id);
            const fullTagPattern = new RegExp(
                `(<((?:bpmn2?:)?sequenceFlow)\\b[^>]*\\bid="${flowIdPattern}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
                'i'
            );
            const selfClosingPattern = new RegExp(
                `(<((?:bpmn2?:)?sequenceFlow)\\b[^>]*\\bid="${flowIdPattern}"[^>]*?)(\\s*\\/>)`,
                'i'
            );

            const cleanOpenTag = (openTag) => {
                let didSanitize = false;
                const nextOpenTag = openTag.replace(/\sname="([^"]*)"/gi, (match, rawValue) => {
                    const value = String(rawValue).trim().toLowerCase();
                    if (value === 'да' || value === 'нет' || value === 'yes' || value === 'no') {
                        didSanitize = true;
                        return '';
                    }
                    return match;
                });

                return { nextOpenTag, didSanitize };
            };

            sanitizedXml = sanitizedXml.replace(fullTagPattern, function (_match, openTag, tagName, innerContent, closingTag) {
                const { nextOpenTag, didSanitize } = cleanOpenTag(openTag);
                const nextInnerContent = innerContent.replace(
                    /<(?:bpmn2?:)?conditionExpression\b[^>]*>[\s\S]*?<\/(?:bpmn2?:)?conditionExpression>/gi,
                    ''
                );
                const removedConditionExpression = nextInnerContent !== innerContent;

                if (didSanitize || removedConditionExpression) {
                    sanitizedFlowIds.add(flow.id);
                }

                return `${nextOpenTag}${nextInnerContent}${closingTag}`;
            });

            sanitizedXml = sanitizedXml.replace(selfClosingPattern, function (_match, openTag, _tagName, suffix) {
                const { nextOpenTag, didSanitize } = cleanOpenTag(openTag);
                if (didSanitize) {
                    sanitizedFlowIds.add(flow.id);
                }
                return `${nextOpenTag}${suffix}`;
            });
        });

        sanitizedFlowIds.forEach((flowId) => {
            const flowIdPattern = escapeRegExp(flowId);
            const edgePattern = new RegExp(
                `(<bpmndi:BPMNEdge\\b[^>]*bpmnElement="${flowIdPattern}"[^>]*>)([\\s\\S]*?)(<\\/bpmndi:BPMNEdge>)`,
                'gi'
            );

            sanitizedXml = sanitizedXml.replace(edgePattern, function (_match, openTag, innerContent, closeTag) {
                const nextInnerContent = innerContent.replace(/<bpmndi:BPMNLabel\b[\s\S]*?<\/bpmndi:BPMNLabel>/gi, '').trim();
                if (!nextInnerContent) {
                    return `${openTag}${closeTag}`;
                }
                return `${openTag}\n${nextInnerContent}\n      ${closeTag}`;
            });
        });

        return {
            xml: sanitizedXml,
            sanitizedFlowIds
        };
    }

    function normalizeBpmnVerticalLayout(xml) {
        if (typeof xml !== 'string' || !xml.includes('<bpmndi:BPMNShape')) {
            return xml;
        }
        // Check for sequenceFlow with any namespace prefix (bpmn:, bpmn2:, or none)
        if (!/<(?:bpmn2?:)?sequenceFlow\b/i.test(xml)) {
            return xml;
        }

        const shapes = collectShapes(xml);
        const flows = collectFlows(xml);
        const elementTypes = collectElementTypes(xml);
        if (shapes.length < 2 || flows.length === 0) {
            return xml;
        }

        const sanitizedResult = sanitizeConditionFlows(xml, flows, elementTypes);
        const sanitizedXml = sanitizedResult.xml;

        if (hasNonLinearTopology(elementTypes, flows)) {
            return sanitizedXml;
        }

        const orderedShapes = buildLinearOrder(shapes, flows);
        if (orderedShapes.length < 2) {
            return sanitizedXml;
        }

        const averageCenterX = orderedShapes.reduce((sum, shape) => sum + shape.x + (shape.width / 2), 0) / orderedShapes.length;
        const centerX = Math.max(averageCenterX, 520);
        const topMargin = 64;
        const verticalGap = 100;
        const nextShapeMap = new Map();

        let currentY = topMargin;
        orderedShapes.forEach((shape) => {
            const elementType = (elementTypes.get(shape.bpmnElement) || '').toLowerCase();
            const isTask = elementType.includes('task');
            const isGateway = elementType.includes('gateway');
            const isEvent = elementType.includes('event');

            const nextWidth = isTask ? Math.max(shape.width, 220) : (isGateway ? Math.max(shape.width, 72) : shape.width);
            const nextHeight = isTask ? Math.max(shape.height, 90) : (isEvent ? Math.max(shape.height, 36) : shape.height);

            const nextShape = {
                x: centerX - (nextWidth / 2),
                y: currentY,
                width: nextWidth,
                height: nextHeight
            };
            nextShapeMap.set(shape.bpmnElement, nextShape);
            currentY += nextHeight + verticalGap;
        });

        let nextXml = sanitizedXml;
        orderedShapes.forEach((shape) => {
            nextXml = replaceShapeBounds(nextXml, shape.bpmnElement, nextShapeMap.get(shape.bpmnElement));
        });

        flows.forEach((flow) => {
            const source = nextShapeMap.get(flow.sourceRef);
            const target = nextShapeMap.get(flow.targetRef);
            if (!source || !target) return;

            const sourceCenterX = source.x + (source.width / 2);
            const targetCenterX = target.x + (target.width / 2);
            nextXml = replaceEdgeWaypoints(nextXml, flow.id, [
                { x: sourceCenterX, y: source.y + source.height },
                { x: targetCenterX, y: target.y }
            ]);
        });

        return nextXml;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { normalizeBpmnVerticalLayout };
    }

    globalScope.normalizeBpmnVerticalLayout = normalizeBpmnVerticalLayout;
})(typeof globalThis !== 'undefined' ? globalThis : window);
