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
| #192 New goal: #129's review, mediums 1 to 3 and 6 | 2 | 0 | 0 | 0 |
| #199 IM5: the way in | 3 | 1 | 4 | 6 |
| #202 GE3: the read-back | 2 | 0 | 5 | 3 |
| #208 New goal: Publish shows one outcome, not three | 2 | 0 | 0 | 0 |
| #212, #210, #205 A handoff-kit review, track 2's handover, a product-feedback evaluation | planning, 2 | 0 | 0 | 0 |
| #204 IM3's build review fixes | 3 | 0 | 0 | 0 |
| #214 IM5 review: a header differing only by punctuation is read again | 3 | 0 | 0 | 0 |
| #207 Goal menu: no "Check in for" the owner | polish | 0 | 0 | 0 |
| #209 Map: "Drawing the map…" only after 300 ms | polish | 0 | 0 | 0 |
| #193 AX5, first part: the query port and its contract | 4 | 0 | 4 | 5 |
| #213 Board and Table drawn in place after a layout switch | polish | 0 | 0 | 0 |
| #221 GE10 migration 0041: proposed_at and proposed_by | 2 | 0 | 0 | 0 |
| #169 HM1: Home asks first, and is quiet when quiet | 1 | 0 | 5 | 6 |
| #216 KT1: the handoff kit's small errors | planning | 0 | 0 | 0 |
| #222 The workspace boundary: admins-only triage and Start over, the switcher | polish | 0 | 3 | 4 |
| #227 Check-ins are the owner's (R1) | polish | 1 | 4 | 4 |
| #225 Correct this check-in corrects it | 1 | 0 | 6 | 5 |
| #171 U9, U111 and U23: three stale checks | 1 | 0 | 0 | 0 |
| #220 GE9 review fixes | 2 | 0 | 0 | 0 |
| #232 R1: the two exceptions named | polish | 0 | 0 | 0 |
| #228 GE3 review fixes | 2 | 0 | 0 | 0 |
| #231 IM4 review fixes | 3 | 0 | 0 | 0 |
| #236 IM5 review fixes | 3 | 0 | 0 | 0 |
| #235 KT2: changes.csv and drills for stages 2 and 3 | planning | 0 | 0 | 0 |
| #241 U93: a question about a number is where you can see it | 2 | 0 | 2 | 2 |
| #238, #237, #240 Handovers | planning, 5 | 0 | 0 | 0 |
| #247 Set-up check-ins are the owner's; delete and undo ask R1 too | polish | 0 | 0 | 0 |
| #252 Check-ins are the owner's, said everywhere | polish | 0 | 0 | 0 |
| #245, #253, #263 KT3 to KT5: contracts, import issue kinds and screens in the kit | track 6 | 0 | 0 | 0 |
| #251, #258 Two journeys' checks | evals | 0 | 0 | 0 |
| #259 BT: a batch names its own rows with Ref | MCP load | 0 | 1 | 1 |
| #239 Quarters before a goal existed are not judged | MCP load | 0 | 0 | 5 |
| #242 MCP: every create says the new goal's id and key | MCP load | 0 | 1 | 2 |
| #249 MCP: every list answers in one shape | MCP load | 0 | 1 | 3 |
| #261 find_goals: a pasted Goals link keeps its tab | MCP load | 0 | 0 | 3 |
| #234 FS2: search words on Data and Feedback | 1 | 0 | 3 | 2 |
| #255 CK2: the table check-in | 1 | 0 | 0 | 2 |
| #248 IM7: Export is one button | 3 | 0 | 2 | 5 |
| #257 IM6 part 1: large files | 3 | 0 | 2 | 3 |
| #270 GE10: proposed goals | 2 | 0 | 4 | 8 |
| #271 Batch refs: the two review findings | MCP load | 0 | 0 | 0 |
| #268, #275 KT5b and KT6: the kit | 6 | 0 | 0 | 0 |
| #285 ST1: welcome and join | 2 | 0 | 3 | 7 |
| #287 U93: the two review findings | 2 | 0 | 0 | 0 |
| #283, #284 KT7 and KT8: the kit; #279 journeys | 6, evals | 0 | 0 | 0 |
| #281 MT1: defining a metric well | metrics | 0 | 2 | 6 |
| #299 MT2: migration 0043 | metrics | 0 | 0 | 2 |
| #300 A range between two numbers (with #292, migration 0042) | 2 | 0 | 3 | 4 |
| #277 IM6 part 2: the import's worker, Stop, and files in parts | 3 | 0 | 3 | 7 |
| #310 HM2: asks say how long they have waited | 1 | 0 | 4 | 5 |
| #305 HM1 review: five mediums | 1 | 0 | 2 | 2 |
| #282 NV2, NV3 review | 1 | 0 | 2 | 3 |
| #274 GL2 review | 1 | 0 | 0 | 2 |
| #293 GE10 review: the four findings from #270 | 2 | 0 | 0 | 1 |
| #294 Track 7 review fixes (#242, #249, #239) | MCP load | 0 | 0 | 0 |
| #318 ST1 review: the three mediums from #285 | 2 | 0 | 0 | 0 |
| #313 FS1 review: three mediums from #111 | 1 | 0 | 0 | 0 |
| #291, #295, #296, #304, #307 KT9, KT10 and KT6: the kit | 6 | 0 | 0 | 0 |
| #244, #246, #254, #260 Backlog and handovers | planning, 6, 7 | 0 | 0 | 0 |

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
| #199: a column whose header differs from Faro's only by punctuation, an accent or spacing is neither read nor named | Track 3, 15:35 UTC, 12 Nov | **Fixed** by #214; the reproduction re-run: "Target.", "Tárget" and "Due_week" are read, a near miss is asked about, an unknown column is named |
| #227: any member can put a check-in on someone else's goal by creating it with stages already done | Its builder (session …91EAkyS7gzPSYrnJPg), 18:15 UTC, 12 Nov | **Fixed** by #247 (read, with its tests): the set-up check-in asks the rule at the form, a sheet, MCP and `recordStagesDone`; from anyone but the owner the goal is published without it, and the stage question says who marks it |

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

### #192 New goal: Continue after a Change on Check, focus mode, Check's values in full (track 2, merged 14:24 UTC, 12 Nov)

Takes the last two of #129's mediums still open after #197. Continue now goes to the later step that no longer holds, with its faults shown (`src/screens/GoalWizard.tsx`, `go`), and Check's values wrap in full (`src/styles/finish/wizard.css`, `.rr-value`). F16 also fails if the tab bar or sidebar shows on any step. Read, not re-run on screen. No finding.

### #199 IM5: the way in (track 3, merged 14:35 UTC, 12 Nov)

Read first by a separate reviewing session, with throwaway tests and on screen as Grace and Rhea; finding 1 was then re-run by this reviewer on main.

**1. High (re-run by this reviewer). A column whose header differs from a Faro column only by punctuation, an accent or inner spacing is neither read nor named.** `headerMatch` (`src/domain/sheets.ts:152`) calls anything equal after folding "exact"; `namedHeaders` (`src/domain/changeset.ts:229`) skips "exact", so the row's key stays `target.` and the engine never looks it up; and only "unknown" headers are listed as not read (`sheets.ts:223`).
- Re-run on main: `ID,Goal,Target.,Reason` with `ns-lead,Lead time for changes,31,probe`. The file line is "Read upd.csv.", no column is named as unread, and nothing would change. With `Target` the same row is "Changed target". The same silence for `Tárget` and `Due_week`.
- The first reader saw it on screen ("Nothing would change. All 1 row says what Faro already says.") and for `Owner_email`, `Owner-email`, a double space and a non-breaking space. Before this PR the column was named: "Not read: the column Target.".
- A person who loads targets under such a heading is told the file was read and that it matches what Faro has.
- Fix: rename every key whose lower-case form is not the column's own name, "exact" included, and add fold-equal headers to the unit tests.

**2. Medium. A People sheet with a "Title" or "Objective" column is refused as "not a Faro sheet".** The kind is judged after renaming with Goals' other names first (`sheets.ts:159-165`, `:178`; `src/domain/columns.ts:491`), so `Name, Email, Title, Team` becomes `Name, Email, Goal, Team`. Before this PR it was read as People. Fix: judge each kind with its own names.

**3. Medium. When two columns map to the same Faro column, one is dropped without a word, and which one wins varies** (`changeset.ts:231`): `Goal` beats `Goal name`, but of `Goal name` and `Title` the later wins. Before this PR the extra column was named.

**4. Medium. "Download the rows to fix" blanks a near-header column**: `src/modules/spreadsheets/rowsFile.ts:23` looks up the lower-case key, but a near header keeps its key as written.

**5. Medium. With a near-header question unanswered, the preview also raises Must fix for the same column** ("1 new goal has no Target" beside "Read it as Target?"), with "Leave these rows out" offered (`changeset.ts:259-266`).

**Lows.**
- The header-row sentence and row numbers ignore blank lines ("Row 2 … is the header row" for file row 4; `sheets.ts:46`).
- A title row is not skipped in a semicolon or tab-separated file: the separator is read from the first line only (`sheets.ts:19-29`).
- On Import, choosing the same file again after an error probably does nothing: the input is not cleared (`Import.tsx:88`; partly run).
- A paste with no header row puts a `<details>` inside a `<p role="alert">`, and React logs nesting errors (`Import.tsx:93-96`).
- Wording and small points: "All 1 past imports"; an image renamed .csv is described by its bytes; the drop area has no name and the hidden file input is a 1 by 1 tab stop; two links are 20 and 17 px high on a phone; a garbled sentence in `help.ts:16` (read).
- The row and size limits and the header-row sentence live in `Check.tsx`, not the domain; no unit test covers the paste choice, the limits, or two columns for one field (read).

**Checked and fine.** A CSV with a byte-order mark, Windows line endings and quoted commas, a semicolon CSV, a zip, drag and drop and a pasted table all read the same rows. The downloaded workbook loads back unchanged, each unread sheet named. Images, PDFs and oversized or empty files get a calm refusal. A second file keeps answers and resets left-out rows and the reason. Focus lands on the preview's heading; errors are announced. No stripes, pills or emoji; one primary button per mode.

### #202 GE3: the read-back (track 2, merged 14:50 UTC, 12 Nov)

Read first by a separate reviewing session, on screen at 1440 and 390 and with throwaway tests; findings 1 and 2 were read again by this reviewer on main. No high finding. The first reader rated 1 and 2 high; they are logged as medium because 1 is layout, not data, and in 2 Check says "No metric" before anything is published. In every goal published, the sentences matched what was saved.

**1. Medium (re-read). The read-back lays out as two or three narrow columns, not full-width rows, at every width.** The list is `review-rows read-back` (`src/screens/GoalWizard.tsx:469`), and `.read-back` is already the start-next-year counts' grid (`src/styles/notes/workspace.css:167`, `repeat(auto-fit, minmax(150px, 1fr))`). At 390 the sentences wrap in two 170 px columns; at 1440 there are three. Every new goal meets it, and U137 and F3 pass with it. Fix: rename the form's class, and have F3 check each row is as wide as the list.

**2. Medium (re-read). A reload on Check, or coming back to a kept draft there, drops the chosen metric, and Publish saves the goal without it.** #198 put the choice in the draft (`measureKept`), but Check and `publish` read `measure`, which is state that only the Measure step's place sets (`GoalWizard.tsx:98`, `:370`). After a reload on Check: "No metric, and not described yet.", the "You said" row gone, and no link saved. Fix: work the pick out from the draft, not from mounted state.

**3. Medium. After Change on "Who and where" and a new team, the metric stays sliced to the old team.** Continue returns straight to Check without passing the Measure step. Saved: the goal in Build & Release, measured by "Flaky test rate" for CI/CD, a state the form cannot otherwise make. Same cause as 2.

**4. Medium. "Until its first check-in you can change anything, or delete it" is untrue for a stages goal with a stage answered "Yes, done"** (`src/domain/readBack.ts:160-162`): the save writes a check-in with it, so the goal can be stopped but not deleted.

**5. Medium. Several things the form saves are not read back**: the estimated effect and why it helps, where the number comes from, how a stages goal is measured, each stage's name and week, and numbers set by hand. The code follows the spec's rows here; the gap is the spec's.

**Lows.**
- Change on "Who and where" leaves focus on the page body (`GoalWizard.tsx:168` at the merge).
- Rules restated in `readBack.ts`: `andList`, "Higher/Lower is better", the first due week, month names, and shape words that differ from the form's own hint (read).
- Wording at the edges: "feeds nothing" said twice; "within 1% of the limit" where the app says "1 pt"; "1 stage, the last due week 50"; with every stage done it still says when the first check-in is due.

**#129's findings at this merge.** Continue after a Change on Check is fixed (run). Values are no longer cut with an ellipsis, though finding 1 makes them narrow.

**Checked and fine.** Four published goals compared with the store: a falling number with a metric, weeks in 2027, another owner, a parent, also-helps and a guardrail; a limit of at least 1,250,000 with a margin; stages with one done and one overdue; a number set by hand. Thousands separators, singulars, negatives and dates read correctly. Each row's Change is 56 by 46 on touch and named. `readBack.ts` is pure.

### #208 New goal: Publish shows one outcome, not three (track 2, merged 15:28 UTC, 12 Nov)

Takes #202's last low (the "A question is still to answer" flash after Publish). A goal is never asked about as its own twin, whether it is the one being changed or the one this draft was just saved as (`src/domain/goalEntry.ts`, `checksContext`, with a unit test). The form freezes its questions when Publish is pressed, releases them if the save fails (`src/screens/GoalWizard.tsx:217`, `:233`), and says "Published" once saved. Read. No finding.

### #212, #210 and #205 Documents (merged 16:00 to 16:01 UTC, 12 Nov)

A review of the handoff kit, track 2's handover and an evaluation of product feedback: three documents, no code. Not reviewed.

### #204 IM3's build review fixes (track 3, merged 16:08 UTC, 12 Nov)

Takes #191's four mediums and four of its small slips. The preview is worked out without the reason and once more with it when saving (`src/modules/spreadsheets/importPlan.ts`, `toSave`), so typing the reason no longer re-checks the file. The answer picker takes its width; focus goes to the next question or Save after an answer; U96 leaves a row out and saves the rest on screen. Read, not re-run. No finding.

### #214 IM5 review: a header that differs only by punctuation is read as its column again (track 3, merged 16:12 UTC, 12 Nov)

Fixes #199's high: `namedHeaders` now renames every key that is not already the column's own name (`src/domain/changeset.ts`). Re-run on main with this review's probe: `Target.`, `Tárget` and `Due_week` each give the plan change `Target` gives; `Tar get` and `Targett` are asked about; `Budget` is named as not read. No finding. #199's medium 2 is still there: `Name, Email, Title, Team` is refused as not a Faro sheet (re-run); its mediums 3 to 5 were not re-checked.

### #207 Goal menu: no "Check in for" the owner, and #209 Map: "Drawing the map…" only after 300 ms (polish, merged 16:27 and 16:48 UTC, 12 Nov)

#207 removes an admin's menu item that led to a page saying only the owner checks in (`src/screens/GoalScreen.tsx`), with a journey that nothing offered is then refused. #209 shows the map's waiting line only after 300 ms, holding the map's height meanwhile (`src/screens/GoalsScreen.tsx`, `MapWait`), and F6 checks both the quick and the slow load. Read. No finding.

### #193 AX5, first part: the query port and its contract; the first download 293 to 263 KB (track 4, merged 16:37 UTC, 12 Nov)

Read first by a separate reviewing session, with throwaway tests, a production build and the dev server; nothing here was re-run by this reviewer. No high finding. The port returns the same goals, counts and order as the code it replaced, across 1,742 combinations of viewer, scope and query, and the bundle claim holds.

**1. Medium. When the change engine fails to load, Post check-in does nothing and says nothing, and the tab cannot post until reloaded.** `run` awaits `ready(name)` with no toast on failure (`src/app/state.tsx:593`), and the form's `catch` only re-enables the button (`src/screens/CheckInFlow.tsx:352-355`). On a production build with the engine's chunk blocked and then allowed again, Post was pressed twice with no result and no further request; Chromium keeps the failed module. The draft is kept. Every other action that needs the engine fails the same way (read). Fix: toast a failed load, with the offline words when offline, and add a journey.

**2. Medium. What's new and the guide say Home lists your goals "worst first, then by name"; the code lists them in stored order, as before.** `applyQuery` sorts only when a sort is set (`src/domain/query.ts:212`), and Home asks with none. For 13 of the 29 owners with more than one goal the order is not worst first; as Rhea it reads On track, Done, On track, No check-in yet. Fix: ask with the sort, or withdraw the entry, the guide's words and two comments.

**3. Medium. The port's default order and its scope are not things a server could answer.** With no sort the adapter returns the workspace array's order (`src/adapters/localGoals.ts:23`), and the conformance file pins it. Scope travels as a list of every goal's ID built from the whole snapshot (`src/screens/GoalsScreen.tsx:121`), so the browser must already hold every goal (read). Fix: a defined default order, and scope as data.

**4. Medium. Each hook makes its own port, so Home and Goals summarise the whole workspace two or three times per change** (`src/app/goals.ts:12-19`). At ten times the demo's size that is about 550 ms on Home, where the old code took 20 ms. Fix: one port per workspace as loaded.

**Lows.**
- Paging by key repeats rows when the `after` goal has gone (`localGoals.ts:33`): 145 rows for 126 goals. Not reachable today; a server adapter would copy it.
- The engine guard in `src/app/engine.test.ts` is a one-line pattern that misses `import * as`, re-exports, double quotes and multi-line imports; the bundle budget is the real protection.
- `counts()` gives an attention count that disagrees with its own list on a near miss, and the conformance file now pins it (read; as before this PR).
- The switch's count is written twice: `attentionCount` has no caller left, and the adapter restates its query (read).
- No eval or journey came with the change, and the contract's cases are written out by the adapter they test (read).

**Checked and fine.** Home's counts for all 97 people. Stopped, removed and last-year goals are not listed. With the engine delayed by 7 s, Quick check-in, Data, People, bulk edit and Import show "Opening…" and then draw; a save started before it arrives waits, saves once and loses nothing. The unread dot, Home's news line and all 131 releases on What's new. A build measures 263 KB against 265, with the engine in its own chunk. The layers lint and all 1,319 unit tests pass.

### #213 Board and Table drawn in place after a layout switch (polish, merged 17:11 UTC, 12 Nov)

The row-motion layer keyed a row by the goal it links to, so a switch of layout slid every row from where the old layout had it. A row's key now starts with its kind (`src/ui/motion.ts`), with a new eval that fails on the old code and an F5 check. Read. No finding.

### #221 GE10 migration 0041: proposed_at and proposed_by (track 2, merged 17:13 UTC, 12 Nov)

Two nullable columns on `faro.okr_goals`, one merge ahead of the code that writes them. `add column if not exists`; the check constraint is dropped and added again, so it is safe to run twice; nothing outside `faro`; the column grants go to `anon` only, as the schema's other grants do, and widen nothing. The constraint keeps proposed and stopped apart and a proposer only with a time. Read in full. No finding.

### #216 KT1: the handoff kit's small errors (merged 17:37 UTC, 12 Nov)

Changes to the spec's generator (`src/spec/`) and its tests, from the handoff-kit review. One rule changes with it: the "Room to the limit" cell is now toned by the same near and out tests as "Vs the limit" (`src/domain/scorecard.ts`), so the two agree when the room equals the margin. Two type comments now say what is stored. Read; the generated pages were not compared line by line. No finding.

### #227 Check-ins are the owner's: R1, one rule, every door but two closed (polish, merged 17:45 UTC, 12 Nov)

Read first by a separate reviewing session, with throwaway tests at every door, the MCP tools and on screen; finding 1 was read again by this reviewer on main. At the form, Quick check-in, `post_check_in` and `bulk_change`, only the owner saves: two admins, a lead and a member were each refused in the same words.

**1. High (re-read by this reviewer). Any member can put a check-in on someone else's goal by creating it with stages already done.** The set-up check-in is written with the creator as author and never asks `mayPostCheckIn`: `src/domain/goalEntry.ts:593-596` (the form), `src/domain/changeset.ts:1116-1119` (a sheet, bulk, MCP) and `recordStagesDone` (`src/domain/actions.ts:599-602`, owner or admin). On main the rule is asked in one place only, `changeset.ts:1167`.
- First reader, on screen: as Oskar, a member with no goals, New goal with dated stages, owner Mateo, one stage answered "Yes, done in week 40", Publish. Mateo's new goal reads Done, "1 of 1 stages done", under "What the owner said in the week 40 check-in", and the store has `authorId: "oskar"`. The same through `create_goal` and `bulk_change` with Oskar's token.
- Only a goal the person creates can be touched this way; creating a goal for someone else is allowed by Lane's decision of 11 Nov.
- Fix: ask `mayPostCheckIn` for the set-up check-in in all three places. When the creator is not the owner, publish without it and say so at the stage question.

**2. Medium. An admin's token can still check in on someone's goal in one call, by taking the goal in the same change.** The engine judges the check-in against the goal as the same file has already changed it (`changeset.ts:1162`): `bulk_change` with an owner change and a check-in saved both. The mirror case, an owner handing over and checking in at once, is refused.

**3. Medium. The two open doors are keyed on the door, so they are wider than the PR and Help say.** `src/domain/goalRights.ts:28-33` lets an admin through for `spreadsheet`, `setup` and `table`, whatever the row is. As Grace, one pasted row on Import saved this week's new check-in on Mateo's goal, which is the door the goal menu lost. The list has three entries, not two. Fix: a workbook for past weeks only, and Data's tables only where a check-in exists.

**4. Medium. Deleting a check-in and undoing an import don't ask the rule** (`src/domain/removal.ts:311-325`, `:485`): an admin can delete an owner's latest check-in, the owner cannot delete one an admin loaded onto their goal, and a previous owner can delete where the new one cannot.

**5. Medium. The words still say an admin can check in**: `post_check_in`'s description (`src/mcp/tools.ts:296`), the check-in rule page (`src/spec/rules.ts:370`) and the delegates requirement (`src/spec/internal.ts:372`). An assistant will offer it and be refused, and the rebuild copies the rule page.

**Lows.**
- An admin answering an update ask still sees "Check in for week 46", which then refuses (`src/screens/Respond.tsx:75`); an open update ask stays with the previous owner after an owner change.
- An admin-loaded check-in is headed "What the owner said".
- Five screens compare the owner to the viewer themselves, and the form has its own refusal sentence (read).
- Tests cover the engine by door only; nothing covers the stages-done path, delete or undo, and no journey shows an admin refused (read).

**Unconfirmed.** Whether an admin should record a year-end wrap-up when they cannot record the final number (`actions.ts:298`); Lane's call.

### #222 The workspace boundary: admins-only triage and Start over, the switcher, who you are after a switch (polish, merged 17:18 UTC, 12 Nov)

Read first by the same reviewing session; nothing here was re-run by this reviewer. No high finding.

**1. Medium. On the icon rail there is no workspace switcher at all.** `.ws-head` is hidden there (`src/styles/notes/shell-settings.css:59`, `:75`) and the top-bar one shows only on a phone. At 1024 wide, and at 1440 with the sidebar as icons, nothing switches workspace. A rail icon was added in this PR and then taken out for P10.

**2. Medium. A member's token can set or overwrite a markup's GitHub issue, and a refused call half-saves.** `update_markup` stores the issue address before it checks the status change (`src/mcp/markupTools.ts:159-160`), and `src/markup/ops.ts:110` has no role check.

**3. Medium. Admins-only triage rests on a flag the browser supplies** (`src/markup/inboxData.ts:72`, read): the inbox is shared with the demo, where anyone can choose to see it as an admin. MCP is sound. Probably acceptable for Faro, and R1 already requires the server to enforce it in the rebuild; Lane's call.

**Lows.**
- The landing line is skipped on the browser's Back and on "Open another workspace" from the can't-open page (`src/ui/WorkspaceSwitch.tsx:63-67`, `src/screens/Start.tsx:79`).
- At 390 the switcher reads "Example d…", 108 by 24 px, with no "Switch".
- `WORKSPACE_MEANS` is copied into the guide and the glossary (read).
- In Feedback a member is told "only an admin" three times on one screen, and `src/markup/feedback.ts:3` still says anyone triages.

**Checked and fine.** A member sees no triage controls and the shortcut keys do nothing; an admin's change offers Undo. Both MCP tools refuse a member's status change in the same words. Start over and Delete are hidden from a member. The landing line names the person and role, once, and not when nothing changed. No frame was seen acting as the previous workspace's person.

### #169 HM1: Home asks first, and is quiet when quiet (track 1, merged 17:26 UTC, 12 Nov)

Read first by a separate reviewing session, with a rule probe over all 97 demo people on many dates and on screen at 1440 and 390; nothing here was re-run by this reviewer. No high finding. For the ordinary week the rule holds: one primary action or none, never a lead to an empty page, nobody with something due given the quiet line, and Home's counts equal Goals' and the sidebar's.

**1. Medium. "Nothing is asked of you today." sits directly above "Needs your response".** The lead has no candidate for asks (that is HM2), and `quietLine` (`src/domain/home.ts:210-226`) does not look at them. Amara on 11 Nov sees the quiet sentence above two asks, one waiting since 4 Aug. Fix: until HM2, don't say nothing is asked while asks wait.

**2. Medium. On a phone the lead's line and the quiet line's second line are cut to one line with an ellipsis.** `src/styles/finish/home-watching.css:231-234` was written for the old list of titles; HM1 puts whole sentences there. At 390, "Check-ins for week 46 are due by Thursday 12 …" loses "You have 7 to do".

**3. Medium. After the year ends, people in a review get a "Not held yet" lead that never goes away, with a false sentence.** `src/app/reads.ts:80-81` keeps the last week's session with no test for the year having ended, and `home.ts:183` says "Hold it now, or it closes when next week starts". Four people have it while the wrap-up is open and 19 once it has closed. The old Home also led with this review; the sentence and the warning mark are new.

**4. Medium. An admin's Home no longer says the year is ending or offers to start the next one.** The admin card was removed as the spec lists, and its replacement is HM7, not built. Grace on 28 Dec, 6 Jan and 10 Feb sees only the quiet line. The demo's year ends on 3 Jan.

**5. Medium. With two reviews on the same day, the second is nowhere on Home that day.** The "This week" cell takes the single next review, which is the lead's own and so is dropped (`src/screens/Home.tsx:240-243`), while the sidebar says "Reviews 2 to do".

**Lows.**
- Your goals with nothing flagged are still listed in stored order, and What's new still says worst first (`src/help/whatsNew.ts:73-75`). This is #193's finding, still open; the guide's words are now true.
- Home still summarises the snapshot itself beside the port, and asks the port for counts nothing draws (`Home.tsx:78-81`, `:269-276`; read).
- Restatements: a second version of the sidebar's "review to do" test, of the on-time test, and of the day and month names (read).
- The check-in lead and the cell both say the same review is today.
- Nothing tests `homeFacts` at the year's end or with two reviews; N26 covers 9 to 22 Nov only (read).
- The line under the greeting says "Example: Platform Engineering" where the spec wants the workspace's name alone.

**Checked and fine.** All 97 people on 9 to 15 Nov, weeks 2, 3, 47, 52 and 53, after the year ends, after the wrap-up closes and with 2027 started. Each lead's button opens a page with something to do. For all 86 owners the counts add up and every status link lists that many. `home.ts` is pure and the screen only draws it. No stripes, emoji or pills; at most one primary button and none when quiet; no sideways scroll; no layout shift on load.

### Review fixes and handovers merged 17:59 to 18:41 UTC, 12 Nov

Each was read from its diff and message; none was re-run on screen. No finding in any.

- **#171 (track 1).** Three journeys that failed on main for stale reasons (U9's step budget, U111's log check, U23 on a phone). Evals only.
- **#220 (track 2).** Takes #194's five mediums and three lows: a blank Due week beside a To says nothing; a bare number under From with no Start column is a Must fix asking which is meant; a cycle under 48 weeks names its weeks by the ISO week date; in the year's last week To defaults to the end of next year; the picker highlights on `mousemove`, and Escape and Tab close it.
- **#232 (polish).** Words only: the two admin doors for check-ins are now named as exceptions Lane kept on 12 Nov, each recording the admin as author. So #227's medium 3 is a decision, as far as the two doors go; a pasted row counting as a workbook is still worth a look. #227's high is still open on main: `mayPostCheckIn` is still asked only by the engine's check-in rows (`src/domain/changeset.ts:1196`).
- **#228 (track 2).** Takes #202's mediums 1 to 4 and two lows: the read-back has its own class and F3 checks each row is as wide as the list; Check works the metric out from the draft, so a reload keeps it and a new team re-slices it; the read-back says a goal with stages done can be stopped, not deleted. New journey U145.
- **#231 (track 3).** Takes #195's four mediums: Undo counts teams, reviews and asks; a goal it deletes leaves the tree as a delete does; a person who now leads a team, sits in a review or has an ask stays; a corrected check-in and a People bulk edit are named as such.
- **#236 (track 3).** Takes #199's mediums 2 to 5. Re-run on main for medium 2: `Name, Email, Title, Team` is read as People, with "Not read: the column Title".
- **#235.** The change engine's cases as a conformance file and drills for rebuild stages 2 and 3: the spec's generator and the drill script only.
- **#238, #237, #240.** Handovers. Not reviewed.

### #225 Correct this check-in corrects it (track 1, merged 17:54 UTC, 12 Nov)

Read first by a separate reviewing session, on screen and with throwaway tests at #241's merge; nothing here was re-run by this reviewer. No high finding. The first reader rated 1 high by the brief's wording; it is logged as medium because it is the Undo gap already recorded under #227's medium 4, and what it restores is the same person's own earlier check-in. On the main path a correction leaves one live check-in for the week, keeps the old record whole for Undo, and is refused for anyone but the owner.

**1. Medium. A previous owner can still undo their correction after handing the goal over, and the new owner cannot.** A correction is saved as an import of one (`src/domain/changeset.ts:1495-1524`), and `undoImport` asks only who made it (`src/domain/removal.ts:485`), never `mayPostCheckIn`.

**2. Medium. After Undo, History still says the week was corrected.** The check-in's row shows the newest "Why corrected" change for its ID without asking whether that import was undone (`src/screens/GoalScreen.tsx:978-990`): "Week 46 · 37 hours" with "Corrected week 46: 37 hours is now 38 hours" beneath.

**3. Medium. The queue's "Correct it" still adds a second check-in**: `src/screens/CheckInQueue.tsx:103` links without `?correct=1`, so the form says "This adds another check-in" and asks no reason.

**4. Medium. A correction that changes only the words, the call or a stage's expected week says "37 hours is now 37 hours"** (`changeset.ts:1253-1255`, `:1550-1553`; the toast repeats it).

**5. Medium. A correction draft reopened at its second step has lost the reason and cannot be posted from there.** The reason is component state, not part of the draft (`src/screens/CheckInFlow.tsx:248`), and its field is on the first step only; the second step gives an error toast with nothing to type into.

**6. Medium. Data's tables and the engine's MCP route replace a week's check-in with no reason and different History words** ("Posted an update for week 46", no "Why corrected"; `changeset.ts:1297-1300`). Older than this PR, which promises one meaning for "correct".

**Lows.**
- `?correct=1` on a goal with no check-in this week is headed "Correct a check-in" but posts a new one; `?week=` is ignored.
- The correction form opens empty and offers "No new number this week" (`CheckInFlow.tsx:255`).
- A correction and a second check-in share one step marker, which is left behind after saving (`:272`).
- Wording: "Undid corrected a check-in"; Past imports never names the goal, week or numbers; the reason's message does not give the minimum; ten full stops pass and 50,000 characters are accepted.
- A week with two check-ins keeps both after a correction, and the form does not say it corrects the newer.

**Unconfirmed, and Lane's call.** On 11 Jan 2027 the form corrected week 53 with no warning; the design says a cycle that has ended can't be corrected here, and no rule says so.

### #241 U93: a question about a number is where you can see it, on a phone too (track 2, merged 18:40 UTC, 12 Nov)

Read first by the same reviewing session. No high finding. At 390 by 844 the question comes fully above the sticky button, focus stays in the field, and reduced motion is respected.

**1. Medium. On a short screen the page see-saws on every keystroke.** The helper keeps the field 16 px from the top (`src/ui/questionInView.ts:8`, `:30-36`), the browser's own caret scrolling keeps it 72 px down (`src/styles.css:1445`), and the question scrolls again whenever its key changes, which is each digit (`src/ui/GoalFields.tsx:48`). At 390 by 420, typing into Target bounces the page 42 px per key.

**2. Medium (read). With a real on-screen keyboard the question can still be behind it**: the fold is taken from `window.innerHeight`, never `visualViewport` (`questionInView.ts:11-22`). U93 and the unit test use a full-height screen.

**Lows.** The page jumps back after the person scrolls away and types one more digit; typing in Baseline scrolls to Target's question. Set-up's Continue does not use the helper (`src/screens/Onboarding.tsx:253-257`), and no journey covers Change a goal or set-up (read).

### #247 Set-up check-ins are the owner's; delete and undo ask R1 too (polish, merged 19:00 UTC, 12 Nov)

Fixes #227's high and its medium 4, and #225's medium 1. The set-up check-in now asks `mayPostCheckIn` in all three places: the form's save (`src/domain/goalEntry.ts`, `done`), the engine's rows (`src/domain/changeset.ts`, `marks`) and `recordStagesDone` (`src/domain/actions.ts`). Someone creating a goal for another owner publishes it without the check-in, and the stage question says "{owner} marks done stages at the first check-in". Deleting a check-in is the owner's, whoever posted it (`src/domain/removal.ts`, `canDeleteCheckIn`). Undoing an import puts a check-in back only for someone who may check in by the door the import came in by, so an admin may undo a workbook but not an owner's own correction, and a goal handed on since is its new owner's. Read, with its unit tests; not re-run on screen. No finding.

### #252 Check-ins are the owner's, said everywhere (polish, merged 19:28 UTC, 12 Nov)

Takes #227's mediums 2 and 5 and #222's medium 2. The engine asks the rule of the goal's owner as stored, before the file's own changes, so one change cannot take a goal and check in on it (`changeset.ts`, `owned`). `post_check_in`'s description, the check-in rule page and the delegates requirement no longer say an admin may check in. `update_markup` checks the address and the status before it saves anything, and keeping an issue's address is admins only (`src/markup/ops.ts`, `src/mcp/markupTools.ts`). Read. No finding.

### #245, #253 and #263 KT3 to KT5: the handoff kit (track 6, merged 18:53 to 20:12 UTC, 12 Nov)

The search and preferences contracts as data, run by the drill through a shim; what raises each import issue kind as data (`src/domain/issueKinds.ts`), with a test that every kind the engine raises has a case; and each screen's fields, states and buttons read from its markup into the spec. These change the spec's generator, the drill script and the contracts' form, not the app's behaviour. Skimmed, not reviewed in depth: the generated pages were not checked against the screens. No finding.

### #251 and #258 Two journeys' checks; #244, #246, #254 and #260 Backlog and handovers

U4 now confirms publishing by the page's lasting line, not the toast, and U141 sets the three marks it never set. Evals only. The rest are documents. Not reviewed.

### #259 BT: a batch names its own rows with Ref (import, merged 20:25 UTC, 12 Nov)

A Goals row's Ref lets Feeds into ref and a check-in's Goal ref name a goal the same file adds. Read, then probed in the engine with a throwaway test on main at `a7144ae5`. No high finding.

**1. Medium (ran). Two Check-ins rows that name a new goal by Goal ref, for the same week, are both saved.** The duplicate-row pass keys rows by `goalFor(r)`, which does not read Goal ref; the ref is resolved later in the Check-ins loop (`src/domain/changeset.ts`, the `goal ref` block). A workbook with one new goal and two rows `Goal ref: c, Week 46` (values 12 and 13) gave no problem and a commit with two check-ins for that goal and week. The same two rows by Goal key are refused as a duplicate. This is the gap #145's medium 3 found for near-miss names, by a new door. Fix: resolve Goal ref before the duplicate pass, or run the pass on the resolved goal and week.

**2. Low (ran). The wrong column is named when Feeds into ref disagrees with another column.** A row with Feeds into ref `a` and Feeds into key `G-14` is refused with "Feeds into and Feeds into key name different goals", though the row has no Feeds into column.

**Checked and fine (ran).** A ref to a later row; a loop by refs ("That link would make a loop") and a goal that feeds itself; a Ref on an existing goal's row used by a new row's Feeds into ref; a member checking in on someone else's goal through a Ref on its row is refused exactly as by key ("Only Rhea Kapoor (its owner) can check in"). The PR's own six tests pass. Refs are folded, kept nowhere, and `leaveOut` follows them (read).

### #266 and #267

#266 is the planning handover (documents; not reviewed). #267 regenerates `spec/core/help-guide.md`, the stale page that turned main red when #257 met #263; the spec test passes on main again.

### Six smaller pull requests: #239, #242, #249, #261, #234 and #255 (merged 18:49 to 20:06 UTC, 12 Nov)

Read first by a reviewing session working on the merged code at `1900c84e`, with throwaway tests and the demo on screen at 1440 and 390; I re-read the code behind each medium. No high finding. Findings are run unless marked read.

**#239 Quarters before a goal existed are not judged.** No medium.

- Low. A goal created in a quarter's last week reads "before the goal was set up" for a quarter still running (`src/domain/year.ts:82-83`, `born >= q.to`); created a day earlier it reads "Not met: no number reported", as the demo's G-124 does.
- Low. The one-page print still says "None due" where the goal page and History say "Not applicable" (`src/screens/Print.tsx:159-160`).
- Low. "Not applicable" is typed in two screens and is missing from History's key.
- Low. Weeks before the goal existed still count in the run of check-ins, the trend and the forecast; only the quarters skip them, and nothing on screen says so.
- Low (read). No eval or journey for a visible change.

**#242 MCP: every create says the new goal's id and key.**

1. Medium (run in the test harness; not against the database). The answer can give a key that belongs to another goal. After the save the key is read back from the request's own copy (`src/mcp/tools.ts`, `keyOf`), while the database gives the key itself (`supabase/migrations/0021_goal_keys.sql`). With another goal taking G-127 between this request's load and its commit, the answer said G-127 and the store held G-128. The window is one request, but the comment beside it claims this case is covered. Fix: have the commit return the stored keys, or reload the new goals before answering.

- Low. A dry run prints an ID that the save then replaces. Low. A refused `bulk_change` still lists goals in `data.created`, with `key: null`.

**#249 MCP: every list answers in one shape.**

1. Medium. `find_goals` for the demo's 126 goals is now 81,272 characters of text, about four times the old one line per goal, with no limit or paging; the same data is sent again as structured content. The indent alone is 22,000 of it (`src/mcp/listed.ts:6`, `JSON.stringify(data, null, 2)`). Fix: drop the indent and give `find_goals` a limit or a short default field set.

- Low. `find_goals`' description still describes the old text ("Off track (off)"), and no list tool says it answers as JSON. Low. Empty answers lost their hints, and `why` is present only sometimes, so the keys are not the same every time. Low. `get_wrap_up`, `get_my_work`, `whats_new` and `get_help` are not on the shape (outside the PR's stated scope).

**#261 find_goals: a pasted Goals link keeps its tab.** No medium.

- Low. A link the screen opens is refused by the tool when its scope is unknown or has a `#…` tail ("There's no scope …"); the screen falls back to the opening tab. Low. A saved view replaces the whole link, scope included, and the description does not say so. Low. `mine: true` answers without the `why` that `scope: "mine"` gives.

**#234 FS2: search words on Data and Feedback.**

1. Medium. A typed key finds nothing on Check-ins and Asks, though the key is in a shown column. `applyTable` gives the matcher only a column called "Key" (`src/domain/tableFilter.ts:75`), and a search that is one key matches only by key (`src/domain/find.ts`, `wordsMatch`); Check-ins has "Goal key" and Asks "Goal keys". `/data?t=checkIns&q=G-48` shows no row where the old search found 44. Fix: where a table has no Key column, match a typed key as words or against its goal-key column.
2. Medium. A number with a decimal point finds mostly unrelated rows: words break at "." and ",", so `12.5` on Check-ins matches 169 rows (15 before). Fix: keep a typed number whole.
3. Medium. Hiding a column changes what the search finds, and the screen never says so. On Goals, `kapoor` finds 8 rows; with Owner unticked it finds none and suggests "fewer or plainer words". Goals shows 14 of 45 columns by default. Fix: on an empty result say that only the columns shown are searched.

- Low. Words after a quote mark, bracket, @, #, £ or underscore cannot be found (`example.com` finds none of 97 people); find's existing rule, newly applied to free text. Low (read). No eval or journey.

**#255 CK2: the table check-in.** No medium. Owner-only holds through the table's path (an admin and two members are each refused on another's goal), and a double press posts once.

- Low. Two questions still build the unit by hand: "the target of 1 incidents", "(2 to 1 hours)" (`src/domain/checkin.ts:113, 117`). Low. A "Yes" answer to a question is lost on refresh; the draft keeps the number but not the answer (`src/screens/QuickCheckIn.tsx:57`).

### #257 IM6 part 1: large files (track 3, merged 20:12 UTC, 12 Nov)

The engine now finds goals through an index (`GoalSet`) where it scanned. Read first by a reviewing session, which compared the whole result of `planChanges` before and after the merge over 6,551 runs: the demo and its own export, 14 seeded fuzz files, set-up mode, screen posts, a 700-goal new file and a scaled workspace, by four doors, as an admin, a lead and a member, with and without answers. 6,539 are byte-identical; the 12 that differ all sit in a workspace where two goals share a key (low 1). No high finding. Timings there: 5,000 rows 0.49 s (32.7 s before).

**1. Medium (ran). The headline speed test does not test what its title says.** `src/domain/importSpeed.test.ts`, "an unedited workbook of nearly 30,000 rows … and nothing would change": `scaleWorkspace(s0, 5)` gives 630 goals with only 126 distinct keys and titles, so the check returns 21,880 Must fix and a null commit, and `expect(cs.items).toEqual([])` passes only because blocked rows plan nothing. The claim itself holds: with the copies made sound, 27,350 unedited rows took 10.7 s before and 1.45 s after, no issue, all unchanged. Fix: give the copies unique keys and titles, and assert no issue and `unchanged` equal to the row count.

**2. Medium (ran by me on main at `a7144ae5`; older than this PR). A new goal row whose Action is Stop or Delete crashes the check.** `planChanges` throws "Cannot read properties of null (reading 'id')" for a Goals row with no key, a name, an owner and Action "Stop" (`src/domain/changeset.ts`, where the removal is pushed with `existing!`). On screen a one-row file shows "Something went wrong on this page" (first reader). Nothing is saved. Fix: a Must fix, "There's no goal to stop on this row".

**Lows.**
- With two goals sharing a key, the key resolves to a different goal than the old scan once the first holder is set again (`GoalSet.set` and `unindex`); a sound workspace has unique keys, so nobody meets it today.
- The size limits are checked on the Import screen only (`Check.tsx`); MCP and set-up's upload have none, `CHANGES_SAVE_MAX` is read nowhere (part 2), and Import says "Up to 5,000 rows a file" beside a download of 5,665 rows that loads back without a word.
- The growth-ratio test is one wall-clock sample with about twice its headroom (3.1 to 6.8 against a limit of 12).

### #248 IM7: Export is one button (track 3, merged 19:55 UTC, 12 Nov)

Read first by the same reviewing session, on screen at 1440 and 390. No high finding. Contents match the scope, every export read back through Import says "Nothing would change", and there is one primary action.

**1. Medium (ran). A filtered All tab saves under the same name as everything.** The scope in the name is the view's name or `all` (`src/modules/spreadsheets/Export.tsx`). Goals, All tab, search "lead": the sheet says "The 4 shown now: All" and saves `example-platform-engineering-goals-all-2026-11-11.xlsx` holding 4 goals, the name an export of all 126 gets. Fix: never write `all` for a partial view.

**2. Medium (ran). "Everything in 2026" understates the file once a goal is stopped.** The count line reads the live goals only; the workbook adds the archive (`src/domain/export.ts:44`). With G-2 stopped the sheet says 125 goals and 5,302 check-ins, and the file holds 126 and 5,347. The file is right; the new count line is not.

**Lows.** Focus goes to `body` when the sheet closes from Data's Export. An empty view exports an empty workbook, preselected. Import's "Download the workbook" still uses the old name and toast (`Import.tsx:53,109`). The footnote "{n} goals, as of week {w}" is gone, zipped CSVs are three clicks away where What's new says one, and no journey opens Data's "Everything…" or exports a filtered All tab. The file name no longer carries the year (read).

### #271 Batch refs: the two findings from #259 (MCP load, merged 20:55 UTC, 12 Nov)

Fixes both. The duplicate-row pass on Check-ins now resolves Goal ref first, so two rows for one new goal and week are refused ("has the same week on rows 2 and 3") and nothing is saved; and the refusal names the columns the row used ("Feeds into ref and Feeds into key name different goals"). Read, and its two new tests run on main at `113be18f`. No finding.

### #268 and #275 KT5b and KT6: the kit; #262, #272 and #276 handovers

Screenshots of each screen for the spec, and the MCP tools' calls as data (`src/spec/calls.ts`), with two lines in `src/mcp/tools.ts`. They change the spec's generator, not the app's behaviour. Skimmed, not reviewed in depth. The rest are documents. No finding.

### #270 GE10: proposed goals (track 2, merged 20:45 UTC, 12 Nov)

Read first by a reviewing session with domain probes, the MCP tools and the demo on screen at 1440 and 390; I re-read the code behind mediums 1 to 3 on main at `113be18f`. No high finding. The permission rules held at every door tried: only the owner or an admin makes a proposal active (domain, `make_goal_active`, `update_goal state=active`, the file's State column, and a file row that changes the owner and the state together); someone who is neither proposer, owner nor admin can't change or withdraw it; check-ins are refused; and a proposal stays out of the overview, My work, the wrap-up, people and reviews (the tools' answers were byte-identical before and after one).

**1. Medium (ran). A check-in can be written on a proposed goal at the moment it is proposed.** The set-up check-in for stages already done has no test for proposing (`src/domain/goalEntry.ts:611-615`), and the form still asks the stage question when "Not yet" is chosen. An owner proposing their own stages goal with a past stage marked done saved a check-in on a goal with `proposedAt` set. It is hidden while the goal is proposed and reappears on "Make it active"; it is the owner's own, so R1 holds, but rule 14 says a proposed goal has no check-ins. Fix: skip it when proposing and ask the stage question at activation.

**2. Medium (ran). When an owner is marked as left, their proposed goals are not handed over.** `leaving()` reads `x.snapshot.goals` (`src/domain/removal.ts:129`), which no longer holds proposed goals: marking Tunde as left handed two active goals to Rhea and left the proposal owned by someone who has left, with the read-back one short. Fix: read `withProposed(x.snapshot)` there.

**3. Medium (ran). The last step promises "{Owner} sees it on their Home as a proposal for them", and they don't.** `proposalAsks` (`src/domain/proposedActions.ts:86`) is called only by the spec and a test; Home and `get_my_work` were unchanged for the owner. Fix: drop the line until Home's rows are built, or wire it in.

**4. Medium (ran). "Make it active" asks the from-the-past question only in the screen, so MCP skips it** (`src/screens/ProposedGoal.tsx:147-166` against `activate`, `proposedActions.ts:49-58`): `make_goal_active` with a From of week 10 answered with no question, and From 53 and -3 were accepted and saved by `activate`. The range gap in From is older than this PR; the missing question is new. Fix: run the date Checks inside `activate`, and bound From to the year.

**Lows.**
- `ask_for_update` works on a proposed goal and leaves an ask its owner cannot answer.
- An active goal can feed a proposed goal and then reads as feeding nothing.
- Two primary buttons once "Make it active" is open at 1440.
- "Withdraw it" and "Keep it" are 22 px high on touch.
- "Rhea see that it is active."
- The proposed scope rule is written in `GoalsScreen.tsx` and again, differently, in `src/mcp/tools.ts` (read).
- No MCP test names `make_goal_active` or the state (read).
- On a phone the proposed row sits flush against the card's edge, and with the State filter on Goals has no tabs or search.

**Unconfirmed.** A proposer's stale edit landing after the owner activates; `startNextCycle`'s count with proposed goals carried; the rebuild stage and drill.

### #287 U93: the two findings from #241 (track 2, merged 21:40 UTC, 12 Nov)

Fixes both mediums and the lows. A question is brought into view once, when it first shows, not on every digit (`src/ui/GoalFields.tsx`, the effect keyed by slot alone), and the field is kept at least the page's own `scroll-padding-top` from the top, so the helper and the browser no longer pull against each other (`src/ui/questionInView.ts`, `topRoom`). The fold is the visible viewport where the browser gives one, so an on-screen keyboard counts. Set-up's Continue uses the same helper. Read, and its tests run (two new) on main at `66152b78`; not re-run on a short screen. No finding.

### #283 and #284 KT7 and KT8: the kit; #279 three journeys' checks; #286 handover

The platform requirements and the thresholds as data for the spec; they change the generator, not the app. #279 narrows U-journey checks that newer features had outgrown (the wrap-up list's address, Find's Metrics group, the facts block on a phone); none is skipped or disabled. Skimmed, not reviewed in depth. No finding.

### #285 ST1: welcome and join (track 2, merged 21:49 UTC, 12 Nov)

Read first by a reviewing session on the browser store at 1440 and 390; I re-read the code behind mediums 1 and 3 on main at `66152b78`. No high finding. Joining writes only the arrival, as the person, through `app.run`, and changes no record or admin flag; an invitation opens only the workspace it names. Anyone with the link may choose any name, the admin's included, which the spec states (SR2, SR3).

**1. Medium (ran). Opening an invitation without choosing a name traps the device at that workspace's arrival.** The workspace is remembered as soon as the link opens (`src/app/state.tsx`), and every route but `/welcome` and `/join/…` draws the arrival until a name is chosen (`src/App.tsx:68`), with no link out (`src/screens/Start.tsx`). After opening `/join/<Alpha>` and going to Welcome, "Set up a workspace" shows `/workspace/new` with the heading "Welcome to Alpha" and no set-up fields; `/` does the same, and so does Back for someone signed in elsewhere. Fix: draw `/workspace/new` outside the viewer check, and give the arrival a "Not you? Go to Welcome" link.

**2. Medium (ran, dev server only). An old link to a workspace that is not there (`/?workspace=<gone>`) shows Welcome,** not "This invitation doesn't open a workspace" (spec section 1). `/join/<gone>` opened directly is right. The cause is read, not proven: the redirect to Welcome fires before the old link's own redirect is drawn (`src/App.tsx:165`, `:178-191`).

**3. Medium (ran). "Who set it up" is never read from the log.** `creatorOf` looks for a workspace change with action `created` (`src/domain/dayOne.ts:61`); set-up writes `imported` (`src/app/state.tsx:445`), so it is always the first admin in the list. The unit tests and the spec's example use `created`, which the app never writes. The mismatch is older (OB3), but ST1 hangs four things on it: the arrival's opening line, "Set this up · admin", the "Ask … to add you" address, and whether an arrival is logged. With a second admin listed first, all four named the wrong person. Fix: match the entry `createWorkspace` writes, and test with a workspace it made.

**Lows.**
- Two tabs on the arrival log it twice (rule S4 says once).
- Activity reads "Ben Carter ben Carter opened Alpha for the first time" (`dayOne.ts:129`).
- Someone marked as left who returns still sees "You're Ben Carter here" on Welcome back, with no explanation.
- `/join/<id>/anything` with a workspace open is a blank page.
- "Ask … to add you" is 17 px high on touch.
- The draft row says "Stopped at step 2" with no "of N" before a starting point is chosen; dates are UTC days (read); `?workspace=` on any other address still switches workspace.
- P6 does not visit `/welcome`, `/join` or the arrival, though the spec says it does (read).

### #293 GE10 review: the four findings from #270 (track 2, merged 22:54 UTC, 12 Nov)

Fixes all four mediums. A proposal's save writes no set-up check-in and the form no longer asks the stage question while proposing (`src/domain/goalEntry.ts`, `proposing`); `leaving()` reads `withProposed`, so a leaver's proposals are handed over; the "sees it on their Home" line is gone from the read-back; and `activate` itself refuses a From outside week 0 to the week before the plan's To and asks the from-the-past question at every door, with `confirm` on `make_goal_active` (`src/domain/proposedActions.ts`). Read, and its tests run on main at `b753ef19`.

- Low (read). The comments say a stage already past "is asked when it is made active", and `activate` asks nothing about stages: the owner marks it at the first check-in. Say that, or build the question.

### #294 Track 7 review fixes: #242, #249 and #239 (MCP load, merged 23:04 UTC, 12 Nov)

After a save the MCP server reads each new goal's key back from the database (`Deps.goalKeys`, `server/mcp.ts`, `src/adapters/supabase/server.ts`), a dry run gives no ID, and a refused change lists no new goal: #242's medium and both lows. `find_goals` answers 50 at a time with `total`, `offset`, `more` and `why` every time, and `listed()` drops the indent: #249's medium and two lows. One function words a quarter's result for the goal page, History and Print: #239's lows 2 and 3. Read, with its tests run; the key read-back was not run against a database. #239's low 1 (a goal created in a quarter's last week) and low 4 are not taken. No finding.

### #291, #295, #296, #304 and #307 KT9, KT10 and KT6: the kit; #278, #289, #301 and #311 handovers

The spec's limits, logical model, zones, scale kit and reads as data, and `evals/requirements.json` re-tagged. They change the generator, the drill and a seed script, not the app's behaviour. Skimmed, not reviewed in depth. The rest are documents. No finding.

### #281 MT1: defining a metric well (metrics, merged 22:01 UTC, 12 Nov)

Read first by a reviewing session with probes, `save_metric` and the form on screen at 1440 and 390; I re-read the code behind the two mediums on main at `b753ef19`. No high finding. The form and `save_metric` both call `metricChecks` and `unansweredChecks`; a unit or direction change on a metric with live links is now asked at both (#144's medium 2); permissions hold at both.

**1. Medium (ran). The goal forms' "Add this metric" is a third door that asks none of rule 1's Checks.** `MeasuredBy.tsx:109-113` runs `saveMetric` directly; the Checks are called only from the form and the tool, not from the action. Adding "Flaky tests rate" in "percent" from a goal's Measured by saved at once, where `/metrics/new` and `save_metric` raise three Checks for the same input. Fix: put the gate in `saveMetric` (take `answers`, refuse with the open checks), so every door inherits it.

**2. Medium (ran). A name that differs from another only by an accent gets neither a Must fix nor a Check, at both doors.** The near-name Check skips names equal once folded, expecting the Must fix to catch them (`rulesDefine.ts:89`); the Must fix compares lower case only (`rules.ts:145`). "Fláky test rate" was added beside "Flaky test rate" with no question. Fix: make the Must fix compare folded names.

**Lows.**
- `save_metric` accepts answers nobody was asked for: a first call with `answers` or `confirm: true` saves in one step (an answer is tied to a field, not to the question).
- It puts the questions to someone who may not change the metric, and refuses only once they answer.
- `answers {name: 5}` leaks "answers.name?.startsWith is not a function".
- Answering a Check on the form drops focus to the page body.
- An answered Check is recorded neither with the draft nor in the change log (read; the spec does not ask).
- "Lower is better" and "Higher is better" are 40 px high on touch (older).

### #299 MT2: migration 0043 (metrics, merged 23:41 UTC, 12 Nov)

Run on PGlite after 0001 to 0042 by the same reviewing session. Six columns and three named checks, all in `faro`; a catalogue diff shows nothing added or changed anywhere else; two further runs change nothing; it runs as a non-superuser owner with `search_path` faro; 0035's redirects still select, insert and update; main's row shape still saves, and nothing on main reads the new columns yet. Not tested against Supabase. No high or medium.

- Low. `part`, `retired_why` and `marks` are NOT NULL and `okr_upsert` writes whatever a row carries, so MT2's code must write `''` and `[]`, never null, when a metric is brought back. Low. The column grants repeat what the table grants already give.

### #300 A range between two numbers, and #292, migration 0042 (track 2, merged 23:22 and 22:26 UTC, 12 Nov)

Read first by a reviewing session with probes, the doors and the demo on screen at 1440 and 390; I re-read `src/domain/range.ts` and its callers on main at `b753ef19`. No high finding. The status rule is right at, inside and outside each bound, with any margin, negatives and a zero lower bound; one-sided ranges are unchanged; no door saves a between goal the form refuses (New goal, Change, import, `bulk_change`, `create_goal`, `update_goal`); an exported between goal reads back as "Nothing would change", and a workbook without the Limit or Must stay column leaves both bounds alone.

**Migration 0042** (PGlite, after 0001 to 0041, run three times): adds `range_lower` and swaps checks, in `faro` only; safe to run twice; 0035's redirects still select; an old-shape row still saves, so main between the two merges was unharmed; before it, a between row is refused whole by the old check. The database refuses what the form refuses. Not tested against Supabase. No finding.

The status rule is in one place (`rangeOut`, `rangeNear`). The three mediums come from `rangeSide`, "the bound nearer this number", used where both bounds are needed.

**1. Medium (ran). "Will it stay within?" judges only the bound nearer today's number**, so it says Likely while the same page projects a breach of the other. Between 99.50 and 99.95 with check-ins rising from 99.52 to 99.72: the scorecard says "Likely (likely 100.00% by year end)" and the facts say "Projection 100.00% by week 53 | Outside the 99.95% limit" (`src/domain/scorecard.ts:171` against `summaryFacts.ts`). Fix: take the worse of the two bounds.

**2. Medium (ran; the Home flag read). A number moving back to the middle reads "Getting worse".** Trend and "Vs last week" measure against one bound chosen from the latest number (`src/domain/trend.ts:101`, `scorecard.ts`), so 99.90, 99.80, 99.70 inside 99.50 to 99.95 is "worse: closer to the limit", and 1.9% back to 1.7% inside 1.6 to 1.8 is "0.2 pts worse"; `attention.ts:79` raises a trend flag from it. The midpoint is also a floating-point sum, so 1.7 counts as the lower side. Fix: measure room as the smaller of the distances to the two bounds.

**3. Medium (ran). The chart's two limit labels overlap when the band is narrow against the scale** (`src/ui/rangeChart.tsx`: the scale is padded by at least 1.5 units whatever the band's width). Between 1.6% and 1.8% the lines are 8 px apart and "Upper 1.8%" sits on "Lower 1.6%". Fix: pad by a share of the band and put the Lower label under its line.

**Lows.**
- In a spreadsheet, two numbers in Limit win over Must stay without a word: a one-sided goal with Limit "1-2" and Must stay "at most" becomes between, shown as a change but with no question.
- Wording names only the nearer bound where the range is meant: "1.2% at the end, inside the 0.5% limit" (`year.ts:123`), "Inside the 99.50% limit".
- No journey or finish check covers the between form, page or chart (read).
- A between row read without `range_lower` (the public fallback only) becomes "at most" and would be saved so; not live while `faro` is exposed (read).

### #277 IM6 part 2: the import's worker, progress and Stop, and files too large to save split into parts (track 3, merged 22:09 UTC, 12 Nov)

Read first by a reviewing session with probes and large files on screen at 1440 and 390; I re-read where the limit and the split's refs live on main at `b753ef19`. No high finding. The worker's result equals `planChanges` byte for byte for an edited demo workbook with 300 new goals and check-ins, as an admin and as a member, with and without answers; the worker and the fallback both run the one engine. Stop ends the worker, saves nothing and can be started again; a second file chosen during the first check wins cleanly. A split by name or key puts every row out once, cell for cell; the parts saved in order give the whole file's result, each as its own import with its own Undo.

**1. Medium (ran). The 5,000-change limit can be got round from the changes list.** `CHANGES_SAVE_MAX` is read only in `worker.ts:22` and `Check.tsx:221`; `Changes.tsx:48-51` and `toSave` (`importPlan.ts:76`) plan again on the page's thread with a full commit. A file of 5,100 new goals plus one target change: type the reason, open "Show the 5,101 changes", and "Save 5,101 changes" is enabled and saves them. Without a worker the list saves 6,000. Fix: enforce the limit once, in the plan's save path.

**2. Medium (ran). The split ignores Ref, Feeds into ref and Goal ref (#259), so such a file's later parts can never be saved.** `src/domain/splitFile.ts:19` knows a goal by key, ID and name only. A workbook of 2,600 new goals with Ref and 2,600 check-ins, half by Goal ref: part 1 saves, part 2 is 1,300 Must fix ("No row on Goals has the Ref “B2”") with no Save, and the file is left half imported. Fix: treat Ref as a goal's ref in the split and keep rows joined by one in the same part, or rewrite them to the key.

**3. Medium (ran in the engine, parts of 50). Rules that look at the whole file stop applying once it is in parts,** and the parts are offered even while a Must fix remains (`Check.tsx:221`). Eight Stop rows spread across parts: the whole file asks the big-removal question once, the parts never ask and all eight stop. Two rows for one existing goal in different parts: Must fix in the whole file; in parts both save, the later over the earlier. Fix: don't offer parts while the whole file has a Must fix, and carry file-wide questions into each part.

**Lows.**
- Import still says "Up to 5,000 rows a file" (#257's low; Help has it right).
- Size limits are still checked only on the import's screens; `bulk_change` has no cap (read).
- Coming back to the tab restarts the check from nothing, because the run is keyed on the snapshot's identity and the app reloads on focus.
- A worker that fails says "The check stopped.. Split it and import each part." with no fallback.
- "2 files of 5,000 rows" when the second has 1,000; the hint reads as if the split were by hand; focus stays on `body` when Reading appears and when the check ends; the whole progress card is one live region (read).
- The changes list can save while a re-check runs (read; the store refuses a stale goal version).
- U98 checks the two file names and does not load the parts back (read).

### Four track 1 pull requests: #310, #305, #282 and #274 (merged 22:29 UTC, 12 Nov, to 00:18 UTC, 13 Nov)

Read first by a reviewing session on the merged code at `b6bed496`, with probes and the demo on screen at 1440 and 390; the report reached me through its file after a restart, and I re-read the code behind #282's medium 1 and #305's medium 1. No high finding: no ask was shown to someone who shouldn't see it, and no typed work was lost.

**#310 HM2: asks say how long they have waited.**

1. Medium (ran). On a phone the waiting time is cut off, so what HM2 adds can't be read: `.need-meta` is one line with an ellipsis (`src/styles/finish/home-watching.css:226`) and the wait comes last. At 390 all six asks checked were clipped ("Rhea asked · Waiting since 4 …"). N26 reads the text, so it passes. Fix: put the waiting line first, or let the meta wrap.
2. Medium (ran). The day is counted in two clocks: the day asked is the stamp's UTC date (`src/app/reads.ts:141`) and today is the viewer's own day. At UTC+10 an ask made half an hour ago reads "Asked yesterday"; in the UK it is wrong only between midnight and 01:00 in summer.
3. Medium (ran). Home's "late" and MCP's "overdue" are two rules that disagree (`src/domain/home.ts:286-290` against `asks.ts:53`), and `get_my_work` has no waiting time or order though it says "as their Home shows it". A question past its review session is late on Home and not overdue in the tool.
4. Medium (ran at the read; older than this PR). After a goal changes owner, a question or update ask stays with the old owner and the new owner sees nothing (`asks.ts:48`). The rule needs deciding.

- Lows: the day is said twice for asks under a week old ("asked on 10 Nov · Asked yesterday"); the meta is two or three lines at 1440, not one; a late question sits under three decisions because the screen regroups by kind; "A next step you agreed is due" when someone else set it, and two full stops; `ASK_BUTTON` repeats `ASK_ACTION`.

**#305 HM1 review.** Asks waiting are no longer "nothing asked", and the admin's year-end note shows to admins only: both hold. Two of the five do not hold fully:

1. Medium (ran). "No 'not held' after the year" holds for the lead line only. `missedReviews` has no test for an ended cycle (`src/domain/home.ts:56-61`), so the This week cell says "Not held yet · Thu 31 Dec · … · 11 days past" on 11 Jan and "51 days past" on 20 Feb.
2. Medium (ran). The wrapped lead still pushes the first goal needing attention off a phone's first screen on some days: 5 of 70 person-days by U2's own measure (Rhea on 10, 11 and 18 Nov, Tariq on 10 and 11 Nov). U2 runs only on the default day.

- Lows: two reviews on one day are counted ("2 reviews") but only one is named and linked; "Sept" in the cell and "Sep" in the lead.

**#282 NV2, NV3 review.**

1. Medium (ran). A regression: Import has no way out on a phone. `/data/import` now counts as a form (`src/domain/navigation.ts`, `FORM`), so its back link draws nothing, Import has no closing control of its own, and focus mode hides the tab bar. Fix: give Import a `FormClose` and add it to U72.
2. Medium (ran). "One rule for a form" is still two: a module's page with `focus: true` is in focus mode but is not a form to `isForm`, so `/metrics/new` shows a back link, "Close and keep the draft" and Cancel.

- Lows: Close goes to a fixed place, not where the person came from (a goal's check-in closes to Home); after "Save and skip" a reload returns the walk to the skipped goal (older); U70's step budget was raised from 7 to 9.

**#274 GL2 review.** No medium. The Map narrows on Enter, un-narrows when emptied, forgets the last find on a view change, and offers no sort, at 699, 700 and 701.

- Lows: only part of the Goals page moved to 700 px (`list-board.css` still has 600 and 601 px blocks and `GoalMap.tsx:99` uses 640), so at 601 to 649 the count line is cut; the new width check uses 650 and 700, not 699 and 701.

### #318 ST1 review: the three mediums from #285 (track 2, merged 01:13 UTC, 13 Nov)

Fixes all three and four of the lows. `/workspace/new` is drawn outside the viewer check and the arrival has "Not you? Go to Welcome", so an opened invitation no longer holds the device; the redirect to Welcome leaves `/?workspace=` to the old link's own redirect; `creatorOf` reads the `imported` change that set-up writes, with a test from that shape; Activity gives an arrival's name once; "Ask … to add you" is a tap target; `/join/<id>/anything` opens the invitation; P6 visits `/welcome` and `/join`. Read, with `dayOne`'s tests run on main at `1ab6a54e`; not re-run on screen. Two tabs logging the arrival twice and the returning leaver's line are not taken. No finding.

### #313 FS1 review: three mediums from #111 (track 1, merged 00:58 UTC, 13 Nov)

The open picker is fixed to the window on a computer, so a sheet or Data's table no longer cuts it off; Find's search is given the people who have left from the cycle's archive, so "(left)" rows can be found (pickers still leave them out: `find.ts` keeps them only for `left: 'too'`); and set-up keeps the email of the owner picked, so the right one of two people with one name owns the goal. Read, with its test run; the picker's placing was not seen on screen. No finding.

### #315 KT6: the goals contract as data; #320 handover

The goals port's contract cases moved to data for the drill. Skimmed, not reviewed in depth. No finding.
