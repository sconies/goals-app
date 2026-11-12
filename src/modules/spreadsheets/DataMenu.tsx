/* Spreadsheets, on Data (the data.tools place; import spec 2.9): Export, a menu (the open table as laid out, as .xlsx or
   .csv, and Everything…, which opens the Export sheet), and Import, a link to the Import page. The template and Past
   imports are on the Import page. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import type { PlaceProps } from '../../core/app';
import { andList } from '../../domain/columns';
import { toCsv } from '../../domain/export';
import { MenuButton } from '../../ui/MenuButton';
import { ExportSheet } from './Export';

export function DataMenu({ table, asShown }: PlaceProps['data.tools']) {
  const app = useApp();
  const [everything, setEverything] = useState(false);
  // As shown, with the columns that say which record each row is added at the end (greyed), so it loads back.
  const t = asShown();
  const rows = t.rows.length - 1, cols = (t.rows[0]?.length ?? 0) - (t.muted?.length ?? 0);
  const keys = t.muted?.length ? `, plus ${andList(t.muted)} so it loads back` : '';
  const what = `${rows.toLocaleString('en-GB')} ${rows === 1 ? 'row' : 'rows'}, ${cols} ${cols === 1 ? 'column' : 'columns'}${keys}.`;
  const tableAs = (kind: 'csv' | 'xlsx') => {
    const s = asShown();
    void saveAndSay(app.toast, { workspace: app.ws.name, what: table, scope: 'as-shown', date: app.today },
      kind === 'csv' ? { kind: 'csv', text: toCsv(s.rows) } : { kind: 'xlsx', sheets: [{ name: table, rows: s.rows, muted: s.muted }] }, (file) => `Exported ${file}`);
  };
  return (
    <>
      <MenuButton className="data-export" summary="" label="Export" items={[
        { label: 'This table, as shown (.xlsx)', hint: what, onClick: () => tableAs('xlsx') },
        { label: 'This table, as shown (.csv)', onClick: () => tableAs('csv') },
        { label: 'Everything…', rule: true, onClick: () => setEverything(true) },
      ]} />
      <Link className="btn sm data-import" to="/data/import">Import</Link>
      {everything && <ExportSheet goals={app.snapshot.goals} viewName="" onClose={() => setEverything(false)} />}
    </>
  );
}
