## Track 2 (one goal, goal entry, set-up), Saturday 14 November, ~23:00 UTC (list done; handing over at ~300k; replaces the 19:20 entry)

Session: session_012kbr8yvYag7HFTg115Wbhw. Planning is session_012kbr91eefh4gwCAztBncNT. **The build reviewer is now session_012kbr8z4ihwvC1ZUTMGey4V** (planning, 14 Nov 20:42); #495 and #487 were sent there.

**Track 2's list is done** once #493 and #519 merge. Ask planning for the next list.

| PR | What | State at hand-over |
|---|---|---|
| #504 SW2 | AI access behind its switch, taken over from track 4 | **merged** 22:16. Planning's option (a): a build without the module keeps the MCP server open (the core's tools answer, only the token tools are missing); only the workspace's switch shuts the door. Spec 6.1, the module's rules, `docs/mcp.md` and the rebuild gap say so. The token steps of two scenarios (`evals/mcp.eval.ts` MCP-PARITY, `evals/markup.eval.ts` TOKENS-SERVER-ONLY) run only with the module built in, as Feedback's do |
| #519 `sw2-connect-off` | The reviewer's medium on #504: the inbox's Connect Claude ignored the switch. Off, it now says only "AI access is switched off in …" (`SwitchedOffLine`, a link to Features for an admin); without the module, "This Faro has no AI access …". U175 checks it (fails without, passes with) | CI all green at b3135309. Local full gate was running. **Mark ready, enable auto-merge, tell the reviewer when it merges** |
| #493 TG2 | Fields filters, Data and sheet columns, import, `find_goals` `fields` | Ready, **auto-merge on**. Main (with #504) merged in at 28afa888; CI rerunning. **Its journey is now U177** (SW2 took U175). Local gate passed (full `npm test`, `evals:changed` with only main's known scores). **Tell the reviewer when it merges** |

**Fixed on the way, inside #493:**
- **F5 L&T 2 failed on main on a slowed phone** (`PHONE_CPU=4 CHECKS=F5`): `/goals?show=teams` drew the viewer's opening tab (Watching for Amara) until the data loaded and an effect rewrote the address to `scope=all&group=team`. Goals now reads an old `show=` address from the first draw (`asked` in `src/screens/GoalsScreen.tsx`). F5, N3, N6, N10, N12, U19, U58, U73 and U90 pass on a slowed phone.
- The Help index test checks the second-newest release by id and first line (the same change #504 made), since "Guardrails on a goal" is both a release and an article title.

**First download** (exact gzip, not re-measured since 16:15): main 265,498; TG1 266,429; TG2 267,214. Budget 275 KB, not raised.

**TG2's known gaps** (in the spec and rebuild gaps): Find doesn't search free-text field values; Undo of an import doesn't restore field values.

**Habits:**
- **A PR whose branch conflicts with main gets no CI run at all** (`pull_request` needs a merge commit). If no Actions run shows on a new head, merge main.
- Never merge main into a worktree while a gate subagent is running in it.
- Main moves every few minutes: `src/help/whatsNew.ts` (keep both, this branch's first), `api/mcp.js` and `spec/` (take main's, then `npm run build:mcp` and `npm run spec`; `grep -c home/user api/mcp.js` must be 0). A change to Help needs `build:mcp` too: the server bundles it.
- Journey ids: check main's highest before naming one (`grep -o "^journey('U[0-9]*'" evals/journeys.cjs | sort -V | tail -1`).
- One check: `PHONE_CPU=4 CHECKS=<id> npm run evals`; one journey: `PHONE_CPU=4 ONLY=<id> npm run evals`; scenarios with a module left out: `FARO_WITHOUT=<id> npx vitest run -c evals/vitest.config.ts <file>`. Keep `EVALS_PORT` at least 13 apart for side-by-side runs.
- Under load N6, N12, U47, F3, N18 and some PGlite and spec tests time out; each passes alone.
- Worktrees are `/home/user/wt-<branch>` with `cp -al` node_modules.

**Prompt for the next track 2 session:** "You are track 2 of Faro's build. Read CLAUDE.md, docs/architecture/module-map.md, then docs/handover/track-2.md. If #519 or #493 is still open, see it through: merge main if CI hasn't run, mark ready with auto-merge, and send each merged number to the build reviewer (session_012kbr8z4ihwvC1ZUTMGey4V). Then ask planning (session_012kbr91eefh4gwCAztBncNT) for track 2's next list. Never raise budgets; send eval runs and mechanical work to Sonnet subagents; hand over at about 300k tokens."
