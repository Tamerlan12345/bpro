const fs = require('fs');
const path = require('path');

describe('chat diagram save regression', () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');

    const extractHandleSaveRawVersion = () => {
        const source = fs.readFileSync(scriptPath, 'utf8');
        const match = source.match(
            /async function handleSaveRawVersion\(button = saveRawVersionBtn\) \{[\s\S]*?\n    \}/
        );

        expect(match).toBeTruthy();

        const factory = new Function(
            'saveRawVersionBtn',
            'processDescriptionInput',
            'setButtonLoading',
            'bpmnViewer',
            'chatVersions',
            'fetchWithAuth',
            'chatId',
            'showNotification',
            'loadChatData',
            `return (${match[0].replace('async function handleSaveRawVersion', 'async function')});`
        );

        return factory;
    };

    test('save without AI persists the currently rendered diagram when viewer has newer XML', async () => {
        const fetchWithAuth = jest.fn().mockResolvedValue({});
        const setButtonLoading = jest.fn();
        const showNotification = jest.fn();
        const loadChatData = jest.fn().mockResolvedValue(undefined);
        const bpmnViewer = {
            saveXML: jest.fn().mockResolvedValue({ xml: '<xml>new-diagram</xml>' })
        };
        const processDescriptionInput = { value: 'Updated process text' };

        const factory = extractHandleSaveRawVersion();
        const handleSaveRawVersion = factory(
            {},
            processDescriptionInput,
            setButtonLoading,
            bpmnViewer,
            [{ mermaid_code: '<xml>old-diagram</xml>' }],
            fetchWithAuth,
            'chat-123',
            showNotification,
            loadChatData
        );

        await handleSaveRawVersion({});

        expect(bpmnViewer.saveXML).toHaveBeenCalledWith({ format: true });
        expect(fetchWithAuth).toHaveBeenCalledWith('/api/chats/chat-123/versions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                process_text: 'Updated process text',
                mermaid_code: '<xml>new-diagram</xml>'
            })
        });
    });
});
