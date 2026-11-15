/* What Fields adds to Goals (TG2, docs/design/round-4/tags/spec.md sections 2.3 and 2.4), loaded only when the workspace
   has a live field (records.ts goalExtras), never with the first download:

   - a family of Goals filters: a row per live list field in the Filters sheet ("Stage: Discover · Build · Run ·
     Not set"), "Stage is Build" on the filter line, `?f.<field id>=Build,Run` in the address (kept by saved views), and
     find_goals' `fields`; free text isn't a filter (Lane, 2a);
   - its columns on the Goals sheet: one per live field, headed with its name, in every export and on Data, read back
     by the change engine (sheet.ts). */
import type { ColumnFill } from '../../domain/query';
import type { GoalExtras } from '../../domain/records';
import type { Snapshot } from '../../domain/types';
import { liveFields, valuesOf } from './fields';
import { fieldMatcher, filterParam, NOT_SET, pickedOf, pickedText } from './filter';
import { fieldParams } from './find';
import { readFieldColumns } from './sheet';

type Rows = Pick<Snapshot, 'modules'>;
const lists = (s: Rows) => liveFields(s).filter((f) => f.kind === 'list');
const fieldOf = (s: Rows, param: string) => lists(s).find((f) => filterParam(f.id) === param) ?? null;
const held = (s: Rows) => { const m = new Map<string, string>(); for (const v of valuesOf(s)) if (!v.removedAt && v.value) m.set(`${v.goalId}:${v.fieldId}`, v.value); return m; };
const or = (v: string[]) => (v.length > 1 ? `${v.slice(0, -1).join(', ')} or ${v[v.length - 1]}` : v[0] ?? '');

/** Each live list field's column, by its parameter: the goal's value (or Not set), and rule 3's test for what is picked. */
function columns(s: Snapshot): Record<string, ColumnFill> {
  const out: Record<string, ColumnFill> = {};
  const by = held(s);
  const values = valuesOf(s);
  for (const f of lists(s)) {
    const fill: ColumnFill = (g) => by.get(`${g.id}:${f.id}`) ?? NOT_SET;
    // A link's text read once per text, not once per goal.
    let last: { text: string; match: (goalId: string) => boolean } | null = null;
    fill.test = (g, text) => {
      if (last?.text !== text) { const picked = pickedOf(f, text); last = { text, match: picked.length ? fieldMatcher(values, { [f.id]: picked }) : () => true }; }
      return last.match(g.id);
    };
    out[filterParam(f.id)] = fill;
  }
  return out;
}

const extras: GoalExtras = {
  family: {
    columns,
    rows: (s) => lists(s).map((f) => ({ param: filterParam(f.id), label: f.name, options: [...f.options, NOT_SET] })),
    picked: (s, param, text) => { const f = fieldOf(s, param); return f ? pickedOf(f, text) : []; },
    text: (s, param, picked) => { const f = fieldOf(s, param); return f ? pickedText(f, picked) : ''; },
    says: (s, param, text) => { const f = fieldOf(s, param); const p = f ? pickedOf(f, text) : []; return f && p.length ? { label: `${f.name} is`, value: or(p) } : null; },
    arg: { module: 'Fields', name: 'fields', description: `Goals with these values of the workspace’s own list fields (list_fields), by name: {"Stage": "Build, Run"}; "${NOT_SET}" for none. Free text can’t filter.`, params: fieldParams },
  },
  sheet: {
    columns: (s) => liveFields(s).map((f) => ({ header: f.name, about: `The workspace’s own field: ${f.kind === 'list' ? `one of ${f.options.join(', ')}` : 'free text'}, or empty for none.` })),
    cell: (s, goalId, header) => { const f = liveFields(s).find((x) => x.name === header); return (f && held(s).get(`${goalId}:${f.id}`)) || null; },
    read: readFieldColumns,
  },
};

export default extras;
