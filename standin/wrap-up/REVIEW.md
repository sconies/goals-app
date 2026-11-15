# Review: stand-in stage 12, Wrap-up (reviewer, copy in S/rev-wrap-up, ports 41001-41010)

## Re-run
- typecheck 0; lint:layers ok. npm test --testTimeout=60000: 203 files, 2,220/2,220 pass (report: 2,219/2,220 with a spec.test timeout under load; mine had none). drill-faro 100%, contracts 56/56. Patch: 3 files modified (package.json, platform/server.ts, src/adapters/standin/guard.ts) + 3 new.
- prove-wrap-up: on/off/on 26/26, --before 2/2, --without 5/5 (built with STANDIN_WITHOUT incl. wrap-up). Matches.

## 1. Platform is the stand-in: VERIFIED for the new code
No supabase/vercel in guardWrapUp.ts, guard/server changes; SQLite, server-side check. REPORT names the file platform/guardWrapUp.ts: it is src/adapters/standin/guardWrapUp.ts (minor, WRONG path).
Forgery through POST /commit as non-owner member (my script S/forge.mjs, clock pinned in the wrap-up weeks):
- GUARDED (refused 403, app's words): retro on another's goal as self; retro forged byId owner / admin; non-owner editing an existing retro (byId owner, or self); owner repointing a retro to another goal (same id); retro for a missing goal; non-admin modulesOff; goal edit by non-owner.
- FORGEABLE: (1) change-log rows ("changes") are checked only for actorId; a member wrote a "Wrapped up <someone's goal>: hit it" History entry on another's goal with no retro (200, row added). (2) retro `at` is not compared: the owner saved at=1999-01-01 (200). (3) result/next other fields are only enum-checked (fine).
- Side-effect writes: recarry copies/goals ride the existing goals guard (owner or admin to change; anyone may add a NEW goal, core's hole, incl. a forged "copy"); start-next-year is admin-only (cycles guarded). No later cycle in the seed, so a stop-with-used-copy case was only covered by guardWrapUp unit test via saveRetro, not by me over HTTP.
- Core's unguarded kinds (decisions, watches, asks, reviews, feedback) remain as the core review found; not this module's.

## 3. Claims
(a) 2,321/2,327 unchanged: VERIFIED (6 files touched in patch terms).
(b) +342 −7: WEAK on detail (patch is 3 modified, 3 new; counts plausible, path wrong). Honest: the server runs saveRetro itself: VERIFIED in code. WEAK: "the row must match" compares only id, cycleId, learned (not at).
(c) Table:
- "Records in the store" NAMED / modulesOff NAMED: VERIFIED (stage-12:12,14; module-platform).
- "Who wraps up: GAP in R1; R1 has only Start the next cycle": WRONG. spec/requirements/internal/r1-sign-in-and-access.md:44 has "Wrap up a goal at the end of the cycle | The goal's owner, or an admin | saveRetro".
- Server clock GAP: WEAK. r3-time-zones.md:17 says timestamps are "written by the server", and adapters.md:76 says stamps come from the Clock port; not named: "the server decides whether the wrap-up is open". Partly real.
- One per goal per year / byId = signed in: GAP VERIFIED for one-per-year/goal fixed (no grep hit in spec/); byId=signed-in is core R1 rule (see core review) so partly NAMED.
- While off, server refuses a raw save: stage-12:36 says "refuses while it is off in src/app/actions.ts" so WHERE is named as the actions, not the server: GAP VERIFIED in effect.
- Left out, raw save: GAP VERIFIED (spec silent; --without 200).
- Clock port NAMED: VERIFIED (adapters.md:26).
(d) Numbers VERIFIED. N22 "crashes waiting for Watching" not re-run (evals need the browser setup); module.json/N22 header (evals/notes/22-more-switches.cjs) does switch Watching, Goal map, Feedback off together: plausible.
Exit criteria 1-6: VERIFIED by prove (note exit 1 "MET" omits the forgeable change-log rows and `at`).

## 4. Proofs
on/off/on VERIFIED (26/26, wrap-ups kept, off refuses owner and admin, tools refuse with module-off sentence). Before opening VERIFIED. Left out VERIFIED (5/5), but left-out still accepts raw wrap-up saves (200): stated, spec silent.

## 5. Tests honest
Replaced wrapUpRefusal body with `return null`: guardWrapUp.test.ts 4/4 failed, non-zero exit. Honest. (Unlike core, this guard has a unit test in npm test.) Restored.

## 6. One-line kit fixes
- "Wrap up this goal" in no screen (stage-12:19,30,36 and module.json; the Goals button is "Wrap up", GoalsScreen.tsx:290 links /retro): true, one line, sound (fix words or label).
- R1 row "Wrap up a goal | owner or admin | saveRetro": NOT NEEDED, already r1:44.
- Stage 12: server refuses on its own clock; say what a left-out build does with a wrap-up save: sound, two sentences not one.
- adapters.md Clock: server never trusts a client's now: sound, one line.
- N22 tag steps needing Watching/Goal map/Feedback: sound, one line (not re-run).

## Top real GAPs
1. Server must decide "is it open" on its own clock and run the action on the server; spec says only where the action refuses (actions.ts).
2. One wrap-up per goal per year, goal/year fixed: code only.
3. Left-out module: stored rows and raw saves of its record kind (okr_retros) are still core; spec silent.
4. Change-log entries and record timestamps are not checked by the guard (forgeable History).
