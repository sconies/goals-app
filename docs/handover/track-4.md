## Track 4, Saturday 14 November, 17:45 UTC (handing over at about 290k tokens, Lane's rule #455; supersedes the 13:00 entry)

Session: session_012kbr934nkdcyyV7KxsKcqN. Planning is session_012kbr91eefh4gwCAztBncNT. The build reviewer is now session_012kbr8zWCPJxkmsiZx169kF (since 15:30): send it each merged code PR's number in one line.

- **Merged:**
  - **#476**, the SW1 review mediums. The reviewer has been told.
  - **#480**, the PR journey cap (Lane, 14 Nov).
- **Open: #465, FT1, blocked by CI's smoke job.**
  - Main is merged in (after #476). The gate passed locally: typecheck, lint, 2042/2042 tests, spec, `build:mcp`. `evals:changed` exited 0 with 208/208 requirements, and every journey below 10 is a known score.
  - FT1's check is now **N31**, renumbered from N23. N23 is reserved by the check-in design (`docs/design/round-3/README.md`). F20 stays.
  - Auto-merge is on. But "Smoke: typecheck, tests and core journeys" was cancelled at its 30-minute limit, even with #480's cap: 31 journeys and 28 checks, run one after another with phones slowed 4×, did not finish. Checks aren't capped.
  - **Planning's call** (a limit, so not changed here):
    - (a) cap checks as well as journeys in `evals/touches.cjs` `capJourneys`;
    - (b) raise the smoke job's `timeout-minutes`;
    - (c) Lane merges #465 on the local gate.
  - Recommended: (a). A check runs as long as a journey, and the full suite after the merge runs every check anyway.
- **Open: #498, Help hides switched-off modules (Lane, 14 Nov).** Auto-merge is on, and the gate passed (F6 and N18 failed under load, then passed alone twice).
  - Most of this was already built: Help, search and `get_help` already hid a switched-off module's articles, Reviews' included.
  - The PR removes the page-foot "Help with this page" link from a switched-off module's page.
  - N21 now proves, for every module: Help lists none of its articles, and What's new keeps its releases.
- **Shelved: the #458 lows** (planning, 14 Nov: all review lows go to the backlog, #483).
  - Branch `find-off-filters` exists only in this container, so it will be lost. It held two changes:
    - `find_goals` answering with a `dropped` key ("Reviews is switched off in X, so inreview= was left out…") for `inreview=` or `metric=` while their module is off;
    - a team's panel saying "before the review" under its row of weeks only when a review was held in every week shown (`weeksNote` in `domain/habit.ts`).
  - Redo either only if the backlog picks it.
- **SW1 leftovers: none are mediums, so they go to the backlog.** The reviewer's SW1 mediums all shipped in #476. What's left on main are parity gaps, not refusals:
  - `get_goal` gives no "Watched by";
  - `get_activity` has no watching filter;
  - About lists the features by name rather than "All eight are on" (feature-switches spec 225).
- **Next, in order:**
  1. See #465 and #498 merged. #465 needs planning's call above.
  2. **SW2, AI access behind a switch.** See `docs/design/feature-switches/spec.md`: rows 33, 63, 74–75, 146, 151, 177, 215, 241–250, 328 and 6.1 "The door".
     - A module `ai-access` owning `okr_api_tokens` and the token tools. `createToken` is refused while it is off; `revokeToken` still works.
     - `server/mcp.ts` refuses every request but `initialize` and `tools/list`, with "AI access is switched off in {workspace}. An admin can switch it on in Faro, under Workspace, Features.", and doesn't update `lastUsedAt`.
     - The read-backs for off and on name the tokens. `/workspace/ai` becomes its own section.
     - Settings and People show no tokens while it is off. `set_feature` switching it off says the connection stops now.
     - Journey U127 (take the next free number above main's highest), requirement `AI-ACCESS-OPTIONAL`, and a What's new entry (a feature).
     - Its spec section, conformance rows and rebuild stage.
  3. **KL** (Lane, 14 Nov, approved): the retro's "How to run the rebuild" lessons in `docs/handoff.md` (from #489) go into `src/spec/rebuild.ts`, so the drill and the internal team see them. One small PR; `npm run spec`.
- **Traps:**
  - **node_modules in a worktree:** use `cp -al` from a real install, never `ln -s`. A symlink writes absolute `/home/user/...` paths into `api/mcp.js` (it happened to FT1 here; caught and rebuilt). Check with `grep -c /home/user api/mcp.js` (it should print 0).
  - Before merging main, `git checkout -- evals/report.md`: eval runs leave it modified, and the merge refuses to start.
  - **Known scores below 10 on main:** U31 9, U102 7.8, U123 9, U124 9 (HM3, the entry point), U134 9, U148 7, U149 6, U151 8, U164 7.5–8.8, U165 8.6, U166 8.6.
  - **Under the phone slowed 4×, main itself scores U109 9 and U153 8.9.** U109 can time out to 0 under the full run's load. U72 8.9 is a flake (10 alone). F6, N18 and N12 are timing checks that can fail under load: rerun alone with `PHONE_CPU=4 FINISH=…`.
  - A subagent's background eval run died when its monitors went. Run `evals:changed` as your own background command (`run_in_background`, two-hour limit) and grep the scorecard lines from its log.
