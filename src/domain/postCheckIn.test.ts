// @vitest-environment node
/* One way to save a check-in (check-in spec, rule 13; CK1) and what a new number is compared with (rule 5). */
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed } from './actions';
import { planChanges, postCheckIn, type CheckInPost } from './changeset';
import { earlierThisWeek, emptyDraft, lastValueOf, previousFor } from './checkin';
import { currentWeek, planAt } from './plan';
import { fmt } from './format';
import { goalScorecard } from './scorecard';
import { checkInsFor } from './status';
import type { CheckIn, MetricGoal, Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = s.goals.find((g) => g.id === 'mttr-pir') as MetricGoal;
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const x = (snapshot: Snapshot = s, actor = 'mateo') => ({ snapshot, cycle, week, actor: person(actor), now: '2026-11-05T13:00:00Z', newId: (p: string) => `${p}_k${++n}` });
const onPlan = String(Math.round(planAt(goal.plan, week, cycle.weeks)));
const post = (o: Partial<CheckInPost> = {}): CheckInPost => ({ goalId: goal.id, week, draft: { ...emptyDraft(goal, null), value: onPlan }, mode: 'new', ...o });
/** The workspace with this week's check-in on the goal taken away, so a first post is new. */
const fresh: Snapshot = { ...s, checkIns: s.checkIns.filter((c) => !(c.goalId === goal.id && c.week === week)) };

describe('one way to save a check-in (rule 13)', () => {
  it('posts a new check-in through the engine, with no import to undo and no Via mark', () => {
    const out = postCheckIn(x(fresh), post());
    expect(out.checkIn).toMatchObject({ goalId: goal.id, week, value: Number(onPlan), authorId: 'mateo' });
    expect(out.commit.changes.map((c) => c.action)).toEqual(['posted']);
    expect(out.commit.changes[0]!.summary).toMatch(/^Checked in for week \d+:/);
    expect(out.commit.changes[0]!.importId).toBeUndefined();
    expect(out.commit.changes[0]!.diffs.some((d) => d.field === 'Via')).toBe(false);
  });

  it('refuses a new check-in for a week that has one, and says what to do instead', () => {
    const after = applyCommit(fresh, postCheckIn(x(fresh), post()).commit);
    expect(() => postCheckIn(x(after), post())).toThrow(new NotAllowed(`Week ${week} already has a check-in. Check in again, or correct it.`));
  });

  it('adds a second check-in beside the first with “again”, and keeps both', () => {
    const first = postCheckIn(x(fresh), post());
    const after = applyCommit(fresh, first.commit);
    const again = postCheckIn(x(after), post({ mode: 'again', draft: { ...emptyDraft(goal, null), value: onPlan } }));
    expect(again.checkIn.id).not.toBe(first.checkIn.id);
    expect(again.commit.changes[0]!.summary).toMatch(/^Checked in again for week/);
    const both = applyCommit(after, again.commit);
    expect(checkInsFor(goal, both.checkIns).filter((c) => c.week === week)).toHaveLength(2);
  });

  it('corrects a week with a reason, as an import that can be undone, keeping when it was posted', () => {
    const past = checkInsFor(goal, s.checkIns).filter((c) => c.week < week).pop()!;
    const pw = past.week;
    const draft = { ...emptyDraft(goal, null), value: String(past.value), cause: past.cause, why: past.why, ptgWhat: past.pathToGreen?.what ?? '', ptgBy: past.pathToGreen?.byWeek ?? null, ptgState: past.pathToGreen?.state ?? 'plan', needs: past.pathToGreen?.needs ?? '', next: past.next };
    // Nothing different: nothing to save.
    expect(() => postCheckIn(x(), post({ week: pw, mode: 'correct', reason: 'The export was a day late', draft }))).toThrow(/Nothing is different from what week/);
    const changed = { ...draft, value: String(past.value! + 1) };
    // No reason: refused, in the spec's words.
    expect(() => postCheckIn(x(), post({ week: pw, mode: 'correct', reason: 'oops', draft: changed }))).toThrow(`Say why, in a sentence, so anyone reading week ${pw} later knows.`);
    const ok = postCheckIn(x(), post({ week: pw, mode: 'correct', reason: 'The export was a day late', draft: changed }));
    expect(ok.checkIn).toMatchObject({ id: past.id, postedAt: past.postedAt, value: past.value! + 1 });
    const entry = ok.commit.changes.find((c) => c.entity === 'check-in')!;
    expect(entry.summary).toBe(`Corrected week ${pw}: ${fmt(past.value!, goal)} is now ${fmt(past.value! + 1, goal)}`);
    expect(entry.diffs[0]).toEqual({ field: 'Why corrected', from: '—', to: 'The export was a day late' });
    expect(entry.importId).toBeTruthy();
    expect(ok.commit.changes.find((c) => c.action === 'imported')!.undo!.checkIns).toEqual([{ id: past.id, before: past }]);
  });

  it('refuses “new” or “again” for a week that has passed: that is a correction', () => {
    expect(() => postCheckIn(x(), post({ week: week - 1, mode: 'again' }))).toThrow(`Week ${week - 1} has passed. Correct it, or add it, with a reason.`);
  });

  it('lets only the owner or an admin post, in the engine’s words', () => {
    expect(() => postCheckIn(x(fresh, 'rhea'), post())).toThrow(/Only Mateo .* \(its owner\) or an admin can change/);
    expect(postCheckIn(x(fresh, 'amara'), post()).checkIn.authorId).toBe('amara');
  });
});

describe('a correction keeps the week it gives (K6)', () => {
  it('a row that gives a week keeps the week, though the old record was still investigating', () => {
    const own = checkInsFor(goal, s.checkIns);
    const w = own.at(-1)!.week;
    const old: CheckIn = { ...own.at(-1)!, status: 'risk', pathToGreen: { what: 'Looking into the tracker', byWeek: null, needs: '', state: 'investigating' } };
    const snap = { ...s, checkIns: s.checkIns.map((c) => (c.id === old.id ? old : c)) };
    const cs = planChanges({ tables: { checkIns: [{ __row: '2', 'goal id': goal.id, week: String(w), call: 'At risk', 'path to green': 'Close the actions by hand', 'back on plan by week': String(w + 3) }] }, snapshot: snap, cycle, week, actor: person('mateo'), now: today.toISOString(), newId: (p) => `${p}_r${++n}`, via: 'spreadsheet' });
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.commit!.checkIns![0]!.pathToGreen).toMatchObject({ state: 'plan', byWeek: w + 3 });
  });
});

describe('what a new number is compared with (rule 5)', () => {
  const ci = (id: string, w: number, value: number | null): CheckIn => ({ id, goalId: goal.id, authorId: 'mateo', week: w, postedAt: `2026-01-0${Math.min(w, 9)}T10:00:00Z`, value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false });
  const own = [ci('a', 44, 1.9), ci('b', 45, 1.8), ci('c', 46, 18), ci('d', 46, 1.9)];

  it('is last week’s, never a check-in of the same week', () => {
    expect(previousFor(own, 46)).toEqual({ checkIn: own[1], number: own[1] });
    expect(earlierThisWeek(own, 46)).toBe(own[3]);
    expect(lastValueOf(goal, own, 46)).toBe(1.8);
  });

  it('takes the newest number among earlier weeks when last week had none', () => {
    expect(previousFor([ci('a', 44, 10), ci('b', 45, null)], 46).number?.week).toBe(44);
    expect(previousFor([], 46)).toEqual({ checkIn: null, number: null });
  });

  it('says “vs last week” against week 45 after a second check-in in week 46', () => {
    const mine = s.checkIns.filter((c) => c.goalId !== goal.id);
    const last = checkInsFor(goal, s.checkIns).filter((c) => c.week < week).at(-1)!;
    const two = [...mine, { ...ci('x1', week, last.value! * 10), postedAt: '2026-11-04T09:00:00Z' }, { ...ci('x2', week, last.value!), postedAt: '2026-11-05T09:00:00Z' }];
    const cell = goalScorecard(goal, cycle, [...checkInsFor(goal, s.checkIns).filter((c) => c.week < week), ...two], week, false).cells.find((c) => c.key === 'since')!;
    expect(cell.sub).toBe(`was ${fmt(last.value!, goal)} in week ${last.week}`);
    expect(cell.value).toBe('No change');
  });
});
