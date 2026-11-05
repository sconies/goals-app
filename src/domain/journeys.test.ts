// @vitest-environment node
import { attentionFor, attentionList } from './attention';
import { buildGoal, draftOf, planChanged, withPlanOf } from './goal';
import { checkInChange, goalChange } from './changes';
import { emptyDraft, toCheckIn } from './checkin';
import { buildWorkspace, GOALS_TEMPLATE, parseTable, PEOPLE_TEMPLATE } from './importer';
import { onTimeStreak, weekProgress } from './progress';
import { goalsIn, reviewSession, sessionWeek, watchedGoals, watchOf } from './review';
import { outcomeTrees } from './tree';
import { currentCycle, nextCycle, scopeToCycle, suggestedResult } from './cycle';
import { buildPlatformOrg } from '../data/platformOrg';
import { quarterResults } from './year';
import { currentWeek, planAt } from './plan';
import type { Goal, MetricGoal } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
/** Today's week in the example's year. */
const SEED_WEEK = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;
const lookup = { person: (id: string) => s.people.find((p) => p.id === id), goal: (id: string) => s.goals.find((g) => g.id === id), teamName: (id: string) => s.teams.find((t) => t.id === id)?.name ?? id };
const kinds = (id: string) => attentionFor(goal(id), s, cycle, today).flags.map((f) => f.kind);

describe('attention', () => {
  it('flags off track, stale, at risk, a worsening trend and a check-in due', () => {
    expect(kinds('lead-mq')).toContain('off');
    expect(kinds('env-search')).toContain('stale');
    expect(kinds('ns-vuln')).toEqual(expect.arrayContaining(['risk', 'due']));
    expect(kinds('ns-devsat')).toContain('trend');
    expect(kinds('ns-ai')).toEqual([]);
  });
  it('puts the worst first and leaves out goals that are merely due', () => {
    const list = attentionList(s, cycle, today);
    expect(list[0]!.status.status).toBe('off');
    expect(list.some((a) => a.goal.id === 'ns-ai')).toBe(false);
    expect(list.some((a) => a.goal.id === 'ci-docker')).toBe(false);
    expect(list.every((a) => a.flags.some((f) => f.kind !== 'due'))).toBe(true);
  });
  it('flags a path to green whose week has passed', () => {
    const c = s.checkIns.filter((x) => x.goalId === 'ns-cfr').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
    const late = { ...s, checkIns: s.checkIns.map((x) => (x.id === c.id ? { ...x, pathToGreen: { ...x.pathToGreen!, byWeek: SEED_WEEK - 1 } } : x)) };
    expect(attentionFor(goal('ns-cfr'), late, cycle, today).flags.map((f) => f.kind)).toContain('missed-path');
  });
});

describe('change log', () => {
  it('records a new goal with its fields', () => {
    const c = goalChange(null, goal('mttr-pir'), lookup, 'mateo', 'now', 'x')!;
    expect(c.action).toBe('created');
    expect(c.diffs.find((d) => d.field === 'Target')).toEqual({ field: 'Target', from: '—', to: '85%' });
  });
  it('records only what changed on an edit, before and after', () => {
    const g = goal('ns-lead') as MetricGoal;
    const c = goalChange(g, { ...g, plan: { ...g.plan, target: 20 } }, lookup, 'rhea', 'now', 'x')!;
    expect(c.diffs).toEqual([{ field: 'Target', from: '24 hours', to: '20 hours' }]);
    expect(c.summary).toBe('Changed target');
  });
  it('logs nothing when nothing changed', () => {
    expect(goalChange(goal('ns-lead'), goal('ns-lead'), lookup, 'rhea', 'now', 'x')).toBeNull();
  });
  it('records a check-in post and an edit to its note', () => {
    const g = goal('ns-ai');
    const v = String(Math.round(planAt((g as MetricGoal).plan, SEED_WEEK + 1, cycle.weeks)));
    const c = toCheckIn(g, cycle, SEED_WEEK + 1, { ...emptyDraft(g, null), value: v }, s.checkIns, 'tariq', today, 'ci');
    expect(checkInChange(null, c, g, 'tariq', 'x')!.summary).toBe(`Checked in for week ${SEED_WEEK + 1}: ${v}% · On track`);
    const edited = checkInChange(c, { ...c, next: 'Turn it on for the mobile repositories' }, g, 'tariq', 'y')!;
    expect(edited.diffs).toEqual([{ field: 'Next step', from: '—', to: 'Turn it on for the mobile repositories' }]);
  });
  it('has a logged creation for every demo goal and a post for every demo check-in', () => {
    expect(s.goals.every((g) => s.changes.some((c) => c.entity === 'goal' && c.entityId === g.id && c.action === 'created'))).toBe(true);
    expect(s.checkIns.every((ci) => s.changes.some((c) => c.entityId === ci.id))).toBe(true);
  });
});

describe('reviews', () => {
  const weekly = s.reviews.find((r) => r.id === 'weekly')!;
  const monthly = s.reviews.find((r) => r.id === 'security')!;
  it('covers whole trees, single goals and levels, each goal once', () => {
    const ids = goalsIn(weekly.scope, s.goals).map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['ns-lead', 'ns-cost', 'lead-review', 'lead-merge']));
    expect(new Set(ids).size).toBe(ids.length);
    const some = goalsIn({ goals: ['lead-mq'], trees: [], levels: ['north-star'] }, s.goals).map((g) => g.id);
    expect(some).toHaveLength(13);
    expect(some).toContain('lead-mq');
  });
  it('holds a session in this week or the next week the cadence lands on', () => {
    expect(sessionWeek(weekly, 7)).toBe(7);
    expect(sessionWeek(monthly, 7)).toBe(8);
    expect(sessionWeek(monthly, 8)).toBe(8);
    expect(sessionWeek(weekly, 0)).toBe(1);
  });
  it('walks the worst first and counts what was said this session', () => {
    const r = reviewSession(weekly, s, cycle, today, SEED_WEEK);
    // Within new information (before what's being handled), the worst first.
    const weights = r.items.filter((a) => !a.handled).map((a) => a.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(r.done).toBe(0);
    const said = { ...s, decisions: [...s.decisions, { id: 'd', goalId: r.items[0]!.goal.id, checkInId: null, reviewId: 'weekly', week: SEED_WEEK, kind: 'acknowledge' as const, byId: 'amara', at: '', note: '' }] };
    expect(reviewSession(weekly, said, cycle, today, SEED_WEEK).done).toBe(1);
    // last week's session doesn't count towards this week
    expect(reviewSession(weekly, s, cycle, today, SEED_WEEK).said).toHaveLength(0);
    expect(reviewSession(weekly, s, cycle, today, SEED_WEEK - 1).said.length).toBeGreaterThan(0);
  });
});

describe('watching', () => {
  it('watches a goal, a tree or a level', () => {
    expect(watchedGoals('oskar', s).map((g) => g.id).sort()).toEqual(['devsat-localdev', 'lead-review', 'ns-ai']);
    expect(watchedGoals('rhea', s).map((g) => g.id)).toEqual(expect.arrayContaining(['ns-env', 'env-search', 'lead-review', 'vuln-containers']));
    expect(watchedGoals('grace', s).every((g) => g.level === 'north-star')).toBe(true);
  });
  it('tells a direct watch from one through a tree or level', () => {
    expect(watchOf('oskar', goal('ns-ai'), s)).toMatchObject({ kind: 'goal' });
    expect(watchOf('rhea', goal('env-search'), s)).toBe('via');
    expect(watchOf('bjorn', goal('env-search'), s)).toBeNull();
  });
});

describe('levels and trees', () => {
  it('keeps levels separate from what a goal feeds', () => {
    expect(s.goals.filter((g) => g.level === 'north-star')).toHaveLength(12);
    expect(goal('lead-review').level).toBe('svp');
    expect(goal('lead-review').parentId).toBe('ns-lead');
  });
  it('builds a tree from each top goal and flags unlinked team goals', () => {
    const { trees, loose } = outcomeTrees(s.goals, (a, b) => a.title.localeCompare(b.title));
    expect(trees.map((t) => t.goal.id)).toEqual(expect.arrayContaining(['ns-lead', 'ns-cost']));
    const orphan = { ...goal('ns-ai'), id: 'orphan', parentId: null, level: 'team' as const };
    expect(outcomeTrees([...s.goals, orphan], () => 0).loose.map((g) => g.id)).toContain('orphan');
    expect(loose.every((g) => g.level === 'team')).toBe(true);
  });
});

describe('progress', () => {
  it('counts this week’s check-ins', () => {
    const p = weekProgress('rhea', s, cycle, SEED_WEEK, today);
    expect([p.done.length, p.due.length]).toEqual([5, 2]);
  });
  it('counts consecutive weeks checked in on time', () => {
    expect(onTimeStreak('bjorn', s, cycle, SEED_WEEK)).toBe(3);
    expect(onTimeStreak('kojo', s, cycle, SEED_WEEK)).toBe(0);
    expect(onTimeStreak('oskar', s, cycle, SEED_WEEK)).toBe(0);
  });
});

describe('import', () => {
  it('reads tab-separated and quoted CSV', () => {
    expect(parseTable('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseTable('a,b\n"x, y","he said ""hi"""')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  it('builds a workspace from the templates with no issues', () => {
    const r = buildWorkspace({ name: 'Platform', startDate: '2026-11-02', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: today, idSuffix: 'ab12' });
    expect(r.issues).toEqual([]);
    expect(r.snapshot.people.map((p) => p.admin)).toEqual([true, false, false, false]);
    expect(r.snapshot.goals).toHaveLength(3);
    const head = r.snapshot.goals.find((g) => g.level === 'north-star')!;
    expect(r.snapshot.goals.filter((g) => g.parentId === head.id)).toHaveLength(2);
    const ms = r.snapshot.goals.find((g) => g.kind === 'milestone') as Extract<Goal, { kind: 'milestone' }>;
    expect(ms.stages.map((x) => x.dueWeek)).toEqual([2, 6, 10]);
    expect(r.snapshot.people.every((p) => p.id.endsWith('ab12'))).toBe(true);
  });
  it('starts goals set up mid-year from this week, so earlier quarters aren’t missed (research round 2)', () => {
    // A year that started in January, set up in week 43: the plan runs from today's number this week.
    const r = buildWorkspace({ name: 'Mid-year', startDate: '2026-01-05', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: new Date('2026-11-02T12:00:00Z'), idSuffix: 'mid' });
    expect(r.issues).toEqual([]);
    const cycle = r.snapshot.cycles[0]!;
    const metric = r.snapshot.goals.find((g) => g.kind === 'metric') as MetricGoal;
    expect(metric.plan.fromWeek).toBe(43);
    expect(quarterResults(metric, cycle, [], 43).slice(0, 3).map((q) => q.kind)).toEqual(['none', 'none', 'none']);
  });
  it('explains bad rows instead of guessing', () => {
    const r = buildWorkspace({
      name: 'X', startDate: '2026-11-02', now: today, idSuffix: 'z',
      people: 'Name\tTeam\nAna\tOps',
      goals: 'Goal\tTeam\tOwner\tType\tStart\tTarget\nUptime\tOps\tNobody\tmetric\t1\t2\nLatency\tOps\tAna\tmetric\t5\t5\nWhat\tOps\tAna\tpie\t1\t2',
    });
    expect(r.issues.map((i) => `${i.table} ${i.row}`)).toEqual(['Goals 2', 'Goals 3', 'Goals 4']);
    expect(r.issues[0]!.message).toMatch(/Nobody/);
  });
});

describe('plan changes after check-ins start', () => {
  const lead = goal('ns-lead') as MetricGoal;
  const proposed: MetricGoal = { ...lead, plan: { ...lead.plan, target: lead.plan.target - 2 } };
  it('spots a plan change but not a rename', () => {
    expect(planChanged(lead, proposed)).toBe(true);
    expect(planChanged(lead, { ...lead, title: 'Renamed' })).toBe(false);
    expect(withPlanOf({ ...lead, title: 'Renamed' }, proposed)).toMatchObject({ title: 'Renamed', plan: proposed.plan });
  });
  it('saves a new target directly, keeping the original plan and the week it changed', () => {
    const d = { ...draftOf(lead), target: String(lead.plan.target - 2) };
    const after = buildGoal(d, cycle, { id: lead.id, createdAt: lead.createdAt }, lead, true, 9) as MetricGoal;
    expect(after.plan.target).toBe(lead.plan.target - 2);
    expect(after.originalPlan).toEqual(lead.originalPlan ?? lead.plan);
    expect(after.rebaselinedWeek).toBe(9);
  });
  it('logs a level change with the plan change', () => {
    const after: Goal = { ...proposed, level: 'svp' };
    const c = goalChange(lead, after, lookup, 'rhea', '2026-10-30T10:00:00.000Z', 'c1');
    expect(c!.diffs.map((x) => x.field)).toEqual(expect.arrayContaining(['Target', 'Level']));
  });
});

describe('closing a cycle', () => {
  it('picks the cycle that has started, or starts within the week', () => {
    const next = { ...cycle, id: 'c2', startDate: '2027-01-25' };
    expect(currentCycle([cycle, next], today)!.id).toBe(cycle.id);
    expect(currentCycle([cycle, next], new Date("2027-01-20T12:00:00Z"))!.id).toBe('c2');
  });
  it('suggests how a goal landed from where it ended', () => {
    expect(suggestedResult(goal('lead-mq'), cycle, s.checkIns, today)).toBe('missed');
    expect(suggestedResult(goal('ns-ai'), cycle, s.checkIns, today)).toBe('hit');
  });
  it('carries goals into the next cycle from where they ended, dropping links to goals that stop', () => {
    const retros = [{ id: 'r1', goalId: 'ns-lead', cycleId: cycle.id, result: 'partly' as const, learned: 'x', next: 'stop' as const, byId: 'rhea', at: '' }];
    const { cycle: c2, goals } = nextCycle(cycle, s.goals, s.checkIns, retros, { cycle: 'c2', goal: (g) => g.id + '-2' }, '2027-01-01T00:00:00Z');
    expect(c2.startDate > cycle.startDate).toBe(true);
    expect(goals.some((g) => g.id === 'ns-lead-2')).toBe(false);
    expect(goals.find((g) => g.id === 'lead-review-2')!.parentId).toBeNull();
    const lead = goals.find((g) => g.id === 'ns-ai-2') as MetricGoal;
    const last = s.checkIns.filter((c) => c.goalId === 'ns-ai' && c.value != null).sort((a, b) => a.week - b.week || a.postedAt.localeCompare(b.postedAt)).pop()!.value;
    expect(lead.plan.start).toBe(last);
    expect(lead.originalPlan).toBeNull();
    expect(goals.every((g) => g.cycleId === 'c2')).toBe(true);
    const scoped = scopeToCycle({ ...s, cycles: [cycle, c2], goals: [...s.goals, ...goals] }, c2);
    expect(scoped.goals).toHaveLength(goals.length);
    expect(scoped.checkIns).toHaveLength(0);
  });
});

describe('goals set up mid-cycle', () => {
  it('plan from the week they are set up, so today’s value is today’s plan', async () => {
    const { blankGoal } = await import('./goal');
    const { planAt } = await import('./plan');
    const d = { ...blankGoal('devex', 'tariq', ''), title: 'Docs with an owner', start: '40', target: '80' };
    const g = buildGoal(d, cycle, { id: 'g', createdAt: '' }, null, false, 7) as MetricGoal;
    expect(g.plan.fromWeek).toBe(7);
    expect(planAt(g.plan, 7, cycle.weeks)).toBe(40);
    expect(planAt(g.plan, cycle.weeks, cycle.weeks)).toBe(80);
  });
});

describe('year goals and plan numbers', () => {
  it('a goal can be due at the end of a quarter, and its plan uses that end', async () => {
    const { blankGoal } = await import('./goal');
    const d = { ...blankGoal('devex', 'tariq', ''), title: 'Docs with an owner', start: '40', target: '80', endWeek: '26' };
    const g = buildGoal(d, cycle, { id: 'g', createdAt: '' }, null, false, 0) as MetricGoal;
    expect(g.plan.endWeek).toBe(26);
    expect(planAt(g.plan, 13, cycle.weeks)).toBeLessThan(80);
    expect(planAt(g.plan, 26, cycle.weeks)).toBe(80);
    expect(planAt(g.plan, 40, cycle.weeks)).toBe(80);
  });
  it('plan numbers typed by hand are the plan, and the rest keep their defaults', async () => {
    const { blankGoal } = await import('./goal');
    const { planAt } = await import('./plan');
    const { planCheckpoints } = await import('./plan');
    const d = { ...blankGoal('devex', 'tariq', ''), title: 'Docs with an owner', start: '0', target: '130', points: { '8': '40' } };
    const g = buildGoal(d, cycle, { id: 'g', createdAt: '' }, null, false, 0) as MetricGoal;
    expect(g.plan.points).toHaveLength(planCheckpoints(0, cycle.weeks).length - 1);
    expect(g.plan.points!.map((p) => p.week)).toEqual(expect.arrayContaining([13, 26, 39]));
    expect(planAt(g.plan, 8, cycle.weeks)).toBe(40);
    // Between two plan numbers, the plan is a straight line.
    const next = g.plan.points!.filter((p) => p.week > 8).sort((a, b) => a.week - b.week)[0]!;
    expect(planAt(g.plan, 9, cycle.weeks)).toBeCloseTo(40 + (next.value - 40) / (next.week - 8), 5);
  });
  it('a year goal carries into the next cycle with its plan, counted from the new start', () => {
    const year: MetricGoal = { ...(goal('ns-lead') as MetricGoal), id: 'yr', plan: { start: 4, target: 2, shape: 'straight', endWeek: cycle.weeks + 20 } };
    const { goals: next } = nextCycle(cycle, [year], [], [], { cycle: 'c2', goal: (g) => g.id + '-2' }, '');
    const carried = next[0] as MetricGoal;
    expect(carried.plan).toMatchObject({ start: 4, target: 2, fromWeek: -cycle.weeks, endWeek: 20 });
  });
});
