/* Wireframes for running a review (docs/design/reviews/README.md, spec.md section 2).
   Usage: node docs/design/reviews/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat surfaces, hairline rows,
   status as a shape plus a word, the warning mark for a flag that isn't a status, no edge stripes, quote bars or capsules.
   Names and counts are the demo's on 11 Nov 2026 where it shows them; what was decided in the room is an example. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note } = kit;

const CSS = `<style>
.back{display:inline-block;margin-bottom:10px}
.sub{color:var(--muted)}
.sec{display:flex;flex-direction:column;gap:10px}.sec+.sec{margin-top:28px}
.sec>h2 em{font-style:normal;font-weight:400;color:var(--muted);margin-left:6px}
.rv{align-items:flex-start!important}.rv .t b{font-size:16px}.rv .when{width:250px;flex:none}.rv .when b{display:block;font-weight:600}.rv .when span{color:var(--muted);font-size:14px}
.rv .r{width:230px;flex:none;text-align:left!important}
.ag{align-items:flex-start!important}.ag .s{width:164px;flex:none;padding-top:1px}.ag .t b{font-weight:600}.ag .t .why{display:block;color:var(--fg-2);font-size:14px}.ag .t .who{display:block;color:var(--muted);font-size:14px}
.ag .v{width:150px;flex:none;text-align:right;font-size:14px;color:var(--muted)}.ag .v b{display:block;color:var(--fg);font-size:15px}
.fold{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:52px;padding:8px 16px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.rrow b{font-weight:600}.rrow .hint{display:block}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.pl{display:flex;flex-direction:column;gap:6px}
.pk{display:flex;gap:8px;align-items:center}.pk .input{flex:1;min-width:0}
.sel2{justify-content:space-between}.sel2:after{content:"";width:8px;height:8px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.area{min-height:76px;align-items:flex-start;padding-top:10px;padding-bottom:10px;white-space:normal}
.chosen{border:1px solid var(--line);border-radius:10px;background:var(--surface)}.chosen div{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;align-items:center}.chosen div+div{border-top:1px solid var(--line-2)}.chosen span span{display:block;color:var(--muted);font-size:14px}
.frame{max-width:620px;margin:0 auto;padding:8px 0 24px}.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.fstack{display:flex;flex-direction:column;gap:22px}.ffoot{display:flex;justify-content:flex-end;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.wbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:20px}
.wbar .where b,.wbar .where a{display:block}.wbar .where span{color:var(--muted);font-size:14px}
.whyline{display:flex;gap:8px;align-items:flex-start;font-weight:600;flex-wrap:wrap}.whyline .warn{white-space:nowrap;flex:none}.whyline>span:last-child{flex:1 1 240px}.layout .score b{font-size:19px;line-height:26px}
.gtitle{display:flex;flex-direction:column;gap:6px}.big{font-size:26px;line-height:32px;font-weight:650}
.said{display:flex;flex-direction:column;gap:2px}.said .label{margin-bottom:2px}
.steprow{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line-2)}.steprow:first-child{border-top:0;padding-top:0}.steprow span span{display:block;color:var(--muted);font-size:14px}
.decide{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:12px}
.quiet{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}
.minichart{height:120px}
.read{border:1px solid var(--line);border-radius:10px;background:var(--surface)}.read>div{padding:14px 16px}.read>div+div{border-top:1px solid var(--line-2)}
.read h3{margin-bottom:6px}.read .ln{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:6px 0}.read .ln span span{display:block;color:var(--muted);font-size:14px}
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px}
.phones{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}.ph{width:358px;flex:none;border:1px solid var(--line);border-radius:18px;background:var(--bg);padding:14px;display:flex;flex-direction:column;gap:14px}
.ph .pbar{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--line);padding-bottom:10px}.ph .pbar b{display:block}.ph .pbar span{font-size:13px;color:var(--muted)}
.ph .pfoot{display:flex;gap:8px;border-top:1px solid var(--line);padding-top:12px}.ph .pfoot .btn{flex:1;min-height:48px}
.ph .score{grid-template-columns:1fr 1fr}.ph .score div:nth-child(3){border-left:0}.ph .score div:nth-child(n+3){border-top:1px solid var(--line-2)}.ph .score b{font-size:17px;line-height:24px}
.ph .btn{min-height:44px}.ph .ag{flex-wrap:wrap}.ph .ag .s{width:100%}.chosen .st{display:inline-flex!important;font-size:15px!important;color:inherit}.chosen .st.off{color:var(--off)!important}.chosen .st.on{color:var(--on)!important}
.pres{max-width:1340px;margin:0 auto}.pres h1{font-size:40px;line-height:46px}.pres .big{font-size:40px;line-height:46px}.pres p,.pres .whyline{font-size:19px;line-height:28px}.pres .score b{font-size:28px;line-height:34px}.pres .score span{font-size:15px}
.pres .aside{width:420px}.pres .hint{font-size:16px;line-height:23px}.pres .label{font-size:14px}
.iconbtn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;min-width:40px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600}
@media (max-width:700px){
 .rv .when,.rv .r{width:100%}.ag .s{width:100%}.ag .v{width:100%;text-align:left}.ag .v b{display:inline;margin-right:6px}
 .wbar .acts{width:100%}.wbar .acts .iconbtn{flex:1}
 .phones{gap:20px}.ph{width:100%}
 .frame .top,.frame .tabbar{display:none}.ffoot .btn{flex:1}
 .pres h1,.pres .big{font-size:26px;line-height:32px}.pres p,.pres .whyline{font-size:16px;line-height:24px}
 .head .btn{align-self:flex-start}.head .row.nowrap{flex-wrap:wrap}.wbar .acts{flex-wrap:wrap!important}.wbar .acts .iconbtn{flex:1 1 40%}
 .read .ln{flex-wrap:wrap}.pres .aside{width:auto}
}
</style>`;

const S = {};
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const closed = (t) => `<div class="pk"><span class="input filled">${t}</span><a class="btn quiet">Change</a></div>`;
const ag = (k, title, why, who, value, gap, wash = k === 'off') => `<li class="ag ${wash ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span class="why">${why}</span><span class="who">${who}</span></span><span class="v"><b class="num">${value}</b>${gap}</span></li>`;
const grp = (t) => `<li class="grp">${t}</li>`;
const score = (a) => `<div class="score">${a.map(([l, b, s]) => `<div><span>${l}</span><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
const chart = `<div class="chart minichart"><svg viewBox="0 0 600 120" preserveAspectRatio="none"><g stroke="#E4E1D9" stroke-width="1"><path d="M0 30H600M0 60H600M0 90H600"/></g><path d="M10 14 L590 104" fill="none" stroke="#9AA3A1" stroke-width="1.4" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/><path d="M10 16 L120 30 L240 46 L330 54 L420 56 L500 55 L520 56" fill="none" stroke="#183638" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg><span class="hint" style="position:absolute;left:10px;bottom:4px">Plan (dashed) and actual, weeks 1 to 45</span></div>`;

/* ---------- 1. The list of reviews ---------- */
const rv = (name, cad, when, whenSub, agenda, steps, people) => `<li class="rv"><span class="t"><b>${name}</b><span>${cad} · ${people}</span></span><span class="when"><b>${when}</b><span>${whenSub}</span></span><span class="r wide">${agenda}<br>${steps}</span><span class="chev">›</span></li>`;
S['01-reviews-list'] = shell({ title: 'Reviews', cur: 'Reviews', who: 'rhea', body: `${CSS}
<div class="head"><div class="stack"><h1>Reviews</h1><p class="hint">A review walks a set of goals together on a set day, decides what happens next, and opens next time with what was agreed.</p></div><span class="btn">Set up a review</span></div>
<div class="bar"><span class="input">Find a review by name, person or goal</span><span class="row desk-only" style="gap:8px"><span class="btn on">Yours · 1</span><span class="btn">All · 6</span></span><span class="btn phone-only">Yours · 1</span></div>
<p class="countline"><b>6 reviews</b>, yours first, then the soonest.</p>
<ul class="list">
${grp('You’re in · 1')}
${rv('Developer Productivity fortnightly', 'Every 2 weeks, Tuesdays', warn('Was due Tue 10 Nov, yesterday'), 'Can be held until Mon 23 Nov · then Tue 24 Nov', '10 to discuss · 25 with nothing flagged', '1 open next step from earlier', '6 people')}
${grp('Other reviews · 5')}
${rv('Reliability weekly', 'Every week, Wednesdays', 'Today, Wed 11 Nov', 'Last held Wed 4 Nov', '6 to discuss · 14 with nothing flagged', 'No open next steps', '6 people')}
${rv('Platform leadership weekly', 'Every week, Thursdays', 'Thu 12 Nov, tomorrow', 'Last held Thu 5 Nov', '20 to discuss · 36 with nothing flagged', '4 open next steps', '10 people')}
${rv('Data &amp; ML sync', 'Every week, Mondays', 'Mon 16 Nov, in 5 days', 'Held Mon 9 Nov', '4 to discuss · 9 with nothing flagged', '1 open next step', '5 people')}
${rv('Security monthly', 'Every 4 weeks, Tuesdays', 'Tue 24 Nov, in 13 days', 'Last held Tue 3 Nov', '5 to discuss · 10 with nothing flagged', warn('1 next step overdue'), '6 people')}
${rv('Quarterly business review', 'Every 13 weeks, Wednesdays', 'Wed 23 Dec, in 6 weeks', 'Last held Wed 30 Sept', '20 to discuss · 36 with nothing flagged', '1 open next step', '10 people')}
</ul>
${note('Wireframe 1. The list of reviews as Rhea, Wed 11 Nov. One list bar (search, Yours or All), a count line, and one row per review: its name and cadence; when the session is, with the weekday and the date, and when it was last held; what is on the agenda; what is still open from earlier. A session past its day says so with the warning mark and says how long it can still be held. Today the outstanding row drops “Last held”, a state is a square shape, and work agreed is called “Open actions” (V11, V16, V18).')}` });

/* ---------- 2. Setting one up ---------- */
S['02-set-up'] = shell({ bare: true, title: 'Set up a review', body: `${CSS}
<div class="frame"><div class="fhead"><div class="stack" style="gap:2px"><b>Set up a review</b><span class="hint">Anyone can set one up. You can change all of it later.</span></div><span class="btn sm">Close without saving</span></div>
<div class="fstack">
${fl('Name', `<span class="input filled">CI/CD weekly</span>`)}
<div class="field"><b>Which goals</b>
<div class="chosen">
<div><span><b>Lead time for changes</b> and everything under it<span>A goal and what feeds it · 17 goals</span></span><a>Remove</a></div>
<div><span><b>CI/CD</b>, the team’s goals<span>A team · 9 goals, 6 of them already counted above</span></span><a>Remove</a></div>
</div>
<div class="row"><span class="btn">Add goals</span></div>
<div class="panel" style="gap:8px"><span class="label">Add goals: choose one way, as often as you like</span>
<div class="pl">${rad('A goal and everything under it', true, 'Find the goal; the review follows its tree as goals are added under it.')}${rad('A team’s goals', false, 'Every goal the team owns, now and later.')}${rad('Every goal at a level', false, 'North star, SVP or Team.')}${rad('Goals I pick one by one', false, 'Only these, until you change the list.')}</div>
<span class="input focus filled">lead</span>
<div class="chosen"><div style="background:var(--surface-2);font-size:12px;font-weight:600;color:var(--muted)"><span>2 match</span></div>
<div><span>${st('off')} <b>Lead time for changes</b><span>G-1 · Rhea Kapoor · CI/CD · 17 goals with it</span></span></div>
<div><span>${st('on')} <b>Lead time for security patches</b><span>G-88 · Farah Siddiqui · Security · 4 goals with it</span></span></div></div></div>
</div>
<div class="field"><b>Who takes part</b>
<div class="chosen"><div><span><b>Rhea Kapoor (you)</b><span>Engineering Manager, CI/CD · CI/CD</span></span><a>Remove</a></div>
<div><span><b>Pavel Novák</b><span>Engineering Manager, Build &amp; Release · owns 4 of these goals</span></span><a>Remove</a></div></div>
<div class="row"><span class="btn">Add a person</span><a>Add the 5 other owners of these goals</a></div>
<p class="hint">People in a review can start it, decide in it and finish it. Everyone else can read it.</p></div>
<div class="field"><b>When</b>
<div class="row" style="align-items:stretch"><span class="input filled sel2" style="flex:1 1 180px">Every week</span><span class="input filled sel2" style="flex:1 1 160px">Thursday</span></div>
<p class="hint">The first is Thu 12 Nov, tomorrow; then Thu 19 Nov, Thu 26 Nov.</p></div>
<div class="field"><b>What you’re setting up</b>
<div class="panel"><p><b>CI/CD weekly</b> walks <b>20 goals</b> every week on Thursdays, first on <b>Thu 12 Nov</b>, with 2 people.</p>
<p>Today that is 7 to discuss (5 off track, 2 at risk) and 13 with nothing flagged.</p>
<p>${warn('Check')} 17 of the 20 are also in Developer Productivity fortnightly. That is allowed: each review keeps its own record, and a goal’s page shows both.</p>
<p class="hint">Nothing is asked of anyone until you start it. Rhea and Pavel see it on Home from tomorrow.</p></div></div>
</div>
<div class="ffoot"><span class="btn primary">Set up the review</span></div></div>
${note('Wireframe 2. Setting a review up, one screen, 620 px. Goals are added in one of four ways, each found by typing (the chooser is shown open on the first way): a goal and everything under it, a team’s goals, a level, or picked one by one. Who takes part is find-and-pick, with the owners of the chosen goals offered. “When” says the first dates. The last block reads it all back before anything is saved, in counts, and says when goals overlap another review. Today there is no team, the trees are a list of every top goal, the levels are capsule buttons, and nothing is read back or dated (V8, V9).')}` });

/* ---------- 3. Preparing ---------- */
S['03-prepare'] = shell({ title: 'Developer Productivity fortnightly', cur: 'Reviews', who: 'rhea', body: `${CSS}
<a class="back">‹ Reviews</a>
<div class="head"><div class="stack"><h1>Developer Productivity fortnightly</h1><p class="sub">Every 2 weeks, Tuesdays · 6 people · 35 goals</p><p>${warn('Was due Tue 10 Nov, yesterday.')} <span class="sub">It can still be held until Mon 23 Nov. The next is Tue 24 Nov.</span></p></div>
<div class="row nowrap"><span class="btn primary">Start the review</span><span class="btn">Print the one-pager</span><span class="btn">More</span></div></div>

<div class="sec"><h2>Before you meet</h2>
<div class="read">
<div><div class="ln"><span><b>4 of the 35 goals have no check-in for week 46.</b><span>Pavel Novák (2), Diego Ramírez, Chen Wei. Check-ins are due by Thu 12 Nov.</span></span><span class="btn sm">Ask them for an update</span></div></div>
<div><div class="ln"><span><b>1 goal has had no check-in since week 44.</b><span>Security gate in every deploy pipeline · Ben Carter</span></span><span class="btn sm">Ask Ben for an update</span></div></div>
</div></div>

<div class="sec"><h2>From last time <em>Tue 27 Oct</em></h2>
<ul class="list">
<li class="ag"><span class="s">${warn('Open')}</span><span class="t"><b>Name a review rota for the last repositories without one.</b><span class="who">Tariq Haddad · by Thu 19 Nov · Repositories covered by a named review rota</span></span></li>
<li class="ag"><span class="s"><b>Waiting</b></span><span class="t"><b>“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”</b><span class="who">Daniel asked Rhea Kapoor 8 days ago · Pipeline queue wait (p90)</span></span><span class="btn sm">Answer</span></li>
<li class="ag"><span class="s"><b>Done</b></span><span class="t"><b>Fix the two shared fixtures behind the new flakes.</b><span class="who">Aiko Tanaka · done in week 45 · Flaky test rate in the main pipelines</span></span></li>
</ul></div>

<div class="sec"><h2>To discuss <em>10, worst first</em></h2>
<ul class="list">
${grp('Needs a decision · 8')}
${ag('off', 'Merge-to-deploy time (median)', 'No next step. Its back-on-plan date has moved from week 31 to week 51.', 'Pavel Novák · Build &amp; Release', '5.5 hours', '2.4 hours behind plan')}
${ag('off', 'Merge queue live for every monorepo', 'Waiting on Daniel Okafor: agree to run without batching on the web monorepo.', 'Diego Ramírez · CI/CD', '2 of 4 stages', 'Late')}
${ag('off', 'Autoscaling CI runner pools', 'Waiting on Amara Nwosu: approve the extra CI runner budget for Q4, asked 4 Aug.', 'Johanna Virtanen · Infrastructure', '2 of 4 stages', 'Late')}
${ag('off', 'Pipeline queue wait (p90)', 'Getting worse for three check-ins. A question from last time is waiting.', 'Rhea Kapoor · CI/CD', '7 min', '3 min behind plan')}
${ag('off', 'Lead time for changes', 'Checked in since its next step was agreed: 9 hours behind, and the gap grew.', 'Rhea Kapoor · CI/CD', '37 hours', '9 hours behind plan')}
${ag('stale', 'Security gate in every deploy pipeline', 'No check-in for 16 days. Its last was on track.', 'Ben Carter · Security', '90%', 'as of week 44')}
${ag('risk', 'Jenkins jobs still running', 'No next step, and nobody has said how it gets back.', 'Chen Wei · Build &amp; Release', '72 jobs', '21 jobs behind plan')}
${ag('risk', 'Manual release sign-offs replaced by automated quality gates', 'No next step. Recovering: the number is moving again.', 'Rhea Kapoor · CI/CD', '75%', '5 pts behind plan')}
${grp('Being handled · 2 · confirm and move on')}
${ag('risk', 'Repositories covered by a named review rota', 'Next step open from last time: Tariq, by Thu 19 Nov.', 'Tariq Haddad · Developer Experience', '85%', '3 pts behind plan')}
${ag('risk', 'Flaky test rate in the main pipelines', 'Next step done in week 45; back to the planned pace for three weeks.', 'Rhea Kapoor · CI/CD', '1.8%', 'Near the 2.0% limit')}
</ul>
<div class="fold"><span><b>Nothing flagged · 25</b> <span class="sub">22 on track, 3 done. Reviewed together at the end.</span></span><a>Show them</a></div></div>

<div class="sec"><h2>People <em>6</em></h2><p>Daniel Okafor, Tariq Haddad, Rhea Kapoor, Pavel Novák, Diego Ramírez, Nadia Petrova. <a>Change</a></p></div>
<div class="sec"><h2>Earlier sessions</h2><p><a>Tue 27 Oct</a> · 3 next steps, 1 question. <a>Tue 13 Oct</a> · 2 next steps, 1 risk accepted. <a>All 4</a></p></div>
${note('Wireframe 3. Preparing, as Rhea the day after the session’s date. One primary action, “Start the review”. “Before you meet” names who has not checked in, with one button that asks them. “From last time” lists every next step and question still open from earlier sessions, not only the last one, and what was done since. “To discuss” says in one line why each goal is there, worst first, in two groups; the 25 with nothing flagged are folded and counted. Today the agenda rows give no reason, nothing says who has not checked in, and an earlier session’s record cannot be opened (V5, V6, V12).')}` });

/* ---------- 4. A troubled goal in the walkthrough ---------- */
const wbar = (n, of, extra = '') => `<div class="wbar"><div class="where"><a>‹ Developer Productivity fortnightly</a><span>Goal ${n} of ${of} to discuss${extra}</span></div><div class="row acts nowrap" style="gap:8px"><span class="iconbtn">‹ Previous</span><span class="iconbtn">Next ›</span><span class="iconbtn">Agenda</span><span class="iconbtn desk-only">Present</span></div></div>`;
const decideBlock = `<div class="decide"><h2>What happens next?</h2>
<div class="pl">
${rad('A next step', true)}
</div>
${fl('What needs doing', `<span class="input filled area">Move the payments monorepo to the merge queue first; it holds most of the waiting changes.</span>`)}
${fl('Who', closed('Pavel Novák · owns this goal'))}
${fl('By', closed('Week 48 · Tue 24 Nov, the next session'))}
<div class="pl">
${rad('We accept the risk', false, 'No action for now, with the reason.')}
${rad('Ask Pavel a question', false, 'Open until he answers; first on next time’s agenda.')}
${rad('Agree a new goal', false, 'Its owner sets it up afterwards.')}
</div>
<span class="btn primary">Save and go to the next goal</span>
<div class="quiet"><a>Come back to it later</a><a>Add a note</a></div></div>`;
const goalBody = `<div class="gtitle"><p class="whyline">${warn('On the agenda because:')}<span>it has no next step, and its back-on-plan date has moved from week 31 to week 51.</span></p>
<h1>Merge-to-deploy time (median)</h1><p class="sub">Pavel Novák, Build &amp; Release · SVP · G-6 · checked in Wed 4 Nov, week 45</p>
<p>${st('off')} <span class="big num" style="margin-left:8px">5.5 hours</span></p></div>
${score([['Vs plan', '2.4 hours behind', 'plan 3.1 hours in week 45'], ['Vs last week', '0.2 hours better', 'was 5.7 hours'], ['To target', '3.5 hours over', 'target 2.0 hours'], ['Will it hit 2.0?', 'Very unlikely', 'likely 5.6 hours by year end']])}
<div class="said"><span class="label">Pavel said in week 45</span><p>Blocked by a dependency. Half of the merge queue is done; the rest waits on CI/CD’s release, now planned for next month.</p></div>
<div class="said"><span class="label">How it gets back</span><p>Move the payments monorepo to the merge queue first. Back on plan by week 51 (14–20 Dec); first said week 31.</p></div>
<div class="sec" style="margin-top:0"><h3>Next steps and asks</h3><p class="hint">No next step yet. Nobody has said what happens next, who does it and by when.</p></div>
${chart}
<p class="hint">Also in Platform leadership weekly (Thu 12 Nov): reviewed there on Thu 5 Nov, nothing added. <a>Open the goal’s page</a></p>`;
S['04-walk-troubled'] = shell({ title: 'Developer Productivity fortnightly', cur: 'Reviews', who: 'rhea', width: 'wide', body: `${CSS}
${wbar(1, 10)}
<div class="layout"><div class="body" style="gap:18px">${goalBody}</div><div class="aside">${decideBlock}</div></div>
${note('Wireframe 4. A troubled goal in the walkthrough, the review’s own page (/reviews/devprod/walk/G-6), not the goal’s page with a bar over it. First, why it is on the agenda. Then what the room needs and no more: the status and number, the four comparisons, what the owner said, how it gets back, what is already agreed or asked, a small chart. Beside it, the decision: “A next step” is open already, with the goal’s owner and the next session’s week filled in, so the common case is a sentence and one press. Today the same decision is five presses in a sheet, on a page 1,400 px tall with a 192 px bar across its foot (V3, V4, V7).')}` });

/* ---------- 5. The healthy run ---------- */
const hrow = (k, t, who, v, g) => `<li class="ag"><span class="s">${st(k)}</span><span class="t"><b>${t}</b><span class="who">${who}</span></span><span class="v"><b class="num">${v}</b>${g}</span></li>`;
S['05-walk-healthy'] = shell({ title: 'Developer Productivity fortnightly', cur: 'Reviews', who: 'rhea', body: `${CSS}
<div class="wbar"><div class="where"><a>‹ Developer Productivity fortnightly</a><span>All 10 discussed · the 25 with nothing flagged</span></div><div class="row acts nowrap" style="gap:8px"><span class="iconbtn">‹ Previous</span><span class="iconbtn">Agenda</span></div></div>
<div class="head"><div class="stack"><h1>Nothing flagged · 25</h1><p class="sub">22 on track, 3 done. None is behind, getting worse, waiting on anyone or overdue. Review them together, or open one to talk about it.</p></div><span class="btn primary">Review all 25 and finish</span></div>
<ul class="list">
${grp('Changed since last time · 3')}
${hrow('done', 'Pull-through registry cache in every region', 'Diego Ramírez · reached its target in week 45', '4 of 4 stages', 'Target reached')}
${hrow('on', 'Test suites split into parallel shards', 'Rhea Kapoor · was at risk on Tue 27 Oct', '80%', '1 pt ahead of plan')}
${hrow('on', 'Time from pull request opened to first review', 'Tariq Haddad · the one input of lead time moving the right way', '8.1 hours', '0.3 hours behind plan')}
${grp('As they were · 22')}
${hrow('on', 'Production deploys per day', 'Pavel Novák · North star', '106 deploys', '3 ahead of plan')}
${hrow('on', 'CI pipeline time on main (p90)', 'Rhea Kapoor · North star', '19 min', 'On plan')}
${hrow('on', 'Release freeze days per quarter', 'Pavel Novák', '4 days', 'Inside the 6 days limit')}
</ul>
<div class="fold" style="margin-top:10px"><span>19 more on track or done, as they were</span><a>Show them</a></div>
<p class="hint" style="margin-top:14px">Opening a row walks that goal like the others: say something about it, or mark it reviewed by itself.</p>
${note('Wireframe 5. The healthy run: one screen after the last goal to discuss. The goals with nothing flagged are counted and grouped by whether anything changed since the last session, so the three worth a sentence (one reached its target, one recovered) are on top; the other 22 fold away. One primary action reviews them together and goes to Finish. Today this is a button on the review’s page, “Mark 25 goals reviewed”, reached by leaving the walkthrough (V4).')}` });

/* ---------- 6. Finish, and the page afterwards ---------- */
const ln = (a, b, c = 'Change') => `<div class="ln"><span><b>${a}</b><span>${b}</span></span>${c ? `<a>${c}</a>` : ''}</div>`;
S['06-finish'] = shell({ title: 'Developer Productivity fortnightly', cur: 'Reviews', who: 'rhea', body: `${CSS}
<div class="state"><span class="label">(a) Finish: everything decided, read back before it is recorded</span>
<a class="back">‹ Back to the goals</a>
<div class="head"><div class="stack"><h1>Finish Developer Productivity fortnightly</h1><p class="sub">The session of Tue 10 Nov, held today, Wed 11 Nov. 35 goals: 8 decided, 2 confirmed, 25 with nothing flagged.</p></div><span class="btn primary">Finish the review</span></div>
<div class="read">
<div><h3>Next steps · 5, by who does them</h3>
${ln('Pavel Novák · 2', 'Move the payments monorepo to the merge queue first · by Tue 24 Nov · Merge-to-deploy time (median)')}
${ln('', 'Name an owner for the last 21 Jenkins jobs · by Tue 24 Nov · Jenkins jobs still running')}
${ln('Daniel Okafor · 1', 'Decide whether the web monorepo runs without batching · by Tue 17 Nov · Merge queue live for every monorepo')}
${ln('Rhea Kapoor · 1', 'Set up a goal: Runner wait for release builds · by Tue 24 Nov · feeds Pipeline queue wait (p90)')}
${ln('Ben Carter · 1', 'Check in on the security gate, or say what is blocking it · by Thu 12 Nov · Security gate in every deploy pipeline')}</div>
<div><h3>Risks accepted · 2</h3>
${ln('Autoscaling CI runner pools', 'Nothing to do until the Q4 budget decision on Thu 12 Nov. It still needs attention.')}
${ln('Manual release sign-offs replaced by automated quality gates', 'Recovering by itself; look again in two weeks. It still needs attention.')}</div>
<div><h3>Questions asked · 1</h3>
${ln('Rhea Kapoor', '“What is the earliest week lead time is back under 30 hours if the budget lands?” · Lead time for changes · open until answered')}</div>
<div><h3>From last time</h3>
${ln('1 done, 1 still open', 'Tariq Haddad: name a review rota for the last repositories without one · by Thu 19 Nov', '')}</div>
<div><h3>Reviewed with nothing to add · 27</h3><p class="sub">2 being handled and the 25 with nothing flagged. <a>Show them</a></p></div>
</div>
<p class="hint" style="margin-top:12px">Each person sees their next steps on Home and on the goal. You can reopen this session until Tue 24 Nov.</p>
</div>

<div class="state"><span class="label">(b) Afterwards: what everyone sees on the review’s page</span>
<a class="back">‹ Reviews</a>
<div class="head"><div class="stack"><h1>Developer Productivity fortnightly</h1><p class="sub">Every 2 weeks, Tuesdays · 6 people · 35 goals</p><p><b>Held Wed 11 Nov</b>, finished by Rhea Kapoor. <span class="sub">The next is Tue 24 Nov, in 13 days.</span></p></div>
<div class="row nowrap"><span class="btn">Copy the summary</span><span class="btn">Print</span><span class="btn">Reopen this session</span></div></div>
<div class="read"><div><h3>Next steps · 5</h3>${ln('Pavel Novák · 2', 'Move the payments monorepo to the merge queue first · by Tue 24 Nov · Open', '')}${ln('', 'and 4 more, as above', '')}</div>
<div><h3>Risks accepted · 2 &nbsp; Questions asked · 1 &nbsp; Reviewed with nothing to add · 27</h3></div></div>
</div>
${note('Wireframe 6. (a) Finish is a page, not a sheet: everything decided in the room, read back in the order people need it (who does what by when, what was accepted and why, what was asked, how last time’s promises stand), each line with “Change”, then one primary action. (b) Afterwards the review’s page leads with the same record and says who finished it; anyone in the review can reopen it until the next session, copy the summary as text for the team’s channel, or print it. Today an accepted risk is filed under “Notes”, Undo lives only on a message that disappears, and only the person who pressed Finish can use it (V2, V10, V13).')}` });

/* ---------- 7. The next session's opening ---------- */
S['07-next-opening'] = shell({ title: 'Developer Productivity fortnightly', cur: 'Reviews', who: 'rhea', body: `${CSS}
<div class="wbar"><div class="where"><a>‹ Developer Productivity fortnightly</a><span>Tue 24 Nov · before the 9 goals to discuss</span></div><div class="row acts nowrap" style="gap:8px"><span class="iconbtn">Agenda</span><span class="iconbtn desk-only">Present</span></div></div>
<div class="head"><div class="stack"><h1>Since last time</h1><p class="sub">Held Wed 11 Nov. 5 next steps were agreed, 2 risks accepted and 1 question asked. Here is how each stands today.</p></div><span class="btn primary">Go to the first goal</span></div>
<div class="sec"><h2>Next steps <em>2 done, 2 open, 2 overdue</em></h2>
<ul class="list">
<li class="ag"><span class="s">${warn('Overdue by 1 week')}</span><span class="t"><b>Decide whether the web monorepo runs without batching.</b><span class="who">Daniel Okafor · was by Tue 17 Nov · Merge queue live for every monorepo</span></span><span class="btn sm">Mark done</span></li>
<li class="ag"><span class="s">${warn('Overdue by 1 week')}</span><span class="t"><b>Name a review rota for the last repositories without one.</b><span class="who">Tariq Haddad · was by Thu 19 Nov · agreed Tue 27 Oct, two sessions ago</span></span><span class="btn sm">Mark done</span></li>
<li class="ag"><span class="s"><b>Open</b></span><span class="t"><b>Move the payments monorepo to the merge queue first.</b><span class="who">Pavel Novák · by today, Tue 24 Nov · Merge-to-deploy time (median)</span></span><span class="btn sm">Mark done</span></li>
<li class="ag"><span class="s"><b>Open</b></span><span class="t"><b>Set up a goal: Runner wait for release builds.</b><span class="who">Rhea Kapoor · by today, Tue 24 Nov · feeds Pipeline queue wait (p90)</span></span><span class="btn sm">Set up the goal</span></li>
<li class="ag"><span class="s"><b>Done</b></span><span class="t"><b>Name an owner for the last 21 Jenkins jobs.</b><span class="who">Pavel Novák · done Thu 19 Nov: “Chen has them; list in the runbook.”</span></span></li>
<li class="ag"><span class="s"><b>Done</b></span><span class="t"><b>Check in on the security gate, or say what is blocking it.</b><span class="who">Ben Carter · done Thu 12 Nov · the goal is on track again</span></span></li>
</ul></div>
<div class="sec"><h2>Questions <em>1 answered</em></h2>
<ul class="list"><li class="ag"><span class="s"><b>Answered</b></span><span class="t"><b>“What is the earliest week lead time is back under 30 hours if the budget lands?”</b><span class="who">Rhea Kapoor answered Fri 13 Nov: “Week 50, if the runners are autoscaling by week 48.” · Lead time for changes</span></span></li></ul></div>
<div class="sec"><h2>Risks accepted last time <em>2, both still behind</em></h2>
<ul class="list">
<li class="ag offwash"><span class="s">${st('off')}</span><span class="t"><b>Autoscaling CI runner pools</b><span class="why">Accepted on Wed 11 Nov: “Nothing to do until the Q4 budget decision on Thu 12 Nov.”</span><span class="who">It has checked in since, so it is first on today’s agenda.</span></span></li>
<li class="ag"><span class="s">${st('risk')}</span><span class="t"><b>Manual release sign-offs replaced by automated quality gates</b><span class="why">Accepted on Wed 11 Nov: “Recovering by itself; look again in two weeks.”</span><span class="who">Second on today’s agenda.</span></span></li>
</ul></div>
${note('Wireframe 7. The next session’s opening: the first step of the walkthrough, before any goal. Every next step agreed in this review that is still open, from any earlier session, worst first, then what was done since; each can be marked done from here, in the room, by whoever may. Then the answers that came in, and the risks accepted last time with how those goals stand now. One primary action goes to the first goal. Today “Last time” shows only the latest session’s next steps: a session that only accepted risks leaves the next one with no opening at all, and a next step from two sessions ago drops out while still open (V1).')}` });

/* ---------- 8. The walkthrough on a phone ---------- */
const pbar = (a, b, c = 'Agenda') => `<div class="pbar"><div><b>${a}</b><span>${b}</span></div><span class="iconbtn">${c}</span></div>`;
const pTop = `<p class="whyline">${warn('Here because:')}<span>no next step; its date moved from week 31 to week 51.</span></p>
<div class="gtitle"><h2>Merge-to-deploy time (median)</h2><p class="sub">Pavel Novák · Build &amp; Release · week 45</p><p>${st('off')} <span class="strong num" style="font-size:20px;margin-left:6px">5.5 hours</span></p></div>`;
S['08-walk-phone'] = shell({ bare: true, title: 'The walkthrough on a phone', body: `${CSS}
<div class="phones">
<div class="ph"><span class="label">(a) A troubled goal</span>
${pbar('Dev Productivity fortnightly', 'Goal 1 of 10 to discuss')}
${pTop}
${score([['Vs plan', '2.4 hours behind', 'plan 3.1'], ['Vs last week', '0.2 hours better', 'was 5.7'], ['To target', '3.5 hours over', 'target 2.0'], ['Will it hit 2.0?', 'Very unlikely', 'likely 5.6']])}
<div class="said"><span class="label">Pavel said in week 45</span><p>Blocked by a dependency. Half of the merge queue is done; the rest waits on CI/CD’s release. <a>More</a></p></div>
<p class="hint">No next step yet. <a>Show the chart</a> · <a>Open the goal’s page</a></p>
<div class="pfoot"><span class="btn">‹</span><span class="btn primary" style="flex:4">Decide</span><span class="btn">›</span></div></div>

<div class="ph"><span class="label">(b) Deciding: a sheet from the foot</span>
${pbar('What happens next?', 'Merge-to-deploy time (median)', 'Close')}
<div class="pl">${rad('A next step', true)}</div>
${fl('What needs doing', `<span class="input filled area">Move the payments monorepo to the merge queue first.</span>`)}
${fl('Who', closed('Pavel Novák'))}
${fl('By', closed('Week 48 · Tue 24 Nov'))}
<div class="pl">${rad('We accept the risk', false)}${rad('Ask Pavel a question', false)}${rad('Agree a new goal', false)}</div>
<div class="quiet"><a>Come back to it later</a><a>Add a note</a></div>
<div class="pfoot"><span class="btn">Cancel</span><span class="btn primary" style="flex:2">Save and next</span></div></div>

<div class="ph"><span class="label">(c) The healthy run</span>
${pbar('Dev Productivity fortnightly', 'All 10 discussed')}
<h2>Nothing flagged · 25</h2><p class="sub">22 on track, 3 done. Review them together, or open one.</p>
<ul class="list">${grp('Changed since last time · 3')}
<li class="ag"><span class="s">${st('done')}</span><span class="t"><b>Pull-through registry cache in every region</b><span class="who">Diego Ramírez · reached its target</span></span></li>
<li class="ag"><span class="s">${st('on')}</span><span class="t"><b>Test suites split into parallel shards</b><span class="who">Rhea Kapoor · was at risk last time</span></span></li>
<li class="ag"><span class="s">${st('on')}</span><span class="t"><b>Time from pull request opened to first review</b><span class="who">Tariq Haddad · 8.1 hours</span></span></li></ul>
<div class="fold"><span>22 more, as they were</span><a>Show</a></div>
<div class="pfoot"><span class="btn">‹</span><span class="btn primary" style="flex:4">Review all 25 and finish</span></div></div>
</div>
${note('Wireframe 8. The walkthrough on a phone (three screens; at 1440 px they sit side by side). (a) A goal is one screen: why it is here, the status and number, the four comparisons, the owner’s words cut to three lines, with the chart folded away. The foot holds Previous, one button “Decide” and Next, each 48 px. (b) “Decide” opens the same block as on a computer, as a sheet, with “A next step” open and its owner and week filled in. (c) The healthy run and its one button. Today the review’s bar and the decision bar take 272 of 844 px, and “Skip for now” is not on a phone at all (V14).')}` });

/* ---------- 9. Presenting on a big screen ---------- */
S['09-present'] = shell({ bare: true, title: 'Presenting', body: `${CSS}
<div class="pres">
<div class="wbar"><div class="where"><b>Developer Productivity fortnightly</b><span>Goal 4 of 10 to discuss</span></div><div class="row acts nowrap" style="gap:8px"><span class="iconbtn">‹ Previous</span><span class="iconbtn">Next ›</span><span class="iconbtn">Agenda</span><span class="iconbtn">Stop presenting</span></div></div>
<div class="layout"><div class="body" style="gap:22px">
<p class="whyline">${warn('On the agenda because:')}<span>it is getting worse, three check-ins running, and a question from last time is waiting.</span></p>
<div class="gtitle"><h1>Pipeline queue wait (p90)</h1><p class="sub" style="font-size:19px">Rhea Kapoor, CI/CD · SVP · G-4 · checked in Mon 9 Nov, week 46</p><p>${st('off')} <span class="big num" style="margin-left:10px">7 min</span></p></div>
${score([['Vs plan', '3 min behind', 'plan 4 min in week 46'], ['Vs last week', '1 min worse', 'was 6 min'], ['To target', '4 min over', 'target 3 min'], ['Will it hit 3?', 'Very unlikely', 'likely 7 min by year end']])}
<div class="said"><span class="label">Rhea said in week 46</span><p>Blocked by a dependency. Waiting on Infrastructure &amp; Compute to sign off the design before the rollout can go wider.</p></div>
<div class="sec" style="margin-top:0"><h3>Next steps and asks</h3>
<div class="steprow"><span><b>Decision or help: approve the extra CI runner budget for Q4</b><span>Asked of Amara Nwosu on 4 Aug · for 3 goals · Open</span></span></div>
<div class="steprow"><span><b>Question: “If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”</b><span>Daniel asked last time · Waiting</span></span><span class="btn sm">Answer</span></div></div>
</div><div class="aside"><div class="decide"><h2>What happens next?</h2>
<div class="pl">${rad('A next step', true)}</div>
${fl('What needs doing', `<span class="input area">Say what, in a sentence</span>`)}
${fl('Who', closed('Rhea Kapoor · owns this goal'))}
${fl('By', closed('Week 48 · Tue 24 Nov, the next session'))}
<div class="pl">${rad('We accept the risk', false)}${rad('Ask a question', false)}${rad('Agree a new goal', false)}</div>
<span class="btn primary">Save and go to the next goal</span>
<div class="quiet"><a>Come back to it later</a><a>Add a note</a></div></div></div></div>
</div>
${note('Wireframe 9. Presenting on a big screen: the same page with the menu put away and the type a third larger, so a room reads it from the back; nothing else is different, and one press or Escape returns to the ordinary page. The goal fits one screen at 1920 × 1080 with no scrolling. It is the review’s own page, so whoever is presenting types the decision where everyone can see it being written. Today the walkthrough is the goal’s page at 15 px with the sidebar beside it (V15).')}` });

kit.render(__dirname, S);
