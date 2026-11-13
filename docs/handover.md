# Handover: start here

Faro is an internal goals (OKR) app for a 15,000-person company, built to be easy for another AI to understand and rebuild. This page is the starting point for a new session. Read it, then `CLAUDE.md`, `docs/architecture.md` and `docs/backlog.md`.


## Track 3 (import), Friday 13 November, 03:30 UTC: IM8 and the review lows done (supersedes the 01:10 entry's list)

**Done**
- **#336, IM8** (merged). Set-up's upload goes through the import preview: create mode takes answers (`buildWorkspace`), the group block is shared from `src/ui/IssueGroup.tsx`, and the set-up preview (`src/ui/SetupFilePreview.tsx`) loads lazily. An owner the People sheet lacks offers "Add {name}" (`ownerToAdd`) or "Give it to someone here". `past-stage` is asked in create mode, answered "Count them from this week" by default (`setupDefaults`); `keepFileWeeks` and `stagesFromJoining` are gone. Journey **U147** (U146 was taken), `SETUP-UPLOAD`. The PR also:
  - fixed F8 on main: the hidden View sheet holds a copy of the toast;
  - gave the speed tests timeouts above their own limits;
  - removed Export's dead standalone button.
- **#347, the review lows** (auto-merge on; check it merged): IM3's two engine findings and the shared count helper, every IM4 and IM5 low, the #257 and #248 lows, and U29 on a phone (the walkthrough now lazy-loads). Two lows were left as they are: the year is already in the file name, and the zipped CSVs stay three clicks away. The full suite passed except U12 (8.8) and U31 (9), which are not import's.

**Next for track 3:** nothing open from the reviews. U99 (the set-up design's whole SETUP-UPLOAD journey: People paste, a team typo at set-up) belongs to the set-up track's ST6.

**Gotchas (new)**
- Don't run `npm test` and `evals:changed` at once: the container restarted.
- The newest What's new entry and a lazy route's dependency list both sit in the first download. A new shared chunk adds its name to the list, and so does a hash change. Near the budget, measure to two decimals: `sed 's/toFixed(0)/toFixed(2)/' scripts/check-bundle.mjs`.

## Track 3 (import), Friday 13 November, 01:10 UTC: handover after item 0 (supersedes the 12 Nov 21:20 entry's list)

The track 3 session that built item 0 is at half its context. A fresh track 3 session picks up here. The 12 Nov 19:40 section below still holds the open findings word for word.

**Done in that session (PR `im-review-fixes`; merge it once CI is green if it hasn't been)**
- The reviewer's four mediums on #257 and #248:
  - `importSpeed.test.ts`'s ~30,000-row test gives each copy its own keys (G-1001…), titles, names and emails, and asserts no issue and every row unchanged.
  - A new Goals row whose Action is Stop or Delete is a `removal-refused` Must fix ("Stop needs the goal’s Key…"; `changeset.ts`, beside the other not-found keys).
  - A filtered All tab exports as `as-shown`, never `all` (`Export.tsx`); U19 covers it (its step budget went from 16 to 19 for the second export).
  - Export's Everything counts read `everything()` / `everythingCounts()` in `export.ts`, the same set the workbook writes. `export.ts` no longer takes the whole workspace and is off `scripts/whole-workspace.json`.
- Planning's U46 finding (and U19's phone miss), two primaries in view: Export opened from the phone's View sheet hides that sheet meanwhile (`ExportButton.tsx`, `.sheet-wrap.under-sheet` in `styles.css`). U19 and U46 score 10. **U29 (8.3, the import walkthrough's first step on a phone) is not looked at yet**: it goes with item 2.
- Full suite before the last merge of main: every journey passed except U19 (since fixed); U12 8.8 and U31 9 (budget) were below 10 and are not import's.

**Next, in this order**
1. **IM8** (track 2 said on 13 Nov 00:24 that it has nothing open in `Onboarding.tsx`; its next session works in `App.tsx`, `dayOne.ts` and `state.tsx`). What I found:
   - `buildWorkspace` (`src/domain/importer.ts`, about line 100) runs `planChanges` with `mode: 'create'` and **no answers**. A Check that stopped its row blocks set-up; the rest become notes beside rows. IM8 passes answers through and returns `cs.groups` for the preview.
   - `past-stage` is skipped in create mode (`!existing && !create && d.kind === 'milestone'` in `changeset.ts`, about line 975). Set-up instead moves stages itself: `keepFileWeeks` and `stagesFromNow` in `Onboarding.tsx` (line 157; the toggle at about line 502). IM8 asks it in create mode with "Count them from this week" first and chosen, and drops the toggle.
   - An owner the People sheet lacks: `personFrom`'s `unknown-ref` (`changeset.ts`, about lines 428 and 442) offers `ANSWERS.unknownRef('person', v, false, false)`. In create mode, add "Add {person}" (adds them to the people) and "Give it to someone here".
   - The upload is `upload()` in `Onboarding.tsx` (about line 255), which fills `fileTables` for template `file`; the read-back is at about line 490. The groups-with-answers UI is in `src/modules/spreadsheets/Check.tsx`: load it lazily from set-up (first download ~264.7 of 265 KB).
   - Journey numbers: U99 is SETUP-UPLOAD's in `docs/design/setup/spec.md`. U92's second half needs its own number: U105 and U109 are taken; grep again after merging main.
2. **The IM3 findings, the IM4/IM5 lows and the #257/#248 lows** (19:40 section below), plus **U29**'s cause.

**Gotchas (new)**
- From planning: a migration that adds a check constraint adds its line to `src/spec/limits.ts` in the same PR.
- A container restart kills a background eval run without a result: rerun it, with its log in the scratchpad.
- Item 0's changes touch `changeset.ts` and `export.ts`, so `evals:changed` runs the full suite (about 17 minutes in four shards).

## Planning state, Thursday 12 November, 21:55 UTC (planning session handing over)

**Update, Friday 13 November, 02:10 UTC.** Current sessions (these replace the IDs below): track 1 session_012kbr8zenZxEHT6rv4yLzHG; track 2 session_012kbr8zJcP8xenTkLS4rV4P; track 3 session_012kbr8yuAExZc7Qwjdwi7Ew; track 4 session_012kbr8y3UGvoeUMdAQ8yaJ8; track 6 session_012kbr91nEq272Y9HvKNhm98 (the store contract, the kit's last gap); track 7b session_012kbr92c7taPQJmK4jDJU9E; reviewer session_012kbr8y4Bh3MudNC1bdo3RN. Main has a branch protection rule since 02:05 (a PR, the smoke check, up to date with main; no approvals), so auto-merge works: enable_pr_auto_merge (MERGE) once the gate passes. Lane decided (13 Nov): when a goal's owner changes, its open asks move to the new owner and the asker is told (track 1 builds it). The first download is about 264 of 265 KB.

The planning session session_012kbr939zneZWtAo7UQEHRP is about half full and hands over. Everything below this section still holds; this is what changed since 18:30.

- **Open sessions** (each reports once, when done or blocked):
  - **Track 1** session_012kbr91yMK3mzwj4mayoAJr: #274 (fix F6 MAP 2 at 390), #282, then hm1-review-fixes, hm2-gated, fs1-mediums, rv7-gated, ck-correct-fixes (#225's review), #234's mediums, then the habit moment. The last three track 1 sessions filled up before merging much; this one is told to merge each branch before the next.
  - **Track 2** session_012kbr8yX1yx6BkMYiJ6F5Dr (fresh 22:05): GE10's four review mediums, U31's extra step, the two-sided range (migration first), GE10's follow-up. U4 was fixed in #251; GE10 (#270) and ST1 (#285) merged. First download 264.7 of 265 KB.
  - **Track 3** session_012kbr937S18WZrjrr2frmGt: the reviewer's four mediums on #257/#248 (handover item 0, #276), then IM6 part 2, IM8, lows.
  - **Track 4** session_012kbr8xdoEbLiMQaBAxLeuJ: #193's mediums, AX5 part 2, FT2, FT1, SW1, SW2, AX2, AX6. Not heard from since. Track 6's goals and store contracts wait on its AX5 part 2.
  - **Track 6** session_012kbr8xPz321Wt3jtU1oocA (fresh 22:05): gap 7, then 8 and 9 (gap 5 merged as #283, #284), or gap 1(b) first if track 4's store change has merged.
  - **Track 7b** session_012kbr92c7taPQJmK4jDJU9E: the reviewer's #242 and #249 mediums, MT1, MT2, MT3, MS, MI, GR, MQ, then BL and GB after GE10, TG, then WM.
  - **Journey triage** (Sonnet): done (#279: U59, U61, U65, U117 at 10/10). U12 and P9 (shell) sent to track 4, U31 to track 2; U29 at 8.3 in the full suite is unlooked-at.
  - **Track 5b** session_012kbr911Du8PPXJLDueSVE5: done (#247, #252, #258). **Reviewer** session_012kbr8y4Bh3MudNC1bdo3RN.
- **Merged since 18:30:** #237, #240, #272 (handovers); #239, #242, #249, #244, #259, #271 (track 7); #247, #252, #258 (track 5b); #248, #257 (track 3); #235, #245, #253, #263, #268, #275 (track 6); #169, #225, #171, #234, #255, #261 (track 1); #266 (main fix).
- **Main went red once** (20:22): #263 and #257 merged 30 s apart and left `spec/core/help-guide.md` stale. #266 regenerated it. After a burst of merges, `npm run spec` on main should say "already current".
- **Decided by Lane tonight** (also in the 18:30 section): MARGIN_KB kept; NR's questions as recommended (NR not picked); track 7 builds all its rows plus MT1–MT3; WM built with the set-up token rules (anyone, 24 h or 3 workspaces, issued token revoked with it, set-up ends at week one); Candy shop data is made up.
- **Waiting for Lane:**
  1. **Branch protection on main.** "Allow auto-merge" is on, but GitHub refuses it with "Protected branch rules not configured for this branch". Settings → Branches → Add rule for `main`: require "Smoke: typecheck, tests and core journeys" and up-to-date branches. Until then, tracks merge by hand on green.
  2. **A Fable design session:** Lane asked for one; what it should design is still to come.
  3. Backlog AD (#227 medium 3, admin import doors keyed on `via`) waits for a pick.
  4. Optional: build api/mcp.js in CI. Recommended: leave it.
- **Prompt for the next planning session:** "You are Faro's planning session. Check out main, read CLAUDE.md, the top section of docs/handover.md ('Planning state, Thursday 12 November, 21:55 UTC') and docs/backlog.md. Get your session ID with get_session and send_message every open session listed there: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Then read reports with ReadNotifications; when a track hands over, start a fresh session from its handover prompt; relay the reviewer's findings to the owning track; fix anything that breaks main at once; put Lane's ideas in the backlog; ask Lane the 'Waiting for Lane' items still open, in one batch of multiple-choice questions, recommended answer first. Stay quiet otherwise. Hand over at about half full."

## Track 1, Friday 13 November, 02:00 UTC (session past half, handing over; supersedes the 00:30 entry)

Session: session_012kbr8zenZxEHT6rv4yLzHG. **Merged:** #313 (`fs1-mediums`). #322 (`rv7-gated`: RV7, who may speak for a review; gate fixes: `removal.test.ts` has Rhea speak for a review Rhea is in, `REVIEW-SPEAK` tagged copy; **and the `undoElsewhere` flake, fixed**: test files share workers (`isolate: false`), and `invitation.test.tsx` left the jsdom address at `/join/ws_nope`, so `undoElsewhere` run next in that worker read an invitation to a missing workspace and opened nothing; the invitation test now puts the address back after each test. Reproduce a suspected leak with `npx vitest run <a> <b> --no-file-parallelism`).

| Branch | State | PR |
|---|---|---|
| `ck-correct-fixes` | #225's review, main merged in. Gate fixes: MCP's `post_check_in` had no `reason` though its refusal asked for one (added, with a test in `mcp.test.ts`); the check-in walkthrough's number step ended at once on a correction (its verdict shows prefilled), so the verdict carries `data-same` until the number changes and the tour waits for `.verdict:not([data-same])`; U35 fills "Why are you correcting this check-in?"; READABLE-IDS gives `reason`. **Bundle:** main is 264.74 of the 265 KB first download; the branch made it 265.02, so the reason's helpers moved to their own module, correctReason.ts on that branch (out of `checkin.ts`, which `actions.ts` loads first). Second `evals:changed`: U31, U35, READABLE-IDS and every F/N/P check pass; U38, U40, U53 timed out in the run (a build ran under it) and pass alone. **Blocked on the bundle again (02:30):** main grew to 264.76 KB and the branch, merged with it, is 265.06, over 265. Shortening its What's new entry changed nothing; the growth is spread over actions (+103 B), index (+68), removal (+43), state (+34), app (+30), store (+23), home (+20). Find what the branch adds to the first download (build both with `--minify false` and diff), or lazy-load something eager; never raise the budget. CI's smoke fails until then | #326 |
| `import-formclose` | Planning's regression from #282: Import had no way out on a phone; FormClose "Close without saving" to Data, U72 checks it. Typecheck passes; **unit tests and `evals:changed` not run yet** | #328 |

**Next, in order (planning, 13 Nov 01:49):** merge #328 and #326; then #234's mediums (the 21:40 entry); then the build reviewer's other mediums (the 11 Nov build-reviews file on branch `build-reviews`): #282 `/metrics/new` is in focus mode but `isForm` doesn't count it; #310 on a phone an ask's waiting time is cut off with an ellipsis; #310 an ask's day is read in UTC but today in the viewer's zone ("Asked yesterday" for a recent ask); #310 Home's "late" and MCP's "overdue" disagree, and `get_my_work` gives no waiting time or order; #305 `missedReviews` has no ended-cycle test ("Not held yet" after the year ends); #305 U2's fold fails on 5 of 70 person-days (the check runs only on the default day). **With the #310 mediums, Lane's decision (13 Nov):** when a goal's owner changes, its open asks move to the new owner, who sees them on Home with "Asked of <old owner>, now yours", and the asker is told; answered asks stay. One rule in the domain, used by the app, the import and MCP, with a test and the spec words. Then the habit moment, N12's Find timing, #110's lows, HM1's lows and the lows batch (21:40 entry).

**Habits, learned this session:**
- The merge helpers (scratchpad, gone with the container): `wn.cjs` rebuilds What's new as main's file with the branch's own entries on top, **and moves an own entry's date up to main's newest** (guide.test fails on an older date above a newer one); `mm.sh` takes main's `api/mcp.js`, `evals/report.md`, `spec`, `llms.txt`; `fin.sh` runs `build:mcp` (`grep -c home/user` 0), `npm run spec`, commits "Merge main [no news]", typechecks.
- `api/mcp.js` bundles What's new: any edit to it needs `npm run build:mcp` again, or CI's smoke fails.
- Run `npm test` after every main merge before pushing: a branch can break an older test only once main's tests meet it (RV7 and `removal.test.ts`).
- The bundle budget is at its edge: check `npx vite build --manifest && node scripts/check-bundle.mjs` on anything that touches `src/domain` or `src/app`; never raise the budget.
- Don't edit or build in a worktree while an eval runs there.
- Draft PRs can't be merged: `update_pull_request draft:false` first.

## Track 1, Friday 13 November, 00:30 UTC (session past half, handing over; supersedes the 12 Nov 21:40 entry)

Session: session_012kbr91yMK3mzwj4mayoAJr. **Merged:** #310 (HM2: asks say how long they have waited). #274 (GL2's review fixes, with F6's fix: the Map's search box compared an emptied search with the address it had last seen, so emptied just after Enter it wrote nothing; `SearchBox` in `GoalFilters.tsx` now compares with what it has sent). #282 (NV2: forms close in words, Back finds your list). #305 (`hm1-review-fixes`: HM1's five mediums, plus gate fixes: `nextReviews` takes `Pick<Snapshot, 'reviews'>` for the layers lint; N26 knows "N asks wait for your response."; on a phone Home's blocks sit 16px apart and the hero's button 4px under its line, so U2's first attention card stays above the fold now the lead's line wraps; the button row's inline 8px margin moved into `home-watching.css`).

| Branch | State | PR |
|---|---|---|
| `hm2-gated` | **Merged as #310** at 00:20 UTC. Its gate fix: F1 (Home's response items 168px, limit 152; the meta line said the asked day twice, so with a "Waiting since" line the asked part drops "on {day}"). U47 failed once in the full run and passes alone, here and on main | #310 merged |
| `fs1-mediums`, `rv7-gated` | main merged in at 22:20 UTC, typecheck passes, pushed; not evaluated | none |
| `ck-correct-fixes` | as the 21:40 entry: `npm run spec` again, `evals:changed`; expect the `CheckInFlow.tsx` conflict with NV2's FormClose, now on main | none |

**Next, in order:** `fs1-mediums`; `rv7-gated`; `ck-correct-fixes`; #234's mediums; then the habit moment, N12's Find timing, #110's lows, HM1's lows, with the lows batch (the 21:40 entry has the details of each).

**Habits, learned this session:**
- Main moves every few minutes and nearly every merge conflicts in What's new: merge main, push, and merge the PR the moment CI is green, after `git merge-tree --write-tree HEAD origin/main` says clean and `comm -12` of the two sides' changed files shows no overlap but generated files. `enable_pr_auto_merge` refuses ("Protected branch rules not configured"): merge by hand with the full 40-character head SHA.
- The merge helper (scratchpad, gone with the container): `wn.cjs` rebuilds What's new as main's file with the branch's own entries on top; `mm.sh` then takes main's `api/mcp.js` and `evals/report.md`, runs `build:mcp` (checks `grep -c home/user` is 0) and `npm run spec`, `git add -A`, commits "Merge main [no news]", typechecks. Keep `evals/report.md` out of commits: an eval run rewrites it.
- One worktree per branch (`git worktree add /home/user/wt-X -B X origin/X`, `cp -al node_modules`), so merges run while an eval runs elsewhere.
- Every eval run goes to a subagent that reports only the scorecard and failures; a full `evals:changed` takes ~18 minutes and runs the full suite whenever shared code is touched.
- `src/app/undoElsewhere.test.tsx` is flaky (1 in 3 local runs, once in CI); it passed on a re-run. Not fixed.
- Scores below 10 that aren't track 1's: U12 8.8 (demo controls below the fold on desktop), U29 8.3 (the import walkthrough's first step on a phone), U46 9 (export: two primaries), U31 9, U69 8.9 once.

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
## Track 3 (import), 12 Nov, 21:20 UTC: handover after IM6 part 2

The track 3 session that built IM6 part 2 is at half its context. A fresh track 3 session picks up here; the 19:40 section below still holds the open review findings word for word.

**Done in that session**
- **#277, IM6 part 2** (merges on green; check it did). A file of more than `CHUNK` (500, `src/domain/importLimits.ts`) rows is checked in `src/modules/spreadsheets/worker.ts`; `planChangesInChunks` (the engine as a generator, progress every 500 rows) feeds the Reading panel (`Large.tsx`: after 400 ms, progress, "So far: …", Stop). The run is kept in `importStore.run` and started by `checkRun.ts` `startCheck`; `useImportPlan` checks small files at once as before, so small-file journeys are unchanged. The input comes from `app.changeInput`; the worker gets plain data (`workerInput.ts`) and replies in slices of 2,000 rows. Over `CHANGES_SAVE_MAX`: 2.8's block, and `splitTables` (`src/domain/splitFile.ts`) makes the parts. The new journey is **U98** (U92 and U97 were taken); **N18** is `evals/finish/19-import-large.cjs`; there is a new internal requirement page, **R11** (R-L1 to R-L6); `IMPORT-LARGE`; What's new `import-large`.

**Next, in this order**
0. **The build reviewer's findings on #257 and #248**: item 0 of the 19:40 section below, as one PR, before anything else. The four mediums are a speed test whose copied goals repeat keys and titles; a new goal row with Action Stop or Delete crashing the check; a filtered All tab exported as "all"; and Export's Everything counts differing from the workbook. IM6 part 2 went ahead of it because it was already under way.
1. **IM8** (spec 2.3 create mode; `docs/design/setup/spec.md` U99 and `SETUP-UPLOAD`): set-up's upload (`src/screens/Onboarding.tsx`, which uses `domain/importer.ts` in create mode) shows the import preview's groups: "Add {person}" for an owner the People sheet lacks, and the stage question defaulting to "Count them from this week". It needs U92's second half as its own journey (take the next free number: 99 to 108 are free) and `SETUP-UPLOAD` in `evals/requirements.json`. Onboarding is the set-up track's area too, so check no build is open on it first.
2. **The IM3 findings and the IM4/IM5 lows**, and the lows under item 0, as listed in the 19:40 section below.

**Gotchas (new)**
- `npm test` run while an eval run is going times out on six slow files (5 s limits); re-run them alone.
- Long tasks in evals: start the `PerformanceObserver` after `setInputFiles`, because Playwright's own injection of a big file is a 200 ms+ task.
- `git add -A` during a merge commits conflict markers: resolve `src/help/whatsNew.ts` (keep both entries, and check each one's closing `},`) before adding.

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

## Track 2 (one goal, goal entry, set-up), Friday 13 November, ~02:50 UTC (session at half, handing over; supersedes the 01:10 entry)

Session: session_012kbr8zJcP8xenTkLS4rV4P. Planning is session_012kbr939zneZWtAo7UQEHRP.

| Branch | State | PR |
|---|---|---|
| `range-review-fixes` | #300's review (three mediums, the lows) and #293's low. **Merged as #331** at 02:27 UTC by auto-merge | #331 merged |
| `ge10-home-proposals` | GE10 (F), Home's two proposal rows, plus `screens/savedViews.ts` (useViews/viewParams out of GoalFilters: first download 261.4 of 265 KB, real app 320.4 of 324). Gate passed; ready, **auto-merge on** since 02:49 | #319 |

**Next, in order** (after #319 merges; if it hasn't, read its checks first):
1. The rest of GE10 (F), one PR each where they're big: Home's lead for a for-you proposal (the Home spec's `ask` rule) and "in {review}" in its line; "Make it proposed again" (`backToProposed` is built, no action); Map and Board with the filter; the metric page's "Proposed · n"; Reviews' "Propose a new goal" and "Last time"; changing the type while proposed; "Stopped" in the State filter; `for-someone-else` for files and tools; what feeds it; the start-year count.

**Habits, learned this session:**
- Merging: planning's branch rule (02:10). When the gate passes and the PR is ready, call `enable_pr_auto_merge` (MERGE) and move on. If main moves first, merge main in, rebuild `api/mcp.js` and the spec, and push.
- Measure the budget with `npx vite build --manifest` then `node scripts/check-bundle.mjs`. It has two budgets: the first download (265) and the real app's (324). Both were within 0.1 KB of their limit before #319; #319 frees about 3.6 KB.
- Find what a chunk holds from a `--sourcemap` build's `.js.map` sources; it is quicker than guessing.
- Main's full suite is red on F8 ("toast in sheet 390", Export from the View sheet on a phone; issues #330, #332, #338). This is not track 2's. Don't chase it from a feature branch.
- `src/help/whatsNew.ts` conflicts on every merge of main: keep both entries, ours first.

**Prompt for the next track 2 session:** "You are track 2 of Faro's build (goal entry and set-up). Read CLAUDE.md, then the track 2 section of docs/handover.md ('Track 2 … Friday 13 November, ~02:50 UTC') and do its 'Next' list in order, one PR each. Check #319 first: if it hasn't merged, fix what blocks it. The first download is about 261 of 265 KB (real app 320 of 324): keep anything new lazy; never raise budgets. Track 3 is building IM8 in Onboarding.tsx's upload step: stay out of it. Follow CLAUDE.md's gate (typecheck, npm test, npm run spec, evals:changed, build:mcp from a real node_modules via cp -al, never ln -s). Build in a worktree, send eval runs to a subagent that returns only the scorecard, check mergeable_state, then enable auto-merge (MERGE) once the gate passes. Report to the planning session (session_012kbr939zneZWtAo7UQEHRP, or whichever session tells you planning has moved) once, when done or blocked. At half context, write a handover entry in a PR and send the planning session the next prompt."

## Track 2 (one goal, goal entry, set-up), Friday 13 November, ~01:10 UTC (session at half, handing over; supersedes the 12 Nov 23:10 entry)

Session: session_012kbr8z3ACYiinbB3TbXmPk. Planning is session_012kbr939zneZWtAo7UQEHRP.

| Branch | State | PR |
|---|---|---|
| `st1-mediums` | **Merged as #318** at 01:15 UTC. U82, N1 and N12 passed alone on the branch and on main; P9 failed once more in a loaded run at another route and passed twice alone (the shell check with track 4) | #318 merged |
| `ge10-home-proposals` | GE10 (F), Home's two proposal rows. Typecheck, unit tests and spec pass; main merged in at 01:05; **`evals:changed` not run** (U134 has new checks) | #319 (draft) |

**Next, in order:**
1. **#300's review fixes** (planning, 00:37): full text on the `build-reviews` branch (the 11 Nov build reviews file), section "#300". Mediums, all from `rangeSide` (the nearer bound) used where both bounds matter: (1) "Will it stay within?" judges only the nearer bound (`scorecard.ts` ~171): judge the worse of the two; (2) a number moving back towards the middle reads "Getting worse" (`trend.ts` ~101, scorecard's since cell, `attention.ts` ~79): room = min(v − lower, upper − v), no floating-point midpoint; (3) on a narrow band the chart's two limit labels overlap (`rangeChart.tsx`: pad by a share of the band, Lower label under its line). Lows: two numbers in Limit override Must stay "at most" without a question; wording names only the nearer bound (`year.ts` ~123, "Inside the 99.50% limit"); add a journey or finish check for the between form, page and chart; a between row read through the public fallback becomes "at most". Fold in #293's low: comments say a past stage "is asked when it is made active", but `activate` asks nothing.
2. #319: `evals:changed`, then merge. Then the rest of GE10 (F), as the 12 Nov 23:10 entry lists it, plus Home's lead for a for-you proposal (the Home spec's `ask` rule) and "in {review}" in its line.

**Habits, learned this session:**
- The first download on main is **263.4 KB** of 265, not 259.4: other tracks have grown it. #319 adds 0.5 KB. Measure by building and summing gzip of what `dist/index.html` preloads; keep new markup lazy.
- The main checkout had no `node_modules`: `npm ci` there once, then `cp -al` into each worktree.
- Don't merge main into a worktree while an eval subagent runs in it.
- `evals:changed` on anything touching `App.tsx`, `ChangeItem` or `Home.tsx` runs the full suite (~18 minutes).
- U97 now calls `designProblems(page)`, P6's test lifted into a function in `evals/journeys.cjs`, for pages P6 can't reach (the arrival needs the browser store).

**Prompt for the next track 2 session:** "You are track 2 of Faro's build (goal entry and set-up). Read CLAUDE.md, then the track 2 section of docs/handover.md ('Track 2 … Friday 13 November, ~01:10 UTC') and do its 'Next' list in order, one PR each. The first download is about 264 of 265 KB: keep anything new lazy; never raise budgets. Track 3 is building IM8 in Onboarding.tsx's upload step: stay out of it. Follow CLAUDE.md's gate (typecheck, npm test, npm run spec, evals:changed, build:mcp from a real node_modules via cp -al, never ln -s). Build in a worktree, send eval runs to a subagent that returns only the scorecard, check mergeable_state before waiting on CI, and merge by hand on green with merge commits. Report to the planning session (session_012kbr939zneZWtAo7UQEHRP, or whichever session tells you planning has moved) once, when done or blocked. At half context, write a handover entry in a PR and send the planning session the next prompt."

## Track 2 (one goal, goal entry, set-up), Thursday 12 November, ~23:10 UTC (session past half full, handing over)

Session: session_012kbr8yX1yx6BkMYiJ6F5Dr. Each build ran in a subagent in its own worktree (`git worktree add`, then `cp -al node_modules`), and each eval run went to a subagent that returned only the scorecard. Merges used **merge commits**. Planning is session_012kbr939zneZWtAo7UQEHRP.

- **Merged:**
  - #293, GE10's four review mediums:
    - no set-up check-in, and no stage question, when proposing (`ChecksContext.proposing`);
    - `leaving()` reads `withProposed`;
    - the Home line was dropped from `afterProposing`;
    - `activate` asks `from-past` itself (`make_goal_active` takes `confirm`) and refuses a From outside week 0 to the plan's To.
  - #292, migration 0042: `range_bound` may be `between`, with `range_lower` below `range_limit`; applied by CI. Its limits row was added by #295 from another session.
  - #300, the two-sided range code: `range.ts`, `staysText`, between in goal entry, import/export, the MCP tools and the docs. The first download is 259.4 of 265 KB.
- **U31 (20 steps against a budget of 19):** settled by planning (23:15): goal entry stays as it is. It was 18 before OB1 (#129), whose "who and where" step and rule 1's level choice for a lead (Mateo) add Level: Team and Continue, by design. U31 still scores 9 for its budget.
- **Next:** GE10's follow-up (F), from #270's body:
  - Home's two proposal rows (`proposalAsks`; needs seen and put-off state). Once built, restore the read-back line "{Owner} sees it on their Home as a proposal for them".
  - "Make it proposed again" (`backToProposed` is built; it has no action).
  - Map and Board with the filter.
  - The metric page's "Proposed · n".
  - Reviews' "Propose a new goal" and "Last time".
  - Changing the type while proposed.
  - "Stopped" in the State filter.
  - `for-someone-else` for files and tools.
  - What feeds it.
  - The start-year count.
  - The `stoppedAt` lint (about 25 reads).
  - New from #293: "Make it active" could ask which past stages are done and save them as the first check-in; today they are marked at the first check-in.
  - The review's lows: `ask_for_update` on a proposed goal; two primary buttons with "Make it active" open; 22 px buttons; "Rhea see"; the scope rule written twice; no MCP test of `make_goal_active` beyond #293's.
- **Habits:**
  - The first download is 259.4 of 265 KB (#300 moved `RangeChart` out): keep new code lazy.
  - `evals/touches.cjs` has no rule for `src/domain/proposedActions.ts` or `src/domain/range.ts`, so `evals:changed` runs the full suite (about 17 minutes).
  - A finish check runs alone with `FINISH=N12`, not `ONLY=`.
  - `enable_pr_auto_merge` still refuses (no branch protection), so merge by hand.
  - CI's vitest sometimes fails one timing test under load (`importSpeed`, `undoElsewhere`); they pass alone. One re-run each.

## Track 2 (one goal, goal entry, set-up), Thursday 12 November, ~20:30 UTC (session past half full, handing over)

Session: session_012kbr8zF82vbVLvoqfYaQad. It ran each item through one subagent at a time in the main checkout from a common brief, merged main into its PRs in worktrees, and merged with **merge commits**. Planning is now session_012kbr939zneZWtAo7UQEHRP: report there once, finished results and blockers only.

- **Merged:** GE10's migration 0041 (#221: `proposed_at`, `proposed_by`, column grants to anon; applied by CI); GE9's review mediums (#220: `pair` with a blank Due week, a bare number under From asked about, `WeekPick` on mousemove, `defaultTo`, short cycles by ISO week, three lows); GE3's review mediums (#228: `goal-read-back` class and F3's row width, the metric worked out from the draft through `goal.measure`'s new `quiet` prop, the slice follows the team, the delete wording, U145); U93's phone fix (#241: `src/ui/questionInView.ts`); U4's check (#251: it waits for the page's lasting "… is published." line).
- **Open:**
  - GE10's follow-up (F), from #270's body: Home's two proposal rows (`proposalAsks` exists, no seen/put-off state stored yet), "Make it proposed again" (`backToProposed` built, no action), Map/Board with the filter, the metric page's "Proposed · n", reviews' "Propose a new goal" and "Last time", type change while proposed, "Stopped" in the State filter, `for-someone-else` for files and tools, What feeds it, the start-year count, the `stoppedAt` lint (about 25 reads).
  - `u93-review` (this PR): #241's build-review mediums (no see-saw: the field kept at least scroll-padding-top from the top, a question scrolled into view once per showing; the fold from `visualViewport`) and one low (set-up's Continue focuses a goal card's question). Its evals (U93, U5) run before merge.
  - #285, ST1 (`/welcome`, `/join/<id>`, `inviteLink` now `/join/`, the arrival logged once, U97): green locally after merging main (1452 tests; U97, U11, U54, U134, U5 at 10; U46 at 9 as on main). Bundle 264.67 of 265 KB: almost nothing left, so the range work must lazy-load. Left for ST3, ST7, ST8.
  - GE10's code merged as #270.
- **Next:** the two-sided range (Lane, 12 Nov: build it). Today a range is one bound and one limit everywhere (`RangePlan {bound, limit, margin}`; columns `range_bound` with check `in ('atMost','atLeast')`, `range_limit`, `range_margin`; a table check needs all three for kind `range`). A two-sided range needs a migration first, on its own PR one merge ahead: e.g. widen the `range_bound` check to allow `'between'` and add `range_lower numeric` (nullable; required when `between`, below `range_limit`), safe to run twice, faro only, full SQL in the PR. Then the rule and status in `src/domain` (near or over either bound; a one-sided range exactly as today), goal entry and the goal page, `columns.ts` (the import now refuses "99.5–99.95"), the MCP tools, and the rule's words and worked examples in `src/spec/rules.ts`.
- **Habits:** main moves every few minutes: merge main right before merging (`merge-main` steps: whatsNew both entries, ours on top; `api/mcp.js`, `llms.txt` and `spec/` taken from main then rebuilt; then `sed` the module paths to `// node_modules/` — in a worktree also `// ../goals-app/node_modules/`, or CI fails "api/mcp.js is out of date"). The repo's auto-merge setting is still off (enable_pr_auto_merge refuses), so merge by hand. vitest's fence and spec tests time out under an eval run's load; rerun them alone.

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

## Track 4, Friday 13 November, 02:15 UTC (handing over)

Session: session_012kbr8xdoEbLiMQaBAxLeuJ. Read this, then the 12 Nov 18:00 section below, which it updates.

- **Merged:**
  - #229, #193's four mediums (17d9495).
  - #323, AX5 part 2a: `load(ws, window?)`, `history(...)` and `Snapshot.history`, with the rules in `src/ports/window.ts` and three store contract cases (0d2e4a9).
  - No caller passes a window yet.
- **The build reviewer's batch on #323 and #229** (13 Nov 02:11; full text in the build-reviews log on branch `build-reviews`, PR #134). No high findings. **Fix mediums 1 and 2 of #323 before part 2b wires a window:**
  1. **#323, the rules read a narrow snapshot as whole.** This is high the day a window is wired. `goalHasCheckIns` (`removal.ts` ~246), `cycleStanding`/`deleteCycle` (~383–403), `personHistory` (~112) and others read `s.checkIns` as though it held every check-in. `history.checkInCycles` is written but nothing reads it.
     - Repro: a 2025 cycle with one goal and one check-in, then `load(ws, { from: 2026-06-01 })`. Deleting the goal and deleting the cycle are both allowed, and stopping the goal is wrongly refused.
     - Fix: those rules read `checkInCycles`, or refuse on a partial snapshot. Add a rule test.
  2. **#323, a partial snapshot can pass as whole.** `createWorkspace(copy, narrow)` stores `history`, so the copy calls itself partial for ever (`src/data/store.ts` ~298). The app keeps whichever load lands last.
     - Fix: strip `history` on write, and refuse or merge a partial snapshot.
  3. **#229, "one port per workspace" doesn't hold.** `portFor`'s key includes `columns`, and `useGoalColumns` builds a new object in each hook's own `useMemo`. One render with six goal hooks ran `goalRows` three times.
     - Fix: key the cache on inputs that don't change between hooks, or build `columns` inside the shared port. Add a test.
  - **Lows:**
    - The store contract has no case for saving from a partial snapshot, and none for the boundary.
    - Two comments in #323 ask for a (workspace_id, at) index, which has existed since migration 0003, so **part 2b needs no migration**.
    - Anchors are never trimmed, so the narrow log still grows.
    - The cycle-end formula is restated in SQL.
    - It hasn't been run against real PostgREST.
    - `saveGoal` with a module's `also` still fails silently when the engine can't load (`state.tsx` ~768).
    - There are no unit tests for the port sharing or for the toast's branches.
- **Next, in order:**
  1. One PR for the three mediums above.
  2. The two shell faults (below).
  3. AX5 part 2b: Activity, a goal's History and MCP `get_activity` page with `history`, and the app loads with a window.
  4. FT2, FT1, SW1, SW2.
  5. AX2.
  6. AX6.
- **Track 6** was told `storeContract` can be converted (via planning, session_012kbr939zneZWtAo7UQEHRP).

## Track 4, Thursday 12 November, 18:00 UTC (session past half full, handing over)

Session: session_012kbr8xdoEbLiMQaBAxLeuJ.

- **#229, #193's four review mediums** (open as a draft when this was written; merge it on green CI if it hasn't merged, and report the merge to planning, now session_012kbr939zneZWtAo7UQEHRP: finished results and blockers only):
  1. **A failed engine load says so.** `run` in `src/app/state.tsx` toasts `ENGINE_OFFLINE` (offline, #183's words) or reloads once through `recoverFromStaleCode`. When it has just reloaded, it offers Reload (`ENGINE_FAILED`). Chromium keeps a module that failed to load, so a reload is the only real retry. N8 (`evals/notes/8-telemetry.cjs`) has the case.
  2. **Home asks for `sort: 'worst'`.**
  3. **The query port names scopes.** `GoalAsk.scope` is `'mine' | 'team' | 'watching' | 'all' | 'team:<id>'`, answered by `scopeIds` in `domain/goalsPage.ts` with `scopeFacts` from `app/reads.ts`. With no sort, a list comes worst first, then by title (`localGoals.ts`). `goals.csv` and the contract follow.
  4. **One port per loaded workspace** (`portFor` in `src/app/goals.ts`).
  - Its eval run: everything passed except U4 (8.9), which is main's own failure (#226: "publishing is not confirmed", after #208's publish change). That belongs to track 2 and planning, not track 4.
- **Track 6** converts `goalsContract` to given/when/then data after #229 merges. Its session session_012kbr8xR9jB8yU52qz82Gah handed over at 17:57; a fresh track 6 session works from the track 6 handover page on branch `kt-changes`, which records AX5 part 2's shape. Send "merged" notes (#229, and AX5 part 2 later) to whichever track 6 session planning starts: ask planning for its id. A windowed load and `history` paging fit their format as multi-step cases. They have AX5 part 2's planned Store shape (below) and are leaving `storeContract` alone until it merges.
- **#193's lows, still open:**
  - keyset paging restarts from the top when the `after` goal has gone;
  - `engine.test.ts`'s import pattern misses `import *`, re-exports and imports split over several lines;
  - on a near miss, `counts().attention` disagrees with its list;
  - `attentionCount` in `goalsPage.ts` has no caller;
  - `goals.csv` is written by the adapter it tests.
- **Next: AX5 part 2, the narrower load. The handover's "last few weeks of changes" is unsafe as written.** A survey (12 Nov, 17:40) found that comments are change-log entries (entity `note`), and that several rules read the log at any age:
  - `commentsOf` and `liveNotes`/`writtenNotes` (`removal.ts`, `asks.ts`), Recently removed and restore, and `personHistory`;
  - asks (legacy update-asks, "answered since");
  - `startOf`/`canUndoStart` (a cycle's "created" entry);
  - imports: `importEntry`/`undoImport`/`canUndoImport` and the past-imports lists;
  - `sinceLooked`, and Metrics "Last changed";
  - MCP `get_activity` (`src/mcp/workTools.ts`), which filters every change with no cursor.

  The safe parts:
  - **Check-ins:** `scopeToCycle` already keeps only the current cycle's. The wrap-up (`wrapUpScope`) and `recarry` need last year's while its wrap-up is open, which is 4 weeks after the year ends. `cycleStanding`, `canUndoStart` and `copyUntouched` only ask whether a cycle has any check-in.
  - **Activity and goal History:** both slice a list that is already fully in memory, with no paging. Supabase `all()` already pages by id.

  **The planned shape** (sent to track 6):
  - `load(ws, window?)`. With no window, the whole workspace, as now. With `{ from }`, two things are narrowed:
    - check-ins only from cycles that overlap `from` onwards;
    - changes with `at >= from`, plus anchors of any age: entity `note`, `request` and `cycle`, and import summaries (`imported`/`undone`, or carrying `undo`).
  - `Snapshot.history?: { from, checkInCycles }` says what was left out.
  - `history(ws, { before?: {at, id}, goalId?, size <= 100 })` gives older entries newest first, keyset by (at, id). Activity, History and `get_activity` page with it.
  - Three new contract cases: a windowed load drops the right rows and keeps the anchors; `history` pages with no skips or repeats and narrows by goal; a load with no window is whole.
  - Implement it in the browser, Supabase and Postgres stores, plus `server/mcp.ts`. Supabase probably needs an index on `(workspace_id, at)`: a migration, shipped one merge ahead of the code (AX10).
  - Size: M to L. Consider splitting: (a) the window and `history` in the port, the contract and the stores; (b) Activity, History and `get_activity` paging.
- **Before AX5 part 2, two shared-shell faults from planning (22:05; one PR is fine):**
  1. **U12, desktop only.** At 1440×900 the sidebar's Demo box (`.demo-entry`) ends at y=913, 13 px past the fold: the sidebar has grown (`src/styles.css` `.side`, `src/ui/Demo.tsx`).
  2. **P9 EVERY-WIDTH, in the full suite.** It fails with "1280px rhea /: no navigation" (Home has no navigation at 1280). Track 1 owns Home: tell it if the cause is Home's.
- **Merging:** auto-merge can't be turned on, because main has no branch protection rules. `enable_pr_auto_merge` says "Protected branch rules not configured". Merge by hand on green CI. Main moves every few minutes, so merge main in, push, and merge as soon as CI (about 5 minutes) is green.
- **Then, in order:**
  1. FT2, FT1, SW1, SW2.
  2. AX2.
  3. AX6.
- **Traps:**
  - Gate: `npm run typecheck`, `npm test`, `npm run lint:layers`, `npm run evals:changed` (anything in `src/app/state.tsx` runs the full suite, about 15 minutes), and `npm run spec` committed.
  - After `npm run build:mcp`, run `sed -i 's#^// \(\.\./\)*home/user/goals-app/node_modules/#// node_modules/#' api/mcp.js`.
  - The evals exit 1 while U1 to U5 aren't all 10; U4 is red on main.
  - `src/docPaths.test.ts` fails a hand-written page that names a file that doesn't exist, including in the handover.
  - A domain rule may not take a `Snapshot` (lint:layers); build facts in `src/app/reads.ts`.

## Track 4, Thursday 12 November, 16:40 UTC (session past half full, handing over)

- **Merged:** #193, which is AX5 part 1 plus the fix for the first download.
  - **The query port:** `Goals` in `src/ports/goals.ts`, with `goals()`, `counts()` and `goal()`. Paging is by key, at most 50 rows a page. List rows carry no check-ins.
  - **Its adapter:** `src/adapters/localGoals.ts`, which can also answer at once (`now`) so no screen draws empty first. The app reads it through `src/app/goals.ts` (`useGoalList`, `useGoalCounts`).
  - **Its contract:** `goalsContract` in `src/ports/contracts/goals.ts`. Its cases are `spec/conformance/goals.csv`, which the drill scores when asked (`"also": ["goals"]`).
  - **Who reads it:** Home (your goals, now worst first, and the week-at-a-glance counts) and Goals (the filtered list, the near miss and the switch count).
  - **`Store`:** now in `src/ports/store.ts`. The example plumbing is `ExampleStore` and `examplesOf` in `src/data/store.ts`, and only the browser store has it.
  - **The first download:** 293 to 263 KB, and the real app's 350 to 321. The budgets are 262 + `MARGIN_KB` and 321 + `MARGIN_KB`, where `MARGIN_KB` is 3 (Lane, 12 Nov: the size measured that day plus 3 KB).
    - The change engine (`domain/changeset`) loads on its own: `loadEngine` and `ready` in `src/app/actions.ts`.
    - Screens that preview changes while they render import `src/app/engineReady.ts`. U45 caught Quick check-in previewing before the engine was there.
    - Small names that pulled the engine in live in `src/domain/via.ts`. `src/app/engine.test.ts` lists who may import the engine at run time.
    - Help's index in the first download holds only the newest What's new release. Every release's title is in `virtual:faro-news-index` (`src/help/newsIndex.ts`), and `lookup.test.ts` guards this.
- **First, #193's build review** (reviewer session, 12 Nov 17:17; full text in draft PR #134 (the build-reviews log on branch `build-reviews`), section "#193"). No high findings: the port matches the old code across 1,742 viewer, scope and query combinations. Fix the mediums in one PR before anything else:
  1. **A failed engine load is silent.** When the change engine's chunk fails to load, Post check-in does nothing and says nothing, and the tab can't post until it is reloaded.
     - `run` awaits `ready(name)` with no toast (`src/app/state.tsx`, about line 593).
     - `CheckInFlow.tsx`'s catch (about lines 352–355) only re-enables the button.
     - Chromium keeps the failed module, so a second `import()` in `loadEngine` never fetches it again.
     - Fix: toast the failure, in the offline words when offline; reset `engine` so the next try fetches afresh, or reload once via `staleCode`; add a journey.
  2. **Home's order isn't what we told people.** What's new (`your-goals-worst-first`), the Home guide article and two comments say Home lists your goals worst first. `applyQuery` sorts only when `q.sort` is set (`src/domain/query.ts`, about line 212), and Home asks with none: 13 of 29 owners with several goals don't see worst first. Fix: ask with `sort: 'worst'` in `useMineAsk` (`src/screens/Home.tsx`), so the words become true.
  3. **The port's default order and its scope aren't server-shaped.** With no sort, rows come in the workspace array's order, and `goals.csv` pins that order. Scope travels as `among`, a list of every goal's id. A server could answer neither. Give the default order a rule (worst first, then by title), and name scopes in the ask (`scope: 'mine' | 'team:<id>' | 'watching'`) instead of sending ids.
  4. **Summaries are worked out two or three times per change.** Each hook makes its own port (`src/app/goals.ts`, lines 12–19), so Home and Goals run `summariseAll` two or three times: about 550 ms on Home at ten times the demo's size, against 20 ms before. Make one port per snapshot (a context, or a memo keyed on the snapshot).
  - **Lows:**
    - Keyset paging restarts from the top when the `after` goal has gone (`localGoals.ts`, about line 33).
    - `engine.test.ts`'s pattern misses `import * as`, re-exports, double quotes and imports split over several lines. The bundle budget is the real guard.
    - On a near miss, `counts().attention` disagrees with its own list.
    - `attentionCount` (`goalsPage.ts`) has no caller now.
    - No journey came with the change, and `goals.csv` is written by the adapter it tests.
- **Next, in order:**
  1. **AX5 part 2, the narrower load.** The load takes only the current cycle's check-ins and the last few weeks of changes; Activity and a goal's History fetch older pages.
     - Watch what reads the change log beyond Activity and History: `creatorOf` (Getting started), undo, the wrap-up of last year while it stays open, and `statusChange`.
     - Tell track 6 (session_012kbr8xR9jB8yU52qz82Gah) before `storeContract` changes. Track 6 is turning the port contracts into data (given, when, then) in a new `cases` folder beside the contracts, and will convert `goalsContract` to that format too.
  2. FT2, then FT1, SW1 and SW2 (`docs/design/feature-toggles/`, `docs/design/feature-switches/`).
  3. AX2: a test that nothing on `AppState` reaches `commit` except through `run`, and `applyChanges` sending its input again with `apply`. Check that `postCheckIn` is in the action table (it is, and it now waits for the change engine to load).
  4. AX6.
- **Still left from the reviews:** the workspace switcher on the "can't open … yet" page (`CantOpenYet` in `src/screens/Start.tsx`).
- **Traps:**
  - Main moves fast, and a conflicted PR gets no CI at all. Merge main in, then rerun `build:mcp` and `spec`. Take What's new from main and add your entry back.
  - `docs/glossary.md` names the file that keeps each word on purpose. Moving such a word between files fails CONSISTENT-WORDS.
  - `evals/report.md` is rewritten by every local run. Discard it rather than commit it.
  - Under local load, N6 and `src/data/fence.test.ts` failed once; each passes when run alone.

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
