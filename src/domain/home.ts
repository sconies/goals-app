/* Home at a glance (Lane's notes, 5 Nov): your goals by status, your on-time streak, the goals you watch that need
   attention, and your next review. Worked out once, for Home and for the AI assistant's "what needs me". */
import { attentionFor, needsAttention, type GoalAttention } from './attention';
import { daysSince } from './plan';
import { onTimeStreak, WEEKDAY } from './progress';
import { sessionDate, sessionWeek, watchedGoals } from './review';
import { goalStatus } from './status';
import { STATUS_ORDER } from './summary';
import type { Cycle, DisplayStatus, Goal, Snapshot } from './types';

/** Watched goals by what they need: new information, in hand, and the rest. */
export interface WatchGroups {
  all: GoalAttention[];
  /** Needs attention (domain/attention.ts, the one rule): flagged, and nobody has picked it up. */
  needs: GoalAttention[];
  /** Off track or at risk, but someone has looked since the latest check-in and nothing new has happened. */
  handled: GoalAttention[];
  /** Of those needing attention, the ones with no recent update, for a count. */
  quiet: GoalAttention[];
  /** Nothing flagged, or only a check-in due. */
  fine: GoalAttention[];
}

/** Splits goals' attention into the Watching groups. The order of the list is kept within each group. */
export function groupWatched(all: GoalAttention[]): WatchGroups {
  const needs = all.filter(needsAttention);
  return {
    all,
    needs,
    handled: all.filter((a) => !!a.handled),
    quiet: needs.filter((a) => a.status.status === 'stale'),
    fine: all.filter((a) => !needsAttention(a) && !a.handled),
  };
}

export interface NextReview { id: string; name: string; week: number; date: string; weekday: string; days: number }

/** The next session of a review the person takes part in, today's included. */
export function nextReview(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): NextReview | null {
  const day = today.toISOString().slice(0, 10);
  const next = s.reviews.filter((r) => r.people.includes(personId)).map((r) => {
    let w = sessionWeek(r, week);
    if (sessionDate(r, cycle, w) < day) w = sessionWeek(r, w + 1);
    const date = sessionDate(r, cycle, w);
    return { id: r.id, name: r.name, week: w, date, weekday: WEEKDAY[r.weekday] ?? '', days: 0 - daysSince(date, today) + 0 };
  }).filter((x) => x.week <= cycle.weeks).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return next[0] ?? null;
}

export interface Dashboard {
  /** Whose goals the counts are: the person's own, or every goal when they own none (a leader). */
  scope: 'mine' | 'all';
  /** Goals by status, worst first, only the statuses that have any. */
  counts: { status: DisplayStatus; n: number }[];
  total: number;
  /** Weeks running with every check-in in before the review; null when they own no goals. */
  streak: number | null;
  /** The goals they watch, grouped; null when they watch nothing. */
  watching: WatchGroups | null;
  next: NextReview | null;
}

export function dashboard(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): Dashboard {
  const mine = s.goals.filter((g) => g.ownerId === personId);
  const goals: Goal[] = mine.length ? mine : s.goals;
  const by = new Map<DisplayStatus, number>();
  for (const g of goals) { const k = goalStatus(g, cycle, s.checkIns, today).status; by.set(k, (by.get(k) ?? 0) + 1); }
  const watched = watchedGoals(personId, s);
  return {
    scope: mine.length ? 'mine' : 'all',
    counts: STATUS_ORDER.filter((k) => by.get(k)).map((k) => ({ status: k, n: by.get(k)! })),
    total: goals.length,
    streak: mine.length ? onTimeStreak(personId, s, cycle, week) : null,
    watching: s.watches.some((w) => w.personId === personId) ? groupWatched(watched.map((g) => attentionFor(g, s, cycle, today))) : null,
    next: nextReview(personId, s, cycle, week, today),
  };
}
