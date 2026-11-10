/* Wireframes for Find, sort, filter and pick (docs/design/find/README.md).
   Usage: node docs/design/find/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, shell, goal, note } = kit;

const CSS = `<style>
.btn.phone-only,.row.phone-only{display:none}
.pk{margin:0;padding:0;list-style:none}.pk li{display:flex;gap:12px;align-items:center;padding:10px 14px;min-height:56px}.pk li+li{border-top:1px solid var(--line-2)}
.pk .pt{flex:1;min-width:0;display:flex;flex-direction:column}.pk .l1{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;font-weight:600}.pk .l2{color:var(--muted);font-size:14px;line-height:20px}
.pk li.cur{outline:2px solid var(--fg);outline-offset:-2px;border-radius:8px}.pk li.dis .l1>b{color:var(--muted)}.pk li.act{min-height:44px}.pk li.act .l1{font-weight:600;color:var(--accent-text)}
.pop{border:1px solid var(--line);border-radius:10px;background:var(--surface)}.pop .in{padding:12px}.pop .in .input{min-width:0}
.pop .stat{padding:2px 14px 8px;color:var(--muted);font-size:14px}.pop .lab{padding:4px 14px 6px;font-size:12px;font-weight:600;color:var(--muted)}
.input .cursor{display:inline-block;width:1px;height:18px;background:var(--fg);margin-left:1px}
.sheetr{position:absolute;top:0;right:0;bottom:0;width:420px;z-index:2;background:var(--surface);border-left:1px solid var(--line);display:flex;flex-direction:column}
.sheetr .in{padding:20px;display:flex;flex-direction:column;gap:22px;flex:1}.sheetr .foot{border-top:1px solid var(--line);padding:14px 20px;display:flex;flex-direction:column;gap:6px;background:var(--surface)}
.scrim{position:absolute;inset:0;z-index:1;background:rgba(24,54,56,.22)}.app.rel{position:relative}
.blk{display:flex;flex-direction:column;gap:8px}.blk>b{font-weight:650}
.opt{display:flex;gap:10px;align-items:center;min-height:36px}.opt .st{font-weight:600}
.cb{width:18px;height:18px;border:1.6px solid var(--fg);border-radius:4px;flex:none;display:inline-flex;align-items:center;justify-content:center}.cb.y{background:var(--fg)}
.rd{width:18px;height:18px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.chosen{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;border-bottom:1px solid var(--line-2)}
.fld{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.fld.ph{color:var(--faint)}.fld a{font-weight:600}
.sheetc{position:absolute;top:72px;left:50%;margin-left:-320px;width:640px;z-index:2;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 0 0;overflow:hidden}
.hintfoot{border-top:1px solid var(--line);padding:10px 16px;color:var(--muted);font-size:13px}
.grp{padding:10px 16px 4px;font-size:12px;font-weight:600;color:var(--muted);border-top:1px solid var(--line-2)}.grp.first{border-top:0}
.seeall{padding:8px 16px 12px;font-weight:600}
.two{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
.state{margin-bottom:34px}.state>.label{margin-bottom:8px;display:block}
.none{padding:28px 0;display:flex;flex-direction:column;gap:6px}
.gt{display:flex;flex-direction:column;gap:6px}
@media (max-width:700px){
 .top,.tabbar{display:none!important}.btn.phone-only{display:inline-flex!important}.row.phone-only{display:flex!important}
 .sheetr,.sheetc{position:static;width:auto;margin:0;border:0;border-radius:0;top:auto}.sheetr .in{padding:0}.sheetr .foot{padding:14px 0 0;border-top:1px solid var(--line)}.sheetr .in,.sheetr{gap:16px}
 .scrim,.behind{display:none}.two{grid-template-columns:1fr;gap:24px}.sheetc{padding-top:4px}.hintfoot{padding-left:0}
 .fullsheet .ctx{display:none}.fullsheet .pop{border:0;border-radius:0}.fullsheet .pop .in{padding:12px 3px}.fullsheet .pop .stat,.fullsheet .pop .lab{padding-left:0}.fullsheet .pk li{padding-left:0;padding-right:0}
}
@media (min-width:701px){.phone-block{display:none}.app{min-height:1000px}.note{max-width:700px}}
.app{position:relative}
</style>`;

const tick = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 7.4l2.8 2.8L11 4.4" fill="none" stroke="#fff" stroke-width="2"/></svg>';
const cb = (y) => `<span class="cb ${y ? 'y' : ''}">${y ? tick : ''}</span>`;
const rd = (y) => `<span class="rd ${y ? 'y' : ''}"></span>`;
const av = (i) => `<span class="av sm">${i}</span>`;
/** A two-line picker row. l1 is already HTML. */
const prow = (lead, l1, l2, cls = '', right = '') => `<li class="${cls}">${lead}<span class="pt"><span class="l1">${l1}</span><span class="l2">${l2}</span></span>${right}</li>`;
const pperson = (i, n, l2, cls = '') => prow(av(i), `<b>${n}</b>`, l2, cls);
const pgoal = (k, t, l2, cls = '') => prow('', `${st(k)}<b>${t}</b>`, l2, cls);

/* The bar of a Goals page, used behind the sheet and in wireframe 6. */
const goalsBar = (q, n) => `<div class="bar"><span class="input ${q ? 'filled' : ''}">${q || 'Find by name, owner, team or key'}</span>
<span class="row desk-only" style="gap:8px;flex-wrap:nowrap"><span class="btn">Team: every team</span><span class="btn">Status: any</span><span class="btn">Filters${n ? ' · ' + n : ''}</span><span class="btn">Sort: worst first</span><span class="btn">Group</span><span class="btn">Layout</span></span>
<span class="btn phone-only">Filter and sort${n ? ' · ' + n : ''}</span></div>`;

const change = (i, who, what, goalT, key, when, line2) => `<li>${av(i)}<span class="pt"><span class="l1" style="font-weight:400"><span><b>${who}</b> ${what} <b>${goalT}</b> (${key})</span></span>${line2 ? `<span class="l2">${line2}</span>` : ''}</span><span class="hint" style="white-space:nowrap">${when}</span></li>`;

const SCREENS = {};

/* 1. The list bar, on Activity */
SCREENS['01-list-bar'] = shell({ title: 'Activity', cur: 'Activity', who: 'rhea', width: 'wide', body: `${CSS}
<div class="head"><div class="stack"><h1>Activity</h1></div></div>
<div class="bar"><span class="input">Find by person, goal, key or what was said</span>
<span class="row desk-only" style="gap:8px;flex-wrap:nowrap"><span class="btn">When: any time</span><span class="btn">Kind: every kind</span><span class="btn">Filters · 1</span><span class="btn">Sort: newest first</span></span>
<span class="btn phone-only">Filter and sort · 1</span></div>
<p class="countline" role="status">54 changes match.</p>
<p class="filters">Filtered by: Who Tunde Bakare (<u>Remove</u>)</p>
<ul class="list pk">
${change('TB', 'Tunde Bakare', 'checked in on', 'Merge-to-deploy time (median)', 'G-14', 'Today, 09:12', 'At risk. 14 min against a target of 12.')}
${change('TB', 'Tunde Bakare', 'said what is in the way on', 'Flaky test rate in the main pipelines', 'G-7', 'Yesterday, 16:40', 'Waiting on the new runners.')}
${change('TB', 'Tunde Bakare', 'changed the owner of', 'Cut cold-start build time', 'G-31', 'Yesterday, 11:05', 'From Pavel Novák to Tunde Bakare.')}
${change('TB', 'Tunde Bakare', 'added a next step to', 'Lead time for changes', 'G-1', '6 Nov, 14:22', 'Ask Rhea to review the cache plan.')}
${change('TB', 'Tunde Bakare', 'checked in on', 'Pipeline queue wait (p90)', 'G-18', '6 Nov, 09:48', 'On track. 6 min against a target of 8.')}
${change('TB', 'Tunde Bakare', 'moved', 'Release train cadence', 'G-26', '5 Nov, 17:30', 'Feeds into Lead time for changes now.')}
${change('TB', 'Tunde Bakare', 'checked in on', 'Merge-to-deploy time (median)', 'G-14', '30 Oct, 09:10', 'Off track. 19 min against a target of 12.')}
</ul>
<div class="row between" style="margin-top:14px"><span class="hint">1 to 50 of 54</span><span class="btn">Next 4</span></div>
${note('Wireframe 1. The list bar on Activity: search first, When and Kind in the bar, Filters with a count, one Sort, then the count line and the filter line in plain words with “Remove” (no capsules). On a phone the three become “Filter and sort · 1”. Today Activity has its own dialog and wording.')}` });

/* 2. The Filters sheet */
const sortOpts = ['Worst first', 'Name, A to Z', 'Owner', 'Team'].map((s, i) => `<div class="opt">${rd(i === 0)}<span>${s}</span></div>`).join('');
SCREENS['02-filters'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', body: `${CSS}
<div class="behind"><div class="head"><div class="stack"><h1>Goals</h1></div></div>
${goalsBar('', 2)}
<p class="countline" role="status">17 goals match.</p>
<p class="filters">Filtered by: Status Off track or At risk (<u>Remove</u>) · Team CI/CD (<u>Remove</u>) · <u>Clear filters</u></p>
<ul class="list">
${goal('off', 'Flaky test rate in the main pipelines', 'G-7 · Rhea Kapoor · CI/CD', '6.2%', 'target 2%')}
${goal('risk', 'Merge-to-deploy time (median)', 'G-14 · Rhea Kapoor · CI/CD', '14 min', 'target 12 min')}
${goal('risk', 'Lead time for changes', 'G-1 · Rhea Kapoor · CI/CD', '3.1 days', 'target 2 days')}
</ul></div>
<div class="scrim"></div>
<div class="sheetr"><div class="in">
<div class="row between nowrap"><h2>Filter goals</h2><span class="btn quiet">Close</span></div>
<div class="blk phone-block"><b>Sort</b>${sortOpts}</div>
<div class="blk"><b>Status</b>
<div class="opt">${cb(1)}${st('off')}</div><div class="opt">${cb(1)}${st('risk')}</div><div class="opt">${cb(0)}${st('stale')}</div><div class="opt">${cb(0)}${st('on')}</div><div class="opt">${cb(0)}${st('done')}</div></div>
<div class="blk"><b>Team</b><div class="chosen"><span>CI/CD</span><a>Remove</a></div><div class="fld ph"><span>Add another team</span></div></div>
<div class="blk"><b>Owner</b><div class="fld ph"><span>Choose a person</span></div></div>
<div class="blk"><b>Needs attention because</b>
<div class="opt">${cb(0)}<span>Decision or help needed</span></div><div class="opt">${cb(0)}<span>Check-in overdue</span></div><div class="opt">${cb(0)}<span>Next step overdue</span></div></div>
<div class="blk"><b>In the tree of</b><div class="fld ph"><span>Choose a goal</span></div></div>
</div><div class="foot"><span class="btn primary">Show 17 goals</span><span class="btn quiet">Clear filters</span></div></div>
${note('Wireframe 2. One Filters sheet for every list: short fixed lists are tick boxes, lists that grow (team, owner, goal) are find-and-pick with the chosen ones as rows with “Remove”. It applies as you choose and the button says what you will get. On a phone it is full screen and Sort is its first block. Today Goals, Activity, Data and Feedback each have a different dialog.')}` });

/* 3. Find-and-pick: a person */
SCREENS['03-pick-person'] = shell({ title: 'Edit goal', cur: 'Goals', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="fullsheet">
<div class="phone-block" style="display:none"></div>
<div class="row between nowrap phone-only" style="margin-bottom:8px"><h2>Owner</h2><span class="btn quiet">Close</span></div>
<div class="ctx stack" style="gap:22px;margin-bottom:22px">
<div class="field"><span class="label">Closed, with a person chosen</span><b>Owner · checks in weekly</b><div class="fld"><span>Rhea Kapoor · CI/CD</span><a>Change</a></div></div>
<span class="label">Open, before typing</span></div>
<div class="field"><b class="ctx">Owner · checks in weekly</b>
<div class="pop"><div class="in"><span class="input focus" style="color:var(--faint)">Find by name, job title or team</span></div>
<div class="lab">Suggested</div>
<ul class="pk">
${pperson('RK', 'Rhea Kapoor (you)', 'Engineering Manager, CI/CD · CI/CD')}
${pperson('AS', 'Aiko Suzuki', 'Senior Software Engineer · CI/CD', 'cur')}
${pperson('DR', 'Diego Ramírez', 'Software Engineer · CI/CD')}
${pperson('FA', 'Femi Adebayo', 'Release Engineer · CI/CD')}
${pperson('IO', 'Imani Okoye', 'Software Engineer · CI/CD')}
${pperson('DO', 'Daniel Okafor', 'Staff Software Engineer · Developer Experience')}
</ul></div></div></div>
${note('Wireframe 3. The person picker before typing: it suggests you, your team and who you chose lately, and the arrow keys move the outlined row. On a phone the same panel is a full sheet titled “Owner”. Today this is a select of 97 people in directory order.')}` });

/* 4. Find-and-pick: a goal and a metric, while typing */
SCREENS['04-pick-goal-metric'] = shell({ title: 'Edit goal', cur: 'Goals', who: 'rhea', width: 'wide', body: `${CSS}
<div class="two">
<div class="field"><b>Feeds into</b>
<div class="pop"><div class="in"><span class="input focus filled">lead<span class="cursor"></span></span></div>
<div class="stat" role="status">4 match</div>
<ul class="pk">
${prow('', '<b>Nothing: top of its own tree</b>', 'Nothing above this goal.', '')}
${pgoal('risk', 'Lead time for changes', 'G-1 · Rhea Kapoor · CI/CD', 'cur')}
${pgoal('off', 'Cut lead time in Build &amp; Release', 'G-9 · Tunde Bakare · Build &amp; Release')}
${pgoal('on', 'Reviewer lead time for pull requests', 'G-31 · Oskar Lindgren · Developer Experience')}
${pgoal('risk', 'Lead time for the main pipelines', 'Feeds this goal already', 'dis')}
</ul></div></div>
<div class="field"><b>Measured by</b>
<div class="pop"><div class="in"><span class="input focus filled">queue wait<span class="cursor"></span></span></div>
<div class="stat" role="status">1 matches</div>
<ul class="pk">
${prow('', '<b>No metric</b>', 'This goal is not measured by a metric.')}
${prow('', '<b>Pipeline queue wait (p90)</b>', 'min · lower is better · owned by Rhea Kapoor · 1 goal', 'cur')}
${prow('', '<b>Add “queue wait” as a new metric</b>', 'Opens the metric form with this name.', 'act')}
</ul></div></div>
</div>
${note('Wireframe 4. Two pickers while typing: the count in words, status as shape and word on goals, and a row the rule refuses shown but not selectable, with the rule’s own words. The metric picker ends in “Add … as a new metric”. Today both are plain selects of 127 goals and every metric.')}` });

/* 5. Find from anywhere */
SCREENS['05-find'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', body: `${CSS}
<div class="behind"><div class="head"><div class="stack"><h1>Goals</h1></div></div>
${goalsBar('', 0)}
<p class="countline">126 goals, worst first.</p>
<ul class="list">
${goal('off', 'Flaky test rate in the main pipelines', 'G-7 · Rhea Kapoor · CI/CD', '6.2%', 'target 2%')}
${goal('risk', 'Lead time for changes', 'G-1 · Rhea Kapoor · CI/CD', '3.1 days', 'target 2 days')}
${goal('on', 'Pipeline queue wait (p90)', 'G-18 · Tunde Bakare · Build &amp; Release', '6 min', 'target 8 min')}
</ul><div style="height:520px"></div></div>
<div class="scrim"></div>
<div class="sheetc">
<div class="in" style="padding:0 14px 12px;display:flex;gap:8px;align-items:center"><span class="input focus filled" style="min-width:0">rhea<span class="cursor"></span></span><span class="btn quiet phone-only">Close</span></div>
<div class="grp first">Goals · 8</div>
<ul class="pk">
${pgoal('off', 'Flaky test rate in the main pipelines', 'G-7 · Rhea Kapoor · CI/CD', 'cur')}
${pgoal('risk', 'Lead time for changes', 'G-1 · Rhea Kapoor · CI/CD')}
${pgoal('risk', 'Merge-to-deploy time (median)', 'G-14 · Rhea Kapoor · CI/CD')}
</ul><div class="seeall"><a>See all 8 goals</a></div>
<div class="grp">People · 1</div>
<ul class="pk">${pperson('RK', 'Rhea Kapoor (you)', 'Engineering Manager, CI/CD · CI/CD')}</ul>
<div class="grp">Teams · 1</div>
<ul class="pk">${prow('', '<b>CI/CD</b>', 'Led by Rhea Kapoor · 7 people')}</ul>
<div class="grp">Metrics · 3</div>
<ul class="pk">
${prow('', '<b>Pipeline queue wait (p90)</b>', 'min · lower is better · owned by Rhea Kapoor · 1 goal')}
${prow('', '<b>Build duration (median)</b>', 'min · lower is better · owned by Rhea Kapoor · 2 goals')}
${prow('', '<b>Flaky test rate</b>', '% · lower is better · owned by Rhea Kapoor · 1 goal')}
</ul>
<div class="hintfoot">Enter opens the first · Esc closes</div></div>
${note('Wireframe 5. Find from anywhere (Ctrl K, or “Find” in the sidebar and the phone’s top bar): one field over goals, people, teams and metrics, three rows a group, “See all 8 goals” opens Goals with the search filled in. Today only a few pages search, and none from where you are.')}` });

/* 6. Nothing found, and a near miss */
SCREENS['06-none'] = shell({ title: 'Goals', cur: 'Goals', who: 'rhea', width: 'wide', body: `${CSS}
<div class="head"><div class="stack"><h1>Goals</h1></div></div>
<div class="state"><span class="label">A. Nothing matches</span>
${goalsBar('zzzz', 0)}
<div class="none" role="status"><p>No goal matches “zzzz”.</p><p><a>Clear the search</a></p></div></div>
<div class="state"><span class="label">B. A near miss</span>
${goalsBar('rolback', 0)}
<p class="countline" role="status">No goal matches “rolback”. Showing goals that match “rollback”.</p>
<p class="filters"><a>Clear the search</a></p>
<ul class="list">
${goal('risk', 'Rollback time for failed releases', 'G-22 · Tunde Bakare · Build &amp; Release', '9 min', 'target 5 min')}
${goal('on', 'Automated rollback coverage', 'G-23 · Rhea Kapoor · CI/CD', '82%', 'target 80%')}
</ul></div>
${note('Wireframe 6. Nothing found is said one way, where the list would be, with one link to clear it. A word one letter away is tried before giving up, and the list says so. Today the same case has eight wordings and “rolback” finds nothing.')}` });

kit.render(__dirname, SCREENS);
