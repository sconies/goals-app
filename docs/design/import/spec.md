# Bulk import and export: the build spec

11 November 2026. The build spec for `README.md` beside this file. Design and spec only; nothing here is built. It stays the `spreadsheets` module (`src/modules/spreadsheets`) over the one engine (`src/domain/changeset.ts`) and the one format (`src/domain/columns.ts`). Finding ids (I1…) are the README's. Shared decisions are `docs/design/round-2/README.md`'s. **This file owns the field table (section 3) and the validation model (section 4)**; the goal-entry and set-up specs refer to them.

## 1. Routes

| Route | Screen | Notes |
|---|---|---|
| `/data/import` | Import: the way in | As today. `?paste=1` opens the paste box |
| `/data/import/check` | The preview | Client state (the file is in memory); a reload returns to `/data/import` with "Choose the file again: nothing was saved." |
| `/data/import/check/changes` | The changes list | `?show=added|changed|stopped`, `?q=`, `?from=51` |
| `/data/import/done/<importId>` | Imported | Reloadable: read from the change log |
| `/data/imports` | Past imports | The list bar (find spec 2.1): search, When, Who, How |
| `/help/columns` | Help: every column | Article `columns`; `#goals`, `#plan`, `#check-ins`, `#people` |

### Redirects

`/import` → `/data/import` (exists). Nothing else moves.

## 2. Screens

Wording is exact. `{n}` is a number written with digit grouping (1,000). Plurals follow the count.

### 2.1 Import (`/data/import`)

In order:

1. Back link "‹ Data". Title **Import**. One line: "Add or change goals, plans, check-ins and people from a spreadsheet. You see every change before anything is saved, and one Undo takes a whole import back."
2. The drop area: "Drop a file here"; "An Excel workbook (.xlsx), a .csv, or a .zip of CSVs. Up to 5,000 rows a file."; **Choose a file** (primary); link "or paste rows from a spreadsheet".
3. Two columns: "Starting from nothing" / "The template has every column, says which are required, and carries two example rows that are never imported." / **Download the template**. "Changing what's here" / "The workbook is every goal, plan, check-in and person as they are now. Change cells, add rows, load it back." / **Download the workbook**.
4. "What a new row must have": three rows made from the field table by `requiredLine(kind)` (rule 2): "A goal", "A check-in", "A person"; link "Every column, with its format and an example" → `/help/columns`.
5. "Past imports": the newest three (2.7's rows), link "All {n} past imports". Absent when there are none.

- A non-admin has, under the one line: "You can add and change your own goals and their check-ins. Rows for other people's goals are fine if you leave them as they are. {admins} can change anyone's, and add people." `{admins}` is up to three names then "or another admin".
- **Paste**: a field "Paste rows from a spreadsheet", hint "Copy the cells in Excel or Sheets, the header row included, and paste them here.", link "Copy the Goals headers" (a menu when opened: Goals, Check-ins, People; copies the fill-in columns tab-separated), primary **Check these rows**. Empty: the button is disabled. No header row found: "The first row should be the headers (Goal, Owner, Start…). Copy them from here: [Copy the Goals headers]."
- **Errors on this page** (role="alert", under the drop area):
  - Not a spreadsheet: "Faro can't read {name}. Save it as .xlsx or .csv and try again."
  - No sheet recognised: "Nothing in {name} looks like a Faro sheet. Its first sheet's headers are {first five headers}… Faro looks for Goal and Owner (goals), Goal key and Week (check-ins), or Name and Email (people). The template has the right headers. [Download the template]"
  - Over 30,000 rows or 20 MB: "{name} has {n} rows. Faro reads up to 30,000 in one file. Split it and import each part."

### 2.2 Reading (`/data/import`, while the worker runs)

Shown when checking takes more than 400 ms. Title "Reading {name}". "You can keep using Faro in another tab. Nothing is saved until you say so." A panel: "Read the file · {s} sheets, {n} rows — Done"; "Checking each row · {k} of {n} — {p}%"; a bar; "So far: {a} would be added, {c} changed, {m} must be fixed."; link **Stop** ("Stopped. Nothing was saved.").

### 2.3 The preview (`/data/import/check`)

Title **Check this import**; under it "Nothing has been saved." In order:

1. **The file line** (`readLine`, rule 5): "{name} · Read {sheets}. Not read: {sheets} (for reading only); {sheets} (not a Faro sheet); the column(s) {headers} on {sheet}." Parts with nothing are left out. Then, if any: "Row {r} of {sheet} is the header row; {r−1} row(s) above it were skipped." and "{n} example row(s) left out."
2. **Counts**: a table at 700 px and wider (Sheet, Rows read, Added, Changed, Stopped or left, Unchanged, Must fix, Check), one row per sheet read; below 700 px one sentence per sheet with the zero parts left out.
3. **Must fix** (absent when none): heading "Must fix" and "{n} rows, {k} kinds of problem". One block per group (rule 6), largest first. Each: the group's title; one hint line saying where ("Goals, rows 18 to 31", or the first three rows then "and {n} more") and the fix; the answers, when the group is answerable (section 4's Answer column); link "Show the {n} rows" (the rows as a small table of row number, name and the cell at fault, 50 at a time). The block has the off-track wash and a full hairline outline; the warning mark sits before the title. Under the blocks: button **Download the {n} rows to fix** (n counts rows in groups not answered) and link "Leave these {n} rows out and save the rest" (decision 1).
4. **Check** (absent when none): heading "Check" and "{q} questions cover {n} rows", then "{a} of {q} answered" once any is. One block per group: the question as its title; one hint line with an example; the answers as radio rows, none chosen; "Show the {n} rows". Answered, a block closes to one line, "{what was asked}: **{answer}**", with "Change".
5. **What will be saved**: one sentence (`describe`, extended with "{u} rows are unchanged" and "{l} are left out") and link "Show the {n} changes".
6. **Plan changes that need a reason** (as today): the field "Why are these plans changing?" appears above the foot when any plan change needs one.
7. **Foot**:

| State | Left | Right (primary) | Line |
|---|---|---|---|
| Rows to fix remain | — | **Choose the corrected file** | "{n} rows must be fixed and {q} questions answered before this can be saved." |
| Only questions remain | Choose another file | Save {n} changes (disabled) | "Answer {q} questions to save." |
| Ready | Choose another file | **Save {n} changes** | — |
| Nothing would change | — | **Choose another file** | — |
| Over the limit | — | **Choose another file** | 2.8 |

- **Nothing would change**: a panel, "Nothing would change" / "All {n} rows say what Faro already says." When worked-out cells differ: "On {k} rows, {columns} differ from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in."
- **A corrected file**: answers given before are applied where the same group appears; the page says "Your {k} answers still apply."
- **Leaving rows out** opens a sheet: "Leave {n} rows out?" / "These {n} rows won't be saved, nor will {d} rows that depend on them ({what}). Everything else will." / the list / "Download these rows" / **Leave them out** / Cancel. After it, section 3 of the page says "{n} rows were left out at your choice. Download them · Put them back".

### 2.4 The changes (`/data/import/check/changes`)

The list bar: search "Find a goal, a person or a key"; All {n}, Added {n}, Changed {n}, Stopped {n}. Count line: "{n} changes, in the file's order. Showing {a} to {b}." Rows: the record's name and key ("new, will be G-127" for a new goal); "{sheet}, row {r} · {what}" (added, changed, plan changed, replaces {name}'s check-in for week {w}, stopped, deleted, left); then field: ~~before~~ → after. A value Faro supplied carries its source in brackets: "(her team; the row gave none)", "(from Start and Target; the row gave none)", "(matched by name)". **Show 50 more**. Foot: "Back to the summary", **Save {n} changes**.

### 2.5 Imported (`/data/import/done/<importId>`)

Title **Imported**. Panel: "Saved {n} changes from {name}." / the counts sentence / "{l} rows were left out. Download them" / **See the goals** (primary, to `/goals`) and **Undo this import**. Line: "Undo stays on Data, under Past imports, and on this import's line in Activity." Undone: "This import was undone on {date} by {name}." and no Undo. If the save fails: stay on the preview with "Nothing was saved: {reason}. Try again."

### 2.6 Undo (a sheet, from 2.5, 2.7 and Activity)

`undoPreview` (rule 9) runs first.

- All rows can go back: "Undo {name}?" / "{n} rows go back to how they were on {date}." / Cancel, **Undo {n} rows** (danger).
- Some can't: "… {k} stay as they are, because they changed after the import:" and the list, each with its reason: "{who} posted a check-in for week {w} on {date}", "Its {field} was changed on {date}", "The check-in was corrected on {date}", "{name} has made changes since".
- None can: "Nothing left to undo: all {n} rows have changed since." / Close.
- After: toast "Undone: {n} rows put back." and the line shows "Undone on {date} by {name}."

### 2.7 Past imports (`/data/imports`)

Title **Past imports**; "Every import, bulk edit and change through MCP, newest first. Whoever made one, or an admin, can undo it." A hairline list, one row per change-log entry with `action: 'imported'`: the file's name (or "Bulk edit on Data", "Bulk edit on Goals", "Changes through MCP"); "{who} · {when} · {how} · {counts}"; a second line when relevant ("{k} of its {n} rows have changed since, so Undo would put back {m}." / "Undone on {date} by {name}."); **Undo** or **Undo {m} rows** for those who may. Empty: "Nothing has been imported yet. [Import]". Count line: "{n} imports, newest first."

Activity: an import is one entry, "{who} imported {name}: {counts}", with "Undo this import" and "Show the {n} changes"; its row entries are folded under it and still found by search and on each goal's own history.

### 2.8 Large files

- The limit line in 2.1. Constants in `src/domain/importLimits.ts`: `ROWS_COMFORT = 5000`, `ROWS_READ_MAX = 30000`, `CHANGES_SAVE_MAX = 5000`, `PAGE = 50`.
- A file that would change more than `CHANGES_SAVE_MAX` rows: the preview is complete; in place of Save, a Check-styled block: "This file would change {n} rows. Faro saves up to 5,000 at a time" / "Faro is a model, and it checks and saves in your browser. Split the file by team or by sheet and import each part; every part has its own Undo." / **Download as {k} files of 5,000 rows** (split so a goal's plan and check-ins stay with it, parents before children).

### 2.9 Export (a sheet; from Goals and from Data)

Title **Export**. "Which goals": "The {n} shown now: {view}" and "Everything in {cycle}" with "{g} goals, {c} check-ins, {p} people" (absent when nothing is filtered). One paragraph: "An Excel workbook: Goals, Plan, Check-ins and People, which load back, and Results, Asks, Notes and Metrics for reading. Its first sheet says what each column means and which are required." Link "Other formats" (CSV files, zipped; One sheet as CSV, with the sheet chosen in the row; JSON; A brief for an AI chat with Copy and Save .md). Primary **Export .xlsx**. Foot note: the file's name, then "Exports hold names and owners' reasons. Share them as you would the app." After: toast "Exported {name}".

Data's list bar: **Export** (menu: "This table, as shown (.xlsx)" with "{n} rows, {c} columns, plus {keys} so it loads back."; "This table, as shown (.csv)"; "Everything…") and **Import** (link). On a phone both are in the bar's sheet.

File names (`fileName`, `src/app/files.ts`): `{workspace}-{what}-{scope}-{yyyy-mm-dd}.{ext}`; scope is `all`, the view's slug, or `as-shown`. Template `faro-template.xlsx`. Rows to fix `{original}-rows-to-fix.xlsx`. Left out `{original}-left-out.xlsx`. Parts `{original}-part-{i}-of-{k}.csv`.

### 2.10 The template and the workbook's first sheet

- First sheet **Start here** (replaces README; the name README is still recognised and skipped): line 1 as today, plus `Workspace id` and `Cycle id` in cells B1 and C1 of a row "File of" (read by rule 5); then, per sheet that loads back, the field table's columns: Column, A new row, Format, Example, If it's left empty, What it means.
- Template sheets Goals, Plan, Check-ins, People carry only match, edit and action columns; headers of Required columns in bold. Goals has two example rows and People one, each with **Example** in Action.
- The full workbook keeps its worked-out columns, greyed, as today.

### 2.11 Help: every column (`/help/columns`)

Wireframe 8. Tabs per sheet with the count of fill-in columns; a line per sheet ("One row per goal. A row with no Key is a new goal. A new goal needs the 2 columns marked Required, and the ones its type needs."); the table; "{n} more optional columns: show them all." Primary **Download the template**.

## 3. The field table

`columns.ts` gains on every column: `required`, `format`, `example`, `empty` (what an empty cell means on a new row and on an existing row) and `also` (other header names read as this column). The tables below are the specification of those values. "Today" is what `planChanges` does on 11 Nov; where the design changes it, the row is marked ▲ and listed in 3.6.

Required is one of: **Required**; **Required for {type}**; Optional (with its default); Leave empty; Worked out.

On an existing row (one with a Key or ID), no column is required. "Empty keeps" means an empty cell leaves the record as it is; "Empty clears" means it removes the value. A column missing from the file always keeps.

### 3.1 Goals (loads back; one row per goal)

| Column | A new row | Format | Example | Existing row, empty cell | Must fix (exact words) | Check (exact words) |
|---|---|---|---|---|---|---|
| Key | Leave empty | G- and a number | G-12 | — | "Key “{v}” should look like G-12." · "There's no goal with key {k} in {cycle}. Leave Key and ID empty to add a new goal." · "Key {k} is on rows {a} and {b}. Give each goal one row." ▲ (names both rows) · "Key {k} isn't this goal's key ({real}). A goal's key never changes." | "{k} is “{title}” here, owned by {owner}. Row {r} calls it “{new}”, with another owner and team. Is it the same goal?" → Yes, change it / No, add it as a new goal / Leave it out ▲ |
| ID | Leave empty | Faro's own | goal_hzde4g | — | "There's no goal with ID {v} in {cycle}. Leave ID empty to add a new goal." | — |
| Goal | **Required** | Text, 3 characters or more | Deploy lead time | Keeps | "Name the goal in the Goal column." · "Give the goal a name of at least three characters." | "{n} new goals have a name their team already uses: “{title}” ({key}, {team})." → They're new goals / They're the same: change {key} / Leave them out ▲ (today Must fix: "A goal called … already exists…") |
| Action | Optional: none | Stop, Delete or Example | Stop | Does nothing | "Action says “{v}”. Use Stop, Delete or Example, or leave it empty." · "Stop needs a goal already here: its Key." · "A row that says {Stop} can't also change the goal. Make the change, or the stop, on its own." · removal's own refusals, as today | — |
| Level | Optional: team | north star, svp or team | team | Keeps | "Level says “{v}”. Use north star, svp or team." | Near miss: "Level says “{v}” on {n} rows. Read it as {word}?" |
| Team | Optional: the owner's team | A team's name | Platform | Keeps | "{n} rows name a team that isn't here: “{v}”." (no near match; answerable: Choose a team / admin: Add {v} as a new team ▲) | Near match: "{n} rows name a team that isn't here: “{v}”. Did you mean {team}?" → Use {team} / Add {v} as a new team (admin) / Choose another team ▲ |
| Owner | **Required** (or Owner email) | A name only one person has | Ben Ortiz | Keeps | "A new goal needs an owner: Owner email, or Owner." · "“{v}” isn't in this workspace." + "Add them on the People sheet, or check the spelling." · "{n} people are called “{v}”. Use their email instead ({emails})." · "You can add goals you own. Ask an admin to add goals for other people." | Near match: "“{v}” isn't here. Did you mean {name}?" → Use {name} / Choose someone else ▲ |
| Owner email | **Required** (or Owner) | An email | ben.ortiz@example.com | Keeps | "“{v}” isn't an email." · "No one here has the email {e}. Add them on the People sheet, or check it." · "Owner and Owner email name different people ({a} and {b}). Change just one of them." | Near match on the part before @, same domain: "No one here has {e}. Did you mean {email}?" ▲ |
| Type | Optional: read from the row ▲ | metric, range or milestone (also: number, stages) | metric | Keeps; can't change | "Type says “{v}”. Use metric, range or milestone." · "A goal's type can't change. Add a new goal instead." · "Type is empty and the row has {both}. Say metric, range or milestone." ▲ · "Type is empty and the row has no Start and Target, Limit or Stages. Add them, or say the type." ▲ | Near miss, as Level |
| Unit | Optional: no unit ▲ (today "%" when the column is missing) | Text | days | Clears | — | "{n} number goals have no unit, so their numbers will show bare (10 → 50)." → That's right / Leave them out ▲ |
| Decimals | Optional: the most places typed in Start, Target or Limit, up to 3 | 0, 1, 2 or 3 | 1 | Keeps | "Decimals says “{v}”. Use 0, 1, 2 or 3." | — |
| Start | **Required for a number goal** | A number | 5 | Keeps | "Start is empty. A number goal needs where it starts." ▲ (today "Enter where it starts.") · `notNumberText` with the goal's decimals · the precision sentence, as today · "Start holds a formula (“{v}”), not a number. In Excel, copy the column and paste it as values." ▲ | See Target |
| Target | **Required for a number goal** | A number, different from Start | 1 | Keeps | "Target is empty. A number goal needs a target." ▲ · "The target has to differ from the start." · not a number, precision, formula as Start | "Below zero {unit}. Is the sign right?" · "The target is over 100 times the start ({a} to {b}). Is that right?" · "Over 100%. If this is a share of something, it can't pass 100%. Is {b}% right?" · "That's a billion or more. Is it right?" · a typed unit that isn't the goal's: "“{v}” was read as {n}, but this goal counts {unit}." → each: It's right / Leave these rows out ▲ (today notes) · on an existing goal: `planQuestion`'s two, as today |
| Plan | Optional: straight | straight, back-loaded or stepped | back-loaded | Keeps | "Plan says “{v}”. Use straight, back-loaded or stepped." | Near miss, as Level |
| Plan from week | Optional: this week (0 at set-up) | A whole number, −104 to 104 | 46 | Keeps | "Plan from week should be a whole number of weeks from the cycle start." | — |
| Due week | Optional: the cycle's last week | A whole number, 1 to 104, after Plan from week; a date in the cycle is read as its week ▲ | 53 | Clears to the cycle's last week | "Due week should be a whole number of weeks from the cycle start, up to 104." · "Due week ({d}) has to come after the plan starts (week {f})." ▲ (today only when the file has Plan from week: I11) · "“{date}” isn't in {cycle}, which runs {start} to {end}." ▲ | — |
| Limit | **Required for a range goal** | A number | 5 | Keeps | "Limit is empty. A range goal needs its limit." ▲ · not a number, precision, formula | "Below zero {unit}. Is the sign right?" |
| Must stay | Optional: at most | at most or at least | at most | Keeps | "Must stay says “{v}”. Use at most or at least." | Near miss |
| Margin | Optional: 1 | A number, zero or more | 0.5 | Keeps | "Enter a warning margin of zero or more." · not a number, precision | — |
| Stages | **Required for a stages goal** | Name@week; Name@week (week 1 to the cycle's last; a date in the cycle is read as its week ▲) | Design@48; Pilot@52 | Keeps | "Stages is empty. A stages goal needs at least one stage." ▲ · "Every stage needs a name." · "“{part}” has no week. Write it as Name@week, like Pilot@52." ▲ (today "Every stage needs a due week between 1 and 53.") · "“{part}”: week {w} is past the end of {cycle} (week {last})." ▲ | "{n} stages on {g} new goals are due before this week (week {w})." → They're done / They're not done / Count them from this week ▲ (onboarding rule 3, in bulk) |
| Feeds into | Optional: nothing | A goal's name | Deploy lead time | Clears the link | "“{title}” feeds into “{v}”, which isn't a goal in {cycle}." · "Several goals are called “{v}”. Use Feeds into key to say which." · "A goal can't feed into itself." · "That link would make a loop: the goal it feeds already feeds into it." | Near match: "“{v}” isn't a goal here. Did you mean “{title}” ({key})?" ▲ |
| Feeds into key | Optional | G-12 | G-1 | Clears the link | "Feeds into key {v} isn't a goal in {cycle}." · "Feeds into and Feeds into key name different goals. Change just one of them." | — |
| Why it helps | Optional: empty | Text | Fewer failed deploys mean fewer rollbacks | Clears | — | — |
| Effect | Optional: empty | A number, in the fed goal's unit | 1 | Clears | `notNumberText` | — |
| Source | Optional: empty | Text | CI dashboard | Clears | — | — |
| Definition | Optional: empty | Text | Median hours from first commit to production | Clears | — | — |
| Reason | **Required with Stop, and when a plan changes after check-ins began** (or one reason given in the preview) | Text | Agreed at the Q4 review | — | As today: the preview's field; removal's "Say why…" | — |
| Status, Since, Now, Plan this week, Gap, Last check-in week, Forecast, Why it's off, Recovery plan, By when, Needs, Next step, Warnings, Result, Q1 to Q4 | Worked out | — | — | — | Never | Never. A cell that differs from what Faro would write today is counted and said (2.3) ▲ |

Other header names read (`also`): Goal: "goal name", "title", "objective", "name" (only on a sheet with Owner); Owner: "owner name"; Owner email: "owner e-mail", "owner email address"; Start: "baseline", "from"; Target: "target value", "goal value"; Unit: "units"; Due week: "due", "deadline week"; Team: "team name"; Level: "goal level"; Type: "goal type". Read as Reason: "reason for change" (today).

### 3.2 Plan (loads back; one row per number goal)

| Column | A row | Format | Example | Empty cell | Must fix | Check |
|---|---|---|---|---|---|---|
| Key | **Required** (or ID) | G-12 | G-12 | — | "Add the goal's key or ID so the plan can be matched to it." · "There's no goal with key {k}." · "Only number goals have plan numbers." | — |
| ID | Or Key | Faro's own | | — | "There's no goal with ID {v}." | — |
| Goal, Unit | For reading | — | — | — | Never | — |
| Start | Optional | A number | 5 | Keeps | "Start: " + not a number / precision | `planQuestion` "far", as today |
| Week 1 … Week N | Optional | A number, only for weeks inside the plan | 4.2 | Keeps the plan's own number | "Week {w}: " + not a number / precision · "Week {w} is outside the plan, which runs from week {a} to week {b}. Change Plan from week or Due week on Goals first." · "The target has to differ from the start." · "This file also stops or deletes “{title}”, so its plan can't change in it." · `notYours` | `planQuestion`, as today |

A week's number counts as typed only when it differs from the plan's own number **as the export would write it** (rule 8). ▲

### 3.3 Check-ins (loads back; one row per goal and week)

| Column | A new row | Format | Example | Existing row, empty cell | Must fix | Check |
|---|---|---|---|---|---|---|
| ID | Leave empty | Faro's own | | — | "There's no check-in with ID {v} on this goal. Leave ID empty to add a check-in." · "Check-in {id} is for week {w}; a check-in's week can't change." · "Check-in {id} appears twice." | — |
| Goal key | **Required** (or Goal ID, or Goal) | G-12 | G-14 | — | "There's no goal with key {k}." | — |
| Goal ID | Or Goal key | Faro's own | | — | "There's no goal with ID {v}." | — |
| Goal | Or Goal key | The goal's exact name, when only one goal has it | Pipeline queue wait (p90) | — | "There's no goal called “{v}”. Add the Goal key column to be exact." · "…that only one goal has…" | Near match: "“{v}” isn't a goal here. Did you mean “{title}” ({key})?" ▲ |
| Week | **Required** | A whole number from 1 to this week; a date in the cycle is read as its week ▲ | 46 | — | "Week should be a whole number from 1, counted from the start of the year." · "Check-ins start in week 1; week 0 is the start of the year." · "Week {w} hasn't happened yet; it's week {now}." · "Week {w} appears twice for this goal (rows {a} and {b})." ▲ | — |
| Week starting | Worked out | | | | Never | — |
| Value | **Required for a number or range goal** | A number at the goal's decimals | 6 | Keeps | "Week {w}: " + "Type this week's number." / not a number / precision / "It can't be below zero {unit}." / "It can't be over 100%: this goal measures a share of something." Precision is answerable: "Keep {d} decimal place(s) for these {g} goals" ▲ | "{n} check-ins are far from the last number." (the app's own: over three times or under a third of the last value) · "…far outside the goal's plan." · "…over 100%." · "…past the target." → They're right / Leave these rows out ▲ (today not asked: I4) |
| Stages | **Required for a stages goal** | "Pilot: done week 6; Rollout: expected week 9" | Pilot: done week 6 | Keeps | "Stages: “{part}” should look like “Pilot: done week 6” or “Pilot: expected week 8”, using the stage's name." | Near match on a stage's name ▲ |
| Call | Optional: the rules decide | On track, At risk, Off track or Done (also green, amber, red) | At risk | The rules decide | "Call says “{v}”. Use On track, At risk, Off track or Done, or leave it empty to let the rules decide." | — |
| Cause | **Required when behind, or well ahead** | One of the app's causes | Blocked by a dependency | Clears | "Cause says “{v}”. Use {list}." · with Why: "Week {w} needs a Cause and a Why of 10 characters or more (it's behind plan)." | — |
| Why | **Required when behind, or well ahead** | Text, 10 characters or more | Runner pool was halved for the migration | Clears | As Cause | — |
| Why greener | **Required when Call is better than the rules say** | Text, 10 characters or more | | Clears | "Week {w} needs Why greener (the call is greener than calculated)." | — |
| Path to green | **Required when behind** | Text, 8 characters or more | Add 20 runners by week 48 | Clears | "Week {w} needs a Path to green and, if it's a plan, Back on plan by week (after week {w}, by week {last})." | — |
| Recovery | Optional: Plan | Plan, Still investigating, Needs a decision or help, Target should change | Plan | Plan | "Recovery says “{v}”. Use {list}." | — |
| Back on plan by week | **Required when Recovery is Plan and it's behind** | A week after this one | 48 | Clears | "Back on plan by week: “{v}” isn't a week." | — |
| Needs | Optional | Text | A decision on runner budget from Amara | Clears | — | — |
| Next step | Optional | Text | Order runners | Clears | — | — |
| Calculated, Plan that week, Posted at, Posted by, Posted by email, Backfilled | Worked out | | | | Never | — |

Also for the sheet: "Replaces {name}'s check-in for week {w}." moves from a warning to **fine, said on the change** when the person is the goal's owner or an admin, and is a **Check** when {n} ≥ 10 rows replace other people's check-ins in one file: "{n} rows replace check-ins other people posted." → Replace them / Leave these rows out. ▲ `notYours` and "This file also says {Stop} for…" stay Must fix. In create mode, "Week {w} is taken as it was recorded." stays a note on the change.

### 3.4 People (loads back; one row per person; admins only)

| Column | A new row | Format | Example | Existing row, empty cell | Must fix | Check |
|---|---|---|---|---|---|---|
| Email | **Required** | An email | ana.silva@example.com | "Their email can be changed, not taken away. Type it back in." | "Add {name}'s email: everyone new needs one." · "“{v}” doesn't look like an email." · "{name} already has the email {e}: each person needs their own." | A new email with the exact or near name of someone here: "“{name}” ({e}) looks like {existing} ({team}), who is already here." → The same person: give {existing} this email / Someone new ▲ (today a note) |
| ID | Leave empty | Faro's own | | — | "There's no person with ID {v}. Leave ID empty to add someone." | — |
| Name | **Required** | Text | Ana Silva | Keeps | "Add their name." · "{n} people are called “{v}”. Add their email or ID to say which." · "{name} has another row in this file. Give each person one row." | — |
| Action | Optional: none | Left or Example | Left | Does nothing | "Action says “{v}”. Use Left or Example, or leave it empty." · "Left needs someone already here: their email or ID." · "Only an admin can mark someone as left." · removal's own | — |
| Job title | Optional: empty | Text | Platform lead | Clears | — | — |
| Team | Optional: no team. **Required at set-up** | A team's name | Platform | Clears | "{name} has no team." (set-up) · as Goals' Team | As Goals' Team; at set-up, two team names in the file that are near each other: "The file names “{a}” ({n} people) and “{b}” ({m}). One team or two?" ▲ |
| Admin | Optional: no (the first person at set-up is an admin) | yes or no | yes | Keeps | "Admin should be yes or no, not “{v}”." | "{n} people would become admins." when n ≥ 3 → That's right / Leave these rows out ▲ |
| Team objective | Optional | Text, on the team lead's row | Make every deploy safe and fast | Clears, on the lead's row | "Only an admin can change a team's objective." | — |
| Takes over | **Required with Left when they own goals, asks or teams** | An email, or a name only one person has | chloe.wu@example.com | — | "Takes over: “{v}” isn't here." ▲ (today "isn't an email", though a name is allowed) · removal's "say who takes them over in Takes over" | Near match, as Owner |

For anyone who isn't an admin, any change on this sheet is one Must-fix group: "{n} rows change people. Only an admin can add or change people." → Leave these rows out.

### 3.5 Sheets for reading only

Results, Asks, Notes and Metrics are written and never read back (`loaded: false`). Every column is "For reading" or "Worked out". On import each is named in the file line as "(for reading only)". With Reviews switched off (shared decision 6) the Notes sheet and the Review column of Asks are not written.

### 3.6 Changes to today's rules

For the lead to reconcile with goal entry, which reads the same code. Each is ▲ above.

| # | Today | Proposed | Why |
|---|---|---|---|
| C1 | A new row with no Type is a number goal (`changeset.ts:403`) | Type is read from which of Start/Target, Limit, Stages are filled; two groups filled, or none, is Must fix; the preview says "from Start and Target; the row gave none" | I2 |
| C2 | A file with no Unit column gives "%" (`goal.ts:44` through `changeset.ts:404`) | No unit; one Check per file | I2. The form may keep "%" as its visible default |
| C3 | Due week before the plan's start is refused only when the row has Plan from week (`:424`) | Always checked against the start the goal will have | I11 |
| C4 | A stage due before this week is accepted (Import) or moved with a note (set-up) | One Check with three answers; set-up's default answer is "Count them from this week" | I11; onboarding rule 3 |
| C5 | A key that exists is the goal, whatever the row says | A Check when the row's name, owner and team all differ from the goal's | I5 |
| C6 | Number questions are notes (`:454`); a check-in's soft questions aren't asked (`:702`) | Checks that need an answer | I4 |
| C7 | A name, team, word or header not found is refused | A near miss is a Check with the near match first; "&"/"and", punctuation and accents fold to a match | I3, I12 |
| C8 | A team that isn't here is refused outside set-up | An admin may answer "Add it as a new team" | Decision 5 |
| C9 | The same name with a new email is a new person, noted | A Check | I18 |
| C10 | A new goal with a name its team has is refused (`:376`) | A Check: new, or the same goal | It is "possible but unlikely", shared decision 2 |
| C11 | A row's Action is checked only when nothing else is wrong (`:759`) | Checked in the same pass (against the workspace as it would be without the faulty rows) | I9 |
| C12 | A plan week equal to the stored number rounded at half a unit counts as typed (`:551`) | Compared with the number as the export writes it | I7. A bug: IM0 |
| C13 | Check-in problems are listed by goal (`:610`) | Issues carry their row and are grouped by kind, then row | I9 |
| C14 | A duplicate row: the second is refused | Both rows are named and neither is applied | I9 |
| C15 | Action takes Stop, Delete (Left) | Also Example: the row is skipped and counted | The template's example rows |
| C16 | Week, Due week and a stage's week take numbers only | A date inside the cycle is read as its week and said on the change | I18 |
| C17 | The header row is row 1 and headers are exact | Found in the first ten rows; `also` names; near misses asked; a People sheet needs Name or Email **and** one more People header | I12, I10 |
| C18 | "Replaces {name}'s check-in" is a warning per row | Fine and said on the change; a Check from ten rows | I4 |
| C19 | Unknown columns, and edited worked-out cells, are dropped silently | Named in the file line; counted | I8 |
| C20 | A missing required number says "Enter where it starts." | Names the column: "Start is empty. A number goal needs where it starts." | Shared decision 2's wording rule. The form keeps its own field-side words |

Not changed: who may change what; matching by key then ID, and people by email; all-or-nothing by default; reasons for plan changes; every check-in rule; create mode keeping the file's keys.

## 4. The validation model

Every issue the engine raises has a `kind`. The level is fixed per kind. "Answer" means the group can be settled in the preview; otherwise it is fixed in the file. Worked examples use the demo (week 46 of 2026).

### Must fix

| Kind | Raised when | Title of the group | Answer in the preview | Worked example |
|---|---|---|---|---|
| `required-empty` | A required column is empty on a new row | "{n} new goals have no owner" / "…no Start" / "{n} new people have no email" | — | `02-no-owner-column.csv`: 2 rows → one group |
| `not-a-number` | Text in a number column | "{n} {things} have text where a number goes" | — | Check-ins row 3, Value "six" |
| `formula` | A number cell starting with = | "{n} cells hold a formula, not a number" | — | Target "=20+2" |
| `precision` | More decimal places than the goal keeps | "{n} numbers have more decimal places than their goal keeps" | Keep {d} decimal places for these {g} goals (owner or admin of each) | 27,000 rows on 900 goals → one group, one answer |
| `impossible-number` | Below zero for a count, time, money or share; over 100% of a share | "{n} numbers can't be right" | — | −4 % |
| `unknown-word` | A word the column doesn't know, with no near miss | "{Column} says “{v}” on {n} rows" | Choose from the column's words | Level "vp" ×3 → Choose: north star, svp, team |
| `unknown-ref` | A person, team or goal that matches nothing, with no near miss | "{n} rows name a {thing} that isn't here: “{v}”" | Choose a {thing} (find-and-pick); for a team, admins: Add as a new team | "CI CD" has a near miss, so it's a Check; "Infra Guild" is this |
| `ambiguous-ref` | A name two or more records share | "{n} rows say “{v}”, and {k} people are called that" | Choose which | Two "Sam Lee" |
| `conflicting-refs` | Owner and Owner email, or Feeds into and its key, disagree | "{n} rows name two different {things}" | — | |
| `bad-key` | A key that isn't one, or matches nothing | "{n} keys don't look like G-12" / "{n} keys aren't goals in {cycle}" | — | "12"; G-999 |
| `duplicate` | One record, or one goal and week, on two rows | "{n} goals appear on more than one row" | Use the last row for each / Use the first | G-1 on rows 2 and 3 |
| `type-unclear` | No Type, and the row fills in none or two of the type groups | "{n} new goals don't say what type they are" | Choose a type, when exactly the needed columns for it are present | Stages and Target both filled |
| `plan-order` | Due week not after the plan's start; a plan week outside the plan | "{n} plans end before they start" | — | From 46, due 10 |
| `stage-format` | A stage with no name, no week, or a week past the cycle | "{n} stages can't be read" | — | "Design" with no @week |
| `week-wrong` | Week 0, a future week, not a week | "{n} check-ins are for weeks that haven't happened" / "…have no week" | — | Week 50 in week 46 |
| `checkin-incomplete` | A check-in the app's form would not post (cause, why, path, why greener) | "{n} check-ins that are behind plan don't say why" (one group per missing part) | — | G-126 4.1 USD with no Cause |
| `cant-change` | Type on an existing goal; a check-in's week; an email taken away; a goal this file also stops | "{n} rows change something that can't change" | — | |
| `not-allowed` | The person may not make the change | "{n} rows change goals you don't own" / "{n} rows change people. Only an admin can…" | Leave these rows out | Tunde, G-1's target |
| `removal-refused` | Stop with no reason; Delete on a goal with check-ins; Left with no one to take over | removal's own sentence, counted | — | |
| `loop` | A feeds-into link to itself or round a loop | "{n} goals would feed themselves" | — | |

### Check

| Kind | Raised when | The question | Answers (first is the default suggestion, none is pre-chosen) | Worked example |
|---|---|---|---|---|
| `near-ref` | A person, team, goal or stage name within reach of exactly one (rule 4) | "{n} rows name a team that isn't here: “Platfrom”. Did you mean Platform?" | Use Platform · Add Platfrom as a new team (admin, teams only) · Choose another | `05b-same-team-typo-14.csv`: one question, 14 rows |
| `near-word` | A column's word within reach of exactly one | "Type says “numbr” on 1 row. Read it as number?" | Read it as number · Choose another | |
| `near-header` | A header within reach of one column, or an unknown header on a sheet where a required column is missing | "A column on Goals is headed “Targett”. Read it as Target?" | Read it as Target · Don't read it | `13-header-typo.csv` |
| `new-team` | An admin's file names a team that isn't here, no near miss (after "Add as a new team") or at set-up when two are near each other | "The file names “Platform” (12 people) and “Platfrom” (2). One team or two?" | One team: Platform · Two teams | |
| `same-person` | A new person whose name is, or is near, someone's here | 3.4 | The same person · Someone new | `10b`: Rhea Kapoor, rhea.k@example.com |
| `same-goal` | A new goal with a name its team (or a goal with no team) already has | 3.1 | They're new · They're the same: change {key} · Leave them out | "Pipeline queue wait (p90)" again in CI/CD |
| `other-goal` | A key matches, and name, owner and team all differ | 3.1 | Yes, change it · No, add it as a new goal · Leave it out | `09h`: G-1 as "Net revenue retention" |
| `other-workspace` | The file's Start here sheet carries another workspace's id | "This file was exported from “{ws}”, not from {here}. Its keys and IDs belong there." | Add its rows as new goals · Cancel | Asked before anything else; chosen, keys and IDs are ignored |
| `past-stage` | A new goal's stage is due before this week | 3.1 | They're done · They're not done · Count them from this week | `07`: 3 stages on 1 goal |
| `past-plan` | A new number goal whose due week is before this week (with an earlier Plan from week) | "{n} new goals have plans that have already ended." | They're finished goals: add them · Leave them out | From 1, due 10, in week 46 |
| `odd-number` | `planHint`'s cases; `valueProblem`'s non-blocking cases; a typed unit that isn't the goal's | 3.1 Target; 3.3 Value | They're right · Leave these rows out | 3 → 3,000 ms; 4.10 after 0.40 |
| `plan-question` | `planQuestion` on an existing goal (direction, far) | As today | Yes, make {better} better / Yes, these are right · Leave these rows out | |
| `no-unit` | A new number or range goal with no unit | 3.1 | That's right · Leave them out | |
| `decimal-comma` | A number read with a comma as its decimal mark, in a file that also has commas as thousands, or with one or two digits after it | "{n} numbers use a comma as the decimal mark: “1,5” was read as 1.5." | That's right · Leave these rows out | `09f`: asked once for the file |
| `replaces-others` | Ten or more rows replace check-ins other people posted | 3.3 | Replace them · Leave these rows out | |
| `many-admins` | Three or more people become admins | 3.4 | That's right · Leave these rows out | |
| `totals-row` | A row named Total, Totals or Sum with no owner | "Row {r} is called “TOTAL” and has no owner. It looks like a totals row." | Leave it out · It's a goal | `09e` |
| `big-removal` | Five or more rows say Stop, Delete or Left | "This file stops {a} goals, deletes {b} and marks {c} people as left." | That's right · Leave these rows out | |

### Fine, and said

Counted in the table; each is words on the change, never a block: a default used (team, level, type, plan shape, plan from week, decimals); an owner "matched by name"; a header read through `also`; a date read as a week; a name matched by folding ("ci/cd" as CI/CD); a stopped goal's rows left alone; a past week "taken as it was recorded" (set-up); "Replaces {name}'s check-in" under ten rows; worked-out cells that differ; unknown columns and sheets; example rows.

### What is never guessed

An owner from a first name; one of several people or goals with the same name; a number from text; a type from two groups of columns; a week from a date outside the cycle; a team from a goal's name; a row's meaning when its key points at a goal that looks like another (it is asked); anything on behalf of someone who may not make the change.

## 5. Who sees what

| | Enforced by |
|---|---|
| Change a goal, its plan, its check-ins: its owner or an admin | `planChanges`: `canChange` (`changeset.ts:339`), raised as `not-allowed` |
| Add a goal: for yourself; an admin for anyone | `changeset.ts:385` |
| People, teams, admin rights, Left: admins | `changeset.ts:246, 254, 283, 293` |
| Add a team from a file (C8): admins | New, in the same place as above |
| "Keep {d} decimal places" (an answer): each goal's owner or an admin | The answer becomes a Decimals change on those goals' rows, so `canChange` decides |
| Undo: whoever made the import, or an admin | `canUndoImport`, `undoImport` (`src/domain/removal.ts:402, 409`) |
| Export: anyone in the workspace, everything | Nothing to enforce in Faro. Platform requirement R-E1 |
| Data's cells: admins | As today |

Someone who may not act sees the page without the action and one sentence saying who can (2.1). Nothing is offered and then refused: a non-admin's People changes and other people's goals are groups with "Leave these rows out", not a wall of refusals.

## 6. Rules for `src/domain`

Pure functions, each with a test file holding every worked example; the examples also become conformance rows (`spec/` is generated; never edited by hand).

### Rule 1. The field table: `fieldTable(kind)` in `columns.ts`

Returns, per column of a sheet, `{ header, role, required, format, example, empty, also, means }`. `required`: `'required' | { for: 'metric' | 'range' | 'milestone' | string } | { optional: string } | 'leave-empty' | null`. Section 3 is its content.

- `fieldTable('goals').filter(c => c.required === 'required').map(c => c.header)` → `['Goal', 'Owner', 'Owner email']`, with Owner and Owner email sharing `oneOf: 'owner'`.
- `requiredWord({ for: 'metric' })` → "Required for a number goal". `requiredWord({ optional: 'team' })` → "Optional".
- A test walks every column and fails if one has no `required`, `format` or `example` (worked-out columns excepted): requirement `FIELD-TABLE`.

### Rule 2. The three lines: `requiredLine(kind)`

- goals → "Goal, and Owner or Owner email. A number goal also needs Start and Target; a range goal, Limit; a stages goal, Stages."
- checkIns → "Goal key (or Goal), Week, and Value or Stages."
- people → "Name and Email."

### Rule 3. The header row: `readHeader(grid)` in `sheets.ts`

Looks at the first ten rows; the header row is the one with the most cells that are a column's header or `also` after `fold` (rule 4), needing at least two. Returns `{ row, columns: [{ index, header, as, how: 'exact' | 'also' | 'near' | 'unknown' }], kind }`. `kind` is the sheet with the most recognised headers among those whose signature is met: goals (Goal or Key, and one of Owner, Owner email, Type, Target, Level, Action); checkIns (Week, and one of Value, Stages, Call); plan (a "Week N" header); people (Name or Email, **and** one of Email, Team, Job title, Admin, when the first was Name); the reading sheets as today.

- `['Platform goals FY27', '', …]` then `['Goal','Level','Team','Owner',…]` → `row: 2`, goals.
- `['Goal name','Owner name','Target value','Units']` → goals, all `also`.
- `['Name','Department','Salary band']` → `kind: null`.
- `['Key','Goal','Targett']` → Targett `near` Target → a `near-header` Check.

### Rule 4. Near misses: `fold(s)` and `near(v, candidates)`

`fold`: lower case; accents off; "&" and "and" the same; punctuation and repeated spaces to one space. `near(v, candidates)` returns `{ exact }` when one candidate folds equal; else `{ near }` when exactly one candidate is within distance 1 (Damerau, so a swap is one) for folded lengths under 8, or 2 for 8 and over; else `{ none }`. Never near: a value of one or two characters; two candidates within reach (then `none`).

- `near('Platfrom', teams)` → near Platform. `near('CI CD', teams)` → exact CI/CD. `near('Build and Release', teams)` → exact Build & Release.
- `near('Rhea Kapor', people)` → near Rhea Kapoor. `near('Rhea', people)` → none.
- `near('vp', levelWords)` → none. `near('numbr', typeWords)` → near number.
- With teams "Platform" and "Platforms": `near('Platfrom', …)` → none (two within reach).

### Rule 5. What was read: `readLine(read)` and `fileOrigin(grids)`

`readTables` returns, besides today's `read` and `skipped`, `unknownColumns: { sheet, headers }[]`, `headerRow`, `examples` and `origin` (`{ workspaceId, workspaceName, cycleId } | null`, from the Start here or README sheet). `readLine` makes 2.3's sentence. `skipped.why` becomes one of `reading-only`, `not-faro`, `second`.

### Rule 6. Issues with kinds, and groups: `Issue` and `groupIssues(issues)`

`Issue` becomes `{ sheet, row, name, kind, level: 'must' | 'check' | 'note', column?, found?, suggest?, message }`. `message` stays the full sentence for one row (MCP and the rows-to-fix file use it). `groupIssues` groups by `kind + sheet + column + fold(found)`, and returns per group `{ id, level, kind, title, where, rows, count, answers }`, largest first within a level. `id` is stable for the same kind, column and found value, so answers survive a corrected file.

- 14 issues `unknown-ref`/near on Team "Platfrom" → one group, `count: 14`, `where: 'Goals, rows 18 to 31'`.
- Rows 2, 3, 4, 9: `where: 'Goals, rows 2 to 4 and 9'`. Over three runs: the first three and "and {n} more".

### Rule 7. Answers: `ChangeInput.answers` and `applyAnswers`

`answers: Record<groupId, { choice: string; value?: string; except?: number[] }>`. `planChanges` reads an answer where it raises the kind: a `near-ref` answered "use" reads the cell as the candidate; `past-stage` answered "done" records each such stage as done in its due week (onboarding rule 3); "from-now" shifts them as `stagesFromJoining` does; `precision` answered "keep" sets those goals' Decimals; any "leave out" adds the rows to `leaveOut`. `except` holds rows unticked in "Show the rows", which stay unanswered as a group of their own. `ChangeSet.commit` is null while a `must` issue or an unanswered `check` remains. `confirm: true` (today's one switch) stays for MCP as "answer every plan-question yes".

### Rule 8. Leaving rows out: `leaveOut(tables, rows)`

Returns the tables without those rows and without the rows that depend on them, with `also: { sheet, row, because }[]`: a goal's Plan row and Check-ins rows; goals whose Feeds into names a left-out new goal; goals and Takes-over cells that name a left-out new person; people whose Team is a left-out new team.

- Leaving out Goals row 44 (a new goal) with 4 Check-ins rows and one child goal → `also` has 5 entries, the child's "because Feeds into names row 44".

### Rule 9. Round trip and undo

- `sameAsWritten(cell, written)`: a typed cell equals what the export wrote when their texts are equal after trimming, or both parse to numbers equal at the column's written precision. `planChanges` uses it for Plan weeks in place of the tolerance (C12). Worked example: plan value 0.405 at 2 decimals, written "0.4" (as `planWeekValue` writes it), typed 0.4 → unchanged.
- `workedOutEdits(tables, snapshot)`: for matched rows, the worked-out headers whose cell isn't `sameAsWritten` as today's value → `{ sheet, columns, rows }`.
- `undoPreview(x, importId)`: `undoImport` without the commit: `{ restores: number, skipped: { name, reason, at, by }[] }`. `undoImport`'s `skipped` gains the same reasons.
- The import's summary change gains diffs `File` (the name) and `Rows` ("654 changed, 397 unchanged, 5 left out"); `pastImports(snapshot)` reads the change log: entries with `action: 'imported'`, each with whether it is undone.

### Rule 10. Speed: the engine's look-ups

Inside `planChanges`, people by folded name and by email, teams by folded name, goals by folded title, by key and by id, and check-ins by goal are maps built once and kept up as rows are read; no row scans a list. `planChangesInChunks(input, onProgress)` yields every 500 rows so a worker can report. Results are identical to today's for every existing test.

## 7. Large files: built, and required of the platform

Built in Faro (IM6): the worker (`src/modules/spreadsheets/worker.ts` calls the same domain functions; `src/domain` stays free of browser code); progress; Stop; rule 10; paging at 50; the limits of 2.8; N18's budgets.

Requirements for the internal platform, written into `spec/` as requirement `IMPORT-LARGE` and a stage note, not built:

| # | Requirement |
|---|---|
| R-L1 | An import is a server-side job: upload, check, preview, save. It survives a closed tab, and its preview is the same groups and counts |
| R-L2 | Saving is one transaction, or resumable batches that end in one state; a failed job leaves nothing half-saved or says exactly what was saved |
| R-L3 | The server runs the rules and writes the audit entries, the actor and the time (deep review A2); the browser's preview is advice |
| R-L4 | Before-images for Undo are kept per import for a stated time (suggested 90 days), not inside one audit row |
| R-L5 | 30,000 rows are checked in under 30 seconds and saved in under 2 minutes; two imports touching the same goal can't interleave |
| R-L6 | Uploaded files are scanned, size-limited and not kept after the job |
| R-E1 | An export follows the platform's read rules and is written to the audit log with who, when and what |

## 8. Extension points

Everything stays in the `spreadsheets` module, on its two places (`data.tools`, `goals.tools`) and its routes. `module.json` gains routes `/data/import/check`, `/data/import/check/changes`, `/data/import/done/:id`, `/data/imports`; help `columns`; the requirements and journeys below; and its rebuild stage's `entry` and `exit` lines ("An unedited export reads Nothing would change"; "Fourteen rows with one typo are one question").

New in core, said plainly:

- `src/domain/columns.ts`, `sheets.ts`, `changeset.ts`, `removal.ts`: the rules above. They are core already (the engine is shared with set-up, Data and MCP).
- `src/ui/Preview.tsx` is rewritten as the preview of 2.3 and stays shared by Import, Data, the bulk actions and set-up.
- Activity folds an import's row entries under its summary entry (a rendering change in the Activity screen).
- No new table and no migration. Past imports are the change log (`action: 'imported'`, `importId`, `undo`), which holds everything the list shows once the summary carries the file's name. If Lane wants past imports to outlive a trimmed change log, that is R-L4, on the platform.
- With the spreadsheets module off: the routes are absent, Data and Goals lose Export and Import, `export` and `export_table` say so (as today), and `bulk_change`, `undo_import`, Data's editing and set-up's upload keep working, as they are core.

### The switches (shared decision 6)

The design reads them in two places. **Reviews off**: `workbook()` leaves out the Notes sheet and Asks' Review column, and the template and Start here sheet don't mention them. **Rhythm none**: the Check-ins sheet loads exactly as with a weekly rhythm (an update has a week, and one row per goal and week stays the rule); the only difference is wording made from the vocabulary: "check-in" stays, and the counts line drops "({n} for past weeks)" in favour of "({n} dated before this week)". Nothing else in this design depends on either switch.

## 9. MCP

`bulk_change`, `export` and `export_table` keep their names and inputs. `bulk_change` gains `answers` (an object of group id → choice, with an optional value) and `leave_out` (true to save the good rows). A dry run is still the default.

The result of `bulk_change`, in words: a first line, "Checked, nothing saved" or "Saved"; the counts per sheet (added, changed, stopped or left, unchanged); what was not read (unknown columns); `must_fix`, a list of groups, each with its kind, the column, what was found, how many rows, the first twenty row numbers, the sentence, and the answers it would take; `check`, the same shape with each question and its choices; then, when saved, the import's id and "Undo with undo_import". It saves only with `apply: true`, no `must_fix` group left (or `leave_out: true`), and every `check` answered. An unanswered check makes `apply` return "Not saved: answer {q} questions" with the questions. Rows are numbered from 1 within each array.

`export` and `export_table` say in their text result which columns load back and that worked-out columns are ignored; `export`'s CSVs carry the Start here origin as a first comment line only in the workbook, not in CSV (a CSV stays plain). `undo_import` gains `dry_run: true`, returning `undoPreview`'s counts and skipped rows.

## 10. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U87 | FIELD-TABLE | What a file needs, before uploading: as Rhea, Import says what a new goal, check-in and person must have, and "Up to 5,000 rows a file"; "Every column…" opens Help's table, where Goal and Owner are Required, Start is "Required for a number goal" and Status is Worked out; the template downloads, its first sheet is the same table, its example rows say Example, and loading it unchanged reads "Nothing would change" with "3 example rows left out" |
| U88 | IMPORT-LEVELS, IMPORT-PREVIEW | One answer for many rows: as Amara, a file with 14 rows for "Platfrom", 3 new goals with no owner and a stage in week 2 gives Must fix "17 rows, 2 kinds", one Check on the stage, and Save disabled; "Use Platform" closes its group to one line; "Download the 3 rows to fix" saves a file whose first column is Problem; the corrected file loads with "Your 2 answers still apply."; answering the stage question enables "Save {n} changes"; the changes list shows a default as "(her team; the row gave none)" |
| U89 | IMPORT-PREVIEW, ROUND-TRIP | Out and back in: every export (the workbook, the zip, Data's Check-ins as shown with three columns) loaded straight back reads "Nothing would change"; with Status edited on two rows it adds the worked-out line; a file with "Targett" asks to read it as Target; a file with a title row says the header is on row 2; a file exported from another workspace asks before anything else |
| U90 | IMPORT-UNDO | Undo and past imports: save an import of 5 goals and 10 check-ins; "Imported" offers Undo; Data → Past imports lists it with the file's name; as Rhea post a check-in on one imported goal; as Amara, Undo says 14 rows go back and 1 stays, naming Rhea's check-in; after it the line reads "Undone on…"; Activity shows one entry for the import with "Show the 15 changes" |
| U91 | IMPORT-LEVELS | Who may import what: as Tunde, a full workbook with his own target changed and Rhea's changed gives one group "1 row changes a goal you don't own" with "Leave these rows out"; taken, his change saves; the People sheet edited gives the admins-only group; the Import page names the admins once; Past imports shows no Undo on Amara's import |
| U92 | IMPORT-LARGE, SETUP-UPLOAD | Size, and the first import: a 5,000-row file shows progress with counts and a preview that draws 50 rows; a file changing 5,001 rows is checked, not saved, and offered as two parts; at `/?store=browser`, set-up with a file whose goals name an owner the People sheet lacks ends on the same preview with "Add {name}" and the stage question defaulting to "Count them from this week" |

**Changed:** U19, U20, U46, U48 (the Import page's words, the preview's layout, where saving ends); the set-up journeys that upload (the preview before Create).

### F, N and P checks

| # | Check |
|---|---|
| F17 | At 390 × 844 and 360 × 800: Import, the preview (with groups, answered and not), the changes, Imported, Past imports, the Undo sheet, Export and Help's table don't scroll sideways; every answer and button is at least 44 px high; the primary action is on the first screen of Import and of Export |
| N18 | Round trip and size. (a) For the demo and for a generated workspace with goals at 0, 1, 2 and 3 decimals and every plan shape, the workbook and the zip load back with zero changes and zero issues. (b) With 1,000, 5,000 and 30,000 generated rows (goals, and check-ins): checking finishes within 3 s, 8 s and 20 s on CI; no task on the page's thread is longer than 200 ms; the preview has fewer than 3,000 elements; 14 rows with one typo are one group |
| P19 | The design check on the new screens: Must fix and Check are words with the warning mark, never a status shape or a capsule; a Must-fix block is a wash with a full outline, no edge stripe; counts are plain numbers; no emoji |
| N12, P3, P4, P6 | Extended to the new routes |

### Unit tests

One file per rule in section 6 with its worked examples; `changeset.test.ts` gains a case per kind in section 4 (the sentence, the level, the group); `roundtrip.test.ts` gains the decimals matrix and the worked-out-edit case; every file in `docs/design/import/samples/` becomes a fixture with its expected groups.

### Requirements (`evals/requirements.json`)

- `FIELD-TABLE`: "Every column a person can fill in says whether a new row must have it, its format, an example and what an empty cell means, in one list that the template, the workbook's first sheet, Help, the import's preview and the goal form are made from."
- `IMPORT-LEVELS`: "Every problem an import finds is Must fix, Check or fine. Must fix blocks saving; a Check is a question that must be answered; a problem is said once per kind with its count, and one answer covers every row with the same question. A near miss is asked about, never guessed and never silently refused."
- `IMPORT-PREVIEW`: "Before anything is saved an import says which sheets and columns it read and which it did not, then counts by sheet, then what must be fixed, then its questions, then the changes on request with before and after and every default it used. Saving is all or nothing unless the person chooses to leave named rows out."
- `IMPORT-UNDO`: "Every import, bulk edit and bulk change through MCP is one line in Past imports and one entry in Activity, and can be undone as a whole by whoever made it or an admin. Undo says beforehand which rows have changed since and will stay."
- `IMPORT-LARGE`: "The import states its size limits before a file is chosen, checks a large file without freezing the page and shows progress, never draws more than a page of rows, and refuses to save more than it can save safely, with a way through. Saving tens of thousands of rows is a server-side job (R-L1 to R-L6)."
- Reworded: `BULK-IMPORT`, `ROUND-TRIP`, `SPREADSHEETS-ON-DATA`, `EXPORT`.

## 11. Help and What's new

### Help (`src/modules/spreadsheets/help.ts`, `src/help/guide.ts`)

| Article | Change |
|---|---|
| `columns` (new; route `/help/columns`; title "Every column, and what it needs") | The field table by sheet; what Required, Required for, Optional and Worked out mean; the template |
| `import` | Rewritten: the way in (file, paste, template); what is read and not; Must fix and Check, with "one answer covers every row"; fixing here or in the file; leaving rows out; size; who can |
| `past-imports` (new; route `/data/imports`; title "Past imports and Undo") | The list; what Undo puts back; rows changed since |
| `export` | One sheet, one button, other formats; file names; "as shown" from Data |
| `data` | Export and Import in the list bar |
| `setup` | The upload ends on the same preview (with the set-up design) |

### What's new (`src/help/whatsNew.ts`), one entry per item

| Item | id | Title | Lines |
|---|---|---|---|
| IM0 | `round-trip-exact` | "An export loaded straight back changes nothing" | "A plan with decimal places could read as changed. It doesn't now." |
| IM1 | `field-table` | "What every column needs, in one place" | "Help has a table of every column: required or not, its format, an example." "The template's first sheet is the same table, and its example rows are never imported." |
| IM2 | `import-levels` | "Imports ask instead of refusing" | "A name one letter out is a question: “Did you mean Platform?”" "The same problem on 14 rows is said once, and one answer covers them all." "Numbers that look wrong are asked about before saving." |
| IM3 | `import-preview` | "A clearer check before an import is saved" | "Counts by sheet first; then what must be fixed; then questions; then the changes, if you want them." "It says which sheets and columns it didn't read." "Download just the rows to fix." |
| IM4 | `past-imports` | "Past imports, each with Undo" | "Data lists every import, who made it and what it changed." "Undo says first which rows have changed since." |
| IM5 | `import-way-in` | "Paste rows, and headers that are nearly right" | "Paste cells from a spreadsheet straight into Import." "A title row above the headers, or “Goal name” for Goal, is read." |
| IM6 | `import-large` | "Large files show progress" | "Faro checks a big file without freezing and shows 50 rows at a time." "It says up front how much it can save at once." |
| IM7 | `export-one-button` | "Export is one button" | "Excel by default; other formats one click away." "File names say what's in them." |
| IM8 | `setup-preview` | "Set-up checks your spreadsheet before creating anything" | "The same check as Import, with every problem at once." |

## 12. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Always all or nothing | Rule 8, the "Leave…" link and sheet, and every "Leave these rows out" answer go; `not-allowed` groups become fix-in-the-file; `leave_out` is not added to `bulk_change`; U91 ends on the refusal |
| 1 | Save the good rows by default | The foot's primary with rows to fix becomes "Save {n} changes and leave {m} rows out", with the sheet of 2.3 as its confirmation |
| 2 | Require Type | C1 becomes "Type is Required"; `type-unclear` is replaced by `required-empty` on Type; the template's bold headers gain Type; goal entry is unaffected (the form always has a type) |
| 2 | Keep the silent default | C1 is dropped; the changes list still says "(number goal; the row gave no Type)" |
| 3 | Batches in the browser | 2.8's block is replaced by a save with progress ("Saved 4,000 of 29,812") in batches of 2,000 in dependency order under one import id; a failure offers "Undo what was saved" and "Try the rest again"; N18 gains a save budget |
| 4 | Refuse, naming the near match | `near-ref`, `near-word` and `near-header` become Must fix with "Did you mean {x}?" in the sentence and the same in-place answer; fewer Checks, the same clicks |
| 4 | Accept the near match | They become fine-and-said; rule 4's reach is cut to distance 1 only; not recommended (a wrong owner saved silently) |
| 5 | Teams only under Workspace | C8 is dropped; `unknown-ref` on Team offers "Choose a team" only, and its hint says "Add the team under Workspace first." |
| 6 | No page | `/data/imports` is dropped; Import shows the newest three with "See all in Activity" (Activity filtered to imports) |
| 7 | Log exports in Faro | A change-log entry `action: 'exported'` (no migration: the action column is text), shown in Activity under a new filter |

## 13. Build plan

Held items: round 1's FS1 pickers and FS2's list bar on Data are held until Thursday 12 Nov (`docs/handover.md`); AR3 (`app.run`) has merged.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| IM0 | **Round trip is exact** | Rule 9's `sameAsWritten` for Plan weeks (C12); N18 (a) | S | Nothing. A bug on the live demo; can go at once after the talk |
| IM1 | **The field table** | Rule 1, 2; section 3's values in `columns.ts`; README sheet becomes Start here; `docs/export-format.md`; Help `columns`; the template with bold headers and Example rows (C15); `FIELD-TABLE`; U87 | M | Nothing. Goal entry's GE items read it |
| IM2 | **Kinds, levels and near misses in the engine** | Rules 4, 6, 7; section 4; C1 to C11, C13, C14, C16, C18, C20; `IMPORT-LEVELS`; unit tests from `samples/` | M | IM1. OB2 (#103) for the done-on-time stage record, or it ships with "They're not done" and "Count them from this week" only |
| IM3 | **The preview** | 2.3, 2.4; rule 5, 8; C19; rows-to-fix download; `IMPORT-PREVIEW`; U88, U89, U91; F17, P19 | M | IM2. FS1 for "Choose a team / person" (until then a plain select of at most 50 with search). Decision 1 |
| IM4 | **Imported, Undo and Past imports** | 2.5 to 2.7; `undoPreview`, `pastImports`; Activity's fold; `undo_import` dry run; `IMPORT-UNDO`; U90 | S–M | AR3 (merged). FS2 for the list bar on Past imports (until then search only) |
| IM5 | **The way in** | 2.1 with paste; rule 3 (C17); the error states | S–M | IM1, IM3 |
| IM6 | **Large files** | Rule 10; the worker, progress, Stop; paging; 2.8's limits and split; `IMPORT-LARGE` and R-L1 to R-L6 into `spec/`; N18 (b); U92's first half | M | IM3. Decision 3 |
| IM7 | **Export** | 2.9; Data's Export and Import; file names; R-E1 | S | FS2's list bar on Data (until then the two buttons replace the menu where it is) |
| IM8 | **Set-up's upload uses the preview** | Create mode in the preview; "Add {person}"; the stage question's default; `SETUP-UPLOAD` with the set-up design; U92's second half | S–M | IM3; the set-up design's ST item for where it sits |
| IM9 | **MCP** | Section 9; `npm run build:mcp`; `docs/mcp.md` | S | IM2, IM4 |

Order: IM0; IM1; IM2; IM3; then IM4, IM5 and IM7 in any order; IM6; IM8; IM9. Each item adds its part of `spec/`, its conformance rows (every worked example in sections 4 and 6) and updates the spreadsheets module's rebuild stage; IM2 and IM6 run the stage's drill.

**For the rebuild kit:** the field table and section 4's kinds are stage 2's conformance data (a row per kind: input row, level, sentence). The stage note says the rebuild runs this engine on the server (R-L1, R-L3) and treats the browser preview as advice.
