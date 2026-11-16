# Planning: handover (Monday 16 November, ~03:50 UTC)

Planning was session_012kbr91eefh4gwCAztBncNT. It was opened on the home folder rather than the repository, so `.claude/settings.json` never loaded and every session start asked Lane for approval. **Start the next planning session on the `sconies/goals-app` repository.** Session IDs below were current at handover; run `list_sessions` to confirm them.

## Where it stands: the plan to the handoff is done

**Item 11 is complete** (#512, #550, #551 merged, 15 Nov). The drill rebuilt the core and all nine modules on a generic stand-in platform (Node http, SQLite, its own sign-in, a stub single sign-on). It had the kit, the running app and the code, and was time-boxed to one pass per stage (Lane, 15 Nov).

- `src/domain` and every module's own code ported unchanged. The core rewired 4 Faro files (11 lines) and added about 1,900 platform lines. Modules added 1–905 lines each, mostly server-side checks on their own records. Every module was proved on, off and left out.
- **Main finding:** on a plain row store, an ordinary member could forge records in most modules until each added its own server check. R1 now says the platform must check every record kind against stored rows. Its "Record kinds the server checks" table says what Faro does, with "A rebuild should also check" in its own column (#551).
- The write-up is `docs/drill/2026-11-full-drill.md`. `docs/handoff.md`, README and architecture were rewritten from it (#512). `docs/handover/item-11.md` describes the finished state.
- **Lane's to-do:** paste the GitHub description into the repository's About box: "Faro: a goals (OKR) tool built as a model for an internal team to copy, with its spec, rebuild kit and a demo that needs no sign-in."

## Since the handoff (15–16 Nov)

**Deep-dive fixes (done).** Lane's outside tester re-tested the live app on 15 Nov. Every finding is fixed and reviewed:
- #554: the chart draws the plan table's steps; Start over is admin-only.
- #555, #556, #559: setup takes the owner's team, Today becomes the baseline and ranges get two limits; the map text, the status (no longer a control) and the Table overlap are fixed.
- #557, #562: senders see their own feedback. Feedback steps and errors stay in browser memory and leave only with an unticked-by-default box, shown before sending (Lane: option A; errors wait for the tick too).

The three setup ideas (4-goal cap, titles and leads, per-goal team) are in the backlog's "Deep dive, 15 Nov", not built.

**MQ2, Metric quality (building; Lane approved after a grill, sketches, a Fable review and 12 journeys).** The decisions are in the MQ2 backlog row and `docs/design/mq2/`:
- Stages Draft, Defined, Verified, with Draft warning rather than blocking.
- A structured calculation (what's measured, how it's aggregated, percentiles), a structured window and a source link. Refresh is required for Defined.
- Baselines per slice, kept out of Defined.
- Verified needs a figure reproduced by someone other than the owner or last editor (admins, the source owner or named verifiers; an admin can't verify their own). It lapses on a change to calculation, window, source link or direction, or after 12 months.
- A goal's check-in rhythm follows its metric's refresh (MC's core moved in).
- A leaver's metrics pass to their lead.

Merged so far:
- #563 (migration 0056) and #564 (rules and MCP, migration 0057); Lane approved both migrations.
- #566: the form answers the similar and lapse questions.
- #568: the core loads module sheets lazily; the first download went 274 → 266 KB, budget 275 kept (planning's call).
- #567: part 3, the rhythm, the leaver hook and the sheet.
- #569: the rhythm kept on edit.
- #570: the sheet's lapse question, Left, the aggregate and the wording.

**Open:**
- #571 (screens A: library and metric page), with auto-merge.
- Screens B (define and baselines) and C (verify, picker, goal warning) on branches `claude/mq2-screens-b` and `-c`.
- #570's medium: stage notes on the import's check screen (`spreadsheets/Check.tsx`).
- The review agenda stage line, and sketch 12's look.
- Then the MQ2 backlog row is marked Done and the docs updated.

**Watch:** N18 (212 ms against 200) and P4 (contrast on `.arow-why`) each failed once under load and passed alone; F6 and a clock test too. Act if they fail on main's full run.

## Open sessions

| Role | Session | State |
|---|---|---|
| MQ2 build (part 4, B, C and the rest) | session_012kbr8xjnuNHaqDN7WVw5hc | Starting from docs/handover/mq2.md on `claude/mq2-screens-c`. Holds any migration as a draft for Lane. Updates the backlog row and docs when MQ2 is done. |
| MQ2 part 4 (A) | session_012kbr92PTe9QfmzFjm2XKzk | Handed over; may still be watching #571's CI. |
| Build reviewer (Fable) | session_012kbr8yhSnbewc3YnAc52AT | Main reviewed to about 9d178cdd (#570). No highs open. Hands over at about 20 PRs or 300k tokens. |

Every other session has stopped. Close any that still show.

## What happened on 15 Nov

- **Track 3** handed over. A Sonnet tail session landed #534 (the reviewer's #520 high and mediums). #541 closed the two remaining mediums.
- **#546** fixed the U159 and U109 flakes: a focus hand-back race in Pick and WeekPick. U67 and P4 were single misses with other causes. Check the next full runs on main (rolling issue #540).
- **Item 11** merged #536–#551. It ran kit-only first, then on the stand-in platform after Lane's redefinition.
- **Vercel previews** are off on the orphan drill branch `drill-11-rebuild` (vercel.json). Future drill branches need the same.
- The old planning session of 12 Nov (session_012kbr939zneZWtAo7UQEHRP) is archived.

## Decided by Lane, 14–16 Nov

- **Costs** (#455, CLAUDE.md): hand over at about 300k tokens; mechanical work goes to Sonnet subagents; restart the reviewer daily or every ~20 PRs; at most three build tracks.
- **Retro** (#489): check cost per merge daily, and look into anything above $15.
- **Budgets:** the first download stays at 275 KB.
- **PR CI:** core journeys plus what the PR touches, phones slowed 4×, capped at 25.
- **`faro` is exposed** in the Data API.
- **MC and FT4** are deferred to after the handoff.
- **Item 11:** time-boxed; full access to the code; rebuild on a generic stand-in platform; the running app is a reference (15 Nov).
- **Deep dive (15 Nov):** fix the highs and the clear bugs; a goal takes its owner's team; feedback steps and errors leave only with an unticked box (option A).
- **MQ2 (15 Nov):** build Metric quality in Faro, as in its backlog row, after the sketches and journeys. MC's per-goal rhythm moves into MQ2. Migrations 0056 and 0057 approved.

## Waiting for Lane

The GitHub About description (above), if not yet pasted. Approval of any MQ2 migration PR (none expected).

## Habits

- Keep context small: no PR subscriptions, no CI relaying. Builds report once.
- Ask Lane in one batch of multiple-choice popups, recommended answer first.
- Before assigning a fix, check that no other session is already on it.
- When a track hands over, start the fresh session from the prompt it sends, with the current reviewer ID. When the reviewer moves, tell every building session its new ID.
- Pass the reviewer's highs and mediums to the owning session. If the owner has handed over, pass them to its successor, or start a short fix session.
- A small bug that only touches the demo or the tooling goes to the backlog. A bug that breaks main gets fixed at once.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session and run list_sessions. Then send_message the open sessions in planning.md's table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Read reports with ReadNotifications. When a track hands over, start a fresh session from its prompt. Pass the reviewer's highs and mediums to the owning session. Fix anything that breaks main at once. Put Lane's ideas in the backlog and build only what he picks. Stay quiet otherwise. Hand over at about 300k tokens by rewriting docs/handover/planning.md."
