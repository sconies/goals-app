// @vitest-environment jsdom
/* A switched-off module's address is named as the page it shows (build review of #371, low): "Page not found" in the
   browser's title and the phone's top bar, never the review's name; a goal's ?review= names the goal alone. */
import { render, waitFor } from '@testing-library/react';
import { AppProvider } from '../app/state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import { pageName } from '../domain/navigation';
import { usePlaceNames } from './BackLink';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

async function names(off: string[]): Promise<string[]> {
  const today = () => new Date('2026-01-14T12:00:00Z');
  const key = `names${off.length}`;
  const store = new BrowserStore(today, { storage: memory(), example: false, key });
  const s = contractWorkspace(key);
  const ws = `ws_${key}`;
  await store.createWorkspace({ id: ws, name: 'N', kind: 'own', createdAt: today().toISOString() }, s);
  if (off.length) await store.commit(ws, { modulesOff: off, changes: [] });
  const review = s.reviews[0]!, goal = s.goals[0]!;
  localStorage.setItem('goals-app-workspace', ws);
  let said: string[] = [];
  const Read = () => {
    const n = usePlaceNames();
    said = [pageName(`/reviews/${review.id}`, '', n), pageName('/reviews', '', n), pageName(`/goals/${goal.id}`, `review=${review.id}`, n)];
    return null;
  };
  const { unmount } = render(<AppProvider store={store} mode="demo" today={today}><Read /></AppProvider>);
  await waitFor(() => expect(said.length).toBe(3));
  unmount();
  return said.map((x) => x.replace(review.name, '{review}').replace(goal.title, '{goal}'));
}

describe('a page’s name with Reviews switched off', () => {
  it('is the not-found page’s at a review’s address, and names no review on a goal', async () => {
    expect(await names([])).toEqual(['{review}', 'Reviews', '{goal} · {review}']);
    expect(await names(['reviews'])).toEqual(['Page not found', 'Page not found', '{goal}']);
  });
});
