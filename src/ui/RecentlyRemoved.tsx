/* Workspace sections for admins: what was removed in the last 30 days, each with Restore, and the cycles, where one
   nobody has checked in to yet can be deleted. The rules are domain/removal's. */
import { useState } from 'react';
import { useApp } from '../app/state';
import { cycleStanding, REMOVED_LABEL, type Removed } from '../domain/removal';
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

/** The workspace's cycles: a cycle no one has checked in to can be deleted (started by mistake, say), and comes back with Undo or Restore. */
/** The cycles, newest first. `bare` (Workspace's Cycles section, which has its own heading) lists even a single one. */
export function CycleList({ bare = false }: { bare?: boolean } = {}) {
  const app = useApp();
  const cycles = app.full.cycles.filter((c) => !c.removedAt).sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (cycles.length < 2 && !bare) return null;
  return (
    <section className="block cycles-block" aria-labelledby={bare ? undefined : 'ws-cycles'} aria-label={bare ? 'Cycles' : undefined}>
      {!bare && <h2 className="block-title" id="ws-cycles">Cycles<span className="hint count-after">· {cycles.length}</span></h2>}
      {/* On Workspace the section's heading says what a cycle is and when one can go; said once (backlog WS). */}
      {!bare && <p className="hint">A cycle nobody has checked in to yet can be deleted, with its goals. One with check-ins stays.</p>}
      <ul className="removed-list" aria-label="Cycles">
        {cycles.map((c) => {
          const st = cycleStanding(app.full, c.id);
          return (
            <li key={c.id} className="removed-row">
              <span className="removed-text">
                <span className="removed-name">{c.name}{c.id === app.cycle.id ? <span className="hint"> · open now</span> : null}</span>
                <span className="hint">{st.says}</span>
              </span>
              {st.deletable && <button type="button" className="btn sm" onClick={() => void app.deleteCycle(c.id).catch(() => undefined)} aria-label={`Delete the cycle ${c.name}`}>Delete</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
