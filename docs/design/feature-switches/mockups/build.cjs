/* Wireframes for more switches (docs/design/feature-switches/README.md, spec.md section 4).
   Usage: node docs/design/feature-switches/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md.
   Numbers are the demo's on 11 Nov 2026 where it shows them (126 goals, 97 people, 41 need attention, 6 reviews,
   Rhea's 8 goals and 5 to do, Amara watching 56, Rhea 12, Oskar 3, the wrap-up opening 21 Dec 2026). The counts of
   watches, tokens and things sent are examples: the demo has no tokens, and its inbox was not read. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, sw, shell, note } = kit;

const CSS = `<style>
.state{margin-bottom:36px}.state>.label{display:block;margin-bottom:10px}
.frow{align-items:flex-start!important}.frow .t span{display:block}.frow .t .cnt1{color:var(--fg-2)}.frow .act{display:flex;gap:12px;align-items:center;flex:none}
.rb{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.rb li{display:flex;gap:10px;align-items:flex-start}.rb li i{width:6px;height:6px;border-radius:999px;background:var(--muted);flex:none;margin-top:8px}
.rb b{font-weight:600}
.sheet{margin:0;width:auto;max-width:520px}.sheet .foot{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.mini{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
.mini h2{font-size:20px;line-height:26px}.mini .cap{font-size:12px;font-weight:600;color:var(--muted)}
.strip{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.strip.two{grid-template-columns:repeat(2,1fr)}.strip.one{grid-template-columns:1fr}
.strip>div{padding:12px 14px;min-width:0}.strip>div+div{border-left:1px solid var(--line-2)}.strip .l{font-size:12px;font-weight:600;color:var(--muted);display:block}.strip .v{font-weight:650;display:block}.strip .s{font-size:13px;color:var(--muted);display:block}
.cnt{display:flex;flex-direction:column;gap:2px;font-size:14px}.cnt.across{flex-direction:row;flex-wrap:wrap;gap:4px 16px}
.hero{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:8px}.hero h3{font-size:19px;line-height:26px}.hero .cap{font-size:12px;font-weight:600;color:var(--muted)}
.meta{display:flex;gap:8px 16px;flex-wrap:wrap;color:var(--muted);font-size:14px;align-items:center}
.cells{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.cells>div{padding:14px 16px;min-width:0}.cells>div+div{border-left:1px solid var(--line-2)}
.cells .l{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;display:block}.cells .v{font-size:19px;line-height:26px;font-weight:650;display:block}.cells .s{font-size:13px;color:var(--muted);display:block}
.was{color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:8px;padding:8px 12px}
.jump{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:14px;color:var(--accent-text);border-bottom:1px solid var(--line);padding-bottom:10px}
.mlist{margin:0;padding:0;list-style:none;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:14px}.mlist li{padding:9px 14px}.mlist li+li{border-top:1px solid var(--line-2)}
.two-col{display:flex;gap:40px;align-items:flex-start}.two-col>.main{flex:1;min-width:0;display:flex;flex-direction:column;gap:24px}.two-col>.sidecol{width:340px;flex:none;display:flex;flex-direction:column;gap:24px}
.dg text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;fill:#183638}.dg .m{fill:#465759}.dg .b{font-weight:650}
.dg-wrap{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px}.dg-wrap svg{display:block;width:100%;height:auto}
.key{display:flex;gap:10px 28px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin-top:12px}.key span{display:inline-flex;gap:8px;align-items:center}.key i{width:34px;height:0;border-top:2px solid var(--fg);display:inline-block}.key i.d{border-top:2px dashed var(--muted)}
@media (max-width:700px){
 .pair{grid-template-columns:1fr}.cells{grid-template-columns:1fr}.cells>div+div{border-left:0;border-top:1px solid var(--line-2)}
 .strip,.strip.two{grid-template-columns:1fr}.strip>div+div{border-left:0;border-top:1px solid var(--line-2)}
 .frow{flex-wrap:wrap}.frow .act{width:100%;justify-content:space-between}
 .sheet .foot .btn{flex:1}.two-col{display:block}.two-col>.sidecol{width:auto;margin-top:24px}
 .tabs{flex-wrap:wrap;gap:0 18px}.head .row.nowrap{flex-wrap:wrap}.head .row.nowrap .btn{flex:1}
}
</style>`;

/* The kit's shell draws today's menu. A switched-off module's row is not there, and the phone's tabs close up
   (feature-toggles spec 4.8). The kit isn't edited: the finished page is adjusted here. */
function shellOff({ off = [], ...o }) {
  const has = (n) => !off.includes(n);
  const counts = { 'Check-in': 5, ...(has('Reviews') ? { Reviews: 1 } : {}) };
  let html = shell({ ...o, counts });
  for (const n of off) html = html.replace(new RegExp(`<div class="nav (cur)?"><i></i>${n}(<span class="n">\\d+</span>)?</div>`), '');
  if (!has('Reviews')) {
    const owner = o.who !== 'amara' && o.who !== 'oskar';
    html = owner
      ? html.replace(/<span class="(cur)?">Reviews<\/span>/, '<span class="">People</span>')
      : html.replace(/<span class="(cur)?">Reviews<\/span>/, '').replace(/<span class="(cur)?">People<\/span>/, '<span class="">People</span><span class="">Activity</span>');
  }
  return html;
}

const wsMenu = (cur) => `<div class="menu">${['About', 'Cycles', 'Access', 'Features', 'Privacy', 'Recently removed'].map((n) => `<span class="${n === cur ? 'cur' : ''}">${n}</span>`).join('')}</div>`;
const wsHead = `<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>`;
const SCREENS = {};

/* 1. Workspace, Features: every switch recommended, grouped */
const featureRow = (name, says, count, right) => `<li class="frow"><span class="t"><b>${name}</b><span>${says}</span>${count ? `<span class="cnt1">${count}</span>` : ''}</span><span class="act">${right}</span></li>`;
SCREENS['01-features'] = shell({ title: 'Features', cur: 'Workspace', who: 'amara', width: 'wide', body: `${CSS}
${wsHead}
<div class="layout">${wsMenu('Features')}<div class="body">
<div class="stack"><div class="stack" style="gap:2px"><h2>Features</h2><p class="hint">How Platform Engineering works, and the optional parts of Faro. They apply to everyone here.</p></div></div>
<div class="stack"><h3>How you work</h3>
<ul class="list">
${featureRow('Check-in rhythm', 'Every week, due by Thursday. A goal with no check-in for 14 days reads “No recent update”.', '', `<span class="btn">Change</span>`)}
</ul></div>
<div class="stack"><h3>Working together</h3>
<ul class="list">
${featureRow('Reviews', 'Walk a set of goals together on a cadence, decide what happens next and keep what was said.', '6 reviews are set up.', sw(true))}
${featureRow('Watching', 'Follow goals you don’t own: they show on your Home and under Watching in Goals.', '31 people watch goals here.', sw(true))}
${featureRow('Wrap-up', 'At the end of the year, each owner says how their goals landed and what they learned.', 'Opens on 21 Dec 2026.', sw(true))}
</ul></div>
<div class="stack"><h3>Tools</h3>
<ul class="list">
${featureRow('Metric library', 'Define each number goals are measured by once, and say which metric measures a goal.', '13 metrics measure 12 goals.', sw(true))}
${featureRow('Spreadsheets', 'Download the goals as Excel or CSV, and load changes back from a spreadsheet.', '', sw(true))}
${featureRow('Goal map', 'See every goal and what feeds it on one canvas, with the path the risk runs along.', '', sw(true))}
</ul></div>
<div class="stack"><h3>Beyond this workspace</h3>
<ul class="list">
${featureRow('AI access', 'Let Claude or another AI tool read and act here through MCP, as one person, with that person’s rights.', '3 tokens are in use.', sw(true))}
${featureRow('Feedback', 'Send feedback about Faro, or mark up a screen. It goes to the people who build Faro.', '14 sent from here.', sw(true))}
</ul>
<p class="hint">Switching one off hides it and keeps what it saved. Recording how the app is used is under <a>Privacy</a>. <a>About features</a></p></div>
</div></div>
${note('Wireframe 1. Workspace, Features, as Amara (an admin), with every switch this design recommends. Four groups: “How you work” holds the settings (round 2’s check-in rhythm; the settings design adds its rows here, each with “Change”); then three groups of switches. A switch that owns something says how much, in one plain line, while it is on. Today the page lists Metric library and Spreadsheets under no heading. The counts for Watching, AI access and Feedback are examples.')}` });

/* 2. A read-back for a module that owns records (Watching), and the one switch that also asks before it comes back on */
const sheet = (title, body, primary, extra = '') => `<div class="sheet"><h2>${title}</h2>${body}<div class="foot">${extra}<span class="btn">Cancel</span><span class="btn primary">${primary}</span></div></div>`;
const rb = (items) => `<ul class="rb">${items.map((t) => `<li><i></i><span>${t}</span></li>`).join('')}</ul>`;
SCREENS['02-read-back'] = shell({ title: 'Features', cur: 'Workspace', who: 'amara', width: 'wide', body: `${CSS}
${wsHead}
<div class="pair">
<div class="state"><span class="label">(a) After pressing the Watching switch</span>
${sheet('Switch off Watching in Platform Engineering?', `
<p>For all 97 people here:</p>
${rb(['<b>Watching leaves Goals, Home and every goal’s page</b>: the Watching tab, “Goals you watch” and the Watch button.', '<b>31 people’s 74 watches are kept.</b> Nobody is shown as watching while it is off.', '<b>12 people own no goal and see Home through what they watch.</b> Their Home will show every goal that needs attention instead.', '<b>Goals don’t change.</b> Each is still on its owner’s Home, in Goals and in its reviews.', 'Nothing is deleted. Switch Watching back on and each person watches what they did.'])}`, 'Switch off Watching')}</div>
<div class="state"><span class="label">(b) After pressing the AI access switch, to switch it back on</span>
${sheet('Switch AI access back on in Platform Engineering?', `
${rb(['<b>3 tokens made before will work again at once</b>: Amara Nwosu’s “Claude on my laptop”, Rhea Kapoor’s “Claude”, Hamid Rezaei’s “Weekly brief”.', 'Each lets an AI tool act as that person, with that person’s rights. Every change is logged as theirs, marked “via MCP”.', 'To stop one for good, revoke it first.'])}`, 'Switch on AI access', '<span class="btn quiet">See the 3 tokens</span>')}</div>
</div>
${note('Wireframe 2. (a) The read-back for a module that owns records, in round 2’s form: what leaves the screen, what stays in the record, who will notice, in counts. After: a toast “Watching is off in Platform Engineering. Nothing it saved is lost.” with Undo. (b) The one exception to “switching on acts at once”: AI access kept its tokens while it was off, so switching it on says whose tokens come back to life before it acts. With no token kept, it acts at once like the others. The numbers of watches and tokens are examples; the build works them out.')}` });

/* 3. The smallest Faro: the menu and Home, as Rhea (an owner) and as Amara (a leader who owns no goal) */
const counts = (list, across) => `<div class="cnt ${across ? 'across' : ''}">${list.map(([k, n]) => st(k, n)).join('')}</div>`;
const grow = (k, title, why, value, gap, btn) => `<li class="goal ${k === 'off' ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${why}</span></span><span class="v"><b class="num">${value}</b>${gap}</span></li>`;
SCREENS['03-smallest-home'] = shellOff({ off: ['Reviews', 'Metrics', 'Feedback'], title: 'Home', cur: 'Home', who: 'rhea', width: 'wide', body: `${CSS}
<div class="head"><div class="stack"><h1>Good afternoon, Rhea</h1><p class="hint">Platform Engineering · week 46 · Q4</p></div></div>
<div class="two-col"><div class="main">
<div class="strip two"><div><span class="l">Your goals · 8</span>${counts([['off', 2], ['risk', 2], ['none', 1], ['on', 2], ['done', 1]])}</div><div><span class="l">On-time streak</span><span class="v">0 weeks</span><span class="s">Weeks with every check-in in by Thursday</span></div></div>
<div class="hero"><span class="cap">Check-ins are due by Thursday, tomorrow</span><h3>5 check-ins to do</h3><p class="hint">About 4 min · Flaky test rate in the main pipelines, and 4 more</p><div><span class="btn primary">Start check-in</span></div></div>
<div class="stack"><h2>Your goals · 8</h2>
<ul class="list">
${grow('off', 'Lead time for changes', 'Decision or help needed. Lead time is well above plan and the gap grew again this week.', '37 hours', '9 hours behind plan')}
${grow('off', 'Pipeline queue wait (p90)', 'Waiting on Infrastructure &amp; Compute to sign off the design.', '7 min', '3 min behind plan')}
${grow('risk', 'Flaky test rate in the main pipelines', 'Recovering: back to the planned pace for three weeks.', '1.8%', 'Near the 2.0% limit')}
${grow('on', 'Base image build time', 'Checked in 7 days ago.', '10 min', 'On plan')}
</ul><p class="hint"><a>See all 8 in Goals</a></p></div>
</div>
<div class="sidecol">
<div class="hero"><span class="cap">Needs your response · 1</span><p><b>Pipeline queue wait (p90)</b></p><p class="hint">“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”</p><p class="hint">Daniel asked 8 days ago.</p><div><span class="btn">Answer</span></div></div>
<div class="mini"><span class="cap">The same Home as Amara, who owns no goal</span>
<div class="strip one"><div><span class="l">All goals · 126</span>${counts([['off', 11], ['risk', 23], ['stale', 5], ['none', 2], ['on', 77], ['done', 8]], true)}</div></div>
<div class="hero"><h3>41 goals need attention</h3><p class="hint">11 off track · 23 at risk · 5 with no recent update · 2 waiting on a decision</p><div><span class="btn primary">See them</span></div></div></div>
</div></div>
<p class="was" style="margin-top:24px">Not here, and not greyed: the menu’s Reviews, Metrics and Feedback rows; Home’s “Next review” cell; “Goals you watch · 12”; “asked in Developer Productivity fortnightly… before its next session” on the question. In Goals: the Watching tab, the Map layout, “Export these goals”. With everything on, Amara’s lead is “Platform leadership weekly · 20 goals to discuss · Open the review”.</p>
${note('Wireframe 3. The smallest Faro that is still Faro: all eight switches off, the weekly rhythm kept. The menu is Home, Check-in, Goals; People, Activity, Data; New goal; Workspace, Settings, Help. On a phone the tabs are Home, Check-in, Goals, People, More. Home is the owner’s week: what is due, what is asked of her, her goals. A leader who owns nothing gets the whole workspace’s goals that need attention as her one action. What is left is exactly the core: goals, check-ins, the status rules, asks and next steps, the change log.')}` });

/* 4. The smallest Faro: a goal's page (Diego's goal, as Amara) */
const goalHead = (bar) => `<p class="hint" style="margin-bottom:10px"><a>Back to Merge-to-deploy time (median)</a></p>
<div class="head"><div class="stack"><h1>Merge queue live for every monorepo</h1>
<div class="meta"><span>Diego Ramírez · CI/CD</span><span>G-7</span><span>Updated 6 Nov · week 45</span></div>
<div class="meta">${st('off')}<span>2 of 4 stages done</span></div></div>
<div class="row nowrap">${bar}</div></div>`;
const cells3 = `<div class="cells" style="margin-bottom:14px">
<div><span class="l">Stages done</span><span class="v">2 of 4</span><span class="s">4 due by week 46</span></div>
<div><span class="l">Stages behind</span><span class="v">2</span><span class="s">late, up to 16 weeks</span></div>
<div><span class="l">Next stage</span><span class="v">Week 47</span><span class="s">Web monorepo on the merge queue, due week 31</span></div>
</div>`;
SCREENS['04-smallest-goal'] = shellOff({ off: ['Reviews', 'Metrics', 'Feedback'], title: 'Merge queue live for every monorepo', cur: 'Goals', who: 'amara', width: 'wide', body: `${CSS}
${goalHead('<span class="btn">More</span>')}
${cells3}
<div class="jump" style="margin-bottom:24px"><span>Now</span><span>Next steps and asks · 1</span><span>Why</span><span>Chart</span><span>What feeds it</span><span>History</span><span>About</span></div>
<div class="two-col"><div class="main">
<div class="stack"><h2>Why it will miss without intervention</h2><p class="hint">Diego said in week 45</p><p>Still waiting on MergeFlow for the API change we need. The support case is open and escalated.</p>
<p class="hint">Path to green: run the web monorepo on the queue without batching until MergeFlow ship the fix. Back on plan by week 50 (7–13 Dec).</p></div>
<div class="stack"><h2>History</h2><p class="hint">Every week, what was said, and what changed, newest first.</p>
<div class="tabs" style="margin-bottom:0"><span class="cur">All<em>59</em></span><span>Check-ins<em>46</em></span><span>Comments<em>8</em></span><span>Reviews<em>4</em></span><span>Changes<em>1</em></span></div>
<ul class="list">
<li><span class="t"><b>Week 45 · ${st('off')}</b><span>2 of 4 stages · Diego Ramírez checked in on 6 Nov</span></span></li>
<li><span class="t"><b>Week 44</b><span>Amara Nwosu looked at it in Platform leadership weekly</span></span></li>
</ul></div>
<div class="stack"><h2>About this goal</h2><p class="hint">Its definition and its plan week by week.</p></div>
</div>
<div class="sidecol">
<div class="hero"><span class="cap">Next steps and asks · 1</span><p><b>Waiting on a decision from Daniel</b></p><p class="hint">“Sign off running the web monorepo without batching.” Diego asked 4 days ago.</p></div>
<div class="stack"><span class="label">Behind “More”</span><ul class="mlist"><li>Share image</li><li>Copy link</li><li>Print or save as PDF</li><li>Check in for Diego</li><li>Change this goal</li><li>Stop this goal</li></ul></div>
</div></div>
<p class="was" style="margin-top:24px">Not here: the “Watch” button beside the main one; “Measured by” under the owner; “Last time we talked”; “who watches it” in About, and its “Watched by” list. Still here, because it is the record and not the feature: History’s “Reviews · 4” tab and its entries, shown for as long as there are any, as plain text with no link.</p>
${note('Wireframe 4. A goal’s page in the smallest Faro, as Amara on Diego’s goal. No primary action for her, because nothing here is asked of her (round 1’s rule; the owner’s is the check-in, or “Add a next step”), then the scorecard, why, next steps and asks, the chart, what feeds it, History and About. Nothing on the page is a module’s. The page is the same for the owner, whose main button is the check-in.')}` });

/* 5. A goal's page with Watching and Feedback (markup) off, beside today's, as Oskar */
const lower = (rows) => `<div class="stack"><span class="label">The menu’s last group</span><ul class="mlist">${rows.map((r) => `<li>${r}</li>`).join('')}</ul></div>`;
const gmini = (cap, bar, about, menu, extra) => `<div class="mini"><span class="cap">${cap}</span>
<h2>Merge queue live for every monorepo</h2>
<div class="meta"><span>Diego Ramírez · CI/CD</span><span>G-7</span></div>
<div class="meta">${st('off')}<span>2 of 4 stages done</span></div>
<div class="row">${bar}</div>
<div class="stack"><h3>About this goal</h3>${about}</div>
${lower(menu)}${extra}</div>`;
SCREENS['05-goal-watching-markup-off'] = shell({ title: 'A goal’s page', bare: true, body: `${CSS}
<div class="pair">
${gmini('(a) Today, as Oskar, who watches this goal', '<span class="btn">Watching</span><span class="btn">More</span>', '<p class="hint">Its definition, its plan week by week, and who watches it.</p><p><span class="label">Watched by</span><br>Amara Nwosu, Oskar Lindgren and 3 more</p>', ['Workspace', 'Settings', 'Help', 'Feedback'], '<p class="hint">Ctrl + Shift + M starts a markup of this screen. Feedback’s sheet offers “Mark up this screen”.</p>')}
${gmini('(b) Watching and Feedback off', '<span class="btn">More</span>', '<p class="hint">Its definition and its plan week by week.</p>', ['Workspace', 'Settings', 'Help'], '<p class="hint">Ctrl + Shift + M does nothing. Help has no “What you raised”.</p>')}
</div>
<p class="was" style="margin-top:20px">Oskar’s watch on this goal is kept while Watching is off. His Home, which showed “Goals you watch · 3”, shows instead “You don’t own a goal. Set one up in about 3 minutes.” with the buttons “See all goals” and “Set up a goal”. Anything he sent to Feedback stays in the builders’ inbox and can still be answered there.</p>
${note('Wireframe 5. The same goal as Oskar, who owns nothing and watches three goals. (a) today; (b) with Watching and Feedback switched off. The bar keeps “More” and loses “Watching”; About loses its last clause and its list; the menu loses its Feedback row. Nothing is greyed and no sentence says what is missing. For someone who is not the owner and may not act, the bar may hold only “More”: that is the page’s honest state, as round 1 has it for a person who can’t act.')}` });

/* 6. What depends on what: the core, the eight modules and their soft links */
function diagram(wide) {
  const box = (x, y, w, h, title, lines = [], dash = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${dash ? '#FAF9F6' : '#fff'}" stroke="#183638" stroke-width="${dash ? 1 : 1.4}" ${dash ? 'stroke-dasharray="4 3"' : ''}/><text class="b" x="${x + 12}" y="${y + 22}" font-size="14">${title}</text>${lines.map((l, i) => `<text class="m" x="${x + 12}" y="${y + 41 + i * 17}" font-size="12">${l}</text>`).join('')}`;
  const line = (x1, y1, x2, y2, dash) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${dash ? '#465759' : '#183638'}" stroke-width="${dash ? 1.4 : 1.6}" ${dash ? 'stroke-dasharray="5 4"' : ''} fill="none"/>`;
  const label = (x, y, lines) => lines.map((l, i) => `<text class="m" x="${x}" y="${y + i * 15}" font-size="11.5">${l}</text>`).join('');
  const groups = [
    ['Working together', [['Reviews', '1 table · 6 AI tools'], ['Watching', '1 table · 3 AI tools'], ['Wrap-up', '1 table · 2 AI tools']], [[0, 1, ['A leader’s Home', 'falls back to', 'watched goals']]]],
    ['Tools', [['Metric library', '2 tables · 5 AI tools'], ['Spreadsheets', 'no table · 2 AI tools'], ['Goal map', 'no table · no tool']], [[0, 1, ['The Metrics sheet,', 'while both are on']]]],
    ['Beyond this workspace', [['AI access', '1 table · 3 AI tools'], ['Feedback', '4 tables · 8 AI tools']], [[0, 1, ['“Connect Claude”', 'in the inbox']]]],
  ];
  const coreLines = wide
    ? ['Records: people and teams · goals and plans · check-ins · asks and next steps · comments · the change log', 'Rules: status, flags and “needs attention” · the forecast and “getting worse” · results by quarter · ending a year and starting the next', 'Screens: Home · Check-in · Goals (List, Table, Board, History) · a goal’s page · People · Activity · Data · Workspace · Settings · Help']
    : ['People and teams · goals and plans', 'Check-ins · asks and next steps', 'The change log, with undo', 'Status, flags, the forecast', 'Results; ending a year', 'Home · Check-in · Goals · a goal', 'People · Activity · Data', 'Workspace · Settings · Help'];
  const W = wide ? 1040 : 358;
  let out = '';
  const coreH = 46 + coreLines.length * 17;
  out += box(wide ? 20 : 4, 10, W - (wide ? 40 : 8), coreH, 'The core: always on. It never imports a module', coreLines);
  if (wide) {
    const colW = 320, top = coreH + 60;
    groups.forEach(([name, mods, soft], g) => {
      const x = 20 + g * (colW + 20);
      const h = 40 + mods.length * 74;
      out += line(x + 95, top, x + 95, coreH + 10);
      out += box(x, top, colW, h, name, [], true);
      mods.forEach(([m, facts], i) => { out += box(x + 12, top + 34 + i * 74, 166, 60, m, [facts]); });
      soft.forEach(([a, b, words]) => {
        const xa = x + 178, ya = top + 34 + a * 74 + 30, yb = top + 34 + b * 74 + 30;
        out += `<path d="M${xa} ${ya}h16V${yb}h-16" stroke="#465759" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>` + label(xa + 24, (ya + yb) / 2 - (words.length - 1) * 7.5 + 4, words);
      });
    });
    return `<svg class="dg" viewBox="0 0 ${W} ${coreH + 60 + 40 + 3 * 74 + 14}" role="img" aria-label="The core, eight modules in three groups, and three soft links">${out}</svg>`;
  }
  let y = coreH + 10;
  groups.forEach(([name, mods, soft]) => {
    const h = 40 + mods.length * 74;
    out += line(60, y, 60, y + 26);
    y += 26;
    out += box(4, y, W - 8, h, name, [], true);
    mods.forEach(([m, facts], i) => { out += box(16, y + 34 + i * 74, 166, 60, m, [facts]); });
    soft.forEach(([a, b, words]) => {
      const xa = 182, ya = y + 34 + a * 74 + 30, yb = y + 34 + b * 74 + 30;
      out += `<path d="M${xa} ${ya}h14V${yb}h-14" stroke="#465759" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>` + label(xa + 22, (ya + yb) / 2 - (words.length - 1) * 7.5 + 4, words);
    });
    y += h;
  });
  return `<svg class="dg" viewBox="0 0 ${W} ${y + 10}" role="img" aria-label="The core, eight modules in three groups, and three soft links">${out}</svg>`;
}
SCREENS['06-dependencies'] = shell({ title: 'What depends on what', bare: true, body: `${CSS}
<div class="stack" style="gap:4px;margin-bottom:16px"><h1>What depends on what</h1><p class="hint">Eight modules, none of which needs another. Every one registers into the core; the core reads none of their records.</p></div>
<div class="dg-wrap"><div class="desk-only">${diagram(true)}</div><div class="phone-only">${diagram(false)}</div></div>
<div class="key"><span><i></i>registers into the core’s extension points (routes, menu, places, tools, Help)</span><span><i class="d"></i>a soft link: shown only while both are on; neither imports the other</span></div>
<p class="was" style="margin-top:16px">Every module’s <b>needs</b> is empty. Asks are core, so “reviews need asks” no longer holds. The three soft links are each one link or one sheet, hidden by the core’s answer to “is that module on?”, never by an import. Not modules, and why: asks, Activity, saved views, the Table, Board and History layouts, the one-pager and What’s new are core; the forecast is a core rule with two numbers to set; recording is a setting on Privacy; the demo, its walkthroughs and the research page belong to the deployment, not to a workspace.</p>
${note('Wireframe 6. The dependency picture. The core in one box, with what it keeps; three groups of modules as the Features page names them; a solid line from each group to the core for “registers into”; a dashed line for each soft link. Tables and AI tools are counted from the code on 11 Nov 2026 (Feedback’s eight include send_feedback, which is in the core’s tool file today).')}` });

kit.render(__dirname, SCREENS);
