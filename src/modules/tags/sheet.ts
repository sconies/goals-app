/* Fields' columns on the Goals sheet, read back (TG2, docs/design/round-4/tags/spec.md section 2.4): one column per live
   field, headed with its name. The change engine (domain/changeset) gives it every Goals row it saves or keeps, with the
   cells under those headers; only what differs from what is saved changes anything, so a workbook exported and loaded
   back changes nothing. A value a list doesn't hold is a Check, asked once per field and value (rule 7's groups): an
   admin may add it to the list, anyone else leaves those cells empty (Lane, 4a). Loaded with the change engine
   (records.ts `load`), never with the first download; every change goes through fields.ts, so History says it as the
   goal's page does. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { applyModuleRows, type GoalColumnsOutcome, type GoalColumnsRead } from '../../domain/records';
import type { Change, Diff } from '../../domain/types';
import { changeField, liveFields, setGoalFields, valueOf } from './fields';
import { fieldProblem, valueProblem } from './rules';

const k = (s: string) => s.trim().toLowerCase();
const rows = (n: number) => (n === 1 ? '1 row' : `${n} rows`);

/** The question for a value a list doesn't hold, in the spec's words, and its answers: Add (an admin, while the list has
    room), or leave the cells empty. */
export function unknownValue(field: string, value: string, count: number, canAdd: boolean): { message: string; answers: { choice: string; label: string }[] } {
  return canAdd
    ? { message: `${field} says “${value}” on ${rows(count)}. Add “${value}” to ${field}, or leave these cells empty?`, answers: [{ choice: 'add', label: `Add “${value}” to ${field}` }, { choice: 'empty', label: 'Leave these cells empty' }] }
    : { message: `${field} says “${value}” on ${rows(count)}, which isn’t one of its values, and only an admin can add one. Leave these cells empty, or fix the file?`, answers: [{ choice: 'empty', label: 'Leave these cells empty' }] };
}

export function readFieldColumns(r: GoalColumnsRead): GoalColumnsOutcome {
  let s = r.snapshot;
  const x = { snapshot: s, actor: r.actor, now: r.now, newId: r.newId } as ActionContext;
  const out: GoalColumnsOutcome = { commit: {}, changes: [], diffs: {} };
  const fields = liveFields(s).filter((f) => r.rows.some((row) => f.name in row.cells));
  // Values a list doesn't hold, by field and value: how many rows say each, and how it was answered.
  const wanted = new Map<string, Map<string, string>>(); // goal id → field id → value as typed
  const unknown = new Map<string, { field: string; value: string; rows: number[] }>();
  for (const f of fields) {
    for (const row of r.rows) {
      if (!(f.name in row.cells)) continue;
      const typed = row.cells[f.name] ?? '';
      const v = valueProblem(f, typed);
      if ('value' in v) { (wanted.get(row.goal.id) ?? wanted.set(row.goal.id, new Map()).get(row.goal.id)!).set(f.id, v.value); continue; }
      if (f.kind === 'text') { r.raise({ kind: 'too-long', row: row.row, name: row.goal.title, column: f.name, found: typed.trim().slice(0, 40), message: v.problem }); continue; }
      const key = `${f.id}|${k(typed)}`;
      const u = unknown.get(key) ?? unknown.set(key, { field: f.id, value: typed.trim(), rows: [] }).get(key)!;
      u.rows.push(row.row);
    }
  }
  // Each value a list doesn't hold: asked once (one group per field and value); answered, every row it covers follows.
  const adds = new Map<string, string[]>();
  for (const u of unknown.values()) {
    const f = fields.find((v) => v.id === u.field)!;
    const roomy = !fieldProblem({ ...f, options: [...f.options, ...(adds.get(f.id) ?? []), u.value] }, liveFields(s));
    const canAdd = r.actor.admin && roomy;
    const a = r.answer(f.name, u.value);
    const goalsAt = (row: number) => r.rows.find((x) => x.row === row)!.goal;
    if (a?.choice === 'add' && canAdd) {
      adds.set(f.id, [...(adds.get(f.id) ?? []), u.value]);
      for (const row of u.rows) { const g = goalsAt(row); (wanted.get(g.id) ?? wanted.set(g.id, new Map()).get(g.id)!).set(f.id, u.value); }
    } else if (a?.choice === 'empty') {
      for (const row of u.rows) { const g = goalsAt(row); (wanted.get(g.id) ?? wanted.set(g.id, new Map()).get(g.id)!).set(f.id, ''); }
    } else {
      const q = unknownValue(f.name, u.value, u.rows.length, canAdd);
      for (const row of u.rows) r.raise({ kind: 'module-value', row, name: goalsAt(row).title, column: f.name, found: u.value, message: q.message, answers: q.answers });
    }
  }
  const changes: Change[] = [];
  // An admin's added values first, through the rule that changes a list (History: “Stage’s values changed”).
  for (const [id, more] of adds) {
    const f = fields.find((v) => v.id === id)!;
    const c = changeField(x, id, { name: f.name, options: [...f.options, ...more] });
    if (!c) continue;
    out.commit = { modules: applyModuleRows(out.commit.modules, c.modules) };
    s = { ...s, modules: applyModuleRows(s.modules, c.modules) };
    changes.push(...c.changes);
  }
  // Then each goal's values: only those that differ from what is saved, so loading an export back changes nothing.
  for (const row of r.rows) {
    const want = wanted.get(row.goal.id);
    if (!want) continue;
    const differ = Object.fromEntries([...want].filter(([fid, v]) => valueOf(s, row.goal.id, fid) !== v));
    if (!Object.keys(differ).length) continue;
    try {
      const c = setGoalFields({ ...x, snapshot: s }, row.goal, differ);
      if (!c) continue;
      out.commit = { modules: applyModuleRows(out.commit.modules, c.modules) };
      changes.push(...c.changes);
      out.diffs[row.goal.id] = [...(out.diffs[row.goal.id] ?? []), ...c.changes.flatMap((ch): Diff[] => ch.diffs)];
    } catch (e) {
      if (!(e instanceof NotAllowed)) throw e;
      r.raise({ kind: 'not-allowed', row: row.row, name: row.goal.title, column: fields.find((f) => f.id in differ)!.name, message: e.message });
    }
  }
  out.changes = changes;
  return out;
}
