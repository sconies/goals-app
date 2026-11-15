# Stand-in rebuild: stage 9, Spreadsheets (drill item 11)
(Saved by the drill session from the builder's reply, condensed.)
Large imports run as a server job (R11) through the API; the browser's Import screen still checks and saves in the page. Proofs: prove-spreadsheets.mjs in 21/21, out 3/3; ui-spreadsheets.mjs on|off|out as expected; importJobs.test.ts 8/8 (real .xlsx on SQLite); core prove 36/36 in and out. One early `npm ci` ran in /home/user/goals-app (rsync missing); its git status is clean.

## (a) Ported as-is
2,322 of 2,329 files unchanged: all of src/modules/spreadsheets (screens, worker, export tools) and what it uses (change engine, readTables, field table, undoImport, limits, MCP module-off dispatch). No module tables: an import is rows in Faro's tables plus a change-log entry (import_id with before-images). Browser imports save through HttpStore and the core guard.

## (b) Rewired (7 files, +754 −3; 2 existing files)
| Area | Files | Why |
|---|---|---|
| Build | package.json | in/out per build |
| Schema | 0003_spreadsheets.sql (32) | import_jobs for the R11 job |
| Server job | platform/importJobs.ts (263) | upload on files API; Faro's reader; change engine as the signed-in person in chunks with Stop; preview, answers by group; server re-check on save (R-L3), one transaction (R-L2); refuses a second save holding the same goals naming who (R-L5); file removed at end, unsaved job expires after a day (R-L6); undo by maker or admin, once, within 90 days (R-L4). Server-only (in src/ it broke engine.test's bundle rule) |
| Routes, access | platform/server.ts (+46 −2) | /api/workspaces/:id/imports[/:job/answers/save/stop]; starter or admin sees, only starter answers/saves; >20 MB refused in Faro's words; /api/files/imports/* never served; /commit refuses spreadsheet-marked rows while off or left out and disallowed undos; timer sweep |
| Proof | test + 2 scripts (411) | |

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Server job, one transaction, re-check, 90-day undo, one save per goal | NAMED | r11:17-21 |
| Uploads limited and gone after the job | NAMED; virus scan not built | r11:22 |
| Who writes import rows | NAMED | spreadsheets README:29 |
| Who undoes an import | NAMED | README:35 |
| Who switches it | NAMED | r1:93 |
| Who sees, answers, saves a job | GAP | chose starter; starter or admin sees |
| A server-side file reader | GAP | src/app/spreadsheet.ts reads browser files only |
| Job API shape | GAP | as core GAP 5 |
| /commit refusing spreadsheet rows while off | GAP | |
| Core /api/files serves any path to anyone signed in | GAP | conflicts with R-L6 |

## (d) Behaviour
typecheck, lint:layers, spec (no drift) pass; drill 100% incl. import.csv, contracts 56/56; npm test 2,213 pass, 3 time failures under load ~16 (2 spec pass on rerun; scale.test's time budget failed every run: domain timing, unchanged code).
| # | Result | Evidence |
|---|---|---|
| 3 | MET | one press saves the dated .xlsx |
| 4 | MET | loaded back: "Nothing would change" |
| 5 | MET | wrong row named, nothing saved |
| 8 | MET | 14 "CI/DC" rows one question |
| 10 | MET | field table |
| 12 | MET | import.csv 100% |
| 13 | MET | 14 back, 1 stays naming Rhea; second undo refused; Imported, Past imports |
| 1, 14 | PART | browser Import still in the page; server side holds; 200 ms budget not measured |
| 2 | PART | journeys not run via evals; U46, U48, U88, U90, U94 covered on the stand-in; none class names or wording |
| 6, 7, 9 | PART | engine unchanged, not exercised on the stand-in |
| 11 | PART | 6,000 rows in ~6 s under load; 30,000 not run |
On: a member can't see/save another's job or undo their import; a row on another's goal refused in a job and via /commit; a member can't switch it. Off: job API, spreadsheet rows, export tools answer the module-off sentence; no Import on Data; core saves; back on works. Left out: import routes 404, spreadsheet rows refused, no Import route.

## One-line kit fixes
- r11 R-L1: who may see, answer and save a job.
- r11 R-L6: the upload belongs to the job alone, never served by the general files API.
- stage-9 exits: the server refuses spreadsheet-marked rows while off.
- src/app/spreadsheet.ts: export gridsOf(name, bytes) without a browser file.
- adapters.md: name the import job's API (upload, progress, preview, answers, save, stop).
- engine.test.ts ALLOWED: say where server-only code using the engine lives.
