# Kit-only review of the stage 3 rebuild (kit 752d6c97)

Reviewed from a copy at S/rev3 (rebuild/, plus spec/ and llms.txt copied from S/kit so the app finds `../spec`). The pin was never run through `npm run spec`; `git status` in the pin is clean. Ports 49871-49881.

## 1. Scores (independent)

| Run | Result |
|---|---|
| Full, drill.json as the builder wrote it (stage 3 + also changes, import, status, flags, projection, scorecard, checkin; shim contracts: store) | PASS, 320578/320578 cells, 45366/45366 rows, contracts 14/14 |
| Stage 3 files: navigation 60/60, readback 6/6, find 23/23, home 56/56 | 100% each |
| Stage 2 (`--files changes,import`): changes 135/135, import 70/70, contracts 14/14 | PASS |
| Stage 1 (`--files status,flags,projection,scorecard,checkin`): 5696, 5696, 4822, 21910, 5249 rows, plus edge/ 224, 224, 224, 890, 81 | PASS, every column 100% |
| Core-only, `--expected spec/conformance/core-only --contracts ""` (as the lead said) | **Does not run**: TypeError at pin/scripts/drill.mjs:100 (`want[0]` of null) because drill.json's `also` lists changes, import, ... which core-only does not have. Exit 1 |
| Core-only, plus `--files navigation,readback,find,home` | PASS, 957/957 cells, 145/145 rows (navigation, readback, find, home all 100%) |
| Core-only without `--contracts ""` | exit 2, "No contract store ... core-only/contracts" (the builder's S3-1) |

No hard-coding found: the rebuild reads only `workspace.json` and `screen-cases.json`; no read of expected CSVs. (Its tests.mjs and state.mjs reference spec/ paths for inputs only.)

## 2. The rebuild's own tests

| Test | Run | Exit | Honest? |
|---|---|---|---|
| `tests/platform.mjs` | 37 checks | 0 | Yes. Mutation: changed the admin refusal sentence in platform.mjs, exit 1 (assert thrown). |
| `tests/journeys.mjs` | 15 journeys x 2 widths, all PASS ("Every journey run passed.") | 0 | Mostly. Mutation: renamed "Goals you watch" in pages.mjs, U2 failed on both widths, exit 1. Weaknesses below. |
| `tests.mjs` (stage 2 hand checks, `node tests.mjs workspace.json change-cases.json`) | 24 pass, 0 fail, 1 SKIP (MCP and Data tables doors) | 0 | Yes by reading: it ends `process.exit(fails ? 1 : 0)`. Not mutated. |

Weaknesses found in `journeys.mjs`:
- **Silent pass when the app cannot start.** With `../spec` missing the server crashed on start (ENOENT), the script printed the stack and **exited 0 with no journey run** (the `await new Promise(r => server.stdout.once('data', r))` never resolves and Node exits 0 on an empty event loop). A broken build would read as green unless someone checks for "Every journey run passed."
- **Journey checks are a subset.** U25 never checks the saved check-in's week 45 and value 20 (the journey's `finish` check): it only checks a "posted" log entry exists. U78 does not run the "ask's words appear once as Amara" check. U25 also has dead lines (`const g = s.goalsList ? null : null`).
- **Step budgets are never counted** anywhere (no step counter), though the exit criterion is "within budget".
- Journey results are not recorded (no results file), as the builder says.

## 3. Exit criteria

Stage 3 page:

| # | Criterion | Rating | Evidence |
|---|---|---|---|
| 1 | drill PASS stage 3, four files | VERIFIED | My run: all 145 rows, every column 100% (also with 5 other files, 45366 rows). |
| 2 | Every core journey doable within budget on both widths | NOT MET | JOURNEYS.md: 8 DONE of 71. Its own table sums to 8 DONE, 18 PART, 45 NOT BUILT, not the 8/22/41 it states in its tally line. The 8 DONE journeys do pass in my run (some without their finish checks, see above). No step budget measured. U1, U5, U21, U28, ... are shells. |
| 3 | Each core requirement holds | NOT MET | 162 requirement sections in core/requirements.md; no requirement checklist or test exists in the rebuild, and Data, Feedback, Reviews edit, saved views, status sheet, quick check-in, research are shells (curl: /data, /quick-check-in, /research return a titled stub). |
| 4 | No screen offers a person, team or goal from a list of everything | WEAK | No `<select>`/`<option>` anywhere on the pages I fetched (Goals, edit, Reviews); owner/team/feeds use find-and-pick per JOURNEYS (U58, U84 tests). No scripted check (the kit's scripts/check-pickers.mjs is Faro's), and the edit page has no fields at all, so the criterion is trivially true there. |
| 5 | core-only drill PASS | WEAK | Passes (145/145), but only with `--files navigation,readback,find,home` as well as `--contracts ""`; the commands the lead and kit give crash. This is a harness/kit gap (G1 below), partly induced by the builder keeping `also` in drill.json. |
| 6 | Module platform with one example module | see below | |

Module platform "What proves it":

| # | Check | Rating | Evidence |
|---|---|---|---|
| P1 | On: row, page, part, article, action, tool all show and run | VERIFIED | platform.mjs "1." block (menu row, /example 200, goal.facts part, Help article, action saves, tool returns the note). Mutation test shows the file really asserts. |
| P2 | Off by an admin: row, page, part, article, Workspace section gone; address Page not found with the sentence; action refused with its sentence; tool listed and answers its sentence; logged; nothing deleted; back on restores | VERIFIED (one gap) | Every item asserted by exact sentence, including the log diff (On to Off) and 1 note kept then "1 note kept." after back on. The example module has no Workspace section, so that item is not exercised. |
| P3 | Non-admin refused in the rule's words; a module that needs it goes off with it | WEAK | Refusal asserted in exact words (HTTP and via `set_feature` with "who isn't an admin"). The needs half: `resolveModules`/`dependents` and the ", and with it ..." log are coded (my unit call: a off gives a, b, c all off), but **every installed module and the example has `needs: []`**, so no test or journey exercises it and "Off until ... is on." is not shown anywhere checked. |
| P4 | Built without the module: core journeys run, server answers core tools, Features shows no switch | VERIFIED (core journeys WEAK) | `FARO_WITHOUT=example`: no row, /example 404, Features has no Example switch but has Reviews, `find_goals` answers. The "core journeys run again" with the module left out was not done (journeys.mjs has no such mode). |
| P5 | Server: initialize, ping, tools/list, batch; 401s with their words; dry_run saves nothing | VERIFIED | All asserted, including exact 401 messages and headers, -32700, -32601, -32602, dry-run check-in count unchanged, AI access off shuts the door but tools/list answers. |
| (places) | "Every place on the core screens built empty" | WEAK | Seven of eleven places are called (`home.blocks`, `goal.facts`, `goal.sections`, `goal.measure`, `people.person`, `people.team`, `help.article`). `data.tools`, `goals.tools`, `checkin.number`, `checkin.table` are named in the registry (platform.mjs PLACES) but no screen draws them (Data page calls `data.tools`; Goals' Views menu and the check-in do not). |

## 4. JOURNEYS.md spot-check (8 picked)

| Journey | Claim | Found |
|---|---|---|
| U2 | DONE | Confirmed: runs and passes on both widths; checks match the page's steps closely. |
| U25 | DONE | Runs and passes, but the finish check (week 45, value 20) is not asserted: **overclaimed**, DONE-with-gap. |
| U78 | DONE | Passes; the once-only-for-Amara check missing from the test (I confirmed by curl the ask text appears once, so true in fact). Minor. |
| U141 | DONE | Confirmed, including that an admin is not offered Check in and nothing is logged. |
| U58 | PART | Confirmed: People list, Rhea's page and Teams work; matches claim. |
| U71 | PART | Confirmed: check-in page shows "Week 45. 5 of 7 in", "Start with the first", and `?start=1` returns 200 but is not a walk; claim fair. |
| U5 | NOT BUILT | Confirmed: Settings and Workspace have no workspace switcher. |
| U59 | PART | Plausible: /workspace is About with section links; /workspace/access returns the generic Workspace page. Fair. |

Result: 7 of 8 claims accurate; U25 over-states. The **tally line is wrong** (8/22/41 stated, 8/18/45 counted). The builder's honesty about NOT BUILT (41-45 shells) is good.

## 5. GAPS.md: real kit gap, or builder's mistake?

| Id | Verdict | Why |
|---|---|---|
| S3-1 | Real kit gap (harness) | drill.mjs exits 2 on core-only with a store contract; and with `also` listed it TypeErrors (G1). Stage 3 page's criterion 5 gives the bare command only. |
| S3-2 | Real kit gap | core-only/home.csv leads `attention`; core/rules/home.md "The lead" lists five leads (lines 11-15) and the quiet line (25) has no such lead. Not in the rules anywhere (grep "need attention" in core/rules/home.md finds only line 96's worked example). |
| S3-3 | Real kit gap | home.md rules 2 and 4 say "isn't held"; modules/reviews/rules.md RS1 defines only "held on the due day", and data-model's Review has no sessions. |
| S3-4 | Mostly builder's miss; placement gap | "goals, goals with everything feeding them, or whole levels" is in core/tools.md:5601,5616 and core/help-guide.md:824, only not in read-back.md. |
| S3-5 | Real kit gap | Only "You said 150% is right." and the week-40 sentence exist (readback.csv, goal-entry.md:22); the other questions' read-back sentences are in no rule. |
| S3-6 | Real kit ambiguity | new-goal rule 1 does not say whose team is judged; resolved by data. |
| S3-7 | Real (small) kit gap | navigation.md's Reviews-off example disagrees with navigation.csv; only conformance/README.md line 68 explains `pageName` ignores the switch. |
| S3-8 | Real, harmless | finding.md "A near miss" gives no tie-break; no row exercises it. |
| S3-9 | Real, harmless | home.md line 25 gives the quiet line's words for "Both" and "All {n}", not one goal; no row has it. |
| S3-10 | Real kit gap | module-platform.md:16 says Features shows a `summary` sentence but gives none; Faro's `module.json` is not in the kit. |
| S3-11 | Minor kit gap | navigation.md says "when the section has a name of its own" without listing which; the README says none are named in the rows. Harmless for the drill. |
| S3-12 | Minor kit gap | The door is stage 3's, token making is stage 4's; the kit does not say how a stage 3 build gets a token to test with. |
| S3-13 | Builder's mistake / not a gap | module-platform.md door table says each message "but `initialize`, `tools/list` and notifications" is refused when AI access is off; `ping` is not an exception, so refusing it is correct. |
| S3-14 | Real kit gap | Stage 3 page's own "Gaps in the kit" says no portable runner exists; Faro's CSS classes are named in the journeys. |
| S3-15 | Real kit gap | screens.md lists "… (worked out when it shows)"; the stage page's own gaps list admits this. |
| S3-16 | Minor kit gap | help-guide.md has articles but module article placement ids are not given as data. |
| S3-17 | Minor kit gap | goal-entry.md says "saves through `saveGoal`" but gives no input shape; builder's route (engine row) is reasonable. |
| S3-18 | Builder's own bug | Repeated ids came from the builder's stage 2 engine, nothing in the kit. |
| S1-G1 | Real kit ambiguity (small) | status.md Guardrails "latest number (posted in week w or before)"; taught by edge/checkin e18-5. |

## 6. Kit gaps worth fixing (ranked)

1. **Core-only cannot be scored with the command the kit gives**: with a store contract or any `also` stage 1/2 file the harness crashes (exit 2 or TypeError). Make the harness skip files and contracts the expected folder lacks, or document `--files`.
2. **Home's `attention` lead** is in no rule (S3-2); **what makes a session "held"** (S3-3); **the other read-back "You said" sentences** (S3-5): three places a rebuild must reverse-engineer from the CSV.
3. **No portable journey runner** (S3-14, S3-15): the stage page says so; a rebuild reads Faro's CSS classes. Criterion 2 cannot be checked objectively, and the builder's journeys.mjs is its own invention (and exits 0 on a crashed app).
4. **Module facts not as data** (S3-10): `summary`, and the places a module fills; plus no installed module has `needs`, so criterion P3's "a module that needs it goes off with it" is untestable from the table alone: the kit should say the example module takes a `needs`.
5. Rule page vs data disagreements (S3-7) and the Core-only drill's expectation to pass the full workspace's four files too (a rebuild that passes both is fine, but the page does not say a rebuild may use one `modulesOff` rule).

## Overall

Stages 1-3 drill scoring: complete and honest (100% everywhere). Platform criterion largely VERIFIED by an honest, failing-capable test. The "screens and journeys" half of stage 3 is not met (8 of 71 journeys; 41-45 are shells), which the builder reports openly; its summary tally line and U25/U78 DONE labels are slightly generous, and `journeys.mjs` silently exits 0 when the app cannot start.
