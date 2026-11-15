# Kit-only review: stage 6, Goal map (kit 752d6c97)
Reviewed in S/rev-m6-goal-map (copy). Pin clean. App source not read beyond tests/journeys, module.mjs constants and map.css lines.

## Scores
- `npm run drill` (stage 3 + changes, import, status, flags, projection, scorecard, checkin, store contract): PASS 320578/320578 cells, 45366/45366 rows, contracts 14/14. The kit has no Goal map CSV or drill (conformance README lists none), so nothing module-specific is harness-scored; the rule's worked examples (kit spec/core/rules/map.md) are the only scored-by-hand data, and map.test.mjs reproduces them.

## Test honesty
- exit.test.mjs: 14 pass / 0 fail. journeys.mjs: 10 runs (5 journeys x 2 widths) pass. Core journeys (tests/journeys.mjs) pass with module on and FARO_WITHOUT=goal-map; platform.mjs passes both ways.
- journeys.mjs, unlike stage 4's, handles a failed start (prints FAIL, exit 1) and "no journey ran" (exit 1). exit.test before() asserts the app started. Good.
- Mutations: OFF sentence reworded -> journeys U165 and 5 exit tests fail (exit 1). Threat off 4 -> 1 -> map.test fails 2. Critical path stroke-width made equal to normal -> 14/14 STILL PASS: the bold check falls back to 1 when no non-critical feeds edge exists, so the bold assertion is weak. Case-only change of the sentence ("list") also passes journeys (getByText is case-insensitive); exit test catches only with real wording changes. Journeys are a subset (JOURNEYS.md says so).

## Exit criteria
1. WEAK: GOAL-MAP mostly verified (126 goals, folded, Fit all, fold/unfold, troubled, search, story, Delete); "bold" not truly tested; "draws at once, refits" unasserted; MAP-OPTIONAL verified.
2. NOT MET: 2 DONE (U26, U165 map half), 5 PART (U30, U34, U134, U135, N22), 3 NOT BUILT (U39, U90, F6).
3. VERIFIED: five layouts on, four off (also on Table/Board/History/Map addresses), no "Map" text on Goals.
4. VERIFIED: sentence once, address drops view, back on opens Map; left-out build says nothing.

## Gaps: builder mistakes / overstated
- GM12/CORE-CHANGES 3: the guide's format "`goal-map`, from the goal-map module." is uniform in help-guide.md l.542; the stage-3 core's parser was wrong. Core defect, not a kit gap.
- GM2/GM1 in part: stage-3 core chose `layout=`; GOALS-ADDRESS names "the layout" and the module journeys/stage 6 page say view=map, so the builder's own core was the outlier.
- GM4, GM5, GM6, GM18: rule text and worked examples fix them (GUESSED-RIGHT is fair).
- GM13: rule says "as large as fits" and Readable >= 75%; builder's 17% at 126 goals is within the rule's own wording.

## Top kit gaps (real)
1. No `goals.layouts` place in module-platform.md (only goals.tools); stage 6 says layouts are the core's, so CORE-CHANGES 2 is forced.
2. Stage 3 does not build what U39, U134, U135, U34 need (walkthroughs, proposed state, View sheet, Group/Views menus, "N needs attention:") nor the roll-up (GM3); stage 6 entry says they exist.
3. F6 has no steps; U90 belongs to Spreadsheets but is listed here.
4. Rule gaps: "gap" undefined (GM8), score "times one half plus its share" ambiguous (GM4), who owns the Map's search box (GM11).
5. No Goal map drill/CSV; class names/selectors contract only via journeys (GM9).
