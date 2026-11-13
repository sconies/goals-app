/* The spreadsheets module's AI tools: the goals as files, and one Data table exactly as a layout shows it. The MCP
   server offers them with the core's (src/mcp/tools.ts); in a workspace that has switched spreadsheets off, they say
   so instead of running. */
import { aiBrief, sheetNamed, toCsv, toJson, workbook } from '../../domain/export';
import { sheetNamesWith, START_HERE } from '../../domain/columns';
import { exportOn, MODULE_SHEETS } from '../../core/records';
import { exportedTable, TABLE_ORDER, TABLES } from '../../domain/tableLayout';
import type { ToolDef } from '../../mcp/tools';
import { layoutFrom, sheetOf } from '../../mcp/workTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const ids = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const READ = { readOnlyHint: true, openWorldHint: false } as const;
/** Each sheet of the workbook as a CSV format the export tool offers: goals_csv, plan_csv, check_ins_csv… */
const csvFormats = (sheets: Parameters<typeof sheetNamesWith>[0], reviews = true) => sheetNamesWith(sheets, reviews).filter((n) => n !== START_HERE).map((n) => [`${n.toLowerCase().replace(/[^a-z]+/g, '_')}_csv`, n] as const);
/** Every format this build has, for the tool's schema; a workspace with a module (or Reviews) switched off has fewer (F2, RS1). */
const CSV_FORMATS = csvFormats(MODULE_SHEETS);

const tools: ToolDef[] = [
  {
    name: 'export',
    title: 'Export the goals',
    description: 'Every goal in the current cycle as JSON (each goal with its plan by week and check-ins), a Markdown brief, or one sheet of the spreadsheet export as CSV: goals, plan, check-ins, people, results (each goal’s result and quarters), asks, notes or metrics (the metric library). The goals, plan, check-ins and people CSVs load back with bulk_change.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['format'], properties: { format: str('Which export.', { enum: ['json', 'brief', ...CSV_FORMATS.map(([f]) => f)] }) } },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(a, ctx) {
      // What this workspace's exports hold (F2, RS1): a module that's off adds no sheet; with Reviews off, no Notes.
      const on = exportOn(ctx.ws);
      const x = { ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today, ...on };
      const formats = csvFormats(on.sheets, on.reviews);
      if (a.format === 'json') { const j = toJson(x); return { data: j, text: JSON.stringify(j) }; }
      if (a.format === 'brief') return { text: aiBrief(x) };
      const sheet = formats.find(([f]) => f === a.format)?.[1];
      if (sheet) return { text: toCsv(sheetNamed(workbook(x), sheet).rows) };
      // A sheet this build has but this workspace has switched off: said so, the same way for Notes as for Metrics.
      const off = CSV_FORMATS.find(([f]) => f === a.format && !formats.some(([g]) => g === f))?.[1];
      if (off) return { isError: true, text: `The ${off} sheet’s module is switched off in ${ctx.ws.name}, so it isn’t exported there. An admin can switch it on in Workspace, under Features.` };
      return { isError: true, text: `format should be json, brief or one of ${formats.map(([f]) => f).join(', ')}.` };
    },
  },
  {
    name: 'export_table',
    title: 'Export a data table as shown',
    description: 'One of Data’s tables (goals, checkIns, plan, requests, people) exactly as a layout shows it: its columns in order and the rows that pass its search and filters, sorted, then any column that says which record a row is (a goal’s Key and ID, a person’s Email…) the layout leaves out, so the rows load back with bulk_change. Give a saved layout by name, or the table with columns and a query. CSV by default, or rows as JSON.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      view: str('The name of a saved layout: one of yours, or one pinned for everyone.'),
      table: str('Which data table, when not using a view.', { enum: TABLE_ORDER }),
      columns: ids('The columns, in order. Leave out for the usual columns.'),
      query: str('Search, filters and sort, as for save_table_view.'),
      format: str('CSV text, or rows as JSON.', { enum: ['csv', 'json'] }),
    } },
    annotations: READ,
    async run(a, ctx) {
      const layout = layoutFrom(ctx, a);
      const rows = exportedTable(sheetOf(ctx, layout.table), layout).rows;
      const [head = [], ...body] = rows;
      const what = `${TABLES[layout.table].label}: ${body.length} ${body.length === 1 ? 'row' : 'rows'}, ${head.length} columns`;
      if (a.format === 'json') return { data: { table: layout.table, columns: head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [String(h), r[i] ?? null]))) }, text: what };
      return { data: { table: layout.table, columns: head, count: body.length }, text: toCsv(rows) };
    },
  },
];

export default tools;
