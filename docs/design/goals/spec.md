# The Goals page: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings G1 to G9); the whole redesign is in `docs/design/README.md`. It assumes Lane takes the recommended answer to each decision; "If Lane decides otherwise" says what changes. It is built on the list bar and find-and-pick (`docs/design/find/spec.md`, items FS1 and FS2) and lands with the new sidebar (`docs/design/navigation/spec.md`, NV1).

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed` (this page is shared layout: run the full `npm run evals`). No table, no migration: a saved view's `params` are rewritten when read (rule 6), not in the database.

**Words used throughout.** `{ws}` is the workspace's name. "Scope" is whose goals; "group" is how they are arranged; "layout" is how they are drawn. Status words and their order are the vocabulary's (`src/domain/vocabulary.ts`). Wording in quotation marks is exact.

## 1. Routes

| Address | Screen | Title (rule 2 of the navigation spec) |
|---|---|---|
| `/goals` | Goals | "Goals" |

**The address's parts**, all optional, in this order when written: `scope`, `group`, `view`, `attention`, then the goal query's own (`q`, `status`, `level`, `team`, `owner`, `kind`, `needs`, `due`, `quiet`, `qtr`, `result`, `feeds`, `helps`, and a module's, such as `metric`), then `sort`.

| Part | Values | Default (left out of the address) |
|---|---|---|
| `scope` | `mine`, `team`, `watching`, `all` | None: always written (rule 1) |
| `group` | `tree`, `team`, `level`, `none` | The scope's own (rule 2) |
| `view` | `list`, `table`, `board`, `history`, `map` | `list` |
| `attention` | `1` | Off |
| `sort` | As today (`worst`, `title`, `owner`, `team`, `level`, `gap`, `last`, `due`, with `.desc`) | The group's own order |

### Redirects for old addresses

Each is a replace, keeps `?today=`, `?store=` and the demo prefix, keeps every other part of the address, and is covered by U75. They are one function, `movedGoals(search)` (rule 6), also used when a saved view is opened.

| Old | New |
|---|---|
| `/goals` (nothing else) | `/goals?scope=<rule 1>` |
| `?show=mine` | `?scope=mine` |
| `?show=watching`; `/watching` | `?scope=watching` |
| `?show=outcomes` | `?scope=all` (group `tree` is All's own) |
| `?show=levels` | `?scope=all&group=level` |
| `?show=teams` | `?scope=all&group=team` |
| `?show=attention` | `?scope=all&attention=1` |
| Any address with a filter and no `show` (`?owner=rhea`, `?team=cicd`, `?status=off`, `?feeds=G-1`: the links People, Teams, Home and a goal's page make) | The same with `scope=all` |
| `?view=cards` | Dropped, with today's line (`GONE_LAYOUT_NOTE`) |
| `?show=<anything else>` | `?scope=<rule 1>`, with the line "There’s no “{x}” tab, so these are {scope's name}." |

## 2. Screens

### 2.1 Goals (`/goals`)

Wireframes 1, 2, 3. Frame by layout as today: List reads at 1040 px; Table, Board and History get the wide frame; the Map the whole work area. The page's head and bar keep the same position and width in every layout (G8): only the area under the count line changes width.

**Content, in order (a computer)**

1. **Head.** Title "Goals". Beside it the week line as today ("Week 46 of 53 · Q4 (Oct–Dec) · 2026"). At the right: "Wrap up" when the wrap-up is open (as today), and the quiet link "New goal".
2. **Scope tabs**, links with `role="tablist"`, each with its count: "Mine {n}", "My team {n}" (rule 1 names it), "Watching {n}", "All {n}". A tab whose scope the viewer can't have is left out (rule 1). At the right of the same row: the **Views** menu.
3. **The list bar** (`docs/design/find/spec.md`, 2.1), in this order:
   1. Search: "Find by name, owner, team or key".
   2. **"Needs attention · {n}"**, a toggle button (`aria-pressed`); n is rule 3's count for this scope and these filters. With none: "Needs attention · 0", still pressable, and the list then says rule 4's empty words.
   3. "Filters" ("Filters · {n}").
   4. **"Group: {value}"**, a menu: "As trees" ("Each top goal, then what feeds it"), "By team" ("Teams worst first, each with its counts"), "By level" ("North stars, then SVP, then team goals"), "None" ("One list"). The current one is marked "Current". Disabled, with the line "Needs attention has its own two groups", while the switch is on.
   5. "Sort: {value}", the options as today (`SORT_OPTIONS`), plus first "As grouped" (no `sort`).
   6. **"Layout: {value}"**, a menu of the five, each with its line (today's `LAYOUT_ABOUT`, as the phone's menu already shows them).
4. **The count line** (rule 4), `role="status"`.
5. **The filter line** (the find spec's rule 3), when a filter is on.
6. With the switch on, until every goal in the workspace has had its first check-in: one line, today's phone wording, "First check-ins: {a} of {b} goals. Why?" ("Why?" opens today's sentence). Not shown otherwise.
7. Any line about a dropped part of the address (today's `useBadLinks`).
8. **The goals**, by layout and group (2.2).
9. The status key (`StatusLegend`), after the goals, as today; not on the Map.

**The Views menu** (one meaning on every width): the saved views, pinned first ("{name} · pinned"), the open one marked "Current"; a hairline; "Save this view…" (shown when the address isn't already a saved view and something is set beyond a bare scope); "Copy link"; then modules' tools from the `goals.tools` place ("Export these goals"). When a saved view is open, also "Rename…", "Pin for everyone" / "Stop pinning" (admins), "Delete this view…" (its owner or an admin), as today's "Manage view".

**An open saved view** is shown as today: its name as an extra tab after All, lit, and no scope tab lit. Changing anything un-lights it (the address no longer equals the view).

**Empty and error states**

| When | Says | Offers |
|---|---|---|
| The workspace has no goals | "No goals yet" | **"Set up the first goal"** (primary) |
| Mine, and you own none (the address typed) | The scope becomes rule 1's, with "You don’t own a goal in {ws}, so there’s no Mine tab: these are {scope's name}." | — |
| My team, and it has no goals | "No goals in {team} yet." | "See all goals" · "New goal" |
| Watching, and you watch none | Today's Watching empty state ("Find goals to watch") | As today |
| The switch on, nothing needs attention, some being handled | "Nothing new needs attention in {scope's name}." then the Being handled group | — |
| The switch on, nothing at all | "Nothing is off track, stale or slipping in {scope's name}." | — |
| A search or filters find nothing | The list bar's none-found block | Its links |
| A near miss | The list bar's | — |

### 2.2 What the goals look like, by group and layout

Unchanged components; this says which is used when.

| Group | List | Table, Board, History | Map |
|---|---|---|---|
| `tree` | Today's Trees: each top goal's card and its rows (`TreeCard`, `TreeRows`); "Not linked" last, left out when empty (G9). In a scope that isn't All, a goal whose parent is outside the scope sits one step in from its nearest shown ancestor, as filtering does today (`GoalsScreen.tsx:92–103`) | Grouped by tree, as today | The trees |
| `team` | Today's By team: teams worst first, each with its counts as shape and word, its objective, then its rows | Grouped by team | Unchanged (the Map ignores group) |
| `level` | Today's By level | Grouped by level | Unchanged |
| `none` | One flat list of rows, in the sort's order (worst first by default) | One group | Unchanged |
| Switch on (any group) | "Needs attention · {n}" (today's `AttentionCard`s), then "Being handled · {m}" (`HandledGroup`) with `HANDLED_LINE` | Two groups, as today | Today's attention mode |
| Sorted, in `tree` | One list across every tree, with today's line "{sort}, across every tree. Clear the sort to see them as trees." | The same | — |

Watching in List with group `none` and no sort keeps its own body (`WatchingBody`: "Needs attention", "What changed this week", "Nothing flagged", "What you watch"), as today. With any other group, a sort or the switch, it is plain rows like any scope.

A team's heading in `team` group is a link to the team's page (`/teams/<id>`) once the Workspace redesign's WR1 is in; a row's owner name is a link to the person's page.

### 2.3 On the Map

- The bar's search field's placeholder is "Find a goal or key, and go to it". Typing lists matches under the field as the Map's combobox does today; choosing one opens, outlines and pans to it (today's behaviour, `GoalMap.tsx`). It does not narrow the Map. Enter with no choice narrows as on other layouts (so a shared link with `?q=` still means the same goals).
- The Map's own search field and its "Needs attention" tick box are removed; the bar's switch drives the Map's attention mode.
- "Troubled trees only", "Fit all" and the zoom controls stay on the Map.
- Group and Sort are disabled on the Map with the line "The Map is always the trees."

### 2.4 The phone (under 700 px)

Wireframe 4.

**Content, in order**

1. The top bar (navigation spec, 2.3): "Goals". No title on the page; the week line moves into the top bar's second line ("{ws} · week 46"), which already says it.
2. The scope tabs, 44 px high, scrolling sideways inside themselves when they don't fit, the lit one kept in view.
3. The search field and **"Filter and sort"** ("Filter and sort · {n}").
4. A row: **"Needs attention · {n}"** at the left; **"View: {layout}, {group}"** at the right ("View: List, as trees"; "View: Board").
5. The count line (two lines at most; the statuses wrap).
6. The filter line, the first-check-ins line, the goals.

**The View sheet**, titled "View": "Layout" (the five, each with its line, one chosen); "Group" (the four; left out on the Map); "Saved views" (the list; the open one marked); then the buttons "Save this view…", "Copy link" and the modules' tools. Each choice applies at once; the sheet's foot has **"Done"**.

"New goal" on a phone is in More (navigation) and as the quiet link at the end of the page, after the status key. "Wrap up", when open, is a full-width button above the tabs.

### 2.5 Save this view (sheet)

As today, with one change: its summary line describes the view in the new words, from `describeView` (rule 5): "My team, by level, needs attention, Table. Team CI/CD." Fields: "Name" (required: "Give the view a name."), and for admins the tick box "Pin for everyone in {ws}". Primary **"Save view"**; "Cancel". After saving: the toast "Saved “{name}”", and the view is open.

## 3. Who sees what

Consistent with R1: reading is open inside a workspace (rule 3). This table adds no right and removes none.

| Thing | Anyone | Owner of the goal | Admin | R1 |
|---|---|---|---|---|
| Every scope, group, layout, filter and the Map | Yes | Yes | Yes | Rule 3 |
| The Mine tab | When they own a goal | — | By the same rule | — |
| The My team tab | When they are in a team or lead one | — | By the same rule | — |
| Table's tick boxes and "Change {n} goals" | Only on goals they may change; none otherwise | Their goals | Every goal | `planChanges` |
| Save a view; rename or delete their own | Yes | Yes | Any view | `saveView`, `deleteView` |
| Pin a view for everyone | No control | No control | Yes | `pinView` |
| Export these goals (module) | Yes | Yes | Yes | Rule 3 |
| New goal | Yes (for a goal they own) | — | For anyone | `planChanges` |
| Wrap up | Their own goals | — | Any | `saveRetro` |

A control that would be refused is not drawn.

## 4. Rules for `src/domain`

In `src/domain/goalsPage.ts` (new) unless said, pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. They restate nothing: status from `goalStatus`, attention from `attentionList` and `splitAttention`, order from `worstFirst` and `worstGroupsFirst`, filters from `applyQuery`, watched goals from `watchedGoals`.

### Rule 1. The scopes someone has: `scopesFor(viewer, snapshot, last)`

Returns the tabs in order, each `{ id, label, goals }`, and which one opens when the address names none.

- `mine`: goals the viewer owns in the running cycle. Present when there is at least one.
- `team`: goals whose team is the viewer's own team or a team the viewer leads. Present when the viewer has such a team. Label "My team" for one team, "My teams" for several.
- `watching`: `watchedGoals(viewer)`. Always present.
- `all`: every goal in the running cycle. Always present.
- Opens on: `last` (the scope last used in this workspace, kept per person in the browser) when the viewer still has it; otherwise `mine`, else `watching` when it has goals, else `all`.

| Given (the example, 11 Nov) | Tabs | Opens on, first time |
|---|---|---|
| Rhea (CI/CD, leads it; owns 8; watches 12) | Mine 8 · My team 17 · Watching 12 · All 126 | Mine |
| Tunde (Build & Release; owns 2) | Mine 2 · My team {its goals} · Watching {n} · All 126 | Mine |
| Amara (Office of the VP, leads it; owns none; watches 56) | My team {its goals} · Watching 56 · All 126 | Watching |
| Oskar (Developer Experience; owns none; watches 3) | My team {its goals} · Watching 3 · All 126 | Watching |
| Someone in no team who owns nothing and watches nothing | Watching 0 · All 126 | All |
| Rhea, whose last scope was All | The same tabs | All |
| A person who leads CI/CD and sits in Office of the VP | "My teams": both teams' goals, once each | — |
| `?scope=mine` for Oskar | The scope becomes Watching, with 2.1's line | — |

### Rule 2. A scope's own arrangement: `ownGroup(scope)` and `ownOrder(scope, group)`

| Scope | Group when the address names none | Order when no sort |
|---|---|---|
| `mine` | `none` | Worst first |
| `team` | `none` | Worst first |
| `watching` | `none` (its own body in List) | Worst first |
| `all` | `tree` | Trees worst first, each tree's feeders worst first (as today) |

A group equal to the scope's own is left out of the address.

### Rule 3. The switch's count: `attentionCount(goals, query, snapshot, cycle, today)`

The number of goals in the scope, after the filters and the search but ignoring `attention` itself, that are in `splitAttention(...).needs`. Being handled is never counted (Lane, 9 Nov).

| Given (the example) | Count |
|---|---|
| All, no filters | 41 |
| All, Team CI/CD | The team's needing attention (7 in the walk of 10 Nov) |
| Mine, as Tunde, both goals on track and unflagged | 0 |
| Any scope, filtered to Status Done | 0 |

### Rule 4. The count line: `goalsLine(shown, scope, query, split)`

Built on the find spec's rule 2, then the statuses.

- Switch off: "{count line} " then each status that has goals, worst first, as "{n} {status word in lower case}", joined with " · ". Each is a link adding that status as a filter. Example: "17 goals, worst first. 2 off track · 4 at risk · 1 no recent update · 10 on track".
- Switch on: "{n} need attention: " (or "1 needs attention: ") then the same status list over the needs group only, where a status that isn't itself a reason for attention carries why: "{n} on track, flagged for {reasons}" with the reasons the vocabulary's flag words in lower case, the commonest two, joined with " or ". Then, when any are being handled: " {m} being handled are listed below." Then the button "Why?", which opens today's sentence (`AttentionCounts`).
- Switch on and nothing: the empty words of 2.1; no line.

| Given | Says |
|---|---|
| Rhea, My team, switch off | "17 goals, worst first. 2 off track · 4 at risk · 1 no recent update · 10 on track" |
| All as trees | "126 goals, as trees. 11 off track · 27 at risk · 2 no recent update · 2 no check-in yet · 76 on track · 8 done" |
| All, switch on (11 Nov) | "41 need attention: 11 off track · 23 at risk · 5 no recent update · 2 on track, flagged for getting worse or decision or help needed. {m} being handled are listed below. Why?" |
| Mine as Tunde, switch on, nothing | (no line) "Nothing is off track, stale or slipping in your goals." |
| My team, search "queue" | "2 goals match. 1 off track · 1 at risk" |
| One goal | "1 goal, worst first. 1 on track" |

A scope's name in sentences: "your goals", "{team}" (or "your teams"), "what you watch", "{ws}".

### Rule 5. A view in words: `describeView(params)`

For the Save sheet, a saved view's tooltip and Help. Scope's name, group (when not the scope's own), "needs attention" (when on), layout (when not List), then the filters as the filter line says them, then the sort.

| Address | Says |
|---|---|
| `?scope=team&attention=1&view=table` (Rhea) | "My team, needs attention, Table." |
| `?scope=all&group=team` | "All, by team." |
| `?scope=all&level=north-star&status=off,risk` | "All, as trees. Level North star · Status Off track or At risk." |
| `?scope=mine&sort=due` | "Mine. Sorted by due soonest." |

### Rule 6. Old addresses and old saved views: `movedGoals(search, viewer)`

Section 1's table as one function, returning the new search string and any line to say. A saved view's stored `params` pass through it when the view is opened and when views are matched against the address, so a view saved as `show=teams&sort=worst` opens as `scope=all&group=team&sort=worst` without changing the record. (The next time its owner saves it, the new form is stored.) The demo workspace's seeded views are regenerated in the new form.

| Stored | Opens as |
|---|---|
| `show=attention&needs=decision` ("Waiting on a decision") | `scope=all&attention=1&needs=decision` |
| `show=mine&sort=worst` ("My goals by status") | `scope=mine&sort=worst` |
| `quiet=2` ("No update for 2 weeks or more") | `scope=all&quiet=2` |
| `team=cicd` ("Old CI view") | `scope=all&team=cicd` |
| `show=levels&view=cards` | `scope=all&group=level`, with the Cards line once |

### Changed: `query.ts`

- `GoalQuery` is unchanged. `scope` and `group` are not part of it: they choose which goals the query is applied to and how the result is grouped, and live in `goalsPage.ts`.
- `matches` calls the find spec's `textMatches` (its rule 1) and includes the status word in the text.
- `QUERY_KEYS` gains nothing; `viewParams` (in `GoalFilters.tsx`) moves to `goalsPage.ts` and includes `scope`, `group`, `view` and `attention`.
- `find_goals` (MCP) gains `scope` (`mine`, `team`, `watching`, `all`, for the token's person) and `group` is not offered (an order, not a meaning). `src/mcp/parity.ts` is updated.

## 5. Extension points

- `goals.tools` (a place) is unchanged; it is rendered inside the Views menu on every width (`inMenu` always true).
- A module adds a filter to Goals through the find spec's `filters` list (`list: 'goals'`). The metric library adds "Measured by" (`?metric=<id>`).
- A module adds a group through a new list in its `app.tsx`: `groups: [{ id, label, hint, of(goal, snapshot) → { key, title } }]` (the metric library could add "By metric"; not built now). `docs/architecture.md`'s table gains both.

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U73 | GOALS-SCOPE | The page opens on yours: as Tunde, Goals opens on Mine with his 2 goals and the address says `scope=mine`; My team lists his team's; All is 126 as trees; back on Goals from the sidebar it opens on All (his last). As Oskar it opens on Watching and there is no Mine tab. As Rhea, Group: by level on My team shows her team's goals under their levels: a combination today's page can't make |
| U74 | GOALS-ATTENTION | One switch, one line: as Rhea on My team, the switch says the team's count; on, the list is "Needs attention" then "Being handled", the count line is rule 4's and its first number equals the first group's rows; the same switch on All says 41 and matches Home's count of goals needing attention; an on-track goal in the first group is explained in the line. No other control on the page sets `attention` |
| U75 | GOALS-ADDRESS, OLD-ADDRESSES | The address is the page: every old address in section 1 lands where the table says; each saved view in the demo opens the same goals as before; scope → group → sort → layout → switch, then Back five times returns through each state in order, the layout drawn matching the address each time; a reload at any step draws the same page |
| U76 | GOALS-SCOPE | From a person and a team: "See Rhea's 8 goals" opens All filtered to her, the filter line says so and "Remove" shows all 126; "See its 17 goals" on CI/CD the same; a team's heading in By team opens the team's page (after WR1) |

**Changed:** every journey that presses a Goals tab by its old name (Trees, By level, By team, Needs attention): U1, U6, U9, U11, U24 to U26 and the saved-view journeys; N6 and F5 read the new bar; the Map's journeys find a goal from the bar's search.

### F, N and P checks

| # | Check |
|---|---|
| F13 | **Replaces F5.** The first goal row is within 280 px of the top at 1440 × 900 and within 260 px at 390 × 844 and 360 × 800, on every scope, with and without the switch, as each of the four demo people. The head and bar don't move by a pixel between layouts at 1440 (the Map included). At most 12 controls sit above the first goal at 1440 and 6 at 390. Nothing scrolls sideways |
| N14 | One set of numbers: on every scope, with and without the switch, as Amara and Rhea, the tab's count equals the rows when nothing narrows; the count line's first number equals the rows of the first group; the statuses in the line add up to it; the switch's count equals the first group's rows |
| P3, P4, P6 | Extended to the count line (each status in it is a word; shapes only where there is room for both) and the Group and Layout menus |
| N12 | The find spec's company-size check covers Goals: All as trees draws at most 50 top goals, flat at most 50 rows |

### Unit tests

One file per rule with every worked example; `movedGoals` row by row; `query.test.ts` for the status word and `textMatches`; `parity` for `find_goals`.

### Requirements (`evals/requirements.json`)

New: `GOALS-SCOPE` ("Goals opens on the viewer's own goals, and whose goals, how they are grouped and how they are drawn are three separate choices"), `GOALS-ATTENTION` ("Needs attention is one switch that works on any set of goals, and one line says what it counts"), `GOALS-ADDRESS` ("The Goals page's address says everything that is drawn, and Back returns through each state"). Reworded: the requirements that name the old tabs.

## 7. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `goals` (route `/goals`) | Rewritten around the three choices: whose (the tabs, and where it opens), Group, Layout; the Needs attention switch and what its line means; Views; the phone's View sheet |
| `needs-attention` | "The Needs attention tab" becomes "the Needs attention switch"; its rule is unchanged |
| `watching` | Watching is a tab of Goals; its own list shows when nothing else is chosen |
| `saved-views` | Saving from Views; what a view remembers (scope, group, layout, switch, filters, sort); old views still open |
| `map` | Finding a goal from the bar's search |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| GL1 | `goals-yours-first` | "Goals opens on yours" | "The tabs now say whose goals: Mine, My team, Watching, All." "Trees, By team and By level moved to Group, so you can use them on any of those." "Old links and saved views still open the same goals." |
| GL1 | `needs-attention-switch` | "Needs attention is a switch" | "Turn it on over any set of goals; it counts the ones that need attention there." "One line under the bar says how many goals are shown and how they stand." |
| GL2 | `goals-view-menus` | "Layouts have names" | "Layout and Views are menus, the same on a computer and a phone." "On the Map, the search at the top finds a goal and takes you to it." |

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Keep today's six tabs | Rules 1, 2 and 6 and U73 are dropped; 2.1 keeps today's tabs and gains only the list bar, the Layout and Views menus and rule 4's line. F13's limits still hold. The sidebar keeps Mine, Watching, All (navigation's decision 1 falls with it) |
| 2 | Always opens on All | Rule 1's "opens on" is always `all`; the phone's Goals tab still opens All; the rest stands |
| 3 | Needs attention stays a tab | It is a fifth tab after All: "Needs attention {n}" → `scope=all&attention=1`; the switch is removed from the bar; rule 3 counts All only |
| 4 | No My team tab | Rule 1 never returns `team`; `?scope=team` redirects to `scope=all&team=<the viewer's team>` |
| 5 | Three layouts | History and Map leave the Layout menu and `view=history\|map` open List with a line, as Cards does; MAP's eval moves to spec-only notes. (Not recommended: the Map was rebuilt on 10 Nov) |

## 9. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| GL1 | **Goals opens on yours: scope, group, the switch, one line** | 2.1, 2.2, 2.5; rules 1 to 6; the redirects; the demo's views regenerated; `find_goals`' scope; U73 to U76, F13, N14 | M | FS2 (the list bar). Lands with NV1, which removes the sidebar's Mine, Watching, All |
| GL2 | **The menus, the Map's search and the phone's View sheet** | 2.3, 2.4; the Layout and Views menus on every width; the head that doesn't move | S–M | GL1 |

**This replaces** 0u's Goals leftovers and what is left of LV on this page. The order across areas is in `docs/design/README.md`.

**For the rebuild kit:** GL1's stage notes say scope is R6a's scope (rule 5 there) and that All is paged from summary rows (R4); that the three choices are independent and live in the address; and that "Needs attention" is a query, not a list kept anywhere.
