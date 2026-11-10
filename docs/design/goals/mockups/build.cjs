/* Wireframes for the Goals page (docs/design/goals/README.md, spec.md section 2).
   Usage: node docs/design/goals/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, goal, note } = kit;

const CSS = `<style>
.frame{max-width:1040px}
.hw{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.hw .hint{white-space:nowrap}
.srow{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:1px solid var(--line);margin-bottom:16px}
.stabs{display:flex;gap:22px;margin-bottom:-1px;overflow-x:auto;scrollbar-width:none}
.stabs span{padding:10px 0;color:var(--muted);font-weight:600;white-space:nowrap}
.stabs em{font-style:normal;font-weight:400;margin-left:5px}
.stabs .cur{color:var(--fg);box-shadow:inset 0 -2px 0 var(--fg)}
.srow .btn{margin-bottom:6px}
.bar2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;position:relative}
.bar2 .input{flex:1 1 280px}
.bar2 .ctl{display:flex;gap:8px;flex-wrap:wrap}
.btn.dis{color:var(--faint);background:transparent}
.pbar{display:flex;flex-direction:column;gap:10px;margin-bottom:10px}
.pbar .r2{display:flex;justify-content:space-between;align-items:center;gap:8px}
.gh{margin:22px 0 8px}.gh .hint{margin-top:2px}
.lines{display:flex;flex-direction:column;gap:4px}
.team{margin:0 0 26px}
.team .th{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.team .th a{font-size:17px;font-weight:650}
.team .th span{color:var(--muted)}
.team .cs{display:flex;gap:6px 14px;flex-wrap:wrap;margin:4px 0 2px;font-size:14px}
.team .list{margin-top:10px}
.mn{position:relative}
.mp{position:absolute;z-index:3;top:46px;background:var(--surface);border:1px solid var(--line);border-radius:10px;width:300px;padding:6px 0}
.mp.l{left:0}.mp.r{right:0}
.mp .it{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;padding:9px 14px}
.mp .it+.it{border-top:1px solid var(--line-2)}
.mp .it b{display:block;font-weight:600}.mp .it span.h{display:block;color:var(--muted);font-size:14px;line-height:20px}
.mp .it.cur{outline:2px solid var(--fg);outline-offset:-2px;border-radius:8px}
.mp .cu{font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap}
.mp .hr{height:1px;background:var(--line);margin:4px 0}
.mp .it.act{color:var(--accent-text);font-weight:600}
.state{margin-bottom:34px}.state>.label{margin-bottom:8px;display:block}
.nogoals{padding:22px 0;display:flex;flex-direction:column;gap:6px}
.sheetp{display:flex;flex-direction:column;gap:20px;background:var(--surface);min-height:100vh;margin:-16px;padding:16px}
.sheetp .blk{display:flex;flex-direction:column;gap:4px}.sheetp .blk>b{font-weight:650;margin-bottom:2px}
.opt{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:8px 0;border-top:1px solid var(--line-2)}
.opt .ot{flex:1}.opt .ot b{display:block;font-weight:600}.opt .ot span{display:block;color:var(--muted);font-size:14px;line-height:20px}
.opt .cu{font-size:13px;font-weight:600;color:var(--muted)}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.sheetp .foot{margin-top:auto;border-top:1px solid var(--line);padding-top:14px}
.ctx2{display:block}
@media (max-width:700px){
 .top,.tabbar{display:none!important}
 .sheetp{min-height:0}
 .srow{margin-bottom:12px}
 .pbar .input{font-size:14px;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;line-height:44px}.pbar .bar .btn{padding:0 10px;font-size:14px}
}
@media (min-width:701px){.app{min-height:1000px}.note{max-width:700px}.sheet-only{display:none}}
.top-gone .top{}
</style>`;

const S = (k, n) => st(k, n);
const dot = ' · ';
const join = (a) => a.join(dot);
const tabs = (arr, right = true) => `<div class="srow"><div class="stabs">${arr.map(([t, n, c]) => `<span class="${c ? 'cur' : ''}">${t}<em>${n}</em></span>`).join('')}</div>${right ? '<span class="btn sm desk-only">Views</span>' : ''}</div>`;
const head = `<div class="head desk-only"><div class="hw"><h1>Goals</h1><span class="hint">Week 46 of 53 · Q4 (Oct–Dec) · 2026</span></div><span class="btn quiet">New goal</span></div>`;
/* The list bar. On a computer every control; on a phone search + Filter and sort, then the switch and the view. */
const bar = ({ attn = 'Needs attention · 4', on = false, group = 'Group: none', groupDis = false, sort = 'Sort: as grouped', layout = 'Layout: List', view = 'View: List' }) =>
  `<div class="bar2 desk-only"><span class="input">Find by name, owner, team or key</span><span class="ctl"><span class="btn ${on ? 'on' : ''}">${attn}</span><span class="btn">Filters</span><span class="btn ${groupDis ? 'dis' : ''}">${group}</span><span class="btn">${sort}</span><span class="btn">${layout}</span></span></div>` +
  `<div class="phone-only"><div class="pbar"><div class="bar" style="margin:0;flex-wrap:nowrap"><span class="input" style="min-width:0">Find by name, owner, team or key</span><span class="btn">Filter and sort</span></div><div class="r2"><span class="btn ${on ? 'on' : ''}">${attn}</span><span class="btn">${view}</span></div></div></div>`;
const count = (html) => `<p class="countline" role="status">${html}</p>`;
const ul = (rows) => `<ul class="list">${rows.join('')}</ul>`;
const SCREENS = {};

/* 1. Mine */
SCREENS['01-mine'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', views: [['Division at a glance', false], ['No update for 2 weeks or more', false], ['My goals by status', false]], body: `${CSS}<div class="frame">
${head}
${tabs([['Mine', 8, 1], ['My team', 17], ['Watching', 12], ['All', 126]])}
${bar({})}
${count(`<b>8 goals, worst first.</b> ${join([S('off', 2), S('risk', 2), S('none', 1), S('on', 2), S('done', 1)])}`)}
${ul([
  goal('off', 'Lead time for changes', 'Lead time is well above plan and the gap grew again this week.', '37 hours', '9 hours behind plan'),
  goal('off', 'Pipeline queue wait (p90)', 'G-18 · Waiting on the new runners.', '14 min', '6 min behind plan'),
  goal('risk', 'Flaky test rate in the main pipelines', 'G-7 · Two new flaky suites this week.', '1.8%', 'Near the 2.0% limit'),
  goal('risk', 'Base image build time', 'G-22 · Down from 14 minutes, still above plan.', '11 min', '1 min behind plan'),
  goal('none', 'CI cost per pipeline run', 'G-25 · Waiting for the first check-in.', 'No value yet', ''),
  goal('on', 'Merge-to-deploy time (median)', 'G-14 · Steady for three weeks.', '11 min', '1 min ahead of plan'),
  goal('on', 'Autoscaling CI runner pools', 'G-27 · Four of six pools are live.', '4 of 6 pools', 'On plan'),
  goal('done', 'Test suites split into parallel shards', 'G-9 · Finished in week 44.', '100%', 'Done in week 44'),
])}
${note('Wireframe 1. Goals as Rhea opens it: her own eight, worst first, with no trees to scroll past. Whose goals is the tab row; Needs attention is a button in the bar with its count; one line says how many and how they stand. On a phone the bar is search, “Filter and sort”, the switch and “View: List”. Today it opens on all 126 as trees (G1, G2).')}
</div>` });

/* 2. My team, needs attention */
SCREENS['02-team-attention'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', views: [['Division at a glance', false], ['No update for 2 weeks or more', false], ['My goals by status', false]], body: `${CSS}<div class="frame">
${head}
${tabs([['Mine', 8], ['My team', 17, 1], ['Watching', 12], ['All', 126]])}
${bar({ attn: 'Needs attention · 7', on: true, groupDis: true, group: 'Group', sort: 'Sort: as grouped', view: 'View: List' })}
<p class="hint desk-only" style="margin:-2px 0 10px">Needs attention has its own two groups.</p>
${count(`<b>7 need attention:</b> ${join([S('off', 2), S('risk', 4), S('on', 1)])}, flagged for getting worse. 3 being handled are listed below. <a>Why?</a>`)}
${count('First check-ins: 124 of 126 goals. <a>Why?</a>')}
<div class="gh" style="margin-top:6px"><h3>Needs attention · 7</h3></div>
${ul([
  goal('off', 'Lead time for changes', `G-1 · Rhea Kapoor · ${warn('Decision or help needed')}`, '37 hours', '9 hours behind plan'),
  goal('off', 'Pipeline queue wait (p90)', `G-18 · Tariq Haddad · Check-in overdue by 2 weeks`, '14 min', '6 min behind plan'),
  goal('risk', 'Flaky test rate in the main pipelines', `G-7 · Daniel Okafor · ${warn('Decision or help needed')}`, '1.8%', 'Near the 2.0% limit'),
  goal('risk', 'Base image build time', 'G-22 · Pavel Novák · Getting worse for 3 weeks', '11 min', '1 min behind plan'),
  goal('on', 'Merge-to-deploy time (median)', 'G-14 · Tunde Bakare · On track, flagged for getting worse', '11 min', '1 min ahead of plan'),
])}
<p class="hint" style="margin-top:8px">2 more at risk.</p>
<div class="gh"><h3>Being handled · 3</h3><p class="hint">Someone has agreed a next step with an owner and a date, or answered the request.</p></div>
${ul([
  goal('risk', 'Autoscaling CI runner pools', 'G-27 · Next step: Rhea, by week 47', '4 of 6 pools', '1 pool behind plan'),
  goal('off', 'Artifact cache hit rate', 'G-31 · Next step: Pavel Novák, by week 48', '58%', '12 points behind plan'),
  goal('risk', 'Runner start-up time', 'G-33 · Request answered by Rhea Kapoor on 7 Nov', '48 s', '8 s behind plan'),
])}
${note('Wireframe 2. “My team” with the Needs attention button pressed (a full outline, not a colour): its count follows the scope, and the two groups carry their own words. Group is quiet and says why. The old whole-division tab is gone; narrowing it was a filter on top of a tab (G3, G4).')}
</div>` });

/* 3. All, by team */
const teamBlock = (name, n, counts, obj, rows) => `<div class="team"><div class="th"><a>${name}</a><span>· ${n}</span></div><div class="cs">${counts.join('')}</div>${obj ? `<p class="hint">${obj}</p>` : ''}${ul(rows)}</div>`;
SCREENS['03-all-by-team'] = shell({ title: 'Goals', cur: 'Goals', who: 'amara', width: 'wide', views: [['Division at a glance', false], ['No update for 2 weeks or more', false], ['My goals by status', false]], body: `${CSS}<div class="frame">
${head}
${tabs([['My team', 3], ['Watching', 56], ['All', 126, 1]])}
${bar({ attn: 'Needs attention · 41', group: 'Group: by team', layout: 'Layout: List', view: 'View: List, by team' })}
${count(`<b>126 goals, by team.</b> ${join([S('off', 11), S('risk', 27), S('stale', 2), S('none', 2), S('on', 76), S('done', 8)])}`)}
${teamBlock('Build &amp; Release', 21, [S('off', 4), S('risk', 6), S('stale', 1), S('on', 9), S('done', 1)], '', [
  goal('off', 'Cut cold-start build time', 'G-31 · Tunde Bakare', '9.4 min', '3 min behind plan'),
  goal('risk', 'Release train cadence', 'G-26 · Pavel Novák', '9 of 12 trains', '1 train behind plan'),
  goal('on', 'Reproducible build rate', 'G-12 · Tunde Bakare', '97%', 'On plan'),
])}
${teamBlock('CI/CD', 17, [S('off', 2), S('risk', 4), S('stale', 1), S('on', 10)], 'Every change reaches production safely within the hour.', [
  goal('off', 'Lead time for changes', 'G-1 · Rhea Kapoor', '37 hours', '9 hours behind plan'),
  goal('risk', 'Flaky test rate in the main pipelines', 'G-7 · Daniel Okafor', '1.8%', 'Near the 2.0% limit'),
  goal('on', 'Merge-to-deploy time (median)', 'G-14 · Tunde Bakare', '11 min', '1 min ahead of plan'),
])}
${teamBlock('Developer Experience', 14, [S('off', 1), S('risk', 3), S('none', 1), S('on', 8), S('done', 1)], 'Developers spend their time on the product, not the tooling.', [
  goal('off', 'Reviewer lead time for pull requests', 'G-34 · Oskar Lindgren', '31 hours', '7 hours behind plan'),
  goal('none', 'CI cost per pipeline run', 'G-25 · Tariq Haddad', 'No value yet', ''),
])}
<p class="hint">11 more teams below.</p>
${note('Wireframe 3. All 126, grouped by team and worst first: each team is a link to its page with its own counts, its objective and its worst rows. Group is a choice of its own, not a separate set of tabs. The count line is about the rows under it (G2, G5).')}
</div>` });

/* 4. View sheet and menus */
const rd = (y) => `<span class="rd ${y ? 'y' : ''}"></span>`;
const opt = (t, h, y, cu) => `<div class="opt">${rd(y)}<span class="ot"><b>${t}</b>${h ? `<span>${h}</span>` : ''}</span>${cu ? '<span class="cu">Current</span>' : ''}</div>`;
const layouts = [['List', 'Rows, grouped as you choose'], ['Table', 'Columns you can sort, and changes to several goals at once'], ['Board', 'A column for each status'], ['History', 'Quarter results and week by week'], ['Map', 'The trees as a picture']];
const groups = [['As trees', 'Each top goal, then what feeds it'], ['By team', 'Teams worst first, each with its counts'], ['By level', 'North stars, then SVP, then team goals'], ['None', 'One list']];
const mitem = (t, h, cu) => `<div class="it ${cu ? 'cur' : ''}"><span><b>${t}</b>${h ? `<span class="h">${h}</span>` : ''}</span>${cu ? '<span class="cu">Current</span>' : ''}</div>`;
const deskState = (label, open, extraTabs) => `<div class="state desk-only"><span class="label">${label}</span>
${tabs([['Mine', 8], ['My team', 17], ['Watching', 12], ['All', 126, 1]])}
<div class="bar2"><span class="input">Find by name, owner, team or key</span><span class="ctl"><span class="btn">Needs attention · 41</span><span class="btn">Filters</span>
<span class="mn"><span class="btn ${open === 'group' ? 'on' : ''}">Group: as trees</span>${open === 'group' ? `<div class="mp l">${groups.map(([t, h], i) => mitem(t, h, i === 0)).join('')}</div>` : ''}</span>
<span class="btn">Sort: as grouped</span>
<span class="mn"><span class="btn ${open === 'layout' ? 'on' : ''}">Layout: List</span>${open === 'layout' ? `<div class="mp r" style="width:340px">${layouts.map(([t, h], i) => mitem(t, h, i === 0)).join('')}</div>` : ''}</span></span></div>
<div style="height:${open === 'layout' ? 330 : 280}px"></div></div>`;
const viewsState = `<div class="state desk-only"><span class="label">The Views menu, at the right of the scope tabs</span>
<div class="srow" style="position:relative"><div class="stabs"><span>Mine<em>8</em></span><span>My team<em>17</em></span><span>Watching<em>12</em></span><span class="cur">All<em>126</em></span></div><span class="mn" style="margin-bottom:6px"><span class="btn sm on">Views</span>
<div class="mp r" style="top:38px;width:320px">
${mitem('Division at a glance', 'Pinned', 0)}${mitem('No update for 2 weeks or more', 'Pinned', 0)}${mitem('My goals by status', '', 1)}
<div class="hr"></div><div class="it act">Save this view…</div><div class="it act">Copy link</div><div class="it act">Export these goals</div></div></span></div>
<div style="height:250px"></div></div>`;
SCREENS['04-view-sheet'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', body: `${CSS}<div class="frame">
${deskState('The Group menu, open under its button', 'group')}
${deskState('The Layout menu, open under its button', 'layout')}
${viewsState}
<div class="phone-only"><div class="sheetp">
<div class="row between nowrap"><h2>View</h2><span class="btn quiet">Close</span></div>
<div class="blk"><b>Layout</b>${layouts.map(([t, h], i) => opt(t, h, i === 0)).join('')}</div>
<div class="blk"><b>Group</b>${groups.map(([t], i) => opt(t, '', i === 0)).join('')}</div>
<div class="blk"><b>Saved views</b>
<div class="opt"><span class="ot"><b>Division at a glance</b></span></div>
<div class="opt"><span class="ot"><b>No update for 2 weeks or more</b></span></div>
<div class="opt"><span class="ot"><b>My goals by status</b></span><span class="cu">Current</span></div></div>
<div class="stack" style="gap:8px"><span class="btn block">Save this view…</span><span class="btn block">Copy link</span><span class="btn block">Export these goals</span></div>
<div class="foot"><span class="btn primary block">Done</span></div>
</div></div>
${note('Wireframe 4. On a phone the View sheet holds layout, group and saved views in one place; each choice applies at once and “Done” closes it. On a computer the same choices are three flat menus under their buttons, each item with its line and “Current” beside the chosen one. Today the phone has a layout menu and the computer a second set of tabs (G6, G7).')}
</div>` });

/* 5. From a team's page, and the empty states */
SCREENS['05-from-team-and-empty'] = shell({ title: 'Goals', cur: 'Goals', who: 'amara', width: 'wide', body: `${CSS}<div class="frame">
<div class="state"><span class="label">(a) Arriving from a team’s page: See its 17 goals</span>
${tabs([['My team', 3], ['Watching', 56], ['All', 126, 1]])}
${bar({ attn: 'Needs attention · 7', group: 'Group: as trees', view: 'View: List, as trees' })}
${count(`<b>17 goals match.</b> ${join([S('off', 2), S('risk', 4), S('stale', 1), S('on', 10)])}`)}
<p class="filters">Filtered by: Team CI/CD (<u>Remove</u>)</p>
${ul([
  goal('off', 'Lead time for changes', 'G-1 · Rhea Kapoor', '37 hours', '9 hours behind plan'),
  goal('risk', 'Flaky test rate in the main pipelines', 'G-7 · Daniel Okafor', '1.8%', 'Near the 2.0% limit'),
  goal('stale', 'Autoscaling CI runner pools', 'G-27 · Pavel Novák · Last check-in 3 weeks ago', '4 of 6 pools', ''),
])}</div>
<div class="state"><span class="label">(b) My team, for a team with no goals</span>
${tabs([['My team', 0, 1], ['Watching', 56], ['All', 126]])}
${bar({ attn: 'Needs attention · 0', view: 'View: List' })}
<div class="nogoals"><h2>No goals in Office of the VP yet.</h2><p><a>See all goals</a>${dot}<a>New goal</a></p></div></div>
<div class="state"><span class="label">(c) The switch on, with nothing to show (as Tunde, on Mine)</span>
${tabs([['Mine', 2, 1], ['My team', 21], ['Watching', 6], ['All', 126]])}
${bar({ attn: 'Needs attention · 0', on: true, groupDis: true, group: 'Group' })}
<div class="nogoals"><p class="strong">Nothing is off track, stale or slipping in your goals.</p></div></div>
${note('Wireframe 5. Three states. (a) Following “See its 17 goals” from a team lands on All with one filter, named in a line with “Remove”. (b) A team with no goals says so and offers two links. (c) With the switch on and nothing to show, one sentence says so. Today the first lands on the wrong tab and the others are an empty list (G8, G9).')}
</div>` });

kit.render(__dirname, SCREENS);
