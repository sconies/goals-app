// @vitest-environment jsdom
/* applyChanges re-sends what was previewed through run (AX2): the commit is worked out again when saved, so its ids are
   new, but the import's summary entry (what Imported reads: the file, the rows saved and left out, the undo payload) is
   the one the preview showed, and the id the screen goes on to is the saved one. */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, useApp, type AppState } from './state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import { loadEngine } from './actions';
import type { Change } from '../domain/types';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};
// What stays the same when the change set is worked out again: everything but the ids it makes and the time.
const same = (c: Change) => { const { id: _i, at: _a, entityId: _e, importId: _m, ...rest } = c as Change & { importId?: string }; return rest; };

describe('applyChanges through run', () => {
  it('saves the import summary the preview showed, under the id it returns', async () => {
    await loadEngine();
    const today = () => new Date('2026-01-14T12:00:00Z');
    const store = new BrowserStore(today, { storage: memory(), example: false, key: 'apply' });
    const w = contractWorkspace('ap');
    await store.createWorkspace({ id: 'ws_ap', name: 'AP', kind: 'own', createdAt: today().toISOString() }, w);
    let app: AppState | null = null;
    const Peek = () => { app = useApp(); return null; };
    localStorage.setItem('goals-app-workspace', 'ws_ap');
    render(<AppProvider store={store} mode="demo" today={today}><Peek /></AppProvider>);
    await waitFor(() => expect(app?.ws.id).toBe('ws_ap'));
    const admin = w.people.find((p) => p.admin)!;
    act(() => app!.setViewer(admin.id));
    await waitFor(() => expect(app?.viewer.id).toBe(admin.id));
    const goal = app!.snapshot.goals[0]!;
    const cs = app!.previewChanges({ goals: [{ __row: '2', id: goal.id, goal: `${goal.title}, renamed` }] }, 'spreadsheet', '', false, {}, { name: 'goals.csv', leftOut: 1 });
    const shown = cs.commit!.changes.find((c) => c.action === 'imported')!;
    let saved: Awaited<ReturnType<AppState['applyChanges']>> | null = null;
    await act(async () => { saved = await app!.applyChanges(cs); });
    const importId = saved!.commit!.changes.find((c) => c.action === 'imported')!.entityId;
    const kept = (await store.load('ws_ap')).changes.find((c) => c.action === 'imported' && c.entityId === importId)!;
    expect(kept).toBeDefined();
    expect(same(kept)).toEqual(same(shown));
    expect(kept.diffs.map((d) => d.to).join(' ')).toMatch(/goals\.csv/);
  });
});
