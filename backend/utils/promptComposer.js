function formatApprovedProcesses(approvedProcesses) {
    if (!Array.isArray(approvedProcesses) || approvedProcesses.length === 0) {
        return '';
    }

    const lines = approvedProcesses.map((proc) => {
        const name = proc && proc.name ? String(proc.name).trim() : 'Без названия';
        const description = proc && proc.description ? String(proc.description).trim() : '';
        if (!description) {
            return `- ${name}`;
        }
        return `- ${name}: ${description}`;
    });

    return `КОНТЕКСТ УТВЕРЖДЕННЫХ ПРОЦЕССОВ:\n${lines.join('\n')}`;
}

function composeGeneratePrompt({
    userPrompt,
    approvedProcesses = [],
    initialTemplate = '',
    latestVersion = ''
}) {
    const normalizedPrompt = typeof userPrompt === 'string' ? userPrompt.trim() : '';
    const approvedBlock = formatApprovedProcesses(approvedProcesses);
    const initialBlock = typeof initialTemplate === 'string' ? initialTemplate.trim() : '';
    const latestBlock = typeof latestVersion === 'string' ? latestVersion.trim() : '';

    if (!approvedBlock && !initialBlock && !latestBlock) {
        return normalizedPrompt;
    }

    const sections = [
        'ТЫ — БИЗНЕС-ПРОЦЕССНЫЙ АГЕНТ КОМПАНИИ. УЧИТЫВАЙ КОНТЕКСТ КОМПАНИИ И СОБЛЮДАЙ СТРУКТУРУ ШАБЛОНОВ.',
        approvedBlock
    ];

    if (initialBlock) {
        sections.push(`ЭТАЛОННЫЙ ШАБЛОН ПРОЦЕССА ДЛЯ ЭТОГО ЧАТА:\n${initialBlock}`);
    }

    if (latestBlock) {
        sections.push(`ПОСЛЕДНЯЯ СОХРАНЕННАЯ ВЕРСИЯ ПРОЦЕССА:\n${latestBlock}`);
    }

    sections.push(`ЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n${normalizedPrompt}`);
    return sections.filter(Boolean).join('\n\n');
}

module.exports = {
    composeGeneratePrompt
};
