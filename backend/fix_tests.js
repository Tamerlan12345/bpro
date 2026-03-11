const fs = require('fs');

const path = 'backend/tests/versions.test.js';
let testContent = fs.readFileSync(path, 'utf8');

// Update expect.stringMatching(/INSERT INTO process_versions/) call to match actual parameters
// The error says:
// Expected: StringMatching /INSERT INTO process_versions/, ["chat-uuid-456", "Test process text", "graph TD; A-->B;"]
// Received ... Array [ "chat-uuid-456", "Test process text", "graph TD; A-->B;", null, null ]
// So we just need to add `null, null` to the expected array.

testContent = testContent.replace(
    /\[CHAT_ID, payload\.process_text, payload\.mermaid_code\]/g,
    '[CHAT_ID, payload.process_text, payload.mermaid_code, null, null]'
);

fs.writeFileSync(path, testContent);
