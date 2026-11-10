/* Wireframes for the goal page (docs/design/goal/README.md, spec.md section 2).
   Usage: node docs/design/goal/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, goal, note } = kit;

const CSS = `<style>
.back{display:inline-block;margin-bottom:12px;font-size:14px}
.sum{padding:20px;gap:6px;margin-bottom:14px}.panel.offwash{background:var(--off-wash)}
.sum .top2{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.sum .l{display:flex;flex-direction:column;gap:6px;min-width:0}
.statline{display:flex;gap:10px;align-items:baseline;font-size:17px}.statline .num{font-size:22px;font-weight:650}
.owner{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--fg-2);font-size:14px}
.acts{display:flex;gap:10px;align-items:center;flex:none}.acts2{display:flex;gap:10px}
.score{margin-bottom:14px}
.sticky{overflow-x:auto;scrollbar-width:none}.sticky span{flex:none}
.sec{display:flex;flex-direction:column;gap:10px}
.sec p.reason{max-width:68ch}
.ptr{font-weight:600}
.path{display:flex;flex-direction:column;gap:2px}
.chartwrap{display:flex;flex-direction:column;gap:8px}
.chart .lo{position:absolute;left:14px;top:10px;font-size:13px;color:var(--muted)}
.chart .tg{position:absolute;left:14px;bottom:36px;font-size:13px;color:var(--muted)}
.chart .ax{position:absolute;left:14px;right:14px;bottom:8px;display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.legend i{display:inline-block;width:26px;vertical-align:middle;margin-right:6px}
.nr{flex-direction:column!important;align-items:stretch!important;gap:6px!important}
.nr .l1{font-weight:600}.nr .l2{color:var(--muted);font-size:14px;line-height:20px}
.nr .ans{font-size:14px;line-height:20px}
.nr .foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:2px}
.nr .state{font-size:14px;color:var(--muted);font-weight:600}
.btns{display:flex;gap:8px;flex-wrap:wrap}
.talk{display:flex;flex-direction:column;gap:6px}
.layout{gap:40px}
@media (min-width:701px){.layout{--x:0}}
@media (max-width:700px){
 .sum{padding:16px}.sum .top2{flex-direction:column;gap:14px}
 .acts{flex-direction:column;align-items:stretch;width:100%}.acts .btn.primary{width:100%}.acts2 .btn{flex:1}
 .layout{display:flex;flex-direction:column;align-items:stretch;gap:28px}.body,.aside{display:contents}
 .o1{order:1}.o2{order:2}.o3{order:3}.o4{order:4}.o5{order:5}
 .btns .btn{flex:1 1 100%}
 .sheet,.panel.frame{margin:0 0 20px}
}
.pn{margin-bottom:28px}.pn>.label{display:block;margin-bottom:8px}
.rdrow{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line-2)}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.ta{min-height:92px;align-items:flex-start;padding-top:10px}
.sheet{margin:0 0 4px;width:520px}
.tabs.f{flex-wrap:wrap;gap:0 20px;overflow:visible}
.ent{display:grid;grid-template-columns:120px 1fr;gap:4px 16px;padding:14px 0;border-top:1px solid var(--line-2)}
.ent .w{font-weight:650}.ent .b{display:flex;flex-direction:column;gap:4px;min-width:0}.ent .h{color:var(--muted);font-size:14px}
.ents{border-top:1px solid var(--line);margin-top:4px}
.ents .ent:first-child{border-top:0}
.addr{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;color:var(--fg-2)}
@media (max-width:700px){.ent{grid-template-columns:1fr}}
@media (min-width:701px){.note{max-width:760px}}
</style>`;

const NS = '<span class="av sm">RK</span>';
const link = (t, h = '#') => `<a href="${h}">${t}</a>`;

const summary = ({ stline, title, ownerLine, measured, acts, wash = true }) => `
<div class="panel sum ${wash ? 'offwash' : ''}" data-part="Summary bar">
 <div class="top2"><div class="l">
  <div class="statline">${stline}</div>
  <h1>${title}</h1>
  <div class="owner">${ownerLine}</div>
  <div class="hint">${measured}</div></div>
  <div class="acts">${acts}</div></div>
</div>`;
const ownerLine = `<span class="av sm">RK</span><span>Rhea Kapoor, CI/CD</span><span>North star</span><span>G-1</span><span>Updated 11 Nov · week 46</span>`;
const measured = `Measured by ${link('Lead time for changes')} · hours, lower is better`;
const score = (c) => `<div class="score" id="now">${c.map(([a, b, d]) => `<div><span class="label">${a}</span><b>${b}</b><span>${d}</span></div>`).join('')}</div>`;
const scoreOff = score([
  ['VS PLAN', '9 hours behind plan', 'plan 28 hours'],
  ['VS LAST WEEK', '1 hour worse', 'was 36 hours in week 45'],
  ['TO TARGET', '13 hours over', 'target 24 hours'],
  ['WILL IT HIT 24?', 'Very unlikely', 'likely 37 hours by year end'],
]);
const links = (arr, cur = 0) => `<div class="sticky">${arr.map((t, i) => `<span class="${i === cur ? 'cur' : ''}">${t}</span>`).join('')}</div>`;

const chart = (down = true) => {
  const pts = down
    ? { plan: '20,50 780,150', act: '20,45 200,72 400,95 560,106', proj: '560,106 780,112', tg: 150 }
    : { plan: '20,150 780,70', act: '20,152 200,130 400,110 560,92', proj: '560,92 780,80', tg: 70 };
  return `<div class="chartwrap" id="chart"><h2>Chart</h2>
<div class="chart"><svg viewBox="0 0 800 200" preserveAspectRatio="none" aria-label="Chart">
<line x1="14" x2="786" y1="${pts.tg}" y2="${pts.tg}" stroke="#9AA3A1" stroke-width="1.5" stroke-dasharray="2 5" vector-effect="non-scaling-stroke"/>
<polyline points="${pts.plan}" fill="none" stroke="#9AA3A1" stroke-width="7" opacity=".45" vector-effect="non-scaling-stroke"/>
<polyline points="${pts.act}" fill="none" stroke="#183638" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
<polyline points="${pts.proj}" fill="none" stroke="${down ? '#B42318' : '#21968E'}" stroke-width="2.2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/></svg>
<span class="lo">${down ? 'Lower is better' : 'Higher is better'}</span><span class="tg" style="bottom:${200 - pts.tg + 6}px">${down ? 'Target 24 hours' : 'Target 80%'}</span>
<span class="ax"><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span><span>Wk 53</span></span></div>
<div class="legend"><span><i style="border-top:7px solid #9AA3A1;opacity:.6"></i>Plan</span><span><i style="border-top:2.4px solid #183638"></i>Actual</span><span><i style="border-top:2.2px dashed ${down ? '#B42318' : '#21968E'}"></i>Projection</span></div></div>`;
};

const row = ({ l1, l2, state, btn, ans }) => `<li class="nr"><span class="l1">${l1}</span><span class="l2">${l2}</span>${ans ? `<span class="ans">${ans}</span>` : ''}<span class="foot"><span class="state">${state}</span>${btn ? `<span class="btn sm">${btn}</span>` : ''}</span></li>`;
const doneRow = (l1, l2, ans) => `<li class="nr"><span class="l1">${l1}</span><span class="l2">${l2}</span>${ans ? `<span class="ans">${ans}</span>` : ''}</li>`;
const lbl = (t) => `<div class="label" style="margin:2px 0 -6px">${t}</div>`;

const nextBlock = ({ open, intro = '', forYou = '', mid = '', done = '', btns }) => `<div class="sec o1" id="next"><h2>Next steps and asks · ${open}</h2><p class="hint">Who is doing what, by when, and what has been asked.</p>${intro}${forYou}${mid}${done}<div class="btns">${btns}</div></div>`;

const talk = `<div class="talk o5"><h2>Last time we talked</h2><b>Amara noted in Platform leadership weekly, Thu 5 Nov (week 45)</b>
<p>Runner budget goes to finance on the 12th. Until then Rhea’s request stays open; she’ll say what it does to queue wait once it’s decided.</p>
<p class="hint">Next: Platform leadership weekly, Thursday 12 Nov.</p></div>`;

const whyBlock = `<div class="sec o2" id="why"><h2>Why it will miss without intervention</h2><p class="hint">The owner’s reason, from this week’s check-in.</p>
<p class="reason">Lead time is well above plan and the gap grew again this week. The merge queue rollout to the web monorepo slipped again, the autoscaling runner pools are still waiting on the Q4 budget decision, and the flaky-test rate went back over 2% after the Java 21 upgrade. Until the runner budget is approved, every merge waits a median of 14 minutes for a runner, and that alone is about six hours of the gap.</p>
<p class="strong">Blocked by a dependency, from Rhea’s check-in in week 46.</p>
<p class="ptr">Waiting on a decision from Amara: ${link('see Next steps and asks', '#next')}</p>
<div class="path"><span class="label">Path to green</span><p class="strong">Merge queue on every monorepo by week 49, runners autoscaling within two weeks of the budget, flaky tests quarantined within a day.</p><p class="hint">No date until the decision or help arrives.</p></div></div>`;

const feeds = `<div class="sec o4" id="feeds"><h2>What feeds it</h2><ul class="list">
${goal('off', 'Merge-to-deploy time (median)', 'Half of the merge queue is done; the rest waits on CI/CD’s release.', '5.5 hours', '2.4 hours behind plan', { depth: 0, wash: false })}
${goal('off', 'Pipeline queue wait (p90)', 'Waiting on Infrastructure &amp; Compute to sign off the design.', '7 min', '3 min behind plan', { wash: false })}
${goal('risk', 'Flaky test rate in the main pipelines', 'Recovering: back to the planned pace for three weeks.', '1.8%', 'Near the 2.0% limit', { wash: false })}</ul></div>`;

const sectionLinks = (open) => ['Now', `Next steps and asks${open ? ' · ' + open : ''}`, 'Why', 'Chart', 'What feeds it', 'History', 'About'];

const SCREENS = {};

/* 1 — as Amara */
SCREENS['01-asked'] = shell({
  title: 'Lead time for changes', cur: 'Goals', who: 'amara', width: 'wide',
  body: CSS + `<a class="back" href="#">‹ Goals</a>` +
    summary({ stline: `${st('off')}<span class="num"> · 37 hours</span>`, title: 'Lead time for changes', ownerLine, measured,
      acts: `<span class="btn primary">Answer Rhea’s request</span><span class="acts2"><span class="btn">Watching</span><span class="btn">More</span></span>` }) +
    scoreOff + links(sectionLinks('2 open'), 1) +
    `<div class="layout"><div class="body">${whyBlock}<div class="o3">${chart(true)}</div>${feeds}</div>
<div class="aside">${nextBlock({
      open: '2 open',
      forYou: lbl('For you') + `<ul class="list">${row({ l1: 'Decision or help: approve the extra CI runner budget for Q4', l2: 'Asked of Amara by Rhea · 3 weeks ago', state: 'Open', btn: 'Respond' })}${row({ l1: 'Next step: take the runner budget to the finance review', l2: 'Amara · by week 47 (Thu 19 Nov) · agreed in Platform leadership weekly', state: 'Open', btn: 'Mark done' })}</ul>`,
      done: lbl('Done lately') + `<ul class="list">${doneRow('Done: one-page case for the Q4 runner budget', 'Rhea · week 44')}</ul>`,
      btns: '<span class="btn">Add a next step</span><span class="btn">Ask Rhea a question</span>' })}${talk}</div></div>` +
    note('Wireframe 1. Amara’s view: her own two rows sit at the top of the side column with the one button each, the ask is no longer printed in Why (a seven-word pointer replaces it), and the page reads summary, scorecard, steps and asks, why, chart. Fixes D1, D2, D4 and D5.'),
});

/* 2 — as the owner */
const noStep = `<p style="margin:0">${warn('No next step yet.')} Nobody has said what happens next, who does it and by when.</p>`;
SCREENS['02-owner'] = shell({
  title: 'Lead time for changes', cur: 'Goals', who: 'rhea', width: 'wide',
  body: CSS + `<a class="back" href="#">‹ your goals</a>` +
    summary({ stline: `${st('off')}<span class="num"> · 37 hours</span>`, title: 'Lead time for changes', ownerLine, measured,
      acts: `<span class="btn primary">Add a next step</span><span class="acts2"><span class="btn">Check in again</span><span class="btn">More</span></span>` }) +
    scoreOff + links(sectionLinks('1 open'), 1) +
    `<div class="layout"><div class="body">${whyBlock}<div class="o3">${chart(true)}</div>${feeds}</div>
<div class="aside">${nextBlock({
      open: '1 open', intro: noStep,
      mid: `<ul class="list">${row({ l1: 'Decision or help: approve the extra CI runner budget for Q4', l2: 'Asked of Amara by Rhea · 3 weeks ago', state: 'Open', btn: 'Withdraw' })}</ul>`,
      done: lbl('Done lately') + `<ul class="list">${doneRow('Done: one-page case for the Q4 runner budget', 'Rhea · week 44')}${doneRow('Question: can the runner pool scale up before the freeze?', 'Asked of Amara by Rhea · Answered · week 42', 'Amara: yes, from the platform reserve.')}</ul>`,
      btns: '<span class="btn">Add a next step</span><span class="btn">Ask for a decision or help</span>' })}${talk}</div></div>` +
    note('Wireframe 2. The owner of a goal in trouble: when no next step is open the section says so and the summary’s primary button becomes “Add a next step”; “Check in again” moves out of the menu. Fixes D1 and D2.'),
});

/* 3 — watch and comment */
SCREENS['03-watch-comment'] = shell({
  title: 'Lead time for changes', cur: 'Goals', who: 'oskar',
  body: CSS + `<div class="pn"><span class="label">A. Watch</span><div class="sheet">
<h2>Watch Lead time for changes</h2>
<p>Its check-ins, changes of status and new asks show on your Home and under Watching in Goals. Your name is listed under “Watched by” on this page. Faro sends no email.</p>
<div><div class="rdrow"><span class="rd y"></span><b>This goal</b></div><div class="rdrow"><span class="rd"></span><b>It and the 16 goals feeding it</b></div></div>
<div class="row"><span class="btn primary">Watch</span><span class="btn">Cancel</span></div></div></div>
<div class="pn"><span class="label">B. Add a comment, box open</span><div class="sheet">
<h2>Add a comment</h2>
<span class="input ta focus">Say what you think, or what you know</span>
<p class="hint">Everyone in Platform Engineering can read this. Rhea and the 6 people watching see it on Home.</p>
<div class="row"><span class="btn primary">Post comment</span><span class="btn">Cancel</span></div></div></div>` +
    note('Wireframe 3. Watch and comments now say what they do before anyone presses: where it shows, who is listed, who can read it and who sees it on Home. The comment box no longer carries “Ask as a question”; that is its own sheet. Fixes D7.'),
});

/* 4 — history */
const tabs = (cur) => `<div class="tabs f">${[['All', 31], ['Check-ins', 12], ['Comments', 5], ['Reviews', 9], ['Changes', 5]].map(([t, n]) => `<span class="${t === cur ? 'cur' : ''}">${t}<em>${n}</em></span>`).join('')}</div>`;
const ent = (w, body) => `<div class="ent"><span class="w">${w}</span><span class="b">${body}</span></div>`;
const change = `${ent('Change', `<span>Julia Novak changed the target from 5 to 7 days</span><span class="h">Reason: the new joiner laptop image slipped a quarter</span><span>${link('Show the change')}</span>`)}`;
SCREENS['04-history'] = shell({
  title: 'Developer onboarding time', cur: 'Goals', who: 'tunde',
  body: CSS + `<a class="back" href="#">‹ Goals</a>
<div class="panel" style="margin-bottom:24px"><div class="row" style="gap:10px 16px">${st('stale')}<b style="font-size:17px">Developer onboarding time</b><span class="hint">G-58</span></div></div>
<div class="sec" id="history"><h2>History</h2><p class="hint">Every week, what was said, and what changed, newest first.</p>
<span class="input">Add a comment</span>
${tabs('All')}
<div class="ents" style="margin-top:-8px">
${ent('Week 46', '<span>No check-in</span>')}
${ent('Week 45', '<span>No check-in</span>')}
${ent('Week 44', `<span><span class="num">9 days</span> · ${st('risk')}</span><span class="h">Reason: the new joiner laptop image slipped again, so two joiners this month still took the long route.</span>`)}
${ent('Review', '<span>Daniel Okafor looked at it in Developer Productivity fortnightly</span><span class="h">8 days ago</span>')}
${ent('Comment', '<span><b>Julia Novak</b> commented</span><span>Security has the image now. I expect it in week 49.</span><span class="h">2 days ago</span>')}
${change}
${ent('Weeks 30 to 35', '<span>No check-ins (6 weeks)</span>')}
</div><p>${link('Show all 31')}</p></div>
<div class="sec" style="margin-top:36px;border-top:1px solid var(--line);padding-top:18px"><span class="label">The Changes filter</span>
${tabs('Changes')}
<div class="ents" style="margin-top:-8px">${change}${ent('Change', '<span>Julia Novak changed the plan for week 40 from 6 to 7 days</span><span class="h">Reason: the first quarter’s plan assumed the old laptop image</span><span>' + link('Show the change') + '</span>')}</div>
<p class="hint">The address is <span class="addr">/goals/G-58?history=changes</span></p></div>` +
    note('Wireframe 4. History shows every week, including the ones with no check-in, with the kinds as links with counts, and the filter lives in the address so a link can point at it. Fixes D6.'),
});

/* 5 — healthy */
SCREENS['05-healthy'] = shell({
  title: 'Remote build cache hit rate', cur: 'Goals', who: 'oskar', width: 'wide',
  body: CSS + `<a class="back" href="#">‹ Goals</a>` +
    summary({ wash: false, stline: `${st('on')}<span class="num"> · 82%</span>`, title: 'Remote build cache hit rate',
      ownerLine: `<span class="av sm">RK</span><span>Rhea Kapoor, CI/CD</span><span>Team level</span><span>G-23</span><span>Updated 11 Nov · week 46</span>`,
      measured: `Measured by ${link('Cache hit rate')} · percent, higher is better`,
      acts: `<span class="acts2"><span class="btn">Watch</span><span class="btn">More</span></span>` }) +
    score([['VS PLAN', '2 points ahead of plan', 'plan 80%'], ['VS LAST WEEK', '1 point better', 'was 81% in week 45'], ['TO TARGET', 'Target met', 'target 80%'], ['WILL IT HIT 80%?', 'Very likely', 'likely 83% by year end']]) +
    links(['Now', 'Next steps and asks', 'Why', 'Chart', 'History', 'About'], 0) +
    `<div class="layout"><div class="body"><div class="sec o2" id="why"><h2>The latest word</h2><p class="hint">The owner’s note, from this week’s check-in.</p>
<p class="reason">Hit rate held above plan after the cache moved to the new region. Nothing is needed from anyone this week.</p></div>
<div class="o3">${chart(false)}</div></div>
<div class="aside"><div class="sec o1" id="next"><h2>Next steps and asks</h2><p class="hint">Who is doing what, by when, and what has been asked.</p><p>No next steps or asks yet.</p>
<div class="btns"><span class="btn">Add a next step</span><span class="btn">Ask Rhea a question</span></div></div>
<div class="talk o5"><h2>Last time we talked</h2><p>Not discussed yet. It isn’t in a review.</p></div></div></div>` +
    note('Wireframe 5. A healthy goal, seen by someone who does not own it: no primary action, no washed summary, “The latest word” instead of a reason, and an empty steps section that still shows what anyone can do. Fixes D4 and D10.'),
});

kit.render(__dirname, SCREENS);
