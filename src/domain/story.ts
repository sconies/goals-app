/* The story of a goal, for leaders managing by exception: what the status means, why it's off, what the owner
   will do about it, by when, what they need and from whom, and anything the numbers would otherwise hide
   (a date that has slipped, no recovery plan, a call greener than the numbers, a goal gone quiet).
   Also the result once a goal is due: Completed, Completed late or Did not meet. */
import { causeLabel } from './checkin';
import { fmt, fmtDiff, LEVEL_LABEL, NO_VALUE } from './format';
import { planAt, planEnd, resultWeek, weekDates } from './plan';
import { assessPosted, checkInsFor, goalStatus, projects } from './status';
import { flagsFor } from './attention';
import { FLAG, LABEL, MEANING, RESULT_MEANING, RESULT_TEXT, SHORT_MEANING, WARNING, type FlagKind, type ResultKind, type WarningKind } from './vocabulary';
import { answeredSince, askText, openFor } from './asks';
import { forecastText } from './tree';
import { isYear, quarterOf, quarterResults, targetAt, type QuarterResult } from './year';
import type { CheckIn, Cycle, DisplayStatus, Goal, Snapshot } from './types';
import { NO_REASON } from './checkin';

/* ---------- what each status means, and each result: the vocabulary's words (domain/vocabulary.ts) ---------- */

export { MEANING, RESULT_MEANING, RESULT_TEXT, SHORT_MEANING, type ResultKind };

/* ---------- results, once a goal is due ---------- */

export interface Result { kind: ResultKind; dueWeek: number; week: number | null; text: string }

/** The week a goal is due: its plan's end, its last stage, or the end of the cycle. */
export function dueWeekOf(g: Goal, cycle: Cycle): number {
  if (g.kind === 'metric') return planEnd(g.plan, cycle.weeks);
  if (g.kind === 'milestone') return Math.max(1, ...g.stages.map((s) => s.dueWeek));
  return cycle.weeks;
}

/** Met, Met late or Not met (the vocabulary's RESULT); null while the goal isn't due yet and isn't complete. */
export function goalResult(g: Goal, cycle: Cycle, checkIns: CheckIn[], week: number): Result | null {
  const own = checkInsFor(g, checkIns);
  const due = dueWeekOf(g, cycle);
  const make = (kind: ResultKind, at: number | null): Result => ({
    kind, dueWeek: due, week: at,
    text: kind === 'completed' ? `${RESULT_TEXT.completed}${at != null ? ` in week ${at}` : ''}` : kind === 'late' ? `${RESULT_TEXT.late}: week ${at}, due week ${due}` : `${RESULT_TEXT.missed}: due week ${due}`,
  });
  let hit: number | null = null;
  if (g.kind === 'metric') {
    // Before it's due, only the owner calling it done completes it: a number touching the target early can slip back.
    const up = g.plan.target >= g.plan.start;
    const reached = (c: CheckIn) => c.value != null && (up ? c.value >= g.plan.target : c.value <= g.plan.target);
    const doneCall = own.find((c) => c.status === 'done');
    if (doneCall && doneCall.week <= due) hit = doneCall.week;
    else if (week > due || own.some((c) => c.week >= due)) {
      const atDue = own.filter((c) => c.week <= due && c.value != null).pop();
      hit = atDue && atDue.week >= due - 1 && reached(atDue) ? atDue.week : own.find((c) => c.week > due && (reached(c) || c.status === 'done'))?.week ?? null;
      if (hit == null && doneCall) hit = doneCall.week;
    }
  } else if (g.kind === 'milestone') {
    const done = own.find((c) => c.status === 'done' || (c.stages && g.stages.every((s) => c.stages!.some((u) => u.stageId === s.id && u.doneWeek != null))));
    if (done) {
      const weeks = (done.stages ?? []).filter((u) => u.doneWeek != null).map((u) => u.doneWeek!);
      hit = weeks.length ? Math.max(...weeks) : done.week;
    }
  } else {
    // A range is kept, or not, at the end: judged on the last check-in from its due week on.
    const doneCall = own.find((c) => c.status === 'done');
    if (doneCall) hit = doneCall.week;
    else {
      const end = own.filter((c) => c.week >= due && c.value != null).pop();
      if (!end) return week > due ? make('missed', null) : null;
      const out = g.range.bound === 'atMost' ? end.value! > g.range.limit : end.value! < g.range.limit;
      return out ? make('missed', end.week) : make('completed', end.week);
    }
  }
  if (hit != null) return make(hit <= due ? 'completed' : 'late', hit);
  return week > due ? make('missed', null) : null;
}

/* ---------- the story ---------- */

/** What the numbers would otherwise hide: the attention flags a story repeats, and the warnings only a story gives. */
export type StoryFlag = Extract<FlagKind, 'no-path' | 'missed-path' | 'greener' | 'stale' | 'trend'> | WarningKind;
const STORY_FLAGS: FlagKind[] = ['stale', 'missed-path', 'no-path', 'trend', 'greener'];

export interface Story {
  status: DisplayStatus;
  /** "Off track since week 6", "At risk for 3 weeks". */
  since: string | null;
  /** Where it is, in numbers or stages, against plan and target. */
  where: string;
  /** Where the trend takes it. */
  outlook: string | null;
  why: string | null;
  /** What the owner will do about it. */
  doing: string | null;
  /** When it will be back on plan, or why there's no date. */
  byWhen: string | null;
  /** What it's waiting on: the open requests for a decision or help (its own, and any it's linked to). */
  needs: string | null;
  /** A request answered since the latest check-in: what the next review needs to know. */
  answered: { ask: string; answer: string; by: string; at: string } | null;
  next: string | null;
  /** What the numbers would otherwise hide. */
  warnings: string[];
  /** The same warnings as kinds, for filtering. */
  flags: StoryFlag[];
  feeds: string | null;
  result: Result | null;
  /** In a goal year: each quarter against the plan (met, missed, open). */
  quarters: QuarterResult[];
  /** The status as a short label, or the result once due. */
  label: string;
}

const BEHIND: DisplayStatus[] = ['off', 'risk'];

export function storyOf(g: Goal, s: Snapshot, cycle: Cycle, week: number, today: Date): Story {
  const st = goalStatus(g, cycle, s.checkIns, today);
  const own = checkInsFor(g, s.checkIns);
  const last = own[own.length - 1] ?? null;
  const a = assessPosted(g, cycle, s.checkIns, week);
  const status = st.status;
  const behind = BEHIND.includes(status);
  // Results and quarters are judged at the week after the last once the cycle has ended (cycle-end rule 2).
  const rw = Math.max(week, resultWeek(cycle, today));
  const result = goalResult(g, cycle, s.checkIns, rw);
  const warnings: string[] = [];
  const flags: StoryFlag[] = [];
  const warn = (kind: StoryFlag, text: string) => { flags.push(kind); warnings.push(text); };

  // How long it's been in this state: consecutive check-ins with the same call.
  let since: string | null = null;
  if (last && (behind || status === 'on')) {
    let k = own.length - 1;
    while (k > 0 && own[k - 1]!.status === last.status) k--;
    const from = own[k]!.week;
    const n = own.length - k;
    since = n >= 2 ? `Since week ${from}, ${n} check-ins running` : `Since week ${from}`;
  }
  if (status === 'stale') {
    since = last ? `No check-in for ${st.daysSinceCheckIn} days; last heard in week ${last.week}` : 'No check-in this cycle';
  }

  // Where it is.
  const due = dueWeekOf(g, cycle);
  let where = '';
  if (g.kind === 'metric' && a.kind === 'metric') {
    if (a.actual == null) where = `${NO_VALUE}. Target ${fmt(g.plan.target, g)} by week ${due}.`;
    else {
      const diff = Number((a.actual - a.plan).toFixed(g.decimals));
      where = `${fmt(a.actual, g)} in week ${a.week}, against a plan of ${fmt(a.plan, g)}${diff ? ` (${fmtDiff(diff, g)} ${diff > 0 ? 'above' : 'below'})` : ''}. Target ${fmt(g.plan.target, g)} by week ${due} (${weekDates(cycle, due)}).`;
      if (status === 'stale') where += ` The plan for this week is ${fmt(planAt(g.plan, week, cycle.weeks), g)}.`;
    }
  } else if (g.kind === 'range' && a.kind === 'range') {
    const lim = (g.range.bound === 'atMost' ? 'at most ' : 'at least ') + fmt(g.range.limit, g);
    where = a.actual == null ? `${NO_VALUE}. Must stay ${lim}.` : `${fmt(a.actual, g)} in week ${a.week}; must stay ${lim}${a.out ? ', and it isn’t' : a.near ? ', and it’s close' : ''}.`;
  } else if (g.kind === 'milestone' && a.kind === 'milestone') {
    const late = a.late.map((x) => `${x.name} (due week ${x.dueWeek}, now expected week ${x.expectedWeek})`);
    where = `${a.doneCount} of ${a.stages.length} stages done.${late.length ? ` Late: ${late.join('; ')}.` : ''}`;
  }
  if (isYear(cycle) && g.kind === 'metric' && week >= 1 && week <= due) {
    const q = quarterOf(cycle, week);
    const end = Math.min(q.to, due);
    if (end < due) where += ` ${q.label} plan: ${fmt(targetAt(g, cycle, end)!, g)} by week ${end}.`;
  }
  const quarters = quarterResults(g, cycle, s.checkIns, rw);
  const lastEnded = [...quarters].reverse().find((x) => x.kind === 'met' || x.kind === 'missed');
  const fc = forecastText(g, a, cycle.weeks, cycle);
  // A goal gone quiet has no trustworthy forecast: its numbers are out of date.
  const outlook = fc && projects(g, status) ? fc.text : null;

  // Why, what the owner will do, by when, what they need.
  let why: string | null = null, doing: string | null = null, byWhen: string | null = null, needs: string | null = null;
  const ptg = last?.pathToGreen ?? null;
  if (behind && last) {
    const reason = last.why && last.why !== NO_REASON ? last.why : '';
    why = [last.cause ? causeLabel(last.cause) : '', reason].filter(Boolean).join('. ') || null;
    if (ptg) {
      doing = ptg.what;
      const state = ptg.state ?? 'plan';
      byWhen = ptg.byWeek != null ? `Owner’s date: back on plan by week ${ptg.byWeek} (${weekDates(cycle, ptg.byWeek)})${state === 'help' ? ', once the decision or help arrives' : ''}`
        : state === 'investigating' ? 'No date yet: still working out what’s wrong'
        : state === 'help' ? 'No date until the decision or help arrives'
        : state === 'target' ? 'The owner says the target should change'
        : null;
    }
    // What it's waiting on comes from the requests themselves: open until answered or withdrawn (domain/asks).
    const open = openFor(g.id, s);
    needs = open.map((r) => askText(r, s.people) + (r.goalIds[0] !== g.id ? ` (the same request as ${s.goals.find((x) => x.id === r.goalIds[0])?.title ?? 'another goal'})` : '')).join('; ') || null;
    if (ptg && (ptg.state ?? 'plan') === 'help' && !open.length && answeredSince(g.id, last?.postedAt ?? null, s)) byWhen = 'Answer given: the owner’s next check-in says what it changes';
    // A date that keeps moving: the first date given in this run of weeks behind, against today's.
    let k = own.length - 1;
    while (k > 0 && BEHIND.includes(own[k - 1]!.status)) k--;
    const firstDate = own.slice(k).map((c) => c.pathToGreen?.byWeek).find((w) => w != null);
    if (firstDate != null && ptg?.byWeek != null && ptg.byWeek > firstDate) warn('slipped', `${WARNING.slipped.label}. First said back on plan by week ${firstDate}, now week ${ptg.byWeek}.`);
    const run = own.slice(k);
    if (run.length >= 3 && last.cause && run.slice(-3).every((c) => c.cause === last.cause)) warn('same-cause', `${WARNING['same-cause'].label}. ${causeLabel(last.cause)}, three check-ins running.`);
  }
  // The flags a story shares with Needs attention say exactly what the flag says (domain/attention.ts), word and detail.
  for (const f of flagsFor(g, s, cycle, today).flags) {
    if (!STORY_FLAGS.includes(f.kind)) continue;
    const detail = f.kind === 'stale' && last ? `Last word was ${LABEL[last.status].toLowerCase()}${last.value != null && g.kind !== 'milestone' ? ` at ${fmt(last.value, g)}` : ''}, in week ${last.week}.` : f.detail;
    warn(f.kind as StoryFlag, `${FLAG[f.kind].label}. ${detail}`);
  }
  if (lastEnded?.kind === 'missed' && !result) warn('missed-quarter', `${WARNING['missed-quarter'].label}. ${lastEnded.text}.`);

  const parent = g.parentId ? s.goals.find((x) => x.id === g.parentId) : null;
  const feeds = parent ? `Feeds ${parent.title}${parent.level !== 'team' ? ` (${LEVEL_LABEL[parent.level]})` : ''}` : null;
  const label = result ? RESULT_TEXT[result.kind] : LABEL[status];
  const ans = answeredSince(g.id, last?.postedAt ?? null, s);
  const answered = ans ? { ask: askText(ans, s.people), answer: ans.answer ?? '', by: s.people.find((p) => p.id === ans.answeredBy)?.name ?? 'someone', at: ans.answeredAt ?? '' } : null;
  return { status, since, where, outlook, why, doing, byWhen, needs, answered, next: (behind || status === 'on') && last?.next ? last.next : null, warnings, flags, feeds, result, quarters, label };
}
