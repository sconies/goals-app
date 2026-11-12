# Track 6 handover: the handoff kit (KT)

Written 12 Nov 2026 by the first track 6 session and updated by the second, third and fourth, each at half context. The next session starts from here.

## The brief

Lane decided on 12 Nov to build all ten fixes in `docs/reviews/2026-11-12-handoff-kit-review.md`, in the review's ranked order, one PR each. The backlog row is **KT**, after AX.

The ground rules:
- Work from main.
- Merge your own PRs once CI is green and the gate has passed: `npm run typecheck`, `npm test`, `npm run evals:changed`, `npm run spec` committed, and `npm run drill -- scripts/drill-faro` at 100%.
- Commits say `[no news]` unless something people see changes.
- Keep the first-download budget untouched.
- Report to the planning session (`session_012kbr939zneZWtAo7UQEHRP` since 12 Nov evening) once, when done or blocked.
- Auto-merge: the planning session said on 12 Nov it is on, but on #245 GitHub still answered "Auto-merge is not enabled for this repository". Try `enable_pr_auto_merge` (method MERGE) on a ready PR; if it refuses, merge by hand once CI is green.

## Done

- **KT1, gap 10 (#216, merged).** Fixed in the generators:
  - Journey titles are now read by a syntax evaluator, `evalFile` in `src/spec/sources.ts`.
  - P3, P4 and P17 are listed.
  - A module's rules sit on one page (`moduleRulesPage`).
  - Stage 1's columns and row count come from `HEADERS` (`Stage1Files`).
  - `llms.txt` indexes every core rule page (`MORE_RULE_PAGES` in `src/spec/overview.ts`). Add a new core rule there, or the spec test fails.
  - The ten disagreements now say what the code does.
  - One code change: the `room` cell's tone follows the status rule's *near*.
  - The tests are in `src/spec/spec.test.ts`, under "has none of the errors a reader trips on first".
- **KT2, gap 1 part (a) (#235).** `changes.csv` and drills for stages 2 and 3:
  - `spec/conformance/changes.csv` runs every import case plus five that save (`changeCases`, `changeRowsOf` and `runCase` in `src/spec/conformance.ts`). It has a row 0 per case, then one row per item.
  - The harness reads `"stage"`: `STAGES` in `scripts/drill.mjs`, mirrored as `STAGE_FILES` in `src/spec/rebuild.ts`. Change both together.
  - Stages 2 and 3 are `drill` now, each with a "The drill" section (`drillSection`), saying what is still checked by hand.
  - Tests: `src/spec/conformance.test.ts` (the save cases) and `src/spec/rebuild.test.ts` (a stage 2 rebuild).

- **KT3, gap 1 part (b), search and prefs (#245, merged).** The port contracts as data:
  - **Format:** `src/ports/contracts/cases/format.ts` (`Contract`, `Case`, `Step`, `Then`). Cases are in `cases/search.ts` and `cases/prefs.ts`. `npm run spec` writes them, with a README, to `spec/conformance/contracts/` (`src/spec/contracts.ts`, `CONTRACTS`).
  - **One set of checks:** the matchers, `runContract` and `openShim` live in `scripts/drill.mjs` (typed by `scripts/drill.d.mts`). Vitest uses them through `src/ports/contracts/cases/run.ts` (`contractSuite`, `caller`, `methods`).
  - **The shim:** `drill.json` takes `"shim"` (and optionally `"contracts"`, or `--contracts`). A case first sends `{ port, op: "given", args: [given] }`. Faro's shim, `scripts/drill-faro/shim.mjs`, answers with `src/adapters/contractPorts.ts`, which `parts.test.ts` also uses. The drill-faro run now also reports 13 of 13 cases.
  - **Search seed:** written in `cases/search.ts` (`SEARCH_SEED`: 3 teams, 8 people, 6 goals, one in each ranked status). `searchContractWorkspace` is gone.
  - **Tests:** `src/spec/contracts.test.ts`.
  - **To add the goals and store contracts:** write `cases/<port>.ts`, add it to `CONTRACTS`, give `contractPorts.ts` a start for it, and make `<port>Contract` call `contractSuite`. Keep the goals contract's four structural check names (`ports-at-scale.md` cites them).

- **KT4, gap 2 (#253, merged).** The spreadsheet format and every issue kind are now in the kit:
  - **Triggers as data:** `src/domain/issueKinds.ts` (`ISSUE_KINDS: Record<IssueKind, { when, raisedBy? }>`). `raisedBy` marks the four kinds the engine never raises (`new-team`, `other-workspace`, `folded`, `example`) and says what handles them instead. If one of them gets raised later, drop its `raisedBy` and add a case.
  - **Pages:** `npm run spec` writes them from `src/spec/importIssues.ts`, and both are linked from the spec README and `llms.txt`:
    - `spec/core/import-issues.md`: each kind's level, trigger, the sentence its group says in its case, its answers and its case, then every column's and word's other spellings.
    - `spec/core/export-format.md`: the same text as `docs/export-format.md`.
  - **import.csv:** six more cases, and two new columns:
    - `given`: `mode: "create"`, `stopped` goal keys moved to the archive, and other `sheets` in the same file. `runCase` reads it; changes.csv's row 0 has it too.
    - `kinds`: every kind a case raised.
  - **Tests:** in `src/spec/conformance.test.ts`, "import.csv covers every issue kind".
  - **Rebuild api/mcp.js:** a change to a `module.json` or to `src/spec/overview.ts` changes it, so run `npm run build:mcp` (CI failed once on this).

## Next, in order

1. **Gap 1, part (b), the rest: the goals and store contracts as data** (search and prefs are done: KT3). Agreed with track 4 (`session_012kbr8yGf2m8ghRQungzjo3`; also `session_012kbr8xdoEbLiMQaBAxLeuJ` for #193's follow-ups):
   - **The format:** cases in `src/ports/contracts/cases/<port>.ts`, each `{ given, when: { op, args }, then }`, with several steps where a case needs them. The vitest contracts run the list, and `npm run spec` writes `spec/conformance/contracts/<port>.json`. The drill runs a build's shim: one JSON request per line on stdin, one answer per line on stdout.
   - **Order:** search and prefs first, then store, then goals.
   - **A decision for search first:** today's search contract (`src/ports/contracts/search.ts`) seeds the full demo (`buildExample`), and checks job titles and team sizes (`detail: 'Engineering Manager, CI/CD · CI/CD'`). `spec/conformance/workspace.json` has neither: people carry only `id`, `name`, `teamId` and `admin`. Pick one of these:
     - (recommended) Give the contract JSON its own `given` seed, a small workspace written in the case file, so the contract doesn't depend on the conformance workspace's shape.
     - Add `title` to people in workspace.json, which changes every conformance file's input.
   - **Matchers the cases need:** `equals`, `has` (a subset), `throws`, a `select` path (`rows[].id`), worst-first order by rank (stale and risk tie, so an exact status list won't do), and paging chained by the last `next`, with a distinct count across steps. The near miss is optional: either form is accepted.
   - **Not yet** (still so after #253 merged: `src/ports/contracts/goals.ts` says `among`, and AX5 part 2 is open):
     - The **goals contract** waits for track 4's next PR. It changes `among` to `scope`, puts `goals.csv` in rule order, and makes the last case "narrows to a scope".
     - The **store contract** waits until AX5 part 2 merges. Track 4 sent its planned shape on 12 Nov: `load(ws, window?)`, where `{ from }` trims check-ins and change-log entries but keeps notes, ask, cycle and import anchors; `Snapshot.history`; and `history(ws, { before, goalId, size })` for keyset paging. It brings three new contract cases (a windowed load, paging history, a whole load). They fit the case format as multi-step cases. Track 4 will say when it merges.
     - Keep the names of the goals contract's four structural checks: `ports-at-scale.md` cites them.
2. **Gap 3 (next to build: it doesn't wait on track 4):** the screens. Put `docs/design-rules.md` and the Help guide in the kit, generate a fields-and-states table per screen, and add screenshots at 390 and 1440 wide. Give the missing screens entries.
3. **Gap 4:** schemas for the AI tools and actions, generated into `spec/core/tools.md` and `spec/core/actions.md`.
4. **Gap 5:** requirements R5, R7, R8 and R9 with acceptance checks, and an accessibility standard.
   - **R5 (from the planning session, 12 Nov):** spec only, written as `docs/reviews/2026-11-12-muse-product-evaluation.md` describes. It covers digests (with their wording as worked examples), never shaming, streaks that forgive, the habit measure ("% of goals checked in before the review, without a nudge"), one sign-in with a role per workspace, Feedback scoped per workspace, and Slack and Teams as a platform requirement. Faro itself sends nothing.
5. **Gaps 6 to 9:** the rest, in the review's order. Gap 6's disagreements are done (KT1). Still open from gap 6: a spec lint for two different numbers given for one named threshold, and generating `llms.txt`'s summary lines from the rule pages.

## Things to know

- **Merge races.** Five tracks merge into main all day, and auto-merge is off. Every PR conflicts in `src/help/whatsNew.ts` and `api/mcp.js`, and sometimes in `src/spec/build.ts`'s imports.
  - Resolve: keep both What's new entries. Take main's `api/mcp.js` (`git checkout --theirs`), then run `npm run build:mcp` and `npm run spec`.
  - Merge as soon as CI on the new head is green. KT1 took five rounds.
- **U4 on main.** #251 fixed U4's "publishing is not confirmed". `evals:changed` passed with exit 0 for #253. A change to `src/domain` or `src/spec` runs the full suite, which takes about 15 minutes in four shards.
- **Running a spec module from a script.** Put the script under `scripts/` (vite resolves from the repository) and load it with `server.ssrLoadModule`, as `scripts/spec.mjs` does.
