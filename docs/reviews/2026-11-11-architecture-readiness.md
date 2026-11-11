# Architecture readiness review, 11 November 2026

Asked by Lane: how ready is Faro to scale, and how ready is it to hand to the internal platform? A review only. No code under `src/`, `server/`, `api/` or `supabase/` was changed.

## Verdict

Faro is a sound model and not a scalable system, and the first half of that is what it is for. The rules are pure, linted, shared by the app, the import and the MCP server, and proven by a drill; the kit says plainly what Faro does not do. That part hands over cheaply. What does not yet hand over cheaply is everything around the rules: reads still load the whole workspace (5 MB for the demo, measured), the query port a team needs exists only as a sketch, three kit pages claim a database check that does not hold, the most common write (a check-in) skips the one dispatcher the kit tells teams to copy, and the sign-in seam has a contract that a real sign-in must fail. None of these stops Faro doing its job as a demo. Each is cheap to fix now and dear to discover later. As data grows, the first thing to break is the load, and it breaks with time as well as headcount: at ten times the demo the app is slow, and at a hundred times it does not open.

| | Score | In one line |
|---|---|---|
| **Scale** | **2 of 5** | Right for 126 goals. Slow at about 1,000 goals or after two to three years of history; unusable at 10,000. The route out is written down but not built or tested. |
| **Handoff** | **3 of 5** | The rules, the drill and the honesty are strong. The seams a team will copy first (reads, saves, sign-in, the database's own check) each have a fault that would be copied with them. |

After items AX1 to AX5 below (about three releases), I would score handoff 4 of 5. Scale stays at 2 by design: the platform provides it, and the spec says how.

## How it was done

- **Read:** `CLAUDE.md`, `docs/architecture.md`, `docs/backlog.md`, `docs/handover.md`, `docs/handoff.md`, `docs/design/architecture.md`, `docs/reviews/2026-11-10-deep-review.md`, `spec/rebuild/` (all), `spec/requirements/internal/` (R1, R4, observability), `llms.txt`, `supabase/README.md`, migrations 0011, 0033 and 0035 to 0037, and the grants and policies of every migration.
- **Code:** `src/ports`, `src/adapters`, `src/data/store.ts`, `src/app/state.tsx`, `src/app/actions.ts`, `src/app/reads.ts`, `src/domain` (summary, attention, status), `server/`, `scripts/` (migrate, layers lint, nightly), `.github/workflows/`.
- **Measured** (scratch scripts, not committed):
  - a production build of main at `8a623da`;
  - the rules run over the demo workspace copied 1, 10, 50 and 100 times (Node 22, a cloud container; a laptop is of the same order, a phone several times slower);
  - the save functions run as `anon` on PGlite with every migration, as `src/data/rpc.test.ts` does.
- **Not covered:** the screens one by one, the evals' own code, R2, R3 and R6, accessibility. The import was read, not timed.

**Severity:** *blocker* (stops Faro doing its job as a model), *high* (a team that copies Faro copies a fault, or the first thing to break), *medium*, *low*. **There are no blockers.**

**On the IDs:** the build items are prefixed AR2- as asked. They are not parts of the redesign's item AR2 (the module contract), which is already built.

---

## What breaks first as it grows

Measured on the demo workspace and copies of it. One demo workspace is 97 people, 126 goals, 5,347 check-ins and 6,417 change-log entries: the history is far larger than the goals, and it grows every week whether or not the company does.

| Size | People | Goals | Check-ins | Change log | Whole workspace as JSON | Every goal's summary | Needs attention list |
|---|---|---|---|---|---|---|---|
| 1x (the demo) | 97 | 126 | 5,347 | 6,417 | 5.0 MB | 95 ms | 8 ms |
| 10x | 970 | 1,260 | 53,470 | 64,170 | 50 MB | 1.0 s | 0.2 s |
| 50x | 4,850 | 6,300 | 267,350 | 320,850 | 254 MB | 10.9 s | 4.8 s |
| 100x | 9,700 | 12,600 | 534,700 | 641,700 | 509 MB | 44 s | 23 s |

- **At 10x (a large division, or the demo after a few years):** the app still works and feels slow. Opening it reads 50 MB in about 140 requests of 900 rows, most of them one after another within a table (`src/adapters/supabase/goalsStore.ts:40-54`). It reads them again whenever the tab regains focus and every two minutes (`src/app/state.tsx:427-438`). Each save rebuilds every summary (a second). Every MCP request pays the whole load before its first tool runs (`server/mcp.ts:113-114`), so the AI tools break before the screens do.
- **At 100x:** it does not open. Half a gigabyte of JSON is past what a browser tab holds (the first benchmark run died parsing it in Node's default memory), and the summaries alone take 44 seconds. The cost grows faster than the data: 100 times the goals took 465 times as long (finding 6).
- **At 1000x (the company, R4's figures):** only the query and command ports reach it. Nothing in today's read path can be tuned there.
- **Many workspaces:** every workspace is listed to every visitor in one unpaged read (`goalsStore.ts:61-66`). At a thousand workspaces the switcher lists them all.
- **Bundle:** the first screen's JavaScript is 1.36 MB, 414 KB compressed, plus 251 KB of CSS. On 9 November it was 1.22 MB and 374 KB. R4's budget is 300 KB. It has grown by a tenth in two days and no check watches it (finding 8).

**So the order of failure is:** the MCP server's load per request, then the load and reload in the browser, then the per-save recompute, then memory. Bundle size is a steady tax at every size.

---

## Findings, ranked

### High

#### 1. The database's "this row belongs to the workspace" check does not hold, and three kit pages say it does

- **Evidence:** `okr_same_workspace` checks only what each incoming row *says* its workspace is (`supabase/migrations/0033_metric_library.sql:71-80`). `okr_upsert` then writes with `on conflict (id) do update` on the id alone (`0011_transactional_saves.sql:24-41`), and `okr_write` deletes a goal's stages by `goal_id` with no workspace test (`0033:92`); `stages` is not in the list `okr_same_workspace` walks. **Proven on PGlite as `anon`:** a save addressed to workspace A, carrying workspace B's person id, moved that person into A and renamed them; another emptied the stages of one of B's goals. Neither was refused. Yet `spec/rebuild/ports-at-scale.md` ("The database checks that every row belongs to the workspace"), `spec/rebuild/adapters.md` and `docs/handoff.md` (step 3) all state the check as a fact.
- **Why it matters (handoff):** in Faro itself it changes nothing, since the public key can write to any table anyway. But this is the one guarantee the kit tells a team the database gives. A team that keeps `okr_commit` behind its own sign-in, and trusts it to keep workspaces apart, has a hole between tenants.
- **Fix (S):** a migration: the upsert updates a row only where its stored `workspace_id` is the one being saved to, and stages are checked through their goal. Add a case to `storeContract`: "refuses a save that names another workspace's record". Run it on all three adapters.
- **Where:** Faro now. It is small, and it makes a sentence in the kit true.

#### 2. Not every change goes through the dispatcher, and the commonest one does not

- **Evidence:** `docs/architecture.md:106` and `ports-at-scale.md` say "every change goes through one dispatcher, `app.run(action, input)`". Three paths do not. `postCheckIn` builds its own commit in the app layer from `toCheckIn`, `checkInChange` and `requestsAfterCheckIn` (`src/app/state.tsx:593-609`); it is called by the check-in flow (`src/screens/CheckInFlow.tsx:311`). `saveGoal` does the same for the goal forms (`state.tsx:615-625`, from `GoalWizard.tsx:115` and `GoalEdit.tsx:91`). `applyChanges` saves a commit worked out earlier (`state.tsx:646-649`). Neither `postCheckIn` nor `saveGoal` is in the action table (`src/app/actions.ts:38-105`), so `src/app/actions.test.ts`, which holds the table and R1's list together, cannot see them. Neither checks who may do it at that layer: R1's table says a check-in is "the goal's owner, or an admin, enforced by `planChanges`", and this path never calls `planChanges`.
- **Why it matters (handoff):** the route to a server is "replace the dispatcher's body and change no screen". A team that does that finds the weekly check-in, the write the product rests on, still saving from the browser. It is also a rule composed outside `src/domain`: what a check-in saves (the check-in, its log entry, the asks it raises) is assembled in `state.tsx`, and again inside `planChanges` for the table path and the AI tools.
- **Fix (S to M):** make `postCheckIn` and `saveGoal` actions in the table whose rules live in `src/domain` (the single check-in as one `planChanges` change set is the cleanest), and have `applyChanges` send the input again with `apply`. Add a test that no method on `AppState` reaches `commit` except through `run`.
- **Where:** Faro now.

#### 3. The sign-in seam: a contract a real sign-in must fail, a stand-in actor, and no way to plug one in

- **Evidence:**
  - `identityContract` requires that `choose` changes who you are: choose Ada, then Alan, and `who` must answer Alan (`src/ports/contracts/parts.ts:88-101`). `adapters.md` asks for "an `Identity` that answers with the signed-in person and refuses to choose anyone else". An adapter that does the second fails the first.
  - The picker is built inside the app's state, not passed in (`src/app/state.tsx:280`), so there is nowhere to hand in another `Identity` as there is for the store (`src/main.tsx:63-71`).
  - When nobody is chosen, the app carries on as a stand-in: the person with id `rhea`, else the first goal owner, else the first person (`state.tsx:462-464`). That stand-in is the `actor` of every action (`state.tsx:477`).
  - `who()` is synchronous and takes only a workspace id. A sign-in answers later, and by email, and must be matched to a person record (R1, rule 2).
- **Why it matters (handoff):** sign-in is the first thing the internal team plugs in. As it stands they must edit the core, rewrite the contract, and find the stand-in by reading 700 lines; if they miss it, someone who signed in but matches no person record acts as the first goal owner.
- **Fix (S to M):** pass `Identity` in beside the store; make it `current(workspaceId): Promise<personId | null>` with `choose` optional (present only on the picker); outside the demo, no viewer means no actions, not a stand-in. Split the contract in two: what any identity does, and what a picker adds. Add the case "nobody signed in: nothing can be saved".
- **Where:** Faro now.

#### 4. Reads: the whole workspace, every time, and no port to grow into

- **Evidence:** the table above. `SupabaseStore.load` reads 17 tables in full, the whole change log among them (`goalsStore.ts:68-107`). The reload is on focus and a two-minute timer (`state.tsx:427-438`). The MCP server loads per request (`server/mcp.ts:113-114`). The query port is a sketch with no code and no contract (`ports-at-scale.md`, "Gaps in the kit"). The `Search` port (AR1) is real and well made, and is the proof the approach works: it is the one read that already goes through a paged, asynchronous port.
- **Why it matters (both):** this is the first thing to break, and the kit's own first gap. The deep review's A1 fixed the words. The seam itself is no nearer: a team still starts step 2 of the route ("summaries") with nothing to run a contract against.
- **Fix (M to L):** build the query port's first three calls in Faro, `goals()`, `counts()` and `goal()`, answered in the browser from the loaded workspace exactly as `Search` is, with a contract that includes the four checks `ports-at-scale.md` already lists (the summaries are the rules; keyset paging; no read larger than a page; only `goal()` reads check-ins). Move Home and Goals onto it. Faro's own load stays as it is underneath.
- **Also (S):** stop loading history nobody is looking at. Load the current cycle's check-ins and the last few weeks of the change log; let Activity and a goal's History fetch older pages. That alone removes most of the 5 MB and most of its growth.
- **Where:** the port and its contract in Faro now (it is the thing to copy). Summary rows, server paging and the load test stay in the spec (R4).

#### 5. Two people saving at once: most records are last-write-wins, and a refused save is thrown away

- **Evidence:** only goals and reviews carry a version (`src/data/store.ts:24-34`; `0011:43-59`). People, teams, asks, decisions, views and metrics are overwritten silently. When a goal or review save is refused as stale, the app reloads and tells the person to try again (`state.tsx:400-403`); what they typed is not re-applied. Check-ins are always added, never refused, and the guard against a double post is per tab (`state.tsx:594-595`, `:606-607`).
- **Re-checked from the deep review (A2):** the misleading sentences are fixed. The behaviour is unchanged.
- **Why it matters (both):** R4 plans for 2,000 people in the busiest hour, in reviews, on the same goals. Here Faro's best structural decision pays off and is not yet used: because an action is a pure function of what it reads, a stale save can simply be run again on fresh data. No merge logic is needed.
- **Fix (M):** on a stale refusal, reload, run the same action with the same input, and save; show a refusal only if the rule now says no. Put a version on every record two people can edit (a migration), and extend `Expectations` to carry them. Depends on finding 2, since only dispatched actions can be re-run.
- **Where:** the re-run in Faro now (it is a pattern worth copying). Versions on every record: Faro, or the spec if Lane would rather not add the migration.

### Medium

#### 6. The rules' cost per goal grows with the workspace

- **Evidence:** `summarise` scans people, teams and goals with `find` for each goal (`src/domain/summary.ts:60-61`, `:88`) and calls `attentionFor` (`:84`), which scans decisions and asks (`src/domain/attention.ts:89-90`). 100 times the goals took 465 times as long. `scripts/whole-workspace.json` still allows 74 uses of the whole workspace in 18 rules files.
- **Also known:** the lint that guards this matches the spelling `: Snapshot` (`scripts/check-layers.mjs:69`). A rule that takes an `ActionContext` receives the whole workspace twice (`snapshot` and `full`, `state.tsx:477`) and is not counted. The handover already lists this as "the AR4 lint gap".
- **Why it matters (scale, and handoff):** a server that works out summary rows with this code inherits the same curve. The fix is also the work `ports-at-scale.md` calls "step 3 starts by finding out".
- **Fix (S, then M):** index people, teams, goals, decisions and asks by id once in `src/app/reads.ts` and hand the rules lookups. Then narrow the 18 files a few at a time, each proven by unchanged conformance rows.
- **Where:** Faro now for the indexes. The narrowing rides with AX5.

#### 7. The Supabase adapter: failures read as "not migrated yet", and a save that is three transactions

- **Evidence:** in `load`, any failure reading views, asks, metrics, feedback or tokens, a timeout included, is caught and turned into "none" (`goalsStore.ts:76-84`). The workspace then opens with no saved views or metrics and no word of it. `commit` revokes tokens in one transaction, calls `okr_commit` in a second, then removes teams and renames the workspace a second time outside both (`goalsStore.ts:128-151`, `:168-171`). `legacyCommit`, `insertAll` and the pre-0024 token paths (`:155-166`, `:173-227`) serve databases without migrations that CI has applied since 7 November.
- **Why it matters (handoff):** this file is the worked example of a store adapter. A team will copy its shape, including "catch and carry on" and the dead paths.
- **Fix (S):** delete the fallbacks; tell "function missing" from "request failed" and fail the load on the second; make a save one call.
- **Where:** Faro now.

#### 8. The bundle has no budget, and it is growing

- **Evidence:** above: 414 KB compressed against R4's 300 KB, up from 374 KB in two days. `vite build` warns and CI ignores the warning. Only the Map, the Supabase client and the example data are split out.
- **Fix (S):** a CI step that fails when the first chunk passes a stated size (start at today's, lower it as screens are split); lazy-load the routes a first visit never needs (Data, Workspace, the review walkthrough, Feedback).
- **Where:** Faro now. A budget enforced in CI is exactly the pattern R4 asks the internal app to copy.

#### 9. The MCP endpoint as a model

- **Evidence:** the whole workspace per request (finding 4). The token is accepted in the address, `?token=` (`server/mcp.ts:77`), where proxies and access logs keep it. CORS is open to any origin (`:55`). There is no limit on request size or rate. A failure is returned to the caller word for word and written nowhere: there is no `console` call in `server/` or `src/` at all (`server/vercel.ts:7-8`). `Deps` still has no contract (`adapters.md`, "Gaps in the kit").
- **Fix:** a contract for `Deps`, run in memory and on PGlite (S to M, Faro now). The rest goes into R1 and R4 as rules: a token only ever in a header, a rate and size limit per token, failures logged on the server with a reference the caller can quote.
- **Where:** the contract in Faro; the rest in the spec.

#### 10. The access model is honest in R1 and still spreading in the migrations

- **Evidence:** every core table is readable and writable by `anon` with `using (true)` (`0002`, `0003`, `0006`, and still in `0033_metric_library.sql:50-62`, "Until sign-in lands, the same open access"). `okr_delete_workspace` is `security definer`, granted to `anon`, and checks nothing about the caller (`0033:128-156`, `0011:145`); run as `anon` with only a workspace's id, it deleted the workspace. R1 says all of this in general terms.
- **Why it matters (handoff):** each new table copies the demo block, so the pattern a team sees most often in the migrations is the one they must not keep. Nothing in the kit shows what replaces it, or lists the whole surface in one place.
- **Fix (S):** generate one page into the kit from the migrated database: every grant, policy and `security definer` function Faro has today, each marked "demo access: replace". Add to R1 the two shapes that replace them: a membership policy, and "a definer function checks who is calling before it does anything".
- **Where:** the spec. Faro's own access stays open on purpose.

#### 11. Migrations, the deploy, and reading the schema

- **Evidence:** on a merge, CI applies migrations in a job that runs beside the full evals and beside Vercel's deploy, with no order between them (`.github/workflows/ci.yml:233-255`). New code can be live before its table exists. `CLAUDE.md` says both "apply migrations before merging code that needs them" and "merging is the approval". To read the schema a team replays 37 files, in which `okr_write` is defined eleven times. The redirect views in `public` are still there (backlog 0c2).
- **Fix (S):** generate `schema.sql` into the kit from PGlite after every migration (AS part 3 already names it). Choose one sentence for `CLAUDE.md`: a release that needs a migration ships it one merge ahead of the code that uses it. Do 0c2 when its week is up.
- **Where:** Faro now for the schema file and the sentence. Rehearsed migrations and a way back stay in R4, rule 6.

#### 12. State kept in the browser, and time taken from the browser, outside any port

- **Evidence:** 28 source files use `localStorage` directly, among them check-in drafts (`src/app/drafts.ts`), what a person has seen (`src/app/goalSeen.ts`, `src/help/seen.ts`), tours, saved table layouts and the Map. The `Prefs` port covers a handful. Every record's time is stamped from `Date.now()` in the app's state (`state.tsx:473-474`), not from the `Clock` port; the lint's clock rule covers `src/domain` only.
- **Why it matters (handoff):** in the internal app a draft should follow the person from laptop to phone. The team has no list of what is kept where, so they find each by search.
- **Fix (S):** a lint rule (browser storage only in `src/adapters` and `src/ports`), fixed file by file with a shrinking list as rule 6 does; a table in `adapters.md` of what Faro keeps in the browser and which of it the server should hold.
- **Where:** Faro now.

#### 13. Modules: one real example, and a list of moves that will not happen

- **Evidence:** two modules exist. Spreadsheets is real. The metric library's folder holds a manifest, a README and its tools; its rules and records are in the core (`src/app/actions.ts:8`, `:100-104`; `src/modules/metrics/module.json:32-35`). That is the deep review's A3, placed as AS part 2 and held until Thursday. `docs/architecture.md:134-139` still lists markup, reviews, asks, Watching and the Map as "still to move".
- **Why it matters (handoff):** "the core works without each module" is proven for two leaves. Nothing proves a feature with its own records can be added without editing the core.
- **Fix:** keep AS part 2 ahead of ML1, as planned. Then say plainly in the architecture page that reviews, asks, Watching and the Map are core and stay core: moving reviews (about 90 files) teaches the rebuild nothing the metric library will not.
- **Where:** AS part 2 in Faro, as planned. Moving the others: not worth doing.

#### 14. The kit: one stage proven, contracts out of reach, hand-written pages drifting

- **Evidence:** stage 1 has a drill; stages 2 to 5 are outlines (`spec/rebuild/README.md`). The contracts live in `src/ports/contracts/`, outside the kit. `docs/handoff.md` says "the 33 migrations" (there are 37) and still lists 8g and "0c: Faro's own database project" as work to do; both are done, and 0c was decided the other way. `src/ports/index.ts:3` points at `spec/rebuild/stage-6-adapters.md`, which does not exist. `docs/handover.md` says migrations 0001 to 0027 are applied.
- **Fix (S):** correct the pages; add a test that every file path a hand-written doc names exists. With AX5, write the two ports' contract cases as data in `spec/conformance/` so a rewrite can run them (the drill already works this way for the rules).
- **Where:** Faro now.

#### 15. Operability: enough for a demo, with three habits not to copy

- **Evidence:** no server log (finding 9). Telemetry is recorded only when a workspace has recording on, into tables with no reader. The nightly roll-up has no check that it ran (`.github/workflows/nightly.yml`). The after-deploy check passes with a warning when the site does not answer as Faro (`deploy-check.yml:23-26`). The full evals run only after a merge and open an issue on failure; `evals:changed` is a local habit, not a CI gate, so main can be red for as long as a fix takes (the backlog records about 97 s for smoke and 530 s for the full suite).
- **Fix:** the internal platform's tooling replaces most of this, and the observability page says so. In Faro, one line: write the server's failures to standard error (S).
- **Where:** the spec, apart from that line.

### Low

| # | Finding | Evidence | Where |
|---|---|---|---|
| 16 | Ids are made in the browser from `Math.random` and four characters of the time | `src/data/store.ts:350` | The spec already says the server makes ids. No action |
| 17 | The import has no row or size limit; parsing and the change engine run on the main thread, and the engine scans arrays about sixty times per run. Read, not timed | `src/app/spreadsheet.ts:18-23`; `src/domain/changeset.ts` | Spec (R4): import as a server job with a stated limit. In Faro, a cap with a plain message (S) if Lane wants it |
| 18 | `migrate.mjs` and `faro-data.mjs` connect with certificate checking off | `scripts/migrate.mjs:20` | A line in the "don't copy this" list (AS part 3) |
| 19 | The `Store` interface still lives in `src/data/store.ts` with the demo's plumbing (`hasExample`, `resetExample`) and imports from `src/mcp` | `src/data/store.ts:4`, `:54-79` | Deep review A7, still open. Fold into AX5 |
| 20 | `api/mcp.js` is still a committed build, now 1.54 MB | `api/mcp.js` | Deep review A7, already in AS part 3 |

---

## The deep review's architecture findings: what is really fixed

| Finding | State on main |
|---|---|
| A1, the store interface is the one R4 forbids | **Words fixed** (`ports-at-scale.md`; the handoff reads R1 and R4 first). The `Search` port and the narrow-inputs lint are real and pass. The read path itself is unchanged (finding 4) |
| A2, saves trust the caller | **Words fixed.** The dispatcher exists but is partial (finding 2). Versions unchanged (finding 5). One claim in the corrected words is itself untrue (finding 1) |
| A3, the model module reaches into the core | **Open**, held until Thursday as AS part 2 (finding 13) |
| A4, no organisation | **Fixed as asked:** R6a to R6c are written |
| A5, small leaks | Clock ban in `src/domain`: **fixed** (lint rule 5 passes). Search by key: **fixed**. Scorecard words split from codes: **open** (AS part 3) |
| A6, the kit is thinner than it sounds | **Open:** one schema file (finding 11); stages 2 to 5 still outlines (finding 14) |
| A7, things not to copy | **Open, and two have grown:** the main bundle (finding 8) and `api/mcp.js` (finding 20) |

---

## What the internal team must write, and roughly how long

Estimates, for two engineers who know their own platform. They assume copy and adapt. Product work (R3 time zones, R6a to R6c) is left out.

| Work | Today | After AX1 to AX5 |
|---|---|---|
| Run Faro on their Postgres (a `Store` adapter; the plain-Postgres one is the pattern) | 3 to 5 days | 2 to 4 |
| Sign-in: an `Identity` from single sign-on, membership by email | 8 to 10 days (edit the core, find the stand-in, rewrite the contract) | 3 to 5 |
| The command port on a server: actions run there; the server sets who, when and ids; R1's table as a test | 10 to 15 days (find and move the three stray write paths first) | 6 to 10 |
| The query port: summary rows, paging, the screens moved over | 30 to 45 days (design the port, write its contract, narrow the rules) | 20 to 30 (the port, its contract and two screens exist) |
| Versions on every record, and what to do on a conflict | 4 to 6 days | 1 to 2 |
| Access rules in their database, replacing "demo access" | 5 to 8 days | 4 to 6 (the surface is listed) |
| Files, markups, feedback, telemetry to their tools | 5 to 7 days | 5 to 7 |
| **A pilot that is safe** (their database, sign-in, commands on the server, reads as today, a few hundred goals) | **about 30 to 45 engineer-days** | **about 20 to 30** |
| **Company scale** (the query port and summaries on top) | **about 35 to 50 more** | **about 25 to 35 more** |

The difference is roughly three weeks of two people's time, for about three releases of Faro's.

---

## Recommended build order

Shaped as backlog items. Nothing here is visible to people, so each commit says `[no news]`; each still adds its section of `spec/` and its rebuild-stage notes.

| ID | Item | Size | Depends on | Findings |
|---|---|---|---|---|
| **AX1** | **The workspace check holds.** A migration: an upsert never updates a row stored under another workspace; stages are checked through their goal. `storeContract` gains "refuses a save that names another workspace's record", on all three adapters. The three kit sentences then stand | S | Nothing | 1 |
| **AX2** | **Every change through the dispatcher.** The single check-in and the goal forms become actions with their rules in `src/domain`; `applyChanges` re-sends its input with `apply`; a test that nothing on `AppState` saves except through `run`. Keep clear of the held redesign items that touch the same forms | S to M | The redesign's held GoalWizard and GoalEdit work (FS1, FS2) | 2 |
| **AX3** | **A sign-in seam that takes a sign-in.** `Identity` passed in beside the store, asynchronous, with `choose` only on the picker; no stand-in actor outside the demo; the contract split, with "nobody signed in: nothing is saved" | S to M | Nothing | 3 |
| **AX4** | **A scale fixture and two budgets in CI.** The benchmark from this review as a test: a 10x workspace, with limits on its loaded size and on the time to summarise it; a limit on the first chunk's compressed size. With it, the indexes in `src/app/reads.ts` and lazy routes that bring the numbers under | S | Nothing | 6, 8 |
| **AX5** | **The query port, first cut.** `goals()`, `counts()` and `goal()` as a port in `src/ports`, answered in the browser as `Search` is, with a contract (the summaries are the rules, keyset paging, a page at most, only `goal()` reads check-ins) and its cases written into `spec/conformance/`. Home and Goals read through it. The load takes the current cycle's check-ins and recent changes only; Activity and History page for the rest. The `Store` interface moves to `src/ports`, its demo plumbing to the browser adapter | M to L | AX4; AS part 2 (so a module's records come through the same way) | 4, 6, 14, 19 |
| **AX6** | **A stale save runs again.** On a refusal the dispatcher reloads, re-runs the action and saves; a version on every record two people can edit | M | AX2 | 5 |
| **AX7** | **The Supabase adapter, tidied.** No fallbacks for migrations long applied, a failed read fails the load, a save is one call | S | Nothing | 7 |
| **AX8** | **The kit shows the database as it is.** `schema.sql` and an "access today" page generated from the migrated database; a contract for the MCP endpoint's `Deps`. Merge with AS part 3's remainder | S to M | Nothing | 9, 10, 11 |
| **AX9** | **Browser state behind the ports.** A lint rule for browser storage with a shrinking list; the stamp taken from `Clock`; a table in `adapters.md` of what Faro keeps in the browser | S | Nothing | 12 |
| **AX10** | **Pages that tell the truth.** `docs/handoff.md`, `docs/handover.md`, the "still to move" list, the pointer in `src/ports/index.ts`, one sentence on migration order in `CLAUDE.md`; a test that file paths named in hand-written docs exist; the server writes its failures to standard error | S | Nothing | 11, 13, 14, 15 |

**In one line:** AX1, AX3 and AX10 first (small, independent, and each removes something a team would copy wrong); AX4 and AX7 beside them; AX2 once the held forms work lands; then AX5, the one large item; AX6, AX8 and AX9 after.

**Spec only (ride with R5):**

- **R1:** a token only ever in a header; a rate and size limit per token; a `security definer` function checks its caller first; the membership policy written out as an example.
- **R4:** the load reads a bounded window of history; an import is a server job with a stated limit; a migration ships one release ahead of the code that needs it; failures are logged on the server with a reference.

**Not worth doing:** moving reviews, asks, Watching and the Map into modules; tuning the whole-workspace load beyond the history window; a rate limiter, log pipeline or alerting of Faro's own.

## What to keep

Three things made this review short where it could have been long. Every action is a pure function that returns what to save, which is why findings 2 and 5 are small fixes and not redesigns. The kit lists its own gaps, so most of what is above was already half-said. And the `Search` port shows the pattern for the query port working in code. Build the next port the same way.
