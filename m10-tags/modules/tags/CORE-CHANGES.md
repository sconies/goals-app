# Fields (tags): what the core needed

The core rebuild (stages 1 to 3, from kit 2fce09b4) had **no extension points, no `modulesOff`, no Features page, no
Workspace sections, no About on a goal, no Filters sheet, no saved views, no Data Goals table, no export or import screen
and no MCP server**. Every one of the stage page's entry criteria about the core was unmet, so a core that needed this
much for one module is itself the main finding. Core files changed: **2** (`app/server.mjs`, and `journeys/results.json`
rewritten by a rerun); core files added: **1** (`app/modules.mjs`). `main.mjs`, `engine.mjs`, `store.mjs`, `stage3.mjs`,
`readback.mjs`, `s1.mjs`, `shim.mjs` and `app/lib.mjs` are unchanged, and the drill still passes on and off.

| Core file | Change | Why |
|---|---|---|
| `app/modules.mjs` (new) | The extension points: loads `modules/*/module.mjs`; `on(W, id)` reads the workspace's `modulesOff`; the three switched-off sentences (page, action, tool); who owns a Workspace section, a tool, a Help article | Entry criterion 3 (“the core offers a Workspace section … and refuses a switched-off module's actions and AI tools”) |
| `app/server.mjs` | `core` handed to modules (the workspace, History's log, who is asking, an action's context) | A module saves and logs through the core, not around it |
| `app/server.mjs` | Help: a module's article takes the module's id (`/help/fields`) and leaves Help while it is off | “Help articles” row of the module's table; the help guide (“its Help … leaves”) |
| `app/server.mjs` | Goals: Filters is now a button and a `Filter goals` dialog (groups by name, Show the goals); a module's filter family (`f.`) adds rows and narrows the list; its filter line entries say “Stage is Build” with Remove; off, its parameters narrow nothing | Entry criterion 4; U177's steps name the dialog, the group and the button |
| `app/server.mjs` | Saved views: a Views menu with “Save this view…”, a dialog with Name and Save view; a view keeps the whole address | U177 (`SAVED-VIEWS`); the core listed saved views as not built (U70) |
| `app/server.mjs` | A goal's page has an About section (its facts, then `goal.sections`); History shows “via …” | “Fields block in About, after its facts”; History “via the spreadsheet” |
| `app/server.mjs` | Workspace: a Sections list (Features, then each live module's section); `/workspace/features` (admins switch a module off and on, logged); `/workspace/<id>` serves a module's section, or Page not found with the module-off sentence | Workspace sections extension point; criterion 9; TAGS-OFF |
| `app/server.mjs` | Data: a Goals table (`/data?t=goals`) with the core's columns and a module's; Export (one CSV Goals sheet) and Import (`/data/import`: Download the workbook, Choose a spreadsheet, a preview with the file line, Must fix, questions, Save N changes, `/data/import/done/imp_N`). The core's columns go through the stage 2 change engine; a module's through its sheet reader; columns neither reads are named once | U178, TAGS-SHEET. The Spreadsheets module (stage 9) isn't built, so this is the least host the journey needs: a CSV, not a workbook (GAPS T-12) |
| `app/server.mjs` | An unchanged goal name is not passed to the engine on import | The engine refuses G-48's 141-character name even when the file only repeats it, so no export round-trips (GAPS T-14) |
| `app/server.mjs` | `POST /mcp`: JSON-RPC `tools/list` and `tools/call`; the core's `find_goals` (scope, text, query, a module's argument); a module's tools, refused with the tool sentence while it is off; the person is the viewer | AI access (stage 4) isn't built, so there are no tokens (GAPS T-13) |
| `journeys/results.json` | Rewritten by rerunning `journeys/run.cjs` against the changed app (on its own port): still 13 DONE, 5 PART, the same journeys | Checking that the changed Goals and goal pages didn't break the core's scripted journeys |

Not changed, though the kit says the core does it: the store's module tables are declared by the module (`records.mjs`)
but the app keeps them in the in-memory workspace, as it keeps the core's; the database limits are checked by the
module's `saveRows` (criterion 4). There is no start of the next year in the core (U117 NOT BUILT), so the module's
`carry`, `markRemoved` and `restore` are tested on their own (criterion 8).
