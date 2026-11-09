/* The spreadsheets module's Help articles (src/help/guide.ts places them after Data). */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'import',
    title: 'Importing from a spreadsheet',
    summary: 'Load a workbook, a zip of CSVs or one CSV to add or change people, goals, plan numbers and check-ins, past weeks included, or to stop a goal.',
    group: 'data',
    after: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'On Data, open Spreadsheets and choose Import a spreadsheet. Download the workbook there first to start from what is already in the app, or the blank template to start from nothing.',
        'Change it in Excel, then drop it in or choose the file: an .xlsx workbook, a .zip of CSVs, or one .csv or tab-separated file. Anything Export these goals or Data saves loads back.',
        'Each sheet is known by its header row, whatever the file or sheet is called. Results, Asks, Notes, Metrics and the README are for reading, and left out.',
        'Rows find their goal by its key, then its ID, so a file from last cycle still finds the goals carried over. People are found by email, then by a name only one person has; the preview notes when a name was used.',
        'Every column you can change counts: a change to any of them is applied, or shown as a problem. Worked-out columns (Status, Gap, Calculated…) are ignored. A word a column doesn’t know, such as a level of “vp”, is a problem to fix, never a guess.',
        'The Action column: Stop a goal with check-ins (say why in Reason), Delete one set up by mistake, or mark someone as Left (their goals and asks go to Takes over, by email). The same rules as the app apply, and the preview shows what each does.',
        'Every row is checked with the app’s own rules and shown before anything is saved. Nothing saves while a row needs fixing; plan changes after check-ins need a reason. A plan change that flips which way is better, or puts a number far outside the old plan, is listed under Check these plan changes and saves only once you say yes.',
        'Past weeks are marked as loaded later, so history never looks like a fresh update. Rows that change nothing are left alone, and so are a stopped goal’s rows.',
        'Loaded the wrong file? Undo this import, on its entry in Activity, puts every row back as it was, stopped goals and people who left included.',
      ] },
      { heading: 'Who can', text: ['Owners change their own goals; admins can change any, and add and change people. Rows for other people’s goals are fine if you leave them as they are.'] },
    ],
    routes: ['/data/import', '/import'],
    screens: ['Import'],
    reqs: ['BULK-IMPORT', 'WORKSPACES', 'HONEST-NUMBERS', 'ONE-FORMAT', 'ROUND-TRIP', 'IMPORT-ACTIONS', 'SPREADSHEETS-ON-DATA'],
    keywords: ['import', 'upload', 'excel', 'csv', 'zip', 'spreadsheet', 'workbook', 'load', 'bulk', 'undo', 'action', 'stop', 'delete', 'left', 'email', 'round trip'],
    related: ['export', 'data', 'keys', 'removing'],
  },
  {
    id: 'export',
    title: 'Exporting',
    summary: 'Take the goals out as an Excel workbook, zipped CSVs, one CSV, JSON, or a brief to paste into an AI chat.',
    group: 'data',
    after: 'import',
    sections: [
      { heading: 'How to use it', list: [
        'On Goals, choose Export these goals. Pick everything this year, or just what is shown now (it starts there when the goals are filtered).',
        'On Data, Spreadsheets has the rest: the open table exactly as laid out (CSV or Excel), everything as a workbook or as zipped CSVs, and the blank template, every sheet with its headers and no rows.',
        'Excel workbook, the usual choice: every sheet, Goals, Plan, Check-ins, People, Results (each goal’s result and its quarters, for year-end reporting), Asks and Notes, and a README that explains each column. Worked-out columns are in grey. A goal stopped this year is in it, with Stopped as its status.',
        'CSV files: the same sheets as CSVs, one each with the same headers, in a zip. Or pick one table and save it as a single CSV.',
        'One format: whatever you export can be edited and loaded back on Data’s Import, or used to set up a new workspace. Loaded back unedited, it changes nothing. Each person is written with their name and email.',
        'JSON: everything, with each goal’s plan and check-ins inside it, in a stated format.',
        'Brief for an AI chat: Markdown that leads with decisions waiting on people, then each goal’s story, then results. Copy it or save it.',
        'Every file the app saves, here and elsewhere, is named the same way: the workspace, what it holds, which goals, and the date, such as platform-goals-year-2026-2026-11-05.xlsx.',
      ] },
    ],
    routes: [],
    screens: ['Export', 'DataMenu'],
    reqs: ['EXPORT', 'SHARED-DOWNLOADS', 'ONE-FORMAT'],
    keywords: ['export', 'download', 'excel', 'xlsx', 'csv', 'zip', 'json', 'markdown', 'brief', 'ai chat', 'results', 'year end', 'format', 'template', 'blank'],
    related: ['import', 'print', 'data'],
  },
];

export default help;
