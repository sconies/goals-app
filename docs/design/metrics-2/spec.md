# The metric library, round 2: the build spec

11 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings M2-1 to M2-13). It builds on round 1's spec (`docs/design/metrics/spec.md`, items ML1 to ML3) and on round 2's shared decisions (`docs/design/round-2/README.md`); where it changes round 1, the README’s “What this changes in round 1” says so and this spec wins. It assumes Lane takes the recommended answer to each decision; section 10 says what changes otherwise.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/modules/metrics/`, its conformance rows and its rebuild stage, updates `module.json`, runs `npm run spec`, adds a What's new entry and its Help article, comes with its evals, and passes `npm run typecheck`, `npm test`, `npm run lint:layers` and `npm run evals:changed`; after touching `tools.ts` or anything the server imports, `npm run build:mcp`. Everything is in the `metrics` module and registers through extension points, except the three things section 7 names as core.

**Words.** `{metric}` is a metric's name, `{ws}` the workspace's, `{source}` a source's name as the metric's Source field has it. "Slice" is the code's word for whose number a link is; screens say "For" and "Which part". "Must fix", "Check", "Required", "Optional", "Worked out" as the shared decisions define them. The module's name on screen is "Metrics" everywhere (Features' row included). Wording in quotation marks is exact.

**Where the rules live.** After AS part 2 the module's rules are in `src/modules/metrics/rules*.ts`; until then they are in `src/domain/metrics.ts`. This spec says "the module's rules" and means whichever is true when the item starts. Every new rule takes only what it reads (round 1's AR4): the parameters listed, never a whole snapshot.

## 1. Routes

No new place. Round 1's addresses stand (`/metrics`, `/metrics/<id>`, `/metrics/new`, `/metrics/<id>/edit`), with these additions.

| Address | Screen | Title |
|---|---|---|
| `/metrics/<id>/retire` | Retire (a sheet over the metric's page; focus mode on a phone) | "Retire {metric}" |
| `/metrics/<id>/merge` | Merge into another (the same) | "Merge {metric}" |
| `/metrics/<id>#history` | The metric's History section | — |
| `/metrics/<id>#goals` | The comparison (round 1's anchor) | — |
| `/metrics/<id>?order=worst\|slice&scale=same\|own&weeks=1` | The comparison's order and scale, and its table of weeks | — |
| `/metrics?retired=1` | The library, retired metrics only | "Metrics" |

Import stays where the import spec puts it (`/data/import`); the library gains a quiet link "Import metrics" beside "Add a metric", opening it with the Metrics template offered.

### Redirects

Round 1's four (`/data/metrics…` → `/metrics…`) are unchanged. None new. A retired metric's address is its own page; a metric merged away keeps its page, which says where it went.

### With Metrics off

Every address above gives the not-found page with the toggles spec's extra line: "Metrics is switched off in {ws}. An admin can switch it on in Workspace, Features."

## 2. Screens

### 2.1 Add or change a metric (`/metrics/new`, `/metrics/<id>/edit`)

Wireframe 1. Round 1's 2.3 with the three levels. Focus mode, 620 px.

**Content, in order**

1. Title "Add a metric" / "Change {metric}"; "Close and keep the draft".
2. **Name** (Required).
3. **Unit** (Required), and beside it **Decimal places** ("optional, 0 if left").
4. **Which way is better** (Required): "Lower is better" / "Higher is better", none chosen at first.
5. **What it means and how it’s calculated** ("optional"): textarea; hint "What is counted, out of what or over what period, and what is left out."
6. A group headed "Where the number comes from · can be said later": **Source** (placeholder "A dashboard, a query, a report"), **Who owns that source** ("A team or a person"), **How often it refreshes** (a select: "Not said", Live, Hourly, Daily, Weekly, Monthly, Quarterly). When the chosen refresh is slower than the workspace's check-in rhythm, a hint, not a Check: "Check-ins here are weekly. Most weeks a goal measured by this will have no new number, and that is fine."
7. **Owner**: shown as text "{name} (you)" with "Change" (find-and-pick); hint "Answers for what it means. Can change it and retire it."
8. **Caveats** ("optional").
9. The foot: the count line and the completeness line (rule 1), then the primary **"Add the metric"** / **"Save changes"**.

**The levels.** A Must fix shows under its field in a block outlined on every side and washed (`--off-wash`), headed by the warning mark and "Must fix"; the field has the full outline. A Check shows under its field in a quiet bordered block headed by the warning mark and "Check", with its answers as plain buttons. Neither uses a status shape. They show when the field loses focus or on the first try to save. The count line reads "{a} to fix, {b} to check." (either part left out at zero; nothing at all when both are zero). Saving is refused while a Must fix stands; with an unanswered Check, the first try to save scrolls to it and says under the button "Answer the question above first." An answered Check closes to one line with "Change" ("You said: mine is different.").

Exact words: the field table, section 3.

**On change, when goals use the metric**, saving opens 2.2 instead of saving, for the kinds of change rule 3 says need it.

**Empty and error states:** a save refused by the rule shows its words at the top ("Only {owner} or an admin can change this metric."). A retired metric's edit address opens its page: a retired metric is brought back before it is changed.

**Primary action:** Add the metric / Save changes.

### 2.2 The change read-back (a sheet over the form)

Wireframe 3 (a). Shown by rule 3's kinds `meaning`, `relabel`, `direction`, `decimals`. Kind `words` and `name` save straight; kind `scale` never reaches here (it is a Must fix under Unit).

**Meaning or source changed**

1. Title "Change what “{metric}” means?" (source only: "Change where “{metric}” comes from?")
2. "Was" and "Will be", the changed field's two texts, the difference in the stronger weight.
3. **"Is it still the same number?"** two choices, none chosen at first:
   - "Same number, better words" · "Nothing is marked."
   - "The number itself changes, from week {this week}" · "Earlier weeks were measured the old way, and every goal says so."
4. With the second chosen: **"Why"** (Required, 300 at most). Must fix when empty: "Say why, in a line. Every goal measured by it will show this."
5. A panel: "**{n} goals are measured by it**", then each goal's title with its slice in brackets (the first six, then "and {k} more", a link that lists them). With the second choice: "Each goal’s chart and History will say “Definition changed in week {w}”, with your reason. Their numbers and plans don’t change. {owners, the first three then “and k more”} will see it on Home under what changed." With the first: "Nothing changes on these goals but the words they show."
6. **"Change the meaning"** (primary; "Change the source") and "Keep it as it was".

**Unit, a new label** (rule 3 `relabel`). Reached from the Must fix under Unit, which carries the question (section 3). Title "Change “{old}” to “{new}” on {metric} and its {n} goals?" · "{n} goals will show “{new}” instead of “{old}”. No number changes." · the goals named as above · **"Change the unit"** / "Keep it as it was".

**Which way is better** (`direction`). Title "Change which way is better for {metric}?" · "Why" (Required) · "For {k} of its {n} goals the target now lies the wrong way: {titles}. Each will show a Check until its owner has looked." (k = 0: "All {n} goals already aim that way.") · the mark sentence as for meaning · **"Change the direction"** / "Keep it as it was".

**Decimal places** (`decimals`), only when a goal shows more places than the metric will: "{k} goals show more decimal places than {metric} will: {titles}. They keep theirs until their owners change them." · **"Save changes"** / "Keep it as it was". No reason, no mark.

**After:** the toast "Changed {metric}. {n} goals say so." (or "Saved {metric}") with **Undo**, which takes back the metric's change, its mark and, for a relabel, every goal's unit, as one.

### 2.3 Retire, bring back, merge, delete

**On a metric's page** (round 1's 2.2, item 9), for its owner and admins, in place of "Remove this metric…":

- a metric that has ever measured a goal (rule 5 `everUsed`): "Retire this metric…" and (admins) "Merge into another metric…";
- one that never has: "Delete this metric…" (round 1's 2.5 sheet, its goal sentence always "No goal has been measured by it.").

**Retire (sheet)**

1. Title "Retire “{metric}”?"
2. "**{n} goals stay measured by it** and keep their numbers and plans. They will say “Measured by {metric}, retired {date}”." (n = 0: "No goal is measured by it now.") The goals named as in 2.2.
3. "It leaves the pickers and the library’s list. It can be brought back at any time."
4. **"Why"** (Required, 300 at most).
5. **"Replaced by"** ("optional"): find-and-pick for a metric in the same unit; hint "Its goals’ owners are offered this one."
6. **"Retire the metric"** (primary, not the danger style: nothing is lost) and "Cancel".

After: the toast "Retired {metric}" with Undo; the metric's page stays open.

**A retired metric's page** opens, above everything, with: "Retired on {date} by {name}: “{why}”." and, when set, "Replaced by {other, a link}."; for those who may, **"Bring it back"** (the page's primary action while retired; "See its goals" becomes a plain button). Under the title, in place of the completeness line: "Retired". "Change this metric" is not offered.

**Merge (sheet, admins)**

1. Title "Merge “{metric}” into another metric"
2. **"Into"**: find-and-pick for a live metric. Must fix when the units differ: "{metric} is in {u1} and {other} is in {u2}. Only metrics in the same unit can be merged."
3. Once chosen, the read-back: "“{metric}” ({n} goals) becomes “{other}” ({m} goals). Both are in {unit}. The {n} goals will be measured by {other} from today, and their History will say so. “{metric}” is retired, pointing to {other}." Where the two differ in direction: a Check, "{metric}: lower is better. {other}: higher is better. {k} goals will aim the wrong way." → "Merge anyway" / "Cancel".
4. **"Why"** ("optional"; default "The same number as {other}.").
5. **"Merge them"** (primary) and "Cancel".

After: the toast "Merged {metric} into {other}. {n} goals moved." with Undo (the links, the retirement and the History entries, as one). `{other}`'s page opens.

### 2.4 A metric's page: what round 2 adds

To round 1's 2.2, in its order:

- **Under the title**, after the facts line: " · Fully defined" or the completeness line (rule 1), for everyone. For the owner and admins the line's items are links to the form's field.
- **"Goals measured by it · {n}"** becomes the comparison (2.5).
- **Facts** gains "Latest from the source": "{value} {unit}, measured {when}" per slice that has a reading, up to three then "and {k} more" (only when a source reads this metric; left out otherwise).
- **"History"**, a new last section before the owner's buttons (`#history`), newest first, 20 then "Show earlier". An entry is a line of who did what and when, and "Show the change" for field-by-field changes (the change log's diffs). Kinds, with their sentences:

| Kind | Sentence |
|---|---|
| Added | "{name} added this metric" |
| Changed (words) | "{name} changed {fields, in words}" |
| Renamed | "{name} renamed it from “{old}”" |
| Meaning, same number | "{name} reworded what it means" |
| Meaning, the number changes | "{name} changed what it means, from week {w}: “{why}”" with "See both definitions" |
| Unit relabelled | "{name} changed its unit from “{old}” to “{new}” on it and its {n} goals" |
| Direction | "{name} changed which way is better to {new}, from week {w}: “{why}”" |
| A goal linked / unlinked / moved | "{name} measured {goal} by it, for {slice}" / "{goal} is no longer measured by it" / "{goal} moved here from {other}" |
| Retired / brought back / merged | "{name} retired it: “{why}”" / "{name} brought it back" / "{name} merged {other} into it" |

It reads the change log's entries for this metric (entity `metric`, this id). Empty: never (it always has "added").

### 2.5 The comparison (on a metric's page)

Wireframe 5. Rule 6. The section "Goals measured by it · {n}".

**n = 0:** round 1's empty words. **n = 1:** the one row of the table; no count line, no controls, no charts.

**n ≥ 2, in order**

1. The count line: "**{statuses, worst first, as counts in words}.** Now between {lo} and {hi} {unit}; targets between {tlo} and {thi} {unit}." The second sentence is left out when fewer than two goals have a number; "targets between" is left out when fewer than two have one, and reads "targets and limits between" when any is a keep-in-range goal.
2. Two plain controls: order, "Worst first" (chosen at first) / "By team and part"; scale, "Same scale" / "Each against its plan" (rule 6 chooses which is on at first; on a phone the scale choice is inside "Filter and sort").
3. The table. A row that is off track has the quiet wash on the whole row.

   | Column | Shows |
   |---|---|
   | Status | Shape and word |
   | Goal | The title, a link; under it the key, then " · said why this week" when this week's check-in has a reason, and " · yours" when the viewer owns it |
   | For | "{team}" or "The whole company", then " · {part}" when it has one |
   | Now | The latest value; "No value yet" |
   | Target | "{target} by week {w}" / "At most {limit}" / "At least {limit}" (`measureOf`'s `targetText` and the due week) |
   | Against plan | The scorecard's words ("5 min behind plan"); a keep-in-range goal: "{x} of room" / "{x} over the limit" |
   | Last 4 weeks | Rule 6's trend words |
   | Owner | The name. Last, and the first column to give way |

4. **"Each against its own plan, on one scale"** (or "Each against its own plan" with the other scale): one small chart per goal in the table's order, three across on a computer, one per row on a phone, six at most and then "Show the other {k}". Each: the status as shape and word; the title; the slice; a plot 96 px high with the plan dashed in the faint ink, the actual line in the main ink at 2 px, the target or limit a hairline, the vertical scale's top and bottom value at its left edge, "wk {first}", "now", "wk {last}" under it; then one line, "{now} now · plan {p} · target {t}" / "{now} now · at most {l}". No colour stands for a goal; the only colour is the status's, on its shape and word. A definition-change mark (rule 4) is a dashed vertical hairline at its week in every chart.
5. The key, once: "Actual", "Plan", "Target or limit", then "All {n} share one scale, {lo} to {hi} {unit}." / "Each has its own scale."
6. "See these as a table of weeks" (`?weeks=1`): a table, a row per goal, a column per week of the last 12, values only; the accessibility view of the charts.

**Never:** a rank, a position number, "best", "worst", "top", "bottom", "leader", a team or person named in the count line, a total or average per owner, a sort by owner or by value. P-check in section 8.

**Primary action:** the page's "See its {n} goals" (round 1's).

### 2.6 "Measured by" on the goal forms

Wireframe 2 (a). Round 1's 2.4 with these changes. Not rendered for a dated-stages goal, for someone who may not link, or with Metrics off.

1. **Chosen**, under the closed field: the meaning (two lines, "Read more"); then the block **"From the metric"**: "**{unit}**, {decimals in words}, **{lower|higher} is better**." and, when the metric has them, " From {source}, refreshed {refresh in lower case}." Under it: "A goal measured by a metric uses its unit and its direction. To use others, choose another metric or “No metric”." The form's Unit and Decimals fields are not shown while a metric is chosen on a new goal. Round 1's "Use different ones" is not built.
2. **"For"**: as round 1 ("{team}" with "The goal’s team" under it; "The whole company").
3. **"Which part"** ("optional: leave empty for all of it"): a text field, 60 at most. Under it, when the metric's other links have parts: "Parts other goals on this metric use: {each a link that fills the field}" (rule 2 `partsOf`, most used first, five at most).
4. A group headed "This goal’s own · the metric doesn’t set these": the form's start, target (or limit), plan and due week, as the goal-entry spec lays them out.
5. Must fix and Check blocks from rule 2, under the field each is about (the table in README section 2 has the words; section 3 here repeats them exactly).
6. **On an existing goal with check-ins**, changing the metric, For or the part shows **"Why"** (Required): "Say why this goal is measured differently now. It shows in its History." The goal-entry spec's "What will change" read-back gains the row "Measured by {new}, for {slice} (was {old})".
7. **"No metric"**: as round 1; the goal's own "How it’s measured" and "Where the number comes from" fields show.

New goal's Check step (the onboarding spec): "Measured by {metric}, for {team | the whole company}{ · part}." / "No metric: measured as described."

### 2.7 On a goal's page

Wireframe 2 (b), 3 (b), 3 (c). Round 1's 2.6, with:

- **About's block** "Measured by {metric}" as a list of label and value: "For" ({team | The whole company}{ · part}); "What it means" (the metric's meaning; empty: "Its meaning hasn’t been written yet."); "From the metric" ("{unit}, {decimals in words}, {direction}"); "Where the number comes from" ("{source} ({source owner}), refreshed {refresh}"; parts left out when empty; the row left out when all are); "Caveats" (when any); "This goal’s own" ("{start} → {target} by week {w}, {shape}" / "At most {limit}"); "For this goal" (the goal's own `definition`, only when it has one and it differs from the metric's meaning, ignoring case and spaces). Then "See the {k} other goals measured by it" → the metric's page, `#goals`.
- **A retired metric**: the block's heading is "Measured by {metric}, retired {date}" (the name a link); then "{name} retired it: “{why}”. This goal keeps its numbers and its plan."; "Replaced by {other}." when set; and for the goal's owner and admins **"Measure it by {other}"** (when set and the units agree) and "Choose another" → Change a goal, the field focused. The `goal.facts` line reads the same heading.
- **The chart** (the goal spec's): for each mark from rule 4 that falls in the cycle, a dashed vertical hairline at its week with the label "Definition changed, week {w}" (direction: "Direction changed, week {w}"; a link change: "Measured by {metric} since week {w}"). The label sits beside the rule, never across it.
- **History** (the goal spec's rule 4): the same marks as entries under Changes, headed by the warning mark and "Definition changed": "{name} changed what {metric} means: “{why}” Weeks before {w} were measured the old way." with "See both definitions" → the metric's page, `#history`.
- **Now**, under the number, when the latest check-in has a reading (section 4.3): "From {source}, measured {when}." / "Typed by {name}. {source} said {x}." A plain typed number says nothing.
- **With no set rhythm** (the toggles spec) and a reading newer than the last check-in, for the goal's owner: one block above History, "Latest from {source}: **{value} {unit}**, measured {when}. Not checked in yet." and **"Check in with this number"** (opens the check-in at its story step). For everyone else the first sentence only.

### 2.8 The check-in's number step, with a source

Wireframe 4. The module's component in a new place, `checkin.number` (section 7), rendered by the check-in's number step above its own field when the goal has a live link to a live metric and a registered source says `reads(metric, slice)`. With Metrics off, no source, a retired metric or a dated-stages goal, the step is today's.

The component asks the source once when the step opens (`read(metric, now, slice)`), and passes rule 7's answer to these states.

| State (rule 7) | Shows | Primary | Also |
|---|---|---|---|
| `fresh` | The number, large, with its unit; "**From {source}**, measured {when}."; "Week {w}: {last}. You still say what changed: that is the next step." | **"Use {value} {unit}"** | "Type a different number" (opens the step's own field, focused) · "No new number this week" |
| `same` | "No new number since your last check-in: still {value} {unit}, measured {when}." | **"No new number this week"** | "Type a different number" |
| `missing` | "{source} has no number for this yet." and the step's own field | The step's Continue | "No new number this week" |
| `unreachable` | "{source} couldn’t be reached just now." "Try again", and the step's own field | The step's Continue | — |
| `stale` (Check) | "The latest number from {source} is **{value} {unit}, measured {date}**, {n} days ago. It usually refreshes {refresh in lower case}." | None until answered | "Type this week’s number" · "No new number this week" · "Use {value} {unit} anyway" |
| `jump` (Check) | "{source} says **{value} {unit}**. That is {ten times | a tenth of} week {w}’s {last}. Is it right?" | None until answered | "Yes, use {value} {unit}" · "Type a different number" |
| `revised` (Check, shown above any of the others) | "{source} now says week {w} was {new}, not the {old} checked in. Correct week {w}?" | — | "Correct it to {new}" · "Leave it" |

- "Measured {when}" is the day and time in the viewer's zone, "Thu 12 Nov at 09:00"; today and yesterday are said as such.
- The existing hint "Where to get it: {source}. Typed in by hand." (`CheckInFlow.tsx:410`) is shown only in the states where the person types; its second sentence is dropped everywhere.
- A typed number that differs from a reading the step held is saved with the reading beside it (section 4.3). The import spec's Check for a number ten times the last applies to typed numbers as it does anywhere; this step doesn't restate it.
- The story steps are unchanged. The check-in's read-back (its last step) gains one line: "{value} {unit}, from {source}, measured {when}." / "{value} {unit}, typed. {source} said {x}."
- "Type all your numbers in one table": a cell whose goal has a `fresh` reading is filled with it in the faint ink and a line under the table says "{n} numbers are from their sources; change any that are wrong." Checks show as the cell's question when it is focused.

**Primary action:** as the table says.

### 2.9 The import preview, for metrics

Wireframe 6. The import spec's preview; this is what the Metrics sheet and the Goals sheet's three columns add to it.

- The counts: "{a} new metrics · {b} change a metric that exists · {c} retired · {d} brought back · {e} unchanged, left alone" (zero parts left out), and on the Goals sheet's counts "{n} goals measured by a metric · {m} no longer".
- Under the count line, when any new metric has no source: "{k} new metrics name no source yet: they will say “Still to say: where the number comes from”." A statement, not a question.
- Must fix rows show the cell that was read in the status colour and the words in "What will happen".
- Checks are grouped by question; one answer covers every row with the same question; "See the rows" lists them.
- "What each column takes": the field table's first four columns for this sheet, six rows then "See all {n} columns"; "Download the template" (a workbook with the Metrics sheet's headers, one example row and the README sheet).
- The primary button: "Add {a} metrics, change {b}" (parts left out at zero; "Save {n} changes" when the file has other sheets too).
- After: the import spec's toast and Undo, which covers metrics and links.

### 2.10 Workspace → Features

Wireframe 7. The toggles spec's Features, "Tools" group; the row's name is "Metrics" and its sentence "Define each number once, so every goal measured by it means the same thing." While off it adds "Off since {date}: {n} metrics and {m} goals’ links are kept."

**Switching off** opens the toggles spec's read-back sheet with the module's content (rule 8 `offReadBack`):

1. Title "Switch Metrics off for {ws}?"
2. "**{n} metrics, and what {m} goals are measured by, are kept.** They come back as they were when you switch it on." (n = 0: "No metrics have been added yet." and items 3 and 4 are left out.)
3. A list of label and value, each row left out when its count is zero:
   - "Leaves the menu" · "Metrics, and each metric’s page"
   - "On goals" · "{m} goals stop saying what they are measured by, and show their own “What it measures” words instead"
   - "New goals" · "“Measured by” isn’t asked"
   - "From sources" · "{s} goals’ numbers stop arriving from {source names}; their owners type them" (one: "1 goal’s number stops arriving from {source}; its owner types it")
   - "Spreadsheets" · "The Metrics sheet and the “Measured by” columns leave exports and the template" (left out when Spreadsheets is off)
4. When k > 0 goals among the m have an empty `definition`: a Check, "{k} of the {m} goals have no “What it measures” words of their own. They would say “Not described yet”." with a tick box, ticked at first: "Copy each metric’s meaning and source into those {k} goals first". The tick is the answer.
5. **"Switch Metrics off"** (primary) and "Keep it on".

After: the toast "Metrics is off. {n} metrics and {m} goals’ links are kept." with **Undo** (switches it on and takes the copied words back out, as one). Activity: "{name} switched off Metrics" and, when words were copied, "…and copied {k} metrics’ words into their goals" with the goals under "Show the change".

**Switching on** acts at once (nothing is lost by it): the toast "Metrics is on. {n} metrics and {m} goals’ links are back." with Undo.

## 3. The field table

The rows for the shared field table (`docs/design/import/spec.md`; in code, each column of `src/domain/columns.ts` gains `required`, `format`, `example`). The form (2.1), the import preview (2.9), the template, `docs/export-format.md` and Help are all made from these rows. "Row 14:" prefixes a message in a file; the form shows the same words without it. `{read}` is what was found.

### 3.1 The Metrics sheet

Today: 14 columns, `ID` a match column and 13 "shown", `loaded: false` (`columns.ts:355–373`). After: `loaded: true`; the 11 columns a person may give become edit columns; **Action**, **Reason** and the worked-out **Still to say** and **Retired on** are added; Measures and Goal keys stay worked out. Order as below.

| Column | Required / Optional / Worked out | Format | Example | Must fix | Check |
|---|---|---|---|---|---|
| **ID** | Worked out for a new row; matches the row when given | Text, as exported | `metric_deploys` | "ID “{read}” isn’t a metric in {ws}. Leave ID empty to add a new metric, or use an ID from an export." · "Rows {a} and {b} have the same ID." | — |
| **Metric** | **Required** | Text, 3 to 120 characters; used by one metric (any case) | Deploy frequency | "Give the metric a name." · "Give the metric a name of at least three characters." · "Keep the name to 120 characters or fewer." · "There’s already a metric called {name}. Use it, or give this one a different name." (the form; exists) · "Rows {a} and {b} are both called “{read}”. A metric’s name is used once." (a file) | "This is one letter from “{other}” ({unit}, {direction}, owned by {name}, {n} goals)." → form: "Use that one" / "Mine is different: keep it"; file: "Change “{other}” with this row" / "Add “{read}” as a new metric". Close by a word (round 1's rule 4): "This looks like “{other}” (…)." with the same answers. A former name: "“{read}” is now called “{other}”." → "Use {other}" / "Add “{read}” as a new metric" |
| **Action** | Optional (empty: no action) | Retire or Bring back | Retire | "Action says “{read}”. Use Retire or Bring back, or leave it empty." · "Bring back: {metric} isn’t retired." | "Retiring {n} metrics leaves {m} goals measured by a retired metric." → "Retire them" / "Leave these rows out" |
| **Meaning** | Optional (empty: "Not said yet") | Text, up to 2,000 characters: what is counted, out of what or over what period, what is left out | Production deploys finished, per day, averaged over the last 7 days. Rollbacks are left out. | "Keep the meaning to 2,000 characters or fewer." | "This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”." → "It’s right as written" (one answer covers every such row in a file). Changing it on a metric goals use: "{metric}: {n} goals are measured by it. Is it still the same number?" → "Same number, better words" / "The number changes from this week" (then Reason is Required) |
| **Unit** | **Required** | Text, up to 20 characters, as it follows a number | deploys | "Say its unit: %, min, hours, USD, deploys…" · "Keep the unit to 20 characters or fewer." · Changing it on a metric goals use, form: "{n} goals are measured by {metric} in {old}. Is “{new}” a new label for the same numbers, or a different scale?" with "A new label: change it on the goals too" (opens 2.2) and "A different scale", which leaves: "A metric in {new} is a different number. Add it as a new metric and move goals to it, or retire this one." · the same in a file: "It is in {old} and {n} goals are measured by it. A file can’t change its unit: change it on the metric’s page, where its goals are shown first." | "Other metrics here use “{u}”. Use “{u}”, or keep “{read}”?" → "Use “{u}”" / "Keep “{read}”" (rule 1 `unitChecks`) |
| **Decimals** | Optional (0) | A whole number, 0 to 4 | 1 | "Decimals says “{read}”. Use a whole number from 0 to 4." | Fewer than a goal it measures shows: 2.2's read-back (form); "{k} goals show more decimal places than {metric} will." → "Change it" / "Leave this row out" (file) |
| **Direction** | **Required** | Higher is better or Lower is better (a file also takes higher, lower, up, down) | Higher is better | "Say which way is better: higher or lower." (form; exists) · "Direction says “{read}”. Use Higher is better or Lower is better." (file) | Changing it on a metric goals use: 2.2's read-back (form); "{metric}: {k} of its {n} goals would aim the wrong way." → "Change it" (then Reason is Required) / "Leave this row out" (file) |
| **Source** | Optional (empty: "Not said") | Text, up to 2,000 characters: a dashboard, a query, a report | DORA dashboard (Four Keys) | "Keep the source to 2,000 characters or fewer." | Changing it on a metric goals use: as Meaning |
| **Source owner** | Optional ("Not said") | Text: a team or a person | Site Reliability Engineering | "Keep the source’s owner to 2,000 characters or fewer." | — |
| **Refresh** | Optional ("Not said") | Live, Hourly, Daily, Weekly, Monthly or Quarterly | Daily | "Refresh says “{read}”. Use Live, Hourly, Daily, Weekly, Monthly or Quarterly, or leave it empty." | — |
| **Owner** | Worked out when Owner email is given; else read as a name | A person's name | Daniel Okafor | "Owner “{read}” matches {n} people. Give the Owner email." | — |
| **Owner email** | Optional (empty: whoever adds it; on a change: left as it is) | An email of someone in the workspace | daniel.okafor@example.com | "Owner email “{read}” isn’t a person in {ws}. Add them on the People sheet, or leave it empty to own it yourself." (the form: "The metric’s owner isn’t in this workspace.", exists) · "{name} has left {ws}. Choose someone else." | "{n} rows give no Owner email. You will own those {n} metrics." → "I’ll own them" / "Leave these {n} rows out" (a file adding two or more) |
| **Caveats** | Optional | Text, up to 2,000 characters | Deploys by the release train count once per service. | "Keep the caveats to 2,000 characters or fewer." | — |
| **Reason** | Optional; **Required** when the row changes the meaning, source or direction of a metric goals use and the answer is that the number changes | Text, up to 300 characters | Commit time was unreliable for squashed merges. | "Say why, in the Reason column: {n} goals measured by {metric} will show it." | — |
| **Still to say** | Worked out | "Fully defined", or what is missing | where the number comes from, how often it refreshes | — | — |
| **Retired on** | Worked out | A date; empty when in use | 2026-11-11 | — | — |
| **Measures** | Worked out | Each goal with its slice | Lead time for changes (The whole company) | — | — |
| **Goal keys** | Worked out | Keys, "; " between | G-1; G-14 | — | — |

**How a row finds its metric:** by ID when the cell has one (retired metrics included; deleted ones never); otherwise by Metric, any case, spaces trimmed; otherwise it is a new metric. A row whose ID matches and whose name differs is a rename. Header aliases the sheet reader takes: Name → Metric; Description, Definition → Meaning; Better → Direction; Owner e-mail → Owner email. A header row is the Metrics sheet when it has Metric (or Name with Unit and Direction) and one of Unit, Direction, Measures (`sheetKindOf`, extended for the alias).

### 3.2 The Goals sheet: three new columns

After Definition. All three absent with Metrics off.

| Column | Required / Optional / Worked out | Format | Example | Must fix | Check |
|---|---|---|---|---|---|
| **Measured by** | Optional (empty: no metric) | A metric's name or ID | Pipeline queue wait (p90) | "A goal with dated stages has no number, so a metric can’t measure it. Clear “Measured by”." · "The goal is in {gu} and the metric is in {mu}. Use the same unit for both." (exists) · "“{metric}” was retired on {date}. Use “{other}”, which replaced it." (no replacement: "…Choose another, or leave it empty.") | "{n} rows name the metric “{read}”, which isn’t in the library." → "Use “{closest}”" (when rule 1 finds one) / "Add “{read}” as a new metric ({unit}, {direction}, owned by you)" / "Leave these goals without a metric" · "{n} rows clear “Measured by” on goals that have a metric." → "Stop measuring them by a metric" / "Leave them as they are" · the aim: "The target is above the start, but for {metric} lower is better. Is that meant?" → "Yes, it’s meant" / "Leave these rows out" · decimals: "The goal keeps {a} and {metric} {b}." → "Keep the goal’s" / "Use the metric’s" · a change on a goal with check-ins and an empty Reason: the Goals sheet's own Reason column is Required ("Say why this goal is measured differently now, in the Reason column.") |
| **Measured for** | Optional (empty: the goal's team) | A team's name, or The whole company | CI/CD | "Measured for says “{read}”. Use a team’s name, or The whole company." · "Measured for is given, but Measured by is empty." | — |
| **Part** | Optional (empty: all of it) | Text, up to 60 characters | tier-1 services | "Keep the part to 60 characters or fewer." · "Part is given, but Measured by is empty." | "{metric} already has a part called “{other}”." → "Use “{other}”" / "Keep “{read}”" · "Another goal already measures this for {slice}: “{goal}” ({key}, {owner}). Two goals on one number is unusual." → "Carry on" / "Leave this row out" |

A metric added by the answer "Add … as a new metric" takes its unit from the goals that name it (they must agree, or it is a Must fix: "Rows {a} and {b} name “{read}” in different units: {u1}, {u2}.") and its direction from their aim (target below start, or a limit "at most": lower is better).

### 3.3 The Check-ins sheet: three worked-out columns

After Value. Written on export, never read back. Present whether or not Metrics is on (they are facts about check-ins); empty for a typed number with no reading.

| Column | Worked out | Format | Example |
|---|---|---|---|
| **Number from** | Yes | "Typed", or the source's name | CI analytics |
| **Source’s number** | Yes | A number; empty when there was no reading | 41 |
| **Measured at** | Yes | A date and time (ISO, UTC) | 2026-11-12T09:00:00Z |

### 3.4 Round trip

`roundtrip.test.ts` gains: the workbook with the Metrics sheet and the new columns, loaded back unedited, plans no change; retired metrics included (a retired metric's row has an empty Action and a Retired on date, and is not brought back); a workbook exported with Metrics off loads back into the same workspace with Metrics on and changes nothing (absent columns are "left as they are", never "cleared").

## 4. Rules

Pure functions with the worked examples below as their tests, a section each in `spec/modules/metrics/rules.md`, and conformance rows where the demo workspace has a case. They restate nothing: status and "vs plan" words from `goalStatus` and `scorecard.ts`; rights from `canEditMetric` and `canLinkGoal`; the levels' shape (`{ level: 'must' | 'check', field, words, answers }`) from the import spec's rule, whose type they return.

### Rule 1. What a metric still needs: `stillToSay`, `nameChecks`, `unitChecks`, `meaningChecks`

`stillToSay(metric, ownerIsHere: boolean)` → `{ usable: true, full: boolean, missing: string[], line: string }`. `missing`, in this order: "what it means" (meaning empty), "where the number comes from" (source empty), "who owns that source", "how often it refreshes" (refresh null). `line` is "Fully defined" when nothing is missing and the owner is here; "Its owner has left." alone when only that; otherwise "Still to say: {missing, commas}." with " Its owner has left." after it when so. It returns words, never a number; nothing may sort by it.

| Given | Line |
|---|---|
| Lead time for changes (all said; Rhea is here) | "Fully defined" |
| A metric added in a goal form: name, unit, direction | "Still to say: what it means, where the number comes from, who owns that source, how often it refreshes." |
| Meaning and source said; refresh and source owner not | "Still to say: who owns that source, how often it refreshes." |
| All said; its owner marked as left | "Its owner has left." |
| CI compute cost per pipeline run (complete, no goal) | "Fully defined" (unused is round 1's "to sort out", not a gap in the definition) |

`nameChecks(name, others: { id, name }[], former: { id, name }[])` → up to two `{ kind: 'letters' | 'words' | 'former', other }`, closest first. `letters`: after lower-casing and removing accents and punctuation, the two names differ by one edit for names up to 12 characters and two for longer, and are not equal. `words`: round 1's rule 4 (`closeNames`), unchanged. `former`: `name` equals a name a live metric used to have (from the change log's rename entries, passed in). An exact match is the Must fix, not this.

| Typed | Existing | Result |
|---|---|---|
| "Deploy sucess rate" | "Deploy success rate" | `letters` |
| "Deploy frequncy" | "Deploy frequency" | `letters` |
| "Flaky tests rate" | "Flaky test rate" | `letters` |
| "CI cost per pipeline run" | "CI compute cost per pipeline run" | `words` |
| "MTTR" | "MTTD" | Nothing (4 characters or fewer are never `letters`: too many false alarms) |
| "Deploy frequency" | "Production deploys per day", once called "Deploy frequency" | `former` |
| "Change failure rate" | "Flaky test rate" | Nothing |

`unitChecks(unit, unitsInUse: string[])` → `{ use }` or nothing: the unit, lower-cased and without a trailing "s" or ".", equals one in use treated the same, or is one of a fixed set of spellings of it (`percent`, `pct`, `per cent` → `%`; `mins`, `minutes`, `minute` → `min`; `hrs`, `hr`, `hour` → `hours`; `secs`, `seconds`, `sec` → `s` only when `s` is in use; `dollars`, `$` → `USD`), and is not already identical to it.

| Typed | In use | Result |
|---|---|---|
| "mins" | min, hours, % | Use "min" |
| "percent" | % | Use "%" |
| "min" | min | Nothing |
| "deploys" | deploys per day | Nothing |
| "ms" | min | Nothing |

`meaningChecks(metric)` → `'out-of-what'` or nothing: the unit is `%`, or the name (lower-cased) has "rate", "share" or "ratio" and the unit isn't a time or a count per time; and the meaning is not empty; and the meaning has none of: "out of", "share of", "of all", "of every", "divided by", "per ", "÷", "/", "percentage of", "proportion of", "fraction of". An empty meaning is never a Check.

| Metric | Result |
|---|---|
| Change failure rate, %: "Share of production deploys that led to an incident…" | Nothing |
| Remote build cache hit rate, %: "Build actions served from the cache, out of all cacheable actions" | Nothing |
| "Deploy success rate", %: "Deploys that worked." | `out-of-what` |
| Any metric in % with no meaning | Nothing (it is "Still to say") |
| Pipeline queue wait (p90), min | Nothing |

### Rule 2. Measuring a goal by a metric: `linkChecks`, `partsOf`, `closePart`

`linkChecks(goal, metric, slice: { teamId, part }, others: { goalId, title, key, ownerName, teamId, part }[], hasCheckIns: boolean, reason: string)` → the levels. It calls `linkProblems` for what exists and adds:

| Case | Level | Field |
|---|---|---|
| `linkProblems` errors (dated stages; unit) | Must fix | Measured by |
| The metric is retired | Must fix | Measured by |
| `linkProblems` warnings (aim; decimals) | Check | Target; Decimals |
| Another live link with the same metric, `teamId` and part (compared by `partKey`) | Check | Which part |
| `closePart` finds one | Check | Which part |
| `hasCheckIns`, the metric, team or part differs from the goal's present link, and `reason` is empty | Must fix | Why |

`partKey(part)`: lower-cased, accents and punctuation removed, spaces collapsed, a trailing "s" dropped per word. `partsOf(links)` → the distinct parts of a metric's live links by `partKey`, most used first, each in its most used spelling. `closePart(part, parts)` → a part with the same `partKey` and a different spelling, or one edit away; else nothing.

| Given | Then |
|---|---|
| A goal in hours, a metric in min | Must fix: "The goal is in hours and the metric is in min. Use the same unit for both." |
| A goal planned from 9 down to 4 min; Pipeline queue wait (p90), lower is better | Fine |
| A goal planned from 4 up to 9 on it | Check (aim) |
| A keep-in-range goal "at most 5 min" on it | Fine |
| A keep-in-range goal "at least 5 min" on it | Check (aim) |
| For Build & Release, part "release builds", when G-61 has the same | Check (another goal) |
| Part "Tier 1 service" when "tier-1 services" is in use | Check: use "tier-1 services" (`partKey` equal) |
| Part "EU" when parts are "US", "APAC" | Fine (two letters: never one edit away) |
| A goal with 12 check-ins moving from Flaky test rate (old) to Flaky test rate, no reason | Must fix (Why) |
| The same goal, before its first check-in | Fine |
| A dated-stages goal | Must fix (exists); the field is never shown, so this is for files and tools |

`linkGoalMetric` gains `part` (default `''`) and `reason`; it calls `linkChecks` and refuses on a Must fix. A link change on a goal with check-ins writes a mark (rule 4, kind `link`) on the goal's own History entry (it is already a change-log entry with `goalId`; its summary becomes "Measured by “{metric}” for {slice}: {reason}").

### Rule 3. What kind of change: `changeKind(before, after, linkedGoals: { id, unit, decimals, aimsUp }[])`

Returns one of, the first that applies:

| Kind | When | What the form does |
|---|---|---|
| `none` | Nothing differs | Saves nothing |
| `scale` | The unit differs, goals are linked, and the person said "a different scale" (or it came from a file) | Must fix |
| `relabel` | The unit differs, goals are linked, and the person said "a new label" | 2.2; on save, each linked goal's unit is changed in the same commit |
| `direction` | Direction differs and goals are linked | 2.2, reason Required, mark |
| `meaning` | Meaning or source differs and goals are linked | 2.2, the question; mark only when the number changes |
| `decimals` | Decimals fall below a linked goal's | 2.2, no reason |
| `words` | Anything else (name, owner, source owner, refresh, caveats; or any change with no goals linked) | Saves |

Several at once: the read-back shows each part in the order above, with one reason and one primary button "Save these changes".

| Before → after | Goals | Kind |
|---|---|---|
| Caveats reworded | 3 | `words` |
| Renamed | 3 | `words` (the summary says "Renamed…") |
| Meaning changed | 0 | `words` |
| Meaning changed | 3 | `meaning` |
| "mins" → "min", said to be a label | 5 | `relabel` |
| hours → min from a file | 3 | `scale` |
| Lower → higher is better | 4, two aiming down | `direction` (k = 2 named) |
| Decimals 1 → 0, a goal showing 1 | 1 | `decimals` |

`saveMetric` gains `{ comparable?: boolean, reason?: string, relabel?: boolean }` and refuses, in the rule, what the form refuses: `scale`; `meaning` with `comparable === undefined` ("Say whether it is still the same number."); `meaning` with `comparable === false`, or `direction`, with no reason.

### Rule 4. Marks: `marksFor(metric, link, cycle)` and what writes one

A mark is `{ week, at, by, kind: 'definition' | 'direction', why, was, now }`, kept on the metric (`Metric.marks`, section 6), newest last. `saveMetric` appends one for `meaning` with `comparable: false` (`was` and `now` are the two texts) and for `direction`. `week` is the cycle week of `at`.

`marksFor` returns the metric's marks made at or after `link.linkedAt` and inside the cycle, for the goal's chart and History; plus, from the goal's own change log, link changes after its first check-in as `{ kind: 'link' }`.

| Given | Then |
|---|---|
| Lead time for changes redefined in week 46; ns-lead linked since January | One mark at week 46 on ns-lead |
| A goal linked to it in week 48 | No mark (it was never measured the old way) |
| A reworded meaning, "same number" | No mark |
| Undo of the change | The mark goes with it (the metric is put back as it was) |

### Rule 5. Retiring, bringing back, merging: `retireMetric`, `unretireMetric`, `mergeMetrics`, `everUsed`

- `everUsed(metricId, allLinks)`: any link to it, in force or not.
- `retireMetric(x, id, why, replacedBy?)`: its owner or an admin (`canEditMetric`); refuses an empty `why`, a `replacedBy` that is not a live metric in the same unit, and a metric already retired. Sets `retiredAt`, `retiredBy`, `retiredWhy`, `replacedBy`. Links are untouched. Logs on the metric (action `stopped`, summary "Retired the metric “{name}”: {why}") and once per linked goal with `goalId` (action `edited`, "Its metric “{name}” was retired: {why}").
- `unretireMetric(x, id)`: the same people; clears the four fields; logs (`restored`).
- `removeMetric` (exists) refuses when `everUsed`: "{name} has measured goals, so it can’t be deleted. Retire it instead."
- `mergeMetrics(x, fromId, intoId, why)`: admins only (decision 3). Refuses different units, the same metric, a retired or removed `into`. Moves every live link of `from` to `into` (same team and part; a link that would collide with one of `into`'s on the same goal can't exist: one link per goal), retires `from` with `replacedBy = into`, logs on both metrics and once per moved goal ("Measured by “{into}” in place of “{from}”, which was merged into it").
- `liveMetrics` gains `{ retired?: boolean }`: by default retired metrics are left out (pickers, the library's list, suggestions); `linkOf` and `measureOf` still resolve a retired metric, and `Measure` gains `retired: { at, by, why, replacedBy } | null`.

| Given | Then |
|---|---|
| Retire Flaky test rate (1 goal), why given | The goal's link stays; `measureOf` gives the metric with `retired`; `liveMetrics` no longer lists it; `findMetric` by name still finds it for a file |
| Link a new goal to it | Refused: "“Flaky test rate” was retired on 11 Nov. Choose another, or bring it back." |
| Bring it back | As before it was retired |
| Delete CI compute cost per pipeline run (never linked) | Removed (today's rule) |
| Delete Lead time for changes | Refused; "Retire it instead." |
| Merge a USD metric with 2 goals into a USD metric with 1 | 3 links on `into`; `from` retired, pointing to it; Undo puts all of it back |
| Merge hours into min | Refused |
| Rhea (not an admin) merges two she owns | Refused: "Only admins can merge metrics: it changes what other people’s goals are measured by." |

### Rule 6. Comparing: `compareGoals(rows, order, scale)`

`rows` are round 1's rule 2 rows (`metricGoals`), each gaining `part`, `saidWhy` (this week's check-in has a reason), `series` (the value per week, from the summary rows the goal page already reads), `plan` (the plan per week) and `limit`. Returns:

- `rows` in order: `worst` is `RANK`, then the gap to plan as a share of the distance from start to target (a keep-in-range goal: the distance past its limit, else 0), largest first, then title; `slice` is the whole company first, then team A to Z, then part A to Z.
- `trend` per row, from the last four weeks that have a value: "Worse {n} weeks running" / "Better {n} weeks running" (n ≥ 2, each week strictly worse or better in the metric's direction), "Level" (the last four within half of the last decimal place), "Up and down" otherwise, "Too new to say" with fewer than three values.
- `countLine`: the statuses as counts, worst first, in the status vocabulary's words; `spread`: lowest and highest Now and target, or nothing when fewer than two.
- `scale`: `same` when the largest of every value, plan and target is at most five times the smallest above zero; else `own`. With `same`, one `{ lo, hi }` for all (lo is 0 when every value is ≥ 0 and the smallest is under half the largest; else the smallest less a tenth of the range).
- No field of the result holds a rank, and no sentence it returns names a team, a part or a person.

| Given | Then |
|---|---|
| Three goals: off track 11 min (plan 6), at risk 7 (plan 5), on track 4 (at most 5) | In that order; "1 off track, 1 at risk, 1 on track."; "Now between 4 and 11 min; targets and limits between 4 and 5 min."; scale `same`, 0 to 16 |
| Two off track, 5 and 2 min behind, on plans of the same length | The one further behind as a share of its own plan first |
| Values 14, 13, 12, 10, 9, 9, 10, 11 | "Worse 2 weeks running" |
| Values 6, 5, 5, 4, 5, 4, 4, 4 at 0 decimals | "Level" |
| One goal at 4 deploys a day and one at 1,250 | Scale `own`; the key says "Each has its own scale." |
| One goal | No count line, spread or charts |
| A goal with no check-in yet | Listed with "No value yet", last within its status; left out of the spread and the scale |

### Rule 7. A reading in a check-in: `readingState(reading, lastReading, lastValue, refresh, now)`

`reading` is `{ value, at } | null | 'unreachable'`; `lastReading` the reading the goal's latest check-in recorded (or null); `lastValue` that check-in's value. Returns the first that applies:

| State | When |
|---|---|
| `unreachable` | The source threw |
| `missing` | `reading` is null |
| `same` | `lastReading` exists and `reading.at` ≤ `lastReading.at` |
| `stale` | `now − reading.at` is more than the refresh allows: Live or Hourly 1 day; Daily 2 days; Weekly or not said 8 days; Monthly 35 days; Quarterly 100 days |
| `jump` | `lastValue` is not null or zero, and `reading.value` is ≥ 10 times it or ≤ a tenth of it (by size, sign aside); or `lastValue` is zero and the value's size is ≥ 10 units at the metric's decimals |
| `fresh` | Otherwise |

`revised(now, then)`: separately, with `lastReading`: the source asked again for `lastReading.at` now gives a value that differs from `lastReading.value` at the metric's decimals.

| Given (hourly, now Thu 12 Nov 10:00) | State |
|---|---|
| 41 at Thu 09:00; last check-in 43, typed | `fresh` |
| 43 measured Wed 28 Oct | `stale` (15 days) |
| 410 at Thu 09:00; last 43 | `jump` |
| 4 at Thu 09:00; last 43 | `jump` (a tenth) |
| The same reading as the last check-in recorded | `same` |
| A monthly metric, read 1 Nov, on 12 Nov, not recorded before | `fresh` |
| The same on 19 Nov, after a check-in recorded it | `same` |
| Null | `missing` |
| The source threw | `unreachable` |
| Asked again for last week's moment: 45, where 43 was recorded | `revised` |

### Rule 8. Switching off: `offReadBack(metrics, links, goals: { id, definition }[], sources)`

Returns `{ metrics: n, goals: m, fromSources: s, sourceNames, wordless: k, sentences }` for 2.10, and `copyWords(goal, metric)` → the goal's `definition` and `source` to write when the box is ticked: `definition` = the metric's meaning (only when the goal's is empty); `source` = "{source} ({source owner})" (only when the goal's is empty and the metric's isn't). Retired metrics' links count.

| Given | Then |
|---|---|
| The demo: 13 metrics, 12 links, every linked goal with words of its own | n 13, m 12, k 0: no Check |
| The same after 7 goals' `definition` are emptied | k 7; ticked, each gets its metric's meaning, and its source where it had none |
| No metrics | "No metrics have been added yet." |

## 5. The number source

### 5.1 The port as designed (`src/ports/index.ts`)

```ts
/** Whose number, and which part of it: a link's slice. */
export interface Slice { teamId: string | null; part: string }

export interface Reading {
  value: number;
  /** When the source measured it (an ISO time). */
  at: string;
}

export interface NumberSource {
  /** Its name as a metric's `source` names it. */
  readonly name: string;
  /** Whether it can read this metric, for this slice (left out: any). */
  reads(metric: Metric, slice?: Slice): boolean;
  /** The latest reading at or before `at`; null when it has none yet. Throws only when it can't be reached. */
  read(metric: Metric, at: Date, slice?: Slice): Promise<Reading | null>;
}
```

The change is the optional `slice`, so today's adapter and contract still compile. The app registers sources through the existing parts wiring; the module finds a metric's source with `sources.find((s) => s.reads(metric, slice))`.

**The contract** (`numberSourceContract`, `src/ports/contracts/parts.ts`) keeps its two tests and gains:

- a slice it reads gives that slice's number, and two slices of one metric may differ;
- a slice it doesn't read: `reads` is false and `read` is null;
- asked twice for the same moment it gives the same reading, unless it says the number was revised (the `revised` case), in which case the later answer is the true one;
- it never returns a reading measured after `at`, and never a value that isn't finite;
- it throws only for "can't be reached"; "no number" is null.

### 5.2 The demo's source (`src/adapters/demo/numbers.ts`)

It stops echoing check-ins. "CI analytics" reads **CI pipeline time on main (p90)** (the whole company) and "CI runner metrics" reads **Pipeline queue wait (p90)** for two slices (the demo's new links, section 6.3). Each has a seeded series by week in the adapter (a fixed table, the example's own numbers continued one week past the last check-in), measured "Thursday 09:00" of each week; a reading is the latest at or before the moment asked. One week of one series is revised after the fact, and one slice has no reading in the present week, so the `revised` and `same` states can be seen. The eval fixtures add a source that throws and one two weeks behind.

### 5.3 What the app records

On `CheckIn` (core; section 6): `reading?: { source: string; value: number; at: string } | null`. Set by the check-in's commit when the step held a reading: the source's name, its value and when it was measured. `CheckIn.value` stays the number the owner used. So:

| `reading` | `value` | Says |
|---|---|---|
| null | 41 | "Typed by {name}." (said only on rows near a sourced one, and in the sheet) |
| 41 at t | 41 | "From {source}, measured {t}. {name} checked in." |
| 45 at t | 43 | "Typed by {name}. {source} said 45 min." |
| 43 at t (and "No new number this week") | unchanged | "No new number: {source} still said 43 min, measured {t}." |

Nothing else is stored: Faro keeps no series of readings. A correction (`revised` → "Correct it to {new}") is a change to that week's check-in through the change engine, summary "Corrected week {w} from {old} to {new}: {source} revised it", `reading` updated; who may is whoever may change that check-in today (the build confirms the owner may; if only admins may, the button shows to admins and the owner sees "An admin can correct week {w}.").

### 5.4 Requirements for the internal platform (spec only)

Written into `src/spec/internal.ts` as a new requirement page, "R7. Number sources" (the next free id if R7 is taken), which `npm run spec` turns into `spec/requirements/internal/`. Faro builds none of these.

| # | Requirement |
|---|---|
| R7.1 | **Connectors.** Each source (a warehouse, a dashboard's API, a monitoring tool) is a `NumberSource` that passes the contract. The demo's is not a connector |
| R7.2 | **Credentials** are held by the platform's secret store and used on the server. None is in the browser, in Faro's tables, or in a metric's fields |
| R7.3 | **A reference per metric and slice**: what a connector reads (a query, a series, a dashboard tile), kept by the platform beside the metric, changed only by the source's owner or an admin |
| R7.4 | **A schedule.** The platform reads each metric on its refresh cadence and keeps every reading with the time measured and the time fetched. `read` is answered from those, not by calling the source while a person waits; the 200 ms budget of a list (R4) holds |
| R7.5 | **Revisions.** A source that restates a past number keeps both; the check-in's `revised` question reads them |
| R7.6 | **Failure is the source owner's.** A connector that fails or falls behind raises it through the platform's observability to who owns that source. A goal's owner sees only the check-in's words |
| R7.7 | **Access.** A reading is as readable as the goal it measures (R1); a connector reads with the platform's rights, never the viewer's |
| R7.8 | **A number with nobody confirming it** (decision 5): if the company wants it, a reading may be recorded as a number with no status call, shown as "from the source, nobody has said anything yet", and never counted as a check-in. Left out of Faro on purpose |

## 6. Data

No new table. Seven columns on three tables, in two migrations, because slices, retirement and marks have nowhere else to live (a retired metric must keep its links, which `removed_at` cannot say; a mark must reach every goal's chart without parsing the change log's sentences; a part and a reading are facts about a link and a check-in). `okr_upsert` reads a table's columns each time (`0011`), so no function changes; `okr_changes`' action list is not widened (the new entries use `edited`, `stopped`, `restored`, `linked`).

Read `supabase/README.md` first. Both run as `faro_owner` with `search_path` faro; plain names land in `faro`. Table-level grants already cover new columns; they are written out again as the README asks. **A new column gets no redirect in `public`** (0035's views are fixed), so the app sees these only once the Data API offers `faro` (backlog 0c2): that setting comes first, and MT2 to MT4 wait for it on the shared database. The browser store and the demo need neither.

### 6.1 Migration A (with MT2 and MT3): `00NN_metric_parts_and_retirement.sql`

```sql
-- The metric library, round 2 (docs/design/metrics-2/spec.md): a link's part, a metric's retirement and its marks.
-- Runs as faro_owner, search_path faro. Safe to run twice: every column only if missing; no data moves.

-- Which part of a team's or the company's number a goal is measured by ('' for all of it).
alter table okr_goal_metrics add column if not exists part text not null default '' check (length(part) <= 60);

-- Retired: out of pickers and the list, its links kept (removed_at would drop them). Brought back by clearing these.
alter table okr_metrics add column if not exists retired_at timestamptz;
alter table okr_metrics add column if not exists retired_by text;
alter table okr_metrics add column if not exists retired_why text not null default '' check (length(retired_why) <= 300);
-- The metric that replaced it (a merge, or named on retiring). No foreign key: a deleted replacement still reads.
alter table okr_metrics add column if not exists replaced_by text;

-- Changes of meaning or direction that goals must show: [{ week, at, by, kind, why, was, now }], oldest first.
alter table okr_metrics add column if not exists marks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(marks) = 'array');

grant select, insert, update on okr_metrics to anon;
grant select, insert, update on okr_goal_metrics to anon;
```

The unique name index (`okr_metrics_ws_name … where removed_at is null`) is left as it is: a retired metric keeps its name, so no second metric can take it while the first still measures goals.

### 6.2 Migration B (with MT4): `00NN_check_in_reading.sql`

```sql
-- Where a check-in's number came from (docs/design/metrics-2/spec.md, 5.3): what the source said and when it was
-- measured; null when the number was typed with no reading to hand. Runs as faro_owner, search_path faro.
-- Safe to run twice.
alter table okr_check_ins add column if not exists reading jsonb
  check (reading is null or (jsonb_typeof(reading) = 'object' and reading ? 'source' and reading ? 'value' and reading ? 'at'));

grant select, insert, update on okr_check_ins to anon;
```

The build session checks which roles 0035 and 0036 left with rights on these tables and matches them (the grants above name `anon`, as 0033 did); both statements go in the PR description in full.

### 6.3 Types, and the demo

- `Metric` gains `retiredAt?`, `retiredBy?`, `retiredWhy?`, `replacedBy?`, `marks?: MetricMark[]`. `MetricLink` gains `part?: string`. `CheckIn` gains `reading?`. Row mappers each way; absent reads as empty.
- `src/data/platformOrg/metrics.ts`: three more of the demo's existing goals are linked so that **Pipeline queue wait (p90)** measures three goals (one for CI/CD, one for CI/CD with a part, one for Build & Release with a part) and **Flaky test rate** two; the build picks goals already in those units, or adds two small goals if none fit. Linking moves no number, so the conformance rows for existing goals don't move. One metric gets a `marks` entry in week 40, and one unused metric is retired, so every state has an example. `module.json`'s exit line "13 metrics and 12 links" is updated to the new counts.

## 7. Extension points, and what must be core

| Point | Use | State |
|---|---|---|
| Round 1's (routes, `navigation`, `goal.measure`, `goal.sections`, `goal.facts`, `finders`, `filters`, module-level `needs`, records) | As round 1 | As round 1 says |
| `checkin.number` (a place) | 2.8: the module's block above the number field. Props: `{ goal, week, last: { value, reading } \| null, onUse(value, reading), onNone(reading), onType(reading) }` | **New: MT4.** A line in `docs/architecture.md`'s table; a manifest check |
| `goal.now` (a place) or a `provenance` line in the goal spec's Now | 2.7's "From {source}…" line and the no-rhythm block | **New: MT4.** If the goal spec's Now already takes module lines through `goal.facts`, use that and add no place |
| `goal.marks` (data, not a place): a module returns `{ week, label, kind }[]` for a goal | 2.7's chart rules and History entries | **New: MT3.** The chart and History draw what modules return; the core knows nothing of metrics |
| `sheets` (data): a module declares a whole sheet (its `SheetSpec` and its reader) and columns for a core sheet (`{ sheet: 'goals', after: 'Definition', columns }`), each read through the change engine | 3.1, 3.2: the Metrics sheet and the three Goals columns leave `src/domain/columns.ts` for `src/modules/metrics/columns.ts` | **New: MT6**, as part of AS part 2's "columns and export iterate over what modules declare". With the module off, they are absent by construction (M2-8) |
| The import's undo taking a module's records | One Undo for a load of metrics and links (`ImportUndo` names goals, check-ins, people and asks today) | **New: MT6**, on AS part 2's records point |
| `offReadBack` (a module function) | 2.10 | **New: FT2** defines the read-back for a module that owns records; MT7 supplies this module's. If FT2 names it differently, use its name |
| Number sources | 5.1 | Exists (the parts wiring, 8c); gains the slice |

**Core, and why:**

1. `CheckIn.reading` and the Check-ins sheet's three worked-out columns: a fact about a check-in, true whether Metrics is on or off afterwards.
2. `NumberSource`'s `Slice`: a port.
3. The three new points above that are core by nature (`checkin.number`, `goal.marks`, `sheets`).

Everything else (rules 1 to 8, the screens, the tools, the demo source's registration) is the module's. `src/domain` gains no metric rule.

**MCP parity** (`src/modules/metrics/tools.ts`, `src/mcp/parity.ts`; then `npm run build:mcp`). Every new action has a tool or an argument:

| Action on screen | Tool |
|---|---|
| The completeness line; History; marks; the comparison | `get_metric` returns `still_to_say`, `retired`, `marks`, `history` (20), and `goals` as rule 6's rows with `count_line`, `spread`, `trend`; never a rank |
| The Checks when adding or changing | `save_metric` returns `checks` (unanswered questions) without saving when any stand, and takes `answers: { name?: 'keep' \| 'use:<id>', unit?: …, meaning?: 'as-written' }`; `comparable`, `reason`, `relabel` for rule 3 |
| Retire, bring back | `retire_metric { metric, why, replaced_by? }`, `retire_metric { metric, bring_back: true }` |
| Merge | `merge_metrics { from, into, why? }` (admins) |
| Delete a never-used metric | `remove_metric` (exists; now refuses a used one) |
| For, Which part, Why | `link_goal_metric` gains `part`, `reason`; returns `checks` as `save_metric` does |
| The library's Retired filter | `list_metrics` gains `retired` |
| A reading in a check-in | `get_reading { goal }` → the reading and rule 7's state; the check-in tool gains `from_source: true` (uses the reading; refuses on a Check unless `confirm` names it) and records `reading` either way |
| Correct a revised week | The change engine's check-in change, with `reading` |
| The Metrics sheet in and out | The import and export tools, through the same engine |
| Switch off, with its read-back | `set_feature` gains `preview: true` (returns rule 8's counts and sentences) and `copy_words: boolean` |

`SCREENS` gains a row for each new capitalised `.tsx`.

## 8. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U105 | `METRIC-DEFINED` | Defining a metric well: as Rhea, Add a metric with the name "Deploy sucess rate", unit "%", no direction and the meaning "Deploys that worked." Saving is refused: "1 to fix, 2 to check."; the Must fix is under "Which way is better", outlined, in its words; the name's Check names "Deploy success rate" and both answers work ("Use that one" opens it and keeps the draft); the meaning's Check goes with "It’s right as written". After choosing a direction and answering, it saves; its page says "Still to say: where the number comes from, who owns that source, how often it refreshes." and never a number or a bar. After adding the three, it says "Fully defined". As Tunde the same page shows the line and no links on it |
| U106 | `METRIC-CHANGE` | A metric changes and is retired: as Rhea, change Lead time for changes' caveats: saved at once. Change its meaning: the read-back asks "Is it still the same number?", names its goals, and with "The number itself changes" refuses without a reason; saved, the goal's chart has the rule "Definition changed, week 46" and its History the entry with her reason; Undo removes both. Change its unit to "mins": the question; "A different scale" leaves the Must fix; "A new label" reads back the goals and changes their unit. Retire a metric with a goal: the goal says "Measured by …, retired 11 Nov" and keeps its number; the picker no longer offers it; "Bring it back" restores it. As Amara, merge two metrics in the same unit: the goals move, one Undo puts all back. A never-used metric offers Delete, not Retire. As Tunde none of these buttons exist |
| U107 | `METRIC-SOURCE` | A number arrives: as Rhea, the check-in for the goal measured by CI pipeline time on main (p90) opens on "41 min · From CI analytics, measured Thu 12 Nov at 09:00"; "Use 41 min" goes to the story step; the read-back says where it came from; after posting, the goal's Now and History say "From CI analytics…". Again typing 39 over it: History says "Typed by Rhea Kapoor. CI analytics said 41 min." With the fixture source two weeks behind: the Check, and each of its three answers. With the fixture that throws: "couldn’t be reached", and typing works. With ten times the last: the Check. The Check-ins sheet has the three columns filled for these rows, and loads back as "Nothing would change". With the check-in rhythm set to no set rhythm: the goal's page says "Latest from CI analytics … Not checked in yet." and nothing is due |
| U108 | `METRIC-COMPARE`, `METRIC-SHEET` | Comparing and the sheet: as Amara on Pipeline queue wait (p90): the count line gives statuses and the spread and names no team; the table is worst first, with For and part, and "Last 4 weeks" in words; three small charts share one scale and the key says so; "By team and part" reorders; "See these as a table of weeks" shows the same numbers. As Tunde his row says "yours". Then, in `/?store=browser` with database requests blocked: import a Metrics-only file of 200 rows with two Must fix rows and two Checks: the counts, each message in section 3's words, one answer covering 14 rows, the button live only after; one Undo removes all 188. A goals file naming "Deploy frequency" asks the three-way question once for its rows. Export, load back: "Nothing would change". Switch Metrics off: the read-back's counts match; afterwards the menu, the goal page, New goal and a fresh export have nothing of metrics; Undo brings all of it back |

**Changed:** U83 (round 1): its Remove step becomes Retire, and its unit-change step the guided change. The check-in journeys: the number step may show the source's block. The toggles' journeys (U101 to U104): Metrics' row reads back.

### F, N and P checks

| # | Check |
|---|---|
| F21 | Phone, 390 px: on the form a Must fix or Check block sits directly under its field and its answers are full width and at least 44 px high; the check-in's "Use {value}" is within the first screen with the source's line above it; the comparison's goals are stacks, not a table that scrolls sideways, and each small chart is at least 280 px wide; the import preview's Must fix rows are stacks; nothing scrolls sideways on any screen of section 2 |
| N22 | One set of numbers, and no ranking: a metric's count line, its table rows and its charts' captions agree with each other and with Goals filtered to it; a goal's Now, its History row and the Check-ins sheet agree on where a number came from; the preview's counts equal what is saved; and no text on a metric's page or from `get_metric` matches `/\b(rank|ranked|#\d+|best|worst team|top|bottom|league|leader ?board)\b/i` or pairs a team's or person's name with "lowest" or "highest". At company size: a 200-row Metrics file previews within 2 s and the library with 300 metrics still draws 50 |
| P3, P4, P6 | Extended: Must fix and Check use the warning mark and never a status shape; no pill, no edge stripe, no quote bar on any new block; a chart's mark is a hairline with a label beside it; statuses in the comparison are shape plus word |

### Unit tests

One file per rule with every worked example; the contract's new cases against the demo source and the two fixtures; `roundtrip.test.ts`'s cases (3.4); `tools.test.ts` for each new tool and argument; the manifest test for the new places and `sheets`; `guide.test.ts` for the new articles.

### Requirements (`evals/requirements.json`, listed in `module.json`)

| Id | Says |
|---|---|
| `METRIC-DEFINED` | "A metric can be used with a name, a unit and a direction; what it still lacks is said in words, never scored; and a likely mistake in its name, unit or meaning is questioned before it is saved" |
| `METRIC-CHANGE` | "A change to a metric that goals use is read back with those goals first; a change to what the number is leaves a dated mark and a reason on each of them; a used metric is retired, never removed, and can be brought back" |
| `METRIC-SOURCE` | "A number from a source is offered with where and when it was measured, confirmed by the goal’s owner, never blocks a check-in, and is told apart from a typed one ever after" |
| `METRIC-COMPARE` | "Every goal measured by a metric can be seen side by side, each against its own plan, worst first, with no ranking of teams or people" |
| `METRIC-SHEET` | "Metrics and what measures each goal go out in the workbook and come back through the same preview, rules and undo as any import, and loading an export back changes nothing" |

## 9. Help and What's new

### Help (`src/modules/metrics/help.ts`)

| Article | Title | Body, in short |
|---|---|---|
| `metric-define` (route `/metrics/new`; replaces round 1's `metric-add`) | "Defining a metric well" | The three things a metric needs and the five that make it fully defined; what "Still to say" means and that it is never a score; Must fix and Check on the form, with the three questions it may ask; adding 200 at once from a file |
| `metric-change` (route `/metrics/<id>/edit`) | "Changing, retiring and merging a metric" | Which changes save at once; "Is it still the same number?" and the mark it leaves on goals; a new unit label against a different scale; retire against delete; bring back; merge (admins); Undo |
| `metric-slices` (a section of `goals-new` and `goal-edit`, through the module's Help) | "Measured by: for whom, and which part" | What a goal takes from its metric and what stays its own; For; Which part and why to reuse a part's name; why a reason is asked after check-ins |
| `metric-source` (a section of `check-in`) | "When the number arrives by itself" | What "From {source}, measured…" means; confirming, typing over, "No new number this week"; late, missing and unlikely numbers; what History and the spreadsheet say afterwards; with no set rhythm |
| `metric-compare` (a section of `metrics`) | "Comparing goals on one metric" | The count line, the two orders, the small charts and their scale, the table of weeks; that it never ranks |
| `metric-sheet` (a section of the import article) | "The Metrics sheet" | Each column from the field table; how a row finds its metric; Action; "Measured by", "Measured for" and "Part" on the Goals sheet |
| `features` (the core's) | — | One paragraph: what switching Metrics off keeps, hides and offers to copy |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| MT1 | `metric-defined` | "Metrics say what’s still to say" | "Adding a metric asks for three things first; the rest can be said later." "A name one letter from another’s, or a percentage that doesn’t say out of what, is questioned before it’s saved." "Each metric says “Fully defined” or what it still lacks. It is never a score." |
| MT2 | `metric-part` | "Measure a goal by one part of a number" | "“Measured by” now has “Which part”: tier-1 services, a region, release builds." "A goal takes its unit and direction from its metric." |
| MT3 | `metric-change` | "A metric that changes tells its goals" | "Changing what a metric means shows its goals first, and marks each one’s chart and History when the number itself changes." "Metrics are retired, not removed: goals keep what they were measured by." "Two metrics that are one can be merged." |
| MT4 | `number-from-source` | "Numbers that arrive by themselves" | "When a goal’s metric has a source Faro can read, the check-in offers its number, with where and when it was measured." "You still confirm it and say what changed." "Every number says whether it was typed or came from a source." |
| MT5 | `metric-compare` | "Compare goals on one metric" | "A metric’s page shows each goal against its own plan, worst first, on one scale." "It never ranks teams or people." |
| MT6 | `metrics-sheet-in` | "Import metrics from a spreadsheet" | "The Metrics sheet now loads back: add or change hundreds at once, with every change shown first." "The Goals sheet says what each goal is measured by." |
| MT7 | `metrics-off` | "Switching Metrics off says what it does first" | "Features shows how many metrics and goals are kept, and offers to copy each metric’s words into its goals." "Off, the Metrics sheet leaves exports too." |

## 10. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | (b) Named slices on the metric | A table `okr_metric_parts (id, workspace_id, metric_id, name, removed_at)` with grants written out; "Which part" is find-and-pick over it with "Add “{q}” as a part" for the metric's owner; `closePart` is dropped; the Metrics sheet gains a "Parts" column; MT2 becomes M. (c) No parts: 2.6's item 3, `part`, `partsOf`, `closePart`, the Part column and its migration line are dropped; the "another goal" Check compares metric and team only |
| 2 | (b) Keep Remove | Rule 5, 2.3's Retire, the retired states in 2.4 and 2.7, Action in 3.1 and four columns of migration A are dropped; round 1's 2.5 stands; merge unlinks and relinks instead of retiring `from` (it is removed) |
| 3 | (b) The metric's owner too | `mergeMetrics` and `relabel` allow `canEditMetric` on both metrics; R1's table in `src/spec/internal.ts` gains the row "a metric's owner may change the unit label and the link of goals measured by it"; the role table's gap rows become Yes for Rhea |
| 4 | (b) Every change of meaning marks | 2.2's question is dropped; reason always Required; `comparable` is dropped. (c) No marks: rule 4, `marks`, `goal.marks` and their migration line are dropped; 2.2 keeps the read-back and the reason, which go to the change log only |
| 5 | (b) or (c) Recorded by itself | Out of Faro's build either way; R7.8 becomes a "must" and names the shape: a check-in with `status` equal to the calculated one, no author, `reading` set, shown as "From {source}. Nobody has said anything yet." |
| 6 | (b) Free | Rule 2's last row, 2.6's item 6 and the `link` mark are dropped |
| 7 | (b) Two fields | A column `calculation text not null default ''` on `okr_metrics`; the form, sheet and field table gain "How it’s calculated"; `meaningChecks` reads it; "Still to say" gains "how it’s calculated" |
| 8 | (b) Proposed | Not designed here: it is the growth list's Draft and Ready; write it as a requirement and leave the build out |
| 9 | (b) Always on | 2.10, rule 8, MT7 and the `sheets` point's "absent when off" are dropped; `module.json` gains `"core": true` or the module's rules move to the core, which undoes AS part 2 for it: not recommended. (c) Off by default: `modulesOff` starts with `metrics` for a new workspace; set-up's line reads "Off" |
| 10 | (b) Leave the example | 6.3's links are dropped; U107 and U108 run on fixtures only; the demo can't show sections 4 and 5 |
| 11 | (b) "Metric library" | The Features row and the read-back's title keep that name; everything else says Metrics |

## 11. Build plan

Effort: S under a day, M a release, S–M between. All after round 1's ML1 to ML3 and AS part 2 (the rules and records are the module's by then). Round 2's other areas are named by their item prefixes; where their numbering isn't final, the dependency is on the thing named.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| MT1 | **Defining a metric well** | 2.1; section 3.1's rows as the field table for the form; rule 1; the line on the page and in `get_metric`; `save_metric`'s `checks` and `answers`; Help `metric-define`; U105 | S–M | ML3 (the form, each error under its field); IM1 (the field table's shape in `columns.ts`, and the levels' type); AS part 2 |
| MT2 | **For, which part, and what a goal takes from its metric** | 2.6, 2.7's About block; rule 2; `part` (migration A's first line; the rest of A may ride along); `link_goal_metric`; the demo's extra links (6.3); Help `metric-slices` | S–M | ML2 (the picker in the form), OB1 (the measure step), FS1; GE's read-back on the edit page ("What will change") for item 6; the Data API offering `faro` (0c2) for the shared database |
| MT3 | **Changing, retiring, merging; History and marks** | 2.2, 2.3, 2.4's History, 2.7's retired block, chart rules and History entries; rules 3, 4, 5; migration A; `goal.marks`; `retire_metric`, `merge_metrics`; Help `metric-change`; U106 | M | ML1 (the page), ML3 (its Remove sheet, which this replaces); GT1–GT3 (the goal's chart and History taking module marks); MT2 (the part in read-backs); decision 3 |
| MT4 | **Numbers from the source** | Section 5 (the port's slice, the contract, the demo source, R7); 2.8; 2.7's Now and no-rhythm block; rule 7; `CheckIn.reading` (migration B) and the Check-ins sheet's columns; `checkin.number`; `get_reading`; Help `metric-source`; U107 | M | MT2 (the slice a source reads); the core's check-in flow (touches `CheckInFlow.tsx`: one build at a time in that area); FT1 (the rhythm setting) for the no-rhythm states, which wait for it; IM's Check for a number ten times the last (referred to, not restated) |
| MT5 | **The comparison** | 2.5; rule 6; `get_metric`'s rows; Help `metric-compare`; the first half of U108; N22's ranking check | S–M | ML1 (rule 2's rows and the table); MT2 (parts, and the demo's metrics with several goals); the goal page's summary rows per week |
| MT6 | **The Metrics sheet in and out** | 3.1, 3.2, 3.4; 2.9; the `sheets` point and the module's `columns.ts`; the import's undo over module records; the template; Help `metric-sheet`; the second half of U108 | M | IM1 (the field table), the import items that build the levels, the preview and the large-file path (`IMPORT-LEVELS`, `IMPORT-PREVIEW`, `IMPORT-UNDO`, `IMPORT-LARGE`); AS part 2 (records in the change engine); MT1 (rule 1), MT2 (part), MT3 (Action: Retire) |
| MT7 | **Metrics behind its switch, honestly** | 2.10; rule 8; "Metrics" as the module's name; the not-found line; `set_feature`'s preview; the CI job "Core journeys without metrics" asserting no Metrics sheet and no "Measured by" anywhere | S | FT2 (the read-back for a module that owns records, and the "switched off" line); MT6 for the sheet's absence (until then the read-back's Spreadsheets row is left out and M2-8 stays open); AR2 (done) |

**Order.** MT1, MT2, MT3, MT5 in that order (each is useful alone); MT4 when the check-in flow is free; MT6 after the import items; MT7 with or after FT2. If only one is built, build MT3: it is the one that stops a metric changing under people silently.

**For the rebuild kit.** The module's stage (`spec/rebuild/stage-4-module-metrics.md`) gains entry and exit criteria from U105 to U108 and the rules' worked examples as conformance rows where the demo has a case (rule 1's line for all the demo's metrics; rule 6's rows for the two metrics with several goals; rule 7's states for the demo source's seeded weeks). Its `gaps` say that real connectors are R7's, and that named dimensions stay on the growth list. `growth` in `module.json` loses "Loading the Metrics sheet back, and numbers from the source" and "Versions, with a reason" shrinks to "full versions a reader can compare" (marks are the thin form of it).
