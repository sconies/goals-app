/* Welcome, at its own address (set-up spec ST1, 2.1): what Faro is, one thing to do (set up a workspace), and two doors
   under it, the demo and an invitation. Someone who has been here before sees what this device remembers first: each
   workspace with who they are in it, and a set-up they didn't finish. It never opens a workspace nobody chose. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMaybeApp, useSetup } from '../app/state';
import { clearDraft, peekDraft } from '../app/drafts';
import { draftStopped, readInvitation } from '../domain/arrival';
import { workspaceName } from '../domain/workspaceAttention';
import { FaroLogo } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { PROTOTYPE_LINE } from '../help/about';

interface DraftPeek { step?: number; name?: string; template?: string; savedAt?: string }

/** One of Welcome's doors: a hairline row with a bold line, a plain one and a chevron. */
function Door({ title, line, to, href, onClick, open }: { title: string; line: string; to?: string; href?: string; onClick?: () => void; open?: boolean }) {
  const body = <><span className="stack welcome-door-text"><span className="strong">{title}</span><span className="small muted">{line}</span></span><Icon name="chevron-right" size={14} /></>;
  if (to) return <Link className="welcome-door" to={to}>{body}</Link>;
  if (href) return <a className="welcome-door" href={href}>{body}</a>;
  return <button type="button" className="welcome-door" aria-expanded={open} onClick={onClick}>{body}</button>;
}

export function Welcome() {
  const setup = useSetup();
  const app = useMaybeApp();
  const nav = useNavigate();
  const demo = setup.mode === 'demo';
  const remembered = setup.remembered();
  const draftKey = `setup:${setup.mode}`;
  const [draft, setDraft] = useState(() => peekDraft<DraftPeek>(draftKey));
  const [discarding, setDiscarding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const back = remembered.length > 0 || !!draft;
  useEffect(() => { document.title = 'Welcome · Faro'; }, []);

  const open = (id: string) => {
    if (app?.ws.id !== id) setup.open(id);
    nav('/');
  };
  const join = () => {
    const r = readInvitation(link, location.origin);
    if ('problem' in r) { setProblem(r.problem); return; }
    // An invitation for the other side (the demo, or the real app) is a different app: open it there.
    if (r.demo !== demo) { location.assign(`${r.demo ? '/demo' : ''}/join/${encodeURIComponent(r.id)}`); return; }
    nav(`/join/${encodeURIComponent(r.id)}`);
  };

  const doors = (
    <div className="welcome-doors">
      {back && <Door title="Set up another workspace" line="About 5 minutes." to="/workspace/new" />}
      {demo
        ? <Door title="Back to the demo" line="Example data, about 100 people and a year of goals. None of it can be kept." to="/" />
        : <Door title="Look around the demo" line={back ? 'Example data, about 100 people and a year of goals. None of it can be kept.' : 'A made-up division of about 100 people with a year of goals. It’s example data: change anything, but none of it can be kept or copied into a workspace.'} href="/demo" />}
      <Door title="Join a workspace you were invited to" line="Open the link you were sent, or paste it here." open={joining} onClick={() => setJoining((v) => !v)} />
      {joining && (
        <form className="stack welcome-join" style={{ gap: 'var(--s2)' }} onSubmit={(e) => { e.preventDefault(); join(); }}>
          <label className="field-label" htmlFor="welcome-link">The link you were sent</label>
          <input id="welcome-link" className={'input' + (problem ? ' invalid' : '')} aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'welcome-link-problem' : undefined} autoFocus inputMode="url" value={link} onChange={(e) => { setLink(e.target.value); setProblem(null); }} />
          {problem && <span id="welcome-link-problem" className="hint tone-off field-error" role="alert">{problem}</span>}
          <button type="submit" className="btn">Open it</button>
        </form>
      )}
    </div>
  );

  return (
    <div className="welcome">
      <div className="welcome-body">
        <FaroLogo size={48} className="welcome-logo" />
        {back ? (
          <>
            <h1 className="title-xl">Welcome back</h1>
            <section className="stack" style={{ gap: 0 }} aria-labelledby="welcome-device">
              <h2 className="field-label" id="welcome-device">On this device</h2>
              <div className="welcome-doors">
                {remembered.map((r, i) => (
                  <div key={r.ws.id} className="welcome-row">
                    <span className="stack welcome-door-text"><span className="strong">{workspaceName(r.ws, setup.mode).name}</span><span className="small muted">You’re {r.me} here{r.week ? ` · week ${r.week}` : ''}</span></span>
                    <button type="button" className={'btn' + (i === 0 ? ' primary' : '')} aria-label={`Open ${r.ws.name}`} onClick={() => open(r.ws.id)}>Open</button>
                  </div>
                ))}
                {draft && (
                  <div className="welcome-row">
                    <span className="stack welcome-door-text">
                      <span className="strong">{draft.name?.trim() ? `“${draft.name.trim()}”, a set-up you didn’t finish` : 'A set-up you didn’t finish'}</span>
                      <span className="small muted">{discarding ? 'Discard this set-up? What you typed will be lost.' : draftStopped(draft)}</span>
                    </span>
                    {discarding ? (
                      <span className="row welcome-row-actions">
                        <button type="button" className="btn ghost" onClick={() => setDiscarding(false)}>Keep it</button>
                        <button type="button" className="btn" onClick={() => { clearDraft(draftKey); setDraft(null); setDiscarding(false); }}>Discard it</button>
                      </span>
                    ) : (
                      <span className="row welcome-row-actions">
                        <button type="button" className="linkish tap" onClick={() => setDiscarding(true)}>Discard</button>
                        <Link className={'btn' + (remembered.length ? '' : ' primary')} to="/workspace/new">Carry on</Link>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>
            {doors}
          </>
        ) : (
          <>
            {/* Written for leaders seeing Faro for the first time (Lane, 8 Nov): what it's for, not how to set it up. */}
            <h1 className="title-xl">Run the company on outcomes, and manage by exception</h1>
            <div className="stack welcome-lines" style={{ gap: 'var(--s2)' }}>
              <p>Faro keeps each outcome and the goals that move it in one place, each with an owner, a measure and a plan.</p>
              <p>Owners keep them current. What’s slipping comes to you, with why and what’s being done about it.</p>
            </div>
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              <Link className="btn primary big-btn" to="/workspace/new">Set up a workspace</Link>
              <span className="hint">About 5 minutes. Nothing is saved until the last step.</span>
            </div>
            {doors}
          </>
        )}
        <p className="hint welcome-foot">{PROTOTYPE_LINE}</p>
      </div>
    </div>
  );
}
