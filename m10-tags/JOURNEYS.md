# Fields' journeys and check

Run: `node modules/tags/journeys.test.mjs` (from rebuild/; phone 390×844 and desktop 1440×900; exits 1 when a check fails). Last run: U174 and N34 pass on both widths; U177 and U178 fail, as below.

| Id | State | What |
|---|---|---|
| U174 | DONE | Workspace → Fields says “No fields yet”; Add a field (dialog) adds Stage, listed “A list: Discover, Build, Run”; a second “stage” is refused in the dialog in the rule's words; Escape closes it; the goal's Fields block says “Stage · Not set”, Change Stage → Discover, then Build, in place; History says “Stage: Discover → Build”; the value and a `field` change are saved. Both widths pass. |
| U177 | PART | Filters is in view; the Filter goals sheet's Stage group reads “Discover · Build · Run · Not set”; ticking Build and Show the goals lists Flaky test rate and not Base image build time, “Remove the filter Stage is Build” shows, the address carries `f.fld_stage=Build`; Data's Goals table has a Stage column (exit criterion 11). Fails at “Save this view…”: the stage-3 core has no saved views (SAVED-VIEWS is the core's). |
| U178 | NOT BUILT | No `/data/import`, workbook download or import preview in this core (the Spreadsheets module, stage 9, isn't in it). The module's half (export columns, read back, the one question, an admin's Add, Undo) is built and tested as functions (exit criteria 12, 13). |
| N34 | DONE | Switched off on Features (“Fields is off in Platform Engineering. Nothing it saved is lost.”): no Fields block, no Fields in Workspace's menu, /workspace/fields says the sentence, no Stage group in Filter goals, no Stage column on Data; switched back on, Stage · Build is back. Both widths pass. |

Tally: 2 DONE, 1 PART, 1 NOT BUILT.

Core journeys (tests/journeys.mjs, 30 runs) pass with Fields in (on) and with it left out (FARO_WITHOUT=tags); tests/platform.mjs passes (37 checks).
