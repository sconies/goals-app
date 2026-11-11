// @vitest-environment jsdom
/* The Clock port (AX9): the app takes the real time beside the store. Every record's stamp reads it, never the browser's
   own clock; the reload on coming back to the tab reads the page's own running time, so a stopped clock (the demo's and
   the evals') doesn't stop it (build review of #154). */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, useApp, type AppState } from './state';
import { BrowserStore } from '../data/store';
import { fixedClock } from '../adapters/local';
import { contractWorkspace } from '../ports/contracts/store';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

const AT = new Date('2026-03-02T09:15:00Z');

async function open() {
  const clock = fixedClock(AT);
  const store = new BrowserStore(clock, { storage: memory(), example: false, key: 'clock' });
  const data = contractWorkspace('clock');
  await store.createWorkspace({ id: 'ws_clock', name: 'Clocked', kind: 'own', createdAt: AT.toISOString() }, data);
  const admin = data.people.find((p) => p.admin)!.id;
  let app: AppState | null = null;
  const Peek = () => { app = useApp(); return null; };
  const loads = vi.spyOn(store, 'load');
  const view = render(<AppProvider store={store} identity={{ current: async () => admin }} mode="live" clock={clock}><Peek /></AppProvider>);
  await waitFor(() => expect(app?.viewerChosen).toBe(true));
  return { store, loads, view, app: () => app! };
}

describe('the clock', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('stamps a record with the clock it is given, not the browser’s', async () => {
    const { store, view, app } = await open();
    await act(async () => { await app().renameWorkspace('Renamed'); });
    const snap = await store.load('ws_clock');
    const renamed = snap.changes.filter((c) => c.entity === 'workspace' && /Renamed/.test(c.summary));
    expect(renamed.map((c) => c.at)).toEqual([AT.toISOString()]);
    view.unmount();
  });

  it('two feature switches at once both hold: each saves from the list the one before saved (build review of #141)', async () => {
    const { store, view, app } = await open();
    await act(async () => { await Promise.all([app().setModule('spreadsheets', false), app().setModule('metrics', false)]); });
    expect((await store.workspaces()).find((w) => w.id === 'ws_clock')?.modulesOff?.slice().sort()).toEqual(['metrics', 'spreadsheets']);
    // An Undo of the first, pressed while the second is saving, keeps the second off.
    await act(async () => { await Promise.all([app().setModule('spreadsheets', true), app().setModule('metrics', false)]); });
    expect((await store.workspaces()).find((w) => w.id === 'ws_clock')?.modulesOff).toEqual(['metrics']);
    view.unmount();
  });

  it('with the clock stopped, still reloads on coming back to the tab after 30 seconds, and not sooner', async () => {
    const { loads, view } = await open();
    const start = performance.now();
    const now = vi.spyOn(performance, 'now');
    const before = loads.mock.calls.length;
    now.mockReturnValue(start + 10_000);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(loads.mock.calls.length).toBe(before);
    now.mockReturnValue(start + 40_000);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(loads.mock.calls.length).toBe(before + 1));
    view.unmount();
  });
});
