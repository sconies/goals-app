# Kit-only review: stage 7, Metric library (kit 752d6c97)
Reviewed in S/rev-m7-metrics (copy). Faro app source not read.

## Scores
- `npm run drill` with `"also":[...,"metrics"]`: 323058/323058 cells, 45490/45490 rows, metrics.csv 124/124, contracts 14/14. PASS.
- Core journeys (tests/journeys.mjs, 30 runs) pass on, FARO_OFF=metrics, FARO_WITHOUT=metrics. tests/platform.mjs 37 checks pass all three (needs a changed port here: 48934 was taken by something outside this session).

## Test honesty
- exit.test.mjs 22/22 pass. A start failure rejects before(); every mode is started. Mutation: "can't" -> "cannot" in the sheet's unit message fails tests 10 and 21 (exit 1). Test 10 runs the real harness on metrics.csv, so it is honest.
- journeys.mjs: the builder says 22 of 22; I get 21 of 22, repeatably. U81 phone fails ("its page says Against plan": the phone layout drops the header). Exit 1, so the script is honest; the JOURNEYS.md claim is wrong.
- journeys.mjs with an unknown id (U999) runs nothing and prints "Every journey run passed", exit 0 (the "no journey ran" hole). N29 and F15 are weak (F15 only checks the phone).
- Journeys are a subset: 8 DONE, 10 PART, 3 NOT BUILT of 21 (stated).

## Exit criteria
1 WEAK (many requirements built at the module's own level, core places missing). 2 NOT MET (3 NOT BUILT: U145, U160, U72; 10 PART). 3 VERIFIED. 4 VERIFIED. 5 VERIFIED. 6 VERIFIED. 7 VERIFIED (all other CSVs unchanged at 100%). 8 VERIFIED (test 8, FARO_WITHOUT). 9 WEAK (carry function only; no Start next year). 10 VERIFIED (124/124; see caveat). 11 VERIFIED but U81 phone fails. 12 WEAK (a select, not find-by-typing; no Check row). 13 VERIFIED. 14 WEAK (checks on one refusal line, not under each field). 15 WEAK (no link form, parts not offered under a field). 16 WEAK (no dashed mark on the chart). 17 VERIFIED. 18 WEAK (reading rows pass; DEMO_SERIES proved for 2 slices; "source contract" has no file in the kit). 19 WEAK (no one table, no receipt line). 20 NOT MET (History, agenda, sheet columns, get_goal not done). 21 WEAK (own /metrics/sheet, not Data import). 22 VERIFIED.

## metrics.csv: does the pass rest on invented inputs?
Yes for the 15 `sheet` rows. The kit has no input for them: README line 78 lists find/goals/needs/still/parts/ends/reading only, and `measured` and `sheet` are described nowhere except the column list (line 48). The builder read case names and outputs off the harness diff and wrote the input rows in `conformance.mjs` SHEET_CASES to fit.
- Where the expected text forces the input, the fit is real: unit-on-used ("in hours", "1 goal"), meaning-on-used ("Lead time for changes"), bring-back-in-use ("CI compute cost per pipeline run"), structure-loop, parent-unknown.
- Where it doesn't (adds, changes-caveats, retire, structure, level-no-parent, name-twice), the row is only a count plus "1 new metric" / "1 metric changed" plus saves/refused: nearly any input gives it.
- So those rows prove the planner's words and counts, not that Faro's own rows give them, and not the row-numbering convention or order of issues beyond one example. They are 15 of 124 rows (12%) and 0.005% of cells, so the 100% headline is barely moved; the sheet claim (criteria 21, 22) is soft. The `find` rows have the same flaw in another form: all 17 asks were learned from the missing-row diff (real asks, but not derivable from the kit), and 13 `measured` rows were likewise learned. Roughly 45 of 124 rows (find, measured, sheet) had their questions learned from the diff.

## Builder gaps vs kit gaps
- Builder's mistake: CORE-CHANGES `checkin.number` and `goal.sections` "declared but never drawn": module-platform.md lines 36, 43 list them; the stage-3 core should have drawn them. The `milestone ReferenceError` is the core's own bug. `goal.measure` ordering: line 39 says it is after "How it's measured".
- G7 (worst first): rule 2 words it ambiguously, unproven (real kit wording gap).
- G11 (no Import, Undo, receipt, Start next year, History line in core) is a kit gap: stage 7 entry criteria assume them, stage 3 doesn't build them.
- G12: "after a core save" hook and workspace.about are not in module-platform.md PLACES (real kit gap).
- G1, G2, G3, G4 (conformance README), G5 (DEMO_SERIES only in src), G10, G15: real kit gaps.

## Top kit gaps
1. No metric-cases input and no description of the sheet and measured rows in conformance README.
2. Stage 3 core doesn't supply what stage 7's criteria 12, 19, 20, 21 sit on.
3. No after-save hook or workspace.about place in module-platform.
4. DEMO_SERIES and rule 2's range-goal words, worst-first order.
5. No stage 7 drill beyond metrics.csv; no source contract file.
