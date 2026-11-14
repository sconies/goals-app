## Planning state, Friday 13 November, 12:35 UTC (planning session handing over)

**Update, 13 Nov ~14:00 UTC: the plan to handoff (Lane).** Build tiers 1–3 here before handoff, because building later on API tokens costs more; then FD, the lows and the full drill (item 11); then hand over. WM, 0c2, 0t and 3a stay in the backlog. Each track works its whole list (CLAUDE.md, 13 Nov):

| Track | Session | List, in order |
|---|---|---|
| 4 | session_012kbr931R7QEqBrfxbNv2QV | #354, #358; AX2; AX6; FT2 then RS1; FT1, SW1, SW2; FD |
| 1 | session_012kbr8xrSzicJV6Yybqqzng | in-flight review fixes (asks: only those addressed to the owner move, never to the asker; Lane 13 Nov); HB1, HB2 (HB3 after HM7); NR1–NR3; HM3/HM4, PF1–PF2; lows |
| 2 | session_012kbr92MfjHTHVBgQp2nL52 | review mediums; #376–#378; GE10 (F); TG; SM4, SM2, SM3, SM1; lows |
| 3 | session_012kbr8xq9rFhq98QkAVM4hp | #336's review fixes; MI (round 2's MT6); import lows |
| 7c | session_012kbr932dXk7emNz7HTfoU1 | #308's and #351's review fixes; MS, BL, GB, MC; GR, MQ |
| Main fixer | session_012kbr8zm5LkH575XFmikwtq | main's full evals green, one rolling issue |

Lane (13 Nov): every distinct feature is a module behind its own switch, and the handoff shows Faro can be built module by module (CLAUDE.md). When every track reports done: one session runs item 11 (core first, then each module on its own) (the full drill from spec/ and llms.txt alone) and brings docs/handoff.md up to date (its R5 line is stale since #283), and rewrites README.md, docs/handoff.md and docs/architecture.md from the module map and the generated spec, plus a one-line GitHub repository description for Lane to paste.

Planning was session_012kbr939zneZWtAo7UQEHRP. Read this section, then the 12 Nov 21:55 section below for the standing context.

- **Open sessions:**

  | Track | Session | Doing |
  |---|---|---|
  | 1 (Home, reviews, check-in) | session_012kbr8xrSzicJV6Yybqqzng | #369 (asks follow the new owner); two review mediums; the habit moment (round 4, HB1, HB2); N12; lows |
  | 2 (goal entry, set-up) | session_012kbr92MfjHTHVBgQp2nL52 | the review mediums on #349, #355, #319; #356; "Propose a new goal" in reviews; the rest of GE10 (F) |
  | 3 (import) | session_012kbr8xq9rFhq98QkAVM4hp | #336's review fixes (Import focus regression first) |
  | 4 (architecture, switches) | session_012kbr931R7QEqBrfxbNv2QV | #354, #358; FT2 then RS1 (reviews as a switch); FT1, SW1, SW2, AX2, AX6 |
  | 7c (metrics, register rows) | session_012kbr932dXk7emNz7HTfoU1 | #308's mediums; MS, MI, GR, MQ; BL, GB, TG; WM last |
  | Main fixer | session_012kbr8zm5LkH575XFmikwtq | main's full evals (U98, U109, F8/#342, N12), close ~64 duplicate issues, one rolling issue, a PR-CI proposal |
  | Reviewer (Fable) | session_012kbr8y4Bh3MudNC1bdo3RN | reviews every merge |

  Finished: track 5b (AD, #334), track 6 (every kit gap, last #337), the round 4 design session.
- **Decided by Lane, 13 Nov:**
  - Open asks follow a goal to its new owner.
  - AD is built.
  - The budgets went up once: 275 KB for the first download and 334 KB live. Never again without asking.
  - Round 4 design: all recommended answers (1a–17a). The order is habit, then NR, then SM in four parts, then the leader's week view.
  - Reviews as a feature switch: FT2 plus RS1, with 18a–22a.
  - Branch protection is on main and auto-merge works.
- **Next to assign when an area frees up:**
  - NR1–NR3: check-in readings, after the habit moment, in the check-in area.
  - SM4, SM2, SM3, SM1.
  - PF1–PF2, after HM3 and HM4.
- **Waiting for Lane:** nothing.
- **Prompt for the next planning session:** "You are Faro's planning session. Check out main, read CLAUDE.md, the top section of docs/handover.md ('Planning state, Friday 13 November, 12:35 UTC') and docs/backlog.md. Get your session ID with get_session and send_message every open session in its table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Then read reports with ReadNotifications; when a track hands over, start a fresh session from its handover prompt; relay the reviewer's findings to the owning track; fix anything that breaks main at once; put Lane's ideas in the backlog; build only what he picks. Stay quiet otherwise. Hand over at about 70% full, as CLAUDE.md says."


## Habits (still valid)


- **Keep this session's context small.** Don't subscribe to PR activity or relay CI and bot notices: each build session watches its own PR and reports once, when it's ready or blocked. Read build reports, decide, merge.
- **Merging:** Lane approves each merge (or pre-approves, e.g. "merge when green"). When he pre-approves, merge from here once the build reports green; build sessions won't merge on a relayed approval.
- **Recommend a fresh planning session unprompted** as soon as this one starts to fill up (about half full): update this handover, then give Lane a ready-to-paste prompt (CLAUDE.md, "Fresh planning sessions").

- **Two kinds of session.**
  - **The planning session** takes Lane's ideas, runs grills, keeps the backlog in order and decides merges.
  - **A build session** builds one release, starting from a short brief. Only one build runs at a time in any area.
- **Ideas go to the backlog first.** Build only what Lane picks or has approved as next.
- **Backlog edits** ride with the next feature PR.
- **Be quiet while waiting.** Report merges, failures and decisions; nothing else.
- **Use models to match the work.**
  - **Strongest model:** planning, architecture and review.
  - **Lighter model:** mechanical work.
- **Database changes** apply through CI on merge. Show the full SQL in the PR description.
- **Commits and PRs** follow `CLAUDE.md`:
  - **Author:** Lane.
  - **Committer:** Claude.
  - **Trailers:** the session trailers.
  - **Merging:** merge when CI is green, then post the PR and live links.
