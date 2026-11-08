# The metric library: what the screens call

The back end of backlog item 0b is built and tested: the rules, the data, the AI tools and the demo's metrics. The screens are not: the **Metrics page under Data** and **"Measured by" in New goal and goal edit** are to be built live. This page says exactly what they call, so the live build is screens only. Nothing here is UI code.

## The rules, in one paragraph

A metric needs a **name** (3 to 120 characters, no other metric in use has it, any case), a **unit** (up to 20 characters) and a **direction** (`higher` or `lower` is better). Optional: `meaning` (what it means and how it's calculated), `decimals` (0 to 4, default 0), `source`, `sourceOwner` (text), `refresh` (`live`, `hourly`, `daily`, `weekly`, `monthly`, `quarterly`, or null), `ownerId` (a person; default whoever adds it) and `caveats`. **Anyone adds** a metric; **its owner or an admin** changes or removes it. A goal is measured by **at most one** metric, for one **slice**: a team (`teamId`) or the whole company (`null`). **The goal's owner or an admin** links or unlinks it. The goal must have a number (not dated stages) **in the metric's unit**; aiming the other way from the metric's direction is a **warning**, not a refusal. The goal's own target is the target in the metric; nothing is copied. Full words and worked examples: `spec/modules/metrics/rules.md`. Left out on purpose: `spec/modules/metrics/growth.md`.

## The actions (on `useApp()`, `src/app/state.tsx`)

Each checks the rules, saves, logs, and shows the rule's own message when it says no (then throws, so a form can stay open).

| Call | Who | What it does |
|---|---|---|
| `app.saveMetric(input)` → `Promise<string>` (the id) | anyone adds; owner or admin changes | `input` is `MetricInput & { id?: string }`. No `id`: a new metric. With `id`: fields given change, fields left out keep their value. Nothing is saved when nothing changed |
| `app.removeMetric(id)` | owner or admin | Removes it and unlinks every goal it measures, in one save. Shows a message with **Undo** (puts both back). Restorable later from Workspace → Recently removed (kind `metric`), without its old links |
| `app.linkGoalMetric(goal, metricId, teamId)` | goal owner or admin | Measures `goal` by the metric for a team, or the whole company when `teamId` is `null`. The same metric and slice again saves nothing |
| `app.unlinkGoalMetric(goal)` | goal owner or admin | Stops measuring it, with **Undo**. Saves nothing if it isn't measured |

## The selectors (pure, `src/domain/metrics.ts`)

Read from `app.snapshot` (the open cycle, removed metrics already left out) and `app.viewer`.

| Call | Gives |
|---|---|
| `liveMetrics(app.snapshot)` | Every metric in use, by name: the Metrics page's list |
| `findMetric(app.snapshot, idOrName)` | One metric, by id or name (any case) |
| `goalsMeasuredBy(app.snapshot, metricId)` | The goals a metric measures: a count on the list, the list on its page |
| `measureOf(app.snapshot, goal)` | `{ metric, slice, target, link }` or `null`: what "Measured by" shows. `slice` is the team's name or "The whole company"; `target` is `{ value, kind }`, `kind` being `target`, `at most` or `at least` |
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

**"Measured by" in New goal and goal edit.** These are core screens (`src/screens/GoalWizard.tsx`, `src/screens/GoalEdit.tsx`), so the field comes in through a new place, as `docs/architecture.md` says ("To add a place"):

1. Add `'goal.measure'` to `PLACES` in `src/core/module.ts`, and its props to `PlaceProps` in `src/core/app.tsx`: the goal as saved (`Goal | null` for a new one), the form's current `kind`, `unit` and `teamId`, and `onChange(pick: { metricId: string; teamId: string | null } | null | undefined)` (`undefined`: left as it is; `null`: no metric).
2. Render `<Place name="goal.measure" … />` in each form, after the unit. With the module off it renders nothing and `onChange` is never called.
3. Each form keeps the pick in its state and, after `await app.saveGoal(...)` succeeds, calls `app.linkGoalMetric(goal, pick.metricId, pick.teamId)` or, for `null`, `app.unlinkGoalMetric(goal)`. The wizard knows the new goal's id before saving (`buildGoal(..., { id })`), so the link follows the goal straight away. Two log entries: the goal's, then "Measured by …".
4. The field itself (`src/modules/metrics/MeasuredBy.tsx`) is the module's: pick a metric from `liveMetrics`, or create one in place with `app.saveMetric` (it returns the id), pick the slice (the goal's team, or the whole company), and show `linkProblems` as you go. Add `MeasuredBy: ['link_goal_metric', 'list_metrics', 'save_metric']` to `SCREENS` in `src/mcp/parity.ts`, and `goal.measure` to `places` in `module.json`.

The pickers use a plain search list for now (backlog 0a brings the shared find-and-pick control).

**The metric on a goal's page.** The `goal.sections` place already exists (it's given `{ goal }`, after the page's own sections, before Activity). A module component there shows `measureOf(app.snapshot, goal)`: the metric's name, its meaning, the slice and the goal's target in it, and nothing when it's `null`. List `goal.sections` under `places` in `module.json`, and add the component (say `GoalMetric`) to `SCREENS` in `src/mcp/parity.ts` as `['get_goal', 'get_metric']`.

## Data, tools and the demo

- **Records:** `Metric` and `MetricLink` in `src/domain/types.ts`; `snapshot.metrics` and `snapshot.metricLinks`.
- **Tables:** `okr_metrics` and `okr_goal_metrics` (migration `0033_metric_library.sql`), written by the same save as everything else (`okr_write`). The browser store keeps them with the rest.
- **Spreadsheets:** the workbook has a Metrics sheet (`src/domain/columns.ts`, `METRICS`), for reading; it isn't loaded back.
- **AI tools:** `list_metrics`, `get_metric`, `save_metric`, `remove_metric`, `link_goal_metric` (`tools.ts`), and `restore_removed` with kind `metric`.
- **Demo:** 13 metrics in Platform Engineering (`src/data/platformOrg/metrics.ts`), 12 of them measuring a goal, set up before the year starts. Linking moves no number, status or date.
- **Tests:** `src/domain/metrics.test.ts` (the rules), `src/modules/metrics/tools.test.ts` (the tools), `src/data/rpc.test.ts` ("the metric library (0033)", the database).

## Before pushing the live build

`npm run typecheck`, `npm test`, `npm run spec` (and commit what it writes), `npm run evals:changed`; a What's new entry and the guide article for the new screen; `npm run build:mcp` only if `tools.ts` or anything it imports changed.
