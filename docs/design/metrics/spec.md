# The metric library: the build spec

10 November 2026. For a build session to follow without asking, **after** Wednesday's live build has merged (or its fallback has). The reasons are in `README.md` beside this file (findings M1 to M10); the whole redesign is in `docs/design/README.md`. It assumes Lane takes the recommended answer to each decision; "If Lane decides otherwise" says what changes. It does not change `docs/live-build/metrics.md`.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/modules/metrics/` and conformance rows, updates the module's `module.json` (routes, redirects, navigation, places, help, requirements, journeys, `rebuild`), runs `npm run spec`, adds a What's new entry and its Help article (`src/modules/metrics/help.ts`), comes with its evals, and passes `npm run typecheck`, `npm test`, `npm run lint:layers` and `npm run evals:changed`; after touching `tools.ts` or anything the server imports, `npm run build:mcp`. **Everything here is in the `metrics` module** (`src/modules/metrics/`) and registers through extension points; where one doesn't exist yet, section 5 names it and the item that adds it.

**No table and no migration.** Every record and field exists (`okr_metrics`, `okr_goal_metrics`, migration 0033).

**Words used throughout.** `{metric}` is a metric's name; `{ws}` the workspace's name. "Slice" is the code's word for whose number a goal's link is (a team's, or the whole company's); screens say "For". Wording in quotation marks is exact.

## 1. Routes

| Address | Screen | Title (navigation spec, rule 2) |
|---|---|---|
| `/metrics` | The library | "Metrics" |
| `/metrics/<id>` | A metric | "{metric} (metric)" |
| `/metrics/new` | Add a metric (focus mode) | "Add a metric" |
| `/metrics/<id>/edit` | Change a metric (focus mode) | "Change {metric}" |

A metric's id in the address is its `slug` where it has one (the demo's do), else its id.

The library's query: `?q=`, `?unit=<unit>`, `?team=<id>` (used by that team's goals) or `?team=company`, `?owner=<personId>`, `?dir=lower|higher`, `?unused=1`, `?sortout=1`, `?sort=name|goals|changed`, `?page=`.

Goals gains `?metric=<id>` (the find spec's `filters` extension): "Measured by {metric}" in its filter line.

### Redirects

In `module.json` `redirects` and one function `movedMetrics(path, search)`; each a replace, keeping `?today=` and the demo prefix; covered by U81.

| Old (Wednesday's) | New |
|---|---|
| `/data/metrics` | `/metrics` |
| `/data/metrics?m=<id>` | `/metrics/<id>` |
| `/data/metrics?m=<id>&edit` | `/metrics/<id>/edit` |
| `/data/metrics?new` | `/metrics/new` |

## 2. Screens

### 2.1 The library (`/metrics`)

Wireframes 1 and 5. Reading width 880 px.

**Content, in order**

1. Title "Metrics". Under it: "Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing."
2. Primary action: **"Add a metric"** → `/metrics/new`.
3. The list bar (find spec, 2.1): search "Find by name, unit, owner or meaning", focused on a computer when the page opens; inline "Unit: any" (the units in use, a short list) and "Used by: any team" (find-and-pick for a team, with the first row "The whole company"); "Filters" holding Owner (find-and-pick), "Which way is better" (Lower / Higher), the tick boxes "No goals use it" and "Something to sort out"; "Sort: A to Z" (also "Most goals first", "Changed lately").
4. The count line: "13 metrics, A to Z." / "3 metrics match."
5. The filter line when filters are on.
6. The list, 50 a page. A row is a link to the metric:
   - line 1: the name;
   - line 2: "{unit} · {lower|higher} is better · owned by {name}" ("no owner" when the owner has left or none is set);
   - at the right (a third line on a phone): its goals by status as shape and word, only the statuses it has, worst first ("1 off track · 2 on track"); none: "No goals yet";
   - for the metric's owner and admins only, after that: the warning mark and the first thing to sort out in rule 3's words ("No meaning yet"; with more, "and 1 more").
7. Paging.

**Empty and error states**

| When | Says | Offers |
|---|---|---|
| No metrics at all | "No metrics yet. A metric says exactly what a number means, so every goal that uses it means the same thing." | The primary button |
| A search finds none | "No metric matches “{q}”." | "Clear the search"; and "Add “{q}” as a new metric" → `/metrics/new?name={q}` |
| Filters find none | "No metrics match these filters." | "Clear filters" |
| "Something to sort out" finds none | "Nothing to sort out. Every metric has a meaning, a source and an owner, and a goal that uses it." | "Clear filters" |
| The module is switched off | The route doesn't exist: the app's page not found, as for any module | — |

### 2.2 A metric (`/metrics/<id>`)

Wireframe 2. One column, 880 px; the goals table may use the wide frame.

**Content, in order**

1. Back link (navigation spec, rule 4): "‹ Metrics".
2. The name as the title. Under it: "{unit}, {decimals in words} · {lower|higher} is better · owned by {owner as a link}". Decimals in words: "whole numbers", "to 1 decimal place", "to {n} decimal places". No owner: "no owner".
3. Primary action: **"See its {n} goals"** → `/goals?scope=all&metric=<id>`. One: "See its goal". None: no button.
4. **"What it means and how it’s calculated"**: the meaning, as written. Empty: "Not said yet." and, for those who may change it, the link "Say what it means" → edit, that field focused.
5. **"Goals measured by it · {n}"** (rule 2): a table, worst first.

   | Column | Shows |
   |---|---|
   | Status | Shape and word |
   | Goal | The title, a link; under it the key |
   | For | The team's name, or "The whole company" |
   | Now | The latest value in the goal's format; "No value yet" |
   | Target | The target, with its week |
   | Against plan | The scorecard's "vs plan" words ("3 min behind plan"); for a keep-in-range goal its "room to the limit" words |
   | Owner | The owner's name |

   Under it, when two or more rows share a unit and direction: one line, "Lowest now: Build & Release, 4 min. Highest: CI/CD, 7 min." (lower is better: "Best now … Furthest …" is not used; the plain words are). None: "No goal uses this metric yet." and "A goal’s owner links it under “Measured by” when they make or change the goal."
6. **Facts**, label then value: "Where the number comes from" (source; empty "Not said"); "Who owns that source" (empty "Not said"); "How often it refreshes" (the stored choice; "Not said"); "Caveats" (empty: the row is left out); "Added" ("by {name} on {date}"); "Last changed" ("by {name} on {date}").
7. The `metrics.metric` place is not needed (this is the module's own page).
8. **"To sort out"** (rule 3), for the metric's owner and admins only, when it has anything: rows of a sentence and one plain button each.
9. For the owner and admins, under the label "For {owner’s first name} and admins" ("For admins" when there is no owner): **"Change this metric"** → `/metrics/<id>/edit`; apart and quieter, "Remove this metric…" (2.5). For everyone else, one line: "{Owner} or an admin can change this." / "An admin can change this."

**Empty and error states**

- No such metric: title "Metric not found". "There’s no metric at this address in {ws}." Primary **"See all metrics"**; the Find field (navigation spec, 2.6).
- A removed metric: "“{metric}” was removed on {date} by {name}." and, for those who may (`canRestore`), "Put it back" (restores the metric and the links it had, as `restore_removed` does); for others "Its owner or an admin can put it back from Recently removed."
- A refusal on any action: the rule's own words as a toast.

### 2.3 Add or change a metric (`/metrics/new`, `/metrics/<id>/edit`)

Wireframe 4. Focus mode, narrow (620 px). One exit: "Close and keep the draft" (navigation spec, 2.5); the draft is kept as other drafts are (`src/app/drafts.ts`).

**Content, in order.** Each error shows under its own field, after the field loses focus or on the first try to save; the first field in error takes the focus.

| # | Field | Control | Required | Errors (from `metricProblems`; exact) |
|---|---|---|---|---|
| 1 | "Name" | Text, 120 at most. `?name=` fills it | Yes | "Give the metric a name of at least 3 characters." · "Another metric is already called “{name}”. Open it, or choose a different name." (with "Open it" a link) |
| 2 | "What it means and how it’s calculated" · "optional" | Textarea, 2,000 at most; hint "What is counted, from when to when, and what is left out." | No | — |
| 3 | "Unit" | Text, 20 at most; hint "As it follows a number: hours, %, USD, deploys" | Yes | "Give the unit." |
| 4 | "Decimal places" | A select 0 to 4, default 0 | No | "Between 0 and 4." |
| 5 | "Which way is better" | Two choices: "Lower is better" / "Higher is better"; none chosen at first | Yes | "Choose which way is better." |
| 6 | "Where the number comes from" · "optional" | Text; hint "A dashboard, a query, a report" | No | — |
| 7 | "Who owns that source" · "optional" | Text (a team or a person outside Faro may own it) | No | — |
| 8 | "How often it refreshes" | A select: "Not said", then the stored choices, as Wednesday's form | No | — |
| 9 | "Owner" | Find-and-pick for a person; starts as the viewer on add | Yes on add | "Choose an owner." · "{name} isn’t in {ws}." |
| 10 | "Caveats" · "optional" | Textarea | No | — |

Then **"Add the metric"** / **"Save changes"** (primary; sticks to the foot, never over a field).

**The close-name question** (rule 4), under Name, while adding, once the name has 4 characters: "This looks like “{other}” ({unit}, {direction}, owned by {name}). Use that one, or carry on if yours is different." with "Use that one" opening the other metric (the draft is kept). Up to two are named. It is `role="status"`, never an error, and never stops the save.

**On change**, when goals use the metric and the unit or direction is changed: before saving, a confirm: "{n} goals are measured by this metric. Changing its {unit | direction} doesn’t change their numbers or plans; {k} of them will show a warning that they differ. Change it?" with "Change it" and "Keep it as it was". (The rule today allows the change; `linkProblems` then warns on those goals.)

**After saving:** the toast "Added {metric}" / "Saved {metric}", and the metric's page opens. Arriving from a goal form's "Add as a new metric" (2.4) never comes here.

**Empty and error states:** a save refused by the rule (`saveMetric`: not the owner or an admin) shows its words at the top of the form: "Only {owner} or an admin can change this metric."

### 2.4 "Measured by" in the goal forms

Wireframe 3. The module's component in the `goal.measure` place, on New goal's measure step (onboarding spec, 2.3) and on Change a goal's "What it is" (goal spec, 2.7). Not rendered for a dated-stages goal, or (on change) for someone who may not link (`canLinkGoal`).

**Content, in order**

1. The label "Measured by". Under it, when nothing is chosen: "A metric says exactly what the number means. Choose one, add one, or say there isn’t one."
2. **Find-and-pick for a metric** (find spec, 2.3): placeholder "Find by name, unit or owner"; first row "No metric"; suggestions by the find spec's rule 6 (metrics in the form's unit when one is typed; metrics the goal's team's goals use; chosen lately); a last row "Add “{q}” as a new metric".
3. **Chosen**, under the field:
   - the metric's meaning, two lines at most, then "Read more" → the metric's page in a new tab; with no meaning: "Its meaning hasn’t been written yet.";
   - the line "{unit}, {decimals in words}, {lower|higher} is better: from the metric." and the link "Use different ones";
   - **"For"**: two choices, "{the goal’s team}" (chosen at first) and "The whole company"; with no team chosen on the form yet, only "The whole company" and the hint "Choose the goal’s team to measure it for that team.";
   - any warning or error from `linkProblems`, in its words, under the field it is about.
4. **What choosing does to the form** (rule 5): on a new goal whose unit, decimals and direction the person hasn't typed, they are set from the metric and shown as that one line instead of three fields. "Use different ones" brings the three fields back, filled from the metric, and the rules then judge the difference.
5. **"No metric"** chosen: the form's own "How it’s measured · optional" textarea shows under it (it is hidden while a metric is chosen: the metric's meaning is how it's measured).
6. **Adding in place** (after "Add “{q}” as a new metric"): a bordered block under the field, "A new metric": "Name" (filled with q), "Unit" (filled from the form's, if typed), "Which way is better" (filled from the form's goal: a number to bring down is lower), "What it means · optional" (one line), **"Add this metric"** and "Cancel". The close-name question shows here too. Errors as 2.3's. After adding: it is chosen, the toast "Added {metric}. Say more about it on its page when you can.", and the form carries on. The metric's owner is the person adding it.

**Saved** with the goal, as today (`app.linkGoalMetric` after the goal, or `app.unlinkGoalMetric` for "No metric").

**New goal's Check step** gains the row (onboarding spec): "Measured by {metric}, for {team | the whole company}." / "No metric: measured as described."

### 2.5 Remove a metric (sheet)

1. Title "Remove “{metric}”?"
2. With goals: "{n} goals stop being measured by it: {the first three titles}{ and k more}. They keep their numbers and plans." None: "No goal uses it."
3. "You can put it back for 30 days from Recently removed."
4. **"Remove the metric"** (the danger style) and "Cancel".

After: the toast "Removed {metric}" with "Undo" (today's restore), and the library opens.

### 2.6 On a goal's page (the module's two places)

- `goal.facts` (goal spec, 2.1): "Measured by {metric} · {unit}, {lower|higher} is better", the name a link to the metric.
- `goal.sections`, inside About, right after "What it measures": when linked, the block "Measured by {metric}, for {team | the whole company}": the meaning; "Where the number comes from: {source}" when said; "Caveats: …" when any; and "See the {k} other goals measured by it" → the metric's page, `#goals` (k = 0: left out). When linked, the goal's own "What it measures" text is shown only if it differs from the metric's meaning, under the label "For this goal".
- Not linked, for those who may link, on a number goal: one quiet line in About, "No metric yet. Choose one" → Change a goal, `#definition`. For everyone else: nothing.

### 2.7 On a person's and a team's page (the Workspace design's places)

- `people.person`: "Metrics {first name} owns · {n}": up to five rows (name; "{unit} · {n} goals"), then "See all {n}" → `/metrics?owner=<id>`. None: the block is left out.
- `people.team`: "Metrics its goals use · {n}": the same, → `/metrics?team=<id>`.

### 2.8 On Workspace → About (the Workspace design's `needs`)

The module's section is not added (the library is not a setting). It raises needs through a module-level `needs` (section 5), admins only:

| id | When | Sentence · why | Button → where |
|---|---|---|---|
| `metric-no-owner` | Any live metric whose owner has left or is unset | "{n} metrics have no owner" · "An owner keeps a metric’s meaning true." | "See them" → `/metrics?sortout=1` |

## 3. Who sees what

Consistent with R1 (reading is open, rule 3) and with the module's rules as they stand on main. If Wednesday's room changes a rule (the brief's questions 1 and 2), this table and the buttons follow the merged rule; nothing else in this spec changes.

| Thing | Anyone | The metric's owner | The goal's owner | Admin | Enforced by |
|---|---|---|---|---|---|
| Read the library, a metric, its goals | Yes | Yes | Yes | Yes | R1 rule 3 |
| Add a metric (the page, or in place) | Yes | — | — | Yes | `saveMetric` (anyone adds) |
| Change a metric | No button | Yes | — | Yes | `saveMetric`, `canEditMetric` |
| Remove a metric; put it back | No button | Yes | — | Yes | `removeMetric`; `canRestore` |
| See "To sort out" and the mark on a row | No | On theirs | — | On any | Rule 3 here |
| Choose a goal's metric and "For" | No (the field isn't shown) | — | Yes | Yes | `linkGoalMetric`, `canLinkGoal` |
| The line on Workspace → About | No | No | — | Yes | — |
| Filter Goals by a metric | Yes | Yes | Yes | Yes | R1 rule 3 |

## 4. Rules for the module

In `src/domain/metrics.ts` today (AS part 2 moves the module's rules to its folder; build them where the rules live when the item starts). Pure, each with tests from its worked examples, a section in the module's rules (`spec/modules/metrics/rules.md`) and conformance rows. They restate nothing: status and scorecard words from `goalStatus` and `scorecard.ts`; rights from `canEditMetric` and `canLinkGoal`.

### Rule 1. Finding metrics: `findMetrics(metrics, links, goals, people, teams, ask)`

`ask` is `{ q, unit, teamId, ownerId, dir, unused, sortout, sort, page, size = 50 }`; returns `{ total, from, to, rows }`. It is the module's `search` for the kind `metric` (find spec, rule 7).

- Removed metrics are never listed.
- `q`: the find spec's `textMatches` over name, unit, "lower is better" or "higher is better", the owner's name, the meaning and the source.
- `teamId`: metrics with a live link whose slice is that team; `company`: whose slice is the whole company.
- `unused`: no live link. `sortout`: rule 3 returns anything (for the viewer's rights or not: the filter is the same for everyone).
- Order: `name` A to Z ignoring case and accents; `goals` most live links first, then name; `changed` latest `updatedAt` first.

| Given (the example's 13) | Then |
|---|---|
| Nothing asked | 13, A to Z; the first is "Change failure rate" |
| `q: "min lower"` | The metrics in min where lower is better |
| `q: "rhea"` | The four she owns |
| `unit: "%"` | Flaky test rate, Remote build cache hit rate, Change failure rate |
| `teamId: "cicd"` | Pipeline queue wait (p90), Flaky test rate, Remote build cache hit rate |
| `teamId: "company"` | The seven measured for the whole company |
| `unused: true` | CI compute cost per pipeline run |
| `sort: "goals"` | Any metric with a goal before the one with none |

### Rule 2. A metric's goals: `metricGoals(metric, links, goals, snapshot, cycle, week, today)`

One row per live link to a goal in the running cycle: `{ goal, status, slice, now, target, vsPlan, owner }`, worst first (`RANK`), then by slice name. `summaryLine` returns the "Lowest now … Highest …" sentence when two or more rows have a value, the same unit and decimals; otherwise nothing.

| Given | Then |
|---|---|
| Lead time for changes (one goal, the whole company) | One row: Off track · Lead time for changes · The whole company · 37 hours · 24 hours by week 53 · "9 hours behind plan" · Rhea Kapoor; no summary line |
| A metric two teams' goals use, at 7 and 4 min | Two rows, worst status first; "Lowest now: Build & Release, 4 min. Highest: CI/CD, 7 min." |
| A linked goal with no check-in yet | Its Now is "No value yet"; it is left out of the summary line |
| A linked goal that was stopped | Not listed |
| CI compute cost per pipeline run | No rows |

### Rule 3. What a metric needs: `metricNeeds(metric, links, people)`

In this order; each `{ id, sentence, button, to }`.

| id | When | Sentence | Button → where |
|---|---|---|---|
| `no-owner` | The owner is unset or has left | "Its owner has left" / "It has no owner" | "Choose an owner" → edit, Owner focused |
| `no-meaning` | Meaning is empty | "No meaning yet" | "Say what it means" → edit, that field |
| `no-source` | Source is empty | "No source named" | "Say where the number comes from" → edit, that field |
| `unused` | No live link, and it was added more than 14 days ago | "No goal uses it" | "See goals in {unit}" → `/goals?scope=all&q={unit}` |

| Given | Then |
|---|---|
| Lead time for changes (owner, meaning, source, one goal) | Nothing |
| CI compute cost per pipeline run, added in the seed months ago, complete but unused | `unused` |
| A metric added today in a goal form: name, unit, direction only, linked | `no-meaning`, `no-source` |
| The same, its owner marked as left | `no-owner` first |
| A metric added yesterday, not yet linked | No `unused` (14 days' grace) |

### Rule 4. A close name: `closeNames(name, metrics)`

Returns up to two live metrics whose names are close to `name`, closest first. Names are compared as sets of words, lower-cased, without accents and punctuation, leaving out "the", "of", "per", "for", "in", "a", "rate", "time" and anything in brackets: close when one set contains the other, or when they share at least two words and differ by at most one. An exact match (any case) is `metricProblems`' error, not this.

| Typed | Existing | Close? |
|---|---|---|
| "CI cost per pipeline run" | "CI compute cost per pipeline run" | Yes (differs by "compute") |
| "Queue wait" | "Pipeline queue wait (p90)" | Yes (contained) |
| "Lead time" | "Lead time for changes" | Yes ("lead" is contained; "time" is left out) |
| "Deploys per day" | "Production deploys per day" | Yes |
| "Change failure rate" | "Flaky test rate" | No ("rate" doesn't count) |
| "Build time" | "Base image build time" | Yes |
| "MTTR" | "Mean time to restore (P1 and P2)" | No (an abbreviation is the server's search's job) |

### Rule 5. What a chosen metric sets on a goal form: `measureDefaults(metric, form)`

Returns the fields to set and the line to show.

- A new goal whose unit, decimals and direction are untouched (still the form's defaults): set all three from the metric; the line is "{unit}, {decimals in words}, {direction}: from the metric."
- A field the person has typed is kept; if it differs, `linkProblems` says so as today (unit: an error; decimals, direction: a warning).
- An existing goal (change): nothing is set; `linkProblems` judges.
- Direction on a goal is which way its target lies from its start; a metric's "lower is better" sets the form's hint and the plausibility question ("The target is above the start, but lower is better for this metric. Is that right?"), not the numbers.

| Given | Then |
|---|---|
| New goal, nothing typed; choose Pipeline queue wait (p90) (min, 0, lower) | Unit "min", decimals 0; the line shown; the three fields hidden |
| New goal with unit typed as "hours"; choose the same | Unit stays "hours"; the error "This metric is in min; this goal is in hours." under Unit |
| New goal, defaults; choose a metric; then "Use different ones" | The three fields show, filled "min", 0, lower |
| Change a goal that keeps 1 decimal; choose a metric with 0 | Nothing set; the warning as today |
| Choose "No metric" after a metric | The fields come back with what they held; "How it’s measured" shows |

## 5. Extension points

What the module uses, and what must exist first. A row marked "new" is added to the core by the item named, with its `PlaceProps`, a line in `docs/architecture.md`'s table and a manifest check.

| Extension point | Use | State |
|---|---|---|
| Routes, redirects, `focus`, `title` / `name` | Section 1 | Exists; `name` is the navigation spec's (NV2) |
| `navigation` with `group: 'lookup'` | The Metrics item, after People | The group is the navigation spec's (NV1) |
| `goal.measure` | 2.4 | Exists (0b) |
| `goal.sections` | 2.6's block; it now renders inside About | Exists; moved by the goal spec (GT1) |
| `goal.facts` | 2.6's line | New: GT1 |
| `people.person`, `people.team` | 2.7 | New: the Workspace spec (WR1) |
| `finders` | The kind `metric` in find-and-pick and Find | New: the find spec (FS1) |
| `filters` with `list: 'goals'`, declared as data (column `metricId`) | `?metric=` on Goals | New: AR2 (`docs/design/architecture.md`) |
| Module-level `needs(snapshot, viewer)` | 2.8 | New here (ML3): the Workspace spec gives `needs` to a section; a module with no section needs it at module level. `workspaceNeeds` lists modules' needs after the core's |
| A goal's History | "Rhea linked it to the metric …" shows under Changes because linking is already an entry in the core's change log | Nothing new (`docs/design/architecture.md`, 4.1) |
| Records (tables, mappers, commit keys) | The module's own records and rules out of the core | AS part 2, built just before ML1 (`docs/design/architecture.md`, 1.3) |
| Help, tools, requirements, journeys | As today | Exists |

Until a new point exists, its part of this spec waits; nothing is wired by editing a core screen.

**MCP.** `list_metrics` gains the filters of rule 1 (`q`, `unit`, `team`, `owner`, `unused`, `sortout`) and returns each metric's goals by status; `get_metric` returns rule 2's rows and rule 3's needs. `src/mcp/parity.ts` gains the new screens. Then `npm run build:mcp`.

**Spreadsheets.** The Metrics sheet stays read-only. Data's Spreadsheets menu names it: "Everything, as a workbook (goals, check-ins, plans, asks, people, metrics)".

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U81 | METRICS-LIBRARY, OLD-ADDRESSES | The library is a place: as Oskar, Metrics is in the menu (More on a phone); the list says "13 metrics, A to Z."; search "queue" finds Pipeline queue wait (p90); its page shows its meaning, the goals table with status, "For", now, target and against plan, and "See its goal" opens Goals filtered to it with the filter line saying so. No button that changes anything is on his pages. Every address in section 1's redirects lands where the table says |
| U82 | METRICS-MEASURED-BY | A goal is linked where it is made: as Rhea in New goal, on the measure step "Measured by" comes first; typing "queue" finds the metric; choosing it shows its meaning, sets "min, whole numbers, lower is better: from the metric" and "For: CI/CD"; Check has its row; after publishing, the goal's summary says "Measured by …" and the metric's page lists the new goal for CI/CD. Again with "Add “runner wait” as a new metric": the small form, then the goal carries on, and the library has it with "No meaning yet" for Rhea. A dated-stages goal has no "Measured by" |
| U83 | METRICS-CARE | Looking after a metric: as Rhea on a metric she owns, "To sort out" lists what is missing and each button opens the form at that field; adding a metric named "CI cost per pipeline run" asks about "CI compute cost per pipeline run" and still saves; changing a unit with goals linked confirms first; Remove says which goals stop being measured, and Undo puts the metric and its links back. As Tunde the same page has none of these and says who can change it. As Amara, Workspace → About says "1 metric has no owner" after its owner is marked as left |

**Changed:** Wednesday's journey for the Metrics page (its addresses and the select become the library and find-and-pick); the New goal journeys (the measure step's first field).

### F, N and P checks

| # | Check |
|---|---|
| F15 | Phone, 390 px: the first metric on the library is within 300 px of the top; a row is at most three lines; a metric's goals are rows, not a table that scrolls sideways; the "Measured by" sheet's first result is within 200 px with the keyboard up; nothing scrolls sideways |
| N12 | The find spec's company-size check, with 300 metrics: the library draws at most 50; the picker answers within 200 ms; no `select` lists metrics |
| N16 | One set of numbers: a metric's row's goals by status equal its page's table's rows, and "See its {n} goals" equals the rows Goals then shows |
| P3, P4, P6 | Extended: every status in the library and the goals table is shape plus word; "to sort out" uses the warning mark, never a status shape; no capsules |

### Unit tests

One file per rule with every worked example; `movedMetrics` row by row; the manifest test for the new routes, places and lists; `tools.test.ts` for the new filters.

### Requirements (`evals/requirements.json`, listed in `module.json`)

New: `METRICS-LIBRARY` ("Anyone can find a metric, read what it means, and see every goal measured by it side by side"), `METRICS-MEASURED-BY` ("A goal's metric is chosen by typing to find it where the goal is made or changed, or added there, and fills in what the metric already says"), `METRICS-CARE` ("A metric's owner and admins are shown what it is missing; removing or changing one says what happens to its goals").

## 7. Help and What's new

### Help (`src/modules/metrics/help.ts`)

| Article | Change |
|---|---|
| `metrics` (route `/metrics`; `after: 'people'`) | "Metrics: what each number means": the library, finding and filtering, a metric's page and its goals table, who can change one |
| `metric-add` (route `/metrics/new`) | Each field and why; the close-name question; adding one from a goal form |
| `metric-measured-by` (a section of `goals-new` and `goal-edit`, added through the module's Help) | Choosing, "For", what it fills in, "No metric" |
| Wednesday's article for `/data/metrics` | Removed; its id redirects to `metrics` |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| ML1 | `metrics-place` | "Metrics has its own place" | "Metrics moved from Data to the menu, beside People." "Each metric has a page with its meaning and every goal measured by it, side by side." "Old links still work." |
| ML2 | `measured-by-find` | "Find a goal’s metric by typing" | "In New goal, “Measured by” comes first: type to find a metric, or add one there." "Choosing one fills in its unit and which way is better." |
| ML3 | `metrics-sort-out` | "Metrics say what they’re missing" | "A metric’s owner sees what it still needs: a meaning, a source, an owner, a goal." "Adding one with a name close to another asks first; removing one says which goals it leaves." |

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Stays under Data | Routes are `/data/metrics`, `/data/metrics/<id>`, `/data/metrics/new`, `/data/metrics/<id>/edit`; only the `?m=` and `?new` forms redirect; no menu item (Data's button stays); the lit item is Data; back link "‹ Data"; U81's first step opens it from Data |
| 2 | Keep the list of links | 2.2's item 5 is a list of goal links with status as shape and word and "For"; rule 2 returns only those; no summary line; N16 still holds |
| 3 | Separate fields | Rule 5 and 2.4's item 4 are dropped; the three fields stay; `linkProblems` judges as today |
| 4 | No close-name question | Rule 4 and its text in 2.3 and 2.4 are dropped; U83 loses that step |
| 5 | No line on About | 2.8 and the module-level `needs` are dropped; the filter stays |
| Wednesday's room: admins only create | 2.1's and 2.4's "add" controls are admins-only; a member's none-found offers no "Add … as a new metric"; section 3 follows the merged rule |

## 9. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| ML1 | **The library as a place, and a page per metric** | Section 1; 2.1, 2.2, 2.6, 2.7; rules 1, 2; `list_metrics` and `get_metric`; U81, F15, N16 | M | Wednesday's build merged; FS2 (the list bar), NV1 (the menu's group), GT1 (`goal.facts`), WR1 (the people places: 2.7 waits for it). Cleaner after AS part 2 |
| ML2 | **“Measured by”, found by typing** | 2.4; rule 5; the `metric` finder; the Goals filter; U82 | S–M | FS1; OB1 (New goal's reordered steps: without it the field stays where Wednesday put it) |
| ML3 | **Looking after metrics** | 2.3 (each error under its field, the close-name question, the change confirm), 2.5, 2.8; rules 3, 4; module-level `needs`; U83 | S–M | ML1; WR2 for About's list |

**This builds on backlog 0b** and keeps its dropped list dropped. The order across areas is in `docs/design/README.md`.

**For the rebuild kit:** the module's stage (`spec/rebuild/stage-4-module-metrics.md`, from `module.json` `rebuild`) gains the screens' entry and exit criteria (U81 to U83), and its `gaps` say the goals table is where slices side by side and source numbers grow (`growth.md`).
