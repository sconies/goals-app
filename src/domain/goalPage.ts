/* The flagship goal page (approved by Lane, 5 Nov): what each part of it says, worked out once. Pure, so the page, its
   shared image and the tests read the same words. Status, check-in, request and review rules are not restated here:
   each part asks the module that owns its rule (status, attention, requests, review, summaryFacts, plan).

   The page answers, in order: what is this goal and who owns it; how is it doing; if badly, why; what is being done and
   how those actions are going; where it is heading; what has happened, and what was said the last time it was discussed.
   Each fact has one home on it (the plan's "one home for each fact" table). */
import type { GoalAttention } from './attention';
import { isShare } from './checkin';
import { fmt, NO_VALUE, rangeText } from './format';
import { daysSince, goalAsOf, planAt, planEnd, projection, valueSeries } from './plan';
import { onTimeStreak, WEEKDAY } from './progress';
import { answeredSince, openFor } from './requests';
import { answerOf, goalsIn, sessionDate, sessionWeek } from './review';
import { assessPosted, checkInsFor, LABEL, RANK } from './status';
import { countWord, summaryFacts, type Direction } from './summaryFacts';
import { liveNotes, openUpdateAsk } from './updateAsks';
import type { Change, CheckIn, Cycle, Decision, DisplayStatus, Goal, Person, Snapshot } from './types';

const first = (s: Snapshot, id: string | null | undefined) => s.people.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
const said = (why: string | null | undefined) => !!why && why.trim() !== '' && why !== 'On plan.';
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
    const limit = `${goal.range.bound === 'atMost' ? 'at most' : 'at least'} ${fmt(goal.range.limit, goal)}`;
    if (a.actual == null) return { now: NO_VALUE, nowValue: null, against: [limit], direction: null, directionText: null };
    const where = a.out ? 'outside the limit' : a.near ? 'inside the limit, near it' : 'inside the limit';
    return { now: fmt(a.actual, goal), nowValue: a.actual, against: stale ? [`in week ${a.week}`, limit] : [limit, where], ...(stale ? { direction: null, directionText: null } : dir) };
  }
  if (goal.kind === 'milestone' && a.kind === 'milestone') {
    const next = a.stages.filter((x) => x.kind !== 'done').sort((x, y) => x.dueWeek - y.dueWeek)[0];
    const against = a.calc === 'done' ? ['every stage done']
      : a.late.length ? [`${a.late.length} ${a.late.length === 1 ? 'stage' : 'stages'} slipping`, ...(next ? [`${next.name}: week ${next.expectedWeek}, due ${next.dueWeek}`] : [])]
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
  /** "being handled: Action: Maya, due week 47" or "nobody on it yet". */
  handledText: string | null;
}

export function whyLine(goal: Goal, s: Snapshot, att: GoalAttention): WhyLine {
  const st = att.status;
  const latest = st.latest;
  if (!latest) return { text: st.status === 'stale' ? 'Nothing reported yet' : 'Waiting for its first check-in', by: null, handled: null, handledText: null };
  if (st.status === 'stale') return { text: `No check-in for ${st.daysSinceCheckIn} days; last heard in week ${latest.week}`, by: null, handled: null, handledText: null };
  const by = `${first(s, latest.authorId)}, week ${latest.week}`;
  if (st.status === 'off' || st.status === 'risk') {
    const handled = att.handled ? 'handled' as const : 'nobody' as const;
    return {
      text: said(latest.why) ? latest.why : 'No reason given yet',
      by: said(latest.why) ? by : null,
      handled,
      handledText: att.handled ? `being handled: ${att.handled.text}` : 'nobody on it yet',
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

/** For a goal others feed: "Fed by 3 goals: 1 off track", in the bar. */
export interface FeedsLine { total: number; counts: { status: DisplayStatus; n: number }[]; text: string }

export function feedsLine(children: Goal[], statusOf: (g: Goal) => DisplayStatus): FeedsLine | null {
  if (!children.length) return null;
  const by = new Map<DisplayStatus, number>();
  for (const c of children) { const k = statusOf(c); by.set(k, (by.get(k) ?? 0) + 1); }
  const worst = (['off', 'risk', 'stale'] as DisplayStatus[]).filter((k) => by.get(k)).map((k) => ({ status: k, n: by.get(k)! }));
  const total = children.length;
  const head = `Fed by ${total === 1 ? 'one goal' : `${countWord(total)} goals`}`;
  return { total, counts: worst, text: worst.length ? `${head}: ${worst.map((x) => `${x.n} ${lower(x.status)}`).join(', ')}` : `${head}, none behind` };
}

/** What goes on the bar's one main button, by who's looking and what's waiting (approved plan, "Final page" 1). */
export type PrimaryKind = 'answer' | 'respond' | 'check-in' | 'first-check-in' | 'ask-update' | 'watch' | null;
export interface Primary { kind: PrimaryKind; label: string; targetId: string | null }

export function primaryAction(o: {
  goal: Goal; viewer: Person; owner: Person | undefined; status: DisplayStatus; due: boolean; week: number;
  asked: AskedItem[]; updateAsked: boolean; watching: boolean;
}): Primary {
  const ownerFirst = o.owner?.name.split(' ')[0] ?? 'the owner';
  const isOwner = o.viewer.id === o.goal.ownerId;
  // Something waiting on you comes first: answering it is the one thing to do here.
  const question = o.asked.find((x) => x.kind === 'question');
  const request = o.asked.find((x) => x.kind === 'request');
  if (isOwner && question) return { kind: 'answer', label: `Answer ${question.fromFirst}’s question`, targetId: question.id };
  if (request) return { kind: 'respond', label: request.fromId === o.viewer.id ? 'Answer your own request' : `Answer ${request.fromFirst}’s request`, targetId: request.id };
  if (isOwner && o.week > 0 && o.due) return { kind: 'check-in', label: `Check in for week ${o.week}`, targetId: null };
  if (!isOwner && o.status === 'stale' && !o.updateAsked) return { kind: 'ask-update', label: `Ask ${ownerFirst} for an update`, targetId: null };
  if (!isOwner && !o.watching) return { kind: 'watch', label: 'Watch', targetId: null };
  return { kind: null, label: '', targetId: null };
}

/* ---------- 2. asked of you ---------- */

/** Something on this goal waiting on the person looking: a request, a review question, an ask for an update, or (only
 *  when they arrived to reply to it) a comment. Each answered in place. */
export interface AskedItem {
  /** What a link opens it by (`?respond=<id>`): the request's, the decision's or the comment's id. */
  id: string;
  kind: 'request' | 'question' | 'update' | 'comment';
  fromId: string;
  fromFirst: string;
  /** What was asked, in their words. */
  text: string;
  at: string;
  /** Where it was asked: "Support weekly". */
  where: string | null;
}

export function askedOf(goal: Goal, s: Snapshot, viewer: Person, latestAt: string | null, replyTo: string | null): AskedItem[] {
  const out: AskedItem[] = [];
  const isOwner = viewer.id === goal.ownerId;
  for (const r of openFor(goal.id, s)) {
    if (r.recipientId !== viewer.id && !(replyTo === r.id && (viewer.admin || !r.recipientId))) continue;
    out.push({ id: r.id, kind: 'request', fromId: r.askedBy, fromFirst: first(s, r.askedBy), text: r.ask, at: r.createdAt, where: null });
  }
  if (isOwner) {
    for (const d of s.decisions.filter((x) => x.goalId === goal.id && x.kind === 'ask' && !answerOf(x, s))) {
      out.push({ id: d.id, kind: 'question', fromId: d.byId, fromFirst: first(s, d.byId), text: d.note, at: d.at, where: s.reviews.find((r) => r.id === d.reviewId)?.name ?? null });
    }
    const ask = openUpdateAsk(goal.id, s, latestAt);
    if (ask && ask.actorId !== viewer.id) out.push({ id: ask.id, kind: 'update', fromId: ask.actorId, fromFirst: first(s, ask.actorId), text: ask.diffs[0]?.to ?? '', at: ask.at, where: null });
  }
  // A comment is no obligation: it's here only when you came to reply to it.
  const c = replyTo ? liveNotes(s.changes).find((x) => x.id === replyTo && x.goalId === goal.id && x.actorId !== viewer.id) : undefined;
  if (c && !out.some((x) => x.id === c.id)) out.push({ id: c.id, kind: 'comment', fromId: c.actorId, fromFirst: first(s, c.actorId), text: c.diffs[0]?.to ?? '', at: c.at, where: null });
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
  return { text: `Posted: ${moved}${streak >= 2 ? ` · ${streak} weeks on time` : ''}`, from: prev?.status ?? null, to: latest.status, streak };
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
  /** "The recent trend doesn’t get there without a change (heading for 82–84% against a plan of 87%)." */
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
    const p = projection(series, by);
    if (!p) return { what: ptg.what, byWeek: by, check: 'Too few check-ins yet to check that date against the trend.', reaches: null, missed };
    const g = goalAsOf(goal, by);
    const plan = planAt(g.plan, by, cycle.weeks);
    const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
    const reaches = (p.value - plan) * dir >= -1e-9;
    return {
      what: ptg.what, byWeek: by, reaches, missed,
      check: reaches
        ? `The recent trend gets there (heading for ${rangeText(p, goal, isShare(goal))} against a plan of ${fmt(plan, goal)}).`
        : `The recent trend doesn’t get there without a change (heading for ${rangeText(p, goal, isShare(goal))} against a plan of ${fmt(plan, goal)}).`,
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
/** One thing being done about the goal: what its path to green needs, a review's action or question, or a request. */
export interface ActionItem {
  id: string;
  kind: 'path' | 'request' | 'action' | 'question';
  /** What's to be done, in the words it was given. */
  what: string;
  /** Who does it (a person's id), or null for anyone. */
  who: string | null;
  /** The week it's due by. */
  due: number | null;
  state: ActionState;
  /** Where it came from and where it has got to: "Asked by Hana", "Answered by Elena: Approved …". */
  note: string;
  at: string;
}

const STATE_ORDER: Record<ActionState, number> = { overdue: 0, open: 1, done: 2 };

/**
 * One list of what's being done: the owner's path to green, the requests it's waiting on, and the actions and questions
 * reviews agreed, each with who, when and where it has got to. Requests are done once answered (requests.ts). Questions
 * are done once the owner has replied (review.ts). A review action carries no done mark (review.ts's openActions): past
 * its week it reads as overdue while the goal is still behind, and done once it isn't.
 */
export function actionList(goal: Goal, s: Snapshot, week: number, status: DisplayStatus, latest: CheckIn | null): ActionItem[] {
  const out: ActionItem[] = [];
  const behind = status === 'off' || status === 'risk';
  const ptg = latest?.pathToGreen;
  if (behind && latest && ptg && ptg.what.trim()) {
    out.push({ id: 'path-' + latest.id, kind: 'path', what: ptg.what, who: goal.ownerId, due: ptg.byWeek ?? null, state: ptg.byWeek != null && ptg.byWeek < week ? 'overdue' : 'open', note: `Path to green, week ${latest.week} check-in`, at: latest.postedAt });
  }
  for (const r of openFor(goal.id, s)) {
    const other = r.goalIds[0] !== goal.id ? s.goals.find((g) => g.id === r.goalIds[0])?.title : null;
    out.push({ id: r.id, kind: 'request', what: r.ask, who: r.recipientId, due: null, state: 'open', note: `Asked by ${first(s, r.askedBy)}${other ? `, the same request as ${other}` : ''}`, at: r.createdAt });
  }
  const answered = answeredSince(goal.id, latest?.postedAt ?? null, s);
  if (answered) out.push({ id: answered.id, kind: 'request', what: answered.ask, who: answered.recipientId, due: null, state: 'done', note: `Answered by ${s.people.find((p) => p.id === answered.answeredBy)?.name ?? 'someone'}: ${answered.answer ?? ''}`, at: answered.answeredAt ?? answered.updatedAt });
  // Reviews' actions and questions from the last eight weeks, and any still open.
  const recent = (d: Decision) => d.week >= week - 8;
  for (const d of s.decisions.filter((x) => x.goalId === goal.id && (x.kind === 'action' || x.kind === 'ask'))) {
    const where = s.reviews.find((r) => r.id === d.reviewId)?.name;
    if (d.kind === 'action') {
      const past = d.dueWeek != null && d.dueWeek < week;
      if (past && !recent(d)) continue;
      out.push({ id: d.id, kind: 'action', what: d.note, who: d.assigneeId ?? goal.ownerId, due: d.dueWeek ?? null, state: past ? (behind ? 'overdue' : 'done') : 'open', note: `Agreed${where ? ` in ${where}` : ''}, week ${d.week}`, at: d.at });
    } else {
      const ans = answerOf(d, s);
      if (ans && !recent(d)) continue;
      out.push({ id: d.id, kind: 'question', what: d.note, who: goal.ownerId, due: null, state: ans ? 'done' : 'open', note: ans ? `Asked by ${first(s, d.byId)}; ${first(s, ans.byId)} replied: ${ans.text}` : `Asked by ${first(s, d.byId)}${where ? ` in ${where}` : ''}, week ${d.week}`, at: d.at });
    }
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

export function lastTalked(goal: Goal, s: Snapshot, cycle: Cycle, week: number, today: Date, status: DisplayStatus): Talked {
  const inReview = s.decisions.filter((d) => d.goalId === goal.id && d.reviewId);
  let held: Talked['held'] = null;
  const last = inReview.reduce<Decision | null>((m, d) => (!m || d.week > m.week || (d.week === m.week && d.at > m.at) ? d : m), null);
  if (last) {
    const session = inReview.filter((d) => d.reviewId === last.reviewId && d.week === last.week).sort((a, b) => a.at.localeCompare(b.at));
    const behind = status === 'off' || status === 'risk';
    held = {
      review: s.reviews.find((r) => r.id === last.reviewId)?.name ?? 'A review',
      week: last.week,
      on: session.map((d) => d.at).sort().at(-1)!.slice(0, 10),
      said: session.filter((d) => d.kind !== 'acknowledge').map((d) => ({
        id: d.id, kind: d.kind, by: first(s, d.byId), note: d.note,
        state: d.kind === 'action' ? (d.dueWeek != null && d.dueWeek < week ? (behind ? 'overdue' : 'done') : 'open') : d.kind === 'ask' ? (answerOf(d, s) ? 'done' : 'open') : null,
        who: d.kind === 'action' ? d.assigneeId ?? goal.ownerId : null,
        due: d.dueWeek ?? null,
      })),
    };
  }
  const day = today.toISOString().slice(0, 10);
  const next = s.reviews.filter((r) => goalsIn(r.scope, s.goals).some((g) => g.id === goal.id)).map((r) => {
    let w = sessionWeek(r, week);
    if (sessionDate(r, cycle, w) < day) w = sessionWeek(r, w + 1);
    return { review: r.name, weekday: WEEKDAY[r.weekday] ?? '', date: sessionDate(r, cycle, w), week: w };
  }).filter((x) => x.week <= cycle.weeks).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return { held, next };
}

/* ---------- 10. activity: one stream ---------- */

export type StreamItem =
  /** `sameAs`: the week of a newer check-in that already gave this reason, so it isn't said again. */
  | { kind: 'checkin'; at: string; checkIn: CheckIn; sameAs?: number }
  /** Check-ins in a row that gave the same reason, said once: "Weeks 43–45: billing questions doubled…". */
  | { kind: 'checkins'; at: string; checkIns: CheckIn[]; why: string; from: number; to: number; sameAs?: number }
  | { kind: 'comment'; at: string; change: Change }
  | { kind: 'change'; at: string; change: Change };
export type StreamFilter = 'all' | 'checkins' | 'comments' | 'changes';

/** Check-ins, comments and changes in one stream, newest first, with a reason repeated week after week said once. */
export function activityStream(goal: Goal, s: Snapshot): StreamItem[] {
  const own = checkInsFor(goal, s.checkIns).slice().reverse();
  const items: StreamItem[] = [];
  // A reason given again later in the year (after weeks of another) points back to where it was said, newest first.
  const first = new Map<string, number>();
  for (let i = 0; i < own.length;) {
    const c = own[i]!;
    let j = i + 1;
    const key = (x: CheckIn) => x.why.trim();
    while (j < own.length && said(c.why) && key(own[j]!) === key(c) && own[j]!.cause === c.cause) j++;
    const sameAs = said(c.why) ? first.get(key(c)) : undefined;
    if (said(c.why) && sameAs == null) first.set(key(c), c.week);
    if (j - i >= 2) items.push({ kind: 'checkins', at: c.postedAt, checkIns: own.slice(i, j), why: c.why, from: own[j - 1]!.week, to: c.week, ...(sameAs != null ? { sameAs } : {}) });
    else items.push({ kind: 'checkin', at: c.postedAt, checkIn: c, ...(sameAs != null ? { sameAs } : {}) });
    i = j;
  }
  for (const n of liveNotes(s.changes).filter((x) => x.goalId === goal.id)) items.push({ kind: 'comment', at: n.at, change: n });
  for (const ch of s.changes.filter((x) => x.goalId === goal.id && x.entity !== 'check-in' && x.entity !== 'note')) items.push({ kind: 'change', at: ch.at, change: ch });
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export const streamMatches = (f: StreamFilter) => (x: StreamItem) =>
  f === 'all' || (f === 'checkins' && (x.kind === 'checkin' || x.kind === 'checkins')) || (f === 'comments' && x.kind === 'comment') || (f === 'changes' && x.kind === 'change');

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
  const why = [onPath.has(top.id) ? 'On the critical path' : '', at.status.status === 'stale' ? 'Its last result is unknown' : f ? f.label : 'Furthest behind of the goals feeding it'].filter(Boolean).join('. ') + '.';
  return { pinned: { goal: top, why }, rest: sorted.slice(1) };
}

/** The current week's value in the goal's units, for a chart's readout: plan for any week. */
export const planFor = (goal: Goal, cycle: Cycle, week: number) => (goal.kind === 'metric' ? planAt(goalAsOf(goal, week).plan, week, cycle.weeks) : null);
