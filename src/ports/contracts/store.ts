/* The goals store's contract (backlog 8c): what any Store must do, whatever it keeps records in. Every adapter's test
   calls storeContract with a way to make one: the browser store, Supabase (on a stand-in client over real Postgres)
   and plain Postgres all pass it. Write a store for your own database and call it the same way; it is done when this
   passes.

   A feature module's records (AS part 2, domain/records) are part of the contract: make the store with CONTRACT_MODULE
   among the records it keeps and, on a database, run CONTRACT_MODULE_SQL first (the migration a module would bring).
   The store must keep that module's rows whole, save them with the rest of a commit, and remove and restore them
   with the goal they point to, without knowing what they are.

   Its cases are data (gap 1(b)): cases/store.ts makes them, `npm run spec` writes them to
   spec/conformance/contracts/store.json, and the drill harness runs the same cases on any build through a shim. Each
   case starts from a fresh store; a test's name is its case's name (spec/rebuild/ports-at-scale.md cites them). */
import { examplesOf, isStale, withExpectations, type Commit, type Store } from '../../data/store';
import { STORE_CONTRACT, type StoreGiven } from './cases/store';
import { contractSuite, methods, type Start } from './cases/run';

export { CONTRACT_MODULE, CONTRACT_MODULE_SQL, contractWorkspace, type Mark } from './cases/store';
import { contractWorkspace } from './cases/store';

/** Opens a case's store: a fresh one from `make`, holding the given workspaces. */
export const storeStart = (make: () => Promise<Store>): Start => async (given) => {
  const store = await make();
  for (const w of (given as StoreGiven).workspaces) await store.createWorkspace(w.workspace, w.snapshot);
  return methods(store);
};

/** `without`: cases this store can't keep by design, by name. Only the Supabase adapter through the old names in public
    uses it: 0035's redirects are fixed `select *` views, so a column added since (the cycle's rhythm, 0048) is seen only
    through faro (supabase/README.md, "No redirect"). */
export function storeContract(name: string, make: () => Promise<Store>, opts: { without?: RegExp } = {}) {
  contractSuite(opts.without ? { ...STORE_CONTRACT, cases: STORE_CONTRACT.cases.filter((c) => !opts.without!.test(c.name)) } : STORE_CONTRACT, name, storeStart(make));

  // Faro's own: the error a stale save refuses with is one the app knows (data/store isStale), and the demo's plumbing.
  describe(`the goals store, beyond the contract: ${name}`, () => {
    it('refuses a stale save with the error the app knows as stale', async () => {
      const store = await make();
      const s = contractWorkspace('s');
      await store.createWorkspace({ id: 'ws_stale', name: 'Stale', kind: 'own', createdAt: '2026-10-30T12:00:00.000Z' }, s);
      const g = s.goals[0]!;
      const edit = (title: string): Commit => withExpectations({ goals: [{ ...g, title }], changes: [] }, s);
      await store.commit('ws_stale', edit('Once'));
      expect(isStale(await store.commit('ws_stale', edit('Twice')).then(() => null, (e: unknown) => e))).toBe(true);
    }, 60_000);

    it('resets the example only when it has one (the demo’s plumbing, not the port’s)', async () => {
      const store = await make();
      const demo = examplesOf(store);
      if (demo) expect((await demo.resetExample()).goals.length).toBeGreaterThan(0);
      // A store without the example has nothing to reset: the shared stores have no such method, and a browser store
      // made without the example refuses.
      else if ('resetExample' in store) await expect((store as { resetExample(): Promise<unknown> }).resetExample()).rejects.toThrow();
    }, 60_000);
  });
}
