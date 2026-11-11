/* The AI tools' endpoint's outside world (its Deps, server/mcp.ts) on plain Postgres: the goals store (goalsStore.ts)
   for loads and saves, and the database's own functions for tokens (migration 0024), so a token is found by its hash
   in one lookup and its secret is made and hashed by the database. Talks SQL through anything with a `query` method
   (node-postgres, or PGlite in the tests). It passes the endpoint's contract (src/ports/contracts/deps.ts). The
   endpoint on Vercel uses the Supabase one (src/adapters/supabase/server.ts); this is the one to copy for a server
   that connects to Postgres itself. */
import type { Deps } from '../../../server/mcp';
import { tokenFromRow, type TokenRow } from '../../data/rows';
import { PostgresStore, type Sql } from './goalsStore';

export function postgresDeps(db: Sql): Deps {
  const store = new PostgresStore(db);
  // The hash of the token this request came with, to note when it was used.
  let seen: string | null = null;
  const one = async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows[0];
  return {
    async findToken(hash) {
      const row = await one<TokenRow>('select * from okr_token_find($1)', [hash]);
      if (!row) return null;
      seen = hash;
      return { token: tokenFromRow(row), workspaceId: row.workspace_id };
    },
    workspaceName: async (id) => (await one<{ name: string }>('select name from okr_workspaces where id = $1', [id]))?.name ?? 'Workspace',
    load: (ws) => store.load(ws),
    commit: (ws, c) => store.commit(ws, c),
    async touch() { if (seen) await db.query('select okr_token_touch($1)', [seen]); },
    issueToken: (ws, c) => store.issueToken(ws, c),
    deleteWorkspace: (ws) => store.deleteWorkspace(ws),
    recording: async (id) => (await one<{ recording: boolean | null }>('select recording from okr_workspaces where id = $1', [id]))?.recording !== false,
    modulesOff: async (id) => (await one<{ modules_off: string[] | null }>('select modules_off from okr_workspaces where id = $1', [id]))?.modules_off ?? [],
  };
}
