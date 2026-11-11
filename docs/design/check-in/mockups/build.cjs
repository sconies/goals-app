/* Wireframes for the check-in (docs/design/check-in/README.md, spec.md section 2).
   Usage: node docs/design/check-in/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. Numbers are illustrative. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note } = kit;

const CSS = `<style>
.frame{max-width:620px;margin:0 auto;padding:8px 0 24px}.frame.wide{max-width:920px}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.fhead .steps{margin:0;flex-direction:column;gap:2px}.fhead .steps b{color:var(--fg);font-size:15px}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:24px;flex-wrap:wrap}
.fstack{display:flex;flex-direction:column;gap:20px}
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.big{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-height:76px;padding:10px 18px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:40px;line-height:48px;font-weight:650}
.big span{font-size:20px;font-weight:500;color:var(--muted)}.big.focus{outline:2px solid var(--fg);outline-offset:1px}.big.bad{outline:2px solid var(--off);outline-offset:1px}.big.empty{color:var(--faint);font-size:20px;font-weight:500;align-items:center}
.q{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.q.must{background:var(--off-wash);border-color:#F0A39C}
.rb{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.rb .label{margin-bottom:2px}
.said{display:flex;flex-direction:column;gap:4px}
.choices{display:flex;gap:8px;flex-wrap:wrap}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.rrow b{font-weight:600}.rrow .hint{display:block}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.tick{display:flex;gap:10px;align-items:flex-start;min-height:32px}.tick i{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:4px;flex:none;margin-top:1px;background:var(--surface);position:relative}
.tick.y i{background:var(--fg)}.tick.y i:after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}
.area{min-height:72px;align-items:flex-start;padding-top:10px;padding-bottom:10px;line-height:22px}
.pk{display:flex;gap:8px;align-items:center}.pk .input{flex:1;min-width:0}
.saved{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-bottom:22px}
.qrow{display:grid;grid-template-columns:minmax(0,1fr) 150px 170px;gap:8px 16px;align-items:center;padding:14px 16px}
.qrow+.qrow{border-top:1px solid var(--line-2)}.qrow .t b{display:block;font-weight:600}.qrow .t span{color:var(--muted);font-size:14px}
.qrow .cell{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600}
.qrow .cell span{font-weight:400;color:var(--muted);font-size:14px}.qrow .cell.empty{color:var(--faint);font-weight:400}.qrow .cell.bad{outline:2px solid var(--off);outline-offset:1px}
.qrow .more{grid-column:1/-1;display:flex;flex-direction:column;gap:8px}
.qrow .reads{font-size:14px;color:var(--muted)}.qrow .reads .st{display:flex}
.qhead{display:grid;grid-template-columns:minmax(0,1fr) 150px 170px;gap:16px;padding:8px 16px;font-size:12px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--line);background:var(--surface-2);border-radius:10px 10px 0 0}
.tbl{border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.grp{font-size:12px;font-weight:600;color:var(--muted);margin:22px 0 8px}
.chg{margin:0;display:grid;grid-template-columns:170px 1fr;gap:8px 16px}.chg dt{color:var(--muted)}.chg dd{margin:0}
.stg{display:flex;flex-direction:column;gap:10px;padding:14px 0;border-top:1px solid var(--line-2)}.stg:first-of-type{border-top:0;padding-top:0}
.list li .btn{flex:none}
.sum{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line-2)}.sum:first-child{border-top:0}.sum .s{width:120px;flex:none}.sum .t{flex:1;min-width:0}.sum .t span{display:block;color:var(--muted);font-size:14px}
@media (max-width:700px){
 .fhead .btn{width:100%}.ffoot .btn{flex:1}
 .qhead{display:none}.qrow{grid-template-columns:1fr 1fr}.qrow .t{grid-column:1/-1}
 .chg{grid-template-columns:1fr;gap:2px 0}.chg dd{margin-bottom:10px}
 .sum{flex-wrap:wrap}.sum .s{width:100%}
 .big{font-size:34px}
}
</style>`;

const SCREENS = {};
const head = (a, b, close = 'Close and keep the draft') => `<div class="fhead"><div class="steps"><b>${a}</b><span>${b}</span></div><span class="btn sm">${close}</span></div>`;
const foot = (next, back = 'Back', extra = '') => `<div class="ffoot">${back ? `<span class="btn">${back}</span>` : '<span></span>'}<span class="row" style="gap:8px">${extra}<span class="btn primary">${next}</span></span></div>`;
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</span></div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const state = (label, body) => `<div class="state"><span class="label">${label}</span>${body}</div>`;
const goalHead = (team, title, last) => `<div class="stack" style="gap:4px"><span class="label">${team}</span><h1>${title}</h1><span class="hint">${last}</span></div>`;
const WK = 'Week 46 · 9–15 Nov 2026';
const frame = (body, wide = '') => `${CSS}<div class="frame ${wide}">${body}</div>`;

/* 1. The queue */
const qrow = (k, title, line, btn, extra = '') => `<li><span class="t"><b>${title}</b><span style="display:block">${st(k)} ${line}</span>${extra.replace('<span class="hint">', '<span class="hint" style="display:block">')}</span><span class="btn ${btn[1] || ''}">${btn[0]}</span></li>`;
SCREENS['01-queue'] = shell({ title: 'Check-in', cur: 'Check-in', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="head"><div class="stack"><h1>Check-in</h1><p class="hint">${WK}. Check-ins are due by Thursday 12 Nov, tomorrow.</p></div><span class="btn primary">Start with Flaky test rate</span></div>
<div class="grp">To do this week · 5</div>
<ul class="list">
${qrow('risk', 'Flaky test rate in the main pipelines', 'last week · 1.8%, near the 2.0% limit', ['Check in'])}
${qrow('on', 'Test suites split into parallel shards', 'last week · 80%, 1 pt ahead of plan', ['Check in'])}
${qrow('on', 'Base image build time', 'last week · 10 min, on plan', ['Carry on'], '<span class="hint">Draft kept: 9 min, typed on Tuesday</span>')}
${qrow('risk', 'Manual release sign-offs replaced by automated quality gates', 'last week · 75%, 6 pts behind plan', ['Check in'])}
${qrow('none', 'CI cost per pipeline run', '', ['Post the first check-in'])}
</ul>
<p class="hint" style="margin-top:12px"><a>Type all your numbers in one table</a></p>
<div class="grp">Done this week · 2</div>
<ul class="list">
${qrow('off', 'Lead time for changes', '37 hours · checked in Mon 9 Nov', ['Check in again'], '<span class="hint"><a>Correct it</a></span>')}
${qrow('off', 'Pipeline queue wait (p90)', '7 min · checked in Mon 9 Nov', ['Check in again'], '<span class="hint"><a>Correct it</a></span>')}
</ul>
<p class="hint" style="margin-top:18px">A draft for week 45 on Base image build time was never posted (11 min). <a>Add it to week 45</a> · <a>Discard it</a></p>
<p class="hint" style="margin-top:8px"><a>Add or correct an earlier week</a></p>
${note('Wireframe 1. The queue, with a weekly rhythm (round 1’s NV3, finished). The week is said with its dates; what is due says the day and date. One primary action walks the list in order. A row says what the goal last said, so a person knows before opening which will take a number and which may need a story. A draft kept says what it holds. Done rows offer both verbs: “Check in again” (something new) and “Correct it” (it was wrong). Today the menu’s Check-in opens straight into the first form, and a past week can’t be reached from the app at all (K4).')}` });

/* 2. One goal, on plan */
SCREENS['02-on-plan'] = shell({ bare: true, title: 'Check-in', body: frame(`
${state('The number typed: one field, and Post', `
<div class="saved"><span>${st('on')} <b style="font-weight:600">Flaky test rate</b> saved for week 46: 1.2%.</span><a>Undo</a></div>
${head(`Check-in · ${WK}`, 'Goal 2 of 5')}
<div class="fstack">
${goalHead('SVP · CI/CD', 'Test suites split into parallel shards', `${st('on')} at the week 45 check-in · 80%`)}
${fl('What’s the number this week?', '<div class="big focus">81<span>%</span></div><span class="hint">Week 45 (2–8 Nov): 80%. Where to get it: CI test analytics.</span>')}
<div class="rb"><span class="label">This will post</span>
<p><b style="font-weight:600">Week 46: 81%, on plan</b> (81% planned for this week).</p>
<p>Status ${st('on')}, from the numbers. <a>Change</a></p>
<p class="hint">On plan, so there’s nothing more to say. <a>Add a next step</a> · <a>Ask for a decision or help</a></p></div>
</div>
${foot('Post check-in', '', '<a class="btn quiet">No new number this week</a>')}`)}
${state('Before a number is typed', `
<div class="fstack">
${fl('What’s the number this week?', '<div class="big empty">Type it here<span>%</span></div><span class="hint">Week 45 (2–8 Nov): 80%. Where to get it: CI test analytics.</span>')}
</div>
${foot('Continue', '', '<a class="btn quiet">No new number this week</a>')}`)}
${note('Wireframe 2. A goal on plan is one field and one press. The read-back sits above the button, in place, and is the same block the story step and the table end on; it is not a step of its own. Posting moves straight to the next goal, where one line says what was saved and offers Undo: there is no “Check-in saved” screen between goals. Today the same goal is one field, two presses and two screens (K7).')}`) });

/* 3. Behind, with the story */
SCREENS['03-behind-story'] = shell({ bare: true, title: 'Check-in', body: frame(`
${state('Behind, and last week’s story still fits: one screen', `
${head(`Check-in · ${WK}`, 'Goal 4 of 5')}
<div class="fstack">
${goalHead('SVP · Build &amp; Release', 'Manual release sign-offs replaced by automated quality gates', `${st('risk')} at the week 45 check-in · 75%`)}
${fl('What’s the number this week?', '<div class="big">77<span>%</span></div><span class="hint">Week 45 (2–8 Nov): 75%.</span>')}
<p><b style="font-weight:600">4 pts behind plan</b> (81% planned for this week). Status ${st('risk')}, from the numbers. <a>Change</a></p>
<div class="said"><span class="label">You said last week</span>
<p><b style="font-weight:600">Delivery slower.</b> The fix for the quality gates landed and the number is moving again.</p>
<p><b style="font-weight:600">Back on plan by week 49 (30 Nov–6 Dec).</b> Move the last two services onto the gate.</p></div>
<div class="rb"><span class="label">This will post</span>
<p><b style="font-weight:600">Week 46: 77%, 4 pts behind plan.</b> Status ${st('risk')}.</p>
<p>The reason and the plan as you gave them last week, said to be still true this week.</p></div>
</div>
${foot('Still true: post check-in', '', '<span class="btn">Something changed</span>')}`)}
${state('“Something changed”, or no story yet: the second step, /check-in/&lt;goal&gt;/why', `
${head(`Check-in · ${WK}`, 'Goal 4 of 5 · step 2 of 2')}
<div class="fstack">
<p><b style="font-weight:600">Manual release sign-offs: 77%, 4 pts behind plan.</b> ${st('risk')}</p>
${fl('Why is it behind?', `<div class="choices"><span class="btn sm">Plan too aggressive</span><span class="btn sm on">Delivery slower</span><span class="btn sm">Blocked by a dependency</span><span class="btn sm">External factor</span><span class="btn sm">Data problem</span><span class="btn sm">Something else</span></div>
<span class="input filled area">Two services still need a manual security sign-off; their owners were out last week.</span>`)}
${fl('What happens next?', `${rad('I have a plan', true, 'And a week it’s back on plan')}${rad('Still investigating', false, 'No date yet')}${rad('I need a decision or help', false, 'Someone else has to act')}${rad('The target should change', false, 'The plan no longer fits')}`)}
${fl('What changes?', '<span class="input filled area">Pair with both owners this week and move the two services onto the gate.</span>')}
${fl('Back on plan by', '<div class="pk"><span class="input filled">Week 49 · 30 Nov–6 Dec 2026</span><a class="btn quiet">Change</a></div><span class="hint">In 3 weeks. Last week you said week 49 too.</span>')}
<p class="hint"><a>Add a next step</a> · <a>Also ask for a decision or help</a></p>
<div class="rb"><span class="label">This will post</span>
<p><b style="font-weight:600">Week 46: 77%, 4 pts behind plan.</b> Status ${st('risk')}.</p>
<p>Delivery slower: “Two services still need a manual security sign-off…”</p>
<p>Back on plan by week 49 (30 Nov–6 Dec 2026): “Pair with both owners this week…”</p></div>
</div>
${foot('Post check-in')}`)}
${note('Wireframe 3. Behind needs a story, and the rule is kept: a cause and a sentence, what changes, and a week when there is a plan. When last week’s story is there it is shown under the number as labelled text and the main button says what it does; one field and one press. “Something changed” opens the second step with last week’s words in the fields; posting them untouched asks the Check in wireframe 4. The week is picked with round 2’s week picker, so weeks 51 and 52 can be chosen (today only 47 to 50 and “Year end”, K9).')}`) });

/* 4. A Check question, and a Must fix */
SCREENS['04-check-question'] = shell({ bare: true, title: 'Check-in', body: frame(`
${state('Check: possible but unlikely. It is answered before anything else happens', `
${head(`Check-in · ${WK}`, 'Goal 1 of 5')}
<div class="fstack">
${goalHead('SVP · CI/CD', 'Flaky test rate in the main pipelines', `${st('risk')} at the week 45 check-in · 1.8%`)}
${fl('What’s the number this week?', '<div class="big">18<span>%</span></div>')}
<div class="q">${warn('Check')}
<p><b style="font-weight:600">Week 45 was 1.8%. Is 18.0% right?</b> That is ten times last week’s number.</p>
<div class="choices"><span class="btn">Yes, 18.0% is right</span><span class="btn">Change the number</span></div></div>
</div>
${foot('Continue', '', '')}
<p class="hint" style="margin-top:8px;text-align:right">Answer the question above first.</p>`)}
${state('Check: the same number as last week', `
<div class="q">${warn('Check')}
<p><b style="font-weight:600">The same as week 45: 1.8%. Did you measure it again this week?</b></p>
<div class="choices"><span class="btn">Yes, measured again</span><span class="btn">No new number this week</span></div></div>`)}
${state('Check: last week’s words, posted untouched (on the second step)', `
<div class="q">${warn('Check')}
<p><b style="font-weight:600">The reason and the plan are word for word what you said last week. Are they still true this week?</b></p>
<div class="choices"><span class="btn">Yes, still true</span><span class="btn">I’ll change them</span></div></div>`)}
${state('Must fix: it can’t be recorded as typed', `
<div class="fstack">
${fl('What’s the number this week?', '<div class="big bad">lots<span>%</span></div>')}
<div class="q must">${warn('Must fix')}
<p><b style="font-weight:600">“lots” isn’t a number.</b> Type digits only, like 1.8.</p></div>
</div>`)}
${note('Wireframe 4. The three levels, with round 2’s words. A Check is a question with two named answers; until it is answered the button does nothing and says why. The answer is kept in History (“Asked: is 18.0% right? Rhea: yes”). A Must fix says what was typed and what would be right. Today “Last week was 1.8. Is 18.0 right?” is a line of text beside a working Continue, and the next press posts 18% with last week’s story (K1).')}`) });

/* 5. The table */
const trow = (title, line, cell, reads, more = '', cls = '') => `<div class="qrow"><span class="t"><b>${title}</b><span>${line}</span></span><span class="cell ${cls}">${cell}</span><span class="reads">${reads}</span>${more ? `<div class="more">${more}</div>` : ''}</div>`;
SCREENS['05-table'] = shell({ bare: true, title: 'Check-in', body: frame(`
${head(`All your numbers · ${WK}`, 'Due by Thursday 12 Nov. An empty row is left to do.')}
<div class="tbl">
<div class="qhead"><span>Goal</span><span>This week</span><span>Reads as</span></div>
${trow('Flaky test rate in the main pipelines', 'Limit ≤ 2.0% · week 45: 1.8%', '1.2<span>%</span>', `${st('on')}<br>Inside the limit`)}
${trow('Test suites split into parallel shards', 'Plan 81% · week 45: 80%', '81<span>%</span>', `${st('on')}<br>On plan`)}
${trow('Base image build time', 'Plan 10 min · week 45: 10 min', '90<span>min</span>', 'Not judged yet', `<div class="q">${warn('Check')}<p><b style="font-weight:600">Week 45 was 10 min. Is 90 min right?</b></p><div class="choices"><span class="btn sm">Yes, 90 min is right</span><span class="btn sm">Change the number</span></div></div>`)}
${trow('Manual release sign-offs replaced by automated quality gates', 'Plan 81% · week 45: 75%', '77<span>%</span>', `${st('risk')}<br>4 pts behind plan`, `<div class="said"><span class="label">You said last week</span><p class="hint"><b style="font-weight:600;color:var(--fg)">Delivery slower.</b> The fix for the quality gates landed… Back on plan by week 49 (30 Nov–6 Dec).</p></div><div class="row" style="gap:16px"><span class="tick y"><i></i>Still true this week</span><a>Something changed</a></div>`)}
${trow('CI cost per pipeline run', 'Plan 0.40 USD · first check-in', '0.52<span>USD</span>', `${st('off')}<br>0.12 USD over plan`, `<div class="row between"><span>${warn('Needs a story before it can post')}</span><span class="btn sm">Say why</span></div>`)}
</div>
<p class="hint" style="margin-top:12px">Not in the table: <a>One-click rollback for every deployable service</a> (stages). Checked in this week already: Lead time for changes, Pipeline queue wait (p90). <a>Correct one</a></p>
<div class="rb" style="margin-top:20px"><span class="label">This will post</span>
<p><b style="font-weight:600">3 check-ins for week 46 (9–15 Nov 2026):</b> 2 on plan, 1 behind with last week’s story.</p>
<p>2 rows wait: Base image build time has a question to answer; CI cost per pipeline run needs a story. They stay here as drafts.</p></div>
${foot('Post 3 check-ins', 'Close and keep the drafts')}
${note('Wireframe 5. The table, for people with many number goals: the same rules, read-back and Undo as the form. A row on plan is a number. A row behind shows last week’s story with one tick. A row with no story to carry opens the form’s second step as a sheet (“Say why”) instead of four fields in the table. A Check is asked in the row. Rows already checked in are not in the table. On a phone each row stacks: name, then the field and what it reads as. Today seven rows behind plan are 33 fields and 4,086 px on a phone, the questions are never asked, and a row for a week already posted silently replaces that check-in (K1, K6, K8).')}`, 'wide') });

/* 6. Correcting a past week */
SCREENS['06-correct-past-week'] = shell({ bare: true, title: 'Correct a check-in', body: frame(`
${head('Correct a check-in', 'Flaky test rate in the main pipelines', 'Close without saving')}
<div class="fstack">
${fl('Which week?', '<div class="pk"><span class="input filled">Week 44 · 26 Oct–1 Nov 2026</span><a class="btn quiet">Change</a></div><span class="hint">2 weeks ago. It says 1.9%, At risk, posted by Rhea on Tue 27 Oct.</span>')}
${fl('The number for week 44', '<div class="big">2.4<span>%</span></div><span class="hint">Was 1.9%. Judged by the limit and the plan as they were in week 44 (≤ 2.0%).</span>')}
<p><b style="font-weight:600">Over the 2.0% limit in week 44.</b> That week’s status becomes ${st('off')} (two weeks running over the limit).</p>
${fl('Why was week 44 behind?', '<span class="hint">Kept from week 44: “Delivery slower. Back to full strength on the flaky-test clean-up…” <a>Change it</a></span>')}
${fl('Why are you changing it?', '<span class="input filled area">The dashboard double-counted retries that week; CI analytics republished it on 9 Nov.</span><span class="hint">Shown beside week 44 in History.</span>')}
<div class="rb"><span class="label">What this changes</span>
<dl class="chg">
<dt>Week 44</dt><dd>1.9% becomes 2.4%. At risk becomes ${st('off')}. The 1.9% stays in History as “corrected”.</dd>
<dt>Today’s status</dt><dd>No change: ${st('risk')}, from the week 46 check-in.</dd>
<dt>The trend</dt><dd>“Steady” becomes “Getting better” (2.1, 2.4, 1.8, 1.9 over the last four weeks).</dd>
<dt>Q4 so far</dt><dd>No change. Q3 closed in week 39 and isn’t touched.</dd>
<dt>Who saw the old number</dt><dd>Amara looked at week 44 in Platform leadership weekly on 29 Oct. That record stays, marked “corrected since”.</dd>
<dt>The streak</dt><dd>No change: a correction is never an on-time check-in.</dd>
</dl></div>
</div>
${foot('Save the correction', 'Cancel')}
${note('Wireframe 6. Correcting or adding a past week. The week is picked with its dates and what it holds now. The number is judged by the plan and thresholds of its own week. A reason is required. The read-back says what moves and what does not, row by row, before it is saved; after, History shows “Corrected Wed 11 Nov by Rhea: was 1.9%” with the reason, and Undo is offered. A week with no check-in reads “Add a check-in for week 44” and is marked “added later”. Today none of this can be done on a screen: only a spreadsheet or an AI tool can reach a past week (K4).')}`) });

/* 7. The confirmation */
const sum = (k, title, line, act) => `<div class="sum"><span class="s">${st(k)}</span><span class="t"><b style="font-weight:600">${title}</b><span>${line}</span></span><a>${act}</a></div>`;
SCREENS['07-confirmation'] = shell({ title: 'Check-in', cur: 'Check-in', who: 'rhea', width: 'narrow', counts: { Reviews: 1 }, body: `${CSS}
<div class="head"><div class="stack"><h1>Week 46 is checked in</h1><p class="hint">All 7 of your goals have a check-in for week 46 (9–15 Nov 2026), a day before Thursday 12 Nov.</p></div><span class="btn primary">Back to Home</span></div>
<div class="grp">Posted just now · 5</div>
<div class="panel" style="gap:0">
${sum('on', 'Flaky test rate in the main pipelines', '1.2% · inside the 2.0% limit', 'Undo')}
${sum('on', 'Test suites split into parallel shards', '81% · on plan', 'Undo')}
${sum('on', 'Base image build time', 'No new number this week: “The image pipeline is being moved.” Still 10 min, as of week 45', 'Undo')}
${sum('risk', 'Manual release sign-offs replaced by automated quality gates', '77% · 4 pts behind plan · last week’s story, still true · back on plan by week 49', 'Undo')}
${sum('off', 'CI cost per pipeline run', '0.52 USD · 0.12 over plan · asked Amara: “agree the spot-instance budget”', 'Undo')}
</div>
<div class="grp">What happens next</div>
<div class="stack" style="gap:6px">
<p>Amara sees your ask on her Home and on the goal.</p>
<p>These are in Developer Productivity fortnightly on Tue 24 Nov.</p>
<p>2 weeks in a row with every check-in in by Thursday.</p>
</div>
<p class="hint" style="margin-top:16px">Undo takes a check-in back and reopens it as a draft. Once you leave this page, use “Correct it” on Check-in or on the goal.</p>
<p class="hint" style="margin-top:6px">Each goal’s page now says “Updated today · week 46”, and its History starts with this check-in.</p>
${note('Wireframe 7. One confirmation, at the end of the walk or after the table: what was posted, each with its number, what it reads as and Undo; who was asked; and what happens next. The review line shows only while Reviews is on; the streak and “by Thursday” only with a weekly rhythm. Today there is a confirmation screen after every goal, no Undo, and “Correct this check-in” adds a second check-in beside the wrong one (K2, K7).')}` });

/* 8. No set rhythm */
SCREENS['08-no-rhythm'] = shell({ title: 'Check-in', cur: 'Check-in', who: 'rhea', width: 'narrow', counts: { Reviews: 1 }, body: `${CSS}
<div class="saved"><span>${st('on')} <b style="font-weight:600">Test suites split into parallel shards</b> saved for week 46: 81%.</span><a>Undo</a></div>
<div class="head"><div class="stack"><h1>Check in on a goal</h1><p class="hint">${WK}. Check in when there’s news; nothing is due.</p></div></div>
<div class="grp">No check-in this week · 4</div>
<ul class="list">
${qrow('none', 'CI cost per pipeline run', '', ['Post the first check-in'])}
${qrow('risk', 'Flaky test rate in the main pipelines', 'as of week 45 · 1.8%', ['Check in'])}
${qrow('on', 'Base image build time', 'as of week 43 · 10 min', ['Check in'])}
${qrow('risk', 'Manual release sign-offs replaced by automated quality gates', 'as of week 45 · 75%', ['Check in'])}
</ul>
<p class="hint" style="margin-top:12px"><a>Type all your numbers in one table</a></p>
<div class="grp">Checked in this week · 3</div>
<ul class="list">
${qrow('on', 'Test suites split into parallel shards', '81% · checked in today', ['Check in again'], '<span class="hint"><a>Correct it</a></span>')}
${qrow('off', 'Lead time for changes', '37 hours · checked in Mon 9 Nov', ['Check in again'], '<span class="hint"><a>Correct it</a></span>')}
${qrow('off', 'Pipeline queue wait (p90)', '7 min · checked in Mon 9 Nov', ['Check in again'], '<span class="hint"><a>Correct it</a></span>')}
</ul>
<p class="hint" style="margin-top:18px"><a>Add or correct an earlier week</a></p>
${note('Wireframe 8. The same door with no set rhythm (round 2’s toggles, 4.6): the title is “Check in on a goal”, nothing is due, there is no primary button, no “x of y” and no streak, and a status that isn’t this week’s says “as of week 45”. Posting returns here with the saved line and Undo. With Reviews off as well, nothing on this page changes: the review line only ever appears on the confirmation.')}` });

/* 9. Stages, no number, and for someone else */
SCREENS['09-stages-no-number-for-someone'] = shell({ bare: true, title: 'Check-in', body: frame(`
${state('A stages goal: each open stage answered in place', `
${head(`Check-in · ${WK}`, 'One-click rollback for every deployable service')}
<div class="fstack">
<p class="hint">${st('done')} 3 stages done: Design agreed, Tier-1 services, Tier-2 services. <a>Show</a></p>
<div class="stg"><b style="font-weight:600">Every deployable service</b><span class="hint">Due week 49 · 30 Nov–6 Dec 2026</span>
${rad('On schedule', false)}${rad('Done', false, 'This week, or pick the week it was done')}${rad('Late: now expected in', true)}
<div class="pk"><span class="input filled">Week 51 · 14–20 Dec 2026</span><a class="btn quiet">Change</a></div><span class="hint">2 weeks after it was due.</span></div>
<p><b style="font-weight:600">1 stage slipping.</b> Status ${st('risk')}, from the stages. <a>Change</a></p>
</div>
${foot('Continue', '')}`)}
${state('“No new number this week”: a check-in without a number', `
<div class="fstack">
${goalHead('SVP · CI/CD', 'Base image build time', `${st('on')} at the week 45 check-in · 10 min`)}
${fl('Why is there no new number?', `${rad('It isn’t measured yet this week', false)}${rad('The source is down or wrong', true)}${rad('Nothing happened to measure', false)}<span class="input filled">The image pipeline is being moved; numbers are back on Monday.</span>`, 'a few words')}
<div class="rb"><span class="label">This will post</span>
<p><b style="font-weight:600">Week 46: no new number.</b> It still says 10 min, as of week 45.</p>
<p>Status stays ${st('on')}, your call. <a>Change</a></p>
<p class="hint">It counts as this week’s check-in. The chart shows a gap for week 46.</p></div>
</div>
${foot('Post check-in', 'Back to the number')}`)}
${state('An admin checking in for the owner', `
<div class="q"><p><b style="font-weight:600">You’re checking in for Rhea Kapoor.</b> It is recorded as “Grace Achterberg, for Rhea Kapoor”, Rhea sees it on her Home, and it doesn’t count towards her streak.</p>
${fl('Why you, not Rhea?', '<span class="input filled">Rhea is on leave until 23 Nov; she sent the number.</span>')}</div>`)}
${note('Wireframe 9. Three smaller paths. Stages are answered on the page, with the late week picked by its dates; “Done” can name an earlier week. “No new number this week” becomes a check-in that says why and keeps the owner’s status call, instead of a comment that leaves the goal “due” all week (K5). An admin may check in for an owner, as the engine and the AI tools already allow, and the screen says whose it is; today the screen refuses an admin outright (K3).')}`) });

kit.render(__dirname, SCREENS);
