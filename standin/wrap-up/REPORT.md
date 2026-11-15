# Stand-in rebuild: stage 12, Wrap-up (drill item 11)
(Saved by the drill session from the builder's reply, condensed.) Proof: `node platform/prove-wrap-up.mjs [port]` (`--before`, `--without`).

## (a) Ported as-is
2,321 of 2,327 files unchanged, incl. all Wrap-up code (module folder, Retro.tsx, Home's lead and year row, Goals' Wrap up link, saveRetro, cycle.ts, wrapUpOffReadBack, off gates). No migration (okr_retros is the core's), no files or jobs.

## (b) Rewired (6 files, +342 −7)
package.json (+1 −1); guardWrapUp.ts (+43, new), guard.ts (+4 −2): for each wrap-up a save writes, the server runs saveRetro as the signed-in person on the platform's clock and refuses in its words; the row must match what saveRetro makes (goal's year, one per goal per year, by the signed-in person); while off any wrap-up save gets "Wrap-up is off in {workspace}.", admins included. server.ts (+7 −4): clock from STANDIN_TODAY; guard gets name and modules_off. Proof: guardWrapUp.test.ts (47), prove-wrap-up.mjs (240).

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Records in the store | NAMED | stage 12 gap 1 |
| modulesOff on every save and tool call | NAMED | stage 12 entry; module-platform.md |
| Who wraps up a goal: owner or admin | NAMED in code and stage words; GAP in R1 | r1 has only "Start the next cycle" (r1:92) |
| Saves only in the wrap-up weeks, by the server's clock | rule NAMED; server clock GAP | |
| One per goal per year; goal and year fixed; byId the signed-in person | GAP | code only |
| While off, the server refuses a save sent without the app | rule NAMED; where GAP | Faro refuses only in actions and tools |
| Left out of the build, a raw save | GAP | core accepts it (200); spec silent |
| Clock port | NAMED | adapters.md |

## (d) Behaviour
typecheck, lint:layers pass; npm test 2,219/2,220 (spec.test timeout at 60 s under load, passes alone 19/19); drill 100%, contracts 56/56 (no module CSV). Server: on/off/on 26/26, before opening 2/2, left out 5/5, core 36/36 in and out.
| Exit | Status | Evidence |
|---|---|---|
| 1 Requirements | MET | /commit refused: non-owner member, save logged as owner by another, lesson <10 chars, wrong year, second row, before opening ("2026's wrap-up opens on Mon 21 Dec 2026."); owner and admin save; MCP own goal saves, another's refused |
| 2 Journeys | PART | U10, U1, U2 10/10; U166 8.6 (step budget only); P5 passes; N22 crashes waiting for Watching's tick box (Watching, Goal map, Feedback left out); none class names or wording |
| 3 Off: pages, tools | MET | exact sentences |
| 4 Off: Home, Goals, saves | MET | no lead, link; raw saves by owner and admin refused; core saves go through |
| 5 Read-back | MET | "Open now: 2 of 126 goals wrapped up…" |
| 6 Next year | MET | dry run counts same off and on; admin starts 2027, also with module left out; wrap-ups unchanged when back on |

## One-line kit fixes
- Stage 12 exit 4: "Wrap up this goal" appears in no screen; name Goals' "Wrap up" and Home's "Start the wrap-up".
- R1: row "Wrap up a goal | its owner or an admin | saveRetro".
- Stage 12: the server refuses on its own clock; say what a build without Wrap-up does with a wrap-up save.
- adapters.md Clock: the server never trusts a client's now.
- N22: tag steps needing Watching, Goal map, Feedback.
