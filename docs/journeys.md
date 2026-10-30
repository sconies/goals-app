# User journeys

Four profiles use the tool. Each has its own home and its own next thing to do:

| Profile | Who | Home leads with |
|---|---|---|
| Team lead | Owns goals and checks in each week | This week's check-ins, as a progress ring |
| Sponsor | Runs the weekly review and makes the calls | The review queue, worst first |
| Goals coach | Sets up workspaces and keeps the rhythm going | Load your data, then goals that have gone quiet |
| Contributor | Follows the goals their work feeds | Their team's objective and goals |

In the demo, the **Viewing as** bar at the top switches role in one tap (Team lead, Sponsor, Coach, Contributor) and opens that role's home; the person menu beside it picks someone specific. Sign-in comes later.

## The ten journeys, by priority

| # | Journey | Who | Why it ranks here | Score |
|---|---|---|---|---|
| 1 | Weekly check-in: every due goal, one at a time, then done | Lead | Update decay is the main way goal tools die; the check-in must take under a minute | 10/10 |
| 2 | "What needs me?": home shows what's due, off track, stale or slipping | Lead | Attention is the scarce resource; problems must find the person, not the other way round | 10/10 |
| 3 | Weekly review: work the queue to zero and make the calls | Sponsor | Software can't create follow-through, but it can make the review fast and every decision recorded | 10/10 |
| 4 | Set up a goal, step by step | Lead | Bad goals going in is the second failure; typed goals with a plan preview counter it | 10/10 |
| 5 | Load your own data and switch between it and the example: type people into a table, paste rows from a spreadsheet, or upload the Excel template; goals can come later | Coach | Without it nobody can try the tool on their own goals | 10/10 |
| 6 | Understand a goal and its change history | Anyone | Trust needs "last updated by" and a log nobody can edit | 10/10 |
| 7 | Propose a target change and get it approved | Owner, then sponsor | Well-ahead goals should move their target, with the original plan kept | 10/10 |
| 8 | Chase stale goals | Coach | Decay is silent; the coach needs a short list and one place to start | 10/10 |
| 9 | See how my team's work maps to the goals | Contributor | Individual contributors hear about goals monthly while managers think it's weekly | 10/10 |
| 10 | Close the cycle with a retro | Coach and leads | Silent endings fall when cycles close with an explicit continue, change or stop | Not built |

Scores come from `npm run evals`, which drives each journey in Chromium at 390px and 1440px. The latest run is in `evals/report.md`.

## The 10-point ease test

A journey scores a point only if the criterion holds on **both** a phone and a desktop:

1. **Entry**: starts from the person's home, with the way in visible without scrolling.
2. **One action**: every step shows exactly one primary button.
3. **Progress**: the person can see how far along they are (ring, steps or count).
4. **Budget**: done within the interaction budget for the journey (for example, three per on-plan check-in).
5. **Errors**: an incomplete step says what's missing in place, instead of failing silently.
6. **Finish**: finishing is confirmed and the next thing is offered.
7. **Attention**: anything off track, stale or slipping in the journey is flagged with its reason.
8. **Parity**: the same journey completes on a phone and a desktop; on a phone it may be reached differently, but nothing is missing.
9. **Accessibility**: no serious axe-core issues, and primary buttons at least 44px tall on a phone.
10. **Logged**: the change it makes is in the change log with who, when, and before → after.

## Design principles behind them

From the research reports, which looked at why OKR tools fail in large organisations:

- **Check-in in under a minute**: the number, the owner's call, and a reason only when it's needed. The owner is the updater, and "last updated by" is always shown.
- **Make decay visible**: stale goals, worsening trends and missed paths to green are flagged where people start, in one line each.
- **Anchor to the ritual**: everything counts down to the weekly review day, and the review is built from the check-ins rather than a separate status deck.
- **Record decisions**: the sponsor's review records a call on every flagged goal; an approved target re-baselines the plan and keeps the original.
- **An event log from day one**: every save is logged, and the log is append-only in the database.

For focus, assuming everyone gets distracted at times:

- **Low density**: one hero card with the next thing and a time estimate, at most three attention items up front, details behind a tap.
- **One thing at a time**: check-in, review, goal setup and import are focused flows with a progress bar, one question per section, and the button saying what happens next.
- **Small, honest rewards**: a progress ring that fills, a drawn tick on posting, a week-done screen, an on-time streak counted from the owner's own check-ins. No confetti.
- **Easy to resume**: drafts are saved as you type and offered back ("Pick up where you left off").
- **Calm motion**: 150–200ms, on state changes only, never blocking; off under reduced motion. A skeleton while loading, then a clear error with Try again.

Visual language (revised after review):

- **Flat, list-first.** In the style of Linear and Stripe: lists with hairline dividers, 8px corners, no cards inside cards, and no coloured edges or tinted boxes.
- **Status is an icon plus a word**, coloured, without a filled pill. Flags read as text ("Off track · Worsening trend — the reason").
- **Say it once.** The goal page has one status line, then only the flags that add something new (a trend, a missed path, a proposal), the owner's note, and the path back.
