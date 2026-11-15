# Review: stand-in stage 5, Feedback (reviewer; copy in S/rev-feedback, ports 43010-43060)

## Re-run
- typecheck exit 0. npm test: 2,225 pass, 1 fail (spec "is current" test, time limit under load; passes alone, 123/123 in src/spec). Total 2,226 vs REPORT "2,209 + 9 slow" (2,218): numbers differ slightly, not wrong in substance.
- drill-faro 100% (462,003/462,003), contracts 56/56. prove.mjs 36/36. prove-feedback.mjs 41/41. standin.test.ts 39 pass. (ui-feedback.mjs not run.)

## 1. Platform: VERIFIED stand-in (no supabase/vercel in platform/*.ts, inbox.ts, inboxHttp.ts, migrations; node:sqlite; files API for pictures).
Guarded (forgery tried through HTTP as non-admin member rhea):
- feedback via /commit: other person's id refused; rewrite of sent feedback refused; status/fixed_in forged on a new row stripped (always New); off -> refused. GUARDED.
- markups: server-issued id only, once; workspace/person/demo/status set by server (forged ws_elsewhere, demo, status fixed ignored). GUARDED.
- triage (markup, feedback, issue url): non-admin refused, forged by/admin in body ignored. GUARDED. Pictures: signed-in only.
CAN BE FORGED / HOLES:
1. Triage admin = admin of whatever workspace the caller names in ?ws=. Any signed-in person creates a workspace (POST /api/workspaces makes them its admin) and then triaged another workspace's feedback (200, wont-fix, statusBy "Rhea R"). Also reads every workspace's inbox from it. Proved. The report lists "which admin" as a GAP but proves "triage admins only" as if it held.
2. Feedback rows accept anything the schema's CHECKs would stop: mood "<script>", 200,000-character text, `at` forged to 1999 (all 200). Faro's migration 0007 has CHECK (mood in good/meh/bad); the stand-in's translated schema dropped it (core GAP 3). Not mentioned in REPORT.
3. Inherited core hole (not Feedback's): decisions, retros, watches, asks, reviews unguarded in /commit; unchanged.
4. markup-id is issuable by any member with no rate/limit; markup body size unbounded (not tested further).
Side-effect writes: triage log (server-only, fine); pictures on files (only via add under issued id); modules_off (core guard refuses member).

## 3. Claims
(a) VERIFIED (patch: 7 modified + 5 new files).
(b) Table VERIFIED; WEAK: "12 files +691 -13" says nothing of holes 1-2.
(c) NAMED cites r1:98, r1:100, r5:38, stage-5:15, adapters.md:23, module-platform.md:51 VERIFIED. GAP "feedback only added, always New": WEAK/partly NAMED, spec/core/schema.sql:923 and access-today.md:57 name okr_feedback_add (grep). GAP "which admin" real; "browser API" real; "demo markups" real (nothing in spec/rebuild/adapters.md). "Triage history shape": real, stage-5:15 only lists fields, VERIFIED weak-name. Missing GAP: CHECK rules for feedback (mood, length) and who may create a workspace (admin by creation).
(d) VERIFIED numbers. Exit 2 PART honest (journeys not run via evals).

## 4. Proofs
- On: VERIFIED (41/41). Off: VERIFIED by prove-feedback (404 sentence, 8 tools, send refused, data kept).
- Left out: VERIFIED (rebuilt with base build:standin: /api/inbox 404, commit feedback 403 "Feedback is off", core prove 36/36).
- Admin-only triage: NOT MET across workspaces (hole 1).

## 5. Tests honest
Removed the personId check in feedbackRefusal: prove-feedback printed FAIL "a member sends feedback as someone else" (40/41; exit code not captured by my pipe). standin.test.ts still 39/39: the server guards are only in prove-feedback.mjs, not npm test or CI (same as core).

## 6. One-line kit fixes
- r1:98, adapters.md:23-24, stage-5:15, MARKUP demo note: sound, one line each.
- r1:100 "say which admin": one line to write but a product decision; the stand-in's choice (any workspace's admin) is exploitable, so the line must say "an admin of the company's builder group, not of any workspace".
- backend.ts inboxOps(workspaceId): NOT one line (changed 3 files: backend.ts, inboxData.ts, inboxHttp); fine as a small change.
