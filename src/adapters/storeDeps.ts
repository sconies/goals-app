/* The AI tools' endpoint's outside world (its Deps, server/mcp.ts) from nothing but a goals store: the smallest Deps
   there is, for a demo or a test, and the shape to start from on a platform with no database functions. Tokens are
   found by reading every workspace, so it suits a handful of workspaces, not many: a real one finds a token by its hash
   in one lookup (src/adapters/postgres/server.ts, src/adapters/supabase/server.ts). It passes the endpoint's contract
   (src/ports/contracts/deps.ts) in memory, on the browser store. */
import type { Deps } from '../../server/mcp';
import type { Store } from '../data/store';

export function storeDeps(store: Store): Deps {
  const workspace = async (id: string) => (await store.workspaces()).find((w) => w.id === id);
  return {
    async findToken(hash) {
      for (const w of await store.workspaces()) {
        const token = (await store.load(w.id)).tokens?.find((t) => t.tokenHash === hash && !t.revokedAt);
        if (token) return { token, workspaceId: w.id };
      }
      return null;
    },
    workspaceName: async (id) => (await workspace(id))?.name ?? 'Workspace',
    load: (id) => store.load(id),
    commit: (id, c) => store.commit(id, c),
    async touch(tokenId, at) {
      for (const w of await store.workspaces()) {
        const t = (await store.load(w.id)).tokens?.find((x) => x.id === tokenId);
        if (t) return store.commit(w.id, { tokens: [{ ...t, lastUsedAt: at }], changes: [] });
      }
    },
    issueToken: (id, c) => store.issueToken(id, c),
    deleteWorkspace: (id) => store.deleteWorkspace(id),
    recording: async (id) => (await workspace(id))?.recording !== false,
    modulesOff: async (id) => (await workspace(id))?.modulesOff ?? [],
  };
}
