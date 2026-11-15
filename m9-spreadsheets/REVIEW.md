# Review: m9-spreadsheets (stage 9, Spreadsheets)
Run in S/rev-m9-spreadsheets/rebuild (node_modules symlinked to S/pin's, read only). Ports 491xx.

## 1. Harness
`npm run drill -- rebuild`: 100.0% (320,578 of 320,578 cells; 45,366 rows), store contract 14/14. drill.json "also" lists changes, import, status, flags, projection, scorecard, checkin; import.csv 70/70. The kit has no stage-9 CSV, so the module itself is scored only by its own tests.

## 2. Test honesty
- Journeys (modules/spreadsheets/journeys/run.mjs): 24 of 24 runs pass (12 journeys x phone/desktop), exit 0.
- exit.test.mjs (on / off / out): off and out pass. ON FAILS in 5 of 6 full runs: criterion 13 dies with `fetch failed` in `fresh()` (the reset), 4 ms after test 12. Almost certainly a stale keep-alive socket after the long client-side 30,000-row build in test 11; the same test passes alone. The builder's "all pass" is not reproducible, and a flaky exit suite is not a gate (fix: new connection per call or retry the reset).
- In off/out modes tests 2 to 14 mostly assert the door is shut (that is correct for "off"), 11 to 14 take ~20 ms.
- Break checks (my copy only): changed "Nothing would change." -> exit.test criteria 4 and 9 fail, exit 1; U87 fails on both widths, exit 1. A `throw` in app/server.mjs -> every exit test fails ("the app did not start (1)"), journey script exit 1. Good: no filtering, no stale results, honours exit codes.
- Nit (core file): tests/journeys.mjs waits on `stdout.once('data')`, so a failed start hangs rather than fails.

## 3. Exit criteria
1 Requirements hold: WEAK. Test 1 and journeys cover them, but U19's Table/Board/History checks and F7/F8/F17/N5 are not done.
2 Journeys and checks: WEAK. DONE 9, PART 3 (U19, U46, U72; JOURNEYS.md says PART 4, its table shows 3), NOT BUILT 4 (F7, F8, F17, N5; the kit gives no steps).
3 Export file names, one press: VERIFIED (test 3, U19).
4 Round trip changes nothing: VERIFIED (test 4; fails when the sentence is broken).
5 One wrong row saves nothing, row named: VERIFIED (test 5, U20).
6 Rows to fix, Problem first, leaving out takes dependents: VERIFIED (test 6, U88, U96).
7 Status edited on two rows, unread column named: VERIFIED (test 7, U89).
8 Fourteen-row typo is one question: VERIFIED, but tested with "Observabilty" (the kit workspace has no Platform).
9 Template loads back, examples counted: VERIFIED (test 9, U87).
10 Field table same as Faro's: VERIFIED against the kit's table (test 10).
11 Speed: VERIFIED (test 11 ran 6.6 s for both sizes).
12 import.csv: VERIFIED (harness 70/70).
13 Undo 14 back and 1 stays: VERIFIED by U90 and by test 13 run alone; exit test flaky as above.
14 Large file: WEAK. "Never stops for 200 ms" is measured as the server answering in under 200 ms (server drawn pages, worker thread); no main-thread measure. Stop, 2 files of 5,000 and the 3,000-element cap are exercised.

## 4. Core journeys
tests/journeys.mjs: 30 of 30 pass with the module on, with FARO_WITHOUT=spreadsheets, and with FARO_OFF=spreadsheets. tests/platform.mjs: 37 checks pass.

## 5. GAPS.md and CORE-CHANGES.md
Kit gaps (real): S9-5 (stage-2 page doesn't say the result carries `examples`; import-issues.md says it, change-engine.md doesn't); S9-15 (no Activity place in module-platform.md places); S9-16 (platform: "Routes: its pages" only, no POST, upload, download, params); S9-17 (Help guide holds module articles; nothing says to drop them with the module); S9-18 (F7, F8, F17, N5 steps linked to src/ files); S9-12 (no "Platform" typo case in workspace.json); S9-3 and S9-4 (no import.csv case for a whole Stop row or an unchanged People sheet from a non-admin; export-format.md Action rows only hint at it); S9-9 and S9-10 (U89 setup and Start here layout unsaid).
Builder's choices, not kit gaps: S9-1 (the answer codes are in import.csv's `answers` column; the builder only had to map labels to them, which import-issues.md shows beside each label), S9-2 (remembering answered questions is module-side by design), S9-7 and S9-8 (preview words are screen-level and acknowledged unscored), S9-14 (a kit-wording stretch, 200 ms read loosely), S9-19 and S9-20 (core Data/People screens the stage-3 outline never required), S9-6 and S9-11 (builder left Plan Week N and the worked-out columns unbuilt; the kit has them in export-format.md lines ~106 onward).
CORE-CHANGES (12 items across engine.mjs, server.mjs, pages.mjs, state.mjs): engine ones (`__line`, SHEETS export, 80-char rule, sameAsGoal, non-admin People) are kit gaps in the stage-2 conformance (rows the kit doesn't test), so stage 2 passed at 100% while wrong; the server/pages/state ones (params routes, uploads, Activity entry, Help leaving out the article, FARO_OFF) are platform gaps. `activityEntry` is a new extension point the kit should define.

## Top kit gaps
1. Module platform: no POST/upload/download/param routes, no Activity place.
2. Stage-2 conformance lacks cases for Stop rows with other cells, non-admin unchanged People rows, examples counted, and the 80-character rule on unedited names.
3. No stage-9 drill CSV; module scoring rests on the builder's own tests.
4. F7, F8, F17, N5 and the ease-test checkpoints have no steps in the kit.
5. Preview words (headings, buttons, left-out lines) live only in Faro's eval scripts.
