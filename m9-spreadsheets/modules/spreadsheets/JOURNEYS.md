# Stage 9: the Spreadsheets journeys, tallied

**How to run:** start the app with `node app/server.mjs 4180`, then run `node modules/spreadsheets/journeys.cjs [ids]`. You can point it at another server with `FARO_BASE`. It follows each journey page's steps and checks on a phone (390 × 844) and on a desktop (1440 × 900).

**What it scores:** steps counted against each journey's budget, plus each checkpoint:
- at most one main button in view;
- no sideways scroll;
- the main button is 44 px on a phone;
- every control has a name.

**Results:** they go to `journeys-results.json`. The runner exits 1 unless every journey is DONE. Exit criterion 2 in `exit.test.mjs` runs it.

The files each journey loads aren't in the kit (GAPS M9-20), so each one was written from the journey's own checks.

**Tally: 11 journeys and 4 checks. DONE 10 (9 journeys and F17), PART 2 (U19, U46), NOT BUILT 3 (F7, F8, N5).**

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U19 | PART | 6, 6 / 19 | Everything about the export holds: the workbook is named …-goals-all-2026-11-05.xlsx; a filtered All tab is named …-goals-as-shown-…; the JSON has all 126 goals with their check-ins; Data's Export → Everything… opens the same sheet, and the focus goes back to Export on Escape. The **Table, Board and History layouts** are core Goals screens that stage 3 didn't build (GAPS M9-22) |
| U20 | DONE | 7, 7 / 15 | Done as Mateo: a new goal linked by name, Saved 1 row; then `/import` leads to Data's Import; a week in the future is refused and there is no Save; the corrected file gives "2 check-ins (2 for past weeks)", the 2 changes name the goal, it saves, and both rows are marked as loaded later |
| U46 | PART | 8, 8 / 16 | The export sheet (Results, then Other formats → CSV files, zipped) and the workbook with all nine sheets hold. One goal stopped with a Reason and another given a new owner in the workbook load back as exactly "1 goal changed, 1 goal stopped", read from Goals, Plan, Check-ins and People. Nothing is saved before Save. Undo from Activity puts both back. **The owner is changed by name, not email:** no one in the demo has an email (GAPS M9-21). **"1 person has no email yet" and saving an email** need a core People and Workspace screen that isn't built |
| U48 | DONE | 3, 3 / 10 | Done as Grace. Off takes Export and Import out of Data and Goals; `/data/import` and `/import` find nothing; Help keeps "Data in and out" without the module's articles; the switch is logged. On brings it all back. Off then Undo says "Spreadsheets is back on." and it is on. Oskar sees no switches |
| U87 | DONE | 2, 2 / 8 | Import says what a new goal, check-in and person must have; Help's columns table holds; the template is faro-template.xlsx, its examples say Example, and loaded back it says "3 example rows left out" and "Nothing would change" (GAPS M9-9) |
| U88 | DONE | 6, 6 / 20 | Must fix says "3 rows, 1 kind of problem"; "2 questions cover 15 rows"; there is no Save; "Use CI/CD" closes to "Did you mean CI/CD?: Use CI/CD" with Change; the rows to fix download with Problem first; the corrected file says "Your 1 answer still applies."; then "Save 18 changes"; the changes list says "the owner's team; the row gave none"; 14 goals are saved in CI/CD |
| U89 | DONE | 4, 4 / 14 | The workbook loaded straight back says "Nothing would change". With Status edited on 2 rows it says so, and the column Budget is named. A file from "Another Org" is asked about first, then "Add its rows as new goals" moves on to the preview |
| U90 | DONE | 7, 7 / 14 | Saved 15 rows from u90-{device}.xlsx, with Undo. Past imports lists it. After Rhea's check-in it says "1 of its 15 rows has changed since…"; the Undo sheet says 14 go back, names Rhea's check-in for week 45 and lists what stays apart. "Undone: 14 rows put back." and "Undone on"; only Cache warm is left; Activity shows one entry with "Show the 15 changes" |
| U94 | DONE | 4, 4 / 12 | As Tunde: "1 row changes a goal you don't own" and "1 row changes people. Only an admin can add or change people". Both are left out; "2 rows are left out"; there are two closed answers; Save 1 change; G-37's target is 44 and G-14's is still 3 |
| U95 | DONE | 5, 5 / 12 | The limits are said. Pasted rows ask “Targett” → Target and save 20 to 90 %. titled.csv says "Row 2 of titled.csv is the header row; 1 row above it was skipped.". staff.csv gives "Its first sheet's headers are Name, Department, Salary band…" and the template in an alert |
| U96 | DONE | 4, 4 / 10 | "Leave this row out and save the rest" names Orphan cache size; after it, "1 row was left out at your choice" and the focus is on Save; Imported says "1 row was left out." with Download them; the right goals are saved |
| F17 | DONE | 1 / 6 (phone) | Checked from its one line: on a phone the preview doesn't scroll sideways, every answer and button is at least 44 px, and Import's primary action is on the first screen |
| F7, F8, N5 | NOT BUILT | — | Named in the kit with no steps or checks, and their eval scripts aren't in it (GAPS M9-24) |

**Step counts:** they count the presses and choices the script makes. "Go to …" lines don't count, as the journeys' own budgets don't count them.

**The core journeys:** with the module in, `journeys/run.cjs` gives the same 13 DONE and 5 PART as stage 3 left them, with the module on and with it off (`FARO_MODULES_OFF=spreadsheets`).
