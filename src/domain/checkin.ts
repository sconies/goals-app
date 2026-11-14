/* What a check-in must say before it can be posted. */
import { assessMetric, assessMilestone, assessRange, checkInsFor, RANK, type Assessment } from './status';
import type { Cause, CheckIn, Cycle, Goal, StageUpdate, Status, RecoveryState } from './types';
import { isCount, isShare } from './plan';
import { fmt } from './format';
import { guardedCalc, type GuardBreach } from './guards';
import { farOutside, fixed, notNumberText, parseNumber, precisionProblem, usuallyPositive } from './numbers';

export const CAUSES_BEHIND: [Cause, string][] = [
  ['aggressive', 'Plan too aggressive'], ['slower', 'Delivery slower'], ['blocked', 'Blocked by a dependency'], ['external', 'External factor'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const CAUSES_AHEAD: [Cause, string][] = [
  ['cautious', 'Plan too cautious'], ['early', 'Change landed early'], ['external', 'External factor'], ['oneoff', 'One-off, won’t last'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const causeLabel = (c: Cause | null) => [...CAUSES_BEHIND, ...CAUSES_AHEAD].find(([k]) => k === c)?.[1] ?? '';

export const MIN_REASON = 10;
/** A correction's reason, at least this long (check-in spec rule 8): said once here, so the form needs no engine to check it. */
export const MIN_CORRECT_REASON = 10;
/** The why older check-ins stored when nothing needed explaining. Not a reason, and never shown as one. */
export const NO_REASON = 'On plan.';
/** A check-in's why, when it is a reason someone gave. */
export const reasonOf = (why: string | null | undefined): string | null => (why && why.trim() !== '' && why !== NO_REASON ? why : null);
export const MIN_PATH = 8;

/** The form as the owner fills it in. Numbers stay strings until posted. */
export interface Draft {
  value: string;
  stages: StageUpdate[];
  status: Status | null;
  cause: Cause | null;
  why: string;
  greenerWhy: string;
  proposeTarget: string;
  ptgWhat: string;
  ptgBy: number | null;
  /** Where the owner is with getting back on plan; only 'plan' needs a week. */
  ptgState?: RecoveryState;
  needs: string;
  next: string;
  dataFlagged: boolean;
  /** The reason and path copied in from the last check-in, as they were, when the owner chose "Something changed"
      (deep review U9). While they're still word for word the same, the owner says whether they're still true. */
  carried?: CarriedStory | null;
  /** The owner said the carried words are still true this week. */
  stillTrue?: boolean;
  /** Questions answered yes (rule 2), each with the value it was answered for. */
  answers?: Answers;
}

/** Last check-in's account, as copied into a new draft. */
export interface CarriedStory { cause: Cause | null; why: string; what: string; by: number | null }

/** The parts of a carried account that are still word for word the same and still asked for: the reason, the path. */
export function unchangedStory(draft: Draft, reason: boolean, path: boolean): ('reason' | 'path')[] {
  const c = draft.carried;
  if (!c) return [];
  const out: ('reason' | 'path')[] = [];
  if (reason && c.why.trim() && draft.cause === c.cause && draft.why.trim() === c.why.trim()) out.push('reason');
  if (path && c.what.trim() && draft.ptgWhat.trim() === c.what.trim() && draft.ptgBy === c.by) out.push('path');
  return out;
}

export function emptyDraft(goal: Goal, previous: CheckIn | null): Draft {
  return {
    value: '',
    stages: goal.kind === 'milestone'
      ? goal.stages.map((s) => previous?.stages?.find((u) => u.stageId === s.id) ?? { stageId: s.id, doneWeek: null, forecastWeek: null })
      : [],
    status: null, cause: null, why: '', greenerWhy: '', proposeTarget: '', ptgWhat: '', ptgBy: null, needs: '', next: '', dataFlagged: false,
  };
}

/** A draft filled from a posted check-in, for editing it. */
export function draftFrom(c: CheckIn): Draft {
  return {
    value: c.value == null ? '' : String(c.value),
    stages: c.stages ?? [],
    status: c.status, cause: c.cause, why: c.why, greenerWhy: c.greenerWhy,
    proposeTarget: c.proposeTarget == null ? '' : String(c.proposeTarget),
    ptgWhat: c.pathToGreen?.what ?? '', ptgBy: c.pathToGreen?.byWeek ?? null, ptgState: c.pathToGreen?.state ?? 'plan', needs: c.pathToGreen?.needs ?? '',
    next: c.next, dataFlagged: c.dataFlagged,
  };
}

/** A number as people type it (domain/numbers, where it lives with the rest of how numbers are read). */
export { parseNumber } from './numbers';

// What values a goal's number can take (a share, a count) is plan.ts's, where projections are held to them.
export { isCount, isShare } from './plan';

/** The places to show a number at: its goal's, or as many as it has when there's no goal. */
const decimalsOf = (goal: Goal | undefined, n: number) => (goal && goal.kind !== 'milestone' ? goal.decimals : (String(n).split('.')[1] ?? '').length);

/** The questions `valueProblem` can ask of a usable number, by id (check-in spec, rule 2). */
export type NumberCheckId = 'over-100' | 'far-outside-plan' | 'past-target' | 'far-from-last';

/** Why a typed value can't be used, or a check worth making before posting it. */
export function valueProblem(raw: string, last: number | null, unit: string, goal?: Goal): { block: boolean; text: string; id?: NumberCheckId } | null {
  if (!raw.trim()) return { block: true, text: 'Type this week’s number.' };
  const n = parseNumber(raw);
  if (n == null) return { block: true, text: notNumberText(raw, goal && goal.kind !== 'milestone' ? goal.decimals : undefined) };
  const precise = goal && goal.kind !== 'milestone' ? precisionProblem(raw, n, goal.decimals) : null;
  if (precise) return { block: true, text: precise };
  if (n < 0 && usuallyPositive(unit)) return { block: true, text: `It can’t be below zero${unit ? ' ' + unit : ''}.` };
  // A count (pairs, deploys, incidents) can't be below zero either (deep review U10: "-5 pairs" was only questioned).
  if (n < 0 && isCount(goal)) return { block: true, text: `It can’t be below zero${unit ? ' ' + unit : ''}: this goal counts things.` };
  if (unit === '%' && n > 100) {
    // A share of something (coverage, adoption) can't pass 100%. A goal planned beyond 100% (growth, say) can.
    return isShare(goal) ? { block: true, text: 'It can’t be over 100%: this goal measures a share of something.' } : { block: false, text: 'That’s over 100%. Is that right?', id: 'over-100' };
  }
  if (goal?.kind === 'metric' && farOutside(n, goal.plan.start, goal.plan.target)) {
    const d = goal.decimals, u = unit === '%' ? '%' : unit ? ' ' + unit : '';
    return { block: false, text: `That’s far outside this goal’s plan (${fixed(goal.plan.start, d)} to ${fixed(goal.plan.target, d)}${u}). Is ${fixed(n, Math.max(d, 0))} right?`, id: 'far-outside-plan' };
  }
  // Past a count's target ("41" for the top 40 service pairs) is worth a question: the target is often all there is.
  if (goal?.kind === 'metric' && isCount(goal) && (goal.plan.target > goal.plan.start ? n > goal.plan.target : n < goal.plan.target)) {
    return { block: false, text: `That’s past the target of ${fixed(goal.plan.target, 0)}${unit ? ' ' + unit : ''}. Is ${fixed(n, 0)} right?`, id: 'past-target' };
  }
  if (last != null && last !== 0 && (n / last > 3 || n / last < 1 / 3)) return { block: false, text: `Last week was ${fixed(last, decimalsOf(goal, last))}. Is ${fixed(n, decimalsOf(goal, n))} right?`, id: 'far-from-last' };
  return null;
}

/**
 * What a new number for `week` is compared with (check-in spec, rule 5): the newest check-in of the latest week before it,
 * and the newest number among the weeks before it. A check-in of the same week is never "last week", so a second
 * check-in this week is compared with last week, not with the first.
 */
export function previousFor(own: CheckIn[], week: number): { checkIn: CheckIn | null; number: CheckIn | null } {
  const before = own.filter((c) => c.week < week);
  return { checkIn: before.at(-1) ?? null, number: before.filter((c) => c.value != null).at(-1) ?? null };
}

/** The newest of this week's check-ins, when there is one (a second check-in names it). */
export const earlierThisWeek = (own: CheckIn[], week: number): CheckIn | null => own.filter((c) => c.week === week).at(-1) ?? null;

/** The goal's latest number before `week`, the one a new number for it is compared with (rule 5). */
export const lastValueOf = (goal: Goal, all: CheckIn[], week: number): number | null => previousFor(checkInsFor(goal, all), week).number?.value ?? null;

/**
 * The one number check (deep review U10): the check-in form, the one-table check-in and the import all ask it, so a number
 * is refused or questioned the same way, with the same words, wherever it is typed.
 */
export const numberCheck = (goal: Goal, raw: string, all: CheckIn[], week: number) => valueProblem(raw, lastValueOf(goal, all, week), goal.kind === 'milestone' ? '' : goal.unit, goal);

/**
 * What a check-in can still be missing, as a stable code. Screens and the import read the codes; the words for each are
 * in MISSING_TEXT, so a change of wording never changes what a screen checks.
 */
export type Missing = 'value' | 'value-not-number' | 'value-precision' | 'value-impossible' | 'greener-why' | 'reason-behind' | 'reason-ahead' | 'path' | 'story-unchanged' | 'target';

export const MISSING_TEXT: Record<Missing, string> = {
  value: 'this week’s value',
  'value-not-number': 'a number for this week’s value',
  'value-precision': 'this week’s value at the goal’s decimal places',
  'value-impossible': 'a possible value',
  'greener-why': 'why your call is greener',
  'reason-behind': 'why it’s behind',
  'reason-ahead': 'why it’s ahead',
  path: 'path to green',
  'story-unchanged': 'whether what you said last time is still true',
  target: 'a proposed target beyond the current one',
};

/** The codes that mean this week's number itself isn't usable yet. */
export const VALUE_CODES: readonly Missing[] = ['value', 'value-not-number', 'value-precision', 'value-impossible'];
/** The codes that mean the reason (a cause and a sentence) is still needed. */
export const REASON_CODES: readonly Missing[] = ['reason-behind', 'reason-ahead'];

export interface Evaluation {
  assessment: Assessment;
  /** The calculated status, as a call the owner can make. */
  calc: Status;
  status: Status;
  greener: boolean;
  reason: 'ahead' | 'behind' | null;
  asksTarget: boolean;
  needsPath: boolean;
  /** The parts of last check-in's account carried in unchanged (`unchangedStory`), whether or not they're confirmed. */
  unchanged: ('reason' | 'path')[];
  /** What's still missing, as codes, in the order the check-in asks for them. */
  codes: Missing[];
  /** The same, in words (MISSING_TEXT). */
  missing: string[];
  canPost: boolean;
  /** The guards past their limit that made it worse, if any (GR). */
  breaches: readonly GuardBreach[];
}

/** Judge a check-in draft. `breaches`: the goal's guards past their limit this week (domain/guards guardBreaches), which
    make the calculated status at least as bad as theirs (GR). */
export function evaluate(goal: Goal, cycle: Cycle, week: number, draft: Draft, all: CheckIn[], breaches: readonly GuardBreach[] = []): Evaluation {
  const before = checkInsFor(goal, all).filter((c) => c.week < week);
  const value = parseNumber(draft.value);
  let assessment: Assessment;
  if (goal.kind === 'metric') {
    const history = before.filter((c) => c.value != null).map((c) => ({ week: c.week, value: c.value as number }));
    assessment = assessMetric(goal, cycle.weeks, week, value, history);
  } else if (goal.kind === 'range') {
    assessment = assessRange(goal, week, value, before.filter((c) => c.value != null).pop()?.value ?? null);
  } else {
    assessment = assessMilestone(goal, week, draft.stages);
  }
  const a = assessment;
  const calc: Status = guardedCalc(a.calc === 'planned' || a.calc === 'none' ? 'on' : a.calc, breaches);
  const status = draft.status ?? calc;
  const greener = RANK[status] < RANK[calc];

  let reason: Evaluation['reason'] = null;
  if (a.kind === 'metric') reason = a.ahead ? 'ahead' : a.behind ? 'behind' : null;
  else if (a.calc === 'risk' || a.calc === 'off') reason = 'behind';
  // A guard past its limit (GR) is a reason to say why, as being behind is.
  if (breaches.length && reason !== 'behind' && (calc === 'risk' || calc === 'off')) reason = 'behind';
  const asksTarget = a.kind === 'metric' && a.ahead;
  const needsPath = status === 'risk' || status === 'off';

  const codes: Missing[] = [];
  if (goal.kind !== 'milestone' && value == null) codes.push(draft.value.trim() ? 'value-not-number' : 'value');
  else if (goal.kind !== 'milestone' && precisionProblem(draft.value, value, goal.decimals)) codes.push('value-precision');
  else if (goal.kind !== 'milestone' && valueProblem(draft.value, null, goal.unit, goal)?.block) codes.push('value-impossible');
  if (greener && draft.greenerWhy.trim().length < MIN_REASON) codes.push('greener-why');
  if (reason && (!draft.cause || draft.why.trim().length < MIN_REASON)) codes.push(reason === 'ahead' ? 'reason-ahead' : 'reason-behind');
  const planned = (draft.ptgState ?? 'plan') === 'plan';
  if (needsPath && (draft.ptgWhat.trim().length < MIN_PATH || (planned && (draft.ptgBy == null || draft.ptgBy <= week || draft.ptgBy > cycle.weeks)))) codes.push('path');
  // "Behind needs a story" isn't met by posting last week's story untouched: what's carried in is changed, or said to be
  // still true (deep review U9).
  const unchanged = unchangedStory(draft, !!reason, needsPath);
  if (unchanged.length && !draft.stillTrue) codes.push('story-unchanged');
  if (asksTarget && draft.proposeTarget.trim()) {
    const t = parseNumber(draft.proposeTarget);
    const better = goal.kind === 'metric' && t != null && (goal.plan.target > goal.plan.start ? t > goal.plan.target : t < goal.plan.target);
    if (!better) codes.push('target');
  }
  return { assessment, calc, status, greener, reason, asksTarget, needsPath, unchanged, codes, missing: codes.map((c) => MISSING_TEXT[c]), canPost: codes.length === 0, breaches };
}

/** Turn a valid draft into a check-in record. Throws if the draft cannot be posted. */
export function toCheckIn(goal: Goal, cycle: Cycle, week: number, draft: Draft, all: CheckIn[], authorId: string, now: Date, id: string, breaches: readonly GuardBreach[] = []): CheckIn {
  const e = evaluate(goal, cycle, week, draft, all, breaches);
  if (!e.canPost) throw new Error('Still needed: ' + e.missing.join(', '));
  return {
    id, goalId: goal.id, authorId, week, postedAt: now.toISOString(),
    value: goal.kind === 'milestone' ? null : parseNumber(draft.value),
    stages: goal.kind === 'milestone' ? draft.stages : null,
    status: e.status, calculated: e.calc,
    cause: e.reason ? draft.cause : null,
    why: draft.why.trim(),
    greenerWhy: e.greener ? draft.greenerWhy.trim() : '',
    proposeTarget: e.asksTarget ? parseNumber(draft.proposeTarget) : null,
    pathToGreen: e.needsPath ? { what: draft.ptgWhat.trim(), byWeek: (draft.ptgState ?? 'plan') === 'plan' ? draft.ptgBy : null, needs: draft.needs.trim(), state: draft.ptgState ?? 'plan' } : null,
    next: draft.next.trim(),
    dataFlagged: draft.dataFlagged,
  };
}

/** When the note offered back was written (review F10): a correction in the same week asks about this week's earlier
    check-in, not "last week"; an older one names its week. */
export const saidWhen = (said: number, week: number) => (said >= week ? 'in this week’s earlier check-in' : said === week - 1 ? 'last week' : `in week ${said}`);

/* ---------- a goal not born late (onboarding spec, rules 3 and 4; OB2) ---------- */

/** How many weeks back a goal's first number may restart its plan: a goal quiet longer than this is just behind. */
export const REBASE_WEEKS = 4;

/**
 * Rule 4. Whether the first check-in offers to start the plan from the number typed: a number to move, with no check-in
 * yet, set up at most four weeks ago, whose number is valid, would not be on plan, and hasn't reached the target.
 */
export function rebaseOffer(goal: Goal, cycle: Cycle, week: number, value: number | null, all: CheckIn[], createdWeek: number): { start: number; value: number } | null {
  if (goal.kind !== 'metric' || value == null || !Number.isFinite(value)) return null;
  if (checkInsFor(goal, all).length) return null;
  if (week - createdWeek > REBASE_WEEKS) return null;
  const dir = Math.sign(goal.plan.target - goal.plan.start) || 1;
  if ((goal.plan.target - value) * dir <= 0) return null;
  if (value === goal.plan.start) return null;
  const e = evaluate(goal, cycle, week, { ...emptyDraft(goal, null), value: String(value) }, all);
  if (e.calc === 'on' && !e.reason) return null;
  return { start: goal.plan.start, value };
}

/** Rule 4. The goal with its plan started from `value` this week: the same target, due week and shape; hand-set points from this week on kept. */
export function rebase(goal: Goal, value: number, week: number): Goal {
  if (goal.kind !== 'metric') return goal;
  const points = goal.plan.points?.filter((p) => p.week > week);
  return { ...goal, plan: { ...goal.plan, start: value, fromWeek: week, ...(points ? { points } : {}) } };
}

/** The words logged with a re-based plan: it needs no reason, since no check-in had started. */
export const rebaseWhy = (value: string, start: string) => `Started the plan from ${value} at the first check-in (was ${start})`;

/* ---------- the levels in a check-in (check-in spec, rules 2 and 3; CK2) ---------- */

/** What a check-in asks before it posts: a number that looks wrong, or the same number as last week. */
export type CheckId = NumberCheckId | 'same-as-last';
/** A question that must be answered before the check-in posts. `key` is the value it is about: a changed value asks again. */
export interface Check { id: CheckId; field: 'value'; question: string; yes: string; no: string; key: string }
/** Something that must be fixed before the check-in posts: the field and what it says. */
export interface MustFix { field: string; says: string }
/** The answers given, by Check id: the key each was given for. */
export type Answers = Partial<Record<CheckId, string>>;

/**
 * Rule 2. What must be fixed and what must be answered before a check-in for `week` posts, in the order the screen asks.
 * Only the first number question that applies is asked (in `valueProblem`'s order); "the same as last week" is asked of a
 * number goal not yet at its target, never of a number kept in a range. A carried story still true is `evaluate`'s.
 */
export function checkInLevels(goal: Goal, week: number, draft: Draft, own: CheckIn[]): { mustFix: MustFix[]; checks: Check[] } {
  if (goal.kind === 'milestone') return { mustFix: [], checks: [] };
  const mustFix: MustFix[] = [];
  const checks: Check[] = [];
  const last = previousFor(own, week).number;
  const p = valueProblem(draft.value, last?.value ?? null, goal.unit, goal);
  const n = parseNumber(draft.value);
  // The app's one number formatter, so 1 reads “1 hour” (build review of #160).
  const u = (v: number) => fmt(v, goal);
  if (p?.block) mustFix.push({ field: 'This week’s number', says: p.text });
  else if (p && n != null) {
    const question = p.id === 'far-from-last' && last ? `Week ${last.week} was ${u(last.value!)}. Is ${u(n)} right?` : p.text;
    checks.push({ id: p.id ?? 'far-from-last', field: 'value', question, yes: `Yes, ${u(n)} is right`, no: 'Change the number', key: String(n) });
  } else if (n != null && last?.value === n && goal.kind === 'metric' && !reached(goal, n)) {
    checks.push({ id: 'same-as-last', field: 'value', question: `The same as week ${last.week}: ${u(n)}. Did you measure it again this week?`, yes: 'Yes, measured again', no: 'No new number this week', key: String(n) });
  }
  return { mustFix, checks };
}

/** Whether a number goal has reached its target with this number (the same number then is expected). */
const reached = (goal: Goal, n: number) => goal.kind === 'metric' && (goal.plan.target >= goal.plan.start ? n >= goal.plan.target : n <= goal.plan.target);

/**
 * The Checks not yet answered for the values they are about: a check is answered when `answers[slot]` (its `slot`, or
 * its id) holds its key, so a changed value asks again. Shared by the check-in and goal entry (rule 3).
 */
export const unanswered = <C extends { id: string; key: string; slot?: string }>(checks: readonly C[], answers: Readonly<Record<string, string | undefined>> | undefined): C[] =>
  checks.filter((c) => answers?.[c.slot ?? c.id] !== c.key);

/** Rule 3. Whether the step's button acts, and if not, the line under it. */
export function stepState(mustFix: MustFix[], open: Check[]): { go: boolean; says: string } {
  if (mustFix.length) {
    const f = mustFix.map((m) => m.field);
    const named = f.length <= 2 ? f.join(' and ') : `${f.slice(0, 2).join(', ')} and ${f.length - 2} more`;
    return { go: false, says: `${f.length === 1 ? '1 thing' : `${f.length} things`} to fix above: ${named}.` };
  }
  if (open.length) return { go: false, says: 'Answer the question above first.' };
  return { go: true, says: '' };
}

/** The answers given, as History keeps them: one difference per question answered (`Asked` for a check-in; goal entry's
    are `Checked`), from the question to the answer given (its yes, unless `said` says otherwise). */
export const answeredDiffs = <C extends { id: string; key: string; slot?: string; question: string; yes: string }>(checks: readonly C[], answers: Readonly<Record<string, string | undefined>> | undefined, field = 'Asked', said: (c: C) => string = (c) => c.yes) =>
  checks.filter((c) => answers?.[c.slot ?? c.id] === c.key).map((c) => ({ field, from: c.question, to: said(c) }));

/** The week's walk as a tab keeps it: the goals in their order, and the ones posted in this walk. */
export interface KeptWalk { queue: string[]; walked: string[] }

/**
 * Where the week's walk starts (NV3; build review of #114). A walk kept for this tab carries on where it was ("2 of 2"
 * after a reload) only if every goal in it is still due or was posted in this walk. A goal checked in some other way
 * since (from the list's row, say) starts a fresh walk of what is due now, so it is never walked again and "n of m" is
 * the list's count.
 */
export function resumeWalk(due: string[], kept: unknown): { walk: KeptWalk; start: number } {
  const k = kept as Partial<KeptWalk> | null;
  if (due.length && k && Array.isArray(k.queue) && Array.isArray(k.walked)) {
    const queue = k.queue.filter((x): x is string => typeof x === 'string');
    const walked = k.walked.filter((x): x is string => typeof x === 'string');
    if (due.every((id) => queue.includes(id)) && queue.every((id) => due.includes(id) || walked.includes(id))) {
      return { walk: { queue, walked }, start: Math.max(0, queue.findIndex((id) => due.includes(id))) };
    }
  }
  return { walk: { queue: due, walked: [] }, start: 0 };
}
