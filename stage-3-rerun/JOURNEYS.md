# Stage 3 journeys

Each core journey in `spec/core/journeys.md`, as this rebuild stands. The runner is `tests/journeys/run.mjs` (Playwright, phone 390 and desktop 1440, the app started three ways: every module on, modules switched off, modules left out); its last results are `rebuild/tests/journeys/out/results.json`. DONE: every check on the page runs and passes within budget on both widths, all three ways. PART: driven by the runner, with a check it can’t run or that fails (the reason says which). NOT BUILT: not driven.

Beside the core journeys, `MOD1` (the module platform with the example module, on, switched off and left out) is DONE on both widths, three ways.

**Tally:** 0 DONE, 8 PART, 63 NOT BUILT, of 71 core journeys.

| Id | Journey | Status | Why |
|---|---|---|---|
| U1 | Weekly check-in, all due goals in one pass | NOT BUILT | the step-by-step check-in with carry-over of last week’s story isn’t built (one form per goal is) |
| U2 | What needs me? Home shows what’s due, off track, stale or slipping | PART | Every check on its page runs and passes on both widths, three ways; PART only because its two checkpoints’ a11y needs axe-core, which isn’t available offline (the runner checks names, reflow and target size itself). |
| U4 | Set up a goal, step by step | NOT BUILT | set-up of a plan’s shape and drafts kept across steps aren’t built |
| U5 | Load your own data and switch between it and the example; the switcher says Switch, and landing as someone els… | NOT BUILT | loading your own data and the workspace switcher are the demo’s and Spreadsheets’ |
| U6 | Understand a goal and its change history | NOT BUILT | a goal’s history drawn, but the journey’s rebaseline and notes parts aren’t built |
| U11 | Real app: from empty to a filled-in workspace in four steps with its goals typed, the browser’s Back and a Cha… | NOT BUILT | the real app’s set-up from empty is not built |
| U12 | Demo: switch person, look around, start over | NOT BUILT | the demo’s person switcher is the demo’s |
| U14 | An admin adds a person and makes them an admin | NOT BUILT | adding a person on People isn’t built |
| U15 | Call it greener than the numbers, with a reason, in the status sheet | NOT BUILT | the status sheet with a greener call isn’t built (the form takes Why greener) |
| U17 | Demo data sets, presenting without the bar, and deleting a workspace | NOT BUILT | demo data sets and deleting a workspace are the demo’s |
| U18 | Set a goal for the year and its plan numbers by hand | NOT BUILT | plan numbers set by hand aren’t built |
| U21 | Type the week’s numbers in one table, and change several goals at once | NOT BUILT | the one table is drawn, but changing several goals at once isn’t |
| U23 | See the year in quarters: where we are, each quarter met or missed, and the year’s history | NOT BUILT | the year in quarters isn’t built |
| U24 | Two people change the same goal at once: the second is told, not overwritten | NOT BUILT | the second save is refused by the store, but the screen’s message isn’t drawn |
| U25 | Publish a goal, then post its first check-in straight away | NOT BUILT | the first check-in offered after publishing isn’t built |
| U27 | Take a walkthrough: the coach points the way and moves on as you do each step | NOT BUILT | walkthroughs are the demo’s alone (not to build) |
| U28 | A research session: first glances, a note pinned to the screen, a task result and a report | NOT BUILT | research sessions are the demo’s |
| U29 | Every walkthrough starts as the right person and points at something real | NOT BUILT | walkthroughs are the demo’s alone (not to build) |
| U32 | Search, filter and sort the goals in any layout, save it as a view, come back to it, and share it as a link | NOT BUILT | saved views save and list, but the filter sheet, sort and every layout’s search aren’t complete |
| U33 | A leader acts on what needs them: what threatens the north star, respond to a request, chase a quiet goal, com… | NOT BUILT | what threatens the north star and the Table’s story line aren’t built |
| U35 | An admin corrects people, goals and a past check-in in the data tables; anyone filters the activity and saves … | NOT BUILT | Data’s editable tables aren’t built |
| U37 | Several goals wait on one decision: an owner links theirs, the leader answers once, and every goal shows the a… | NOT BUILT | linking one decision to several goals isn’t built |
| U38 | A leader reads the quarters, inspects a week, asks for an update and takes it back; an owner’s double press po… | NOT BUILT | the week inspector and asking for an update aren’t built |
| U43 | An admin marks someone as left: first who takes over their goals and asks, then they leave every list, and his… | NOT BUILT | marking someone as left isn’t built |
| U44 | An owner stops a goal with history, then deletes a goal set up by mistake and undoes it | NOT BUILT | stop, delete and Undo are built and tested in tests/stage3.test.mjs, but the journey’s stop dialog and chart parts aren’t drawn as its page names them |
| U45 | Undo an import: every row back as it was, and a row changed since skipped and listed | NOT BUILT | undoing an import is Spreadsheets’ (stage 9) |
| U54 | Set up from the app’s own spreadsheet as the deep review did: people typed are kept, nothing is late on day on… | NOT BUILT | set-up from a spreadsheet is Spreadsheets’ (stage 9) |
| U57 | The check-in is honest at its edges: it says its week and keeps “2 of 2” after a reload, last week’s story is … | NOT BUILT | the check-in’s edges (2 of 2 after a reload, last week’s story) aren’t built |
| U58 | Anyone finds a person and a team: as Oskar, People from the sidebar (More on a phone), search, open Rhea, see … | PART | All checks pass on both widths, three ways; PART: axe-core, and its finish check compares with Goals’ By team (/goals?show=teams), whose code the page cuts short and which isn’t drawn here. |
| U59 | Workspace opens on About: one line under the title, the facts each leading to their section, nothing about ano… | PART | All checks pass on both widths, three ways; PART: axe-core, the facts’ links list is cut short on its page, and “Switch to Rhea in the Demo panel” is the demo’s (a fresh browser as Rhea here). |
| U60 | An admin makes someone an admin on Access and takes it back: Add an admin, find Rhea, her row and her page say… | NOT BUILT | Access lists the admins and adds one, but the journey’s Undo and confirm sheet aren’t drawn |
| U61 | Day one tells the truth: a two-person workspace just set up has nothing to sort out and its team says No lead … | NOT BUILT | a workspace set up from nothing isn’t built |
| U64 | One list bar: on Activity and Help, a search that matches says how many in the same words, one that finds noth… | NOT BUILT | Activity and Help have a list bar, but not filters as words |
| U65 | Find from anywhere: Ctrl K (or the phone’s Find) opens one search; a key alone opens its goal with Enter; a na… | PART | All checks pass on both widths, three ways; PART: axe-core, and how Find is opened at the start and after G-48 isn’t on the page (the runner presses Ctrl K). |
| U66 | A near miss: Goals searched for “rolback” says no goal matches and shows the goals that match “rollback”, the … | PART | All checks pass on both widths, three ways; PART: axe-core. |
| U69 | A page says where it is: each address has its own name in the browser’s title and lights one place (Goals is “… | PART | Its 16 addresses run on both widths: every non-review row passes; the two review rows (Reviews lit, “· Platform leadership weekly”) and, on a phone, People’s tab (Reviews gone, People takes its tab) fail, because Reviews is a module stage 3 doesn’t build and the page doesn’t put these rows under “If the Reviews module is on”. |
| U70 | Back agrees: the back link names where it goes and goes there; the browser’s Forward returns; after saving an … | PART | All checks pass on both widths, three ways (the review row’s back link is drawn even for a review not there); PART: axe-core, and /reviews/weekly is Page not found here (Reviews is stage 8). |
| U71 | See your check-ins before you start: the week’s list, Start with the first or pick any, a kept draft said on i… | NOT BUILT | the week’s list is drawn, but kept drafts aren’t |
| U77 | The owner can act on a goal: Check in again always, and Add a next step when it is behind with none | NOT BUILT | the main button and Check in again are drawn; Add a next step isn’t built |
| U78 | An ask is said once on a goal, under Next steps and asks, with the one button each person may press | NOT BUILT | asks are listed once, but their buttons (Respond, Answer, Mark done) don’t act yet |
| U84 | New goal in the order people think: what, then who and where (Tunde as owner, his team, Team level, his team’s… | NOT BUILT | New goal’s four steps are drawn, but Feeds into suggestions before typing aren’t |
| U85 | A goal isn’t born late: a stage already past is asked about, and a first number can restart the plan | NOT BUILT | a stage already past asked about in the form isn’t built |
| U86 | Day one is true for both: set up a workspace with a teammate, giving him one goal and leaving the rest unowned… | NOT BUILT | set-up with a teammate isn’t built |
| U91 | Picking everywhere else: editing a goal, its owner, team, the goal it feeds and the goals it also helps are fo… | NOT BUILT | the edit page’s pickers aren’t built |
| U92 | One list bar on Data, Feedback and People: a search that matches is counted in the same words, one that finds … | NOT BUILT | Data’s and Feedback’s list bars aren’t built |
| U93 | A goal says what it needs: as Tunde, New goal; choosing Amara as owner says she will own it and only she or an… | NOT BUILT | New goal says who will own it, but the measure step’s per-field Must fix isn’t drawn |
| U97 | The first screen and the way in: Welcome at its own address with one main action; set-up at its own; the invit… | NOT BUILT | Welcome and set-up aren’t built |
| U98 | Size: as Amara, a file of 6,000 new goals shows “Reading” with how far the check has got and what it has found… | NOT BUILT | large files are Spreadsheets’ (stage 9) |
| U101 | Amara sets the check-in rhythm to none: Features → Change → No set rhythm reads back what changes, counted; sa… | NOT BUILT | the check-in rhythm setting isn’t built (it is read from the cycle) |
| U102 | Rhea checks in with nothing due: with no set rhythm, the menu’s Check-in has no count; “Check in on a goal” li… | NOT BUILT | no set rhythm isn’t built as a setting |
| U109 | Dates are picked: as Tunde on the measure step, Baseline and Target each sit beside a week, From “Week 45 · 2–… | NOT BUILT | the week picker is a plain list of weeks, not the picker the page names |
| U111 | A number that looks wrong is asked about: ten times last week’s blocks Continue until it is answered; Change t… | NOT BUILT | a number that looks wrong is asked by the engine, but not drawn as the form’s question |
| U115 | Start 2027 only prepares it: on 21 Dec 2026 the read-back counts every goal once; afterwards everyone is still… | NOT BUILT | Start 2027 is built and tested (tests/stage3.test.mjs), but the journey’s next-day checks read the demo on another day |
| U117 | The year ends on its last day with nobody starting the next: on 11 Jan 2027 the frame says 2026 has ended, not… | NOT BUILT | reads the demo on 11 Jan 2027, which the kit doesn’t hold |
| U122 | The owner’s week on Home: on Monday nothing is asked and there is no primary button; the day before the deadli… | NOT BUILT | Home’s lead and quiet line are built (home.csv 100%), but the journey’s days after 5 Nov aren’t in the kit’s demo |
| U123 | The manager on Home: Rhea’s “Your team · CI/CD” opens the My team scope of Goals with the same total; “{k} nee… | NOT BUILT | the manager’s blocks on Home aren’t built |
| U124 | The leader on Home: Amara’s Watching spans thirteen teams, so it is a table of teams, worst first, with no per… | NOT BUILT | the leader’s table of teams isn’t built |
| U136 | Change a goal is one page: an old “?part=plan” link lands on Plan and target; the four sections in order, each… | NOT BUILT | Change a goal is one page with its four anchors, but ?part= links and the draft kept aren’t built |
| U137 | Read back before it’s saved: as Tunde on Wednesday 11 Nov, a goal in CI/CD feeding G-41, 40% to 90%; the Check… | PART | Runs to the Check step and back on both widths: What, Measured by, the first check-in and plan lines pass; the review line (“It joins Platform leadership weekly and Reliability weekly.”) fails without Reviews, the owner-in-another-team question (“Keep it in CI/CD”) isn’t drawn as a step, the rows’ expected words are cut short on its page, and the demo is named “Example: Platform Engineering” there. |
| U141 | Nothing offered that is then refused: as Hamid, an admin, the “…” menu on Rhea’s goal has Change this goal but… | NOT BUILT | the “…” menu shows only what may be done, but the journey’s admin-acting parts aren’t built |
| U142 | Correct this check-in replaces it: after posting, the link asks why (under 10 characters is a Must fix), the w… | NOT BUILT | correcting a check-in isn’t built in the form |
| U147 | The first import (U92’s second half): at /?store=browser, set-up with a spreadsheet whose goals name an owner … | NOT BUILT | set-up from a spreadsheet is Spreadsheets’ (stage 9) |
| U148 | Proposed in a review: as Rhea walking Developer Productivity fortnightly, “Propose a new goal” (on a phone, “P… | NOT BUILT | proposing in a review is Reviews’ (stage 8) |
| U149 | A proposed goal’s type: as Tunde, a goal proposed from New goal opens its edit page with Type under “It’s prop… | NOT BUILT | a proposed goal’s edit page isn’t built |
| U150 | Stopped goals listed: as Rhea, a goal stopped with a reason is gone from Goals and listed with the State filte… | NOT BUILT | the State filter (stopped goals) isn’t built |
| U151 | The habit moment on the receipt: as Valentina on Thursday 5 Nov, her one check-in at 80 (Commitment coverage’s… | NOT BUILT | the habit moment panel on the receipt isn’t built (the receipt’s words are) |
| U153 | Before this review: as Rhea on Developer Productivity fortnightly, the panel says how many goals are checked i… | NOT BUILT | Before this review is Reviews’ (stage 8) |
| U162 | A baseline of its own (BL): as Rhea, CI cost per run (no check-ins yet) is given the period its baseline cover… | NOT BUILT | a baseline’s period isn’t built |
| U163 | A baseline and nothing else yet (GB): as Tunde, New goal’s measure step with a Baseline of 0.42 USD and no Tar… | NOT BUILT | a baseline with no target isn’t built |
| U171 | A goal guarded by the number it mustn’t make worse (GR): as Rhea, Base image build time is guarded by Flaky te… | NOT BUILT | guardrails are judged (checkin.csv) but not chosen in the form |
| U176 | The admin’s workspace line on Home, drawn: in a workspace with 12 people and one admin, Rosa’s Home has a bloc… | NOT BUILT | the admin’s workspace line on Home isn’t built |
