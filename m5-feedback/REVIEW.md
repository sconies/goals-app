# Review: m5-feedback (stage 5, Feedback), kit 752d6c97

## Scores
- Harness (`npm run drill -- m5-feedback/rebuild`): 100.0%, 45366/45366 rows, store contract 14/14. The kit has no stage-5 CSV or drill (outline), so nothing scores the module itself.
- exit.test.mjs (copy): 24/24 pass, ~43 s. Core tests/journeys.mjs: all pass with Feedback on and with FARO_WITHOUT=feedback. tests/platform.mjs: 37 checks pass (first run failed on port 48934 clash with another session; passes on a free port).

## Test honesty
- Broke the tool-off sentence in platform.mjs: criteria 4 and 5 fail (4 of 24 subtests). Changed "Marked in hand by": journeys.mjs prints FAIL U42 and exits 1. Server throws at start: journeys prints "FAIL the app did not start", exit 1.
- exit.test.mjs with a server that cannot start: it did not finish (hung over 5 min; test 3 opens Chromium before app() and never closes it on failure). Nothing passes, but a CI would time out rather than fail fast.
- No filtering, no stale result files. Weaknesses: test 1 asserts sentences copied from the kit and the builder's own invented shapes; U42 deviates (Rhea opens In hand because the inbox was just worked); ease-test scoring not reproduced; "75 new" menu count checked nowhere.

## Exit criteria
1. Requirements: WEAK. MARKUP, INBOX, MCP, CONNECT-CLAUDE, TRIAGE, PAGE, OPTIONAL tested; FEEDBACK-RAISED ("You raised this") NOT BUILT; INBOX-TRIAGE's menu "N new" count not built; list_feedback/triage rules guessed (G6, G7).
2. Journeys: WEAK. U41, U42, U47, U52, N22 DONE (both widths); U40, U51, U53, U165 only their Feedback halves (Goal map half is stage 6).
3. Off, last menu group: VERIFIED (exit test 3, desktop and More; Ctrl+Shift+M opens nothing).
4. Off, three addresses and eight tools: VERIFIED (exact sentences, test 4).
5. Off, send refuses; data stays; back on restores: VERIFIED (test 5).

## Gaps
Builder mistakes / overstated: G10 "prompts not in the kit" is wrong, module-platform.md:142 lists prompts/list and prompts/get (module-contributed prompts and assets/scripts are still unsaid). G19 overstated: FARO_WITHOUT leaves a module out and the core journeys do run that way; only "off at start" is missing. G8/G13 are real but narrowly the core's empty What's new.
Real kit gaps: G1 no inbox data model; G2 no description of the fake database/test door; G3 good-mood label absent (only "It's OK", "It gets in the way" appear, U40/U41); G6 list_feedback README says any token reads, tools.md refuses non-admins; G7 MARKUP-INBOX "anyone marks" vs INBOX-TRIAGE admins; G9 no way for a module to badge a core menu row; G11 stage 3 never checks parts a markup names; G12 Feedback Help articles live in core help-guide.md; G16 N22 steps missing; G17 src/ links dead.
Top: G6/G7 contradictions, G1/G2 (no data model or test database), G9, G3.

## Isolation
One admitted slip (diff against stage-3 platform.mjs). Nothing else found: the only core files differing from stage-3 are the five in CORE-CHANGES.md (mcp, pages, server, state, platform), matching its list; local/ paths are inherited from the core builder, not new reads; every cited fact traces to kit text. The slip's cost is small (CORE-CHANGES counts), but its "five files" count was likely helped by it.
