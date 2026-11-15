# Review: stand-in stage 8, Reviews (reviewer, copy in S/rev-reviews, ports 42010-42032)

## Re-run
- typecheck 0. npm test: 203 files, 2,220 tests (matches). First full run under 3-way CPU load: 2 timing failures (spec.test 60 s timeout, scale.test 3.39 vs <3); both pass re-run alone. Not the patch.
- drill-faro 100% (462,003/462,003), contracts 56/56 (matches). prove-reviews 35/35 (in), --without 5/5 + core 36/36 (53 tools), core prove 36/36 on the "in" build. The patch also dirties evals/report.md (run artefact, not mentioned).
- guardReviews.test.ts is 4 tests (44 is its line count; REPORT's "(44)" reads as a test count).

## 1. Stand-in platform: VERIFIED
No supabase/vercel in platform/*.ts|mjs or src/adapters/standin. node:http, node:sqlite, access in the server (guard.ts -> reviewsRefusal on every /commit; server.ts passes name + modules_off from SQLite).
Forged via POST /commit as non-admin member rhea (forge-reviews.mjs):
- GUARDED: review set up/changed/ended/deleted/restored by non-allowed; creator/date change; mark/note as someone else, outside the review, outside its scope; correct/remove/undo another's; move a note to another goal; new review ask outside a review or about a goal it does not walk; goal proposed in a review; switched-off writes (admin too).
- FORGEABLE (200):
  1. decision lifecycle: on an already-removed note, rewrite removedBy to self (nothing checks removedAt-unchanged rows), then restore it. Two saves defeat "restored by admin or remover".
  2. an existing ask raised in a review: rewrite text, askedBy, goalIds (add goals the review does not walk), answer as someone else (guard only checks reviewId unchanged).
  3. side-effect write, carried goal: add any goal to the scope of a review she is not in, by listing that goal unchanged in c.goals (carriedAlong's `moved` set is attacker-supplied).
  4. side-effect write, carried watches: a watch for another person (watches unguarded; carryExtras writes them).
  5. carried asks (goalIds extended on others' open asks) unguarded, same as 2.
  6. core kinds still open (inherited from core review): decision with reviewId null forged byId=admin, new ask with askedBy=admin; retros/feedback/watches/modules rows. A retro forge got 400 (my payload lacked cycle_id): untested.
- GUARDED side effect: a non-leaver dropped from a review's people (403); version bump on a review she is not in was not testable after #3 changed the row.

## 3. Claims
(a) VERIFIED (6 files, no new migration, domain code unchanged).
(b) WEAK: "Enforced:" list is true for what it names but omits 1, 2, 3 above; "a leaver dropping out and a carried goal joining let through" is a hole, not just an allowance.
(c) NAMED r1 66-67,73 (set up, end/delete): VERIFIED. r1:70-72 VERIFIED. r1:68-69 "Anyone" vs REVIEW-SPEAK: VERIFIED contradiction (line 68; also "Mark goals reviewed... Anyone" line 69). writesWhenOff: WEAK as GAP; module-platform.md:92 says "before any core save ... refused with its sentence", so rule and place are named; only the server-vs-action wording of stage-8 exit 4 (line 30, "from any action or AI tool") is missing. GAPs speaking-only-about-walked-goals, propose-a-goal rule, note/ask editable fields, side-effect writes: VERIFIED not in spec/ (grep scope/walks/leaver/carried: only start-next-year.md rule 5/6 says carried goals bring reviews, not the guard consequence; partly named). "tools still listed while off": WEAK; stage-8 has no "no review tools" text (grep found none), exit 9 says tools answer the sentence, so Faro agrees with the spec: no real tension.
(d) VERIFIED numbers. Exit 1 "13 refusals": prove shows 13 REVIEW-SPEAK lines, true; but "MET" for R1 rule 4 is overstated given 1-3.

## 4. Proofs
On: VERIFIED 35/35. Off (switch on server): VERIFIED (note, ask, admin restore refused with the sentence; core save passes; rows kept; tools listed 7 and refuse). Left out: VERIFIED for tools/screens (Unknown tool, 53 tools, 404 page). WEAK: a left-out server still accepts raw saves of reviews rows via /commit (guard code present, modulesOff empty).

## 5. Tests honest
Disabled one canSpeakFor check: guardReviews.test 1 fails; return null at top: 4 fail (29 others pass) non-zero. Honest. prove-reviews not in npm test/CI (same as core).

## 6. One-line kit fixes
- r1:68 "Anyone" -> "Someone in it or an admin": sound (the matching mark/accept-risk row 69 needs it too: 2 lines).
- r1 new row "propose a goal in a review": sound, one row.
- stage-8 exit 4 add "and by the server for a save made without the app's actions": sound.
- tools/list while off: not needed; exit 9 already says it. Drop.
- writesWhenOff side-effect writes: sound but should say "and must refuse a save that changes a review, note or ask by diffing stored rows, including removedBy".
- journey tags U30/U72/U80/U103/N21: sound (several lines, not one).

## Top GAPs
1. The guard cannot see a row that only changes metadata (removedBy on a removed row; askedBy/goalIds on an existing ask) nor trust its own carry exemption: spec should say a Store-level guard needs per-kind immutable-field rules, and the carry exemption must be derived (recompute carryExtras), not accepted from the client.
2. Who speaks for a review (r1 contradiction) and the walked-scope rule.
3. Server-side off refusal wording; side-effect writes.
