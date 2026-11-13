// @vitest-environment jsdom
/* Nobody is dropped into a workspace they didn't choose (set-up spec ST1, W1 and W13): with the "Who are you?" picker,
   a browser that remembers no workspace opens none (Welcome is shown instead); an invitation opens the workspace it
   names, and only that one; an invitation to a workspace that isn't there opens nothing. */
import { render, waitFor } from '@testing-library/react';
import { AppProvider, useApp, type AppState } from './state';
import { BrowserStore } from '../data/store';
import { pickerIdentity } from '../adapters/local';
import { contractWorkspace } from '../ports/contracts/store';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

async function opened(path: string, remembered?: string) {
  const today = () => new Date('2026-11-11T12:00:00Z');
  const store = new BrowserStore(today, { storage: memory(), example: false, key: 'invite' + Math.random() });
  await store.createWorkspace({ id: 'ws_a', name: 'Alpha', kind: 'own', createdAt: today().toISOString() }, contractWorkspace('ia'));
  await store.createWorkspace({ id: 'ws_b', name: 'Field Operations', kind: 'own', createdAt: today().toISOString() }, contractWorkspace('ib'));
  localStorage.clear();
  if (remembered) localStorage.setItem('goals-live-workspace', remembered);
  window.history.replaceState(null, '', path);
  let app: AppState | null = null;
  const Peek = () => { app = useApp(); return null; };
  const view = render(<AppProvider store={store} identity={pickerIdentity('inv:', () => memory())} mode="live" today={today} empty={() => <p>Nothing open</p>}><Peek /></AppProvider>);
  return { view, app: () => app as AppState | null };
}

describe('which workspace opens', () => {
  // Test files share workers (vite.config.ts, isolate: false): the address goes back to /, or the next file's app reads
  // /join/ws_nope as an invitation to a workspace that isn't there and opens nothing (undoElsewhere's flake).
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('none, when this browser remembers none: never the first the store lists', async () => {
    const { view, app } = await opened('/');
    await waitFor(() => expect(view.getByText('Nothing open')).toBeTruthy());
    expect(app()).toBeNull();
    view.unmount();
  });

  it('the one this browser remembers', async () => {
    const { view, app } = await opened('/', 'ws_b');
    await waitFor(() => expect(app()?.ws.id).toBe('ws_b'));
    view.unmount();
  });

  it('the one an invitation names, whatever the browser had open, and it is remembered', async () => {
    const { view, app } = await opened('/join/ws_b', 'ws_a');
    await waitFor(() => expect(app()?.ws.id).toBe('ws_b'));
    expect(localStorage.getItem('goals-live-workspace')).toBe('ws_b');
    view.unmount();
  });

  it('the one the old link names (/?workspace=)', async () => {
    const { view, app } = await opened('/?workspace=ws_b');
    await waitFor(() => expect(app()?.ws.id).toBe('ws_b'));
    view.unmount();
  });

  it('nothing, for an invitation to a workspace that isn’t there, even with another remembered', async () => {
    const { view, app } = await opened('/join/ws_nope', 'ws_a');
    await waitFor(() => expect(view.getByText('Nothing open')).toBeTruthy());
    expect(app()).toBeNull();
    view.unmount();
  });
});
