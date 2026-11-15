# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 15 Nov, about 10:20 UTC, by session_012kbr8y96rDDDHpuiFBfDVA, which handed over at about 240k tokens of context, before the re-run, because the re-run of stage 3 and nine modules would not fit under 300k.

## The brief, in short
Backlog item 11: a fresh session rebuilds Faro stage by stage from the kit alone (`spec/` and `llms.txt`): the core first, then each module, one at a time. Record every gap with its stage and evidence, and fix gaps in the kit (`src/spec/*`, a module.json's `rebuild`, conformance rows, `scripts/drill.mjs`): `npm run spec`, then small `[no news]` PRs through the gate. Never point the drill at the source.

The last step is to rewrite `README.md`, `docs/handoff.md` and `docs/architecture.md` from the module map and the generated spec. The handoff must say plainly that Faro can be built core first, then each module on its own. Fix handoff.md's stale R5 line: R5 is written, `spec/requirements/internal/r5-notifications-and-habits.md`. Also draft a one-line GitHub repository description for Lane.

**Who to tell:**
- Merged code PR numbers go to the build reviewer, **session_012kbr8yEo9vztTkpARWNy66**.
- Report to planning (session_012kbr91eefh4gwCAztBncNT) once, when every stage on main has passed, or when blocked.
- Merging (planning, 14 Nov): this item's own kit PRs may be merged by the drill session once CI is green.

## How the drill is run
Every rebuild is on the scratch branch **`drill-11-rebuild`** (never merge it): one folder per stage with `GAPS.md`, `JOURNEYS.md`, `CORE-CHANGES.md` and `REVIEW.md`. `RESULTS.md` there is the log.

**`drill-11-rebuild` has a root `vercel.json` with `{"git":{"deploymentEnabled":false}}` (planning, 15 Nov: failed Vercel builds of the orphan branch email Lane). Keep it, and put the same file on any new drill branch in its first commit.**

**Reusable briefs are on that branch: `BUILDER.md` and `REVIEWER.md`.** Copy them to your scratchpad, fix the `S =` path (sed), and launch a module as "Read and follow S/BUILDER.md with <folder> = m9-spreadsheets (stage 9, Spreadsheets)". Builders run on the default model, reviewers on Sonnet. Give each agent its own port range (builders 47Nxx, reviewers 49Nxx worked) and tell it S/pin and S/stage-3 are shared and read-only. Saved rebuilds have no node_modules: reviewers install in their copy.

To set up (S = your scratchpad):
1. Kit: `git archive <pin> spec llms.txt | tar -x -C S/kit`.
2. Pin: `git worktree add --detach S/pin <pin>`, then `npm ci` there. Never symlink node_modules (it breaks `api/mcp.js`'s comments).
3. Core: for modules, extract the passing stage-3 folder to S/stage-3 (BUILDER.md copies `S/stage-3/rebuild` into each module's folder).
4. Save each rebuild to `drill-11-rebuild` as soon as it reports (the builder writes `S/<folder>.tgz`; untar it in a worktree of the branch), plus REVIEW.md and a RESULTS.md row.

## Time-box (Lane, 15 Nov, via planning)
The drill is time-boxed. One re-run on main only: stage 3, then each module, with no further rounds of kit fixes to chase journey scores. Gaps the re-run finds are written down, not fixed in the kit, unless they are one-line corrections. Score on behaviour first (the rules and conformance rows a rebuild meets); report journeys alongside, saying plainly which failures are only class names or wording. Then write it up in `docs/drill/2026-11-full-drill.md`, saying honestly what a kit-only rebuild gets right and where the internal team should read the code, with the same message in `docs/handoff.md`; then the README, handoff and architecture rewrites, the GitHub description draft for Lane, and #512 out of draft.

## Where it stands
**Run on pin 752d6c97 is complete:** every stage 3–12 built and reviewed; all rows and REVIEW.md files are on `drill-11-rebuild` (last commit 3a47d8cf, then 9a200812 for vercel.json). Summary of that run: every module scores 100% on the harness and its own CSV where one exists, exit tests are honest; but each module changed 3–8 core files and most journeys stayed PART, because stage 3 lacked screens and the platform lacked places. Late GR, MQ, SW2, FT1 have no module on main yet (MC deferred, Lane 14 Nov).

**Kit PRs this session, both merged and sent to the reviewer:**
- #544 (096920f4): harness fails again when a rebuild has `contracts/` but not the named contract (case slips said); the five journeySteps.ts sentences from the reviewer's #543 mediums (on "settled", the code keeps answered/done rows with no eight-week limit; only the unused `actionList` drops them); backlog 0v added.
- #547 (6e41c494): stage 3's build list gains Workspace sections and Access, Settings, Cycles and start-next-year, Undo and Recently removed, saved views, Goals menus and the proposed state, the one-table check-in with receipt and History's second line, What's new; year-end Met / Met late / Not met; module entry criteria say what waits for stage 9's workbook. Module platform: a table of every place and hook the core draws, tested against the screen that draws it (route kinds, viewer, a module's own off sentence, revoke-while-off, module-owned Help); each module README lists what it needs. Journeys: runners must fail when nothing ran or the app didn't start, run core journeys on, off and without each module; Faro-only set-ups (`__goalsStore`, `seedStage`, `fakeSupabase`) described for a server rebuild; every F and N check has a page. Inputs: `module-cases.json` (metrics searches and sheet rows, tags cases), copied by the harness; seven new change-engine cases. Contradictions fixed (`scope=watching`, triage and `list_feedback`, Fields limits). Words added for Fields, Watching, Wrap-up, Feedback, Reviews' read-back. **Not done (in #547's body):** a stage-9 drill CSV, edge data for Watching (stopped goals, people who left: m11 G9), and some module words.

## Next steps
1. **Re-pin to main at or after 6e41c494** and re-run stage 3 from the kit (builder on the default model; stage 3 has its own brief in `drill-11-rebuild:BRIEF.md` and stage-3/; it must now build the screens #547 added). Review it (Sonnet). Save as a new folder or a clearly marked re-run section in RESULTS.md ("Re-run on pin <sha>").
2. Then each module 4–12 on the new stage 3, with a review each. Aim: few or no core changes, many more journeys DONE. Run up to about four agents at once, each on its own port range.
3. Fix what the re-run still finds in another kit PR (start with #547's "Not done"), merge when green, send to the reviewer.
4. Once every stage on main has passed: update `docs/drill/2026-11-full-drill.md` from RESULTS.md, do the doc rewrites and the repo description, report to planning, and take #512 out of draft.

**Bugs for the backlog** (planning should place them; none fixed): U69 opens `rel-cfr`, which doesn't exist; `evals/run.mjs` needs `node_modules/vite` in the repo root (fails in a worktree); Help's core articles name reviews while Reviews is off; an unedited export doesn't load back through the engine without four fixes (m9 M9-3); demo G-48's 141-character name makes an unchanged export refused (m10 T-14); `home.csv` fails `npm run spec -- --check` under TZ=Pacific/Auckland; Reviews' switch-off read-back says "1 open next step … on their goals" for one goal (#547). Backlog 0v (negative days before a plan starts) is now on the backlog (#544). Also seen: U64 (Back after a search, on Activity) flakes now and then in rebuilds, the core's known Back race; the m9 rebuild's exit suite fails in 5 of 6 runs with `fetch failed` after its 30,000-row test (rebuild-side, not Faro).

## Ready prompt for the next session
> You take over backlog item 11, the full rebuild drill, for Faro. Read CLAUDE.md, then `docs/handover/item-11.md` on branch `drill-item-11` (#512): it has the brief, how the drill runs, where it stands and the next steps. Then read `RESULTS.md`, `BUILDER.md` and `REVIEWER.md` on the scratch branch `drill-11-rebuild`. Start with "Next steps" 1: re-pin to main and re-run stage 3. Keep your context lean: every rebuild, scoring run, gap fix and eval run goes to a subagent (Sonnet where it's mechanical). Hand over at about 300k tokens by replacing `docs/handover/item-11.md`. Send merged code PR numbers to the build reviewer (session_012kbr8yEo9vztTkpARWNy66). Report to planning (session_012kbr91eefh4gwCAztBncNT, or whichever session says planning has moved) once every stage on main has passed, or when you're blocked.
