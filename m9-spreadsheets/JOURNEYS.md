# Journeys, stage 9 (Spreadsheets)

Tried with `node modules/spreadsheets/journeys/run.mjs` (Playwright, phone 390 × 844 and desktop 1440 × 900, the app started by the script; a failed check fails the journey and the exit code). Last run: 24 of 24 runs pass. The ease-test checkpoints (`one-action`, `a11y` scoring) are Faro's eval scripts, not in the kit, and are not scored here.

| Id | Tally | What was tried | What wasn't |
|---|---|---|---|
| U19 | PART | Goals → Export these goals → Export .xlsx (`…-goals-all-{date}.xlsx`, > 4 KB), JSON (`goals-app.export`, check-ins inside) and the brief (“How to read the status”, “Recovery plan”); a filtered All tab saves `…-goals-as-shown-…`; Data → Export → Everything… names the file and its goals; Escape closes it and focus returns to Export | The Table, Board and History layouts' own checks (sorting by Status, board parents, the History grid): core screens the core rebuild draws only in outline |
| U20 | DONE | Data's Export and Import; a new goal from a CSV, saved; `/import` → `/data/import`; a future week refused with no Save; the corrected file; “2 check-ins (2 for past weeks)”; the changes name the goal; saved and logged | — |
| U46 | PART | Export dialog (Results, Other formats, CSV files zipped), every sheet in the workbook; Stop and a new owner edited in the workbook; “1 goal changed, 1 goal stopped”, “Read Goals, Plan, Check-ins, People and Metrics”; Show the 2 changes; saved; Activity → Undo this import → Undo N rows → “Undone:” | People's “1 person has no email yet” and Workspace's missing emails: core screens not in the core rebuild |
| U48 | DONE | Features' Spreadsheets switch (with its summary), off: Data and Goals keep their toolbars without Export, `/data/import` and `/import` are Page not found, Help loses its articles, the switch logged; on again: `/import` leads to Import | Undo straight after switching off is the core's Features message (passes in the core's own journeys) |
| U72 | PART | Import's check and its changes each have one closing control with words, which goes back to Import | The review set-up's closer (Reviews, another module) |
| U87 | DONE | What a new row must have; Help's table of every column; the template (Start here first, 2 Goals examples saying Example, no Status); loaded back: “3 example rows left out”, “Nothing would change” | — |
| U88 | DONE | 14 rows for “CI/DC”, 3 without owners, a past stage: “3 rows, 1 kind of problem”, “2 questions cover 15 rows”, no Save; Use CI/CD closes to one line with Change; the 3 rows to fix download (`goals-u88-rows-to-fix.xlsx`, Problem first); the corrected file keeps the answer; They're not done; Save 18 changes; the default's words in the changes list | — |
| U89 | DONE | Exported workbook loaded back: Nothing would change, no worked-out note; Status edited on two rows and a Budget column: both said; another workspace's file asked first, then its rows as new goals | The other workspace's name is set by this script (the kit's journey doesn't say how) |
| U90 | DONE | 5 goals and 10 check-ins saved from u90-{device}.xlsx; Imported with Undo; Data → Import → All N past imports; Rhea's check-in; “1 of its 15 rows has changed since…”, the Undo sheet (14 go back, Rhea's check-in named, rows that stay listed); Undone, “Undone on”; Activity's one entry with Show the 15 changes | — |
| U94 | DONE | As Tunde: his own target and Rhea's changed, a People row changed: two groups, each left out, closing to its line; the plan-change reason; Save 1 change | — |
| U95 | DONE | Paste with “Goal name” and “Targett”: asked once, Read it as Target, saved; a title row said; a file with no Faro sheet names its headers and offers the template in an alert | — |
| U96 | DONE | Leave this row out and save the rest (the sheet names the row); left out, focus on Save; Imported says 1 row was left out and offers Download them | — |
| F7 | NOT BUILT | — | Faro's fit-and-finish script; its steps aren't in the kit |
| F8 | NOT BUILT | — | as F7 |
| F17 | NOT BUILT | — | as F7 (the preview's phone fit is unchecked) |
| N5 | NOT BUILT | — | Faro's review-notes script; not in the kit |

Tally: DONE 9, PART 4, NOT BUILT 4 (the four Faro scripts the kit has no steps for).
