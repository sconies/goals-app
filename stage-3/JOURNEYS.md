# The core journeys against this rebuild (kit 752d6c97: 71 core journeys)

Run: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PLAYWRIGHT=<playwright> node rebuild/tests/journeys.mjs` (starts the app on port 48917; each journey on a phone, 390 × 844, and a desktop, 1440 × 900; each check throws; exit 1 when any run fails; no results file). The module platform's own proof is `node rebuild/tests/platform.mjs` (37 checks, exit 1 on the first failure).

- **DONE**: a test follows the journey page's steps and checks on both widths and passes (ease-test checkpoints “scored for one-action and a11y” are not scored).
- **PART**: a test passes for part of it, or the screens exist but a step or check is not built or depends on setup the page doesn't give (GAPS S3-14).
- **NOT BUILT**: the screens it needs are not built.

| Journey | State | What runs, or what is missing |
|---|---|---|
| U1 Weekly check-in, all due goals | PART | Check-in list and one-goal form post through the change engine; the step-by-step flow, carry-over and the status sheet are not built; no test |
| U2 What needs me? | DONE | tests/journeys.mjs U2 |
| U4 Set up a goal, step by step | PART | Test passes; the SVP level pressed by default and the goal it feeds (hidden setup) are not checked, no plan preview |
| U5 Load your own data / switch | NOT BUILT | No workspace switcher |
| U6 Understand a goal and its history | PART | Test: attention table row, Why, comment posted and logged, a change's before and after; not the stages list, `.sc-late` on that goal, or the re-baseline line |
| U11 Real app: empty to filled in | NOT BUILT | No set-up |
| U12 Demo: switch person, start over | NOT BUILT | |
| U14 Admin adds a person | NOT BUILT | |
| U15 Greener than the numbers | NOT BUILT | No status sheet |
| U17 Demo data sets, deleting a workspace | NOT BUILT | |
| U18 Plan numbers by hand | NOT BUILT | |
| U21 One table, change several at once | NOT BUILT | /quick-check-in is a shell |
| U23 The year in quarters | NOT BUILT | |
| U24 Two people change the same goal | NOT BUILT | |
| U25 Publish, then the first check-in | DONE | tests/journeys.mjs U25 |
| U27 Walkthrough | NOT BUILT | |
| U28 Research session | NOT BUILT | /research is a shell |
| U29 Every walkthrough | NOT BUILT | |
| U32 Search, filter, sort, saved views | PART | Goals' list bar, filters in the address, four layouts; no sort, no saved views |
| U33 A leader acts on what needs them | NOT BUILT | |
| U35 Data tables corrections | NOT BUILT | |
| U37 Several goals wait on one decision | NOT BUILT | |
| U38 Quarters, inspect a week, ask for an update | NOT BUILT | |
| U43 Marks someone as left | NOT BUILT | |
| U44 Stop, delete and undo | PART | Stop with a reason is built (U150); delete and undo are not |
| U45 Undo an import | NOT BUILT | |
| U54 Set up from the app's spreadsheet | NOT BUILT | |
| U57 The check-in honest at its edges | NOT BUILT | |
| U58 Find a person and a team | PART | Test passes through People, Rhea, her goals, Teams, CI/CD and “See its N goals”; `/goals?show=teams` counts are not built |
| U59 Workspace opens on About | PART | About with its facts and section links; the line “… · you’re an admin here”, Privacy and /workspace/access are not built |
| U60 Make someone an admin | NOT BUILT | |
| U61 Day one tells the truth | NOT BUILT | |
| U64 One list bar on Activity and Help | DONE | tests/journeys.mjs U64 |
| U65 Find from anywhere | PART | Test passes: Ctrl K, focus, G-48 alone and Enter, rhea's groups and See all, Escape; “opened lately” is not kept, and the CI/CD step is reached by pressing its row, not by the journey's keys |
| U66 A near miss | DONE | tests/journeys.mjs U66 |
| U69 A page says where it is | DONE | tests/journeys.mjs U69 (eight addresses' titles and lit item; six goals, six titles); the whole rule is also drilled by navigation.csv |
| U70 Back agrees | PART | Test passes: back link names Goals, edit and back, Forward, the back link, Page not found with a way on; the Settings scroll and Save this view are not built |
| U71 See your check-ins before you start | PART | The week's list, Start with the first, a draft kept on Close; “Draft kept”/“Carry on” rows and the `?start=1` walk are not built |
| U77 The owner can act on a goal | PART | Test: Check in on the bar, Next steps and asks in view, opens the check-in; Mark done and “Add a next step” are not built |
| U78 An ask said once | DONE | tests/journeys.mjs U78 |
| U84 New goal in the order people think | PART | Four steps at their addresses, find-and-pick for owner, team and Feeds into; suggestions before typing and the draft's pick-up message are not built |
| U85 A goal isn't born late | NOT BUILT | |
| U86 Day one is true for both | NOT BUILT | |
| U91 Picking everywhere else | NOT BUILT | The edit page has no fields |
| U92 One list bar on Data, Feedback, People | PART | People's list bar; Data and Feedback have none |
| U93 A goal says what it needs | PART | The read-back's owner and “Only Amara or an admin …” lines; the form's own words are not checked |
| U97 The first screen and the way in | NOT BUILT | |
| U98 Size: 6,000 new goals | NOT BUILT | |
| U101 Rhythm none | NOT BUILT | |
| U102 Nothing due | NOT BUILT | |
| U109 Dates are picked | PART | From is picked from a list of weeks with their dates; Target's To and a stage's Due are not |
| U111 A number that looks wrong is asked about | NOT BUILT | |
| U115 Start 2027 only prepares it | NOT BUILT | |
| U117 The year ends | NOT BUILT | |
| U122 The owner's week on Home | PART | Test: Monday's quiet line with no primary button, Your goals · 2 and its counts link, Wednesday's lead and Start check-in; the “all in” and Friday days need check-ins posted between them |
| U123 The manager on Home | NOT BUILT | |
| U124 The leader on Home | NOT BUILT | |
| U136 Change a goal is one page | PART | Four anchored sections and one closing control; no fields, no Save changes, no `?part=` |
| U137 Read back before it's saved | PART | The Check step reads back (drilled by readback.csv), Change returns to its step, Publish goal; the “Keep it in CI/CD” question and Tunde's CI/CD start are hidden setup |
| U141 Nothing offered that is then refused | DONE | tests/journeys.mjs U141 |
| U142 Correct this check-in | NOT BUILT | |
| U147 The first import | NOT BUILT | |
| U148 Proposed in a review | NOT BUILT | |
| U149 A proposed goal's type | NOT BUILT | |
| U150 Stopped goals listed | DONE | tests/journeys.mjs U150 |
| U151 The habit moment on the receipt | NOT BUILT | The receipt's words are on Home's quiet line (drilled by home.csv), not after posting |
| U153 Before this review | NOT BUILT | |
| U162 A baseline of its own | NOT BUILT | |
| U163 A baseline and nothing else | NOT BUILT | |
| U171 A goal guarded | NOT BUILT | The guard is in the rules (edge E-18), not on a form |
| U176 The admin's workspace line on Home | NOT BUILT | |

**Tally: 8 DONE, 22 PART, 41 NOT BUILT, of 71.** (The previous run counted 73 core journeys; the kit now lists 71.)
