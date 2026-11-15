# Core changes for the Goal map (stage 6)

Three core files changed. Each is a finding: the platform had no place for a Goals layout.

| File | Change | Why |
|---|---|---|
| `app/state.mjs` | Installs `goalMapModule` beside `exampleModule`. `INSTALLED`'s facts are left out for a module that has code here, so `goal-map` is listed once. | A module has to be installed somewhere. `platform.mjs` already listed the Goal map's facts as a "switch", so without the de-duplication Features would show it twice. |
| `app/pages.mjs` (`goalsPage`) | A new generic extension: a module's `layouts: [{ id, label, offWords, draw(app, ctx, Q, url) }]`. Layout offers the core's four, then each layout whose module is on. A layout asked for while its module is off draws the List, says its `offWords` once, and drops `view` from the address (`history.replaceState`). A module that is left out says nothing. The page reads `view=` (the kit's address, e.g. `/goals?view=map`) as well as the core's old `layout=`, and its links write `view=`. | `module-platform.md` has no place for a Goals layout (`PLACES` has `goals.tools` only). The stage page says layouts are the core's and the map "draws them", and the journeys use `view=map`, but the stage-3 core used `layout=`. |
| `app/server.mjs` (Help) | Guide articles written as "`id`, from the X module." keep their id (the regex used to miss the comma, so the article became `the-goal-map`). They are tagged with their module and left out of Help while it is off. A link to one is Page not found with the platform's sentence. | The stage-3 core drew every module's Help article from `help-guide.md` as its own, so it showed "The goal map" with the module off (N22). This also corrects the other modules' guide articles. |

Not changed: `platform.mjs` (no new place; the layout is read from `app.registry.modules`), the store, the engine, the MCP server (the Goal map has no AI tools), and the core tests.
