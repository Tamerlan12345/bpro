document.addEventListener('DOMContentLoaded', () => {

    const API_URL = '/api/generate';

    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null; // To store the final audio blob
    let rerecordCount = 0; // To count re-record attempts
    let suggestions = [];
    let panZoomState = {
        scale: 1,
        pX: 0,
        pY: 0,
        isDragging: false
    };
    let timerInterval;
    let secondsRecorded = 0;
    let transcriptionTimerInterval;
    let sessionUser = null; // Holds the logged-in user's session data
    let selectedDepartment = null; // Holds the department a user selects to work in
    let chatId = null;
    let chatVersions = []; // Store versions to avoid re-fetching
    let currentEditingNodeId = null; // For Node Editor
    let currentEditingEdgeId = null; // For Edge Context Menu (index or key)


    const authWrapper = document.querySelector('.auth-wrapper');
    const loginContainer = document.getElementById('login-container');
    const userLogin = document.getElementById('user-login');
    const userNameInput = document.getElementById('user-name');
    const userPasswordInput = document.getElementById('user-password');
    const userLoginBtn = document.getElementById('user-login-btn');
    const userError = document.getElementById('user-error');
    const departmentSelection = document.getElementById('department-selection');
    const departmentSelectionContainer = document.getElementById('department-selection-container');
    const departmentSelectionError = document.getElementById('department-selection-error');
    const chatLogin = document.getElementById('chat-login');
    const chatSelectionContainer = document.getElementById('chat-selection-container');
    const chatPasswordInput = document.getElementById('chat-password');
    const chatLoginBtn = document.getElementById('chat-login-btn');
    const chatError = document.getElementById('chat-error');
    const logoutBtn = document.getElementById('logout-btn');

    const mainContainer = document.querySelector('.container');
    const chatNameHeader = document.getElementById('chat-name-header');
    const processDescriptionInput = document.getElementById('process-description');
    const improveBtn = document.getElementById('improve-btn');
    const startRecordBtn = document.getElementById('start-record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const listenBtn = document.getElementById('listen-btn');
    const processBtn = document.getElementById('process-btn');
    const rerecordBtn = document.getElementById('rerecord-btn');
    const audioPlayback = document.getElementById('audio-playback');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingTimer = document.getElementById('recording-timer');
    const transcriptionDisplay = document.getElementById('transcription-display');
    const transcriptionTimer = document.getElementById('transcription-timer');
    const partialTranscriptDisplay = document.getElementById('partial-transcript-display');
    const versionHistoryContainer = document.getElementById('version-history-container');
    const commentsContainer = document.getElementById('comments-container');
    const commentInput = document.getElementById('comment-input');
    const addCommentBtn = document.getElementById('add-comment-btn');
    const stepCounter = document.getElementById('step-counter');
    const userPromptInput = document.getElementById('user-prompt');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const suggestionsControls = document.getElementById('suggestions-controls');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectionCounter = document.getElementById('selection-counter');
    const applyImprovementsBtn = document.getElementById('apply-improvements-btn');
    const diagramPlaceholder = document.getElementById('diagram-placeholder');
    const placeholderContent = document.querySelector('.placeholder-content');
    const renderDiagramBtn = document.getElementById('render-diagram-btn');
    const regenerateDiagramBtn = document.getElementById('regenerate-diagram-btn');
    const diagramContainer = document.getElementById('diagram-container');
    const diagramToolbar = document.getElementById('diagram-toolbar');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const resultsBlock = document.querySelector('.results-block');
    const actionButtons = document.getElementById('action-buttons');
    const saveVersionBtn = document.getElementById('save-version-btn');
    const saveRawVersionBtn = document.getElementById('save-raw-version-btn');
    const sendReviewBtn = document.getElementById('send-review-btn');
    const sendRevisionBtn = document.getElementById('send-revision-btn');
    const completeBtn = document.getElementById('complete-btn');
    const archiveBtn = document.getElementById('archive-btn');

    const adminPanel = document.getElementById('admin-panel');
    const backToAdminBtn = document.getElementById('back-to-admin-btn');
    const userForNewDepartmentSelect = document.getElementById('user-for-new-department');
    const newDepartmentNameInput = document.getElementById('new-department-name');
    const newDepartmentPasswordInput = document.getElementById('new-department-password');
    const createDepartmentBtn = document.getElementById('create-department-btn');
    const departmentList = document.getElementById('department-list');
    const chatList = document.getElementById('chat-list');
    const chatListHeader = document.getElementById('chat-list-header');
    const selectedDepartmentNameSpan = document.getElementById('selected-department-name');
    const createChatForm = document.getElementById('create-chat-form');
    const newChatNameInput = document.getElementById('new-chat-name');
    const newChatPasswordInput = document.getElementById('new-chat-password');
    const createChatBtn = document.getElementById('create-chat-btn');
    const inReviewList = document.getElementById('in-review-list');
    const pendingList = document.getElementById('pending-list');
    const completedList = document.getElementById('completed-list');
    const inReviewTab = document.getElementById('in-review-tab');
    const pendingTab = document.getElementById('pending-tab');
    const completedTab = document.getElementById('completed-tab');

    const transcriptionReviewModal = document.getElementById('transcription-review-modal');
    const transcriptionTextArea = document.getElementById('transcription-text-area');
    const saveTranscriptionProgressBtn = document.getElementById('save-transcription-progress-btn');
    const finalizeTranscriptionBtn = document.getElementById('finalize-transcription-btn');
    const transcriptionModalButtons = document.getElementById('transcription-modal-buttons');
    const transcriptionFinalizedView = document.getElementById('transcription-finalized-view');
    const finalizedTextDisplay = transcriptionReviewModal.querySelector('.finalized-text-display');
    const closeTranscriptionModalBtn = transcriptionReviewModal.querySelector('.close-btn');

    // Split View Elements
    const editDiagramBtn = document.getElementById('edit-diagram-btn');
    const splitViewContainer = document.getElementById('split-view-container');
    const splitViewTextarea = document.getElementById('split-view-textarea');
    const splitViewPreview = document.getElementById('split-view-preview');
    const saveSplitViewBtn = document.getElementById('save-split-view-btn');
    const closeSplitViewBtn = document.getElementById('close-split-view-btn');


    const notificationContainer = document.getElementById('notification-container');

    // Panel Toggles
    const leftPanelToggle = document.getElementById('left-panel-toggle');
    const rightPanelToggle = document.getElementById('right-panel-toggle');
    const leftColumn = document.querySelector('.left-column');
    const rightColumn = document.querySelector('.right-column');

    // Editor Popovers
    const nodeEditorPopover = document.getElementById('node-editor-popover');
    const nodeEditorText = document.getElementById('node-editor-text');
    const nodeEditorShape = document.getElementById('node-editor-shape');
    const nodeEditorPadding = document.getElementById('node-editor-padding');
    const nodeEditorSave = document.getElementById('node-editor-save');
    const nodeEditorCancel = document.getElementById('node-editor-cancel');

    const edgeContextMenu = document.getElementById('edge-context-menu');
    const edgeReverse = document.getElementById('edge-reverse');
    const edgeStyle = document.getElementById('edge-style');
    const edgeText = document.getElementById('edge-text');
    const edgeDelete = document.getElementById('edge-delete');


    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    async function fetchWithAuth(url, options = {}) {
        const finalOptions = { ...options, credentials: 'include' };
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP Error: ${response.status} ${response.statusText}` }));
            throw new Error(errorData.error || 'An unknown network error occurred.');
        }
        return response;
    }

    function setButtonLoading(button, isLoading, loadingText = 'Загрузка...') {
        if (!button) return;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.disabled = isLoading;
        button.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : button.dataset.originalText;
    }


    mermaid.initialize({ startOnLoad: false, theme: 'base', fontFamily: 'inherit', flowchart: { nodeSpacing: 50, rankSpacing: 60, curve: 'stepBefore' }, themeVariables: { primaryColor: '#FFFFFF', primaryTextColor: '#212529', primaryBorderColor: '#333333', lineColor: '#333333' } });

    function updateTransform() {
        const svg = diagramContainer.querySelector('svg');
        if (svg) {
            svg.style.transform = `translate(${panZoomState.pX}px, ${panZoomState.pY}px) scale(${panZoomState.scale})`;
        }
    }

    // --- Interactive Editing Logic ---

    function setupDiagramInteractions() {
        // Node Interaction
        const nodes = diagramContainer.querySelectorAll('.node');
        nodes.forEach(node => {
            node.addEventListener('click', (e) => {
                // Ignore click if it was part of a drag operation
                if (panZoomState.wasDragging) return;

                e.stopPropagation(); // Stop bubbling to container (pan)

                // Extract Node ID (Mermaid usually sets id="flowchart-A-...")
                // We need to match this ID to the code.
                // Mermaid IDs often look like "flowchart-nodeId-..."
                let rawId = node.id;
                // Try to extract the simple ID used in code (e.g., 'A' from 'flowchart-A-234')
                // This depends heavily on Mermaid version.
                // Alternative: Look for the text content and search in code, but ID is safer.
                // Mermaid 10+ usually puts the ID in data-id or id.
                // Let's try to get the 'data-id' attribute if it exists, or parse the ID.
                // Actually, for Mermaid 10, the id attribute is often complex.
                // But the element usually has a class like "node default" or "node".

                // Let's assume we can map it back or just use the text content for now if ID is hard.
                // Wait, the plan said "Programmer must write a parser".

                // Strategy: Store the clicked node element and try to find its definition in the mermaid code.
                // We'll open the editor popover.

                // Position popover near the node
                const rect = node.getBoundingClientRect();
                openNodeEditor(node, rect.left, rect.bottom);
            });
        });

        // Edge Interaction
        const edges = diagramContainer.querySelectorAll('.edgePath');
        edges.forEach(edge => {
            edge.addEventListener('click', (e) => {
                if (panZoomState.wasDragging) return;
                e.stopPropagation();
                openEdgeMenu(edge, e.clientX, e.clientY);
            });
        });
    }

    function openNodeEditor(nodeElement, x, y) {
        // 1. Identify the node in the source code.
        // We'll use the text content of the node to find it in the mermaid code.
        // This is heuristic but often works.
        // A better way is finding the ID.
        // nodeElement.id usually starts with "flowchart-{ID}-"

        let nodeId = null;
        const idMatch = nodeElement.id.match(/^flowchart-([^-]+)-/);
        if (idMatch) {
            nodeId = idMatch[1];
        }

        // Get current text from the node
        // The text is inside a <foreignObject> or <text> inside the node group
        const textEl = nodeElement.querySelector('.nodeLabel');
        const currentText = textEl ? textEl.innerText.trim() : "";

        currentEditingNodeId = nodeId;
        nodeEditorText.value = currentText;

        // Try to guess shape from code? Or just default to rect.
        // We can check the class of the shape inside the node (rect, circle, polygon, path)
        let shape = 'rect';
        if (nodeElement.querySelector('circle')) shape = 'rounded'; // simplified guess
        if (nodeElement.querySelector('polygon')) shape = 'diamond';
        if (nodeElement.querySelector('path')) shape = 'database'; // cylinder is path usually

        nodeEditorShape.value = shape;
        nodeEditorPadding.value = 0; // Default

        // Show Popover
        nodeEditorPopover.style.display = 'block';

        // Adjust position to keep on screen
        const popoverWidth = 300;
        let left = x;
        let top = y + 10;

        if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - 20;
        if (top + 300 > window.innerHeight) top = y - 300; // Show above if too low

        nodeEditorPopover.style.left = `${left}px`;
        nodeEditorPopover.style.top = `${top}px`;

        // Close edge menu if open
        edgeContextMenu.style.display = 'none';
    }

    function closeNodeEditor() {
        nodeEditorPopover.style.display = 'none';
        currentEditingNodeId = null;
    }

    function openEdgeMenu(edgeElement, x, y) {
        // We need to identify the edge.
        // Mermaid edges often have classes like "L-A-B-0" which means Link from A to B.
        // Let's try to parse the class list.
        let sourceId = null;
        let targetId = null;

        edgeElement.classList.forEach(cls => {
            if (cls.startsWith('LS-')) {
                 sourceId = cls.replace('LS-', '');
            }
            if (cls.startsWith('LE-')) {
                 targetId = cls.replace('LE-', '');
            }
        });

        // Fallback: Mermaid 10 might use different classes.
        // If we can't find IDs, we can't edit.
        // But let's assume we can find them.

        if (!sourceId || !targetId) {
            // Try extracting from ID if it follows a pattern?
            console.warn("Could not identify edge source/target");
            return;
        }

        currentEditingEdgeId = { source: sourceId, target: targetId };

        edgeContextMenu.style.display = 'block';
        edgeContextMenu.style.left = `${x}px`;
        edgeContextMenu.style.top = `${y}px`;

        // Close node editor
        nodeEditorPopover.style.display = 'none';
    }

    function closeEdgeMenu() {
        edgeContextMenu.style.display = 'none';
        currentEditingEdgeId = null;
    }

    // --- Mermaid Code Modification Helpers ---

    function updateMermaidCode(action) {
        // Get current code
        // We can get it from the split view textarea OR from the latest version in memory
        // But for consistency, let's use what's likely displayed.
        // If split view is open, use that. If not, use chatVersions[0].mermaid_code.
        let code = '';
        if (splitViewContainer.style.display !== 'none') {
            code = splitViewTextarea.value;
        } else if (chatVersions.length > 0) {
            code = chatVersions[0].mermaid_code;
        } else {
            return;
        }

        const lines = code.split('\n');
        let newLines = [];
        let modified = false;

        // ACTION: Update Node
        if (action.type === 'updateNode') {
            const { id, text, shape, padding } = action.payload;
            // Regex to find node definition: id["text"] or id{"text"} etc.
            // We need to handle:
            // A["Text"]
            // A{"Text"}
            // A

            // Build the new wrapper based on shape
            let openChar = '[';
            let closeChar = ']';
            if (shape === 'rounded') { openChar = '('; closeChar = ')'; }
            else if (shape === 'diamond') { openChar = '{'; closeChar = '}'; }
            else if (shape === 'database') { openChar = '[('; closeChar = ')]'; }

            // Add padding (spaces)
            let paddedText = text;
            if (padding > 0) {
                const spaces = "&nbsp;".repeat(padding * 2); // Use HTML spaceentity or just spaces if Mermaid supports it well.
                // Mermaid supports HTML codes.
                paddedText = `${spaces}${text}${spaces}`;
            }

            // Replace logic
            // We iterate lines to find definition of this ID
            // Regex: ^\s*ID\s*(\[|\(|\{>|\[\(|\(\()...

            const regex = new RegExp(`^(\\s*${id})\\s*([\\(\\[\\{\\>]+)(.*)([\\)\\]\\}\\>]+)`, 'i');

            let found = false;
            newLines = lines.map(line => {
                if (regex.test(line)) {
                     found = true;
                     modified = true;
                     // Reconstruct line
                     // Keep indentation (group 1 includes ID)
                     // Replace brackets and text
                     // We need to be careful not to destroy text if we only want to change shape,
                     // but here we change both text and shape.
                     // The text is in group 3, but might contain quotes.

                     // Simply: ID + open + "text" + close
                     return `${id}${openChar}"${paddedText}"${closeChar}`;
                }
                return line;
            });

            // If not found, maybe it's just defined as "A --> B"?
            // If so, we should append a definition line at the end or replace an occurrence in a link?
            // Mermaid allows defining node inline: A[Text] --> B
            // This is harder to parse.
            // For MVP, let's assume definitions are on their own lines or we append a style class.
            // If not found, append it?
            if (!found) {
                // Check for inline usage
                // This is complex. Let's just add a specific definition line at the top (after graph TD)
                // Mermaid allows re-definition which overrides? No, it merges.
                // So adding A["New Text"] at the end might work to update label!
                newLines.push(`${id}${openChar}"${paddedText}"${closeChar}`);
                modified = true;
            }
        }

        // ACTION: Reverse Edge
        if (action.type === 'reverseEdge') {
            const { source, target } = action.payload;
            // Find line with Source ... Target
            // A --> B
            // Regex: Source\s*(-.|==.)+>*\s*Target

            newLines = lines.map(line => {
                if (line.includes(source) && line.includes(target)) {
                    // Check order
                    if (line.indexOf(source) < line.indexOf(target)) {
                         // Found A -> B
                         // We need to reverse it to B -> A
                         // Extract the arrow type?
                         // Simple replace
                         // Warning: This assumes one edge per line for simplicity
                         if (line.includes('-->')) {
                             modified = true;
                             return line.replace(`${source} --> ${target}`, `${target} --> ${source}`);
                         }
                         if (line.includes('-.->')) {
                             modified = true;
                             return line.replace(`${source} -.-> ${target}`, `${target} -.-> ${source}`);
                         }
                    }
                }
                return line;
            });
        }

        // ACTION: Delete Edge
        if (action.type === 'deleteEdge') {
            const { source, target } = action.payload;
             newLines = lines.filter(line => {
                // If line contains A --> B, remove it.
                // Be careful not to remove "A --> B --> C" completely if only A->B is deleted?
                // For MVP, remove the line if it matches the link.
                const isMatch = (line.includes(`${source} --> ${target}`) || line.includes(`${source} -.-> ${target}`));
                if (isMatch) modified = true;
                return !isMatch;
            });
        }

        // ACTION: Change Edge Style
         if (action.type === 'changeEdgeStyle') {
            const { source, target } = action.payload;
             newLines = lines.map(line => {
                if (line.includes(source) && line.includes(target)) {
                    // Toggle --> and -.->
                    if (line.includes('-->')) {
                        modified = true;
                        return line.replace('-->', '-.->');
                    } else if (line.includes('-.->')) {
                        modified = true;
                        return line.replace('-.->', '-->');
                    }
                }
                return line;
            });
        }

        // ACTION: Add Edge Text
        if (action.type === 'addEdgeText') {
             const { source, target } = action.payload;
             const text = prompt("Введите текст для стрелки:");
             if (text) {
                 newLines = lines.map(line => {
                    if (line.includes(`${source} --> ${target}`)) {
                        modified = true;
                        return line.replace(`${source} --> ${target}`, `${source} -- "${text}" --> ${target}`);
                    }
                     // Handle existing text? Replace it?
                    if (line.match(new RegExp(`${source}.*--.*-->.*${target}`))) {
                         // Already has text, replace it
                         // regex replace is harder here.
                         // Simplest: Replace the whole segment
                    }
                    return line;
                });

                if (!modified) {
                    // Maybe it was dotted?
                     newLines = lines.map(line => {
                        if (line.includes(`${source} -.-> ${target}`)) {
                            modified = true;
                            return line.replace(`${source} -.-> ${target}`, `${source} -. "${text}" .-> ${target}`);
                        }
                        return line;
                    });
                }
             }
        }


        if (modified) {
            const newCode = newLines.join('\n');
            // Update UI
            if (splitViewContainer.style.display !== 'none') {
                splitViewTextarea.value = newCode;
                handleSplitViewInput(); // Trigger render
            } else {
                // If not in split view, we need to update the diagram directly
                // AND ideally save it as a draft or update the 'latest' version in memory?
                // The requirement says: "visual changes should programmatically change source code and redraw".
                // We should assume this updates the "current" working copy.
                // We can use renderDiagram(newCode)
                // And update the textarea (if visible, but it's hidden)
                // We should definitely update processDescriptionInput? No, that's text description.
                // We update chatVersions[0].mermaid_code?
                if (chatVersions.length > 0) {
                    chatVersions[0].mermaid_code = newCode;
                }
                renderDiagram(newCode);

                // Show a toast that changes are local until saved?
                showNotification("Изменения применены. Не забудьте сохранить версию!", "warning");
            }
        } else {
             showNotification("Не удалось найти элемент в коде для изменения.", "error");
        }
    }

    // --- Editor Event Listeners ---

    nodeEditorSave.addEventListener('click', () => {
        if (!currentEditingNodeId) return;
        updateMermaidCode({
            type: 'updateNode',
            payload: {
                id: currentEditingNodeId,
                text: nodeEditorText.value,
                shape: nodeEditorShape.value,
                padding: nodeEditorPadding.value
            }
        });
        closeNodeEditor();
    });

    nodeEditorCancel.addEventListener('click', closeNodeEditor);

    edgeReverse.addEventListener('click', () => {
        if (currentEditingEdgeId) {
            updateMermaidCode({ type: 'reverseEdge', payload: currentEditingEdgeId });
            closeEdgeMenu();
        }
    });

    edgeDelete.addEventListener('click', () => {
        if (currentEditingEdgeId) {
            updateMermaidCode({ type: 'deleteEdge', payload: currentEditingEdgeId });
            closeEdgeMenu();
        }
    });

    edgeStyle.addEventListener('click', () => {
         if (currentEditingEdgeId) {
            updateMermaidCode({ type: 'changeEdgeStyle', payload: currentEditingEdgeId });
            closeEdgeMenu();
        }
    });

    edgeText.addEventListener('click', () => {
        if (currentEditingEdgeId) {
            updateMermaidCode({ type: 'addEdgeText', payload: currentEditingEdgeId });
            closeEdgeMenu();
        }
    });

    // Close popovers on click outside
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.editor-popover') && !e.target.closest('.node')) {
            closeNodeEditor();
        }
        if (!e.target.closest('.edge-menu') && !e.target.closest('.edgePath')) {
            closeEdgeMenu();
        }
    });


    // --- Existing Functions (Modified where needed) ---

    // Draggable Nodes Logic (Visual Only)
    function enableDraggableNodes(container) {
        const svg = container.querySelector('svg');
        if (!svg) return;

        const nodes = svg.querySelectorAll('.node');
        let draggedNode = null;
        let startX, startY;
        let initialTransform = '';
        let hasWarned = false;

        nodes.forEach(node => {
            node.addEventListener('mousedown', (e) => {
                // Prevent drag if ctrl key is pressed (pan mode)
                if (e.ctrlKey) return;

                // Use Left Click for dragging nodes visually

                e.stopPropagation();
                e.preventDefault();

                if (!hasWarned) {
                    showNotification("Внимание: Перемещение узлов сбрасывается при регенерации.", "warning");
                    hasWarned = true;
                }

                draggedNode = node;
                // Get current transform or default
                const transform = node.getAttribute('transform');
                initialTransform = transform || '';

                // Need to account for zoom level
                startX = e.clientX;
                startY = e.clientY;

                // Track that we are dragging, to prevent click event on mouseup
                panZoomState.wasDragging = false;

                node.classList.add('dragging');
            });
        });

        svg.addEventListener('mousemove', (e) => {
            if (!draggedNode) return;
            e.preventDefault();

            panZoomState.wasDragging = true; // We moved, so it's a drag

            const dx = (e.clientX - startX) / panZoomState.scale;
            const dy = (e.clientY - startY) / panZoomState.scale;

            let currentX = 0;
            let currentY = 0;
            const translateMatch = initialTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (translateMatch) {
                currentX = parseFloat(translateMatch[1]);
                currentY = parseFloat(translateMatch[2]);
            }

            const newX = currentX + dx;
            const newY = currentY + dy;

            draggedNode.setAttribute('transform', `translate(${newX}, ${newY})`);
        });

        svg.addEventListener('mouseup', () => {
            if (draggedNode) {
                draggedNode.classList.remove('dragging');
                draggedNode = null;
                // Reset flag after a short delay to allow click handler to check it
                setTimeout(() => { panZoomState.wasDragging = false; }, 100);
            }
        });

        svg.addEventListener('mouseleave', () => {
             if (draggedNode) {
                draggedNode.classList.remove('dragging');
                draggedNode = null;
            }
        });
    }

    async function renderDiagram(mermaidCode, container = diagramContainer, isRetry = false) {
        // container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        // Removing innerHTML loading spinner because it causes flashes during frequent updates.
        // Maybe just an overlay?

        try {
            // The mermaid.render function is the modern, preferred way.
            const { svg } = await mermaid.render(`mermaid-graph-${Date.now()}`, mermaidCode);
            container.innerHTML = svg;

            // Post-render logic only for the main diagram container
            if (container === diagramContainer) {
                const svgElement = container.querySelector('svg');
                if (svgElement) {
                    svgElement.style.maxWidth = '100%';

                    // KEEP PAN/ZOOM State if it exists!
                    // If we reset every time, editing is painful.
                    // panZoomState = { scale: 1, pX: 0, pY: 0, isDragging: false };
                    // Only reset if it's the very first load?
                    if (panZoomState.scale === 1 && panZoomState.pX === 0 && panZoomState.pY === 0) {
                         // Maybe center it initially?
                    }

                    updateTransform();

                    diagramToolbar.style.display = 'flex';
                    renderDiagramBtn.style.display = 'none';
                    regenerateDiagramBtn.disabled = false;

                    if (sessionUser && sessionUser.role === 'admin') {
                        editDiagramBtn.style.display = 'inline-block';
                    }

                    enableDraggableNodes(container);
                    setupDiagramInteractions(); // Add click listeners
                }
            } else if (container === splitViewPreview) {
                 const svgElement = container.querySelector('svg');
                 if(svgElement) {
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                 }
            }

        } catch (error) {
            console.error("Mermaid render error:", error);
            if (!isRetry) {
                console.log("Attempting to self-correct the diagram code...");
                try {
                    const fixedCode = await getFixedMermaidCode(mermaidCode, error.message);
                    showNotification("AI исправило ошибку в схеме. Повторный рендеринг...", "success");
                    await renderDiagram(fixedCode, container, true);
                } catch (fixError) {
                    console.error("Failed to get fixed mermaid code:", fixError);
                    container.innerHTML = `<div class="error-text">Не удалось исправить и отобразить схему: ${fixError.message}</div>`;
                }
            } else {
                container.innerHTML = `<div class="error-text">Ошибка рендеринга даже после исправления: ${error.message}</div>`;
            }
        }
    }

    let mermaidRenderTimeout;
    function handleSplitViewInput() {
        clearTimeout(mermaidRenderTimeout);
        mermaidRenderTimeout = setTimeout(() => {
            const code = splitViewTextarea.value;
            renderDiagram(code, splitViewPreview);
        }, 300); // Debounce for 300ms
    }

    function toggleSplitView() {
        const latestVersion = chatVersions[0];
        // If we have edited code in memory (unsaved), we should use it?
        // But for now, chatVersions is the source of truth for saved state.
        // If user made edits using visual editor, renderDiagram updated the view but maybe not saved to DB.
        // We should handle that.

        let initialCode = latestVersion ? latestVersion.mermaid_code : "";
        // If diagram container has code? No, we don't store it there.

        if (splitViewContainer.style.display === 'none') {
            splitViewTextarea.value = initialCode;
            splitViewContainer.style.display = 'flex';
            diagramPlaceholder.style.display = 'none'; // Hide main placeholder/canvas
            renderDiagram(initialCode, splitViewPreview);
            // Hide panels for better focus
            collapsePanels(true);
        } else {
            closeSplitView();
        }
    }

    function closeSplitView() {
        splitViewContainer.style.display = 'none';
        diagramPlaceholder.style.display = 'flex'; // Show main canvas back
        // Restore panels
        collapsePanels(false);
    }

    function collapsePanels(collapse) {
        if (collapse) {
            leftColumn.classList.add('panel-hidden-left');
            leftPanelToggle.classList.add('collapsed');
            leftPanelToggle.textContent = '>>';

            rightColumn.classList.add('panel-hidden-right');
            rightPanelToggle.classList.add('collapsed');
            rightPanelToggle.textContent = '<<';
        } else {
            leftColumn.classList.remove('panel-hidden-left');
            leftPanelToggle.classList.remove('collapsed');
            leftPanelToggle.textContent = '<<';

            rightColumn.classList.remove('panel-hidden-right');
            rightPanelToggle.classList.remove('collapsed');
            rightPanelToggle.textContent = '>>';
        }
    }

    async function handleSaveSplitViewChanges() {
        const mermaid_code = splitViewTextarea.value;
        const process_text = processDescriptionInput.value; // Keep the existing text description

        setButtonLoading(saveSplitViewBtn, true, 'Сохранение...');
        try {
            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text, mermaid_code })
            });
            showNotification("Изменения в схеме успешно сохранены.", "success");
            await loadChatData();
            closeSplitView();
        } catch (error) {
            showNotification(`Ошибка сохранения схемы: ${error.message}`, "error");
        } finally {
            setButtonLoading(saveSplitViewBtn, false);
        }
    }


    function downloadDiagram(format) {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) {
            showNotification("Сначала сгенерируйте схему.", "warning");
            return;
        }
        if (format === 'svg') {
            const svgHeader = '<?xml version="1.0" standalone="no"?>\r\n';
            const svgData = svgHeader + new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'process-diagram.svg';
            link.click();
            URL.revokeObjectURL(url);
        } else if (format === 'png') {
            html2canvas(svgElement, { backgroundColor: null }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'process-diagram.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    }


    async function callGeminiAPI(prompt) {
        const response = await fetchWithAuth(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error('Invalid API response structure from Google');
        }
        return data.candidates[0].content.parts[0].text;
    }

    async function generateProcessArtifacts(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик. Твоя задача — взять сырое описание процесса от пользователя и превратить его в два артефакта:
1.  Структурированное описание шагов бизнес-процесса в формате Markdown.
2.  Код для диаграммы flowchart TD на языке Mermaid.js.

Ты должен СТРОГО следовать этим правилам:

### ПРАВИЛА ДЛЯ ТЕКСТОВОГО ОПИСАНИЯ:
Используй следующий шаблон Markdown, додумывая недостающие детали на основе контекста:

\`\`\`markdown
### 4. Начальное событие (Триггер):
[Что запускает процесс]

### 5. Пошаговое описание процесса:
* **Шаг [Номер]. [Название шага]**
    * **Действие:** [Описание действия]
    * **Исполнитель:** [Роль, если можно определить из контекста]
    * **Условия/Переход:** [Описание логики перехода или ветвления]

### 6. Завершающее событие и результаты:
[Чем заканчивается процесс и какие у него исходы]
\`\`\`

**ВАЖНО:** Если во входных данных присутствует секция \`### Предложения по улучшению:\`, ты должен использовать перечисленные в ней пункты как прямое руководство для улучшения и переписывания основного описания процесса. Интегрируй эти улучшения в итоговый \`standardDescription\`. Саму секцию \`### Предложения по улучшению:\` в свой финальный ответ включать НЕ НУЖНО.

### ПРАВИЛА ДЛЯ MERMAID-КОДА:
СИНТАКСИС И СТИЛЬ:
- **Направление:** Всегда используй 'flowchart TD'.
- **Линии:** Все связи должны быть ПРЯМЫМИ. Используй \`-->\` для всех связей. Не используй другие типы стрелок.
- **Экранирование:** Внутри текстовых меток все специальные символы, особенно кавычки, должны быть экранированы с помощью HTML-кодов. Например, для кавычки (") используй #quot;.

ФИГУРЫ:
- ПРЯМОУГОЛЬНИК \`id["Текст"]\`: Для стандартных действий.
- РОМБ \`id{"Текст"}\`: ТОЛЬКО для решений и условий (если, проверить, да/нет).
- ЦИЛИНДР \`id[("Текст")]\`: Для баз данных, CRM, хранилищ.
- ДОКУМЕНТ \`id>Текст]\`: Для отчетов, счетов, заявок.

**КЛЮЧЕВОЕ ПРАВИЛО СТРОК:** Весь текст внутри фигур (внутри \`""\`, \`{}\`, \`()\`, \`>\`) ДОЛЖЕН быть заключен в стандартные двойные кавычки ASCII (\`"\`). Это самое важное правило. Пример: \`A["Это валидный текст"]\`.

**СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ СУЩНОСТЕЙ:**
- Если в тексте упоминаются "КИАС", "БД", "CRM", "база данных" или любая другая "система", используй для них фигуру **ЦИЛИНДР**.

СТИЛИЗАЦИЯ: Обязательно добавляй стили для ромбов, цилиндров и документов в конце кода.


ФОРМАТ ОТВЕТА:
Твой ответ должен быть JSON-объектом и ТОЛЬКО им. Никаких объяснений. Структура должна быть следующей:
{
"standardDescription": "...", // Здесь Markdown-текст
"mermaidCode": "..." // Здесь Mermaid-код
}

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt).then(response => {
            // AI responses can sometimes include markdown wrappers. Find the JSON block.
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Invalid response from AI, no JSON object found. Raw response:", response);
                throw new Error("Не удалось получить корректный JSON-объект от AI.");
            }
            try {
                // Parse the extracted JSON string.
                return JSON.parse(jsonMatch[0]);
            } catch (error) {
                console.error("Failed to parse JSON from AI response. Raw JSON string:", jsonMatch[0], "Error:", error);
                throw new Error("Ошибка парсинга JSON ответа от AI.");
            }
        });
    }

    async function getFixedMermaidCode(brokenCode, errorMessage) {
        const prompt = `Ты — эксперт по Mermaid.js. Тебе дали код с ошибкой. Твоя задача — ИСПРАВИТЬ ЕГО.

НЕИСПРАВНЫЙ КОД:
\`\`\`
${brokenCode}
\`\`\`

СООБЩЕНИЕ ОБ ОШИБКЕ:
"${errorMessage}"

Проанализируй ошибку и верни ИСПРАВЛЕННЫЙ код. Убедись, что:
1.  Синтаксис 'flowchart TD' правильный.
2.  **Критически важно:** Весь текст внутри фигур заключен в стандартные двойные кавычки ASCII (\`"\`). Например, \`A["Текст"]\`.
3.  Все специальные символы внутри текстовых меток (например, другие кавычки) экранированы с помощью HTML-кодов (например, \`#quot;\`).
4.  Связи между элементами определены правильно и являются прямыми (\`A --> B\`).
5.  Если упоминается "КИАС" или "база данных", используется фигура-цилиндр.
6.  Нет лишних символов или опечаток.

Ответ должен содержать ТОЛЬКО ИСПРАВЛЕННЫЙ код Mermaid.js, без объяснений и markdown.`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }

    async function generateDiagramFromText(processDescription) {
        const prompt = `Ты — элитный бизнес-аналитик. Твоя задача — взять описание процесса от пользователя и превратить его в код для диаграммы flowchart TD на языке Mermaid.js.

Ты должен СТРОГО следовать этим правилам:

### ПРАВИЛА ДЛЯ MERMAID-КОДА:
СИНТАКСИС И СТИЛЬ:
- **Направление:** Всегда используй 'flowchart TD'.
- **Линии:** Все связи должны быть ПРЯМЫМИ. Используй \`-->\` для всех связей. Не используй другие типы стрелок.
- **Экранирование:** Внутри текстовых меток все специальные символы, особенно кавычки, должны быть экранированы с помощью HTML-кодов. Например, для кавычки (") используй #quot;.

ФИГУРЫ:
- ПРЯМОУГОЛЬНИК \`id["Текст"]\`: Для стандартных действий.
- РОМБ \`id{"Текст"}\`: ТОЛЬКО для решений и условий (если, проверить, да/нет).
- ЦИЛИНДР \`id[("Текст")]\`: Для баз данных, CRM, хранилищ.
- ДОКУМЕНТ \`id>Текст]\`: Для отчетов, счетов, заявок.

**КЛЮЧЕВОЕ ПРАВИЛО СТРОК:** Весь текст внутри фигур (внутри \`""\`, \`{}\`, \`()\`, \`>\`) ДОЛЖЕН быть заключен в стандартные двойные кавычки ASCII (\`"\`). Это самое важное правило. Пример: \`A["Это валидный текст"]\`.

**СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ СУЩНОСТЕЙ:**
- Если в тексте упоминаются "КИАС", "БД", "CRM", "база данных" или любая другая "система", используй для них фигуру **ЦИЛИНДР**.

СТИЛИЗАЦИЯ: Обязательно добавляй стили для ромбов, цилиндров и документов в конце кода.

ФОРМАТ ОТВЕТА:
Твой ответ должен содержать ТОЛЬКО код Mermaid.js, без объяснений и markdown.

ИСХОДНЫЙ ПРОЦЕСС ОТ ПОЛЬЗОВАТЕЛЯ:
"${processDescription}"`;
        return callGeminiAPI(prompt).then(code => code.replace(/```mermaid/g, '').replace(/```/g, '').trim());
    }


    async function handleLogout() {
        try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed, but reloading anyway.', error);
        } finally {
            // Force a full reload to clear all state
            window.location.href = window.location.pathname;
        }
    }

    async function handleUserLogin() {
        const name = userNameInput.value;
        const password = userPasswordInput.value;
        if (!name || !password) return;

        setButtonLoading(userLoginBtn, true, 'Вход...');
        try {
            const response = await fetchWithAuth('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const user = await response.json();
            sessionUser = user;
            userError.textContent = '';
            logoutBtn.style.display = 'block';

            if (sessionUser.role === 'admin') {
                loginContainer.style.display = 'none';
                adminPanel.style.display = 'block';
                await loadAdminPanel();
            } else {
                userLogin.style.display = 'none';
                departmentSelection.style.display = 'block';
                await loadDepartmentsForSelection();
            }
        } catch (error) {
            userError.textContent = `Ошибка входа: ${error.message}`;
        } finally {
            setButtonLoading(userLoginBtn, false);
        }
    }

    async function loadDepartmentsForSelection() {
        try {
            const response = await fetchWithAuth('/api/departments');
            const departments = await response.json();
            if (departments.length === 0) {
                departmentSelectionContainer.innerHTML = '<p class="placeholder-text">Для вас не назначено ни одного департамента.</p>';
                return;
            }
            departmentSelectionContainer.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span class="dept-icon">🏢</span>
                    <span class="dept-name">${dept.name}</span>
                </div>
            `).join('');
        } catch (error) {
            departmentSelectionError.textContent = `Не удалось загрузить департаменты: ${error.message}`;
        }
    }

    function handleDepartmentCardSelection(e) {
        const card = e.target.closest('.department-card');
        if (!card) return;
        selectedDepartment = {
            id: card.dataset.deptId,
            name: card.dataset.deptName
        };
        departmentSelection.style.display = 'none';
        chatLogin.style.display = 'block';
        loadChats(selectedDepartment.id);
    }

    async function loadChats(deptId) {
        chatSelectionContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            const response = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
            const allChats = await response.json();
            const activeChats = allChats.filter(chat => {
                const status = chat.status || 'draft';
                return status !== 'completed' && status !== 'archived';
            });

            if (activeChats.length === 0) {
                chatSelectionContainer.innerHTML = '<p class="placeholder-text">Для этого департамента нет активных чатов.</p>';
                return;
            }

            chatSelectionContainer.innerHTML = activeChats.map(chat => `
                <div class="chat-card" data-chat-id="${chat.id}" data-chat-name="${chat.name}">
                    <span class="chat-icon">💬</span>
                    <span class="chat-name">${chat.name}</span>
                    <div class="chat-status">${getStatusIndicator(chat.status || 'draft')}</div>
                </div>
            `).join('');

            document.querySelectorAll('.chat-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
        } catch (error) {
            chatError.textContent = `Не удалось загрузить чаты: ${error.message}`;
        }
    }

    async function handleChatLogin() {
        const selectedChatCard = document.querySelector('.chat-card.selected');
        if (!selectedChatCard) {
            chatError.textContent = 'Пожалуйста, выберите чат';
            return;
        }

        const password = chatPasswordInput.value;
        if (!password) {
            chatError.textContent = 'Пожалуйста, введите пароль';
            return;
        }

        setButtonLoading(chatLoginBtn, true, 'Вход...');
        try {
            const response = await fetchWithAuth('/api/auth/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department_id: selectedDepartment.id,
                    name: selectedChatCard.dataset.chatName,
                    password
                })
            });
            const chat = await response.json();
            chatId = chat.id;
            chatError.textContent = '';
            showMainApp(chat.name);
        } catch (error) {
            chatError.textContent = `Ошибка входа в чат: ${error.message}`;
        } finally {
            setButtonLoading(chatLoginBtn, false);
        }
    }

    function showMainApp(chatName) {
        authWrapper.style.display = 'none';
        mainContainer.style.display = 'block';
        chatNameHeader.textContent = `Чат: ${chatName}`;
        updateStepCounter();
        loadChatData();
    }

    async function checkSession() {
        try {
            const response = await fetchWithAuth('/api/auth/session');
            const data = await response.json();
            if (data.user) {
                sessionUser = data.user;
                logoutBtn.style.display = 'block';
                authWrapper.style.display = 'flex'; // Keep the wrapper visible
                if (sessionUser.role === 'admin') {
                    loginContainer.style.display = 'none';
                    adminPanel.style.display = 'block';
                    await loadAdminPanel();
                } else {
                    loginContainer.style.display = 'none';
                    userLogin.style.display = 'none';
                    departmentSelection.style.display = 'block';
                    await loadDepartmentsForSelection();
                }
            } else {
                authWrapper.style.display = 'flex';
                mainContainer.style.display = 'none';
                loginContainer.style.display = 'block';
                userLogin.style.display = 'block';
                departmentSelection.style.display = 'none';
                chatLogin.style.display = 'none';
                adminPanel.style.display = 'none';
            }
        } catch (error) {
            console.log('No active session found, showing login.');
            authWrapper.style.display = 'flex';
            mainContainer.style.display = 'none';
            loginContainer.style.display = 'block';
            userLogin.style.display = 'block';
            departmentSelection.style.display = 'none';
            chatLogin.style.display = 'none';
            adminPanel.style.display = 'none';
        }
    }


    async function loadChatData() {
        try {
            const [versionsResponse, commentsResponse, statusResponse, transcriptionResponse] = await Promise.all([
                fetchWithAuth(`/api/chats/${chatId}/versions`),
                fetchWithAuth(`/api/chats/${chatId}/comments`),
                fetchWithAuth(`/api/chats/${chatId}/status`),
                fetchWithAuth(`/api/chats/${chatId}/transcription`).catch(err => null) // Allow it to fail if no transcription exists
            ]);
            chatVersions = await versionsResponse.json();
            const comments = await commentsResponse.json();
            const { status } = await statusResponse.json();
            const transcriptionData = transcriptionResponse ? await transcriptionResponse.json() : null;

            renderVersions(chatVersions);
            renderComments(comments);

            if (transcriptionData && transcriptionData.status === 'finalized') {
                transcriptionDisplay.textContent = transcriptionData.final_text;
            }

            if (chatVersions.length > 0) {
                await displayVersion(chatVersions[0]);
            } else if (transcriptionData && transcriptionData.status === 'finalized') {
                // Otherwise, if no versions exist but a transcript does, use it as the initial value for Field 2
                processDescriptionInput.value = transcriptionData.final_text;
                updateStepCounter();
            } else {
                await displayVersion(null);
            }

            updateInterfaceForStatus(status, sessionUser.role);
        } catch (error) {
            showNotification(`Failed to load chat data: ${error.message}. Your session may have expired.`, 'error');
            setTimeout(() => window.location.reload(), 5000);
        }
    }

    function renderVersions(versions) {
        versionHistoryContainer.innerHTML = versions.map(v => `
            <div class="version-item" data-version-id="${v.id}">
                <span>Версия от ${new Date(v.created_at).toLocaleString()}</span>
                <button>Посмотреть</button>
            </div>`).join('') || '<p>Нет сохраненных версий.</p>';
    }

    async function displayVersion(version) {
        if (!version) {
            processDescriptionInput.value = '';
            updateStepCounter();
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block';
            return;
        }
        processDescriptionInput.value = version.process_text;
        updateStepCounter();
        if (version.mermaid_code && version.mermaid_code.trim() !== '') {
            placeholderContent.style.display = 'none';
            diagramContainer.style.display = 'flex';
            diagramContainer.innerHTML = '';
            await renderDiagram(version.mermaid_code);
        } else {
            placeholderContent.style.display = 'flex';
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
            diagramToolbar.style.display = 'none';
            renderDiagramBtn.style.display = 'block';
        }
    }

    function renderComments(comments) {
        commentsContainer.innerHTML = comments.map(c => `
            <div class="comment ${c.author_role}">
                <span class="comment-author">${c.author_role}</span>
                <p class="comment-text">${c.text}</p>
                <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
            </div>`).join('') || '<p>Нет комментариев.</p>';
    }

    async function handleSaveVersion(button = saveVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Нельзя сохранить пустую версию.", "error");
            return;
        }
        setButtonLoading(button, true, 'Сохранение с ИИ...');
        try {
            const result = await generateProcessArtifacts(process_text);
            const { standardDescription, mermaidCode } = result;

            if (!standardDescription || !mermaidCode) {
                throw new Error("Полученный от AI JSON не содержит обязательных полей standardDescription или mermaidCode.");
            }

            processDescriptionInput.value = standardDescription; // Update the text area

            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: standardDescription, mermaid_code: mermaidCode })
            });
            showNotification("Версия успешно сохранена.", "success");

            await loadChatData();
        } catch (error) {
            showNotification(`Ошибка сохранения: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleRenderDiagram(button) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Описание процесса пустое.", "error");
            return;
        }
        setButtonLoading(button, true, 'Создание схемы...');
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            if (mermaidCode) {
                placeholderContent.style.display = 'none';
                diagramContainer.style.display = 'flex';
                await renderDiagram(mermaidCode);
            }
        } catch (error) {
            showNotification(`Ошибка создания схемы: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleUpdateStatus(status, button) {
        if (!button) return;
        setButtonLoading(button, true, 'Обновление...');
        try {
            await handleSaveRawVersion();

            await fetchWithAuth(`/api/chats/${chatId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            showNotification(`Статус чата обновлен на: ${status}`, 'success');
            await loadChatData(); // Reload to reflect new status and UI state
        } catch (error) {
            showNotification(`Ошибка обновления статуса: ${error.message}`, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleAddComment() {
        const text = commentInput.value;
        if (!text.trim()) return;
        setButtonLoading(addCommentBtn, true, 'Отправка...');
        try {
            await fetchWithAuth(`/api/chats/${chatId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            commentInput.value = '';
            const response = await fetchWithAuth(`/api/chats/${chatId}/comments`);
            const comments = await response.json();
            renderComments(comments);
        } catch (error) {
            showNotification(`Failed to add comment: ${error.message}`, 'error');
        } finally {
            setButtonLoading(addCommentBtn, false);
        }
    }

    function updateInterfaceForStatus(status, userRole) {
        const isAdmin = userRole === 'admin';
        let isTextLocked = true;

        if (isAdmin) {
            isTextLocked = (status === 'completed' || status === 'archived');
        } else {
            isTextLocked = !['draft', 'needs_revision'].includes(status);
        }

        [processDescriptionInput, userPromptInput, improveBtn, applyImprovementsBtn, saveVersionBtn].forEach(el => el.disabled = isTextLocked);
        document.querySelector('.left-column').style.opacity = isTextLocked ? '0.7' : '1';
        const isCommentingLocked = (status === 'archived');
        commentInput.disabled = isCommentingLocked;
        addCommentBtn.disabled = isCommentingLocked;

        [sendReviewBtn, sendRevisionBtn, completeBtn, archiveBtn].forEach(btn => btn.style.display = 'none');

        if (isAdmin) {
            editDiagramBtn.style.display = diagramToolbar.style.display === 'flex' ? 'inline-block' : 'none';
            if (status === 'pending_review') {
                sendRevisionBtn.style.display = 'inline-block';
                completeBtn.style.display = 'inline-block';
            }
            if (status === 'completed') {
                archiveBtn.style.display = 'inline-block';
            }
        } else {
            editDiagramBtn.style.display = 'none';
            if (status === 'draft' || status === 'needs_revision') {
                sendReviewBtn.style.display = 'inline-block';
            }
        }
    }

    const statusMap = {
        draft: { text: 'Черновик', color: 'grey' },
        pending_review: { text: 'На проверке', color: 'orange' },
        needs_revision: { text: 'Нужны правки', color: 'red' },
        completed: { text: 'Завершен', color: 'green' },
        archived: { text: 'В архиве', color: 'grey' }
    };

    function getStatusIndicator(status) {
        const statusInfo = statusMap[status] || { text: status, color: 'grey' };
        return `<span class="status-indicator" style="background-color: ${statusInfo.color};"></span> ${statusInfo.text}`;
    }

    function openTranscriptionModal() {
        transcriptionReviewModal.style.display = 'block';
    }

    function closeTranscriptionModal() {
        transcriptionReviewModal.style.display = 'none';
    }

    function updateTranscriptionModalUI(data) {
        if (!data) {
            return;
        }

        openTranscriptionModal();
        transcriptionTextArea.value = data.final_text || data.transcribed_text || '';

        if (data.status === 'finalized') {
            transcriptionTextArea.style.display = 'none';
            transcriptionModalButtons.style.display = 'none';
            transcriptionFinalizedView.style.display = 'block';
            finalizedTextDisplay.textContent = data.final_text;
            // Also disable the main text area
            processDescriptionInput.value = data.final_text;
            processDescriptionInput.readOnly = true;
        } else {
            transcriptionTextArea.style.display = 'block';
            transcriptionModalButtons.style.display = 'block';
            transcriptionFinalizedView.style.display = 'none';
        }
    }

    async function handleSaveTranscription(isFinalizing = false) {
        const text = transcriptionTextArea.value;
        const status = isFinalizing ? 'finalized' : 'pending_review';
        const button = isFinalizing ? finalizeTranscriptionBtn : saveTranscriptionProgressBtn;

        setButtonLoading(button, true, 'Сохранение...');
        try {
            const response = await fetchWithAuth(`/api/chats/${chatId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ final_text: text, status: status })
            });
            const data = await response.json();
            showNotification('Транскрибация успешно сохранена!', 'success');
            updateTranscriptionModalUI(data);
            if (isFinalizing) {
                transcriptionDisplay.textContent = text;
                processDescriptionInput.value = text;
                updateStepCounter();
                closeTranscriptionModal();
            }
        } catch (error) {
            showNotification(`Ошибка сохранения транскрибации: ${error.message}`, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    }


    async function loadAdminPanel() {
        try {
            const usersResponse = await fetchWithAuth('/api/users');
            const users = await usersResponse.json();
            const regularUser = users.find(user => user.name === 'user');

            if (regularUser) {
                userForNewDepartmentSelect.innerHTML = `<option value="${regularUser.id}" selected>${regularUser.name}</option>`;
            } else {
                userForNewDepartmentSelect.innerHTML = '<option value="">Пользователь "user" не найден</option>';
                console.error('Default user "user" not found in the database.');
            }

            await loadAdminDepartments();

            const [inReviewResponse, completedResponse, pendingResponse] = await Promise.all([
                fetchWithAuth('/api/admin/chats/in_review'),
                fetchWithAuth('/api/admin/chats/completed'),
                fetchWithAuth('/api/admin/chats/pending')
            ]);
            const [inReviewChats, completedChats, pendingChats] = await Promise.all([inReviewResponse.json(), completedResponse.json(), pendingResponse.json()]);

            renderAdminChatList(inReviewList, inReviewChats, 'In Review');
            renderAdminChatList(completedList, completedChats, 'Completed');
            renderAdminChatList(pendingList, pendingChats, 'Pending');

            setupAdminTabs();

        } catch (error) {
            console.error("Failed to load admin panel data:", error);
            adminPanel.innerHTML = `<p class="error">Failed to load admin panel: ${error.message}</p>`;
        }
    }

    async function loadAdminDepartments() {
        try {
            const deptsResponse = await fetchWithAuth('/api/departments');
            const departments = await deptsResponse.json();
            departmentList.innerHTML = departments.map(dept => `
                <div class="department-card" data-dept-id="${dept.id}" data-dept-name="${dept.name}">
                    <span>${dept.name}</span>
                    <button class="button-danger delete-department-btn" data-dept-id="${dept.id}" title="Удалить департамент">Удалить</button>
                </div>`).join('');
        } catch (error) {
            departmentList.innerHTML = `<div class="error-text">Не удалось загрузить департаменты: ${error.message}</div>`;
        }
    }

    function renderAdminChatList(listElement, chats, listName) {
        const validChats = chats.filter(chat => chat.chats && chat.departments);
        if (validChats.length === 0) {
            listElement.innerHTML = '<li>Нет чатов для отображения</li>';
            return;
        }
        listElement.innerHTML = validChats.map(chat => `
            <li>
                <a href="#" data-chat-id="${chat.chat_id}" data-chat-name="${chat.chats.name}">
                    <span>${chat.chats.name}</span>
                    <span class="chat-dept-name">(${chat.departments.name})</span>
                    <span class="chat-status-admin">${getStatusIndicator(chat.status)}</span>
                </a>
            </li>`).join('');
    }

    function setupAdminTabs() {
        const tabs = document.querySelectorAll('.admin-tabs .tab-link');
        const tabContents = document.querySelectorAll('.admin-section .tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all tabs and hide all content
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');

                // Activate the clicked tab
                tab.classList.add('active');

                // Show the corresponding content
                if (tab.id === 'in-review-tab') {
                    document.getElementById('in-review').style.display = 'block';
                } else if (tab.id === 'pending-tab') {
                    document.getElementById('pending').style.display = 'block';
                } else if (tab.id === 'completed-tab') {
                    document.getElementById('completed').style.display = 'block';
                }
            });
        });
    }

    async function handleAdminDepartmentSelection(e) {
        if (e.target.classList.contains('delete-department-btn')) {
            handleDeleteDepartment(e);
            return;
        }

        const deptCard = e.target.closest('.department-card');
        if (!deptCard) return;

        document.querySelectorAll('#department-list .department-card').forEach(c => c.classList.remove('selected'));
        deptCard.classList.add('selected');
        const deptId = deptCard.dataset.deptId;
        const deptName = deptCard.dataset.deptName;
        await loadChatListForAdminDepartment(deptId, deptName);
    }

    function handleAdminChatListClick(e) {
        if (e.target.classList.contains('delete-chat-btn')) {
            handleDeleteChat(e);
        }
    }

    async function loadChatListForAdminDepartment(deptId, deptName) {
        chatListHeader.textContent = `Чаты в "${deptName}"`;
        selectedDepartmentNameSpan.textContent = deptName;
        createChatForm.style.display = 'block';
        chatList.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
        try {
            const response = await fetchWithAuth(`/api/chats?department_id=${deptId}`);
            const chats = await response.json();
            chatList.innerHTML = chats.length > 0 ? chats.map(chat => `
                <div class="chat-item" data-chat-id="${chat.id}">
                    <span>${chat.name}</span>
                    <button class="button-danger delete-chat-btn" data-chat-id="${chat.id}" title="Удалить чат">Удалить</button>
                </div>
            `).join('') : '<div class="placeholder-text">Нет чатов.</div>';
        } catch (error) {
            chatList.innerHTML = `<div class="error-text">Не удалось загрузить чаты: ${error.message}</div>`;
        }
    }

    async function handleCreateDepartment() {
        const name = newDepartmentNameInput.value;
        const password = newDepartmentPasswordInput.value;
        const userId = userForNewDepartmentSelect.value;
        if (!name || !password || !userId) {
            showNotification('Все поля должны быть заполнены!', 'error');
            return;
        }
        setButtonLoading(createDepartmentBtn, true, 'Создание...');
        try {
            await fetchWithAuth('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, user_id: userId })
            });
            newDepartmentNameInput.value = '';
            newDepartmentPasswordInput.value = '';
            showNotification('Департамент создан!', 'success');
            await loadAdminDepartments();
        } catch (error) {
            showNotification(`Не удалось создать департамент: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createDepartmentBtn, false);
        }
    }

    async function handleCreateChat() {
        const selectedDeptCard = document.querySelector('#department-list .department-card.selected');
        if (!selectedDeptCard) {
            showNotification('Сначала выберите департамент!', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const name = newChatNameInput.value;
        const password = newChatPasswordInput.value;
        if (!name || !password) return;
        setButtonLoading(createChatBtn, true, 'Создание...');
        try {
            await fetchWithAuth('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department_id: deptId, name, password })
            });
            newChatNameInput.value = '';
            newChatPasswordInput.value = '';
            showNotification('Чат успешно создан.', 'success');
            await loadChatListForAdminDepartment(deptId, selectedDeptCard.dataset.deptName);
        } catch (error) {
            showNotification(`Не удалось создать чат: ${error.message}`, 'error');
        } finally {
            setButtonLoading(createChatBtn, false);
        }
    }

    async function handleDeleteDepartment(e) {
        const button = e.target;
        const deptId = button.dataset.deptId;
        const deptCard = button.closest('.department-card');
        const deptName = deptCard.querySelector('span').textContent;

        if (confirm(`Вы уверены, что хотите удалить департамент "${deptName}"? Это действие также удалит все связанные с ним чаты.`)) {
            try {
                await fetchWithAuth(`/api/departments/${deptId}`, { method: 'DELETE' });
                showNotification(`Департамент "${deptName}" успешно удален.`, 'success');
                await loadAdminDepartments();
                if (deptCard.classList.contains('selected')) {
                    chatList.innerHTML = '<div class="placeholder-text">Выберите департамент, чтобы увидеть чаты.</div>';
                    chatListHeader.textContent = 'Чаты';
                    createChatForm.style.display = 'none';
                }
            } catch (error) {
                showNotification(`Ошибка удаления департамента: ${error.message}`, 'error');
            }
        }
    }

    async function handleDeleteChat(e) {
        const button = e.target;
        const chatId = button.dataset.chatId;
        const chatItem = button.closest('.chat-item');
        const chatName = chatItem.querySelector('span').textContent;
        const selectedDeptCard = document.querySelector('#department-list .department-card.selected');
        if (!selectedDeptCard) {
            showNotification('Не удалось определить департамент для обновления списка.', 'error');
            return;
        }
        const deptId = selectedDeptCard.dataset.deptId;
        const deptName = selectedDeptCard.dataset.deptName;

        if (confirm(`Вы уверены, что хотите удалить чат "${chatName}"?`)) {
            try {
                await fetchWithAuth(`/api/chats/${chatId}`, { method: 'DELETE' });
                showNotification(`Чат "${chatName}" успешно удален.`, 'success');
                await loadChatListForAdminDepartment(deptId, deptName);
            } catch (error) {
                showNotification(`Ошибка удаления чата: ${error.message}`, 'error');
            }
        }
    }

    async function handleSaveRawVersion(button = saveRawVersionBtn) {
        const process_text = processDescriptionInput.value;
        if (!process_text.trim()) {
            showNotification("Нельзя сохранить пустую версию.", "error");
            return;
        }
        setButtonLoading(button, true, 'Сохранение...');
        try {
            const mermaidCode = await generateDiagramFromText(process_text);
            await fetchWithAuth(`/api/chats/${chatId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ process_text: process_text, mermaid_code: mermaidCode })
            });
            showNotification("Версия успешно сохранена (без изменений от ИИ).", "success");
            await loadChatData();
        } catch (error) {
            showNotification(`Ошибка сохранения: ${error.message}`, "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    function handleAdminChatSelection(e) {
        const link = e.target.closest('a');
        if (link) {
            e.preventDefault();
            chatId = link.dataset.chatId;
            authWrapper.style.display = 'none';
            mainContainer.style.display = 'block';
            chatNameHeader.textContent = `Чат: ${link.dataset.chatName}`;
            loadChatData();
            backToAdminBtn.style.display = 'block';
        }
    }

    function resetAudioState() {
        audioBlob = null;
        audioChunks = [];
        rerecordCount = 0;
        processDescriptionInput.readOnly = false;
        transcriptionDisplay.textContent = ''; // Clear the display area

        startRecordBtn.style.display = 'block';
        stopRecordBtn.style.display = 'none';
        listenBtn.style.display = 'none';
        processBtn.style.display = 'none'; // Use processBtn
        rerecordBtn.style.display = 'none';
        audioPlayback.style.display = 'none';
        recordingIndicator.style.display = 'none';
        partialTranscriptDisplay.textContent = '';
    }

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayback.src = audioUrl;

                stopRecordBtn.style.display = 'none';
                listenBtn.style.display = 'inline-block';
                processBtn.style.display = 'inline-block'; // Use processBtn
                rerecordBtn.style.display = 'inline-block';
                audioPlayback.style.display = 'block';

                if (rerecordCount >= 1) {
                    rerecordBtn.disabled = true;
                }
            };

            mediaRecorder.start();
            startRecordBtn.style.display = 'none';
            stopRecordBtn.style.display = 'block';
            recordingIndicator.style.display = 'inline';

            secondsRecorded = 0;
            recordingTimer.textContent = '00:00';
            timerInterval = setInterval(() => {
                secondsRecorded++;
                const minutes = Math.floor(secondsRecorded / 60).toString().padStart(2, '0');
                const seconds = (secondsRecorded % 60).toString().padStart(2, '0');
                recordingTimer.textContent = `${minutes}:${seconds}`;
            }, 1000);

        } catch (err) {
            console.error('Error starting recording:', err);
            showNotification('Не удалось получить доступ к микрофону.', 'error');
            resetAudioState();
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        clearInterval(timerInterval);
        recordingIndicator.style.display = 'none';
    };

    const handleRerecord = () => {
        rerecordCount++;
        audioBlob = null;
        audioChunks = [];

        listenBtn.style.display = 'none';
        processBtn.style.display = 'none';
        rerecordBtn.style.display = 'none';
        audioPlayback.style.display = 'none';
        partialTranscriptDisplay.textContent = '';

        handleStartRecording();
    };

    const handleProcessAudio = async () => {
        if (!audioBlob) {
            showNotification('Нет записанного аудио для обработки.', 'error');
            return;
        }

        setButtonLoading(processBtn, true, 'Обработка...');
        listenBtn.disabled = true;
        rerecordBtn.disabled = true;

        let secondsProcessing = 0;
        transcriptionTimer.textContent = `(0s)`;
        transcriptionTimer.style.display = 'inline';
        transcriptionTimerInterval = setInterval(() => {
            secondsProcessing++;
            transcriptionTimer.textContent = `(${secondsProcessing}s)`;
        }, 1000);

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetchWithAuth('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                showNotification('Транскрибация успешно завершена.', 'success');
                transcriptionDisplay.textContent = data.transcript;
                processDescriptionInput.value = data.transcript;
                updateStepCounter();
                // Keep audio controls available
                processBtn.style.display = 'none'; // Hide process button after use
            } else {
                throw new Error(data.error || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            showNotification(`Ошибка транскрибации: ${error.message}`, 'error');
        } finally {
            // Stop animation timer
            clearInterval(transcriptionTimerInterval);
            transcriptionTimer.style.display = 'none';

            setButtonLoading(processBtn, false, 'Обработать');
            listenBtn.disabled = false;
            // The user should be able to re-record even after a failed attempt
            rerecordBtn.disabled = false;
        }
    };

    async function initiateTranscriptionReview(rawText) {
        try {
            const response = await fetchWithAuth(`/api/chats/${chatId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcribed_text: rawText, final_text: rawText, status: 'pending_review' })
            });
            const data = await response.json();
            updateTranscriptionModalUI(data);
        } catch (error) {
            showNotification(`Не удалось сохранить первоначальную транскрибацию: ${error.message}`, 'error');
        }
    }


    function updateStepCounter() {
        if (!processDescriptionInput) return;
        const lines = processDescriptionInput.value.split('\n').filter(line => line.trim() !== '');
        stepCounter.textContent = `${lines.length} шагов`;
        improveBtn.disabled = lines.length === 0;
    }

    async function getSuggestionsForProcess(processText) {
        const prompt = `Ты — элитный бизнес-аналитик. Проанализируй следующее описание бизнес-процесса и предложи 3-5 конкретных, действенных улучшений. Для каждого улучшения укажи, какую проблему оно решает.

Описание процесса:
"${processText}"

Ответ должен быть в формате JSON-массива, где каждый объект содержит два ключа: "problem" и "suggestion".

Пример:
[
  {
    "problem": "Ручной ввод данных в CRM, что ведет к ошибкам.",
    "suggestion": "Автоматизировать ввод данных в CRM с помощью интеграции по API."
  }
]`;
        const responseText = await callGeminiAPI(prompt);
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error("Invalid response from AI, no JSON array found. Raw response:", responseText);
            throw new Error("Не удалось получить корректный JSON-массив от AI.");
        }
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error("Failed to parse JSON from AI response. Raw JSON string:", jsonMatch[0], "Error:", error);
            throw new Error("Ошибка парсинга JSON ответа от AI.");
        }
    }

    async function handleImproveProcess() {
        const processText = processDescriptionInput.value;
        if (!processText.trim()) {
            showNotification("Описание процесса пустое.", "error");
            return;
        }

        setButtonLoading(improveBtn, true, 'Анализ...');
        suggestionsContainer.innerHTML = ''; // Clear previous suggestions
        suggestionsControls.style.display = 'none';

        try {
            suggestions = await getSuggestionsForProcess(processText);
            renderSuggestions(suggestions);
            if (suggestions.length > 0) {
                suggestionsControls.style.display = 'flex';
            }
        } catch (error) {
            showNotification(`Ошибка при получении улучшений: ${error.message}`, 'error');
        } finally {
            setButtonLoading(improveBtn, false);
        }
    }

    function renderSuggestions(suggestionsData) {
        suggestionsContainer.innerHTML = suggestionsData.map((s, index) => `
            <div class="suggestion-card">
                <input type="checkbox" id="suggestion-${index}" class="suggestion-checkbox" data-index="${index}">
                <label for="suggestion-${index}">
                    <p><strong>Проблема:</strong> ${s.problem}</p>
                    <p><strong>Решение:</strong> ${s.suggestion}</p>
                </label>
            </div>
        `).join('');
        updateSelectionCounter();
    }

    function updateSelectionCounter() {
        const selectedCount = suggestionsContainer.querySelectorAll('.suggestion-checkbox:checked').length;
        selectionCounter.textContent = `Выбрано: ${selectedCount}`;
        applyImprovementsBtn.disabled = selectedCount === 0;
    }

    function handleSelectAllSuggestions() {
        const checkboxes = suggestionsContainer.querySelectorAll('.suggestion-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateSelectionCounter();
    }

    function handleApplyImprovements() {
        const selectedCheckboxes = suggestionsContainer.querySelectorAll('.suggestion-checkbox:checked');
        if (selectedCheckboxes.length === 0) return;

        let improvementsText = "\n\n### Предложения по улучшению:\n";
        selectedCheckboxes.forEach(checkbox => {
            const index = checkbox.dataset.index;
            const suggestion = suggestions[index];
            improvementsText += `* **Проблема:** ${suggestion.problem}\n  * **Решение:** ${suggestion.suggestion}\n`;
        });

        processDescriptionInput.value += improvementsText;
        updateStepCounter();
        suggestionsContainer.innerHTML = '';
        suggestionsControls.style.display = 'none';
        selectAllCheckbox.checked = false;
        showNotification("Улучшения добавлены в описание.", "success");
    }

    function openEditDepartmentModal(id, name) {
        editDepartmentIdInput.value = id;
        editDepartmentNameInput.value = name;
        editDepartmentPasswordInput.value = '';
        editDepartmentModal.style.display = 'block';
    }

    function closeEditDepartmentModal() {
        editDepartmentModal.style.display = 'none';
    }

    async function handleSaveDepartment() {
        const id = editDepartmentIdInput.value;
        const name = editDepartmentNameInput.value;
        const password = editDepartmentPasswordInput.value; // Can be empty

        if (!id || !name) {
            showNotification('Имя департамента не может быть пустым.', 'error');
            return;
        }

        setButtonLoading(saveDepartmentBtn, true, 'Сохранение...');
        try {
            await fetchWithAuth(`/api/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            showNotification('Департамент успешно обновлен.', 'success');
            closeEditDepartmentModal();
            await loadAdminDepartments(); // Refresh the list
        } catch (error) {
            showNotification(`Ошибка обновления: ${error.message}`, 'error');
        } finally {
            setButtonLoading(saveDepartmentBtn, false);
        }
    }

    improveBtn.addEventListener('click', handleImproveProcess);
    selectAllCheckbox.addEventListener('click', handleSelectAllSuggestions);
    applyImprovementsBtn.addEventListener('click', handleApplyImprovements);
    suggestionsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('suggestion-checkbox')) {
            updateSelectionCounter();
        }
    });
    closeTranscriptionModalBtn.addEventListener('click', closeTranscriptionModal);
    saveTranscriptionProgressBtn.addEventListener('click', () => handleSaveTranscription(false));
    finalizeTranscriptionBtn.addEventListener('click', () => handleSaveTranscription(true));
    processDescriptionInput.addEventListener('input', updateStepCounter);
    startRecordBtn.addEventListener('click', handleStartRecording);
    stopRecordBtn.addEventListener('click', handleStopRecording);
    listenBtn.addEventListener('click', () => audioPlayback.play());
    rerecordBtn.addEventListener('click', handleRerecord);
    processBtn.addEventListener('click', handleProcessAudio);
    userLoginBtn.addEventListener('click', handleUserLogin);
    logoutBtn.addEventListener('click', handleLogout);
    departmentSelectionContainer.addEventListener('click', handleDepartmentCardSelection);
    chatLoginBtn.addEventListener('click', handleChatLogin);
    createDepartmentBtn.addEventListener('click', handleCreateDepartment);
    departmentList.addEventListener('click', handleAdminDepartmentSelection);
    chatList.addEventListener('click', handleAdminChatListClick);
    createChatBtn.addEventListener('click', handleCreateChat);
    inReviewList.addEventListener('click', handleAdminChatSelection);
    pendingList.addEventListener('click', handleAdminChatSelection);
    completedList.addEventListener('click', handleAdminChatSelection);
    backToAdminBtn.addEventListener('click', () => { mainContainer.style.display = 'none'; authWrapper.style.display = 'flex'; adminPanel.style.display = 'block'; backToAdminBtn.style.display = 'none'; });
    // ... add other listeners for main app functionality
    saveVersionBtn.addEventListener('click', (e) => handleSaveVersion(e.target));
    saveRawVersionBtn.addEventListener('click', (e) => handleSaveRawVersion(e.target));
    addCommentBtn.addEventListener('click', handleAddComment);
    sendReviewBtn.addEventListener('click', (e) => handleUpdateStatus('pending_review', e.target));
    sendRevisionBtn.addEventListener('click', (e) => handleUpdateStatus('needs_revision', e.target));
    completeBtn.addEventListener('click', (e) => handleUpdateStatus('completed', e.target));
    archiveBtn.addEventListener('click', (e) => handleUpdateStatus('archived', e.target));
    versionHistoryContainer.addEventListener('click', async (e) => { if (e.target.tagName === 'BUTTON') { const versionId = e.target.parentElement.dataset.versionId; const selectedVersion = chatVersions.find(v => v.id == versionId); if (selectedVersion) await displayVersion(selectedVersion); } });
    downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));
    downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));

    renderDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));
    regenerateDiagramBtn.addEventListener('click', (e) => handleRenderDiagram(e.target));

    zoomInBtn.addEventListener('click', () => {
        panZoomState.scale *= 1.2;
        updateTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        panZoomState.scale /= 1.2;
        updateTransform();
    });

    editDiagramBtn.addEventListener('click', toggleSplitView);
    closeSplitViewBtn.addEventListener('click', closeSplitView);
    saveSplitViewBtn.addEventListener('click', handleSaveSplitViewChanges);
    splitViewTextarea.addEventListener('input', handleSplitViewInput);

    // Panel toggles
    leftPanelToggle.addEventListener('click', () => {
        if (leftColumn.classList.contains('panel-hidden-left')) {
            collapsePanels(false);
        } else {
             // We can toggle individually? The design says "Toggle for Left Panel" so yes.
             // But my helper `collapsePanels` does both.
             // Let's implement individual toggle logic.
            leftColumn.classList.toggle('panel-hidden-left');
            leftPanelToggle.classList.toggle('collapsed');
            leftPanelToggle.textContent = leftPanelToggle.classList.contains('collapsed') ? '>>' : '<<';
        }
    });

    rightPanelToggle.addEventListener('click', () => {
        rightColumn.classList.toggle('panel-hidden-right');
        rightPanelToggle.classList.toggle('collapsed');
        rightPanelToggle.textContent = rightPanelToggle.classList.contains('collapsed') ? '<<' : '>>';
    });


    checkSession();

    // Обработчик колесика мыши (Зум в точку курсора)
    diagramContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;

        const zoomIntensity = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1; // Вниз - отдалить, Вверх - приблизить
        const factor = direction * zoomIntensity;

        // Ограничения зума
        let newScale = panZoomState.scale + factor;
        if (newScale < 0.1) newScale = 0.1;
        if (newScale > 5) newScale = 5;

        // Математика зума в точку курсора
        // Получаем координаты мыши относительно контейнера
        const rect = diagramContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Вычисляем смещение, чтобы точка под курсором осталась на месте
        panZoomState.pX = mouseX - (mouseX - panZoomState.pX) * (newScale / panZoomState.scale);
        panZoomState.pY = mouseY - (mouseY - panZoomState.pY) * (newScale / panZoomState.scale);
        panZoomState.scale = newScale;

        updateTransform();
    });

    // Начало перетаскивания (MouseDown) for Pan
    diagramContainer.addEventListener('mousedown', (e) => {
        // Разрешаем драг, если зажат Ctrl ИЛИ нажата средняя кнопка мыши (колесико)
        if (e.ctrlKey || e.button === 1) {
            e.preventDefault(); // Чтобы не выделялся текст
            panZoomState.isDragging = true;
            panZoomState.startX = e.clientX - panZoomState.pX;
            panZoomState.startY = e.clientY - panZoomState.pY;
            diagramContainer.classList.add('pan-active');
            diagramContainer.style.cursor = 'grabbing';
            // Disable transition for smooth dragging
            const svg = diagramContainer.querySelector('svg');
            if (svg) svg.style.transition = 'none';
        }
    });

    // Процесс перетаскивания (MouseMove) for Pan
    window.addEventListener('mousemove', (e) => {
        if (!panZoomState.isDragging) return;

        e.preventDefault();

        // Use movementX/Y for Delta (Requirement 2.2)
        // Note: pX/pY are absolute translations, so we add the delta
        panZoomState.pX += e.movementX;
        panZoomState.pY += e.movementY;

        // OR legacy way (startX calc) - the movementX way is smoother if we don't rely on startX
        // Let's stick to movementX as requested

        updateTransform();
    });

    // Окончание перетаскивания (MouseUp) for Pan
    window.addEventListener('mouseup', () => {
        if (panZoomState.isDragging) {
            panZoomState.isDragging = false;
            diagramContainer.classList.remove('pan-active');
            diagramContainer.style.cursor = ''; // Reset cursor

            // Re-enable transition? The prompt said "optional".
            // svgElement.style.transition = 'transform 0.1s ease-out';
            const svg = diagramContainer.querySelector('svg');
            if (svg) svg.style.transition = 'transform 0.1s ease-out';
        }
    });

    // Визуальная подсказка (курсор) при нажатии Ctrl
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Control') {
            diagramContainer.classList.add('hand-cursor');
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Control') {
            diagramContainer.classList.remove('hand-cursor');
        }
    });
});
