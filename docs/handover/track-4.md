## Track 4, Saturday 14 November, 20:35 UTC (handing over at about 370k tokens, Lane's rule #455; supersedes the 19:40 entry)

Session: session_012kbr8xXXTKcVTdAEGh1Ste. Planning is session_012kbr91eefh4gwCAztBncNT. The build reviewer is session_012kbr8zWCPJxkmsiZx169kF: send it each merged code PR's number in one line.

- **Merged:**
  - #501: PR CI caps checks as well as journeys.
  - #508: KL, the rebuild lessons in `src/spec/rebuild.ts` and `spec/rebuild/lessons.md`. Item 11 started on dd00ff48, and planning has been told.
  - The reviewer has had both numbers.
- **#465, FT1: pushed, CI running, auto-merge on.**
  - Main was merged twice. Home keeps main's one-team list with FT1's `checkInHere` action. A goal's page keeps FT1's as-of week and main's guard breaches.
  - Gate: full `evals:changed` 210/210 before the last merge, and GoalScreen's 12 journeys and 6 checks after it.
  - When it merges, send the reviewer #465.
- **#504, SW2: blocked on planning's decision.**
  - CI's "Core journeys without ai-access" fails because spec 6.1 says a build without the module refuses every MCP token. Eight core scenario files (about 100 tests) go through the MCP server, so the core-only build can't pass.
  - Options, on #504 and sent to planning:
    - (a), recommended: a build without AI access keeps the server open, and only the workspace switch shuts the door. This is a small change in `server/mcp.ts` `serve`, plus its lines in `src/modules/ai-access/spec.ts`, `module.json` (gaps) and `docs/mcp.md`.
    - (b): `skipIf` every MCP scenario when `ai-access` isn't built.
  - Reproduce with `FARO_WITHOUT=ai-access npm run evals:smoke`.
  - Everything else on #504 passes. Its journey is **U175**, because main took U171 for guardrails.
- **P3 fails on main, and it isn't this track's:** colour contrast on Ingrid's Home, `a[href$="env-tpl-data"] > .arow-title`. Planning has been told.
- **Next:** once #465 merges and #504 is fixed and merged, track 4's 17:45 list is done, and planning says no fresh track 4 is needed. Whoever takes #504's fix: one small push after planning picks (a) or (b).
- **Traps (still true):**
  - node_modules in a worktree: `cp -al`, never `ln -s`; `grep -c /home/user api/mcp.js` should print 0.
  - `git checkout -- evals/report.md` before merging main.
  - Known scores below 10 on main: U31 9, U123 9, U124 9, U134 9, U148 7, U149 6, U151 8, U164 7.5–8.8, U165 8.6, U166 8.6. U51, U69, U72 and U29 dip under the full run's load and score 10 alone.
  - F6, N10, N12, N18 and `src/app/clock.test.tsx` can fail under load: rerun alone. A platform check: `ONLY=PLATFORM CHECKS=P3 FINISH= node evals/run.mjs`.
