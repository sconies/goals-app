# Core changes made for the Reviews module

Eight core files changed. Each is generic (a hook any module can use) unless marked **names Reviews**.

| File | Change | Why |
|---|---|---|
| `main.mjs` | After stage 3, runs every `modules/<id>/drill.mjs` it finds (`writeDrill({ W, S1, outDir })`). | The drill writes a module's conformance file (reviews.csv); the core had no hook for a module's own drill file. |
| `drill.json` | `"also"` adds `"reviews"`. | So the harness scores reviews.csv. |
| `app/state.mjs` | Registers `reviewsModule` in the installed code list; a module with code replaces its row in `INSTALLED`, keeping its order. | The module's facts come from its code. |
| `app/state.mjs` | Before a core action runs: a module that is off and says `writesWhenOff(app, action, input)` refuses it with that module's action sentence. | Criterion 4 / `writesReviews`: a core save that would write a review's records (a goal proposed in a review) is refused while Reviews is off. The dispatcher only refused a module's own actions. |
| `app/state.mjs` | A module action's log entry takes `entity`, `action`, `entityId` and `goalId` from the result (it was always `entity: 'module'`). | U13 checks the log has `entity: 'review'`; History reads entries by goal. |
| `app/state.mjs` | `FARO_OFF=<ids>` starts the workspace with those modules switched off. | To run the core's journeys with Reviews off (BUILDER: core journeys pass with it on, off and out). |
| `app/server.mjs` | Module routes take `:params`; `page()` may return `{ body, status, title, focus, back, redirect }` (a string still works). | Reviews has `/reviews/:reviewId/...`; the core matched exact paths only. |
| `app/server.mjs` | Removed the core's own `/reviews` and `/reviews/:id` pages (the module draws them). The core's `/reviews*` Page-not-found line stays for a build without the module. **names Reviews** (pre-existing). | The pages are the module's. |
| `app/server.mjs` | A module action's form posts keep repeated fields as lists; a refused module action may return `again` (the form drawn again with what was typed), and a saved one `redirect`. | Ticked level boxes; U13's “Give the review a name” alert on the form. |
| `app/server.mjs` | Features: `?confirm=<id>` shows a module's read-back; after a switch, the message carries Undo, whose result says “{Module} is off again.” / “{Module} is back on.”. | Criterion 6, U103, module-platform “Turning a switch”: the core switched at once with no read-back and no Undo. |
| `app/server.mjs` | A module's Help article replaces the core guide's article with the same id (so it leaves with the module). | The kit's help guide has a `reviews` article of its own, which stayed listed with Reviews off. |
| `app/server.mjs` | `/api/state` also returns `reviews`. **names Reviews** | The journeys' snapshot reads `s.reviews` (U13). |
| `app/pages.mjs` | Features: a module's `featureLine(app)` under its switch (“6 reviews are set up.”); a module with `switchOff(app)` opens its read-back dialog first (“Switch off Reviews in {workspace}”, Switch off Reviews, Cancel); Undo; the switch is `role="checkbox"` (was `role="switch"`). | U103/U104/U154/U155 press “the Reviews tick box” (`getByRole('checkbox')`). |
| `app/pages.mjs` | The goal page draws the place `goal.sections` (with `{ goal, app, viewer, url }`). | The walk and “Last time we talked” go there; the core listed the place but never drew it. |
| `app/pages.mjs` | History names the review a note was said in (“Amara Nwosu in Platform leadership weekly: …”) and, while Reviews is on, has a “Said in reviews” filter (`history=reviews`; with Reviews off it reads as Comments). **names Reviews** | U103 and U79: History keeps what was said, by review name, on or off. The kit says History is the core's. |
| `app/pages.mjs`, `home.mjs` | `homeFor(…, { skipSession })`: a module may say a session doesn't lead Home. | Criterion 12 / U155: a session whose date passed while Reviews was off must not lead Home as “Not held yet”. Home's review lead is the core's (kit gap 3). |
| `tests/journeys.mjs` | U69 expects `?review=weekly` to light Reviews only while Reviews is on, Goals otherwise. | It hard-coded Reviews on, so it failed with Reviews off or left out; navigation.csv (core-only) already says Goals. |

Stages 1 to 3 still pass with the module in, on, off and left out: the harness at 100% (with reviews.csv), core-only conformance at 100%, `tests.mjs` 24 of 24, `tests/platform.mjs` 37 checks (on a free port), and `tests/journeys.mjs` (results in JOURNEYS.md).
