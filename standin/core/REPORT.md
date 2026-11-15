# Stand-in rebuild: the core (drill item 11)

(Written by the drill session from the builder's reply; the builder's tool could not write report files.)

Faro at dfe97c0e, copied to `faro/` (tag `pin`), on the stand-in platform: one `node:http` server, SQLite via `node:sqlite`, its own sign-in (scrypt passwords, HttpOnly SameSite=Lax session cookie), a stub SSO (`/sso/stub` → HMAC-signed assertion → `/sso/callback`), files in `data/files/`, a `setInterval` scheduler. Core only: built with `FARO_WITHOUT=ai-access,feedback,goal-map,metrics,reviews,spreadsheets,tags,watching,wrap-up`, as CI's core-journeys-without checks do.

Run: `cd faro && npm ci && npm run build:standin && npm run standin:seed && npm run standin` (port 47310; `STANDIN_PORT`, `STANDIN_DATA`). The seed makes the demo's Platform Engineering a real workspace (97 people, 126 goals); everyone's password is `faro-standin`, each is in the stub directory. Proof: `node platform/prove.mjs` (36 checks).

## (a) Ported as-is
2,300 of the pin's 2,304 files unchanged, including all of `src/domain` (182 files, 0 lines), `src/data` (rows.ts converts SQLite rows unchanged), `src/ports` and every contract, `server/mcp.ts` (a Fetch Request→Response handler: 10 lines of `node:http` wrap it), `src/screens`, `src/app` and every module. Reused on the platform unchanged: `signIn.ts` `matchSignIn` (the server's membership rule), `goalRights.ts` (`mayChangeGoal`, `mayPostCheckIn`), `ports/window.ts`, `rows.ts` `commitPayload` and converters, `mcp/protocol`, the demo builder (seed), the Search, Goals and Prefs adapters.

## (b) Rewired
`git diff --stat pin`: 24 files, +1,915 / −3; 4 existing Faro files, 11 lines.

| Area | Files (+lines) | Why |
|---|---|---|
| Existing Faro files | `src/main.tsx` (+4 −1), `src/vite-env.d.ts` (+2), `tsconfig.json` (+1 −1), `package.json` (+4 −1) | Pick `HttpStore` and `standinIdentity` under `VITE_STANDIN` (live mode; /demo keeps the browser store); typecheck `platform/`; scripts. |
| Goals store | `src/adapters/standin/sqliteStore.ts` (377) | Port of `PostgresStore`; the database functions become TypeScript in one SQLite transaction per save: okr_commit, okr_same_workspace, okr_check_expectations, okr_write, okr_upsert (null-fill, no version), goal-key and version triggers, okr_token_create/revoke, _find, _touch, okr_delete_workspace, person_prefs checks. |
| Schema and migrations | `platform/translate-schema.mjs` (84), `migrations/0001_core.sql` (423, generated), `0002_platform.sql` (34), `migrate.ts` (33) | `spec/core/schema.sql` translated: columns, defaults, keys, indexes kept; FKs, CHECKs, triggers, functions, grants dropped (server enforces). Telemetry, markups, research, builders tables left out. |
| Server-side access (R1) | `guard.ts` (80), server routes | `Store` takes rows, not actions, so the server diffs each Commit with stored rows and refuses in the app's words: changes logged as someone else; goal changes failing mayChangeGoal; check-ins failing mayPostCheckIn; people, teams, cycles, settings by non-admins; views. Membership checked on every read; tokens and feedback filtered for non-admins. |
| Browser adapters | `httpStore.ts` (40) | Store over `/api/workspaces…` (stale → StaleError); Identity from `/api/workspaces/:id/whoami` (matchSignIn on the server). |
| AI tools' endpoint | `deps.ts` (30) | Deps on SQLite; a token refused when its person left Faro or the company. |
| Files | `files.ts` (29) | Files on a folder, served at `/api/files/`. |
| Platform | `platform/server.ts` (263), `auth.ts` (120), `pages.ts` (29), `vite.platform.config.ts` (18) | HTTP, static app, sign-in, stub SSO, /mcp, seed, jobs (session and leaver sweeps). |
| Proof | `standin.test.ts` (70), `platform/drill/*` (43), `prove.mjs` (176), `ui-proof.mjs` (53) | Contracts in npm test; harness shim; behaviour proof; UI flow. |

`grep -ri supabase` over platform sources, `src/adapters/standin/` and `vite.platform.config.ts`: nothing. `platform/dist/server.mjs` imports no @supabase package (strings from shared server/mcp.ts remain).

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Sign-in; the signed-in person is the actor | NAMED | R1 rule 1 (r1:17), R2 rule 1 (r2:17) |
| Membership = live person with the email, lower case | NAMED | R1 rule 2 (r1:18); adapters.md:41 |
| Non-members read nothing; workspaces listed only to members | NAMED | R1 rule 3 (r1:19) |
| Server enforces who may change what | NAMED, no mechanism at the Store port | R1 rule 4 (r1:20); adapters.md:41; ports-at-scale.md:59-77. GAP 1 |
| Token secret on the server, hash kept, stops when the person leaves | NAMED | R1 rule 5 (r1:21) |
| Directory leaver: sessions end, tokens stop | NAMED | R2 rule 3 (r2:19), check 4 (r2:48) |
| Signed out shows the sign-in | NAMED | R1 rule 9 (r1:25) |
| Workspace creator is first admin, by email | NAMED (rule); GAP (how) | R1 rule 2; set-up doesn't ask for the creator's email |
| Store, Files, Clock, Identity, Deps ports and contracts | NAMED | adapters.md:21-31, 80-83 |
| What the database functions do | NAMED only as plpgsql | adapters.md:39, schema.sql:770-1536. GAP 2 |
| Rules the CHECK constraints enforce | GAP | schema.sql:98-145; nothing says which restate domain rules. GAP 3 |
| Contract module's table for a non-Postgres store | GAP | CONTRACT_MODULE_SQL (src/ports/contracts/cases/store.ts:38) Postgres-only. GAP 4 |
| `Store.kind` for a new platform | GAP | src/ports/store.ts:55 closed union |
| Browser↔server API when the store is on the server | GAP | no route shape in the kit. GAP 5 |
| Arrival at first sign-in | NAMED, not built | R1 rule 11 (r1:27) |
| Joining by directory group | NAMED, not built | R2 rule 4 (r2:20) |
| Jobs on a timer for the core | NAMED (R5 r5:20-21); none in Faro's core | platform's own sweeps only |
| Telemetry sink | NAMED as a kit gap | adapters.md:87; R9 (r9:15) |
| Files delete | GAP (minor) | Files port has put, url, bytes |
| App bundle free of the Supabase client | GAP (minor) | with feedback out, the lazy markup `client-*.js` chunk still ships (never loaded) |
| Load windows at scale | NAMED | R4 rule 3; ports-at-scale.md:13-20 (whole load then `windowed`, fine at demo size) |

## (d) Behaviour
- typecheck passes; npm test 202 files, 2,216 tests pass (incl. 29 in standin.test.ts); lint:layers passes.
- `npm run drill -- scripts/drill-faro`: 100% (462,003 of 462,003 cells), contracts 56/56.
- Port contracts on stand-in adapters 29/29 (store 14 + 2, Deps 8, files, clock, identity, persistence across reopening, server Prefs). Harness through a stand-in shim (`npm run drill -- platform/drill`): store, goals, search, prefs 56/56.
- Running server (`platform/prove.mjs`) 36/36: signed out → /signin and API 401; wrong password refused; password sign-in (any case); stub SSO, forged assertion refused; directory leaver: sessions end, no sign-in by password or SSO, token refused; Faro-left person: no workspace list, whoami left, 404 on load, token stops; 8 R1 refusals by a non-admin (rename workspace, change another's goal, check in on another's goal, save logged as someone else, change a job title, add a person, switch a feature off, make a token); owner and admin allowed; /mcp lists 53 core tools, find_goals from SQLite, update_goal on another's goal refused, unknown token 401; files put/get/refuse replace/delete; through the screens (Playwright): sign in, New goal → Publish, Check-in → Post; after restart G-127 and its check-in are in SQLite with 2 change-log entries by rhea and load back.
- Journeys: core smoke set (U1, U2, U5, U33, P6, P5) modules out: 6/6 on the stand-in, same as Faro's build; they run in /demo (browser store), so prove build and serving, not the HTTP store. Live-mode U11, U97, U147 fail at the sign-in page by design (expect Welcome / "Which one are you?" signed out, which R1 rules 9 and 11 forbid); U152 8.6/10 (no module data). None is class names or wording.

## Spec corrections
1. R1 at the Store port: adapters.md should say a Store adapter alone can't enforce R1; the server runs actions (ports-at-scale commands) or checks each Commit against stored rows with goalRights; the door (Via) is claimed by the client; offer the row check as a shared function.
2. Database functions as language-neutral rules with worked examples (upsert null-fill, version bumped never written, goal keys g12 → G-12, feedback added without triage, stages replaced per goal).
3. CHECK constraints: list which duplicate domain rules and which a constraint-free store must enforce.
4. Live-mode journeys U11, U97, U147: tag "Faro today: replaced by R1 rules 9 and 11", give signed-in equivalents.
5. Define the demo-scale browser↔server API (load, commit, history, issueToken, prefs, whoami).

## One-line kit fixes
- `src/ports/store.ts:55`: kind union gains `| (string & {})`.
- `src/ports/contracts/cases/store.ts:38`: export `CONTRACT_MODULE_COLUMNS` beside `CONTRACT_MODULE_SQL` for non-Postgres stores.
- `spec/rebuild/adapters.md:41`: after "Who may change what is still the server's to enforce" add "— a Store adapter can't do it on its own: check each Commit against the stored rows with src/domain/goalRights.ts, or run the actions on the server (the ports at company scale)."
- `spec/rebuild/adapters.md:39`: after "(okr_commit and the rest)" add "(on a database without functions, port okr_same_workspace, okr_check_expectations, okr_write and okr_upsert, and the triggers okr_goal_key and okr_bump_version)".
- `r1-sign-in-and-access.md:18` rule 2: add "(the server gives them the signed-in email: set-up doesn't ask for it)".
- `src/ports/index.ts` Files: add `remove?(path: string): Promise<boolean>;`.
