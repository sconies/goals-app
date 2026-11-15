# MQ2, Metric quality: build handover

Lane approved MQ2 on 15 Nov. The decisions are in the MQ2 row of `docs/backlog.md` and in `docs/design/mq2/` (README, sketches 1–13, journeys 1–12; read them from branch `docs/mq2-journeys` until PR #561 merges). The latest decision wins.

## Done

- **Part 1: PR #563, merged 15 Nov.** Migration 0056 adds, on `faro.okr_metrics`: `calculation`, `time_window`, `source_link`, `source_query`, `source_owner_id`, `refresh_note`, `calc_changed_by` / `calc_changed_at`, `baselines`, `verification`, `verify_attempts`, `lapse`, `verifiers`, `handover` and `to_confirm`. On `faro.okr_goals` it adds `check_in_rhythm` (`monthly`, `quarterly` or null). CI applied it.
- **Part 2: branch `claude/mq2-rules` (its PR follows this note).** The rules and MCP for:
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
- **Part 3: branch `claude/mq2-part3` (PR to follow).**
  - A goal's own check-in rhythm, a core seam: `src/domain/goalRhythm.ts` and `Goal.checkInRhythm` (`monthly`, `quarterly` or empty = the cycle's). The due, run, habit and "No recent update" rules read it (62 days monthly, 184 quarterly). The metric library sets it through `rhythmChange` from `heldBy`/`heldByLink` on link, unlink, a refresh change and merge; `switched` clears it. Spec rule `goal-rhythm`; the module platform page lists the `goalRhythm` hook.
  - New `ModuleRecords` hook `personLeft(x, personId, toId)`, called by `departs()` through `whatPasses`. The core names the lead (`leadOf`); the library passes the person's metrics with `handover` set. `mark_person_left` lists them.
  - MCP: `link_goal_metric` returns `data.stage`, `data.draft` (heading, words, missing parts) for a Draft metric and `data.rhythm` when the goal's rhythm changes.
  - Metrics sheet: columns for What is measured, How aggregated, Counts, Filters, Leaves out, Numerator (with its filters and leaves out), Denominator (same three), Formula, Window and Source link, plus a worked Stage column. `SheetPlanResult.notes` (`src/domain/sheetPlan.ts`) lets a sheet say lines after the counts: stages after loading, similar metrics for new rows, each Draft's missing parts. `bulk_change`'s dry run prints them.

## Decisions taken at build (planning passed them to Lane; none challenged)

1. The stage is worked out, never stored.
2. A Gap metric can be Draft or Defined, never Verified.
3. MQ's `confidence` stays as "the owner's confidence" under Structure, never beside the stage.
4. "To verify" lists every Defined metric (never verified, or lapsed) plus any Verified one within 30 days of its 12 months.
5. A goal's rhythm is a goal column (`check_in_rhythm`), filled in from the metric's refresh, like `unmeasured_since`.
6. A monthly or quarterly goal is due by its period's last due day (Faro doesn't know the refresh day), and goes quiet after two periods (62 or 184 days). The demo's two goals on monthly metrics (cloud cost, developer satisfaction) now check in monthly, so the demo shows it.

## Still to build

### Part 4: the screens (sketches 1–12)
- **Library:** stage column, step shape plus word, a segmented filter with counts, Refresh and Window columns, and To verify and To sort out.
- **Metric page:** the top line (stage · refresh · window · direction), calculation parts, source, baselines per slice with History, the verification record, the failed-attempt and lapse boxes (full outline, never a side stripe), and the phone layout (sketch 8).
- **Forms:** the define form (two-field calculation, structured window, "To reach Defined, still needed: n of 10"), the add-a-baseline form, the verify form with the difference shown, and "Take this quarter's baselines" (from readings; reason on a changed figure).
- **Picker:** Measured by lists Defined and Verified first, with window and refresh on each option. Quick add asks only name, unit and direction.
- **Goal page:** the Draft warning, through the goal places (`goal.measure`, `goal.facts`), not the core. It also shows on review agenda rows, through a named place if none fits.
- **Add a metric:** the similar-metric check.
- **Home:** "n of your metrics have no baseline for Oct–Dec".

Each needs:
- design rules P6: the step shape is its own; no stripes, pills or emoji;
- a journey per screen, from `journeys.html`;
- Help sections;
- a What's new entry;
- the parity map in `module.json`;
- the rebuild exit lines.

## How to run it
- Read `CLAUDE.md`.
- Mechanical work goes to Sonnet subagents: eval runs, `npm run spec`, `npm run build:mcp`, merging main and resolving What's new.
- Report merges, failures and decisions Lane must make to planning (`session_012kbr91eefh4gwCAztBncNT`).
- Send each merged PR number to the build reviewer (`session_012kbr8yEo9vztTkpARWNy66`).
- Hand over at about 300k tokens of context.
