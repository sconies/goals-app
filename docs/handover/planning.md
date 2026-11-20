# Planning: handover (Wednesday 18 November, ~23:20 UTC)

Planning was session_012kbr8yQaHGoDsesfVZhHry. It handed over at about 720k tokens, too late (the rule is 300k). Main is at 1478535 (#597). **The shared-patterns track is finished and building is paused.**

## Where it stands

The handoff plan, MQ2, the drill bugs and the MQ2 follow-ups were all done by 16 Nov. Since then, Lane picked these, from the 17 Nov usability study (`docs/reviews/2026-11-17-usability-study.md`; planning's verdicts are in the backlog's "Usability study, 17 Nov" section):

- **UX1, five quick fixes: done.** #586 (the review cadence wraps at 360 px; Settings' anchors), #588 (the agenda counts say what they count; a goal's title gets its own line on a phone), #589 (a quiet link to the one-table check-in at the top of the queue).
- **Design pass: done.** #585, `docs/design/patterns/spec.md`, with Lane's answers recorded there.
- **UX2a, one goal row (GOAL-ROW): done.** #591.
- **UX2b, one form footer (FORM-FOOTER): done.** #593. It also fixed two eval-harness bugs: N8 now models a deploy; N7 no longer waits out 30 s timeouts.
- **UX2c, the rest of the form footer: done.** #596 (it also stops P3's fade-in contrast flake).
- **UX4, one page header (PAGE-HEADER): done.** #597. Lane's 18 Nov answers:
  - F15: on a phone, a list page's one action goes to the end of its list bar.
  - N2/N9: the compact sticky line takes the top bar's place.
  - N9's last 24 px were recovered by putting the section links on one row you swipe, with nothing hidden and no limit raised.

Also done on 17–18 Nov:
- **#587:** CLAUDE.md's prompt-cache habits (Lane, from inevolin/claude-code-usage-analysis).
- **#592:** a backlog tidy, with an Open list at the top, 26 finished rows moved to Done, and `scripts/backlog-page.mjs`.
- **Explorer page:** https://claude.ai/artifact/1Fv3HvpARQGXmb9UGsJ2Zr

After UX4 and UX2c, building pauses again and Faro is handed over (planning's advice to Lane on 17 Nov).

## Open sessions

| Role | Session | State |
|---|---|---|
| Backlog chat (Sonnet) | session_012kbr922AUWjVwhm6E6S6Vh | Lane's standing chat about the backlog. It adds ideas and sends small docs PRs for planning to merge. |

No build or reviewer is running. The reviewer's log and note are on `build-reviews` (docs/handover/reviewer.md). Start a fresh reviewer from that note when building resumes.

## Decided by Lane, 17–18 Nov

- The usability study: build UX1. Then a design pass for one goal row, one header and one form footer, built after UX1 as one track (UX2a, UX2b, UX4).
- The patterns' answers (spec §4–§6):
  - on a phone, status, value and gap come first, then the name;
  - "Getting worse" stays;
  - a detail page has a primary, one standing button and More;
  - a form's exit stays at the top right;
  - a form says "Close" until something is typed;
  - N26 checks where the first goal row starts.
- UX4: F15 and N2/N9 as above. A WIP push is allowed, but Lane must say so in that session.
- Merges: this track's PRs merge once CI is green and the reviewer has no high or medium. Planning merges them.
- The prompt-cache habits in CLAUDE.md.
- The backlog tidy, the explorer page and the backlog chat.

## Waiting for Lane

- The GitHub About description: "Faro: a goals (OKR) tool built as a model for an internal team to copy, with its spec, rebuild kit and a demo that needs no sign-in."
- PR CI caps by the number of checks, not by time, so a heavy PR (about 23 min locally) can still hit the 30-minute job limit. Planning recommends capping by estimated minutes. Not yet in the backlog.

## Watch

- Under parallel load these checks miss their budgets and pass alone: N18, P3, P4, F6, N12, F1. Act only if one fails on main's full run.

## Habits learned

- Check your own context with get_session every few hours. This session didn't, and ran to 720k.
- A build session refuses actions approved only by planning's relay, such as a WIP push. Ask Lane to tell that session directly.
- Archive finished sessions by name or by a Faro parent, never "everything else". Planning archived 28 non-Faro sessions by mistake on 16 Nov and restored them.
- Mechanical CI work (rebuilding api/mcp.js, reading logs) goes to a Sonnet session or subagent.
- Ask Lane in one batch of multiple-choice questions, the recommended answer first.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the Open list at the top of docs/backlog.md. Get your session ID with get_session, run list_sessions, and send_message the open sessions in planning.md's table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Read reports with ReadNotifications. Building is paused. Ask Lane in one batch what comes next. Fix anything that breaks main at once. Put Lane's ideas in the backlog (or let the backlog chat do it) and build only what he picks. Check your own context with get_session every few hours, and hand over at about 300k tokens by rewriting docs/handover/planning.md."
