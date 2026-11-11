# The metric library: what the screens call

The back end of backlog item 0b is built and tested: the rules, the data, the AI tools and the demo's metrics. The screens are not: the **Metrics page under Data** and **"Measured by" in New goal and goal edit** are to be built live. This page says exactly what they call, so the live build is screens only. Nothing here is UI code.

## The rules, in one paragraph

A metric needs a **name** (3 to 120 characters, no other metric in use has it, any case), a **unit** (up to 20 characters) and a **direction** (`higher` or `lower` is better). Optional: `meaning` (what it means and how it's calculated), `decimals` (0 to 4, default 0), `source`, `sourceOwner` (text), `refresh` (`live`, `hourly`, `daily`, `weekly`, `monthly`, `quarterly`, or null), `ownerId` (a person; default whoever adds it) and `caveats`. **Anyone adds** a metric; **its owner or an admin** changes or removes it. A goal is measured by **at most one** metric, for one **slice**: a team (`teamId`) or the whole company (`null`). **The goal's owner or an admin** links or unlinks it. The goal must have a number (not dated stages) **in the metric's unit**; aiming the other way from the metric's direction is a **warning**, not a refusal. The goal's own target is the target in the metric; nothing is copied. Full words and worked examples: `spec/modules/metrics/rules.md`. Left out on purpose: `spec/modules/metrics/growth.md`.

## The actions (`app.run`, registered by `actions.ts`)

Since AS part 2 the module registers its actions in the dispatcher's table (`src/app/actions.ts`, through the module registry); app state has no method for them. Each checks the rules, saves, logs, and shows the rule's own message when it says no (then throws, so a form can stay open).

| Call | Who | What it does |
|---|---|---|
| `app.run('saveMetric', input)` → `{ commit, metric }` (`metric.id` is the id) | anyone adds; owner or admin changes | `input` is `MetricInput & { id?: string }`. No `id`: a new metric. With `id`: fields given change, fields left out keep their value. Nothing is saved when nothing changed |
| `app.run('removeMetric', { metricId })` | owner or admin | Removes it and unlinks every goal it measures, in one save. Shows a message with **Undo** (puts both back). Restorable later from Workspace → Recently removed (kind `metric`), without its old links |
| `app.run('linkGoalMetric', { goalId, metricId, teamId })` | goal owner or admin | Measures the goal by the metric for a team, or the whole company when `teamId` is `null`. The same metric and slice again saves nothing |
| `app.run('unlinkGoalMetric', { goalId })` | goal owner or admin | Stops measuring it, with **Undo**. Saves nothing if it isn't measured |

## The records (`records.ts`, AS part 2)

The module's own records, not the core's: `Metric` and `MetricLink` (`types.ts`), declared in `records.ts` and listed under `records` in `module.json`. The workspace holds them under `modules.metrics` (`metricsOf(app.snapshot)`, `linksOf(app.snapshot)`); a commit carries them the same way (`metricRows({ metrics, metricLinks })`). The core's store, both database adapters, removal, restore, cycle scoping and the workbook keep them as `records.ts` says, without knowing what they are (`src/domain/records.ts`). Every field: `spec/modules/metrics/records.md`.

## The selectors (pure, `rules.ts`)

Read from `app.snapshot` (the open cycle, removed metrics already left out) and `app.viewer`.

| Call | Gives |
|---|---|
| `liveMetrics(app.snapshot)` | Every metric in use, by name: the Metrics page's list |
| `findMetric(app.snapshot, idOrName)` | One metric, by id or name (any case) |
| `goalsMeasuredBy(app.snapshot, app.snapshot.goals, metricId)` | The goals a metric measures: a count on the list, the list on its page |
| `measureOf(app.snapshot, goal)` | `{ metric, slice, target, targetText, link }` or `null`: what "Measured by" shows. `slice` is the team's name or "The whole company"; `target` is `{ value, kind }`, `kind` being `target`, `at most` or `at least`; `targetText` is it as every screen writes it (the numbers rule, `src/domain/numbers.ts`: "At most 2.0%", "Target 1,250 deploys"). Show it as given; don't round or format it again |
| `canEditMetric(app.viewer, metric)` | Whether to offer Edit and Remove |
| `canLinkGoal(app.viewer, goal)` | Whether to offer "Measured by" on a goal |
| `metricProblems(metricFrom(input, before, ctx), app.snapshot)` | The add/edit form's messages as someone types, before saving (`ctx` needs `actor`, `now`, `newId`: `{ actor: app.viewer, now: app.stamp(), newId }`) |
| `linkProblems(goal, metric)` | `{ errors, warnings }` for the picked metric, to show under the field before saving |
| `REQUIRED_FIELDS`, `OPTIONAL_FIELDS`, `METRIC_LIMITS` | Which fields are required, and the lengths, for the form's labels |
| `DIRECTION_LABEL`, `REFRESHES`, `REFRESH_LABEL`, `COMPANY`, `sliceName(app.snapshot, teamId)` | The words: "Higher is better", "Daily", "The whole company" |

## Where the screens go

**The Metrics page under Data.** Add `src/modules/metrics/app.tsx` default-exporting an `AppModule` (`src/core/app.tsx`), as `src/modules/spreadsheets/app.tsx` does:

- a route `{ path: '/data/metrics', element: <Metrics />, title: 'Metrics' }`;
- a way in from Data: the `data.tools` place (beside Columns, Saved layouts and Spreadsheets), a quiet link to the page.

Then, in the same change: list `/data/metrics` under `routes` and `data.tools` under `places` in `module.json`; add a Help article for the route in `src/modules/metrics/help.ts` and its id under `help`; add the screen to `SCREENS` in `src/mcp/parity.ts` (`Metrics: ['list_metrics', 'get_metric', 'save_metric', 'remove_metric']`); add its requirements to `evals/requirements.json` and `module.json`, and a journey. The screen file is `src/modules/metrics/Metrics.tsx` (a capitalised `.tsx` counts as a screen).

**"Measured by" in New goal and goal edit.** The core already has the place: `goal.measure` (`src/core/app.tsx`, `PlaceProps`). It renders after "How it's measured" in New goal (`src/screens/GoalWizard.tsx`, the "How it's measured" step) and after the name in goal edit (`src/screens/GoalEdit.tsx`, whole edit and "Improve the definition"). It's given:

- `goal`: the goal as saved, or `null` while it's new;
- `kind`, `unit`, `teamId`: the form's as typed (to filter metrics by unit, and offer the goal's team as the slice);
- `onChange(pick)`: one of the module's actions with its input for the goal as saved, `{ action: 'linkGoalMetric', input: (g) => ({ goalId: g.id, metricId, teamId }) }` to measure it by a metric (`teamId` null for the whole company) or `{ action: 'unlinkGoalMetric', input: (g) => ({ goalId: g.id }) }` for no metric (only for a goal that has one), or `undefined` to leave it as it is.

The form runs the pick straight after the goal (`app.run(pick.action, pick.input(goal))`). So the live build touches only the module:

1. The field, `src/modules/metrics/MeasuredBy.tsx`: start from `measureOf(app.snapshot, goal)` when there's a goal; pick a metric from `liveMetrics` (those in the form's unit first), or create one in place with `app.run('saveMetric', …)` (it gives back the metric); pick the slice (the goal's team, or the whole company); show `linkProblems` as you go; call `onChange`. Offer it only when `canLinkGoal(app.viewer, goal)` (a new goal is the viewer's own), and not for `kind === 'milestone'`.
2. Register it in `app.tsx` under `places: { 'goal.measure': MeasuredBy }`, and add `goal.measure` to `places` in `module.json`.
3. Add `MeasuredBy: ['link_goal_metric', 'list_metrics', 'save_metric']` to `SCREENS` in `src/mcp/parity.ts`.

The pickers use a plain search list for now (backlog 0a brings the shared find-and-pick control).

**The metric on a goal's page.** The `goal.sections` place already exists (it's given `{ goal }`, inside About this goal, after its facts). A module component there shows `measureOf(app.snapshot, goal)`: the metric's name, its meaning, the slice and the goal's target in it, and nothing when it's `null`. List `goal.sections` under `places` in `module.json`, and add the component (say `GoalMetric`) to `SCREENS` in `src/mcp/parity.ts` as `['get_goal', 'get_metric']`.

## Data, tools and the demo

- **Records:** `Metric` and `MetricLink` in `types.ts`, declared in `records.ts`; `modules.metrics.metrics` and `modules.metrics.metricLinks` in the workspace.
- **Tables:** `okr_metrics` and `okr_goal_metrics` (migration `0033_metric_library.sql`), written by the same save as everything else (`okr_write`, which takes them by table from `faro.module_tables` since 0039). The browser store keeps them with the rest.
- **Spreadsheets:** the workbook has a Metrics sheet (`sheet.ts`, declared in `records.ts`), for reading; it isn't loaded back.
- **AI tools:** `list_metrics`, `get_metric`, `save_metric`, `remove_metric`, `link_goal_metric` (`tools.ts`), and `restore_removed` with kind `metric`.
- **Demo:** 13 metrics in Platform Engineering (`demo.ts`, added by the demo builder through `records.ts`), 12 of them measuring a goal, set up before the year starts. Linking moves no number, status or date.
- **Tests:** `rules.test.ts` (the rules), `numbers.test.ts` (the demo's number source), `src/modules/metrics/tools.test.ts` (the tools), `src/data/rpc.test.ts` ("the metric library (0033)", the database).

## Traps found in the rehearsal (9 Nov)

- **Every capitalised `.tsx` in the module is a screen.** Each one (a form, a link, a field) needs an entry under `screens` in `help.ts` and a row in `SCREENS` in `src/mcp/parity.ts`, or `src/help/guide.test.ts` and `src/mcp/parity.test.ts` fail. Name them for what they show (`MetricsLink`, not `DataLink`). Small parts can live inside another screen's file instead.
- **Add and edit on the one route:** `/data/metrics?new` and `/data/metrics?m=<id>&edit`, so no more routes need Help articles.
- **Which teams use a metric:** each link's slice (`metricLinks`, `teamId`, named by `sliceName`); a company-wide link counts as "The whole company".
- **The new journey** takes the next free `U` number (`U53` after the rehearsal's branch; check `evals/journeys.cjs`) and is listed under `journeys` in `module.json`, so the module's evals pick it up.
- **Labels in journeys:** on `/data/metrics` the search box is labelled "Search metrics by name", so `getByLabel('Name')` matches it too. Use `{ exact: true }` and wait for the form's heading first.
- **Stay in the module.** A change to `src/core`, `src/app/state.tsx` or `rules.ts` is a rule change: it needs its own review, and it makes the evals run the full suite.

## Small things the second rehearsal had to work out

- **New goal has no goal yet.** `linkProblems(goal, metric)` needs a `Goal`; while the goal is new (`goal` is `null`), pass a stand-in built from the form (`{ kind: 'metric', unit }` plus a flat plan) so only the unit check applies; in goal edit pass `{ ...goal, unit } as Goal` with the typed unit.
- **Styles** go in `src/modules/metrics/metrics.css`, imported by `Metrics.tsx`. Hairline rows only (design check P6).
- **The Data link** is a screen too: `MetricsLink: ['list_metrics']` in `SCREENS`, and a `screens` entry in `help.ts`.
- **The Help article** goes in group `data`, `after: 'data'`, as the spreadsheets module's does.
- **The journey** sets all ten scores with `h.set`: entry, one-action, progress, budget, errors, finish, attention, parity, a11y, logged. Copy the spreadsheets module's journey (`U46` in `evals/journeys.cjs`) and change what it does.
- **Leave `evals/report.md`:** an eval run rewrites it; restore it (`git checkout evals/report.md`), don't commit it.
- **The rebuild stage** stays an outline in a live build: update the gap line in `module.json`'s `rebuild`; conformance rows and a drill come later.

## Before pushing the live build

On stage, steps 1 to 3, then push and open the pull request so Vercel builds the preview, then step 4 while CI runs. Off stage, all of it before pushing (CLAUDE.md's quality gate). Either way, nothing merges before step 4 passes.

Start with `npm ci` in a fresh session.

1. `npm run typecheck`, `npm test`.
2. `npm run spec`, and commit what it writes.
3. `npm run build:mcp` **last**, after every change to `help.ts`, `tools.ts` or anything they import: the server's help comes from `help.ts`, so a stale `api/mcp.js` turns CI's smoke check red.
4. Evals: a new journey in `evals/journeys.cjs` makes `npm run evals:changed` run the full suite (about 9 minutes). Run the smoke gate and only what the change touches instead:
   ```
   npm run evals:smoke
   git diff --name-only origin/main...HEAD | node -e 'const f=require("fs").readFileSync(0,"utf8").split("\n").filter(Boolean);const t=require("./evals/touches.cjs").touches(f);const j=t.ids.filter(i=>/^U/.test(i)),c=t.ids.filter(i=>!/^U/.test(i));console.log(`ONLY=${j.join(",")} CHECKS=${c.join(",")}`)'
   ONLY=<the journeys it prints, plus your new one> CHECKS=<the checks it prints> npm run evals
   ```
   `ONLY` takes journeys (`U…`), `CHECKS` takes checks (`F…`, `N…`, `P…`); `FINISH` with `ONLY=PLATFORM` runs nothing useful.
5. A What's new entry and the guide article for the new screen are part of the same commit.
