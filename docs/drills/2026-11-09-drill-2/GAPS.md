# GAPS: stage 1 rebuild drill

Files: `main.mjs` (reads workspace, writes the five CSVs), `rules.mjs` (all rules, pure), `tests.mjs` (my own tests of the worked examples), `drill.json`.

## Scoring rounds

| Round | Overall score | Rows | Note |
|---|---|---|---|
| 1 | 99.9% (360106 of 360109 cells) | 43370 of 43373 | status, flags, projection, checkin 100%; scorecard `sub` 3 rows off (negative zero) |
| 2 | 100.0% (360109 of 360109) | 43373 of 43373 | PASS, after removing my own "-0" fix |
| 3 | 100.0% | 43373 of 43373 | PASS again, after tidying the check-in rule for refused numbers and the message wording (see below), run for the exit criteria |

`node tests.mjs` passes (worked examples of weeks and plans, projection, status, check-in, numbers and names, scorecard words).

## (a) Guesses settled by the spec's words alone (the score then confirmed them)

Where the words were enough, I list the few places that needed judgement and what I chose.

1. **Which check-ins each rule sees** (status.csv, flags): the "Two cuts" and "two different latest check-ins" notes in conformance/README.md said it. Official status, greener, latest_week, flags, trend: posted by the moment, any week, latest by `postedAt`. Calculation, projection, scorecard: also week <= w, latest by week then `postedAt`. Said clearly; no guess.
2. **Tie-breaks in ordering** (same week and same `postedAt`, or equal `postedAt` for "latest"): not stated. I used the later one in file order for the official latest and a stable sort for week order. No row hit it, so the score cannot tell. Page: weeks-and-plans or status (a one-line "ties go to the later record in the file").
3. **`greener` in status.csv when the call is `done`:** I used the plain rank comparison (done 0 < calculated on 1), no special case. Score confirmed (or never exercised). Words (ranks list) were enough.
4. **Metric projection series:** "all of them, even two in one week" plus the judged number. I took every check-in up to week w with a number, sorted by week then posting. Right. Range projection uses one number per week, latest posted wins; I filter to check-ins with a number before picking the week's latest (the page says "latest check-in of each week", not whether a number-less later check-in hides an earlier numbered one). Score did not tell the difference. Page: projection.
5. **A metric whose latest check-in has no number:** I give status `none` and no projection (the page says "No number: none" but not about the projection). Confirmed by the score. Page: projection / status (one line).
6. **Projection when the spread is numerically zero:** I treat spread < 1e-12 as 0 (lean 1). Spec says "infinite when the spread is 0" but not how to treat float noise. Harmless at the 1.5e-6 tolerance. Page: projection (a "treat a spread under 1e-12 as 0" note would remove the doubt).
7. **Projection `to_week` for a number to move:** the `endWeek` of the plan as of the latest check-in's week (so a re-baselined plan can differ from the current plan's). The words said it ("endWeek of the plan as of the week judged, the latest check-in's"). Good.
8. **Held projections:** which plan numbers decide "share"/"count": start, target, hand-set points; for a range the limit alone. Words were clear. For the trend override I used the current plan; for the scorecard, the plan as of the latest check-in's week. Both consistent with the pages.
9. **Direction `better` for a number goal:** the scorecard page says the current plan's target >= start gives +1; the trend page says "target above the start". The two differ only when target == start, which does not occur. Chose each page's own wording. Page: flags/trend could say "the same direction as the scorecard".
10. **Handled/"look" details:** (i) "someone other than the owner" applies to acknowledge/note only (stated); (ii) "strictly after postedAt" is a text comparison of ISO timestamps, and "on or before today's date" a comparison of the UTC date (stated); (iii) for "the moment of the earliest look" I ran flagsFor with `today` = the look's own timestamp over the same workspace (stated); (iv) which looks count in "earliest": all qualifying looks of any kind (the words say "the earliest look", I took it as any kind). All confirmed by the 100% score on flags.csv. Page: flags could say "earliest of all the qualifying looks, of any kind" explicitly.
11. **`firstDueWeek`** for `due`: all goals here were created before the cycle started, so every goal begins in week 1 and the harder branch is not exercised by the data. I implemented it from the words and the three worked examples (3, 3, 4); tested by `tests.mjs`.
12. **Scorecard tones for no number** (`room`, `limit`, `plan`): the tone list says nothing for "no value yet" on `room`/`limit`; I used `flat`. Confirmed by the score. Page: scorecard (tones paragraph: "no number: flat for every cell").
13. **Tone of `done`/`late`/`next` and the milestone `since`-less layout:** the page says `since` is for both number kinds only; milestone cards have just done, late, next (the "in this order" lists made that clear). Fine.
14. **Likelihood floor with a count of decimals:** "half the goal's last decimal place" = 0.5 x 10^-decimals. Confirmed.
15. **`calculated` in checkin.csv for `done` milestones:** kept `done` (the page says on, risk, off or done). The call `done` vs a calculated `on` then counts as greener by rank (done 0 < on 1), I applied the rank rule as written without special-casing. Score confirmed (or unexercised).
16. **Bare draft vs "with the owner's call as posted":** I read "the same draft" as still bare (no cause, why, path, greener reason), so `missing` and `call_missing` differ only in `greener-why` and `path`. Confirmed by 100% on checkin.csv. The conformance README says it but a reader could think the posted why/path are attached; one sentence ("the posted words are not attached") would remove the doubt. Page: conformance/README.md or check-in.
17. **Check-in `reason` for the wrong-way-from-start case on a stepped plan** (behind = true with no ratio): I follow assessMetric's `behind`. Fine.
18. **parseNumber, typedDecimals, precisionProblem wording, setupProblem wording, farOutside, valueProblem messages:** These have no conformance rows. I followed the worked examples exactly (all pass in tests.mjs), and wrote plausible text where no example exists (the "refused" messages for below zero and over 100%, the "under a 100th" setup message, the exact plural of "decimal place(s)" and "keeps N decimal places"). **Unresolved by the kit** (see (c)).
19. **Names section of numbers-and-names** (`nameProblem`, `sameNameNote`, `personTell`, `avatarHues`, `goalTell`): not built; the stage page says only the worked examples need showing, and none of them touch names. The page gives no exact wording for the notes, so a rebuild could not match them anyway.

## (b) Learned only from the scorer's differences

1. **Negative zero in the scorecard's words.** Round 1 had 3 rows wrong, all `hit` sub lines: expected `likely -0 min by year end` / `likely -0 days by year end`, I wrote `likely 0 min...`. Cause: I had added my own "never show -0" normalisation to `n(v)`. The page says `n(v)` is "v to the goal's decimals (`toFixed`), thousands grouped"; plain `toFixed` of a small negative number to 0 decimals gives "-0", and that is what the real rule prints. So the spec's words were right and my addition was the error, but the page does not warn that "-0" is expected output, and the example "−0.40" there is a different case. **Which page:** scorecard.md "How a number is written": add "No special case for negative zero: -0.3 at 0 decimals reads -0." with a worked example (a projection of a count that dips just below zero for a goal with decimals 0 and a unit that is not held, e.g. `min` or `days`: the held rules do not clamp those). That was the only thing the scorer taught me.

## (c) Still unresolved or ambiguous in the kit

1. **Check-in worked example "140" (the 30->75 goal, week 4).** The page says the result is `value-impossible`. A literal reading of "what is still missing" would also list `reason-ahead` (140 is well ahead). I made any value problem judge the draft as "no number" (so only the value code is listed), which matches the example, but no conformance row exercises it (the demo's stored numbers are all valid), so the score cannot confirm it. I first built the opposite way (judge the typed number anyway) and the example test failed; I only changed it because the worked example said so. Page: check-in.md, say whether the other codes are still asked when the number is refused.
2. **Exact wording of refused/questioned messages that have no worked example** (below zero, over 100%, "far outside", plan bounds with units other than `%`): the page gives one example each only for "far outside" and "last week was"; I guessed the rest ("can't be below zero", "is over 100%"). Whether those numbers print at the goal's decimals or plain: the examples ("Is 294 right?", "30 to 75%") show plain numbers, so I printed plain numbers. Page: numbers-and-names.md / check-in.md, a full table of messages.
3. **Order of far-outside against "3x last week"** when both apply: the page lists far-outside first; I check it first. No example.
4. **`parseNumber` edge cases** beyond the 12 examples (e.g. "1 250", "+5", "5 %", "12.", ".5", "1,25" with two digits after the comma versus a thousands group of 3, a unit with digits like "m2"): I decided myself (a lone trailing point is allowed, spaces inside the number are not, unit = any non-digit text). Page: check-in.md "Reading a number" could list more cases.
5. **`setupProblem`** also covers "a billion or more", "below zero for a percentage, time or money" and "over 100%": I only implemented the 100x / 100th case that has a worked example.
6. **Names half of numbers-and-names:** no exact words, no examples, no conformance rows (as the stage page says). Nothing to check against.
7. **Sort order of rows**: irrelevant to the harness (rows match by key); I used the order the conformance page states.
