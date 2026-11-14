/* Tags (TG, docs/design/round-4/tags/spec.md section 5): a workspace's own fields on goals, each a short list of values
   or free text. Pure. No rule in src/domain reads a field (no status, flag or check-in rule): that is what lets the
   module be switched off. The database holds each limit too (migration 0052; src/spec/limits.ts). */

import type { GoalField } from './types';

export type { GoalField } from './types';

/** The limits: live fields per workspace (Lane, 1a), a name, a list's values and each value, and a goal's value. */
export const FIELD_LIMITS = { fields: 6, name: 40, values: 20, option: 40, value: 80 } as const;

const key = (s: string) => s.trim().toLowerCase();
const live = (f: Pick<GoalField, 'retiredAt'>) => !f.retiredAt;

/**
 * Rule 1. What stops a field being saved, or null: a name of 1 to 40 characters that no other live field has (whatever
 * the case); a list of 1 to 20 values, each 1 to 40 characters, none twice; free text with no values; and no more than
 * six live fields. `fields`
 * is the workspace's fields as they are now (the one being changed among them, by id, or not yet).
 */
export function fieldProblem(field: Pick<GoalField, 'id' | 'name' | 'kind' | 'options' | 'retiredAt'>, fields: readonly Pick<GoalField, 'id' | 'name' | 'retiredAt'>[]): string | null {
  const name = field.name.trim();
  if (!name) return 'Give the field a name.';
  if (name.length > FIELD_LIMITS.name) return `Keep the name to ${FIELD_LIMITS.name} characters.`;
  const others = fields.filter((f) => f.id !== field.id && live(f));
  if (live(field) && others.some((f) => key(f.name) === key(name))) return `There’s already a field called “${others.find((f) => key(f.name) === key(name))!.name.trim()}”.`;
  if (live(field) && !fields.some((f) => f.id === field.id && live(f)) && others.length >= FIELD_LIMITS.fields) return `A workspace has at most ${FIELD_LIMITS.fields} fields. Retire one first.`;
  // A free-text field holds no list (the database holds the same: migration 0054).
  if (field.kind === 'text') return field.options.length ? 'A free-text field has no values: choose A list of values, or leave the values out.' : null;
  const values = field.options.map((v) => v.trim());
  if (!values.filter(Boolean).length) return 'A list needs at least one value.';
  if (values.some((v) => !v)) return 'Remove the empty value, or type one.';
  if (values.length > FIELD_LIMITS.values) return `A list holds at most ${FIELD_LIMITS.values} values.`;
  const long = values.find((v) => v.length > FIELD_LIMITS.option);
  if (long) return `Keep each value to ${FIELD_LIMITS.option} characters: “${long.slice(0, 20)}…” is longer.`;
  const twice = values.find((v, i) => values.findIndex((w) => key(w) === key(v)) !== i);
  if (twice) return `“${twice}” is in the list twice.`;
  return null;
}

/**
 * Rule 2. A goal's value for a field, as stored, or why not: empty clears it; a list's value must be one of its values
 * (whatever the case) and is kept as the list writes it; free text is at most 80 characters. Spaces at either end go.
 */
export function valueProblem(field: Pick<GoalField, 'name' | 'kind' | 'options'>, typed: string): { value: string } | { problem: string } {
  const v = typed.trim();
  if (!v) return { value: '' };
  if (field.kind === 'text') return v.length > FIELD_LIMITS.value ? { problem: `Keep ${field.name.trim()} to ${FIELD_LIMITS.value} characters.` } : { value: v };
  const hit = field.options.find((o) => key(o) === key(v));
  if (hit) return { value: hit.trim() };
  const list = field.options.map((o) => o.trim());
  const said = list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}` : list[0] ?? '';
  return { problem: `“${v}” isn’t one of ${field.name.trim()}’s values: ${said}.` };
}
