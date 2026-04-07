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
                    name: attrs.name || '',
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

    function classifyShapes(shapes, elementTypes) {
        var containerTypeNames = ['participant', 'lane', 'laneset'];
        var dataTypeNames = ['dataobjectreference', 'dataobject', 'datastorereference'];
        var flowShapes = [];
        var containerShapes = [];
        var dataShapes = [];

        shapes.forEach(function (shape) {
            var typeName = (elementTypes.get(shape.bpmnElement) || '').toLowerCase();
            var isContainer = containerTypeNames.indexOf(typeName) !== -1;
            var isData = dataTypeNames.indexOf(typeName) !== -1;
            if (isContainer) {
                containerShapes.push(shape);
            } else if (isData) {
                dataShapes.push(shape);
            } else {
                flowShapes.push(shape);
            }
        });

        return { flowShapes: flowShapes, containerShapes: containerShapes, dataShapes: dataShapes };
    }

    function collectLaneFlowRefs(xml) {
        var laneRefs = new Map();
        var lanePattern = /<(?:bpmn2?:)?lane\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:bpmn2?:)?lane>/gi;
        var match;
        while ((match = lanePattern.exec(xml)) !== null) {
            var laneId = match[1];
            var laneBody = match[2];
            var refs = [];
            var refPattern = /<(?:bpmn2?:)?flowNodeRef>([^<]+)<\/(?:bpmn2?:)?flowNodeRef>/gi;
            var refMatch;
            while ((refMatch = refPattern.exec(laneBody)) !== null) {
                refs.push(refMatch[1].trim());
            }
            if (refs.length > 0) {
                laneRefs.set(laneId, refs);
            }
        }
        return laneRefs;
    }

    function collectDataAssociations(xml) {
        var dataToTask = new Map();
        var taskPattern = /<(?:bpmn2?:)?(?:task|callActivity)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:bpmn2?:)?(?:task|callActivity)>/gi;
        var match;
        while ((match = taskPattern.exec(xml)) !== null) {
            var taskId = match[1];
            var taskBody = match[2];
            var outputPattern = /<(?:bpmn2?:)?targetRef>([^<]+)<\/(?:bpmn2?:)?targetRef>/gi;
            var outMatch;
            while ((outMatch = outputPattern.exec(taskBody)) !== null) {
                dataToTask.set(outMatch[1].trim(), taskId);
            }
            var inputPattern = /<(?:bpmn2?:)?sourceRef>([^<]+)<\/(?:bpmn2?:)?sourceRef>/gi;
            var inMatch;
            while ((inMatch = inputPattern.exec(taskBody)) !== null) {
                dataToTask.set(inMatch[1].trim(), taskId);
            }
        }
        return dataToTask;
    }

    function positionDataShapes(dataShapes, nextShapeMap, dataToTask) {
        var dataShapeMap = new Map();
        var sideOffset = 280;
        dataShapes.forEach(function (shape) {
            var connectedTaskId = dataToTask.get(shape.bpmnElement);
            var taskBounds = connectedTaskId ? nextShapeMap.get(connectedTaskId) : null;
            if (taskBounds) {
                dataShapeMap.set(shape.bpmnElement, {
                    x: taskBounds.x + taskBounds.width + sideOffset,
                    y: taskBounds.y + (taskBounds.height / 2) - (shape.height / 2),
                    width: shape.width,
                    height: shape.height
                });
            } else {
                dataShapeMap.set(shape.bpmnElement, {
                    x: shape.x, y: shape.y, width: shape.width, height: shape.height
                });
            }
        });
        return dataShapeMap;
    }

    function recalculateContainerBounds(containerShapes, allShapeMap, laneFlowRefs, elementTypes) {
        var containerBoundsMap = new Map();
        var padding = 50;
        containerShapes.forEach(function (shape) {
            var typeName = (elementTypes.get(shape.bpmnElement) || '').toLowerCase();
            if (typeName !== 'lane') return;
            var refs = laneFlowRefs.get(shape.bpmnElement) || [];
            if (refs.length === 0) return;
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            refs.forEach(function (refId) {
                var bounds = allShapeMap.get(refId);
                if (!bounds) return;
                minX = Math.min(minX, bounds.x);
                minY = Math.min(minY, bounds.y);
                maxX = Math.max(maxX, bounds.x + bounds.width);
                maxY = Math.max(maxY, bounds.y + bounds.height);
            });
            if (Number.isFinite(minX)) {
                containerBoundsMap.set(shape.bpmnElement, {
                    x: minX - padding - 30,
                    y: minY - padding,
                    width: (maxX - minX) + (2 * padding) + 30,
                    height: (maxY - minY) + (2 * padding)
                });
            }
        });
        containerShapes.forEach(function (shape) {
            var typeName = (elementTypes.get(shape.bpmnElement) || '').toLowerCase();
            if (typeName !== 'participant') return;
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            var found = false;
            containerBoundsMap.forEach(function (bounds) {
                found = true;
                minX = Math.min(minX, bounds.x); minY = Math.min(minY, bounds.y);
                maxX = Math.max(maxX, bounds.x + bounds.width); maxY = Math.max(maxY, bounds.y + bounds.height);
            });
            if (!found) {
                allShapeMap.forEach(function (bounds) {
                    found = true;
                    minX = Math.min(minX, bounds.x); minY = Math.min(minY, bounds.y);
                    maxX = Math.max(maxX, bounds.x + bounds.width); maxY = Math.max(maxY, bounds.y + bounds.height);
                });
            }
            if (found && Number.isFinite(minX)) {
                containerBoundsMap.set(shape.bpmnElement, {
                    x: minX - padding, y: minY - padding,
                    width: (maxX - minX) + (2 * padding),
                    height: (maxY - minY) + (2 * padding)
                });
            }
        });
        return containerBoundsMap;
    }

    function applyDataAndContainerBounds(nextXml, nextShapeMap, dataShapes, containerShapes, elementTypes, originalXml) {
        var dataToTask = collectDataAssociations(originalXml);
        var dataShapeMap = positionDataShapes(dataShapes, nextShapeMap, dataToTask);
        dataShapes.forEach(function (shape) {
            var nextBounds = dataShapeMap.get(shape.bpmnElement);
            if (nextBounds) {
                nextXml = replaceShapeBounds(nextXml, shape.bpmnElement, nextBounds);
            }
        });
        if (containerShapes.length > 0) {
            var laneFlowRefs = collectLaneFlowRefs(originalXml);
            var allShapeMap = new Map(nextShapeMap);
            dataShapeMap.forEach(function (bounds, id) { allShapeMap.set(id, bounds); });
            var containerBoundsMap = recalculateContainerBounds(containerShapes, allShapeMap, laneFlowRefs, elementTypes);
            containerShapes.forEach(function (shape) {
                var nextBounds = containerBoundsMap.get(shape.bpmnElement);
                if (nextBounds) {
                    nextXml = replaceShapeBounds(nextXml, shape.bpmnElement, nextBounds);
                }
            });
        }
        return nextXml;
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

    function extractWellFormedEdgeLabel(innerContent) {
        if (typeof innerContent !== 'string') {
            return '';
        }

        const labelMatch = innerContent.match(/<bpmndi:BPMNLabel\b[\s\S]*?<\/bpmndi:BPMNLabel>/i);
        return labelMatch ? labelMatch[0].trim() : '';
    }

    function buildEdgeInnerContent(waypoints, labelMarkup) {
        const parts = [];
        const waypointMarkup = waypoints
            .map((point) => `        <di:waypoint x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" />`)
            .join('\n');

        if (waypointMarkup) {
            parts.push(waypointMarkup);
        }
        if (labelMarkup) {
            parts.push(labelMarkup);
        }

        return parts.join('\n');
    }

    function replaceEdgeWaypoints(xml, flowId, waypoints) {
        const edgePattern = new RegExp(
            `(<bpmndi:BPMNEdge\\b[^>]*bpmnElement="${flowId}"[^>]*>)([\\s\\S]*?)(<\\/bpmndi:BPMNEdge>)`,
            'i'
        );

        return xml.replace(edgePattern, function (_match, openTag, innerContent, closeTag) {
            const labelMarkup = extractWellFormedEdgeLabel(innerContent);
            const nextInner = buildEdgeInnerContent(waypoints, labelMarkup);
            return `${openTag}\n${nextInner}\n      ${closeTag}`;
        });
    }

    function replaceEdgeLabelBounds(xml, flowId, nextBounds) {
        const flowIdPattern = escapeRegExp(flowId);
        const labelPattern = new RegExp(
            `(<bpmndi:BPMNEdge\\b[^>]*bpmnElement="${flowIdPattern}"[^>]*>[\\s\\S]*?<bpmndi:BPMNLabel\\b[^>]*>[\\s\\S]*?<dc:Bounds\\b)([^>]*?)(?:\\/?>)([\\s\\S]*?<\\/bpmndi:BPMNLabel>[\\s\\S]*?<\\/bpmndi:BPMNEdge>)`,
            'i'
        );

        return xml.replace(labelPattern, function (_match, prefix, _attrs, suffix) {
            const attrs = [
                `x="${nextBounds.x.toFixed(1)}"`,
                `y="${nextBounds.y.toFixed(1)}"`,
                `width="${nextBounds.width.toFixed(1)}"`,
                `height="${nextBounds.height.toFixed(1)}"`
            ].join(' ');
            return `${prefix} ${attrs} />${suffix}`;
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

    function getShapeLayoutMetrics(shape, elementTypes) {
        const elementType = (elementTypes.get(shape.bpmnElement) || '').toLowerCase();
        const isTask = elementType.includes('task') || elementType.includes('callactivity');
        const isGateway = elementType.includes('gateway');
        const isEvent = elementType.includes('event');

        return {
            width: isTask ? Math.max(shape.width, 220) : (isGateway ? Math.max(shape.width, 72) : shape.width),
            height: isTask ? Math.max(shape.height, 90) : (isEvent ? Math.max(shape.height, 36) : shape.height)
        };
    }

    function buildGraphIndexes(shapes, flows) {
        const shapeMap = new Map(shapes.map((shape) => [shape.bpmnElement, shape]));
        const outgoing = new Map();
        const outgoingFlows = new Map();
        const incoming = new Map();
        const indegree = new Map();

        shapeMap.forEach((_shape, nodeId) => {
            outgoing.set(nodeId, []);
            outgoingFlows.set(nodeId, []);
            incoming.set(nodeId, []);
            indegree.set(nodeId, 0);
        });

        flows.forEach((flow) => {
            if (!shapeMap.has(flow.sourceRef) || !shapeMap.has(flow.targetRef)) {
                return;
            }

            outgoing.get(flow.sourceRef).push(flow.targetRef);
            outgoingFlows.get(flow.sourceRef).push(flow);
            incoming.get(flow.targetRef).push(flow.sourceRef);
            indegree.set(flow.targetRef, (indegree.get(flow.targetRef) || 0) + 1);
        });

        return {
            shapeMap,
            outgoing,
            outgoingFlows,
            incoming,
            indegree
        };
    }

    const NEGATIVE_FLOW_LABELS = new Set(['нет', 'РЅРµС‚', 'no']);
    const POSITIVE_FLOW_LABELS = new Set(['да', 'РґР°', 'yes']);

    function isNegativeFlowLabel(value) {
        return NEGATIVE_FLOW_LABELS.has(String(value || '').trim().toLowerCase());
    }

    function isPositiveFlowLabel(value) {
        return POSITIVE_FLOW_LABELS.has(String(value || '').trim().toLowerCase());
    }

    function getFlowDirectionSlot(flowName) {
        const normalizedName = String(flowName || '').trim().toLowerCase();
        if (isNegativeFlowLabel(normalizedName)) {
            return -1;
        }
        if (isPositiveFlowLabel(normalizedName)) {
            return 1;
        }
        return 0;
    }

    function detectBackFlowIds(shapes, flows) {
        const graph = buildGraphIndexes(shapes, flows);
        const { shapeMap, outgoingFlows, indegree } = graph;
        const originalOrder = (nodeId) => {
            const shape = shapeMap.get(nodeId);
            return (shape.y * 10000) + shape.x;
        };

        const preferredStarts = Array.from(shapeMap.keys())
            .filter((nodeId) => (indegree.get(nodeId) || 0) === 0)
            .sort((left, right) => originalOrder(left) - originalOrder(right));
        const visited = new Set();
        const visiting = new Set();
        const backFlowIds = new Set();

        function walk(nodeId) {
            if (visited.has(nodeId) || !shapeMap.has(nodeId)) {
                return;
            }

            visited.add(nodeId);
            visiting.add(nodeId);

            const nextFlows = (outgoingFlows.get(nodeId) || [])
                .slice()
                .sort((left, right) => originalOrder(left.targetRef) - originalOrder(right.targetRef));

            nextFlows.forEach((flow) => {
                if (visiting.has(flow.targetRef)) {
                    backFlowIds.add(flow.id);
                    return;
                }
                if (!visited.has(flow.targetRef)) {
                    walk(flow.targetRef);
                }
            });

            visiting.delete(nodeId);
        }

        preferredStarts.forEach(walk);

        Array.from(shapeMap.keys())
            .sort((left, right) => originalOrder(left) - originalOrder(right))
            .forEach(walk);

        return backFlowIds;
    }

    function buildLayeredRows(shapes, flows, ignoredFlowIds) {
        const graph = buildGraphIndexes(shapes, flows);
        const { shapeMap, outgoing, incoming, indegree } = graph;
        const nodeIds = Array.from(shapeMap.keys());
        const originalCenter = (nodeId) => {
            const shape = shapeMap.get(nodeId);
            return shape.x + (shape.width / 2);
        };
        const originalOrder = (nodeId) => {
            const shape = shapeMap.get(nodeId);
            return (shape.y * 10000) + shape.x;
        };

        const effectiveOutgoing = new Map();
        const effectiveIncoming = new Map();
        const remainingIndegree = new Map();

        nodeIds.forEach((nodeId) => {
            effectiveOutgoing.set(nodeId, []);
            effectiveIncoming.set(nodeId, []);
            remainingIndegree.set(nodeId, 0);
        });

        flows.forEach((flow) => {
            if (ignoredFlowIds && ignoredFlowIds.has(flow.id)) {
                return;
            }
            if (!shapeMap.has(flow.sourceRef) || !shapeMap.has(flow.targetRef)) {
                return;
            }

            effectiveOutgoing.get(flow.sourceRef).push(flow.targetRef);
            effectiveIncoming.get(flow.targetRef).push(flow.sourceRef);
            remainingIndegree.set(flow.targetRef, (remainingIndegree.get(flow.targetRef) || 0) + 1);
        });

        const pending = nodeIds
            .filter((nodeId) => (remainingIndegree.get(nodeId) || 0) === 0)
            .sort((left, right) => originalOrder(left) - originalOrder(right));
        const levels = new Map();
        const visited = new Set();

        pending.forEach((nodeId) => levels.set(nodeId, 0));

        while (pending.length) {
            const nodeId = pending.shift();
            visited.add(nodeId);

            const baseLevel = levels.get(nodeId) || 0;
            const targets = (effectiveOutgoing.get(nodeId) || []).slice().sort((left, right) => originalOrder(left) - originalOrder(right));
            targets.forEach((targetId) => {
                levels.set(targetId, Math.max(levels.get(targetId) || 0, baseLevel + 1));
                remainingIndegree.set(targetId, (remainingIndegree.get(targetId) || 0) - 1);
                if ((remainingIndegree.get(targetId) || 0) === 0) {
                    pending.push(targetId);
                }
            });

            pending.sort((left, right) => {
                const leftLevel = levels.get(left) || 0;
                const rightLevel = levels.get(right) || 0;
                return leftLevel - rightLevel || originalOrder(left) - originalOrder(right);
            });
        }

        if (visited.size < nodeIds.length) {
            const fallbackLevel = Array.from(levels.values()).reduce((maxLevel, level) => Math.max(maxLevel, level), 0);
            nodeIds
                .filter((nodeId) => !visited.has(nodeId))
                .sort((left, right) => originalOrder(left) - originalOrder(right))
                .forEach((nodeId, index) => {
                    levels.set(nodeId, fallbackLevel + index + 1);
                });
        }

        const rows = [];
        nodeIds.forEach((nodeId) => {
            const level = levels.get(nodeId) || 0;
            if (!rows[level]) {
                rows[level] = [];
            }
            rows[level].push(shapeMap.get(nodeId));
        });

        rows.forEach((row) => {
            row.sort((left, right) => {
                const leftParents = effectiveIncoming.get(left.bpmnElement) || [];
                const rightParents = effectiveIncoming.get(right.bpmnElement) || [];
                const leftAnchor = leftParents.length
                    ? leftParents.reduce((sum, nodeId) => sum + originalCenter(nodeId), 0) / leftParents.length
                    : originalCenter(left.bpmnElement);
                const rightAnchor = rightParents.length
                    ? rightParents.reduce((sum, nodeId) => sum + originalCenter(nodeId), 0) / rightParents.length
                    : originalCenter(right.bpmnElement);

                return leftAnchor - rightAnchor || left.x - right.x || left.y - right.y;
            });
        });

        return rows.filter(Boolean);
    }

    function collectAncestorIds(nodeId, incoming, cache) {
        if (cache.has(nodeId)) {
            return cache.get(nodeId);
        }

        const ancestors = new Set();
        const pending = (incoming.get(nodeId) || []).slice();

        while (pending.length) {
            const parentId = pending.pop();
            if (ancestors.has(parentId)) {
                continue;
            }
            ancestors.add(parentId);
            (incoming.get(parentId) || []).forEach((nextParentId) => {
                if (!ancestors.has(nextParentId)) {
                    pending.push(nextParentId);
                }
            });
        }

        cache.set(nodeId, ancestors);
        return ancestors;
    }

    function canReachAnyTarget(startId, targetIds, outgoing) {
        if (!targetIds || targetIds.size === 0) {
            return false;
        }

        const visited = new Set();
        const pending = [startId];

        while (pending.length) {
            const nodeId = pending.pop();
            if (targetIds.has(nodeId)) {
                return true;
            }
            if (visited.has(nodeId)) {
                continue;
            }
            visited.add(nodeId);
            (outgoing.get(nodeId) || []).forEach((nextNodeId) => {
                if (!visited.has(nextNodeId)) {
                    pending.push(nextNodeId);
                }
            });
        }

        return false;
    }

    function buildGatewayBranchHints(flows, elementTypes, graph) {
        const hints = new Map();
        const exclusiveGatewayIds = collectExclusiveGatewayIds(elementTypes);
        const ancestorCache = new Map();

        const createFallbackSlotOrder = (gatewayFlows) => {
            const slotByTarget = new Map();
            const sortedFlows = gatewayFlows.slice().sort((left, right) => {
                const leftSlot = getFlowDirectionSlot(left.name);
                const rightSlot = getFlowDirectionSlot(right.name);
                return leftSlot - rightSlot || left.targetRef.localeCompare(right.targetRef);
            });
            const slotOrder = [];

            if (sortedFlows.length === 2) {
                slotOrder.push(-1, 1);
            } else {
                for (let index = 0; index < sortedFlows.length; index += 1) {
                    const magnitude = Math.floor(index / 2) + 1;
                    slotOrder.push(index % 2 === 0 ? -magnitude : magnitude);
                }
            }

            sortedFlows.forEach((flow, index) => {
                slotByTarget.set(flow.targetRef, slotOrder[index] || 0);
            });

            return slotByTarget;
        };

        exclusiveGatewayIds.forEach((gatewayId) => {
            const gatewayFlows = (graph.outgoingFlows.get(gatewayId) || []).slice();
            if (gatewayFlows.length < 2) {
                return;
            }

            const ancestorIds = collectAncestorIds(gatewayId, graph.incoming, ancestorCache);
            const loopFlows = gatewayFlows.filter((flow) => canReachAnyTarget(flow.targetRef, ancestorIds, graph.outgoing));
            const forwardFlows = gatewayFlows.filter((flow) => !loopFlows.some((loopFlow) => loopFlow.id === flow.id));
            const slotByTarget = new Map();

            if (forwardFlows.length === 1 && loopFlows.length >= 1) {
                slotByTarget.set(forwardFlows[0].targetRef, 0);
                const orderedLoopFlows = loopFlows.slice().sort((left, right) => {
                    const leftSlot = getFlowDirectionSlot(left.name);
                    const rightSlot = getFlowDirectionSlot(right.name);
                    return leftSlot - rightSlot || left.targetRef.localeCompare(right.targetRef);
                });

                orderedLoopFlows.forEach((flow, index) => {
                    if (orderedLoopFlows.length === 1) {
                        slotByTarget.set(flow.targetRef, -1);
                        return;
                    }

                    const magnitude = Math.floor(index / 2) + 1;
                    slotByTarget.set(flow.targetRef, index % 2 === 0 ? -magnitude : magnitude);
                });
            } else {
                createFallbackSlotOrder(gatewayFlows).forEach((slot, targetId) => {
                    slotByTarget.set(targetId, slot);
                });
            }

            hints.set(gatewayId, { slotByTarget });
        });

        return hints;
    }

    function buildBranchLayoutMap(rows, elementTypes, graph, gatewayBranchHints) {
        const averageCenterX = rows
            .flat()
            .reduce((sum, shape) => sum + shape.x + (shape.width / 2), 0) / rows.flat().length;
        const centerX = Math.max(averageCenterX, 520);
        const topMargin = 80;
        const verticalGap = 180;
        const horizontalGap = 140;
        const leftPadding = 80;
        const branchLaneOffset = 450;
        const nextShapeMap = new Map();

        let currentY = topMargin;

        rows.forEach((row, rowIndex) => {
            const metricsRow = row.map((shape) => ({
                shape,
                ...getShapeLayoutMetrics(shape, elementTypes)
            }));
            const rowHeight = metricsRow.reduce((maxHeight, item) => Math.max(maxHeight, item.height), 0);
            const positionedItems = metricsRow.map((item) => {
                const nodeId = item.shape.bpmnElement;
                const parentIds = (graph.incoming.get(nodeId) || []).filter((parentId) => nextShapeMap.has(parentId));
                let preferredCenter = centerX;
                let branchSlot = null;

                if (parentIds.length) {
                    preferredCenter = parentIds.reduce((sum, parentId) => {
                        const parentBounds = nextShapeMap.get(parentId);
                        return sum + parentBounds.x + (parentBounds.width / 2);
                    }, 0) / parentIds.length;
                } else if (rowIndex === 0) {
                    preferredCenter = centerX;
                }

                parentIds.forEach((parentId) => {
                    const branchHint = gatewayBranchHints.get(parentId);
                    const parentBounds = nextShapeMap.get(parentId);
                    if (!branchHint || !parentBounds || !branchHint.slotByTarget.has(nodeId)) {
                        return;
                    }

                    branchSlot = branchHint.slotByTarget.get(nodeId);
                    preferredCenter = parentBounds.x + (parentBounds.width / 2) + (branchSlot * branchLaneOffset);
                });

                return {
                    ...item,
                    preferredCenter,
                    branchSlot
                };
            }).sort((left, right) => {
                return left.preferredCenter - right.preferredCenter || left.shape.x - right.shape.x || left.shape.y - right.shape.y;
            });

            const centerAnchoredItems = positionedItems.filter((item) => item.branchSlot === 0);
            const leftBranchItems = positionedItems
                .filter((item) => typeof item.branchSlot === 'number' && item.branchSlot < 0)
                .sort((left, right) => right.branchSlot - left.branchSlot);
            const rightBranchItems = positionedItems
                .filter((item) => typeof item.branchSlot === 'number' && item.branchSlot > 0)
                .sort((left, right) => left.branchSlot - right.branchSlot);
            const neutralItems = positionedItems.filter((item) => item.branchSlot === null || typeof item.branchSlot === 'undefined');

            if (centerAnchoredItems.length === 1 && (leftBranchItems.length || rightBranchItems.length)) {
                const centerItem = centerAnchoredItems[0];
                const centerResolvedX = Math.max(leftPadding, centerItem.preferredCenter - (centerItem.width / 2));
                const centerResolvedY = currentY + ((rowHeight - centerItem.height) / 2);

                nextShapeMap.set(centerItem.shape.bpmnElement, {
                    x: centerResolvedX,
                    y: centerResolvedY,
                    width: centerItem.width,
                    height: centerItem.height
                });

                let leftCursor = centerResolvedX - horizontalGap;
                leftBranchItems.forEach((item) => {
                    const desiredX = item.preferredCenter - (item.width / 2);
                    const resolvedX = Math.max(leftPadding, Math.min(leftCursor - item.width, desiredX));
                    nextShapeMap.set(item.shape.bpmnElement, {
                        x: resolvedX,
                        y: currentY + ((rowHeight - item.height) / 2),
                        width: item.width,
                        height: item.height
                    });
                    leftCursor = resolvedX - horizontalGap;
                });

                let rightCursor = centerResolvedX + centerItem.width + horizontalGap;
                [...rightBranchItems, ...neutralItems].forEach((item) => {
                    const desiredX = item.preferredCenter - (item.width / 2);
                    const resolvedX = Math.max(rightCursor, desiredX);
                    nextShapeMap.set(item.shape.bpmnElement, {
                        x: resolvedX,
                        y: currentY + ((rowHeight - item.height) / 2),
                        width: item.width,
                        height: item.height
                    });
                    rightCursor = resolvedX + item.width + horizontalGap;
                });
            } else {
                let currentX = leftPadding;
                positionedItems.forEach((item) => {
                    const desiredX = item.preferredCenter - (item.width / 2);
                    const resolvedX = Math.max(currentX, desiredX);
                    nextShapeMap.set(item.shape.bpmnElement, {
                        x: resolvedX,
                        y: currentY + ((rowHeight - item.height) / 2),
                        width: item.width,
                        height: item.height
                    });
                    currentX = resolvedX + item.width + horizontalGap;
                });
            }

            currentY += rowHeight + verticalGap;
        });

        return nextShapeMap;
    }

    function buildBranchWaypoints(source, target) {
        const sourceCenterX = source.x + (source.width / 2);
        const sourceBottomY = source.y + source.height;
        const targetCenterX = target.x + (target.width / 2);
        const targetTopY = target.y;
        const targetIsAboveSource = targetTopY <= source.y;

        if (targetIsAboveSource) {
            const routeLeft = targetCenterX <= sourceCenterX;
            const sideX = routeLeft
                ? Math.min(source.x, target.x) - 180
                : Math.max(source.x + source.width, target.x + target.width) + 180;
            const upperY = Math.max(24, targetTopY - 72);

            return [
                { x: sourceCenterX, y: sourceBottomY },
                { x: sideX, y: sourceBottomY },
                { x: sideX, y: upperY },
                { x: targetCenterX, y: upperY },
                { x: targetCenterX, y: targetTopY }
            ];
        }

        if (Math.abs(sourceCenterX - targetCenterX) < 1) {
            return [
                { x: sourceCenterX, y: sourceBottomY },
                { x: targetCenterX, y: targetTopY }
            ];
        }

        const bendY = Math.max(
            sourceBottomY + 40,
            targetTopY - Math.max(32, Math.min(96, (targetTopY - sourceBottomY) / 3))
        );
        return [
            { x: sourceCenterX, y: sourceBottomY },
            { x: sourceCenterX, y: bendY },
            { x: targetCenterX, y: bendY },
            { x: targetCenterX, y: targetTopY }
        ];
    }

    function buildEdgeLabelBounds(waypoints) {
        if (!Array.isArray(waypoints) || waypoints.length === 0) {
            return null;
        }

        const anchor = waypoints.length >= 4
            ? {
                x: (waypoints[1].x + waypoints[2].x) / 2,
                y: waypoints[1].y
            }
            : {
                x: (waypoints[0].x + waypoints[waypoints.length - 1].x) / 2,
                y: (waypoints[0].y + waypoints[waypoints.length - 1].y) / 2
            };

        return {
            x: anchor.x - 24,
            y: anchor.y - 28,
            width: 48,
            height: 18
        };
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
                    const value = String(rawValue).trim();
                    if (value) {
                        didSanitize = true;
                    }
                    return '';
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
        const classified = classifyShapes(shapes, elementTypes);
        const flowShapes = classified.flowShapes;
        const containerShapes = classified.containerShapes;
        const dataShapes = classified.dataShapes;
        if (flowShapes.length < 2 || flows.length === 0) {
            return xml;
        }

        const sanitizedResult = sanitizeConditionFlows(xml, flows, elementTypes);
        const sanitizedXml = sanitizedResult.xml;

        if (hasNonLinearTopology(elementTypes, flows)) {
            const graph = buildGraphIndexes(flowShapes, flows);
            const backFlowIds = detectBackFlowIds(flowShapes, flows);
            const rows = buildLayeredRows(flowShapes, flows, backFlowIds);
            if (rows.length < 2) {
                return sanitizedXml;
            }

            const gatewayBranchHints = buildGatewayBranchHints(flows, elementTypes, graph);
            const nextShapeMap = buildBranchLayoutMap(rows, elementTypes, graph, gatewayBranchHints);
            let nextXml = sanitizedXml;

            flowShapes.forEach((shape) => {
                const nextShape = nextShapeMap.get(shape.bpmnElement);
                if (!nextShape) return;
                nextXml = replaceShapeBounds(nextXml, shape.bpmnElement, nextShape);
            });

            flows.forEach((flow) => {
                const source = nextShapeMap.get(flow.sourceRef);
                const target = nextShapeMap.get(flow.targetRef);
                if (!source || !target) return;

                const waypoints = buildBranchWaypoints(source, target);
                nextXml = replaceEdgeWaypoints(nextXml, flow.id, waypoints);

                const labelBounds = buildEdgeLabelBounds(waypoints);
                if (labelBounds) {
                    nextXml = replaceEdgeLabelBounds(nextXml, flow.id, labelBounds);
                }
            });

            return applyDataAndContainerBounds(nextXml, nextShapeMap, dataShapes, containerShapes, elementTypes, xml);
        }

        const orderedShapes = buildLinearOrder(flowShapes, flows);
        if (orderedShapes.length < 2) {
            return sanitizedXml;
        }

        const averageCenterX = orderedShapes.reduce((sum, shape) => sum + shape.x + (shape.width / 2), 0) / orderedShapes.length;
        const centerX = Math.max(averageCenterX, 520);
        const topMargin = 80;
        const verticalGap = 140;
        const nextShapeMap = new Map();

        let currentY = topMargin;
        orderedShapes.forEach((shape) => {
            const metrics = getShapeLayoutMetrics(shape, elementTypes);

            const nextShape = {
                x: centerX - (metrics.width / 2),
                y: currentY,
                width: metrics.width,
                height: metrics.height
            };
            nextShapeMap.set(shape.bpmnElement, nextShape);
            currentY += metrics.height + verticalGap;
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

        return applyDataAndContainerBounds(nextXml, nextShapeMap, dataShapes, containerShapes, elementTypes, xml);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { normalizeBpmnVerticalLayout };
    }

    globalScope.normalizeBpmnVerticalLayout = normalizeBpmnVerticalLayout;
})(typeof globalThis !== 'undefined' ? globalThis : window);
