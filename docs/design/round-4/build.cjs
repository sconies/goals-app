/* Wireframes for round 4 (docs/design/round-4/README.md and each item's spec.md).
   Usage: node docs/design/round-4/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md, and use the shared kit
   (docs/design/_shared/kit.cjs) so they read as the same app as rounds 1 to 3. Numbers are illustrative. */
const path = require('path');
const kit = require('../_shared/kit.cjs');
const { st, warn, note, shape } = kit;

const EXTRA = `<style>
.ws4{padding:6px 10px 12px;display:flex;justify-content:space-between;gap:8px}.ws4 b{display:block}.ws4 span{font-size:12px;color:var(--muted)}
.focus{max-width:620px;margin:0 auto;padding:24px 16px 64px}.focus .x{display:flex;justify-content:space-between;color:var(--muted);font-size:14px;margin-bottom:22px}
.big{font-size:40px;line-height:46px;font-weight:650;font-variant-numeric:tabular-nums}
.numfield{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:24px;font-weight:650;font-variant-numeric:tabular-nums}
.numfield.focus-on{outline:2px solid var(--fg);outline-offset:1px}.numfield small{font-size:15px;font-weight:400;color:var(--muted)}.numfield.empty{color:var(--faint);font-weight:400;font-size:16px}
.choice{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.choice span{padding:11px 14px;display:flex;gap:10px;align-items:center;min-height:44px}.choice span+span{border-top:1px solid var(--line-2)}
.choice i{width:16px;height:16px;border-radius:999px;border:1.6px solid var(--fg);flex:none}.choice .is i{box-shadow:inset 0 0 0 3.5px var(--surface);background:var(--fg)}.choice .is{font-weight:600}
.case{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.02em;margin:28px 0 8px}.case:first-child{margin-top:0}
.hr{height:1px;background:var(--line);margin:22px 0}
.rail{width:64px;flex:none;border-right:1px solid var(--line);padding:12px 0;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:720px;position:relative}
.ri{position:relative;width:44px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--fg-2)}.ri i{width:18px;height:18px;border:1.6px solid currentColor;border-radius:4px;opacity:.7;display:block}
.ri.f{font-weight:800;font-size:22px;color:var(--fg)}.ri.open{outline:2px solid var(--fg);outline-offset:-2px;background:var(--surface)}.ri.cur{background:var(--surface)}
.railmain{padding:32px 32px 32px 340px}.rsep{width:36px;height:1px;background:var(--line);margin:6px 0}.rgap{flex:1}
.demo{width:44px;height:28px;border:1px dashed var(--line);border-radius:6px;font-size:10px;font-weight:700;color:var(--risk);display:flex;align-items:center;justify-content:center;letter-spacing:.06em}
.pop{position:absolute;left:58px;top:8px;z-index:2;width:300px;font-size:15px;line-height:22px;font-weight:400;text-align:left;background:var(--surface);border:1px solid var(--fg);border-radius:10px;padding:6px 0}
.pop div{padding:9px 14px;display:flex;justify-content:space-between;gap:10px;min-height:44px;align-items:center}.pop div+div{border-top:1px solid var(--line-2)}.pop .h{font-size:12px;font-weight:600;color:var(--muted);min-height:0;padding:8px 14px}.pop small{display:block;font-size:12px;color:var(--muted);font-weight:400}
.weeks{display:grid;grid-template-columns:repeat(8,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.weeks div{padding:10px 8px;text-align:center;font-size:13px;line-height:18px}.weeks div+div{border-left:1px solid var(--line-2)}
.weeks b{display:block;font-size:12px;color:var(--muted);font-weight:600}.weeks em{font-style:normal;display:block;font-weight:600}.sq{display:block;margin:6px auto}
.result{font-variant-caps:all-small-caps;letter-spacing:.04em;font-weight:650;color:var(--on)}
.sec{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:26px 0 8px}.sec span{color:var(--muted);font-size:14px}
.cells{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cells div{padding:14px 16px}.cells div+div{border-left:1px solid var(--line-2)}.cells b{display:block}.cells span{font-size:14px;color:var(--muted)}
@media (max-width:700px){.weeks{grid-template-columns:repeat(4,1fr)}.weeks div:nth-child(n+5){border-top:1px solid var(--line-2)}.weeks div:nth-child(5){border-left:0}.cells{grid-template-columns:1fr}.cells div+div{border-left:0;border-top:1px solid var(--line-2)}.railwrap{display:block!important}.railmain{padding:16px}.rail{display:none}.pop{position:static;width:auto;margin-bottom:16px}.focus{padding:16px}}
</style>`;

/* The week marks are squares, not circles: a circle is a goal's status and nothing else (design rules). */
const sq = (k) => ({
  in: '<svg class="sq" width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  some: '<svg class="sq" width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1" y="6" width="10" height="5" fill="currentColor"/></svg>',
  none: '<svg class="sq" width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
}[k]);

/* A shell whose workspace and menu can be said, for the small workspace. */
function shell({ title, ws = 'Platform Engineering', sub = 'Example · week 46 · Q4', rows, cur, who = ['RK', 'Rhea Kapoor', 'CI/CD'], body, width = '', tabs = ['Home', 'Check-in', 'Goals', 'Reviews', 'More'] }) {
  const groups = rows || [['Home', 'Check-in', 'Goals', 'Reviews'], ['People', 'Metrics', 'Activity', 'Data'], ['New goal'], ['Workspace', 'Settings', 'Help', 'Feedback']];
  const item = (n) => { const [name, count] = [].concat(n); return `<div class="nav ${name === cur ? 'cur' : ''}"><i></i>${name}${count ? `<span class="n">${count}</span>` : ''}</div>`; };
  const head = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${kit.CSS}</style>${EXTRA}`;
  return `${head}
<div class="top"><span class="f">F</span><div style="flex:1;min-width:0"><b>${title}</b><span>${ws}</span></div><span class="tf">Find</span><span class="av">${who[0]}</span></div>
<div class="app"><nav class="side"><div class="brand">Faro</div><div class="ws4"><div><b>${ws}</b><span>${sub}</span></div><span class="chev">⌄</span></div>
<div class="find"><span>Find</span><span class="kbd">Ctrl K</span></div>
${groups.slice(0, 3).map((g) => g.map(item).join('')).join('<div class="sep"></div>')}
<div class="gap"></div><div class="sep"></div>${groups[3].map(item).join('')}
<div class="me"><span class="av">${who[0]}</span><div><b>${who[1]}</b><div class="hint" style="font-size:12px">${who[2]}</div></div></div></nav>
<main><div class="page ${width}">${body}</div></main></div>
<div class="tabbar">${tabs.map((t) => `<span class="${t === cur ? 'cur' : ''}">${t}</span>`).join('')}</div></html>`;
}
/* A focused task (the check-in, set-up): one narrow column and one way out. */
const focus = (title, crumb, body) => `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${kit.CSS}</style>${EXTRA}<div class="focus"><div class="x"><span>${crumb}</span><span>Close and keep the draft</span></div>${body}</div></html>`;

const SMALL = { ws: 'Harbour Studio', sub: '5 people · week 46 · Q4', who: ['IM', 'Ines Moreau', 'Admin'] };
const smallRows = [['Home', ['Check-in', 2], 'Goals', 'Reviews'], ['People', 'Activity', 'Data'], ['New goal'], ['Workspace', 'Settings', 'Help', 'Feedback']];

/* ───────────────────────── 1. Small workspaces ───────────────────────── */
const sm = {
  '01-home-small': shell({ ...SMALL, title: 'Home', cur: 'Home', rows: smallRows, body: `
<div class="head"><div class="stack"><h1>Good morning, Ines</h1><p class="hint">Harbour Studio · week 46 · Q4</p></div></div>
<div class="panel"><p class="label">Check-ins are due by Thursday 12 Nov</p><h2>2 check-ins to do</h2><p class="hint">Studio bookings per month, and Repeat clients.</p><div><span class="btn primary">Start check-in</span></div></div>
<div class="sec"><h2>The team’s goals · 9</h2><a>See them in Goals</a></div>
<div class="counts">${st('off', 1)}${st('risk', 2)}${st('on', 5)}${st('done', 1)}</div>
<ul class="list" style="margin-top:12px">
${kit.goal('off', 'Studio bookings per month', 'Two cancellations this week; the autumn offer starts on the 20th.', '31', '9 under plan')}
${kit.goal('risk', 'Repeat clients', 'Flat for three weeks.', '42%', '3 points under plan')}
${kit.goal('risk', 'Quote turnaround', 'Checked in on Tuesday.', '3.5 days', 'half a day over plan')}
</ul>
<p class="hint" style="margin-top:10px">6 more are on track or done.</p>
${note('A five-person workspace: ten menu rows, no Metrics row until there is a metric, no “Goals you watch” while nobody watches anything, and one list of the team’s goals in place of “Your goals” and “Your team”. Nothing here is a mode: the same rules give Platform Engineering its full menu.')}` }),

  '02-setup-step-1': focus('Set up a workspace', 'Step 1 of 4 · The workspace and you', `
<h1>What’s this workspace for, and who are you?</h1>
<div class="stack" style="gap:16px;margin-top:22px">
<div class="field"><b>Workspace name</b><span class="input filled">Harbour Studio</span></div>
<div class="field"><b>Your name</b><span class="input filled">Ines Moreau</span></div>
<div class="field"><b>Your email</b><span class="input filled">ines@harbour.example</span></div>
<div class="field"><b>Your team</b><span class="input filled">Studio</span></div>
<p class="hint">You’ll be this workspace’s admin: you can add people, change settings and make others admins.</p>
<div class="panel"><p class="label">How you’ll work</p><p>Check-ins every week, by Thursday. A weekly review on Thursdays. The year starts in January.</p><p class="hint">Most teams start this way. You can change it now, on the last step, or any time in Workspace.</p><div><span class="btn sm">Change how you’ll work</span></div></div>
<div class="row between"><span></span><span class="btn primary">Continue to people</span></div></div>
${note('Set-up in four steps: the workspace and you, people, goals, check. “How you’ll work” is ST2’s second step, kept whole but opened only by someone who wants to change it; its answers are read back here and on the last step.')}`),

  '03-rail-switcher': `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The icon rail</title><style>${kit.CSS}</style>${EXTRA}
<div class="railwrap" style="display:flex"><div class="rail">
<div class="ri f open">F<div class="pop"><div class="h">Workspace</div><div><span><b>Platform Engineering</b><small>Example · week 46 · Q4 · you are an admin</small></span><span class="hint">Here</span></div><div><span><b>Harbour Studio</b><small>5 people</small></span><span class="chev">›</span></div><div><a>Set up a workspace</a></div></div></div>
<div class="ri"><i style="border-radius:999px"></i></div><div class="rsep"></div>
<div class="ri cur"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="rsep"></div>
<div class="ri"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="rsep"></div><div class="ri"><i></i></div>
<div class="rgap"></div><div class="rsep"></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div><div class="ri"><i></i></div>
<div class="demo">DEMO</div><div class="ri"><span class="av sm">RK</span></div></div>
<main class="railmain"><div class="page narrow"><h1>Good morning, Rhea</h1><p class="hint" style="margin-top:6px">Platform Engineering · week 46 · Q4</p>
${note('The collapsed rail. The Faro mark at the top is the workspace control: the same place the switcher has on the full sidebar, and no new row, so the Demo box keeps its room. Its name for a screen reader and on focus is “Platform Engineering: switch workspace, or set one up”. On a phone the switcher stays under the page’s name, as today.')}</div></main></div></html>`,

  '04-goals-and-empty': shell({ ...SMALL, title: 'Goals', cur: 'Goals', rows: smallRows, body: `
<div class="head"><div class="stack"><h1>Goals</h1><p class="hint">Week 46 of 53 · Q4 (Oct–Dec) · 2026</p></div><span class="btn primary">New goal</span></div>
<div class="tabs"><span>Mine<em>3</em></span><span class="cur">All<em>9</em></span></div>
<p class="countline"><b>9 goals</b>, worst first. 1 off track · 2 at risk · 5 on track · 1 done</p>
<ul class="list">${kit.goal('off', 'Studio bookings per month', 'Two cancellations this week.', '31', '9 under plan')}${kit.goal('risk', 'Repeat clients', 'Flat for three weeks.', '42%', '3 points under plan')}</ul>
<div class="hr"></div>
<p class="case">METRICS, OPENED FROM FIND OR FROM WORKSPACE → FEATURES, BEFORE THERE IS ONE</p>
<div class="stack"><h2>No metrics yet</h2><p class="hint">You don’t need one until two goals share a number. Then say what it means once, here, and both goals mean the same thing.</p><div><span class="btn">Add a metric</span></div></div>
<p class="case">WATCHING, OPENED BY ITS ADDRESS</p>
<div class="stack"><h2>You’re not watching anything</h2><p class="hint">Everything in Harbour Studio is already yours or your team’s. Watch is on a goal’s page when there is more to follow.</p></div>
${note('One team, so “My team” and “All” would be the same list: the tab that repeats another is not drawn, and neither is a tab with nothing to show. A nought is never printed (“Watching 0”). Empty pages say when you would want them, and their button is a plain one.')}` }),
};

/* ───────────────────────── 2. Readings fill in the check-in ───────────────────────── */
const stepHead = `<p class="label">CI pipeline time on main (p90) · week 46</p><h1 style="margin-top:4px">What’s the number this week?</h1><p class="hint" style="margin-top:6px">The slowest tenth of main-branch pipelines, in minutes. Lower is better.</p>`;
const nr = {
  '01-filled-in': focus('Check-in', 'Check-in · 1 of 3 · The number', `${stepHead}
<div class="stack" style="gap:14px;margin-top:22px">
<div class="field"><b>This week’s value</b><span class="numfield">12 <small>min</small></span></div>
<p><b>From CI analytics</b>, read 9:02 today.</p>
<p class="hint">Week 45: 13 min. Change the number if it’s wrong, and you’ll be asked why. You still say what changed: that is the next step.</p>
<div class="row between"><span class="btn quiet">No new number this week</span><span class="btn primary">Confirm 12 min</span></div></div>
${note('The reading is in the field when the step opens. The button names the number, so confirming is something read, not a reflex. Nothing is posted until the owner finishes the check-in.')}`),

  '02-corrected': focus('Check-in', 'Check-in · 1 of 3 · The number', `${stepHead}
<div class="stack" style="gap:14px;margin-top:22px">
<div class="field"><b>This week’s value</b><span class="numfield focus-on">14 <small>min</small></span></div>
<p>You typed 14 min. <b>CI analytics</b> said 12 min, read 9:02 today. <a>Put 12 min back</a></p>
<div class="field"><b>Why is it different?</b>
<div class="choice"><span><i></i>The source is behind: I have a newer number</span><span class="is"><i></i>The source counts something else</span><span><i></i>The source is wrong this week</span><span><i></i>Something else</span></div></div>
<div class="field"><b>Say more <span class="hint" style="font-weight:400">(optional, unless “Something else”)</span></b><span class="input filled">It leaves out the release branch pipelines we moved on Monday.</span></div>
<p class="hint">Kept with this check-in, beside what CI analytics said. It doesn’t change the goal’s status and nobody is told.</p>
<div class="row between"><span class="btn quiet">No new number this week</span><span class="btn primary">Use 14 min</span></div></div>
${note('Correcting: the owner’s number is the check-in’s number. The reading and the reason are recorded beside it and shown in History; no flag is raised in a review.')}`),

  '03-stale-missing': focus('Check-in', 'Check-in · 1 of 3 · The number', `
<p class="case">A READING OLDER THAN 7 DAYS IS NOT FILLED IN</p>
<div class="stack" style="gap:12px"><div class="field"><b>This week’s value</b><span class="numfield empty">Type it here</span></div>
<p>${warn('CI analytics last read this on Mon 2 Nov, 11 days ago.')}</p><p class="hint">That is too old to fill in. Type this week’s number, or say there isn’t one. Week 45: 13 min.</p></div>
<p class="case">THE SOURCE HAS NO NUMBER FOR THIS TEAM’S PART</p>
<div class="stack" style="gap:12px"><div class="field"><b>This week’s value</b><span class="numfield empty">Type it here</span></div>
<p class="hint">CI analytics measures this for the whole company, not for CI/CD on its own, so it isn’t filled in. Where to get it: the CI/CD runner dashboard.</p></div>
<p class="case">THE SOURCE HAS NOTHING YET</p>
<div class="stack" style="gap:12px"><p class="hint">CI analytics has no number for this yet. Type this week’s number.</p></div>
<p class="case">THE SOURCE CAN’T BE REACHED</p>
<div class="stack" style="gap:12px"><p class="hint">CI analytics couldn’t be reached just now. Type the number, or <a>try again</a>.</p></div>
<p class="case">NOTHING NEW SINCE THE LAST CHECK-IN</p>
<div class="stack" style="gap:12px"><p class="hint">No new reading since your last check-in: CI analytics still says 13 min, read Fri 6 Nov.</p><div class="row"><span class="btn primary">No new number this week</span><span class="btn quiet">Type a different number</span></div></div>
${note('In every one of these the step is today’s step with one sentence added. The too-old case never shows the old value, so it can’t be confirmed by accident; the warning mark is the app’s own, and it is not a status.')}`),

  '04-elsewhere': shell({ title: 'CI pipeline time on main (p90)', cur: 'Goals', body: `
<p class="hint"><a>Goals</a> › CI pipeline time on main (p90)</p>
<div class="head" style="margin-top:6px"><div class="stack"><h1>CI pipeline time on main (p90)</h1><p>${st('on')} · 12 min, 1 min ahead of plan</p></div><span class="btn primary">Check in</span></div>
<h2>Measured by</h2>
<dl class="facts" style="margin-top:10px"><dt>Metric</dt><dd><a>CI pipeline time on main (p90)</a>, for the whole company</dd><dt>Where the number comes from</dt><dd>CI analytics (Ethan Brooks), refreshed hourly</dd><dt>This week’s number</dt><dd>12 min, from CI analytics, read 9:02 on Thu 12 Nov. Confirmed by Rhea Kapoor.</dd></dl>
<div class="sec"><h2>History</h2><span>Check-ins</span></div>
<ul class="list">
<li><span class="t"><b>Week 46 · 12 min</b><span>From CI analytics, read 9:02 on Thu 12 Nov. Rhea Kapoor checked in.</span></span></li>
<li><span class="t"><b>Week 45 · 13 min</b><span>From CI analytics, read 9:00 on Thu 5 Nov. Rhea Kapoor checked in.</span></span></li>
<li><span class="t"><b>Week 44 · 15 min</b><span>Typed by Rhea Kapoor. CI analytics said 13 min. The source counts something else: “It leaves out the release branch pipelines we moved on Monday.”</span></span></li>
<li><span class="t"><b>Week 43 · 15 min</b><span>Typed by Rhea Kapoor.</span></span></li></ul>
<div class="hr"></div>
<p class="case">ON THE METRIC’S PAGE, UNDER “WHERE THE NUMBER COMES FROM”</p>
<table class="stackable"><thead><tr><th>Goal</th><th>For</th><th>In its check-in</th></tr></thead><tbody>
<tr><td><a>CI pipeline time on main (p90)</a></td><td>The whole company</td><td>Filled in from CI analytics · last read 9:02 today</td></tr>
<tr><td><a>Pipeline time, CI/CD’s pipelines</a></td><td>CI/CD</td><td>Typed by hand: CI analytics has no number per team</td></tr></tbody></table>
<p class="hint" style="margin-top:10px">In the last 8 weeks, 1 of 8 check-ins filled in from CI analytics used a different number. <a>See them</a></p>
${note('Where a reading’s source is visible outside the check-in: the goal’s “Measured by”, every History row, the metric’s page (which goals it fills in, and how often the owner’s number differed, a fact about the source for whoever owns it), the read-back, the sheet export and the review’s agenda row (“· from CI analytics”, in the quiet ink).')}` }),
};

/* ───────────────────────── 3. The habit moment ───────────────────────── */
const wk = (n, k, word) => `<div><b>${n}</b>${sq(k)}<em>${word}</em></div>`;
const strip = `<div class="weeks">${wk('Wk 39', 'in', 'All in')}${wk('Wk 40', 'in', 'All in')}${wk('Wk 41', 'some', '2 after')}${wk('Wk 42', 'in', 'All in')}${wk('Wk 43', 'in', 'All in')}${wk('Wk 44', 'in', 'All in')}${wk('Wk 45', 'some', '1 after')}${wk('Wk 46', 'in', 'All in')}</div>`;
const hb = {
  '01-receipt': focus('Check-in', 'Check-in · done', `
<p class="case">THE LAST CHECK-IN OF THE WEEK, IN BEFORE THE REVIEW</p>
<div class="stack"><h1>Week 46 is done</h1><p>All 7 of your check-ins are in before Thursday’s review.</p><p class="hint">That is 6 weeks in a row. Week 41 came in late; one late week doesn’t break a run.</p><div class="row"><span class="btn primary">Back to Home</span><span class="btn quiet">Correct a check-in</span></div></div>
<p class="case">THE SAME, WHEN SOME CAME AFTER</p>
<div class="stack"><h1>Week 46 is done</h1><p>All 7 of your check-ins are in. 2 came after Thursday’s review.</p><p class="hint">The next are due by Thursday 19 Nov.</p></div>
<p class="case">A CHECK-IN THAT TAKES THE GOAL TO ITS TARGET</p>
<div class="panel"><p>${st('done')}</p><h2>Base image build time reached its target</h2><p>10 min, against a target of 10 min, in week 46 of 53. It started the year at 19 min.</p><div class="row"><span class="btn">Copy the share image</span><span class="btn quiet">See the goal</span></div></div>
<p class="case">A CHECK-IN THAT BRINGS THE GOAL BACK</p>
<div class="panel"><p>${st('on')}</p><h2>Flaky test rate is back on track</h2><p>1.2%, after 3 weeks behind plan.</p></div>
${note('What one person sees, and only about themselves. No animation beyond the receipt’s existing fade, no confetti, no emoji. The line about asks is never said to the person: whether somebody had to ask is counted only for a set of goals.')}`),

  '02-review': shell({ title: 'Platform leadership weekly', cur: 'Reviews', who: ['AN', 'Amara Nwosu', 'Admin'], body: `
<p class="hint"><a>Reviews</a> › Platform leadership weekly</p>
<div class="head" style="margin-top:6px"><div class="stack"><h1>Platform leadership weekly</h1><p class="hint">Thursday 12 Nov · 17 goals · 6 people</p></div><span class="btn primary">Start the review</span></div>
<div class="panel"><p class="label">Before this review</p><h2>15 of 17 goals were checked in before it, 14 without being asked</h2><p class="hint"><a>1 came in after an ask</a>. <a>2 have no check-in for week 46 yet</a>.</p></div>
<div class="sec"><h2>The last 8 weeks</h2><span>These 17 goals, by week</span></div>
${strip}
<p class="hint" style="margin-top:8px">“All in” means every goal due that week was checked in before the review. Weeks, not people: nobody is named here.</p>
<div class="sec"><h2>Still to review · 5</h2><span>Worst first</span></div>
<ul class="list">${kit.goal('off', 'Lead time for changes', 'Decision or help needed.', '37 hours', '13 over plan')}${kit.goal('off', 'Pipeline queue wait (p90)', 'Waiting on the runner budget.', '7 min', '2 over plan')}</ul>
${note('What a team sees: one sentence that opens the review, and one row of weeks for the review’s own goals. The squares are a week’s standing, never a goal’s status, and each has its words. The same sentence and strip are on a team’s page, for the team’s goals.')}` }),

  '03-leader-cell': shell({ title: 'Home', cur: 'Home', who: ['AN', 'Amara Nwosu', 'Admin'], body: `
<div class="head"><div class="stack"><h1>Good morning, Amara</h1><p class="hint">Platform Engineering · week 46 · Q4</p></div></div>
<div class="cells"><div><span>Checked in for week 46</span><b>98 of 118 goals</b><span>Due by Thu 12 Nov · <a>20 not yet</a></span></div>
<div><span>Before the review, without being asked</span><b>91 of 118 goals · 77%</b><span>Week 45: 74% · <a>By week</a></span></div>
<div><span>Next review</span><b>Platform leadership weekly</b><span>Today</span></div></div>
<p class="hint" style="margin-top:10px">Counts of goals across your teams. “By week” opens the row of weeks; “20 not yet” opens those goals, worst first.</p>
${note('HM7’s cell, and beside it the habit measure: the share of goals checked in before the review that nobody asked for. A percentage is shown only from 20 goals; under that it is “5 of 6 goals”. It is never shown for a set of goals with fewer than three owners, and never per person.')}` }),
};

/* ───────────────────────── 4. A VP's week across the division ───────────────────────── */
const row = (k, title, team, line, right) => `<li class="goal ${k === 'off' ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${team} · ${line}</span></span><span class="v">${right}</span></li>`;
const pf = {
  '01-this-week': shell({ title: 'Goals', cur: 'Goals', width: 'wide', who: ['AN', 'Amara Nwosu', 'Admin'], body: `
<div class="head"><div class="stack"><h1>Goals</h1><p class="hint">Week 46 of 53 · Q4 (Oct–Dec) · 2026</p></div><span class="btn primary">New goal</span></div>
<div class="tabs"><span>Mine<em>2</em></span><span>My teams<em>41</em></span><span>Watching<em>12</em></span><span class="cur">All<em>126</em></span></div>
<div class="bar"><span class="input">Find a goal</span><span class="row desk-only" style="gap:8px"><span class="btn sm">Team: any</span><span class="btn sm">Since Monday 9 Nov</span><span class="btn sm on">View: This week</span></span><span class="btn phone-only">Filter and sort</span></div>
<p class="countline"><b>126 goals</b> across 9 teams. Since Monday: 4 got worse · 3 recovered · 2 done · 5 forecasts changed · 6 gone quiet</p>

<div class="sec"><h2>Moved this week · 9</h2><a>See all 9</a></div>
<ul class="list"><li class="grp">Got worse · 4</li>
${row('off', 'Lead time for changes', 'CI/CD', 'Was at risk. The merge queue rollout slipped again.', '<b class="num">37 hours</b>13 over plan')}
${row('risk', 'Change failure rate', 'Build &amp; Release', 'Was on track. Two rollbacks this week.', '<b class="num">6.1%</b>1.1 over plan')}
<li class="grp">Recovered · 3 &nbsp;·&nbsp; Done · 2</li>
${row('on', 'Flaky test rate in the main pipelines', 'CI/CD', 'Was at risk. Back on plan after 3 weeks.', '<b class="num">1.2%</b>on plan')}</ul>

<div class="sec"><h2>Forecasts that changed · 5</h2><a>See all 5</a></div>
<ul class="list">
${row('on', 'Self-serve environments', 'Developer Experience', 'Still on track today.', warn('Now forecast to miss') + '<br>ends near 61%, target 70%')}
${row('risk', 'Pipeline queue wait (p90)', 'CI/CD', 'Still at risk today.', '<b>Now forecast to reach</b>ends near 5 min, target 5 min')}</ul>
<p class="hint" style="margin-top:8px">The app’s projection from the last eight weeks, not the owner’s date. Only a forecast that crossed its target is listed.</p>

<div class="sec"><h2>Gone quiet · 6</h2><a>See all 6</a></div>
<ul class="list">
${row('stale', 'On-call handover checklist adopted', 'Reliability', 'Last said on track, 23 days ago. Nobody has asked.', '<span class="btn sm">Ask for an update</span>')}
${row('stale', 'Docs coverage for internal APIs', 'Developer Experience', 'Last said on track, 16 days ago. Nobody has asked.', '<span class="btn sm">Ask for an update</span>')}</ul>

<div class="sec"><h2>Where the red is · 3 teams</h2><span>Teams with a third or more of their goals off track</span></div>
<table class="stackable"><thead><tr><th>Team</th><th>Off track</th><th>Of those</th><th>Since Monday</th></tr></thead><tbody>
<tr><td><a>CI/CD</a></td><td>6 of 17 goals</td><td>2 have no recovery plan · 1 needs a decision</td><td>1 got worse</td></tr>
<tr><td><a>Build &amp; Release</a></td><td>4 of 11 goals</td><td>All have a recovery plan</td><td>No change</td></tr>
<tr><td><a>Reliability</a></td><td>3 of 9 goals</td><td>1 has no recovery plan</td><td>1 recovered</td></tr></tbody></table>
<p class="hint" style="margin-top:8px">Listed by how many goals are off track, to show where help is needed. 6 other teams have fewer than a third off track.</p>
${note('“This week” is a view of Goals, beside List, Table, Board, History and Map. It reads whichever goals the tabs and filters give it (All, My teams, Watching, one team), so “the division” is a saved view, not a new idea in the data. Every count is a link to exactly those goals. A person is never a row, a column or a sort order here.')}` }),

  '02-home-entry': shell({ title: 'Home', cur: 'Home', who: ['AN', 'Amara Nwosu', 'Admin'], body: `
<div class="head"><div class="stack"><h1>Good morning, Amara</h1><p class="hint">Platform Engineering · week 46 · Q4</p></div></div>
<div class="sec" style="margin-top:0"><h2>Changed since Monday 9 Nov</h2><a>See this week across your teams</a></div>
<p>4 got worse · 3 recovered · 6 went quiet · 2 done</p>
<div class="sec"><h2>Teams, worst first</h2><span>Home’s own table (HM3)</span></div>
<table class="stackable"><thead><tr><th>Team</th><th>Needs attention</th><th>Its goals</th><th>Since Mon 9 Nov</th></tr></thead><tbody>
<tr><td><a>CI/CD</a></td><td><a>7 need attention</a></td><td>6 off track · 3 at risk · 8 on track</td><td>1 got worse</td></tr>
<tr><td><a>Build &amp; Release</a></td><td><a>5 need attention</a></td><td>4 off track · 2 at risk · 5 on track</td><td>No change</td></tr></tbody></table>
<div class="hr"></div>
<p class="case">IN THE MENU, UNDER GOALS, FOR THE WHOLE WORKSPACE (A VIEW PINNED FOR EVERYONE)</p>
<div class="panel" style="max-width:260px"><div class="nav cur"><i></i>Goals</div><div class="nav sub">This week across the division</div><div class="nav sub">Division at a glance</div><div class="nav sub">No update for 2 weeks or more</div></div>
${note('Two ways in, and no new menu row: Home’s “Changed since” line for a leader (HM4) opens the view over that leader’s teams; the demo pins “This week across the division” for everyone, beside the views it has today.')}` }),
};

/* ───────────────────────── 5. Reviews as a feature switch ───────────────────────── */
const offRows = [['Home', ['Check-in', 1], 'Goals'], ['People', 'Metrics', 'Activity', 'Data'], ['New goal'], ['Workspace', 'Settings', 'Help', 'Feedback']];
const offTabs = ['Home', 'Check-in', 'Goals', 'People', 'More'];
const rs = {
  '01-home-reviews-off': shell({ title: 'Home', cur: 'Home', rows: offRows, tabs: offTabs, body: `
<div class="head"><div class="stack"><h1>Good morning, Rhea</h1><p class="hint">Platform Engineering · week 46 · Q4</p></div></div>
<div class="panel"><p class="label">Check-ins are due by Thursday 12 Nov, tomorrow</p><h2>1 check-in to do</h2><p class="hint">CI cost per pipeline run.</p><div><span class="btn primary">Start check-in</span></div></div>
<div class="sec"><h2>Needs your response · 1</h2><span></span></div>
<ul class="list"><li><span class="av sm">DO</span><span class="t"><b>Pipeline queue wait (p90)</b><span>“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?” Daniel asked 8 days ago.</span></span><span class="btn sm">Answer</span></li></ul>
<div class="sec"><h2>Your goals · 8</h2><a>See them in Goals</a></div>
<div class="counts">${st('off', 2)}${st('risk', 1)}${st('none', 1)}${st('on', 3)}${st('done', 1)}</div>
${note('Reviews off. The menu has no Reviews row and the phone’s fourth tab is People. Home has no review card and no “Next review”; the check-in line names the day, not a review; an ask says how long it has waited instead of which session it was due before. Nothing is greyed and nothing says “off”.')}` }),

  '02-switch-off': shell({ title: 'Workspace', cur: 'Workspace', who: ['AN', 'Amara Nwosu', 'Admin'], body: `
<p class="hint"><a>Workspace</a> › Features</p>
<div class="sheet" style="margin:18px 0"><h2>Switch off Reviews in Platform Engineering?</h2>
<p><b>Reviews leaves the menu</b>, and Home’s “Next review”.</p>
<p><b>3 reviews stay in the record</b>, with what was said and decided in them. Each goal’s History keeps its part.</p>
<p><b>7 open next steps agreed in a review stay open</b>, on their goals, with their owners and dates.</p>
<p><b>2 questions waiting for a review</b> stay open; they no longer name a session.</p>
<p><b>4 accepted risks stay on their goals</b>, as they were said. No new one can be accepted while Reviews is off.</p>
<p><b>Check-ins are still due by Thursday.</b> “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time.</p>
<p class="hint">Nothing is deleted. Switch Reviews back on and every review is as it was.</p>
<div class="row between"><span class="btn">Keep Reviews on</span><span class="btn primary">Switch Reviews off</span></div></div>
${note('FT2’s read-back, with two lines added by round 4: accepted risks, and the day check-ins are due. Counts come from the same rule that draws the pages, so the sheet can’t promise what the app won’t do.')}` }),

  '03-team-and-goal': shell({ title: 'CI/CD', cur: 'People', rows: offRows, tabs: offTabs, body: `
<p class="hint"><a>People</a> › <a>Teams</a> › CI/CD</p>
<div class="head" style="margin-top:6px"><div class="stack"><h1>CI/CD</h1><p class="hint">6 people · 17 goals</p></div></div>
<div class="panel"><p class="label">Week 46, due by Thursday 12 Nov</p><h2>15 of 17 goals were checked in on time, 14 without being asked</h2><p class="hint"><a>1 came in after an ask</a>. <a>2 have no check-in for week 46 yet</a>.</p></div>
<div class="sec"><h2>The last 8 weeks</h2><span>These 17 goals, by week</span></div>
${strip}
<p class="hint" style="margin-top:8px">“All in” means every goal due that week was checked in by its Thursday. Weeks, not people: nobody is named here.</p>
<div class="hr"></div>
<p class="case">ON A GOAL’S PAGE, IN HISTORY, WHILE REVIEWS IS OFF</p>
<ul class="list">
<li><span class="t"><b>Next step agreed · Tue 10 Nov</b><span>Tariq to confirm the runner budget by 19 Nov. Agreed in Developer Productivity fortnightly.</span></span></li>
<li><span class="t"><b>Risk accepted · Tue 27 Oct</b><span>“We accept the risk: queue wait stays over plan until the new runners arrive.” Said in Platform leadership weekly.</span></span></li>
<li><span class="t"><b>Looked at · Tue 27 Oct</b><span>By Amara Nwosu, in Platform leadership weekly.</span></span></li></ul>
<p class="hint" style="margin-top:8px">A review’s name is words here, not a link, while Reviews is off.</p>
${note('The habit measure and the row of weeks keep working with Reviews off, on the same clock (the day check-ins are due) under plainer words. What was said in reviews stays on each goal; the review’s own pages are closed until the switch is back on.')}` }),
};

(async () => {
  for (const [dir, screens] of [['small-workspaces', sm], ['readings', nr], ['habit', hb], ['portfolio', pf], ['reviews-switch', rs]]) {
    await kit.render(path.join(__dirname, dir, 'mockups'), screens);
  }
})();
