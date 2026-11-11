// @vitest-environment node
/* Every Deps for the AI tools' endpoint passes the same contract (src/ports/contracts/deps.ts): the smallest one, over
   a goals store in memory; plain Postgres's (PGlite, after bootstrap.sql and every migration); and Supabase's (its
   real adapter, on a stand-in client over the same Postgres). */
import { BrowserStore } from '../data/store';
import { depsContract } from '../ports/contracts/deps';
import { postgresDeps } from './postgres/server';
import { PostgresStore } from './postgres/goalsStore';
import { freshPostgres } from './postgres/testDb';
import { storeDeps } from './storeDeps';
import { SupabaseStore } from './supabase/goalsStore';
import { supabaseDeps } from './supabase/server';
import { pgSupabase } from './supabase/testClient';

/** A browser's localStorage, in memory. */
const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

depsContract('over a goals store, in memory', async () => {
  const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'), { storage: memory(), example: false, key: 'deps' });
  return { deps: storeDeps(store), create: (w, d) => store.createWorkspace(w, d) };
});

depsContract('plain Postgres', async () => {
  const db = await freshPostgres();
  const store = new PostgresStore(db);
  return { deps: postgresDeps(db), create: (w, d) => store.createWorkspace(w, d) };
});

depsContract('Supabase', async () => {
  const client = pgSupabase(await freshPostgres());
  const store = new SupabaseStore('https://stand-in.supabase.co', 'public-key', client);
  return { deps: supabaseDeps('https://faro.test', { SUPABASE_URL: 'https://stand-in.supabase.co', VITE_SUPABASE_KEY: 'public-key' }, client), create: (w, d) => store.createWorkspace(w, d) };
});
