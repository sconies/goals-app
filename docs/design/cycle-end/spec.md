# The end of a cycle: build spec

11 November 2026. For a build session. Nothing here is built. The evaluation, the findings (Y1 to Y17) and the wireframes are in [README.md](README.md). Rounds 1 and 2 stand; section 12 lists every place this changes them.

Words used here: "year" for a goal year and "cycle" for a shorter one, as `periodWord` gives them; the examples say "2026" and "2027". The example year is the demo's: 2026 has `startDate` 2025-12-22 (week 0) and 53 weeks, so week 1 is 29 Dec 2025–4 Jan 2026, week 52 is 21–27 Dec 2026 and week 53 is 28 Dec 2026–3 Jan 2027. 2027 has `startDate` 2026-12-28 and 52 weeks: week 1 is 4–10 Jan 2027, week 52 is 27 Dec 2027–2 Jan 2028.

## 1. Routes

| Route | Screen | Menu item lit |
|---|---|---|
| `/wrap-up` | The wrap-up: the list (2.1). `?scope=mine\|team\|all` | Home |
| `/wrap-up/<goalId or key>` | One goal's wrap-up (2.2), a form | Home |
| `/results` | Redirects to `/results/<the year whose wrap-up is open, else the latest ended year>`; with neither, to `/goals` | — |
| `/results/<year>` | The year's results (2.3). `?part=year\|q1\|q2\|q3\|q4` and the list bar's `q`, `result`, `level`, `team`, `owner`, `sort`, `from` | Goals |
| `/workspace/cycles/next` | Start the next year, with its read-back (2.4) | Workspace |
| `/workspace/cycles` | Cycles (2.5; the Workspace spec's 2.6, changed) | Workspace |
| `/goals?year=<year>` | Goals for another year (2.8) | Goals |
| `/goals/<id>` | A goal, whichever year it belongs to (2.6, 2.8) | Goals |
| `/goals/<key>?year=<year>` | That year's goal with that key | Goals |
| `/data?year=<year>`, `/data/import` | Data for another year (2.8); Import has no year | Data |

`<year>` in an address is the cycle's name with spaces as hyphens ("2026", "Apr-2026–Mar-2027"), read back by `cycleNamed(cycles, text)`; a cycle id is also accepted.

### Redirects

| From | To |
|---|---|
| `/retro` | `/wrap-up` |
| `/retro/<goalId>` | `/wrap-up/<goalId>` |
| `/goals?cycle=<id>` (the Workspace spec's wording) | `/goals?year=<name>` |
| `/wrap-up` when no wrap-up is open | `/results` (so a link from last month still lands on the record) |
| `/wrap-up/<goal>` when that goal's year is closed | `/goals/<id>` (its page as it ended) |
| `/workspace/cycles/next` when the next year exists | `/workspace/cycles` |

## 2. Screens

Every date carries its year. A week is shown with its dates through goal entry's `weekSays` (its rule 13); until that is built, `weekDates` with the year added. Nothing prints a bare week number.

### 2.1 The wrap-up: the list (`/wrap-up`)

Wireframe 1. A reading page, 880 px.

**Content, in order**

1. Back link: "Back to Home".
2. Title "Wrap up {year}". Under it, one of:
   - before the last day: "{year} ends on {last day}. For each goal, say whether the result is fair, what you learned, and whether it carries on. Open until {closing day}."
   - after it: "{year} ended on {last day}. … Open until {closing day}."
3. Primary action, top right, when the viewer has a goal to do: "Wrap up {goal}" (the first of "To wrap up") → `/wrap-up/<id>`. Otherwise none.
4. Tabs, each with its count, shown only when it differs from the one before:
   - "Mine {k} of {n} to do": goals the viewer owns in this year. Left out for someone who owns none.
   - "My team {k} of {n} to do": goals of the viewer's team, when the team has any the viewer doesn't own.
   - "Everyone {k} of {n} to do".
   A count with nothing left reads "{n} done".
5. "To wrap up · {k}", a hairline list, in `wrapUpOrder` (rule 8): final number missing first, then not met, then met, each by level then name. A row:
   - first: the result in its words (`RESULT`'s labels, small capitals in the status colour, no capsule); or the warning mark and "Final number?" when rule 8's `finalNumberCheck` applies; or "Not finished yet" in muted type;
   - the goal's name; under it "{key} · {level, when above team} · {one line}", the line from rule 8's `resultLine`;
   - on "My team" and "Everyone", the owner's name before the line;
   - the row's action: for the owner or an admin, "Wrap up"; for anyone else on "My team" or "Everyone", "Ask {first name}" (`askForUpdate`, existing; it becomes "Asked" for that session).
6. "Wrapped up · {k}": the same row, with at the right "You agreed" / "Your view: {word}" / "{Name} agreed" / "{Name}’s view: {word}", and for the owner or an admin "Change". The line ends "· carries on" / "· finished" / "· stops".
7. One sentence per goal with nothing to wrap up: "Nothing to wrap up: **{goal}** isn’t due until {week, sentence form}. It carries on with its plan."
8. "Everyone" only, above the list: "{n} of {total} wrapped up. See the results" → `/results/<year>`.

**Empty and error states**

- The wrap-up isn't open yet: title "Wrap up {year}", then "The wrap-up opens on {day}, {in k weeks | next week}. {year} ends on {last day}." No list, no action.
- The viewer owns no goal and has no team with goals: the page opens on "Everyone".
- Every goal is wrapped up: "To wrap up" is left out; under the title "Every goal is wrapped up. You can change what you said until {closing day}."
- The wrap-up is switched off (section 2.11): the route redirects to `/results`.

### 2.2 One goal's wrap-up (`/wrap-up/<goal>`)

Wireframe 2. A focused form, 620 px, with navigation's one exit: "Close and keep the draft" (the draft is kept as check-in drafts are, in `Prefs`).

**Head:** "Wrap up {year}" and "Goal {i} of {k}" (the viewer's own, in list order); the goal's name as the title; "{key} · {level} · {owner}, {team}".

**Content, in order.** Each part is an `h2`.

1. **The final number**, only when `finalNumberCheck` gives one (rule 8). A Check block (goal entry's, `role="status"`): the Check mark, then
   - a number or range goal: "The last number, {value}, is from {week, sentence form}. Is it still right at the end of the year?" · "Yes, {value} is the final number" · "Give the final number" (opens the check-in's number field in place: label "The final number", the unit beside it, the field table's number rules);
   - stages: "The last word on its stages is from {week}. Is {n} of {m} done still right?" · "Yes, {n} of {m} is final" · "Update the stages" (the check-in's stage list in place);
   - no number at all: "This goal has no number yet. What did it end on?" · the number field · "It never had one" (the result then reads "Not met: no number reported").
   - Under it: "The final number is saved as a check-in for {last week, sentence form}, and the result is worked out from it."
   Nothing below is shown until this is answered.
2. **"What the numbers say"**: a quiet panel with
   - the result in its words;
   - one sentence from `resultSays` (rule 8):
     - number: "{value} at the end of {year} ({last week with dates}), against a target of {target}. It {came down|went up} {moved} of the {planned} it set out to: {share}% of the way." (met: "{value} in {week}, against a target of {target} due {due week}.{ You called it done then.}")
     - range: "{value} at the end, {inside|outside} the {limit} limit."
     - stages: "{n} of {m} stages done. {Stage} was due {week} and isn’t done."
   - a year only: "Quarters: Q1 {met|not met|nothing due} · Q2 … · Q4 …. See the year" → the goal's page at its quarter strip.
3. **"Is that a fair account of the year?"** A radio group with nothing chosen: "Yes" · "Not the whole story" with the hint "The result stays “{result}”. Your view is shown beside it, with your reason."
   - With "Not the whole story": "Your view", three buttons, none pressed: "Hit it" · "Partly" · "Missed" (the vocabulary's `OWNER_VIEW`); then "Why the numbers don’t tell it", a text area.
4. **"What did you learn?"** A text area; placeholder "One thing worth knowing next time".
5. **"What happens to it in {next}?"** A radio group with nothing chosen. The choices come from `carryOf` (rule 5):
   - a goal that would carry: "Carry it on" with the hint `carrySays(goal)`: number: "From {final} to {target} by the end of {next} ({its last week with dates}). You can change the target and the date on its page{, from {first Monday}}." Stages: "Its {n} stage{s} not done, spread evenly over {next}. You can change the dates on its page." Range: "The same limit, {limit}, through {next}." · "Stop it here" with the hint "It stays in {year} with this result.{ Its {n} goal{s} below it lose their “Feeds into”.}"
   - a goal that met its target: "It’s finished" · "It stays in {year} as met. Nothing carries on." and "Set {next}’s goal from it" · "Opens New goal with its name, owner, team, metric and what it feeds, starting from {final} in week 1 of {next}. You give the new target."
   - When the next year already exists, the hints say what saving will do now: "Stop it here" → "It leaves {next}: its copy there has no check-ins and is removed." (or, when the copy has been used: "It already has check-ins in {next}. Stop it there instead." with a link, and the choice is not offered); "Carry it on" on a goal not in {next} → "It is added to {next} now."
6. Foot: "Back" (the goal before, or the list) and the primary action "Save and go to the next" ("Save" on the last, and when changing a saved one).

**After saving:** the next goal, or the list with a toast "Wrapped up {goal}." with Undo (while it is the latest change to that wrap-up). "Set {next}’s goal from it" saves the wrap-up as finished, then opens `/goals/new/measure?from=<id>&year=<next>` (goal entry's rule 8).

**Must fix** (rule 8's `wrapUpMustFix`; shown on "Save", the field outlined on every side):

| When | Words |
|---|---|
| Fair or not, not chosen | "Choose one. Faro doesn’t answer this for you." |
| "Not the whole story" with no view | "Say how you’d put it: hit it, partly or missed." |
| …with no reason, or under 10 characters | "Say why, in a sentence." |
| A view the same as the result would give | "That is what the numbers say too. Choose “Yes”, or a different view." |
| Learned empty or under 10 characters | "Write a sentence: one thing worth knowing next time." |
| What happens next, not chosen | "Choose what happens to it in {next}." |

**Other states**

- Someone who is neither the owner nor an admin: the list's row has no "Wrap up"; the address shows the goal's wrap-up read-only (parts 2 to 5 as sentences) and "{Owner} or an admin wraps up this goal."
- The goal isn't due until next year: "Nothing to wrap up. **{goal}** isn’t due until {week}. It carries on with its plan." and "Back to the wrap-up".
- The goal is stopped, or not in this year: "This goal isn’t in {year}’s wrap-up." and the back link.
- Not saved (offline, a newer version): the app's existing save error, the form kept.

### 2.3 Results (`/results/<year>`)

Wireframe 4. A wide page.

**Content, in order**

1. Back link "Back to Goals". Title "Results for {year}".
2. One line, by state:
   - ending: "{year} ends on {last day}. {k} of {n} goals are wrapped up; owners have until {closing day}. A result is worked out from the numbers; an owner’s view is shown beside it."
   - ended, wrap-up open: "{year} ended on {last day}. {k} of {n} …"
   - closed: "{year} ended on {last day}. {k} of {n} goals were wrapped up."
   - running, before the wrap-up: "{year} is in week {w} of {weeks}. Results so far; most goals aren’t due until {last day}."
3. Primary action, admins only, while no later year exists and the wrap-up is open or the year has ended: "Start {next}" → `/workspace/cycles/next`. Otherwise none.
4. Four counts (`resultsSummary`, rule 9), each a number, the result word and one line: Met ("{k} of them early"), Met late ("after their due week"), Not met ("{k} at least halfway there"), Not finished yet ("{a} not due until {next}; {b} waiting for a final number"). A count is a link that sets `result=`. Stopped goals are not counted here; under the counts, when there are any: "{k} goals were stopped during {year}. See them" → `/goals?year=…&show=stopped`.
5. Tabs: "The year" · "Q1" · "Q2" · "Q3" · "Q4" (a year only; a quarter not yet ended is left out).
6. The list bar (find spec 2.1): search "Find a goal"; filters Result, Level, Team, Owner (find-and-pick); Sort ("North stars first" default, then "Not met first", "Name", "Owner", "Furthest from target"); "Export" (plain) → the Results sheet for this year as a .csv, and "Everything, as a workbook" (2.8).
7. The count line: "{n} goals, north stars first, then not met first." / "{n} goals match."
8. A table, 50 rows at a time, columns:
   - **Result**: the word. On a quarter tab: "Met" / "Not met" / "Nothing due".
   - **Goal**: name (a link to the goal as it ended); under it "{key} · {level} · {owner} · {carries on | carries on with its plan | finished | stops | stopped {date}}".
   - **At the end**: the final number; under it "target {target}" and, where true, "{k} week{s} late". On a quarter tab: "{value} against a plan of {plan}{, {gap} short}".
   - **Owner’s view, and what was learned** (the year tab; absent when the wrap-up is switched off): "Agreed." or "**{View}.** “{why}”"; under it "Learned: {learned}". Not wrapped up: "Not wrapped up yet." (closed: "Not wrapped up."). Not due: "Not due until {dates}."
   A row is not washed or striped; "Not met" is the word in the off-track colour.

**Empty states:** a year with no goals: "No goals in {year}." No year has reached its wrap-up: `/results` goes to `/goals`.

### 2.4 Start the next year (`/workspace/cycles/next`)

Wireframe 5 (a). A page inside Workspace, 760 px, admins act; everyone may read.

**Content, in order**

1. Back link "Back to Cycles". Title "Start {next}".
2. "{next} runs from {first Monday} to {last Sunday}: {weeks} weeks. Everyone stays in {year} until {last day}, so the last check-ins and the wrap-up carry on." After the old year's last day: "…: {weeks} weeks. It opens for everyone as soon as you start it."
3. Four counts from `startReadBack` (rule 7), which always add up to the year's live goals:
   - "{a} carry on" · "{k} keep their plan and dates" (left out at 0)
   - "{b} finish" · "they met their target"
   - "{c} stop" · "their owners said so"
   - "{d} not wrapped up yet" · "{d1} carry on as they are, {d2} finish"
4. "What {next} starts with", a list of sentences, each left out when its count is 0:
   - "**{a + d1} goals**, each with its key, owner, team, level and metric. A number goal starts from its final number, from week 1; its target is unchanged and due at the end of {next}. See the {n}" → `/results/<year>?next=carry`.
   - "**{s} goals with stages** carry the {t} stages not done, spread evenly over {next}. Their owners are asked to check the dates."
   - "**{p} goals lose their “Feeds into”**, because the goal above them finishes or stops. See them"
   - "**{m} open next steps and asks move with their goals.** {r} stay in {year}, on goals that finish or stop. See the {r}"
   - "**{h} goals set their weekly plan numbers by hand.** Those numbers were for {year}; in {next} the plan is a straight line until the owner sets them again."
   - with a rhythm: "**Check-ins every week, due by {weekday}**, as in {year}. The first are due {date}." With none: "**No set rhythm**, as in {year}. Nothing is due."
   - Reviews on, and any exist: "**{v} review{s} carry on** with the same people and days, on {next}’s goals." Reviews off: no line.
   - "The {o} owner{s} with goals not wrapped up can still do it until {closing day}. If one then says “stop”, the goal leaves {next}."
5. "Start {next}" (primary) and "Not yet" (→ Cycles).

**After pressing:** Cycles, with the line of 2.5 and a toast "{next} is ready. It opens on {first Monday}." (or "{next} has started.") with Undo.

**States**

- A member: items 1 to 4, then "An admin starts {next}: {admins}." (`adminsLine`), no button.
- Before the wrap-up opens: "{next} can be started from {day the wrap-up opens}, when {year}’s wrap-up opens." No counts, no button.
- No goals at all: counts are left out; "{next} starts empty." The button stays.
- A cycle shorter than a year: the same page; "the next cycle" is named by `cycleName`.

### 2.5 Cycles (`/workspace/cycles`), changed

Wireframe 5 (b) and (c). The Workspace spec's 2.6 with these changes.

- A row's first line: "{name} · running" / "{name} · ending" / "{name} · ended {last day}" / "{name} · starts {first Monday}" (rule 1).
- Its dates: "Week {w} of {weeks} · {first Monday} to {last Sunday}" (ended or not begun: the dates and "{weeks} weeks").
- A year started from the wrap-up, while it can be undone: "Started by {name} on {day}. It can be undone until someone checks in or changes a goal in it." Once it can't: "It can’t be undone now: {why from `canUndoStart`}. To change what carried, stop a goal or add one from {year}’s results."
- The ending or ended year: "The wrap-up is open until {closing day}: {n} goals still to wrap up." / "…: every goal is wrapped up."
- Actions: the running or ending year: "Open the wrap-up" (plain; once it is open) and, for admins once it is open and no later year exists, "Start {next}" (primary) → 2.4. Every year but the current one: "See its goals" → `/goals?year=…`. An ended year: "See the results".
- Above the list, while Undo is possible: a line with the warning mark, "**{next} is ready.** {n} goals are set up. It opens for everyone on **{first Monday}**. Until then this is still {year}, week {w}." and "Undo" (plain). Undo asks nothing more; it says "{next} was undone. {year} is as it was." with "Start {next}" still on the row.
- "Delete…" stays only for a cycle that was not started from a wrap-up (one made by set-up or an import).

### 2.6 A carried goal's page

Wireframe 6. The goal page (round 1, GT1) with four changes, all from rule 10's `previousOf`.

1. **Meta:** "{key} · carried from {year}".
2. **The summary before its first check-in:** the status "No check-in yet" (the vocabulary's word; never "Not started"), then "{final} at the end of {year} · first check-in due {date}" (no rhythm: "· no check-in in {next} yet"). The scorecard's four cells are: "Starts from" {final} / "{last week} of {year}"; "Plan this week" {plan} / "{week with dates}"; "To target" as usual; "In {year}" {result word} / "{final} of {target} · See {year}" → last year's page.
3. **The carried line** (goal entry 2.11), for the owner and admins while goal entry's rule 11 (`carriedUnchecked`) is true, the Check mark, then `carriedSays` (rule 5):
   - number: "**Carried from {year}.** It starts from {final}, {your|its} final number, in week 1 ({dates}), with the same target of {target}, now due at the end of {next} ({last week with dates}).{ Nobody chose that date: {left} in {weeks} weeks is slower than last year’s {moved} in {old weeks}.}" The last sentence only when the new weekly pace is under half last year's.
   - a plan with hand-set numbers adds: "The weekly numbers you set by hand were for {year}; the plan is a straight line until you set them again."
   - stages: "**Carried from {year}.** Its {n} stage{s} not done {was|were} spread evenly over {next}: check {its date|their dates}."
   - keeps its plan: "**Carried from {year}** with its plan: {target} by {week, sentence form}." (no Check mark; it goes after a week).
   - lost its parent: adds "It fed into {parent}, which {finished|stopped}: it has no “Feeds into” now."
   - no wrap-up: starts "**Carried from {year} without a wrap-up.**"
   - buttons: "Check the plan" → `/goals/<id>/edit#plan`; "It’s right" (quiet).
4. **History:** two worked-out rows at the foot: "{next} · **Carried from {year}** · {day}. From {final} to {target} by {week}. {What came with it: metric, owner, team, what it feeds, {n} open next step{s}}; {k} {person|people} still watch it." and "{year} · **{n} check-ins, ended {result}** · {Your|{Owner}’s} view: {view}. “{why or learned}” Open {year}’s page".

**The first check-in** on a carried goal shows last year's final number where "last time" goes ("{final} at the end of {year}"), and uses round 1's re-base (OB2, onboarding rule 4) unchanged: a first number that isn't the baseline offers "Start the plan from {value}" and does not ask why it is ahead or behind.

A goal that keeps its plan across the turn draws last year's numbers on its chart at their own weeks, labelled with their year (`earlierNumbers`, rule 10), and its plan table lists those weeks as "Week 49 of {year} · {dates}", never "Week -4".

### 2.7 A quarter closing

Wireframe 3. From rule 11's `quarterJustClosed`.

- **On the goal's page**, for its owner, in the first week after a quarter ends, above the summary: the warning mark and "Q{n} closed", then "**{Met|Not met}:** {quarter text}. Q{n} was weeks {from} to {to} ({dates}). Q{n+1}’s plan is {plan} by {week with dates}." and "Got it" (kept in `Prefs`). It goes at the week's end. Q4 has no line: the year's result says it.
- **The quarter strip** is titled "{year} by quarter", with one line under it: "Each quarter against your own plan: where the plan said this goal would be at the quarter’s end." The quarter that closed in the last week carries "· closed this week" and a full outline.
- **History:** a worked-out row in the week after: "Q{n} closed: {met|not met}" · "{quarter text}. Worked out from the {week} check-in; nobody typed it."
- **As of:** when the number a quarter closed on is older than the quarter's last two weeks, the text ends ", as of {week with dates}"; with no number at all it stays "no number reported".

### 2.8 Another year

Wireframe 7. From rule 10. One choice, `year=` in the address, read by `viewedCycle(cycles, today, param)`.

- **The year choice** is shown on Goals, Data and Results once a workspace has more than one cycle that isn't removed: a row of the years, newest first (more than four: the newest three and "Earlier", a short list). It sits above the tabs. Choosing the current year removes `year=`.
- **Goals with another year chosen:** under the title "{year} ended on {last day}. These are its goals as they ended; nothing here can be changed." (a prepared year: "{next} starts {first Monday}. These are the goals it starts with."); a link "Results for {year}"; the tabs Mine, My team, All (no Watching); the list bar with Result in place of the status filters; each row starts with the result word, not a status shape; "{key} · carried into {next}" / "· finished" / "· stopped at the wrap-up" / "· stopped {date}". No "New goal", no "Needs attention". Layouts: List and Table only.
- **A past year's goal** (any `/goals/<id>` whose cycle has ended): meta "{key} · {year}"; the summary is the result word and its sentence; no buttons but, where it didn't carry, "Set a {current year} goal from it" (plain; goal entry's copy door). One line under the summary: "**This goal ended with {year}{ and was stopped at the wrap-up | and finished | }.** {Owner}’s view: {view}. “{why}” It can’t be changed now." or "**It carried on into {next} as {key}.**" with "Open this year’s page" (primary there is none). History is whole, with a first row "Wrap-up · {what happened} · {who}, {day}". The edit address shows goal entry's line.
- **A key:** `/goals/G-37` opens the current year's goal; with none there, the latest year's that has one. `?year=` names one.
- **Find:** a goal row from another year is listed after this year's, as "{name}" / "{key} · {year} · {result, lower case}".
- **Data:** the year choice; another year's tables are read-only ("{year} has ended; its numbers can’t be edited here.").
- **Export** (the spreadsheets module's sheet and Data's menu): "Which year" above "Which goals", this year first. The file's name carries the year (it already does).
- **Activity** already spans years; a change to a goal of another year links to that goal's page.

### 2.9 The frame, About and Home

The frame and About are this area's; Home's blocks are handed to the Home design (HM), with their words.

- **The frame's place line** (`placeLine`, rule 1): running "{year} · week {w} · Q{n}"; the last week "{year} · week {w}, the last week"; ended with no next year "{year} has ended"; before a year's week 1 "{next} starts {first Monday}".
- **About's Year fact** and Cycles' sentence: `yearLine` (Workspace rule 6) with the added cases in rule 1.
- **Home, an owner** (wireframe 8):
  - from two weeks before the wrap-up opens, one quiet line: "{year} ends on {last day}. The wrap-up opens on {day}."
  - open, with a rhythm and check-ins due: the check-in block's eyebrow becomes "The last check-ins of {year} are due by {date}" and its line ends "These are the year’s final numbers. Then wrap up your {n} goals: about a minute each."; under it a row "Wrap up {year} · {k} of your {n} goals to do · open until {closing day}" with "Open the wrap-up".
  - open, nothing due (or no set rhythm): the main block is "Wrap up your {k} goals" · "Each asks for its final number first, then whether the result is fair. Open until {closing day}." · "Wrap up {goal}".
  - done: the row reads "Wrap up {year} · all {n} done · See the results".
  - Reviews on, and the viewer is in one: its row says "Its last session of {year} is {date}". Reviews off: no such row, and no sentence about a final review.
- **Home, a manager:** a row "Your team’s wrap-up · {k} of {n} to do" → `/wrap-up?scope=team`.
- **Home, a leader:** a row "Results for {year} · {k} of {n} wrapped up" → `/results/<year>`; in the first week after each quarter, "Q{n} closed: {a} of {b} goals met their plan" → `/results/<year>?part=q{n}`.
- **Home, an admin**, once the wrap-up is open and no later year exists: a row "Start {next}" · "{next} isn’t set up yet. It can be started now; everyone stays in {year} until {last day}." After the last day it is About's first "To sort out" row and Home's main block: "{year} ended on {last day}. Start {next}."
- **The first week of a new year:** Home's first-week rows (set-up's ST8 pattern) for a carried goal's owner: "{n} of your goals carried on from {year}. Check each plan" → the first with the carried line.

### 2.10 Before a year's first week

From rule 4, wherever the current cycle hasn't reached week 1 (a new workspace in its set-up week; set-up's "Start with {next}"; an admin looking at a prepared year).

| Place | Says |
|---|---|
| The frame | "{next} starts {first Monday}" |
| Home's main block | "{next} starts on {first Monday}, {in k weeks | next week | on Monday}. Nothing is due until then.{ Your first check-ins are due {date}.}" with "See your goals" |
| Check-in | "Check-ins start in week 1, {dates}." |
| A goal's status | "No check-in yet" and "first check-in due {date}" |
| Goals' count line | "{n} goals. {next} starts {first Monday}." |
| Cycles | "{next} · starts {first Monday}" and its dates |
| The leader's Home | No count of "not started" goals; "{n} goals are set up for {next}." |

Never: "The year starts this week" before the week it starts; "week 0 · Q1"; "Week 1 of 52" before week 1; "No recent update" for want of a check-in before the first is due.

### 2.11 Four ways, and with the wrap-up off

| | Every week | No set rhythm |
|---|---|---|
| Reviews on | 2.9 as written | No "due" wording; the wrap-up is Home's main action; `finalNumberCheck` asks for every goal whose last number is older than two weeks |
| Reviews off | No review rows; 2.4 has no reviews line | Both |

If the switches area makes the wrap-up a module (`wrap-up` in `Workspace.modulesOff`), off means:

- absent: `/wrap-up…` (redirects to `/results`), Home's wrap-up rows, the "Owner’s view, and what was learned" column, the four owner columns of the Results sheet, `get_wrap_up` and `wrap_up_goal`, the wrap-up rows in History;
- still there, as core: rules 1 to 7 and 9 to 11; `/results/<year>`; `/workspace/cycles/next` with its read-back and Undo, whose counts are "carry on", "finish" and "stopped" (no "not wrapped up yet"); the carried line; another year. Stopping a goal is "Stop this goal" (`stopGoal`), any day.
- Switching it off while a wrap-up is open says first: "{k} wrap-ups already given stay in the record and are not shown. Results stay. {next} starts by the rules: goals that didn’t meet their target carry on."

## 3. Who sees what

No new right. Each line names what already enforces it.

| Thing | Member | Owner of the goal | Admin | Enforced by |
|---|---|---|---|---|
| The wrap-up list, Results, another year, the read-back: read | Yes | Yes | Yes | R1 rule 3 (reading is open in a workspace) |
| Wrap up a goal; change it while open | No button | Yes | Yes | `saveRetro` (`actions.ts:287`, `ownsOrAdmin`) |
| Give the final number | No | Yes | Yes | `postCheckIn` (the check-in's rule; unchanged) |
| "Ask {name}" on a goal not wrapped up | Yes | — | Yes | `askForUpdate` (`actions.ts:60`) |
| "Set {next}’s goal from it" | As New goal | As New goal | As New goal | Goal entry's `goalRights` |
| Start the next year | No button | No button | Yes | `startNextCycle` (`actions.ts:302`) |
| Undo the start | No | No | Yes | `undoStart` (new), the same right as `deleteCycle` (`removal.ts:385`): R1's "Start the next cycle; delete an empty one" |
| Stop a carried goal from the old year's wrap-up | No | Yes | Yes | `saveRetro`, which calls `deleteGoal`'s rule for the copy (`removal.ts:291`) |
| Change anything in a year that has ended | No | No | No | New refusal in the shared actions (rule 3, `writable`), not a right: "{year} has ended. {What to do instead}." |

**Gaps, for Lane (README decisions 2 and 4):** nothing today says whether a manager may wrap up a team member's goal (they may not, unless an admin); and "who may see what someone learned" is open to the whole workspace, as every check-in is.

## 4. The data

- `Retro` gains one optional field: `why?: string | null`, the owner's reason when their view differs from the result. `result` keeps its three codes and its meaning (the owner's view); `next` keeps `'carry' | 'stop'` ("finished" is saved as `'stop'` and told apart by `carryOf`).
- `Cycle`, `Goal`, `CheckIn`, `Watch`, `Ask`, `Review`, `MetricLink`: unchanged. A carried goal is tied to last year's by its key (`Goal.key`, which `nextCycle` already copies), never by a new field.
- `Change` for starting a year carries `undo` (as an import's does, `removal.ts:398–409`): the ids of the watches and metric links added, and the asks and reviews as they were.
- `RULES` (`src/domain/thresholds.ts`) gains `wrapUpWeeksBefore: 2` (today's fixed "last two weeks") and `wrapUpWeeksAfter: 4`.
- `Prefs` holds: the wrap-up draft per goal; "It’s right" per carried goal; "Got it" per goal and quarter.

### The migration

One file, `supabase/migrations/0038_wrap_up_why.sql` (or the next free number), for CY5 only. Every other item needs none. Read `supabase/README.md` first; it runs as `faro_owner` with `search_path` faro.

```sql
-- The owner's reason when their view of a goal differs from its worked-out result (cycle-end spec, CY5).
-- One nullable column. okr_upsert writes whichever columns a saved row carries (0011), so okr_write is not touched,
-- and the table's grants and row rules already cover a new column. Safe to run twice.
alter table okr_retros add column if not exists why text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'okr_retros_why_ok') then
    alter table okr_retros add constraint okr_retros_why_ok check (why is null or length(trim(why)) >= 3);
  end if;
end $$;
```

- `src/data/rows.ts`: `retroToRow` writes `why` only when set; `retroFromRow` reads `r.why ?? null`.
- The fixed `select *` redirect in `public` (0035) won't show the column; the app reads `faro` (the Data API offers it since 0c). Nothing a redirect shows is changed.
- Check before building, as the toggles spec does: `okr_upsert` still takes its columns from the rows it is given; the plain-Postgres adapter and the PGlite contract tests run the same file; add "a wrap-up's reason is kept whole" to `storeContract`.

## 5. Rules for `src/domain`

New rules take only what they read. The clock is passed in. Worked examples become unit tests and conformance rows; ◆ marks the ones for `src/spec/rules.ts`.

### Rule 1. A cycle's dates and state: `src/domain/cycle.ts`

- `cycleDates(cycle)` → `{ firstDay, lastDay, wrapUpOpens, wrapUpCloses }` as ISO dates: week 1's Monday (`startDate` + 7 days); the last week's Sunday (`startDate` + (`weeks` + 1) × 7 − 1 days); the Monday of week `weeks − RULES.wrapUpWeeksBefore + 1`; `lastDay` + `RULES.wrapUpWeeksAfter` × 7 days.
- `cycleState(cycle, today)` → `'before' | 'running' | 'ending' | 'ended' | 'closed'`: before `firstDay` (and not in week 0 of a first cycle, which is `'before'` too); to the day before `wrapUpOpens`; to `lastDay`; to `wrapUpCloses`; after.
- `wrapUpOpenOn(cycle, today)` → true in `'ending'` and `'ended'`. It replaces `wrapUpOpen(cycle, week)` (`cycle.ts:88`), which stays as a wrapper for the week it opens.
- `wrapUpCycle(cycles, today)` → the cycle, not removed, for which `wrapUpOpenOn` is true (the later, if two); else nothing.
- `placeLine(cycle, today)` and the added cases of `yearLine` (2.9, 2.5).

| Given (2026: starts 2025-12-22, 53 weeks) | Then |
|---|---|
| ◆ `cycleDates` | first Mon 29 Dec 2025; last Sun 3 Jan 2027; wrap-up opens Mon 21 Dec 2026; closes Sun 31 Jan 2027 |
| ◆ 2027 (starts 2026-12-28, 52 weeks) | first Mon 4 Jan 2027; last Sun 2 Jan 2028; opens Mon 20 Dec 2027; closes Sun 30 Jan 2028 |
| Sun 20 Dec 2026 | `running`; "2026 · week 51 · Q4" |
| Mon 21 Dec 2026 | `ending`; "2026 · week 52 · Q4" |
| Mon 28 Dec 2026 | `ending`; "2026 · week 53, the last week" |
| ◆ Mon 4 Jan 2027, no later cycle | `ended`; "2026 has ended"; `yearLine`: "2026 ended on Sun 3 Jan 2027. The wrap-up is open until Sun 31 Jan 2027: 88 goals still to wrap up." |
| Mon 1 Feb 2027 | `closed` |
| Cycles' dates for 2026 | "29 Dec 2025 to 3 Jan 2027" (today: "22 Dec 2025 to 27 Dec 2026") |
| A 13-week cycle starting 2026-09-28 | first Mon 5 Oct 2026; last Sun 3 Jan 2027; opens Mon 21 Dec 2026 |

### Rule 2. The week results are judged at: `resultWeek(cycle, today)` in `src/domain/plan.ts`

`min(cycle.weeks + 1, floor(days since startDate / 7))`, never below 0. `currentWeek` is unchanged (it stops at `cycle.weeks`, so a check-in given after the year is dated its last week). `goalResult`, `quarterResult`, `quarterResults` and the Results columns are called with `resultWeek`; everything else keeps `currentWeek`.

Once a cycle has ended: nothing in it is due, late or "No recent update" (`goalStatus` returns the last status given, with `asOfWeek`, as the toggles spec's no-rhythm rule does), and no flag is raised for want of a check-in.

| Given | Then |
|---|---|
| ◆ Sun 3 Jan 2027 | `currentWeek` 53, `resultWeek` 53: G-37 (33 of 40 pairs, due week 53) has no result; Q4 "In progress" |
| ◆ Mon 4 Jan 2027 | `currentWeek` 53, `resultWeek` 54: G-37 "Not met: due week 53"; Q4 "Not met: 33 pairs against a plan of 40 pairs, 7 pairs short" |
| The same day, G-11 (range ≤ 2.0%), last number 1.8% in week 53 | "Met" |
| The same day, G-11 with its last number in week 46 | "Not met" (no number at the end), and `finalNumberCheck` asks (rule 8) |
| Mon 11 Jan 2027, no later cycle, Tunde's Home | No "due", no "11 days late"; "2026 ended on Sun 3 Jan 2027" |
| A check-in posted on Wed 6 Jan 2027 for G-37 in 2026 | Dated week 53; the result is worked out again |

### Rule 3. Which cycle the app is in: `currentCycle(cycles, today)`, changed

Of the cycles not removed, sorted by start: the latest whose week 1 has begun (`startDate` + 7 days ≤ today); if none has, the earliest. (Today: the latest that starts within seven days.)

`viewedCycle(cycles, today, param)` → the cycle `year=` names, else `currentCycle`. `writable(cycle, cycles, today)` → true for the current cycle; for the `wrapUpCycle`, only for the wrap-up's own writes (a wrap-up, a final check-in, an ask for an update); false otherwise. The shared actions refuse with "{year} has ended. A goal carried into {next} is changed there." or "{next} starts {first Monday}. It can be changed from then."

| Given | Then |
|---|---|
| ◆ 2026 only, Mon 21 Dec 2026 | 2026 |
| ◆ 2026 and 2027, Mon 21 Dec 2026 | 2026 (today: 2027) |
| ◆ The same, Sun 3 Jan 2027 | 2026 |
| ◆ The same, Mon 4 Jan 2027 | 2027 |
| 2026 only, Mon 11 Jan 2027 | 2026, `ended` |
| 2026 only, started on Mon 11 Jan 2027 | 2027 at once: its week 1 has begun |
| A new workspace whose only cycle is 2027, Wed 11 Nov 2026 | 2027, `before` (set-up's "Start with 2027") |
| A new workspace in its week 0 | Its only cycle, `before` |
| 2027 removed (undone) | 2026 |

### Rule 4. Before a cycle's first week: `beforeStart(cycle, today)` in `src/domain/year.ts`

Returns `{ firstDay, days, firstDue }` while today is before `cycleDates(cycle).firstDay`; otherwise nothing. `firstDue` is the first check-in's due date from the rhythm's rule (set-up's S2), or nothing with no rhythm. While it returns something: `weekProgress` gives nothing due, `goalStatus` gives `none` (never `stale`), and the screens say 2.10.

| Given | Then |
|---|---|
| ◆ 2027, Mon 21 Dec 2026 | first day Mon 4 Jan 2027, 14 days; first due Thu 7 Jan 2027; "2027 starts on Mon 4 Jan 2027, in 2 weeks. Nothing is due until then." |
| 2027, Mon 28 Dec 2026 | "…, next week." |
| 2027, Mon 4 Jan 2027 | Nothing |
| 2027 with no rhythm, 21 Dec 2026 | first due nothing; the sentence has no "first check-ins" part |

### Rule 5. What happens to one goal: `carryOf(goal, ctx)` in `src/domain/carry.ts` (new)

`ctx = { cycle, next: { startDate, weeks, name }, checkIns: this goal's, retro: this goal's or null, parentCarries: boolean | null, today }`. Returns `{ kind, why, plan?, stages?, says }`:

| `kind` | When, in this order | The copy |
|---|---|---|
| `stop` | `retro.next === 'stop'` and the goal isn't `finish` by the rows below | None |
| `keep` | A number goal whose `plan.endWeek` is after `cycle.weeks` | `fromWeek`, `endWeek` and each `points[].week` less `cycle.weeks` (as today, `cycle.ts:125–129`) |
| `finish` | `goalResult` at `cycle.weeks + 1` is Met or Met late; or a number goal's final number has reached the target; or every stage is done; or its owner called it done | None |
| `carry` | Everything else | Number: `{ start: finalNumber, target, shape, fromWeek: 0 }` with no `endWeek` and no `points`; `originalPlan: null`, `rebaselinedWeek: null`. Stages: the stages not done, in order, `dueWeek = max(1, round((i + 1) × next.weeks / n))`. Range: unchanged |

- `finalNumber(goal, checkIns)` → the last value at or before the cycle's last week, or `plan.start` with `none: true` when there is none.
- The copy always has: a new id; `cycleId`; `createdAt` = now; `pending: null`; the key and every other field as they were; `parentId` = the parent's copy when `parentCarries`, else `null` (and then `effect: null`).
- `carrySays` and `carriedSays` give 2.2's and 2.6's sentences from the same result.
- `nextCycle(old, goals, checkIns, retros, ids, now)` keeps its signature and builds its goals from `carryOf`; two passes, so a parent's kind is known before its children's.

| Given (2026 → 2027) | Then |
|---|---|
| ◆ G-37: 4 → 40 pairs, final 33, not met | `carry`: `{ start: 33, target: 40, shape: 'straight', fromWeek: 0 }` |
| ◆ G-126: 0.42 → 0.30 USD, `fromWeek: 45`, final 0.37 | `carry`: `{ start: 0.37, target: 0.3, fromWeek: 0 }` (today: `fromWeek: 45`) |
| ◆ G-126 with no number at all | `carry`: `start: 0.42`, `none: true`; `carriedSays` adds "It has no number yet." |
| ◆ G-124: 0 → 70%, final 72% in week 46 | `finish`: "its last number, 72%, has reached the target of 70%" (today: carried as 72 → 70, lower is better) |
| ◆ G-86: fewer long-lived keys, target 50, final 26 | `finish` (today: carried as 26 → 50) |
| ◆ G-22: called done in week 38 | `finish` (today: carried as 95 → 95) |
| ◆ G-20: three stages, all done | `finish` (today: all three carried, not done) |
| ◆ G-10: stages due 6, 23, 37, 49; three done; no "stop" | `carry`: one stage, "Every deployable service", due week 52 |
| G-7: two stages not done, into a 52-week year | Due weeks 26 and 52 (today: 27 and 53) |
| ◆ G-125: 0 → 60%, `fromWeek: 45`, `endWeek: 66` | `keep`: `fromWeek: −8`, `endWeek: 13` |
| G-11: range ≤ 2.0% | `carry`, the range unchanged, even when Met (a limit is kept every year) |
| G-11 with `retro.next: 'stop'` | `stop` |
| G-22 with `retro.next: 'carry'` | `finish` still; the form doesn't offer "Carry it on" for it |
| A number plan with hand-set points | `carry` with no `points`; `says` names it |
| A child whose parent is `finish` or `stop` | `parentId: null`, `effect: null`; `says` names the parent |

### Rule 6. Starting, and keeping the copies true: `startNextCycle`, `recarry`

`startNextCycle(x)` (`actions.ts:302`), changed:

- refuses unless `wrapUpOpenOn(x.cycle, today)` or the cycle has ended: "{next} can be started from {day}, when {year}’s wrap-up opens.";
- refuses when a later cycle that isn't removed exists: "{next} has already been started, by {name} on {day}.";
- the new cycle: as today, plus `checkInWeeks` copied and `rhythmFrom` = its week 1's Monday (the toggles spec's fields, when they exist);
- the commit: `cycles: [next]`, `goals: copies`, and from `carryExtras(copies, map, snapshot)`:
  - `metricLinks`: one new link per carried goal that had one, same metric, part and team, `linkedBy` and `linkedAt` as they were;
  - `watches`: one new watch per watch of kind `goal` or `tree` whose `ref` is a goal that carries, same person;
  - `requests`: each open ask or next step on a carried goal, with the copy's id added to `goalIds` (it then shows in both years);
  - `reviews`: each review whose `scope.goals` or `scope.trees` names a carried goal, with the copies' ids added (reviews that are ended are left alone);
  - one change: "Started {next}: {a} goals carry on, {b} finish, {c} stop", with `undo` (section 4).

`recarry(goalId, x)` → a commit or nothing. Called by `saveRetro`, `postCheckIn`, `stopGoal` and a plan change when they act on a goal of a year that has a later cycle. It runs `carryOf` again and, **only while the copy is untouched** (no check-in and no change by a person in the later cycle: goal entry's `carriedUnchecked`): replaces the copy's plan or stages; removes the copy and its extras (kind now `stop` or `finish`); or adds a copy with its extras (kind now `carry`). When the copy has been touched it returns nothing, and `saveRetro` refuses a "stop" with "It already has check-ins in {next}. Stop it there instead."

| Given | Then |
|---|---|
| ◆ Amara starts 2027 on Mon 21 Dec 2026 | 2027 exists; `currentCycle` is still 2026; nobody's Home changes but hers ("2027 is ready") |
| The same press again (the tools, or a second tab) | Refused: "2027 has already been started, by Amara Nwosu on Mon 21 Dec 2026." |
| A member presses (the tools) | "Only admins can start the next cycle." (unchanged) |
| Tunde checks in 35 pairs for G-37 on Tue 29 Dec 2026 | G-37's copy starts from 35 |
| Tunde wraps up G-10 with "Stop it here" on 30 Dec | G-10's copy, its watch copies and its ask links leave 2027 |
| Rhea wraps up G-1 on Tue 12 Jan 2027, after checking in to its copy | "Stop it here" isn't offered; "Carry it on" changes nothing in 2027 |
| G-37 had a metric link, 2 goal watches, 1 open next step, and is in a review's tree | All four point at the copy too |
| Started on Mon 11 Jan 2027 instead | 2027 is current at once; the 2026 wrap-up stays open until Sun 31 Jan 2027 |

### Rule 7. The read-back: `startReadBack(ctx)` in `src/domain/carry.ts`

`ctx = { cycle, next, goals: this cycle's live goals, checkIns, retros, requests, reviews, watches, metricLinks, rhythm, reviewsOn, today }`. Returns the counts and lists of 2.4, every number from `carryOf` over the goals, so the page and the start agree by construction.

| Given | Then |
|---|---|
| ◆ 126 goals: 81 wrapped up that carry (3 `keep`), 24 wrapped up `finish`, 6 `stop`, 15 not wrapped up (12 `carry`, 3 `finish`) | "81 carry on · 3 keep their plan and dates", "24 finish", "6 stop", "15 not wrapped up yet · 12 carry on as they are, 3 finish"; "93 goals"; the four add to 126 |
| ◆ The demo on 21 Dec 2026, 7 wrapped up | The four add to 126; none of the 8 done goals is under "carry on" (today: "124 goals carry on, 2 stop") |
| Nothing wrapped up | "0 carry on" is left out; "126 not wrapped up yet · {n} carry on as they are, {m} finish" |
| The wrap-up switched off | Three counts: carry on, finish, stopped |
| Reviews off | No reviews line |

### Rule 8. The wrap-up of one goal: `src/domain/wrapUp.ts` (new)

- `finalNumberCheck(goal, cycle, checkIns, resultWeek)` → nothing, or `{ kind: 'old' | 'none', value, week }`: for a goal that isn't `keep` and isn't already Met, when its last number (or last word on its stages) is from before week `cycle.weeks − 1`, or there is none. Answered by a check-in in the last two weeks.
- `resultSays(goal, cycle, checkIns, resultWeek)` → 2.2's sentence; `share` = how far it moved of what it set out to, 0 to 100, whole.
- `viewFor(result)` → the owner's view that agrees with a result: Met and Met late → `hit`; Not met → `missed`. "Yes" saves this.
- `agrees(retro, result)` → `retro.result === viewFor(result.kind)` and no `why`. The screens say "Agreed" or "{Name}’s view: {word}" from it.
- `wrapUpMustFix(draft, result)` → 2.2's table.
- `wrapUpOrder(goals, …)` → 2.1's order.
- `resultLine(goal, …)` → the list row's line.
- `saveRetro` (`actions.ts:287`), changed: takes `why`; requires it when the view isn't `viewFor(result)`; refuses when `wrapUpOpenOn` is false ("{year}’s wrap-up opens on {day}." / "{year}’s wrap-up closed on {day}."); its diffs name the fields "Owner’s view" (today "Result"), "Why", "Learned" and "In {next}"; its summary reads "Wrapped up {goal}: agreed, {result}" or "…: {view}, though {result}"; then `recarry`.
- `suggestedResult` (`cycle.ts:91`) is removed.

| Given | Then |
|---|---|
| ◆ G-1: 52 → 24 hours, final 36 in week 53 | "Not met"; "36 hours at the end of 2026 (week 53, 28 Dec 2026–3 Jan 2027), against a target of 24 hours. It came down 16 of the 28 hours it set out to: 57% of the way." |
| ◆ G-19, last number 84% in week 46, on 28 Dec 2026 | `finalNumberCheck`: `old`, 84%, week 46 |
| G-19 after "Yes, 84% is the final number" | A week-53 check-in of 84% by the owner, saying nothing else; the Check is gone |
| G-126 with no number | `none`: "This goal has no number yet. What did it end on?" |
| G-125, due week 66 | No check; nothing to wrap up |
| ◆ "Yes" on a Not met goal | `result: 'missed'`, `why: null`; shown as "Agreed" |
| ◆ "Not the whole story", Partly, "The runner budget was decided in November, not August." | `result: 'partly'`, `why` kept; the result still reads "Not met" everywhere |
| "Not the whole story" and Missed, on a Not met goal | Must fix: "That is what the numbers say too. …" |
| Learned "ok" | Must fix: "Write a sentence: one thing worth knowing next time." |
| G-10 (3 of 4 stages, the last late) | "Not met"; nothing pre-selected (today: "Hit it" pressed) |
| G-11 at 1.8% in week 53 | "Met" (today, with no recent update: "Missed" pressed) |
| Saved on Mon 1 Feb 2027 | Refused: "2026’s wrap-up closed on Sun 31 Jan 2027." |

### Rule 9. Undoing the start: `canUndoStart`, `undoStart` in `src/domain/removal.ts`

- `canUndoStart(full, cycleId)` → `{ ok }` or `{ ok: false, why }`: the cycle was made by `startNextCycle` (its change has `undo`); it has no check-in ("{n} check-in{s} are in it"); no goal in it was changed or added by a person ("{n} goal{s} in it {has|have} been changed"); no later cycle exists.
- `undoStart(x, cycleId)` → admins; marks the cycle removed (as `deleteCycle` does, so it is in Recently removed for 30 days), removes the watches and metric links the start added, and puts the asks and reviews back as `undo` holds them, in one commit with one change "Undid the start of {next}". Starting again makes a new cycle; the removed one can then never be restored (the existing rule, `removal.ts:568`).
- `deleteCycle` refuses a cycle that `startNextCycle` made with "Use Undo on Cycles: it also puts back what moved with the goals."

| Given | Then |
|---|---|
| ◆ 2027 started 21 Dec, untouched | `ok`; after `undoStart`, `currentCycle` 2026, 126 goals, 7 wrap-ups, 62 goal and tree watches, 18 open asks each on one goal |
| ◆ One check-in in 2027 | Not ok: "1 check-in is in it" |
| Tunde saved G-37's plan in 2027 | Not ok: "1 goal in it has been changed" |
| A member (the tools) | "Only admins can undo the start of a cycle." |
| Undone, then started again on 4 Jan 2027 | A new 2027; the first can't be restored |

### Rule 10. One goal across years: `src/domain/goalKey.ts`, `src/domain/carry.ts`

- `previousOf(goal, goals, cycles)` → the goal with the same key in the cycle before, not removed, or nothing. `nextOf` likewise.
- `resolveGoal(ref, goals, cycles, current, year?)` → an id is itself, in any cycle; a key is the goal with it in `year` when given, else in `current`, else in the latest cycle that has one.
- `findGoals` (the `Search` port's function) takes `otherYears: Goal[]` and lists them after the current year's (2.8).
- `earlierNumbers(goal, previous, previousCheckIns, previousCycle)` → for a `keep` goal, last year's values at this year's week numbers (`week − previousCycle.weeks`).
- `yearOutcome(goal, …)` → "carried into {next}" / "finished" / "stopped at the wrap-up" / "stopped {date}".

| Given | Then |
|---|---|
| ◆ `/goals/cfr-contract` in January 2027 | 2026's G-37, as it ended (today: "This goal doesn’t exist") |
| ◆ `/goals/G-37` | 2027's |
| `/goals/G-37?year=2026` | 2026's |
| ◆ `/goals/G-10` (stopped at the wrap-up) | 2026's, the latest year that has it |
| Find "G-10" | "One-click rollback for every deployable service · G-10 · 2026 · not met" |
| G-125's chart in 2027 | 2026's numbers from week 45 at weeks −8 to 0, labelled "week 45 of 2026" onwards |

### Rule 11. A quarter closing: `src/domain/year.ts`

- `quarterJustClosed(cycle, week)` → the quarter whose `to` is `week − 1`, in a year; else nothing.
- `quarterResult` gains `asOfWeek`: set when the number it judged is from before `q.to − 1`; its text then ends ", as of week {n}".
- History's worked-out row and the goal page's line read both.

| Given | Then |
|---|---|
| ◆ G-37 in week 40 of 2026, 28 pairs in week 39 | Q3 just closed: "Not met: 28 pairs against a plan of 30 pairs, 2 pairs short" |
| The same in week 41 | Nothing just closed |
| A goal whose last number before week 39 is from week 30 | "…, as of week 30" |
| Week 54 (the year ended) | No line: the year's result says it |

### Rule 12. The results in counts: `resultsSummary(rows)` in `src/domain/story.ts`

`rows` are `{ result, dueWeek, share, kind, waiting }` for the year's live goals. Returns the four counts and their second lines (2.3). "Early": met before its due week. "At least halfway": `share` ≥ 50.

| Given | Then |
|---|---|
| ◆ 31 met (8 early), 7 met late, 79 not met (52 with share ≥ 50), 9 open (3 `keep`, 6 waiting) | 2.3's four cells; they add to 126 |
| A quarter tab | Counts of Met, Not met, Nothing due for that quarter |

## 6. Extension points

- **The wrap-up as a module** (if the switches area says so): `src/modules/wrap-up/` with `module.json` (id `wrap-up`, routes `/wrap-up`, `/wrap-up/:goal`, table `okr_retros`, tools `get_wrap_up` and `wrap_up_goal`, help `wrap-up`, requirement `WRAP-UP`, journey U114) and a `rebuild` stage. Rules 1 to 7 and 9 to 12, Results, the start and the carry stay in the core: no core rule reads a wrap-up except `carryOf`'s "stop", which reads nothing when the module is off.
- **Home** takes its year-end rows from one function, `yearEndRows(viewer, ctx)` (2.9), as it takes "To sort out" from `workspaceNeeds`.
- **The goal page's History** takes worked-out rows from a list of makers (weeks with no check-in exists; this adds a quarter closing, the carry, and last year).
- **The Results sheet** gains its columns through the field table (import spec section 3): Owner's view, Why, Learned, Next year, all "worked out", present only while the wrap-up is on.
- **Modules that own records tied to a goal** (metrics today) carry them through `carryExtras`: a module gives `carry(copyMap, snapshot) → Commit`. The metrics module's copies its links.

## 7. MCP parity

`src/mcp/workTools.ts`, `src/mcp/parity.ts`. Each tool runs the same action and says the same sentences.

| Tool | Change |
|---|---|
| `get_wrap_up` | Per goal: `result` (the worked-out code and words), `resultSays`, `ownerView`, `agrees`, `why`, `learned`, `next` (`carry`, `finish`, `stop`), `finalNumberCheck`. Top level: `opens`, `lastDay`, `closes` as dates (today `opensWeek: 52`). Takes `year` |
| `wrap_up_goal` | Gains `fair` (boolean), `why`; `result` is needed only with `fair: false`. A final-number Check comes back as a question ("Check with the person first: The last number, 84%, is from week 46 (9–15 Nov 2026). Is it still right at the end of the year? If yes, call post_check_in with it, then call again."), never answered by the tool |
| `start_next_cycle` | With `dry_run: true` (the default) returns `startReadBack` as text and data and changes nothing; with `confirm: true` starts. Its description keeps "Ask the person first" and loses "everyone moves to the new cycle" |
| `undo_start_cycle` (new) | `undoStart`; refuses with `canUndoStart`'s reason |
| `get_results` (new) | `/results/<year>`: the counts and the rows, `year` and `part` |
| `find_goals`, `get_goal`, `export_table` | Take `year`; a key resolves by rule 10 |
| `delete_cycle` | Refuses a started year, pointing at `undo_start_cycle` |

Run `npm run build:mcp` and commit `api/mcp.js`.

## 8. Evals

### Journeys

| # | Requirements | The journey |
|---|---|---|
| U114 | `WRAP-UP` | As Rhea on Mon 28 Dec 2026 (the example pinned to 11 Nov, as U10 does): Home names the wrap-up beside the check-in; the list opens on Mine, to do first, each row a result word; G-19 asks for its final number before anything else; on G-1 nothing is pre-selected, "Save" names what must be fixed; "Not the whole story", Partly and a reason save, and the row reads "Not met" with "Your view: partly"; a met goal offers "It’s finished"; Tunde's address for Rhea's goal has no form |
| U115 | `CARRY-GOALS` | As Amara on Mon 21 Dec 2026: "Start 2027" shows four counts that add up to 126 and none of the done goals under "carry on"; after pressing, Home still says 2026 and Cycles says "2027 is ready… opens Mon 4 Jan 2027" with Undo; Undo returns everything; start again; Tunde checks in 35 for G-37. On Mon 4 Jan 2027 everyone is in 2027: G-37 reads "No check-in yet · 35 pairs at the end of 2026", has the carried line with dates, its metric, its watchers, its open next step and a History row for 2026; no stage is due after week 52; G-126's plan starts in week 1; G-22 is not in 2027; the first check-in asks no "Why is it ahead?"; after it, Cycles has no Undo and says why |
| U116 | `RESULTS` | As Amara on Mon 11 Jan 2027: `/results/2026` shows four counts adding to 126, a row with an owner's different view and its reason, and the Q3 tab; the export's Results sheet has the result and the owner's columns for 2026. As Tunde: Goals with 2026 chosen lists his two goals by result; `/goals/cfr-contract` and `/goals/G-10` open 2026's pages, read-only; Find "G-10" finds it; in week 40 of 2026 his goal's page says "Q3 closed: Not met" once |
| U117 | `WRAP-UP`, `CARRY-GOALS`, `YEAR` | The year ends with nobody starting the next: on Mon 11 Jan 2027 with only 2026, the frame says "2026 has ended", nothing is due or late, results and Q4 are closed, an admin's Home offers "Start 2027", and starting it opens 2027 at once. Then a workspace whose only year is 2027, on Wed 11 Nov 2026: every screen says "2027 starts Mon 4 Jan 2027" and nothing is due. Runs twice more with `FARO_DEMO_RHYTHM=0` and with Reviews off: no "due", no review line |

U10 (today's "Close the cycle") is replaced by U114 and U115; its id is retired.

### F and N checks

| # | The check |
|---|---|
| F23 | At the turn of a year (the example at 21 and 28 Dec 2026, 4 and 11 Jan 2027, both widths), on Home, Goals, a goal, Cycles, the wrap-up, Results and the start page: every date shown has a year; no week is shown without its dates; no negative or zero week number is printed; no result word sits beside a status shape that disagrees (`__shapeAgrees`); the wrap-up form has no pressed choice before the person presses one; a past year's page has no enabled control that writes |
| N24 | Numbers agree: the read-back's four counts add up to the year's live goals, and equal what `startNextCycle` then makes; Results' four counts add up to the same; the wrap-up tabs' counts match their lists; Cycles' goal and check-in counts match Data's for that year; an unedited export of a past year loads back as "Nothing would change" in a workspace of the same year |

### Unit tests

Every table in section 5. Plus: `nextCycle` over the example makes no number goal whose direction differs from last year's, none with `start === target`, no stage due after `weeks`, no `fromWeek` above 0 except by `keep`; `carryExtras` then `undoStart` leaves the snapshot equal to the one before; `currentCycle` across every day from 14 Dec 2026 to 17 Jan 2027 with and without a 2027.

### Requirements (`evals/requirements.json`)

| Id | Area | Text |
|---|---|---|
| `WRAP-UP` (replaces `RETRO`) | Cycles | From two weeks before a cycle ends until four weeks after, each owner wraps up their goals: the result is worked out and shown with why; the owner says whether it is fair, and a different view needs a word and a reason and never changes the result; a last number older than two weeks is asked about first and saved as the final check-in; what was learned; and what happens next. Nothing is chosen for the owner |
| `RESULTS` | Cycles | A cycle ends on its last day whether or not the next is started: results and the last quarter close on the numbers there are, and nothing is due or late afterwards. Each year has a results page for everyone (counts in the result words; each goal's final number, owner's view and what was learned) and a Results sheet with the same. Any year's goals, pages, data and export stay reachable, read-only, by a year choice, an old link or a key |
| `CARRY-GOALS` (the id `CARRY-OVER` is the check-in's) | Cycles | An admin starts the next cycle from the day the wrap-up opens, after a read-back in counts that add up to every goal (carry on, finish, stop, not wrapped up yet), and can undo it until someone uses it. Everyone stays in the old cycle until its last day. A goal that met its target finishes; one that didn't carries on from its final number, from week 1, with its key, metric, watchers, open asks and place in reviews, and says what was assumed; no carried plan changes direction, starts late or has a stage after the year's end |

`YEAR` and `QUARTER-RESULTS` gain a sentence each: "A quarter that has just closed is said once on the goal's page and in its History, and says the week of the number it was judged on when that is old."

## 9. Help and What's new

### Help (`src/help/guide.ts`)

- **"Wrap up the year"** (rewritten; routes `/wrap-up`, `/wrap-up/:goal`; reqs `WRAP-UP`): when it opens and closes, with the rule; what the result is and who works it out; "fair, or not the whole story"; the final number; what happens next for a goal that met and one that didn't; who can.
- **"Results"** (new; route `/results/:year`; reqs `RESULTS`): the four words; the quarters; the owner's view beside the result; the export.
- **"Starting the next year"** (new; route `/workspace/cycles/next`; reqs `CARRY-GOALS`): what carries, finishes and stops; that nobody moves until the last day; Undo and when it ends; what a carried goal starts with.
- **"Last year’s goals"** (a section of the Goals article): the year choice, old links, keys.
- The Cycles, goal page (quarters, History) and Home articles gain a paragraph each. `src/help/flows.ts`: the `wrap-up` flow's routes change; a `start-next-year` flow is added.

### What's new (`src/help/whatsNew.ts`), one entry per item, newest first

| Item | Id | Title | Lines |
|---|---|---|---|
| CY1 | `year-ends` | "A year ends on its last day" | "Results and the last quarter close by themselves, and nothing is late after the year has ended." "Cycles gives each year’s real first and last day." |
| CY2 | `start-prepares` | "Starting next year doesn’t move anyone early" | "An admin can set next year up as soon as the wrap-up opens. Everyone stays in this year until its last day." "Before starting, you see what will carry on, finish and stop. Afterwards there is Undo." |
| CY3 | `last-year` | "Last year is still there" | "Goals, Data and Export have a year choice. Old links and keys open a goal as it ended." |
| CY4 | `carry-right` | "Goals carry on with their history" | "A carried goal keeps its metric, watchers and open next steps, and starts its plan in week 1." "A goal that met its target finishes instead of carrying on." |
| CY5 | `wrap-up-fair` | "The wrap-up shows the result and asks if it’s fair" | "Faro works the result out and says why. You say whether that’s fair; a different view needs a reason." "A last number more than two weeks old is checked first." |
| CY6 | `goal-carried` | "A carried goal says what was assumed" | "Its page says where it starts, its dates, and asks you to check the plan." (takes goal entry's GE8 entry) |
| CY7 | `results-page` | "Results for the year" | "One page: how many goals met, met late and didn’t, with each owner’s view and what they learned." |
| CY8 | `quarter-closed` | "A quarter says when it closes" | "The week after a quarter ends, your goal’s page and its History say how it closed." |

## 10. If Lane decides otherwise

| Decision (README) | Other answer | What changes |
|---|---|---|
| 1 | (b) Everyone moves when the admin presses, never before the last week | Rule 3 keeps today's seven-day rule; `startNextCycle` refuses before week `weeks`; week 0 of the new year and the last week of the old are the same days, so the old year's last check-in is the wrap-up's final number only. CY3 becomes urgent, not optional. `recarry` is not needed |
| 1 | (c) As today | Drop rules 3 and 6's `recarry`; keep everything else; Y1 stands |
| 2 | (b) The owner may change the result | `Retro` gains `resultOverride` (a second column, the three result codes); `goalResult` takes the retro; every place that says a result says "as its owner corrected it"; the vocabulary's "never changes the result" is rewritten. Not recommended: a result two people can't reproduce |
| 2 | (c) Owner's view only | Keep today's form without the pre-selection; drop `viewFor`, `why` and the migration |
| 3 | (b) A met goal carries, needing a new target | `carryOf` gives `carry` with `target: null` held as `pending`; the first check-in is blocked by a Must fix "Give {next}’s target"; `validateGoal` must allow a goal with no target for a while. More rule changes than (a) |
| 4 | (b) The next year can't start until all are wrapped up | `startNextCycle` refuses with the names; the read-back loses its fourth count; one absent owner holds everyone, so add "Wrap up for them" for admins (exists) to the refusal |
| 4 | (c) A goal nobody wrapped up stops | `carryOf` gives `stop` for it; the read-back says so in its fourth count |
| 5 | (b) Open until an admin closes it | `Cycle.wrapUpClosedAt` (a column on `okr_cycles`); `closeWrapUp` action and tool; Cycles gains "Close the wrap-up" |
| 5 | (c) Closes on the last day | `wrapUpWeeksAfter: 0`; `recarry` only before the turn; the final number must be in by the last day |
| 6 | (b) Without the open asks | `carryExtras` leaves `requests`; the read-back's line reads "{n} open next steps and asks stay in {year}" |
| 6 | (c) The goal alone | Drop `carryExtras`; Y3 stands |
| 7 | (b) No migration | `why` is saved as the first sentence of `learned`, after "Why: "; the Results sheet can't split them; drop section 4's SQL |
| 8 | (b) Also on Home | `yearEndRows` gives the owner a row for a week: "Q3 closed: {a} of your {b} goals met their plan" |
| 8 | (c) Silent | Drop CY8 but keep `asOfWeek` |
| The wrap-up is a switch (the switches area) | — | 2.11 and section 6 |

## 11. Build plan

Backlog-sized, in order. Effort: S under a day, M a release, L more than one. Each is one PR with its spec section (`npm run spec`), conformance rows, rebuild stage, evals, Help and What's new.

| Item | What | Sections | Effort | Depends on |
|---|---|---|---|---|
| **CY1** | **A year ends on its last day.** `cycleDates`, `cycleState`, `resultWeek`, `wrapUpOpenOn`; nothing due or late after the end; the frame, About and Cycles say the four states with real dates; the bare-week and "The year has ended" wording | Rules 1, 2; 2.5 (dates only), 2.9 (frame, About); U117 first half; `RESULTS` in part | S–M | WR4 (merged). FT1 only for the no-rhythm wording (build without it; FT1 adopts `asOfWeek`) |
| **CY2** | **Starting prepares, and can be undone.** `currentCycle` changed, `writable`, `beforeStart`; the start page with `startReadBack`; the guard against a second start; `canUndoStart`, `undoStart`; `start_next_cycle` dry run, `undo_start_cycle` | Rules 3, 4, 7, 9; 2.4, 2.5, 2.10; U115 first half, U117 second half | M | CY1. AR3 (merged). Set-up's ST10 waits on this |
| **CY3** | **Another year.** `viewedCycle`, `resolveGoal`, `previousOf`; the year choice on Goals, Data and Export; a past year's goal page; Find; `year` on the tools | Rule 10; 2.8; U116 second half; `RESULTS` in part | M | CY1. GL1 (merged); FS2 on Data and FS1's Find rows *held* (a plain select of years until then); GT1 for the History rows |
| **CY4** | **The carry rule.** `carryOf`, `finalNumber`, `nextCycle` rebuilt on it, `carryExtras`, `recarry`; the metrics module's `carry` | Rules 5, 6; the extension point; U115's assertions on the data; `CARRY-GOALS` | M | CY2. Takes over the last bullet of goal entry's rule 13 (GE9 keeps the rest). ML1–ML3 are not needed: links exist in the data today |
| **CY5** | **The wrap-up: the result, then the owner.** The list with its tabs; the form; `finalNumberCheck`, `viewFor`, `wrapUpMustFix`; `saveRetro` with `why`; the migration; `get_wrap_up`, `wrap_up_goal`; `/retro` redirects | Rule 8; 2.1, 2.2; section 4; U114; `WRAP-UP` | M | CY1, CY4. GE2 for the shared Check block (OB2's block if GE2 hasn't landed); NV2 for the form's exit. The check-in area's past-week correction (CK, `CHECK-IN-CORRECT`) if it changes how a check-in for a given week is posted |
| **CY6** | **A carried goal says what was assumed.** `carriedSays`; the summary and cells before a first check-in; the two History rows; the first check-in's "last time"; `earlierNumbers` for a goal that keeps its plan | 2.6; U115 second half | S–M | CY3, CY4. Replaces goal entry's GE8 (same line, more in it). GE4 for the link's target (the edit page's plan section exists today); OB2 *held* for the re-base |
| **CY7** | **Results.** `/results/<year>`, `resultsSummary`, the quarter tabs; the Results sheet's four columns; `get_results` | Rule 12; 2.3; U116 first half; `RESULTS` | S–M | CY1; CY5 for the owner's columns (the page is useful without them). FS2 *held* for the list bar (a plain filter row until then); IM1 for the field table's columns |
| **CY8** | **A quarter closing.** `quarterJustClosed`, `asOfWeek`; the line, the strip's mark and the History row | Rule 11; 2.7 | S | GT1 (merged). FT1 for nothing: `asOfWeek` is this item's |
| — | **Home's year-end rows** | 2.9 | Part of the Home area (HM) | CY1, CY2, CY5; HM's blocks |

**Order.** CY1 → CY2 → CY4 → CY3 → CY5 → CY6 → CY7 → CY8. CY1, CY2 and CY4 are fixes to what loses work today (Y1, Y4, Y5) and need no screen that is held; CY3 can run beside CY4 in the lists track. About five releases: CY1 with CY2; CY4; CY3; CY5 with CY6; CY7 with CY8.

**Tracks (round 2's).** "People, Workspace, Metrics" takes CY1, CY2, CY4; "Lists and the frame" takes CY3 and CY7; "One goal" takes CY5, CY6, CY8.

## 12. What this changes in rounds 1 and 2

The table is in the README ("What this changes in rounds 1 and 2"). For a build session, the ones that touch code another item owns:

- **Workspace WR4** (merged): `cycleLine`, `yearLine` and Cycles' actions change in CY1 and CY2; the first conformance row of Workspace rule 6 changes its dates.
- **Goal entry GE8** is built as CY6; **GE9** loses the `nextCycle` bullet to CY4.
- **Set-up ST10** drops its spike and depends on CY2.
- **Feature toggles FT1**: `startNextCycle` sets `rhythmFrom` to week 1's Monday; its no-rhythm `asOfWeek` and this spec's ended-year `asOfWeek` are one field.
- **Import IM1/IM7**: four worked-out columns on the Results sheet; Export gains "Which year".
- **Find FS1**: `findGoals` takes other years' goals.
- **U10** is retired for U114 and U115; **`RETRO`** for `WRAP-UP`.
- **`docs/design-rules.md` line 35** should name the results "Met, Met late, Not met" (a docs fix in CY7's PR).
