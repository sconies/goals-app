# Stand-in rebuild: stage 7, Metric library (drill item 11)
(Saved by the drill session from the builder's reply, condensed.)

Proofs: `bash platform/prove-metrics.sh 47610` (on, left out, back, one data folder), `platform/ui-metrics.mjs` (screens), `src/adapters/standin/metrics.test.ts` (in npm test).

## (a) Ported as-is
2,335 files; 14 existing files changed; src/domain 0 lines. 50 of the module's 55 files untouched (rules, records.ts, actions, screens, Help, 7 MCP tools, demo rows, spec, conformance); 5 changed only for a number-sources seam (+19 −8). The core's store, removal, restore, cycle carry and export kept module records unchanged (SqliteStore already read module_tables). server/mcp.ts unchanged.

## (b) Rewired (25 files, +905 −110)
| Area | Files | Why |
|---|---|---|
| Build | package.json | metrics in; STANDIN_WITHOUT |
| Migrations | translate-schema.mjs (+22 −10), 0001_core.sql (−83), 0010_module_metrics.sql (+59), 0011_module_tags.sql (+38) | each module's tables move to their own migration, run whether or not the module is built, so rows outlive a build without it |
| Registry part | vite.modules.ts, src/core/virtual.d.ts, src/core/platform.ts (+35) | new `virtual:faro-modules/platform`: each module's platform.ts (server save check ModuleGuard, start, routes, admin-only folders, seed); left-out modules bring no code; layers lint 0 |
| Server access (R1 rule 4) | guard.ts (+16 −2), modules.ts (+8), metrics/standinGuard.ts (+105) | core guard refuses a module's rows while it's off or left out, asks the module's guard per row; metrics guard uses the module's own rules (canEditMetric, canLinkGoal, metricProblems, everUsed, linkProblems, retiredWords, PART_MAX) |
| Number sources (exit 18) | sources.ts (+13), readingTool, tools, Metrics.tsx, CheckInNumber.tsx (+11 −8), standinSources.ts (+66), platform.ts (+55) | new seam registerNumberSources/workspaceSources (before it only the demo could have a source); stand-in source = CSV drops on the files API under readings/<ws>/; members read via GET /api/workspaces/:id/readings |
| Files | files.ts (+3 −1) | list(prefix) |
| Server | platform/server.ts (+16 −4) | module routes, start, seed; only admins add/remove drops (R12.3) |
| Browser | src/main.tsx (+2 −1) | starts modules' platform parts |
| Proof | metrics.test.ts (+176), prove-metrics.mjs (+203), .sh (+15), ui-metrics.mjs (+50) | |

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Who writes a metric (anyone adds; owner or admin changes/removes/retires; admins merge) | NAMED | r1:106-109; metrics rules.md:28 |
| Who writes a link (goal's owner or admin) | NAMED | r1:110 |
| A goal created in the same save is linked by its creator | GAP | only in rulesLink.ts |
| A metric's save writes others' goals (unit relabel; Gap holds to no number) | GAP | neither r1's table nor r1:31; a mayChangeGoal check refuses these |
| What the dropped DB checks enforced (lengths, enums, link id = goal id, unique live name) | PART | schema.sql:214-230, 371-418; core GAP 3 |
| Module tables in their own migration, kept while left out | NAMED rule; GAP how | stage-2:23; one schema.sql |
| A switched-off module's forged rows refused by the server | GAP | spec covers tools, menu, Home, import only |
| NumberSource and its contract | NAMED | adapters.md:28, 42; r12:17 |
| Where a workspace's sources are registered | GAP | sourcesFrom only builds the demo's |
| Who changes readings | NAMED | R12.3 |
| Readings as readable as the goal | NAMED | R12.7 |
| Listing files in a folder | GAP | Files port lacks list |
| Reading sources on a schedule | NAMED, not built | r12:5 |
| Browser↔server route for module reads | GAP | core GAP 5 |

## (d) Behaviour
typecheck passes; npm test 203 files, 2,231 pass (10 timeouts on an earlier loaded run, pass on rerun); lint:layers passes; spec current; drill 100% (metrics.csv 124/124), contracts 56/56; source contract 5 cases; server on 41/41, left out 5/5, back 1/1; screens 8/8.
| # | Exit | Status | Evidence |
|---|---|---|---|
| 1 | Requirements | PART | via rows below, unit tests, journeys; not one by one |
| 3 | Name, unit, direction; case-different name refused | MET | API |
| 4 | Owner/admin change or remove; goal owner/admin links | MET | forged /commit and MCP save_metric, link_goal_metric 403 |
| 5 | Unit differs refused; dated stages; direction warns | MET (unit via API) | rest via linkProblems tests |
| 6 | Used metric can't be deleted; unused deleted and restored | MET | |
| 7 | Demo 13 metrics, 12 links, parts | MET | |
| 8 | Left out: loads, saves, rows untouched; back, all there | MET | SQLite rows byte-identical |
| 9 | Next year carries links | MET (journey) | U152 10/10 in /demo |
| 10 | metrics.csv | MET | 124/124 |
| 11 | Menu after People; old addresses; counts | MET | U81 10/10 |
| 12-17 | Forms, checks, read-back, retire, merge, Gap | MET (journeys) | U82, U145, U83, U105, U146, U106, U170 10/10; owner relabel on others' goals allowed, nothing else; non-admin can't merge |
| 18 | Source by slice, contract | MET | |
| 19 | Check-in number step | MET | from the stand-in's file; nothing while off; post_check_in reading_confirmed; U156-U160 10/10 |
| 20 | Where a number came from | PART | U161 needs Reviews (left out) |
| 21-22 | Metrics sheet | PART | sheet functions 100%; U179 needs Import (Spreadsheets) |
Switch: member can't switch; off → forged save refused with the module sentence, readings empty, list_metrics module-off sentence, rows stay, no menu row; on → all returns.
Journeys (/demo, other modules out): 15/18 at 10/10; U72, U161, U179 need Import or Reviews; none class names or wording; F15, N16, N29 not run.

## One-line kit fixes
- r12-number-sources.md:57: "Stage 4: Metric library" → "Stage 7" (link stage-7-module-metrics.md).
- adapters.md:42: "register them for a workspace with registerNumberSources (src/modules/metrics/sources.ts); sourcesFrom makes only the demo's."
- r1:106-110: row "A metric's save also writes the goals it measures (their unit on a relabel, held to no number by a Gap), whoever owns them."
- r1:110: "or, for a goal created in the same save, whoever creates it".
- src/ports/index.ts Files: `list?(prefix: string): Promise<string[]>`.
- module-platform.md: name a module's server-side save check (ModuleGuard) and say the server refuses a switched-off module's rows.
- schema.sql: mark each module's tables, or ship spec/modules/<m>/schema.sql.
