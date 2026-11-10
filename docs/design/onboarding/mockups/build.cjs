/* Wireframes for goal onboarding (docs/design/onboarding/README.md, spec.md section 2).
   Usage: node docs/design/onboarding/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, shell, note } = kit;

const CSS = `<style>
.frame{max-width:620px;margin:0 auto;padding:8px 0 24px}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.fhead .steps{margin:0;flex-direction:column;gap:2px}.fhead .steps b{color:var(--fg);font-size:15px}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.fstack{display:flex;flex-direction:column;gap:20px}
.state{margin-bottom:36px}.state>.label{display:block;margin-bottom:10px}
.rrow{display:flex;gap:12px;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rrow.two{align-items:flex-start;padding:10px 12px}.rrow.two .hint{display:block}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.rrow.two .rd{margin-top:1px}
.rrow b{font-weight:600}
.pl{display:flex;flex-direction:column;gap:6px}
.cols{display:flex;gap:12px;flex-wrap:wrap}.cols>*{flex:1 1 220px}
.unit{display:flex;gap:8px;align-items:center}.unit .input{min-width:0}
.pk{display:flex;gap:8px;align-items:center}.pk .input{flex:1;min-width:0}
.menu2{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-top:6px}
.menu2 .it{padding:10px 14px;display:flex;gap:12px;align-items:flex-start}.menu2 .it+.it{border-top:1px solid var(--line-2)}
.menu2 .it.cur{outline:2px solid var(--fg);outline-offset:-2px;border-radius:8px}
.menu2 .it .t{flex:1;min-width:0}.menu2 .it .t b{display:block;font-weight:600}.menu2 .it .t span{color:var(--muted);font-size:14px}
.menu2 .it .st{margin-top:1px;width:104px;flex:none;white-space:normal}
.menu2 .cnt{padding:8px 14px;font-size:12px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:10px 10px 0 0}
.tick{display:flex;gap:12px;align-items:flex-start;min-height:44px}.tick i{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:4px;flex:none;margin-top:1px;background:var(--surface)}
.sel2{justify-content:space-between}.sel2:after{content:"";width:8px;height:8px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.fold{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.stage{display:flex;flex-direction:column;gap:10px;padding:14px 0;border-top:1px solid var(--line-2)}.stage:first-of-type{border-top:0;padding-top:0}
.scols{display:flex;gap:12px;flex-wrap:wrap}.scols .field{flex:1 1 240px}
.q{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.gblock{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:12px}
.gblock .num{color:var(--muted)}
.hrow{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--line-2)}
.hrow:first-of-type{border-top:0}
.hrow p{flex:1 1 280px}
.sub{margin-top:10px}
@media (max-width:700px){
 .top,.tabbar{display:none}
 .fhead .btn{width:100%}
 .ffoot .btn{flex:1}
 .hrow .btn{width:100%}
}
</style>`;

const SCREENS = {};
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''} ${hint ? 'two' : ''}"><span class="rd ${on ? 'y' : ''}"></span>${hint ? `<span><b>${t}</b><span class="hint">${hint}</span></span>` : `<b>${t}</b>`}</div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const head = (a, b) => `<div class="fhead"><div class="steps"><b>${a}</b><span>${b}</span></div><span class="btn sm">Close and keep the draft</span></div>`;
const foot = (next = 'Continue') => `<div class="ffoot"><span class="btn">Back</span><span class="btn primary">${next}</span></div>`;
const closed = (t) => `<div class="pk"><span class="input filled">${t}</span><a class="btn quiet">Change</a></div>`;
const empty = (t) => `<div class="pk"><span class="input">${t}</span></div>`;
const select = (t) => `<span class="input filled sel2">${t}</span>`;

/* 1. Who and where */
SCREENS['01-who-and-where'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="frame">${head('New goal', 'Step 2 of 4 · Who and where')}
<h1 style="margin-bottom:22px">Whose is it, and where does it fit?</h1>
<div class="fstack">
${fl('Owner · checks in weekly', closed('Tunde Bakare · Build &amp; Release'))}
${fl('Team', closed('Build &amp; Release'))}
${fl('Level', `<div class="pl">${rad('Team', true, 'One team’s goal.')}${rad('SVP', false, 'A goal for the teams under one senior leader.')}${rad('North star', false, 'One of the few goals the whole company steers by.')}</div>`)}
<div class="field"><b>Feeds into <span class="hint" style="font-weight:400">· optional</span></b>
<span class="input focus filled">roll</span>
<div class="menu2"><div class="cnt">2 match</div>
<div class="it"><span class="t"><b>Nothing: top of its own tree</b></span></div>
<div class="it cur">${st('on')}<span class="t"><b>Rollback time for failed releases</b><span>G-9 · Pavel Novák · Build &amp; Release</span></span></div>
<div class="it">${st('risk')}<span class="t"><b>Rolling release coverage</b><span>G-31 · Ingrid Solberg · Platform</span></span></div></div></div>
${fl('Also helps', `<span class="input sel2">Choose a goal</span>`, 'optional')}
<div class="tick"><i></i><span><b>It’s a guardrail.</b> <span class="hint">A line other goals mustn’t push the number across.</span></span></div>
</div>${foot()}</div>
${note('Wireframe 1. New goal step 2 as Tunde: owner and team are filled and closed, level is three choices, and “Feeds into” is found by typing, with the arrow keys outlining the current row, instead of a select of 127 goals. “Also helps”, which could not be set when creating a goal, sits here (O1, O5).')}` });

/* 2. Measure */
const chart = `<div class="chart"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><g stroke="#E4E1D9" stroke-width="1"><path d="M0 50H600M0 100H600M0 150H600"/></g><path d="M20 40 L580 150" fill="none" stroke="#183638" stroke-width="2.5" vector-effect="non-scaling-stroke"/><path d="M20 150H580" fill="none" stroke="#9AA3A1" stroke-width="1.2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/></svg>
<span class="hint" style="position:absolute;left:12px;top:6px">42 min, week 46</span><span class="hint" style="position:absolute;right:12px;bottom:6px;text-align:right">Target 30 min, week 53</span></div>`;
SCREENS['02-measure'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="frame">${head('New goal', 'Step 3 of 4 · How it’s measured')}
<h1 style="margin-bottom:22px">Where does it start, and where should it end?</h1>
<div class="fstack">
<div class="field"><b>Measured by</b>${closed('Mean time to restore (P1 and P2)')}
<p class="hint">How long it takes to restore service after a P1 or P2 incident, from the alert to the all-clear. It counts every incident in the week.</p>
<p class="hint">It uses the median across incidents. <a>Read more</a></p>
<p class="hint">min, whole numbers, lower is better: from the metric. <a>Use different ones</a></p></div>
${fl('For', `<div class="pl">${rad('Build &amp; Release', true)}${rad('The whole company', false)}</div>`)}
<div class="cols">${fl('Today (week 46)', `<div class="unit"><span class="input filled">42</span><span>min</span></div>`)}${fl('Target (week 53)', `<div class="unit"><span class="input filled">30</span><span>min</span></div>`)}</div>
${fl('By when?', `<p>Year end · due week 53, 28 Dec–3 Jan 2027</p>`)}
${fl('How will progress come?', `<div class="pl">${rad('Steady', true, 'The same amount each week.')}${rad('Back-loaded', false, 'Slow at first, faster near the end.')}${rad('In steps', false, 'Changes land in a few jumps.')}</div>`)}
<div class="stack">${chart}<div class="fold"><span>Adjust the plan week by week</span><a>Show</a></div></div>
</div>${foot()}</div>
${note('Wireframe 2. Step 3 for a number to move. The metric comes first and fills in unit, decimals and direction (one line stands in for them); then today and the target side by side with the unit after each, the date, the shape, a small chart, and the week-by-week table folded away. Today unit and decimals come first and a seven-row table sits in the middle (O3).')}` });

/* 3. Stages */
SCREENS['03-stages'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="frame">${head('New goal', 'Step 3 of 4 · How it’s measured')}
<h1 style="margin-bottom:22px">What are the stages, and when is each due?</h1>
<div class="fstack"><div>
<div class="stage"><div class="scols">${fl('Stage 1', `<span class="input filled">Design agreed</span>`)}${fl('Due', select('Week 1 · 29 Dec–4 Jan'))}</div>
<div class="q" role="status"><p>Week 1 was 45 weeks ago. Is this stage already done?</p><div class="pl">${rad('Yes, done in week 1', true)}${rad('No, it’s overdue', false)}</div></div></div>
<div class="stage"><div class="scols">${fl('Stage 2', `<span class="input filled">Pilot with two teams</span>`)}${fl('Due', select('Week 48 · 23–29 Nov'))}</div><div><a>Remove</a></div></div>
<div class="stage"><div class="scols">${fl('Stage 3', `<span class="input filled">All teams live</span>`)}${fl('Due', select('Week 53 · 28 Dec–3 Jan'))}</div><div><a>Remove</a></div></div>
</div>
<div><span class="btn">Add a stage</span></div>
<div class="stack"><span class="label">On Check</span><div class="panel"><p>3 stages, the last due week 53. 1 stage is already done.</p></div></div>
</div>${foot()}</div>
${note('Wireframe 3. Step 3 for dated stages. “Due” is a list of weeks with their dates, and choosing one in the past asks whether the stage is already done, so a goal is not born 45 weeks late. The panel shows how Check will say it. Today the due week is a bare number and nothing is asked (O4, O5).')}` });

/* 4. First check-in */
SCREENS['04-first-check-in'] = shell({ title: 'Runner wait for release builds', cur: 'Goals', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) The goal’s page, before its first check-in</span>
<p style="margin-bottom:10px"><a>‹ Goals</a></p>
<div class="stack" style="gap:14px">
<div>${st('none')}</div>
<h1>Runner wait for release builds</h1>
<p class="hint">Owned by Rhea Kapoor · CI/CD · G-62</p>
<div><span class="btn primary">Post the first check-in</span></div>
<div class="panel" role="status"><p>“Runner wait for release builds” is published. Post its first check-in now, so everyone can see where it stands from today.</p><div><a>Later</a></div></div>
<p class="hint">The scorecard starts with the first check-in.</p></div></div>
<div class="state"><span class="label">(b) The first check-in</span>
<div class="frame" style="border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px;margin:0">
<div class="fhead"><div class="steps"><b>First check-in · week 46</b></div><span class="btn sm">Close</span></div>
<h2 style="margin-bottom:14px;font-size:22px;line-height:28px">What’s the number this week?</h2>
<div class="fstack">
<div class="field"><div class="unit"><span class="input filled">7</span><span>days</span></div><p class="hint">This sets where it stands today.</p></div>
<div class="q" role="status"><p>The plan starts at 5 days; you’ve typed 7. Start the plan from 7?</p><div class="pl">${rad('Start from 7', true)}${rad('Keep 5 and say why', false)}</div></div>
</div>
<div class="ffoot"><span class="btn">No new number this week</span><span class="btn primary">Continue</span></div></div></div>
${note('Wireframe 4. A new goal’s page says once that it has no check-in and offers the first one; the first check-in then asks to start the plan from the real number rather than asking why a brand-new goal is behind. Today the page repeats “No value yet” in four places and the first number can open a “why are you behind” step (O6, O8).')}` });

/* 5. Set-up and day one */
const ob = (n, a, b, owner) => `<div class="gblock"><h3>${n}</h3>${a ? `<p class="hint num">${a}</p>` : ''}${b || ''}${fl('Owner', owner)}</div>`;
SCREENS['05-setup-day-one'] = shell({ title: 'Home', cur: 'Home', who: 'tunde', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) Set-up, step 6</span>
<div class="frame" style="border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px;margin:0">
${head('Set up · Step 6 of 7 · Goals', '')}
<h1 style="margin-bottom:10px">What feeds it?</h1>
<p class="hint" style="margin-bottom:18px">Example numbers. Change them to yours, or leave them and correct them at the first check-in.</p>
<div class="fstack">
${ob('Deploys per week', '12 → 30', '', `${empty('Choose a person')}<p class="hint">Give a teammate one, so they have something to check in on.</p>`)}
${ob('Change failure rate', '18 → 10 %', '', closed('Ben Carter · Platform'))}
${ob('Self-service environments live', '3 stages', '', empty('Choose a person'))}
</div>${foot('Next')}</div></div>
<div class="state"><span class="label">(b) Home, as Ben, a teammate someone else added</span>
<h1 style="margin-bottom:18px">Good afternoon, Ben</h1>
<div class="panel" style="gap:0"><h2 style="margin-bottom:6px">Getting started</h2>
<div class="hrow"><p>Ana set up Field Operations on 11 Nov and gave you 1 goal.</p></div>
<div class="hrow"><p>Post your first check-in. It’s due by Thursday.</p><span class="btn primary">Start check-in</span></div>
<div style="padding-top:10px"><a class="hint">Hide this</a></div></div></div>
<div class="state"><span class="label">For a teammate who owns no goal</span>
<div class="panel" style="gap:0">
<div class="hrow"><p>See what Field Operations is working towards.</p><span class="btn">See the goals</span></div>
<div class="hrow"><p>Watch the goals you care about, and they’ll show here.</p><span class="btn">Find goals to watch</span></div>
<div class="hrow"><p>Set up a goal of your own, in about 3 minutes.</p><span class="btn">New goal</span></div>
<div style="padding-top:10px"><a class="hint">Hide this</a></div></div></div>
${note('Wireframe 5. Set-up step 6 asks for example numbers once and leaves each goal’s owner empty until a teammate is chosen. The teammate’s first Home then says who set things up and gives one thing to do, with “Hide this”; someone who owns nothing gets three true next steps. Today a teammate lands on an empty Home or a card about adding people (O9 to O11).')}` });

kit.render(__dirname, SCREENS);
