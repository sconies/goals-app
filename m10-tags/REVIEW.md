# Review: m10-tags (stage 10, Fields)

## Scores
- Harness (S/pin drill, stage 3 + also incl. tags): 100.0% of cells, 45391/45391 rows; tags.csv 25/25; contracts 14/14.
- tags.csv rows are computed by the module's rules (conformance.mjs), not copied; breaking `live: 6` -> 7 dropped tags.csv to 24/25 and failed exit tests 3 and 6.
- exit.test.mjs: 29 pass / 0 fail (14 criteria x on/off + left-out). journeys.test.mjs: U174, N34 pass (phone+desktop); U177, U178 FAIL (exit 1) honestly. Core journeys (30 runs) pass with Fields on and FARO_WITHOUT=tags; platform.mjs 37 checks pass.

## Test honesty
- Journeys exit 1 on any failed check; no filtering; a failed app start prints FAIL and exits 1 (seen when spec/ was missing). Exit tests exit 1 on app-start failure too.
- Mutation 1 (rules limit) caught by exit + drill. Mutation 2 (Block text "Stage · X" -> "Stage - X") failed U174, N34 and 5 exit tests.
- Weakness: exit.test criterion 2 only checks state is reachable (journeys are separate); criteria 8, 12, 13 are function-level only, so they prove the module's functions, not the screens. tags.csv fixtures were reverse-engineered from diffs (G1).

## Exit criteria
1 VERIFIED (goal block, filter line, Data column, off pages tested).
2 WEAK: U174/N34 done; U177 stops at Save this view; U178 not built.
3 VERIFIED (25/25, worked examples tested).
4 WEAK: JSON store; module's checkRow, no database.
5 VERIFIED (U174 both widths).
6 VERIFIED in app and tools (refusal words for who-may are guesses, G6).
7 VERIFIED.
8 WEAK: carryToCycle etc. tested as functions; core has no start-next-year.
9 VERIFIED (N34 + exit test; left-out build too).
10 VERIFIED.
11 WEAK: all but the saved view.
12 NOT MET end-to-end (no workbook/import; sheet.mjs functions only).
13 WEAK: functions only.
14 VERIFIED.

## Gaps: builder mistakes vs kit gaps
Builder mistakes / kit already says:
- G7 (value over 40): rules.md:19, records.md:21 give 40 for list values and 80 for stored text; only the sentence is missing.
- G4/G10: rules/records and U174 imply them; guessed correctly. G9 (taking a value out of a list that goals hold) is not said: real small gap.
- CORE-CHANGES: six core files changed is a stage-3 core shortfall (see G11), not a mistake.
Real kit gaps:
- G1: tags.csv case keys/fixtures absent (no tags-cases.json like change-cases.json). 
- G2/G3/G8: refusal sentences and check order not in rules.md worked examples.
- G5: seedStage missing from journeys.
- G11: extension-point hooks (goalFilters, Filters sheet, goalColumns, toolArgs, goal.sections viewer) only linked to src/.
- G12/G13/G14: stage 10 depends on SAVED-VIEWS, stage 9 import and next-year start, none of which stage 3 or the stage 10 entry criteria make a prerequisite. Also: stage page criterion 4 says "a value over 80" while rules.md has list values 40/text 80.
- G6/G15/G16: who-may sentences, off-import line sentence, how a module's limits reach the store: unsaid.
