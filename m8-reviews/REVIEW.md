# Review: m8-reviews (stage 8, Reviews), kit 752d6c97

## Scores
- Harness (own drill.json, `also` has reviews): 100.0% (321488/321488 cells), reviews.csv 91/91, contracts 14/14.
- Core-only home/navigation/readback/find: run by hand on core-only/workspace.json. home, readback, find identical; navigation has only extra "(Feedback off)" style rows, none missing.
- tests.mjs 24/24; tests/platform.mjs 37 checks (needed a free port; it is hard-coded to 48933); core journeys pass with Reviews on, FARO_OFF=reviews, FARO_WITHOUT=reviews (one run of "left out" failed once and passed on rerun: flaky).
- exit.test.mjs: 11 pass, 1 fail (criterion 2, U103). Reproduced.

## Test honesty
- Mutating "Nothing is deleted." in the app: U103 failed on both widths, exit 1, criterion 2 failed. A syntax error in server.mjs: journeys print "The app did not start." and exit 1; exit.test fails. No filtering, no results file.
- Weak spots: criterion 2 drives 6 of 17 journeys; criterion 5's test only checks the lead says no "review", never what it says (so it passes while U103 fails); criterion 11 tests pure functions (workbookShape, importNotice) that nothing in the app calls (0.4 ms).

## Exit criteria
1 WEAK (words for list states, cadence, agenda, REVIEW-SPEAK, REVIEW-DECIDE guessed, G7/G8/G18-G20). 2 NOT MET (U103 fails; U3, U30, U36, U47, U49, U63, U80, N1 not built; U72, U79, U67 partial). 3 VERIFIED (navigation.csv rows, test 3). 4 VERIFIED (N21, writes refused). 5 NOT MET (lead is Rhea's ask, not "Goals you watch · {n} need attention · See them"). 6 VERIFIED (U103 read-back, Undo). 7 VERIFIED (U104). 8 VERIFIED (reviews.csv 100%; receipt unproven, G21). 9 VERIFIED. 10 VERIFIED (readback row). 11 WEAK (see above). 12 VERIFIED (U155).

## G11 (builder's claim: U103 contradicts Home rule 5 and core-only home.csv)
Half right, misdiagnosed.
- Right that U103 (modules/reviews/journeys/U103.md line 40: "It fails if Home's lead is not 'Goals you watch · {n} need attention'") conflicts with the letter of core/rules/home.md rule 5 (line 16: a no-date ask waiting 7+ days leads) and the worked example at line 43.
- Wrong that core-only home.csv agrees with rule 5: core-only/home.csv lines 30-43 give Amara `attention` ("44 goals need attention") on every day, not `ask`. Only the all-on home.csv (lines 30-33, 35-42) says `ask`. The builder's own home.mjs lines 155-160 already put the attention lead before the ask, but only when Watching is off (`!on('watching')`).
- Kit data are consistent with one reading: attention/watch lead precedes a waiting ask when Reviews is off (all-on: ask; core-only: attention; U103: Reviews off, watch lead; stage-8 criterion 5 names the lead). I changed the condition to `!on('watching') || !on('reviews')` in a copy: home.csv and core-only home.csv still 100%. So the builder had a fix available and called it a kit contradiction.
- Real kit gap underneath: home.md lists no `attention` lead kind (README line 86 lists five kinds, no `attention`) and no precedence for it or for the watch lead.

## Gaps verdict
Builder mistakes: G10 (U103.md says "tick box" and uses getByRole('checkbox'); the kit does say it), G11 (above), G1-G3 (guessed right, cheap), G16 (picker is kit-described in U13/U63, not built), G15/G14 (declared, not built, not kit's fault), G9 (module-platform.md lists :param routes; the stage-3 core should have had them).
Real kit gaps: G5 and G7 (words only in src/), G12 (offSpell only named in src), G13 (places for Home lead/Next review cell not in platform: stage-8 gap 3 says so), G19, G21 (rules.md RS1 vs core receipt reads two ways), G22, and the unlisted `attention` lead (above).
CORE-CHANGES: all generic hooks are reasonable; changes to main.mjs/state.mjs/pages.mjs to run a module's drill, `FARO_OFF`, `FARO_WITHOUT` and checkbox/read-back are things the kit should have in module-platform.md (the Features read-back and Undo are in its "Turning a switch" section, so partly builder's reading).
