/* Spreadsheets, on Data (the data.tools place; import spec 2.9): Export, a menu (the open table as laid out, as .xlsx or
   .csv, and Everything…, which opens the Export sheet), and Import, a link to the Import page. The template and Past
   imports are on the Import page. */
import { useEffect, useRef, useState } from 'react';
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
  // What the table as shown holds, worked out when the menu opens, not as Data redraws for every key typed in its
  // search (N12: a workspace of 30,000 goals). As shown, the columns that say which record each row is are added at the
  // end (greyed), so it loads back.
  const [what, setWhat] = useState('');
  const wrap = useRef<HTMLSpanElement>(null);
  const shown = useRef(asShown);
  shown.current = asShown;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const opened = (e: Event) => {
      if (!(e.target as HTMLDetailsElement).open) return;
      const t = shown.current();
      const rows = t.rows.length - 1, cols = (t.rows[0]?.length ?? 0) - (t.muted?.length ?? 0);
      const keys = t.muted?.length ? `, plus ${andList(t.muted)} so it loads back` : '';
      setWhat(`${rows.toLocaleString('en-GB')} ${rows === 1 ? 'row' : 'rows'}, ${cols} ${cols === 1 ? 'column' : 'columns'}${keys}.`);
    };
    // A details' toggle doesn't bubble: listened for on the way down.
    el.addEventListener('toggle', opened, true);
    return () => el.removeEventListener('toggle', opened, true);
  }, []);
  // Closed, the sheet gives the focus back to Export, which opened it: the menu item it came from is hidden by then, and
  // the focus would fall to the page itself (#248 review).
  const closeEverything = () => {
    setEverything(false);
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('.data-export > summary')?.focus());
  };
  const tableAs = (kind: 'csv' | 'xlsx') => {
    const s = asShown();
    // A table that shows no rows has nothing to export: said, rather than a file of headers saved (#248 review).
    if (s.rows.length < 2) { app.toast('This table shows no rows, so there’s nothing to export. Clear the search or the filters first.', 'error'); return; }
    void saveAndSay(app.toast, { workspace: app.ws.name, what: table, scope: 'as-shown', date: app.today },
      kind === 'csv' ? { kind: 'csv', text: toCsv(s.rows) } : { kind: 'xlsx', sheets: [{ name: table, rows: s.rows, muted: s.muted }] }, (file) => `Exported ${file}`);
  };
  return (
    <>
      <span className="data-export-wrap" style={{ display: 'contents' }} ref={wrap}>
      <MenuButton className="data-export" summary="" label="Export" items={[
        { label: 'This table, as shown (.xlsx)', hint: what || undefined, onClick: () => tableAs('xlsx') },
        { label: 'This table, as shown (.csv)', onClick: () => tableAs('csv') },
        { label: 'Everything…', rule: true, onClick: () => setEverything(true) },
      ]} />
      </span>
      <Link className="btn sm data-import" to="/data/import">Import</Link>
      {everything && <ExportSheet goals={app.snapshot.goals} viewName="" onClose={closeEverything} />}
    </>
  );
}
