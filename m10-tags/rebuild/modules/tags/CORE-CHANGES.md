# Core changes for Fields (stage 10)

Six core files changed. Each is a generic extension point the stage-3 core lacked, not a mention of Fields. (The stage 10 page's entry criteria say the core already has them: “a family of Goals filters”, “its columns on the Goals sheet”, Workspace sections drawn at /workspace/<id>. This core didn't. That is a finding about the stage-3 rebuild and about the kit, which points at src/ for them.)

| File | Change | Why |
|---|---|---|
| `app/state.mjs` | Finds modules in `rebuild/modules/<id>/index.mjs` (without naming them); a module's own facts replace its `INSTALLED` row; `run` passes `via` to a module's action and doesn't log again when the action says `logged` | The module lives in its own folder. Its changes are logged as History needs them (entity `field`, a goal id, “Stage: Discover → Build”), not as one generic `module` row |
| `app/pages.mjs` | `goal.sections` is given the viewer as well as the goal; Goals reads modules' filter families (`goalFilters`) and draws a Filters sheet (“Filter goals”, one group per module filter, “Show the goals”); a module's Workspace section draws its own page; `dataPage`: Data's Goals table (`/data?t=goals`) with modules' columns (`goalColumns`) | The place's input had no viewer, so “only the owner or an admin changes it in place” couldn't be drawn. The core had no Filters sheet, no way for a module's filter in, drew a section's link but not its page, and had no Goals table on Data |
| `app/server.mjs` | `/data` uses `dataPage`; a switched-off module's Workspace section is Page not found with its sentence | Before, `/workspace/<off section>` fell through to Workspace's About |
| `app/mcp.mjs` | A module may add an argument to a core tool (`toolArgs`, `toolArgSchemas`): listed in the tool's schema; while the module is off the call says the tool's sentence; while on, the module's test narrows the result. `find_goals` honours it | find_goals' `fields` (the platform page: “a core tool asked for what a switched-off module adds”) |
| `drill.json` | `run` is `node modules/tags/run.mjs` (main.mjs, then tags.csv); `also` adds `tags` | The harness scores tags.csv only from the run command's output |
| `tests/platform.mjs` | Its port can be set (`PLATFORM_PORT`) | Port 48933 was taken by another session; no behaviour change |

`main.mjs`, `platform.mjs`, the rules, the engine and the store are unchanged.
