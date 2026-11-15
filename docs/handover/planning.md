# Planning: handover (Sunday 15 November, ~10:45 UTC)

Planning was session_012kbr91eefh4gwCAztBncNT. It was opened on the home folder rather than the repository, so `.claude/settings.json` never loaded and every session start asked Lane for approval. **Start the next planning session on the `sconies/goals-app` repository.** Session IDs below were current at handover; run `list_sessions` to confirm them.

## The plan to the handoff (Lane)

Only **item 11** is left: the full drill, then the doc rewrites. Everything else is parked until after the handoff. That covers PF1–PF2, every review low, MC, FT4, WM, 0c2, 0t, 3a, track 3's leftovers and "Bugs found by the drill (15 Nov)" in the backlog.

**Item 11, redefined by Lane on 15 Nov.** These decisions replace the kit-only drill:

- **Time-boxed.** One pass per stage, with no further rounds of kit fixes to chase scores. Note gaps; fix only one-line kit corrections.
- **The internal team will have the code.** Their problem is rebuilding Faro on their own platform (sign-in and single sign-on, data store, hosting), not on Supabase and Vercel. So the rebuild session gets everything: the kit (`spec/` and `llms.txt`), the running app with its demo, and the code.
- **Target: a generic stand-in platform** (Lane's pick). A plain stack with no Supabase and no Vercel: its own simple sign-in, an ordinary database behind a plain server, and a stub single sign-on.
- **What it measures, per stage:**
  - what ports as-is (`src/domain`);
  - what has to be rewired to the platform, and how much;
  - anything Faro needs from the platform that the spec doesn't name;
  - which rules and conformance rows work on the new platform. Journeys are secondary.
- **The running app is part of the handoff**, as a reference beside the kit and the code. The handoff docs give its URL and how to sign in to the demo.
- **Then:** the write-up (`docs/drill/2026-11-full-drill.md`, `docs/handoff.md`), the README, handoff and architecture rewrites, a one-line GitHub description for Lane, and #512 out of draft.

## Open sessions

| Role | Session | State |
|---|---|---|
| Item 11 (fifth session) | session_012kbr91AwXu7nDeXjiXt5Q7 | Briefed on the redefinition above. #548 (fixes for #547's three mediums) merged. Next: rewrite the drill brief, BUILDER.md and REVIEWER.md for the stand-in platform, then the core and each module. Reports to planning when done or blocked. Its handover lives in `docs/handover/item-11.md` on `drill-item-11` (#512). |
| Build reviewer (Fable) | session_012kbr8yEo9vztTkpARWNy66 (fresh 05:57, 15 Nov) | Main reviewed to 6e41c494 (#547); #548 is next. No highs or mediums open apart from #547's, which #548 should close. Hands over after about 20 PRs or 300k tokens. Its note is `docs/handover/reviewer.md` on `build-reviews`. |

All other tracks are finished and stopped (tracks 1, 2, 3, 4 and 7d, the import fixes and the main fixer). Close them if they still show.

## What happened on 15 Nov

- **Track 3** handed over. A Sonnet tail session landed #534 (the reviewer's #520 high and mediums). #541 closed the two remaining mediums.
- **#546** fixed the U159 and U109 flakes: a focus hand-back race in Pick and WeekPick. U67 and P4 were single misses with other causes. Check the next full runs on main (rolling issue #540).
- **Item 11** merged #536, #537, #539, #543, #544, #547 and #548. Every stage 3–12 was rebuilt once on the kit-only framing, which Lane has now replaced (see above).
- **Vercel previews** are off on the orphan drill branch `drill-11-rebuild` (vercel.json). Future drill branches need the same.
- The old planning session of 12 Nov (session_012kbr939zneZWtAo7UQEHRP) is archived.

## Decided by Lane, 14–15 Nov

- **Costs** (#455, CLAUDE.md): hand over at about 300k tokens; mechanical work goes to Sonnet subagents; restart the reviewer daily or every ~20 PRs; at most three build tracks.
- **Retro** (#489): check cost per merge daily, and look into anything above $15.
- **Budgets:** the first download stays at 275 KB.
- **PR CI:** core journeys plus what the PR touches, phones slowed 4×, capped at 25.
- **`faro` is exposed** in the Data API.
- **MC and FT4** are deferred to after the handoff.
- **Item 11:** time-boxed; full access to the code; rebuild on a generic stand-in platform; the running app is a reference (15 Nov).

## Waiting for Lane

Nothing.

## Habits

- Keep context small: no PR subscriptions, no CI relaying. Builds report once.
- Ask Lane in one batch of multiple-choice popups, recommended answer first.
- Before assigning a fix, check that no other session is already on it.
- When a track hands over, start the fresh session from the prompt it sends, with the current reviewer ID. When the reviewer moves, tell every building session its new ID.
- Pass the reviewer's highs and mediums to the owning session. If the owner has handed over, pass them to its successor, or start a short fix session.
- A small bug that only touches the demo or the tooling goes to the backlog. A bug that breaks main gets fixed at once.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session and run list_sessions. Then send_message the open sessions in planning.md's table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Read reports with ReadNotifications. When a track hands over, start a fresh session from its prompt. Pass the reviewer's highs and mediums to the owning session. Fix anything that breaks main at once. Put Lane's ideas in the backlog and build only what he picks. Stay quiet otherwise. Hand over at about 300k tokens by rewriting docs/handover/planning.md."
