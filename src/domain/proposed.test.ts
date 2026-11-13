// @vitest-environment node
/* Proposed goals (goal entry GE10, rule 14): every worked example, and N29: a proposed goal is judged nowhere. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit } from '../data/store';
import { homeFacts, goalRows, scopeFacts } from '../app/reads';
import { loadEngine, loadGoalEntry, perform, type RunContext } from '../app/actions';
import { attentionList } from './attention';
import { carryCopy, carryKind } from './carry';
import { planChanges } from './changeset';
import { currentCycle, scopeToCycle } from './cycle';
import { countLine } from './find';
import { blankGoal, draftFor, type GoalDraft } from './goal';
import { TYPE_FIXED } from './goalEntry';
import { mayChangeGoal } from './goalRights';
import { scopesFor } from './goalsPage';
import { currentWeek } from './plan';
import { onTimeStreak, weekProgress } from './progress';
import { activate, backToProposed, mayActivate, NOTHING_TO_CHECK_IN, proposalAsks, readyToActivate } from './proposedActions';
import { isProposed, judged } from './proposed';
import { goalCounts, measureUnsaid, withProposedCount } from './proposedSummary';
import { activeReadBack, readBack, underWay } from './readBack';
import { markPersonLeft, undoRemoval } from './removal';
import { agendaOf, reviewSession } from './review';
import { workbook } from './export';
import { proposedSummary } from './proposedSummary';
import { readTables, type NamedGrid } from './sheets';
import type { Goal, Snapshot } from './types';
import type { Commit } from './commit';

const DAY = (d: string) => new Date(d + 'T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_pr${++n}`;

function at(day: string, full = buildPlatformOrg(DAY('2026-11-11'))) {
  const today = DAY(day);
  const cycle = currentCycle(full.cycles, today)!;
  return { full, cycle, today, week: currentWeek(cycle, today) };
}
function x(who: string, w: ReturnType<typeof at>): RunContext {
  const snapshot = scopeToCycle(w.full, w.cycle);
  return { snapshot, cycle: w.cycle, week: w.week, actor: w.full.people.find((p) => p.id === who)!, now: w.today.toISOString(), newId, allGoals: w.full.goals, full: w.full, workspace: { id: 'ws', name: 'Platform' }, modules: [] };
}
const signed = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal('build', 'tunde', ''), title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90', fromWeek: '46', ...o });
/** Tunde proposes "Signed artifacts in staging" on Wednesday 11 Nov: the workspace with it saved. */
function proposed(w = at('2026-11-11')) {
  const out = perform(x('tunde', w), 'saveGoal', { draft: signed(), state: 'proposed' }) as { commit: Commit; goal: Goal };
  return { w: { ...w, full: applyCommit(w.full, out.commit) }, goal: out.goal };
}

beforeAll(async () => { await loadGoalEntry(); await loadEngine(); });

describe('rule 14: proposed goals', () => {
  it('Tunde proposes “Signed artifacts in staging”: saved with a key, proposed, listed apart, never judged', () => {
    const { w, goal } = proposed();
    expect(goal.key).toBe('G-127');
    expect(isProposed(goal)).toBe(true);
    expect(goal.proposedBy).toBe('tunde');
    const s = scopeToCycle(w.full, w.cycle);
    expect(s.goals.some((g) => g.id === goal.id)).toBe(false);
    expect(s.proposed!.map((g) => g.id)).toEqual([goal.id]);
    expect(judged([goal])).toEqual([]);
  });

  it('Goals, Mine, as Tunde: the count line says the proposed goal apart', () => {
    const { w } = proposed();
    const s = scopeToCycle(w.full, w.cycle);
    const mine = scopesFor(scopeFacts(s, s.people.find((p) => p.id === 'tunde')!), 'mine').tabs.find((t) => t.id === 'mine')!;
    const c = goalCounts(w.full.goals.filter((g) => g.ownerId === 'tunde' && g.cycleId === w.cycle.id));
    expect(c).toEqual({ active: mine.ids.length, proposed: 1 });
    expect(withProposedCount(countLine({ thing: 'goal', things: 'goals' }, c.active, false, 'worst first'), c.proposed)).toBe('2 goals, worst first. 1 proposed');
  });

  it('a fortnight later it still says Proposed, and a check-in on it is refused in the check-in’s words', () => {
    const { w, goal } = proposed();
    const later = at('2026-11-25', w.full);
    const row = proposedSummary(goal, scopeToCycle(later.full, later.cycle), later.cycle, later.week);
    expect([row.state, row.statusLabel]).toEqual(['proposed', 'Proposed']);
    expect(() => perform(x('tunde', later), 'postCheckIn', { goalId: goal.id, draft: { value: '50' } as never, mode: 'new' as never })).toThrow(NOTHING_TO_CHECK_IN);
  });

  it('Rhea proposes a goal for Camille with only a name: nothing measured yet; Camille’s Home asks; she may make it active, Rhea may change it, Oskar neither', () => {
    const w = at('2026-11-11');
    const out = perform(x('rhea', w), 'saveGoal', { draft: { ...blankGoal('portal', 'camille', ''), title: 'Data-backed environments ready in under an hour' }, state: 'proposed' }) as { goal: Goal };
    const g = out.goal;
    expect(measureUnsaid(g)).toBe(true);
    const asks = proposalAsks([g], { id: 'camille', admin: false }, w.today, { opened: new Set(), putOff: new Map() }, (id) => (id === 'rhea' ? 'Rhea Kapoor' : id));
    expect(asks.map((a) => a.says)).toEqual(['Rhea proposed a goal for you: “Data-backed environments ready in under an hour”.']);
    expect(readyToActivate(g, { cycleWeeks: w.cycle.weeks, week: w.week, startDate: w.cycle.startDate }).map((f) => f.id)).toEqual(['stage-none']);
    const rhea = { id: 'rhea', admin: false }, camille = { id: 'camille', admin: false }, oskar = { id: 'oskar', admin: false };
    expect([mayActivate(camille, g), mayActivate(rhea, g), mayActivate(oskar, g)]).toEqual([true, false, false]);
    expect([mayChangeGoal(camille, g), mayChangeGoal(rhea, g), mayChangeGoal(oskar, g)]).toEqual([true, true, false]);
  });

  it('Proposed, its type can still change: Tunde turns G-132 into stages; an active goal’s type is refused', () => {
    const { w, goal } = proposed();
    const stages = { ...draftFor(goal), kind: 'milestone' as const, stages: [{ id: 's1', name: 'Signing in CI', dueWeek: '50' }] };
    const out = perform(x('tunde', w), 'saveGoal', { draft: stages, goalId: goal.id }) as { goal: Goal };
    expect([out.goal.kind, isProposed(out.goal)]).toEqual(['milestone', true]);
    const lead = w.full.goals.find((g) => g.id === 'ns-lead')!;
    expect(() => perform(x('rhea', w), 'saveGoal', { draft: { ...draftFor(lead), kind: 'range', limit: '3' }, goalId: lead.id })).toThrow(TYPE_FIXED);
  });

  it('Tunde makes it active in week 48: From becomes 48, read back with its dates; Undo makes it proposed again', () => {
    const { w, goal } = proposed();
    const wk48 = at('2026-11-25', w.full);
    expect(wk48.week).toBe(48);
    const says = activeReadBack(goal, { cycle: wk48.cycle, week: wk48.week, today: wk48.today, rhythm: 'weekly', fromWeek: 48 });
    expect(says).toBe('From 40% in week 48 (23–29 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027): 5 weeks, not the 7 you proposed. Its first check-in is due by Thursday 26 Nov, then every week.');
    const out = activate(x('tunde', wk48), { goalId: goal.id });
    expect(out.goal.kind === 'metric' && out.goal.plan.fromWeek).toBe(48);
    expect(isProposed(out.goal)).toBe(false);
    expect(out.commit.changes[0]!.summary).toBe('Made it active, from week 48');
    const after = applyCommit(wk48.full, out.commit);
    expect(scopeToCycle(after, wk48.cycle).goals.some((g) => g.id === goal.id)).toBe(true);
    const undo = undoRemoval(x('tunde', { ...wk48, full: after }), out.commit, wk48.full);
    expect(undo.goals![0]!.proposedAt).toBe(goal.proposedAt);
    expect(() => activate(x('oskar', wk48), { goalId: goal.id })).toThrow('Tunde Bakare or an admin can make this active.');
  });

  it('GE10 review: From before this week is asked at every door; a From outside the plan is refused', () => {
    const { w, goal } = proposed();
    const wk48 = at('2026-11-25', w.full);
    expect(() => activate(x('tunde', wk48), { goalId: goal.id, fromWeek: 44 })).toThrow(/Check with the person first: .*Has this been running since then\?/);
    expect(activate(x('tunde', wk48), { goalId: goal.id, fromWeek: 44, confirm: true }).commit.changes[0]!.summary).toBe('Made it active, from week 44');
    for (const bad of [53, -3, 1.5]) expect(() => activate(x('tunde', wk48), { goalId: goal.id, fromWeek: bad, confirm: true })).toThrow('From must be a week of this cycle before the plan’s To: week 0 to week 52.');
  });

  it('GE10 review: a stages goal proposed with a stage already done saves no check-in', () => {
    const w = at('2026-11-11');
    const draft = signed({ kind: 'milestone', unit: '', start: '', target: '', fromWeek: '', stages: [{ id: 's1', name: 'Pilot', dueWeek: '44', done: 'yes' }, { id: 's2', name: 'Rollout', dueWeek: '50' }] });
    const out = perform(x('tunde', w), 'saveGoal', { draft, state: 'proposed' }) as { commit: Commit; goal: Goal };
    expect(isProposed(out.goal)).toBe(true);
    expect(out.commit.checkIns ?? []).toEqual([]);
  });

  it('GE10 review: marking an owner as left hands over their proposed goals too', () => {
    const { w, goal } = proposed();
    const admin = w.full.people.find((p) => p.admin && p.id !== 'tunde')!;
    const c = markPersonLeft(x(admin.id, w), 'tunde', { goalsTo: 'rhea', asksTo: 'rhea' });
    expect(c.goals!.find((g) => g.id === goal.id)?.ownerId).toBe('rhea');
  });

  it('a goal with a check-in can’t go back to proposed, by the menu or by a file', () => {
    const w = at('2026-11-11');
    const s = scopeToCycle(w.full, w.cycle);
    const g = s.goals.find((v) => v.ownerId === 'tunde' && s.checkIns.some((c) => c.goalId === v.id))!;
    expect(() => backToProposed(x('tunde', w), { goalId: g.id })).toThrow('It has check-ins, so it can’t go back to proposed. Stop it instead.');
    const cs = planChanges({ tables: { goals: [{ __row: '2', key: g.key!, state: 'proposed' }] }, snapshot: s, cycle: w.cycle, week: w.week, actor: s.people.find((p) => p.id === 'tunde')!, now: w.today.toISOString(), newId, via: 'spreadsheet', full: w.full });
    expect(cs.issues.filter((i) => i.level === 'must').map((i) => i.message)).toEqual([`“${g.title}” has check-ins, so it can’t go back to proposed. Stop it instead.`]);
  });

  it('build review of #349: a goal from another year can’t go back to proposed; an ask on a goal sent back to proposed stays on Home', () => {
    const w = at('2026-11-11');
    const s = scopeToCycle(w.full, w.cycle);
    const mine = s.goals.find((v) => v.ownerId === 'tunde')!;
    const old = { ...mine, id: 'g-old', key: 'G-900', cycleId: 'last-year' };
    const full = { ...w.full, goals: [...w.full.goals, old] };
    expect(() => backToProposed(x('tunde', { ...w, full }), { goalId: 'g-old' })).toThrow('is in another year, so it can’t go back to proposed.');
    // An ask for Tunde on one of his goals, then that goal proposed: Home still lists the ask, on that goal.
    const ask = s.requests!.find((r) => r.status === 'open' && !!r.recipientId && s.goals.some((v) => v.id === r.goalIds[0]))!;
    const who = ask.recipientId!;
    const sent = { ...w.full, goals: w.full.goals.map((v) => (v.id === ask.goalIds[0] ? { ...v, proposedAt: w.today.toISOString(), proposedBy: v.ownerId } : v)) };
    const sc = scopeToCycle(sent, w.cycle);
    expect(sc.goals.some((v) => v.id === ask.goalIds[0])).toBe(false);
    expect(homeFacts(who, sc, w.cycle, w.week, w.today, { workspace: 'P', draft: false }).asks.some((a) => a.askId === ask.id)).toBe(true);
  });

  it('a goal proposed 9 weeks ago asks its owner on Home', () => {
    const { goal } = proposed();
    const asks = proposalAsks([goal], { id: 'tunde', admin: false }, DAY('2027-01-15'), { opened: new Set(), putOff: new Map() });
    expect(asks.map((a) => a.says)).toEqual(['“Signed artifacts in staging” has been proposed for 9 weeks. Make it active, or withdraw it.']);
  });

  it('it carries into the next year as proposed', () => {
    const { goal } = proposed();
    expect(carryKind(goal, { cycle: { weeks: 53 } as never, checkIns: [], retro: null }).kind).toBe('carry');
    expect(carryCopy(goal, { old: { weeks: 53 }, next: { id: 'n', weeks: 52 }, checkIns: [], id: 'g2', parentId: null, now: '' }).proposedAt).toBe(goal.proposedAt);
  });

  it('New goal’s last step: the question and “After you propose it”', () => {
    expect(underWay({ owner: { name: 'Tunde Bakare', isViewer: true }, rhythm: 'weekly', week: 46, from: 46 })).toEqual({
      active: { label: 'Yes: publish it as active', line: 'It is judged against its plan from this week, and check-ins are due.' },
      proposed: { label: 'Not yet: propose it', line: 'Everyone can see it and comment. Nothing is due and it has no status until you or an admin make it active.' },
    });
    const w = at('2026-11-11');
    const rb = readBack({ ...signed(), start: '', target: '' }, { cycle: w.cycle, week: 46, today: w.today, level: 'team', owner: { name: 'Amara Nwosu', isViewer: false }, teamName: 'Build & Release', parent: null, alsoHelps: [], metric: null, answers: [], rhythm: 'weekly', reviewsOn: true, reviewsJoined: [], wsName: 'Platform', state: 'proposed' });
    expect(rb.rows[0]!.text).toBe('How it’s measured isn’t said yet.');
    expect(rb.after).toEqual([
      'It is listed as Proposed, apart from the goals that are under way: it is in no count, no review’s agenda and nobody’s check-ins.',
      'Its plan is kept as you typed it. When it is made active, the plan starts from that week unless they say otherwise.',
      'Amara sees it on their Home as a proposal for them. Faro doesn’t send email.',
    ]);
  });

  it('an export with a proposed goal writes State, and loads back as no change', () => {
    const { w, goal } = proposed();
    const s = scopeToCycle(w.full, w.cycle);
    const book = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle: w.cycle, week: w.week, today: w.today });
    const goals = book.find((t) => t.name === 'Goals')!;
    const head = goals.rows[0]!.map(String);
    const row = goals.rows.find((r) => r.includes(goal.title))!;
    expect([row[head.indexOf('State')], row[head.indexOf('Status')]]).toEqual(['proposed', 'Proposed']);
    const read = readTables(book.map((t) => ({ name: t.name, rows: t.rows.map((r) => r.map((v) => (v == null ? '' : String(v)))) })) as unknown as NamedGrid[]);
    const cs = planChanges({ tables: read.tables, snapshot: s, cycle: w.cycle, week: w.week, actor: s.people.find((p) => p.id === 'amara')!, now: w.today.toISOString(), newId, via: 'spreadsheet', full: w.full });
    expect(cs.issues.filter((i) => i.level === 'must')).toEqual([]);
    expect(cs.items).toEqual([]);
  });
});

/* N29: a proposed goal is judged nowhere. With one proposed goal added, every count, health line, attention list, Home
   lead, check-in queue, review agenda, wrap-up list, streak and metric comparison is what it is without it, on every day
   of two weeks. */
describe('N29: a proposed goal is judged nowhere', () => {
  it('everything that judges reads the same with and without it, on every day of two weeks', () => {
    const base = buildPlatformOrg(DAY('2026-11-11'));
    const { w, goal } = proposed(at('2026-11-11', base));
    const people = ['tunde', 'rhea', 'amara', 'oskar'];
    const facts = (full: Snapshot, day: string) => {
      const t = at(day, full);
      const s = scopeToCycle(t.full, t.cycle);
      const rows = goalRows(s, t.cycle, t.today, t.week).summaries;
      return JSON.stringify({
        counts: rows.map((r) => [r.goal.id, r.status]),
        attention: attentionList(s, t.cycle, t.today).map((a) => [a.goal.id, a.weight]),
        reviews: s.reviews.map((r) => { const a = agendaOf(reviewSession(r, s, t.cycle, t.today, t.week)); return [a.discuss.length, a.healthy.length, a.handled.length]; }),
        people: people.map((p) => {
          const h = homeFacts(p, s, t.cycle, t.week, t.today, { workspace: 'P', draft: false });
          return [weekProgress(p, s, t.cycle, t.week, t.today).due.map((g) => g.id), onTimeStreak(p, s, t.cycle, t.week), h.checkIns, h.owns, h.wrap, h.sessions];
        }),
      });
    };
    for (let i = 0; i < 14; i++) {
      const day = new Date(Date.UTC(2026, 10, 11 + i)).toISOString().slice(0, 10);
      expect(facts(w.full, day)).toBe(facts(base, day));
    }
    expect(w.full.goals.some((g) => g.id === goal.id)).toBe(true);
  });
});
