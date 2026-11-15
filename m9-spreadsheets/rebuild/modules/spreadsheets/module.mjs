// The Spreadsheets module (spec/modules/spreadsheets, stage 9): Export, Import with its preview, Imported, Past imports
// and Undo, the template, Help's table of every column, and the AI tools export and export_table.
// It registers into the core's places (data.tools, goals.tools, help.article), routes and AI tools; the core never names it.
import { FORMAT } from './fields.mjs';
import * as X from './exporter.mjs';
import * as I from './importer.mjs';
import { writeWorkbook, writeCsv, zip } from './book.mjs';
import { startCheck, progressOf, stopCheck } from './large.mjs';
import { goalsQuery } from '../../app/pages.mjs';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const PAGE = 50; // rows drawn at a time
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const download = (name, type, body) => ({ raw: body, headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` } });

// the import in progress, per person: the file as read, the answers, the rows left out
const sessions = new Map();
export const resetSessions = () => sessions.clear();

// the answers each question offers: [label, code]
function choices(iss) {
  const m = iss.message;
  const after = (re) => (re.exec(m) || [])[1];
  switch (iss.kind) {
    case 'near-ref': { const x = after(/Did you mean (.+?)\?/); return [[`Use ${x}`, 'use'], ['Leave these rows out', 'leave']]; }
    case 'near-word': { const x = after(/(?:Read it as|Did you mean) (.+?)\?/); return [[`Read it as ${x}`, 'use'], ['Leave these rows out', 'leave']]; }
    case 'near-header': { const x = after(/Read it as (.+?)\?/); return [[`Read it as ${x}`, 'use'], ['Don’t read it', 'no']]; }
    case 'same-person': return [['The same person', 'same'], ['Someone new', 'new']];
    case 'same-goal': return [['They’re new goals', 'new'], ['They’re the same', 'same'], ['Leave them out', 'leave']];
    case 'other-goal': return [['Yes, change it', 'yes'], ['No, add it as a new goal', 'new'], ['Leave it out', 'leave']];
    case 'past-stage': return [['They’re done', 'done'], ['They’re not done', 'no'], ['Count them from this week', 'from-now']];
    case 'past-plan': return [['They’re finished goals: add them', 'add'], ['Leave them out', 'leave']];
    case 'totals-row': return [['Leave it out', 'leave'], ['It’s a goal', 'goal']];
    case 'for-someone-else': return [['Yes, active', 'active'], ['No, start them as proposed', 'proposed']];
    case 'two-columns': { const cs = [...m.matchAll(/“([^”]+)”/g)].map((x) => x[1]); return cs.map((c) => [`Read “${c}”`, JSON.stringify({ value: c })]); }
    case 'odd-number': return [['They’re right', 'keep'], ['Leave these rows out', 'leave']];
    case 'replaces-others': return [['Replace them', 'keep'], ['Leave these rows out', 'leave']];
    case 'feeds-lower': return [['Yes, it feeds that goal', 'keep'], ['Leave these rows out', 'leave']];
    default: return [['That’s right', 'keep'], ['Leave these rows out', 'leave']];
  }
}
const questionTitle = (m) => { const parts = m.split(/(?<=[.?!])\s+/); const q = [...parts].reverse().find((p) => p.endsWith('?')); return q || m; };
const decode = (v) => { if (typeof v === 'string' && v.startsWith('{')) { try { return JSON.parse(v); } catch { return v; } } return v; };

// ---------- running a check ----------
function run(app, s, viewer, { apply = false } = {}) {
  const { tables, gone } = I.leaveOut(s.rec.tables, s.leave);
  const answers = Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, decode(v)]));
  const res = I.check(app, viewer.id, tables, answers, { apply, reason: s.reason || '' });
  return { res, gone, tables };
}
function countsLine(c) {
  const bits = [];
  if (c.newPeople) bits.push(plural(c.newPeople, 'new person', 'new people'));
  if (c.people) bits.push(`${plural(c.people, 'person', 'people')} changed`);
  if (c.teams) bits.push(`${plural(c.teams, 'team', 'teams')} changed`);
  if (c.newGoals) bits.push(plural(c.newGoals, 'new goal', 'new goals'));
  if (c.goals) bits.push(`${plural(c.goals, 'goal', 'goals')} changed`);
  if (c.plans) bits.push(`${plural(c.plans, 'plan', 'plans')} changed`);
  if (c.checkIns) bits.push(`${plural(c.checkIns, 'check-in', 'check-ins')}${c.backfilled ? ` (${c.backfilled} for past weeks)` : ''}`);
  if (c.replaced) bits.push(`${c.replaced} replaced`);
  if (c.stopped) bits.push(`${plural(c.stopped, 'goal', 'goals')} stopped`);
  if (c.deleted) bits.push(`${plural(c.deleted, 'goal', 'goals')} deleted`);
  if (c.left) bits.push(`${plural(c.left, 'person', 'people')} marked as left`);
  return bits.join(', ');
}
// the groups of a run: Must fix kinds and the questions, each with its rows
function groupsOf(res, s) {
  const must = new Map(), checks = new Map();
  for (const i of res.issues) {
    if (i.level === 'note') continue;
    const into = i.level === 'must' ? must : checks;
    const sub = i.kind === 'not-allowed' ? notAllowedOf(i.message) : '';
    const key = i.level === 'must' ? i.kind + ':' + (sub === 'other' ? i.group : sub) : i.group;
    if (!into.has(key)) into.set(key, { ...i, sub, rows: [] });
    into.get(key).rows.push(i);
  }
  return { must: [...must.values()], checks: [...checks.values()] };
}
// a group's line: "1 row changes a goal you don't own"
const notAllowedOf = (m) => (/an admin can change people|add or change people/i.test(m) ? 'people' : /\(its owner\) or an admin/.test(m) ? 'not-yours' : 'other');
const mustLine = (g) => {
  const n = g.rows.length;
  if (g.kind === 'not-allowed' && g.sub === 'people') return `${plural(n, 'row changes', 'rows change')} people. Only an admin can add or change people.`;
  if (g.kind === 'not-allowed' && g.sub === 'not-yours') return `${plural(n, 'row changes a goal', 'rows change goals')} you don’t own. Only a goal’s owner or an admin can change it.`;
  if (g.kind === 'not-allowed') return g.message.replace(/^Row \d+:?\s*/, '');
  return g.rows.length === 1 ? g.message : `${g.message} (and ${plural(g.rows.length - 1, 'more row', 'more rows')})`;
};

// ---------- pages ----------
const shut = `<a class="close" href="/data/import" data-close>Close without saving</a>`;
const fileForm = (label, keep = false) => `<form method="post" action="/data/import" enctype="multipart/form-data" class="import-file-form">${keep ? '<input type="hidden" name="keep" value="1">' : ''}
  <label class="file-pick">${h(label)} <input type="file" name="file" accept=".xlsx,.csv,.tsv,.txt,.zip" onchange="this.form.submit()"></label></form>`;

function importPage(app, viewer, msg = '') {
  const past = I.pastImports(app);
  const need = (sheet) => FORMAT[sheet].needs.replace(/^A new row needs /, '');
  const body = `<h1>Import</h1>
  <p>Add or change goals, plans, check-ins and people from a spreadsheet.</p>
  ${msg}
  <p class="limits">Up to 30,000 rows a file, and 5,000 changes at a time. Every change is shown before anything is saved.</p>
  ${fileForm('Choose a spreadsheet')}
  <button type="button" class="paste-open" onclick="this.hidden=true;document.getElementById('paste').hidden=false;document.getElementById('paste-rows').focus()">or paste rows from a spreadsheet</button>
  <form id="paste" method="post" action="/data/import" hidden><label for="paste-rows">Paste rows from a spreadsheet</label><textarea id="paste-rows" name="paste" rows="6"></textarea><button class="primary">Check these rows</button></form>
  <section aria-labelledby="needs"><h2 id="needs">What a new row must have</h2>
    <ul><li>A goal: ${h(need('Goals'))}</li><li>A check-in: ${h(need('Check-ins'))}</li><li>A person: ${h(need('People'))}</li></ul>
    <p><a href="/help/columns">Every column, with its format and an example</a></p>
    <form method="get" action="/data/import"><input type="hidden" name="download" value="template"><button>Download the template</button></form></section>
  <p><a href="/data/imports">All ${past.length} past imports</a></p>`;
  return { body, title: 'Import', backParent: { to: '/data', label: 'Data' } };
}

function previewPage(app, viewer, s, url, only = false) {
  const W = app.W;
  if (s.progress) { const lp = largePage(app, viewer, s); if (lp) return lp; }
  if (s.noSheet) return { body: `<h1>Check this import</h1><div role="alert"><p>${h(s.file)} has no sheet Faro reads. Its first sheet’s headers are ${h(s.noSheet.slice(0, 5).join(', '))}${s.noSheet.length ? '…' : ''}</p><form method="get" action="/data/import"><input type="hidden" name="download" value="template"><button>Download the template</button></form></div>${fileForm('Choose another file')}${shut}`, title: 'Check this import', focus: true };
  if (s.rec.origin && s.rec.origin.workspace !== X.fileOf(app)[1] && !s.asNew) {
    return { body: `<h1>Check this import</h1><section aria-labelledby="other"><h2 id="other">Another workspace’s file</h2><p>This file was exported from “${h(s.rec.origin.name)}”. Its keys and IDs belong there, so its rows can’t change goals here.</p>
      <form method="post" action="/data/import/check"><input type="hidden" name="op" value="as-new"><button class="primary">Add its rows as new goals</button></form>${fileForm('Choose another file')}</section>${shut}`, title: 'Check this import', focus: true };
  }
  const { res, gone } = run(app, s, viewer);
  s.last = res;
  const { must, checks: open0 } = groupsOf(res, s);
  const checks = [...open0, ...Object.entries(s.asked).filter(([g]) => s.answers[g] !== undefined && !open0.some((c) => c.group === g)).map(([, q]) => q)];
  const wo = I.workedOutEdits(app, s.rec);
  const fl = I.fileLine(app, s.rec, res.examples);
  const mustRows = new Set(res.issues.filter((i) => i.level === 'must').map((i) => `${i.sheet}:${i.row}`));
  const chosen = [...s.leave];
  const open = checks.filter((c) => s.answers[c.group] === undefined);
  const n = res.items.length;
  const parts = [];
  parts.push(`<h1>Check this import</h1>`);
  parts.push(`<p class="import-file">${h(s.file)}: ${h(fl)}</p>`);
  for (const x of s.rec.headerNotes) parts.push(`<p>${h(x)}</p>`);
  for (const w of wo) parts.push(`<p>On ${plural(w.n, 'row', 'rows')}, ${h(w.col)} differs from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.</p>`);
  if (s.keptAnswers) parts.push(`<p role="status">Your ${plural(s.keptAnswers, 'answer', 'answers')} still ${s.keptAnswers === 1 ? 'applies' : 'apply'}.</p>`);
  // counts by sheet
  const counts = countsLine(res.counts);
  parts.push(`<p class="import-counts" role="status">${!n && !must.length && !checks.length ? 'Nothing would change.' : h(counts || 'No changes yet')}${res.unchanged ? ` ${plural(res.unchanged, 'row is', 'rows are')} unchanged.` : ''}</p>`);
  if (chosen.length || gone.length) parts.push(`<p>${plural(chosen.length + gone.length, 'row was', 'rows are')} left out${chosen.length ? ' at your choice' : ''}.${gone.length ? ` ${gone.map((g) => `${g.sheet} row ${g.line} goes with it: ${g.why}.`).join(' ')}` : ''}</p>`);
  if (chosen.length >= 2) parts.push(`<p>${plural(chosen.length, 'row is', 'rows are')} left out.</p>`);
  for (const [k, g] of Object.entries(s.leftGroups)) parts.push(`<form method="post" action="/data/import/check" class="import-answered"><p>${h(g.label)}: Left out</p><input type="hidden" name="op" value="unleave"><input type="hidden" name="key" value="${h(k)}"><button>Change</button></form>`);
  // Must fix
  if (must.length) {
    const rows = new Set(must.flatMap((g) => g.rows.map((r) => `${r.sheet}:${r.row}`)));
    const kinds = new Set(must.map((g) => g.kind)).size;
    const leaveNames = [...rows].map((k) => { const [sh, ln] = k.split(':'); const r = (s.rec.tables[sh] || []).find((x) => x.__line === +ln); return `${I.NAME[sh]} row ${ln}${r ? `: ${r.Goal || r['Goal name'] || r.Name || r.Email || r['Goal key'] || ''}` : ''}`; });
    parts.push(`<section aria-labelledby="must"><h2 id="must">Must fix</h2><p>${plural(rows.size, 'row', 'rows')}, ${plural(kinds, 'kind of problem', 'kinds of problem')}</p>
      ${must.map((g) => `<div class="import-group" data-kind="${h(g.kind)}"><p><span class="shape-must" aria-hidden="true">■</span> ${h(mustLine(g))}</p><p class="rows">${h(I.NAME[g.sheet])} ${g.rows.length === 1 ? 'row' : 'rows'} ${g.rows.slice(0, PAGE).map((r) => r.row).join(', ')}</p>${g.kind === 'not-allowed' ? `<form method="post" action="/data/import/check"><input type="hidden" name="op" value="leave"><input type="hidden" name="label" value="${h(mustLine(g))}"><input type="hidden" name="rows" value="${h(g.rows.map((r) => `${r.sheet}:${r.row}`).join(','))}"><button>Leave these rows out</button></form>` : ''}</div>`).join('')}
      <form method="get" action="/data/import/check"><input type="hidden" name="download" value="fix"><button>Download the ${plural(rows.size, 'row', 'rows')} to fix</button></form>
      <button type="button" onclick="document.querySelector('#refile input').click()">Choose the corrected file</button><div id="refile" hidden>${fileForm('Choose a spreadsheet', true)}</div>
      <button type="button" onclick="document.getElementById('leave-dlg').showModal()">${rows.size === 1 ? 'Leave this row out and save the rest' : 'Leave these rows out and save the rest'}</button>
      <dialog id="leave-dlg" aria-labelledby="leave-h"><h2 id="leave-h">Leave ${rows.size === 1 ? 'this row' : 'these rows'} out?</h2><ul>${leaveNames.slice(0, PAGE).map((x) => `<li>${h(x)}</li>`).join('')}</ul><p>The rest saves; nothing from ${rows.size === 1 ? 'it' : 'them'} is saved, nor the rows that depend on ${rows.size === 1 ? 'it' : 'them'}.</p>
        <form method="post" action="/data/import/check"><input type="hidden" name="op" value="leave"><input type="hidden" name="rows" value="${h([...rows].join(','))}"><button class="primary">Leave them out</button></form><button type="button" onclick="this.closest('dialog').close()">Keep them</button></dialog></section>`);
  }
  // questions
  if (checks.length) {
    const qrows = new Set(checks.flatMap((g) => g.rows.map((r) => `${r.sheet}:${r.row}`)));
    parts.push(`<section aria-labelledby="questions"><h2 id="questions">Questions</h2><p>${plural(checks.length, 'question covers', 'questions cover')} ${plural(qrows.size, 'row', 'rows')}</p>
      ${checks.map((g) => {
        const a = s.answers[g.group];
        const ch = choices(g);
        if (a !== undefined) { const label = (ch.find((c) => c[1] === a) || [a])[0]; return `<form method="post" action="/data/import/check" class="import-answered"><p>${h(questionTitle(g.message))}: ${h(label)}</p><input type="hidden" name="op" value="unanswer"><input type="hidden" name="group" value="${h(g.group)}"><button>Change</button></form>`; }
        return `<form method="post" action="/data/import/check" class="import-question"><p>${h(g.message)} <small>${plural(g.rows.length, 'row', 'rows')}</small></p><input type="hidden" name="op" value="answer"><input type="hidden" name="group" value="${h(g.group)}">${ch.map(([l, c]) => `<button name="answer" value="${h(c)}">${h(l)}</button>`).join(' ')}</form>`;
      }).join('')}</section>`);
  }
  // one reason for every plan change once check-ins have started
  if (res.needsReason && !s.reason) parts.push(`<section aria-labelledby="why"><h2 id="why">Why the plans change</h2><p>${plural(res.items.filter((i) => i.needsReason).length, 'plan changes', 'plans change')} after check-ins began. Say why once; it is kept with each change.</p><form method="post" action="/data/import/check"><input type="hidden" name="op" value="reason"><label for="reason">Reason</label><input id="reason" name="reason" required minlength="3"><button>Use this reason</button></form></section>`);
  if (s.reason) parts.push(`<form method="post" action="/data/import/check" class="import-answered"><p>Why the plans change: ${h(s.reason)}</p><input type="hidden" name="op" value="reason"><input type="hidden" name="reason" value=""><button>Change</button></form>`);
  // what will be saved
  if (!must.length && !open.length && n && !(res.needsReason && !s.reason)) {
    parts.push(`<section aria-labelledby="saved"><h2 id="saved">What will be saved</h2><p>${h(counts)}</p>${only ? '' : `<p><a href="/data/import/check/changes">Show the ${plural(n, 'change', 'changes')}</a></p>`}
      ${n > I.LIMITS.changes ? splitOffer(n) : `<form method="post" action="/data/import/check"><input type="hidden" name="op" value="save"><button class="primary"${url.searchParams.get('left') ? ' autofocus' : ''}>Save ${plural(n, 'change', 'changes')}</button></form>`}</section>`);
  }
  if (only) {
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const shown = res.items.slice(0, page * PAGE);
    const defaults = res.issues.filter((i) => i.kind === 'default');
    parts.push(`<section aria-labelledby="changes"><h2 id="changes">Every change</h2><ol class="import-changes">${shown.map((it) => `<li class="import-change"><p><strong>${h(it.name)}</strong> · ${h(it.kind)} · ${h(it.sheet)} row ${it.line}</p><ul>${it.diffs.filter(([f]) => f !== 'Via').map(([f, a, b]) => `<li>${h(f)}: ${h(a)} → ${h(b)}</li>`).join('')}${defaults.filter((d) => d.row === it.line && d.sheet === I.KEY[it.sheet]).map((d) => `<li>${h(d.message)}</li>`).join('')}</ul></li>`).join('')}</ol>
      ${shown.length < n ? `<p><a href="/data/import/check/changes?page=${page + 1}">Show ${Math.min(PAGE, n - shown.length)} more of ${n}</a></p>` : ''}</section>`);
  }
  parts.push(`<a class="close" href="${only ? '/data/import/check' : '/data/import'}" data-close>${only ? 'Back to the check' : 'Close without saving'}</a>`);
  return { body: parts.join('\n'), title: only ? 'Every change' : 'Check this import', focus: true };
}
const splitOffer = (n) => { const k = Math.ceil(n / I.LIMITS.changes); return `<p role="alert">This file would change ${n.toLocaleString('en-GB')} rows. Up to 5,000 save at a time, so it is checked, not saved: download it as ${k} files of up to 5,000 rows, each goal with its plan and check-ins, and load them one after the other.</p><form method="get" action="/data/import/check"><input type="hidden" name="download" value="parts"><button class="primary">Download as ${k} files</button></form>`; };

function largePage(app, viewer, s) {
  const p = progressOf(s.progress);
  if (p.done && !p.error) { s.rec.tables = s.rec.tables; s.progress = null; s.checkedLarge = p.result; return null; }
  return { body: `<h1>Reading ${h(s.file)}</h1><p role="status" aria-live="polite" class="import-progress" data-progress="${p.read}">Checked ${p.read.toLocaleString('en-GB')} of ${p.total.toLocaleString('en-GB')} rows. Found so far: ${plural(p.must, 'row to fix', 'rows to fix')}, ${plural(p.questions, 'question', 'questions')}.</p>
    <progress max="${p.total}" value="${p.read}">${p.read}</progress>
    <form method="post" action="/data/import/check"><input type="hidden" name="op" value="stop"><button>Stop</button></form>
    <script>setTimeout(() => location.reload(), 400)</script>`, title: `Reading ${s.file}`, focus: true };
}

function donePage(app, viewer, importId, msg = '') {
  const imp = I.pastImports(app).find((x) => x.entityId === importId);
  if (!imp) return { status: 404, body: '<h1>Import not found</h1><p>No import is at this address.</p><a href="/data/imports">Past imports</a>' };
  const rows = imp.diffs.find((d) => d.field === 'Rows')?.to || '';
  const saved = Number(/^(\d+) changed/.exec(rows)?.[1] || 0);
  const left = Number(/(\d+) left out/.exec(rows)?.[1] || 0);
  const s = sessions.get(viewer.id);
  return { body: `<h1>Imported</h1>${msg}<p role="status">Saved ${plural(saved, 'row', 'rows')} from ${h(imp.file || 'pasted rows')}.</p><p>${h(imp.summary.replace(/^Loaded a spreadsheet: /, ''))}.</p>
    ${left ? `<p>${plural(left, 'row was', 'rows were')} left out.</p>${s?.leftBook ? `<form method="get" action="/data/import/done/${h(importId)}"><input type="hidden" name="download" value="left"><button>Download them</button></form>` : ''}` : ''}
    ${undoBlock(app, viewer, imp)}<p><a href="/data/imports">Past imports</a> · <a href="/goals">Goals</a></p>`, title: 'Imported', backParent: { to: '/data', label: 'Data' } };
}
function undoBlock(app, viewer, imp, { list = false } = {}) {
  if (imp.undone) return `<p>Undone on ${day(imp.undone.at)} by ${h(app.person(imp.undone.actorId)?.name || '')}.</p>`;
  const me = app.person(viewer.id);
  if (imp.actorId !== viewer.id && !me?.admin) return '';
  const pv = I.undoPreview(app, imp.entityId);
  const total = pv.restores.length + pv.skipped.length;
  if (!pv.restores.length) return `<p>Nothing left to undo.</p>`;
  const id = `undo-${h(imp.entityId)}`;
  const since = pv.skipped.length ? `<p>${plural(pv.skipped.length, 'of its', 'of its')} ${total} rows ${pv.skipped.length === 1 ? 'has' : 'have'} changed since, so Undo would put back ${pv.restores.length}.</p>` : '';
  return `${since}<button type="button" onclick="document.getElementById('${id}').showModal()">${list || pv.skipped.length ? `Undo ${plural(pv.restores.length, 'row', 'rows')}` : 'Undo this import'}</button>
    <dialog id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">Undo this import?</h2><p>${plural(pv.restores.length, 'row goes', 'rows go')} back to how ${pv.restores.length === 1 ? 'it was' : 'they were'} on ${day(imp.at)}, before the import.</p>
      ${pv.skipped.length ? `<h3 id="${id}-stay">Rows that stay as they are</h3><ul aria-labelledby="${id}-stay">${pv.skipped.map((r) => `<li>${h(r.title)}: ${h(r.why)}</li>`).join('')}</ul>` : ''}
      <form method="post" action="/data/imports"><input type="hidden" name="op" value="undo"><input type="hidden" name="id" value="${h(imp.entityId)}"><button class="primary">Undo ${plural(pv.restores.length, 'row', 'rows')}</button></form><button type="button" onclick="this.closest('dialog').close()">Keep it</button></dialog>`;
}
function pastPage(app, viewer, url, msg = '') {
  const list = I.pastImports(app);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const shown = list.filter((x) => !q || `${x.file} ${x.summary}`.toLowerCase().includes(q));
  return { body: `<h1>Past imports</h1>${msg}<p class="count-line">${plural(shown.length, 'import', 'imports')}, latest first.</p>
    <ol class="past-imports">${shown.slice(0, PAGE).map((x) => `<li><p><strong>${h(x.file || (x.diffs.find((d) => d.field === 'Via')?.to === 'MCP' ? 'Through the AI assistant' : 'A bulk edit'))}</strong> · ${h(app.person(x.actorId)?.name || '')} · ${day(x.at)} · ${h(x.diffs.find((d) => d.field === 'Via')?.to || '')}</p><p>${h(x.summary.replace(/^Loaded a spreadsheet: /, ''))}</p>${undoBlock(app, viewer, x, { list: true })}</li>`).join('')}</ol>`, title: 'Past imports', backParent: { to: '/data', label: 'Data' } };
}

// ---------- multipart ----------
function parseBody(req) {
  const ct = req.headers['content-type'] || '';
  const out = {};
  if (ct.startsWith('multipart/form-data')) {
    const b = '--' + /boundary=([^;]+)/.exec(ct)[1].replace(/^"|"$/g, '');
    const buf = req.body;
    let i = buf.indexOf(b);
    while (i >= 0) {
      const next = buf.indexOf(b, i + b.length);
      if (next < 0) break;
      const part = buf.slice(i + b.length + 2, next - 2);
      const he = part.indexOf('\r\n\r\n');
      const head = part.slice(0, he).toString('utf8');
      const name = /name="([^"]*)"/.exec(head)?.[1];
      const fn = /filename="([^"]*)"/.exec(head)?.[1];
      const data = part.slice(he + 4);
      if (name) out[name] = fn !== undefined ? { filename: fn, data } : data.toString('utf8');
      i = next;
    }
  } else for (const [k, v] of new URLSearchParams(req.body.toString('utf8'))) out[k] = v;
  return out;
}

// ---------- start an import from a file or pasted rows ----------
function begin(app, viewer, name, buf, keep) {
  const prev = sessions.get(viewer.id);
  const f = I.readFile(name, buf);
  if (f.error) return { error: f.error };
  const rec = I.recognise(app, name, f);
  const s = { file: name, raw: f, rec, answers: keep && prev ? { ...prev.answers } : {}, asked: keep && prev ? { ...prev.asked } : {}, leave: new Set(), leftGroups: {}, asNew: false };
  if (rec.rowCount > I.LIMITS.rows) return { error: `${name} has ${rec.rowCount.toLocaleString('en-GB')} rows. A file can have up to 30,000: split it into parts.` };
  if (!rec.read.filter((x) => x !== 'Metrics').length) s.noSheet = rec.firstHeaders || [];
  if (keep && prev) s.keptAnswers = Object.keys(prev.answers).length || 0;
  sessions.set(viewer.id, s);
  if (!s.noSheet && rec.rowCount > 500) s.progress = startCheck(app, viewer.id, rec.tables, s.answers);
  return { ok: true };
}

// ---------- the routes ----------
function importRoute(app, viewer, req) {
  const url = req.url;
  if (req.method === 'GET') {
    const dl = url.searchParams.get('download');
    if (dl === 'template') return download('faro-template.xlsx', XLSX, X.template(app));
    const ex = url.searchParams.get('export');
    if (ex) return exportFile(app, viewer, url);
    return importPage(app, viewer);
  }
  const f = parseBody(req);
  if (f.paste !== undefined) {
    const r = begin(app, viewer, 'Pasted rows', Buffer.from(String(f.paste)), false);
    if (r.error) return importPage(app, viewer, `<p role="alert">${h(r.error)}</p>`);
    return { redirect: '/data/import/check' };
  }
  if (f.file && f.file.filename) {
    const r = begin(app, viewer, f.file.filename, f.file.data, f.keep === '1');
    if (r.error) return importPage(app, viewer, `<p role="alert">${h(r.error)}</p>`);
    return { redirect: '/data/import/check' };
  }
  return importPage(app, viewer, '<p role="alert">Choose a file first.</p>');
}
function checkRoute(app, viewer, req, only = false) {
  const s = sessions.get(viewer.id);
  if (!s) return { redirect: '/data/import' };
  const url = req.url;
  if (req.method === 'GET') {
    const dl = url.searchParams.get('download');
    if (dl === 'fix') { const { res } = run(app, s, viewer); return download(`${s.file.replace(/\.(xlsx|csv|tsv|txt|zip)$/i, '')}-rows-to-fix.xlsx`, XLSX, writeWorkbook(I.rowsToFix(s.rec, res))); }
    if (dl === 'parts') { const parts = I.split(I.leaveOut(s.rec.tables, s.leave).tables.goals ? { ...s.rec, tables: I.leaveOut(s.rec.tables, s.leave).tables } : s.rec); const base = s.file.replace(/\.(xlsx|csv|tsv|txt|zip)$/i, ''); return download(`${base}-in-${parts.length}-parts.zip`, 'application/zip', zip(parts.map((b, i) => ({ name: `${base}-part-${i + 1}-of-${parts.length}.xlsx`, data: b })))); }
    if (s.progress) { const p = largePage(app, viewer, s); if (p) return p; }
    return previewPage(app, viewer, s, url, only);
  }
  const f = parseBody(req);
  if (f.op === 'stop') { stopCheck(s.progress); sessions.delete(viewer.id); return { body: '<h1>Import</h1><p role="status">Stopped. Nothing was saved.</p><a href="/data/import">Choose a file</a>', title: 'Import', backParent: { to: '/data', label: 'Data' } }; }
  if (f.op === 'as-new') { s.asNew = true; s.rec = I.recognise(app, s.file, s.raw, { asNew: true }); return { redirect: '/data/import/check' }; }
  if (f.op === 'answer') { const q = (s.last?.issues || []).filter((i) => i.group === f.group); if (q.length) s.asked[f.group] = { ...q[0], rows: q }; s.answers[f.group] = f.answer; return { redirect: only ? '/data/import/check/changes' : '/data/import/check' }; }
  if (f.op === 'unanswer') { delete s.answers[f.group]; return { redirect: '/data/import/check' }; }
  if (f.op === 'reason') { s.reason = String(f.reason || '').trim(); return { redirect: '/data/import/check' }; }
  if (f.op === 'unleave') { const g = s.leftGroups[f.key]; if (g) { for (const k of g.rows) s.leave.delete(k); delete s.leftGroups[f.key]; } return { redirect: '/data/import/check' }; }
  if (f.op === 'leave') { const rows = String(f.rows || '').split(',').filter(Boolean); for (const k of rows) s.leave.add(k); if (f.label) s.leftGroups[rows.join(',')] = { label: f.label, rows }; return { redirect: '/data/import/check?left=1' }; }
  if (f.op === 'save') {
    const { res, gone } = run(app, s, viewer, { apply: true });
    if (!res.saves) return previewPage(app, viewer, s, url, only);
    if (res.items.length > I.LIMITS.changes) return previewPage(app, viewer, s, url, only);
    const leftKeys = new Set([...s.leave, ...gone.map((g) => `${I.KEY[g.sheet]}:${g.line}`)]);
    const id = I.commit(app, viewer.id, res, { file: s.file, leftOut: leftKeys.size });
    sessions.set(viewer.id, { done: id, leftBook: leftKeys.size ? I.rowsAsBook(s.rec, leftKeys) : null, file: s.file });
    return { redirect: `/data/import/done/${id}` };
  }
  return previewPage(app, viewer, s, url, only);
}
function doneRoute(app, viewer, req) {
  const id = req.params.importId;
  if (req.method === 'GET' && req.url.searchParams.get('download') === 'left') {
    const s = sessions.get(viewer.id);
    if (s?.leftBook) return download(`${s.file.replace(/\.(xlsx|csv|tsv|txt|zip)$/i, '')}-left-out.xlsx`, XLSX, s.leftBook);
  }
  if (req.method === 'POST') return undoPost(app, viewer, req, (m) => donePage(app, viewer, id, m));
  return donePage(app, viewer, id);
}
function undoPost(app, viewer, req, page) {
  const f = parseBody(req);
  if (f.op !== 'undo') return page('');
  const r = I.undoImport(app, viewer.id, f.id);
  return page(r.error ? `<p role="alert">${h(r.error)}</p>` : `<p role="status">${h(r.message)}</p>`);
}

// ---------- export ----------
function viewOf(app, viewer, url) {
  const view = url.searchParams.get('view');
  if (view === null) return { ids: null, scope: 'all', count: app.W.goals.filter((g) => !g.removedAt).length };
  const gu = new URL(`/goals${view}`, 'http://x');
  const Q = goalsQuery(app, { viewer }, gu);
  const narrowed = !!Q.q || Q.filters.length > 0;
  const scope = narrowed ? 'as-shown' : Q.scope === 'all' ? 'all' : Q.scope === 'mine' ? 'mine' : Q.scope === 'team' ? 'my-team' : Q.scope;
  return { ids: new Set(Q.rows.map((r) => r.id)), scope, count: Q.rows.length };
}
function exportFile(app, viewer, url) {
  const fmt = url.searchParams.get('export');
  if (url.searchParams.get('what') === 'table') {
    const t = dataTable(app, viewer);
    const x = X.tableAsShown(app, t);
    const name = X.fileName(app, 'goals', 'as-shown', fmt === 'csv' ? 'csv' : 'xlsx');
    return fmt === 'csv' ? download(name, 'text/csv; charset=utf-8', writeCsv([x.header, ...x.rows])) : download(name, XLSX, writeWorkbook([{ name: 'Goals', rows: [x.header, ...x.rows], bold: new Set(x.header.map((_, i) => i)), grey: x.grey }]));
  }
  const v = viewOf(app, viewer, url);
  if (fmt === 'zip') return download(X.fileName(app, 'goals', v.scope, 'zip'), 'application/zip', X.csvZip(app, v.ids));
  if (fmt === 'csv') { const sheet = url.searchParams.get('sheet') || 'Goals'; return download(X.fileName(app, X.slug(sheet), v.scope, 'csv'), 'text/csv; charset=utf-8', X.oneCsv(app, sheet, v.ids)); }
  if (fmt === 'json') return download(X.fileName(app, 'goals', v.scope, 'json'), 'application/json', JSON.stringify(X.jsonExport(app, v.ids), null, 2));
  if (fmt === 'md') return download(X.fileName(app, 'brief', v.scope, 'md'), 'text/markdown; charset=utf-8', X.brief(app, v.ids));
  return download(X.fileName(app, 'goals', v.scope, 'xlsx'), XLSX, X.workbook(app, v.ids));
}
// the one Export sheet: Export .xlsx, the other formats behind Other formats, the file's name shown first
function exportDialog(app, { view = null, count, scope, id = 'export-dialog' }) {
  const name = X.fileName(app, 'goals', scope, 'xlsx');
  const sheets = X.sheetsFor(app).map((s) => s.name);
  const hid = (k, v) => `<input type="hidden" name="${k}" value="${h(v)}">`;
  const viewIn = view === null ? '' : hid('view', view);
  return `<dialog id="${id}" class="export-dialog" aria-labelledby="${id}-h"><h2 id="${id}-h">Export</h2>
    <p class="export-note">${h(name)}: ${plural(count, 'goal', 'goals')}, as of week ${app.S1.currentWeek(app.now || app.W.builtFor)}.</p>
    <p>One Excel workbook with every sheet: Start here, ${h(listAnd(sheets))}.</p>
    <form method="get" action="/data/import">${hid('export', 'xlsx')}${viewIn}<button class="primary">Export .xlsx</button></form>
    <button type="button" aria-expanded="false" onclick="const o=this.nextElementSibling;o.hidden=!o.hidden;this.setAttribute('aria-expanded',String(!o.hidden))">Other formats</button>
    <div class="other-formats" hidden>
      <form method="get" action="/data/import">${hid('export', 'zip')}${viewIn}<button>CSV files, zipped</button></form>
      <form method="get" action="/data/import">${hid('export', 'csv')}${viewIn}<label>Sheet <select name="sheet">${sheets.map((s) => `<option>${h(s)}</option>`).join('')}</select></label><button>One sheet as CSV</button></form>
      <form method="get" action="/data/import">${hid('export', 'json')}${viewIn}<button>JSON</button></form>
      <form method="get" action="/data/import">${hid('export', 'md')}${viewIn}<button>Brief for an AI chat</button></form>
    </div>
    <button type="button" onclick="this.closest('dialog').close()">Close</button></dialog>`;
}
// Data's open table, as laid out (the core's Data shows the goals table)
function dataTable(app, viewer, given = null) {
  if (given && given.columns) return given;
  const ws = app.S1.asOf(app.now || app.W.builtFor);
  const people = new Map(app.W.people.map((p) => [p.id, p]));
  const teams = new Map(app.W.teams.map((t) => [t.id, t]));
  const goals = app.W.goals.filter((g) => !g.removedAt);
  const SW = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };
  return { name: 'Goals', sheet: 'Goals', columns: ['Goal', 'Status', 'Owner', 'Team'], rows: goals.map((g) => ({ Key: g.key, ID: g.id, Goal: g.title, Status: SW[app.S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], app.now || app.W.builtFor).status], Owner: people.get(g.ownerId)?.name || '', Team: teams.get(g.teamId)?.name || '' })) };
}

// ---------- Help ----------
const columnsArticle = () => ['Goals', 'Plan', 'Check-ins', 'People'].map((sheet) => {
  const f = FORMAT[sheet];
  return `<section aria-labelledby="col-${X.slug(sheet)}"><h2 id="col-${X.slug(sheet)}">${h(sheet)}</h2>${f.needs ? `<p>${h(f.needs)}</p>` : ''}<ul aria-label="${h(sheet)} columns">${f.cols.map((c) => `<li>${h(c.col)}: ${h(c.need)}.${c.format ? ` ${h(c.format)}.` : ''}${c.example ? ` Example: ${h(c.example)}.` : ''}${c.empty ? ` If it’s left empty: ${h(c.empty)}.` : ''}</li>`).join('')}</ul></section>`;
}).join('');

// ---------- the module ----------
export const spreadsheetsModule = {
  id: 'spreadsheets', name: 'Spreadsheets', group: 'tools', needs: [],
  summary: 'Download the goals as an Excel workbook or CSV files, and load changes back from a spreadsheet, with every change shown before it’s saved.',
  reset: () => sessions.clear(),
  routes: [
    { path: '/data/import', name: 'Import', help: 'import', handle: importRoute },
    { path: '/data/import/check', name: 'Check this import', help: 'import', focus: true, handle: (a, v, r) => checkRoute(a, v, r, false) },
    { path: '/data/import/check/changes', name: 'Every change', help: 'import', focus: true, handle: (a, v, r) => checkRoute(a, v, r, true) },
    { path: '/data/import/done/:importId', name: 'Imported', help: 'past-imports', handle: doneRoute },
    { path: '/data/imports', name: 'Past imports', help: 'past-imports', handle: (a, v, r) => (r.method === 'POST' ? undoPost(a, v, r, (m) => pastPage(a, v, r.url, m)) : pastPage(a, v, r.url)) },
  ],
  redirects: [{ from: '/import', to: '/data/import' }],
  places: {
    'data.tools': ({ app, viewer, table }) => {
      const t = dataTable(app, viewer, table);
      const x = X.tableAsShown(app, t);
      const all = app.W.goals.filter((g) => !g.removedAt).length;
      return `<details class="data-export"><summary>Export</summary><div class="data-export-menu">
        <p>Saves the ${h(t.name)} table as shown: ${plural(x.rows.length, 'row', 'rows')} and ${plural(x.header.length, 'column', 'columns')}${x.added.length ? `, adding ${h(listAnd(x.added))} so it loads back` : ''}.</p>
        <form method="get" action="/data/import"><input type="hidden" name="export" value="xlsx"><input type="hidden" name="what" value="table"><button>Export .xlsx</button></form>
        <form method="get" action="/data/import"><input type="hidden" name="export" value="csv"><input type="hidden" name="what" value="table"><button>Export .csv</button></form>
        <button type="button" onclick="document.getElementById('export-everything').showModal()">Everything…</button></div></details>
        <a class="data-import" href="/data/import">Import</a>
        ${exportDialog(app, { count: all, scope: 'all', id: 'export-everything' })}<script>{const d=document.getElementById('export-everything'),back=()=>document.querySelector('.data-export > summary').focus();d.addEventListener('cancel',(e)=>{e.preventDefault();d.close();back()});d.addEventListener('close',()=>setTimeout(back,0))}</script>`;
    },
    'goals.tools': ({ app, viewer, url, shown }) => {
      const v = viewOf(app, viewer, new URL(`http://x/?view=${encodeURIComponent(url.search)}`));
      return `<button type="button" class="export-goals" onclick="document.getElementById('export-goals').showModal()">Export these goals</button>${exportDialog(app, { view: url.search, count: v.count, scope: v.scope, id: 'export-goals' })}`;
    },
    'help.article': ({ id }) => (id === 'columns' ? columnsArticle() : id === 'import' ? '<p><a href="/data/import">Go to Import</a> · <a href="/help/columns">Every column, and what it needs</a></p>' : ''),
  },
  help: [
    { id: 'import', after: 'getting-around', title: 'Importing from a spreadsheet', body: 'Load a workbook, a zip of CSVs or one CSV to add or change people, goals, plan numbers and check-ins, past weeks included, or to stop a goal.\n\nEvery row is checked with the app’s own rules and shown before anything is saved. Must fix blocks saving; a question is answered once for every row it covers; a name one letter out is asked about, never guessed. Up to 30,000 rows a file, and 5,000 changes at a time.' },
    { id: 'export', after: 'import', title: 'Exporting', body: 'One button: Export .xlsx. Zipped CSVs, one sheet as CSV, JSON and a brief for an AI chat are under Other formats.\n\nEvery file is named after the workspace, what it holds, all or the view or as shown, and the date.' },
    { id: 'columns', after: 'export', title: 'Every column, and what it needs', body: 'For every column of Goals, Plan, Check-ins and People: whether a new row must have it, its format, an example, and what happens when it’s left empty.' },
    { id: 'past-imports', after: 'columns', title: 'Past imports and Undo', body: 'Every import, bulk edit and change through MCP in one list, newest first, each with who made it, how, what it changed, and Undo.\n\nUndo puts every row back as it was, except rows changed since, which stay and say why.' },
  ],
  // an import's line in Activity: Undo beside it
  activityEntry: (app, viewer, change) => (change.action === 'imported' ? undoBlock(app, viewer, { ...change, undone: app.W.changes.find((u) => u.action === 'undid import' && u.entityId === change.entityId) || null }).replace(/>Undo \d+ rows?<\/button>\s*<dialog/, '>Undo this import</button>\n<dialog').replace('action="/data/imports"', 'action="/data/imports"') : ''),
  aiTools: [
    { name: 'export', title: 'Export the goals', description: 'Every goal in the current cycle as JSON (each goal with its plan by week and check-ins), a Markdown brief, or one sheet of the spreadsheet export as CSV: goals, plan, check-ins, people, results, asks, notes or metrics. The goals, plan, check-ins and people CSVs load back with bulk_change.',
      inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['json', 'brief', 'goals_csv', 'plan_csv', 'check_ins_csv', 'people_csv', 'results_csv', 'asks_csv', 'notes_csv', 'metrics_csv'], description: 'Which export.' } }, required: ['format'] }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: (app, me, a = {}) => {
        const f = a.format;
        if (f === 'json') { const j = X.jsonExport(app); return { text: JSON.stringify(j), structured: { file: X.fileName(app, 'goals', 'all', 'json'), goals: j.goals.length } }; }
        if (f === 'brief') return { text: X.brief(app), structured: { file: X.fileName(app, 'brief', 'all', 'md') } };
        const sheet = { goals_csv: 'Goals', plan_csv: 'Plan', check_ins_csv: 'Check-ins', people_csv: 'People', results_csv: 'Results', asks_csv: 'Asks', notes_csv: 'Notes', metrics_csv: 'Metrics' }[f];
        if (!sheet) return { error: `There’s no export called ${f}. Use json, brief, or a sheet’s CSV such as goals_csv.` };
        if (!X.sheetsFor(app).some((x) => x.name === sheet)) return { error: `${sheet === 'Notes' ? 'Reviews' : 'Metric library'} is off in ${app.wsName}, so there is no ${sheet} sheet.` };
        return { text: X.oneCsv(app, sheet).replace(/^\ufeff/, ''), structured: { file: X.fileName(app, X.slug(sheet), 'all', 'csv') } };
      } },
    { name: 'export_table', title: 'Export a data table as shown', description: 'One of Data’s tables exactly as a layout shows it: its columns in order and the rows that pass its search, then any column that says which record a row is that the layout leaves out, so the rows load back with bulk_change. CSV by default, or rows as JSON.',
      inputSchema: { type: 'object', properties: { view: { type: 'string' }, table: { type: 'string', enum: ['goals', 'checkIns', 'plan', 'requests', 'people'] }, columns: { type: 'array', items: { type: 'string' } }, query: { type: 'string' }, format: { type: 'string', enum: ['csv', 'json'] } } }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: (app, me, a = {}) => {
        if (a.view) return { error: `There’s no saved layout called “${a.view}”. Give the table, its columns and a query instead.` };
        if (a.table && a.table !== 'goals') return { error: `Only the goals table can be exported as shown here; use export for the ${a.table} sheet.` };
        const t = dataTable(app, me);
        const cols = (a.columns && a.columns.length ? a.columns : t.columns).filter((c) => ['Key', 'ID', 'Goal', 'Status', 'Owner', 'Team'].includes(c));
        const q = String(a.query || '').toLowerCase();
        const rows = t.rows.filter((r) => !q || `${r.Goal} ${r.Owner} ${r.Team} ${r.Status}`.toLowerCase().includes(q));
        const x = X.tableAsShown(app, { ...t, columns: cols, rows });
        const head = `${X.fileName(app, 'goals', 'as-shown', a.format === 'json' ? 'json' : 'csv')}: ${plural(x.rows.length, 'row', 'rows')} and ${plural(x.header.length, 'column', 'columns')}${x.added.length ? `, adding ${listAnd(x.added)} so it loads back` : ''}.`;
        if (a.format === 'json') return { text: head, structured: { header: x.header, rows: x.rows.map((r) => Object.fromEntries(x.header.map((h2, i) => [h2, r[i]]))), added: x.added } };
        return { text: `${head}\n\n${writeCsv([x.header, ...x.rows]).replace(/^\ufeff/, '')}`, structured: { header: x.header, rows: x.rows.length, added: x.added } };
      } },
  ],
};
