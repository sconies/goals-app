// @vitest-environment jsdom
/* Look around the demo (Lane, 13 Nov): one calm line in the workspace switcher, outside the demo only. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProvider, useApp } from '../app/state';
import { BrowserStore } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import type { Mode } from '../ports/store';
import { WorkspaceSwitcher, WorkspaceSwitchProvider } from './WorkspaceSwitch';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

async function open(mode: Mode) {
  const today = () => new Date('2026-01-14T12:00:00Z');
  const store = new BrowserStore(today, { storage: memory(), example: false, key: 'switch-' + mode });
  const data = contractWorkspace('switch');
  await store.createWorkspace({ id: 'ws_switch', name: 'Switch test', kind: 'own', createdAt: today().toISOString() }, data);
  const admin = data.people.find((p) => p.admin)!.id;
  let ready = false;
  const Ready = () => { ready = useApp().ws.id === 'ws_switch'; return null; };
  render(<MemoryRouter><AppProvider store={store} identity={{ current: async () => admin }} mode={mode} today={today}><WorkspaceSwitchProvider><Ready /><WorkspaceSwitcher variant="side" /></WorkspaceSwitchProvider></AppProvider></MemoryRouter>);
  await waitFor(() => expect(ready).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: /switch workspace/ }));
}

describe('the workspace switcher', () => {
  it('outside the demo, has one line that opens /demo', async () => {
    await open('live');
    const link = await screen.findByRole('link', { name: /Look around the demo/ });
    expect(link.getAttribute('href')).toBe('/demo');
  });
  it('in the demo, has no such line', async () => {
    await open('demo');
    await screen.findByRole('button', { name: /Set up a new workspace/ });
    expect(screen.queryByRole('link', { name: /Look around the demo/ })).toBeNull();
  });
});
