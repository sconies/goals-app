// @vitest-environment node
/* The check-in rhythm (FT1, docs/design/feature-toggles/spec.md sections 1.1 and 2): every week, or no set rhythm, kept
   on the cycle. The spec's cycle starts Mon 7 Sept 2026, 13 weeks, due by Thursday; week 4 starts Mon 5 Oct. */
import { buildPlatformOrg } from '../data/platformOrg';
import { cycleFromRow, cycleToRow } from '../data/rows';
import { CYCLE, checkIn, metric } from '../spec/examples';
import { NotAllowed, type ActionContext } from './actions';
import { flagsFor } from './attention';
import { dueDate, firstDueWeek, firstReports, onTimeStreak, weekDoneText, weekProgress } from './progress';
import { goalStatus } from './status';
import { checkInList, rhythmReadBack, setRhythm } from './rhythm';
import { RULES, rhythmOf, staleAfterDays } from './thresholds';
import type { Cycle, Person, Snapshot } from './types';
import { goalScorecard } from './scorecard';
import { standingAction } from './goalPage';
import { canAskUpdate } from './rhythm';
import { gettingStarted } from './dayOne';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from './importer';
import { definitions, startHere } from './export';
import { RHYTHM } from './vocabulary';

const NONE: Cycle = { ...CYCLE, checkInWeeks: 0 };
const THU_8_OCT = new Date('2026-10-08T12:00:00Z');
const empty = (() => {
  const s = buildPlatformOrg(THU_8_OCT) as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? [] : v])) as unknown as Snapshot;
})();
const snap = (over: Partial<Snapshot>): Snapshot => ({ ...empty, cycles: [CYCLE], ...over });
const g = metric(0, 100);

describe('the rhythm helpers', () => {
  it('reads every week when unset, none at 0, and counts staleness in check-ins', () => {
    expect(RULES.staleCheckIns).toBe(2);
    expect(rhythmOf(CYCLE)).toEqual({ weeks: 1, dueDay: 3, from: '2026-09-07' });
    expect(rhythmOf(NONE)).toBeNull();
    expect(rhythmOf({ ...CYCLE, rhythmFrom: '2026-10-05' })!.from).toBe('2026-10-05');
    expect(staleAfterDays(CYCLE)).toBe(14);
    expect(staleAfterDays(NONE)).toBeNull();
    expect(RULES.staleDays).toBe(staleAfterDays(CYCLE));
  });
});

describe('goalStatus with and without a rhythm (2.1)', () => {
  const mon14 = checkIn('m', 1, 10, { postedAt: '2026-09-14T10:00:00Z' });
  it('on track at week 1, today week 4: stale every week; on track as of week 1 with none', () => {
    expect(goalStatus(g, CYCLE, [mon14], THU_8_OCT).status).toBe('stale');
    const s = goalStatus(g, NONE, [mon14], THU_8_OCT);
    expect([s.status, s.asOfWeek]).toEqual(['on', 1]);
  });
  it('no check-in at all: stale every week; none with no rhythm', () => {
    expect(goalStatus(g, CYCLE, [], THU_8_OCT).status).toBe('stale');
    expect(goalStatus(g, NONE, [], THU_8_OCT).status).toBe('none');
  });
  it('off track this week: off either way, asOfWeek null', () => {
    const c = checkIn('m', 4, 10, { status: 'off', calculated: 'off' });
    for (const cy of [CYCLE, NONE]) expect([goalStatus(g, cy, [c], THU_8_OCT).status, goalStatus(g, cy, [c], THU_8_OCT).asOfWeek]).toEqual(['off', null]);
  });
  it('a rhythm switched on on Mon 5 Oct counts from then: on track on the 8th, stale on the 19th', () => {
    const from: Cycle = { ...CYCLE, rhythmFrom: '2026-10-05' };
    expect([goalStatus(g, from, [mon14], THU_8_OCT).status, goalStatus(g, from, [mon14], THU_8_OCT).asOfWeek]).toEqual(['on', 1]);
    expect(goalStatus(g, from, [mon14], new Date('2026-10-19T12:00:00Z')).status).toBe('stale');
  });
  it('week 0 is planned and a done goal is done, either way', () => {
    for (const cy of [CYCLE, NONE]) {
      expect(goalStatus(g, cy, [], new Date('2026-09-08T12:00:00Z')).status).toBe('planned');
      expect(goalStatus(g, cy, [checkIn('m', 2, 100, { status: 'done' })], THU_8_OCT).status).toBe('done');
    }
  });
});

describe('flags with and without a rhythm (2.2)', () => {
  const flags = (cy: Cycle, cs: ReturnType<typeof checkIn>[]) => flagsFor(g, snap({ goals: [g], checkIns: cs, cycles: [cy] }), cy, THU_8_OCT).flags.map((f) => f.kind);
  it('on track at week 3, nothing for week 4: due every week, nothing with none', () => {
    expect(flags(CYCLE, [checkIn('m', 3, 30)])).toContain('due');
    expect(flagsFor(g, snap({ goals: [g], checkIns: [checkIn('m', 3, 30)] }), CYCLE, THU_8_OCT).flags.find((f) => f.kind === 'due')!.detail).toBe('Due by Thu 8 Oct.');
    expect(flags(NONE, [checkIn('m', 3, 30)])).toEqual([]);
  });
  it('at risk at week 1 with no path to green: stale and due every week; its real flags with none', () => {
    const c = checkIn('m', 1, 5, { status: 'risk', calculated: 'risk', postedAt: '2026-09-14T10:00:00Z' });
    expect(flags(CYCLE, [c])).toEqual(expect.arrayContaining(['stale', 'due']));
    const none = flags(NONE, [c]);
    expect(none).not.toContain('stale');
    expect(none).not.toContain('due');
    expect(none).toContain('risk');
  });
});

describe('progress with and without a rhythm (2.3)', () => {
  const s = snap({ goals: [g], checkIns: [] });
  it('nothing is due or upcoming with no set rhythm, and the sentence owes nothing', () => {
    const p = weekProgress('p', s, NONE, 4, THU_8_OCT);
    expect([p.due.length, p.upcoming.length, p.goals.length]).toEqual([0, 0, 1]);
    expect(weekDoneText(p, 4, NONE)).toBe('0 of 1 have a check-in for week 4.');
    expect(weekProgress('p', s, CYCLE, 4, THU_8_OCT).due.length).toBe(1);
  });
  it('no streak, no due date and no first due week with no set rhythm', () => {
    expect(onTimeStreak('p', s, NONE, 4)).toBeNull();
    expect(dueDate(NONE, 4)).toBeNull();
    expect(dueDate(CYCLE, 4)).toBe('2026-10-08');
    expect(firstDueWeek(g, NONE)).toBe(Infinity);
    expect(firstReports(s, NONE, 4)!.due).toBeNull();
  });
  it('a streak never counts a week before the rhythm began', () => {
    const goals = [g];
    const checkIns = [1, 2, 3, 4, 5].map((w) => checkIn('m', w, w * 10));
    expect(onTimeStreak('p', snap({ goals, checkIns }), CYCLE, 5)).toBe(5);
    expect(onTimeStreak('p', snap({ goals, checkIns }), { ...CYCLE, rhythmFrom: '2026-10-05' }, 5)).toBe(2);
  });
  it('the check-in list: never-checked-in first, then oldest; done and stopped left out', () => {
    const goals = ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i'].map((id) => metric(0, 100, 'straight', { id }));
    goals[7] = { ...goals[7]!, stoppedAt: '2026-10-01T00:00:00Z' };
    const checkIns = [checkIn('a', 46 - 40, 1), checkIn('b', 2, 1), checkIn('c', 3, 1), checkIn('d', 4, 1, { status: 'done' }), checkIn('e', 6, 1), checkIn('f', 1, 1)];
    const l = checkInList('p', goals, checkIns, 6);
    expect(l.thisWeek.map((r) => r.goalId)).toEqual(['a', 'e']);
    expect(l.waiting.map((r) => r.goalId)).toEqual(['h', 'f', 'b', 'c']);
  });
});

describe('setRhythm (1.1)', () => {
  const admin = { id: 'amara', name: 'Amara', admin: true } as ActionContext['actor'];
  const x = (over: Partial<ActionContext> = {}): ActionContext => ({ snapshot: snap({}), cycle: CYCLE, week: 4, actor: admin, now: '2026-10-08T12:00:00.000Z', newId: (p) => `${p}_1`, ...over });
  const refused = (f: () => unknown) => { try { f(); return null; } catch (e) { expect(e).toBeInstanceOf(NotAllowed); return (e as Error).message; } };
  it('refuses with its words', () => {
    expect(refused(() => setRhythm(x({ actor: { ...admin, admin: false } }), CYCLE, { weeks: 0 }))).toBe('Only admins can change the check-in rhythm.');
    expect(refused(() => setRhythm(x(), CYCLE, { weeks: 2 }))).toBe('Faro checks in every week, or on no set rhythm.');
    expect(refused(() => setRhythm(x(), CYCLE, { weeks: 1, dueDay: 7 }))).toBe('Choose a day of the week.');
    expect(refused(() => setRhythm(x({ now: '2027-03-01T12:00:00.000Z' }), CYCLE, { weeks: 0 }))).toBe('That year is over; its rhythm can’t change.');
    expect(setRhythm(x(), CYCLE, { weeks: 1, dueDay: 3 })).toBeNull();
  });
  it('to none, logged in words, rhythmFrom unchanged', () => {
    const c = setRhythm(x(), CYCLE, { weeks: 0 })!;
    expect(c.cycles![0]).toMatchObject({ checkInWeeks: 0 });
    expect(c.cycles![0]!.rhythmFrom).toBeUndefined();
    expect(c.changes![0]).toMatchObject({ entity: 'workspace', action: 'edited', summary: 'Changed the check-in rhythm from every week to no set rhythm', diffs: [{ field: 'Check-in rhythm', from: 'every week, due by Thursday', to: 'no set rhythm' }] });
  });
  it('back to every week starts the rhythm today; only the day does not restart it', () => {
    const c = setRhythm(x(), NONE, { weeks: 1, dueDay: 3 })!;
    expect(c.cycles![0]).toMatchObject({ checkInWeeks: 1, rhythmFrom: '2026-10-08' });
    expect(c.changes![0]!.summary).toBe('Changed the check-in rhythm from no set rhythm to every week, due by Thursday');
    const d = setRhythm(x(), { ...CYCLE, rhythmFrom: '2026-09-21' }, { weeks: 1, dueDay: 4 })!;
    expect(d.cycles![0]).toMatchObject({ reviewDay: 4, rhythmFrom: '2026-09-21' });
    expect(d.changes![0]!.summary).toBe('Changed the day check-ins are due by from Thursday to Friday');
  });
  it('undo puts the cycle back as it was, rhythmFrom included', () => {
    const c = setRhythm(x(), { ...NONE, checkInWeeks: 1, rhythmFrom: '2026-10-08' }, { weeks: 0, dueDay: 3, from: null })!;
    expect(cycleToRow('ws', c.cycles![0]!)).toMatchObject({ check_in_weeks: 0, rhythm_from: null });
  });
});

describe('the rhythm in a saved row (rows.ts)', () => {
  it('a cycle without the fields writes every week and no start, and reads as before; with them, round trips', () => {
    const row = cycleToRow('ws', CYCLE);
    expect(row).toMatchObject({ check_in_weeks: 1, rhythm_from: null });
    expect(cycleFromRow(row)).toEqual(CYCLE);
    const none: Cycle = { ...CYCLE, checkInWeeks: 0, rhythmFrom: '2026-10-05' };
    expect(cycleFromRow(cycleToRow('ws', none))).toEqual(none);
  });
});

describe('rhythmReadBack (4.2)', () => {
  it('counts what stops reading No recent update, by the status each would show', () => {
    const goals = ['a', 'b', 'c'].map((id) => metric(0, 100, 'straight', { id }));
    const checkIns = [checkIn('a', 1, 10, { postedAt: '2026-09-14T10:00:00Z' }), checkIn('b', 4, 40)];
    const r = rhythmReadBack(goals, checkIns, CYCLE, { weeks: 0 }, THU_8_OCT);
    expect(r).toEqual({ live: 3, unstale: 2, unstaleBy: { on: 1, none: 1 }, stale: 0 });
    expect(rhythmReadBack(goals, checkIns, NONE, { weeks: 1, dueDay: 3 }, THU_8_OCT).stale).toBe(0);
  });
});

describe('the goal page with no set rhythm (2.5)', () => {
  const four = [1, 2, 3, 4].map((w) => checkIn('m', w, w * 8));
  it('the forecast is made from the numbers there are and says whose pace it is; never Can’t say for age alone', () => {
    const none = goalScorecard(g, NONE, four, 6, false, 4).cells.find((c) => c.key === 'hit')!;
    expect(none.value).not.toBe('Can’t say');
    expect(none.sub).toMatch(/^likely .* · on the pace to week 4$/);
    expect(goalScorecard(g, CYCLE, four, 6, true).cells.find((c) => c.key === 'hit')!.value).toBe('Can’t say');
    expect(goalScorecard(g, CYCLE, four, 4, false).cells.find((c) => c.key === 'hit')!.sub).not.toMatch(/pace/);
  });
  const julia = { id: 'p', name: 'Julia Reyes' } as Person, amara = { id: 'amara', name: 'Amara Obi' } as Person;
  it('anyone but the owner may ask for an update while the latest check-in isn’t this week’s and none is open', () => {
    const o = { goal: g, viewer: amara, status: 'on' as const, latestWeek: 44, week: 46, updateAsked: false };
    expect(canAskUpdate(o)).toBe(true);
    expect(canAskUpdate({ ...o, latestWeek: 46 })).toBe(false);
    expect(canAskUpdate({ ...o, updateAsked: true })).toBe(false);
    expect(canAskUpdate({ ...o, viewer: julia })).toBe(false);
    expect(canAskUpdate({ ...o, status: 'done' })).toBe(false);
    expect(canAskUpdate({ ...o, goal: { ...g, stoppedAt: '2026-10-01T00:00:00Z' } })).toBe(false);
  });
  it('the owner’s check-in is an ordinary button, said for the week when none is in yet', () => {
    const primary = { kind: null, label: '', targetId: null };
    expect(standingAction({ goal: g, viewer: julia, primary, watching: false, status: 'on', week: 46, checkedInThisWeek: false }).label).toBe('Check in for week 46');
    expect(standingAction({ goal: g, viewer: julia, primary, watching: false, status: 'on', week: 46, checkedInThisWeek: true }).label).toBe('Check in again');
    expect(standingAction({ goal: g, viewer: julia, primary, watching: false, status: 'on' }).label).toBe('Check in again');
  });
});

describe('set-up, Getting started and the export with no set rhythm (2.4, 2.6)', () => {
  const now = new Date('2026-11-12T10:00:00Z');
  it('Getting started asks for the first check-in without a due day', () => {
    const rows = { goals: [{ ...g, ownerId: 'ana' }], checkedIn: new Set<string>(), creatorId: 'ana', ended: false, people: [{ id: 'ana', name: 'Ana' }] } as unknown as Parameters<typeof gettingStarted>[1];
    const ws = { name: 'Field', kind: 'live', createdAt: '2026-11-12T09:00:00Z' };
    const said = (due: string | null) => gettingStarted('ana', rows, ws, { firstSeenAt: '2026-11-12T09:00:00Z' }, now, due).find((r) => r.id === 'first-check-in')!.says;
    expect(said(null)).toBe('Post your first check-in, so everyone can see where it starts.');
    expect(said('Thursday')).toBe('Post your first check-in. It’s due by Thursday.');
  });
  it('buildWorkspace sets the rhythm, makes the weekly review only when asked, and pins no quiet view with none', () => {
    const base = { name: 'Platform', startDate: '2026-11-02', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now, idSuffix: 'ab12' };
    const every = buildWorkspace(base).snapshot;
    expect(every.cycles[0]!.checkInWeeks).toBeUndefined();
    expect([every.reviews.length, every.views!.some((v) => v.params.startsWith('quiet='))]).toEqual([1, true]);
    const none = buildWorkspace({ ...base, checkInWeeks: 0, weeklyReview: false }).snapshot;
    expect(none.cycles[0]!.checkInWeeks).toBe(0);
    expect([none.reviews.length, none.views!.some((v) => v.params.startsWith('quiet='))]).toEqual([0, false]);
  });
  it('the Start here sheet says the rhythm, and defines No recent update only with one', () => {
    const ws = { id: 'ws', name: 'Platform' } as Parameters<typeof startHere>[0]['ws'];
    const text = (cy: Cycle) => startHere({ ws, cycle: cy, week: 4, today: THU_8_OCT }).map((r) => r.join(' ')).join('\n');
    expect(text(NONE)).toContain('Check-in rhythm: none. A status is the latest check-in’s.');
    expect(text(CYCLE)).toContain('Check-in rhythm: every week, due by Thursday.');
    expect(definitions(false).some((r) => r[1] === 'No recent update')).toBe(false);
    expect(definitions(true).some((r) => r[1] === 'No recent update')).toBe(true);
  });
  it('the vocabulary says “as of week”', () => {
    expect(RHYTHM.asOf.label).toBe('as of week {n}');
  });
});
