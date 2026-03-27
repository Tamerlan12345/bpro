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

const SYSTEM_PROMPT = `ТЫ — БИЗНЕС-АНАЛИТИК И АГЕНТ КОМПАНИИ ПО ОПТИМИЗАЦИИ ПРОЦЕССОВ.
ТВОЯ ЗАДАЧА: ПОМОЧЬ ПОЛЬЗОВАТЕЛЮ СФОРМУЛИРОВАТЬ И УСОВЕРШЕНСТВОВАТЬ БИЗНЕС-ПРОЦЕСС.

ПРАВИЛА ОФОРМЛЕНИЯ:
1. ИСПОЛЬЗУЙ СТРУКТУРУ И СТИЛЬ ИЗ ЖЕСТКОГО КОНТЕКСТА УТВЕРЖДЕННЫХ ПРОЦЕССОВ (ЕСЛИ ОНИ ПРЕДОСТАВЛЕНЫ).
2. ЕСЛИ В ПРИМЕРАХ НИЖЕ ИСПОЛЬЗУЕТСЯ НУМЕРАЦИЯ, ОПРЕДЕЛЕННЫЙ УРОВЕНЬ ДЕТАЛИЗАЦИИ ИЛИ СПЕЦИФИЧЕСКИЕ ТЕРМИНЫ — ДЕЛАЙ ТАК ЖЕ.
3. ПРОЦЕСС ДОЛЖЕН БЫТЬ ПОНЯТНЫМ, ЛОГИЧНЫМ И ГОТОВЫМ К ВИЗУАЛИЗАЦИИ В ВИДЕ ДИАГРАММЫ.
4. ОТВЕЧАЙ ТОЛЬКО ТЕКСТОМ ПРОЦЕССА ИЛИ ПРЕДЛОЖЕНИЯМИ ПО ЕГО УЛУЧШЕНИЮ, БЕЗ ЛИШНИХ ВСТУПЛЕНИЙ.`;

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
        return `${SYSTEM_PROMPT}\n\nЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n${normalizedPrompt}`;
    }

    const sections = [
        SYSTEM_PROMPT,
        approvedBlock ? `${approvedBlock}\n\n⚠️ ВАЖНО: Твои ответы по структуре, стилистике и глубине описания должны СООТВЕТСТВОВАТЬ примерам выше.` : ''
    ];

    if (initialBlock) {
        sections.push(`ЭТАЛОННЫЙ ШАБЛОН ДЛЯ ЭТОГО ЧАТА (ИСПОЛЬЗУЙ КАК ОСНОВУ):\n${initialBlock}`);
    }

    if (latestBlock) {
        sections.push(`ТЕКУЩАЯ РАБОЧАЯ ВЕРСИЯ:\n${latestBlock}`);
    }

    sections.push(`ЗАПРОС ПОЛЬЗОВАТЕЛЯ (ВНЕСИ ПРАВКИ ИЛИ СОЗДАЙ НОВЫЙ ВЕРНОЙ СТРУКТУРЕ):\n${normalizedPrompt}`);
    
    return sections.filter(Boolean).join('\n\n');
}

module.exports = {
    composeGeneratePrompt
};
