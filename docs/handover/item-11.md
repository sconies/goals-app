# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 15 Nov, about 07:40 UTC, by session_012kbr92ZrDMM8NQqsZ8ge36, which handed over at about 290k tokens of context (Lane's 14 Nov rule).

## The brief, in short
Backlog item 11: a fresh session rebuilds Faro stage by stage from the kit alone (`spec/` and `llms.txt`): the core first, then each module, one at a time. Record every gap with its stage and evidence, and fix gaps in the kit (`src/spec/*`, a module.json's `rebuild`, conformance rows, `scripts/drill.mjs`): `npm run spec`, then small `[no news]` PRs through the gate. Never point the drill at the source.

The last step is to rewrite `README.md`, `docs/handoff.md` and `docs/architecture.md` from the module map and the generated spec. The handoff must say plainly that Faro can be built core first, then each module on its own. Fix handoff.md's stale R5 line: R5 is written, `spec/requirements/internal/r5-notifications-and-habits.md`. Also draft a one-line GitHub repository description for Lane.

**Who to tell:**
- Merged code PR numbers go to the build reviewer, now **session_012kbr8yEo9vztTkpARWNy66** (planning, 15 Nov; the old 012kbr91tf… is retired).
- Report to planning (session_012kbr91eefh4gwCAztBncNT) once, when every stage on main has passed, or when blocked.
- Merging (planning, 14 Nov): this item's own kit PRs may be merged by the drill session once CI is green.

## How the drill is run
Every rebuild is on the scratch branch **`drill-11-rebuild`** (never merge it): one folder per stage with `GAPS.md`, `JOURNEYS.md`, `CORE-CHANGES.md` and, once reviewed, `REVIEW.md`. `RESULTS.md` there is the log; the section "Re-run on pin 752d6c97" is the current run.

**Reusable briefs are on that branch: `BUILDER.md` and `REVIEWER.md`.** Copy them to your scratchpad, fix the `S =` path, and launch a module as "Read and follow S/BUILDER.md with <folder> = m9-spreadsheets (stage 9, Spreadsheets)". Builders run on the default model, reviewers on Sonnet.

To set up (S = your scratchpad):
1. Kit: `git archive <pin> spec llms.txt | tar -x -C S/kit`.
2. Pin: `git worktree add --detach S/pin <pin>`, then `npm ci` there. Never symlink node_modules (it breaks `api/mcp.js`'s comments).
3. Core: extract `drill-11-rebuild:stage-3` to S/stage-3 (BUILDER.md copies `S/stage-3/rebuild` into each module's folder).
4. Save each rebuild to `drill-11-rebuild` as soon as it reports: `tar --exclude node_modules --exclude drill-out`, one folder per stage, and a RESULTS.md row.
5. Builders keep their notes in `rebuild/modules/<id>/`; copy GAPS, JOURNEYS and CORE-CHANGES to the folder top when saving.

## Where it stands (pin 752d6c97 = #539; #543 merged after, at 2811e0ae)

| Stage | Builder | Reviewer |
|---|---|---|
| 1–2 core | Carried; re-scored 100% after fixing E-16, E-18 from the kit | in stage 3's |
| 3 core + module platform | Harness 100%; platform 37/37; journeys 8 DONE / 18 PART / 45 NOT BUILT of 71 | 1 VERIFIED, 2–3 NOT MET, 4–5 WEAK |
| 4 AI access | 5 of 7; 8 core changes | 3–7 VERIFIED; 1, 2 WEAK |
| 5 Feedback | 5 of 5 (FEEDBACK-RAISED part); journeys 5/4/0; 5 core files | 3–5 VERIFIED; 1, 2 WEAK; list_feedback and triage access contradict; no inbox data model; no menu-count place |
| 6 Goal map | 4 of 4 (journeys only partly); 3 core files | 3, 4 VERIFIED; 1 WEAK; 2 NOT MET |
| 7 Metric library + MI | metrics.csv 124/124; 16 of 22; 5 core files | 11 VERIFIED, 9 WEAK, 2 NOT MET; U81 phone fails; ~45 of 124 rows' questions learned from diffs |
| 8 Reviews | reviews.csv 91/91 first run; 11 of 12 (U103) | 3, 4, 6–10, 12 VERIFIED; 1, 11 WEAK; 2, 5 NOT MET; real gap is the missing `attention` lead and lead order (core-only home.csv leads with attention) |
| 9 Spreadsheets | **build was running at handover** | |
| 10 Fields (tags) | **build was running at handover** | |
| 11 Watching, 12 Wrap-up; late GR, MQ, SW2, FT1 | Not started (MC deferred, Lane 14 Nov) | |

**If a row above still says "running" and `drill-11-rebuild` has no folder or REVIEW.md for it, that work was lost with the old session: re-run it.** Check `git log origin/drill-11-rebuild` first; the last session saved everything it received.

**Kit PRs this session:** #539 (reviewer's findings on #536, #537) merged 752d6c97; #543 (stage 3 gaps, the harness reads only what the expected folder holds, and a test-order leak: `query.test.ts`'s `addColumnParams` leaked into `spec.test` under `isolate: false`, making `goals-query.md` look stale on CI; likely #512's old smoke failure) merged 2811e0ae. Both sent to the reviewer.

## The pattern so far, for the next kit PR
Modules now build on the core's platform, but each still changes 3 to 8 core files and most journeys stay PART, for the same reasons:
1. **Stage 3 doesn't build screens the modules lean on.** Its build list needs: Workspace sections (and the Access section), Settings, redirects, What's new entries, walkthroughs, the proposed state, the View sheet and Group menus, the roll-up of what feeds a goal, Import, Undo and Recently removed, start-next-year, the one-table check-in and its receipt, History's second line, the "N needs attention" count. Either stage 3 builds them or each module page says which it builds itself.
2. **The platform page lacks places:** Goals layouts, a module's scripts and styles, MCP prompts, JSON doors, `:param` routes, after-save and before-check-in hooks, `workspace.about`, a Settings place, the viewer passed to the person-page place, an action that still works while its module is off (revoke a token).
3. **Journeys:** several set up through the browser's own store or a fake Supabase the kit never describes; journey runners exit 0 when nothing runs. The kit should say how a journey seeds data on a server rebuild, and the BUILDER brief should require a runner that fails when no journey ran.
4. **Inputs only in expected files:** find asks, Metrics sheet and `measured` rows (stage 7), tags.csv cases (stage 10). Put inputs in the kit.
5. **Contradictions:** U103's Home lead with Reviews off vs Home rule 5 (stage 8, G11; check the reviewer's verdict); `list_feedback` and triage access (stage 5); leave-out by name vs Ref and near-header casing (stage 9, old run).
6. **The reviewer's two mediums on #543 (planning, 15 Nov; evidence in #543's section on `build-reviews`, 5a203c87), yours, in the next kit PR:**
   - `scripts/drill.mjs` now skips a contract that drill.json names but the folder lacks, and passes: `"contracts": ["Store"]` (folder has `store`) used to stop with exit 2, now prints "Not run: contract Store" and PASSES, `--json` says pass: true. Restore the failure whenever the folder has `contracts/` but not that one; let through only a folder with no `contracts/` at all (core-only).
   - Five new sentences in `src/spec/journeySteps.ts` (PIECES and JOURNEY_SET_UP) say what Faro doesn't do: the read-back has a row per topic, not per sentence; `.why-block` is headed "Why" only when there's no check-in; U78's ns-lead has one goal feeding it, not two; "settled" means every non-open row, kept eight weeks; lead-rollback's check-in in U122 is 10 Nov, not that morning.
7. Two follow-ups from #543's body: fully portable journeys (about 500 class names) and 18 screens.md buttons without words.

## Next steps
1. Collect any results from the old session that didn't land (see above); re-run what's missing: reviews of 5 and 8, builds and reviews of 9 and 10.
2. Build 11 (Watching) and 12 (Wrap-up), each with a review. Then the late ones.
3. Write the kit PR for the pattern above, gap by gap against `drill-11-rebuild`'s GAPS and REVIEW files; verify each against the code; merge when green; send to the reviewer.
4. Re-pin to main after it merges and re-run stage 3, then each module; aim for few or no core changes and many more journeys DONE.
5. Once every stage on main has passed: update `docs/drill/2026-11-full-drill.md` from RESULTS.md, do the doc rewrites and the repo description, report to planning, and take #512 out of draft.

**Bugs for the backlog** (planning should place them; none fixed): U69 opens `rel-cfr`, which doesn't exist; `evals/run.mjs` needs `node_modules/vite` in the repo root (fails in a worktree); Help's core articles name reviews while Reviews is off; an unedited export doesn't load back through the engine without four fixes (m9 M9-3); demo G-48's 141-character name makes an unchanged export refused (m10 T-14); `home.csv` fails `npm run spec -- --check` under TZ=Pacific/Auckland; negative days without an update before a plan starts (the kit called it backlog 0v, but there is no such item: planning should add one).

## Ready prompt for the next session
> You take over backlog item 11, the full rebuild drill, for Faro. Read CLAUDE.md, then `docs/handover/item-11.md` on branch `drill-item-11` (#512): it has the brief, how the drill runs, where it stands and the next steps. Then read `RESULTS.md`, `BUILDER.md` and `REVIEWER.md` on the scratch branch `drill-11-rebuild`. Start with "Next steps" 1. Keep your context lean: every rebuild, scoring run, gap fix and eval run goes to a subagent (Sonnet where it's mechanical). Hand over at about 300k tokens by replacing `docs/handover/item-11.md`. Send merged code PR numbers to the build reviewer (session_012kbr8yEo9vztTkpARWNy66). Report to planning (session_012kbr91eefh4gwCAztBncNT, or whichever session says planning has moved) once every stage on main has passed, or when you're blocked.
