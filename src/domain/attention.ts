/* What needs someone's attention, and why. One list drives the homes, the goals list and the review.
   "Needs attention" means new information: a goal that is behind but that someone has looked at since its latest
   check-in (reviewed, noted, an action agreed, or its request answered) is being handled until something new happens. */
import { checkInsFor, goalStatus, type GoalStatus } from './status';
import { askText, answeredSince, isOverdue, openAsksFor, openFor } from './asks';
import { dueWords, firstDueWeek } from './progress';
import { currentWeek, hasEnded } from './plan';
import { goalTrend } from './trend';
import { ATTENTION_FLAGS, FLAG, LABEL, lower, type FlagKind } from './vocabulary';
import type { Cycle, Decision, Goal, Snapshot } from './types';
import { NO_REASON } from './checkin';

export type { FlagKind };

export interface Flag {
  kind: FlagKind;
  /** Short label for a chip: the flag's word in the vocabulary. */
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
  /** Behind, with an agreed action (an owner and a date) or an answered request since the latest check-in: what's in hand. */
  handled: Handled | null;
  /** Someone other than the owner marked it reviewed or noted it since its latest check-in. A quiet line only: it
      doesn't put the goal in hand (Lane, 10 Nov), so a goal looked at still needs attention. */
  lookedAt: Handled | null;
}

/**
 * What's in hand for a goal that is behind (`action`, `answered`), or the latest look at it (`noted`,
 * `reviewed`), since its latest check-in.
 */
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

/** Worst first, by the vocabulary's order of the flags that need attention; a check-in due last. */
const WEIGHT: Record<FlagKind, number> = Object.fromEntries([...ATTENTION_FLAGS, 'due' as const].map((k, i, all) => [k, (all.length - i) * 10])) as Record<FlagKind, number>;

/** A worsening trend the status may not show yet (domain/trend.ts, the one trend rule): its sentence, or null. */
export function worseningTrend(goal: Goal, cycle: Cycle, checkIns: Snapshot['checkIns']): string | null {
  const t = goalTrend(goal, cycle, checkIns);
  return t.word === 'worse' ? t.detail : null;
}

export function flagsFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date): { status: GoalStatus; flags: Flag[] } {
  const status = goalStatus(goal, cycle, s.checkIns, today);
  const { latest, week } = status;
  const flags: Flag[] = [];
  const add = (kind: FlagKind, detail: string, tone: Flag['tone']) => flags.push({ kind, label: FLAG[kind].label, detail, tone });
  const ptg = latest?.pathToGreen ?? null;
  const behind = status.status === 'off' || status.status === 'risk';

  const why = latest?.why && latest.why !== NO_REASON ? latest.why : null;
  if (status.status === 'off') add('off', why ?? `The owner called it ${lower(FLAG.off)}.`, 'off');
  if (status.status === 'stale') add('stale', latest ? `No check-in for ${status.daysSinceCheckIn} days; the last was week ${latest.week} (${LABEL[latest.status].toLowerCase()}).` : 'No check-in this cycle yet.', 'stale');
  if (behind && ptg && ptg.byWeek != null && ptg.byWeek < week) add('missed-path', `Said it would be back on plan by week ${ptg.byWeek}: ${ptg.what}`, 'off');
  // Waiting on someone: an open decision or help it needs (its own, or one it's linked to), whatever its status.
  const waiting = status.status !== 'done' ? openFor(goal.id, s) : [];
  if (waiting.length) add('decision', `Waiting on ${waiting.map((r) => askText(r, s.people)).join('; ')}.`, behind ? 'off' : 'risk');
  if (behind && !ptg) add('no-path', 'It is behind and the owner has not said how it gets back.', 'off');
  if (status.status === 'risk') add('risk', why ?? `The owner called it ${lower(FLAG.risk)}.`, 'risk');
  const trend = status.status === 'done' || status.unmeasured ? null : worseningTrend(goal, cycle, s.checkIns);
  if (trend) add('trend', trend, 'risk');
  // A done goal is finished: how it was called on the way there is no longer news (re-review, 8 Nov, backlog T).
  if (status.greener && latest && status.status !== 'stale' && status.status !== 'done') add('greener', `Called ${LABEL[latest.status].toLowerCase()}; the numbers say ${LABEL[latest.calculated].toLowerCase()}. ${latest.greenerWhy}`, 'risk');
  // Nothing is due once the cycle's last day is past (cycle-end rule 2). The flag's words are dueWords' (RS1), the same
  // with Reviews on or off. A goal held to no number (domain/unmeasured) has nothing due: it lists under its metric's
  // "To sort out" instead.
  if (!status.unmeasured && week >= Math.max(1, firstDueWeek(goal, cycle)) && status.status !== 'done' && !hasEnded(cycle, today) && !checkInsFor(goal, s.checkIns).some((c) => c.week === week)) add('due', dueWords(false, cycle, week).flag, 'info');

  flags.sort((a, b) => WEIGHT[b.kind] - WEIGHT[a.kind]);
  return { status, flags };
}

export function attentionFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date): GoalAttention {
  const { status, flags } = flagsFor(goal, s, cycle, today);
  return { goal, status, flags, weight: flags.reduce((m, f) => Math.max(m, WEIGHT[f.kind]), 0), handled: handledFor(goal, s, cycle, today, status, flags), lookedAt: lookedAtFor(goal, s, cycle, today, status) };
}

/** The kinds of look, strongest first: an agreed action and an answer put a behind goal in hand; a note or a review mark doesn't. */
const HANDLED_ORDER: Handled['kind'][] = ['action', 'answered', 'noted', 'reviewed'];
const LOOKS: Partial<Record<Decision['kind'], Handled['kind']>> = { note: 'noted', acknowledge: 'reviewed' };

/** Every look at a behind goal since its latest check-in, on or before today's date, in no particular order. */
const byGoal = new WeakMap<Decision[], { n: number; last: Decision | undefined; index: Map<string, Decision[]> }>();
/** A goal's decisions, in the order kept. Indexed once per list (and again if it grows), so asking for every goal stays
    cheap at scale (AX4), as checkInsFor does for check-ins. */
function decisionsFor(goalId: string, all: Decision[]): Decision[] {
  let hit = byGoal.get(all);
  if (!hit || hit.n !== all.length || hit.last !== all[all.length - 1]) {
    const index = new Map<string, Decision[]>();
    for (const d of all) { const l = index.get(d.goalId); if (l) l.push(d); else index.set(d.goalId, [d]); }
    hit = { n: all.length, last: all[all.length - 1], index };
    byGoal.set(all, hit);
  }
  return hit.index.get(goalId) ?? [];
}

function looksAt(goal: Goal, s: Snapshot, cycle: Cycle, today: Date, status: GoalStatus): Handled[] {
  if (status.status !== 'off' && status.status !== 'risk') return [];
  const latest = status.latest;
  if (!latest) return [];
  const since = latest.postedAt;
  const week = currentWeek(cycle, today);
  const first = (id: string | null | undefined) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
  // Records dated after today (a pinned demo clock) don't count yet; the time of day doesn't matter.
  const day = today.toISOString().slice(0, 10);
  const looks: Handled[] = [];
  for (const d of decisionsFor(goal.id, s.decisions)) {
    const kind = LOOKS[d.kind];
    if (!kind || d.goalId !== goal.id || d.at <= since || d.at.slice(0, 10) > day) continue;
    if (d.byId === goal.ownerId) continue;
    const review = d.reviewId ? s.reviews.find((r) => r.id === d.reviewId)?.name : null;
    looks.push({ kind, text: `Looked at by ${first(d.byId)}${review ? ` in ${review}` : ''}, week ${d.week}`, said: kind === 'reviewed' ? '' : d.note, byId: d.byId, at: d.at, week: d.week, reviewId: d.reviewId });
  }
  // An action agreed since, with an owner and a due week, still open: in hand until it's done, or until its week
  // passes (then it's news). An action with no date doesn't put it in hand.
  for (const a of openAsksFor(goal.id, s, ['action'])) {
    if (a.dueWeek == null || a.createdAt <= since || a.createdAt.slice(0, 10) > day || isOverdue(a, week)) continue;
    looks.push({ kind: 'action', text: `Action: ${first(a.recipientId ?? goal.ownerId)}, due week ${a.dueWeek}`, said: a.ask, byId: a.askedBy, at: a.createdAt, week: a.week ?? currentWeek(cycle, new Date(a.createdAt)), reviewId: a.reviewId });
  }
  const answer = answeredSince(goal.id, since, s);
  if (answer?.answeredAt && answer.answeredAt.slice(0, 10) <= day) {
    const w = currentWeek(cycle, new Date(answer.answeredAt));
    looks.push({ kind: 'answered', text: `Request answered by ${first(answer.answeredBy)}, week ${w}`, said: answer.answer ?? '', byId: answer.answeredBy ?? '', at: answer.answeredAt, week: w, reviewId: null });
  }
  return looks;
}

/**
 * Whether a goal that is off track or at risk is being handled, and by what (Lane, 10 Nov). It is when, since its
 * latest check-in, an action was agreed with an owner and a due week (and isn't overdue), or, for a goal at risk, a
 * request it's waiting on was answered; and no flag has appeared since then (a missed recovery date, say). An off-track
 * goal is in hand only with an action. Marking it reviewed or noting it is a look (lookedAtFor), not a plan: the goal
 * still needs attention. A new check-in always makes it news again.
 */
export function handledFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date, status = goalStatus(goal, cycle, s.checkIns, today), flags?: Flag[]): Handled | null {
  const looks = looksAt(goal, s, cycle, today, status).filter((l) => l.kind === 'action' || (l.kind === 'answered' && status.status === 'risk'));
  if (!looks.length) return null;
  // Anything flagged now that wasn't when it was first put in hand is new information.
  const firstLook = looks.reduce((a, b) => (a.at < b.at ? a : b));
  const now = (flags ?? flagsFor(goal, s, cycle, today).flags).filter((f) => f.kind !== 'due').map((f) => f.kind);
  const then = new Set(flagsFor(goal, s, cycle, new Date(firstLook.at)).flags.map((f) => f.kind));
  if (now.some((k) => !then.has(k))) return null;
  return looks.sort((a, b) => HANDLED_ORDER.indexOf(a.kind) - HANDLED_ORDER.indexOf(b.kind) || b.at.localeCompare(a.at))[0]!;
}

/** The latest time someone other than the owner marked a behind goal reviewed or noted it since its latest check-in: "Looked at by Amara in …". */
export function lookedAtFor(goal: Goal, s: Snapshot, cycle: Cycle, today: Date, status = goalStatus(goal, cycle, s.checkIns, today)): Handled | null {
  const looks = looksAt(goal, s, cycle, today, status).filter((l) => l.kind === 'noted' || l.kind === 'reviewed');
  return looks.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/**
 * Needs attention (the vocabulary's ATTENTION.needs): flagged for something beyond a due check-in, and not already in
 * hand. The one rule: Home, Watching, the map's toggle, the Goals filter, reviews, the brief and the AI assistant all
 * ask it, and evals/vocabulary.eval.ts checks they pick the same goals.
 */
export const needsAttention = (a: GoalAttention) => !a.handled && a.flags.some((f) => f.kind !== 'due');

/**
 * Which group of the Needs attention list a goal is in (Lane, 9 Nov, backlog GP): `needs` (needs attention: listed
 * first, and what every count counts), `handled` (being handled: listed below them, never left out), or null (not
 * listed). A goal being handled is always flagged (it is behind), so the list is every goal flagged for something
 * beyond a due check-in. Nothing is hidden: a manager filtering her team sees her goals that are behind even when
 * someone has already looked at them.
 */
export function attentionGroup(a: GoalAttention): 'needs' | 'handled' | null {
  if (needsAttention(a)) return 'needs';
  return a.handled ? 'handled' : null;
}

/**
 * Waiting on a decision or help (the `decision` flag): an open ask on the goal, its own or one it's linked to, and the
 * goal isn't done. The one rule for "Decision or help needed": the Goals filter and the saved view built on it, Table's
 * story line, the Board's order and Home's asks all ask it, so they name the same goals (U25).
 */
export const waitingOnDecision = (a: { flags: Flag[] }) => a.flags.some((f) => f.kind === 'decision');

/** On the Needs attention list: it needs attention, or it is being handled (listed below those that do). */
export const onAttentionList = (a: GoalAttention) => attentionGroup(a) !== null;

/** A list of goals' attention split into what needs attention (new information) and what is being handled. */
export function splitAttention(list: GoalAttention[]): { needs: GoalAttention[]; handled: GoalAttention[] } {
  return { needs: list.filter((a) => attentionGroup(a) === 'needs'), handled: list.filter((a) => attentionGroup(a) === 'handled') };
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
