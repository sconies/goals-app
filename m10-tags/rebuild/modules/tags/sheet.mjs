// Fields: the Goals sheet's columns (rule tags-sheet). Every export's Goals sheet has a column per live field, headed with
// its name; loading one back changes a goal's value under the page's rules, asks once per value a list doesn't hold, and
// can be undone. The core in this rebuild has no workbook (the Spreadsheets module, stage 9, is not built here), so these
// are the module's half of it, ready for the change engine to call.
import { valueProblem, unknownValue, fold, isLive } from './rules.mjs';
import { liveFields, valueOf, writeValue, changeWords, mod, checkRow } from './fields.mjs';

export const exportColumns = (app) => (app.on('tags') ? liveFields(app.W).map((f) => ({ header: f.name, value: (g) => valueOf(app.W, g.id, f.id) })) : []);

/** headers: the Goals sheet's headers; rows: objects by header. Returns what the preview needs: the columns read and not
    read, the issues (Must fix and Checks, a Check once per field and value), and the plan. */
export function readFieldColumns(app, actor, headers, rows, answers = {}) {
  const on = app.on('tags');
  const admin = !!app.person(actor)?.admin;
  const live = on ? liveFields(app.W) : [];
  const fieldOf = (hd) => live.find((f) => fold(f.name) === fold(hd));
  const read = [], notRead = [];
  for (const hd of headers) { if (fieldOf(hd)) read.push(hd); }
  // a column headed with a name no live field has, or any field's while Fields is off, is a column nothing reads
  const all = mod(app.W).fields;
  for (const hd of headers) if (!fieldOf(hd) && all.some((f) => fold(f.name) === fold(hd))) notRead.push(hd);
  const issues = [], plan = [], addValues = [];
  const asked = new Map();
  rows.forEach((row, i) => {
    const line = i + 2;
    const g = (app.W.goals || []).find((x) => !x.removedAt && (fold(x.key) === fold(row.Key) || x.id === row.ID));
    if (!g) return;
    for (const hd of read) {
      const f = fieldOf(hd);
      const typed = String(row[hd] ?? '').trim();
      let to;
      const r = valueProblem(f, typed);
      if (r.problem && f.kind === 'list') {
        const k = `${f.id}:${fold(typed)}`;
        if (!asked.has(k)) asked.set(k, { f, value: typed, rows: [] });
        asked.get(k).rows.push({ line, g });
        continue;
      }
      if (r.problem) { issues.push({ kind: 'too-long', level: 'must', line, column: hd, message: r.problem }); continue; }
      to = r.kept;
      const from = valueOf(app.W, g.id, f.id);
      if (from === to) continue;
      if (g.ownerId !== actor && !admin) { issues.push({ kind: 'not-allowed', level: 'must', line, column: hd, message: `Only ${app.person(g.ownerId)?.name} or an admin can change ${g.key}.` }); continue; }
      plan.push({ goal: g, field: f, from, to, line });
    }
  });
  for (const [, a] of asked) {
    const q = unknownValue(a.f, a.value, a.rows.length, admin);
    const ans = answers[q.group];
    const value = a.f.options.find((o) => fold(o) === fold(a.value)) || a.value;
    if (ans === 'add' && admin) {
      if (!addValues.some((x) => x.field === a.f && fold(x.value) === fold(value))) addValues.push({ field: a.f, value });
      for (const { line, g } of a.rows) {
        const from = valueOf(app.W, g.id, a.f.id);
        if (g.ownerId !== actor && !admin) { issues.push({ kind: 'not-allowed', level: 'must', line, message: `Only ${app.person(g.ownerId)?.name} or an admin can change ${g.key}.` }); continue; }
        plan.push({ goal: g, field: a.f, from, to: value, line });
      }
    } else if (ans === 'empty') {
      for (const { line, g } of a.rows) { const from = valueOf(app.W, g.id, a.f.id); if (from && (g.ownerId === actor || admin)) plan.push({ goal: g, field: a.f, from, to: '', line }); }
    } else issues.push({ ...q, rows: a.rows.map((r) => r.line), answered: ans === 'add' && !admin ? 'Only an admin can add a value to a list.' : null });
  }
  const blocked = issues.some((i) => i.level === 'must' || i.level === 'check');
  return { read, notRead, issues, plan, addValues, saves: !blocked, nothing: !blocked && !plan.length && !addValues.length };
}

/** Save what readFieldColumns planned, all at once; the result is what Undo this import needs. */
export function applyFieldColumns(app, actor, res, importId) {
  if (!res.saves) return { error: 'Not saved: something must be fixed or answered first.' };
  const undo = { importId, values: [], added: [] };
  for (const a of res.addValues) {
    const f = a.field;
    if (f.options.some((o) => fold(o) === fold(a.value))) continue;
    const next = checkRow('field', { ...f, options: [...f.options, a.value] });
    undo.added.push({ fieldId: f.id, value: a.value });
    f.options = next.options;
    app.log(actor, { entity: 'field', module: 'tags', entityId: f.id, goalId: null, action: 'field', importId, summary: `${f.name}’s values changed`, diffs: [{ field: 'Values', from: next.options.slice(0, -1).join(', '), to: next.options.join(', ') }, { field: 'Via', from: '', to: 'Spreadsheet' }] }, 'spreadsheet');
  }
  for (const c of res.plan) {
    const before = mod(app.W).fieldValues.find((v) => v.id === `${c.goal.id}:${c.field.id}`);
    undo.values.push({ id: `${c.goal.id}:${c.field.id}`, before: before ? { ...before } : null });
    const ch = writeValue(app, actor, c, 'spreadsheet', [{ field: 'Via', from: '', to: 'Spreadsheet' }]);
    ch.importId = importId;
  }
  return { ok: true, undo, changed: res.plan.length };
}

/** Undo this import: the values back as they were, and a list value it added taken out, with the goals they sit on. */
export function undoFieldColumns(app, actor, undo) {
  const m = mod(app.W);
  for (const u of [...undo.values].reverse()) {
    const i = m.fieldValues.findIndex((v) => v.id === u.id);
    const now = i >= 0 ? m.fieldValues[i] : null;
    if (u.before) { if (i >= 0) m.fieldValues[i] = u.before; else m.fieldValues.push(u.before); } else if (i >= 0) m.fieldValues.splice(i, 1);
    const f = m.fields.find((x) => x.id === u.id.split(':').slice(1).join(':'));
    const g = app.W.goals.find((x) => x.id === u.id.split(':')[0]);
    if (f && g) app.log(actor, { entity: 'field', module: 'tags', entityId: f.id, goalId: g.id, action: 'undone', summary: changeWords({ field: f, from: now?.value || '', to: u.before?.value || '' }), diffs: [{ field: 'Via', from: '', to: 'Undo this import' }] }, 'app');
  }
  for (const a of undo.added) {
    const f = m.fields.find((x) => x.id === a.fieldId);
    if (!f) continue;
    const held = m.fieldValues.some((v) => v.fieldId === f.id && !v.removedAt && fold(v.value) === fold(a.value));
    if (!held && f.options.length > 1) f.options = f.options.filter((o) => o !== a.value);
  }
  return { ok: true };
}
export { isLive };
