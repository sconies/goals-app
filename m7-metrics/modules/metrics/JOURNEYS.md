# Stage 7: the metric library's journeys and checks, tallied

Script: `node modules/metrics/journeys.cjs [ids]` (from `rebuild/`). It starts its own servers (module on, and module
off for the switch probe), drives each journey in Playwright on a phone (390×844) and a desktop (1440×900) from its
page's steps and checks, resets the workspace before each width, and writes `journeys-results.json`. Addresses are
`/metrics…`, not the journeys' `/demo/metrics…` (GAPS M-18).

**18 journeys and checks: DONE 7 · PART 7 · NOT BUILT 4.** With the module off: no Metrics in the menu, and `/metrics`
says it is switched off in Platform Engineering and who can switch it on.

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U81 | DONE | 6, 5 / 8 | — (old addresses checked over my own four: the journey's `old` list isn't in the kit) |
| U105 | DONE | 16, 16 / 24 | — |
| U106 | DONE | 15, 15 / 30 | — |
| U170 | DONE | 5, 5 / 24 | — |
| U172 | DONE | 5, 5 / 20 | “It’s already under this one” matched without case (GAPS M-19) |
| N16 | DONE | — | every library row counts the goals its page lists, status by status |
| N29 | DONE | — | opening Home, Check-in, the number step and the one table creates no check-in |
| U82 | PART | 19, 19 / 30 | Measured by first, typing finds it, meaning, “min, whole numbers, lower is better: from the metric.”, For CI/CD, Check's row, the goal and the metric's page all hold; “Add “runner wait” as a new metric” opens the small form and the goal carries on; no Measured by for dated stages. Short: “No metric” is a button beside the picker, not the list's first row, and the unit field is hidden by script rather than replaced |
| U83 | PART | 13, 13 / 20 | The close name asks and still saves, To sort out and Say what it means, the unit read-back, Retire not Delete, Delete and Undo, Tunde sees no controls. About's “1 metric has no owner” needs someone marked as left, and the core has no screen for that (its U14/U43) |
| U145 | PART | 9, 9 / 24 | The choice survives a reload on Check. Changing the team on Who and where doesn't move For: For is set when the metric is chosen |
| U156 | PART | 1, 1 / 2 | 20 filled in, “From CI analytics, read 9:00 today.”, “Confirm 20 min”, the read-back line. The core's check-in is one form, not a step, so the primary is renamed by script (GAPS M-28) |
| U157 | PART | 4, 4 / 5 | “You typed 19 min. CI analytics said 20 min.”, “Use 19 min”, the four reasons, the read-back. “Use 19 min” isn't held until a reason is chosen: the post is refused and asked again |
| U158 | PART | 0, 0 / 1 | Empty field, “CI analytics last read this on Thu 29 Oct, 7 days ago.”, “That is too old to fill in.”, no old value. “No new number this week” isn't offered (the core's check-in has no such answer) |
| F15 | PART | — | First metric near the top, no sideways scroll; a metric's goals are a table (scrolling in its own box) on a phone, not rows |
| U146 | NOT BUILT | — | On a goal being changed, choosing a metric submits the whole edit form, so From the metric and the parts offered show only after a save; the rules (parts, the twin Check, Why) are built and tested (exit criterion 15) |
| U159 | NOT BUILT | — | Needs U146's re-render; the no-slice line itself is built and tested (exit criterion 19) |
| U152 | NOT BUILT | — | The core has no Start 2027 (its U115 isn't built); the module's carry is a function (exit criterion 9) |
| U160 | NOT BUILT | — | The one table (`checkin.table`) has no reading place: the core's quick check-in has no hook |

The core's own 18 scripted journeys, run again with the module in: 13 DONE, 5 PART, as before.
