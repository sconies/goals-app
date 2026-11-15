# Core changes for Watching (stage 11)

Eight core files changed. Each is generic (names no module) except the last, a test.

| File | Change | Why |
|---|---|---|
| `app/state.mjs` | Loads every `rebuild/modules/<id>/index.mjs`; a built module's facts replace its row in `INSTALLED`. The dispatcher lets a module pick its off sentence (`actionOffWords`), lets an action's result shape its log entry (`log`, e.g. `entity: 'watch'`), and does not log an unchanged result. | The core had no way to load a module from outside `app/modules/`. Watch and Stop watching must say “Watching is off in {workspace}.” (the core-action sentence), not the module-action one. U80 checks `entity === 'watch'`. |
| `platform.mjs` | `registry.scopes(on)`: a new extension point, Goals scopes a module adds. | Watching is a Goals tab (ONE-WATCHING). The kit lists no place for a Goals tab. |
| `app/pages.mjs` | Removed the core's “Goals you watch” block and `watchedGoalIds` (Watching now draws them in `home.blocks`). Goals tabs now come from `registry.scopes`, each placed before the tab it names. A scope can add a header. A remembered scope that is no longer offered opens Mine for an owner, else All. Added `.goals-page` and `filterbar-row` hooks. `goal.facts` and `goal.sections` are now given the viewer. About gets `class="about" id="about"`. Features: `features-group` class, a module's third line (`featureLine`), and a module's read-back dialog before it is switched off. | Moves Watching out of the core. Watch, Watched by and “Owners don’t…” depend on who is looking. Read-back and the third line are required by module-platform.md, but the kit gave no hook for them. |
| `app/server.mjs` | A module route may redirect (`to`, keeping the query). `/watching` is no longer a core route. An action result may redirect (`to`). Remembers the Goals scope in a cookie. Before switching off a module that has `offReadBack`, shows the read-back until it is confirmed. Help: the guide's “`id`, from the X module.” articles are filed under their module, so they show only while it is installed and on. | `/watching` opens `/goals?scope=watching`. The Watch sheet returns to the goal. The read-back runs before the switch. The core showed Watching's (and every module's) guide article as a core article, even while the module was off. |
| `home.mjs` | A stopped watch (`removedAt`) no longer counts as watching in the quiet line. | Stopping a watch keeps the record. |
| `main.mjs` | Runs each `modules/<id>/drill.mjs` to write that module's drill files. | `watching.csv`. |
| `drill.json` | Added `"watching"` to `also`. | Scores `watching.csv`. |
| `tests/journeys.mjs` | U2's “Goals you watch” check is skipped when the build leaves Watching out. | That check is Watching's. A core journey failed in a build without the module. The failure was there before this stage (the core's own block also asked `on('watching')`). |

Still in the core and asking `on('watching')`: Home's lead for someone who owns no goal while Watching is off (`home.mjs`), the “check-in for this week is late” reason (`pages.mjs` flagWords) and the page name of `/watching` (`screens.mjs`).
