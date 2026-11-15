# Stage 3: the core journeys, tallied

App: `node app/server.mjs 4173` (server-rendered, no packages; the stage 1–2 rules underneath). The viewer is the `as` cookie (or `?as=`), the day `?today=` (default 5 Nov 2026). Scripts: `node journeys/run.cjs [ids]` drives each scripted journey on a phone (390×844) and a desktop (1440×900), following its page's steps and checks, counting steps against the budget and scoring each checkpoint (at most one main button in view, no sideways scroll, 44px main button on a phone, every status shape beside its word). Results: `journeys/results.json`.

**73 core journey pages: DONE 13 · PART 24 · NOT BUILT 36.** 18 scripted in Playwright (13 DONE, 5 PART); the other 55 by written walk-through against the running rebuild.

## Scripted (Playwright)

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U2 | DONE | 1, 1 / 1 | — |
| U24 | DONE | 4, 4 / 8 | — (version check on save) |
| U25 | DONE | 12, 12 / 12 | — |
| U64 | DONE | 6, 6 / 10 | — |
| U65 | DONE | 2, 2 / 6 | — |
| U66 | DONE | 2, 2 / 4 | — |
| U69 | DONE | 0, 0 / 1 | Checked over my own list of 13 addresses: the journey's `PAGES` list isn't in the kit. `rel-cfr` (one of the "six goals") isn't in the demo workspace; it gives "Goal not found", so six titles still hold |
| U71 | DONE | 8, 8 / 10 | — |
| U77 | DONE | 7, 7 / 10 | — |
| U78 | DONE | 3, 3 / 6 | — |
| U123 | DONE | 2, 2 / 4 | — |
| U137 | DONE | 16, 16 / 26 | The "Stage 1: due" week picker is a select here, not a typed picker (U109's) |
| U141 | DONE | 2, 2 / 4 | — |
| U1 | PART | 11, 11 / 17 | The first-check-in-off-plan offer ("Keep … and say why", cause buttons "Change landed early", field "What happened") isn't built: the kit names the buttons, not the screen. One question per screen (Continue, then "Still true" as a button) is one form here. Everything else holds: verdict "ahead of plan" + "planned for week 45", "Check-in saved", Next:, draft back on Home, receipt, "Check in again" kept alongside, "Type this week’s number", "Still asking:" |
| U6 | PART | 4, 4 / 3 | `.diffs ins` needs a change in the goal's log, and the demo's change log isn't in workspace.json. Over budget: the page lists 6 counted steps against a budget of 3 |
| U58 | PART | 6, 6 / 12 | Says the address becomes `/demo/people` (every other journey uses `/people`); Goals' "By team" (`show=teams`) has no screen words; the `old` address table isn't in the kit. Rest holds |
| U70 | PART | 6, 6 / 9 | Saved views ("Save this view…") and Settings' `.section-links` aren't built. Back links, stepping Back over the edit form after Save, Forward, and Page not found's Find all hold |
| U122 | PART | 3, 3 / 6 | Wednesday 11 Nov expects "both are in (the example posts them)". The kit's workspace stops at 5 Nov, so nothing is posted. Monday's and Friday's checks and the count links hold |

## Walk-throughs (by hand against the running app)

| Id | Tally | Why |
|---|---|---|
| U4 | PART | Wizard, read-back and publish work. Plan shape by hand and History's full entry aren't built |
| U12 | PART | Switch person (Demo panel) works. Start over isn't built |
| U15 | PART | The call is chosen on the check-in. The status sheet and "greener" reason aren't built |
| U21 | PART | The one-table check-in posts. Bulk change isn't built |
| U32 | PART | Search, filter (in the address) and Clear work. Layouts, sort menu, saved views and sharing aren't built |
| U33 | PART | Respond, Answer and Ask for an update work. "What threatens the north star" and the table compare aren't built |
| U37 | PART | Answering a decision works. Linking several goals to one decision isn't built |
| U38 | PART | Asking for an update works. Quarters, week inspector, Undo of an ask and double-post guard aren't built |
| U57 | PART | Week said, kept-alongside check-in, newest on goal page. "2 of 2" after reload and the table sharing the draft are partial |
| U59 | PART | About with facts that link to sections. Member/admin variants and sections aren't built |
| U72 | PART | Each form has one closing control in words. Ask-first dialog on New review and Import's check aren't built |
| U84 | PART | Four steps with addresses, Back steps back, draft picked up. Suggestions are shown as text, not chosen |
| U91 | PART | Edit page picks owner, team and feeds-into by typing. The "lower goal can't feed it" refusal and the Data owner cell aren't built |
| U92 | PART | People and Data search and count in the list bar's words. Feedback inbox, sort in address and old sort links aren't built |
| U93 | PART | Owner sentence, "Everything here is needed…", "2 things to fix above: Baseline and Target." and the over-100 Check are built. "Kept as whole numbers…", the "Is it under way?" group, Add a stage, per-stage faults and `.focus-foot` Back aren't |
| U109 | PART | Weeks are picked with their dates and named weeks. Not a typed picker ("14 Dec" → week 51) |
| U136 | PART | One page, anchors, "Close and keep the draft", Save held at the foot. The question-focus case isn't built |
| U151 | PART | The receipt is built. The reached-target panel and History mark aren't |
| U153 | PART | "N of M goals are checked in so far" and the no-check-in link are built. The row of 8 weeks and the team panel aren't |
| U5, U11, U17, U54, U61, U86, U97, U147 | NOT BUILT | Set-up, workspaces, Welcome and the import screens aren't built (stage 2's engine is there, with no screens) |
| U14, U43, U60, U176 | NOT BUILT | Admin screens (Access, people, leaving, the workspace line) |
| U18, U23, U115, U117 | NOT BUILT | Plan points by hand, quarters, and the year's start and end |
| U27, U28, U29 | NOT BUILT | Walkthroughs and research sessions |
| U35, U45, U98 | NOT BUILT | Data tables editing, import undo, large import |
| U44, U142, U149, U150 | NOT BUILT | Stop, delete, correct a check-in, proposed type, stopped list |
| U85, U111 | NOT BUILT | Stage-already-past question and look-wrong number check on the check-in |
| U101, U102 | NOT BUILT | No rhythm switch (Features) |
| U124 | NOT BUILT | Leader's Home table of teams, "Changed since" |
| U148 | NOT BUILT | Propose in a review |
| U161, U162, U163, U171 | NOT BUILT | Number sources, baselines, guardrails |
