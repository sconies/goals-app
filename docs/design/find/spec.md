# Find, sort, filter and pick: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings S1 to S9); the whole redesign is in `docs/design/README.md`. This spec assumes Lane takes the recommended answer to each decision there; "If Lane decides otherwise" says what changes.

**Standing rules** (from `CLAUDE.md`, not restated per item): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed` before it is pushed. Nothing here adds a table or a migration. These are core parts (`src/ui`, `src/domain`), not a module; modules use them.

**Words used throughout.** `{thing}` and `{things}` are a list's noun, singular and plural ("goal", "goals"; "person", "people"; "change", "changes"; "row", "rows"; "article", "articles"; "metric", "metrics"; "team", "teams"). `{ws}` is the workspace's name (the Workspace spec's rule 1). Wording in quotation marks is exact.

## 1. The parts and where they live

| Part | Code | Used by |
|---|---|---|
| The list bar | `src/ui/ListBar.tsx` (new): `<ListBar>` with slots for inline filters, sort and page extras; `<CountLine>`, `<FilterLine>`, `<NoneFound>`, `<Paging>` | Goals, Activity, Data, People, Teams, Metrics, Help, Feedback, Recently removed |
| The Filters sheet | `src/ui/FilterSheet.tsx` (new), built from a list of filter definitions | The same |
| Find-and-pick | `src/ui/Pick.tsx` (new): `<Pick kind="person|team|goal|metric|workspace" …>` | Every place in section 4 |
| Find from anywhere | `src/ui/Find.tsx` (new), opened by the shell | The sidebar, the phone's top bar, `Ctrl K` |
| The rules | `src/domain/find.ts` (new) | All of the above, and `find_goals` / `find_people` in MCP |
| A list's state in the address | `src/ui/useListQuery.ts` (new), generalising `useGoalQuery` (`GoalFilters.tsx`) | Every list bar |

No new routes. Find has no page of its own.

## 2. Screens

### 2.1 The list bar

Wireframes 1 and 6.

**Content, in order**

1. **Search field.** `type="search"`, label for screen readers "Find a {thing}", placeholder from the table below, at most 200 characters. On a computer it takes the focus when the page opens only on People, Teams, Metrics and Help (pages whose job is finding); elsewhere `/` moves to it.
2. **Inline filters** (a computer only): at most two, each a button that says its value: "Team: every team", "Status: any". Pressing one opens the Filters sheet scrolled to that filter.
3. **"Filters"**: a button; with filters on, "Filters · {n}" where n counts filters, not values.
4. **Sort**: a menu button "Sort: {value}" with the page's sort options; the current one is marked "Current". Omitted where a list has one order.
5. **Page extras** at the right (Goals: Group, Layout, Views; Data: the table picker).
6. **On a phone** items 2 to 4 are one button, "Filter and sort" ("Filter and sort · {n}" with filters on), opening the sheet with Sort as its first block. Page extras that are needed stay on a second row.
7. **The count line**, `role="status"`, under the bar (rule 2).
8. **The filter line**, only when a filter is on (rule 3).
9. The list.
10. **Paging** (flat lists only): "{a} to {b} of {n}" and the links "Previous 50" and "Next {k}" (`?page=`). Trees, groups and the Board don't page.

**Placeholders and what each search matches** (rule 1 decides how; this table says what text is the row's)

| List | Placeholder | The row's words |
|---|---|---|
| Goals | "Find by name, owner, team or key" | Title, key, owner, team, level, status word, this week's reason and path to green, definition, source (as today, plus the status word) |
| Activity | "Find by person, goal, key or what was said" | Who, the goal's title and key, the sentence shown, the numbers shown |
| Data | "Find in this table" | Every shown column's text, and the goal's key |
| People | "Find by name, job title or team" | As the Workspace spec, rule 4 |
| Teams | "Find a team or its lead" | As the Workspace spec |
| Metrics | "Find by name, unit, owner or meaning" | Name, unit, direction's words, owner, meaning, source |
| Help | "Find in Help" | Title and text |
| Feedback | "Find by what was said, who or which page" | The words, the sender's name, the page's name |

**Empty and error states** (`<NoneFound>`, where the list would be)

| When | Says | Links |
|---|---|---|
| A search finds nothing | "No {thing} matches “{q}”." | "Clear the search" |
| Filters find nothing | "No {things} match these filters." | "Clear filters" |
| Both | "No {thing} matches “{q}” with these filters." | "Clear the search" · "Clear filters" |
| A near miss (rule 5) | "No {thing} matches “{q}”. Showing {things} that match “{near}”." then the list | "Clear the search" |
| The list has nothing at all | The page's own empty state (each area's spec) | — |
| `?page=` past the end | The last page | — |
| A filter names something that no longer exists | The filter is dropped; one line, until the next change: "That {team\|person\|goal\|metric} isn't in {ws} any more, so that filter is off." (today's `useBadLinks`, `GoalsScreen.tsx:300`, made general) | — |

People keeps "No one matches “{q}”." (a person is "no one", not "no person"), as the Workspace spec has it.

### 2.2 The Filters sheet

Wireframe 2. A sheet at the right on a computer (420 px), full screen on a phone.

**Content, in order**

1. Title "Filter {things}".
2. On a phone only, first: "Sort", a list of the sort options, one chosen.
3. One block per filter, in the page's order. A block is a label and one control:
   - a fixed list of up to 8: tick boxes (several) or a list of choices (one);
   - a person, team, goal or metric: find-and-pick, several allowed, the chosen ones listed under it with "Remove";
   - a number or a week: the page's existing short select.
4. Data only, last: "Another column", today's three steps (property, condition, value) and "Add this filter".
5. A fixed foot: **"Show {n} {things}"** (primary; closes the sheet) and "Clear filters" (shown when any is on).

Each choice applies at once to the list behind and to n in the button. Closing by Escape, the backdrop or the button is the same: nothing is thrown away. Focus opens on the first block (not on Sort).

**The filters each page offers** are in the area specs; the common ones are spelt the same everywhere: "Status", "Team", "Owner", "Who", "When", "Kind".

### 2.3 Find-and-pick

Wireframes 3 and 4.

**Closed.** A labelled field showing the choice as plain words and, at its right, "Change". Nothing chosen: the placeholder "Choose a {thing}". Several: a list of rows under the field, each with "Remove", and the field reads "Add another {thing}".

**Open.** On a computer a panel under the field, as wide as the field and at least 360 px; on a phone a full sheet titled by the field's label.

1. A search field, focused, placeholder by kind: "Find by name, job title or team" (person), "Find a team or its lead" (team), "Find by name, key, owner or team" (goal), "Find by name, unit or owner" (metric), "Find a workspace" (workspace).
2. Where "none" is allowed, a first row with the caller's words: "Nothing: top of its own tree" (feeds into), "No metric" (measured by), "No lead" (a team's lead), "Every team" (a filter).
3. Before typing: the label "Suggested", then up to 6 rows (rule 6).
4. While typing: the count, `role="status"`: "{n} match" / "1 matches" / "None match"; then up to 50 rows, 8 visible before it scrolls; past 50, a last line "Keep typing to narrow the other {k}."
5. Where the caller allows it, a last row: "Add “{q}” as a new {thing}" (metric in a goal form; team in set-up). It shows once q has 3 characters and no row's name equals q, ignoring case.
6. Several: a ticked row is chosen; a fixed foot has **"Done"**.

**A row** (the same component in Find)

| Kind | Line 1 | Line 2 |
|---|---|---|
| Person | Avatar, name; "(you)" after your own | "{job title} · {team}"; someone marked as left is never listed |
| Team | Name | "Led by {name} · {n} people" / "No lead · {n} people" |
| Goal | Status as shape and word, then the title | "{key} · {owner} · {team}"; a stopped goal is listed only where the caller asks, with "Stopped" |
| Metric | Name | "{unit} · {lower\|higher} is better · owned by {name} · {n} goals" / "… · no goals yet" |
| Workspace | Name | As the Workspace spec's switcher rows |

**Keys.** Down and Up move through rows (wrapping), Enter chooses, Escape closes and returns focus to the field, typing always goes to the search field. It is an ARIA combobox with a listbox (`aria-activedescendant`), as the Map's finder is today.

**Empty and error states**

- None match: "None match “{q}”." and, where allowed, the "Add … as a new" row.
- A choice the caller refuses (a goal can't feed itself or something under it; a metric in another unit): the row is shown, not selectable, with the rule's own words on line 2 ("Feeds this goal already", "In hours; this goal is in min").
- The search function fails (the internal app's server): "Couldn't search just now." and "Try again"; what was chosen is kept.

### 2.4 Find from anywhere

Wireframe 5. A sheet in the middle on a computer (640 px), full screen on a phone. Opened by the sidebar's "Find" row, the phone top bar's "Find" button, or `Ctrl K` / `Cmd K`.

**Content, in order**

1. A search field, focused: "Find a goal, person, team or metric".
2. Before typing: "Opened lately", up to 8 rows of any kind (rule 6's recents, across kinds). None yet: the line "Type a name, a key like G-48, or a few words."
3. While typing: four headed groups in a fixed order, each only when it has a match: "Goals · {n}", "People · {n}", "Teams · {n}", "Metrics · {n}" (the last only while the metric library is on). Three rows each; a group with more ends in "See all {n} {things}", which opens that list with the search filled in (`/goals?scope=all&q=`, `/people?q=`, `/teams?q=`, `/metrics?q=`).
4. If q is a goal's key and nothing else ("G-48", "g48", "48"; `searchKey`, `query.ts:117`), that goal is the first row and Enter opens it.
5. Nothing: "Nothing matches “{q}”." A near miss is tried per kind (rule 5).

**Primary action:** Enter opens the first row. Rows are links (a middle click opens a new tab). Escape closes.

**Empty and error states:** as find-and-pick.

## 3. Who sees what

Consistent with R1, rule 3: reading is open inside a workspace, so every member searches and picks from everything in it. This adds no right and removes none.

| Thing | Anyone in the workspace | R1 |
|---|---|---|
| Search any list; filter; sort | Yes | Rule 3 |
| Find from anywhere: goals, people, teams, metrics | Yes; never another workspace's | Rule 3 |
| Pick a person, team, goal or metric in a form | Whoever may use the form (the form's own action decides: `planChanges`, `saveTeam`, `addAction`, `linkGoalMetric`…) | The access table |
| "Add … as a new metric" | Anyone (`saveMetric`: anyone adds) | — |
| "Add … as a new team" | Only in set-up, by the person setting up | `saveTeam` (admins) |
| People marked as left | Never listed in a picker; still found by Find as "(left)", opening their page | Rule 2 |
| MCP tokens, feedback from other workspaces | Never found by Find | Rule 3's exceptions; rule 6 |

Someone who isn't a member finds nothing of a workspace, not even that it exists.

## 4. Where each goes (the moves)

One row per place; each is covered by U63 or U64. "0a" marks a place the backlog already lists.

| # | Place | Today (`file`) | Becomes |
|---|---|---|---|
| 1 | Goals search | `GoalFilters.tsx:166` | The list bar's search |
| 2 | Goals sort (twice) | `GoalFilters.tsx:92`, `:248` | The bar's Sort; in the sheet on a phone only |
| 3 | Goals filters | `GoalFilters.tsx` (dialog) | The Filters sheet: Status, Level, Kind, Team (pick), Owner (pick), Needs attention because, Due, No update for, Last quarter, Result, In the tree of (pick a goal), Also helps |
| 4 | "In the tree of" (0a) | `GoalFilters.tsx:296` (select) | Pick a goal, inside Filters |
| 5 | The Map's finder and "Needs attention" box | `GoalMap.tsx` | The bar's search, which on the Map finds and pans; see the Goals spec |
| 6 | Activity search, "Any time", person, goal, kinds | `Activity.tsx` | The list bar: inline "When: any time" and "Kind: every kind"; in Filters: Who (pick a person, several; "Only my changes" is the suggestion "You"), Goal (pick a goal). Address: `?q=`, `?when=`, `?kind=`, `?who=`, `?goal=` (a goal's key, not its id) |
| 7 | Data search, Filter, column sort | `DataTables.tsx`, `tableFilter.ts` | The list bar; "Another column" in the sheet; the address's `?s=Team~asc` becomes `?sort=team` (`.desc`), the old form read and rewritten |
| 8 | Data's Owner cell (0a) | `DataTables.tsx` (select of 98) | Pick a person, opened from the cell |
| 9 | Review set-up: goals, people (0a) | `Review.tsx` (ReviewEdit) | Pick a goal (several); pick a person (several); each with the count and "None match" |
| 10 | New goal and goal edit: owner, team, feeds into, also helps (0a) | `GoalWizard.tsx`, `GoalEdit.tsx`, `GoalFields.tsx` | Pick a person; pick a team; pick a goal with "Nothing: top of its own tree"; pick a goal (several) |
| 11 | Add a next step: who | `GoalScreen.tsx` (the sheet) | Pick a person |
| 12 | Bulk owner change; assign in Inspect; ask someone in a check-in (0a) | `BulkEdit.tsx`, `Inspect.tsx`, `CheckInFlow.tsx` | Pick a person |
| 13 | Workspace and People: team filter, a person's team, lead, admin, "acts as", hand over (0a) | `Workspace.tsx`, `RemoveSheets.tsx`, `AiAssistants.tsx` | Pick a team; pick a person (the Workspace spec says "find-and-pick once 0a lands") |
| 14 | Switch person (demo) and "Who are you?" (0a) | `Demo.tsx`, `Start.tsx` | Pick a person, whose suggestions are the demo's seven role cards |
| 15 | The workspace switcher | `WorkspaceSwitch.tsx` | Pick a workspace from six up (Workspace spec 2.12) |
| 16 | Help | `Help.tsx` | The bar's search, count line and none-found words |
| 17 | Feedback | `Feedback.tsx` | The list bar: inline "Kind"; in Filters: Page (pick from the pages' names, not routes: "A goal's page", not `/goals/:goalId`), Person (pick). Address: `?q=`, `?kind=`, `?page=`, `?who=`, with the status tab as today |
| 18 | People, Teams | The Workspace spec 2.1, 2.3 | The list bar, as that spec describes; the search joins the address (`?q=`) |
| 19 | Metrics list, "Measured by" | The metric library spec | The list bar; pick a metric with "Add … as a new metric" |

Fixed short lists stay plain: weekdays, weeks ("By", 8 weeks), months, levels, sort orders, "How progress comes", "When".

## 5. Rules for `src/domain`

All in `src/domain/find.ts`, pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. They restate nothing: goals still pass through `applyQuery` (`query.ts`), people through `findPeople` (the Workspace spec's rule 4), which both call rule 1 for their text.

### Rule 1. Does text match: `textMatches(words, q)`

`words` is the row's words as one string; `q` is what was typed. True when every word of `q` starts a word of `words`, ignoring case and accents; words break at spaces and at `/ - , . : ( )`. A goal's key matches as `searchKey` already says: a whole search that is one key finds only that goal.

| Row's words | q | Matches |
|---|---|---|
| "Rollback in under five minutes G-48 Tunde Bakare Build & Release Team Off track" | "rollback" | Yes |
| The same | "roll min" | Yes (each starts a word) |
| The same | "back" | No ("back" starts no word) |
| The same | "off track" | Yes |
| The same | "g-48", "G48", "48" | Yes (its key) |
| "Canary halt G-4 …" | "G-48" | No (a key finds only its own goal) |
| "Lucía Romero Staff Engineer CI/CD" | "lucia ci" | Yes (accents ignored; "CI/CD" breaks at "/") |
| Anything | "" or spaces | Yes |

This changes Goals in one way: today a word matches anywhere inside a word (`hay.includes`, `query.ts:128`), so "back" finds "Rollback". Starting a word is the People rule and what a server's search does; `matches` in `query.ts` calls `textMatches` and its test for "includes" is rewritten.

### Rule 2. The count line: `countLine(thing, things, n, total, narrowed, order, page?)`

| Given | Says |
|---|---|
| Not narrowed, 126 goals, sorted worst first | "126 goals, worst first." |
| Not narrowed, 97 people, page 1 of 50 | "97 people, A to Z. Showing 1 to 50." |
| Not narrowed, one | "1 goal." |
| Narrowed to 17 | "17 goals match." |
| Narrowed to 1 | "1 goal matches." |
| Narrowed to 0 | "" (the none-found block says it) |
| People, narrowed to 1 | "1 person matches." |
| Nothing at all | "" (the page's empty state says it) |

`order` is the sort's words in lower case ("worst first", "A to Z", "newest first", "as trees"). Goals adds its status counts after this line (the Goals spec); nothing else is appended anywhere.

### Rule 3. The filter line: `filterLine(parts)`

`parts` are the active filters in the page's order, each `{ label, values }`. Says "Filtered by: " then each part as "{label} {values joined with ' or '}" followed by a "Remove" button named for screen readers "Remove the filter {label} {values}", parts joined with " · ", ending " · Clear filters" when there are two or more.

| Given | Says |
|---|---|
| Team: CI/CD | "Filtered by: Team CI/CD (Remove)" |
| Team: CI/CD; Status: Off track, At risk | "Filtered by: Team CI/CD (Remove) · Status Off track or At risk (Remove) · Clear filters" |
| None | Nothing; the line is left out |

It replaces `describeQuery`'s chips (`query.ts:187`); its texts come from the same function. A search is not a filter and is never in this line: it is in the field.

### Rule 4. What a change does to history: `historyStep(change)`

| Change | History |
|---|---|
| Choosing a filter, a sort, a tab, a scope, a group, a layout, a page, a saved view | Adds one entry |
| Typing in a search field | Replaces, until Enter, leaving the field, or 800 ms without a key; then that state counts as one added entry |
| Clearing the search; "Clear filters"; "Remove" | Adds one entry |
| A choice read from the browser's memory when the address has none (a layout, a scope) | Written into the address at once, replacing: the address always says what is drawn |
| A dropped filter (it names something gone) | Replaces |

| Given | Then |
|---|---|
| Goals → type "kafka" → Filters: Status Off track → Sort: Owner → Back | Sorted as before with the filter and "kafka" |
| → Back | "kafka" with no filter |
| → Back | Goals as first opened |
| Layout remembered as Table; open `/goals` | The address becomes `/goals?view=table` (replaced); Back leaves Goals |

### Rule 5. A near miss: `nearMiss(q, vocabulary)`

Only when rule 1 finds nothing. For each word of q of 5 letters or more, find the list's words at edit distance 1 (one letter added, dropped, changed, or two swapped); if every word of q then has a match, return the corrected q, choosing for each word the commonest candidate. Otherwise nothing. Never applied to a key.

| q | The list's words include | Returns |
|---|---|---|
| "rolback" | "rollback" | "rollback" |
| "kafak" | "kafka" | "kafka" |
| "piplin" | "pipeline" | Nothing (two letters away) |
| "rolbak" | "rollback" | Nothing (two away) |
| "qeue wait" | "queue", "wait" | "queue wait" |
| "cost" (4 letters) with no match | "costs" | Nothing (too short to guess) |
| "G-480" | — | Nothing (a key) |

### Rule 6. Suggestions before typing: `suggest(kind, viewer, snapshot, recents, context)`

Up to 6 rows, no repeats, in this order.

| Kind | Order |
|---|---|
| Person | You; the people of your team, its lead first, then A to Z; then people you chose lately in any picker |
| Team | Your team; teams you lead; teams chosen lately |
| Goal | Your goals, worst first; the goals they feed; goals opened lately. In "Feeds into": the goals one level up from the form's level in your team first |
| Metric | Metrics in the form's unit (when it has one); metrics your team's goals use; chosen lately |
| Workspace | As the switcher lists them |

`recents` is a per-person, per-workspace list of the last 12 things opened or chosen, newest first, kept in the browser (`goals-app-recents:<ws>:<person>`), behind a small port so the internal app can keep it on the server.

| Given | Then |
|---|---|
| Rhea, person, nothing recent | Rhea Kapoor (you), then five of CI/CD A to Z |
| Rhea, person, after choosing Daniel Okafor | Rhea, CI/CD's first four, Daniel Okafor |
| Oskar (owns no goals), goal | Goals he opened lately; with none yet, there is no "Suggested" block and the hint under the field says what to type |
| Tunde, goal, in "Feeds into" for a Team-level goal | The SVP-level goals of Build & Release, then his own |
| Anyone, metric, the form's unit is "min" | The metrics in min, A to Z |

### Rule 7. One search function per kind: `search(kind, ask, snapshot)`

`ask` is `{ q, filters?, sort?, page = 1, size = 50 }`; returns `{ total, from, to, rows, near? }`. It is the one function a list bar, a picker and Find call for a kind, and the seam for the internal app's server (R4): the app reaches it through a `Search` port (`src/ports/search.ts`) whose browser adapter calls this rule and whose contract test is this rule's worked examples.

- `goal`: `applyQuery` over the summaries, with rule 1 for text; order worst first unless `sort`.
- `person`, `team`: `findPeople`, `findTeams` (the Workspace spec).
- `metric`: `liveMetrics` filtered by rule 1 over name, unit, direction, owner, meaning and source; A to Z.
- `near` is rule 5's corrected q when `total` would be 0.

| Given (the example) | Then |
|---|---|
| goal, q "G-48" | total 1 |
| goal, q "off track" | total 11 |
| goal, q "tunde" | his 2 goals |
| person, q "tunde" | Tunde Bakare |
| metric, q "min lower" | The metrics in min where lower is better |
| goal, q "rolback" | total 1 or more, `near: "rollback"` |
| goal, q "zzzz" | total 0, no `near` |

### Rule 8. Find across kinds: `findAll(q, viewer, snapshot)`

Calls rule 7 for goal, person, team and metric with `size: 3` and returns the groups that have rows, in that order, each with its total. A whole-key q puts that goal first and alone in Goals.

## 6. Extension points

- `PLACES` gains nothing. Modules use the parts directly (`src/ui` is core; a module may import it).
- A module adds a kind to find-and-pick and to Find by registering a **finder** in its `app.tsx`: `finders: [{ kind, things, row(thing), search(ask, snapshot), open(thing) }]`. The metric library registers `metric`; with the module off, the kind is gone from Find and from every picker. `docs/architecture.md`'s extension-point table gains this row; the manifest test checks a module that lists `finders` in `module.json`.
- A module adds a filter to a core list by the new list `filters` in `app.tsx`, declared as data so a server can apply it (`docs/design/architecture.md`, 4.2): `{ list: 'goals', id, label, param, column, pick }`, where `column` is a column the module adds to the goal's summary and says how to fill. The metric library adds "Measured by" to Goals: `?metric=`, column `metricId`, picked with the metric picker.
- The search function of rule 7 sits behind the `Search` port, and recents behind the `Prefs` port (`docs/design/architecture.md`, 1.1: item AR1, built just before FS1).

## 7. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U63 | FIND-AND-PICK | One way to pick: as Rhea, open New goal's owner, a goal's "feeds into", Add a next step's "who", a review's people, the Goals filter's owner and Activity's "who". In each: suggestions show before typing with "Rhea Kapoor (you)" first; typing "dan" shows "1 matches"; Down then Enter chooses Daniel Okafor; the field shows his name and team as plain words with "Change"; Escape closes without choosing. No `select` on these screens has more than 25 options |
| U64 | LIST-BAR | One bar: on Goals, Activity, Data, People, Help and Feedback in turn: search a word that matches and read "{n} {things} match."; search "zzzz" and read "No {thing} matches “zzzz”." with "Clear the search"; add a filter and read the filter line; "Remove" takes it off; the address holds the search and the filter after each step; a reload shows the same list; Back steps through them in order (rule 4) |
| U65 | FIND-ANYWHERE | Find from anywhere: as Oskar on Home press Ctrl K; "Opened lately" or the hint shows; type "G-48" and Enter opens that goal; open Find again from the goal, type "rhea": People shows Rhea Kapoor, Goals her goals with "See all 8 goals"; Enter on "CI/CD" under Teams opens the team. On a phone the top bar's Find does the same. With the metric library off there is no Metrics group |
| U66 | LIST-BAR | A near miss: on Goals search "rolback"; the line says no goal matches and that goals matching "rollback" are shown; the field still says "rolback"; "Clear the search" returns every goal |

**Changed:** every journey that picks a person, team or goal from a select (U2, U3, U14, U22, U43 and the review set-up journeys) picks through find-and-pick; N6 and F5 read the new bar on Goals.

### F, N and P checks

| # | Check |
|---|---|
| N12 | **Replaces the Workspace spec's N11 and is 0a (4).** In a generated workspace of 15,000 people, 1,500 teams and 30,000 goals: no `select` or list anywhere in the app has more than 25 options; every picker shows its first results within 200 ms of a key and draws at most 50 rows; every list bar answers a search within 300 ms; Find within 300 ms. A lint (`scripts/check-pickers.mjs`, in `npm test`) fails a `<select>` whose options are mapped from people, teams, goals, metrics or workspaces |
| N13 | One wording: on every list in section 2.1's table, the count line, the none-found line and the links are exactly rule 2's and 2.1's, read from the page at 1440 and 390 |
| F11 | Phone, 390 px: an open picker's first result is within 200 px of the top; its rows are at least 44 px high; the Filters sheet's "Show {n}" button is visible without scrolling; nothing scrolls sideways |
| P17 | Design: a chosen person, team, goal or metric, and an active filter, is plain text with a button, never a capsule (no element with a border radius over 8 px and a background behind a filter or a chosen value); pickers' rows are hairline rows |
| P3, P4 | Extended: a goal row in a picker and in Find has its status shape with its word |

### Unit tests

One per rule with every worked example as a case; the `Search` port's contract; `query.test.ts`'s text cases moved to rule 1.

### Requirements (`evals/requirements.json`)

New: `LIST-BAR` ("Every list is searched, filtered, sorted and counted the same way, and its address says what is shown"), `FIND-AND-PICK` ("A person, team, goal or metric is always chosen by typing to find it, never from a list of everything"), `FIND-ANYWHERE` ("Anything can be found from any page by name or key").

## 8. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `finding` (new; no route of its own, listed under "Getting around") | "Finding things": Find and its key; what a search matches (the words on the row; a key); filters and the filter line; sorting; clearing; near misses; that the address can be shared |
| `goals`, `activity`, `data`, `people`, `teams`, `feedback` | Each one's search and filter paragraph replaced by two lines and a link to `finding` |
| `goals-new`, `goal-edit`, `reviews-new` | "Choose the owner from the list" becomes "type a name to find the owner" (and so on) |
| `shortcuts` (new section in `finding`) | `Ctrl K` / `Cmd K`, `/`, Escape, the markup key |

### What's new (`src/help/whatsNew.ts`), one entry per item, newest first

| Item | id | Title | Lines |
|---|---|---|---|
| FS1 | `find-and-pick` | "Type to find a person, a team or a goal" | "Choosing an owner, a team or the goal something feeds is now a search, with you and your team suggested first." "The long lists have gone." |
| FS2 | `one-list-bar` | "Search, filter and sort work the same everywhere" | "Goals, Activity, Data, People, Help and Feedback share one bar." "A search finds the words you can see on a row, a goal's key included." "The address keeps what you searched and filtered, so Back and a shared link show the same list." |
| FS3 | `find-anywhere` | "Find, from anywhere" | "Press Ctrl K (Cmd K on a Mac), or Find in the sidebar, and type a name or a key like G-48." |
| FS4 | — | `[no news]` (the 15,000-person check) | — |

## 9. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Find stays spec only | 2.4, rule 8, U65, FS3 and the sidebar's Find row are left out; rule 8 is written into R5 as the requirement. Rules 1 to 7 stand |
| 2 | Names and keys only | Rule 1 is unchanged; 2.1's table loses "status word" and the reasons from the row's words; U64's "off track" case goes |
| 3 | No near misses | Rule 5, `near`, the fourth none-found row and U66 are left out; U29 stays with R4 |

## 10. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| FS1 | **Find-and-pick, and every place it goes** | 2.3; rules 1, 6, 7 for people, teams and goals; the `Search` port; the moves 4 and 8 to 15 in section 4; the lint; U63, F11, P17 | M | Nothing. People's pages (WR1) use it when they land |
| FS2 | **The list bar, on Goals, Activity, Data, Help and Feedback** | 2.1, 2.2; rules 2 to 5; `useListQuery`; the moves 1 to 3, 5 to 7, 16, 17; U64, U66, N13 | M | FS1 (filters use the picker). Goals' own new frame is the Goals spec's GL1, built on this |
| FS3 | **Find from anywhere** | 2.4; rule 8; the sidebar row and the phone button (with NV1); U65 | S | FS1; NV1 for its door |
| FS4 | **Held at company size** | N12 with its fixture. `[no news]` | S | FS1, FS2 |

**This replaces backlog 0a** (parts 1, 2 and 4; part 3 is the Workspace redesign; part 5 was built in WS). The whole order across areas is in `docs/design/README.md`.

**For the rebuild kit:** FS1's stage notes say the `Search` port is where the server's search plugs in and that rule 5 is a stand-in; FS2's say the address is the list's state and the server pages it (R4).
