/* The first moments in a workspace: an invitation, saying who you are, and what to do once it's set up. */
import { workspaceName } from '../domain/workspaceAttention';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useApp, useMaybeApp, useSetup } from '../app/state';
import { creatorOf, inviteLink } from '../domain/dayOne';
import { arrivalIntro, arrivalLine } from '../domain/arrival';
import { Avatar, PageWait } from '../ui/bits';
import { FaroLogo } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { periodNow } from '../domain/cycle';
import { firstReview, weekProgress, WEEKDAY } from '../domain/progress';
import { dayText } from '../domain/review';
import { WEEKLY_REVIEW } from '../domain/via';
import type { NoEntry } from '../ports';

/**
 * Until sign-in comes with SSO, people say who they are once per workspace on this device: the arrival (set-up spec
 * 2.8). Whose workspace this is and what it is for, then "Which one are you?": choosing a name is the one action. A
 * sign-in that opens no one here (R1, rule 2) shows nothing of the workspace and says why.
 */
export function WhoAreYou() {
  const app = useApp();
  if (!app.canChooseViewer) return <CantOpenYet />;
  return <Arrival />;
}

function Arrival() {
  const app = useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState('');
  const people = app.snapshot.people;
  const creator = creatorOf(app.full.changes, people);
  const admin = people.find((p) => p.id === creator) ?? null;
  const owns = (id: string) => app.snapshot.goals.filter((g) => g.ownerId === id).length;
  useEffect(() => { document.title = `Welcome to ${app.ws.name} · Faro`; }, [app.ws.name]);
  const many = people.length > 8;
  const shown = q.trim() ? people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : people;
  const teams = [...new Set(shown.map((p) => p.teamId ?? ''))].map((t) => ({ id: t, name: app.team(t)?.name ?? '', people: shown.filter((p) => (p.teamId ?? '') === t) }));
  const choose = (id: string) => {
    app.setViewer(id, true);
    // From an invitation's address, on to Home; anywhere else, the page asked for opens as it is.
    if (/^\/join\//.test(pathname)) nav('/', { replace: true });
  };
  return (
    <div className="welcome">
      <div className="welcome-body arrival">
        <FaroLogo size={32} />
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <h1 className="title-xl">Welcome to {app.ws.name}</h1>
          <p className="arrival-lead">{arrivalIntro(app.ws, admin?.name ?? null, people.length, app.snapshot.goals.length)}</p>
          <span className="hint">Each goal has an owner who keeps it current. You’ll see yours, and what’s due, as soon as you’re in.</span>
        </div>
        <section className="stack" style={{ gap: 'var(--s2)' }} aria-labelledby="arrival-which">
          <h2 className="h3" id="arrival-which">Which one are you?</h2>
          {many && (
            <label className="stack" style={{ gap: 4 }}>
              <span className="field-label">Find your name</span>
              <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          {shown.length ? (
            <div className="arrival-people">
              {teams.map((t) => (
                <div key={t.id} role="group" aria-label={t.name || 'No team'}>
                  {t.name && <div className="field-label arrival-team" aria-hidden="true">{t.name}</div>}
                  {t.people.map((p) => (
                    <button key={p.id} type="button" className="arrival-person" onClick={() => choose(p.id)}>
                      <Avatar p={p} />
                      <span className="stack" style={{ gap: 0 }}><span className="strong">{app.personName(p.id)}</span><span className="small muted">{arrivalLine(p, creator, owns(p.id))}</span></span>
                      <Icon name="chevron-right" size={14} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : <p className="hint" role="status">No one by that name.</p>}
        </section>
        <p className="hint">This device remembers your answer. Signing in with your company login replaces this step in the internal app.</p>
        <p className="small">Not on the list? {admin?.email
          ? <a className="tap" href={`mailto:${admin.email}?subject=${encodeURIComponent(`Add me to ${app.ws.name} in Faro`)}`}>Ask {admin.name} to add you</a>
          : <>Ask whoever set up {app.ws.name} to add you.</>}</p>
        {/* The way out, to another workspace or a new one (review of #285, medium 1). */}
        <p className="small">Not you? <Link className="tap" to="/welcome">Go to Welcome</Link></p>
      </div>
    </div>
  );
}

/**
 * An invitation, `/join/<workspace>` (set-up spec 2.8): opens the workspace it names and nothing else. Known here, it
 * goes to Home; not yet, the arrival; a workspace that isn't there says so. Works with nothing open as well.
 */
export function Join() {
  const setup = useSetup();
  const app = useMaybeApp();
  const { workspaceId = '' } = useParams();
  const there = setup.workspaces.some((w) => w.id === workspaceId);
  const here = !!app && app.ws.id === workspaceId && !app.opening;
  useEffect(() => { if (setup.listed && there && !here && setup.openId !== workspaceId) setup.open(workspaceId); }, [setup, there, here, workspaceId]);
  if (!setup.listed) return null;
  if (!there) return <NotThere />;
  if (!here) return <PageWait />;
  return app.viewerChosen ? <Navigate to="/" replace /> : <WhoAreYou />;
}

/** An invitation to a workspace that isn't there: said, and nothing else opened (W13). */
function NotThere() {
  useEffect(() => { document.title = 'Welcome · Faro'; }, []);
  return (
    <div className="welcome">
      <div className="welcome-body">
        <FaroLogo size={32} />
        <h1 className="title-xl">This invitation doesn’t open a workspace</h1>
        <p className="arrival-lead">The workspace may have been deleted, or the link was cut short when it was copied. Ask whoever sent it for a new one.</p>
        <div className="row"><Link className="btn" to="/welcome">Go to Welcome</Link></div>
      </div>
    </div>
  );
}

/** What the page says for each reason a sign-in opens no one (Identity.why), and the message to send whoever set the
    workspace up. No reason known: the plain words that cover them all. */
export function cantOpenWords(ws: string, why: NoEntry | null): { line: string; message: string | null } {
  const as = why?.email ? ` I sign in as ${why.email}.` : '';
  switch (why?.reason) {
    case 'signed-out': return { line: 'You aren’t signed in. Sign in with your company account, then try again.', message: null };
    case 'no-one': return { line: `No one in ${ws} has the email ${why.email}. Ask whoever set up ${ws} to add you with that email.`, message: `Please add me to ${ws} in Faro.${as}` };
    case 'shared': return { line: `More than one person in ${ws} has the email ${why.email}, so Faro can’t tell which one is you. Ask whoever set up ${ws} to give each of them their own email.`, message: `More than one person in ${ws} in Faro has my email, so I can’t open it. Please give each of us our own.${as}` };
    case 'left': return { line: `${ws} has you down as having left. Ask whoever set up ${ws} to bring you back.`, message: `Please bring me back in ${ws} in Faro: it has me down as having left.${as}` };
    default: return { line: `You aren’t signed in, or no one here has the email you signed in with. Ask whoever set up ${ws} to add you.`, message: `Please add me to ${ws} in Faro.` };
  }
}

/** The page a sign-in that opens no one sees: why, and the way forward (a message to send, and trying again). */
function CantOpenYet() {
  const app = useApp();
  const { line, message } = cantOpenWords(app.ws.name, app.noEntry);
  const others = app.workspaces.filter((w) => w.id !== app.ws.id);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message!); setCopied('yes'); } catch { setCopied('no'); }
  };
  return (
    <div className="focus">
      <div className="focus-body" style={{ paddingTop: 'var(--s6)' }}>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="eyebrow">{app.ws.name}</span>
          <h1 className="title-xl">You can’t open {app.ws.name} yet</h1>
          <span className="hint">{line}</span>
        </div>
        {message && copied === 'no' && <p className="hint">Copy this and send it to them: <span className="strong">{message}</span></p>}
        <div className="row">
          {message && <button type="button" className="btn primary" onClick={() => void copy()}>{copied === 'yes' ? 'Copied: send it to them' : 'Copy a message for them'}</button>}
          <button type="button" className={message ? 'btn ghost' : 'btn primary'} onClick={() => location.reload()}>Try again</button>
        </div>
        {/* The switcher stays within reach here (outside review, 12 Nov): any other workspace opens from this page. */}
        {others.length > 0 && (
          <section className="stack" style={{ gap: 4 }} aria-labelledby="cant-open-others">
            <h2 className="field-label" id="cant-open-others">Open another workspace</h2>
            {others.map((w) => (
              <button key={w.id} type="button" className="menuitem ws-pick" onClick={() => app.switchWorkspace(w.id)}>
                <span className="strong ws-pick-name">{workspaceName(w, app.mode).name}</span>
              </button>
            ))}
          </section>
        )}
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
            ? <Link className="btn primary big-btn" to={mine.due.length ? '/check-in?start=1' : '/'}>{mine.due.length ? `Check in on your ${mine.due.length === 1 ? 'goal' : `${mine.due.length} goals`}` : 'Go to Home'}</Link>
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
