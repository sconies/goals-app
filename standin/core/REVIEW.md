# Review: stand-in core (reviewer, copy in S/rev-core)

## Re-run (fresh copy, npm ci)
- typecheck exit 0. npm test: 202 files, 2,216 tests pass (matches).
- drill scripts/drill-faro: 100% (462,003/462,003), contracts 56/56 (matches). platform/drill: 56/56.
- build:standin ok. platform/prove.mjs: 36/36, twice (matches).
- git diff --stat pin: 4 files, +11/-3 (matches); platform/, src/adapters/standin/, vite.platform.config.ts untracked (new).

## 1. Platform is really the stand-in: VERIFIED, with one hole in 1c
- No supabase/vercel in platform/*.ts, src/adapters/standin, vite.platform.config.ts. server.mjs has one string "supabase" (a module-list name from shared server/mcp.ts). The app bundle still ships a client-*.js chunk containing @supabase (as the report says; never loaded).
- node:http, node:sqlite, scrypt, stub SSO: confirmed in code.
- Access is enforced server-side (guard.ts diffs each Commit against stored rows). Forbidden change as non-owner through the API: change someone else's goal -> 403 with app's words (VERIFIED).
- HOLE (WRONG for "who may change what is enforced"): the guard checks only goals, check-ins, people, teams, cycles, views, settings. As an ordinary member, via POST /commit, all of these returned 200: a decision (approve-target) on another's goal, forged byId=an admin; a watch for another person (table: "anyone, for their own watches"); a retro on another's goal forged as an admin (table: owner or admin); feedback as another person. decisions, retros, watches, requests (asks), reviews, feedback and modules rows are not checked. R1 rule 4 is not met for them; report (b) and prove.mjs claim "8 R1 refusals" without saying the rest is open.

## 3. Claims
(a) Ported as-is: VERIFIED (4 files modified; counts consistent).
(b) Rewired: VERIFIED for the 4 changed files and the table's shape. WEAK: it says the guard covers R1 rule 4 without listing the unguarded rows above.
(c) Platform requirements:
- NAMED cites r1:17-21, r1:25, r2:19, adapters.md:41 ("still the server's to enforce"), ports-at-scale.md:59 (commands): VERIFIED. R5 r5:20-21 are reminder/digest jobs: right but "none in Faro's core" fine.
- GAP 2 (functions): WEAK. The goal-key counter is named in spec/core/rules/numbers-and-names.md:33 and access-today.md; null-fill upsert and the version bump are not in spec/. Partly a real gap.
- GAP 3 (CHECK rules), GAP 4 (CONTRACT_MODULE_SQL Postgres-only, store.ts:38 and the contract's about text), GAP 5 (no browser-to-server route shape; grep of spec/ for /api/workspaces, whoami finds nothing), Files remove (ports Files has no remove): VERIFIED as gaps. Store.kind closed union (store.ts:55): VERIFIED.
- Missing GAP: the guard's blind spot itself. The spec's access table says what each row kind needs but a Store adapter given rows, not actions, cannot tell who a decision, watch or retro is for; the report's Spec correction 1 only covers goals and check-ins.
(d) Behaviour: VERIFIED numbers. WEAK on journeys: "6/6" run in /demo against the browser store, so they prove nothing about HttpStore.

## 4. Exit criteria / proofs
- Core runs on stand-in, sign-in, SSO, leaver, files, MCP, persistence: VERIFIED.
- Server-enforced access (R1 rule 4): NOT MET for decisions, retros, watches, asks, reviews, feedback.
- Contracts on stand-in adapters: VERIFIED (29/29 in standin.test.ts; contracts 56/56).

## 5. Tests honest
- prove.mjs: broke guard (return null): exit 1, 7 R1 checks fail. Honest.
- But `npm test` standin.test.ts still passed 29/29 with the guard disabled: the guard has no unit test in the regular suite, only prove.mjs (not in npm test or CI).

## Top real GAPs
1. Row-level checks needed for every kind (decisions, retros, watches, asks), not only goals/check-ins; spec should say a Store-level guard needs per-kind rules or server actions.
2. Browser-to-server route shape undefined.
3. Database function behaviours (null-fill upsert, version bump) not language-neutral.
4. Contract module table Postgres-only; Store.kind closed.
