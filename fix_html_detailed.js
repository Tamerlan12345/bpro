const fs = require('fs');
let html = fs.readFileSync('backend/public/index.html', 'utf8');

// 1. Fix the broken tag
html = html.replace(/<\s*<div class="admin-grid">/, '<div class="admin-grid">');

const lines = html.split('\n');

// Let's identify the missing closing tags and where they should go.
// The parser complained:
// Unmatched closing tag </div> at line 115
//   Expected closing for <main> from line 20
// Unmatched closing tag </main> at line 232
//   Expected closing for <div class="input-block glass-card full-width"> from line 152

// Wait, at line 114 we have </div></main></div>
// <main> was opened at line 20:
// <body>
//     <div class="auth-wrapper">
//         <header class="app-header">...</header>
//         <main>

// Then we have <div id="login-container" class="login-container"> (closes at line 55)
// Then <div class="admin-grid"> (closes at line 98)
// Then <div class="admin-section full-width"> (closes at line 113)

// In index.html line 110-117:
//            <div id="completed" class="tab-content orbit-list">
//                <ul id="completed-list"></ul>
//            </div>
//        </div>
//    </div>
// </main>
// </div>

// The first </div> closes #completed.
// The second </div> closes .admin-section.full-width.
// Then there's an extra </div> on line 114 before </main>!
// Wait, no. <main> holds #login-container, .admin-grid, and .admin-section full-width.
// Ah, but wait! .admin-grid is opened, then .admin-section, then .admin-section. So .admin-grid has two children.
// But .admin-section full-width is NOT inside .admin-grid. It is a sibling.
// Therefore, the </div> on line 114 is closing .auth-wrapper!
// Wait, if line 114 is `</div>`, and line 115 is `</main>`, then they are swapped!
// It should be `</main>` then `</div>` to close .auth-wrapper correctly.
