/* The flagship goal page (approved by Lane, 5 Nov): what each part of it says, worked out once. Pure, so the page, its
   shared image and the tests read the same words. Status, check-in, ask and review rules are not restated here:
   each part asks the module that owns its rule (status, attention, asks, review, summaryFacts, plan).

   The page answers, in order: what is this goal and who owns it; how is it doing; if badly, why; what is being done and
   how those actions are going; where it is heading; what has happened, and what was said the last time it was discussed.
   Each fact has one home on it (the plan's "one home for each fact" table). */
import type { GoalAttention } from './attention';
import { fmt, NO_VALUE, staysText } from './format';
import { currentWeek, daysSince, weekDate, goalAsOf, planAt, planEnd, projectionFor, valueSeries } from './plan';
import { onTimeStreak, reviewDate, WEEKDAY } from './progress';
import { asksOf, canAnswer, canMarkDone, canWithdraw, isOverdue, isResolved, liveNotes, openAsksFor, writtenNotes } from './asks';
import { dayText, goalsIn, saidIn, sessionDate, sessionWeek, type Said } from './review';
import { assessPosted, checkInsFor, LABEL, RANK } from './status';
import { countWord, summaryFacts, type Direction } from './summaryFacts';
import type { Ask, AskKind, Change, CheckIn, Cycle, Decision, DisplayStatus, Goal, Person, Snapshot } from './types';
import { NO_REASON } from './checkin';
import { ASK_KIND, ASK_STATUS, ATTENTION, DECIDED, stagesBehind } from './vocabulary';
import { textMatches } from './find';

const first = (s: Snapshot, id: string | null | undefined) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
const said = (why: string | null | undefined) => !!why && why.trim() !== '' && why !== NO_REASON;
const lower = (k: DisplayStatus) => LABEL[k].toLowerCase();

/* ---------- 1. the summary bar ---------- */

/** Line 2 of the summary bar: the number, against plan and target, in the goal's own units, and which way it's heading. */
export interface BarFigures {
  /** "83%", "2 of 4 stages done", or "No value yet". */
  now: string;
  /** The number itself, for counting up to it. */
  nowValue: number | null;
  /** The rest of line 2: "plan 86%", "target 88%"; "at most 40 tickets", "inside the limit"; "1 stage slipping". */
  against: string[];
  /** Which way it's heading over the last check-ins: the bar's arrow. */
  direction: Direction | null;
  /** The arrow in words, for its label: "1 → 2 → 3 pts behind plan. Falling further behind, weeks 42–44". */
  directionText: string | null;
}

export function barFigures(goal: Goal, s: Snapshot, cycle: Cycle, week: number, stale: boolean): BarFigures {
  const a = assessPosted(goal, cycle, s.checkIns, week);
  const facts = summaryFacts(goal, cycle, s.checkIns, week, stale).facts;
  const trend = facts.find((f) => f.key === 'trend');
  const dir = trend && trend.value !== 'Not enough check-ins yet' ? { direction: trend.direction ?? null, directionText: [trend.value, trend.detail].filter(Boolean).join('. ') } : { direction: null, directionText: null };
  if (goal.kind === 'metric' && a.kind === 'metric') {
    const due = planEnd(goal.plan, cycle.weeks);
    const target = `target ${fmt(goal.plan.target, goal)}${due !== cycle.weeks ? ` by week ${due}` : ''}`;
    if (a.actual == null) return { now: NO_VALUE, nowValue: null, against: [`plan ${fmt(planAt(goal.plan, Math.max(0, week), cycle.weeks), goal)}`, target], direction: null, directionText: null };
    // Gone quiet: the last number is dated, against the plan for now.
    if (stale) return { now: fmt(a.actual, goal), nowValue: a.actual, against: [`in week ${a.week}`, `plan now ${fmt(planAt(goal.plan, week, cycle.weeks), goal)}`, target], direction: null, directionText: null };
    return { now: fmt(a.actual, goal), nowValue: a.actual, against: [`plan ${fmt(a.plan, goal)}`, target], ...dir };
  }
  if (goal.kind === 'range' && a.kind === 'range') {
    const limit = staysText(goal);
    if (a.actual == null) return { now: NO_VALUE, nowValue: null, against: [limit], direction: null, directionText: null };
    const where = a.out ? 'outside the limit' : a.near ? 'inside the limit, near it' : 'inside the limit';
    return { now: fmt(a.actual, goal), nowValue: a.actual, against: stale ? [`in week ${a.week}`, limit] : [limit, where], ...(stale ? { direction: null, directionText: null } : dir) };
  }
  if (goal.kind === 'milestone' && a.kind === 'milestone') {
    const next = a.stages.filter((x) => x.kind !== 'done').sort((x, y) => x.dueWeek - y.dueWeek)[0];
    const against = a.calc === 'done' ? ['every stage done']
      : a.late.length ? [stagesBehind(a.late.map((x) => x.kind as 'risk' | 'off')), ...(next ? [`${next.name}: week ${next.expectedWeek}, due ${next.dueWeek}`] : [])]
      : next ? [`on schedule`, `next: ${next.name}, week ${next.dueWeek}`] : ['on schedule'];
    return { now: `${a.doneCount} of ${a.stages.length} stages done`, nowValue: null, against, ...(stale ? { direction: null, directionText: null } : dir) };
  }
  return { now: NO_VALUE, nowValue: null, against: [], direction: null, directionText: null };
}

/** Line 3 of the summary bar: why it's where it is, and whether anyone is on it. */
export interface WhyLine {
  /** The owner's latest reason (its one home on the page), or the next step or run when it's on plan. */
  text: string | null;
  /** Who said it, and when: "Hana, week 45". */
  by: string | null;
  /** For a goal behind plan: whether someone has picked it up since its latest check-in (attention.ts's rule). */
  handled: 'handled' | 'nobody' | null;
  /** "being handled: Action: Maya, due week 47" or "no response yet". */
  handledText: string | null;
}

export function whyLine(goal: Goal, s: Snapshot, att: GoalAttention): WhyLine {
  const st = att.status;
  const latest = st.latest;
  if (!latest) return { text: st.status === 'stale' ? `${LABEL.stale}: ${lower('none')} this cycle` : LABEL.none, by: null, handled: null, handledText: null };
  // No recent update: the same words as the flag on Home and Watching (attention.ts), so the reason cut short there is here whole.
  if (st.status === 'stale') return { text: (att.flags.find((f) => f.kind === 'stale')?.detail ?? `No check-in for ${st.daysSinceCheckIn} days.`).replace(/\.$/, ''), by: null, handled: null, handledText: null };
  const by = `${first(s, latest.authorId)}, week ${latest.week}`;
  if (st.status === 'off' || st.status === 'risk') {
    const handled = att.handled ? 'handled' as const : 'nobody' as const;
    return {
      text: said(latest.why) ? latest.why : 'No reason given yet',
      by: said(latest.why) ? by : null,
      handled,
      handledText: att.handled ? `${ATTENTION.handled.label.toLowerCase()}: ${att.handled.text}` : 'no response yet',
    };
  }
  if (latest.next) return { text: `Next: ${latest.next}`, by, handled: null, handledText: null };
  if (said(latest.why)) return { text: latest.why, by, handled: null, handledText: null };
  // On plan with nothing more to say: how long it has been where it is, in check-ins.
  const own = checkInsFor(goal, s.checkIns);
  let k = own.length - 1;
  while (k > 0 && own[k - 1]!.status === latest.status) k--;
  const n = own.length - k;
  return { text: n >= 2 ? `The same call ${countWord(n)} check-ins running, since week ${own[k]!.week}` : `Called in week ${latest.week}`, by: null, handled: null, handledText: null };
}

/** The two ways feeders are counted, always labelled, so a goal page and a list card never look contradictory. */
export const FEEDER_SCOPE = { direct: 'Directly feeding it', tree: 'Everything under it' } as const;
/** "Directly feeding it (four goals)", "Everything under it (16 goals)". */
export const feederHead = (scope: keyof typeof FEEDER_SCOPE, n: number) => `${FEEDER_SCOPE[scope]} (${n === 1 ? 'one goal' : `${countWord(n)} goals`})`;

/** For a goal others feed: "Directly feeding it (three goals): 1 off track", on What feeds it. */
export interface FeedsLine { total: number; counts: { status: DisplayStatus; n: number }[]; head: string; text: string }

export function feedsLine(children: Goal[], statusOf: (g: Goal) => DisplayStatus): FeedsLine | null {
  if (!children.length) return null;
  const by = new Map<DisplayStatus, number>();
  for (const c of children) { const k = statusOf(c); by.set(k, (by.get(k) ?? 0) + 1); }
  const worst = (['off', 'risk', 'stale'] as DisplayStatus[]).filter((k) => by.get(k)).map((k) => ({ status: k, n: by.get(k)! }));
  const total = children.length;
  const head = feederHead('direct', total);
  return { total, counts: worst, head, text: worst.length ? `${head}: ${worst.map((x) => `${x.n} ${lower(x.status)}`).join(', ')}` : `${head}, none behind` };
}

/** What goes on the bar's one main button, by who's looking and what's waiting (goal spec, rule 1). */
export type PrimaryKind = 'answer' | 'respond' | 'done' | 'check-in' | 'first-check-in' | 'add-step' | 'ask-update' | null;
export interface Primary { kind: PrimaryKind; label: string; targetId: string | null }

/**
 * The bar's primary action, the first that applies: something asked of you here (a question, then a decision or help);
 * the owner's first check-in, then this week's when it's due; your own open next step; for the owner of a goal behind
 * with no open next step, adding one; for anyone else on a goal gone quiet, asking for an update. Watch is never it.
 */
export function primaryAction(o: {
  goal: Goal; viewer: Person; owner: Person | undefined; status: DisplayStatus; due: boolean; week: number;
  asked: AskedItem[]; updateAsked: boolean;
  /** How many next steps are open on the goal (stepsAndAsks), and whether it has no check-in yet. */
  openSteps?: number; firstDue?: boolean;
}): Primary {
  const ownerFirst = o.owner?.name.split(' ')[0] ?? 'the owner';
  const isOwner = o.viewer.id === o.goal.ownerId;
  const live = !o.goal.stoppedAt && o.status !== 'done';
  // Something waiting on you comes first: answering it is the one thing to do here.
  const question = o.asked.find((x) => x.kind === 'question');
  const request = o.asked.find((x) => x.kind === 'decision');
  const action = o.asked.find((x) => x.kind === 'action');
  if (question) return { kind: 'answer', label: `Answer ${question.fromFirst}’s question`, targetId: question.id };
  if (request) return { kind: 'respond', label: request.fromId === o.viewer.id ? 'Answer your own request' : `Answer ${request.fromFirst}’s request`, targetId: request.id };
  if (isOwner && live && o.week > 0 && o.firstDue) return { kind: 'first-check-in', label: 'Post the first check-in', targetId: null };
  if (isOwner && live && o.week > 0 && o.due) return { kind: 'check-in', label: `Check in for week ${o.week}`, targetId: null };
  if (action) return { kind: 'done', label: 'Mark your next step done', targetId: action.id };
  if (isOwner && live && (o.status === 'off' || o.status === 'risk') && (o.openSteps ?? 0) === 0) return { kind: 'add-step', label: 'Add a next step', targetId: null };
  if (!isOwner && o.status === 'stale' && !o.updateAsked) return { kind: 'ask-update', label: `Ask ${ownerFirst} for an update`, targetId: null };
  return { kind: null, label: '', targetId: null };
}

/** The plain button beside the primary one: the owner's "Check in again", or anyone else's "Watch" / "Watching". */
export type StandingKind = 'check-in-again' | 'watch' | 'watching' | null;
export function standingAction(o: { goal: Goal; viewer: Person; primary: Primary; watching: boolean; status: DisplayStatus }): { kind: StandingKind; label: string } {
  if (o.goal.stoppedAt) return { kind: null, label: '' };
  if (o.viewer.id === o.goal.ownerId) {
    if (o.status === 'done' || o.primary.kind === 'check-in' || o.primary.kind === 'first-check-in') return { kind: null, label: '' };
    return { kind: 'check-in-again', label: 'Check in again' };
  }
  return o.watching ? { kind: 'watching', label: 'Watching' } : { kind: 'watch', label: 'Watch' };
}

/* ---------- 1a. next steps and asks: one list, shown once (goal spec, rule 2) ---------- */

export type StepButton = 'Respond' | 'Answer' | 'Mark done' | 'Check in' | 'Withdraw';
export interface StepRow {
  id: string;
  kind: AskKind;
  /** Line 1: the kind as a word, then the text ("Decision or help: approve the extra CI runner budget"). */
  text: string;
  /** Line 2: who and when ("Asked of Amara by Rhea · 3 weeks ago"; "Amara · by week 47 (Thu 19 Nov) · agreed in …"). */
  line: string;
  /** "Open", "Overdue by 1 week", "Answered", "Done · week 44". */
  state: string;
  overdue: boolean;
  /** Answered or done. */
  settled: boolean;
  /** An answered or done row's answer or note: "Amara: approved for Q4, from the platform reserve." */
  answer: string | null;
  /** The one button for the viewer, if any. */
  button: StepButton | null;
}
export interface StepsAndAsks { forYou: StepRow[]; open: StepRow[]; done: StepRow[]; openCount: number; gap: boolean }

/** What the list reads: the goal's asks and next steps, the people and reviews they name, and the viewer. */
export interface StepsInput {
  goal: Goal; viewer: Person; week: number; cycle: Cycle; status: DisplayStatus;
  asks: readonly Ask[]; people: readonly Pick<Person, 'id' | 'name'>[]; reviews: readonly { id: string; name: string }[];
  /** Whether Reviews is on (FT2): off, a question names no review; a next step still says in words where it was agreed. */
  reviewsOn?: boolean;
}

const KIND_WORD: Record<AskKind, string> = { decision: ASK_KIND.decision.label, question: ASK_KIND.question.label, action: DECIDED['next-step'].label, update: `${ASK_KIND.update.label} asked` };
const ORDER: Record<AskKind, number> = { decision: 1, question: 2, action: 3, update: 4 };
const weeksWord = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;

/** The goal's asks and next steps, from what `reads` gives: `asksOf` on the workspace, filtered to the goal. */
export const asksOnGoal = (goalId: string, s: Pick<Snapshot, 'requests'> & Partial<Snapshot>): Ask[] => asksOf(s as Snapshot).filter((r) => r.goalIds.includes(goalId) && r.status !== 'withdrawn');

/**
 * One list of everything asked and agreed on a goal: open decisions or help, questions, asks for an update and next
 * steps, then what was answered or done, newest first. Each row has at most one button for the viewer, by the asks'
 * own rules (canAnswer, canMarkDone, canWithdraw). `gap`: behind, with no next step open.
 */
export function stepsAndAsks(i: StepsInput): StepsAndAsks {
  const firstName = (id: string | null | undefined) => i.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'someone';
  const isOwner = i.viewer.id === i.goal.ownerId;
  const weekOf = (iso: string) => currentWeek(i.cycle, new Date(iso));
  const ago = (iso: string) => { const n = i.week - weekOf(iso); return n <= 0 ? 'this week' : n === 1 ? 'last week' : `${n} weeks ago`; };
  const by = (w: number) => `by week ${w} (${dayText(reviewDate(i.cycle, w))})`;
  const reviewName = (id: string | null) => i.reviews.find((v) => v.id === id)?.name ?? null;
  const rows: { r: Ask; row: StepRow; open: boolean; mine: boolean; overdueBy: number }[] = [];
  for (const r of i.asks) {
    if (!r.goalIds.includes(i.goal.id) || r.status === 'withdrawn') continue;
    const open = r.status === 'open';
    const overdueBy = isOverdue(r, i.week) ? i.week - r.dueWeek! : 0;
    const where = r.kind === 'action' || i.reviewsOn !== false ? reviewName(r.reviewId) : null;
    const many = r.goalIds.length > 1 ? ` · for ${r.goalIds.length} goals` : '';
    const line = r.kind === 'action'
      ? `${r.recipientId ? firstName(r.recipientId) : 'Anyone'}${r.dueWeek != null ? ` · ${by(r.dueWeek)}` : ''} · ${where ? `agreed in ${where}` : `agreed by ${firstName(r.askedBy)}`}`
      : `${r.recipientId ? `Asked of ${firstName(r.recipientId)} by ${firstName(r.askedBy)}` : `Asked by ${firstName(r.askedBy)}`}${where ? ` in ${where}` : ''} · ${ago(r.createdAt)}${many}`;
    const state = !open ? (r.status === 'done' ? `${ASK_STATUS.done.label} · week ${weekOf(r.answeredAt ?? r.updatedAt)}` : ASK_STATUS.answered.label)
      : overdueBy > 0 ? `${ASK_STATUS.overdue.label} by ${weeksWord(overdueBy)}` : ASK_STATUS.open.label;
    const answer = !open && r.answer?.trim() ? `${firstName(r.answeredBy)}: ${r.answer.trim()}` : null;
    let button: StepButton | null = null;
    if (open) {
      if (r.kind === 'decision' && canAnswer(r, i.viewer as Person)) button = 'Respond';
      else if (r.kind === 'question' && canAnswer(r, i.viewer as Person)) button = 'Answer';
      else if (r.kind === 'action' && canMarkDone(r, i.viewer as Person)) button = 'Mark done';
      else if (r.kind === 'update' && isOwner) button = 'Check in';
      else if (canWithdraw(r, i.viewer as Person, i.goal)) button = 'Withdraw';
    }
    const mine = open && (r.kind === 'action' ? r.recipientId === i.viewer.id : r.recipientId === i.viewer.id || (r.kind === 'decision' && !r.recipientId));
    const text = r.kind === 'update' ? KIND_WORD.update : `${KIND_WORD[r.kind]}: ${r.ask.trim()}`;
    rows.push({ r, open, mine, overdueBy, row: { id: r.id, kind: r.kind, text, line, state, overdue: overdueBy > 0, settled: !open, answer, button } });
  }
  const openOrder = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    const late = (x: typeof a) => (x.r.kind === 'action' && x.overdueBy > 0 ? 0 : 1);
    return late(a) - late(b) || b.overdueBy - a.overdueBy || ORDER[a.r.kind] - ORDER[b.r.kind] || (a.r.dueWeek ?? 999) - (b.r.dueWeek ?? 999) || a.r.createdAt.localeCompare(b.r.createdAt);
  };
  const openRows = rows.filter((x) => x.open).sort(openOrder);
  const forYou = openRows.filter((x) => x.mine).map((x) => x.row);
  const open = openRows.filter((x) => !x.mine).map((x) => x.row);
  const done = rows.filter((x) => !x.open).sort((a, b) => (b.r.answeredAt ?? b.r.updatedAt).localeCompare(a.r.answeredAt ?? a.r.updatedAt)).map((x) => x.row);
  const stepsOpen = openRows.some((x) => x.r.kind === 'action');
  return { forYou, open, done, openCount: forYou.length + open.length, gap: (i.status === 'off' || i.status === 'risk') && !stepsOpen };
}

/** What Why says about an open decision or help: a pointer to the list, never the ask's words (goal spec, rule 3). */
export function whyPointer(goal: Goal, asks: readonly Ask[], people: readonly Pick<Person, 'id' | 'name'>[]): string | null {
  const open = asks.filter((r) => r.kind === 'decision' && r.status === 'open' && r.goalIds.includes(goal.id));
  if (!open.length) return null;
  const names = [...new Set(open.map((r) => r.recipientId))];
  if (names.includes(null)) return 'Waiting on a decision: see Next steps and asks';
  const firstName = (id: string | null) => people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'someone';
  const list = names.map(firstName);
  const who = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  return `Waiting on a decision from ${who}: see Next steps and asks`;
}

/* ---------- 2. asked of you ---------- */

/** An ask on this goal waiting on the person looking (any kind: one way to ask), or, only when they arrived to reply
 *  to it, a comment. Each answered in place, in the one Respond panel. */
export interface AskedItem {
  /** What a link opens it by (`?respond=<id>`): the ask's id, or the comment's. */
  id: string;
  kind: AskKind | 'comment';
  fromId: string;
  fromFirst: string;
  /** What was asked, in their words. */
  text: string;
  at: string;
  /** Where it was asked: "Platform leadership weekly". */
  where: string | null;
  /** The week it's due by, if it has one. */
  due: number | null;
}

export function askedOf(goal: Goal, s: Snapshot, viewer: Person, replyTo: string | null): AskedItem[] {
  const out: AskedItem[] = [];
  for (const r of openAsksFor(goal.id, s)) {
    // Yours to respond to; or, when you came to it by its link, one you may answer (an admin, or an ask to anyone).
    const yours = r.recipientId === viewer.id;
    const allowed = replyTo === r.id && (r.kind === 'action' ? canMarkDone(r, viewer) : canAnswer(r, viewer));
    if (!yours && !allowed) continue;
    out.push({ id: r.id, kind: r.kind, fromId: r.askedBy, fromFirst: first(s, r.askedBy), text: r.ask, at: r.createdAt, where: s.reviews.find((v) => v.id === r.reviewId)?.name ?? null, due: r.dueWeek });
  }
  // A comment is no obligation: it's here only when you came to reply to it.
  const c = replyTo ? liveNotes(s.changes).find((x) => x.id === replyTo && x.goalId === goal.id && x.actorId !== viewer.id) : undefined;
  if (c && !out.some((x) => x.id === c.id)) out.push({ id: c.id, kind: 'comment', fromId: c.actorId, fromFirst: first(s, c.actorId), text: c.diffs[0]?.to ?? '', at: c.at, where: null, due: null });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/* ---------- 3. the context line: just posted, since you looked, or a first look ---------- */

/** After posting a check-in: "Posted: at risk → off track · 6 weeks on time". */
export function postedLine(goal: Goal, s: Snapshot, cycle: Cycle, week: number): { text: string; from: DisplayStatus | null; to: DisplayStatus; streak: number } | null {
  const own = checkInsFor(goal, s.checkIns);
  const latest = own[own.length - 1];
  if (!latest) return null;
  const prev = own[own.length - 2] ?? null;
  const streak = onTimeStreak(goal.ownerId, s, cycle, week);
  const moved = prev && prev.status !== latest.status ? `${lower(prev.status)} → ${lower(latest.status)}` : prev ? `still ${lower(latest.status)}` : `first check-in, ${lower(latest.status)}`;
  return { text: `Posted: ${moved}${streak != null && streak >= 2 ? ` · ${streak} weeks on time` : ''}`, from: prev?.status ?? null, to: latest.status, streak: streak ?? 0 };
}

/** "Updated 6 Nov · week 45": when the goal's latest check-in was posted, and the week it's for. Null before the first. */
export function updatedLine(goal: Goal, s: Snapshot): string | null {
  const own = checkInsFor(goal, s.checkIns);
  if (!own.length) return null;
  const latest = own.reduce((a, b) => (b.postedAt > a.postedAt ? b : a));
  return `Updated ${new Date(latest.postedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · week ${latest.week}`;
}

/** What a person saw last time they looked at a goal, kept in their browser. */
export interface Seen { at: string; status: DisplayStatus }

export interface SinceLooked {
  /** "on Tuesday", "earlier today", "on 28 Oct". */
  when: string;
  checkIns: number;
  comments: number;
  changes: number;
  /** The status then, when it has changed since. */
  statusFrom: DisplayStatus | null;
  statusTo: DisplayStatus;
  text: string;
}

const dayWords = (iso: string, today: Date) => {
  const d = daysSince(iso, today);
  if (d <= 0) return 'earlier today';
  if (d === 1) return 'yesterday';
  if (d < 7) return 'on ' + WEEKDAY[(new Date(iso).getUTCDay() + 6) % 7];
  return 'on ' + new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const things = (n: number, one: string, many: string) => (n === 1 ? `a new ${one}` : `${countWord(n)} new ${many}`);

export function sinceLooked(goal: Goal, s: Snapshot, seen: Seen, status: DisplayStatus, today: Date): SinceLooked {
  const after = (at: string) => at > seen.at;
  const checkIns = checkInsFor(goal, s.checkIns).filter((c) => after(c.postedAt)).length;
  const comments = liveNotes(s.changes).filter((c) => c.goalId === goal.id && after(c.at)).length;
  const changes = s.changes.filter((c) => c.goalId === goal.id && after(c.at) && c.entity !== 'note' && c.entity !== 'check-in').length;
  const when = dayWords(seen.at, today);
  const parts = [checkIns ? things(checkIns, 'check-in', 'check-ins') : '', comments ? things(comments, 'comment', 'comments') : '', changes ? things(changes, 'change', 'changes') : ''].filter(Boolean);
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] ?? '';
  const moved = seen.status !== status ? `${lower(seen.status)} → ${lower(status)}` : '';
  const text = !list && !moved ? `Nothing new since you looked ${when}.` : `Since you looked ${when}: ${[list, moved].filter(Boolean).join('; ')}.`;
  return { when, checkIns, comments, changes, statusFrom: seen.status !== status ? seen.status : null, statusTo: status, text };
}

/** On a first look: a plain line saying what the number is. */
export function firstLook(goal: Goal): string {
  if (goal.kind === 'milestone') {
    const last = Math.max(0, ...goal.stages.map((x) => x.dueWeek));
    return `What it tracks: ${goal.stages.length} dated ${goal.stages.length === 1 ? 'stage' : 'stages'}, the last due week ${last}.`;
  }
  const def = goal.definition.trim();
  const src = goal.source.trim();
  if (!def) return src ? `What it measures isn’t described yet. The number comes from ${src}.` : 'What it measures isn’t described yet.';
  return `What it measures: ${def.replace(/\.$/, '')}${src ? ` (from ${src})` : ''}.`;
}

/* ---------- 6. what's being done ---------- */

/** The owner's path to green, and an honest check of their date against the trend. */
export interface PathCheck {
  what: string;
  byWeek: number | null;
  /** "The recent trend doesn’t get there without a change." */
  check: string | null;
  /** The trend reaches the plan by the owner's date. */
  reaches: boolean | null;
  missed: boolean;
}

export function pathCheck(goal: Goal, s: Snapshot, cycle: Cycle, week: number, latest: CheckIn | null): PathCheck | null {
  const ptg = latest?.pathToGreen;
  if (!latest || !ptg) return null;
  const by = ptg.byWeek ?? null;
  const missed = by != null && by < week;
  const owner = first(s, goal.ownerId);
  if (by == null || missed) return { what: ptg.what, byWeek: by, check: missed ? `${owner} said it would be back on plan by week ${by}; that week has passed.` : null, reaches: null, missed };
  if (goal.kind === 'metric') {
    const series = valueSeries(checkInsFor(goal, s.checkIns).filter((c) => c.week <= week));
    const p = projectionFor(goal, series, by);
    if (!p) return { what: ptg.what, byWeek: by, check: 'Too few check-ins yet to check that date against the trend.', reaches: null, missed };
    const g = goalAsOf(goal, by);
    const plan = planAt(g.plan, by, cycle.weeks);
    const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
    const reaches = (p.value - plan) * dir >= -1e-9;
    return {
      what: ptg.what, byWeek: by, reaches, missed,
      // In words only: the numbers are the scorecard's and the chart's, and a second range here projected to another week.
      check: reaches ? 'The recent trend gets there.' : 'The recent trend doesn’t get there without a change.',
    };
  }
  if (goal.kind === 'milestone') {
    const a = assessPosted(goal, cycle, s.checkIns, week);
    const finish = a.kind === 'milestone' ? Math.max(0, ...a.stages.map((x) => x.expectedWeek)) : 0;
    const due = Math.max(0, ...goal.stages.map((x) => x.dueWeek));
    const reaches = finish <= Math.max(due, by);
    return { what: ptg.what, byWeek: by, reaches, missed, check: reaches ? 'The stages’ own dates agree.' : `The stages’ own dates say week ${finish}.` };
  }
  return { what: ptg.what, byWeek: by, check: null, reaches: null, missed };
}

export type ActionState = 'open' | 'done' | 'overdue';
/** One thing being done about the goal: what its path to green needs, or an ask on it (a decision or help, an update, a question, an action). */
export interface ActionItem {
  id: string;
  kind: 'path' | AskKind;
  /** What's to be done, in the words it was given. */
  what: string;
  /** Who does it, or must respond (a person's id), or null for anyone. */
  who: string | null;
  /** The week it's due by. */
  due: number | null;
  state: ActionState;
  /** Where it came from and where it has got to: "Asked by Amara", "Answered by Amara: Approved …". */
  note: string;
  at: string;
}

const STATE_ORDER: Record<ActionState, number> = { overdue: 0, open: 1, done: 2 };

/** An ask's state as the action list shows it: open, overdue (open past its week), or done (answered, or marked done). */
export const askState = (r: Ask, week: number): ActionState => (isResolved(r) ? 'done' : isOverdue(r, week) ? 'overdue' : 'open');

/**
 * One list of what's being done: the owner's path to green, and every ask on the goal, each with who, when and where it
 * has got to. An ask's state is its own (asks.ts): open until it's answered or marked done, overdue when it's open past
 * its week, and gone once withdrawn. What's settled stays for eight weeks, so the last answers are still in view.
 */
export function actionList(goal: Goal, s: Snapshot, week: number, status: DisplayStatus, latest: CheckIn | null, cycle: Cycle): ActionItem[] {
  const out: ActionItem[] = [];
  const behind = status === 'off' || status === 'risk';
  const ptg = latest?.pathToGreen;
  if (behind && latest && ptg && ptg.what.trim()) {
    out.push({ id: 'path-' + latest.id, kind: 'path', what: ptg.what, who: goal.ownerId, due: ptg.byWeek ?? null, state: ptg.byWeek != null && ptg.byWeek < week ? 'overdue' : 'open', note: `Path to green, week ${latest.week} check-in`, at: latest.postedAt });
  }
  // Weeks since a date: the week of the cycle it fell in.
  const weekOf = (iso: string) => currentWeek(cycle, new Date(iso));
  for (const r of asksOf(s).filter((x) => x.goalIds.includes(goal.id) && x.status !== 'withdrawn')) {
    const state = askState(r, week);
    if (state === 'done' && weekOf(r.answeredAt ?? r.updatedAt) < week - 8) continue;
    const where = s.reviews.find((v) => v.id === r.reviewId)?.name;
    const other = r.kind === 'decision' && r.goalIds[0] !== goal.id ? s.goals.find((g) => g.id === r.goalIds[0])?.title : null;
    const raised = r.kind === 'action' ? `Agreed by ${first(s, r.askedBy)}${where ? ` in ${where}` : ''}${r.week ? `, week ${r.week}` : ''}` : `Asked by ${first(s, r.askedBy)}${where ? ` in ${where}` : ''}${other ? `, the same request as ${other}` : ''}`;
    const settled = r.status === 'done' ? `Done${r.answeredBy ? `, marked by ${first(s, r.answeredBy)}` : ''}${r.answer ? `: ${r.answer}` : ''}` : r.status === 'answered' ? `Answered by ${s.people.find((p) => p.id === r.answeredBy)?.name ?? 'someone'}: ${r.answer ?? ''}` : '';
    out.push({ id: r.id, kind: r.kind, what: r.ask, who: r.recipientId, due: r.dueWeek, state, note: settled ? `${raised}. ${settled}` : raised, at: r.createdAt });
  }
  return out.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.due ?? 999) - (b.due ?? 999) || b.at.localeCompare(a.at));
}

/* ---------- 7. last time we talked ---------- */

export interface Talked {
  /** The last review session that said anything about this goal. */
  held: { review: string; week: number; on: string; said: { id: string; kind: Decision['kind']; by: string; note: string; state: ActionState | null; who: string | null; due: number | null }[] } | null;
  /** The next session of a review that covers this goal. */
  next: { review: string; weekday: string; date: string; week: number } | null;
}

export function lastTalked(goal: Goal, s: Snapshot, cycle: Cycle, week: number, today: Date): Talked {
  const inReview = saidIn(s).filter((d) => d.goalId === goal.id && d.reviewId);
  let held: Talked['held'] = null;
  const last = inReview.reduce<Said | null>((m, d) => (!m || d.week > m.week || (d.week === m.week && d.at > m.at) ? d : m), null);
  if (last) {
    const session = inReview.filter((d) => d.reviewId === last.reviewId && d.week === last.week).sort((a, b) => a.at.localeCompare(b.at));
    held = {
      review: s.reviews.find((r) => r.id === last.reviewId)?.name ?? 'A review',
      week: last.week,
      on: session.map((d) => d.at).sort().at(-1)!.slice(0, 10),
      said: session.filter((d) => d.kind !== 'acknowledge').map((d) => ({
        id: d.id, kind: d.kind, by: first(s, d.byId), note: d.note,
        state: d.ask ? askState(d.ask, week) : null,
        who: d.kind === 'action' ? d.assigneeId ?? goal.ownerId : null,
        due: d.dueWeek ?? null,
      })),
    };
  }
  const day = today.toISOString().slice(0, 10);
  const next = s.reviews.filter((r) => goalsIn(r.scope, s.goals).some((g) => g.id === goal.id)).map((r) => {
    let w = sessionWeek(r, week, cycle);
    if (sessionDate(r, cycle, w) < day) w = sessionWeek(r, w + 1, cycle);
    return { review: r.name, weekday: WEEKDAY[r.weekday] ?? '', date: sessionDate(r, cycle, w), week: w };
  }).filter((x) => x.week <= cycle.weeks).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return { held, next };
}

/* ---------- 10. activity: one stream ---------- */

export type StreamItem =
  /** `sameAs`: the week of a newer check-in that already gave this reason, so it isn't said again; `sameAsWhere`: where
      that week sits in this stream (newest first, by when it was posted), for `sameReasonText`. */
  | { kind: 'checkin'; at: string; checkIn: CheckIn; sameAs?: number; sameAsWhere?: 'above' | 'below' }
  /** Check-ins in a row that gave the same reason, said once: "Weeks 43–45: billing questions doubled…". */
  | { kind: 'checkins'; at: string; checkIns: CheckIn[]; why: string; from: number; to: number; sameAs?: number; sameAsWhere?: 'above' | 'below' }
  | { kind: 'comment'; at: string; change: Change }
  | { kind: 'change'; at: string; change: Change };
export type StreamFilter = 'all' | 'checkins' | 'comments' | 'changes';

/** Check-ins, comments and changes in one stream, newest first, with a reason repeated week after week said once. The
    newest check-in always stands on its own. */
export function activityStream(goal: Goal, s: Snapshot): StreamItem[] {
  const own = checkInsFor(goal, s.checkIns).slice().reverse();
  const items: StreamItem[] = [];
  // A reason given again later in the year (after weeks of another) points back to where it was said, newest first.
  const first = new Map<string, number>();
  for (let i = 0; i < own.length;) {
    const c = own[i]!;
    let j = i + 1;
    const key = (x: CheckIn) => x.why.trim();
    // The newest check-in is never folded into a group: it's the fact people came for, with its number and status
    // (deep review U11). Older ones that repeat its reason fold, and point back to it.
    while (i > 0 && j < own.length && said(c.why) && key(own[j]!) === key(c) && own[j]!.cause === c.cause) j++;
    const sameAs = said(c.why) ? first.get(key(c)) : undefined;
    if (said(c.why) && sameAs == null) first.set(key(c), c.week);
    if (j - i >= 2) items.push({ kind: 'checkins', at: c.postedAt, checkIns: own.slice(i, j), why: c.why, from: own[j - 1]!.week, to: c.week, ...(sameAs != null ? { sameAs } : {}) });
    else items.push({ kind: 'checkin', at: c.postedAt, checkIn: c, ...(sameAs != null ? { sameAs } : {}) });
    i = j;
  }
  // Removed comments keep their place ("Comment removed"), so a thread still reads (domain/removal commentsOf).
  for (const n of writtenNotes(s.changes).filter((x) => x.goalId === goal.id)) items.push({ kind: 'comment', at: n.at, change: n });
  for (const ch of s.changes.filter((x) => x.goalId === goal.id && x.entity !== 'check-in' && x.entity !== 'note')) items.push({ kind: 'change', at: ch.at, change: ch });
  items.sort((a, b) => b.at.localeCompare(a.at));
  // Where the week it points to sits: usually above (newer), but a week loaded later sorts by when it was posted.
  const at = (wk: number) => items.findIndex((x) => (x.kind === 'checkin' && x.checkIn.week === wk) || (x.kind === 'checkins' && x.checkIns.some((c) => c.week === wk)));
  return items.map((x, i) => ((x.kind === 'checkin' || x.kind === 'checkins') && x.sameAs != null ? { ...x, sameAsWhere: at(x.sameAs) > i ? 'below' : 'above' } : x));
}

/** "The same reason as week 42, above": the week a repeated reason was said in, and which way to look for it. */
export const sameReasonText = (week: number, where: 'above' | 'below' = 'above') => `The same reason as week ${week}, ${where}`;

export const streamMatches = (f: StreamFilter) => (x: StreamItem) =>
  f === 'all' || (f === 'checkins' && (x.kind === 'checkin' || x.kind === 'checkins')) || (f === 'comments' && x.kind === 'comment') || (f === 'changes' && x.kind === 'change');

/* ---------- 7a. the history: every week, and what each entry is (goal spec, rule 4; GT2) ---------- */

export type HistoryFilter = 'all' | 'checkins' | 'comments' | 'reviews' | 'changes';
export const HISTORY_FILTERS: readonly HistoryFilter[] = ['all', 'checkins', 'comments', 'reviews', 'changes'];
export const HISTORY_LABEL: Record<HistoryFilter, string> = { all: 'All', checkins: 'Check-ins', comments: 'Comments', reviews: 'Reviews', changes: 'Changes' };

/** A week, or a run of weeks, with no check-in: "Week 45 · No check-in", "Weeks 12 to 17 · No check-ins (6 weeks)". */
export interface MissedEntry { kind: 'missed'; at: string; from: number; to: number; weeks: number; yet: boolean }
export type HistoryEntry = StreamItem | MissedEntry;

/** What the history reads: the goal, its own check-ins and change-log entries, the cycle, this week, the reviews' names. */
export interface HistoryInput {
  goal: Goal; checkIns: readonly CheckIn[]; changes: readonly Change[]; cycle: Cycle; week: number;
  /** The asks on this goal, for which review (if any) each was raised in. */
  asks: readonly Pick<Ask, 'id' | 'reviewId'>[];
}

/**
 * Which filter an entry is under: a week; a comment (or an ask raised outside a review); what a review said; an edit.
 * An ask is under Reviews when it was raised in one: its own `reviewId`, never the review's name in its sentence, so
 * renaming a review moves none of its past asks.
 */
export function historyKind(x: HistoryEntry, asks: readonly Pick<Ask, 'id' | 'reviewId'>[]): Exclude<HistoryFilter, 'all'> {
  if (x.kind === 'checkin' || x.kind === 'checkins' || x.kind === 'missed') return 'checkins';
  if (x.kind === 'comment') return 'comments';
  const c = x.change;
  if (c.entity === 'decision') return 'reviews';
  if (c.entity === 'request') return asks.some((a) => a.id === c.entityId && a.reviewId) ? 'reviews' : 'comments';
  return 'changes';
}

/** How many entries an entry counts as: a week's, a run's weeks; one for anything else. */
const weight = (x: HistoryEntry) => (x.kind === 'missed' ? x.weeks : x.kind === 'checkins' ? new Set(x.checkIns.map((c) => c.week)).size : 1);

/** An entry's words, for searching it. */
function historyWords(x: HistoryEntry): string {
  if (x.kind === 'missed') return x.from === x.to ? `Week ${x.from} No check-in` : `Weeks ${x.from} to ${x.to} No check-ins`;
  if (x.kind === 'checkin') return `Week ${x.checkIn.week} ${x.checkIn.why ?? ''} ${x.checkIn.pathToGreen?.what ?? ''} ${LABEL[x.checkIn.status]}`;
  if (x.kind === 'checkins') return `${x.checkIns.map((c) => `Week ${c.week}`).join(' ')} ${x.why}`;
  return `${x.change.summary} ${x.change.diffs.map((d) => `${d.field} ${d.from} ${d.to}`).join(' ')}`;
}

/** The end of a week, as an ISO time: where a week's entry sits among the others, newest first. */
const weekEnd = (cycle: Cycle, w: number) => new Date(Date.parse(weekDate(cycle, w + 1) + 'T00:00:00Z') - 1000).toISOString();

/**
 * A goal's history: one entry for every week from its first (the week it was created, or the first it was checked in,
 * if earlier) to this week, its check-in or "No check-in" (four or more missed in a row are one entry); its comments;
 * what reviews said; and its edits. Newest first, a week's entry at the end of its week. Counts by filter, a run counting
 * its weeks; `q` keeps the entries whose words match (find rule 1).
 */
export function goalHistory(i: HistoryInput, filter: HistoryFilter = 'all', q = ''): { counts: Record<HistoryFilter, number>; entries: HistoryEntry[] } {
  const stream = activityStream(i.goal, { checkIns: i.checkIns, changes: i.changes } as unknown as Snapshot);
  const own = checkInsFor(i.goal, i.checkIns as CheckIn[]);
  const checked = new Set(own.map((c) => c.week));
  const created = i.goal.createdAt ? Math.max(1, currentWeek(i.cycle, new Date(i.goal.createdAt))) : 1;
  const firstWeek = Math.max(1, Math.min(created, ...own.map((c) => c.week)));
  const missed: MissedEntry[] = [];
  const one = (w: number) => missed.push({ kind: 'missed', at: weekEnd(i.cycle, w), from: w, to: w, weeks: 1, yet: !own.length && w === i.week });
  // Four or more missed in a row are one entry; fewer are a week each.
  const run = (from: number, to: number) => { if (to < from) return; if (to - from + 1 >= 4) missed.push({ kind: 'missed', at: weekEnd(i.cycle, to), from, to, weeks: to - from + 1, yet: false }); else for (let k = from; k <= to; k++) one(k); };
  const last = i.goal.stoppedAt ? Math.min(i.week, currentWeek(i.cycle, new Date(i.goal.stoppedAt))) : i.week;
  for (let w = firstWeek; w <= last;) {
    if (checked.has(w)) { w++; continue; }
    let to = w;
    while (to + 1 <= last && !checked.has(to + 1)) to++;
    // This week is always its own entry, never folded into a run (U11).
    if (to === i.week) { run(w, to - 1); one(to); } else run(w, to);
    w = to + 1;
  }
  // A goal with no check-in yet has one week entry: this one.
  const weeks = own.length ? missed : missed.filter((m) => m.to === i.week);
  // A check-in sits at the end of its week too, so a week reads as one place in the list.
  const placed: HistoryEntry[] = stream.map((x) => (x.kind === 'checkin' ? { ...x, at: weekEnd(i.cycle, x.checkIn.week) } : x.kind === 'checkins' ? { ...x, at: weekEnd(i.cycle, x.to) } : x));
  const all = [...placed, ...weeks].sort((a, b) => b.at.localeCompare(a.at));
  const counts: Record<HistoryFilter, number> = { all: 0, checkins: 0, comments: 0, reviews: 0, changes: 0 };
  for (const x of all) { const n = weight(x); counts[historyKind(x, i.asks)] += n; counts.all += n; }
  const entries = all.filter((x) => (filter === 'all' || historyKind(x, i.asks) === filter) && textMatches(historyWords(x), q));
  return { counts, entries };
}

/* ---------- 7b. who a comment reaches (goal spec, rule 5; GT3) ---------- */

/**
 * The line under the comment box: everyone in the workspace can read it; the owner and the people watching the goal
 * (directly, or through a tree or a level) see it on Home. The viewer and the owner are never counted among the watchers.
 */
export function commentReach(i: { goal: Goal; viewerId: string; ownerFirst: string; watcherIds: readonly string[]; workspace: string }): string {
  const n = new Set(i.watcherIds.filter((id) => id !== i.viewerId && id !== i.goal.ownerId)).size;
  const people = `the ${n} ${n === 1 ? 'person' : 'people'} watching`;
  const read = `Everyone in ${i.workspace} can read this.`;
  if (i.viewerId === i.goal.ownerId) return `${read} ${n ? `${people[0]!.toUpperCase()}${people.slice(1)} see it on Home.` : 'Nobody is watching it yet, so it shows on no one else’s Home.'}`;
  return `${read} ${n ? `${i.ownerFirst} and ${people} see it on Home.` : `${i.ownerFirst} sees it on Home.`}`;
}

/* ---------- 8. what feeds it ---------- */

/** The goals feeding this one, worst first, with the one most likely to make it miss pinned first and why. */
export function feedingOrder(children: Goal[], att: (g: Goal) => GoalAttention, onPath: Set<string>): { pinned: { goal: Goal; why: string } | null; rest: Goal[] } {
  const needy = children.filter((c) => ['off', 'risk', 'stale'].includes(att(c).status.status));
  const sorted = [...children].sort((a, b) => {
    const x = att(a), y = att(b);
    return Number(needy.includes(b)) - Number(needy.includes(a)) || Number(onPath.has(b.id)) - Number(onPath.has(a.id)) || y.weight - x.weight || RANK[y.status.status] - RANK[x.status.status] || a.title.localeCompare(b.title);
  });
  const top = sorted[0];
  if (!top || !needy.includes(top)) return { pinned: null, rest: sorted };
  const at = att(top);
  const f = at.flags.find((x) => x.kind !== 'due' && x.kind !== 'off' && x.kind !== 'risk');
  // Short enough for one line beside "Most likely to make it miss:" (F4): "on the critical path; furthest behind."
  const parts = [onPath.has(top.id) ? 'on the critical path' : '', at.status.status === 'stale' ? 'its last result is unknown' : f ? f.label.charAt(0).toLowerCase() + f.label.slice(1) : 'furthest behind'].filter(Boolean);
  const why = parts.join('; ') + '.';
  return { pinned: { goal: top, why }, rest: sorted.slice(1) };
}

/** The current week's value in the goal's units, for a chart's readout: plan for any week. */
export const planFor = (goal: Goal, cycle: Cycle, week: number) => (goal.kind === 'metric' ? planAt(goalAsOf(goal, week).plan, week, cycle.weeks) : null);
