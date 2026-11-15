# Review: m9-spreadsheets (stage 9, kit pin 2fce09b4)

Method: kit only (spec/, llms.txt). Rebuild copied to kit-2fce09b4/rebuild so its exit tests find the kit. Servers on 47180/47191/47192.

## Harness
`npm run drill -- <m9-spreadsheets>` (stage 3 + also status, flags, projection, scorecard, checkin, changes, import): PASS, 318,703/318,703 cells, 14/14 store contracts. Stage 9 adds no scored file of its own; import.csv 70/70 was already passing at stage 2, so the harness proves nothing about the module.

## Own tests
- `node --test modules/spreadsheets/exit.test.mjs` (JOURNEYS=0): 26 pass, 0 fail, 2 skipped (criterion 2 on/off), 2 todo/not ok (Left, a deliberate todo). The tests are real: they run the app on two ports, do uploads, saves and Undo through HTTP, drive Chromium for criterion 14.
- Journeys (`journeys.cjs`, run by me against a fresh server, committed results deleted first): exit 1. U20, U48, U87, U88, U89, U90, U94, U95, U96, F17 DONE; U19 PART, U46 PART. F7, F8, N5 not built.
- U19 also fails "focus back on Export" here, twice, although the builder's JOURNEYS.md and committed journeys-results.json say it holds (stale or environment-dependent).
- Honesty: `check()` records every failure; no filtering; exit code is 1 unless all DONE (honoured). Weak spots: exit.test.mjs criterion 2 does not check the spawn's exit status or that journeys-results.json is fresh (it reads whatever is on disk, so a crashed run reads the stale committed file); it then ends with an unconditional `assert.fail`, so criterion 2 can never pass.

## Exit criteria
1. Requirements: WEAK. Test 1 passes, but IMPORT-ACTIONS "Left" (mark someone as left, goals to Takes over) is not built (todo, not ok).
2. Journeys: NOT MET. U19, U46 PART; F7, F8, N5 no steps or checks; Playwright result is 10 of 12 scripted DONE.
3. Export naming and one press: VERIFIED. Test 3 asserts one `.export-go`, name shown before save, Content-Disposition for all and as-shown, Data's "97 rows and 5 columns; adds Email and ID" line.
4. Round trip changes nothing: VERIFIED. Four days (incl. 2 March, 15 July) and 3 decimals, 0 items, 0 issues; in-process through readBack, not through the web upload.
5. One wrong row saves nothing: VERIFIED. Upload via HTTP, "Goals row 3: “ten” isn’t a number", no Save, goals count unchanged.
6. Rows to fix / leave out: WEAK. Problem-first download, "3 rows go with it" and the "because" lines verified, but only with the file linking by Ref; linking by name (what the kit says) doesn't work (GAPS M9-10).
7. Status edited on two rows: VERIFIED. Exact worked-out sentence and "the column Budget on Goals".
8. 14 x "Platfrom": VERIFIED. One question n=14, "Use Platform", no guessing, 14 saved as Platform.
9. Template round trip: VERIFIED. 0 items, "3 example rows left out"; where the 3 sit is guessed.
10. Field table: VERIFIED. Compared to spec/core/rules/field-table.md (need, format, example per column); "Worked out" columns are excluded from the comparison.
11. Speed: VERIFIED. 5,000 rows under 8 s, 30,000-row workbook under 20 s, row-by-row sample equal; in-process, no browser.
12. import.csv: VERIFIED. The harness spawns and shows 70/70.
13. Undo 14 back 1 staying: VERIFIED. Real HTTP flow: text "1 of its 15 rows has changed since", names Rhea and 5 Nov, Undo result and "Undone on ... 14 rows put back, 1 kept".
14. Large file: VERIFIED. 6,000 rows: Reading + Stop, Stop saves nothing, Chromium longtask <= 200 ms and < 3,000 elements, "Download as 2 files of 5,000 rows", parts load in turn to 6,126 goals.

## GAPS.md: kit gap or builder's mistake?
Real kit gaps (the kit is silent, wrong or self-contradicting):
- M9-1 core extension points/Features/MCP: stage 3 and stage 9's entry criteria never ask for them. Real.
- M9-2, M9-3 (Plan Week N, Asks, an unedited export not loading through the engine): stage 9's entry criteria claim the engine reads them; stage 2's cases have none. Real.
- M9-5 new IDs unique across saves: change-engine.md "New IDs" (line 32) says nothing about it. Real.
- M9-6 near-header case: kit shows lower case in import.csv, U95 wants as written. Real contradiction.
- M9-10 leaveOut: import-preview.md line 16 says check-ins are "named by its name"; change-engine.md line 18 only has Ref. Real contradiction.
- M9-11 how Results/Asks/Notes/Metrics sheets are told from Goals (import-preview.md line 10 says "reading-only" but not how). Real.
- M9-12/13 "File of" row and workspace id/name; M9-17 format of Since/Forecast/Result/Q1-Q4 cells (export-format.md lines 75-88 give descriptions, no example values); M9-20 fixtures not shipped; M9-23/24 selectors and F7/F8/N5 steps absent. Real.
- M9-9 (which sheets hold the 3 example rows), M9-14/15 (progress, "rows" in the 5,000 split): kit words are thin. Real but minor.
Builder's mistake:
- M9-4 Left not built. The kit says it: stage 9 exit criterion 1 names IMPORT-ACTIONS; change-engine.md line 453 describes Left and lines 227-242 give every removal-refused sentence. Not built = builder's omission (the missing conformance row is a kit gap, but the work was in scope).
- M9-22, M9-25 (Table/Board/History layouts, Data tables, People screen): these are stage 3 shortfalls of the rebuild's own core, not kit gaps.
- M9-16 "on any day": the kit says the rule; builder reinterpreted, tests passes. Builder judgement, fine.

## Top kit fixes
1. Ship the journey fixture files (goals.csv, goals-u88.csv, u96.csv, titled.csv, staff.csv, other-org file, U90 workbook) and steps for F7, F8, N5.
2. Add a stage 9 conformance file (round-trip of the demo's own export, Left, Plan Week N, leave-out, group titles) and give the harness a stage 9 score.
3. Resolve the name-versus-Ref contradiction (import-preview.md vs change-engine.md) and the near-header casing.
4. Put "modules need extension points, Features page and an MCP host" in stage 3/entry criteria (a contract a rebuild can test).
