/* Wireframes for the metric library (docs/design/metrics/README.md, spec.md section 2).
   Usage: node docs/design/metrics/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note, listBar } = kit;

const CSS = `<style>
.frame{max-width:1040px}
.chip{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600;font-size:14px;white-space:nowrap}
.rg{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.rg .goals{display:flex;gap:4px 14px;flex-wrap:wrap;justify-content:flex-end}
.rrow{display:flex;gap:12px;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.rrow b{font-weight:600}
.cols{display:flex;gap:12px;flex-wrap:wrap}.cols>*{flex:1 1 140px}
.unit{display:flex;gap:8px;align-items:center}.unit .input{min-width:0}
.meaning{max-width:720px}
.lab{display:flex;gap:8px;align-items:baseline;margin:0 0 8px}
.state{margin-bottom:36px}.state>.label{display:block;margin-bottom:10px}
.sec{display:flex;flex-direction:column;gap:10px}
.srow{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 16px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.menu2{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-top:6px}
.menu2 .it{padding:10px 14px}.menu2 .it+.it{border-top:1px solid var(--line-2)}
.menu2 .it.act{color:var(--accent-text);font-weight:600}
.nb{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:16px;display:flex;flex-direction:column;gap:12px;margin-top:12px}
.close{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.cw{overflow-wrap:anywhere}
.ta{align-items:flex-start;min-height:72px;padding-top:10px}
.sheetwrap{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px}
.pl{display:flex;flex-direction:column;gap:6px}
@media (max-width:700px){
 .top,.tabbar{display:none}
 .rg .goals{justify-content:flex-start}
 .close .btn{width:100%}
 .srow .btn{width:100%}
 .bar{flex-wrap:nowrap}.bar .input{min-width:0;flex:1 1 0}.bar .btn{flex:none}
 table.stackable td[data-l]:before{content:attr(data-l) ": ";color:var(--muted)}
 table.stackable td[data-l=Status]:before,table.stackable td[data-l=Goal]:before{content:none}
 .qb{margin-left:0!important}
}
</style>`;

const SCREENS = {};
const ul = (rows) => `<ul class="list">${rows.join('')}</ul>`;
const row = (name, line, right) => `<li><span class="t"><b>${name}</b><span>${line}</span></span><span class="r wide">${right}</span><span class="chev">›</span></li>`;
const rad = (t, on) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><b>${t}</b></div>`;

/* 1. Library */
const L = [
  ['Change failure rate', '% · lower is better · owned by Marisol Duarte', st('risk', 1)],
  ['CI compute cost per pipeline run', 'USD · lower is better · owned by Ethan Brooks', '<span class="hint">No goals yet</span>'],
  ['CI pipeline time on main (p90)', 'min · lower is better · owned by Daniel Okafor', st('on', 1)],
  ['Cloud cost per 1,000 requests', 'USD · lower is better · owned by Björn Halvorsen', st('on', 1)],
  ['Developer satisfaction (pulse)', 'pts · higher is better · owned by Ingrid Solberg', st('on', 1)],
  ['Flaky test rate', '% · lower is better · owned by Rhea Kapoor', st('risk', 1)],
  ['Lead time for changes', 'hours · lower is better · owned by Rhea Kapoor', st('off', 1)],
  ['Mean time to detect', 'min · lower is better · owned by Yuki Tanaka', st('on', 1)],
];
SCREENS['01-library'] = shell({ title: 'Metrics', cur: 'Metrics', who: 'oskar', body: `${CSS}
<div class="head"><div class="stack"><h1>Metrics</h1><p class="hint meaning">Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing.</p></div><span class="btn primary">Add a metric</span></div>
${listBar({ search: 'Find by name, unit, owner or meaning', extra: '<span class="chip">Unit: any</span><span class="chip">Used by: any team</span><span class="chip">Filters</span><span class="chip">Sort: A to Z</span>' })}
<p class="countline" role="status"><b>13 metrics, A to Z.</b></p>
${ul(L.map(([n, l, r]) => row(n, l, r)))}
${note('Wireframe 1. The library as Oskar sees it, in the menu beside People and open to everyone. A row says what the number is, which way is better, who owns it, and how its goals stand; no warnings, because he neither owns these nor is an admin. On a phone: search and “Filter and sort”, then rows of three lines. Today it is a button on Data with a name-only list (M1, M7).')}` });

/* 2. A metric */
const th = ['Status', 'Goal', 'For', 'Now', 'Target', 'Against plan', 'Owner'];
const tr = (s, g, key, f, now, tg, ag, o) => `<tr><td data-l="Status">${s}</td><td data-l="Goal"><a class="strong">${g}</a><br><span class="hint">${key}</span></td><td data-l="For">${f}</td><td data-l="Now" class="num">${now}</td><td data-l="Target">${tg}</td><td data-l="Against plan">${ag}</td><td data-l="Owner">${o}</td></tr>`;
SCREENS['02-metric'] = shell({ title: 'Pipeline queue wait (p90)', cur: 'Metrics', who: 'rhea', width: 'wide', body: `${CSS}<div class="frame">
<p style="margin-bottom:10px"><a>‹ Metrics</a></p>
<div class="head"><div class="stack"><h1>Pipeline queue wait (p90)</h1><p class="hint">min, whole numbers · lower is better · owned by <a>Rhea Kapoor</a></p></div><span class="btn primary">See its 2 goals</span></div>
<div class="sec meaning" style="margin-bottom:28px"><h2>What it means and how it’s calculated</h2>
<p>How long a pipeline job waits for a runner, from the moment it is queued to the moment it starts, at the 90th percentile over the week. It counts every job on main and on merge requests. Time spent waiting for another job to finish first is left out.</p></div>
<div class="sec" style="margin-bottom:28px"><h2>Goals measured by it · 2</h2>
<table class="stackable"><thead><tr>${th.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${tr(st('off'), 'Pipeline queue wait (p90)', 'G-14', 'CI/CD', '7 min', '5 min by week 53', '3 min behind plan', 'Rhea Kapoor')}
${tr(st('on'), 'Runner pool wait for release builds', 'G-61', 'Build &amp; Release', '4 min', '4 min by week 53', 'On plan', 'Pavel Novák')}
</tbody></table>
<p class="hint">Lowest now: Build &amp; Release, 4 min. Highest: CI/CD, 7 min.</p></div>
<dl class="facts" style="margin-bottom:28px;max-width:720px">
<dt>Where the number comes from</dt><dd>Not said</dd>
<dt>Who owns that source</dt><dd>Not said</dd>
<dt>How often it refreshes</dt><dd>Weekly</dd>
<dt>Caveats</dt><dd>Weeks with a runner outage are marked, not removed.</dd>
<dt>Added</dt><dd>by Rhea Kapoor on 14 July 2026</dd>
<dt>Last changed</dt><dd>by Rhea Kapoor on 2 October 2026</dd></dl>
<div class="sec" style="margin-bottom:28px;max-width:720px"><h2>To sort out</h2>
<div class="srow"><span>${warn('No source named')}</span><span class="btn">Say where the number comes from</span></div></div>
<div class="sec" style="max-width:720px"><span class="label">For Rhea and admins</span>
<div class="row"><span class="btn">Change this metric</span><span class="btn quiet qb" style="margin-left:24px">Remove this metric…</span></div></div>
${note('Wireframe 2. A metric as its owner sees it, drawn with two goals. The page leads with what it exists for: every team’s goal on the number side by side, each with its status, its slice, where it stands and its plan, then the plain sentence that compares them. “To sort out” shows only to the owner and admins. Today the page lists goal links with “Used by” and nothing more (M2, M6). On a phone each goal becomes a short stack.')}</div>` });

/* 3. Measured by */
const stepsBar = `<div class="close"><div class="steps" style="margin:0"><span>1 What</span><span>2 Who and where</span><span class="cur">3 How it’s measured</span><span>4 Check</span></div><span class="btn sm">Close and keep the draft</span></div>`;
SCREENS['03-measured-by'] = shell({ title: 'New goal', cur: 'New goal', who: 'rhea', width: 'narrow', body: `${CSS}
${stepsBar}
<div class="state"><span class="label">(a) A metric chosen</span>
<div class="stack" style="gap:18px">
<div class="field"><b>Measured by</b><div class="row nowrap" style="gap:8px"><span class="input filled">Pipeline queue wait (p90)</span><span class="btn">Change</span></div>
<p class="hint">How long a pipeline job waits for a runner, from the moment it is queued to the moment it starts, at the 90th percentile over the week. It counts every job on main and on merge requests. <a>Read more</a></p>
<p class="hint">min, whole numbers, lower is better: from the metric. <a>Use different ones</a></p></div>
<div class="field"><b>For</b><div class="pl">${rad('CI/CD', true)}${rad('The whole company', false)}</div></div>
<div class="cols"><div class="field"><b>Today (week 46)</b><div class="unit"><span class="input">&nbsp;</span><span>min</span></div></div><div class="field"><b>Target (week 53)</b><div class="unit"><span class="input">&nbsp;</span><span>min</span></div></div></div>
</div></div>
<div class="state"><span class="label">(b) Adding one in place</span>
<div class="field"><b>Measured by</b><span class="input focus filled">runner wait</span>
<div class="menu2"><div class="it hint">None match “runner wait”.</div><div class="it act">Add “runner wait” as a new metric</div></div>
<div class="nb"><h3>A new metric</h3>
<div class="field"><b>Name</b><span class="input filled">Runner wait</span></div>
<div class="field"><b>Unit</b><span class="input filled">min</span></div>
<div class="field"><b>Which way is better</b><div class="pl">${rad('Lower is better', true)}${rad('Higher is better', false)}</div></div>
<div class="field"><b>What it means <span class="hint" style="font-weight:400">· optional</span></b><span class="input">&nbsp;</span></div>
<div class="row"><span class="btn primary">Add this metric</span><span class="btn">Cancel</span></div></div></div></div>
${note('Wireframe 3. New goal’s measure step, in two states. The goal’s number is chosen by finding it, and choosing it sets the unit, decimals and direction, so the form asks for today and the target only. When there is no match, adding one happens where you are, without losing the draft. Today it is a select of every metric, placed before the team is chosen (M3, M4).')}` });

/* 4. Form and remove */
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
SCREENS['04-form-remove'] = shell({ title: 'Add a metric', cur: 'Metrics', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) Add a metric</span>
<div class="fhead" style="margin-bottom:18px"><h1>Add a metric</h1><span class="btn sm">Close and keep the draft</span></div>
<div class="stack" style="gap:18px">
${fl('Name', `<span class="input filled">CI cost per pipeline run</span><p class="hint cw" role="status">This looks like “CI compute cost per pipeline run” (USD, lower is better, owned by Ethan Brooks). Use that one, or carry on if yours is different. <a>Use that one</a></p>`)}
${fl('What it means and how it’s calculated', `<span class="input ta">&nbsp;</span><p class="hint">What is counted, from when to when, and what is left out.</p>`, 'optional')}
${fl('Unit', `<span class="input bad">&nbsp;</span><p class="hint">As it follows a number: hours, %, USD, deploys</p><p class="err">Give the unit.</p>`)}
${fl('Decimal places', `<span class="input filled">0</span>`)}
${fl('Which way is better', `<div class="pl">${rad('Lower is better', false)}${rad('Higher is better', false)}</div>`)}
${fl('Where the number comes from', `<span class="input">&nbsp;</span><p class="hint">A dashboard, a query, a report</p>`, 'optional')}
${fl('Who owns that source', `<span class="input">&nbsp;</span>`, 'optional')}
${fl('How often it refreshes', `<span class="input filled">Not said</span>`)}
${fl('Owner', `<span class="input filled">Rhea Kapoor</span>`)}
${fl('Caveats', `<span class="input ta">&nbsp;</span>`, 'optional')}
<div><span class="btn primary">Add the metric</span></div>
</div></div>
<div class="state"><span class="label">(b) Remove a metric</span>
<div class="sheetwrap"><div class="sheet" style="margin:16px auto">
<h2>Remove “Pipeline queue wait (p90)”?</h2>
<p>2 goals stop being measured by it: Pipeline queue wait (p90) and Runner pool wait for release builds. They keep their numbers and plans.</p>
<p class="hint">You can put it back for 30 days from Recently removed.</p>
<div class="row"><span class="btn danger">Remove the metric</span><span class="btn">Cancel</span></div></div></div></div>
${note('Wireframe 4. (a) Adding a metric: one column, the required three (name, unit, which way is better) first, the optional definition and source after, and a calm question when the name is close to one that exists; it never blocks saving. (b) Removing says what happens to the goals and that it can be put back. Today removal is one red press with no word on what follows (M5, M8).')}` });

/* 5. Sort out */
const sr = (name, line, right) => `<li><span class="t"><b>${name}</b><span>${line}</span></span><span class="r wide"><span class="rg"><span class="goals">${right[0]}</span>${right[1]}</span></span><span class="chev">›</span></li>`;
SCREENS['05-sort-out'] = shell({ title: 'Metrics', cur: 'Metrics', who: 'amara', body: `${CSS}
<div class="head"><div class="stack"><h1>Metrics</h1><p class="hint meaning">Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing.</p></div><span class="btn primary">Add a metric</span></div>
${listBar({ search: 'Find by name, unit, owner or meaning', extra: '<span class="chip">Unit: any</span><span class="chip">Used by: any team</span><span class="chip">Filters</span><span class="chip">Sort: A to Z</span>' })}
<p class="filters">Filtered by: Something to sort out (<u>Remove</u>)</p>
<p class="countline" role="status"><b>3 metrics match.</b></p>
${ul([
  sr('CI compute cost per pipeline run', 'USD · lower is better · owned by Ethan Brooks', ['<span class="hint">No goals yet</span>', warn('No goal uses it')]),
  sr('Runner wait', 'min · lower is better · owned by Rhea Kapoor', [st('on', 1), `<span>${warn('No meaning yet')} and 1 more</span>`]),
  sr('Time to first review', 'hours · lower is better · no owner', [st('risk', 1), warn('Its owner has left')]),
])}
<div class="sec" style="margin-top:32px;max-width:620px"><span class="label">On Workspace → About, for admins</span>
<div class="panel"><div class="srow" style="border:0;padding:0;background:none"><div class="stack" style="gap:2px"><b>1 metric has no owner</b><span class="hint">An owner keeps a metric’s meaning true.</span></div><span class="btn">See them</span></div></div></div>
${note('Wireframe 5. Amara, an admin, filters the library to what needs sorting out; each row ends with the first thing wrong, in words, and the owner sees the same on their own metrics. Under it, the one place a need reaches Workspace. Everyone else sees none of these. Today a thin or orphaned metric looks like a full one (M6).')}` });

kit.render(__dirname, SCREENS);
