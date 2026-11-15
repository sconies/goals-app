# Review: m10-tags (stage 10, Fields, kit pin 517e3d04)

Method: kit only. Rebuild copied to kit-517e3d04/rebuild; ports 47400-47990.

## Harness
`npm run drill -- <m10-tags>` (stage 3 + also ...): PASS 318,703/318,703, 14/14 contracts. This does NOT score tags.csv: pin's scripts/drill.mjs ALSO list has no `tags` (and spec/rebuild/drill.mjs has 0 mentions), although conformance/README.md says "scored when asked (also: [tags])". The builder scored it with the harness's own `scoreAll`/`report` (modules/tags/score.mjs): I ran it, 25/25 rows, 150/150 cells, PASS (exit 0).

## Own tests
- `node --test --test-concurrency=1 modules/tags/exit.test.mjs`: 26 pass, 0 fail, 0 skipped (13 criteria x on and off).
- Journeys (`journeys.cjs`, own server): U174 9 steps, U177 7, U178 2, N34 2 all DONE, exit 0. Honest: `check()` records failures, `process.exit(bad ? 1 : 0)`, and the exit test asserts `r.status === 0` and never reads a results file (no stale-file risk). Mutation: renaming "Show the goals" in the app made U177 PART and exit 1.
- Weakness: criterion 2 "(on)" and "(off)" run the same app; mode only picks the journey ids. N34's steps are the builder's reading of one table line (not in kit).

## Exit criteria
1. Requirements TAGS-FIELDS/FILTER/SHEET/OFF: VERIFIED (criteria 5-13 tests, on and off).
2. Journeys U174, U177, U178, N34: WEAK. First three VERIFIED by Playwright on phone and desktop; N34 invented from one line; U174 uses a select where the journey says a search field; seedStage's goals guessed.
3. fieldProblem/valueProblem examples and tags.csv: VERIFIED, but only via the builder's workaround (the real harness can't score it); 25/25 after 2 runs (run 1: 2/25).
4. DB refuses over-40 name, bad kind, 0/21 values, text with values, value >80: WEAK. The rebuild has no database; constraints are checked in the module's own `saveRows` against names from schema.sql. Self-asserted.
5. U174 by hand: VERIFIED (No fields yet, Add a field, "A list: Discover, Build, Run", "Stage · Build", History "Stage: Discover → Build").
6. Who may do what, seventh field, duplicate name, unknown value, app and tools: VERIFIED.
7. Retire and bring back keeps values: VERIFIED.
8. Next year copies values; leaving copy or undone start clears: WEAK. The core has no start of year (U117 NOT BUILT), so only the module's carry/markRemoved/restore functions are tested directly.
9. Switched off: VERIFIED (no block, menu, 404 with the sentence, no filter, no column, tools refuse, comes back on).
10. filterGoals worked examples: VERIFIED (and tags.csv filter rows).
11. U177 incl. saved view and Data column: VERIFIED (the builder added saved views to the core to do it).
12. U178 workbook round trip, Operate asked once, added, History via spreadsheet: WEAK. Uses a CSV Goals sheet, not a workbook (no Spreadsheets module in this core); admin Add vs non-admin leave-empty covered.
13. find_goals' fields parity and refusals: VERIFIED (refusal wording invented, T-18).

## GAPS.md: kit gap or builder's mistake?
Real kit gaps:
- T-1 harness can't score tags.csv (kit says it can): real, and the most important. T-2 tags.csv inputs exist only in the expected file, so the builder had to learn cases from diffs (the harness prints expected answers): real.
- T-3/T-4/T-5/T-6 refusal sentences ("Keep Programme to 80 characters.", "A list holds at most 20 values.", free-text-with-values, non-admin question): the kit gives the limits (rules.md lines 21, 34-36) but not these sentences or the non-admin question. Real.
- T-10 seedStage records, T-15 N34 steps, T-16 screen parts not in screens.md, T-12 "workbook" without Spreadsheets, T-13 MCP/AI-access, T-14 (G-48 141-char name vs the 80 limit makes the demo not round-trip), T-21 entry criteria name Faro code and a core a rebuild doesn't have, T-8/T-11/T-18/T-19/T-20 unspecified words: real.
- T-22 VERSION: entry criteria assume a core newer than the 2fce09b4 one. Not a kit fault; a stage-ordering one.
Builder's mistake: none clear. T-17 (three off-sentences) the builder used each where its page says it, correct. T-24 undo of a field's values is the kit's own stated gap.

## Top kit fixes
1. Add `tags` to the harness ALSO list and `--files` (or remove "scored when asked" from conformance/README.md); ship tags.csv's inputs (as change-cases.json does) and do not print expected answers in diffs.
2. Put the refusal sentences (80 chars, 21 values, text with values, non-admin Operate question, who-may) in rules.md.
3. List seedStage's records, N34's steps, and the screen parts the three journeys name (screens.md).
4. State what a module needs from the core as a contract (extension points, Features, Filters sheet, saved views, Data Goals table, import screen, MCP host), since a stage 1-3 rebuild has none of them; say what "the database" means for a rebuild with none.
