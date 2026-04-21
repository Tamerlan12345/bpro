# PROJECT KNOWLEDGE BASE

## Architecture
### Stack
JavaScript, Node.js, Express, Jest, Playwright smoke scripts, browser-side IIFE modules in `backend/public/`

### Layer Map
- `backend/public/`: frontend shell, DOM/event bootstrap, BPMN/map presentation modules
- `backend/services/`: backend export and AI-facing services
- `backend/server.js`: HTTP entrypoint, auth/session/CSP, upload handling, validation, admin/API routes
- `backend/tests/`: Jest regression and route coverage

### Key Decisions
| Decision | Rationale | Date |
|---|---|---|
| Keep BPMN changes scoped to `bpmn-vertical-layout.js` and `bpmn-presentation.js` | Existing render/export pipeline already depends on those contracts | 2026-04-13 |
| Preserve current XML normalization/render pipeline | `script.js` and `visioExportService.js` already depend on current behavior | 2026-04-13 |
| Move audio MIME rejection out of `multer.fileFilter` and into `uploadAudio` post-processing | `fileFilter` returned the right `400`, but it cut multipart handling early enough to trigger `ECONNRESET` in client tests | 2026-04-15 |
| Do not load `backend/.env` when `NODE_ENV=test` | Test suites must stay isolated from developer secrets and production-like credentials | 2026-04-15 |

## Module Registry
| Module | Path | Responsibility | Dependencies |
|---|---|---|---|
| Frontend bootstrap | `backend/public/index.html`, `backend/public/script.js` | Static shell plus DOM/event bootstrap for login, admin, chat, map, and transcription flows | Backend API, browser runtime, public modules |
| BPMN vertical layout | `backend/public/bpmn-vertical-layout.js` | Rebuilds BPMN DI coordinates into top-down auto-layout and edge waypoints | Used by `script.js`, `visioExportService.js`, BPMN Jest tests |
| BPMN presentation | `backend/public/bpmn-presentation.js` | Builds SVG presentation model and renders document-style BPMN | Used by `script.js`, `visioExportService.js` |
| Map rendering | `backend/public/modules/map.js` | Shared Cytoscape node/edge styling and map-specific rendering helpers | Frontend bootstrap, Cytoscape |
| Backend server | `backend/server.js` | Express entrypoint for auth, admin routes, AI generation, upload handling, validation, and session/CSP setup | `pg`, `multer`, `zod`, `helmet`, `pino`, `backend/public/` |
| BPMN export service | `backend/services/visioExportService.js` | Produces export artifacts from normalized BPMN XML | BPMN modules |

## Task Log
| # | Task | Status | Files touched | Notes |
|---|---|---|---|---|
| 1 | Initialize project knowledge base | done | `PROJECT.md` | Created initial skeleton before code changes |
| 2 | Inspect BPMN layout/render modules and call graph | done | `PROJECT.md` | Confirmed current pipeline, callers, and layout test coverage |
| 3 | Rework BPMN presentation bounds and monochrome rendering | done | `backend/public/bpmn-presentation.js`, `PROJECT.md` | Added dynamic extent calculation, monochrome SVG styling, stronger text wrapping, composite document footer |
| 4 | Rework BPMN branch routing into orthogonal corridors | done | `backend/public/bpmn-vertical-layout.js`, `PROJECT.md` | Added Manhattan waypoint helpers, safer loopback corridors, and wider grid spacing |
| 5 | Verify BPMN changes with targeted regression and smoke checks | done | `PROJECT.md` | `node require` smoke passed, presentation smoke passed, BPMN Jest: 7/9 passed |
| 6 | Fix BPMN text overflow and adaptive task height | done | `backend/public/bpmn-presentation.js`, `backend/public/bpmn-vertical-layout.js`, `PROJECT.md` | Increased Cyrillic text estimate and made task height adaptive |
| 7 | Fix login/CSP, test-env leakage, upload validation, admin seed text, and map regressions | done | `backend/public/index.html`, `backend/public/script.js`, `backend/public/style.css`, `backend/public/modules/map.js`, `backend/server.js`, `PROJECT.md` | Removed inline form handlers, bound submit via JS, blocked negative coordinates, isolated `.env` from `test`, fixed admin full name, constrained map toolbar, stabilized invalid audio upload flow |
| 8 | Verify targeted server regressions and browser submit flow | done | `PROJECT.md` | Jest passed for `admin_routes_regression`, `logging`, `transcribe`, `user_creation`; Playwright smoke confirmed login stays on `/` and renders the `401` error text |
| 9 | Implement Map drawing bindings and refactor BPMN constants | done | `backend/public/modules/map.js`, `backend/public/style.css`, `backend/public/bpmn-presentation.js`, `backend/public/bpmn-vertical-layout.js` | Added Cytoscape node and `edgehandles` bindings, fixed toolbar button wrapping, added visual padding and interactive cursor styles to BPMN nodes, extracted visual sizing constants to `BpmnConfig`. |
| 10 | Synchronize Editor and Presentation coordinates and enhance SVG styles | done | `backend/public/script.js`, `backend/public/bpmn-presentation.js`, `PROJECT.md` | Preserved user's manual coordination changes by passing `applyLayout=false` in `saveOverlayDiagram`. Visual aesthetics upgraded: SVG nodes have `rx/ry` rounded corners, custom stroke/fill palettes (slate, emerald, rose, amber), and rounded line endpoints. |
| 11 | Perform full system audit and testing | done | `backend/tests/` | Ran Jest (133 tests) and Playwright E2E. Identified version mismatch in regression tests. |
| 12 | Upgrade Gemini model | done | `backend/services/aiParserService.js` | Upgraded model from gemini-2.0-flash to gemini-3.0-flash for better JSON structure extraction and reasoning. |

## Known Issues
| Issue | Severity | Location | Notes |
|---|---|---|---|
| Legacy BPMN tests still expect both gateway branches to fan out laterally instead of keeping one main path centered | medium | `backend/tests/bpmn_vertical_layout.test.js` | Conflicts with the newer routing requirement that slot `0` stays on the main vertical corridor |
| Legacy BPMN test still expects the longer forward branch to stay centered even when explicit branch labels imply a different main path | medium | `backend/tests/bpmn_vertical_layout.test.js` | Behavior change is intentional under the updated routing specification |
| Frontend bootstrap still depends on multiple external CDNs for fonts/scripts | medium | `backend/public/index.html` | Offline or filtered environments still show `ERR_FAILED`; submit flow now works, but dependency hardening remains separate work |
| Regression test expects `script.js?v=3` | low | `backend/tests/frontend_bootstrap_regression.test.js` | Index.html now uses `?v=15`, causing test failure. Need to update test to match current version. |

## Build & Test Commands
```bash
# Build:   node index.js
# Test:    npm test -- --runInBand tests/admin_routes_regression.test.js tests/logging.test.js tests/transcribe.test.js tests/user_creation.test.js
# Smoke:   headless Playwright login submit against http://127.0.0.1:8080/
# Lint:    [unknown yet]
# Deploy:  [unknown yet]
```

## Context Anchors
- 2026-04-15: Finalized BPMN coordinate persistence and aesthetic synchronization across View/Edit modes.
- 2026-04-15: Completed full E2E audit using Playwright and Jest; documented current technical debt in PROJECT.md.
- 2026-04-15: Refactored SVG rendering to a premium "soft" look with rounded elements and unified color system.
