# Planning: handover (Saturday 21 November, ~23:20 UTC)

The last planning session was session_012kbr8yQaHGoDsesfVZhHry. Main is at da24b119 (#600).

## Where it stands

Building was paused on 16 November. On 21 November Lane approved one track: **the design review's highs**.

**Running now:**

| Session | ID | What it does |
|---|---|---|
| Faro build: design review highs | session_012kbr8yjEw62z5jD8TFEt5Z | Fixes every finding ranked high in `docs/reviews/2026-11-design-review.md` (backlog rows DR1–DR10). Opens draft PRs; doesn't merge. |
| Faro build reviewer (design highs) | session_012kbr8yqE6nwKTBHaSguqmr | Reviews the build's PRs. Sends highs and mediums to the build; keeps lows in `docs/handover/reviewer.md` on `build-reviews`. |

Both report to planning once, when the track is done. Merging each PR is Lane's call.

The highs to fix:
- the progress ring's word spills out of the ring, is dropped on a phone, and its count disagrees with the headline;
- the projection range is nearly invisible, and its line is always red;
- the at-risk and no-recent-update marks are too faint on white (below 3:1);
- the goal map's critical path outlines goals in off-track red when they aren't off track;
- closing Find doesn't return focus to its button (WCAG 2.4.3).

**Done on 20–21 November:**
- **#598 and #599 (README):** Faro's README now opens with what it is for:
  - the problem it solves;
  - the weekly loop;
  - the ideas behind it;
  - who sees what;
  - the core and the modules;
  - the demo;
  - the model to copy.

  Profiles, the old demo people and the language about slices are gone.
- **#600 (design review):** a report covering critique, charts (the dataviz skill), copy and accessibility, plus ten proposed backlog rows. The critique, UX copy and accessibility skills weren't installed in that session, so those three passes were done by hand.

## The internal port

Lane is porting Faro to an internal platform. Its details stay out of this public repository. Planning gave Lane:
- a brief for bringing the port's descriptions in line with this README;
- a README for the internal repository.

Both are with Lane.

**Vercel in the public kit** appears only in the demo links and in the file name `server/vercel.ts` (in `docs/handoff.md` and `spec/rebuild/adapters.md`). Leave the public kit as it is.

**Open lows** (fixed only when a change touches the same lines):
- #582: Help's search reads hidden sections.
- #582: R-names' code pointer doesn't list `workspaceNameProblem`.

**Watch:** N18, P3, P4 and F6 have each failed under load and passed alone. Act if one fails on main's full run (the rolling issue "Full evals failing on main").

## Habits

- Keep context small:
  - no PR subscriptions;
  - no CI relaying;
  - builds report once;
  - hand over at about 300k tokens. The last planning session ran far past this; don't.
- Ask Lane in one batch of multiple-choice questions, the recommended answer first.
- Merging to main is Lane's call. A PR with a migration needs his OK on the SQL.
- Select sessions by Faro title or parent when closing them, never "everything else".
- A bug that breaks main is fixed at once.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session and run list_sessions. Then send your ID to the build session (session_012kbr8yjEw62z5jD8TFEt5Z) and its reviewer (session_012kbr8yqE6nwKTBHaSguqmr), so their reports reach you. Read reports with ReadNotifications. When the design-highs track reports, give Lane its PRs to merge. Fix anything that breaks main at once. Put Lane's ideas in the backlog, and build only what he picks. Stay quiet otherwise. Hand over at about 300k tokens by rewriting docs/handover/planning.md."
