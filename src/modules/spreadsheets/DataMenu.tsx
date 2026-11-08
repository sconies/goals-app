/* Spreadsheets, on Data (the data.tools place): the module's home. One menu beside Columns and Saved layouts holds
   every way in and out: the open table as laid out (CSV or Excel), the whole workbook, the same sheets as zipped CSVs,
   the blank template, and Import, which shows every change before anything is saved. */
import { useNavigate } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import type { PlaceProps } from '../../core/app';
import { blankWorkbook, csvFiles, toCsv, workbook, type ExportInput } from '../../domain/export';
import { MenuButton } from '../../ui/MenuButton';

export function DataMenu({ table, asShown }: PlaceProps['data.tools']) {
  const app = useApp();
  const nav = useNavigate();
  const input: ExportInput = { ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today };
  const name = (what: string, scope: string) => ({ workspace: app.ws.name, what, scope, date: app.today });
  const tableAs = async (kind: 'csv' | 'xlsx') => {
    // As shown, with the columns that say which record each row is added at the end (greyed), so it loads back.
    const t = asShown();
    const rows = t.rows;
    const keys = t.muted?.length ? `, plus ${t.muted.join(', ')} so it loads back` : '';
    await saveAndSay(app.toast, name(table, t.scope), kind === 'csv' ? { kind: 'csv', text: toCsv(rows) } : { kind: 'xlsx', sheets: [{ name: table, rows, muted: t.muted }] },
      `Exported ${rows.length - 1} ${rows.length === 2 ? 'row' : 'rows'} and ${(rows[0]?.length ?? 0) - (t.muted?.length ?? 0)} columns, as shown${keys}`);
  };
  return (
    <MenuButton className="data-export" summary="" label="Spreadsheets" items={[
      { label: 'CSV, as shown', onClick: () => void tableAs('csv') },
      { label: 'Excel (.xlsx), as shown', onClick: () => void tableAs('xlsx') },
      { label: 'Everything, as a workbook', onClick: () => void saveAndSay(app.toast, name('goals', app.cycle.name), { kind: 'xlsx', sheets: workbook(input) }, 'Workbook saved') },
      { label: 'Everything, as zipped CSVs', onClick: () => void saveAndSay(app.toast, name('goals-csv', app.cycle.name), { kind: 'zip', files: csvFiles(workbook(input)) }, 'CSV files saved') },
      { label: 'Blank template', onClick: () => void saveAndSay(app.toast, name('template', 'blank'), { kind: 'xlsx', sheets: blankWorkbook(input) }, 'Blank template saved') },
      { label: 'Import a spreadsheet…', onClick: () => nav('/data/import') },
    ]} />
  );
}
