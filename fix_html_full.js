const fs = require('fs');
let html = fs.readFileSync('backend/public/index.html', 'utf8');

// 1. Fix the admin-grid tag
html = html.replace(/<\s*<div class="admin-grid">/, '<div class="admin-grid">');

// 2. We see that the orphan blocks at the end are:
//            </div>
//            <div id="transcription-finalized-view" style="display: none;">
//                <h4>Текст финализирован</h4>
//                <div class="finalized-text-display"></div>
//            </div>
//        </div>
//    </div>
// This happens right before </body></html> (lines 262-268)

// In the code, #tab-collection (line 151) looks like:
//            <!-- TAB 1: Collection -->
//            <div id="tab-collection" class="tab-pane active" style="display: block;">
//                <div class="input-block glass-card full-width">
//            <div class="input-block glass-card">
// Notice that the second <div class="input-block glass-card"> is nested incorrectly without an end tag, or maybe one is extra.
// Actually, it has two opening divs!
// Line 152: <div class="input-block glass-card full-width">
// Line 153: <div class="input-block glass-card">
// If they both open, they both need to close.
// And inside them is #partial-transcript-display and then buttons.
// Then line 169 closes two divs!
// 168:                 </div>
// 169:             </div>

// Wait, if line 168 closes the <div style="margin-top: 2rem;">, then line 169 closes <div class="input-block glass-card">.
// BUT <div class="input-block glass-card full-width"> and <div id="tab-collection" class="tab-pane active"> remain unclosed!
// And this is why there are unclosed tags, and they are dumped at the end!
// The block from line 262-267 is exactly the missing end tags for `#tab-collection`!

// I will re-locate the orphaned block from the bottom, and place it immediately after line 169.
// But wait, the orphaned block contains `#transcription-finalized-view`.
// So the structure should be:
//                 </div>
//             </div>
//             <!-- orphaned block here -->
//             <div id="transcription-finalized-view" style="display: none;">
//                 <h4>Текст финализирован</h4>
//                 <div class="finalized-text-display"></div>
//             </div>
//         </div>
//     </div>
//             <!-- TAB 2: AI Analysis -->

// Let's replace the whole bottom block (from line 262 to 268) with an empty string, and append it right before `<!-- TAB 2: AI Analysis -->`
html = html.replace(
`            </div>
            <div id="transcription-finalized-view" style="display: none;">
                <h4>Текст финализирован</h4>
                <div class="finalized-text-display"></div>
            </div>
        </div>
    </div>`, '');

// Now insert it before `<!-- TAB 2: AI Analysis -->`
html = html.replace('<!-- TAB 2: AI Analysis -->',
`            </div>
            <div id="transcription-finalized-view" style="display: none;">
                <h4>Текст финализирован</h4>
                <div class="finalized-text-display"></div>
            </div>
        </div>
    </div>

            <!-- TAB 2: AI Analysis -->`);

// 3. We also saw `</div></main></div>` swapped.
// Wait, is it really swapped?
// 113:        </div>
// 114:    </div>
// 115: </main>
// 116: </div>
html = html.replace(
`    </div>
</main>
</div>`,
`</main>
</div>`); // removing the extra </div> on line 114, because <main> was directly inside .auth-wrapper. Let's check parser.
// Actually, let's just write a clean repair function using the parser, or manually fix just the tags.

fs.writeFileSync('backend/public/index.html', html);
