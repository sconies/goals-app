import { describe, expect, it } from 'vitest';
import { askLead, homeFor, homeLead, missedReviews, proposalLead, quietLine, waiting, waitingOrder, type AskFacts, type HomeFacts, type HomeSession } from './home';
import { buildPlatformOrg } from '../data/platformOrg';
import { scopeToCycle } from './cycle';
import { currentWeek, hasEnded } from './plan';

/* Rule 2's worked examples (docs/design/home/spec.md): weekly, due Thursday 12 Nov, week 46 of 53. */
const due = (n: number, number = true) => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, title: `Goal ${i + 1}`, number }));
const facts = (p: Partial<HomeFacts> & { today: string }, c: Partial<HomeFacts['checkIns']> = {}): HomeFacts => ({
  week: 46, lastWeek: 53, cycleName: '2026', workspace: 'Platform Engineering', starts: null, ended: false,
  rhythm: { dueDate: '2026-11-12', nextDueDate: '2026-11-19' },
  wrap: null, sessions: [], owns: 2, watches: 1, asks: [],
  ...p,
  checkIns: { total: 2, done: 0, due: [], draft: false, allInOnTimeToday: false, streak: 0, ...c },
});
const session = (p: Partial<HomeSession>): HomeSession => ({ id: 'dp', name: 'Developer Productivity fortnightly', date: '2026-11-10', held: false, discuss: 14, healthy: 21, done: 0, total: 35, started: false, nextGoal: null, nextDate: '2026-11-24', ...p });

describe('Home rule 2: the lead', () => {
  it('Tunde, Mon 9 Nov, 2 to do: no lead, and the quiet line says when they are due', () => {
    const f = facts({ today: '2026-11-09' }, { due: due(2) });
    expect(homeLead(f)).toBeNull();
    expect(quietLine(f)).toEqual({ sentence: 'Nothing is asked of you today.', line: 'Check-ins for week 46 are due by Thursday 12 Nov. You have 2 to do.', buttons: [{ label: 'Check in early', to: '/check-in' }] });
  });
  it('Tunde, Tue 10 Nov, a draft kept: the check-in leads, picking up the draft', () => {
    const l = homeLead(facts({ today: '2026-11-10' }, { done: 1, due: due(1), draft: true }));
    expect(l?.kind).toBe('check-in');
    expect(l?.action).toEqual({ label: 'Pick up where you left off', to: '/check-in?start=1' });
  });
  it('Tunde, Wed 11 Nov, 1 to do: the check-in leads, due tomorrow', () => {
    const l = homeLead(facts({ today: '2026-11-11' }, { done: 1, due: due(1) }));
    expect([l?.kind, l?.eyebrow, l?.title, l?.action.label]).toEqual(['check-in', 'Check-ins are due by Thursday 12 Nov, tomorrow', '1 check-in to do', 'Start check-in']);
  });
  it('Tunde, Thu 12 Nov, posts the last one today, streak 5: one sentence with the streak and the next date', () => {
    const p = homeFor(facts({ today: '2026-11-12' }, { done: 2, allInOnTimeToday: true, streak: 5 }));
    expect(p.lead).toBeNull();
    expect(p.quiet).toEqual({ sentence: 'Both of your check-ins are in for week 46, before Thursday’s deadline.', line: 'That is 5 weeks in a row. The next are due by Thursday 19 Nov.', buttons: [] });
  });
  it('Tunde, Fri 13 Nov, all in: no streak clause, and the passed deadline is not said', () => {
    expect(quietLine(facts({ today: '2026-11-13' }, { done: 2, streak: 5 })).line).toBe('The next are due by Thursday 19 Nov.');
  });
  it('Tunde, Fri 13 Nov, 1 not posted: late', () => {
    const l = homeLead(facts({ today: '2026-11-13' }, { done: 1, due: due(1) }));
    expect([l?.kind, l?.eyebrow, l?.title]).toEqual(['check-in-late', 'Check-ins were due on Thursday 12 Nov', '1 check-in still to do']);
    expect(l?.line).toBe('Goal 1. It counts for week 46 until Sunday.');
  });
  it('Rhea, Tue 10 Nov, 6 to do and her review today: the check-in leads, named for the review', () => {
    const l = homeLead(facts({ today: '2026-11-10', sessions: [session({})] }, { total: 7, done: 1, due: due(6) }));
    expect([l?.kind, l?.eyebrow, l?.title]).toEqual(['check-in', 'Developer Productivity fortnightly is today', '6 check-ins to do before it']);
    expect(l?.also).toEqual({ label: 'Or type all your numbers in one table', to: '/quick-check-in' });
  });
  it('Rhea, Tue 10 Nov, all 7 in: the review leads', () => {
    const l = homeLead(facts({ today: '2026-11-10', sessions: [session({})] }, { total: 7, done: 7 }));
    expect([l?.kind, l?.eyebrow, l?.title, l?.action.to, l?.about]).toEqual(['review', 'Developer Productivity fortnightly is today · your 7 check-ins are in', '14 goals to discuss', '/reviews/dp', 'dp']);
  });
  it('Rhea, Wed 11 Nov, 5 to do, the session not held: the check-in comes first (rank 30 before 50)', () => {
    expect(homeLead(facts({ today: '2026-11-11', sessions: [session({})] }, { total: 7, done: 2, due: due(5) }))?.kind).toBe('check-in');
  });
  it('a review past its day and not held: said with the warning mark', () => {
    const l = homeLead(facts({ today: '2026-11-13', sessions: [session({ date: '2026-11-12', name: 'Platform leadership weekly', discuss: 19 })], owns: 0 }, { total: 0 }));
    expect([l?.kind, l?.warn, l?.eyebrow]).toEqual(['review', true, 'Not held yet · Platform leadership weekly was on Thursday 12 Nov']);
  });
  it('two reviews on the day: the earliest, then by name', () => {
    const l = homeLead(facts({ today: '2026-11-24', sessions: [session({ id: 'b', name: 'Platform leadership weekly', date: '2026-11-24' }), session({ id: 'a', name: 'Security monthly', date: '2026-11-23' })], owns: 0 }, { total: 0 }));
    expect(l?.about).toBe('a');
  });
  it('Oskar, any day: nothing is asked', () => {
    expect(homeFor(facts({ today: '2026-11-11', owns: 0, watches: 3 }, { total: 0 })).quiet?.sentence).toBe('Nothing is asked of you today.');
  });
  it('someone who owns, watches and is asked nothing: two plain buttons', () => {
    expect(quietLine(facts({ today: '2026-11-11', owns: 0, watches: 0 }, { total: 0 }))).toEqual({ sentence: 'Nothing is asked of you today.', line: 'You don’t own or watch a goal in Platform Engineering yet.', buttons: [{ label: 'See the goals', to: '/goals?scope=all' }, { label: 'Set up a goal', to: '/goals/new' }] });
  });
  it('Tunde, Mon 21 Dec, 2 to do, wrap-up open: no lead on Monday; Wed 23 Dec the check-in; both in, the wrap-up', () => {
    const wrap = { ends: '2027-01-03', ended: false, left: [{ id: 'g1', title: 'Goal 1' }, { id: 'g2', title: 'Goal 2' }], total: 2 };
    const rhythm = { dueDate: '2026-12-24', nextDueDate: '2026-12-31' };
    expect(homeLead(facts({ today: '2026-12-21', week: 52, rhythm, wrap }, { due: due(2) }))).toBeNull();
    expect(homeLead(facts({ today: '2026-12-23', week: 52, rhythm, wrap }, { due: due(2) }))?.kind).toBe('check-in');
    const l = homeLead(facts({ today: '2026-12-23', week: 52, rhythm, wrap }, { done: 2 }));
    expect([l?.kind, l?.eyebrow, l?.title, l?.action.to]).toEqual(['wrap-up', '2026 ends on Sunday 3 Jan', 'Wrap up your 2 goals', '/retro/g1']);
  });
  it('no set rhythm: a check-in is never the lead, nothing is due or late', () => {
    const f = facts({ today: '2026-11-13', rhythm: null }, { done: 1, due: due(1) });
    expect(homeLead(f)).toBeNull();
    expect(quietLine(f)).toEqual({ sentence: 'Nothing is asked of you today.', line: null, buttons: [] });
  });
  it('before the cycle starts, and after it ends', () => {
    expect(quietLine(facts({ today: '2026-12-28', cycleName: '2027', starts: { on: '2027-01-04', firstDue: '2027-01-07' } })).line).toBe('2027 starts on Monday 4 Jan. The first check-ins are due by Thursday 7 Jan.');
    expect(quietLine(facts({ today: '2027-01-12', ended: true })).line).toBe('2026 has ended.');
  });
  it('never says “You’re all set” or “0 weeks”', () => {
    for (const today of ['2026-11-09', '2026-11-12', '2026-11-13']) for (const done of [0, 1, 2]) {
      const p = homeFor(facts({ today }, { done, due: due(2 - done), allInOnTimeToday: done === 2, streak: 0 }));
      expect(JSON.stringify(p)).not.toMatch(/all set|0 weeks/);
    }
  });
});

describe('Home after the build review of HM1', () => {
  it('while asks wait, the quiet line doesn’t say nothing is asked', () => {
    expect(quietLine(facts({ today: '2026-11-13', asks: [waiting(ask({}), '2026-11-13'), waiting(ask({ id: 'b' }), '2026-11-13')] }, { done: 0, due: [] })).sentence).toBe('2 asks wait for your response.');
    expect(quietLine(facts({ today: '2026-11-13', asks: [waiting(ask({}), '2026-11-13')] }, { done: 0, due: [] })).sentence).toBe('One ask waits for your response.');
    expect(quietLine(facts({ today: '2026-11-13', asks: [] }, { done: 0, due: [] })).sentence).toBe('Nothing is asked of you today.');
  });
});

/* Rule 3's worked examples: an ask that waits. */
const ask = (p: Partial<AskFacts>): AskFacts => ({ id: 'a', kind: 'question', by: 'Daniel', goals: [{ id: 'g', title: 'Pipeline queue wait (p90)' }], said: 'Is the runner budget approved?', askedOn: '2026-11-03', dueWeek: null, session: null, where: null, ...p });
const DP = { name: 'Developer Productivity fortnightly', date: '2026-11-10' };

describe('Home rule 3: an ask that waits', () => {
  it('Daniel’s question raised in the fortnightly, the day before its next session', () => {
    const w = waiting(ask({ session: DP, where: DP.name }), '2026-11-09');
    expect([w.due, w.late, w.dueThisWeek, w.line, w.warn]).toEqual([{ date: '2026-11-10', why: 'session' }, false, true, 'Due before tomorrow’s session', true]);
  });
  it('the same, unanswered after the session: late, and its date does not move to the next session', () => {
    const w = waiting(ask({ session: DP }), '2026-11-11');
    expect([w.late, w.line]).toEqual([true, 'Was due by Tue 10 Nov']);
  });
  it('Rhea’s decision for Amara, asked 4 Aug with no date: waited 99 days, 14 weeks', () => {
    const w = waiting(ask({ kind: 'decision', by: 'Rhea', askedOn: '2026-08-04' }), '2026-11-11');
    expect([w.late, w.waitedDays, w.line]).toEqual([false, 99, 'Waiting since 4 Aug, 14 weeks']);
  });
  it('a next step due week 47, then the same in week 48', () => {
    const due = { week: 47, sunday: '2026-11-22', dates: '16–22 Nov' };
    expect(waiting(ask({ kind: 'action', by: null, dueWeek: due }), '2026-11-11').line).toBe('Due week 47 (16–22 Nov)');
    const late = waiting(ask({ kind: 'action', by: null, dueWeek: due }), '2026-11-25');
    expect([late.late, late.line, late.warn]).toEqual([true, 'Was due week 47 (16–22 Nov)', true]);
  });
  it('with no session date (Reviews off), by its age', () => {
    expect(waiting(ask({}), '2026-11-11').line).toBe('Waiting since 3 Nov, 8 days');
    expect(waiting(ask({ askedOn: '2026-11-10' }), '2026-11-11').line).toBe('Asked yesterday');
    expect(waiting(ask({ askedOn: '2026-11-09' }), '2026-11-11').line).toBe('Asked on Monday');
  });
  it('orders late, then due this week, then old undated oldest first, then the rest newest first; decisions first within each', () => {
    const t = '2026-11-11';
    const list = [
      waiting(ask({ id: 'new', askedOn: '2026-11-10' }), t),
      waiting(ask({ id: 'old-q', askedOn: '2026-10-01' }), t),
      waiting(ask({ id: 'old-d', kind: 'decision', askedOn: '2026-10-20' }), t),
      waiting(ask({ id: 'late', session: DP }), t),
      waiting(ask({ id: 'week', kind: 'action', by: null, dueWeek: { week: 46, sunday: '2026-11-15', dates: '9–15 Nov' } }), t),
    ].sort(waitingOrder);
    expect(list.map((w) => w.askId)).toEqual(['late', 'week', 'old-d', 'old-q', 'new']);
  });
  it('leads when late, due this week or a week old; not when new', () => {
    const l = askLead(waiting(ask({ kind: 'decision', by: 'Rhea', askedOn: '2026-08-04', goals: [{ id: 'a', title: 'Lead time' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }] }), '2026-11-09'));
    expect([l?.kind, l?.eyebrow, l?.title, l?.action.label, l?.line]).toEqual(['ask', 'Needs your response · waiting since 4 Aug, 13 weeks', 'Rhea needs a decision', 'Respond', '“Is the runner budget approved?”. 3 goals are waiting on it: Lead time, and 2 more.']);
    expect(askLead(waiting(ask({ askedOn: '2026-11-10' }), '2026-11-11'))).toBeNull();
  });
  it('rank 60: an ask leads only when nothing before it does, and is then not listed again', () => {
    const w = waiting(ask({ session: DP }), '2026-11-09');
    const p = homeFor(facts({ today: '2026-11-09', asks: [w] }, { due: due(2) }));
    expect([p.lead?.kind, p.asks.length]).toEqual(['ask', 0]);
    expect(homeFor(facts({ today: '2026-11-11', asks: [w] }, { done: 1, due: due(1) })).lead?.kind).toBe('check-in');
  });
});

describe('Home after the build review of #305', () => {
  it('a session missed in the year’s last week is not “not held” once the year has ended', () => {
    const full = buildPlatformOrg(new Date('2026-11-11T12:00:00Z'));
    const missedOn = (day: string) => {
      const today = new Date(day + 'T12:00:00Z');
      const cycle = full.cycles[0]!;
      expect(hasEnded(cycle, today)).toBe(true);
      const s = scopeToCycle(full, cycle);
      return full.people.filter((p) => s.reviews.some((r) => r.people.includes(p.id))).flatMap((p) => missedReviews(p.id, s, cycle, currentWeek(cycle, today), today));
    };
    expect(missedOn('2027-01-11')).toEqual([]);
    expect(missedOn('2027-02-20')).toEqual([]);
  });
});

describe('Home rank 60 after the asks: a goal proposed for you (goal entry rule 14)', () => {
  const prop = (o: Partial<{ id: string; title: string; by: string; proposedOn: string }> = {}) => ({ id: 'g132', title: 'Signed artifacts in staging', by: 'Rhea', proposedOn: '2026-11-04', ...o });
  it('leads once it has waited 7 days, oldest first, with Open it', () => {
    const l = proposalLead([prop({ id: 'new', proposedOn: '2026-11-10' }), prop({ id: 'late', proposedOn: '2026-10-20' }), prop()], '2026-11-13');
    expect([l?.kind, l?.eyebrow, l?.title, l?.line, l?.action, l?.about]).toEqual(['ask', 'Needs your response · waiting since 20 Oct, 3 weeks', 'Rhea proposed a goal for you', '“Signed artifacts in staging”. Nothing is due on it until you make it active.', { label: 'Open it', to: '/goals/late' }, 'late']);
    expect(proposalLead([prop({ proposedOn: '2026-11-07' })], '2026-11-13')).toBeNull();
  });
  it('comes after any ask that leads, and after a check-in that does', () => {
    const w = waiting(ask({ session: DP }), '2026-11-13');
    expect(homeLead(facts({ today: '2026-11-13', asks: [w], proposals: [prop()] }, { done: 2 }))?.about).toBe(w.askId);
    expect(homeLead(facts({ today: '2026-11-13', proposals: [prop()] }, { done: 1, due: due(1) }))?.kind).toBe('check-in-late');
    expect(homeLead(facts({ today: '2026-11-13', asks: [waiting(ask({ askedOn: '2026-11-12' }), '2026-11-13')], proposals: [prop()] }, { done: 2 }))?.about).toBe('g132');
  });
});
