# Core changes the Metric library needed

Five core files changed (state.mjs, server.mjs, pages.mjs, platform.mjs, drill.json); each change is generic (no file names the module). Copies of the core before are in `local/app.core.bak` and `local/platform.core.bak`.

| File | Change | Why |
|---|---|---|
| `app/state.mjs` | Loads every `modules/<id>/module.mjs` beside the core; a module with code replaces its facts row in `INSTALLED` (no duplicate `metrics`). | The core only knew `exampleModule`, by import: a new module had no way in without the core naming it. |
| `app/state.mjs` | `hook(name)` and `ask(name)`: after a goal save (`onGoalSaved`, with the New goal draft), after a check-in (`onCheckIn`), before a check-in (`checkInProblems`, which can refuse), and on a switch (`onSwitch`). | A goal’s link is saved with the goal’s form, a reading with its check-in (rule 3 refuses at the form), and switching the library off lets go of held goals (rule 11). The platform has no extension point for “after a core save”. |
| `app/state.mjs` | `FARO_OFF=<ids>` starts the app with those modules off. | To run the core journeys with the module switched off (the drill’s rule). |
| `app/state.mjs` | `if (input.stages) row.Stages = …` moved after `row` is defined. | A core bug found on the way: a milestone check-in with stages threw a ReferenceError. |
| `app/server.mjs` | Module routes may hold `:params`; `page()` gets `{ url, params, path }` and may return `{ redirect }` or `{ status, name, body }`; an action may return `{ redirect }`; the check-in post passes its form; New goal passes its draft to `saveGoal`. | A page per metric (`/metrics/<slug>`), the old `/data/metrics` addresses leading on, a page’s own name, and the hooks above. |
| `app/pages.mjs` | `goal.measure` is drawn first on the measure step (it was last); `checkin.number` is drawn (it was declared, never drawn) in place of the plain field; `goal.sections` is drawn after About (declared, never drawn); `workspace.about` is drawn on Workspace → About. | Exit criteria 12, 19, 15 and 13. |
| `platform.mjs` | `workspace.about` added to `PLACES`. | Workspace → About tells admins how many metrics have no owner. |
| `drill.json` | `run` is `node modules/metrics/drill.mjs` (which runs `main.mjs`, then writes `metrics.csv`), and `metrics` is under `also`. The core’s own is kept in `local/drill.core.json`. | The harness scores metrics.csv from the same command. |
