# Handoff kit review, 12 November 2026

Written as a principal engineer on the receiving platform team would write it: we have been handed the kit and must rebuild Faro on our own sign-in, database, hosting and observability. A review only; nothing but this file was changed.

## Verdict

**Ready with gaps.** The kit is ready for stage 1 (the core rules) and not yet ready for anything after it.

- **Stage 1 could start on Monday.** Rules in plain words, worked examples, 43,373 scored rows and a harness that needs nothing installed. This is better than most internal specs I have been handed.
- **Stages 2 to 5 are outlines, and say so.** Their proof is "by hand", their contracts live in Faro's code, and the two largest pieces of behaviour outside the rules (the change engine and the screens) are described, not specified.
- **The platform requirements (R1 to R6c) are well written but incomplete.** Sign-in, access, time zones, scale and backups can be built and accepted. Data retention, privacy, audit, notifications, accessibility and observability cannot, because they are missing or are "an idea".

A team that takes "rewrite from the spec" literally would pass stage 1 in two to three weeks and then spend most of the next two months reading Faro's code to find out what to build. The kit's own honesty about this (`spec/rebuild/README.md:17`, the "Gaps in the kit" sections) is its best feature; the ten fixes at the end would turn that honesty into something a team can work from.

## How it was done

- **Read in full by me:** `llms.txt`, `docs/handoff.md`, `spec/README.md`, all of `spec/rebuild/` (the harness skimmed, not traced), all of `spec/requirements/internal/`, `spec/conformance/README.md` and the CSV headers.
- **Read in full by two helper passes, with every finding quoted here checked against the file by me:** `spec/core/vocabulary.md` and all of `spec/core/rules/`; `spec/core/data-model.md`, `schema.sql`, `screens.md`, `journeys.md`, `requirements.md` and `spec/modules/`.
- **Not opened:** `src/`, `server/`, `evals/`, `supabase/`, or any `docs/` file the kit links to. Where the kit sends the reader there, that is recorded as a finding.
- **Not done:** running the drill, or checking the conformance rows against the rules by hand.

## 1. Coverage: what could we rebuild from the kit alone?

| Part | From the kit alone? | Why |
|---|---|---|
| Core status rules (stage 1) | Yes | Rules, examples, conformance rows, harness |
| Storage and the change log (stage 2) | Partly | Records are listed; the write path is not |
| The change engine (stage 2) | No | "its every message and column rule is in the code and its tests" (`spec/core/rules/change-engine.md:36`) |
| Core screens (stage 3) | No | Route, a sentence, scraped headings; no layout, fields, states or look |
| Metric library (stage 4) | Mostly | Records and conformance rows are good; three of its four rules are missing from the kit |
| Spreadsheets (stage 5) | No | "its behaviour is in its code, its Help articles and the journeys above" (`spec/modules/spreadsheets/README.md:65`) |
| The AI tools (MCP) | No | About 70 tool names, no inputs, outputs or errors |

What we would have to read the code to learn, or guess:

1. **The spreadsheet format.** How each column is read is in `docs/export-format.md`, "which is not in the kit" (`spec/rebuild/stage-2-core-data.md:101`, `stage-5-module-spreadsheets.md:232`). The field table covers what a person fills in, not how it is parsed.
2. **The change engine's messages and triggers.** Eight import kinds are named with no definition or threshold (`many-admins`, `big-removal`, `odd-number`, `past-plan`, `replaces-others`, `formula`, `loop`, `bad-key`; `spec/core/rules/import-levels.md:12-13`). The other spellings a column accepts are not listed (`import-header.md:10`).
3. **The write path.** The only description of a save is the SQL of `okr_commit` and `okr_write` in `spec/core/schema.sql`, which is the shape we are told not to copy (`spec/rebuild/dont-copy.md`). The replacement, the command port, is a sketch (`spec/rebuild/ports-at-scale.md:7`): over 50 action names (`:76`) with no inputs, results or refusals.
4. **Every screen.** `spec/core/screens.md:8` says a heading or button "whose words are worked out when it shows … is not listed. The Help article and the eval journeys show those." Neither is in the kit. 13 of 22 screens list "Primary buttons in its markup: none written as plain text". There are no pictures, and the design rules (`docs/design-rules.md`) are outside the kit (`stage-3-core-screens.md:151`).
5. **Screens with no entry at all**, named by requirements or journeys: the goal map, table, board and saved views, the Find overlay, the workspace switcher, the status sheet, the error and not-found pages, the navigation shell.
6. **Rules that are a function name and one line.** A goal's result (Met, Met late, Not met), quarter results, who may answer, mark done or withdraw an ask ("not restated", `spec/core/rules/goal-act.md:18`), and the removal rules behind the 30-day restore.
7. **Check-in causes and missing-word messages.** `check-in.md` names `CAUSES_BEHIND`, `CAUSES_AHEAD` and `MISSING_TEXT`; the kit gives nine cause words with no codes and no behind/ahead split (`field-table.md:75`).
8. **Rules that live only in SQL constraints.** A path to green of at least 8 characters, a greener reason of at least 10, a title of at least 3, goal decimals 0 to 3 against metric decimals 0 to 4, review cadence 1 to 13 weeks (the requirement says 1, 2 or 4), the token format, goal-key allocation.
9. **The module contract.** Places such as `goal.facts` and `data.tools` are names in a table; what a place receives and draws, and the shape of `module.json`, point to `docs/architecture.md` and `src/core`.
10. **Three of the metric library's four rules.** `spec/modules/metrics/README.md:50` links four rule sets to `rules.md`; the file holds only "Rule 4. A close name". Rules 1 to 3 are what `metrics.csv` scores.

## 2. Ambiguity: vague rules, and places that disagree

Each pair below was checked in both files.

**Disagreements that change a result**

| # | One place says | Another says |
|---|---|---|
| 1 | `llms.txt:11`: "A goal someone has looked at since its latest check-in is being handled" | `spec/core/vocabulary.md:45`: "Marking it reviewed or noting it is not enough: that goal still needs attention"; `rules/flags.md:49` calls looked-at "a quiet line only" |
| 2 | `rules/scorecard.md:59`: since last week compares with the check-in before, "another check-in in the same week counts" | `rules/check-in.md:16`: "A check-in of the same week is never 'last week' … as is the goal page's 'vs last week'" |
| 3 | `rules/status.md:60-68`: 14 days without an update is always No recent update | `rules/year-end.md:16`: after the last day "no goal becomes 'No recent update'". The status page does not mention it; nor that a plan not yet started is not due (`years-and-weeks.md:20`) |
| 4 | `rules/status.md:39`: near the limit is "strictly within the margin" | `rules/scorecard.md:16`: "within the margin (room ≤ margin)". At room equal to margin the two cells disagree |
| 5 | `requirements.md:234` (UPDATE-ANYTIME): a second check-in "replaces that week's number and status" | `requirements.md` ONE-PER-WEEK: "Every check-in is kept"; checking in again and correcting are different |
| 6 | `requirements.md:241` (OWNER-ONLY): "Only the goal's owner can post its check-in" | R1's access table: "The goal's owner, or an admin" (`r1-sign-in-and-access.md:57`) |
| 7 | `data-model.md:409`: recording is "on unless an admin has turned it off" | `requirements.md:1205`: "off unless ticked" |
| 8 | `data-model.md:74`: a cycle holds its own levels | `schema.sql:244`: a check constraint fixes `north-star`, `svp`, `team`; no levels column |
| 9 | `stage-1-core-rules.md:41`: `scorecard.csv` has `value`, `label`, `sub` | `conformance/README.md:37` and the file itself: `week, goal, cell, tone, likelihood`; the words are in `scorecard-words.csv` |
| 10 | R1 check 4: a leaver's token is refused "within a minute" | R2 check 4: "within the time the company's policy sets (and within an hour at most)"; R2 rule 3: "from that moment" |

**Smaller disagreements:** where a carried plan starts ("week 0", `years-and-weeks.md:22`; "week 1 (`fromWeek` 0)", `carry.md:10`); status order (No check-in yet is worse than On track in `llms.txt:10`, better in the numeric order at `status.md:72`); "on plan" by the vocabulary against the scorecard's rounding; which characters split a word in search (`finding.md:10` against `directory.md:37`); a "pending proposals" flag in requirement ATTENTION with no such flag in the flag table and a data model that says `pending` is not used.

**Stated too loosely to build**

- **Being handled's "nothing new" test** (`rules/flags.md:47`): "the earliest of those" has no clear referent, and the test re-runs every flag over the same workspace at an earlier moment.
- **"Time or money unit"**: decides whether a negative number is refused or questioned, and is never defined.
- **Rounding**: given for one step of the status rule (`status.md:100`) and nowhere else, though the scorecard, the carry rule and goal entry all round.
- **The critical-path score** (`rules/map.md:10`): precedence and unset values unstated, and no worked example.
- **"Worst first"** for lists: by status or by worst flag is not said, and flag weights are not given.
- **Backlog codes as explanation**: "until IM8", "with IM5", CF2, FS2, FT1, GE10 mean nothing to a reader without the backlog.

## 3. Platform requirements: enough to build and to accept?

| Topic | Where | Build from it? | Accept from it? | What is missing |
|---|---|---|---|---|
| Sign-in and SSO | R1, R2 | Yes | Yes | The three different leaver timings above |
| Permissions | R1's access table | Yes | Mostly | The table links each line to a function in `src/`; the words suffice, but "the words the app shows" (check 1) are not listed, so the check cannot be automated from the kit |
| Multi-tenancy | R1 rules 2-3, stage 2 exit 4 | Partly | Partly | The kit says cross-workspace references are a gap (`stage-2-core-data.md:100`). No statement of the tenancy model we should use, and R4 and R6a assume one workspace is the whole company |
| Time zones | R3 | Yes | Partly | Every rule page still says UTC (`weeks-and-plans.md:10`); the only conformance data is UTC, so home-zone behaviour and clock changes have no rows |
| Scale | R4 rules 1-4 | Yes | Partly | No seeded 15,000-person workspace or generator; figures are "proposals … not measurements" (`r4:129`); no rate limits, no availability target, no concurrency figure for writes |
| Backups and restore | R4 rule 5 | Yes | Yes | Clear: 30 days, 5 minutes lost, 4 hours back, quarterly drill |
| Migrations | R4 rule 6 | Yes | Yes | Nothing on moving data from a pilot or from Faro itself |
| Data retention | nowhere | No | No | 15 million change-log entries a year with no retention, archive or deletion rule; "nothing is erased" in the requirements against cascading deletes in the schema |
| Privacy | one line in `observability.md` | No | No | No data classification, no subject-access or erasure route, nothing on what a leaver's record keeps |
| Audit | R1 check 6 | Partly | Partly | Who-did-what is covered. Not covered: that the log cannot be edited, that admin reads and token use are recorded, how long it is kept, who may export it |
| Observability | `observability.md` | No | No | "Not a requirement". No service levels, no required signals, no alert list |
| Notifications | nowhere | No | No | "not yet written as a requirement (backlog R5)" (`docs/handoff.md:59`), yet R6b says "the owner is told" and R6c "Priya is asked again" |
| Accessibility | one sentence (A11Y) | No | No | No standard named, no keyboard or screen-reader checks |

Two things in R1 need a decision before a security review would pass them:

- **An admin makes a token for another person** and is shown its secret once (rule 5). That admin can then act as that person, and the log will say the person did it. At company scale a person should make their own token, or the secret should go only to them.
- **Membership is "a person record with their sign-in email"** (rule 2) while R2 matches on the provider's subject id after the first sign-in. R1 should say the subject id is the key and the email only the first match.

## 4. Verification: can we prove the rebuild is right?

**What can be proved**

- Status, flags, projection, scorecard and what a check-in must say: 43,373 rows across five files, plus 21,910 rows of scorecard words when asked. This is strong.
- Find, navigation, the read-back, import cases and the metric library: 189 rows across five optional files. Useful, thin.
- R4 check 1 reuses the same rows to prove the summary rows. A good idea.

**What cannot**

1. **Stages 2 and 3 have nothing to score.** "No conformance rows for change sets yet" (`stage-2-core-data.md:103`); "no portable journey runner yet" (`stage-3-core-screens.md:150`).
2. **The contracts are not in the kit.** "a rewrite from the spec alone can read what they check here but can't run them" (`spec/rebuild/adapters.md`, gaps). Neither the query port nor the command port has a contract at all (`ports-at-scale.md:7`).
3. **166 core requirements have no acceptance criteria readable without code.** Each links a test file and a count ("`evals/scenarios.eval.ts` (3)") or a journey id; 106 have no rule page, so one sentence is the whole specification.
4. **Journeys are titles with a step budget**, not steps. Checks F1 to F6 are named "Fit and finish, home-watching" and the like, with no assertion.
5. **One workspace, one cycle, weeks 0 to 45 of 53.** The data stops before the year ends, so the year-end, wrap-up, carry and next-cycle rules are never exercised by a row. Goals are "taken as they are now in every week" (`conformance/README.md:24`), so edits over time are not replayed.
6. **Numbers and names** has worked examples only (`stage-1-core-rules.md:61`).
7. **The row count misleads.** Stage 1's exit says "all five files match (65283 rows)"; the five files hold 43,373. 65,283 includes the words file, which is scored only when asked.
8. **The platform requirements' checks are ours to automate**, which is right, but several cannot be written from the kit: R1 check 1 needs the refusal sentences, R4 check 5 needs the seeded workspace.

## 5. Risks

**What we would copy that we shouldn't.** `spec/rebuild/dont-copy.md` lists eight things and is right about all of them. It misses these, each of which sits in the kit with the same weight as a real rule:

- **Demo requirements among the core ones.** DEMO-MODE, DEMO-STORAGE, WALKTHROUGHS, RESEARCH, BRAND, LAUNCH and STALE-RELOAD are not marked as Faro's own. TOKENS-SERVER-ONLY is written in terms of Supabase's public key.
- **`schema.sql` as a starting point.** It is a Postgres and Supabase dump: row rules, `security definer` functions, a `storage.objects` policy, global text ids, no foreign key from core tables to the workspace, single-column indexes only, no unique on a check-in's goal and week. It says "this file is for reading", but a team in a hurry will start from it.
- **Comments stored as change-log entries**, and accepting a risk stored as a note that starts with a fixed phrase (the second is flagged, `review-decide.md:38`; the first is not).
- **Telemetry in the application's own database** with a nightly job.
- **Formatting quirks scored as rules**: "-0", "1 pts" (`scorecard.md:26-28`). They are in `scorecard-words.csv`, so a team chasing 100% will reproduce them.

**Under-specified, and will bite at company scale**

1. **The week's turn.** R4 says summaries are worked out again "when the week turns". For 30,000 goals that is one large job at midnight in the home zone, on Monday, just before the busiest hour. No budget, no order, no statement of what a reader sees while it runs.
2. **Being handled needs the workspace.** The rule re-runs flags over the whole workspace at an earlier moment. `ports-at-scale.md:111` admits "which records each action and rule actually reads isn't listed anywhere".
3. **Concurrent edits.** Only goals and reviews carry versions; people, teams, asks, decisions and views are last-write-wins. The kit says to extend it and not how conflicts are shown.
4. **The directory feed (R6a).** "Refreshed at least daily" with one failure case. Nothing on partial failure, a person in two legal entities, contractors, or 1,500 teams changing at a reorganisation while goals keep their team.
5. **Imports.** 20 MB and 30,000 rows is a browser limit. On a server, an all-or-nothing save of 30,000 rows with summaries recalculated in the same transaction needs a design the kit does not give.
6. **Search.** "The near miss is optional" and ties may break "another way" on a server, yet `find.csv` scores an exact order.
7. **The AI tools.** No rate limits, no scopes narrower than "everything the person may do", no contract.
8. **The planning round (R6c) and delegates (R6b)** are six rules each for what are, in practice, the two most political features. Expect the pilot to rewrite both.

## 6. Effort

For two to three engineers with a designer part-time, rewriting from the spec onto an existing platform. Rough, and assuming the kit as it is today; the figures in brackets assume the ten fixes below are made first.

| Step | Builds | Weeks (calendar) | Confidence |
|---|---|---|---|
| 0. Foundations | Repository, pipeline, environments, SSO wired in, membership, logging and tracing | 3 | High |
| 1. Core rules | Stage 1 to 100% on the drill, with R3's home zone as a parameter | 3 | High |
| 2. Data and commands | Schema of our own, command and query ports, R1 enforced on the server, change log, undo, summary rows, the change engine | 10 to 12 (8) | Low: the change engine is the unknown |
| 3. Core screens | 22 screens and the shell, find-and-pick, check-in flow, goal page, reviews, accessibility | 12 to 16 (9 to 11) | Low: nothing to build from but words |
| 4. Metric library | Stage 4 | 3 (2) | Medium |
| 5. Spreadsheets | Stage 5, server-side import | 5 to 6 (4) | Low |
| 6. AI tools | The MCP endpoint over the command and query ports, tokens | 3 (2) | Medium |
| 7. Organisation and scale | R6a directory feed and scope, R4 seeded load tests, budgets in CI, restore drill | 6 | Medium |
| 8. Delegates and planning round | R6b, R6c | 6 | Low |
| 9. Hardening and pilot | Security review, notifications, pilot team, fixes | 5 | Medium |

**Total: about 56 to 63 weeks of calendar work for one stream, so 10 to 12 months with three engineers working two streams from step 3 on; 8 to 9 months with the fixes below.** A first pilot on the core (steps 0 to 3, one workspace, no directory feed) is realistic in 6 to 7 months. Copy-and-adapt would be faster to a demo and is the route `docs/handoff.md` describes best; it carries the browser-runs-the-rules design that R1 and R4 then require us to take apart.

## The ten gaps that matter most

Ranked by how much rework each would cause us. Every fix is to the kit's generators or hand-written sources, never to `spec/` by hand.

| # | Gap | Suggested fix to the kit |
|---|---|---|
| 1 | **Stages 2 to 5 cannot be proved.** No conformance rows for change sets, no portable contract or journey runner, and the port contracts live in `src/` | Write each port contract as data (given, when, then, in JSON) that the drill harness can run against any build over a small command-line or HTTP shim. Add `changes.csv`: change sets in, items, issues and saves out. Give stages 2 and 3 a drill |
| 2 | **The change engine and the spreadsheet format are in the code** | Generate `docs/export-format.md` into `spec/`. Add a page listing every issue kind with its trigger, level and sentence, and every column's other spellings. Grow `import.csv` until each kind has a row |
| 3 | **The screens cannot be rebuilt** | Add `docs/design-rules.md` and the Help guide in full to the kit. For each screen, generate a table of fields, states (empty, loading, error, refused) and who sees which button, and commit two screenshots (390 and 1440 wide) from the evals. Give the missing screens entries |
| 4 | **No contract for the AI tools or the actions** | Generate each MCP tool's input and output schema and refusals, and each action's input, result and "who may", into `spec/core/actions.md` and `spec/core/tools.md` |
| 5 | **Platform requirements stop short** | Write R5 (notifications and digests), R7 (data retention, privacy and erasure), R8 (audit: tamper-proof, reads by admins and tokens, retention, export) and R9 (observability and service levels), each with acceptance checks as R1 to R4 have. Name an accessibility standard |
| 6 | **Rules disagree with each other** (the ten pairs in section 2) | Fix each. Make `llms.txt`'s summary lines come from the rule pages. Add boundary examples (room equal to margin, a second check-in in a week, the day after year end). Add a spec lint that fails on two different numbers for one named threshold |
| 7 | **Copy, replace or demo-only is not marked** on the 166 core requirements, and `schema.sql` is a vendor dump holding rules found nowhere else | Tag every requirement in `evals/requirements.json` as copy, replace (naming the R) or demo-only, and show the tag. Add a logical data model with keys, uniqueness and workspace scoping stated as rules, and move every SQL-only limit into its rule page. Extend `dont-copy.md` with the five items in section 5 |
| 8 | **R3 against the rules and the data.** The rules say UTC; nothing scores a home zone | Give the week and day rules a zone parameter in the rule pages. Add a second, small conformance workspace with a non-UTC home zone, check-ins near midnight and a clock change |
| 9 | **Scale cannot be accepted.** No seeded company-size workspace, no list of what each rule and action reads, the week's turn unbudgeted | Ship the seed generator (or its output) in the kit. Generate, per action and per summary, the records it reads. State a budget and a visible state for the week's turn, and say how being handled is worked out without the whole workspace |
| 10 | **The kit has small errors a reader trips on in the first hour** | Fix stage 1's scorecard columns and the "five files, 65283 rows" line; the template text leaking into journey titles (N7 "([^", N12 and F8 "${…}"); the metric rules page that holds one rule of four; checks P3, P4 and P17 cited and not listed; `llms.txt` indexing 10 of 33 rule pages. Add these to the spec's own test |

Fixes 1 to 4 are what move the verdict to "ready". Fix 10 is an afternoon and should go first.
