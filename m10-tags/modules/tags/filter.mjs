// Fields' rule tags-filter: which goals a filter on a list field keeps, and how a link writes it. Pure.
import { NOT_SET, listOr } from './rules.mjs';
export { NOT_SET };
const low = (s) => String(s ?? '').trim().toLowerCase();

/** The values a filter's text picks, in the list's order, Not set last. A value with a comma in it is read as one;
    a value the list doesn't hold is left out. */
export function pickedOf(field, text) {
  const parts = String(text ?? '').split(',');
  const known = [...field.options, NOT_SET];
  const got = new Set();
  let i = 0;
  while (i < parts.length) {
    let matched = 0;
    for (let j = parts.length; j > i; j--) { // the longest run of parts that is one value
      const cand = low(parts.slice(i, j).join(','));
      const hit = known.find((k) => low(k) === cand);
      if (hit) { got.add(hit); matched = j - i; break; }
    }
    i += matched || 1;
  }
  return known.filter((k) => got.has(k));
}
/** The text a link and a saved view carry. */
export const pickedText = (field, picked) => pickedOf(field, picked.join(',')).join(',');
/** The filter line's words: “Stage is Build or Run”. */
export const pickedWords = (field, picked) => `${field.name} is ${listOr(picked)}`;

/** One field's test: a goal matches when its value is one of those picked; Not set matches no value. */
export function fieldMatcher(field, picked, valueOf) {
  if (!picked.length) return () => true;
  const want = new Set(picked.map(low));
  return (goal) => { const v = valueOf(goal.id, field.id); return v ? want.has(low(v)) : want.has(low(NOT_SET)); };
}

/** Goals that match every field filtered. `filters`: [{ field, picked }]; `values`: the field values (rows). */
export function filterGoals(goals, values, filters) {
  const map = new Map();
  for (const v of values || []) if (!v.removedAt && v.value) map.set(`${v.goalId}:${v.fieldId}`, v.value);
  const valueOf = (g, f) => map.get(`${g}:${f}`) || '';
  const tests = filters.map(({ field, picked }) => fieldMatcher(field, picked, valueOf));
  return goals.filter((g) => tests.every((t) => t(g)));
}
