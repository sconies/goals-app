/* Wireframes for goal entry (docs/design/goal-entry/README.md, spec.md section 2).
   Usage: node docs/design/goal-entry/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md.
   Round 1's wireframes (docs/design/onboarding/wireframes) are not redrawn: these show what round 2 adds. */
const kit = require('../../_shared/kit.cjs');
const { st, shell, note } = kit;

const CSS = `<style>
.frame{max-width:620px;margin:0 auto;padding:8px 0 24px}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.fhead .steps{margin:0;flex-direction:column;gap:2px}.fhead .steps b{color:var(--fg);font-size:15px}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.fsay{margin-top:24px;margin-bottom:-16px;display:flex;gap:8px;align-items:flex-start;color:var(--off);font-weight:600}
.fsay.ck{color:var(--risk)}
.fstack{display:flex;flex-direction:column;gap:20px}
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px}
.boxed{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px;margin:0}
.rrow{display:flex;gap:12px;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rrow.two{align-items:flex-start;padding:10px 12px}.rrow.two .hint{display:block}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.rrow.two .rd{margin-top:1px}.rrow b{font-weight:600}
.pl{display:flex;flex-direction:column;gap:6px}
.cols{display:flex;gap:12px;flex-wrap:wrap}.cols>*{flex:1 1 220px}
.unit{display:flex;gap:8px;align-items:center}.unit .input{min-width:0}
.pk{display:flex;gap:8px;align-items:center}.pk .input{flex:1;min-width:0}
.sel2{justify-content:space-between}.sel2:after{content:"";width:8px;height:8px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.fold{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.stage{display:flex;flex-direction:column;gap:10px;padding:14px 0;border-top:1px solid var(--line-2)}.stage:first-of-type{border-top:0;padding-top:0}
.scols{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.scols .field{flex:1 1 240px}.scols .field>.input,.cols .field>.input{flex:none}
.cols{align-items:flex-start}
/* The two levels. Must fix: the mark, the words and a full outline on the field. Check: the mark, quieter, and a question
   in a flat block with its two answers. Neither is a status, so neither uses a status shape. */
.mk{display:inline-flex;gap:6px;align-items:flex-start;font-size:14px;line-height:20px}.mk svg{flex:none;margin-top:3px}
.mk.mf{color:var(--off);font-weight:600}.mk.ck{color:var(--risk);font-weight:600}
.q{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.q.open{outline:2px solid var(--risk);outline-offset:-1px}
.q .ans{display:flex;gap:8px;flex-wrap:wrap}.q .ans .rrow{flex:1 1 220px}
.said{display:flex;justify-content:space-between;gap:12px;align-items:baseline;color:var(--muted);font-size:14px}
.rb{border-top:1px solid var(--line);margin:0;padding:0;list-style:none}
.rb li{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line-2)}
.rb li p{flex:1;min-width:0}.rb li a{flex:none;min-height:24px}
.rb .k{display:block;font-size:12px;line-height:16px;font-weight:600;color:var(--muted);margin-bottom:2px}
.next{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:8px}
.sect{display:flex;flex-direction:column;gap:16px;padding:22px 0;border-top:1px solid var(--line)}
.sect:first-of-type{border-top:0;padding-top:0}
.savebar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);background:var(--bg);padding:14px 0 0;margin-top:8px}
.toast a{white-space:nowrap}.toast{display:flex;gap:16px;align-items:center;justify-content:space-between;border:1px solid var(--fg);border-radius:10px;background:var(--surface);padding:12px 16px;max-width:520px}
.hrow{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--line-2)}
.hrow:first-of-type{border-top:0}.hrow p{flex:1 1 280px}
.choices{display:flex;gap:8px;flex-wrap:wrap}
.drow{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line-2)}
.drow:first-of-type{border-top:0}.drow .t{flex:1 1 260px;min-width:0}.drow .t b{display:block;font-weight:600}.drow .t span{color:var(--muted);font-size:14px}
.kind{display:flex;gap:12px;flex-wrap:wrap}.kind>div{flex:1 1 170px;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px 14px}
.kind>div.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}.kind b{display:block}.kind span{font-size:14px;color:var(--muted)}
/* Round 1's find-and-pick look (docs/design/find/mockups/build.cjs), reused unchanged. */
.pkl{margin:0;padding:0;list-style:none}.pkl li{display:flex;gap:12px;align-items:center;padding:10px 14px;min-height:56px}.pkl li+li{border-top:1px solid var(--line-2)}
.pkl .pt{flex:1;min-width:0;display:flex;flex-direction:column}.pkl .l1{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;font-weight:600}.pkl .l2{color:var(--muted);font-size:14px;line-height:20px}
.pkl li.cur{outline:2px solid var(--fg);outline-offset:-2px;border-radius:8px}.pkl li.dis .l1>b{color:var(--muted)}.pkl li.act{min-height:44px}.pkl li.act .l1{font-weight:600;color:var(--accent-text)}
.pop{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-top:6px}.pop .in{padding:12px}.pop .in .input{min-width:0}
.pop .stat{padding:2px 14px 8px;color:var(--muted);font-size:14px}.pop .lab{padding:8px 14px 6px;font-size:12px;font-weight:600;color:var(--muted)}
.fld{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.fld a{font-weight:600}
/* The week picker: a plain list of weeks under a year, with a few named weeks first. No grid of days. */
.wk li{min-height:44px;padding:8px 14px}.wk .l1{font-weight:400}.wk .l1 b{font-weight:600}.wk li.on .l1 b:after{content:" · chosen";font-weight:400;color:var(--muted)}
.yr{display:flex;gap:6px;padding:4px 14px 10px}.yr span{min-height:36px;padding:0 14px;border:1px solid var(--line);border-radius:8px;display:inline-flex;align-items:center;font-weight:600;color:var(--muted)}.yr span.on{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg);color:var(--fg)}
.more{padding:10px 14px;border-top:1px solid var(--line-2);color:var(--muted);font-size:14px}
.pair{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.pair>.field:first-child{flex:1 1 150px}.pair>.field:last-child{flex:2 1 280px}.pair .field>.input{flex:none}.pair .input,.pop .input,.scols .input{min-width:0}.pair>.field{min-width:0}.pkl .l1 span{font-weight:400}.fld span{min-width:0}
@media (max-width:700px){
 .fhead .btn{width:100%}
 .ffoot .btn{flex:1}
 .hrow .btn,.drow .btn{flex:1}
 .q .ans .rrow{flex-basis:100%}
 .savebar .btn{flex:1}
 .rb li{flex-wrap:wrap}
 .boxed{padding:14px}
}
</style>`;

const SCREENS = {};
const MARK = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5 13 12.5H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 6v3" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="10.8" r=".8" fill="currentColor"/></svg>';
/** Must fix: the warning mark and the words, under a field outlined on every side. */
const mf = (t) => `<span class="mk mf" role="alert">${MARK}<span>${t}</span></span>`;
/** Check: the warning mark, quieter, and the question. */
const ck = (t) => `<span class="mk ck">${MARK}<span>${t}</span></span>`;
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''} ${hint ? 'two' : ''}"><span class="rd ${on ? 'y' : ''}"></span>${hint ? `<span><b>${t}</b><span class="hint">${hint}</span></span>` : `<b>${t}</b>`}</div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const head = (a, b, close = 'Close and keep the draft') => `<div class="fhead"><div class="steps"><b>${a}</b>${b ? `<span>${b}</span>` : ''}</div><span class="btn sm">${close}</span></div>`;
const foot = (next = 'Continue', back = true) => `<div class="ffoot" style="${back ? '' : 'justify-content:flex-end'}">${back ? '<span class="btn">Back</span>' : ''}<span class="btn primary">${next}</span></div>`;
const closed = (t) => `<div class="pk"><span class="input filled">${t}</span><a class="btn quiet">Change</a></div>`;
/** The closed week picker: the week with its dates and year, and under it what that week is in words. */
const wk = (t, hint, cls = '') => `<span class="input filled sel2 ${cls}">${t}</span>${hint ? `<span class="hint">${hint}</span>` : ''}`;
const num = (v, unit, cls = '') => `<div class="unit"><span class="input filled ${cls}">${v}</span>${unit ? `<span>${unit}</span>` : ''}</div>`;
const pair = (a, b) => `<div class="pair">${a}${b}</div>`;
const prow = (lead, l1, l2, cls = '') => `<li class="${cls}">${lead}<span class="pt"><span class="l1">${l1}</span>${l2 ? `<span class="l2">${l2}</span>` : ''}</span></li>`;
const pperson = (i, n, l2, cls = '') => prow(`<span class="av sm">${i}</span>`, `<b>${n}</b>`, l2, cls);
const wrow = (w, dates, extra = '', cls = '') => prow('', `<b>Week ${w}</b><span>${dates}${extra ? ' · ' + extra : ''}</span>`, '', cls);
const fld = (t) => `<div class="fld"><span>${t}</span><a>Change</a></div>`;
const select = (t, bad) => `<span class="input filled sel2 ${bad ? 'bad' : ''}">${t}</span>`;
/** A Check question in place: the question, its two answers; open (not yet answered at Continue) is outlined. */
const q = (text, yes, no, picked, open) => `<div class="q ${open ? 'open' : ''}" role="status">${ck(text)}<div class="ans">${rad(yes, picked === 'yes')}${rad(no, picked === 'no')}</div></div>`;
const said = (t) => `<p class="said"><span>${t}</span><a>Change</a></p>`;
const box = (inner) => `<div class="frame boxed">${inner}</div>`;

/* 1. What a step needs, and Must fix */
SCREENS['01-required-and-must-fix'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="state"><span class="label">(a) A number to move: after “Continue” with two things wrong</span>
${box(`${head('New goal', 'Step 3 of 4 · How it’s measured')}
<h1 style="margin-bottom:8px">Where does it start, and where should it end?</h1>
<p class="hint" style="margin-bottom:22px">Everything here is needed unless it says optional.</p>
<div class="fstack">
${fl('Unit', `<span class="input bad">%, days, hours, incidents</span>${mf('Say what the number counts: %, days, incidents.')}`)}
${pair(fl('Baseline', num('42', '')), fl('From', wk('Week 46 · 9–15 Nov 2026', 'This week')))}
${pair(fl('Target', `${num('30 mins', '', 'bad')}${mf('“30 mins” has words in it. Type the number only, like 30; the unit goes in Unit.')}`), fl('To', wk('Week 53 · 28 Dec 2026–3 Jan 2027', 'The end of 2026')))}
<p class="said"><span>Kept as whole numbers, as you typed them.</span><a>Change</a></p>
${fl('How will progress come?', `<div class="pl">${rad('Steady', true, 'The same amount each week.')}${rad('Back-loaded', false, 'Slow at first, faster near the end.')}${rad('In steps', false, 'Changes land in a few jumps.')}</div>`)}
${fl('How it’s measured', `<span class="input" style="min-height:66px;align-items:flex-start;padding-top:10px">Exactly what is counted, so everyone reads it the same way</span>`, 'optional')}
</div>
<p class="fsay">${MARK}<span>2 things to fix above: Unit and Target.</span></p>
${foot()}`)}</div>
<div class="state"><span class="label">(b) Dated stages: each fault under its own row</span>
${box(`${head('New goal', 'Step 3 of 4 · How it’s measured')}
<h1 style="margin-bottom:8px">What are the stages, and when is each due?</h1>
<p class="hint" style="margin-bottom:22px">At least one stage, each with a name and the week it’s due. This is week 46, 9–15 Nov 2026.</p>
<div class="fstack"><div>
<div class="stage"><div class="scols">${fl('Stage 1', `<span class="input filled">Design</span>`)}${fl('Due', select('Week 48 · 23–29 Nov 2026'))}</div></div>
<div class="stage"><div class="scols">${fl('Stage 2', `<span class="input filled bad">Design</span>${mf('Two stages are called “Design”. Give each its own name, such as “Design review”.')}`)}${fl('Due', select('Week 50 · 7–13 Dec 2026'))}</div><div><a>Remove</a></div></div>
<div class="stage"><div class="scols">${fl('Stage 3', `<span class="input filled">All teams live</span>`)}${fl('Due', `${select('Choose a week', true)}${mf('Choose the week “All teams live” is due.')}`)}</div><div><a>Remove</a></div></div>
</div><div><span class="btn">Add a stage</span></div></div>
<p class="fsay">${MARK}<span>2 things to fix above: Stage 2 and Stage 3’s week.</span></p>
${foot()}`)}</div>
${note('Wireframe 1. What a step needs, and the Must fix level. A step where most fields are needed says so once and marks the optional ones; a default is said as a sentence with “Change” (decimals), never filled in silently (the unit no longer starts as “%”). A Must fix sits under its field, which is outlined on every side, says what was read and what would be right, and is counted once beside the button. Today the step says nothing about what is needed, “Unit” starts as “%”, and every stage fault shares one sentence (E2, E6, E7).')}` });

/* 2. A Check question in place */
SCREENS['02-check-in-place'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="state"><span class="label">(a) Who and where: two questions, one answered</span>
${box(`${head('New goal', 'Step 2 of 4 · Who and where')}
<h1 style="margin-bottom:22px">Whose is it, and where does it fit?</h1>
<div class="fstack">
${fl('Owner · checks in weekly', `${closed('Amara Nwosu · Office of the VP')}${q('Amara is in Office of the VP, not Build &amp; Release. Which team is this goal for?', 'Keep it in Build &amp; Release', 'Move it to Office of the VP', 'yes')}`)}
${fl('Team', closed('Build &amp; Release'))}
${fl('Level', `<div class="pl">${rad('Team', false, 'One team’s goal.')}${rad('SVP', false, 'A goal for the teams under one senior leader.')}${rad('North star', true, 'One of the few goals the whole company steers by.')}</div>`)}
${fl('Feeds into', `${closed('Jenkins jobs still running · G-88 · Team')}${q('A north star usually feeds nothing, and “Jenkins jobs still running” is a Team goal. Is this link right?', 'Yes, it feeds that goal', 'No, it feeds nothing', '', true)}`, 'optional')}
</div>
<p class="fsay ck">${MARK}<span>Answer the question above, under Feeds into.</span></p>
${foot()}`)}</div>
<div class="state"><span class="label">(b) A number: asked once, then said back</span>
${box(`<div class="fstack">
<div class="cols">${fl('Baseline', num('50', '%'))}${fl('Target', num('150', '%'))}</div>
${q('The target is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is 150% right?', 'Yes, 150% is right', 'No, I’ll change it', 'yes')}
<span class="label">After the answer, coming back to the step</span>
<div class="cols">${fl('Baseline', num('50', '%'))}${fl('Target', num('150', '%'))}</div>
${said('You said 150% is right.')}
</div>`)}</div>
${note('Wireframe 2. The Check level. A question sits under the field it is about, with the warning mark (quieter than Must fix) and two answers that say what each does. “Continue” waits for an answer and says where the open question is; an answer is kept with the numbers it was about, so changing them asks again. Round 1’s past-stage question (onboarding wireframe 3) is the same block. Today the over-100% line is shown and “Continue” moves on; a north star owned by someone else, feeding a team goal, is published without a word (E1, E3).')}` });

/* 3. The read-back */
const rbRow = (k, t, change = true) => `<li><p><span class="k">${k}</span>${t}</p>${change ? '<a>Change</a>' : ''}</li>`;
SCREENS['03-read-back'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="state"><span class="label">(a) Check, with a weekly rhythm</span>
${box(`${head('New goal', 'Step 4 of 4 · Check')}
<h1 style="margin-bottom:6px">Does this read right?</h1>
<p class="hint" style="margin-bottom:18px">Nothing is saved until you publish.</p>
<h2 style="margin-bottom:10px">Signed artifacts in staging</h2>
<ul class="rb">
${rbRow('What', 'A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.')}
${rbRow('Who and where', 'Tunde Bakare owns it, in Build &amp; Release. It’s a Team goal and feeds “Services deploying through the standard pipeline” (G-41).')}
${rbRow('Measured by', 'No metric: “Share of staging deploys whose artifact carries a valid signature”.')}
${rbRow('Left as usual', 'Whole numbers. From this week to the end of 2026. Not a guardrail. Helps no other goal.')}
${rbRow('You said', 'Build &amp; Release already has “Signed artifacts” (G-73); this is a different goal.', false)}
</ul>
<div class="next" style="margin-top:18px"><span class="label">After you publish</span>
<p>Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.</p>
<p>Everyone in Platform Engineering can see it. It joins no review yet.</p>
<p class="hint">Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.</p></div>
${foot('Publish goal')}`)}</div>
<div class="state"><span class="label">(b) The same block where the workspace has no check-in rhythm, and the goal is for someone else</span>
${box(`<div class="next"><span class="label">After you publish</span>
<p>It shows as “No check-in yet” until Amara posts its first number. Nothing is due.</p>
<p>Amara sees it on her Home the next time she opens Faro. Faro doesn’t send email.</p>
<p>It joins Platform leadership weekly, which walks every north star.</p>
<p class="hint">Until its first check-in you or Amara can change anything, or delete it. After that, a change to the plan needs a reason.</p></div>`)}</div>
${note('Wireframe 3. The read-back, in sentences. Four rows say what was typed; “Left as usual” says every default that was taken, with “Change”; “You said” repeats any Check that was answered. “After you publish” says what the first check-in will be asked and when, who will see the goal, and how long it can still be taken back. With the rhythm switched off the due day is not mentioned at all; with reviews switched off the review line is absent. Today Check says “checks in weekly” whatever the workspace does, and nothing about what happens next (E8).')}` });

/* 4. Edit: what will change, and a reason */
const chg = (k, t) => `<li><p><span class="k">${k}</span>${t}</p></li>`;
SCREENS['04-edit-what-will-change'] = shell({ title: 'Change Pipeline queue wait (p90)', cur: 'Goals', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) The page, as its owner, with two changes made</span>
${head('Change this goal', 'Pipeline queue wait (p90) · G-12')}
<div class="sticky"><span>What it is</span><span class="cur">Plan and target</span><span>Who and where</span><span>More details</span></div>
<div class="sect"><h2>What it is</h2>
${fl('Name', `<span class="input filled">Pipeline queue wait (p90)</span>`)}
<p class="hint">A number to move. The type can’t change: 46 check-ins were judged as a number against a plan. To measure it another way, stop this goal and add a new one.</p></div>
<div class="sect"><h2>Plan and target</h2>
${pair(fl('Baseline', num('14', 'min')), fl('From', wk('Week 1 · 29 Dec 2025–4 Jan 2026', 'The start of 2026')))}
${pair(fl('Target', num('5', 'min', 'focus')), fl('To', wk('Week 53 · 28 Dec 2026–3 Jan 2027', 'The end of 2026')))}
<p class="said"><span>min, whole numbers.</span><a>Change</a></p>
<div class="fold"><span>Adjust the plan week by week</span><a>Show</a></div></div>
<div class="sect"><h2>Who and where</h2>
${fl('Owner · checks in weekly', closed('Tunde Bakare · Build &amp; Release'))}
${fl('Team', closed('CI/CD'))}
${q('Tunde is in Build &amp; Release, not CI/CD. Which team is this goal for?', 'Keep it in CI/CD', 'Move it to Build &amp; Release', 'yes')}</div>
<div class="sect"><h2>What will change</h2>
<ul class="rb">
${chg('Target', '3 min becomes 5 min. From this week it is judged against the new plan: week 46 would read At risk, not Off track. Weeks 1 to 45 and the closed quarters keep the plan of their day, and the old plan stays on the chart, dotted.')}
${chg('Owner', 'Rhea Kapoor hands it to Tunde Bakare. Tunde checks in from week 47 and sees it on his Home. After this, only Tunde or an admin can change it.')}
</ul>
${fl('Why is the plan changing?', `<span class="input bad" style="min-height:66px;align-items:flex-start;padding-top:10px">e.g. The runner budget moved to January</span>${mf('Say why, in a sentence. It goes in the goal’s History, and its 12 watchers see the change flagged.')}`)}
${fl('A note for Tunde', `<span class="input">What he needs to know to pick it up</span>`, 'optional')}
</div>
<div class="savebar"><span class="hint">2 changes · 1 thing to fix: the reason</span><span class="btn primary">Save 2 changes</span></div>
<p class="hint" style="margin-top:22px">Other things you can do: <a>Duplicate as a new goal</a> · <a>Stop this goal…</a></p></div>
<div class="state"><span class="label">(b) After saving, on the goal’s page</span>
<div class="toast" role="status"><span>Saved 2 changes to “Pipeline queue wait (p90)”.</span><a>Undo</a></div></div>
<div class="state"><span class="label">(c) The same address for someone who can’t change it</span>
<div class="stack" style="gap:14px"><h1>Pipeline queue wait (p90)</h1>
<p>Tunde Bakare or an admin can change this.</p>
<dl class="facts"><dt>What it is</dt><dd>A number to move</dd><dt>Plan and target</dt><dd>From 14 min in week 1 (29 Dec 2025–4 Jan 2026) to 5 min by week 53 (28 Dec 2026–3 Jan 2027), steady</dd><dt>Who and where</dt><dd>Tunde Bakare · CI/CD · SVP · feeds “Lead time for changes”</dd></dl>
<p><a>Ask Tunde a question</a> · <a>‹ Pipeline queue wait (p90)</a></p></div></div>
${note('Wireframe 4. The edit page. Round 1’s sections and its one exit stand; round 2 adds the unit and decimals, the line that says why the type can’t change, and “What will change”: each change as a sentence with what it does to status, history and who may act, the reason where the plan changes after check-ins, and an optional note at a hand-over. The button counts the changes; the toast offers Undo. Someone who can’t change the goal sees its facts and who can, with no button. Today a hand-over, a level change and a rename save with “Saved.” and no way back, and others get a dead end (E4, E5).')}` });

/* 5. In a review: a goal agreed in the room */
SCREENS['05-agreed-in-a-review'] = shell({ title: 'Self-service environments ready in under 15 minutes', cur: 'Reviews', who: 'amara', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) The review’s walk, on the goal being discussed</span>
<p class="hint" style="margin-bottom:10px">Platform leadership weekly · Thu 12 Nov · Goal 4 of 20 to discuss</p>
<div class="stack" style="gap:14px"><div>${st('risk')}</div><h1>Self-service environments ready in under 15 minutes</h1>
<h2 style="margin-top:8px">What happens next, who, by when?</h2>
<div class="choices"><span class="btn">Add the next step</span><span class="btn on">Agree a new goal</span><span class="btn">We accept the risk</span><span class="btn">Add a note</span><span class="btn quiet">Skip for now</span></div>
<div class="panel"><h3>Agree a new goal</h3>
<p class="hint">Its owner sets it up afterwards, with the numbers. Until then it is a next step, not a goal.</p>
${fl('What should the goal be called?', `<span class="input filled">Data-backed environments ready in under an hour</span>`)}
${fl('Who will own it?', closed('Camille Laurent · Developer Portal'))}
${fl('It will feed', closed('Self-service environments ready in under 15 minutes · G-5'))}
${fl('Set up by', select('Week 48 · 23–29 Nov 2026'))}
<div class="row"><span class="btn primary">Agree it</span><span class="btn">Cancel</span></div></div></div></div>
<div class="state"><span class="label">(b) What the review records, and what Camille sees on her Home</span>
<div class="panel" style="gap:0">
<div class="hrow"><p><b>Camille agreed: Set up a goal: Data-backed environments ready in under an hour</b><span class="hint" style="display:block">Asked by Amara in Platform leadership weekly · by week 48 · feeds “Self-service environments ready in under 15 minutes”</span></p><span class="btn primary">Set up the goal</span></div>
</div>
<p class="hint" style="margin-top:10px">“Set up the goal” opens New goal with the name, Camille as owner and the goal it feeds filled in. Publishing it marks this step done: “Set up as G-131”.</p></div>
${note('Wireframe 5. A goal agreed in a review. The room records a name, an owner and what it feeds, in ten seconds, as a next step for the owner: nothing half-made is published and no number is invented in the meeting. The owner finishes it in New goal, where every rule applies, and publishing closes the step. With Reviews switched off this choice is simply absent. Today the review can only write it as a sentence: the example data’s own “Camille agreed: Decide whether to split data-backed environments into their own goal” (E9).')}` });

/* 6. From a parent goal, and "Adding several?" */
SCREENS['06-from-a-parent-and-several'] = shell({ title: 'Lead time for changes', cur: 'Goals', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) A goal’s page: What feeds it</span>
<div class="stack"><h2>What feeds it</h2><p class="hint">The goals that move this number, worst first.</p>
<ul class="list">
${kit.goal('off', 'Merge-to-deploy time (median)', 'Half of the merge queue is done; the rest waits on CI/CD’s release.', '5.5 hours', '2.4 hours behind plan')}
${kit.goal('off', 'Pipeline queue wait (p90)', 'Waiting on Infrastructure &amp; Compute to sign off the design.', '7 min', '3 min behind plan')}
${kit.goal('risk', 'Flaky test rate in the main pipelines', 'Back to the planned pace for three weeks.', '1.8%', 'Near the 2.0% limit')}
</ul>
<p><a>Add a goal that feeds this</a></p></div></div>
<div class="state"><span class="label">(b) New goal, opened from there</span>
${box(`${head('New goal', 'Step 1 of 4 · What', 'Close')}
<h1 style="margin-bottom:10px">What do you want to achieve?</h1>
<p class="said" style="margin-bottom:20px"><span>It will feed “Lead time for changes”, as an SVP goal in CI/CD, owned by you.</span><a>Change</a></p>
<div class="fstack">
${fl('Name it the way your team would say it', `<span class="input focus">e.g. Requests triaged within 2 days</span>`)}
<div class="field"><b>How will you know it worked?</b><div class="kind"><div class="sel"><b>Move a number</b><span>e.g. Lead time from 4.2 to 2 days</span></div><div><b>Keep a number in range</b><span>e.g. Change failure rate at most 12%</span></div><div><b>Hit dated stages</b><span>e.g. Threat model, build, approval</span></div></div></div>
</div>
${foot('Continue', false)}
<p class="hint" style="margin-top:18px">Adding several? <a>Paste a table or import a file</a> · Like one you have? <a>Copy from a goal</a></p>`)}</div>
${note('Wireframe 6. New goal from where you are. “Add a goal that feeds this” under a goal’s feeders, “Add a goal for this team” on a team’s page and “Duplicate as a new goal” in a goal’s menu all open the same four steps with what is already known filled in and said in one line on step 1. Several goals at once is a link to the import’s paste-a-table door (docs/design/import), not a second form. Today New goal reads “?parent=” but no link in the app sets it, and it always starts from your own team (E10).')}` });

/* 7. Drafts */
SCREENS['07-drafts'] = shell({ title: 'Goals', cur: 'Goals', who: 'tunde', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) New goal, with goals not yet published</span>
${box(`${head('New goal', 'Step 1 of 4 · What', 'Close')}
<div class="panel" style="gap:0;margin-bottom:24px"><h3 style="margin-bottom:6px">Not published yet · 3</h3>
<div class="drow"><span class="t"><b>Rollback rehearsed for every tier-1 service</b><span>Pavel asked you to set this up in Reliability weekly · by week 48</span></span><span class="btn">Set up the goal</span></div>
<div class="drow"><span class="t"><b>Signed artifacts in staging</b><span>A number to move · stopped at step 3 of 4 · kept until 9 Dec</span></span><span class="row nowrap" style="gap:8px"><span class="btn">Carry on</span><a class="btn quiet">Discard</a></span></div>
<div class="drow"><span class="t"><b>Untitled goal</b><span>Dated stages · stopped at step 3 of 4 · kept until 2 Dec</span></span><span class="row nowrap" style="gap:8px"><span class="btn">Carry on</span><a class="btn quiet">Discard</a></span></div></div>
<h1 style="margin-bottom:20px">Or start a new one: what do you want to achieve?</h1>
${fl('Name it the way your team would say it', `<span class="input">e.g. Requests triaged within 2 days</span>`)}
${foot('Continue', false)}`)}</div>
<div class="state"><span class="label">(b) Goals, Mine: the same list, at the foot</span>
<div class="stack"><p class="countline"><b>2 goals</b>, worst first.</p>
<ul class="list">
${kit.goal('risk', 'Contract tests between the top 40 service pairs', 'Fewer pairs covered than planned for three weeks.', '27 pairs', '5 behind plan')}
${kit.goal('on', 'Release artifacts signed and verified at deploy', 'On plan.', '82%', 'On plan')}
</ul>
<p class="hint" style="margin-top:6px">Not published yet: <a>Signed artifacts in staging</a> · <a>Untitled goal</a> · 1 to set up for Pavel. <a>See all 3</a></p></div></div>
<div class="state"><span class="label">(c) After “Close and keep the draft”</span>
<div class="toast" role="status"><span>Draft kept until 11 Dec. It’s under Goals, Mine.</span><a>Open it</a></div></div>
${note('Wireframe 7. Drafts. A person can have several goals not yet published; each says its kind, where it stopped and how long it is kept (30 days from the last change), and a goal someone asked them to set up heads the list. They are listed where a new goal starts and at the foot of Goals, Mine, never on Home. “Close and keep the draft” says where the draft went; with nothing typed the button reads “Close”. Today there is one unlisted draft per browser, and starting another goal throws it away (E11).')}` });

/* 8. The three dates, picked */
SCREENS['08-dates-picked'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="state"><span class="label">(a) A number to move: the three dates, closed</span>
${box(`${head('New goal', 'Step 3 of 4 · How it’s measured')}
<h1 style="margin-bottom:22px">Where does it start, and where should it end?</h1>
<div class="fstack">
${fl('Unit', `<span class="input filled">min</span>`)}
${pair(fl('Baseline', `${num('42', 'min')}<span class="hint">The number in the week the plan runs from.</span>`), fl('From', wk('Week 46 · 9–15 Nov 2026', 'This week')))}
${pair(fl('Target', num('30', 'min')), fl('To', wk('Week 13 · 29 Mar–4 Apr 2027', 'The end of Q1 2027')))}
<p class="said"><span>20 weeks. It runs past the end of 2026 and carries into 2027 with this plan.</span></p>
</div>${foot()}`)}</div>
<div class="state"><span class="label">(b) “To”, open: named weeks first, then a year and its weeks</span>
${box(`<div class="field"><b>To</b>${wk('Week 13 · 29 Mar–4 Apr 2027', '', 'focus')}
<div class="pop"><div class="in"><span class="input" style="color:var(--faint)">Type a week or a date: 50, 14 Dec</span></div>
<ul class="pkl wk">
${prow('', '<b>The end of 2026</b><span>Week 53 · 28 Dec 2026–3 Jan 2027</span>', '', 'act')}
${prow('', '<b>The end of Q1 2027</b><span>Week 13 · 29 Mar–4 Apr 2027</span>', '', 'act cur')}
${prow('', '<b>The end of 2027</b><span>Week 52 · 27 Dec 2027–2 Jan 2028</span>', '', 'act')}
</ul>
<div class="lab">Or choose a week</div>
<div class="yr"><span>2026</span><span class="on">2027</span></div>
<ul class="pkl wk">
${wrow(11, '15–21 Mar')}
${wrow(12, '22–28 Mar')}
${wrow(13, '29 Mar–4 Apr', 'the end of Q1', 'on')}
${wrow(14, '5–11 Apr')}
${wrow(15, '12–18 Apr')}
</ul>
<div class="more">Weeks 1 to 52 of 2027. 2026 lists weeks 47 to 53: “To” comes after “From”.</div></div></div>`)}</div>
<div class="state"><span class="label">(c) “From” set to a week already past: asked once</span>
${box(`<div class="fstack">
${pair(fl('Baseline', num('42', 'min')), fl('From', wk('Week 40 · 28 Sep–4 Oct 2026', '6 weeks ago')))}
${q('Week 40 was 6 weeks ago. Has this been running since then? The plan would expect 39 min by this week.', 'Yes, it was 42 min in week 40', 'No, start from this week', '', true)}
</div>`)}</div>
<div class="state"><span class="label">(d) The same control for a stage, and what a range says</span>
${box(`<div class="fstack">
<div class="scols">${fl('Stage 1', `<span class="input filled">Design agreed</span>`)}${fl('Due', wk('Week 50 · 7–13 Dec 2026', ''))}</div>
<p class="said"><span>A number to keep in range has no dates to choose: it applies from the week it is published (week 46, 9–15 Nov 2026) to the end of 2026.</span></p>
</div>`)}</div>
${note('Wireframe 8. The three dates of a number goal, named once: the baseline (a number), From (the week that number was true and the plan starts) and To (the week the target is due). Each week is chosen, never typed as a bare number, and always shows its dates and year; under it one word says what that week is (“This week”, “The end of Q1 2027”). Open, the picker offers the named weeks first, then a year and a plain list of its weeks; there is no grid of days, because a goal is planned and checked by the week. A From in the past is asked about, since the plan will expect progress by now. Today the due week is fixed text (“Year end · due week 53”), the start week can’t be chosen at all, and a stage’s week is a bare number (E14).')}` });

/* 9. Search to find: every choice of a person, team, goal or metric */
SCREENS['09-search-to-find'] = shell({ bare: true, title: 'New goal', body: `${CSS}
<div class="state"><span class="label">(a) Who and where: Owner open, before typing</span>
${box(`${head('New goal', 'Step 2 of 4 · Who and where')}
<h1 style="margin-bottom:22px">Whose is it, and where does it fit?</h1>
<div class="fstack">
<div class="field"><b>Owner · checks in weekly</b>
<div class="pop" style="margin-top:0"><div class="in"><span class="input focus" style="color:var(--faint)">Find by name, job title or team</span></div>
<div class="lab">Suggested</div>
<ul class="pkl">
${pperson('GA', 'Grace Achterberg (you)', 'Engineering Operations Manager · Office of the VP')}
${pperson('PN', 'Pavel Novák', 'Engineering Manager, Build &amp; Release · leads Build &amp; Release', 'cur')}
${pperson('CW', 'Chen Wei', 'Staff Engineer · Build &amp; Release')}
${pperson('EY', 'Elif Yılmaz', 'Senior Release Engineer · Build &amp; Release')}
${pperson('OM', 'Olivia Martins', 'Release Engineer · Build &amp; Release')}
${pperson('RK', 'Rhea Kapoor', 'Engineering Manager, CI/CD · chosen lately')}
</ul></div></div>
${fl('Team', fld('Build &amp; Release'))}
${fl('Feeds into', fld('Services deploying through the standard pipeline · G-41 · SVP'), 'optional')}
</div>${foot()}`)}</div>
<div class="state"><span class="label">(b) The same field while typing</span>
${box(`<div class="field"><b>Owner · checks in weekly</b>
<div class="pop" style="margin-top:0"><div class="in"><span class="input focus filled">tun</span></div>
<div class="stat">2 match</div>
<ul class="pkl">
${pperson('TB', 'Tunde Bakare', 'Software Engineer · Build &amp; Release', 'cur')}
${pperson('NT', 'Ngọc Trần', 'Platform Engineer, Tuning · Infrastructure &amp; Compute')}
</ul></div></div>`)}</div>
<div class="state"><span class="label">(c) Closed, everywhere else: the choice as words, with “Change”</span>
${box(`<div class="fstack">
${fl('Owner · checks in weekly', fld('Tunde Bakare · Build &amp; Release'))}
${fl('Feeds into', fld('Nothing: top of its own tree'), 'optional')}
<div class="field"><b>Measured by</b>${fld('Pipeline queue wait (p90)')}<p class="hint">min, whole numbers, lower is better: from the metric. For Build &amp; Release.</p></div>
<div class="field"><b>Also helps <span class="hint" style="font-weight:400">· optional</span></b><div class="fld"><span>Lead time for changes · G-1</span><a>Remove</a></div><div class="fld" style="color:var(--faint)"><span>Add another goal</span></div></div>
${fl('Level', `<div class="pl">${rad('Team', true)}${rad('SVP', false)}${rad('North star', false)}</div>`)}
</div>`)}</div>
${note('Wireframe 9. Search to find. Every choice of a person, a team, a goal or a metric in goal entry is round 1’s find-and-pick, unchanged: closed, the choice as words with “Change”; open, a search with suggestions first (you, the goal’s team with its lead first, who you chose lately), then results with a count as you type. Short fixed lists (the level, the type, how progress comes, a week) stay plain. Shown as an admin adding a goal for Build &amp; Release. Today the owner is a select of 97 people, the goal it feeds one of 127, and the team one of 14 (E15).')}` });

kit.render(__dirname, SCREENS);
