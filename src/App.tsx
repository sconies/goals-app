import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProvider, useApp } from './app/state';
import type { Mode, Store } from './data/store';
import { Activity } from './screens/Activity';
import { CheckInFlow } from './screens/CheckInFlow';
import { GoalEdit } from './screens/GoalEdit';
import { GoalScreen } from './screens/GoalScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { GoalWizard } from './screens/GoalWizard';
import { Home } from './screens/Home';
import { Review } from './screens/Review';
import { WorkspaceHome } from './screens/Workspace';
import { Onboarding, Welcome } from './screens/Onboarding';
import { Ready, WhoAreYou } from './screens/Start';
import { Empty } from './ui/bits';
import { Shell } from './ui/Shell';

export function Routed() {
  const app = useApp();
  if (!app.viewerChosen) return <WhoAreYou />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check-in" element={<CheckInFlow />} />
        <Route path="/check-in/:goalId" element={<CheckInFlow />} />
        <Route path="/review" element={<Review />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/goals/new" element={<GoalWizard />} />
        <Route path="/goals/:goalId" element={<GoalScreen />} />
        <Route path="/goals/:goalId/edit" element={<GoalEdit />} />
        <Route path="/activity" element={<Activity />} />
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
