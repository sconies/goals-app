/* The check-in rhythm in words (FT1, docs/design/feature-toggles/spec.md 4.1–4.3): the Features row, the line on
   Cycles, the Change sheet's read-back and the toast. Pure: the counts come from rhythmReadBack (status.ts). */
import { dayText } from './format';
import { firstWeekFrom } from './plan';
import { reviewDate, WEEKDAY } from './progress';
import type { RhythmReadBack } from './status';
import { rhythmOf, staleAfterDays } from './thresholds';
import type { Cycle, DisplayStatus } from './types';
import { LABEL } from './vocabulary';

/** A rhythm to choose: every week by a weekday, or none. */
export interface RhythmChoice { weeks: number; dueDay: number }

export const rhythmChoiceOf = (cycle: Cycle): RhythmChoice => ({ weeks: rhythmOf(cycle) ? 1 : 0, dueDay: cycle.reviewDay });

/** Features' row (4.1). */
export function rhythmLine(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  if (!r) return 'No set rhythm. Owners check in when there’s news; nothing is due or late for want of a check-in.';
  return `Every week, due by ${WEEKDAY[r.dueDay]}. A goal with no check-in for ${staleAfterDays(cycle)} days reads “No recent update”.`;
}

/** The running cycle's line on Cycles (4.3), and the fact line for everyone (1.3). */
export function rhythmFact(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  return r ? `Check-ins: every week, due by ${WEEKDAY[r.dueDay]}.` : 'Check-ins: no set rhythm.';
}

/** About's fact line starts with it (4.1): "Check-ins every week, due by Thursday." */
export function rhythmAbout(cycle: Cycle): string {
  const r = rhythmOf(cycle);
  return r ? `Check-ins every week, due by ${WEEKDAY[r.dueDay]}.` : 'Check-ins have no set rhythm.';
}

/** A read-back line: a strong start and the rest. */
export interface ReadBackLine { strong: string; rest: string }

const listStatuses = (by: Partial<Record<DisplayStatus, number>>) =>
  (['on', 'risk', 'off', 'none'] as DisplayStatus[]).filter((k) => by[k]).map((k) => (k === 'none' ? `${by[k]} with no check-in yet` : `${by[k]} ${LABEL[k].toLowerCase()}`)).join(', ');

/** What changes for everyone (4.2), once the choice differs from what is saved; [] when it doesn't. */
export function rhythmReadBackLines(cycle: Cycle, to: RhythmChoice, counts: RhythmReadBack, today: Date): ReadBackLine[] {
  const was = rhythmChoiceOf(cycle);
  if (was.weeks === to.weeks && (to.weeks === 0 || was.dueDay === to.dueDay)) return [];
  const day = WEEKDAY[to.dueDay]!;
  if (to.weeks === 0) {
    const n = counts.live;
    return [
      { strong: `${n} ${n === 1 ? 'goal has' : 'goals have'} nothing due.`, rest: ' Home and Check-in stop counting what’s due, and on-time streaks stop.' },
      ...(counts.unstale ? [{ strong: `${counts.unstale} ${counts.unstale === 1 ? 'goal stops' : 'goals stop'} reading “No recent update”.`, rest: ` Each shows its last check-in’s status and the week it is from: ${listStatuses(counts.unstaleBy)}.` }] : []),
      { strong: 'Nothing is flagged for going quiet.', rest: ' Goals’ “Last check-in” filter still finds them.' },
      { strong: '', rest: 'Dates people chose stay: stage dates, next steps’ weeks and “back on plan by”.' },
      { strong: '', rest: 'Every check-in already posted stays as it is.' },
    ];
  }
  if (was.weeks === 0) {
    const after: Cycle = { ...cycle, checkInWeeks: 1, reviewDay: to.dueDay };
    const first = reviewDate(after, firstWeekFrom(after, today.toISOString(), to.dueDay));
    return [
      { strong: `Check-ins are due by ${day}`, rest: `, the first by ${dayText(first)}.` },
      { strong: 'Nothing is late today.', rest: ` A goal reads “No recent update” after ${staleAfterDays(after)} days without a check-in, counted from today.` },
      { strong: '', rest: 'Streaks start from this week.' },
    ];
  }
  return [{ strong: '', rest: `Check-ins are due by ${day} from this week. Streaks count the new day from this week.` }];
}

/** The toast after saving (4.2). */
export function rhythmToast(cycle: Cycle, to: RhythmChoice): string {
  if (to.weeks === 0) return 'Check-ins have no set rhythm now.';
  return rhythmOf(cycle) ? `Check-ins are due by ${WEEKDAY[to.dueDay]} now.` : `Check-ins are due every week, by ${WEEKDAY[to.dueDay]}.`;
}
