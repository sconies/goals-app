import { currentWeek } from '../domain/plan';
import { goalStatus } from '../domain/status';
import { seed, SEED_WEEK } from './seed';
import { BrowserStore } from './store';

describe('demo data', () => {
  const today = new Date('2026-10-30T12:00:00Z');
  const s = seed(today);
  const cycle = s.cycles[0]!;
  const status = (id: string) => goalStatus(s.goals.find((g) => g.id === id)!, cycle, s.checkIns, today);

  it('puts today in week 7 of a 13-week cycle starting on a Monday', () => {
    expect(cycle.startDate).toBe('2026-09-07');
    expect(currentWeek(cycle, today)).toBe(SEED_WEEK);
  });

  it('builds every check-in through the same rules the app enforces', () => {
    expect(s.checkIns.length).toBeGreaterThan(50);
    expect(s.checkIns.every((c) => c.postedAt <= today.toISOString())).toBe(true);
  });

  it('tells the intended story', () => {
    expect(status('head').status).toBe('risk');
    expect(status('access').status).toBe('off');
    expect(status('env').status).toBe('stale');
    expect(status('review').latest?.calculated).toBe('on');
    expect(status('cfr').status).toBe('risk');
  });

  it('works on any day of the week, including a Monday morning', () => {
    for (const d of ['2026-11-02T00:30:00Z', '2026-11-08T23:30:00Z', '2027-02-10T09:00:00Z']) {
      const t = new Date(d);
      const x = seed(t);
      expect(currentWeek(x.cycles[0]!, t)).toBe(SEED_WEEK);
      expect(x.checkIns.every((c) => c.postedAt <= t.toISOString())).toBe(true);
    }
  });
});

describe('browser store', () => {
  it('seeds once, saves goals and replaces a check-in for the same week', async () => {
    const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'));
    const s = await store.load();
    const c = s.checkIns.find((x) => x.goalId === 'triage' && x.week === 7)!;
    await store.saveCheckIn({ ...c, id: 'new', value: 64 });
    const again = await new BrowserStore().load();
    const week7 = again.checkIns.filter((x) => x.goalId === 'triage' && x.week === 7);
    expect(week7).toHaveLength(1);
    expect(week7[0]!.value).toBe(64);
    await store.saveGoal({ ...s.goals[0]!, title: 'Renamed' });
    expect((await store.load()).goals[0]!.title).toBe('Renamed');
    expect((await store.reset()).goals[0]!.title).toBe('Intake-to-delivery time');
  });
});
