# Fields: its journeys, tallied

Script: `node modules/tags/journeys.cjs [--port n] [ids]` (from `rebuild/`; it starts the app on a port of its own) drives
each journey's steps and checks from `spec/modules/tags/journeys/<id>.md` on a phone (390×844) and a desktop (1440×900),
counts **Step.** lines against the budget and scores each checkpoint (at most one main button in view, no sideways
scroll, a 44px main button on a phone, every status shape beside its word, every field labelled). It writes
`journeys-results.json` and exits 0 only when every journey is DONE; exit criterion 2 runs it (U174, U177, U178 with
Fields on; N34 with it off).

**4 journeys and checks: DONE 4 · PART 0 · NOT BUILT 0.**

| Id | Tally | Steps (phone, desktop / budget) | Notes |
|---|---|---|---|
| U174 | DONE | 9, 9 / 20 | “Choose {v} in the “Stage” search field” is a select that saves on change here (the kit names a search field, GAPS T-16). The `(attention)` check's `{line}` isn't given; I read it as “Stage · Not set” |
| U177 | DONE | 7, 7 / 16 | `seedStage` isn't in the kit: Flaky test rate in Build, Base image build time in Discover (T-10). “Remove the filter Stage is Build” is a link with role button. The phone has the same Views menu as the desktop, not a View sheet |
| U178 | DONE | 2, 2 / 14 | The “workbook” is one CSV Goals sheet (no packages; Spreadsheets isn't built, T-12). The journey's stages.csv isn't in the kit: mine is `Key,Stage` with G-11 and G-23 on Operate. “Download the workbook” is a link styled as a button |
| N34 | DONE | 2, 2 / 12 | Its steps aren't in the kit (`evals/notes/34-fields-off.cjs`, T-15): my reading of its one line, switched off and on from Workspace → Features |

The core's scripted journeys were rerun against the changed app (`journeys/run.cjs` on its own port): 13 DONE, 5 PART,
the same as before.
