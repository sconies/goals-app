# Workspace set-up: the evaluation and the design

11 November 2026. Round 2, area 2 (`docs/design/round-2/README.md`): starting a workspace, from the first screen to the first week. A design, not a build: no app code is changed. The build spec is `spec.md` beside this file. The wireframes in `wireframes/` are rendered from `mockups/` (`node docs/design/setup/mockups/build.cjs`) at 1440 and 390 px.

**Revised 11 November, after Lane's decision that set-up no longer offers example goals:** the Goals step has three doors, nothing made up is written into a workspace, and what hung off the examples (owners chosen later, "example numbers") is gone.

It builds on round 1 (`docs/design/onboarding`, items OB1–OB3; `docs/design/workspace`, WR1–WR4; `docs/design/navigation`, 2.5) and uses round 2's shared decisions without restating them: the field table and the three levels (**Must fix**, **Check**, fine) belong to `docs/design/import/spec.md`; the goal form to `docs/design/goal-entry`; the two switches to `docs/design/feature-toggles`.

## The idea in five lines

1. **Welcome has an address and one job**: set up a workspace. The demo and an invitation are the two doors under it.
2. **Set-up is five steps that end in a workspace that is true on day one**: the workspace and you, how you'll work, people, goals, check.
3. **"How you'll work" is asked once, in the open, with defaults**: the year, whether check-ins have a rhythm, whether the team holds reviews. Each answer shows its first date and is repeated in the same words on Workspace → About.
4. **Every way of giving goals comes back to one list**, and every mistake is said where it was made, before the read-back, never after "Create workspace".
5. **The hand-off is an invitation, and the first week is laid out for each person** until it is done: dated, never "late" on arrival, and silent about anything switched off.

## The jobs people come to do

| Who | Job | How often | Today |
|---|---|---|---|
| Whoever brings Faro to a team | Find out what it is and start | Once | Welcome shows only while the shared database is empty; its main button opens the demo |
| The same person | Say how the team works (year, rhythm, reviews) | Once, then rarely | A folded "Change" on the name step; the day can never be changed again |
| The same person | Put the people in | Once, then now and then | Type, paste or upload: good for ten, sixteen screens for sixty on a phone |
| The same person | Put the goals in: their own, a spreadsheet, or later | Once | Templates of someone else's goals first; the spreadsheet door on another step; a spreadsheet's mistakes found after "Create workspace" |
| The same person | Check what will be made, and take it back if wrong | Once | An honest Check; "Change" loses your place; no undo but deleting |
| The same person | Tell the team | Once | A text link under a hint; the link is a bare address |
| An invited teammate | Understand why they're here and what is theirs | Once | A bare "Who are you?"; then (OB3, built) a true first Home |
| Everyone, in the first week | Know what is due and when | Daily for a week | Mostly right on day one; wrong from the day after the first Thursday |
| An admin, afterwards | See and change what set-up decided | A few times a year | About lists facts; the rhythm and the review day are nowhere |
| Someone with a workspace already | Set up a second one | Rarely | Works; runs inside the first workspace's frame |

## How it was walked

At `https://goals-app-puce-five.vercel.app/?store=browser&today=2026-11-11`, with every request to `supabase.co` blocked before the first navigation (nothing was written to the shared database), at 1440 × 900 and 390 × 844, with Playwright. The clock was moved with `today=` to 12, 13, 18, 19 and 26 November and 10 December.

- **The first screen:** the live root with the database blocked; `/?store=browser`; `/workspace/new` and `/ready` with no workspace; `/demo`.
- **Every path, end to end:** a template ("Engineering platform") with two teammates; "Set goals up later" alone; "Start blank" with a November year and a Wednesday review; the spreadsheet path with the app's own template unchanged, then with a typo'd team, an owner not on the People sheet, a missing Type column, missing owner columns, bad values (level "vp", target "one", a duplicate email), a workbook with no People sheet, a budget workbook, a stray CSV and a file that isn't a workbook.
- **The awkward cases:** Back, reload, closing and returning, "Start over", changing the name from Check, a one-person workspace, 63 pasted people with duplicates on a phone, the same name twice, a second workspace, an invitation to a workspace that doesn't exist.
- **Afterwards:** `/ready`, the copied link, the second and third person's arrival, Home for the creator, a teammate with a goal and a teammate with none, on each date; Workspace → About, Cycles, Features, Privacy, Access; Reviews, People, Teams, Activity.

### What each path costs today

| Path | Steps | Fields that must be typed | Choices that must be made | Presses of Next |
|---|---|---|---|---|
| A template ("Engineering platform"), you and two teammates | 7 | 4 (workspace name; your name, team, email) plus 2 per teammate | 1 (the starting point); owners optional | 7 |
| Start blank | 7 | The same, plus the outcome's name, today and target | 1 | 7 |
| Set goals up later | 5 | 4 | 1 | 5 |
| A spreadsheet | 5 | 4, and the file | 2 (upload on step 3; "Goals from your spreadsheet" on step 4) | 5 |

The app says "About 3 minutes" (`src/screens/Onboarding.tsx:140`). I did not time a person; a scripted run of the template path is 10 typed fields and 9 presses.

### What set-up asks, and never asks

| Thing | Today | Where it can be changed afterwards |
|---|---|---|
| The month the goal year starts | Step 1, behind "Change" (`Onboarding.tsx:343`) | Nowhere for a running cycle |
| The weekday of the weekly review, which is also the day check-ins are due (`Cycle.reviewDay`) | Step 1, behind the same "Change" (`Onboarding.tsx:346`) | **Nowhere**: no action writes `reviewDay`. The review's own weekday can be edited in Reviews, so the two can part |
| Week numbering | Not asked; said in a hint once "Change" is open | — |
| Whether check-ins have a rhythm; whether there are reviews at all | Not asked: always weekly, always a "Weekly review" for everyone | A review can be ended by hand |
| Recording | Step 1, a tick box with a 45-word hint (`Onboarding.tsx:355`) | Workspace → Privacy |
| Admins | Step 3, a tick per person | Workspace → Access |
| Team leads | Never (right: nobody is made a lead) | Teams |
| Levels | Never: a template's outcome is a north star, the rest team goals | Goal edit |
| Decimals | Never; worked out from the numbers typed (SU, #74) | Goal edit |

## Findings

Severity: **High** (it misleads, loses work or blocks), **Medium**, **Low**. Evidence is from the walk above unless a file is named.

### The first screen

**W1. Welcome has no address, and a first visitor to the live site never sees it once any workspace exists. High.**
- Welcome is what the app draws when the store has no workspace (`src/App.tsx:106`, `empty={() => <Welcome />}`). With one or more, a browser that remembers nothing opens the oldest one's name picker (`src/app/state.tsx:326`, `list[0]`). This is the deep review's T1 and U1, still true in the code. I could not look at it on the live site without reading the shared database, so this rests on the code and on `docs/handover.md` ("Any workspace made on the live site brings the name picker back").
- `/workspace/new` and `/ready` with no workspace both draw Welcome, not what their address says.

**W2. Welcome's main button leaves, and there is no door for someone who was invited. Medium.**
- "Try the demo" is the primary button and "Set up your workspace" the plain one (`Onboarding.tsx:138–139`). An invited person who lands here by a mistyped link has nothing to press.

**W19. Set-up's steps are not addresses. High.** (Round 1's OB3 specified `/workspace/new/<step>`; it was not built.)
- The address stays `/` (or `/workspace/new`) for all seven steps. The browser's Back leaves set-up from any step. A reload on step 4 returned me to Welcome; the draft was kept, but only pressing "Set up your workspace" again finds it ("Picked up where you left off. Start over").
- The exit is an icon whose only words are an `aria-label`, "Close and keep what you’ve typed" (`Onboarding.tsx:323`), not the button round 1's navigation spec (2.5) names.
- A second workspace is set up inside the first one's frame, with its sidebar and name still showing (`App.tsx:70` is inside `Shell`).
- Before a starting point is chosen the counter reads "Step 1 of 7" (`Onboarding.tsx:322`), where rule 6 says "Step 1"; on choosing "later" it becomes "of 5".

### What set-up asks

**W5. How the team will work is one folded link on the name step. Medium.**
- Step 1 says "Goals for the year 2026, in four quarters, with a weekly review for everyone on Thursdays. The first is on Thursday 12 Nov, so nothing is due before it. Change". "Change" opens two selects: "The goal year starts in" and "Weekly review on".
- Nothing asks whether the team wants a weekly rhythm or a review at all; every workspace gets both.

**W6. The day check-ins are due can never be changed, and no page says what set-up decided. High.**
- No action writes `Cycle.reviewDay` after `buildWorkspace` (`src/domain/importer.ts:80`); it is absent from `src/domain/actions.ts` and from `src/screens/Workspace.tsx`.
- Workspace → About straight after set-up lists Name, People, Year, Admins, Features and Recording. The review day and the weekly rhythm are not there; Cycles says "Week 46 of 53 · 22 Dec 2025 to 27 Dec 2026 · 4 goals · no check-ins yet".
- The "Weekly review" set-up makes can have its weekday edited in Reviews, after which Home's "Check-ins are due by Thursday" and the review's day disagree, with nothing saying so.

**W7. The first check-ins are due the next day, or the same day. High.**
- Set up on Wednesday 11 Nov with the default Thursday: "/ready" says "The first check-ins are due before Thursday 12 Nov’s review." Nobody has been invited yet.
- Set up on Wednesday with the review on Wednesdays: Check says "The first is on Wednesday 11 Nov; the first check-ins are due before it", and Home says "Check-ins are due today, Wednesday" (`firstReview`, `src/domain/progress.ts:53`; `firstWeekFrom`, `src/domain/plan.ts:29`).
- By Friday 13 Nov the creator's Home says "Check-ins were due Thursday · 1 day late" in a workspace two days old.

**W20. Set up late in the year, a workspace is given seven weeks and year-sized targets. Medium.**
- On 11 Nov the January year has 7 weeks left. About says on day one "The wrap-up opens on 21 Dec 2026." Set-up says "you join it in week 46" and asks nothing. (The setup review of 8 Nov, item 3, asked to "consider offering a year that starts now".) A template makes it worse (W24): its goals run "12 deploys today → 30 deploys" and "All by week 53".

### People

**W10. Sixty pasted people are sixteen phone screens, with no count. Medium.**
- 63 rows pasted at 390 px made the step 13,610 px tall. Nothing says how many people were read, how many teams that makes or how many rows are wrong; "Next" scrolls to the first bad one ("Fix the rows marked in red, or clear them.").
- Pasting works only into a Name field, which nothing on a phone suggests.

**W11. Three kinds of doubt about a person are handled three ways, and one is silent. High.**
- A second person with someone's email, typed: said and blocking ("“Cara Diaz”: Ben Carter already has the email ben@example.com: each person needs their own."). Right: a Must fix.
- The same in an uploaded People sheet: the second person is dropped without a word. Chloe Wu given Ben Ortiz's email produced "Read bad-values.xlsx: added 2 people; 1 in the file was already there." (`mergePeople`, called at `Onboarding.tsx:269`).
- A team one letter from another: blocks until answered ("“Feild Ops” looks like Field Ops. Use one name, so it doesn’t make a second team." with "Use Field Ops" and "It’s a different team"). This is a Check, and a good one.
- Two people with one name: a note that asks nothing ("Ben Carter (Field Ops) is already here. That’s fine…"). Then the Owner select on the goals steps lists "Ben Carter" twice with nothing to tell them apart, and the second can never be chosen: owners are matched by name (`Onboarding.tsx:111`, `590`).

### Goals

**W8. The spreadsheet door is on the people step, and its goals appear two steps later. Medium.**
- "Upload a spreadsheet" is a button on step 3, "Who else is on it?" (`Onboarding.tsx:429`). Only after a file with a Goals sheet has been read does step 4 gain "Goals from your spreadsheet · As uploaded" (`Onboarding.tsx:443`). Someone who starts at "Where do you want to start?" is never offered an import.

**W3. A spreadsheet's mistakes are found after "Create workspace", one at a time, and Check has already miscounted. High.**
- With a typo'd team on one of three goals, Check says "Goals: 2, listed below, from your spreadsheet" and lists two, as if that were the file. Pressing "Create workspace" then shows, at the top, "“Deploys rolled back”: There’s no team called “Platfrom”." (`problem[6] = result.issues[0]?.message`, `Onboarding.tsx:225`).
- The same for an owner nobody has ("No one here has the email zed.nobody@example.com. Add them on the People sheet or under Workspace first, or check it."), a level "vp", and a file with no People sheet, where Check says "Goals: None yet: the outcome and goals steps were skipped. Each owner adds theirs from New goal." before the error.
- Only the first problem is shown; there is no row number; the fix is to edit the file and upload it again two steps back. A team typed wrongly on the people step is offered "Use Field Ops"; the same typo in the Goals sheet is not.
- A deleted Type column silently drops two of three goals from the count until the button is pressed.

**W22. A wrong file is "read". Low.**
- A budget workbook: "Read wrong-file.xlsx: no people sheet." A file that isn't a workbook: "Couldn’t read broken.xlsx: Doesn't look like an `.xlsx` file" (the library's words, backticks and all).

**W24. A template fills a new workspace with someone else's goals, under your name. High.** (Added 11 Nov, after Lane's decision: "The easy onboarding by taking fake data isn't necessary any more. It doesn't make sense to just start a random platform engineering data set.")
- Step 4 offers four templates before anything else: "Engineering platform", "Product team", "Customer support", "Sales" (`src/domain/templates.ts:27–63`). Choosing one fills an outcome and three goals with numbers nobody measured: "Lead time from commit to production" 5 → 2 days, "Deploys per week" 12 → 30, "Change failure rate" 18 → 10%, "Self-service environments live" (`pickTemplate`, `Onboarding.tsx:250–257`).
- I set up "Field Operations", a field service team, and it was born with those four platform-engineering goals. The only word that they are made up is a hint on two steps: "Example numbers. Change them to yours." (`Onboarding.tsx:463`, `474`). Nothing marks them once the workspace exists.
- The outcome is owned by whoever sets up; the rest start with no owner and are then created as theirs too (`Onboarding.tsx:111`). Check said "2 goals have no owner yet"; Activity records "Ana Silva created “Field Operations” with 3 people, 2 teams and 4 goals", as fact.
- Day one then asks for work on fiction: "Post your first check-ins. They’re due by Thursday.", "3 check-ins to do", "Give 2 goals an owner." A true first number against a made-up start is what round 1's O8 found asking "Why is it behind?".
- **Why it matters:** the first thing a team reads in its own workspace is not its own. The template's job was to show what a good goal looks like; it can do that without becoming the record.

**W12. A template's goals are two steps and 21 fields. Medium. Retired with the templates.**
- "What outcome are you after?" then "What feeds it?": three cards of seven fields each, 2,165 px at 390 px (round 1's F16 allows two screens). "Add a goal" stops at four ("Four is the most here…").
- "Change the north star" and "Change the goals" on Check are 20 px tall. (These links go with the templates' steps.)

### Check, and after

**W9. "Change" on Check loses your place. Medium.**
- "Change name or year" goes to step 1; the way back to Check is "Next" six times (`Onboarding.tsx:513`, `go(0)`).

**W21. A second workspace with the same name is accepted without a word. Low.**

**W4. The invitation is a bare address under a hint, and it opens a bare question. High.**
- `/ready`'s primary button is "Check in on your 3 goals". Under it: "Then invite your team: copy the link and send it to them yourself. Faro doesn’t send any email." and the text link "Copy the link to send" (`src/screens/Start.tsx:79–80`). What is copied is `https://goals-app-puce-five.vercel.app/?workspace=ws_n0g3rv389idm`: no words for the person receiving it.
- The link opens "Field Operations / Who are you? / Pick your name. This device remembers it; sign-in comes later with your company login." (`Start.tsx:21–23`). Nothing says who set this up or what it is for until a name is picked.

**W13. Someone not on the list, and a link to nowhere, are told nothing. Medium.**
- "No one by that name. Ask whoever set up Field Operations to add you." shows only when a search finds nobody (`Start.tsx:41`), and the search exists only above eight people (`Start.tsx:25`).
- `/?workspace=ws_doesnotexist` opened Field Operations, the workspace this browser already had, without a word; with nothing in the browser it opened Welcome.

**W14. A copy kept in one browser still offers a link to send. Low.**
- Under the banner "This is a copy kept in this browser only. Nobody else sees changes made here.", `/ready` and Home both offer the invitation link.

### The first week

**W15. Day one's Home says the same thing twice and explains a count with a paragraph. Medium.**
- "Getting started" has "Post your first check-ins. They’re due by Thursday. [Start check-in]" as a plain button; below it the page's primary button is "Start check-in" again (`src/screens/Home.tsx:421–433`; round 1's spec made the first row the primary).
- "On-time streak · 0 weeks" on the first day (`Home.tsx:357`).
- "Across the whole workspace, 0 of 4 goals have had their first check-in. Until they have, “nothing needs attention” only means nobody has reported. Waiting on Ana and Ben; this week’s are due Thu 12 Nov."
- "Send your team the link to Field Operations." stays after the link was copied on `/ready`: only Home's own button records it (`Home.tsx:428`).

**W16. From the day after the first Thursday the block is wrong, and after two weeks it drops unfinished work. High.**
- Friday 13 Nov: "Post your first check-ins. They’re due by Thursday." six lines above "Check-ins were due Thursday · 1 day late". The row is given a weekday, not a date (`src/domain/dayOne.ts:80`).
- 26 Nov, fifteen days after the first visit, the block is gone (`dayOne.ts:73`) with "Give 2 goals an owner." never done. Nothing else in the app remembers those goals: About has no "To sort out". (This half goes with the templates: only they made goals with no owner chosen.)

**W17. A teammate who owns nothing is sent to a review of goals nobody has reported on. Medium.**
- Cara's first Home ends "Weekly review · 4 with nothing flagged to mark reviewed · Worst and stalest first, one at a time. [Open the review]", and her menu says "Reviews 1 to do", on a day when no goal has a check-in. (The deep review's U6, still live for this role.)

**W18. An empty workspace nags twice and promises a review of nothing. Low.**
- Goals "later", alone: "Getting started" has "Set up the first goal. [New goal]", the page ends with the primary button "Set up the first goal", and About says "To sort out · 1: No goals in 2026 yet". Home also says "Next review · Weekly review · Thursday · tomorrow".

**W23. Cycles gives the year an end the week numbers don't agree with. Low.**
- "Week 46 of 53 · 22 Dec 2025 to 27 Dec 2026", where week 53 of 2026 is 28 Dec to 3 Jan (and round 1's rule 5 says so). The year has a week 0, so it is 54 weeks on the page's own arithmetic. I did not trace the cause.

**What Lane's decision of 11 Nov retires.** With no example door: W24 is fixed by removal; W12 goes entirely; the second half of W16 (owners never chosen) cannot arise in a new workspace; W9's and W12's small links go with their steps. Still standing, with the same fixes: W8 (the spreadsheet door on the people step), W3, W11 (people are still chosen as owners, in the form and the import), W15, the first half of W16, W17, W18, W20.

### What works and is kept

- **The draft** survives closing and reloading, with "Start over".
- **Per-field errors** in plain words ("Add your email.", "“not-an-email” doesn’t look like an email.").
- **The team typo question**, with its two answers, and "Same as above".
- **Uploads add to what was typed** and can be undone ("added 3 people after the 1 you’d typed … Undo").
- **Stages counted from the joining week**, with "Keep the weeks as typed".
- **Check** in the app's own words, and **nothing saved before it**.
- **OB3's day one**: "Ana Silva set up Field Operations on 11 Nov and gave you 1 goal."; "Hide this".
- **About after set-up** has no nags on day one, Recording is as chosen, no team has a lead, Cycles says "no check-ins yet".

## The design

### Welcome (wireframe 1)

- **Its own address, `/welcome`**, reachable with any number of workspaces. A browser that remembers no workspace, opening `/` without an invitation, goes there; it is never dropped into someone else's workspace.
- **What it says Faro is:** Lane's headline, then two lines: "Faro keeps each outcome and the goals that move it in one place, each with an owner, a measure and a plan." "Owners keep them current. What’s slipping comes to you, with why and what’s being done about it."
- **One primary action: "Set up a workspace"**, with "About 5 minutes. Nothing is saved until the last step."
- **Two doors under it, as rows:** "Look around the demo" ("A made-up division of about 100 people with a year of goals. It’s example data: change anything, but none of it can be kept or copied into a workspace.") and "Join a workspace you were invited to" (which takes a pasted link).
- **A returning person** sees "Welcome back" and what this device remembers: each workspace with who they are in it and "Open" (the primary action is opening the last one), then any set-up left unfinished with "Carry on" and "Discard".

### Set-up's shape: five steps

The lead's spine had six (Name it, You, How you'll work, People, Goals, Check). I keep its order and merge the first two, on this evidence:

- "Name it" is one field, and "You" three; together they fit one phone screen with the keyboard closed.
- "You" is already known whenever someone sets up a second workspace (the app fills it in and says "Filled in as Ana Silva, from Solo Lab"), and it disappears altogether in the internal app, where sign-in says who you are.
- Today's path is five to seven steps. Six, with a new step added, would be no shorter for anyone.

| # | Step | Address | Asks | Required |
|---|---|---|---|---|
| 1 | The workspace and you | `/workspace/new/workspace` | Its name; your name, email and team | 4 fields (1 when you are known) |
| 2 | How you'll work | `/workspace/new/how` | The year; check-ins; reviews; recording | Nothing: every answer has a default |
| 3 | People | `/workspace/new/people` | Who is on it: type, paste or upload | Nothing: you can be alone |
| 4 | Goals | `/workspace/new/goals` | Your own, a spreadsheet, or later | One choice |
| 5 | Check | `/workspace/new/check` | The read-back; "Create workspace" | — |

- **Every step is an address** (round 1's pattern, at last built); the browser's Back steps back and keeps everything; a reload stays put.
- **One exit, a button with its words: "Close and keep the draft".**
- **Focus mode always**, a second workspace included.
- **The counter is always "Step n of 5"**: no path skips a step, so rule 6's two counts go.
- "How you'll work" comes before People and Goals because its answers change their words: an owner "checks in weekly" only where there is a weekly rhythm.

### Step 2, "How you'll work" (wireframe 2)

One calm screen; "Continue" with nothing touched is a good answer.

| Question | Default, in its one sentence | The other answer | Where it is changed later |
|---|---|---|---|
| The goal year | "January to December. This is week 46 of 53." | "Change": the month it starts in | Workspace → Cycles (the next cycle) |
| Check-ins | **Every week**: "Each owner posts a number or a line once a week. Faro says what’s due, and what’s late." Due by Thursday; "The first are due Thursday 19 Nov." | **No set rhythm**: "Owners update a goal when something changes. Nothing is due or late; each goal says when it was last updated." | The rhythm's setting (the toggles area says where; this design assumes About's "How you work" row) |
| Reviews | **Hold a review**: "A meeting that walks the goals needing attention, worst first." Every week on Thursday; "The first is Thursday 19 Nov, for everyone." | **No reviews**: "Reviews stays out of the menu. Switch it on later in Workspace, Features." | Workspace → Features (on or off); Reviews (the day and how often) |
| Recording | "Off. Faro records nothing about how the app is used here." | "Change" opens today's tick box and its explanation | Workspace → Privacy |

- **The first dates are worked out, shown, and never tomorrow.** A first check-in day is the chosen weekday at least two clear days after set-up (rule S2): set up on Wednesday 11 Nov, the first Thursday that counts is the 19th.
- **Late in the year it asks one Check question.** With eight weeks or fewer left: "2026 has 7 weeks left: it ends on Sunday 3 January." → "Start now, in 2026" or "Start with 2027" (goals can be set up now; nothing is due until its first week).
- **Not asked, and said instead:** week numbering ("Weeks follow the calendar, Monday to Sunday", under "Change"); decimals; levels; team leads.
- **What set-up writes** is in the spec (section 4, rule S3): the cycle, the rhythm setting, the Reviews switch and, with reviews on, one review. Nothing else.

### Step 3, People (wireframe 3)

- **Three ways in:** type a row; "Paste people" (a sheet with one big field: a line each, commas or tabs, or addresses copied from an email, `Name <email>`); "Upload a file" (its People sheet, through the import's preview).
- **A count line first:** "6 people in 3 teams: Field Ops 3, Dispatch 2, Depot 1. 1 must be fixed, 2 to check. Show only those".
- **The three levels:**

| Level | What | Words |
|---|---|---|
| Must fix | An email used twice (typed, pasted or in a file: never dropped silently); no email; not an email; no name | "Ben Carter already has ben@example.com. Each person needs their own email." |
| Check | A name someone else here has | "There’s already a Ben Carter, in Field Ops." → "Yes, two people" / "Remove this row" |
| Check | A team one letter from another | "“Feild Ops” is one letter from Field Ops." → "Use Field Ops" / "It’s a new team" (one answer covers every row with that team) |

- **Teams are made by typing them**; the count line says which teams this makes, so a second team by accident is seen.
- **Admins:** you are one; a tick for anyone else. "Nobody is made a team lead here: choose leads later, on Teams."
- **More than twelve people** show as two-line rows (name; email and team) that open to edit; rows with something to fix or check are open.
- **Everywhere a person is chosen afterwards**, two people with one name are told apart by team and email, and matched by email.

### Step 4, Goals (wireframes 4 and 5)

Set-up no longer offers example goals (Lane, 11 Nov). A workspace starts with real goals or none.

- **Three doors in one group, with "Continue":** "Add your own", "Import a spreadsheet", "Later".
- **"Add your own" is chosen to begin with.** It is the only door that needs nothing prepared and still leaves the workspace with something true in it, in about two minutes; an import needs a file; and "Later" as the default would steer people to an empty workspace, where nothing is due and the first week has nothing in it.
- **The question:** "What are you working towards?" and under it "Add one now, bring them in a spreadsheet, or leave it to each owner. You can do more than one."
- **Every door returns to one list, "{n} goals so far"**: each goal one row (its level, numbers and owner) with "Change" and "Remove"; "Add another"; "Import a spreadsheet". "One is enough to start, and three to five is plenty for a first week. Anyone can add more from New goal afterwards." (Reworded: with no ready-made set of four, "three to five" alone read as a quota to type.) There is no cap.
- **Every goal in the list has an owner**, because the form and the import both require one. So nothing is "unowned", nothing is remembered for later, and Home never asks whoever set up to hand goals out. When every goal is yours and there are teammates, the list says once: "All {n} are yours. A teammate with a goal of their own has something to check in on."
- **"Add your own" and "Change" open the goal-entry form** (the goal-entry area designs it). Set-up frames it: the head reads "Set up a workspace · Goal 3"; the owner starts as you; its last button is "Add this goal", which returns to the list with "Added “{goal}”." and "Add another" beside it.
- **The import** is the import area's preview, opened inside set-up. Set-up adds four things: every row is new; the file's People sheet joins the people already entered (and an owner on neither is Must fix, with "Give it to someone here" and "Add {name} as a person"); a team not yet there is a Check; stages dated before this week are a Check ("Count their stages from this week" / "Keep the weeks as typed"). It ends "Use these 14 goals", back at the list, where "14 goals from goals-2026.xlsx · Remove these" undoes it.
- **"Later"** goes on to Check with no goals.

### What shows a newcomer a good goal, now that no example is put in

The templates' one real job was to show what a good goal looks like before a team had one. Three things do that without fake data in the workspace:

| Where | What it shows | Owned by |
|---|---|---|
| The goal form, as you type | Each type's card keeps its one example, and every field's hint is the field table's example for it ("%, days, hours, incidents"; "e.g. 30") | Goal entry ("No template gallery: field-table examples as hints") |
| The import template | Two example rows on Goals and one on People, each marked **Example** in Action: recognised, counted and never imported | Import (C15) |
| The demo | A whole made-up division with a year of goals, to look around. From the Goals step: "Not sure what a good goal looks like? See the goals in the demo. It opens beside this, and your set-up is kept." | Unchanged; never copied into a workspace |

### Step 5, Check: the read-back (wireframe 6)

- "Create Field Operations?" and "Nothing is saved yet. This is what pressing the button makes."
- **What will exist**, each a count and a sentence, each with "Change" that opens its step and comes straight back: people and teams (and "You’re the only admin. No team has a lead."); goals (how many, from where, who owns them); check-ins; reviews; the year; recording.
- **What nobody has been told:** "Faro sends no email. Ben Carter and Cara Diaz won’t know about this until you send them the link, which is the next screen."
- Nothing can reach Check with a Must fix; if a draft from before does, it is listed first, with a link to its row, and the button says why it won't act.

### The hand-off (wireframe 7)

- `/ready`: "Field Operations is set up", then **"Now tell Ben and Cara"** with a message ready to paste and the one primary action, **"Copy the invitation"**:

  > I’ve set up Field Operations in Faro, where we’ll keep our goals.
  > Open it and pick your name: {link}
  > Your first check-in is due by Thursday 19 Nov.

  The last line is left out with no rhythm or no goals. "Copy only the link" is beside it. Then "go to Home, where your first week is laid out."
- **The link is `/join/<workspace>`**, which opens the arrival screen.
- **Undo:** "Made by mistake? Undo: delete it and go back to the last step." It returns to Check with every answer kept, and stays possible until someone else opens the workspace or a check-in is posted (rule S6). After that, deleting is on About, as now.
- **Alone, or in a copy kept in this browser:** no invitation; the primary action is "Go to Home".

### What an invited person meets (wireframe 8)

- "Welcome to Field Operations. Ana Silva set this up on 11 Nov to keep the team’s goals in one place: 3 people, 4 goals." Then "Which one are you?": the people by team, each with one true line ("Set this up · admin", "Owns 1 goal", "No goals yet"). Choosing a name is the action.
- "Not on the list? Ask Ana Silva to add you." is always there.
- A link to a workspace that isn't there says so: "This invitation doesn’t open a workspace."
- Then Home, with "Your first week" (below).

### The first week (wireframes 9, 10 and 11)

Round 1's "Getting started" block is kept and extended; it is headed **"Your first week"** (round 2's word).

| Change | Why |
|---|---|
| Its first row with a button is the page's one primary action; Home's own "Start check-in" block, the streak and the "0 of 4" paragraph wait until the block has gone | W15 |
| Dates in full: "due by Thursday 19 Nov"; on the day, "due today"; afterwards, "It was due on Thursday 19 Nov." and no "late" until the second check-in day | W16 |
| The invitation row follows arrivals: "Ben and Cara haven’t opened Field Operations yet. [Copy the invitation]"; it goes when everyone has | W15 |
| A line for the first review, a sentence until the day ("The first review is on Thursday 19 Nov, and you’re in it."), a button on it | W17 |
| For whoever set it up, how the first check-ins are going: "3 of 4 first check-ins are in. Waiting on Ben." | W15 |
| With no rhythm: "Post a first check-in on it, so everyone can see where it starts. There’s no date to meet." With no reviews: no review line | Shared decision 6 |
| Who has yet to arrive, when the block retires, moves to About's "To sort out" | W16 |
| Nothing is "to review" until the first check-in day has passed | W17 |

The whole week, by day and role, is a table in the spec (section 5).

### Workspace straight after set-up (wireframe 12)

- **About agrees with set-up**, in the same words: a fact "How you work" ("Check-ins every week, by Thursday. A weekly review on Thursdays." with "Change"); "Set up: by Ana Silva on 11 Nov 2026, with 3 goals added at set-up."; People says who has yet to open it, with "Copy the invitation".
- **"To sort out" in the first week** is quiet: "You’re the only admin" and "teams have no lead" wait until the workspace is a week old, and who has yet to arrive is said from day 8.

### A second workspace, and the demo

- **A second workspace:** the switcher's "Set up a new workspace" opens step 1 in focus mode with you filled in as a line ("Setting up as Ana Silva, ana@example.com, Field Ops. Change"), so step 1 is one field. A name you already use is a Check: "You already have a workspace called “Solo Lab”." → "Use it anyway" / change it. People offers a fourth way in: "Bring people from Solo Lab".
- **The demo** stays, as a separate place to look around: one made-up division, kept in the browser, marked "Example data" beside its name everywhere (as now), never showing "Your first week". Nothing in it can be copied into a workspace, and Welcome says so. A workspace made in the demo, or with `?store=browser`, says on Check and on `/ready` that it is "kept in this browser only", and offers no invitation.

### Roles (R1)

| Thing | Who | Enforced by |
|---|---|---|
| Set up a workspace | Faro: anyone (they become its first admin; R1 rule 2). The internal app: a requirement (spec, section 9) | `createWorkspace` |
| Change the name; recording; Reviews on or off | Admins | `renameWorkspace`, `setRecording`, `setModule` |
| Change the rhythm and its day | Admins | The toggles area's action for the rhythm (new); this design needs it to carry the day |
| Change the review's day and how often | Anyone in it (as today) | `saveReview` |
| Add people, make admins | Admins | `addPerson`, `setAdmin` |
| Undo set-up | Whoever set it up, while rule S6 holds | `canDeleteWorkspace`, narrowed by S6 |
| Read About, "How you work" | Everyone | R1 rule 3 |

## Each screen's one primary action

| Screen | Primary action | Everything else |
|---|---|---|
| Welcome, nothing on this device | **Set up a workspace** | The demo; join by a link |
| Welcome, returning | **Open** (the last workspace) | Carry on a draft; set up another; the demo |
| Set-up, steps 1 to 4 | **Continue** | Back; Close and keep the draft |
| Goals, inside a door | **Add this goal** / **Use these {n} goals** | Back to the list |
| Check | **Create workspace** | "Change" on each line; Back |
| `/ready`, with teammates | **Copy the invitation** | Copy only the link; go to Home; Undo |
| `/ready`, alone or a browser copy | **Go to Home** | — |
| Arrival | Choosing your name | "Ask {admin} to add you" |
| Home in the first week | The first row of "Your first week" that has a button | Its other rows; "Hide this" |
| About | None as a button (round 1) | "To sort out" rows; facts with links |

## Role differences

| | Whoever set it up (admin) | A teammate with a goal | A teammate with none | A leader (owns a goal others feed, or is an admin, and didn't set it up) |
|---|---|---|---|---|
| Arrives by | `/ready` | The invitation | The invitation | The invitation |
| First row of "Your first week" | First check-ins, or the invitation when they own nothing | "{Admin} set up {ws}… and gave you {n} goals." | "{Admin} set up {ws} on {date}." | The same as a teammate |
| Primary action on day one | Start check-in | Start check-in | See the goals | Start check-in, or See the goals |
| Sees how the first check-ins are going | Yes | No | No | Yes |
| About: "To sort out" | Yes | No | No | Only if an admin |

## The phone

- Every step is one column; "Continue" is fixed above the keyboard; the head is two lines and the "Close and keep the draft" button.
- **Step 1** is four fields on one screen. **Step 2** is about 1.7 screens at 390 × 844 with every choice open, and needs no typing. **Step 5** is 1.3 screens.
- **People on a phone:** "Paste people" is the way in, since nobody types sixty rows with a thumb. Each person is a two-line row; the count line and "Show only those" make sixty people one screen of what needs attention.
- **Goals:** the three doors are one screen; the list is one row per goal with "Change" and "Remove" on a line of their own, 44 px high.
- **Limits** (held by F19): at 390 × 844 and 360 × 800 each step's first field or choice and "Continue" are on the first screen with the keyboard closed; no step is taller than two screens with up to twelve people and five goals; every control is at least 44 px; nothing scrolls sideways; "Your first week" starts within 220 px of the top of Home.

## Wireframes

| # | Screen | 1440 | 390 |
|---|---|---|---|
| 1 | Welcome: someone with nothing; a returning person with a draft | ![](wireframes/01-welcome-1440.png) | ![](wireframes/01-welcome-390.png) |
| 2 | Step 2, "How you'll work" | ![](wireframes/02-how-you-work-1440.png) | ![](wireframes/02-how-you-work-390.png) |
| 3 | Step 3, People, with a Must fix and two Checks; "Paste people" | ![](wireframes/03-people-1440.png) | ![](wireframes/03-people-390.png) |
| 4 | Step 4, Goals: the three doors, and the list they come back to | ![](wireframes/04-goals-doors-1440.png) | ![](wireframes/04-goals-doors-390.png) |
| 5 | The import inside set-up: what set-up adds | ![](wireframes/05-import-in-setup-1440.png) | ![](wireframes/05-import-in-setup-390.png) |
| 6 | Step 5, Check: the read-back | ![](wireframes/06-check-1440.png) | ![](wireframes/06-check-390.png) |
| 7 | The hand-off: the invitation; alone or a browser copy | ![](wireframes/07-ready-invite-1440.png) | ![](wireframes/07-ready-invite-390.png) |
| 8 | The invited person's arrival; a link that opens nothing | ![](wireframes/08-arrival-1440.png) | ![](wireframes/08-arrival-390.png) |
| 9 | Home on day one for whoever set it up; the first check-in day | ![](wireframes/09-home-day-one-creator-1440.png) | ![](wireframes/09-home-day-one-creator-390.png) |
| 10 | Home on a teammate's first visit: with a goal, with none | ![](wireframes/10-home-day-one-teammate-1440.png) | ![](wireframes/10-home-day-one-teammate-390.png) |
| 11 | Home with no rhythm and no reviews; an empty workspace | ![](wireframes/11-home-no-rhythm-1440.png) | ![](wireframes/11-home-no-rhythm-390.png) |
| 12 | Workspace → About straight after set-up | ![](wireframes/12-about-after-setup-1440.png) | ![](wireframes/12-about-after-setup-390.png) |

Not redrawn: round 1's set-up goals step with owners (onboarding wireframe 5a), which goes with the templates; the switcher (workspace wireframe 11); Features (the toggles area).

## What this changes in round 1

| Round 1 said | Round 2 says | Why |
|---|---|---|
| Onboarding spec 1 and 2.8: set-up is seven steps, `workspace, you, team, start, outcome, goals, check` | Five: `workspace, how, people, goals, check`. `you` joins `workspace`; `team` is `people`; `start`, `outcome` and `goals` are one step with sub-screens | W5, W8, W12 |
| Onboarding rule 6, `setupSteps(choice)`: seven steps or five, "Step {n}" before a choice | Replaced by a fixed list (rule S1). No path skips a step | W19 |
| Onboarding 2.8 and decision 4: a template's goals are edited as cards on two steps, and set-up asks who owns each | Gone, with the templates. OB3's owner-per-template-goal, the "No owner yet" choice, the remembered `unowned` ids and Home's "Give {n} goals an owner" are no longer needed: a goal typed or imported has its owner. The built code stays harmless for workspaces already made (spec, rule S4) | W24, W12; Lane, 11 Nov |
| Onboarding 2.8: `/ready` unchanged but for its third line | `/ready`'s primary action is the invitation; its check-in button goes (Home's first row is that) | W4 |
| Onboarding 2.9: the block is headed "Getting started" | "Your first week" | Round 2's words |
| Onboarding rule 7: `first-check-in` says "due by {weekday}"; `invite` is done when copied; nothing after 14 days | Dated words by rule S4; `invite` follows who has opened the workspace; what is undone moves to About (rule S5); new rows `first-review` and `progress` | W15, W16 |
| Onboarding 2.9: rows `invite` → "Send your team the link to {ws}." / "Copy the link" | "{Names} haven’t opened {ws} yet." / "Copy the invitation" | W15 |
| Workspace spec 1: `/workspace/new` is "Set-up (unchanged)" | It redirects to the draft's step; set-up is always focus mode | W19 |
| Workspace rule 3, `workspaceNeeds`: `only-admin` and `no-lead` fire from the first minute for a big enough workspace | Both wait until the workspace is 7 days old; a new need `not-arrived` (rule S5). The function gains `ws.createdAt` | W16; round 1's own aim ("isn't told off for a choice set-up never offered") |
| Workspace 2.5: About's facts | Two more: "Set up" and "How you work" | W6 |
| Workspace 2.12: the switcher's "Set up a new workspace" → `/workspace/new` | The same, landing on step 1 with you filled in | — |
| Navigation 2.5 (3) and (4): set-up has "Close and keep the draft" and steps in the address | Unchanged; this is where they are built | W19 |
| The first screen (not covered by round 1) | `/welcome`, `/join/<id>` | W1, W13 |

Everything else in round 1 stands, in particular OB2's rules 3 and 4 (a goal not born late; re-basing at the first check-in). They no longer have example numbers to make safe, and are kept for their own sake: a real goal typed in with last month's number meets the same question.

## Decisions for Lane

Settled since the first draft (Lane, 11 Nov): set-up offers no example goals. Nothing below reopens it; the spec's "If Lane decides otherwise" says what an example as a fourth door would bring back.

1. **How many steps.**
   - (a) Five: the workspace and you; how you'll work; people; goals; check. *Recommended.*
   - (b) Six: "You" keeps a step of its own.
2. **Welcome's primary action.**
   - (a) "Set up a workspace"; the demo is the first door under it. *Recommended.*
   - (b) "Try the demo" stays primary, as you set it for the talk.
3. **Welcome's words.**
   - (a) Keep your headline; two lines under it in place of the three points. *Recommended.*
   - (b) Keep the three points as they are.
4. **The first check-in day.**
   - (a) Never sooner than two clear days after a goal is set up: set up on Wednesday, due Thursday week. *Recommended.*
   - (b) As today: the next review day, even if that is tomorrow.
5. **Set up late in the year.**
   - (a) With eight weeks or fewer left, ask: start now, or start with next year. *Recommended.*
   - (b) Say how many weeks are left and ask nothing.
   - (c) As today.
6. **`/ready`'s primary action.**
   - (a) "Copy the invitation", when there is anyone to invite. *Recommended.*
   - (b) "Check in on your {n} goals", as today, with the invitation second.
7. **Undo for set-up.**
   - (a) From `/ready`, back to Check with the answers kept, until someone else opens the workspace or a check-in is posted. *Recommended.*
   - (b) Only "Delete this workspace" on About, as today.
8. **Recording.**
   - (a) Asked on "How you'll work", as its last and quietest row, off unless changed. *Recommended.*
   - (b) Stays a tick box on the first step.
9. **The block's name on Home.**
   - (a) "Your first week". *Recommended (round 2's word).*
   - (b) "Getting started", as built.
10. **Who may set up a workspace in the internal app** (a requirement, not built here).
    - (a) Anyone signed in; the platform may limit it to a directory group. *Recommended.*
    - (b) Only people in a named group.
11. **Which door is chosen to begin with on the Goals step.**
    - (a) "Add your own". *Recommended.*
    - (b) None: the person must pick.
