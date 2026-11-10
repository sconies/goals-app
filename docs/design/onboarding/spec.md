# Goal onboarding: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings O1 to O11); the whole redesign is in `docs/design/README.md`. It assumes Lane takes the recommended answer to each decision; "If Lane decides otherwise" says what changes.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed`. No table, no migration. New goal, set-up and the check-in are core (`src/screens/GoalWizard.tsx`, `Onboarding.tsx`, `CheckInFlow.tsx`).

**Words used throughout.** `{goal}` is the goal's title; `{ws}` the workspace's name; `{admin}` the first name of whoever set the workspace up. The three kinds are, in sentences, "a number to move", "a number to keep in range", "dated stages". Wording in quotation marks is exact; wording not mentioned stays as it is today.

## 1. Routes

| Address | Screen | Title (navigation spec, rule 2) |
|---|---|---|
| `/goals/new` | → the draft's step, or `/goals/new/what` | — |
| `/goals/new/what` | New goal, step 1 | "New goal: what" |
| `/goals/new/who` | Step 2 | "New goal: who and where" |
| `/goals/new/measure` | Step 3 | "New goal: how it’s measured" |
| `/goals/new/check` | Step 4 | "New goal: check" |
| `/workspace/new` | → the draft's step, or `/workspace/new/workspace` | — |
| `/workspace/new/<step>` | Set-up: `workspace`, `you`, `team`, `start`, `outcome`, `goals`, `check` | "Set up: {the step's name}" |
| `/check-in/<id>` | A check-in's first step | "Check in: {goal}" |
| `/check-in/<id>/why` | Its second step (only when the numbers ask for words) | The same |
| `/ready` | Ready | "Ready" |

All are focus mode. Opening a later step's address with the earlier ones unfilled goes to the first unfilled step, with its errors not yet shown. `?parent=<id>` on `/goals/new` (the links "Add a goal that feeds this") is kept and fills "Feeds into".

### Redirects

| Old | New |
|---|---|
| `/goals/new` with a draft at step n | That step's address (replace) |
| The in-between page "You have a goal you didn’t publish" | Removed: the step opens with the line in 2.1 |

## 2. Screens

### 2.1 New goal: what applies to every step

- **Head:** "New goal" and "Step {n} of 4 · {name}" at the left; at the right the one exit, "Close and keep the draft" (navigation spec, 2.5).
- **Foot:** "Back" (not on step 1) and the primary **"Continue"** (**"Publish goal"** on Check). On a phone the foot is fixed above the keyboard.
- **Back and Forward** in the browser move between steps and keep every field. Each "Continue" adds one history entry.
- **A draft** is kept on every change, as today (`src/app/drafts.ts`). Arriving with one: the step it stopped at, and above the heading one line, `role="status"`: "Picked up the goal you hadn’t published." with the link "Start a new one" (which asks "Discard the draft of “{name}”?" → "Discard it" / "Keep it").
- **Errors** show under their field on "Continue", the first one focused, as today.

### 2.2 Step 1: what (`/goals/new/what`)

Unchanged in content: the heading "What do you want to achieve?"; "Name it the way your team would say it" (required: "Give the goal a name."); "How will you know it worked?" with the three cards, "Move a number" chosen.

**Changed:** the duplicate-title note names the other goal as a link: "Another goal is called “{title}”: {key}, {team}, owned by {name}. That’s allowed; Faro shows each one’s key beside its title." Several: the first two, then "and {k} more".

### 2.3 Step 2: who and where (`/goals/new/who`)

Wireframe 1. Heading "Whose is it, and where does it fit?"

**Content, in order**

| # | Field | Control | Starts as | Errors and notes |
|---|---|---|---|---|
| 1 | "Owner · checks in weekly" | Find-and-pick, person | The viewer | Not an admin: other people are listed but not selectable, line 2 reading "An admin adds a goal for someone else." Required: "Choose who owns it." |
| 2 | "Team" | Find-and-pick, team | The owner's team (it follows the owner until the person changes it by hand) | Required: "Choose a team." Owner in no team: empty |
| 3 | "Level" | Three choices: "Team", "SVP", "North star", each with its line as today | Rule 1 | When rule 1 gives none: "Choose a level." |
| 4 | "Feeds into" · "optional" | Find-and-pick, goal; first row "Nothing: top of its own tree"; suggestions by rule 2 | `?parent=`, else nothing chosen | A goal at the same or a lower level is listed, not selectable: "A {level} goal can’t feed a {level} goal." (today's rule, said in the list) |
| 5 | With a parent: "How much will it move “{parent}”?" · "optional"; "Why do we expect it to help?" · "optional" | Text; textarea, placeholder "What changes for “{parent}” when this goal is met?" | Empty | — |
| 6 | "Also helps" · "optional" | Find-and-pick, goal, several | None | The parent and the goal's own tree aren't selectable: "It already feeds this." |
| 7 | "It’s a guardrail…" | The tick box, as today | Off | — |

Under 4, when nothing is chosen and the level isn't North star: the hint as today, "Goals that feed nothing and have nothing feeding them show as not linked."

"Data source (optional)" leaves this step (it is the metric's "Where the number comes from"; with "No metric" it shows on step 3).

### 2.4 Step 3: how it's measured (`/goals/new/measure`)

Wireframes 2 and 3. The heading is by kind, as today: "Where does it start, and where should it end?" / "Where is the line it mustn’t cross?" / "What are the stages, and when is each due?"

**A number to move, in order**

1. The `goal.measure` place: the metric library's **"Measured by"** (metric spec, 2.4). With the module off, nothing.
2. Unit and Decimals: shown as fields only when no metric is chosen or after "Use different ones"; otherwise the metric's one line stands in for them.
3. "Today (week {w})" and "Target (week {due})", side by side, the unit shown after each field. Errors as today ("Enter where it starts.", "Enter the target.", "The target has to differ from the start.", the decimals message, the not-a-number message).
4. "By when?", as today.
5. "How will progress come?": Steady, Back-loaded, In steps, with its line, as today.
6. Once both numbers are valid: the plan chart, and under it a folded block, **"Adjust the plan week by week"**. Open, it is today's table; its explanation is rule 5's sentence for this goal.
7. With "No metric" (or the module off): "How it’s measured · optional" (textarea) and "Where the number comes from · optional" (today's "Data source").

**A number to keep in range:** item 1, then today's fields (At most / At least, "Limit", "Warn this close", Unit as item 2 says), then item 7.

**Dated stages:** no "Measured by". For each stage, in a row: "Stage {n}" (text) and **"Due"**, a select of the weeks from this week to the cycle's last, each as "Week 48 · 23–29 Nov", with a first option "Earlier…" that turns the select into the same list for the weeks before this one. "Add a stage"; "Remove" on each but the first. Errors as today ("Add at least one stage.", "Give each stage a name.").

- **A stage due before this week** (rule 3): on choosing it, under the row, `role="status"`: "Week {n} was {k} weeks ago. Is this stage already done?" with two choices: "Yes, done in week {n}" and "No, it’s overdue". One must be chosen: "Say whether this stage is done." Chosen "Yes": the row reads "Done in week {n}", with "Change".
- A number goal whose "By when" is this week or earlier can't arise (the list starts next week, as today).

### 2.5 Step 4: check (`/goals/new/check`)

Heading "Does this read right?" The sentence and the rows as today, with:

- a row **"Measured by"**: "{metric}, for {team | the whole company}." / "No metric: {the description, or “not described yet”}." (number goals only);
- "Where it fits" names the level, the parent and each "also helps" goal;
- stages said correctly: "1 stage" / "3 stages, the last due week 53"; with past stages: "1 stage is already done." / "1 stage is already overdue.";
- each row's "Change" goes to that step's address.

**After "Publish goal":** as today: the goal's page with `?published=1`, the toast "Published “{goal}”", and its banner. Stages marked done are recorded as done in their week (rule 3).

**Empty and error states (the whole wizard)**

| When | Says |
|---|---|
| The cycle is over or not started | "{cycle} has ended, so a goal can’t be added to it. An admin starts the next cycle on Workspace, Cycles." (members) / the link "Start the next cycle" (admins) |
| Publishing is refused by a rule | The rule's words at the top of Check; the draft is kept |
| The workspace has no teams | Step 2's Team: "No teams yet." and, for admins, "Add one" → `/teams` |
| A parent chosen in the draft was removed since | Step 2 opens with "“{title}” isn’t here any more, so “Feeds into” is empty again." |

### 2.6 A new goal's page, before its first check-in

The goal spec's 2.1 "No check-in yet" state. Stated here because OB2 builds it if GT1 hasn't landed:

- Summary: "No check-in yet"; primary **"Post the first check-in"** (owner); for anyone else no primary action.
- In place of the scorecard, one line: "The scorecard starts with the first check-in."
- The projection's "Too early to say" block is left out until there are three numbers (as its own words say).
- "What it measures: Not described yet." with "Describe it", once, in About; the side note and the second link go.
- The banner on `?published=1` is unchanged.

### 2.7 The first check-in (`/check-in/<id>` on a goal with none)

Wireframe 4. As today, with:

1. The head: "First check-in · week {w}" (and "· 1 of {n}" in a walk).
2. Under the field: "This sets where it stands today."
3. **The re-base question** (rule 4), when it applies, after a valid number is typed and before "Continue" does anything else. A block under the field, `role="status"`:
   - "The plan starts at {start}; you’ve typed {value}. Start the plan from {value}?"
   - **"Start from {value}"**: the goal's start becomes the value and its plan is redrawn to the same target, due week and shape (rule 4); the check-in is then on plan and takes the one-step path.
   - "Keep {start} and say why": the usual second step (`/check-in/<id>/why`).
   - One must be chosen; "Continue" is the default for neither.
4. On plan: the summary line "On plan" stays; the line "No change planned yet." is removed for a first check-in.
5. The confirmation: "Check-in saved. {goal}: {value}. Its status is {status}. It’s on the record from week {w}." then, in a walk, the count as today. After a re-base it adds: "The plan now starts from {value}." with "Undo" (which restores the start and plan and reopens the check-in).

A stages goal's first check-in is unchanged, except that stages recorded as done at set-up or in the wizard are already ticked and say "Done in week {n}".

### 2.8 Set-up (`/workspace/new/<step>`)

Wireframe 5. Seven steps as today; every step is an address and behaves as 2.1 says ("Close and keep the draft"; the browser's Back). Only these change:

- **The counter** counts the chosen path (rule 6): with "Set goals up later" or "Start blank", steps 5 and 6 don't exist and Check is "Step 5 of 5".
- **Step 3, "Who else is on it?":** the Team column's field is find-and-pick over the teams typed so far, with "Add “{q}” as a new team"; "Same as above" stays.
- **Step 5, "What outcome are you after?"** (templates): above the fields, one line: "Example numbers. Change them to yours, or leave them and correct them at the first check-in." Owner: find-and-pick over the people entered in steps 2 and 3, starting as you.
- **Step 6, "What feeds it?":** the same line once at the top; each goal's Owner is find-and-pick over the same people, **starting empty**, with the hint under the first: "Give a teammate one, so they have something to check in on." Leaving one empty is allowed.
- **Step 7, Check:** each goal's row says its owner or "No owner yet"; with any unowned: "{n} goals have no owner yet. You can choose them now, or from Home afterwards." "Change" links are 44 px high, as are "Start over" and "Change people" (0u).
- A goal with no owner is created owned by the person setting up and marked for day one's "Give {n} goals an owner" (rule 7); nothing is created without an owner in the records.

`/ready` is unchanged except its third line: "Then send your team the link below. Faro doesn’t send any email." and the link field with "Copy".

### 2.9 Day one: "Getting started" on Home

Wireframe 5. A block at the top of Home (above "Needs your response"), headed "Getting started", shown by rule 7. Each row is a sentence and one button; the first row's button is the page's primary action while the block shows (Home's own primary, "Start check-in", is that row when it is first).

| Row id | For | Sentence | Button → where | Done when |
|---|---|---|---|---|
| `first-check-in` | Anyone who owns a goal with no check-in | "Post your first check-in{s}. {They’re \| It’s} due by {weekday}." | "Start check-in" → `/check-in?start=1` | They have none left without one |
| `assign` | Whoever set it up | "Give {n} goals an owner." | "Choose owners" → `/goals?scope=mine&view=table` with the Owner column | No goal is still marked |
| `invite` | Whoever set it up | "Send your team the link to {ws}." | "Copy the link" | Copied once, or a second person has opened the workspace |
| `add-people` | Whoever set it up, while they are the only person | "Add the people who own goals." | "Add people" → `/people` | There is a second person |
| `welcome` | A person added by someone else, on their first visit | "{admin} set up {ws} on {date}{ and gave you {n} goals \| }." | — (a sentence only) | Seen |
| `see-goals` | The same, owning none | "See what {ws} is working towards." | "See the goals" → `/goals?scope=all` | Opened |
| `watch` | The same, owning none | "Watch the goals you care about, and they’ll show here." | "Find goals to watch" → `/goals?scope=all` | They watch one |
| `own-goal` | The same, owning none | "Set up a goal of your own, in about 3 minutes." | "New goal" → `/goals/new` | They own one |

At the foot: "Hide this" (kept per person and workspace; it doesn't come back). The block also goes by itself 14 days after the person's first visit, or when every row is done.

**Removed from Home:** the card "Add your people / Goal owners need to be here to check in" (it is the row `add-people`, with its true condition), and "You don’t own a goal. Watch the ones you care about, or set one up in about 3 minutes." as the whole of an owner-less person's Home (after the block is hidden or done, that sentence returns as today).

**Empty and error states**

- The demo's example workspace never shows the block (nobody set it up this week).
- A workspace set up with "Set goals up later": the first person's rows are `add-people` or `invite`, then "Set up the first goal" → `/goals/new` (id `first-goal`, done when the workspace has a goal).

## 3. Who sees what

Consistent with R1; each line names the action that already enforces it.

| Thing | Member | Admin | R1 |
|---|---|---|---|
| New goal, for a goal they own | Yes | Yes | `planChanges` ("Add a goal: anyone, for a goal they own") |
| New goal, owned by someone else | The chooser shows others as not selectable | Yes | `planChanges` ("an admin, for anyone") |
| Add a metric in place | Yes | Yes | `saveMetric` |
| Link the goal to a metric | The goal's owner (it is their new goal) | Yes | `linkGoalMetric` |
| Post the first check-in; the re-base | The goal's owner | Yes | `planChanges` (the start and plan are the goal's plan) |
| Undo a re-base | Whoever made it, or an admin | Yes | `planChanges` |
| Set up a workspace | Anyone (they become its first admin) | — | R1 rule 2 |
| "Give {n} goals an owner" | — | The person who set up (an admin) | `planChanges` |
| "Getting started" | Their own rows | Their own rows | — |

In the internal app set-up has no "Your team" step and no invite link (R6a, R2); "Getting started" for a teammate starts at their first sign-in.

## 4. Rules for `src/domain`

Pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. In `src/domain/newGoal.ts` (new) unless said. They restate nothing: plans from `plan.ts`, number checks from `numbers.ts`, weeks from `year.ts`, rights from `planChanges`.

### Rule 1. The level a new goal starts at: `startLevel(viewer, owner, snapshot, parent)`

- With a parent: one level below the parent's ("team" under an SVP goal, "svp" under a north star).
- Without: "team", unless the owner leads a team that already owns a north-star or SVP goal, in which case none (the person is asked).

| Given | Then |
|---|---|
| Rhea, no parent (CI/CD owns SVP goals, and her north star) | None: asked |
| Tunde, no parent | Team |
| Anyone, `?parent=` a north star | SVP |
| Anyone, parent an SVP goal | Team |
| Amara (leads Office of the VP, which owns north stars) | None: asked |

### Rule 2. Suggestions for "Feeds into": `parentSuggestions(level, team, viewer, snapshot)`

The find spec's rule 6 for goals, narrowed: first the goals one level above `level` whose team is `team`, worst first; then those one level above in any team that the viewer's own goals already feed; then goals opened lately that are above `level`. Six at most. For a north star: none, and the field reads "Nothing: top of its own tree" with the hint "A north star is the top of its tree."

| Given | Then |
|---|---|
| Tunde, a Team goal in Build & Release | Build & Release's SVP goals, worst first |
| Rhea, an SVP goal in CI/CD | The north stars CI/CD's goals feed (Lead time for changes first) |
| A team with no goals a level up | Goals opened lately above the level; none: no suggestions, and the search stands |

### Rule 3. A stage in the past: `pastStage(dueWeek, week)` and what Publish records

- A stage whose due week is before the current week is `past` and needs an answer: `done` or `overdue`.
- `done`: published with the stage completed in its due week (a check-in for that week marking it done, posted by the creator, dated now, with the note "Recorded as already done when the goal was set up"). It is on time, so nothing is late and its quarter reads met.
- `overdue`: published as today; the stage is late from the start, and the status rule says what it says.
- The same answers apply to set-up's stages (SU's shift-or-question on upload stays as it is).

| Given (week 46) | Then |
|---|---|
| A stage due week 48 | No question |
| A stage due week 46 | No question (this week isn't past) |
| A stage due week 1, answered "Yes, done in week 1" | Published; "1 of 1 stages", Done; nothing late; Q1 met |
| The same, answered "No, it’s overdue" | Published; "0 of 1 stages · 45 weeks late", as today; Check said "1 stage is already overdue." |
| Three stages: weeks 30 (done), 44 (overdue), 50 | "1 of 3 stages"; the second 2 weeks late; At risk by the stage rule |
| Not answered | "Say whether this stage is done." and no Continue |

### Rule 4. Re-basing at the first check-in: `rebaseOffer(goal, value, week, checkIns)` and `rebase(goal, value)`

In `src/domain/checkin.ts`.

- Offered when all hold: a number to move; it has no check-in yet; it was created at most 4 weeks ago; `value` is valid and differs from the plan's value for this week by more than the on-track margin (so the check-in would not be on plan).
- Not offered for a keep-in-range goal (it has no start), stages, or a goal with any earlier check-in.
- `rebase` returns the commit: the goal's start set to `value` from this week; the plan redrawn from `value` at this week to the same target at the same due week with the same shape (`plan.ts`); a change-log entry "started the plan from {value} at the first check-in (was {start})", which needs no reason (no check-ins had started). The check-in posted with it is on plan.
- If `value` is already at or past the target (nothing left to move): not offered; the usual path (the number check's words apply).

| Given | Then |
|---|---|
| Lead time, start 5 days, target 2, set up today; typed 7 | Offered: "The plan starts at 5 days; you’ve typed 7. Start the plan from 7?" |
| → "Start from 7" | Start 7; plan 7 → 2 by the same week; the check-in "On plan"; status On track |
| → "Keep 5 and say why" | The second step, as today |
| The same goal; typed 5 | Not offered (on plan) |
| The same; typed 5.2, within the margin | Not offered |
| A goal created 9 weeks ago, never checked in; typed far off plan | Not offered: the second step (it has been quiet too long to call it a first number) |
| A goal with a check-in last week | Not offered |
| Typed 2 (the target) on 5 → 2 | Not offered |

### Rule 5. The plan table's explanation: `planNote(goal, cycle, week)`

One sentence with this goal's own next quarter end: "Each week’s number is checked in during that week, so the one that closes {quarter} is week {n}, checked in {dates}." (Today's fixed first-quarter example, `PlanTable.tsx:62`, goes.)

| Given | Says |
|---|---|
| Week 46 of 2026 (Q4 ends week 53) | "…so the one that closes Q4 is week 53, checked in 28 Dec–3 Jan." |
| Week 10 | "…so the one that closes Q1 is week 13, checked in 23–29 Mar." |

### Rule 6. Set-up's steps: `setupSteps(choice)`

Returns the steps for the starting point chosen: a template: all seven; "Start blank": workspace, you, team, start, outcome, goals, check with empty fields (seven); "Set goals up later": workspace, you, team, start, check (five). Before a choice is made, steps 1 to 4 say "Step {n}" without "of".

| Given | Counter on Check |
|---|---|
| A template | "Step 7 of 7" |
| Set goals up later | "Step 5 of 5" |
| On step 2, nothing chosen yet | "Step 2" |

### Rule 7. Getting started: `gettingStarted(viewer, snapshot, facts)`

In `src/domain/home.ts`. `facts` is per person and workspace: `firstSeenAt`, `hidden`, `inviteCopied`, kept behind the identity port's storage. Returns the rows of 2.9 that apply and aren't done, in the table's order; nothing when hidden, when 14 days have passed since `firstSeenAt`, or when the workspace is more than 28 days old and the viewer isn't new to it.

- "Whoever set it up" is the workspace's creator (`Workspace.createdBy`; the first admin where unset).
- A goal "marked" for `assign` is one created at set-up with no owner chosen (a flag on the set-up's commit, cleared when its owner is changed or confirmed).

| Given | Then |
|---|---|
| Ana set up "Field Operations" today from a template with Ben; gave Ben one goal; left two unowned | Ana: `first-check-in`, `assign` ("Give 2 goals an owner."), `invite` |
| Ben opens it for the first time | `welcome` ("Ana set up Field Operations on 11 Nov and gave you 1 goal."), `first-check-in` |
| The same, Ben owning none | `welcome` ("Ana set up Field Operations on 11 Nov."), `see-goals`, `watch`, `own-goal` |
| Ana alone, "Set goals up later" | `add-people`, `first-goal` |
| Ana, after a second person exists | No `add-people` |
| Anyone, 15 days after their first visit | Nothing |
| The example workspace | Nothing, for everyone |

## 5. Extension points

- `goal.measure` (exists): now rendered first on the measure step, given the owner's team. Its props gain `team` at render time on New goal (it had the form's team only once step 3 was reached).
- The `check` rows of New goal are a new small list a module can add to: `newGoalCheck: [(draft, pick) → { label, text } | null]` in `app.tsx`; the metric library adds "Measured by". `docs/architecture.md` gains the row; the manifest test checks it.
- `home.blocks` (exists) is unchanged; "Getting started" is core and sits above it.

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U84 | NEW-GOAL-STEPS, FIND-AND-PICK | New goal in the order people think: as Tunde, step 1's name and kind; step 2 has him as owner, Build & Release as team, Team as level, and "Feeds into" suggests his team's SVP goals; choosing one by typing "roll" and Enter; "Also helps" takes a second goal; step 3 opens on "Measured by" (module on), then today and target; Check reads it all back with "Measured by". The address changed at each step; the browser's Back from Check returns to step 3 with the numbers there; a reload on step 3 stays on step 3 with the pick-up line; "Close and keep the draft", then New goal, returns to it. No `select` on any step lists people, teams or goals. As Rhea (not an admin) another owner is listed but not selectable |
| U85 | NEW-GOAL-TRUTH | A goal isn't born late: a stages goal with a stage in week 1 asks whether it is done; answered yes, the published goal says "1 of 1 stages", nothing late, Q1 met; answered no, Check says "1 stage is already overdue." and the page says so. Then a number goal 5 → 2 days: its first check-in with 7 offers "Start the plan from 7?"; taken, the goal is on track with the plan from 7, the confirmation says so, and Undo restores 5. Its page before the check-in said "No check-in yet" once and "The scorecard starts with the first check-in." |
| U86 | DAY-ONE | Day one is true for both: at `/?store=browser`, set up a workspace from a template with a teammate; step 6's owners start empty; give the teammate one goal and leave one unowned; Check says "1 goal has no owner yet."; Ready; Home shows "Getting started" with first check-in, "Give 1 goal an owner." and the invite link, and no "Add your people". As the teammate: "{admin} set up … and gave you 1 goal." and the first check-in. With "Set goals up later" the counter ends "Step 5 of 5" and the teammate's rows are see, watch, set up. "Hide this" removes the block for good |

**Changed:** U2, U3 (New goal: the step order, the pickers, addresses); U5, U17, U61 (set-up: owners per goal, the counter, day one); the first-check-in journeys (the head's words; no "No change planned yet."); U14's phone check of the wizard.

### F, N and P checks

| # | Check |
|---|---|
| F16 | Phone, 390 × 844 and 360 × 800: on each step of New goal and set-up, the step's first field and the primary button are on the first screen with the keyboard closed; no step is taller than two screens (today's measure step is over three with the table); every control is at least 44 px high ("Change", "Start over", "Change people" included); nothing scrolls sideways |
| N12 | The find spec's company-size check covers New goal: with 15,000 people and 30,000 goals each chooser draws at most 50 rows |
| N17 | Never late on day one: for every template and for "Start blank", a workspace set up today has no goal that is off track, at risk or late before its first check-in, and after a first check-in at the template's own start value every goal is on track |
| P3, P4, P6 | Extended to the new steps, the re-base block and "Getting started" (flat, no capsules; a past stage's question is words, not a status shape) |

### Unit tests

One file per rule with every worked example; `setupTruth.test.ts` and `firstWeek.test.ts` extended for rules 3, 4 and 7.

### Requirements (`evals/requirements.json`)

New: `NEW-GOAL-STEPS` ("New goal asks what, who and where, how it's measured, then reads it back; each step has an address and nothing is chosen from a list of everything"), `NEW-GOAL-TRUTH` ("A goal is never late or behind because of when it was typed in: a date already past is asked about, and a first number may restart the plan"), `DAY-ONE` ("In a workspace's first week Home tells each person, the second included, what is true and what to do first"). Reworded: `ONBOARDING` (the per-goal owners and the counter).

## 7. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `goals-new` (route `/goals/new`; its steps' addresses listed) | The four steps in their new order; choosing by typing; a stage already done; the folded plan; picking up a draft |
| `check-in` | The first check-in: what it sets; "Start the plan from…" and when it is offered |
| `setup` (route `/workspace/new`) | Owners per goal; example numbers; the counter; steps in the address |
| `home` | "Getting started": who sees which rows, and "Hide this" |
| `goal` | A goal before its first check-in |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| OB1 | `new-goal-order` | "New goal asks in a better order" | "What, then who and where, then how it's measured, then check." "Type to find the owner, the team and the goal it feeds. “Also helps” can be set as you create it." "Your browser's Back steps back a step." |
| OB2 | `not-born-late` | "A new goal doesn't start out late" | "A stage that's already past asks whether it's done, and a done one counts as on time." "If your first number isn't where the plan starts, you can start the plan from it." |
| OB3 | `getting-started` | "A first week that tells you what to do" | "After setting up a workspace, Home lists what's left: first check-ins, owners, the invite link." "Someone you add sees who set it up and what's theirs to do." "Set-up asks who owns each goal." |

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Keep today's order | Steps are what, measure, where, check (`/goals/new/measure` second); "Measured by" on the measure step shows "For: the whole company" until the team is chosen on the next step, and step 3 gains the "For" choice; rule 1 and 2 stand |
| 2 | Accept silently | Rule 3 and its question are dropped; the dates beside weeks stay |
| 2 | Refuse past dates | The "Earlier…" option goes; a stage due before this week is an error: "Choose this week or later. To record a stage that's already done, add it and tick it at the first check-in." |
| 3 | No re-base | Rule 4 and 2.7's item 3 are dropped; N17's second clause is dropped; the example-numbers line loses "or leave them and correct them at the first check-in" |
| 4 | All to the person setting up | Step 6's owners start as you; `assign` and its flag are dropped |
| 5 | Keep today's cards | 2.9 and rule 7 are dropped except: "Add your people" shows only while the person is alone, and a first-time teammate's Home gains the `welcome` sentence |

## 9. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| OB1 | **New goal: the order, the pickers, steps in the address** | 2.1 to 2.5; rules 1, 2, 5; the `newGoalCheck` list; U84, F16 | M | FS1 (find-and-pick). "Measured by" as find-and-pick needs ML2; until then the place renders what Wednesday built, first on the step |
| OB2 | **Not born late: past stages and the first check-in** | 2.4's stage question, 2.6, 2.7; rules 3, 4; U85, N17 | S–M | Nothing (it can go before OB1) |
| OB3 | **Set-up's owners and day one** | 2.8, 2.9; rules 6, 7; U86 | S–M | FS1 for the pickers; WR1 for `/people` (until then "Add people" goes where it goes today) |

**This replaces** NAV (5), 0a (2)'s wizard rows, SU's leftover and 0u's set-up targets. The order across areas is in `docs/design/README.md`.

**For the rebuild kit:** OB1's stage notes say New goal becomes R6c's draft-and-propose and that owners come from the directory; OB2's say rules 3 and 4 are what keeps day one honest and belong with the status rules in stage 1's conformance data.
