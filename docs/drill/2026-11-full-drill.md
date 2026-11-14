# The full rebuild drill (backlog item 11), November 2026

The last proof before the handoff: a fresh session rebuilds Faro stage by stage from the rebuild kit alone (`spec/` and `llms.txt`), the core first and then each module on its own, and each stage ships when its exit criteria pass.

- **Pinned to:** main at `dd00ff48` (KL's merge, #508). The kit read by every stage is `spec/` and `llms.txt` from that commit; later merges don't change this run.
- **How each stage runs:** a fresh subagent sees only a scratch folder with a copy of the pinned `spec/` and `llms.txt` (never Faro's source), builds the stage under `rebuild/` on top of the previous stage's passing rebuild, and keeps `GAPS.md`. Stages 1 to 3 are scored by the harness (`npm run drill -- <folder>`, run from the pinned commit). Module stages (4 to 11) are outlines with no harness of their own: the rebuild must still score 100% on stages 1 to 3 with the module in it, and a separate reviewer checks each exit criterion by hand against the rebuild.
- **A gap** is a place where the kit alone wasn't enough. Each one is fixed in the kit itself (`src/spec/*`, a module's `rebuild` stage, conformance rows), never by pointing the drill at the source.

## Scorecard

| Stage | Result | Gaps found | PRs |
|---|---|---|---|
| 1. The core rules | **Pass**: 43,373 of 43,373 rows | 16 (1.1 to 1.16) | #513 (all 16, merged) |
| 2. The core data and the change engine | **Pass**: 205 of 205 rows, store contract 13 of 13; stage 1 still passes. Only after reading the expected rows by hand | 22 (2.1 to 2.22) | |
| 3. The core screens and journeys | **Harness pass**: 145 of 145 rows; stages 1 and 2 still pass. By hand: 15 of 71 core journeys carried out fully, 18 in part, 38 not built; the core requirements not checkable from the kit | 31 (3.1 to 3.31) | |
| 4. Module: Feedback | **Switch criteria pass** (3, 4, 5: verified by the reviewer); requirements verified where a server can show them, weak where a browser or MCP server is needed (1); journeys weak (2, titles); stages 1 to 3 still pass | 23 (4.1 to 4.23) | |
| 5. Module: Goal map | **Switch criteria pass** (3, 4: verified by the reviewer); the requirements and journeys only in part (1, 2: weak, journeys are titles); stages 1 to 3 still pass with it on | 22 (5.1 to 5.22) | |
| 6. Module: Metric library | **Builder's tests pass** (15 of 20 criteria fully, 5 in part); its own conformance rows 109 of 109; stages 1 to 3 pass with it on and off. Not yet independently reviewed | 20 (6.1 to 6.20) | |
| 7. Module: Reviews | Waiting | | |
| 8. Module: Spreadsheets | Waiting | | |
| 9. Module: Fields (TG1) | Waiting | | |
| 10. Module: Watching | Waiting | | |
| 11. Module: Wrap-up | Waiting | | |

### To add when merged

Modules not on main at `dd00ff48`, each added later as a stage of its own with its section, conformance rows, stage and switch: GR (#464, merged after the pin), MQ (migration #502 merged after the pin; structure #505 to come), FT1 (#465, merged after the pin), TG2 (#493), SW2 (#504) and MI. (MC was deferred by Lane on 14 Nov, so it is no longer on this list.)

## Gaps

Each gap: the stage, what the kit didn't say, the evidence, and the fix.

### Stage 1: the core rules

The rebuild passed: 43,373 of 43,373 rows on the first stage 1 rebuild, after three scoring runs (the first scored 99.9%). The conformance data settled what the words left open; the gaps below are where the words should have said it. "Unproven" means that neither the words nor the demo data decide it.

| # | Gap | Evidence | Fix |
|---|---|---|---|
| 1.1 | The conformance README says `handled` in `flags.csv` can be `noted` or `reviewed`; the data never has them | G-59, week 26 | #513 |
| 1.2 | The moment's "back k" counts weeks from the start of the run of behind check-ins, and a week with no check-in doesn't break the run; only a test title hints at it | ci_ns-ci_38, back 9 | #513 |
| 1.3 | For "reached", "the week before" means week − 1, and a correction means an earlier-posted check-in for the same or a later week | Guessed; the score passed | #513 |
| 1.4 | In the trend's "the first, rounded, is above it", "it" is the last gap, not 0 | The other reading loses 266 rows of `flags.csv` | #513 |
| 1.5 | Being handled's "no new flag since" is never exercised by the demo | Unproven | #513 |
| 1.6 | The `due` flag's table leaves out exceptions other pages give (first due week, plan not started, held to no number, after the last day) | Unproven by the demo | #513 |
| 1.7 | `check-in.md` never lists which units count as time or money for refusing a negative number; the list is only in `src/` | Guessed | #513 |
| 1.8 | No `between` (range) goal in the demo, so its rules are unproven | Unproven | #513 |
| 1.9 | Two worked examples disagree: 400/110 "questioned; fine" (numbers and names) against 140 refused for the same 30→75% goal (check-in) | Words | #513 |
| 1.10 | The "294 days" example gives no plan, so another question could fire first | Words | #513 |
| 1.11 | Forgiving a late week needs 4 due, on-time weeks before it; the words read otherwise, the worked example settles it | Words | #513 |
| 1.12 | Ties in `postedAt` ("keep the earlier record") are ambiguous; the demo has none | Unproven | #513 |
| 1.13 | `forecastMisses` is compared unrounded; the page doesn't say | The score proved it | #513 |
| 1.14 | The order of a range goal's last 3 numbers is unstated (week, then posting, passes) | Passed | #513 |
| 1.15 | `checkin.csv`'s earlier check-ins are not cut by posting time; unstated | Passed | #513 |
| 1.16 | The receipt's words beyond the worked examples are guessed | Words | #513 |

In #513 the code showed the drill's guess was wrong on 1.3 (the week before is the latest earlier week with a check-in), 1.9 (both numbers are refused for a share) and 1.12 (a full tie takes the later record). The demo data doesn't exercise any of the three, so the rebuild still passed: that, more than the words, is the gap.

### Stage 2: the core data and the change engine

The rebuild passed, 135 of 135 rows in `changes.csv` and 70 of 70 in `import.csv`, plus the store contract's 13 cases, with stage 1 still at 100%. But it passed first time only because the session read the expected rows case by case before writing the engine: **most of the engine's words and many of its behaviours are in the conformance data, not the kit's words.** That is the stage's main gap. The exit criteria the harness doesn't score (the store, undo, one workspace never changing another's, module records riding in the same save) were checked by hand with the session's own tests. The last of these can't be checked against Faro's own mechanism, which is only in `src/domain/records.ts`.

| # | Gap | Evidence |
|---|---|---|
| 2.1 | The cases' inputs exist only inside the expected CSVs; the rebuild copied their input columns out | `import.csv`, `changes.csv` |
| 2.2 | About 45 of the 66 row sentences appear nowhere in the kit outside `import.csv` | `import.csv` |
| 2.3 | What a group id's column and value are, kind by kind | Data |
| 2.4 | Which problems stop a row making an item, and which keep it | Data |
| 2.5 | The order problems are raised in (`kinds`) | Data |
| 2.6 | The labels, order and value words of field-by-field changes | Data |
| 2.7 | How new ids are numbered (one counter for people, stages and goals) | Data |
| 2.8 | Check-in items come in goal-id order, not sheet order | Data |
| 2.9 | Set-up mode never saves; people and teams stay; who a check-in belongs to | Data |
| 2.10 | When a replacing row with no Call is judged again | Data |
| 2.11 | When a reason is needed, case by case and item by item | Data |
| 2.12 | Which weeks "Count them from this week" moves stages to | Data |
| 2.13 | The Owner ID column is read but isn't in any column table | Words |
| 2.14 | Headers appear lowercased in messages | Data |
| 2.15 | How several missing check-in parts join into one sentence | Data |
| 2.16 | The check-in worked example can't run on `workspace.json` as given (mttr-pir already has week 45) | Worked example |
| 2.17 | The stage 2 page doesn't link the store contract | Words |
| 2.18 | Saves that point across workspaces are refused (the kit's own listed gap) | Words |
| 2.19 | The change-log entries for an import and undo's reasons are the rebuild's own words | Guessed |
| 2.20 | The speed and chunked-run designs were simplified | Not scored |
| 2.21 | Pages point at code files for detail (`src/domain/records.ts`) that aren't in the kit | Words |
| 2.22 | Not built: the Plan sheet, Left on People, new teams, other-workspace files | Not scored |

### Stage 3: the core screens and journeys

The harness passed: `navigation.csv` 60 of 60, `readback.csv` 6 of 6, `find.csv` 23 of 23 and `home.csv` 56 of 56, with stages 1 and 2 still at 100%. The rebuild is a small server-rendered app with every core route, its named parts and one main action, and saving goes through the stage 2 engine. The exit criteria the harness doesn't score fall short: **a journey in the kit is a title and a budget, with no steps**, so of 71 core journeys the session carried out 15 fully and 18 in part, and didn't build 38 (set-up, proposed or stopped goals, stopping and deleting, quarters, Access, imports, walkthroughs). It can't drive the two widths (the kit has no portable journey runner), and the core requirements can't be checked from the kit alone. So the core is proved where the kit has data, and only outlined where it has words.

| # | Gap | Evidence |
|---|---|---|
| 3.1 | The cases' inputs exist only in the expected CSVs (as 2.1) | Data |
| 3.2 | The conformance README doesn't describe the Feedback-off and every-feature-off rows | `navigation.csv` |
| 3.3 | Some page names aren't in the rule (Wrap up, Research, Workspace) | Data |
| 3.4 | Goal addresses use the id; the rule's examples use the key | Data |
| 3.5 | "A goal to check in on" read as not Done; weakly proved | Data |
| 3.6 | Find's goal words are the path to green's `what` and `needs` | Data |
| 3.7 | "Worst first" is the status rank, then titles A to Z ignoring case | Data |
| 3.8 | Near-miss ties in Find | Guessed |
| 3.9 | A bare number that is no goal's key | Guessed |
| 3.10 | People "whose name starts with the search first" | Not proved |
| 3.11 | The read-back's level words ("an SVP goal", "a north star") | Data |
| 3.12 | Which questions read back under "You said", and their words | Data |
| 3.13 | Weeks past the year's end ("week 13 of 2027") | Data |
| 3.14 | The "Left as usual" conditions | Data |
| 3.15 | The plan's number rounded to the goal's decimals | Data |
| 3.16 | "Goals to discuss" counts every flagged goal, not only those needing attention | Data |
| 3.17 | When a review session counts as held | Data |
| 3.18 | Review weekdays counted from Monday = 0 | Data |
| 3.19 | The README omits the `ask` lead kind | Data |
| 3.20 | Ask leads' titles beyond "needs a decision" | Guessed |
| 3.21 | Which lead wins when check-ins are due and a review is today | Data |
| 3.22 | A goal's first due week (on Home) | Data |
| 3.23 | What makes a week missed | Data |
| 3.24 | Goals taken over from someone else | Not proved |
| 3.25 | Home's one-goal and asks-waiting quiet lines | Data |
| 3.26 | How Home ends the receipt | Data |
| 3.27 | Journeys are titles and budgets only; "a step" isn't defined | Words |
| 3.28 | No portable way to drive the two widths | Kit |
| 3.29 | No status shapes for No check-in yet and Not started | Words |
| 3.30 | Goals' filters and sort live only in a source file not in the kit | Words |
| 3.31 | Some screen behaviours are a line, not a specification | Words |

### Stage 5: Goal map

Built as its own folder over the core. With it on, stages 1 to 3 still score 100%; its own exit tests pass 13 of 16, with 3 journeys (U39, U90, F6) not checkable. A separate reviewer, also seeing only the kit, verified criteria 3 and 4 (off: Layout offers List, Table, Board and History and nothing says Map; `view=map` opens the List with "The Goal map is off here, so this is the List." once, character for character) and rated 1 and 2 weak: pan, zoom, the keyboard and the phone width need a browser, and the journeys are titles. **The module isn't self-contained in the kit's terms:** the core rebuild had no Layout menu, no Table, Board or History, and no Workspace → Features, because the kit doesn't specify them, so the module's builder added them to the core.

| # | Gap | Evidence |
|---|---|---|
| 5.1 | The switch is named only in `schema.sql` (`modulesOff`); `workspace.json` can't say a module is off, so the harness can't score the off state | Kit |
| 5.2 | Journeys are titles; their steps are in `evals/*.cjs`, not in the kit | Kit |
| 5.3 | No browser in the kit's runner: pan, zoom, keyboard and phone width only by hand; dragging and Tidy up not built | Kit |
| 5.4 | Whether the tree is `parentId` only (also-helps lines feed no roll-up or critical path) | Guessed |
| 5.5 | Siblings with no estimated effect get a share of 0 | Guessed |
| 5.6 | The find example's letters name different goals from the other examples | Words |
| 5.7 | What the map shows is listed level by level | Guessed |
| 5.8 | Opening a goal shows everything under it at every depth; the fold counts every hidden goal | Guessed |
| 5.9 | Goals with no check-in yet are left out of the roll-up's counts and status | Guessed |
| 5.10 | The roll-up's format differs between two worked examples | Words |
| 5.11 | "Says once" means once on that page | Guessed |
| 5.12 | Help's module article ids use a different format from the core's | Words |
| 5.13 | Table, Board and History aren't defined anywhere in the kit | Kit |
| 5.14 | Saved views aren't in the core | Kit |
| 5.15 | The core has no proposed goals and no parameter to filter them | Kit |
| 5.16 | The words for a goal's number, target and gap on the map | Words |
| 5.17 | Which goals are greyed "for context" when the map is narrowed | Guessed |
| 5.18 | Search on the Map without a script | Guessed |
| 5.19 | Fit all and Readable need the window's size | Guessed |
| 5.20 | Workspace → Features is missing from the core | Kit |
| 5.21 | The stage page's own listed gaps: the source files it names aren't in the kit | Kit |
| 5.22 | The phone's View sheet isn't built | Not built |

### Stage 4: Feedback

Built as its own folder over the core; stages 1 to 3 still pass with it on, and its own 23 exit tests pass. The reviewer verified criteria 3 to 5 (off: no menu row and no Ctrl+Shift+M; the four addresses give Page not found with "Feedback is switched off in {workspace}. An admin can switch it on in Workspace, Features."; all eight tools refuse; sending gives "Feedback is off in {workspace}." and every record is kept and comes back) and rated 1 and 2 weak where they need a browser, a captured picture, an MCP endpoint or a journey's steps. **Its entry criterion was false:** stage 4 says the core already keeps `Workspace.modulesOff` and refuses a switched-off module's actions and tools (stage 2), but the core rebuilt from the kit has neither, so the module added the switch, the registry and a Features page to the core (as stage 5 did).

| # | Gap | Evidence |
|---|---|---|
| 4.1 | Journeys are titles only | Kit |
| 4.2 | The entry criterion (the core keeps the switch and refuses off actions) isn't built by stages 1 to 3 as the kit describes them | Entry criteria |
| 4.3 | `workspace.json` has no Workspace record, so it can't say a module is off (as 5.1) | Kit |
| 4.4 | Four different "switched off" sentences in the spec | Words |
| 4.5 | What a refused send returns | Words |
| 4.6 | The "still picture" was built as HTML plus SVG, not a screenshot | Not built |
| 4.7 | The status rule's refusal words aren't given | Words |
| 4.8 | Who counts as an admin of the shared inbox | Words |
| 4.9 | The GitHub repository for issues isn't in the kit | Kit |
| 4.10 | What's new has no entries for a fix to link to | Kit |
| 4.11 | Module Help article ids are parsed differently from the core's (as 5.12) | Words |
| 4.12 | The words after sending plain feedback | Words |
| 4.13 | `send_feedback` has no page to record | Words |
| 4.14 | `list_feedback`'s refusals contradict MCP-FEEDBACK | Words |
| 4.15 | The list tools' data is an empty `{}` | Words |
| 4.16 | The tool port's words for bad arguments and tokens | Words |
| 4.17 | What counts as "the same part of a page" when folding | Words |
| 4.18 | Browser-only behaviour (drawing, keys, layout) isn't checkable | Kit |
| 4.19 | The Features page's Undo, Activity line and read-back | Not built |
| 4.20 | No store above workspaces is described (the builders' inbox spans them) | Kit |
| 4.21 | No record of a visit's errors | Kit |
| 4.22 | No MCP endpoint or picture check in the core | Kit |
| 4.23 | The `src`, migrations, `docs` and `evals` files the spec links to aren't in the kit | Kit |

### Stage 6: Metric library

Built as its own folder over the core; stages 1 to 3 pass with it on, and with it off on a copy of the workspace; its own conformance file, `metrics.csv`, scores 109 of 109; its 21 exit tests pass (criteria 3 to 17 in full; 1, 2, 18, 19 and 20 in part, for want of a browser, journey steps, the source contract and parts of the core: the one table, `post_check_in`'s readings, the review agenda, `get_goal`). **Not yet checked by an independent reviewer** (the session handed over first). **The records extension point had to be invented:** how a module declares its records to the core's store, undo, Recently removed, restore, carry and export is only in `src/domain/records.ts`, so the builder wrote `records.mjs` from the README's words; stage 3 also builds none of the places, hooks or module routes the module READMEs name, the next-year cycle, or the core rule "held to no number".

| # | Gap | Evidence |
|---|---|---|
| 6.1 | How a module declares its records, and what calls each part (`records.ts` isn't in the kit) | Kit |
| 6.2 | Stage 3 builds none of the places, hooks or module routes the module READMEs name | Kit |
| 6.3 | `workspace.json` can't say a module is off (as 4.3, 5.1) | Kit |
| 6.4 | Places the stage needs are missing from the README's list (Workspace → About, New goal's Check line, the chart's marks) | Words |
| 6.5 | The module-off sentence has no words | Words |
| 6.6 | Rule 1's worked examples contradict rule 4's close-name Check and rule 7's other-goal Check | Words |
| 6.7 | Many refusal sentences | Guessed |
| 6.8 | A name's minimum length: 3 in the rule, 1 in the records' limits | Words |
| 6.9 | Rule 4's "differ by at most one" is ambiguous | Words |
| 6.10 | The name Check's answer is `keep` in rules.md and `keep:<id>` in tools.md | Words |
| 6.11 | The demo's source series (which goal each follows, `add`, `short`) are only in code | Kit |
| 6.12 | The 17 searches in `metrics.csv` appear only in the expected file | Data |
| 6.13 | The source contract is missing; its 5-second limit can't be built with a synchronous read | Kit |
| 6.14 | Journeys are titles; U159's goal isn't in the demo | Kit |
| 6.15 | `post_check_in` and the one table aren't in the core as the kit describes it | Kit |
| 6.16 | Recorded readings: whether they show in History with the module off | Words |
| 6.17 | Whether a new goal and its metric link save as one commit | Words |
| 6.18 | Starting the next year is simplified; the copied link's date is a guess | Guessed |
| 6.19 | Form niceties not built (a draft kept through a reload, "Use different ones") | Not built |
| 6.20 | The source code the spec links to is absent | Kit |

