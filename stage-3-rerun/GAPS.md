# Stage 3 rebuild: gaps in the kit

Marks: **GUESSED-RIGHT** (a guess the score or a test confirmed), **LEARNED-FROM-DIFF** (the words didn't say it; a harness difference did), **UNPROVEN** (a guess nothing scores), **NOT-IN-KIT** (the kit doesn't hold it at all). Every gap, even one the data settled, is something a page should say.

## The drill (navigation, find, home, read-back)

| Id | Evidence | What I guessed / learned | Mark | Page that should say it |
|---|---|---|---|---|
| S3-1 | conformance/README.md, home.csv: “on each of the fourteen days … at noon UTC”; screen-cases.json `home.days` are ISO times | home.csv's `day` key is the date alone (`2026-10-23`), not the moment given | LEARNED-FROM-DIFF | conformance/README.md, home.csv |
| S3-2 | rules/navigation.md: with Reviews off a goal in a review's walk is “{title}” alone; nothing on what it lights | It lights Goals (core-only rows) | LEARNED-FROM-DIFF | rules/navigation.md, the lit item |
| S3-3 | rules/home.md “An ask that waits”: a question's due date is the next session | With Reviews off there are no sessions, so a question raised in a review waits as an ask with no date (leads after 7 days) | LEARNED-FROM-DIFF | rules/home.md |
| S3-4 | rules/goal-entry.md rule 3 lists `owner-other-team` with no condition | Not asked when the goal is for someone else (Tunde adds one for Amara in Build & Release): no You said row | LEARNED-FROM-DIFF | rules/goal-entry.md, rules/read-back.md |
| S3-5 | rules/read-back.md: “then what else it helps” | “It also helps “{title}”.” (several joined by “ and ”); I first added the key, the diff dropped it | LEARNED-FROM-DIFF (the key); GUESSED-RIGHT (the sentence) | rules/read-back.md |
| S3-6 | core/data-model.md Review.everyWeeks: “every this many weeks of the cycle”; no anchor, no start week | A session falls in cycle weeks where week % everyWeeks = 0, on its weekday (0 = Monday) | GUESSED-RIGHT (home.csv) | core/data-model.md, the reviews rules |
| S3-7 | rules/read-back.md example says “It’s a Team goal”, “It’s a north star” | “It’s an SVP goal” for an SVP goal | GUESSED-RIGHT | rules/read-back.md |
| S3-8 | rules/read-back.md: “several by name” | Reviews in the workspace's order, “A and B”, “A, B and C” | GUESSED-RIGHT | rules/read-back.md |
| S3-9 | rules/habit.md: “this week counts once every goal is checked in” | Any check-in for the week counts here, on time or not; lateness is judged after | GUESSED-RIGHT (home.csv run) | rules/habit.md |
| S3-10 | conformance/README.md find.csv lists a goal's unit among its words; rules/finding.md doesn't | Included the unit | GUESSED-RIGHT | rules/finding.md |

## Stage 1–2 cases added to this kit (see CORE-CHANGES.md)

| Id | Evidence | What I guessed / learned | Mark | Page that should say it |
|---|---|---|---|---|
| S3-11 | export-format.md: “on Goals, `Stop` stops a goal”; nothing on the other cells of a Stop row | A Stop row may repeat the goal's cells as saved (name, owner by name or id, team by name, unit, start, target); only a cell that differs is a change | LEARNED-FROM-DIFF (`stop-whole-row`) | rules/change-engine.md, its sentence table |
| S3-12 | rules/change-engine.md sentence table | The second mention of the action is lower case: “or the stop” | LEARNED-FROM-DIFF | rules/change-engine.md |
| S3-13 | rules/change-engine.md `not-allowed` | A non-admin's People rows that change nothing are unchanged, not refused | LEARNED-FROM-DIFF | rules/change-engine.md |
| S3-14 | import-issues.md `other-goal`: “its name, owner and team all differ” | A row with only Key and Goal, whose name holds the saved name (or the reverse), is the same goal renamed; otherwise asked as before. Confirmed for `long-name-edited` only | LEARNED-FROM-DIFF; UNPROVEN beyond that case | import-issues.md, rules/change-engine.md |
| S3-15 | conformance/README.md changes.csv `name`: “the goal's … name” | A renamed goal's item carries its new name | LEARNED-FROM-DIFF | conformance/README.md |
| S3-16 | rebuild/stage-2-core-data.md: “import.csv's are the first of them” | The first 77: every case before the `saves-…` and `corrects-keeps-author` ones (the stage 1–2 build had hard-coded 70) | GUESSED-RIGHT | rebuild/stage-2-core-data.md (say which cases, by name) |

## The screens, the journeys and the platform

| Id | Evidence | What I guessed / learned | Mark | Page that should say it |
|---|---|---|---|---|
| S3-17 | core/journeys/U69.md, U70.md, U137.md: rows needing Reviews (lit Reviews, “· Platform leadership weekly”, “It joins … Reliability weekly.”) not under “If the Reviews module is on”; rebuild/README.md: everything else “must pass all three ways” | Built the core without Faro's modules (they are stages 4–12); these rows fail with Reviews left out, so U69 and U137 are PART | NOT-IN-KIT (a contradiction) | the journeys' pages, or rebuild/README.md |
| S3-18 | core/journeys.md “Checkpoint”: scored by axe-core | axe-core isn't in the kit or available offline; the runner checks accessible names, sideways scrolling and the 44px main button itself, and every journey with a checkpoint is PART at best | NOT-IN-KIT | core/journeys.md, the ease test |
| S3-19 | U137.md (“for each of `Object.entries(want)`”, the rows' expected words not given), U59.md (the facts' `want` list cut at “…”), U58.md (finish check cut) | Checked what the words give; these checks are PART | NOT-IN-KIT | the journeys' pages (don't cut the code) |
| S3-20 | U65.md: Find's dialog is typed into with no step or key that opens it | The runner presses Ctrl K before typing | UNPROVEN | U65.md |
| S3-21 | U137.md “Everyone in Example: Platform Engineering can see it.”; screen-cases.json and U59.md say “Platform Engineering” | Kept “Platform Engineering”; U137's line is matched only up to “can see it.” | NOT-IN-KIT (two names) | core/journeys.md “Where it starts” |
| S3-22 | journeys name Faro's classes (`.count-line`, `.people-row`, `.ws-facts`, `.backlink`); the kit says “match the words” | Took the classes and the exact words (“Access is for admins. The admins here are …”, “Back to {where}” as the link's name) | GUESSED-RIGHT (the runner passes) | core/journeys.md “The parts the journeys name” |
| S3-23 | rebuild/module-platform.md: stage 3 builds the server “answering the core's own tools”; core/tools.md lists 53 core tools | No list of which tools stage 3 must answer; built 18 (get_overview, find_goals, get_goal, get_my_work, list_people, get_activity, get_help, whats_new, post_check_in, create_goal, stop_goal, delete_goal, list_removed, restore_removed, set_feature, start_next_cycle, save_view, list_views) | NOT-IN-KIT | rebuild/stage-3-core-screens.md |
| S3-24 | rules/start-next-year.md: the read-back's parts, no sentences | “{n} carry on into 2027” (with “{k} of them keep their plan”), “{n} finish in 2026”, “{n} stop”; Start refused before the wrap-up opens with “2027 can be started from Monday 21 Dec, when the wrap-up opens.” | UNPROVEN | rules/start-next-year.md (a sentence table) |
| S3-25 | rules/year-end.md: the wrap-up opens “on the Monday of week weeks − 2 + 1” | Monday 21 Dec 2026 for the demo's 53 weeks; the year's states by day (tested) | UNPROVEN | rules/year-end.md (a worked example with dates) |
| S3-26 | module-platform.md `writesWhenOff`: Reviews' and Watching's saves | Generic rule: a restore of a switched-off module's record is refused with the action's sentence; other core saves don't write module records | UNPROVEN | module-platform.md |
| S3-27 | module-platform.md `features.readBack`: the title and main button's words; the lines are each module's | A module with a `features.readBack` part gets the sheet; others switch at once | GUESSED (tested with the probe module) | module-platform.md |
| S3-28 | core/help-guide.md is Faro's guide in full (206 KB); stage 3 says the Help article per screen | Wrote a short guide of my own, an article per core screen; the kit doesn't say whether Faro's words are to be copied | NOT-IN-KIT | rebuild/stage-3-core-screens.md |
| S3-29 | stage 1's contract (a command over one workspace file) | The rules were a script over one file; the app needed a reload door (`setData`) to judge records that change | NOT-IN-KIT (advice) | rebuild/lessons.md or stage-1-core-rules.md: build the rules as functions of the records |
| S3-30 | rules/change-engine.md “One way to save a check-in”: the forms' door has no Via mark | The case format has no door; added `door: 'form'` and `via` to the engine's input | GUESSED | rules/change-engine.md, actions.md |
| S3-31 | the screens' pages link to `src/screens/*.tsx` for fields' conditions | Many conditions are code (“`!(review || !standing.kind)`”); a rebuild reads what it can and leaves the rest | NOT-IN-KIT | core/screens.md |
| S3-32 | core/journeys.md: U115, U117, U122 read the demo on later days | The kit's demo stops at 5 Nov; those journeys can't be driven | NOT-IN-KIT | conformance/demo-extra.json (later days), or say which |
