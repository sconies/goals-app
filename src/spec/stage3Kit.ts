/* What stage 3's page adds for the full drill's findings (item 11, the core's fixes): the module platform it now builds,
   Goals' layouts and the roll-up the Goal map's stage assumes, and where its drill's inputs are. Its own file, so
   src/spec/rebuild.ts (shared with the stage 1–2 fixes) only spreads these in. */

/** Stage 3's "What to build", after its own lines. */
export const STAGE3_BUILD: string[] = [
  '**The module platform** ([the module platform](module-platform.md)), with no module in it: every place on the core screens built empty (a core screen draws whatever the modules that are on put there, and nothing when none does), a route, a menu row in a group, a Workspace section, a Help article and an AI tool registered from a module’s facts, `Workspace.modulesOff` and the rule of which modules are on, Workspace → Features with its groups, switches and read-backs, every sentence the core says while a module is off, and the AI tools’ server with its methods, batches, refusals and dry runs, answering the core’s own tools. Every module stage after this one only registers into it.',
  'Goals’ layouts (requirement `GOALS-MENUS`; [the Help guide](../core/help-guide.md), Goals): the Layout menu at the end of the list bar (“Layout: List”; “View: List” on a phone) with the core’s four layouts, List, Table, Board and History, the layout in the link and remembered; a module adds a layout to the same menu (the Goal map). Each layout reads the same goals through the query port ([Goals’ filters and sort](../core/goals-query.md)), and a group of goals is summed up by one status, the worst ([the status](../core/rules/status.md), “A group’s status”).',
];

/** Stage 3's exit criteria, after its own. */
export const STAGE3_EXIT: string[] = [
  '`node spec/rebuild/drill.mjs rebuild --expected spec/conformance/core-only` prints **PASS** too: the same four files on the same workspace with every feature module switched off (`modulesOff`), so the core is proved without any module ([the core alone](../conformance/README.md#the-core-alone-core-only)).',
  'The module platform holds what [its page](module-platform.md#what-proves-it-stage-3s-exit-criterion-for-the-platform) lists, with one example module on, switched off and left out.',
];

/** Stage 3's gaps, after its own. */
export const STAGE3_GAPS: string[] = [
  'Some screens the journeys step through are named in the journeys but not yet described in [the screens](../core/screens.md) beyond their markup: saved views (“Save this view…”), the first check-in’s offer to restart a plan or keep it and say why, a step-by-step check-in’s one question per screen, and set-up and the year’s start and end. Their journey pages are the fullest words for them today.',
];

/** Where stage 3's drill reads its inputs (the drill section's input line). */
export const STAGE3_INPUTS = '- **The cases’ inputs** are in [`screen-cases.json`](../conformance/screen-cases.json), and the harness puts a copy of it beside the `workspace.json` it hands the command (the same folder), as it does stage 2’s `change-cases.json`: the workspace’s name as the screens say it, the viewers and addresses `navigation.csv` answers (with a module’s menu item, and Home with features switched off), every search `find.csv` makes, the drafts `readback.csv` reads back (each set over the `blank` goal it gives, the draft’s every field), and Home’s viewers and moments. Read the cases from there, never from the expected files: in each CSV the key columns are those same inputs written back, and every other column is what the screens’ rules give. What each column holds, word for word, is in [the conformance data](../conformance/README.md#the-files). Rows are matched by their key columns, columns by name, text exactly.';
