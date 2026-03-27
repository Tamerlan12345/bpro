function formatApprovedProcesses(approvedProcesses) {
    if (!Array.isArray(approvedProcesses) || approvedProcesses.length === 0) {
        return '';
    }

    const lines = approvedProcesses.map((proc) => {
        const name = proc && proc.name ? String(proc.name).trim() : 'Unnamed process';
        const description = proc && proc.description ? String(proc.description).trim() : '';
        if (!description) {
            return `- ${name}`;
        }
        return `- ${name}: ${description}`;
    });

    return `APPROVED PROCESS CONTEXT:\n${lines.join('\n')}`;
}

const SYSTEM_PROMPT = `YOU ARE A BUSINESS ANALYST ASSISTANT.
GOAL: help refine, improve, or generate business process content using the available company context.

RULES:
1. Treat approved processes, the initial template, and the latest version as reference context.
2. Preserve the exact output format requested in the user's prompt.
3. If the user's prompt asks for JSON, XML, BPMN, Markdown, or plain text, return exactly that format.
4. Do not add commentary outside the requested format.`;

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

    const sections = [SYSTEM_PROMPT];

    if (approvedBlock) {
        sections.push(approvedBlock);
    }

    if (initialBlock) {
        sections.push(`CHAT TEMPLATE:\n${initialBlock}`);
    }

    if (latestBlock) {
        sections.push(`CURRENT WORKING VERSION:\n${latestBlock}`);
    }

    sections.push(`PRIMARY USER INSTRUCTION (follow the required output format exactly):\n${normalizedPrompt}`);

    return sections.filter(Boolean).join('\n\n');
}

module.exports = {
    composeGeneratePrompt
};
