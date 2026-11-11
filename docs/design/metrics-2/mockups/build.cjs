/* Wireframes for the metric library, round 2 (docs/design/metrics-2/README.md, spec.md section 2).
   Usage: node docs/design/metrics-2/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat, hairline rows, status
   as a shape plus a word, the warning mark for Must fix and Check, no edge stripes, quote bars, emoji or pill badges.
   Round 1's screens (the library, a metric's page, the picker, the form, "to sort out") are not redrawn here. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, sw, shell, note } = kit;

const CSS = `<style>
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px}
.fstack{display:flex;flex-direction:column;gap:20px}
.close{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.rrow{display:flex;gap:12px;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.pl{display:flex;flex-direction:column;gap:6px}
.cols{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.cols>*{flex:1 1 200px}
.unit{display:flex;gap:8px;align-items:center}.unit .input{min-width:0}
.pk{display:flex;gap:8px;align-items:center}.pk .input{flex:1;min-width:0}
.q{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.q.must{outline:2px solid var(--off);outline-offset:-1px;background:var(--off-wash)}
.q .lv{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.must .warn,.mustc{color:var(--off)}
.grp{border-top:1px solid var(--line);padding-top:16px;display:flex;flex-direction:column;gap:16px}
.grp>h3 span{font-weight:400;color:var(--muted)}
.foot{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px;margin-top:8px}
.foot p{flex:1 1 260px}
.from{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.big{font-size:40px;line-height:46px;font-weight:650;letter-spacing:-.01em}
.big small{font-size:18px;font-weight:600;color:var(--muted);margin-left:6px}
.sec{display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
.hist{border:1px solid var(--line);border-radius:10px;background:var(--surface)}.hist>div{padding:12px 16px}.hist>div+div{border-top:1px solid var(--line-2)}
.mults{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.mult{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.mult .plot{position:relative;height:96px;margin-top:2px}.mult .plot svg{position:absolute;inset:0;width:100%;height:100%}
.mult .ax{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
.key{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--muted)}.key i{display:inline-block;width:22px;height:0;border-top:2px solid var(--fg);vertical-align:middle;margin-right:6px}.key i.p{border-top:2px dashed var(--faint)}.key i.t{border-top:1px solid var(--muted)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow:hidden}.seg span{padding:6px 12px;font-size:14px;font-weight:600;color:var(--muted)}.seg span+span{border-left:1px solid var(--line)}.seg .cur{color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg);border-radius:7px}
.tick{display:flex;gap:12px;align-items:flex-start;min-height:44px}.tick i{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:4px;flex:none;margin-top:1px;background:var(--fg);position:relative}.tick i:after{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.frow{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:14px 16px}.frow+.frow{border-top:1px solid var(--line-2)}.frow p{max-width:560px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.mult .plot .yl{position:absolute;left:0;font-size:11px;color:var(--muted);background:var(--surface);padding-right:4px}.mult .plot .yl.t{top:-4px}.mult .plot .yl.b{bottom:-2px}
tr.mustrow td{background:var(--off-wash)}
@media (max-width:700px){
 .mults{grid-template-columns:1fr}
 .wrap{overflow-wrap:anywhere}
 .q .btn.sm{min-height:44px;width:100%}
 table.stackable td[data-l]:before{content:attr(data-l) ": ";color:var(--muted);font-size:12px;font-weight:600}
 table.stackable td.num{text-align:left}
 table.stackable td.lead:before{content:none}
 .foot .btn,.close .btn{width:100%}
 .frow{flex-direction:column}
 .big{font-size:34px}
}
</style>`;

const SCREENS = {};
const rad = (t, on, hint) => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b style="font-weight:600">${t}</b>${hint ? `<span class="hint" style="display:block">${hint}</span>` : ''}</span></div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const must = (words, extra = '') => `<div class="q must"><span class="warn"><span class="lv">${warn('Must fix')}</span></span><p>${words}</p>${extra}</div>`;
const check = (words, answers) => `<div class="q"><span class="lv">${warn('Check')}</span><p>${words}</p><div class="row">${answers.map((a) => `<span class="btn sm">${a}</span>`).join('')}</div></div>`;
const closeBar = (t) => `<div class="close"><div><h1>${t}</h1></div><span class="btn sm">Close and keep the draft</span></div>`;

/* 1. Defining a metric well */
SCREENS['01-define'] = shell({ title: 'Add a metric', cur: 'Metrics', who: 'rhea', width: 'narrow', body: `${CSS}
${closeBar('Add a metric')}
<div class="fstack">
${fl('Name', `<span class="input filled">Deploy sucess rate</span>${check('This is one letter from “Deploy success rate” (%, higher is better, owned by Marisol Duarte, 2 goals).', ['Use that one', 'Mine is different: keep it'])}`)}
<div class="cols">${fl('Unit', `<span class="input filled">%</span><span class="hint">As it follows a number: hours, %, USD, deploys</span>`)}${fl('Decimal places', `<span class="input filled">1</span>`, 'optional, 0 if left')}</div>
${fl('Which way is better', `<div class="pl">${rad('Lower is better', false)}${rad('Higher is better', false)}</div>${must('Choose which way is better: lower or higher. A goal can’t tell ahead from behind without it.')}`)}
${fl('What it means and how it’s calculated', `<span class="input filled" style="min-height:66px;align-items:flex-start;padding-top:10px">Deploys that worked.</span><span class="hint">What is counted, out of what or over what period, and what is left out.</span>${check('This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.', ['It’s right as written'])}`, 'optional')}
<div class="grp"><h3>Where the number comes from <span>· can be said later</span></h3>
<div class="cols">${fl('Source', `<span class="input">A dashboard, a query, a report</span>`)}${fl('Who owns that source', `<span class="input">A team or a person</span>`)}</div>
${fl('How often it refreshes', `<span class="input">Not said</span>`)}</div>
<div class="grp">${fl('Owner', `<div class="pk"><span class="input filled">Rhea Kapoor (you)</span><a class="btn quiet">Change</a></div><span class="hint">Answers for what it means. Can change it and retire it.</span>`)}
${fl('Caveats', `<span class="input">What to watch out for when reading it</span>`, 'optional')}</div>
<div class="foot"><p class="hint"><b style="color:var(--fg)">1 to fix, 2 to check.</b> Once added it can be used at once. Still to say: where the number comes from, how often it refreshes.</p><span class="btn primary">Add the metric</span></div>
</div>
${note('Wireframe 1. Adding a metric, with all three levels showing. Three fields are required (name, unit, which way is better); a missing one is a Must fix, outlined on every side and washed. A Check is a question with its answers beside it: a name one letter from a metric that exists, and a percentage whose words don’t say out of what. What is merely not said yet (source, refresh) is neither: it is one plain line by the button, “Still to say”, never a score. One primary action.')}` });

/* 2. A goal measured by a metric, with a slice */
SCREENS['02-measured-by-slice'] = shell({ title: 'New goal', cur: 'New goal', who: 'tunde', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) New goal, the measure step: a metric chosen, for a team and one part of it</span>
<div class="fstack">
${fl('Measured by', `<div class="pk"><span class="input filled">Pipeline queue wait (p90)</span><a class="btn quiet">Change</a></div>
<p class="hint">How long a pipeline job waits for a runner, from queued to started, at the 90th percentile over the week. <a>Read more</a></p>`)}
<div class="from"><span class="label">From the metric</span><p><b class="strong">min</b>, whole numbers, <b class="strong">lower is better</b>. From CI runner metrics, refreshed hourly.</p><p class="hint">A goal measured by a metric uses its unit and its direction. To use others, choose another metric or “No metric”.</p></div>
${fl('For', `<div class="pl">${rad('Build &amp; Release', true, 'The goal’s team')}${rad('The whole company', false)}</div>`)}
${fl('Which part', `<span class="input filled">release builds</span><span class="hint">Parts other goals on this metric use: <a>tier-1 services</a> · <a>release builds</a></span>`, 'optional: leave empty for all of it')}
<div class="grp"><h3>This goal’s own <span>· the metric doesn’t set these</span></h3>
<div class="cols">${fl('Today (week 46)', `<div class="unit"><span class="input filled">9</span><span>min</span></div>`)}${fl('Target (week 53)', `<div class="unit"><span class="input filled">4</span><span>min</span></div>`)}</div></div>
${check('Another goal already measures this for Build &amp; Release, release builds: “Runner pool wait for release builds” (G-61, Pavel Novák). Two goals on one number is unusual.', ['Open that goal', 'Mine is a different goal: carry on'])}
<div class="foot"><span class="btn">Back</span><span class="btn primary">Continue</span></div>
</div></div>
<div class="state"><span class="label">(b) The goal’s page, About: what the metric gives, and what is the goal’s own</span>
<div class="panel"><h3>Measured by <a>Pipeline queue wait (p90)</a></h3>
<dl class="facts"><dt>For</dt><dd>Build &amp; Release · release builds</dd>
<dt>What it means</dt><dd>How long a pipeline job waits for a runner, from queued to started, at the 90th percentile over the week.</dd>
<dt>From the metric</dt><dd>min, whole numbers, lower is better</dd>
<dt>Where the number comes from</dt><dd>CI runner metrics (CI/CD team), refreshed hourly</dd>
<dt>This goal’s own</dt><dd>9 min → 4 min by week 53, steady</dd>
<dt>For this goal</dt><dd>Release branches only; nightly rebuilds are left out.</dd></dl>
<p class="hint"><a>See the 2 other goals measured by it</a></p></div></div>
${note('Wireframe 2. One metric per goal; the goal says whose number it is (“For”: its team or the whole company) and, when it is a cut of that, “Which part”, picked from the parts other goals on the metric already use so they converge. The unit and direction are the metric’s and are said as text, not as fields. Start, target, plan and due week stay the goal’s. A second goal on the same number for the same team and part is a Check, not a refusal.')}` });

/* 3. Changing a definition, and a retired metric on a goal */
SCREENS['03-change-retire'] = shell({ title: 'Change Lead time for changes', cur: 'Metrics', who: 'rhea', width: 'narrow', body: `${CSS}
<div class="state"><span class="label">(a) Saving a change to what a metric means: the read-back</span>
<div class="sheet" style="margin:0;width:auto"><h2>Change what “Lead time for changes” means?</h2>
<dl class="facts"><dt>Was</dt><dd>Median hours from a change’s first commit to running in production, over the last 28 days.</dd>
<dt>Will be</dt><dd>Median hours from <b class="strong">pull request merged</b> to running in production, over the last 28 days.</dd></dl>
${fl('Is it still the same number?', `<div class="pl">${rad('Same number, better words', false, 'Nothing is marked.')}${rad('The number itself changes, from week 46', true, 'Earlier weeks were measured the old way, and every goal says so.')}</div>`)}
${fl('Why', `<span class="input filled" style="padding-top:10px;padding-bottom:10px">Commit time was unreliable for squashed merges.</span>`)}
<div class="panel" style="background:var(--surface-2)"><b class="strong">3 goals are measured by it</b>
<p>Lead time for changes (the whole company) · Merge-to-deploy time (CI/CD) · Lead time, payments services (Build &amp; Release · tier-1 services)</p>
<p class="hint">Each goal’s chart and History will say “Definition changed in week 46”, with your reason. Their numbers and plans don’t change. Rhea Kapoor, Pavel Novák and Tunde Bakare will see it on Home under what changed.</p></div>
<div class="row" style="justify-content:flex-end"><span class="btn">Keep it as it was</span><span class="btn primary">Change the meaning</span></div></div></div>
<div class="state"><span class="label">(b) On one of those goals afterwards: the chart, and History</span>
<div class="chart" style="height:170px"><svg viewBox="0 0 600 170" preserveAspectRatio="none"><path d="M0 40 L600 130" stroke="#9AA3A1" stroke-width="2" stroke-dasharray="6 5" fill="none"/><path d="M0 42 L80 50 L160 61 L240 70 L320 76 L400 84 L470 88 L520 70 L560 72" stroke="#183638" stroke-width="2" fill="none"/><path d="M470 0 L470 170" stroke="#465759" stroke-width="1" stroke-dasharray="3 4"/></svg>
<span class="hint" style="position:absolute;left:8px;top:8px">Plan (dashed) and actual</span><span style="position:absolute;right:23.5%;bottom:8px;font-size:13px;font-weight:600;text-align:right;white-space:nowrap">Definition changed, week 46</span></div>
<div class="hist" style="margin-top:12px"><div><b class="strong">Week 46</b> · ${warn('Definition changed')}<p>Rhea Kapoor changed what Lead time for changes means: “Commit time was unreliable for squashed merges.” Weeks before 46 were measured from first commit. <a>See both definitions</a></p></div><div><b class="strong">Week 45</b> · 36 hours · ${st('off')}</div></div></div>
<div class="state"><span class="label">(c) A goal whose metric was retired</span>
<div class="panel"><h3>Measured by Flaky test rate (old), retired 11 Nov</h3>
<p>Marisol Duarte retired it: “Replaced by a rate that leaves out quarantined tests.” This goal keeps its numbers and its plan.</p>
<p class="hint">Replaced by <a>Flaky test rate</a>.</p>
<div class="row"><span class="btn">Measure it by Flaky test rate</span><a class="btn quiet">Choose another</a></div></div></div>
${note('Wireframe 3. A change of wording saves straight away. A change of meaning asks one question first, and when the number itself changes it needs a reason and reads back the goals by name: each one’s chart and History then carry a “Definition changed in week 46” mark (the warning mark, never a status shape). Retiring keeps every link: the goal keeps its numbers and says what it was measured by and when that was retired; the buttons show only to the goal’s owner and admins. Each of these has one Undo.')}` });

/* 4. A check-in whose number came from the source */
SCREENS['04-checkin-source'] = shell({ bare: true, title: 'Week 46 check-in', body: `${CSS}<div style="max-width:620px;margin:0 auto">
<div class="state"><span class="label">(a) The number arrived by itself</span>
<p class="hint">Week 46 check-in · 2 of 5 · SVP · CI/CD</p><h1 style="margin:4px 0 6px">CI pipeline time on main (p90)</h1><p style="margin-bottom:18px">${st('risk')} <span class="hint">at the week 45 check-in</span></p>
<h2 style="margin-bottom:10px">This week’s number</h2>
<div class="from"><span class="big num">41<small>min</small></span><p><b class="strong">From CI analytics</b>, measured Thu 12 Nov at 09:00.</p><p class="hint">Week 45: 43 min. You still say what changed: that is the next step.</p></div>
<p style="margin:12px 0 0"><a>Type a different number</a> &nbsp;·&nbsp; <a>No new number this week</a></p>
<div class="foot"><span class="hint">Nothing is saved until the last step.</span><span class="btn primary">Use 41 min</span></div></div>
<div class="state"><span class="label">(b) The source is behind: a Check</span>
${check('The latest number from CI analytics is <b class="strong">43 min, measured Wed 28 Oct</b>, 15 days ago. It usually refreshes hourly.', ['Type this week’s number', 'No new number this week', 'Use 43 min anyway'])}</div>
<div class="state"><span class="label">(c) The number is ten times last week’s: a Check</span>
${check('CI analytics says <b class="strong">410 min</b>. That is ten times week 45’s 43 min. Is it right?', ['Yes, use 410 min', 'Type a different number'])}</div>
<div class="state"><span class="label">(d) Afterwards, on the goal: where each number came from</span>
<div class="hist"><div><b class="strong">Week 46</b> · 41 min · ${st('risk')}<p class="hint">From CI analytics, measured Thu 12 Nov 09:00. Rhea Kapoor checked in.</p></div>
<div><b class="strong">Week 45</b> · 43 min · ${st('risk')}<p class="hint">Typed by Rhea Kapoor. CI analytics said 45 min.</p></div>
<div><b class="strong">Week 44</b> · 44 min · ${st('risk')}<p class="hint">Typed by Rhea Kapoor.</p></div></div></div></div>
${note('Wireframe 4. The check-in’s number step when the goal’s metric has a source Faro can read. The number is offered with where it came from and when it was measured; the owner still confirms it and still writes the story. A source never blocks a check-in: late or wildly different is a Check with its answers, and missing or unreachable falls back to typing. Every number afterwards says “from” or “typed”, and says so when a person typed over what the source said. With no set rhythm the same block sits on the goal’s page with “Check in with this number”; nothing is due.')}` });

/* 5. Comparing goals that share a metric */
const plot = (actual, plan, target, lo, hi) => {
  const W = 200, H = 96, x = (i, n) => (i / (n - 1)) * W, y = (v) => H - ((v - lo) / (hi - lo)) * (H - 8) - 4;
  const line = (a) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i, plan.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"><path d="M0 ${y(target)} L${W} ${y(target)}" stroke="#465759" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="${line(plan)}" stroke="#9AA3A1" stroke-width="2" stroke-dasharray="5 4" fill="none" vector-effect="non-scaling-stroke"/><path d="${line(actual)}" stroke="#183638" stroke-width="2" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
};
const mult = (s, title, slice, now, a, p, t) => `<div class="mult"><span>${s}</span><b class="strong">${title}</b><span class="hint">${slice}</span><div class="plot">${plot(a, p, t, 0, 16)}<span class="yl t">16 min</span><span class="yl b">0</span></div><div class="ax"><span>wk 30</span><span>now</span><span>wk 53</span></div><span class="hint">${now}</span></div>`;
const cth = ['Status', 'Goal', 'For', 'Now', 'Target', 'Against plan', 'Last 4 weeks', 'Owner'];
const ctr = (s, g, key, f, now, tg, ag, tr, o, wash) => `<tr class="${wash ? 'mustrow' : ''}"><td class="lead">${s}</td><td class="lead"><a class="strong">${g}</a><br><span class="hint">${key}</span></td><td data-l="For">${f}</td><td data-l="Now" class="num">${now}</td><td data-l="Target">${tg}</td><td data-l="Against plan">${ag}</td><td data-l="Last 4 weeks">${tr}</td><td data-l="Owner">${o}</td></tr>`;
SCREENS['05-compare'] = shell({ title: 'Pipeline queue wait (p90)', cur: 'Metrics', who: 'amara', width: 'wide', body: `${CSS}
<p style="margin-bottom:10px"><a>‹ Metrics</a></p>
<div class="head"><div class="stack"><h1>Pipeline queue wait (p90)</h1><p class="hint">min, whole numbers · lower is better · owned by <a>Rhea Kapoor</a> · Fully defined</p></div><span class="btn primary">See its 3 goals</span></div>
<div class="sec"><h2>Goals measured by it · 3</h2>
<p class="countline" style="margin:0"><b>1 off track, 1 at risk, 1 on track.</b> Now between 4 and 11 min; targets between 4 and 5 min.</p>
<div class="bar" style="margin:0"><span class="seg"><span class="cur">Worst first</span><span>By team and part</span></span><span class="seg desk-only"><span class="cur">Same scale</span><span>Each against its plan</span></span></div>
<table class="stackable"><thead><tr>${cth.map((h, i) => `<th class="${i === 3 ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>
${ctr(st('off'), 'Pipeline queue wait (p90)', 'G-14 · said why this week', 'CI/CD', '11 min', '5 min by week 53', '5 min behind plan', 'Worse 3 weeks running', 'Rhea Kapoor', true)}
${ctr(st('risk'), 'Queue wait, tier-1 services', 'G-88', 'CI/CD · tier-1 services', '7 min', '4 min by week 53', '2 min behind plan', 'Better 2 weeks running', 'Sana Qureshi')}
${ctr(st('on'), 'Runner pool wait for release builds', 'G-61', 'Build &amp; Release · release builds', '4 min', 'At most 5 min', '1 min of room', 'Level', 'Tunde Bakare')}
</tbody></table></div>
<div class="sec"><h2>Each against its own plan, on one scale</h2>
<div class="mults">
${mult(st('off'), 'Pipeline queue wait (p90)', 'CI/CD', '11 min now · plan 6 · target 5', [14, 13, 12, 10, 9, 9, 10, 11], [14, 13, 12, 11, 10, 9, 8, 6, 5.5, 5, 5], 5)}
${mult(st('risk'), 'Queue wait, tier-1 services', 'CI/CD · tier-1 services', '7 min now · plan 5 · target 4', [12, 11, 10, 10, 9, 9, 8, 7], [12, 11, 10, 9, 8, 7, 6, 5, 4.5, 4, 4], 4)}
${mult(st('on'), 'Runner pool wait for release builds', 'Build &amp; Release · release builds', '4 min now · at most 5', [6, 5, 5, 4, 5, 4, 4, 4], [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 5)}
</div>
<div class="key"><span><i></i>Actual</span><span><i class="p"></i>Plan</span><span><i class="t"></i>Target or limit</span><span>All three share one scale, 0 to 16 min.</span></div>
<p class="hint"><a>See these as a table of weeks</a></p></div>
${note('Wireframe 5. A metric’s page as Amara sees it, drawn with three goals. Round 1’s table gains “For” with the part, the trend in words and the worst-first order; under it one small chart per goal, each against its own plan and all on one scale, so slopes and heights compare without a legend of colours. The summary line gives the spread and names no team or person: it is a comparison of goals, never a league table. For Tunde the same page marks his row “yours” under its key. On a phone each goal is a short stack and the charts follow one per row.')}` });

/* 6. The Metrics sheet: import preview */
const ih = ['Row', 'Metric', 'Unit', 'Direction', 'Owner email', 'What will happen'];
const ir = (r, m, u, d, o, w, bad) => `<tr class="${bad ? 'mustrow' : ''}"><td class="lead num" style="text-align:left">Row ${r}</td><td class="lead wrap"><b class="strong">${m}</b></td><td data-l="Unit">${u}</td><td data-l="Direction">${d}</td><td data-l="Owner email" class="wrap">${o}</td><td data-l="What will happen">${w}</td></tr>`;
SCREENS['06-metrics-sheet'] = shell({ title: 'Import', cur: 'Data', who: 'amara', width: 'wide', body: `${CSS}
<p style="margin-bottom:10px"><a>‹ Data</a></p>
<div class="head"><div class="stack"><h1>Check before it’s saved</h1><p class="hint">data-catalogue-metrics.xlsx · the Metrics sheet · 200 rows</p></div><span class="btn primary" style="opacity:.45">Add 188 metrics, change 7</span></div>
<div class="score" style="margin-bottom:18px"><div><b class="num">188</b><span>new metrics</span></div><div><b class="num">7</b><span>change a metric that exists</span></div><div><b class="num">2</b><span>retired</span></div><div><b class="num">3</b><span>unchanged, left alone</span></div></div>
<p class="countline"><b>2 rows must be fixed and 2 questions need an answer</b> before anything is saved. Nothing has been saved. 61 new metrics name no source yet: they will say “Still to say: where the number comes from”.</p>
<div class="sec"><h2>Must fix · 2 rows</h2>
<table class="stackable"><thead><tr>${ih.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${ir(41, 'Checkout latency (p95)', 'ms', '<span class="mustc strong">smaller</span>', 'ines.moreau@example.com', 'Direction says “smaller”. Use Higher is better or Lower is better.', true)}
${ir(112, 'Lead time for changes', '<span class="mustc strong">min</span>', 'Lower is better', 'rhea.kapoor@example.com', 'It is in hours and 3 goals are measured by it. A file can’t change its unit: change it on the metric’s page, where its goals are shown first.', true)}
</tbody></table><p class="hint">Fix them in the file and choose it again, or <a>leave these 2 rows out</a>.</p></div>
<div class="sec"><h2>Check · 2 questions, 15 rows</h2>
${check('Row 17: “Deploy frequncy” is one letter from “Deploy frequency”, which exists (deploys, higher is better, 2 goals).', ['Change “Deploy frequency” with this row', 'Add “Deploy frequncy” as a new metric'])}
${check('14 rows give no Owner email. You will own those 14 metrics. <a>See the rows</a>', ['I’ll own them', 'Leave these 14 rows out'])}</div>
<div class="sec"><h2>What each column takes</h2>
<table class="stackable"><thead><tr><th>Column</th><th>Is it needed?</th><th>Takes</th><th>Example</th></tr></thead><tbody>
<tr><td class="lead"><b class="strong">Metric</b></td><td data-l="Needed">Required</td><td data-l="Takes">Its name, 3 to 120 characters, used once</td><td data-l="Example">Deploy frequency</td></tr>
<tr><td class="lead"><b class="strong">Unit</b></td><td data-l="Needed">Required</td><td data-l="Takes">As it follows a number, up to 20 characters</td><td data-l="Example">deploys</td></tr>
<tr><td class="lead"><b class="strong">Direction</b></td><td data-l="Needed">Required</td><td data-l="Takes">Higher is better or Lower is better</td><td data-l="Example">Higher is better</td></tr>
<tr><td class="lead"><b class="strong">Owner email</b></td><td data-l="Needed">Optional: you, if left empty</td><td data-l="Takes">Someone in Platform Engineering</td><td data-l="Example">daniel.okafor@example.com</td></tr>
<tr><td class="lead"><b class="strong">Action</b></td><td data-l="Needed">Optional</td><td data-l="Takes">Retire or Bring back, or empty</td><td data-l="Example">Retire</td></tr>
<tr><td class="lead"><b class="strong">ID</b></td><td data-l="Needed">Worked out</td><td data-l="Takes">Leave empty for a new metric; keep it to change one</td><td data-l="Example">metric_deploys</td></tr>
</tbody></table><p class="hint"><a>See all 16 columns</a> · <a>Download the template</a></p></div>
${note('Wireframe 6. A data team’s catalogue of 200 metrics, loaded as one file through the same preview as any import: counts first, then what must be fixed (the row washed, the cell in the status colour, the words saying what was read and what would be right), then the questions, each answered once for every row it covers. A row finds its metric by ID, then by name. Metrics with no source are not errors: they are counted, and will say what is still to say. The primary button is live once nothing is left to fix or answer; one Undo takes the whole load back.')}` });

/* 7. Features with Metrics off */
SCREENS['07-features-off'] = shell({ title: 'Workspace', cur: 'Workspace', who: 'amara', body: `${CSS}
<div class="state"><span class="label">(a) Switching Metrics off: the read-back comes first</span>
<div class="sheet" style="margin:0;width:auto;max-width:620px"><h2>Switch Metrics off for Platform Engineering?</h2>
<p><b class="strong">13 metrics, and what 12 goals are measured by, are kept.</b> They come back as they were when you switch it on.</p>
<dl class="facts"><dt>Leaves the menu</dt><dd>Metrics, and each metric’s page</dd>
<dt>On goals</dt><dd>12 goals stop saying what they are measured by, and show their own “What it measures” words instead</dd>
<dt>New goals</dt><dd>“Measured by” isn’t asked</dd>
<dt>From sources</dt><dd>1 goal’s number stops arriving from CI analytics; its owner types it</dd>
<dt>Spreadsheets</dt><dd>The Metrics sheet and the “Measured by” columns leave exports and the template</dd></dl>
<div class="q"><span class="lv">${warn('Check')}</span><p>7 of the 12 goals have no “What it measures” words of their own. They would say “Not described yet”.</p><div class="tick"><i></i><span>Copy each metric’s meaning and source into those 7 goals first</span></div></div>
<div class="row" style="justify-content:flex-end"><span class="btn">Keep it on</span><span class="btn primary">Switch Metrics off</span></div></div></div>
<div class="state"><span class="label">(b) Features afterwards</span>
<div class="list" style="display:block"><div class="frow"><div><b class="strong">Metrics</b><p class="hint">Define each number once, so every goal measured by it means the same thing. Off since 11 Nov: 13 metrics and 12 goals’ links are kept.</p></div>${sw(false)}</div>
<div class="frow"><div><b class="strong">Spreadsheets</b><p class="hint">Download the goals as a workbook, and import changes from one.</p></div>${sw(true)}</div></div>
<p class="hint" style="margin-top:10px">Metrics is off. 13 metrics and 12 goals’ links are kept. <a>Undo</a></p></div>
<div class="state"><span class="label">(c) A goal’s About while it is off: nothing about metrics, and nothing missing</span>
<div class="panel"><dl class="facts"><dt>What it measures</dt><dd>How long a pipeline job waits for a runner, from queued to started, at the 90th percentile over the week. <span class="hint">Source: CI runner metrics.</span></dd><dt>Measure</dt><dd>14 min → 5 min by week 53, lower is better</dd></dl></div></div>
${note('Wireframe 7. Metrics is already a feature with a switch. What changes is that the switch reads back first, in counts: what is kept, what leaves, and the one thing that would be lost from view (goals with no words of their own), with the fix ticked. Off means absent: no menu row, no “Measured by”, no Metrics sheet, no sentence about what isn’t there (the drawing’s menu is the kit’s fixed one; in the app the Metrics row is gone after the switch). The goal keeps its own “What it measures” and “Source”, which is why those two fields stay on the goal.')}` });

kit.render(__dirname, SCREENS);
