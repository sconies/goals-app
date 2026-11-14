## Track 3 (import and spreadsheets), Saturday 14 November, 23:15 UTC: MI and U98 up; two review mediums in their gate (replaces the 13 Nov entry)

**Up for merge (all drafts; none merged yet, so nothing has gone to the reviewer or item 11)**

- **#514, U98's Stop-step flake (`u98-hold-check`).** CI is green.
  - Cause: the Reading panel shows only after 400 ms of checking. The check runs in a worker at the machine's own speed, and phone CPU slowing never reaches workers. On a fast full-suite shard, 6,000 rows were checked before the panel was due.
  - Fix: `holdCheck` in `evals/journeys.cjs`, used only by U98. It serves the worker script with its last answer held until 3 s after the check was asked for.
  - Proven: with the hold at 40 s, the over-limit step times out.
- **#520, MI: the Metrics sheet in and out (`mi-metrics-sheet`).** CI was running at handover.
  - What it adds:
    - a new core seam, `src/domain/sheetPlan.ts`: a module's loaded sheet gives a planner (`ModuleSheet.loadPlan`/`plan`/`has`), and `changeset.ts` runs it before Goals;
    - `Tables.modules` for the module's sheets;
    - `ImportUndo.moduleRows`, undone in `removal.ts` `undoPlan`;
    - the metrics planner, `src/modules/metrics/sheetPlan.ts`;
    - `bulk_change` takes `metrics`;
    - the "Metric library is off in {ws}, so the Metrics sheet was not read." line, plus a line on Import when a file holds only that sheet;
    - journey U175, requirement `METRIC-SHEET`, conformance rule `sheet` (10 cases), Help `metric-sheet`, and What's new `metrics-sheet-in`.
  - First download: 262.6 of 275 KB (main 261.3).
  - Left for later:
    - the Goals sheet's Measured by / Measured for / Part columns (MT6 spec 3.2);
    - the template's Metrics sheet;
    - the Check for 2+ new rows with no Owner email.
  - #505 (MQ) was unmerged at build. Whichever lands second carries MQ's four fields into the sheet's columns and the planner's input.
  - **When it merges:** tell the reviewer (session_012kbr8z4ihwvC1ZUTMGey4V, per planning's message) and item 11 (session_012kbr8y5FBfBYyNt4XKM97h, to add MI as a drill stage).
- **`board-lane`: two reviewer mediums, gate running in a subagent at handover.** No PR yet. When the gate passes, open it as a draft.
  1. **#503:** a goal stopped while held stayed held when restarted. `heldBy` and `heldOnSwitch` now keep stopped and removed goals in step.
  2. **#510:** the Board had no Not measured yet lane. `GoalBoard` now reads its lanes from `STATUS_ORDER`, and U170 checks the lane.
  - Planning asked for auto-merge. The permission check refused it here (merging is Lane's call), so the PR is a draft without it. Tell the reviewer the PR number when it merges.
- The worktree `../goals-held` (`held-restart`) is superseded by `board-lane`. Nothing was pushed from it.

**Next for track 3:** see the three PRs through CI and merge, then report once to planning. MI's leftovers above are for planning to place in the backlog.

**Gotchas (new)**
- **Module code in the worker:** a module's code reaches the import's worker only through `worker: { plugins: () => [faroModules()] }` in `vite.config.ts`. Without it, the build fails resolving `virtual:faro-modules/records`.
- **Shared records are in the first download:** anything a module's records or sheet imports statically ships with it. Keep planners and their rules behind `loadPlan` (`core/records` `loadSheetPlanners`). `rulesStill.ts` was split out of `rulesDefine.ts` for this reason.
- **Empty cells:** as on every sheet, an empty cell keeps what the record says. Clearing by an empty cell made an empty Unit read as a unit change.
- **Ports:** run evals in a second worktree with `EVALS_PORT=4902` (or higher) so they don't collide with another run.
- **`ONLY` vs `FINISH`:** `ONLY` selects journeys; checks need `FINISH=N18`.
- **Load flakes:** N18 (the page stopped 211–243 ms against a 200 ms limit) and U42 failed under the four-shard full run and passed alone, twice today.
