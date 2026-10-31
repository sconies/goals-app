# Eval scorecard · 3 · Updating a goal

Run 2026-10-31 01:21 UTC.

## Journeys: ease of use out of 10, on a phone and a desktop

Each journey is driven in Chromium at 390px and 1440px and checked against the ten criteria below. A criterion counts only if it holds on both. “–” means it doesn’t apply to that journey, and the score is out of the ones that do.

| # | Journey | Score | entry | one-action | progress | budget | errors | finish | attention | parity | a11y | logged | Steps (phone · desktop) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Weekly check-in, all due goals in one pass | **10** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 12 · 12 (budget 17) |
| 2 | What needs me? Home shows what’s due, off track, stale or slipping | **10** | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | 1 · 1 (budget 1) |
| 3 | Weekly review: work the queue to zero and make the calls | **10** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 9 · 9 (budget 13) |
| 4 | Set up a goal, step by step | **10** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | 11 · 10 (budget 12) |
| 5 | Load your own data and switch between it and the example | **10** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | 9 · 9 (budget 11) |
| 6 | Understand a goal and its change history | **10** | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | 4 · 4 (budget 3) |
| 7 | Propose a target change and get it approved | **10** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 17 · 17 (budget 18) |
| 8 | Chase stale goals | **10** | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | 1 · 1 (budget 1) |
| 9 | See how my team’s work maps to the goals | **10** | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | 1 · 1 (budget 1) |
| 10 | Close the cycle with a retro | **0** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 0 · 0 (budget 0) |

- **entry**: Starts from the person's home, with the way in visible without scrolling
- **one-action**: Every step shows exactly one primary action
- **progress**: The person can see how far along they are (ring, steps or count)
- **budget**: Done within the interaction budget for the journey
- **errors**: An incomplete step says what's missing, in place, instead of failing silently
- **finish**: Finishing is confirmed, with the next thing offered
- **attention**: Anything off track, stale or slipping in the journey is flagged with its reason
- **parity**: The same journey completes on a 390px phone and a 1440px desktop
- **a11y**: No serious accessibility issues; primary buttons are at least 44px tall on a phone
- **logged**: The change it makes is in the change log with who, when and before → after

### What cost points

- **U10** Close the cycle with a retro: phone: Not built yet: there is no cycle close or retro.; desktop: Not built yet: there is no cycle close or retro.

## Requirements

**34 of 34 pass**. Spec scenarios 56/56.

| | Requirement | Area | Scenarios | Journeys and checks |
|---|---|---|---|---|
| ✅ | **PLAN-SHAPE** Plans can be straight, back-loaded ((w/13)^1.5) or stepped, and set the weekly checkpoint. | Plans | 3 | U4 |
| ✅ | **FORECAST** Forecast is the last three weeks' slope projected to the end of the cycle, and only shown with enough data. | Plans | 2 | — |
| ✅ | **REBASELINE** Changing a plan after check-ins start re-baselines it and keeps the original visible. | Plans | 1 | U6, U7 |
| ✅ | **PLAN-CHANGE** Once check-ins have started, the owner proposes a plan change with a reason; it waits for the sponsor's approval in the review, and the current plan stands until then. | Plans | 0 | U7 |
| ✅ | **CARRY-OVER** When a check-in still needs a reason or a path back, last week's are offered back: 'Still true' carries them over, 'It's changed' opens them for editing. | Check-ins | 0 | U1 |
| ✅ | **NOTES** Anyone can add a mid-week note to a goal; it shows in the goal's activity and is logged. | Change log | 0 | U6 |
| ✅ | **STATUS-BANDS** Metric: on track at 95% of planned progress or more, at risk 80–95%, off track below 80%. | Status rules | 8 | — |
| ✅ | **STATUS-DIRECTION** Lower-is-better metrics are judged the same way as higher-is-better ones. | Status rules | 3 | — |
| ✅ | **RANGE** Range: at risk inside the warning margin or after one breach; off track after two weeks out of range. | Status rules | 6 | — |
| ✅ | **MILESTONE** Milestone: a stage up to 2 weeks late is at risk, more is off track; an overdue stage counts as late. | Status rules | 6 | — |
| ✅ | **OWNER-CALL** The owner's call is the official status shown everywhere, with the calculated status beside it. | Status rules | 1 | — |
| ✅ | **GREENER** A call greener than the calculation needs a reason and is flagged on the goal. | Check-in | 3 | — |
| ✅ | **REASON-BEHIND** A reason (cause and explanation) is required when behind plan (below 95%). | Check-in | 3 | U1 |
| ✅ | **REASON-AHEAD** A reason is required when 120% or more ahead, and the check-in asks whether the target should change. | Check-in | 3 | U7 |
| ✅ | **PATH-TO-GREEN** At risk and Off track need a path to green: what changes and a future week it is back on plan by, plus any decision needed. | Check-in | 4 | U1 |
| ✅ | **CHECKIN-STATUS-VS-PLAN** The check-in shows actual against plan today, the gap, the forecast and the calculated status as the value is typed. | Check-in | 1 | U1 |
| ✅ | **ONE-PER-WEEK** One check-in per goal per week; editing replaces it. | Check-in | 0 | U1 |
| ✅ | **UPDATE-ANYTIME** The owner can post an update at any time from the goal page. It is the same check-in flow; after this week's check-in it replaces that week's number and status, and the change log keeps the before and after. | Check-in | 0 | U1 |
| ✅ | **OWNER-ONLY** Only the goal's owner can post its check-in. | Check-in | 0 | U9 |
| ✅ | **STALE** No owner check-in for 14 days shows as Stale, never as on track. | Status rules | 6 | U2, U8 |
| ✅ | **HIERARCHY** A headline goal with input goals from several teams, each with an estimated effect; the headline shows its inputs and their mix of statuses. | Goals | 3 | U4, U9 |
| ✅ | **GOAL-CREATE** A lead can create a metric, range or milestone goal with a plan, and invalid input is explained. | Goals | 3 | U4 |
| ✅ | **GOAL-PAGE** The goal page shows status strip, why, path to green, chart with plan/forecast/path back, and check-in history. | Goals | 0 | U6 |
| ✅ | **PERSIST** Changes are saved and survive a reload; demo data can be reset. | Platform | 0 | U1 |
| ✅ | **PHONE** Every screen works at phone width (390px) with no horizontal scrolling. | Platform | 0 | P3 |
| ✅ | **A11Y** No serious or critical accessibility violations (axe-core); status is shape plus word, never colour alone. | Platform | 0 | P3, P4 |
| ✅ | **NO-ERRORS** No console or page errors on any screen. | Platform | 0 | P2, P5 |
| ✅ | **PROFILES** Each profile (team lead, sponsor, coach, contributor) gets its own home with one clear next thing to do. | Profiles | 0 | U1, U2, U3, U5, U8, U9 |
| ✅ | **ATTENTION** Off track, stale, a worsening trend, a missed or missing path to green, and pending proposals are flagged where the user starts, with the reason in one line. | Attention | 0 | U2, U3, U6, U8 |
| ✅ | **REVIEW** The sponsor works the review queue to zero, one goal at a time; every call is recorded and an approved target re-baselines the plan. | Review | 0 | U3, U7 |
| ✅ | **CHANGE-LOG** Every save (goal, plan, check-in, comment, decision, workspace) is logged with who, when and each field's before and after. Drafts are not logged. | Change log | 0 | U1, U3, U4, U5, U6, U7 |
| ✅ | **DRAFTS** Unsaved answers survive leaving a flow and are offered back when the user returns. | Focus | 0 | U1, U4 |
| ✅ | **WORKSPACES** The example and your own data live in separate workspaces; you can load your own from a spreadsheet, with every row checked, and switch back. | Data | 0 | U5 |
| ✅ | **MOTION** Motion is subtle and never blocks; it switches off under reduced motion. Loading shows a skeleton, not a blank page. | Platform | 0 | P1, P2 |

## Platform checks

- ✅ **P1** Animation switches off under reduced motion
- ✅ **P2** Loading shows a skeleton, and an unreachable database becomes a clear error with Try again
- ✅ **P3** Every screen on phone: no sideways scroll, no serious accessibility issues, status as shape plus word
- ✅ **P4** Every screen on desktop: no sideways scroll, no serious accessibility issues, status as shape plus word
- ✅ **P5** No console or page errors across every journey

## Not built yet

- Close the cycle with a retro (journey 10)
- Dependencies between goals
- Jira context
- Slack check-in cards and reminders
- AI coaching on a draft (beta)
- Sign-in and per-person permissions
- Data integrations (Power BI, Grafana, ServiceNow)
