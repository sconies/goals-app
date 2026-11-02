# Export format

Goals can be exported from the Goals screen (Export). You can export everything in the cycle, or just the goals in the current view. Every export is built from the same summary as the screens (`src/domain/summary.ts`), so a status or gap in a file matches what the app shows.

Week numbers count from the cycle's start: week 0 is the start date. A check-in for week N is the owner's report in that week.

## Excel workbook (.xlsx)

| Sheet | One row per | Notes |
|---|---|---|
| Goals | goal | Columns from **ID** to **Definition** describe the goal and use the import's names. **Status**, **Now**, **Plan this week**, **Gap**, **Last check-in week** and **Forecast** are worked out by the app and ignored when the file is loaded back. |
| Plan | number goal | **Week 1** to the last due week: the planned number each week. Empty before the plan starts and after the target's due week. |
| Check-ins | goal and week | **Call** is the owner's status call and **Calculated** is what the rules said. **Backfilled** is "yes" for history loaded later rather than posted in its week. |
| Notes and actions | note, question or action from a review | Questions include the owner's answer when there is one. |
| People | person | |
| README | column | What each column means and what happens to it when loaded back. |

Values that start with `=`, `+`, `-` or `@` in a text cell are prefixed with an apostrophe in CSV, so a spreadsheet won't run them as formulas.

## CSV

The Goals sheet or the Check-ins sheet, with the same columns as in the workbook. The files are UTF-8 with a byte-order mark, so Excel opens them correctly.

## JSON

```jsonc
{
  "format": "goals-app.export",
  "version": 1,
  "exportedAt": "2026-10-30T12:00:00.000Z",
  "workspace": { "id": "…", "name": "…" },
  "cycle": { "id": "…", "name": "…", "startDate": "2026-09-07", "weeks": 13, "currentWeek": 7 },
  "people": [{ "id": "…", "name": "…", "jobTitle": "…", "team": "…", "admin": false }],
  "teams": [{ "id": "…", "name": "…", "objective": "…" }],
  "goals": [{
    "id": "…", "title": "…", "level": "north-star | svp | team", "type": "metric | range | milestone",
    "team": "…", "owner": "…", "ownerId": "…", "feedsIntoId": "… or null", "whyItHelps": "…",
    // metric:    "unit", "decimals", "plan": { start, target, shape, fromWeek, dueWeek, setByHand, byWeek: [{ week, value }] }
    // range:     "unit", "decimals", "range": { mustStay: "atMost | atLeast", limit, margin }
    // milestone: "stages": [{ id, name, dueWeek }]
    "now": { "status": "on | risk | off | done | stale | none | planned", "statusLabel": "…", "value": 29.4, "text": "29.4 days",
             "planThisWeek": 27.7, "gap": "…", "lastCheckInWeek": 6, "forecast": "…", "why": "…", "pathToGreen": "…", "needs": "…" },
    "checkIns": [{ "week": 6, "weekStarting": "2026-10-19", "value": 29.4, "stages": null, "call": "risk", "calculated": "risk",
                   "cause": "slower", "why": "…", "whyGreener": null, "pathToGreen": { "what": "…", "byWeek": 9, "needs": null, "state": "plan" },
                   "next": "…", "postedAt": "…", "postedBy": "…", "backfilled": false }]
  }],
  "notes": [{ "goalId": "…", "week": 6, "kind": "note | question | action", "by": "…", "text": "…", "who": "…", "dueWeek": 8, "answer": "…", "at": "…" }]
}
```

`version` changes only when a field is removed or changes meaning. New fields can be added without changing it.

## Brief for an AI chat (Markdown)

A short summary to paste into any AI chat:

- the counts by status;
- what needs attention, with the owner's reason, path to green and what they need;
- every goal by what it feeds;
- open questions and actions;
- each goal's weekly numbers with that week's plan and the owner's call.
