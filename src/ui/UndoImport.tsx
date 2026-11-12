/* Undo an import, bulk edit or change through MCP (import spec 2.6): a sheet that says first what Undo would do
   (rule 9, undoPreview): how many rows go back, and which stay as they are because they changed after the import, each
   with why. Opened from Imported, Past imports and the import's line in Activity; the same sheet at all three. */
import { useState } from 'react';
import { useApp } from '../app/state';
import { canUndoImport, importName, importUndone, keptText, type KeptRow } from '../domain/removal';
import type { Change } from '../domain/types';
import { Sheet } from './bits';

const rows = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;
const onDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Undone on 12 Nov 2026 by Rhea Kapoor.": an undone import's line. */
export function UndoneLine({ entry }: { entry: Change }) {
  const app = useApp();
  const undone = app.snapshot.changes.find((c) => c.action === 'undone' && c.entity === 'workspace' && c.entityId === entry.entityId);
  if (!undone) return null;
  return <span className="small muted import-undone">Undone on {onDay(undone.at)} by {app.person(undone.actorId)?.name ?? 'someone'}.</span>;
}

/**
 * "Undo this import" (or `label`), for whoever made it or an admin, opening the Undo sheet; or the undone line. Nothing
 * for anyone else.
 */
export function UndoImport({ entry, label, className }: { entry: Change; label?: string; className?: string }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  if (importUndone(app.snapshot, entry.entityId)) return <UndoneLine entry={entry} />;
  if (!canUndoImport(app.snapshot, entry, app.viewer)) return null;
  return (
    <>
      <button type="button" className={className ?? 'btn sm import-undo'} aria-haspopup="dialog" onClick={() => setOpen(true)}>{label ?? 'Undo this import'}</button>
      {open && <UndoSheet entry={entry} onClose={() => setOpen(false)} />}
    </>
  );
}

function UndoSheet({ entry, onClose }: { entry: Change; onClose: () => void }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const name = importName(entry);
  let plan: { restores: number; skipped: KeptRow[] } | null = null;
  let problem = '';
  try { plan = app.undoPreview(entry.entityId); } catch (e) { problem = e instanceof Error ? e.message : String(e); }
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await app.undoImport(entry.entityId);
      app.toast(`Undone: ${rows(out.restored)} put back.`);
      onClose();
    } catch { setBusy(false); }
  };
  if (!plan) return <Sheet open onClose={onClose} title={`Undo ${name}?`}><p>{problem}</p><div className="sheet-foot"><button type="button" className="btn" onClick={onClose}>Close</button></div></Sheet>;
  const { restores, skipped } = plan;
  const all = restores + skipped.length;
  if (!restores) {
    return (
      <Sheet open onClose={onClose} title={`Undo ${name}?`}>
        <p className="undo-sheet-lead">Nothing left to undo: all {rows(all)} have changed since.</p>
        <Kept rows={skipped} />
        <div className="sheet-foot"><button type="button" className="btn primary" onClick={onClose}>Close</button></div>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title={`Undo ${name}?`}>
      <p className="undo-sheet-lead">
        {rows(restores)} go{restores === 1 ? 'es' : ''} back to how {restores === 1 ? 'it was' : 'they were'} on {onDay(entry.at)}.
        {skipped.length ? ` ${skipped.length} stay${skipped.length === 1 ? 's' : ''} as ${skipped.length === 1 ? 'it is' : 'they are'}, because ${skipped.length === 1 ? 'it' : 'they'} changed after the import:` : ''}
      </p>
      <Kept rows={skipped} />
      <div className="sheet-foot">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn danger" disabled={busy} onClick={() => void go()}>{busy ? 'Undoing…' : `Undo ${rows(restores)}`}</button>
      </div>
    </Sheet>
  );
}

function Kept({ rows: list }: { rows: KeptRow[] }) {
  if (!list.length) return null;
  return (
    <ul className="hairline-list undo-kept" aria-label="Rows that stay as they are">
      {list.map((k) => <li key={keptText(k) + k.at} className="small"><span className="strong">{k.name}</span>: {k.reason}</li>)}
    </ul>
  );
}
