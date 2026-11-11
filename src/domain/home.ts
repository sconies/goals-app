/* Home at a glance (Lane's notes, 5 Nov): your goals by status, your on-time streak, the goals you watch that need
   attention, and your next review. Worked out once, for Home and for the AI assistant's "what needs me". */
import { attentionFor, needsAttention, type GoalAttention } from './attention';
import { daysSince } from './plan';
import { onTimeStreak, WEEKDAY } from './progress';
import { daysPast, reviewSession, sessionDate, upcomingSessionWeek, watchedGoals } from './review';
import { goalStatus } from './status';
import { statusCounts } from './order';
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
  const next = s.reviews.filter((r) => r.people.includes(personId)).map((r) => {
    const w = upcomingSessionWeek(r, cycle, week, today);
    const date = sessionDate(r, cycle, w);
    return { id: r.id, name: r.name, week: w, date, weekday: WEEKDAY[r.weekday] ?? '', days: 0 - daysSince(date, today) + 0 };
  }).filter((x) => x.week <= cycle.weeks).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return next[0] ?? null;
}

/** A session of a review the person is in, past its date this week and not held (re-review, 8 Nov, backlog T). */
export interface MissedReview { id: string; name: string; week: number; date: string; daysPast: number }

/** This week's sessions the person is in that are past their date and not held, longest past first. */
export function missedReviews(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): MissedReview[] {
  return s.reviews.filter((r) => r.people.includes(personId)).map((r) => {
    const sx = reviewSession(r, s, cycle, today, week);
    return { id: r.id, name: r.name, week: sx.week, date: sx.date, daysPast: daysPast(sx, today) };
  // A session after the cycle's last week (a fortnightly one landing in week 54) isn't in this cycle: never missed in it.
  }).filter((x) => x.daysPast > 0 && x.week <= cycle.weeks).sort((a, b) => b.daysPast - a.daysPast || a.name.localeCompare(b.name));
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
  /** Sessions past their date and not held: shown before the next review, so a missed one isn't hidden by it. */
  missed: MissedReview[];
}

export function dashboard(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): Dashboard {
  const mine = s.goals.filter((g) => g.ownerId === personId);
  const goals: Goal[] = mine.length ? mine : s.goals;
  const watched = watchedGoals(personId, s);
  return {
    scope: mine.length ? 'mine' : 'all',
    counts: statusCounts(goals.map((g) => goalStatus(g, cycle, s.checkIns, today).status)),
    total: goals.length,
    streak: mine.length ? onTimeStreak(personId, s, cycle, week) : null,
    watching: s.watches.some((w) => w.personId === personId) ? groupWatched(watched.map((g) => attentionFor(g, s, cycle, today))) : null,
    next: nextReview(personId, s, cycle, week, today),
    missed: missedReviews(personId, s, cycle, week, today),
  };
}

/* ---------- Home asks first (round 3, HM1: docs/design/home/spec.md rules 1 and 2) ---------- */

/** A review session the viewer is in, this week's, as Home reads it. */
export interface HomeSession { id: string; name: string; date: string; held: boolean; discuss: number; healthy: number; done: number; total: number; started: boolean; nextGoal: { id: string; title: string } | null; nextDate: string | null }

/** What Home's lead and quiet line read (rule 1). The app layer builds it (src/app/reads.ts homeFacts); no snapshot here. */
export interface HomeFacts {
  /** yyyy-mm-dd. */
  today: string;
  week: number;
  lastWeek: number;
  cycleName: string;
  workspace: string;
  /** Before the cycle's week 1: its first day and the first check-ins' date. */
  starts: { on: string; firstDue: string } | null;
  ended: boolean;
  /** null: no set rhythm (round 2's FT1); nothing is then due or late. */
  rhythm: { dueDate: string; nextDueDate: string | null } | null;
  checkIns: { total: number; done: number; due: { id: string; title: string; number: boolean }[]; draft: boolean; allInOnTimeToday: boolean; streak: number | null };
  /** The wrap-up, while it is open: the cycle's last day, whether it has passed, the viewer's goals not yet wrapped up. */
  wrap: { ends: string; ended: boolean; left: { id: string; title: string }[]; total: number } | null;
  sessions: HomeSession[];
  owns: number;
  watches: number;
  asks: number;
}

export type LeadKind = 'check-in-late' | 'check-in' | 'wrap-up' | 'review';
export interface Lead {
  kind: LeadKind;
  eyebrow: string;
  /** The eyebrow begins with the warning mark ("Not held yet"). */
  warn: boolean;
  title: string;
  line: string;
  action: { label: string; to: string };
  /** A quiet link under the button ("Or type all your numbers in one table"). */
  also: { label: string; to: string } | null;
  ring: { done: number; total: number; counts: 'check-ins' | 'reviewed' | 'wrapped' } | null;
  /** The review the lead is about, so the cell for it is left out. */
  about: string | null;
}
export interface Quiet { sentence: string; line: string | null; buttons: { label: string; to: string }[] }
export interface HomePlan { lead: Lead | null; quiet: Quiet | null }

/** A check-in becomes the lead this many days before it is due (decision 1 (a): the day before). */
export const LEAD_DAYS = 1;

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Thursday 12 Nov". */
export function longDay(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  return `${LONG_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
const plural = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);
/** "Deploy lead time", "A and B", "A, and 2 more". */
function titles(list: { title: string }[]): string {
  if (list.length <= 2) return list.map((x) => x.title).join(' and ');
  return `${list[0]!.title}, and ${list.length - 1} more`;
}

function checkInLead(f: HomeFacts, late: boolean): Lead {
  const due = f.checkIns.due;
  const n = due.length;
  const review = f.sessions.find((x) => x.date === f.today && !x.held);
  const numbers = due.filter((d) => d.number).length;
  const minutes = Math.max(1, Math.round(n * 0.75));
  const dueDate = f.rhythm!.dueDate;
  const days = dayDiff(f.today, dueDate);
  const when = days === 0 ? ', today' : days === 1 ? ', tomorrow' : days > 1 ? `, in ${days} days` : '';
  const also = numbers >= 2 ? { label: 'Or type all your numbers in one table', to: '/quick-check-in' } : null;
  const ring = { done: f.checkIns.done, total: f.checkIns.total, counts: 'check-ins' as const };
  const action = { label: f.checkIns.draft ? 'Pick up where you left off' : 'Start check-in', to: '/check-in?start=1' };
  if (late) {
    return { kind: 'check-in-late', eyebrow: `Check-ins were due on ${longDay(dueDate)}`, warn: false, title: `${n} ${plural(n, 'check-in')} still to do`,
      line: `${titles(due)}. ${n === 1 ? 'It counts' : 'They count'} for week ${f.week} until Sunday.`, action, also, ring, about: null };
  }
  if (review) {
    return { kind: 'check-in', eyebrow: `${review.name} is today`, warn: false, title: `${n} ${plural(n, 'check-in')} to do before it`,
      line: `The review reads them as you post them. The workspace’s own deadline is ${longDay(dueDate)}. About ${minutes} ${plural(minutes, 'minute')}.`, action, also, ring, about: null };
  }
  return { kind: 'check-in', eyebrow: `Check-ins are due by ${longDay(dueDate)}${when}`, warn: false, title: `${n} ${plural(n, 'check-in')} to do`,
    line: `${titles(due)}. About ${minutes} ${plural(minutes, 'minute')}.`, action, also, ring, about: null };
}

function reviewLead(f: HomeFacts, x: HomeSession): Lead {
  const past = x.date < f.today;
  const allIn = f.checkIns.total > 0 && f.checkIns.done >= f.checkIns.total;
  const eyebrow = past ? `Not held yet · ${x.name} was on ${longDay(x.date)}` : `${x.name} is today${allIn ? ` · your ${f.checkIns.total} ${plural(f.checkIns.total, 'check-in')} ${f.checkIns.total === 1 ? 'is' : 'are'} in` : ''}`;
  const title = x.discuss ? `${x.discuss} ${plural(x.discuss, 'goal')} to discuss` : `${x.healthy} with nothing flagged to mark reviewed`;
  const line = past
    ? `Hold it now, or it closes when next week starts${x.nextDate ? ` and these carry to ${longDay(x.nextDate)}` : ''}.`
    : x.discuss && x.healthy ? `${x.healthy} more ${x.healthy === 1 ? 'has' : 'have'} nothing flagged: mark them together at the end.` : 'Worst and stalest first, one at a time.';
  const action = x.started && x.nextGoal ? { label: `Continue: ${x.nextGoal.title}`, to: `/goals/${x.nextGoal.id}?review=${x.id}` } : { label: x.done ? 'Continue the review' : 'Open the review', to: `/reviews/${x.id}` };
  return { kind: 'review', eyebrow, warn: past, title, line, action, also: null, ring: { done: x.done, total: x.total, counts: 'reviewed' }, about: x.id };
}

/** Rule 2: what is asked of the viewer today, the first candidate that holds, or null (then the quiet line). */
export function homeLead(f: HomeFacts): Lead | null {
  const due = f.checkIns.due.length;
  // 10: late.
  if (f.rhythm && due && f.today > f.rhythm.dueDate) return checkInLead(f, true);
  // 30: due within LEAD_DAYS, a draft kept, or a review the viewer is in is today and will read them.
  if (f.rhythm && due && (dayDiff(f.today, f.rhythm.dueDate) <= LEAD_DAYS || f.checkIns.draft || f.sessions.some((x) => x.date === f.today && !x.held))) return checkInLead(f, false);
  // 40: the wrap-up, once no check-in is still to do this week (Monday 21 Dec with two to do has no lead: the wrap-up is a cell).
  if (f.wrap && f.wrap.left.length && !(f.rhythm && due)) {
    const n = f.wrap.left.length;
    return { kind: 'wrap-up', eyebrow: f.wrap.ended ? `${f.cycleName} has ended` : `${f.cycleName} ends on ${longDay(f.wrap.ends)}`, warn: false,
      title: n === 1 ? 'Wrap up your goal' : `Wrap up your ${n} goals`, line: 'How each one landed, one thing you learned, and whether it carries on. About a minute each.',
      action: { label: 'Start the wrap-up', to: `/retro/${f.wrap.left[0]!.id}` }, also: null, ring: { done: f.wrap.total - n, total: f.wrap.total, counts: 'wrapped' }, about: null };
  }
  // 50: a review the viewer is in, on or past its day this week, not held.
  const session = f.sessions.filter((x) => x.date <= f.today && !x.held && x.done < x.total).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))[0];
  if (session) return reviewLead(f, session);
  return null;
}

/** Section 2.1's quiet line: what Home says when nothing is asked of the viewer today. Never "You’re all set". */
export function quietLine(f: HomeFacts): Quiet {
  const sentence = 'Nothing is asked of you today.';
  if (f.starts) return { sentence, line: `${f.cycleName} starts on ${longDay(f.starts.on)}. The first check-ins are due by ${longDay(f.starts.firstDue)}.`, buttons: [] };
  if (f.ended) return { sentence, line: `${f.cycleName} has ended.`, buttons: [] };
  const c = f.checkIns;
  if (f.rhythm && c.due.length) return { sentence, line: `Check-ins for week ${f.week} are due by ${longDay(f.rhythm.dueDate)}. You have ${c.due.length} to do.`, buttons: [{ label: 'Check in early', to: '/check-in' }] };
  if (f.rhythm && c.total > 0 && c.done >= c.total) {
    const allIn = c.total === 1 ? 'Your check-in is' : c.total === 2 ? 'Both check-ins are' : `All ${c.total} check-ins are`;
    const streak = c.allInOnTimeToday && (c.streak ?? 0) >= 2 ? `That is ${c.streak} weeks in a row on time. ` : '';
    const next = f.rhythm.nextDueDate && f.week < f.lastWeek ? `The next ${c.total === 1 ? 'is' : 'are'} due by ${longDay(f.rhythm.nextDueDate)}.` : '';
    return { sentence: `${allIn} in for week ${f.week}.`, line: (streak + next).trim() || null, buttons: [] };
  }
  if (!f.owns && !f.watches && !f.asks) return { sentence, line: `You don’t own or watch a goal in ${f.workspace} yet.`, buttons: [{ label: 'See the goals', to: '/goals?scope=all' }, { label: 'Set up a goal', to: '/goals/new' }] };
  // Set up after this week's deadline: the first check-in is next week's, said plainly.
  if (f.rhythm && c.total > 0 && !c.done && f.rhythm.nextDueDate) return { sentence, line: `Your first ${plural(c.total, 'check-in is', 'check-ins are')} due by ${longDay(f.rhythm.nextDueDate)}.`, buttons: [] };
  return { sentence, line: null, buttons: [] };
}

/** Rule 1: Home's plan. The lead, or the quiet line when there is none: never both, and the screen draws only these. */
export function homeFor(f: HomeFacts): HomePlan {
  const lead = homeLead(f);
  return { lead, quiet: lead ? null : quietLine(f) };
}
