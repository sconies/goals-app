# Deep review, 10 November 2026

A review of Faro on three lenses: the architecture as something a rebuild team will copy, the product, and the flows end to end. Written the night of 9 November for the talk on Wednesday 11 November. Nothing was built or changed.

## How it was done, and what it does not cover

- **Read:** `docs/handover.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/design-rules.md`, `docs/backlog.md`, `docs/handoff.md`, `docs/demo-script.md`, every file in `docs/reviews/`, `llms.txt`, `spec/` (the rules index, the rebuild kit, R1 and R4), then the code: `src/core`, `src/ports`, `src/adapters`, `src/data/store.ts`, `src/app/state.tsx`, `server/mcp.ts`, `src/domain` (attention, actions, review, goal keys), the migrations' save functions, and the layers lint.
- **Walked on the live demo** (`/demo`, week 46, 1440 px and 390 px) as Rhea Kapoor (manager), Amara Nwosu (leader) and Tunde Bakare (an owner with two goals and nobody to manage), plus first set-up on a browser-only copy (`/?store=browser`, with every database request blocked, so nothing was written to the shared database). Three helper sessions did the walks; each finding below says whether I re-checked it myself (**checked**) or it rests on the walk (**walk**).
- **GP** (`goals-decisions`, PR #68): read its diff against main, and built it locally to walk its Goals page. Findings GP fixes are left out; findings about GP's own version are marked **GP**.
- **WS** (`workspace-rework`): **the branch is not on the remote** (checked twice; no pull request either), so I could not read its diff. The Workspace findings below are from main and are marked **WS area**: drop any that WS already fixes.
- **Not covered:** the Map (MAP is already detailed), the MCP tools one by one, dark mode, the print page, accessibility beyond what the walks touched.

Severity: **Talk** (blocks or endangers Wednesday), **Rebuild** (blocks the rebuild, or sends it the wrong way), **Worth doing**, **Polish**. Each finding was checked against `docs/backlog.md` and `docs/reviews/`; where it is already there I say so and don't raise it again.

---

## What blocks or endangers Wednesday's talk

Five things. The first is certain; the others are avoidable by how the demo is driven.

### T1. The root page no longer shows the welcome page. **Talk. Checked.**

- **Saw:** a fresh browser at `https://goals-app-puce-five.vercel.app/` shows "Loading goals…" for about five seconds, then **"Pet store · Who are you? · Dogs · Lane"**. No welcome page for leaders. The welcome page is only the "no workspaces" state (`src/App.tsx:95`, `empty={() => <Welcome />}`), and the shared database now has a workspace called Pet store. The handover still says "the database has no workspaces".
- **Why it matters:** `docs/demo-script.md` opens on exactly this page ("Reload once in front of the room: the lighthouse splash, then the welcome page for leaders. Read its first line"). As it stands the room's first sight is a pet store and a name picker.
- **Fix:** either delete Pet store before the talk (it is live data, so Lane's call), or open with `/?store=browser` in a clean browser profile, which shows the welcome page without touching the database. Rehearse whichever on Tuesday. Longer term the welcome page deserves its own address (see U1).

### T2. The demo follows the real clock, so Tuesday's dry run and Wednesday's talk show different numbers. **Talk. Checked.**

- **Saw:** the demo is in week 46 today. Rhea's Home says "7 check-ins to do" and "Thursday's review is in 3 days"; the script (written in week 45) says "one check-in to do, how late it is" and "Goal 3 of 14 to discuss · 1 of 35 reviewed". On Wednesday the Developer Productivity review dated Tuesday will be a day past, so Home, Reviews and the walkthrough will read differently again from Tuesday evening's rehearsal.
- **Already known in part:** the handover plans a script update once GP and WS land. What is not written down is that the numbers move between the rehearsal and the talk.
- **Fix:** present and rehearse from `/demo?today=2026-11-11` (`src/main.tsx:49` pins the clock for the demo), so both days show the same screen; update the script's numbers from that address. Also small: the script's "136 requirements, about 560 unit tests" is now 138 and 578.

### T3. Running the review on stage: one button closes it, with no way back. **Talk (avoidable), then Worth doing. Walk.**

- **Saw, at `/demo/reviews/devprod`:** "Mark 21 goals with nothing flagged reviewed" flips the page straight to "Held Mon 9 Nov · Next Tue 24 Nov". No finish step, no confirmation, no undo; the closed page's only controls are "Edit review setup" and "Print or save as PDF". The 8 Nov UX report asked to "check that it can be undone": it cannot.
- **Also:** leaving the walkthrough and pressing "Continue review · 12 goals left" restarts the counter at "Goal 1 of 14 to discuss · 2 of 35 reviewed", then it jumps 6 → 8 and 10 → 12, and "Previous goal" is disabled so reviewed goals can't be reached. Opening a goal's walkthrough address directly and saving an action re-sorts the agenda under you ("Goal 1 of 35" becomes "Goal 9 of 35") and "Reviewed & next" skips eight unreviewed goals.
- **Why it matters:** step 5 of the script is the review walkthrough, and its headline is the counter. The review is the centre of the weekly loop; it is the one flow that must count correctly.
- **Fix for Wednesday:** start the review once, go forward only, don't use the bulk button, don't leave and resume. **Fix after:** a "Finish review" step that says what will be recorded and can be undone for the session; number the agenda once when the session starts and keep the order fixed while it runs.

### T4. Rhea's Home names two different review days. **Talk (a sharp-eyed leader will ask), then Worth doing. Checked in code.**

- **Saw, at `/demo` as Rhea:** the tile says "Next review · Developer Productivity fortnightly · Tuesday · tomorrow"; the headline says "Thursday's review is in 3 days", the streak says "before Thursday's review", and the question card says "Daniel asked in Developer Productivity fortnightly … Before Thursday's review". Rhea is not in the Thursday review. As Tunde: "Next review: None you're in" beside "Thursday's review is in 3 days".
- **Cause:** Home takes "the review" from the cycle's review day for everyone (`src/screens/Home.tsx:32`, `:45`, `:200–207`, `WEEKDAY[app.cycle.reviewDay]`), not from the reviews the person is in.
- **Why it matters:** it is the first screen of the demo, and the deadline it gives is the product's main promise ("check in before the review").
- **Fix:** say "check-ins are due by Thursday" (the workspace's deadline) and keep the word "review" for a review the person is actually in; a question raised in a review is due before that review's next session.
- **Seed data, same screen:** the fortnightly review shows "Session Tue 10 Nov · Last held Tue 3 Nov", seven days apart. **Walk.**

### T5. Posting a check-in on stage can produce "Getting worse: on plan → on plan → on plan". **Talk (try it in the dry run). Walk, not re-checked.**

- **Saw:** after posting on-plan numbers as Rhea, Home showed "Base image build time: On track · Getting worse — Further behind plan at each of the last two check-ins: on plan → on plan → on plan (min)", and Lead time for changes, improved from 36 to 28 hours, also "Getting worse". As Tunde, straight under "You're all set for week 46", the goal just checked in moved from "Being handled · 1" to "Need attention · 1".
- **Why it matters:** step 2 of the script posts an on-plan check-in and then looks at Home. The second effect is the rule working as written (a new check-in is news), but on stage it reads as "I did my job and the app flagged me".
- **Fix:** in the dry run, post the exact check-ins the script uses and read Home afterwards; pick goals that stay calm. After the talk: the trend sentence must never print three equal steps as "worse" (compare at the shown precision, as D did for quarters), and the confirmation should say "this is back under Needs attention until someone looks at the new check-in".

---

## 1. Architecture: will a rebuild team copy this well?

**Short answer.** The rules layer is the real thing: `src/domain` is pure, linted, shared by the app, the import and the MCP server, and proven by a drill. That part will copy well. What will not copy well is the shape of the two interfaces a copying team is told to start with (how Faro reads and how it saves), and the worked example of "a feature is a module". The kit is honest about most of its gaps; the three below are the ones it does not say.

### A1. The store interface a team is told to implement is the one R4 and R1 say must go. **Rebuild. Checked.**

- **Saw:** `Store` (`src/data/store.ts:54–79`) has two working methods: `load(workspaceId): Promise<Snapshot>` (everything in the workspace, including the whole change log; `src/adapters/supabase/goalsStore.ts:67–106` reads 17 tables in full) and `commit(workspaceId, Commit)` (rows and change-log entries the caller has already written). 58 function signatures in 19 `src/domain` files take a whole `Snapshot`. The app reloads the whole workspace on focus and every two minutes (`src/app/state.tsx:400–411`); the MCP server loads it on every request (`server/mcp.ts:113–125`).
- **The contradiction:** R4 says "Nothing loads a whole workspace" and R1 says "The server enforces it … No key a browser holds can write". But `spec/rebuild/adapters.md` and `docs/handoff.md` tell a copy-and-adapt team to "write an adapter … until `storeContract` passes", and `storeContract` (`src/ports/contracts/store.ts:39–89`) proves exactly load-everything and commit-what-the-client-wrote. A team that follows the checklist in order builds the interface first and meets the requirement that forbids it second.
- **Fix:** add one page to the spec, "the ports at company scale", generated beside `adapters.md`: label `Store` as the demo-scale port; sketch the two that replace it (a **query** port returning summary rows and paged lists, a **command** port that names an action and its input and runs `src/domain` on the server); and reorder the handoff checklist so R1 and R4 are read before step 2.

### A2. Saves trust the caller for everything: who acted, when, the audit entry, and every rule. **Rebuild. Checked.**

- **Saw:** an action is a pure function that returns a `Commit` (`src/domain/actions.ts:16–30`); the browser runs it, stamps the time from its own clock (`src/app/state.tsx:445–449`), writes the change-log entry with its own `actorId`, and sends the lot. The database function checks that the rows belong to the workspace and that goal and review versions haven't moved (`supabase/migrations/0011_transactional_saves.sql:104–111`), and nothing else. Only goals and reviews carry a version; people, teams, asks, decisions and views are last-write-wins (`src/data/store.ts:24–34`).
- **Where the words mislead:** `adapters.md` says "The save rules stay in the database's functions (`okr_commit` and the rest)" and the handoff says "44 functions hold real logic … so the save rules stay in one place". R1 says the truth two folders away: "The database doesn't check them." A rebuild team will read the first and believe it.
- **Why it matters at 15,000:** an audit trail the client writes is not an audit trail; and two admins editing one person, or two people answering one ask, silently overwrite each other.
- **The good news:** because every action is already `(context) → Commit` with no screen or database in it, moving it server-side is mechanical. This is Faro's best structural decision; say so.
- **Fix:** correct the two sentences now (a docs edit); in the "ports at company scale" page say that the command port is where `src/domain/actions` runs, and that the server sets actor, time and ids.

### A3. The worked example of a module reaches into about twenty core files. **Rebuild. Checked.**

- **Saw:** the architecture doc's first rule is "It never edits the core to wire itself in." The metric library, which is the module being finished live on Wednesday as "how a feature is added", has its rules in `src/domain/metrics.ts`, its records in the core's `Snapshot` and `Commit` (`src/domain/types.ts:350–354`, `src/domain/commit.ts:22–25`), and code in `src/data/store.ts:111–113`, `src/data/rows.ts`, both database adapters, `src/app/state.tsx:141–149` and `:598–603` (four methods on the app's own interface), `src/domain/removal.ts`, `cycle.ts`, `columns.ts`, `export.ts`, `src/mcp/parity.ts`, `GoalWizard.tsx` and `GoalEdit.tsx`. Its `module.json` lists two files under `elsewhere`. The module folder itself holds a manifest, a README and its AI tools.
- **Why it matters:** only two modules exist, one with no data (spreadsheets) and one with no screens yet (metrics). Reviews, asks, Watching, the Map and markup are still core ("reviews touch about 90 files"). So the CI job "core journeys without each module" proves that leaves can be removed, not that a feature with its own records can be added without editing the core. A team copying the pattern will discover that on their first real module. On Wednesday an engineer who opens the diff of the live build will see it too.
- **Fix:** before the talk, one honest sentence in the script ("a module with its own data still adds its records to the core's types and store; making that an extension point is the next step"). After: either add a records extension point (a module declares its tables, row mappers and commit keys; the store and adapters iterate over them) or change the rule in `docs/architecture.md` to say what is true. Make `elsewhere` complete and have the manifest test fail when it isn't.

### A4. There is no organisation in the data model. **Rebuild (as a requirement). Checked.**

- **Saw:** a `Team` is a name, a lead and an objective, with no parent; a `Person` has a team and an `admin` flag, with no manager (`src/domain/types.ts:8–35`). Goal levels are a fixed three, one of them a job title: `'north-star' | 'svp' | 'team'`, used in 16 source files. One workspace is the whole company.
- **Why it matters:** at 15,000 people and 1,500 teams, "By team" is 1,500 flat groups, "my division" cannot be asked, a leader's Home cannot be scoped to their part of the company, and a three-level tree does not fit most companies. Nothing in `spec/requirements/internal/` or the backlog mentions it.
- **Fix:** a spec-only requirement (an R6): teams form a tree fed from the company directory, levels are configured per workspace, and every list, count and review can be scoped to a node of that tree.

### A5. "Rules live once" holds, with small leaks worth naming. **Worth doing. Checked.**

- Goal keys are worked out in TypeScript (`src/domain/goalKey.ts`, `settleKeys` in `src/data/store.ts:92`) and again in a database trigger (`supabase/migrations/0021_goal_keys.sql:47–80`). The trigger is right to exist (two people adding goals at once), but it is the one rule stated twice, and the key the app shows before the save can differ from the one the database gives. Say so in the spec's data model.
- `find_goals` filters by its own chain (text, owner, status, level, mine) and then by the shared query (`src/mcp/tools.ts`, the `find_goals` handler). Route all of it through `domain/query.ts`. It matters now: **search by key fails in the app** ("G-48" gives "0 of 126 goals" on main and on GP, checked, while `/demo/goals/G-48` opens the goal), though the header comment of `goalKey.ts` promises a key is accepted "anywhere a goal's ID is accepted", and the MCP tool does accept it. One rule, two behaviours.
- `src/domain/goalPage.ts:331` calls `new Date()`: the pure layer reads the clock. The layers lint bans `fetch`, `window` and storage but not `new Date()` or `Date.now()`; add them, since the clock is a port.
- English sentences are part of the rules' output (the scorecard's words are conformance data). That is deliberate and gives the drill its teeth, but it means a rebuild in another language, or a change of wording, fails conformance. Split the scorecard rows into codes and numbers (scored) and words (a second, optional file).

### A6. The spec and the kit: honest, and thinner than "rebuild Faro from the kit" suggests. **Worth doing. Checked.**

- Stage 1 (the rules) is real: generated, example-tested, drilled twice. Stages 2 to 5 are outlines of two to three kilobytes each. Stage 3 covers about 12,000 lines of screens with a list of headings and button labels. The kit says all this itself, clearly.
- **What a team would get wrong:** treating "rewrite from the spec" as a real option for anything beyond the rules. The product ideas most worth copying (the review walkthrough, the adaptive check-in, Home's one main thing) live in the screens, which the kit cannot carry. **Recommend on Wednesday: copy and adapt is the path; the kit proves the rules survive the move.**
- "Generated from the code, so it can't drift" is true of structure and examples, and false of the prose: each rule's words are hand-written in `src/spec/rules.ts` (521 lines). The examples catch a wrong number, not a wrong sentence. Say "examples can't drift" rather than "the spec can't drift".
- To read the database as it is, a team must replay 33 migrations (`okr_write` is redefined ten times). Generate one schema file into the kit.

### A7. Things a copying team should be told not to copy. **Polish, but say them.**

- A built 1.46 MB bundle (`api/mcp.js`) committed to the repository: nearly every merge commit on main says "api/mcp.js rebuilt". Build it in CI.
- One main browser bundle of 1.22 MB (374 KB compressed); R4's own budget is 300 KB for the first screen.
- Demo plumbing inside the store port (`hasExample`, `resetExample`, the example's storage key) and the port file re-exporting from `src/data/store.ts`, which imports from `src/mcp`. Move the interface into `src/ports` and the demo parts into the browser adapter.

### The three seams most likely to break at 15,000 people

1. **Reading: `Store.load` → `Snapshot` → every rule.** The first to go, and the widest: 58 rule signatures, 46 screen and component files that use the app's loaded state, the two-minute reload, the MCP server's load per request. R4 names the destination; nothing names the route (A1).
2. **Saving: `Commit` written by the caller.** Client-authored audit entries and timestamps, rules checked only where the caller runs them, and optimistic locking on goals and reviews only (A2).
3. **Who and where: a flat workspace with a name picker.** `Identity.who()` is a remembered choice, `admin` is a field on the person, every workspace is listed to every visitor, and there is no organisation tree to scope anything by. R1 and R2 cover sign-in; nothing covers structure (A4). I rank this above the module seam (A3), which hurts the team building it rather than the people using it.

---

## 2. Product

### Is the weekly loop the clear core idea?

**Yes for the owner, mostly for the manager, not yet for the leader.** Check-in → Home is tight and fast (six clicks for two goals, drafts that survive, the badge, ring and streak all move at once). Review → decisions works per goal. The loop is weakest exactly where it should close:

### P1. "Being handled" means "someone clicked", and it empties the leader's headline number. **Worth doing (a product call for Lane). Checked, on GP.**

- **Saw:** a goal that is off track or at risk stops needing attention when anyone but its owner marks it reviewed or adds a note (`src/domain/attention.ts`, `handledFor`, `LOOKS = { note, acknowledge }`). In the demo today that gives: **32 "need attention", of which 17 are on track; 25 "being handled", which include 8 of the 11 off-track goals.** So the count a leader sees is mostly healthy goals with a trend flag, and most of the goals that will miss have left it because someone pressed "Reviewed & next". One press of "Mark N … reviewed" (T3) clears a whole review's worth.
- GP makes this honest in words ("Someone looked at these after their latest check-in") and stops hiding the goals, which is the right first step and fixes the 9 Nov finding. The label still says more than the data backs: looked at is not handled.
- **Why it matters:** this is the rule the rebuild is most likely to copy as it stands, and the one most likely to teach managers that clicking through a review makes red go away.
- **Fix (options for Lane):** (a) keep the word "Being handled" only for an agreed action with an owner and a date, or an answered request, and call the rest "Looked at"; or (b) keep the rule and rename the group "Seen since the last check-in". Either way an off-track goal should stay in the leader's count until it has an action.

### P2. A review ends without an ending. **Worth doing. Walk.**

- A review has no close step (T3), no decision type (the walkthrough offers note, question, action; "we decided X" is free text in a note), and nothing appears on the runner's Home afterwards. Carry-forward exists per goal ("Last time we talked", "Open actions N" on the Reviews list) but there is no "last time we agreed" at the top of the next session. **Already in the backlog as L (2)** for the carry-forward; the missing decision type and the missing close are new and belong with it.

### P3. Does every screen serve the loop?

- **Serve it well:** Home, the check-in, the goal page, the review walkthrough, Needs attention.
- **Serve it loosely:** Goals has six tabs, five layouts (after GP), saved views, filters and sorts for 126 goals; it is a good explorer, but nothing on it says "this is what to do before Thursday". Activity is a flat feed of 6,343 changes with no weekly summary.
- **Do not serve it:** Data (spreadsheet tables), Workspace's Inbox (feedback about Faro itself), Features, and the Demo and Motion controls. They are honest tools for the model and the demo, and WS moves the Inbox out. They should be marked in the spec as "Faro's own workshop, not the product".

### What Faro is teaching the rebuild that it should not copy

1. **Load everything, work it out in the browser** (A1). The kit says so in R4; the code says the opposite louder.
2. **"Reviewed" as a click that clears attention** (P1).
3. **Calling the company's deadline "the review"** when each person may be in a different review, or none (T4).
4. **Six tabs times five layouts times saved views** on one page, each with its own count. GP cuts one layout; the lesson for the rebuild is to start with two (List and Board) and add on evidence.
5. **A module that edits the core** as the model module (A3).
6. **An open inbox, an open workspace list and a name picker.** By design here, and R1 says so; still the pattern most likely to leak into a pilot if someone copies the code on a Friday.
7. **Explaining a number with a paragraph.** Faro's instinct to say what every count means is right, but several counts now need 50 words (see U6). If a number needs a paragraph, the number is the problem.

### What a leader would expect in week one, and won't find

Checked against the backlog and the spec; the first four are not in either.

1. **Their part of the company.** No division or department, no "my organisation" scope, no manager chain (A4). **New.**
2. **Which teams are worst.** "By team" lists 14 teams with one status word each, in directory order, on an 11,000 px page; "Worst first" does not reorder the teams and removes the header's status (walk). A one-screen table of teams with counts by status is the cheapest high-value screen missing. **New** (the "VP portfolio view" in the backlog's unplaced ideas is the larger version).
3. **What changed since last week, as a summary.** Activity's "this week" is 16 raw changes; "last week" is 271. No "3 goals went off track, 2 recovered, 5 missed their check-in". **Partly in the backlog** (unplaced idea: VP portfolio view).
4. **Someone to check in for them.** No delegate, no co-owner: an owner on leave means a goal with no recent update. **New**; write it as a requirement.
5. **Being told.** No reminder, digest or notification of any kind. **Already in the backlog as R5** (spec only). A leader will ask in the first five minutes; have the answer ready.
6. **Setting goals for the next cycle together.** Goals are published at once; there is no draft, propose and agree step for a planning round. **New**; a requirement at least.
7. **Numbers that fill themselves in.** The port exists (`NumberSource`) and nothing on screen reads it. **Already in the backlog** (8c, 0b's growth notes).
8. **Search from anywhere, and by key.** No global search (**already in the backlog as R5 and 0a**); search by "G-48" fails on Goals (**new**, A5).

---

## 3. UX flows, end to end

### Flow 1. First set-up (the person who brings Faro to a team)

**Steps:** Welcome → 1 Workspace → 2 You → 3 Your team → 4 Starting point → 5 Outcome → 6 Goals → 7 Check → `/ready` → Home. Seven steps, about ten typed fields with a template, nine clicks. Back keeps entries, a reload offers "Picked up where you left off", errors are per field. The S fixes all hold on the template path.

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| U1 | On the live site a new visitor never reaches Welcome or set-up without first choosing a name in someone else's workspace (T1); `/workspace/new` is behind the same picker. **Checked. WS area.** | The first-run flow, the thing the script opens with, is unreachable where it is shown | Talk (T1), then Worth doing | Give Welcome and set-up their own addresses, reachable with any number of workspaces |
| U2 | `/ready` says "invite your team: copy the link" and the link is the site's root, which opens the oldest workspace's name picker, not the one just made. **Walk.** | The invitation leads colleagues into the wrong workspace | Worth doing (WS area) | Put the workspace in the link |
| U3 | First check-in on the template goal "First response time" (6 → 2 hours): typing 5.5 is refused ("this goal keeps whole numbers … set the goal's Decimals to 1"), with no link to that setting; set-up never asked about decimals. **Walk.** | The very first check-in dead-ends on a setting the person has never seen | Worth doing | Infer decimals from the unit and the start/target typed at set-up; in the error, offer "Keep one decimal for this goal" |
| U4 | The spreadsheet path creates goals that are late on day one: the app's own template, uploaded unchanged in week 46, gives "0 of 3 stages · Late · Not met", "late, up to 44 weeks". **Walk.** | S fixed "nothing overdue on day one" for templates; the upload path still breaks it | Worth doing | On upload at set-up, shift or question any date before the joining week |
| U5 | Uploading a spreadsheet silently replaces the people already typed. **Walk.** | Lost work with no undo | Worth doing | Merge, or ask |
| U6 | Day one says things the data doesn't back: "No value yet" for a goal whose "Today" value (70) was just entered; "Reviews 1 to do" from the first minute; for an admin with no goals the main action is "Open the review" with three of four goals not yet checked in; "0 of 2 goals have had their first check-in" where `/ready` said 3 goals; with "Set goals up later", "The first check-ins are due before Thursday" with no goals. **Walk.** | Day one is when trust is made | Worth doing | Treat the set-up's "Today" as the week-0 value everywhere; no review "to do" before the first check-ins are due |
| U7 | Workspace on day one: Cycles says "Has check-ins" before any; Teams names a lead set-up never asked for; a non-admin sees "New workspace"; Privacy says recording is "On for everyone here" though set-up never mentioned it. **Walk. WS area** (the handover says WS asks about recording at set-up and fixes Overview and Cycles). | Truthfulness | — | Check against WS when it lands |

### Flow 2. A weekly check-in (Tunde, two goals)

**Steps:** Home → Start check-in → post (on track, one step) → next → type a number behind plan → "Something changed" → cause and path back → post → "Both your goals are checked in for week 46" → Home. Six clicks. Badge, ring, streak, goal page and Activity all update at once. This is the best flow in the app.

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| U8 | The form never says which week it is for until the confirmation; after a reload the header loses "2 of 2". **Walk.** | Corrections and late check-ins are where week mix-ups happen | Polish | "Week 46 check-in · 1 of 2" in the header |
| U9 | "Something changed" opens prefilled with last week's cause and plan and posts with nothing edited. **Walk.** | The app's best rule ("behind needs a story") can be met by pressing Post; the same story then carries week to week | Worth doing | When carried text is unchanged, ask "Still true this week?" as one explicit choice, and record it as carried |
| U10 | Number checks are uneven: "-5" pairs is accepted with only "Is -5 right?"; "-3" min is refused in the table but not the same way in the form; 41 against "top 40" passes silently; the error example "like 29.4" shows on a whole-number goal. **Walk.** N built plausibility as a question, so the soft warning is by design; the unevenness between form and table is new. | One rule, two behaviours | Polish | One number check for form and table; no decimal example on a whole-number goal |
| U11 | On the goal page the check-in just posted is folded into "Weeks 45–46" with no number or status, while week 44 shows "30 pairs · At risk". **Walk.** | The newest fact is the one hidden | Worth doing | Never fold the current week |
| U12 | The table path ("type all your numbers") ends in a toast only; the button says "Post 5 check-ins" with three invalid rows; a draft from the one-by-one flow isn't carried into it. **Walk.** | The fast path is the one busy owners use | Polish | Count only valid rows; share the draft; land on the same confirmation |
| — | "Getting worse: on plan → on plan → on plan", and a goal jumping to "Need attention" under "You're all set" | See T5 | Talk | — |

### Flow 3. A manager preparing for the review (Rhea)

**Steps:** Home → answer the open question → check-ins → Goals: Mine, Watching, Needs attention → filter to her team → two goal pages. About 23 clicks. The counts agree where they should: "Your goals · 8" = Mine 8 = 8 rows; Watching 12 = 4 + 2 + 6; her team "17 of 126" in every layout; Board columns sum to 17.

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| — | Two review days on Home | See T4 | Talk | — |
| U13 | **GP.** On the Needs attention tab three sets of numbers sit within one screen: the tab says 32; the sentence says "3 off track, 10 at risk, 2 no recent update and 17 on track"; the new health line directly above says "11 off track · 27 at risk · 2 no recent update · 17 on track" (it counts the 57 shown). **Checked on a local build of GP.** | GP's own aim was one count that explains itself; the health line reintroduces the disagreement the tab sentence then has to explain | Worth doing, before GP merges if cheap | On this tab, make the health line count the first group only, or drop it there |
| U14 | **GP.** Board on the Needs attention tab mixes handled goals into the status columns with no mark ("Off track 11" under a tab titled "Needs attention, 32 goals"); the words "being handled" appear once, in the paragraph. The page is 11,285 px tall. **Checked on GP.** | The grouping GP adds in List is lost in Board | Worth doing | A "Being handled" mark on those cards, or a second row of columns |
| U15 | **GP.** With a team filter on, main's summary still gives the workspace's numbers ("32 goals flagged … so the board shows 57" above 7 rows) (walk, on main). On GP the paragraph is 57 words and, at 390 px, pushes the first goal to about 480 px down, twice the 240 px that G's eval holds on the default tab. **Checked on GP at 390 px.** | The sentence must describe the rows under it; and the phone lost what G won | Worth doing | Count what is shown; one line with a "Why?" as the first-check-in note does |
| U16 | Home's check-in ring ("0/7") and the review page's ring ("0/35") look identical and mean different things; on Home the check-in ring sits right under the "Next review" tile. **Walk.** | Same shape, two meanings | Polish | Label inside the ring ("check-ins", "reviewed") |
| U17 | Home's "Being handled" row for Lead time for changes already quotes the answer ("Rhea expects queue wait under five minutes by week 49") to the question still shown open above it. **Walk; seed data.** | Looks like the app lost the answer | Polish | Fix the seed |

Not raised again: plain select pickers (0a), the collapsed sidebar (NAV), the goal page's editors, Watch and Back (GD).

### Flow 4. Running the review (Rhea, Developer Productivity fortnightly, 35 goals)

**Steps:** Reviews → the review → "Start review · 14 goals" → per goal: add an action, a question or a note → "Reviewed & next" → … → bulk-mark the 21 with nothing flagged. About 26 clicks. What is said shows at once on the review page ("What was said": actions, questions, notes), the goal page ("Last time we talked", "Actions") and Activity, and survives a reload.

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| — | Bulk-mark closes the review; the counter restarts and jumps; a deep link re-sorts and skips | See T3 | Talk, then Worth doing | — |
| U18 | After the review closes, other screens still name the old session: Home "Next review … Tuesday · tomorrow"; goal pages "Next: Developer Productivity fortnightly, Tuesday 10 Nov"; the walkthrough address still shows "35 of 35 reviewed" and offers "Reviewed & finish". **Walk.** | The same "one source of truth for the review" fault T fixed for the count, now for the date | Worth doing | Read the next session from one function everywhere (`upcomingSessionWeek` exists) |
| U19 | Mid-review, "Last time we talked" shows the session in progress. **Walk.** | "Last time" should be last time | Polish | Exclude the open session |
| U20 | Reviewing an on-track goal flagged "Getting worse" changes nothing: it stays under "nobody has picked up yet" after being reviewed, because only off-track and at-risk goals can be handled. **Walk; consistent with `handledFor`.** | The reviewer did the work and the screen says nobody did; these are 17 of the 32 | Worth doing (with P1) | Let a look settle a trend flag until the next check-in, or word the group so it doesn't claim nobody looked |
| U21 | "Still to review · 26" (Amara, weekly review) has no sub-headings and runs no-recent-update, at risk, on track, then off track, then at risk. **Walk. Already in the backlog as R (F15)** for why each row is there; the order is new. | Worst is not first in the one list built for discussion | Worth doing (with F15) | Order by the same weight as Needs attention |
| U22 | Activity: "Rhea Kapoor reviewed 33 goals … nothing to add" after 35 were reviewed and three had something said. **Walk.** | An off-by-one in the record of the review | Polish | Count only goals with nothing said |

### Flow 5. A leader scanning the company (Amara)

**In under a minute she can answer:** how many are off track (Home: "11 off track · 27 at risk · 2 no recent update · 2 no check-in yet · 76 on track · 8 done", which sums to 126 and matches the Board and `?status=off`), and what is waiting on her ("Needs your response 2"). **She cannot answer:** which teams are worst, or what changed this week (see "week one" above).

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| U23 | Home's health counts are one link to unfiltered Goals; "11 off track" does not open the 11, though `?status=off` exists. **Walk.** | The most natural click on the page does the least | Worth doing (small) | Each count links to its filter |
| U24 | "By team" and "Worst first": 14 headers with a status word and no counts; sorting worst-first leaves the teams in directory order. GP makes worst-first rank across trees; the By team tab is not in its diff. **Walk.** | See "week one", item 2 | Worth doing | Counts on each team header; worst-first orders the groups |
| U25 | The saved view "Waiting on a decision" says "3 of 126 goals" while Table labels 7 rows "Decision or help needed", and leaves out the goal Home says is waiting on her. **Walk, on main.** GP's change to the attention filter should bring the handled ones back: re-check this view on GP. | A leader's own saved view under-reports what waits on her | Check on GP | — |
| U26 | Seed data that contradicts itself: a goal "Updated 6 Oct · week 41" whose "Last time we talked" says "No update since week 40"; Activity "Today" lists check-ins "for week 45" dated 9 Nov (week 46); "1 pts behind plan". **Walk.** | A leader reading closely on Wednesday | Polish | Fix the seed; the singular rule is **already in the backlog as 0u** |
| U27 | At 390 px, "Needs your response" cuts the ask mid-word ("approve the extra CI runn…"). **Walk.** | The one thing she must read | Polish | Wrap to two lines |

### Flow 6. Finding a goal

**Works:** search on Goals by a word, an owner or a team; the address keeps `?q=`, a direct load restores it, Back returns to the search; zero results says so and offers "Clear search and filters".

| # | What was seen | Why it matters | Severity | Fix |
|---|---|---|---|---|
| U28 | Search by key fails: "G-48", "g48", "48" all give "0 of 126 goals", on main and GP, though keys are shown in Table and in addresses. **Checked.** | Keys exist so people can say "G-48" in a meeting and find it | Worth doing (small) | Add the key to the search text in `domain/query.ts` (`matches`, line 130) |
| U29 | No tolerance for a typo ("rolback": 0, no suggestion). **Walk.** | Minor at 126 goals, real at 30,000 | Polish | Belongs to the server search in R4 |
| — | No search outside Goals, Activity and Data | **Already in the backlog as R5 and 0a** | — | — |

### Where the app breaks its own design rules

The walks scanned computed styles on every screen visited, at both widths. **No coloured edges, quote bars, emoji icons, gradients or state pills were found anywhere**, and status was a shape plus a word throughout. That is a strong result. Three things to fix or decide:

| # | What was seen | Rule | Severity | Fix |
|---|---|---|---|---|
| D1 | On phones the top bar and the tab bar are translucent with `backdrop-filter: blur(10px)` (`src/styles.css:448–449`), on every screen. **Checked.** The design check (P6, `evals/journeys.cjs:3085`) looks for gradients but not for backdrop blur. | Rule 4: no glass | Worth doing (small) | Make both opaque; add `backdrop-filter` to P6 |
| D2 | Board cards carry no status of their own, only the column header; on a phone the columns stack and a card mid-scroll shows none. **Walk; suspected.** | "They sit … the first thing on a row, card or node" | Polish | Decide: either the rule excepts Board cards, or the card repeats the shape and word on phones |
| D3 | Touch targets under 44 px at 390 px: "Start over", "Change" and "Change people" in set-up (20 px), the admin checkbox (18 px), "Show all 44 check-ins" (20 px) and "Edit" (32 px) in the walkthrough. **Walk.** Small targets are **already open in `docs/simulated-users.md`**; these are new instances. | "every control is at least 44px" | Polish | Pad the links |

Borderline and fine: the person chips on a review and the grey count beside a tab are capsules, but neither is a state; "→" appears in prose ("14 min → 3 min"), not as an icon.

---

## The ten I would act on first

1. **T1: the root page shows "Pet store", not the welcome page.** Decide tonight: delete it, or open with `/?store=browser`. Rehearse it.
2. **T2: pin the demo's date** (`/demo?today=2026-11-11`) for the dry run and the talk, and take the script's numbers from that address.
3. **T3 and T5: drive the demo round the review's faults** (forward only, no bulk button, no resume) and try the script's exact check-ins in the dry run. After the talk, give the review a real "Finish" and a fixed agenda order.
4. **A3: one honest sentence in the talk** about the metric library module editing the core, before an engineer finds it in the diff.
5. **A1 and A2: fix the two misleading sentences now** ("the save rules stay in the database's functions") and add "the ports at company scale" to the kit, so copy-and-adapt doesn't start by building the interface R1 and R4 forbid.
6. **P1: decide what "Being handled" means.** Today a click moves 8 of 11 off-track goals out of the leader's count. It is the rule the rebuild will copy most faithfully.
7. **T4: Home says "the review" for the workspace's deadline.** Say "check-ins are due by Thursday"; keep "review" for a review the person is in.
8. **U13–U15 (GP): one set of numbers on the Needs attention tab**, a handled mark on Board, and the paragraph down to a line. Cheapest before GP merges.
9. **A4 and the week-one list: write the organisation tree, a delegate, and a planning round as requirements** (an R6), and build the one small screen leaders will miss first: teams with counts by status, worst first (U24), with Home's counts linking to their filters (U23).
10. **U28 and D1: two small trust fixes.** Search finds "G-48"; the phone bars stop being glass and the design check learns to look.

## Three things Faro does well that the rebuild must keep

1. **Rules as pure functions that return what to save, used by the app, the import and the AI tools alike, with every status a shape, a word and a sentence saying why.** It is why a second implementation could score 100% from the kit, why the numbers agreed across Home, Goals, Board and Reviews in almost every place the walks compared them, and why moving the rules to a server is a mechanical job rather than a rewrite.
2. **The check-in that asks only for what the numbers require.** On plan is one step; behind asks for a cause and a way back; drafts survive anything; everything updates at once. Six clicks for two goals. It is the habit the whole product rests on, and it is already good.
3. **Honesty as a design rule.** The kit lists its own gaps; R1 and R4 say what Faro does not do; counts explain themselves; "nothing needs attention only means nobody has reported"; the review discusses only what needs it. The faults in this review are mostly places where that standard slipped. Keep the standard.
