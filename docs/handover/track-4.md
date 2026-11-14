## Track 4, Saturday 14 November, 19:40 UTC (handing over at about 325k tokens, Lane's rule #455; supersedes the 17:45 entry)

Session: session_012kbr8xXXTKcVTdAEGh1Ste. Planning is session_012kbr91eefh4gwCAztBncNT. The build reviewer is session_012kbr8zWCPJxkmsiZx169kF: send it each merged code PR's number in one line.

- **Merged:** #501, PR CI caps checks as well as journeys (planning's option (a) for #465). `capJourneys` takes journeys and checks together: the core ones (smoke journeys and P6) always run, then the 25 the files name most directly. The reviewer has been told.
- **Open, auto-merge on:**
  - **#504, SW2: AI access behind its switch.** The module `ai-access` owns the token tools, `/workspace/ai` and Help `ai`. `server/mcp.ts` shuts the door, refusing everything but `initialize` and `tools/list`, and doesn't touch `lastUsedAt`. `createToken` refuses while it is off, and the read-backs name the tokens both ways (`aiAccessReadBack`). It adds journey U171 and requirement `AI-ACCESS-OPTIONAL`.
    - Gate: full `evals:changed` passed, after N30, U22 and U171 were fixed and re-run alone at 10.
    - Send the reviewer its number when it merges.
  - **#508, KL: the retro's rebuild lessons** live in `src/spec/rebuild.ts` (`LESSONS`), which writes `spec/rebuild/lessons.md`. `docs/handoff.md` points to it.
    - **When it merges, tell planning at once: item 11 starts on that commit.**
- **#465, FT1: not pushed yet.** Its branch conflicted with main.
  - The merged branch is `ft1-rhythm-merge` in worktree `/home/user/ft1` (container only), with two merges of main.
  - Home now keeps main's one-team list with FT1's `checkInHere` action. Workspace's import has both `Fragment` and `useRef`.
  - typecheck, lint, 2078/2078 tests, spec, glossary and `build:mcp` pass.
  - Its full `evals:changed` was running at 19:35 (log: the session scratchpad `ft1.log`).
  - If this container is gone, redo the merge from `origin/ft1-rhythm` (same two conflicts), run the gate, then push to `ft1-rhythm` (`git push origin ft1-rhythm-merge:ft1-rhythm`). Its CI then runs under #501's cap.
- **P3 fails on main, and it isn't this track's:** colour contrast on Ingrid's Home, `a[href$="env-tpl-data"] > .arow-title`. It failed every local run since 18:00, alone too. Planning has been told. Issue #500 (Full evals failing on main) names only U109.
- **Next:** the 17:45 list is done once #504, #508 and #465 merge. Ask planning for the next list.
- **Traps (still true):**
  - node_modules in a worktree: `cp -al`, never `ln -s`. Check with `grep -c /home/user api/mcp.js`, which should print 0.
  - `git checkout -- evals/report.md` before merging main.
  - Known scores below 10 on main: U31 9, U123 9, U124 9, U134 9, U148 7, U149 6, U151 8, U164 8.8 (its entry point is never put in view), U165 8.6, U166 8.6. U69, U72 and U29 dip under the full run's load and score 10 alone.
  - F6, N10, N12 and N18 can fail under load: rerun alone. A platform check reruns with `ONLY=PLATFORM CHECKS=P3 FINISH= node evals/run.mjs`.
  - The demo holds one live token (Mateo's), but no demo screen shows it. SW2's read-back names no tokens in the demo for that reason.
