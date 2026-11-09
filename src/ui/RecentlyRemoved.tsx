/* Workspace's Recently removed, for admins: what was removed in the last 30 days, each with Restore. The rules are
   domain/removal's. (The cycles are Workspace's Cycles section.) */
import { useState } from 'react';
import { useApp } from '../app/state';
import { REMOVED_LABEL, type Removed } from '../domain/removal';
import { RESTORE_DAYS } from '../domain/vocabulary';
import { whenText } from './ChangeItem';

/** Everything removed in the last 30 days, newest first: what it was, who removed it, when, and Restore. */
/** `bare` leaves out its heading: on Workspace, Recently removed is a section with its own. */
export function RecentlyRemoved({ bare = false }: { bare?: boolean } = {}) {
  const app = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const list = app.recentlyRemoved();
  const who = (id: string | null) => app.person(id ?? '')?.name ?? app.full.people.find((p) => p.id === id)?.name ?? 'Someone';
  const restore = async (r: Removed) => {
    if (busy) return;
    setBusy(r.kind + r.id);
    try { await app.restoreRemoved(r.kind, r.id); app.toast(`Restored: ${r.name}`); } catch { /* the rule's message is shown */ }
    setBusy(null);
  };
  return (
    <section className="block removed-block" aria-labelledby={bare ? undefined : 'ws-removed'} aria-label={bare ? 'Recently removed' : undefined}>
      {!bare && <h2 className="block-title" id="ws-removed">Recently removed{list.length > 0 && <span className="hint count-after">· {list.length}</span>}</h2>}
      <p className="hint">Anything removed, stopped, ended or marked as left in the last {RESTORE_DAYS} days. Restore brings it back as it was. After {RESTORE_DAYS} days it leaves this list, but it’s never erased.</p>
      {!list.length ? <p className="hint">Nothing has been removed recently.</p> : (
        <ul className="removed-list" aria-label="Recently removed">
          {list.slice(0, limit).map((r) => (
            <li key={r.kind + r.id} className="removed-row">
              <span className="removed-text">
                <span className="removed-kind">{REMOVED_LABEL[r.kind]}</span>
                <span className="removed-name">{r.name}</span>
                <span className="hint">{who(r.by)} · {whenText(r.at, app.today)}</span>
              </span>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void restore(r)} aria-label={`Restore ${REMOVED_LABEL[r.kind].toLowerCase()}: ${r.name}`}>{busy === r.kind + r.id ? 'Restoring…' : 'Restore'}</button>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && <button type="button" className="btn sm" onClick={() => setLimit((n) => n + 20)}>Show {Math.min(20, list.length - limit)} more</button>}
    </section>
  );
}
