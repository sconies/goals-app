import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, matchPath, useLocation } from 'react-router';
import { useModules } from '../core/app';
import { useApp, useToasts } from '../app/state';
import { shortPeriod } from '../domain/year';
import { weekProgress } from '../domain/progress';
import { reviewSession } from '../domain/review';
import type { SavedView } from '../domain/types';
import { Avatar, Sheet } from './bits';
import { DemoEntry, DemoPanel } from './Demo';
import { Coach } from './Coach';
import { ResearchBar } from './ResearchBar';
import { setAppearance, useAppearance } from '../app/appearance';
import { useTrail } from './BackLink';
import { useViews, viewParams } from '../screens/GoalFilters';
import { Icon } from './Icon';
import { FaroLogo, FaroMark } from './Brand';
import { ProfileSheet } from './ProfileSheet';
import { PageHelp } from '../screens/Help';
import { useUnreadNews } from '../help/seen';
import { isGoalTop, ShellTopContext } from './shellTop';
import { MOODS } from '../markup/model';
import { useSwitchWorkspace, WorkspaceSwitchProvider } from './WorkspaceSwitch';

/** Marking up a screen loads only when someone starts one (src/markup). */
const MarkupFlow = lazy(() => import('../markup/Markup'));
/** Ctrl+Shift+M, or Cmd+Shift+M on a Mac: mark up this screen, from anywhere. */
const isMarkupKey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm';
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type NavId = 'home' | 'checkin' | 'watching' | 'reviews' | 'goals' | 'activity' | 'data' | 'new' | 'workspace' | 'settings';
const NAV: Record<NavId, { to: string; label: string; icon: ReactNode }> = {
  home: { to: '/', label: 'Home', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" /><path d="M6.5 13.5v-4h3v4" /></svg> },
  checkin: { to: '/check-in', label: 'Check-in', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.3-3.6" /></svg> },
  watching: { to: '/watching', label: 'Watching', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg> },
  reviews: { to: '/reviews', label: 'Reviews', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10.5" rx="2" /><path d="M2.5 6.5h11M5.5 1.8v2.4M10.5 1.8v2.4" /></svg> },
  goals: { to: '/goals', label: 'Goals', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg> },
  activity: { to: '/activity', label: 'Activity', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" /></svg> },
  data: { to: '/data', label: 'Data', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h11M2.5 10h11M6.5 6.5v7" /></svg> },
  new: { to: '/goals/new', label: 'New goal', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg> },
  workspace: { to: '/workspace', label: 'Workspace', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg> },
  settings: { to: '/settings', label: 'Settings', icon: <Icon name="settings" size={18} /> },
};

/** The sidebar: Goals is a section (Mine, Watching, All and saved views sit under it); check-in only for people who own goals. */
function sideFor(ownsGoals: boolean): NavId[] {
  return ['home', ...(ownsGoals ? ['checkin' as const] : []), 'goals', 'reviews', 'activity', 'data', 'new', 'workspace'];
}
/** The phone's tabs. An owner gets Check-in; someone who owns nothing mostly follows goals, so gets Watching (part of Goals). */
function tabsFor(ownsGoals: boolean): NavId[] {
  return ownsGoals ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'watching', 'reviews'];
}

/** Where you are under Goals: one of its sub-items, or none (a goal page, or not in Goals at all). */
type GoalsAt = 'mine' | 'watching' | 'all' | `view:${string}` | null;
function goalsAt(path: string, search: string, views: SavedView[]): GoalsAt {
  const q = new URLSearchParams(search);
  if (path === '/watching' || (path === '/goals' && q.get('show') === 'watching')) return 'watching';
  if (path !== '/goals') return null;
  const v = views.find((x) => x.params === viewParams(q));
  if (v) return `view:${v.id}`;
  return q.get('show') === 'mine' ? 'mine' : 'all';
}

function isActive(id: NavId, path: string, tabs?: NavId[]) {
  const to = NAV[id].to;
  if (id === 'home') return path === '/';
  // On a phone without a Watching tab, Watching is part of Goals.
  if (id === 'goals') return (path.startsWith('/goals') && path !== '/goals/new') || (path === '/watching' && !!tabs && !tabs.includes('watching'));
  return path === to || path.startsWith(to + '/');
}

/** Views shown under Goals in the sidebar before "more" takes over. */
const SIDE_VIEWS = 6;

/** The top of the person menu: your settings, and the workspaces you can switch between (only when there's more than one). */
function YouMenu({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const switchTo = useSwitchWorkspace();
  return (
    <section className="stack you-menu" style={{ gap: 4 }} aria-label="You">
      <Link className="menuitem" to="/settings" onClick={onClose}>
        <Icon name="settings" size={18} />
        <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">Settings</span><span className="tiny muted">Light or dark, accent colour, sidebar, your AI assistants</span></span>
      </Link>
      {app.workspaces.length > 1 && (
        <div className="stack you-workspaces" style={{ gap: 4 }} role="group" aria-label="Workspaces">
          <span className="field-label">Workspaces</span>
          {app.workspaces.map((w) => (
            <button key={w.id} type="button" className="menuitem" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => { onClose(); switchTo(w.id); }}>
              <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.replace(/^example:\s*/i, '').slice(0, 1).toUpperCase()}</span>
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}><span className="strong">{w.name}</span><span className="tiny muted">{w.kind === 'example' ? 'Example data you can play with and reset' : app.mode === 'demo' ? 'Your own, in this browser' : 'Your workspace'}</span></span>
              {w.id === app.ws.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Open</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}


/** What someone thinks of the app, from wherever they are. Two taps; the words are optional. First, the choice to mark up
    the screen instead: a picture with a drawing on it, for the people building the app. */
function FeedbackSheet({ onClose, onMarkup, path }: { onClose: () => void; onMarkup: () => void; path: string }) {
  const app = useApp();
  const [mood, setMood] = useState<'good' | 'meh' | 'bad' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // Send stays enabled (and reachable by Tab): pressing it with no answer says what's missing rather than greying out.
  const [tried, setTried] = useState(false);
  const send = async () => {
    if (!mood) { setTried(true); document.querySelector<HTMLElement>('.feedback-moods button')?.focus(); return; }
    if (busy) return;
    setBusy(true);
    try { await app.sendFeedback(mood, text, path); app.toast(app.mode === 'demo' ? 'Thanks. It goes to the people building this app.' : 'Thanks. It’s in Feedback, beside Help.'); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="How is the app working for you?">
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <button type="button" className="menuitem markup-choice" onClick={onMarkup}>
          <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="10" rx="1.5" /><path d="M4.5 9.5 7 7l1.5 1.5 3-3" /></svg>
          <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">Mark up this screen</span><span className="tiny muted">Draw on a picture of it and say what should change{MAC ? ' (Cmd+Shift+M)' : ' (Ctrl+Shift+M)'}</span></span>
        </button>
        <span className="field-label">Or say how it’s working</span>
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <div className="seg full feedback-moods" role="group" aria-label="How it's working" aria-describedby={tried && !mood ? 'feedback-choose' : undefined}>
            {MOODS.map(([k, l]) => <button key={k} type="button" aria-pressed={mood === k} onClick={() => setMood(k)}>{l}</button>)}
          </div>
          {tried && !mood && <span id="feedback-choose" className="hint tone-off" role="alert">Choose one first.</span>}
        </div>
        <label className="field"><span className="field-label">Anything to add? <span className="hint">optional</span></span>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What were you trying to do?" />
        </label>
        <span className="hint">Sent with your name and this screen ({path}).</span>
        <div className="sheet-foot"><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" aria-disabled={busy || undefined}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
    </Sheet>
  );
}

/** Goals as a section of the sidebar: Goals itself, then Mine, Watching, All and your saved views (pinned first). */
function GoalsSection({ owns, at, navAt }: { owns: boolean; at: GoalsAt; navAt: string }) {
  const views = useViews();
  const shownViews = views.slice(0, SIDE_VIEWS);
  const cur = (k: GoalsAt) => (at === k ? 'page' as const : undefined);
  // The section itself is the current page only when none of its items is (a goal's own page, say).
  const here = !at && isActive('goals', navAt);
  return (
    <div className={'nav-section' + (at || here ? ' in-section' : '')}>
      <Link to="/goals" className="nav" title="Goals" aria-current={here ? 'page' : undefined}>{NAV.goals.icon}<span>Goals</span></Link>
      <div className="subnav" role="group" aria-label="Goals">
        {owns && <Link to="/goals?show=mine" className="nav sub" title="Your goals" aria-current={cur('mine')}><span>Mine</span></Link>}
        <Link to="/watching" className="nav sub has-icon" title="Watching" aria-current={cur('watching')}><i className="sub-icon" aria-hidden="true">{NAV.watching.icon}</i><span>Watching</span></Link>
        <Link to="/goals" className="nav sub" title="All goals" aria-current={cur('all')}><span>All</span></Link>
        {shownViews.map((v) => (
          <Link key={v.id} to={'/goals?' + v.params} className="nav sub view" title={`${v.name}${v.pinned ? ', pinned for everyone' : ', your saved view'}`} aria-current={cur(`view:${v.id}`)}>
            <span className="ellipsis">{v.name}</span>
          </Link>
        ))}
        {views.length > SIDE_VIEWS && <Link to="/goals" className="nav sub more-views" title="Every saved view is in Views on Goals"><span>{views.length - SIDE_VIEWS} more views</span></Link>}
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return <WorkspaceSwitchProvider><ShellBody>{children}</ShellBody></WorkspaceSwitchProvider>;
}

function ShellBody({ children }: { children: ReactNode }) {
  const app = useApp();
  const toasts = useToasts();
  const { pathname, search } = useLocation();
  useTrail();
  const look = useAppearance();
  const [sheet, setSheet] = useState<'profile' | 'more' | 'feedback' | 'demo' | 'people' | null>(null);
  const [marking, setMarking] = useState(false);
  // Ctrl+Shift+M (Cmd+Shift+M on a Mac), from anywhere: mark up this screen. Any open sheet closes first, so it isn't in the picture.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (!isMarkupKey(e)) return; e.preventDefault(); setSheet(null); setMarking(true); };
    // The Feedback page's Send feedback opens the same sheet as the sidebar's.
    const send = () => setSheet('feedback');
    window.addEventListener('keydown', key);
    window.addEventListener('faro:send-feedback', send);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('faro:send-feedback', send); };
  }, []);
  // In the demo, choosing who you are is part of the demo panel, roles first; opened from a person, it says so.
  const openPeople = () => setSheet(app.mode === 'demo' ? 'people' : 'profile');
  const ownsGoals = app.snapshot.goals.some((g) => g.ownerId === app.viewer.id);
  const side = sideFor(ownsGoals);
  const tabs = tabsFor(ownsGoals);
  const views = useViews();
  // Feature modules (src/core/app.tsx): their navigation items, and the page you're on if it's one of theirs.
  const { screens } = useModules();
  const moduleNav = screens.flatMap((m) => m.navigation ?? []);
  const moduleRoute = screens.flatMap((m) => m.routes ?? []).find((r) => matchPath(r.path, pathname));
  // A release this person hasn't seen: a quiet dot beside Help (and on More, on a phone) until they open What's new.
  const unread = useUnreadNews().length > 0;
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
  // The More sheet: everything not on the tab bar. Goals' own items come first, under its name.
  const all: NavId[] = ['home', ...(ownsGoals ? ['checkin' as const] : []), 'goals', 'watching', 'reviews', 'activity', 'data', 'new', 'workspace'];
  const more = all.filter((id) => !tabs.includes(id) && id !== 'watching');
  const moreGoals = [...(ownsGoals ? [{ key: 'mine', to: '/goals?show=mine', label: 'Mine', hint: 'The goals you own' }] : []), ...(!tabs.includes('watching') ? [{ key: 'watching', to: '/watching', label: 'Watching', hint: 'The goals you follow' }] : []), ...views.slice(0, SIDE_VIEWS).map((v) => ({ key: v.id, to: '/goals?' + v.params, label: v.name, hint: v.pinned ? 'Pinned for everyone' : 'Your saved view' }))];
  const work = useRef<HTMLElement>(null);
  const at = goalsAt(pathname, search, views);
  const title = moduleRoute?.title ? moduleRoute.title : at === 'watching' ? 'Watching' : at === 'mine' ? 'Mine' : pathname === '/settings' ? 'Settings' : pathname === '/feedback' ? 'Feedback' : pathname === '/whats-new' ? 'What’s new' : pathname.startsWith('/help') ? 'Help' : [...side, ...tabs].filter((id) => isActive(id, pathname)).map((id) => NAV[id].label)[0] ?? (pathname.startsWith('/retro') ? 'Wrap up' : pathname.startsWith('/check-in') ? 'Check-in' : pathname.startsWith('/research') ? 'Research' : pathname.startsWith('/quick-check-in') ? 'Check-in' : 'Goals');
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
    document.title = app.ws.name ? `${title} · ${app.ws.name} · Faro` : `${title} · Faro`;
    // After moving to another page, put focus on its heading so screen readers announce where you are.
    if (first.current) { first.current = false; return; }
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest('nav, .tabbar, .side, .sheet')) return; // a field already took focus
    const h = document.querySelector<HTMLElement>('main h1, .focus h1, .focus-body h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [pathname, title, app.ws.name]);

  // Walking a review (a goal page with ?review=) is in Reviews, so Reviews is the current place in the nav.
  const navAt = /[?&]review=/.test(search) ? '/reviews/walk' : at === 'watching' ? '/watching' : pathname;
  const sideAt = /[?&]review=/.test(search) ? null : at;
  const focusMode = !!moduleRoute?.focus || /^\/check-in(\/|$)|^\/quick-check-in$|^\/goals\/(new|[^/]+\/edit)$|^\/workspace\/new$|^\/reviews\/(new|[^/]+\/edit)$|^\/retro\/[^/]+$/.test(pathname) || /[?&]review=/.test(search);
  const icons = look.sidebar === 'icons';
  const wsName = app.ws.name.replace(/^Example:\s*/, '');
  // On a goal's own page, on a phone, its summary bar takes the header's place; the header's controls go with it.
  const goalTop = isGoalTop(pathname, search);
  const topControls = (
    <>
      {app.mode === 'demo' && !present && <DemoEntry compact onOpen={() => setSheet('demo')} />}
      <button className="profilebtn" onClick={openPeople}>
        <Avatar p={app.viewer} />
        <span className="sr">{app.mode === 'demo' ? 'Switch person' : 'Not you?'} ({app.viewer.name})</span>
      </button>
    </>
  );
  return (
    <div className={'app' + (focusMode ? ' focus-mode' : '') + (icons ? ' nav-icons' : '') + (goalTop ? ' goal-top' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="mtop" data-part="Header">
        <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{wsName.slice(0, 1).toUpperCase()}</span>
        <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
          <strong className="ellipsis">{title}</strong>
          <span className="tiny muted ellipsis">{app.ws.kind === 'example' ? 'Example data' : app.ws.name}, {shortPeriod(app.cycle, app.week).replace(/^Week/, 'week')}</span>
        </span>
        {!goalTop && topControls}
      </div>
      <div className="shell">
        <nav className="side" aria-label="Main" data-part="Sidebar">
          {/* The product's name, quietly, above the workspace's: the wordmark in the full sidebar, the F alone on the rail. */}
          <div className="side-brand" title="Faro">
            <FaroLogo size={22} />
            <FaroMark size={28} label={null} />
          </div>
          {/* The workspace's name. Switching (for the few in more than one) is in the person menu at the foot. */}
          <div className="ws-head" title={app.ws.name}>
            <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{wsName.slice(0, 1).toUpperCase()}</span>
            <span className="stack ws-head-text" style={{ gap: 0, minWidth: 0, flex: 1 }}>
              {/* "Example: Platform Engineering" was cut to "Example: Platf…": the name, with "Example" as the quieter line. */}
              <b className="ws-name">{wsName}</b>
              <span className="tiny muted ws-meta">{shortPeriod(app.cycle, app.week)}</span>
            </span>
          </div>
          {side.map((id) => id === 'goals'
            ? <GoalsSection key={id} owns={ownsGoals} at={sideAt} navAt={navAt} />
            : (
              <Fragment key={id}>
                {/* The modules' items come after the core's places, before New goal. */}
                {id === 'new' && moduleNav.map((n) => <Link key={n.id} to={n.to} className="nav" title={n.label} aria-current={navAt === n.to || navAt.startsWith(n.to + '/') ? 'page' : undefined}>{n.icon}<span>{n.label}</span></Link>)}
                <Link to={NAV[id].to} className="nav" title={NAV[id].label} aria-current={isActive(id, navAt) ? 'page' : undefined}>
                  {NAV[id].icon}<span>{NAV[id].label}</span>
                  {count(id) > 0 && <span className="count">{count(id)}<span className="sr"> to do</span></span>}
                </Link>
              </Fragment>
            ))}
          {app.mode === 'demo' && !present && <DemoEntry onOpen={() => setSheet('demo')} />}
          <Link to="/settings" className="nav settings-nav" title="Settings" aria-current={pathname === '/settings' ? 'page' : undefined}>{NAV.settings.icon}<span>Settings</span></Link>
          <Link to="/help" className="nav help-nav" title={unread ? 'Help, and something new in What’s new' : 'Help'} aria-current={/^\/(help|whats-new)(\/|$)/.test(pathname) ? 'page' : undefined}>
            <Icon name="help" size={18} /><span>Help</span>{unread && <><i className="help-dot" aria-hidden="true" /><span className="sr">, something new</span></>}
          </Link>
          {/* Feedback from every workspace and the demo, beside Help: it belongs to no one workspace (backlog WS). */}
          <Link to="/feedback" className="nav inbox-nav" title="Feedback from every workspace and the demo" aria-current={pathname === '/feedback' ? 'page' : undefined}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 9.5 4 3.5h8l1.5 6v3h-11z" /><path d="M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2" /></svg><span>Feedback</span></Link>
          <button className="nav feedback-nav" title="Send feedback" onClick={() => setSheet('feedback')}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg><span>Send feedback</span></button>
          {/* Named by its own words (kept for screen readers on the rail, where they're hidden); the tooltip says the same. */}
          <button className="me" onClick={openPeople} title={`${app.mode === 'demo' ? 'Switch person' : 'Not you?'} (${app.viewer.name})`}>
            <Avatar p={app.viewer} />
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.viewer.name}</b>
              <span className="tiny muted ellipsis">{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</span>
            </span>
          </button>
          <button type="button" className="nav collapse-nav" title={icons ? 'Show the full sidebar' : 'Collapse the sidebar to icons'} aria-pressed={icons} onClick={() => setAppearance({ sidebar: icons ? 'full' : 'icons' })}>
            <Icon name={icons ? 'sidebar-expand' : 'sidebar-collapse'} size={18} /><span>{icons ? 'Show the full sidebar' : 'Collapse sidebar'}</span>
          </button>
        </nav>
        <main className="work" ref={work} id="main">
          {app.mode === 'live' && app.storeKind === 'browser' && <div className="local-banner" role="note">This is a copy kept in this browser only. Nobody else sees changes made here.</div>}
          {app.saveNote && <div className="local-banner save-note" role="alert">{app.saveNote}</div>}
          {app.opening
            ? <div className="page narrow ws-opening" aria-busy="true"><p className="muted" role="status">Opening {app.opening.name}…</p></div>
            : <ShellTopContext.Provider value={goalTop ? topControls : null}>{children}</ShellTopContext.Provider>}
          <PageHelp />
        </main>
      </div>
      <nav className="tabbar" aria-label="Main" data-part="Tab bar">
        {tabs.map((id) => (
          <Link key={id} to={NAV[id].to} aria-current={isActive(id, navAt, tabs) ? 'page' : undefined}>
            <span className="tabicon">{NAV[id].icon}{count(id) > 0 && <span className="badge">{count(id)}</span>}</span>
            <span>{NAV[id].label}</span>
          </Link>
        ))}
        <button onClick={() => setSheet('more')} aria-current={more.some((id) => isActive(id, navAt)) || /^\/(settings|help|whats-new|feedback)(\/|$)/.test(pathname) ? 'page' : undefined}>
          <span className="tabicon"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg>{unread && <i className="help-dot" aria-hidden="true" />}</span>
          <span>More</span>
        </button>
      </nav>
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <div className="stack" style={{ gap: 4 }}>
          {moreGoals.length > 0 && (
            <div className="stack more-goals" style={{ gap: 4 }} role="group" aria-label="Goals">
              <span className="field-label">Goals</span>
              {moreGoals.map((g) => (
                <Link key={g.key} to={g.to} className="menuitem" onClick={() => setSheet(null)}>{g.key === 'watching' ? NAV.watching.icon : NAV.goals.icon}<span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">{g.label}</span><span className="tiny muted">{g.hint}</span></span></Link>
              ))}
            </div>
          )}
          {moreGoals.length > 0 && <span className="field-label more-rest">More</span>}
          {more.map((id) => (
            <Link key={id} to={NAV[id].to} className="menuitem" onClick={() => setSheet(null)}>{NAV[id].icon}<span className="strong">{NAV[id].label}</span></Link>
          ))}
          {moduleNav.map((n) => <Link key={n.id} to={n.to} className="menuitem" onClick={() => setSheet(null)}>{n.icon}<span className="strong">{n.label}</span></Link>)}
          <Link className="menuitem" to="/settings" onClick={() => setSheet(null)}><Icon name="settings" size={18} /><span className="stack" style={{ gap: 0 }}><span className="strong">Settings</span><span className="tiny muted">Light or dark, accent colour, your AI assistants</span></span></Link>
          <Link className="menuitem more-help" to="/help" onClick={() => setSheet(null)}><Icon name="help" size={18} /><span className="stack" style={{ gap: 0 }}><span className="strong">Help{unread && <><i className="help-dot" aria-hidden="true" /><span className="sr">, something new</span></>}</span><span className="tiny muted">What everything does, and what’s new</span></span></Link>
          <Link className="menuitem more-inbox" to="/feedback" onClick={() => setSheet(null)}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 9.5 4 3.5h8l1.5 6v3h-11z" /><path d="M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2" /></svg><span className="stack" style={{ gap: 0 }}><span className="strong">Feedback</span><span className="tiny muted">From every workspace and the demo</span></span></Link>
          {app.mode === 'demo' && <button className="menuitem" onClick={() => { setPresent(false); setSheet('demo'); }}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 2" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="2" /></svg><span className="stack" style={{ gap: 0 }}><span className="strong">Demo controls</span><span className="tiny muted">See it as someone else, walkthroughs, research, reset</span></span></button>}
          <button className="menuitem" onClick={() => setSheet('feedback')}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg><span className="strong">Send feedback</span></button>
          <button className="menuitem" onClick={openPeople}><Avatar p={app.viewer} size="sm" /><span className="stack" style={{ gap: 0 }}><span className="strong">{app.mode === 'demo' ? 'Switch person' : 'Not you?'}</span><span className="tiny muted">{app.viewer.name}{app.workspaces.length > 1 ? ', and switch workspace' : ''}</span></span></button>
        </div>
      </Sheet>
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)}><YouMenu onClose={() => setSheet(null)} /></ProfileSheet>
      {(sheet === 'demo' || sheet === 'people') && (
        <DemoPanel onClose={() => setSheet(null)} onPresent={() => setPresent(true)} title={sheet === 'people' ? 'Switch person' : 'Demo'}>
          {sheet === 'people' ? <YouMenu onClose={() => setSheet(null)} /> : null}
        </DemoPanel>
      )}
      {app.mode === 'demo' && <Coach />}
      <ResearchBar />
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} onMarkup={() => { setSheet(null); setMarking(true); }} path={pathname} />}
      {marking && <Suspense fallback={null}><MarkupFlow onClose={() => setMarking(false)} /></Suspense>}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind + (t.action ? ' with-action' : '')}>
            <span className="toast-text">{t.text}</span>
            {t.action && <button type="button" className="toast-action" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
