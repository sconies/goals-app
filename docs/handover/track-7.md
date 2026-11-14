## Track 7d (metrics and the register rows), Saturday 14 November, 19:00 UTC (about 375k tokens of context, handing over)

**Merged:** none yet. Every PR below has passed its local gate (typecheck, `npm test`, `evals:changed`). The failures seen were all under load, and each passed when rerun alone: P4 (contrast on Home), N12 (a list search about 5 ms over budget) and `src/app/clock.test.tsx`.

**Open, in merge order:**
1. **#464 GR** (`gr-guards`): auto-merge is on. Main was merged in twice. `guards` was already in `BUILT_KEYS`. `src/adapters/guardsRow.test.ts` (PGlite) shows that a goal row's guards reach 0051's check as SQL null or a list, never a JSON null. CI was running on head `108dabbc`. Once it merges, send #464 to the build reviewer.
2. **#502 MQ migration** (`mq-migration`): green and clean, but still a draft with no auto-merge. Making it ready with auto-merge on was refused by the session's permission check, and CLAUDE.md says merges to main are Lane's call. **Lane or planning to merge.** It was renumbered from 0052 to **0054**, because main took 0052 (TG) and 0053 (PP0). Its SQL is in the PR description.
3. **#505 MQ structure** (`mq-structure`): needs #502 first. It contains #502's commits, so its diff shrinks once #502 lands. Gating found and fixed a real bug: structure fields weren't in `metricFields`, so a save that changed only those fields saved nothing. U172 now scores 10/10. The full suite passed, with 208 of 208 requirements met.
4. **#503 MS/BL review mediums** (`ms-bl-review`, `[no news]`): MS mediums 2, 3 and 4, and BL mediums 7 and 8.
   - `unmeasured_since` is written on every row, and the form keeps the hold.
   - Retire and unretire re-work the hold, and a merge gives each goal the hold of the metric it moves to.
   - A new optional extension point, `ModuleRecords.switched`, lets the library let go of held goals when it is switched off and hold them again when it is switched on. `setModule` is given every module's records, on or off.
   - A new Must fix, `baseline-provisional-late`, stops a baseline being marked provisional after the goal's first check-in.
   - A goal carried from its final number leaves last year's baseline behind.
   - CI was running on head `06384886`.

**Next:**
- **MC:** blocked on FT1 (#465), which wasn't on main at 19:00. Pick it up once FT1 merges.
- MS medium 5 (lists say "No check-in yet" for a held goal) is a design call already with planning. The review lows are deferred.

**Gotchas learned today:**
- **Never symlink `node_modules` into a worktree.** `npm run build:mcp` then writes `../goals-app/node_modules/...` paths into `api/mcp.js`, and CI's "api/mcp.js is out of date" check fails every time (37 lines). Use `cp -al <main>/node_modules node_modules`, a hard-linked copy, instead.
- **CI builds the PR merged with the latest main,** so the smoke check also fails on `api/mcp.js` after main moves. Merge main again and rebuild.
- What's new conflicts come from every merge of main. Keep both entries, yours first.
- `evals:changed` exits 0 even when something fails. Read the summary lines, not the exit code.
- The highest journey ids now: U170 (MS), U171 (GR), U172 (MQ). Recheck main before taking the next one.
- Earlier gotchas still hold: one eval run at a time; a conflicted PR gets no CI; rebuild `api/mcp.js` after any journey renumber; row mappers write every column on every row.
