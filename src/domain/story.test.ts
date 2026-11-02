// @vitest-environment node
import { seed } from '../data/seed';
import { toYear } from '../data/yearStory';
import { currentWeek } from './plan';
import { goalResult, MEANING, storyOf } from './story';
import type { CheckIn, MetricGoal } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (id: string) => s.goals.find((g) => g.id === id)!;

describe('the story of a goal', () => {
  it('says why it’s off, what the owner will do, by when and what they need', () => {
    const st = storyOf(goal('access'), s, cycle, week, today);
    expect(st.status).toBe('off');
    expect(st.why).toMatch(/vendor delivered late/);
    expect(st.doing).toMatch(/Interim read-only scope/);
    expect(st.byWhen).toMatch(new RegExp(`^Back on plan by week ${toYear(9)} \\(`));
    expect(st.needs).toMatch(/Elena Ruiz/);
    expect(st.where).toContain(`Late: Access controls built (due week ${toYear(6)}, now expected week ${toYear(9)})`);
    expect(st.feeds).toMatch(/Intake-to-delivery time \(North star\)/);
  });
  it('doesn’t let a slipping date, a missing plan or a quiet goal hide', () => {
    expect(storyOf(goal('idle'), s, cycle, week, today).warnings.join(' ')).toContain(`The date has slipped: first said back on plan by week ${toYear(9)}, now week ${toYear(10)}`);
    const env = storyOf(goal('env'), s, cycle, week, today);
    expect(env.status).toBe('stale');
    expect(env.since).toMatch(new RegExp(`No check-in for \\d+ days; last heard in week ${toYear(4)}`));
    expect(env.warnings.join(' ')).toMatch(/Ask Jonas for an update/);
    const last = s.checkIns.filter((c) => c.goalId === 'alerts').sort((a, b) => a.week - b.week).pop()!;
    const noPlan = { ...s, checkIns: s.checkIns.map((c) => (c.id === last.id ? { ...c, pathToGreen: null } : c)) };
    expect(storyOf(goal('alerts'), noPlan, cycle, week, today).warnings.join(' ')).toMatch(/No recovery plan/);
  });
  it('explains every status', () => {
    for (const k of ['on', 'risk', 'off', 'stale'] as const) expect(MEANING[k].length).toBeGreaterThan(20);
    expect(MEANING.off).toMatch(/will miss without intervention/i);
  });
});

describe('results once a goal is due', () => {
  const ci = (goalId: string, w: number, value: number): CheckIn => ({ id: `r${goalId}${w}`, goalId, authorId: 'sam', week: w, postedAt: `2026-12-0${Math.min(9, w - 5)}T09:00:00Z`, value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false });
  const lead = goal('lead') as MetricGoal;
  it('completed, completed late, or did not meet', () => {
    expect(goalResult(lead, cycle, s.checkIns, week)).toBeNull();
    expect(goalResult(lead, cycle, [...s.checkIns, ci('lead', 52, 2.0)], 52)!.kind).toBe('completed');
    expect(goalResult(lead, cycle, [...s.checkIns, ci('lead', 52, 2.4)], 53)!.kind).toBe('missed');
    expect(goalResult(lead, cycle, [...s.checkIns, ci('lead', 52, 2.4), ci('lead', 53, 1.9)], 53)!.text).toBe('Completed late: week 53, due week 52');
    expect(goalResult(goal('access'), cycle, s.checkIns, week)!.text).toBe(`Did not meet: due week ${toYear(6)}`);
  });
});
