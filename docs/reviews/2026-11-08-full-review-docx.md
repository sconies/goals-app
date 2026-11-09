# "Faro full app review" (Word document, 8 Nov, written before D, N and T merged)

Desktop at 1363 × 936; Platform Engineering demo as Rhea, Amara, Oskar and Grace. Triaged by the planning session against what shipped later on 8 Nov.

## Already fixed since the review
- F01 reopened draft has no Back: fixed in D (#47).
- F02 "Not met" with 0 short: fixed in D (quarters compared at the displayed decimals).
- F04 Done goal flagged "greener than calculated", in Needs attention and the review: fixed in T (#53).
- F06 (part) search on review participants: fixed in T. Goal and owner pickers: backlog 0a.
- F12 (part) Goals tabs clipped: N (#51) wraps tabs and chips; recheck at 1363 px.

## Still open: backlog item R (review leftovers)
- **F16 stale code after a deploy** ("Something went wrong" on Map, a failed dynamic import, fixed by reload). Matters on Tuesday: merging the live build deploys while tabs are open. On a failed chunk load, reload once automatically, keeping the address and drafts.
- **F03 currency forecasts lose decimals** ("about $1" for 0.64 → 0.62 USD) in the tree narrative and the workbook's Forecast field: format every forecast with the goal's unit and decimals.
- **F07 Next review link opens the previous occurrence**: show "Outstanding from 5 Nov" and "Next 12 Nov" separately, with the date in the review bar.
- **F05 Map Fit all** doesn't refit when the scope changes; offer a true overview or say why not.
- **F10** a same-week correction asks about "last week": say "this week's earlier check-in".
- **F09** weekly history: "Done since week 37" instead of "No check-in" after completion.
- **F13** first-check-in banner ignores the selected scope: use the scope's numbers, or label it workspace-wide.
- **F08** "Last quarter not met" shown in amber on goals on track now: subdue it as history.
- **F15** each review agenda row says why it's there (decision needed, date slipped, forecast misses…). Fits L.
- **F14** Data grid default column widths too wide: a compact default layout.
