# RD: outside review of each merged PR

10 November 2026. A running log kept by the outside reviewer for the app redesign (backlog RD). One section per pull request merged into main from 11:55 UTC, newest last. Each was read against its spec (`docs/design/<area>/spec.md`, `docs/design/architecture.md`), `CLAUDE.md` and `docs/design-rules.md`.

Only confirmed findings are listed: each was traced in the code and, where it shows on screen, opened in the demo (`/demo?today=2026-11-11`). Style and nits are left out. Findings of medium severity or worse were sent to the planning session when found.

| Severity | Means |
|---|---|
| High | Wrong data, lost work, or a rule broken for everyone |
| Medium | Wrong behaviour someone will meet, a rule restated, a missing eval for new behaviour, or an unexplained departure from the spec |
| Low | Real, but small or rarely met |

## Pull requests

### #88 AR1 with AR4: the Search and Prefs ports (track 1, merged 12:19 UTC)

Read against `docs/design/architecture.md` 1.1, 2 and 4.4, and `docs/design/find/spec.md` section 5 (rules 1, 5, 7). `npm run spec` and `npm run build:mcp` on the merged main write nothing new, so `spec/` and `api/mcp.js` are as generated. The near miss correcting from four letters, not five, is a departure the PR states.

**1. Medium. A Goals link's search now means one thing on the Goals screen and another in `find_goals`.** Rules live once; the departure isn't stated.

- Where: `src/domain/find.ts:139-142` (`searchGoals` empties the link's `q` and matches with `textMatches` over `goalWords`); `src/domain/query.ts:138-143` (`matches`, which the Goals screen still uses, keeps its own word list and `hay.includes`); `src/mcp/tools.ts:229`.
- The find spec's rule 1 says `matches` in `query.ts` calls `textMatches`. It doesn't yet, so there are two matching rules and two lists of "the row's words" (the new one adds the key and the status word).
- Reproduce (demo workspace, 2 Nov 2026, as `src/mcp/mcp.test.ts` builds it): `find_goals({ query: 'q=flow' })` gives 0 goals where `applyQuery` with the same link gives 1; `q=back` 7 against 9; `q=lin` 5 against 37; `q=off+track` 12 against 0. The tool's description still promises "the query of a shared Goals link … for every filter and sort the Goals screen has".
- Suggested fix: make `matches` call `textMatches(goalWords(s), q.q, g.key)` (move `goalWords` so `query.ts` and `find.ts` don't import each other), rewrite its "includes" test as the spec says, and add a test that `find_goals({ query })` and `applyQuery` return the same goals for a link with `q`. That changes what Goals' search finds, so it needs a What's new entry; if it is meant to wait for FS2, say so and keep the link's `q` on `matches` until then.

**2. Medium. `find_goals` with `status` or `level` and a link or saved view that filters the same thing returns goals it should not.** A regression: before, the arguments narrowed the link.

- Where: `src/mcp/tools.ts:224-225`.
- `status`: when the link's statuses don't include the one asked for, the intersection is `[]`, which `applyQuery` reads as "no status filter". Reproduce: `find_goals({ query: 'status=on', status: 'off' })` returns all 126 goals, of every status (before: none). The same happens with `view:` and a saved view that filters by status.
- `level`: the argument replaces the link's levels instead of narrowing them (`query: 'level=team', level: 'svp'` gives SVP goals; before: none).
- Suggested fix: as `owner` already does on line 226: when the two don't overlap, find nothing (return no goals before searching, or a value that matches none). Add a test for each.

Nothing else found. `actionList` now always takes its cycle; every caller passes one.

### #87 AR3: one way to run an action (track 2, merged 12:20 UTC)

Read against `docs/design/architecture.md` 1.4 and section 2 (AR3). Each alias in `src/app/state.tsx` was compared with the method it replaced: the same rule, the same inputs, the same message and Undo. The metric library's actions sit in the core's table until AS part 2, which the PR says.

**1. Medium. R1's access table now says something the rules don't enforce.**

- Where: `src/spec/internal.ts:79`, generated into `spec/requirements/internal/r1-sign-in-and-access.md:61`: "Mark goals reviewed in a session; accept the risk on a goal behind, with a reason | Anyone in the review".
- `markReviewed` and `acceptRisk` (`src/domain/actions.ts:174-192`) check nothing about who is in the review; both call `reviewCall`, whose own row, one line up, says "Anyone". Only the screen holds people outside the review back (`src/screens/Inspect.tsx:106`). In the same table "in it" means a member of the review (`saveReview`: "Someone in it, whoever set it up, or an admin").
- Why it matters: R1 says the server enforces the table, and the redesign specs lean on "the action already enforces it". A team copying the command port would either build a check Faro doesn't have, or trust a check that isn't there.
- Suggested fix: change the words to "Anyone", as `reviewCall`'s row has it (no behaviour change). If Lane wants it limited to people in the review, that is a product call and a new check in `reviewCall`, with a test.

Nothing else found.

### #89 0c: Faro fenced off inside family-hq (reviewed before merge at 43eef67, at the planning session's request; merged unchanged at 12:46 UTC)

**Verdict: GO to merge.** Migration 0035 is safe for the other app's tables and for the running app. One thing must be fixed before the role script is run and the fence is called done (finding 1); it does not make merging unsafe.

How it was checked: every file read; the PR's own tests run (`src/data/fence.test.ts`, `src/adapters/supabase/schema.test.ts`, `src/adapters/stores.test.ts`: 36 pass); and a local Postgres 16 shaped like Supabase (a `postgres` role that is not a superuser, `anon`, `authenticated`, `service_role`, Supabase's default grants in `public`, a family table with rows, a row rule and a function, and a table named `okra_recipes`), with 0001–0034 applied by main's migrator and then this branch's `check-fence`, `migrate` and role script. The live project was not touched or queried.

**What holds**

| Claim | Result |
|---|---|
| 0035 moves only `okr_*` | Yes. 28 tables, 42 functions, 69 row rules and 4 triggers moved; nothing else is in `faro`; the family table's rows (checksum), owner and grants, and `okra_recipes`, are unchanged |
| One transaction; a failure half way | Yes. `scripts/migrate.mjs:39-47` wraps the file and its record in one transaction. Forced to fail on an `okr_` table the role didn't own: no `faro` schema, every table still in `public`, nothing recorded |
| Safe to run twice | Yes. A second run is "Database is up to date"; the SQL itself skips what has moved and what already has a redirect |
| Grants and `search_path` widen nothing | Yes. Every table's grants and row-rule switch, and every function's grants, are identical before and after. `anon` gets only USAGE on `faro`: still refused on `okr_api_tokens` and `okr_telemetry_nightly()` by either name, can't truncate or create. Redirect views are all `security_invoker`; no redirect function is `security definer` |
| The redirects keep today's app working | In Postgres, yes: old names read and write, the storage rules follow their functions to `faro`, and no earlier migration uses a custom type, an extension function or a realtime channel that the new `search_path` would lose. Not provable here: the real Data API over the views (see 4) |
| The pg_cron reschedule | Same name, schedule and role as 0022's, so it replaces the job. But see 1 |
| `check-fence.mjs` prints no names or secrets | Yes: role names and counts only |
| The PGRST106 fallback | Correct as read and as tested: only a 406 with that code, only on a request that asked for `faro`; the retry carries the same body. No HEAD requests, raw Data API calls or realtime outside it |
| No service-role key in code that runs | Yes. The only matches are supabase-js's own comments inside `api/mcp.js` |

**1. High, before step 2 (not blocking the merge). `faro_owner` can get out of the fence, two ways, while the fence check says "Fenced".**

- (a) `supabase/migrations/0035_faro_schema.sql:115` schedules the nightly job as whoever applies 0035 (postgres), calling `faro.okr_telemetry_nightly()`. `supabase/manual/faro-role.sql:54-60` then gives that function to `faro_owner`, who can replace it. Reproduced: as `faro_owner`, `create or replace function faro.okr_telemetry_nightly() … security invoker` copying the family table into `faro`; run as postgres, as pg_cron would that night, it copied both rows.
- (b) `supabase/manual/faro-role.sql:57` leaves five `security definer` functions with postgres (`okr_is_builder`, `okr_builder_tokens`, `okr_builder_token_create`, `okr_builder_token_revoke`, `okr_markup_pictures_open`). They read Faro's own tables by plain name, and `faro_owner` owns those. Reproduced: as `faro_owner`, rename `okr_builders`, put a view in its place whose column calls a function of its own, set `request.jwt.claims`, call `faro.okr_is_builder()`: the function ran as postgres at once. As the schema's owner, `faro_owner` can also drop all five.
- Why it matters: the script's promise is "nothing outside faro". Against an accident it holds; against anyone holding CI's `DATABASE_URL` it does not. It is still better than today, when CI holds postgres itself.
- Suggested fix: nothing in `faro` owned by a stronger role, and no stronger role running Faro's code as itself.
  - The job: run it as `faro_owner` (reschedule it from the role script under that user, or drop it and run `select faro.okr_telemetry_nightly()` from a scheduled CI job on `DATABASE_URL`).
  - The five functions: have the builder ones read `current_setting('request.jwt.claims', true)` instead of `auth.jwt()`, so `faro_owner` can own them; for `okr_markup_pictures_open`, either a column grant on `storage.buckets (id, public)` or drop the function and have the deploy check ask another way.
  - `scripts/check-fence.mjs`: also fail when anything in `faro` belongs to another role, and when a cron job that names `faro` runs as another user. Add both cases to `src/data/fence.test.ts`.

**2. Medium. The fence check counts tables only** (`scripts/check-fence.mjs:31`). Functions are executable by everyone unless revoked, so a `security definer` function of the other app is a way to read its rows that the check can't see. Reproduced with a stand-in: `faro_owner` read both family rows through `public.family_all()` while the check said "Fenced". Whether the live project has such functions is for Lane to look at. Fix: count `security definer` functions outside `faro` and the system schemas that the role may execute, and fail on any.

**3. Medium. After 0035, the next migration behaves differently, and "any order works" stops being true.**

- A new table lands in `faro`, where Supabase's default grants for `public` don't apply. Migrations such as 0033 never grant to `anon`: they relied on that default. From 0036 each new table needs its grants written out.
- A new table or column has no redirect: the views are `select *` fixed when made (`0035:73`), and `faro_owner` can't create in `public`. Until "Exposed schemas" includes `faro` (step 4), the app in fallback can't see it. Dropping or retyping a column a redirect shows will fail (and roll back).
- AS part 2 may bring a migration today. Do step 4 before any 0036 merges, and say both points in the migration notes.

**4. Low. To watch at the merge.**

- The redirects were proven on Postgres and on the repo's stand-in client, not on the real Data API. Saves through the views rely on it working out each view's key and reloading its schema cache after the move. Adding `notify pgrst, 'reload schema';` to the end of 0035 costs nothing; open the shared app and save something straight after the merge, and do step 4 soon so the fallback is short-lived.
- `src/adapters/supabase/server.ts:21` now reads `SUPABASE_KEY` before `VITE_SUPABASE_KEY`. If Vercel has a `SUPABASE_KEY` holding anything but the public key, the server would use it. Check when deleting the service-role key.
- A migration applied as postgres between 0035 and the secret change is owned by postgres; run the role script again afterwards (it is safe to).

### #90 WR1: People has its own place (track 3, merged 12:41 UTC)

Read against `docs/design/workspace/spec.md` sections 1, 2.1 to 2.4, 3, rules 4, 5 and 8, and section 6. Opened in the demo at 1440 and 390 px: People, a person, Teams, a team, every old address in the redirect table, a team that doesn't exist, a page past the end, and the status links into Goals. The redirects, counts, paging and "who sees what" are as the spec says; no edge, capsule or sideways scroll on the new rows. The departures the PR lists (the function's name, the demo's real first person, F10's Teams row, the Admin tick box until WR3) are stated. N11 and P16 are left to WR6 and WR2, as the spec's plan has them.

**1. Medium. The directory restates rules that already live elsewhere.** Rules live once; not stated in the PR.

- Word-start matching now exists twice. `src/domain/directory.ts:12-21` (`fold`, `wordsOf`, `matchesWords`) and `src/domain/find.ts:15-34` (`fold`, `wordsOf`, `textMatches`, merged twenty minutes earlier in #88) are the find spec's rule 1 written two ways, with different word breaks (the directory's also breaks at `&` and keeps the unbroken word). The find spec says people's search calls rule 1 for its text.
- A person is now searched three ways: `findInDirectory` (`directory.ts:38`), `searchPeople` behind the Search port (`find.ts:146`), and the picker's older `findPeople` (`src/domain/people.ts:165`, which matches anywhere in the text). Teams twice: `findTeams` and `searchTeams`. Their orders differ too (the port puts names that start with the search first).
- `teamSummary` and the team filter write out `teamPeople` and `teamMembers(…).current` again (`directory.ts:43`, `:84-85`; the originals are `src/domain/actions.ts:470-484`). Rule 5 in the spec says to take them from those two functions so the counts can't drift.
- Suggested fix: `matchesWords` becomes a call to `textMatches`; `teamSummary` and the filter call `teamPeople` and `teamMembers`; and when FS2 lands, People and Teams ask the Search port (`person` with the team and admins filters, `team`) so `findInDirectory`, `findTeams` and `findPeople` go.

**2. Low. A person who has left is titled "(left) (left)".**

- Where: `src/screens/People.tsx:212`. `app.person` already gives a left person's name with "(left)" (`src/app/state.tsx:452`, `leftName`), and the heading adds it again.
- Reproduce: in the demo as Amara, open Oskar Lindgren, "Mark as left…", then open `/people/oskar`: the heading reads "Oskar Lindgren (left) (left)". The browser's title is right.
- Suggested fix: drop the heading's own suffix; have U43 check the heading's exact words.

### #93 0c hardening: the fix for #89's finding 1 (reviewed before merge at d392023, at the planning session's request; merged unchanged at 13:20 UTC)

**Verdict: GO to merge.** Both ways out that I found in #89 are closed, and 0036 changes nothing outside Faro.

How it was checked: the same local Postgres 16 shaped like Supabase, this time with a stand-in pg_cron holding 0035's nightly job and a job of the other app's, brought to today's production state by main's migrator (0001–0035); then this branch's `check-fence`, `migrate` (0036, twice) and role script (twice). The PR's tests pass (`src/data/fence.test.ts`, `src/data/markups.test.ts`: 23). The Storage probe was tried once against the live project's public address for a picture that doesn't exist, which is the request the code makes; nothing else live was touched.

**What holds**

| Claim | Result |
|---|---|
| The cron route is closed | Yes. 0036 removed `okr-telemetry-nightly` and left the other app's job alone. As `faro_owner`: no rights on `cron`; the nightly function replaced with one that copies the family table, run as CI now runs it, is refused ("permission denied for table family_members") |
| The definer-function swap is closed | Yes. After the role script nothing in `faro` belongs to another role. The same swap of `okr_builders` for a view, then `faro.okr_is_builder()`: refused, because the function now runs as `faro_owner` |
| 0036 | The four builder functions keep their signatures, grants and behaviour (a builder's email in `request.jwt.claims` is still recognised, through the old names too); `okr_markup_pictures_open` and its redirect are gone; a second run is a no-op; one transaction; the family table's checksum is unchanged |
| The role script | Refuses before 0036; hands over every function; runs twice |
| `check-fence` | As postgres it warns with counts (1 cron job, 1 definer function, in my set-up). As `faro_owner` it fails on a stand-in family `security definer` function that everyone may run. No names printed |
| The Storage probe | Live Storage answers `NoSuchKey` for a missing picture in `markups` and `NoSuchBucket` for a bucket that isn't there, as `picturesOpen` expects |
| `server.ts` | Reads `VITE_SUPABASE_KEY` only |
| The nightly workflow | Runs `faro.okr_telemetry_nightly()` as whatever `DATABASE_URL` names; that is postgres until the secret changes, which is no worse than pg_cron was |

**1. Medium, a follow-up (not blocking). One narrower way out remains: Storage's rules call Faro functions as whoever is using Storage.**

- Where: `supabase/migrations/0024_markups_and_tokens.sql:163-175`. The rules "markups: upload" and "markups: builders read" on `storage.objects` call `faro.okr_markup_id_ok` and `faro.okr_is_builder`, which `faro_owner` now owns and can rewrite.
- Reproduced: as `faro_owner`, make `okr_is_builder` a `security invoker` function that copies the family table into `faro`. A signed-in user of the other app then listed Storage without naming a bucket; the rule ran the function as that user for the row in `markups`, and the two family rows that user could read were copied where `faro_owner` reads them. A query that names another bucket as a constant doesn't trigger it.
- It needs someone holding the Faro role's password and a signed-in user of the other app whose query reaches a `markups` row, and it yields only what that user can see. The fence check doesn't look at it.
- Suggested fix: drop "markups: builders read" (pictures have been public-read since 0031) and have the upload rule call nothing in `faro` (the id's pattern, inline); add to `check-fence` a count of rules outside `faro` that depend on a function in it. It needs postgres, so it is a paste-in for Lane or a migration before the secret changes.

**2. Medium, a decision for Lane before the secret changes.** The merge run prints, as a warning, how many `security definer` functions outside Faro everyone may run. If it isn't 0, the fence check will fail every migration once `DATABASE_URL` is `faro_owner`, and the only cure is changing the other app's grants. Read that number on the merge's CI run and decide then.

**3. Low.**

- `supabase/manual/faro-role.sql:70` unschedules any pg_cron job whose command contains `faro.` or `okr_`, whoever's it is: the one statement here that could change something that isn't Faro's. Naming the job (`okr-telemetry-nightly`) would be exact. The other app's job was untouched in my run.
- Once the role owns `faro`, reading Faro's tables as postgres (the dashboard's table editor, the SQL editor) runs whatever `faro_owner` has put behind them, as postgres. `supabase/README.md` should say to `set role faro_owner` first.

### #92 GT1: act on a goal (track 2, merged 13:08 UTC)

Read against `docs/design/goal/spec.md` 2.1, 2.4, 2.6, section 3, rules 1 to 3 and sections 5 and 6, and `docs/design/architecture.md` 1.4 and 4.5.

**Nothing found of medium severity or worse.**

Checked in the demo on Lead time for changes as Rhea, Amara and Oskar at 1440 px and as Amara at 390 px:

- The bar's buttons and the list's rows, labels and buttons are the spec's worked examples for each of the three, and the ask's words are on the page once.
- Why carries only the pointer; the order is the same at both widths; nothing scrolls sideways.
- As Oskar, "Add a next step" starts with nobody chosen and asks for all three fields in the spec's words; the new step and a new question appear as rows with the right button for him and for Rhea.
- On a goal gone quiet, "Ask Kojo for an update" becomes an "Update asked" row with Withdraw.
- States are words and the overdue mark is the warning mark; no capsules or edges.
- The new rules take narrow inputs and use `canAnswer`, `canMarkDone` and `canWithdraw` from `asks.ts`; no new action was added for "Ask for a decision or help".

The two things kept back until after Wednesday (`goal.sections` not yet inside About; the review walkthrough's list) are stated in the PR. The section link still says "Activity": the rename to History is GT2's.

**Low.** An open next step's row shows "Change" beside its one button for whoever agreed it or an admin (`src/screens/GoalScreen.tsx`, `StepRowItem`), where the spec gives a row one button at most. It is today's way to correct a step, so it may be meant; the PR doesn't say.

### #95 0c: Storage's rules call nothing in faro (reviewed before merge, at 5b9276a, at the planning session's request)

**Verdict: NO-GO as written, for one small thing (finding 1). The fix itself is right, and with that guard changed it is a GO.**

How it was checked: the local Postgres 16 shaped like Supabase, brought to the state after 0036 by main's migrator, with a rule of the other app's on `storage.objects`; then this branch's `check-fence`, 0037 (twice) and the role script (twice). The PR's tests pass (24). Nothing live was touched.

**What holds**

| Claim | Result |
|---|---|
| The Storage escape is closed | Yes. With `okr_is_builder` and `okr_markup_id_ok` rewritten by `faro_owner` to copy the family table, a signed-in user of the other app listed Storage (a `markups` row included): nothing was copied |
| anon can still upload a markup's pictures | Yes. The four pictures go into a folder named like a markup id. Refused: a fifth name, a folder that isn't `mk_` and 16 hex digits, a nested folder, no folder, another bucket, replacing one, renaming, deleting |
| 0037 touches only Faro's two rules | Yes. "markups: builders read" is gone, "markups: upload" names no function in `faro`, and the other app's rule on `storage.objects` is unchanged. A second run is a no-op |
| `check-fence` | As postgres it warned of 2 rules before 0037 and counted 0 after; as `faro_owner` it says "Fenced" |
| The role script | Refuses before 0037; runs twice; unschedules only `okr-telemetry-nightly` |

**1. Blocking, though it fails safe. 0037's guard may stop the migration on the live project.**

- Where: `supabase/migrations/0037_storage_rules.sql:17-24`. It goes ahead only if the role applying it owns `storage.objects` or is a member of its owner; otherwise, for any role but `faro_owner`, it raises "postgres can't change Storage's rules".
- On hosted Supabase `storage.objects` belongs to `supabase_storage_admin`. As far as I know postgres is not a member of that role there, and can still make rules on Storage's tables by a grant of the platform's own, which is how 0024's rules were made. If so, the guard answers "no" for a role that can, and 0037 fails. I could not check this without querying the live project.
- Reproduced locally in that shape (the table owned by a role postgres isn't in): "0037_storage_rules.sql failed and was rolled back". Nothing is harmed, but CI's migrate job goes red, every later migration waits behind it, and the role script keeps refusing.
- Suggested fix: don't ask first; try, and catch the refusal. Wrap the three statements in `begin … exception when insufficient_privilege then` and there keep today's two outcomes (a notice for `faro_owner`, an error for anyone else). That is right whichever way the live project is set up.
- Or, to merge as it is: Lane runs `select pg_has_role('postgres', (select relowner from pg_class where oid = 'storage.objects'::regclass), 'usage');` in the SQL editor. If it says true, this is a GO unchanged.

**After the review.** #95 merged at e7997ab at 13:48 UTC with finding 1 fixed as suggested: 0037 now tries the change and catches `insufficient_privilege`, with a test for it; nothing else changed from the commit reviewed.

**2. Low, a trade-off the migration states.** Uploading no longer needs an id issued in the last two hours, only one of the right shape. Anyone with the public key could already issue ids without limit, so the bucket is no more open to filling. The new part: a picture can be added later to an existing markup that lacks one of its four (ids are readable in the open inbox). It can't replace one.

### #94 WR2: Workspace opens on About (track 3, merged 13:32 UTC)

Read against `docs/design/workspace/spec.md` 2.5, 2.12, rules 1, 2, 3, 6 and 7 and section 5. Opened in the demo as Amara and Rhea at 1440 px and as Rhea at 390 px: the one-line header, the menu, the facts and their links, no "To sort out" for the example, the phone's "More in Workspace", an admins-only section opened by a member, an address that is no section, `/workspace/overview`, Leave at the foot of Settings, and the switcher. All as the spec says, apart from finding 1. The departures the PR lists (Leave moved now, `yearLine` built now, the switcher's role only on the open workspace, 260 px in F10) are stated.

**1. Medium. About's Year fact gives the wrap-up's opening date a week early.**

- Where: `src/domain/workspaceAttention.ts:84` (`yearLine`): the first day of week `first` is worked out as the start plus `(first - 1) * 7` days. Weeks count from 0 at the cycle's start (`currentWeek`, and `weekDate` in `src/domain/plan.ts:38`, which is start plus `week * 7`), so that is the Monday before.
- Reproduce: the demo on 11 Nov 2026, Workspace: "2026, week 46 of 53. The wrap-up opens on 14 Dec 2026." The cycle starts 22 Dec 2025 and the wrap-up opens in week 52 (`wrapUpOpen`), which begins on 21 Dec 2026. With the demo's date set to 14 Dec, the line says 8 Feb 2027 for a wrap-up that opens on 15 Feb.
- Why the tests didn't catch it: `src/domain/workspace.test.ts:129-130` pins "14 Dec 2026", and feeds the rule week 47 for 11 Nov and week 52 for 15 Dec, which that cycle's dates don't give (46 and 51). The spec asked for a conformance row from `wrapUpOpen`'s own date, and for the rule not to work the week out again.
- Suggested fix: use `weekDate(cycle, first)` for the date; correct the test's weeks and expect 21 Dec 2026; run `npm run spec`. Step 7 of tomorrow's demo shows this fact.

**2. Low.**

- `src/ui/AdminControls.tsx` is new here, says it is WR3's, and nothing imports it: WR3's code merged a step early, unused and without tests.
- Rule 1 now exists (`workspaceName`), but `src/screens/People.tsx:32` keeps its own copy, and `GoalScreen.tsx:418` and `Print.tsx:89`, `:195` still strip "Example: " from any workspace's name, which rule 1 says not to do for a real workspace named that way. WR5 ("one name for the workspace") is where the spec puts this; noted so it isn't missed.

### #91 FS1: find-and-pick (track 1, merged 13:44 UTC)

Read against `docs/design/find/spec.md` 2.3, section 4 and rules 6 and 7, and `docs/design/architecture.md` 1.1. Tried in the demo as Oskar at 1440 and 390 px in the next-step sheet (where it meets #92's change): nobody chosen to start; "Suggested" gives him, then the goal's owner with "who owns this goal", then his team; typing counts the matches ("14 match"), ignores accents, says "None match"; Enter chooses and Escape leaves the sheet open; rows are 52 px high. The places held back until after the talk (the goal forms, Data's Owner cell, the demo's Switch person) are stated.

**1. Medium. The pickers lint misses selects of everyone, so its "places still to move" list is short.**

- Where: `scripts/check-pickers.mjs:11`. It only counts a `<select>` whose options are mapped from something literally named `people`, `teams`, `goals`, `metrics`, `workspaces` or `allGoals` inside the select. Options mapped from a local variable aren't seen.
- Not counted, and not in `scripts/pickers-left.json`:
  - `src/ui/RemoveSheets.tsx:107` and `:172`: who takes over when someone leaves, a select of everyone else in the workspace (`others`); the spec's place 13.
  - `src/screens/DataTables.tsx:348`: Data's Owner cell (`opts`), which the PR says is in the list.
  - `src/screens/GoalFilters.tsx:298`: "In the tree of" (`tops`); the spec's place 4.
  - `src/screens/People.tsx:437`: "Move them to" a team (`others`); the list allows that file 3 and it has 4.
- Why it matters: the list may only shrink, so it will reach nothing while these remain, and the lint will keep passing a new select written the same way. It is the check behind "no list of everything survives" (N12).
- Reproduce: `node scripts/check-pickers.mjs` on main passes; `node scripts/check-pickers.mjs --left` doesn't name `RemoveSheets.tsx`, `DataTables.tsx` or `GoalFilters.tsx`.
- Suggested fix: add these to `pickers-left.json` by hand with their counts, and make the lint stricter than a name match: fail any `<select>` whose options come from a `.map(` unless the file and line are listed, or the options are a named fixed list (weeks, levels, sort orders).

**2. Low.**

- The words of a chosen row are written a second time in the control (`src/ui/Pick.tsx:205`, `rowFor`: a person's, a team's and a goal's two lines), beside `goalRow`, `searchPeople` and `searchTeams` in `src/domain/find.ts`; and it reads them from the loaded workspace, where the architecture has pickers ask only the Search port. A way to ask the port for rows by id would remove both.
- A person's suggestions list their team A to Z (`src/domain/find.ts:236`); rule 6 puts the team's lead first.
- On a phone the open picker is a panel over the lower half of the screen (390 by 438 px at 390 by 844), where the spec and the PR say a full sheet titled by the field's label.

**Carried over from #88.** Its two findings (a Goals link's search differing between the screen and `find_goals`; `status` and `level` with a link) are untouched by this PR and still on main.

### #98 FS2, first part: one search rule, and the list bar on Activity and Help (track 1, merged 14:04 UTC)

Read against `docs/design/find/spec.md` 2.1 and rules 1 to 5. **Both findings on #88 are fixed here and confirmed in the code**: `matches` in `query.ts` now calls `textMatches(goalWords(…))`, so a Goals link's search is the same on the screen and in `find_goals`, with a test that holds the two together; and `status` or `level` that don't overlap a link's now find nothing. The count line, filter line and none-found words are rules in `find.ts`; Activity's select of every goal is gone. What is held back (Data, Feedback, Goals' chips) is stated.

**1. Medium. Activity and Help don't search by the one rule, though the app now says they do.**

- Where: `src/domain/activity.ts:128-129` and `src/help/guide.ts:1136` still match a word anywhere inside a word (`includes`), each with its own list of the row's words. Activity's leaves out the goal's key.
- What the app says: Help's "Searching a list" (`src/help/guide.ts:521`), "Goals, Activity and Help search the same way", after "every word you type must start a word of the row … “back” doesn't"; What's new: "Searching works the same on Goals, Activity and Help … each from its start … One letter off, it shows the nearest match"; and Activity's own placeholder, "Find by person, goal, key or what was said".
- Reproduce in the demo (11 Nov):
  - Activity, "back": 289 changes match, more than "roll" (232), because it finds "Rollback" and "feedback";
  - Activity, "G-10": nothing, though changes to G-10 are listed;
  - Activity, "rolback": nothing, with no nearest match offered;
  - Help, "eck": 30 articles match (the same 30 as "check"); "chekc": nothing, no nearest match.
- Suggested fix: Activity's and Help's filters call `textMatches` over their row's words (Activity's with the goal's key), and their none-found goes through `nearMiss`; or, if that waits for the second part, Help and What's new say only what is true today.

**2. Medium. After a search on Activity, Back doesn't go back to the list as it was.**

- Where: `src/ui/ListBar.tsx:27-31` with `src/screens/Activity.tsx:88`. Typing writes the search over the entry the page opened with (replace), and Enter or leaving the field then adds a second entry with the same address.
- Reproduce: open Activity, type "kafka", press Enter, press Back: the address and list are unchanged. A second Back leaves Activity. The list without the search can't be reached by Back, which rule 4's example ends on ("Back: … as first opened").
- Suggested fix: the first key of a search adds the entry and the rest replace it; settling adds nothing when the address hasn't changed. U64 should press Back.

**3. Low.** The Goals screen works out the near miss itself (`src/screens/GoalsScreen.tsx`, `nearMiss` then `applyQuery` again), which `search` in `find.ts` already does behind the Search port. It moves with GL1 by the PR's own account; noted so the second copy goes then.

### #99 AR2: the module contract's additions, and navigation as rules (track 1, merged 14:16 UTC)

Read against `docs/design/architecture.md` 1.2, section 2 (AR2) and 4.1 to 4.2. The seven additions are the seven the architecture lists and no more; the four it cut are not there. `src/domain/navigation.ts` is pure and takes names, not the workspace. `sideFor`, `tabsFor`, `isLit`, `pageName` and `placeName` are the shell's and the Back link's old code moved unchanged, and the shell and Back link now call them.

**1. Medium. Two of the new navigation rules are not what the shell runs.**

- Where: `menuFor` and `litItem` (`src/domain/navigation.ts:43` and `:64`) are called only by the spec's rule page and the conformance file (`src/spec/rules.ts`, `src/spec/conformance.ts`). The shell still places a module's menu item and lights it with its own inline code (`src/ui/Shell.tsx:265`: the group test, and `navAt === n.to || navAt.startsWith(n.to + '/')`).
- Why it matters: the architecture asked for the menu and the lit item to be rules the shell draws. As merged, where a module's item goes and when it lights is written twice, and the copy that is tested and written into the rebuild kit is the one the app doesn't use. NV1's grouped menu and the Metrics row (ML1) are built on this next.
- Confirm: `grep -rn "menuFor\|litItem" src` finds no caller outside `src/spec` and the rule's own test.
- Suggested fix: have the shell draw the sidebar from `menuFor(ownsGoals, moduleNav)` and take the lit item from `litItem`; add a module item to one conformance row so the placement is pinned.

**2. Low.** `ModuleFinder.things` (a kind's nouns) is declared but the picker keeps its own table of nouns per kind (`src/ui/Pick.tsx`, `KINDS`, which already names `metric`), so a module's own words wouldn't be used.

Nothing else found. The filters-as-data shape matches 4.2; nothing applies a module's filter yet, which is GL1's and ML2's to do.
