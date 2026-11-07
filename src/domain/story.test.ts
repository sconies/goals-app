// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { goalResult, MEANING, storyOf } from './story';
import type { CheckIn, MetricGoal } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;

describe('the story of a goal', () => {
  it('says why it’s off, what the owner will do, by when and what they need', () => {
    const st = storyOf(goal('lead-mq'), s, cycle, week, today);
    expect(st.status).toBe('off');
    expect(st.why).toMatch(/MergeFlow/);
    expect(st.doing).toMatch(/without batching/);
    expect(st.byWhen).toMatch(/^Owner’s date: back on plan by week 49 \(/);
    expect(st.needs).toMatch(/Daniel Okafor: agree to run without batching/);
    expect(st.where).toContain('Late: Web monorepo on the merge queue (due week 29, now expected week 45)');
    expect(st.feeds).toMatch(/Merge-to-deploy time \(median\) \(SVP\)/);
    // Waiting on a request raised for another goal says so.
    expect(storyOf(goal('lead-runners'), s, cycle, week, today).needs).toMatch(/Amara Nwosu: approve the extra CI runner budget for Q4 \(the same request as Lead time for changes\)/);
  });
  it('doesn’t let a slipping date, a missing plan or a quiet goal hide', () => {
    expect(storyOf(goal('cfr-halt'), s, cycle, week, today).warnings.join(' ')).toMatch(/Date slipped\. First said back on plan by week 41, now week 48/);
    const env = storyOf(goal('env-search'), s, cycle, week, today);
    expect(env.status).toBe('stale');
    expect(env.since).toMatch(/No check-in for \d+ days; last heard in week 38/);
    expect(env.warnings.join(' ')).toMatch(/No recent update\. Last word was at risk at 63%, in week 38\./);
    const last = s.checkIns.filter((c) => c.goalId === 'vuln-containers').sort((a, b) => a.week - b.week).pop()!;
    const noPlan = { ...s, checkIns: s.checkIns.map((c) => (c.id === last.id ? { ...c, pathToGreen: null } : c)) };
    expect(storyOf(goal('vuln-containers'), noPlan, cycle, week, today).warnings.join(' ')).toMatch(/No path to green\. It is behind and the owner has not said how it gets back\./);
  });
  it('explains every status', () => {
    for (const k of ['on', 'risk', 'off', 'stale'] as const) expect(MEANING[k].length).toBeGreaterThan(20);
    expect(MEANING.off).toMatch(/will miss without intervention/i);
  });
});

describe('results once a goal is due', () => {
  const ci = (goalId: string, w: number, value: number): CheckIn => ({ id: `r${goalId}${w}`, goalId, authorId: 'rhea', week: w, postedAt: `2026-12-0${Math.min(9, w - 5)}T09:00:00Z`, value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false });
  // Lead time for changes: 52 hours down to 24 by the end of the year (lower is better).
  const lead = goal('ns-lead') as MetricGoal;
  it('met, met late, or not met', () => {
    expect(goalResult(lead, cycle, s.checkIns, week)).toBeNull();
    const end = cycle.weeks;
    expect(goalResult(lead, cycle, [...s.checkIns, ci('ns-lead', end, 24)], end)!.kind).toBe('completed');
    expect(goalResult(lead, cycle, [...s.checkIns, ci('ns-lead', end, 30)], end + 1)!.kind).toBe('missed');
    expect(goalResult(lead, cycle, [...s.checkIns, ci('ns-lead', end, 30), ci('ns-lead', end + 1, 23)], end + 1)!.text).toBe(`Met late: week ${end + 1}, due week ${end}`);
    expect(goalResult(goal('lead-mq'), cycle, s.checkIns, week)!.text).toBe('Not met: due week 39');
  });
});

describe('ad hoc check-ins', () => {
  it('keeps every check-in in a week, and the latest is the week’s status everywhere', async () => {
    const { goalStatus, assessPosted } = await import('./status');
    const { weeklyCalls } = await import('./summary');
    const g = goal('mttr-pir');
    const own = s.checkIns.filter((c) => c.goalId === g.id);
    const last = own.sort((a, b) => a.week - b.week).at(-1)!;
    const later: CheckIn = { ...last, id: 'adhoc', status: 'on', calculated: 'on', cause: null, why: 'On plan.', pathToGreen: null, value: 99, postedAt: new Date(Date.parse(last.postedAt) + 3_600_000).toISOString() };
    const all = [...s.checkIns, later];
    expect(all.filter((c) => c.goalId === g.id && c.week === last.week)).toHaveLength(2);
    expect(goalStatus(g, cycle, all, today).latest!.id).toBe('adhoc');
    expect(weeklyCalls(all.filter((c) => c.goalId === g.id)).get(last.week)!.id).toBe('adhoc');
    const a = assessPosted(g, cycle, all, week);
    expect(a.kind === 'metric' && a.actual).toBe(99);
  });
});
