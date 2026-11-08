# Setup review: creating a small workspace, 8 November 2026

The same outside reviewer created "Voss Test Workspace" through the 7-step set-up (10:12–10:18): 10 invented people in one team, a north star (Weekly active users 1,200 → 2,000) and three goals (Support response time 8 → 4 hours; Customer interviews 0 → 12; Build time 10 → 6 min). It worked end to end with no sign-in or external step, persisted across personas and workspace switches, and nothing leaked between workspaces. They posted one check-in (on plan, so one step: "good adaptive design") and created a review by hand. The workspace is still there.

Triaged by the planning session into backlog item S (set-up polish).

## Critical
1. **Set-up promises a weekly review, then doesn't create one.** Steps 1 and 7 say "weekly review on Thursdays" (`src/screens/Onboarding.tsx`, `reviewDay` is only a cycle setting); afterwards Reviews says none yet, while Home talks about "this week's Thursday review". Create the first review (everyone, every goal, on that day), or stop promising one.
2. **Set-up never asks how a goal is measured.** Every new goal page says "how it's measured is not described yet", with no prompt to fill it in. Ask in step 5/6 (one optional line), and prompt on the goal page.
3. **A new workspace is born late.** Created on Sunday 8 Nov, it inherits week 45 of a January year: the first check-in is already "3 days late", and a review created afterwards has its first session in the past (Thu 5 Nov). A workspace created mid-week should start with nothing overdue: first check-in due at the next review day, first review session in the future; consider offering a year that starts now.

## Important
4. Validation on steps 2 and 5 is one combined message: only the first empty field gets text, the rest only red borders. Per-field messages.
5. Team entry: the Team column is too narrow to read; no copy-down / apply to all, so the same team is typed 9 times; free text, so a typo silently makes a second team. Pick from teams already entered (find-and-pick, item 0a) with "same as above".
6. Step 7 (Check) shows targets but not the Today/start values.
7. The plan is a straight line with no way to shape it at set-up; step 7 says the goal year starts in January, odd for a workspace made in November (see 3).
8. Copy: "All your goal is checked in" for a one-goal owner. The on-time streak shows 0 weeks after a check-in with no explanation that it starts after a review.

## Nice to have / not tested
- Spreadsheet upload and "set goals up later" not tested.
- New workspaces get no saved views.
- The sidebar truncates the workspace name ("Voss Test Worksp…") even at 1920 px (same as saved views in the demo review).
- Whether Start over or Delete fully removes a created workspace is unverified.
