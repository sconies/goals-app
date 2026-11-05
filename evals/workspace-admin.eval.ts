/* Spec scenarios for looking after the workspace itself (review notes, 5 Nov): admins rename it and add, rename and
   remove teams. A team with people or goals is moved first, in the same save. The same rules hold in the app and for
   an AI assistant, through the MCP server, and every change is logged. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { applyCommit, BrowserStore, newId } from '../src/data/store';
import { seed } from '../src/data/seed';
import * as A from '../src/domain/actions';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import type { ApiToken, Goal, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (text: string) => `[WORKSPACE-ADMIN] ${text}`;
const OCT = new Date('2026-10-30T12:00:00Z');

function ctx(personId: string, s: Snapshot = seed(OCT), extraGoals: Goal[] = []): A.ActionContext {
  const cycle = currentCycle(s.cycles, OCT)!;
  return { snapshot: scopeToCycle(s, cycle), cycle, week: 44, actor: s.people.find((p) => p.id === personId)!, now: OCT.toISOString(), newId, allGoals: [...s.goals, ...extraGoals] };
}

async function assistant(personId: string) {
  let data: Snapshot = seed(OCT);
  let name = 'Acme';
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'elena', createdAt: OCT.toISOString(), lastUsedAt: null, revokedAt: null };
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
    expect(() => A.renameWorkspace(ctx('maya'), { id: 'example', name: 'Acme' }, 'Mine now')).toThrow(/Only admins/);
    expect(() => A.renameWorkspace(ctx('elena'), { id: 'example', name: 'Acme' }, '   ')).toThrow(/Give the workspace a name/);
    expect(A.renameWorkspace(ctx('elena'), { id: 'example', name: 'Acme' }, 'Acme')).toBeNull();
    const c = A.renameWorkspace(ctx('elena'), { id: 'example', name: 'Acme' }, '  Acme   Platform ')!;
    expect(c.workspace).toEqual({ name: 'Acme Platform' });
    expect(c.changes[0]).toMatchObject({ entity: 'workspace', action: 'edited', actorId: 'elena', diffs: [{ field: 'Workspace name', from: 'Acme', to: 'Acme Platform' }] });
  });

  it(R('an admin adds a team and renames it; names are unique, whatever their case'), () => {
    const x = ctx('priya');
    expect(() => A.saveTeam(ctx('kofi'), { name: 'Data' })).toThrow(/Only admins/);
    expect(() => A.saveTeam(x, { name: 'devex' })).toThrow(/already a team called DevEx/);
    const added = A.saveTeam(x, { name: 'Data', leadId: 'leo' });
    expect(added.commit!.teams).toEqual([{ id: added.id, name: 'Data', leadId: 'leo', objective: '' }]);
    expect(added.commit!.changes[0]!.summary).toBe('Added the team “Data”');
    const s = applyCommit(seed(OCT), added.commit!);
    const renamed = A.saveTeam(ctx('priya', s), { id: added.id, name: 'Data Platform' });
    expect(renamed.commit!.changes[0]!.diffs).toEqual([{ field: 'Team name', from: 'Data', to: 'Data Platform' }]);
    expect(A.saveTeam(ctx('priya', s), { id: added.id, name: 'Data' }).commit).toBeNull();
  });

  it(R('a team with people or goals isn’t removed until they’re moved; moved, they go in the same save, logged on each goal'), () => {
    const x = ctx('elena');
    expect(() => A.removeTeam(x, 'infra')).toThrow(/Infrastructure still has \d+ (person|people) and \d+ goals?\. Move them to another team first/);
    expect(() => A.removeTeam(x, 'infra', 'infra')).toThrow(/another team/);
    const c = A.removeTeam(x, 'infra', 'devex');
    expect(c.removeTeams).toEqual(['infra']);
    expect(c.people!.every((p) => p.teamId === 'devex')).toBe(true);
    expect(c.goals!.length).toBeGreaterThan(0);
    const s = applyCommit(seed(OCT), c);
    expect(s.teams.some((t) => t.id === 'infra')).toBe(false);
    expect(s.goals.filter((g) => g.teamId === 'infra')).toEqual([]);
    expect(c.changes.filter((ch) => ch.entity === 'goal').map((ch) => ch.diffs[0])).toEqual(c.goals!.map(() => ({ field: 'Team', from: 'Infrastructure', to: 'DevEx' })));
    // An empty team goes on its own.
    const empty = A.saveTeam(ctx('elena'), { name: 'Spare' });
    const s2 = applyCommit(seed(OCT), empty.commit!);
    expect(A.removeTeam(ctx('elena', s2), empty.id).changes[0]!.summary).toBe('Removed the team “Spare”');
  });

  it(R('goals in an earlier cycle count: a team that only has old goals still has to be moved'), () => {
    const s = applyCommit(seed(OCT), A.saveTeam(ctx('elena'), { id: undefined, name: 'Old' }).commit!);
    const team = s.teams.find((t) => t.name === 'Old')!;
    const old: Goal = { ...s.goals[0]!, id: 'old-goal', cycleId: 'last-year', teamId: team.id };
    expect(() => A.removeTeam(ctx('elena', s, [old]), team.id)).toThrow(/still has 1 goal/);
    expect(A.removeTeam(ctx('elena', s, [old]), team.id, 'pm').goals!.map((g) => g.id)).toEqual(['old-goal']);
  });

  it(R('the browser store keeps a renamed workspace’s name, and an example’s new name until it’s reset'), async () => {
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    try {
      const store = new BrowserStore(() => OCT);
      await store.load('example');
      await store.commit('example', { workspace: { name: 'Our Platform' }, changes: [] });
      expect((await store.workspaces()).find((w) => w.id === 'example')!.name).toBe('Our Platform');
      await store.resetExample('example');
      expect((await store.workspaces()).find((w) => w.id === 'example')!.name).toBe('Example: Developer Platform');
    } finally { delete (globalThis as any).localStorage; }
  });

  it(R('an assistant renames the workspace and adds, renames and removes a team, under the same rules, logged as the person'), async () => {
    const kofi = await assistant('kofi');
    const no = await kofi.call('rename_workspace', { name: 'Kofi’s' });
    expect(no.error).toBe(true);
    expect(no.text).toMatch(/Only admins/);
    const elena = await assistant('elena');
    expect((await elena.call('rename_workspace', { name: 'Acme Platform' })).text).toMatch(/Renamed the workspace from “Acme” to “Acme Platform”/);
    expect(elena.name()).toBe('Acme Platform');
    const added = await elena.call('save_team', { name: 'Data', lead: 'Leo' });
    expect(added.error).toBe(false);
    const id = added.data!.id as string;
    expect(elena.data().teams.find((t) => t.id === id)).toMatchObject({ name: 'Data', leadId: 'leo' });
    await elena.call('save_team', { team: 'Data', name: 'Data Platform' });
    expect(elena.data().teams.find((t) => t.id === id)!.name).toBe('Data Platform');
    const refused = await elena.call('remove_team', { team: 'Security' });
    expect(refused.error).toBe(true);
    expect(refused.text).toMatch(/Security still has .* Move them to another team first/);
    expect((await elena.call('remove_team', { team: 'Security', move_to: 'Data Platform' })).error).toBe(false);
    const s = elena.data();
    expect(s.teams.some((t) => t.id === 'sec')).toBe(false);
    expect(s.people.find((p) => p.id === 'aisha')!.teamId).toBe(id);
    const last = s.changes.filter((c) => c.entity === 'workspace').at(-1)!;
    expect(last.actorId).toBe('elena');
    expect(last.diffs.some((d) => d.field === 'Via' && d.to === 'AI assistant (MCP)')).toBe(true);
    const teams = (await elena.call('list_people')).data!.teams as { name: string; people: number }[];
    expect(teams.find((t) => t.name === 'Data Platform')!.people).toBeGreaterThan(0);
  });
});
