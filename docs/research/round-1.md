# Research round 1 · 2 November 2026

One AI agent (ChatGPT Codex) ran the full protocol: 11 tasks (9 done, 2 stuck), 14 first glances, 10 pinned findings and a report.

| # | Finding | Severity | Verdict | What changed |
|---|---|---|---|---|
| 1 | An owner can't load the workbook back: 441 errors for other people's untouched rows | Blocker | Real (reproduced: exactly 441) | Only rows that change something are checked against who may change them. |
| 2 | Raising a target rewrote closed quarters (Q1 plan 46→47 and so on) | Major | Real | Every earlier plan is kept with the week it stopped applying. Closed quarters and old weeks are judged against the plan of their day. The chart now says the latest change (95 → 98) and where the target started. Migration 0015. |
| 3 | 150% coverage was saved as on track | Major | Real | A goal whose whole plan is within 0–100% can't report over 100%. A goal planned past 100% gets the soft "Is that right?" warning instead. |
| 4 | Quarter labels disagree with the plan calendar | Major | Partly. The weeks are consistent: week N is checked in N weeks after the start, so the number that closes Q1 comes in during 6–12 Apr. The labels didn't say so. | The plan table says "Checked in" and "closes Q1 (Jan–Mar)", explains why, and gives the year on dates in another year. |
| 5 | The AI brief forecast a goal that had gone quiet | Major | Real | A goal gone quiet has no forecast in the story, the summary or any export. |
| 6 | The table showed this week's plan beside a gap for last week | Major | Real (labelling) | The table shows the plan for the week of the number it sits beside: "plan 82% in week 42". |
| 7 | Map goals take focus but Enter and Space do nothing | Major | Real | Enter or Space opens the goal's story, which takes focus. Escape gives focus back to the goal. |
| 8 | Setting up a review loses everything on refresh | Major | Real | The set-up is kept as a draft, says so when it comes back, and is thrown away by Close. |
| 9 | Letters in the one-table check-in show On track and blame a missing reason | Minor | Real | The number is checked first: "isn't a number" appears in place, with no status, and the summary names the real problem. |
| 10 | "3 late" doesn't say three what | Minor | Real | "Expected week 45 · 3 weeks late, due week 42". |

Smaller notes, all fixed:
- the hub's "11 of 11 done" now reads "11 of 11 recorded: 9 done, 2 stuck";
- the Edit goal screen was named "Setting up a review" (a matching bug);
- a task's outcome carried over from the last task; it now starts unset;
- the brief said "by week 42 by week 42";
- board cards in trouble left out their number;
- a template set up mid-year proposed stages already overdue (they now count from this week);
- the map key now says how the critical path is ranked.

Not done:
- a quarter-by-quarter portfolio view in History (an idea, not a defect);
- a "data problem" call that keeps a bad number out of the status (the 0–100% rule covers the case reported);
- exact 390px rendering, which the agent couldn't test. Our own evals run every journey at 390px.

New evals:
- the HONEST-NUMBERS requirement, with 4 spec scenarios;
- journey U30 (one-table check-in, keyboard map, review draft);
- unit tests for the owner round trip, the plan history (domain and database rows), the stale brief and template stages.
