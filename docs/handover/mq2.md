# MQ2, Metric quality: build handover

Lane approved MQ2 on 15 Nov. The decisions are in the MQ2 row of `docs/backlog.md` and in `docs/design/mq2/` (README, sketches 1–13, journeys 1–12; read them from branch `docs/mq2-journeys` until PR #561 merges). The latest decision wins.

## Done

- **Part 1: PR #563, merged 15 Nov.** Migration 0056 adds, on `faro.okr_metrics`: `calculation`, `time_window`, `source_link`, `source_query`, `source_owner_id`, `refresh_note`, `calc_changed_by` / `calc_changed_at`, `baselines`, `verification`, `verify_attempts`, `lapse`, `verifiers`, `handover` and `to_confirm`. On `faro.okr_goals` it adds `check_in_rhythm` (`monthly`, `quarterly` or null). CI applied it.
- **Part 2: PR #564, merged 15 Nov.** The rules and MCP for:
  - the stage, the ten Defined parts, lapsing and confirming a rewording;
  - verifying, including "Couldn't reproduce";
  - baselines per slice, flagging old-source baselines, and the source mark on goal charts;
  - the similar-metric check and "To sort out" reasons.

  Where things live:
  - `src/modules/metrics/rulesQuality.ts`: pure rules. `stageOf`, `definedMissing`, `qualityChanges`, `whyCantVerify`, baselines, `sortOutOf`, `similarMetrics`, `rhythmFor`.
  - `src/modules/metrics/rulesVerify.ts`: `verifyMetric`, `saveBaselines`, `confirmOwner`, `confirmReword`, `answerAttempt`.
  - `rules.ts` `qualityFrom` (inside `metricFrom`): sets `calcChangedBy`, lapses Verified, sets `toConfirm`, and flags old-source baselines on every save.
  - `rulesSave.ts` `lapseChecks`, and `rulesDefine.ts`: the checks `similar` and `lapse`.
  - `toolsQuality.ts`: the new tools `save_baselines` and `verify_metric`. `list_metrics` gains `stage`, `to_verify` and reasons in `sort_out`. `get_metric` and `save_metric` gain the stage before and after, and the structured fields.
  - The Metric's field is `timeWindow`. Not `window`: the layer check reads `.window` as browser code. The MCP parameter is still `window`.
  - The demo has the sketches' stages. Verified: cfr, deploys, mttr. Defined: lead time, CI time, queue wait, first review, cloud cost. Draft: the other five.
  - Already updated: spec rule `metric-quality` (rules 13–16), conformance rows `stage` and the three new `find` asks, requirements `METRIC-STAGE`, `METRIC-VERIFY` and `METRIC-BASELINES`, Help `metric-quality`, What's new `metric-quality`, README, architecture, handoff, the module map and the rebuild stage.
- **#564's review fixes.** The high (the form could not answer the `similar` and `lapse` checks): PR #566, auto-merge, journey U180 and a `[METRIC-BASELINES]` scenario. The two mediums (whoever reworded a Verified metric may not confirm it; only an admin names verifiers, in `saveMetric`) are on the part 3 branch.
- **Lazy module sheets: #568, merged 16 Nov.** `ModuleRecords.sheets` is a `ModuleSheetRef` per sheet (name, about, loaded, `load()`); `loadModuleSheets()` in `src/core/records.ts` loads the sheets, and every door that reads columns awaits it (the export from Goals, the Data menu, Import and MCP; `sheetHeadsFor`; `loadSheetPlanners`). Reading one before it loads throws. `personLeft` stays eager: it runs synchronously in the domain's leaving save (`departs`), and a lazy hook would make that save async for little gain. First download on main: 266 KB (was 274).
- **Part 3: #567, branch `claude/mq2-part3`, ready for review (no migration).** Measures 268 KB of 275 (about 7 KB left; part 4's screens must load lazily). Full `evals:changed` 220/220 with U83, U94 and U180 at 10; U180 now in the metrics journeys (review of #566).
  - A goal's own check-in rhythm, a core seam: `src/domain/goalRhythm.ts` and `Goal.checkInRhythm` (`monthly`, `quarterly` or empty = the cycle's). The due, run, habit and "No recent update" rules read it (62 days monthly, 184 quarterly). The metric library sets it through `rhythmChange` from `heldBy`/`heldByLink` on link, unlink, a refresh change and merge; `switched` clears it. Spec rule `goal-rhythm`; the module platform page lists the `goalRhythm` hook.
  - New `ModuleRecords` hook `personLeft(x, personId, toId)`, called by `departs()` through `whatPasses`. The core names the lead (`leadOf`); the library passes the person's metrics with `handover` set. `mark_person_left` lists them.
  - MCP: `link_goal_metric` returns `data.stage`, `data.draft` (heading, words, missing parts) for a Draft metric and `data.rhythm` when the goal's rhythm changes.
  - Metrics sheet: columns for What is measured, How aggregated, Counts, Filters, Leaves out, Numerator (with its filters and leaves out), Denominator (same three), Formula, Window and Source link (no worked Stage column: it would put the quality rules in the first download). The sheet compares a calculation by what it says (`said`/`canon` in `sheetPlan.ts`), so an export loaded back by a member changes nothing (U94). `SheetPlanResult.notes` (`src/domain/sheetPlan.ts`) lets a sheet say lines after the counts: stages after loading, similar metrics for new rows, each Draft's missing parts. `bulk_change`'s dry run prints them.

## Decisions taken at build (planning passed them to Lane; none challenged)

1. The stage is worked out, never stored.
2. A Gap metric can be Draft or Defined, never Verified.
3. MQ's `confidence` stays as "the owner's confidence" under Structure, never beside the stage.
4. "To verify" lists every Defined metric (never verified, or lapsed) plus any Verified one within 30 days of its 12 months.
5. A goal's rhythm is a goal column (`check_in_rhythm`), filled in from the metric's refresh, like `unmeasured_since`.
6. A monthly or quarterly goal is due by its period's last due day (Faro doesn't know the refresh day), and goes quiet after two periods (62 or 184 days). The demo's two goals on monthly metrics (cloud cost, developer satisfaction) now check in monthly, so the demo shows it.

## Part 4 (16 Nov)

- **A: #571, merged.** The library by stage and a metric's page (sketches 1, 2, 6, 8, 11). Journey U181.
- **B: #574, merged 09:30 UTC.** Defining part by part and baselines (sketches 3, 4, 9). Journey U182. Its red smoke was `api/mcp.js` built in a git worktree: esbuild wrote `../goals-app/node_modules` into 37 path comments, so CI's freshness check failed. **Always build `api/mcp.js` from the repository root, never from a worktree.**
- **C: #576**, auto-merge on. Verifying, Measured by with Defined first, a goal's Draft warning (sketches 5, 7, 10). Journey U183.
- **D: branch `claude/mq2-screens-d`**, on C:
  - The core place `review.row`: one read-only line under a review agenda's row, filled by `ReviewRowMetric` (journey 9).
  - Sketch 12's similar card (`SimilarCheck` in `Metrics.tsx`).
  - #571's three mediums: a Draft's page says "Still needs: …" with links; phone To sort out rows are full width; an admin confirms a rewording through `mayConfirmReword`.
  - #574's three mediums: the window and aggregate wrap on a phone; a cleared window is sent as null and a half-set window isn't said; a new aggregate drops `percentile` and `per`, and Mean has a Per field.
  - Lane's decision (16 Nov): Metrics is in the menu from a workspace's first day. `menu.waitsFor` is dropped for metrics; the mechanism stays. N30 is turned round; the empty library's Add a metric is its one primary.
  - Journey U184. Docs follow the build; the backlog marks MQ2 Done, and a verifier's Home line (journey 3) is deferred there.

## Still to build

Nothing in MQ2 once D merges. Open lows are in the reviewer's log on `build-reviews`.

## How to run it
- Read `CLAUDE.md`.
- Mechanical work goes to Sonnet subagents: eval runs, `npm run spec`, `npm run build:mcp`, merging main and resolving What's new.
- Report merges, failures and decisions Lane must make to planning (`session_012kbr91eefh4gwCAztBncNT`). The build session from 16 Nov, 08:00, is `session_012kbr8yw65g7pJoQjRG9q19`.
- Send each merged PR number to the build reviewer (`session_012kbr8yhSnbewc3YnAc52AT`).
- Hand over at about 300k tokens of context.
