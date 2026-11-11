/* Wireframes for the end of a cycle (docs/design/cycle-end/README.md, spec.md section 2).
   Usage: node docs/design/cycle-end/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md.
   The year is the demo's: 2026 has 53 weeks (week 53 is 28 Dec 2026–3 Jan 2027) and 2027 starts on Mon 4 Jan 2027.
   Goals, keys and owners are the demo's; the counts are examples that add up. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note } = kit;

const CSS = `<style>
.state{margin-bottom:36px}.state>.label{display:block;margin-bottom:10px}
.res{text-transform:uppercase;letter-spacing:.06em;font-weight:650;font-size:12px;white-space:nowrap}
.res.met{color:var(--on)}.res.late{color:var(--risk)}.res.not{color:var(--off)}.res.open{color:var(--muted)}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.rrow .hint{display:block}.rrow b{font-weight:600}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.pl{display:flex;flex-direction:column;gap:6px}
.frame{max-width:620px;margin:0 auto}.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}.fhead b{display:block}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.q{display:flex;flex-direction:column;gap:10px}.q>b{font-weight:650;font-size:17px}
.says{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:6px}
.chk{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.rb{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.rb li{display:flex;gap:10px;align-items:flex-start}.rb li i{width:6px;height:6px;border-radius:999px;background:var(--muted);flex:none;margin-top:8px}.rb b{font-weight:600}
.cnts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cnts>div{padding:14px 16px;min-width:0}.cnts>div+div{border-left:1px solid var(--line-2)}
.cnts .n{font-size:26px;line-height:32px;font-weight:650;display:block}.cnts .l{font-weight:600;display:block}.cnts .s{font-size:13px;color:var(--muted);display:block}
.cells{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cells>div{padding:14px 16px;min-width:0}.cells>div+div{border-left:1px solid var(--line-2)}
.cells .l{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;display:block}.cells .v{font-size:19px;line-height:26px;font-weight:650;display:block}.cells .s{font-size:13px;color:var(--muted);display:block}
.meta{display:flex;gap:8px 16px;flex-wrap:wrap;color:var(--muted);font-size:14px;align-items:center}
.hist{margin:0;padding:0;list-style:none;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.hist li{padding:12px 16px;display:flex;gap:12px;align-items:flex-start}.hist li+li{border-top:1px solid var(--line-2)}.hist .w{width:104px;flex:none;font-weight:600}.hist .t{flex:1;min-width:0}.hist .t .d{color:var(--muted);font-size:14px;display:block}
.wl li{align-items:flex-start}.wl .s{width:132px;flex:none;padding-top:1px}.wl .a{flex:none}
.line{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:12px 14px}.line p{flex:1;min-width:0}
.qs{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.qs>div{padding:12px 14px;min-width:0}.qs>div+div{border-left:1px solid var(--line-2)}.qs .l{font-size:12px;font-weight:600;color:var(--muted);display:block}.qs .s{font-size:13px;color:var(--muted);display:block}
.qs>div.now{outline:2px solid var(--fg);outline-offset:-2px;border-radius:10px}
.four{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.mini{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:18px;display:flex;flex-direction:column;gap:12px;min-width:0}.mini .cap{font-size:12px;font-weight:600;color:var(--muted)}
.hero{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:8px}.hero h3{font-size:19px;line-height:26px}
.gone{font-size:13px;color:var(--muted)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.yr{display:inline-flex;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow:hidden}.yr span{padding:8px 14px;font-weight:600;color:var(--muted)}.yr span+span{border-left:1px solid var(--line)}.yr .cur{color:var(--fg);box-shadow:inset 0 0 0 2px var(--fg);border-radius:7px}
.tb td .hint{display:block}
.was{color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:8px;padding:8px 12px}
@media (max-width:700px){
 .cnts,.cells,.qs{grid-template-columns:1fr 1fr}.cnts>div:nth-child(3),.cells>div:nth-child(3),.qs>div:nth-child(3){border-left:0}.cnts>div:nth-child(n+3),.cells>div:nth-child(n+3),.qs>div:nth-child(n+3){border-top:1px solid var(--line-2)}
 .four,.pair{grid-template-columns:1fr}.wl .s{width:100%}.wl .a{width:100%}.wl .a .btn{width:100%}.ffoot .btn{flex:1}.hist .w{width:100%}.hist li{flex-wrap:wrap}
 .tabs{flex-wrap:wrap;gap:0 18px}.line{flex-wrap:wrap}.line p{flex:1 1 100%}.line .row{width:100%;flex-wrap:wrap!important}.line .btn{flex:1 1 auto}.yr{display:flex}.yr span{flex:1;text-align:center}
}
</style>`;

/* The kit's shell says "week 46" in the frame. These screens are at the turn of the year: the finished page is adjusted here. */
const shellAt = (place, o) => shell(o).replace('Platform Engineering · week 46', `Platform Engineering · ${place}`).replace('Example data · week 46 · Q4', `Example data · ${place}`);
const res = (k, extra = '') => `<span class="res ${k}">${{ met: 'Met', late: 'Met late', not: 'Not met', open: 'Not finished yet' }[k]}</span>${extra ? ` <span class="hint">${extra}</span>` : ''}`;
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const rb = (items) => `<ul class="rb">${items.map((t) => `<li><i></i><span>${t}</span></li>`).join('')}</ul>`;
const SCREENS = {};

/* 1. The wrap-up, as an owner: the list */
const wrow = (result, title, key, line, right, btn) => `<li class="wl-row" style="align-items:flex-start"><span class="s">${result}</span><span class="t"><b>${title}</b><span>${key} · ${line}</span></span><span class="r wide">${right}</span>${btn ? `<span class="a">${btn}</span>` : ''}</li>`;
SCREENS['01-wrap-up-list'] = shellAt('2026 · week 53', { title: 'Wrap up 2026', cur: 'Home', who: 'rhea', width: '', counts: { Reviews: 1 }, body: `${CSS}
<p class="hint" style="margin-bottom:10px"><a>Back to Home</a></p>
<div class="head"><div class="stack"><h1>Wrap up 2026</h1><p class="hint">2026 ends on Sun 3 Jan 2027. For each goal, say whether the result is fair, what you learned, and whether it carries on. Open until Sun 31 Jan 2027.</p></div><span class="btn primary">Wrap up Lead time for changes</span></div>
<div class="tabs"><span class="cur">Mine <em>5 of 8 to do</em></span><span>My team <em>9 of 16 to do</em></span><span>Everyone <em>88 of 126 to do</em></span></div>
<div class="stack" style="gap:6px;margin-bottom:22px"><span class="label">To wrap up · 5</span>
<ul class="list wl">
${wrow(res('not'), 'Lead time for changes', 'G-1 · North star', '36 hours against a target of 24 hours, due week 53', '', '<span class="btn sm">Wrap up</span>')}
${wrow(warn('Final number?'), 'Test suites split into parallel shards', 'G-19', 'The last number, 84%, is from week 46 (9–15 Nov 2026)', '', '<span class="btn sm">Wrap up</span>')}
${wrow(res('not'), 'Base image build time', 'G-23', '11 min against a target of 8 min, due week 53', '', '<span class="btn sm">Wrap up</span>')}
${wrow(res('not'), 'Manual release sign-offs replaced by automated quality gates', 'G-31', '71% against a target of 90%, due week 53', '', '<span class="btn sm">Wrap up</span>')}
${wrow(res('not'), 'CI cost per pipeline run', 'G-126', '0.37 USD against a target of 0.30 USD; it started in week 45', '', '<span class="btn sm">Wrap up</span>')}
</ul></div>
<div class="stack" style="gap:6px;margin-bottom:22px"><span class="label">Wrapped up · 3</span>
<ul class="list wl">
${wrow(res('met'), 'Superseded pipeline runs cancelled automatically', 'G-22', 'Met in week 38 · finished', 'You agreed · <a>Change</a>')}
${wrow(res('met'), 'Flaky test rate in the main pipelines', 'G-11', '1.8% at the end, inside the 2.0% limit · carries on', 'You agreed · <a>Change</a>')}
${wrow(res('late'), 'Pipeline queue wait (p90)', 'G-14', 'Reached 3 min in week 53, due week 52 · finished', 'Your view: hit it · <a>Change</a>')}
</ul></div>
<p class="hint">Nothing to wrap up: <b>GPU preview environments on request</b> isn’t due until week 13 of 2027 (29 Mar–4 Apr 2027). It carries on with its plan.</p>
${note('Wireframe 1. The wrap-up as Rhea, an owner and a manager, in the last week of 2026. Each row starts with the result the rules work out, in the result words; a goal whose last number is old asks for the final number first. One primary action: the next goal to wrap up. “My team” lists her team’s goals with who still has some to do; “Everyone” is the count and a link to the results page (wireframe 4). Today this page lists all 126 goals for everyone under one sentence, shows the status and not the result, and an admin’s “Start it” sits after the last row, 19,450 px down on a phone.')}` });

/* 2. One goal's result */
const gHead = (title, sub, n) => `<div class="fhead"><div><b>Wrap up 2026</b><span class="hint">${n}</span></div><span class="btn sm">Close and keep the draft</span></div><h1 style="margin-bottom:6px">${title}</h1><p class="hint" style="margin-bottom:22px">${sub}</p>`;
SCREENS['02-wrap-up-one-goal'] = shell({ title: 'Wrap up', bare: true, body: `${CSS}
<div class="pair" style="max-width:1280px;margin:0 auto">
<div class="state"><span class="label">(a) A goal that did not meet its target; its owner sees it differently</span>
<div class="frame" style="margin:0">
${gHead('Lead time for changes', 'G-1 · North star · Rhea Kapoor, CI/CD', 'Goal 1 of 5')}
<div class="stack" style="gap:26px">
<div class="q"><b>What the numbers say</b>
<div class="says"><p>${res('not')}</p><p>36 hours at the end of 2026 (week 53, 28 Dec 2026–3 Jan 2027), against a target of 24 hours. It came down 16 of the 28 hours it set out to: 57% of the way.</p><p class="hint">Quarters: Q1 met · Q2 met · Q3 not met · Q4 not met. <a>See the year</a></p></div></div>
<div class="q"><b>Is that a fair account of the year?</b>
<div class="pl">${rad('Yes', false)}${rad('Not the whole story', true, 'The result stays “Not met”. Your view is shown beside it, with your reason.')}</div>
<div class="field"><b>Your view</b><div class="row" style="gap:8px"><span class="btn">Hit it</span><span class="btn on">Partly</span><span class="btn">Missed</span></div></div>
<div class="field"><b>Why the numbers don’t tell it</b><span class="input filled" style="min-height:66px;align-items:flex-start;padding-top:10px">The runner budget was decided in November, not August. Since then lead time has come down 4 hours a month.</span></div></div>
<div class="q"><b>What did you learn?</b><span class="input filled" style="min-height:66px;align-items:flex-start;padding-top:10px">Ask for the decision with a date on it, and plan around the date slipping.</span></div>
<div class="q"><b>What happens to it in 2027?</b>
<div class="pl">${rad('Carry it on', true, 'From 36 hours to 24 hours by the end of 2027 (week 52, 27 Dec 2027–2 Jan 2028). You can change the target and the date on its page.')}${rad('Stop it here', false, 'It stays in 2026 with this result. Its 2 goals below it lose their “Feeds into”.')}</div></div>
</div>
<div class="ffoot"><span class="btn">Back</span><span class="btn primary">Save and go to the next</span></div>
</div></div>
<div class="state"><span class="label">(b) The last number is old: asked before anything else</span>
<div class="frame" style="margin:0 0 32px">
<div class="chk">${warn('Check')}<p><b>The last number, 84%, is from week 46 (9–15 Nov 2026). Is it still right at the end of the year?</b></p><div class="row"><span class="btn">Yes, 84% is the final number</span><span class="btn">Give the final number</span></div><p class="hint">The final number is saved as a check-in for week 53 (28 Dec 2026–3 Jan 2027), and the result is worked out from it.</p></div>
</div>
<span class="label" style="display:block;margin-bottom:10px">(c) A goal that met its target</span>
<div class="frame" style="margin:0 0 32px"><div class="stack" style="gap:14px">
<div class="says"><p>${res('met')}</p><p>95% in week 38 (14–20 Sep 2026), against a target of 95% due week 53. You called it done then.</p></div>
<div class="q"><b>What happens to it in 2027?</b><div class="pl">${rad('It’s finished', true, 'It stays in 2026 as met. Nothing carries on.')}${rad('Set 2027’s goal from it', false, 'Opens New goal with its name, owner, team, metric and what it feeds, starting from 95% in week 1 of 2027. You give the new target.')}</div></div></div></div>
<span class="label" style="display:block;margin-bottom:10px">(d) Saving with something missing</span>
<div class="frame" style="margin:0"><div class="stack" style="gap:10px">
<div class="field"><b>Is that a fair account of the year?</b><div class="pl" style="outline:2px solid var(--off);outline-offset:3px;border-radius:8px">${rad('Yes', false)}${rad('Not the whole story', false)}</div><span class="err">Choose one. Faro doesn’t answer this for you.</span></div>
<div class="field"><b>What did you learn?</b><span class="input bad">ok</span><span class="err">Write a sentence: one thing worth knowing next time.</span></div></div></div>
</div></div>
${note('Wireframe 2. One goal’s wrap-up, a focused form 620 px wide. (a) In order: the result with why, in the numbers; whether that is fair (nothing is chosen for the owner); a different view needs a word and a reason, and never changes the result; what was learned; what happens next, each choice saying what it will do. (b) A last number older than the year’s final two weeks is asked about first. (c) A goal that met its target finishes; to keep going, its owner sets a new goal from it. (d) What must be fixed. Today the form shows the status, pre-selects “Hit it”, “Partly” or “Missed” from it (“Hit it” for a goal on track with its last stage late) and pre-selects “Carry it on”.')}` });

/* 3. A quarter closing on a goal's page */
SCREENS['03-quarter-closing'] = shellAt('2026 · week 40 · Q4', { title: 'Contract tests between the top 40 service pairs', cur: 'Goals', who: 'tunde', width: 'wide', counts: { 'Check-in': 2 }, body: `${CSS}
<p class="hint" style="margin-bottom:10px"><a>Back to Changes shipped with automated integration tests</a></p>
<div class="head"><div class="stack"><h1>Contract tests between the top 40 service pairs</h1>
<div class="meta"><span>Tunde Bakare · Build &amp; Release</span><span>G-37</span></div>
<div class="meta">${st('risk')}<span>28 pairs · updated Thu 1 Oct 2026, week 40</span></div></div>
<div class="row nowrap"><span class="btn primary">Check in for week 40</span></div></div>
<div class="line" style="margin-bottom:22px">${warn('Q3 closed')}<p><b>Not met:</b> 28 pairs against a plan of 30 pairs, 2 pairs short. Q3 was weeks 27 to 39 (29 Jun–27 Sep 2026). Q4’s plan is 40 pairs by week 53 (28 Dec 2026–3 Jan 2027).</p><span class="btn sm">Got it</span></div>
<div class="stack" style="margin-bottom:28px"><h2>2026 by quarter</h2><p class="hint">Each quarter against your own plan: where the plan said this goal would be at the quarter’s end.</p>
<div class="qs">
<div><span class="l">Q1 · Jan–Mar</span>${res('met')}<span class="s">13 pairs against a plan of 13</span></div>
<div><span class="l">Q2 · Apr–Jun</span>${res('not')}<span class="s">21 against a plan of 22, 1 short</span></div>
<div class="now"><span class="l">Q3 · Jul–Sep · closed this week</span>${res('not')}<span class="s">28 against a plan of 30, 2 short</span></div>
<div><span class="l">Q4 · Oct–Dec</span><span class="strong">In progress</span><span class="s">plan 40 pairs by week 53</span></div>
</div></div>
<div class="stack"><h2>History</h2>
<ul class="hist">
<li><span class="w">Week 40</span><span class="t"><b>Q3 closed: not met</b><span class="d">28 pairs against a plan of 30 pairs, 2 pairs short. Worked out from the week 39 check-in; nobody typed it.</span></span></li>
<li><span class="w">Week 39</span><span class="t">${st('risk')} · 28 pairs<span class="d">Tunde: “Each change needs more review than we expected.”</span></span></li>
<li><span class="w">Week 38</span><span class="t">${st('risk')} · 27 pairs<span class="d">The same reason as week 39.</span></span></li>
</ul></div>
${note('Wireframe 3. The week after a quarter ends, on a goal’s page as its owner. One line above the summary says the quarter closed and how, with the weeks and their dates, until its owner presses “Got it” or the week ends; the quarter strip marks the one that just closed; History has a row for it, worked out, like the rows for weeks with no check-in. Nothing is asked: a quarter has no wrap-up. With no set rhythm the sentence ends “as of week 37” when the number it closed on is older than the quarter’s last two weeks. Today the strip changes silently and the line “Last quarter not met” appears only among the flags.')}` });

/* 4. The leader's results */
const rrow = (r, title, sub, fin, view) => `<tr><td style="width:120px">${r}</td><td><b>${title}</b><span class="hint">${sub}</span></td><td class="num">${fin}</td><td>${view}</td></tr>`;
SCREENS['04-results'] = shellAt('2026 · week 53', { title: 'Results for 2026', cur: 'Goals', who: 'amara', width: 'wide', counts: { Reviews: 1 }, body: `${CSS}
<p class="hint" style="margin-bottom:10px"><a>Back to Goals</a></p>
<div class="head"><div class="stack"><h1>Results for 2026</h1><p class="hint">2026 ends on Sun 3 Jan 2027. 38 of 126 goals are wrapped up; owners have until Sun 31 Jan 2027. A result is worked out from the numbers; an owner’s view is shown beside it.</p></div><span class="btn primary">Start 2027</span></div>
<div class="cnts" style="margin-bottom:18px">
<div><span class="n num">31</span><span class="l">${res('met')}</span><span class="s">8 of them early</span></div>
<div><span class="n num">7</span><span class="l">${res('late')}</span><span class="s">after their due week</span></div>
<div><span class="n num">79</span><span class="l">${res('not')}</span><span class="s">52 at least halfway there</span></div>
<div><span class="n num">9</span><span class="l">${res('open')}</span><span class="s">3 not due until 2027; 6 waiting for a final number</span></div>
</div>
<div class="tabs"><span class="cur">The year</span><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>
<div class="bar"><span class="input">Find a goal</span><span class="row desk-only" style="gap:8px"><span class="btn">Result</span><span class="btn">Level</span><span class="btn">Team</span><span class="btn">Sort: north stars first</span><span class="btn">Export</span></span><span class="btn phone-only">Filter and sort</span></div>
<p class="countline"><b>126 goals</b>, north stars first, then not met first.</p>
<table class="tb stackable"><thead><tr><th>Result</th><th>Goal</th><th>At the end</th><th>Owner’s view, and what was learned</th></tr></thead><tbody>
${rrow(res('not'), 'Lead time for changes', 'G-1 · North star · Rhea Kapoor · carries on', '36 hours<span class="hint">target 24 hours</span>', '<b>Partly.</b> “The runner budget was decided in November, not August.”<span class="hint">Learned: ask for the decision with a date on it.</span>')}
${rrow(res('met'), 'Production deploys per day', 'G-3 · North star · Akosua Owusu · finished', '112 deploys<span class="hint">target 100 deploys</span>', 'Agreed.<span class="hint">Learned: small batches did more than the new tooling.</span>')}
${rrow(res('not'), 'Change failure rate', 'G-4 · North star · Chen Wei · carries on', '6.1%<span class="hint">target 4.0%</span>', '<span class="hint">Not wrapped up yet.</span>')}
${rrow(res('late'), 'Pipeline queue wait (p90)', 'G-14 · SVP · Rhea Kapoor · finished', '3 min<span class="hint">target 3 min, a week late</span>', '<b>Hit it.</b> “A week late is the holiday freeze, not the work.”<span class="hint">Learned: autoscaling got us there.</span>')}
${rrow(res('open'), 'GPU preview environments on request', 'G-125 · Team · Astrid Nilsson · carries on with its plan', '22%<span class="hint">target 60% by week 13 of 2027</span>', '<span class="hint">Not due until 29 Mar–4 Apr 2027.</span>')}
</tbody></table>
<p class="hint" style="margin-top:12px">1 to 5 of 126 · <a>Next 50</a></p>
${note('Wireframe 4. The year’s results, as Amara (a leader and an admin), in the year’s last week. Four counts in the result words, then the list bar and one row per goal: the result, the goal and what happens to it, the final number against its target, then the owner’s view where it differs (with their reason) and what was learned. “Q1” to “Q4” show each quarter against the plan in the same table. The one primary action is an admin’s “Start 2027”; for anyone else the page has none. After 31 Jan 2027 the first line reads “2026 ended on Sun 3 Jan 2027. 117 of 126 goals were wrapped up.” Today there is no results page: the wrap-up lists owners’ views (“3 hit it · 1 partly · 3 missed”) and the result words appear only in the export.')}` });

/* 5. Start 2027, with its read-back */
SCREENS['05-start-next-year'] = shellAt('2026 · week 52', { title: 'Start 2027', cur: 'Workspace', who: 'amara', width: 'wide', counts: { Reviews: 1 }, body: `${CSS}
<div class="pair">
<div class="state"><span class="label">(a) Before: what starting 2027 will do</span>
<div class="stack" style="gap:18px">
<div class="stack" style="gap:4px"><p class="hint"><a>Back to Cycles</a></p><h1>Start 2027</h1><p class="hint">2027 runs from Mon 4 Jan 2027 to Sun 2 Jan 2028: 52 weeks. Everyone stays in 2026 until Sun 3 Jan 2027, so the last check-ins and the wrap-up carry on.</p></div>
<div class="cnts">
<div><span class="n num">81</span><span class="l">carry on</span><span class="s">3 keep their plan and dates</span></div>
<div><span class="n num">24</span><span class="l">finish</span><span class="s">they met their target</span></div>
<div><span class="n num">6</span><span class="l">stop</span><span class="s">their owners said so</span></div>
<div><span class="n num">15</span><span class="l">not wrapped up yet</span><span class="s">12 carry on as they are, 3 finish</span></div>
</div>
<div class="stack" style="gap:8px"><span class="label">What 2027 starts with</span>
${rb(['<b>93 goals</b>, each with its key, owner, team, level and metric. A number goal starts from its final number, from week 1; its target is unchanged and due at the end of 2027. <a>See the 93</a>', '<b>18 goals with stages</b> carry the 41 stages not done, spread evenly over 2027. Their owners are asked to check the dates.', '<b>5 goals lose their “Feeds into”</b>, because the goal above them finishes or stops. <a>See them</a>', '<b>14 open next steps and asks move with their goals.</b> 4 stay in 2026, on goals that finish or stop. <a>See the 4</a>', '<b>Check-ins every week, due by Thursday</b>, as in 2026. The first are due Thu 7 Jan 2027.', '<b>6 reviews carry on</b> with the same people and days, on 2027’s goals.', 'The 15 owners with goals not wrapped up can still do it until Sun 31 Jan 2027. If one then says “stop”, the goal leaves 2027.'])}</div>
<div class="row"><span class="btn primary">Start 2027</span><span class="btn">Not yet</span></div>
</div></div>
<div class="state"><span class="label">(b) After: on Cycles</span>
<div class="stack" style="gap:14px">
<div class="line">${warn('2027 is ready')}<p>93 goals are set up. It opens for everyone on <b>Mon 4 Jan 2027</b>. Until then this is still 2026, week 52.</p><span class="btn sm">Undo</span></div>
<ul class="list">
<li style="align-items:flex-start"><span class="t"><b>2027 · starts Mon 4 Jan 2027</b><span>4 Jan 2027 to 2 Jan 2028 · 52 weeks · 93 goals, no check-ins yet<br>Started by Amara Nwosu on Mon 21 Dec 2026. It can be undone until someone checks in or changes a goal in it.</span></span><span class="r"><a>See its goals</a></span></li>
<li style="align-items:flex-start"><span class="t"><b>2026 · ending</b><span>Week 52 of 53 · 29 Dec 2025 to 3 Jan 2027 · 126 goals, 5,351 check-ins<br>The wrap-up is open until Sun 31 Jan 2027: 88 goals still to wrap up.</span></span><span class="r"><a>See the results</a></span></li>
</ul>
<p class="hint">Pressed “Start 2027” twice? There is nothing to press: once 2027 exists the button is gone, and the tools answer “2027 has already been started, by Amara Nwosu on Mon 21 Dec 2026.”</p>
<span class="label" style="margin-top:14px">(c) After someone has checked in to 2027</span>
<ul class="list"><li style="align-items:flex-start"><span class="t"><b>2027 · running</b><span>Week 1 of 52 · 4 Jan 2027 to 2 Jan 2028 · 93 goals, 12 check-ins<br>It can’t be undone now: 12 check-ins are in it. To change what carried, stop a goal or add one from 2026’s results.</span></span><span class="r"><a>See its goals</a></span></li></ul>
</div></div>
</div>
${note('Wireframe 5. Starting the next year, as Amara, on Mon 21 Dec 2026. (a) A page, not a sheet: the dates, four counts that add up to every goal, then what 2027 starts with, each line a count with a way to see the rows. The 2027 button is the only primary action. (b) Afterwards, Cycles: a line with Undo, the new year with the day it opens, and 2026 “ending” with its real last day. (c) Once anyone has checked in, Undo is gone and the row says why. Today the read-back is one sentence in a sheet (“124 goals move into next year, starting from where they ended”), everyone is moved into 2027 the moment it is pressed, two weeks before 2026 ends, and the way back is “Delete…” on another page.')}` });

/* 6. A carried goal's page on day one */
SCREENS['06-carried-goal'] = shellAt('2027 · week 1 · Q1', { title: 'Contract tests between the top 40 service pairs', cur: 'Goals', who: 'tunde', width: 'wide', counts: { 'Check-in': 1 }, body: `${CSS}
<p class="hint" style="margin-bottom:10px"><a>Back to Changes shipped with automated integration tests</a></p>
<div class="head"><div class="stack"><h1>Contract tests between the top 40 service pairs</h1>
<div class="meta"><span>Tunde Bakare · Build &amp; Release</span><span>G-37 · carried from 2026</span></div>
<div class="meta">${st('none')}<span>33 pairs at the end of 2026 · first check-in due Thu 7 Jan 2027</span></div></div>
<div class="row nowrap"><span class="btn primary">Check in for week 1</span></div></div>
<div class="line" style="margin-bottom:22px">${warn('Check')}<p><b>Carried from 2026.</b> It starts from 33 pairs, your final number, in week 1 (4–10 Jan 2027), with the same target of 40 pairs, now due at the end of 2027 (week 52, 27 Dec 2027–2 Jan 2028). Nobody chose that date: 7 pairs in 52 weeks is slower than last year’s 29 in 53.</p><span class="row nowrap"><span class="btn sm">Check the plan</span><span class="btn sm quiet">It’s right</span></span></div>
<div class="cells" style="margin-bottom:28px">
<div><span class="l">Starts from</span><span class="v">33 pairs</span><span class="s">week 53 of 2026</span></div>
<div><span class="l">Plan this week</span><span class="v">33 pairs</span><span class="s">week 1, 4–10 Jan 2027</span></div>
<div><span class="l">To target</span><span class="v">7 pairs to go</span><span class="s">target 40 pairs</span></div>
<div><span class="l">In 2026</span><span class="v">${res('not')}</span><span class="s">33 of 40 pairs · <a>See 2026</a></span></div>
</div>
<div class="stack" style="margin-bottom:28px"><h2>Next steps and asks</h2>
<ul class="list"><li><span class="t"><b>Pair on the reviews so changes land the week they’re ready</b><span>Tunde · from 2026, week 46 · was due week 49 of 2026 (30 Nov–6 Dec 2026)</span></span><span class="r">${warn('Overdue')}</span></li></ul></div>
<div class="stack"><h2>History</h2>
<ul class="hist">
<li><span class="w">2027</span><span class="t"><b>Carried from 2026</b><span class="d">Mon 4 Jan 2027. From 33 pairs to 40 pairs by week 52. Metric, owner, team, what it feeds and 1 open next step came with it; 2 people still watch it.</span></span></li>
<li><span class="w">2026</span><span class="t"><b>53 check-ins, ended ${res('not')}</b><span class="d">Your view: partly. “Each change needed more review than we planned for.” <a>Open 2026’s page</a></span></span></li>
</ul></div>
${note('Wireframe 6. A carried goal on Mon 4 Jan 2027, as its owner. It is not “Not started · No value yet”: the summary says the number it ended on, and the first cell says where the plan starts. One Check line says what was assumed, in dates with their year, and what looks unlikely; it goes when the owner saves the plan, checks in, or says it is right. Last year is one cell and one History row away. The open next step, the metric, the watchers and the parent came with it. Today the page reads “Not started · No value yet”, History says “Nothing here yet”, “Watched by: Nobody yet”, and the first number, 34 against a plan of 33, is met with “Why is it ahead? … Well ahead of plan”.')}` });

/* 7. Last year's goals */
const grow = (r, title, sub, v, gap) => `<li class="goal"><span class="s">${r}</span><span class="t"><b>${title}</b><span>${sub}</span></span><span class="v"><b class="num">${v}</b>${gap}</span></li>`;
SCREENS['07-last-year'] = shellAt('2027 · week 2 · Q1', { title: 'Goals', cur: 'Goals', who: 'tunde', width: 'wide', counts: { 'Check-in': 1 }, body: `${CSS}
<div class="pair">
<div class="state"><span class="label">(a) Goals, with last year chosen</span>
<div class="head" style="margin-bottom:12px"><div class="stack"><h1>Goals</h1><p class="hint">2026 ended on Sun 3 Jan 2027. These are its goals as they ended; nothing here can be changed.</p></div></div>
<div class="row" style="margin-bottom:14px"><span class="yr"><span>2027</span><span class="cur">2026</span></span><a>Results for 2026</a></div>
<div class="tabs"><span class="cur">Mine <em>2</em></span><span>My team <em>11</em></span><span>All <em>126</em></span></div>
<div class="bar"><span class="input">Find a goal in 2026</span><span class="row desk-only" style="gap:8px"><span class="btn">Result</span><span class="btn">Sort</span></span><span class="btn phone-only">Filter and sort</span></div>
<p class="countline"><b>2 goals</b> in 2026.</p>
<ul class="list">
${grow(res('not'), 'Contract tests between the top 40 service pairs', 'G-37 · carried into 2027', '33 pairs', 'target 40 pairs')}
${grow(res('not'), 'One-click rollback for every deployable service', 'G-10 · stopped at the wrap-up', '3 of 4 stages', 'last stage due week 49')}
</ul>
<p class="hint" style="margin-top:14px">Find, from anywhere: “G-10” gives <b>One-click rollback for every deployable service</b> · 2026 · not met. A key opens this year’s goal first, and names the earlier year’s under it.</p>
</div>
<div class="state"><span class="label">(b) A 2026 goal’s page, opened from an old link or its key</span>
<p class="hint" style="margin-bottom:10px"><a>Back to Goals in 2026</a></p>
<div class="stack" style="gap:6px;margin-bottom:14px"><h1>One-click rollback for every deployable service</h1>
<div class="meta"><span>Tunde Bakare · Build &amp; Release</span><span>G-10 · 2026</span></div>
<div class="meta">${res('not')}<span>3 of 4 stages done · the last was due week 49 (30 Nov–6 Dec 2026)</span></div></div>
<div class="line" style="margin-bottom:18px"><p><b>This goal ended with 2026 and was stopped at the wrap-up.</b> Tunde’s view: hit it. “Rollback for tier 3 needed the deploy tooling first.” It can’t be changed now.</p><span class="btn sm">Set a 2027 goal from it</span></div>
<ul class="hist">
<li><span class="w">Wrap-up</span><span class="t"><b>Stopped at the end of 2026</b><span class="d">Tunde Bakare, Mon 21 Dec 2026.</span></span></li>
<li><span class="w">Week 52</span><span class="t">${st('on')} · 3 of 4 stages<span class="d">“Moving as planned.” The status is the last one given; the result above is the year’s.</span></span></li>
</ul>
<p class="hint" style="margin-top:14px">A goal that carried on says instead: “It carried on into 2027 as G-37.” with “Open this year’s page”.</p>
</div>
</div>
${note('Wireframe 7. Last year, always reachable. (a) Goals has a year choice once there is more than one year; with last year chosen, each row starts with its result instead of a status, and the page says nothing can be changed. Data, Export and the results page take the same choice. (b) An old link, or a key, opens the goal as it ended: its result, the owner’s view, what happened to it, and its whole History. Today, once the next year is started, “/goals/cfr-contract” and “/goals/G-10” say “This goal doesn’t exist”, Goals’ search finds no “G-10”, Data shows “Check-ins 0” and the export holds 2027 only.')}` });

/* 8. Four ways: Home's rows at the year's end */
const strip = (cells) => `<div class="qs" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.map((c) => `<div><span class="l">${c[0]}</span><span class="strong">${c[1]}</span><span class="s">${c[2]}</span></div>`).join('')}</div>`;
const mini = (cap, hero, rows, gone) => `<div class="mini"><span class="cap">${cap}</span><h2>Good afternoon, Rhea</h2><p class="hint">Platform Engineering · 2026 · week 53, the last week</p>${hero}${rows}<p class="gone">${gone}</p></div>`;
const heroCk = `<div class="hero"><span class="cap">The last check-ins of 2026 are due by Thu 31 Dec 2026</span><h3>5 check-ins to do</h3><p class="hint">These are the year’s final numbers. Then wrap up your 5 goals: about a minute each.</p><div><span class="btn primary">Start check-in</span></div></div>`;
const heroWrap = `<div class="hero"><span class="cap">2026 ends on Sun 3 Jan 2027</span><h3>Wrap up your 5 goals</h3><p class="hint">Each asks for its final number first, then whether the result is fair. Open until Sun 31 Jan 2027.</p><div><span class="btn primary">Wrap up Lead time for changes</span></div></div>`;
const rowWrap = `<ul class="list"><li><span class="t"><b>Wrap up 2026</b><span>5 of your 8 goals to do · open until Sun 31 Jan 2027</span></span><span class="r"><a>Open the wrap-up</a></span></li></ul>`;
const rowRev = `<ul class="list"><li><span class="t"><b>Developer Productivity fortnightly</b><span>Its last session of 2026 is Tue 29 Dec 2026 · 7 goals</span></span><span class="r"><a>Open</a></span></li></ul>`;
SCREENS['08-four-ways'] = shell({ title: 'Home', bare: true, body: `${CSS}
<div class="four">
${mini('(a) Every week, reviews on', heroCk, rowWrap + rowRev, 'The check-in comes first: it gives the final number the wrap-up then reads.')}
${mini('(b) No set rhythm, reviews on', heroWrap, rowRev, 'Nothing is due, so the wrap-up is the main action, and it asks for each final number itself.')}
${mini('(c) Every week, reviews off', heroCk, rowWrap, 'Gone: the review row. No line anywhere speaks of a final review.')}
${mini('(d) No set rhythm, reviews off', heroWrap, '', 'What is left is the core: the year ends, each goal gets a result, and the next year starts.')}
</div>
${note('Wireframe 8. What the end of the year asks of an owner on Home, four ways (the Home design places these blocks). The wrap-up is never hidden behind the check-in, as it is today, and never asks before the final number exists. A part that is off is not there. If the wrap-up itself were switched off (the switches design’s question), (a) and (c) lose the wrap-up row and (b) and (d) keep only the line “2026 ends on Sun 3 Jan 2027. Results are worked out from your last numbers.”')}` });

kit.render(__dirname, SCREENS);
