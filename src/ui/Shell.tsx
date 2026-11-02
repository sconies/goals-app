import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp, useToasts } from '../app/state';
import { shortPeriod } from '../domain/year';
import { weekProgress } from '../domain/progress';
import { reviewSession, watchedGoals } from '../domain/review';
import type { Person } from '../domain/types';
import { Avatar, Sheet } from './bits';
import { setNavMode, useNavMode, type NavMode } from '../app/navMode';

type NavId = 'home' | 'checkin' | 'watching' | 'reviews' | 'goals' | 'activity' | 'new' | 'workspace';
const NAV: Record<NavId, { to: string; label: string; icon: ReactNode }> = {
  home: { to: '/', label: 'Home', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" /><path d="M6.5 13.5v-4h3v4" /></svg> },
  checkin: { to: '/check-in', label: 'Check-in', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.3-3.6" /></svg> },
  watching: { to: '/watching', label: 'Watching', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg> },
  reviews: { to: '/reviews', label: 'Reviews', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10.5" rx="2" /><path d="M2.5 6.5h11M5.5 1.8v2.4M10.5 1.8v2.4" /></svg> },
  goals: { to: '/goals', label: 'Goals', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg> },
  activity: { to: '/activity', label: 'Activity', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" /></svg> },
  new: { to: '/goals/new', label: 'New goal', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg> },
  workspace: { to: '/workspace', label: 'Workspace', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg> },
};
/** Everyone gets the same places; check-in only appears for people who own goals. */
function navFor(ownsGoals: boolean, mode: NavMode = 'current'): NavId[] {
  // The 4-tab trial: Home, Goals, Reviews on the bar; check-in is reached from Home and goal pages, Watching from Goals.
  if (mode === 'four') return ['home', 'goals', 'reviews', ...(ownsGoals ? ['checkin' as const] : []), 'watching', 'activity', 'new', 'workspace'];
  return ownsGoals ? ['home', 'checkin', 'watching', 'reviews', 'goals', 'activity', 'new', 'workspace'] : ['home', 'watching', 'reviews', 'goals', 'activity', 'new', 'workspace'];
}

function isActive(id: NavId, path: string) {
  const to = NAV[id].to;
  if (id === 'home') return path === '/';
  if (id === 'goals') return path.startsWith('/goals') && path !== '/goals/new';
  return path === to || path.startsWith(to + '/');
}

/** What a person does here, in a few words: the goals they own, what they watch, whether they're an admin. */
export function personFacts(p: Person, app: ReturnType<typeof useApp>): string {
  const owns = app.snapshot.goals.filter((g) => g.ownerId === p.id).length;
  const watches = watchedGoals(p.id, app.snapshot).length;
  const reviews = app.snapshot.reviews.filter((r) => r.people.includes(p.id)).length;
  const bits = [owns ? `owns ${owns}` : '', watches ? `watches ${watches}` : '', reviews ? `in ${reviews} ${reviews === 1 ? 'review' : 'reviews'}` : '', p.admin ? 'admin' : ''].filter(Boolean);
  return bits.length ? bits.join(', ') : 'can view everything';
}

export function ProfileSheet({ open, onClose, onShowDemoBar }: { open: boolean; onClose: () => void; onShowDemoBar?: () => void }) {
  const app = useApp();
  const teams = [...app.snapshot.teams.map((t) => [t.name, app.snapshot.people.filter((x) => x.teamId === t.id)] as const), ['No team', app.snapshot.people.filter((x) => !x.teamId)] as const].filter(([, l]) => l.length);
  return (
    <Sheet open={open} onClose={onClose} title={app.mode === 'demo' ? 'View as someone else' : 'Who are you?'}>
      <p className="hint" style={{ marginBottom: 'var(--s3)' }}>{app.mode === 'demo'
        ? 'Each person sees their own home: the goals they own, what they watch and the reviews they’re in.'
        : 'Pick your name. Sign-in comes later with your company login; until then this device remembers who you are.'}</p>
      {teams.map(([team, list]) => (
        <section key={team} className="stack" style={{ gap: 'var(--s1)', marginBottom: 'var(--s4)' }}>
          <span className="field-label">{team}</span>
          {list.map((x) => (
            <button key={x.id} className="menuitem" aria-current={x.id === app.viewer.id ? 'true' : undefined} onClick={() => { app.setViewer(x.id); onClose(); }}>
              <Avatar p={x} size="sm" />
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}><span className="strong">{x.name}</span><span className="tiny muted">{personFacts(x, app)}</span></span>
              {x.id === app.viewer.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>You</span>}
            </button>
          ))}
        </section>
      ))}
      {onShowDemoBar && <button className="btn" onClick={() => { onShowDemoBar(); onClose(); }}>Show the demo bar</button>}
    </Sheet>
  );
}

function WorkspaceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Workspaces">
      <div className="stack" style={{ gap: 4 }}>
        {app.workspaces.map((w) => (
          <button key={w.id} className="menuitem" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => { app.switchWorkspace(w.id); onClose(); }}>
            <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.slice(0, 1).toUpperCase()}</span>
            <span className="stack" style={{ gap: 0, flex: 1 }}><span className="strong">{w.name}</span><span className="tiny muted">{w.kind === 'example' ? 'Example data you can play with and reset' : app.mode === 'demo' ? 'Your own, in this browser' : 'Your workspace'}</span></span>
            {w.id === app.ws.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Open</span>}
          </button>
        ))}
        <Link className="menuitem" to="/workspace/new" onClick={onClose}><span className="wsmark add" aria-hidden="true">+</span><span className="strong">{app.mode === 'demo' ? 'Try setting up your own' : 'New workspace'}</span></Link>
        {app.mode === 'demo'
          ? <a className="menuitem" href="/"><span className="wsmark add" aria-hidden="true">↩</span><span className="strong">Leave the demo</span></a>
          : <a className="menuitem" href="/demo"><span className="wsmark example" aria-hidden="true">D</span><span className="stack" style={{ gap: 0 }}><span className="strong">Try the demo</span><span className="tiny muted">Example data, in your browser only</span></span></a>}
      </div>
    </Sheet>
  );
}

/** The demo's cast: the people worth trying, each doing something different. */
const DEMO_CAST = ['maya', 'sam', 'elena', 'tom', 'priya'];

/** Demo only: whose view this is, switchable in one tap, with a way to start again or leave. */
function DemoBar({ onPeople, onHide }: { onPeople: () => void; onHide: () => void }) {
  const app = useApp();
  const navMode = useNavMode();
  const nav = useNavigate();
  const [resetting, setResetting] = useState(false);
  // The Developer Platform example has a hand-picked cast; other examples show an admin, the main owners and someone who only watches.
  const picked = DEMO_CAST.map((id) => app.person(id)).filter((p): p is Person => !!p);
  const owners = (id: string) => app.snapshot.goals.filter((g) => g.ownerId === id).length;
  const cast = picked.length >= 3 ? picked : [
    ...app.snapshot.people.filter((p) => p.admin).slice(0, 1),
    ...app.snapshot.people.filter((p) => !p.admin && owners(p.id) > 0).sort((a, b) => owners(b.id) - owners(a.id)).slice(0, 3),
    ...app.snapshot.people.filter((p) => !p.admin && owners(p.id) === 0).slice(0, 1),
  ];
  const pick = (id: string) => { if (id === app.viewer.id) return; app.setViewer(id); nav('/'); };
  return (
    <div className="rolebar">
      <span className="rolebar-label" id="rolebar-label">Viewing as</span>
      {cast.length ? (
        <div className="seg rolebar-seg" role="group" aria-labelledby="rolebar-label">
          {cast.map((p) => <button key={p.id} aria-pressed={app.viewer.id === p.id} onClick={() => pick(p.id)} title={personFacts(p, app)}>{p.name.split(' ')[0]}</button>)}
        </div>
      ) : null}
      <button className="rolebar-person" onClick={onPeople}><Avatar p={app.viewer} size="sm" /><span className="ellipsis">{personFacts(app.viewer, app)}</span><span aria-hidden="true">⌄</span><span className="sr">Switch to someone else</span></button>
      <span className="rolebar-demo">
        <span className="demo-tag">Demo</span>
        {app.ws.kind === 'example' && (resetting
          ? <><button className="linkish" onClick={async () => { await app.resetExample(); setResetting(false); nav('/'); }}>Yes, start over</button><button className="linkish muted" onClick={() => setResetting(false)}>Cancel</button></>
          : <button className="linkish" onClick={() => setResetting(true)}>Start over</button>)}
        <button className="linkish" onClick={onHide} title="Present the demo without this bar; bring it back from the menu">Hide this bar</button>
        <button className="linkish" onClick={() => setNavMode(navMode === 'four' ? 'current' : 'four')} aria-pressed={navMode === 'four'} title="Compare the phone navigation">{navMode === 'four' ? 'Current tabs' : 'Try 4 tabs'}</button>
        <a className="linkish" href="/">Leave</a>
      </span>
    </div>
  );
}

const MOODS = [['good', 'It helps'], ['meh', 'It’s OK'], ['bad', 'It gets in the way']] as const;

/** What someone thinks of the app, from wherever they are. Two taps; the words are optional. */
function FeedbackSheet({ onClose, path }: { onClose: () => void; path: string }) {
  const app = useApp();
  const [mood, setMood] = useState<'good' | 'meh' | 'bad' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!mood || busy) return;
    setBusy(true);
    try { await app.sendFeedback(mood, text, path); app.toast('Thanks. Your admins can read it on Workspace.'); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="How is the app working for you?">
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <div className="seg full" role="group" aria-label="How it's working">
          {MOODS.map(([k, l]) => <button key={k} type="button" aria-pressed={mood === k} onClick={() => setMood(k)}>{l}</button>)}
        </div>
        <label className="field"><span className="field-label">Anything to add? <span className="hint">optional</span></span>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What were you trying to do?" />
        </label>
        <span className="hint">Sent with your name and this screen ({path}).</span>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="submit" disabled={!mood || busy}>Send</button></div>
      </form>
    </Sheet>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const toasts = useToasts();
  const { pathname, search } = useLocation();
  const [sheet, setSheet] = useState<'profile' | 'workspace' | 'more' | 'feedback' | null>(null);
  const ownsGoals = app.snapshot.goals.some((g) => g.ownerId === app.viewer.id);
  const navMode = useNavMode();
  const order = navFor(ownsGoals, navMode);
  // Presenting: the demo without its "Viewing as" bar or Demo tag. Start it with /demo?present (and ?present=0 to stop).
  const [present, setPresentState] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('present');
      if (q !== null) sessionStorage.setItem('goals-present', q === '0' ? '' : '1');
      return sessionStorage.getItem('goals-present') === '1';
    } catch { return false; }
  });
  const setPresent = (on: boolean) => { try { sessionStorage.setItem('goals-present', on ? '1' : ''); } catch { /* private mode */ } setPresentState(on); };
  const due = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today).due.length;
  // A review you're in that's held this week and still has goals to cover.
  const reviewsOpen = app.snapshot.reviews.filter((r) => r.people.includes(app.viewer.id)).map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week)).filter((x) => x.week === Math.max(1, app.week) && x.done < x.total).length;
  const count = (id: NavId) => (id === 'checkin' ? due : id === 'reviews' ? reviewsOpen : 0);
  const tabs = order.slice(0, navMode === 'four' ? 3 : 4);
  const more = order.slice(navMode === 'four' ? 3 : 4);
  const work = useRef<HTMLElement>(null);
  const title = order.filter((id) => isActive(id, pathname)).map((id) => NAV[id].label)[0] ?? (pathname.startsWith('/retro') ? 'Wrap up' : pathname.startsWith('/check-in') ? 'Check-in' : 'Goals');
  // With an on-screen keyboard open (iOS overlays the page instead of resizing it), lift fixed footers and sheets above it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => document.documentElement.style.setProperty('--kb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px');
    set();
    vv.addEventListener('resize', set);
    vv.addEventListener('scroll', set);
    return () => { vv.removeEventListener('resize', set); vv.removeEventListener('scroll', set); };
  }, []);
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo?.(0, 0); work.current?.scrollTo?.(0, 0);
    document.title = `${title} · ${app.ws.name}`;
    // After moving to another page, put focus on its heading so screen readers announce where you are.
    if (first.current) { first.current = false; return; }
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest('nav, .tabbar, .side, .sheet')) return; // a field already took focus
    const h = document.querySelector<HTMLElement>('main h1, .focus h1, .focus-body h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [pathname, title, app.ws.name]);

  const focusMode = /^\/check-in(\/|$)|^\/quick-check-in$|^\/import$|^\/goals\/(new|[^/]+\/edit)$|^\/workspace\/new$|^\/reviews\/(new|[^/]+\/edit)$|^\/retro\/[^/]+$/.test(pathname) || /[?&]review=/.test(search);
  return (
    <div className={'app' + (focusMode ? ' focus-mode' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="mtop">
        <button className="wsbtn" onClick={() => setSheet('workspace')}>
          <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.slice(0, 1).toUpperCase()}</span>
          <span className="sr">Switch workspace ({app.ws.name})</span>
        </button>
        <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
          <strong className="ellipsis">{title}</strong>
          <span className="tiny muted ellipsis">{app.mode === 'demo' && !present && <span className="demo-tag">Demo</span>} {app.ws.kind === 'example' ? 'Example data' : app.ws.name}, {shortPeriod(app.cycle, app.week).toLowerCase()}</span>
        </span>
        <button className="profilebtn" onClick={() => setSheet('profile')}>
          <Avatar p={app.viewer} />
          <span className="sr">{app.mode === 'demo' ? 'Switch person' : 'Not you?'} ({app.viewer.name})</span>
        </button>
      </div>
      <div className="shell">
        <nav className="side" aria-label="Main">
          <button className="wsbtn wide" onClick={() => setSheet('workspace')}>
            <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.slice(0, 1).toUpperCase()}</span>
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.ws.name}</b>
              <span className="tiny muted">{shortPeriod(app.cycle, app.week)}</span>
            </span>
            <span aria-hidden="true" className="muted">⌄</span>
          </button>
          {order.map((id) => (
            <Link key={id} to={NAV[id].to} className="nav" aria-current={isActive(id, pathname) ? 'page' : undefined}>
              {NAV[id].icon}<span>{NAV[id].label}</span>
              {count(id) > 0 && <span className="count">{count(id)}<span className="sr"> to do</span></span>}
            </Link>
          ))}
          <button className="nav feedback-nav" onClick={() => setSheet('feedback')}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg><span>Send feedback</span></button>
          <button className="me" onClick={() => setSheet('profile')}>
            <Avatar p={app.viewer} />
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.viewer.name}</b>
              <span className="tiny muted ellipsis">{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</span>
            </span>
          </button>
        </nav>
        <main className="work" ref={work} id="main">
          {app.mode === 'live' && app.storeKind === 'browser' && <div className="local-banner" role="note">This is a copy kept in this browser only. Nobody else sees changes made here.</div>}
          {!focusMode && app.mode === 'demo' && !present && <DemoBar onPeople={() => setSheet('profile')} onHide={() => setPresent(true)} />}
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((id) => (
          <Link key={id} to={NAV[id].to} aria-current={isActive(id, pathname) ? 'page' : undefined}>
            <span className="tabicon">{NAV[id].icon}{count(id) > 0 && <span className="badge">{count(id)}</span>}</span>
            <span>{NAV[id].label}</span>
          </Link>
        ))}
        <button onClick={() => setSheet('more')} aria-current={more.some((id) => isActive(id, pathname)) ? 'page' : undefined}>
          <span className="tabicon"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg></span>
          <span>More</span>
        </button>
      </nav>
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <div className="stack" style={{ gap: 4 }}>
          {more.map((id) => (
            <Link key={id} to={NAV[id].to} className="menuitem" onClick={() => setSheet(null)}>{NAV[id].icon}<span className="strong">{NAV[id].label}</span></Link>
          ))}
          <button className="menuitem" onClick={() => setSheet('workspace')}>{NAV.workspace.icon}<span className="stack" style={{ gap: 0 }}><span className="strong">Switch workspace</span><span className="tiny muted">{app.ws.name}</span></span></button>
          {app.mode === 'demo' && present && <button className="menuitem" onClick={() => { setPresent(false); setSheet(null); }}><span className="strong">Show the demo bar</span><span className="tiny muted">Switch person, reset or leave the demo</span></button>}
          {app.mode === 'demo' && <button className="menuitem" onClick={() => { setNavMode(navMode === 'four' ? 'current' : 'four'); setSheet(null); }}><span className="strong">{navMode === 'four' ? 'Current tabs' : 'Try 4 tabs'}</span><span className="tiny muted">Demo: compare the phone navigation</span></button>}
          <button className="menuitem" onClick={() => setSheet('feedback')}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg><span className="strong">Send feedback</span></button>
          <button className="menuitem" onClick={() => setSheet('profile')}><Avatar p={app.viewer} size="sm" /><span className="stack" style={{ gap: 0 }}><span className="strong">{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</span><span className="tiny muted">{app.viewer.name}</span></span></button>
        </div>
      </Sheet>
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} onShowDemoBar={app.mode === 'demo' && present ? () => setPresent(false) : undefined} />
      <WorkspaceSheet open={sheet === 'workspace'} onClose={() => setSheet(null)} />
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} path={pathname} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.kind === 'success' ? '✓ ' : ''}{t.text}</div>)}
      </div>
    </div>
  );
}
