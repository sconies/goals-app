# The app, redesigned: the whole of it on one page

10 November 2026. Design and spec only: no app code was changed, and nothing here is built. Lane asked for six areas to be evaluated and designed as one set, fitted to the Workspace redesign (PR #81). This page is the set: what changes, the patterns every area shares, and one build plan.

| Area | Evaluation and design | Build spec | Ranked |
|---|---|---|---|
| Find, sort, filter and pick | [find/README.md](find/README.md) | [find/spec.md](find/spec.md) | 1 |
| App navigation | [navigation/README.md](navigation/README.md) | [navigation/spec.md](navigation/spec.md) | 2 |
| The Goals page | [goals/README.md](goals/README.md) | [goals/spec.md](goals/spec.md) | 3 |
| The goal page | [goal/README.md](goal/README.md) | [goal/spec.md](goal/spec.md) | 4 |
| The metric library | [metrics/README.md](metrics/README.md) | [metrics/spec.md](metrics/spec.md) | 5 |
| Goal onboarding | [onboarding/README.md](onboarding/README.md) | [onboarding/spec.md](onboarding/spec.md) | 6 |
| Workspace and People (done first, PR #81) | `workspace/README.md` | `workspace/spec.md` | — |
| What all of it needs from the architecture | [architecture.md](architecture.md) | In the same file | — |

Why that order, and a verdict on each area: [`docs/reviews/2026-11-10-app-redesign-priorities.md`](../reviews/2026-11-10-app-redesign-priorities.md). The Workspace files are on the branch `workspace-redesign` until PR #81 merges; this set is written to sit beside them.

Each area's wireframes are simple HTML mock-ups drawn with one shared kit (`_shared/kit.cjs`) and rendered at 1440 and 390 px (`node docs/design/<area>/mockups/build.cjs`). They show layout, order and wording; they are not app code. Numbers in them are illustrative.

## The redesign in ten lines

1. **One menu, in three groups**: your work (Home, Check-in, Goals, Reviews), things to look up (People, Metrics, Activity, Data), this workspace and you (Workspace, Settings, Help, Feedback). It fits the screen, names its icons when collapsed, and is the same four tabs and a short More on a phone.
2. **Find is the menu's first row**, and one key from anywhere: a goal, a person, a team or a metric, by name or key.
3. **One list bar on every list**: search, filters, sort, then one line that says how many, in the same words everywhere; the address holds all of it.
4. **One find-and-pick control** wherever a person, team, goal, metric or workspace is chosen. No list of everything survives.
5. **Goals opens on yours.** Its tabs say whose goals (Mine, My team, Watching, All); how they are arranged (as trees, by team, by level) and drawn (List, Table, Board, History, Map) are separate choices; Needs attention is a switch over any of them.
6. **A goal's page reads in one order on every width**: how it is, what is being done and asked, why, the chart. Next steps and asks are one list, shown once; its owner always has a button.
7. **People is a place for everyone** and Workspace is what admins change (PR #81).
8. **Metrics is a place for everyone** too: a page per metric showing every goal measured by it, side by side; a goal is linked to its metric where it is made.
9. **New goal asks what, who and where, how it's measured, then reads it back**, each step an address; a goal can't be born late, and a first number can restart the plan.
10. **Day one tells each person, the second included, what is true and what to do.**

## The ten worst things found

Across the six areas (the Workspace review has its own twenty-one). Each links to its finding.

| # | What | Where |
|---|---|---|
| 1 | **Nineteen places search, filter or pick, and no two work alike.** "G-48" finds a goal in three of five; "off track" finds 0 goals, 16 rows or 279 changes depending on the page; a person is picked six ways, two of them selects of all 97 | [find S1–S3](find/README.md#findings) |
| 2 | **Goals opens on all 126 goals for everyone, and its tabs mix two questions.** Tunde owns two goals and lands on "Needs attention 41"; "my team's goals" isn't a tab; 17 controls sit above the first row | [goals G1, G2, G4](goals/README.md#findings) |
| 3 | **The owner of an off-track goal has no button on its page.** Checking in again is the fourth item of a menu; adding a next step is at the foot of a side column | [goal D1](goal/README.md#findings) |
| 4 | **One ask is shown up to four times on a goal's page**, and the list it belongs to has three names and, on a phone, no heading | [goal D2, D4](goal/README.md#findings) |
| 5 | **The sidebar is 19 rows of five kinds and taller than a laptop screen; collapsed, it loses Mine, All and every saved view and names nothing on focus**, though Settings promises it does | [navigation V1, V3](navigation/README.md#findings) |
| 6 | **A goal can be born 45 weeks late**: a stage dated in the past is accepted silently, and a first number against a template's made-up start asks "Why is it behind?" | [onboarding O4, O8](onboarding/README.md#findings) |
| 7 | **Day one gives the second person nothing to do**: every template goal belongs to whoever set up; the teammate's Home says "You don't own a goal" | [onboarding O9, O10](onboarding/README.md#findings) |
| 8 | **The metric library, after Wednesday, sits under Data behind a button, and a metric's page can't show how its goals stand** side by side, which is the reason to define a number once | [metrics M1, M2](metrics/README.md#findings) |
| 9 | **Back doesn't bring back what you saw.** Goals replaces history for some choices and adds for others; a remembered layout is drawn under an address that doesn't name it; four pages drop the search from the address | [goals G6](goals/README.md#findings), [find S6](find/README.md#findings) |
| 10 | **Pages don't say where you are, and a goal's history hides its gaps.** Every goal's browser tab says "Goals"; a goal quiet for two weeks shows no row for them | [navigation V5](navigation/README.md#findings), [goal D6](goal/README.md#findings) |

The Workspace review's F1, the 730 px warning mark on the live overview, was fixed on main on 10 Nov (PR #82), so WR0 is done.

## What is shared

Every area is built from these. They are specified once, in the place named, and referred to everywhere else.

### The frame

| Part | Rule | Specified in |
|---|---|---|
| The menu | Three groups; a row is a place; one row lit; Check-in only for someone who owns a goal; modules add rows to "Look up" | navigation spec, 2.1, rules 1 and 3 |
| The phone | A top bar with the page's name, the workspace, Find and you; four tabs and More, in the menu's groups | navigation spec, 2.3 |
| A page's name | The thing's own name, in the browser's title and the phone's bar | navigation spec, rule 2 |
| The back link | One per page, above the title; where you came from, else the structure; agrees with the browser's Back | navigation spec, rule 4 |
| Leaving a form | One exit: "Close and keep the draft" or "Close without saving"; steps are addresses | navigation spec, 2.5 |
| The workspace's name | One name, with "example data" as a quiet second line | Workspace spec, rule 1 |

### A page

- **Title; one line under it; one primary action at the right**, or none. A page for reading has no invented button.
- **A person who can't act sees the same page without the action**, and is told once who can ("Rhea or an admin can change this."). Nothing is listed and then refused. (The Workspace design's rule, used everywhere.)
- **Long pages have section links** that stick (a goal; Settings).
- **Width by kind of page**, as the design rules say: forms 620 px; reading pages 760 to 880; a goal and Home one column with a side column from 1,100 px; tables and boards wide; the Map everything.

### A list

| Part | Rule | Specified in |
|---|---|---|
| The list bar | Search, filters, sort, the page's extras; on a phone the search and "Filter and sort" | find spec, 2.1 |
| What a search matches | The words on the row, and a goal's key, by word starts, ignoring case and accents | find spec, rule 1 |
| The count line | "126 goals, worst first." / "17 goals match." / "1 person matches." | find spec, rule 2 |
| The filter line | "Filtered by: Team CI/CD (Remove) · Clear filters", plain words | find spec, rule 3 |
| None found | "No goal matches “x”." with "Clear the search"; a near miss is tried and said | find spec, 2.1, rule 5 |
| The address and history | Everything drawn is in the address; one history entry per choice | find spec, rule 4 |
| Paging | 50 at a time for flat lists: "1 to 50 of 97", "Next 47" | find spec, 2.1 |
| A row | A link to the thing; two lines, a third on a phone; status first where the thing has one; no buttons on a row unless the row is something to do | Each area |

### Choosing

| Part | Rule | Specified in |
|---|---|---|
| Find-and-pick | A field that shows the choice as words with "Change"; open, a search over suggestions (you, your team, lately), then results with a count; arrow keys and Enter; "none" and "add as new" as named rows | find spec, 2.3, rule 6 |
| A row in a picker | The same two lines for a person, a team, a goal and a metric as in Find | find spec, 2.3 |
| The seam | One search function per kind, behind a port: where the internal app's server search plugs in | find spec, rule 7 |
| Short fixed lists | Stay plain: weeks, levels, sort orders | find spec, section 4 |

### Words

| Thing | Said as |
|---|---|
| A status | Its shape and its word, together, first on the row (the design rules; unchanged) |
| A flag that isn't a status | The warning mark and words: "Overdue by 1 week", "No meaning yet" |
| A state that isn't a status | A word: "Open", "Done", "Admin", "On", "Off" |
| Something chosen, or a filter that is on | Plain words with "Remove" or "Change"; never a capsule |
| Agreed work on a goal | A "next step" (who, by when); questions and decisions are "asks"; the list is "Next steps and asks" |
| A goal's own past | "History" (the workspace's feed stays "Activity") |
| Whose goals | "Mine", "My team", "Watching", "All" |
| Who may | "{Name} or an admin can change this." |

### What every spec holds

Routes and redirects; each screen's content in order with exact wording, its primary action, its empty and error states; who sees what, each line naming the action that already enforces it (so R1's table is untouched); rules for `src/domain` with worked examples that become tests and conformance rows; extension points; evals; Help and What's new; what changes if Lane decides otherwise; a build plan. No spec adds a table or a migration.

## Old addresses

Every address that works today still lands on the right page. The tables are in each spec; in short:

| From | To | Spec |
|---|---|---|
| `/goals?show=mine\|watching\|outcomes\|levels\|teams\|attention`; `/watching`; filter-only links | `/goals?scope=…` with `group=` or `attention=1` | goals, section 1 |
| Saved views stored with `show=` | Opened through the same function; the record isn't rewritten | goals, rule 6 |
| `/workspace/people`, `/workspace/teams`, `/workspace/overview` | `/people`, `/teams`, `/workspace` | Workspace spec |
| `/data/metrics…` (Wednesday's) | `/metrics…` | metrics, section 1 |
| `/goals/new` (a draft), `/workspace/new` | The draft's step | onboarding, section 1 |
| `/goals/<id>#activity`, `/edit?part=` | `#history`, `/edit#…` | goal, section 1 |
| `/data?s=Team~asc` | `?sort=team` | find, section 4 |

## One build plan

Backlog-sized items across the six areas and Workspace, in order. Effort: **S** (under a day), **M** (a release), **S–M** between. Each is one PR with its spec section, conformance rows, evals, Help and What's new, as `CLAUDE.md` asks. "With" means two items that must land together.

| # | Item | What | Effort | Depends on | Spec |
|---|---|---|---|---|---|
| 0 | **WR0** The warning mark, fixed | Done: PR #82, 10 Nov (the mark sized; F7 measures it). The wider design check for icon size (the Workspace spec's P16) rides with WR2 | — | — | workspace |
| 1 | **AR1** with **AR4** The `Search` and `Prefs` ports; new rules take what they need | The search function behind a port with its contract, shaped as the query port; recents and remembered choices behind a port; `find_goals` through it; the clock banned in the rules; a lint that no new rule takes the whole workspace. `[no news]` | S–M | Nothing (8c's pattern) | architecture |
| 2 | **FS1** Find-and-pick, everywhere a person, team or goal is chosen | The control and its rules, and every select of everything replaced | M | AR1 | find |
| 3 | **AR3** One way to run an action | `app.run(action, input)` and the action table: the command port's shape in Faro. `[no news]` | S–M | Nothing | architecture |
| 4 | **GT1** Act on a goal | One list of next steps and asks, the owner's buttons, one order at every width, section links | M | AR3; FS1 for "who" | goal |
| 5 | **OB2** Not born late | A stage in the past is asked about; a first number can restart the plan; a new goal's page says less | S–M | Nothing | onboarding |
| 6 | **NV2** Where you are | Page names in the title, one lit item, one back link, one way out of a form | S–M | Nothing | navigation |
| 7 | **NV3** The check-in queue | Check-in opens on the week's list | S | Nothing | navigation |
| 8 | **FS2** The list bar, on Goals, Activity, Data, Help and Feedback | The bar, the Filters sheet, the count and filter lines, none found, near misses, the address | M | FS1 | find |
| 9 | **WR1** People has its own place | `/people`, `/teams`, a person, a team, with the two people places | M | Uses FS1 and FS2 | workspace |
| 10 | **AR2** Seven additions to the module contract | A menu item's group, a page's name, `goal.facts`, finders, filters as data, a module's things to sort out; the menu, title and lit item as rules. `[no news]` | S–M | AR1 | architecture |
| 11 | **GL1** with **NV1** Goals opens on yours; the menu in groups | Scope, group, the Needs attention switch, one line; the new sidebar, the collapsed rail, the phone's tabs and More (with WR5: one Feedback, one name, one Demo panel) | M + M | FS2, AR2; WR1 for People's row | goals, navigation |
| 12 | **GL2** Goals' menus, the Map's search, the phone's View sheet | Layout and Views as menus on every width | S–M | GL1 | goals |
| 13 | **FS3** Find from anywhere | The sheet, its key, its door in the menu and the phone's bar | S | FS1, NV1 | find |
| 14 | **GT2** A goal's history shows its gaps | Every week, four filters with counts, the address | S–M | GT1 | goal |
| 15 | **GT3** Watch and comments say what they do; one door to change a goal | The Watch sheet, the comment box, the edit page | S | GT1, FS1 | goal |
| 16 | **WR2** Workspace opens on About | The facts, "To sort out", the switcher | S–M | WR1 | workspace |
| 17 | **WR3** Admins and tokens where they are listed; Settings about you | Access, Settings, Leave | S–M | WR1, WR2 | workspace |
| 18 | **WR4** Cycles, Features, Privacy, Recently removed, plainer | — | S | WR2 | workspace |
| 19 | **OB1** New goal: the order, the pickers, steps in the address | — | M | FS1 | onboarding |
| 20 | **AS part 2** The records extension point | A module declares its records; the metric library's records and rules move out of the core into its folder. One migration only if `okr_commit` names the metric tables. `[no news]` | M | AR3; Wednesday's build merged | architecture; backlog AS |
| 21 | **ML1** The metric library as a place, and a page per metric | `/metrics`, the goals table, the people places | M | AS part 2, AR2, FS2, NV1, GT1, WR1 | metrics |
| 22 | **ML2** "Measured by", found by typing | The picker, what it fills in, the Goals filter | S–M | FS1, OB1 | metrics |
| 23 | **ML3** Looking after metrics | What's missing, the close-name question, Remove's confirm, the line on About | S–M | ML1, WR2 | metrics |
| 24 | **OB3** Set-up's owners and day one | Owners per template goal, the counter, "Getting started" | S–M | FS1, AR1 (`Prefs`), WR1 | onboarding |
| 25 | **AS part 3**, the rest | Scorecard words split from codes in conformance; one schema file in the kit; the "don't copy this" list; `api/mcp.js` built in CI. `[no news]` | S–M | Nothing | architecture; backlog AS |
| 26 | **FS4** Held at company size | The 15,000-person, 30,000-goal check and the lint (this is also WR6 and 0a (4)) | S | FS1, FS2 | find |

**About eighteen releases of work**: fifteen for the screens (eight M, nine S–M, four S) and three for the architecture under them (one M, four S–M), which is placed just before the first screens that need each piece (`architecture.md`).

**Three tracks can run side by side** (one build at a time per area, as `CLAUDE.md` asks), because they share almost no screen code:

- **Lists and the frame:** AR1 with AR4 → FS1 → FS2 → AR2 → GL1 with NV1 → GL2 → FS3 → FS4.
- **One goal:** AR3 → GT1 → GT2 → GT3, then OB2 → OB1.
- **People, Workspace, Metrics:** WR1 → WR2 → WR3 → WR4, then AS part 2 → ML1 → ML2 → ML3, then OB3; AS part 3's remainder last.

**The first cut that changes how the app feels** is items 1 to 11: about eight releases, two of them architecture. After it nothing is chosen from a list of everything, Goals opens on yours, the menu fits, a goal's owner can act, and People exists.

### Where it sits in the backlog

- **Replaces:** 0a (all of it), GD (2) to (7), NAV (all of it), 0u's leftovers, LV's leftovers, SU's leftover, and R5's Cmd-K if Find is built.
- **Builds on, and keeps:** GP, G, MAP, WS, SU, LP's built parts, check-in honesty, Decide in the review, 0b.
- **Takes in:** AS parts 2 and 3 (placed in the plan above; AS part 1 was built in #72).
- **Leaves alone:** 0c, L, LP's U20 and U22, R5's other requirements, 3a (which gains a home in Next steps and asks), 0t, 11.
- **Recommended place:** after 0c (AS is now inside the plan), as the Workspace design already recommended for itself; L's remaining parts can run in the "one goal" track's gaps since they touch Home and reviews, not these screens.
- **The rebuild kit:** each item adds its stage notes; the three seams worth copying are the `Search` port (find, rule 7), the menu as one function of the viewer (navigation, rule 1) and scope as R6a's scope (goals, rule 1).

## Evals and requirements, numbered once

So no two specs claim one number. The Workspace spec has U58 to U62, F10, N11, P16.

| Area | Journeys | Checks | Requirements |
|---|---|---|---|
| Find | U63–U66 | N12 (replaces N11), N13, F11, P17 | `LIST-BAR`, `FIND-AND-PICK`, `FIND-ANYWHERE` |
| Navigation | U67–U72 | F12, P18 | `NAV-PLACES`, `NAV-COLLAPSED`, `NAV-WHERE`, `NAV-BACK`, `CHECK-IN-QUEUE`, `NAV-FORMS` |
| Goals | U73–U76 | F13 (replaces F5), N14 | `GOALS-SCOPE`, `GOALS-ATTENTION`, `GOALS-ADDRESS` |
| Goal | U77–U80 | F14, N15 | `GOAL-ACT`, `GOAL-ASK-ONCE`, `GOAL-HISTORY`, `GOAL-SAYS` |
| Metrics | U81–U83 | F15, N16 | `METRICS-LIBRARY`, `METRICS-MEASURED-BY`, `METRICS-CARE` |
| Onboarding | U84–U86 | F16, N17 | `NEW-GOAL-STEPS`, `NEW-GOAL-TRUTH`, `DAY-ONE` |

P3, P4, P6 and P7 are extended to every new screen. A build session takes the next free number if another build has taken one since.

## What was not covered

Dark mode; a screen-reader pass; the real shared database (the demo and a browser-only copy only); set-up's spreadsheet path; the review walkthrough's own flow (LP); Home beyond day one; the metric library's screens running (they are not on main; the rehearsal branch was read, and Wednesday's room may change details: the metrics spec says what follows the room). The wireframes are drawings: a build session should expect to settle spacing and small wording against the real components, within the specs' rules.

## Decisions for Lane

One batch; the recommended answer is first. Each area's README has its own finer list, and its spec says what changes for each other answer; these twelve are the ones that shape the set (the last three are about the architecture: `architecture.md`). Workspace's eight (PR #81) stand as asked there, less its first (the warning mark), which PR #82 settled.

1. **Find from anywhere** (find, 1).
   - (a) Build it in Faro: it is the picker with a door, and the menu and the phone are designed around it. *Recommended.*
   - (b) Keep it spec only (R5); leave the Find row out.
2. **The Goals page's tabs** (goals, 1 to 4).
   - (a) Whose goals: Mine, My team, Watching, All; Goals opens on yours; trees, by team and by level become "Group"; Needs attention becomes a switch. *Recommended.*
   - (b) The same without "My team".
   - (c) Keep today's six tabs; fix only the toolbar's size and the menus.
3. **The sidebar** (navigation, 1, 2, 4).
   - (a) Three groups; Mine, Watching and All leave it; up to four saved views under Goals; the demo's controls behind your name. *Recommended.*
   - (b) The same, with no saved views in the sidebar at all.
   - (c) Keep Mine, Watching and All in the sidebar.
4. **A goal's page** (goal, 1 to 5).
   - (a) One list, "Next steps and asks", shown once; the owner always has "Check in again", and "Add a next step" when behind with none; the reason before the chart; "Activity" on a goal becomes "History"; Watch says what it does. *Recommended.*
   - (b) The same, keeping the chart first and the name "Activity".
   - (c) Only remove the repeated ask and add the owner's buttons.
5. **Where the metric library lives after Wednesday** (metrics, 1, 2).
   - (a) Its own place, Metrics, beside People, with a page per metric that shows every goal measured by it side by side. *Recommended.*
   - (b) Its own place, with the simpler list of goals.
   - (c) Stay under Data, as built on Wednesday.
6. **New goal's order** (onboarding, 1).
   - (a) What; who and where; how it's measured; check, with "Measured by" first on the measure step and a metric filling in its unit and direction. *Recommended.*
   - (b) Keep today's order.
7. **A goal that would be born late** (onboarding, 2, 3).
   - (a) A stage in the past asks whether it's already done; a first number that differs from the plan's start offers to start the plan from it. *Recommended.*
   - (b) Only the stage question.
   - (c) Leave both as today.
8. **Day one** (onboarding, 4, 5).
   - (a) Set-up asks who owns each template goal; Home gets one "Getting started" block for the first week that fits each person, the teammate included. *Recommended.*
   - (b) Only the teammate's welcome line and the true condition on "Add your people".
9. **When, and in what order.**
    - (a) After 0c, in the plan's order, as three tracks; the first cut is items 1 to 11. This replaces 0a, GD, NAV and 0u in the backlog and takes in AS parts 2 and 3. *Recommended.*
    - (b) After 0c, one track only (slower, simpler to follow).
    - (c) Only the first cut for now; decide the rest after Wednesday's feedback.
    - (d) Hold all of it until Wednesday's feedback is in.
10. **The architecture items** (architecture, A).
    - (a) Build AR1 to AR4 and AS part 2 where the plan places them, each just before the screens that need it. *Recommended.*
    - (b) Build the screens first on what exists, and the architecture after (faster to see; the metric module reaches further into the core before it is moved out).
    - (c) All the architecture first, then the screens.
11. **One way to run an action in Faro** (architecture, B).
    - (a) Build the dispatcher before the goal page's buttons: it is the command port's shape in code a team will copy. *Recommended.*
    - (b) Leave Faro's per-action methods; the command port stays a sketch.
12. **Where the design gives way to the architecture** (architecture, C).
    - (a) Take all five changes: four proposed extension points cut, a module's filter declared as data, no new field for a template goal's owner, new rules take only what they read, and "Ask for a decision or help" opens the check-in instead of being a new action. *Recommended; the specs already say so.*
    - (b) The same, but keep "Ask for a decision or help" as its own action on the goal page.
