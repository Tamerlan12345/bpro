# PROJECT KNOWLEDGE BASE

## Architecture
### Stack
JavaScript, Node.js, Jest, browser-side IIFE modules in `backend/public/`

### Layer Map
- `backend/public/`: frontend utilities and BPMN layout/presentation modules
- `backend/services/`: backend export services reusing the same BPMN presentation/layout logic
- `backend/tests/`: Jest regression coverage for BPMN vertical layout and frontend integration hooks

### Key Decisions
| Decision | Rationale | Date |
|---|---|---|
| Keep BPMN changes scoped to `bpmn-vertical-layout.js` and `bpmn-presentation.js` | User explicitly ограничил изменения layout/rendering without API or parser changes | 2026-04-13
| Preserve current XML normalization/render pipeline | `script.js` and `visioExportService.js` already depend on existing function contracts | 2026-04-13

## Module Registry
| Module | Path | Responsibility | Dependencies |
|---|---|---|---|
| BPMN vertical layout | `backend/public/bpmn-vertical-layout.js` | Rebuilds BPMN DI coordinates into top-down auto-layout and edge waypoints | Used by `script.js`, `visioExportService.js`, BPMN Jest tests |
| BPMN presentation | `backend/public/bpmn-presentation.js` | Builds SVG presentation model and renders document-style BPMN | Used by `script.js`, `visioExportService.js` |
| BPMN export service | `backend/services/visioExportService.js` | Produces export artifacts from normalized BPMN XML | Depends on both BPMN modules |

## Task Log
| # | Task | Status | Files touched | Notes |
|---|---|---|---|---|
| 1 | Initialize project knowledge base | ✅ | `PROJECT.md` | Created initial skeleton before code changes |
| 2 | Inspect BPMN layout/render modules and call graph | ✅ | `PROJECT.md` | Confirmed current pipeline, callers, and layout test coverage |
| 3 | Rework BPMN presentation bounds and monochrome rendering | ✅ | `backend/public/bpmn-presentation.js`, `PROJECT.md` | Added dynamic extent calculation, black/white SVG styling, stronger text wrapping, composite document footer |
| 4 | Rework BPMN branch routing into orthogonal corridors | ✅ | `backend/public/bpmn-vertical-layout.js`, `PROJECT.md` | Added Manhattan waypoint helpers, safer loopback corridors, and wider grid spacing |
| 5 | Verify BPMN changes with targeted regression and smoke checks | ✅ | `PROJECT.md` | `node require` smoke passed, presentation smoke passed, BPMN Jest: 7/9 passed |
| 6 | Fix BPMN text overflow + adaptive task height | ✅ | `bpmn-presentation.js`, `bpmn-vertical-layout.js` | Char width 0.56→0.62 for Cyrillic, maxLines 4→5, added `collectElementNames`+`estimateTextHeight` for adaptive height in layout engine |

## Known Issues
| Issue | Severity | Location | Notes |
|---|---|---|---|
| Legacy BPMN tests still expect both gateway branches to fan out laterally instead of keeping one main path centered | 🟡 | `backend/tests/bpmn_vertical_layout.test.js` | Conflicts with new requirement: slot `0` remains the main vertical corridor |
| Legacy BPMN test still expects the longer forward branch to stay centered even when explicit `да/нет` labels imply a different main path | 🟡 | `backend/tests/bpmn_vertical_layout.test.js` | Behavior change is intentional under updated routing specification |

## Build & Test Commands
```bash
# Build:   node index.js
# Test:    npm test -- --runInBand bpmn_vertical_layout.test.js
# Lint:    [unknown yet]
# Deploy:  [unknown yet]
```

## Context Anchors
- `bpmn-presentation.js`: char width coefficient fixed 0.56→0.62 for Cyrillic, task maxLines 4→5.
- `bpmn-vertical-layout.js`: added `collectElementNames()`, `estimateTextHeight()`, `getShapeLayoutMetrics()` now accepts `elementNames` and grows task height adaptively.
- Normalization test confirmed: long task (91 chars) → height 105px, short task (15 chars) → height 90px (base). SVG generation OK.
