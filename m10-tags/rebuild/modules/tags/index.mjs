// Fields (module id tags, spec/modules/tags/README.md): a workspace's own fields on goals. It registers into the core's
// module platform: a Workspace section (/workspace/fields), the goal.sections place, actions, three AI tools and an
// argument of find_goals, a family of Goals filters (f.<field id>), columns on Data's Goals table, and a Help article.
import { isLive, fold, NOT_SET, readFilter, pickedOf, pickedText, pickedWords, filterGoals, valueProblem } from './rules.mjs';
import * as F from './fields.mjs';
import { exportColumns } from './sheet.mjs';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NAME = 'Fields';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isAdmin = (app, v) => !!(v && app.person(v.id || v)?.admin);

// a form inside a dialog posts with fetch and shows a refusal under it, in the rule's words
const SCRIPT = `<script>document.addEventListener('submit', async (e) => { const f = e.target.closest('form[data-fetch]'); if (!f) return; e.preventDefault();
  const r = await fetch(f.action, { method: 'POST', body: new URLSearchParams(new FormData(f)), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  if (r.ok || r.redirected) { location.reload(); return; }
  const d = new DOMParser().parseFromString(await r.text(), 'text/html'); const line = f.querySelector('.fix-line'); line.textContent = d.querySelector('.refused')?.textContent || 'Not saved.'; line.hidden = false; });</script>`;

function fieldsPage(app, ctx) {
  const v = ctx.viewer, admin = isAdmin(app, v);
  const all = F.ordered(app.W), live = all.filter(isLive), retired = all.filter((f) => !isLive(f));
  const row = (f, i) => `<li class="field-row"><p class="fname">${h(f.name)}</p><p class="fkind">${h(F.kindWords(f))}</p><p class="fcount">${plural(F.goalsWithValue(app.W, f), 'goal has a value', 'goals have a value')}</p>${admin ? `<p class="factions">
    <button type="button" data-dialog="edit-${h(f.id)}">Change</button>
    <form method="post" action="/act/tags.moveField" class="inline"><input type="hidden" name="fieldId" value="${h(f.id)}"><input type="hidden" name="by" value="-1"><button ${i === 0 ? 'disabled' : ''} aria-label="Move ${h(f.name)} up">Up</button></form>
    <form method="post" action="/act/tags.moveField" class="inline"><input type="hidden" name="fieldId" value="${h(f.id)}"><input type="hidden" name="by" value="1"><button ${i === live.length - 1 ? 'disabled' : ''} aria-label="Move ${h(f.name)} down">Down</button></form>
    <form method="post" action="/act/tags.retireField" class="inline"><input type="hidden" name="fieldId" value="${h(f.id)}"><button aria-label="Retire ${h(f.name)}">Retire</button></form></p>
    <dialog id="edit-${h(f.id)}" aria-label="Change ${h(f.name)}"><form method="post" action="/act/tags.changeField" data-fetch><h2>Change ${h(f.name)}</h2><input type="hidden" name="fieldId" value="${h(f.id)}">
      <label>Name <input name="name" value="${h(f.name)}" maxlength="40" required></label>${f.kind === 'list' ? `<label>Values <textarea name="options" rows="6">${h(f.options.join('\n'))}</textarea></label><p class="hint">One value on each line, up to 20.</p>` : '<p>Free text: a field’s kind doesn’t change once it is added.</p>'}
      <p class="fix-line" role="alert" hidden></p><button class="primary">Save</button> <button type="button" data-close-dialog>Cancel</button></form></dialog>` : ''}</li>`;
  const body = `<h1>Fields</h1><p>A workspace’s own fields on goals, up to 6, such as a stage or a programme. No rule reads them: they are for finding and sorting.</p>
    ${live.length ? `<ul class="fields" aria-label="Fields">${live.map(row).join('')}</ul>` : '<p class="empty">No fields yet</p>'}
    ${admin ? `<button class="btn primary" data-dialog="add-field">Add a field</button>
    <dialog id="add-field" aria-label="Add a field"><form method="post" action="/act/tags.addField" data-fetch><h2>Add a field</h2>
      <label>Name <input name="name" maxlength="60" required></label>
      <fieldset><legend>Kind</legend><label><input type="radio" name="kind" value="list" checked> A list of values</label> <label><input type="radio" name="kind" value="text"> Free text</label></fieldset>
      <label>Values <textarea name="options" rows="6"></textarea></label><p class="hint">One value on each line, up to 20. Free text has none.</p>
      <p class="fix-line" role="alert" hidden></p><button class="primary">Add the field</button> <button type="button" data-close-dialog>Cancel</button></form></dialog>` : '<p>Only admins add or change fields.</p>'}
    ${retired.length ? `<section aria-label="Retired fields"><h2>Retired</h2><p>Their values are kept on every goal.</p><ul>${retired.map((f) => `<li>${h(f.name)} · ${h(F.kindWords(f))}${admin ? ` <form method="post" action="/act/tags.bringBackField" class="inline"><input type="hidden" name="fieldId" value="${h(f.id)}"><button aria-label="Bring back ${h(f.name)}">Bring back</button></form>` : ''}</li>`).join('')}</ul></section>` : ''}${SCRIPT}`;
  return body;
}

function goalBlock({ goal: g, app, viewer }) {
  const live = F.liveFields(app.W);
  if (!live.length) return '';
  const can = viewer && (g.ownerId === viewer.id || isAdmin(app, viewer));
  const lines = live.map((f) => {
    const v = F.valueOf(app.W, g.id, f.id);
    const edit = can ? ` <button type="button" class="link" aria-label="Change ${h(f.name)}" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden">Change</button><form method="post" action="/act/tags.setGoalFields" class="field-edit" hidden><input type="hidden" name="goalId" value="${h(g.id)}"><input type="hidden" name="fieldId" value="${h(f.id)}">${f.kind === 'list'
      ? `<label>${h(f.name)} <select name="value" aria-label="${h(f.name)}" onchange="this.form.submit()"><option value=""${v ? '' : ' selected'}>${NOT_SET}</option>${f.options.map((o) => `<option${o === v ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>`
      : `<label>${h(f.name)} <input name="value" aria-label="${h(f.name)}" maxlength="80" value="${h(v)}"></label> <button>Save</button>`}</form>` : '';
    return `<li class="fields-line"><span>${h(f.name)} · ${h(v || NOT_SET)}</span>${edit}</li>`;
  });
  return `<section data-part="Fields" aria-label="Fields"><h3>Fields</h3><ul>${lines.join('')}</ul></section>`;
}

// Goals' filters: a family of parameters by their start (f.<field id>), one per live list field
const paramOf = (f) => `f.${f.id}`;
const readParam = (params, f) => params.getAll(paramOf(f)).join(',');
function goalFilters(app, params) {
  const out = [];
  for (const f of F.liveFields(app.W)) {
    if (f.kind !== 'list' || !params.has(paramOf(f))) continue;
    const picked = pickedOf(f, readParam(params, f));
    if (!picked.length) continue;
    out.push({ key: paramOf(f), words: pickedWords(f, picked), param: pickedText(f, picked), test: (goal) => filterGoals([goal], [{ field: f, picked }], (id) => F.valueOf(app.W, id, f.id)).length === 1 });
  }
  return out;
}
function filterGroups(app, params) {
  return F.liveFields(app.W).filter((f) => f.kind === 'list').map((f) => {
    const picked = pickedOf(f, readParam(params, f));
    return { key: paramOf(f), label: f.name, options: [...f.options, NOT_SET].map((o) => ({ value: o, label: o, checked: picked.includes(o) })) };
  });
}

// ---------- AI tools ----------
const S = { type: 'string' }, B = { type: 'boolean' };
const namesOf = (app) => F.liveFields(app.W).map((f) => f.name).join(', ') || 'none yet';
const notAdmin = (r, me) => (r.error === F.ADMINS_ONLY ? `${r.error} This token acts as ${me.name}, who isn’t an admin.` : r.error);
const aiTools = [
  { name: 'list_fields', title: 'The workspace’s fields', description: 'The workspace’s own fields on goals (up to 6, such as a stage or a programme): each a list of values or free text, in order, with how many of this cycle’s goals have a value. With goal_id, that goal’s value for each. Retired fields are listed apart: their values are kept, and an admin can bring them back. No rule reads a field: they are for finding and sorting.',
    inputSchema: { type: 'object', properties: { goal_id: S } }, annotations: { readOnlyHint: true, openWorldHint: false },
    run: (app, me, a) => {
      const g = a.goal_id ? app.goal(a.goal_id) : null;
      if (a.goal_id && !g) return { error: `There’s no live goal with the ID or key ${a.goal_id} in ${app.wsName}. Use find_goals to get IDs and keys.` };
      const all = F.ordered(app.W), live = all.filter(isLive), retired = all.filter((f) => !isLive(f));
      const line = (f) => `${f.name} (${f.id}): ${F.kindWords(f)} · ${plural(F.goalsWithValue(app.W, f), 'goal has a value', 'goals have a value')}${g ? ` · ${g.key}: ${F.valueOf(app.W, g.id, f.id) || NOT_SET}` : ''}`;
      return { text: `${live.length ? live.map(line).join('\n') : 'No fields yet.'}${retired.length ? `\n\nRetired (values kept):\n${retired.map(line).join('\n')}` : ''}`,
        structured: { fields: live.map((f) => ({ id: f.id, name: f.name, kind: f.kind, values: f.options, goals: F.goalsWithValue(app.W, f), ...(g ? { value: F.valueOf(app.W, g.id, f.id) } : {}) })), retired: retired.map((f) => ({ id: f.id, name: f.name, kind: f.kind, values: f.options })) } };
    } },
  { name: 'set_goal_fields', title: 'Set a goal’s fields', description: 'Set a goal’s values for the workspace’s fields, by field name: { "Stage": "Build" }. A list field takes one of its values (any case; kept as the list writes it); free text up to 80 characters; an empty string clears it. The goal’s owner or an admin. Every value is checked before any is saved. With dry_run, nothing is saved.',
    inputSchema: { type: 'object', properties: { goal_id: S, fields: { type: 'object', additionalProperties: S }, dry_run: B }, required: ['goal_id', 'fields'] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: (app, me, a) => {
      const g = app.goal(a.goal_id);
      if (!g) return { error: `There’s no live goal with the ID or key ${a.goal_id} in ${app.wsName}. Use find_goals to get IDs and keys.` };
      const entries = Object.entries(a.fields || {});
      if (!entries.length) return { error: `Give at least one field, by name. Fields: ${namesOf(app)}.` };
      const values = {};
      for (const [k, v] of entries) {
        const f = F.mod(app.W).fields.find((x) => fold(x.name) === fold(k) || x.id === k);
        if (!f) return { error: `There’s no field called ${k}. Fields: ${namesOf(app)}.` };
        values[f.id] = v;
      }
      const r = app.run(me.id, 'tags.setGoalFields', { goalId: g.id, values, dryRun: !!a.dry_run }, 'mcp');
      if (r.error) return { error: r.error };
      const words = r.plan.map(F.changeWords);
      return { text: a.dry_run ? (words.length ? `Would change ${g.key}: ${words.join('; ')}. Nothing was saved (dry run).` : 'Nothing would change.') : (words.length ? `Saved ${g.key}: ${words.join('; ')}.` : 'Nothing changed.'), structured: { saved: !a.dry_run && words.length > 0, changes: r.plan.map((c) => ({ field: c.field.name, from: c.from, to: c.to })) } };
    } },
  { name: 'save_field', title: 'Define a field', description: 'Admins: add a field (name, kind "list" with values, or "text"), rename one or change a list’s values (field and name or values), move it up or down (move), retire it (retire: true) or bring a retired one back (bring_back: true). At most 6 live fields.',
    inputSchema: { type: 'object', properties: { field: S, name: S, kind: { type: 'string', enum: ['list', 'text'] }, values: { type: 'array', items: S }, move: { type: 'string', enum: ['up', 'down'] }, retire: B, bring_back: B } }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: (app, me, a) => {
      let r;
      if (!a.field) r = app.run(me.id, 'tags.addField', { name: a.name, kind: a.kind || (a.values ? 'list' : 'text'), options: a.values || [] }, 'mcp');
      else {
        const f = F.mod(app.W).fields.find((x) => x.id === a.field || fold(x.name) === fold(a.field));
        if (!f) return { error: `There’s no field called or with the ID ${a.field}. Fields: ${namesOf(app)}. Use list_fields.` };
        if (a.retire) r = app.run(me.id, 'tags.retireField', { fieldId: f.id }, 'mcp');
        else if (a.bring_back) r = app.run(me.id, 'tags.bringBackField', { fieldId: f.id }, 'mcp');
        else if (a.move) r = app.run(me.id, 'tags.moveField', { fieldId: f.id, by: a.move === 'up' ? -1 : 1 }, 'mcp');
        else r = app.run(me.id, 'tags.changeField', { fieldId: f.id, name: a.name, options: a.values }, 'mcp');
      }
      if (r.error) return { error: notAdmin(r, me) };
      return { text: r.message || 'Saved.', structured: r.field ? { id: r.field.id, name: r.field.name, kind: r.field.kind, values: r.field.options } : {} };
    } },
];

// find_goals' fields: { "Stage": "Build, Run" }
function findGoalsFields(app, me, fields) {
  const tests = [];
  for (const [k, text] of Object.entries(fields || {})) {
    const f = F.liveFields(app.W).find((x) => fold(x.name) === fold(k) || x.id === k);
    if (!f) return { error: `There’s no field called ${k}. Fields: ${namesOf(app)}.` };
    if (f.kind !== 'list') return { error: `${f.name} is free text, and free text isn’t a filter. Search its goals’ words with q instead.` };
    const { picked, rest } = readFilter(f, String(text ?? ''));
    if (rest.length) return { error: valueProblem(f, rest[0]).problem };
    if (!picked.length) return { error: `Give ${f.name} one of its values: ${f.options.join(', ')} or ${NOT_SET}.` };
    tests.push((goal) => filterGoals([goal], [{ field: f, picked }], (id) => F.valueOf(app.W, id, f.id)).length === 1);
  }
  return { test: (goal) => tests.every((t) => t(goal)) };
}

const act = (fn) => (app, actor, input, via) => fn(app, actor, input, via || 'app');
export default {
  id: 'tags', name: NAME, group: 'tools', needs: [],
  summary: 'Give goals a workspace’s own fields, such as a stage or a programme, to find and sort them by.',
  sections: [{ id: 'fields', name: NAME, page: (app, ctx) => fieldsPage(app, ctx) }],
  places: { 'goal.sections': goalBlock },
  goalFilters, filterGroups,
  goalColumns: (app) => exportColumns(app),
  toolArgs: { find_goals: { fields: findGoalsFields } },
  toolArgSchemas: { find_goals: { fields: { type: 'object', additionalProperties: S, description: 'Goals with these values of the workspace’s own list fields (list_fields), by name: {"Stage": "Build, Run"}; "Not set" for none. Free text can’t filter.' } } },
  help: [{ id: 'fields', after: 'features', title: 'Fields: a workspace’s own columns on goals', body: 'A workspace’s own fields on goals, such as a stage or a programme: up to 6, each a short list of values or free text, set on each goal’s page. No rule reads them: they’re for finding and sorting.\n\nAdmins add, rename, reorder, retire and bring back fields in Workspace, Fields. A goal’s owner or an admin sets its values in About this goal. Goals filters by a list field, and Data’s Goals table and every export have a column for each.' }],
  actions: {
    'tags.addField': act(F.addField), 'tags.changeField': act(F.changeField), 'tags.moveField': act(F.moveField),
    'tags.retireField': act(F.retireField), 'tags.bringBackField': act(F.bringBackField), 'tags.setGoalFields': act(F.setGoalFields),
  },
  aiTools,
};
