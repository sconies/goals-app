## Track 2 (one goal, goal entry, set-up), Saturday 14 November, ~19:20 UTC (handing over at ~265k; replaces the 16:15 entry)

Session: session_012kbr8yZ7UiGDzWqA8TwbbQ. Planning is session_012kbr91eefh4gwCAztBncNT (report there once, when the list is done or blocked). The build reviewer is session_012kbr8zWCPJxkmsiZx169kF. All review lows go to the backlog (#483, Lane 14 Nov); fix one only when it rides with a change to the same lines.

**Merged this session:** #495 (the reviewer's medium on #475: a refused workspace name can't reach Create by Forward or a typed address) and #487 (TG1: the `tags` module, Workspace → Fields, the goal's Fields block, MCP `list_fields`/`set_goal_fields`/`save_field`, migration 0054).

**Not yet told to the reviewer:** `send_message` to the reviewer was refused by this session's permission check (auto mode). Send "#495 and #487 merged" first thing; if it's refused again, tell Lane.

**Fixed on the way, inside #487:**
- P3/P4 (axe `dlitem`) on `/workspace`: a module's fact line was wrapped in `<span style="display: contents">` inside the `dl`; it is a keyed `Fragment` now (`src/screens/Workspace.tsx`). The P3 colour-contrast failure on Home didn't reproduce.
- **U35 was failing on main** under `PHONE_CPU=4` (0/10, phone only: "the goal filter is not shown as words"); main's full suite runs at full speed, so #500 never named it. Cause: Data's `setView` built a change on the params the router last drew; on a slow phone the first filter's redraw of 5,000 check-ins was still pending when the second was added, which saved over a list without the first. It now builds on `useLatestParams` (as Goals' filters since 9 Nov). Explained on #487.

| PR | What | State |
|---|---|---|
| #493 `tg2-fields-filters` | TG2 (its contents are in the 16:15 entry, in git history) | **base retargeted to main**, main merged in at d3901db5 with no conflicts; typecheck, 401 help/spec/MCP/modules/screens/query tests, spec rebuilt, `api/mcp.js` unchanged. Still draft. **Run the full `npm test` and `evals:changed`**, then ready + merge |

**#493's CI:** its last smoke run (at b73edb0e, still stacked) was **cancelled at the job's 30-minute limit**, partway through ~30 journeys; before that, at a9780164, it failed **F5** ("L&T 2: the lit tab, All, is not in view in full", By team on a 390 px phone). TG2 doesn't obviously touch the tabs: run `PHONE_CPU=4 CHECKS=F5 npm run evals` on the branch and on main before blaming it. #487's smoke runs also finished their journeys at ~1,495 s, right at the limit. Never raise it; if #493 can't fit, say so to planning.

**First download** (exact gzip, from the 16:15 entry, not re-measured): main 265,498; TG1 266,429; TG2 267,214. Budget 275 KB, not raised.

**Known gaps to report (TG2):** Find doesn't search free-text field values; Undo of an import doesn't restore field values. Both are in the spec and the rebuild gaps.

**Next, in order:** tell the reviewer (above); #493's gate (full `npm test`, `evals:changed`, F5 checked on main), then ready, merge when CI is green and `mergeable_state` is clean, and tell the reviewer; then report to planning once: merged list (#477, #484, #485, #488, #475, #495, #487, #493), the U35 fix on main, the first-download numbers and TG2's two gaps. That finishes track 2's list.

**Habits:**
- Auto-merge didn't fire on #495 or #487 even when green and clean; `merge_pull_request` with `expectedHeadSha` worked.
- Main moves every few minutes: each merge of it conflicts in `src/help/whatsNew.ts` (keep both, this branch's first) and `api/mcp.js` (take main's, `npm run build:mcp`; `grep -c home/user api/mcp.js` must be 0). Merge main right before CI, not long before.
- `npm run evals:changed` ignores `FINISH`. Run one check with `PHONE_CPU=4 CHECKS=<id> npm run evals` and one journey with `PHONE_CPU=4 ONLY=<id> npm run evals`. Keep `EVALS_PORT` at least 13 apart for side-by-side runs.
- Under parallel load `npm test` times out a few PGlite tests (parts, layers, fence); they pass alone. U47, N12, N6, F3 and N18 time out now and then in evals; each passes alone.
- Worktrees are `/home/user/wt-<branch>` with `cp -al` node_modules.

**Prompt for the next track 2 session:** "You are track 2 of Faro's build (goal entry and set-up). Read CLAUDE.md, docs/architecture/module-map.md, then docs/handover/track-2.md (if its PR hasn't merged, read it on branch track2-handover-14nov-1615). Do its 'Next' list in order: tell the build reviewer (session_012kbr8zWCPJxkmsiZx169kF) that #495 and #487 merged; gate #493 (TG2, now based on main): full npm test and evals:changed, check F5 on main and on the branch with PHONE_CPU=4, then ready and merge once CI is green and mergeable_state is clean (merge_pull_request with expectedHeadSha if auto-merge doesn't fire); send #493 to the reviewer; then report once to planning (session_012kbr91eefh4gwCAztBncNT) with the merged list, the U35 fix, the first-download numbers and TG2's two known gaps. Never raise budgets. Send eval runs and mechanical work to Sonnet subagents that return only the scorecard. Hand over at about 300k tokens into docs/handover/track-2.md, replacing the entry."
