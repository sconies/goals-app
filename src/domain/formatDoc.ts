/* docs/export-format.md, made from the one format (domain/columns.ts) so the document can't say a column differently from
   the app. `npm run export-format` writes it; evals/format.eval.ts fails when the file isn't current. */
import { CALL_WORDS, CAUSE_WORDS, GOAL_ACTION_WORDS, KEY_COLUMNS, LEVEL_WORDS, PERSON_ACTION_WORDS, RECOVERY_WORDS, ROLE_WORD, roleLoaded, SHAPE_WORDS, SHEETS, TYPE_WORDS, BOUND_WORDS, WEEK_COLUMN, type Words } from './columns';
import { STATUS, withCode } from './vocabulary';
import type { ModuleSheet } from './records';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const words = (w: Words<string>) => Object.values(w.word).map((x) => `\`${x}\``).join(', ');

/** The whole of docs/export-format.md, with the sheets of the feature modules in this build (domain/records) after the core's. */
export function exportFormatMarkdown(modules: readonly ModuleSheet[] = []): string {
  const sheets = [...SHEETS.map((x) => ({ x: x as (typeof SHEETS)[number] | ModuleSheet['spec'], keys: KEY_COLUMNS[x.kind] })), ...modules.map((m) => ({ x: m.spec, keys: m.keys }))];
  const out: string[] = [
    '<!-- Generated from src/domain/columns.ts by `npm run export-format`. Edit the columns there, not this file. -->',
    '',
    '# Export format',
    '',
    'One spreadsheet format for everything that goes out or comes in: the workbook and CSVs from Export, a table saved from Data, the set-up template, set-up from a spreadsheet, the Import screen, and the AI assistant’s `bulk_change`, `export` and `export_table` tools. Every sheet and column is defined once, in `src/domain/columns.ts`, and this page is made from it. Anything exported can be edited and loaded back; loaded back unedited, it changes nothing.',
    '',
    'Week numbers count from the cycle’s start: week 0 is the start date. A check-in for week N is the owner’s report in that week.',
    '',
    '## Files',
    '',
    `- **Excel workbook (.xlsx)**, the default: every sheet below (${sheets.map((v) => v.x.name).join(', ')}) and a README sheet that explains each column, made from the same definitions. Worked-out columns are set in grey.`,
    '- **CSV files (.zip)**: the same sheets, one CSV each with the same headers, named after the sheet (`Goals.csv`, `Check-ins.csv`…). UTF-8 with a byte-order mark, so Excel opens them correctly.',
    '- **One CSV**: any one sheet on its own.',
    '- **A table from Data** (CSV or .xlsx), exactly as its layout shows it: its columns in order and the rows that pass its search and filters. The columns that say which record a row is (below, “Matches the row”) are always written: any the layout leaves out are added at the end, in grey, so the file loads back. The AI assistant’s `export_table` does the same.',
    '- **JSON** and **a brief for an AI chat** (Markdown), below. They are for reading, not loading back.',
    '',
    '## Loading a file back',
    '',
    'Import reads an .xlsx workbook, a .zip of CSVs, or one .csv or tab-separated file. Set-up from a spreadsheet reads the same files. Every row is checked with the app’s own rules and shown before anything is saved; nothing saves while a row needs fixing, and the whole load can be undone from Activity.',
    '',
    '- **Each sheet is recognised by its header row**, never its file or sheet name. Keep the headers as they are; columns can be in any order, and a sheet can leave columns out.',
    '- **Rows find their record** by the columns marked “Matches the row”: a goal by its **Key**, then its **ID** (a goal carried into a new cycle keeps its key, so last cycle’s file still finds it); a check-in by its **ID**, or its goal and **Week**; a person by their **Email**, then their **ID**, then a name only one person has (the preview notes when a name was used). Teams are found by name.',
    '- **A column left out keeps what the record says.** An empty cell in a column that is there means empty, except where the column says otherwise.',
    '- **Every column you can change counts.** A change to any of them is applied, or shown as a problem to fix; none is quietly dropped. Worked-out columns are never read.',
    `- **Words are exact.** A word a column doesn’t know (a level of “vp”, a Must stay of “sometimes”) is a problem to fix, never a guess. A dash on its own (\`—\`) in Team, Owner or Feeds into means none.`,
    '- **The formula guard.** In a CSV, a text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return is written with an apostrophe in front, so a spreadsheet won’t run it as a formula. Loading it back takes the apostrophe off again.',
    '- **Line breaks** inside a cell are kept, in a workbook and in a CSV (as a quoted cell, RFC 4180).',
    `- **The Action column** does what the app does, with the same rules and preview: on Goals, \`${GOAL_ACTION_WORDS.word.stop}\` stops a goal with check-ins (say why in Reason) and \`${GOAL_ACTION_WORDS.word.delete}\` deletes one with none; on People, \`${PERSON_ACTION_WORDS.word.left}\` marks someone as left, their goals and open asks going to Takes over (by email). Undoing the import puts them back.`,
    '',
  ];
  for (const { x: sheet, keys } of sheets) {
    out.push(`## ${sheet.name}`, '', `One row per ${sheet.rowIs}. ${sheet.about}${sheet.loaded ? '' : ' Not loaded back.'}`, '');
    out.push('| Column | Kind | What it means | When loaded back |', '|---|---|---|---|');
    for (const c of sheet.columns) out.push(`| ${cell(c.header)} | ${ROLE_WORD[c.role]} | ${cell(c.means)} | ${cell(sheet.loaded ? roleLoaded(c) : 'Not loaded back')} |`);
    if (sheet.kind === 'plan') out.push(`| ${WEEK_COLUMN.header} | ${ROLE_WORD[WEEK_COLUMN.role]} | ${cell(WEEK_COLUMN.means)} | ${cell(WEEK_COLUMN.loaded)} |`);
    out.push('', `Always written by a table from Data: ${keys.join(', ')}.`, '');
  }
  out.push(
    '## Words',
    '',
    'The words the import reads, as the export writes them (other ways people write them are read too, such as “green” for on track):',
    '',
    `- Level: ${words(LEVEL_WORDS)}`,
    `- Type: ${words(TYPE_WORDS)}`,
    `- Plan: ${words(SHAPE_WORDS)}`,
    `- Must stay: ${words(BOUND_WORDS)}`,
    `- Call: ${words(CALL_WORDS)}`,
    `- Cause: ${[...new Set(Object.values(CAUSE_WORDS.word))].map((x) => `\`${x}\``).join(', ')}`,
    `- Recovery: ${words(RECOVERY_WORDS)}`,
    `- Action: ${words(GOAL_ACTION_WORDS)} (Goals), ${words(PERSON_ACTION_WORDS)} (People)`,
    '',
    'Worked-out columns use the status words defined in `src/domain/vocabulary.ts` (see `docs/glossary.md`); the README sheet lists every one with its meaning.',
    '',
    '## JSON',
    '',
    'Everything in the cycle, each goal with its plan by week and its check-ins inside it, for scripts and AI tools.',
    '',
    '```jsonc',
    '{',
    '  "format": "goals-app.export",',
    '  "version": 1,',
    '  "exportedAt": "2026-10-30T12:00:00.000Z",',
    '  "about": "…",                                   // how to read it, in a paragraph',
    '  "words": { "status": { "off": { "label": "…", "meaning": "…" }, … }, "flag": { … }, "result": { … }, … },',
    '  "workspace": { "id": "…", "name": "…" },',
    '  "cycle": { "id": "…", "name": "…", "startDate": "2026-01-05", "weeks": 53, "currentWeek": 45, "quarter": "Q4", "quarters": [{ "label": "Q1", "months": "…", "from": 1, "to": 13 }] },',
    '  "people": [{ "id": "…", "name": "…", "email": "… or null", "jobTitle": "…", "team": "…", "admin": false }],',
    '  "teams": [{ "id": "…", "name": "…", "objective": "…" }],',
    '  "goals": [{',
    '    "id": "…", "key": "G-12", "title": "…", "level": "north-star | svp | team", "type": "metric | range | milestone",',
    '    "team": "…", "owner": "…", "ownerId": "…", "ownerEmail": "… or null", "feedsIntoId": "… or null", "whyItHelps": "…", "source": "…", "definition": "…",',
    '    // metric:    "unit", "decimals", "plan": { start, target, shape, fromWeek, dueWeek, setByHand, byWeek: [{ week, value }] },',
    '    //            "earlierPlans": [{ untilWeek, start, target, shape }]  (each applied to the weeks before untilWeek)',
    '    // range:     "unit", "decimals", "range": { mustStay: "atMost | atLeast", limit, margin }',
    '    // milestone: "stages": [{ id, name, dueWeek }]',
    '    // stopped:   "stopped": { at, by, reason }',
    `    "now": { "status": "${Object.keys(STATUS).join(' | ')}", "statusLabel": "…", "statusMeaning": "…", "value": 29.4, "text": "29.4 days",`,
    '             "planThisWeek": 27.7, "gap": "…", "lastCheckInWeek": 44, "forecast": "…", "projection": { "likeliest", "low", "high", "byWeek", "fittedWeeks" } },',
    '    "story": { "since", "where", "outlook", "whyItsOff", "recoveryPlan", "byWhen", "needs", "nextStep", "warnings", "warningKinds", "feeds" },',
    '    "needsAttention": { "needs": true, "beingHandled": null, "flags": [{ "kind": "no-path", "label": "…", "detail": "…" }] },',
    '    "quarters": [{ "quarter": "Q1", "months": "…", "weeks": [1, 13], "result": "met | missed | open", "resultLabel": "…", "text": "…" }],',
    '    "result": { "kind": "completed | late | missed", "label": "…", "dueWeek": 53, "week": 52 },',
    '    "checkIns": [{ "id": "…", "week": 44, "weekStarting": "2026-10-26", "value": 29.4, "stages": null, "planThatWeek": 27.7, "call": "risk", "callLabel": "…",',
    '                   "calculated": "risk", "calculatedLabel": "…", "cause": "slower", "why": "…", "whyGreener": null,',
    '                   "pathToGreen": { "what": "…", "byWeek": 47, "needs": null, "state": "plan" }, "next": "…", "postedAt": "…", "postedBy": "…", "backfilled": false }]',
    '  }],',
    '  "notes": [{ "goalId": "…", "goalKey": "G-12", "week": 44, "kind": "note | question | action", "by": "…", "text": "…", "who": "…", "dueWeek": 46, "status": "…", "statusLabel": "…", "answer": "…", "at": "…" }]',
    '}',
    '```',
    '',
    `\`version\` changes only when a field is removed or changes meaning; new fields can be added without changing it. Codes (\`status\`, \`call\`, \`result.kind\`, a quarter’s \`result\`) never change; the words beside them are the vocabulary’s, defined under \`words\`. The AI assistant says both: “${withCode(STATUS.off)}”.`,
    '',
    '## Brief for an AI chat (Markdown)',
    '',
    'A short summary to paste into any AI chat: the counts by status; what needs attention, with the owner’s reason, path to green and what they need; what’s being handled; results and quarters; every goal by what it feeds; open questions and actions; and each goal’s weekly numbers with that week’s plan and the owner’s call.',
    '',
    '## Activity',
    '',
    'Activity saves the change log as it’s filtered, as a CSV with the columns When, Who, What, Goal, Kind, Changes (each field’s before and after) and Via (the app, a spreadsheet, Data or the AI assistant). It is a record, not loaded back.',
    '',
  );
  return out.join('\n');
}
