# Stage 6: the Goal map's journeys, tallied

App: `node app/server.mjs 4173` (add `FARO_MODULES_OFF=goal-map` to start with it off). Script: `node modules/goal-map/journeys.cjs [ids]` drives each journey on a phone (390×844) and a desktop (1440×900), following its page's steps and checks, with the same checkpoint scoring as the core's runner. Results: `journeys.json`. Pictures: `shots/`.

**8 journeys: DONE 3 · PART 3 · NOT BUILT 2.** Checks F6 and N22 are named in the kit but not written in it (their source, `evals/finish/6-map-reviews.cjs` and `evals/notes/22-more-switches.cjs`, isn't in the kit): N22's Goal map half (no layout, no Help article, back on) is covered by the exit tests; F6 is NOT BUILT (unknown contents).

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U26 | DONE | 6, 6 / 8 | — Critical path ns-lead → lead-merge → lead-mq; opens folded (27 of 126), Unfold all (126), Fold to the top (27), Needs attention narrows; story with its why and Open the goal; dotted also-helps lines |
| U30 | DONE (the map part) | 1, 1 / 4 | The map from the keyboard: Enter opens the story, which takes focus; Escape gives focus back; Delete removes nothing. The journey's other parts (the one table's checks, a review set-up that survives a refresh) are the core's and Reviews', not built |
| U165 | DONE for the Goal map, PART overall | 2, 2 / 12 | Goal map off: four layouts, nothing says Map, a link to the Map opens the List and says so once, the address no longer asks for the Map, no Help article, logged, back on the Map opens. Feedback's half can't run: Feedback isn't installed in this rebuild (stage 5 is a separate folder) |
| U34 | PART | 1, 1 / 4 | The map's attention switch is in the link (`attention=1`), in the count ("N need attention:") and survives a refresh. Views → Export these goals and History's range (`hist=`) aren't built (core) |
| U135 | PART | 5, 5 / 10 | Layout is one menu that says the layout (View on a phone); Board then Map in the address; the bar's search lists G-48, choosing it outlines and focuses it without narrowing; Enter with nothing chosen narrows (`q=merge`). Group, Sort, saved Views and "The Map is always the trees." aren't built (core has no Group or Sort menus) |
| U39 | PART | 0, 0 / 2 | The map draws; the walkthrough coach isn't built (core) |
| U134 | NOT BUILT | — | Proposed goals aren't built in the core (the Map's dashed proposed node depends on them) |
| U90 | NOT BUILT | — | Import Undo and Past imports are the core's and Spreadsheets'; not built. Nothing in it is the Map's |

## The core's journeys, with the module in

The core's 18 scripted journeys (`node journeys/run.cjs`) give the same verdicts as before the module (13 DONE, 5 PART), with the module on (`core-results.on.json`, `core-run-on.txt`) and with it off (rerun by hand; same verdicts). `core-results.before.json` is the core's tally from before stage 6.
