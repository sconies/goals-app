import { BrowserRouter, Route, Routes } from 'react-router';
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
import { Import } from './screens/Import';
import { QuickCheckIn } from './screens/QuickCheckIn';
import { Research } from './screens/Research';

export function Routed() {
  const app = useApp();
  if (!app.viewerChosen) return <WhoAreYou />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check-in" element={<CheckInFlow />} />
        <Route path="/quick-check-in" element={<QuickCheckIn />} />
        <Route path="/import" element={<Import />} />
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
        <Route path="/activity" element={<Activity />} />
        <Route path="/data" element={<DataTables />} />
        <Route path="/workspace" element={<WorkspaceHome />} />
        <Route path="/workspace/new" element={<Onboarding />} />
        <Route path="/ready" element={<Ready />} />
        <Route path="*" element={<div className="page narrow"><Empty title="Page not found" /></div>} />
      </Routes>
    </Shell>
  );
}

export function App({ store, mode = 'demo', today }: { store: Store; mode?: Mode; today?: () => Date }) {
  return (
    <BrowserRouter basename={mode === 'demo' ? '/demo' : undefined}>
      <AppProvider store={store} mode={mode} today={today} empty={() => <Welcome />}>
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}
