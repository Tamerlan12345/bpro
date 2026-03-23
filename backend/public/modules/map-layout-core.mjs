const DEFAULT_LAYOUT_OPTIONS = {
    departmentSpacingX: 280,
    departmentStartY: 120,
    nodeSpacingY: 85,
    rootX: 0,
    rootY: -100
};

const getSortableName = (entity) => {
    if (!entity) return '';
    return String(entity.rawName || entity.name || entity.id || '').toLowerCase();
};

const compareByName = (left, right) => getSortableName(left).localeCompare(getSortableName(right), 'ru');

export const buildStructuredLayout = (graph, options = {}) => {
    const settings = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
    const departments = [...(graph.departments || [])].sort(compareByName);
    const processes = graph.processes || [];
    const chats = graph.chats || [];
    const positions = [];

    positions.push({
        id: graph.rootId || 'root_company',
        type: 'root',
        x: settings.rootX,
        y: settings.rootY
    });

    let currentX = departments.length > 0
        ? -((departments.length - 1) * settings.departmentSpacingX) / 2
        : 0;

    departments.forEach((department) => {
        positions.push({
            id: department.id,
            type: 'department',
            x: currentX,
            y: settings.departmentStartY
        });

        const children = [
            ...processes
                .filter((process) => process.departmentId === department.id)
                .sort(compareByName)
                .map((process) => ({ ...process, type: 'process' })),
            ...chats
                .filter((chat) => chat.departmentId === department.id)
                .sort(compareByName)
                .map((chat) => ({ ...chat, type: 'chat' }))
        ];

        let currentY = settings.departmentStartY + settings.nodeSpacingY;
        children.forEach((child) => {
            positions.push({
                id: child.id,
                type: child.type,
                x: currentX,
                y: currentY
            });
            currentY += settings.nodeSpacingY;
        });

        currentX += settings.departmentSpacingX;
    });

    const unassigned = [
        ...processes
            .filter((process) => !process.departmentId)
            .sort(compareByName)
            .map((process) => ({ ...process, type: 'process' })),
        ...chats
            .filter((chat) => !chat.departmentId)
            .sort(compareByName)
            .map((chat) => ({ ...chat, type: 'chat' }))
    ];

    let floatingY = settings.departmentStartY;
    unassigned.forEach((node) => {
        positions.push({
            id: node.id,
            type: node.type,
            x: currentX,
            y: floatingY
        });
        floatingY += settings.nodeSpacingY;
    });

    return positions;
};
