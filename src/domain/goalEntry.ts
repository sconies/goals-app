/* Goal entry (docs/design/goal-entry/spec.md, section 6; backlog GE1): one set of rules for every way a goal comes in.
   New goal, the edit page, set-up's goal cards, a Goals row (planChanges: the import, Data, bulk edits) and the AI tools
   all ask `goalMustFix`, in section 4's words; the form saves through `planGoal`, which the `saveGoal` action runs, so
   nothing reaches the store that the engine would refuse.

   - Rule 1, `fieldNeed`: what a field needs, read from the field table (domain/columns FIELDS).
   - Rule 2, `goalMustFix`: what can't be saved, field by field; `decimalsFor` works out the places a goal keeps.
   - Rule 4, `stepState`: whether a step of New goal can go on, and the line above its button.
   - Rule 7, `planGoal`: who may (domain/goalRights), and the commit a save makes.

   The questions (rule 3, `goalChecks`) are GE2's. Pure: no screen, network or database code. No rule takes the
   workspace: each lists what it reads. */
import { NotAllowed, type ActionContext } from './actions';
import { goalChange, checkInChange, type Lookup } from './changes';
import { MIN_REASON, stepState as fixLine } from './checkin';
import { fieldNeedOf, type Required } from './columns';
import { buildGoal, decimalsFor, pastStage, planChanged, planQuestion, stagesDoneAtSetUp, type GoalDraft } from './goal';
import { findGoal, nextKey } from './goalKey';
import { mayAddGoal, mayChangeGoal } from './goalRights';
import { fold } from './find';
import { groupDigits, notNumberText, numberAsTyped, parseNumber, placesText, typedDecimals } from './numbers';

export { decimalsFor };
import { checkInsFor } from './status';
import { nameProblem } from './thresholds';
import { makesLoop } from './tree';
import type { Commit } from './commit';
import type { CheckIn, Goal, GoalKind } from './types';

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
  | 'stage-none' | 'stage-name' | 'stage-week' | 'stage-twice' | 'stage-past' | 'stage-done-removed' | 'decimals-lose';

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
      if (!ok) add('stages', 'stage-week', s.dueWeek.trim() ? `“${name || 'This stage'}” needs a due week between 1 and ${ctx.cycleWeeks}: it says “${s.dueWeek.trim()}”.` : name ? `Choose the week “${name}” is due.` : 'Choose the week this stage is due.', { row: i });
      // A new goal's stage already past is asked about in the form, so it isn't born late without anyone saying (OB2's rule 3).
      else if (ctx.door === 'form' && !ctx.existing && pastStage(w!, ctx.week) && !s.done) add('stages', 'stage-past', 'Say whether this stage is done.', { row: i });
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
 * Rule 4. Whether `step` can go on: not while one of its fields has a Must fix. `focus` is the first such field; `says`
 * is the line above the button: "2 things to fix above: Unit and Target." (one per field, in the form's order).
 */
export function stepState(step: number, mustFix: readonly MustFix[]): { go: boolean; focus: GoalField | null; says: string } {
  const mine = mustFix.filter((m) => (STEP_FIELDS[step] ?? []).includes(m.field));
  if (!mine.length) return { go: true, focus: null, says: '' };
  const fields = [...new Set(mine.map((m) => m.field))];
  return { go: false, focus: fields[0]!, says: fixLine(fields.map((f) => ({ field: FIELD_LABEL[f] ?? f, says: '' })), []).says };
}

/* ---------- rule 7: saving ---------- */

/** What the form sends to save a goal: the draft, the goal it changes (none for a new one), and what the save says. */
export interface SaveGoalInput {
  draft: GoalDraft;
  /** The goal being changed, by id or key; left out for a new goal. */
  goalId?: string;
  /** Why the plan changed, once check-ins have started: kept in History as "Why". */
  reason?: string;
  /** Yes to the plan's question (domain/goal planQuestion), when it asks one. */
  confirm?: boolean;
  /** A new goal's stages already done when it was set up (OB2's rule 3), recorded in the same save. */
  stagesDone?: string[];
}

/** The words for a plan change with no reason (section 4, `reason-empty`). */
export const REASON_EMPTY = 'Say why, in a sentence. It goes in the goal’s History, and anyone watching it sees the change flagged.';

/**
 * Rule 7. The form's one way to save a goal, run by the `saveGoal` action (app/actions): refused (NotAllowed, in
 * section 4's words) unless the actor may (domain/goalRights), nothing must be fixed, the plan's question has its yes,
 * and a needed reason is given. Returns the goal as saved and the commit: the goal, its History entry (with "Why"), and,
 * for a new goal, its stages already done. Null commit when an existing goal would not change.
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

  const places = decimalsFor(i.draft)!;
  const built = buildGoal({ ...i.draft, decimals: String(places), margin: i.draft.margin.trim() || '0' }, x.cycle, { id: existing?.id ?? x.newId('goal'), createdAt: existing?.createdAt ?? x.now }, existing, checkIns.length > 0, x.week);
  // A new goal takes the workspace's next key; a goal being changed keeps its own (buildGoal keeps it).
  const goal: Goal = existing ? { ...built, pending: null } : { ...built, key: nextKey(s.goals, s.keysIssued) };
  const question = planQuestion(existing, goal);
  if (question && !i.confirm) throw new NotAllowed(question.text);
  const needsReason = !!existing && checkIns.length > 0 && planChanged(existing, goal);
  if (needsReason && (i.reason ?? '').trim().length < MIN_REASON) throw new NotAllowed(REASON_EMPTY);

  const lookup: Lookup = { person: ownerOf, goal: (id) => (id === goal.id ? goal : s.goals.find((g) => g.id === id)), teamName: (id) => s.teams.find((t) => t.id === id)?.name ?? id };
  const change = goalChange(existing, goal, lookup, x.actor.id, x.now, x.newId('chg'));
  if (!change) return { commit: null, goal: existing ?? goal };
  if (i.reason?.trim()) change.diffs.push({ field: 'Why', from: '—', to: i.reason.trim() });
  // Stages already done at set-up go in the same save as the goal, so it is never seen late in between (OB2's rule 3).
  const done = !existing && i.stagesDone?.length ? stagesDoneAtSetUp(goal, i.stagesDone, x.actor.id, x.now, x.newId('ci')) : null;
  const doneChange = done ? checkInChange(null, done, goal, x.actor.id, x.newId('chg')) : null;
  return { commit: { goals: [goal], changes: [change, ...(doneChange ? [doneChange] : [])], ...(done ? { checkIns: [done] } : {}) }, goal };
}
