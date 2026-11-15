# Stand-in rebuild: stage 10, Fields (tags) (drill item 11)
(Saved by the drill session from the builder's reply, condensed.) Run: `npm run build:standin && node platform/prove-tags.mjs [port] [in|out]`. Fields checks 49/49 in, 6/6 out; core 36/36 both ways.

## (a) Ported as-is
All of src/modules/tags/ unchanged (rules, records, tools, actions, screens, sheet, filter, help, conformance). SQLite store already keeps module rows; /mcp already loads module tools; list_fields, set_goal_fields, save_field, find_goals' fields work unchanged.

## (b) Rewired (9 files, +474 −5; 3 existing Faro files, 6 lines)
| Area | Files | Why |
|---|---|---|
| Build | package.json (+1 −1) | tags in; STANDIN_WITHOUT |
| Registry | vite.modules.ts (+2 −1), src/core/virtual.d.ts (+4) | new `virtual:faro-modules/guard`: each module checks its own rows, core never names a module (the metrics build made a similar `platform` part independently) |
| Server access | src/modules/tags/guard.ts (81), standin/guard.ts (+13 −1), server.ts (+1 −1) | each save's Fields rows checked with the module's rules; off → switched-off sentence; left-out module rows refused |
| Migration | 0003_tags.sql (40) | Faro's DB limits from 0052/0054 (name 1–40, kind, values by kind, value ≤80, id = goal:field); SQLite remakes tables to add limits |
| Proof | tags.test.ts (14), prove-tags.mjs (236) | |

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Only admins define fields | NAMED | tags rules.md:23, :67 |
| Goal's owner or admin sets values (not its proposer) | NAMED | rules.md:23 |
| Refusal wording | NAMED | rules.md:29 |
| Database limits | NAMED as Postgres CHECKs only | schema.sql:26-27, 43-46 |
| How a server checks a module's own rows | GAP | adapters.md:39-41; no hook for a module |
| Values on copied or removed goals (next year, leaving, undo), and while off | GAP | |
| A list value goals still hold after the list changes | GAP (minor) | fields.ts |
| Rows of a module left out of the build | GAP | module_tables accepts them whatever the build |
| Off sentence wording | GAP (minor) | stage "Workspace, Features" vs code "under Features" |
| Files, jobs | none | |

## (d) Behaviour
typecheck, layers pass; npm test 2,220 pass (3 spec.test.ts timeouts under load pass alone 19/19); drill 100%, tags.csv 25/25, contracts 56/56.
| Exit | Result | Evidence |
|---|---|---|
| 1 | MET | |
| 2 U174, U177, U178, N34 | MET | /demo: U174, U177 10/10 (others out), U178 10/10 (all in), N34, P5 pass |
| 3 rules, tags.csv | MET | |
| 4 database refuses | MET | tags.test.ts |
| 5 U174 on the stand-in | MET | Discover → Build saved to SQLite; History line |
| 6 who may | MET | member 403 via API for add/rename/move/retire, others' values, unlisted value, forged set_by or id; MCP save_field, set_goal_fields refused; admin refused for OWNER, >40, duplicate, seventh field |
| 7 retired field | MET | |
| 8 next year | PART | unit test only |
| 9 switched off | MET | tools refuse, API refuses, no block, page sentence, no menu row, f.<id> ignored; back on restores |
| 10 filterGoals | MET | |
| 11 U177 on the stand-in | MET | |
| 12, 13 workbook, undo | PART | sheet.test.ts, U178 in /demo only (Spreadsheets out) |
| 14 find_goals | MET | |
| Left out | MET | 53 tools; page not found; tags rows 403 |
Journeys in /demo (browser store); none failed. With Fields left out, find_goals ignores `fields` and returns all 126 goals (Faro's own behaviour).

## One-line kit fixes
- vite.modules.ts: a `guard` part, documented in module-platform.md.
- Stage 10 criterion 9: "Workspace, under Features".
- rules.md:23: values follow a goal the core copies or removes, whoever runs that action.
- adapters.md:41: a server refuses rows of modules its build leaves out.
- find_goals: refuse an argument no loaded module declares.
