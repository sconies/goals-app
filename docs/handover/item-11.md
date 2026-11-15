# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 15 Nov, about 00:20 UTC, by session_012kbr91xr465aJnuHqSW7tT (handed over at about 280k tokens of context, Lane's 14 Nov rule).

## The brief, in short
Backlog item 11: a fresh session rebuilds Faro stage by stage from the kit alone (`spec/` and `llms.txt`), the core first and then each module, one at a time; record every gap with stage and evidence; fix gaps in the kit (`src/spec/*`, module.json `rebuild`, conformance rows), `npm run spec`, small `[no news]` PRs through the gate; never point the drill at the source. Last: rewrite `README.md`, `docs/handoff.md` and `docs/architecture.md` from the module map and the generated spec (the handoff says plainly Faro can be built core first, then each module on its own; fix handoff.md's stale R5 line: R5 is written, `spec/requirements/internal/r5-notifications-and-habits.md`), and draft a one-line GitHub repository description for Lane. Send each merged code PR's number to the build reviewer (**session_012kbr8z4ihwvC1ZUTMGey4V**); report to planning (session_012kbr91eefh4gwCAztBncNT) once when every stage on main has passed, or when blocked.

**Merging (planning, 14 Nov, 23:27 UTC):** this item's own kit-fix PRs may be merged by the drill session once CI is green (mark ready, merge; `npm run spec` again after merging main in). If a permission check refuses, send the number to planning.

## How the drill is run (reuse this, don't re-invent it)
All in the scratchpad of the session that ran it, which a new session can't see. Recreate:
- `kit/`: `git archive <pin> spec llms.txt | tar -x -C <scratch>/kit`.
- `pin/`: `git worktree add <scratch>/pin <pin>`; `npm ci` there (the harness needs deps on the new main); independent scoring is `cd pin && npm run drill -- <folder>`, sent to a Sonnet subagent.
- Each stage: a folder with a copy of `kit/spec`, `kit/llms.txt` and `rebuild/` (the previous stage's passing rebuild). A subagent told to read only that folder builds the stage and keeps GAPS.md. Module stages start from the core rebuild (stages 1 to 3), each module on its own, with `BRIEF.md` (text below) in the folder; then a Sonnet reviewer, also kit-only, runs the harness and the module's `exit.test.mjs` and rates each exit criterion VERIFIED / WEAK / NOT MET.
- **Keep the core rebuild somewhere durable this time** (e.g. commit it to a scratch branch `drill-11-rebuild`, never to main): the last one was lost with its scratchpad, and stages 1 to 3 cost about 1.1M subagent tokens.

The module brief given to each module builder: read `BRIEF.md`; strict isolation (only the scratch folder; never `/home/user/goals-app`, other folders, git, the web; never read expected CSVs from code); read README, lessons, the stage page and `spec/modules/<m>/`; build in `rebuild/modules/<m>/`, registering into the core, listing every core file changed and why; a switch (`Workspace.modulesOff`); `exit.test.mjs` with one test per exit criterion, on and off; stages 1 to 3 still PASS with the module in; `GAPS.md`; reply under 400 words.

## Where it stands
Scorecard and every gap: `docs/drill/2026-11-full-drill.md` (PR **#512**, draft, the item's own PR; the final rewrites join it; backlog 0v is in it).

Lane's three answers (14 Nov) are done and merged, plus the reviewer's #515 finding:
| PR | What | State |
|---|---|---|
| #515 | Stage 2's kit gaps (inputs, sentences) | Merged, sent to the reviewer |
| #524 | The change engine's seven sentences match the engine (reviewer's medium on #515) | Merged, sent |
| #521 | Answer 3: a Reached moment is fixed as of its own week; the cuts live in `moment` (`src/domain/habit.ts`); What's new entry | Merged, sent (closes the reviewer's #513 medium) |
| #527 | Answer 1: every journey's steps and checks generated into `spec/core/journeys/<id>.md` and `spec/modules/<m>/journeys/` (`src/spec/journeySteps.ts`); `spec/core/goals-query.md`; stage 3 gaps 3.2–3.4, 3.7, 3.18, 3.19, 3.27, 3.29, 3.30 | Merged, sent |
| **#525** | Answer 2: edge-case workspace (`src/spec/edge.ts`, `spec/conformance/edge/`, 1,360 stage 1 rows; the harness scores a stage 1 rebuild on it too; five mutants of 1.3, 1.9, 1.12 pass the demo and fail here) | **Draft, main merged in (656829c2), local gate green (2,137 tests, drill 100%), CI running at handover. Not yet merged or sent to the reviewer** |

Stage 3 gaps left for words (not done by #527): 3.1, 3.5, 3.6, 3.8–3.17, 3.20–3.26 (check the words against the conformance rows); 3.28 needs a tool; 3.31 too general. Stages 4 and 5 gaps: no fixer started.

| Stage | State |
|---|---|
| 1 core rules | Passed on the old pin (`dd00ff48`); re-run on the new pin with the edge rows |
| 2 core data | Passed on the old pin only by reading expected rows; re-run on the new pin |
| 3 core screens | Re-run on the new pin (this is Lane's answer 1's re-run) |
| 4 Feedback, 5 Goal map | Switch criteria verified; requirements and journeys weak (journeys now have steps: re-check) |
| 6 Metric library | Rebuild lost with the old scratchpad; re-run with a reviewer |
| 7 Reviews, 8 Spreadsheets, 9 Fields (TG1), 10 Watching, 11 Wrap-up | Not started |
| Late modules: GR, MQ (#502, #505), TG2 (#493), SW2 (#504), FT1 | Add when on main. MC deferred (Lane, 14 Nov) |
| MI (#520, merged; track 3, 15 Nov) | Ready as a stage: the Metrics sheet in and out, folded into the metrics module's stage (`spec/rebuild/stage-7-module-metrics.md`): the sheet loads back through the core's change engine by the module's planner (`domain/sheetPlan.ts`), with MQ's four columns; exit lines for the round trip and the loop refusal; conformance `spec/conformance/metrics.csv`, rule `sheet`, 15 cases; journey U179 |

Backlog 0v (added in #512): negative days-without-update before a plan starts; the edge rows record today's behaviour, with a note, until it's fixed.

## Next steps
1. Subscribe to #525 and #512. When #525's CI is green: mark ready, merge, send the number to the reviewer. If it conflicts, merge main in, `npm run spec`, gate, push.
2. **Re-pin** the drill to main after #525's merge. Recreate `kit/` and `pin/` from it (`npm ci` in `pin/`).
3. Rebuild the core, stages 1 to 3, from the new kit (one subagent per stage, kit-only), score each independently, record gaps in the scorecard; keep the rebuild on a scratch branch.
4. Modules 4 to 11 then the late ones, two at a time, each with a kit-only reviewer; record each in the scorecard; fix gaps in small `[no news]` PRs.
5. Once every stage on main has passed: the doc rewrites, the repo description, report to planning, take #512 out of draft.

## Ready prompt for the next session
> You take over backlog item 11, the full rebuild drill, for Faro. Read CLAUDE.md, then `docs/handover/item-11.md` on branch `drill-item-11` (#512): the brief, how the drill runs, where it stands, next steps. Then `docs/drill/2026-11-full-drill.md` (the scorecard). Start with "Next steps" 1 (#525). Keep your context lean: every rebuild, scoring run, gap fix and eval run goes to a subagent (Sonnet where it's mechanical); hand over at about 300k tokens by replacing `docs/handover/item-11.md`. Send merged code PR numbers to the build reviewer (session_012kbr8z4ihwvC1ZUTMGey4V) and report to planning (session_012kbr91eefh4gwCAztBncNT, or whichever session says planning has moved) once when every stage on main has passed or you're blocked.
