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
- `PROJECT.md` did not exist and was created before any code changes.
- Target scope is restricted to `backend/public/bpmn-vertical-layout.js` and `backend/public/bpmn-presentation.js`.
- `bpmn-presentation.js` is consumed by `script.js` and `visioExportService.js`.
- `bpmn-presentation.js` now computes viewBox bounds from nodes, lanes, participants, edge waypoints, and estimated label extents.
- `bpmn-vertical-layout.js` now routes side branches and loopbacks through explicit orthogonal corridors.
- Targeted BPMN verification passed smoke checks and 7/9 layout tests; 2 remaining assertions reflect the previous branch-centering rules.
