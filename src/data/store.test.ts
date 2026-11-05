// @vitest-environment node
/* The demo's storage (DEMO-STORAGE): it keeps only the visitor's own saves on top of the example, rebuilt from its
   description, so a change survives a reload at the example's full size; when the browser won't store, the change
   still applies for the visit and the store says why; starting over clears the saves. */
import { EXAMPLE } from './examples';
import { BrowserStore, DEMO_KEY, SAVE_PROBLEM, type Commit } from './store';

const TODAY = new Date('2026-11-05T12:00:00Z');
const today = () => TODAY;

/** A browser's localStorage, with a size limit like a real one's (about 5 million characters), or turned off. */
class FakeStorage implements Storage {
  data = new Map<string, string>();
  constructor(private limit = 5_000_000, private blocked = false) {}
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { if (this.blocked) throw new DOMException('blocked', 'SecurityError'); return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.blocked) throw new DOMException('blocked', 'SecurityError');
    const used = [...this.data.entries()].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + v.length > this.limit) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const comment = (goalId: string, text: string, id: string): Commit => ({
  changes: [{ id, at: TODAY.toISOString(), actorId: 'rhea', goalId, entity: 'note', entityId: 'note_' + id, action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: text }] }],
});
const comments = (s: { changes: Commit['changes'] }) => s.changes.filter((c) => c.entity === 'note').map((c) => c.diffs[0]?.to);

describe('the demo’s storage', () => {
  it('keeps a comment through a reload, storing only the saves, not the whole example', async () => {
    const storage = new FakeStorage();
    const a = new BrowserStore(today, { storage });
    const before = await a.load(EXAMPLE.id);
    // The example is millions of characters: more than a browser lets a page keep.
    expect(JSON.stringify(before).length).toBeGreaterThan(4_000_000);
    await a.commit(EXAMPLE.id, comment('ns-lead', 'Kept after a reload', 'c1'));
    expect(a.saveProblem()).toBeNull();
    // A reload: a new store reading the same browser storage.
    const b = new BrowserStore(today, { storage });
    const after = await b.load(EXAMPLE.id);
    expect(comments(after)).toContain('Kept after a reload');
    expect(after.changes.length).toBe(before.changes.length + 1);
    const stored = [...storage.data.values()].reduce((n, v) => n + v.length, 0);
    expect(stored).toBeLessThan(10_000);
  });

  it('keeps the example the saves were made on, even on a later day', async () => {
    const storage = new FakeStorage();
    await new BrowserStore(today, { storage }).commit(EXAMPLE.id, comment('ns-lead', 'Made on the 5th', 'c1'));
    const later = new BrowserStore(() => new Date('2026-11-12T12:00:00Z'), { storage });
    const s = await later.load(EXAMPLE.id);
    expect(comments(s)).toContain('Made on the 5th');
    expect(Math.max(...s.checkIns.map((c) => c.week))).toBe(Math.max(...(await new BrowserStore(today, { storage: new FakeStorage() }).load(EXAMPLE.id)).checkIns.map((c) => c.week)));
  });

  it('says so when the browser is full, keeps the change for the visit, and Start over clears it', async () => {
    const storage = new FakeStorage(400);
    const store = new BrowserStore(today, { storage });
    const heard: (string | null)[] = [];
    store.onSaveProblem(() => heard.push(store.saveProblem()));
    await store.commit(EXAMPLE.id, comment('ns-lead', 'x'.repeat(500), 'c1'));
    expect(store.saveProblem()).toBe(SAVE_PROBLEM.full);
    expect(heard).toEqual([SAVE_PROBLEM.full]);
    // Still there for this visit…
    expect(comments(await store.load(EXAMPLE.id))).toContain('x'.repeat(500));
    // …but not after a reload, which is why it's said.
    expect(comments(await new BrowserStore(today, { storage }).load(EXAMPLE.id))).not.toContain('x'.repeat(500));
    const fresh = await store.resetExample();
    expect(comments(fresh)).not.toContain('x'.repeat(500));
    expect(store.saveProblem()).toBeNull();
    expect([...storage.data.keys()].filter((k) => k.startsWith(`${DEMO_KEY}:${EXAMPLE.id}`))).toEqual([]);
  });

  it('says so from the start when storage is blocked (a private window), and still works for the visit', async () => {
    const store = new BrowserStore(today, { storage: new FakeStorage(5_000_000, true) });
    expect(store.saveProblem()).toBe(SAVE_PROBLEM.blocked);
    await store.commit(EXAMPLE.id, comment('ns-lead', 'Only for now', 'c1'));
    expect(comments(await store.load(EXAMPLE.id))).toContain('Only for now');
    expect(new BrowserStore(today, { storage: null }).saveProblem()).toBe(SAVE_PROBLEM.blocked);
  });

  it('starts over: the saves are gone and the example is back as it was', async () => {
    const storage = new FakeStorage();
    const store = new BrowserStore(today, { storage });
    const before = await store.load(EXAMPLE.id);
    await store.commit(EXAMPLE.id, comment('ns-lead', 'To be undone', 'c1'));
    await store.resetExample();
    const again = await new BrowserStore(today, { storage }).load(EXAMPLE.id);
    expect(comments(again)).not.toContain('To be undone');
    expect(again.changes.length).toBe(before.changes.length);
  });

  it('still keeps a workspace of the visitor’s own whole, and refuses to delete the example', async () => {
    const storage = new FakeStorage();
    const store = new BrowserStore(today, { storage });
    const ex = await store.load(EXAMPLE.id);
    const own = { ...ex, goals: ex.goals.slice(0, 2), checkIns: [], changes: [], decisions: [], requests: [], watches: [], reviews: [], views: [], tokens: [] };
    await store.createWorkspace({ id: 'ws_mine', name: 'Mine', kind: 'own', createdAt: TODAY.toISOString() }, own);
    expect((await new BrowserStore(today, { storage }).load('ws_mine')).goals).toHaveLength(2);
    expect((await store.workspaces()).map((w) => w.id)).toEqual([EXAMPLE.id, 'ws_mine']);
    await expect(store.deleteWorkspace(EXAMPLE.id)).rejects.toThrow();
  });
});
