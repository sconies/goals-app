// The field table and every sheet’s columns, copied from the kit (spec/core/export-format.md, the field table rule).
// Faro makes these from src/domain/columns.ts; here they are data. Regenerate with local/genfields.mjs.
export const FORMAT = {
 "Goals": {
  "intro": "One row per goal. Every goal: what it is, who owns it, its plan, and where it stands. Add a row with no Key or ID for a new goal.",
  "needs": "A new row needs Goal, and Owner or Owner email. A number goal also needs Start and Target; a range goal, Limit; a stages goal, Stages.",
  "always": [
   "Key",
   "ID"
  ],
  "cols": [
   {
    "col": "Key",
    "need": "Leave empty",
    "format": "G- and a number",
    "example": "G-12",
    "empty": "Faro gives a new goal the next key",
    "means": "The goal’s short key in this workspace (G-12). It never changes, and a goal carried into the next cycle keeps it. Leave it empty for a new goal.",
    "back": "Matches the goal first, so a file from last cycle still finds its goals"
   },
   {
    "col": "ID",
    "need": "Leave empty",
    "format": "Faro’s own",
    "example": "goal_hzde4g",
    "empty": "Faro gives a new goal its own",
    "means": "The goal’s identity in this cycle. Leave it empty for a new goal.",
    "back": "Matches the goal when there’s no Key"
   },
   {
    "col": "Goal",
    "need": "Required",
    "format": "Text, 3 characters or more",
    "example": "Deploy lead time",
    "empty": "Must fix: a new goal needs a name",
    "means": "The goal’s name.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Action",
    "need": "Optional",
    "format": "Stop, Delete or Example",
    "example": "Stop",
    "empty": "The row adds or changes the goal",
    "means": "Empty to add or change the goal. Stop stops a goal with check-ins (say why in Reason); Delete deletes one with none, set up by mistake.",
    "back": "Done when loaded back, with the same rules and preview as the app"
   },
   {
    "col": "Ref",
    "need": "Optional",
    "format": "Text, each row its own",
    "example": "top",
    "empty": "Other rows name it by Goal or Key instead",
    "means": "A label of your own for this row, so other rows in the same file can name the goal it adds before it has a key (Feeds into ref, Goal ref). Only for this file: never kept. Empty in an export.",
    "back": "Names the row’s goal for Feeds into ref and Goal ref in the same file"
   },
   {
    "col": "Level",
    "need": "Optional",
    "format": "north star, svp or team",
    "example": "team",
    "empty": "team",
    "means": "north star, svp or team: how important it is, for reporting.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Team",
    "need": "Optional",
    "format": "A team’s name",
    "example": "Platform",
    "empty": "The owner’s team",
    "means": "The team it belongs to, by name.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Owner",
    "need": "Required (or Owner email)",
    "format": "A name only one person has",
    "example": "Ben Ortiz",
    "empty": "Owner email says who; with neither, Must fix",
    "means": "Who owns it, by name. A name works when only one person has it; Owner email is exact.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Owner email",
    "need": "Required (or Owner)",
    "format": "An email",
    "example": "ben.ortiz@example.com",
    "empty": "Owner says who; with neither, Must fix",
    "means": "Who owns it, by email: what tells two people with the same name apart.",
    "back": "Changes the owner; when Owner and Owner email disagree, the one you changed counts"
   },
   {
    "col": "Type",
    "need": "Optional",
    "format": "metric, range or milestone",
    "example": "metric",
    "empty": "Read from the columns filled in: Start and Target a number goal, Limit a range goal, Stages a stages goal (none, or two of them, is Must fix). A goal’s type can’t change later",
    "means": "metric, range or milestone: move a number, keep one in range, or hit dated stages.",
    "back": "Sets a new goal’s type; it can’t change on an existing goal"
   },
   {
    "col": "State",
    "need": "Optional",
    "format": "active or proposed",
    "example": "proposed",
    "empty": "As it is",
    "means": "active or proposed.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Unit",
    "need": "Optional",
    "format": "Text",
    "example": "days",
    "empty": "No unit, never “%” by default: a Check asks once a file whether the numbers are plain counts. On a row already here, empty clears it",
    "means": "Number and range goals: what the number counts (%, days, ms).",
    "back": "Changed when loaded back"
   },
   {
    "col": "Decimals",
    "need": "Optional",
    "format": "0, 1, 2 or 3",
    "example": "1",
    "empty": "The most decimal places typed in Start, Target or Limit, up to 3",
    "means": "Number and range goals: how many decimal places the number has (0 to 3).",
    "back": "Changed when loaded back"
   },
   {
    "col": "Start",
    "need": "Required for a number goal",
    "format": "A number",
    "example": "5",
    "empty": "Must fix for a number goal",
    "means": "Number goals: where the plan starts.",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Baseline period",
    "need": "Optional",
    "format": "Text, at most 60 characters; none to remove it",
    "example": "June to September 2026",
    "empty": "As it is",
    "means": "Number goals: the period the baseline (Start) covers, when it is a figure you already have (June to September 2026). Shown as the goal’s number until its first check-in.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Baseline is",
    "need": "Optional",
    "format": "provisional or firm",
    "example": "provisional",
    "empty": "As it is",
    "means": "Number goals with a baseline period: provisional or firm. Firming up a provisional baseline isn’t a plan change.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Target",
    "need": "Required for a number goal",
    "format": "A number, different from Start",
    "example": "1",
    "empty": "Must fix for a number goal",
    "means": "Number goals: where the plan ends, by its due week.",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Plan",
    "need": "Optional",
    "format": "straight, back-loaded or stepped",
    "example": "back-loaded",
    "empty": "straight",
    "means": "Number goals: the plan’s shape, straight, back-loaded or stepped.",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "From",
    "need": "Optional",
    "format": "A year and a week",
    "example": "2026-W46",
    "empty": "This week",
    "means": "Number goals: the week the plan starts from (2026-W46).",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Plan from week",
    "need": "Optional",
    "format": "A whole number of weeks from the cycle’s start",
    "example": "46",
    "empty": "This week (0 when setting up a workspace)",
    "means": "Number goals: the week the plan starts from (0 for the cycle’s start, later for a goal set up mid-cycle).",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "To",
    "need": "Optional",
    "format": "A year and a week, after From",
    "example": "2026-W53",
    "empty": "The cycle’s last week",
    "means": "Number goals: the week the target is due (2027-W13).",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Due week",
    "need": "Optional",
    "format": "A whole number, after Plan from week; a date in the cycle is read as its week",
    "example": "53",
    "empty": "The cycle’s last week. On a row already here, empty clears it",
    "means": "Number goals: the week the target is due, counted from the cycle’s start.",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Limit",
    "need": "Required for a range goal",
    "format": "A number, or two (99.5–99.95, 99.5 to 99.95)",
    "example": "5",
    "empty": "Must fix for a range goal",
    "means": "Range goals: the number it must stay within, or both of two (99.5–99.95).",
    "back": "Changed when loaded back"
   },
   {
    "col": "Must stay",
    "need": "Optional",
    "format": "at most, at least or between",
    "example": "at most",
    "empty": "at most",
    "means": "Range goals: at most, at least or between the limit.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Margin",
    "need": "Optional",
    "format": "A number, zero or more",
    "example": "0.5",
    "empty": "No warning margin (0)",
    "means": "Range goals: how close to the limit counts as at risk.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Stages",
    "need": "Required for a stages goal",
    "format": "Name@week; Name@week (weeks from the cycle’s start; a date in the cycle is read as its week; each stage its own name)",
    "example": "Design@48; Pilot@52",
    "empty": "Must fix for a stages goal",
    "means": "Milestone goals: each stage as Name@week, separated by semicolons.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Feeds into",
    "need": "Optional",
    "format": "A goal’s name",
    "example": "Deploy lead time",
    "empty": "It feeds nothing. On a row already here, empty clears it",
    "means": "The goal this one feeds, by name.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Feeds into key",
    "need": "Optional",
    "format": "A goal’s key",
    "example": "G-1",
    "empty": "It feeds nothing. On a row already here, empty clears it",
    "means": "The goal this one feeds, by key. Exact where names repeat.",
    "back": "Changes what it feeds; when Feeds into and Feeds into key disagree, the one you changed counts"
   },
   {
    "col": "Feeds into ref",
    "need": "Optional",
    "format": "The Ref of another row in this file",
    "example": "top",
    "empty": "Feeds into or Feeds into key says what it feeds",
    "means": "The goal this one feeds, by the Ref of its row in this file: a goal the same file adds. Empty in an export.",
    "back": "Changes what it feeds, like Feeds into key"
   },
   {
    "col": "Why it helps",
    "need": "Optional",
    "format": "Text",
    "example": "Fewer failed deploys mean fewer rollbacks",
    "empty": "Nothing said. On a row already here, empty clears it",
    "means": "Why this goal should move the one it feeds: a hypothesis, not a proven cause.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Effect",
    "need": "Optional",
    "format": "A number, in the fed goal’s unit",
    "example": "1",
    "empty": "Nothing said. On a row already here, empty clears it",
    "means": "The effect expected on the goal it feeds, in that goal’s unit.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Source",
    "need": "Optional",
    "format": "Text",
    "example": "CI dashboard",
    "empty": "Nothing said. On a row already here, empty clears it",
    "means": "Where the number comes from, and who owns that source.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Definition",
    "need": "Optional",
    "format": "Text",
    "example": "Median hours from first commit to production",
    "empty": "Nothing said. On a row already here, empty clears it",
    "means": "Exactly what is counted.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Reason",
    "need": "Required with Stop, and when a plan changes after check-ins began",
    "format": "Text",
    "example": "Agreed at the Q4 review",
    "empty": "The preview asks for one reason for every plan change",
    "means": "Why the plan is changing, or why the goal stops. Written by you; empty in an export.",
    "back": "Kept in the change log with the change"
   },
   {
    "col": "Status",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Where the goal stands now, in the status words defined under Words below; Proposed for a proposed goal.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Since",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "How long it has stood so.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Now",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The latest number, or stages done.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Plan this week",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Number goals: the plan’s number this week.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Gap",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "How far it is from the plan, said the same whichever way is better.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Last check-in week",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The week of its latest check-in.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Forecast",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Where the recent trend takes it by its due week.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Why it’s off",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The owner’s latest reason, when it’s behind.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Recovery plan",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "What the owner will do about it.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "By when",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "When it will be back on plan, or why there’s no date.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Needs",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The open asks for a decision or help.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Next step",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The owner’s next step.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Warnings",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "What the numbers would hide; each warning starts with its word, defined under Words.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Result",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Set once the goal is due, in the result words defined under Words.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Q1",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The first quarter against the owner’s plan: a quarter’s target is the plan’s number at its end.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Q2",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The second quarter against the plan.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Q3",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The third quarter against the plan.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Q4",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The fourth quarter against the plan.",
    "back": "Worked out by the app; ignored when loaded back"
   }
  ]
 },
 "Plan": {
  "intro": "One row per number goal. The plan as numbers, one column per week. Type over any week to set the plan by hand.",
  "needs": "",
  "always": [
   "Key",
   "ID"
  ],
  "cols": [
   {
    "col": "Key",
    "need": "Required (or ID)",
    "format": "G- and a number",
    "example": "G-12",
    "empty": "ID says which goal; with neither, Must fix",
    "means": "The goal’s key.",
    "back": "Matches the goal first"
   },
   {
    "col": "ID",
    "need": "Required (or Key)",
    "format": "Faro’s own",
    "example": "goal_hzde4g",
    "empty": "Key says which goal; with neither, Must fix",
    "means": "The goal’s ID in this cycle.",
    "back": "Matches the goal when there’s no Key"
   },
   {
    "col": "Goal",
    "need": "For reading",
    "format": "Text",
    "example": "Deploy lead time",
    "empty": "Never read: change the name on Goals",
    "means": "The goal’s name (change it on Goals).",
    "back": "For reading; not loaded back from this sheet"
   },
   {
    "col": "Unit",
    "need": "For reading",
    "format": "Text",
    "example": "days",
    "empty": "Never read: change the unit on Goals",
    "means": "What the number counts (change it on Goals).",
    "back": "For reading; not loaded back from this sheet"
   },
   {
    "col": "Start",
    "need": "Optional",
    "format": "A number",
    "example": "5",
    "empty": "The plan keeps its start",
    "means": "Where the plan starts.",
    "back": "Changes the plan; needs a reason once check-ins have started"
   },
   {
    "col": "Week N",
    "need": "Optional",
    "format": "A number, only for weeks inside the plan",
    "example": "4.2",
    "empty": "The plan keeps its own number that week",
    "means": "The plan’s number that week, from the week after Plan from week to the due week. Empty before and after. If the plan changed, earlier check-ins were judged against the plan of their day (Plan that week on Check-ins).",
    "back": "Sets the plan numbers by hand; needs a reason once check-ins have started"
   }
  ]
 },
 "Check-ins": {
  "intro": "One row per check-in. Every check-in: the number or stages reported each week, the owner’s call and their account of it. Add a row with no ID for a new check-in, a past week included.",
  "needs": "A new row needs Goal key (or Goal), Week, and Value or Stages.",
  "always": [
   "ID",
   "Goal key",
   "Goal ID",
   "Week"
  ],
  "cols": [
   {
    "col": "ID",
    "need": "Leave empty",
    "format": "Faro’s own",
    "example": "ci_4kd9",
    "empty": "A new check-in, or a correction of that goal’s check-in for the week",
    "means": "The check-in’s own identity. Leave it empty to add one.",
    "back": "Matches the check-in; with none, a row corrects that goal’s latest check-in for the week"
   },
   {
    "col": "Goal key",
    "need": "Required (or Goal ID, or Goal)",
    "format": "G- and a number",
    "example": "G-14",
    "empty": "Goal ID or Goal says which goal; with none of them, Must fix",
    "means": "The goal’s key.",
    "back": "Matches the goal first"
   },
   {
    "col": "Goal ID",
    "need": "Required (or Goal key, or Goal)",
    "format": "Faro’s own",
    "example": "goal_hzde4g",
    "empty": "Goal key or Goal says which goal",
    "means": "The goal’s ID in this cycle.",
    "back": "Matches the goal when there’s no Goal key"
   },
   {
    "col": "Goal",
    "need": "Required (or Goal key, or Goal ID)",
    "format": "The goal’s exact name, when only one goal has it",
    "example": "Pipeline queue wait (p90)",
    "empty": "Goal key or Goal ID says which goal",
    "means": "The goal’s name.",
    "back": "Matches the goal by name, only when there’s no Goal key or Goal ID"
   },
   {
    "col": "Goal ref",
    "need": "Optional",
    "format": "The Ref of a row on Goals in this file",
    "example": "top",
    "empty": "Goal key, Goal ID or Goal says which goal",
    "means": "The goal, by the Ref of its row on Goals in this file: a goal the same file adds. Empty in an export.",
    "back": "Matches the goal the Goals row with that Ref adds or changes, first"
   },
   {
    "col": "Week",
    "need": "Required",
    "format": "A whole number from 1 to this week; a date in the cycle is read as its week",
    "example": "46",
    "empty": "Must fix",
    "means": "The week it reports on, counted from the cycle’s start (week 1 onwards).",
    "back": "Matches the week; a check-in’s week never changes"
   },
   {
    "col": "Week starting",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "The date that week starts.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Value",
    "need": "Required for a number or range goal",
    "format": "A number, at the goal’s decimal places",
    "example": "6",
    "empty": "Must fix for a number or range goal",
    "means": "Number and range goals: the number that week.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Number from",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "“Typed”, or the name of the source the number was filled in from. Empty when no source was read.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Source’s number",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "What the source said, when one was read.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Measured at",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "When the source measured it (ISO, UTC).",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Reason for a different number",
    "need": "For reading",
    "format": "Text",
    "example": "The source counts something else: “It leaves out release branches.”",
    "empty": "Never read: a reason is given in the check-in",
    "means": "Why the owner’s number differs from the source’s, in their words.",
    "back": "For reading; not loaded back from this sheet"
   },
   {
    "col": "Stages",
    "need": "Required for a stages goal",
    "format": "“Pilot: done week 6; Rollout: expected week 9”",
    "example": "Pilot: done week 6",
    "empty": "Must fix for a stages goal",
    "means": "Milestone goals: each stage as “Pilot: done week 6”, “Pilot: expected week 8” or “Pilot: due week 7”, separated by semicolons.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Call",
    "need": "Optional",
    "format": "On track, At risk, Off track or Done",
    "example": "At risk",
    "empty": "The rules decide",
    "means": "The owner’s status call: On track, At risk, Off track or Done. Empty: the rules decide.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Cause",
    "need": "Required when it’s behind, or well ahead",
    "format": "Plan too aggressive, Delivery slower, Blocked by a dependency, External factor, Data problem, Something else, Plan too cautious, Change landed early or One-off, won’t last",
    "example": "Plan too aggressive",
    "empty": "Must fix when it’s behind or well ahead. On a row already here, empty clears it",
    "means": "Why it’s ahead or behind: Plan too aggressive, Delivery slower, Blocked by a dependency, External factor, Data problem, Something else, Plan too cautious, Change landed early or One-off, won’t last.",
    "back": "Required when behind or well ahead, as in the app"
   },
   {
    "col": "Why",
    "need": "Required when it’s behind, or well ahead",
    "format": "Text, 10 characters or more",
    "example": "Runner pool was halved for the migration",
    "empty": "Must fix when it’s behind or well ahead. On a row already here, empty clears it",
    "means": "The owner’s reason, in their words.",
    "back": "Required when behind or well ahead, as in the app"
   },
   {
    "col": "Why greener",
    "need": "Required when Call is better than the rules say",
    "format": "Text, 10 characters or more",
    "example": "The fix shipped after the number was taken",
    "empty": "Must fix when the call is greener than calculated. On a row already here, empty clears it",
    "means": "Why the owner’s call is greener than calculated.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Path to green",
    "need": "Required when it’s behind",
    "format": "Text, 8 characters or more",
    "example": "Add 20 runners by week 48",
    "empty": "Must fix when it’s behind. On a row already here, empty clears it",
    "means": "What changes to get back on plan.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Recovery",
    "need": "Optional",
    "format": "Plan, Still investigating, Needs a decision or help or Target should change",
    "example": "Plan",
    "empty": "Plan",
    "means": "Where getting back stands: Plan, Still investigating, Needs a decision or help or Target should change.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Back on plan by week",
    "need": "Required when Recovery is Plan and it’s behind",
    "format": "A week after this one",
    "example": "48",
    "empty": "Must fix when it’s behind with a plan. On a row already here, empty clears it",
    "means": "The week it’s back on plan by, when there’s a plan.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Needs",
    "need": "Optional",
    "format": "Text",
    "example": "A decision on runner budget from Amara",
    "empty": "Nothing needed. On a row already here, empty clears it",
    "means": "A decision or help it needs, and from whom.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Next step",
    "need": "Optional",
    "format": "Text",
    "example": "Order runners",
    "empty": "Nothing said. On a row already here, empty clears it",
    "means": "The owner’s next step.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Calculated",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "What the rules said that week, in the status words.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Plan that week",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Number goals: the plan’s number in that week, as it stood then.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Posted at",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "When it was posted.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Posted by",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Who posted it.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Posted by email",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "Who posted it, by email.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Backfilled",
    "need": "Worked out",
    "format": "",
    "example": "",
    "empty": "Worked out by Faro: never read",
    "means": "“yes” for history loaded later rather than posted in its week.",
    "back": "Worked out by the app; ignored when loaded back"
   }
  ]
 },
 "People": {
  "intro": "One row per person. Everyone in the workspace. Add a row, with an email, for someone new.",
  "needs": "A new row needs Name and Email.",
  "always": [
   "Email",
   "ID"
  ],
  "cols": [
   {
    "col": "Email",
    "need": "Required",
    "format": "An email",
    "example": "ana.silva@example.com",
    "empty": "Must fix for someone new. An email can be changed, not taken away",
    "means": "Their email: what matches them, and tells two people with the same name apart. Required for someone new.",
    "back": "Matches the person; with their ID in the row, a new email replaces the old one"
   },
   {
    "col": "ID",
    "need": "Leave empty",
    "format": "Faro’s own",
    "example": "p_ana",
    "empty": "Faro gives someone new their own",
    "means": "The person’s own identity. It never changes.",
    "back": "Matches the person first"
   },
   {
    "col": "Name",
    "need": "Required",
    "format": "Text",
    "example": "Ana Silva",
    "empty": "Must fix for someone new",
    "means": "Their full name.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Action",
    "need": "Optional",
    "format": "Left or Example",
    "example": "Left",
    "empty": "The row adds or changes the person",
    "means": "Empty to add or change the person. Left marks them as left; their goals and open asks go to Takes over.",
    "back": "Done when loaded back, with the same rules and preview as the app"
   },
   {
    "col": "Job title",
    "need": "Optional",
    "format": "Text",
    "example": "Platform lead",
    "empty": "No job title. On a row already here, empty clears it",
    "means": "Their job title.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Team",
    "need": "Optional",
    "format": "A team’s name",
    "example": "Platform",
    "empty": "No team. On a row already here, empty clears it",
    "means": "Their team, by name.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Admin",
    "need": "Optional",
    "format": "yes or no",
    "example": "yes",
    "empty": "Not an admin (when setting up, the first person is one)",
    "means": "“yes” for an admin: they can add people, change settings and change any goal.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Team objective",
    "need": "Optional",
    "format": "Text, on the team lead’s row",
    "example": "Make every deploy safe and fast",
    "empty": "No objective. On a row already here, empty clears it",
    "means": "On the team lead’s row: what the team is for.",
    "back": "Changes the team’s objective (on the lead’s row; empty there clears it)"
   },
   {
    "col": "Takes over",
    "need": "Required with Left, when they own goals, asks or teams",
    "format": "An email, or a name only one person has",
    "example": "chloe.wu@example.com",
    "empty": "Must fix with Left when they own anything",
    "means": "With Left: who takes over their goals, open asks and teams, by email (or a name only one person has). Empty in an export.",
    "back": "Used with Left"
   }
  ]
 },
 "Results": {
  "intro": "One row per goal. For year-end reporting: each goal’s result for the cycle and each quarter against the owner’s plan. A quarter’s target is the plan’s number at its end. Not loaded back.",
  "needs": "",
  "always": [
   "Key",
   "ID"
  ],
  "cols": [
   {
    "col": "Key",
    "need": "Matches the row",
    "means": "The goal’s key.",
    "back": "Not loaded back"
   },
   {
    "col": "ID",
    "need": "Matches the row",
    "means": "The goal’s ID in this cycle.",
    "back": "Not loaded back"
   },
   {
    "col": "Goal",
    "need": "For reading",
    "means": "The goal’s name.",
    "back": "Not loaded back"
   },
   {
    "col": "Level",
    "need": "For reading",
    "means": "Its level.",
    "back": "Not loaded back"
   },
   {
    "col": "Team",
    "need": "For reading",
    "means": "Its team.",
    "back": "Not loaded back"
   },
   {
    "col": "Owner",
    "need": "For reading",
    "means": "Who owns it.",
    "back": "Not loaded back"
   },
   {
    "col": "Owner email",
    "need": "For reading",
    "means": "Who owns it, by email.",
    "back": "Not loaded back"
   },
   {
    "col": "Target",
    "need": "For reading",
    "means": "Its target.",
    "back": "Not loaded back"
   },
   {
    "col": "Due week",
    "need": "For reading",
    "means": "The week it’s due.",
    "back": "Not loaded back"
   },
   {
    "col": "Status",
    "need": "Worked out",
    "means": "Where it stands now.",
    "back": "Not loaded back"
   },
   {
    "col": "Now",
    "need": "Worked out",
    "means": "The latest number, or stages done.",
    "back": "Not loaded back"
   },
   {
    "col": "Result",
    "need": "Worked out",
    "means": "Set once the goal is due, in the result words defined under Words.",
    "back": "Not loaded back"
   },
   {
    "col": "Q1",
    "need": "Worked out",
    "means": "The first quarter against the owner’s plan: a quarter’s target is the plan’s number at its end.",
    "back": "Not loaded back"
   },
   {
    "col": "Q2",
    "need": "Worked out",
    "means": "The second quarter against the plan.",
    "back": "Not loaded back"
   },
   {
    "col": "Q3",
    "need": "Worked out",
    "means": "The third quarter against the plan.",
    "back": "Not loaded back"
   },
   {
    "col": "Q4",
    "need": "Worked out",
    "means": "The fourth quarter against the plan.",
    "back": "Not loaded back"
   }
  ]
 },
 "Asks": {
  "intro": "One row per ask. Every ask on the exported goals: a decision or help, an update, a question or an action, who asked whom, and where it stands. Asks are raised and answered in the app. Not loaded back.",
  "needs": "",
  "always": [
   "ID"
  ],
  "cols": [
   {
    "col": "ID",
    "need": "Matches the row",
    "means": "The ask’s identity.",
    "back": "Not loaded back"
   },
   {
    "col": "Kind",
    "need": "For reading",
    "means": "Decision or help, Update, Question or Action.",
    "back": "Not loaded back"
   },
   {
    "col": "Ask",
    "need": "For reading",
    "means": "What was asked, in their words.",
    "back": "Not loaded back"
   },
   {
    "col": "Goals",
    "need": "For reading",
    "means": "The goals it’s about.",
    "back": "Not loaded back"
   },
   {
    "col": "Goal keys",
    "need": "For reading",
    "means": "Their keys.",
    "back": "Not loaded back"
   },
   {
    "col": "Goal IDs",
    "need": "For reading",
    "means": "Their IDs.",
    "back": "Not loaded back"
   },
   {
    "col": "Asked by",
    "need": "For reading",
    "means": "Who asked.",
    "back": "Not loaded back"
   },
   {
    "col": "Asked of",
    "need": "For reading",
    "means": "Who must respond.",
    "back": "Not loaded back"
   },
   {
    "col": "Status",
    "need": "Worked out",
    "means": "Where it stands: Open, Answered, Done or Withdrawn.",
    "back": "Not loaded back"
   },
   {
    "col": "Due week",
    "need": "For reading",
    "means": "The week it’s due by, if any.",
    "back": "Not loaded back"
   },
   {
    "col": "Review",
    "need": "For reading",
    "means": "The review it was raised in.",
    "back": "Not loaded back"
   },
   {
    "col": "Asked at",
    "need": "For reading",
    "means": "When.",
    "back": "Not loaded back"
   },
   {
    "col": "Answer",
    "need": "For reading",
    "means": "The answer, or the note it was marked done with.",
    "back": "Not loaded back"
   },
   {
    "col": "Answered by",
    "need": "For reading",
    "means": "Who answered.",
    "back": "Not loaded back"
   },
   {
    "col": "Answered at",
    "need": "For reading",
    "means": "When.",
    "back": "Not loaded back"
   }
  ]
 },
 "Notes": {
  "intro": "One row per note, question or action said in a review. What was said in reviews: notes, questions and actions, with their answers. Not loaded back.",
  "needs": "",
  "always": [
   "Goal key",
   "Goal ID"
  ],
  "cols": [
   {
    "col": "Goal key",
    "need": "Matches the row",
    "means": "The goal’s key.",
    "back": "Not loaded back"
   },
   {
    "col": "Goal ID",
    "need": "Matches the row",
    "means": "The goal’s ID.",
    "back": "Not loaded back"
   },
   {
    "col": "Goal",
    "need": "For reading",
    "means": "The goal’s name.",
    "back": "Not loaded back"
   },
   {
    "col": "Week",
    "need": "For reading",
    "means": "The week it was said.",
    "back": "Not loaded back"
   },
   {
    "col": "Kind",
    "need": "For reading",
    "means": "Note, question or action.",
    "back": "Not loaded back"
   },
   {
    "col": "Said by",
    "need": "For reading",
    "means": "Who said it.",
    "back": "Not loaded back"
   },
   {
    "col": "Text",
    "need": "For reading",
    "means": "What was said.",
    "back": "Not loaded back"
   },
   {
    "col": "Who",
    "need": "For reading",
    "means": "Who does an action.",
    "back": "Not loaded back"
   },
   {
    "col": "Due week",
    "need": "For reading",
    "means": "When an action is due.",
    "back": "Not loaded back"
   },
   {
    "col": "Review",
    "need": "For reading",
    "means": "The review it was said in.",
    "back": "Not loaded back"
   },
   {
    "col": "Answer",
    "need": "For reading",
    "means": "A question’s or action’s answer.",
    "back": "Not loaded back"
   },
   {
    "col": "At",
    "need": "For reading",
    "means": "When.",
    "back": "Not loaded back"
   }
  ]
 },
 "Metrics": {
  "intro": "One row per metric in the library. The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Load it back to add or change many metrics at once: by ID, or by name for a new one; an empty ID adds it. Action retires one or brings it back.",
  "needs": "",
  "always": [
   "ID"
  ],
  "cols": [
   {
    "col": "ID",
    "need": "Matches the row",
    "means": "The metric’s identity. Empty for a new metric.",
    "back": "Matches the row to its record; it never changes"
   },
   {
    "col": "Metric",
    "need": "You can change it",
    "means": "Its name: 3 to 120 characters, used by one metric.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Action",
    "need": "What to do with the row",
    "means": "Retire or Bring back; empty for none. Retiring needs a Reason.",
    "back": "Done when loaded back, with the same rules and preview as the app"
   },
   {
    "col": "Meaning",
    "need": "You can change it",
    "means": "What it means and how it’s calculated: what is counted, out of what or over what period, what is left out.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Unit",
    "need": "You can change it",
    "means": "Its unit, as it follows a number (%, min, deploys). A file can’t change the unit of a metric goals use.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Decimals",
    "need": "You can change it",
    "means": "Places after the decimal point it’s shown with: 0 to 4.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Direction",
    "need": "You can change it",
    "means": "Higher is better or Lower is better.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Source",
    "need": "You can change it",
    "means": "Where the number comes from: a dashboard, a query, a report.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Source owner",
    "need": "You can change it",
    "means": "Who owns that source: a team or a person.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Refresh",
    "need": "You can change it",
    "means": "How often the source refreshes: Live, Hourly, Daily, Weekly, Monthly or Quarterly, or empty when nobody has said.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Owner",
    "need": "You can change it",
    "means": "Who answers for the definition, by name (Owner email wins when both are given).",
    "back": "Changed when loaded back"
   },
   {
    "col": "Owner email",
    "need": "You can change it",
    "means": "Who answers for it, by email; empty on a new metric: whoever loads the file.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Caveats",
    "need": "You can change it",
    "means": "What to watch out for when reading it.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Part of",
    "need": "You can change it",
    "means": "The metric it sits under, by name or ID: a metric in the library or on an earlier row. Empty for none.",
    "back": "Changed when loaded back"
   },
   {
    "col": "How it relates",
    "need": "You can change it",
    "means": "How it relates to the metric it is part of: Component, Driver, Control or Breakdown. Needs Part of; empty when not said.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Confidence",
    "need": "You can change it",
    "means": "How far its number can be trusted: High, Medium or Low; empty when not said.",
    "back": "Changed when loaded back"
   },
   {
    "col": "How it could be gamed",
    "need": "You can change it",
    "means": "In words, up to 500 characters; empty when not said.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Reason",
    "need": "You can change it",
    "means": "Why: needed to retire it, or when a change to its meaning or direction changes the number its goals show.",
    "back": "Changed when loaded back"
   },
   {
    "col": "Still to say",
    "need": "Worked out",
    "means": "Fully defined, or what it still needs to say.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Retired on",
    "need": "Worked out",
    "means": "The day it was retired; empty while it is in use.",
    "back": "Worked out by the app; ignored when loaded back"
   },
   {
    "col": "Measures",
    "need": "For reading",
    "means": "The goals it measures, each with its slice: a team, or the whole company.",
    "back": "For reading; not loaded back from this sheet"
   },
   {
    "col": "Goal keys",
    "need": "For reading",
    "means": "Their keys.",
    "back": "For reading; not loaded back from this sheet"
   }
  ]
 }
};
