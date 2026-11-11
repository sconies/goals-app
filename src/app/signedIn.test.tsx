// @vitest-environment jsdom
/* The sign-in seam (backlog AX3): the app takes its Identity beside the store, and outside the demo it never acts as a
   stand-in. Nobody signed in: the workspace can be looked at, and nothing can be saved. */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, NOBODY, useApp, type AppState } from './state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import type { Identity } from '../ports';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

async function open(identity: Identity) {
  const today = () => new Date('2026-01-14T12:00:00Z');
  const store = new BrowserStore(today, { storage: memory(), example: false, key: 'signed-in' });
  const data = contractWorkspace('signin');
  await store.createWorkspace({ id: 'ws_signin', name: 'Signed in', kind: 'own', createdAt: today().toISOString() }, data);
  let app: AppState | null = null;
  const Peek = () => { app = useApp(); return null; };
  render(<AppProvider store={store} identity={identity} mode="live" today={today}><Peek /></AppProvider>);
  await waitFor(() => expect(app?.ws.id).toBe('ws_signin'));
  return { store, data, app: () => app! };
}

describe('the sign-in seam', () => {
  it('nobody signed in: the workspace opens, the person is asked who they are, and nothing is saved', async () => {
    const { store, app } = await open({ current: async () => null });
    expect(app().viewerChosen).toBe(false);
    await act(async () => { await expect(app().renameWorkspace('Taken over')).rejects.toThrow(NOBODY); });
    expect((await store.workspaces()).find((w) => w.id === 'ws_signin')?.name).toBe('Signed in');
  });

  it('a sign-in that can’t be chosen: the app acts as the person signed in, and only them', async () => {
    let me: string | null = null;
    const { store, data, app } = await open({ current: async () => me });
    expect(app().canChooseViewer).toBe(false);
    me = data.people.find((p) => p.admin)!.id;
    // Asked again when the workspace is opened; a new mount asks afresh.
    const again = await open({ current: async () => me });
    expect(again.app().viewerChosen).toBe(true);
    expect(again.app().viewer.id).toBe(me);
    act(() => again.app().setViewer(data.people[1]!.id));
    expect(again.app().viewer.id).toBe(me);
    await act(async () => { await again.app().renameWorkspace('Renamed by its admin'); });
    expect((await again.store.workspaces()).find((w) => w.id === 'ws_signin')?.name).toBe('Renamed by its admin');
    void store;
  });
});
