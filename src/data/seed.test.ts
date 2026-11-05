import { currentWeek } from '../domain/plan';
import { goalStatus } from '../domain/status';
import { seed } from './seed';
import { demoYear, yearName } from './yearStory';
import { BrowserStore } from './store';

describe('demo data', () => {
  const today = new Date('2026-10-30T12:00:00Z');
  const s = seed(today);
  const cycle = s.cycles[0]!;
  const status = (id: string) => goalStatus(s.goals.find((g) => g.id === id)!, cycle, s.checkIns, today);

  it('is set in the real calendar year, so its week is today’s ISO week', () => {
    // ISO week 1 of 2026 starts on Monday 29 December 2025; week 0, the week before, is for starting numbers.
    expect(cycle.startDate).toBe('2025-12-22');
    expect(cycle.weeks).toBe(53);
    expect(cycle.name).toBe('2026');
    expect(currentWeek(cycle, today)).toBe(44);
  });

  it('moves to a financial year when the story would not fit the calendar year', () => {
    // Early in the year there isn't a year of history; at the very end, the story's next steps run past it.
    for (const [d, name] of [['2027-02-10', 'May 2026–Apr 2027'], ['2026-12-15', 'Mar 2026–Feb 2027'], ['2026-04-01', 'Jun 2025–May 2026']] as const) {
      const t = new Date(d + 'T09:00:00Z');
      const y = demoYear(t);
      expect(yearName(y.startDate, y.weeks)).toBe(name);
      expect(y.week).toBeGreaterThanOrEqual(39);
      expect(y.week).toBeLessThanOrEqual(y.weeks - 5);
    }
    expect(demoYear(new Date('2026-11-03T09:00:00Z')).week).toBe(45);
  });

  it('builds every check-in through the same rules the app enforces', () => {
    expect(s.checkIns.length).toBeGreaterThan(400);
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
      expect(currentWeek(x.cycles[0]!, t)).toBe(demoYear(t).week);
      expect(x.checkIns.every((c) => c.postedAt <= t.toISOString())).toBe(true);
    }
  });
});

describe('browser store', () => {
  it('seeds the example once, commits changes with their log, and resets', async () => {
    const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'));
    const s = await store.load('example');
    const c = s.checkIns.find((x) => x.goalId === 'triage' && x.week === 7)!;
    const change = { id: 'chg1', at: c.postedAt, actorId: 'maya', goalId: 'triage', entity: 'check-in' as const, entityId: 'new', action: 'edited' as const, summary: 'x', diffs: [] };
    // A second check-in in the same week is kept alongside the first (ad hoc); saving one again by its id corrects it.
    await store.commit('example', { checkIns: [{ ...c, id: 'new', value: 64, postedAt: new Date(Date.parse(c.postedAt) + 3_600_000).toISOString() }], changes: [change] });
    const again = await new BrowserStore().load('example');
    const week7 = again.checkIns.filter((x) => x.goalId === 'triage' && x.week === 7);
    expect(week7.map((x) => x.id).sort()).toEqual([c.id, 'new'].sort());
    await store.commit('example', { checkIns: [{ ...c, value: 62 }], changes: [] });
    expect((await store.load('example')).checkIns.filter((x) => x.goalId === 'triage' && x.week === 7)).toHaveLength(2);
    expect(again.changes.at(-1)!.id).toBe('chg1');
    await store.commit('example', { goals: [{ ...s.goals[0]!, title: 'Renamed' }], changes: [] });
    expect((await store.load('example')).goals[0]!.title).toBe('Renamed');
    expect((await store.resetExample()).goals[0]!.title).toBe('Intake-to-delivery time');
  });
  it('keeps your own workspaces apart from the example', async () => {
    const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'));
    const mine = { id: 'ws_mine', name: 'Mine', kind: 'own' as const, createdAt: '2026-10-30T00:00:00Z' };
    await store.createWorkspace(mine, { people: [], teams: [], cycles: [], goals: [], checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [] });
    expect((await store.workspaces()).map((w) => w.id)).toEqual(['example', 'example-support', 'example-sales', 'example-growth', 'platform-org', 'ws_mine']);
    expect((await store.load('ws_mine')).goals).toHaveLength(0);
    expect((await store.load('example')).goals.length).toBeGreaterThan(5);
  });
  it('deletes your own workspace but only resets an example', async () => {
    const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'));
    const mine = { id: 'ws_gone', name: 'Gone', kind: 'own' as const, createdAt: '2026-10-30T00:00:00Z' };
    await store.createWorkspace(mine, { people: [], teams: [], cycles: [], goals: [], checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [] });
    await store.deleteWorkspace('ws_gone');
    expect((await store.workspaces()).some((w) => w.id === 'ws_gone')).toBe(false);
    await expect(store.load('ws_gone')).rejects.toThrow();
    await expect(store.deleteWorkspace('example-sales')).rejects.toThrow(/reset/);
  });
});

describe('example data sets', () => {
  it('each builds a live workspace with goals, history, a north star, a review and watches', async () => {
    const { EXAMPLES } = await import('./examples');
    for (const e of EXAMPLES) {
      const s = e.build(new Date('2026-10-30T12:00:00Z'));
      expect(s.goals.length, e.workspace.name).toBeGreaterThanOrEqual(6);
      expect(s.checkIns.length, e.workspace.name).toBeGreaterThan(20);
      expect(s.goals.some((g) => g.level === 'north-star'), e.workspace.name).toBe(true);
      expect(s.reviews.length, e.workspace.name).toBeGreaterThan(0);
      expect(s.watches.length, e.workspace.name).toBeGreaterThan(0);
      // Every owner and every link points at something that exists.
      for (const g of s.goals) {
        expect(s.people.some((p) => p.id === g.ownerId), `${g.id} owner`).toBe(true);
        if (g.parentId) expect(s.goals.some((x) => x.id === g.parentId), `${g.id} parent`).toBe(true);
      }
    }
  });
});
