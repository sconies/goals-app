/* Workspace: switching workspaces, and (for admins) the people in this one. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { initials } from '../domain/importer';
import { personProblems } from '../domain/people';
import type { Person } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Sheet, timeAgo } from '../ui/bits';

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
  return (
    <div className="page workspace">
      <div className="page-head">
        <h1 className="title-xl">Workspace</h1>
        <span className="hint">{app.mode === 'demo' ? 'The example, and any you set up here to try it. All of it stays in this browser.' : 'Each workspace has its own people, goals, cycle and change log.'}</span>
      </div>
      <div className="split">
      <section className="block split-a">
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
      <aside className="split-side" aria-label="Settings">
        <AiAssistants />
        {admin && <FeedbackList />}
        {admin && app.ws.kind === 'own' && <DeleteWorkspace />}
      </aside>
      <section className="block split-b">
        <div className="row between">
          <h2 className="block-title">People in {app.ws.name} <span className="hint">· {app.snapshot.people.length}</span></h2>
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
                const body = <><span className="row" style={{ gap: 'var(--s3)' }}><Avatar p={x} size="sm" /><span className="stack" style={{ gap: 0 }}><span>{x.name}</span>{x.role && <span className="hint">{x.role}</span>}</span></span>{x.admin && <span className="chip tag">Admin</span>}</>;
                return admin
                  ? <button key={x.id} className="opt" onClick={() => setEditing(x)}>{body}</button>
                  : <div key={x.id} className="opt static">{body}</div>;
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
        {tried && dup && <span className="hint tone-off" role="alert">{dup.name} is already here. Add a middle initial so people can tell you apart.</span>}
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

/** Personal tokens for AI assistants (MCP): admins make them; the assistant acts as that person. */
function AiAssistants() {
  const app = useApp();
  const [making, setMaking] = useState(false);
  const live = (app.snapshot.tokens ?? []).filter((t) => !t.revokedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = app.viewer.admin ? live : live.filter((t) => t.personId === app.viewer.id);
  return (
    <section className="block">
      <div className="row between">
        <h2 className="block-title">AI assistants</h2>
        {app.viewer.admin && app.mode === 'live' && <button className="btn" onClick={() => setMaking(true)}>Make a token</button>}
      </div>
      <p className="hint">An AI assistant such as Claude can read these goals and post check-ins or changes through MCP, acting as one person: the same rights and rules, and every change is logged as theirs, marked “via AI assistant”.</p>
      {app.mode === 'demo'
        ? <p className="hint">This works in the real app. In the demo, data stays in your browser, where an assistant can’t reach it.</p>
        : !shown.length
          ? <p className="hint">{app.viewer.admin ? 'No tokens yet.' : 'Ask an admin to make you a token.'}</p>
          : (
            <div className="optlist">
              {shown.map((t) => (
                <div key={t.id} className="opt static">
                  <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                    <span>{t.name}</span>
                    <span className="hint">{app.person(t.personId)?.name ?? 'Someone'} · made {timeAgo(t.createdAt, app.today)} · {t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt, app.today)}` : 'not used yet'}</span>
                  </span>
                  <button className="btn sm" onClick={async () => { await app.revokeToken(t.id); app.toast(`Revoked “${t.name}”`); }} aria-label={`Revoke ${t.name}`}>Revoke</button>
                </div>
              ))}
            </div>
          )}
      {making && <TokenSheet onClose={() => setMaking(false)} />}
    </section>
  );
}

function TokenSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [personId, setPersonId] = useState(app.viewer.id);
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `${location.origin}/api/mcp`;
  const make = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    try { setToken(await app.createToken(personId, name)); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
    setBusy(false);
  };
  const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text).then(() => app.toast(`${what} copied`), () => undefined); };
  const who = app.person(personId)?.name ?? '';
  if (token) {
    const cmd = `claude mcp add --transport http goals ${url} --header "Authorization: Bearer ${token}"`;
    return (
      <Sheet open onClose={onClose} title={`Token for ${who}`}>
        <div className="stack" style={{ gap: 'var(--s4)' }}>
          <p className="hint tone-risk" role="status">Copy it now: it isn’t shown again. Anyone with it can act as {who.split(' ')[0]}, so keep it private.</p>
          <label className="field"><span className="field-label">Token</span>
            <span className="row nowrap" style={{ gap: 'var(--s2)' }}><input className="input mono" readOnly value={token} onFocus={(e) => e.target.select()} /><button type="button" className="btn" onClick={() => copy(token, 'Token')}>Copy</button></span>
          </label>
          <div className="field"><span className="field-label">Connect it</span>
            <span className="hint">Server: <code>{url}</code>, with the header <code>Authorization: Bearer</code> and the token. For Claude Code:</span>
            <span className="row nowrap" style={{ gap: 'var(--s2)' }}><input className="input mono" readOnly value={cmd} onFocus={(e) => e.target.select()} aria-label="Claude Code command" /><button type="button" className="btn" onClick={() => copy(cmd, 'Command')}>Copy</button></span>
            <span className="hint">An assistant that only takes a web address can use <code>{url}?token=</code> followed by the token.</span>
          </div>
          <div className="foot-row"><button type="button" className="btn primary big-btn" onClick={onClose}>Done</button></div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title="Make a token for an AI assistant">
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void make(); }}>
        <label className="field"><span className="field-label">Who it acts as</span>
          <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <span className="hint">The assistant can do what this person can: change their own goals{app.person(personId)?.admin ? ', and any goal, as they’re an admin' : ''}, and comment on any.</span>
        </label>
        <label className="field"><span className="field-label">What it’s for</span>
          <input className="input" value={name} placeholder="e.g. Claude on my laptop" onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="hint">Until company sign-in arrives, the app itself doesn’t check who people are. A token makes clear who an assistant acts for, and you can switch it off here at any time.</p>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={name.trim().length < 2 || busy}>{busy ? 'Making…' : 'Make the token'}</button></div>
      </form>
    </Sheet>
  );
}
