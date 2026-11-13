/* MS: a metric's measurement status, and the goals a gap holds to no number (rulesMeasured.ts, domain/unmeasured). */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../../data/platformOrg';
import { goalFromRows, goalToRows } from '../../data/rows';
import { applyCommit, type Commit } from '../../data/store';
import type { ActionContext } from '../../domain/actions';
import { attentionFor } from '../../domain/attention';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import { toJson } from '../../domain/export';
import { currentWeek } from '../../domain/plan';
import { goalStatus } from '../../domain/status';
import type { Snapshot } from '../../domain/types';
import { isUnmeasured } from '../../domain/unmeasured';
import { metricFromRow, metricToRow } from './records';
import * as M from './rules';
import { metricNeeds } from './rulesLibrary';
import { linkGoalMetric } from './rulesLink';
import { heldBy, holdsToNoNumber, measurementOf, measurementWords } from './rulesMeasured';
import { saveMetricAsked } from './rulesSave';
import { libraryReads } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_ms${++n}`;

function world() {
  let full: Snapshot = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  let clock = Date.parse('2026-11-05T13:00:00Z');
  const x = (who: string): ActionContext => ({ snapshot: scopeToCycle(full, cycle), cycle, week, actor: full.people.find((p) => p.id === who)!, now: new Date(clock += 60_000).toISOString(), newId, allGoals: full.goals, full });
  return {
    x, cycle,
    get full() { return full; },
    get scoped() { return scopeToCycle(full, cycle); },
    goal: (id: string) => full.goals.find((g) => g.id === id)!,
    metric: (id: string) => M.metricsOf(full).find((m) => m.id === id)!,
    apply(c: Commit | null) { if (c) full = applyCommit(full, c); return c; },
  };
}

describe('a metric’s measurement status (MS)', () => {
  it('is measured unless someone says otherwise, and a gap or a part says what’s missing', () => {
    const w = world();
    const m = w.metric('metric_flaky-rate');
    expect(measurementOf(m)).toBe('measured');
    expect(holdsToNoNumber(m)).toBe(false);
    expect(measurementWords({ measurement: 'gap', measurementNote: 'No feed yet' })).toBe('Gap: No feed yet');
    expect(measurementWords({ measurement: 'measured', measurementNote: 'ignored' })).toBe('Measured');
    expect(() => M.saveMetric(w.x('rhea'), { id: m.id, measurement: 'gap', measurementNote: 'x'.repeat(301) })).toThrow('Keep what’s missing to 300 characters or fewer.');
  });

  it('holds the goals a gap measures to no number, in the same save, and to their plans again once measured', () => {
    const w = world();
    const g = w.goal('lead-flaky');
    expect(goalStatus(g, w.cycle, w.full.checkIns, today).unmeasured).toBeUndefined();
    const gap = saveMetricAsked(w.x('rhea'), { id: 'metric_flaky-rate', measurement: 'gap', measurementNote: 'The new runner sends no results yet' });
    expect(gap.commit!.goals!.map((v) => v.id)).toEqual(['lead-flaky']);
    expect(gap.commit!.changes.map((c) => c.summary)).toContain('Held to no number until “Flaky test rate” is measured');
    w.apply(gap.commit);
    const held = w.goal('lead-flaky');
    expect(isUnmeasured(held)).toBe(true);
    // The core rule: no status from its plan, nothing late or due, no projection.
    const st = goalStatus(held, w.cycle, w.full.checkIns, today);
    expect(st).toMatchObject({ unmeasured: true, calc: 'none', greener: false });
    expect(['none', 'done']).toContain(st.status);
    expect(attentionFor(held, w.scoped, w.cycle, today).flags.map((f) => f.kind)).not.toContain('due');
    // The library lists it under To sort out, saying how many goals it holds.
    expect(metricNeeds(w.metric('metric_flaky-rate'), libraryReads(w.scoped, w.x('rhea').now))[0]).toMatchObject({ id: 'gap', sentence: 'Not measured yet: 1 goal held to no number', button: 'Say how it’s measured' });
    // Partly measured holds its goals to their plans again.
    const partly = saveMetricAsked(w.x('rhea'), { id: 'metric_flaky-rate', measurement: 'partly', measurementNote: 'Two of three runners' });
    expect(partly.commit!.changes.map((c) => c.summary)).toContain('Held to its plan again, as “Flaky test rate” is measured');
    w.apply(partly.commit);
    expect(isUnmeasured(w.goal('lead-flaky'))).toBe(false);
    expect(metricNeeds(w.metric('metric_flaky-rate'), libraryReads(w.scoped, w.x('rhea').now))[0]).toMatchObject({ id: 'partly', sentence: 'Only partly measured' });
    // Saving it as it is writes no goal.
    expect(heldBy(w.x('rhea'), w.metric('metric_flaky-rate'), w.full.goals, M.linksOf(w.full)).goals).toEqual([]);
  });

  it('holds a goal linked to a gap, and lets go of it when it is unlinked', () => {
    const w = world();
    w.apply(saveMetricAsked(w.x('rhea'), { id: 'metric_flaky-rate', measurement: 'gap' }).commit);
    // Another goal in %: measured by the gap from now on.
    const other = w.full.goals.find((g) => g.kind === 'range' && g.unit === '%' && g.id !== 'lead-flaky' && !M.linkOf(w.full, g.id) && !g.stoppedAt && !g.proposedAt && g.cycleId === w.cycle.id);
    if (other) {
      const c = linkGoalMetric(w.x(other.ownerId), other, 'metric_flaky-rate', null, '', 'Same number')!;
      expect(c.goals?.[0]?.unmeasuredSince).toBeTruthy();
      w.apply(c);
      expect(isUnmeasured(w.goal(other.id))).toBe(true);
    }
    const un = M.unlinkGoalMetric(w.x('rhea'), w.goal('lead-flaky'))!;
    expect(un.goals?.[0]).toMatchObject({ id: 'lead-flaky', unmeasuredSince: null });
    expect(un.changes.map((c) => c.summary)).toContain('Held to its plan again');
  });

  it('round-trips through the rows: the status always written, the goal’s hold only when set', () => {
    const w = world();
    const m = w.metric('metric_flaky-rate');
    expect(metricToRow('ws', m)).toMatchObject({ measurement: 'measured', measurement_note: '' });
    const gap = { ...m, measurement: 'gap' as const, measurementNote: 'Not yet' };
    expect(metricFromRow(metricToRow('ws', gap))).toMatchObject({ measurement: 'gap', measurementNote: 'Not yet' });
    expect(metricFromRow(metricToRow('ws', m)).measurement).toBeUndefined();
    const g = w.goal('lead-flaky');
    expect(goalToRows('ws', g).goal.unmeasured_since).toBeUndefined();
    const held = { ...g, unmeasuredSince: '2026-11-05T13:00:00.000Z' };
    const back = goalFromRows(goalToRows('ws', held).goal, []);
    expect(back.unmeasuredSince).toBe('2026-11-05T13:00:00.000Z');
    expect(goalToRows('ws', { ...g, unmeasuredSince: null }).goal.unmeasured_since).toBeNull();
  });

  it('says so in the export: held to no number, and the word for it', () => {
    const w = world();
    w.apply(saveMetricAsked(w.x('rhea'), { id: 'metric_flaky-rate', measurement: 'gap' }).commit);
    const out = toJson({ ws: { id: 'ws', name: 'Platform' }, snapshot: w.scoped, cycle: w.cycle, week: currentWeek(w.cycle, today), today, sheets: [] }) as unknown as { goals: { id: string; unmeasured?: { since: string }; now: { statusLabel: string } }[] };
    const g = out.goals.find((v) => v.id === 'lead-flaky')!;
    expect(g.unmeasured?.since).toBeTruthy();
    expect(g.now.statusLabel).toBe('Not measured yet');
  });
});
