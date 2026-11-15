# Review: stand-in stage 9, Spreadsheets (reviewer, copy in S/rev-spreadsheets)

## Re-run (fresh clone + patch, npm ci)
- typecheck 0; lint:layers ok. npm test: 2,215 pass, 1 fail (spec.test "is current" timed out at 60 s under 3-reviewer load; passes alone: spec.test + src/adapters/standin = 56/56). Report said 2,213 + 3 time failures: consistent.
- drill scripts/drill-faro 100% (462,003/462,003), contracts 56/56 (matches).
- prove-spreadsheets in 21/21, out 3/3 (matches); core prove.mjs 36/36 with the module in and left out (matches). importJobs.test 8/8.
- ui-spreadsheets.mjs NOT re-run (needs a base URL and a running server; I called it wrongly once). Its on|off|out results are unverified by me.

## 1. Platform is the stand-in: VERIFIED for the platform, NOT MET for access
- No supabase/vercel in importJobs.ts, server.ts, migration, scripts; SQLite (import_jobs); files folder; setInterval sweep. OK.
- Job API (/imports...) is guarded server-side: starter-or-admin sees; only starter answers/saves; member 404 on others' jobs; save runs the same refusal() as /commit. VERIFIED (prove + my own probe).
- Probe as Pavel (non-admin) through POST /commit, per record kind:
  - GUARDED (403): goals of another owner, check-ins on another's goal (even marked Via Spreadsheet), people edit/add, teams, workspace/recording/modulesOff, cycles, views; action 'undone' of an import you didn't make (undoRefusal; VERIFIED).
  - FORGEABLE (200): decisions (approve-target on another's goal, forged byId=admin), retros (as admin), watches for another person, unwatch of any id, feedback as another person, reviews (createdBy someone else), modules rows, forged 'imported' change entries carrying undo before-images (and a forged 'undone' entry for an unknown import). Asks/requests: 400 only from my malformed row (NOT NULL created_at), no guard code for them: treat as forgeable.
  - Side-effect writes of this module: an import's Action "left" (leaver leaves reviews, hands over teams, closes asks) and Undo (restores reviews, requests, watches, modules rows). The people/teams/goals parts are guarded; reviews, requests, watches, module rows are not. Same blind spot as core review.
- NEW HOLE, R-L6 bypass: server.ts blocks only names starting `imports/`. As a plain member, GET /api/files/%2E%2Fimports%2Fws_platform%2F<job> (also `x/../imports/...`) returned 200 with the uploaded file; DELETE with the same name returned 200 and deleted it (the job then fails "The file for this import is no longer kept", 410). So "never served by the general files API" (REPORT, prove check) is only true for the plain path. `%2e/...` also gives an unhandled 500. Core gap (files not workspace-scoped) is the cause; the stage-9 patch's fix is a prefix check, not an enforcement.
- Module-off enforcement in /commit keys on the client-supplied Via mark: omit the mark and the save passes. Only matters for writes the person may make anyway, but "refused while off" is a convention, not a guarantee.

## 3. Claims
(a) 2,322/2,329 unchanged: VERIFIED (7 files, package.json +1/-1, server.ts +47/-2).
(b) Rewired: VERIFIED shape and sizes. WEAK: "a member can't see/save another's job" true; "files never served" WRONG (above).
(c) NAMED cites: r11:17-21 (R-L1..L5) VERIFIED; r11:22 (R-L6, scanned/limited/not kept) VERIFIED; module README:29 (BULK-IMPORT, owners/admins) VERIFIED; README:35 (IMPORT-UNDO) VERIFIED; r1:93 (features switched by admins) VERIFIED.
  - GAP who sees/answers/saves a job: real (grep of r11, stage-9, rebuild finds nothing).
  - GAP server-side file reader: real (spec says "server-side job", never names a reader; src/app/spreadsheet.ts is browser-only). Also R-L6 "scanned" is named but not built (honestly said).
  - GAP job API shape: real (same as core GAP 5).
  - GAP "/commit refuses spreadsheet rows while off": WEAK. spec/rebuild/module-platform.md:92 names the `writesWhenOff` hook (reviews, watching); stage 9 just doesn't list spreadsheets for it. A partial gap: the pattern is named, the module's use isn't.
  - GAP files API serves any path: real, and worse than reported (bypass above; also any member may DELETE any file).
  - Missing GAP: undo's side effects (reviews, requests, watches, module rows) and the unguarded kinds above.
(d) Numbers VERIFIED. Table: 3,4,5,8,10,12,13 MET are covered by prove/importJobs.test; 11 "6,000 rows in ~6 s": not re-run. Journeys not run (stated).

## 4. Proofs
- On: VERIFIED (21/21; own probe agrees).
- Off: VERIFIED (module-off sentence for job API, spreadsheet-marked saves, MCP export/export_table; core saves; back on works). Weak only in the Via-mark sense above.
- Left out: VERIFIED (3/3, 404s, rows refused, core saves). UI half not re-run.

## 5. Tests honest
- Broke server.ts (disabled the off check and undoRefusal), rebuilt: prove-spreadsheets exit 1, 2 FAIL. Honest. But importJobs.test (8/8) and the whole npm test stay green with them broken: server routes and the access refusals have no test in npm test/CI, only the proof script.
- Broke importJobs (size limit and starter check removed): importJobs.test fails 1/8 (the 20 MB/size path or save check is caught; the starter check alone is not clearly covered).
- prove-spreadsheets never tests `./imports/` paths, so its R-L6 check passed while the hole exists.

## 6. One-line kit fixes
- r11 R-L1 who sees/answers/saves: SOUND, one line.
- r11 R-L6 upload belongs to the job alone, never served by the general files API: SOUND, add "and files are scoped to a workspace and a person" (a prefix check is not enough).
- stage-9 exits: server refuses spreadsheet rows while off: SOUND but better as "lists writesWhenOff" in the stage's hook table; note the Via mark is the client's.
- src/app/spreadsheet.ts export gridsOf(name, bytes): NOT one line: browser reader uses a browser xlsx build, the server a node one; a shared function needs a reader injected (about 15 duplicated lines in importJobs.ts).
- adapters.md name the job API: SOUND.
- engine.test ALLOWED note: SOUND (doc line).

## Top real GAPs
1. Row-level checks for every record kind (decisions, retros, watches, asks, reviews, feedback, module rows, undo's side effects), as in core.
2. Files API not scoped: R-L6 "not served" bypassable by `./imports/...`; any member reads and deletes any file.
3. Job ownership rule, server-side reader, job API shape: unnamed.
4. Server routes' access rules not in npm test.
