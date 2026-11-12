// @vitest-environment node
/* Numbers and names (backlog N, 8 Nov): a number is never rounded quietly, letters in a number get one message, every
   number on screen has its thousands grouped, and numbers far outside a plan are asked about, never refused. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { emptyDraft, evaluate, valueProblem } from './checkin';
import { planChanges, type ChangeInput, type Rec } from './changeset';
import { fmt, fmtDiff, rangeText } from './format';
import { blankGoal, draftOf, type GoalDraft } from './goal';
import { goalChecks } from './goalEntry';
import { goalMustFix } from './goalEntry';
import { farOutside, fixed, groupDigits, notNumberText, precisionProblem, typedDecimals } from './numbers';
import { currentWeek } from './plan';
import type { Goal, MetricGoal } from './types';

/** Goal entry's rule 2 as one line per field (the first for each), for the checks below. */
const fixes = (d: GoalDraft, cycleWeeks: number, x: { existing?: Goal | null; week?: number; door?: 'form' | 'table' } = {}): Partial<Record<string, string>> =>
  Object.fromEntries(goalMustFix(d, { cycleWeeks, week: x.week ?? 0, existing: x.existing ?? null, door: x.door ?? 'table' }).reverse().map((f) => [f.field, f.text]));


const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const whole = s.goals.find((g): g is MetricGoal => g.kind === 'metric' && g.decimals === 0 && g.plan.target > g.plan.start)!;
const owner = s.people.find((p) => p.id === whole.ownerId)!;
let n = 0;
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const base = (tables: ChangeInput['tables']): ChangeInput => ({ tables, snapshot: s, cycle, week, actor: owner, now: today.toISOString(), newId: (p) => `${p}_n${++n}`, via: 'table' });

describe('no silent rounding', () => {
  it('counts the decimal places a number was typed with', () => {
    expect(['12.5', '12', '1,250', '1,250.75', '29,4', '12.50', '62%', '3.25 days'].map(typedDecimals)).toEqual([1, 0, 0, 2, 1, 1, 0, 2]);
  });

  it('refuses a number with more decimal places than its goal keeps, and says what it would show as', () => {
    expect(precisionProblem('12.5', 12.5, 0)).toBe('12.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13. Type 13, or set the goal’s Decimals to 1.');
    expect(precisionProblem('12.5', 12.5, 1)).toBeNull();
    expect(precisionProblem('12.50', 12.5, 1)).toBeNull();
    expect(precisionProblem('1,250', 1250, 0)).toBeNull();
  });

  it('refuses it in a check-in, as a code the screens and the import read', () => {
    const d = { ...emptyDraft(whole, null), value: '12.5' };
    expect(evaluate(whole, cycle, week, d, s.checkIns).codes[0]).toBe('value-precision');
    expect(valueProblem('12.5', null, whole.unit, whole)).toEqual({ block: true, text: precisionProblem('12.5', 12.5, 0) });
  });

  it('refuses it in New goal and goal edit, for start, target, limit, margin and plan numbers typed by hand', () => {
    const d = { ...blankGoal('t', 'p', ''), title: 'Reduce latency', start: '12.5', target: '20', decimals: '0' };
    expect(fixes(d, cycle.weeks).start).toMatch(/would show as 13/);
    expect(fixes({ ...d, decimals: '1' }, cycle.weeks).start).toBeUndefined();
    // Decimals not chosen: what is typed is what is kept (goal entry, rule 2's decimalsFor).
    expect(fixes({ ...d, decimals: '' }, cycle.weeks).start).toBeUndefined();
    expect(fixes({ ...d, start: '12', points: { '4': '13.25' } }, cycle.weeks).points).toMatch(/13.25 has 2 decimal places/);
    const r = { ...d, kind: 'range' as const, limit: '4.5', margin: '0.5' };
    expect(fixes(r, cycle.weeks)).toMatchObject({ limit: expect.stringMatching(/would show as 5/), margin: expect.stringMatching(/would show as 1/) });
  });

  it('leaves a stored plan alone when editing: only numbers changed are judged', () => {
    const withPoints = s.goals.find((g): g is MetricGoal => g.kind === 'metric' && (g.plan.points?.length ?? 0) > 0);
    if (withPoints) expect(fixes(draftOf(withPoints), cycle.weeks, { existing: withPoints }).points).toBeUndefined();
  });

  it('refuses it in the spreadsheet import and the AI tools, which share the bulk-change engine', () => {
    const goals = planChanges(base({ goals: [rec({ id: whole.id, Target: String(whole.plan.target + 0.5) })] }));
    expect(goals.issues.find((i) => i.severity === 'error')?.message).toMatch(/has 1 decimal place, but this goal keeps whole numbers/);
    const cis = planChanges(base({ checkIns: [rec({ 'Goal ID': whole.id, Week: String(week), Value: '12.5' })] }));
    expect(cis.issues.find((i) => i.severity === 'error')?.message).toBe(`Week ${week}: ${precisionProblem('12.5', 12.5, 0)}`);
  });

  it('reads a decimal comma as decimal places when an import works out a new goal’s decimals', () => {
    const t = { goals: [rec({ Goal: 'Reduce build minutes', 'Owner email': owner.email ?? '', Unit: 'min', Start: '12,5', Target: '8' })] };
    const asked = planChanges(base(t));
    expect(asked.issues.filter((i) => i.severity === 'error')).toEqual([]);
    // A comma as the decimal mark is read, and asked about once for the file.
    expect(asked.groups.filter((g) => g.level !== 'note').map((g) => g.kind)).toEqual(['decimal-comma']);
    const cs = planChanges({ ...base(t), answers: { [asked.groups.find((g) => g.kind === 'decimal-comma')!.id]: { choice: 'right' } } });
    expect((cs.commit!.goals!.find((g) => g.title === 'Reduce build minutes') as MetricGoal).decimals).toBe(1);
  });

  it('keeps the demo workspace to its own rule: no number stored finer than its goal shows', () => {
    const fine = (v: number, d: number) => Math.abs(v - Number(v.toFixed(d))) < 1e-9;
    for (const g of s.goals) {
      if (g.kind === 'milestone') continue;
      const typed = g.kind === 'metric' ? [g.plan.start, g.plan.target] : [g.range.limit, g.range.margin];
      expect(typed.every((v) => fine(v, g.decimals)), g.title).toBe(true);
      expect(s.checkIns.filter((c) => c.goalId === g.id && c.value != null).every((c) => fine(c.value!, g.decimals)), g.title).toBe(true);
    }
  });
});

describe('one message for letters in a number', () => {
  it('says the same in the check-in, New goal, the workspace set-up and the import', () => {
    const msg = notNumberText('a12');
    expect(msg).toBe('“a12” isn’t a number. Type digits only, like 29.4.');
    expect(valueProblem('a12', null, '%')?.text).toBe(msg);
    const d = { ...blankGoal('t', 'p', ''), title: 'Reduce latency', start: 'a12', target: 'b12', effect: 'x1' };
    // New goal gives the example at the goal's own decimal places (goal entry, section 4: not-number).
    expect(fixes({ ...d, parentId: 'p1' }, cycle.weeks)).toMatchObject({ start: notNumberText('a12', 0), target: notNumberText('b12', 0), effect: notNumberText('x1') });
    const cs = planChanges(base({ checkIns: [rec({ 'Goal ID': whole.id, Week: String(week), Value: 'a12' })] }));
    // The import names the goal's own decimal places in its example, as the check-in does (deep review U10).
    expect(cs.issues.find((i) => i.severity === 'error')?.message).toBe(`Week ${week}: ${notNumberText('a12', whole.decimals)}`);
  });

  it('gives an example at the goal’s decimal places: no decimal on a whole-number goal (deep review U10)', () => {
    expect(notNumberText('a12', 0)).toBe('“a12” isn’t a number. Type digits only, like 29.');
    expect(notNumberText('a12', 2)).toBe('“a12” isn’t a number. Type digits only, like 29.45.');
    expect(valueProblem('a12', null, whole.unit, whole)?.text).toBe(notNumberText('a12', 0));
  });
});

describe('thousand separators', () => {
  it('groups the digits of every number shown', () => {
    expect(['1250', '-12000', '999999999.5', '125', '0.0001', '1000000'].map(groupDigits)).toEqual(['1,250', '-12,000', '999,999,999.5', '125', '0.0001', '1,000,000']);
    expect(fmt(1250000, { unit: 'USD', decimals: 0 })).toBe('1,250,000 USD');
    expect(fmt(4321.5, { unit: '%', decimals: 1 })).toBe('4,321.5%');
    expect(fmtDiff(-1500, { unit: 'tickets', decimals: 0 })).toBe('1,500 tickets');
    expect(rangeText({ low: 1200, high: 1500 }, { unit: 'h', decimals: 0 })).toBe('1,200–1,500 h');
    expect(fixed(12345.678, 2)).toBe('12,345.68');
  });
});

describe('plausibility: asked, never refused', () => {
  it('asks about a check-in far outside the plan', () => {
    const g = { ...whole, unit: '%', decimals: 0, plan: { ...whole.plan, start: 30, target: 75 } } as MetricGoal;
    expect(farOutside(400, 30, 75)).toBe(true);
    expect(farOutside(110, 30, 75)).toBe(false);
    expect(valueProblem('99', null, 'tickets', { ...g, unit: 'tickets', plan: { ...g.plan, start: 3, target: 9 } })).toEqual({ block: false, text: 'That’s far outside this goal’s plan (3 to 9 tickets). Is 99 right?', id: 'far-outside-plan' });
  });

  it('asks about a set-up number below zero for a time, money or percentage, a target a hundred times the start, or a billion', () => {
    // Goal entry's rule 3 (domain/goalEntry goalChecks): the same questions at every door.
    const asked = (d: Partial<GoalDraft>) => goalChecks({ ...blankGoal('t', 'p', ''), title: 'A goal', ...d }, { week: 1, cycleWeeks: 53, existing: null, door: 'form' }).filter((c) => c.id !== 'no-unit').map((c) => c.question);
    expect(asked({ unit: 'days', start: '-5', target: '10' })).toEqual(['-5 days is below zero. That’s fine for a change or a balance. Is it right here?']);
    expect(asked({ unit: '', start: '-5', target: '10' })).toEqual([]);
    expect(asked({ unit: 'signups', start: '10', target: '5000' })).toEqual(['The target (5,000 signups) is over 100 times where it starts (10 signups). Is that right?']);
    expect(asked({ unit: 'signups', start: '1', target: '999999999' })).toEqual(['The target (999,999,999 signups) is over 100 times where it starts (1 signups). Is that right?']);
    expect(asked({ unit: 'signups', start: '0', target: '1000000000' })).toEqual(['1,000,000,000 signups is a billion or more. Is it right?']);
    expect(asked({ unit: '%', start: '50', target: '120' })[0]).toMatch(/^The target is over 100%\./);
    expect(asked({ kind: 'range', unit: 'min', limit: '-3' })).toEqual(['-3 min is below zero. That’s fine for a change or a balance. Is it right here?']);
  });

  it('asks it in an import without refusing the row, and saves once it is answered (C6)', () => {
    const t = { goals: [rec({ Goal: 'Grow weekly signups', 'Owner email': owner.email ?? '', Start: '10', Target: '5000', Unit: 'signups' })] };
    const cs = planChanges(base(t));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.issues.find((i) => i.kind === 'odd-number')).toMatchObject({ level: 'check', message: expect.stringMatching(/over 100 times where it starts/) });
    expect(cs.commit).toBeNull();
    expect(planChanges({ ...base(t), answers: { [cs.groups.find((g) => g.kind === 'odd-number')!.id]: { choice: 'right' } } }).commit).not.toBeNull();
  });
});
