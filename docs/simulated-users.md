# Simulated users: round 1

Six agents drove the built app in Chromium (phone 390×844 and desktop 1440×900, plus 320–1440 widths, light and dark for the accessibility pass) across 48 scenarios as goal owners, watchers, review runners, admins setting up from empty, goal creators, and an accessibility and polish auditor. No console or page errors in any run.

## Fixed in this round

| Severity | Finding | Fix | Guarded by |
|---|---|---|---|
| Blocker | Typing a reason in the check-in Status sheet lost focus after every key | Sheet keeps `onClose` in a ref; focus is trapped inside open sheets | U15 |
| Blocker | "Every 4 weeks" couldn't be tapped on a phone when setting up a review | How often and day stacked | U13 (now picks every 4 weeks) |
| Major | Review buttons and setup buttons hidden behind the phone tab bar | Tab bar hidden in reviews, review setup and wrap-up (focus mode) | — |
| Major | A goal created mid-cycle was judged against a plan from week 0 | Plans start from the week a goal is set up (`plan.fromWeek`, migration 0007) | unit |
| Major | Every new goal showed as Stale | Staleness counts from when a goal was set up | unit |
| Major | A restored edit draft could make a feeds-into loop, blanking a goal page | Saving refuses loops; tree code is loop-safe | unit |
| Major | "29,4" saved as 294; negatives, hex and 1e308 accepted | Decimal commas, units and thousands read properly; impossible values refused with a reason; big jumps questioned | unit |
| Major | Resuming a check-in let last week's note overwrite what the owner had written; a hidden help request was re-posted | Carry-over only offered before the owner writes; help request opens when it has text | — |
| Major | People not in a review could mark goals seen and remove its creator | Non-participants see it and can join; only participants and admins change it; the creator stays | — |
| Major | Owners weren't told about review questions or comments | Home has "For you": open questions with Answer, recent comments; the review summary shows answers | — |
| Major | Errors in the setup people table landed on the wrong row; an empty team failed | Errors map to their own row; an empty team takes yours | U5 |
| Major | Admins could add two people with the same name | Refused with an explanation | — |
| Major | No range goals in setup | "A limit" option | — |
| Major | Every page was titled "Goals"; no skip link | Title per page, skip link, focus moves to the heading on page change | — |
| Major | Posted tick empty under reduced motion | Shown drawn | P1 |
| Minor | Check-in "done" screen claimed both goals were done after one | Says what's left and offers it | — |
| Minor | Stopping a direct watch looked like it failed when a tree still covered it | Watch sheet names what covers a goal and can stop it | — |
| Minor | Only team-level goals were flagged as not linked | Any goal with no links is flagged | — |
| Minor | Phone tabs clipped | Tabs wrap on phone | — |
| Minor | Demo times used the real clock | Saved times use the app's today | — |
| Polish | "Move a metric", "1 goals", lowercased workspace names, wizard Change didn't return to the summary, step 3 focus | Fixed | — |

## Still open

- Showing the review question inside the owner's check-in, and an explicit "answered" link between a comment and a question.
- Activity filters for "goals I watch" and "comments", and defaulting it to this week.
- Goal page density on phone (fold the chart away by default; drop the trend line when the status already says it).
- Spreadsheet goals: check on upload and list every issue with its row; mark template example rows.
- Back button stepping back inside the goal wizard; Escape to close the wizard.
- Small touch targets ("Show 2 changes", breadcrumbs, close buttons at 36px).
- Leo in the demo's quick person switcher.
