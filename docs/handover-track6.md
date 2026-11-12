# Track 6 handover: the handoff kit (KT)

Written 12 Nov 2026 by the first track 6 session, at half context. The next session starts from here.

## The brief

Lane decided on 12 Nov to build all ten fixes in `docs/reviews/2026-11-12-handoff-kit-review.md`, in the review's ranked order, one PR each. The backlog row is **KT**, after AX.

The ground rules:
- Work from main.
- Merge your own PRs once CI is green and the gate has passed: `npm run typecheck`, `npm test`, `npm run evals:changed`, `npm run spec` committed, and `npm run drill -- scripts/drill-faro` at 100%.
- Commits say `[no news]` unless something people see changes.
- Keep the first-download budget untouched.
- Report to the planning session (`session_012kbr91PHhQvhHZRqaiFs6n`) once, when done or blocked.

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

## Next, in order

1. **Gap 1, part (a), mine: `changes.csv` and drills for stages 2 and 3.** Branch `kt-changes` is cut from main (only this file so far).
   - **The file:** reuse `importCases(w)` from `src/spec/conformance.ts`, and add save-focused cases: a check-in row, a plan change with a reason, a new goal, a person change, a stopped goal.
   - **Rows:** one head row per case (`row` 0: the counts as `key=n` joined by spaces, `unchanged`, `needs_reason`, `saves`). Then one row per item (`row` 1…: `sheet`, `line`, `target` id, `kind`, `diffs` as `field: from → to` joined by ` | `, `needs_reason`).
   - **Wiring:**
     - The header and rows sit beside `IMPORT_HEADER` in `src/spec/conformance.ts`.
     - `conformanceFiles` writes the file, and the conformance README in `build.ts` describes it.
     - `scripts/drill.mjs` gets `changes` in `ALSO` and `KEYS` (`['case', 'row']`). Keep every entry already in `ALSO`.
     - The Faro drill (`scripts/drill-faro`) must write it too.
   - **Stage pages** (`src/spec/rebuild.ts`, `stage2` and `stage3`):
     - A stage 2 drill scores `changes` and `import`.
     - A stage 3 drill scores `navigation`, `readback`, `find` and `home`.
     - Each moves from an outline to a drill. The drill harness reads `"stage"` from `drill.json`, so give each stage its own default file set.
     - Remove the gap lines that say there are no rows.
2. **Gap 1, part (b): port contracts as data.** Agreed with track 4 (`session_012kbr8yGf2m8ghRQungzjo3`; also `session_012kbr8xdoEbLiMQaBAxLeuJ` for #193's follow-ups):
   - **The format:** cases in `src/ports/contracts/cases/<port>.ts`, each `{ given, when: { op, args }, then }`, with several steps where a case needs them. The vitest contracts run the list, and `npm run spec` writes `spec/conformance/contracts/<port>.json`. The drill runs a build's shim: one JSON request per line on stdin, one answer per line on stdout.
   - **Order:** search and prefs first, then store, then goals.
   - **Not yet:**
     - The **goals contract** waits for track 4's next PR. It changes `among` to `scope`, puts `goals.csv` in rule order, and makes the last case "narrows to a scope".
     - The **store contract** waits until track 4 sends AX5 part 2's shape.
     - Keep the names of the goals contract's four structural checks: `ports-at-scale.md` cites them.
3. **Gap 2:** generate `docs/export-format.md` into `spec/`, add a page with every issue kind (trigger, level, sentence) and every column's other spellings, and grow `import.csv` until every kind has a row.
4. **Gap 3:** the screens. Put `docs/design-rules.md` and the Help guide in the kit, generate a fields-and-states table per screen, and add screenshots at 390 and 1440 wide. Give the missing screens entries.
5. **Gap 4:** schemas for the AI tools and actions, generated into `spec/core/tools.md` and `spec/core/actions.md`.
6. **Gap 5:** requirements R5, R7, R8 and R9 with acceptance checks, and an accessibility standard.
   - **R5 (from the planning session, 12 Nov):** spec only, written as `docs/reviews/2026-11-12-muse-product-evaluation.md` describes. It covers digests (with their wording as worked examples), never shaming, streaks that forgive, the habit measure ("% of goals checked in before the review, without a nudge"), one sign-in with a role per workspace, Feedback scoped per workspace, and Slack and Teams as a platform requirement. Faro itself sends nothing.
7. **Gaps 6 to 9:** the rest, in the review's order. Gap 6's disagreements are done (KT1). Still open from gap 6: a spec lint for two different numbers given for one named threshold, and generating `llms.txt`'s summary lines from the rule pages.

## Things to know

- **Merge races.** Five tracks merge into main all day, and auto-merge is off. Every PR conflicts in `src/help/whatsNew.ts` and `api/mcp.js`, and sometimes in `src/spec/build.ts`'s imports.
  - Resolve: keep both What's new entries. Take main's `api/mcp.js` (`git checkout --theirs`), then run `npm run build:mcp` and `npm run spec`.
  - Merge as soon as CI on the new head is green. KT1 took five rounds.
- **U4 on main.** Journey U4 scores 8.9 ("publishing is not confirmed"), which fails `evals:changed` for every PR. It comes from #208 (track 2) and was reported. Check whether it's fixed before trusting an `evals:changed` exit code.
- **Running a spec module from a script.** Put the script under `scripts/` (vite resolves from the repository) and load it with `server.ssrLoadModule`, as `scripts/spec.mjs` does.
