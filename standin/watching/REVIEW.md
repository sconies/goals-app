# Review: stand-in stage 11, Watching (reviewer, copy in S/rev-watching, ports 42010 and 42020)

## Re-run
- typecheck exit 0. npm test --testTimeout=60000: 203 files, 2,221 pass, 1 fail: src/spec/spec.test.ts "is current" timed out at 60 s (machine load ~16, three reviewers); REPORT says the same flake. Not re-run alone.
- drill scripts/drill-faro: 100% (status/flags/projection 100%), contracts 56/56. watching.csv is in the drill output.
- prove-watching.sh 42010: on 36/36, left out 9/9, back 3/3 (matches). Files: 2,324 tracked in base + 5 new = 2,329; 2 modified (package.json +1-1, server.ts +6-1); new files 392 lines; total +399 -2: all VERIFIED.

## 1. Platform is the stand-in: VERIFIED, guard has holes
No supabase/vercel in src/adapters/standin, platform/*.ts, *.mjs. SQLite, server-side checks.
Records Watching writes: watches (and their change-log rows, entity "watch"). Forged through POST /commit as non-owner member Rhea (S/forge-watching.mjs, own data dir):
- GUARDED (403): new watch for Pavel (goal, tree, level); stop Pavel's watch; delete (unwatch) it; hand a watch to another person; change-log row with actorId=pavel; new goal bringing a watch with a key that matches nothing; non-stopper restore of a missing/stopped watch; mark Pavel left (core guard).
- FORGEABLE (200):
  1. Stop another's watch riding a save that edits an actor's own goal: Pavel watches Rhea's goal; Rhea PUTs her goal edit + the watch with removedAt, with no entity:"watch" log row. `carried()` returns true for any existing watch whose ref is a goal in the save (`if (was) return true`). Same for restoring it (removedAt null). Rhea can silently stop or revive anyone's watch on any goal she may change (her own, or any goal for an admin).
  2. Create a NEW watch for Pavel: new goal with the key of a goal Pavel watches, same kind, plus a watch for Pavel on it (F1c, 200; with a different kind or key it is refused). Anyone can add a goal, so the "same key" proof is no proof.
  3. Forged change-log row (entity watch, action removed, for Pavel's watch) with no watch change: accepted (the core guard only checks actorId). Audit noise, not a watch change.
  4. A watch on a goal id that doesn't exist: accepted (own watch).
Side-effect writes: cycle start/undo and "goal leaving a later year" carry watches; those are exactly the holes 1 and 2 (a non-admin cannot write cycles, but can write goals). Core forgeries from core/REVIEW.md (decisions, retros, asks, reviews, feedback) are still open and out of this module's scope.
Left out / off: forged own watch 403 "Watching is off in ...", rows kept: VERIFIED.

## 3. Claims
(a) 2,322 of 2,329 unchanged: VERIFIED.
(b) 7 files +399 -2: VERIFIED. WEAK: says "someone else's watch refused" and R1 refusals list is true only for the direct cases listed; carried path is a bypass (above).
(c) NAMED r1:79, r1:95 (canRestore), stage-11 gaps 1 and 2, R1 rule 3: VERIFIED (r1:79 says only "Anyone, for their own watches"). GAPs, grep of spec/: admins writing others' watches (r1 silent): real. Carried watches for others: real (stage-11 line 37 and the Watching spec section describe carrying but not who may write). Left-out tools answer "Unknown tool": real gap (module-platform.md:182 and 188 give Unknown tool for an unknown name, never say a left-out module's tools are unlisted). Server refuses saves while off: PART is right (stage-11 line 15 names the hook "writesWhenOff", module-platform.md:140 names only Reviews). Telling a carried copy: real; key rule is in types.ts:103-105, not in spec.
(d) Numbers VERIFIED. U31 etc. not re-run (journeys not in scope here).

## 4. Proofs
On: VERIFIED (36/36, plus my forgeries). Off (switched off): VERIFIED (module-off sentences exact, forged own watch 403, core saves). Left out: VERIFIED (9/9, 53 tools, rows kept). Back: VERIFIED (3/3). The proof of "R1 refusals" is WEAK: it tests only direct forgeries, none through a goal save.

## 5. Tests honest
Broke watchRefusal (return null at top): watchGuard.test.ts 5 of 6 fail, exit 1. Honest. But no test covers the carried path with an existing watch or a matching-key new copy by a non-admin member (the test at line 40 only tries a mismatched key and an admin for the carry cases), so holes 1 and 2 pass the suite. watchGuard.test.ts is in npm test (better than core's guard).

## 6. One-line kit fixes
- r1:79 sentence: one line, right as a rule; but the stand-in does not meet it (holes 1, 2). Sound for the kit; add "as the actor of the save".
- Stage 11 exit 3 "Left out, the tools aren't listed.": one line, sound (confirmed 53 tools).
- module-platform.md: server refuses a save writesWatches names while off: one line, sound (extend line 140's row to "Reviews' or Watching's records").
- types.ts Goal optional carriedFrom: one line in code, sound idea and the real fix for hole 2, but it is a code change and the guard needs a matching change; hole 1 needs the guard to compare the stored and written watch (only removedAt by the same carry) instead of `if (was) return true`.
