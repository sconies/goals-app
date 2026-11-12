# Handover: start here

Faro is an internal goals (OKR) app for a 15,000-person company, built to be easy for another AI to understand and rebuild. This page is the starting point for a new session. Read it, then `CLAUDE.md`, `docs/architecture.md` and `docs/backlog.md`.

## Track 1, Thursday 12 November, 21:40 UTC (session past half, handing over; supersedes the 20:15 entry)

Session: session_012kbr92tVe7c6Re4gj42nCe. Nothing merged yet this session. Auto-merge works again (planning, 20:58): once a PR's gate passes and it is current with main, `enable_pr_auto_merge` (MERGE); if it says the PR is already clean, merge by hand.

| Branch | State | PR |
|---|---|---|
| `gl2-gated` | F5 fixed (the Goals page's phone block in `list-board.css` now breaks at 699px, as `goals-phone.css` does). Main merged in twice (the second resolved `GoalFilterSheet.tsx`: main's State fieldset kept, Sort hidden on the Map). First `evals:changed`: every F, N and P check passed; journeys below 9 were main's. Second run (after the second merge, pushed at 21:50): **F6 fails, MAP 2: at 390 emptying the Map's search leaves it narrowed** (`?q=merge+queue` stays). F6 passes on `713b746` (before that merge), so something main brought in breaks it; `GoalFilters.tsx` and `GoalMap.tsx` are unchanged by it, so look at what came with it (`GoalFilterSheet.tsx`'s State fieldset, warm-rendered, reads `useSearchParams`; `GoalsScreen.tsx`'s proposed goals; `state.tsx`). Every other check passed | #274 (draft; CI should now run) |
| `nv2-gated` | Main merged in (QuickCheckIn import conflict). Gate fixes: F3 reads New goal's worded `.form-close`, which keeps 16px from the step bar (`.focus-top.wiz-top .form-close` in `shell-settings.css`); U70 opens a goal of the saved view, not New goal, and its step budget is 9. Pushed | #282 (draft): needs CI, then a test-merge |
| `hm1-review-fixes` | Main merged in locally (clean), typecheck and unit tests pass; **not pushed, not evaluated**. Redo from `origin/hm1-review-fixes` if the container is gone | none |
| `hm2-gated`, `fs1-mediums`, `rv7-gated` | Untouched since the 20:15 entry | none |
| `ck-correct-fixes` | #225's review, built on main of 21:00 and pushed for safety; typecheck and unit tests pass (except the timing tests while evals ran); **`npm run spec` must run again** (CheckInFlow changed after the last run) **and no evals yet** (U142 has a new check; run `evals:changed`). Will conflict with `nv2-gated` in `CheckInFlow.tsx` (FormClose there) | none |

**What `ck-correct-fixes` does** (the build reviewer's #225 findings; medium 1 was fixed by #247):
- Medium 2: History's row skips a correction whose import was undone (`GoalScreen.tsx`, `importUndone`); U142 checks `.ci-corrected` goes after Undo.
- Medium 3: the queue's Correct it links `?correct=1`.
- Medium 4: `correctedSummary` (`changeset.ts`): "Corrected week 46: still 37 hours, with a new note" when the number stays.
- Medium 5: the reason is kept as its own draft (`useDraft` key `…:correct:reason`); reopened at the second step without it, the form goes back to the first step.
- Medium 6: Data's tables and MCP replacing a week's check-in are corrections (`CORRECTS_VIA`): the change's reason is required (`needsReason` on the item), kept as "Why corrected", the summary is the correction's, and the week's time and lateness are kept. Preview asks "Why are you correcting this check-in?"; MCP's refusal says so. Tests: `data.test.ts`, `postCheckIn.test.ts`.
- The design's rule: no correction once the cycle has ended (`cycleState` ended or closed): the engine refuses it and the form says so.
- Lows done: the form starts from what it corrects (`draftFrom`), no "No new number" while correcting, its own step key, cleared on post; "Correct a check-in" heads the form only when the week has one; "latest" when the week has two; Past imports names the goal, week and numbers; Undo says "Undid a correction"; a reason is 10 to 500 characters with letters (`correctReasonOk`, `correctReasonAsk` in `checkin.ts`, said once). Not done: `?week=`.
- What's new `correct-means-one-thing`; guide (check-in) and the rule's words (`rules.ts`, one way to save a check-in) updated.

**Next, in order:** finish the six gated merges (gate each, test-merge with main, merge); then `ck-correct-fixes`; then **#234's mediums** (planning, 20:53: a goal key search on Check-ins and Asks finds nothing because `applyTable` passes only a "Key" column; a decimal like 12.5 matches unrelated rows because words break at "." and ","; hiding a column changes what search finds and the screen never says only shown columns are searched; add an eval or journey for Data search); then the habit moment, N12's Find timing, #110's lows, HM1's lows.

**The lows batch** (added by planning): #261 (a link with an unknown scope or a `#…` tail is refused where the screen falls back, `src/mcp/tools.ts` ~270; a saved view replaces the whole link, scope included, unsaid in its description; `mine: true` answers without the `why` that `scope: "mine"` gives); #234 (words after a quote, bracket, @, # or £ can't be found); #255 (two number questions build the unit by hand, "1 incidents", `checkin.ts` ~113 and ~117; a "Yes" answer in the table is lost on refresh).

**The habit moment** is as the 20:15 entry reads it (below).

**Habits:** the merge helpers live in the scratchpad and go with the container: `wn.cjs` rebuilds What's new as main's file with the branch's own entries on top; the merge then takes main's `api/mcp.js`, `spec/` and `llms.txt`, runs `npm run build:mcp` (check `grep -c home/user api/mcp.js` is 0) and `npm run spec`, and commits "Merge main [no news]". In a worktree test for a merge with `git rev-parse -q --verify MERGE_HEAD`, not `.git/MERGE_HEAD`. Only one eval run at a time (ports); unit tests run beside an eval run make F3 and F6 time out, so re-run those alone before reading them as failures. A PR that conflicts with main gets no CI run at all: check `mergeable_state` when CI stays quiet.

## Track 1, Thursday 12 November, 20:15 UTC (session past half, handing over; supersedes the 18:10 entry)

Session: session_012kbr8xcmyaqqmD5V1TbMeP. **Merged:** #234 (FS2's review: search words on Data and Feedback). #255 (CK2's review: the table keeps its answers). #261 (find_goals keeps a pasted link's tab).

**Pushed, each built on main of 19:30 to 20:10 UTC, with typecheck and its unit tests passing; in this order:**

| Branch | What | Local evals | PR |
|---|---|---|---|
| `gl2-gated` | GL2's map fixes (the Map fresh on return, no sort offered there, phone layout under 700px) | full suite 176/177: **F5 fails on GL2's own new check**: at 650 px Goals shows neither a computer's menus nor the phone's View button ("under 700px is the phone's bar" isn't fully built; the scores below 9 are main's) | none yet |
| `nv2-gated` | NV2: forms close in words, Back finds your list | not run | none yet |
| `hm1-review-fixes` | the build reviewer's HM1 mediums (below) | not run | none yet |
| `hm2-gated` | HM2, stacked on `hm1-review-fixes` | not run | none yet |
| `fs1-mediums` | FS1's mediums 1, 2 and 4 (below) | not run | none yet |
| `rv7-gated` | RV7 (below) | not run | none yet |

For each in turn: merge `origin/main` (script below), `npm run evals:changed` if not yet run, a draft PR, green CI, merge. Then the next.

**Stacked:** `hm2-gated` is built on `hm1-review-fixes` (both change `home.ts`, `reads.ts`, `Home.tsx`); merge hm1's first, then merge main into hm2.

**What the new branches do:**
- `hm1-review-fixes` (the build reviewer's five HM1 mediums): the quiet line says "N asks wait for your response." while asks wait (`quietLine`); the lead's line and quiet line wrap on a phone (the old one-line rule in `home-watching.css` removed); no session after the year ends (`homeFacts`: `ended ? []`); `Dashboard.upcoming` (`nextReviews`) so two reviews on one day both reach Home (the cell takes the one the lead doesn't, "· 2 reviews" when two are left); the admin's year-end card (`AdminCard`) is back in Home's side column until HM7. Tests: src/app/reads.test.ts, `home.test.ts`. HM1's lows are not done (worst-first in `useMineAsk`, unused `useGoalCounts`, restated rules, "Example: Platform Engineering").
- `hm2-gated`: HM2's intended files from `hm2-asks-wait` (`waiting`, `waitingOrder`, `askLead` at rank 60, `homeAsks` in `reads.ts`, `HomeFacts.asks` now `Waiting[]`), merged with the HM1 fixes and `AdminCard`.
- `fs1-mediums`: the open picker on a computer is `position: fixed` where `Pick.tsx` measures its field (`.pick-panel.placed`, flips above when there's no room; phones keep the full screen); `personRows` adds the cycle archive's people, so Find finds "(left)" again (src/app/searchLeft.test.ts); set-up keeps the picked owner's email (`GoalRow.ownerEmail`), so of two people of one name the one picked gets the goal. U91 now checks Data's picker option is reachable where it's drawn. FS1 medium 3 (`suggest` takes no context for "Feeds into") and medium 5 (tests for `searchOver`, `searchNames`, Data's "No team") are not done.
- `rv7-gated`: RV7's intended files from `rv7-who-may-speak`; requirement `REVIEW-SPEAK` (added to the reviews guide article's `reqs`), check N25 (evals/notes/13-review-speak.cjs).

**Next, after those:** the habit moment, then N12's Find timing and #110's lows (build review log, docs/reviews/2026-11-11-build-reviews.md on `build-reviews`, "#110": findings 2 to 5; finding 1, the status shape in a picker row, is fixed on main).

**The habit moment, as read so far** (evaluation `docs/reviews/2026-11-12-muse-product-evaluation.md` item 12 and decision 4; backlog L (1) and (3); `docs/design/workspace-settings/spec.md` 2.5 for CF4):
- A restrained moment when a goal reaches its target or comes back on track, on the check-in's receipt and in History, with the existing share image; no confetti, no emoji, status as shape plus word.
- CF4's forgiven week in `onTimeStreak` (`progress.ts`): a late week is forgiven when the four weeks before it with something due were on time. `cycle.streak` ('on' | 'grace' | 'off') comes with CF2's migration; if that isn't on main, build the rule with grace as the behaviour and say so in the PR.
- The measure Lane chose: % of goals checked in before the review **without a nudge** (not after an ask for an update, Faro's only nudge). Put it in the spec (a rule with worked examples) and where a leader reads it (the review page or HM7's cell).

**Habits:**
- `/tmp/.../mm.sh` merged main into a branch: on conflicts it took main's `api/mcp.js` and generated `spec/`, rebuilt What's new as main's file with the branch's own entries (ids not on main) on top, then `npm run build:mcp`, `npm run spec`, commit. It is gone with this container; the steps are as listed.
- Main moves every few minutes. Before merging, test the merge locally (`git merge origin/main` on the PR head, `npm run build:mcp`, `git diff --stat api/mcp.js`): if there's no conflict and no diff, merging is safe without another CI run.
- Auto-merge is still off for the repository (`enable_pr_auto_merge` says so): merge by hand on green.
- Seven journeys score below 9 on main when run alone (U12 8.8, U59 8.9, U61 7.8, U65 8.9, U117 8.9, U141 7, U31 9): a full local run reports them; they aren't any branch's.
- vitest's fence and scale tests fail while an eval run is going; they pass alone.
## Track 3 (import), 12 Nov, 19:40 UTC: handover after IM7 and IM6 part 1

The track 3 build session that took over from #236's handover is past half its context. A fresh track 3 session picks up here.

**Done in that session**
- **#248, IM7 (export):** Export is one sheet, one primary (**Export .xlsx**), the other formats behind **Other formats**, the file's name in the foot note, toast "Exported {name}". Data's Spreadsheets menu became **Export** (table as shown .xlsx / .csv, Everything…) and an **Import** link. File scopes `all` / view name / `as-shown`; template `faro-template.xlsx`. R-E1 is rule 8 of R1 (`src/spec/internal.ts`). U19, U20, U46, U48, U90, `notes/5-data-ids`, `finish/7-data-workspace`, `finish/8-sheets` and the brief and import walkthroughs (`src/app/tours.ts`) moved to the new words. Merged once its CI was green (see the PR if not).
- **IM6 part 1** (this PR): **rule 10**. `planChanges` no longer scans lists per row. A `GoalSet` (end of `src/domain/changeset.ts`) indexes the working goals by id, key and folded title, in their first-set order, and memoises a name one letter out until a goal changes. Saved goals, people, teams and check-ins are maps; issues are indexed by sheet and row; left-out rows are a set; the "Keep decimal places" answer no longer rescans every check-in row per goal (the reviewer's 7.3 s answer on 3,000 rows); the parent-first ordering and the asks' latest-week test are linear. `groupIssues` pushes instead of copying. 2,000 new rows: 8 s to 0.2 s; an unedited 33,000-row workbook: 9 s to 1.3 s. `src/domain/importSpeed.test.ts` holds N18's limits (1,000 / 5,000 / ~30,000 rows within 3 / 8 / 20 s), a growth ratio and "14 rows with one typo are one group". The limits live in `src/domain/importLimits.ts` (`ROWS_COMFORT`, `ROWS_READ_MAX`, `BYTES_READ_MAX`, `CHANGES_SAVE_MAX`, `PAGE`, `limitLine`, `tooLarge`); Check, Import and Changes read them (fixes the IM5 low "the limits live in Check.tsx"; the header-row sentence is still there).

**Next, in this order**
0. **The build reviewer's findings on #257 and #248** (20:57 UTC; no high; full text in the build reviews log on branch build-reviews, PR #134). Fix the mediums first, as one PR:
   - **#257:** `importSpeed.test.ts`'s ~30,000-row test doesn't test what it says. `scaleWorkspace(s0, 5)` repeats keys and titles, so the check returns 21,880 Must fix and an empty items list. Give the copies unique keys and titles, and assert no issue and that unchanged equals the row count.
   - **On main, older than #257:** a new Goals row (no key) whose Action is Stop or Delete makes `planChanges` throw ("Cannot read properties of null (reading 'id')": the removal is pushed with no existing goal). On screen it shows "Something went wrong on this page". Make it a Must fix on the row.
   - **#248:** a filtered All tab saves as `…-goals-all-<date>.xlsx`, the same name as everything. Never write `all` for a partial view.
   - **#248:** "Everything in {cycle}" counts live goals only, but the workbook adds stopped goals (the archive), so the counts and the file differ. Count what the file holds.
   - Lows on #257:
     - with two goals sharing a key, `GoalSet` can resolve the key to a different goal than the old scan did;
     - the size limits are checked only in `Check.tsx`: MCP and set-up are uncapped, and nothing reads `CHANGES_SAVE_MAX` yet;
     - Import says "Up to 5,000 rows" beside a workbook download of 5,665 rows;
     - the growth-ratio test rests on one wall-clock sample.
   - Lows on #248:
     - focus goes to the page body when the sheet opened from Data's Export closes;
     - an empty view exports an empty workbook;
     - Import's "Download the workbook" keeps the old name and toast (`Import.tsx`);
     - the "{n} goals, as of week {w}" footnote is gone;
     - the zipped CSVs are three clicks away;
     - no journey covers Data's "Everything…" or a filtered All tab;
     - the file name no longer carries the year.
1. **IM6 part 2** (spec 2.2, 2.8, section 7):
   - **The worker**, a new `worker.ts` in the spreadsheets module (spec section 7), running `planChanges`. Its input must be cloneable: `records` holds functions, but the engine only uses them for `goalMeasureOf` on existing goals, so pass a plain `{ goalId: GoalMeasure }` table made on the main thread and rebuild a one-module `records` in the worker. `newId` there: the same shape as `src/data/store.ts` `newId` (don't import the store). `app.applyChanges(cs)` saves `cs.commit` as is, so a worker's change set saves normally.
   - **Progress and Stop**: `planChangesInChunks(input, onProgress)` per rule 10. The row loops are top-level `for` statements in `planChanges`, so it can become a generator that yields every 500 rows; `planChanges` runs it to the end. Then 2.2's "Reading {name}" panel (after 400 ms) with "So far: …" and **Stop** ("Stopped. Nothing was saved."). Move the plan from `useImportPlan`'s `useMemo` into `importStore` (cs, the inputs it was made for, progress), so answers re-check in the worker too.
   - **Over the limit**: a file changing more than `CHANGES_SAVE_MAX` rows gets 2.8's block instead of Save, and **Download as {k} files of 5,000 rows** (a goal's plan and check-ins stay with it, parents before children; parts named `{original}-part-{i}-of-{k}.csv`).
   - **Paging**: the changes list already pages at 50; check a group's "Show the {n} rows" does too, and N18's "fewer than 3,000 elements" on the preview.
   - `IMPORT-LARGE` in `evals/requirements.json`; R-L1 to R-L6 as an internal requirement page (`src/spec/internal.ts`, beside R4); N18 (b) and U92's first half as evals; What's new `import-large`.
2. **IM8**: set-up's upload uses the new preview (spec 2.3 create mode, "Add {person}", the stage question defaulting to "Count them from this week"; U92's second half; `SETUP-UPLOAD`).
3. **Still open from the reviews** (unchanged from #236's handover): IM3's two engine findings (#145: a near-miss goal name on Check-ins slipping past `twice()`; two rows answered "They're the same" dropping the earlier one silently), per-sheet counts that count a Must-fix row as Added, the Added/Changed/Stopped grouping written twice (`Check.tsx`, `Changes.tsx`); the IM4 lows (undoing two imports newest first leaves the older one stuck; "Saved n changes" and "n rows go back" count different things; Check flashes "Nothing has been saved" after Save; an empty search on Past imports is blank; Activity's Undo is 32 px at 390; "undid loaded a spreadsheet"; Imported shows the Undo hint to someone who can't undo); the IM5 lows (`gridOf` drops blank lines so row numbers are off; `separatorOf` reads line 1 only; the file input isn't cleared after an error; a `<details>` inside `<p role="alert">`; "All 1 past imports"; the drop area unnamed and a 1×1 tab stop; two links 20 and 17 px at 390; `help.ts` line 16; the header-row sentence lives in `Check.tsx`).

**Gotchas**
- Main moves every few minutes, and each merge of it conflicts in `src/help/whatsNew.ts` (keep both entries) and `api/mcp.js` (take main's, then `npm run build:mcp`). A conflicted PR gets no CI at all: check `mergeable_state` first. Merging by hand failed twice on #248 for this; resolve in a second worktree (`git worktree add`, then `cp -al` the `node_modules`) while an eval run holds the first.
- Auto-merge is **not** on for the repo yet: `enable_pr_auto_merge` says so. Merge by hand once green.
- `evals:changed` runs the whole suite for `changeset.ts`, `sheets.ts`, `journeys.cjs` and the like (about 15 minutes); read the scorecard, not the exit code.
- vitest swallows `console.log` here; to time something in a throwaway test, write to a file. `node:inspector/promises`' `Session` gives a CPU profile from inside a test (`--cpu-prof` doesn't reach the forked workers).
## Track 7 (register load: bugs, then backlog rows), Thursday 12 November, 20:00 UTC (session at half, handing over)

- **Done and merged:** #239 (quarters that ended before a goal was set up are never judged; `bornWeek` in `src/domain/year.ts`), #242 (MCP writes return `data.created`: each new goal's id and key), #249 (every MCP list tool answers through `listed()` in `src/mcp/listed.ts`: the same JSON as structured content and as text; a test holds every `list_` tool to it), #244 (backlog rows GB, BL, MS, BT, MI, GR, MQ, TG, MC, WM after SM; GD was renamed GB and MT renamed MQ, as both IDs were taken).
- **In flight:** #259, **BT** (a Goals row's `Ref`, `Feeds into ref`, a check-in's `Goal ref`). Gate passed locally (drill 100%); merge it once CI is green and it is up to date with main.
- **Lane's order (planning, 12 Nov 19:35):** BT, then **MT1, MT2, MT3** (round 2's designs, `docs/design/round-2/`), then **MS, MI, GR, MQ**. **BL** and **GB** once track 2 has merged GE10's code (ask track 2, session_012kbr8zF82vbVLvoqfYaQad); **TG** after them. **WM**: write the token rules first (who may hold a workspace-creating token, what it reaches, its lifetime, how it's revoked; made only in the app, never by another token) and send them to planning for Lane before building. One PR each.
- **Notes for the next session:**
  - MI is round 2's MT6 ("The Metrics sheet in and out"); MC needs FT1 (track 4) and FT4. FT1/FT4 are cycle-wide rhythms only, so MC is per goal on top of them.
  - main moves every few minutes and every PR's What's new conflicts: merge main, keep both entries, rebuild `api/mcp.js` from a real node_modules (`cp -al`, never `ln -s`: a symlinked build differs), then merge as soon as CI is green.
  - "Allow auto-merge" is still off in the repo (GitHub refuses it), so merge by hand.
  - `npm run evals:changed` must be read by its own exit code; a trailing `echo` hides a failure.

## Planning state, Thursday 12 November, 18:30 UTC (planning moved to session_012kbr939zneZWtAo7UQEHRP)

- **How we work now:** no freeze. Lane (11 Nov): "Do all the recommended work." Each track merges its own green PRs after the gate and reports to the planning session **once, when done or blocked**, never with progress updates. A new planning session tells every track its new session ID.
- **Open build tracks (Opus):**
  - **Track 1:** Home, reviews and check-in, at session_012kbr8xQDAVs6poTHiGk7z9. Doing, in order: merge HM1 (#169) and #171; wire "Correct this check-in" to the engine's `correct` mode; gate the pushed branches (gl2-map-fixes, nv2-fixes, find-goals-scope, ck2-fixes, fs2-fixes) and FS1's mediums; RV7; HM2; the habit moment (Lane: build after HM2, measured as "% checked in before the review, unnudged"); N12's Find timing.
  - **Track 2:** goal entry and set-up, at session_012kbr8zF82vbVLvoqfYaQad. Doing: #220 (GE9 mediums plus the U4 fix) and #228 (GE3 mediums), then U93's phone fold, GE10 code (its migration merged as #221), ST1, then two-sided range goals (Lane: build now).
  - **Track 3:** import, at session_012kbr921FQTvNkQhGBnLtxb. Doing: the IM4 and IM5 review mediums, then IM7, IM6, IM8.
  - **Track 4:** architecture, at session_012kbr8xdoEbLiMQaBAxLeuJ. Doing: #193's review mediums first (a failed engine-chunk load makes Post check-in fail silently; Home isn't sorted worst first as What's new says), then AX5 part 2, FT2, FT1, SW1, SW2, AX2, AX6.
  - **Track 5 (polish):** handed over; no session is running. The handover is in PR "Handover: track 5" (branch track5-handover). Start "track 5b" with the prompt in it: the HIGH (a set-up check-in for someone else's stages bypasses owner-only), then #227's mediums 2 and 5, `update_markup`'s half-save, the small lows, and medium 3 or the backlog.
  - **Track 6:** the handoff kit (KT), at session_012kbr8yJLEadWBYmVvsaUEK. Doing: gap 1(a), then the rest in the review's order (`docs/reviews/2026-11-12-handoff-kit-review.md`). R5 is spec only (Lane).
  - **Track 7:** at session_012kbr91SYQ4Rmp7onTQagpq. Doing: three bugs from Lane's register load (earlier quarters judged "Not met" for goals created in week 46; MCP create doesn't return the key; goal search returns JSON or text inconsistently), then backlog rows GD, BL, MS, BT, MI, GR, MT, TG, MC, WM after SM.
  - **Reviewer:** Fable 5.2 at session_012kbr8y4Bh3MudNC1bdo3RN reviews every merge from #121 onwards (log on branch build-reviews, #134) and sends high findings to the owning track.
- **Decided on 12 Nov:**
  - Feedback stays one inbox; only admins triage (#222).
  - Start over: admins only in their own workspaces (#222).
  - The workspace boundary release (#222).
  - Check-ins are owner only (#227); the two admin exceptions, import and Data's tables, are kept and labelled (#232).
  - R5 is spec only.
  - The habit moment is built.
  - Two-sided ranges are built.
  - Backlog items NR (readings fill in the check-in) and SM (small workspaces).
  - The kit's ten gaps (KT) are built.
  - Muse's chart and "Needs attention" findings are by design.
- **Decided by Lane, 12 Nov evening (planning session session_012kbr939zneZWtAo7UQEHRP):**
  - Keep #192's 3 KB `MARGIN_KB` on the bundle budgets (its "Lane, 12 Nov" citation now stands).
  - NR's four questions, all as recommended: pre-fill only; readings per team slice where the source has them, otherwise no pre-fill; a reading older than 7 days is ignored; an override is recorded only. NR is not yet picked to build.
  - Track 7 builds all its rows in order: GD, BL, MS, BT, MI, GR, MT, TG, MC, WM (after its bugs and SM).
  - The Candy shop register is made up: it stays.
- **Decided by Lane, 12 Nov, 19:35–20:45:**
  - Track 7 builds round 2's MT1–MT3 (after BT), then MS, MI, GR, MQ.
  - WM is built in Faro with track 7b's set-up token rules, all as recommended: anyone makes one for themselves in Settings; it lives 24 hours or 3 workspaces; the admin token it issues is revoked with it by default; set-up through it stops when the new workspace's first week starts. R1 rule 5b.
  - Auto-merge: Lane switched it on at 20:45, but GitHub still refused it on #272 at 20:47 ("not enabled for this repository"). Settings → General → Pull Requests → Allow auto-merge on sconies/goals-app; a branch rule requiring the smoke check, up to date, would make it wait for CI.
- **Waiting for Lane:**
  1. Optional: build api/mcp.js in CI instead of committing it. Recommended: leave it as it is.
  2. A Fable 5.2 design session: Lane asked for one; what it should design is still to come.
- **Running at 20:45 UTC:** track 1 session_012kbr92tVe7c6Re4gj42nCe; track 2 session_012kbr8zF82vbVLvoqfYaQad (also owns U4 failing on main); track 3 session_012kbr937S18WZrjrr2frmGt; track 4 session_012kbr8xdoEbLiMQaBAxLeuJ; track 5b session_012kbr911Du8PPXJLDueSVE5 (done; AD in the backlog waits for Lane); track 6 session_012kbr91sUqGSh61W6Ua3T2T (gap 4); track 7b session_012kbr92c7taPQJmK4jDJU9E; journey triage (Sonnet) session_012kbr8zmHFGvAAd7i5cGmWi (U12, U59, U61, U65, U117, U31); reviewer session_012kbr8y4Bh3MudNC1bdo3RN.
- **Learned 12 Nov evening:** two merges of generated-spec inputs a minute apart left main red (#266 fixed it). When a merge touches the spec's inputs, run `npm run spec` on main afterwards.
- **Started 12 Nov, 18:33:** track 5b at session_012kbr911Du8PPXJLDueSVE5 (the handover below); track 3 fresh at session_012kbr8zZqujTFrEwfJVWKrS (IM7, IM6, IM8 from #236's handover comment). The old track 3 session (session_012kbr921FQTvNkQhGBnLtxb) has finished.
- **Habits learned:**
  - Rebuild api/mcp.js after every merge of main, from a real node_modules (`cp -al`, never `ln -s`).
  - Run only one eval run per machine; U20, U58 and P9 time out under load.
  - Never raise the bundle budgets.
  - Outside AI reviews are claims to reproduce, not orders.

## Where things are

| What | Where |
|---|---|
| Live app | https://goals-app-puce-five.vercel.app (demo at `/demo`) |
| Preview of the `journeys` branch | https://goals-app-git-journeys-lanehirschfield-5825s-projects.vercel.app |
| Design plan (Claude Docs) | https://claude.ai/artifact/6XPyzprnhTVsBSziB4GVwP |
| Repo | github.com/sconies/goals-app, working branch `journeys` |
| Database | Supabase project `wlbetxkmrvwqfxvxntzl` (shared with another app's tables; leave those alone). Every migration in `supabase/migrations` is applied: CI applies new ones on merge |
| Sign-in links | No longer used by Faro: the inbox is open with no sign-in since backlog O (8 Nov). Supabase, Authentication, URL Configuration. Site URL belongs to the Kerry Lane app (leave it). Redirect URLs list Faro's: `https://goals-app-puce-five.vercel.app/**` and `https://goals-app-*-lanehirschfield-5825s-projects.vercel.app/**` (added 7 Nov) |
| Rules for working here | `CLAUDE.md` |
| What to build next, in order | `docs/backlog.md` |
| What Faro is, generated from the code | `llms.txt` and `spec/` (`npm run spec`; items 8a and 8b) |
| The rebuild kit and its drill | `spec/rebuild/README.md`; the harness is `npm run drill -- <folder>` (item 8k) |
| Handing Faro to the internal team: the checklist | `docs/handoff.md` (hand-written; keep it in step with 8g, 0c, 8c, 11) |

## Track 1, Thursday 12 November, 18:10 UTC (session full, handing over; supersedes the evening entry below)

- **Merged today:** HM1 (#169), the correction (#225: Correct this check-in posts mode `correct`, with a reason, History's line and Undo; journey U142), #171 (U9, U111, U23).
- **Open:** #234 (fs2-gated, gate passed; merge on green CI after merging main).
- **Rebuilt from main, typecheck and unit tests passed, evals not yet run, no PR yet:** `ck2-gated`, `find-goals-scope-gated`, `gl2-gated`, `nv2-gated`. For each one in turn, in a worktree: merge `origin/main`; put the branch's What's new entry back on top of main's, dated today; `npm run build:mcp` (in a worktree, then `sed -i 's#^// \.\./goals-app/node_modules/#// node_modules/#' api/mcp.js`); then typecheck, `npm test`, `npm run spec` and `npm run evals:changed`; then a draft PR, green CI and merge. The script `/tmp/claude-0/s/wtmerge.sh` did this and is gone with this container, but its steps are as listed.
- **U4 fails on main** (8.9, "publishing is not confirmed", since "Publishing a goal says one thing"). It's not track 1's. It needs an owner; every full local run reports it.
- **The build reviewer's findings on HM1 (#169)** (none high; full text on `build-reviews`, #134, section "#169"), to fix before HM2. These are mediums:
  1. "Nothing is asked of you today." sits above "Needs your response" while asks wait: `quietLine` (home.ts) ignores `f.asks`.
  2. At 390 px the lead's line and the quiet line's second line are cut with an ellipsis (`home-watching.css`, written for the old titles list).
  3. After the year ends, people in a review get a "Not held yet" lead that never goes (`reads.ts` sessions have no `hasEnded` test).
  4. An admin's Home no longer says the year is ending or offers Start 2027 (AdminCard gone, HM7 not built).
  5. With two reviews on one day, the second is nowhere on Home (`ThisWeek` takes the single `d.next`).

  Lows: your goals with nothing flagged come in stored order (ask with `sort: 'worst'` in `useMineAsk`); unused `useGoalCounts` calls; sessionToDo, the on-time test and day names restated; the check-in lead and the cell both say the review is today; no `homeFacts` test at the year's end or with two sessions; "Example: Platform Engineering" under the greeting.
- **Next, in the brief's order:** the four branches above; FS1's mediums; RV7 and HM2 (`rv7-who-may-speak`, `hm2-asks-wait` are stale: re-apply only their intended files, as the evening entry says); the habit moment; N12's Find timing and #110's lows.

## Track 5 (polish), Thursday 12 November, 18:15 UTC (session past half full, handing over)

Brief: the planning session's polish track (Muse's review of 12 Nov, items 1 to 6), then Lane's decisions of the same day. **Merged:** #207 (no "Check in for" in an admin's goal menu; backlog SM), #209 (the map's wait said only after 300 ms; F6), #213 (FLIP keyed by row kind, so a layout switch draws in place; `evals/layoutSwitch.eval.ts`, F5), #222 (the workspace boundary: admins-only triage `mayTriage`, `mayStartOver`, `/inbox`, the switcher says Switch, the can't-open page lists other workspaces, `landingLine`, `WORKSPACE_MEANS`), #227 (owner-only check-ins: `mayPostCheckIn` in `goalRights.ts`, asked by `judge` in `planChanges`), #232 (R1 names the two admin exceptions, `ADMIN_CHECK_IN_DOORS`, and a test that each records who). Not reproduced or by design, reported: Map Delete (off since 9 Nov), the status mark (not clickable-looking), Needs attention 2 vs 0 (the count follows the tab and leaves out what is being handled), the missing spaces (the reviewer's tool).

**Next: the build review of #227 and #222** (the build reviews file on branch build-reviews, draft #134, sections "#227" and "#222"; it is not on main yet), as the planning session ordered it on 12 Nov:

1. **The HIGH, first.** A set-up check-in (stages "Yes, done in week N" when a goal is created) is written with the creator as author and never asks `mayPostCheckIn`, so anyone creating a goal for someone else puts a check-in on it. Three places: `src/domain/goalEntry.ts` around 593-596 (the form's save), `src/domain/changeset.ts` around 1116-1119 (the create path: sheet, bulk, MCP `create_goal` and `bulk_change`), and `recordStagesDone` in `src/domain/actions.ts` (~599, owner or admin today). Ask `mayPostCheckIn(actor, goal, via)` in all three (the form's via is `form`; `recordStagesDone` is the form's too). When the creator isn't the owner, publish without the set-up check-in and say so at the stage question: "Mateo marks done stages at the first check-in" (Lane's owner-only decision covers the screen change). Tests: stages done by a non-owner (form, sheet, MCP), and **delete and undo** against the rule (`deleteCheckIn`/`canDeleteCheckIn` and `undoImport`/`canUndoImport` in `src/domain/removal.ts`, ~311-325 and ~485: today an admin deletes an owner's check-in, the owner can't delete one an admin loaded). Reproduce first as Oskar: New goal, dated stages, owner Mateo, one stage done in week 40, Publish; Mateo's goal reads Done with `authorId: oskar`.
2. **Small ones:**
   - #227 medium 2: in `judge`, decide `mayPostCheckIn` against the goal's owner **before** the file's own changes (today `g` is the goal as the file changed it, so one `bulk_change` can change the owner and check in for them).
   - #227 medium 5, words: `post_check_in`'s description (`src/mcp/tools.ts` ~296), `src/spec/rules.ts` ~370 and `src/spec/internal.ts` ~372 still say an admin may check in. Then `npm run spec`.
   - `update_markup` (`src/mcp/markupTools.ts` ~159-160): run the status change (it throws for a member) **before** `setIssueUrl`, so a refused call saves nothing; `ops.ts` ~110 has no role check of its own.
   - Lows: `src/screens/Respond.tsx` ~75 offers "Check in for week N" to anyone with an update ask (show it to the owner only); an admin-loaded check-in is headed "What the owner said" (say the author's name when it isn't the owner).
3. **#227 medium 3:** the exceptions are keyed on `via` only, so one pasted row on Import counts as a workbook. Put the route on what the action is (a file loaded, a past week corrected), not only `via`. If it is more than small, add it to the backlog instead.
4. **Leave:** the icon-rail switcher (in SM's row now) and trusting the browser's `viewer.admin` (Faro's open door; R1 asks the rebuild for server checks).

**Habits learned today:**
- `api/mcp.js` bundles What's new, so **every merge of main means `npm run build:mcp` again**, and CI builds the PR merged with the latest main. Merge one PR at a time; after each, merge main into the next and rebuild.
- **Build `api/mcp.js` from a real `node_modules`.** A symlinked one (`ln -s`) writes `../../../home/user/...` paths into the bundle and CI fails it. In a worktree use `cp -al <main checkout>/node_modules node_modules` (hard links: instant, real paths). Check with `grep -c home/user api/mcp.js` (must be 0).
- Merging main: take main's What's new and put the branch's entry back on top (an entry needs its closing `},` before main's next one).
- U4 (8.9, "publishing is not confirmed") fails on main: not this track's, reported for track 2. U78 and P9 time out under four-shard load and pass alone (`ONLY=U78,PLATFORM CHECKS=P9`).
- Journey ids: U141 is this track's; other tracks took U137 and U142.

## Track 1 (Home, reviews, the check-in), Thursday 12 November, evening (session past half, handing over)

Brief: the planning session's of 12 Nov (items 1 to 6 below). Done in this session:

- **HM1 (#169)**: main merged in three times (AX5's query port: Home's own goals and its counts now come through `useGoalList`/`useDashboard`; last year's wrap-up while it stays open, `wrapUpScope`, now reaches `homeFacts` through `opts.wrap`, and the wrap-up lead names that year, `wrap.name`). `home.csv` sits beside `goals.csv`, `import.csv` and `readback.csv` in the conformance data; the drill scores 100%. Full local suite: 177/177 requirements; the only red was **U4 (8.9, "publishing is not confirmed"), which fails the same way on main** since "Publishing a goal says one thing": not HM1's, needs an owner.
- **Item 2, Correct this check-in (branch `checkin-correct`)**: the receipt's link is `/check-in/<goal>?correct=1`; the form asks "Why are you changing it?" (Must fix under `MIN_CORRECT_REASON`, which now lives in `domain/checkin.ts` and is re-exported by `changeset.ts`, so the form doesn't pull the lazy engine in); `state.postCheckIn(goal, draft, mode, reason)` posts mode `correct`, then opens the goal with the toast "Week n corrected: a is now b." and Undo (`undoImport`, a correction being an import of one). Journey **U142** (U138 to U140 left free: another track jumped to U141). Needs `npm run build:mcp` in the main checkout before merging (checkin.ts and changeset.ts changed).
- **Item 3, the ungated branches, rebuilt from main** as `fs2-gated`, `ck2-gated`, `find-goals-scope-gated`, `gl2-gated`, `nv2-gated` (pushed; typecheck and unit tests pass on each; evals not yet run; no PRs yet). The original `gl2-map-fixes` and `nv2-fixes` commits had swept in a stale tree (about 2,600 lines reverting main): only the intended files were re-applied. On the way: GL2's `sortOff` moved into `GoalFilterSheet.tsx` (main made the sheet lazy); NV2 keeps main's Goal edit (it already closes with FormClose), puts FormClose on New goal, keeps `articleRef` (light) in BackLink and `PageHelp` from `ui/HelpLinks`, and the walk's tab storage goes through `readWalk`/`writeWalk` so CheckInFlow stays at 6 storage uses; CK2's `previewChanges` takes `posts` as a seventh argument. `find-goals-scope-gated` changes `src/mcp/tools.ts`: run `build:mcp` in the main checkout. Each still needs `evals:changed`, a draft PR, CI and merge, one at a time (they touch Goals, the check-in and Find; merge main into each first).

**Next, in the brief's order:** #171 (U9, U111, U23; rebase on main after HM1), item 2's PR, the five branches, FS1's mediums (the picker clipped in sheets and Data's table: `.pick-panel` in a portal; set-up's two people of one name, `Onboarding.tsx`; people who have left are never found, `app/search.ts`), RV7 and HM2 (`rv7-who-may-speak`, `hm2-asks-wait`: both stale against main, re-apply their intended files as above), the habit moment (evaluation `docs/reviews/2026-11-12-muse-product-evaluation.md` item 12 and decision 4; backlog L (3); round 3's CF4; measure "% of goals checked in before the review, without a nudge"; calm, no confetti or emoji), then N12's Find timing and #110's lows.

**Habits:** a worktree per branch (`git worktree add`, `ln -s` the main checkout's `node_modules`); `build:mcp` and merges of main only in the main checkout; take What's new from main and put the branch's entry back on top, dated today (`guide.test` wants newest first). Main moves every half hour: re-check `mergeable_state` before merging. U42 and U20 time out under four-shard load and pass alone.

## Planning state, Wednesday 11 November, 14:10 UTC

- **There was no talk; the freeze is lifted.** Lane (11 Nov): "Do all the recommended work." Tracks merge their own green PRs (CLAUDE.md's gate); migrations carry their SQL in the PR. Nothing waits for Thursday any more.
- **Decided today:** redesign rounds 2 and 3, all 34 decisions plus 18–23 (#118, #119; backlog RD2, with GE10 "Proposed" in the first cut). Architecture readiness review (#120, `docs/reviews/2026-11-11-architecture-readiness.md`): scale 2/5, handoff 3/5, items AX1–AX10.
- **Five build tracks are running (Opus), each reporting once to the planning session, with a handover when half full:**
  - track 1: find and navigation are done (#110–#117, #116, #148); a fresh session builds CK1, CK2, HM1, HM2, RV7 and N12's timing of Find: session_012kbr922sdhQdcALvU6MR5D.
  - track 2, OB1, GT3's edit page, goal sections into About, the reviewId fix, GE1, GE2, GE9, GE3, GE10 (after IM1), ST1: session_012kbr91unF5Yyjk5zfSVQhg (OB2 #103 merged).
  - track 3, AS part 2 (early, for AX5), ML1–ML3 (the metric screens: today there is no Metrics page or menu item), AS part 3, IM0–IM3 (IM1 early, for GE10): session_012kbr8zHkYVKNmqmUDFhXnz (#121 merged).
  - track 4, AX8 (#131 merged), AX9, then FT2, FT1, SW1, SW2, AX2, AX6, AX5 as their dependencies land: session_012kbr8zVSFsTiiHmPysyfxb. #141 fixed Lane's bug (Undo after switching a feature off said "back on" but stayed off) and main's red Data checks since #128.
  - track 5, CY1, CY2, CY4 (before 3 Jan 2027), CF1: session_012kbr8xyk325FDxMK7DoLsU.
- **Reviewer:** a Fable 5.2 session reviews every merge from #121 on, sends high findings straight to the owning track, and summarises to the planning session at the end: session_012kbr8y4Bh3MudNC1bdo3RN (log on branch `build-reviews`).
- **CI (#143):** when apt can't reach Ubuntu's mirror (an outage on 11 Nov, 14:13–17:15 UTC), Playwright installs Chromium alone with a warning; the telemetry privacy eval matches the typed number only on its own.
- **Fence check (#125):** Supabase's own tables in extensions, cron and net, open to every role by default, are a warning; a direct grant to `faro_owner` still fails. 0038 is live.
- **Open with Lane:** the demo-script corrections offered after the motion video (step 6 reads 40 after a review decision; where "Being handled" shows) were never answered; with no talk they may not matter. Parked: should only a review's members mark its goals reviewed; Home's count links on phones. 0c2 (drop the public redirects) about 18 Nov.
- **For the next planning session:** read reports with `ReadNotifications`; start a fresh session for any track that hands over (its handover is in its last PR); keep U9, U23, U73 (scoring 8.6–8.9 locally) and U20's load timeout in view.

## Track 2 (one goal, goal entry, set-up), Thursday 12 November, ~15:00 UTC (session past half full, handing over)

Session: session_012kbr8xSSMxeAr6Wx9a4R2W. It ran each item through one subagent at a time from a common brief (kept below), reviewing, merging main and merging with **merge commits** (squash breaks stacked branches).

- **Merged:** GT3's edit page (#184); GE1 (#186: `goalEntry.ts` rules 1, 2, 4, 7, `goalRights.ts`, the `saveGoal` action through `app.run`, AX2 told to track 4); GE2 (#189: `goalChecks`, questions in place, answers as Checked); GE9 (#194: `weeks.ts`, `weekChoices.ts`, `WeekPick`, From/To); the GT3/GE1/GE2 review mediums (#197, which also moved `saveReviewOrder` out of `Inspect.tsx`; track 3's IM4 made the same split); the old session's #129 fixes (#192, merged **without** its 3 KB bundle-budget margin, which its handover attributed to Lane: confirm with the planning session before raising any budget); GE3 (#202: the read-back, `src/domain/readBack.ts`, journey U137, `readback.csv`); the publish fix (#208).
- **Next, in order:**
  1. The outside reviewer's three reports (planning, 14:37: from an AI reviewer, not Lane; reproduce first, fix only what is real, each its own PR with an eval; a two-sided range is reported to planning, not built, if it's a new capability). Findings (reproduced on main, 12 Nov 15:00):
     - **Publish showing three states at once: real**, fixed and merged in #208: after the save the wizard re-ran `goalChecks` and the new goal matched itself as a same-named twin; `saving` never reset; the toast fired before the page changed.
     - **Set-up's "Who are you?" pre-filled from the previous workspace: by design** (backlog WS, #70; `Onboarding.tsx` 158–163 fills set-up from the person you are, with "Filled in as Priya Nair, from Alpha Co. Change anything that's different here."; U5 and U49 check it). Identity is stored per workspace and `WhoAreYou` starts empty. A decision for Lane if he wants it changed.
     - **Two-sided range: a new capability, not a bug.** A range has one limit and one side everywhere (`RangePlan {bound, limit, margin}`, the goal-entry spec, `columns.ts`, the MCP tools, status); no spec asks for two; the import refuses "99.5–99.95" as not a number rather than narrowing it. Workaround: two goals. Backlog, not code.
  2. GE9's build-review mediums (reviewer, 13:41; full text on branch `build-reviews`, section "#194"): a new goal row with To and a blank Due week refused (`pair()` in changeset.ts); a file's "From" meaning the starting number now read as a week (`columns.ts`: a bare number under From with no Start column should be a Must fix); `WeekPick` highlights on mouseenter (use mousemove); the year's last week makes New goal's untouched defaults a Must fix (goalEntry.ts); a cycle shorter than a year gets wrong weeks (weeks.ts). Lows in the log.
  3. U93 (GE2) scores 7.8: on a phone the over-100 question sits below the fold and focus doesn't move to it (planning asked for this fix).
  4. GE10, Proposed goals: the migration (goal-entry spec §12, next free number; `add column if not exists`, explicit grants where new objects need them, faro only, full SQL in the PR) ships one merge ahead of the code. GE3's read-back gains "Is it under way?" in `src/domain/readBack.ts` and step 3 of `GoalWizard.tsx`. The State column is one entry in `FIELDS` (`columns.ts`).
  5. ST1 (`docs/design/setup/spec.md`): `/welcome`, `/join/<id>`, an invitation that opens the right workspace.
- **Left open from reviews:** the stale edit draft (GE4's patch); #129's lows (in the old handover above); GT3/GE1/GE2 lows listed in #197's body.
- **Bundle:** first download about 290 KB of 292; the real app about 348 of 350. Lazy-load anything new. Track 4 (session_012kbr8yGf2m8ghRQungzjo3) is moving What's new titles out of the first download.
- **FT1/FT2 not on main yet:** GE3's read-back and GE9's "nothing due" assume weekly and Reviews on; the read-back only needs `rhythm` and `reviewsOn` passed once they land.
- **Habits:** one subagent at a time in the main checkout (never two eval runs; vitest fails under an eval run's load, e.g. fence.test); conflicts and small fixes in a worktree with linked node_modules, then `sed -i 's#^// \(\.\./\)*home/user/goals-app/node_modules/#// node_modules/#' api/mcp.js` after `npm run build:mcp`; measure the bundle to two decimals by building with `--manifest`; main moves fast, so merge main right before expecting CI; journey numbers in the spec may be taken (U94 → U137).

## Track 2 (one goal, goal entry, set-up), Thursday 12 November, 12:40 UTC (session past half full, handing over)

_Superseded in part: a newer track 2 session (session_012kbr8xSSMxeAr6Wx9a4R2W) merged GT3's edit page (#184), GE1 (#186), GE2 (#189), GE9 (#194) and the GT3/GE1/GE2 review mediums (#197), and continues with GE3, GE10 and ST1._

- **Merged:**
  - OB1 (#129): New goal in four steps with addresses, plus find-and-pick, `startLevel`, `parentSuggestions` and `planNote` in `src/domain/newGoal.ts`.
  - The reviewId fix (#135): a review-decision ask reads as a decision in History.
  - Goal sections into About (#140).
  - #129's mediums 1, 2, 3 and 6 (#192):
    - Continue after a Change on Check goes to the first step that no longer holds, with its faults shown;
    - focus mode covers `/goals/new/<step>`;
    - F16 checks that nothing covers Back or Continue and that the tab bar is hidden.
- **GE1 and GE2 reached main from another session** (#189 and before). Check `docs/backlog.md` before starting either; GE9 and GE3 are next.
- **Next for a fresh track-2 session, in order:**
  1. GT3's edit page.
  2. GE9 and GE3; GE10 (IM1 and IM2 are merged).
  3. ST1.
  4. If GE work reworks `saveGoal`, route it through `app.run` (AX2) and tell track 4.
- **#129's mediums:** 1 to 3 and 6 (Check's values wrap now) are fixed in #192. 4 was fixed on main. 5 is withdrawn: Lane decided on 11 Nov that a member may add a goal for anyone.
- **Build review of #184 (GT3), #186 (GE1) and #189 (GE2)** (reviewer, 12 Nov; full text in the build-reviews log on draft PR #134, branch `build-reviews`). Do the mediums first.
  - **Mediums:**
    - A file or MCP row for a new goal with an Effect that isn't a number saves and drops the Effect; the form refuses it. `changeset.ts` runs `goalMustFix` before reading the row's parent, and `goalEntry.ts:137` checks Effect only when there is a parent.
    - On Change a goal, Save with an unanswered question off screen does nothing visible. Add the line above Save and focus the first open question (`GoalEdit.tsx:113`).
    - The wrong-side question is asked only by the screens: it needs `ctx.metric`, and only GoalWizard and GoalEdit pass it. Its answer isn't recorded as Checked in History, and no journey covers it.
    - A kept or stale edit draft reverts what someone else changed meanwhile and logs it as the saver's. GE4's patch is the planned fix.
  - **Lows:**
    - Close and Save push a history entry, so Back returns to the form.
    - A stage goal's "How it's measured" can't be changed.
    - `confirm:true` writes "Checked … Yes" for questions nobody saw.
    - "No, I'll change it" does nothing on Change a goal and set-up cards.
    - Clearing a unit is asked by the form's rule, not the engine.
    - The saving rule accepts a stage done in a future week.
    - MCP restates the question kinds (`mcp/tools.ts:116`).
    - A stopped goal's edit page refuses only at Save.
- **#129's lows:**
  - focus on each step's first field when it opens;
  - the effect that blocks Continue while loading;
  - Enter on a refused "Feeds into" match;
  - `fromCheck` survives the browser's Back;
  - `?parent=` with a draft already open;
  - focus after the discard dialog;
  - `startLevel` counts removed and stopped goals;
  - the feeds-lower rule lives only in the form;
  - the unbuilt "cycle ended", "Add one" and gone-parent states from the onboarding spec.
- **U23 (entry)** scored 8.6 locally and is track 2's to lift.

## Track 4, Thursday 12 November, midday (session past half full, handing over)

- **Merged:** #183, the offline fix from #167's build review. Offline, a page that loads when opened (Help, say) no longer reloads into the browser's error page:
  - `reloadOnce` in `src/telemetry/staleCode.ts` does nothing while `navigator.onLine` is false;
  - the error boundary in `src/telemetry/react.tsx` says "This page needs a connection", with Try again and Go back;
  - N8 has a browser case for it.

  #183 also fixed #167's two lows: `PageWait` in `src/ui/bits.tsx` shows "Opening…" on a slow load, and `evals/touches.cjs` now maps `vite.helpIndex.ts`.
- **Open, should be merged by the time you read this:** #190, the first download. It went from 369 to 288 KB, and the real app's from 428 to 346 KB. The budgets are now 292 and 350 KB (`scripts/check-bundle.mjs`), and R4's AX4 sentence is corrected. If #190 is still open, finish it first: merge main in, check CI is green, then merge.
  - **How:** every page but Home is `React.lazy` in `src/App.tsx`. The spreadsheets module's Import and Data menu load when first shown. "Export these goals" is now a light `ExportButton.tsx` whose sheet loads on click.
  - **Two traps it hit, worth knowing for any new lazy page:**
    - While a page is on its way, `PageWait` holds `min-height: 100vh` and hides `.page-help`. Otherwise the footer jumps when the page lands, and N6 fails at a 0.037 layout shift.
    - The goal map measures again on `animationend`. Otherwise it measures mid-slide and ends 6 px short (F6).
  - **The eval helpers:** the `settled` helpers in `evals/journeys.cjs` and in N6 ignore `[data-page-wait]`, and P7 waits for `settled` rather than a fixed time.
  - **What's left in the entry (raw, before gzip):** react-dom 202 KB, `domain/changeset` 52, react-router 38, `domain/columns` 29, removal 23, vocabulary 21, actions 21, Home 20, Shell 19. The next cut is the change engine: `app/actions` imports `planChanges` statically. To see what is in the entry: build with `--sourcemap`, then attribute bytes per source with `source-map-js`.
- **Next, in order:**
  1. **AX5, the query port.** It is unblocked: AS part 2 (#139) merged. It's the one M to L item. The brief is `docs/reviews/2026-11-11-architecture-readiness.md`, finding 4 and the AX5 row:
     - `goals()`, `counts()` and `goal()` in `src/ports`, answered in the browser the way `Search` is (`src/ports/search.ts`, `src/adapters/localSearch.ts`);
     - a contract covering the four checks in `spec/rebuild/ports-at-scale.md`, with its cases written into `spec/conformance/`;
     - Home and Goals read through it;
     - the load takes only the current cycle's check-ins and recent changes;
     - `Store` moves to `src/ports`.

     Consider splitting it into two PRs: the port and its contract, then the narrower load.
  2. FT2, then FT1, SW1 and SW2.
  3. **AX2, now unblocked:** track 2's GE1 (#186) merged, and `saveGoal` goes through `app.run` with `planGoal`. Two parts are left for AX2:
     - a test that nothing on `AppState` reaches `commit` except through `run`;
     - `applyChanges` sends its input again with `apply`.

     Check that `postCheckIn` is in the action table too.
  4. AX6.
- **Still left from the reviews:** the workspace switcher on the "can't open … yet" page (`CantOpenYet` in `src/screens/Start.tsx`).
- **Watch items:**
  - U20 and N6 still fail under local load during the full run and pass alone.
  - Two traps around the MCP bundle and What's new:
    - Any What's new entry changes `api/mcp.js`. Run `npm run build:mcp` (in a worktree, then `sed 's#^// \.\./goals-app/node_modules/#// node_modules/#' api/mcp.js`) before pushing, or Smoke fails.
    - A new `.tsx` under a module counts as a screen: list it in the module's `help.ts` `screens` and in `src/mcp/parity.ts`.

## Track 4, Thursday 12 November, 00:20 UTC (session past half full, handing over)

- **Merged tonight:**
  - #167: Help and What's new load when opened. The first download carries only a build-time index of their titles, routes and release ids (`vite.helpIndex.ts`, `virtual:faro-help-index`, `src/help/lookup.ts`; shared rules in `src/help/match.ts`; `lookup.test.ts` checks the index matches the source). It went from 429 to 367 KB.
  - #172, the medium findings on #154 and #141:
    - stamps move by whole days only when today is pinned (UTC+13 and UTC+14);
    - the storage lint uses exact counts, TypeScript's parser, every code extension and `index.html`;
    - `App` takes a `clock`, and the focus reload runs on `loadMark`, the page's own time;
    - the bundle check budgets the real app too (what `src/main.tsx` awaits before drawing, read from the build manifest, so CI builds with `--manifest`);
    - "can't open yet" names the reason (`Identity.why`, `NoEntry`, `matchSignIn`), with "Copy a message for them" and "Try again";
    - feature switches save one at a time.
- **Next for a fresh track-4 session, in order (planning session, 12 Nov 00:15):**
  1. **The first download, before FT2.** It is 369 KB gzipped against a limit of 370 (`FIRST_DOWNLOAD_KB`); the real app's is 428 against 430 (`LIVE_FIRST_DOWNLOAD_KB`). R4 asks for under 300.
     - Part of what "grew" is the check: AX4 (#128) measured the entry alone (241 KB); #154 made it sum the entry and every modulepreload.
     - Measure what the entry really holds now: the biggest are `index` 218, `rules` 54 and `changeset` 58 (in the rules chunk now?), `state` 29, `Pick` 21. Use `npx vite build --manifest` and its `.vite/manifest.json`, or a rollup visualiser.
     - Lazy-load what a first visit doesn't need. Likely candidates: the change engine (`domain/changeset`, used by import and bulk change), the exporter, the check-in flow, Goals' map and table pieces, the Splash, and the demo builder for the live app.
     - Bring it under 300 KB, lower both budgets to the new figures plus a few KB, and note it in R4's AX4 sentence (`src/spec/internal.ts`) and here.
  2. AX5, the query port (unblocked: #139, AS part 2, merged).
  3. FT2, then FT1, SW1 and SW2.
- **Still left from the reviews:**
  - The workspace switcher on the "can't open … yet" page (`CantOpenYet` in `src/screens/Start.tsx`).
  - #167's build review, **medium**: offline, "Help with this page" replaces the app with the browser's error page. The failed `import()` of the Help chunk counts as stale code and reloads (`src/telemetry/staleCode.ts`, about lines 10–17), and the reload has nothing to load. Skip that reload when `navigator.onLine` is false and show a plain message instead. Do this first, with a test.
  - #167's lows: nothing shows while the Help chunk loads on a slow connection (`Suspense fallback={null}` in `src/App.tsx`), and a change to `vite.helpIndex.ts` alone runs no journey, so add it to `evals/touches.cjs`.
- **Watch items:**
  - U20, U58 and P9 failed under local load during the full run and passed alone. #168 fixed U20 and U58's cause; the last full run was all green.
  - Main moves fast: merge main before expecting CI, because a conflicted PR gets no run at all.

## Track 4 (architecture and feature switches), Wednesday 11 November, 19:40 UTC (session full, handing over)

- **Merged today:** AX1 (#122), AX3 (#123), AX10 (#124), AX7 (#126), AX4 (#128); then this session's AX8 (#131: `spec/core/schema.sql` and `spec/rebuild/access-today.md` generated from a migrated PGlite by `src/spec/schema.ts`; a contract for the MCP endpoint's `Deps`, `src/ports/contracts/deps.ts`, run in memory with `storeDeps`, on plain Postgres with `postgresDeps` and on the Supabase adapter); the feature-Undo fix (#141: a toast's Undo ran against the workspace as it was before the switch, so switching back on did nothing; actions now get the workspace as it is now; U48 covers it; the eval helpers' goto and reload wait for a screen that loads when opened, which fixed F7, N5 and P10 on main; `research.test` resets modules, as test files share workers); AX9 (#154: layers lint rule 7, browser storage only in `src/adapters` and `src/ports`, with the shrinking list `scripts/browser-storage.json` shown as a table in `spec/rebuild/adapters.md`; record stamps from the `Clock`; `goalSeen` behind `Prefs`), with both build reviews folded in (the bundle budget sums the entry and its preloads, 427 KB on main, limit 430, then 367 KB and limit 370 once Help and What's new load when opened (track 4, #167), and the real app's, which also waits for the Supabase store and client, 428 KB with limit 430 (#154's review); column grants on the access page; `touch` keyed by token id; the signed-out page's words; plain Postgres refuses a token saved with other rows; doc corrections).
- **Next for a fresh track-4 session, in order:** FT2 (now free: GL2 #112 and FS4 #117 are merged), then FT1 (free: NV3 #114 merged), SW1 and SW2 after FT2. AX2 waits for track 2's GE1; AX6 after AX2; AX5 after track 3's AS part 2. The build plans: `docs/design/feature-toggles/spec.md` section 11 and `docs/design/feature-switches/`; Lane's answers in `docs/design/round-2/README.md` and `round-3/README.md`.
- **Left from the build reviews:** keep the workspace switcher on the "can't open … yet" page (`WhoAreYou` without a picker, `src/screens/Start.tsx`), so someone can reach another workspace from it; small UI change, not done.
- **Watch items:** U20 and N6 fail under local load only (a 30 s `waitForURL`; rows still sliding 400 ms after a sort) and pass alone and on CI. U87 had no entry in `evals/shards.cjs` (issue #150); check it was fixed.
- **Habits that helped:** a worktree per item, but `npm run build:mcp` in the main checkout: in a worktree with linked `node_modules` the bundle's path comments change (fix with `sed 's#^// \.\./goals-app/node_modules/#// node_modules/#' api/mcp.js`). Main moves fast: merge main into a PR before expecting CI (a conflicted PR gets no run), and take What's new from main and add the PR's entry back rather than resolving it by hand. Don't run heavy tests beside `evals:changed`. The full local gate takes about 13 minutes.

## State on Tuesday 10 November, evening

- **The talk is Wednesday 11 Nov.** Present from `/demo?today=2026-11-11`; `docs/demo-script.md` was checked against the live demo at 18:15 UTC (Rhea 5 check-ins to do; Amara 126 goals, 20 to discuss; Goals tabs My team 1 · Watching 56 · All 126; Needs attention 41; About's wrap-up 21 Dec 2026). Dry run from `docs/live-build/checklist.md`; run the metric live build once, as main changed a lot today.
- **0c is done:** Faro lives in the `faro` schema (0035–0037), owned by `faro_owner`, which can't read or write the family tables; CI's `DATABASE_URL` is `faro_owner` (tested by the Nightly workflow, 17:38 UTC). Exposed schemas include `faro`; `SUPABASE_SERVICE_ROLE_KEY` is gone from Vercel. Next: 0c2 (drop the public redirects) about a week on. Read `supabase/README.md` before any migration.
- **The redesign (backlog RD, `docs/design/`) is being built in three tracks, each merging its own green PRs:** merged so far AR1/AR4, FS1, FS2 (part), AR2, GL1+NV1, AR3, GT1, GT2, GT3, WR1–WR4, OB3, plus fixes (#87–#107). **Held until Thursday 12 Nov** (after the live build): track 1 FS3, GL2, FS4 and FS2's GoalWizard/GoalEdit/Data pickers and list bars; track 2 OB2 (#103, green), OB1, GT3's edit page, goal sections into About; track 3 AS part 2, ML1–ML3, AS part 3, and #104's day-one rule taking only what it reads plus the AR4 lint gap. Track sessions: 1 session_012kbr8zbTuEu8jJZWUD4ENu, 2 session_012kbr8xYENVqYZuZ5Znt5Sq, 3 session_012kbr8z72rbVyFgvmF6P4e3.
- **Track 1, Wednesday 11 November, late night (session past half, handing over):** merged #168 (U20/U58 Back). HM1 (#169) has main merged in (HomeNews moved to `src/ui/HelpLinks.tsx` on main; HM1's "New in Faro:" line is there now) and its full suite was running locally; merge it when that and CI are green.
  - **#171** (open, gated): U9's budget (GT3's Watch sheet makes 7 steps), U111's `logged`, and U23's phone `entry` (it asked for the computer's title line). It and HM1 both touch U9: whichever merges second rebases.
  - **Drafted and pushed, typecheck and unit tests passed, evals not yet run** (each its own PR once gated; run `npm test`, `npm run evals:changed`, then open a draft PR):
    - `gl2-map-fixes`: GL2's Map findings 1, 2, 3 and 6 (`goneTo` in GoalMap, an emptied search flushes, the Filters sheet takes `sortOff`, `goals-phone.css` under 700px). Checks: MAP 2 in `6-map-reviews.cjs`, a 650/700 check in `5-list-board.cjs`.
    - `nv2-fixes`: NV2 2–5 and NV3 1–3. `isForm` in `navigation.ts` is the one form rule (Shell and BackLink); FormClose on goal edit, New goal and the table; the back link reads `useViews`; Find has an `inline` mode for Page not found; `resumeWalk` in `checkin.ts`. U70, U71 and U72 gained steps: their budgets may need raising.
    - `find-goals-scope`: #116 (the link's `scope=` in `find_goals`; Goals reads `scopeFacts` from `app/reads`). `api/mcp.js` rebuilt.
    - `ck2-fixes`: CK2 1–3. The table posts through `previewChanges(…, posts)` so `Asked` is kept; `checkInLevels` uses `fmt`; the table's Must fix is a `MustFixBlock` (says the number once). F-check "numbers 5" in `2-forms-checkin.cjs` changed. Not done: a browser journey for the table's Check (the engine test covers it).
    - `fs2-fixes`: FS2 1–2 (`wordsMatch` in `find.ts`; `applyTable` takes the shown columns). FS2 3, Data's Filters sheet, is backlog item FS2b.
  - **Not started:** FS1's mediums (the picker clipped in sheets and Data's table: draw `.pick-panel` in a portal; set-up's two people of one name, `Onboarding.tsx:199`; people who have left are never found, since `app/search.ts` builds from the cycle-scoped snapshot). Then RV7 and HM2 (rebase on main after HM1), then N12's Find and Goals-list timing with #110's lows.
- **Track 1, Wednesday 11 November, night (session past half, handing over):** CK2 (#160) merged. Open, with the local gate passed:
  - **#168**, the Back fix for U20/U58: Goals rewrites its address only while still on `/goals`. Proven by a four-shard run: U20 and U58 pass, 167 of 168 requirements; P9 timed out under load and passes alone. Merge it first.
  - **#169**, HM1. It has the full suite plus reruns of every failure; U9's step budget and U111's "logged" fail the same way on main. CI has been queued on GitHub since about 20:21 UTC.

  Drafted and pushed, not yet gated (rebase each on main after #169):
  - `rv7-who-may-speak` (RV7): `canSpeakFor`/`speakRefusal`/`joinLine` in `review.ts`, checked in `reviewCall`, `askQuestion` and `addAction` when a review is given; the join line replaces "Join this review"; N25 in its own notes file, 13-review-speak; `REVIEW-SPEAK`. Still to do: `npm test` (the generator calls `reviewCall` as the review's creator and as SAID's speakers, so check they are members), `npm run spec`, `build:mcp`, evals.
  - `hm2-asks-wait` (HM2, stacked on HM1): `waiting`/`waitingOrder`/`askLead` and `homeAsks` in `reads.ts`; NeedsYou on rule 3; N26 gains Amara's Respond lead and Rhea's late question. Still to do: the same gate.

  **Next, in the planning session's order:**
  1. The build reviewer's mediums on #111–#117 and #116, grouped by screen (the planning session's message of 11 Nov, 21:36; the log is on `build-reviews`, draft #134). Add CK2's (#160) three:
     - an answer given in the check-in table isn't kept in History;
     - the Check's words use a second number formatter ("1 hours"): use the one formatter;
     - `checkInLevels` returns only the number's Must fix, and the table draws Must fix as a hint.
  2. Then RV7 and HM2.
  3. Then N12's timing of Find and the Goals list, with #110's lows (listed in the next line).

  Notes: Home's lead reads `homeFor` only. `.home-hero[data-lead]` is the lead's kind, or `none` for the quiet line. Evals at other dates use `/?today=…`, which `url()` keeps.
- **Track 1, Wednesday 11 November, late evening (session past half, handing over):** merged CK1 (#156: the form posts through the engine, `postCheckIn` in `changeset.ts` with `new`/`again`/`correct`; `previousFor`, so a second check-in is compared with last week; K6's kept week). CK2 (#160: rules 2 and 3, `checkInLevels`/`unanswered`/`stepState`, the Check and Must fix blocks in `src/ui/Levels.tsx`, answers in History as `Asked`, journey U111) is open with the gate passed; merge it once CI is green. **Next for a fresh track-1 session:** HM1, HM2, RV7, then N12's "Find from anywhere" timing, in that order (`docs/design/home/spec.md` rules 1–3 and 11; `docs/design/reviews/spec.md` for RV7, decision 9 (a)). Notes: IM2 (#145, track 3) rewrites `changeset.ts` and adds an engine-side levels module; whichever of it and CK2 lands second reuses `src/ui/Levels.tsx` and rebases. Evals that type a number which raises a Check answer it with `answerChecks(p)` in `evals/journeys.cjs`. U20 and P9 time out under parallel load and pass alone; don't run two eval runs or vitest beside an eval run. `npm run evals` with `CHECKS=` (not `FINISH=`) runs a platform check alone.
- **Track 1, Wednesday 11 November, evening (session full, handing over):** merged FS3 (#110), GL2 (#112), NV2 (#113), NV3 (#114), FS1's held pickers (#111), FS2's list bar on Data and Feedback (#115), FS4 / N12 at company size (#117); find_goals' scope (#116) is green and merging. `scripts/pickers-left.json` lists nothing outside Goals' filters, which GL2 moved. Loose ends closed: #91's lows (closed pickers and Find's "lately" ask the Search port by id, so `rowFor` is gone; the team lead first; the phone's full-height picker); Goals' browser title is "Goals" on every tab (NV2, navigation rule 2 says the scope is not in it). Fixed on the way: NV2's back link imported the Workspace screen and undid AX4's lazy load (first download back to 248 KB). **Left:** N12 doesn't yet time Find from anywhere (FS3 has landed, so it can join). **Next for a fresh track-1 session:** round 3's CK1, CK2, HM1, HM2, RV7, in the plan's order (`docs/design/round-3/README.md`, part 3; Lane chose (a) on every decision). Notes: evals read Goals' `.goals-line` and `.filter-line`; `navTo` in evals/journeys.cjs matches a label from the start, after a tab's count; the Data checks (F7, N5, P10, U20) fail on main since AX4 until #141 lands.
- **Outside review:** a Fable 5.2 session reviewed every merge (#86, `docs/reviews/2026-11-10-rd-pr-reviews.md` on branch rd-reviews): 1 high, 17 medium, all fixed but #104's. Its three patterns for builds: weeks counted from 1 where the app counts from 0; a rule written again beside the one it should call; a lint that matches a spelling, not the thing. Start a reviewer again on Thursday for the held items.
- **Parked for Lane after the talk:** should only people in a review be able to mark its goals reviewed (today anyone may); Home's count links are about 22 px tall on phones.
- **Build sessions block on Send Message permission prompts** when nobody is watching; read reports from `list_events`. Merge main into a branch in the main checkout, never a worktree with linked `node_modules` (it puts absolute paths in `api/mcp.js`).

## State on Tuesday 10 November, early morning

- **Everything approved for Wednesday has merged** (see the backlog's Done table, #68–#79): Lane's "Being handled needs an action" rule, Decide in the review, the Map at scale, set-up and check-in honesty, talk-path polish, the small batch (migration 0034), engineer docs (ports at company scale, R6). **Code freeze: Tuesday 14:00 UTC.**
- **The demo is pinned:** present from `/demo?today=2026-11-11`; `docs/demo-script.md` has the numbers read from it on 10 Nov (Rhea 5 check-ins to do, Amara 126 goals and 20 to discuss, Needs attention 41).
- **The "Pet store" workspace was deleted** (Lane, 9 Nov), so the live root shows the welcome page again. Any workspace made on the live site brings the name picker back.
- **Build sessions still block on Send Message prompts** when nobody is watching: all five did on the night of 9 Nov. Read their reports from `list_events` and check their PRs' CI directly; merge main into later branches in the main checkout (a worktree with linked `node_modules` puts absolute paths in `api/mcp.js`).
- **Open after Wednesday:** the backlog's "After Wednesday" line. 0c is decided (10 Nov): Faro stays in family-hq, fenced off by its own schema and a Faro-only role; no new project, no paid plan. Lane changes CI's `DATABASE_URL` once the role exists.

## State on Monday 9 November, night

- **What Faro is for:** a model the company's internal team will copy and adapt, plus demos and an off-site. Never real data. **Lane presents it on Wednesday 11 Nov** (moved from Tuesday) to leaders and engineers, including **building the metric library's screens live** (`docs/live-build/metrics.md`, script `docs/demo-script.md`, dry-run `docs/live-build/checklist.md`).
- **Merged 9 Nov (main, CI green):** live-build kit and rehearsal lessons (#56, #60), 8c swappable parts (#58: `src/ports`, `src/adapters`, a plain-Postgres store, `spec/rebuild/adapters.md`), G phone Goals page (#61), Goals search/URL/history hotfix (#62), goal-page hotfix (#63: plan sanity check, Done goals show their result, "Updated" date), review triage GP/GD/NAV/MAP (#65), R review leftovers (#64: F16 reload after deploy, F03, F07, F08–F10, F13, F14).
- **Live-build rehearsals:** run 1 (answer 3 "with a reason") 21 min to preview, 41 to green CI (#55); **run 2, the fallback** (#57, brief as on stage) 13 min to preview, 16 to green. Neither is merged; never merge them. Previews are behind Vercel sign-in.
- **Building on the night of 9 Nov (each reports once to the planning session; Lane pre-approved "merge any time" when green and reviewed):**
  - **8g** (#59): drill gaps closed; **drill 2 scored 100% (360,109 values) from the kit alone**, no answers read from the scorer. Being brought up to date with main.
  - **GP** (branch `goals-decisions`): Needs attention shows handled goals in a "Being handled" group (Lane), Cards layout cut (Lane), health line, worst-first across trees, Board tweaks, History values; plus Lane's evening asks: "Being handled" explains itself everywhere, and New goal is no longer the Goals page's big button (the sidebar entry stays).
  - **faro-mark** (branch `faro-mark`): the workspace initial top-left becomes Faro's F mark (Lane).
  - **WS** (branch `workspace-rework`, Lane: before Wednesday): Workspace truthfulness bugs, the Inbox moved out of Workspace as a global "Feedback" place (open, never emails), reset admin-only plus Leave, recording asked at set-up, a persistent workspace switcher, "Admin" on badges and a permissions line, a real Overview and Cycles, Home's set-up prompt moved. Review: an outside deep dive of Workspace on 9 Nov (in Lane's chat, summarised in WS's brief).
- **When GP and WS land:** update `docs/demo-script.md` with the changes they list (Needs attention numbers, Inbox location, review walkthrough's "Outstanding" line from R, the first-check-in note), then Lane's dry run on Tuesday evening.
- **After Wednesday, in order:** 0c (own database: free Supabase tier allows 2 active projects and Lane has 2; options are Supabase Pro or plain Postgres via 8c's adapter), 0a, L, GD, NAV, MAP, small batch (0u, 10a, R5), 3a, 0t, 11. Wednesday's feedback may change it.
- **Things to know:**
  - The repo is **public** so CI is free; nothing secret is in it.
  - Health check: `https://goals-app-puce-five.vercel.app/api/mcp?check`.
  - Builds run in the cloud environment **goals-app**. The database has no workspaces, so no AI token works until Lane makes one.
  - **Build sessions block on permission prompts** (Send Message, Send Later) when nobody is watching; several sat for hours on 9 Nov. Their reports can be read from their transcripts (`list_events`, assistant kind). Pre-approving those tools in `.claude/settings.json` is Lane's to do. Tell builds not to use scheduling tools.
  - Lane's Telegram bot (Keel, @Lane_claude_bot, token in the `api.telegram.org.` environment) didn't receive messages through a relay session on 9 Nov; parked.
  - Outside reviews and their triage are in `docs/reviews/`; open points are in the backlog.

## How the planning session should run (lesson of 8 Nov)

- **Keep this session's context small.** Don't subscribe to PR activity or relay CI and bot notices: each build session watches its own PR and reports once, when it's ready or blocked. Read build reports, decide, merge.
- **Merging:** Lane approves each merge (or pre-approves, e.g. "merge when green"). When he pre-approves, merge from here once the build reports green; build sessions won't merge on a relayed approval.
- **Recommend a fresh planning session unprompted** as soon as this one starts to fill up (about half full): update this handover, then give Lane a ready-to-paste prompt (CLAUDE.md, "Fresh planning sessions").

## How we work (Lane, 7 November)

- **Two kinds of session.**
  - **The planning session** takes Lane's ideas, runs grills, keeps the backlog in order and decides merges.
  - **A build session** builds one release, starting from a short brief. Only one build runs at a time in any area.
- **Ideas go to the backlog first.** Build only what Lane picks or has approved as next.
- **Backlog edits** ride with the next feature PR.
- **Be quiet while waiting.** Report merges, failures and decisions; nothing else.
- **Use models to match the work.**
  - **Strongest model:** planning, architecture and review.
  - **Lighter model:** mechanical work.
- **Database changes** apply through CI on merge. Show the full SQL in the PR description.
- **Commits and PRs** follow `CLAUDE.md`:
  - **Author:** Lane.
  - **Committer:** Claude.
  - **Trailers:** the session trailers.
  - **Merging:** merge when CI is green, then post the PR and live links.

## Brief for a build session

> Build backlog item <N> of Faro, as described in `docs/backlog.md`, following `CLAUDE.md`, `docs/architecture.md` and `docs/design-rules.md`. Base it on `origin/main`, work on branch `journeys`, run the full quality gate, open a draft PR with any SQL in its description, and merge when CI is green. Report back with the PR, the live link, screenshots of what changed, and any decision you had to make.
