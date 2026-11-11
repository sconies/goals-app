// @vitest-environment node
/* The Supabase adapter as the worked example of a store (backlog AX7): a read that fails fails the load, a missing
   function says the database needs its migrations, and a save is one call. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { contractWorkspace } from '../../ports/contracts/store';
import { freshPostgres } from '../postgres/testDb';
import { SupabaseStore } from './goalsStore';
import { pgSupabase } from './testClient';

type Calls = { rpc: string[]; from: string[] };
/** The stand-in client, with chosen functions answering with an error, and every call counted. */
function client(base: SupabaseClient, fail: Record<string, { code?: string; message: string }>, calls: Calls): SupabaseClient {
  return {
    ...base,
    from: (t: string) => { calls.from.push(t); return base.from(t); },
    rpc: (fn: string, args?: Record<string, unknown>) => {
      calls.rpc.push(fn);
      const e = fail[fn];
      return e ? Promise.resolve({ data: null, error: e }) : base.rpc(fn, args);
    },
  } as unknown as SupabaseClient;
}

describe('the Supabase adapter', () => {
  const ws = 'ws_tidy';
  const NOW = new Date('2026-10-30T12:00:00Z').toISOString();
  let base: SupabaseClient;
  beforeAll(async () => {
    base = pgSupabase(await freshPostgres());
    await new SupabaseStore('https://stand-in.supabase.co', 'k', base).createWorkspace({ id: ws, name: 'Tidy', kind: 'own', createdAt: NOW }, contractWorkspace('tidy'));
  }, 60_000);

  it('fails the load when any read fails, rather than opening the workspace without it', async () => {
    const store = new SupabaseStore('u', 'k', client(base, { okr_token_list: { message: 'The database did not answer in time.' } }, { rpc: [], from: [] }));
    await expect(store.load(ws)).rejects.toThrow(/okr_token_list: The database did not answer in time/);
  });

  it('says plainly when a function is missing: the database needs its migrations', async () => {
    const store = new SupabaseStore('u', 'k', client(base, { okr_commit: { code: 'PGRST202', message: 'Could not find the function faro.okr_commit' } }, { rpc: [], from: [] }));
    await expect(store.commit(ws, { changes: [] })).rejects.toThrow(/no okr_commit: apply the migrations/);
  });

  it('saves in one call, and writes no table directly', async () => {
    const calls: Calls = { rpc: [], from: [] };
    const store = new SupabaseStore('u', 'k', client(base, {}, calls));
    const s = await store.load(ws);
    calls.from.length = 0;
    calls.rpc.length = 0;
    await store.commit(ws, { teams: [{ ...s.teams[0]!, name: 'Renamed team' }], workspace: { name: 'Tidier' }, changes: [] });
    expect(calls).toEqual({ rpc: ['okr_commit'], from: [] });
    expect((await store.workspaces()).find((w) => w.id === ws)?.name).toBe('Tidier');
  });
});
