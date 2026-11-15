# Reviews (stage 8): its journeys, tallied

Scripted in Playwright: `node modules/reviews/journeys.cjs [ids]` (starts its own app on :4873, resets the workspace before each width, prints the results as one JSON line). Each runs on a phone (390×844) and a desktop (1440×900), counts steps against the budget, and scores checkpoints (one main button, no sideways scroll, 44px main button on a phone, every shape beside its word). Exit test 2 runs it and fails while any journey isn't DONE.

**16 ids: DONE 6 · PART 6 · NOT BUILT 4** (U79 and N21 tallied by hand below).

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U3 | PART | 36, 36 / 30 | Goals' `.outcome-card` (the trees view) is the core's and isn't built. Each goal off track with no decision needs a next step before Reviewed & next (GAPS R-8), which puts it over budget. The rest holds: Home's ring, the list and the page agree before and after; ask with an empty refusal; note; Nothing flagged; Finish dialog; What was said; the question is an open ask, "by Marisol in Reliability weekly", For you, "Questions for you" on the owner's Home; logged |
| U13 | DONE | 9, 9 / 11 | — |
| U30 | PART | 1, 1 / 16 | Scripted: the review set-up survives a refresh ("Picked up where you left off") and Close without saving asks first and drops the draft. Not built: the one-table check-in's refusals ("isn't a number", "can't be over 100%") and the keyboard Map (core / Goal map module) |
| U36 | PART | 1, 1 / 12 | Scripted: Amara's Home "goals to discuss" equals the review's "Start review · {n} goals". Not built: Rhea's two-step check-in with "Still asking:" and "Keep this request open" (core) |
| U47 | NOT BUILT | — | The builders' feedback inbox (Feedback module) |
| U49 | NOT BUILT | — | Workspace set-up on a Sunday (core set-up isn't built); the review it makes and "Session Thu 12 Nov" would read from this module |
| U63 | DONE | 4, 4 / 9 | The "first suggestion" expectation is hidden (`{first}`); I check it is you |
| U67 | PART | 2, 1 / 6 | Menu groups, Reviews in the first group and the phone's tabs hold; the collapsed rail (`.collapse-nav`, `.rail-label`) is the core's and isn't built |
| U79 | PART (by hand) | — | History has a Reviews filter with its count, in the address (`history=reviews`), kept on reload; names of reviews are links while on, words while off. Not built (core History): "No check-ins (" runs, "The reason is above, under Why.", the week ordering, Show all |
| U80 | NOT BUILT | — | The Watch sheet, the comment box's reach sentence, "Ask Rhea a question" dialog and `.next-steps` (core goal page) |
| U103 | DONE | 6, 6 / 30 | — |
| U104 | DONE | 3, 3 / 10 | — |
| U154 | PART | 6, 6 / 14 | /help still names reviews in core articles' words (GAPS R-15). Rhea's second check-in is posted through the one form: "Keep … and say why" and the cause buttons are the core's and aren't built. The read-back's due line, and the receipt "…are in by Thursday." hold |
| U155 | DONE | 3, 3 / 6 | — |
| N1 | NOT BUILT | — | Its checks are in `evals/notes/1-reviews.cjs`, not in the kit (GAPS R-18) |
| N21 | DONE (by hand, title only) | — | Every switched-off address says so and who can switch it on, and the read-back counts what stays: exit tests 4 and 6. Its own checks aren't in the kit |
