/* What needs someone's attention, and why. One list drives the homes, the goals list and the review.
   "Needs attention" means new information: a goal that is behind but that someone has looked at since its latest
   check-in (reviewed, noted, an action agreed, or its request answered) is being handled until something new happens. */
import { assessMetric, assessMilestone, assessRange, checkInsFor, goalStatus, LABEL, type GoalStatus } from './status';
import { fmt, rangeText, weekLabel } from './format';
import { isShare } from './checkin';
import { currentWeek } from './plan';
import { answeredSince, isOverdue, openAsksFor } from './asks';
import type { CheckIn, Cycle, Decision, Goal, Snapshot } from './types';

export type FlagKind = 'off' | 'missed-path' | 'stale' | 'no-path' | 'risk' | 'trend' | 'greener' | 'due';

export interface Flag {
  kind: FlagKind;
  /** Short label for a chip. */
  label: string;
  /** One sentence: what is wrong, in numbers where there are numbers. */
  detail: string;
  tone: 'off' | 'risk' | 'stale' | 'info';
}

export interface GoalAttention {
  goal: Goal;
  status: GoalStatus;
  flags: Flag[];
  /** Higher needs attention sooner. */
  weight: number;
  /** Behind, but someone has looked since the latest check-in and nothing new has happened since: what's in hand. */
  handled: Handled | null;
}

/** What's in hand for a goal that is behind: the latest look at it since its latest check-in. */
export interface Handled {
  kind: 'action' | 'answered' | 'noted' | 'reviewed';
  /** One line: "Action: Maya, due week 47", "Reviewed in Platform weekly review, week 44". */
  text: string;
  /** What was said: the action, the note or the answer (empty for a plain "reviewed"). */
  said: string;
  byId: string;
  at: string;
  week: number;
  reviewId: string | null;
}

const WEIGHT: Record<FlagKind, number> = { off: 100, 'missed-path': 90, stale: 80, 'no-path': 70, risk: 60, trend: 50, greener: 30, due: 10 };

/**
 * A worsening trend the status may not show yet: progress against plan has fallen at the
 * last two check-ins, a range value has moved towards its limit twice running, or a
 * milestone stage's expected week has slipped since the previous check-in.
 */
export function worseningTrend(goal: Goal, cycle: Cycle, checkIns: CheckIn[]): string | null {
  const own = checkInsFor(goal, checkIns);
  if (goal.kind === 'metric') {
    const pts = own.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
    if (pts.length < 3) return null;
    const ratios = pts.slice(-3).map((p, i, arr) => assessMetric(goal, cycle.weeks, p.week, p.value, pts.slice(0, pts.length - arr.length + i)).ratio);
    const [a, b, c] = ratios;
    if (a == null || b == null || c == null) return null;
    if (c < b && b < a && c < 1) return `Progress against plan has fallen two check-ins running: ${Math.round(a * 100)}% → ${Math.round(b * 100)}% → ${Math.round(c * 100)}%.`;
    const last = assessMetric(goal, cycle.weeks, pts[pts.length - 1]!.week, pts[pts.length - 1]!.value, pts.slice(0, -1));
    if (last.forecastMisses && last.projection && last.calc === 'on') return `On track today, but the recent trend heads for ${rangeText(last.projection, goal, isShare(goal))} by week ${last.projection.week}, against a target of ${fmt(goal.plan.target, goal)}.`;
    return null;
  }
  if (goal.kind === 'range') {
    const v = own.filter((c) => c.value != null).map((c) => c.value as number).slice(-3);
    if (v.length < 3) return null;
    const toward = goal.range.bound === 'atMost' ? (x: number, y: number) => y > x : (x: number, y: number) => y < x;
    if (toward(v[0]!, v[1]!) && toward(v[1]!, v[2]!) && !assessRange(goal, 1, v[2]!, v[1]!).out) {
      return `Moving towards the limit two weeks running: ${v.map((x) => fmt(x, goal)).join(' → ')} (limit ${fmt(goal.range.limit, goal)}).`;
    }
    return null;
  }
  const withStages = own.filter((c) => c.stages);
  if (withStages.length < 2) return null;
  const prev = withStages[withStages.length - 2]!, last = withStages[withStages.length - 1]!;
  const before = assessMilestone(goal, prev.week, prev.stages), now = assessMilestone(goal, last.week, last.stages);
  const slipped = now.stages.find((s, i) => s.kind !== 'done' && s.expectedWeek > (before.stages[i]?.expectedWeek ?? s.expectedWeek));
  return slipped ? `${slipped.name} slipped to ${weekLabel(slipped.expectedWeek, cycle.weeks)} at the last check-in.` : null;
}

function flagsFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date): { status: GoalStatus; flags: Flag[] } {
  const status = goalStatus(goal, cycle, s.checkIns, today);
  const { latest, week } = status;
  const flags: Flag[] = [];
  const add = (kind: FlagKind, label: string, detail: string, tone: Flag['tone']) => flags.push({ kind, label, detail, tone });
  const ptg = latest?.pathToGreen ?? null;
  const behind = status.status === 'off' || status.status === 'risk';

  if (status.status === 'off') add('off', 'Off track', latest?.why && latest.why !== 'On plan.' ? latest.why : 'The owner called it off track.', 'off');
  if (status.status === 'stale') {
    add('stale', LABEL.stale, latest ? `No check-in for ${status.daysSinceCheckIn} days; the last was week ${latest.week} (${LABEL[latest.status].toLowerCase()}).` : 'No check-in yet this cycle.', 'stale');
  }
  if (behind && ptg && ptg.byWeek != null && ptg.byWeek < week) add('missed-path', 'Missed path to green', `Was due back on plan by week ${ptg.byWeek}: ${ptg.what}`, 'off');
  if (behind && !ptg) add('no-path', 'No path to green', 'It is behind and the owner has not said how it gets back.', 'off');
  if (status.status === 'risk') add('risk', 'At risk', latest?.why && latest.why !== 'On plan.' ? latest.why : 'The owner called it at risk.', 'risk');
  const trend = status.status === 'done' ? null : worseningTrend(goal, cycle, s.checkIns);
  if (trend) add('trend', 'Worsening trend', trend, 'risk');
  if (status.greener && latest && status.status !== 'stale') add('greener', 'Greener than calculated', `Called ${LABEL[latest.status].toLowerCase()}; the numbers say ${LABEL[latest.calculated].toLowerCase()}. ${latest.greenerWhy}`, 'risk');
  if (week >= 1 && status.status !== 'done' && !checkInsFor(goal, s.checkIns).some((c) => c.week === week)) add('due', 'Check-in due', `Due before the review in week ${week}.`, 'info');

  flags.sort((a, b) => WEIGHT[b.kind] - WEIGHT[a.kind]);
  return { status, flags };
}

export function attentionFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date): GoalAttention {
  const { status, flags } = flagsFor(goal, s, cycle, today);
  return { goal, status, flags, weight: flags.reduce((m, f) => Math.max(m, WEIGHT[f.kind]), 0), handled: handledFor(goal, s, cycle, today, status, flags) };
}

/** The kinds of look that put a behind goal in hand, strongest first. */
const HANDLED_ORDER: Handled['kind'][] = ['action', 'answered', 'noted', 'reviewed'];
const LOOKS: Partial<Record<Decision['kind'], Handled['kind']>> = { note: 'noted', acknowledge: 'reviewed' };

/**
 * Whether a goal that is off track or at risk is being handled, and by what. It is when, since its latest check-in,
 * someone other than the owner marked it reviewed or added a note, an action was agreed (and isn't overdue), or a
 * request it's waiting on was answered; and no flag has appeared since that look (a missed recovery date, say). A new
 * check-in always makes it news again, so it needs attention until someone looks at that.
 */
export function handledFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date, status = goalStatus(goal, cycle, s.checkIns, today), flags?: Flag[]): Handled | null {
  if (status.status !== 'off' && status.status !== 'risk') return null;
  const latest = status.latest;
  if (!latest) return null;
  const since = latest.postedAt;
  const week = currentWeek(cycle, today);
  const first = (id: string | null | undefined) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  // Records dated after today (a pinned demo clock) don't count yet; the time of day doesn't matter.
  const day = today.toISOString().slice(0, 10);
  const looks: Handled[] = [];
  for (const d of s.decisions) {
    const kind = LOOKS[d.kind];
    if (!kind || d.goalId !== goal.id || d.at <= since || d.at.slice(0, 10) > day) continue;
    if (d.byId === goal.ownerId) continue;
    const review = d.reviewId ? s.reviews.find((r) => r.id === d.reviewId)?.name : null;
    const where = review ? `in ${review}` : `by ${first(d.byId)}`;
    looks.push({ kind, text: `${kind === 'noted' ? 'Noted' : 'Reviewed'} ${where}, week ${d.week}`, said: kind === 'reviewed' ? '' : d.note, byId: d.byId, at: d.at, week: d.week, reviewId: d.reviewId });
  }
  // An action agreed since, still open: in hand until it's done, or until its week passes (then it's news).
  for (const a of openAsksFor(goal.id, s, ['action'])) {
    if (a.createdAt <= since || a.createdAt.slice(0, 10) > day || isOverdue(a, week)) continue;
    looks.push({ kind: 'action', text: `Action: ${first(a.recipientId ?? goal.ownerId)}${a.dueWeek != null ? `, due week ${a.dueWeek}` : ''}`, said: a.ask, byId: a.askedBy, at: a.createdAt, week: a.week ?? currentWeek(cycle, new Date(a.createdAt)), reviewId: a.reviewId });
  }
  const answer = answeredSince(goal.id, since, s);
  if (answer?.answeredAt && answer.answeredAt.slice(0, 10) <= day) {
    const w = currentWeek(cycle, new Date(answer.answeredAt));
    looks.push({ kind: 'answered', text: `Request answered by ${first(answer.answeredBy)}, week ${w}`, said: answer.answer ?? '', byId: answer.answeredBy ?? '', at: answer.answeredAt, week: w, reviewId: null });
  }
  if (!looks.length) return null;
  // Anything flagged now that wasn't when someone first looked is new information.
  const firstLook = looks.reduce((a, b) => (a.at < b.at ? a : b));
  const now = (flags ?? flagsFor(goal, s, cycle, today).flags).filter((f) => f.kind !== 'due').map((f) => f.kind);
  const then = new Set(flagsFor(goal, s, cycle, new Date(firstLook.at)).flags.map((f) => f.kind));
  if (now.some((k) => !then.has(k))) return null;
  return looks.sort((a, b) => HANDLED_ORDER.indexOf(a.kind) - HANDLED_ORDER.indexOf(b.kind) || b.at.localeCompare(a.at))[0]!;
}

/** Needs attention: flagged for something beyond a due check-in, and not already in hand. */
export const needsAttention = (a: GoalAttention) => !a.handled && a.flags.some((f) => f.kind !== 'due');

/** A list of goals' attention split into what needs attention (new information) and what is being handled. */
export function splitAttention(list: GoalAttention[]): { needs: GoalAttention[]; handled: GoalAttention[] } {
  return { needs: list.filter((a) => !a.handled), handled: list.filter((a) => !!a.handled) };
}

/**
 * Everything flagged, worst first, with the goals being handled after the ones that need attention (split them with
 * splitAttention). Goals with only a due check-in are left out unless asked.
 */
export function attentionList(s: Snapshot, cycle: Cycle, today: Date, opts: { includeDue?: boolean; goals?: Goal[] } = {}): GoalAttention[] {
  return (opts.goals ?? s.goals)
    .map((g) => attentionFor(g, s, cycle, today))
    .filter((a) => a.flags.some((f) => opts.includeDue || f.kind !== 'due'))
    .sort(attentionOrder);
}

/** Needs attention before being handled; then worst first, then by name. */
export const attentionOrder = (a: GoalAttention, b: GoalAttention) => Number(!!a.handled) - Number(!!b.handled) || b.weight - a.weight || a.goal.title.localeCompare(b.goal.title);
