/* Spec scenarios for looking after the workspace itself (review notes, 5 Nov): admins rename it and add, rename and
   remove teams. A team with people or goals is moved first, in the same save. The same rules hold in the app and for
   an AI assistant, through the MCP server, and every change is logged. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit, BrowserStore, newId } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import * as A from '../src/domain/actions';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import type { ApiToken, Goal, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (text: string) => `[WORKSPACE-ADMIN] ${text}`;
const OCT = new Date('2026-11-05T12:00:00Z');

function ctx(personId: string, s: Snapshot = seed(OCT), extraGoals: Goal[] = []): A.ActionContext {
  const cycle = currentCycle(s.cycles, OCT)!;
  return { snapshot: scopeToCycle(s, cycle), cycle, week: 45, actor: s.people.find((p) => p.id === personId)!, now: OCT.toISOString(), newId, allGoals: [...s.goals, ...extraGoals] };
}

async function assistant(personId: string) {
  let data: Snapshot = seed(OCT);
  let name = 'Acme';
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: OCT.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [t] };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'acme' } : null),
    workspaceName: async () => name,
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); if (c.workspace) name = c.workspace.name; },
    touch: async () => undefined,
    now: () => OCT,
  };
  let n = 0;
  const call = async (tool: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name: tool, arguments: args } }) }), deps);
    const body = await res.json() as { result?: { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean }; error?: { message: string } };
    if (!body.result) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return { text: body.result.content[0]!.text, data: body.result.structuredContent, error: body.result.isError };
  };
  return { call, data: () => data, name: () => name };
}

describe('Admins look after the workspace: its name and its teams', () => {
  it(R('only an admin renames the workspace; the new name is trimmed and logged with the old one'), () => {
    expect(() => A.renameWorkspace(ctx('rhea'), { id: 'platform-org', name: 'Acme' }, 'Mine now')).toThrow(/Only admins/);
    expect(() => A.renameWorkspace(ctx('amara'), { id: 'platform-org', name: 'Acme' }, '   ')).toThrow(/Give the workspace a name/);
    expect(A.renameWorkspace(ctx('amara'), { id: 'platform-org', name: 'Acme' }, 'Acme')).toBeNull();
    const c = A.renameWorkspace(ctx('amara'), { id: 'platform-org', name: 'Acme' }, '  Acme   Platform ')!;
    expect(c.workspace).toEqual({ name: 'Acme Platform' });
    expect(c.changes[0]).toMatchObject({ entity: 'workspace', action: 'edited', actorId: 'amara', diffs: [{ field: 'Workspace name', from: 'Acme', to: 'Acme Platform' }] });
  });

  it(R('an admin adds a team and renames it; names are unique, whatever their case'), () => {
    const x = ctx('grace');
    expect(() => A.saveTeam(ctx('mateo'), { name: 'Insights' })).toThrow(/Only admins/);
    expect(() => A.saveTeam(x, { name: 'developer experience' })).toThrow(/already a team called Developer Experience/);
    const added = A.saveTeam(x, { name: 'Insights', leadId: 'arjun' });
    expect(added.commit!.teams).toEqual([{ id: added.id, name: 'Insights', leadId: 'arjun', objective: '' }]);
    expect(added.commit!.changes[0]!.summary).toBe('Added the team “Insights”');
    const s = applyCommit(seed(OCT), added.commit!);
    const renamed = A.saveTeam(ctx('grace', s), { id: added.id, name: 'Insights Platform' });
    expect(renamed.commit!.changes[0]!.diffs).toEqual([{ field: 'Team name', from: 'Insights', to: 'Insights Platform' }]);
    expect(A.saveTeam(ctx('grace', s), { id: added.id, name: 'Insights' }).commit).toBeNull();
  });

  it(R('a team with people or goals isn’t removed until they’re moved; moved, they go in the same save, logged on each goal'), () => {
    const x = ctx('amara');
    expect(() => A.removeTeam(x, 'infra')).toThrow(/Infrastructure & Compute still has \d+ (person|people) and \d+ goals?\. Move them to another team first/);
    expect(() => A.removeTeam(x, 'infra', 'infra')).toThrow(/another team/);
    const c = A.removeTeam(x, 'infra', 'devex');
    expect(c.removeTeams).toEqual(['infra']);
    expect(c.people!.every((p) => p.teamId === 'devex')).toBe(true);
    expect(c.goals!.length).toBeGreaterThan(0);
    const s = applyCommit(seed(OCT), c);
    expect(s.teams.some((t) => t.id === 'infra')).toBe(false);
    expect(s.goals.filter((g) => g.teamId === 'infra')).toEqual([]);
    expect(c.changes.filter((ch) => ch.entity === 'goal').map((ch) => ch.diffs[0])).toEqual(c.goals!.map(() => ({ field: 'Team', from: 'Infrastructure & Compute', to: 'Developer Experience' })));
    // An empty team goes on its own.
    const empty = A.saveTeam(ctx('amara'), { name: 'Spare' });
    const s2 = applyCommit(seed(OCT), empty.commit!);
    expect(A.removeTeam(ctx('amara', s2), empty.id).changes[0]!.summary).toBe('Removed the team “Spare”');
  });

  it(R('goals in an earlier cycle count: a team that only has old goals still has to be moved'), () => {
    const s = applyCommit(seed(OCT), A.saveTeam(ctx('amara'), { id: undefined, name: 'Old' }).commit!);
    const team = s.teams.find((t) => t.name === 'Old')!;
    const old: Goal = { ...s.goals[0]!, id: 'old-goal', cycleId: 'last-year', teamId: team.id };
    expect(() => A.removeTeam(ctx('amara', s, [old]), team.id)).toThrow(/still has 1 goal/);
    expect(A.removeTeam(ctx('amara', s, [old]), team.id, 'cicd').goals!.map((g) => g.id)).toEqual(['old-goal']);
  });

  it(R('the browser store keeps a renamed workspace’s name, and an example’s new name until it’s reset'), async () => {
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    try {
      const store = new BrowserStore(() => OCT);
      await store.load('platform-org');
      await store.commit('platform-org', { workspace: { name: 'Our Platform' }, changes: [] });
      expect((await store.workspaces()).find((w) => w.id === 'platform-org')!.name).toBe('Our Platform');
      await store.resetExample('platform-org');
      expect((await store.workspaces()).find((w) => w.id === 'platform-org')!.name).toBe('Example: Platform Engineering');
    } finally { delete (globalThis as any).localStorage; }
  });

  it(R('an assistant renames the workspace and adds, renames and removes a team, under the same rules, logged as the person'), async () => {
    const mateo = await assistant('mateo');
    const no = await mateo.call('rename_workspace', { name: 'Mateo’s' });
    expect(no.error).toBe(true);
    expect(no.text).toMatch(/Only admins/);
    const amara = await assistant('amara');
    expect((await amara.call('rename_workspace', { name: 'Acme Platform' })).text).toMatch(/Renamed the workspace from “Acme” to “Acme Platform”/);
    expect(amara.name()).toBe('Acme Platform');
    const added = await amara.call('save_team', { name: 'Insights', lead: 'Arjun' });
    expect(added.error).toBe(false);
    const id = added.data!.id as string;
    expect(amara.data().teams.find((t) => t.id === id)).toMatchObject({ name: 'Insights', leadId: 'arjun' });
    await amara.call('save_team', { team: 'Insights', name: 'Insights Platform' });
    expect(amara.data().teams.find((t) => t.id === id)!.name).toBe('Insights Platform');
    const refused = await amara.call('remove_team', { team: 'Security Engineering' });
    expect(refused.error).toBe(true);
    expect(refused.text).toMatch(/Security Engineering still has .* Move them to another team first/);
    expect((await amara.call('remove_team', { team: 'Security Engineering', move_to: 'Insights Platform' })).error).toBe(false);
    const s = amara.data();
    expect(s.teams.some((t) => t.id === 'sec')).toBe(false);
    expect(s.people.find((p) => p.id === 'farah')!.teamId).toBe(id);
    const last = s.changes.filter((c) => c.entity === 'workspace').at(-1)!;
    expect(last.actorId).toBe('amara');
    expect(last.diffs.some((d) => d.field === 'Via' && d.to === 'AI assistant (MCP)')).toBe(true);
    const teams = (await amara.call('list_people')).data!.teams as { name: string; people: number }[];
    expect(teams.find((t) => t.name === 'Insights Platform')!.people).toBeGreaterThan(0);
  });
});
