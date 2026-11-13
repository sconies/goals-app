// @vitest-environment jsdom
/* A tab left open while an admin switches a module off elsewhere (build review of #371, medium 1): its next reload brings
   the workspace's switches with the snapshot, so the module's screens go and its next action is refused in the
   switched-off words. Before, only the tab that switched knew, and the other kept saving review notes. */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, useApp, type AppState } from './state';
import { reviewsOffWords } from './reads';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

describe('a tab open before a module is switched off elsewhere', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sees it off at its next reload, and its next review note is refused and saves nothing', async () => {
    const today = () => new Date('2026-01-14T12:00:00Z');
    const storage = memory();
    const store = new BrowserStore(today, { storage, example: false, key: 'switches' });
    const s = contractWorkspace('sw');
    await store.createWorkspace({ id: 'ws_s', name: 'S', kind: 'own', createdAt: today().toISOString() }, s);
    const review = s.reviews[0]!;
    const admin = s.people.find((p) => p.admin)!.id;
    let app: AppState | null = null;
    const Peek = () => { app = useApp(); return null; };
    localStorage.setItem('goals-app-workspace', 'ws_s');
    render(<AppProvider store={store} mode="demo" today={today}><Peek /></AppProvider>);
    await waitFor(() => expect(app?.ws.id).toBe('ws_s'));
    act(() => app!.setViewer(admin));
    await waitFor(() => expect(app?.viewer.id).toBe(admin));
    expect(app!.ws.modulesOff ?? []).toEqual([]);

    // Another tab (the same browser's storage) switches Reviews off.
    const other = new BrowserStore(today, { storage, example: false, key: 'switches' });
    await other.commit('ws_s', { modulesOff: ['reviews'], changes: [] });

    // Coming back to this tab more than 30 seconds after it loaded reloads it.
    const t0 = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(t0 + 60_000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(app?.ws.modulesOff).toEqual(['reviews']));

    const goal = s.goals.find((g) => review.scope.goals.includes(g.id) || review.scope.trees.includes(g.id)) ?? s.goals[0]!;
    const before = (await store.load('ws_s')).decisions.length;
    await act(async () => {
      await expect(app!.run('reviewCall', { goalId: goal.id, reviewId: review.id, kind: 'note', note: 'Said after the switch' })).rejects.toThrow(reviewsOffWords('S'));
    });
    expect((await store.load('ws_s')).decisions.length).toBe(before);
  });
});
