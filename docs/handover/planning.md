# Planning: handover (Monday 16 November, ~19:45 UTC)

Planning was session_012kbr8yQaHGoDsesfVZhHry, started on the `sconies/goals-app` repository. Main is at 7141ed66 (#583).

## Where it stands: building is paused (Lane, 16 Nov)

The plan to the handoff, MQ2, the drill bugs and the MQ2 follow-ups are all on main. Lane paused building after #583: only a bug that breaks main is fixed. No build session and no reviewer is running.

**Done on 16 Nov:**
- **MQ2, Metric quality:** finished with #574, #576, #577 and #578. #575 fixed Metrics missing from a new workspace.
- **Drill bugs (15 Nov list), all 12:**
  - #579 (migration 0058, approved by Lane): the database itself refuses a switched-off module's own records in `okr_commit`, and refuses `okr_token_create` while AI access is off. New table `faro.module_entities`.
  - #581: 0v is never negative; U69; evals find Vite; `home.csv` is in UTC; Reviews' read-back wording; Settings' links while AI access is off.
  - #582: Help hides lines that name reviews while Reviews is off. G-48/m9 was the kit's wording, not Faro's engine.
- **MQ2 follow-ups (#583):**
  - MQ2a: "n metrics to verify" on a verifier's Home, through `home.blocks`.
  - MQ2b: switching the Metric library back on passes the metrics of anyone who left while it was off to their lead.

**Open, low only (the reviewer's log on `build-reviews`, docs/handover/reviewer.md, reviewed to 7141ed66):**
- #582: Help's search (`textOf` in `src/help/guide.ts`) reads hidden sections, so with Reviews off "review" still finds about 15 core articles.
- #582: R-names' code pointer in `src/spec/rules.ts` doesn't list `workspaceNameProblem`.

Under Lane's 14 Nov rule, these are fixed only when a change touches the same lines.

**Watch:** these checks have each failed under load and passed alone. Act if one fails on main's full run (rolling issue "Full evals failing on main").
- N18 (timing)
- P4 (contrast on Home as Ingrid; failed once in #579's full local run)
- P3 (contrast on Ingrid's Home row `a[href$="env-tpl-data"]`; failed in #576–#578's parallel local runs)
- F6

**Learnt:** a worktree with symlinked node_modules puts its own path into `api/mcp.js`. Build from a real install.

## Open sessions

None for Faro. Finished Faro sessions were archived on 16 Nov.

(Planning's first clean-up archived 28 non-Faro sessions by mistake. They were restored the same hour. When closing sessions, select by Faro title or a Faro planning parent, never "everything else".)

## Decided by Lane, 14–16 Nov

- **Costs** (#455, CLAUDE.md): hand over at about 300k tokens; mechanical work goes to Sonnet subagents; restart the reviewer daily or every ~20 PRs; at most three build tracks.
- **Budgets:** the first download stays at 275 KB.
- **MC and FT4:** deferred to after the handoff.
- **MQ2 (15 Nov):** built as its backlog row. Migrations 0056 and 0057 approved.
- **16 Nov:**
  - after MQ2, the drill bugs on one track, with the reviewer kept running;
  - migration 0058 approved;
  - then the MQ2 follow-ups;
  - then pause building.

## Waiting for Lane

- The GitHub About description, if not yet pasted: "Faro: a goals (OKR) tool built as a model for an internal team to copy, with its spec, rebuild kit and a demo that needs no sign-in."
- What to build when building resumes. Candidates, in the backlog:
  - the deep dive's three setup ideas (four-goal cap; titles and leads; per-goal team);
  - TN (narrow `evals/touches.cjs`);
  - SK (the tab bar while a screen loads);
  - 0c2 (drop the old `public` names).

## Habits

- Keep context small: no PR subscriptions, no CI relaying. Builds report once.
- Ask Lane in one batch of multiple-choice popups, recommended answer first. Merging to main is his call; a PR with a migration needs his OK on the SQL.
- Before assigning a fix, check that no other session is already on it.
- Give a running track the next small list rather than starting a new session, unless it is past 300k tokens.
- When building resumes, start a fresh reviewer too. Give every build session the reviewer's ID.
- Pass the reviewer's highs and mediums to the owning session. Lows wait in its log.
- A bug that breaks main gets fixed at once.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session and run list_sessions. Building is paused: no Faro session should be running. Read reports with ReadNotifications. Fix anything that breaks main at once. Put Lane's ideas in the backlog and build only what he picks; when he resumes building, start one build session and a fresh build reviewer, and give each the other's ID. Watch the flaky checks N18, P3, P4 and F6 on main's full runs. Stay quiet otherwise. Hand over at about 300k tokens by rewriting docs/handover/planning.md."
