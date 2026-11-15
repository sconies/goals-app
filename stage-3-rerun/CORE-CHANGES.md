# Changes to the stage 1–2 rebuild

The stage 1–2 rebuild (`rebuild/main.mjs`, `engine.mjs`, `store.mjs`, `shim.mjs`, `tests.mjs`) was copied in at 100% against its own kit. Against this kit (pin 6e41c494) it scored 99.9%: the kit had moved on (new edge goals E-16 and E-18, and eight new change-engine cases). Every change below, and why. `store.mjs`, `shim.mjs`, `s1.mjs` and `tests.mjs` are unchanged; `node tests.mjs ../spec/conformance/workspace.json` still passes 24 of 24, and the store contract 14 of 14.

## Stage 1 (`main.mjs`)

1. **A check-in with no number still projects from the earlier weeks' numbers** (E-16, `spec/core/rules/projection.md` “Where it is used”). `metricCalc` returned before projecting when the latest number was missing; it now projects from `earlierNums` (calculation stays `none`). Fixed edge/projection.csv and edge/scorecard.csv.
2. **Guardrails in the check-in's own calculation** (E-18, `spec/core/rules/status.md` “Guardrails”). New `guardBreach(g, week)`: a guard (a live range goal named in `guards`) whose latest number by that week is out is a breach, `risk`, or `off` when its previous number was out too; `evaluate` takes the worse of the goal's and the breach's call, with reason `behind`. Only `evaluate` reads guards. Fixed edge/checkin.csv `e18-5`.
3. **The rules over a changing workspace.** `liveCk` and `allGoals` became `let`, and `setData(next)` puts the app's current records under the same rules (the cycle stays). Stage 1 was a script over one file; the app needs the same functions over records that change with every save. Nothing in the drill's run changes.
4. **One `S1` object** handed to the change engine, to `s1.mjs` and to stage 3, now also carrying `asOf`, `setData`, `flagsFor`, `handledFor`, `goalStatus`, `assessPosted`, `firstDueWeek`, `isUnmeasured`, `RANK`, `latestPosted`, `stageStates`, `valueCode`, `momentOf`, `REVIEW_DAY`, `CHECKIN_WEEKS`, `planFrom`, `planEnd` (previously two copies of a shorter list).
5. **Stage 3 from the same command**: when `screen-cases.json` sits beside the workspace, `main.mjs` runs `s3/drill3.mjs` after the change engine, writing navigation.csv, find.csv, home.csv and readback.csv.

## Stage 2 (`engine.mjs`)

6. **import.csv's cases are counted from the case list**, not a fixed 70: every case before the first `saves-…`/`corrects-keeps-author` (77 today). The kit grew by seven import cases.
7. **A Stop or Delete row may carry the goal's columns as they are** (`stop-whole-row`): a cell is a change only when it differs from the saved goal (its name, its owner by name or id, its team by name, unit, start, target); before, any filled cell but the name was a change.
8. **The cant-change sentence names the action in lower case the second time** (“Make the change, or the stop, on its own.”, `stop-row-changed`).
9. **A non-admin's People rows that change nothing are unchanged, not refused** (`people-unchanged-not-admin`); only a row that would change someone says “Only an admin can change people.” (`people-one-changed-not-admin`), and a non-admin's rows never count towards “many admins”.
10. **No longest length for a goal's name** (`spec/core/rules/numbers-and-names.md`: 80 characters is a workspace name's). The engine refused names over 80 (`long-name-unedited`, `long-name-edited`).
11. **A renamed goal isn't asked about as another goal when one name holds the other** (`long-name-edited`: the name with “, and the weekend” added). See GAPS S3-14.
12. **A changed goal's item is named by its new name** (changes.csv `name`).
13. **The engine as the app's one door**: `input.via` (the door's name, “Spreadsheet” by default; the AI tools pass “MCP” through the app), `input.door: 'form'` (the app's own forms: no Via mark and no “Loaded a spreadsheet” entry, `spec/core/rules/change-engine.md` “One way to save a check-in”), and `input.ids` (ids unique across saves; the drill's own `goal_c1` numbering is unchanged when it isn't given).

## `drill.json`

14. `{ "stage": 3, "run": "node main.mjs", "shim": "node shim.mjs", "contracts": ["store"], "also": ["status", "flags", "projection", "scorecard", "checkin", "changes", "import"] }`: stage 3, keeping stages 1 and 2 scored and the store contract run.
