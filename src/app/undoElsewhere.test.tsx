// @vitest-environment jsdom
/* An action made in one workspace never saves into another (build review of #141, high): a toast's Undo pressed after
   switching workspace is refused, says so, and changes nothing in either. */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, ELSEWHERE, useApp, useToasts, type AppState } from './state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

describe('an action made in one workspace', () => {
  it('is refused once another workspace is open, and saves nothing in either', async () => {
    const today = () => new Date('2026-01-14T12:00:00Z');
    const store = new BrowserStore(today, { storage: memory(), example: false, key: 'elsewhere' });
    const a = contractWorkspace('ea'), b = contractWorkspace('eb');
    await store.createWorkspace({ id: 'ws_a', name: 'A', kind: 'own', createdAt: today().toISOString() }, a);
    await store.createWorkspace({ id: 'ws_b', name: 'B', kind: 'own', createdAt: today().toISOString() }, b);
    const admin = (s: typeof a) => s.people.find((p) => p.admin)!.id;
    let app: AppState | null = null;
    let toasts: ReturnType<typeof useToasts> = [];
    const Peek = () => { app = useApp(); toasts = useToasts(); return null; };
    render(<AppProvider store={store} mode="demo" today={today}><Peek /></AppProvider>);
    await waitFor(() => expect(app?.ws.id).toBeTruthy());
    act(() => app!.switchWorkspace('ws_a'));
    await waitFor(() => expect(app?.ws.id).toBe('ws_a'));
    act(() => app!.setViewer(admin(a)));
    await waitFor(() => expect(app?.viewer.id).toBe(admin(a)));
    await act(async () => { await app!.setModule('spreadsheets', false); });
    await waitFor(() => expect(app?.ws.modulesOff).toEqual(['spreadsheets']));
    // The toast's Undo holds this render's app.
    const undo = app!;
    act(() => app!.toast('Switched off Spreadsheets', 'success', { label: 'Undo', run: () => undefined }));
    await waitFor(() => expect(toasts.some((t) => t.action)).toBe(true));
    act(() => app!.switchWorkspace('ws_b'));
    await waitFor(() => expect(app?.ws.id).toBe('ws_b'));
    // Its message goes with the workspace: an Undo there could only be refused.
    expect(toasts.some((t) => t.action)).toBe(false);
    const before = (await store.load('ws_b')).changes.length;
    await act(async () => { await expect(undo.setModule('spreadsheets', true)).rejects.toThrow(ELSEWHERE); });
    expect((await store.load('ws_b')).changes.length).toBe(before);
    expect((await store.workspaces()).find((w) => w.id === 'ws_a')?.modulesOff).toEqual(['spreadsheets']);
  });
});
