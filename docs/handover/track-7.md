## Track 7d (metrics and the register rows), Saturday 14 November, 20:45 UTC (session_012kbr8xpLzkSPpsXPVMTjbD, about 250k tokens of context, handing over before MC)

**Merged this session:** #464 (GR, guardrails; sent to the build reviewer) and #502 (MQ's migration). Main had taken 0054 (TG1), so MQ's migration merged as **0055** (`0055_metric_structure.sql`).

**Open:**
- **#510 MS medium 5** (`ms-unmeasured-status`, draft): "Not measured yet" is a status of its own (Lane, 14 Nov). `DisplayStatus` gains `unmeasured`: `goalStatus` gives it to a held goal (week 0 too; only Done outranks it), with its word and meaning only in `STATUS.unmeasured` (vocabulary) and a shape of its own (a ring with a dot at its centre). The Goals list, its status filter, the goal and metric pages, the library's counts, the workbook, get_goal and find_goals follow. The goal page's `LifeMark` for it is gone. Local gate passed: the full suite ran. U170 scores 10. U51, U123, U124 and U164–U166 score under 10 on main too (checked alone at 246126a8). CI was running at 20:35. When it is green: make it ready, turn on auto-merge, and send its number to the build reviewer.
- **#503 (MS/BL review mediums) and #505 (MQ structure):** owned by the earlier 7d session (session_012kbr8zzN3enEt3hjY3Q66H), which was finishing them. Planning said not to touch them. #505's diff still carries the migration as 0054; it needs main merged in (0055 is on main now).

**Next: MC** (monthly cadence), unblocked now that FT1 (#465) has merged. Backlog row MC; module-map row MC: a core setting per goal (or per metric) on FT1's field, not a switch, core stage 1.
- FT1's field: `Cycle.checkInWeeks` (1 every week, 0 no set rhythm; 2 and 4 are stored values kept for FT4) and `Cycle.rhythmFrom`. FT4 (every two weeks or every month for the whole cycle) isn't built. The module map lists FT4 as an MC dependency, so ask planning whether MC ships monthly per goal on its own, or waits for FT4.
- What MC must do: a goal (or its metric) read monthly has one check-in due a month, "No recent update" counts from that, and the chart joins monthly points.

**Gotchas learned:**
- **Migration numbers collide like journey ids.** Check `supabase/migrations` on main before pushing a migration, and rename it (with the README line and the PR's SQL heading) if main took the number.
- **A new display status reaches further than the type checker shows.** These also list the statuses: the goals contract (`src/ports/contracts/cases/goals.ts`), find_goals' choices (`src/mcp/tools.ts` `STATUSES`), Help's statuses article, CSS tone classes (`tone-none` and so on), `docs/glossary.md` (`npm run glossary`) and `docs/export-format.md` (`npm run export-format`). The ONE-VOCABULARY eval refuses a status word written anywhere but the vocabulary.
- **`src/help/lookup.test.ts`** checked that the second-newest What's new title wasn't in the Help index. That fails when the title matches a guide article ("Guardrails on a goal"), so it now checks the entry's first line.
- **`evals:changed` on shared code runs the full suite in four shards.** Journeys that drop there (U69, U72 and U147 did) can score 10 alone. Rerun them with `ONLY=`, and compare with main in a detached worktree before blaming the change.
- Earlier gotchas still hold: hard-link `node_modules` (`cp -al`), never symlink it; one eval run at a time; `evals:changed`'s exit code isn't the verdict; a conflicted PR gets no CI.
