# Handover: item 11, the full rebuild drill

Replace this entry at each handover; don't append. Last written 14 Nov, about 21:40 UTC, by session_012kbr8y5FBfBYyNt4XKM97h (handed over at about 300k tokens of context, Lane's 14 Nov rule).

## The brief, in short
Backlog item 11: a fresh session rebuilds Faro stage by stage from the kit alone (`spec/` and `llms.txt` **pinned at main `dd00ff48`**, KL's merge), the core first and then each module on main at the pin, one at a time; record every gap with stage and evidence; fix gaps in the kit (`src/spec/*`, module.json `rebuild`, conformance rows), `npm run spec`, small `[no news]` PRs through the gate; never point the drill at the source. Last: rewrite `README.md`, `docs/handoff.md` and `docs/architecture.md` from the module map and the generated spec (the handoff says plainly Faro can be built core first, then each module on its own; fix handoff.md's stale R5 line, which says R5 isn't written; it is, `spec/requirements/internal/r5-notifications-and-habits.md`), and draft a one-line GitHub repository description for Lane. Send merged code PR numbers to the build reviewer (**session_012kbr8z4ihwvC1ZUTMGey4V**, moved from the brief's one); report to planning (session_012kbr91eefh4gwCAztBncNT) once when every stage on main has passed or you're blocked (the core report is sent).

## How the drill is run (reuse this, don't re-invent it)
All in the scratchpad of the session that ran it, which a new session can't see. Recreate:
- `kit/`: `git archive dd00ff48 spec llms.txt | tar -x -C <scratch>/kit`.
- `pin/`: `git worktree add <scratch>/pin dd00ff48`; independent scoring is `cd pin && npm run drill -- <folder>` (no install), sent to a Sonnet subagent.
- Each stage: a folder with a copy of `kit/spec`, `kit/llms.txt` and `rebuild/` (the previous stage's passing rebuild). A subagent told to read only that folder builds the stage and keeps GAPS.md. Module stages start from the core rebuild (stages 1 to 3), each module on its own, with `BRIEF.md` (text below) in the folder; then a Sonnet reviewer, also kit-only, runs the harness and the module's `exit.test.mjs` and rates each exit criterion VERIFIED / WEAK / NOT MET.
- The core rebuild can't be recovered from a lost scratchpad: rebuilding stages 1 to 3 again costs about 1.1M subagent tokens. If you need it, rebuild it (with the kit fixes merged, that's a fair second drill), or run modules on a fresh core.

The module brief given to each module builder: read `BRIEF.md`; strict isolation (only the scratch folder; never `/home/user/goals-app`, other folders, git, the web; never read expected CSVs from code); read README, lessons, the stage page and `spec/modules/<m>/`; build in `rebuild/modules/<m>/`, registering into the core, listing every core file changed and why; a switch (`Workspace.modulesOff`); `exit.test.mjs` with one test per exit criterion, on and off; stages 1 to 3 still PASS with the module in; `GAPS.md`; reply under 400 words.

## Where it stands
Scorecard and every gap: `docs/drill/2026-11-full-drill.md` (PR **#512**, draft, the item's own PR; the final rewrites join it).

| Stage | State |
|---|---|
| 1 core rules | Pass, 43,373/43,373. 16 gaps, fixed in **#513 (merged, sent to the reviewer)** |
| 2 core data, change engine | Pass, 205/205 + store contract 13/13, but only by reading the expected rows: inputs and ~45 of 66 sentences are only in the CSVs. 22 gaps; fixer was running on branch `drill-gaps-stage2` (no PR yet) |
| 3 core screens | Harness pass 145/145; by hand 15 of 71 journeys full, 18 part, 38 not built (journeys are titles only). 31 gaps; **no fixer started** |
| 4 Feedback | Switch criteria verified by the reviewer; requirements and journeys weak. 23 gaps; no fixer started. **Its entry criterion was false**: the kit's core has no switch (4.2) |
| 5 Goal map | Switch criteria verified; requirements and journeys weak. 22 gaps; no fixer started |
| 6 Metric library | Builder was running |
| 7 Reviews, 8 Spreadsheets, 9 Fields (TG1), 10 Watching, 11 Wrap-up | Not started |

To add when merged: GR (#464), MQ (#502 merged; #505 to come), FT1 (#465), TG2 (#493), SW2 (#504), MI. MC is deferred (Lane, 14 Nov).

## Gaps that cut across stages (the ones worth a PR of their own)
- **The conformance data proves less than it seems:** stage 1's rebuild guessed wrong three times (1.3, 1.9, 1.12) and still scored 100%, because the demo never tests range goals, ties or corrections. Add edge-case conformance rows (a second, small workspace is safer than changing the demo).
- **Inputs and words only in the expected CSVs** (2.1, 2.2, 3.1): give the kit input files and word tables generated from the code.
- **Journeys are titles and budgets** (3.27, 5.2): the kit needs each journey's steps (from `evals/*.cjs`) in words, and a portable runner, or the stage pages should say plainly that journeys are checked by hand from titles.
- **The switch isn't in the kit's data** (5.1): `workspace.json` can't say a module is off, so no harness run proves the off state; and Workspace → Features, Layout, Table, Board, History and saved views aren't specified (5.13, 5.14, 5.20), so module builders add them to the core.
- **Module stages have no harness:** each is an outline checked by hand.

## Lane's answers on the core findings (14 Nov, via planning, 21:43 UTC). Do these first
1. **Close the journeys gap:** make `npm run spec` generate each core journey's steps and checks from `evals/journeys.cjs` into `spec/`, so the kit says what every journey does, not just its title and budget. Then re-run stage 3 from the new kit.
2. **Edge-case conformance rows:** add rows for each rule the stage 1 rebuild guessed wrong and still passed (range goals, ties, corrections, 1.3, 1.9, 1.12, and others found), so a wrong rebuild fails.
3. **The moment's rule (the reviewer's medium on #513):** Lane chose the kit's rule. A check-in's Reached moment is fixed as of its own week, judged against earlier check-ins and that week's plan, so later posts and re-plans don't erase it. History (`GoalScreen.tsx:1008` passes every other check-in and today's plan to `moment`) must change to match, by moving the cuts into `moment` itself so the rule lives once. Add a test; update the spec's words if needed. A code change to the app: gate it as usual, What's new only if visible (it changes what History shows for some check-ins, so judge it), and send the merged PR number to the reviewer.
Carry on with the modules after these, or alongside them if cheaper.

## Next steps
1. If `drill-gaps-stage2` was pushed, check its diff and open its draft PR; watch CI.
2. Start the stage 3 gap fixer (same shape as stage 2's: fix each gap from the code, in the words, `npm run spec`, gate, push), then one for 5.
3. Run modules 7 to 11 (two at a time), each with a reviewer; record each in the scorecard.
4. Once every stage on main has passed, do the rewrites and the repo description, report to planning, and take #512 out of draft.

## Ready prompt for the next session
> You take over backlog item 11, the full rebuild drill, for Faro. Read CLAUDE.md, then `docs/handover/item-11.md` (this hand-over: the brief, how the drill runs, where it stands, next steps) and `docs/drill/2026-11-full-drill.md` (the scorecard). The drill stays pinned to main at `dd00ff48`. Carry on from "Next steps". Keep your context lean: every rebuild, scoring run and gap fix goes to a subagent (Sonnet where it's mechanical); hand over at about 300k tokens by replacing `docs/handover/item-11.md`. Send merged code PR numbers to the build reviewer (session_012kbr8z4ihwvC1ZUTMGey4V) and report to planning (session_012kbr91eefh4gwCAztBncNT) once when every stage on main has passed or you're blocked.
