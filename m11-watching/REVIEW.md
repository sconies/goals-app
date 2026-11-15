# Review: m11-watching (stage 11, Watching)

## Scores
- Harness (S/pin drill, drill.json as shipped, stage 3 + also incl. changes/import/stage-1 files/watching): 100.0% cells, 45429/45429 rows; watching.csv 63/63; contracts 14/14.
- Core-only (`--expected spec/conformance/core-only`) with contracts removed and `also` cut to files core-only holds: 100% (145/145). With the shipped drill.json: scores nothing, prints "No contract store ... core-only/contracts; there are none." (exit 2).
- exit.test.mjs 7/7 pass (on, off, left out via FARO_WITHOUT). journeys.mjs 12/12 runs (U164 U9 U80 U8 U16 U73, phone+desktop). Core journeys pass on and with FARO_WITHOUT=watching (one U64 desktop flake once, 4 clean reruns); platform.mjs 37 checks pass.

## Copied vs computed (the disclosure)
watching.csv is computed: drill.mjs calls rules.mjs (liveWatches, coverOf, watchedIds, watchingOffReadBack) on the workspace; no literals. Mutation: level cover `g.level === ref && false` -> 60/63, covers 95.2%, three diffs shown. Mutation: read-back owners no longer exclude stopped goals -> still 100% (that is G9, the demo cannot tell; honestly disclosed). Nothing looks copied from the 3 lines seen.

## Test honesty
- Mutated "Nothing is deleted." wording: exit criterion 6 failed, journeys exit 1 (2 runs failed). A throw in app/server.mjs: exit tests 0/7 pass, journeys "FAIL: the app did not start", exit 1. No filtering, no stale results.
- Weakness: criterion 6 asserts rule examples as functions plus the dialog; criterion 2 is HTTP-only for U9/U80/U164.
- Core test change: U2's "Goals you watch" check skipped when FARO_WITHOUT includes watching (keyed on the env var in the test process). Reasonable, but the journey's own text is changed by the builder.

## Exit criteria
1 WEAK: three requirements checked (watch kinds, /watching -> scope=watching, toolbar, one Home block); no What changed column.
2 WEAK: U164 DONE; U9 U80 U8 U16 U73 U7 N22 PART; U31 U90 U103 F1 NOT BUILT (all blocked by core lacking Activity watching, imports, Home watch lead).
3 VERIFIED (404, both sentences, tools list while off, Help article hidden).
4 VERIFIED (remembered tab opens Mine/All, no block/button/Watched by, "Watching is off in ...").
5 VERIFIED ("{n} goals need attention · See them", on and left out).
6 VERIFIED (counts, worked example, dialog, Cancel, acts at once with no watch).
7 VERIFIED (every person's watch ids identical after off/on).

## Gaps: builder vs kit
Builder mistakes / kit already says:
- G5 sentence: module-platform.md row 101 names "Watch and Stop watching ... 'Watching is off in {workspace}.'"; only the dispatcher hook is missing (real, small).
- G6: not the builder's; README ONE-WATCHING says show=watching while all journeys say scope=watching. Kit inconsistency, builder chose right.
- G13: kit gives the id `watching` (README Help articles row); builder's core filed it as `watching-goals`, a core issue.
- G12/G9: tolerable guesses; unscored.
Real kit gaps:
- README "What it adds to the core" lists Places "none", Needs "none", Navigation "none", yet Watching adds a Goals scope, goal.facts/sections, Home blocks, Features line and read-back (G1, G3, G4). Biggest gap: module.json's table is wrong/empty and src/ links can't be followed.
- G14: core journey U2 checks a Watching element; kit doesn't say core journeys must tolerate module-off.
- G7, G10, G11: words for sheets, tools' data and log entry not in the kit.
- No watching cases for stopped goals / left people in the demo (G9) so the CSV cannot prove them.

## CORE-CHANGES (8 files)
Mostly a stage-3 platform shortfall: no Goals-scope extension point, no module-chosen off sentence, no Features line/read-back hook, no module-scoped Help. Generic, none names Watching. Not builder error.

## G15: harness bug, not the rebuild layout
scripts/drill.mjs line ~411 reads contracts from `<expectedDir>/contracts`; with `--expected core-only` that folder has none, so it exits 2 before scoring. Also `also` naming files absent from core-only (changes, watching...) crashes scoreFile (null reading '0'). The rebuild's layout (contracts: store) is correct: the same code scores 100% for the full run.
