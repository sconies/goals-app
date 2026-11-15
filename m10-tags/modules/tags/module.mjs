// The Fields module (id tags): what it adds to the core, through the core's extension points (app/modules.mjs).
// Everything here is reached only while the workspace has it switched on; the core asks isOn first.
import { esc } from '../../app/lib.mjs';
import { tablesOf, saveRows, RECORDS, constraintOf, toRow, carry, markRemoved, restore } from './records.mjs';
import { addField, changeField, moveField, retireField, bringBackField, setGoalFields, liveFields, retiredFields, valueOf, Refused } from './fields.mjs';
import { NOT_SET, FIELD_LIMITS } from './rules.mjs';
import { pickedOf, pickedText, pickedWords, filterGoals } from './filter.mjs';
import * as sheet from './sheet.mjs';
import * as tools from './tools.mjs';

const kindWords = (f) => (f.kind === 'list' ? `A list: ${f.options.join(', ')}` : 'Free text');
const goalsWith = (W, f) => tablesOf(W).fieldValues.filter((v) => v.fieldId === f.id && !v.removedAt && v.value && W.goals.some((g) => g.id === v.goalId && !g.removedAt)).length;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

/** Applies a commit: saves the rows (all or nothing) and writes History through the core's log. */
export function apply(core, commit) {
  saveRows(core.W, commit);
  for (const h of commit.history) core.log({ what: h.what, goalId: h.goalId || null, kind: h.kind === 'value' ? 'change' : 'workspace', diffs: h.diffs || null, via: h.via || null, at: h.at, by: h.by });
}

function fieldsSection(ctx, core, url, err = null) {
  const { W } = ctx;
  const admin = !!core.me(ctx).admin;
  const live = liveFields(W), retired = retiredFields(W);
  const row = (f, i) => `<li><p><strong>${esc(f.name)}</strong><br><span class="meta">${esc(kindWords(f))} · ${plural(goalsWith(W, f), 'goal has a value', 'goals have a value')}</span></p>${admin ? `<p class="field-acts"><button class="btn" type="button" data-change="${f.id}" aria-label="Change ${esc(f.name)}">Change</button>${i > 0 ? `<form method="post" action="/workspace/fields/${f.id}/up"><button class="btn" aria-label="Move ${esc(f.name)} up">Up</button></form>` : ''}${i < live.length - 1 ? `<form method="post" action="/workspace/fields/${f.id}/down"><button class="btn" aria-label="Move ${esc(f.name)} down">Down</button></form>` : ''}<form method="post" action="/workspace/fields/${f.id}/retire"><button class="btn" aria-label="Retire ${esc(f.name)}">Retire</button></form></p>
<dialog id="chg-${f.id}" aria-label="Change ${esc(f.name)}"><form method="post" action="/workspace/fields/${f.id}/change"><h2>Change ${esc(f.name)}</h2><label for="n-${f.id}">Name</label><input type="text" id="n-${f.id}" name="name" maxlength="${FIELD_LIMITS.name}" value="${esc(f.name)}">${f.kind === 'list' ? `<label for="v-${f.id}">Values <span class="opt">one per line</span></label><textarea id="v-${f.id}" name="values">${esc(f.options.join('\n'))}</textarea>` : ''}<p><button class="btn primary" type="submit">Save the field</button> <button class="btn" type="button" onclick="this.closest('dialog').close()">Cancel</button></p></form></dialog>` : ''}</li>`;
  const add = admin ? `<dialog id="addfield" aria-label="Add a field"><form method="post" action="/workspace/fields/add" novalidate><h2>Add a field</h2><label for="fn">Name</label><input type="text" id="fn" name="name" value="${esc(err?.form?.name ?? '')}"><fieldset><legend>Kind</legend><label style="font-weight:400"><input type="radio" name="kind" value="list"${err?.form?.kind !== 'text' ? ' checked' : ''}> A list</label><label style="font-weight:400"><input type="radio" name="kind" value="text"${err?.form?.kind === 'text' ? ' checked' : ''}> Free text</label></fieldset><label for="fv">Values <span class="opt">one per line, for a list</span></label><textarea id="fv" name="values">${esc(err?.form?.values ?? '')}</textarea>${err ? `<p class="err" role="alert">${esc(err.message)}</p>` : ''}<p><button class="btn primary" type="submit">Add the field</button> <button class="btn" type="button" onclick="this.closest('dialog').close()">Cancel</button></p></form></dialog>` : '';
  const body = `<h1>Fields</h1><p class="sub">Fields your workspace keeps on every goal, such as a stage or a programme. No rule reads them: they’re for finding and sorting goals. Up to ${FIELD_LIMITS.live}.</p>
${admin ? '<p><button class="btn primary" type="button" data-dialog="addfield">Add a field</button></p>' : ''}
${live.length ? `<ul class="rows fields-list" aria-label="Fields" style="list-style:none;padding:0">${live.map(row).join('')}</ul>` : `<p>No fields yet.${admin ? '' : ' An admin can add one.'}</p>`}
${retired.length ? `<h2>Retired</h2><ul class="rows" aria-label="Retired fields" style="list-style:none;padding:0">${retired.map((f) => `<li><p><strong>${esc(f.name)}</strong><br><span class="meta">${esc(kindWords(f))} · its values are kept</span></p>${admin ? `<form method="post" action="/workspace/fields/${f.id}/bring-back"><button class="btn" aria-label="Bring back ${esc(f.name)}">Bring back</button></form>` : ''}</li>`).join('')}</ul>` : ''}
${err && (!err.form || !admin) ? `<p class="err" role="alert">${esc(err.message)}</p>` : ''}${add}
<script>document.querySelectorAll('[data-dialog]').forEach(function(b){b.addEventListener('click',function(){var d=document.getElementById(b.dataset.dialog);d.querySelector('.err')&&d.querySelector('.err').remove();d.showModal();});});
document.querySelectorAll('[data-change]').forEach(function(b){b.addEventListener('click',function(){document.getElementById('chg-'+b.dataset.change).showModal();});});
${err?.form ? "document.getElementById('addfield').showModal();" : ''}</script>`;
  return body;
}

function postSection(ctx, core, P, f) {
  // P: ['workspace','fields', id|'add', action]
  const c = core.actionCtx(ctx);
  try {
    let commit = null;
    if (P[2] === 'add') commit = addField(c, { name: f.name, kind: f.kind || 'list', options: (f.values || '').split(/\r?\n/) });
    else if (P[3] === 'change') commit = changeField(c, { fieldId: P[2], name: f.name, options: f.values !== undefined ? f.values.split(/\r?\n/) : undefined });
    else if (P[3] === 'up' || P[3] === 'down') commit = moveField(c, { fieldId: P[2], by: P[3] === 'up' ? -1 : 1 });
    else if (P[3] === 'retire') commit = retireField(c, { fieldId: P[2] });
    else if (P[3] === 'bring-back') commit = bringBackField(c, { fieldId: P[2] });
    if (commit) apply(core, commit);
    return { redirect: '/workspace/fields' };
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    return { status: 400, body: fieldsSection(ctx, core, null, { message: e.message, form: P[2] === 'add' ? f : null }) };
  }
}

function goalBlock(ctx, core, g) {
  const live = liveFields(ctx.W);
  if (!live.length) return '';
  const me = core.me(ctx);
  const may = me.admin || g.ownerId === me.id;
  const line = (f) => {
    const v = valueOf(ctx.W, g.id, f.id);
    const edit = !may ? '' : f.kind === 'list'
      ? `<form method="post" action="/goals/${g.id}/fields" class="field-edit" hidden><input type="hidden" name="field" value="${f.id}"><select id="fe-${f.id}" name="value" aria-label="${esc(f.name)}" onchange="this.form.submit()"><option value="">${NOT_SET}</option>${f.options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></form>`
      : `<form method="post" action="/goals/${g.id}/fields" class="field-edit" hidden><input type="hidden" name="field" value="${f.id}"><label for="fe-${f.id}">${esc(f.name)}</label><input type="text" id="fe-${f.id}" name="value" maxlength="${FIELD_LIMITS.text}" value="${esc(v)}"><button class="btn" type="submit">Save</button></form>`;
    return `<div class="field-line"><span>${esc(f.name)} · ${esc(v || NOT_SET)}</span> ${may ? `<button class="btn link" type="button" aria-label="Change ${esc(f.name)}" onclick="var e=this.parentNode.querySelector('.field-edit');e.hidden=false;e.querySelector('select,input[type=text]').focus();this.hidden=true">Change</button>` : ''}${edit}</div>`;
  };
  return `<div data-part="Fields" class="fields-block" aria-label="Fields">${live.map(line).join('')}</div>`;
}

function postGoal(ctx, core, g, f) {
  try {
    const commit = setGoalFields(core.actionCtx(ctx), { goalId: g.id, values: { [f.field]: f.value ?? '' } });
    if (commit) apply(core, commit);
    return { redirect: `/goals/${g.id}#about` };
  } catch (e) { if (!(e instanceof Refused)) throw e; return { status: 400, error: e.message }; }
}

// Goals' filter family: f.<field id>
const family = {
  prefix: 'f.',
  rows(ctx, params) {
    return liveFields(ctx.W).filter((f) => f.kind === 'list').map((f) => {
      const picked = pickedOf(f, params.get(`f.${f.id}`) || '');
      return `<fieldset role="group" aria-label="${esc(f.name)}" data-join="f.${f.id}"><legend>${esc(f.name)}</legend>${[...f.options, NOT_SET].map((o) => `<label style="display:inline-flex;gap:4px;font-weight:400;margin-right:10px"><input type="checkbox" data-of="f.${f.id}" value="${esc(o)}"${picked.includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</fieldset>`;
    }).join('');
  },
  apply(ctx, params, goals) {
    const filters = [], line = [];
    for (const f of liveFields(ctx.W).filter((x) => x.kind === 'list')) {
      const picked = pickedOf(f, params.get(`f.${f.id}`) || '');
      if (!picked.length) continue;
      filters.push({ field: f, picked });
      line.push([`f.${f.id}`, pickedWords(f, picked), '']);
    }
    return { goals: filters.length ? filterGoals(goals, tablesOf(ctx.W).fieldValues, filters) : goals, line };
  },
  keys: (ctx) => liveFields(ctx.W).filter((f) => f.kind === 'list').map((f) => `f.${f.id}`),
};

export default {
  id: 'tags',
  name: 'Fields',
  summary: 'Give goals a workspace’s own fields, such as a stage or a programme, to find and sort them by.',
  records: RECORDS.map((r) => ({ ...r, module: 'tags', constraintOf: (row) => constraintOf(r.key, row), toRow: (row) => toRow(r.key, row) })),
  cycle: { carry, markRemoved, restore },
  workspaceSections: [{ id: 'fields', label: 'Fields', render: fieldsSection, post: postSection }],
  goalSections: [{ place: 'goal.sections', render: goalBlock, post: postGoal, path: 'fields' }],
  goalFilters: family,
  goalColumns: (W) => liveFields(W).map((f) => ({ header: f.name, cell: (g) => valueOf(W, g.id, f.id) })),
  sheet: {
    owns: (W, header) => liveFields(W).some((f) => f.name.trim().toLowerCase() === String(header).trim().toLowerCase()),
    read: (args) => sheet.readFieldColumns(args),
    save(ctx, core, result) {
      const c = { ...core.actionCtx(ctx), via: 'Spreadsheet' };
      for (const a of result.adds) {
        const f = tablesOf(ctx.W).fields.find((x) => x.id === a.fieldId);
        if (f.options.some((o) => o.toLowerCase() === a.value.toLowerCase())) continue;
        const cm = changeField(c, { fieldId: f.id, options: [...f.options, a.value] });
        if (cm) apply(core, cm);
      }
      const byGoal = new Map();
      for (const ch of result.changes) { if (!byGoal.has(ch.goal.id)) byGoal.set(ch.goal.id, {}); byGoal.get(ch.goal.id)[ch.field.id] = ch.to; }
      for (const [goalId, values] of byGoal) { const cm = setGoalFields(c, { goalId, values }); if (cm) apply(core, cm); }
    },
    readme: sheet.readme,
  },
  tools: {
    defs: tools.TOOLS,
    call(name, ctx, args) { return tools[name](ctx, args); },
    findGoalsArg: { name: 'fields', apply: (W, arg, goals) => filterGoals(goals, tablesOf(W).fieldValues, tools.fieldsFilter(W, arg)) },
  },
  help: [{ id: 'fields', title: 'Fields: a workspace’s own columns on goals' }],
  Refused,
  apply,
};
