# The module map

What is in the core, what is a module, and what each module's switch turns off. Written 13 November 2026 for the five build tracks working through tiers 1–3 (`docs/handover.md`), so that two tracks building next to each other make the same call.

It follows Lane's two rules of 13 November (`CLAUDE.md`):

1. **Every distinct, self-contained feature is a module behind its own feature switch**, so a workspace can turn it off and the core still works. A feature that cannot be switched off says why in its spec.
2. **The handoff shows the internal team they can build Faro module by module:** the core first, then each module on its own, each with its spec section, conformance rows, rebuild stage and switch.

How it is built, and the extension points a module registers into, is `docs/architecture.md`; this page only decides what goes where. Where a decision was Lane's, the row says so.

**Decided by Lane, 13 November (1a–5a, relayed by planning):** tags are their own module behind a `tags` switch (1a); guardrails and measurement status are split, so the status rules never read a metric's records and work from core fields the module fills in (2a, 3a); FT2 and RS1 add a smoke run with every installed module switched off at runtime (4a); and FT3, moving reviews into `src/modules`, stays in the backlog (5a).

## The test for a module

One line, from the feature-switch design (`docs/design/feature-switches/README.md`): **a feature can be switched off if no core rule reads its records.** A number the core's rules turn on is a setting, not a switch.

So a feature is a module when all three hold:

- it brings records, screens or tools of its own;
- no rule in `src/domain` reads those records (the status rules, flags and needs attention, what a check-in must say, the change engine);
- the core's screens can draw themselves without it, through a place.

If a rule needs to know something a module knows, the module writes it onto a core field as it saves (as a metric link fills in a goal's unit), or the core rule takes it as an argument the way `src/domain/readBack.ts` takes `reviewsOn`. A core rule never reaches into `snapshot.modules`.

**A switch's name is its module's id.** There is no second register of switch names: `Workspace.modulesOff` holds module ids (`src/core/registry.ts`, `resolveModules`).

## 1. The core

The core is everything outside `src/modules`. It cannot be switched off because every part of it is read by a rule that judges a goal, or is the machinery every module registers into.

| In the core | What it holds | Why it can't be switched off |
|---|---|---|
| Goals and plans | `src/domain/goal.ts`, `plan.ts`, `range.ts`, `newGoal.ts`, `goalEntry.ts` | The thing every other part is about |
| Check-ins | `src/domain/checkin.ts`, `checkInDoors.ts`, `postCheckIn.test.ts`; the habit (`habit.ts`, the run and the receipt in `progress.ts`; HB1) | The week's loop; the status rules read them |
| Weeks, cycles and the year's end | `src/domain/cycle.ts`, `carry.ts`, `recarry.ts`, `startYear.ts` | A week number is the unit every rule counts in. The wrap-up's *words* may become a module; results, carrying on and starting the next year stay core |
| The status rules | `src/domain/status.ts`, `attention.ts`, `progress.ts`, `scorecard.ts` | They are what Faro is. The forecast is core with two settings: switching it off would change what "On track" means |
| People and teams | `src/domain/people.ts`, `directory.ts`, `levels.ts` | Every goal has an owner; every list is scoped by team |
| Asks and next steps | `src/domain/asks.ts`, `askHandover.ts` | `src/domain/attention.ts` and `changeset.ts` read them: flags and "Being handled" are asks. A core rule reads their records, so they fail the test |
| The change engine, the change log and undo | `src/domain/changes.ts`, `changeset.ts`, `commit.ts`, `removal.ts`, `activity.ts` | Every door (app, import, MCP) goes through it; undo and Recently removed carry a module's records for it |
| Proposed goals (GE10) | `src/domain/proposed.ts`, `proposedActions.ts`, `proposedSummary.ts` | `changeset.ts` reads the state, and Lane decided no switch and no workspace setting (21a, 11 November) |
| Find | `src/domain/find.ts`, `src/app/search.ts`, `src/ports/search.ts` | A module adds a finder to it; without it a module has nowhere to be found |
| Goals, Data and saved views | `src/screens/GoalsScreen.tsx`, `DataTables.tsx`, `src/screens/savedViews.ts` | The lists a module adds filters and tools to |
| Home's frame | `src/domain/home.ts`, `src/screens/Home.tsx` | It holds the `home.blocks` place; its own cells and blocks (Your goals, Your team, or with one team "The team’s goals", a set drawn as teams, rule 4's `homeSets`; Changed since, rule 5's `changedSince` over `home-seen`) read core records only, the Goals scopes' |
| Set-up and the first week | `src/screens/Onboarding.tsx`, `src/domain/dayOne.ts`, `arrival.ts`, `firstWeek.test.ts` | A workspace has to exist before a switch can be turned off |
| The module machinery | `src/core/module.ts`, `registry.ts`, `records.ts`, `app.tsx` | The places, the manifest, `resolveModules`, module records in save, carry, removal and the workbook |
| The spec and the kit | `src/spec/`, `spec/`, `llms.txt` | Generated from the code, modules included |

**Core, and staying core** (architecture readiness review, 11 November): the goal map, markup and the scorecard were looked at and left. The map and the scorecard read core records only; markup lives mostly in one folder and may move when something needs it to.

Of the features in the core today, Reviews (FT2), Watching, AI access (SW2), Feedback, the goal map and the wrap-up's own screens (SW1) are switches whose code is still in the core. Until their switch ships, each needs the sentence in its spec saying why it cannot be switched off — see fix item F1.

## 2. The modules

### Built

| Module | Switch | Needs | Off turns off | Stage |
|---|---|---|---|---|
| Metric library (`metrics`) | `metrics` | — | The Metrics menu row and `/metrics`; the goal form's "Measured by" and a goal's "Measured by" line; the goal page's and a person's and a team's metric sections; Goals' metric filter; the `metric` finder; seven AI tools (`list_metrics`, `get_metric`, `save_metric`, `remove_metric`, `retire_metric`, `merge_metrics`, `link_goal_metric`); five Help articles; the workbook's Metrics sheet and its Goals columns; "To sort out" on About. Its rows stay as they are | Module: Metric library |
| Spreadsheets (`spreadsheets`) | `spreadsheets` | — | Data's Spreadsheets menu, `/data/import` and the rest of import, Goals' "Export these goals", `export` and `export_table`, four Help articles, Past imports | Module: Spreadsheets |
| Watching (`watching`; SW1, a switch with its code still the core's) | `watching` | — | `/watching`, Goals' Watching tab, Home's "Goals you watch" and Getting started's row, the Watch button, "Watched by" and the bulk bar's Watch, `list_watching`, `watch`, `unwatch`, its Help article; `get_my_work` leaves out what is watched. Someone who owns no goal is led to every goal needing attention. Its read-back counts the watches kept | Module: Watching |
| Wrap-up (`wrap-up`; SW1, the same) | `wrap-up` | — | `/retro` and `/retro/:goalId`, Home's wrap-up lead and "See the wrap-up", Goals' Wrap up, Cycles' "Open the wrap-up", `get_wrap_up`, `wrap_up_goal`, its Help article. Results, carrying on and starting the next year stay core. Its read-back counts the wrap-ups kept | Module: Wrap-up |
| AI access (`ai-access`; SW2, a switch with its code still the core's) | `ai-access` | — | Every token at the server door (the MCP server answers only `initialize` and `tools/list`, and leaves a token's last use alone), making a token, the token lists on Workspace, Settings and People, `/workspace/ai` (Workspace → AI access, after Access, which now shows only who the admins are), `list_tokens`, `create_token`, `revoke_token`, its Help article. Revoking still works. Its read-back names the tokens kept. A build without the module refuses every token | Module: AI access |
| Goal map (`goal-map`; SW1, the same) | `goal-map` | — | Goals' Map layout (a link or view asking for it opens the List and says so); its Help article; no tools | Module: Goal map |
| Feedback (`feedback`; SW1, the same) | `feedback` | — | The Feedback menu row, `/feedback` and its old addresses, Send feedback, Mark up this screen and Ctrl+Shift+M, the seven inbox tools and `send_feedback`, its two Help articles. It acts at once: its read-back needs the builders' store counted per workspace (SW4) | Module: Feedback |
| Fields (`tags`; TG0: its tables and rule, no screens yet) | `tags` | — | Nothing yet: TG1 adds Workspace → Fields, a goal's Fields block and `list_fields`/`set_goal_fields`; TG2 the filters and the sheet's columns. The values stay while it is off | Module: Fields |

### Designed, not built

| Module | Switch | Needs | Off turns off | Where |
|---|---|---|---|---|
| Reviews | `reviews` | — | The Reviews menu row and phone tab, `/reviews…`; Home's "Next review" cell and its lead; a goal's "in {review}" and the review walk; Find's review group; eight AI tools; the Help article; the import's Notes sheet and Review column; the decision rule (`src/domain/decide.ts`) goes with it. History and Activity keep what reviews saved | FT2 then RS1 (track 4); FT3 moves the folder into `src/modules` |

**Two rules for every switch.** The switch's name is the module's id, every one is on by default, and none declares `needs`. A workspace that turns one off gets no menu row, no Home card, no MCP answer but the refusal, and one line in the import saying what was not read.

### The three sentences a new module must use

Already built, so copy them rather than writing new ones:

- **An AI tool, refused** (`src/mcp/tools.ts`): "{Name} is switched off in {workspace}, so {tool} can't be used there. An admin can switch it on in Workspace, under Features."
- **An action, refused** (`src/app/actions.ts`): "{Name} is switched off in {workspace}. An admin can switch it on in Workspace, under Features."
- **The module's address, while off** (`docs/design/feature-toggles/spec.md`): "**{Name} is switched off in {workspace}.** An admin can switch it on in Workspace, Features."
- **The import, once per file** (the reviews-switch design's shape, with the module's own nouns): "Reviews is off in {workspace}, so the Notes sheet and the Review column were not read." (naming only what the file has: `src/domain/sheets.ts`)

## 3. The items being built now

Each row says whether the item is a module of its own, part of an existing module, or core; and what that means for the track building it.

| Item | What it is | Switch | Needs | What turns off with it | Stage |
|---|---|---|---|---|---|
| **HB1–HB3** habit moment | **Core.** A rule over check-ins (the forgiving run, the receipt, the moment a goal reaches its target), read by Home and by a review | None | — | Nothing. With `reviews` off the words change ("on time, without being asked") and the short review goes: the core rule takes a flag, as `src/domain/readBack.ts` already takes `reviewsOn`. The habit must not import the reviews module | Core stages 1 and 3 |
| **NR1–NR3** readings | **Part of the metric library.** Readings exist because a metric has a source | `metrics` | `metrics` on; the core places `checkin.number` (the number step) and `checkin.table` (the one table), built in NR2 | With `metrics` off: no pre-filled number, no "From CI analytics, read 9:02 today" line, no override reason. The Check-ins sheet's three reading columns stay either way (they are the core's record of what was said) | The metrics stage |
| **PF1–PF2** leader's week | **Core.** A view of Goals (`view=week`), like any saved view | None | HM3, HM4 | Nothing. Its "This week, for these goals" entry is drawn only while `reviews` is on, so that entry belongs to the reviews feature, not to the view | Core stage 3 |
| **SM1–SM4** small workspaces | **Core**, by rule with no mode (Lane 1a, 13 November). No "start simple" preset of switches | None | SM3 needs ST2 | Nothing. SM1 adds `menu.waitsFor` to the manifest, so a module's menu row waits until it has something in it: every module.json gains the field, and hiding is only ever drawing | Core stage 3, and the manifest in each module's stage |
| **GE10** proposed goals | **Core.** Built | None | — | Nothing: the State column and `make_goal_active` are always there (Lane 21a, 11 November) | Core stages 1–3 |
| **GB** baseline and nothing else | **Core**, inside GE10's proposed state | None | GE10, BL | Nothing | Core stages 1–2 |
| **BL** baseline as a field | **Core.** Three nullable columns on the goal, read by the status rules | None | GE9 | Nothing | Core stages 1–2 |
| **MC** monthly cadence | **Core setting**, per goal or per metric, on FT1's field. Not a switch: the rules read it | None | FT1, FT4 | Nothing | Core stage 1 |
| **MI / MT6** the Metrics sheet in and out | **Part of the metric library**, read by the spreadsheets engine. The sheet and how its rows read back are declared by the module (`records.ts`, `module.json` `records`); the engine stays ignorant of what a metric is | `metrics` (and the sheet is only read while `spreadsheets` is on too) | Both modules on. **Neither declares `needs`**: a module that needed the other could not be switched off alone | With either off, the sheet is absent and the import says so once | The metrics stage |
| **MS** measurement status | **Split (Lane 3a, 13 November).** Measured / Partly / Gap, the library's view of it and its "To sort out" row are the metric library's. The goal side ("held to no number", no baseline needed) is a **core** rule over a core field the module fills in when the link is made | `metrics` for the library side; none for the goal rule | MT1, GB | With `metrics` off, no library view and no new Gaps; goals already marked keep their rule | The metrics stage, plus core stage 1 |
| **GR** guardrails | **Split (Lane 2a, 13 November).** A guardrail's limit and the status rule that reads it are **core** fields on the goal, because the status rules may not read a module's rows. Naming a metric for a guardrail is the metric library's contribution, through a place beside "Measured by" | None for the rule; `metrics` for naming a metric | MT2 | With `metrics` off, a guardrail can still be a number with a limit; it just can't name a metric | Core stage 1, plus the metrics stage |
| **MQ** metric structure | **Part of the metric library** (level, parent, confidence, how it could be gamed) | `metrics` | MT1, MI | With `metrics` off, all of it | The metrics stage |
| **TG** tags or custom fields | **Its own module** (`tags`; Lane 1a, 13 November): a workspace's fields are records of its own, nothing in `src/domain` reads them, and the design says explicitly they are not a place for status or anything a rule reads | `tags` | — (the field table is core) | The fields block on a goal, Workspace → Fields, Goals' filters and the saved-view parameters, its sheet columns, its AI tools, its Help article. Its rows stay | Its own stage |
| **FT1** check-in rhythm | **Core setting** (`Cycle.checkInWeeks`), not a switch | None | NV3, OB2 | Nothing | Core stage 1 |
| **FT2 + RS1** reviews as a switch | The `reviews` **switch**, with reviews' code still in the core until FT3 moves the folder | `reviews` | AR2, AR3; RS1 also needs HB1 and HB2 | See the reviews row above | Core stage 3 until FT3, then its own stage |
| **SW1, SW2** | The five remaining switches, the Features screen's four groups, and a CI job with every module off | `watching`, `ai-access`, `feedback`, `goal-map`, `wrap-up` | SW1 needs FT2; SW2 needs SW1 | See the rows above | Their own stages after FT3 |

Two seams worth naming, because two tracks meet at each:

- **RS1 and HB2** (tracks 4 and 1). The habit's words depend on whether reviews are on, and the habit is core. Pass the flag into the rule; do not let either side import the other.
- **MI and the import** (tracks 3 and 7c). The Metrics sheet reads back through the engine's existing kinds and levels. Add a reader to the module's declared sheet; do not add a metrics branch to `src/domain/importer.ts`.

## 4. Building it module by module

### The order

```
Core stage 1  the rules            (no screens, no database)
   └─ stage 2  the records, the change log, undo, the change engine
        └─ stage 3  the core screens and journeys
             ├─ Spreadsheets   needs the change engine (stage 2) only
             ├─ Metric library needs module records (stage 2) and goal units
             │    ├─ readings (NR)   needs the check-in's number place
             │    ├─ the Metrics sheet (MI)   reads back through the engine
             │    └─ structure (MQ), measurement status (MS)
             ├─ Reviews        needs asks (core) and the AR2/AR3 places
             │    └─ a leader's week's review entry (PF)
             ├─ Watching, Wrap-up, AI access, Goal map, Feedback   need the core only
             └─ Tags           needs the core's field table only
```

Nothing in the graph points from the core to a module, and nothing points between modules. A team can stop after stage 3 and have a working Faro.

**Don't write a stage number in prose.** The numbers after 3 are generated: `npm run spec` orders the modules by their `needs`, then by id, so adding a module renumbers the ones after it (`src/spec/rebuild.ts`). Name the stage ("the metric library's stage"), and let the generator number it.

### What each item owes the kit

From the rebuild kit rule (`CLAUDE.md`, in force since 8k): its module's section of `spec/`, its conformance rows, its rebuild stage in `module.json` (`rebuild`: status, builds, entry, exit, gaps), and the stage's drill where it has one. A core item extends stages 1–3 instead of adding a stage; it still owes the rules, the rows and the exit criteria.

### What CI proves, module by module

| Check | What it proves |
|---|---|
| `npm run lint:layers` (`scripts/check-layers.mjs`) | `src/domain` has no database, screen or network code; nothing outside `src/modules` imports a module; a module imports another only if it lists it in `needs`; a module's `rules*.ts` is as pure as the core's |
| `src/core/module.test.ts` | Each module.json matches its code: routes, places, Help, tools, requirements, journeys, migrations |
| **"Core journeys without {module}"** (`.github/workflows/ci.yml`, the `without` matrix over `src/modules`, `FARO_WITHOUT`) | The core builds and its journeys pass with the module left out of the bundle |
| `scripts/check-rebuild.mjs` | Every module has a rebuild stage |
| `npm run drill -- scripts/drill-faro` | The harness still scores Faro's own rules at 100% |
| `evals/touches.cjs` and module.json `journeys` | A change in a module's folder runs that module's journeys; a build without the module leaves them out |

Two gaps in that list, which the tracks adding switches have to close:

- **No job runs with a module switched off at runtime.** The `without` matrix proves absence from the build, not `modulesOff`. SW1's design already asks for a job with every module off; FT2 and RS1 need it sooner, because reviews' code stays in the core until FT3 and so `FARO_WITHOUT=reviews` cannot exist yet. Add a smoke run with every installed module switched off in the workspace.
- **Nothing checks the doors that are not the screen.** Three are wrong today (F2–F4): the export, the AI's Help and the AI's goal filter. One check that walks every door for a switched-off module (screen, action, tool, finder, filter, Help, export, import) belongs with SW1.

## 5. Fix items: what is merged and breaks the rules

In the order they matter. Each is small; none needs a design pass. A track that is already in the file should take it.

| # | What's wrong | Where | Suggested track |
|---|---|---|---|
| F1 | Reviews, Watching, Feedback, the goal map and the wrap-up are distinct features that cannot be switched off, and their spec pages don't say why. Lane's rule requires the sentence until the switch ships | `src/spec/`, the Features screen's "Goals, check-ins, reviews and people are always on" (`src/screens/Workspace.tsx`) | 4, with FT2 |
| F2 | The export writes a switched-off module's sheet. It passes every installed module's sheets, not the workspace's | `src/modules/spreadsheets/Export.tsx`, `src/modules/spreadsheets/tools.ts`, `src/domain/export.ts` | 3 |
| F3 | `get_help` lists a switched-off module's articles to the AI; the app hides them | `src/mcp/workTools.ts` | 4 |
| F4 | `find_goals` still filters by a switched-off module's column (`?metric=`) | `src/mcp/tools.ts` | 4 |
| F5 | `recordsOn` reads `modulesOff` directly instead of `resolveModules`, so a module off only because something it needs is off still counts as on. Nothing uses `needs` today, so nothing has noticed | `src/core/records.ts`; also `recarry` in `src/app/state.tsx`, which iterates every module's records | 7c |
| F6 | A core journey asserts a module's data: U115 (CARRY-GOALS) requires metric links to carry over, and it is not in the metrics module's `journeys`. It is not in the smoke set, so the "without metrics" job never runs it and CI is green while a build without metrics would fail | `evals/journeys.cjs`, `src/modules/metrics/module.json` | 7c |
| F7 | The core hard-codes a module's words: the `metric` finder's "Find by name, unit or owner" is in a core component instead of coming from the module's finder | `src/ui/Pick.tsx` | 2 |
| F8 | The MCP parity table hard-codes both modules' screens and tool names | `src/mcp/parity.ts` | 4 |
| F9 | **Done (NR1).** `NumberSource` and `SourcedMetric` are core ports for a module's concept. NR is about to build on them, so move them into the metric library (or rename them for numbers, not metrics) before it does | `src/ports/index.ts`, `src/ports/contracts/parts.ts` | 1, with NR1 |
| F10 | The save function hard-codes the metric library's tables, though 0039 added the generic `faro.module_tables` | `supabase/migrations/0038_workspace_check.sql`, `supabase/migrations/0039_module_records.sql`, `supabase/migrations/0040_module_rows_strict.sql` | 7c |
| F11 | The goal form's measure place carries a metric concept in a core type (`MeasurePick.metric`, "No metric"), and the core's module records name a metric ("measures", "goalMarks") | `src/core/app.tsx`, `src/domain/records.ts`, `src/screens/GoalWizard.tsx` | 7c |
| F12 | The spreadsheets module's Help names the Metrics sheet without declaring `needs`. Don't add the need (it would make metrics unswitchable on its own); word it for whatever sheets the build has | `src/modules/spreadsheets/help.ts` | 3 |
| F13 | The spec's samples and limits read `snapshot.modules.metrics` and list the module's file paths by hand | `src/spec/readsSamples.ts`, `src/spec/internal.ts`, `src/spec/limits.ts` | 7c |
| F14 | The walkthroughs and named flows hard-code the module id `spreadsheets` as a gate. The mechanism is fine; take the id from the manifest | `src/app/tours.ts`, `src/help/flows.ts` | 2 |

F1 to F6 are the ones that would embarrass the handoff: each is a place where "the core works without it" is not true, or not proven. F7 to F14 are tidying that keeps the next module honest.
