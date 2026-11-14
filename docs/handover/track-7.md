## Track 7c (metrics, baselines), Friday 13 November, 23:00 UTC (context near full, handing over)

**Merged:** #384 (#308's review mediums and lows), #404 (#351's review mediums and five lows; the sixth waits for 0c2), #411 (F5 `recordsOn` through `resolveModules`; F6 metric carry-over moved to journey U152), #413 (MS migration 0046), #430 (BL migration), #449 (BL: a baseline's period and "provisional"), #451 (GB migration 0050).

**Open, auto-merge on:**
- **#428 MS** (branch `ms-status`, worktree `../wt-ms`): conflicted with main again after BL merged. Its journey is being renumbered to U165, because main took U160; the track's fork is pushing that with the spec and `api/mcp.js` rebuilt. Check it landed and CI is green.
- **#452 GB** (branch `gb-baseline-only`): a proposed goal may have a baseline and no target. Waiting on CI.

**Next, in planning's order** (session_012kbr91eefh4gwCAztBncNT):
1. **MC**, monthly cadence: a core setting, not a switch.
2. **GR**: the limit and its status rule are core goal fields; naming a metric is the metrics module's optional part.
3. **MQ**: part of the metric library, no new switch.

Follow `docs/architecture/module-map.md`. MI is track 3's, TG is track 2's, and WM is dropped.

**Decisions for planning or Lane (from the builds):**
- MS: Partly still holds a goal to its plan; only Gap holds it to no number.
- MS: lists show a held goal as "No check-in yet", and only its page says "Not measured yet". A list status of its own needs a design call.
- BL: range goals get no baseline yet. New goal folds the period into one "Baseline known for a period?" link, so F16's two phone screens still hold.
- GB closes MS's gap: a goal on a Gap metric can go in as proposed with only its unit and baseline.

**Gotchas learned:**
- **Journey ids collide between tracks.** U150, U153, U160 and U161 all clashed today, and a duplicate stops every CI job. Take the next id above main's highest at push time, and recheck after every merge of main.
- **A conflicted PR gets no CI at all.** Main moves fast: after merging main, push quickly, then refetch and check `mergeable`.
- **One eval run at a time on the machine.** Parallel runs fail P9, N4, N6, N12, N18, F6 and unit-test timeouts. Forks wait on `pgrep -f evals` first.
- **Rebuild `api/mcp.js` after any journey renumber;** it embeds the module's journey ids.
- **Row mappers must write every NOT NULL column on every row,** with a PGlite mixed-batch test.
- **U31, U134 and U148–U151 score below 10 on main itself.**

