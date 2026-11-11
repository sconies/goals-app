/* The first moments in a workspace: saying who you are, and what to do once it's set up. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { periodNow } from '../domain/cycle';
import { firstReview, weekProgress, WEEKDAY } from '../domain/progress';
import { dayText } from '../domain/review';
import { WEEKLY_REVIEW } from '../domain/importer';
import { Avatar } from '../ui/bits';

/** Until sign-in comes with SSO, people say who they are once per workspace on this device. */
export function WhoAreYou() {
  const app = useApp();
  const [q, setQ] = useState('');
  // Signed in, but nobody here has that sign-in's email (R1, rule 2): only an admin can add them.
  if (!app.canChooseViewer) return (
    <div className="focus">
      <div className="focus-body" style={{ paddingTop: 'var(--s6)' }}>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="eyebrow">{app.ws.name}</span>
          <h1 className="title-xl">You’re not in {app.ws.name} yet</h1>
          <span className="hint">No one here has the email you signed in with. Ask whoever set up {app.ws.name} to add you.</span>
        </div>
      </div>
    </div>
  );
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

/** The address to send colleagues: the app, opened at this workspace's "Who are you?" (deep review U2). */
export const inviteLink = (origin: string, mode: string, wsId: string) => `${origin}${mode === 'demo' ? '/demo' : '/'}?workspace=${encodeURIComponent(wsId)}`;

/** Right after setting up: what's there now, and the one next thing. */
export function Ready() {
  const app = useApp();
  const mine = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const [copied, setCopied] = useState(false);
  const goals = app.snapshot.goals.length;
  const review = app.snapshot.reviews.find((r) => r.name === WEEKLY_REVIEW) ?? app.snapshot.reviews[0];
  // The link names this workspace, so it opens here and not the site's first workspace (deep review U2).
  const link = typeof location !== 'undefined' ? inviteLink(location.origin, app.mode, app.ws.id) : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div className="focus">
      <div className="celebrate" role="status">
        <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
        <h1 className="title-xl">{app.ws.name} is ready</h1>
        <p className="muted">{app.snapshot.people.length} {app.snapshot.people.length === 1 ? 'person' : 'people'}{goals ? `, ${goals} ${goals === 1 ? 'goal' : 'goals'}` : ''}. {periodNow(app.cycle, app.today)}.</p>
        {/* The review set-up made, and when the first check-ins are due: never already late (setup review, 8 Nov). */}
        {/* With no goals yet ("Set goals up later"), nothing is due: it says so rather than naming a date (deep review U6). */}
        <p className="muted">{review ? `${review.name} for everyone on ${WEEKDAY[review.weekday]}s. ` : ''}{goals
          ? <>The first check-ins are due before {WEEKDAY[app.cycle.reviewDay]} {dayText(firstReview(app.cycle, app.today).date).slice(4)}{review ? '’s review' : ''}.</>
          : 'No check-ins are due until there are goals: each owner adds theirs from New goal.'}</p>
        <div className="stack" style={{ gap: 'var(--s3)', alignItems: 'center' }}>
          {mine.due.length + mine.upcoming.length > 0
            ? <Link className="btn primary big-btn" to={mine.due.length ? '/check-in' : '/'}>{mine.due.length ? `Check in on your ${mine.due.length === 1 ? 'goal' : `${mine.due.length} goals`}` : 'Go to Home'}</Link>
            : goals ? <Link className="btn primary big-btn" to="/goals">See your goals</Link>
              : <Link className="btn primary big-btn" to="/goals/new">Set up the first goal</Link>}
          {/* Inviting is a link to pass on: Faro sends no email (UX report, 8 Nov). */}
          <span className="hint">Then invite your team: copy the link and send it to them yourself. Faro doesn’t send any email.</span>
          <button className="linkish tap" onClick={() => void copy()}>{copied ? 'Link copied: paste it into an email or chat' : 'Copy the link to send'}</button>
        </div>
      </div>
    </div>
  );
}
