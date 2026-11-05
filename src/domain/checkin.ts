/* What a check-in must say before it can be posted. */
import { assessMetric, assessMilestone, assessRange, checkInsFor, RANK, type Assessment } from './status';
import type { Cause, CheckIn, Cycle, Goal, StageUpdate, Status, RecoveryState } from './types';

export const CAUSES_BEHIND: [Cause, string][] = [
  ['aggressive', 'Plan too aggressive'], ['slower', 'Delivery slower'], ['blocked', 'Blocked by a dependency'], ['external', 'External factor'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const CAUSES_AHEAD: [Cause, string][] = [
  ['cautious', 'Plan too cautious'], ['early', 'Change landed early'], ['external', 'External factor'], ['oneoff', 'One-off, won’t last'], ['data', 'Data problem'], ['other', 'Something else'],
];
export const causeLabel = (c: Cause | null) => [...CAUSES_BEHIND, ...CAUSES_AHEAD].find(([k]) => k === c)?.[1] ?? '';

export const MIN_REASON = 10;
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

/** Does a percentage goal measure a share (its whole plan within 0–100%), so a value over 100% can't be real? */
export function isShare(goal?: Goal): boolean {
  return !!goal && goal.kind !== 'milestone' && goal.unit.trim() === '%' && withinHundred(goal);
}
function withinHundred(goal?: Goal): boolean {
  if (!goal) return false;
  if (goal.kind === 'metric') return [goal.plan.start, goal.plan.target, ...(goal.plan.points ?? []).map((p) => p.value)].every((v) => v >= 0 && v <= 100);
  if (goal.kind === 'range') return goal.range.limit >= 0 && goal.range.limit <= 100;
  return false;
}

/** Why a typed value can't be used, or a check worth making before posting it. */
export function valueProblem(raw: string, last: number | null, unit: string, goal?: Goal): { block: boolean; text: string } | null {
  if (!raw.trim()) return { block: true, text: 'Type this week’s number.' };
  const n = parseNumber(raw);
  if (n == null) return { block: true, text: `“${raw.trim()}” isn’t a number. Type digits only, like 29.4.` };
  if (n < 0 && (unit === '%' || /day|hour|min|week|usd|gbp|eur|\$|£|€/i.test(unit))) return { block: true, text: `It can’t be below zero${unit ? ' ' + unit : ''}.` };
  if (unit === '%' && n > 100) {
    // A share of something (coverage, adoption) can't pass 100%. A goal planned beyond 100% (growth, say) can.
    return withinHundred(goal) ? { block: true, text: 'It can’t be over 100%: this goal measures a share of something.' } : { block: false, text: 'That’s over 100%. Is that right?' };
  }
  if (last != null && last !== 0 && (n / last > 3 || n / last < 1 / 3)) return { block: false, text: `Last week was ${last}. Is ${n} right?` };
  return null;
}

/**
 * What a check-in can still be missing, as a stable code. Screens and the import read the codes; the words for each are
 * in MISSING_TEXT, so a change of wording never changes what a screen checks.
 */
export type Missing = 'value' | 'value-not-number' | 'value-impossible' | 'greener-why' | 'reason-behind' | 'reason-ahead' | 'path' | 'target';

export const MISSING_TEXT: Record<Missing, string> = {
  value: 'this week’s value',
  'value-not-number': 'a number for this week’s value',
  'value-impossible': 'a possible value',
  'greener-why': 'why your call is greener',
  'reason-behind': 'why it’s behind',
  'reason-ahead': 'why it’s ahead',
  path: 'path to green',
  target: 'a proposed target beyond the current one',
};

/** The codes that mean this week's number itself isn't usable yet. */
export const VALUE_CODES: readonly Missing[] = ['value', 'value-not-number', 'value-impossible'];
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
  else if (goal.kind !== 'milestone' && valueProblem(draft.value, null, goal.unit, goal)?.block) codes.push('value-impossible');
  if (greener && draft.greenerWhy.trim().length < MIN_REASON) codes.push('greener-why');
  if (reason && (!draft.cause || draft.why.trim().length < MIN_REASON)) codes.push(reason === 'ahead' ? 'reason-ahead' : 'reason-behind');
  const planned = (draft.ptgState ?? 'plan') === 'plan';
  if (needsPath && (draft.ptgWhat.trim().length < MIN_PATH || (planned && (draft.ptgBy == null || draft.ptgBy <= week || draft.ptgBy > cycle.weeks)))) codes.push('path');
  if (asksTarget && draft.proposeTarget.trim()) {
    const t = parseNumber(draft.proposeTarget);
    const better = goal.kind === 'metric' && t != null && (goal.plan.target > goal.plan.start ? t > goal.plan.target : t < goal.plan.target);
    if (!better) codes.push('target');
  }
  return { assessment, calc, status, greener, reason, asksTarget, needsPath, codes, missing: codes.map((c) => MISSING_TEXT[c]), canPost: codes.length === 0 };
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
