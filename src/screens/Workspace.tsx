/* Workspace: switching workspaces, and (for admins) the people in this one. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { initials } from '../domain/importer';
import type { Person } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Sheet } from '../ui/bits';

export function WorkspaceHome() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const admin = app.viewer.admin;
  const groups = [...app.snapshot.teams.map((t) => [t.name, app.snapshot.people.filter((x) => x.teamId === t.id)] as const), ['No team', app.snapshot.people.filter((x) => !x.teamId || !app.team(x.teamId))] as const].filter(([, l]) => l.length);
  const admins = app.snapshot.people.filter((p) => p.admin);
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Workspace</h1>
        <span className="hint">{app.mode === 'demo' ? 'The example, and any you set up here to try it. All of it stays in this browser.' : 'Each workspace has its own people, goals, cycle and change log.'}</span>
      </div>
      <section className="block">
        <div className="glist">
          {app.workspaces.map((w) => (
            <button key={w.id} className="gline ws-line" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => app.switchWorkspace(w.id)}>
              <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.slice(0, 1).toUpperCase()}</span>
              <span className="gline-title">{w.name}</span>
              <span className="gline-now">{w.id === app.ws.id ? 'Open now' : w.kind === 'example' ? 'Demo data' : 'Your data'}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 'var(--s3)' }}>
          <Link className="btn" to="/workspace/new">{app.mode === 'demo' ? 'Try setting up your own' : 'New workspace'}</Link>
          {app.mode === 'live' && <a className="btn" href="/demo">Try the demo</a>}
          {app.mode === 'demo' && app.ws.kind === 'example' && (confirming
            ? <><span className="small">Undo every change in the example?</span><button className="btn" onClick={async () => { await app.resetExample(); setConfirming(false); }}>Yes, reset it</button><button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button></>
            : <button className="btn" onClick={() => setConfirming(true)}>Reset the example</button>)}
        </div>
      </section>
      <section className="block">
        <div className="row between">
          <h2 className="block-title">People in {app.ws.name}</h2>
          {admin && <button className="btn" onClick={() => setEditing('new')}>Add a person</button>}
        </div>
        <p className="hint">{admin ? 'You’re an admin: you can add people, change their details and make others admins.' : `Admins can add people: ${admins.map((p) => p.name).join(', ') || 'no one yet'}.`}</p>
        {groups.map(([team, list]) => (
          <div key={team} className="stack" style={{ gap: 'var(--s1)', marginTop: 'var(--s3)' }}>
            <span className="label">{team} · {list.length}</span>
            <div className="optlist">
              {list.map((x) => {
                const body = <><span className="row" style={{ gap: 'var(--s3)' }}><Avatar p={x} size="sm" /><span className="stack" style={{ gap: 0 }}><span>{x.name}</span>{x.role && <span className="hint">{x.role}</span>}</span></span>{x.admin && <span className="chip tag">Admin</span>}</>;
                return admin
                  ? <button key={x.id} className="opt" onClick={() => setEditing(x)}>{body}</button>
                  : <div key={x.id} className="opt static">{body}</div>;
              })}
            </div>
          </div>
        ))}
      </section>
      {editing && <PersonSheet person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PersonSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const app = useApp();
  const [p, setP] = useState<Person>(person ?? { id: newId('p'), name: '', role: '', initials: '', teamId: app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? null, admin: false });
  const [tried, setTried] = useState(false);
  const self = person?.id === app.viewer.id;
  const lastAdmin = !!person?.admin && app.snapshot.people.filter((x) => x.admin).length === 1;
  const save = async () => {
    setTried(true);
    if (!p.name.trim()) return;
    await app.savePerson({ ...p, name: p.name.trim(), role: p.role.trim(), initials: initials(p.name.trim()) }, person);
    app.toast(person ? 'Saved' : `Added ${p.name.trim()}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={person ? `Change ${person.name}` : 'Add a person'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <label className="field"><span className="field-label">Name</span>
          <input className={'input' + (tried && !p.name.trim() ? ' invalid' : '')} autoFocus={!person} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
        <label className="field"><span className="field-label">Job title <span className="hint">optional</span></span>
          <input className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
        </label>
        <label className="field"><span className="field-label">Team</span>
          <select className="input" value={p.teamId ?? ''} onChange={(e) => setP({ ...p, teamId: e.target.value || null })}>
            {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="">No team</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.admin} disabled={lastAdmin} onChange={(e) => setP({ ...p, admin: e.target.checked })} />
          <span className="stack" style={{ gap: 0 }}><span>Admin</span><span className="hint">{lastAdmin ? (self ? 'You’re the only admin, so you stay one.' : 'The only admin stays one.') : 'Can add people, change settings and make others admins.'}</span></span>
        </label>
        {tried && !p.name.trim() && <span className="hint tone-off" role="alert">Add a name.</span>}
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{person ? 'Save' : 'Add'}</button></div>
      </form>
    </Sheet>
  );
}
