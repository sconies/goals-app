import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { cycleDates } from '../domain/cycle';
import * as R from '../domain/removal';
import type { Change, Snapshot } from '../domain/types';
import { appWindow, isAnchor, LOAD_DAYS, windowed } from './window';

const today = new Date('2026-11-05T12:00:00Z');
const whole: Snapshot = buildPlatformOrg(today);

describe('the app’s window (AX5 part 2b)', () => {
  it('reaches LOAD_DAYS back, from the start of that day', () => {
    expect(appWindow(today)).toEqual({ from: new Date(today.getTime() - LOAD_DAYS * 86_400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z' });
  });

  it('keeps a person’s arrival and a metric’s changes at any age', () => {
    const at = '2020-01-01T00:00:00.000Z';
    const c = (entity: Change['entity'], action: Change['action']): Change => ({ id: 'c', at, actorId: 'p', goalId: null, entity, entityId: 'x', action, summary: '', diffs: [] });
    expect(isAnchor(c('person', 'acknowledged'))).toBe(true);
    expect(isAnchor(c('metric', 'edited'))).toBe(true);
    expect(isAnchor(c('goal', 'edited'))).toBe(false);
  });
});

describe('rules on a windowed load', () => {
  // A window that starts after a year with check-ins has ended, so that year's check-ins are left out.
  const ended = whole.cycles
    .filter((c) => whole.checkIns.some((k) => whole.goals.find((g) => g.id === k.goalId)?.cycleId === c.id))
    .sort((a, b) => (cycleDates(a).lastDay < cycleDates(b).lastDay ? -1 : 1))[0]!;
  const from = new Date(Date.parse(cycleDates(ended).lastDay) + 2 * 86_400_000).toISOString();
  const s = windowed(whole, { from });

  it('a year whose check-ins were left out stays, and says so', () => {
    expect(R.checkInsLeftOut(s, ended.id)).toBe(true);
    expect(R.checkInsLeftOut(whole, ended.id)).toBe(false);
    const st = R.cycleStanding(s, ended.id);
    expect(st.deletable).toBe(false);
    expect(st.says).toMatch(/check-ins: it stays$/);
  });

  it('someone with no mark in what was loaded is still marked as left, not deleted', () => {
    const p = whole.people[0]!;
    expect(R.hasHistory(R.personHistory(s, p.id))).toBe(true);
    expect(R.personHistory(whole, p.id).unknown).toBe(false);
  });

  it('an import older than the window can’t be undone', () => {
    const old: Change = { id: 'imp', at: '2020-01-01T00:00:00.000Z', actorId: whole.people[0]!.id, goalId: null, entity: 'workspace', entityId: 'import_1', action: 'imported', summary: 'Imported', diffs: [], undo: { goals: [], checkIns: [], people: [], teams: [] } as unknown as Change['undo'] };
    const admin = { ...whole.people[0]!, admin: true };
    expect(R.canUndoImport({ ...s, changes: [...s.changes, old] }, old, admin)).toBe(false);
    expect(R.canUndoImport({ ...whole, changes: [...whole.changes, old] }, old, admin)).toBe(true);
  });
});
