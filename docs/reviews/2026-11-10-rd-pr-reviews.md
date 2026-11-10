# RD: outside review of each merged PR

10 November 2026. A running log kept by the outside reviewer for the app redesign (backlog RD). One section per pull request merged into main from 11:55 UTC, newest last. Each was read against its spec (`docs/design/<area>/spec.md`, `docs/design/architecture.md`), `CLAUDE.md` and `docs/design-rules.md`.

Only confirmed findings are listed: each was traced in the code and, where it shows on screen, opened in the demo (`/demo?today=2026-11-11`). Style and nits are left out. Findings of medium severity or worse were sent to the planning session when found.

| Severity | Means |
|---|---|
| High | Wrong data, lost work, or a rule broken for everyone |
| Medium | Wrong behaviour someone will meet, a rule restated, a missing eval for new behaviour, or an unexplained departure from the spec |
| Low | Real, but small or rarely met |

## Pull requests

### #88 AR1 with AR4: the Search and Prefs ports (track 1, merged 12:19 UTC)

Read against `docs/design/architecture.md` 1.1, 2 and 4.4, and `docs/design/find/spec.md` section 5 (rules 1, 5, 7). `npm run spec` and `npm run build:mcp` on the merged main write nothing new, so `spec/` and `api/mcp.js` are as generated. The near miss correcting from four letters, not five, is a departure the PR states.

**1. Medium. A Goals link's search now means one thing on the Goals screen and another in `find_goals`.** Rules live once; the departure isn't stated.

- Where: `src/domain/find.ts:139-142` (`searchGoals` empties the link's `q` and matches with `textMatches` over `goalWords`); `src/domain/query.ts:138-143` (`matches`, which the Goals screen still uses, keeps its own word list and `hay.includes`); `src/mcp/tools.ts:229`.
- The find spec's rule 1 says `matches` in `query.ts` calls `textMatches`. It doesn't yet, so there are two matching rules and two lists of "the row's words" (the new one adds the key and the status word).
- Reproduce (demo workspace, 2 Nov 2026, as `src/mcp/mcp.test.ts` builds it): `find_goals({ query: 'q=flow' })` gives 0 goals where `applyQuery` with the same link gives 1; `q=back` 7 against 9; `q=lin` 5 against 37; `q=off+track` 12 against 0. The tool's description still promises "the query of a shared Goals link … for every filter and sort the Goals screen has".
- Suggested fix: make `matches` call `textMatches(goalWords(s), q.q, g.key)` (move `goalWords` so `query.ts` and `find.ts` don't import each other), rewrite its "includes" test as the spec says, and add a test that `find_goals({ query })` and `applyQuery` return the same goals for a link with `q`. That changes what Goals' search finds, so it needs a What's new entry; if it is meant to wait for FS2, say so and keep the link's `q` on `matches` until then.

**2. Medium. `find_goals` with `status` or `level` and a link or saved view that filters the same thing returns goals it should not.** A regression: before, the arguments narrowed the link.

- Where: `src/mcp/tools.ts:224-225`.
- `status`: when the link's statuses don't include the one asked for, the intersection is `[]`, which `applyQuery` reads as "no status filter". Reproduce: `find_goals({ query: 'status=on', status: 'off' })` returns all 126 goals, of every status (before: none). The same happens with `view:` and a saved view that filters by status.
- `level`: the argument replaces the link's levels instead of narrowing them (`query: 'level=team', level: 'svp'` gives SVP goals; before: none).
- Suggested fix: as `owner` already does on line 226: when the two don't overlap, find nothing (return no goals before searching, or a value that matches none). Add a test for each.

Nothing else found. `actionList` now always takes its cycle; every caller passes one.

### #87 AR3: one way to run an action (track 2, merged 12:20 UTC)

Read against `docs/design/architecture.md` 1.4 and section 2 (AR3). Each alias in `src/app/state.tsx` was compared with the method it replaced: the same rule, the same inputs, the same message and Undo. The metric library's actions sit in the core's table until AS part 2, which the PR says.

**1. Medium. R1's access table now says something the rules don't enforce.**

- Where: `src/spec/internal.ts:79`, generated into `spec/requirements/internal/r1-sign-in-and-access.md:61`: "Mark goals reviewed in a session; accept the risk on a goal behind, with a reason | Anyone in the review".
- `markReviewed` and `acceptRisk` (`src/domain/actions.ts:174-192`) check nothing about who is in the review; both call `reviewCall`, whose own row, one line up, says "Anyone". Only the screen holds people outside the review back (`src/screens/Inspect.tsx:106`). In the same table "in it" means a member of the review (`saveReview`: "Someone in it, whoever set it up, or an admin").
- Why it matters: R1 says the server enforces the table, and the redesign specs lean on "the action already enforces it". A team copying the command port would either build a check Faro doesn't have, or trust a check that isn't there.
- Suggested fix: change the words to "Anyone", as `reviewCall`'s row has it (no behaviour change). If Lane wants it limited to people in the review, that is a product call and a new check in `reviewCall`, with a test.

Nothing else found.
