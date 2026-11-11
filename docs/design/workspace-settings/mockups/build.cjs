/* Wireframes for settings, not switches (docs/design/workspace-settings/README.md, spec.md section 4).
   Usage: node docs/design/workspace-settings/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md.
   Numbers are the demo's on 11 Nov 2026 where it shows them (126 goals: 12 north star, 44 SVP, 70 team; 97 people;
   week 46 of 53; 5,347 check-ins). Counts of watches, reviews, views and of goals a new threshold would re-read are examples. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, sw, shell, note } = kit;

const CSS = `<style>
.frow{align-items:flex-start!important}.frow .t span{display:block}.frow .act{display:flex;gap:12px;align-items:center;flex:none}
.rb{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.rb li{display:flex;gap:10px;align-items:flex-start}.rb li i{width:6px;height:6px;border-radius:999px;background:var(--muted);flex:none;margin-top:8px}.rb b{font-weight:600}
.crumb{font-size:14px;color:var(--muted)}.crumb u{color:var(--accent-text);text-underline-offset:2px}
.two{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:32px;align-items:start}
.form{display:flex;flex-direction:column;gap:18px;min-width:0}
.says{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.foot{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px}
.lv{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px;display:flex;flex-direction:column;gap:10px}
.lv.must{outline:2px solid var(--off);outline-offset:-1px}.lv.going{background:var(--surface-2)}
.lv .top2{display:flex;gap:10px;align-items:center}.lv .ord{width:26px;height:26px;border:1px solid var(--line);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--muted);flex:none}
.lv .grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.lv .input{min-width:0}
.lv .meta{font-size:14px;color:var(--muted)}.mv{display:flex;gap:6px}
.sq{width:36px;min-height:36px;padding:0;font-size:13px}
.sel2{justify-content:space-between;flex:none!important;min-width:150px!important}.sel2:after{content:"";width:8px;height:8px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.pct{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:8px 14px;align-items:center}.pct .input{min-width:0;flex:none;justify-content:flex-end;font-variant-numeric:tabular-nums}
.pct .lab b{display:block;font-weight:600}.pct .lab span{color:var(--muted);font-size:14px}
.ex{width:100%;font-size:14px}.ex td,.ex th{padding:8px 10px}.ex td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.chk{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px;display:flex;flex-direction:column;gap:8px}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.rrow .hint{display:block}.rrow b{font-weight:600}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.fixed{display:grid;grid-template-columns:170px 1fr;gap:8px 16px;margin:0}.fixed dt{color:var(--muted)}.fixed dd{margin:0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.mini{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}.mini .cap{font-size:12px;font-weight:600;color:var(--muted)}
.lvl{font-size:12px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.meta2{display:flex;gap:6px 14px;flex-wrap:wrap;color:var(--muted);font-size:14px;align-items:center}
.cells{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cells>div{padding:14px 16px;min-width:0}.cells>div+div{border-left:1px solid var(--line-2)}
.cells .l{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;display:block}.cells .v{font-size:19px;line-height:26px;font-weight:650;display:block}.cells .s{font-size:13px;color:var(--muted);display:block}
.seg{display:flex;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow:hidden}.seg span{flex:1;text-align:center;padding:9px 8px;font-weight:600;color:var(--fg-2);min-width:0}.seg span+span{border-left:1px solid var(--line)}.seg .cur{background:var(--fg);color:#fff}
.grouph{display:flex;gap:8px;align-items:baseline;margin:18px 0 8px}.grouph h3{font-size:17px}
@media (max-width:700px){
 .pair{grid-template-columns:1fr}.two{display:flex;flex-direction:column;gap:18px}.two>.form{display:contents}.two>.says{order:2}.two .foot{order:3;width:100%}.sq{min-height:44px;width:48px}.frow{flex-wrap:wrap}.frow .act{width:100%;justify-content:flex-end}
 .foot .btn{flex:1}.fixed{grid-template-columns:1fr;gap:2px 0}.fixed dd{margin-bottom:10px}
 .cells{grid-template-columns:1fr 1fr}.cells>div:nth-child(3){border-left:0}.cells>div:nth-child(n+3){border-top:1px solid var(--line-2)}
 .lv .top2{flex-wrap:wrap}.lv .mv{margin-left:auto}.sel2{flex:1 1 100%!important}.seg{flex-wrap:wrap}.seg span{flex:1 1 30%}
 .pct{grid-template-columns:minmax(0,1fr) 104px}.btn.sm{min-height:44px}
}
</style>`;

const wsMenu = (cur) => `<div class="menu">${['About', 'Cycles', 'Access', 'Features', 'Privacy', 'Recently removed'].map((n) => `<span class="${n === cur ? 'cur' : ''}">${n}</span>`).join('')}</div>`;
const wsHead = `<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>`;
const featureRow = (name, says, right) => `<li class="frow"><span class="t"><b>${name}</b><span>${says}</span></span><span class="act">${right}</span></li>`;
const rb = (items) => `<ul class="rb">${items.map((t) => `<li><i></i><span>${t}</span></li>`).join('')}</ul>`;
const crumb = (t) => `<p class="crumb"><u>Workspace</u> › <u>Features</u> › ${t}</p>`;
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const lvl = (t) => `<span class="lvl">${t}</span>`;
const SCREENS = {};
const page = (o) => shell({ cur: 'Workspace', who: 'amara', width: 'wide', ...o, body: CSS + o.body });

/* 1. Features: "How you work" with every setting */
SCREENS['01-features'] = page({ title: 'Features', body: `
${wsHead}
<div class="layout">${wsMenu('Features')}<div class="body">
<div class="stack" style="gap:2px"><h2>Features</h2><p class="hint">How Platform Engineering works, and the optional parts of Faro. They apply to everyone here.</p></div>
<div class="stack"><h3>How you work</h3>
<ul class="list">
${featureRow('Check-in rhythm', 'Every week, due by Thursday. Each owner sees their on-time streak.', `<span class="btn">Change</span>`)}
${featureRow('Levels', 'North star, SVP and Team: 12, 44 and 70 goals.', `<span class="btn">Change</span>`)}
${featureRow('Status thresholds', 'On track from 95% of the progress planned by now, at risk from 80%, off track below. A stage is off track when more than 2 weeks late.', `<span class="btn">Change</span>`)}
${featureRow('Goal year', 'January to December, in four quarters. 2026 is in week 46 of 53.', `<span class="btn">Change</span>`)}
${featureRow('Reviews', 'Walk a set of goals together on a cadence, decide what happens next and keep what was said. 6 reviews are set up.', sw(true))}
</ul>
<p class="hint">A setting says what is set. Changing one tells you what it will do before it is saved, and never rewrites a week that has passed.</p></div>
<div class="stack"><h3>Tools</h3>
<ul class="list">
${featureRow('Metric library', 'Define each number goals are measured by once, and say which metric measures a goal.', sw(true))}
${featureRow('Spreadsheets', 'Download the goals as Excel or CSV, and load changes back from a spreadsheet.', sw(true))}
</ul>
<p class="hint">Switching one off hides it and keeps what it saved. <a>About features</a></p></div>
</div></div>
${note('Wireframe 1. Workspace, Features, as Amara. “How you work” holds four settings, each a sentence of what is set with “Change”, and the Reviews switch (round 2). Every sentence is today’s value: an untouched workspace behaves as now. The page has no primary action until a setting is open.')}` });

/* 2. Levels: a rename and a remove in use */
const lv = ({ n, name, hint, meta, cls = '', extra = '', up = true, down = true, filledHint = true }) => `<div class="lv ${cls}">
<div class="top2"><span class="ord">${n}</span><span class="grow"><span class="input filled">${name}</span></span><span class="mv">${up ? '<span class="btn sq">Up</span>' : ''}${down ? '<span class="btn sq" style="width:56px">Down</span>' : ''}</span></div>
<span class="input ${filledHint ? 'filled' : ''}" style="min-height:40px;font-size:14px">${hint}</span>
<div class="row between"><span class="meta">${meta}</span>${extra}</div></div>`;
SCREENS['02-levels'] = page({ title: 'Levels', body: `
${crumb('Levels')}
<div class="head" style="margin-top:8px"><div class="stack"><h1>Levels</h1><p class="hint">How important a goal is, for reporting. A level is a label with an order; it doesn’t decide who may do what or what may feed what.</p></div></div>
<div class="two"><div class="form">
<p class="hint">Top first. The last level is the everyday one: new goals start there and it isn’t tagged on a goal.</p>
${lv({ n: 1, name: 'Company', hint: 'Reported to the executive team. You can have several.', meta: '12 goals · was “North star”', extra: '<span class="btn quiet">Remove</span>', up: false })}
<div class="lv going"><div class="top2"><span class="ord">–</span><span class="grow"><b>SVP</b><span class="meta">Being removed · 44 goals</span></span><span class="btn quiet">Keep it</span></div>
<div class="field"><b>Move its 44 goals to</b><span class="input filled sel2">Team</span><span class="hint">Required: every goal has a level.</span></div></div>
${lv({ n: 2, name: 'Team', hint: 'Most goals.', meta: '70 goals · the everyday level', extra: '', down: false })}
<span class="btn" style="align-self:flex-start">Add a level</span>
<div class="foot"><span class="btn">Cancel</span><span class="btn primary">Save levels</span></div>
</div>
<div class="says"><h3>What changes for everyone here</h3>
${rb([
  '<b>12 goals read “Company”</b> where they read “North star”. Nothing else about them changes.',
  '<b>44 goals move from SVP to Team.</b> Each goal’s History says so. Team then has 114 goals.',
  '<b>1 review walks every SVP goal:</b> Platform leadership weekly. It keeps the same 44 goals, picked one by one.',
  '<b>3 people watch every SVP goal.</b> Each keeps watching those 44 goals.',
  '<b>2 saved views filter by SVP:</b> “SVP goals off track” (pinned) and one of Rhea’s. They will match nothing and say why.',
  'A spreadsheet that says “north star” still loads as Company. One that says “svp” is refused, with the levels to use.',
])}
<p class="hint">Nothing is deleted. Undo puts every goal, review, watch and name back.</p></div></div>
${note('Wireframe 2. Features, Levels, with a rename (North star to Company) and a level in use being removed (SVP). A removed level asks where its goals go before Save is offered; the read-back counts goals, reviews, watches and saved views. One primary action: Save levels.')}` });

/* 3. Thresholds with the worked example and the read-back */
const pct = (label, sub, v) => `<span class="lab"><b>${label}</b><span>${sub}</span></span><span class="input filled">${v}</span>`;
SCREENS['03-thresholds'] = page({ title: 'Status thresholds', body: `
${crumb('Status thresholds')}
<div class="head" style="margin-top:8px"><div class="stack"><h1>Status thresholds</h1><p class="hint">What the numbers say about a goal, before its owner makes the call. The same for every goal here.</p></div></div>
<div class="two"><div class="form">
<div class="stack"><h3>A number goal</h3>
<div class="pct">
${pct('On track from', 'of the progress planned by now', '90 %')}
${pct('At risk from', 'below this it is off track', '75 %')}
${pct('Well ahead from', 'still on track; the owner is asked why', '120 %')}
</div><p class="hint">Was 95%, 80% and 120%.</p></div>
<div class="stack"><h3>A goal with dated stages</h3>
<div class="pct">${pct('A stage is off track when more than', 'weeks late; up to that it is slipping, and the goal at risk', '2 weeks')}</div></div>
<div class="stack"><h3>What that means</h3>
<p class="hint">A goal planned to have moved from 40 to 60 by this week (20 planned):</p>
<table class="ex"><thead><tr><th>Its number</th><th>Now reads</th><th>Would read</th></tr></thead><tbody>
<tr><td class="n">59 or more</td><td>${st('on')}</td><td>${st('on')}</td></tr>
<tr><td class="n">58</td><td>${st('risk')}</td><td>${st('on')}</td></tr>
<tr><td class="n">56 or 57</td><td>${st('risk')}</td><td>${st('risk')}</td></tr>
<tr><td class="n">55</td><td>${st('off')}</td><td>${st('risk')}</td></tr>
<tr><td class="n">under 55</td><td>${st('off')}</td><td>${st('off')}</td></tr>
</tbody></table>
<p class="hint">It reads the same when lower is better. At 64 or more it is well ahead, as now.</p></div>
<div class="chk">${warn('Check')}<p>A goal 10% short of its plan would read On track. Is that what you mean?</p><div class="row"><span class="btn sm on">Yes, 90% is right</span><span class="btn sm">Set it back to 95%</span></div></div>
<div class="foot"><span class="btn">Cancel</span><span class="btn primary">Save thresholds</span></div>
</div>
<div class="says"><h3>What changes for everyone here</h3>
${rb([
  '<b>From week 47 (16–22 Nov).</b> Check-ins for that week and after are judged by the new numbers.',
  '<b>No status changes today.</b> A status is its owner’s call at their last check-in, and stays until the next one.',
  '<b>If this week’s numbers were posted again:</b> 6 goals would be offered On track where they were offered At risk, and 3 At risk where Off track. 73 would read the same.',
  '<b>4 owners would not have been asked why they were behind.</b>',
  '<b>Weeks 1 to 46 keep what they said</b>, and so do the results for Q1, Q2 and Q3, which never use these numbers.',
  'Help, the status key and exports say 90% and 75% from week 47, and “95% until week 46”.',
])}
<p class="hint">Undo puts 95%, 80% and 120% back, from week 47.</p></div></div>
${note('Wireframe 3. Features, Status thresholds. Numbers are typed, never dragged. The worked example is recalculated as they change, with shape and word in both columns. One question (Check) is answered before Save; a threshold above another would be Must fix. The read-back says when it starts, that nothing moves today, and counts what the numbers would say. One primary action: Save thresholds.')}` });

/* 4. The year's shape: on Features, and what set-up's "Change" offers */
SCREENS['04-year'] = page({ title: 'Goal year', body: `
<div class="pair">
<div class="mini"><span class="cap">(a) Workspace, Features, Goal year: a year that is running</span>
<h2>Goal year</h2>
<dl class="fixed">
<dt>Starts in</dt><dd>January. 2026 runs 22 Dec 2025 to 27 Dec 2026, 53 weeks.<span class="hint" style="display:block">Fixed for a running year: its 5,347 check-ins are filed by week number.</span></dd>
<dt>Weeks</dt><dd>Monday to Sunday, numbered from the week with the year’s first Thursday.</dd>
</dl>
<div class="field"><b>The year is read in</b>
${rad('Four quarters', false, 'Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec.')}
${rad('Three terms', false, 'T1 Jan–Apr, T2 May–Aug, T3 Sep–Dec.')}
${rad('Two halves', true, 'H1 Jan–Jun, H2 Jul–Dec.')}</div>
<div class="says"><h3>What changes for everyone here</h3>${rb([
  '<b>Charts, results and “By when?” say H1 and H2</b> where they said Q1 to Q4.',
  '<b>3 goals are due at the end of Q3</b> (week 39). They stay due in week 39, which reads “week 39 (21–27 Sep)”.',
  '<b>Results are read again by half:</b> H1 for weeks 1 to 26. No plan, number or status changes.',
])}</div>
<div class="foot"><span class="btn">Cancel</span><span class="btn primary">Save</span></div></div>
<div class="mini"><span class="cap">(b) Set-up, “How you’ll work”: what “Change” beside the goal year offers</span>
<h2>The goal year</h2>
<div class="field"><b>Starts in</b><span class="input filled sel2">April</span></div>
<div class="field"><b>Read in</b><div class="seg"><span class="cur">Four quarters</span><span>Three terms</span><span>Two halves</span></div></div>
<div class="says">${rb([
  '<b>Apr 2026–Mar 2027</b>, 52 weeks, from Mon 30 Mar 2026 to Sun 28 Mar 2027.',
  '<b>Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.</b>',
  '<b>You join it in week 33 of 52</b>, in Q3. Nothing before this week is counted late.',
])}</div>
<p class="hint">The month can’t change once the year has check-ins. Weeks run Monday to Sunday.</p>
<div class="foot"><span class="btn primary">Done</span></div></div>
</div>
${note('Wireframe 4. The year’s shape. (a) On Features, for a running year: the start month and the week are stated with the reason they are fixed; how the year is read (quarters, terms, halves) is the one thing that can change, with its read-back. (b) In set-up (round 2’s step “How you’ll work”), “Change” offers the start month, as today, and the same three ways of reading the year, and says the dates that follow.')}` });

/* 5. A goal's page under renamed levels */
SCREENS['05-goal-renamed'] = shell({ title: 'Time from pull request opened to first review', cur: 'Goals', who: 'amara', width: 'wide', body: `${CSS}
<p class="crumb"><u>Goals</u> › <u>Lead time for changes</u></p>
<div class="head" style="margin-top:8px"><div class="stack"><h1>Time from pull request opened to first review</h1>
<div class="meta2"><span>Tariq Haddad, Developer Experience</span>${lvl('Division')}<span>G-2</span><span>Updated 10 Nov · week 46</span></div>
<div>${st('on')}</div></div><span class="btn">Watch</span></div>
<div class="cells"><div><span class="l">Now</span><span class="v num">8.1 hours</span><span class="s">week 46</span></div><div><span class="l">Vs plan</span><span class="v">0.3 hours behind</span><span class="s">98% of the progress planned; on track from 95%</span></div><div><span class="l">To target</span><span class="v">2.1 hours over</span><span class="s">target 6.0 hours</span></div><div><span class="l">Will it hit 6.0?</span><span class="v">Likely</span><span class="s">likely 5.5 hours by year end</span></div></div>
<div class="stack" style="margin-top:24px"><h2>What feeds it</h2>
<ul class="list"><li class="grp">Feeds into</li>
<li class="goal offwash"><span class="s">${st('off')}</span><span class="t"><b>Lead time for changes</b><span>${lvl('Company')}</span></span><span class="v"><b class="num">37 hours</b>9 hours behind plan</span></li>
<li class="grp">Directly feeding it · 3</li>
<li class="goal"><span class="s">${st('risk')}</span><span class="t"><b>Repositories covered by a named review rota</b><span>Recovering: back to the planned pace for three weeks.</span></span><span class="v"><b class="num">85%</b>3 pts behind plan</span></li>
<li class="goal"><span class="s">${st('on')}</span><span class="t"><b>AI first-pass review on every pull request in tier-1 repositories</b><span>Ravi Shankar. Checked in yesterday.</span></span><span class="v"><b class="num">87%</b>8 pts ahead of plan</span></li>
</ul></div>
<div class="stack" style="margin-top:24px"><h2>About</h2>
<dl class="facts"><dt>Level</dt><dd>Division. Reported at the divisional review.</dd><dt>History</dt><dd>“Tariq Haddad set the level to SVP” on 6 Jan stays as written; the level is called Division since 11 Nov.</dd></dl></div>
${note('Wireframe 5. A goal’s page after SVP was renamed Division and North star Company. The level is plain small capitals beside the owner, never a filled capsule; the everyday level (Team) is not tagged, as today. “About” says the level and what the workspace says it is for. History keeps the words of the day.')}` });

/* 6. The Goals page grouped by level, with four levels */
const g = (k, title, why, v, gap) => `<li class="goal ${k === 'off' ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${why}</span></span><span class="v"><b class="num">${v}</b>${gap}</span></li>`;
SCREENS['06-goals-renamed'] = shell({ title: 'Goals', cur: 'Goals', who: 'amara', width: 'wide', body: `${CSS}
<div class="head"><div class="stack"><h1>Goals</h1><p class="hint">Week 46 of 53 · Q4 (Oct–Dec) · 2026</p></div></div>
<div class="tabs"><span>My team<em>1</em></span><span>Watching<em>56</em></span><span class="cur">All<em>126</em></span></div>
<div class="bar"><span class="input">Find a goal</span><span class="row desk-only" style="gap:8px"><span class="btn">Filters</span><span class="btn">Sort: Worst first</span><span class="btn on">Group: By level</span></span><span class="btn phone-only">Filter and sort</span></div>
<p class="countline"><b>126 goals</b>, worst first in each level. 11 off track · 23 at risk · 5 no recent update · 2 no check-in yet · 77 on track · 8 done</p>
<div class="grouph"><h3>Company</h3><span class="hint">· 12</span></div>
<ul class="list">${g('off', 'Lead time for changes', 'Lead time is well above plan and the gap grew again this week.', '37 hours', '9 hours behind plan')}${g('risk', 'Developer satisfaction, rolling pulse score', 'Waiting on Daniel Okafor: put one-command local dev on every team’s Q4 plan.', '3.9', '0.2 behind plan')}<li><span class="t"><a>10 more</a></span></li></ul>
<div class="grouph"><h3>Group</h3><span class="hint">· 9 · added 11 Nov</span></div>
<ul class="list">${g('on', 'CI pipeline time on main (p90)', 'Daniel Okafor. Checked in on Monday.', '11 min', 'On plan')}<li><span class="t"><a>8 more</a></span></li></ul>
<div class="grouph"><h3>Division</h3><span class="hint">· 35</span></div>
<ul class="list">${g('off', 'Container images rebuilt within 7 days of a base image fix', 'Testing found more edge cases in image rebuilds than we expected.', '73%', '10 pts behind plan')}<li><span class="t"><a>34 more</a></span></li></ul>
<div class="grouph"><h3>Team</h3><span class="hint">· 70</span></div>
<ul class="list">${g('risk', 'Repositories covered by a named review rota', 'Recovering: back to the planned pace for three weeks.', '85%', '3 pts behind plan')}<li><span class="t"><a>69 more</a></span></li></ul>
${note('Wireframe 6. Goals, grouped by level, in a workspace with four levels (Company, Group, Division, Team). Groups come in the workspace’s order with its names; a level with no goals is not drawn. The Level filter, the sort “Level”, the Board’s order and exports use the same list. No button of its own: Goals is a page for reading (GP, 9 Nov).')}` });

/* 7. The rhythm's sheet with the streak (added to round 2's sheet) */
SCREENS['07-rhythm-streak'] = page({ title: 'Check-in rhythm', body: `
${crumb('Check-in rhythm')}
<div class="head" style="margin-top:8px"><div class="stack"><h1>Check-in rhythm</h1></div></div>
<div class="two"><div class="form">
${rad('Every week', true, 'Check-ins are due by a day you choose. A goal with none for 14 days reads “No recent update”.')}
<div class="field" style="padding-left:32px"><b>Due by</b><span class="input filled sel2">Thursday</span></div>
${rad('No set rhythm', false, 'Owners check in when there’s news. Nothing is due or late for want of a check-in.')}
<div class="stack"><h3>On-time streak</h3><p class="hint">Weeks in a row with every check-in in by Thursday. Only the owner sees their own.</p>
${rad('Shown', false, 'One late week sets it back to nothing.')}
${rad('Shown, and one late week is forgiven', true, 'A late or missed week doesn’t end a streak if the four weeks before it were on time. It isn’t counted.')}
${rad('Not shown', false, 'Nothing counts weeks. “Due by Thursday” and what’s still to do stay.')}</div>
<div class="foot"><span class="btn">Cancel</span><span class="btn primary">Save</span></div>
</div>
<div class="says"><h3>What changes for everyone here</h3>
${rb([
  '<b>41 owners have a streak today.</b> None gets shorter.',
  '<b>6 owners’ streaks get longer</b>: a single late week inside them is forgiven. The longest goes from 3 weeks to 11.',
  'Check-ins, due days and statuses are untouched. A streak is only ever shown to its owner.',
])}
<p class="hint">Undo puts the streak back to “Shown”.</p></div></div>
${note('Wireframe 7. The rhythm’s sheet (round 2, FT1) with the streak as a choice under it. With “No set rhythm” the streak’s choices are not drawn: there is nothing to be on time for. One primary action: Save.')}` });

kit.render(__dirname, SCREENS);
