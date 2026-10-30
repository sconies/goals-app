import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProvider } from './app/state';
import type { Store } from './data/store';
import { Activity } from './screens/Activity';
import { CheckInFlow } from './screens/CheckInFlow';
import { GoalEdit } from './screens/GoalEdit';
import { GoalScreen } from './screens/GoalScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { GoalWizard } from './screens/GoalWizard';
import { Home } from './screens/Home';
import { Review } from './screens/Review';
import { ImportWizard, WorkspaceHome } from './screens/Workspace';
import { Empty } from './ui/bits';
import { Shell } from './ui/Shell';

export function Routed() {
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
        <Route path="/workspace/new" element={<ImportWizard />} />
        <Route path="*" element={<div className="page narrow"><Empty title="Page not found" /></div>} />
      </Routes>
    </Shell>
  );
}

export function App({ store, today }: { store: Store; today?: () => Date }) {
  return (
    <AppProvider store={store} today={today}>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AppProvider>
  );
}
