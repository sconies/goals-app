import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { AppProvider, useApp } from './app/state';
import type { Mode, Store } from './data/store';
import { Activity } from './screens/Activity';
import { DataTables } from './screens/DataTables';
import { CheckInFlow } from './screens/CheckInFlow';
import { GoalEdit } from './screens/GoalEdit';
import { GoalScreen } from './screens/GoalScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { GoalWizard } from './screens/GoalWizard';
import { Home } from './screens/Home';
import { ReviewEdit, ReviewHome, ReviewRedirect, Reviews, ReviewSummary } from './screens/Review';
import { Watching } from './screens/Watching';
import { RetroGoal, WrapUp } from './screens/Retro';
import { WorkspaceHome } from './screens/Workspace';
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
        <Route path="/watching" element={<Watching />} />
        <Route path="/retro" element={<WrapUp />} />
        <Route path="/retro/:goalId" element={<RetroGoal />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/goals/new" element={<GoalWizard />} />
        <Route path="/goals/:goalId" element={<GoalScreen />} />
        <Route path="/goals/:goalId/edit" element={<GoalEdit />} />
        <Route path="/goals/:goalId/print" element={<GoalPrint />} />
        <Route path="/reviews/:reviewId/print" element={<ReviewPrint />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/data" element={<DataTables />} />
        <Route path="/workspace" element={<WorkspaceHome />} />
        <Route path="/workspace/new" element={<Onboarding />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<HelpHome />} />
        <Route path="/help/:id" element={<HelpArticle />} />
        <Route path="/whats-new" element={<WhatsNew />} />
        <Route path="/ready" element={<Ready />} />
        {modules.screens.flatMap((m) => (m.routes ?? []).map((r) => <Route key={r.path} path={r.path} element={r.element} />))}
        {modules.redirects.map(([from, to]) => <Route key={from} path={from} element={<Moved to={to} />} />)}
        <Route path="*" element={<div className="page narrow"><Empty title="Page not found" /></div>} />
      </Routes>
      </ErrorBoundary>
    </Shell>
  );
}

export function App({ store, mode = 'demo', today }: { store: Store; mode?: Mode; today?: () => Date }) {
  return (
    <BrowserRouter basename={mode === 'demo' ? '/demo' : undefined}>
      <AppProvider store={store} mode={mode} today={today} empty={() => <Welcome />}>
        <TelemetryRoutes />
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}
