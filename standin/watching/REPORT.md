# Stand-in rebuild: stage 11, Watching (drill item 11)
(Saved by the drill session from the builder's reply, condensed.) Proof: `bash platform/prove-watching.sh [port]` (on, off, back, left out, built in again, one data folder); `platform/ui-watching.mjs`; `watchGuard.test.ts` in npm test.

## (a) Ported as-is
2,322 of 2,329 files unchanged; all of src/modules/watching; everything Watching keeps in the core (domain watch, watchWrites, switchOff, watchedGoals, home, goalsPage; screens; watch/unwatch actions; MCP module-off refusal). okr_watches already in 0001_core.sql; SqliteStore already loads, saves, carries, deletes watches. No migration or store change.

## (b) Rewired (7 files, +399 −2)
package.json (+1 −1) STANDIN_WITHOUT; watchGuard.ts (+54), server.ts (+6 −1): every save checked; proof files (watchGuard.test.ts 55, prove-watching.mjs 205, .sh 13, ui-watching.mjs 65). Refused: Watching's saves (writesWatches) while off or left out ("Watching is off in {ws}."); someone else's watch ("That's someone else's watch."), except a restore by an admin or the stopper and watches carried by a goal or cycle save (new copy must follow a live watch by the same person on a goal with the same key); changing a watch's person or target (sentence written for the stand-in, not Faro's); deleting others' watches. MCP unchanged.

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Anyone writes their own watches | NAMED | r1:79 |
| Admins writing others' watches | GAP | r1:79 silent; built as refused |
| Restoring a stopped watch | NAMED | r1:95, canRestore |
| Watches carried for others (cycle start, its undo, a goal leaving a later year) | GAP | not in r1 |
| Server refuses Watching's saves while off | PART | stage-11 names only the dispatcher and MCP |
| Where watches are stored | NAMED | stage-11 gaps 1, 2 |
| Every member reads watches | NAMED | R1 rule 3 |
| Left-out tools answer the module-off sentence | GAP | they answer "Unknown tool" |
| Telling a carried copy from a new goal | GAP | no carriedFrom; relies on the kept key (types.ts:105) |
| Files, jobs | none | |

## (d) Behaviour
typecheck, lint:layers pass; npm test 2,222 pass (spec.test once under load, passes on rerun); drill 100%, watching.csv 63/63, contracts 56/56; stand-in on 36/36, left out 9/9, back 3/3.
| # | Exit | Status | Evidence |
|---|---|---|---|
| 1 | Requirements | MET | 83 demo watches in SQLite; /mcp list, watch, unwatch; Watch in the screens saves |
| 2 | Journeys | PART | below |
| 3 | Off: page and tools sentences | MET | exact |
| 4 | Off: no tab, lead, button; action refused | MET | forged own watch and stop 403; core saves |
| 5 | Off: non-owner led to goals needing attention | MET | "39 goals need attention · See them" |
| 6 | Read-back first | MET | "65 people's 85 watches are kept" |
| 7 | Back on, every watch | MET | rows identical, also after the left-out build |
R1 refusals via API (403): a member starts, stops, deletes, hands over, brings via a new goal, or restores another's watch; an admin stops another's watch. Own start/stop and admin restore allowed; refused saves change no row. Left out: 53 tools, forged watch 403, rows kept, /watching not found.
Journeys (/demo, others out): U7, U8, U9, U16, U73, U80 10/10; U164 7.5 (Features' groups expect Reviews, Wrap-up); U103, U90, F1, N22 need left-out modules; U31 fails (walkthrough asks for a missing button; cause unconfirmed). None class names or wording.

## One-line kit fixes
- r1:79: "Nobody, admins included, starts or stops someone else's watch; a cycle's start, its undoing and a goal leaving a later year carry watchers' watches along with the goals."
- Stage 11 exit 3: "Left out, the tools aren't listed."
- module-platform.md: the server refuses a save writesWatches names while Watching is off.
- types.ts Goal: optional carriedFrom.
