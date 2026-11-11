# Build reviews: each merged PR from #121

11 November 2026. A running log kept by the reviewer for the five build tracks. One section per pull request merged into main from #121 (12:42 UTC), in the order they merged. Each was read against `CLAUDE.md`, `docs/architecture.md`, `docs/design-rules.md`, the architecture readiness review (`docs/reviews/2026-11-11-architecture-readiness.md`) and, where it has one, its design spec under `docs/design/`.

Only confirmed findings are listed: each was traced in the code on main and, where it can be run, run (PGlite with every migration for the database; the demo at `/demo/?today=2026-11-11` with Playwright for the screens; a production build for the bundle). Style and nits are left out. The live project was not touched.

| Severity | Means |
|---|---|
| High | Wrong data, lost work, or a rule broken for everyone. Sent to the owning track when found |
| Medium | Wrong behaviour someone will meet, a rule restated, a check that passes while the thing it guards exists, a missing eval for new behaviour, or a page that says what the code doesn't do |
| Low | Real, but small or rarely met |

## State

| PR | Track | High | Medium | Low |
|---|---|---|---|---|
| #121 Day one reads only what it uses | 2 | 0 | 0 | 1 |
| #122 AX1: the workspace check holds (0038) | 4 | 0 | 1 | 0 |
| #123 AX3: a sign-in seam that takes a sign-in | 4 | 0 | 1 | 1 |
| #125 Fence check: Supabase's open tables are a warning | planning | 0 | 0 | 1 |
| #124 AX10: pages that tell the truth | 4 | 0 | 0 | 1 |
| #110 FS3: Find from anywhere | 1 | 1 | 0 | 4 |
| #126 AX7: the Supabase adapter, tidied | 4 | 0 | 0 | 1 |
| #128 AX4: a scale fixture and two budgets in CI | 4 | 0 | 1 | 0 |
| #127 CY1: a year ends on its last day | 5 | 1 | 0 | 2 |
| #131 AX8: the kit shows the database as it is | 4 | 0 | 1 | 2 |
| #143 CI: fall back to Chromium alone when apt can't reach Ubuntu's mirror | planning | 0 | 0 | 1 |
| #130 IM0, IM1: the round trip and the field table | 3 | 0 | 5 | 2 |
| #112 GL2: the view menus | 1 | 0 | 6 | 5 |
| #113 NV2: where you are | 1 | 1 | 5 | 4 |
| #114 NV3: the check-in queue | 1 | 0 | 3 | 4 |
| #111 FS1: pick everywhere | 1 | 0 | 5 | 3 |
| #115 FS2: the list bar on Data and Feedback | 1 | 0 | 3 | 2 |
| #117 FS4: company size (N12) | 1 | 0 | 3 | 2 |
| #148 Track 1 handover | 1 | 0 | 0 | 0 |
| #141 Undo brings a feature back | planning | 1 | 1 | 0 |
| #116 find_goals takes a scope | 1 | 0 | 2 | 0 |

**Open, of high severity:**

- #110 finding 1: a goal's status in Find and in the picker is a word with no shape. Sent to track 1 at 13:55 UTC.
- #127 finding 1: once the wrap-up has closed, no screen lets an admin start the next year. Sent to track 5 at 14:20 UTC.
- #113 finding 1: on a computer, Settings can't be scrolled to its foot. Sent to track 1 at 19:15 UTC.
- #141 finding 1: Undo pressed after switching workspace saves into the workspace now open. Sent to track 4 at 19:25 UTC.

The ten PRs merged between 17:28 and 18:04 UTC were each read first by a separate reviewing session with the same brief, in the demo and the code. Every high finding, and each medium marked "re-run" or "read", was then checked again by this reviewer; the rest are the first reader's, each with its own reproduction, and are marked "first reader".

Medium and low findings were sent to each track in one batch: track 4 at 14:00 UTC (#122 to #128) and again after #131; tracks 1, 2 and 5 after #131.

## Pull requests

### #121 Day one reads only what it uses; the AR4 lint counts whole lists by another name (track 2, merged 12:42 UTC)

Closes the last round's open finding on #104. `gettingStarted` now takes `DayOneRows`, made by `dayOneRows` in `src/app/reads.ts`; the same rows give the same answers for every worked example, and Home is unchanged on screen. The lint now counts a `Pick<Snapshot, …>` that names goals, checkIns, changes or requests, and a cast to `Snapshot`; the allowed list grew from 74 uses in 18 files to 92 in 21 because it now sees what was already there.

**1. Low. The lint still has spellings it doesn't see.** `Omit<Snapshot, …>`, a type alias of `Snapshot`, and an `ActionContext` (which carries the whole workspace twice; readiness review, finding 6) all pass (`scripts/check-layers.mjs:70-76`). The last is already in the handover as known. Worth one line in the lint's comment so nobody reads it as complete.

Nothing else found.

### #122 AX1: the workspace check holds, migration 0038 (track 4, merged 12:43 UTC)

**The migration.** Faro-only (both functions are `faro.`-qualified with `search_path = faro, pg_temp`), safe to run twice (`create or replace`, nothing else), no new object so no grants to write, and `okr_write` is 0033's body with the one stage delete narrowed. Every table the new loop names has `id` and `workspace_id`. Feedback and the change log are insert-only (`okr_feedback_add`, `'nothing'`), and a save writes no tokens, so leaving those three out of the stored-row check is right. `okr_create_workspace` calls the same check, so a new workspace can't take another's rows either. Ids are global by design (`Onboarding.tsx:160`), so no ordinary save is newly refused. Both proofs from the readiness review now fail as they should (`src/data/rpc.test.ts:166`), and the contract case runs on all three adapters.

**1. Medium. A save can still tie its own rows to another workspace's records, and that workspace can then not be deleted.** The kit now says the database "checks that every row belongs to the workspace … and nothing else", and stage 2's exit criterion says a save "never changes another's records". Both hold word for word; what a row *points at* is not checked.

- Where: `supabase/migrations/0038_workspace_check.sql:17-48` checks each row's own `workspace_id` and the stored row with the same id. It does not check `owner_id`, `team_id`, `cycle_id`, `parent_id` or a check-in's `goal_id`.
- Reproduced on PGlite as `anon`, two workspaces A and B: a save to A of a new goal whose `owner_id` and `parent_id` are B's person and B's goal is accepted; `okr_delete_workspace('ws_b')` then fails with `violates foreign key constraint "okr_goals_parent_id_fkey"`. A check-in saved to A on one of B's goals is accepted too, stored under A (B never sees it; it is deleted with B's goal).
- Why it matters: only for the kit. In Faro the public key can do far worse. But a team that keeps `okr_commit` behind its own sign-in and reads "every row belongs to the workspace" has a member of one tenant able to block another's deletion and to hang rows on its goals.
- Suggested fix: either a fourth check in `okr_same_workspace` (each of those references, where set, names a row stored under `ws` or carried in this save), with a case in `storeContract`; or a sentence in `ports-at-scale.md` and stage 2 saying references across workspaces are the server's to refuse (R1, rule 3). The second is a spec-only change.

Nothing else found.

### #123 AX3: a sign-in seam that takes a sign-in (track 4, merged 13:00 UTC)

`Identity` is passed in beside the store, answers later, and has `choose` only on the picker; the contract is split and runs on a sign-in by email. Every save path was traced: `run`, `issueToken` and `commit` (which `postCheckIn`, `saveGoal` and `applyChanges` end in) all stop when nobody is known, so the stand-in person can no longer act. For Faro itself nothing changes: the picker is still the identity, and the app showed "Who are you?" before any screen already.

**1. Medium. The kit says someone not signed in "can look but can't save"; in the code they can't look, and the screen they get tells them something that may not be true.**

- Where: `src/App.tsx:45` replaces every route with `<WhoAreYou />` while `viewerChosen` is false; with an identity that has no `choose`, `src/screens/Start.tsx:16-26` shows only "You're not in {ws} yet. No one here has the email you signed in with. Ask whoever set up {ws} to add you." `spec/rebuild/adapters.md` (from `src/spec/rebuild.ts`, the Sign-in bullet), `docs/handoff.md` and `src/ports/index.ts:26` say they "can look but can't save anything".
- Three different causes reach that one sentence: nobody is signed in at all (`signIn.ts:13`), nobody has the email, and two people in the workspace share the email (`signIn.ts:15` answers null for more than one match). Only the second is what it says.
- It is also a dead end: no way to another workspace the person *is* in, or to set one up. With the picker the same screen is the way in, so Faro never shows this.
- No test or eval renders that screen (`src/app/signedIn.test.tsx` mounts `AppProvider` without the routes).
- Suggested fix: make the words true one way or the other. Cheapest: change the kit's sentence to "sees only a page saying to ask an admin", word the page so it covers all three causes ("We couldn't match your sign-in to anyone in {ws}"), keep the workspace switcher on it, and render it once in `signedIn.test.tsx`.

**2. Low. Who is signed in is asked once, when a workspace opens** (`src/app/state.tsx:345`), not on the reload every two minutes or on focus. A session that ends, or a person marked as left, keeps acting until the tab reloads. Fine for a seam; worth a line in `adapters.md` so a team doesn't copy it as the rule.

### #125 Fence check: Supabase's own tables open to everyone by default are a warning, not a leak (planning session, merged 13:07 UTC)

The exemption is narrow and was checked case by case: a table in `extensions`, `cron` or `net` is a warning only while every grant that reaches the role is to PUBLIC; a grant to `faro_owner`, or to a role it is in, still fails (the new test proves both). Anything in another app's schema still fails. What those tables expose to the role is its own cron jobs (row rules), statement statistics without other roles' query text, and pg_net's queue.

**1. Low. Two pages still say the old rule.** `docs/architecture.md:121` says the check "fails if the role can read or write any table outside `faro`"; it now warns for these three schemas. `supabase/README.md` should say the same. Also worth saying there: `net.http_request_queue` open to everyone means the Faro role can ask the database to make web requests, which no grant of Faro's can close.

### #124 AX10: pages that tell the truth (track 4, merged 13:09 UTC)

The pages named now match main, the ports pointer is right, and `src/docPaths.test.ts` fails a page that names a file that isn't there. The MCP server writes each failure to standard error with a reference the caller gets (`server/log.ts`); nothing secret is written (the stack only; the token is never in it).

**1. Low. One sentence the item set out to fix is still there.** `docs/architecture.md:11` still lists "reviews, asks, Watching, the goal map, markup and inbox" as examples of feature modules, eight lines of table above the new "Core, and staying core: reviews, asks, Watching and the map". Only spreadsheets and the metric library are modules.

### #110 FS3: Find from anywhere (track 1, merged 13:20 UTC)

Read against `docs/design/find/spec.md` 2.4, rules 5 to 8 and section 7, and opened in the demo at 1440 and 390. The rule is pure and asked through the `Search` port (`findSteps` as one generator answered at once or later is a good shape); Find saves nothing, so there is no action to dispatch. What's new, the guide, the requirement `FIND-ANYWHERE` and journey U65 are all there. Groups, counts, "See all", the key alone, the near miss, "(left)", Escape, the focus trap and the phone's full screen all behave as the spec says. No stripes, capsules or glyph icons; nothing scrolls sideways.

**1. High. A goal's status in Find is a coloured word with no shape.** The design rule the app is built on: status is a shape plus a word, always together. Sent to track 1 when found.

- Where: `src/ui/Pick.tsx:195` (`RowText` renders `<StatusWord className="pick-status">`), used by `src/ui/Find.tsx:121`. No stylesheet sizes `.pick-status` or the `svg.status-shape` inside it, so the shape is in the page at 0 by 0.
- Reproduced: Ctrl K, "rhea": each Goals row reads "Off track Lead time for changes" with no ring; `getBoundingClientRect()` of the SVG is 0 x 0 at both widths. "Opened lately" is the same.
- The same rows in find-and-pick have had it since FS1 (`/reviews/new`, "Single goals", type "lead": 0 x 0). Find puts it on every page.
- Why no check caught it: P3 and P4 (`evals/journeys.cjs:4147-4175`) visit a fixed list of routes, never open Find or a picker, and look for a shape without a word, not a status word without a visible shape. The find spec's "P3, P4 extended: a goal row in a picker and in Find has its status shape with its word" was not built. U65 reads text only.
- Suggested fix: size the shape in a row (`.pick-status { display: inline-flex; align-items: center; gap: 4px }` and a 12px `status-shape`, as other rows do), and add to P3 and P4 a step that opens Find and one goal picker and fails a `.pick-status` whose shape has no size.

**2. Low. The key rule is written twice.** `keyOf` (`src/domain/find.ts:117-120`) is `searchKey` (`src/domain/query.ts:130-133`) line for line, and the spec's 2.4 names `searchKey` as the one to call. `query.ts` already imports from `find.ts`, so `searchKey` can become `keyOf` and go.

**3. Low. "See all {n} people" can promise more than the list shows.** Find counts people marked as left (`filters: { left: 'too' }`, `find.ts:138`); the link opens `/people?q=`, which may not list them. Not met in the demo (nobody has left). Either leave the left out of the total behind "See all", or have the link ask People for them too.

**4. Low. "Opened lately" never shows a module's kind.** `Find.tsx:66` keeps only recents whose kind is in `CORE`, so once the metric library registers its finder (AS part 2), a metric opened from Find won't come back there. Use `kindOf`.

**5. Low. Ctrl K closes whatever sheet is open and throws away what was typed in it** (`src/ui/Shell.tsx:171`, `setSheet(null)`): a half-written feedback message is gone, as it is on Escape. Find could open over the sheet, or the key could do nothing while a sheet with text is open.

Also seen, not from this PR: a key with another word finds nothing ("G-48 rollback"), because a search that starts as a key is matched as a key only (`find.ts:28-29`, from FS1).

### #126 AX7: the Supabase adapter, tidied (track 4, merged 13:23 UTC)

The fallbacks for migrations long applied are gone, a read that fails fails the load, a missing function says so, and a save is one call. Every commit that carries a token was traced (`src/domain/actions.ts:377` and `:386`, `server/mcp.ts:142-150`): each is one token and its one change, so the new refusal of anything else is never met by the app or the AI tools. The stand-in tests cover all three claims.

**1. Low. The two database adapters now disagree about a save that carries a token with other rows.** Supabase's refuses it (`goalsStore.ts:118-124`); plain Postgres's still splits it across transactions (`src/adapters/postgres/goalsStore.ts:97-101`). Nothing sends one, but the kit calls both the pattern; the contract could carry the case.

### #128 AX4: a scale fixture and two budgets in CI (track 4, merged 13:31 UTC)

The scale test is sound: the 10x workspace has ids of its own per copy, the limits are well above today's figures, and the per-goal growth check is the one that matters. The cached formatters and `decisionsFor` change no answer (the conformance rows are unchanged); the index is rebuilt when the list's length or last entry changes, which is safe while snapshots are replaced, never edited in place, as they are. A stale chunk after a deploy is already handled (`src/telemetry/staleCode.ts`).

**1. Medium. The bundle budget watches one file, and the first download has not fallen.** The PR, the handover and R4 (`spec/requirements/internal/r4-scale-and-safety.md`, from `src/spec/internal.ts:315`) say the first download fell from 416 to 241 KB compressed and that CI fails a change that takes it past 250.

- Where: `scripts/check-bundle.mjs:12-14` measures `dist/assets/index-*.js` only.
- Measured on a production build of main: `dist/index.html` loads the entry and preloads five more files that the entry imports before anything draws (`state` 84 KB, `changeset` 50, a shared chunk 15, `goalKey` 13, `store` 4, compressed). Entry plus preloads is 409 KB compressed. The same sum on the commit before (#126) is 423 KB. So the split moved code into files the check doesn't read; a first visit downloads about 3% less JavaScript, not 42% less.
- Why it matters: the budget is the pattern R4 asks the internal app to copy, and as written it passes while the thing it guards grows: anything added to `state` or `changeset`, or anything the bundler moves out of the entry, is free.
- Suggested fix: sum the entry and every `modulepreload` in `dist/index.html` (or follow the entry's static imports), set the limit at today's real figure (about 410 KB), and correct the three sentences. The lazy routes are worth keeping; the next real saving is whatever keeps `changeset` and most of `state` out of a first visit.

Nothing else found.

### #127 CY1: a year ends on its last day (track 5, merged 13:45 UTC)

Read against `docs/design/cycle-end/spec.md` rules 1 and 2, and opened as U117 does (the example copied into a workspace of its own, so 2026 stays 2026) on 11 Jan and 5 Feb 2027. The dates and states match every worked example in rule 1; `resultWeek` is rule 2's formula, and every caller of `goalResult` and `quarterResults` now uses it (checked one by one), so no two screens disagree about a result. After the last day nothing is due, late or out of date on Home, Goals, Check-in or a goal. The rules are pure and take the day passed in. What's new, the guide, the rule page, the requirement and U117 are there.

**1. High. Once the wrap-up has closed, no screen lets an admin start the next year.** Sent to track 5 when found.

- Where: `src/screens/Retro.tsx:105` shows "Start next year" only while `wrapUpOpenOn` is true, which is false from the day after `wrapUpCloses` (four weeks after the last day). `src/screens/Workspace.tsx:280-284` then offers only "See the wrap-up"; Home's admin card and Goals' "Wrap up" are gone too.
- Reproduced as an admin on 5 Feb 2027: Cycles reads "2026 · ended 3 Jan 2027 … See the wrap-up"; `/retro` reads "The wrap-up closed on Sun 31 Jan 2027." and has no button; the frame says "2026 has ended". On 11 Jan the same pages show "Start it". Before CY1 the wrap-up, and with it the start, stayed open for as long as nobody started the next year, so this is new: a workspace that is four weeks late stays in an ended year for good.
- The rule and the screens disagree: `startNextCycle` and `saveRetro` (`src/domain/actions.ts:291`, `:306`) still test `wrapUpOpen(x.cycle, x.week)`, and the week stops at the last one, so both are allowed for ever. The `start_next_cycle` AI tool still works after the close, and a wrap-up can still be saved through the tools though the page says it has closed.
- No eval reaches the `closed` state: U117 stops at 11 Jan.
- Suggested fix: starting the next year is not part of the wrap-up's window. Offer it whenever the current cycle is ending, ended or closed and no later cycle exists; make `saveRetro` and the page use one test for whether a wrap-up can still be saved; add 5 Feb to U117. CY2 rebuilds the start page and can carry this if it is the next merge.

**2. Low. "Getting started" still says a first check-in is due after the year has ended.** Someone who first opens the workspace after its last day, owning a goal with no check-in, reads "Post your first check-in. It's due by Thursday." beside "2026 has ended: nothing more is due" (`src/domain/dayOne.ts`, the `first-check-in` row; seen on 11 Jan as Rhea). `dayOneRows` could carry whether the cycle has ended.

**3. Low. A goal's page still forecasts an ended year.** On 11 Jan, G-1 reads "Will it hit 24? Very unlikely · likely 37 hours by year end", in the future tense, eight days after the end. The spec's 2.6 and CY7 say how a goal's page reads once ended; worth making sure one of them owns this line.

### #131 AX8: the kit shows the database as it is (track 4, merged 13:48 UTC)

`spec/core/schema.sql` and `spec/rebuild/access-today.md` are read back from PGlite after every migration by `npm run spec`, so they cannot drift from the migrations. `Deps` has a contract that runs in memory, on plain Postgres and on Supabase's adapter over a stand-in client. The token fallbacks removed from `supabaseDeps` were for databases before 0024.

**1. Medium. The access page leaves out grants on single columns, so three ways to write are missing from the page that says it lists them all.**

- Where: `src/spec/schema.ts` reads a table's grants only (`relacl`); a grant on columns lives on the column.
- Checked on PGlite after every migration: `okr_feedback` is listed as "Granted to nobody … Functions only" in spirit, but `anon` may insert seven of its columns directly (0026), and an insert as `anon` passes the permission check; `okr_markups` is listed as "anon: select, insert; authenticated: select", but both may update six of its columns. The page shows the row rules for these ("demo: add", "markups: anyone triages") beside a grant list that says they can't be used.
- Why it matters: the page says "Read this page, not the migrations, for the access surface". A team that does so misses that feedback can be written, and markups changed, without going through a function.
- Suggested fix: add `pg_attribute.attacl` (or `information_schema.column_privileges`) to the query, shown as "anon: insert (7 columns)", and a test that the page's grants for `okr_feedback` include insert.

**2. Low. `postgresDeps` keeps the last token's hash in one variable** (`src/adapters/postgres/server.ts:14`), so a server that makes one `Deps` and serves two requests at once stamps the wrong token as used. Supabase's does the same but is made per request (`server/vercel.ts`). The file is "the one to copy": say "make one per request", or key `touch` by the token id it is given.

**3. Low. The contract's "notes a token as used" asserts only that nothing throws** (`src/ports/contracts/deps.ts`), so a `touch` that does nothing passes. Reading `lastUsedAt` back from `load` would make it a test.

### #143 CI: fall back to Chromium alone when apt can't reach Ubuntu's mirror (planning session, merged 17:27 UTC)

From about 14:13 UTC every CI job stopped at `playwright install --with-deps` because the runners could not resolve Ubuntu's mirror (this log's own PR, #134, was red for that reason). The fallback installs the browser without system packages only when the full install fails, and says so as a warning; "Screens that look different" builds both branches in the same job, so missing fonts affect both pictures alike.

**1. Low. The privacy eval's new test for the typed number has a blind spot.** `evals/telemetry.eval.ts:167` now passes unless "7319" stands with no hex digit on either side, so that a random trace id holding those digits doesn't fail it. A leak inside an encoded address would also pass: in `%207319` or `%3D7319` the character before is a hex digit. Telemetry bodies are JSON today, so nothing leaks this way now. Safer: take the trace and span ids out of the text before looking, and keep the plain `not.toContain('7319')`.

### #128, a late note

#141's description records that main's full evals were red from #128 to #141: F7, P10 and N5 read Data a fixed time after opening it, and #128 made Data load when opened. This review judged the lazy routes safe on reading and did not run those three checks; it should have.

### #130 IM0, IM1: the round trip and the field table (track 3, merged 17:28 UTC)

Read against `docs/design/import/spec.md`. IM0's round trip held on every input tried (`sameAsWritten` against `planWeekValue`; the demo on four days). Example rows are skipped before any other rule. `src/domain` stays pure.

**1. Medium (read). The field table says an empty Admin cell keeps what is there; the engine reads it as "no".** `src/domain/columns.ts:561` has no `clears` for Admin, and Help says "an empty cell keeps what is there, except where the table says empty clears it"; `src/domain/changeset.ts:245` and `:280` turn a present, empty Admin into not an admin. The first reader ran it: an existing admin's row with Admin blank previews as "Admin: Yes to No". The template carries the column, so this is an easy way to demote someone; the preview does show it. Fix: mark Admin as clearing, in the table's words, or make the engine keep.

**2. Medium (read). The table says Takes over accepts "An email, or a name only one person has"; the engine takes an email only** (`columns.ts:563`; `changeset.ts:251`, `pickPerson(r, { email: 'takes over' }, …)`). A name gives "Takes over: “Tariq Haddad” isn't an email."

**3. Medium (read). The field-table test cannot fail for the case it is there for.** `src/domain/fieldTable.test.ts:37-41` inspects only columns that already have a row in the table, so a new column with none passes; the first reader spliced one in and all three assertions held. Fix: assert every column that isn't worked out has a row, and every row names a real header.

**4. Medium (read). The spreadsheets module's table sits in a core screen.** `src/screens/Help.tsx:27-72` and `:154` draw the module's field table and its "Download the template", switched on by the article's id. Architecture: "never by editing a core screen". The same download call is written three times (`Help.tsx:51`, `Import.tsx:55`, `DataMenu.tsx:30`).

**5. Medium (re-run). Two journeys are both `U87`.** `evals/journeys.cjs:3408` (Goals' menus, from #112) and `:4512` (the field table, from #130). The spreadsheets module lists U87 as its own (`src/modules/spreadsheets/module.json:14`) and `evals/run.mjs:68` leaves a module's journeys out by id, so "Core journeys without spreadsheets" leaves out the core Goals journey too, and `ONLY=U87` runs both. Not run; read from the two files. Whichever track renumbers, both should know.

**Low (first reader).** Example rows are counted but only the Import page says how many (`bulk_change` and the Data preview read as "nothing changed"). `sameAsWritten('', 0, d)` is true, harmless until a caller passes a raw cell. `/help/columns` is not in P6's routes.

### #112 GL2: the view menus (track 1, merged 17:46 UTC)

Read against `docs/design/goals/spec.md`, GL2. The head, tabs, bar, count line and Views menu sit in the same place in all five layouts; the menus' contents and order match the spec; nothing scrolls sideways from 360 to 1440.

**1. Medium (read). Coming back to the Map jumps to the last goal found.** The Goals screen keeps the "go to this goal" request and never clears it (`src/screens/GoalsScreen.tsx:136`); the Map acts on it whenever it mounts (`src/screens/GoalMap.tsx:253`). First reader: find G-48 on the Map, Layout: List, Layout: Map: G-48 is outlined and panned to again.

**2. Medium (read). Emptying the Map's search doesn't un-narrow it.** In Map mode the box writes to the address only on Enter (`src/screens/GoalFilters.tsx:210`), so clearing it leaves `q=` and six goals.

**3. Medium (read). Sort is still offered on the Map on a phone.** Only the inline Sort takes `sortOff` (`GoalFilters.tsx:95-96`, `GoalsScreen.tsx:266`); the one in the Filters sheet doesn't.

**4. Medium (first reader). P6 never opens the Layout, Group or Views menus or the phone's View sheet**, which the spec's section 6 asks for; closed, they have no box and are skipped.

**5. Medium (first reader). New behaviour with no eval:** Pin for everyone, Rename, the "Current" mark, the "In the tree of" picker in Filters, the Map search's no-match line and keys.

**6. Medium (read). The phone layout starts at 600px; the spec's 2.4 says under 700** (`src/styles/notes/goals-phone.css:72`). At 650 the page has the phone's frame and the computer's menus.

**Low (first reader).** The phone's count line is cut to one line where 2.4 says two. At 1280 "Layout" wraps to a row of its own. Two saved views with one name give duplicate React keys. "Delete this view…" drops `?today=`. Saved-view rows in the View sheet are 40px high on a phone.

**Seen, not from this PR (first reader, not re-run):** an address with no `view` draws the person's last layout, so a copied List link opens in the reader's last layout, against GOALS-ADDRESS. Worth a look by track 1.

### #113 NV2: where you are (track 1, merged 17:46 UTC)

Read against `docs/design/navigation/spec.md`, NV2. Titles and the lit item were right on about 40 addresses at both widths; the back link is right in a new tab for a goal, person, team, review and Help article.

**1. High (re-run). On a computer, Settings can't be scrolled to its foot.** Sent to track 1 when confirmed.

- Where: `src/screens/Settings.tsx:121` calls `scrollIntoView({ block: 'nearest' })` on the lit section link each time it changes. The link is in a sticky row at the top (from 761px), and `html { scroll-padding-top: 72px }` (`src/styles.css:1421`) makes the browser pull the whole window up to "show" it.
- Reproduced at 1440 by 900: forty 60px wheel steps leave `scrollY` at 352 of 870, cycling 300, 344, 260, 304…; End lands at 678; "Leave this workspace…" stays at 948 to 988 in a 900px window. At 390 it reaches the foot.
- No eval mentions the section links.
- Fix: move only the row sideways, and only when it overflows.

**2. Medium (first reader). A goal opened from a saved view says "Back to Goals", not the view's name** (rule 4.2). `src/ui/BackLink.tsx:37` compares the stored params raw; the menu's lookup (`GoalFilters.tsx:56-62`) converts old-form params first. One lookup, written twice, disagreeing.

**3. Medium (read). "What is a form" is written twice and has drifted** (`FORM`, `src/domain/navigation.ts:209`; `focusMode`, `src/ui/Shell.tsx:225-227`). They differ on bare `/check-in`, `/import` and `/goals/new/<step>`. See #114 finding 2 for what it causes.

**4. Medium (first reader). "One closing control, with the words" isn't built on three of the five forms** (2.5 item 3): goal edit and New goal have an icon only, the table check-in has none at the top. U72 accepts the icon and never opens the table check-in, so it can't fail; What's new says "A form has one way out, in words".

**5. Medium (first reader). Page not found has no Find field** (2.6); `src/App.tsx:129-137` has "Go to Home" and "Help" only.

**6. Medium. No eval for Settings' section links** (finding 1 would have failed a single scroll to the foot), or for the saved-view back link.

**Low (first reader).** A malformed `%` in the address blanks the app (`navigation.ts:165`, an unguarded `decodeURIComponent`). A not-found address under a place is named and lit as that place. After a hand-typed address mid-session the back link can name one page and lead to another. Renaming a team in place jumps the page to the top.

### #114 NV3: the check-in queue (track 1, merged 17:46 UTC)

The list uses `weekProgress().due`, as the badge does; rows have a visible status shape and word; drafts behave; nothing here saves by itself.

**1. Medium (read). "Start with …" can walk a goal already checked in, and its count disagrees with the list.** `src/screens/CheckInFlow.tsx:55-64` reuses the tab's kept queue whenever every due goal is in it, without dropping the ones done since. First reader: with 5 due, start and close the walk, check in on row 3 from the list (the list says 4), "Start with" opens "1 of 5" and reaches the goal just done.

**2. Medium (read). The check-in list is still counted as a form, so Back skips it.** `FORM` matches bare `/check-in` (`navigation.ts:209`); NV3 made it a first page (`:206`) and changed the Shell's copy only. First reader: Home, Check-in, Help with this page: the link says "Back to Home".

**3. Medium (first reader). U71's gaps:** it never presses "Correct it", doesn't check that "Start with" opens the first listed goal or that the walk's "n of m" is the list's count, and the day-one date line is logic in a screen with no unit test.

**Low (first reader).** "Or type all your numbers in one table" is 22px high on a phone. After posting from a row the only ways on are "Back to home" and "View the goal". The due-by sentence is written twice, in different words (`CheckInQueue.tsx:28`, `Home.tsx:42-43`). Day one's "Start check-in" still opens the list (`src/domain/dayOne.ts:92`).

### #111 FS1: pick everywhere (track 1, merged 17:46 UTC)

Edit goal's owner, team, feeds and also-helps keep ids and refuse what they should; Escape closes only the picker; chosen values are plain text with Change or Remove. The status shape in a goal row is still missing (#110 finding 1).

**1. Medium (first reader, with measurements). On a computer the open picker is cut off by a sheet or a table it sits in.** `.pick-panel` is positioned under its field (`src/styles.css:1450`) inside boxes that clip (`.sheet`, `.data-wrap`). In the Demo sheet, typing "tunde" puts the one row at y 899 to 951 in a 900px window, in a sheet that can't scroll; on Data with two rows the panel shows only its search field. Playwright scrolls to the option, so U91 passes. Fix: draw the panel in a portal, flipping up when there is no room, and check an option's box is on screen.

**2. Medium (read). Set-up: with two people of one name, picking the second gives the goal to the first.** The picker works by id but the row is kept by name and read back by the first match (`src/screens/Onboarding.tsx:199-200`). The field then shows the other person.

**3. Medium (first reader). Rule 6's order for "Feeds into" isn't built and nothing says why:** `suggest` takes no context (`src/domain/find.ts:311`), so a Team-level goal's picker offers your own goals first, not the level above in your team.

**4. Medium (read). In the app, someone marked as left is never found, though the contract and the spec say they are.** The search is built from `app.snapshot` (`src/app/search.ts:21`), from which `scopeToCycle` has already dropped everyone who has left (`src/domain/cycle.ts:43`); the contract (`src/ports/contracts/search.ts:86`) builds it from the unscoped example. First reader: mark Oskar as left, Ctrl K, "oskar": "Nothing matches". This corrects this log's entry for #110, which took "(left)" as working on the strength of the unit test.

**5. Medium (first reader). No test for:** `searchOver` and `searchNames`, Data's "No team" and "No email yet", New goal's Team and Owner saving, and a desktop panel being visible in a sheet or table.

**Low (first reader).** A chosen value the search can't return reads as nothing chosen (`src/ui/Pick.tsx:119`, `:158`). "Also helps" refuses the parent with "It feeds this one already", which is the reverse. New goal on a phone: "Change" is 22px high.

### #115 FS2: the list bar on Data and Feedback (track 1, merged 17:46 UTC)

Search, filter and sort are in the address and survive a reload; Back steps through them; the filter line is plain text with Remove.

**1. Medium (read). Data and Feedback don't search by rule 1.** `src/domain/tableFilter.ts:63` and `src/markup/inboxList.ts:66-68` match a substring of any cell; neither calls `textMatches`. The guide says they "search the same way": on Data "back" finds 34 rows (rule 1 says none by "back" alone) and "g48" finds none.

**2. Medium (first reader). Data's search matches columns that aren't shown** (2.1: "every shown column's text"): `q=example.com` with Owner email hidden says "126 rows match."

**3. Medium (first reader). Data's "Filters" opens the old one-filter dialog, not 2.2's sheet**, with no note of the departure; an existing filter can no longer be changed, only removed and added again.

**Low (first reader).** Choosing a Data tab replaces the history entry (`src/screens/DataTables.tsx:80`), where rule 4 adds one. With a search on and a sort set, the count line offers "Remove the sort" without saying a sort is on.

### #117 FS4: company size, N12 (track 1, merged 17:46 UTC)

The fixture really is 15,000 people, 1,500 teams and 30,000 goals, and N12 passes.

**1. Medium (read). N12 never opens the Goals list** (`evals/finish/11-company-size.cjs:97-101`; its comment calls it "another session's (GL2)", which has merged). First reader, same fixture: `/goals?scope=all` takes 6.6 s and draws all 30,000 goals; a search had not answered in two minutes. The spec's budget is 300 ms for every list bar.

**2. Medium (read). N12 doesn't time Find, and says Find "isn't built yet"** (`:4-5`); it merged in #110. First reader: 174 ms to 3.3 s to first results.

**3. Medium (first reader). The picker's timer can stop on the count of the suggestions**, shown as soon as a key is typed (`src/ui/Pick.tsx:159`, `:197`), so it doesn't prove the search answered.

**Low (first reader).** The 25-option check sees only selects present when a page opens; Data's filter dialog has one with 43. The picker shows "6 match" for an instant on the first key.

### #148 Track 1 handover (merged 17:54 UTC)

One line of `docs/handover.md`. Nothing to review.

### #141 Undo brings a feature back; main's Data checks wait for the screen (planning session, merged 17:58 UTC)

The fix does what it says: switch Spreadsheets off, Undo, and it is on again after a reload; the same twice quickly. The evals' new waits time out and carry on, so they can't hide a failure or hang.

**1. High, in a narrow window (re-run). Undo pressed after switching workspace saves into the workspace now open.** Sent to track 4 when confirmed.

- Where: `src/app/state.tsx:507`: `rx()` builds the action from the workspace the toast was made in, and `commit` (`:397-404`) writes to whichever is open. Before this PR a late Undo found nothing to change and saved nothing.
- Reproduced: in the example, switch Spreadsheets off; open the switcher, choose a second workspace, press Undo within the toast's ten seconds. The toast says "Spreadsheets is back on."; the example is still off; the second workspace's change log gains "Switched on Spreadsheets".
- The Undo after a removal reaches the same `commit`; older, and not reproduced.
- Fix: carry the workspace's id with the action and drop one that isn't the open workspace's; clear toasts on a switch; add it to U48.

**2. Medium (read; first reader ran it). Undo overlapping another switch saves a stale list.** "The workspace as it is now" is as new as the last render (`state.tsx:294-295`; `setWorkspaces` runs after the save), `setModule` saves the whole list, and Undo isn't held by the page's `busy` guard. Undo and a second switch in the same tick left both features off.

### #116 find_goals takes a scope (track 1, merged 18:04 UTC)

The tool calls `scopesFor`; `api/mcp.js` is the built output; a wrong scope is refused with the list of right ones.

**1. Medium (read). A Goals link's `scope=` is ignored by `query`.** `src/mcp/tools.ts:211` parses the link with `parseQuery`, which has no scope; only the `scope` argument is read (`:234-238`). First reader, as Tariq: `{ scope: 'mine' }` gives 3 goals, `{ query: 'scope=mine' }` gives 126. Every Goals address now carries `scope=`, and the description promises "the query of a shared Goals link".

**2. Medium (first reader). The facts the scope rule reads are written twice** (`src/app/reads.ts:37-44`, and the same object inline at `src/screens/GoalsScreen.tsx:55-60`); the copies already differ on removed goals, with no visible effect today.
