/* One page on paper: a goal, or a review's session, with everything critical in one place, to print or save as PDF.
   Nothing here is a new rule: it gathers what the summary, the story, the requests, the quarters and the review session
   already work out, so the page can't disagree with the screen. */
import { causeLabel } from './checkin';
import { fmt, NO_VALUE } from './format';
import { WEEKDAY } from './progress';
import { answeredSince, askText, openFor } from './asks';
import { answerOf, DECISION_LABEL, isHealthy, reviewSession, saidIn, type Said as SaidInReview } from './review';
import { LABEL, RANK } from './status';
import { summarise, type GoalSummary } from './summary';
import { attentionFor } from './attention';
import { isYear, type QuarterResult } from './year';
import type { CheckIn, Cycle, Decision, DisplayStatus, Goal, Review, Snapshot } from './types';

export interface Fact { label: string; text: string }
export interface Said { id: string; kind: Decision['kind']; label: string; note: string; by: string; week: number; review: string | null; who: string | null; dueWeek: number | null; answer: string | null }
export interface OpenAsk { ask: string; from: string; to: string; createdAt: string; waiting: number }

export interface GoalSheet {
  summary: GoalSummary;
  /** What it feeds, and the owner's reason it helps. */
  feeds: { title: string; why: string } | null;
  /** Where it stands, why, the path to green (or what happens next) and what it needs: the story's facts, those that apply. */
  facts: Fact[];
  latest: { c: CheckIn; by: string; value: string; reason: string } | null;
  open: OpenAsk[];
  answered: { ask: string; answer: string; by: string; at: string } | null;
  /** What reviews said about it: actions, questions (with the owner's answer) and notes, newest first. */
  said: Said[];
  quarters: QuarterResult[];
  contributing: { goal: Goal; status: DisplayStatus; now: string; gap: string }[];
}

const name = (s: Snapshot, id: string | null | undefined) => (id ? s.people.find((p) => p.id === id)?.name ?? 'someone' : 'anyone');

function saidOf(d: SaidInReview, s: Snapshot): Said {
  const g = s.goals.find((x) => x.id === d.goalId);
  return {
    id: d.id, kind: d.kind, label: DECISION_LABEL[d.kind], note: d.note, by: name(s, d.byId), week: d.week,
    review: s.reviews.find((r) => r.id === d.reviewId)?.name ?? null,
    who: d.kind === 'action' ? name(s, d.assigneeId ?? g?.ownerId) : null,
    dueWeek: d.kind === 'action' ? d.dueWeek ?? null : null,
    answer: d.ask ? answerOf(d)?.text ?? null : null,
  };
}

const said = (d: Decision) => d.kind === 'ask' || d.kind === 'action' || d.kind === 'note';
/** "Do this. By then." from parts that may or may not end in a full stop. */
const sentences = (...parts: (string | null)[]) => parts.filter((p): p is string => !!p).map((p) => p.trim().replace(/[.\s]+$/, '')).join('. ') + '.';

export function goalSheet(goal: Goal, s: Snapshot, cycle: Cycle, week: number, today: Date): GoalSheet {
  const sum = summarise(goal, s, cycle, today, week);
  const st = sum.story;
  const parent = goal.parentId ? s.goals.find((g) => g.id === goal.parentId) : undefined;
  const facts: Fact[] = [{ label: 'Where it stands', text: st.where }];
  if (st.outlook) facts.push({ label: 'Where the trend takes it', text: st.outlook });
  if (st.why) facts.push({ label: 'Why', text: st.why });
  if (st.doing || st.byWhen) facts.push({ label: 'Path to green', text: sentences(st.doing, st.byWhen) });
  else if (st.next) facts.push({ label: 'What happens next', text: st.next });
  if (st.needs) facts.push({ label: 'What it needs', text: st.needs });
  st.warnings.forEach((w) => facts.push({ label: 'Watch for', text: w }));
  const last = sum.checkIns.at(-1) ?? null;
  const latest = last ? {
    c: last,
    by: name(s, last.authorId),
    value: goal.kind === 'milestone' ? sum.now : last.value == null ? NO_VALUE : fmt(last.value, goal),
    reason: [last.cause ? causeLabel(last.cause) : '', last.why && last.why !== 'On plan.' ? last.why : ''].filter(Boolean).join('. '),
  } : null;
  const open = openFor(goal.id, s).map((r) => ({ ask: askText(r, s.people), from: name(s, r.askedBy), to: name(s, r.recipientId), createdAt: r.createdAt, waiting: r.goalIds.length }));
  const ans = answeredSince(goal.id, last?.postedAt ?? null, s);
  const children = s.goals.filter((g) => g.parentId === goal.id)
    .map((g) => ({ g, a: attentionFor(g, s, cycle, today) }))
    .sort((x, y) => y.a.weight - x.a.weight || RANK[y.a.status.status] - RANK[x.a.status.status] || x.g.title.localeCompare(y.g.title))
    .map(({ g }) => { const c = summarise(g, s, cycle, today, week); return { goal: g, status: c.status, now: c.now, gap: c.gap }; });
  return {
    summary: sum,
    feeds: parent ? { title: parent.title, why: goal.whyHelps ?? '' } : null,
    facts,
    latest,
    open,
    answered: ans ? { ask: askText(ans, s.people), answer: ans.answer ?? '', by: name(s, ans.answeredBy), at: ans.answeredAt ?? '' } : null,
    said: saidIn(s).filter((d) => d.goalId === goal.id && said(d)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((d) => saidOf(d, s)),
    quarters: isYear(cycle) && !st.quarters.every((q) => q.kind === 'none') ? st.quarters : [],
    contributing: children,
  };
}

export interface ReviewSheetItem {
  goal: Goal;
  owner: string;
  status: DisplayStatus;
  statusLabel: string;
  /** On track with nothing flagged: one line is enough. */
  healthy: boolean;
  covered: boolean;
  facts: Fact[];
  /** What was said about it in this session. */
  said: Said[];
  /** Nothing said yet this session: what this review said last time, so the page still carries it. */
  earlier: Said[];
}

export interface ReviewSheet {
  review: Review;
  cadence: string;
  week: number;
  date: string;
  done: number;
  total: number;
  people: string[];
  /** Worst and stalest first: the session's own order. */
  items: ReviewSheetItem[];
}

export function reviewSheet(r: Review, s: Snapshot, cycle: Cycle, week: number, today: Date): ReviewSheet {
  const ses = reviewSession(r, s, cycle, today, week);
  const items = ses.items.map((a): ReviewSheetItem => {
    const sum = summarise(a.goal, s, cycle, today, week);
    const st = sum.story;
    const healthy = isHealthy(a);
    const facts: Fact[] = [{ label: 'Where it stands', text: st.where }];
    if (!healthy) {
      if (st.why) facts.push({ label: 'Why', text: st.why });
      if (st.doing || st.byWhen) facts.push({ label: 'Path to green', text: sentences(st.doing, st.byWhen) });
      if (st.needs) facts.push({ label: 'What it needs', text: st.needs });
      st.warnings.forEach((w) => facts.push({ label: 'Watch for', text: w }));
    }
    const now = ses.said.filter((d) => d.goalId === a.goal.id && said(d));
    const before = now.length ? [] : saidIn(s).filter((d) => d.goalId === a.goal.id && d.reviewId === r.id && d.week < ses.week && said(d)).sort((x, y) => y.at.localeCompare(x.at));
    const lastWeek = before[0]?.week;
    return {
      goal: a.goal, owner: sum.owner, status: sum.status, statusLabel: st.label ?? LABEL[sum.status], healthy, covered: ses.covered.has(a.goal.id), facts,
      said: now.map((d) => saidOf(d, s)),
      earlier: before.filter((d) => d.week === lastWeek).map((d) => saidOf(d, s)),
    };
  });
  return {
    review: r,
    cadence: `${r.everyWeeks === 1 ? 'Every week' : `Every ${r.everyWeeks} weeks`}, ${WEEKDAY[r.weekday]}s`,
    week: ses.week, date: ses.date, done: ses.done, total: ses.total,
    people: r.people.map((id) => name(s, id)),
    items,
  };
}
