# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 15 Nov, about 03:15 UTC, by session_012kbr8yzCbkjiihKi6sbjNe, which handed over at about 320k tokens of context (Lane's 14 Nov rule).

## The brief, in short
Backlog item 11: a fresh session rebuilds Faro stage by stage from the kit alone (`spec/` and `llms.txt`): the core first, then each module, one at a time. Record every gap with its stage and evidence, and fix gaps in the kit (`src/spec/*`, a module.json's `rebuild`, conformance rows): `npm run spec`, then small `[no news]` PRs through the gate. Never point the drill at the source.

The last step is to rewrite `README.md`, `docs/handoff.md` and `docs/architecture.md` from the module map and the generated spec. The handoff must say plainly that Faro can be built core first, then each module on its own. Fix handoff.md's stale R5 line: R5 is written, `spec/requirements/internal/r5-notifications-and-habits.md`. Also draft a one-line GitHub repository description for Lane.

**Who to tell:**
- Send each merged code PR's number to the build reviewer, now **session_012kbr91tf31zgvoDfJXAVxo** (planning, 15 Nov).
- Report to planning (session_012kbr91eefh4gwCAztBncNT) once, when every stage on main has passed, or when blocked.
- Merging (planning, 14 Nov): this item's own kit PRs may be merged by the drill session once CI is green. If a permission check refuses, send the number to planning.

## How the drill is run
Nothing is lost with a scratchpad now: **every rebuild is on the scratch branch `drill-11-rebuild`** (never merge it). It has one folder per stage (`stage-1`, `stage-2`, `stage-3`, `m4-ai-access` … `m10-tags`), each with its `GAPS.md`, `JOURNEYS.md` and `CORE-CHANGES.md`. `RESULTS.md` there is the results log, one row per stage with the builder's and the reviewer's verdicts.

To run a stage (S = your scratchpad):
1. **Kit:** `git archive <pin> spec llms.txt | tar -x -C S/kit`.
2. **Pin:** `git worktree add S/pin <pin>`, then `npm ci` there. Independent scoring is `cd S/pin && npm run drill -- <folder>`, done by a Sonnet subagent. Don't run `npm run spec` in the pin; restore it with `git checkout -- spec` if anything does.
3. **The stage's folder:** a copy of the kit's `spec/` and `llms.txt`, plus `rebuild/` = the previous passing rebuild (for a module: `stage-3`, with an empty `local/`), plus `BRIEF.md` for a module. BRIEF.md is at `drill-11-rebuild:BRIEF.md`; if it's missing there, the text is in RESULTS.md's history. A builder subagent is told to read only that folder.
4. **Review:** a kit-only Sonnet reviewer runs the harness and `exit.test.mjs`, and rates each exit criterion VERIFIED / WEAK / NOT MET. It also flags gaps that are really the builder's mistakes.
5. **Builder prompt lines worth keeping:**
   - journey tests must fail when a check fails: no filtering, no stale results files;
   - start the app on an unusual port, since other sessions kill common ones;
   - note in CORE-CHANGES.md what the core lacked.
6. Save each rebuild to `drill-11-rebuild` (tar without node_modules and drill-out) as soon as it reports.

## Where it stands (re-run on pin 2fce09b4, kit2 = 517e3d04 for tags)

| Stage | Result | Reviewer |
|---|---|---|
| 1 core rules | PASS in 2 runs, demo plus edge; 19 gaps, 3 guessed wrong and caught by the edge rows | Scored PASS |
| 2 core data | PASS in 6 runs without reading expected CSVs; 14 behaviours learned from diffs | Scored PASS |
| 3 core screens | Harness PASS; journeys only 13 DONE / 24 PART / 36 NOT BUILT of 73 | Scored PASS; 13 of 18 scripted journeys pass |
| 4 AI access | 6 of 7 met | 1, 2 WEAK; 3–7 VERIFIED |
| 5 Feedback | 3 of 5 met | 2 WEAK; others VERIFIED |
| 6 Goal map | 3 of 4 met | 2 NOT MET (3 of 10 journeys run); 1, 3, 4 VERIFIED |
| 7 Metric library | 7 of 20 met, 13 part; metrics.csv 109/109 | 12 VERIFIED, 6 WEAK, 20 NOT MET |
| 8 Reviews | 8 of 12 met; reviews.csv 91/91 with a patched harness | 6 VERIFIED, 5 WEAK, 2 NOT MET |
| 9 Spreadsheets | 12 of 14 met, 10 journeys DONE; an unedited export doesn't load back through the stage 2 engine (M9-3) | **Not yet reviewed** |
| 10 Fields (tags) | 11 of 13 met, 4 of 4 journeys DONE; tags.csv 25/25 | **Not yet reviewed** |
| 11 Watching, 12 Wrap-up | Not started | |
| Late: GR, MQ, SW2, FT1; MI is folded into stage 7 (#520) | Not started. MC deferred (Lane, 14 Nov) | |

**Kit PRs from this run:**

| PR | What | State |
|---|---|---|
| #525 | The edge-case workspace | Merged, sent to the reviewer |
| #531 | Journey pages name their entry, not a line number (main had gone red) | Merged, sent |
| #536 | Stage 1–2 words: the 3 wrong guesses, the 14 diff-learned engine behaviours, more edge cases | Merged (5d857a70), sent to the reviewer; one medium back (step 0) |
| **#537** | The core's module platform (`spec/rebuild/module-platform.md`); stage 3 builds it; `screen-cases.json`; core-only conformance set; harness reads `also` for reviews, tags and watching; journeys a rebuild can follow; read-back words | **Draft, gate green locally, CI running at handover** |

#536 and #537 both touch `src/spec/rules.ts` and `rebuild.ts`. Merge whichever goes green first, then merge main into the other, run `npm run spec`, run the gate, and merge it.

**#512's CI:** the smoke job failed twice on this branch, which is docs-only and identical to main under `spec/`. The failures were `spec/core/goals-query.md` reported stale, and the scale test at 3.08 against < 3 under load. Neither reproduces locally with a clean `npm ci`. #512 is a draft: give it one re-run after the next main merge before digging further.

**Bugs for the backlog** (planning should place them; none are fixed):
- U69 opens `rel-cfr`, which doesn't exist; it passes only because "Goal not found" counts as a distinct title.
- `evals/run.mjs` needs `node_modules/vite` in the repo root, so it fails in a worktree.
- Help's core articles name reviews while Reviews is off.
- An unedited export doesn't load back through the core change engine without four fixes (m9 M9-3). Check whether Faro's engine has the same behaviour.
- Demo goal G-48 has a 141-character name, so an unchanged export is refused by the change engine (m10 T-14). Check it against the name limit.
- `spec/conformance/home.csv` fails `npm run spec -- --check` under TZ=Pacific/Auckland: the spec depends on the time zone.
- Backlog 0v (already in): negative days without an update before a plan starts.

## Next steps
0. **The reviewer's medium on #536 (planning, 15 Nov), yours to fix in the next kit-words PR.** Eight added sentences say what the code doesn't do:
   - `saves` is never yes in set-up from a file;
   - days without an update ignores rhythmFrom when there's no set rhythm;
   - a row whose plan changed is a `plan` item whatever else it changes (not "alone");
   - a new goal's item also writes Plan shape and Warning margin;
   - Stages and Plan numbers write bare weeks too;
   - new-ID prefixes miss `req` and `ask`;
   - the near-header case raises a third note (the Type default);
   - `undo` now has `moduleRows` (#520).

   The evidence is in #536's section of the reviewer's log on `build-reviews` (0a5a5aa9 and the commit after), with two lows and three older sentences beside them. Send the reviewer the PR number when it merges.
1. Subscribe to #536 and #537. Mark each ready, merge it when green, and send the numbers to the reviewer. Merge main into the second one as above.
2. **Re-pin** to main after both merge, then recreate kit/ and pin/.
3. **Re-run the core from the fixed kit:** stage 3 must now build the module platform and pass the core-only set. Score each stage independently. The aim is many more of the 73 core journeys DONE; record the new tally against 13.
4. **Re-run every module on the new core**, each with a kit-only reviewer. They should now need few or no core changes; CORE-CHANGES.md shows it. First run the two missing reviews (9 and 10) on the old core if useful; otherwise go straight to: 4 to 12, then module 7 again with MI, then the late ones. Fix gaps in small `[no news]` PRs: the module gaps in each `m*/…/GAPS.md` are mostly words not yet fixed (switched-off words, tool outputs, parts the journeys name, `seedStage` data).
5. Once every stage on main has passed: update the scorecard `docs/drill/2026-11-full-drill.md` from `RESULTS.md` (it still shows the old pin and the old stage numbers: the kit now numbers AI access 4 … Wrap-up 12). Then do the doc rewrites and the repo description, report to planning, and take #512 out of draft.

## Ready prompt for the next session
> You take over backlog item 11, the full rebuild drill, for Faro. Read CLAUDE.md, then `docs/handover/item-11.md` on branch `drill-item-11` (#512): it has the brief, how the drill runs, where it stands and the next steps. Then read `RESULTS.md` on the scratch branch `drill-11-rebuild`, which holds every rebuild so far. Start with "Next steps" 1: #536 and #537. Keep your context lean: every rebuild, scoring run, gap fix and eval run goes to a subagent (Sonnet where it's mechanical). Hand over at about 300k tokens by replacing `docs/handover/item-11.md`. Send merged code PR numbers to the build reviewer (session_012kbr91tf31zgvoDfJXAVxo). Report to planning (session_012kbr91eefh4gwCAztBncNT, or whichever session says planning has moved) once every stage on main has passed, or when you're blocked.
