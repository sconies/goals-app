# Stage 7 (the metric library): gaps in the kit

Rebuild: `rebuild/modules/metrics/` (rules.mjs pure; library.mjs saves with one undo; pages.mjs, module.mjs, tools.mjs,
sources.mjs, conformance.mjs). Its conformance rows are scored by the harness through `modules/metrics/drill/drill.json`
(`{ "stage": 3, "run": "node ../../../main.mjs", "also": ["metrics"] }`, run with `--files metrics`).

**Score: metrics.csv 109 of 109 rows, PASS after 2 scoring runs.** Run 1: 99/109 (10 missing, 6 not expected); every
miss was an input or a row's key, not a rule. Exit tests: `node --test modules/metrics/exit.test.mjs`, 40 of 40 (20
criteria × on and off).

Marks: GUESSED-RIGHT (the score or a journey confirmed it), LEARNED-FROM-DIFF (a harness diff taught it), UNPROVEN
(nothing scores it), NOT-IN-KIT (the kit doesn't say it at all).

| # | What the kit didn't say, or said wrongly | Evidence | Page that should say it | Mark |
|---|---|---|---|---|
| M-1 | **The find rows' asks are inputs only in the expected file.** Run 1 guessed 14 from the worked examples; the real list has `q=dora`, `q=zzzz`, `unit=MIN`, `unused=true`, `sortout=true`, `q=rate&sort=goals`, `retired=true` (booleans as `true`, not `1`; `retired` is a filter the README's list of keys leaves out) | run 1: 7 missing find rows, 4 not expected | conformance/README.md (metrics.csv): list the asks, or ship them as input like change-cases.json | LEARNED-FROM-DIFF |
| M-2 | A metric with no goals still has a **goals head row** (`total` 0) | run 1: `goals,metric_ci-cost,0,0` missing | conformance/README.md: “for each metric in use” | LEARNED-FROM-DIFF |
| M-3 | **reading rows: `ask` is the metric id and `row` counts within the metric**; the README says “in goal id order (row 1, 2…)” with nothing in `ask` | run 1: both reading rows missing/unexpected | conformance/README.md | LEARNED-FROM-DIFF |
| M-4 | A `measured` column (and rows with rule `measured`) exists; the README says “Four kinds of row”, lists seven and never describes `measured` | header; my guess (rule `measured`, `ask` the id, the code) matched at run 1 | conformance/README.md | GUESSED-RIGHT |
| M-5 | `ask` on needs, still, parts, ends and goals rows is the metric id, `row` 0 | matched at run 1 | conformance/README.md | GUESSED-RIGHT |
| M-6 | **DEMO_SERIES isn't in the kit** (`numbers.ts`): which goal each read slice follows, `add` and `short`. Guessed ns-ci for CI analytics, lead-ci-time for CI runner metrics · main branch pipelines, `add` 0, release pipelines `short` 1 | both reading rows (20 and 8 at 09:00 on 5 Nov, fresh) match; release pipelines' goal is never scored | rules.md, “The demo's sources”: give the table | GUESSED-RIGHT (release pipelines UNPROVEN) |
| M-7 | A reading's time is written `…T09:00:00.000Z` (`toISOString`) | matched | conformance/README.md | GUESSED-RIGHT |
| M-8 | Rule 2's against-plan words for a range: only “Near the {limit} limit” is given. “Within the … limit” and “Outside the … limit” are mine | the demo's one range on a metric is near; nothing else is scored | rules.md rule 2 | UNPROVEN |
| M-9 | Rule 2's order contradicts itself: “Worst status first (on track, then at risk and no recent update, then off track…)”. Built worst first | every metric has one goal in the demo | rules.md rule 2 | UNPROVEN (kit contradicts itself) |
| M-10 | **Rule 1's worked example “Oskar adds Build time … → Added” contradicts rule 6 (Checks asked at every door):** by rule 4, “Build time” is close to “Remote build cache hit rate” (its one word, “build”, is contained in the other's set). Built: the rule-level save takes `skipChecks`; every door asks | my worked-example run | rules.md: say which function each worked example runs | NOT-IN-KIT (contradiction) |
| M-11 | Rule 4 makes any one-word set (after fillers) close to every name containing that word (“Build time” ~ many). Whether that is meant isn't said | — | rules.md rule 4 | UNPROVEN |
| M-12 | The harness's header calls metrics.csv “stage 4”; the stage pages make it stage 7 | drill.mjs line 35 | drill.mjs | NOT-IN-KIT (inconsistent) |
| M-13 | **The kit never says how a module is switched off in a rebuild** beyond “modulesOff holds its id” (brief) and “Workspace, under Features” (tools.md): no Features page, no words for its rows or read-back for this module, no off page words for /metrics. I used “The metric library is switched off in {workspace}…” and the read-back in `switchReadBack` | — | stage-7 page (the switch), stage 3 (Features) | NOT-IN-KIT |
| M-14 | The module's name in the module-off sentence (“… is switched off in …”) isn't given; I used “The metric library” | — | tools.md / module README | UNPROVEN |
| M-15 | “The import says once what it didn't read”: no sentence for the Metrics sheet (export-format.md says it is “Not loaded back”), and the core rebuild has no import screen. `importNotes` returns a sentence on and off; nothing calls it but the tests | — | export-format.md, stage 9 | UNPROVEN |
| M-16 | **Entry criteria assume a core with extension points** (records filed under `modules`, places, routes, a nav slot, AI tools, Features); stages 1 to 3 never make them an exit criterion, so the core had none. CORE-CHANGES.md lists the 8 core files changed | CORE-CHANGES.md | stage-3-core-screens.md: build the places and slots empty, with a test | NOT-IN-KIT |
| M-17 | Journeys find parts by names screens.md doesn't list: `.metric-row`, `.metric-meaning`, `.metric-sortout`, `.metric-count`, `#metric-direction .level-fix`, `.seg[aria-invalid]`, `[data-check=…]`, `.metric-head .metric-still`, `.status-shape[data-status]`, the “Is it measured today” group, “Picked up what you hadn’t saved.” | U81, U105, U170 | the module's screens section | NOT-IN-KIT |
| M-18 | Journeys use `/demo/metrics…` addresses (as U58 did); everything else says `/metrics` | U81, U170 | journeys | NOT-IN-KIT (S3-15 again) |
| M-19 | U172 says “It’s already under this one”; rule 12 says “Choose another parent: it’s already under this one.” | U172 vs rules.md | either | NOT-IN-KIT (contradiction) |
| M-20 | The read-back puts “{reason in lower case}”, but U157 keeps “I have a newer number”: only the first letter is lowered | U157 | rules.md (read-back) | GUESSED-RIGHT (from the journey, not a diff) |
| M-21 | `?sources=behind` makes every series two weeks behind; with the continuation week that ends at week 44 (Thu 29 Oct), “7 days ago” (whole days) | U158's words match | rules.md, sources | GUESSED-RIGHT |
| M-22 | The chart's marks (“only the latest three weeks are drawn”, the core's `goalMarksOf` / `goal.marks` point) aren't in the core's stage pages | — | stage 3 (goal page) | NOT-IN-KIT |
| M-23 | Links to `src/modules/metrics/*.ts`, `numbers.ts`, `rulesSave.ts`, `evals/*.cjs` can't be followed: DEMO_SERIES (M-6), U81's `old` address list, U170's “{a value worked out in the journey}”, N16/F15/N29's scripts (only one line each) | — | — | NOT-IN-KIT |
| M-24 | One Undo for a module's save, and where Recently removed lives for module records, aren't given as core shapes. Built in the module: a snapshot of every row a save may touch, put back by one undo; Recently removed under the library's list | exit criteria 6, 16 | stage 2 (records), stage 7 | NOT-IN-KIT |
| M-25 | “Changing a unit goals use asks first, saying how many goals and how many will show a warning”: the read-back's words aren't given | U83 | rules.md (Looking after) | UNPROVEN |
| M-26 | The retire message's punctuation when the reason ends with a full stop (“…: The test platform reports it now. / Its metric …”) | worked example | rules.md rule 10 | GUESSED-RIGHT |
| M-27 | **Exit 9 / U152 needs the core's Start next year (U115)**, which the core rebuild doesn't have; the module's carry (`carryLinks`) is a function nothing calls | JOURNEYS.md | stage 3 | NOT-IN-KIT (core) |
| M-28 | **Exit 19's number step assumes the core's check-in is one question per screen** with a step primary and “No new number this week”; the core rebuild's check-in is one form. The step's lines are built; the primary is renamed in place by script; “No new number this week” isn't offered | U156–U158 PART | stage 3 (check-in) | NOT-IN-KIT (core) |
| M-29 | The Check-ins sheet's four reading columns, History's second line per check-in, a review agenda's “· from {source}” and `numberFrom` on get_goal need core screens and an export the core rebuild doesn't have | exit 20 PART | stages 3, 8, 9 | NOT BUILT |
| M-30 | The one table (`checkin.table`) is named as a core place, but the core's quick check-in has no hook for it; U160 is not built | U160 | stage 3 | NOT BUILT |
| M-31 | The Measured by on a changed goal (“under the name”) and the edit page re-rendering after a pick: the core's edit page posts the whole form, so From the metric and the parts offered show only after a save (U146, U159 not built as scripted) | U146, U159 | stage 3 (edit page) | NOT BUILT |
| M-32 | `?sources=behind`, `as` and `today` are fixtures of Faro's demo; how a rebuild sets “the demo's sources” per request isn't said. I used a `sources` query/cookie | U158 | rules.md | NOT-IN-KIT |
