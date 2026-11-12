/* Starting the next year only prepares it (cycle-end spec, CY2: rules 3, 4, 7 and 9), and which goals carry on,
   finish or stop (rule 5's kinds). The example is the demo's: 2026 starts on 22 Dec 2025 (week 0) with 53 weeks. */
import { describe, expect, it } from 'vitest';
import { beforeStart, beforeStartLine, currentCycle, nextCycle, nextCycleShape, periodNow } from './cycle';
import { wrapUpScope } from '../app/reads';
import { carryKind, startReadBack } from './carry';
import { NotAllowed, saveRetro, startNextCycle, type ActionContext } from './actions';
import { canUndoStart, deleteCycle, stopGoal, undoStart } from './removal';
import { applyCommit } from '../data/store';
import { startPage } from './startYear';
import { recarry, withRecarry } from './recarry';
import type { Commit } from './commit';
import { buildPlatformOrg } from '../data/platformOrg';
import type { CheckIn, Cycle, Goal, MetricGoal, Retro, Snapshot } from './types';
import type { MetricLink } from '../modules/metrics/types';
import metricsRecords from '../modules/metrics/records';
import { postCheckIn } from './changeset';
import { emptyDraft } from './checkin';
import { planAt } from './plan';

const y26: Cycle = { id: 'c26', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
const y27: Cycle = { id: 'c27', name: '2027', startDate: '2026-12-28', weeks: 52, reviewDay: 3 };
const on = (iso: string) => new Date(iso + 'T12:00:00Z');
/** The metrics module's records, as the app hands them to the rules (core/records). */
const RECORDS = [{ ...metricsRecords, module: 'metrics' }];

describe('which cycle the app is in (rule 3)', () => {
  it('stays in the old year until the new one’s week 1', () => {
    expect(currentCycle([y26], on('2026-12-21'))!.id).toBe('c26');
    expect(currentCycle([y26, y27], on('2026-12-21'))!.id).toBe('c26');
    expect(currentCycle([y26, y27], on('2027-01-03'))!.id).toBe('c26');
    expect(currentCycle([y26, y27], on('2027-01-04'))!.id).toBe('c27');
    expect(currentCycle([y26], on('2027-01-11'))!.id).toBe('c26');
    expect(currentCycle([y27], on('2026-11-11'))!.id).toBe('c27');
    expect(currentCycle([y26, { ...y27, removedAt: '2026-12-22T00:00:00Z' }], on('2027-01-11'))!.id).toBe('c26');
  });
  it('is the old year on every day up to 3 January 2027, the new from 4 January, with or without a 2027', () => {
    for (let t = Date.parse('2026-12-14T12:00:00Z'); t <= Date.parse('2027-01-17T12:00:00Z'); t += 86_400_000) {
      const d = new Date(t), day = d.toISOString().slice(0, 10);
      expect(currentCycle([y26], d)!.id).toBe('c26');
      expect(currentCycle([y26, y27], d)!.id).toBe(day >= '2027-01-04' ? 'c27' : 'c26');
    }
  });
});

describe('before a cycle’s first week (rule 4)', () => {
  it('says when it starts and when the first check-ins are due', () => {
    expect(beforeStart(y27, on('2026-12-21'))).toEqual({ firstDay: '2027-01-04', days: 14, firstDue: '2027-01-07' });
    expect(beforeStartLine(y27, on('2026-12-21'), true)).toBe('2027 starts on Mon 4 Jan 2027, in 2 weeks. Nothing is due until then. Your first check-ins are due Thu 7 Jan 2027.');
    expect(beforeStartLine(y27, on('2026-12-28'))).toBe('2027 starts on Mon 4 Jan 2027, next week. Nothing is due until then.');
    expect(beforeStartLine(y27, on('2027-01-01'))).toBe('2027 starts on Mon 4 Jan 2027, on Monday. Nothing is due until then.');
    expect(beforeStart(y27, on('2027-01-04'))).toBeNull();
  });
  it('names the next year from this one', () => {
    expect(nextCycleShape(y26)).toEqual({ startDate: '2026-12-28', weeks: 52, name: '2027' });
  });
});

/* Goals, as rule 5's table has them. */
const base = { cycleId: 'c26', teamId: 't', ownerId: 'tunde', io: 'output' as const, level: 'team' as const, guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '2025-12-01T00:00:00Z', decimals: 0 };
const num = (id: string, start: number, target: number, extra: Partial<Goal> = {}): Goal => ({ ...base, id, key: id.toUpperCase(), title: id, kind: 'metric', unit: 'pairs', plan: { start, target, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null, ...extra } as Goal);
const ci = (goalId: string, week: number, value: number | null, extra: Partial<CheckIn> = {}): CheckIn => ({ id: goalId + week, goalId, authorId: 'tunde', week, postedAt: '2026-11-11T10:00:00Z', value, stages: null, status: 'on', calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false, ...extra });
const retro = (goalId: string, next: Retro['next']): Retro => ({ id: 'r-' + goalId, goalId, cycleId: 'c26', result: 'missed', learned: 'Something worth knowing', next, byId: 'tunde', at: '2026-12-22T10:00:00Z' });
const kind = (g: Goal, cis: CheckIn[], r: Retro | null = null) => carryKind(g, { cycle: y26, checkIns: cis, retro: r }).kind;

describe('what happens to one goal (rule 5, its kinds)', () => {
  it('carries a goal that didn’t meet its target, from wherever it ended', () => {
    expect(kind(num('g37', 4, 40), [ci('g37', 53, 33)])).toBe('carry');
  });
  it('finishes one whose last number reached its target, one called done, and one with every stage done', () => {
    expect(kind(num('g124', 0, 70), [ci('g124', 46, 72)])).toBe('finish');
    expect(kind(num('g86', 0, 50), [ci('g86', 46, 26)])).toBe('carry');
    expect(kind(num('g22', 0, 95), [ci('g22', 38, 95, { status: 'done' })])).toBe('finish');
    const stages: Goal = { ...base, id: 'g20', key: 'G-20', title: 'g20', kind: 'milestone', unit: '', stages: [{ id: 'a', name: 'A', dueWeek: 10 }, { id: 'b', name: 'B', dueWeek: 20 }] } as unknown as Goal;
    expect(kind(stages, [ci('g20', 30, null, { stages: [{ stageId: 'a', doneWeek: 9 }, { stageId: 'b', doneWeek: 19 }] as never })])).toBe('finish');
    expect(kind(stages, [ci('g20', 30, null, { stages: [{ stageId: 'a', doneWeek: 9 }] as never })])).toBe('carry');
  });
  it('keeps a plan that runs past the year, and never finishes a limit', () => {
    expect(kind(num('g125', 0, 60, { plan: { start: 0, target: 60, shape: 'straight', fromWeek: 45, endWeek: 66 } } as never), [])).toBe('keep');
    const range = { ...base, id: 'g11', key: 'G-11', title: 'g11', kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 2, margin: 0.2 } } as unknown as Goal;
    expect(kind(range, [ci('g11', 53, 1.8)])).toBe('carry');
    expect(kind(range, [ci('g11', 53, 1.8)], retro('g11', 'stop'))).toBe('stop');
  });
  it('stops a goal its owner stopped, unless it finished anyway', () => {
    expect(kind(num('g37', 4, 40), [ci('g37', 53, 33)], retro('g37', 'stop'))).toBe('stop');
    expect(kind(num('g22', 0, 95), [ci('g22', 38, 95, { status: 'done' })], retro('g22', 'carry'))).toBe('finish');
  });
});

describe('the read-back and the start (rules 6 and 7)', () => {
  const s = buildPlatformOrg(on('2026-11-05'));
  const cycle = s.cycles[0]!;
  const live = s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt);
  const someRetros: Retro[] = live.slice(0, 7).map((g, i) => ({ id: 'r' + i, goalId: g.id, cycleId: cycle.id, result: 'partly', learned: 'Worth knowing next time', next: i === 0 ? 'stop' : 'carry', byId: g.ownerId, at: '2026-12-21T10:00:00Z' }));
  const rb = startReadBack({ cycle, next: { name: '2027', firstDay: '2027-01-04', weeks: 52 }, goals: live, checkIns: s.checkIns, retros: someRetros });

  it('counts every goal once: the four add up to the year’s live goals', () => {
    expect(rb.carry + rb.finish + rb.stop + rb.open).toBe(live.length);
    expect(rb.openCarry + rb.openFinish).toBe(rb.open);
    expect(rb.stop).toBe(1);
    expect(rb.finish + rb.openFinish).toBeGreaterThan(0); // the done goals finish, not carry
  });
  it('makes exactly what it read back', () => {
    const made = nextCycle(cycle, live, s.checkIns, someRetros, { cycle: 'c2', goal: (g) => g.id + '-2' }, '2026-12-21T10:00:00Z');
    expect(made.goals.length).toBe(rb.carried);
    const done = live.filter((g) => s.checkIns.some((c) => c.goalId === g.id && c.status === 'done'));
    for (const g of done) expect(made.goals.some((x) => x.key === g.key)).toBe(false);
  });
});

describe('starting and undoing (rules 6 and 9)', () => {
  const s0 = buildPlatformOrg(on('2026-11-05'));
  const cycle = s0.cycles[0]!;
  const amara = s0.people.find((p) => p.id === 'amara')!;
  const rhea = s0.people.find((p) => p.id === 'rhea')!;
  let k = 0;
  const ctx = (full: Snapshot, when: string, who = amara): ActionContext => ({ snapshot: { ...full, goals: full.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt) }, cycle, week: 52, actor: who, now: when + 'T10:00:00Z', newId: (p) => `${p}_t${++k}`, full, records: RECORDS });
  const says = (f: () => unknown) => { try { f(); return 'done'; } catch (e) { return e instanceof NotAllowed ? e.message : String(e); } };

  it('can’t be started before the wrap-up opens, or by a member', () => {
    expect(says(() => startNextCycle(ctx(s0, '2026-12-20')))).toBe('2027 can be started from Mon 21 Dec 2026, when 2026’s wrap-up opens.');
    expect(says(() => startNextCycle(ctx(s0, '2026-12-21', rhea)))).toBe('Only admins can start the next cycle.');
  });
  it('can still be started once the wrap-up has closed; the wrap-up itself can’t be saved then', () => {
    expect(says(() => startNextCycle(ctx(s0, '2027-02-05')))).toBe('done');
    const g = s0.goals.find((x) => x.cycleId === cycle.id && x.ownerId === 'rhea')!;
    expect(says(() => saveRetro(ctx(s0, '2027-02-05', rhea), g, { result: 'missed', learned: 'Something worth knowing', next: 'carry' }))).toBe('2026’s wrap-up closed on Sun 31 Jan 2027.');
    expect(says(() => saveRetro(ctx(s0, '2026-12-20', rhea), g, { result: 'missed', learned: 'Something worth knowing', next: 'carry' }))).toBe('2026’s wrap-up opens on Mon 21 Dec 2026.');
    expect(says(() => saveRetro(ctx(s0, '2027-01-11', rhea), g, { result: 'missed', learned: 'Something worth knowing', next: 'carry' }))).toBe('done');
  });
  it('prepares 2027 on 21 December; everyone stays in 2026; a second start is refused', () => {
    const out = startNextCycle(ctx(s0, '2026-12-21'));
    const s1 = applyCommit(s0, out.commit);
    expect(out.name).toBe('2027');
    expect(currentCycle(s1.cycles, on('2026-12-21'))!.id).toBe(cycle.id);
    expect(currentCycle(s1.cycles, on('2027-01-04'))!.name).toBe('2027');
    expect(says(() => startNextCycle(ctx(s1, '2026-12-22')))).toBe('2027 has already been started, by Amara Nwosu on Mon 21 Dec 2026.');
    expect(out.commit.changes![0]!.summary).toMatch(/^Started 2027: \d+ goals carry on, \d+ finish$/);
  });
  it('can be undone until someone uses it, and puts 2026 back as it was', () => {
    const out = startNextCycle(ctx(s0, '2026-12-21'));
    const s1 = applyCommit(s0, out.commit);
    const id = out.commit.cycles![0]!.id;
    expect(canUndoStart(s1, id)).toEqual({ ok: true });
    expect(says(() => deleteCycle(ctx(s1, '2026-12-21'), id))).toBe('Use Undo on Cycles: it also puts back what moved with the goals.');
    expect(says(() => undoStart(ctx(s1, '2026-12-21', rhea), id))).toBe('Only admins can undo the start of a cycle.');
    const s2 = applyCommit(s1, undoStart(ctx(s1, '2026-12-22'), id));
    expect(currentCycle(s2.cycles, on('2027-01-04'))!.id).toBe(cycle.id);
    expect(s2.changes.at(-1)!.summary).toBe('Undid the start of 2027');
    // Started again: a new 2027.
    const again = startNextCycle(ctx(s2, '2026-12-23'));
    expect(again.commit.cycles![0]!.id).not.toBe(id);
  });
  it('can’t be undone once someone checks in or changes a goal in it', () => {
    const out = startNextCycle(ctx(s0, '2026-12-21'));
    const s1 = applyCommit(s0, out.commit);
    const id = out.commit.cycles![0]!.id;
    const copy = out.commit.goals![0]!;
    const withCheckIn = { ...s1, checkIns: [...s1.checkIns, ci(copy.id, 1, 35)] };
    expect(canUndoStart(withCheckIn, id)).toEqual({ ok: false, why: '1 check-in is in it' });
    const changed = { ...s1, changes: [...s1.changes, { id: 'x', at: '2026-12-22T10:00:00Z', actorId: 'tunde', goalId: copy.id, entity: 'goal' as const, entityId: copy.id, action: 'edited' as const, summary: 'Changed the plan', diffs: [] }] };
    expect(canUndoStart(changed, id)).toEqual({ ok: false, why: '1 goal in it has been changed' });
  });
});

describe('last year’s wrap-up once the next year is current (rule 3; build review of #133, high)', () => {
  const s0 = buildPlatformOrg(on('2026-11-05'));
  const y26 = s0.cycles[0]!;
  const amara = s0.people.find((p) => p.id === 'amara')!;
  let k = 0;
  const ctx = (full: Snapshot, cycle: Cycle, when: string): ActionContext => ({ snapshot: { ...full, goals: full.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt) }, cycle, week: 1, actor: amara, now: when + 'T10:00:00Z', newId: (p) => `${p}_w${++k}`, full });
  const s1 = applyCommit(s0, startNextCycle({ ...ctx(s0, y26, '2026-12-22'), week: 52 }).commit);
  const y27 = s1.cycles.find((c) => c.id !== y26.id)!;
  const old = s1.goals.find((g) => g.cycleId === y26.id && !g.removedAt && !g.stoppedAt && !(s1.retros ?? []).some((r) => r.goalId === g.id))!;

  it('on 11 Jan 2027, with 2027 current, the page is 2026’s and a 2026 goal’s wrap-up saves, in 2026', () => {
    expect(currentCycle(s1.cycles, on('2027-01-11'))!.id).toBe(y27.id);
    const scope = wrapUpScope(s1, y27, ctx(s1, y27, '2027-01-11').snapshot, 1, on('2027-01-11'));
    expect(scope.cycle.id).toBe(y26.id);
    expect(scope.earlier).toBe(true);
    expect(scope.snapshot.goals.some((g) => g.id === old.id)).toBe(true);
    const c = saveRetro(ctx(s1, y27, '2027-01-11'), old, { result: 'partly', learned: 'Moved more slowly than planned', next: 'carry' });
    expect(c.retros![0]!.cycleId).toBe(y26.id);
  });

  it('after 2026’s wrap-up closes, the page is 2027’s and a 2026 wrap-up is refused', () => {
    expect(wrapUpScope(s1, y27, s1, 5, on('2027-02-05')).cycle.id).toBe(y27.id);
    expect(() => saveRetro(ctx(s1, y27, '2027-02-05'), old, { result: 'partly', learned: 'Moved more slowly than planned', next: 'carry' })).toThrow('2026’s wrap-up closed on Sun 31 Jan 2027.');
  });

  it('before a year’s first week, the period says when it starts, never week 0', () => {
    expect(periodNow(y27, on('2026-12-29'))).toBe('2027 starts Mon 4 Jan 2027');
  });
});

describe('the start page (2.4)', () => {
  const s = buildPlatformOrg(on('2026-11-05'));
  const cycle = s.cycles[0]!;
  it('says when it can be started before the wrap-up opens, and nothing else', () => {
    const p = startPage(s, cycle, on('2026-11-11'));
    expect(p.canStart).toBe(false);
    expect(p.whyNot).toBe('2027 can be started from Mon 21 Dec 2026, when 2026’s wrap-up opens.');
    expect(p.counts).toEqual([]);
  });
  it('reads back four counts and what 2027 starts with', () => {
    const p = startPage(s, cycle, on('2026-12-21'));
    expect(p.line).toBe('2027 runs from Mon 4 Jan 2027 to Sun 2 Jan 2028: 52 weeks. Everyone stays in 2026 until Sun 3 Jan 2027, so the last check-ins and the wrap-up carry on.');
    expect(p.counts.map((c) => c.says)).toEqual(['carry on', 'finish', 'stop', 'not wrapped up yet']);
    expect(p.counts.reduce((n, c) => n + c.n, 0)).toBe(p.readBack!.total);
    expect(p.startsWith.at(-1)!.bold).toBe('Check-ins every week, due by Thursday');
    expect(startPage(s, cycle, on('2027-01-11')).line).toMatch(/It opens for everyone as soon as you start it\. 2026’s wrap-up stays open until Sun 31 Jan 2027\.$/);
  });
});

describe('the carry rule (rule 5: the copy) and what comes with a goal (rule 6)', () => {
  const s0 = buildPlatformOrg(on('2026-11-05'));
  const cycle = s0.cycles[0]!;
  const amara = s0.people.find((p) => p.id === 'amara')!;
  let k = 0;
  const ctx = (full: Snapshot, when: string): ActionContext => ({ snapshot: { ...full, goals: full.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt), checkIns: full.checkIns.filter((c) => !c.removedAt) }, cycle, week: 52, actor: amara, now: when + 'T10:00:00Z', newId: (p) => `${p}_c${++k}`, full, records: RECORDS });

  it('starts a number goal from its final number in week 1, due at the end of the new year; spreads stages over it; keeps a long plan', () => {
    const made = nextCycle(y26, [num('g126', 0.42, 0.3, { plan: { start: 0.42, target: 0.3, shape: 'straight', fromWeek: 45, points: [{ week: 50, value: 0.35 }] } } as never)], [ci('g126', 53, 0.37 as never)], [], { cycle: 'c27', goal: (g) => g.id + '-2' }, '2026-12-21T10:00:00Z');
    expect((made.goals[0] as never as { plan: unknown }).plan).toEqual({ start: 0.37, target: 0.3, shape: 'straight', fromWeek: 0 });
    const stages: Goal = { ...base, id: 'g7', key: 'G-7', title: 'g7', kind: 'milestone', unit: '', stages: [{ id: 'a', name: 'A', dueWeek: 10 }, { id: 'b', name: 'B', dueWeek: 40 }, { id: 'c', name: 'C', dueWeek: 50 }] } as unknown as Goal;
    const m = nextCycle(y26, [stages], [ci('g7', 30, null, { stages: [{ stageId: 'a', doneWeek: 9 }] as never })], [], { cycle: 'c27', goal: (g) => g.id + '-2' }, '2026-12-21T10:00:00Z');
    expect((m.goals[0] as never as { stages: { dueWeek: number }[] }).stages.map((x) => x.dueWeek)).toEqual([26, 52]);
    const long = nextCycle(y26, [num('g125', 0, 60, { plan: { start: 0, target: 60, shape: 'straight', fromWeek: 45, endWeek: 66 } } as never)], [], [], { cycle: 'c27', goal: (g) => g.id + '-2' }, '2026-12-21T10:00:00Z');
    expect((long.goals[0] as never as { plan: { fromWeek: number; endWeek: number } }).plan).toMatchObject({ fromWeek: -8, endWeek: 13 });
  });

  it('never makes a plan that turns round, starts late, or has a stage after the year’s end, in the whole example', () => {
    const live = s0.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt && !g.stoppedAt);
    const made = nextCycle(cycle, live, s0.checkIns, [], { cycle: 'c2', goal: (g) => g.id + '-2' }, '2026-12-21T10:00:00Z');
    for (const g of made.goals) {
      const from = live.find((x) => x.key === g.key)!;
      if (g.kind === 'metric' && from.kind === 'metric' && (from.plan.endWeek ?? 0) <= cycle.weeks) {
        expect(Math.sign(g.plan.target - g.plan.start)).toBe(Math.sign(from.plan.target - from.plan.start));
        expect(g.plan.start).not.toBe(g.plan.target);
        expect(g.plan.fromWeek ?? 0).toBe(0);
      }
      if (g.kind === 'milestone') for (const st of g.stages) expect(st.dueWeek).toBeLessThanOrEqual(made.cycle.weeks);
    }
  });

  it('brings metric links, watches, open asks and reviews, and Undo puts every one back', () => {
    const out = startNextCycle(ctx(s0, '2026-12-21'));
    const c = out.commit;
    const s1 = applyCommit(s0, c);
    const copies = new Set(c.goals!.map((g) => g.id));
    expect(c.watches!.length).toBeGreaterThan(0);
    expect(c.watches!.every((w) => copies.has(w.ref))).toBe(true);
    expect(c.requests!.every((r) => r.status === 'open' && r.goalIds.some((id) => copies.has(id)))).toBe(true);
    const links = (c.modules?.metrics?.metricLinks ?? []) as MetricLink[];
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => copies.has(l.goalId))).toBe(true);
    expect(canUndoStart(s1, c.cycles![0]!.id)).toEqual({ ok: true });
    const s2 = applyCommit(s1, undoStart(ctx(s1, '2026-12-22'), c.cycles![0]!.id));
    const liveWatches = (s: Snapshot) => (s.watches ?? []).filter((w) => !w.removedAt).length;
    const liveLinks = (s: Snapshot) => ((s.modules?.metrics?.metricLinks ?? []) as MetricLink[]).filter((l) => !l.removedAt).length;
    expect(liveWatches(s2)).toBe(liveWatches(s0));
    expect(liveLinks(s2)).toBe(liveLinks(s0));
    for (const r of s0.requests ?? []) expect(s2.requests!.find((x) => x.id === r.id)!.goalIds).toEqual(r.goalIds);
    for (const r of s0.reviews ?? []) expect(s2.reviews!.find((x) => x.id === r.id)!.scope).toEqual(r.scope);
  });

  it('keeps an untouched copy true: a later final number moves its start; a wrap-up “stop” takes it out', () => {
    const out = startNextCycle(ctx(s0, '2026-12-21'));
    const s1 = applyCommit(s0, out.commit);
    const old = s1.goals.find((g) => g.cycleId === cycle.id && g.kind === 'metric' && s1.goals.some((x) => x.cycleId !== cycle.id && x.key === g.key) && (g.plan.endWeek ?? 0) <= cycle.weeks)!;
    const copyOf = (s: Snapshot) => s.goals.find((g) => g.cycleId !== cycle.id && g.key === old.key && !g.removedAt);
    const final = ci(old.id, 53, 35, { postedAt: '2026-12-29T10:00:00Z' });
    const re = recarry(old, s1, { checkIns: [final] }, { now: '2026-12-29T10:00:00Z', actorId: old.ownerId, newId: (p) => p + '_r' });
    const s2 = applyCommit(s1, { checkIns: [final], ...re!, changes: re!.changes });
    expect((copyOf(s2) as never as { plan: { start: number } }).plan.start).toBe(35);
    const stop: Retro = { id: 'r-stop', goalId: old.id, cycleId: cycle.id, result: 'missed', learned: 'Not worth another year', next: 'stop', byId: old.ownerId, at: '2026-12-30T10:00:00Z' };
    const gone = recarry(old, s2, { retro: stop }, { now: '2026-12-30T10:00:00Z', actorId: old.ownerId, newId: (p) => p + '_s' });
    const s3 = applyCommit(s2, gone!);
    expect(copyOf(s3)).toBeUndefined();
    // Once the copy has a check-in of its own, nothing changes it.
    const used = { ...s2, checkIns: [...s2.checkIns, ci(copyOf(s2)!.id, 1, 36)] };
    expect(recarry(old, used, { retro: stop }, { now: '2027-01-12T10:00:00Z', actorId: old.ownerId, newId: (p) => p })).toBeNull();
  });

  // Every save runs recarry (withRecarry), as the app and the MCP server do.
  const save = (s: Snapshot, c: Commit, when: string) => applyCommit(s, withRecarry(s, c, { now: when + 'T10:00:00Z', actorId: amara.id, newId: (p) => `${p}_r${++k}`, records: RECORDS }));
  const later = (s: Snapshot) => s.cycles.find((c) => c.id !== cycle.id && !c.removedAt)!;
  const copiesOf = (s: Snapshot, g: Goal) => s.goals.filter((x) => x.cycleId === later(s).id && x.key === g.key);
  const live = (s: Snapshot, g: Goal) => copiesOf(s, g).filter((x) => !x.removedAt);
  const wrap = (s: Snapshot, g: Goal, next: Retro['next'], when: string) => saveRetro({ ...ctx(s, when), week: 53 }, g, { result: 'partly', learned: 'Moved more slowly than planned', next });
  const started = () => applyCommit(s0, startNextCycle(ctx(s0, '2026-12-21')).commit);

  it('keeps the copy true for a check-in from the change engine too: the check-in screens, the tables and a spreadsheet', () => {
    const s1 = started();
    const old = s1.goals.find((g) => g.cycleId === cycle.id && g.kind === 'metric' && s1.goals.some((x) => x.cycleId !== cycle.id && x.key === g.key) && (g.plan.endWeek ?? 0) <= cycle.weeks) as MetricGoal;
    const value = Math.round(planAt(old.plan, 53, cycle.weeks));
    const out = postCheckIn({ ...ctx(s1, '2026-12-29'), week: 53 }, { goalId: old.id, week: 53, draft: { ...emptyDraft(old, null), value: String(value) }, mode: 'new' });
    const s2 = save(s1, out.commit, '2026-12-29');
    // A final number on plan meets the target, so the goal now finishes and its untouched copy leaves 2027.
    expect(live(s2, old)).toHaveLength(0);
    expect(s2.changes.some((c) => /finishes in 2026, so it left 2027/.test(c.summary))).toBe(true);
  });

  it('stop, then carry it on, brings the same copy back; stopping again takes it out; never two (build review of #152, high 1)', () => {
    const s1 = started();
    const old = s1.goals.find((g) => g.cycleId === cycle.id && live(s1, g).length === 1 && !g.parentId)!;
    const first = live(s1, old)[0]!;
    const s2 = save(s1, wrap(s1, old, 'stop', '2026-12-29'), '2026-12-29');
    expect(live(s2, old)).toHaveLength(0);
    const s3 = save(s2, wrap(s2, old, 'carry', '2026-12-30'), '2026-12-30');
    expect(live(s3, old).map((g) => g.id)).toEqual([first.id]);
    expect(copiesOf(s3, old)).toHaveLength(1);
    const s4 = save(s3, wrap(s3, old, 'stop', '2026-12-31'), '2026-12-31');
    expect(live(s4, old)).toHaveLength(0);
    // Nobody used 2027, so Undo is still offered (medium 5).
    expect(canUndoStart(s3, later(s3).id)).toEqual({ ok: true });
  });

  it('a parent copy that leaves takes its children’s copies’ parent and effect; brought back, they’re under it again (high 2)', () => {
    const s1 = started();
    const parent = s1.goals.find((g) => g.cycleId === cycle.id && live(s1, g).length === 1 && s1.goals.some((c) => c.cycleId === cycle.id && c.parentId === g.id && live(s1, c).length === 1))!;
    const copy = live(s1, parent)[0]!;
    const kids = s1.goals.filter((c) => c.cycleId === later(s1).id && c.parentId === copy.id);
    expect(kids.length).toBeGreaterThan(0);
    const s2 = save(s1, wrap(s1, parent, 'stop', '2026-12-29'), '2026-12-29');
    for (const k of kids) { const now = s2.goals.find((g) => g.id === k.id)!; expect(now.parentId).toBeNull(); expect(now.effect ?? null).toBeNull(); }
    const s3 = save(s2, wrap(s2, parent, 'carry', '2026-12-30'), '2026-12-30');
    for (const k of kids) expect(s3.goals.find((g) => g.id === k.id)!.parentId).toBe(copy.id);
  });

  it('stopping a goal in the old year takes its copy out; a stored copy written in another order is the same copy (high 3, medium 4)', () => {
    const s1 = started();
    const old = s1.goals.find((g) => g.cycleId === cycle.id && live(s1, g).length === 1 && !g.parentId && g.kind === 'metric')!;
    const s2 = save(s1, stopGoal(ctx(s1, '2026-12-29'), old.id, 'Not worth another year'), '2026-12-29');
    expect(live(s2, old)).toHaveLength(0);
    // As a database store reads it back: fields in another order, and no fromWeek when it is 0.
    const copy = live(s1, old)[0]! as MetricGoal;
    const { fromWeek: _f, ...plan } = copy.plan;
    const reread = Object.fromEntries(Object.entries({ ...copy, plan }).reverse()) as unknown as Goal;
    const s3 = { ...s1, goals: s1.goals.map((g) => (g.id === copy.id ? reread : g)) };
    expect(recarry(old, s3, {}, { now: '2026-12-29T10:00:00Z', actorId: amara.id, newId: (p) => p, records: RECORDS })).toBeNull();
  });
});
