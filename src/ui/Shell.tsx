import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router';
import { useModules } from '../core/app';
import { feedbackOn, reviewsOn } from '../app/reads';
import { useApp, useToasts } from '../app/state';
import { weekProgress } from '../domain/progress';
import { reviewSession, sessionToDo } from '../domain/review';
import type { SavedView } from '../domain/types';
import { Avatar, Sheet } from './bits';
import { CORE_NAV, GROUP_NAMES, isForm, litItem, litTab, menuGroups, menuViews, moreFor, pageName, phoneTabs, rowDrawn, type NavId } from '../domain/navigation';
import { recentsOf, usePrefs } from '../app/search';
import { DemoEntry, DemoPanel } from './Demo';
import { ResearchBar } from './ResearchBar';
import { setAppearance, useAppearance } from '../app/appearance';
import { usePlaceNames, useTrail } from './BackLink';
import { useViews, viewParams } from '../screens/savedViews';
import { Icon } from './Icon';
import { FaroLogo, FaroMark } from './Brand';
import { ProfileSheet } from './ProfileSheet';
import { RailLabel } from './Label';
import { PageHelp } from './HelpLinks';
import { useUnreadNews } from '../help/seen';
import { isGoalTop, ShellTopContext } from './shellTop';
import { MOODS } from '../markup/model';
import { WorkspaceSwitcher, WorkspaceSwitchProvider } from './WorkspaceSwitch';
import { Find, FIND_KEY, isFindKey } from './Find';

/** Marking up a screen loads only when someone starts one (src/markup). */
const MarkupFlow = lazy(() => import('../markup/Markup'));
// The walkthrough coach is the demo's only, and only while a walkthrough runs: it loads after the first page (the bundle
// budget, scripts/check-bundle.mjs).
const Coach = lazy(() => import('./Coach').then((m) => ({ default: m.Coach })));
/** Ctrl+Shift+M, or Cmd+Shift+M on a Mac: mark up this screen, from anywhere. */
const isMarkupKey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm';
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The core's menu items as drawn: the rule's words and address (src/domain/navigation.ts) with an icon. */
const ICONS: Record<NavId, { icon: ReactNode }> = {
  home: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" /><path d="M6.5 13.5v-4h3v4" /></svg> },
  checkin: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.3-3.6" /></svg> },
  watching: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg> },
  reviews: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10.5" rx="2" /><path d="M2.5 6.5h11M5.5 1.8v2.4M10.5 1.8v2.4" /></svg> },
  goals: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg> },
  activity: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" /></svg> },
  people: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /><path d="M10.5 3.2a2.5 2.5 0 0 1 0 4.6M12 9.8c1.6.5 2.5 1.8 2.5 3.7" /></svg> },
  data: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h11M2.5 10h11M6.5 6.5v7" /></svg> },
  new: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg> },
  workspace: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg> },
  settings: { icon: <Icon name="settings" size={18} /> },
  help: { icon: <Icon name="help" size={18} /> },
  feedback: { icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 9.5 4 3.5h8l1.5 6v3h-11z" /><path d="M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2" /></svg> },
};

const NAV = Object.fromEntries((Object.keys(ICONS) as NavId[]).map((id) => [id, { ...CORE_NAV[id], icon: ICONS[id].icon }])) as unknown as Record<NavId, { to: string; label: string; icon: ReactNode }>;

/** Views shown under Goals in the sidebar before "more" takes over. */

/** The top of the person menu: your settings. It's only about people: workspaces are switched from the sidebar's header (backlog WS). */
function YouMenu({ onClose }: { onClose: () => void }) {
  return (
    <section className="stack you-menu" style={{ gap: 4 }} aria-label="You">
      <Link className="menuitem" to="/settings" onClick={onClose}>
        <Icon name="settings" size={18} />
        <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">Settings</span><span className="tiny muted">Light or dark, accent colour, sidebar, your MCP access</span></span>
      </Link>
    </section>
  );
}


/** What someone thinks of the app, from wherever they are. Two taps; the words are optional. First, the choice to mark up
    the screen instead: a picture with a drawing on it, for the people building the app. */
function FeedbackSheet({ onClose, onMarkup, path, fromPage }: { onClose: () => void; onMarkup: () => void; path: string; fromPage?: boolean }) {
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
          <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">{fromPage ? 'Mark up the last screen' : 'Mark up this screen'}</span><span className="tiny muted">{fromPage ? 'Go back to it, draw' : 'Draw'} on a picture of it and say what should change{MAC ? ' (Cmd+Shift+M)' : ' (Ctrl+Shift+M)'}</span></span>
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

/** Goals in the sidebar, and under it up to four saved views (navigation rule 1): no Mine, Watching or All. */
function GoalsSection({ lit, views, label }: { lit: string | null; views: SavedView[]; label: (text: string) => { 'data-label': string } }) {
  const cur = (k: string) => (lit === k ? 'page' as const : undefined);
  // Goals is lit unless one of its views is the page you're on (navigation rule 3).
  const here = lit === 'goals';
  return (
    <div className={'nav-section' + (here || lit?.startsWith('view:') ? ' in-section' : '')}>
      <Link to="/goals" className="nav" {...label('Goals')} aria-current={here ? 'page' : undefined}>{NAV.goals.icon}<span>Goals</span></Link>
      {views.length > 0 && (
        <div className="subnav" role="group" aria-label="Saved views">
          {views.map((v) => (
            <Link key={v.id} to={'/goals?' + v.params} className="nav sub view" {...label(`${v.name}${v.pinned ? ', pinned for everyone' : ', your saved view'}`)} aria-current={cur(`view:${v.id}`)}>
              <span className="ellipsis">{v.name}</span>
            </Link>
          ))}
        </div>
      )}
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
  // Find from anywhere (find spec, 2.4): the sidebar's Find, the phone's Find button, or Ctrl K (Cmd K on a Mac).
  const [finding, setFinding] = useState(false);
  // Feedback is one item (WR5): its page's Send feedback opens the sheet, which records the page you came from.
  // Marking up from there goes back to that page first, then draws on it (a phone has no Ctrl+Shift+M).
  const cameFrom = useRef({ path: '/', to: '' });
  const markAfter = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (pathname === '/feedback') return;
    cameFrom.current = { path: pathname, to: pathname + search };
    if (!markAfter.current) return;
    markAfter.current = false;
    const t = window.setTimeout(() => setMarking(true), 400);
    return () => window.clearTimeout(t);
  }, [pathname, search]);
  // Feedback switched off (SW1): no sheet, no markup and no key. The ref keeps the listener below current.
  const { screens, on, installed } = useModules();
  const feedback = feedbackOn(on);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  // Ctrl+Shift+M (Cmd+Shift+M on a Mac), from anywhere: mark up this screen. Any open sheet closes first, so it isn't in the picture.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isFindKey(e)) { e.preventDefault(); setSheet(null); setFinding((f) => !f); return; }
      if (!isMarkupKey(e) || !feedbackRef.current) return; e.preventDefault(); setSheet(null); setFinding(false); setMarking(true);
    };
    // The Feedback page's Send feedback opens the sheet (Feedback is the one menu item for it, WR5).
    const send = () => setSheet('feedback');
    window.addEventListener('keydown', key);
    window.addEventListener('faro:send-feedback', send);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('faro:send-feedback', send); };
  }, []);
  // In the demo, choosing who you are is part of the demo panel, roles first; opened from a person, it says so.
  const openPeople = () => setSheet(app.mode === 'demo' ? 'people' : 'profile');
  // Check-in is in the menu for someone with a goal to check in on: one of theirs, not stopped or done (rule 1).
  const ownsGoals = app.snapshot.goals.some((g) => g.ownerId === app.viewer.id && !g.stoppedAt && app.statusOf(g).status !== 'done');
  const views = useViews();
  const prefs = usePrefs();
  // A module's row waits for its first record (SM1, rule 1); once drawn it stays until the next visit.
  const drawnOnce = useRef(new Set<string>());
  const moduleNav = screens.flatMap((m) => m.navigation ?? []).filter((n) => {
    const facts = installed.find((f) => f.navigation.includes(n.label));
    const key = facts?.menu?.waitsFor;
    if (rowDrawn(key, facts && key ? app.snapshot.modules?.[facts.id]?.[key] : undefined)) drawnOnce.current.add(n.id);
    return drawnOnce.current.has(n.id);
  });
  // Reviews switched off (FT2): no row, no count and no tab.
  const reviews = reviewsOn(on);
  const groups = menuGroups(ownsGoals, moduleNav, reviews, feedback);
  const tabs = phoneTabs(ownsGoals, reviews);
  const more = moreFor(groups, tabs);
  const shownViews = menuViews(views.map((v) => ({ id: v.id, name: v.name, pinned: v.pinned, mine: v.personId === app.viewer.id, createdAt: v.createdAt })), recentsOf(prefs, app.ws.id, app.viewer.id).filter((r) => r.kind === 'view').map((r) => r.id)).map((m) => views.find((v) => v.id === m.id)!);
  /** The app's own label on the collapsed rail (hover after a moment, at once on focus): the row's full words. */
  const label = (text: string) => ({ 'data-label': text });
  // Feature modules (src/core/app.tsx): their navigation items, and the page you're on if it's one of theirs.
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
  // A review you're in that's held this week, still has goals to cover, and has something to review (review.sessionToDo).
  const reviewsOpen = !reviews ? 0 : app.snapshot.reviews.filter((r) => r.people.includes(app.viewer.id)).map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week)).filter((x) => sessionToDo(x, app.snapshot, app.week, app.today)).length;
  const count = (id: NavId) => (id === 'checkin' ? due : id === 'reviews' ? reviewsOpen : 0);
  const team = app.viewer.teamId ? app.team(app.viewer.teamId)?.name ?? '' : '';
  const work = useRef<HTMLElement>(null);
  // The page's name (navigation rule 2): the browser's title and the phone's top bar. Goals is "Goals" on every tab.
  const names = usePlaceNames();
  const title = pageName(pathname, search, names);
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

  // A form is focus mode (navigation's one rule, which Back reads too); so is a module's focus page and a review's walk,
  // which isn't a form (what was said is saved as it is said). Check-in's list keeps the sidebar (NV3).
  const focusMode = !!moduleRoute?.focus || isForm(pathname, search) || (reviews && /[?&]review=/.test(search));
  const icons = look.sidebar === 'icons';
  // The rail: chosen, or always between 761 and 1100 px. Its rows name themselves with the app's label.
  const sideRef = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.innerWidth > 1100);
  useEffect(() => { const f = () => setWide(window.innerWidth > 1100); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const rail = icons || !wide;
  // On a goal's own page, on a phone, its summary bar takes the header's place; the header's controls go with it.
  const goalTop = isGoalTop(pathname, search);
  const topControls = (
    <>
      <button type="button" className="btn find-btn" onClick={() => setFinding(true)}><Icon name="search" size={18} /><span>Find</span></button>
      {app.mode === 'demo' && !present && <DemoEntry compact onOpen={() => setSheet('demo')} />}
      <button className="profilebtn" onClick={openPeople}>
        <Avatar p={app.viewer} />
        <span className="sr">{app.mode === 'demo' ? 'Switch person' : 'Not you?'} ({app.viewer.name}{app.viewer.admin ? ', admin here' : ''})</span>
      </button>
    </>
  );

  // The one lit item (navigation rule 3): core items, modules' and saved views alike; a goal in a review's walk lights Reviews.
  const lit = litItem(pathname, search, [...groups.work, ...groups.lookup, ...groups.make, ...groups.you], moduleNav, shownViews.map((v) => ({ id: v.id, params: v.params })), viewParams);
  const tabLit = litTab(lit, tabs);
  const row = (id: string) => {
    if (id === 'goals') return <GoalsSection key={id} lit={lit} views={shownViews} label={label} />;
    const m = id.startsWith('module:') ? moduleNav.find((n) => `module:${n.id}` === id) : null;
    if (m) return <Link key={id} to={m.to} className="nav" {...label(m.label)} aria-current={lit === id ? 'page' : undefined}>{m.icon}<span>{m.label}</span></Link>;
    const n = id as NavId;
    const words = n === 'help' && unread ? 'Help, something new' : count(n) > 0 ? `${NAV[n].label}, ${count(n)} to do` : NAV[n].label;
    return (
      <Link key={id} to={NAV[n].to} className={'nav' + (n === 'settings' ? ' settings-nav' : n === 'help' ? ' help-nav' : n === 'feedback' ? ' inbox-nav' : '')} {...label(words)} aria-current={lit === id ? 'page' : undefined}>
        {NAV[n].icon}<span>{NAV[n].label}</span>
        {n === 'help' && unread && <><i className="help-dot" aria-hidden="true" /><span className="sr">, something new</span></>}
        {count(n) > 0 && <span className="count">{count(n)}<span className="sr"> to do</span></span>}
      </Link>
    );
  };
  return (
    <div className={'app' + (focusMode ? ' focus-mode' : '') + (icons ? ' nav-icons' : '') + (goalTop ? ' goal-top' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="mtop" data-part="Header">
        {/* Faro's F, not the workspace's initial (Lane, 9 Nov): the workspace is named beside it. */}
        <FaroMark size={30} />
        <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
          <strong className="ellipsis">{title.split(' · ')[0]}</strong>
          <WorkspaceSwitcher variant="top" />
        </span>
        {!goalTop && topControls}
      </div>
      <div className="shell">
        <nav className="side" aria-label="Main" data-part="Sidebar" ref={sideRef}>
          {/* The product's name, quietly, above the workspace's: the wordmark in the full sidebar, the F alone on the rail. */}
          <div className="side-brand">
            <FaroLogo size={22} />
            {/* On the rail the F opens the workspace switcher (small workspaces SM4). */}
            <WorkspaceSwitcher variant="rail" />
            <button type="button" className="iconbtn collapse-nav" aria-label={icons ? 'Show the full sidebar' : 'Collapse the sidebar'} {...label(icons ? 'Show the full sidebar' : 'Collapse the sidebar')} aria-pressed={icons} onClick={() => setAppearance({ sidebar: icons ? 'full' : 'icons' })}>
              <Icon name={icons ? 'sidebar-expand' : 'sidebar-collapse'} size={18} />
            </button>
          </div>
          {/* The workspace switcher (backlog WS): the open workspace's name, and every workspace, in one place. */}
          <WorkspaceSwitcher variant="side" />
          {/* Find, drawn as a field with its key (find spec 2.4); on the rail, its icon. */}
          <button type="button" className="nav find-nav" onClick={() => setFinding(true)} {...label(`Find (${FIND_KEY})`)} aria-keyshortcuts={MAC ? 'Meta+K' : 'Control+K'}>
            <Icon name="search" size={18} /><span>Find</span><kbd className="find-key" aria-hidden="true">{FIND_KEY}</kbd>
          </button>
          {(['work', 'lookup', 'make', 'you'] as const).map((g) => (
            <div key={g} className={'nav-group nav-group-' + g} role="group" aria-label={GROUP_NAMES[g]}>
              {groups[g].map(row)}
            </div>
          ))}
          {/* The demo's controls, quietly, until "You" alone opens the Demo panel (navigation spec 2.1; kept for now, 12 Nov). */}
          {app.mode === 'demo' && !present && <DemoEntry onOpen={() => setSheet('demo')} />}
          {/* You: your name and role here; in the demo it switches person. */}
          <button className="me" onClick={openPeople} {...label(`${app.viewer.name}${app.viewer.admin ? ', admin here' : ''}: ${app.mode === 'demo' ? 'the demo, and switch person' : 'Not you?'}`)}>
            <Avatar p={app.viewer} />
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.viewer.name}</b>
              <span className="tiny muted ellipsis">{app.viewer.admin ? <><span className="role-word">Admin</span>{team ? ' · ' : ''}</> : null}{team || (app.viewer.admin ? '' : 'No team')}</span>
            </span>
          </button>
        </nav>
        <RailLabel within={sideRef} on={rail} />
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
          <Link key={id} to={NAV[id].to} aria-current={tabLit === id ? 'page' : undefined}>
            <span className="tabicon">{NAV[id].icon}{count(id) > 0 && <span className="badge">{count(id)}</span>}</span>
            <span>{NAV[id].label}</span>
          </Link>
        ))}
        <button onClick={() => setSheet('more')} aria-current={tabLit === 'more' ? 'page' : undefined}>
          <span className="tabicon"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg>{unread && <i className="help-dot" aria-hidden="true" />}</span>
          <span>More</span>
        </button>
      </nav>
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <div className="stack" style={{ gap: 4 }} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setSheet(null); }}>
          {(['lookup', 'make', 'you'] as const).filter((g) => more[g].length).map((g) => (
            <div key={g} className="stack more-group" style={{ gap: 4 }} role="group" aria-label={GROUP_NAMES[g]}>
              <span className="field-label">{GROUP_NAMES[g]}</span>
              {more[g].map((id) => {
                const m = id.startsWith('module:') ? moduleNav.find((n) => `module:${n.id}` === id) : null;
                if (m) return <Link key={id} to={m.to} className="menuitem">{m.icon}<span className="strong">{m.label}</span></Link>;
                const n = id as NavId;
                return <Link key={id} to={NAV[n].to} className={'menuitem' + (n === 'help' ? ' more-help' : n === 'feedback' ? ' more-inbox' : '')}>{NAV[n].icon}<span className="strong">{NAV[n].label}{n === 'help' && unread && <><i className="help-dot" aria-hidden="true" /><span className="sr">, something new</span></>}</span></Link>;
              })}
            </div>
          ))}
          {app.mode === 'demo' && <button className="menuitem" onClick={() => { setPresent(false); setSheet('demo'); }}><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 2" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="2" /></svg><span className="stack" style={{ gap: 0 }}><span className="strong">Demo</span><span className="tiny muted">Switch person, walkthroughs, start over</span></span></button>}
          <button className="menuitem" onClick={openPeople}><Avatar p={app.viewer} size="sm" /><span className="stack" style={{ gap: 0 }}><span className="strong">{app.viewer.name}</span><span className="tiny muted">{app.viewer.admin ? `Admin${team ? ' · ' + team : ''}` : team || 'No team'}</span></span></button>
        </div>
      </Sheet>
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)}><YouMenu onClose={() => setSheet(null)} /></ProfileSheet>
      {(sheet === 'demo' || sheet === 'people') && (
        <DemoPanel onClose={() => setSheet(null)} onPresent={() => setPresent(true)} title={sheet === 'people' ? 'Switch person' : 'Demo'}>
          {sheet === 'people' ? <YouMenu onClose={() => setSheet(null)} /> : null}
        </DemoPanel>
      )}
      {app.mode === 'demo' && <Suspense fallback={null}><Coach /></Suspense>}
      <ResearchBar />
      {feedback && sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} fromPage={pathname === '/feedback' && !!cameFrom.current.to}
        onMarkup={() => { setSheet(null); if (pathname === '/feedback' && cameFrom.current.to) { markAfter.current = true; void navigate(cameFrom.current.to); } else setMarking(true); }}
        path={pathname === '/feedback' ? cameFrom.current.path : pathname} />}
      {finding && <Find onClose={() => setFinding(false)} />}
      {feedback && marking && <Suspense fallback={null}><MarkupFlow onClose={() => setMarking(false)} /></Suspense>}
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
