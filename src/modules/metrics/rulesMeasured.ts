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
/** Whether a metric's goals are held to no number: it has a gap. */
export const holdsToNoNumber = (m: Pick<Metric, 'measurement' | 'removedAt'> | null | undefined): boolean => !!m && !m.removedAt && measurementOf(m) === 'gap';

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
 * The goals a metric's save holds to no number, or to their plans again: those it measures now (a live link, the goal
 * neither removed nor stopped), whose hold differs from what the metric says. Each with its History line. Empty when
 * nothing changes, so a save that leaves the gap as it was writes no goal.
 */
export function heldBy(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, m: Metric, goals: readonly Goal[], links: readonly MetricLink[]): { goals: Goal[]; changes: Change[] } {
  const ids = new Set(links.filter((l) => l.metricId === m.id && !l.removedAt).map((l) => l.goalId));
  const held = holdsToNoNumber(m);
  const moved = goals.filter((g) => ids.has(g.id) && !g.removedAt && !g.stoppedAt && !!g.unmeasuredSince !== held && g.kind !== 'milestone');
  return {
    goals: moved.map((g) => heldToNoNumber(g, held, x.now)),
    changes: moved.map((g) => heldChange(x, g, m, held)),
  };
}

/**
 * One goal's hold when what measures it changes: linked to `m` (null: unlinked, or measured by nothing). Null when the
 * goal is already as it should be.
 */
export function heldByLink(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, goal: Goal, m: Metric | null): { goal: Goal; change: Change } | null {
  const held = holdsToNoNumber(m) && goal.kind !== 'milestone';
  if (held === !!goal.unmeasuredSince) return null;
  return { goal: heldToNoNumber(goal, held, x.now), change: heldChange(x, goal, m, held) };
}

function heldChange(x: Pick<ActionContext, 'actor' | 'now' | 'newId'>, g: Goal, m: Metric | null, held: boolean): Change {
  const summary = held ? `Held to no number until “${m!.name}” is measured` : m && !m.removedAt && measurementOf(m) !== 'gap' ? `Held to its plan again, as “${m.name}” is measured` : 'Held to its plan again';
  return { id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary, diffs: [{ field: 'Measured', from: held ? 'Yes' : 'Not yet', to: held ? 'Not yet' : 'Yes' }] };
}
