/* The first moments in a workspace: saying who you are, and what to do once it's set up. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { periodNow } from '../domain/cycle';
import { firstReview, weekProgress, WEEKDAY } from '../domain/progress';
import { dayText } from '../domain/review';
import { WEEKLY_REVIEW } from '../domain/importer';
import { PickOne } from '../ui/Pick';
import { useSearch } from '../app/search';
import type { NoEntry } from '../ports';

/** Until sign-in comes with SSO, people say who they are once per workspace on this device. */
export function WhoAreYou() {
  const app = useApp();
  // Find-and-pick (find spec, move 14): your name is found by typing, never chosen from a list of everyone. Nobody is
  // "you" yet, so nothing is suggested before typing.
  const search = useSearch();
  const source = { search, viewerId: '', ws: app.ws.id, person: app.person };
  // A sign-in that opens no one here (R1, rule 2): nothing of the workspace is shown; the page says why, when the sign-in
  // can tell, and how to get in.
  if (!app.canChooseViewer) return <CantOpenYet />;
  return (
    <div className="focus">
      <div className="focus-body" style={{ paddingTop: 'var(--s6)' }}>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="eyebrow">{app.ws.name}</span>
          <h1 className="title-xl">Who are you?</h1>
          <span className="hint">Type your name to find it. This device remembers it; sign-in comes later with your company login.</span>
        </div>
        <PickOne kind="person" label="Your name" source={source} value={null} onChange={(id) => id && app.setViewer(id)} />
        <p className="hint">Not listed? Ask whoever set up {app.ws.name} to add you.</p>
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
