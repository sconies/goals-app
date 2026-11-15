# Kit-only review: stage 4, AI access (kit 752d6c97)

Reviewed from S/rev-m4-ai-access (rebuild/ + kit spec/ + llms.txt). Pin clean (no `npm run spec`). Ports used: 47411-47413 (the builder's tests hard-code 47xxx, not 49xxx; harmless). Builder's source was not read beyond the tests/journeys and index.mjs lines needed to judge honesty.

## 1. Scores
- `npm run drill -- rebuild` (drill.json stage 3 + also changes, import, status, flags, projection, scorecard, checkin, contracts store): PASS 320578/320578 cells, 45366/45366 rows, contracts 14/14. Same with `FARO_WITHOUT=ai-access`: PASS identical.
- Stage 4 has no drill and the kit has no module CSV (stage page: no conformance rows), so nothing module-specific is scored by harness.

## 2. Test honesty
- `node --test modules/ai-access/exit.test.mjs`: 21 pass / 0 fail, exit 0. One test per criterion, each on and off (+ built-without for criterion 1).
- Mutations (in my copy): (a) lastUsedAt moved while shut -> criterion 3 failed, exit 1. (b) renamed "Your MCP tokens" -> criterion 5 failed AND journeys U62/U175 failed on both widths (journeys.mjs standalone exit 1). Both caught.
- App fails to start (spec dir moved): exit.test.mjs reports 7 cancelled, exit 1 (honest). **`journeys.mjs` run standalone exits 0 with no output but a stack trace** (the `await stdout.once('data')` never resolves, Node exits 0 on an empty loop): a failed start reads as green. Same weakness as stage 3's journeys. Inside exit.test criterion 2 it is covered only because the other tests cancel first.
- No filtering by default (the `only` CLI argument can silently select zero journeys and print "Every journey run passed").
- Journey checks are a subset (JOURNEYS.md says so): U22 skips the builder-token label, `one-action` and `a11y` checkpoints; U62 skips Your page / recording line / Leave; U175 skips Connect Claude. Phone runs are not CPU-throttled (the kit has no such rule).
- Criterion 1's "only its hash is kept" is never asserted on the stored record; it holds only because mcp.mjs looks a token up by hash.

## 3. Exit criteria
1. WEAK: MCP-TOKENS and AI-ACCESS-OPTIONAL verified (make/show once/act as person/via MCP/dry run/revoked 401). TOKENS-SERVER-ONLY (database functions, public key) is platform-specific and untestable here; only "no screen or tool returns the hash" is checked.
2. WEAK: 6/6 runs pass but all three journeys are PART (see section 2).
3. VERIFIED: batch test: initialize/tools/list pass, ping/tools/call/prompts refused with exact sentence, notification unanswered, lastUsedAt null after; mutation caught.
4. VERIFIED: createToken 400 with "AI access is off in Platform Engineering."; revoke via the read-back list works while off.
5. VERIFIED: section gone, /workspace/ai 404 with sentence, Settings/People blocks gone, Help article 404.
6. VERIFIED: rule matches the kit's worked example verbatim; live read-back on and off; no token acts at once. Beyond-example wording (5+ names, singular, back-on second line, buttons) is guessed.
7. VERIFIED: exact sentence, and that token's next call is refused.

## 4. Core journeys
tests/journeys.mjs (15 x 2 widths): pass with module on, with `FARO_WITHOUT=ai-access`, and with workspace `modulesOff:["ai-access"]` seeded. tests/platform.mjs: 37 pass on; fails with FARO_WITHOUT=ai-access at "AI access off shuts the door" (that test presumes the module; not a rebuild fault, but the suite has no without-module mode). exit criterion 1c checks the without-module build separately and passes.

## 5. Gaps and core changes
Builder mistakes / overstated:
- AG1: module-platform.md l.101 already says making a token is refused with "{Module} is off in {workspace}." (core's own action, "make a token"), so "no sentence in the kit" is wrong. Only the revoke exception (rules.md l.17; vs l.53 "actions refused while off") is real, and needs `whileOff`. CORE-CHANGES 2 is justified for that alone.
- AG2/AG3 and CORE-CHANGES 3, 4: module-platform.md l.73 says AI access's screens are the core's, "a rebuild may build them either way" and its `places` are empty. The builder chose to add a place and widen `people.person`; asking "is it on" from core Settings/People was allowed. A choice, not a forced gap.
- AG7: data-model.md l.578 names `tokenHash`; builder's "stage 3 page says only hash" is true but the kit does say it elsewhere. AG17, AG19 are inherent, not defects.
Real kit gaps:
1. AG9/U22 and U62 set up through `localStorage`/`window.__goalsStore`: unusable by a server rebuild (also AG8: no way to make a builder token).
2. AG10/AG11: U62 is mostly core Settings (Your page, Leave) that stage 3 never builds; U175 needs Feedback's Connect Claude while README says Needs none.
3. AG4/CORE-CHANGES 5: Workspace sections' page and non-admin view, and the core Access section, absent from stage 3's build list.
4. AG13/CORE-CHANGES 7: stage 3 says it builds the server, stage 4 "adds the switch that shuts its door"; rules.md says only the switch shuts it. Stage 3 should say the door is open unless the module is installed and off.
5. AG5/AG16/AG15: read-back words beyond one worked example, "changes through MCP" scope, token tool texts unspecified (the back-on second line is paraphrased, not quoted).
6. AG12/CORE-CHANGES 8: Features layout so the switch is in view on a phone is taught only by U175.
7. AG14: demo has no tokens, but stage 3's server needs one per person; unnamed-token convention is the builder's.
