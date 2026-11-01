/* The first moments in a workspace: saying who you are, and what to do once it's set up. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { weekProgress, WEEKDAY } from '../domain/progress';
import { Avatar } from '../ui/bits';

/** Until sign-in comes with SSO, people say who they are once per workspace on this device. */
export function WhoAreYou() {
  const app = useApp();
  const [q, setQ] = useState('');
  const found = app.snapshot.people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...app.snapshot.teams.map((t) => [t.name, found.filter((x) => x.teamId === t.id)] as const), ['No team', found.filter((x) => !x.teamId || !app.team(x.teamId))] as const].filter(([, l]) => l.length);
  return (
    <div className="focus">
      <div className="focus-body" style={{ paddingTop: 'var(--s6)' }}>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="eyebrow">{app.ws.name}</span>
          <h1 className="title-xl">Who are you?</h1>
          <span className="hint">Pick your name. This device remembers it; sign-in comes later with your company login.</span>
        </div>
        {app.snapshot.people.length > 8 && (
          <label className="field"><span className="sr">Find your name</span><input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name" aria-label="Find your name" /></label>
        )}
        {groups.map(([p, list]) => (
          <section key={p} className="stack" style={{ gap: 'var(--s2)' }}>
            <span className="field-label">{p}</span>
            <div className="optlist">
              {list.map((x) => (
                <button key={x.id} className="opt" onClick={() => app.setViewer(x.id)}>
                  <span className="row" style={{ gap: 'var(--s3)' }}><Avatar p={x} size="sm" />{x.name}</span>
                  <span className="hint">{x.role}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!found.length && <p className="hint">No one by that name. Ask whoever set up {app.ws.name} to add you.</p>}
      </div>
    </div>
  );
}

/** Right after setting up: what's there now, and the one next thing. */
export function Ready() {
  const app = useApp();
  const mine = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const [copied, setCopied] = useState(false);
  const goals = app.snapshot.goals.length;
  const link = typeof location !== 'undefined' ? location.origin + (app.mode === 'demo' ? '/demo' : '/') : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div className="focus">
      <div className="celebrate" role="status">
        <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
        <h1 className="title-xl">{app.ws.name} is ready</h1>
        <p className="muted">{app.snapshot.people.length} {app.snapshot.people.length === 1 ? 'person' : 'people'}{goals ? `, ${goals} ${goals === 1 ? 'goal' : 'goals'}` : ''}. {app.week < 1 ? `The cycle starts this week; the first check-ins are due in week 1, before ${WEEKDAY[app.cycle.reviewDay]}’s review.` : `The cycle is in week ${app.week} of ${app.cycle.weeks}.`}</p>
        <div className="stack" style={{ gap: 'var(--s3)', alignItems: 'center' }}>
          {mine.due.length > 0
            ? <Link className="btn primary big-btn" to="/check-in">Check in on your {mine.due.length === 1 ? 'goal' : `${mine.due.length} goals`}</Link>
            : goals ? <Link className="btn primary big-btn" to="/goals">See your goals</Link>
              : <Link className="btn primary big-btn" to="/goals/new">Set up the first goal</Link>}
          <span className="hint">Then share the link so owners can check in.</span>
          <button className="linkish tap" onClick={() => void copy()}>{copied ? 'Link copied' : 'Copy the link for your team'}</button>
        </div>
      </div>
    </div>
  );
}
