# Review: m12-wrap-up (stage 12, Wrap-up)

## Scores
- Harness (S/pin drill, drill.json as shipped, stage 3 + also changes/import/status/flags/projection/scorecard/checkin): 100.0%, 45366/45366 rows; contracts 14/14. The module has no CSV (kit has none), so the harness scores nothing of the Wrap-up itself.
- exit.test.mjs 18/18 (6 criteria x on / off / left out via FARO_WITHOUT); rules.test.mjs 4/4; journeys.mjs 6/6 runs (U10, U166, N22 at phone and desktop); platform.mjs 37 checks pass.
- Core journeys: on (U64 failed once under 4 parallel runs, passed on 2 of 3 clean reruns; known core Back race), switched off (FARO_OFF) pass, left out pass.

## Test honesty
- Mutation: Home's wrap-up lead ignores the switch -> exit criterion 4 fails (off, out), exit 1. BUT journeys.mjs still passes all 6: the journeys do not catch a Home lead leaking while off.
- Mutation: read-back "from Cycles" -> "from Settings": criterion 5 fails, rules.test fails; harness unaffected (100%).
- app/server.mjs throws on load: exit tests 0/18, journeys print "FAIL: the app did not start", exit 1. No filtering, no stale results.
- Weak spot: criterion 2 runs the journeys only for "on"; U10 is PART (set-up substituted, search used for "Lead time for changes").

## Criteria
1 VERIFIED: RETRO (early refusal, owner-only, tool refusal, 2 retros logged as the owner's, start-next carries/stops) and WRAP-UP-OPTIONAL exercised; window (opens 21 Dec, closes 31 Jan) in rules.test.
2 WEAK: U166 and N22 (Wrap-up part) DONE, U10 PART (no equivalent of Faro's browser store; found by search).
3 VERIFIED: /retro and /retro/ns-mttr 404 with exact sentence; tools still listed off, refuse with the module sentence, absent when left out; Help article gone.
4 VERIFIED: Home "Wrap up your 2 goals" only on; off shows "2 check-ins to do"; no "Wrap up this goal"; save 400 "Wrap-up is off in Platform Engineering."
5 VERIFIED: acts at once with nothing written/not open; with wraps written, the four lines exact, nothing switched until confirm.
6 WEAK: the core has no Met / Met late / Not met result at all, so "results as before" is only status. Builder checked G-1 status plus one goal in 2027. My wider check (126 goals x 2 days x on/off/left-out/on-with-40-wrap-ups, before vs after starting 2027): 1008 get_goal reads, 0 changed; 756 on-vs-other reads, 0 differ. Holds for what exists.

## Claim check: remove_team
FALSE. spec/core/actions.md line 26 (index) and line 363 (saveRetro's "AI tools that do the same") both name `wrap_up_goal`. `remove_team` is removeTeam's tool (lines 60, 1245). GAPS.md WU2 ("KIT WRONG") is the builder's misread; the builder's own spec copy is identical to the kit.

## Gaps: builder vs kit
Builder mistake: WU2 (above). WU20 builder guessed right from data-model. WU15, WU18 are out of scope or trivial.
Real kit gaps: WU1 (stage 12 entry says Cycles/start/carry are the core's but stage 3 never asks for them: builder built a Cycles module into the core); WU9/WU10/WU11 (no places for Goals/Cycles links, module-chosen off sentence, module-scoped Help: platform gaps, as m11 found); WU4/WU13/WU14/WU22 (suggested result, result rule, plan end, scopeToCycle never specified); WU16 (U10 set-up is Faro's browser store); WU3/5/6/7/8/12/19/21 (words not given).

## CORE-CHANGES (8 files, one new)
Mostly stage-3 shortfall: cycles/two-year state, retros, :param module routes, Help marker, read-back hook. Not builder error.

## Top kit gaps
1. Stage 3 lacks Cycles, start-next-year, retros and a result (Met/Met late/Not met) while stage 12 and criterion 6 assume them.
2. Platform extension points: places on Goals/Cycles, module's own off sentence, module Help.
3. No conformance rows: nothing scores the wrap-up's words or rules; journeys miss a Home leak while off.
