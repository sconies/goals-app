// @vitest-environment node
/* Every goals store passes the same contract (src/ports/contracts/store.ts): the browser's, Supabase's (its real
   adapter, on a stand-in client over Postgres with Faro's migrations, in the faro schema and through the old names)
   and plain Postgres's (PGlite, after
   bootstrap.sql and the same migrations). */
import { BrowserStore } from '../data/store';
import { storeContract } from '../ports/contracts/store';
import { PostgresStore } from './postgres/goalsStore';
import { freshPostgres } from './postgres/testDb';
import { SupabaseStore } from './supabase/goalsStore';
import { pgSupabase } from './supabase/testClient';

/** A browser's localStorage, in memory. */
const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

storeContract('in the browser', async () => new BrowserStore(() => new Date('2026-10-30T12:00:00Z'), { storage: memory(), example: false, key: 'contract' }));
storeContract('Supabase', async () => new SupabaseStore('https://stand-in.supabase.co', 'public-key', pgSupabase(await freshPostgres())));
// While Supabase's Data API doesn't offer the faro schema yet, the app reaches the same tables through the redirects
// migration 0035 left under the old names in public (backlog 0c): the same contract, through those.
storeContract('Supabase, through the old names in public', async () => new SupabaseStore('https://stand-in.supabase.co', 'public-key', pgSupabase(await freshPostgres(), undefined, 'public')));
storeContract('plain Postgres', async () => new PostgresStore(await freshPostgres()));
