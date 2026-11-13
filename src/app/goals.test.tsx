// @vitest-environment jsdom
/* One query port per workspace as loaded (#229's review): every hook in one render shares one port, so the summaries
   are worked out once, not once per hook. */
import { render, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './state';
import { useGoals } from './goals';
import { BrowserStore } from '../data/store';
import { fixedClock } from '../adapters/local';
import { contractWorkspace } from '../ports/contracts/store';
import type { Goals } from '../ports/goals';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

const AT = new Date('2026-03-02T09:15:00Z');

describe('the goals port', () => {
  it('is one port for every hook in a render', async () => {
    const clock = fixedClock(AT);
    const store = new BrowserStore(clock, { storage: memory(), example: false, key: 'ports' });
    const data = contractWorkspace('ports');
    await store.createWorkspace({ id: 'ws_ports', name: 'Ports', kind: 'own', createdAt: AT.toISOString() }, data);
    const admin = data.people.find((p) => p.admin)!.id;
    const seen: Goals[] = [];
    let chosen = false;
    const Read = () => { const app = useApp(); chosen = app.viewerChosen; const port = useGoals(); if (chosen) seen.push(port); return null; };
    render(<AppProvider store={store} identity={{ current: async () => admin }} mode="live" clock={clock}><Read /><Read /><Read /><Read /><Read /><Read /></AppProvider>);
    await waitFor(() => expect(chosen).toBe(true));
    expect(seen.length).toBeGreaterThanOrEqual(6);
    expect(new Set(seen.slice(-6)).size).toBe(1);
  });
});
