/* Imported (backlog IM4; import spec 2.5), at /data/import/done/<importId>: what an import saved, read back from the
   change log so the page reloads. See the goals, or Undo this import (the Undo sheet, ui/UndoImport). The rows the person
   left out download from here while the file is still in memory. */
import { Link, useParams } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import { canUndoImport, importCounts, importEntry, importName, importUndone } from '../../domain/removal';
import { importRows } from '../../domain/importRows';
import { UndoImport, UndoneLine } from '../../ui/UndoImport';
import { useImport } from './importStore';
import { baseName, rowsSheets } from './rowsFile';
import './import.css';

const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;

export function Imported() {
  const app = useApp();
  const { importId = '' } = useParams();
  const st = useImport();
  const entry = importEntry(app.snapshot, importId);
  if (!entry) {
    return (
      <div className="page narrow import-check">
        <div className="page-head"><h1 className="title-xl">Imported</h1></div>
        <p>There’s no import with that ID. <Link className="linkish" to="/data/imports">See past imports</Link></p>
      </div>
    );
  }
  // Rows, counted as Undo counts what it puts back, so "Saved 3 rows" and "3 rows go back" agree (IM4 review).
  const saved = importRows(entry);
  const left = Number(/(\d+) left out/.exec(entry.diffs.find((d) => d.field === 'Rows')?.to ?? '')?.[1] ?? 0);
  const done = st.done?.importId === importId && st.read ? st.done : null;
  const counts = importCounts(entry);
  const download = () => done && st.read && void saveAndSay(app.toast, { workspace: app.ws.name, what: 'left-out', date: app.today, as: `${baseName(st.name)}-left-out` }, { kind: 'xlsx', sheets: rowsSheets(st.read, done.tables, done.rows) }, 'Rows left out saved');
  const undone = importUndone(app.snapshot, importId);
  const mayUndo = !undone && canUndoImport(app.snapshot, entry, app.viewer);
  return (
    <div className="page narrow import-check imported-page">
      <div className="page-head"><h1 className="title-xl">Imported</h1></div>
      <section className="import-done stack" aria-label="What was saved">
        <p className="strong">Saved {n(saved, 'row')} from {importName(entry)}.</p>
        <p>{counts.charAt(0).toUpperCase() + counts.slice(1)}.</p>
        {left > 0 && <p className="small">{n(left, 'row was', 'rows were')} left out.{done?.rows.length ? <> <button type="button" className="linkish tap" onClick={download}>Download them</button></> : null}</p>}
        {undone ? <UndoneLine entry={entry} /> : null}
        <div className="import-fix-actions">
          <Link className="btn primary big-btn" to="/goals">See the goals</Link>
          {!undone && <UndoImport entry={entry} className="btn big-btn" />}
        </div>
        {mayUndo && <p className="hint">Undo stays on Data, under <Link className="linkish" to="/data/imports">Past imports</Link>, and on this import’s line in Activity.</p>}
      </section>
    </div>
  );
}
