// @vitest-environment node
/* Every goals store passes the same contract (src/ports/contracts/store.ts): the browser's, Supabase's (its real
   adapter, on a stand-in client over Postgres with Faro's migrations, in the faro schema and through the old names)
   and plain Postgres's (PGlite, after
   bootstrap.sql and the same migrations). Each keeps the build's module records and the contract's small test module's
   (CONTRACT_MODULE), whose table each database gets first, as a module's migration would make it. */
import { BrowserStore } from '../data/store';
import { CONTRACT_MODULE, CONTRACT_MODULE_SQL, storeContract } from '../ports/contracts/store';
import { MODULE_RECORDS } from '../core/records';
import { PostgresStore } from './postgres/goalsStore';
import { freshPostgres } from './postgres/testDb';
import { SupabaseStore } from './supabase/goalsStore';
import { pgSupabase } from './supabase/testClient';
import { contractWorkspace } from '../ports/contracts/store';

/** A browser's localStorage, in memory. */
const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

const RECORDS = [...MODULE_RECORDS, CONTRACT_MODULE];
/** A fresh database with the contract module's table. */
const withModule = async () => { const db = await freshPostgres(); await db.exec(CONTRACT_MODULE_SQL); return db; };

storeContract('in the browser', async () => new BrowserStore(() => new Date('2026-10-30T12:00:00Z'), { storage: memory(), example: false, key: 'contract' }));
storeContract('Supabase', async () => new SupabaseStore('https://stand-in.supabase.co', 'public-key', pgSupabase(await withModule()), RECORDS));
// While Supabase's Data API doesn't offer the faro schema yet, the app reaches the same tables through the redirects
// migration 0035 left under the old names in public (backlog 0c): the same contract, through those, except the cycle's
// rhythm (0048), whose columns those fixed views don't show: the app reads it only through faro.
storeContract('Supabase, through the old names in public', async () => new SupabaseStore('https://stand-in.supabase.co', 'public-key', pgSupabase(await withModule(), undefined, 'public'), RECORDS), { without: /check-in rhythm/ });
storeContract('plain Postgres', async () => new PostgresStore(await withModule(), RECORDS));

/* The database stores refuse a save that carries a token with anything else (build review, 11 Nov): a token is made
   through issueToken and revoked on its own, so neither adapter ever splits a save in two. */
describe('a token never rides with other rows', () => {
  for (const [name, make] of [
    ['Supabase', async () => new SupabaseStore('https://stand-in.supabase.co', 'public-key', pgSupabase(await freshPostgres()))],
    ['plain Postgres', async () => new PostgresStore(await freshPostgres())],
  ] as const) {
    it(`${name}: refuses a revoked token saved with a person, and a new token saved at all`, async () => {
      const store = await make();
      const s = contractWorkspace('mix' + name.length);
      await store.createWorkspace({ id: 'ws_mix', name: 'Mixed', kind: 'own', createdAt: '2026-10-30T12:00:00.000Z' }, s);
      const t = { id: 'tok_mix', personId: s.people[0]!.id, name: 'x', createdBy: s.people[0]!.id, createdAt: '2026-10-30T12:00:00.000Z', lastUsedAt: null, revokedAt: '2026-10-30T12:00:00.000Z' };
      await expect(store.commit('ws_mix', { tokens: [t], people: [s.people[1]!], changes: [] })).rejects.toThrow(/one token at a time, on its own/);
      await expect(store.commit('ws_mix', { tokens: [{ ...t, revokedAt: null }], changes: [] })).rejects.toThrow(/make one with issueToken/);
    }, 60_000);
  }
});
