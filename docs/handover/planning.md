# Planning: handover (Saturday 14 November, ~15:30 UTC)

Planning was session_012kbr91eefh4gwCAztBncNT. It was opened on the home folder rather than on the repository, so `.claude/settings.json` never loaded and every session start asked Lane for approval. **Start the next planning session on the `sconies/goals-app` repository**, so starting and messaging sessions run without prompts.

## The plan to the handoff (Lane)

Finish the tracks' lists below, then **KL** (the retro's lessons built into `src/spec/rebuild.ts`), then **item 11**: one session runs the full drill from `spec/` and `llms.txt` alone, core first and then each module on its own. The same session rewrites README.md, docs/handoff.md and docs/architecture.md from the module map and the generated spec, and drafts a one-line GitHub description for Lane.

Out of scope until after the handoff: PF1–PF2 and every review low (backlog, "Deferred to after the handoff", #483); WM, 0c2, 0t and 3a.

## Open sessions (at most three build tracks, plus the reviewer)

| Track | Session | List, in order |
|---|---|---|
| 1 (Home, reviews, check-in) | session_012kbr8xcik1h2gfbMLvPnKV | #482 (Lane's answers, auto-merge), gate #469 HM4, gate #492 (Home's one-team fix), SM1h (#491), HM7, HB3 |
| 2 (goal entry, set-up) | session_012kbr8yZ7UiGDzWqA8TwbbQ | #495 (the #475 medium), TG1 #487 (fix its axe and contrast failures), TG2 #493; then the list is done |
| 4 (architecture, switches) | session_012kbr934nkdcyyV7KxsKcqN | #476, #480, FT1 (#465: redo its merge of main), Help hides switched-off modules, SW2, KL |
| Reviewer (Fable) | session_012kbr8zWCPJxkmsiZx169kF (fresh 15:30) | reviews each code PR merged after cadff60d (#488) when its track messages it; hands over after about 20 PRs. Its note lives in docs/handover/reviewer.md on branch build-reviews |

**Waiting for a free slot:**
- **Track 7d (metrics),** read docs/handover/track-7.md:
  - GR #464 is built and passing; it only needs main merged in. When it merges, add `guards` to `BUILT_KEYS` (changeset.ts), or a file can never clear a goal's guards.
  - MQ: branches mq-migration and mq-structure, no PRs yet.
  - The MS and BL review mediums.
  - MC (needs FT1 on main).
- **Track 3 (import),** read docs/handover/track-3.md: MI (round 2's MT6), and U98's Stop-step flake (keeps rolling issue #459 open).

Each track writes its handover into its own file in `docs/handover/`, replacing the previous entry. When a track hands over, start a fresh session from the prompt it sends.

## Decided by Lane, 14 Nov

- **Costs** (#455, CLAUDE.md): hand over at about 300k tokens of context; mechanical work goes to Sonnet subagents; the reviewer restarts daily or every ~20 PRs; at most three build tracks.
- **Retro** (#489, docs/retros/2026-11-14-lessons-learned.md): $4,153 across 131 sessions, 7–14 Nov, about $13 a merge; now about $8–10. Check cost per merge daily, and look into anything above $15.
- **Handover file split** (#490): one short file per role.
- **Budgets:** the first download stays at 275 KB (now 259 after FD #471); live 334 KB (now 318).
- **PR CI** (#462, #480): runs the core journeys plus what the PR touches, phones slowed 4×, capped at 25 journeys.
- **`faro` is exposed** in the Data API (checked 13 Nov 23:40).
- **Readings:**
  - A pre-filled reading needs a touch before it's posted.
  - Readings stay visible with the Metric library off.
- **Review answers:**
  - An admin's correction keeps the owner as author at every door, and History names the admin (#482).
  - An ended year: a missing week can be added late with a reason; replacing a check-in is refused.
  - "Before this review" is visible to the whole workspace.
  - Help hides a switched-off module's articles; What's new keeps them.
  - Admin-only triage rests on the browser flag: accepted for Faro, and R1 keeps the server requirement.
  - "Opened" on a proposed goal is stored on the server per person.
- **TG** (tags module): 1a–7a as recommended.
- **The demo clock** stays unpinned (track 1 and track 4).

## Waiting for Lane

Nothing.

## Habits

- Keep context small: no PR subscriptions, no CI relaying. Builds report once.
- Ask Lane in one batch of multiple-choice popups (AskUserQuestion), recommended answer first. If he's away, list the questions in text and ask again when he's back.
- A planning slip to avoid: before assigning a fix, check that no other session is already on it. On 14 Nov the 09:00 fault and #452's high were each nearly built twice.
- Give every fresh session the reviewer rule: send each merged code PR's number to the reviewer in one line.

## Prompt for the next planning session

"You are Faro's planning session. Read CLAUDE.md, docs/handover/planning.md and the headings of docs/backlog.md. Get your session ID with get_session, then send_message every open session in planning.md's table: 'Planning has moved to session <ID>. Report there from now on, and send only finished results and blockers.' Then read reports with ReadNotifications. When a track hands over, start a fresh session from its prompt. Pass the reviewer's highs and mediums to the owning track. Fix anything that breaks main at once. Put Lane's ideas in the backlog and build only what he picks. Stay quiet otherwise. Hand over at about 300k tokens, by rewriting docs/handover/planning.md."
