# Goal map journeys against this rebuild

Driven by `modules/goal-map/journeys.mjs` (phone 390×844 and desktop 1440×900; every run passes), plus `exit.test.mjs`.

| Id | Tally | What runs, what is missing |
|---|---|---|
| U26 | DONE | Map from Layout. Critical path ns-lead → lead-merge → lead-mq, not lead-review. Opens on the path. Click a goal for its story (Why, On the critical path, Open the goal). Unfold all, then Fold to the top. The attention switch works both ways. Dotted also-helps lines show. |
| U30 | PART | The map part is done: Enter on a goal opens its story and focus moves into it; Escape closes it and gives focus back. Delete and Backspace do nothing. The one-table check-in and review set-up parts are core screens this core lacks. |
| U34 | PART | The map part is done: the attention switch puts attention=1 in the link and the filter line, and keeps it after a refresh. Not built: the count saying “N needs attention:”, Export from the Views menu, History's “Weeks shown” and the one-table draft. |
| U39 | NOT BUILT | The map walkthrough (`goals-tour`, the coach beside its goal). The core has no walkthroughs. |
| U90 | NOT BUILT | Undoing an import and Past imports (the Spreadsheets module and the core). Nothing of the map is in it. |
| U134 | PART | The map draws a proposed goal dashed, with the word “Proposed” and no status shape (`.map-node.proposed .proposed-word`). Not run: the core has no proposed flow (New goal's “Is it under way?”, state=proposed). |
| U135 | PART | Desktop: Layout says “Layout: Map”, the address gets view=map, and the map has no search or attention tick box of its own. G-48 from the bar's search goes to the goal and outlines it without narrowing. Enter narrows (q=merge). Not built: the phone View sheet, the Group and Views menus, Sort, and the head-position check. |
| U165 | DONE (Goal map half) | Off: Layout offers List, Table, Board and History, and nothing says Map. view=map opens the List with the sentence once, and the address drops view. The switch is logged. Back on, the Map opens. Feedback's half belongs to stage 5. |
| F6 | NOT BUILT | “Fit and finish, map-reviews”: the kit has no steps for it (`evals/finish/6-map-reviews.cjs` can't be followed). |
| N22 | PART | The Goal map's part is done: off, there is no layout and no Help article, and the article's link says it is switched off; on again, both come back. Watching, the Wrap-up and Feedback belong to their own stages. |

Tally: 2 DONE, 5 PART, 3 NOT BUILT.
