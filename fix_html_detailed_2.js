const fs = require('fs');
let lines = fs.readFileSync('backend/public/index.html', 'utf8').split('\n');

// Replace the broken tag
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<        <div class="admin-grid">')) {
        lines[i] = lines[i].replace(/<\s*<div class="admin-grid">/, '<div class="admin-grid">');
    }
}

// Fix lines 113-116
// 113:        </div>
// 114:    </div>
// 115: </main>
// 116: </div>
for (let i = 110; i < 120; i++) {
    if (lines[i] && lines[i].includes('</main>')) {
        // Swap </main> and </div> if needed
        // The structure should be:
        // </main>
        // </div> <!-- closes .auth-wrapper -->
    }
}
