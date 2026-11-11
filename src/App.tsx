import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { AppProvider, useApp } from './app/state';
import type { Mode, Store } from './data/store';
import type { Identity } from './ports';
import { Activity } from './screens/Activity';
import { DataTables } from './screens/DataTables';
import { CheckInFlow } from './screens/CheckInFlow';
import { GoalEdit } from './screens/GoalEdit';
import { GoalScreen } from './screens/GoalScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { Watching } from './screens/Watching';
import { GoalWizard } from './screens/GoalWizard';
import { Home } from './screens/Home';
import { ReviewEdit, ReviewHome, ReviewRedirect, Reviews, ReviewSummary } from './screens/Review';
import { RetroGoal, WrapUp } from './screens/Retro';
import { WorkspaceHome } from './screens/Workspace';
import { PeopleList, PersonPage, TeamPage, TeamsList } from './screens/People';
import { movedTo } from './domain/directory';
import { Feedback } from './screens/Feedback';
import { Onboarding, Welcome } from './screens/Onboarding';
import { Ready, WhoAreYou } from './screens/Start';
import { Empty } from './ui/bits';
import { Shell } from './ui/Shell';
import { QuickCheckIn } from './screens/QuickCheckIn';
import { Research } from './screens/Research';
import { Settings } from './screens/Settings';
import { GoalPrint, ReviewPrint } from './screens/Print';
import { MotionLayer } from './ui/Count';
import { MotionLab } from './ui/MotionLab';
import { HelpArticle, HelpHome, WhatsNew } from './screens/Help';
import { ErrorBoundary, TelemetryRoutes } from './telemetry/react';
import { Moved, useModules } from './core/app';

export function Routed() {
  const app = useApp();
  const { pathname } = useLocation();
  // The feature modules that are on here add their routes, and lead their old addresses on (src/core/app.tsx).
  const modules = useModules();
  if (!app.viewerChosen) return <WhoAreYou />;
  return (
    <Shell>
      <MotionLayer />
      <MotionLab />
      {/* A crash on one page is recorded and offers a way on; moving to another page starts afresh. */}
      <ErrorBoundary at={pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check-in" element={<CheckInFlow />} />
        <Route path="/quick-check-in" element={<QuickCheckIn />} />
        <Route path="/research" element={<Research />} />
        <Route path="/check-in/:goalId" element={<CheckInFlow />} />
        <Route path="/review" element={<ReviewRedirect />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/new" element={<ReviewEdit />} />
        <Route path="/reviews/:reviewId" element={<ReviewHome />} />
        <Route path="/reviews/:reviewId/edit" element={<ReviewEdit />} />
        <Route path="/reviews/:reviewId/summary" element={<ReviewSummary />} />
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
        <Route path="/reviews/:reviewId/print" element={<ReviewPrint />} />
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
        <Route path="/feedback" element={<Feedback onSend={() => window.dispatchEvent(new Event('faro:send-feedback'))} />} />
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
      </ErrorBoundary>
    </Shell>
  );
}

export function App({ store, identity, mode = 'demo', today }: { store: Store; identity?: Identity; mode?: Mode; today?: () => Date }) {
  return (
    <BrowserRouter basename={mode === 'demo' ? '/demo' : undefined}>
      <AppProvider store={store} identity={identity} mode={mode} today={today} empty={() => <Welcome />}>
        <TelemetryRoutes />
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}

/** An address that moved (domain/directory movedTo): on to where it leads now, with no history entry. */
function MovedFrom() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={movedTo(pathname, search, hash) ?? '/'} replace />;
}

/** An address that leads nowhere: say so, and offer the way home (re-review, 8 Nov, backlog T). */
function NotFound() {
  return (
    <div className="page narrow not-found">
      <h1 className="title-xl">Page not found</h1>
      <Empty title="There’s nothing at this address">
        <span className="muted">The link may be old, or mistyped. Everything is still reachable from Home and the sidebar.</span>
        <div className="row"><Link className="btn primary" to="/">Go to Home</Link><Link className="btn" to="/help">Help</Link></div>
      </Empty>
    </div>
  );
}

/** /watching → /goals?scope=watching, keeping the rest of the address (the demo's date, a level). */
