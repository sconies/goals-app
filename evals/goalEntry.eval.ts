/* N19, one check at every door (goal entry spec, section 8; GE1). For each worked example of rule 2, the form (planGoal,
   which the saveGoal action runs), a Goals row through the change engine (planChanges), set-up's goal card and the AI
   tools' create_goal give the same level and the same words. No goal the change engine would refuse can be saved by the
   form, since the form's commit is the saveGoal action's. With GE2 the same holds for the questions (rule 3,
   goalChecks): the form, a Goals row and create_goal ask them in the same words, and none saves until each is answered.
   goalChecks reads the same-named goals it is given (the finder's answer), never the whole list: N19's 30,000-goal half
   waits for the Search port's goal finder to answer it on the server (AX5). */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { loadGoalEntry, perform, type RunContext } from '../src/app/actions';
import { applyCommit } from '../src/data/store';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { NotAllowed } from '../src/domain/actions';
import { planChanges, type Rec } from '../src/domain/changeset';
import { currentCycle, scopeToCycle } from '../src/domain/cycle';
import { blankGoal, type GoalDraft } from '../src/domain/goal';
import { goalChecks, goalMustFix } from '../src/domain/goalEntry';
import { currentWeek } from '../src/domain/plan';
import type { ApiToken, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (text: string) => `[GOAL-ENTRY-REQUIRED] N19: ${text}`;
const TODAY = new Date('2026-11-05T12:00:00Z');
const full = seed(TODAY);
const cycle = currentCycle(full.cycles, TODAY)!;
const snapshot = scopeToCycle(full, cycle);
const week = currentWeek(cycle, TODAY);
const tunde = full.people.find((p) => p.id === 'tunde')!;
const team = full.teams.find((t) => t.id === tunde.teamId)!;
let n = 0;
const newId = (p: string) => `${p}_n${++n}`;
const ctx = (who = 'tunde'): RunContext => ({ snapshot, cycle, week, actor: full.people.find((p) => p.id === who)!, now: TODAY.toISOString(), newId, workspace: { id: 'w', name: 'Platform' }, modules: [] });

/** One goal, as the form drafts it, as a Goals row, and as create_goal's arguments. */
interface Case { name: string; draft: Partial<GoalDraft>; row: Record<string, string>; tool: Record<string, unknown> }
const CASES: Case[] = [
  { name: 'a name of two characters', draft: { title: 'ab', unit: '%', start: '10', target: '20' }, row: { Goal: 'ab', Unit: '%', Start: '10', Target: '20' }, tool: { title: 'ab', type: 'metric', unit: '%', start: 10, target: 20 } },
  { name: 'no start', draft: { unit: '%', start: '', target: '20' }, row: { Unit: '%', Target: '20' }, tool: { type: 'metric', unit: '%', target: 20 } },
  { name: 'a target the same as the start', draft: { unit: '%', start: '40', target: '40' }, row: { Unit: '%', Start: '40', Target: '40' }, tool: { type: 'metric', unit: '%', start: 40, target: 40 } },
  { name: 'a start with words in it', draft: { unit: '%', start: '12 days', target: '30' }, row: { Unit: '%', Start: '12 days', Target: '30' }, tool: null as never },
  { name: 'a start finer than the places chosen', draft: { unit: '%', start: '12.5', target: '30', decimals: '0' }, row: { Unit: '%', Start: '12.5', Target: '30', Decimals: '0' }, tool: { type: 'metric', unit: '%', start: 12.5, target: 30, decimals: 0 } },
  { name: 'a range with no limit', draft: { kind: 'range', unit: '%' }, row: { Type: 'range', Unit: '%', 'Must stay': 'at most', Margin: '1' }, tool: { type: 'range', unit: '%', must_stay: 'at most', margin: 1 } },
  { name: 'a negative warning margin', draft: { kind: 'range', unit: '%', limit: '12', margin: '-1' }, row: { Type: 'range', Unit: '%', Limit: '12', Margin: '-1' }, tool: { type: 'range', unit: '%', limit: 12, margin: -1 } },
];
const draftOf = (c: Case): GoalDraft => ({ ...blankGoal(team.id, tunde.id, ''), title: 'A goal of my own', ...c.draft });
const rowOf = (c: Case): Rec => ({ __row: '2', goal: 'A goal of my own', owner: tunde.name, ...Object.fromEntries(Object.entries(c.row).map(([k, v]) => [k.toLowerCase(), v])) });

async function tools(personId: string) {
  let data: Snapshot = seed(TODAY);
  const token = newToken();
  const t: ApiToken = { id: 'tok', personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: TODAY.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [t] };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'acme' } : null), workspaceName: async () => 'Acme', load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); }, touch: async () => undefined, deleteWorkspace: async () => undefined, now: () => TODAY,
  };
  let k = 0;
  return async (name: string, args: object) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++k, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    const body = await res.json() as { result: { content: { text: string }[]; isError: boolean } };
    return { text: body.result.content[0]!.text, error: body.result.isError };
  };
}

beforeAll(() => loadGoalEntry());

describe('one check at every door (N19)', () => {
  for (const c of CASES) {
    it(R(`${c.name}: the form, a Goals row and the AI tools refuse it in the same words`), async () => {
      const form = goalMustFix(draftOf(c), { cycleWeeks: cycle.weeks, week, existing: null, door: 'form' });
      expect(form.length, 'the form finds a Must fix').toBeGreaterThan(0);
      const words = form.map((f) => f.text);
      // The form's save (the saveGoal action) refuses with them.
      expect(() => perform(ctx(), 'saveGoal', { draft: draftOf(c) })).toThrow(NotAllowed);
      try { perform(ctx(), 'saveGoal', { draft: draftOf(c) }); } catch (e) { for (const w of words) expect((e as Error).message).toContain(w); }
      // A Goals row: every one a Must fix, with the same words.
      const cs = planChanges({ tables: { goals: [rowOf(c)] }, snapshot, cycle, week, actor: tunde, now: TODAY.toISOString(), newId, via: 'spreadsheet' });
      const must = cs.issues.filter((i) => i.level === 'must');
      expect(must.map((i) => i.message)).toEqual(words);
      expect(cs.commit).toBeNull();
      // The AI tools (numbers only: a tool's start is a number, so it can't have words in it).
      if (c.tool) {
        const call = await tools('tunde');
        const out = await call('create_goal', { title: 'A goal of my own', ...c.tool });
        expect(out.error).toBe(true);
        expect(out.text).toContain('Not saved. Must fix:');
        for (const w of words) expect(out.text).toContain(w);
      }
    });
  }

  it(R('set-up’s goal cards say a missing start, target or limit in the form’s words'), () => {
    const setup = (d: Partial<GoalDraft>) => goalMustFix({ ...blankGoal('s', 's', ''), title: 'Outcome', ...d }, { cycleWeeks: 53, week: 0, existing: null, door: 'setup' }).map((f) => f.text);
    const form = (d: Partial<GoalDraft>) => goalMustFix({ ...blankGoal('s', 's', ''), title: 'Outcome', ...d }, { cycleWeeks: 53, week: 0, existing: null, door: 'form' }).map((f) => f.text);
    for (const d of [{ start: '', target: '' }, { kind: 'range' as const, limit: '' }, { start: 'abc', target: '5' }]) expect(setup(d)).toEqual(form(d));
    expect(setup({ start: '', target: '' })).toEqual(['Enter where it starts today.', 'Enter the target.']);
  });

  it(R('anyone may add a goal for anyone, at any level, at every door; only its owner or an admin may change it'), async () => {
    const amara = full.people.find((p) => p.id === 'amara')!;
    const draft = { ...blankGoal(team.id, amara.id, ''), title: 'A north star for Amara', level: 'north' as const, unit: '%', start: '10', target: '20' };
    // Amara is in another team than Tunde's: asked first (rule 3's owner-other-team), never refused.
    expect(() => perform(ctx(), 'saveGoal', { draft })).toThrow(/Amara is in .*\. Which team is this goal for\?/);
    expect(perform(ctx(), 'saveGoal', { draft, confirm: true }).goal.ownerId).toBe('amara');
    const cs = planChanges({ tables: { goals: [{ __row: '2', goal: 'A north star for Amara', owner: amara.name, level: 'north star', unit: '%', start: '10', target: '20' }] }, snapshot, cycle, week, actor: tunde, now: TODAY.toISOString(), newId, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.level === 'must')).toEqual([]);
    const call = await tools('tunde');
    const out = await call('create_goal', { title: 'A north star for Amara', type: 'metric', owner: amara.name, level: 'north star', unit: '%', start: 10, target: 20 });
    expect(out.error, out.text).toBe(false);
    const theirs = snapshot.goals.find((g) => g.ownerId !== 'tunde')!;
    expect(() => perform(ctx(), 'saveGoal', { draft: { ...blankGoal(theirs.teamId, theirs.ownerId, ''), title: 'Renamed' }, goalId: theirs.id })).toThrow(/its owner\) or an admin/);
  });

  /** Questions as the form drafts them, as a Goals row, and as create_goal's arguments. */
  const QUESTIONS: Case[] = [
    { name: 'over 100%', draft: { unit: '%', start: '50', target: '150' }, row: { Unit: '%', Start: '50', Target: '150' }, tool: { type: 'metric', unit: '%', start: 50, target: 150 } },
    { name: 'over 100% together with a hundredfold', draft: { unit: '%', start: '10', target: '1500' }, row: { Unit: '%', Start: '10', Target: '1500' }, tool: { type: 'metric', unit: '%', start: 10, target: 1500 } },
    { name: 'a warning as wide as the limit', draft: { kind: 'range', unit: '%', limit: '12', margin: '20' }, row: { Type: 'range', Unit: '%', Limit: '12', Margin: '20' }, tool: { type: 'range', unit: '%', limit: 12, margin: 20 } },
  ];
  for (const c of QUESTIONS) {
    it(R(`${c.name}: the form, a Goals row and the AI tools ask the same questions in the same words, and save once answered`), async () => {
      const asked = goalChecks(draftOf(c), { week, cycleWeeks: cycle.weeks, existing: null, door: 'form' }).map((q) => q.question);
      expect(asked.length, 'the form asks').toBeGreaterThan(0);
      expect(() => perform(ctx(), 'saveGoal', { draft: draftOf(c) })).toThrow(/Check with the person first/);
      try { perform(ctx(), 'saveGoal', { draft: draftOf(c) }); } catch (e) { for (const q of asked) expect((e as Error).message).toContain(q); }
      expect(perform(ctx(), 'saveGoal', { draft: draftOf(c), confirm: true }).goal.title).toBe('A goal of my own');
      const cs = planChanges({ tables: { goals: [rowOf(c)] }, snapshot, cycle, week, actor: tunde, now: TODAY.toISOString(), newId, via: 'spreadsheet' });
      expect(cs.issues.filter((i) => i.level === 'check').map((i) => i.message)).toEqual(asked);
      expect(cs.commit).toBeNull();
      expect(planChanges({ tables: { goals: [rowOf(c)] }, snapshot, cycle, week, actor: tunde, now: TODAY.toISOString(), newId, via: 'spreadsheet', confirm: true }).commit).not.toBeNull();
      const call = await tools('tunde');
      const out = await call('create_goal', { title: 'A goal of my own', ...c.tool });
      expect(out.error).toBe(true);
      expect(out.text).toContain('Not saved. Check with the person first:');
      for (const q of asked) expect(out.text).toContain(q);
      const again = await call('create_goal', { title: 'A goal of my own', ...c.tool, confirm: true });
      expect(again.error, again.text).toBe(false);
    });
  }
});
