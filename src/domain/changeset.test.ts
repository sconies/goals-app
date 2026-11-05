// @vitest-environment node
import { applyCommit } from '../data/store';
import { planChanges, records, sheetKind, type ChangeInput, type Rec } from './changeset';
import { toCsv, workbook } from './export';
import { parseTable } from './importer';
import { currentWeek, planAt } from './plan';
import { goalStatus } from './status';
import { seed } from '../data/seed';
import type { MetricGoal } from './types';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const base = (actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput => ({
  tables, snapshot: s, cycle, week, actor: person(actor), now: today.toISOString(), newId: (p) => `${p}_t${++n}`, via: 'spreadsheet', ...extra,
});
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const tsvOf = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join('\t')).join('\n');

describe('bulk changes', () => {
  it('loads an unedited export back as no changes', () => {
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const cs = planChanges(base('elena', { goals: records(tsvOf(wb[0]!.rows)), plan: records(tsvOf(wb[1]!.rows)), checkIns: records(tsvOf(wb[2]!.rows)) }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.items).toEqual([]);
    expect(cs.commit).toBeNull();
  });

  it('lets an owner load the whole workbook back after changing only their own goal (research round 1)', () => {
    // Kofi isn't an admin. Rows for other people's goals that he didn't touch must not block his own changes.
    expect(person('kofi').admin).toBeFalsy();
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const ci = records(tsvOf(wb[2]!.rows));
    const own = ci.filter((r) => r['goal id'] === 'cache' && ['37', '38', '39'].includes(r['week']!));
    expect(own.length).toBe(3);
    for (const r of own) r['value'] = String(Number(r['value']) + 1);
    const cs = planChanges(base('kofi', { goals: records(tsvOf(wb[0]!.rows)), plan: records(tsvOf(wb[1]!.rows)), checkIns: ci }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.counts.checkIns).toBe(3);
    expect(cs.commit).not.toBeNull();
    // A change he did make to someone else's goal is still refused.
    const goals = records(tsvOf(wb[0]!.rows));
    goals.find((r) => r['id'] === 'lead')!['target'] = '1.5';
    const refused = planChanges(base('kofi', { goals }));
    expect(refused.issues.map((i) => i.message)).toEqual([expect.stringMatching(/Only Sam Patel \(its owner\) or an admin/)]);
  });

  it('tells which sheet is which from its name or header', () => {
    expect(sheetKind('Check-ins', 'Goal ID\tWeek\tValue')).toBe('checkIns');
    expect(sheetKind('Sheet1', 'ID\tGoal\tUnit\tStart\tWeek 1\tWeek 2')).toBe('plan');
    expect(sheetKind('Sheet1', 'ID\tGoal\tOwner')).toBe('goals');
  });

  it('adds a new goal and changes an existing one, logging both', () => {
    const cs = planChanges(base('elena', { goals: [
      rec({ Goal: 'Runbooks with an owner', Owner: 'Kofi Boateng', Type: 'metric', Unit: '%', Start: '20', Target: '90', 'Feeds into': 'Change failure rate' }),
      { ...rec({ ID: 'lead', Level: 'svp' }), __row: '3' },
    ] }));
    expect(cs.issues).toEqual([]);
    expect(cs.counts).toEqual(expect.objectContaining({ newGoals: 1, goals: 1 }));
    const after = applyCommit(s, cs.commit!);
    const fresh = after.goals.find((g) => g.title === 'Runbooks with an owner')!;
    expect(fresh.parentId).toBe('cfr');
    expect(after.goals.find((g) => g.id === 'lead')!.level).toBe('svp');
    expect(cs.commit!.changes.every((c) => c.diffs.some((d) => d.field === 'Via' && d.to === 'Spreadsheet'))).toBe(true);
    expect(cs.commit!.changes.at(-1)!.entity).toBe('workspace');
  });

  it('only lets owners change their own goals; admins can change any', () => {
    const row = [rec({ ID: 'lead', Target: '1.5' })];
    const sam = planChanges(base('sam', { goals: row }, { reason: 'Faster than expected' }));
    expect(sam.issues).toEqual([]);
    const kofi = planChanges(base('kofi', { goals: row }));
    expect(kofi.issues[0]!.message).toMatch(/Only Sam Patel \(its owner\) or an admin/);
    expect(kofi.commit).toBeNull();
    expect(planChanges(base('kofi', { goals: [rec({ Goal: 'Something new', Owner: 'Sam Patel', Start: '1', Target: '2' })] })).issues[0]!.message).toMatch(/goals you own/);
  });

  it('asks for a reason when a plan changes after check-ins started', () => {
    const row = [rec({ ID: 'lead', Target: '1.5' })];
    const without = planChanges(base('sam', { goals: row }));
    expect(without.needsReason).toBe(true);
    expect(without.commit).toBeNull();
    const withReason = planChanges(base('sam', { goals: row }, { reason: 'Moved faster than planned' }));
    expect(withReason.commit!.changes[0]!.diffs).toEqual(expect.arrayContaining([{ field: 'Why', from: '—', to: 'Moved faster than planned' }]));
    const g = withReason.commit!.goals![0] as MetricGoal;
    expect(g.originalPlan).not.toBeNull();
    expect(g.rebaselinedWeek).toBe(week);
  });

  it('sets plan numbers by hand from the Plan sheet', () => {
    const g = s.goals.find((x) => x.id === 'alerts') as MetricGoal;
    const r = rec({ ID: 'alerts', 'Week 5': '45' });
    const cs = planChanges(base('kofi', { plan: [r] }, { reason: 'Rollout landed early' }));
    expect(cs.issues).toEqual([]);
    const after = cs.commit!.goals![0] as MetricGoal;
    expect(planAt(after.plan, 5, cycle.weeks)).toBe(45);
    expect(planAt(after.plan, 5, cycle.weeks)).not.toBe(planAt(g.plan, 5, cycle.weeks));
  });

  it('loads past weeks as backfilled check-ins, judged by the same rules', () => {
    const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'lead') };
    const rows = [1, 2, 3].map((w) => ({ ...rec({ 'Goal ID': 'lead', Week: String(w), Value: String(planAt((s.goals.find((g) => g.id === 'lead') as MetricGoal).plan, w, cycle.weeks).toFixed(3)) }), __row: String(w + 1) }));
    const cs = planChanges(base('sam', { checkIns: rows }, { snapshot: fresh }));
    expect(cs.issues).toEqual([]);
    expect(cs.counts.backfilled).toBe(3);
    const cis = cs.commit!.checkIns!;
    expect(cis.every((c) => c.backfilled && c.authorId === 'sam')).toBe(true);
    // Dated in their own week, so loading history doesn't make the goal look freshly checked in.
    expect(cis.every((c) => c.postedAt < today.toISOString())).toBe(true);
    expect(goalStatus(s.goals.find((g) => g.id === 'lead')!, cycle, applyCommit(fresh, cs.commit!).checkIns, today).status).toBe('stale');
    expect(cs.commit!.changes[0]!.summary).toMatch(/loaded later/);
  });

  it('refuses a week behind plan without a reason, or a week in the future', () => {
    const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'alerts') };
    const behind = planChanges(base('kofi', { checkIns: [rec({ 'Goal ID': 'alerts', Week: '4', Value: '21' })] }, { snapshot: fresh }));
    expect(behind.issues[0]!.message).toMatch(/Week 4 needs a Cause and a Why/);
    expect(behind.issues[0]!.message).toMatch(/Path to green/);
    const fixed = planChanges(base('kofi', { checkIns: [rec({ 'Goal ID': 'alerts', Week: '4', Value: '21', Cause: 'Delivery slower', Why: 'Pipeline rollout slipped two weeks', 'Path to green': 'Ship the classifier', 'Back on plan by week': '8' })] }, { snapshot: fresh }));
    expect(fixed.issues).toEqual([]);
    expect(fixed.commit!.checkIns![0]!.status).toBe('off');
    const future = planChanges(base('kofi', { checkIns: [rec({ 'Goal ID': 'alerts', Week: String(week + 1), Value: '50' })] }));
    expect(future.issues[0]!.message).toMatch(/hasn’t happened yet/);
  });

  it('replaces a week already posted, and says whose it was', () => {
    const v = planAt((s.goals.find((g) => g.id === 'lead') as MetricGoal).plan, 6, cycle.weeks).toFixed(3);
    const cs = planChanges(base('elena', { checkIns: [rec({ 'Goal ID': 'lead', Week: '6', Value: v, Call: 'On track' })] }));
    expect(cs.counts.replaced).toBe(1);
    expect(cs.issues.find((i) => i.severity === 'warning')!.message).toMatch(/Replaces Sam Patel’s check-in for week 6/);
  });

  it('reads milestone stages in words', () => {
    const cs = planChanges(base('leo', { checkIns: [rec({ 'Goal ID': 'brain', Week: String(week), Stages: 'Data model v1: done week 3; Private repo indexing: done week 7' })] }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const st = cs.commit!.checkIns![0]!.stages!;
    expect(st.find((u) => u.stageId === 'pr')!.doneWeek).toBe(7);
  });

  it('round-trips through CSV', () => {
    const wb = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
    const rows = parseTable(toCsv(wb[0]!.rows));
    expect(rows[0]!.slice(0, 2)).toEqual(['Key', 'ID']);
    expect(rows.length).toBe(wb[0]!.rows.length);
  });
});
