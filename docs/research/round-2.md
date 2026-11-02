# Research round 2 and the visual review · 2 November 2026

Two reports:
- **Research round 2** (ChatGPT Codex, an AI agent): it re-tested round 1's nine fixes (all fixed) and reported six new findings.
- **Visual and responsive review** (an AI agent): fifteen findings. It could only see one desktop width (1363px), so we took its wide-screen findings further with our own screenshots at 1920, 2560 and 3440.

## Research round 2

| # | Finding | Verdict | What changed |
|---|---|---|---|
| 1 | After a target change, the latest number's gap was measured against the new plan | Real | The latest number is judged against the plan of its own week, everywhere (one rule in `assessPosted`). |
| 2 | Workspace setup planned from the start of the year, so its goals "missed" Q1–Q3 | Real | Goals set up mid-year start from today's number this week, like New goal. |
| 3 | A coverage goal with a 150% target accepted 150% | Real; the app can't know it's a share | Every form asks when a percentage target passes 100%: "Fine for growth; but a share can't pass 100%". A goal planned within 0–100% still refuses more than 100%. |
| 4 | "N more in Activity" lost Watching's scope | Real | Activity takes the scope (the goals you watch, a level, since the week began), says so, and has "Show all activity". |
| 5 | The check-in walkthrough asked for a field that wasn't there once the week was done | Real | The done screen offers "check in again" on each goal; a walkthrough step can say and point at something else when its target isn't there. The new eval found two bugs behind this: going from Check-in to a goal's check-in kept the old, empty queue; and a walkthrough skipped a step if you started it on that step's page. Both are fixed. |
| 6 | "This week" meant the last seven days | Real | It's the app's week, with its dates. |

## Visual and responsive review

| # | Finding | What changed |
|---|---|---|
| 1 | The Table clipped Gap and Trend | One set of column widths for every group; text wraps; Trend, then Owner, give way when narrow; a wide frame. |
| 2 | The map was a thin band of tiny goals | It fills the window. A goal with many inputs stacks them in columns of three, each joined to the goal by a line down its side, so no line crosses a goal. |
| 3 | Board and Cards turned updates into essays | Lanes and cards at least 280–300px. A brief story: why in two lines, by when, and one warning plus a count. The full story stays on the goal and in the Table. |
| 4 | Home had no wide layout | From 1100px: the week's action, your goals and changes on the left; what needs your response on the right. |
| 5 | A goal made you scroll to see its chart | The chart comes straight after the status. On a wide screen, the owner's account sits beside it. On a 1440×700 laptop the chart starts above the fold (P7). |
| 6 | Controls under 44px on touch | 44px on every touch screen, tablets included. |
| 7 | Goals spent too much height on controls | One toolbar: which goals on the left, how to see them on the right. The map hides the status key it doesn't need. |
| 8 | The percentage chart ran to 176 | A share stays on a 0–100% scale, and the trend line stops at the edge. |
| 9 | Status marks without their word | Every goal row has a status slot with shape and word. Flags use the warning mark. P3 and P4 now check every shape on every screen. |
| 10 | Reviews looked unstyled | Each review row is one link: no underlines, a 72px row, a focus outline. |
| 11 | Edit goal led with a long plan table | The week-by-week table is behind "Plan by week". It opens on its own if numbers were set by hand. |
| 13 | Watching, Activity and Workspace were narrow feeds | Watching gets the side column for what changed this week. Activity stays a narrow feed by design. |
| 14 | The walkthrough covered the review's buttons | When it moves to the top, it sits below the review bar. |

Not done this round:
- **12** (one visual grammar for choices and footers);
- **15** (Import and Export layout);
- Workspace's settings-versus-directory split;
- Demo menu sections.
These are polish with no wrong results, and they're next.

New evals:
- **P7**: wide screens and a short laptop;
- **P3/P4**: every status shape has its word;
- **U31**: check in again after the week is done, the walkthrough fallback, and Activity's scope;
- a **HONEST-NUMBERS** scenario;
- the **WIDE-SCREENS** requirement;
- unit tests for the latest gap after a re-plan, and for goals set up mid-year.
