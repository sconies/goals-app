/* What a check-in must say before it can be posted. */
import { assessMetric, assessMilestone, assessRange, checkInsFor, RANK, type Assessment } from './status';
import type { Cause, CheckIn, Cycle, Goal, StageUpdate, Status, RecoveryState } from './types';
import { isCount, isShare } from './plan';
import { farOutside, fixed, notNumberText, precisionProblem, usuallyPositive } from './numbers';

export const CAUSES_BEHIND: [Cause, string][] = [
  ['aggressive', 'Plan too aggressive'], ['slower', 'Delivery slower'], ['blocked', 'Blocked by a dependency'], ['external', 'External factor'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const CAUSES_AHEAD: [Cause, string][] = [
  ['cautious', 'Plan too cautious'], ['early', 'Change landed early'], ['external', 'External factor'], ['oneoff', 'One-off, won’t last'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const causeLabel = (c: Cause | null) => [...CAUSES_BEHIND, ...CAUSES_AHEAD].find(([k]) => k === c)?.[1] ?? '';

export const MIN_REASON = 10;
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

/**
 * A number as people type it: "29.4", "29,4" (a decimal comma), "1,250" (thousands), "62%", "29.4 days".
 * Anything else (hex, exponents, words) is not a number.
 */
export function parseNumber(s: string): number | null {
  let t = s.trim().replace(/\s*(%|[a-z]+(\s[a-z]+)*)$/i, '').replace(/\s/g, '');
  if (!t) return null;
  if (/^[-+]?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : null;
}

// What values a goal's number can take (a share, a count) is plan.ts's, where projections are held to them.
export { isCount, isShare } from './plan';

/** The places to show a number at: its goal's, or as many as it has when there's no goal. */
const decimalsOf = (goal: Goal | undefined, n: number) => (goal && goal.kind !== 'milestone' ? goal.decimals : (String(n).split('.')[1] ?? '').length);

/** Why a typed value can't be used, or a check worth making before posting it. */
export function valueProblem(raw: string, last: number | null, unit: string, goal?: Goal): { block: boolean; text: string } | null {
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
    return isShare(goal) ? { block: true, text: 'It can’t be over 100%: this goal measures a share of something.' } : { block: false, text: 'That’s over 100%. Is that right?' };
  }
  if (goal?.kind === 'metric' && farOutside(n, goal.plan.start, goal.plan.target)) {
    const d = goal.decimals, u = unit === '%' ? '%' : unit ? ' ' + unit : '';
    return { block: false, text: `That’s far outside this goal’s plan (${fixed(goal.plan.start, d)} to ${fixed(goal.plan.target, d)}${u}). Is ${fixed(n, Math.max(d, 0))} right?` };
  }
  // Past a count's target ("41" for the top 40 service pairs) is worth a question: the target is often all there is.
  if (goal?.kind === 'metric' && isCount(goal) && (goal.plan.target > goal.plan.start ? n > goal.plan.target : n < goal.plan.target)) {
    return { block: false, text: `That’s past the target of ${fixed(goal.plan.target, 0)}${unit ? ' ' + unit : ''}. Is ${fixed(n, 0)} right?` };
  }
  if (last != null && last !== 0 && (n / last > 3 || n / last < 1 / 3)) return { block: false, text: `Last week was ${fixed(last, decimalsOf(goal, last))}. Is ${fixed(n, decimalsOf(goal, n))} right?` };
  return null;
}

/** The goal's latest number, the one a new number is compared with. */
export const lastValueOf = (goal: Goal, all: CheckIn[]): number | null => checkInsFor(goal, all).filter((c) => c.value != null).pop()?.value ?? null;

/**
 * The one number check (deep review U10): the check-in form, the one-table check-in and the import all ask it, so a number
 * is refused or questioned the same way, with the same words, wherever it is typed.
 */
export const numberCheck = (goal: Goal, raw: string, all: CheckIn[]) => valueProblem(raw, lastValueOf(goal, all), goal.kind === 'milestone' ? '' : goal.unit, goal);

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
}

export function evaluate(goal: Goal, cycle: Cycle, week: number, draft: Draft, all: CheckIn[]): Evaluation {
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
  const calc: Status = a.calc === 'planned' || a.calc === 'none' ? 'on' : a.calc;
  const status = draft.status ?? calc;
  const greener = RANK[status] < RANK[calc];

  let reason: Evaluation['reason'] = null;
  if (a.kind === 'metric') reason = a.ahead ? 'ahead' : a.behind ? 'behind' : null;
  else if (a.calc === 'risk' || a.calc === 'off') reason = 'behind';
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
  return { assessment, calc, status, greener, reason, asksTarget, needsPath, unchanged, codes, missing: codes.map((c) => MISSING_TEXT[c]), canPost: codes.length === 0 };
}

/** Turn a valid draft into a check-in record. Throws if the draft cannot be posted. */
export function toCheckIn(goal: Goal, cycle: Cycle, week: number, draft: Draft, all: CheckIn[], authorId: string, now: Date, id: string): CheckIn {
  const e = evaluate(goal, cycle, week, draft, all);
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
