/* The AI tools' endpoint's contract (AX8, architecture readiness review finding 9): what any `Deps` (server/mcp.ts)
   must do, whatever it keeps records in. src/adapters/deps.test.ts runs it in memory, on plain Postgres and on the
   Supabase adapter (on a stand-in client over Postgres with Faro's migrations). To run the endpoint on your platform,
   write a Deps from your own adapters and call depsContract with a way to make it; it is done when this passes.

   `create` sets up a workspace the way the app would (Store.createWorkspace); the endpoint itself never makes one. */
import type { Deps } from '../../../server/mcp';
import { createToken, revokeToken, type ActionContext } from '../../domain/actions';
import type { Snapshot, Workspace } from '../../domain/types';
import { hashToken, newToken } from '../../mcp/protocol';
import { contractWorkspace } from './store';

const NOW = new Date('2026-10-30T12:00:00Z');

let n = 0;
const ids = (p: string) => `${p}_d${String(++n).padStart(4, '0')}`;
const ctx = (s: Snapshot): ActionContext => ({ snapshot: s, full: s, allGoals: s.goals, cycle: s.cycles[0]!, week: 1, actor: s.people.find((p) => p.admin)!, now: NOW.toISOString(), newId: ids } as unknown as ActionContext);

/** A token for someone in the workspace, saved as the endpoint saves one: through issueToken when the Deps has it, or
    made here and committed with its hash. Returns the secret and the token's id. */
async function issue(deps: Deps, ws: string, s: Snapshot, personId: string): Promise<{ secret: string; id: string }> {
  const c = createToken(ctx(s), personId, 'Claude in a contract');
  const id = c.tokens![0]!.id;
  if (deps.issueToken) return { secret: await deps.issueToken(ws, c), id };
  const secret = newToken();
  const tokenHash = await hashToken(secret);
  await deps.commit(ws, { ...c, tokens: c.tokens!.map((t) => ({ ...t, tokenHash })) });
  return { secret, id };
}

export interface DepsMade {
  deps: Deps;
  /** Sets up a workspace with these records, as the app would. */
  create(w: Workspace, data: Snapshot): Promise<void>;
}

export function depsContract(name: string, make: () => Promise<DepsMade>) {
  describe(`the AI tools’ endpoint contract (Deps): ${name}`, () => {
    let deps: Deps;
    let made: DepsMade;
    let ws: string;
    let start: Snapshot;
    let token: { secret: string; id: string };
    beforeAll(async () => {
      made = await make();
      deps = made.deps;
      ws = ids('ws');
      start = contractWorkspace(`d${n}`);
      await made.create({ id: ws, name: 'Contract endpoint', kind: 'own', createdAt: NOW.toISOString() }, start);
      token = await issue(deps, ws, start, start.people[1]!.id);
    }, 60_000);

    it('finds a live token by its hash, with its person and workspace, and never a wrong one', async () => {
      const found = await deps.findToken(await hashToken(token.secret));
      expect(found?.workspaceId).toBe(ws);
      expect(found?.token).toMatchObject({ id: token.id, personId: start.people[1]!.id, name: 'Claude in a contract', revokedAt: null });
      expect(await deps.findToken(await hashToken('gk_' + 'x'.repeat(40)))).toBeNull();
      expect(await deps.findToken(await hashToken(token.secret.slice(0, -1)))).toBeNull();
    });

    it('names the workspace', async () => {
      expect(await deps.workspaceName(ws)).toBe('Contract endpoint');
    });

    it('loads the workspace whole, and never its tokens’ secrets', async () => {
      const s = await deps.load(ws);
      expect(s.goals.map((g) => g.id).sort()).toEqual(start.goals.map((g) => g.id).sort());
      expect(s.people.map((p) => p.id).sort()).toEqual(start.people.map((p) => p.id).sort());
      expect(s.tokens?.map((t) => t.id)).toContain(token.id);
      expect(JSON.stringify(s)).not.toContain(token.secret);
    });

    it('saves a change and loads it back', async () => {
      const s = await deps.load(ws);
      const c = { changes: [{ id: ids('chg'), at: NOW.toISOString(), actorId: s.people[0]!.id, goalId: s.goals[0]!.id, entity: 'note' as const, entityId: ids('note'), action: 'noted' as const, summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: 'Through the endpoint' }] }] };
      await deps.commit(ws, c);
      expect((await deps.load(ws)).changes.some((x) => x.id === c.changes[0]!.id)).toBe(true);
    });

    it('notes a token as used without failing', async () => {
      await deps.findToken(await hashToken(token.secret));
      await expect(deps.touch(token.id, NOW.toISOString())).resolves.not.toThrow();
    });

    it('says whether the workspace records, and which modules are off (unknown is on, and none)', async () => {
      if (deps.recording) expect(await deps.recording(ws)).toBe(true);
      if (deps.modulesOff) expect(await deps.modulesOff(ws)).toEqual([]);
    });

    it('stops finding a token once it is revoked', async () => {
      const s = await deps.load(ws);
      const other = await issue(deps, ws, s, start.people[2]!.id);
      expect(await deps.findToken(await hashToken(other.secret))).not.toBeNull();
      await deps.commit(ws, revokeToken(ctx(await deps.load(ws)), other.id)!);
      expect(await deps.findToken(await hashToken(other.secret))).toBeNull();
      expect(await deps.findToken(await hashToken(token.secret))).not.toBeNull();
    });

    it('deletes a workspace and everything in it, its tokens too, and leaves the others', async () => {
      if (!deps.deleteWorkspace) return;
      const gone = ids('ws');
      const s = contractWorkspace(`d${n}`);
      await made.create({ id: gone, name: 'Short-lived', kind: 'own', createdAt: NOW.toISOString() }, s);
      const t = await issue(deps, gone, s, s.people[1]!.id);
      await deps.deleteWorkspace(gone);
      expect(await deps.findToken(await hashToken(t.secret))).toBeNull();
      await expect(deps.load(gone)).rejects.toThrow();
      expect((await deps.load(ws)).goals.length).toBe(start.goals.length);
    });
  });
}
