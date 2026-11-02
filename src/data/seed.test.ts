import { currentWeek } from '../domain/plan';
import { goalStatus } from '../domain/status';
import { seed, SEED_WEEK } from './seed';
import { BrowserStore } from './store';

describe('demo data', () => {
  const today = new Date('2026-10-30T12:00:00Z');
  const s = seed(today);
  const cycle = s.cycles[0]!;
  const status = (id: string) => goalStatus(s.goals.find((g) => g.id === id)!, cycle, s.checkIns, today);

  it('puts today in week 43 of a 52-week goal year starting on a Monday', () => {
    expect(cycle.startDate).toBe('2025-12-29');
    expect(cycle.weeks).toBe(52);
    expect(cycle.name).toBe('2026');
    expect(currentWeek(cycle, today)).toBe(SEED_WEEK);
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
      expect(currentWeek(x.cycles[0]!, t)).toBe(SEED_WEEK);
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
    await store.commit('example', { checkIns: [{ ...c, id: 'new', value: 64 }], changes: [change] });
    const again = await new BrowserStore().load('example');
    const week7 = again.checkIns.filter((x) => x.goalId === 'triage' && x.week === 7);
    expect(week7).toHaveLength(1);
    expect(week7[0]!.value).toBe(64);
    expect(again.changes.at(-1)!.id).toBe('chg1');
    await store.commit('example', { goals: [{ ...s.goals[0]!, title: 'Renamed' }], changes: [] });
    expect((await store.load('example')).goals[0]!.title).toBe('Renamed');
    expect((await store.resetExample()).goals[0]!.title).toBe('Intake-to-delivery time');
  });
  it('keeps your own workspaces apart from the example', async () => {
    const store = new BrowserStore(() => new Date('2026-10-30T12:00:00Z'));
    const mine = { id: 'ws_mine', name: 'Mine', kind: 'own' as const, createdAt: '2026-10-30T00:00:00Z' };
    await store.createWorkspace(mine, { people: [], teams: [], cycles: [], goals: [], checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [] });
    expect((await store.workspaces()).map((w) => w.id)).toEqual(['example', 'example-support', 'example-sales', 'example-growth', 'ws_mine']);
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
