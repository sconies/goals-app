# The full rebuild drill (backlog item 11), November 2026

The last proof before the handoff: a fresh session rebuilds Faro stage by stage from the rebuild kit alone (`spec/` and `llms.txt`), the core first and then each module on its own, and each stage ships when its exit criteria pass.

- **Pinned to:** main at `dd00ff48` (KL's merge, #508). The kit read by every stage is `spec/` and `llms.txt` from that commit; later merges don't change this run.
- **How each stage runs:** a fresh subagent sees only a scratch folder with a copy of the pinned `spec/` and `llms.txt` (never Faro's source), builds the stage under `rebuild/` on top of the previous stage's passing rebuild, and keeps `GAPS.md`. Stages 1 to 3 are scored by the harness (`npm run drill -- <folder>`, run from the pinned commit). Module stages (4 to 11) are outlines with no harness of their own: the rebuild must still score 100% on stages 1 to 3 with the module in it, and a separate reviewer checks each exit criterion by hand against the rebuild.
- **A gap** is a place where the kit alone wasn't enough. Each one is fixed in the kit itself (`src/spec/*`, a module's `rebuild` stage, conformance rows), never by pointing the drill at the source.

## Scorecard

| Stage | Result | Gaps found | PRs |
|---|---|---|---|
| 1. The core rules | **Pass**: 43,373 of 43,373 rows | 16 (1.1 to 1.16) | #513 (all 16) |
| 2. The core data and the change engine | **Pass**: 205 of 205 rows, store contract 13 of 13; stage 1 still passes. Only after reading the expected rows by hand | 22 (2.1 to 2.22) | |
| 3. The core screens and journeys | Running | | |
| 4. Module: Feedback | Waiting | | |
| 5. Module: Goal map | Waiting | | |
| 6. Module: Metric library | Waiting | | |
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

