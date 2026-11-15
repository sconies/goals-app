# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 15 Nov, about 10:20 UTC, by session_012kbr8y96rDDDHpuiFBfDVA, which handed over at about 240k tokens of context, before the re-run, because the re-run of stage 3 and nine modules would not fit under 300k.

## The brief, in short (redefined by Lane, 15 Nov; replaces the kit-only framing)
The internal team will have Faro's code. Their problem is rebuilding Faro on their own platform (their sign-in and SSO, data store and hosting), not on Supabase and Vercel. So the drill tests that:
1. **Inputs:** each rebuild session gets the kit (`spec/`, `llms.txt`), the running app with its demo (https://goals-app-puce-five.vercel.app/demo?today=2026-11-11, no sign-in) and Faro's code.
2. **Target:** "the stand-in platform": Node 22 `node:http` server, SQLite (`node:sqlite`), its own email-and-password sign-in, a stub SSO, a local files folder, a `setInterval` scheduler; no Supabase, no Vercel. Described in `drill-11-rebuild:standin/PLATFORM.md`.
3. **Measure, per stage:** (a) what ported as-is (src/domain expected almost unchanged); (b) what was rewired (auth, storage, migrations, MCP server, the import's files), and how much; (c) whether the spec's platform requirements were complete (anything needed that the spec didn't name is a gap); (d) behaviour: rules and conformance rows met on the new platform. Journeys are secondary; say which failures are only class names or wording.
4. **Order and time-box:** #547's mediums fixed first (#548, merged). Then the core on the stand-in, then each module, one pass each. Note gaps; fix only one-line kit corrections. No further rounds.
5. **Write-up:** `docs/drill/2026-11-full-drill.md` and `docs/handoff.md` tell the team what ports, what to rewire to their platform, the list of platform requirements, and that the running app and the code are the reference (app URL, and the demo needs no sign-in).
6. Then the rewrites of `README.md`, `docs/handoff.md` and `docs/architecture.md` (the handoff says Faro can be built core first, then each module; fix handoff.md's stale R5 line: R5 is `spec/requirements/internal/r5-notifications-and-habits.md`), a one-line GitHub description draft for Lane, and #512 out of draft.

**Who to tell:**
- Merged code PR numbers go to the build reviewer, **session_012kbr8yEo9vztTkpARWNy66**.
- Report to planning (session_012kbr91eefh4gwCAztBncNT) when done or blocked.
- This item's own kit PRs may be merged by the drill session once CI is green (planning, 14 Nov).

## How the drill is run
Every rebuild is on the scratch branch **`drill-11-rebuild`** (never merge it): one folder per stage with `GAPS.md`, `JOURNEYS.md`, `CORE-CHANGES.md` and `REVIEW.md`. `RESULTS.md` there is the log.

**`drill-11-rebuild` has a root `vercel.json` with `{"git":{"deploymentEnabled":false}}` (planning, 15 Nov: failed Vercel builds of the orphan branch email Lane). Keep it, and put the same file on any new drill branch in its first commit.**

**Reusable briefs are on that branch: `BUILDER.md` and `REVIEWER.md`.** Copy them to your scratchpad, fix the `S =` path (sed), and launch a module as "Read and follow S/BUILDER.md with <folder> = m9-spreadsheets (stage 9, Spreadsheets)". Builders run on the default model, reviewers on Sonnet. Give each agent its own port range (builders 47Nxx, reviewers 49Nxx worked) and tell it S/pin and S/stage-3 are shared and read-only. Saved rebuilds have no node_modules: reviewers install in their copy.

To set up (S = your scratchpad):
1. Kit: `git archive <pin> spec llms.txt | tar -x -C S/kit`.
2. Pin: `git worktree add --detach S/pin <pin>`, then `npm ci` there. Never symlink node_modules (it breaks `api/mcp.js`'s comments).
3. Core: for modules, extract the passing stage-3 folder to S/stage-3 (BUILDER.md copies `S/stage-3/rebuild` into each module's folder).
4. Save each rebuild to `drill-11-rebuild` as soon as it reports (the builder writes `S/<folder>.tgz`; untar it in a worktree of the branch), plus REVIEW.md and a RESULTS.md row.

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
