# Goal entry: the build spec

11 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings E1 to E13); round 2's shared decisions are in `docs/design/round-2/README.md` and are binding. It assumes Lane takes the recommended answer to each decision; section 10 says what changes otherwise.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed`. New goal and the edit page are core (`src/screens/GoalWizard.tsx`, `GoalEdit.tsx`, `src/ui/GoalFields.tsx`). **No table and no migration** in any item here.

**What it stands on.** Round 1's OB1 (New goal's order, pickers, steps in the address), OB2 (#103: the past-stage question, the re-base), GT3's edit page, and FS1's pickers in GoalWizard and GoalEdit are all held and not on main. This spec is written against them as specified; section 11 says which item needs which. The field table is the import area's (`docs/design/import/spec.md`, item IM1): this spec gives the goal fields' rows and uses the table; it does not define it.

**Words used throughout.** `{goal}` the goal's title; `{owner}` the owner's first name; `{ws}` the workspace's name; `{w}` the current week. The three types are, in sentences, "a number to move", "a number to keep in range", "dated stages". "Must fix" and "Check" are round 2's two levels. Wording in quotation marks is exact; wording not mentioned stays as round 1 or today has it.

## 1. Routes

Round 1's addresses are kept. Round 2 adds what an address can carry.

| Address | Screen | Title |
|---|---|---|
| `/goals/new` | → the one draft's step (only with exactly one draft and no query), else `/goals/new/what` | — |
| `/goals/new/what` · `/who` · `/measure` · `/check` | New goal, steps 1 to 4 (OB1) | As OB1 |
| `/goals/<id>/edit` with `#definition`, `#plan`, `#owner`, `#more`, `#changes` | Change a goal (GT3) | "Change {goal}" |

**What `/goals/new…` reads from its query** (kept on every step, and in the draft once a field is typed):

| Query | Means | Fills in (rule 8) |
|---|---|---|
| `?parent=<id or key>` | Opened from "Add a goal that feeds this" | Feeds into; the level one below the parent's |
| `?team=<id>` | From a team's page | Team |
| `?like=<id or key>` | "Duplicate as a new goal" | Type, unit, decimals, shape, team, level, feeds into, also helps, guardrail, how it's measured, where the number comes from, stage names |
| `?from=<askId>` | "Set up the goal" on a next step | Name, owner (the person asked), feeds into (the ask's goal) |
| `?draft=<id>` | "Carry on" | That draft, at its step |

- A query other than `?draft=` always starts a **new** draft; it never opens an old one (today a waiting draft swallows `?parent=`).
- An id that isn't found: the step opens without it, with one line, `role="status"`: "“{what}” isn’t here any more, so it wasn’t filled in."
- A second visit to `?from=<askId>` whose draft exists opens that draft.

### Redirects

| Old | New |
|---|---|
| `/goals/new` with one draft and no query | That draft's step (replace), as OB1 |
| `/goals/new` with two or more drafts | `/goals/new/what`, showing the list (2.9) |
| `/goals/<id>/edit?part=definition\|plan\|owner` | `#definition`, `#plan`, `#owner` (round 1) |
| `/goals/<id>/edit` for someone who may not change it | Stays, showing 2.6's read view (today: a dead end) |

## 2. Screens

### 2.1 New goal: what applies to every step

OB1's 2.1 stands (head, foot, Back and Forward, focus mode). Changed and added:

1. **What a step needs.** Under the heading of a step where two or more fields are required and at least one is optional: "Everything here is needed unless it says optional." Optional fields carry "· optional" after their label. A step with one required field says nothing. Which is which comes from rule 1.
2. **Must fix.**
   - Shown under its field, with the warning mark, `role="alert"`; the field has `aria-invalid` and a full outline.
   - When: on leaving a field that has been changed (blur), and for every field of the step on "Continue". Never while typing. A field that is empty and untouched shows nothing until "Continue".
   - "Continue" is never disabled. Pressed with any Must fix: focus goes to the first, and one line appears above the foot, `role="status"`, with the mark: "{n} thing{s} to fix above: {labels}." (labels are the fields' labels, in order, joined with "and"; more than three: the first two "and {k} more").
3. **Check.**
   - A block directly under the field it is about: the warning mark in the quieter (at-risk) tone, the question, then two answers as a radio group (each a full-height row, 44 px). `role="group"` with the question as its label.
   - When: as soon as the values that raise it are complete and have no Must fix.
   - An answer is stored in the draft as `answers[checkId] = key`, where `key` is the values the question was about (rule 3). The same check with another key is unanswered.
   - Answered, and the step revisited: the block collapses to one line, "You said {the answer, as a sentence}." with "Change".
   - "Continue" with an unanswered Check and no Must fix: focus goes to the first; the line above the foot reads "Answer the question above, under {label}." (several: "Answer the {n} questions above."). Must fix lines take precedence.
   - An answer whose words say it changes something ("Move it to Office of the VP") makes that change at once and removes the question.
4. **A default** that the person hasn't touched is a sentence with "Change", not a filled field: see each step.
5. **The context line** (rule 8), on step 1 only, under the heading when the address filled something in: "It will feed “{parent}”, as {a|an} {level} goal in {team}, owned by {you|name}." (parts not filled in are left out; with `?like=`: "Copied from “{goal}”: its type, unit, team and what it feeds. Its name, numbers and dates are yours to give."). "Change" goes to `/goals/new/who`.
6. **The exit.** "Close and keep the draft"; with no field changed it reads "Close" and keeps nothing. After keeping: back to where the person came from (navigation spec, rule 4) with the toast "Draft kept until {date}. It’s under Goals, Mine." and the link "Open it".

### 2.2 Step 1: what (`/goals/new/what`)

In order:

1. The drafts list, when there is anything in it (2.9).
2. The heading "What do you want to achieve?" ("Or start a new one: what do you want to achieve?" under a list).
3. The context line (2.1, item 5).
4. "Name it the way your team would say it". Must fix: `name-empty`, `name-short` (section 4).
5. "How will you know it worked?": the three cards, as today. "Move a number" starts chosen (a default the person can see).
6. Foot: **"Continue"**.
7. Under the foot, one quiet line: "Adding several? Paste a table or import a file" (→ the import's paste door, `docs/design/import/spec.md`; until IM builds it, → `/data/import`) "· Like one you have? Copy from a goal" (find-and-pick, goal; choosing one goes to `/goals/new/what?like=<key>`).

The same-name question (`same-name`) is asked on step 2, once the team is known; on step 1 the note for a same name in **another** team stays as OB1 words it.

### 2.3 Step 2: who and where (`/goals/new/who`)

OB1's 2.3 stands, with:

- **Owner.** The label is "Owner · checks in weekly" with a weekly rhythm and "Owner" with none (round 2, decision 6). Everyone is selectable.
  - Anyone may choose anyone (Lane, 11 Nov: as today). Choosing someone else adds one line under the field, `role="status"`: "{Name} will own it. After it is published, only {name} or an admin can change it." and, once GE10 is built, makes the last step's question start on "Not yet: propose it" (2.15). "Ask {name} to set it up" is dropped: it was the route a non-admin had to take, and nobody has to take it now. Proposing is how a goal is put in front of someone without committing them.
- **Team.** Starts as the owner's team and follows the owner until changed by hand. Owner in no team: empty, and required (`team-empty`). Never the first team in the list.
- **Questions on this step**: `owner-other-team`, `same-name`, `feeds-lower` (under Feeds into). There is no question about the level: anyone may set any level (Lane, 11 Nov).

### 2.4 Step 3: how it's measured (`/goals/new/measure`)

OB1's 2.4 stands (Measured by first; today and target side by side; the folded plan; stages with dated weeks; the past-stage question). Changed:

**A number to move**

1. "Measured by" (ML2), as OB1.
2. **Unit**: a text field, **empty**, placeholder from the table's example ("%, days, hours, incidents"). Required unless a metric supplies it. It sits before the numbers when no metric is chosen (the number fields show it after themselves as it is typed).
3. Two rows, each a number and a week (2.13; wireframe 8): **"Baseline"** with **"From"**, then **"Target"** with **"To"**. Under Baseline, the hint "The number in the week the plan runs from." From starts as this week ("This week"); To as the goal year's last week ("The end of {year}"). Under the two rows, one line from rule 13's `spanSays`: "{n} weeks." and, when To is past this goal year, "It runs past the end of {year} and carries into {next year} with this plan."; when From is still to come, "It starts in week {w} ({dates}). Until then nothing is due, and it reads “No check-in yet · starts week {w}”." OB1's "By when?" and its labels "Today (week {w})" and "Target (week {due})" go.
4. **Decimals**: no field. One line under the numbers, once either is valid: "Kept as whole numbers, as you typed them." / "Kept to 1 decimal place, as you typed them." with "Change" (which shows the choice "Whole numbers · 1 · 2 · 3 decimal places"). It is worked out by rule 2's `decimalsFor`.
5. "How will progress come?", the chart, "Adjust the plan week by week", as OB1.
6. "How it’s measured · optional" and "Where the number comes from · optional" (with no metric).

Must fix here: `unit-empty`, `start-empty`, `target-empty`, `not-number`, `has-words`, `too-precise`, `same-as-start`, `plan-point`. Questions: `below-zero`, `over-100`, `hundredfold`, `billion`, `wrong-side`, `far-from-metric`, `late-plan`, `from-past`, `to-past`, `long-plan`.

`same-as-start` offers the way out: under Target, the Must fix and one button, "Keep it at {value}{unit} or under" (or "… or over", by the metric's direction; with no metric two buttons). Pressed: the type becomes a number to keep in range with that limit, and the step redraws.

**A number to keep in range**

1. Measured by; Unit (as above).
2. "Must stay": "At most" / "At least" ("At most" chosen).
3. "Limit".
4. No dates to choose. One line: "It applies from the week it is published (week {w}, {dates}) to the end of {year}."
5. "Warn this close · optional": empty. Hint: "How near the limit counts as at risk, in {unit}. Left empty, it warns only once the limit is crossed."
6. Decimals' line; "How it’s measured · optional".

Must fix: `unit-empty`, `limit-empty`, `not-number`, `has-words`, `too-precise`, `margin-negative`. Questions: `below-zero`, `over-100`, `margin-wide`, `far-from-metric`.

**Dated stages**

OB1's rows, with "Due" as the week picker (2.13), listing this goal year; weeks before this one are in the same list, above it, and raise OB2's question. Under the heading: "At least one stage, each with a name and the week it’s due. This is week {w}, {dates}." Each fault is under its own row and field: `stage-none`, `stage-name`, `stage-week`, `stage-twice`. Rows are kept in the order typed; on "Continue", if they are not in date order they are put in order and one line says so, `role="status"`: "Put in date order." Question: `stage-past` (OB2's, unchanged).

### 2.5 Step 4: check (`/goals/new/check`): the read-back

Wireframe 3. Replaces OB1's 2.5 and today's sentence and rows.

1. Heading "Does this read right?"; under it "Nothing is saved until you publish."
2. The goal's name, as a heading.
3. Rows, from rule 5 (`readBack`), each a small label, a sentence, and "Change" to its step (the address; after "Change", "Continue" on that step returns here, as today):

| Row | Sentence |
|---|---|
| What | A number to move: "A number to move: from {baseline} in week {from} ({dates}) to {target} by week {to} ({dates}), {shape words}. {Higher\|Lower} is better." Dates always carry their year; a week of another goal year is "week 13 of 2027". Shape words: "the same amount each week" / "slowly at first, faster near the end" / "in a few jumps" / "with the weeks’ numbers set by hand". |
| | A number to keep in range: "A number to keep in range: at or {under\|over} {limit}{unit}. {It warns within {margin}{unit} of the limit. \| It warns only once the limit is crossed.}" |
| | Dated stages: "Dated stages: {n} stage{s}, the last due week {w} ({dates})." then, when any: "1 stage is already done." / "1 stage is already overdue." (OB2) |
| Who and where | "{Owner’s full name} owns it, in {team}. It’s {a\|an} {level} goal and feeds “{parent}” ({key})." / "… and feeds nothing: it’s at the top of its own tree." With also-helps: "It also helps “{a}” and “{b}”." Guardrail: "It’s a guardrail." |
| Measured by | Number goals only. "{metric}, for {team \| the whole company}." / "No metric: “{description}”." / "No metric, and not described yet." |
| Left as usual | Every default not changed, as short sentences in the field table's order: "Whole numbers." "From this week to the end of {year}." "Steady." "No early warning." "Not a guardrail." (Feeding nothing is said once, in Who and where.) "Helps no other goal." Omitted when nothing was defaulted. "Change" goes to the first of them. |
| You said | One sentence per answered Check (section 4's "Read-back" column). No "Change" (the question's own line on its step has it). Omitted when none. |

4. **After you publish**, one block, from rule 5:

| Line | Weekly rhythm | No rhythm |
|---|---|---|
| First check-in | "Its first check-in is due by {weekday} {date}, then every week. The first number sets where it stands; the plan says {plan next week} for week {w+1}." Stages: "… then every week. It asks which stages are done." Range: "… It asks for this week’s number." | "It shows as “No check-in yet” until {you post \| {owner} posts} its first number. Nothing is due." |
| Who sees it | Owner is the viewer: "Everyone in {ws} can see it." Otherwise: "{Owner} sees it on {their} Home the next time {they} open Faro. Faro doesn’t send email." | The same |
| Reviews (only with Reviews on) | "It joins {review}, which walks {every north star \| every SVP goal \| “{tree}” and what feeds it}." Several: "It joins {a} and {b}." None: "It joins no review yet." | The same |
| Taking it back | Owner is the viewer: "Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason." Otherwise: "Only {owner} or an admin can change it once it is published. Until its first check-in they can change anything, or delete it." With stages already done (saved as its first check-in): "Its stage already done is its first check-in, so it can be stopped, with a reason, but not deleted." | The same |

5. With GE10: the question **"Is it under way?"** (2.15), a radio group: "Yes: publish it as active" and "Not yet: propose it". It starts on Yes, except when the owner is someone else, where it starts on "Not yet".
6. Foot: "Back" and **"Publish goal"** ("Propose goal" when "Not yet" is chosen).

**After "Publish goal"**: as today and OB1 (the goal's page with `?published=1`). When the draft came from `?from=<askId>`, the same save marks that next step done with the note "Set up as {key}" (rule 9).

**Empty and error states (the whole wizard)**: OB1's table stands, with:

| When | Says |
|---|---|
| Publishing is refused by a rule not shown on a step (a loop; the right to add) | The rule's words at the top of Check as a Must fix; the draft is kept |
| The draft's `?from=` ask was withdrawn or done meanwhile | "{Asker} withdrew the request to set this up. You can still publish it as your own goal." |
| A sixth draft would be started | Step 1: "You have 5 goals not yet published. Publish or discard one to start another." and no name field |

### 2.6 Change a goal (`/goals/<id>/edit`)

Wireframe 4. GT3's 2.7 stands (focus mode; one exit; the four sections with anchors; find-and-pick; the sticky button). The fields are the same components and words as New goal's, made from the field table. Added and changed:

**Sections, in order**

1. **What it is** (`#definition`): Name; "Measured by" (the `goal.measure` place); "How it’s measured"; "Where the number comes from". Then one line, not a field:
   - With check-ins: "{The type, as a sentence starting with a capital}. The type can’t change: {n} check-in{s} {was|were} judged as {a number against a plan \| a number against a limit \| stages done or not}. To measure it another way, stop this goal and add a new one."
   - With none: "{Type}. The type can’t change. This goal has no check-ins, so you can delete it and add it again another way:" and the link "Duplicate as a new goal".
2. **Plan and target** (`#plan`): the type's fields as on New goal's step 3: "Baseline" with "From", "Target" with "To", each week in the picker (2.13). Changing From or To after check-ins is a plan change (today's `planChanged`), so it needs the reason. Unit and Decimals are one line, "{unit}, {places}." with "Change"; changed, they are fields.
3. **Who and where** (`#owner`): Owner, Team, Level, Feeds into, how much and why (with a parent), Also helps. The same questions as New goal's step 2.
4. **More details** (`#more`): "It’s a guardrail".
5. **What will change** (`#changes`): absent until something differs from the goal as saved. Then:
   - one row per changed field or group, from rule 6 (`whatWillChange`): a small label and a sentence (table below);
   - when rule 6 says a reason is needed: the field "Why is the plan changing?" (required; Must fix `reason-empty`), placeholder "e.g. The vendor contract moved the start to week 6";
   - when the owner changes: "A note for {new owner} · optional", placeholder "What {they} need to know to pick it up";
   - any Check raised by the change (`direction`, `far-from-plan` (today's two, `planQuestion`), and New goal's) sits under the field it is about, as in 2.1.

| Change | Sentence |
|---|---|
| Name | "Name: “{old}” becomes “{new}”. Its key, {key}, and its links stay." |
| Baseline, target, From, To, shape, a hand-set week (before any check-in) | "{Field}: {old} becomes {new}." A week is said with its dates: "To: week 53 (28 Dec 2026–3 Jan 2027) becomes week 13 of 2027 (29 Mar–4 Apr 2027). It now carries into 2027." |
| The same, after check-ins | "{Field}: {old} becomes {new}. From this week it is judged against the new plan: week {w} would read {new status}{, not {old status}}. Weeks {first} to {w−1} and the closed quarters keep the plan of their day, and the old plan stays on the chart, dotted." (the status clause is "and still reads {status}" when it doesn't change; with no check-in this week the clause is left out) |
| Limit, must stay, margin, after check-ins | "{Field}: {old} becomes {new}. From this week it is judged against the new limit: week {w} would read {status}{, not {old}}. Earlier weeks keep the limit of their day." |
| Stages, after check-ins | "Stages: {“X” moves from week a to week b \| “X” is added, due week b \| “X” is removed}. {k} stage{s} already done stay{s} done." A removed stage that was done: Must fix `stage-done-removed`. |
| Unit, after check-ins | "Unit: {old} becomes {new}. The {n} numbers already checked in are not converted: {latest} will read {latest}{new unit}." (a plan change: needs the reason) |
| Decimals, up | "Decimals: {old} becomes {new}. Earlier numbers show with {new}: {example}." |
| Decimals, down | Must fix `decimals-lose` when any check-in or plan number has more places; otherwise as up |
| Owner | "Owner: {old} hands it to {new}. {New first name} {checks in from week {w or w+1} and} sees it on {their} Home. After this, only {new first name} or an admin can change it." ("checks in from…" only with a weekly rhythm; the last sentence is left out for an admin.) |
| Team | "Team: it moves from {old} to {new}, and shows under {new}’s goals." |
| Level | "Level: {old} becomes {new}.{ It joins {review}. \| It leaves {review}.}" (the review clause only with Reviews on, and only when membership changes) |
| Feeds into | "Feeds: “{old}” becomes “{new}”." / "It stops feeding “{old}” and is at the top of its own tree." / "It now feeds “{new}”." |
| Also helps, guardrail, how it's measured, where it comes from, how much and why | "{Field}: changed." with the old and new value when short (under 60 characters) |
| Measured by | The metric module's own sentence through the `goal.measure` place (section 6) |

**The foot**

- Left: "{n} change{s}" and, when any, "· {k} thing{s} to fix: {labels}" or "· 1 question to answer".
- Right, the primary: **"Save {n} change{s}"**. With nothing changed: no primary; the left reads "Nothing to save."
- Under the form: "Other things you can do: Duplicate as a new goal · Stop this goal…" (with no check-ins: "Delete this goal…"). They open what the goal's "…" menu opens (GT3); the page adds no action of its own.

**After saving**

- Back to the goal's page (the navigation spec's rule 4), with the toast "Saved {n} change{s} to “{goal}”." and "Undo". The same "Undo" stays as a line at the top of the goal's page, "You changed {n} thing{s} just now. Undo", until the person leaves the page or ten minutes pass.
- "Undo" (rule 7): every field goes back, as one change; History reads "{Name} undid a change: {fields}". The toast: "Put back."
- One History entry per save, as today: "{Name} changed {fields}", with each field's old and new value, the reason as "Why", any note as "Note for {name}", and each answered Check as "Checked".

**For someone who may not change it** (not the owner, not an admin): the same address shows, in the reading width,

1. the goal's name as the title, and under it "{Owner’s full name} or an admin can change this.";
2. three facts: "What it is" (the type), "Plan and target" (the measure line from the goal's About), "Who and where" (owner · team · level · feeds);
3. "Ask {owner} a question" (the goal spec's 2.6; `askQuestion`) and the back link. No primary action.

**An unsaved edit**

- Kept on every change as a **patch**: only the fields that differ from the goal, with the goal's stamp when the edit began (rule 10).
- Opening the page with one, and the goal unchanged since: one line, "Picked up your unsaved changes." with "Discard them".
- The goal changed since: a block above the first section, `role="status"`: "{Name} changed this goal on {date}, after you started. Your unsaved changes: {field new value, …}." with "Keep them" and "Discard them". Kept changes are applied over the goal as it is now; a field both changed says so in "What will change" ("Target: 4 min becomes 5 min. {Name} set it to 4 min on 10 Nov.").

**Empty and error states**

| When | Says |
|---|---|
| The goal is stopped | "This goal was stopped on {date}, so it can’t be changed." and the back link |
| The goal isn't in this cycle | Round 1's page-not-found |
| Saving is refused by a rule (someone else became its owner meanwhile) | At the top, as a Must fix: "{Owner} owns this goal now, so only {owner} or an admin can change it. Your changes are kept here: copy what you need." |
| The cycle has ended | "{cycle} has ended. A goal carried into {next} is changed there." with the link when it was carried |

### 2.7 Doors to New goal

| Door | Where, exactly | Who sees it | Wording |
|---|---|---|---|
| A parent | The goal page's "What feeds it" section, under its list (and in its empty state: "Nothing feeds it yet.") | Everyone, on a goal that isn't stopped | "Add a goal that feeds this" → `/goals/new?parent=<key>` |
| A team | A team's page (`/teams/<id>`, the Workspace spec), in its Goals block after "See its {n} goals" | Members of the team, and admins | "Add a goal for {team}" → `/goals/new?team=<id>` |
| A copy | The goal's "…" menu, after "Print or save as PDF"; the edit page's foot | Everyone | "Duplicate as a new goal" → `/goals/new?like=<key>` |
| Several | New goal's step 1, under the foot | Everyone | 2.2, item 7 |
| The menu, Goals' quiet link, Home's rows | As today and round 1 | — | Unchanged |

### 2.8 A goal agreed in a review; asking someone to set one up

Wireframe 5. Only with Reviews on does the first door exist.

**In the walkthrough** (the goal page under `?review=<id>`), the choices under "What happens next, who, by when?" become, in order: "Add the next step", **"Agree a new goal"**, "We accept the risk", "Add a note", "Ask {owner} a question", "Skip for now". The same choice is on a goal that isn't behind (where today's are "Add a note" and the rest).

"Agree a new goal" opens a block in place:

1. Heading "Agree a new goal"; under it "Its owner sets it up afterwards, with the numbers. Until then it is a next step, not a goal."
2. "What should the goal be called?" (required; the name's two Must fix lines).
3. "Who will own it?": find-and-pick, person; starts as the owner of the goal on screen (required: "Choose who will own it.").
4. "It will feed": find-and-pick, goal; starts as the goal on screen; first row "Nothing: top of its own tree".
5. "Set up by": the week picker (2.13), from this week to the goal year's last; starts as the review's next session's week.
6. **"Agree it"**; "Cancel".

Saved (rule 9), it is a next step: an ask of kind action, for the owner chosen, on the goal it will feed (or the goal on screen when it feeds nothing), in this review's session, due that week, whose text is "Set up a goal: {name}". The walkthrough then shows it as it shows any next step, and counts the goal as decided (`decide.ts`'s rule: it is a next step with an owner and a date).

**Wherever that next step is shown to the person it is for** (the goal's "Next steps and asks", Home's "Needs your response", the review's "Last time"):

- its words: "Set up a goal: {name}" and, under them, "Asked by {asker}{ in {review}} · by week {n} · feeds “{goal}”";
- its button is **"Set up the goal"** → `/goals/new?from=<askId>`, in place of "Mark done" (which moves into the row's menu as "Mark done without setting it up", with the usual note);
- for everyone else it reads as any next step, with "Withdraw" for whoever asked.

Publishing the goal marks it done with "Set up as {key}", by the person who published, in the same save. The review's next "Last time" then reads "{Owner} set up {key} “{goal}”."

**From New goal, without a review**: nothing. "Ask {name} to set it up" is dropped (2.3); with GE10, propose the goal for them instead (2.15).

### 2.9 Drafts

Wireframe 7.

**The list**, shown at the top of `/goals/new/what` and reachable from Goals, Mine:

- Heading "Not published yet · {n}".
- First, the next steps that ask the viewer to set up a goal and aren't done (rule 9), soonest due first: the name; "{Asker} asked you to set this up{ in {review}} · by week {n}"; the button "Set up the goal" (or "Carry on" when its draft exists).
- Then the viewer's drafts, newest first: the name, or "Untitled goal"; "{type, with a capital} · stopped at step {n} of 4 · kept until {date}"; "Carry on" (→ `?draft=<id>`), and "Discard" (asks "Discard “{name}”? It can’t be brought back." → "Discard it" / "Keep it").
- None of these buttons is primary: the page's primary stays "Continue".

**On Goals, Mine** (`/goals?scope=mine`): one line under the list, when the list above would have rows: "Not published yet: {first two names as links} · {k} to set up for {asker}. See all {n}" (→ `/goals/new/what`). Nothing is shown on Home for a draft; a goal someone asked for is already there as its next step.

**Keeping**: a draft is created at the first changed field, saved on every change, and holds the fields, the step, the answers and the query it began with. It is kept 30 days from its last change (`RESTORE_DAYS`), counted by rule 10; an expired draft is not listed and is removed at the next write. At most five per person and workspace (2.5's last row).

**Storage**: the `Prefs` port (`src/ports/prefs.ts`), key `goal.drafts` (a list) and `goal.edit.<goalId>` (the edit page's patch). `src/app/drafts.ts` keeps its hook; its storage becomes the port. A draft under today's key (`<ws>:goal:new` in local storage) is read once, as the viewer's, and moved.

### 2.10 Set-up's goal cards (`/workspace/new/outcome`, `/goals`)

The cards stay as built (OB3): name, type, the type's required fields, Unit, "How it’s measured · optional", Owner. Only this changes:

- Their Must fix words are section 4's ("Enter where it starts today." replaces "Add today’s number."; "Enter the target." replaces "Add the target."; "Enter the limit." replaces "Add the limit."), produced by rule 2 with `door: 'setup'`.
- Unit is required for a number or a range (templates supply it; "Start blank" asks).
- The number questions (`below-zero`, `over-100`, `hundredfold`, `billion`, `margin-wide`) and `stage-past` appear under a card's field, as in 2.1; "Next" waits for them.
- What a card doesn't ask is fixed by the step and said on set-up's own Check step (the set-up spec): the outcome is a North star; the others are Team goals that feed it; all are due at the year's end, steady.

### 2.11 A goal carried into a new cycle

On the goal's page, for its owner and admins, above the summary, while rule 11 says so, one line with the warning mark:

- A number: "Carried from {old cycle}. It starts from {start}, {your \| its} last number, with the same target of {target}. Check the plan" (→ `/goals/<id>/edit#plan`).
- Stages: "Carried from {old cycle}. Its {n} stage{s} left {was|were} spread evenly over {new cycle}: check {its date|their dates}." with the same link.
- A range: nothing (its limit carries unchanged).

It goes when the owner saves the plan, posts a check-in, or presses "It’s right" beside it (kept in `Prefs`).

### 2.12 The AI tools

`create_goal`, `update_goal`, `set_plan_numbers`, `bulk_change` (`src/mcp/tools.ts`):

- A refusal for Must fix reads: "Not saved. Must fix:\n- {goal}: {words}" (today: "Not saved. Fix these and try again:"). The words are section 4's.
- A refusal for Check reads: "Not saved. Check with the person first:\n- {goal}: {question}\nIf they say yes to each, call again with "confirm": true." Every Check of rule 3 is listed, not only the plan's two.
- `data` keeps its shape (`problems`, `questions`, `needsConfirm`, `needsReason`) and gains, on each question, `id` (the check's id) and `field`.
- `GOAL_FIELDS` gains `also_helps_ids`, `guardrail` and `effect` once the field table has their columns (IM1).
- `create_goal` no longer fills in `owner` before the engine sees the row; rule 2 gives the token's person as the default and says so in the result ("Owner: {name}, as nobody else was named.").

### 2.13 The week picker

Wireframe 8. One control (`src/ui/WeekPick.tsx`, new) for From, To, a stage's Due and "Set up by". It replaces `DueField` and the stage rows' number field (`src/ui/GoalFields.tsx`). It holds a week counted from the cycle's start, as the data does; everything it shows comes from rule 13.

**Closed.** A button that reads as a field: "Week {n} · {dates with year}" (another goal year's week: "Week 13 · 29 Mar–4 Apr 2027"; the year is always in the dates). Nothing chosen: "Choose a week". Under it one line, from `weekIs`: "This week" / "Next week" / "{k} weeks ago" / "In {k} weeks" / "The end of {quarter}" / "The end of {year}" / "The start of {year}"; the most specific that applies.

**Open.** A panel under the field, as wide as the field and at least 360 px; on a phone a full sheet titled by the field's label, with "Close".

1. A text field, focused: placeholder "Type a week or a date: 50, 14 Dec". Rule 13's `readWeek` turns what is typed into a week and moves the list to it; what can't be read: "“{q}” isn’t a week or a date. Try 50, or 14 Dec.", `role="status"`.
2. Up to three named weeks, each a row of two parts, "{name}" and "Week {n} · {dates}":

| Field | Named weeks |
|---|---|
| To | "The end of this quarter" (left out when it is also the year's end); "The end of {year}"; "The end of Q1 {next year}"; then "The end of {next year}" if fewer than three |
| From | "This week"; "The start of this quarter"; "The start of {year}" |
| A stage's Due; Set up by | "This week"; "The end of this quarter"; "The end of {year}" |

3. The label "Or choose a week"; the goal years offered, as a row of choices (two or three); then the chosen year's weeks, each "Week {n} · {dates}", with "· this week", "· the end of {quarter}" and "· chosen" where they apply. The list scrolls inside the panel (8 rows visible) and opens at the chosen week, else at this week.
4. A last line saying what the list leaves out and why: "“To” comes after “From”: 2026 lists weeks 47 to 53." / "A stage is due within 2026."

**What each field offers**

| Field | From | To |
|---|---|---|
| From | The first week of the previous goal year | The last week of the next goal year |
| To | The week after From | The last week of the next goal year |
| A stage's Due | Week 1 of this goal year | Its last week (decision 11) |
| Set up by | This week | This goal year's last week |

**Keys.** `role="listbox"` behind a button with `aria-haspopup`. Up and Down: one week. Page Up and Page Down: four weeks. Home and End: the year's first and last. Left and Right: the year before and after. Enter chooses and closes; Escape closes and returns focus; typing goes to the text field. A named week is reached with Up from the first week of the list.

**States.** Disabled when the goal is stopped. A Must fix (a file's week that doesn't exist; a stage with no week) outlines the closed field and sits under it.

### 2.14 Every choice in goal entry, and how it is made

**The rule.** No select of everything survives anywhere in goal entry. A person, a team, a goal or a metric is always chosen with round 1's find-and-pick (`docs/design/find/spec.md`, 2.3, rules 1, 5, 6 and 7; `src/ui/Pick.tsx`), which this spec does not change. Short fixed lists stay plain controls: the type (three cards), the level (three), how progress comes (three), must stay (two), a metric's "For" (two: the goal's team, or the whole company), "It’s a guardrail" (a tick box), and the week picker (2.13).

Common to every row below, from the find spec: closed, the choice as words with "Change" (several: rows with "Remove" and "Add another goal"); the placeholder "Choose a {thing}"; open, up to six suggestions under "Suggested", then "{n} match" and up to 50 rows; a row is Find's two lines (person: name, then "{job title} · {team}"; team: name, then "Led by {name} · {n} people"; goal: status and title, then "{key} · {owner} · {team}"; metric: name, then "{unit} · {lower|higher} is better · owned by {name} · {n} goals"); none found: "None match “{q}”."; the search failing: "Couldn’t search just now." with "Try again". Matching is the find spec's rule 1: the words on the row by word starts, ignoring case and accents; a goal also by its key ("G-48", "g48"); a person also by a whole email address.

| # | Choice | Where | Kind | Suggested before typing | "None" row | "Add as new" | A row that can't be chosen | Under "None match" | Can raise |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Owner | New goal, who; the edit page (this is also the hand-over) | Person | You; then the goal's team (the team from `?team=`, the parent's team, or the team already chosen), its lead first; then people chosen lately. With no team known: the find spec's default | — | Never. Under the results, for an admin: "Not here? Add people on People." | Someone marked as left is not listed | "People are added on People, by an admin." | `owner-empty`; `owner-other-team` |
| 2 | Team | New goal, who; the edit page | Team | The owner's team; your team; teams you lead; chosen lately | — | No (an admin: "Add a team on Teams.") | — | "Teams are added on Teams, by an admin." | `team-empty` |
| 3 | Feeds into | New goal, who; the edit page | Goal | OB1's rule 2: the goals one level above in the goal's team, worst first; those your goals already feed; opened lately | "Nothing: top of its own tree" | No | This goal and anything under it: "Feeds this goal already". A stopped goal is not listed | — | `feeds-loop`; `feeds-lower` |
| 4 | Also helps | New goal, who; the edit page | Goal, several | The goals the parent feeds and its other feeders; your goals; opened lately | — (remove the rows) | No | The goal it feeds: "It already feeds this."; itself and its own tree | — | — |
| 5 | Measured by | New goal, measure; the edit page | Metric (ML2) | Metrics in the form's unit; metrics the team's goals use; chosen lately | "No metric" | "Add “{q}” as a new metric" (ML2's small form) | With a unit already typed, a metric in another: "In hours; this goal is in min" | The add row | `wrong-side`; `far-from-metric` |
| 6 | "For" | Under Measured by | Plain: two choices | — | — | — | — | — | — |
| 7 | Copy from a goal | New goal, step 1's foot | Goal | Your goals, newest first; your team's; opened lately. Stopped goals are listed, with "Stopped" | — | No | — | — | The line "“{what}” isn’t here any more…" for a parent that has gone |
| 8 | Who will own it? | "Agree a new goal" in a review | Person | The owner of the goal on screen; the review's people, A to Z; you | — | Never | Left: not listed | As row 1 | "Choose who will own it." |
| 9 | It will feed | "Agree a new goal" | Goal | The goal on screen; the goal it feeds; the goals in this review still to discuss | "Nothing: top of its own tree" | No | Stopped: not listed | — | — |
| 10 | (dropped: "Ask {name} to set it up") | — | — | — | — | — | — | — | Lane, 11 Nov: anyone may add a goal for anyone |
| 11 | A goal's owner | Set-up's outcome and goal cards | Person, among those typed on the steps before | You; then the others in the order typed | "No owner yet" (the feeders; OB3) | No: "Add people on the step before." with "Back" | — | The same line | — |
| 12 | A person's team | Set-up's people rows (OB3; the set-up area's) | Team, among those typed | The teams typed so far | "Same as above" | "Add “{q}” as a new team" | — | The add row | The set-up spec's close-name question |
| 13 | Who takes over | Stopping being a goal's owner by leaving, and "Mark as left" (`RemoveSheets.tsx`; the Workspace area's, listed because it re-owns goals) | Person | The team's lead; the team; you | — | Never | The person leaving | As row 1 | — |
| 14 | From, To, a stage's Due, Set up by | The measure step; the edit page; the review | Plain: the week picker | — | — | — | — | — | 2.13; `from-past`, `to-past`, `long-plan`, `stage-past` |

Bulk edit's "Change owner" already uses the control. Data's Owner cell and Goals' "In the tree of" are the import's and the Goals page's.

`suggest` (find spec, rule 6) takes a `context`; rows 1, 3, 4, 8 and 9 pass theirs (`{ teamId }`, `{ level, teamId }`, `{ parentId }`, `{ goalId, reviewId }`). That is the only thing goal entry asks of it, and its existing "In Feeds into" case shows the pattern.

### 2.15 A goal that is proposed, not yet active (GE10)

Wireframe 10. Lane, 11 Nov: "a feature to identify if a goal is active or if it is just proposed".

**The rule.** A proposed goal is a real goal, with a key, that everyone in the workspace can see, and that nobody is yet held to. It is not judged: the status rules are never run on it, so it is never on track, at risk, off track, late or "No recent update"; nothing is due on it; and it is in no count of goals, no health line, no Needs attention, no review's agenda, no check-in, no wrap-up and no metric's comparison. It becomes active by one deliberate act, **"Make it active"**, by its owner or an admin.

**The words**, one meaning each:

| Word | Means |
|---|---|
| **Proposed** | The goal's state: visible, not judged, nothing due |
| **Active** | Every other goal that isn't stopped. Said only where the two are set side by side (the last step's question, the State column, a filter); an active goal's row doesn't say "Active" |
| **Propose** / "Propose goal" | Save a new goal as proposed |
| **Make it active** | The act that starts it. Not "approve" (nobody is asked for permission) and not "start" (which From already means) |
| **Withdraw** | Remove a proposed goal |

**What it is not**

| Thing | What it is | How Proposed differs, and what happens to it |
|---|---|---|
| A draft (2.9) | Unsaved, in the form, seen only by its author, kept 30 days | A proposed goal is saved, has a key and a page, and everyone sees it. Drafts stay. The drafts list loses its "asked you to set this up" row if decision 15 is taken |
| Not started (README section 9; Lane's answer 8) | An active goal whose From is still to come: committed, with a date; "No check-in yet · starts week 50" | Proposed is not committed and has no start. They are two things; no "Planned" status |
| "Not started" in week 0 (`status.ts:210`, the `planned` status word) | Every goal before the cycle's week 1 | Unchanged. A proposed goal in week 0 reads "Proposed" |
| A goal agreed in a review (2.8) | As Lane answered on 11 Nov: a next step, "Set up a goal: {name}" | Recommended now (README, decision 15): the room proposes the goal itself. It is the "real unpublished goal" that needed a migration of its own before; Proposed already brings the column |
| "Ask {name} to set it up" | Dropped (2.3) | Propose the goal for them |
| A level above Team, or a goal for someone else | Allowed for anyone (Lane, 11 Nov) | Proposing is how to put such a goal in front of its would-be owner or a leader without committing them. For someone else the last step starts on "Not yet: propose it" (decision 16) |
| Stopped | Was active, has history, ended with a reason | A proposed goal has no history to keep: it is withdrawn, not stopped |
| Next year's goals while the year is prepared (cycle end CY2) | Active goals of a cycle that hasn't begun: "Not started" | A proposed goal carries as proposed (rule 14) |

**The code today.** `Goal` has `removedAt` and `stoppedAt` and nothing else about its state (`types.ts:108–114`); `pending` is "a proposed plan change … kept for governance later" and is unused (`types.ts:104`). `goalStatus` gives every live goal a status: "Not started" in week 0, "No check-in yet" for 14 days, then "No recent update" (`status.ts:208–212`, `RULES.staleDays`). So a goal put in early, before anyone has agreed it, is counted, then flagged.

**How it is shown**

- **The word alone, "Proposed"**, in the muted text colour at the weight a status word has, in the place a status shape and word would be: first on a row, above the title on the goal's page. No shape, no capsule, no wash (the design rules: a state that isn't a status is a word).
- Counts never mix: "126 goals, worst first. 4 proposed" (the second part a link); a team's page "17 goals this year · 2 proposed"; a person's "3 goals · 1 proposed".
- The Map: a proposed goal is drawn only with the filter on, as a node with a dashed outline on every side and the word. The Board: no column unless the filter is on, then one column, "Proposed". The History layout: no row.
- Find and find-and-pick: a proposed goal's row has "Proposed" where the status is.
- An export: the State column says `proposed`; the worked-out Status column says "Proposed"; every other worked-out column is empty.

**New goal's last step.** After "After you publish" (2.5):

1. **"Is it under way?"**, two choices, each with its line:
   - "Yes: publish it as active" · "It is judged against its plan from {this week | week {from}}, and check-ins are due." (no rhythm: "It is judged against its plan from this week.")
   - "Not yet: propose it" · "Everyone can see it and comment. Nothing is due and it has no status until {you | {owner}} or an admin make{s} it active."
2. With "Not yet" chosen, "After you publish" is replaced by **"After you propose it"**: "It is listed as Proposed, apart from the goals that are under way: it is in no count, no review’s agenda and nobody’s check-ins." · "Its plan is kept as you typed it. When {you make | it is made} it active, the plan starts from that week unless {you | they} say otherwise." · for someone else: "{Owner} sees it on {their} Home as a proposal for {them}. Faro doesn’t send email." · the hint "You can change anything without giving a reason, or withdraw it."
3. The primary button: **"Publish goal"** or **"Propose goal"**.
4. A proposed goal may leave **how it is measured** unsaid: with "Not yet" chosen, step 3's required fields become optional (rule 14), and "Continue" on step 2 offers the link "Skip: say how it’s measured later". The read-back's What row then reads "How it’s measured isn’t said yet."

**A proposed goal's page** (`/goals/<key>`), in the goal page's width, in this order:

1. "Proposed" above the title; under the title "{key} · {owner}, {team} · proposed by {name} on {date}{ in {review}}".
2. For whoever may make it active (rule 14): the primary **"Make it active"** (or **"Finish it"** when something required is missing, which opens `/goals/<key>/edit` at the first missing field); then "Change it" and "Withdraw it".
   For the proposer who isn't the owner: no primary; "Change it" and "Withdraw it"; the line "{Owner} or an admin can make this active."
   For anyone else: that line, and "Add a comment", "Ask {owner} a question", "Watch". No primary.
3. One block in place of the summary, scorecard and chart: "Proposed, not yet active. Nothing is due and it has no status. It would {move from {baseline} to {target} over {n} weeks | stay at or under {limit} | hit {n} stages}{, and feed “{parent}” ({key})}." and the hint "The scorecard, the chart and History’s weeks start when it is made active." With nothing said: "How it’s measured isn’t said yet."
4. "Next steps and asks", comments, "About this goal" and "What feeds it" as on any goal. History lists changes and comments, with no week rows.

**"Make it active"** opens a block in place (a sheet on a phone):

1. For a number goal: "Baseline" with "From" (the week picker), From starting as **this week** whatever was typed when it was proposed, and "Target" with "To" as typed. A range: nothing to choose. Stages: each stage with its Due, those now past outlined with OB2's question.
2. The read-back, from rule 5 with today's date: "From {baseline} in week {from} ({dates}) to {target} by week {to} ({dates}): {n} weeks{, not the {m} you proposed}. Its first check-in is due by {weekday} {date}, then every week. It joins {review | no review yet}." (no rhythm: "Nothing is due.") When the proposer is someone else: "{Proposer} and its {n} watcher{s} see that it is active."
3. Any Check the dates raise (`to-past`, `long-plan`, `stage-past`).
4. **"Make it active"**; "Cancel".

After: the goal's page as a new goal's (round 1's "No check-in yet" state, with "Post the first check-in"), the toast "“{goal}” is active." with "Undo", and one History line: "{Name} made it active, from week {n}."

**Changing a proposed goal** is the edit page (2.6) with three differences: no reason is ever asked; "What will change" has no status or history clauses (each row is "{Field}: {old} becomes {new}."); and the type can be changed ("It’s proposed, so its type can still change."). Its owner, an admin and whoever proposed it may change it.

**Withdrawing.** "Withdraw it" asks "Withdraw “{goal}”? It goes to Recently removed for 30 days." → "Withdraw it" / "Keep it". It is `deleteGoal`'s removal (a goal with no check-ins), so it has the toast's Undo and can be brought back from Recently removed. There is no "not taken up" state to keep: a withdrawn proposal is in Activity ("{Name} withdrew the proposal “{goal}”") and nowhere else.

**Going stale.** A goal proposed `PROPOSED_ASK_WEEKS` (8) weeks ago or more adds one row to "Needs your response" on the Home of whoever may make it active (its owner; an admin only for their own): "“{goal}” has been proposed for {n} weeks. Make it active, or withdraw it." with "Open it". It is asked once and again every 8 weeks; "Not yet" beside it puts it off for 8 more. It is never a status, a count or a flag on the goal.

**Back to proposed.** An active goal with no check-ins can be made proposed again by its owner or an admin: the goal's "…" menu, "Make it proposed again", with the confirm "It will have no status and nothing will be due until it is made active." A goal with a check-in can't: the item is absent, and the edit page's foot says "It has check-ins, so it can’t go back to proposed. Stop it instead."

**Everywhere else**

| Place | What a proposed goal does there |
|---|---|
| Goals (`/goals`) | Every scope lists active goals. The count line gains "· {n} proposed", a link that sets the filter `state=proposed` ("Filtered by: Proposed (Remove)"); the Filters sheet has "State: Active · Proposed · Stopped" (Active by default). With the filter on: "{n} proposed goals, newest first.", rows with the word, the key line "… · proposed {date | n weeks ago}{ by {name}}", and at the right what it would measure or "Not said yet". "Needs attention" never includes one |
| A goal's "What feeds it" | Active feeders are listed and counted as today; under them "Proposed · {n}" and its rows. A proposed goal may feed an active one and an active one may feed a proposed one; neither counts in the other's health line. A goal that feeds a proposed goal shows "Feeds into {goal} · Proposed" |
| "Feeds into" and "Also helps" pickers | Proposed goals are listed, with the word |
| Home | The owner of a goal proposed **by someone else**, not yet opened: a row in "Needs your response": "{Name} proposed a goal for you{ in {review}}: “{goal}”." with "Open it" (it is the lead under the Home spec's `ask` rule, by the day it was proposed). The stale row above. "Your goals · {n}" counts active goals and adds "· {k} proposed" |
| The check-in | Never offered; `/check-in/<id>` for one says "This goal is proposed, so there is nothing to check in. Make it active first." with the link |
| Reviews | Not on an agenda and not counted in "{n} to discuss". Decision 15: "Propose a new goal" in the walk saves a proposed goal (name, who would own it, what it would feed; nothing else), and the next session's "Last time" reads "Proposed: {goal} ({key}). {Owner} hasn’t made it active yet." or "… {Owner} made it active on {date}." |
| The wrap-up and the carry | Not in the wrap-up's list. `carryOf` gives "carry", and the copy in the new year is proposed, with its plan's weeks moved as GE9's rule moves them. The start page's read-back counts them apart: "{n} goals carry on · {k} proposed goals carry as proposed" |
| Metrics | It can name its metric; the link is saved. The metric's page lists it under its goals table as "Proposed · {n}" with no numbers, and it is in no comparison |
| Watching | It can be watched; a watcher sees "{Name} made “{goal}” active" on their Home's changes |
| The rhythm switch | Nothing changes: nothing was due. Reviews off: the review rows and words are absent |
| Find | Listed, with the word |
| The phone | The word sits above the title on a row's first line; the goal's page stacks "Make it active", "Change it", "Withdraw it" full width; "Make it active" is a full sheet; the Goals count line wraps "· 4 proposed" onto its own line |

**The sheet, the tools.** The Goals sheet gains **State** (the field table's row, section 3). `create_goal` and `update_goal` gain `state: "active" | "proposed"`; `find_goals` leaves proposed goals out unless `state` is given; a new tool `make_goal_active` (`goal_id`, optional `from`, `dry_run`) returns the same read-back. A tool's check-in on a proposed goal is refused in the check-in's words above.

## 3. The fields

The rows the goal form needs in the field table (`src/domain/columns.ts`, IM1). "Need" is round 2's word. "Checked" is when the form looks: **L** on leaving the field, **C** on Continue, **P** on Publish or Save.

| Field (form label → sheet column) | Need | Format | Starts as | Example (the hint) | Checked | Must fix | Check |
|---|---|---|---|---|---|---|---|
| Name → Goal | Required | Text, 3 characters or more | Empty | "Requests triaged within 2 days" | L, C | `name-empty`, `name-short` | `same-name` |
| How will you know it worked? → Type | Required | One of three | A number to move, shown chosen | — | — | — (a file: `word-unknown`) | — |
| Owner → Owner, Owner email | Required | A person in the workspace | You | — | C, P | `owner-empty` | `owner-other-team`; `for-someone-else` (a file or a tool only, 2.15) |
| Team → Team | Required | A team in the workspace | The owner's team | — | C | `team-empty` | — |
| Level → Level | Required | Team, SVP, North star | OB1's rule 1 | — | C | `level-empty` (only when rule 1 gives none) | — |
| Feeds into → Feeds into, Feeds into key | Optional | A goal in this cycle | Nothing; said: "Feeds nothing." | — | C, P | `feeds-loop` | `feeds-lower` |
| How much will it move “{parent}”? → Effect | Optional | A number, in the parent's unit | Empty | "3" | L, C | `not-number` | — |
| Why do we expect it to help? → Why it helps | Optional | Text | Empty | — | — | — | — |
| Also helps → Also helps keys (new column) | Optional | Goals in this cycle | None; said: "Helps no other goal." | — | — | — | — |
| It’s a guardrail → Guardrail (new column) | Optional | Yes or no | No; said: "Not a guardrail." | — | — | — | — |
| Measured by (ML2) | Optional | A metric, or "No metric" | Nothing chosen | — | — | — | `wrong-side`, `far-from-metric` |
| Unit → Unit | Required for a number and a range | Text, up to 20 characters, no digits only | Empty (a metric fills it) | "%, days, hours, incidents" | L, C | `unit-empty` | — |
| Decimals → Decimals | Optional | 0 to 3 | Worked out: the most places typed in Today, Target, Limit, at most 3; said | — | L (on a number) | `too-precise`, `decimals-range` (a file) | — |
| Baseline → Start (a file may head it "Baseline") | Required for a number | A number | Empty | "42" at the goal's decimals | L, C | `start-empty`, `not-number`, `has-words`, `too-precise` | `below-zero`, `over-100`, `hundredfold`, `billion`, `far-from-metric` |
| Target → Target | Required for a number | A number, not equal to the baseline | Empty | "30" | L, C | `target-empty`, `not-number`, `has-words`, `too-precise`, `same-as-start` | The same, and `wrong-side` |
| From → From (new: `2026-W46`), Plan from week (kept: a number from the cycle's start) | Optional | A week, picked; in a file a year and week, or the number | This week; said: "This week" | "2026-W46" | L, C | `week-unknown`, `week-beyond` | `from-past` |
| To → To (new: `2027-W13`), Due week (kept) | Optional | A week after From, picked | The goal year's last week; said: "The end of {year}" | "2026-W53" | L, C | `to-before-from`, `week-unknown`, `week-beyond` | `to-past`, `long-plan` |
| How will progress come? → Plan | Optional | Steady, back-loaded, in steps | Steady, shown chosen | — | — | — | — |
| The plan week by week → the Plan sheet | Optional | A number per week | From the shape | — | L | `plan-point` | `late-plan` |
| Must stay → Must stay | Required for a range | At most, at least | At most, shown chosen | — | — | — | — |
| Limit → Limit | Required for a range | A number | Empty | "12" | L, C | `limit-empty`, `not-number`, `has-words`, `too-precise` | `below-zero`, `over-100`, `billion` |
| Warn this close → Margin | Optional | A number, zero or more | Empty: no early warning; said | "1" | L, C | `margin-negative`, `not-number`, `too-precise` | `margin-wide` |
| Stages → Stages (`Name@48` or `Name@2026-W48`) | Required for stages: at least one | Each: a name, and a week of this goal year, picked | One empty row | "Threat model" | L, C | `stage-none`, `stage-name`, `stage-week`, `stage-twice` | `stage-past` |
| Is it under way? → State (new column) | Optional | `active` or `proposed` (also read: "live", "draft", "proposal") | `active`; in the form, "Not yet" first when the owner is someone else | "proposed" | P | `word-unknown`: "State says “{raw}”. Use active or proposed."; `state-has-check-ins`: "“{goal}” has check-ins, so it can’t go back to proposed. Stop it instead." | `for-someone-else` (a file or a tool, once per file): "{n} of these goals {is \| are} for other people and would start as active. Is that what you mean?" → "Yes, active" / "No, start them as proposed" |
| How it’s measured → Definition | Optional | Text | Empty | "Median hours to the first reply, from the help desk" | — | — | — |
| Where the number comes from → Source | Optional | Text | Empty | "Jira intake board" | — | — | — |
| Why is the plan changing? → Reason | Required for a plan change after check-ins | A sentence, 10 characters or more (`MIN_REASON`) | Empty | — | P | `reason-empty` | — |
| Key, ID, status and the rest | Worked out | — | — | — | — | — | — |

**A number, as typed** (rule 12; today's `parseNumber`, tightened in one place):

| Typed | In a goal whose unit is | Read as |
|---|---|---|
| `12`, `12.5`, `-3`, `+3`, `.5` | Any | The number |
| `1,250`, `1,250.5` | Any | 1250, 1250.5 |
| `1,5`, `29,4` | Any | 1.5, 29.4 (a decimal comma) |
| `12%`, `12 %` | `%` | 12 |
| `12 days`, `12days` | `days` (compared without case; `min` and `mins`, `day` and `days`, `hr`, `hrs`, `hour` and `hours` are the same) | 12 |
| `12 days` | `%`, or empty | Must fix `has-words` |
| `12%` | `days` | Must fix `has-words` |
| `abc`, `1.2.3`, `12-` | Any | Must fix `not-number` |

A week is always shown with its dates and their year: "Week 48 · 23–29 Nov 2026" in a field, "Week 48 · 23–29 Nov" in a list under its year, "week 53 (28 Dec 2026–3 Jan 2027)" in a sentence, `2026-W53` in a file.

**From and To in a file.** The export writes all four columns (From, Plan from week, To, Due week), so an old reader and a new one both work. On import each pair is read by the rule Owner and Owner email follow: a column that says what the goal says now is ignored, and the one that differs counts; both differing and disagreeing is a Must fix ("From says 2026-W46 and Plan from week says 40. Change just one of them."). A file with only the old columns loads as today. `roundtrip.test.ts` holds.

## 4. The words

**Must fix.** `{raw}` is what was typed, trimmed.

| id | Where | Words |
|---|---|---|
| `name-empty` | Name | "Give the goal a name." (today's) |
| `name-short` | Name | "Give the goal a name of at least three characters." (today's) |
| `owner-empty` | Owner | "Choose who owns it." |
| (`owner-not-yours` is removed) | A file's row; a tool | The engine stops refusing "You can add goals you own. Ask an admin to add goals for other people." (`changeset.ts:385`): Lane's rule is that anyone may add a goal for anyone, at any level, at every door |
| `team-empty` | Team | "Choose a team." (with an owner in none: "{Owner} isn’t in a team. Choose the team this goal is for.") |
| `level-empty` | Level | "Choose a level." |
| `feeds-loop` | Feeds into | "That link would make a loop: “{parent}” already feeds into this goal." |
| `unit-empty` | Unit | "Say what the number counts: %, days, incidents." |
| `start-empty` | Today | "Enter where it starts today." (the edit page: "Enter where it starts.") |
| `target-empty` | Target | "Enter the target." (today's) |
| `limit-empty` | Limit | "Enter the limit." (today's) |
| `not-number` | Any number | "“{raw}” isn’t a number. Type digits only, like {example at the goal’s decimals}." (today's `notNumberText`, always given the decimals) |
| `has-words` | Any number | "“{raw}” has words in it. Type the number only, like {n}; the unit goes in Unit." (when the goal has a unit: "…; this goal counts {unit}.") |
| `too-precise` | Any number | "{raw} has {places}, but this goal keeps {places}, so it would show as {shown}. Type {shown}, or keep {places} for this goal." with the button "Keep {places}" (today's sentence; its end now names the button, as the first check-in does) |
| `decimals-range` | A file or a tool | "Decimals says “{raw}”. Use 0, 1, 2 or 3." |
| `same-as-start` | Target | "The target is the same as today ({value}{unit}). To hold a number where it is, make this a number to keep in range." with 2.4's button |
| `plan-point` | The plan table's row | "Week {n}: " and the number's own line |
| `margin-negative` | Warn this close | "Enter a warning margin of zero or more, or leave it empty." |
| `stage-none` | The first row | "Add at least one stage." (today's) |
| `stage-name` | The row's name | "Give this stage a name." |
| `stage-week` | The row's Due | "Choose the week “{stage}” is due." (a file: "“{stage}” needs a due week between 1 and {weeks}: it says “{raw}”.") |
| `stage-twice` | The second row's name | "Two stages are called “{name}”. Give each its own name, such as “{name} review”." |
| `stage-done-removed` | The edit page | "“{stage}” was done in week {n}, so it can’t be removed. Rename it, or leave it." |
| `decimals-lose` | The edit page | "{k} check-in{s} {has|have} more decimal places than {places} (week{s} {list, up to three}). Keep {current places}, or correct those check-ins first." |
| `to-before-from` | A file or a tool (the picker can't make it) | "To (week {n}, {dates}) isn’t after From (week {m}, {dates}). The plan has to run forwards." (replaces `changeset.ts:426`'s words) |
| `week-unknown` | A file or a tool | "{Field} says “{raw}”. Write a year and a week, like 2026-W46, or the week’s number." A week the year doesn't have: "{year} has {k} weeks. Use {year}-W{k}, or {year+1}-W01." |
| `week-beyond` | Everywhere | "{Field} can be as late as week {k} of {next year} ({dates}), the end of next year." / "From can be as early as week 1 of {last year}." |
| `reason-empty` | The edit page | "Say why, in a sentence. It goes in the goal’s History{, and its {n} watcher{s} see{s} the change flagged}." |

**Check.** Each has the question, the two answers (the first is the one that keeps what was typed), what it is keyed on, and its sentence on the read-back.

| id | Asked when | Question | Answers | Keyed on | Read-back |
|---|---|---|---|---|---|
| `stage-past` | OB2's rule 3 | "Week {n} was {k} week{s} ago. Is this stage already done?" | "Yes, done in week {n}" / "No, it’s overdue" | Stage, week | OB2's |
| `below-zero` | A start, target or limit below zero where `usuallyPositive(unit)` | "{value}{unit} is below zero. That’s fine for a change or a balance. Is it right here?" | "Yes, {value}{unit} is right" / "No, I’ll change it" | The numbers, unit | "You said {value}{unit} is right." |
| `over-100` | Unit % and a start, target or limit over 100 | "The {field} is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is {value}% right?" | "Yes, {value}% is right" / "No, I’ll change it" | The numbers | "You said {value}% is right." |
| `hundredfold` | Start and target the same sign, one 100 times the other or more (`FAR_RATIO`) | "The target ({target}) is {over 100 times \| under a hundredth of} where it starts ({start}). Is that right?" | "Yes, {start} to {target} is right" / "No, I’ll change it" | Start, target | "You said {start} to {target} is right." |
| `billion` | Any of them a billion or more | "{value} is a billion or more. Is it right?" | "Yes, it’s right" / "No, I’ll change it" | The number | "You said {value} is right." |
| `wrong-side` | A metric is chosen, and the target is on the worse side of the start for it | "“{metric}” is better {lower\|higher}, but the target ({target}) is {above\|below} today ({start}). Is that the plan?" | "Yes, this goal lets it {rise\|fall} to {target}" / "No, I’ll change the numbers" | Metric, start, target | "You said the target is right though “{metric}” is better {lower\|higher}." |
| `far-from-metric` | A metric with a latest number for the slice; Today (or a range's Limit) differs from it by more than a factor of 3 (the check-in's own ratio, `checkin.ts:122`) | "The latest “{metric}” for {slice} is {latest} (week {n}, from {key}). You’ve typed {value} as {today\|the limit}. Is {value} right?" | "Yes, {value} is right" / "Use {latest}" | Metric, slice, value | "You said {value} is right; the metric’s latest is {latest}." |
| `same-name` | Another goal in this cycle, in the same team, with the same name (ignoring case, spaces and accents) | "{Team} already has a goal called “{title}” ({key}, owned by {name}). Is this a different goal?" | "Yes, it’s a different goal" / "No, open {key}" (keeps the draft) | Name, team | "{Team} already has “{title}” ({key}); this is a different goal." |
| `owner-other-team` | The owner's team isn't the goal's team | "{Owner} is in {their team}, not {team}. Which team is this goal for?" | "Keep it in {team}" / "Move it to {their team}" | Owner, team | "{Owner} is in {their team}; the goal stays in {team}." |
| `feeds-lower` | The goal it feeds is at a lower level than its own | "{A north star\|An SVP goal} usually feeds {nothing\|a north star}, and “{parent}” is {a Team\|an SVP} goal. Is this link right?" | "Yes, it feeds that goal" / "No, it feeds nothing" | Level, parent | "You said it feeds “{parent}”, a {level} goal." |
| `margin-wide` | A range whose margin is as large as the limit's distance from zero, or larger | "With a limit of {limit}{unit} and a warning {margin}{unit} away, it would almost always read at risk. Is {margin} right?" | "Yes, warn within {margin}{unit}" / "No, I’ll change it" | Limit, margin | "You said to warn within {margin}{unit}." |
| `late-plan` | Weeks set by hand, and rule 12's `lateShare` is over 0.6 | "This plan leaves {pct}% of the change to the last {k} of {n} weeks. Is that the plan?" | "Yes, that’s the plan" / "No, I’ll change it" | The plan's points | "You said most of the change comes in the last {k} weeks." |
| `from-past` | From is before this week (a new goal, or From changed on the edit page) | "Week {n}{ of {year}} was {k} week{s} ago. Has this been running since then? The plan would expect {plan now} by this week." | "Yes, it was {baseline} in week {n}" / "No, start from this week" (sets From to this week) | From, baseline, target, To | "You said it has been running since week {n} ({dates})." |
| `to-past` | To is before this week | "Week {n} has already passed. Was the target due then?" | "Yes, it was due in week {n}" / "No, I’ll choose a later week" | To | "You said the target was due in week {n}." |
| `long-plan` | To is more than 53 weeks after From | "This plan runs {k} weeks, to week {n} of {year}. Is that right?" | "Yes, {k} weeks" / "No, I’ll change it" | From, To | "You said the plan runs {k} weeks." |
| `direction`, `far-from-plan` | The edit page: today's `planQuestion` | Today's words (`goal.ts:137`, `146`) | Today's "Yes, …" / "No, I’ll change it" | As today | — |

- Several checks on one field are all shown, in this table's order.
- A chosen shape is never questioned (the person just chose it); only hand-set weeks raise `late-plan`.

## 5. Who sees what

Consistent with R1 (`spec/requirements/internal/r1-sign-in-and-access.md`). Each line names what enforces it. Nothing here adds a right; two gaps are decisions for Lane (README, 2 and 8).

| Thing | Member | Owner of the goal | Admin | Enforced by |
|---|---|---|---|---|
| New goal, for themselves or anyone, at any level | Yes | — | Yes | No rule refuses it (Lane, 11 Nov). R1's row "Add a goal" becomes "Anyone, for anyone"; `changeset.ts:385` is removed; rule 7's `mayAddGoal` is always true and is kept only as the one place the rule is stated |
| Open `/goals/<id>/edit` | The read view | The form | The form | `mayChangeGoal` (rule 7), which is `planChanges`' `canChange` |
| Save changes; change unit or decimals | No | Yes | Yes | `planChanges` |
| Hand it to someone else | No | Yes | Yes | `planChanges` (the owner is a field of the goal) |
| Undo an edit | — | Whoever made it, within ten minutes, if nothing followed | Any, the same limits | New: `undoGoalEdit` (rule 7); see README, decision 6 |
| "Agree a new goal" | Yes | Yes | Yes | `addAction` (anyone may add a next step) |
| "Set up the goal" on a next step | The person it is for | — | Yes, as themselves | `planChanges`; done by `markActionDone` (`canMarkDone`: the doer, the asker, an admin) |
| "Withdraw" that next step | Whoever asked | — | Yes | `withdrawRequest`, `canWithdraw` |
| "Add a goal that feeds this", "Duplicate as a new goal" | Yes | Yes | Yes | They open New goal; `planChanges` on publish |
| "Add a goal for {team}" | The team's members | — | Yes | A link only; no right |
| Stop; delete | No | Yes | Yes | `stopGoal`, `deleteGoal` (unchanged) |
| Their own drafts | Yes | — | Their own | The `Prefs` port (per person) |
| The carried-goal line | No | Yes | Yes | `mayChangeGoal` |

With Reviews off (FT), "Agree a new goal" and the read-back's review line are absent. With the rhythm off, every "checks in weekly", "is due by" and "checks in from week" is absent.

## 6. Rules for `src/domain`

Pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. In `src/domain/goalEntry.ts` (new) unless said. They restate nothing: number reading from `numbers.ts` and `checkin.ts`, plans from `plan.ts`, the build from `goal.ts`, status from the status rules. **No rule takes the workspace**: each lists what it reads (AR4).

### Rule 1. What a field needs: `fieldNeed(column, kind)`

Reads the field table's `required` (IM1): `'always' | GoalKind[] | 'never' | 'worked'`. Returns `'required' | 'optional' | 'worked'`. `stepSays(fields, kind)` returns whether a step prints "Everything here is needed unless it says optional." (two or more required, at least one optional).

| Given | Then |
|---|---|
| Unit, a number to move | required |
| Unit, dated stages | Not asked (the field isn't shown) |
| Margin, a range | optional |
| Step 3 of a number goal with no metric | The line is printed |
| Step 1 | Not printed (both fields are required) |

Until IM1 lands, the same values live in `goalEntry.ts` as a table that IM1 replaces.

### Rule 2. What can't be saved: `goalMustFix(draft, ctx)`

`ctx = { cycleWeeks, week, existing: Goal | null, checkIns: CheckIn[] (this goal's), actor: { id, admin }, ownerTeamId, loops: boolean, door: 'form' | 'setup' | 'table' }`. Returns `{ field, id, text }[]`, in the form's order. It contains today's `validateGoal` (which it replaces as the one entry; `validateGoal` stays as its inner part) and adds `team-empty`, `unit-empty`, `has-words`, `stage-twice`, `stage-done-removed`, `decimals-lose`, `feeds-loop`, `same-as-start`'s offer.

`decimalsFor(draft)`: the most decimal places typed in Today, Target and Limit (or Start and the stored numbers on an existing goal), at most 3; used when the person hasn't chosen.

`planChanges` (`changeset.ts`) calls it for each Goals row in place of lines 384 to 385 and 445 to 446, with `door: 'table'`; set-up calls it with `door: 'setup'` in place of `goalErr` (`Onboarding.tsx:202`).

| Given | Then |
|---|---|
| Name "ab" | `name-short` |
| A number goal, unit empty, 42 → 30 | `unit-empty` |
| Unit "%", today "12 days" | `has-words`: "“12 days” has words in it. Type the number only, like 12; this goal counts %." |
| Unit "days", today "12 days" | Nothing |
| Unit "%", today "1,5", target "3", decimals not chosen | Nothing; `decimalsFor` gives 1 |
| The same, decimals chosen as 0 | `too-precise` on Today |
| Today "abc", decimals 0 | `not-number` with the example "29" |
| Today 10, target 10 | `same-as-start` |
| Stages "Design"@48, "design "@50 | `stage-twice` on the second |
| Stages "Design"@60 in a 53-week cycle (a file) | `stage-week`: "“Design” needs a due week between 1 and 53: it says “60”." |
| Tunde, not an admin, owner Amara, level North star | Nothing: allowed (Lane, 11 Nov) |
| Grace, an admin, owner Amara | Nothing |
| Owner in no team, team empty | `team-empty`, the longer words |
| An existing goal with a check-in of 7.5, decimals 1 → 0 | `decimals-lose` |
| Everything of a valid number goal | An empty list |

### Rule 3. What is asked: `goalChecks(draft, ctx)` and `unanswered(checks, answers)`

`ctx = { week, cycleWeeks, existing, actor: { admin }, ownerTeam: { id, name } | null, team: { id, name }, parent: { title, level } | null, sameNamed: { key, title, ownerName }[] (same team, from the Search port's goal finder, not a scan), metric: { name, direction, latest: { value, week, key } | null, slice } | null, reviewsJoined: string[] }`. Returns `{ id, field, question, yes, no, key, readBack }[]` in section 4's order, only when the fields concerned have no Must fix. `unanswered` returns those whose `answers[id] !== key`.

It contains today's `planHint`, `overHundredHint`, `setupProblem` and `planQuestion` (which stay as its inner parts), and OB2's `pastStage`.

| Given | Then |
|---|---|
| −5% → 5% | `below-zero` |
| 10% → 1500% | `over-100` and `hundredfold`, both (today: the first only) |
| 50% → 150%, answered yes; target then 160 | Asked again (the key changed) |
| 5 days → 2 days | Nothing |
| A range, at most 12%, margin 20 | `margin-wide` |
| A range, at most 12%, margin 1 | Nothing |
| Tunde, level North star, parent a Team goal, owner himself | `feeds-lower` only |
| An SVP goal feeding an SVP goal | Nothing |
| Owner Amara (Office of the VP), team Build & Release | `owner-other-team` |
| "Signed artifacts" in Build & Release, where G-73 has that name | `same-name` |
| The same name, G-73 in another team | Nothing here (OB1's note) |
| Metric "Pipeline queue wait", lower is better, 7 → 9 | `wrong-side` |
| The same metric's latest for CI/CD is 7 (week 46); today typed 70 | `far-from-metric` |
| The same; today typed 9 | Nothing (within a factor of 3) |
| Weeks set by hand: 10, 10, 10, 10, 9, 8, then the target 5 | `late-plan`: "This plan leaves 80% of the change to the last 2 of 7 weeks." |
| "Back-loaded" chosen, no hand-set weeks | Nothing |

`planChanges` turns each into a question on its item (today's `question`, now a list), so the import's preview and the tools' `questions` carry them; `confirm` answers them all, and the import's "one answer covers every row with the same question" is the import spec's.

### Rule 4. Whether a step can go on: `stepState(step, mustFix, checks, answers)`

Returns `{ go: boolean, focus: field | null, says: string | null }`, giving 2.1's line. Must fix first, then questions.

| Given | Says |
|---|---|
| Unit empty, target "30 mins" | "2 things to fix above: Unit and Target." |
| Four Must fix | "4 things to fix above: Unit, Today and 2 more." |
| No Must fix, `feeds-lower` unanswered | "Answer the question above, under Feeds into." |
| Nothing | Goes on |

### Rule 5. The read-back: `readBack(goal, ctx)`

`ctx = { ownerName, ownerIsViewer, teamName, parent: { title, key } | null, alsoHelps: string[], metric words | null, defaults: fieldId[] (those not changed), answers: readBack sentences, rhythm: 'weekly' | 'none', dueDay: weekday, today, week, cycle, reviewsOn, reviewsJoined: { name, why }[], wsName }`. Returns `{ rows: { id, label, text, step }[], after: string[] }`: 2.5's sentences.

`firstDue(today, dueDay)`: this week's due day when today is on or before it, else next week's.

`reviewsJoined` comes from `reviewsJoining(goal, reviews, goals)` in `src/domain/review.ts` (new; it applies the existing `goalsIn` to the goal as built).

| Given (11 Nov 2026, week 46, due Thursday) | Then |
|---|---|
| Tunde's "Signed artifacts in staging", 40% → 90% by week 53, steady, Team, feeds G-41 | What: "A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better." After: "Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47." |
| The same, published on Friday 13 Nov | "… due by Thursday 19 Nov …; the plan says 47% for week 47." |
| The same, rhythm none | "It shows as “No check-in yet” until you post its first number. Nothing is due." and no weekday anywhere |
| Owner Amara, by an admin | "Amara sees it on her Home the next time she opens Faro. Faro doesn’t send email." |
| A North star, Reviews on, "Platform leadership weekly" walks every north star | "It joins Platform leadership weekly, which walks every north star." |
| Reviews off | No review line |
| A range at most 12%, no margin | "A number to keep in range: at or under 12%. It warns only once the limit is crossed." |
| One stage, due week 50 | "Dated stages: 1 stage, the last due week 50 (7–13 Dec 2026)." (never "1 stages") |
| Nothing defaulted | No "Left as usual" row |

### Rule 6. What a change does: `whatWillChange(before, after, ctx)`

`ctx = { checkIns: CheckIn[] (this goal's), cycle, week, today, names: Lookup, rhythm, reviewsOn, reviewsBefore, reviewsAfter, watchers: number, actor: { id, admin } }`. Returns `{ rows: { field, text }[], needsReason: boolean, count: number }`.

- The fields are `goalChange`'s (`changes.ts:84`), so the page and the History never disagree about what changed.
- `needsReason` is today's rule: check-ins have started and `planChanged(before, after)`, or the unit changed.
- The status clause compares `goalStatus(before, …)` with `goalStatus(after, …)` on the same check-ins.

| Given | Then |
|---|---|
| "Pipeline queue wait (p90)", 46 check-ins, target 3 → 5 min, week 46 at 7 min | "Target: 3 min becomes 5 min. From this week it is judged against the new plan: week 46 would read At risk, not Off track. Weeks 1 to 45 and the closed quarters keep the plan of their day, and the old plan stays on the chart, dotted." `needsReason` true |
| The same change where the status stays Off track | "… week 46 would still read Off track. …" |
| Owner Rhea → Tunde, by Rhea, weekly, week 46 already checked in | "Owner: Rhea Kapoor hands it to Tunde Bakare. Tunde checks in from week 47 and sees it on his Home. After this, only Tunde or an admin can change it." `needsReason` false |
| The same, by Grace (an admin) | Without the last sentence |
| Only the name | One row; `needsReason` false; the button reads "Save 1 change" |
| A new goal with no check-ins, target changed | "Target: 90% becomes 85%."; `needsReason` false |
| Unit min → hours, 46 check-ins, latest 7 | "Unit: min becomes hours. The 46 numbers already checked in are not converted: 7 will read 7 hours." `needsReason` true |
| Nothing differs | No rows; count 0 |

### Rule 7. Who may, and saving: `src/domain/goalRights.ts` and `planGoal`

- `mayAddGoal(actor, ownerId)`: always true (Lane, 11 Nov: anyone may add a goal for anyone, at any level). It exists so the rule is stated once; `changeset.ts` calls it where line 385 refused, so the form, a file and the tools agree by sharing it. `mayChangeGoal(actor, goal)`: the actor owns it, or is an admin (unchanged; with GE10, also whoever proposed a goal that is still proposed). `changeset.ts` uses it in place of its inline `canChange`, so there is one statement of R1's row.
- `planGoal(x, { draft, goalId?, reason?, note?, answers, fromAskId? })` in `goalEntry.ts`: the form's one way to save. It refuses (`NotAllowed`, with section 4's words) unless the right holds, `goalMustFix` is empty, `unanswered` is empty, and a needed reason is given; then returns the commit: the goal from `buildGoal`, the change from `goalChange` with "Why", "Note for {name}" and one "Checked" diff per answer, and, with `fromAskId`, the ask marked done (rule 9).
- A new action **`saveGoal`** in `src/app/actions.ts` runs it; `app.saveGoal` (`state.tsx:615`) calls the action. The form no longer commits by itself.
- `undoGoalEdit(x, { goalId, before })`: allowed when the goal's latest change was made by the actor (or the actor is an admin), at most `EDIT_UNDO_MIN` (10) minutes ago, with no check-in or other change since, and `goalChange(now, before)` mirrors that change field for field. It returns the goal as `before` with the change "Undid a change: {fields}". `before` is held by the screen, in memory.

| Given | Then |
|---|---|
| Tunde saves a new goal owned by Amara, as a north star | Saved. The read-back said: "After you publish, only Amara or an admin can change it." The same row in a file or through `create_goal` saves too (today both refuse) |
| Tunde then opens its edit page | The read view: "Amara Nwosu or an admin can change this." (unless it is proposed and he proposed it: rule 14) |
| Rhea hands her goal to Tunde, then Undo two minutes later | Allowed: the owner is Rhea again; History has both lines |
| The same, after Tunde has checked in | Refused: "It has changed since, so it can’t be undone here. {Owner} or an admin can change it." |
| The same, eleven minutes later | Refused, the same words |
| A draft with `over-100` unanswered | Refused: the question's words |

### Rule 8. Starting from where you are: `prefill(query, ctx)`

`ctx = { viewer: { id, teamId, admin }, parent: Goal | null, team: { id, name } | null, like: Goal | null, ask: Ask | null, askGoal: Goal | null }` (each looked up by id by the screen). Returns `{ fields: Partial<GoalDraft>, says: string | null, missing: string[] }`.

| Given | Then |
|---|---|
| Rhea, `?parent=G-1` (a north star) | Feeds G-1; level SVP; team CI/CD; "It will feed “Lead time for changes”, as an SVP goal in CI/CD, owned by you." |
| Grace, `?team=build` | Team Build & Release; "It will be in Build & Release, owned by you." |
| `?like=G-12` (a number goal, min, whole numbers, feeding G-1) | Its type, unit, decimals, shape, team, level, parent, also helps, guardrail, definition, source; name, start, target, due and owner empty or the viewer; the copy line |
| `?like=` a stages goal | Its stages' names, each with no week |
| `?from=<ask>` "Set up a goal: Data-backed environments ready in under an hour", for Camille, on G-5 | Name; owner Camille; feeds G-5; level one below G-5's |
| `?parent=` an id that doesn't exist | No fields; `missing: ['The goal it would feed']` |

### Rule 9. A next step that asks for a goal: `src/domain/asks.ts`

- `setUpGoalText(name)` returns `"Set up a goal: " + name`. `goalToSetUp(ask)` returns the name when the ask is an action whose text starts with that prefix (compared exactly), else null. Both live in one place and nothing else writes or reads the prefix.
- `agreeGoal(x, { name, ownerId, feedsId, onGoalId, dueWeek, reviewId? })` returns `addAction`'s commit for that text (the ask's goal is `feedsId ?? onGoalId`).
- `planGoal` with `fromAskId` adds `markActionDone(x, ask, "Set up as " + key)`.
- An ask whose text was edited so the prefix is gone is an ordinary next step again.

Why a prefix and not a field: an ask is stored in columns (`okr_requests`), so a new field is a migration; this needs none. Section 10 gives the other answer.

| Given | Then |
|---|---|
| "Agree a new goal": "Data-backed environments ready in under an hour", Camille, feeds G-5, by week 48, in the weekly | An action for Camille on G-5, due week 48, in that review: "Set up a goal: Data-backed environments ready in under an hour" |
| `goalToSetUp` of it | The name |
| `goalToSetUp` of "Decide whether to split …" | null |
| Camille publishes from `?from=` and gets G-131 | The ask is done, by Camille: "Set up as G-131" |
| Amara withdraws it first | Camille's draft opens with 2.5's line; publishing marks nothing |

### Rule 10. Drafts: `src/domain/drafts.ts` (new)

- `liveDrafts(stored, now)`: those changed within `RESTORE_DAYS`, newest first; `keptUntil(draft)`: its last change plus 30 days. `canStartDraft(stored, now)`: fewer than five live.
- `editPatch(goal, draft)`: the fields that differ from the goal; `applyPatch(goal, patch)`; `goalStamp(goal)`: a stable hash of its fields; `patchState(patch, goal)`: `'clean' | 'goal-changed'`, with the fields both changed.

| Given | Then |
|---|---|
| Drafts last changed 9 Nov and 2 Oct, today 11 Nov | One is live; it is "kept until 9 Dec" |
| Five live drafts | `canStartDraft` false |
| An edit that changed only the target, and the goal's owner changed since | `'goal-changed'`; applying the patch keeps the new owner and the typed target |
| The same, and the goal's target also changed since | `'goal-changed'`, with Target named as changed by both |

### Rule 11. A carried goal that nobody has looked at: `carriedUnchecked(goal, ctx)`

`ctx = { cycleStartedAt, checkIns: this goal's, changes: this goal's, previousKeys: Set<string> }`. True when the goal's key existed in the previous cycle, it was created at the cycle's start, and it has no check-in and no change by a person since.

| Given | Then |
|---|---|
| G-12 carried into 2027, untouched | True: 2.11's line |
| After Rhea saves its plan | False |
| A goal made by hand in 2027 | False |

### Rule 12. Small ones

- `numberAsTyped(raw, unit)` in `numbers.ts`: section 3's table; returns `{ n }`, `{ problem: 'has-words' }` or `{ problem: 'not-number' }`. `parseNumber` stays for the places that have no unit.
- `lateShare(plan, weeks)` in `plan.ts`: the share of the plan's whole change that falls in its last quarter of weeks (rounded up), from 0 to 1.
- `mayBeNegative(unit, values)` in `numbers.ts`: true when `usuallyPositive(unit)` is false, or any value given is already below zero; the phone's number fields then use the full number keyboard.

| Given | Then |
|---|---|
| A steady plan, 7 weeks | About 0.29 |
| From 10: 10, 10, 10, 10, 9, 8, then 5 | 0.8 (the last 2 of 7 weeks) |
| `mayBeNegative('%', [10, 5])` | False |
| `mayBeNegative('net change', [])` | True |

### Rule 13. Years and weeks: `src/domain/weeks.ts` (new)

The data is unchanged: `MetricPlan.fromWeek`, `MetricPlan.endWeek` and `Stage.dueWeek` stay whole numbers counted from the cycle's start (week 0 is the week before week 1). These functions convert; they read a `Cycle`'s `startDate` and `weeks` and nothing else, and use `year.ts`'s `goalYear` and `yearWeeks`.

- `yearWeek(cycle, n)` → `{ year, week, monday }`: for 1 ≤ n ≤ `cycle.weeks`, the cycle's year and n. For n > `cycle.weeks`, the next goal year and n − `cycle.weeks` (and so on, using that year's own length). For n ≤ 0, the previous goal year: week `P + n`, where `P` is its length. A goal year's `year` is the calendar year of its week 1's Thursday; in a goal year that starts in January, `year` and `week` are the ISO week date.
- `cycleWeek(cycle, { year, week })` → n, the inverse; `null` when that year has no such week.
- `weekCode(cycle, n)` → `"2026-W46"`. `readWeekCode(cycle, raw)` reads `2026-W46`, `2026W46`, `2026-46`, `W46` and `46` (the last two in the cycle's own year, as today's numbers are) → n, or the problem `week-unknown`.
- `readWeek(cycle, week, raw, shownYear)` for the picker's text field: a number is that week of the year shown; "14 Dec", "14/12" or "14 December 2026" is the week holding that day (the next such day when no year is typed); "2027 5" is week 5 of 2027.
- `weekSays(cycle, n, form)`: `'field'` "Week 46 · 9–15 Nov 2026"; `'row'` "Week 46 · 9–15 Nov"; `'sentence'` "week 46 (9–15 Nov 2026)" in the cycle's own goal year and "week 13 of 2027 (29 Mar–4 Apr 2027)" in another. It replaces the bare uses of `weekDates`, which keeps its job of formatting the days.
- `weekIs(cycle, n, week)`: 2.13's one line.
- `weekChoices(cycle, week, field, from?)` → `{ named, years: { year, weeks: n[] }[] }`: 2.13's lists and limits. The furthest week is the last of the next goal year (`cycle.weeks + yearWeeks(next)`); `changeset.ts:421`'s limit of 104 becomes this.
- `spanSays(cycle, from, to, week)`: 2.4's line.
- `notStarted(goal, week)` in `plan.ts`: a number goal whose `fromWeek` is after `week`. Where it is true, the goal is not due for a check-in and not late (the rhythm's rule consults it), and its summary line gains "· starts week {n}".
- `nextCycle` (`cycle.ts:133`): a number goal that restarts from its last number takes `fromWeek: 0` in the new cycle. (Today it keeps the old `fromWeek`; read from the code, to be confirmed by this rule's first test.)

| Given (cycle 2026: starts Monday 22 Dec 2025, 53 weeks; today Wed 11 Nov 2026, week 46) | Then |
|---|---|
| `yearWeek(46)` | 2026, week 46, Monday 9 Nov 2026; "Week 46 · 9–15 Nov 2026"; `2026-W46` |
| `yearWeek(53)` | 2026, week 53; "Week 53 · 28 Dec 2026–3 Jan 2027"; `2026-W53` |
| `yearWeek(54)` | 2027, week 1; "Week 1 · 4–10 Jan 2027"; `2027-W01` |
| `yearWeek(66)` | 2027, week 13; in a sentence "week 13 of 2027 (29 Mar–4 Apr 2027)" |
| `yearWeek(105)` | 2027, week 52 (27 Dec 2027–2 Jan 2028): the furthest To |
| `yearWeek(1)` | 2026, week 1; "Week 1 · 29 Dec 2025–4 Jan 2026" |
| `yearWeek(0)` | 2025, week 52 (22–28 Dec 2025); `2025-W52` |
| `yearWeek(-12)` | 2025, week 40 (29 Sep–5 Oct 2025) |
| `cycleWeek({ 2027, 13 })` | 66 |
| `cycleWeek({ 2027, 53 })` | null: "2027 has 52 weeks. Use 2027-W52, or 2028-W01." |
| `readWeekCode("2026-W46")`, `("46")`, `("W46")` | 46 |
| `readWeekCode("2027-W01")` | 54 |
| `readWeek("14 Dec")` | 51 (14–20 Dec 2026) |
| `readWeek("3 Jan")` | 53 (the next 3 January is in week 53 of 2026) |
| `readWeek("5")` with 2027 shown | 58 |
| A goal year starting in April (week 1 holds April's first Thursday) | `year` is that April's; week 40 is the fortieth of that year, not ISO week 40; the code is still `{year}-W40`, and the README sheet says weeks are the goal year's |
| `weekChoices` for To, From 46 | Named: "The end of 2026" (53), "The end of Q1 2027" (66), "The end of 2027" (105). 2026: 47 to 53. 2027: 54 to 105 |
| `weekChoices` for To in week 30, From 30 | Named: "The end of this quarter" (39), "The end of 2026" (53), "The end of Q1 2027" (66) |
| `weekChoices` for From | Named: "This week" (46), "The start of this quarter" (40), "The start of 2026" (1). 2025: −51 to 0. 2026: 1 to 53. 2027: 54 to 105 |
| `spanSays(46, 66)` | "20 weeks. It runs past the end of 2026 and carries into 2027 with this plan." |
| `spanSays(50, 53)` in week 46 | "3 weeks. It starts in week 50 (7–13 Dec 2026). Until then nothing is due, and it reads “No check-in yet · starts week 50”." |
| Baseline 42, target 30, From 40, To 66, week 46 | `from-past`: "Week 40 was 6 weeks ago. Has this been running since then? The plan would expect 39 min by this week." |
| The same, answered "No, start from this week" | From 46 |
| From −12 | `from-past`: "Week 40 of 2025 was 58 weeks ago. …" |
| From 30, To 93 (week 40 of 2027) | `long-plan`: "This plan runs 63 weeks, to week 40 of 2027. Is that right?" |
| A file: From `2026-W46`, To `2026-W40` | `to-before-from`: "To (week 40, 28 Sep–4 Oct 2026) isn’t after From (week 46, 9–15 Nov 2026). The plan has to run forwards." |
| A file from an old export: Plan from week 46, Due week 53, no From or To | Loads as today |
| An export loaded back unchanged | "Nothing would change" |
| A goal set up in week 46 of 2026 at 42, last number 36, carried into 2027 | Baseline 36, From week 0 of 2027 (week 53 of 2026), To the end of 2027 |

### Rule 14. Proposed: `src/domain/proposed.ts` (new)

- **Data.** `Goal` gains `proposedAt?: string | null` and `proposedBy?: Id | null` (section 12's migration). Set: the goal is proposed. Cleared (with `activatedAt` not kept: the change log has it): active.
- `isProposed(goal)`: `!!goal.proposedAt && !goal.removedAt && !goal.stoppedAt`.
- `judged(goals)`: those neither proposed nor stopped. **Every rule that leaves a stopped goal out of being judged leaves a proposed one out the same way**: the build finds each by `stoppedAt` (stats, attention, Home, the check-in queue, reviews' goals, the wrap-up, the streak, the metric module's comparison) and uses `judged`. A lint beside the others: `stoppedAt` is read in `src/domain` only inside `judged`, `isProposed`'s file and `removal.ts`.
- `goalStatus` is not called for a proposed goal. `GoalSummary` gains `state: 'active' | 'proposed' | 'stopped'`; for `'proposed'` its `statusLabel` is "Proposed" and its status, gap, forecast and story are null. `DisplayStatus` gains nothing.
- `goalCounts(goals)` → `{ active, proposed }`, and `countLine` (the find spec's rule 2) appends "{n} proposed" when it is above 0.
- `proposedMustFix(draft, ctx)`: rule 2 with the type's own required fields optional. A goal proposed with none of them is stored as dated stages with no stages; `measureUnsaid(goal)` is true for a proposed goal in that shape and every screen says "How it’s measured isn’t said yet." (No column says a type is unknown, and none is added; to be checked: that `okr_goals` has no constraint requiring a stage.) The type may change while proposed.
- `readyToActivate(goal, ctx)`: rule 2's full list is empty.
- `mayActivate(actor, goal)`: `mayChangeGoal` (the owner, or an admin). `mayChangeGoal` is also true for `goal.proposedBy` while `isProposed(goal)`.
- `activate(x, { goalId, fromWeek? })` → the commit: `proposedAt` and `proposedBy` cleared; a number goal's `fromWeek` set to `fromWeek ?? week` (and its plan's hand-set weeks dropped if they fall before it); the change "Made it active, from week {n}", with `undo` holding the goal as it was. Refused unless `mayActivate` and `readyToActivate`.
- `backToProposed(x, goalId)`: allowed for `mayChangeGoal` when the goal has no check-in; sets `proposedAt` to now and `proposedBy` to the actor.
- `withdraw(x, goalId)` is `deleteGoal` (the goal has no check-ins), allowed for `mayChangeGoal`; its change's summary is "Withdrew the proposal “{goal}”".
- `proposalAsks(goals, viewer, week, seen)` → Home's rows: `for-you` (proposed by someone else, owner is the viewer, not yet opened) and `stale` (proposed `PROPOSED_ASK_WEEKS` = 8 weeks ago or more, viewer may activate, not put off). `seen` is from `Prefs`.
- The carry (`carryOf`, cycle end's rule 5): a proposed goal is "carry", copied with `proposedAt` and `proposedBy` kept.
- `planChanges`: a Goals row's State sets or clears `proposedAt` by the same rules (`state-has-check-ins`; making active through a file needs `readyToActivate`, else Must fix "“{goal}” can’t be made active yet: {what is missing}."). Check-ins rows for a proposed goal are Must fix.

| Given (week 46, weekly, due Thursday) | Then |
|---|---|
| Tunde proposes "Signed artifacts in staging", 40% → 90%, From 46, To 53 | Saved with a key (G-132), `proposedAt` set; its row reads "Proposed"; `goalStatus` isn't run |
| Goals, Mine, as Tunde, who has 2 active goals | "2 goals, worst first. 1 proposed" |
| The workspace's health line and Needs attention | Unchanged by it |
| Check-in queue; Thursday's "due" | It isn't there |
| 14 days later | Still "Proposed": never "No recent update" |
| Amara, in a review, proposes "Data-backed environments ready in under an hour" for Camille, feeding G-5, with nothing else | Saved as G-131, proposed by Amara; `measureUnsaid` true; Camille's Home: "Amara proposed a goal for you in Platform leadership weekly: “Data-backed environments ready in under an hour”." |
| Camille opens G-131 | The button is "Finish it" (`readyToActivate` false) |
| Amara opens it | "Change it" and "Withdraw it", no primary; "Camille Laurent or an admin can make this active." |
| Oskar opens it | Comment, ask, watch; the same line |
| Tunde makes G-132 active in week 48 | From becomes 48: "From 40% in week 48 (23–29 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027): 5 weeks, not the 7 you proposed. Its first check-in is due by Thursday 26 Nov, then every week." Its status is then "No check-in yet" |
| The same, choosing From 46 | `from-past` is asked |
| Undo, a minute later | Proposed again, From 46 |
| Tunde posts a check-in, then tries "Make it proposed again" | Not offered; a file's State `proposed`: `state-has-check-ins` |
| A goal proposed 9 weeks ago, its owner's Home | "“Rollback rehearsed for every tier-1 service” has been proposed for 9 weeks. Make it active, or withdraw it." |
| Tunde, not an admin, publishes a goal owned by Amara as active | Allowed (Lane, 11 Nov); the last step started on "Not yet: propose it" and he changed it |
| A file with 3 new goals for other people and no State | `for-someone-else`, once: "3 of these goals are for other people and would start as active. Is that what you mean?" |
| 2026 ends with G-131 still proposed | It carries into 2027 as proposed; the start page says "1 proposed goal carries as proposed" |
| An export, loaded back unchanged | "Nothing would change" (State is written for every goal) |

## 7. Extension points

No new extension point.

- `goal.measure` (exists): its `onChange(pick)` value gains `direction: 'lower' | 'higher' | null` and `latest: { value, week, key } | null` for the chosen slice, so rule 3 can ask `wrong-side` and `far-from-metric` without the core reading the metric module's records. On the edit page it also gives its "What will change" sentence as the optional second value OB1 added for Check's words.
- Reviews are not yet a module (`docs/architecture.md`); `reviewsJoining` lives beside `goalsIn` and is gated by the Reviews switch (FT). When reviews move out of the core it moves with them and the read-back's line becomes a `goal.facts` contribution.
- The drafts use the `Prefs` port as it is.

## 8. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U93 | GOAL-ENTRY-REQUIRED | A goal says what it needs: as Tunde, New goal; the measure step says "Everything here is needed unless it says optional." and Unit is empty; "Continue" with Unit empty and Target "30 mins" puts each Must fix under its field and "2 things to fix above: Unit and Target." above the button, focus on Unit; fixed, the decimals line reads "Kept as whole numbers, as you typed them."; 50 → 150 % asks the over-100 question and "Continue" waits ("Answer the question above, under Target."); answered, it goes on, and going back shows "You said 150% is right."; changing 150 to 160 asks again. Dated stages: two called "Design" and one with no week each get their own line. Choosing Amara as owner says "Amara will own it. After it is published, only Amara or an admin can change it." and the goal can be published. The same faults typed into a Goals row on Data and sent to `create_goal` return the same words |
| U94 | GOAL-ENTRY-REQUIRED, RHYTHM-OPTIONAL | Read back before it's saved: the Check step shows What, Who and where, Left as usual and You said as sentences; "After you publish" names Thursday 12 Nov and "the plan says 47% for week 47"; "Change" on Left as usual goes to the measure step and "Continue" returns; publishing lands on the goal with `?published=1`, and its History's first entry lists the answer under "Checked". With the rhythm off (FT) the step has no weekday and reads "Nothing is due."; with Reviews off there is no review line |
| U95 | GOAL-EDIT-PREVIEW | A change says what it does: as Rhea on "Pipeline queue wait (p90)" the type line says why it can't change; changing the target shows "What will change" with the status clause and asks "Why is the plan changing?"; saving without a reason is a Must fix; handing it to Tunde adds the owner sentence, the team question and "A note for Tunde"; "Save 2 changes"; the toast's Undo puts both back and History shows both lines; saved again, Rhea sees the read view with "Tunde Bakare or an admin can change this." and no button; as Oskar the same. Unit min → hours says the numbers aren't converted. An unsaved edit, then the target changed as Grace, reopens with "Grace changed this goal…" |
| U96 | GOAL-ADD-ANYWHERE | A goal starts where the thought does: "Add a goal that feeds this" under Lead time for changes opens step 1 with "It will feed … as an SVP goal in CI/CD, owned by you."; a team's page has "Add a goal for Build & Release" for its members; "Duplicate as a new goal" copies the type and unit and leaves the name and numbers empty; "Adding several?" opens the import's paste door. As Amara in a review's walk, "Agree a new goal" with a name, Camille and week 48 records "Set up a goal: …"; as Camille, Home shows it with "Set up the goal", which opens New goal filled in; publishing marks it done "Set up as G-…"; the review's "Last time" says so. Two goals left unpublished are both listed on New goal and named under Goals, Mine, with "kept until"; "Close and keep the draft" says where it went; a sixth is refused. With Reviews off the walk's choice is absent |

| (next free; see below) | GOAL-DATES, FIND-AND-PICK | Dates are picked and people are found: as Tunde on the measure step, Baseline and Target each sit beside a week, "Week 46 · 9–15 Nov 2026 · This week" and "Week 53 · 28 Dec 2026–3 Jan 2027 · The end of 2026"; opening To lists the three named weeks, then 2026 from week 47 and 2027; choosing "The end of Q1 2027" closes it as "Week 13 · 29 Mar–4 Apr 2027" and the line says it carries into 2027; typing "14 Dec" moves to week 51; the keyboard alone can choose a week. From set to week 40 asks whether it has been running; "No, start from this week" puts it back. Check reads "from 42 min in week 46 (9–15 Nov 2026) to 30 min by week 13 of 2027 (29 Mar–4 Apr 2027)". The goal's page and an export say the same weeks (`2026-W46`, `2027-W13`), and the export loads back as "Nothing would change". A stage's Due is the same picker. No number field for a week exists on any step or on the edit page. On the who step and the edit page Owner, Team, Feeds into and Also helps open find-and-pick with suggestions, "tun" finds Tunde, "g-41" finds a goal by its key; no `select` lists people, teams, goals or metrics anywhere in New goal, the edit page, "Agree a new goal" or set-up's cards |

| U134 | GOAL-PROPOSED | Proposed, then active: as Tunde, New goal's last step asks "Is it under way?"; "Not yet: propose it" turns the button to "Propose goal" and the block to "After you propose it"; the goal has a key and a page that says "Proposed" as a word with no status shape; Goals, Mine reads "2 goals, worst first. 1 proposed" and the link filters to it; it is not in Check-in, not in Needs attention, not in the health counts, and a fortnight later (the demo's clock moved) still says "Proposed". As Oskar its page has comment, ask and watch and "Tunde Bakare or an admin can make this active." As Tunde, "Change it" saves a new target with no reason asked; "Make it active" reads back From as this week with the first check-in's date; after it the page offers "Post the first check-in" and History says "made it active"; Undo returns it to proposed. As Tunde choosing Amara as owner, the question starts on "Not yet". As Amara in a review, "Propose a new goal" for Camille saves one with only a name; Camille's Home shows the proposal and her button is "Finish it". "Withdraw it" removes one, with Undo. An export has State; loaded back, nothing would change |

Round 2 gave goal entry U93 to U96; the dates journey is U109 (round 2, Part 2), and U134 is the next free after round 3's.

**Changed:** U2, U3, U84 (New goal: the unit, the levels, the read-back, the drafts list); U85 (the past-stage question is the shared block); the goal-edit journeys (the button's words; the reason's place); U5, U17, U86 (set-up's cards' words); the MCP journeys that read "Fix these and try again".

### F and N checks

| # | Check |
|---|---|
| F18 | Phone, 390 × 844 and 360 × 800: on each step of New goal and on the edit page, the first field and the primary button are on the first screen with the keyboard closed, and the "things to fix" line is visible above the button without scrolling; a question's answers are each at least 44 px high and full width; the read-back and "What will change" don't scroll sideways; "Save {n} changes" never covers a field; no step is taller than two screens; number fields have `inputmode="decimal"`, or the full number keyboard where rule 12's `mayBeNegative` is true |
| N19 | One check at every door: for every worked example of rules 2 and 3, the form (`planGoal`), a Goals row through `planChanges`, set-up's card and `create_goal` give the same level and the same words; no goal can be saved by `app.saveGoal` that `planChanges` would refuse (the form's commit goes through the `saveGoal` action); and with 30,000 goals `goalChecks` reads at most the same-named goals the finder returns, never the whole list |
| N12 (the pickers lint) | `scripts/pickers-left.json` loses `GoalWizard.tsx`, `GoalEdit.tsx` and `Onboarding.tsx` when FS1's second part lands; GE5 and GE6 add no entry. A new lint beside it: no `input` whose label or `aria-label` contains "week" takes a typed number in `src/screens` or `src/ui` outside `WeekPick.tsx` |
| N29 | A proposed goal is judged nowhere: with one proposed goal added to the demo, every count, health line, attention list, Home lead, check-in queue, review agenda, wrap-up list, streak and metric comparison is identical to the same workspace without it, on every day of two weeks; and no screen draws a status shape beside the word "Proposed" |
| P3, P4, P6 | Extended to the Must fix line, the Check block, the read-back, "What will change" and the drafts list: flat, no capsules, no edge stripes; neither level uses a status shape; the warning mark is the app's own, 14 px |

### Unit tests

One file per rule with every worked example. `roundtrip.test.ts` gains: a goal made by the form, exported and loaded back, reads "Nothing would change" (decimals worked out the same way by both).

### Requirements (`evals/requirements.json`)

- `GOAL-ENTRY-REQUIRED`: "Every way of adding a goal says what it needs before it is refused, checks it with one rule, and asks rather than assumes where a value is possible but unlikely; nothing is saved before it has been read back."
- `GOAL-EDIT-PREVIEW`: "Changing a goal shows, before it is saved, what will change and what that does to its status, history and who may act; it can be undone; a person who may not change it is told who can."
- `GOAL-ADD-ANYWHERE`: "A goal can be started from the goal it feeds, a team, a copy of another goal or a review, always in the same form with what is known filled in; a goal agreed in a review is a next step until its owner sets it up; unfinished goals are listed and kept."

- `GOAL-PROPOSED`: "A goal can be proposed before anyone is held to it: it is visible and can be discussed, has no status and nothing due, is counted apart from active goals, and becomes active only by a deliberate act of its owner or an admin."
- `GOAL-DATES`: "A goal's weeks are chosen, not typed, and are always shown with their dates and year: the baseline's week (From) and the week the target is due (To) are named the same on every screen, in the sheet and by the tools."

Reworded: `NEW-GOAL-STEPS` (the Check step is the read-back), `NAV-FORMS` ("Close" with nothing typed).

## 9. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `goals-new` | What a goal needs, by type (made from the field table); Must fix and Check; the read-back; starting from a parent, a team or a copy; drafts; asking someone to set one up |
| `goal-proposed` (new; route `/goals/:goalId` for a proposed goal, and the last step of `goals-new`) | What proposed means; who makes it active and what that starts; changing and withdrawing; where proposed goals are listed |
| `goal-edit` | What will change; the reason; what can't change and why; Undo; who may |
| `reviews` | "Agree a new goal", and what its owner then sees |
| `home` | A goal you were asked to set up |
| `mcp` (and `docs/mcp.md`) | "Must fix" and "Check" in the tools' answers; `confirm` |
| `setup` | The cards' words and questions |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| GE1 | `goal-needs-said` | "New goal says what it needs" | "Each step says what is needed and marks what is optional." "A problem shows under its field as you leave it, and is counted by the button." "The unit is yours to give: it no longer starts as %." |
| GE2 | `goal-questions` | "Unlikely values are asked about, once" | "Over 100%, below zero, an owner in another team: New goal asks, and remembers your answer." "Spreadsheets and assistants are asked the same questions." |
| GE3 | `goal-read-back` | "Read your goal back before it's published" | "The last step says, in sentences, what you typed and what was left as usual." "It says when the first check-in is due and how long you can still delete it." |
| GE4 | `goal-edit-preview` | "See what a change will do" | "Changing a goal lists what will change and what that does to its status and history." "Handing a goal over says who can change it afterwards, and can be undone." "Unit and decimals can be changed there." |
| GE5 | `goal-from-here` | "Add a goal from where you are" | "Under a goal: Add a goal that feeds this." "On a team's page, or as a copy of a goal you have." |
| GE6 | `goal-agreed` | "Agree a goal in a review" | "Name it and its owner in the room; they set it up afterwards." "You can also ask someone to set up a goal from New goal." |
| GE7 | `goal-drafts` | "Unfinished goals are kept and listed" | "Up to five, for 30 days, under Goals, Mine and on New goal." |
| GE9 | `goal-dates-picked` | "Pick a goal's weeks, with their dates" | "A number goal now says its baseline, From and To." "Choose each week from a list that shows its dates and year: this year or next." "Spreadsheets write weeks as 2026-W46; old files still load." |
| GE10 | `goal-proposed` | "Propose a goal before it starts" | "New goal’s last step asks whether the goal is under way. If not, propose it: everyone can see it, and nothing is due." "Its owner or an admin makes it active when it is agreed." "Proposed goals are counted apart, and listed under Goals with the Proposed filter." |
| GE8 | `goal-carried` | "A carried goal says what was assumed" | "After a new cycle starts, each carried goal says where it starts and asks you to check its dates." |

## 10. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | (b) A real unpublished goal | Rule 9 and the prefix go. `Goal` gains `proposed: { by, at } | null`; a migration adds the column in `faro` (written for `faro_owner`, with its grants, per `supabase/README.md`); every list, count, status rule and export must leave proposed goals out or label them; "Agree it" creates the goal with a name, owner and parent only, exempt from rule 2's type fields until "Set up". About an M item more, and it should be designed with R6c |
| 1 | (c) New goal inside the review | 2.8's block is replaced by a link "Add a goal now" → `/goals/new?parent=<goal>&review=<id>`, returning to the walk; rule 9 goes |
| 2, 8 | Settled by Lane on 11 Nov (round 2's decision 11, answer (c)): anyone may set any level and any owner | Nothing to build beyond removing `changeset.ts:385`; `level-up` and "Ask {name}" are not built |
| 3 | (b) Must fix | `feeds-lower` becomes a Must fix in rule 2: "{A north star} can’t feed “{parent}”, a {Team} goal. Choose a goal at a higher level, or nothing."; the picker shows such goals as not selectable (OB1's wording). Existing links are left as they are and questioned on the edit page |
| 3 | (c) Nothing | `feeds-lower` goes |
| 4 | (b) Optional, asked once | `unit-empty` becomes a Check: "No unit. Is this a plain count, like 12?" → "Yes, a plain count" / "No, I’ll add one" |
| 4 | (c) As today | The unit starts as "%"; "Left as usual" must then say "Counted in %." so the default is at least said |
| 5 | (b) Must fix | `same-name` becomes a Must fix at every door, in the import's words (`changeset.ts:376`) with the link to the other goal |
| 5 | (c) As today | `same-name` goes; the form keeps OB1's note and the import its refusal (N19 lists this as a known difference) |
| 6 | (b) A reason | `needsReason` is also true when the owner changes; the field reads "Why is it changing hands?" |
| 6 | (c) Accept first | Spec only: not built in Faro |
| 6 | No Undo for a hand-over | `undoGoalEdit` refuses when the owner changed and the actor is no longer the owner or an admin; the toast for such a save has no Undo and "What will change" adds "This can’t be undone by you." |
| 7 | (b) One draft, listed | Rule 10's limit is 1; "Or start a new one" asks "Discard “{name}”?" first; the rest stands |
| 7 | (c) As today | 2.9 and rule 10 are dropped except the patch for edits and the toast after closing |
| 9 | (b) Not kept | The "Checked" diffs are left out of the change |
| 10 | (b) Two dates | `MetricPlan` gains `baselineWeek?: number` (whether that is a migration depends on how a plan is stored; not checked here); the measure step gains "Baseline as of" as a third picker; `planAt` holds the baseline flat from `baselineWeek` to `fromWeek`; `from-past` is asked of the baseline's week instead |
| 11 | (b) Stages next year | The stage picker offers next year; `validateGoal`'s limit (`goal.ts:104`) becomes rule 13's furthest week; `nextCycle` moves a stage with a week in the new cycle to that week and spreads only those without one; the quarter results ignore stages beyond the cycle (they do: they filter by quarter) |
| 12 | (b) A range's "Applies from" | `RangePlan` gains `fromWeek?: number`; the range step gains the picker; status ignores numbers before it. A data change |
| 13 | (b) Dates | From and To hold the week's Monday (`2026-11-09`); `readWeekCode` also reads a date. (c) No new columns: rule 13's `weekCode` is used on screens only and row 15 of the README's rules table is dropped |
| 15 | Keep Lane's 11 Nov answer (a next step) | 2.8 and rule 9 are built as written; 2.15's Reviews row and `for-you` in a review are dropped; the drafts list keeps its "asked you to set this up" row; wireframe 5 goes back to the next step |
| 16 | A goal for someone else starts active, like any other | The last step's question always starts on Yes; `for-someone-else` is dropped |
| 16 | A goal for someone else must be proposed | The Yes choice is absent when the owner is someone else and the viewer isn't an admin. This is a rule against Lane's 11 Nov answer; not recommended |
| 17 | The owner of the goal it feeds, or a team's lead, may also make it active | `mayActivate` gains them; R1 gains a row. New rights |
| 18 | A workspace setting | "How you work" gains the row **New goals**: "A new goal starts as active or proposed, as its author chooses." / "New goals start as proposed; their owner or an admin makes them active." with "Change" (`/workspace/features/new-goals`; `Cycle.newGoals: 'either' \| 'proposed'`, one more column in the settings migration; the read-back before saving: "From now, a new goal starts as proposed. The {n} active goals stay active."). With it set, the last step has no question and the button is "Propose goal" |
| 19 | The proposer may not change or withdraw | `mayChangeGoal` loses its proposed clause; the proposer's page is everyone else's |
| — | No migration | `proposedAt` and `proposedBy` are kept in the unused `pending` column (jsonb, `types.ts:104`) as `{ kind: 'goal', byId, at }`. Two traps then need fixing first: the edit page writes `pending: null` on every save (`GoalEdit.tsx:89`) and the carry does too (`cycle.ts:123`), either of which would make a proposed goal active without a word |
| 14 | (b) "Planned" | A sixth status word and shape: the design rules, the vocabulary, the status rules, every list's counts and the sheet's words all change. Not recommended |

## 11. Build plan

Backlog-sized items. Effort: **S** (under a day), **M** (a release), **S–M** between. Each is one PR with its spec section, conformance rows, evals, Help and What's new.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| GE1 | **The form and the engine run one set of rules, and say what a goal needs** (the doors agree on Lane's rule: anyone may add a goal for anyone at any level, so the engine's refusal at `changeset.ts:385` goes and the form's freedom stays; changing a goal stays with its owner and admins) | Rules 1, 2, 4, 7 (`goalRights`, `planGoal`, the `saveGoal` action; not Undo), 12's `numberAsTyped`; 2.1 items 1, 2 and 4; the unit and decimals of 2.4; the stage rows' own errors; `planChanges` and set-up's cards call rule 2 (2.10's words); 2.12's "Must fix"; U93 (its Must fix half), N19 | S–M | Nothing in round 1: it can be built on today's step order. IM1 for the table's home (until then the values sit in `goalEntry.ts`); to be agreed with IM before it merges, since it changes what a file's row is refused for |
| GE2 | **Questions in place** | Rule 3; 2.1 item 3; section 4's Checks; answers in the draft and in History; `planChanges` and the tools carry every question | S–M | GE1. OB2 (#103) for `stage-past`, which becomes the shared block (merge OB2 first). IM2 (the import's levels) for the preview's side. `wrong-side` and `far-from-metric` wait for ML2 |
| GE3 | **The read-back** | Rule 5; 2.5; `reviewsJoining`; U94 | S | GE1, GE2. OB1 for the steps' addresses ("Change" goes to them; without OB1 it sets the step as today). FT for the rhythm and Reviews switches (until then: weekly, and on) |
| GE4 | **Change a goal: what will change, and Undo** | Rule 6, rule 7's `undoGoalEdit`, rule 10's patch; 2.6 whole; U95 | M | GT3's edit page (sections, one exit); FS1's pickers in GoalEdit; GE1, GE2 |
| GE5 | **Add a goal from where you are** | Rule 8; 2.1 item 5; 2.2 item 7; 2.7; the first half of U96 | S–M | OB1 (the who step and its level rule); GE1. WR1 (merged) for the team's page; GT1 (merged) for "What feeds it". The import's paste door for "Adding several?" (until then the link goes to `/data/import`) |
| GE6 | **Agree a goal in a review** (as Lane chose on 11 Nov: a next step. If he takes README decision 15, this becomes part of GE10 and rule 9 is not built) | Rule 9; 2.8; the review half of U96 | S–M | GE5 (`?from=`); FS1 (the pickers); GT1 (merged: "Next steps and asks"); FT1 (Reviews off) |
| GE7 | **Several drafts, listed** | Rule 10; 2.1 item 6; 2.9; the drafts half of U96 | S–M | OB1 (steps in the address); AR1's `Prefs` port (merged); NV2 (one exit) |
| GE8 | **A carried goal says what was assumed** | Rule 11; 2.11 | S | GE4 (the link's target); OB2 (the re-base it leans on) |

| GE9 | **The three dates, picked** | Rule 13 (`weeks.ts`, `notStarted`, the carry fix); 2.13's `WeekPick`; "Baseline, From, Target, To" on the measure step and the edit page; a stage's Due; `from-past`, `to-past`, `long-plan` and the three date Must fixes; the read-back's and the goal page's sentences; the sheet's From and To columns and the tools' `from` and `to`; the fifth journey; `GOAL-DATES` | M | GE1 and GE2 (the levels). OB1 (it replaces OB1's "By when?" and its stage select, so build after OB1 or as part of it). OB2 (the past-stage question it sits beside). IM1 for the two new columns. FT for "nothing due" where the rhythm is on |

| GE10 | **Proposed, not yet active** | 2.15; rule 14 (`proposed.ts`, `judged` and its lint, `activate`, `backToProposed`, `proposalAsks`); the migration (section 12); the last step's question; the proposed page; "Make it active"; Goals' count line and State filter; State in the sheet and the tools; U134, N29; `GOAL-PROPOSED` | M | GE1 (one way to save), GE3 (the read-back it extends), GE9 (From at activation). GL1 and FS2 (merged: the count line and filter line). IM1 (the State column). Cycle end's CY4 for the carry (before it, a proposed goal is carried by `nextCycle` with its two fields kept). Home's HM items for the two rows (before them, "Needs your response" as built) |

**What GE10 moves.** GE3: the last step gains "Is it under way?". GE4: the edit page's proposed mode (no reason, no status clauses, the type can change). GE5: unchanged. GE6: if decision 15 is taken it shrinks to S and is built inside GE10 ("Propose a new goal" in the walk; rule 9, `?from=` and "Set up the goal" are not built). GE7: the drafts list holds drafts only. GE9: `activate` sets From; `notStarted` is unchanged and separate. GE8: its line also covers "carried as proposed".

**Find-and-pick.** No new item: it is FS1's second part (track 1's held work: the pickers in GoalWizard, GoalEdit, set-up's owners and who takes over). **GE1, GE4, GE5 and GE6 need it**: GE1's who step (the owner's line hangs off the owner's picker), GE4's Owner, Team, Feeds into and Also helps, GE5's "Copy from a goal", GE6's two choices in a review. Each passes its `context` to `suggest` (2.14) and adds no select. GE1's other parts (the rights, what is needed, the numbers) do not wait for it.

**Order:** FS1's second part and OB2 → GE1 → GE2 → OB1 → GE9 → GE3 → GE10 → GE5 → GE7, with GT3's edit page → GE4 → GE8 beside them once GE2 is in, and GE6 after GE5. GE1 is first because it closes E1, which lets anyone publish a north star for anyone today; it is also the smallest.

**About seven releases:** four M-sized (GE4, GE9, GE10, and GE1 with GE2 together), the rest S or S–M.

**This replaces** nothing in round 1's plan; it adds to the "one goal" track after OB1 and GT3. **For the rebuild kit:** GE1's stage notes say the form, the file and the tools share `goalMustFix` and `goalChecks`, and that these belong in stage 1's conformance data beside the status rules; GE6's say "Agree a new goal" is the seed of R6c's draft-and-propose and should not be copied as a text prefix.

## 12. The migration (GE10 only)

One file, `supabase/migrations/0040_goal_proposed.sql` (or the next free number: cycle end names 0038 and the settings 0039). Every other item in this spec needs none. Read `supabase/README.md` first: it runs as `faro_owner` with `search_path` faro, so plain names land in `faro`.

```sql
-- A goal that is proposed, not yet active (goal entry GE10). Null: active.
alter table okr_goals add column if not exists proposed_at timestamptz;
alter table okr_goals add column if not exists proposed_by text;

-- Proposed and stopped never hold together; a proposer is named with the time.
alter table okr_goals drop constraint if exists okr_goals_proposed_ok;
alter table okr_goals add constraint okr_goals_proposed_ok
  check ((proposed_at is null or stopped_at is null) and (proposed_by is null or proposed_at is not null));
```

- **Safe to run twice** (`if not exists`; the constraint is dropped and added again); one transaction.
- **No grant** is written because none is needed: the columns are on a table whose grants and row rules already cover every column. No new table, function or policy.
- **No redirect**: `public`'s views of `okr_goals` are fixed `select *` views from 0035 and won't show the columns, so GE10 ships only where the app reads through `faro` (it does since 0c; this must be merged after, or with, 0c2).
- `src/data/rows.ts` writes the two columns only when set (as it does `stopped_at`), so a database without them takes an active goal's row unchanged. `okr_upsert` takes its columns from the rows it is given (migration 0011), so the commit function needs no change; the settings spec makes the same check, and it should be made once for both.
- The archive (`okr_goals` rows of removed goals) needs nothing: a withdrawn proposal keeps `proposed_at`, and bringing it back returns it proposed.
- Not checked here: whether a constraint on `okr_goals` requires a milestone goal to have a stage (rule 14 stores a proposal with nothing measured as stages with none). If one does, this file relaxes it for rows where `proposed_at is not null`.

