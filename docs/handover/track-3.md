## Track 3 (import and spreadsheets), Sunday 15 November, 03:00 UTC: MI merged; two review PRs up (replaces the 14 Nov entry)

**Merged this session** (the reviewer was told of each; item 11 was told of #520)
- **#520, MI: the Metrics sheet in and out.** It carries MQ's four fields (Part of, How it relates, Confidence, How it could be gamed). It sits beside TG2: the engine, worker and `bulk_change` run both the module sheet planners (`planners`) and the module Goals columns (`goalSheets`), and their rows merge into one commit. Journey **U179**.
- **#529** (board-lane): #503's held-goal fix in `heldBy` and `heldOnSwitch`; #510's Board lane from `STATUS_ORDER` (U170).
- **#532:** #503's third door, `mergeMetrics`.
- **#530:** a regeneration of main's stale journey pages. Item 11's #531 then made the pages name their journey's entry rather than a line.

**Up, auto-merge on, CI running at handover (watch both until merged; then tell the reviewer, session_012kbr91tf31zgvoDfJXAVxo)**
- **#533, `tg2-review`: the reviewer's three TG2 mediums.**
  1. A field can't take a name the Goals sheet reads as its own column (`domain/sheets` `coreGoalsColumn`).
  2. Undo this import puts field values back and takes out an added list value. The engine records the module Goals columns' rows in `ImportUndo.moduleRows`.
  3. Help says Data's field column is read-only.
  - What's new: `fields-import-undo`. Full gate green.
- **#534, `mi-review`: the reviewer's #520 findings**, each with a failing-without-fix test in `metrics/sheetPlan.test.ts`:
  - HIGH: Undo deleted another year's goal. A module goal's undo `before` now comes from `input.full`.
  - A goal un-held on Metrics and changed on Goals in one file keeps both changes.
  - Undo skips a module row changed since (rule 9).
  - `isMetricsHeader` is false with a Goal or Key column.
  - Imported's "Saved {n} rows" counts module rows.
  - Gate green.
- **#533 and #534 both edit `changeset.ts`** around `moduleUndo`, next to each other. Whichever lands second may conflict: merge main, keep both blocks (#534's `allGoals`/`plannedGoals` overlay sits just before #533's goal-sheet undo loop), then rerun `npm run spec`, `npm run build:mcp` and the gate.

**Left for planning to place**
- MI leftovers: the Goals sheet's Measured by / Measured for / Part columns (MT6 3.2); the template's Metrics sheet; the Check for 2+ new rows with no Owner email; a Part of naming a metric on a *later* row.
- Data's field cells aren't editable. It would need choices for each list field in `DataTables` `EDITABLE` and `FIXED_CHOICES`, plus a journey.
- Undo's changed-since check for module rows matches `entityId` only. A field value's later change (logged by goal and field) isn't caught yet.
- Three lows on #520 are in the reviewer's log (build-reviews).

**Gotchas (new)**
- **Journey IDs:** take the next free number above main's highest (`grep -o "journey('U[0-9]*'" evals/journeys.cjs`) at the last merge before pushing. Other tracks take numbers too, and a duplicate ID stops every journey run.
- **Spec after every main merge:** run `npm run spec` after merging main. #529 left main red by skipping it.
- **`api/mcp.js`:** any change to a module's rules (`rulesChange.ts` and the like) needs `npm run build:mcp`. CI fails on a stale bundle.
- **A PR that conflicts gets no CI at all**, so auto-merge silently waits. Check `git merge-tree` against main when CI seems not to start.
- **Two eval runs at once** need distinct port blocks (`EVALS_PORT=4921`, `4951`). Shards take about 10 ports each. N18, N7 and F6 flaked under the shared load and passed alone.
- Earlier gotchas still hold: module code reaches the worker through `worker.plugins` in `vite.config.ts`; keep planners lazy (`loadPlan`); an empty cell keeps the value; `ONLY` is for journeys, `FINISH` for checks.
