# Review: stand-in Fields (tags) (reviewer, copy in S/rev-tags)

## Re-run (fresh clone, patch, npm ci)
- typecheck exit 0. npm test: 203 files, 2,229 pass + 1 timeout (spec.test.ts "is current", passes alone 19/19 in 69 s: load only). Report said 2,220 + 3 timeouts: consistent.
- drill scripts/drill-faro 100% (462,003/462,003), contracts 56/56. build:standin ok.
- prove-tags.mjs in: 49/49. out (STANDIN_WITHOUT incl. tags): 6/6. Diff: 9 files +474 -5, matches. 3 existing Faro files changed + vite.modules.ts, virtual.d.ts, package.json (6 lines of Faro files as reported).
- No supabase/vercel in platform server, standin adapters, guard.ts, 0003 migration. SQLite, guard in server.

## 1. Platform and forgery (my own script, forge-tags.mjs, rhea = non-admin member, amara = admin)
Kinds this module writes: fields (goal_fields), values (goal_field_values), plus the change-log rows.
- GUARDED (403, app's words): non-admin add/rename/move/retire/options-only edit of a field; admin forging createdBy/setBy; member sets, clears (removedAt) or empties a value on another's goal, also with setBy forged as the owner; rows under a module name the build lacks (nosuch, Tags); fields over the rule (OWNER, >40, seventh, duplicate).
- FORGEABLE:
  1. Value on a goal NEW in the same save: a member adds a goal owned by someone else together with a value on it: 200. The guard says "a goal new in this save takes values from whoever adds it"; rules.md:23 says the goal's owner or an admin sets values. So the proposer can write values on another person's goal. (A core question whether a member may add a goal for another owner; core allowed it, 200.) Also true for goals copied at next year start.
  2. A member with a backdated setAt on own goal: 200 (setAt not checked; minor).
  3. Unknown key under a known module (`modules.tags.evil`) returns 200 (ignored, not stored).
- Side-effect writes (copy to next year, leaver, undo, goal removal): values follow via the isNew exemption or are rejected for non-owners; only unit-tested, not run on the server (journeys not run).
- Inherited from core review: decisions, retros, watches etc. unguarded; not this module's.

## 3. Claims
(a) All of src/modules/tags unchanged: WEAK. Stage adds src/modules/tags/guard.ts (81 lines) inside the module dir; files existing are unchanged. Rest VERIFIED.
(b) VERIFIED numbers and table. Registry `guard` part is three files, not "one line".
(c) Requirements:
- NAMED rules.md:23, :67, :29: VERIFIED. "not its proposer" is in the report but rules.md:23 only says owner or admin; the guard then lets a proposer through (item 1 above).
- DB limits NAMED as Postgres CHECKs only: VERIFIED (core/schema.sql:26-27, 43-46).
- GAP module-row check hook (adapters.md:39-41): VERIFIED (nothing about a module guard in spec/rebuild).
- GAP values on copied/removed goals: WEAK. spec/modules/tags/rules.md:90 already names new cycle: "a copied goal takes its values". Leaving, undo, while off are not named: real but narrower.
- GAP rows of a left-out module: VERIFIED (adapters.md:41 says only "not read nor written").
- GAP off sentence: VERIFIED. stage-10:38 "Workspace, Features." vs code (src/app/reads.ts:36) and reviews rules.md:21 "under Features".
- GAP list value goals still hold: not checked in spec; plausible, minor.
(d) VERIFIED. Journeys only in /demo (browser store): WEAK as evidence for HttpStore; exits 8, 12, 13 are PART as the report says.

## 4. Proofs
- On: VERIFIED (49/49, incl. Playwright through SQLite). Off (admin switch): VERIFIED (tools refuse, API refuses, no block/menu row, back on restores). Left out: VERIFIED (53 tools, page not found, rows 403).
- Server-enforced who may for Fields: VERIFIED for existing goals; NOT MET for the new-goal path (item 1).

## 5. Tests honest
Disabled the guard (early `return null`): tags.test.ts 4 failed (exit 1); prove-tags 18 FAIL, exit 1. Honest. (tags.test.ts is in npm test, unlike core prove.mjs.)

## 6. One-line kit fixes
- Stage 10 criterion 9 "under Features": one line, right.
- rules.md:23 values follow a goal the core copies/removes: one line, right but should also settle whether a proposer may set values (fix the guard or the rule).
- adapters.md:41 refuse left-out modules' rows: one line, sound.
- vite.modules `guard` part: NOT one line (PARTS entry, virtual.d.ts, module-platform.md, plus a guard hook in the core guard); sound design, wrong size.
- find_goals refuse an undeclared argument: a behaviour change to a core tool, not one line, and unsafe for existing callers; WEAK.

## Top GAPs
1. No hook in spec for a module's own row checks (the stand-in invented the `guard` part).
2. New-goal exemption lets a proposer set values for another's goal; spec silent on proposer.
3. Left-out module's rows, leaver/undo/off value handling, off sentence wording.
