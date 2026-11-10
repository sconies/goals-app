# What the redesign needs from the architecture

10 November 2026. Phase 3 of the app redesign (`docs/design/README.md`), asked for by Lane through the planning session. Docs only; nothing is built.

This is not a new architecture review. The deep review's A1 to A7 (`docs/reviews/2026-11-10-deep-review.md`), backlog item AS and `spec/rebuild/ports-at-scale.md` cover that ground, and this builds on them. It answers a narrower question: **for each piece of the redesign, what must change under the screens, in what order, and where should the design give way because the architecture would make it costly?**

## The short answer

- **Five architecture items**, AR1 to AR4 and AS part 2, each placed just before the first screens that need it. Together about three releases of work. AS part 3 rides along in two halves.
- **The redesign adds nothing the rebuild's two ports can't carry.** Every list is the query port; every button is an action that already exists, bar one that the design should drop (section 4).
- **Four places where the design should change** because of what it would cost: fewer new extension points; a module's filter declared as data, not code; no new record field for "who owns this template goal"; and the new rules must not take a whole workspace as their input.
- **The drill is untouched**: stage 1's conformance rows don't move. Each item adds rows of its own, and Faro's own harness must still score 100% on them.

## 1. Each design piece, and what it needs

### 1.1 The one picker and the shared search (find; People; Metrics)

**The design:** one find-and-pick control, one list bar and Find from anywhere, all answered by "one search function per kind" (find spec, rule 7).

**Today:** every screen filters its own array, taken from the whole loaded workspace.

| What | Where it lives today |
|---|---|
| Goals' search, filters, sort | `src/domain/query.ts` (the model), `src/screens/GoalFilters.tsx`, `GoalsScreen.tsx` |
| Activity's | `src/screens/Activity.tsx`, `src/domain/activity.ts` |
| Data's | `src/screens/DataTables.tsx`, `src/domain/tableFilter.ts` |
| The Map's finder | `src/screens/GoalMap.tsx` |
| People and teams | `src/screens/Workspace.tsx` |
| Pickers | `GoalWizard.tsx`, `GoalEdit.tsx`, `GoalFields.tsx`, `Review.tsx`, `BulkEdit.tsx`, `Inspect.tsx`, `CheckInFlow.tsx`, `RemoveSheets.tsx`, `AiAssistants.tsx`, `Demo.tsx`, `Start.tsx`, `WorkspaceSwitch.tsx` |
| The MCP tool | `find_goals` in `src/mcp/tools.ts`, which filters by its own chain before the shared query (the deep review's A5) |

**The change (AR1): a `Search` port, shaped as the query port's read side.**

- `src/ports/search.ts`: `search(kind, ask) → Promise<{ total, rows, next, near? }>` with `ask = { q, filters, sort, after, size }`. It is `ports-at-scale.md`'s `GoalsQuery` cut down to what a list or a picker asks: its `goals()`, `people()`, `teams()`, `activity()` and `search()` are this one call with a kind. Paging is by key (`after`), as that page says, not by page number: the specs' `?page=` in the address is turned into `after` by the adapter in Faro.
- **Kinds are open**: `'goal' | 'person' | 'team' | 'workspace'` in the core, and any a module registers (`'metric'`). `ports-at-scale.md` lists three; its sketch gains the line that kinds come from the registry.
- The browser adapter (`src/adapters/local.ts`) answers by calling the pure rules in `src/domain/find.ts` over the loaded workspace. The internal app's adapter calls its server. Screens and pickers import the port, never the rules.
- **It is asynchronous from day one.** A picker must cope with a slow answer and an out-of-order one (show the last asked, drop the rest), though Faro's adapter answers at once. This is the cost that is cheap now and expensive to retrofit.
- **A small `Prefs` port beside it** (`src/ports/prefs.ts`): a few values per person and workspace: things opened lately, the Goals scope last used, what "Getting started" has been told. Faro keeps them in the browser; the internal app on its server. It replaces the loose `localStorage` keys the redesign would otherwise add (the specs name three).
- **With it, AS part 3's two leaks that touch search:** `find_goals` goes through the port like the screen does; and the layers lint bans `new Date()` and `Date.now()` in `src/domain` (the clock is a port; the new rules take `today`).

### 1.2 Navigation and the People pages (navigation; Workspace; Metrics)

**The design:** a menu in groups that modules add to; pages for a person, a team and a metric that modules add blocks to; a page that names itself.

**Today:** modules already add routes and menu items (`routes`, `navigation` in `src/core/app.tsx`; read by `src/App.tsx:85` and `src/ui/Shell.tsx`). So the ask "an extension point for navigation entries and pages, not only Workspace sections" is half met. What is missing is small and specific:

| Missing | Needed by | Today |
|---|---|---|
| A menu item's **group** (`work` or `lookup`) | The grouped menu (NV1) | `ModuleNav` has no group; every module item is placed before New goal |
| A page's **name from its thing** (`name(params, reads)`) | Titles and "Opened lately" (NV2) | `ModuleRoute.title` is a fixed string (`Shell.tsx:204`) |
| The menu, the lit item and a page's name **as rules** | NV1, NV2 | Inline in `Shell.tsx` (`sideFor`, `tabsFor`, `isActive`, `title`) and `BackLink.tsx` (`placeName`) |
| Places on a person's and a team's page (`people.person`, `people.team`) | "Metrics Rhea owns" | No such pages; `PLACES` has five names (`src/core/module.ts:17`) |
| A place in a goal's summary (`goal.facts`) | "Measured by …" | Only `goal.sections`, before Activity |
| A **finder** per kind | The metric in pickers and Find | None |
| A **filter** a module adds to Goals | "See its 4 goals" | None; `GoalQuery` is closed |
| Things to sort out raised by a module with no Workspace section | "2 metrics have no owner" | The Workspace design gives `needs` to a section only |

**The change (AR2): seven additions to the module contract, and no more.** `ModuleNav.group`; `ModuleRoute.name`; the places `goal.facts`, `people.person`, `people.team`; `finders`; `filters`; module-level `needs`. Each is typed in `src/core/app.tsx` or `module.ts`, listed in `module.json`, and checked by the manifest test.

People and teams themselves stay core: they are core records, and a module doesn't own them.

Four more extension points that the area specs first proposed are **cut** (section 4.1).

### 1.3 The metric library's own place (Metrics)

**The design:** `/metrics`, a page per metric, a picker, a filter on Goals, blocks on a goal's and a person's page: all inside `src/modules/metrics/`.

**Today (the deep review's A3):** the module folder holds a manifest, a README and its AI tools. Its records and rules are in the core:

| What | Where |
|---|---|
| Record types | `src/domain/types.ts:350–354`, `:384`, `:415` |
| Commit keys | `src/domain/commit.ts:22–25` |
| Store, row mappers | `src/data/store.ts:111–113`, `src/data/rows.ts` |
| Both database adapters | `src/adapters/supabase/goalsStore.ts`, `src/adapters/postgres/goalsStore.ts` |
| App state: four methods | `src/app/state.tsx:153–159`, `:626–628` |
| Removal, cycle roll-over, columns, export, MCP parity | `src/domain/removal.ts`, `cycle.ts`, `columns.ts`, `export.ts`, `src/mcp/parity.ts` |
| Rules | `src/domain/metrics.ts` |

Wednesday's screens add files to the module but leave all of that where it is. Building ML1 to ML3 on top would add five more rules to `src/domain/metrics.ts` and widen the leak.

**The change (AS part 2): the records extension point, before ML1.** As AS (2) already says, made concrete:

- A module declares its **records** in `module.json` (`records: [{ name, table, key, removable }]`) and in a `records.ts`: the row mappers each way, the key a commit files them under, what to do when a goal or person they point to is removed, and what a new cycle carries over.
- The workspace as loaded gains `modules: { [moduleId]: { [recordName]: rows } }`; a commit gains the same. `Store`, both adapters, `rows.ts`, removal, restore and export **iterate over what modules declare** instead of naming metrics.
- The module's **rules move into its folder** (`src/modules/metrics/rules.ts`), with the same purity as `src/domain`: the layers lint gains "a module's `rules*.ts` imports only `src/domain` and its own folder, and nothing of the browser, the network or the clock".
- App state loses its four metric methods; the module calls a generic `app.act(rule)` (see 1.4).
- **A migration may be needed**, and only one: if `okr_commit` names the metric tables, it changes to take a module's rows by table name from an allowed list. Safe to run twice; full SQL in the PR; no data moves. If the function is already generic over what it is handed, there is none. The build session checks this first.

### 1.4 The goal page's next steps and asks, and the command port (goal; onboarding)

**The design:** one list of everything asked and agreed on a goal, each row with the one button the viewer may press.

**The mapping.** Every button is an action that exists today and is already on `ports-at-scale.md`'s list for the command port. Nothing new is needed to carry them.

| Button (goal spec) | Action today | On the command port |
|---|---|---|
| Add a next step | `addAction` (`src/domain/actions.ts`) | `run(ws, 'addAction', { goalId, text, who, byWeek })` |
| Mark done | `markActionDone`, `canMarkDone` | `run(ws, 'markActionDone', { actionId })` |
| Ask {owner} a question | `askQuestion` | `run(ws, 'askQuestion', { goalId, text })` |
| Ask {owner} for an update | `askForUpdate`; take back: `undoUpdateAsk` | The same names |
| Respond; Answer | `answerRequest`, `canAnswer` | `run(ws, 'answerRequest', { askId, answer, close })` |
| Withdraw | `withdrawRequest`, `canWithdraw` | The same |
| Comment; edit; remove | `addNote`, `editComment`, `deleteComment` | The same |
| Watch; stop | `watch`, `unwatch` | The same |
| Check in; check in again; the first check-in | `planChanges` (the change engine) | `run(ws, 'planChanges', changes)`, with a preview and an apply |
| A stage recorded as already done at publish (onboarding, rule 3) | `planChanges`: the goal and a check-in for the stage's week, one change set | One command; one commit |
| "Start the plan from 7" (onboarding, rule 4) | `planChanges`: the start, the plan and the check-in together | One command. The rule that a plan change needs a reason once check-ins have started gains its one exception here, in `src/domain/changeset.ts` |

**The reads** are the query port's `goal()`: `GoalPage` gains `steps` (rule 2's rows) and `history` (rule 4's entries, a page at a time). "Only `goal()` reads a goal's check-ins" still holds.

**What is missing is on Faro's side of the seam, and small (AR3): one way to run an action.**

- Today the app's state object has a method per action (`src/app/state.tsx`, `AppState`: about sixty, four of them the metric module's), each wrapping `act(() => rule(ctx, input))`. A screen calls the method; the name of the action is lost at the call.
- **AR3 adds `app.run(action, input)`**: one dispatcher over a table of actions, which the per-action methods become thin aliases of and new code calls directly. It sets who, when and ids in one place. A module registers its actions in the table (`actions.ts`), which is how the metric module stops needing methods on the core's state.
- It is the command port's shape inside Faro: the internal app replaces the dispatcher's body with a call to its server and changes no screen. It does not make Faro's saves trustworthy (the browser still runs the rule; R1 says so); it makes the seam visible in the code a team will copy.

**The one new action the design asked for, and should not have:** "Ask for a decision or help" as a button on the goal page, outside a check-in (goal spec, 2.1). Today a decision or help is raised inside a check-in, as part of `planChanges`. A separate action would be a new row in R1's access table and a second way to raise the same thing. Section 4.5 changes the design instead.

### 1.5 Goals opening on yours (goals; navigation)

- **Scope, group and the switch are reads**, not records: `scopesFor`, `attentionCount` and `goalsLine` are answered by the query port's `goals()` and `counts()` with the scope as part of the query (R6a's rule 5 names it). The four tab counts and the switch's count are five `counts()` calls, each from summary rows.
- **`GoalQuery` gains `scope`** on the port (not in the address's filter part, where the goals spec keeps it separate): `mine`, `watching`, a team, or all. `find_goals` gains the same.
- **All as trees is paged by top goal**: the first page is the top goals' summaries; a tree's feeders load when it opens. Faro's adapter may answer all at once.
- **Old saved views** are read through `movedGoals` (goals spec, rule 6): a pure function, no data change.

### 1.6 New goal, set-up and day one (onboarding)

- **Steps in the address** are routes only (`/goals/new/<step>`, `/workspace/new/<step>`); the draft store (`src/app/drafts.ts`) is unchanged.
- **"Getting started"** reads who set the workspace up and when (from the change log's first entry), what the viewer owns, and the `Prefs` port's values. It adds no record.
- **"Give {n} goals an owner"** needed, as first specified, a flag on a goal ("created at set-up with no owner chosen"). That is a new column. Section 4.3 removes it.

## 2. For each change: contract, kit stage, purity, drill

| Item | Contract test | Rebuild-kit stage | How `src/domain` stays pure | What the drill must still score |
|---|---|---|---|---|
| **AR1** The `Search` and `Prefs` ports | `searchContract` (`src/ports/contracts/search.ts`): the find spec's worked examples for rules 1 and 7 as cases; paging gives every row once and none twice; a key finds its goal in every kind that lists goals; a kind nobody registered is refused; people marked as left are never returned to a picker. `near` is optional: a store may never return it. `prefsContract`: a value set is read back for that person and workspace and nobody else. Both run against the browser adapter in `src/adapters/parts.test.ts` | `spec/rebuild/adapters.md` gains the two ports; `ports-at-scale.md`'s query port says `search` and the list calls are this contract, with open kinds | The matching, ordering, suggestions and near-miss rules are in `src/domain/find.ts`, given rows and returning rows. The port, the debounce and the stale-answer guard are in `src/ports` and `src/ui`. The lint gains the ban on reading the clock | Stage 1: 100%, unchanged (search is not in it). New conformance rows: `find.csv` (for each demo query in the specs: the kind, the ids returned in order). `npm run drill -- scripts/drill-faro` must score them at 100% |
| **AR2** Seven additions to the module contract | The manifest test (`src/core/module.test.ts`) checks each against `module.json`. CI's "Core journeys without metrics" must pass with: no Metrics row in the menu or More, no Metrics group in Find, no "Measured by" filter on Goals, nothing in `goal.facts`. A unit test of `menuFor`, `pageName`, `litItem` with and without a module's items | `stage-3-core-screens.md`: the menu, a page's name and the lit item are three rules of the viewer and the address. The module stage (`stage-4`) lists what the metric module registers | `menuFor`, `pageName`, `litItem`, `backTo` move from `Shell.tsx` and `BackLink.tsx` into `src/domain/navigation.ts`, taking the viewer, counts and the registry's facts, not screens | Stage 1 unchanged. Conformance rows for the navigation rules' examples (`navigation.csv`: viewer, address → menu rows, title, lit item) |
| **AS part 2** The records extension point | `storeContract` gains "a module's records are kept whole, saved with a commit, removed and restored with what they point to", run with a small test module's records against every adapter (browser, Supabase, plain Postgres: `src/adapters/stores.test.ts`). The manifest test fails a module whose `records` and `tables` disagree, and one whose `elsewhere` isn't empty of core files. CI builds without the module and loads a workspace that has its rows: nothing breaks, nothing is deleted | `stage-4-module-metrics.md` becomes the worked example of "a module with its own records"; `stage-2-core-data.md` says the core's tables are closed and modules bring theirs; `adapters.md` says an adapter iterates over declared records | The module's rules sit in its own folder under the same lint as `src/domain`. `src/domain` loses `metrics.ts` and its types: the core's rules no longer know a metric exists | Stage 1: 100%, and the conformance files must be byte-for-byte the same before and after the move (the metric records were never in them). The metric stage is an outline today (no rows); ML1 adds `metrics.csv` for its rules 1 to 3 |
| **AR3** One way to run an action | A unit test that every name on `ports-at-scale.md`'s action list is in the dispatcher's table and the reverse, so the page can't drift from the code (`src/spec/internal.test.ts` already holds R1's table to the actions; this adds the table). The existing action tests run through `run` | `ports-at-scale.md`: the command port's `run` is "this dispatcher, with a server behind it"; the sketch stops being only a sketch on the calling side | The actions are untouched: still `(context, input) → Commit`. The dispatcher is in `src/app`, outside the rules | Unchanged |
| **AR4** New rules take what they need | A lint (`scripts/check-layers.mjs`): no file added to `src/domain` or a module's rules after this item may take the whole-workspace type as a parameter; the 58 that do today are listed and may only shrink. A `reads` layer (`src/app/reads.ts`) is the one place that turns the loaded workspace into each rule's inputs | `ports-at-scale.md` gains a line: "new rules already take the query port's shapes; the 58 older ones are the work left" | It is the purity rule's next step: pure of the database already, now pure of "everything" | Unchanged; the conformance rows are the proof that narrowing an input changed no answer |

## 3. The order: architecture items in the build plan

Each sits just before the first screens that need it. The full plan, with these in place, is in `docs/design/README.md`.

| Item | What | Effort | Depends on | Just before |
|---|---|---|---|---|
| **AR1** | The `Search` and `Prefs` ports and their contracts; `src/domain/find.ts`'s rules 1 and 7; `find_goals` through the port; the clock ban in the lint (AS part 3, first half) | S–M | 8c (the ports pattern: done) | FS1, the first picker |
| **AR4** | The narrow-inputs lint and `src/app/reads.ts`. A convention and a check, not a refactor | S | Nothing | FS1 and GT1, the first new rules. Ride with AR1 |
| **AR3** | `app.run(action, input)` and the action table; per-action methods become aliases | S–M | Nothing | GT1, the first screen that adds buttons for ten actions |
| **AR2** | The seven additions to the module contract; the navigation rules moved to `src/domain` | S–M | AR1 (finders are search kinds) | GL1 with NV1, the first screens that need a menu group and a module's filter. The two people places arrive with WR1 |
| **AS part 2** | The records extension point; the metric module's records and rules moved into its folder | M | AR3 (the module's actions register in the table); 8c | ML1, the first metric screen |
| **AS part 3**, the rest | Scorecard words split from codes in conformance; one schema file generated into the kit; the "don't copy this" list; `api/mcp.js` built in CI | S–M | Nothing | FS4 and backlog item 11 (the full drill), at the end |

That is about three releases in all, spread through the plan. None of it is visible to people, so each commit says `[no news]`, and each still adds its section of `spec/` and its rebuild-stage notes.

**The architecture order in one line:** AR1 with AR4, then AR3, then AR2, then AS part 2, with AS part 3's remainder last.

## 4. Where the design should change

Said plainly. Each is a place where an area spec, as first written on 10 Nov, would cost more underneath than it is worth. The specs have been corrected to match.

### 4.1 Fewer new extension points

The area specs between them proposed eleven additions to the module contract. Each is a promise the core keeps for ever and the rebuild must copy. Four have no user today:

| Proposed | In | Recommend |
|---|---|---|
| `groups`: a module adds a way to group Goals ("By metric") | goals spec | **Cut.** Nobody asked for it. Add it when a module needs it |
| `steps`: a module adds a kind of row to Next steps and asks | goal spec | **Cut for now.** Its one user is backlog 3a (sent markups); 3a adds it when it is built |
| `history`: a module adds entries to a goal's History | goal spec | **Cut.** A module's changes to a goal are already entries in the core's change log; History shows the change log. The metric link shows as a change with no new mechanism |
| `newGoalCheck`: a module adds a row to New goal's Check step | onboarding spec | **Cut.** The `goal.measure` place already hands its choice back to the form; it hands back one line of words with it, which Check prints |

Seven remain (section 1.2), each with a user in this plan.

### 4.2 A module's filter is data, not code

The find spec first gave a module's Goals filter a `matches(row, value)` function. A server can't run a module's browser function over 30,000 summary rows. **Changed:** a filter is declared as a column of the goal's summary and how to compare it (`{ list: 'goals', id: 'metric', label: 'Measured by', param: 'metric', column: 'metricId', pick: 'metric' }`), and the module says how that column is filled for a goal. Faro's adapter compares the column; the internal app's server does the same in its own query.

### 4.3 No new field for "who owns this template goal"

The onboarding spec first marked goals "created at set-up with no owner chosen" with a flag, to drive day one's "Give {n} goals an owner". A flag on a goal is a column, a migration and a field every adapter carries, for a prompt that lives one week. **Changed:** set-up remembers the ids of the goals left without a chosen owner in the `Prefs` port, for the person who set up; the row counts those that are still owned by that person. Nothing is added to the records. In the internal app goals come from a planning round (R6c) with real owners, and the prompt doesn't exist.

### 4.4 New rules don't take the whole workspace

The area specs wrote several new rules with the loaded workspace as an input (`stepsAndAsks(goal, viewer, snapshot, week)`, `scopesFor(viewer, snapshot, last)`, `gettingStarted(viewer, snapshot, facts)`). That is the shape the deep review's A1 counts 58 times and R4 forbids, and it would make 70. **Changed (AR4):** each new rule takes only what it reads: the goal, its asks and next steps; the viewer's counts; the goals in a scope as summaries. `src/app/reads.ts` makes those from the loaded workspace today and from the query port in the rebuild. The worked examples in the specs stand; their first lines name narrower inputs. Where a spec's signature still says `snapshot`, read it as "what `reads` gives it".

### 4.5 No second way to raise a decision

The goal spec gave the owner a button "Ask for a decision or help" beside "Add a next step". Outside a check-in that is a new action, a new line in R1's table, and two ways to raise one thing. **Changed:** the button stays, and opens this week's check-in at its "What do you need?" step ("Check in again", scrolled there). One way to raise it; no new action. If Lane later wants it without a check-in, it is one action (`raiseRequest`, the goal's owner or an admin) added then.

### 4.6 Three things that stay, with a cost to know about

- **A search matches "the words on the row"** (find, rule 1). For goals that is the summary row's text: cheap anywhere. For Activity it is every sentence ever said: about 1.5 million entries a year at company size. Faro keeps it. **For the rebuild:** Activity's free-text search needs a person, a goal or a period chosen first; the find spec says so under "For the rebuild".
- **A near miss** (find, rule 5) needs every word in the list. Faro has them in memory. The contract makes it optional (`near` may never be returned), so a server without it still passes.
- **A metric's page shows its goals side by side** (metrics, rule 2). It is one `goals()` call filtered by the metric's column: cheap, once 4.2 makes the filter data.

### What does not need to change

Scope, group and the switch on Goals; one list of next steps and asks; the menu as a rule of the viewer; steps in the address; the re-base at the first check-in; a stage recorded as already done; "Getting started". Each maps onto the two ports as they are sketched, with no new record and no new action.

## 5. Decisions for Lane (added to the batch in `docs/design/README.md`)

The recommended answer is first.

- **A. The architecture items in the plan.** (a) Build AR1 to AR4 and AS part 2 where the plan places them, each just before the screens that need it. *Recommended.* (b) Build the screens first on what exists and do the architecture after (faster to see; the metric module then reaches further into the core before it is moved out). (c) Do all the architecture first, then the screens.
- **B. One way to run an action (AR3).** (a) Build the dispatcher in Faro before the goal page's buttons: it is the command port's shape in code a team will copy. *Recommended.* (b) Leave Faro's per-action methods; keep the command port as a sketch.
- **C. The cuts in section 4.** (a) Take all five: four extension points cut, a filter as data, no owner flag, narrow rule inputs, no second way to raise a decision. *Recommended.* (b) Take them, but keep "Ask for a decision or help" as its own action on the goal page.
