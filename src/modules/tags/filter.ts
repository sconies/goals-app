/* Tags' rule 3 (TG2, docs/design/round-4/tags/spec.md section 5): which goals a field filter keeps. A goal matches every
   field filtered; for each, one of the values picked, where "Not set" is a goal with no value. Goals' filters, saved
   views and find_goals all read it (through records.ts, the module's goal columns), so it is small and imports only
   types: it is in the first download with the module's records, and the module's other rules are not. */
import type { GoalField, GoalFieldValue } from './types';

/** What a goal with no value for a field is called, in the Filters sheet, the filter line, a link and find_goals. */
export const NOT_SET = 'Not set';
/** A field filter's parameter in a Goals address starts with this: `/goals?f.<field id>=Build`. */
export const FILTER_PREFIX = 'f.';
export const filterParam = (fieldId: string) => `${FILTER_PREFIX}${fieldId}`;

/** The values picked, by field id: each a list value as the list writes it, or "Not set". An empty list filters nothing. */
export type FieldFilters = Readonly<Record<string, readonly string[]>>;
type Values = readonly Pick<GoalFieldValue, 'goalId' | 'fieldId' | 'value' | 'removedAt'>[];

const k = (s: string) => s.trim().toLowerCase();

/** Rule 3 for one goal at a time: whether a goal (by id) matches every field filtered. */
export function fieldMatcher(values: Values, filters: FieldFilters): (goalId: string) => boolean {
  const want = Object.entries(filters).filter(([, picked]) => picked.length).map(([f, picked]) => [f, new Set(picked.map(k))] as const);
  if (!want.length) return () => true;
  const fields = new Set(want.map(([f]) => f));
  const held = new Map<string, string>();
  for (const v of values) if (fields.has(v.fieldId) && !v.removedAt && v.value.trim()) held.set(`${v.goalId}:${v.fieldId}`, k(v.value));
  return (goalId) => want.every(([f, picked]) => picked.has(held.get(`${goalId}:${f}`) ?? k(NOT_SET)));
}

/** Rule 3: the goals that match every field filtered, in their order. */
export function filterGoals<G extends { id: string }>(goals: readonly G[], values: Values, filters: FieldFilters): G[] {
  const match = fieldMatcher(values, filters);
  return goals.filter((g) => match(g.id));
}

/**
 * The values a filter's text picks from a list field, as the list writes them: "Build,Run" or "build, not set". Read
 * against the list, so a value with a comma in it ("Data, AI") is still one value; anything the list doesn't hold is
 * left out, as a link's unknown values are (domain/query).
 */
export function pickedOf(field: Pick<GoalField, 'options'>, text: string): string[] {
  const known = [...field.options.map((o) => o.trim()), NOT_SET];
  const parts = text.split(',');
  const out: string[] = [];
  for (let i = 0; i < parts.length;) {
    // The longest run of parts that is one of the list's values (or Not set).
    let hit = -1;
    for (let j = parts.length; j > i && hit < 0; j--) { const t = k(parts.slice(i, j).join(',')); if (known.some((o) => k(o) === t)) hit = j; }
    if (hit < 0) { i++; continue; }
    const v = known.find((o) => k(o) === k(parts.slice(i, hit).join(',')))!;
    if (!out.includes(v)) out.push(v);
    i = hit;
  }
  return out;
}

/** The values picked, as a filter's text (the parameter's value): in the list's order, Not set last. */
export const pickedText = (field: Pick<GoalField, 'options'>, picked: readonly string[]): string =>
  [...field.options.map((o) => o.trim()), NOT_SET].filter((o) => picked.some((p) => k(p) === k(o))).join(',');
