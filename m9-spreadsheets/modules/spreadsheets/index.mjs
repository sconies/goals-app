// The spreadsheets module: Export (one sheet, one button), Import on Data with its preview, Imported,
// Past imports and Undo, Help's column table, and two AI tools. It registers into the core's extension
// points (rebuild/modules/index.mjs); the core knows nothing of it.
import { workbook, csvZip, oneCsv, template, asJson, brief, fileName, slug, sheetRows, FORMAT, SHEET, LOADS_BACK, fillIn } from './export.mjs';
import { readFile, readTables, readLine, asNew, workedOutEdits, workedOutLine, run, groups, leaveOut, rowsToFix, LIMITS, listAnd, NAME_OF } from './importer.mjs';
import { saveImport, pastImports, canUndo, undoPreview, undoImport, dayWords } from './undo.mjs';
import { writeXlsx, writeCsv } from './xlsx.mjs';
import { Worker } from 'node:worker_threads';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const pending = new Map(); // viewer -> { file, data (base64), answers, leave: [{sk,row}], otherWs, reason, prev }
const jobs = new Map(); // viewer -> { worker, progress, done, stopped, file }
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const attach = (name) => ({ 'content-disposition': `attachment; filename="${name}"` });

export const id = 'spreadsheets';
export const name = 'Spreadsheets';
export const about = 'Download the goals as an Excel workbook or CSV files, and load changes back from a spreadsheet, with every change shown before it’s saved.';
export const group = 'Tools';
export const oldAddresses = { '/import': '/data/import' };
export const routes = ['data/import', 'data/imports', 'export'];
export const helpArticles = { 'Importing from a spreadsheet': 'import', Exporting: 'export', 'Every column, and what it needs': 'columns', 'Past imports and Undo': 'past-imports' };
export function holds(ctx) { const n = pastImports(ctx.W).length; return n ? `${plural(n, 'past import', 'past imports')} kept.` : ''; }

// ---------- describing a change set ----------
function describe(k) {
  const bits = [];
  if (k.newPeople) bits.push(plural(k.newPeople, 'new person', 'new people'));
  if (k.people) bits.push(`${plural(k.people, 'person', 'people')} changed`);
  if (k.newGoals) bits.push(plural(k.newGoals, 'new goal', 'new goals'));
  if (k.goals || k.plans) bits.push(`${plural((k.goals || 0) + (k.plans || 0), 'goal', 'goals')} changed`);
  if (k.checkIns) bits.push(`${plural(k.checkIns, 'check-in', 'check-ins')}${k.backfilled ? ` (${k.backfilled} for past weeks)` : ''}`);
  if (k.stopped) bits.push(`${plural(k.stopped, 'goal', 'goals')} stopped`);
  if (k.deleted) bits.push(`${plural(k.deleted, 'goal', 'goals')} deleted`);
  if (k.left) bits.push(`${plural(k.left, 'person', 'people')} marked as left`);
  return bits.join(', ');
}

// ---------- the check: the file read, rows left out, the engine run ----------
function check(ctx, pd) {
  const buf = Buffer.from(pd.data, 'base64');
  let sheets;
  try { sheets = readFile(buf, pd.file); } catch (e) { return { error: `${pd.file} can’t be read as a workbook, a zip of CSVs or a CSV.` }; }
  const rt = readTables(sheets, { fileName: pd.file });
  if (!rt.read.length) return { noFaro: true, rt };
  const otherWs = rt.origin && rt.origin.workspace !== (ctx.wsId || 'demo');
  if (otherWs && !pd.otherWs) return { askOther: true, rt };
  if (otherWs && pd.otherWs === 'new') asNew(rt);
  if (rt.rows > LIMITS.rows) return { tooBig: true, rt };
  const worked = workedOutEdits(ctx, rt);
  const picks = (pd.leave || []).map((p) => ({ sk: p.sk, line: rt.rowNo[p.sk].indexOf(p.row) + 2 })).filter((p) => p.line >= 2);
  const left = picks.length ? leaveOut(rt, picks) : [];
  const res = run(ctx, rt, { ...(pd.answers || {}) }, pd.reason);
  let gs = groups(res, rt);
  // a question once answered is no longer raised: the preview still shows it, closed to its answer
  if (Object.keys(pd.answers || {}).length) {
    const all = groups(run(ctx, rt, {}, pd.reason), rt);
    const have = new Set(gs.map((g) => g.id));
    gs = gs.concat(all.filter((g) => !have.has(g.id) && pd.answers[g.id] !== undefined));
  }
  const answeredLeave = gs.filter((g) => (pd.answers || {})[g.id] === 'leave');
  return { rt, res, gs, left, worked, answeredLeave };
}

// ---------- pages ----------
function importPage(ctx, h, msg = '') {
  const n = pastImports(ctx.W).length;
  const need = (s) => SHEET[s].needs;
  const body = `<div class="closer"><a class="btn" href="/data">Close</a></div><h1>Import</h1>
<p>Add or change goals, plans, check-ins and people from a spreadsheet.</p>
${msg}
<form method="post" action="/data/import/check" id="pick"><input type="hidden" name="file"><input type="hidden" name="data">
<label for="sheetfile" class="btn primary" style="display:inline-flex;font-weight:600">Choose a spreadsheet</label>
<input type="file" id="sheetfile" aria-label="Choose a spreadsheet" accept=".xlsx,.zip,.csv,.tsv,.txt" style="position:absolute;left:-9999px">
</form>
<p class="meta">An .xlsx workbook, a .zip of CSVs, or one .csv or tab-separated file. Up to 30,000 rows a file, and 5,000 changes at a time.</p>
<p><button class="btn" type="button" id="pastebtn" aria-expanded="false">or paste rows from a spreadsheet</button></p>
<form method="post" action="/data/import/check" id="pasteform" hidden><input type="hidden" name="file" value="Pasted rows"><label for="pasted">Paste rows from a spreadsheet</label><textarea id="pasted" name="pasted" rows="6" placeholder="Paste the cells with their header row"></textarea><p><button class="btn" type="submit">Check these rows</button></p></form>
<section aria-label="What a new row must have"><h2>What a new row must have</h2>
<dl><dt>A goal</dt><dd>${esc(need('Goals'))}</dd><dt>A check-in</dt><dd>${esc(need('Check-ins'))}</dd><dt>A person</dt><dd>${esc(need('People'))}</dd></dl>
<p><a href="/help/columns">Every column, with its format and an example</a></p>
<p><a class="btn" href="/data/import/template" download>Download the template</a> <span class="meta">faro-template.xlsx: Start here, then Goals, Plan, Check-ins and People with the columns you fill in.</span></p></section>
<p><a href="/data/imports">All ${n} past import${n === 1 ? '' : 's'}</a></p>
<script>(function(){var i=document.getElementById('sheetfile'),f=document.getElementById('pick');i.addEventListener('change',function(){var x=i.files[0];if(!x)return;var r=new FileReader();r.onload=function(){var s=r.result;f.file.value=x.name;f.data.value=s.slice(s.indexOf(',')+1);f.submit();};r.readAsDataURL(x);});
var b=document.getElementById('pastebtn'),p=document.getElementById('pasteform');b.addEventListener('click',function(){p.hidden=false;b.setAttribute('aria-expanded','true');document.getElementById('pasted').focus();});})();</script>`;
  return h.layout(ctx, { address: '/data/import', body, form: true, page: 'Import' });
}

function sheetCounts(c) {
  const by = {};
  for (const s of c.rt.read) by[s] = { read: (c.rt.tables[Object.keys(NAME_OF).find((k) => NAME_OF[k] === s)] || []).length, added: 0, changed: 0, removed: 0, fix: new Set(), check: new Set() };
  for (const it of c.res.items) { const s = it.sheet === 'Goals' && it.kind === 'check-in' ? 'Check-ins' : it.sheet; if (!by[s]) continue; if (/^new/.test(it.kind) || (it.kind === 'check-in' && !it.ck?.replaces)) by[s].added++; else if (/stop|delete|left/.test(it.kind)) by[s].removed++; else by[s].changed++; }
  for (const g of c.gs) for (const l of g.lines) { const s = NAME_OF[l.sheet]; if (!by[s]) continue; if (g.level === 'must') by[s].fix.add(l.line); else if (g.level === 'check') by[s].check.add(l.line); }
  return `<div style="overflow-x:auto"><table class="import-counts"><thead><tr><th>Sheet</th><th>Rows read</th><th>Added</th><th>Changed</th><th>Stopped or left</th><th>Unchanged</th><th>To fix</th><th>To check</th></tr></thead><tbody>${Object.entries(by).map(([s, x]) => `<tr><td>${s}</td><td>${x.read}</td><td>${x.added}</td><td>${x.changed}</td><td>${x.removed}</td><td>${Math.max(0, x.read - x.added - x.changed - x.removed - x.fix.size)}</td><td>${x.fix.size}</td><td>${x.check.size}</td></tr>`).join('')}</tbody></table></div>`;
}

function previewPage(ctx, h, pd, url) {
  const c = check(ctx, pd);
  const close = `<div class="closer"><form method="post" action="/data/import/close"><button class="btn" type="submit">Close without saving</button></form></div>`;
  const templateBtn = `<a class="btn" href="/data/import/template" download>Download the template</a>`;
  if (c.error) return h.layout(ctx, { address: '/data/import/check', form: true, page: 'Check this import', body: `${close}<h1>Check this import</h1><div role="alert"><p>${esc(c.error)}</p><p>${templateBtn}</p></div>${chooseAgain()}` });
  if (c.noFaro) {
    const hs = c.rt.headersFound || [];
    return h.layout(ctx, { address: '/data/import/check', form: true, page: 'Check this import', body: `${close}<h1>Check this import</h1><div role="alert"><p>${esc(pd.file)} has no Faro sheet. Its first sheet’s headers are ${esc(hs.slice(0, 5).join(', '))}${hs.length > 5 ? '…' : hs.length ? '…' : ''}</p><p>Each sheet is known by its header row: Goals needs Goal and Owner, Check-ins Goal key, Week and Value, People Name and Email.</p><p>${templateBtn}</p></div>${chooseAgain()}` });
  }
  if (c.tooBig) return h.layout(ctx, { address: '/data/import/check', form: true, page: 'Check this import', body: `${close}<h1>Check this import</h1><div role="alert"><p>${esc(pd.file)} has ${c.rt.rows.toLocaleString('en-GB')} rows. Up to 30,000 rows a file: split it into parts and load them one after the other.</p></div>${chooseAgain()}` });
  if (c.askOther) {
    return h.layout(ctx, { address: '/data/import/check', form: true, page: 'Check this import', body: `${close}<h1>Check this import</h1><section class="check" aria-label="Another workspace"><p>This file was exported from “${esc(c.rt.origin.name)}”, not ${esc(ctx.wsName)}. Its keys and IDs belong there.</p>
<form method="post" action="/data/import/other"><button class="btn primary" name="a" value="new">Add its rows as new goals</button> <button class="btn" name="a" value="none" formaction="/data/import/close">Don’t load it</button></form></section>` });
  }
  const { res, gs, rt, left } = c;
  const must = gs.filter((g) => g.level === 'must' && pd.answers?.[g.id] !== 'leave');
  const mustAll = gs.filter((g) => g.level === 'must');
  const qs = gs.filter((g) => g.level === 'check');
  const answeredMust = gs.filter((g) => g.level === 'must' && pd.answers?.[g.id] === 'leave');
  const answered = (g) => pd.answers?.[g.id] !== undefined;
  const mustRows = new Set(must.flatMap((g) => g.lines.map((l) => `${l.sheet}:${l.line}`)));
  const openQs = qs.filter((g) => !answered(g));
  const lines = [];
  lines.push(`<p class="file-line"><strong>${esc(pd.file)}</strong>: ${esc(readLine(rt))}</p>`);
  for (const n of rt.headerNotes) lines.push(`<p>${esc(n)}</p>`);
  if (pd.carried) lines.push(`<p>${pd.carried === 1 ? 'Your 1 answer still applies.' : `Your ${pd.carried} answers still apply.`}</p>`);
  const wl = workedOutLine(c.worked); if (wl) lines.push(`<p>${esc(wl)}</p>`);
  const leftByAnswer = answeredMust.concat(qs.filter((g) => pd.answers?.[g.id] === 'leave')).reduce((n, g) => n + g.n, 0);
  const nPick = left.filter((l) => l.why === 'at your choice').length, nDep = left.length - nPick;
  if (left.length) lines.push(`<p>${nPick === 1 ? '1 row was left out at your choice' : `${nPick} rows were left out at your choice`}${nDep ? `, and ${plural(nDep, 'row', 'rows')} that depend${nDep === 1 ? 's' : ''} on ${nPick === 1 ? 'it' : 'them'}` : ''}. <form method="post" action="/data/import/putback" style="display:inline"><button class="btn link">Put them back</button></form></p>`);
  if (leftByAnswer) lines.push(`<p>${leftByAnswer === 1 ? '1 row is left out' : `${leftByAnswer} rows are left out`}.</p>`);
  let html = `${close}<h1>Check this import</h1>${lines.join('')}${sheetCounts(c)}`;
  // Must fix (a group left out by an answer closes to its line)
  if (!must.length && answeredMust.length) html += `<section aria-label="Left out"><h2>Must fix</h2>${answeredMust.map((g) => groupHtml(g, pd)).join('')}</section>`;
  if (must.length) {
    const nRows = mustRows.size;
    html += `<section aria-labelledby="mf"><h2 id="mf">Must fix</h2><p>${plural(nRows, 'row', 'rows')}, ${plural(must.length, 'kind of problem', 'kinds of problem')}. Nothing is saved while one is left.</p>`;
    for (const g of mustAll) html += groupHtml(g, pd);
    
    // a row whose only problem is a row it depends on goes with that row, so it isn't listed as its own
    const leaveList = must.flatMap((g) => g.lines.filter((l) => !/which isn’t saved/.test(l.message)).map((l) => ({ sk: l.sheet, row: l.row, name: lineName(rt, l), why: l.message }))).filter((x, i, a) => a.findIndex((y) => y.sk === x.sk && y.row === x.row) === i);
    const deps = dependents(rt, leaveList);
    const leaveLabel = leaveList.length === 1 ? 'Leave this row out and save the rest' : 'Leave these rows out and save the rest';
    html += `<p><a class="btn" href="/data/import/fix" download>Download the rows to fix</a> <button class="btn primary" type="button" id="again">Choose the corrected file</button> <button class="btn" type="button" id="leavebtn">${leaveLabel}</button></p></section>
<dialog id="leavedlg" aria-label="Leave rows out"><h2>Leave ${leaveList.length === 1 ? 'this row' : 'these rows'} out</h2><ul>${leaveList.map((x) => `<li>${esc(NAME_OF[x.sk])} row ${x.row}${x.name ? `: ${esc(x.name)}` : ''}</li>`).join('')}</ul>${deps.length ? `<p>${plural(deps.length, 'row goes', 'rows go')} with ${leaveList.length === 1 ? 'it' : 'them'}:</p><ul>${deps.map((d) => `<li>${esc(d.sheet)} row ${d.row}${d.name ? `: ${esc(d.name)}` : ''}, because ${esc(d.why)}</li>`).join('')}</ul>` : ''}<p>The rest saves. Nothing is saved until you press Save.</p>
<form method="post" action="/data/import/leave">${leaveList.map((x) => `<input type="hidden" name="row" value="${x.sk}:${x.row}">`).join('')}<button class="btn primary" type="submit">Leave them out</button> <button class="btn" type="button" onclick="this.closest('dialog').close()">Cancel</button></form></dialog>`;
  }
  if (qs.length) {
    const rowsQ = new Set(qs.flatMap((g) => g.lines.map((l) => `${l.sheet}:${l.line}`))).size;
    html += `<section aria-labelledby="qq"><h2 id="qq">Questions</h2><p>${qs.length === 1 ? '1 question covers' : `${qs.length} questions cover`} ${plural(rowsQ, 'row', 'rows')}.</p>${qs.map((g) => groupHtml(g, pd)).join('')}</section>`;
  }
  // reason for plan changes
  if (res.needsReason && !must.length) html += `<form method="post" action="/data/import/reason"><label for="reason">Why is the plan changing?</label><textarea id="reason" name="reason">${esc(pd.reason || '')}</textarea><p><button class="btn" type="submit">Use this reason</button></p></form>`;
  // what will be saved
  const k = res.counts;
  const d = describe(k);
  html += `<section aria-labelledby="ws"><h2 id="ws">What will be saved</h2>`;
  if (!res.items.length && !must.length) html += `<p>Nothing would change.${res.unchanged ? ` ${plural(res.unchanged, 'row matches', 'rows match')} what is here.` : ''}</p>`;
  else {
    html += `<p>${esc(d || 'No changes yet')}.</p>`;
    if (res.items.length) html += `<p><a href="/data/import/check/changes">Show the ${plural(res.items.length, 'change', 'changes')}</a></p>`;
  }
  if (res.items.length > LIMITS.perSave) {
    const k2 = Math.ceil(res.items.length / LIMITS.perSave);
    html += `<p>This file would change ${res.items.length.toLocaleString('en-GB')} rows: Faro saves up to 5,000 changes at a time. It is checked, not saved.</p><p><a class="btn primary" href="/data/import/parts">Download as ${k2} files of 5,000 rows</a></p>`;
  } else if (res.saves) html += `<form method="post" action="/data/import/save"><button class="btn primary" type="submit" id="save">Save ${plural(res.items.length, 'change', 'changes')}</button></form>`;
  html += `</section>${must.length ? chooseAgain(true) : ''}
<script>(function(){var b=document.getElementById('leavebtn');if(b)b.addEventListener('click',function(){document.getElementById('leavedlg').showModal();});
var s=document.getElementById('save');if(s&&location.hash==='#save')s.focus();var a=document.querySelector('[data-focus]');if(a&&!s)a.focus();})();</script>`;
  return h.layout(ctx, { address: '/data/import/check', form: true, page: 'Check this import', body: html });
}
const lineName = (rt, l) => { const o = rt.tables[l.sheet]?.[l.line - 2]; if (!o) return ''; const e = Object.entries(o).find(([hh]) => /^(goal|name|goal name)$/i.test(hh.trim())); return e ? e[1] : ''; };
function dependents(rt, list) {
  const copy = { ...rt, tables: { ...rt.tables }, rowNo: Object.fromEntries(Object.entries(rt.rowNo).map(([k, v]) => [k, [...v]])) };
  const picks = list.map((x) => ({ sk: x.sk, line: copy.rowNo[x.sk].indexOf(x.row) + 2 }));
  const left = leaveOut(copy, picks);
  return left.filter((l) => l.why !== 'at your choice');
}
function chooseAgain(hidden) {
  return `<form method="post" action="/data/import/check" id="pick"${hidden ? ' class="again"' : ''}><input type="hidden" name="file"><input type="hidden" name="data"><input type="hidden" name="keep" value="1">
<label for="sheetfile"${hidden ? ' class="meta"' : ' class="btn primary" style="display:inline-flex"'}>Choose a spreadsheet</label><input type="file" id="sheetfile" aria-label="Choose a spreadsheet" accept=".xlsx,.zip,.csv,.tsv,.txt" style="position:absolute;left:-9999px"></form>
<script>(function(){var i=document.getElementById('sheetfile'),f=document.getElementById('pick');i.addEventListener('change',function(){var x=i.files[0];if(!x)return;var r=new FileReader();r.onload=function(){var s=r.result;f.file.value=x.name;f.data.value=s.slice(s.indexOf(',')+1);f.submit();};r.readAsDataURL(x);});var a=document.getElementById('again');if(a)a.addEventListener('click',function(){i.click();});})();</script>`;
}
function groupHtml(g, pd) {
  const a = pd.answers?.[g.id];
  const shown = g.lines.slice(0, 3).map((l) => `<li>${esc(NAME_OF[l.sheet])} row ${l.row}: ${esc(l.message)}</li>`).join('') + (g.lines.length > 3 ? `<li>and ${g.lines.length - 3} more</li>` : '');
  const ask = g.title.match(/(Did you mean [^?]+\?|Read it as [^?]+\?|Is (?:it|that|this)[^?]*\?|Are they[^?]*\?|Which should be read\?)\s*$/)?.[1] || g.title;
  if (a !== undefined) {
    const label = g.answers.find((x) => x.code === a)?.label || a;
    return `<div class="import-answered" id="g-${esc(g.id)}"><p>${esc(ask)}: ${esc(label)} <span class="meta">(${esc(g.where)})</span></p><form method="post" action="/data/import/answer" style="display:inline"><input type="hidden" name="group" value="${esc(g.id)}"><button class="btn link" name="code" value="" data-focus>Change</button></form></div>`;
  }
  const btns = g.answers.map((x, i) => `<button class="btn${i === 0 && g.level === 'check' ? ' primary' : ''}" name="code" value="${esc(x.code)}">${esc(x.label)}</button>`).join(' ');
  return `<div class="import-group import-${g.level}" id="g-${esc(g.id)}"><h3>${esc(g.title)}</h3><p class="meta">${esc(g.where)}</p><ul>${shown}</ul>${btns ? `<form method="post" action="/data/import/answer" role="group" aria-label="${esc(ask)}"><input type="hidden" name="group" value="${esc(g.id)}">${btns}</form>` : ''}</div>`;
}

function changesPage(ctx, h, pd, url) {
  const c = check(ctx, pd);
  if (!c.res) return null;
  const n = Number(url.searchParams.get('n') || 50);
  const notes = new Map();
  for (const i of c.res.issues) if (i.level === 'note') { const k = `${i.sheet}:${i.row}`; if (!notes.has(k)) notes.set(k, []); notes.get(k).push(i.message); }
  const items = c.res.items.slice(0, n).map((it) => {
    const sk = it.sheet === 'Goals' ? 'goals' : it.sheet === 'Check-ins' ? 'checkIns' : 'people';
    const used = notes.get(`${sk}:${it.line}`) || [];
    return `<div class="import-change"><p><strong>${esc(it.name)}</strong> <span class="meta">· ${esc(it.kind)} · ${esc(it.sheet)} row ${c.rt.rowNo[sk]?.[it.line - 2] ?? it.line}</span></p><div style="overflow-x:auto"><table class="diffs"><tbody>${it.diffs.map(([f, a, b]) => `<tr><th scope="row">${esc(f)}</th><td><del>${esc(a)}</del></td><td><ins>${esc(b)}</ins></td></tr>`).join('')}</tbody></table></div>${used.length ? `<p class="meta">${used.map(esc).join(' ')}</p>` : ''}</div>`;
  }).join('');
  const more = c.res.items.length > n ? `<p><a class="btn" href="/data/import/check/changes?n=${n + 50}">Show 50 more</a></p>` : '';
  const save = c.res.saves && c.res.items.length <= LIMITS.perSave ? `<form method="post" action="/data/import/save"><button class="btn primary" type="submit">Save ${plural(c.res.items.length, 'change', 'changes')}</button></form>` : '';
  const body = `<div class="closer"><form method="post" action="/data/import/close"><button class="btn" type="submit">Close without saving</button></form></div><h1>The changes</h1><p><a href="/data/import/check">Back to Check this import</a></p><p>${plural(c.res.items.length, 'change', 'changes')}, in the file’s order.</p><div class="rows">${items}</div>${more}${save}`;
  return h.layout(ctx, { address: '/data/import/check/changes', form: true, page: 'The changes', body });
}

function undoDialog(ctx, imp, label) {
  const p = undoPreview(ctx, imp);
  const n = p.restores.length;
  return `<button class="btn" type="button" onclick="document.getElementById('u-${imp.importId}').showModal()">${esc(label || (p.skipped.length ? `Undo ${plural(n, 'row', 'rows')}` : 'Undo this import'))}</button>
<dialog id="u-${imp.importId}" aria-label="Undo this import"><h2>Undo the import of ${esc(imp.file)}</h2>${n ? `<p>${plural(n, 'row goes', 'rows go')} back to how ${n === 1 ? 'it was' : 'they were'} on ${dayWords(imp.at)}, before the import.</p>` : '<p>Nothing left to undo: every row has changed since.</p>'}
${p.skipped.length ? `<h3>Rows that stay as they are</h3><ul class="kept" aria-label="Rows that stay as they are">${p.skipped.map((s) => `<li>${esc(s.name)}: ${esc(s.why)}</li>`).join('')}</ul>` : ''}
<form method="post" action="/data/imports/${imp.importId}/undo">${n ? `<button class="btn primary" type="submit">Undo ${plural(n, 'row', 'rows')}</button>` : ''} <button class="btn" type="button" onclick="this.closest('dialog').close()">Cancel</button></form></dialog>`;
}
function importLine(ctx, h, imp) {
  const p = imp.undoneAt ? null : undoPreview(ctx, imp);
  const who = h.nameOf(imp.by);
  let html = `<div class="import-line"><p><strong>${esc(imp.file)}</strong> · ${esc(imp.rowsLine)}</p><p class="meta">${esc(who)} · ${esc(imp.via)} · ${dayWords(imp.at)} · ${esc(imp.describe || '')}</p>`;
  if (imp.undoneAt) html += `<p>Undone on ${dayWords(imp.undoneAt)} by ${esc(h.nameOf(imp.undoneBy))}: ${plural(imp.undoneRows, 'row', 'rows')} put back${imp.kept?.length ? `, ${imp.kept.length} kept` : ''}.</p>`;
  else if (p.skipped.length) html += `<p>${p.skipped.length} of its ${imp.saved} rows ${p.skipped.length === 1 ? 'has' : 'have'} changed since, so Undo would put back ${p.restores.length}.</p>`;
  if (!imp.undoneAt && canUndo(ctx, imp)) html += undoDialog(ctx, imp);
  return html + '</div>';
}
function importedPage(ctx, h, imp, msg) {
  const body = `<h1>Imported</h1>${msg ? `<p role="status">${esc(msg)}</p>` : ''}<p>Saved ${plural(imp.saved, 'row', 'rows')} from ${esc(imp.file)}.</p><p>${esc(imp.describe)}.</p>
${imp.leftOut ? `<p>${imp.leftOut === 1 ? '1 row was left out.' : `${imp.leftOut} rows were left out.`} <a class="btn" href="/data/imports/${imp.importId}/left" download>Download them</a></p>` : ''}
${imp.undoneAt ? `<p>Undone on ${dayWords(imp.undoneAt)}.</p>` : canUndo(ctx, imp) ? undoDialog(ctx, imp, 'Undo this import') : ''}
<p><a class="btn primary" href="/goals?scope=all">See the goals</a> <a class="btn" href="/data/import">Import another file</a></p>`;
  return h.layout(ctx, { address: `/data/import/done/${imp.importId}`, body, narrow: true, page: 'Imported', parent: ['/data', 'Data'] });
}
function pastPage(ctx, h, url, msg) {
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const list = pastImports(ctx.W).filter((i) => !q || `${i.file} ${h.nameOf(i.by)} ${i.describe}`.toLowerCase().includes(q));
  const body = `<h1>Past imports</h1>${msg ? `<p role="status">${esc(msg)}</p>` : ''}<form method="get" action="/data/imports" role="search"><input type="search" name="q" value="${esc(q)}" aria-label="Find an import" placeholder="A file, a person or what it changed"></form><p class="countline">${list.length ? `${plural(list.length, 'import', 'imports')}, newest first.` : q ? `No import matches “${esc(q)}”.` : 'No imports yet.'}</p><div class="rows">${list.map((i) => importLine(ctx, h, i)).join('')}</div>`;
  return h.layout(ctx, { address: '/data/imports', body, narrow: true, page: 'Past imports', parent: ['/data/import', 'Import'] });
}

// ---------- export: one sheet, one button ----------
function goalSet(ctx, h, url) {
  const p = url.searchParams;
  const scope = p.get('scope') || 'mine';
  const filtered = ['q', 'status', 'team', 'owner', 'level', 'attention', 'checkedin'].some((k) => p.get(k));
  const ids = h.goalIds ? h.goalIds(ctx, url) : null;
  const label = scope === 'all' && !filtered ? 'all' : filtered ? 'as-shown' : { mine: 'mine', team: 'my-team', watching: 'watching' }[scope] || 'as-shown';
  return { ids, label };
}
export function exportSheet(ctx, h, url, from = 'goals') {
  const W = ctx.W;
  const { ids, label } = goalSet(ctx, h, url);
  const nAll = W.goals.filter((g) => !g.removedAt).length;
  const shown = ids ? ids.size : 0;
  const startShown = label !== 'all' && shown > 0 && from === 'goals';
  const q = url.search.replace(/^\?/, '');
  const nameAll = fileName(ctx, 'goals', 'all', 'xlsx'), nameShown = fileName(ctx, 'goals', label, 'xlsx');
  const sheets = ['Start here', 'Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', ...(ctx.on('reviews') ? ['Notes'] : []), ...(ctx.on('metrics') ? ['Metrics'] : [])];
  const cks = W.checkIns.filter((c) => !c.removedAt).length, ppl = W.people.filter((p) => !p.removedAt).length;
  return `<dialog id="exportdlg" aria-label="Export" class="export-sheet"><h2>Export</h2>
<fieldset><legend>Which goals</legend>
<label style="font-weight:400"><input type="radio" name="which" value="shown"${startShown ? ' checked' : ''}${shown ? '' : ' disabled'} data-href="/export/xlsx?${esc(q)}" data-name="${esc(nameShown)}"> ${shown ? `The ${plural(shown, 'goal', 'goals')} shown now` : 'None shown now'}</label>
<label style="font-weight:400"><input type="radio" name="which" value="all"${startShown ? '' : ' checked'} data-href="/export/xlsx?scope=all" data-name="${esc(nameAll)}"> Everything in the cycle: ${plural(nAll, 'goal', 'goals')}, ${cks.toLocaleString('en-GB')} check-ins and ${ppl} people</label></fieldset>
<p class="meta">One Excel workbook: ${listAnd(sheets)}.</p>
<p>Saves <strong class="export-name">${esc(startShown ? nameShown : nameAll)}</strong>, as of week ${ctx.week}.</p>
<p><a class="btn primary export-go" role="button" href="${startShown ? `/export/xlsx?${esc(q)}` : '/export/xlsx?scope=all'}" download>Export .xlsx</a> <button class="btn" type="button" aria-expanded="false" class="other-btn" id="otherbtn">Other formats</button></p>
<div id="otherfmt" hidden><ul class="rows" style="list-style:none;padding:0">
<li><a href="/export/zip?scope=all" download>CSV files, zipped</a> <span class="meta">the same sheets, one CSV each</span></li>
<li>One sheet as CSV: ${['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks'].map((s) => `<a href="/export/csv?sheet=${encodeURIComponent(s)}&scope=all" download>${s}</a>`).join(' · ')}</li>
<li><a href="/export/json?scope=all" download>JSON</a> <span class="meta">everything, each goal with its plan and check-ins</span></li>
<li><a href="/export/brief?scope=all" download>Brief for an AI chat</a> <span class="meta">Markdown</span></li></ul></div>
<p role="status" class="export-said"></p>
<p><button class="btn" type="button" onclick="this.closest('dialog').close()">Close</button></p></dialog>
<script>(function(){var d=document.getElementById('exportdlg');var go=d.querySelector('.export-go');var nm=d.querySelector('.export-name');d.querySelectorAll('[name=which]').forEach(function(r){r.addEventListener('change',function(){go.href=r.dataset.href;nm.textContent=r.dataset.name;});});
go.addEventListener('click',function(){d.querySelector('.export-said').textContent='Exported '+nm.textContent;});
var ob=document.getElementById('otherbtn');ob.addEventListener('click',function(){var o=document.getElementById('otherfmt');o.hidden=!o.hidden;ob.setAttribute('aria-expanded',String(!o.hidden));});
var opener=null;document.querySelectorAll('[data-export-open]').forEach(function(b){b.addEventListener('click',function(){opener=b;var m=b.closest('details');if(m)m.open=false;d.showModal();});});
d.addEventListener('close',function(){setTimeout(function(){var t=document.querySelector('.data-export > summary')||opener;if(t)t.focus();},0);});})();</script>`;
}

// ---------- places on core screens ----------
export const helpHtml = { columns: () => columnsArticle() };
export const places = {
  'activity.import': (ctx, h, c) => (canUndo(ctx, c) ? undoDialog(ctx, c, 'Undo this import') : ''),
  'goals.tools': (ctx, h, url) => `<button class="btn link" type="button" data-export-open>Export these goals</button>${exportSheet(ctx, h, url, 'goals')}`,
  'data.tools': (ctx, h, url, table) => {
    const t = table || { name: 'people', rows: 0, cols: ['Name', 'Team', 'Admin'], keys: ['Email', 'ID'] };
    const added = t.keys.filter((k) => !t.cols.includes(k));
    const nm = fileName(ctx, t.name, 'as-shown', 'xlsx');
    return `<details class="data-export"><summary class="btn">Export</summary><div class="rows" style="position:absolute;z-index:6;min-width:280px">
<p class="meta">This table as shown: ${plural(t.rows, 'row', 'rows')} and ${plural(t.cols.length + added.length, 'column', 'columns')}${added.length ? `; adds ${listAnd(added)} so it loads back` : ''}.</p>
<a href="/export/table?format=xlsx&${esc(url.search.replace(/^\?/, ''))}" download>This table as shown (.xlsx)</a><a href="/export/table?format=csv&${esc(url.search.replace(/^\?/, ''))}" download>This table as shown (.csv)</a>
<p class="meta">Saves ${esc(nm)}</p><button class="btn" type="button" data-export-open>Everything…</button></div></details>
<a class="btn data-import" href="/data/import">Import</a>${exportSheet(ctx, h, new URL('/goals?scope=all', 'http://x'), 'data')}`;
  },
};

// the Help article of every column, made from the same field table
export function columnsArticle() {
  return `<p>For every column of Goals, Plan, Check-ins and People: whether a new row must have it, its format, an example, and what happens when it’s left empty. The template’s first sheet, Start here, is this table.</p>${LOADS_BACK.map((s) => `<h2>${s}</h2>${SHEET[s].needs ? `<p>A new row needs ${esc(SHEET[s].needs)}</p>` : ''}<div style="overflow-x:auto"><table><thead><tr><th>Column</th><th>A new row</th><th>Format</th><th>Example</th><th>If it’s left empty</th></tr></thead><tbody>${SHEET[s].cols.filter((c) => !/^Worked out/.test(c.need)).map((c) => `<tr><td>${esc(c.col)}</td><td>${esc(c.need)}</td><td>${esc(c.format)}</td><td>${esc(c.example)}</td><td>${esc(c.empty)}</td></tr>`).join('')}</tbody></table></div>${(() => { const w = SHEET[s].cols.filter((c) => /^Worked out/.test(c.need)); return w.length ? `<p>Worked out: ${w.map((c) => esc(c.col)).join(', ')}. Faro writes these and never reads them back.</p>` : ''; })()}`).join('')}`;
}

// ---------- the AI tools ----------
export const tools = [
  { name: 'export', description: 'Export the goals: JSON, a Markdown brief, or one sheet as CSV.', inputSchema: { type: 'object', required: ['format'], properties: { format: { type: 'string', enum: ['json', 'brief', 'goals_csv', 'plan_csv', 'check_ins_csv', 'people_csv', 'results_csv', 'asks_csv', 'notes_csv', 'metrics_csv'] } } },
    call(ctx, args) {
      const f = args.format;
      if (f === 'json') return { text: JSON.stringify(asJson(ctx)) };
      if (f === 'brief') return { text: brief(ctx) };
      const sheet = { goals_csv: 'Goals', plan_csv: 'Plan', check_ins_csv: 'Check-ins', people_csv: 'People', results_csv: 'Results', asks_csv: 'Asks', notes_csv: 'Notes', metrics_csv: 'Metrics' }[f];
      if (!sheet) throw new Error(`format should be json, brief or one of goals_csv, plan_csv, check_ins_csv, people_csv, results_csv, asks_csv, notes_csv or metrics_csv.`);
      const mod = { Notes: 'reviews', Metrics: 'metrics' }[sheet];
      if (mod && !ctx.on(mod)) throw new Error(`The ${sheet} sheet’s module is switched off in ${ctx.wsName}, so it isn’t exported there. An admin can switch it on in Workspace, under Features.`);
      return { text: oneCsv(ctx, sheet) };
    } },
  { name: 'export_table', description: 'Export a data table as shown, with the columns that say which record a row is added so it loads back.', inputSchema: { type: 'object', properties: { table: { type: 'string', enum: ['goals', 'checkIns', 'plan', 'requests', 'people'] }, columns: { type: 'array', items: { type: 'string' } }, query: { type: 'string' }, format: { type: 'string', enum: ['csv', 'json'] } } },
    call(ctx, args) { const t = tableAsShown(ctx, args.table || 'people', args.columns, args.query); return { text: args.format === 'json' ? JSON.stringify(t.rows.slice(1).map((r) => Object.fromEntries(t.rows[0].map((h, i) => [h, r[i]])))) : writeCsv(t.rows) }; } },
];
function tableAsShown(ctx, table, columns, query) {
  const sheet = { goals: 'Goals', checkIns: 'Check-ins', plan: 'Plan', requests: 'Asks', people: 'People' }[table];
  const all = sheetRows(ctx)[sheet];
  const cols = columns?.length ? columns : table === 'people' ? ['Name', 'Team', 'Admin'] : all[0];
  const keys = SHEET[sheet].keys;
  const out = [...cols, ...keys.filter((k) => !cols.includes(k))];
  const idx = out.map((c) => all[0].indexOf(c));
  const q = String(query || '').toLowerCase();
  const rows = all.slice(1).filter((r) => !q || r.some((c) => String(c).toLowerCase().includes(q))).map((r) => idx.map((i) => (i < 0 ? '' : r[i])));
  return { rows: [out, ...rows], keys: keys.filter((k) => !cols.includes(k)), cols };
}

// ---------- the routes ----------
export async function get(ctx, h, url, P, res) {
  const v = ctx.viewer;
  if (P[0] === 'export') {
    const scope = url.searchParams.get('scope') || 'all';
    const { ids, label } = goalSet(ctx, h, url);
    const opt = label === 'all' ? {} : { goals: ids };
    const lab = label;
    if (P[1] === 'xlsx') { const n = fileName(ctx, 'goals', lab, 'xlsx'); h.log(ctx, `exported ${n}`, { kind: 'export' }); return h.send(res, 200, workbook(ctx, opt), XLSX, attach(n)); }
    if (P[1] === 'zip') return h.send(res, 200, csvZip(ctx, opt), 'application/zip', attach(fileName(ctx, 'goals', lab, 'zip')));
    if (P[1] === 'csv') { const s = url.searchParams.get('sheet') || 'Goals'; return h.send(res, 200, oneCsv(ctx, s, opt), 'text/csv; charset=utf-8', attach(fileName(ctx, slug(s), lab, 'csv'))); }
    if (P[1] === 'json') return h.send(res, 200, JSON.stringify(asJson(ctx, opt), null, 1), 'application/json', attach(fileName(ctx, 'goals', lab, 'json')));
    if (P[1] === 'brief') return h.send(res, 200, brief(ctx, opt), 'text/markdown; charset=utf-8', attach(fileName(ctx, 'brief', lab, 'md')));
    if (P[1] === 'table') {
      const t = tableAsShown(ctx, 'people', null, url.searchParams.get('q'));
      const fmt = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
      const n = fileName(ctx, 'people', 'as-shown', fmt);
      return fmt === 'csv' ? h.send(res, 200, writeCsv(t.rows), 'text/csv; charset=utf-8', attach(n)) : h.send(res, 200, writeXlsx([{ name: 'People', rows: t.rows, grey: new Set(t.keys.map((k) => t.rows[0].indexOf(k))) }]), XLSX, attach(n));
    }
    return false;
  }
  if (P[0] === 'data' && P[1] === 'imports') {
    if (!P[2]) return h.ok(pastPage(ctx, h, url, url.searchParams.get('msg')));
    const imp = pastImports(ctx.W).find((i) => i.importId === P[2]);
    if (!imp) return false;
    if (P[3] === 'left') { const rows = {}; for (const l of imp.leftRows) (rows[l.sheet] ||= [['Problem', ...Object.keys(l.raw)]]).push([l.why, ...Object.values(l.raw)]); return h.send(res, 200, writeXlsx(Object.entries(rows).map(([name, r]) => ({ name, rows: r }))), XLSX, attach(fileName(ctx, 'rows-left-out', 'as-shown', 'xlsx'))); }
    return h.ok(importedPage(ctx, h, imp));
  }
  if (P[0] === 'data' && P[1] === 'import') {
    if (!P[2]) return h.ok(importPage(ctx, h));
    if (P[2] === 'template') return h.send(res, 200, template(ctx), XLSX, attach('faro-template.xlsx'));
    const pd = pending.get(v);
    if (P[2] === 'done') { const imp = pastImports(ctx.W).find((i) => i.importId === P[3]); return imp ? h.ok(importedPage(ctx, h, imp, url.searchParams.get('msg'))) : false; }
    if (P[2] === 'progress') { const j = jobs.get(v); return h.send(res, 200, JSON.stringify(j ? { done: j.done, stopped: j.stopped, text: j.text } : { done: true }), 'application/json'); }
    if (!pd) return h.redirect(res, '/data/import');
    if (P[2] === 'reading') return h.ok(readingPage(ctx, h, pd));
    if (P[2] === 'check' && !P[3]) return h.ok(previewPage(ctx, h, pd, url));
    if (P[2] === 'check' && P[3] === 'changes') { const page = changesPage(ctx, h, pd, url); return page ? h.ok(page) : h.redirect(res, '/data/import/check'); }
    if (P[2] === 'fix') { const c = check(ctx, pd); const rows = rowsToFix(c.rt, c.gs.filter((g) => g.level === 'must' && pd.answers?.[g.id] !== 'leave')); return h.send(res, 200, writeXlsx(Object.entries(rows).map(([name, r]) => ({ name, rows: r }))), XLSX, attach(fileName(ctx, 'rows-to-fix', 'as-shown', 'xlsx'))); }
    if (P[2] === 'parts') {
      const c = check(ctx, pd); const parts = splitParts(c.rt, LIMITS.perSave);
      const k = Number(url.searchParams.get('part') || 0);
      if (k) return h.send(res, 200, writeXlsx(parts[k - 1]), XLSX, attach(`${pd.file.replace(/\.[a-z]+$/i, '')}-part-${k}-of-${parts.length}.xlsx`));
      return h.ok(h.layout(ctx, { address: '/data/import/parts', form: true, page: 'Download the parts', body: `<div class="closer"><a class="btn" href="/data/import/check">Back</a></div><h1>Download as ${parts.length} files</h1><p>Each goal stays with its plan and check-ins, and a goal comes before the goals that feed into it. Import the parts one after the other; each has its own Undo.</p><p>${parts.map((_, i) => `<a class="btn" href="/data/import/parts?part=${i + 1}" download>Part ${i + 1} of ${parts.length}</a>`).join(' ')}</p>` }));
    }
    return false;
  }
  return false;
}

export async function post(ctx, h, url, P, res, f) {
  const v = ctx.viewer;
  if (P[0] === 'data' && P[1] === 'imports' && P[3] === 'undo') {
    const imp = pastImports(ctx.W).find((i) => i.importId === P[2]);
    if (!imp) return false;
    try { const p = undoImport(ctx, imp); h.bump(); return h.redirect(res, `/data/imports?msg=${encodeURIComponent(`Undone: ${plural(p.restores.length, 'row', 'rows')} put back.${p.skipped.length ? ` ${plural(p.skipped.length, 'row stays', 'rows stay')} as ${p.skipped.length === 1 ? 'it is' : 'they are'}.` : ''}`)}`); }
    catch (e) { return h.redirect(res, `/data/imports?msg=${encodeURIComponent(e.message)}`); }
  }
  if (P[0] !== 'data' || P[1] !== 'import') return false;
  const pd = pending.get(v);
  if (P[2] === 'check') {
    let data = f.data, file = f.file || 'Pasted rows';
    if (f.pasted !== undefined) { data = Buffer.from(f.pasted, 'utf8').toString('base64'); file = 'Pasted rows'; }
    if (!data) return h.redirect(res, '/data/import');
    const answers = pd && (pd.file === file || f.keep) ? pd.answers || {} : {};
    const next = { file, data, answers, leave: [], reason: pd?.reason || '', carried: 0 };
    // answers still apply when their groups are still raised
    if (Object.keys(answers).length) { const c = check(ctx, { ...next, answers: {} }); const ids = new Set((c.gs || []).map((g) => g.id)); for (const k of Object.keys(answers)) if (!ids.has(k)) delete answers[k]; next.carried = Object.keys(answers).length; }
    pending.set(v, next);
    const rowsN = (() => { try { return readTables(readFile(Buffer.from(data, 'base64'), file)).rows; } catch { return 0; } })();
    if (rowsN > LIMITS.large) { const done = startJob(ctx, next); const quick = await Promise.race([done.then(() => true), new Promise((r) => setTimeout(() => r(false), 400))]); return h.redirect(res, quick ? '/data/import/check' : '/data/import/reading'); }
    return h.redirect(res, '/data/import/check');
  }
  if (P[2] === 'close') { pending.delete(v); const j = jobs.get(v); if (j) { j.worker?.terminate(); jobs.delete(v); } return h.redirect(res, '/data/import'); }
  if (P[2] === 'stop') { const j = jobs.get(v); if (j) { j.worker?.terminate(); j.stopped = true; j.done = true; } pending.delete(v); return h.redirect(res, `/data/import?stopped=1`); }
  if (!pd) return h.redirect(res, '/data/import');
  if (P[2] === 'other') { pd.otherWs = f.a === 'new' ? 'new' : null; return h.redirect(res, '/data/import/check'); }
  if (P[2] === 'answer') { if (f.code) pd.answers[f.group] = f.code; else delete pd.answers[f.group]; pd.carried = 0; return h.redirect(res, `/data/import/check#g-${encodeURIComponent(f.group)}`); }
  if (P[2] === 'reason') { pd.reason = f.reason || ''; return h.redirect(res, '/data/import/check'); }
  if (P[2] === 'leave') { for (const r of [].concat(f.row || [])) { const [sk, row] = r.split(':'); pd.leave.push({ sk, row: +row }); } return h.redirect(res, '/data/import/check#save'); }
  if (P[2] === 'putback') { pd.leave = []; return h.redirect(res, '/data/import/check'); }
  if (P[2] === 'save') {
    const c = check(ctx, pd);
    if (!c.res?.saves || c.res.items.length > LIMITS.perSave) return h.redirect(res, '/data/import/check');
    const leftRows = c.left.map((l) => ({ sheet: l.sheet, row: l.row, why: l.why, raw: l.raw }));
    for (const g of c.gs) if (pd.answers[g.id] === 'leave') for (const l of g.lines) { const o = c.rt.tables[l.sheet]?.[l.line - 2]; if (o) leftRows.push({ sheet: NAME_OF[l.sheet], row: l.row, why: l.message, raw: o }); }
    let imp;
    try { imp = saveImport(ctx, c.res, { file: pd.file, describe: describe(c.res.counts), leftOut: leftRows.length, leftRows }); }
    catch (e) { return h.redirect(res, `/data/import/check?msg=${encodeURIComponent(e.message)}`); }
    pending.delete(v); h.bump();
    return h.redirect(res, `/data/import/done/${imp.importId}`);
  }
  return false;
}

// ---------- a large file: checked off the page's thread, with progress and Stop ----------
function startJob(ctx, pd) {
  const j = { done: false, stopped: false, text: `Reading ${pd.file}…`, file: pd.file };
  let finish; const done = new Promise((r) => { finish = r; });
  jobs.set(ctx.viewer, j);
  try {
    const w = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { file: pd.file, data: pd.data, moment: ctx.moment, viewer: ctx.viewer, wsPath: ctx.wsPath } });
    j.worker = w;
    w.on('message', (m) => { if (m.text) j.text = m.text; if (m.done) { j.done = true; finish(); w.terminate(); } });
    w.on('error', () => { j.done = true; finish(); });
  } catch { j.done = true; finish(); }
  return done;
}
function readingPage(ctx, h, pd) {
  const j = jobs.get(ctx.viewer);
  if (!j || j.done) return previewPage(ctx, h, pd);
  const body = `<h1>Reading ${esc(pd.file)}</h1><p role="status" aria-live="polite" id="prog">${esc(j.text)}</p><form method="post" action="/data/import/stop"><button class="btn" type="submit">Stop</button></form>
<script>(function(){var p=document.getElementById('prog');function tick(){fetch('/data/import/progress').then(function(r){return r.json()}).then(function(d){if(d.done){location.replace('/data/import/check');return;}p.textContent=d.text;setTimeout(tick,400);});}setTimeout(tick,400);})();</script>`;
  return h.layout(ctx, { address: '/data/import/reading', form: true, page: `Reading ${pd.file}`, body });
}

// a file that would change more than 5,000 rows: parts of 5,000, each goal with its check-ins, a goal before what feeds it
function splitParts(rt, size) {
  const g = rt.tables.goals || [], ck = rt.tables.checkIns || [];
  const nameOf = (o) => String(Object.entries(o).find(([k]) => /^(goal|goal name)$/i.test(k.trim()))?.[1] ?? '').trim();
  const feeds = (o) => String(Object.entries(o).find(([k]) => /^feeds into$/i.test(k.trim()))?.[1] ?? '').trim();
  const keyOf = (o) => String(Object.entries(o).find(([k]) => /^key$/i.test(k.trim()))?.[1] ?? '').trim();
  const byName = new Map(g.map((o, i) => [nameOf(o), i]));
  const depth = (i, seen = new Set()) => { const p = byName.get(feeds(g[i])); return p === undefined || seen.has(p) ? 0 : (seen.add(p), 1 + depth(p, seen)); };
  const order = g.map((_, i) => i).sort((a, b) => depth(a) - depth(b));
  const ckOf = new Map();
  for (const c of ck) { const k = String(Object.entries(c).find(([h]) => /^goal key$/i.test(h.trim()))?.[1] ?? Object.entries(c).find(([h]) => /^goal$/i.test(h.trim()))?.[1] ?? ''); if (!ckOf.has(k)) ckOf.set(k, []); ckOf.get(k).push(c); }
  const parts = []; let cur = null;
  for (const i of order) {
    const mine = ckOf.get(keyOf(g[i]) || nameOf(g[i])) || [];
    if (!cur || cur.n + 1 + mine.length > size) { cur = { goals: [], cks: [], n: 0 }; parts.push(cur); }
    cur.goals.push(g[i]); cur.cks.push(...mine); cur.n += 1 + mine.length;
  }
  const hs = (sk) => rt.raw[sk]?.headers.filter(Boolean) || [];
  return parts.map((p) => [{ name: 'Goals', rows: [hs('goals'), ...p.goals.map((o) => hs('goals').map((x) => o[x] ?? ''))] }, ...(p.cks.length ? [{ name: 'Check-ins', rows: [hs('checkIns'), ...p.cks.map((o) => hs('checkIns').map((x) => o[x] ?? ''))] }] : [])]);
}
export { check, describe, pending, splitParts };
