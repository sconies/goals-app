# Drill 11 re-run on pin 2fce09b4 (15 Nov): results log

| Stage | Builder | Independent check | Gaps |
|---|---|---|---|
| 1 core rules | PASS in 2 runs (demo 43,373 + edge 1,360 rows; no-rhythm 38,124) | Sonnet scorer: PASS, same rows | 19 (3 guessed wrong, caught by edge rows: stopped goal has no hit cell; held-to-no-number scope; projection uses earlier weeks only). stage-1/GAPS.md |
| 2 core data | PASS in 6 runs (changes 135, import 70, store 14/14, stage 1 still 100%); never read expected CSVs | Sonnet scorer: PASS; tests.mjs 24 pass, 1 skip | 31; 14 behaviours learned from diffs (S2-1..14). stage-2/GAPS.md |
| 3 core screens | Harness PASS in 3 runs (nav 60, readback 6, find 23, home 56). Journeys 13 DONE / 24 PART / 36 NOT BUILT of 73 | Sonnet scorer: PASS; 13 of 18 scripted journeys pass, matches | 22: drill inputs only in expected CSVs (learned from diffs), read-back shape and words, home title, parts journeys name not in screens.md, lists journeys loop over (PAGES), demo records journeys assume, U58 /demo/people, U6 budget. stage-3/GAPS.md |
| 4 AI access | 6 of 7 criteria met; journeys U22/U62/U175 PART; 2 core files changed | Sonnet reviewer: 1 WEAK (no dry_run; server-only via own hook), 2 WEAK (U62 check filtered), 3-7 VERIFIED; import note missing (builder's) | 20; structural: core has no extension points, modulesOff, Features page, Workspace sections or MCP server, though stage 4's entry assumes them (A1, A2). m4-ai-access/GAPS.md |
