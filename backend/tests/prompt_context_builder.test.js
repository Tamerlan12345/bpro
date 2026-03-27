const { composeGeneratePrompt } = require('../utils/promptComposer');

describe('composeGeneratePrompt', () => {
    test('returns raw prompt when no context provided', () => {
        const userPrompt = 'Build BPMN for procurement flow';
        expect(composeGeneratePrompt({ userPrompt })).toBe(userPrompt);
    });

    test('preserves strict machine-readable output requirements when context exists', () => {
        const userPrompt = `Return a JSON object only.
{
  "standardDescription": "...",
  "mermaidCode": "..."
}

Return ONLY BPMN 2.0 XML inside mermaidCode.`;

        const result = composeGeneratePrompt({
            userPrompt,
            approvedProcesses: [
                { name: 'Contract Approval', description: 'Approved baseline process' }
            ],
            initialTemplate: '### 4. Start event',
            latestVersion: '### 5. Step-by-step'
        });

        expect(result).toContain('Contract Approval');
        expect(result).toContain(userPrompt);
        expect(result).not.toContain('ОТВЕЧАЙ ТОЛЬКО ТЕКСТОМ ПРОЦЕССА');
    });

    test('includes approved processes, initial template and latest version when context exists', () => {
        const userPrompt = 'Update contract approval flow';
        const templateText = '### 4. Start event\\nRequest received';
        const latestText = '### 5. Step-by-step\\nStep 1. Check';

        const result = composeGeneratePrompt({
            userPrompt,
            approvedProcesses: [
                { name: 'Contract Approval', description: 'Approved baseline process' },
                { name: 'Procurement', description: null }
            ],
            initialTemplate: templateText,
            latestVersion: latestText
        });

        expect(result).toContain('Contract Approval');
        expect(result).toContain('Procurement');
        expect(result).toContain(templateText);
        expect(result).toContain(latestText);
        expect(result).toContain(userPrompt);
    });
});
