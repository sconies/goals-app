# Planning: handover (Sunday 15 November, ~16:10 UTC)

Planning was session_012kbr91eefh4gwCAztBncNT. It was opened on the home folder rather than the repository, so `.claude/settings.json` never loaded and every session start asked Lane for approval. **Start the next planning session on the `sconies/goals-app` repository.** Session IDs below were current at handover; run `list_sessions` to confirm them.

## Where it stands: the plan to the handoff is done

**Item 11 is complete** (#512, #550, #551 merged, 15 Nov). The drill rebuilt the core and all nine modules on a generic stand-in platform (Node http, SQLite, its own sign-in, a stub single sign-on). It had the kit, the running app and the code, and was time-boxed to one pass per stage (Lane, 15 Nov).

- `src/domain` and every module's own code ported unchanged. The core rewired 4 Faro files (11 lines) and added about 1,900 platform lines. Modules added 1–905 lines each, mostly server-side checks on their own records. Every module was proved on, off and left out.
- **Main finding:** on a plain row store, an ordinary member could forge records in most modules until each added its own server check. R1 now says the platform must check every record kind against stored rows. Its "Record kinds the server checks" table says what Faro does, with "A rebuild should also check" in its own column (#551).
- The write-up is `docs/drill/2026-11-full-drill.md`. `docs/handoff.md`, README and architecture were rewritten from it (#512). `docs/handover/item-11.md` describes the finished state.
- **Lane's to-do:** paste the GitHub description into the repository's About box: "Faro: a goals (OKR) tool built as a model for an internal team to copy, with its spec, rebuild kit and a demo that needs no sign-in."

Nothing is planned beyond this. Everything else waits in the backlog: "Deferred to after the handoff", "Bugs found by the drill (15 Nov)" and the rest. Build only what Lane picks.

## Open sessions

| Role | Session | State |
|---|---|---|
| Build reviewer (Fable) | session_012kbr8yEo9vztTkpARWNy66 | Reviewing #551. No highs open. It can be closed once it reports. Restart it only if building starts again. |

No build sessions are running.

## What happened on 15 Nov

- **Track 3** handed over. A Sonnet tail session landed #534 (the reviewer's #520 high and mediums). #541 closed the two remaining mediums.
- **#546** fixed the U159 and U109 flakes: a focus hand-back race in Pick and WeekPick. U67 and P4 were single misses with other causes. Check the next full runs on main (rolling issue #540).
- **Item 11** merged #536–#551. It ran kit-only first, then on the stand-in platform after Lane's redefinition.
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

The GitHub About description (above). Nothing else.

## Habits

- Keep context small: no PR subscriptions, no CI relaying. Builds report once.
- Ask Lane in one batch of multiple-choice popups, recommended answer first.
- Before assigning a fix, check that no other session is already on it.
- When a track hands over, start the fresh session from the prompt it sends, with the current reviewer ID. When the reviewer moves, tell every building session its new ID.
- Pass the reviewer's highs and mediums to the owning session. If the owner has handed over, pass them to its successor, or start a short fix session.
- A small bug that only touches the demo or the tooling goes to the backlog. A bug that breaks main gets fixed at once.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session and run list_sessions. Then send_message the open sessions in planning.md's table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Read reports with ReadNotifications. When a track hands over, start a fresh session from its prompt. Pass the reviewer's highs and mediums to the owning session. Fix anything that breaks main at once. Put Lane's ideas in the backlog and build only what he picks. Stay quiet otherwise. Hand over at about 300k tokens by rewriting docs/handover/planning.md."
