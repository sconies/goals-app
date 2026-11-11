/* The goals store's contract (backlog 8c): what any Store must do, whatever it keeps records in. Every adapter's test
   calls storeContract with a way to make one: the browser store, Supabase (on a stand-in client over real Postgres)
   and plain Postgres all pass it. Write a store for your own database and call it the same way; it is done when this
   passes. */
import { createToken, revokeToken, type ActionContext } from '../../domain/actions';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../../domain/importer';
import type { Snapshot } from '../../domain/types';
import { isStale, withExpectations, type Commit, type Store } from '../../data/store';

const NOW = new Date('2026-10-30T12:00:00Z');

/** A small workspace (the import's templates), with an admin, for each store to keep. */
export function contractWorkspace(suffix: string): Snapshot {
  const built = buildWorkspace({ name: 'Contract', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: NOW, idSuffix: suffix });
  if (built.issues.length) throw new Error(built.issues.join('; '));
  const s = built.snapshot;
  return s.people.some((p) => p.admin) ? s : { ...s, people: s.people.map((p, i) => (i === 0 ? { ...p, admin: true } : p)) };
}

let n = 0;
const ids = (p: string) => `${p}_c${String(++n).padStart(4, '0')}`;
const ctx = (s: Snapshot): ActionContext => ({ snapshot: s, full: s, allGoals: s.goals, cycle: s.cycles[0]!, week: 1, actor: s.people.find((p) => p.admin)!, now: NOW.toISOString(), newId: ids } as unknown as ActionContext);
const note = (s: Snapshot, text: string): Commit => ({
  changes: [{ id: ids('chg'), at: NOW.toISOString(), actorId: s.people[0]!.id, goalId: s.goals[0]!.id, entity: 'note', entityId: ids('note'), action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: text }] }],
});

export function storeContract(name: string, make: () => Promise<Store>) {
  describe(`the goals store contract: ${name}`, () => {
    let store: Store;
    let ws: string;
    let start: Snapshot;
    beforeAll(async () => {
      store = await make();
      ws = ids('ws');
      start = contractWorkspace(String(n));
      await store.createWorkspace({ id: ws, name: 'Contract', kind: 'own', createdAt: NOW.toISOString() }, start);
    }, 60_000);

    it('keeps a new workspace whole, and lists it', async () => {
      expect((await store.workspaces()).map((w) => w.id)).toContain(ws);
      const s = await store.load(ws);
      expect(s.goals.map((g) => g.id).sort()).toEqual(start.goals.map((g) => g.id).sort());
      expect(s.people.map((p) => p.id).sort()).toEqual(start.people.map((p) => p.id).sort());
      expect(s.teams.map((t) => t.id).sort()).toEqual(start.teams.map((t) => t.id).sort());
      expect(s.cycles.map((c) => c.id)).toEqual(start.cycles.map((c) => c.id));
      const g = start.goals[0]!;
      expect(s.goals.find((x) => x.id === g.id)).toMatchObject({ title: g.title, kind: g.kind, ownerId: g.ownerId });
    });

    it('saves a change-log entry and gives it back', async () => {
      await store.commit(ws, note(start, 'Kept by the store'));
      expect((await store.load(ws)).changes.some((c) => c.diffs[0]?.to === 'Kept by the store')).toBe(true);
    });

    it('saves a goal one version on, and refuses a save based on the version before it as stale', async () => {
      const before = await store.load(ws);
      const g = before.goals[0]!;
      const edit = (title: string): Commit => ({ goals: [{ ...g, title }], changes: note(before, title).changes });
      await store.commit(ws, withExpectations(edit('Renamed once'), before));
      const after = await store.load(ws);
      const saved = after.goals.find((x) => x.id === g.id)!;
      expect(saved.title).toBe('Renamed once');
      expect(saved.version ?? 0).toBe((g.version ?? 0) + 1);
      const late = await store.commit(ws, withExpectations(edit('Renamed from an old screen'), before)).then(() => null, (e: unknown) => e);
      expect(isStale(late)).toBe(true);
      expect((await store.load(ws)).goals.find((x) => x.id === g.id)!.title).toBe('Renamed once');
    });

    it('never lets a save to one workspace change another’s records', async () => {
      // A store that keeps every workspace's records in one table (a database) refuses such a save outright; one that
      // keeps each workspace apart (the browser) may keep the copy as this workspace's own. Neither touches the other.
      const other = ids('ws');
      const theirs = contractWorkspace(`o${n}`);
      await store.createWorkspace({ id: other, name: 'Neighbour', kind: 'own', createdAt: NOW.toISOString() }, theirs);
      const person = theirs.people[0]!;
      const milestone = theirs.goals.find((g) => g.kind === 'milestone')!;
      expect(milestone.kind === 'milestone' && milestone.stages.length).toBeGreaterThan(0);
      for (const c of [
        { people: [{ ...person, name: 'Moved across' }], changes: [] },
        { goals: [{ ...milestone, title: 'Taken over', stages: [] }], changes: [] },
      ] as Commit[]) {
        await store.commit(ws, c).catch(() => undefined);
      }
      const after = await store.load(other);
      expect(after.people.find((p) => p.id === person.id)?.name).toBe(person.name);
      const g = after.goals.find((x) => x.id === milestone.id)!;
      expect(g.title).toBe(milestone.title);
      expect(g.kind === 'milestone' && g.stages.map((s) => s.id)).toEqual(milestone.kind === 'milestone' && milestone.stages.map((s) => s.id));
      await store.deleteWorkspace(other);
    });

    it('issues an AI assistant token once, never keeps its secret, and revokes it', async () => {
      const s = await store.load(ws);
      const c = createToken(ctx(s), s.people[1]!.id, 'Claude on a laptop');
      const secret = await store.issueToken(ws, c);
      expect(secret).toMatch(/^\S{20,}$/);
      const after = await store.load(ws);
      expect(after.tokens?.map((t) => t.id)).toContain(c.tokens![0]!.id);
      expect(JSON.stringify(after)).not.toContain(secret);
      await store.commit(ws, revokeToken(ctx(after), c.tokens![0]!.id)!);
      expect((await store.load(ws)).tokens?.find((t) => t.id === c.tokens![0]!.id)?.revokedAt).toBeTruthy();
    });

    it('deletes a workspace and everything in it', async () => {
      const other = ids('ws');
      await store.createWorkspace({ id: other, name: 'Short-lived', kind: 'own', createdAt: NOW.toISOString() }, contractWorkspace(String(n)));
      await store.deleteWorkspace(other);
      expect((await store.workspaces()).map((w) => w.id)).not.toContain(other);
      expect((await store.workspaces()).map((w) => w.id)).toContain(ws);
    });

    it('resets the example only when it has one', async () => {
      if (store.hasExample) expect((await store.resetExample()).goals.length).toBeGreaterThan(0);
      else await expect(store.resetExample()).rejects.toThrow();
    });
  });
}
