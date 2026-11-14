## Track 4, Saturday 14 November, 13:00 UTC (handing over at about 320k tokens, Lane's rule #455; supersedes the 01:30 entry)

Session: session_012kbr8zGTA8fDUXo7snL4jv. Planning is session_012kbr91eefh4gwCAztBncNT; the build reviewer is session_012kbr8xhnbxBn8GD91Ct4dL (send it each merged code PR's number in one line).

- **Merged:** #471, FD. The first download went 274 → 259 KB (budget 275) and live 334 → 318 KB (budget 334). The small parts Home's rows used now live in `src/ui/sparks.tsx`, `src/domain/feeder.ts` and `src/domain/rollup.ts`. `scripts/check-bundle.mjs` fails if `charts.tsx`, `goalPage.ts`, `summaryFacts.ts` or `map.ts` comes back into the first download. Lane, 14 Nov: the budget stays at 275 (the note rides in #476).
- **Open:**
  - **#476, the SW1 review mediums.** Auto-merge is on and the gate passed.
    - `writesWatches` (a new rule file in #476) refuses a save by what it writes with Watching off, in `performAny` and in the AI tools' `switchesGuarded`; Recently removed and `list_removed` hide stopped watches.
    - `yearLine` and `startPage` take the Wrap-up and Watching switches; `/activity?watching=` does nothing with Watching off.
    - It also proves #424 medium 1 closed (by #439) and fixes the module-map line-82 low.
  - **#465, FT1.** It conflicts with main again (#461, #471).
    - I merged main into it locally, but the merge was not pushed (the container's worktree is gone). Redo it: take main's `api/mcp.js` and `src/help/whatsNew.ts`, re-add FT1's `check-in-rhythm` entry at the top, then rebuild `api/mcp.js` and `spec/`. With FT1 the first download is 258 KB.
    - Its smoke job timed out at 30 minutes: its 89 files picked 67 journeys. Push the merge only after the PR cap below is on main, or it times out again.
- **Open: #480, the PR cap** (Lane, 14 Nov). Auto-merge is on, and the gate passed (the full suite).
  - `evals/touches.cjs` `touches()` returns a `score`: each rule a file matches gives each id it names 1 ÷ how many ids it names.
  - `capJourneys` keeps the core six journeys and the 25 highest; `evals/run.mjs` applies it under `--no-full` only.
  - FT1's 89 files go from 65 journeys to 31.
- **Next, in order:**
  1. See #476 and #480 merged. Then redo FT1's merge of main (above), run its gate, and push; its smoke job should now fit in 30 minutes.
  2. Lane, 14 Nov: Help hides a switched-off module's articles (Reviews included, as the Metric library already does); What's new keeps them.
  3. #458 lows from planning: `find_goals` with `inreview=` or `metric=` for a switched-off module should say once that the filter was dropped; a team's panel says "before the review" for all eight past weeks on the strength of this week's review. (The module-map low is done in #476.)
  4. The 01:30 entry's items 3, 4, 6 and 7: SW1 leftovers (`get_goal` `watchedBy`, `get_activity watching=1`, the "Watching is off here" filter line, About's "All eight are on"); SW2, the AI access switch; the #358 lows; the #403 low.
- **Traps:**
  - Journey scores below 10 don't fail the gate. On main: U31 9, U102 7.8, U134 9 (the stale-proposal row's "attention"), U148 7, U149 6, U151 8, U164 7.5–8.8, U165 8.6, U166 8.6. N12 is a timing flake under load.
  - Track 1 owns U159: the demo's time of day is not pinned (agreed with track 1), and `EVAL_CLOCK` stays inside the eval harness.
  - Push nothing before `evals:changed` passes. I pushed FD's branch early once; open the PR only after the gate.

