// Fields' rule tags-fields (spec/modules/tags/rules.md): what a field must say, and what a goal's value for one may be.
// Pure: no store, no screen, no network.
export const FIELD_LIMITS = { live: 6, name: 40, options: 20, option: 40, text: 80 };
export const NOT_SET = 'Not set';
const Q = (s) => `“${s}”`;
const low = (s) => String(s ?? '').trim().toLowerCase();
export const listOr = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
export const isLive = (f) => !f.retiredAt;

/** The problem that stops a field being saved, or null. `others` are the workspace's other fields (any state). */
export function fieldProblem(field, others = []) {
  const name = String(field.name ?? '').trim();
  if (!name) return 'Give the field a name.';
  if (name.length > FIELD_LIMITS.name) return `A field’s name has at most ${FIELD_LIMITS.name} characters.`;
  const live = others.filter((o) => isLive(o) && o.id !== field.id);
  const same = live.find((o) => low(o.name) === low(name));
  if (same) return `There’s already a field called ${Q(same.name)}.`;
  if (!field.id || !others.some((o) => o.id === field.id && isLive(o))) {
    if (isLive(field) && live.length >= FIELD_LIMITS.live) return `A workspace has at most ${FIELD_LIMITS.live} fields. Retire one first.`;
  }
  if (field.kind !== 'list' && field.kind !== 'text') return 'A field is a list of values or free text.';
  const opts = (field.options || []).map((o) => String(o).trim());
  if (field.kind === 'text') return opts.filter(Boolean).length ? 'A free-text field has no values: choose A list of values, or leave the values out.' : null;
  const vals = opts.filter(Boolean);
  if (!vals.length) return 'A list needs at least one value.';
  if (vals.length > FIELD_LIMITS.options) return `A list holds at most ${FIELD_LIMITS.options} values.`;
  for (const v of vals) if (v.length > FIELD_LIMITS.option) return `${Q(v)} has more than ${FIELD_LIMITS.option} characters.`;
  for (const v of vals) if (low(v) === low(NOT_SET)) return `A list can’t hold a value called ${Q(NOT_SET)}.`;
  const seen = new Set();
  for (const v of vals) { if (seen.has(low(v))) return `${Q(v)} is in the list twice.`; seen.add(low(v)); }
  return null;
}

/** A field as it will be saved: name and values trimmed, empty lines dropped. */
export function cleanField(field) {
  return { ...field, name: String(field.name ?? '').trim(), options: (field.options || []).map((o) => String(o).trim()).filter(Boolean) };
}

/** A goal's value for a field, typed: { kept } (empty string: cleared) or { problem }. */
export function valueProblem(field, typed) {
  const t = String(typed ?? '').trim();
  if (!t) return { kept: '' };
  if (field.kind === 'list') {
    const hit = field.options.find((o) => low(o) === low(t));
    if (hit) return { kept: hit };
    return { problem: `${Q(t)} isn’t one of ${field.name}’s values: ${listOr(field.options)}.` };
  }
  if (t.length > FIELD_LIMITS.text) return { problem: `Keep ${field.name} to ${FIELD_LIMITS.text} characters.` };
  return { kept: t };
}
