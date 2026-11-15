# Review: stand-in stage 6, Goal map (reviewer, copy in S/rev-goal-map)

## Re-run (fresh clone of S/base, patch applied, npm ci)
- typecheck 0; lint:layers ok. npm test --testTimeout=60000: 202 files, 2,216/2,216 pass (REPORT says 2,214/2,216 under load; with the 60 s timeout all pass: consistent).
- drill scripts/drill-faro: 100% on every CSV, contracts 56/56. platform/drill: contracts 56/56.
- prove-goal-map in: 21/21; out (left-out build): 6/6. Matches.
- Patch is 1 line in package.json (+1 -1); prove-goal-map.mjs is NOT in the patch file (shipped beside it; I copied it in).

## 1. Stand-in platform / server-side access: VERIFIED for what this module writes
- No supabase/vercel in platform/*.ts|mjs or src/adapters/standin (grep). node:http, node:sqlite.
- The module writes only: the switch (Commit.modulesOff) and saved views. Nothing else (module.json tables []).
- Forgery attempts as non-owner member (rhea) via POST /commit, port 42021:
  - modulesOff set off / set empty: 403 "Only admins can switch features on or off." GUARDED
  - edit another's view: 403. Soft-delete another's view (deletedAt): 403. Create a view with personId of someone else: 403. GUARDED
  - pin own view: 403. Log the change as an admin actor: 403. GUARDED
  - MCP set_feature with member token refused (prove). GUARDED
- Side-effect writes: switching off relabels/changes nothing else (only modulesOff + a change-log row); a saved view=map survives and opens the List.
- Inherited from core, not this module: decisions (approve-target with byId=admin) and watches for another person returned 200 as a member. Still open (decisions, retros, watches, requests, reviews, feedback).
- Kinds this module writes: workspace switch GUARDED, views GUARDED. None forgeable.

## 3. Claims
(a) Ported as-is: VERIFIED (only package.json differs).
(b) Rewired 2 files +177 -1: VERIFIED. "No guard change needed": VERIFIED (all refusals above come from the existing guard).
(c) NAMED rows: VERIFIED in substance, cites loose: r1:81 is pin only (own-view rule is help-guide.md:479, not 478); actions.md:1080 is the "Only admins can pin" refusal, ok; tools.md:3143 is the line before the set_feature heading (3145); r1:93, actions.md:67 right. GAP (positions/Troubled trees kept in browser): VERIFIED real; grep spec/ for goals-map: finds nothing, spec/core/rules/map.md says "rearranged" only; code at src/screens/GoalMap.tsx:88-90.
(d) Numbers: VERIFIED. "U165 8.6 a11y, U134 stale-proposal wording" not re-run (journeys not run).

## 4. Proofs
- On: VERIFIED (Map layout, 26 nodes from SQLite, Delete/Backspace remove nothing).
- Off (admin in Features, logged, view=map -> List said once, on again -> Map, phone): VERIFIED.
- Left out: VERIFIED (four layouts, sentence, no Features row/Help article, 53 tools).
  Note: 53 tools in and out, because the goal-map has none: fine.

## 5. Tests honest
Disabled the pin check in guard.ts: prove-goal-map exit 1 (20/21, pin test FAIL). But standin.test.ts (in npm test) still 29/29: the module's guard is covered only by prove, not the regular suite (same as core).

## 6. One-line kit fixes
1. Where positions are kept: sound, one line, right.
2. "Owns no records: server checks only the switch and saved views": sound.
3. "U165, N22, F6 also need Feedback, Watching, Wrap-up and Reviews": WEAK. Report's evidence names Reviews, Spreadsheets, Feedback, Watching as the stops; Wrap-up and Spreadsheets mismatch the sentence; list not backed.

## Top real GAPs
1. Where Map layout state lives (browser storage) not in spec.
2. Journeys U30/U34/U90/U165/F6/N22 need other modules on: dependency not in module.json "needs": [] (journey needs are undeclared).
3. Inherited: guard blind spot for decisions/watches/etc.
