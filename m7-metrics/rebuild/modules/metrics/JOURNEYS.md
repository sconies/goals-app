# Metric library: journeys

Tried against the running app (`node modules/metrics/journeys.mjs`, Playwright, phone and desktop, library on): every scripted run passes (22 of 22). The rest were tried by hand or checked at the rule level in `exit.test.mjs`.

| Id | Tally | What this rebuild does, and what it lacks |
|---|---|---|
| U81 | DONE | Library from the menu (after People), 13 A to Z, “queue” finds Pipeline queue wait, its page lists its goal with status, For, now, target, against plan; See its goal opens it; Oskar sees no change control. Scripted. |
| U82 | PART | Measured by is first on the measure step, choosing Pipeline queue wait shows its meaning and “min, whole numbers, lower is better: from the metric.”, For defaults to the goal’s team, publishing links it. A select, not find-by-typing; “Add … as a new metric” is a link to the form, not in place; Check’s “Measured by …, for …” row is the core read-back’s and isn’t drawn. Scripted (first half). |
| U83 | DONE | Close name asks and still saves; To sort out with Say what it means opening the form; a unit or direction goals use asks first (confirm); a used metric offers Retire, not Remove; About counts ownerless metrics for admins. Scripted. |
| U145 | NOT BUILT | The draft keeps the metric across steps, but the core read-back has no Measured by row, so nothing reads it back on Check. |
| U105 | PART | The rules (1 to fix, 2 to check; letters, words, former, unit, out of what) and save_metric’s checks and answers hold; the form shows the questions as one refusal line with answer boxes, not each under its field. |
| U146 | PART | Part ≤ 60, the same-number and close-part Checks, the Why for a goal with check-ins, and About’s For / What it means / From the metric / Where / This goal’s own hold (form action, tool). No link form on the goal page, and parts in use aren’t offered under a field. |
| U106 | PART | Words save at once; meaning asks “Is it still the same number?”; changed without a reason is refused; the mark is kept and listed on the goal and metric page; Undo takes it back; retire and merge (admins, one Undo). No dashed line on the chart: the core has no `goal.marks` point. |
| U152 | PART | `carry.mjs` carries every link in force to the goal’s copy (same metric, team, part); the core has no Start next year to call it. |
| U156 | PART | The number step opens with 20 and “From CI analytics, read 9:00 today.”, “Confirm 20 min”; confirming posts it and records the reading. The check-in receipt’s read-back line isn’t drawn (the core has no receipt place). Scripted. |
| U157 | PART | A different number is refused until a reason; the four reasons and Say more (10 characters for Something else) are on the step; it posts with the reason. No read-back receipt. Scripted. |
| U158 | PART | The old state (7 days) is rule 1’s and the step shows no old value; the `?sources=behind` fixture isn’t built. |
| U159 | DONE | Linked for CI/CD with a reason, CI pipeline time’s company-wide source never fills the team’s goal, in the step’s words. Scripted. |
| U160 | NOT BUILT | The core’s one table is a stub page with no rows, so there is nothing to fill. |
| U172 | DONE | Part of, How it relates, Confidence and gaming on the form; “A control on Lead time for changes.”; the parent lists it under it. Scripted. |
| N29 | DONE | Home, the check-in list, the number step and the one table create no check-in. Scripted. |
| F15 | DONE | Phone: nothing scrolls sideways on the library; a metric’s goals become rows. Scripted. |
| N16 | DONE | A library row counts by status what its page lists. Scripted. |
| U170 | DONE | A Gap with what is missing: the square Gap mark, “Not measured yet: 1 goal held to no number” under To sort out, its goal says Not measured yet. Scripted. |
| U179 | PART | The Metrics sheet (CSV on /metrics/sheet, and load_metrics_sheet) counts “2 new metrics, 1 metric changed”, the two Must fix in the form’s words, leaves them out and saves the rest, one Undo; off, refused with the sentence. Not through /data/import: the core has no import screen. |
| U161 | PART | The goal’s Measured by says “This week’s number … Confirmed by …”; the metric page’s “In each goal’s check-in” and the 8-week line; get_metric says it. History’s second line, the agenda’s “· from”, the Check-ins sheet’s four columns and get_goal’s numberFrom are the core’s and not drawn. |
| U72 | NOT BUILT | The metric form isn’t a focus-mode page with one closing control; it has the shell’s back link. |

Tally: 8 DONE, 10 PART, 3 NOT BUILT (21).
