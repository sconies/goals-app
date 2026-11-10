/* Wireframes for App navigation (docs/design/navigation/README.md and spec.md).
   Usage: node docs/design/navigation/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, shell, goal, note } = kit;

const CSS = `<style>
.rail{width:64px;flex:none;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 0;display:flex;flex-direction:column;align-items:center;gap:2px}
.ri{position:relative;width:44px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--fg-2)}
.ri i{width:20px;height:20px;border:1.6px solid currentColor;border-radius:4px;opacity:.7;display:block}
.ri.f{font-weight:800;font-size:20px}.ri.ws i{background:var(--fg);border-color:var(--fg);color:#fff;opacity:1;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;font-style:normal}
.ri.cur{background:var(--surface);outline:2px solid var(--fg);outline-offset:-2px}
.ri .n{position:absolute;top:1px;right:1px;font-size:11px;line-height:14px;font-weight:600;color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:0 3px}
.rsep{width:36px;height:1px;background:var(--line);margin:6px 0}.rgap{height:34px}
.tip{position:absolute;left:52px;top:3px;z-index:2;white-space:nowrap;background:var(--surface);border:1px solid var(--fg);border-radius:6px;padding:3px 10px;font-size:14px;line-height:22px;font-weight:600;color:var(--fg)}
.vpanel{position:absolute;left:52px;top:0;z-index:2;width:260px;background:var(--surface);border:1px solid var(--fg);border-radius:8px;padding:4px 0;text-align:left}
.vpanel div{padding:6px 12px;font-size:14px;line-height:20px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vpanel .h{font-size:12px;font-weight:600;color:var(--muted)}
.railwrap{display:flex;gap:290px;align-items:flex-start}.railbody{flex:1;min-width:0;max-width:620px;padding-top:6px}
.stmt{display:none;margin-top:20px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.lead{color:var(--muted);margin-top:4px}
.phonecol{max-width:390px;margin:0 auto;border:1px solid var(--line);border-radius:10px;background:var(--bg);overflow:hidden}
.ptop{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.ptop b{display:block}.ptop span.s{font-size:12px;color:var(--muted);display:block}
.ptop .f{font-weight:800;font-size:20px;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
.ptop .tf{font-size:13px;font-weight:600;color:var(--accent-text);border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--surface);min-height:44px;display:inline-flex;align-items:center}
.msheet{background:var(--surface);padding:16px 16px 8px}.msheet h2{margin-bottom:6px}
.mg{padding:10px 0 2px}.mg .label{display:block;margin-bottom:2px}.mr{display:flex;align-items:center;min-height:44px;border-top:1px solid var(--line-2);gap:12px}.mr:first-of-type{border-top:0}
.mr i{width:16px;height:16px;border:1.6px solid var(--fg-2);border-radius:4px;opacity:.7;flex:none}.mr>.hint{margin-left:auto;font-size:13px;text-align:right}
.pbar{display:flex;justify-content:space-around;background:var(--surface);border-top:1px solid var(--line);padding:6px 4px 12px;font-size:12px;font-weight:600;color:var(--muted)}
.pbar span{padding:8px 8px;border-radius:8px}.pbar .cur{color:var(--fg);background:var(--bg);outline:2px solid var(--fg);outline-offset:-2px}
.pnl{margin-bottom:28px}.pnl>.label{display:block;margin-bottom:8px}
.browser{display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--line);padding:0 8px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px}
.btab{display:flex;gap:8px;align-items:center;padding:8px 14px;margin:6px 0 -1px;background:var(--surface);border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;font-size:13px;min-width:0;max-width:100%}
.btab b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.btab em{font-style:normal;font-weight:800;color:var(--accent-text)}
.fhead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.confirm{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:12px;max-width:460px}
@media (max-width:700px){
 .railbody{display:none}.railwrap{gap:0}.stmt{display:block}.vpanel{width:min(260px,calc(100vw - 150px))}
 .phonecol{border-left:0;border-right:0;border-radius:0}
}
@media (min-width:701px){.stmt{display:none!important}}
</style>`;

const ri = (label, { n, cls = '', inner = '<i></i>', extra = '' } = {}) => `<div class="ri ${cls}" aria-label="${label}">${inner}${n ? `<span class="n">${n}</span>` : ''}${extra}</div>`;
const rail = () => `<div class="rail">
${ri('F', { cls: 'f', inner: 'F' })}${ri('Workspace', { cls: 'ws', inner: '<i>P</i>' })}${ri('Find')}<div class="rsep"></div>
${ri('Home')}${ri('Check-in', { n: 5, cls: 'cur', extra: '<span class="tip">Check-in, 5 to do</span>' })}
${ri('Goals', { extra: `<div class="vpanel"><div class="h">Goals</div><div>Division at a glance</div><div>No update for 2 weeks or more</div><div>My goals by status</div></div>` })}${ri('Reviews', { n: 1 })}<div class="rsep"></div>
${ri('People')}${ri('Metrics')}${ri('Activity')}${ri('Data')}<div class="rsep"></div>${ri('New goal')}<div class="rgap"></div><div class="rsep"></div>
${ri('Workspace')}${ri('Settings')}${ri('Help')}${ri('Feedback')}<div class="rsep"></div><span class="av sm">RK</span></div>`;

const SCREENS = {};

/* 1 */
SCREENS['01-sidebar-owner'] = shell({
  title: 'Home', cur: 'Home', who: 'rhea',
  body: CSS + `
<div class="stack" style="gap:6px"><h1>Good afternoon, Rhea</h1><p class="hint">Check-ins are due by Thursday, tomorrow</p></div>
<div style="margin:18px 0 28px"><span class="btn primary">Start check-in</span></div>
<h2 style="margin-bottom:8px">Needs your response · 1</h2>
<ul class="list" style="margin-bottom:28px"><li><span class="t"><b>Tunde Bakare asked about Base image build time</b><span>Yesterday</span></span><span class="btn sm">Respond</span></li></ul>
<h2 style="margin-bottom:8px">Your goals · 8</h2>
<div class="counts">${st('on', 4)}${st('risk', 2)}${st('off', 1)}${st('stale', 1)}</div>
` + note('Wireframe 1. The sidebar for an owner: Find, then three short groups, with no headings. What left it: Mine, Watching and All (tabs on Goals now), Send feedback (one Feedback item), the Demo block (behind the name) and Collapse as a row (a small button in the header). It fits 900 px without scrolling.'),
});

/* 2 */
SCREENS['02-sidebar-watcher'] = shell({
  title: 'Goals', cur: 'Goals', who: 'oskar',
  views: [['Division at a glance', false], ['No update for 2 weeks or more', false], ['AI goals', true]],
  body: CSS + `
<h1 style="margin-bottom:14px">Goals</h1>
<div class="tabs"><span class="cur">Watching<em>3</em></span><span>All<em>126</em></span></div>
<ul class="list">
${goal('risk', 'Base image build time', 'Owned by Rhea Kapoor · CI/CD', '14 min', '3 min behind plan', { wash: false })}
${goal('on', 'Lead time for changes', 'Owned by Rhea Kapoor · CI/CD', '31 hours', 'On plan')}
${goal('off', 'Pipeline queue wait (p90)', 'Owned by Tunde Bakare · Build &amp; Release', '9 min', '4 min behind plan')}
</ul>
` + note('Wireframe 2. Oskar owns no goal, so there is no Check-in. Up to four saved views sit under Goals; the one that is open (AI goals) is lit over its whole row. Watching and All are tabs on the page, not sidebar rows.'),
});

/* 3 */
SCREENS['03-collapsed'] = shell({
  title: 'Goals', bare: true,
  body: CSS + `
<div class="railwrap">
 <div style="position:relative">${rail()}</div>
 <div class="railbody"><h1>Goals</h1>
  <ul class="list" style="margin-top:16px">
  ${goal('risk', 'Base image build time', 'Owned by Rhea Kapoor', '14 min', '3 min behind plan', { wash: false })}
  ${goal('on', 'Lead time for changes', 'Owned by Rhea Kapoor', '31 hours', 'On plan')}
  </ul></div>
</div>
<div class="stmt"><p class="strong">A computer's layout: on a phone the tab bar and More replace the sidebar.</p></div>
` + note('Wireframe 3. The collapsed sidebar is a 64 px rail. Each icon names itself in a flat box on hover or keyboard focus (here Check-in, 5 to do), and the Goals icon opens a flat panel of saved views. Today the rail names nothing. Between 700 and 1099 px this rail is used whatever the setting.'),
});

/* 4 */
const qrow = (k, t, last, btn, extra = '') => `<li class="goal d0"><span class="s">${st(k)}</span><span class="t"><b>${t}</b><span>${last}${extra}</span></span><span class="btn sm" style="margin-left:auto">${btn}</span></li>`;
SCREENS['04-check-in-queue'] = shell({
  title: 'Check-in', cur: 'Check-in', who: 'rhea', width: 'narrow',
  body: CSS + `
<div class="stack" style="gap:4px"><h1>Check-in</h1><p class="hint">Week 46, 9 to 15 November. Check-ins are due by Thursday, tomorrow.</p></div>
<div style="margin:18px 0 28px"><span class="btn primary" style="white-space:normal;text-align:center;height:auto;padding:8px 14px">Start with Flaky test rate in the main pipelines</span></div>
<h2 style="margin-bottom:8px">To do this week · 5</h2>
<ul class="list" style="margin-bottom:28px">
${qrow('off', 'Flaky test rate in the main pipelines', 'Last week: 6.2% · 2.2 points over plan', 'Check in')}
${qrow('risk', 'Base image build time', 'Last week: 14 min · 3 min behind plan', 'Check in')}
${qrow('stale', 'CI cost per pipeline run', 'Draft kept', 'Carry on')}
${qrow('on', 'Pipeline queue wait (p90)', 'Last week: 9 min · on plan', 'Check in')}
${qrow('none', 'Lead time for changes', 'No check-in yet', 'Check in')}
</ul>
<h2 style="margin-bottom:8px">Done this week · 3</h2>
<ul class="list" style="margin-bottom:22px">
${qrow('on', 'Merge-to-deploy time', 'This week: 22 min · Checked in Monday', 'Correct it')}
${qrow('on', 'Build cache hit rate', 'This week: 91% · Checked in Tuesday', 'Correct it')}
</ul>
<p><a>Or type all your numbers in one table</a></p>
` + note('Wireframe 4. Check-in opens on the week\'s list instead of straight into the first form. Start with the first, or pick any; a kept draft says so and offers "Carry on". The sidebar stays. Home\'s "Start check-in" still goes straight to the first form.'),
});

/* 5 */
SCREENS['05-wayfinding'] = shell({
  title: 'Lead time for changes', cur: 'Goals', who: 'rhea',
  body: CSS + `
<div class="pnl"><span class="label">(a) A goal's page</span>
 <div class="panel" style="gap:12px">
  <a style="font-size:14px">‹ your goals</a>
  <h1>Lead time for changes</h1>
  <div class="sticky" style="margin:0"><span class="cur">Now</span><span>Next steps and asks</span><span>Why</span><span>Chart</span><span>What feeds it</span><span>History</span><span>About</span></div>
  <div class="browser"><div class="btab"><em>F</em><b>Lead time for changes · Platform Engineering · Faro</b></div></div>
  <p class="hint">The section links stick under the top as you scroll and light the section in view. The browser tab names the goal.</p>
 </div></div>
<div class="pnl"><span class="label">(b) Leaving a form</span>
 <div class="stack" style="gap:14px">
  <div class="fhead"><b>New goal · step 2 of 4</b><span class="btn">Close and keep the draft</span></div>
  <div class="confirm"><b>Close without saving? What you typed here will be lost.</b><div class="row"><span class="btn primary">Keep editing</span><span class="btn danger">Close without saving</span></div></div>
 </div></div>
<div class="pnl"><span class="label">(c) Page not found</span>
 <div class="panel" style="gap:12px;max-width:620px">
  <h1>Page not found</h1><p>There’s nothing at this address. The link may be old, or mistyped.</p>
  <div><span class="btn primary">Go to Home</span></div>
  <p class="strong" style="margin-top:6px">Or find what you were looking for</p>
  <div class="find" style="margin:0;min-height:44px"><span>Find</span><span class="kbd">Ctrl K</span></div>
  <p><a>Help</a></p>
 </div></div>
` + note('Wireframe 5. Three wayfinding aids on every page: one back link and a title for each page, one closing control per form (worded by whether the draft is kept), and a not-found page that offers Find. Each fixes a gap from today, where every goal\'s browser tab said "Goals".'),
});

/* 6 */
const mr = (n, hint = '') => `<div class="mr"><i></i><span>${n}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
SCREENS['06-phone-more'] = shell({
  title: 'More', bare: true,
  body: CSS + `
<p class="hint" style="text-align:center;margin-bottom:12px">A phone's layout</p>
<div class="phonecol">
 <div class="ptop"><span class="f">F</span><div style="flex:1;min-width:0"><b>Goals</b><span class="s">Platform Engineering · week 46</span></div><span class="tf">Find</span><span class="av">RK</span></div>
 <div class="msheet"><h2>More</h2>
  <div class="mg"><span class="label">Look up</span>${mr('People')}${mr('Metrics')}${mr('Activity')}${mr('Data')}</div>
  <div class="mg"><span class="label">Make</span>${mr('New goal')}</div>
  <div class="mg"><span class="label">This workspace and you</span>${mr('Workspace')}${mr('Settings')}${mr('Help')}${mr('Feedback')}</div>
  <div class="mg"><span class="label">Demo</span>${mr('Demo', 'Switch person, walkthroughs, start over')}</div>
  <div class="mr" style="border-top:1px solid var(--line);margin-top:8px;padding:8px 0"><span class="av">RK</span><div><b>Rhea Kapoor</b><div class="hint" style="font-size:12px">CI/CD</div></div></div>
 </div>
 <div class="pbar"><span>Home</span><span>Check-in 5</span><span>Goals</span><span>Reviews 1</span><span class="cur">More</span></div>
</div>
` + note('Wireframe 6. On a phone: a top bar with the page name, Find as a word, and four tabs plus More. More is one short sheet in the same groups as the sidebar, with group names shown, ten rows and no scrolling. No saved views, Mine or Send feedback.'),
});

kit.render(__dirname, SCREENS);
