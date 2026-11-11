/* Wireframes for reviews and the check-in rhythm as switches (docs/design/feature-toggles/README.md, spec.md section 4).
   Usage: node docs/design/feature-toggles/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md.
   Numbers are the demo's on 11 Nov 2026 where it shows them (126 goals, 6 reviews, 794 review entries in Activity,
   5 with no recent update, Rhea's 8 goals); the rest are examples. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, sw, shell, note } = kit;

const CSS = `<style>
.state{margin-bottom:36px}.state>.label{display:block;margin-bottom:10px}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rrow .hint{display:block}.rrow b{font-weight:600}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.pl{display:flex;flex-direction:column;gap:6px}
.sel2{justify-content:space-between;flex:none!important;min-width:150px!important}.sel2:after{content:"";width:8px;height:8px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.frow{align-items:flex-start!important}.frow .t span{display:block}.frow .act{display:flex;gap:12px;align-items:center;flex:none}
.rb{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.rb li{display:flex;gap:10px;align-items:flex-start}.rb li i{width:6px;height:6px;border-radius:999px;background:var(--muted);flex:none;margin-top:8px}
.rb b{font-weight:600}
.sheet{margin:0;width:auto;max-width:520px}.sheet .foot{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.four{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.mini{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
.mini h2{font-size:20px;line-height:26px}.mini .cap{font-size:12px;font-weight:600;color:var(--muted)}
.strip{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.strip.two{grid-template-columns:repeat(2,1fr)}.strip.one{grid-template-columns:1fr}
.strip>div{padding:12px 14px;min-width:0}.strip>div+div{border-left:1px solid var(--line-2)}.strip .l{font-size:12px;font-weight:600;color:var(--muted);display:block}.strip .v{font-weight:650;display:block}.strip .s{font-size:13px;color:var(--muted);display:block}
.cnt{display:flex;flex-direction:column;gap:2px;font-size:14px}
.hero{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:8px}.hero h3{font-size:19px;line-height:26px}
.gone{font-size:13px;color:var(--muted)}
.meta{display:flex;gap:8px 16px;flex-wrap:wrap;color:var(--muted);font-size:14px;align-items:center}
.cells{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cells>div{padding:14px 16px;min-width:0}.cells>div+div{border-left:1px solid var(--line-2)}
.cells .l{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;display:block}.cells .v{font-size:19px;line-height:26px;font-weight:650;display:block}.cells .s{font-size:13px;color:var(--muted);display:block}
.hist{margin:0;padding:0;list-style:none;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.hist li{padding:12px 16px;display:flex;gap:12px;align-items:flex-start}.hist li+li{border-top:1px solid var(--line-2)}.hist .w{width:84px;flex:none;font-weight:600}.hist .t{flex:1;min-width:0}.hist .t .d{color:var(--muted);font-size:14px;display:block}
.pick li{align-items:center}.pick .s{width:150px;flex:none}
.fl{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px}
.fl .g{display:flex;gap:8px 18px;flex-wrap:wrap;align-items:center}.fl .g>b{width:130px;flex:none;font-weight:600}
.ck{display:inline-flex;gap:8px;align-items:center;min-height:32px}.ck i{width:18px;height:18px;border:1.6px solid var(--fg);border-radius:4px;flex:none;background:var(--surface)}
.was{color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:8px;padding:8px 12px}
.frame{max-width:620px}.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}.fhead b{display:block}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.q{display:flex;flex-direction:column;gap:10px}.q>b{font-weight:650;font-size:17px}
.says{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:6px}
@media (max-width:700px){
 .pair,.four{grid-template-columns:1fr}.cells{grid-template-columns:1fr 1fr}.cells>div:nth-child(3){border-left:0}.cells>div:nth-child(n+3){border-top:1px solid var(--line-2)}
 .strip,.strip.two{grid-template-columns:1fr}.strip>div+div{border-left:0;border-top:1px solid var(--line-2)}
 .frow{flex-wrap:wrap}.frow .act{width:100%;justify-content:space-between}
 .sheet .foot .btn{flex:1}.hist .w{width:70px}.pick .s{width:100%}.pick li .btn{width:100%}
 .fl .g>b{width:100%}.ffoot .btn{flex:1}.sel2{flex:1 1 100%!important}
}
</style>`;

/* The kit's shell draws today's menu. With reviews off the Reviews row and tab are gone; with no rhythm the Check-in
   row has no count. The kit isn't edited: the finished page is adjusted here. */
function shell2({ reviews = true, rhythm = true, ...o }) {
  const counts = { ...(rhythm ? { 'Check-in': 5 } : {}), ...(reviews ? { Reviews: 1 } : {}) };
  let html = shell({ ...o, counts });
  if (!reviews) {
    html = html.replace(/<div class="nav (cur)?"><i><\/i>Reviews(<span class="n">\d+<\/span>)?<\/div>/, '');
    const owner = o.who !== 'amara' && o.who !== 'oskar';
    html = html.replace(/<span class="(cur)?">Reviews<\/span>/, owner ? '<span class="">People</span>' : '<span class="">Activity</span>');
  }
  return html;
}

const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const wsMenu = (cur) => `<div class="menu">${['About', 'Cycles', 'Access', 'Features', 'Privacy', 'Recently removed'].map((n) => `<span class="${n === cur ? 'cur' : ''}">${n}</span>`).join('')}</div>`;
const wsHead = `<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>`;
const SCREENS = {};

/* 1. Workspace, Features: the rhythm and the modules */
const featureRow = (name, says, right) => `<li class="frow"><span class="t"><b>${name}</b><span>${says}</span></span><span class="act">${right}</span></li>`;
SCREENS['01-features'] = shell2({ title: 'Features', cur: 'Workspace', who: 'amara', width: 'wide', body: `${CSS}
${wsHead}
<div class="layout">${wsMenu('Features')}<div class="body">
<div class="stack"><div class="stack" style="gap:2px"><h2>Features</h2><p class="hint">How Platform Engineering works, and the optional parts of Faro. They apply to everyone here.</p></div></div>
<div class="stack"><h3>How you work</h3>
<ul class="list">
${featureRow('Check-in rhythm', 'Every week, due by Thursday. A goal with no check-in for 14 days reads “No recent update”.', `<span class="btn">Change</span>`)}
${featureRow('Reviews', 'Walk a set of goals together on a cadence, decide what happens next and keep what was said. 6 reviews are set up.', sw(true))}
</ul></div>
<div class="stack"><h3>Tools</h3>
<ul class="list">
${featureRow('Metric library', 'Define each number goals are measured by once, and say which metric measures a goal.', sw(true))}
${featureRow('Spreadsheets', 'Download the goals as Excel or CSV, and load changes back from a spreadsheet.', sw(true))}
</ul>
<p class="hint">Switching one off hides it and keeps what it saved. <a>About features</a></p></div>
</div></div>
${note('Wireframe 1. Workspace, Features, as Amara (an admin). The check-in rhythm is a choice, not a switch, so its row says what is set and offers “Change”; Reviews is a module with a switch like the two tools. Today the page lists Metric library and Spreadsheets only, and its summary says “Goals, check-ins, reviews and people are always on”.')}` });

/* 2. The read-back before either changes */
const sheet = (title, body, primary, extra = '') => `<div class="sheet"><h2>${title}</h2>${body}<div class="foot">${extra}<span class="btn">Cancel</span><span class="btn primary">${primary}</span></div></div>`;
const rb = (items) => `<ul class="rb">${items.map((t) => `<li><i></i><span>${t}</span></li>`).join('')}</ul>`;
SCREENS['02-read-back'] = shell2({ title: 'Features', cur: 'Workspace', who: 'amara', width: 'wide', body: `${CSS}
${wsHead}
<div class="pair">
<div class="state"><span class="label">(a) After pressing the Reviews switch</span>
${sheet('Switch off Reviews in Platform Engineering?', `
<p>For all 97 people here:</p>
${rb(['<b>Reviews leaves the menu</b>, and Home’s “Next review”.', '<b>6 reviews stay in the record</b>, with the 794 things said or marked in them. Each goal’s History still shows them.', '<b>7 open next steps agreed in a review stay open</b> on their goals and on Home.', '<b>1 question waiting for a review</b> stays open; it no longer names a session.', 'Nothing is deleted. Switch Reviews back on and every review is as it was.'])}`, 'Switch off Reviews')}</div>
<div class="state"><span class="label">(b) After “Change” on Check-in rhythm</span>
${sheet('Check-in rhythm', `
<div class="pl">${rad('Every week', false, 'Check-ins are due by a day you choose. A goal with none for 14 days reads “No recent update”.')}${rad('No set rhythm', true, 'Owners check in when there’s news. Nothing is due or late for want of a check-in.')}</div>
<p class="label" style="margin-top:4px">What changes for everyone here</p>
${rb(['<b>126 goals have nothing due.</b> Home and Check-in stop counting what’s due, and on-time streaks stop.', `<b>5 goals stop reading “No recent update”.</b> Each shows its last check-in’s status and the week it is from: 3 on track, 1 at risk, 1 off track.`, '<b>Nothing is flagged for going quiet.</b> Goals’ “No update for…” filter still finds them.', 'Dates people chose stay: stage dates, next steps’ weeks and “back on plan by”.', 'Every check-in already posted stays as it is.'])}`, 'Save')}</div>
</div>
${note('Wireframe 2. Neither switch acts before it says what it will do, in counts. (a) Reviews off: what leaves the screen, what stays in the record, what stays open. (b) The rhythm: the two choices, each with one sentence, then what changes. After saving, a toast says “Reviews is off in Platform Engineering. Nothing it saved is lost.” or “Check-ins have no set rhythm now.”, each with Undo. Today a feature switch acts at once and says so afterwards.')}` });

/* 3. Home four ways, as Rhea (an owner and a manager) */
const counts = (list) => `<div class="cnt">${list.map(([k, n]) => st(k, n)).join('')}</div>`;
const yourGoals = () => `<div><span class="l">Your goals · 8</span>${counts([['off', 2], ['risk', 2], ['none', 1], ['on', 2], ['done', 1]])}</div>`;
const streak = `<div><span class="l">On-time streak</span><span class="v">0 weeks</span><span class="s">Weeks with every check-in in by Thursday</span></div>`;
const nextRev = `<div><span class="l">${warn('Not held yet')}</span><span class="v">Developer Productivity fortnightly</span><span class="s">Tue 10 Nov · 1 day past</span></div>`;
const heroDue = `<div class="hero"><span class="cap">Check-ins are due by Thursday, tomorrow</span><h3>5 check-ins to do</h3><p class="hint">About 4 min · Flaky test rate in the main pipelines, and 4 more</p><div><span class="btn primary">Start check-in</span></div></div>`;
const heroFree = `<div class="hero"><h3>Your goals</h3><p class="hint">2 have a check-in this week. CI cost per pipeline run has none yet.</p><div><span class="btn primary">Check in on a goal</span></div></div>`;
const question = (session) => `<div class="hero"><span class="cap">Needs your response · 1</span><p><b>Pipeline queue wait (p90)</b></p><p class="hint">“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”</p><p class="hint">${session ? 'Daniel asked in Developer Productivity fortnightly 8 days ago. Before its next session, Tue 24 Nov.' : 'Daniel asked 8 days ago.'}</p><div><span class="btn">Answer</span></div></div>`;
const mini = (cap, strip, hero, q, gone) => `<div class="mini"><span class="cap">${cap}</span><h2>Good afternoon, Rhea</h2>${strip}${hero}${q}${gone ? `<p class="gone">${gone}</p>` : ''}</div>`;
SCREENS['03-home-four-ways'] = shell2({ title: 'Home', bare: true, body: `${CSS}
<div class="four">
${mini('(a) Today: every week, reviews on', `<div class="strip">${yourGoals()}${streak}${nextRev}</div>`, heroDue, question(true), '')}
${mini('(b) No set rhythm, reviews on', `<div class="strip two">${yourGoals()}${nextRev}</div>`, heroFree, question(true), 'Gone: the streak, “due by Thursday” and “5 check-ins to do”. A watched goal that read “No recent update” reads its last status, with its week.')}
${mini('(c) Every week, reviews off', `<div class="strip two">${yourGoals()}${streak}</div>`, heroDue, question(false), 'Gone: the review tile, and “in Developer Productivity fortnightly… before its next session” on the question.')}
${mini('(d) No set rhythm, reviews off', `<div class="strip one">${yourGoals()}</div>`, heroFree, question(false), 'What is left is the core: your goals by status, what is asked of you, and the goals you watch.')}
</div>
${note('Wireframe 3. The top of Home as Rhea, four ways. Nothing is greyed or replaced by an empty block: a part that is off is not there, and the strip closes up. “Needs your response”, “Your goals” and “Goals you watch” (below, not drawn) are the same in all four. With no rhythm the one primary action is “Check in on a goal”, which opens wireframe 6.')}` });

/* 4. A goal's page with no rhythm (Julia's goal, as Amara) */
SCREENS['04-goal-no-rhythm'] = shell2({ title: 'Days for a new engineer to merge a first change', cur: 'Goals', who: 'amara', rhythm: false, width: 'wide', body: `${CSS}
<p class="hint" style="margin-bottom:10px"><a>Back to Developer satisfaction, rolling pulse score</a></p>
<div class="head"><div class="stack"><h1>Days for a new engineer to merge a first change</h1>
<div class="meta"><span>Julia Novak · Developer Portal</span><span>SVP · G-68</span></div>
<div class="meta">${st('on')}<span>as of week 44 · last check-in 28 Oct</span></div></div>
<div class="row nowrap"><span class="btn">Ask Julia for an update</span><span class="btn">Watching</span></div></div>
<div class="cells" style="margin-bottom:8px">
<div><span class="l">Vs plan</span><span class="v">On plan</span><span class="s">4.0 days against 4.0 in week 44</span></div>
<div><span class="l">Last change</span><span class="v">0.1 days worse</span><span class="s">was 3.9 days in week 43</span></div>
<div><span class="l">To target</span><span class="v">1.0 day over</span><span class="s">target 3.0 days</span></div>
<div><span class="l">Will it hit 3.0?</span><span class="v">Likely</span><span class="s">on the pace to week 44</span></div>
</div>
<p class="was" style="margin-bottom:28px">With a weekly rhythm this page reads today: “No recent update” · “Can’t say · no recent update to go on” · “Why it has no recent update: No check-in for 14 days; the last was week 44 (on track).” · primary button “Ask Julia for an update”.</p>
<div class="stack" style="margin-bottom:28px"><h2>Why</h2><p class="hint">Julia said in week 44</p><p>On plan. The new starter checklist is in the portal and the first two cohorts used it.</p></div>
<div class="stack"><h2>History</h2><p class="hint">Every check-in, what was said, and what changed, newest first.</p>
<ul class="hist">
<li><span class="w">Week 44</span><span class="t">${st('on')}<span class="d">4.0 days · On plan</span></span></li>
<li><span class="w">Week 43</span><span class="t">${st('on')}<span class="d">3.9 days · On plan</span></span></li>
<li><span class="w">Week 42</span><span class="t">${st('on')}<span class="d">4.0 days · On plan</span></span></li>
</ul>
<p class="hint">With a weekly rhythm, History also lists “Week 46 · No check-in” and “Week 45 · No check-in”. With none, a week nobody checked in for is not a row.</p></div>
${note('Wireframe 4. The same goal the demo shows today as “No recent update”, with no set rhythm. Its status is its last check-in’s (On track: filled circle and the word), and the week that status is from sits beside it wherever the status is shown. The scorecard projects from the numbers there are and says how far they go. “Ask Julia for an update” stays, as an ordinary button anyone but the owner can press at any time; it is no longer the page’s primary action, because nothing says an update is owed.')}` });

/* 5. Goals with no rhythm: filters and the count line */
const grow = (k, title, why, value, gap, asof) => `<li class="goal ${k === 'off' ? 'offwash' : ''}"><span class="s">${st(k)}${asof ? `<span class="hint" style="display:block">as of week ${asof}</span>` : ''}</span><span class="t"><b>${title}</b><span>${why}</span></span><span class="v"><b class="num">${value}</b>${gap}</span></li>`;
SCREENS['05-goals-no-rhythm'] = shell2({ title: 'Goals', cur: 'Goals', who: 'amara', rhythm: false, width: 'wide', body: `${CSS}
<div class="head"><div class="stack"><h1>Goals</h1><p class="hint">Week 46 of 53 · Q4 (Oct–Dec) · 2026</p></div></div>
<div class="tabs"><span>My team<em>1</em></span><span>Watching<em>56</em></span><span class="cur">All<em>126</em></span></div>
<div class="bar"><span class="input">Find a goal</span><span class="row desk-only" style="gap:8px"><span class="btn on">Filters</span><span class="btn">Sort: worst first</span></span><span class="btn phone-only">Filter and sort</span></div>
<div class="fl" style="margin-bottom:14px">
<div class="g"><b>Status</b><span class="ck"><i></i>${st('off')}</span><span class="ck"><i></i>${st('risk')}</span><span class="ck"><i></i>${st('none')}</span><span class="ck"><i></i>${st('on')}</span><span class="ck"><i></i>${st('done')}</span></div>
<div class="g"><b>Last check-in</b><span class="input sel2 filled">Any time</span><span class="hint">Any time · 2 weeks ago or more · 4 weeks ago or more · 8 weeks ago or more</span></div>
<div class="g"><b>Needs</b><span class="ck"><i></i>Decision or help</span><span class="ck"><i></i>No path to green</span><span class="ck"><i></i>Missed recovery date</span><span class="ck"><i></i>Getting worse</span></div>
</div>
<p class="countline"><b>126 goals, worst first.</b> 12 off track · 24 at risk · 2 no check-in yet · 80 on track · 8 done</p>
<p class="countline">126 goals · 38 need attention · 39 changes this week.</p>
<ul class="list">
${grow('off', 'Lead time for changes', 'Lead time is well above plan and the gap grew again this week.', '37 hours', '9 hours behind plan')}
${grow('off', 'Data pipeline template on the portal', 'Data Platform reprioritised, and our dependency moved to their next sprint.', '1 of 3 stages', 'Late', 41)}
${grow('risk', 'Portal searches that find the right page first time', 'Search relevance tuning is behind; the new index is not live.', '64%', '6 pts behind plan', 40)}
${grow('on', 'Days for a new engineer to merge a first change', 'On plan. The new starter checklist is in the portal.', '4.0 days', 'On plan', 44)}
${grow('on', 'Remote build cache hit rate', 'On plan.', '77%', '1 pt ahead of plan')}
</ul>
<p class="was" style="margin-top:14px">With a weekly rhythm the same list reads today: “5 no recent update” in the count line, a “No recent update” status to filter by, “No update for 2 weeks or more” as a pinned view, and “(5 with no recent update)” after “need attention”.</p>
${note('Wireframe 5. Goals with no set rhythm. The status filter has five statuses, not six; the count line never says “no recent update”; a goal whose status is not from this week says which week it is from, under the status. Finding goals nobody has updated is still possible, as a plain filter by the date of the last check-in that the person sets, and by the sort “Longest since a check-in”. On a phone the filters are the sheet behind “Filter and sort”.')}` });

/* 6. Check-in with no rhythm: choose a goal */
const prow = (k, title, when, btn = 'Check in') => `<li><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${when}</span></span><span class="btn">${btn}</span></li>`;
SCREENS['06-check-in-no-rhythm'] = shell2({ title: 'Check-in', cur: 'Check-in', who: 'rhea', rhythm: false, width: 'narrow', body: `${CSS}
<div class="head"><div class="stack"><h1>Check in on a goal</h1><p class="hint">Week 46. Check in when there’s news; nothing is due.</p></div></div>
<ul class="list pick">
<li class="grp">No check-in this week · 5</li>
${prow('none', 'CI cost per pipeline run', 'No check-in yet', 'Post the first check-in')}
${prow('risk', 'Flaky test rate in the main pipelines', 'Last check-in week 45 · 1.8%')}
${prow('on', 'Test suites split into parallel shards', 'Last check-in week 45 · 80%')}
${prow('on', 'Base image build time', 'Last check-in week 45 · 10 min')}
${prow('risk', 'Manual release sign-offs replaced by automated quality gates', 'Last check-in week 45 · 3 of 5 stages')}
<li class="grp">Checked in this week · 2</li>
${prow('off', 'Lead time for changes', 'Checked in Mon 9 Nov · 37 hours', 'Check in again')}
${prow('off', 'Pipeline queue wait (p90)', 'Checked in Mon 9 Nov · 7 min', 'Check in again')}
</ul>
<p class="hint" style="margin-top:12px"><a>Or type all your numbers in one table</a></p>
<p class="was" style="margin-top:20px">With a weekly rhythm this door opens today straight into “Week 46 check-in · 1 of 5”, and the menu row says “Check-in 5”.</p>
${note('Wireframe 6. Check-in as Rhea with no set rhythm. The menu row stays for anyone who owns a goal, without a count. The page is a list to choose from (the navigation design’s check-in list, NV3, without its “due” group), oldest check-in first, each row with one button. Choosing a goal opens the same check-in steps as today. A done goal is not listed. There is no primary button: nothing is owed, so no row is more pressing than another.')}` });

/* 7. Set-up: "How you'll work" */
SCREENS['07-setup-how-you-work'] = shell2({ title: 'Set up', bare: true, body: `${CSS}
<div class="frame" style="margin:0 auto">
<div class="fhead"><div><b>Set up Field Operations</b><span class="hint">How you’ll work</span></div><span class="btn sm">Close and keep the draft</span></div>
<h1 style="margin-bottom:22px">How will you keep goals up to date?</h1>
<div class="stack" style="gap:28px">
<div class="q"><b>How often do owners check in?</b>
<div class="pl">${rad('Every week', true, 'Each owner posts a number and a sentence for each goal, by a day you choose. A goal with none for two weeks says so.')}${rad('No set rhythm', false, 'Owners check in when there’s news. Nothing is due or late for want of a check-in.')}</div>
<div class="row"><span>Due by</span><span class="input sel2 filled">Thursday</span></div></div>
<div class="q"><b>Will you go through the goals together?</b>
<div class="pl">${rad('Yes, in a weekly review', true, 'Everyone, every goal, on Thursdays. You can change who and when, or add more reviews, later.')}${rad('Not in Faro', false, 'Reviews stays off. An admin can switch it on later, in Workspace, Features.')}</div></div>
<div class="says"><span class="label">What the last step will say</span>
<p><b>Check-ins</b> Every week, due by Thursday. The first are due by Thu 12 Nov.</p>
<p><b>Reviews</b> A weekly review for everyone, every goal, on Thursdays. The first is on Thu 12 Nov.</p>
<p class="hint">With the second answer to each: “<b>Check-ins</b> Whenever there’s news. Nothing is due or late.” and “<b>Reviews</b> Off. An admin can switch them on in Workspace, Features.”</p></div>
</div>
<div class="ffoot"><span class="btn">Back</span><span class="btn primary">Continue</span></div>
</div>
${note('Wireframe 7. The two questions set-up asks, for the set-up design to place (docs/design/setup). Each answer is one of two, the default first, and each writes one sentence into set-up’s last step. “Due by” shows only with “Every week”. Today set-up asks only for the review day, and always makes a weekly review for everyone.')}` });

kit.render(__dirname, SCREENS);
