// Fields' rule tags-sheet: the Goals sheet's columns, written and read back. Pure over the workspace given.
import { valueProblem, FIELD_LIMITS } from './rules.mjs';
import { liveFields, valueOf } from './fields.mjs';

const Q = (s) => `“${s}”`;
const low = (s) => String(s ?? '').trim().toLowerCase();
const rowsWord = (n) => (n === 1 ? '1 row' : `${n} rows`);

/** The columns every export's Goals sheet adds after the core's: one per live field, headed with its name. */
export const columns = (W) => liveFields(W).map((f) => f.name);
/** What Start here says each column holds. */
export const readme = (W) => liveFields(W).map((f) => ({ column: f.name, holds: f.kind === 'list' ? `One of ${f.options.join(', ')}, or empty for Not set.` : `Free text, up to ${FIELD_LIMITS.text} characters, or empty for Not set.` }));
/** A goal's cells. */
export const cells = (W, goal) => Object.fromEntries(liveFields(W).map((f) => [f.name, valueOf(W, goal.id, f.id)]));

/** The question about a value a list doesn't hold: asked once per field and value. */
export function unknownValue(field, value, rows, admin) {
  return { kind: 'module-value', level: 'check', group: `module-value:Goals:${low(field.name)}:${low(value)}`,
    message: admin ? `${field.name} says ${Q(value)} on ${rowsWord(rows)}. Add ${Q(value)} to ${field.name}, or leave these cells empty?`
      : `${field.name} says ${Q(value)} on ${rowsWord(rows)}, which isn’t one of its values, and only an admin can add one. Leave these cells empty, or fix the file?`,
    choices: admin ? [['add', `Add ${Q(value)} to ${field.name}`], ['empty', 'Leave these cells empty']] : [['empty', 'Leave these cells empty']] };
}

/**
 * Reads a Goals sheet's field columns. rows: [{ line, raw: { header: cell } }]; goalOf(raw) finds the row's goal (or null
 * for a new goal: nothing to read yet). Gives the headers it read, the changes (only what differs), the problems and
 * questions (as the change engine raises them), and the values an admin's answers add to a list.
 */
export function readFieldColumns({ W, rows, headers, actor, answers = {}, goalOf }) {
  const live = liveFields(W);
  const byName = new Map(live.map((f) => [low(f.name), f]));
  const read = headers.filter((h) => byName.has(low(h)));
  const issues = [], changes = [], adds = [];
  if (!read.length) return { read, issues, changes, adds };
  const unknown = new Map(); // group -> { field, value, lines }
  const pending = [];
  for (const r of rows) {
    const goal = goalOf(r.raw);
    if (!goal) continue;
    for (const h of read) {
      const f = byName.get(low(h));
      const cell = r.raw[h] === undefined || r.raw[h] === null ? '' : String(r.raw[h]);
      const res = valueProblem(f, cell);
      const before = valueOf(W, goal.id, f.id);
      if (res.problem && f.kind === 'list') {
        const k = `${f.id}:${low(cell)}`;
        if (!unknown.has(k)) unknown.set(k, { field: f, value: cell.trim(), lines: [] });
        unknown.get(k).lines.push({ line: r.line, goal, before });
        continue;
      }
      if (res.problem) { issues.push({ sheet: 'goals', row: r.line, kind: 'too-long', level: 'must', column: f.name, message: `${f.name} on row ${r.line} has more than ${FIELD_LIMITS.text} characters.` }); continue; }
      if (res.kept === before) continue;
      pending.push({ line: r.line, goal, field: f, from: before, to: res.kept });
    }
  }
  for (const u of unknown.values()) {
    const q = unknownValue(u.field, u.value, u.lines.length, !!actor.admin);
    const a = answers[q.group];
    if (a === 'add' && actor.admin) {
      adds.push({ fieldId: u.field.id, value: u.value });
      for (const l of u.lines) if (l.before !== u.value) pending.push({ line: l.line, goal: l.goal, field: u.field, from: l.before, to: u.value });
    } else if (a === 'empty') { /* those cells change nothing */ } else issues.push({ sheet: 'goals', row: u.lines[0].line, column: u.field.name, value: u.value, ...q });
  }
  // a goal the loader may not change: the core's Must fix
  for (const p of pending) {
    if (actor.admin || p.goal.ownerId === actor.id) changes.push(p);
    else issues.push({ sheet: 'goals', row: p.line, kind: 'not-allowed', level: 'must', column: p.field.name, message: `Only the goal’s owner or an admin can change its fields: ${p.goal.title} is ${p.goal.ownerName ?? 'someone else'}’s.` });
  }
  return { read, issues, changes, adds };
}
