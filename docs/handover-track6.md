# Track 6 handover: the handoff kit (KT)

Written 12 Nov 2026 by the first track 6 session and updated by the second to sixth. The next session starts from here.

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

- **KT5, gap 3, the screens (#263 merged; part 2 is the pictures' PR).**
  - **Fields, states and buttons:** `spec/core/screens.md` gives each screen three tables, read from its markup's syntax by `src/spec/screenFacts.ts`. The tables are fields, states (whole screen, loading, empty, error, refused) and buttons with the conditions they show under. `whoWords` turns the shared conditions (an admin, the goal's owner) into words.
  - **Screens with no route:** `OTHER_VIEWS` in `src/spec/screens.ts` gives them entries. A test fails if a file in `src/screens` is neither a route's screen nor one of these.
  - **New pages:** `spec/core/design-rules.md` (`docs/design-rules.md`, word for word) and `spec/core/help-guide.md` (every article in full).
  - **Pictures:** `npm run spec:shots` (`scripts/screen-shots.mjs`) builds the app and takes each screen in `SHOTS` at 390 and 1440 wide, as JPEG, into `spec/core/screens/`.
    - `npm run spec` keeps the pictures.
    - The spec test fails if a core screen has no picture.
    - Retake them (`-- --no-build Home`, say) when a screen's look changes a lot. Nothing forces it.

- **KT6, gap 4 (#275).** The actions and AI tools as contracts:
  - **Pages:** `spec/core/actions.md` (every action: input, result, who may, refusals, its tools, and an appendix of every non-record type the inputs and results name) and `spec/core/tools.md` (every MCP tool: input schema as a table and JSON, hints, the type of its `data`, its own refusals, the actions it does the same as). Both are linked from the spec README and `llms.txt`.
  - **Generator:** `src/spec/calls.ts`, which uses the TypeScript checker (a `ts.Program` over `src/app/actions.ts`, the modules' `actions.ts` and the tool files; about 1 s).
    - Who may comes from `ACCESS` in `src/spec/internal.ts`, matched by the rule function each action calls (`ruleCalled`). A new action needs an `ACCESS` line, or `calls.test.ts` fails.
    - Refusals are the `no(…)` and `new NotAllowed(…)` sentences in the rule and in the functions it calls under `src/domain` and `src/modules`. Template parts show as "…".
    - A tool's own refusals are read the same way under `src/mcp` and `src/modules`, plus `new Error` and `{ isError: true, text }`.
    - A new tool file must be added to `toolFiles`, or the generator throws.
  - **Tests:** `src/spec/calls.test.ts`.
  - **Not done:** the command port still has no contract *test* (nothing runs the actions against a server). `MetricInput` is missing from the types appendix because the checker loses its alias inside an intersection; its fields are listed on the action.

- **KT7, gap 5 (this PR).** Five more requirements for the internal app, in `src/spec/platform.ts` (the same `InternalRequirement` shape as R1 to R4, spliced into `INTERNAL` in `src/spec/internal.ts`, listed in `INTERNAL_PAGES`):
  - **R5** notifications and the weekly habit: channels, what is sent and when, the digest's words, check-in from a notification, never shame, streaks that forgive, the habit measure ("before the review, without a nudge"), one sign-in with a role per workspace, feedback per workspace. One example runs `onTimeStreak` to show today's streak doesn't forgive.
  - **R7** retention, privacy and erasure; **R8** audit; **R9** observability and service levels (replaces the "Observability, as an idea" note, now gone); **R10** accessibility (WCAG 2.2 AA).
  - Decisions taken with the 12 Nov evaluation's recommended answers (habit measure 2a, digests 3a); every figure is marked a proposal.

- **KT8, gap 6's last items.** `src/spec/thresholds.ts` (`NAMED_THRESHOLDS`, `thresholdClashes`): every page of `spec/` and `llms.txt` that names a threshold in words must give the code's number; a new named threshold gets a line there. `RULE_PAGES`' third column is now each rule's `summary` from `src/spec/rules.ts`, word for word (`spec.test.ts` checks), so `llms.txt` says what the rule page says.

- **KT9, gap 7 part 1.** Every requirement in `evals/requirements.json` has `rebuild`: `copy`, `demo` (Faro's own) or `replace R<n>` (an internal requirement does it instead); `internal.test.ts` fails on a missing or unknown tag. `rebuildWords` in `src/spec/build.ts` shows it on the core requirements page and module pages, with the counts. `dont-copy.md` gained the review's section 5 items (demo-only requirements listed from the tags, `schema.sql`, comments as change-log entries, risk accepted as a note, telemetry in the app's database, formatting quirks scored). A new requirement needs a tag.

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
2. **Gap 5: done (KT7).** Requirements R5, R7, R8, R9 and R10 (accessibility).
   - **R5 (from the planning session, 12 Nov):** spec only, written as `docs/reviews/2026-11-12-muse-product-evaluation.md` describes. It covers digests (with their wording as worked examples), never shaming, streaks that forgive, the habit measure ("% of goals checked in before the review, without a nudge"), one sign-in with a role per workspace, Feedback scoped per workspace, and Slack and Teams as a platform requirement. Faro itself sends nothing.
3. **Gap 7 part 2:** a logical data model with keys, uniqueness and workspace scoping stated as rules, and every SQL-only limit moved into its rule page. Then **gaps 8 and 9**, in the review's order.

## Things to know

- **Merge races.** Five tracks merge into main all day, and auto-merge is off. Every PR conflicts in `src/help/whatsNew.ts` and `api/mcp.js`, and sometimes in `src/spec/build.ts`'s imports.
  - Resolve: keep both What's new entries. Take main's `api/mcp.js` (`git checkout --theirs`), then run `npm run build:mcp` and `npm run spec`.
  - Merge as soon as CI on the new head is green. KT1 took five rounds.
- **U4 on main.** #251 fixed U4's "publishing is not confirmed". `evals:changed` passed with exit 0 for #253. A change to `src/domain` or `src/spec` runs the full suite, which takes about 15 minutes in four shards.
- **Running a spec module from a script.** Put the script under `scripts/` (vite resolves from the repository) and load it with `server.ssrLoadModule`, as `scripts/spec.mjs` does.
