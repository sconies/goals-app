// @vitest-environment node
/* A range between two numbers ("keep it between 99.5% and 99.95%", migration 0042): the status rule's worked examples,
   its words, goal entry's Must fix, the spreadsheet's Limit cell both ways, and the database row. A one-sided range is
   judged exactly as before. */
import { buildPlatformOrg } from '../data/platformOrg';
import { goalFromRows, goalToRows } from '../data/rows';
import { planChanges, twoNumbers } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { csvFiles, workbook } from './export';
import { directionLabel, fmt, gapText, targetText } from './format';
import { blankGoal, buildGoal, draftOf, type GoalDraft } from './goal';
import { goalMustFix, type MustFixContext } from './goalEntry';
import { currentWeek } from './plan';
import { groupId, type Answers } from './problemLevels';
import { rangeNear, rangeOut, rangeRoom, rangeSide } from './range';
import { parseDelimited, readTables } from './sheets';
import { assessRange } from './status';
import type { RangeGoal, Snapshot } from './types';
import { RANGE } from '../spec/examples';

const UPTIME: RangeGoal = { ...RANGE, title: 'Uptime', unit: '%', decimals: 2, range: { bound: 'between', lower: 99.5, limit: 99.95, margin: 0.1 } };

describe('the range rule between two numbers', () => {
  it('is out above the upper or below the lower, near within the margin of either', () => {
    const calls = [[99.7, 99.7], [99.9, 99.7], [99.55, 99.7], [99.95, 99.7], [99.5, 99.7], [99.96, 99.7], [99.4, 99.3], [99.99, 99.97]].map(([v, p]) => assessRange(UPTIME, 3, v!, p!).calc);
    expect(calls).toEqual(['on', 'risk', 'risk', 'risk', 'risk', 'risk', 'off', 'off']);
    expect([99.49, 99.96, 99.5, 99.95].map((v) => rangeOut(UPTIME.range, v))).toEqual([true, true, false, false]);
    expect([99.59, 99.6, 99.85, 99.86].map((v) => rangeNear(UPTIME.range, v))).toEqual([true, false, false, true]);
  });
  it('names the bound nearer the number', () => {
    expect([99.6, 99.725, 99.9, null].map((v) => rangeSide(UPTIME.range, v))).toEqual([
      { bound: 'atLeast', limit: 99.5 }, { bound: 'atMost', limit: 99.95 }, { bound: 'atMost', limit: 99.95 }, { bound: 'atMost', limit: 99.95 },
    ]);
  });
  it('weighs the two bounds by distance, not a floating-point midpoint', () => {
    const band = { bound: 'between' as const, lower: 1.6, limit: 1.8, margin: 0 };
    expect(rangeSide(band, 1.7)).toEqual({ bound: 'atMost', limit: 1.8 });
    expect([1.65, 1.7, 1.75, 1.9, 1.5].map((v) => Number(rangeRoom(band, v).toFixed(2)))).toEqual([0.05, 0.1, 0.05, -0.1, -0.1]);
    expect([rangeRoom({ bound: 'atMost', limit: 12, margin: 1 }, 10), rangeRoom({ bound: 'atLeast', limit: 99, margin: 1 }, 99.5)]).toEqual([2, 0.5]);
  });
  it('reads naturally', () => {
    expect(directionLabel(UPTIME)).toBe('between 99.50% and 99.95%');
    expect(targetText(UPTIME)).toBe('99.50%–99.95%');
    const gap = (v: number, p: number | null) => gapText(UPTIME, assessRange(UPTIME, 3, v, p)).short;
    expect([gap(99.7, 99.7), gap(99.96, 99.7), gap(99.4, 99.7), gap(99.52, 99.7), gap(99.7, 99.4)]).toEqual([
      'Between 99.50% and 99.95%', 'Over the 99.95% limit', 'Under the 99.50% limit', 'Near the 99.50% limit', 'Back between 99.50% and 99.95%',
    ]);
  });
  it('leaves a one-sided range exactly as it was', () => {
    const atLeast: RangeGoal = { ...RANGE, range: { bound: 'atLeast', limit: 99, margin: 0.5 } };
    expect([[99.8, 99.9], [99.3, 99.9], [98, 98.5], [99.5, 99.5]].map(([v, p]) => assessRange(atLeast, 2, v!, p!).calc)).toEqual(['on', 'risk', 'off', 'on']);
    expect([[10.5, 10.6], [11.2, 10.6], [12.6, 11.2], [12, 11]].map(([v, p]) => assessRange(RANGE, 5, v!, p!).calc)).toEqual(['on', 'risk', 'risk', 'risk']);
    expect(gapText(RANGE, assessRange(RANGE, 5, 10.5, 10.6)).short).toBe('Inside the 12.0% limit');
  });
});

describe('goal entry: a range between two numbers', () => {
  const ctx: MustFixContext = { cycleWeeks: 53, week: 45, existing: null, door: 'form' };
  const draft = (o: Partial<GoalDraft>): GoalDraft => ({ ...blankGoal('cicd', 'tunde', ''), title: 'Uptime', kind: 'range', unit: '%', bound: 'between', ...o });
  const fix = (o: Partial<GoalDraft>) => goalMustFix(draft(o), ctx).map((f) => `${f.field}: ${f.text}`);
  it('needs both numbers, the lower below the upper', () => {
    expect(fix({ lower: '99.5', limit: '99.95' })).toEqual([]);
    expect(fix({ lower: '', limit: '99.95' })).toEqual(['lower: Enter the lower number.']);
    expect(fix({ lower: '99.5', limit: '' })).toEqual(['limit: Enter the upper number.']);
    expect(fix({ lower: '99.95', limit: '99.95' })).toEqual(['lower: The lower number (99.95%) must be below the upper one (99.95%).']);
    expect(fix({ lower: '99.96', limit: '99.5' })).toEqual(['lower: The lower number (99.96%) must be below the upper one (99.5%).']);
  });
  it('asks nothing of the lower number when the range is one-sided', () => {
    expect(fix({ bound: 'atMost', lower: '', limit: '2' })).toEqual([]);
  });
  it('builds and reads back the goal', () => {
    const cycle = { id: 'c', name: 'FY27', startDate: '2026-01-05', weeks: 53, reviewDay: 3 };
    const g = buildGoal(draft({ lower: '99.5', limit: '99.95', margin: '0.1' }), cycle, { id: 'g', createdAt: '2026-11-12T00:00:00.000Z' }, null, false, 45) as RangeGoal;
    expect(g.range).toEqual({ bound: 'between', limit: 99.95, lower: 99.5, margin: 0.1 });
    expect(g.decimals).toBe(2);
    expect(draftOf(g)).toMatchObject({ bound: 'between', lower: '99.5', limit: '99.95' });
    const one = buildGoal({ ...draftOf(g), bound: 'atMost' }, cycle, { id: 'g', createdAt: g.createdAt }, g, false, 45) as RangeGoal;
    expect(one.range).toEqual({ bound: 'atMost', limit: 99.95, margin: 0.1 });
  });
});

describe('the Limit cell', () => {
  it('reads two numbers as a range between them', () => {
    expect(['99.5–99.95', '99.5 - 99.95', '99.5 to 99.95', '99.5% – 99.95%', '-10 to -5', '1,000-2,000'].map(twoNumbers)).toEqual([
      { lower: '99.5', upper: '99.95' }, { lower: '99.5', upper: '99.95' }, { lower: '99.5', upper: '99.95' }, { lower: '99.5%', upper: '99.95%' },
      { lower: '-10', upper: '-5' }, { lower: '1,000', upper: '2,000' },
    ]);
    expect(['99.5', '-5', '', 'to', 'a - b'].map(twoNumbers)).toEqual([null, null, null, null, null]);
  });

  const today = new Date('2026-11-11T12:00:00Z');
  const full = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  const base = full.goals.find((g): g is RangeGoal => g.kind === 'range' && g.cycleId === cycle.id)!;
  let n = 0;
  const newId = (p: string) => `${p}_rb${++n}`;
  const load = (snap: Snapshot, edit?: (rows: (string | number | null)[][]) => void, answers?: Answers) => {
    const s = scopeToCycle(snap, cycle);
    const book = workbook({ ws: { id: 'ws', name: 'x' }, snapshot: s, cycle, week, today });
    const goals = book.find((t) => t.name === 'Goals')!;
    edit?.(goals.rows as (string | number | null)[][]);
    const read = readTables(csvFiles(book).map((f) => ({ name: f.name, rows: parseDelimited(f.text) })));
    return planChanges({ tables: read.tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.admin)!, now: today.toISOString(), newId, via: 'spreadsheet', full: snap, answers });
  };

  it('exports a range between two numbers and loads it back as no change', () => {
    const lower = Number((base.range.limit - 4 * Math.max(base.range.margin, 1)).toFixed(base.decimals));
    const between: RangeGoal = { ...base, range: { ...base.range, bound: 'between', lower } };
    const snap: Snapshot = { ...full, goals: full.goals.map((g) => (g.id === base.id ? between : g)) };
    const s = scopeToCycle(snap, cycle);
    const row = workbook({ ws: { id: 'ws', name: 'x' }, snapshot: s, cycle, week, today }).find((t) => t.name === 'Goals')!;
    const h = row.rows[0]!.map(String);
    const r = row.rows.find((x) => x[h.indexOf('ID')] === base.id)!;
    expect([r[h.indexOf('Limit')], r[h.indexOf('Must stay')]]).toEqual([`${lower}–${base.range.limit}`, 'between']);
    const cs = load(snap);
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.items).toEqual([]);
  }, 30_000);

  it('changes a one-sided range to between when Limit gives two numbers, asking first when Must stay says one side', () => {
    const lower = base.range.limit - 2;
    const edit = (mustStay: string) => (rows: (string | number | null)[][]) => {
      const h = rows[0]!.map(String);
      const r = rows.find((x) => x[h.indexOf('ID')] === base.id)!;
      r[h.indexOf('Limit')] = `${lower} to ${base.range.limit}`;
      r[h.indexOf('Must stay')] = mustStay;
    };
    const changed = (cs: ReturnType<typeof load>) => {
      expect(cs.issues.filter((i) => i.severity === 'error' || i.level === 'check')).toEqual([]);
      expect(cs.items.map((x) => x.goal)).toEqual([base.title]);
      expect(cs.items[0]!.diffs.find((x) => x.field === 'Limit')).toMatchObject({ to: `Between ${fmt(lower, base)} and ${fmt(base.range.limit, base)}` });
    };
    changed(load(full, edit('between')));
    changed(load(full, edit('')));
    // The export's "at most", left as it was: asked, not overridden quietly (#300 review).
    const asked = load(full, edit('at most'));
    expect(asked.items).toEqual([]);
    expect(asked.issues.map((i) => `${i.level} ${i.kind}: ${i.message}`)).toEqual([`check near-word: Limit has two numbers (${lower}–${base.range.limit}) and Must stay says “at most”. Read it as between?`]);
    changed(load(full, edit('at most'), { [groupId('near-word', 'Goals', 'Must stay', 'at most')]: { choice: 'use' } }));
    const left = load(full, edit('at most'), { [groupId('near-word', 'Goals', 'Must stay', 'at most')]: { choice: 'leave' } });
    expect([left.items, left.issues.filter((i) => i.level !== 'note')]).toEqual([[], []]);
  }, 60_000);
});

describe('the database row', () => {
  it('writes and reads the lower bound, and clears it for a one-sided range', () => {
    const { goal } = goalToRows('ws', UPTIME);
    expect([goal.range_bound, goal.range_lower, goal.range_limit]).toEqual(['between', 99.5, 99.95]);
    expect((goalFromRows(goal, []) as RangeGoal).range).toEqual(UPTIME.range);
    expect(goalToRows('ws', RANGE).goal.range_lower).toBeNull();
    expect((goalFromRows(goalToRows('ws', RANGE).goal, []) as RangeGoal).range).toEqual(RANGE.range);
    // Read through public's redirect (no range_lower): its upper bound alone.
    const { range_lower: _, ...noLower } = goal;
    expect((goalFromRows(noLower, []) as RangeGoal).range).toEqual({ bound: 'atMost', limit: 99.95, margin: 0.1 });
  });
  it('leaves a number goal\'s row as it was', () => {
    const g = buildPlatformOrg(new Date('2026-11-11T12:00:00Z')).goals.find((x) => x.kind === 'metric')!;
    expect('range_lower' in goalToRows('ws', g).goal).toBe(false);
  });
});
