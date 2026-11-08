<!-- Generated from src/domain/columns.ts by `npm run export-format`. Edit the columns there, not this file. -->

# Export format

One spreadsheet format for everything that goes out or comes in: the workbook and CSVs from Export, a table saved from Data, the set-up template, set-up from a spreadsheet, the Import screen, and the AI assistant’s `bulk_change`, `export` and `export_table` tools. Every sheet and column is defined once, in `src/domain/columns.ts`, and this page is made from it. Anything exported can be edited and loaded back; loaded back unedited, it changes nothing.

Week numbers count from the cycle’s start: week 0 is the start date. A check-in for week N is the owner’s report in that week.

## Files

- **Excel workbook (.xlsx)**, the default: every sheet below (Goals, Plan, Check-ins, People, Results, Asks, Notes, Metrics) and a README sheet that explains each column, made from the same definitions. Worked-out columns are set in grey.
- **CSV files (.zip)**: the same sheets, one CSV each with the same headers, named after the sheet (`Goals.csv`, `Check-ins.csv`…). UTF-8 with a byte-order mark, so Excel opens them correctly.
- **One CSV**: any one sheet on its own.
- **A table from Data** (CSV or .xlsx), exactly as its layout shows it: its columns in order and the rows that pass its search and filters. The columns that say which record a row is (below, “Matches the row”) are always written: any the layout leaves out are added at the end, in grey, so the file loads back. The AI assistant’s `export_table` does the same.
- **JSON** and **a brief for an AI chat** (Markdown), below. They are for reading, not loading back.

## Loading a file back

Import reads an .xlsx workbook, a .zip of CSVs, or one .csv or tab-separated file. Set-up from a spreadsheet reads the same files. Every row is checked with the app’s own rules and shown before anything is saved; nothing saves while a row needs fixing, and the whole load can be undone from Activity.

- **Each sheet is recognised by its header row**, never its file or sheet name. Keep the headers as they are; columns can be in any order, and a sheet can leave columns out.
- **Rows find their record** by the columns marked “Matches the row”: a goal by its **Key**, then its **ID** (a goal carried into a new cycle keeps its key, so last cycle’s file still finds it); a check-in by its **ID**, or its goal and **Week**; a person by their **Email**, then their **ID**, then a name only one person has (the preview notes when a name was used). Teams are found by name.
- **A column left out keeps what the record says.** An empty cell in a column that is there means empty, except where the column says otherwise.
- **Every column you can change counts.** A change to any of them is applied, or shown as a problem to fix; none is quietly dropped. Worked-out columns are never read.
- **Words are exact.** A word a column doesn’t know (a level of “vp”, a Must stay of “sometimes”) is a problem to fix, never a guess. A dash on its own (`—`) in Team, Owner or Feeds into means none.
- **The formula guard.** In a CSV, a text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return is written with an apostrophe in front, so a spreadsheet won’t run it as a formula. Loading it back takes the apostrophe off again.
- **Line breaks** inside a cell are kept, in a workbook and in a CSV (as a quoted cell, RFC 4180).
- **The Action column** does what the app does, with the same rules and preview: on Goals, `Stop` stops a goal with check-ins (say why in Reason) and `Delete` deletes one with none; on People, `Left` marks someone as left, their goals and open asks going to Takes over (by email). Undoing the import puts them back.

## Goals

One row per goal. Every goal: what it is, who owns it, its plan, and where it stands. Add a row with no Key or ID for a new goal.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| Key | Matches the row | The goal’s short key in this workspace (G-12). It never changes, and a goal carried into the next cycle keeps it. Leave it empty for a new goal. | Matches the goal first, so a file from last cycle still finds its goals |
| ID | Matches the row | The goal’s identity in this cycle. Leave it empty for a new goal. | Matches the goal when there’s no Key |
| Goal | You can change it | The goal’s name. | Changed when loaded back |
| Action | What to do with the row | Empty to add or change the goal. Stop stops a goal with check-ins (say why in Reason); Delete deletes one with none, set up by mistake. | Done when loaded back, with the same rules and preview as the app |
| Level | You can change it | north star, svp or team: how important it is, for reporting. | Changed when loaded back |
| Team | You can change it | The team it belongs to, by name. | Changed when loaded back |
| Owner | You can change it | Who owns it, by name. A name works when only one person has it; Owner email is exact. | Changed when loaded back |
| Owner email | You can change it | Who owns it, by email: what tells two people with the same name apart. | Changes the owner; when Owner and Owner email disagree, the one you changed counts |
| Type | You can change it | metric, range or milestone: move a number, keep one in range, or hit dated stages. | Sets a new goal’s type; it can’t change on an existing goal |
| Unit | You can change it | Number and range goals: what the number counts (%, days, ms). | Changed when loaded back |
| Decimals | You can change it | Number and range goals: how many decimal places the number has (0 to 3). | Changed when loaded back |
| Start | You can change it | Number goals: where the plan starts. | Changes the plan; needs a reason once check-ins have started |
| Target | You can change it | Number goals: where the plan ends, by its due week. | Changes the plan; needs a reason once check-ins have started |
| Plan | You can change it | Number goals: the plan’s shape, straight, back-loaded or stepped. | Changes the plan; needs a reason once check-ins have started |
| Plan from week | You can change it | Number goals: the week the plan starts from (0 for the cycle’s start, later for a goal set up mid-cycle). | Changes the plan; needs a reason once check-ins have started |
| Due week | You can change it | Number goals: the week the target is due, counted from the cycle’s start. | Changes the plan; needs a reason once check-ins have started |
| Limit | You can change it | Range goals: the number it must stay within. | Changed when loaded back |
| Must stay | You can change it | Range goals: at most or at least the limit. | Changed when loaded back |
| Margin | You can change it | Range goals: how close to the limit counts as at risk. | Changed when loaded back |
| Stages | You can change it | Milestone goals: each stage as Name@week, separated by semicolons. | Changed when loaded back |
| Feeds into | You can change it | The goal this one feeds, by name. | Changed when loaded back |
| Feeds into key | You can change it | The goal this one feeds, by key. Exact where names repeat. | Changes what it feeds; when Feeds into and Feeds into key disagree, the one you changed counts |
| Why it helps | You can change it | Why this goal should move the one it feeds: a hypothesis, not a proven cause. | Changed when loaded back |
| Effect | You can change it | The effect expected on the goal it feeds, in that goal’s unit. | Changed when loaded back |
| Source | You can change it | Where the number comes from, and who owns that source. | Changed when loaded back |
| Definition | You can change it | Exactly what is counted. | Changed when loaded back |
| Reason | You can change it | Why the plan is changing, or why the goal stops. Written by you; empty in an export. | Kept in the change log with the change |
| Status | Worked out | Where the goal stands now, in the status words defined under Words below. | Worked out by the app; ignored when loaded back |
| Since | Worked out | How long it has stood so. | Worked out by the app; ignored when loaded back |
| Now | Worked out | The latest number, or stages done. | Worked out by the app; ignored when loaded back |
| Plan this week | Worked out | Number goals: the plan’s number this week. | Worked out by the app; ignored when loaded back |
| Gap | Worked out | How far it is from the plan, said the same whichever way is better. | Worked out by the app; ignored when loaded back |
| Last check-in week | Worked out | The week of its latest check-in. | Worked out by the app; ignored when loaded back |
| Forecast | Worked out | Where the recent trend takes it by its due week. | Worked out by the app; ignored when loaded back |
| Why it’s off | Worked out | The owner’s latest reason, when it’s behind. | Worked out by the app; ignored when loaded back |
| Recovery plan | Worked out | What the owner will do about it. | Worked out by the app; ignored when loaded back |
| By when | Worked out | When it will be back on plan, or why there’s no date. | Worked out by the app; ignored when loaded back |
| Needs | Worked out | The open asks for a decision or help. | Worked out by the app; ignored when loaded back |
| Next step | Worked out | The owner’s next step. | Worked out by the app; ignored when loaded back |
| Warnings | Worked out | What the numbers would hide; each warning starts with its word, defined under Words. | Worked out by the app; ignored when loaded back |
| Result | Worked out | Set once the goal is due, in the result words defined under Words. | Worked out by the app; ignored when loaded back |
| Q1 | Worked out | The first quarter against the owner’s plan: a quarter’s target is the plan’s number at its end. | Worked out by the app; ignored when loaded back |
| Q2 | Worked out | The second quarter against the plan. | Worked out by the app; ignored when loaded back |
| Q3 | Worked out | The third quarter against the plan. | Worked out by the app; ignored when loaded back |
| Q4 | Worked out | The fourth quarter against the plan. | Worked out by the app; ignored when loaded back |

Always written by a table from Data: Key, ID.

## Plan

One row per number goal. The plan as numbers, one column per week. Type over any week to set the plan by hand.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| Key | Matches the row | The goal’s key. | Matches the goal first |
| ID | Matches the row | The goal’s ID in this cycle. | Matches the goal when there’s no Key |
| Goal | For reading | The goal’s name (change it on Goals). | For reading; not loaded back from this sheet |
| Unit | For reading | What the number counts (change it on Goals). | For reading; not loaded back from this sheet |
| Start | You can change it | Where the plan starts. | Changes the plan; needs a reason once check-ins have started |
| Week N | You can change it | The plan’s number that week, from the week after Plan from week to the due week. Empty before and after. If the plan changed, earlier check-ins were judged against the plan of their day (Plan that week on Check-ins). | Sets the plan numbers by hand; needs a reason once check-ins have started |

Always written by a table from Data: Key, ID.

## Check-ins

One row per check-in. Every check-in: the number or stages reported each week, the owner’s call and their account of it. Add a row with no ID for a new check-in, a past week included.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| ID | Matches the row | The check-in’s own identity. Leave it empty to add one. | Matches the check-in; with none, a row corrects that goal’s latest check-in for the week |
| Goal key | Matches the row | The goal’s key. | Matches the goal first |
| Goal ID | Matches the row | The goal’s ID in this cycle. | Matches the goal when there’s no Goal key |
| Goal | Matches the row | The goal’s name. | Matches the goal by name, only when there’s no Goal key or Goal ID |
| Week | Matches the row | The week it reports on, counted from the cycle’s start (week 1 onwards). | Matches the week; a check-in’s week never changes |
| Week starting | Worked out | The date that week starts. | Worked out by the app; ignored when loaded back |
| Value | You can change it | Number and range goals: the number that week. | Changed when loaded back |
| Stages | You can change it | Milestone goals: each stage as “Pilot: done week 6”, “Pilot: expected week 8” or “Pilot: due week 7”, separated by semicolons. | Changed when loaded back |
| Call | You can change it | The owner’s status call: On track, At risk, Off track or Done. Empty: the rules decide. | Changed when loaded back |
| Cause | You can change it | Why it’s ahead or behind: Plan too aggressive, Delivery slower, Blocked by a dependency, External factor, Data problem, Something else, Plan too cautious, Change landed early or One-off, won’t last. | Required when behind or well ahead, as in the app |
| Why | You can change it | The owner’s reason, in their words. | Required when behind or well ahead, as in the app |
| Why greener | You can change it | Why the owner’s call is greener than calculated. | Changed when loaded back |
| Path to green | You can change it | What changes to get back on plan. | Changed when loaded back |
| Recovery | You can change it | Where getting back stands: Plan, Still investigating, Needs a decision or help or Target should change. | Changed when loaded back |
| Back on plan by week | You can change it | The week it’s back on plan by, when there’s a plan. | Changed when loaded back |
| Needs | You can change it | A decision or help it needs, and from whom. | Changed when loaded back |
| Next step | You can change it | The owner’s next step. | Changed when loaded back |
| Calculated | Worked out | What the rules said that week, in the status words. | Worked out by the app; ignored when loaded back |
| Plan that week | Worked out | Number goals: the plan’s number in that week, as it stood then. | Worked out by the app; ignored when loaded back |
| Posted at | Worked out | When it was posted. | Worked out by the app; ignored when loaded back |
| Posted by | Worked out | Who posted it. | Worked out by the app; ignored when loaded back |
| Posted by email | Worked out | Who posted it, by email. | Worked out by the app; ignored when loaded back |
| Backfilled | Worked out | “yes” for history loaded later rather than posted in its week. | Worked out by the app; ignored when loaded back |

Always written by a table from Data: ID, Goal key, Goal ID, Week.

## People

One row per person. Everyone in the workspace. Add a row, with an email, for someone new.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| Email | Matches the row | Their email: what matches them, and tells two people with the same name apart. Required for someone new. | Matches the person; with their ID in the row, a new email replaces the old one |
| ID | Matches the row | The person’s own identity. It never changes. | Matches the person first |
| Name | You can change it | Their full name. | Changed when loaded back |
| Action | What to do with the row | Empty to add or change the person. Left marks them as left; their goals and open asks go to Takes over. | Done when loaded back, with the same rules and preview as the app |
| Job title | You can change it | Their job title. | Changed when loaded back |
| Team | You can change it | Their team, by name. | Changed when loaded back |
| Admin | You can change it | “yes” for an admin: they can add people, change settings and change any goal. | Changed when loaded back |
| Team objective | You can change it | On the team lead’s row: what the team is for. | Changes the team’s objective (on the lead’s row; empty there clears it) |
| Takes over | You can change it | With Left: who takes over their goals, open asks and teams, by email (or a name only one person has). Empty in an export. | Used with Left |

Always written by a table from Data: Email, ID.

## Results

One row per goal. For year-end reporting: each goal’s result for the cycle and each quarter against the owner’s plan. A quarter’s target is the plan’s number at its end. Not loaded back.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| Key | Matches the row | The goal’s key. | Not loaded back |
| ID | Matches the row | The goal’s ID in this cycle. | Not loaded back |
| Goal | For reading | The goal’s name. | Not loaded back |
| Level | For reading | Its level. | Not loaded back |
| Team | For reading | Its team. | Not loaded back |
| Owner | For reading | Who owns it. | Not loaded back |
| Owner email | For reading | Who owns it, by email. | Not loaded back |
| Target | For reading | Its target. | Not loaded back |
| Due week | For reading | The week it’s due. | Not loaded back |
| Status | Worked out | Where it stands now. | Not loaded back |
| Now | Worked out | The latest number, or stages done. | Not loaded back |
| Result | Worked out | Set once the goal is due, in the result words defined under Words. | Not loaded back |
| Q1 | Worked out | The first quarter against the owner’s plan: a quarter’s target is the plan’s number at its end. | Not loaded back |
| Q2 | Worked out | The second quarter against the plan. | Not loaded back |
| Q3 | Worked out | The third quarter against the plan. | Not loaded back |
| Q4 | Worked out | The fourth quarter against the plan. | Not loaded back |

Always written by a table from Data: Key, ID.

## Asks

One row per ask. Every ask on the exported goals: a decision or help, an update, a question or an action, who asked whom, and where it stands. Asks are raised and answered in the app. Not loaded back.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| ID | Matches the row | The ask’s identity. | Not loaded back |
| Kind | For reading | Decision or help, Update, Question or Action. | Not loaded back |
| Ask | For reading | What was asked, in their words. | Not loaded back |
| Goals | For reading | The goals it’s about. | Not loaded back |
| Goal keys | For reading | Their keys. | Not loaded back |
| Goal IDs | For reading | Their IDs. | Not loaded back |
| Asked by | For reading | Who asked. | Not loaded back |
| Asked of | For reading | Who must respond. | Not loaded back |
| Status | Worked out | Where it stands: Open, Answered, Done or Withdrawn. | Not loaded back |
| Due week | For reading | The week it’s due by, if any. | Not loaded back |
| Review | For reading | The review it was raised in. | Not loaded back |
| Asked at | For reading | When. | Not loaded back |
| Answer | For reading | The answer, or the note it was marked done with. | Not loaded back |
| Answered by | For reading | Who answered. | Not loaded back |
| Answered at | For reading | When. | Not loaded back |

Always written by a table from Data: ID.

## Notes

One row per note, question or action said in a review. What was said in reviews: notes, questions and actions, with their answers. Not loaded back.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| Goal key | Matches the row | The goal’s key. | Not loaded back |
| Goal ID | Matches the row | The goal’s ID. | Not loaded back |
| Goal | For reading | The goal’s name. | Not loaded back |
| Week | For reading | The week it was said. | Not loaded back |
| Kind | For reading | Note, question or action. | Not loaded back |
| Said by | For reading | Who said it. | Not loaded back |
| Text | For reading | What was said. | Not loaded back |
| Who | For reading | Who does an action. | Not loaded back |
| Due week | For reading | When an action is due. | Not loaded back |
| Review | For reading | The review it was said in. | Not loaded back |
| Answer | For reading | A question’s or action’s answer. | Not loaded back |
| At | For reading | When. | Not loaded back |

Always written by a table from Data: Goal key, Goal ID.

## Metrics

One row per metric in the library. The metric library: every number goals are measured by, defined once, and the exported goals each one measures. Metrics are added and changed in the app. Not loaded back.

| Column | Kind | What it means | When loaded back |
|---|---|---|---|
| ID | Matches the row | The metric’s identity. | Not loaded back |
| Metric | For reading | Its name. | Not loaded back |
| Meaning | For reading | What it means and how it’s calculated. | Not loaded back |
| Unit | For reading | Its unit. | Not loaded back |
| Decimals | For reading | Places after the decimal point it’s shown with. | Not loaded back |
| Direction | For reading | Higher is better or Lower is better. | Not loaded back |
| Source | For reading | Where the number comes from. | Not loaded back |
| Source owner | For reading | Who owns that source. | Not loaded back |
| Refresh | For reading | How often the source refreshes: Live, Hourly, Daily, Weekly, Monthly or Quarterly, or empty when nobody has said. | Not loaded back |
| Owner | For reading | Who answers for the definition. | Not loaded back |
| Owner email | For reading | Who answers for it, by email. | Not loaded back |
| Caveats | For reading | What to watch out for when reading it. | Not loaded back |
| Measures | For reading | The goals it measures, each with its slice: a team, or the whole company. | Not loaded back |
| Goal keys | For reading | Their keys. | Not loaded back |

Always written by a table from Data: ID.

## Words

The words the import reads, as the export writes them (other ways people write them are read too, such as “green” for on track):

- Level: `north star`, `svp`, `team`
- Type: `metric`, `range`, `milestone`
- Plan: `straight`, `back-loaded`, `stepped`
- Must stay: `at most`, `at least`
- Call: `On track`, `At risk`, `Off track`, `Done`
- Cause: `Plan too aggressive`, `Delivery slower`, `Blocked by a dependency`, `External factor`, `Data problem`, `Something else`, `Plan too cautious`, `Change landed early`, `One-off, won’t last`
- Recovery: `Plan`, `Still investigating`, `Needs a decision or help`, `Target should change`
- Action: `Stop`, `Delete` (Goals), `Left` (People)

Worked-out columns use the status words defined in `src/domain/vocabulary.ts` (see `docs/glossary.md`); the README sheet lists every one with its meaning.

## JSON

Everything in the cycle, each goal with its plan by week and its check-ins inside it, for scripts and AI tools.

```jsonc
{
  "format": "goals-app.export",
  "version": 1,
  "exportedAt": "2026-10-30T12:00:00.000Z",
  "about": "…",                                   // how to read it, in a paragraph
  "words": { "status": { "off": { "label": "…", "meaning": "…" }, … }, "flag": { … }, "result": { … }, … },
  "workspace": { "id": "…", "name": "…" },
  "cycle": { "id": "…", "name": "…", "startDate": "2026-01-05", "weeks": 53, "currentWeek": 45, "quarter": "Q4", "quarters": [{ "label": "Q1", "months": "…", "from": 1, "to": 13 }] },
  "people": [{ "id": "…", "name": "…", "email": "… or null", "jobTitle": "…", "team": "…", "admin": false }],
  "teams": [{ "id": "…", "name": "…", "objective": "…" }],
  "goals": [{
    "id": "…", "key": "G-12", "title": "…", "level": "north-star | svp | team", "type": "metric | range | milestone",
    "team": "…", "owner": "…", "ownerId": "…", "ownerEmail": "… or null", "feedsIntoId": "… or null", "whyItHelps": "…", "source": "…", "definition": "…",
    // metric:    "unit", "decimals", "plan": { start, target, shape, fromWeek, dueWeek, setByHand, byWeek: [{ week, value }] },
    //            "earlierPlans": [{ untilWeek, start, target, shape }]  (each applied to the weeks before untilWeek)
    // range:     "unit", "decimals", "range": { mustStay: "atMost | atLeast", limit, margin }
    // milestone: "stages": [{ id, name, dueWeek }]
    // stopped:   "stopped": { at, by, reason }
    "now": { "status": "on | risk | off | stale | none | planned | done", "statusLabel": "…", "statusMeaning": "…", "value": 29.4, "text": "29.4 days",
             "planThisWeek": 27.7, "gap": "…", "lastCheckInWeek": 44, "forecast": "…", "projection": { "likeliest", "low", "high", "byWeek", "fittedWeeks" } },
    "story": { "since", "where", "outlook", "whyItsOff", "recoveryPlan", "byWhen", "needs", "nextStep", "warnings", "warningKinds", "feeds" },
    "needsAttention": { "needs": true, "beingHandled": null, "flags": [{ "kind": "no-path", "label": "…", "detail": "…" }] },
    "quarters": [{ "quarter": "Q1", "months": "…", "weeks": [1, 13], "result": "met | missed | open", "resultLabel": "…", "text": "…" }],
    "result": { "kind": "completed | late | missed", "label": "…", "dueWeek": 53, "week": 52 },
    "checkIns": [{ "id": "…", "week": 44, "weekStarting": "2026-10-26", "value": 29.4, "stages": null, "planThatWeek": 27.7, "call": "risk", "callLabel": "…",
                   "calculated": "risk", "calculatedLabel": "…", "cause": "slower", "why": "…", "whyGreener": null,
                   "pathToGreen": { "what": "…", "byWeek": 47, "needs": null, "state": "plan" }, "next": "…", "postedAt": "…", "postedBy": "…", "backfilled": false }]
  }],
  "notes": [{ "goalId": "…", "goalKey": "G-12", "week": 44, "kind": "note | question | action", "by": "…", "text": "…", "who": "…", "dueWeek": 46, "status": "…", "statusLabel": "…", "answer": "…", "at": "…" }]
}
```

`version` changes only when a field is removed or changes meaning; new fields can be added without changing it. Codes (`status`, `call`, `result.kind`, a quarter’s `result`) never change; the words beside them are the vocabulary’s, defined under `words`. The AI assistant says both: “Off track (off)”.

## Brief for an AI chat (Markdown)

A short summary to paste into any AI chat: the counts by status; what needs attention, with the owner’s reason, path to green and what they need; what’s being handled; results and quarters; every goal by what it feeds; open questions and actions; and each goal’s weekly numbers with that week’s plan and the owner’s call.

## Activity

Activity saves the change log as it’s filtered, as a CSV with the columns When, Who, What, Goal, Kind, Changes (each field’s before and after) and Via (the app, a spreadsheet, Data or the AI assistant). It is a record, not loaded back.
