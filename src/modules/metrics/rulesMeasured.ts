/* A measurement status for metrics (backlog MS; docs/architecture/module-map.md, the MS row: split, Lane 3a, 13 Nov).

   The metric library's half. Each metric says whether it is measured today: Measured, Partly (some of it, or not every
   period) or Gap (nobody measures it yet), as a shape and a word, with a line on what's missing. A gap is visible and
   owned, not hidden behind a made-up number: the library lists it under "To sort out" (rulesLibrary.ts, rule 3), and
   the goals it measures are held to no number until it is measured.

   The goal's half is the core's (domain/unmeasured): a field on the goal, `unmeasuredSince`, and the status rule that
   reads it. This file is what fills the field in: linking a goal to a metric with a gap holds it to no number; the
   metric being measured (or partly), or the goal measured by another metric, holds it to its plan again. The status
   rules never read the library.

   Pure: no screens, storage or network. */
import type { ActionContext } from '../../domain/actions';
import type { Change, Goal } from '../../domain/types';
import { heldToNoNumber } from '../../domain/unmeasured';
import { rhythmChange, type GoalRhythm } from '../../domain/goalRhythm';
import { rhythmFor } from './qualityWords';
import type { Metric, MetricLink, MetricMeasurement } from './types';

/** The three, in the order the form offers them. */
export const MEASUREMENTS: readonly MetricMeasurement[] = ['measured', 'partly', 'gap'];
/** The word for each (always beside its shape: MeasureMark). */
export const MEASUREMENT_LABEL: Record<MetricMeasurement, string> = { measured: 'Measured', partly: 'Partly', gap: 'Gap' };
/** What each means, in a line: the form's hint and Help. */
export const MEASUREMENT_MEANING: Record<MetricMeasurement, string> = {
  measured: 'Its number is measured, in full, every time it’s due.',
  partly: 'Only some of it is measured, or not every period. Goals measured by it are held to their plans; say what’s missing.',
  gap: 'Nobody measures it yet. Goals measured by it are held to no number until it is measured, and need no baseline.',
};
/** The most "what's missing" may say. */
export const MEASUREMENT_NOTE_MAX = 300;

/** A metric's measurement status: measured unless it says otherwise. */
export const measurementOf = (m: Pick<Metric, 'measurement'>): MetricMeasurement => m.measurement ?? 'measured';
/** Whether a metric's goals are held to no number: it has a gap, and is in use (a retired one is measured by nobody
    ever, so it holds nothing; MS review, medium 4). */
export const holdsToNoNumber = (m: Pick<Metric, 'measurement' | 'removedAt' | 'retiredAt'> | null | undefined): boolean => !!m && !m.removedAt && !m.retiredAt && measurementOf(m) === 'gap';

/** What's wrong with a metric's measurement status, in words someone can act on. */
export function measurementProblems(m: Pick<Metric, 'measurement' | 'measurementNote'>): string[] {
  const out: string[] = [];
  if (m.measurement !== undefined && !MEASUREMENTS.includes(m.measurement)) out.push('Say whether it is measured: measured, partly or gap.');
  if ((m.measurementNote ?? '').length > MEASUREMENT_NOTE_MAX) out.push(`Keep what’s missing to ${MEASUREMENT_NOTE_MAX} characters or fewer.`);
  return out;
}

/** The status as the History and the change read-back say it: "Gap: no feed from the data warehouse yet". */
export const measurementWords = (m: Pick<Metric, 'measurement' | 'measurementNote'>): string => {
  const k = measurementOf(m);
  const note = k === 'measured' ? '' : (m.measurementNote ?? '').trim();
  return note ? `${MEASUREMENT_LABEL[k]}: ${note}` : MEASUREMENT_LABEL[k];
};

/**
 * The goals a metric's save holds to no number, or to their plans again: those it measures now (a live link), whose hold
 * differs from what the metric says. Each with its History line. Empty when nothing changes, so a save that leaves the
 * gap as it was writes no goal. Stopped and removed goals are kept in step too (#503 review): restarting or restoring
 * one re-works nothing, so it must come back held exactly as its metric says now.
 * MQ2: the same save gives each goal its check-in rhythm from the metric's refresh (monthly or quarterly; the cycle's
 * otherwise), on the core's own field (domain/goalRhythm), with its own History line.
 */
export function heldBy(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, m: Metric, goals: readonly Goal[], links: readonly MetricLink[]): { goals: Goal[]; changes: Change[] } {
  const ids = new Set(links.filter((l) => l.metricId === m.id && !l.removedAt).map((l) => l.goalId));
  const out = { goals: [] as Goal[], changes: [] as Change[] };
  for (const g of goals) {
    if (!ids.has(g.id)) continue;
    const r = heldByLink(x, g, m);
    if (r) { out.goals.push(r.goal); out.changes.push(...r.changes); }
  }
  return out;
}

/**
 * One goal's hold and rhythm when what measures it changes: linked to `m` (null: unlinked, or measured by nothing). Null
 * when the goal is already as it should be.
 */
export function heldByLink(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, goal: Goal, m: Metric | null): { goal: Goal; changes: Change[] } | null {
  let g = goal;
  const changes: Change[] = [];
  const held = holdsToNoNumber(m) && goal.kind !== 'milestone';
  if (held !== !!goal.unmeasuredSince) { g = heldToNoNumber(g, held, x.now); changes.push(heldChange(x, goal, m, held)); }
  const r = rhythmChange(x, g, rhythmOfMetric(m), rhythmWhy(m));
  if (r) { g = r.goal; changes.push(r.change); }
  return changes.length ? { goal: g, changes } : null;
}

/** The rhythm a metric gives the goals it measures: its refresh's, when that is monthly or quarterly (rulesQuality
    rhythmFor); none from a removed metric or none at all. */
const rhythmOfMetric = (m: Metric | null): GoalRhythm | null => (m && !m.removedAt ? rhythmFor(m.refresh) : null);
const rhythmWhy = (m: Metric | null): string => {
  const r = rhythmOfMetric(m);
  return r ? `as “${m!.name}” refreshes ${r}` : m && !m.removedAt ? `as “${m.name}” refreshes more often than monthly` : 'as no metric sets its rhythm';
};

function heldChange(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, g: Goal, m: Metric | null, held: boolean): Change {
  const summary = held ? `Held to no number until “${m!.name}” is measured` : m && !m.removedAt && !m.retiredAt && measurementOf(m) !== 'gap' ? `Held to its plan again, as “${m.name}” is measured` : 'Held to its plan again';
  return { id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary, diffs: [{ field: 'Measured', from: held ? 'Yes' : 'Not yet', to: held ? 'Not yet' : 'Yes' }] };
}

/** What the library leaves on the goals' own fields when it is switched off or on (ModuleRecords.switched). Off, nothing
    measures a goal, so every goal held to no number is held to its plan again, and every goal on a metric's rhythm
    checks in on the cycle's again (MQ2); on, each metric holds its goals and sets their rhythm once more. Null when no
    goal moves. */
export function heldOnSwitch(x: Pick<ActionContext, 'actor' | 'now' | 'newId' | 'snapshot' | 'full'>, on: boolean, metrics: readonly Metric[], links: readonly MetricLink[]): { goals: Goal[]; changes: Change[] } | null {
  const goals = (x.full ?? x.snapshot).goals;
  if (!on) {
    // Stopped and removed goals too, so one restarted or restored later is held as its metric says then (#503 review).
    const moved = goals.filter((g) => !!g.unmeasuredSince || !!g.checkInRhythm);
    if (!moved.length) return null;
    const out = { goals: [] as Goal[], changes: [] as Change[] };
    for (const g of moved) {
      let next = g;
      if (g.unmeasuredSince) {
        next = heldToNoNumber(next, false, x.now);
        out.changes.push({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary: 'Held to its plan again, as the metric library is switched off', diffs: [{ field: 'Measured', from: 'Not yet', to: 'Yes' }] });
      }
      const r = rhythmChange(x, next, null, 'as the metric library is switched off');
      if (r) { next = r.goal; out.changes.push(r.change); }
      out.goals.push(next);
    }
    return out;
  }
  const parts = metrics.filter((m) => holdsToNoNumber(m) || rhythmFor(m.refresh)).map((m) => heldBy(x, m, goals, links));
  const out = { goals: parts.flatMap((p) => p.goals), changes: parts.flatMap((p) => p.changes) };
  return out.goals.length ? out : null;
}
