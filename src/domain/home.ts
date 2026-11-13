/* Home at a glance (Lane's notes, 5 Nov): your goals by status, your on-time streak, the goals you watch that need
   attention, and your next review. Worked out once, for Home and for the AI assistant's "what needs me". */
import { attentionFor, needsAttention, type GoalAttention } from './attention';
import { daysSince, hasEnded } from './plan';
import { onTimeStreak, WEEKDAY } from './progress';
import { daysPast, reviewSession, sessionDate, upcomingSessionWeek, watchedGoals } from './review';
import { goalStatus } from './status';
import { statusCounts } from './order';
import type { AskKind, Cycle, DisplayStatus, Goal, Snapshot } from './types';

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
  return nextReviews(personId, s, cycle, week, today)[0] ?? null;
}

/** The next session of every review the person takes part in, soonest first: two on one day are both here (HM1 review). */
export function nextReviews(personId: string, s: Pick<Snapshot, 'reviews'>, cycle: Cycle, week: number, today: Date): NextReview[] {
  return s.reviews.filter((r) => r.people.includes(personId)).map((r) => {
    const w = upcomingSessionWeek(r, cycle, week, today);
    const date = sessionDate(r, cycle, w);
    return { id: r.id, name: r.name, week: w, date, weekday: WEEKDAY[r.weekday] ?? '', days: 0 - daysSince(date, today) + 0 };
  }).filter((x) => x.week <= cycle.weeks).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** A session of a review the person is in, past its date this week and not held (re-review, 8 Nov, backlog T). */
export interface MissedReview { id: string; name: string; week: number; date: string; daysPast: number }

/** This week's sessions the person is in that are past their date and not held, longest past first; none once the cycle has ended. */
export function missedReviews(personId: string, s: Snapshot, cycle: Cycle, week: number, today: Date): MissedReview[] {
  // Once the year has ended its last week stays the current one, but no session is still to hold (build review of #305).
  if (hasEnded(cycle, today)) return [];
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
  /** Every review's next session, soonest first (`next` is the first), so a second review on the same day isn't lost. */
  upcoming: NextReview[];
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
    ...(() => { const upcoming = nextReviews(personId, s, cycle, week, today); return { next: upcoming[0] ?? null, upcoming }; })(),
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
  wrap: { name?: string; ends: string; ended: boolean; left: { id: string; title: string }[]; total: number } | null;
  sessions: HomeSession[];
  owns: number;
  watches: number;
  /** Rule 3: the open asks waiting on the viewer, in rule 3's order. */
  asks: Waiting[];
}

export type LeadKind = 'check-in-late' | 'check-in' | 'wrap-up' | 'review' | 'ask';
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
  /** The review (or, for an ask, the ask) the lead is about, so its cell or row is left out. */
  about: string | null;
}
export interface Quiet { sentence: string; line: string | null; buttons: { label: string; to: string }[] }
export interface HomePlan { lead: Lead | null; quiet: Quiet | null; /** Rule 3's asks, without the one the lead says. */ asks: Waiting[] }

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
    return { kind: 'wrap-up', eyebrow: f.wrap.ended ? `${f.wrap.name ?? f.cycleName} has ended` : `${f.wrap.name ?? f.cycleName} ends on ${longDay(f.wrap.ends)}`, warn: false,
      title: n === 1 ? 'Wrap up your goal' : `Wrap up your ${n} goals`, line: 'How each one landed, one thing you learned, and whether it carries on. About a minute each.',
      action: { label: 'Start the wrap-up', to: `/retro/${f.wrap.left[0]!.id}` }, also: null, ring: { done: f.wrap.total - n, total: f.wrap.total, counts: 'wrapped' }, about: null };
  }
  // 50: a review the viewer is in, on or past its day this week, not held.
  const session = f.sessions.filter((x) => x.date <= f.today && !x.held && x.done < x.total).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))[0];
  if (session) return reviewLead(f, session);
  // 60: the oldest or most pressing thing waiting on the viewer (rule 3's order puts it first).
  return askLead(f.asks[0]);
}

/** Section 2.1's quiet line: what Home says when nothing is asked of the viewer today. Never "You’re all set". */
export function quietLine(f: HomeFacts): Quiet {
  // While asks wait on the viewer ("Needs your response"), Home doesn't say nothing is asked (HM1 review).
  const sentence = f.asks.length ? `${f.asks.length === 1 ? 'One ask waits' : `${f.asks.length} asks wait`} for your response.` : 'Nothing is asked of you today.';
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
  if (!f.owns && !f.watches && !f.asks.length) return { sentence, line: `You don’t own or watch a goal in ${f.workspace} yet.`, buttons: [{ label: 'See the goals', to: '/goals?scope=all' }, { label: 'Set up a goal', to: '/goals/new' }] };
  // Set up after this week's deadline: the first check-in is next week's, said plainly.
  if (f.rhythm && c.total > 0 && !c.done && f.rhythm.nextDueDate) return { sentence, line: `Your first ${plural(c.total, 'check-in is', 'check-ins are')} due by ${longDay(f.rhythm.nextDueDate)}.`, buttons: [] };
  return { sentence, line: null, buttons: [] };
}

/** Rule 1: Home's plan. The lead, or the quiet line when there is none: never both, and the screen draws only these. */
export function homeFor(f: HomeFacts): HomePlan {
  const lead = homeLead(f);
  return { lead, quiet: lead ? null : quietLine(f), asks: f.asks.filter((w) => !(lead?.kind === 'ask' && lead.about === w.askId)) };
}

/* ---------- An ask that waits (HM2: docs/design/home/spec.md rule 3) ---------- */

/** What rule 3 reads about one open ask waiting on the viewer. The app layer gives the dates (home's facts). */
export interface AskFacts {
  id: string;
  kind: AskKind;
  /** Who asked, by first name; null when it is the viewer's own (a next step they agreed). */
  by: string | null;
  goals: { id: string; title: string }[];
  said: string;
  /** yyyy-mm-dd. */
  askedOn: string;
  /** Its own due week: the week, its Sunday and its dates ("16–22 Nov"). */
  dueWeek: { week: number; sunday: string; dates: string } | null;
  /** A question raised in a review: the review, and the first session after the one it was raised in (fixed when asked). */
  session: { name: string; date: string } | null;
  /** The review it was raised in, if any (said only while Reviews is on). */
  where: string | null;
  /** Who it was asked of before it came to the viewer with a goal they now own (domain/askHandover), if it did. */
  was?: string | null;
}

export interface Waiting {
  askId: string; kind: AskKind; by: string | null; where: string | null; goals: { id: string; title: string }[]; said: string; askedOn: string; waitedDays: number;
  /** "Asked of Tunde, now yours": who it was asked of, when it came with a goal. */
  was: string | null;
  due: { date: string; why: 'week' | 'session' } | null; late: boolean; dueThisWeek: boolean;
  /** Said after who asked and when; `warn` puts the warning mark before it. */
  line: string; warn: boolean;
  /** Where its one button goes. */
  to: string;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Tue 10 Nov". */
const shortDay = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return `${SHORT_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`; };
/** "4 Aug". */
const dayMonth = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`; };
/** The week's Monday and Sunday around a day. */
function weekAround(today: string): { monday: string; sunday: string } {
  const d = new Date(today + 'T00:00:00Z');
  const back = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
  return { monday, sunday: new Date(Date.parse(monday + 'T00:00:00Z') + 6 * 86_400_000).toISOString().slice(0, 10) };
}

/** Rule 3: how long an ask has waited, when it is due, whether it is late, and the line that says so. */
export function waiting(a: AskFacts, today: string): Waiting {
  const waitedDays = Math.max(0, dayDiff(a.askedOn, today));
  const due = a.dueWeek ? { date: a.dueWeek.sunday, why: 'week' as const } : a.session ? { date: a.session.date, why: 'session' as const } : null;
  const late = !!due && today > due.date;
  const { monday, sunday } = weekAround(today);
  const dueThisWeek = !!due && !late && due.date >= monday && due.date <= sunday;
  let line: string;
  let warn = false;
  if (late && due!.why === 'week') { line = `Was due week ${a.dueWeek!.week} (${a.dueWeek!.dates})`; warn = true; }
  // Short enough to show whole on a phone's one line; the review is named after it ("asked in …"; build review of #310).
  else if (late) { line = `Was due by ${shortDay(a.session!.date)}`; warn = true; }
  else if (due?.why === 'session' && dayDiff(today, due.date) <= 1) { line = dayDiff(today, due.date) === 0 ? 'Due before today’s session' : 'Due before tomorrow’s session'; warn = true; }
  else if (due?.why === 'week' && dueThisWeek) line = `Due this week (${a.dueWeek!.dates})`;
  else if (due?.why === 'week') line = `Due week ${a.dueWeek!.week} (${a.dueWeek!.dates})`;
  else if (due) line = `Before its next session, ${shortDay(due.date)}`;
  else if (waitedDays >= 7) line = `Waiting since ${dayMonth(a.askedOn)}, ${waitedDays < 14 ? `${waitedDays} days` : `${Math.floor(waitedDays / 7)} weeks`}`;
  else line = waitedDays === 0 ? 'Asked today' : waitedDays === 1 ? 'Asked yesterday' : `Asked on ${LONG_DAYS[new Date(a.askedOn + 'T00:00:00Z').getUTCDay()]}`;
  const to = a.kind === 'update' ? `/check-in/${a.goals[0]!.id}` : `/goals/${a.goals[0]!.id}?respond=${a.id}`;
  return { askId: a.id, kind: a.kind, by: a.by, where: a.where, goals: a.goals, said: a.said, askedOn: a.askedOn, waitedDays, was: a.was ?? null, due, late, dueThisWeek, line, warn, to };
}

const KIND_ORDER: AskKind[] = ['decision', 'question', 'update', 'action'];
/** Rule 3's order (it replaces "overdue first, then newest"): late; due this week; no date and waited 7 days or more, oldest first; the rest, newest first. Within each, decisions, questions, updates, next steps. */
export function waitingOrder(a: Waiting, b: Waiting): number {
  const tier = (w: Waiting) => (w.late ? 0 : w.dueThisWeek ? 1 : !w.due && w.waitedDays >= 7 ? 2 : 3);
  const t = tier(a) - tier(b);
  if (t) return t;
  const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  if (k) return k;
  return tier(a) === 2 ? a.askedOn.localeCompare(b.askedOn) : b.askedOn.localeCompare(a.askedOn);
}

const ASK_TITLE: Record<AskKind, (by: string) => string> = { decision: (by) => `${by} needs a decision`, question: (by) => `${by} asked a question`, update: (by) => `${by} asked for an update`, action: () => 'A next step you agreed is due' };
const ASK_ACTION: Record<AskKind, string> = { decision: 'Respond', question: 'Answer', update: 'Check in', action: 'Mark done' };

/** Rank 60: the first waiting ask, when it is late, due this week, or has waited a week or more with no date. */
export function askLead(w: Waiting | undefined): Lead | null {
  if (!w || !(w.late || w.dueThisWeek || (!w.due && w.waitedDays >= 7))) return null;
  const others = w.goals.length - 1;
  const about = w.goals.length > 1 ? `${w.goals.length} goals are waiting on it: ${w.goals[0]!.title}, and ${others} more.` : `About ${w.goals[0]?.title ?? 'a goal'}.`;
  return { kind: 'ask', eyebrow: `Needs your response · ${w.line.charAt(0).toLowerCase()}${w.line.slice(1)}`, warn: w.warn, title: ASK_TITLE[w.kind](w.by ?? 'Someone'),
    line: `“${w.said}”. ${about}`, action: { label: ASK_ACTION[w.kind], to: w.to }, also: null, ring: null, about: w.askId };
}
