/* Wireframes for bulk import and export (docs/design/import/README.md, spec.md section 2).
   Usage: node docs/design/import/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat, hairline rows,
   no edge stripes, quote bars, emoji or pill badges. Must fix and Check are words with the warning mark, never a
   status shape. Numbers are illustrative. */
const kit = require('../../_shared/kit.cjs');
const { shell, note, warn } = kit;

const CSS = `<style>
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px}
.lede{font-size:17px;line-height:26px}
.drop{border:1.5px dashed var(--faint);border-radius:12px;background:var(--surface);padding:28px 20px;display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center}
.doors{display:flex;gap:24px;flex-wrap:wrap;margin-top:14px}.doors>div{flex:1 1 240px;display:flex;flex-direction:column;gap:4px}
.rows{border-top:1px solid var(--line);margin:0;padding:0;list-style:none}.rows li{padding:12px 0;border-bottom:1px solid var(--line-2);display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.rows .t{flex:1 1 300px;min-width:0}.rows .t b{display:block;font-weight:600}.rows .r{color:var(--muted);font-size:14px}
.grp{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.grp.must{background:var(--off-wash);border-color:#F0A39C}
.grp h3{display:flex;gap:8px;align-items:flex-start}.grp h3 svg{margin-top:4px;flex:none}
.must-t{color:var(--off)}.grp .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:2px}
.mono{font-variant-numeric:tabular-nums}
.found{font-weight:600}
.opt{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.opt.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.opt b{font-weight:600}.opt .hint{display:block}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.opts{display:flex;flex-direction:column;gap:6px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:24px;flex-wrap:wrap}
.sec{display:flex;flex-direction:column;gap:10px;margin-top:26px}.sec>h2{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.sec>h2 .hint{font-weight:400}
.diff{display:grid;grid-template-columns:150px 1fr;gap:2px 14px;font-size:14px;margin-top:4px}.diff dt{color:var(--muted)}.diff dd{margin:0}.diff s{color:var(--muted)}
.bar2{height:8px;border-radius:999px;background:var(--line);overflow:hidden}.bar2 i{display:block;height:100%;background:var(--fg)}
.steps2{display:flex;flex-direction:column;gap:10px}.steps2 div{display:flex;justify-content:space-between;gap:12px}
.ft td,.ft th{font-size:13px;line-height:19px}.ft td:first-child{font-weight:600;white-space:nowrap}
.req{font-weight:650}.wo{color:var(--muted)}
.cnt td,.cnt th{text-align:right}.cnt td:first-child,.cnt th:first-child{text-align:left;font-weight:600}
.zero{color:var(--faint)}
.sheetbox{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px;max-width:560px}
.mi{padding:10px 14px;display:flex;flex-direction:column}.mi+.mi{border-top:1px solid var(--line-2)}.mi span{color:var(--muted);font-size:14px}
.menu3{border:1px solid var(--line);border-radius:10px;background:var(--surface);max-width:340px}
.paste{border:1px solid var(--line);border-radius:8px;background:var(--surface);min-height:96px;padding:10px 12px;color:var(--faint);font-size:14px}
@media (max-width:700px){.diff{grid-template-columns:1fr}.diff dd{margin-bottom:6px}.cntlist{display:block}.foot .btn{flex:1 1 100%}.btn.sm{min-height:44px}.acts>a{flex:1 1 100%;padding:6px 0}.ft td:first-child{white-space:normal}}
</style>`;

const rad = (label, on, hint = '') => `<div class="opt ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${label}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const mark = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5 13 12.5H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 6v3" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="10.8" r=".8" fill="currentColor"/></svg>';
const must = (title, body) => `<div class="grp must"><h3><span class="must-t">${mark}</span><span>${title}</span></h3>${body}</div>`;
const check = (title, body) => `<div class="grp"><h3><span style="color:var(--risk)">${mark}</span><span>${title}</span></h3>${body}</div>`;
const z = (n) => (n ? String(n) : '<span class="zero">0</span>');
/** The counts: a table on a desk, one sentence a sheet on a phone. rows: [sheet, read, added, changed, stopped, same, must, check] */
const counts = (rows) => `<table class="cnt desk-only"><thead><tr><th>Sheet</th><th>Rows read</th><th>Added</th><th>Changed</th><th>Stopped or left</th><th>Unchanged</th><th>Must fix</th><th>Check</th></tr></thead><tbody>
${rows.map((r) => `<tr>${r.map((c, i) => `<td class="num">${i ? z(c) : c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<ul class="rows phone-only cntlist">${rows.map((r) => `<li><span class="t"><b>${r[0]} · ${r[1]} rows</b><span class="r">${[[r[2], 'added'], [r[3], 'changed'], [r[4], 'stopped or left'], [r[5], 'unchanged'], [r[6], 'must fix'], [r[7], 'to check']].filter((x) => x[0]).map((x) => `${x[0]} ${x[1]}`).join(' · ')}</span></span></li>`).join('')}</ul>`;
const fileLine = (t) => `<p class="hint" style="margin-bottom:10px">${t}</p>`;
const back = '<p class="hint" style="margin-bottom:6px"><a>‹ Data</a></p>';
const head = (title, sub) => `${back}<div class="head"><div class="stack"><h1>${title}</h1>${sub ? `<p class="hint">${sub}</p>` : ''}</div></div>`;

const SCREENS = {};

/* 1. The way in */
SCREENS['01-import'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
<div class="state"><span class="label">(a) Import, as an admin</span>
${head('Import', 'Add or change goals, plans, check-ins and people from a spreadsheet. You see every change before anything is saved, and one Undo takes a whole import back.')}
<div class="drop"><b>Drop a file here</b><span class="hint">An Excel workbook (.xlsx), a .csv, or a .zip of CSVs. Up to 5,000 rows a file.</span><span class="btn primary">Choose a file</span><a class="hint">or paste rows from a spreadsheet</a></div>
<div class="doors">
<div><b>Starting from nothing</b><p class="hint">The template has every column, says which are required, and carries two example rows that are never imported.</p><div><span class="btn sm">Download the template</span></div></div>
<div><b>Changing what’s here</b><p class="hint">The workbook is every goal, plan, check-in and person as they are now. Change cells, add rows, load it back.</p><div><span class="btn sm">Download the workbook</span></div></div>
</div>
<div class="sec"><h2>What a new row must have</h2>
<ul class="rows">
<li><span class="t"><b>A goal</b><span class="r">Goal, and Owner or Owner email. A number goal also needs Start and Target; a range goal, Limit; a stages goal, Stages.</span></span></li>
<li><span class="t"><b>A check-in</b><span class="r">Goal key (or Goal), Week, and Value or Stages.</span></span></li>
<li><span class="t"><b>A person</b><span class="r">Name and Email.</span></span></li>
</ul><p class="hint"><a>Every column, with its format and an example</a></p></div>
<div class="sec"><h2>Past imports</h2>
<ul class="rows"><li><span class="t"><b>goals-q4-update.xlsx</b><span class="r">Amara Nwosu · 4 Nov · 12 goals changed, 38 check-ins</span></span><a>Undo</a></li></ul>
<p class="hint"><a>All 7 past imports</a></p></div></div>
<div class="state"><span class="label">(b) The same page for Tunde, who is not an admin: the line that differs</span>
<p class="hint" style="max-width:620px">You can add and change your own goals and their check-ins. Rows for other people’s goals are fine if you leave them as they are. Amara, Grace or Hamid can change anyone’s, and add people.</p></div>
<div class="state"><span class="label">(c) Paste rows</span>
<div style="max-width:620px;display:flex;flex-direction:column;gap:10px"><div class="field"><b>Paste rows from a spreadsheet</b><p class="hint">Copy the cells in Excel or Sheets, the header row included, and paste them here.</p><div class="paste">Goal&nbsp;&nbsp;&nbsp;&nbsp;Owner&nbsp;&nbsp;&nbsp;&nbsp;Start&nbsp;&nbsp;&nbsp;&nbsp;Target…</div></div>
<div class="row between"><a>Copy the Goals headers</a><span class="btn primary">Check these rows</span></div></div></div>
${note('Wireframe 1. Import has one primary action, Choose a file; pasting is a second door into the same preview. The page says what a new row must have before anything is uploaded, where to get the template, the size it works to, and what was imported before. Today the page is three steps of prose, says nothing of required columns or size, and the template is on another page’s menu (I1, I2, I16).')}` });

/* 2. The preview: counts, Must fix, Check */
const COUNTS = [['Goals', 212, 26, 9, 1, 159, 17, 23], ['Plan', 180, 0, 4, 0, 176, 0, 0], ['Check-ins', 640, 600, 12, 0, 26, 2, 3], ['People', 40, 3, 1, 0, 36, 0, 1]];
SCREENS['02-preview'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
${head('Check this import', 'Nothing has been saved.')}
${fileLine('fy27-goals.xlsx · Read Goals, Plan, Check-ins and People. Not read: Results, Asks and README (for reading only); “Budget” (not a Faro sheet); the columns “Notes” and “RAG” on Goals.')}
${counts(COUNTS)}
<div class="sec"><h2 class="must-t">Must fix <span class="hint">19 rows, 3 kinds of problem</span></h2>
${must('14 rows name a team that isn’t here: <span class="found">“Platfrom”</span>', `<p class="hint">Goals, rows 18 to 31. The nearest team is Platform.</p><div class="acts"><span class="btn sm">Use Platform</span><span class="btn sm">Add Platfrom as a new team</span><span class="btn sm">Choose another team</span><a>Show the 14 rows</a></div>`)}
${must('3 new goals have no owner', `<p class="hint">Goals, rows 44, 51 and 52. A new goal needs Owner or Owner email. Fix these in the file.</p><div class="acts"><a>Show the 3 rows</a></div>`)}
${must('2 check-ins have text where a number goes', `<p class="hint">Check-ins, row 7: Value says “six”. Row 212: Value says “n/a”. Type digits only, like 29.</p><div class="acts"><a>Show the 2 rows</a></div>`)}
<div class="acts"><span class="btn sm">Download the 5 rows to fix</span><a>Leave these 5 rows out and save the rest</a></div>
</div>
<div class="sec"><h2>Check <span class="hint">3 questions cover 27 rows</span></h2>
${check('23 stages on 9 new goals are due before this week (week 46)', `<p class="hint">For example “Canary releases live”: Design, due week 2. As typed, these goals would start out late.</p><div class="opts">${rad('They’re done', false, 'Each is recorded as done in its due week, on time.')}${rad('They’re not done', false, 'They stay as typed and start out overdue.')}${rad('Count them from this week', false, 'Each keeps its gap from the first stage, starting in week 46.')}</div><a>Show the 23 stages</a>`)}
${check('3 check-ins are far from the last number', `<p class="hint">“CI cost per pipeline run”, week 46: 4.10 USD. Last week was 0.40.</p><div class="opts">${rad('They’re right', false)}${rad('Leave these 3 rows out', false)}</div><a>Show the 3 rows</a>`)}
${check('“Rhea Kapor” isn’t here. Did you mean Rhea Kapoor?', `<p class="hint">People, row 12: a new person, new email rhea.k@example.com, with almost the name of someone here (Rhea Kapoor, CI/CD).</p><div class="opts">${rad('The same person: give Rhea Kapoor this email', false)}${rad('Someone new called Rhea Kapor', false)}</div>`)}
</div>
<div class="foot"><span class="hint" style="flex:1 1 300px">5 rows must be fixed and 3 questions answered before this can be saved.</span><span class="btn primary">Choose the corrected file</span></div>
${note('Wireframe 2. The preview says first what was read and what was not, then counts by sheet, then what must be fixed grouped by kind of problem, then the questions. One answer covers every row with the same question. Today the same file gives “19 rows need fixing first” as nineteen boxes, fourteen of them the same sentence, in an order that is neither the file’s nor the problem’s (I3, I4, I9).')}` });

/* 3. A Check answered for many rows */
SCREENS['03-check-answered'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
${head('Check this import', 'Nothing has been saved.')}
${fileLine('fy27-goals.xlsx · Read Goals, Plan, Check-ins and People.')}
<div class="sec" style="margin-top:0"><h2>Must fix <span class="hint">answered here: 14 rows · left to fix: 0</span></h2>
<div class="grp"><h3><span>14 rows said “Platfrom”: read as <b>Platform</b></span></h3><div class="acts"><a>Change</a><a>Show the 14 rows</a></div></div>
<p class="hint">5 rows were left out at your choice. <a>Download them</a> · <a>Put them back</a></p></div>
<div class="sec"><h2>Check <span class="hint">3 of 3 answered</span></h2>
${check('23 stages on 9 new goals are due before this week (week 46)', `<div class="opts">${rad('They’re done', true, 'Each is recorded as done in its due week, on time.')}${rad('They’re not done', false, 'They stay as typed and start out overdue.')}${rad('Count them from this week', false, 'Each keeps its gap from the first stage, starting in week 46.')}</div><p class="hint">One answer for all 23. To answer differently for some, <a>show the 23 stages</a> and untick them.</p>`)}
<div class="grp"><h3><span>3 check-ins far from the last number: <b>they’re right</b></span></h3><div class="acts"><a>Change</a></div></div>
<div class="grp"><h3><span>“Rhea Kapor”: <b>the same person</b>, Rhea Kapoor gets the email rhea.k@example.com</span></h3><div class="acts"><a>Change</a></div></div>
</div>
<div class="sec"><h2>What will be saved</h2>
<p>24 goals added, 9 changed and 1 stopped; 4 plans changed; 600 check-ins added (588 for past weeks) and 12 replaced; 3 people added and 1 changed. 397 rows are unchanged and 5 are left out.</p><p><a>Show the 654 changes</a></p></div>
<div class="foot"><span class="btn">Choose another file</span><span class="btn primary">Save 654 changes</span></div>
${note('Wireframe 3. A question answered once closes to one line that says what was decided, with Change beside it. Rows left out are said, downloadable and can be put back. Save names the number it will save. Leaving rows out is an explicit choice, never the default (decision 1).')}` });

/* 4. The changes, and nothing would change */
const chg = (title, kind, rows) => `<li><span class="t"><b>${title}</b><span class="r">${kind}</span><dl class="diff">${rows.map(([f, a, b]) => `<dt>${f}</dt><dd>${a ? `<s>${a}</s> → ` : ''}${b}</dd>`).join('')}</dl></span></li>`;
SCREENS['04-changes'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
<div class="state"><span class="label">(a) The changes, on request</span>
${head('Check this import', 'Nothing has been saved.')}
<div class="bar"><span class="input">Find a goal, a person or a key</span><span class="row desk-only" style="gap:8px"><span class="btn sm on">All 654</span><span class="btn sm">Added 627</span><span class="btn sm">Changed 26</span><span class="btn sm">Stopped 1</span></span><span class="btn phone-only">Filter</span></div>
<p class="countline"><b>654 changes</b>, in the file’s order. Showing 1 to 50.</p>
<ul class="rows">
${chg('Lead time for changes <span class="hint">G-1</span>', 'Goals, row 2 · plan changed', [['Target', '24 hours', '20 hours'], ['Why', '', 'Agreed at the Q4 review']])}
${chg('Pipeline queue wait (p90) <span class="hint">G-14</span>', 'Check-ins, row 9 · replaces Rhea Kapoor’s check-in for week 46', [['Value', '7 min', '6 min']])}
${chg('Cache hit rate <span class="hint">new, will be G-127</span>', 'Goals, row 18 · added', [['Owner', '', 'Rhea Kapoor'], ['Team', '', 'CI/CD (her team; the row gave none)'], ['Type', '', 'Number (from Start and Target; the row gave none)'], ['Plan', '', '10% → 50%, straight, weeks 46 to 53']])}
${chg('Legacy deploy scripts retired <span class="hint">G-88</span>', 'Goals, row 40 · stopped', [['Reason', '', 'Replaced by the pipeline migration']])}
</ul><div style="margin-top:12px"><span class="btn">Show 50 more</span></div>
<div class="foot"><span class="btn">Back to the summary</span><span class="btn primary">Save 654 changes</span></div></div>
<div class="state"><span class="label">(b) A file exported and loaded straight back</span>
${head('Check this import', 'Nothing has been saved.')}
${fileLine('platform-engineering-goals-all-2026-11-11.xlsx · Read Goals, Plan, Check-ins and People. Not read: Results, Asks, Notes, Metrics and README (for reading only).')}
<div class="panel"><h2>Nothing would change</h2><p>All 5,570 rows say what Faro already says.</p>
<p class="hint">On 2 rows, Status or Now differ from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.</p></div>
<div class="foot"><span></span><span class="btn primary">Choose another file</span></div></div>
${note('Wireframe 4. The changes are shown on request, 50 at a time, each with what it was and what it will be, and with every default said (“her team; the row gave none”). A file that changes nothing says so in two words, and says when someone has typed into a worked-out column. Today an unedited export reads “1 plan changed”, an edited Status reads “Nothing in this file changes anything”, and 5,000 changes are drawn as 5,000 rows at once (I5, I7, I12).')}` });

/* 5. Saved with Undo; past imports */
SCREENS['05-saved-undo'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
<div class="state"><span class="label">(a) After saving</span>
${head('Imported', '')}
<div class="panel"><p class="lede">Saved 654 changes from fy27-goals.xlsx.</p>
<p class="hint">24 goals added, 9 changed and 1 stopped; 4 plans changed; 612 check-ins; 4 people. 5 rows were left out. <a>Download them</a></p>
<div class="row" style="margin-top:6px"><span class="btn primary">See the goals</span><span class="btn">Undo this import</span></div></div>
<p class="hint" style="margin-top:10px">Undo stays on Data, under Past imports, and on this import’s line in Activity.</p></div>
<div class="state"><span class="label">(b) Past imports (Data → Past imports)</span>
${head('Past imports', 'Every import, bulk edit and change through MCP, newest first. Whoever made one, or an admin, can undo it.')}
<ul class="rows">
<li><span class="t"><b>fy27-goals.xlsx</b><span class="r">Amara Nwosu · today, 10:04 · Spreadsheet · 654 changes: 24 goals added, 9 changed, 1 stopped, 612 check-ins, 4 people</span></span><span class="btn sm">Undo</span></li>
<li><span class="t"><b>Bulk edit on Data</b><span class="r">Grace Achterberg · 9 Nov · Data tables · 14 goals changed (Owner)</span></span><span class="btn sm">Undo</span></li>
<li><span class="t"><b>goals-q4-update.xlsx</b><span class="r">Amara Nwosu · 4 Nov · Spreadsheet · 12 goals changed, 38 check-ins</span><span class="r" style="display:block">3 of its 50 rows have changed since, so Undo would put back 47.</span></span><span class="btn sm">Undo 47 rows</span></li>
<li><span class="t"><b>Changes through MCP</b><span class="r">Tariq Haddad · 28 Oct · MCP · 3 check-ins</span><span class="r" style="display:block">Undone on 28 Oct by Tariq Haddad.</span></span></li>
</ul></div>
<div class="state"><span class="label">(c) Undo, when later work depends on it</span>
<div class="sheetbox"><h2>Undo goals-q4-update.xlsx?</h2>
<p style="margin:8px 0">47 rows go back to how they were on 4 Nov. 3 stay as they are, because they changed after the import:</p>
<ul class="rows"><li><span class="t"><b>Flaky test rate in the main pipelines</b><span class="r">Rhea Kapoor posted a check-in for week 46 on 10 Nov</span></span></li><li><span class="t"><b>Base image build time</b><span class="r">Its target was changed on 6 Nov</span></span></li><li><span class="t"><b>Pipeline queue wait (p90), week 44</b><span class="r">The check-in was corrected on 5 Nov</span></span></li></ul>
<div class="row between" style="margin-top:14px"><span class="btn">Cancel</span><span class="btn danger">Undo 47 rows</span></div></div></div>
${note('Wireframe 5. Saving ends on a page that says what was saved and offers Undo there. Every past import is one line on Data with who, when, how and what, and its Undo says before it runs which rows it can no longer put back and why. Today saving ends on a toast and the Goals page; Undo exists only on the import’s Activity entry, which sits above one entry for every row it wrote (I13, I14).')}` });

/* 6. A large file */
SCREENS['06-large'] = shell({ title: 'Import', cur: 'Data', who: 'amara', body: `${CSS}
<div class="state"><span class="label">(a) Reading a large file</span>
${head('Reading all-goals.csv', 'You can keep using Faro in another tab. Nothing is saved until you say so.')}
<div class="panel"><div class="steps2">
<div><span><b>Read the file</b> · 1 sheet, 30,000 rows</span><span class="hint">Done</span></div>
<div><span><b>Checking each row</b> · 18,400 of 30,000</span><span class="hint num">61%</span></div>
<div class="bar2"><i style="width:61%"></i></div>
<div><span class="hint">So far: 18,212 would be added, 0 changed, 188 must be fixed.</span><a>Stop</a></div>
</div></div></div>
<div class="state"><span class="label">(b) Checked, and too large to save here</span>
${head('Check this import', 'Nothing has been saved.')}
${fileLine('all-goals.csv · Read Goals.')}
${counts([['Goals', '30,000', '29,812', 0, 0, 0, 188, 0]])}
<div class="sec"><div class="grp"><h3><span style="color:var(--risk)">${mark}</span><span>This file would change 29,812 rows. Faro saves up to 5,000 at a time</span></h3>
<p class="hint">Faro is a model, and it checks and saves in your browser. Split the file by team or by sheet and import each part; every part has its own Undo.</p>
<div class="acts"><span class="btn sm">Download as 6 files of 5,000 rows</span></div></div></div>
<div class="sec"><h2 class="must-t">Must fix <span class="hint">188 rows, 1 kind of problem</span></h2>
${must('188 new goals have no owner', `<p class="hint">Goals, rows 4,832 to 5,019. A new goal needs Owner or Owner email. Fix these in the file.</p><div class="acts"><span class="btn sm">Download the 188 rows to fix</span><a>Show the first 50</a></div>`)}</div>
<div class="foot"><span class="hint" style="flex:1 1 300px">The problems and the changes are shown 50 at a time.</span><span class="btn primary">Choose another file</span></div></div>
${note('Wireframe 6. A large file is read and checked off the page’s own thread, with counts as it goes and a way to stop; what is found is drawn 50 rows at a time. The limit is said on the Import page before the upload and again here, with a way through. Measured today: 30,000 goals took 5 minutes 36 seconds with the page frozen twice for over 160 seconds, 1.5 GB of memory and a page 1.4 million pixels tall; 30,000 check-ins with one fault in 27,000 of them drew 27,000 boxes (I6).')}` });

/* 7. Export */
SCREENS['07-export'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', body: `${CSS}
<div class="state"><span class="label">(a) Export, from Goals → “Export these goals” and from Data → Export</span>
<div class="sheetbox"><div class="row between nowrap"><h2>Export</h2><span class="btn sm">Close</span></div>
<div class="field" style="margin-top:14px"><b>Which goals</b><div class="opts">${rad('The 8 shown now: Mine', true)}${rad('Everything in 2026', false, '126 goals, 5,347 check-ins, 97 people')}</div></div>
<p class="hint" style="margin:14px 0">An Excel workbook: Goals, Plan, Check-ins and People, which load back, and Results, Asks, Notes and Metrics for reading. Its first sheet says what each column means and which are required.</p>
<div class="row between"><a>Other formats</a><span class="btn primary">Export .xlsx</span></div>
<p class="note" style="margin-top:14px">platform-engineering-goals-mine-2026-11-11.xlsx · Exports hold names and owners’ reasons. Share them as you would the app.</p></div></div>
<div class="state"><span class="label">(b) “Other formats”, opened</span>
<div class="menu3"><div class="mi"><b>CSV files, zipped</b><span>The same sheets, one file each. They load back.</span></div><div class="mi"><b>One sheet as CSV</b><span>Goals, Plan, Check-ins, People, Results, Asks, Notes or Metrics.</span></div><div class="mi"><b>JSON</b><span>For scripts and AI tools. It doesn’t load back.</span></div><div class="mi"><b>A brief for an AI chat</b><span>Copy it, or save it as .md.</span></div></div></div>
<div class="state"><span class="label">(c) Data’s list bar: Export and Import, in place of the Spreadsheets menu</span>
<div class="bar"><span class="input">Find a check-in</span><span class="row desk-only" style="gap:8px"><span class="btn sm">Filters</span><span class="btn sm">Columns · 9 of 23</span><span class="btn sm">Saved layouts</span><span class="btn sm">Export</span><span class="btn sm">Import</span></span><span class="btn phone-only">Filter, columns and files</span></div>
<p class="countline"><b>212 check-ins match</b>, newest first.</p>
<div class="menu3"><div class="mi"><b>This table, as shown (.xlsx)</b><span>212 rows, 9 columns, plus ID, Goal key and Week so it loads back.</span></div><div class="mi"><b>This table, as shown (.csv)</b><span>The same rows and columns.</span></div><div class="mi"><b>Everything…</b><span>Opens Export.</span></div></div></div>
${note('Wireframe 7. Export is one sheet with one primary action wherever it is opened; the usual file is the default and the rest sit behind “Other formats”. On Data the Spreadsheets menu becomes two plain controls, Export and Import. Today the Goals sheet has seven buttons of equal weight, and Data’s menu mixes four ways out, a template and the way in (I15, I16).')}` });

/* 8. The field table, as Help and the template show it */
const ft = (rows) => `<table class="ft stackable"><thead><tr><th>Column</th><th>A new row</th><th>Format</th><th>Example</th><th>If it’s left empty</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td class="${r[1].startsWith('Required') ? 'req' : r[1] === 'Worked out' ? 'wo' : ''}">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}</tbody></table>`;
SCREENS['08-field-table'] = shell({ title: 'Help', cur: 'Help', who: 'rhea', width: 'wide', body: `${CSS}
<p class="hint" style="margin-bottom:6px"><a>‹ Help</a></p>
<div class="head"><div class="stack"><h1>Every column, and what it needs</h1><p class="hint">The same table is the first sheet of the template and of every workbook. The form for one goal asks for the same things.</p></div><span class="btn">Download the template</span></div>
<div class="tabs"><span class="cur">Goals<em>27</em></span><span>Plan<em>4</em></span><span>Check-ins<em>17</em></span><span>People<em>9</em></span><span>For reading only</span></div>
<p class="hint" style="margin-bottom:12px">One row per goal. A row with no Key is a new goal. A new goal needs the 2 columns marked Required, and the ones its type needs.</p>
${ft([
  ['Goal', 'Required', 'Text, 3 characters or more', 'Deploy lead time', 'Must fix: “Name the goal in the Goal column.”'],
  ['Owner <span class="hint">or</span> Owner email', 'Required', 'A name only one person has, or their email', 'ben.ortiz@example.com', 'Must fix: “A new goal needs an owner: Owner email, or Owner.”'],
  ['Type', 'Optional', 'metric, range or milestone', 'metric', 'Read from the row: Start and Target make a number goal, Limit a range, Stages a stages goal'],
  ['Start', 'Required for a number goal', 'A number', '5', 'Must fix: “Start is empty. A number goal needs where it starts.”'],
  ['Target', 'Required for a number goal', 'A number, different from Start', '1', 'Must fix: “Target is empty. A number goal needs a target.”'],
  ['Limit', 'Required for a range goal', 'A number', '5', 'Must fix: “Limit is empty. A range goal needs its limit.”'],
  ['Stages', 'Required for a stages goal', 'Name@week; Name@week', 'Design@48; Pilot@52', 'Must fix: “Stages is empty. A stages goal needs at least one stage.”'],
  ['Team', 'Optional', 'A team’s name', 'Platform', 'The owner’s team'],
  ['Level', 'Optional', 'north star, svp or team', 'team', 'team'],
  ['Unit', 'Optional', 'Text', 'days', 'No unit; the preview asks once'],
  ['Due week', 'Optional', 'A whole number of weeks from the year’s start', '53', 'The last week of the year'],
  ['Key', 'Leave empty', 'G-12', '', 'Faro gives the next key'],
  ['Status, Now, Gap…', 'Worked out', '', '', 'Never read. Leave them or delete them'],
])}
<p class="hint" style="margin-top:12px">14 more optional columns: <a>show them all</a>.</p>
${note('Wireframe 8. One table says, for every column, whether a new row must have it, its format, an example and what happens when it is empty. It is made from the same list as the form’s labels, the import’s preview and the template’s first sheet, so they cannot disagree. Today no screen, file or page says which columns are required; the README sheet’s 150 rows give each column’s meaning and nothing else (I1).')}` });

/* 9. Set-up's upload: the same preview */
SCREENS['09-setup-upload'] = shell({ bare: true, title: 'Set up', body: `${CSS}
<div style="max-width:620px;margin:0 auto;padding:8px 0 24px">
<div class="row between" style="margin-bottom:22px"><div><b>Set up · Field Operations</b><div class="hint">From a spreadsheet · Check</div></div><span class="btn sm">Close and keep the draft</span></div>
<h1 style="margin-bottom:10px">Check what the file brings</h1>
${fileLine('field-ops.xlsx · Read People and Goals. Not read: “Budget” (not a Faro sheet).')}
<ul class="rows"><li><span class="t"><b>People · 40 rows</b><span class="r">40 added, in 6 teams the file names</span></span></li><li><span class="t"><b>Goals · 31 rows</b><span class="r">28 added · 3 must fix · 9 to check</span></span></li></ul>
<div class="sec"><h2 class="must-t">Must fix <span class="hint">3 rows, 1 kind of problem</span></h2>
${must('3 goals are owned by people the file doesn’t add', `<p class="hint">Goals, rows 12, 13 and 20: Owner says “Dana Whitlock”, who isn’t on the People sheet. In a new workspace, the file is the only place people come from.</p><div class="acts"><span class="btn sm">Add Dana Whitlock</span><span class="btn sm">Give these 3 goals to me for now</span></div>`)}</div>
<div class="sec"><h2>Check <span class="hint">1 question covers 9 rows</span></h2>
${check('9 stages on 4 goals are due before this week (week 46)', `<div class="opts">${rad('Count them from this week', true, 'Nothing starts out late.')}${rad('They’re done', false)}${rad('They’re not done', false, 'They start out overdue.')}</div>`)}</div>
<p class="hint" style="margin-top:16px">Create the workspace is ready once the 3 rows above are answered.</p><div class="foot" style="margin-top:10px"><span class="btn">Back</span><span class="btn primary">Create the workspace</span></div>
</div>
${note('Wireframe 9. Set-up’s upload ends on the same preview, with the two things a first import needs: people come only from the file, so an owner it doesn’t add can be added there and then; and a stage already past starts from this week unless you say otherwise. Today set-up’s Check says “Goals: None yet… Each owner adds theirs” for a file with ten goal rows and eight faults, and shows the faults one at a time after Create workspace is pressed (I10).')}` });

kit.render(__dirname, SCREENS);
