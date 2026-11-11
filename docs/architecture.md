# Architecture: a modular monolith

Decided with Lane on 7 November 2026. Faro is one deployable app with one database, built as a small core plus feature modules. It is not split into microservices.

## The parts

| Part | What it holds |
|---|---|
| Core | People, teams, goals, plans, check-ins, the status rules, the vocabulary (`src/domain/vocabulary.ts`) and the change engine, including undo and history |
| Extension points | Pages, navigation, Home blocks, goal-page sections, settings, database tables, AI tools, Help articles, requirements and journeys |
| Feature modules | One folder each, with a manifest saying what it adds and what it needs. Examples: reviews, asks, Watching, the goal map, markup and inbox, spreadsheets, observability |
| Background jobs | Separate processes only where work runs on a schedule or after saves: summary rows (release 4b), alerts and the weekly review (release 5), and the AI assistant server (`api/mcp.js`). Each one reuses the shared rules and never restates them |

## Rules

- **Build new features as modules.** Every new feature is a module that registers into the extension points. It never edits the core to wire itself in.
- **One direction of dependency.** The rules layer (`src/domain`) has no database, screen or network code. Modules depend on the core; the core never depends on a module.
- **Declare dependencies.** A module lists the modules it needs in its manifest. For example, reviews need asks.
- **Switch features per workspace.** Each feature can be turned on or off for a workspace.
- **Prove it in CI.** CI builds Faro with each optional module removed and runs the core journeys.
- **Wrap the outside world.** The database, clock, sign-in and files each sit behind one interface, with a contract test any replacement must pass.

## Why not microservices

Faro is one product with one data model, and its features all read the same goals and check-ins. Separate services would add:

- network calls between features;
- copies of the same data;
- harder testing and debugging.

They would also make Faro harder for another AI to understand and rebuild. A module can still be lifted out into its own service later if a real need appears, because its boundary is already clean.

## How it's built (item 0, 8 Nov)

### The core and its extension points

The core is everything outside `src/modules`. It offers these extension points, and never imports a module:

| Extension point | How a module uses it | Where the core reads it |
|---|---|---|
| Routes | `routes` in `app.tsx` (path, element, `focus`, `title`, and `name(params, reads)`: the page's name from its thing, AR2); old addresses in module.json `redirects` | `src/App.tsx`, `src/ui/Shell.tsx` (title, focus mode) |
| Navigation | `navigation` in `app.tsx`, each with a `group` (AR2): `work` after Reviews, `lookup` (the default) after Data; also in More on a phone. The menu, the lit item and a page's name are rules (`src/domain/navigation.ts`) | `src/ui/Shell.tsx` |
| Home blocks | the `home.blocks` place | `src/screens/Home.tsx`, after Watching |
| Goal-page sections | the `goal.sections` place, given the goal | `src/screens/GoalScreen.tsx`, before Activity |
| Workspace sections | `sections` in `app.tsx` (id, label, summary, `admins`, element, `after`); module.json `sections` lists the ids. Each is at `/workspace/<id>`, in Workspace's menu (a side menu on a computer, a list on a phone), with a Help article whose route is that address (backlog W, 8 Nov) | `src/screens/Workspace.tsx` (`useSections`), `src/App.tsx` (the routes) |
| Places on other core screens | `data.tools` (Data's toolbar, given the open table as laid out) and `goals.tools` (Goals' Views menu and the phone's View sheet, given the goals shown) | `src/screens/DataTables.tsx`, `src/screens/GoalsScreen.tsx` |
| The goal forms' "Measured by" field | the `goal.measure` place (backlog 0b, 8 Nov): given the goal as saved (null while new), the form's kind, unit and team, and `onChange(pick)`. The form saves the pick after the goal (`app.linkGoalMetric`, or `app.unlinkGoalMetric` for null); with no module in it, nothing renders and nothing extra is saved | `src/screens/GoalWizard.tsx` (after “How it’s measured”), `src/screens/GoalEdit.tsx` (after the name) |
| A person's and a team's page in People | the `people.person` place (given the person) and the `people.team` place (given the team), app redesign WR1, 10 Nov: after the person's facts, and after the team's people. With no module in them, nothing renders | `src/screens/People.tsx` (`PersonPage`, `TeamPage`) |
| A line in a goal's summary | the `goal.facts` place, given the goal: one short line each ("Measured by …") (GT1 and AR2) | `src/screens/GoalScreen.tsx`, the summary |
| Finders | `finders` in `app.tsx` (kind, nouns, a search, where a row opens); module.json `finders`, by kind. The kind answers find-and-pick and Find through the `Search` port; with the module off it is gone (AR2) | `src/app/search.ts` |
| Filters on a core list | `filters` in `app.tsx`, declared as data: `{ list: 'goals', id, label, param, column, pick }`, a column of the summary rows compared with what is picked, so a server can apply it (AR2; docs/design/architecture.md 4.2); module.json `filters`, by id | the Goals list (GL1) |
| Things to sort out without a section | `toSortOut(snapshot, viewer)` in `app.tsx`, giving the same `WorkspaceNeed`s a section's `needs` gives (WR2), for a module with no Workspace section; module.json `toSortOut: true` (AR2) | `src/screens/Workspace.tsx`, About's "To sort out", after the sections' |
| Database tables | module.json `tables`: name, migration, purpose. Migrations still live in `supabase/migrations` | the manifest test checks the migration exists |
| AI tools | `tools.ts` default-exports `ToolDef[]` | `src/mcp/tools.ts` adds them to `TOOLS`; `callTool` refuses one whose module is off in the workspace |
| Help articles | `help.ts` default-exports `Article[]`, each with `after` (the article it follows) | `src/help/guide.ts` merges them into `ARTICLES`; Help hides a switched-off module's articles |
| Requirements | module.json `requirements`: ids in `evals/requirements.json` | the scorecard, as for any requirement |
| Journeys | module.json `journeys`: the U, F and N checks that need the module | `evals/run.mjs` leaves them out when the module is; `evals/touches.cjs` runs them when its folder changes |

The places and what each one is given are typed in `src/core/app.tsx` (`PlaceProps`). A core screen renders `<Place name="…" … />`. To add a place, add its name to `PLACES` in `src/core/module.ts` and its props to `PlaceProps`, then render it on the screen.

### A module

One folder, `src/modules/<id>/`:

| File | What it is |
|---|---|
| `module.json` | The facts, as plain data (`ModuleFacts` in `src/core/module.ts`): id, name, summary, `needs`, routes, redirects, navigation, places, `sections` (optional), tables, aiTools, help, requirements, journeys, and `rebuild`: its stage in the rebuild kit (`status` drill or outline, what it `builds`, `entry` and `exit` criteria, and the `gaps` the kit doesn't cover yet; typed as `ModuleRebuild` in `src/spec/rebuild.ts`). Generators read this without running anything (`npm run modules` lists them; `npm run spec` writes the stage to `spec/rebuild/`; CI fails a module without one) |
| `app.tsx` | Optional. Default-exports an `AppModule`: its routes, navigation and what it puts in each place |
| `help.ts` | Optional. Its Help articles. Pure data |
| `tools.ts` | Optional. Its AI tools |
| anything else | Its screens and code. A capitalised `.tsx` counts as a screen, so it needs a Help article and an MCP parity entry |

The build makes the registry (`vite.modules.ts`): every folder with a module.json is installed. The core reads them through `virtual:faro-modules` (facts), `/help`, `/tools` and `/app`. Use `src/core/registry.ts` (no screens; the server uses it too) and `src/core/app.tsx` (`useModules`, `Place`).

### Switching per workspace

- `Workspace.modulesOff` lists the modules an admin has switched off, by id (`okr_workspaces.modules_off`, migration 0030).
- A module is on when it is installed, not switched off, and everything in its `needs` is on (`resolveModules`).
- The rule is `domain/actions setModule`: admins only, and the change is logged.
- Admins switch modules on Workspace, under Features, or with the `set_feature` AI tool.
- Off, a module has no route, navigation item, place, Help article, walkthrough or named flow, and its AI tools say it's off. Nothing it saved is deleted.

### What keeps it so

- **The layers lint** (`npm run lint:layers`, `scripts/check-layers.mjs`; also in `npm test` and CI):
  - `src/domain` imports only `src/domain` and uses no browser, network or storage;
  - nothing outside `src/modules` imports a module;
  - a module imports another only if it lists it in `needs`;
  - only `src/adapters/supabase/` imports Supabase (8c).
  - browser storage (`localStorage`, `sessionStorage`, `indexedDB`) only in `src/adapters` and `src/ports`, apart from the shrinking list in `scripts/browser-storage.json` (AX9; shown in `spec/rebuild/adapters.md`).
- **The manifest test** (`src/core/module.test.ts`) checks each module.json against its code: routes, places, help, tools, requirements, journeys and migrations.
- **The spec** (`spec/`, `llms.txt`; `npm run spec`, items 8a and 8b) is generated from the code: `spec/core/` for the core, `spec/modules/<id>/` from each module.json, and `spec/conformance/` with what the rules give for every goal in every week of the demo. `src/spec/spec.test.ts` and CI's spec step fail when it is out of date; `src/spec/conformance.test.ts` recomputes the conformance rows.
- **CI's "Core journeys without <module>" job** builds Faro with `FARO_WITHOUT=<module>` (that module, and anything that needs it, left out of the bundle). It then runs the smoke gate without the module's journeys. It runs for every folder in `src/modules`.

### Adding a module

1. Make `src/modules/<id>/module.json`. Copy `src/modules/spreadsheets/module.json` and change every field.
2. Put its code in the folder. Wire it in through `app.tsx`, `help.ts` and `tools.ts`, never by editing a core screen. If it needs a place that doesn't exist yet, add the place to the core as above.
3. Give each route a Help article (in `help.ts`). Add its requirements to `evals/requirements.json` and write its journeys.
4. If it has tables, add a migration in `supabase/migrations`, and list the tables in module.json.
5. Run `npm test` and `npm run lint:layers`. Then run `FARO_WITHOUT=<id> npm run evals:smoke` to prove the core works without it.

Moving an existing feature works the same way. Move its files into the folder, then replace the core's direct imports with places, routes and tools. Spreadsheets (Data's Spreadsheets menu, Import at `/data/import`, Goals' Export these goals, the `export` and `export_table` tools) is the worked example.

## Running an action (backlog RD, AR3, 10 Nov)

Every change a person makes goes one way: `app.run(action, input)` (`src/app/state.tsx`), over one table of actions (`src/app/actions.ts`). The input names records by id (`run('addAction', { goalId, text, assigneeId, dueWeek })`); the dispatcher sets who acts, when and new ids, runs the shared rule from `src/domain` unchanged, saves the `Commit` it returns, and shows Undo after a removal. A rule that says no is shown, not saved. `planChanges` previews and saves only with `apply`.

- The per-action methods on `AppState` (`app.addNote`, `app.stopGoal` and the rest) are aliases of it. New code calls `run` directly.
- The table's names are the command port's ([the ports at company scale](../spec/rebuild/ports-at-scale.md)): `src/app/actions.test.ts` fails if the table and R1's access table disagree. A new action is a row in each.
- It is the shape a team copies: to move the rules to a server, replace the dispatcher's body with a call to it, and keep the names and inputs. It doesn't make Faro's saves trustworthy; the browser still runs the rule.

## The outside parts (item 8c, 9 Nov)

Everything Faro needs from outside its own code sits behind one interface in `src/ports/`, each with a contract test any replacement must pass (`src/ports/contracts/`): the goals store (`Store`), markups (`MarkupStore`), feedback (`FeedbackStore`), who is viewing (`Identity`), the time (`Clock`), files (`Files`) and where a metric's numbers come from (`NumberSource`). The adapters live in `src/adapters/`: `supabase/` (the real app's, and the only code that imports Supabase), `postgres/` (the goals store on plain Postgres, after `bootstrap.sql` and the same migrations), `demo/` (the demo's number source) and `local.ts` (the picker, the clocks, files in memory). `src/adapters/stores.test.ts` and `parts.test.ts` run every contract on Faro's adapters; Supabase's run on a stand-in for its client over real Postgres (PGlite), so they need no network. How to write one for another platform: `spec/rebuild/adapters.md`.

## The database: fenced off in a shared project (item 0c, 10 Nov)

Faro's Supabase project (family-hq) also holds another app's real family data, so Faro keeps to its own schema:

- **Its own schema.** Every table, view and function is in `faro` (migration 0035). Later migrations use plain names: they run with `search_path` faro, as the Faro role.
- **Its own role.** `faro_owner` (`supabase/manual/faro-role.sql`) owns `faro` and has no rights on any table outside it, nor on storage or auth. CI's `DATABASE_URL` is that role, and CI's migrate job runs `scripts/check-fence.mjs` before migrating: it fails if the role can read or write any table outside `faro`. It also fails if anything in `faro` belongs to another role, if a pg_cron job runs Faro's code as another role, or if the role may run a security definer function outside `faro` and the platform's schemas. It reads the catalog only and prints counts, never another app's names. Nothing in `faro` reads outside it (0036): the pictures check asks Storage, and the nightly telemetry roll-up is a CI job (`.github/workflows/nightly.yml`), not pg_cron. How to write a migration now: `supabase/README.md`.
- **Its own requests.** The app and the MCP server use the public key only, never the service role key, and ask the Data API for `faro` (`src/adapters/supabase/client.ts`). Until the Data API offers `faro`, they fall back to the redirects 0035 left under the old names in `public` (views with `security_invoker`, and functions that call the ones in `faro`, all marked `faro: redirect`). Backlog 0c2 removes both.
- **Reset and export.** `npm run faro:reset -- --yes` writes every row of `faro` to `faro-exports/` and then deletes every workspace by the database's own rule (the builders' inbox stays). `npm run faro:export` writes the rows only. Each workspace also downloads as a spreadsheet from Data.
- **The pictures' bucket** stays in Supabase's `storage` schema with every other bucket (a bucket can't move). Its upload rule admits only the four pictures in a folder named like a markup id, and calls nothing in `faro` (0037), so the Faro role can't change what Storage lets through. Reading Faro's tables as postgres (the dashboard) runs whatever `faro_owner` put behind them: `set role faro_owner` first (`supabase/README.md`).

## Where it stands

- **Done (item 0, 8 Nov):**
  - the pattern above;
  - spreadsheets, the first module;
  - the layers lint;
  - the CI job that runs the core without each module;
  - the three rules files that reached into the data layer: `Commit` now lives in `src/domain/commit.ts`.
- **Next:** the metric library becomes a module with its own records and rules (AS part 2), the proof that a feature with records of its own can be added without editing the core.
- **Core, and staying core** (architecture readiness review, 11 Nov): reviews, asks, Watching and the map. Moving reviews (about 90 files across nine folders) would teach a rebuild nothing the metric library won't. Markup lives mostly in one folder and may move when something needs it to.
