const fs = require('fs');

let html = fs.readFileSync('backend/public/index.html', 'utf8');

// 1. Fix the broken <        <div class="admin-grid">
html = html.replace(/<\s*<div class="admin-grid">/, '<div class="admin-grid">');

// 2. Remove the trailing </div> that wraps the body
// Also notice that <div class="admin-section full-width"> around line 83 is a sibling of <div class="admin-grid">. Wait, no.
// Let's use the HTML parser approach to regenerate or just surgically fix.
// Wait, the user said: "Убедиться, что все блоки <div> корректно открыты и закрыты, особенно внутри блока <main> и .auth-wrapper."
// Let's fix the specific mismatch tags.

// In line 104, there's `</main></div>`. Wait, `.admin-section full-width` is closed at line 102.
// Then </div> for .auth-wrapper or .admin-grid?
