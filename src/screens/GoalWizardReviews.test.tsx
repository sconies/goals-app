// @vitest-environment jsdom
/* New goal's read-back follows the Reviews switch (build review of #371, medium 5): with Reviews on it says which
   review the goal joins (or none yet); switched off, it says nothing of reviews. */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppProvider } from '../app/state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import { blankGoal } from '../domain/goal';
import { goalDraftKey } from '../app/drafts';
import { GoalWizard } from './GoalWizard';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

async function check(off: string[]): Promise<string> {
  const today = () => new Date('2026-01-14T12:00:00Z');
  const key = `wizard${off.length}`;
  const store = new BrowserStore(today, { storage: memory(), example: false, key });
  const s = contractWorkspace(key);
  const ws = `ws_${key}`;
  await store.createWorkspace({ id: ws, name: 'W', kind: 'own', createdAt: today().toISOString() }, s);
  if (off.length) await store.commit(ws, { modulesOff: off, changes: [] });
  const admin = s.people.find((p) => p.admin)!;
  localStorage.clear();
  localStorage.setItem('goals-app-workspace', ws);
  // A draft filled in up to Check: a number to move, owned by the admin, in their team.
  const draft = { ...blankGoal(admin.teamId ?? s.teams[0]!.id, admin.id, ''), title: 'Builds under ten minutes', unit: 'min', start: '20', target: '10', step: 3 };
  localStorage.setItem('goals-app-draft:' + goalDraftKey(ws, null), JSON.stringify(draft));
  const { unmount } = render(
    <AppProvider store={store} identity={{ current: async () => admin.id }} mode="demo" today={today}>
      <MemoryRouter initialEntries={['/goals/new/check']}>
        <Routes><Route path="/goals/new/:step" element={<GoalWizard />} /><Route path="*" element={<p>elsewhere</p>} /></Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByText(/Everyone in W can see it|sees it on their Home/)).toBeTruthy(), { timeout: 20_000 });
  const text = document.body.textContent ?? '';
  unmount();
  return text;
}

describe('New goal’s read-back and the Reviews switch', () => {
  it('says which review the goal joins with Reviews on, and names no review with Reviews off', async () => {
    expect(await check([])).toMatch(/It joins/);
    expect(await check(['reviews'])).not.toMatch(/It joins|review/i);
  }, 60_000);
});
