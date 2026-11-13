// @vitest-environment node
/* With Reviews switched off, what reads name no review (build review of #424, medium 2): `inreview=` is no filter on
   Goals or in find_goals, as a switched-off module's column isn't (module map F4), and has no words; the JSON export and
   get_goal hold no notes said in reviews, as the workbook has no Notes sheet. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { EMPTY_QUERY, applyQuery, queryParts } from '../domain/query';
import { callTool, type McpContext } from '../mcp/tools';
import { beforeReview } from '../domain/habit';
import { goalRows, heldForGoals } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const review = full.reviews.find((r) => !r.removedAt)!;
const mcp = (modulesOff: string[]): McpContext => {
  const actor = full.people.find((p) => p.admin && !p.leftAt && !p.removedAt)!;
  return { ws: { id: 'w', name: 'Platform', modulesOff }, snapshot: s, cycle, week, today, actor, now: '2026-11-05T13:00:00Z', newId: (p) => p, allGoals: full.goals, full,
    save: async () => {}, issueToken: async () => 'secret' };
};

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
    const r = await callTool('find_goals', { ...(query ? { query } : {}), limit: 200 }, mcp(modulesOff));
    expect(r.isError).toBeFalsy();
    return JSON.parse(r.text).total as number;
  };
  it('find_goals: the review’s goals while Reviews is on, every goal while it is off', async () => {
    const every = await find(['reviews']);
    expect(await find([], `inreview=${review.id}`)).toBeLessThan(every);
    expect(await find(['reviews'], `inreview=${review.id}`)).toBe(every);
  });
});

describe('the JSON export with Reviews off', () => {
  const json = async (modulesOff: string[]) => JSON.parse((await callTool('export', { format: 'json' }, mcp(modulesOff))).text);
  it('holds the notes said in reviews while Reviews is on, and none while it is off (as notes_csv is refused)', async () => {
    const on = await json([]);
    expect(on.notes.length).toBeGreaterThan(0);
    const off = await json(['reviews']);
    expect(off.notes).toBeUndefined();
    expect(off.about).not.toMatch(/review/i);
    expect(off.goals.length).toBe(on.goals.length);
    expect((await callTool('export', { format: 'notes_csv' }, mcp(['reviews']))).isError).toBe(true);
  });
  it('get_goal holds no review notes while Reviews is off', async () => {
    const goalId = (s.decisions.find((d) => d.kind === 'note' && d.reviewId && !d.removedAt && s.goals.some((g) => g.id === d.goalId)))!.goalId;
    const get = async (off: string[]) => JSON.parse((await callTool('get_goal', { goal_id: goalId }, mcp(off))).text);
    expect((await get([])).notes.length).toBeGreaterThan(0);
    expect((await get(['reviews'])).notes).toBeUndefined();
  });
});

describe('a team’s habit panel names a review only when one is held that day for its people (RS1, spec 2.1)', () => {
  const team = (id: string) => s.goals.filter((g) => g.teamId === id && !g.removedAt && !g.stoppedAt);
  const held = (on: boolean, id: string) => heldForGoals(on, s, cycle, week, team(id));
  const panel = (id: string, h: boolean) => beforeReview(team(id), week, { checkIns: s.checkIns, asks: s.requests ?? [] }, cycle, today, 'nobody', h)!;
  it('is held for a team whose owners are in Thursday’s Platform leadership weekly, not for one whose aren’t, and never with Reviews off', () => {
    expect(held(true, 'devex')).toBe(true);
    expect(held(true, 'cicd')).toBe(false);
    expect(held(false, 'devex')).toBe(false);
  });
  it('with Reviews on and no review that day, the panel says the plain deadline words', () => {
    const p = panel('cicd', held(true, 'cicd'));
    expect(p.words.review).toBe(false);
    expect([p.words.onTime, p.words.day]).toEqual(['on time', 'Thursday']);
    expect(p.says).not.toMatch(/before it/);
    expect(panel('devex', held(true, 'devex')).words.onTime).toBe('before the review');
  });
});
