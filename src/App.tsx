import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AppProvider, useApp, useSetup } from './app/state';
import type { Mode, Store } from './data/store';
import type { Clock, Identity } from './ports';
import { Home } from './screens/Home';
import { movedTo } from './domain/directory';
import { Shell } from './ui/Shell';
import { MotionLayer } from './ui/Count';
import { PageWait } from './ui/bits';
import { Find } from './ui/Find';
import { ErrorBoundary, TelemetryRoutes } from './telemetry/react';
import { Moved, useModules } from './core/app';
import { reviewsOn } from './app/reads';
import { SwitchedOffLine } from './ui/SwitchedOff';

// Every page but Home loads when it is first opened (the first download, R4's 300 KB; scripts/check-bundle.mjs): a
// first visit lands on Home, and a link to another page fetches that page's part as it opens.
const Activity = lazy(() => import('./screens/Activity').then((m) => ({ default: m.Activity })));
const CheckInFlow = lazy(() => import('./screens/CheckInFlow').then((m) => ({ default: m.CheckInFlow })));
const GoalScreen = lazy(() => import('./screens/GoalScreen').then((m) => ({ default: m.GoalScreen })));
const GoalsScreen = lazy(() => import('./screens/GoalsScreen').then((m) => ({ default: m.GoalsScreen })));
const Watching = lazy(() => import('./screens/Watching').then((m) => ({ default: m.Watching })));
const PeopleList = lazy(() => import('./screens/People').then((m) => ({ default: m.PeopleList })));
const PersonPage = lazy(() => import('./screens/People').then((m) => ({ default: m.PersonPage })));
const TeamPage = lazy(() => import('./screens/People').then((m) => ({ default: m.TeamPage })));
const TeamsList = lazy(() => import('./screens/People').then((m) => ({ default: m.TeamsList })));
const QuickCheckIn = lazy(() => import('./screens/QuickCheckIn').then((m) => ({ default: m.QuickCheckIn })));
// Screens a first visit never needs load when first opened, to keep the first download small (AX4; the bundle budget
// is scripts/check-bundle.mjs).
// Screens a first visit doesn't open load when they are opened (the bundle budget, scripts/check-bundle.mjs).
const Research = lazy(() => import('./screens/Research').then((m) => ({ default: m.Research })));
// Set-up (a new workspace, and the welcome of an empty one) is opened once, not on a usual first visit.
const Onboarding = lazy(() => import('./screens/Onboarding').then((m) => ({ default: m.Onboarding })));
// Welcome, an invitation and saying who you are (set-up spec ST1): once per person, never on an everyday visit.
const Welcome = lazy(() => import('./screens/Welcome').then((m) => ({ default: m.Welcome })));
const Join = lazy(() => import('./screens/Start').then((m) => ({ default: m.Join })));
const WhoAreYou = lazy(() => import('./screens/Start').then((m) => ({ default: m.WhoAreYou })));
const Ready = lazy(() => import('./screens/Start').then((m) => ({ default: m.Ready })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const MotionLab = lazy(() => import('./ui/MotionLab').then((m) => ({ default: m.MotionLab })));
// Help and What's new carry the whole guide and every release (about 200 KB): the first download has only their index.
const HelpHome = lazy(() => import('./screens/Help').then((m) => ({ default: m.HelpHome })));
const HelpArticle = lazy(() => import('./screens/Help').then((m) => ({ default: m.HelpArticle })));
const WhatsNew = lazy(() => import('./screens/Help').then((m) => ({ default: m.WhatsNew })));
const DataTables = lazy(() => import('./screens/DataTables').then((m) => ({ default: m.DataTables })));
const WorkspaceHome = lazy(() => import('./screens/Workspace').then((m) => ({ default: m.WorkspaceHome })));
const Feedback = lazy(() => import('./screens/Feedback').then((m) => ({ default: m.Feedback })));
// Changing a goal is opened by its owner now and then, never on a first visit.
const GoalEdit = lazy(() => import('./screens/GoalEdit').then((m) => ({ default: m.GoalEdit })));
const GoalWizard = lazy(() => import('./screens/GoalWizard').then((m) => ({ default: m.GoalWizard })));
const GoalPrint = lazy(() => import('./screens/Print').then((m) => ({ default: m.GoalPrint })));
const WrapUp = lazy(() => import('./screens/Retro').then((m) => ({ default: m.WrapUp })));
const StartNext = lazy(() => import('./screens/StartNext').then((m) => ({ default: m.StartNext })));
const RetroGoal = lazy(() => import('./screens/Retro').then((m) => ({ default: m.RetroGoal })));

export function Routed() {
  const app = useApp();
  const { pathname, search, hash } = useLocation();
  // The feature modules that are on here add their routes, and lead their old addresses on (src/core/app.tsx).
  const modules = useModules();
  // Welcome and an invitation stand on their own, outside the shell, whoever is (or isn't) chosen here yet.
  if (pathname === '/welcome') return <Suspense fallback={null}><Welcome /></Suspense>;
  if (pathname.startsWith('/join/')) return <Suspense fallback={null}><Routes><Route path="/join/:workspaceId/*" element={<Join />} /></Routes></Suspense>;
  // Setting up another workspace needs no name here: someone who opened an invitation and went no further isn't held at
  // its arrival (review of #285, medium 1).
  if (!app.viewerChosen && pathname === '/workspace/new') return <Suspense fallback={null}><SetUp /></Suspense>;
  if (!app.viewerChosen) return <Suspense fallback={null}><WhoAreYou /></Suspense>;
  // With Reviews switched off (FT2), a goal's or Goals' address that names a review (?review=) opens without it.
  const q = new URLSearchParams(search);
  if (q.has('review') && /^\/goals(\/[^/]+)?$/.test(pathname) && !reviewsOn(modules.on)) { q.delete('review'); const rest = q.toString(); return <Navigate to={pathname + (rest ? '?' + rest : '') + hash} replace />; }
  return (
    <Shell>
      <MotionLayer />
      <Suspense fallback={null}><MotionLab /></Suspense>
      {/* A crash on one page is recorded and offers a way on; moving to another page starts afresh. */}
      <ErrorBoundary at={pathname}>
      <Suspense fallback={<PageWait />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check-in" element={<CheckInFlow />} />
        <Route path="/quick-check-in" element={<QuickCheckIn />} />
        <Route path="/research" element={<Research />} />
        <Route path="/check-in/:goalId" element={<CheckInFlow />} />
        {/* Watching is a scope of Goals (goals spec, section 1): the old address keeps its other parts. */}
        <Route path="/watching" element={<Watching />} />
        <Route path="/retro" element={<WrapUp />} />
        <Route path="/retro/:goalId" element={<RetroGoal />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/goals/new" element={<GoalWizard />} />
        <Route path="/goals/new/:step" element={<GoalWizard />} />
        <Route path="/goals/:goalId" element={<GoalScreen />} />
        <Route path="/goals/:goalId/edit" element={<GoalEdit />} />
        <Route path="/goals/:goalId/print" element={<GoalPrint />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/data" element={<DataTables />} />
        <Route path="/workspace" element={<WorkspaceHome />} />
        <Route path="/workspace/new" element={<Onboarding />} />
        {/* Workspace's sections (backlog W); a module's sections are added with its routes below. */}
        <Route path="/workspace/overview" element={<MovedFrom />} />
        {/* People and Teams have places of their own (app redesign WR1); their old addresses lead there (domain/directory movedTo). */}
        <Route path="/workspace/people" element={<MovedFrom />} />
        <Route path="/workspace/teams" element={<MovedFrom />} />
        <Route path="/people" element={<PeopleList />} />
        <Route path="/people/:personId" element={<PersonPage />} />
        <Route path="/teams" element={<TeamsList />} />
        <Route path="/teams/:teamId" element={<TeamPage />} />
        {/* The inbox moved out of Workspace to Feedback (backlog WS): its old address, with the markup it named, leads there. */}
        <Route path="/workspace/inbox" element={<Moved to="/feedback" />} />
        {/* An inbox link someone guessed or kept (/demo/inbox gave Page not found, 12 Nov): the same place. */}
        <Route path="/inbox" element={<Moved to="/feedback" />} />
        <Route path="/feedback" element={<Feedback onSend={() => window.dispatchEvent(new Event('faro:send-feedback'))} />} />
        <Route path="/workspace/cycles/next" element={<StartNext />} />
        <Route path="/workspace/cycles" element={<WorkspaceHome section="cycles" />} />
        <Route path="/workspace/access" element={<WorkspaceHome section="access" />} />
        <Route path="/workspace/features" element={<WorkspaceHome section="features" />} />
        <Route path="/workspace/privacy" element={<WorkspaceHome section="privacy" />} />
        <Route path="/workspace/removed" element={<WorkspaceHome section="removed" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<HelpHome />} />
        <Route path="/help/:id" element={<HelpArticle />} />
        <Route path="/whats-new" element={<WhatsNew />} />
        <Route path="/ready" element={<Ready />} />
        {modules.screens.flatMap((m) => (m.routes ?? []).map((r) => <Route key={r.path} path={r.path} element={r.element} />))}
        {modules.screens.flatMap((m) => (m.sections ?? []).map((x) => <Route key={x.id} path={'/workspace/' + x.id} element={<WorkspaceHome section={x.id} />} />))}
        {modules.redirects.map(([from, to]) => <Route key={from} path={from} element={<Moved to={to} />} />)}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </Shell>
  );
}

/** `clock` is the real time (the Clock port, the system's by default); `today` pins the app's day for the demo and the evals. */
export function App({ store, identity, mode = 'demo', clock, today }: { store: Store; identity?: Identity; mode?: Mode; clock?: Clock; today?: () => Date }) {
  return (
    <BrowserRouter basename={mode === 'demo' ? '/demo' : undefined}>
      <OldInvitation />
      <AppProvider store={store} identity={identity} mode={mode} clock={clock} today={today} empty={() => <Outside />}>
        <TelemetryRoutes />
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}

/**
 * With no workspace open (none yet, none chosen on this device, or an invitation to one that isn't there): Welcome, an
 * invitation, and set-up work at their own addresses; anything else leads to Welcome (set-up spec, section 1).
 */
function Outside() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/join/:workspaceId/*" element={<Join />} />
        <Route path="/workspace/new" element={<SetUp />} />
        {/* Just made: the workspace is opening, and /ready draws once it has. */}
        <Route path="/ready" element={<ToWelcome after={1500} />} />
        <Route path="*" element={<ToWelcome />} />
      </Routes>
    </Suspense>
  );
}

/** Set-up with nothing open: closing it goes back to Welcome. */
function SetUp() {
  const nav = useNavigate();
  return <Onboarding onClose={() => nav('/welcome')} />;
}

/** On to Welcome, keeping the demo's date and the store (`today=`, `store=`); `after` waits first, for a workspace opening. */
function ToWelcome({ after = 0 }: { after?: number }) {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const setup = useSetup();
  // The old invitation link (`/?workspace=<id>`) is OldInvitation's to lead on, to the invitation's own address, which
  // says when the workspace isn't there; going to Welcome first would win the race (review of #285, medium 2).
  const oldLink = pathname === '/' && new URLSearchParams(search).has('workspace');
  useEffect(() => {
    if (!setup.listed || oldLink) return;
    const t = setTimeout(() => nav('/welcome' + search, { replace: true }), after);
    return () => clearTimeout(t);
  }, [setup.listed, oldLink, after, nav, search]);
  return null;
}

/** The link /ready copied before (`/?workspace=<id>`) leads to the invitation's own address, keeping the rest. */
function OldInvitation() {
  const { pathname, search } = useLocation();
  const q = new URLSearchParams(search);
  const id = pathname === '/' ? q.get('workspace') : null;
  if (!id) return null;
  q.delete('workspace');
  const rest = q.toString();
  return <Navigate to={`/join/${encodeURIComponent(id)}${rest ? '?' + rest : ''}`} replace />;
}

/** An address that moved (domain/directory movedTo): on to where it leads now, with no history entry. */
function MovedFrom() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={movedTo(pathname, search, hash) ?? '/'} replace />;
}

/** An address that leads nowhere: say so, and offer the way home (re-review, 8 Nov, backlog T). One that is a route of
    a module installed here but switched off says so, and who can switch it on (FT2, N21). */
function NotFound() {
  const { pathname } = useLocation();
  const { installed, on } = useModules();
  const off = installed.find((m) => !on.has(m.id) && m.routes.some((r) => matchPath(r, pathname)));
  return (
    <div className="page narrow not-found">
      <h1 className="title-xl">Page not found</h1>
      <p className="muted">There’s nothing at this address. The link may be old, or mistyped.</p>
      {off && <SwitchedOffLine name={off.name} />}
      <div className="row"><Link className="btn primary" to="/">Go to Home</Link></div>
      {/* Then Find, inline, and Help (navigation spec, 2.6). */}
      <section className="stack not-found-find" aria-label="Find">
        <h2 className="field-label">Or find what you were looking for</h2>
        <Find inline onClose={() => {}} />
      </section>
      <div className="row"><Link className="btn ghost" to="/help">Help</Link></div>
    </div>
  );
}

/** /watching → /goals?scope=watching, keeping the rest of the address (the demo's date, a level). */
