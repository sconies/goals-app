/* Goal entry (docs/design/goal-entry/spec.md, section 6; backlog GE1): one set of rules for every way a goal comes in.
   New goal, the edit page, set-up's goal cards, a Goals row (planChanges: the import, Data, bulk edits) and the AI tools
   all ask `goalMustFix`, in section 4's words; the form saves through `planGoal`, which the `saveGoal` action runs, so
   nothing reaches the store that the engine would refuse.

   - Rule 1, `fieldNeed`: what a field needs, read from the field table (domain/columns FIELDS).
   - Rule 2, `goalMustFix`: what can't be saved, field by field; `decimalsFor` works out the places a goal keeps.
   - Rule 3, `goalChecks`: what is asked (possible but unlikely), each keyed on the values it is about; `unanswered`
     (shared with the check-in, domain/checkin) says which are still open.
   - Rule 4, `stepState`: whether a step of New goal can go on, and the line above its button.
   - Rule 7, `planGoal`: who may (domain/goalRights), and the commit a save makes, with each answer kept as "Checked".

   Pure: no screen, network or database code. No rule takes the workspace: each lists what it reads. */
import { NotAllowed, type ActionContext } from './actions';
import { goalChange, checkInChange, type Lookup } from './changes';
import { answeredDiffs, MIN_REASON, stepState as fixLine, unanswered } from './checkin';
import { fieldNeedOf, type Required } from './columns';
import { buildGoal, decimalsFor, draftOf, pastStage, planChanged, planQuestion, stagesDoneAtSetUp, withPoints, type GoalDraft } from './goal';
import { findGoal, nextKey } from './goalKey';
import { mayAddGoal, mayChangeGoal } from './goalRights';
import { fold } from './find';
import { FAR_RATIO, groupDigits, notNumberText, numberAsTyped, parseNumber, placesText, typedDecimals, usuallyPositive } from './numbers';
import { isTop, levelIds, levelName, levelRank, type LevelsOf } from './levels';
import { lateShare } from './plan';
import { sameTitleGoals } from './people';

export { decimalsFor, unanswered };
import { checkInsFor } from './status';
import { nameProblem } from './thresholds';
import { makesLoop } from './tree';
import type { Commit } from './commit';
import type { CheckIn, Goal, GoalKind, Level, MetricGoal, Person, Team } from './types';

/* ---------- rule 1: what a field needs ---------- */

/** The goal's fields as the form names them (GoalDraft's keys), in the form's order: the order Must fix is listed in. */
export const GOAL_FIELDS = ['title', 'kind', 'ownerId', 'teamId', 'level', 'parentId', 'effect', 'alsoHelps', 'guardrail', 'unit', 'decimals', 'start', 'target', 'points', 'bound', 'limit', 'margin', 'stages', 'definition', 'source'] as const;
export type GoalField = (typeof GOAL_FIELDS)[number];

/** Each form field's column in the field table (FIELDS.goals): what its need is read from. */
const COLUMN: Partial<Record<GoalField, string>> = {
  title: 'Goal', kind: 'Type', ownerId: 'Owner', teamId: 'Team', level: 'Level', parentId: 'Feeds into', effect: 'Effect', unit: 'Unit', decimals: 'Decimals',
  start: 'Start', target: 'Target', points: 'Plan', bound: 'Must stay', limit: 'Limit', margin: 'Margin', stages: 'Stages', definition: 'Definition', source: 'Source',
};
/** Fields the form always shows holding a value (a default the person can see), so they are required there, whatever
    an empty cell gives in a file: the type, the owner's team, the level, and which side a range keeps to. */
const ALWAYS_SET: GoalField[] = ['kind', 'teamId', 'level', 'bound'];

export type Need = 'required' | 'optional' | 'worked' | 'not-asked';

/** Rule 1. What a column of the field table needs for a goal of `kind`. */
export function fieldNeed(required: Required, kind: GoalKind): Need {
  if (required === 'required') return 'required';
  if (required == null) return 'worked';
  if (required === 'leave-empty' || required === 'reading') return 'not-asked';
  if ('for' in required) return required.for.includes(kind) ? 'required' : 'not-asked';
  return 'optional';
}

/** The fields only some types of goal have: a unit and decimals for a number, the plan for a number to move, and so on. */
const KIND_ONLY: Partial<Record<GoalField, GoalKind[]>> = { unit: ['metric', 'range'], decimals: ['metric', 'range'], start: ['metric'], target: ['metric'], points: ['metric'], bound: ['range'], limit: ['range'], margin: ['range'], stages: ['milestone'] };

/** Rule 1, for a field of the form: "· optional" is said after the label of each field whose need is optional. */
export function formNeed(field: GoalField, kind: GoalKind): Need {
  if (KIND_ONLY[field] && !KIND_ONLY[field]!.includes(kind)) return 'not-asked';
  if (ALWAYS_SET.includes(field)) return 'required';
  if (field === 'decimals') return 'worked';
  if (field === 'alsoHelps' || field === 'guardrail') return 'optional';
  const col = COLUMN[field];
  return col ? fieldNeed(fieldNeedOf('goals', col), kind) : 'optional';
}

/** Rule 1. Whether a step says "Everything here is needed unless it says optional.": two or more of its fields are required and one is optional. */
export function stepSays(fields: readonly GoalField[], kind: GoalKind): boolean {
  const needs = fields.map((f) => formNeed(f, kind));
  return needs.filter((n) => n === 'required').length >= 2 && needs.includes('optional');
}
export const STEP_SAYS = 'Everything here is needed unless it says optional.';

/* ---------- rule 2: what can't be saved ---------- */

export type MustFixId =
  | 'name-empty' | 'name-short' | 'owner-empty' | 'team-empty' | 'level-empty' | 'feeds-loop' | 'start-empty' | 'target-empty' | 'limit-empty'
  | 'not-number' | 'has-words' | 'too-precise' | 'decimals-range' | 'same-as-start' | 'plan-point' | 'margin-negative'
  | 'stage-none' | 'stage-name' | 'stage-week' | 'stage-twice' | 'stage-done-removed' | 'decimals-lose';

/**
 * One thing to fix: the field it is under, its id (section 4), the words, and for a stage the row (an index into the
 * draft's stages). `keep`: the decimal places a too-precise number needs, so the field can offer "Keep 1 decimal place".
 * `hold`: for `same-as-start`, the value a number to keep in range would hold.
 */
export interface MustFix { field: GoalField; id: MustFixId; text: string; row?: number; keep?: number; hold?: number }

/** What `goalMustFix` reads. `owner` and `parent` are the chosen ones (names for the words); `loops`, whether the
    chosen parent already feeds this goal (domain/tree makesLoop). `door` changes a few words, never a rule. */
export interface MustFixContext {
  cycleWeeks: number;
  week: number;
  existing: Goal | null;
  /** This goal's check-ins (an existing goal's), for what a change would make untrue. */
  checkIns?: readonly CheckIn[];
  owner?: { name: string; teamId: string | null } | null;
  parent?: { title: string } | null;
  loops?: boolean;
  door: 'form' | 'setup' | 'table';
  /** What the name is of: a goal, or set-up's outcome. */
  noun?: 'goal' | 'outcome';
}

/** A unit after a number, as sentences say it: "50%", "12 days", "12" with no unit. */
const withUnit = (v: string, unit: string) => (unit.trim() === '%' ? v + '%' : unit.trim() ? `${v} ${unit.trim()}` : v);

/** The words for a number that has more places than its goal keeps (section 4, `too-precise`). */
function tooPrecise(raw: string, n: number, places: number): { text: string; keep?: number } | null {
  const has = typedDecimals(raw);
  if (has <= places) return null;
  const shown = groupDigits(n.toFixed(places));
  const keep = Math.min(3, has);
  return keep > places
    ? { text: `${raw.trim()} has ${placesText(has)}, but this goal keeps ${placesText(places)}, so it would show as ${shown}. Type ${shown}, or keep ${placesText(keep)} for this goal.`, keep }
    : { text: `${raw.trim()} has ${placesText(has)}, but a goal keeps at most ${placesText(3)}, so it would show as ${shown}. Type ${shown}.` };
}

/**
 * Rule 2. What can't be saved, in the form's order: an empty list when the goal can be saved. The same at every door
 * (the form, set-up's cards, a Goals row, the AI tools), in section 4's words. Who may save it is rule 7's, not this.
 */
export function goalMustFix(d: GoalDraft, ctx: MustFixContext): MustFix[] {
  const out: MustFix[] = [];
  const add = (field: GoalField, id: MustFixId, text: string, extra: Partial<MustFix> = {}) => out.push({ field, id, text, ...extra });
  const named = nameProblem(d.title, ctx.noun ?? 'goal');
  if (named) add('title', d.title.trim() ? 'name-short' : 'name-empty', named);
  if (!d.ownerId) add('ownerId', 'owner-empty', 'Choose who owns it.');
  if (!d.teamId) add('teamId', 'team-empty', ctx.owner && !ctx.owner.teamId ? `${ctx.owner.name} isn’t in a team. Choose the team this goal is for.` : 'Choose a team.');
  if (!d.level) add('level', 'level-empty', 'Choose a level.');
  if (d.parentId && ctx.loops) add('parentId', 'feeds-loop', `That link would make a loop: “${ctx.parent?.title ?? 'that goal'}” already feeds into this goal.`);
  if (d.parentId && d.effect.trim() && parseNumber(d.effect) == null) add('effect', 'not-number', notNumberText(d.effect));

  if (d.kind !== 'milestone') {
    const places = decimalsFor(d);
    if (places == null) add('decimals', 'decimals-range', `Decimals says “${d.decimals.trim()}”. Use 0, 1, 2 or 3.`);
    const example = places ?? 0;
    /** A typed number's problem, or its value. */
    const number = (field: GoalField, raw: string, empty: [MustFixId, string] | null, prefix = '', row?: number): number | null => {
      if (!raw.trim()) { if (empty) add(field, empty[0], empty[1]); return null; }
      const read = numberAsTyped(raw, d.unit);
      if ('problem' in read) {
        if (read.problem === 'not-number') add(field, 'not-number', prefix + notNumberText(raw, example), { row });
        else add(field, 'has-words', prefix + `“${raw.trim()}” has words in it. Type the number only, like ${groupDigits(String(read.n))}; ${d.unit.trim() ? `this goal counts ${d.unit.trim()}` : 'the unit goes in Unit'}.`, { row });
        return null;
      }
      if (places != null) { const p = tooPrecise(raw, read.n, places); if (p) { add(field, 'too-precise', prefix + p.text, { ...(p.keep != null ? { keep: p.keep } : {}), row }); return null; } }
      return read.n;
    };
    if (d.kind === 'metric') {
      const s = number('start', d.start, ['start-empty', ctx.existing ? 'Enter where it starts.' : 'Enter where it starts today.']);
      const t = number('target', d.target, ['target-empty', 'Enter the target.']);
      if (s != null && t != null && s === t) add('target', 'same-as-start', `The target is the same as today (${withUnit(groupDigits(String(s)), d.unit)}). To hold a number where it is, make this a number to keep in range.`, { hold: s });
      // Plan numbers typed by hand. One already stored (an existing goal's plan) is not judged again unless it changed.
      const stored = new Map(ctx.existing?.kind === 'metric' ? (ctx.existing.plan.points ?? []).map((p) => [String(p.week), p.value]) : []);
      const typed = Object.entries(d.points).filter(([w, v]) => v.trim() !== '' && parseNumber(v) !== stored.get(w)).sort(([a], [b]) => Number(a) - Number(b));
      for (const [w, v] of typed) { const before = out.length; number('points', v, null, `Week ${w}: `); if (out.length > before) { out[out.length - 1]!.id = 'plan-point'; break; } }
    }
    if (d.kind === 'range') {
      number('limit', d.limit, ['limit-empty', 'Enter the limit.']);
      const m = number('margin', d.margin, null);
      if (m != null && m < 0) add('margin', 'margin-negative', 'Enter a warning margin of zero or more, or leave it empty.');
    }
    // Fewer places than check-ins already have would show those check-ins rounded: refused, with the way forward.
    if (ctx.existing && ctx.existing.kind !== 'milestone' && places != null && places < ctx.existing.decimals) {
      const over = (ctx.checkIns ?? []).filter((c) => c.value != null && (String(c.value).split('.')[1] ?? '').length > places).sort((a, b) => a.week - b.week);
      if (over.length) {
        const k = over.length, weeks = over.slice(0, 3).map((c) => c.week);
        add('decimals', 'decimals-lose', `${k} check-in${k === 1 ? ' has' : 's have'} more decimal places than ${placesText(places)} (week${weeks.length === 1 ? '' : 's'} ${weeks.join(', ')}${k > 3 ? ' and more' : ''}). Keep ${placesText(ctx.existing.decimals)}, or correct those check-ins first.`);
      }
    }
  }

  if (d.kind === 'milestone') {
    const rows = d.stages.map((s, i) => ({ s, i })).filter(({ s }) => s.name.trim() || s.dueWeek.trim());
    if (!rows.length) add('stages', 'stage-none', 'Add at least one stage.', { row: 0 });
    const seen = new Map<string, string>();
    for (const { s, i } of rows) {
      const name = s.name.trim();
      if (!name) add('stages', 'stage-name', 'Give this stage a name.', { row: i });
      else if (seen.has(fold(name).replace(/\s+/g, ' '))) add('stages', 'stage-twice', `Two stages are called “${seen.get(fold(name).replace(/\s+/g, ' '))}”. Give each its own name, such as “${name} review”.`, { row: i });
      if (name) seen.set(fold(name).replace(/\s+/g, ' '), name);
      const w = parseNumber(s.dueWeek);
      const ok = w != null && Number.isInteger(w) && w >= 1 && w <= ctx.cycleWeeks;
      // A stage already past is a question (rule 3's stage-past), not something to fix.
      if (!ok) add('stages', 'stage-week', s.dueWeek.trim() ? `“${name || 'This stage'}” needs a due week between 1 and ${ctx.cycleWeeks}: it says “${s.dueWeek.trim()}”.` : name ? `Choose the week “${name}” is due.` : 'Choose the week this stage is due.', { row: i });
    }
    // A stage done in a check-in stays: its record would point at nothing.
    if (ctx.existing?.kind === 'milestone') {
      const kept = new Set(d.stages.filter((s) => s.name.trim()).map((s) => s.id));
      for (const st of ctx.existing.stages) {
        if (kept.has(st.id)) continue;
        const done = (ctx.checkIns ?? []).flatMap((c) => c.stages ?? []).find((u) => u.stageId === st.id && u.doneWeek != null);
        if (done) add('stages', 'stage-done-removed', `“${st.name}” was done in week ${done.doneWeek}, so it can’t be removed. Rename it, or leave it.`, { row: 0 });
      }
    }
  }
  return out.sort((a, b) => GOAL_FIELDS.indexOf(a.field) - GOAL_FIELDS.indexOf(b.field));
}

/* ---------- rule 3: what is asked ---------- */

/** The questions goal entry asks (section 4's Check table), in its order: the order they are shown in. `far-from-metric`
    waits for a metric's latest number for a slice (the metrics module has none yet); the dates' three come with GE9. */
export const CHECK_IDS = [
  'stage-past', 'no-unit', 'below-zero', 'over-100', 'hundredfold', 'billion', 'wrong-side', 'same-name', 'owner-other-team', 'feeds-lower',
  'margin-wide', 'late-plan', 'direction', 'far-from-plan',
] as const;
export type GoalCheckId = (typeof CHECK_IDS)[number];

/**
 * A question to answer before the goal is saved. `key` is the values it is about: an answer is kept as
 * `answers[slot] = key`, so the same question about other values is unanswered again. `slot` is the id, or for a stage
 * `stage-past:<stage id>`. `yes` keeps what was typed; `no` changes it: by the person (focus goes to `field`), or at once
 * when `noDoes` says how (the question then goes), or, with `noAnswers`, it is an answer too (a stage overdue).
 * `opens`: a goal the no answer opens instead. `readBack`: the sentence the read-back and the answered line say.
 */
export interface GoalCheck {
  id: GoalCheckId;
  slot: string;
  field: GoalField;
  row?: number;
  question: string;
  yes: string;
  no: string;
  key: string;
  readBack: string;
  noDoes?: Partial<GoalDraft>;
  noAnswers?: boolean;
  opens?: string;
}
/** The answers given, by slot: the key each was given for. Kept in the draft. */
export type GoalAnswers = Record<string, string>;

/** What `goalChecks` reads. Names, not records: the owner's and team's names, the goal it feeds, and the goals of the same
    team with the same name (from the finder, never a scan of everything). `mustFix`: a field with one isn't asked about. */
export interface ChecksContext {
  week: number;
  cycleWeeks: number;
  existing: Goal | null;
  door: 'form' | 'setup' | 'table';
  levels?: LevelsOf;
  owner?: { name: string; teamId: string | null; teamName: string | null } | null;
  team?: { id: string; name: string } | null;
  parent?: { id: string; title: string; level: Level } | null;
  sameNamed?: readonly { id: string; key: string; title: string; ownerName: string }[];
  /** What measures it, when a module says (the goal.measure place, ML2): its name and which way is better. */
  metric?: { name: string; direction: 'lower' | 'higher' } | null;
  mustFix?: readonly MustFix[];
}

/** "A north star", "An SVP goal": a level as the start of a sentence; `noun` false leaves "goal" off a plain name. */
function aLevel(levels: LevelsOf, l: Level, top: boolean): string {
  const name = levelName(levels, l);
  const said = top ? name.charAt(0).toLowerCase() + name.slice(1) : `${name} goal`;
  return (/^[aeiou]/i.test(said) || /^[AEFHILMNORSX][A-Z]/.test(said) ? 'an ' : 'a ') + said;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Rule 3. What is asked before a goal is saved: possible, but unlikely. In section 4's order, each only once the fields it
 * is about have no Must fix. The same at every door (the form, set-up's cards, a Goals row, the AI tools). A goal already
 * saved isn't asked again about what it already says: only what a change makes new.
 */
export function goalChecks(d: GoalDraft, ctx: ChecksContext): GoalCheck[] {
  const raw = checksOf(d, ctx);
  if (!ctx.existing) return raw;
  // What the goal already says was asked (or settled) when it was saved: only a change asks again.
  const was = new Set(checksOf(draftOf(ctx.existing), { ...ctx, existing: null, mustFix: [], sameNamed: ctx.sameNamed?.filter((g) => g.id !== ctx.existing!.id) }).map((c) => `${c.slot}=${c.key}`));
  return raw.filter((c) => !was.has(`${c.slot}=${c.key}`));
}

function checksOf(d: GoalDraft, ctx: ChecksContext): GoalCheck[] {
  const out: GoalCheck[] = [];
  const fixed = new Set((ctx.mustFix ?? []).map((m) => m.field));
  const ask = (c: Omit<GoalCheck, 'slot'> & { slot?: string }) => { if (!fixed.has(c.field)) out.push({ slot: c.id, ...c }); };
  const unit = d.unit.trim();
  const said = (n: number) => withUnit(groupDigits(String(n)), unit);
  const read = (v: string) => { if (!v.trim()) return null; const r = numberAsTyped(v, d.unit); return 'problem' in r ? null : r.n; };

  // A stage already past at set-up (OB2's rule 3): done in its own week, or overdue. Either answer is an answer.
  if (d.kind === 'milestone' && !ctx.existing && ctx.door !== 'table') {
    d.stages.forEach((st, i) => {
      const w = parseNumber(st.dueWeek);
      if (!st.name.trim() || w == null || !Number.isInteger(w) || w < 1 || w > ctx.cycleWeeks || !pastStage(w, ctx.week)) return;
      const ago = ctx.week - w;
      ask({
        id: 'stage-past', slot: `stage-past:${st.id}`, field: 'stages', row: i, key: String(w),
        question: `Week ${w} was ${ago} week${ago === 1 ? '' : 's'} ago. Is this stage already done?`, yes: `Yes, done in week ${w}`, no: 'No, it’s overdue', noAnswers: true,
        readBack: st.done === 'no' ? `“${st.name.trim()}” isn’t done: it’s overdue since week ${w}.` : `Done in week ${w}.`,
      });
    });
  }
  if (d.kind !== 'milestone') {
    // No unit is asked about once (round 2, decision 6): a plain count, or one to add.
    if (!unit && (!ctx.existing || ctx.existing.kind === 'milestone' || ctx.existing.unit.trim())) {
      ask({ id: 'no-unit', field: 'unit', key: '', question: 'This number has no unit. Is it a plain count?', yes: 'Yes, a plain count', no: 'No, I’ll add one', readBack: 'You said it is a plain count, with no unit.' });
    }
    const fields: [GoalField, string, number | null][] = d.kind === 'metric' ? [['start', 'number today', read(d.start)], ['target', 'target', read(d.target)]] : [['limit', 'limit', read(d.limit)]];
    const given = fields.filter((f): f is [GoalField, string, number] => f[2] != null);
    const key = given.map((f) => f[2]).join('|');
    const neg = given.find(([, , n]) => n < 0);
    if (neg && usuallyPositive(unit)) ask({ id: 'below-zero', field: neg[0], key: `${key}|${unit}`, question: `${said(neg[2])} is below zero. That’s fine for a change or a balance. Is it right here?`, yes: `Yes, ${said(neg[2])} is right`, no: 'No, I’ll change it', readBack: `You said ${said(neg[2])} is right.` });
    const over = unit === '%' ? given.find(([, , n]) => n > 100) : undefined;
    if (over) ask({ id: 'over-100', field: over[0], key, question: `The ${over[1]} is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is ${groupDigits(String(over[2]))}% right?`, yes: `Yes, ${groupDigits(String(over[2]))}% is right`, no: 'No, I’ll change it', readBack: `You said ${groupDigits(String(over[2]))}% is right.` });
    const s = d.kind === 'metric' ? read(d.start) : null, t = d.kind === 'metric' ? read(d.target) : null;
    if (s != null && t != null && s !== 0 && t !== 0 && Math.sign(s) === Math.sign(t)) {
      const r = Math.abs(t / s);
      if (r >= FAR_RATIO || r <= 1 / FAR_RATIO) ask({ id: 'hundredfold', field: 'target', key: `${s}|${t}`, question: `The target (${said(t)}) is ${r >= 1 ? `over ${FAR_RATIO} times` : 'under a hundredth of'} where it starts (${said(s)}). Is that right?`, yes: `Yes, ${said(s)} to ${said(t)} is right`, no: 'No, I’ll change it', readBack: `You said ${said(s)} to ${said(t)} is right.` });
    }
    // A target on the worse side of the start for the metric that measures it.
    if (ctx.metric && s != null && t != null && s !== t && (ctx.metric.direction === 'lower') === (t > s)) {
      const better = ctx.metric.direction;
      ask({ id: 'wrong-side', field: 'target', key: `${ctx.metric.name}|${s}|${t}`, question: `“${ctx.metric.name}” is better ${better}, but the target (${said(t)}) is ${t > s ? 'above' : 'below'} today (${said(s)}). Is that the plan?`, yes: `Yes, this goal lets it ${t > s ? 'rise' : 'fall'} to ${said(t)}`, no: 'No, I’ll change the numbers', readBack: `You said the target is right though “${ctx.metric.name}” is better ${better}.` });
    }
    const big = given.find(([, , n]) => Math.abs(n) >= 1e9);
    if (big) ask({ id: 'billion', field: big[0], key: String(big[2]), question: `${said(big[2])} is a billion or more. Is it right?`, yes: 'Yes, it’s right', no: 'No, I’ll change it', readBack: `You said ${said(big[2])} is right.` });
  }

  // The same name in the same team: more often the same goal again than a new one.
  const twin = d.title.trim() && d.teamId && ctx.team ? sameTitleGoals(d.title, ctx.existing?.id ?? null, [...(ctx.sameNamed ?? [])])[0] : undefined;
  if (twin && ctx.team) ask({ id: 'same-name', field: 'teamId', key: `${fold(d.title).replace(/\s+/g, ' ')}|${ctx.team.id}`, question: `${ctx.team.name} already has a goal called “${twin.title}” (${twin.key}, owned by ${twin.ownerName}). Is this a different goal?`, yes: 'Yes, it’s a different goal', no: `No, open ${twin.key}`, opens: twin.id, readBack: `${ctx.team.name} already has “${twin.title}” (${twin.key}); this is a different goal.` });
  // An owner in another team than the goal's: which team is it for?
  if (ctx.owner?.teamId && ctx.owner.teamName && ctx.team && d.teamId && ctx.owner.teamId !== d.teamId) {
    const first = ctx.owner.name.split(' ')[0]!;
    ask({ id: 'owner-other-team', field: 'teamId', key: `${d.ownerId}|${d.teamId}`, question: `${first} is in ${ctx.owner.teamName}, not ${ctx.team.name}. Which team is this goal for?`, yes: `Keep it in ${ctx.team.name}`, no: `Move it to ${ctx.owner.teamName}`, noDoes: { teamId: ctx.owner.teamId }, readBack: `${first} is in ${ctx.owner.teamName}; the goal stays in ${ctx.team.name}.` });
  }
  // A link to a goal at a lower level: usually a slip, never refused (anyone may set any level; Lane, 11 Nov).
  if (ctx.parent && d.parentId && d.level && levelRank(ctx.levels, ctx.parent.level) > levelRank(ctx.levels, d.level)) {
    const top = isTop(ctx.levels, d.level);
    const up = levelIds(ctx.levels)[levelRank(ctx.levels, d.level) - 1];
    const feeds = !up ? 'nothing' : aLevel(ctx.levels, up, isTop(ctx.levels, up));
    ask({ id: 'feeds-lower', field: 'parentId', key: `${d.level}|${d.parentId}`, question: `${capital(aLevel(ctx.levels, d.level, top))} usually feeds ${feeds}, and “${ctx.parent.title}” is ${aLevel(ctx.levels, ctx.parent.level, false)}. Is this link right?`, yes: 'Yes, it feeds that goal', no: 'No, it feeds nothing', noDoes: { parentId: '', effect: '', whyHelps: '' }, readBack: `You said it feeds “${ctx.parent.title}”, ${aLevel(ctx.levels, ctx.parent.level, false)}.` });
  }
  if (d.kind === 'range') {
    const limit = read(d.limit), margin = read(d.margin);
    if (limit != null && margin != null && margin > 0 && margin >= Math.abs(limit)) ask({ id: 'margin-wide', field: 'margin', key: `${limit}|${margin}`, question: `With a limit of ${said(limit)} and a warning ${said(margin)} away, it would almost always read at risk. Is ${groupDigits(String(margin))} right?`, yes: `Yes, warn within ${said(margin)}`, no: 'No, I’ll change it', readBack: `You said to warn within ${said(margin)}.` });
  }
  if (d.kind === 'metric') {
    const s = read(d.start), t = read(d.target);
    const typed = Object.entries(d.points).filter(([, v]) => v.trim() !== '' && parseNumber(v) != null);
    if (s != null && t != null && s !== t && typed.length) {
      // Weeks set by hand that leave most of the change to the end (a chosen shape is never questioned).
      const plan = lateShapeOf(d, s, t, ctx);
      const late = lateShare(plan, ctx.cycleWeeks);
      if (late.share > 0.6) ask({ id: 'late-plan', field: 'points', key: typed.map(([w, v]) => `${w}:${v.trim()}`).join(','), question: `This plan leaves ${Math.round(late.share * 100)}% of the change to the last ${late.k} of ${late.n} weeks. Is that the plan?`, yes: 'Yes, that’s the plan', no: 'No, I’ll change it', readBack: `You said most of the change comes in the last ${late.k} weeks.` });
    }
    // A changed plan whose target flips which way is better, or a number far outside the old plan (today's planQuestion).
    if (ctx.existing?.kind === 'metric' && s != null && t != null) {
      const after: MetricGoal = { ...ctx.existing, plan: lateShapeOf(d, s, t, ctx) };
      const q = planQuestion(ctx.existing, after);
      if (q) ask({ id: q.code === 'direction' ? 'direction' : 'far-from-plan', field: 'target', key: `${s}|${t}|${JSON.stringify(after.plan.points ?? [])}`, question: q.text, yes: q.confirm, no: 'No, I’ll change it', readBack: '' });
    }
  }
  return out.sort((a, b) => CHECK_IDS.indexOf(a.id) - CHECK_IDS.indexOf(b.id));
}

/** The plan a number draft would have: its own start and end weeks (or the goal's, or this week), with hand-set weeks. */
function lateShapeOf(d: GoalDraft, start: number, target: number, ctx: ChecksContext): MetricGoal['plan'] {
  const was = ctx.existing?.kind === 'metric' ? ctx.existing.plan : null;
  const from = d.fromWeek != null && d.fromWeek.trim() !== '' ? parseNumber(d.fromWeek) ?? 0 : was ? was.fromWeek ?? 0 : Math.max(0, ctx.week);
  const end = parseNumber(d.endWeek);
  return withPoints({ start, target, shape: d.shape, ...(from ? { fromWeek: from } : {}), ...(end != null && end !== ctx.cycleWeeks ? { endWeek: end } : {}) }, d.points, ctx.cycleWeeks);
}

/** Where `checksContext` finds the names a question says: people, teams and goals by id, and the goals of a team with a
    given name (the finder's answer; `sameNamedIn` over a list where the whole list is at hand). */
export interface ChecksLookup {
  person: (id: string) => Pick<Person, 'name' | 'teamId'> | undefined;
  team: (id: string) => Pick<Team, 'id' | 'name'> | undefined;
  goal: (id: string) => Pick<Goal, 'id' | 'title' | 'level'> | undefined;
  sameNamed: (title: string, teamId: string) => readonly Pick<Goal, 'id' | 'key' | 'title' | 'ownerId'>[];
}

/** The goals of `teamId` called `title` (case, spaces and accents aside), live ones only: what same-name asks about. */
export const sameNamedIn = (goals: readonly Goal[]) => (title: string, teamId: string) =>
  sameTitleGoals(title, null, goals.filter((g) => g.teamId === teamId && !g.removedAt && !g.stoppedAt));

/** Rule 3's context for a draft, from lookups: the owner and their team, the goal's team, what it feeds, the same-named. */
export function checksContext(d: GoalDraft, look: ChecksLookup, base: Pick<ChecksContext, 'week' | 'cycleWeeks' | 'existing' | 'door' | 'levels' | 'mustFix' | 'metric'>): ChecksContext {
  const owner = d.ownerId ? look.person(d.ownerId) : undefined;
  const team = d.teamId ? look.team(d.teamId) : undefined;
  const parent = d.parentId ? look.goal(d.parentId) : undefined;
  const named = team && d.title.trim() ? look.sameNamed(d.title, team.id).filter((g) => g.id !== base.existing?.id) : [];
  return {
    ...base,
    owner: owner ? { name: owner.name, teamId: owner.teamId ?? null, teamName: owner.teamId ? look.team(owner.teamId)?.name ?? null : null } : null,
    team: team ? { id: team.id, name: team.name } : null,
    parent: parent ? { id: parent.id, title: parent.title, level: parent.level } : null,
    sameNamed: named.map((g) => ({ id: g.id, key: g.key ?? g.id, title: g.title, ownerName: look.person(g.ownerId)?.name ?? 'someone' })),
  };
}

/** The sentence a Check's answer is kept as in History ("Checked"): its yes, or for a stage said overdue, its no. */
const answerSaid = (d: GoalDraft) => (c: GoalCheck) => (c.id === 'stage-past' && d.stages[c.row ?? -1]?.done === 'no' ? c.no : c.yes);
/** Each answered Check as History keeps it: "Checked", from the question to the answer. */
export const checkedDiffs = (d: GoalDraft, checks: readonly GoalCheck[], answers: GoalAnswers | undefined) => answeredDiffs(checks, answers, 'Checked', answerSaid(d));

/* ---------- rule 4: whether a step can go on ---------- */

/** The fields each step of New goal asks, in the order of NEW_GOAL_STEPS (domain/newGoal). */
export const STEP_FIELDS: GoalField[][] = [
  ['title', 'kind'],
  ['ownerId', 'teamId', 'level', 'parentId', 'effect', 'alsoHelps', 'guardrail'],
  ['unit', 'decimals', 'start', 'target', 'points', 'bound', 'limit', 'margin', 'stages', 'definition', 'source'],
  [],
];
/** The fields the step of a goal of `kind` shows: the number fields only for a number, the stages only for stages. */
export function stepFields(step: number, kind: GoalKind): GoalField[] {
  return (STEP_FIELDS[step] ?? []).filter((f) => !KIND_ONLY[f] || KIND_ONLY[f]!.includes(kind));
}

/** A field's label in the line above the button. */
export const FIELD_LABEL: Partial<Record<GoalField, string>> = {
  title: 'Name', ownerId: 'Owner', teamId: 'Team', level: 'Level', parentId: 'Feeds into', effect: 'How much it moves', unit: 'Unit', decimals: 'Decimals',
  start: 'Today', target: 'Target', points: 'The plan', limit: 'Limit', margin: 'Warn this close', stages: 'Stages',
};

/**
 * Rule 4. Whether `step` can go on: not while one of its fields has a Must fix, then not while one of its questions is
 * unanswered. `focus` is the first such field (`check`, the first open question's slot); `says` is the line above the
 * button: "2 things to fix above: Unit and Target." (one per field, in the form's order); then "Answer the question above,
 * under Target." or "Answer the 2 questions above.".
 */
export function stepState(step: number, mustFix: readonly MustFix[], checks: readonly GoalCheck[] = [], answers: GoalAnswers = {}): { go: boolean; focus: GoalField | null; check: string | null; says: string } {
  const on = (f: GoalField) => (STEP_FIELDS[step] ?? []).includes(f);
  const mine = mustFix.filter((m) => on(m.field));
  if (mine.length) {
    const fields = [...new Set(mine.map((m) => m.field))];
    return { go: false, focus: fields[0]!, check: null, says: fixLine(fields.map((f) => ({ field: FIELD_LABEL[f] ?? f, says: '' })), []).says };
  }
  const open = unanswered(checks.filter((c) => on(c.field)), answers);
  if (!open.length) return { go: true, focus: null, check: null, says: '' };
  const first = open[0]!;
  return { go: false, focus: first.field, check: first.slot, says: open.length === 1 ? `Answer the question above, under ${FIELD_LABEL[first.field] ?? first.field}.` : `Answer the ${open.length} questions above.` };
}

/* ---------- rule 7: saving ---------- */

/** What the form sends to save a goal: the draft, the goal it changes (none for a new one), and what the save says. */
export interface SaveGoalInput {
  draft: GoalDraft;
  /** The goal being changed, by id or key; left out for a new goal. */
  goalId?: string;
  /** Why the plan changed, once check-ins have started: kept in History as "Why". */
  reason?: string;
  /** The answers to rule 3's questions, by slot (`answers[slot] = key`), as the draft keeps them. */
  answers?: GoalAnswers;
  /** Yes to every question rule 3 asks (the tools' and older screens' one switch). */
  confirm?: boolean;
  /** A new goal's stages already done when it was set up (OB2's rule 3), recorded in the same save. When left out, the
      stages the draft says are done (answered yes to stage-past). */
  stagesDone?: string[];
}

/** The words for a plan change with no reason (section 4, `reason-empty`). */
export const REASON_EMPTY = 'Say why, in a sentence. It goes in the goal’s History, and anyone watching it sees the change flagged.';

/**
 * Rule 7. The form's one way to save a goal, run by the `saveGoal` action (app/actions): refused (NotAllowed, in
 * section 4's words) unless the actor may (domain/goalRights), nothing must be fixed, every question (rule 3) is
 * answered, and a needed reason is given. Returns the goal as saved and the commit: the goal, its History entry (with
 * "Why", and each answer as "Checked"), and, for a new goal, its stages already done. Null commit when an existing goal
 * would not change.
 */
export function planGoal(x: ActionContext, i: SaveGoalInput): { commit: Commit | null; goal: Goal } {
  const s = x.snapshot;
  const existing = i.goalId ? findGoal(s.goals, i.goalId) ?? null : null;
  if (i.goalId && !existing) throw new NotAllowed('That goal no longer exists. Reload to see the latest.');
  const ownerOf = (id: string) => s.people.find((p) => p.id === id);
  if (existing && !mayChangeGoal(x.actor, existing)) throw new NotAllowed(`Only ${ownerOf(existing.ownerId)?.name ?? 'its owner'} (its owner) or an admin can change “${existing.title}”.`);
  if (!existing && !mayAddGoal(x.actor, i.draft.ownerId)) throw new NotAllowed('You can’t add this goal.');
  const owner = ownerOf(i.draft.ownerId);
  if (i.draft.ownerId && !owner) throw new NotAllowed('That person isn’t in this workspace any more. Choose who owns it.');
  if (i.draft.teamId && !s.teams.some((t) => t.id === i.draft.teamId)) throw new NotAllowed('That team isn’t here any more. Choose a team.');
  const parent = i.draft.parentId ? findGoal(s.goals, i.draft.parentId) : undefined;
  if (i.draft.parentId && !parent) throw new NotAllowed('The goal it feeds isn’t here any more. Choose another, or nothing.');
  const checkIns = existing ? checkInsFor(existing, s.checkIns) : [];
  const fix = goalMustFix(i.draft, {
    cycleWeeks: x.cycle.weeks, week: x.week, existing, checkIns, door: 'form',
    owner: owner ? { name: owner.name, teamId: owner.teamId ?? null } : null, parent: parent ? { title: parent.title } : null,
    loops: !!(existing && parent && makesLoop(existing.id, parent.id, s.goals)),
  });
  if (fix.length) throw new NotAllowed(`Not saved. Must fix: ${fix.map((f) => f.text).join(' ')}`);
  const checks = goalChecks(i.draft, checksContext(i.draft, {
    person: ownerOf, team: (id) => s.teams.find((t) => t.id === id), goal: (id) => findGoal(s.goals, id), sameNamed: sameNamedIn(s.goals),
  }, { week: x.week, cycleWeeks: x.cycle.weeks, existing, door: 'form', levels: x.cycle }));
  const answers: GoalAnswers = i.confirm ? Object.fromEntries(checks.map((c) => [c.slot, c.key])) : i.answers ?? {};
  const open = unanswered(checks, answers);
  if (open.length) throw new NotAllowed(`Not saved. Check with the person first: ${open.map((c) => c.question).join(' ')}`);

  const places = decimalsFor(i.draft)!;
  const built = buildGoal({ ...i.draft, decimals: String(places), margin: i.draft.margin.trim() || '0' }, x.cycle, { id: existing?.id ?? x.newId('goal'), createdAt: existing?.createdAt ?? x.now }, existing, checkIns.length > 0, x.week);
  // A new goal takes the workspace's next key; a goal being changed keeps its own (buildGoal keeps it).
  const goal: Goal = existing ? { ...built, pending: null } : { ...built, key: nextKey(s.goals, s.keysIssued) };
  const needsReason = !!existing && checkIns.length > 0 && planChanged(existing, goal);
  if (needsReason && (i.reason ?? '').trim().length < MIN_REASON) throw new NotAllowed(REASON_EMPTY);

  const lookup: Lookup = { person: ownerOf, goal: (id) => (id === goal.id ? goal : s.goals.find((g) => g.id === id)), teamName: (id) => s.teams.find((t) => t.id === id)?.name ?? id };
  const change = goalChange(existing, goal, lookup, x.actor.id, x.now, x.newId('chg'));
  if (!change) return { commit: null, goal: existing ?? goal };
  if (i.reason?.trim()) change.diffs.push({ field: 'Why', from: '—', to: i.reason.trim() });
  // Each question answered is kept with the change, as "Checked": the question, then the answer (section 4).
  change.diffs.push(...checkedDiffs(i.draft, checks, answers));
  // Stages already done at set-up go in the same save as the goal, so it is never seen late in between (OB2's rule 3).
  const doneIds = i.stagesDone ?? (i.draft.kind === 'milestone' ? i.draft.stages.filter((st) => st.done === 'yes').map((st) => st.id) : []);
  const done = !existing && doneIds.length ? stagesDoneAtSetUp(goal, doneIds, x.actor.id, x.now, x.newId('ci')) : null;
  const doneChange = done ? checkInChange(null, done, goal, x.actor.id, x.newId('chg')) : null;
  return { commit: { goals: [goal], changes: [change, ...(doneChange ? [doneChange] : [])], ...(done ? { checkIns: [done] } : {}) }, goal };
}
