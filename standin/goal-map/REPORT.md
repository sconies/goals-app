# Stand-in rebuild: stage 6, Goal map (drill item 11)
(Saved by the drill session from the builder's reply, condensed.)

Owns no records, tables, routes, AI tools, files or jobs; one of Goals' layouts drawn while goalMapOn (src/app/reads.ts:60).

## (a) Ported as-is
Every file of the core stand-in except package.json: GoalMap.tsx, src/domain/map.ts, GoalViews/GoalsScreen (layoutsOn, MAP_OFF_NOTE), src/modules/goal-map/, @xyflow/react, server, guard, SQLite store, MCP server.

## (b) Rewired (2 files, +177 −1)
package.json (+1 −1): goal-map out of FARO_WITHOUT (STANDIN_WITHOUT can still leave it out or put every module in). platform/prove-goal-map.mjs (+176): exit criteria via API, /mcp and screens, in and out. No guard change: the module writes only the switch (admins) and saved views (owner or admin; pin admins), both already checked.

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Per-workspace switch on the server, read by clients and /mcp | NAMED | module-platform.md; r1:93 |
| Only admins switch it (app and set_feature) | NAMED | r1:93; actions.md:67; tools.md:3143 |
| Saved views: own by anyone, pin by admins | NAMED | r1:81; help-guide.md:478; actions.md:1080 |
| Module records | none | module.json tables: [] |
| Where dragged positions and "Troubled trees" are kept | GAP (minor) | GoalMap.tsx:88-91 browser storage goals-map:<ws>; GOAL-MAP says "rearranged", not where kept |

## (d) Behaviour
typecheck, lint:layers pass; npm test 2,214/2,216 (2 in spec.test.ts time out under load 9–13, pass alone 60/60); drill-faro 24 CSVs 100%, contracts 56/56; shim 56/56; core proof 36/36 in and out; map proof 21/21 in, 6/6 out.
| Exit | Result | Evidence |
|---|---|---|
| 1 GOAL-MAP, MAP-OPTIONAL | MET | five layouts; view=map draws 26 nodes (126 goals folded) from SQLite; Delete/Backspace remove nothing; Help article |
| 2 Journeys and checks | MET | below |
| 3 Off: four layouts, no Map | MET | admin switches off; SQLite keeps modulesOff, logs "Switched off Goal map" |
| 4 Off: view=map → List, said once; on again → Map | MET | also another member on a phone |
| Server access (non-admin) | MET | switch 403; pin Map view 403; own view allowed; set_feature with member token refused; admin token works; signed out 401 |
| Left out | MET | four layouts; view=map → List + sentence; no Features row, no Help article; /mcp 53 tools |
Journeys (/demo): other modules out: U26 10, U39 10, U134 9, U135 9, P5 pass; U30, U34, U90, U165, F6, N22 stop at left-out Reviews, Spreadsheets, Feedback, Watching. Every module in: U30, U34, U90, U135 10; U134 9; U165 8.6 (a11y); F6, N22 pass. U134's miss is the core's stale-proposal row wording; no failure is a class name.

## One-line kit fixes
- GOAL-MAP / map.md: "Dragged positions and the Troubled trees choice are kept in the browser per workspace (goals-map:<ws>, goals-map-troubled:<ws>), not on the server."
- Stage 6 What to build: "Owns no records: the server checks only the switch (admins) and saved views (r1:81, r1:93)."
- Stage 6 gaps: "U165, N22 and F6 also need Feedback, Watching, Wrap-up and Reviews on."
