/* The goals store's contract (backlog 8c): what any Store must do, whatever it keeps records in. Every adapter's test
   calls storeContract with a way to make one: the browser store, Supabase (on a stand-in client over real Postgres)
   and plain Postgres all pass it. Write a store for your own database and call it the same way; it is done when this
   passes.

   A feature module's records (AS part 2, domain/records) are part of the contract: make the store with CONTRACT_MODULE
   among the records it keeps and, on a database, run CONTRACT_MODULE_SQL first (the migration a module would bring).
   The store must keep that module's rows whole, save them with the rest of a commit, and remove and restore them
   with the goal they point to, without knowing what they are. */
import { createToken, revokeToken, type ActionContext } from '../../domain/actions';
import { deleteGoal, markPersonLeft, undoImport, undoRemoval } from '../../domain/removal';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../../domain/importer';
import type { Snapshot } from '../../domain/types';
import { moduleRows, type DbRow, type ModuleRecords, type RecordDef } from '../../domain/records';
import { examplesOf, isStale, withExpectations, type Commit, type Store } from '../../data/store';

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

/* ---------- a small module with records of its own, for the contract ---------- */

/** A mark someone puts on a goal: the contract module's one record. */
export interface Mark { id: string; goalId: string; text: string; at: string; removedAt?: string | null; removedBy?: string | null }
const mark: RecordDef<Mark> = {
  name: 'mark', key: 'marks', table: 'okr_contract_marks', removable: true,
  toRow: (ws, m): DbRow => ({ workspace_id: ws, id: m.id, goal_id: m.goalId, text: m.text, at: m.at, ...(m.removedAt !== undefined ? { removed_at: m.removedAt, removed_by: m.removedBy ?? null } : {}) }),
  fromRow: (r) => ({ id: r.id, goalId: String(r.goal_id), text: String(r.text), at: new Date(String(r.at)).toISOString(), ...(r.removed_at ? { removedAt: new Date(String(r.removed_at)).toISOString(), removedBy: String(r.removed_by) } : {}) }),
};
/** The contract's module: one record, pointing to a goal. */
export const CONTRACT_MODULE: ModuleRecords = { module: 'contract', records: [mark] };
/** Its table, as its migration would make it, in Faro's schema, and on the allowed list okr_write takes (migration 0039). */
export const CONTRACT_MODULE_SQL = `
  create table if not exists faro.okr_contract_marks (id text primary key, workspace_id text not null references faro.okr_workspaces (id), goal_id text not null references faro.okr_goals (id), text text not null, at timestamptz not null, removed_at timestamptz, removed_by text);
  grant select, insert, update on faro.okr_contract_marks to anon;
  insert into faro.module_tables (table_name, module, position) values ('okr_contract_marks', 'contract', 100) on conflict (table_name) do nothing;
  create or replace view public.okr_contract_marks with (security_invoker = on) as select * from faro.okr_contract_marks;
`;
const marksOf = (s: Snapshot) => moduleRows<Mark>(s, 'contract', 'marks');

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

    it('keeps a module’s records whole, saves them with a commit, and removes and restores them with what they point to', async () => {
      const before = await store.load(ws);
      const g = before.goals.at(-1)!;
      const m: Mark = { id: ids('mark'), goalId: g.id, text: 'Kept as it was given, line\nbreaks and “quotes” too', at: NOW.toISOString() };
      // Saved with the rest of one commit: the mark and its change-log entry together.
      await store.commit(ws, { modules: { contract: { marks: [m] } }, changes: note(before, 'Marked').changes });
      const saved = await store.load(ws);
      expect(marksOf(saved)).toEqual([m]);
      expect(saved.changes.some((c) => c.diffs[0]?.to === 'Marked')).toBe(true);
      // A save of anything else leaves it as it is.
      await store.commit(ws, note(saved, 'Something else'));
      expect(marksOf(await store.load(ws))).toEqual([m]);
      // Removed with the goal it points to, in one save; restored with it.
      const by = before.people[0]!.id, at = NOW.toISOString();
      await store.commit(ws, { goals: [{ ...g, removedAt: at, removedBy: by }], modules: { contract: { marks: [{ ...m, removedAt: at, removedBy: by }] } }, changes: [] });
      const gone = await store.load(ws);
      expect(gone.goals.find((x) => x.id === g.id)?.removedAt).toBeTruthy();
      expect(marksOf(gone)).toEqual([{ ...m, removedAt: at, removedBy: by }]);
      const removed = gone.goals.find((x) => x.id === g.id)!;
      await store.commit(ws, { goals: [{ ...removed, removedAt: null, removedBy: null }], modules: { contract: { marks: [{ ...m, removedAt: null, removedBy: null }] } }, changes: [] });
      const back = await store.load(ws);
      expect(back.goals.find((x) => x.id === g.id)?.removedAt ?? null).toBeNull();
      expect(marksOf(back).map((x) => ({ ...x, removedAt: x.removedAt ?? null, removedBy: x.removedBy ?? null }))).toEqual([{ ...m, removedAt: null, removedBy: null }]);
    });

    it('brings back what Undo restores, as loaded, and it stays back after the next load', async () => {
      // A record loaded live has no removedAt at all, and Undo saves it back as it was loaded: the store must still clear
      // the removal's time (build review: on the database stores the record came back, then went again on reload).
      const undone = async (remove: (x: ActionContext) => Commit) => {
        const before = await store.load(ws);
        const removal = remove(ctx(before));
        await store.commit(ws, removal);
        await store.commit(ws, undoRemoval(ctx(await store.load(ws)), removal, before));
        return store.load(ws);
      };
      const live = await store.load(ws);
      const g = live.goals.find((x) => !x.removedAt && !live.goals.some((c) => c.parentId === x.id) && !live.checkIns.some((c) => c.goalId === x.id))!;
      expect(g.removedAt).toBeUndefined();
      const goalBack = await undone((x) => deleteGoal(x, g.id));
      expect(goalBack.goals.find((x) => x.id === g.id)?.removedAt ?? null).toBeNull();

      const p = live.people.find((x) => !x.admin && !x.leftAt && !x.removedAt)!;
      const personBack = await undone((x) => markPersonLeft(x, p.id, { goalsTo: x.actor.id, asksTo: x.actor.id }));
      expect(personBack.people.find((x) => x.id === p.id)?.leftAt ?? null).toBeNull();

      // A module's row, which its toRow also writes only when it has a removal time.
      const m: Mark = { id: ids('mark'), goalId: g.id, text: 'Undone', at: NOW.toISOString() };
      await store.commit(ws, { modules: { contract: { marks: [m] } }, changes: [] });
      const markBack = await undone((x) => ({ modules: { contract: { marks: [{ ...m, removedAt: x.now, removedBy: x.actor.id }] } }, changes: note(x.snapshot, 'Removed a mark').changes }));
      expect(marksOf(markBack).find((x) => x.id === m.id)?.removedAt ?? null).toBeNull();
    });

    it('puts back what an import deleted, stopped or marked as left when the import is undone, and it stays back', async () => {
      // An import's log entry keeps each row as it was, and a live row has no removal fields at all (build review of #175).
      const live = await store.load(ws);
      const free = live.goals.filter((x) => !x.removedAt && !x.stoppedAt && !live.goals.some((c) => c.parentId === x.id));
      const [a, b] = [free.at(-1)!, free.at(-2)!];
      const p = [...live.people].reverse().find((x) => !x.admin && !x.leftAt && !x.removedAt)!;
      const admin = live.people.find((x) => x.admin)!.id, at = NOW.toISOString(), importId = ids('imp');
      await store.commit(ws, {
        goals: [{ ...a, removedAt: at, removedBy: admin }, { ...b, stoppedAt: at, stoppedBy: admin, stopReason: 'Stopped by a row’s Action' }],
        people: [{ ...p, leftAt: at, leftBy: admin, email: p.email ?? 'left@example.org' }],
        changes: [{ id: ids('chg'), at, actorId: admin, goalId: null, entity: 'workspace', entityId: importId, action: 'imported', summary: 'Imported a spreadsheet: 3 rows', diffs: [], importId,
          undo: { goals: [{ id: a.id, before: a }, { id: b.id, before: b }], checkIns: [], people: [{ id: p.id, before: p }], requests: [] } }],
      });
      await store.commit(ws, undoImport(ctx(await store.load(ws)), importId).commit);
      const back = await store.load(ws);
      expect(back.goals.find((x) => x.id === a.id)?.removedAt ?? null).toBeNull();
      const stopped = back.goals.find((x) => x.id === b.id)!;
      expect([stopped.stoppedAt ?? null, stopped.stopReason ?? null]).toEqual([null, null]);
      const person = back.people.find((x) => x.id === p.id)!;
      expect([person.leftAt ?? null, person.email ?? null]).toEqual([null, p.email ?? null]);
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

    it('resets the example only when it has one (the demo’s plumbing, not the port’s)', async () => {
      const demo = examplesOf(store);
      if (demo) expect((await demo.resetExample()).goals.length).toBeGreaterThan(0);
      // A store without the example has nothing to reset: the shared stores have no such method, and a browser store
      // made without the example refuses.
      else if ('resetExample' in store) await expect((store as { resetExample(): Promise<unknown> }).resetExample()).rejects.toThrow();
    });
  });
}
