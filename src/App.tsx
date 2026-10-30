import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProvider } from './app/state';
import type { Store } from './data/store';
import { CheckInScreen } from './screens/CheckInScreen';
import { GoalEditor } from './screens/GoalEditor';
import { GoalScreen } from './screens/GoalScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { Header } from './ui/bits';
import { Shell } from './ui/Shell';

export function Routed() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<CheckInScreen />} />
        <Route path="/check-in/:goalId" element={<CheckInScreen />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/goals/new" element={<GoalEditor />} />
        <Route path="/goals/:goalId" element={<GoalScreen />} />
        <Route path="/goals/:goalId/edit" element={<GoalEditor />} />
        <Route path="*" element={<Header title="Page not found" />} />
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
