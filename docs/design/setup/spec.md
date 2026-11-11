# Workspace set-up: the build spec

11 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings W1 to W23). It assumes Lane takes the recommended answer to each decision there; section 10, "If Lane decides otherwise", says what changes. Nothing here is built, and main is locked until after the talk.

**Revised 11 November, after Lane's decision that set-up no longer offers example goals:** the Goals step has three doors, nothing made up is written into a workspace, and what hung off the examples (owners chosen later, "example numbers") is gone.

**Standing rules** (`CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed` (the full suite for ST2 and ST8, which touch shared layout and Home). Set-up, Welcome and Home are core (`src/screens/Onboarding.tsx`, `Start.tsx`, `Home.tsx`).

**What this spec does not own.** It refers to, and never restates:

| Thing | Owner |
|---|---|
| The field table; the levels' marks and wording pattern; the import's preview, its answers and its undo | `docs/design/import/spec.md` (IM) |
| The goal form: its fields, order, errors and read-back | `docs/design/goal-entry/spec.md` (GE) |
| The two switches: where the rhythm setting is stored and changed; Reviews as a module; what "off" removes | `docs/design/feature-toggles/spec.md` (FT) |
| Find-and-pick; the back link; "Close and keep the draft" | Round 1: `docs/design/find`, `docs/design/navigation/spec.md` 2.5 |
| "Getting started" as built; the day-one facts | Round 1: `docs/design/onboarding/spec.md` 2.8, 2.9, rule 7 (OB3, merged) |
| About, "To sort out", the switcher | Round 1: `docs/design/workspace/spec.md` (WR2, merged) |

**Words used throughout.** `{ws}` is the workspace's name; `{admin}` the full name of whoever set it up; `{day}` a weekday ("Thursday"); `{date}` a weekday and date ("Thursday 19 Nov"). Wording in quotation marks is exact; wording not mentioned stays as it is today. The worked examples use Wednesday 11 November 2026, week 46 of the January year 2026, and Ana Silva setting up "Field Operations" with Ben Carter and Cara Diaz.

## 1. Routes

| Address | Screen | Title |
|---|---|---|
| `/welcome` | Welcome | "Welcome" |
| `/join/<workspaceId>` | An invited person's arrival | "Welcome to {ws}" |
| `/workspace/new` | → the draft's step, or `/workspace/new/workspace` | — |
| `/workspace/new/workspace` | Step 1 | "Set up: the workspace and you" |
| `/workspace/new/how` | Step 2 | "Set up: how you’ll work" |
| `/workspace/new/people` | Step 3 | "Set up: people" |
| `/workspace/new/goals` | Step 4: the doors, or the goals so far | "Set up: goals" |
| `/workspace/new/goals/add`, `/workspace/new/goals/<n>` | The goal-entry form, for a new goal or goal n of the list | "Set up: goal {n}" |
| `/workspace/new/goals/import` | The import's preview, inside set-up | "Set up: import" |
| `/workspace/new/check` | Step 5 | "Set up: check" |
| `/ready` | The hand-off | "{ws} is set up" |

All are focus mode (no sidebar, no tab bar), a second workspace's set-up included. All work with no workspace in the store: none of them draws another screen in its place. In the demo they sit under `/demo` as every route does.

Opening a later step's address with an earlier step's required fields empty goes to that earlier step (replace), its errors not yet shown. `/ready` with no workspace just made goes to `/` (replace).

### Redirects and the root

| When | Goes to |
|---|---|
| `/`, the store has a workspace this browser remembers | Home, as today |
| `/`, this browser remembers no workspace (whether or not the store has any) | `/welcome` (replace). It never opens a workspace nobody chose (today `list[0]`, `src/app/state.tsx:326`) |
| `/?workspace=<id>` (the link `/ready` copied until now) | `/join/<id>` (replace), keeping `store=` and `today=` |
| `/join/<id>`, the browser already knows who the person is there | Home of that workspace |
| `/join/<id>`, no such workspace | The arrival screen's "nothing here" state (2.8); never another workspace |
| `/workspace/new` with a draft | The draft's step (replace) |
| The demo's root, `/demo` | The example, as today. `/demo/welcome` is Welcome with the example's door first (2.1) |

## 2. Screens

### 2.1 Welcome (`/welcome`)

Wireframe 1. One column, 620 px.

**Someone with nothing on this device, in order**

1. The Faro mark.
2. `h1`: "Run the company on outcomes, and manage by exception" (unchanged).
3. Two lines: "Faro keeps each outcome and the goals that move it in one place, each with an owner, a measure and a plan." / "Owners keep them current. What’s slipping comes to you, with why and what’s being done about it."
4. Primary **"Set up a workspace"** → `/workspace/new`; under it, "About 5 minutes. Nothing is saved until the last step."
5. Two rows, hairline-divided, each a link:
   - "Look around the demo" · "A made-up division of about 100 people with a year of goals. It’s example data: change anything, but none of it can be kept or copied into a workspace." → `/demo`. (The returning person's row: "Example data, about 100 people and a year of goals. None of it can be kept.")
   - "Join a workspace you were invited to" · "Open the link you were sent, or paste it here." Pressing it opens, in place, one field "The link you were sent" and the button "Open it". A link that isn't one of this site's `/join/…` or `/?workspace=…`: "That isn’t a Faro invitation. It looks like {origin}/join/…".
6. The prototype line (`PROTOTYPE_LINE`), unchanged.

**A returning person** (this browser remembers a workspace, a draft, or both)

1. The mark; `h1` "Welcome back".
2. Label "On this device", then rows:
   - each remembered workspace, last opened first: "{ws}" · "You’re {name} here · week {w}" · the button "Open" (primary on the first row only);
   - a set-up draft: "“{name}”, a set-up you didn’t finish" (no name typed: "A set-up you didn’t finish") · "Stopped at step {n} of 5, {step}, on {date}. Nothing is saved yet." · "Carry on" → the step; "Discard" asks "Discard this set-up? What you typed will be lost." → "Discard it" / "Keep it". With a draft and no workspace, "Carry on" is the primary.
3. The rows of item 5 above, with "Set up another workspace" · "About 5 minutes." first.

**States**

| When | Says |
|---|---|
| The store can't be reached | Today's "Couldn’t reach the goals data" card, unchanged |
| The demo (`/demo/welcome`) | Row 1 of item 5 reads "Back to the demo"; a workspace made here is "kept in this browser only" (2.6) |

### 2.2 Set-up: what applies to every step

- **Head:** "Set up a workspace" and "Step {n} of 5 · {name}" at the left; at the right the one exit, the button **"Close and keep the draft"** → `/welcome` (no workspace) or the page set-up was opened from. The names: "The workspace and you", "How you’ll work", "People", "Goals", "Check".
- **Foot:** "Back" (not on step 1) and the primary **"Continue"** ("Create workspace" on Check). On a phone the foot is fixed above the keyboard.
- **Back and Forward** in the browser move between steps and keep every field; each "Continue" adds one history entry. Back on step 1 leaves and keeps the draft.
- **The draft** is kept on every change, as today (`useDraft('setup:' + mode)`). Arriving with one: its step, and above the heading one line, `role="status"`: "Picked up the set-up you hadn’t finished." with "Start over" (asks "Start over? What you typed will be lost." → "Start over" / "Keep it").
- **Opened from Check** (`?from=check` on a step's address): the foot's primary reads **"Back to Check"** and goes there; "Back" is not shown.
- **Errors** show under their field on "Continue", the first one focused, as today.
- **Nothing is saved** to the store before "Create workspace".

### 2.3 Step 1: the workspace and you (`/workspace/new/workspace`)

Heading "What’s this workspace for, and who are you?"

| # | Field | Starts as | Errors and notes |
|---|---|---|---|
| 1 | "Workspace name" · placeholder "e.g. Platform Engineering" | Empty, focused | `nameProblem(name, 'workspace')` as today ("Give the workspace a name."); the length line as today |
| 2 | "Your name" | Empty | "Add your name." |
| 3 | "Your email" | Empty | "Add your email." / "“{typed}” doesn’t look like an email." |
| 4 | "Your team" | Empty | "Add your team." |

Under them: "You’ll be this workspace’s admin: you can add people, change settings and make others admins."

- **When you are known** (set-up opened from inside a workspace): fields 2 to 4 are one line, "Setting up as {name}, {email}, {team}." with "Change", which opens them.
- **A name already used** by a workspace this person is in (a Check, level 2): under field 1, the Check mark and "You already have a workspace called “{name}”." with "Use it anyway" and the field left focused. "Continue" needs one or the other.

The year, the review day and Recording leave this step (2.4).

### 2.4 Step 2: how you'll work (`/workspace/new/how`)

Wireframe 2. Heading "How will you work?" Under it: "These suit most teams, so you can just continue. An admin can change each one later in Workspace."

Four sections, hairline-divided, each an `h2`.

**"The goal year"** · link "Change"

- The sentence, by rule S3: "{January} to {December}. This is week {w} of {weeks}."
- "Change" opens "The year starts in" (a select of the twelve months, as today) and the hint "Weeks follow the calendar, Monday to Sunday. Week 1 is the week with the first Thursday of {month}."
- **Late in the year** (rule S8), a Check block, `role="status"`: the Check mark and "{year} has {k} weeks left: it ends on {date}." with two choices, one of which must be chosen (the first is chosen to begin with):
  - "Start now, in {year}" · "Goals set up today run to {end} unless you give them another date."
  - "Start with {next}" · "Set goals up now. Nothing is due until the week of {its first Monday}."

**"Check-ins"**: a radio group, label "Check-ins"

- **"Every week"** (chosen to begin with) · "Each owner posts a number or a line once a week. Faro says what’s due, and what’s late." Inside it while chosen: "Due by" and a select of Monday to Friday (Thursday to begin with), then "The first are due {date}." (rule S2).
- **"No set rhythm"** · "Owners update a goal when something changes. Nothing is due or late; each goal says when it was last updated."

**"Reviews"**: a radio group, label "Reviews"

- **"Hold a review"** (chosen to begin with) · "A meeting that walks the goals needing attention, worst first." Inside it while chosen: a select "Every week" / "Every 2 weeks" / "Every 4 weeks", the word "on", and a select of Monday to Friday (starting as the check-in day, and following it until changed by hand); then "The first is {date}, for everyone." (rule S2).
- **"No reviews"** · "Reviews stays out of the menu. Switch it on later in Workspace, Features."

**"Recording"** · link "Change"

- "Off. Faro records nothing about how the app is used here." "Change" opens today's tick box, "Record how the app is used here", and its hint, unchanged. Ticked, the sentence is "On. Faro records the pages people open and the buttons they press here, never anything anyone types."

**States**

| When | Says |
|---|---|
| The toggles area's switches don't exist in this build | The "Check-ins" and "Reviews" sections show only their first choice, as a sentence with its selects (ST3 can't offer what the app can't do) |
| "No set rhythm" and "Hold a review" | Allowed. The review's line reads "The first is {date}, for everyone. It walks whatever was last updated." |
| "Start with {next}" | Every first date on this step is in the next year's first weeks, by rule S2 from its first Monday |

### 2.5 Step 3: people (`/workspace/new/people`)

Wireframe 3. Heading "Who’s on it?" Under it: "Type them, paste rows from a spreadsheet or the To line of an email, or upload a file. You can add people later from People."

**Content, in order**

1. **The count line** (rule S7), `role="status"`, once there is anyone but you: "**{n} people** in **{t} teams**: {team} {k}, …" (five teams at most, then "and {k} more") then, when there are any, "**{a} must be fixed**, **{b} to check**." and the link "Show only those" / "Show everyone".
2. **The table**: columns Name, Email, Team, Admin. Row 1 is you ("{name} · you"), Admin ticked and fixed; its fields are step 1's and are edited there ("Change" → step 1 with `?from=people`).
   - Team is find-and-pick over the teams typed so far, with "Add “{q}” as a new team" (round 1). Empty takes yours; "Same as above" stays.
   - Each row has "Remove".
   - **More than 12 people:** rows that are fine show closed, as two lines ("{name}" / "{email} · {team}") with "Edit"; rows with a Must fix or a Check are open.
3. **Messages on a row**, under its fields, by rule S7:

| Level | When | Says | Answers |
|---|---|---|---|
| Must fix | No name | "Add a name." | — |
| Must fix | No email | "Add {name}’s email: everyone needs one." | — |
| Must fix | Not an email | "“{typed}” doesn’t look like an email." | — |
| Must fix | An email another row has (yours included) | "{other} already has {email}. Each person needs their own email." | — |
| Check | A name another row has | "There’s already a {name}, in {team}." | "Yes, two people" · "Remove this row" |
| Check | A team within one edit of another team's name (`closeTeam`, as today) | "“{typed}” is one letter from {team}." | "Use {team}" · "It’s a new team" (either covers every row with that team) |

   A Must fix row has the wash on the whole row and the outline on the field; a Check row has neither (the import spec's marks).
4. **Three plain buttons:** "Add a person"; "Paste people"; "Upload a file".
5. "Admins add people and change settings. You’re one; tick anyone else who should be. Nobody is made a team lead here: choose leads later, on Teams."
6. "People in a spreadsheet with your goals? Leave this as it is: importing it on the next step adds them."

**"Paste people"** (a sheet; full height on a phone)

- "One person on each line: name, email, then team. Commas or tabs both work, and so does a list of addresses copied from an email."
- One large text field. Under it, live, `role="status"`: "{n} people read." and, when it applies, "{k} have no team: they’ll join yours, {team}." / "{k} lines couldn’t be read: {the first, quoted}."
- "Cancel" and the primary "Add {n} people". Rows are added after those already there; nobody is replaced; a person whose email is already in the table is added and marked Must fix, not dropped.
- Pasting several lines straight into a Name field does the same, as today.

**"Upload a file"**: the import's preview (IM), limited to the People sheet. On "Use these {n} people" it returns here with, `role="status"`: "Added {n} people from {file}." and "Undo". When the file also has a Goals sheet: "It also has {g} goals. They’re waiting on the next step." (the draft keeps the file's tables, as today).

**A second workspace** adds a fourth button: "Bring people from {other ws}" (a sheet listing that workspace's people, all ticked, with "Add {n} people").

**Empty and error states**

| When | Says |
|---|---|
| Nobody but you | No count line. Under the table: "Just you for now is fine. You can add people later from People." |
| "Continue" with any Must fix | Stays; the first is focused; above the foot: "{a} rows must be fixed, or removed." |
| "Continue" with a Check unanswered | Stays; the first is focused; "{b} rows need an answer." |
| A file with no People sheet | The import's own words (IM). Set-up never says "Read {file}" for a file it took nothing from |

### 2.6 Step 4: goals (`/workspace/new/goals`)

Wireframes 4 and 5.

Set-up offers no example goals (Lane, 11 Nov: "It doesn't make sense to just start a random platform engineering data set."). A workspace begins with real goals or none; nothing made up is ever written into one.

**With no goals yet: the doors.** Heading "What are you working towards?" Under it: "Add one now, bring them in a spreadsheet, or leave it to each owner. You can do more than one." A radio group, label "How to start"; "Add your own" is chosen to begin with (it needs nothing prepared and leaves something true in the workspace; "Later" as the default would steer to an empty one):

| Choice | Its line | On "Continue" |
|---|---|---|
| "Add your own" (chosen to begin with) | "One goal at a time, with the same form as New goal. Each field shows an example of what goes in it. About two minutes each." | `/workspace/new/goals/add` |
| "Import a spreadsheet" | "Goals, and the people who own them, from Faro’s template or a workbook exported from another workspace. You see every row before it’s kept." · the link "Download the template" · "Its two example rows show what a good row looks like, and are never imported." (the import spec, C15) | The file chooser, then `/workspace/new/goals/import`. With a file already read on step 3: "Use the {g} goals in {file}" stands in for the chooser |
| "Later" | "Finish with no goals. Each owner adds theirs from New goal, and nothing is due until they do." | Check |

With "No set rhythm" chosen on step 2, "Later"'s line ends "…from New goal."

Under the group, one line: "Not sure what a good goal looks like?" and the link "See the goals in the demo" (`/demo/goals?scope=all`, in a new tab), then "It opens beside this, and your set-up is kept."

**What stands in for the examples.** Their job was to show a good goal before a team had one. It is done by: the goal form's own hints (each type's card keeps its one example; every field's hint is the field table's example for it; goal entry: "No template gallery: field-table examples as hints"); the template's Example rows, which are recognised, counted and never imported (import spec, C15); and the demo, which is a place to look and is never copied into a workspace. Set-up adds only the two sentences and the link above.

**With goals: "{n} goals so far".** Heading "{n} goals so far" ("1 goal so far").

1. On return from the form, `role="status"`: "Added “{goal}”." and the link "Add another".
2. When every goal is yours and the workspace has anyone else, once, `role="status"`: "All {n} are yours. A teammate with a goal of their own has something to check in on." (Not a Check: nothing needs answering.)
3. The list, hairline rows. Each: the title; a line "{North star | Feeds the north star | Feeds “{parent}” | Feeds nothing} · {82 → 90% by week 53 | at most 8% | 3 stages, the last due week 53} · {owner}"; and "Change" (→ `/workspace/new/goals/<n>`, the goal-entry form filled in) and "Remove" (with "Removed “{goal}”. Undo", as today).
   - "Choose an owner" is find-and-pick over the people of step 3, each shown with team and email; the choice is kept by email.
   - Goals from a file are grouped under "{g} goals from {file}" with "Remove these".
4. "Add another" (plain button → `/workspace/new/goals/add`) and the link "Import a spreadsheet".
5. "Three to five is plenty for a first week. Anyone can add more from New goal afterwards." No cap.

**The goal-entry form inside set-up** (`/workspace/new/goals/add`, `/<n>`). The form is GE's. Set-up gives it:

- the head "Set up a workspace" · "Step 4 of 5 · Goal {n}", and "Close and keep the draft";
- the people and teams of step 3 as its choices (nothing is in the store yet), and the goals so far as what it may feed;
- the owner starting as you (the form's rule; an owner is required, so no goal leaves the form or an import without one); "Feeds into" starting as the list's north star when there is one;
- its last button as **"Add this goal"** ("Save changes" for `/<n>`), and "Back to the goals" in place of Back on its first step;
- on return, the list's item 1.

A goal left unfinished in the form is kept in the draft and offered once on the list: "A goal you didn’t finish: “{name}”. Carry on · Discard".

**The import inside set-up** (`/workspace/new/goals/import`). The preview is IM's, in its "every row is new" mode. Set-up gives it and takes from it:

| Set-up adds | How |
|---|---|
| It is the first import | The count line says only what would be added: "Would add **{g} goals** and **{p} people** in **{t} new teams**. … Nothing is saved until the last step of set-up." |
| The file may create the people | The file's People sheet is merged into step 3's people before goals are checked: new emails are added; an email already there is not added twice and is counted ("{k} were already there"); two rows in the file with one email are Must fix |
| An owner on neither list | Must fix, with two answers in place: "Give it to someone here" (find-and-pick) and "Add {name} as a person" (asks only for what the row lacks: email, team) |
| A team nobody is in yet | Check: "“{team}” isn’t a team yet." with "Add {team} as a team"; when within one edit of a team, "It’s one letter from {other}. {k} goals use it: rows {…}." with "Use {other} for all {k}" first |
| Stages dated before this week, on goals with no check-ins in the file | Check: "{k} goals have stages dated before this week" … "Count their stages from this week" / "Keep the weeks as typed" (today's `stagesFromJoining`, asked instead of assumed) |
| Past check-ins in the file | Said in the count line: "…and {c} past check-ins, kept as history." |
| The way out | "Choose another file"; primary **"Use these {g} goals"**, not available while a Must fix or an unanswered Check stands (IM's rule). It returns to "goals so far" |

**Empty and error states**

| When | Says |
|---|---|
| A goal added or imported whose title is already in the list | A Check in the list: "Two goals are called “{title}”." → "Keep both" / "Remove the new one" |
| The last goal is removed | The doors return, with what was chosen before still chosen |
| A file with no Goals sheet | IM's words; set-up adds the link "Download the template" |
| A file that can't be read | IM's words. Never the library's ("Doesn't look like an `.xlsx` file", W22) |

### 2.7 Step 5: check (`/workspace/new/check`)

Wireframe 6. Heading "Create {ws}?" Under it: "Nothing is saved yet. This is what pressing the button makes."

**"What will exist"**: rows, each a bold line, one or two plain lines, and "Change" (→ its step with `?from=check`).

| Row | Bold line | Lines under it |
|---|---|---|
| People | "{n} people in {t} teams" / "Just you, in {team}" | "{you} (you), {names}." (six at most, then "and {k} more") "{team} {k}, …" · "You’re the only admin. No team has a lead." / "{k} admins: {names}. No team has a lead." |
| Goals | "{g} goals" / "No goals yet" | "1 north star and {k} that feed it, all added here." / "{k} added here." / "{g} from {file}{, with {c} past check-ins}." (each that applies) · "You own {a} and {name} {b}. {name} owns none yet." (names of people who own none: three at most, then "{k} people own none yet") · none: "Each owner adds theirs from New goal." |
| Check-ins | Rule S3's check-in line | "The first are due {date}." · no goals: "Nothing is due until there are goals." · no rhythm: no second line |
| Reviews | Rule S3's review line | "For everyone, every goal. The first is {date}." · none: "Reviews stays out of the menu." |
| The year | "The goal year {name}" | "{January} to {December}. You join it in week {w} of {weeks}; it ends on {date}." / "…It starts on {date}." |
| Recording | "Recording off" / "Recording on" | As 2.4 |

Under the list, for a workspace made in the demo or with `store=browser`, one line: "This copy is kept in this browser only. Nobody else can open it."

**"What nobody has been told"**: one panel.

- With anyone but you: "Faro sends no email. {Names} won’t know about this until you send them the link, which is the next screen." (three names at most, then "and {k} others").
- Alone: "It’s just you, so there’s nobody to tell yet."

**The foot:** "Back" and the primary **"Create workspace"** ("Creating…" while it saves).

**After "Create workspace":** the workspace is made in one save, as today (`buildWorkspace`, then `createWorkspace`), with rule S3's settings; the draft is **kept**, marked as created, for rule S6; then `/ready` (replace).

**Empty and error states**

| When | Says |
|---|---|
| A Must fix reached Check (a draft from before this build, or a step skipped by address) | Above the list, the Must fix mark and each one as a link to its row ("People, row 4: Ben Carter already has ben@example.com."); the button stays, and pressing it focuses the first. Counts never leave out a row that is wrong: they say "{g} goals, {k} of them to fix" |
| Saving fails | The toast as today ("Couldn’t create the workspace: …"); everything is kept |

### 2.8 The hand-off (`/ready`) and the arrival (`/join/<id>`)

Wireframes 7 and 8.

**`/ready`, in order**

1. `h1` "{ws} is set up"; under it "{n} people, {g} goals. Week {w} of {year}." ("no goals yet").
2. **With anyone to invite, and a store other people can reach:**
   - `h2` "Now tell {Ben and Cara}" (first names, three at most, then "the team").
   - "Faro doesn’t send email. Copy this and send it yourself; change the words if you like."
   - The message (rule S9), shown as text.
   - Primary **"Copy the invitation"** → copies the message; the button then reads "Copied: paste it into an email or chat" for the visit, and the fact `inviteCopied` is saved (the same fact Home reads). Beside it the link "Copy only the link".
   - "Then go to Home, where your first week is laid out." ("go to Home" a link; once the invitation is copied it becomes the primary button "Go to Home").
3. **Alone:** "Nothing is due until there are goals." / "Your first check-in is due by {date}." and the primary **"Go to Home"**.
4. **A copy kept in this browser:** as 3, then "This copy is kept in this browser only, so there’s no link to send: nobody else can open it."
5. **Undo** (rule S6), while it holds: "Made by mistake? Undo: delete it and go back to the last step. This stays possible until someone else opens it or a check-in is posted." Pressing it asks "Delete {ws} and go back to set-up? Your answers are kept." → "Delete and go back" / "Keep it"; then the workspace is deleted (as About's Delete does) and `/workspace/new/check` opens from the kept draft.

**The arrival, `/join/<id>`, in order**

1. The mark. `h1` "Welcome to {ws}".
2. "{admin} set this up on {date} to keep the team’s goals in one place: {n} people, {g} goals." ("no goals yet").
3. "Each goal has an owner who keeps it current. You’ll see yours, and what’s due, as soon as you’re in." (No set rhythm: "…You’ll see yours as soon as you’re in.")
4. `h2` "Which one are you?" With more than 8 people, the field "Find your name" first. The people by team; each row: avatar, name, and one line: "Set this up · admin" / "Admin" / "Owns {k} goals" / "No goals yet". Choosing a row is the action: it records the arrival (rule S4's `arrived`) and opens Home.
5. "This device remembers your answer. Signing in with your company login replaces this step in the internal app."
6. Always: "Not on the list?" and the link "Ask {admin} to add you" (a `mailto:` to the admin's email with the subject "Add me to {ws} in Faro").

| State | Says |
|---|---|
| No such workspace | `h1` "This invitation doesn’t open a workspace" · "The workspace may have been deleted, or the link was cut short when it was copied. Ask whoever sent it for a new one." · "Go to Welcome" |
| A search finds nobody | "No one by that name." (item 6 is already there) |
| The person was marked as left | Their row isn't listed (as today) |

`WhoAreYou` (the picker shown when the browser has a workspace but no person, `App.tsx:38`) becomes this screen.

### 2.9 Home in the first week: "Your first week"

Wireframes 9, 10 and 11. Round 1's block (onboarding spec 2.9), with these changes; rule S4 gives the rows.

- **Heading:** "Your first week".
- **The first row that has a button carries the primary style**, and while the block shows Home has no other primary button.
- **While the block shows, Home leaves out:** its own "Start check-in" block and "Or type all your numbers in one table" (the link moves under the first row as "Or type them in one table"); "On-time streak"; the "Next review" tile; the paragraph "Across the whole workspace, {k} of {n} goals have had their first check-in…" (the `progress` row says it); for someone who owns nothing, the review block ("Open the review").
- **Under the block:** "Your goals" (or "Your goal"), each a row with its status, title and one line ("starts at 82%"; "at most 8%"). Owning none: "No goals yet. They’ll show here once you own or watch one."
- **"Hide this"** as built. Hidden, Home is its usual self, except that nothing is called late or "to review" before rule S2's dates.

### 2.10 Workspace → About, after set-up

Wireframe 12. Round 1's About (workspace spec 2.5), with:

- two facts, in this place in the list:
  - after Name: **"Set up"** · "By {admin} on {date}{, with {g} goals added at set-up | , with {g} goals from {file} | , with no goals yet}." (A workspace older than this build: left out.)
  - after Year: **"How you work"** · rule S3's two lines · for admins the link "Change" (to where FT puts the rhythm's setting; the review's own day and cadence are changed in Reviews).
- **People** gains, while anyone hasn't arrived and the workspace is under 28 days old: "{k} haven’t opened it yet: {names}." and, for admins, "Copy the invitation".
- **Features** names Reviews among the modules, by FT.
- **"To sort out"** by rule S5.

## 3. Who sees what

Consistent with R1 (`spec/requirements/internal/r1-sign-in-and-access.md`); each line names what enforces it. This adds no right and removes none, except the Undo, which is narrower than Delete.

| Thing | Member | Admin | R1 |
|---|---|---|---|
| Welcome; set up a workspace | Anyone (they become its first admin) | — | Rule 2; `createWorkspace` |
| The arrival screen; choosing a name | Anyone with the link | — | Faro today (no sign-in); a requirement in section 9 |
| "Your first week": their own rows | Yes | Yes | — |
| Rows `invite`, `add-people`, `first-goal`, `progress` | Not shown | Whoever set it up (`progress` also for any admin and anyone who owns a goal others feed) | `planChanges`, `addPerson` |
| Undo set-up | No | Whoever set it up, while rule S6 holds | `canDeleteWorkspace` and S6 |
| About: "Set up", "How you work" | Reads | Reads; "Change" | Rule 3; FT's action for the rhythm; `setModule` |
| About: "{k} haven’t opened it yet", "Copy the invitation" | The sentence | Both | Rule 3 |
| The check-in day | Reads it wherever a date is said | Changes it | FT's action for the rhythm, which must carry the day (today nothing can change `Cycle.reviewDay`, W6) |
| A review's day and how often | Anyone in it | Yes | `saveReview` |

## 4. Rules for `src/domain`

Pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. In `src/domain/dayOne.ts` unless said. Each takes only what it reads (round 1's AR4): the types below are the whole of each input. They restate nothing: weeks from `year.ts` and `plan.ts`, people's checks from `people.ts`, the levels from the import's engine (`changeset.ts`).

### What the build removes

With no example goals, these go. None changes a stored record.

| File | Goes | Stays |
|---|---|---|
| `src/domain/templates.ts` | `TEMPLATES`, `Template`, `TemplateGoal` | `stagesFromNow` and `stagesFromJoining` (the import's stage Check uses them); the file may be renamed `stages.ts` |
| `src/screens/Onboarding.tsx` | `pickTemplate`; the "Starting point", "Outcome" and "Goals" steps and `SetupGoalFields`, `StageRows`; `MAX_GOALS`; `blankGoal`; `goalsTsv` and its "no owner means you" branch; `unownedTitles` and the `prefs.set(…, { unowned })` write; "Example numbers. Change them to yours." | The draft; `peopleTsv`; `buildWorkspace`'s call, fed by the form's goals and the import's tables |
| `src/domain/dayOne.ts` | `setupSteps(choice)` and `stepCounter(step, choice)` (rule S1 has no choice to take); the `assign` row for new workspaces | `DayOneFacts.unowned` is still read, never written (below) |
| `src/domain/workspaceAttention.ts` | Nothing (the `unowned` need of this spec's first draft is not built) | — |
| Tests | `dayOne.test.ts`'s template cases become form cases; round 1's N17 ("for every template…") becomes "for a goal added in the form or imported" | `setupTruth.test.ts`'s upload cases |
| Help | `setup`'s paragraphs on templates and example numbers | — |

**A workspace already made from a template is not touched.** Its goals are ordinary goals, with their owners, plans and check-ins; nothing marks them and nothing is migrated. If its creator's facts still hold `unowned` ids, the built `assign` row keeps showing until done or retired; that branch can be deleted once no such workspace is under 14 days old.

### Rule S1. Set-up's steps: `SETUP_STEPS` (replaces round 1's rule 6)

`['workspace', 'how', 'people', 'goals', 'check']`, always. `stepCounter(step)` is "Step {n} of 5". `firstUnfilled(draft)` returns the first step whose required answers are missing: `workspace` (a name, and you), else `goals` when no way to start is chosen and there are no goals, else none.

| Given | Then |
|---|---|
| Any path, on Check | "Step 5 of 5" |
| `/workspace/new/people` opened with no workspace name | → `workspace` |
| `/workspace/new/check` with people filled and no choice on Goals | → `goals` |

### Rule S2. First dates: `firstDue(createdAt, cycle, day)` and `firstReviewDate(…)`

In `src/domain/plan.ts`, changing `firstWeekFrom(cycle, iso, weekday)`.

- A goal's first check-in is due on the first `{day}` that is at least `FIRST_DUE_CLEAR_DAYS` (2) clear days after the day it was set up: `due − created ≥ 2 days`. Today it is the same week's `{day}` whenever that hasn't passed.
- Before the cycle starts, the first `{day}` of its week 1.
- `firstReviewDate(createdAt, cycle, review)`: the review's first session is its weekday on or after the workspace's first due date (with no rhythm: on or after the day set-up plus 2 days).
- With no rhythm, `firstDue` is not called: nothing is due.

| Set up on | Check-in day | First check-ins due |
|---|---|---|
| Wed 11 Nov | Thursday | Thu 19 Nov |
| Mon 9 Nov | Thursday | Thu 12 Nov |
| Tue 10 Nov | Thursday | Thu 12 Nov |
| Thu 12 Nov | Thursday | Thu 19 Nov |
| Fri 13 Nov | Thursday | Thu 19 Nov |
| Wed 11 Nov | Wednesday | Wed 18 Nov |
| Wed 11 Nov | Friday | Fri 13 Nov |
| Wed 11 Nov, "Start with 2027" | Thursday | Thu 7 Jan 2027 |
| A goal added by New goal on Wed 2 Dec, in a workspace a month old | Thursday | Thu 10 Dec (the rule is every new goal's, not only set-up's) |

| Reviews | First review |
|---|---|
| Every week on Thursday, set up Wed 11 Nov | Thu 19 Nov |
| Every 2 weeks on Tuesday, set up Wed 11 Nov, check-ins by Thursday | Tue 24 Nov |
| Every week on Thursday, no rhythm, set up Wed 11 Nov | Thu 19 Nov |

### Rule S3. How you work: `HOW_DEFAULT`, `howLines(how)` and what set-up writes

```
How = { yearStartsIn: 0..11; startWith: 'this' | 'next';
        rhythm: 'weekly' | 'none'; checkInDay: 0..4;
        reviews: boolean; reviewEvery: 1 | 2 | 4; reviewDay: 0..4; recording: boolean }
HOW_DEFAULT = { yearStartsIn: 0, startWith: 'this', rhythm: 'weekly', checkInDay: 3,
                reviews: true, reviewEvery: 1, reviewDay: 3, recording: false }
```

`howLines(how)` returns the two sentences used word for word on Check, on About and in Help:

| Given | Check-ins line | Reviews line |
|---|---|---|
| The default | "Check-ins every week, by Thursday" | "A weekly review on Thursdays" |
| `reviewEvery: 2, reviewDay: 1` | "Check-ins every week, by Thursday" | "A review every 2 weeks, on Tuesdays" |
| `reviewEvery: 4` | — | "A review every 4 weeks, on Thursdays" |
| `rhythm: 'none'` | "No check-in rhythm: goals are updated when something changes" | as chosen |
| `reviews: false` | as chosen | "No reviews" |

On About they are joined: "Check-ins every week, by Thursday. A weekly review on Thursdays."

**What set-up writes**, all in the one save, and nothing else:

| Answer | Written | Shown afterwards |
|---|---|---|
| The year | The cycle: `startDate` and `weeks` from `goalYearFor` (or the next year's, for "Start with {next}"), its name as today | About's Year; Cycles |
| Check-ins | FT's rhythm setting: `weekly` or `none`; and `Cycle.reviewDay = checkInDay` (the field keeps its name; it is the day check-ins are due) | About's "How you work"; every "due by {date}" |
| Reviews | FT's Reviews switch, on or off (as `setModule` would). On: one review, as `buildWorkspace` makes today, with `everyWeeks = reviewEvery`, `weekday = reviewDay`, everyone, every level; named "Weekly review" / "Fortnightly review" / "Four-weekly review". Off: no review is made | About's "How you work" and Features; Reviews |
| Recording | As today (`createWorkspace`'s `recording`) | About's Recording; Privacy |
| — | The log, as today, plus one entry by whoever set up: "Set how {ws} works: {check-ins line}; {reviews line}." | Activity |
| — | Where the goals came from, in the "Created …" entry's summary: "…and {g} goals added at set-up" / "…and {g} goals from {file}" | About's "Set up" |

### Rule S4. Your first week: `firstWeek(viewer, snapshot, ws, facts, now, how)` (extends round 1's rule 7, `gettingStarted`)

The function keeps its name in code if the build prefers; its inputs gain `how` and its rows change as below.

```
snapshot: Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes' | 'reviews'>
ws:   { name; kind; createdAt; shared: boolean }      // shared: other people can open it
how:  { rhythm: 'weekly' | 'none'; reviews: boolean; due: string | null; firstReview: string | null }
facts: DayOneFacts                                    // as built, per person and workspace
```

- **`arrived(personId, snapshot)`**: a person has arrived when the log has their arrival: a `Change` with `entity: 'person'`, `action: 'acknowledged'`, `entityId` their id, written once when they first choose their name on the arrival screen (summary "{name} opened {ws} for the first time"). Whoever set it up has arrived. This uses the log as it is: no column, no new action word, so no migration (the database's check on `action` already allows `acknowledged`).
- **`due`** is the viewer's earliest first due date among their goals with no check-in (rule S2); `firstReview` the first session of the first review they are in.
- **When it returns nothing:** as built (the example; hidden; no first visit; 14 days after the first visit; a workspace over 28 days old for someone who didn't just join), and when every row is done.

Rows, in this order; a row is left out when its "done" holds.

| id | For | Says | Button → where | Done when |
|---|---|---|---|---|
| `welcome` | Someone who didn't set it up | "{admin} set up {ws} on {11 Nov}{ and gave you {n} goals \| and gave you 1 goal \| }." | — | Never (it stays while the block does) |
| `first-check-in` | Anyone with a goal with no check-in | Weekly, before the day: "Post your first check-in{s: {k} goals}. {It’s \| They’re} due by {date}." · on the day: "…due today." · after it: "…{It was \| They were} due on {date}." · no rhythm: "Post a first check-in on {it \| your {k} goals}, so everyone can see where {it starts \| they start}. There’s no date to meet." | "Start check-in" ("Check in" with no rhythm) → `/check-in` | None left |
| `add-people` | Whoever set it up, alone | "Add the people who own goals." | "Add people" → `/people` | A second person |
| `invite` | Whoever set it up, not alone, `ws.shared` | "{Ben and Cara} haven’t opened {ws} yet." (first names, three at most, then "{k} people haven’t opened {ws} yet.") | "Copy the invitation" (rule S9) | Everyone has arrived. Copied already (`facts.inviteCopied`, from here or from `/ready`): the row stays, with the plain button "Copy it again", and is never the primary |
| `first-goal` | Whoever set it up, no goals in the workspace | "Set up the first goal." | "New goal" → `/goals/new` | A goal exists |
| `see-goals`, `watch`, `own-goal` | Someone who didn't set it up and owns none | As built | As built | As built |
| `progress` | Whoever set it up; any admin; anyone who owns a goal another feeds. Only when the workspace has 2 or more goals and at least one first check-in is in or the first due date has come | "{k} of {n} first check-ins are in. Waiting on {names \| you \| you and {names}}." · all in: left out | — | All in |
| `first-review` | Anyone in the first review, `how.reviews` | Before the day: "The first review is on {date}{, and you’re in it}." (the clause for someone who didn't set it up) · on the day: "The first review is today. It walks the goals that need attention." | On the day only: "Open the review" → `/reviews/<id>` | The review has been held, or its day has passed |

Worked examples (Ana set up Field Operations on Wed 11 Nov and added three goals: "Jobs done right first time" and "Repeat visits" are hers, "Time to reach site" is Ben's; defaults unless said):

| Given | Rows |
|---|---|
| Ana, 11 Nov | `first-check-in` ("Post your first check-ins: 2 goals. They’re due by Thursday 19 Nov."), `invite` ("Ben and Cara haven’t opened Field Operations yet."), `first-review` ("The first review is on Thursday 19 Nov.") |
| Ana, 11 Nov, after copying the invitation on `/ready` | The same; `invite`'s button is "Copy it again" |
| Ben, first visit 12 Nov | `welcome` ("Ana Silva set up Field Operations on 11 Nov and gave you 1 goal."), `first-check-in` ("…due by Thursday 19 Nov."), `first-review` ("…on Thursday 19 Nov, and you’re in it.") |
| Cara (owns none), 12 Nov | `welcome`, `see-goals`, `watch`, `own-goal`, `first-review` |
| Ana, 13 Nov, Ben arrived, Cara not | `invite`: "Cara hasn’t opened Field Operations yet." |
| Ana, Thu 19 Nov, 1 goal of hers left, Ben's in | `first-check-in` ("Post your first check-in: 1 goal. It’s due today."), `progress` ("2 of 3 first check-ins are in. Waiting on you."), `first-review` ("The first review is today…", "Open the review") |
| Ben, Fri 20 Nov, not checked in | `welcome`, `first-check-in` ("Post your first check-in. It was due on Thursday 19 Nov.") |
| Ben, `rhythm: 'none'`, `reviews: false` | `welcome`, `first-check-in` ("Post a first check-in on it, so everyone can see where it starts. There’s no date to meet.") |
| Ana, goals "later", not alone | `invite`, `first-goal` |
| Ana, goals "later", alone | `add-people`, `first-goal` |
| Ana, a copy kept in this browser | No `invite` |
| Ana, an upload in which Ben owns everything | `invite`, `progress` once it applies; under the block "No goals yet…" |
| Anyone, 15 days after their first visit | Nothing (and rule S5 takes over what is undone) |
| The example workspace (the demo) | Nothing |
| A workspace made from a template before this build, whose facts still hold `unowned` ids | As built: its `assign` row shows until it is done or the block retires. Set-up no longer writes those ids, so no new workspace has the row |

### Rule S5. What set-up left to sort out: `workspaceNeeds` (changes round 1's workspace rule 3)

In `src/domain/workspaceAttention.ts`. Inputs gain `ws: { createdAt }`, `now` and `notArrived: string[]` (names).

- No `unowned` need: with no example goals, set-up makes no goal without a chosen owner.
- New: `not-arrived`: "{k} people haven’t opened {ws}" · "{names}." · "Copy the invitation". From day 8 to day 28.
- `only-admin` and `no-lead` are not returned while the workspace is under 7 days old.
- `no-goals` is not returned while the creator's "Your first week" shows `first-goal` (one place says it).
- `no-review` is not returned when Reviews is off (FT).

| Given | To sort out |
|---|---|
| Ana, day one, 3 people | Nothing |
| Ana, day one, 12 people in teams of 4, one admin | Nothing about admins or leads |
| The same, day 8 | "You’re the only admin"; "3 teams have no lead" |
| Day 9, Cara has not arrived | "1 person hasn’t opened Field Operations" |
| Ben (a member) | Nothing |

### Rule S6. Undoing set-up: `canUndoSetup(viewer, snapshot, ws, now)`

True when all hold: the viewer set it up (`creatorOf`); nobody else has arrived (rule S4); no check-in exists that wasn't in the set-up save; no goal, person or review was added or changed after it (the log has nothing after the set-up entries but the creator's own arrival); it is under 24 hours old. Otherwise false, with the reason for the screen: "{Ben} has opened it" / "a check-in has been posted" / "it has been changed since" / "it was set up more than a day ago".

| Given | Then |
|---|---|
| Ana on `/ready`, a minute after creating | True |
| Ana, after Ben chose his name | False: "Ben has opened it" |
| Ana, after posting her first check-in | False: "a check-in has been posted" |
| Ana, an import with 40 past check-ins, nothing since | True (they were in the save) |
| Ben | False |
| Ana, the next afternoon, nothing touched (25 hours) | False |

### Rule S7. People at set-up: `peopleCount(rows)`, `peopleProblems(rows, answers)`, `readPeopleLines(text)`

In `src/domain/people.ts`. `rows` are `{ name, email, team, admin }[]`, you first.

- `peopleCount` → `{ people, teams: [name, count][] }` (largest first; an empty team counts as yours), and the line of 2.5.
- `peopleProblems` → for each row its Must fix and Check items, by 2.5's table, using `isEmail`, `normalEmail` and `closeTeam` as today. `answers` holds "two people" per pair of rows and "new team" per team name; an answered Check isn't returned. A team answer covers every row with that team.
- `readPeopleLines(text)` → rows and the lines it couldn't read. A line is: tab- or comma-separated cells (name, email, team, admin; a header row is recognised as today); or `Name <email>`; or a bare email (the name is the part before `@`, with dots and underscores as spaces and each word capitalised); several `Name <email>` on one line separated by `,` or `;` are several people.

| Given | Then |
|---|---|
| Ana; Ben (ben@); Cara (cara@, Dispatch); Dev (ben@, Dispatch) | 4 people in 2 teams: Field Ops 2, Dispatch 2. Must fix on Dev: "Ben Carter already has ben@example.com…" |
| Two rows "Ben Carter" with different emails | A Check on the second; answered "Yes, two people": none |
| Three rows with team "Feild Ops" beside "Field Ops" | One Check, said on each; "Use Field Ops" changes all three |
| A People sheet in which two rows share an email | Must fix on the second (today it is dropped, W11) |
| `Cara Diaz <cara@example.com>; ben.carter@example.com` | Cara Diaz, cara@…; Ben Carter, ben.carter@… |
| `hello` | Unread: “hello” |
| 63 rows, 1 duplicate email, 1 near-miss team, 1 shared name, 1 no email, 1 bad email | "63 people in 6 teams … 3 must be fixed, 2 to check." |

### Rule S8. Late in the year: `lateYear(today, yearStartsIn)`

In `src/domain/year.ts`. Returns `{ weeksLeft, ends, next: { name, firstMonday } }` when the goal year that contains today has `LATE_YEAR_WEEKS` (8) or fewer weeks left after this one; otherwise nothing.

| Given | Then |
|---|---|
| 11 Nov 2026, January | 7 weeks left; ends Sunday 3 January; next: 2027, Monday 4 January |
| 5 Oct 2026, January | Nothing (12 left) |
| 11 Nov 2026, a November year | Nothing (week 2 of 52) |
| 28 Dec 2026, January | As today: `goalYearFor` already gives 2027 |

"Start with {next}" makes the cycle the next goal year. Until its week 1, the app is in "week 0" of it: goals can be set up and checked in, and rule S2 puts every first due date in its first weeks. ST10 starts with a short spike on how Home, Goals and Cycles read before a cycle's first week (`firstWeek.test.ts` already holds "week 1 for anything set up before the year starts").

### Rule S9. The invitation: `inviteLink(origin, mode, wsId)` and `inviteMessage(ws, link, how, due)`

In `src/domain/dayOne.ts` (the link moves from `Start.tsx:48`).

- The link: `{origin}{/demo}/join/{wsId}`.
- The message, three lines: "I’ve set up {ws} in Faro, where we’ll keep our goals." / "Open it and pick your name: {link}" / "Your first check-in is due by {date}." The third only with a weekly rhythm and at least one goal owned by someone other than the sender.

| Given | Third line |
|---|---|
| The default, Ben owns a goal | "Your first check-in is due by Thursday 19 Nov." |
| No set rhythm | None |
| Goals "later" | None |

## 5. The first week, by day and role

Field Operations, set up on Wed 11 Nov with three goals added at set-up (two Ana's, one Ben's); check-ins by Thursday; a weekly review on Thursdays. "Block" is "Your first week". The primary action is in bold.

| Day | Whoever set it up (Ana, admin) | A teammate with a goal (Ben) | A teammate with none (Cara) | A leader who didn't set it up (an admin, or owns a goal others feed) |
|---|---|---|---|---|
| **Day one**, Wed 11 Nov | `/ready`: **Copy the invitation**. Home, block: **Start check-in** ("2 goals … due by Thursday 19 Nov"); "Ben and Cara haven’t opened…"; "The first review is on Thursday 19 Nov." About: no "To sort out" | Hasn't been told until Ana sends the link | The same | The same |
| **Day two**, Thu 12 Nov (their first visit) | As day one; the invitation row names whoever hasn't arrived. Nothing is due, nothing is late | Arrival: "Welcome to Field Operations…", picks his name. Block: "Ana Silva set up … and gave you 1 goal."; **Start check-in** ("due by Thursday 19 Nov"); the first review line | Arrival. Block: "Ana Silva set up … on 11 Nov."; **See the goals**; watch; set up a goal; the first review line. No "Open the review", no "Reviews 1 to do" | A teammate's rows, and from the first check-in "{k} of 3 first check-ins are in…" |
| Fri 13 Nov to Wed 18 Nov | The same rows as they get done. No "late", no streak | The same | The same | The same |
| **The first check-in day and first review day**, Thu 19 Nov | "…due today."; "{k} of 3 first check-ins are in. Waiting on …"; "The first review is today…" with "Open the review" | "Post your first check-in. It’s due today." | "The first review is today…" with **Open the review** if nothing else is left | As Ana, without the invitation row |
| Fri 20 Nov | Anything left reads "It was due on Thursday 19 Nov." The review, once held, leaves the block | The same | — | — |
| **Week two**, from Mon 23 Nov | Home's usual blocks return as the block empties: check-ins due by Thursday 26 Nov, the streak after the second on-time week | The second check-in is an ordinary one | Home as usual for someone who owns none | — |
| **The block retires** | When every row is done, on "Hide this", or 14 days after the first visit (Wed 25 Nov). Who hasn't arrived is on About from day 8 | The same (14 days from 12 Nov) | The same | The same |

**With the rhythm off:** every "due" above is gone; `first-check-in` reads "Post a first check-in on it, so everyone can see where it starts. There’s no date to meet."; nothing is ever "was due"; the invitation has no third line; Home has no streak and no count on Check-in (FT). **With reviews off:** no review line, no review on any day, no Reviews in the menu (FT). **With goals "later":** Ana's rows are the invitation (or "Add the people who own goals" alone) and "Set up the first goal"; nothing is due and no review date is said until a goal exists; a teammate's rows are see, watch and set up a goal.

## 6. Extension points

None is added. `home.blocks` is unchanged ("Your first week" is core and sits above it). About's two new facts are core. Reviews, once a module (FT), contributes the review line of rule S3 through the section `says` round 1 added; until then the core says it.

## 7. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U97 | SETUP-FIRST-SCREEN | The first screen and the way in: a browser with nothing, opening `/` (with `store=browser`), lands on `/welcome` with one primary button, "Set up a workspace", and two rows. `/workspace/new` opens step 1, not Welcome. Set a workspace up with one teammate; `/ready`'s primary is "Copy the invitation" and the copied text holds the workspace's name, a `/join/` link and a date. In a second browser context with the same store, the link opens "Welcome to {ws}" naming who set it up; "Not on the list?" is there with three people; choosing the teammate opens Home with "Your first week". `/join/ws_nope` says "This invitation doesn’t open a workspace" and opens nothing else. Back at `/welcome`, "Welcome back" lists the workspace with "Open" |
| U98 | SETUP-HOW-YOU-WORK, FIRST-WEEK | How you'll work, said once and kept: at set-up on Wed 11 Nov the step shows "The first are due Thursday 19 Nov." and "The first is Thursday 19 Nov"; changing the day to Friday changes both dates on the spot. Each step is an address; the browser's Back from People returns to the step with the choices kept; a reload stays. Check repeats the two lines; "Change" beside Check-ins opens the step and "Back to Check" returns. After creating, About's "How you work" has the same words. A second set-up with "No set rhythm" and "No reviews": Check says "No check-in rhythm…" and "No reviews"; Home has no "due", "late" or "review" anywhere and no Reviews in the menu; About agrees |
| U99 | SETUP-UPLOAD | A spreadsheet at set-up can't go wrong quietly: on Goals choose "Import a spreadsheet" and give the app's template with one team mistyped, one owner nobody has and one stage dated week 2. The preview says how many goals and people it would add, one Must fix with its row and two answers, and two Checks; "Use these goals" is not available until they are answered. Answer them ("Give it to someone here", "Use Platform for all"; the template's two Example rows are counted as skipped and never become goals, "Count their stages from this week"); the list says "3 goals from …"; Check counts 3 and the file's people. Nothing was saved before "Create workspace". After it, no goal is late. On People, paste five lines of which two share an email: the count line says "1 must be fixed" and the second person is still there. The template uploaded unchanged needs no answer but the stages question |
| U100 | FIRST-WEEK | The first week tells each person the truth: with the workspace of U97 (creator with 2 goals added at set-up; a teammate with 1; a teammate with none; no goal in it that nobody typed or imported), on day one the creator's block has three rows, the first the only primary button on Home, and Home shows no streak and no second "Start check-in". On `today=2026-11-13` nothing says late. On `2026-11-19` the rows say "due today" and "The first review is today". On `2026-11-20` an unposted one says "It was due on Thursday 19 Nov." The teammate with none is never offered a review to open before the 19th. On `2026-11-26` the block is gone, and About's "To sort out" names anyone who still hasn't arrived. Undo on `/ready` returns to Check with the answers, and is refused after the teammate has arrived |

**Changed:** U5, U17 (set-up's steps and words), U61 (About on day one: the two new facts; "To sort out"), U86 (round 1's day-one journey: the block's name, dated rows, the invitation row), U53 (the switcher's set-up in focus mode), U14's phone pass over set-up.

### F, N and P checks

| # | Check |
|---|---|
| F19 | Phone, 390 × 844 and 360 × 800, over Welcome, the five steps (with 12 people and 5 goals), the paste sheet, `/ready`, the arrival and Home in the first week: the first field or choice and the primary button are on the first screen with the keyboard closed; no step is taller than two screens; with 60 people and "Show only those", People is no taller than two screens; every control is at least 44 px high ("Change", "Remove", "Hide this", the answers to a Check); nothing scrolls sideways; "Your first week" starts within 220 px of the top of Home |
| N20 | Never due tomorrow, never late in the first week: for every weekday a workspace can be set up on, every check-in day and each kind of goal (added in the form or imported), with a weekly rhythm, no first check-in is due within two days of set-up, no goal is late, at risk or off track and no review is "to do" before the first due date, and Home, Goals, Reviews and About contain no "late" before the second check-in day. With no rhythm, the same screens never contain "due" or "late" at all. With reviews off, no screen contains "review" outside Help |
| P3, P4, P6 | Extended to the new screens: Must fix and Check use the warning mark, never a status shape; a Must fix row's wash covers the whole row; no capsule, stripe or quote bar on Welcome, the steps, `/ready`, the arrival or the block |

### Unit tests

One file per rule with every worked example (`setupSteps`, `firstDue`, `howLines`, `firstWeek`, `workspaceNeeds`, `canUndoSetup`, `peopleProblems`, `readPeopleLines`, `lateYear`, `inviteMessage`). `firstWeek.test.ts`, `setupTruth.test.ts` and `dayOne.test.ts` are extended, not replaced; `firstWeek.test.ts`'s Sunday case gains the two-day rule's dates.

### Requirements (`evals/requirements.json`)

| id | Says |
|---|---|
| `SETUP-FIRST-SCREEN` | "Someone with no workspace meets Welcome at its own address, with one main action; someone invited meets the workspace they were invited to, who set it up, and their name; nobody is dropped into a workspace they didn't choose" |
| `SETUP-HOW-YOU-WORK` | "Set-up asks once how the team will work (the year, whether check-ins have a rhythm and by which day, whether there are reviews), with defaults that need no answer; each choice shows its first date; the workspace says the same afterwards, and an admin can change each one" |
| `SETUP-UPLOAD` | "A spreadsheet given at set-up is checked before the read-back, not after it: every row that is wrong or doubtful is named with its row and its fix, counts never leave a wrong row out, the file's people join those typed, and nothing is saved until the workspace is created" |
| `FIRST-WEEK` | "In a workspace's first week Home tells each person what is theirs to do first and by what date; nothing is due sooner than two days after it was set up, nothing is called late or to review before the first due date, what is left undone doesn't disappear, and nothing is said about a rhythm or reviews that are switched off" |

Reworded: `ONBOARDING` (five steps; the goals step's doors), `DAY-ONE` (now points at `FIRST-WEEK` for the dates).

## 8. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `welcome` (new; route `/welcome`) · "Welcome: starting, the demo, or an invitation" | The three ways in; what this device remembers; carrying on a set-up |
| `setup` (routes `/workspace/new`, its five steps, `/ready`) | Rewritten around the five steps: what each asks; "How you'll work" and where each answer is changed later; the three ways to add people and what Must fix and Check mean there; the four ways to start with goals; that nothing is saved before "Create workspace"; the invitation; Undo |
| `joining` (new; route `/join/:workspaceId`) · "Joining a workspace you were invited to" | What the link opens; choosing your name; not on the list; that sign-in replaces this in the internal app. Takes over "Saying who you are" from `setup` |
| `home` | "Your first week": who sees which rows, the dates, when it goes, "Hide this" |
| `workspace` | About's "Set up" and "How you work"; what "To sort out" holds in the first week |
| `import` | A cross-reference: importing at set-up (IM writes the article) |

### What's new (`src/help/whatsNew.ts`), one entry per item, newest first

| Item | id | Title | Lines |
|---|---|---|---|
| ST1 | `welcome-page` | "A proper front door" | "Welcome has its own page: set up a workspace, look around the demo, or join one you were invited to." "An invitation opens the right workspace and says who set it up." |
| ST2 | `setup-five-steps` | "Set-up in five steps you can go back through" | "Each step has its own address, so your browser's Back works and a reload stays put." "Change on the last step brings you straight back." |
| ST3 | `how-you-work` | "Say how your team works" | "Set-up asks whether check-ins are weekly and whether you hold reviews, and shows the first dates." "Workspace, About says the same, and an admin can change it." "A first check-in is never due the day after a goal is set up." |
| ST4 | `setup-people` | "Adding people is harder to get wrong" | "A count of people and teams as you go." "Paste a list, even from an email's To line." "Two people can't share an email; a second team by typo is asked about." |
| ST5, ST6 | `setup-goals` | "Set-up starts with your goals, not ours" | "Set-up no longer offers example goals: add your own, import a spreadsheet, or leave it for later." "Each field of the goal form shows an example of what goes in it, and the demo is still there to look around." "A spreadsheet's mistakes are shown with their row and a fix before anything is made." |
| ST7 | `setup-invite` | "An invitation to send, and an undo" | "After set-up, copy a message for your team with the link and the first date." "Made a workspace by mistake? Undo takes you back to the last step." |
| ST8 | `first-week` | "Your first week, with dates" | "Home says what's yours to do first and by which date." "Nothing is late in a workspace's first week." "Owners you haven't chosen stay on Workspace, About until you do." |

## 9. Platform requirements (for the internal app; not built in Faro)

Per `CLAUDE.md`: what the internal platform provides is written as a requirement. These add to R1 and R2 (`spec/requirements/internal/`); ST1 and ST7 add them to those pages' "What Faro does today" and worked examples through `npm run spec`.

| # | Requirement | Faro today |
|---|---|---|
| SR1 | **Opening the app without signing in shows the sign-in, never Welcome with a list, a workspace or a name picker** (R1, acceptance check 3). After sign-in: no workspace → Welcome; one → its Home; several → the last opened | Welcome and a name picker; every workspace in the store is reachable by its id |
| SR2 | **An invitation is addressed to a person.** Adding someone to a workspace (their email, R1 rule 2) is what invites them; the platform tells them by its own means (email, chat), with the same three lines as rule S9. Faro's copy-and-paste link is the stand-in | A link anyone can open and forward |
| SR3 | **Arriving is the first sign-in.** There is no "Which one are you?": the signed-in email is matched to the person record. Someone with no record sees "You’re not in {ws}. Ask {admins} to add you." and nothing of the workspace. The arrival is recorded by the server at first sign-in (rule S4's `arrived`) | Anyone may choose any name, the admin's included |
| SR4 | **Who may set up a workspace** is the platform's to limit: by default anyone signed in, with the option of a directory group. Whoever does becomes its first admin (R1 rule 2). `createWorkspace` runs on the server, which sets the actor | Anyone, with no sign-in |
| SR5 | **Step 1 has no "you"**: name, email and team come from the directory (R6a). Step 3's people are found in the directory, not typed; teams come from it. The three levels still apply to what a person types | Typed |
| SR6 | **Undoing set-up and deleting a workspace are soft, logged and restorable for 30 days** (R4), and limited to admins | Delete removes everything at once |
| SR7 | **The set-up draft is kept on the server for the signed-in person**, so it follows them between devices | Kept in the browser |

## 10. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Six steps | Step 1 is the name alone; a step `you` follows (`/workspace/new/you`); rule S1's list and the counter are "of 6"; when you are known, `you` is skipped and the counter is "of 5" (so rule S1 takes whether you are known) |
| 2 | "Try the demo" stays primary | 2.1's item 4 and the first row of item 5 swap; U97 expects it |
| 3 | The three points stay | 2.1's item 3 is today's list |
| 4 | As today | Rule S2 is dropped (`firstWeekFrom` unchanged); N20's first clause is dropped; the step still shows the first date, which may be tomorrow, and says "That’s tomorrow." beside it |
| 5 | Say and don't ask | 2.4's Check block is one sentence, "{year} has {k} weeks left: it ends on {date}."; rule S8 loses `next`; ST10 is dropped |
| 5 | As today | Rule S8 and ST10 are dropped |
| 6 | "Check in on your {n} goals" stays primary | `/ready` keeps today's button; the invitation is the block under it with a plain "Copy the invitation" |
| 7 | No undo | Rule S6 and 2.8's item 5 are dropped; the draft is cleared on create, as today |
| 8 | Recording stays on step 1 | 2.3 keeps today's tick box; 2.4 has three sections |
| 9 | "Getting started" | Only the heading; the requirement keeps its id |
| 11 | No door chosen to begin with | 2.6's group starts empty; "Continue" with none says "Pick how to start." |
| Settled 11 Nov (no example goals) | Keep an example as a fourth door | 2.6 gains "Start from an example" (last but one, never the default) with a select of `TEMPLATES`; its goals land in "goals so far" as rows under "Example numbers. Change them to yours, or leave them and correct them at the first check-in."; the outcome is yours and the rest say "Choose an owner"; unchosen ones become yours and are remembered, which brings back rule S4's `assign` row, rule S5's `unowned` need, Check's "{k} have no owner yet" and About's "from the {example} example"; `templates.ts` stays whole; ST5 and ST8 are M again |
| 10 | A named group only | SR4's default flips; nothing in Faro changes |

If the toggles area lands differently from the shared decisions (for example the rhythm with more than two values, or reviews not a module), step 2 offers exactly the values FT's settings have, in FT's words, and rule S3's table is regenerated from them; nothing else in this spec depends on their storage.

## 11. Build plan

No table and no migration in any item. What might have needed one, and why it doesn't:

- **Who has arrived** is read from the log (an `acknowledged` entry on the person), which the `changes` table and its check on `action` already allow.
- **The rhythm and the Reviews switch** are FT's to store; set-up only writes them.
- **The draft, and each person's first-week facts**, stay behind the `Prefs` port, as OB3 built them.

If FT's rhythm setting needs a column, that migration is FT's (and follows `supabase/README.md`: `faro` schema, grants written out, the Data API first).

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| ST1 | **Welcome and the arrival** | 2.1, 2.8's arrival; the routes and redirects of section 1 (`/welcome`, `/join/<id>`, the root no longer opening `list[0]`); rule S9's link; rule S4's `arrived` entry; U97; Help `welcome`, `joining`; SR1 to SR3 into R1 | S–M | Nothing. (Round 1: none) |
| ST2 | **Set-up in five steps, each an address** | 2.2, 2.3; the shell of 2.5 to 2.7 with today's content moved into the new steps (People as built; Goals as the three doors, with today's "Start blank" cards behind "Add your own" until ST5; the four templates and their two steps removed here); focus mode; "Close and keep the draft"; "Back to Check"; rule S1; F19's set-up part | M | Round 1's NV2 (one way out of a form) if it has landed, else it builds the button itself. Replaces OB3's unbuilt "steps are addresses" |
| ST3 | **How you'll work** | 2.4; rules S2 and S3; what set-up writes; About's "Set up" and "How you work" (2.10); U98; N20 | M | **FT: both switches must exist first** (the rhythm setting with its day and an admin action to change it; Reviews as a module that can be off). ST2. Rule S2 alone (the two clear days) can go ahead of FT as an S |
| ST4 | **People, with the three levels** | 2.5; rule S7; the count line; "Paste people"; closed rows above 12; people matched by email wherever set-up chooses one | S–M | **IM: the levels' marks and wording pattern**, and the import's preview for "Upload a file" (until then the button keeps today's upload, with rule S7 applied to what it reads). FS1's find-and-pick for Team (held; until then today's field). ST2 |
| ST5 | **Goals: one list, and the goal form inside set-up** | 2.6's three doors, "goals so far" and the form's framing; no cap; the removals of section 4's "What the build removes" that ST2 left | **S–M** (was M: no example rows, no owner chosen on a row, no remembered unowned goals) | **GE: the goal form usable outside `/goals/new`** with people, teams and goals passed in and its last button named by the caller (GE1, and GE5's "add a goal from where you are"). Round 1's OB1 and OB2 through GE. ST2. No longer leans on OB3's owner-per-template-goal |
| ST6 | **The import inside set-up** | 2.6's import; the People sheet merged first; the two answers for an owner nobody has; the team and stage Checks; "Remove these"; U99 | S–M | **IM: the preview in "every row is new" mode, with answers and its count line**; IM's field table for the template. ST4, ST5 |
| ST7 | **The read-back, the invitation and Undo** | 2.7; `/ready` (2.8); rules S6 and S9; the draft kept after create; SR6 into R4 | S–M | ST2, ST3 (its lines), ST1 (the link) |
| ST8 | **Your first week** | 2.9; rule S4; rule S5 and About's "To sort out"; what Home leaves out while the block shows; section 5 as conformance rows; U100; Help `home` | **S–M** (was M: no `assign` row, no `unowned` need) | Round 1's OB3 and WR2 (both merged); ST1 (`arrived`); ST3 (the dates and `how`); FT (what "off" removes from Home and the menu) |
| ST9 | **A second workspace, and a browser copy** | 2.3's "you are known" line and the name Check; "Bring people from {ws}"; no invitation in a browser copy (2.7, 2.8) | S | ST2, ST4, ST7 |
| ST10 | **Starting late in the year** | Rule S8; 2.4's Check block; "Start with {next}"; a spike first on how the app reads before a cycle's week 1 | S–M | ST3. Decision 5 |

**Order.** ST1 and ST2 can start at once, side by side (different files but for `App.tsx`: one build at a time there). Then ST4 and ST7; ST3 as soon as FT's switches exist; ST5 after GE's form; ST6 after IM's preview; ST8 after ST3; ST9 and ST10 last. About five releases of work: ST1 with ST2; ST3 with ST7; ST4 with ST6; ST5; ST8 with ST9 and ST10.

**This removes** the four templates and OB3's owner-per-template-goal (Lane, 11 Nov).

**This replaces** OB3's unbuilt parts (steps in the address; the find-and-pick owners on set-up's cards, which go with the templates rather than become rows), what is left of the deep review's U1 and U6, and the setup review's item 3 ("consider offering a year that starts now").

**Also found, outside this area** (for the backlog, not built here): W23, Cycles gives a year's dates one week short of its own week numbers (`cycleWhen`, `src/domain/workspaceAttention.ts:93`).

**For the rebuild kit:** set-up's module section says that steps 1 and 3 are the directory's in the internal app (R6a) and that the arrival is the first sign-in (R1); rules S2 and S4 belong with the status rules in stage 1's conformance data, since they are what keeps a first week from being late; ST1's stage has no drill (it is routing), ST3's and ST8's do.
