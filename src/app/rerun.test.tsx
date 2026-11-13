// @vitest-environment jsdom
/* A stale save runs again (AX6; architecture review finding 5). When a save is refused because someone else changed the
   same goal since it was loaded, the dispatcher reloads, runs the same action with the same input on the latest, and
   saves that. Only a rule that now says no is shown, in its own words; two more stale refusals give up with the message
   from before. The store here is the browser store, with someone else's save slipped in just before the app's. */
import { act, render, waitFor } from '@testing-library/react';
import { AppProvider, NOBODY, STALE_SAVE, useApp, useToasts, type AppState } from './state';
import { saveRerunning } from './rerun';
import { BrowserStore, StaleError, withExpectations, type Commit } from '../data/store';
import { contractWorkspace } from '../ports/contracts/store';
import { STALE_RERUNS } from '../ports/store';
import type { Snapshot } from '../domain/types';
import { draftFor } from '../domain/goal';
import { rerunsWhenStale } from './actions';

describe('saveRerunning', () => {
  const s0 = { goals: [] } as unknown as Snapshot, s1 = { goals: [] } as unknown as Snapshot;
  const c = (n: number): Commit => ({ changes: [{ id: `c${n}` } as Commit['changes'][number]] });

  it('runs again on the reloaded snapshot after a stale refusal, and saves that run', async () => {
    const ran: Snapshot[] = [], saved: Commit[] = [];
    let stale = 1;
    const out = await saveRerunning(s0, (s) => { ran.push(s); return { out: ran.length, commit: c(ran.length) }; },
      async (x) => { if (stale-- > 0) throw new StaleError('goal g'); saved.push(x); }, async () => s1);
    expect(ran).toEqual([s0, s1]);
    expect(saved).toEqual([c(2)]);
    expect(out).toMatchObject({ out: 2, before: s1, reran: 1 });
  });

  it('throws the rule’s refusal on the re-run, and saves nothing', async () => {
    const saved: Commit[] = [];
    let n = 0;
    const done = saveRerunning(s0, (s) => { if (s === s1) throw new Error('the rule says no'); return { out: ++n, commit: c(n) }; },
      async () => { throw new StaleError('goal g'); }, async () => s1);
    await expect(done).rejects.toThrow('the rule says no');
    expect(saved).toEqual([]);
  });

  it('gives up after STALE_RERUNS re-runs, each refused as stale, with the stale refusal', async () => {
    let saves = 0;
    await expect(saveRerunning(s0, () => ({ out: 0, commit: c(0) }), async () => { saves++; throw new StaleError('goal g'); }, async () => s1))
      .rejects.toBeInstanceOf(StaleError);
    expect(saves).toBe(1 + STALE_RERUNS);
  });

  it('throws the stale refusal when the reload after it fails, so it is said not to have been saved', async () => {
    const stale = new StaleError('goal g');
    await expect(saveRerunning(s0, () => ({ out: 0, commit: c(0) }), async () => { throw stale; }, async () => { throw new Error('offline'); }))
      .rejects.toBe(stale);
  });

  it('doesn’t run again when told not to (a whole-record input), or when the failure isn’t stale', async () => {
    let saves = 0;
    await expect(saveRerunning(s0, () => ({ out: 0, commit: c(0) }), async () => { saves++; throw new StaleError('goal g'); }, async () => s1, 0)).rejects.toBeInstanceOf(StaleError);
    await expect(saveRerunning(s0, () => ({ out: 0, commit: c(0) }), async () => { saves++; throw new Error('offline'); }, async () => s1)).rejects.toThrow('offline');
    expect(saves).toBe(2);
  });
});

describe('which actions run again', () => {
  it('doesn’t re-run what the person confirmed against what they were shown, or a whole record; does re-run plain actions', () => {
    for (const n of ['activate', 'markPersonLeft', 'leaveWorkspace', 'removeTeam', 'undoImport', 'deleteGoal', 'stopGoal', 'deletePerson', 'deleteCycle', 'startNextCycle', 'mergeMetrics', 'retireMetric', 'removeMetric', 'saveGoal', 'planChanges'])
      expect([n, rerunsWhenStale(n)]).toEqual([n, false]);
    for (const n of ['restoreRemoved', 'addNote', 'watch', 'deleteComment', 'endReview', 'linkGoalMetric'])
      expect([n, rerunsWhenStale(n)]).toEqual([n, true]);
  });
});

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

describe('a save refused as stale, in the app', () => {
  const today = () => new Date('2026-01-14T12:00:00Z');
  /** The app on a browser store where, before each of the app's next saves, someone else saves `other` first. */
  async function open(key: string) {
    const store = new BrowserStore(today, { storage: memory(), example: false, key });
    const s = contractWorkspace(key);
    await store.createWorkspace({ id: 'ws_r', name: 'R', kind: 'own', createdAt: today().toISOString() }, s);
    const inner = store.commit.bind(store);
    const others: ((now: Snapshot) => Commit)[] = [];
    let saves = 0, failLoads = 0;
    const load = store.load.bind(store);
    store.load = (async (...a: Parameters<typeof store.load>) => { if (failLoads > 0) { failLoads--; throw new Error('offline'); } return load(...a); }) as typeof store.load;
    store.commit = async (ws, c) => {
      saves++;
      const other = others.shift();
      if (other) { const now = await load(ws); await inner(ws, withExpectations(other(now), now)); }
      return inner(ws, c);
    };
    let app: AppState | null = null;
    let toasts: ReturnType<typeof useToasts> = [];
    const Peek = () => { app = useApp(); toasts = useToasts(); return null; };
    localStorage.setItem('goals-app-workspace', 'ws_r');
    render(<AppProvider store={store} mode="demo" today={today}><Peek /></AppProvider>);
    await waitFor(() => expect(app?.ws.id).toBe('ws_r'));
    const admin = s.people.find((p) => p.admin)!.id;
    act(() => app!.setViewer(admin));
    await waitFor(() => expect(app?.viewer.id).toBe(admin));
    // A goal with no check-ins, so its owner or an admin may delete it.
    const goal = s.goals.find((g) => !s.checkIns.some((c) => c.goalId === g.id))!;
    return { store, s, goal, admin, others, saves: () => saves, failLoads: (n: number) => { failLoads = n; }, app: () => app!, toasts: () => toasts };
  }
  const renamed = (id: string, title: string) => (now: Snapshot): Commit => ({ goals: [{ ...now.goals.find((g) => g.id === id)!, title }], changes: [] });
  /** The goal deleted (nothing slipped in first), so putting it back (Restore: a plain action, no confirm step) can be run. */
  async function deleted(key: string) {
    const t = await open(key);
    await act(async () => { await t.app().run('deleteGoal', { goalId: t.goal.id }); });
    expect((await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!.removedAt).toBeTruthy();
    return { ...t, saves: ((n) => () => t.saves() - n)(t.saves()) };
  }
  const restore = (t: Awaited<ReturnType<typeof open>>) => t.app().run('restoreRemoved', { kind: 'goal', id: t.goal.id }).then(() => null, (e: unknown) => e);

  it('runs again on the latest and saves that: someone else’s change stays, and so does the person’s', async () => {
    const t = await deleted('rerun1');
    t.others.push(renamed(t.goal.id, 'Renamed by someone else'));
    let err: unknown;
    await act(async () => { err = await restore(t); });
    expect(err).toBeNull();
    const g = (await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!;
    expect(g.title).toBe('Renamed by someone else');
    expect(g.removedAt).toBeFalsy();
    expect(t.saves()).toBe(2);
    expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(false);
  });

  it('shows the rule’s own words when it now says no, and saves nothing', async () => {
    const t = await deleted('rerun2');
    // Someone else puts it back first, so there's nothing removed to restore now.
    t.others.push((now) => ({ goals: [{ ...now.goals.find((x) => x.id === t.goal.id)!, removedAt: null, removedBy: null }], changes: [] }));
    let err: unknown;
    await act(async () => { err = await restore(t); });
    expect((err as Error).message).toMatch(/nothing removed with that ID/);
    await waitFor(() => expect(t.toasts().some((x) => x.kind === 'error' && /nothing removed with that ID/.test(x.text))).toBe(true));
    expect(t.saves()).toBe(1);
    expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(false);
  });

  it('gives up after two re-runs refused as stale, with the message from before', async () => {
    const t = await deleted('rerun3');
    for (let i = 0; i <= STALE_RERUNS; i++) t.others.push(renamed(t.goal.id, `Renamed ${i}`));
    let err: unknown;
    await act(async () => { err = await restore(t); });
    expect(err).toBeInstanceOf(StaleError);
    expect(t.saves()).toBe(1 + STALE_RERUNS);
    await waitFor(() => expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(true));
    expect((await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!.removedAt).toBeTruthy();
  });

  it('refuses, as for anyone not signed in, when the person was marked as left before it ran again', async () => {
    const t = await deleted('rerun5');
    // Someone else marks the admin as left, and touches the goal, before her Restore lands.
    t.others.push((now) => ({
      goals: [{ ...now.goals.find((x) => x.id === t.goal.id)!, title: 'Touched' }],
      people: [{ ...now.people.find((p) => p.id === t.admin)!, leftAt: today().toISOString(), leftBy: 'someone' }],
      changes: [],
    }));
    let err: unknown;
    await act(async () => { err = await restore(t); });
    expect((err as Error).message).toBe(NOBODY);
    await waitFor(() => expect(t.toasts().some((x) => x.kind === 'error' && x.text === NOBODY)).toBe(true));
    expect(t.saves()).toBe(1);
    expect((await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!.removedAt).toBeTruthy();
  });

  it('says it wasn’t saved when the reload after a stale refusal fails', async () => {
    const t = await deleted('rerun6');
    t.others.push(renamed(t.goal.id, 'Renamed by someone else'));
    t.failLoads(1);
    let err: unknown;
    await act(async () => { err = await restore(t); });
    expect(err).toBeInstanceOf(StaleError);
    expect(t.saves()).toBe(1);
    await waitFor(() => expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(true));
  });

  it('doesn’t run a delete again: it was confirmed against a sheet saying what it moves, which may have changed', async () => {
    const t = await open('rerun7');
    t.others.push(renamed(t.goal.id, 'Renamed by someone else'));
    let err: unknown;
    await act(async () => { err = await t.app().run('deleteGoal', { goalId: t.goal.id }).then(() => null, (e: unknown) => e); });
    expect(err).toBeInstanceOf(StaleError);
    expect(t.saves()).toBe(1);
    await waitFor(() => expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(true));
    expect((await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!.removedAt).toBeFalsy();
  });

  it('doesn’t run a whole goal form again: it would put back what someone else just changed', async () => {
    const t = await open('rerun4');
    t.others.push(renamed(t.goal.id, 'Renamed by someone else'));
    const draft = { ...draftFor(t.goal), title: 'My title' };
    let err: unknown;
    await act(async () => { err = await t.app().run('saveGoal', { goalId: t.goal.id, draft }).then(() => null, (e: unknown) => e); });
    expect(err).toBeInstanceOf(StaleError);
    expect(t.saves()).toBe(1);
    await waitFor(() => expect(t.toasts().some((x) => x.text === STALE_SAVE)).toBe(true));
    expect((await t.store.load('ws_r')).goals.find((x) => x.id === t.goal.id)!.title).toBe('Renamed by someone else');
  });
});
