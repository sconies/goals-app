// Fields' rules (spec/modules/tags/rules.md): pure, no screen, no store. tags-fields, tags-filter, tags-sheet.
export const FIELD_LIMITS = { live: 6, name: 40, values: 20, value: 40, text: 80 };
export const NOT_SET = 'Not set';
// The Goals sheet's own columns (spec/core/export-format.md, ## Goals): a field may not be read the same way as one.
export const SHEET_COLUMNS = ['Key', 'ID', 'Goal', 'Action', 'Ref', 'Level', 'Team', 'Owner', 'Owner email', 'Type', 'State', 'Unit', 'Decimals', 'Start', 'Baseline period', 'Baseline is', 'Target', 'Plan', 'From', 'Plan from week', 'To', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Feeds into key', 'Feeds into ref', 'Why it helps', 'Effect', 'Source', 'Definition', 'Reason', 'Status', 'Since', 'Now', 'Plan this week', 'Gap', 'Last check-in week', 'Forecast', 'Why it’s off', 'Recovery plan', 'By when', 'Needs', 'Next step', 'Warnings', 'Result', 'Q1', 'Q2', 'Q3', 'Q4'];

/** whatever the case or accents, spaces at either end not counted */
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
export const isLive = (f) => !f.retiredAt;
const q = (s) => `“${s}”`;
const orList = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/** What stops a field being saved, or null. `fields` are the workspace's fields; `id` the one being changed, if any. */
export function fieldProblem(field, fields = [], id = null) {
  const name = String(field.name ?? '').trim();
  if (!name) return 'Give the field a name.';
  if (name.length > FIELD_LIMITS.name) return `A field’s name has at most ${FIELD_LIMITS.name} characters.`;
  const others = fields.filter((f) => f.id !== id);
  const live = others.filter(isLive);
  const same = live.find((f) => fold(f.name) === fold(name));
  if (same) return `There’s already a field called ${q(same.name)}.`;
  const col = SHEET_COLUMNS.find((c) => fold(c) === fold(name));
  if (col) return `The Goals sheet already has a column called ${q(col)}. Call the field something else.`;
  const becomingLive = !id || isLive(fields.find((f) => f.id === id) || {});
  if (becomingLive && !field.retiredAt && live.length >= FIELD_LIMITS.live) return `A workspace has at most ${FIELD_LIMITS.live} fields. Retire one first.`;
  if (field.kind !== 'list' && field.kind !== 'text') return 'A field is a list of values or free text.';
  const options = (field.options || []).map((o) => String(o).trim());
  if (field.kind === 'text') return options.filter(Boolean).length ? 'A free-text field has no values: choose A list of values, or leave the values out.' : null;
  const vals = options.filter(Boolean);
  if (!vals.length) return 'A list needs at least one value.';
  if (vals.length > FIELD_LIMITS.values) return `A list holds at most ${FIELD_LIMITS.values} values.`;
  const long = vals.find((v) => v.length > FIELD_LIMITS.value);
  if (long) return `A value has at most ${FIELD_LIMITS.value} characters: ${q(long)} has ${long.length}.`;
  if (vals.some((v) => fold(v) === fold(NOT_SET))) return `A list can’t hold a value called ${q(NOT_SET)}: it means no value.`;
  const seen = new Set();
  for (const v of vals) { if (seen.has(fold(v))) return `${q(v)} is in the list twice.`; seen.add(fold(v)); }
  return null;
}

/** A goal's value as typed for a field: { kept } (empty: cleared) or { problem }. */
export function valueProblem(field, typed) {
  const t = String(typed ?? '').trim();
  if (!t) return { kept: '' };
  if (field.kind === 'list') {
    const hit = (field.options || []).find((o) => fold(o) === fold(t));
    return hit ? { kept: hit } : { problem: `${q(t)} isn’t one of ${field.name}’s values: ${orList(field.options || [])}.` };
  }
  if (t.length > FIELD_LIMITS.text) return { problem: `Keep ${field.name} to ${FIELD_LIMITS.text} characters.` };
  return { kept: t };
}

// ---------- tags-filter ----------
/** A filter's text (a link's f.<id>, a view's, find_goals' fields) read against the list: the values it holds, in the list's
    order, Not set last; a value it doesn't hold is left out. A value with a comma in it is read as one. */
export function pickedOf(field, text) { return readFilter(field, text).picked; }
/** The values a filter's text holds (list order, Not set last) and the parts it doesn't (rest). */
export function readFilter(field, text) {
  let s = String(text ?? '');
  const picked = new Set();
  // the list's own values first, longest first, so a value with a comma in it ("Build, Run" as one value) is read as one
  const opts = [...(field.options || []), NOT_SET].sort((a, b) => b.length - a.length);
  for (const o of opts) {
    const re = new RegExp(`(^|,)\\s*${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?=,|$)`, 'i');
    let m;
    while ((m = re.exec(s))) { picked.add(o); s = s.slice(0, m.index) + (m[1] ? ',' : '') + s.slice(m.index + m[0].length); }
  }
  const order = [...(field.options || []), NOT_SET];
  return { picked: order.filter((o) => picked.has(o)), rest: s.split(',').map((x) => x.trim()).filter(Boolean) };
}
export const pickedText = (field, picked) => [...(field.options || []), NOT_SET].filter((o) => picked.some((p) => fold(p) === fold(o))).join(',');
export const pickedWords = (field, picked) => `${field.name} is ${picked.join(' or ')}`;

/** goals: [{id}]; valueOf(goalId, fieldId) → stored value ('' for none); filters: [{ field, picked }] */
export function filterGoals(goals, filters, valueOf) {
  const active = filters.filter((f) => f.field.kind === 'list' && f.picked.length);
  return goals.filter((g) => active.every(({ field, picked }) => {
    const v = valueOf(g.id, field.id) || '';
    return picked.some((p) => (p === NOT_SET ? !v : fold(p) === fold(v)));
  }));
}

// ---------- tags-sheet ----------
/** The question a Goals sheet asks once about a value a list doesn't hold, and the answers it offers. */
export function unknownValue(field, value, rows, admin) {
  const n = rows;
  return {
    kind: 'module-value', level: 'check', group: `field:${field.id}:${fold(value)}`,
    message: `${field.name} says ${q(value)} on ${n} ${n === 1 ? 'row' : 'rows'}. Add ${q(value)} to ${field.name}, or leave these cells empty?`,
    ...(admin ? {} : { message: `${field.name} says ${q(value)} on ${n} ${n === 1 ? 'row' : 'rows'}, which isn’t one of its values, and only an admin can add one. Leave these cells empty, or fix the file?` }),
    answers: admin ? ['add', 'empty'] : ['empty'],
    labels: { add: `Add ${q(value)} to ${field.name}`, empty: 'Leave these cells empty' },
  };
}
