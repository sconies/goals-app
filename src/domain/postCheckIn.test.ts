// @vitest-environment node
/* One way to save a check-in (check-in spec, rule 13; CK1) and what a new number is compared with (rule 5). */
import { cycleDates } from './cycle';
import { applyCommit } from '../data/store';
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed } from './actions';
import { planChanges, postCheckIn, type CheckInPost, type Via } from './changeset';
import { ADMIN_CHECK_IN_DOORS } from './goalRights';
import { checkInLevels, earlierThisWeek, emptyDraft, lastValueOf, previousFor, stepState, unanswered, type Answers, type Draft } from './checkin';
import { currentWeek, planAt } from './plan';
import { fmt } from './format';
import { goalScorecard } from './scorecard';
import { checkInsFor } from './status';
import type { CheckIn, Goal, MetricGoal, Snapshot } from './types';

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
    expect(() => postCheckIn(x(), post({ week: pw, mode: 'correct', reason: 'oops', draft: changed }))).toThrow(`Say why, in a sentence of at least 10 characters (at most 500), so anyone reading week ${pw} later knows.`);
    const ok = postCheckIn(x(), post({ week: pw, mode: 'correct', reason: 'The export was a day late', draft: changed }));
    expect(ok.checkIn).toMatchObject({ id: past.id, postedAt: past.postedAt, value: past.value! + 1 });
    const entry = ok.commit.changes.find((c) => c.entity === 'check-in')!;
    expect(entry.summary).toBe(`Corrected week ${pw}: ${fmt(past.value!, goal)} is now ${fmt(past.value! + 1, goal)}`);
    expect(entry.diffs[0]).toEqual({ field: 'Why corrected', from: '—', to: 'The export was a day late' });
    // A reason is words: ten full stops, or a pasted document, is not one (review of #225, lows).
    for (const bad of ['..........', 'x'.repeat(501)]) expect(() => postCheckIn(x(), post({ week: pw, mode: 'correct', reason: bad, draft: changed }))).toThrow(/Say why, in a sentence of at least 10/);
    // A cycle that has ended can't be corrected from the form (check-in design 2.7).
    const late = { ...x(), now: new Date(Date.parse(cycleDates(cycle).wrapUpCloses) + 86_400_000 * 2).toISOString() };
    expect(() => postCheckIn(late, post({ week: pw, mode: 'correct', reason: 'The export was a day late', draft: changed }))).toThrow(`${cycle.name} has ended, so its check-ins can’t be corrected here.`);
    expect(entry.importId).toBeTruthy();
    expect(ok.commit.changes.find((c) => c.action === 'imported')!.undo!.checkIns).toEqual([{ id: past.id, before: past }]);
  });

  it('refuses “new” or “again” for a week that has passed: that is a correction', () => {
    expect(() => postCheckIn(x(), post({ week: week - 1, mode: 'again' }))).toThrow(`Week ${week - 1} has passed. Correct it, or add it, with a reason.`);
  });

  it('asks the owner before the change’s own edits: an admin can’t take a goal and check in on it in one change (#227 review)', () => {
    const take = (who: string, owner: string) => planChanges({ tables: { goals: [{ __row: '2', key: goal.key!, owner: person(owner).name }], checkIns: [{ __row: '2', 'goal id': goal.id, week: String(week), value: onPlan }] }, snapshot: fresh, cycle, week, actor: person(who), now: '2026-11-05T13:00:00Z', newId: (p) => `${p}_o${++n}`, via: 'mcp' });
    const admin = take('amara', 'amara');
    expect(admin.commit).toBeNull();
    expect(admin.issues.find((i) => i.kind === 'not-allowed')!.message).toMatch(/^Only Mateo .* \(its owner\) can check in on/);
    // The owner handing it on and checking in for the week, at once, is the owner's check-in.
    expect(take('mateo', 'rhea').commit!.checkIns![0]!.authorId).toBe('mateo');
  });

  it('lets only the owner post, in the engine’s words: not someone else, and not an admin (Lane, 12 Nov)', () => {
    expect(() => postCheckIn(x(fresh, 'rhea'), post())).toThrow(/Only Mateo .* \(its owner\) can check in on/);
    expect(() => postCheckIn(x(fresh, 'amara'), post())).toThrow(/Only Mateo .* \(its owner\) can check in on/);
    expect(postCheckIn(x(fresh, 'mateo'), post()).checkIn.authorId).toBe('mateo');
  });

  it('closes every door to posting for someone else but the two exceptions Lane kept: an admin’s workbook and an admin’s correction in Data', () => {
    const row = { __row: '2', 'goal id': goal.id, week: String(week), value: post().draft.value };
    const as = (who: string, via: Via) => planChanges({ tables: { checkIns: [row] }, snapshot: fresh, cycle, week, actor: person(who), now: today.toISOString(), newId: (p) => `${p}_d${++n}`, via });
    const refused = (cs: ReturnType<typeof as>) => cs.issues.some((i) => i.kind === 'not-allowed' && /can check in on/.test(i.message));
    // The one-table check-in and the AI tools: the owner only, an admin included.
    for (const via of ['bulk', 'mcp', 'form'] as const) expect(refused(as('amara', via)), via).toBe(true);
    expect(refused(as('rhea', 'table')), 'a member in Data').toBe(true);
    // The two exceptions (Lane, 12 Nov), named in mayPostCheckIn: an admin's import and setting up, and an admin's correction in Data.
    // Each only for what it is (Lane, 13 Nov; backlog AD): this week's new check-in is neither, so one pasted row from an
    // admin is refused for someone else's goal, at every door, with what that door is for.
    for (const via of ADMIN_CHECK_IN_DOORS) expect(refused(as('amara', via)), via).toBe(true);
    expect(as('amara', 'spreadsheet').issues.find((i) => i.kind === 'not-allowed')!.message).toMatch(/A workbook brings in past weeks, not this week’s new check-in\.$/);
    expect(as('amara', 'table').issues.find((i) => i.kind === 'not-allowed')!.message).toMatch(/Data’s tables correct a check-in; they don’t add one\.$/);
    // A past week from a workbook is brought in; Data's tables correct a check-in that exists, and add none.
    const pastWeek = (via: Via) => planChanges({ tables: { checkIns: [{ ...row, week: String(week - 1) }] }, snapshot: { ...fresh, checkIns: fresh.checkIns.filter((c) => !(c.goalId === goal.id && c.week === week - 1)) }, cycle, week, actor: person('amara'), now: today.toISOString(), newId: (p) => `${p}_d${++n}`, via, reason: 'Loaded' });
    for (const via of ['spreadsheet', 'setup'] as const) expect(refused(pastWeek(via)), via).toBe(false);
    expect(refused(pastWeek('table')), 'Data adds a past week').toBe(true);
    expect(refused(as('mateo', 'mcp')), 'the owner').toBe(false);
  });

  it('records who made the change through each exception: the admin as author and actor, with the door as its Via, and says whose it replaced', () => {
    const last = s.checkIns.filter((c) => c.goalId === goal.id).at(-1)!;
    const label = { spreadsheet: 'Spreadsheet', setup: 'Set-up', table: 'Data tables' } as const;
    for (const via of ADMIN_CHECK_IN_DOORS) {
      const row = { __row: '2', id: last.id, 'goal id': goal.id, week: String(last.week), value: String((last.value ?? 0) + 1), why: 'Corrected from the source data' };
      const cs = planChanges({ tables: { checkIns: [row] }, snapshot: s, cycle, week, actor: person('amara'), now: today.toISOString(), newId: (p) => `${p}_w${++n}`, via, reason: 'Corrected from the source data.' });
      expect(cs.commit!.checkIns!.map((c) => c.authorId), via).toEqual(['amara']);
      const changes = cs.commit!.changes!;
      expect(changes.length, via).toBeGreaterThan(0);
      for (const c of changes) {
        expect(c.actorId, via).toBe('amara');
        expect(c.diffs.find((d) => d.field === 'Via')?.to, via).toBe(label[via as keyof typeof label]);
      }
      // Replacing someone else's check-in is said before saving (C18).
      expect(cs.issues.some((i) => i.kind === 'replaces'), via).toBe(true);
    }
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

describe('the levels in a check-in (rules 2 and 3)', () => {
  const ci = (w: number, value: number | null): CheckIn => ({ id: 'c' + w, goalId: 'g', authorId: 'p', week: w, postedAt: '2026-11-01T10:00:00Z', value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false });
  const flaky = { id: 'g', kind: 'range', title: 'Flaky test rate', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 2, warn: 0.4 } } as unknown as Goal;
  const suites = { id: 'g', kind: 'metric', title: 'Test suites split', unit: '%', decimals: 0, plan: { start: 40, target: 100, fromWeek: 1, dueWeek: 50, shape: 'straight' } } as unknown as Goal;
  const d = (value: string, answers?: Answers): Draft => ({ ...emptyDraft(suites, null), value, answers });

  it('asks about a number far from last week’s, naming the week, and asks again once the number changes', () => {
    const own = [ci(44, 1.9), ci(45, 1.8)];
    const { checks, mustFix } = checkInLevels(flaky, 46, { ...d('18'), value: '18' }, own);
    expect(mustFix).toEqual([]);
    expect(checks).toEqual([expect.objectContaining({ id: 'far-from-last', question: 'Week 45 was 1.8%. Is 18.0% right?', yes: 'Yes, 18.0% is right', no: 'Change the number', key: '18' })]);
    const answered: Answers = { 'far-from-last': '18' };
    expect(unanswered(checks, answered)).toEqual([]);
    const again = checkInLevels(flaky, 46, d('19'), own).checks;
    expect(unanswered(again, answered)).toHaveLength(1);
  });

  it('never asks a range goal whether the same number was measured again; asks a number still to move', () => {
    expect(checkInLevels(flaky, 46, d('1.8'), [ci(45, 1.8)]).checks).toEqual([]);
    expect(checkInLevels(suites, 46, d('80'), [ci(45, 80)]).checks[0]).toMatchObject({ id: 'same-as-last', question: 'The same as week 45: 80%. Did you measure it again this week?', no: 'No new number this week' });
    expect(checkInLevels(suites, 46, d('100'), [ci(45, 100)]).checks).toEqual([]);
  });

  it('makes an impossible number a Must fix, not a question', () => {
    expect(checkInLevels(suites, 46, d('lots'), [ci(45, 80)])).toMatchObject({ mustFix: [{ field: 'This week’s number' }], checks: [] });
  });

  it('says why the button does nothing', () => {
    const q = checkInLevels(flaky, 46, d('18'), [ci(45, 1.8)]).checks;
    expect(stepState([], q).says).toBe('Answer the question above first.');
    expect(stepState([{ field: 'A', says: '' }], q).says).toBe('1 thing to fix above: A.');
    expect(stepState([{ field: 'A', says: '' }, { field: 'B', says: '' }, { field: 'C', says: '' }], []).says).toBe('3 things to fix above: A, B and 1 more.');
    expect(stepState([], [])).toEqual({ go: true, says: '' });
  });

  it('posts nothing from a screen until the question is answered, then keeps the answer in History', () => {
    const last = checkInsFor(goal, fresh.checkIns).filter((c) => c.week < week && c.value != null).at(-1)!;
    const far = String(Math.round(last.value! / 4));
    const draft = { ...emptyDraft(goal, null), value: far, cause: 'slower' as const, why: 'The tracker export lost half the incidents', ptgWhat: 'Re-run the export by hand', ptgBy: week + 2 };
    expect(() => postCheckIn(x(fresh), post({ draft }))).toThrow(/right\? Answer it first\./);
    const asked = checkInLevels(goal, week, draft, checkInsFor(goal, fresh.checkIns)).checks[0]!;
    const out = postCheckIn(x(fresh), post({ draft: { ...draft, answers: { [asked.id]: asked.key } } }));
    expect(out.commit.changes[0]!.diffs).toContainEqual({ field: 'Asked', from: asked.question, to: asked.yes });
  });

  it('keeps an answer given in the table check-in in History, as the form does (build review of #160)', () => {
    const last = checkInsFor(goal, fresh.checkIns).filter((c) => c.week < week && c.value != null).at(-1)!;
    const draft = { ...emptyDraft(goal, null), value: String(Math.round(last.value! / 4)), cause: 'slower' as const, why: 'The tracker export lost half the incidents', ptgWhat: 'Re-run the export by hand', ptgBy: week + 2 };
    const asked = checkInLevels(goal, week, draft, checkInsFor(goal, fresh.checkIns)).checks[0]!;
    const table = (answers?: Answers) => planChanges({ tables: {}, posts: [post({ draft: { ...draft, answers } })], ...x(fresh), via: 'bulk' });
    expect(table().commit).toBeNull();
    const cs = table({ [asked.id]: asked.key });
    expect(cs.commit!.changes[0]!.diffs).toContainEqual({ field: 'Asked', from: asked.question, to: asked.yes });
  });

  it('writes a number in a question with the app’s formatter: 1 hour, not 1 hours (build review of #160)', () => {
    const hours = { ...goal, unit: 'hours', decimals: 0 } as Goal;
    const q = checkInLevels(hours, week, { ...emptyDraft(hours, null), value: '1' }, [{ ...checkInsFor(goal, fresh.checkIns).at(-1)!, goalId: hours.id, week: week - 1, value: 10 }]).checks[0];
    expect(q?.question).toMatch(/Is 1 hour right\?/);
  });
});
