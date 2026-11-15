# Core changes made for the metric library (stage 7)

The core rebuild (stages 1 to 3) had no extension points, no `modulesOff`, no Features page and no MCP server. Each
change below is a finding: a module needed something the earlier stages should have built. Originals of the edited
files are in `rebuild/local/*.orig.mjs`.

| Core file | Change | Why | Should have come from |
|---|---|---|---|
| `core/modules.mjs` (new) | The module registry: `registerModule`, `loadModules` (reads `modules/*/module.mjs`, skips `FARO_WITHOUT`), `isOn` (off when `W.modulesOff` holds the id), `placesAt(place, …)`, `navModules`, `setModule` (flips `modulesOff`, calls the module's `onSwitch`), `offSentence`, `recordsOf`, `importNotesFor` | No extension points existed: no routes, places, nav slot, tools or switch a module could register into | Stage 3 (screens: places, routes, the nav slot) and stage 2 (records) |
| `core/mcp.mjs` (new) | A minimal tool door: `listTools` (every module's tools, on or off) and `callTool` (an off module's tool answers the module-off sentence; an unknown one “There’s no tool called …”) | The core had no MCP server, and the stage needs `save_metric`, `link_goal_metric` … at the same rules | Stage 4 (AI access) or stage 3; the tools page assumes one |
| `app/server.mjs` | Loads modules; registers their menu items; `ctx.navModules` / `ctx.moduleOf` for the menu and the lit item; module routes dispatched before the core's (an off module's address says it is switched off and who can switch it on); `/mcp` (GET lists, POST calls); `/workspace/features` (admins switch a module on or off); Workspace About's Features line and `workspace.about` place; `/more` lists module items; places `goal.facts`, `goal.sections`, `goal.measure` (New goal's measure step and the edit page), `people.person`, `people.team`, `checkin.number`, `checkin.done`; hooks `goalsFilter`/`goalsParams` (Goals' `?metric=`), `goalMarks` (the chart's `goal.marks` point), `checkinPrefill`/`checkinPost` (a reading in a check-in), `measurePost`/`measureProblems`/`readBackRows`/`goalPublished` (New goal), `editPost` (changing a goal), `onReset`; `/__reset` re-applies `FARO_MODULES_OFF`; `/__workspace` (GET, for tests) | Every place the module adds to a core screen (README: `goal.facts`, `goal.measure`, `goal.sections`, `people.person`, `people.team`, `checkin.number`, `checkin.table`) had no hook | Stage 3 should name the places as hooks and build them empty |
| `app/lib.mjs` | `registerMenuItem`, `menuLabel`, `menuHref`; `layout` passes `modules` and `moduleOf` to the menu; `status()` gains `class="status-shape" data-status="…"` | The `module:<id>` menu slot existed only for `example`; U170 finds a status by `.status-shape[data-status]` | Stage 3 (navigation's module slot as data, not one hard-coded id) |
| `app/help.mjs` | An article whose first line is “`<slug>`, from the <module> module” takes that slug as its id and remembers its module | Help showed every module's articles, on or off, under ids made from titles | Stage 3 (Help) |
| `stage3.mjs` | `litItem` asks `opt.moduleOf(parts)` before giving up (lights `module:metrics` on `/metrics…`) | Only `/example` could light a module item | Stage 3 (navigation rule 3) |
| `main.mjs` | After stage 3: applies `FARO_MODULES_OFF`, loads modules, and each on module writes its own conformance file (`metrics.csv`) | The drill writer had no way to add a module's file | Stage 3 / the drill contract (“also”) |

Not changed: the stage 1 rules, the change engine (`engine.mjs`) and the store (`store.mjs`). The goal's own
`unmeasuredSince` (stage 1's held-to-no-number rule) was already read by the status rule; the library only fills it in.
Stages 1 to 3 still PASS with the module in, on (`node spec/rebuild/drill.mjs rebuild`), off (`FARO_MODULES_OFF=metrics`)
and left out (`FARO_WITHOUT=metrics`): 45,083 of 45,083 rows and 14 of 14 store cases each. The core's 18 scripted
journeys tally as before (13 DONE, 5 PART).
