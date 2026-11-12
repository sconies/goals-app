/* Workspace's Recently removed: what was removed in the last 30 days, each with Restore; for an admin everything, for anyone
   else what they removed themselves. The rules are
   domain/removal's. (The cycles are Workspace's Cycles section.) */
import { useState } from 'react';
import { useApp } from '../app/state';
import { canRestore, type Removed } from '../domain/removal';
import { RESTORE_DAYS } from '../domain/vocabulary';
import { whenText } from './ChangeItem';

/** Everything removed in the last 30 days, newest first: what it was, who removed it, when, and Restore. */
/** `bare` leaves out its heading: on Workspace, Recently removed is a section with its own. */
export function RecentlyRemoved({ bare = false }: { bare?: boolean } = {}) {
  const app = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  // An admin sees everything removed; anyone else what they removed themselves, which they can restore (8 Nov).
  const all = app.recentlyRemoved().filter((r) => canRestore(app.viewer, r));
  // A long list can be searched by name and narrowed to one kind (WR4).
  const list = all.filter((r) => (!kind || r.kind === kind) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  const kinds = [...new Set(all.map((r) => r.kind))];
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
      <p className="hint">{app.viewer.admin ? `Anything removed, stopped, ended or marked as left in the last ${RESTORE_DAYS} days. After ${RESTORE_DAYS} days it leaves this list; it is never erased.` : `What you removed in the last ${RESTORE_DAYS} days. Admins see everyone’s.`}</p>
      {all.length > 20 && (
        <div className="row removed-find">
          <label className="field" style={{ flex: '2 1 200px' }}><span className="sr">Find by name</span><input className="input" type="search" placeholder="Find by name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field" style={{ flex: '1 1 160px' }}><span className="sr">Kind</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Kind: every kind</option>
              {kinds.map((k) => <option key={k} value={k}>{all.find((r) => r.kind === k)!.label}</option>)}
            </select>
          </label>
        </div>
      )}
      {!all.length ? <p className="hint">{app.viewer.admin ? `Nothing was removed in the last ${RESTORE_DAYS} days.` : `You removed nothing in the last ${RESTORE_DAYS} days.`}</p> : !list.length ? <p className="hint">Nothing removed matches.</p> : (
        <ul className="removed-list" aria-label="Recently removed">
          {list.slice(0, limit).map((r) => (
            <li key={r.kind + r.id} className="removed-row">
              <span className="removed-text">
                <span className="removed-kind">{r.label}</span>
                <span className="removed-name">{r.name}</span>
                <span className="hint">{who(r.by)} · {whenText(r.at, app.today)}</span>
              </span>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void restore(r)} aria-label={`Restore ${r.label.toLowerCase()}: ${r.name}`}>{busy === r.kind + r.id ? 'Restoring…' : 'Restore'}</button>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && <button type="button" className="btn sm" onClick={() => setLimit((n) => n + 20)}>Show {Math.min(20, list.length - limit)} more</button>}
    </section>
  );
}
