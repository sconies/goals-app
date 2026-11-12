import { describe, expect, it } from 'vitest';
import { homeFor, homeLead, quietLine, type HomeFacts, type HomeSession } from './home';

/* Rule 2's worked examples (docs/design/home/spec.md): weekly, due Thursday 12 Nov, week 46 of 53. */
const due = (n: number, number = true) => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, title: `Goal ${i + 1}`, number }));
const facts = (p: Partial<HomeFacts> & { today: string }, c: Partial<HomeFacts['checkIns']> = {}): HomeFacts => ({
  week: 46, lastWeek: 53, cycleName: '2026', workspace: 'Platform Engineering', starts: null, ended: false,
  rhythm: { dueDate: '2026-11-12', nextDueDate: '2026-11-19' },
  wrap: null, sessions: [], owns: 2, watches: 1, asks: 0,
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
    expect(p.quiet).toEqual({ sentence: 'Both check-ins are in for week 46.', line: 'That is 5 weeks in a row on time. The next are due by Thursday 19 Nov.', buttons: [] });
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
