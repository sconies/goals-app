/* Making someone an admin and taking it back (app redesign WR3, docs/design/workspace/spec.md 2.7): on Workspace,
   Access, and from a person's page. Both go through savePerson, so the last-admin rule and its words are the shared
   action's; this only says it plainly, asks before taking it away, and offers Undo. */
import { useRef, useState } from 'react';
import { useApp } from '../app/state';
import type { Person } from '../domain/types';

const firstOf = (name: string) => name.split(/\s+/)[0] ?? name;

/** Save a person's admin flag, say so, and offer Undo (which saves it back). Call it from a component that stays on
    screen (the page, not a row that leaves the list): Undo runs later, against the app as it is then. */
export function useSetAdmin() {
  const app = useApp();
  const latest = useRef(app);
  latest.current = app;
  return async (p: Person, admin: boolean) => {
    const before = app.person(p.id) ?? p;
    try {
      await app.savePerson({ ...before, admin }, before);
    } catch { return; /* the rule's words are shown */ }
    const said = admin ? `${p.name} is an admin` : p.id === app.viewer.id ? 'You’re no longer an admin' : `${p.name} is no longer an admin`;
    app.toast(said, 'success', { label: 'Undo', run: () => { const now = latest.current; void now.savePerson({ ...before, admin: !admin }, { ...before, admin }).then(() => now.toast(admin ? `${p.name} is no longer an admin` : `${p.name} is an admin again`)).catch(() => undefined); } });
  };
}

/** "Remove as admin" (or "Stop being an admin" on your own row), asked in place. The only admin gets no button. */
export function RemoveAdmin({ p, quiet = true, setAdmin }: { p: Person; quiet?: boolean; setAdmin: ReturnType<typeof useSetAdmin> }) {
  const app = useApp();
  const [asking, setAsking] = useState(false);
  const you = p.id === app.viewer.id;
  const only = app.snapshot.people.filter((x) => x.admin).length === 1;
  if (only) return <span className="hint">The only admin</span>;
  if (!asking) return <button type="button" className={'btn sm' + (quiet ? ' ghost' : '')} onClick={() => setAsking(true)} aria-label={you ? 'Stop being an admin' : `Remove as admin: ${p.name}`}>{you ? 'Stop being an admin' : 'Remove as admin'}</button>;
  return (
    <span className="admin-confirm" role="group" aria-label={you ? 'Stop being an admin' : `Remove as admin: ${p.name}`}>
      <span className="small">{you ? 'Stop being an admin? Another admin can make you one again.' : `Stop ${firstOf(p.name)} being an admin? They keep their goals and history.`}</span>
      <span className="row" style={{ gap: 'var(--s2)' }}>
        <button type="button" className="btn sm" onClick={() => { setAsking(false); void setAdmin(p, false); }}>Yes, remove</button>
        <button type="button" className="btn sm ghost" onClick={() => setAsking(false)}>Cancel</button>
      </span>
    </span>
  );
}
