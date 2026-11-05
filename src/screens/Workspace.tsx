/* Workspace: its name and teams, switching workspaces (when there's more than one), and (for admins) the people in it. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { initials } from '../domain/importer';
import { personProblems } from '../domain/people';
import type { Person, Team } from '../domain/types';
import { teamMembers } from '../domain/actions';
import { newId } from '../data/store';
import { Avatar, Sheet } from '../ui/bits';
import { AiAssistants } from '../ui/AiAssistants';

export function WorkspaceHome() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const admin = app.viewer.admin;
  // A directory that works for a whole company: find by name, role or team, filter by team, and show a page at a time.
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [limit, setLimit] = useState(60);
  const needle = q.trim().toLowerCase();
  const match = (x: Person) => (!teamId || (teamId === '-' ? !x.teamId || !app.team(x.teamId) : x.teamId === teamId))
    && (!needle || [x.name, x.role ?? '', app.team(x.teamId ?? '')?.name ?? ''].some((v) => v.toLowerCase().includes(needle)));
  const found = app.snapshot.people.filter(match);
  const shown = new Set(found.slice(0, limit).map((x) => x.id));
  const groups = [...app.snapshot.teams.map((t) => [t.name, found.filter((x) => x.teamId === t.id && shown.has(x.id))] as const), ['No team', found.filter((x) => (!x.teamId || !app.team(x.teamId)) && shown.has(x.id))] as const].filter(([, l]) => l.length);
  const admins = app.snapshot.people.filter((p) => p.admin);
  // Most people are in one workspace: then there's nothing to switch between, only this one's name.
  const several = app.workspaces.length > 1;
  return (
    <div className="page workspace">
      <div className="page-head">
        <h1 className="title-xl">Workspace</h1>
        <span className="hint">{app.mode === 'demo' ? 'The example, and any you set up here to try it. All of it stays in this browser.' : 'Each workspace has its own people, teams, goals, cycle and change log.'}</span>
      </div>
      <div className="split">
      <section className="block split-a">
        <WorkspaceName several={several} />
        {several && (
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <div className="glist">
              {app.workspaces.map((w) => (
                <button key={w.id} className="gline ws-line" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => app.switchWorkspace(w.id)}>
                  <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.replace(/^example:\s*/i, '').slice(0, 1).toUpperCase()}</span>
                  <span className="gline-title">{w.name}</span>
                  <span className="gline-now">{w.id === app.ws.id ? 'Open now' : w.kind === 'example' ? 'Demo data' : 'Your data'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <Link className="btn" to="/workspace/new">{app.mode === 'demo' ? 'Try setting up your own' : 'New workspace'}</Link>
          {app.mode === 'live' && <a className="btn" href="/demo">Try the demo</a>}
          {app.mode === 'demo' && app.ws.kind === 'example' && <button className="btn" aria-expanded={confirming} onClick={() => setConfirming(true)}>Reset the example</button>}
        </div>
        {app.mode === 'demo' && app.ws.kind === 'example' && confirming && (
          <div className="reset-confirm" role="group" aria-label="Reset the example">
            <span className="small">Undo every change in the example?</span>
            <span className="row" style={{ gap: 'var(--s2)' }}>
              <button className="btn" onClick={async () => { await app.resetExample(); setConfirming(false); }}>Yes, reset it</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          </div>
        )}
      </section>
      <aside className="split-side" aria-label="Teams and settings">
        <Teams />
        {admin ? <AiAssistants /> : <section className="block"><h2 className="block-title">AI assistants</h2><p className="hint">Your tokens for an AI assistant are in <Link to="/settings">Settings</Link>.</p></section>}
        {admin && <FeedbackList />}
        {admin && app.ws.kind === 'own' && <DeleteWorkspace />}
      </aside>
      <section className="block split-b">
        <div className="row between people-head">
          <h2 className="block-title">People in {app.ws.name}<span className="hint count-after">· {app.snapshot.people.length}</span></h2>
          {admin && <button className="btn" onClick={() => setEditing('new')}>Add a person</button>}
        </div>
        <p className="hint">{admin ? 'You’re an admin: you can add people, change their details and make others admins.' : `Admins can add people: ${admins.map((p) => p.name).join(', ') || 'no one yet'}.`}</p>
        <div className="row directory-find">
          <label className="field" style={{ flex: '2 1 220px' }}><span className="sr">Find a person</span><input className="input" type="search" placeholder="Find by name, role or team" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} /></label>
          <label className="field" style={{ flex: '1 1 160px' }}><span className="sr">Team</span>
            <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setLimit(60); }}>
              <option value="">Every team</option>
              {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="-">No team</option>
            </select>
          </label>
        </div>
        {(needle || teamId) && <p className="hint" role="status">{found.length === 0 ? 'No one matches.' : `${found.length} ${found.length === 1 ? 'person matches' : 'people match'}.`}</p>}
        {groups.map(([team, list]) => (
          <div key={team} className="stack" style={{ gap: 'var(--s1)', marginTop: 'var(--s3)' }}>
            <span className="label">{team} · {list.length}</span>
            <div className="optlist">
              {list.map((x) => {
                const body = <><Avatar p={x} size="sm" /><span className="person-text"><span className="person-name">{x.name}</span>{x.role && <span className="hint">{x.role}</span>}</span>{x.admin && <span className="chip tag">Admin</span>}</>;
                return admin
                  ? <button key={x.id} className="opt person-opt" onClick={() => setEditing(x)}>{body}</button>
                  : <div key={x.id} className="opt static person-opt">{body}</div>;
              })}
            </div>
          </div>
        ))}
        {found.length > limit && <button type="button" className="btn" onClick={() => setLimit((n) => n + 60)}>Show {Math.min(60, found.length - limit)} more of {found.length - limit}</button>}
      </section>
      </div>
      {editing && <PersonSheet person={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** The workspace's name, and for admins a way to change it, in place. */
function WorkspaceName({ several }: { several: boolean }) {
  const app = useApp();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    if (name === null || !name.trim() || busy) return;
    setBusy(true);
    try {
      const same = name.trim().replace(/\s+/g, ' ') === app.ws.name;
      await app.renameWorkspace(name);
      app.toast(same ? 'Nothing changed.' : 'Renamed the workspace');
      setName(null); setTried(false);
    } catch { /* the rule's message is shown */ }
    setBusy(false);
  };
  if (name !== null) {
    return (
      <form className="stack ws-rename" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Workspace name</span>
            <input className={'input' + (tried && !name.trim() ? ' invalid' : '')} aria-invalid={tried && !name.trim() ? true : undefined} autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {tried && !name.trim() && <span className="hint tone-off" role="alert">Give the workspace a name.</span>}
        </div>
        <span className="ws-rename-buttons"><button type="submit" className="btn">{busy ? 'Saving…' : 'Save the name'}</button><button type="button" className="btn ghost" onClick={() => { setName(null); setTried(false); }}>Cancel</button></span>
      </form>
    );
  }
  const rename = app.viewer.admin && <button type="button" className="btn sm" onClick={() => setName(app.ws.name)} aria-label={`Rename ${app.ws.name}`} title={several ? `Rename the one that’s open: ${app.ws.name}` : undefined}>Rename</button>;
  // With several, the list below names them all (this one is "Open now"): a heading for it, and Rename for the open one.
  if (several) return <div className="ws-title-row ws-list-head"><span className="label">Your workspaces · {app.workspaces.length}</span>{rename}</div>;
  return (
    <div className="ws-title-row">
      <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.replace(/^example:\s*/i, '').slice(0, 1).toUpperCase()}</span>
      <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
        <h2 className="block-title ws-title">{app.ws.name}</h2>
        <span className="hint">{app.snapshot.people.length} people · {app.snapshot.teams.length} {app.snapshot.teams.length === 1 ? 'team' : 'teams'} · {app.cycle.name}</span>
      </span>
      {rename}
    </div>
  );
}

/** The teams, with how many people and goals each has. Admins add, rename and remove them. */
function Teams() {
  const app = useApp();
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [removing, setRemoving] = useState<Team | null>(null);
  const admin = app.viewer.admin;
  const ctx = { snapshot: app.snapshot, allGoals: app.allGoals };
  return (
    <div className="stack teams-block" style={{ gap: 'var(--s2)' }}>
      <div className="row between teams-head">
        <h2 className="block-title">Teams<span className="hint count-after">· {app.snapshot.teams.length}</span></h2>
        {admin && <button className="btn" onClick={() => setEditing('new')}>Add a team</button>}
      </div>
      {!app.snapshot.teams.length ? <p className="hint">No teams yet.</p> : (
        <ul className="optlist team-list" aria-label="Teams">
          {app.snapshot.teams.map((t) => {
            const m = teamMembers(ctx, t.id);
            const lead = app.person(t.leadId);
            return (
              <li key={t.id} className="opt static team-opt">
                <span className="person-text">
                  <span className="person-name">{t.name}</span>
                  <span className="hint">{[lead ? `Led by ${lead.name}` : '', `${m.people.length} ${m.people.length === 1 ? 'person' : 'people'}`, `${m.goals.length} ${m.goals.length === 1 ? 'goal' : 'goals'}`].filter(Boolean).join(' · ')}</span>
                </span>
                {admin && (
                  <span className="team-actions">
                    <button type="button" className="btn sm" onClick={() => setEditing(t)} aria-label={`Rename ${t.name}`}>Rename</button>
                    <button type="button" className="btn sm" onClick={() => setRemoving(t)} aria-label={`Remove ${t.name}`}>Remove</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <TeamSheet team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveTeamSheet team={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

function TeamSheet({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState(team?.name ?? '');
  const [leadId, setLeadId] = useState(team?.leadId ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, ' ');
  const dup = app.snapshot.teams.find((t) => t.id !== team?.id && !!clean && t.name.trim().toLowerCase() === clean.toLowerCase());
  const save = async () => {
    setTried(true);
    if (!clean || dup || busy) return;
    setBusy(true);
    try {
      await app.saveTeam({ id: team?.id, name, leadId: leadId || null });
      app.toast(team ? (team.name !== clean ? `Renamed to ${clean}` : 'Saved') : `Added ${clean}`);
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={team ? `Change ${team.name}` : 'Add a team'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Team name</span>
            <input className={'input' + (tried && (!clean || dup) ? ' invalid' : '')} aria-invalid={tried && (!clean || !!dup) ? true : undefined} autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {tried && !clean && <span className="hint tone-off" role="alert">Give the team a name.</span>}
          {tried && dup && <span className="hint tone-off" role="alert">There’s already a team called {dup.name}.</span>}
        </div>
        <label className="field"><span className="field-label">Team lead <span className="hint">optional</span></span>
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">No lead</option>
            {app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{busy ? 'Saving…' : team ? 'Save' : 'Add the team'}</button></div>
      </form>
    </Sheet>
  );
}

/** Removing a team: an empty one goes at once; one with people or goals moves them to another team in the same save. */
function RemoveTeamSheet({ team, onClose }: { team: Team; onClose: () => void }) {
  const app = useApp();
  const m = teamMembers({ snapshot: app.snapshot, allGoals: app.allGoals }, team.id);
  const others = app.snapshot.teams.filter((t) => t.id !== team.id);
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = [m.people.length ? `${m.people.length} ${m.people.length === 1 ? 'person' : 'people'}` : '', m.goals.length ? `${m.goals.length} ${m.goals.length === 1 ? 'goal' : 'goals'}` : ''].filter(Boolean).join(' and ');
  const go = async () => {
    setTried(true);
    if ((has && !to) || busy) return;
    setBusy(true);
    try {
      const dest = app.team(to)?.name;
      await app.removeTeam(team.id, to || null);
      app.toast(has ? `Removed ${team.name}, and moved ${has} to ${dest}` : `Removed ${team.name}`);
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Remove ${team.name}`}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
        {!has ? <p className="small">No one is in {team.name} and it has no goals, so it can go. The change log keeps a note of it.</p> : !others.length ? (
          <p className="small">{team.name} has {has}. Add another team to move them to first: every goal belongs to a team.</p>
        ) : (
          <>
            <p className="small">{team.name} has {has}{m.goals.some((g) => g.cycleId !== app.cycle.id) ? ', some in earlier cycles' : ''}. They move to another team first, in the same step, and each goal’s history says so.</p>
            <div className="field">
              <label className="field"><span className="field-label">Move them to</span>
                <select className={'input' + (tried && !to ? ' invalid' : '')} aria-invalid={tried && !to ? true : undefined} value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose a team</option>
                  {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {tried && !to && <span className="hint tone-off" role="alert">Choose where they go.</span>}
            </div>
          </>
        )}
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button>{(!has || others.length > 0) && <button className="btn danger big-btn" type="submit">{busy ? 'Removing…' : has ? 'Move them and remove' : 'Remove the team'}</button>}</div>
      </form>
    </Sheet>
  );
}

function PersonSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const app = useApp();
  const [p, setP] = useState<Person>(person ?? { id: newId('p'), name: '', role: '', initials: '', teamId: app.viewer.teamId ?? app.snapshot.teams[0]?.id ?? null, admin: false });
  const [tried, setTried] = useState(false);
  const self = person?.id === app.viewer.id;
  const dup = app.snapshot.people.find((x) => x.id !== p.id && !!p.name.trim() && x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
  const lastAdmin = !!person?.admin && app.snapshot.people.filter((x) => x.admin).length === 1;
  const save = async () => {
    setTried(true);
    if (personProblems(p, app.snapshot.people, person).length) return;
    await app.savePerson({ ...p, name: p.name.trim(), role: p.role.trim(), initials: initials(p.name.trim()) }, person);
    app.toast(person ? 'Saved' : `Added ${p.name.trim()}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={person ? `Change ${person.name}` : 'Add a person'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div className="field">
          <label className="field"><span className="field-label">Name</span>
            <input className={'input' + (tried && (!p.name.trim() || dup) ? ' invalid' : '')} aria-invalid={tried && (!p.name.trim() || !!dup) ? true : undefined} autoFocus={!person} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </label>
          {tried && !p.name.trim() && <span className="hint tone-off" role="alert">Add a name.</span>}
          {tried && dup && <span className="hint tone-off" role="alert">{dup.name} is already here. Add a middle initial so people can tell you apart.</span>}
        </div>
        <label className="field"><span className="field-label">Job title <span className="hint">optional</span></span>
          <input className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
        </label>
        <label className="field"><span className="field-label">Team</span>
          <select className="input" value={p.teamId ?? ''} onChange={(e) => setP({ ...p, teamId: e.target.value || null })}>
            {app.snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="">No team</option>
          </select>
        </label>
        <label className="check admin-check">
          <input type="checkbox" checked={p.admin} disabled={lastAdmin} onChange={(e) => setP({ ...p, admin: e.target.checked })} />
          <span className="stack" style={{ gap: 0 }}><span className="admin-word">Admin</span><span className="hint">{lastAdmin ? (self ? 'You’re the only admin, so you stay one.' : 'The only admin stays one.') : 'Can add people, change settings and make others admins.'}</span></span>
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit">{person ? 'Save' : 'Add'}</button></div>
      </form>
    </Sheet>
  );
}

/** For admins: what people said through the feedback button, newest first. */
function FeedbackList() {
  const app = useApp();
  const list = (app.snapshot.feedback ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  if (!list.length) return null;
  const counts = (['good', 'meh', 'bad'] as const).map((m) => list.filter((f) => f.mood === m).length);
  return (
    <section className="block">
      <h2 className="block-title">Feedback <span className="hint">· {list.length}</span></h2>
      <p className="hint">{counts[0]} say it helps, {counts[1]} it’s OK, {counts[2]} it gets in the way.</p>
      <ul className="changes">
        {list.slice(0, 20).map((f) => (
          <li key={f.id} className="change">
            <Avatar p={app.person(f.personId) ?? { name: '?', initials: '?' }} size="sm" />
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="small"><strong>{app.person(f.personId)?.name ?? 'Someone'}</strong> · {f.mood === 'good' ? 'It helps' : f.mood === 'meh' ? 'It’s OK' : 'It gets in the way'} · <span className="muted">{f.path}</span></span>
              {f.text && <span className="note-text">{f.text}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** For admins: delete this workspace and everything in it. Typing its name confirms, because it can't be undone. */
function DeleteWorkspace() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const match = typed.trim() === app.ws.name.trim();
  const go = async () => {
    if (!match || busy) return;
    setBusy(true);
    try { await app.deleteWorkspace(); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); setBusy(false); }
  };
  return (
    <section className="block danger-zone">
      <h2 className="block-title">Delete this workspace</h2>
      <p className="hint">Removes {app.ws.name}: its people, goals, check-ins, reviews and history{app.mode === 'demo' ? ' (in this browser)' : ', for everyone'}. This can’t be undone.</p>
      {!open ? <div><button className="btn danger" onClick={() => setOpen(true)}>Delete {app.ws.name}…</button></div> : (
        <form className="stack" style={{ gap: 'var(--s3)', maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <label className="field"><span className="field-label">Type <strong>{app.ws.name}</strong> to confirm</span>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={`Type ${app.ws.name} to confirm`} />
          </label>
          <div className="foot-row"><button type="button" className="btn ghost" onClick={() => { setOpen(false); setTyped(''); }}>Cancel</button><button type="submit" className="btn danger" disabled={!match || busy}>{busy ? 'Deleting…' : 'Delete it for good'}</button></div>
        </form>
      )}
    </section>
  );
}
