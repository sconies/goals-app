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
| #137, #161 Handovers | planning, 4 | 0 | 0 | 0 |
| #140 Goal page: modules' sections sit inside About | 2 | 0 | 0 | 0 |
| #133 CY2: starting the next year only prepares it | 5 | 1 | 8 | 3 |
| #156 CK1: one way to save a check-in | 1 | 0 | 0 | 1 |
| #157 Two fixes: status shapes in Find, Settings scrolls | 1 | 0 | 0 | 0 |
| #154 AX9: browser state behind the ports; review fixes | 4 | 0 | 5 | 3 |
| #160 CK2: the levels in a check-in | 1 | 0 | 3 | 4 |
| #164 Migration 0039: a module's records | 3 | 0 | 0 | 3 |
| #163 Two journeys called U87 | 3 | 0 | 0 | 0 |
| #142 CF1: levels read from one place | 5 | 0 | 5 | 0 |
| #167 Help loads when opened | 4 | 0 | 1 | 2 |
| #139 AS part 2: the metric library as a module with its own records | 3 | 1 (older) | 1 | 3 |
| #168 Goals rewrites its address only while on Goals | planning | 0 | 0 | 1 |
| #152 CY4: the carry rule, and what comes with a goal | 5 | 3 | 6 | 3 |
| #170 Last year's wrap-up stays open once the next year is current | 5 | 0 | 0 | 0 |
| #172 Review fixes for #154 and #141 | 4 | 0 | 0 | 0 |
| #166 An action made in one workspace never saves into another | 4 | 0 | 0 | 2 |
| #175 Undo after a removal stays undone on the database stores | 4 | 1 | 0 | 1 |
| #144 ML1: the metric library as a place, and a page per metric | 3 | 0 | 4 | 10 |
| #177 Undoing an import puts deleted, stopped and left rows back for good | 4 | 0 | 0 | 0 |
| #179 Carried copies stay true after every save (review of #152) | 5 | 1 | 1 | 0 |
| #145 IM2: problem levels | 3 | 1 | 6 | 5 |
| #135 History: an ask counts under Reviews by its own reviewId | 1 | 0 | 0 | 0 |
| #180 A parent and its child moving in one save are written once (review of #179) | 5 | 0 | 0 | 0 |
| #181 Set-up never leaves a row out quietly; the grid takes a decimal comma (review of #145) | 3 | 0 | 0 | 0 |
| #129 OB1: New goal asks in a better order, each step an address | 2 | 0 | 6 | 6 |
| #183 Offline, a page that loads when opened says it needs a connection (review of #167) | 4 | 0 | 0 | 0 |
| #187 AS part 3, the rest: migration 0040, records tests | 3 | 0 | 0 | 0 |
| #190 The first download: 369 KB to 282 KB | planning | 0 | 0 | 0 |
| #184 GT3: Change a goal is one page with one way out | 2 | 0 | 0 | 2 |
| #186 GE1: the form and the engine run one set of rules | 2 | 0 | 1 | 0 |
| #189 GE2: questions in place | 2 | 0 | 2 (+1 older) | 5 (+1 older) |
| #185 ML2: measured by; Goals filtered by a metric | 3 | 0 | 4 | 6 |
| #188 ML3: looking after metrics | 3 | 0 | 3 | 2 |
| #191 IM3: the import's preview | 3 | 0 | 4 | 3 |
| #194 GE9: dates picked | 2 | 0 | 5 | 7 |
| #198 Metrics: the build review's findings on ML2 and ML3 | 3 | 0 | 0 | 0 |
| #201 Backlog: NR | planning | 0 | 0 | 0 |
| #197 Goal entry review fixes | 2 | 0 | 0 | 0 |
| #195 IM4: past imports | 3 | 0 | 4 | 7 |

**High findings, and where each stands**

| Finding | Sent | Now |
|---|---|---|
| #110: a goal's status in Find and the picker is a word with no shape | Track 1, 13:55 UTC | **Fixed** by #157; seen on screen at 12 by 12, and P3/P4 now open Find |
| #127: once the wrap-up has closed, no screen lets an admin start the next year | Track 5, 14:20 UTC | **Fixed** by #133: the start is offered from the day the wrap-up opens, with no end; U117 covers 5 Feb |
| #113: on a computer, Settings can't be scrolled to its foot | Track 1, 19:15 UTC | **Fixed** by #157; seen reaching 870 of 870, and a journey scrolls it |
| #141: Undo pressed after switching workspace saves into the workspace now open | Track 4, 19:25 UTC | **Fixed** by #166; re-run on screen at 01:10 UTC on 12 Nov: the Undo is refused, says so once, and neither workspace changes |
| #133: once the next year is current, the old year's wrap-up can't be reached or saved | Track 5, 21:50 UTC | **Fixed** by #170 (read, with its new unit tests; not re-run on screen) |
| Met in #139, older: on the database stores, Undo after a removal doesn't bring the record back | Track 4, 23:56 UTC | **Fixed** by #175 for Undo from a toast (read; its new store contract case passes on all four stores) |
| #175: undoing an import or bulk edit that deleted or stopped a goal, or marked someone as left, has the same fault and was not fixed | Track 4, 01:15 UTC, 12 Nov | **Fixed** by #177 (read; its store contract case is the reproduction, on all four stores) |
| #152: after an early start, "Stop" then "Carry it on" makes a second copy under a new key | Track 5, 00:35 UTC, 12 Nov | **Fixed** by #179 (read, with a unit test for each; single-goal paths re-run) |
| #152: a parent's copy leaves the new year and its children's copies keep pointing at it | Track 5, 00:35 UTC, 12 Nov | **Fixed** by #179 (read, with a unit test for each; single-goal paths re-run) |
| #152: most ways of changing the old year never run `recarry` | Track 5, 00:35 UTC, 12 Nov | **Fixed** by #179 (read, with a unit test for each; single-goal paths re-run) |
| #179: on the database stores, a save that moves a parent's copy and its child's copy together is refused whole | Track 5, 03:15 UTC, 12 Nov | **Fixed** by #180; the reproduction re-run in both orders: no record twice, and the child's copy returns under its parent |
| #145: set-up from a spreadsheet drops a goal whose owner or word is one letter out, and says nothing | Track 3, 03:35 UTC, 12 Nov | **Fixed** by #181; the reproduction re-run: a near-miss owner or Type now blocks set-up with its question |

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

### #137 and #161 Handovers; #140 Goal page: modules' sections sit inside About (merged 18:27, 20:04 and 18:30 UTC)

The two handovers are `docs/handover.md` only. #140 moves the `goal.sections` place from its own slot before Activity into About, after the facts, as the goal spec's section 5 has it; the place's comment and the module's README say the same. Nothing found.

### #133 CY2: starting the next year only prepares it (track 5, merged 18:31 UTC)

Read against `docs/design/cycle-end/spec.md`, rules 3, 4, 7 and 9 and screens 2.4, 2.5 and 2.10, and run on the example copied into a workspace of its own on 22 Dec 2026 and 2, 11 Jan and 5 Feb 2027.

**It closes #127's high.** The next year can be started from the day the wrap-up opens (Mon 21 Dec 2026) with no end date while no later year exists; the rule and `startPage` agree on every date tried; Cycles, the wrap-up page, Home's admin card and the start page all offer it on 5 Feb; U117 now asserts that. `saveRetro` and the wrap-up page now use one test.

**1. High (code facts read; the run is the first reader's). Once the next year is current, the old year's wrap-up can't be reached or saved, though every page promises it for four weeks after the year ends.** Sent to track 5 when confirmed.

- Where: `saveRetro` tests only the current cycle (`src/domain/actions.ts:292-296`). Rule 3's `writable` isn't built, and `wrapUpCycle` (`src/domain/cycle.ts:141`) is called by no screen and no action.
- Reproduced: start 2027 on 22 Dec; on 11 Jan `/retro` is 2027's ("The wrap-up opens in week 51, on Mon 20 Dec 2027"), 2026's row on Cycles has no action, and `saveRetro` on a 2026 goal is refused. Starting on 11 Jan does the same at once, a moment after Cycles said "open until Sun 31 Jan 2027: 126 goals still to wrap up". The start page gives no warning.
- Against rule 6's example: "Started on Mon 11 Jan 2027 instead: 2027 is current at once; the 2026 wrap-up stays open until Sun 31 Jan 2027".
- Fix: build `writable`; the wrap-up page, Home's admin card and `saveRetro` act on `wrapUpCycle(cycles, today)` when it isn't the current cycle.

**2. Medium (first reader). Undo of the start is allowed by the rule but offered nowhere once the new year is current.** The banner with the button is keyed on a later cycle existing (`src/screens/Workspace.tsx:277-291`); the row still says "It can be undone until…"; the toast has no Undo, though 2.4 says "with Undo".

**3. Medium (read; measured by the first reader). The "2027 is ready" banner's warning mark has no size:** `WarnMark` (`src/ui/bits.tsx:28`) is an SVG with no width, and `.cycle-ready` gives it none. It measured 767px square at 1440 and 324px at 390. No eval opens Cycles in that state.

**4. Medium (first reader). The read-back can disagree with the start.** `startPage` is handed the unscoped workspace and counts removed check-ins (`src/domain/startYear.ts:44`); the action doesn't. With one removed "done" check-in the page says 107 carry and the start makes 108. Rule 7 says they agree by construction.

**5. Medium (first reader). After an early start the copies are frozen at the start day**, while the page says "so the last check-ins and the wrap-up carry on". `recarry` is CY4's; the sentence shipped now. A goal wrapped up as "stop" a week later is still live in the new year.

**6. Medium (first reader). Before a year's first week Goals prints "Week 0 of 52 · Q1 (Jan–Mar) · 2027"**, which 2.10 lists under "Never" (`periodNow`, `src/domain/cycle.ts:161`, has no case for it). U115 reads Home only.

**7. Medium (first reader). The start page is named "Page not found"** when opened directly (`src/domain/navigation.ts:187-189`), with "Back to Home"; Home's admin card links straight to it.

**8. Medium (first reader). "When can the next year be started" is written five times** (`actions.ts:319`, `startYear.ts:40` and `:58`, `Workspace.tsx:306`, `Retro.tsx:92`, `Home.tsx:327`), and the second-start sentence already differs between two of them.

**9. Medium (first reader). Evals:** nothing calls `undo_start_cycle`; the dry run is asserted only by a phrase the old refusal also matched.

**Low (first reader).** The wrap-up page's start card says "Everyone stays in 2026 until Sun 3 Jan 2027" after that day. An undone year restored from Recently removed comes back as an ordinary cycle that can be deleted. The start page leaves out several of 2.4's lines without a note.

### #156 CK1: one way to save a check-in (track 1, merged 19:13 UTC)

The readiness review's finding 2, for the check-in. The first reader ran the old `state.tsx` logic against the new `postCheckIn` for all 126 demo goals in week 46, 5,266 cases of draft and actor: no difference in the check-in, the change-log entries, or the asks raised, changed or withdrawn. Who may check in is one line in the engine for sheet rows and screen posts (`src/domain/changeset.ts:644`); the action is in the table and the access table; two presses save one check-in; a refused save keeps what was typed; `api/mcp.js` is the built output.

**Low.** The screen's post loop repeats two week checks and their words from the sheet loop in the same function (`changeset.ts:773-774` and `:711-712`).

Not this PR's: the walk stops an admin checking in for someone else ("Only Rhea Kapoor checks in on this goal"), where the rule and R1's table say owner or admin.

### #157 Two fixes: status shapes in Find, and Settings scrolls to the end (track 1, merged 19:24 UTC)

Fixes this log's two highs for track 1. Re-run on main at 1440: every `.pick-status` shape in Find is 12 by 12; Settings scrolls to 870 of 870 with "Leave" lit. P3/P4 now open Find and fail a shape under 8px; a journey scrolls Settings to its foot. Nothing found. The picker's rows share the style; P3/P4 still don't open a picker.

### #154 AX9: browser state behind the ports; the build reviews of track 4's batch and AX8 (track 4, merged 19:38 UTC)

**The earlier findings (first reader, each checked against main):**

| Earlier finding | Now |
|---|---|
| #128: the bundle budget measured the entry only | Fixed for the demo: the script sums the entry and every preload (429 KB against a limit of 430). See finding 4 for the real app |
| #122: 0038 doesn't check what a row points at | In words: the kit now says references across workspaces are the server's to refuse |
| #123: "can look but can't save" | The kit and the guide now say nothing is shown, and the page is rendered in a test. See finding 5 |
| #131: the access page left out column grants | Fixed: "anon: insert (7 columns)" and the markups' update, with a test |
| #124, #125: two pages' old sentences | Fixed |
| #131: one variable for the last token; a contract case that asserted nothing | Fixed |
| #126: the two adapters disagreed on a token saved with other rows | Fixed, and tested |

No migration file was edited; the one line under `supabase/` is the README's.

**1. Medium (first reader). The storage lint's list doesn't have to shrink.** `scripts/check-layers.mjs:165` fails only when a file uses storage more than its count; a file listed at 10 and using it once keeps nine in hand.

**2. Medium (first reader). Ordinary spellings pass the lint:** a use inside a template literal, after a string holding `//`, in JSX after an apostrophe, `window['localStorage']`, and any `.jsx` or `.mts` file. Nothing in `src` does this today. `index.html:19` reads `localStorage` where the lint never looks and the kit's table doesn't list it.

**3. Medium (first reader). Nothing tests the new `clock`, and the entry point can't pass one** (`src/App.tsx:113-116` has no such prop). With a stopped clock, which the kit calls the Clock for the demo and the evals, the reload on focus never fires (`src/app/state.tsx:452`).

**4. Medium (first reader, measured). The budget still leaves out what the real app downloads before it draws:** with Supabase configured, `src/main.tsx:67` awaits the store's chunk and the client's (58 KB compressed) before the first render, and neither is a preload. About 488 KB against a check that says 429.

**5. Medium (read). The "not in this workspace" page is still untrue for two causes and still a dead end** (`src/adapters/signIn.ts:13-14`, `src/screens/Start.tsx:21-31`): two people sharing the email, or the only match marked as left, read "no one here has the email you signed in with".

**Also, older than this PR, in the two lines it rewrote (read; first reader ran it).** In UTC+13 and UTC+14 the real app stamps every record a day ahead: `src/app/state.tsx:507` rounds the gap between wall-clock time written as UTC and the clock, which is the zone's offset, and 13 hours rounds to one day. Auckland: real 2026-11-11T21:41Z, stamped 2026-11-12T21:41Z. Medium; for track 4 as the owner of the stamp.

**Low (first reader).** The lint counts names, not uses. The kit's table leaves out the demo visitor's id, the day-one facts and the picker's keys. "Every record's stamp comes from the Clock" is wider than the code (a markup's status time).

### #160 CK2: the levels in a check-in (track 1, merged 20:10 UTC)

No threshold is written twice; every status shape on both screens has a size and its word; the new blocks have a full outline, no stripe, no capsule; nothing scrolls sideways; the new buttons are 44px on a phone.

**1. Medium (first reader). An answer given in the table isn't kept in History**, though the requirement and Help say it is. The table keeps answers in the screen only (`src/screens/QuickCheckIn.tsx:54`, `:96-99`) and the engine writes `Asked` for screen posts only (`src/domain/changeset.ts:646`). The same answer on the walk saves it.

**2. Medium (first reader). The Check's words use a second copy of the number formatter**, so a value of 1 reads "1 hours" (`src/domain/checkin.ts:313` restates `fmt` without its singular).

**3. Medium (first reader). `checkInLevels` returns only the number's Must fix**, where rule 2 lists `evaluate`'s codes, and the table still draws its Must fix as a hint line, not the block CK2 names (`checkin.ts:306-322`, `QuickCheckIn.tsx:163`).

**Low (first reader).** The Must fix block says the value twice ("“0.415” 0.415 has 3 decimal places…"). Two wordings differ from rule 2's table. `reached()` is a fourth copy of "has the number reached its target". No eval covers the table's Check.

### #164 Migration 0039: a module's records (track 3, merged 20:13 UTC)

Run by this reviewer on PGlite with every migration, as `anon`. Faro-only; safe to run twice; the new table's one grant (select to `anon`) is written out and `anon` can't write the list; no redirect in `public`. A table not on the list stops the save ("a save can't write to okr_people"); a module's row that says another workspace, or names an id stored under another, is refused under both the new key and the old ones; `okr_delete_workspace` still clears the metric library's rows. The old `metrics` and `goal_metrics` keys still save, so it is safely one merge ahead of the code that sends `modules`.

**Low.** A save carrying both the old `metrics` key and `modules.okr_metrics` keeps the old key's rows and silently drops the others (the two are joined with `||`, right side winning). The pending code sends only `modules`. `"modules": null` fails with "cannot call jsonb_object_keys on an array". Deleting a workspace relies on each module's tables cascading from the workspace; the README could say so beside "adds them to that list".

### #163 Two journeys called U87 (track 3, merged 20:21 UTC)

Closes #130's finding 5: Goals' menus journey is U135, and `journey()` now refuses a repeated id. Nothing found.

### #142 CF1: levels read from one place (track 5, merged 22:02 UTC)

Read against `docs/design/workspace-settings/spec.md`, 2.1. For the default levels every answer is what it was: the first reader compared the old constants with the new functions over the demo's 126 goals (labels, rank, the `level=` address on Goals and Activity, Sort: Level both ways, Find's words, the Map's order, the Level column out) with no difference. An unknown level sorts last and throws nothing. `levels.ts` is pure. All findings are the first reader's; none bites until a cycle has levels of its own (CF2).

**1. Medium. Half the callers ask for the defaults, not the cycle's levels**, so a cycle with its own levels would get two answers: `parseQuery('level=lv-1,svp')` drops the live `lv-1`; Find's words say "SVP" where the table says "Division"; Sort: Level orders them differently (`src/domain/query.ts:69`, `:178`, `:199`, `:221`; `find.ts:135`; `activity.ts:46`; `map.ts:87`; `export.ts:352`; `src/mcp/tools.ts:89`). The rule page says every rule reads the one place.

**2. Medium. Levels are still named outside `levels.ts` where the lint can't see:** `watchWhat` builds a label from the id (`src/domain/actions.ts:258`: "every svp goal"), the tools print raw ids and write "north-star, svp, team" in their descriptions, and "North stars, then SVP, then team goals" is written twice.

**3. Medium. The new lint has no test that it can fail, and misses `==`, `case 'team':`, `['team'].includes(g.level)`, a comparison over two lines, and any code after `://` on a line** (`scripts/check-settings.mjs:37`).

**4. Medium. Departures from 2.1 with no note:** no `useLevels()`; `watch` takes an id only; unknown ids in an address are dropped silently; the goal page's Level row still reads ", reported at major reviews".

**5. Medium. No eval for the one visible change** (the level tag with no fill), which the spec's section 9 asks P6 for.

### #167 Help loads when opened (track 4, merged 22:22 UTC)

The entry and its ten preloads come to 366 KB compressed against a limit of 370 (first reader's build). Help's titles, focus, Back and the unread dot are right at both widths; the guide's text is only in Help's own file; `api/mcp.js` is unchanged.

**1. Medium (first reader, on the dev server). Offline, "Help with this page" replaces the whole app with the browser's error page**: a failed import counts as stale code and reloads (`src/telemetry/staleCode.ts:10-17`), and the reload has nothing to load. The link is on every page. Skip the reload when the browser says it is offline.

**Low (first reader).** On a slow connection the link shows nothing for the wait (`Suspense fallback={null}`). A change to `vite.helpIndex.ts` alone runs no journey (`evals/touches.cjs`).

### #139 AS part 2: the metric library as a module with its own records (track 3, merged 22:34 UTC)

The readiness review's finding 13: a feature with records of its own, added without editing the core. The first reader ran save, link, unlink, relink, remove and restore on the browser store, plain Postgres and the Supabase adapter, reading each back the same; the payload carries `modules.okr_metrics` and `modules.okr_goal_metrics` and neither old key; 0039 shipped a merge ahead. The build without the module succeeds, and with it switched off the 13 metrics and 12 links survive other saves and come back when it is switched on. `npm run lint:layers` passes; the core names no metric table; the goal forms call `app.run`.

**1. High, and older than this PR (re-run by this reviewer). On the database stores, Undo after a removal doesn't bring the record back.** Sent to track 4, as the owner of the save path, when confirmed.

- Why: a row loaded with `removed_at` null has no `removedAt` key (`src/data/rows.ts:11-12`); Undo puts back the row as it was (`src/domain/removal.ts:633-640`; for a module's rows `src/domain/records.ts:194-205`, new here); `set()` drops undefined keys (`rows.ts:10`); and `okr_upsert` updates only the columns a payload carries (`supabase/migrations/0011_transactional_saves.sql:24-39`). `removed_at` keeps the removal's time.
- Re-run on PGlite with `PostgresStore`: `deleteGoal`, commit, `undoRemoval`, commit, load: the goal still has `removedAt`. The same on `BrowserStore` gives it back. The first reader ran a metric, its link and an unlink on Postgres and the Supabase adapter with the same result.
- On the real app the record would come back on screen with "Undid: …" in the log, and go again at the next reload. It stays in Recently removed, where Restore writes an explicit null, so nothing is lost for good.
- No test sees it: the contract restores only with an explicit null (`src/ports/contracts/store.ts:137`), the Undo tests run on `applyCommit`, and the journeys run in the demo.
- Fix: explicit nulls for the removal's fields on every restored row, and a contract case: remove, Undo with the row as loaded, load.

**2. Medium (first reader). The core's new records code has no unit test of its own** (`src/domain/records.ts`: `applyModuleRows`, `mergeModuleRows`, `carryModules`, `moduleRowsBefore`, `removedModuleRows`), and the PR adds no eval; the module's manifest lists no journeys and no requirements.

**Low (first reader).** The browser store neither migrates nor reads the old shape (metrics on the snapshot itself); no build on main ever saved one there. With the Metric library switched off, Recently removed still lists a removed metric and restores it. `readTables` now calls the app's own Metrics sheet unknown.

### #168 Goals rewrites its address only while it is still on Goals (planning session, merged 22:36 UTC)

The guard is right and stops nothing it shouldn't (first reader: Back fired 0 to 44 ms after opening Goals, 24 tries a width, never pulled back).

**Low (first reader).** Deleting a view still rewrites another page's address if the person leaves before the save answers (`src/screens/GoalFilters.tsx:139`).

### #170 Last year's wrap-up stays open once the next year is current (track 5, merged 23:16 UTC)

Closes #133's high and several of its mediums. Read, not re-run on screen: `saveRetro` now tests the goal's own year (`src/domain/actions.ts`), the wrap-up page and Home read `wrapUpScope` (`src/app/reads.ts`), which gives last year while its wrap-up is open; new unit tests cover 11 Jan (saves, in 2026) and 5 Feb (refused, with the closing date). The same PR gives `periodNow` its "starts Mon 4 Jan 2027" case, names the start page, filters removed check-ins from the read-back, and puts "when can the next year be started" in one function. Nothing found on reading.

### #172 Review fixes for #154 and #141 (track 4, merged 23:49 UTC)

Read, with its tests: the storage lint now needs exact counts and reads `index.html`; the stamp moves by whole days only when today is pinned, with a test; `App` takes a clock, and the reload on focus runs on the page's own time; the bundle check counts what the real app loads before it draws (426 KB, limit 430); the "can't open yet" page says which of four reasons; feature switches save one at a time (#141's medium).

**It does not close #141's high.** Re-run on main after this PR: switch Spreadsheets off in the example, change workspace, press Undo: "Spreadsheets is back on.", the example still off, and "Switched on Spreadsheets" in the other workspace's log.

### #152 CY4: the carry rule, and what comes with a goal (track 5, merged 23:09 UTC)

Read against `docs/design/cycle-end/spec.md`, rules 5 and 6. Rule 5 is right on the demo: each worked example gives its kind and its starting number, a copy differs from its original only in the fields the rule owns, and the start page's counts (106 carried, 20 finish, 18 asks, 71 watches, 4 reviews) match what the start makes. A copy a person has touched is never overwritten. Starting twice is refused; undo and start again leaves no duplicate.

The three highs are all in `recarry`, which keeps a copy true when the year was started before its predecessor ended. The runs are the first reader's, on the demo with the year started on 22 Dec; this reviewer confirmed each in the code. Sent to track 5.

**1. High. "Stop" then "Carry it on" at the wrap-up makes a second copy under a new key.** `src/domain/recarry.ts:23` looks for a live copy only, and `:31` mints a new id when there is none; the removed copy still holds the key, so the new one is renumbered. G-37: 2027 ends with G-37 removed and a live G-127. Stop again saves only the wrap-up and leaves G-127 live; an old-year check-in instead adds a live G-128 beside it; restoring the first copy gives two live copies. Seen in the app for G-1. Fix: bring back the removed copy, same id and key, with what came with it.

**2. High. When a parent's copy leaves the new year, its children's copies keep pointing at it, with their effect.** `recarry.ts:40-50` removes the copy and touches no child; a copy added back gets an id no child points to. Stop G-1: the copies of G-2, G-6, G-11 and G-14 keep the removed copy as parent, where a start made then gives them none (rule 5's last row).

**3. High. Most ways of changing the old year never run `recarry`.** It has two call sites: `src/domain/actions.ts:320` (`saveRetro`) and `src/domain/changeset.ts:927-929` (a check-in, and only when the whole workspace is passed). The AI tools don't pass it (`src/mcp/tools.ts:117`): `post_check_in` of 35 on G-37 saves and the copy still starts from 29. Deleting or restoring a check-in, a target change, `stopGoal`, `deleteGoal` and restarting a stopped goal all leave the copy as it was. Rule 6 names `postCheckIn`, `stopGoal` and a plan change. Fix: one place, after any commit that touches a goal, check-in or wrap-up of a cycle that has a later one.

**4. Medium (first reader). On the database stores any old-year check-in rewrites an untouched copy and logs a false change**: `recarry.ts:34` compares the two as JSON text, and a goal read back from rows has another key order and no `fromWeek: 0`. The log line says "final number" for a limit and for stages too.

**5. Medium (first reader). After `recarry` adds a copy, Undo of the start is refused** ("1 goal in it has been changed") though nobody used the new year (`src/domain/removal.ts:415-416`).

**6. Medium (read). U115's new assertion reads `s.metricLinks`** (`evals/journeys.cjs:1316`), which #139 moved under `s.modules.metrics`, so its links term is always false and the journey's `attention` flag can't pass. Not run here.

**7. Medium (first reader). A copy removed by `recarry` is offered on Recently removed**, with no year, and comes back without its watches, link, asks or reviews while its 2026 goal still says stop.

**8. Medium (first reader). A carried copy's "Also helps" still names the old year's goals** (`src/domain/carry.ts:159`), so the dotted lines vanish. Older; this PR rebuilt the copy.

**9. Medium (first reader). Tests:** nothing covers `recarry`'s add path, the parent and child links, the tools' path, a deleted or restored check-in, a plan change, `stopGoal`, or Undo after `recarry`. `src/domain/startYear.ts:48-54` restates `carryExtras`' filters to count.

**Low (first reader).** `byRecarry` tells its own changes from a person's by the sentence. `saveRetro` says "It already has check-ins in 2027" when the copy was only edited. No demo goal is of the `keep` kind.

### #166 An action made in one workspace never saves into another (track 4, merged 00:39 UTC, 12 Nov)

Fixes #141's high. `act` and `run` now save through `save` (`src/app/state.tsx:535-538`), which refuses when the render's workspace is no longer the one loaded. Re-run on screen with the earlier script: Spreadsheets off in the example, switch to a second workspace, press Undo. One toast, "That was for another workspace, so nothing was changed. Open it to do it there."; the second workspace's log is empty and the example still has the feature off. The workspaces ref is updated at once in `setRecording` and `setModule` (#141's medium). `src/app/undoElsewhere.test.tsx` covers the refusal.

**1. Low (read). Two saves still go straight to `commit`:** `saveGoal` (`src/app/state.tsx:693`) and `applyChanges` (`:717`). No toast holds either today, so no path was found; they are the only two left outside the check.

**2. Low (seen). The toast keeps its Undo button after the switch**, though pressing it can now only be refused. Dropping toasts' actions on a switch would be kinder.

### #175 Undo after a removal stays undone on the database stores (track 4, merged 00:49 UTC, 12 Nov)

Fixes the older high met in #139, for Undo from a toast. `asBefore` (`src/domain/records.ts:198-209`) sets to null every removal field the removal set and the earlier record lacked; `undoRemoval` and `moduleRowsBefore` use it. The new store contract case removes a goal, marks a person as left and removes a module row, undoes each, and passes on the browser, both Supabase wirings and plain Postgres.

**1. High (re-run by this reviewer). Undoing an import or bulk edit has the same fault and was not touched.** `undoImport` (`src/domain/removal.ts:479`, `:487`, `:497`) saves each record's `before` from the import's log entry as it stands. A goal that was live before has no `removedAt`, `stoppedAt` or `stopReason` key there, and a person has no `leftAt`, so the database keeps the removal's values.
- Reproduced on plain Postgres (PGlite) with an import entry in `planChanges`' shape that deleted one goal and stopped another: after `undoImport` and a load, the first still has `removedAt` and the second still has `stoppedAt` and its reason. In the browser store both come back clean.
- The same lines put back people (marked as left by a People row's Action) and, further down, reviews; those were read, not run.
- Fix: pass each `before` through `asBefore(cur, before)` in `undoImport`, and add an import that deletes, stops and marks as left to the store contract case.

**2. Low (read). `asBefore` works from a list of field names** (`REMOVAL_FIELD`). A removal field added later under another name (a view's `deletedAt` is covered; `revokedAt` or `withdrawnAt` would not be) falls back to the old fault with nothing to flag it. Clearing every key the removed record has and the earlier one lacks would need no list.

### #144 ML1: the metric library as a place, and a page per metric (track 3, merged 01:46 UTC, 12 Nov)

Read first by a separate reviewing session, in the demo at 1440 and 390 and in the code; findings 1 and 7 were then read again by this reviewer. No high finding. The four mediums share a cause: ML1 shipped screens and links whose other half is planned for ML2 or ML3.

**1. Medium (re-read). "No metric yet. Choose one" leads to a form with no way to choose one.** `src/modules/metrics/MetricPlaces.tsx:33` links to the goal's edit form, but no module registers the `goal.measure` place the forms wait for (`src/core/module.ts:22`). As rhea, `/goals/dep-gates` shows the line and the form it opens has no "Measured by". It shows to owners and admins on every number goal without a metric: 114 of the demo's 126. Fix: hide the line until ML2 registers the place, or bring that forward.

**2. Medium (first reader). Changing a metric's unit while goals use it saves with no question and leaves the pages disagreeing.** `saveMetric` (`src/modules/metrics/rules.ts:191-201`) never looks at the links, though `linkProblems` (`:231`) refuses the same pairing when linking. Lead time for changes, hours to days: the metric's page says "days" over rows in hours. Fix: warn or refuse through `linkProblems` until ML3's confirm.

**3. Medium (first reader). "Put it back" restores a removed metric without its goals and says nothing.** `Metrics.tsx:304`, `:330`; the spec's 2.2 says the links come back. After it: "Goals measured by it · 0", and the goal offers finding 1's dead link. Undo straight after the removal does restore the link. Fix: restore the links removed in the same save, or say so.

**4. Medium (first reader). The add and change form throws away what was typed on Close, Cancel or Back.** `Metrics.tsx:379`, `:404`, `:446`; no use of `src/app/drafts.ts`, which the other focus forms use, and the spec's 2.3 says "Close and keep the draft".

**Lows (first reader unless marked).**
- "See goals in {unit}" always lands on an empty list: `rulesLibrary.ts:81` searches Goals for the unit, which the search does not read.
- The empty library has two primary "Add a metric" buttons (`Metrics.tsx:124`, `:165`).
- `/metrics/100%25` crashes the page (re-read): `metricAt` (`rulesLibrary.ts:36`) decodes a part the router has already decoded.
- "Choose an owner" (`?field=owner`) does not focus the Owner field (`Metrics.tsx:359-364`).
- A metric's page is titled "Metrics" and its form "Change a metric" (`app.tsx:55-56`); the spec wants the metric's name.
- At 390, the Filters sheet's tick boxes are 40px high and the goal and owner links in a metric's goals block 17px.
- The Remove sheet can say "No goal uses it" while the removal unlinks a stopped goal: the sheet counts live goals of the running cycle (`reads.ts:19-21`), the removal every link (`rules.ts:210`).
- The lowest-and-highest line names slices, so two goals for one team read "Lowest now: CI/CD… Highest: CI/CD…" (`rulesLibrary.ts:193`).
- Evals: nothing that changes a metric has a journey. U81 is read-only; the form, remove, Undo, Put it back, filters and the empty library are uncovered until ML3's U83.
- Restatements: "The whole company" typed out beside `COMPANY`; `Metrics.tsx:88` reworks `liveLinks`; `scripts/drill.mjs` hard-codes key columns the module's conformance already declares.

**Checked and fine.** The core imports no module, and saves go through `app.run`. Row and page statuses agree on six dates, and the screens and both AI tools share the same reads. Permissions hold for a non-owner. Design rules hold at both sizes. The module's 51 unit tests, the spec check, `check-rebuild` and the drill (100%) pass. The build leaves the rebuild stage out of `dist` while the spec and MCP builds still see it.

### #177 Undoing an import puts deleted, stopped and left rows back for good (track 4, merged 01:59 UTC, 12 Nov)

Fixes #175's high. `undoImport` passes each earlier record through `asBefore` (`src/domain/removal.ts:479`, `:487`, `:497`, `:506`), and the new store contract case is this review's reproduction with a person marked as left added. It also takes #166's two lows: `saveGoal` and `applyChanges` now go through `save`, and a toast's Undo goes when the workspace changes. `asBefore` still works from a list of names, now with `email`; the goal's other optional columns are always written (`src/data/rows.ts:62-71`), so nothing else was found that the list misses. No finding.

### #179 Carried copies stay true after every save (track 5, merged 02:41 UTC, 12 Nov)

Fixes #152's three highs and four of its mediums. `recarry` brings back the copy it took out, clears and restores the children's parent, and now runs on every save in one place each for the app (`src/app/state.tsx:431-433`) and the MCP server (`server/mcp.ts:133`). A unit test covers each high. Re-run here: stop a parent in the old year and Undo it; its copy and all four children's copies come back under it.

**1. High (re-run by this reviewer). On the database stores, a save that moves a parent's copy and its child's copy together is refused whole.** `withRecarry` (`src/domain/recarry.ts:79-91`) runs `recarry` once per goal against the workspace as loaded, and `mergeCommits` (`src/domain/actions.ts:325-331`) joins the results end to end. When a parent and its child both leave the next year in one save, the commit holds the child's copy twice: once with its parent cleared (from the parent's turn) and once removed (from its own).
- Pure probe: both wrap-ups set to "stop" in one commit gives 9 goal rows for 8 goals.
- On plain Postgres and on the Supabase adapter (PGlite), a commit with one goal twice fails: "Saving: ON CONFLICT DO UPDATE command cannot affect row a second time". Nothing is saved.
- The ordinary way there is a table or spreadsheet of final numbers at year end, after an early start, where a parent and its child both finish or stop. The browser store takes the last row, so the demo does not show it.
- An ask or review that holds two leaving copies is written twice in the same way, each row dropping only one of them (read, not run): refused on a database, and in the browser the later row puts the first goal's ID back.
- Fix: have `withRecarry` fold each result into the rows the next `recarry` reads, or merge rows by ID, and add a two-goal save to the store contract.

**2. Medium (re-run). A parent and child brought back in one save return with the child's copy at the top level.** The child's turn looks for its parent's live copy in the rows as loaded (`recarry.ts:39`, `:43`), where it is still removed; the parent's turn only re-attaches children that are already live (`:50-53`). Probe: both wrap-ups set back to "carry" in one commit; the child's copy returns with `parentId` null. Same fix as 1.

### #145 IM2: problem levels (track 3, merged 02:20 UTC, 12 Nov)

Read first by a separate reviewing session, in the engine (throwaway tests against this merge and its parent) and on screen at 1440 and 390; finding 1 was then re-run by this reviewer. The levels work for the main import path; the faults are in the two doors that cannot answer a question, and around answers.

**1. High (re-run by this reviewer). Set-up from a spreadsheet drops a goal whose owner or word is one letter out, and says nothing.** `buildWorkspace` (`src/domain/importer.ts:104-106`) blocks only on Must fix and sends every Check to `notes`. In create mode a near miss raises its Check and returns without building the row (`src/domain/changeset.ts:253-258`, `:654`). Set-up shows notes for People rows only (`src/screens/Onboarding.tsx:190`).
- Re-run: the goals template with "Ben Ortz" as the owner of "Deploys rolled back" and no email. Result: `issues` is empty, the workspace has two goals where the template has three, and the only trace is a Goals note no screen reads. Before this PR the same row blocked set-up.
- The first reader saw the same for a Type of "Numbr". The wizard was not walked on screen.
- Fix: until IM8 brings set-up the import's preview, treat a Check that stops a row as blocking in create mode.

**2. Medium (first reader, on screen). The bulk check-in grid can no longer post a number typed with a decimal comma.** `changeset.ts:1048` asks `decimal-comma` at every door but a form post; `src/screens/QuickCheckIn.tsx:99-100` passes no answers. "3,9" gives an error toast and nothing posts; the parent commit saved it. Fix: don't ask it when `via` is `bulk`.

**3. Medium (first reader). A near-miss goal name on Check-ins gets past the duplicate-row rule**, so one import saves two check-ins for one goal and week: `twice()` (`changeset.ts:1017-1022`) keys rows before the answer is applied (`:1124`).

**4. Medium (first reader). Two rows answered "They're the same" for one goal: the earlier row is dropped without a word** (`changeset.ts:645-647` after the duplicate check at `:616`).

**5. Medium (first reader). Undoing an import that added a team leaves the team behind, led by a deleted person** (`src/domain/removal.ts:507` restores only teams with a `before`).

**6. Medium (first reader). An answer to one unlikely-number question covers different numbers, including those in the next file chosen.** The group's identity is kind, sheet, column and a coarse label (`changeset.ts:151`, `:1082`); `Import.tsx:30` and `DataTables.tsx:232` keep answers across files and reviews.

**7. Medium (first reader, on screen). Once the last question is answered, the "Your answers" lines and their Change buttons disappear** (`src/ui/Preview.tsx:26`), against the PR's own "an answered question closes to what was asked and the answer".

**Lows (first reader).**
- "Leave these rows out" does nothing on two Must fix cases (`changeset.ts:397`, `:467`).
- Any word answers a Check through MCP: `answers: {"no-unit:goals:unit:": "banana"}` saved (`changeset.ts:203-206`, `src/mcp/tools.ts:109`).
- Questions arrive in waves, and the first screen says "Nothing in this file changes anything" while questions wait (`Preview.tsx:114`).
- Wording: the Type question mixes "Read it as number" with "Use “metric”"; a rename by key through MCP now asks "Row 2 calls it…", and `confirm: true` does not answer it.
- No browser journey covers the answer buttons; finding 7 sits in that gap.

**Checked and fine.** The same row gives the same Check through spreadsheet, table, bulk and MCP. The preview's count matches what is saved. Exact duplicates and unknown names are Must fix. `problemLevels.ts` is pure, and screens and tools call the engine. No stripes, pills or emoji; Check is the warning mark plus the word. Help, What's new, the requirement and the spec rows are there. **Unconfirmed:** whether `replaces-others` blocks the bulk grid, and renaming in the data tables.

### #135 History: an ask counts under Reviews by its own reviewId (track 1, merged 03:17 UTC, 12 Nov)

`historyKind` (`src/domain/goalPage.ts:566-573`) now places an ask by its own `reviewId`, where it used to look for the review's name in the entry's sentence, so renaming a review moves none of its past asks. The screen passes the goal's asks of every status (`src/screens/GoalScreen.tsx:855`). Read, with its unit test. No finding.

### #180 A parent and its child moving in one save are written once (track 5, merged 04:24 UTC, 12 Nov)

Fixes #179's high and medium. `withRecarry` folds the save and each goal's result into the rows the next goal reads, and returns each record once (`src/domain/recarry.ts:84-118`). Re-run with this review's probe, parent first and child first: stopping both in one save gives no repeated record and both copies leave; carrying both in one save brings back the same two copies, the child under its parent. No finding.

### #181 Set-up never leaves a row out quietly; the grid takes a decimal comma (track 3, merged 04:33 UTC, 12 Nov)

Fixes #145's high and its medium 2. In set-up a Check that stopped its row from being built now blocks, with its question as the message (`src/domain/importer.ts:107-115`); the decimal-comma question is no longer asked of numbers typed on screen (`src/domain/changeset.ts:62-64`, `:1047`). Re-run: the goals template with "Ben Ortz", and with Type "metrc", each now returns one blocking issue for that row. A journey covers the grid. No finding. #145's mediums 3 to 7 stay open with track 3.

### #129 OB1: New goal asks in a better order, each step an address (track 2, merged 03:26 UTC, 12 Nov)

Read first by a separate reviewing session, on screen at 1440 and 390 and with throwaway tests, at this merge; finding 2 was read again by this reviewer on main as it stood at 06:51 UTC, and #186 has since changed the form, so the rest is as of this merge. No high finding.

**1. Medium (first reader, on screen; a regression). After "Change" on Check, Continue goes dead if the change makes a later step invalid.** `go()` (`src/screens/GoalWizard.tsx:110` at this merge) marks the failing step tried and returns; the old form went to the failing step. Valid number goal on Check, Change on What, choose "Hit dated stages", Continue three times: still on What, no message. Fix: navigate to the first failing step.

**2. Medium (re-read; a regression). New goal is no longer in focus mode, so on a phone the tab bar covers Back and Continue.** The focus pattern at `src/ui/Shell.tsx:225` matches `/goals/new` but not `/goals/new/<step>`, and `/goals/new` now always redirects to a step. At 390 the foot buttons sit under the fixed tab bar on What, Who and Measure until the page is scrolled to its end; at 1440 the full sidebar shows. Fix: match `^\/goals\/new(\/[^/]+)?$`.

**3. Medium (first reader). F16 passes while the button it guards is hidden.** `evals/finish/11-new-goal-phone.cjs:36-37` checks the button's box is inside the viewport, not that it can be hit; no check covers finding 1 either.

**4. Medium (first reader, on screen; carried over). A stage answered "Yes, done" and then moved to a future week is published as done in that week.** `src/ui/GoalFields.tsx:96` keeps `done` when the due week changes, and the publish sends it (`GoalWizard.tsx:129`). Result: a check-in dated week 50 in week 46, and the goal reads "Done". Fix: clear `done` when the week changes, and filter by past weeks at publish.

**5. Medium (first reader, on screen; older, and OB1 was to close it). A member can publish a goal owned by anyone.** The Owner picker has no refusal (`GoalWizard.tsx:242`) and `saveGoal` saves directly, though the shared engine refuses the same thing (`src/domain/changeset.ts:656`). As oskar, a goal owned by Rhea Kapoor was saved.

**6. Medium (first reader, on screen). Check cuts off what it reads back.** `.rr-value` is one line with an ellipsis: at 390 "Where it fits" shows "SVP level, feeds “Le…", and the also-helps goal and "a guardrail" are never visible. Fix: let the value wrap.

**Lows (first reader).**
- Focus is lost on step 2 (the picker replaces the focused button) and not placed on Check (`GoalWizard.tsx:106`).
- A non-number left in "How much will it move…" blocks step 2 invisibly once the parent is removed (`:258`).
- In "Feeds into", Enter does nothing when the first match is a refused row (`src/ui/Pick.tsx:137`).
- Flow gaps: `fromCheck` survives the browser's Back, so a later Continue skips Measure; `?parent=` is ignored while a draft waits; the discard dialog takes no focus; `startLevel` counts removed and stopped goals.
- The "only feeds a level above" rule lives in the form alone (`src/domain/newGoal.ts:39-48`); Change a goal and the engine have no such check (read).
- Not built from the spec: the "cycle has ended" state, "Add one" for admins with no teams, the gone-parent line; step fields and two errors are assembled in the screen (read).

**Checked and fine.** The draft survives Continue, Back, the browser's Back and Forward and a reload; a later step's address opens the first step that needs something. What is saved equals what Check shows for a number goal. A double-click publishes once. No stripes, emoji or sideways scroll; one primary button per step; each step's title names it.

### #183 Offline, a page that loads when opened says it needs a connection (track 4, merged 05:02 UTC, 12 Nov)

Takes #167's medium and both lows. Offline, a part that cannot be fetched no longer triggers the stale-code reload; the page says it needs a connection, with "Try again" and "Go back" (`src/telemetry/react.tsx:45-84`, `src/telemetry/staleCode.ts:37-40`). A page on its way shows "Opening…" after a moment, and a change to `vite.helpIndex.ts` now runs Help's journeys. Read, with its unit test and the N8 check. No finding.

### #187 AS part 3, the rest: migration 0040, records tests (track 3, merged 06:06 UTC, 12 Nov)

Takes #164's lows. Migration `0040_module_rows_strict.sql` replaces `okr_same_workspace` and `okr_write` in `faro` only, with no new function, table or grant, and is safe to run twice. A save that names a metric table both under `modules` and under its old key now stops with the reason, `"modules": null` means no module rows, and anything else that is not an object stops. `src/data/rpc.test.ts` runs all three on PGlite. Recently removed and its MCP tools list only the records of modules that are switched on (`src/core/records.ts:14-17`), and the import names a module's own sheet as "written for reading; not loaded back". Read, migration included. No finding.

### #190 The first download: 369 KB to 282 KB (merged 11:55 UTC, 12 Nov)

Every page but Home now loads when opened, as do the spreadsheets module's Import, Data menu and export sheet. This is the change that turned main's full evals red when #128 made a few pages lazy; here the journeys' "page has arrived" tests were changed with it (`evals/journeys.cjs`, `evals/notes/6-print-motion.cjs`), and CI on main, full evals included, passed at this commit. The waiting page holds a screen's height so nothing jumps. Read. No finding.

### #184 GT3, #186 GE1 and #189 GE2: goal entry (track 2, merged 05:34, 05:54 and 11:44 UTC, 12 Nov)

Read first by a separate reviewing session at #189's merge, on screen at 1440 and 390 and with throwaway tests; nothing here was re-run by this reviewer. No high finding.

**#184, low. Close and Save add a history entry, so the browser's Back returns to the form** (`src/screens/GoalEdit.tsx:109`, no `replace`).

**#184, low. A stage goal's "How it's measured" can no longer be changed on the page**: `GoalEdit.tsx:158` shows it for number goals only, and the field left More details.

**#186, medium. A file or MCP row for a new goal with an Effect that isn't a number saves and drops it; the form refuses the same input.** `src/domain/changeset.ts:799` runs `goalMustFix` before the row's parent is read (`:868-900`), and `src/domain/goalEntry.ts:137` checks Effect only when a parent is set. Row with Effect "lots" under `ns-lead`: no issue from the engine, "isn't a number" from the form.

**#189, medium. On Change a goal, Save with an unanswered question does nothing visible when the question is off screen.** `GoalEdit.tsx:113` returns; the only sign is the block's outline. Target 52 to 900 at 1440: the page stays, the question sits above the window, focus stays on Save. Fix: the form's line above Save, and focus the first open question.

**#189, medium. The wrong-side question is asked only by the screens, and its answer is not kept in History.** `goalEntry.ts:317-320` needs the goal's metric; only `GoalWizard.tsx:111` and `GoalEdit.tsx:89` pass it, so the saving rule, a file and MCP never ask. A new goal measured by a lower-is-better metric, 10 to 20: asked, answered yes, published, and the "Created" entry has no "Checked". No journey covers it.

**#189, lows.**
- `confirm: true` writes "Checked … Yes" into History for questions nobody was shown (`goalEntry.ts:493`, `:509`; the check-in's re-base uses it).
- "No, I'll change it" does nothing on Change a goal or on set-up's cards (`GoalEdit.tsx:92`, `Onboarding.tsx:582`).
- Clearing an existing goal's unit is asked by the form's rule but not by the engine (`changeset.ts:191-193`).
- The saving rule records a stage as done in a future week if the draft says so (`goalEntry.ts:511-512`); the screen can no longer send that.
- MCP restates the engine's list of question kinds (`src/mcp/tools.ts:116`, `changeset.ts:195`).

**Older than these three.**
- Medium: a kept or stale edit draft reverts what someone else changed meanwhile, and logs it as the saver's change. The draft holds every field and the save rebuilds the whole goal (`GoalEdit.tsx:52`, `goalEntry.ts:498`). A rename saved after the target moved 24 to 30 records "Target 30 → 24". GE4's patch is the planned fix.
- Low: a stopped goal's edit page opens from its address and refuses only at Save (read).

**#129's findings at this merge.** Still there: 1 (Continue goes dead after "Change" on Check), 2 (New goal's steps are not in focus mode; on a phone the tab bar covers Back and Continue) and 6 (Check cuts its values to one line). Fixed: 4 (a stage moved to a future week no longer stays done). Not a fault: 5, a member publishing a goal for someone else, is Lane's decision of 11 Nov (`src/domain/goalRights.ts:12`); the #129 entry above predates this reviewer seeing that.

**Checked and fine.** All 126 demo goals, unchanged, raise nothing at either door. Nine edge inputs get the same answer from the form and the engine. Rights hold in the same words at both. Answers are kept in the draft and asked again when the number changes. A double press saves once. `goalEntry.ts` is pure, and both forms save through the shared action.

### #185 ML2 and #188 ML3: the metric library (track 3, merged 06:21 and 06:51 UTC, 12 Nov)

Read first by a separate reviewing session at #188's merge, on screen, through the MCP server and with throwaway tests; finding 1 was read again by this reviewer. No high finding: the first reader rated 1 high, and it is logged as medium because Check says "No metric" before anything is published.

**#185, 1. Medium (re-read). New goal forgets the chosen metric on Back or a reload.** `src/modules/metrics/MeasuredBy.tsx:23` holds the choice in component state, the place is drawn only on the Measure step, and on its return its effect reports nothing chosen (`:40-52`). The form's own copy is state too (`src/screens/GoalWizard.tsx:89`), not the draft. After Back from Check the picker shows "No metric" and the unit field stays hidden. Change a goal's "Close and keep the draft" loses it the same way. Fix: keep the metric and its slice in the goal draft.

**#185, 2. Medium. A goal made for someone else cannot be published once a metric is chosen.** `src/modules/metrics/rules.ts:251` tests the actor against the new goal's owner. As Rhea with owner Aiko: Publish stays on Check with "Only the goal's owner or an admin can choose what measures it."

**#185, 3. Medium. The AI's `find_goals` ignores the metric filter and returns every goal.** Module filters are added in `src/core/app.tsx`; `src/mcp/tools.ts:225-253` parses without them. `find_goals {query: "metric=metric_lead-time"}` returned all 126.

**#185, lows.** A metric's slug in the address names the filter but matches nothing, and an unknown value empties the list with no filter shown (`finder.ts:35-45`). The form does not warn about a goal aiming the wrong way where the tool does (`rulesMeasure.ts:38-44`). Unlinking from Change a goal offers no Undo. A stopped goal can be re-linked by the tool. "Use different ones" is 20px tall on a phone. The combined goal-and-link save goes round `run` (`src/app/state.tsx:689-706`, read).

**#188, 1. Medium. Remove says "No goal uses it" while unlinking a stopped goal, and "Put it back" does not relink it.** The sheet counts the cycle's links (`Metrics.tsx:323`), the removal the whole workspace's (`rules.ts:215`), the restore only goals in the snapshot (`records.ts:63-64`). This is #144's low, still there.

**#188, 2. Medium. The change confirm and Help promise a warning that is shown nowhere.** After Flaky test rate is changed to ppm, the goal page reads "Measured by Flaky test rate · ppm" beside "1.8%" with no warning (`Metrics.tsx:488`, `MetricPlaces.tsx:17-45`).

**#188, 3. Medium. The confirm exists only on screen.** `save_metric {unit: "ppm"}` through MCP changes a unit goals use with no question; the logic is in `Metrics.tsx:401-414`, not in a rule.

**#188, lows.** The close-name question is skipped when a metric is added from the goal form (`MeasuredBy.tsx:83-94`). Cancel on the metric form keeps the draft, as Close does (read).

**#144's findings at this merge.** Fixed: the dead "Choose one" link, the unit change on screen, "Put it back" for live goals, the form's draft, and `/metrics/100%25`. Still there: "See goals in {unit}" lands on an empty list, the unit change through `save_metric`, and the stopped-goal case above.

**Checked and fine.** A goal and its link are one save, new or changed. A unit mismatch is refused at every door. The Goals filter round-trips with a full id and is generic (`ModuleFilter`); nothing in the core imports the module. Design rules hold at both sizes.

### #191 IM3: the import's preview (track 3, merged 12:22 UTC, 12 Nov)

Read first by a separate reviewing session, as Grace at 1440 and 390 and with throwaway tests; nothing here was re-run by this reviewer. No high finding: in every run, what the preview said would be saved is what was saved.

**1. Medium. Every keystroke in "Why are these plans changing?" re-runs the whole change engine, so large files freeze.** The change set is memoised on the reason (`src/modules/spreadsheets/importPlan.ts:48`), which `Check.tsx:169` writes on each change; `Changes.tsx` works it out again. With 1,500 new goals and one target change, typing "Agreed." took 14.3 s; with 3,000 rows, one answer took 7.3 s. Fix: keep the reason out of the engine's inputs and hold the worked-out change set in the import's store.

**2. Medium. The "Choose a goal / person / team" picker draws as an empty box 128 px wide and 200 px tall.** `import.css:22` gives `.import-value .input` a 200 px flex basis, which becomes the picker button's height inside its column. Picking still works.

**3. Medium. Focus falls to the page body after every answer and after "Leave them out"** (`Check.tsx:273`, `:177`): a keyboard or screen-reader user starts again from "Skip to content" each time.

**4. Medium. "Leave these rows out and save the rest" has no on-screen eval.** U94 covers only the radio answer; the dependants rule has unit tests alone. Run by hand, it works.

**Lows.**
- The counts by sheet can add up to more than the rows read, and a row that must be fixed is also counted as added; a team being added reads "changed" (`Check.tsx:190-195`). Nothing wrong is saved.
- Rules restated in the screen: the Added/Changed/Stopped grouping twice (`Check.tsx:190-192`, `Changes.tsx:18`), `isNewIn` beside `leaveOut.ts:18`, the per-sheet counts in a component (read).
- Small slips: "Leave these 1 row out"; "All 0 rows say what Faro already says" for a header-only file; "3000" beside "3,000"; "Show the N changes" is 22 px high on a phone; the changes page swallows a failed save (`Changes.tsx:48`, read); after saving, the browser's Back returns to a preview still headed "Nothing has been saved."

**#145's findings at this merge.** Fixed: an unlikely-number answer no longer covers other numbers or the next file; the answers and their Change buttons stay after the last one; the first screen says "Answer 1 question to save"; undoing an import removes a team it added. Mediums 3 and 4 (near-miss names and the duplicate-row rule; two rows answered "the same") were not re-checked.

**Checked and fine.** Preview equals saved, on the summary and the changes list. Leaving rows out takes their dependants, names them, and nothing left out is saved by another path. Must fix blocks saving. A double Save logs one import. Empty and unknown files stay on Import with the reason. No stripes, pills or emoji; a level is the warning mark plus its word; one primary action per screen.

### #194 GE9: dates picked (track 2, merged 13:06 UTC, 12 Nov)

Read first by a separate reviewing session, on screen at 1440 and 390 in three time zones and with throwaway tests; nothing here was re-run by this reviewer. No high finding. The date arithmetic is sound for a goal year: 700 consecutive weeks match the ISO week date, and results are the same under UTC, Los Angeles and Auckland.

**1. Medium. A new goal row with To filled in and Due week left blank is refused, in any file that has both columns, as every export does.** `pair` (`src/domain/changeset.ts:757-772`) reads a blank Due week as the cycle's last week, so the two columns disagree: "To says 2027-W13 and Due week says . Change just one of them." The same message hides a To that is before From. Fix: a blank Due week says nothing when To has a value.

**2. Medium. A file whose heading "From" meant the starting number now has that number read as a week.** `src/domain/columns.ts:499` drops "from" from Start's other names and `:501` makes it the week column. With the export's Start heading renamed "From", the preview offered "Plan from week → Week 52" for a goal that starts at 52 hours, and the same for about 15 others, as ordinary changes. Fix: a bare number under From in a file with no Start column is a Must fix asking which is meant.

**3. Medium. With the pointer resting over the list, the keyboard chooses the wrong week.** `src/ui/WeekPick.tsx:128` moves the highlight on `mouseenter`, and the scroll at `:45` slides rows under a still pointer. Enter, ArrowDown, Enter with the mouse parked: To became week 47 where week 53 was highlighted without it. Fix: move the highlight on `mousemove`.

**4. Medium. In the last week of the year, New goal's untouched defaults are a Must fix.** From defaults to this week and To to the cycle's end (`src/domain/goalEntry.ts:124-125`), so at week 53 "To isn't after From". Run at the rule; the demo cannot reach it. Fix: default To to the end of next year then, as choosing From by hand already does.

**5. Medium, if a cycle shorter than a year can still exist. Its weeks get the wrong year and number** (`src/domain/weeks.ts:27-40`): for a 13-week cycle from 30 March, week 14 reads "2027-W01 · Week 1 · 6–12 Jul 2026". Set-up only makes goal years; older data was not checked.

**Lows.**
- Escape does not close the picker from its Year buttons or Close, and Tab leaves it open behind the focus (`WeekPick.tsx:101`, `:119-121`).
- On a phone the Year buttons are 36px high and Close is 41 by 22.
- Enter on the empty text field says "“” isn't a week or a date" (`WeekPick.tsx:81-84`).
- The same text means different things at different doors: "23 Mar" and "3/4" are read by the picker but not by a file's From and To; an ISO date is read by Due week only; "week 12" by none.
- A plan's weeks are still bare cycle numbers in the change preview and status sentences ("Target due → Week 66" beside "week 13 of 2027"; `src/domain/changes.ts:41-42`, `story.ts:143-146`).
- At Data, From and To sit under "Details", not "Plan", in the column chooser (`src/screens/DataLayout.tsx:28`).
- Small slips: ArrowUp on a year's first week does not cross to the year before; "53" with 2027 shown says "isn't a week" where "2027 has 52 weeks" would help; `goalEntry.ts:183` hard-codes "like 2026-W46".

**Checked and fine.** Week 0, 1, 53, 54 and 105 of the demo year; the inverse both ways; leap years and 53-week years. The export loads back with no change, and a file without From and To loads as before. Existing goals read and save the same weeks. Typed dates are day then month, and two-digit years are refused, not guessed. The arithmetic is in `src/domain` only. The picker works by keyboard, names itself, and returns focus to the field. No stripes, pills or emoji.

### #198 Metrics: the build review's findings on ML2 and ML3 (track 3, merged 14:03 UTC, 12 Nov)

Takes all seven mediums from #185 and #188, and #144's "See goals in {unit}". Read, not re-run on screen:
- the chosen metric and its slice are kept in the goal form's draft (`src/modules/metrics/MeasuredBy.tsx`, `kept` and `onKeep`);
- whoever creates a goal may choose its metric in that save (`rules.ts`, `creating`);
- `find_goals` reads a module's Goals column on the server;
- changing a unit or direction that live goals use is one rule, `metricChangeQuestion`, asked by the form and by `save_metric`, which gains `confirm`;
- a goal whose metric now differs says so on its page;
- Remove counts every goal it unlinks, stopped ones too, and "Put it back" relinks them.

No finding. #185's and #188's lows stay open.

### #201 Backlog: NR (merged 14:10 UTC, 12 Nov)

One backlog line. Nothing to review.

### #197 Goal entry review fixes (track 2, merged 14:13 UTC, 12 Nov)

Takes #186's medium, #189's two mediums and three of its lows, and #129's medium 2 and 3. Read, not re-run on screen:
- a file or MCP row that feeds a goal has its Effect judged as the form does (`src/domain/changeset.ts`, `feeds`);
- on Change a goal, Save with a question open focuses the first one and says where it is above Save, and "No" goes back to the field (`src/screens/GoalEdit.tsx`);
- the wrong-side question is asked by the saving rule, the engine and MCP for a goal already measured, through a module's `measures`, and its answer is kept as Checked;
- New goal's steps are in focus mode again (`src/ui/Shell.tsx:225`), and F16 now checks nothing covers Back or Continue;
- the engine asks when a row clears a unit, the saving rule records only past stages as done, and MCP reads the engine's list of question kinds.

No finding. Still open with track 2: #129's 1 (Continue goes dead after "Change" on Check) and 6 (Check cuts its values to one line), #184's two lows, #189's "confirm writes Checked" low, the stale-draft medium (GE4), and all of #194's.

### #195 IM4: past imports (track 3, merged 13:51 UTC, 12 Nov)

Read first by a separate reviewing session, on screen at 1440, 390 and 360 and with throwaway tests; nothing here was re-run by this reviewer. No high finding.

**1. Medium. An import that only changes or adds a team cannot be undone from the app, and the Undo sheet says something untrue.** `undoImport` counts goals, check-ins and people as restored (`src/domain/removal.ts:557`); teams, reviews and asks are put back but not counted. `PastImports.tsx:62` shows Undo only above 0, and `src/ui/UndoImport.tsx:56-63` says "Nothing left to undo: all 0 rows have changed since." A People file changing one team's objective: no Undo button, though the MCP tool would undo it. Fix: count every kind the plan puts back, and test on whether the commit is empty.

**2. Medium. A partial Undo leaves live goals feeding a goal it has just deleted.** Each added goal is judged alone (`removal.ts:495-503`), never by whether a kept goal still has it as parent, and `deleteGoal`'s `detach` (`:248`) is skipped. Import adds a parent and child, someone changes the child's target, Undo: the child stays live under a removed parent. The same happens, unnamed, when a later import added the child. Fix: keep and name the parent, or detach as a delete does.

**3. Medium. Undo removes a person the import added even when they now lead a team** (`removal.ts:520-524` checks only actions and owned goals). After Undo, CI/CD was led by a removed person with nothing skipped. Reviews and asks follow the same lines (read).

**4. Medium. Past imports labels three kinds of entry wrongly** (`importName`, `removal.ts:587-592`). A corrected check-in from the form is listed as "A spreadsheet"; adding emails on People is "Bulk edit on Goals"; the page's own line does not mention corrected check-ins.

**Lows.**
- Undoing two imports newest first leaves the older one stuck: the first Undo's own changes count as "changed since" (`removal.ts:487-488`).
- "Saved n changes" and "n rows go back" count different things ("1 goal deleted" becomes 2 rows).
- After Save, Check flashes "Nothing has been saved" with new Must fix groups for about 270 ms before Imported appears (dev server).
- A search with no match on Past imports shows a blank list with no words (`PastImports.tsx:36-39`).
- "Undo this import" in Activity is 32 px high on a phone.
- Wording: "1 of its 3 rows have changed since"; "undid loaded a spreadsheet"; the Undo hint shown to someone who cannot undo.
- The rule page says MCP says "Nothing left to undo"; the tool says "Undo would put back 0 rows" and then marks the import undone (read).

**Checked and fine.** Undo twice, by a non-author, and of an old import are refused. The sheet, the toast and the store agree. Rows changed since are skipped and named, never overwritten. A person marked as left and a goal deleted by a row's Action come back whole, with links, reviews and asks. `asBefore` is used for every kind with removal fields. The screen and `undo_import` call the same rule. The Undo is confirmed in a sheet that says what it will do; no stripes, pills or emoji. **Unconfirmed:** a goal added by an import and then watched or carried into next year.
