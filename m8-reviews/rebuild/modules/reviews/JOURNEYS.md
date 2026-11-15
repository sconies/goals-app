# Reviews' journeys and checks, against this build

Driven in a real browser at both widths by `modules/reviews/journeys.mjs` (exit 1 on any failed check; no filtering, no stale results). Criterion 2's test runs it.

| Id | Tally | What happens |
|---|---|---|
| U103 | PART | Driven. Every check passes but one: with Reviews off, Amara's Home lead is “Needs your response” (Rhea's decision ask, open since 28 Jul, leads by core/rules/home.md rule 5 and core-only home.csv), not “Goals you watch · {n} need attention” (GAPS G11). Read-back, Cancel, switch off, menu and tabs, no review cell, addresses off, History keeps “Platform leadership weekly”, the next step stays on Home, logged, Undo: pass. |
| U104 | DONE | Driven, both widths pass. |
| U154 | PART | Driven: the read-back's due-day line and no accepted-risk line, then nine pages Rhea opens with no deadline or session named as a review: pass. Her two check-ins and the receipt (the core's step-by-step check-in) are not driven. |
| U155 | DONE | Driven, both widths pass: off Monday 2 Nov, on Friday 6 Nov; neither Reviews nor Home says Not held yet; the weekly says “Next on Thu 12 Nov”. |
| U13 | PART | Driven, both widths pass, but people are typed as ids (“jun, mateo”), not found with the picker (U63 not built); levels are tick boxes. |
| N21 | DONE | Driven, both widths pass: the read-back counts what stays; five review addresses say the switched-off sentence. |
| U3 | PART | Not driven. Built: the agenda (needs attention first, then worst and stalest), Start review, the walk on each goal page with Previous/Next, Mark reviewed, a note, a question to the owner, a next step with who and by week, accepting the risk, a goal behind can't be marked reviewed without a decision, the summary (“What was said”). Not built: the reviewbar, the healthy group (“Nothing flagged”), the Finish dialog, “Questions for you” on Home. |
| U30 | NOT BUILT | A review set-up that survives a refresh: no draft is kept. |
| U36 | NOT BUILT | Not tried. |
| U47 | NOT BUILT | The feedback inbox (another module). |
| U49 | NOT BUILT | Workspace set-up is not in this build. |
| U63 | NOT BUILT | The find-and-pick picker. |
| U67 | PART | The menu groups and phone tabs are the core's (navigation.csv at 100%, with Reviews on and off); not driven here. |
| U79 | PART | History names the review a note was said in and filters “Said in reviews”; missed weeks and links to an entry not tried. |
| U80 | NOT BUILT | Watch and comments' words (Watching / core). |
| U72 | PART | The review set-up has one closing control, “Close without saving”; it doesn't ask first when something is typed. |
| N1 | NOT BUILT | Its steps are in evals/notes/1-reviews.cjs, not in the kit. |

Tally: 3 DONE, 7 PART, 7 NOT BUILT (of 17).

The core's own journeys (`tests/journeys.mjs`, 10 journeys × 2 widths) with Reviews on, switched off (`FARO_OFF=reviews`) and left out (`FARO_WITHOUT=reviews`): see the last run below.

Last run of the core's journeys: Reviews on, every journey run passed (exit 0); switched off, every journey run passed (exit 0); left out, every journey run passed (exit 0). U69 now reads the switch (CORE-CHANGES.md).

Last run of `node --test modules/reviews/exit.test.mjs`: 11 pass, 1 fail (criterion 2, from U103's Home-lead check).
