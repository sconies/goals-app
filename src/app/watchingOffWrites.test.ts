// @vitest-environment node
/* With Watching switched off, nothing saves Watching's records, whichever door (build review of #444, medium 1): the
   refusal goes by what the save writes (domain/watchWrites), not by the names Watch and Stop watching. Undo of a stopped
   watch and restoring one from Recently removed are refused; what a save only carries along still runs; Recently
   removed, in the app and through the AI tools, doesn't list stopped watches while nothing could restore them. */
import { serve, type Deps } from '../../server/mcp';
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit, type Commit } from '../data/store';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { recentlyRemoved } from '../domain/removal';
import { writesWatches } from '../domain/watchWrites';
import type { ApiToken, Snapshot } from '../domain/types';
import { hashToken, newToken } from '../mcp/protocol';
import { perform, type RunContext } from './actions';
import { watchingOffWords } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_ww${++n}`;
const OFF = watchingOffWords('Platform');

function as(who: string, full: Snapshot, off: boolean): RunContext {
  const cycle = currentCycle(full.cycles, today)!;
  const actor = full.people.find((p) => p.id === who)!;
  return { snapshot: scopeToCycle(full, cycle), cycle, week: currentWeek(cycle, today), actor, now: '2026-11-05T13:00:00Z', newId, allGoals: full.goals, full, workspace: { id: 'w', name: 'Platform', ...(off ? { modulesOff: ['watching'] } : {}) }, modules: [] };
}

/** The demo with one of amara's watches stopped (with Watching on), and the commit that stopped it. */
function stopped() {
  const start = buildPlatformOrg(today);
  const w = start.watches.find((v) => v.personId === 'amara' && !v.removedAt)!;
  const stop = perform(as('amara', start, false), 'unwatch', { watchId: w.id }) as Commit;
  return { start, w, stop, after: applyCommit(start, stop) };
}

describe('the rule', () => {
  it('is true of a watch started, stopped or brought back, and false of watches carried along with goals or a cycle', () => {
    const w = { id: 'w1', personId: 'p', kind: 'goal' as const, ref: 'g1' };
    expect(writesWatches({ watches: [w], changes: [] })).toBe(true);
    expect(writesWatches({ unwatch: ['w1'], changes: [] })).toBe(true);
    expect(writesWatches({ watches: [w], changes: [{ id: 'c', at: '', actorId: 'p', goalId: null, entity: 'watch', entityId: 'w1', action: 'restored', summary: '', diffs: [] }] })).toBe(true);
    const goal = buildPlatformOrg(today).goals[0]!;
    expect(writesWatches({ goals: [goal], watches: [w], changes: [] })).toBe(false);
    expect(writesWatches({ goals: [goal], changes: [] })).toBe(false);
  });
});

describe('the app, with Watching off', () => {
  it('refuses Undo of a stopped watch and restoring it from Recently removed, in Watching’s words', () => {
    const { start, w, stop, after } = stopped();
    expect(() => perform(as('amara', after, true), 'undoRemoval', { removal: stop, before: start })).toThrow(OFF);
    expect(() => perform(as('amara', after, true), 'restoreRemoved', { kind: 'watch', id: w.id })).toThrow(OFF);
    expect(perform(as('amara', after, false), 'restoreRemoved', { kind: 'watch', id: w.id })).toBeTruthy();
  });

  it('still refuses Watch and Stop watching, in the same words', () => {
    const s = buildPlatformOrg(today);
    const w = s.watches.find((v) => v.personId === 'amara' && !v.removedAt)!;
    const goal = s.goals.find((g) => !s.watches.some((v) => v.personId === 'amara' && v.ref === g.id))!;
    expect(() => perform(as('amara', s, true), 'watch', { kind: 'goal', ref: goal.id })).toThrow(OFF);
    expect(() => perform(as('amara', s, true), 'unwatch', { watchId: w.id })).toThrow(OFF);
  });

  it('doesn’t list stopped watches on Recently removed', () => {
    const { w, after } = stopped();
    expect(recentlyRemoved(after, today).some((r) => r.kind === 'watch' && r.id === w.id)).toBe(true);
    expect(recentlyRemoved(after, today, undefined, [], { watches: false }).some((r) => r.kind === 'watch')).toBe(false);
  });
});

describe('the AI tools, with Watching off', () => {
  it('list_removed leaves stopped watches out, and restore_removed on one answers the switched-off sentence and saves nothing', async () => {
    const { w, after } = stopped();
    let data: Snapshot = structuredClone(after);
    const token = newToken();
    const t: ApiToken = { id: 'tok1', personId: 'amara', name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
    let saves = 0;
    const deps: Deps = {
      findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
      workspaceName: async () => 'Platform Engineering', modulesOff: async () => ['watching'], load: async () => data,
      commit: async (_ws, c) => { saves++; data = applyCommit(data, c); }, touch: async () => undefined, now: () => today,
    };
    let id = 0;
    const call = async (name: string, args: object = {}) => {
      const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) }), deps);
      return (await res.json()).result as { content: { text: string }[]; structuredContent?: Record<string, unknown>; isError: boolean };
    };
    const listed = await call('list_removed');
    expect(JSON.stringify(listed.structuredContent ?? listed.content)).not.toContain(w.id);
    const r = await call('restore_removed', { kind: 'watch', id: w.id });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe('Watching is switched off in Platform Engineering, so restore_removed can’t be used there. An admin can switch it on in Workspace, under Features.');
    expect(saves).toBe(0);
  });
});
