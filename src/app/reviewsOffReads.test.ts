// @vitest-environment node
/* With Reviews switched off, what reads name no review (build review of #424, medium 2): `inreview=` is no filter on
   Goals or in find_goals, as a switched-off module's column isn't (module map F4), and has no words. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { EMPTY_QUERY, applyQuery, queryParts } from '../domain/query';
import { callTool, type McpContext } from '../mcp/tools';
import { goalRows } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const review = full.reviews.find((r) => !r.removedAt)!;

describe('inreview= with Reviews off', () => {
  const q = { ...EMPTY_QUERY, inreview: review.id };
  it('narrows Goals to the review’s goals while Reviews is on, and narrows nothing while it is off', () => {
    const on = goalRows(s, cycle, today, week);
    const off = goalRows(s, cycle, today, week, undefined, false);
    const all = applyQuery(off.summaries, EMPTY_QUERY, off.ctx).length;
    expect(applyQuery(on.summaries, q, on.ctx).length).toBeLessThan(all);
    expect(applyQuery(off.summaries, q, off.ctx).length).toBe(all);
  });
  it('has no words on the filter line while Reviews is off', () => {
    const names = { team: (x: string) => x, person: (x: string) => x, goal: (x: string) => x };
    expect(queryParts(q, { ...names, review: () => review.name }).map((p) => p.key)).toEqual(['inreview']);
    expect(queryParts(q, names)).toEqual([]);
  });

  const find = async (modulesOff: string[], query?: string) => {
    const actor = full.people.find((p) => p.admin && !p.leftAt && !p.removedAt)!;
    const ctx: McpContext = { ws: { id: 'w', name: 'Platform', modulesOff }, snapshot: s, cycle, week, today, actor, now: '2026-11-05T13:00:00Z', newId: (p) => p, allGoals: full.goals, full,
      save: async () => {}, issueToken: async () => 'secret' };
    const r = await callTool('find_goals', { ...(query ? { query } : {}), limit: 200 }, ctx);
    expect(r.isError).toBeFalsy();
    return JSON.parse(r.text).total as number;
  };
  it('find_goals: the review’s goals while Reviews is on, every goal while it is off', async () => {
    const every = await find(['reviews']);
    expect(await find([], `inreview=${review.id}`)).toBeLessThan(every);
    expect(await find(['reviews'], `inreview=${review.id}`)).toBe(every);
  });
});
