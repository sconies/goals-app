// @vitest-environment node
import { attentionFor, attentionList, openProposal, pendingSummary } from './attention';
import { planChanged, withPlanOf } from './goal';
import { checkInChange, goalChange } from './changes';
import { emptyDraft, toCheckIn } from './checkin';
import { buildWorkspace, GOALS_TEMPLATE, parseTable, PEOPLE_TEMPLATE } from './importer';
import { onTimeStreak, weekProgress } from './progress';
import { reviewQueue, withApprovedChange, withApprovedTarget } from './review';
import { seed } from '../data/seed';
import type { Goal, MetricGoal } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const goal = (id: string) => s.goals.find((g) => g.id === id)!;
const lookup = { person: (id: string) => s.people.find((p) => p.id === id), goal: (id: string) => s.goals.find((g) => g.id === id), teamName: (id: string) => s.teams.find((t) => t.id === id)?.name ?? id };
const kinds = (id: string) => attentionFor(goal(id), s, cycle, today).flags.map((f) => f.kind);

describe('attention', () => {
  it('flags off track, stale, at risk, a worsening trend and a check-in due', () => {
    expect(kinds('access')).toContain('off');
    expect(kinds('env')).toContain('stale');
    expect(kinds('head')).toEqual(expect.arrayContaining(['risk', 'due']));
    expect(kinds('alerts')).toContain('trend');
    expect(kinds('scan')).toEqual([]);
  });
  it('puts the worst first and leaves out goals that are merely due', () => {
    const list = attentionList(s, cycle, today);
    expect(list[0]!.goal.id).toBe('access');
    expect(list.some((a) => a.goal.id === 'scan')).toBe(false);
    expect(list.every((a) => a.flags.some((f) => f.kind !== 'due'))).toBe(true);
  });
  it('treats a proposal as open until the sponsor decides', () => {
    expect(openProposal(goal('review'), s.checkIns, s.decisions)).toBeNull();
    expect(openProposal(goal('review'), s.checkIns, [])?.proposeTarget).toBe(95);
  });
  it('flags a path to green whose week has passed', () => {
    const c = s.checkIns.find((x) => x.goalId === 'cfr' && x.week === 6)!;
    const late = { ...s, checkIns: s.checkIns.map((x) => (x.id === c.id ? { ...x, pathToGreen: { ...x.pathToGreen!, byWeek: 6 } } : x)) };
    expect(attentionFor(goal('cfr'), late, cycle, today).flags.map((f) => f.kind)).toContain('missed-path');
  });
});

describe('change log', () => {
  it('records a new goal with its fields', () => {
    const c = goalChange(null, goal('triage'), lookup, 'maya', 'now', 'x')!;
    expect(c.action).toBe('created');
    expect(c.diffs.find((d) => d.field === 'Target')).toEqual({ field: 'Target', from: '—', to: '85%' });
  });
  it('records only what changed on an edit, before and after', () => {
    const g = goal('lead') as MetricGoal;
    const c = goalChange(g, { ...g, plan: { ...g.plan, target: 1.5 } }, lookup, 'sam', 'now', 'x')!;
    expect(c.diffs).toEqual([{ field: 'Target', from: '2.0 days', to: '1.5 days' }]);
    expect(c.summary).toBe('Changed target');
  });
  it('logs nothing when nothing changed', () => {
    expect(goalChange(goal('lead'), goal('lead'), lookup, 'sam', 'now', 'x')).toBeNull();
  });
  it('records a check-in post and an edit to its note', () => {
    const g = goal('scan');
    const c = toCheckIn(g, cycle, 8, { ...emptyDraft(g, null), value: '82' }, s.checkIns, 'aisha', today, 'ci');
    expect(checkInChange(null, c, g, 'aisha', 'x')!.summary).toBe('Checked in for week 8: 82% · On track');
    const edited = checkInChange(c, { ...c, next: 'Scan the monorepo' }, g, 'aisha', 'y')!;
    expect(edited.diffs).toEqual([{ field: 'Next step', from: '—', to: 'Scan the monorepo' }]);
  });
  it('has a logged creation for every demo goal and a post for every demo check-in', () => {
    expect(s.goals.every((g) => s.changes.some((c) => c.entity === 'goal' && c.entityId === g.id && c.action === 'created'))).toBe(true);
    expect(s.checkIns.every((ci) => s.changes.some((c) => c.entityId === ci.id))).toBe(true);
  });
});

describe('review', () => {
  it('queues the flagged goals and counts the ones decided this week', () => {
    const q = reviewQueue(s, cycle, today, 7);
    expect(q.total).toBeGreaterThanOrEqual(4);
    expect(q.done).toBe(0);
    const decided = { ...s, decisions: [...s.decisions, { id: 'd', goalId: q.items[0]!.goal.id, checkInId: null, week: 7, kind: 'acknowledge' as const, byId: 'elena', at: '', note: '' }] };
    expect(reviewQueue(decided, cycle, today, 7).done).toBe(1);
  });
  it('re-baselines the plan when a target is approved', () => {
    const g = goal('lead') as MetricGoal;
    const after = withApprovedTarget(g, 1.5, 7);
    expect(after.plan.target).toBe(1.5);
    expect(after.originalPlan).toEqual(g.plan);
    expect(after.rebaselinedWeek).toBe(7);
  });
});

describe('progress', () => {
  it('counts this week’s check-ins', () => {
    const p = weekProgress('maya', s, cycle, 7, today);
    expect([p.done.length, p.due.length]).toEqual([1, 1]);
  });
  it('counts consecutive weeks checked in on time', () => {
    expect(onTimeStreak('sam', s, cycle, 7)).toBe(6);
    expect(onTimeStreak('jonas', s, cycle, 7)).toBe(0);
    expect(onTimeStreak('tom', s, cycle, 7)).toBe(0);
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
    expect(r.snapshot.people.map((p) => p.profile)).toEqual(['sponsor', 'lead', 'coach', 'contributor']);
    expect(r.snapshot.goals).toHaveLength(3);
    const head = r.snapshot.goals.find((g) => g.headline)!;
    expect(r.snapshot.goals.filter((g) => g.parentId === head.id)).toHaveLength(2);
    const ms = r.snapshot.goals.find((g) => g.kind === 'milestone') as Extract<Goal, { kind: 'milestone' }>;
    expect(ms.stages.map((x) => x.dueWeek)).toEqual([2, 6, 10]);
    expect(r.snapshot.people.every((p) => p.id.endsWith('ab12'))).toBe(true);
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
  const lead = goal('lead') as MetricGoal;
  const proposed: MetricGoal = { ...lead, plan: { ...lead.plan, target: lead.plan.target - 0.5 } };
  const pending = { proposed, byId: lead.ownerId, at: '2026-10-30T10:00:00.000Z', week: 9, reason: 'The new tooling makes the stretch reachable.' };
  it('spots a plan change but not a rename', () => {
    expect(planChanged(lead, proposed)).toBe(true);
    expect(planChanged(lead, { ...lead, title: 'Renamed' })).toBe(false);
    expect(withPlanOf({ ...lead, title: 'Renamed' }, proposed)).toMatchObject({ title: 'Renamed', plan: proposed.plan });
  });
  it('flags the proposal and approving it re-baselines, keeping the original plan', () => {
    const g: Goal = { ...lead, pending };
    expect(pendingSummary(g)).toMatch(/^Target .+ → .+/);
    expect(attentionFor(g, { ...s, goals: s.goals.map((x) => (x.id === g.id ? g : x)) }, cycle, today).flags.map((f) => f.kind)).toContain('proposal');
    const approved = withApprovedChange(g, 9) as MetricGoal;
    expect(approved.plan.target).toBe(proposed.plan.target);
    expect(approved.originalPlan).toEqual(lead.originalPlan ?? lead.plan);
    expect(approved.rebaselinedWeek).toBe(9);
    expect(approved.pending).toBeNull();
  });
  it('reopens a goal already reviewed this week until the sponsor answers the proposal', () => {
    const g: Goal = { ...lead, pending };
    const earlier = { id: 'd1', goalId: lead.id, checkInId: null, week: 9, kind: 'acknowledge' as const, byId: 'elena', at: '2026-10-30T09:00:00.000Z', note: '' };
    const s2 = { ...s, goals: s.goals.map((x) => (x.id === g.id ? g : x)), decisions: [...s.decisions, earlier] };
    expect(reviewQueue(s2, cycle, today, 9).handled.has(lead.id)).toBe(false);
    const answered = { ...earlier, id: 'd2', kind: 'approve-change' as const, at: '2026-10-30T11:00:00.000Z' };
    expect(reviewQueue({ ...s2, decisions: [...s2.decisions, answered] }, cycle, today, 9).handled.has(lead.id)).toBe(true);
  });
});
