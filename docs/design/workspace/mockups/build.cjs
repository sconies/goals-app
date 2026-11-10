/* Wireframes for the Workspace redesign (docs/design/workspace/README.md).
   Writes one HTML mock-up per screen beside this file and renders each at 1440 and 390 into ../wireframes/.
   Usage: node docs/design/workspace/mockups/build.cjs
   These are drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat surfaces,
   hairline rows, status as a shape plus a word, no edge stripes, quote bars, emoji or pill badges. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = __dirname;
const out = path.join(here, '..', 'wireframes');

const CSS = `
:root{--bg:#F6F5F1;--surface:#fff;--surface-2:#FAF9F6;--line:#E4E1D9;--line-2:#EBE8E1;--fg:#183638;--fg-2:#2F4A4C;--muted:#465759;--faint:#9AA3A1;--accent:#21968E;--accent-text:#136F78;--on:#1D7F5F;--risk:#93450A;--off:#B42318;--off-wash:#FFF6F5}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/22px Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent-text)}h1{font-size:28px;line-height:34px;margin:0;font-weight:650;letter-spacing:-.01em}h2{font-size:17px;line-height:24px;margin:0;font-weight:650}
p{margin:0}.hint{color:var(--muted);font-size:14px;line-height:20px}.label{font-size:12px;line-height:16px;font-weight:600;color:var(--muted)}
.app{display:flex;min-height:100vh}.side{width:236px;flex:none;border-right:1px solid var(--line);padding:18px 12px;display:flex;flex-direction:column;gap:2px}
.brand{font-weight:800;font-size:20px;padding:0 10px 10px}.wsname{padding:6px 10px 14px;display:flex;justify-content:space-between;gap:8px}.wsname b{display:block}.wsname span{font-size:12px;color:var(--muted)}
.nav{display:flex;gap:12px;align-items:center;padding:9px 10px;border-radius:8px;color:var(--fg-2)}.nav.cur{background:var(--surface);font-weight:650;color:var(--fg)}
.nav i{width:16px;height:16px;border:1.6px solid currentColor;border-radius:4px;flex:none;opacity:.7}.gap{flex:1}.sep{height:1px;background:var(--line);margin:8px 10px}
.me{display:flex;gap:10px;align-items:center;padding:10px}.av{width:32px;height:32px;border-radius:999px;background:var(--fg);color:var(--bg);font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none}.av.sm{width:26px;height:26px;font-size:10px}
main{flex:1;min-width:0;padding:32px 32px 64px}.page{max-width:880px}.page.wide{max-width:1060px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.head .stack{gap:4px}
.stack{display:flex;flex-direction:column;gap:8px}.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600;color:var(--fg);white-space:nowrap}
.btn.primary{background:var(--fg);border-color:var(--fg);color:#fff}.btn.quiet{border-color:transparent;background:transparent;color:var(--accent-text);padding:0 4px}.btn.danger{color:var(--off);border-color:#F0A39C}
.tabs{display:flex;gap:24px;border-bottom:1px solid var(--line);margin-bottom:18px}.tabs span{padding:10px 0;color:var(--muted);font-weight:600}.tabs .cur{color:var(--fg);box-shadow:0 2px 0 var(--fg)}
.input{display:flex;align-items:center;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--faint);flex:1;min-width:200px}
.list{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin:0;padding:0;list-style:none}.list li{display:flex;gap:12px;align-items:center;padding:12px 16px;min-height:56px}.list li+li{border-top:1px solid var(--line-2)}
.list .t{flex:1;min-width:0}.list .t b{display:block;font-weight:600}.list .t span{color:var(--muted);font-size:14px}.list .r{color:var(--muted);font-size:14px;text-align:right}.chev{color:var(--faint)}
.offwash{background:var(--off-wash)}
.layout{display:flex;gap:40px;align-items:flex-start}.menu{width:196px;flex:none;display:flex;flex-direction:column;gap:2px}.menu span{padding:9px 10px;border-radius:8px;color:var(--fg-2)}.menu .cur{background:var(--surface);font-weight:650;color:var(--fg)}.menu .grp{font-size:12px;font-weight:600;color:var(--muted);padding:14px 10px 4px}
.body{flex:1;min-width:0;display:flex;flex-direction:column;gap:28px}
.facts{margin:0;display:grid;grid-template-columns:150px 1fr;gap:10px 16px}.facts dt{color:var(--muted)}.facts dd{margin:0}
.st{display:inline-flex;gap:6px;align-items:center;font-weight:600;white-space:nowrap}.st svg{flex:none}.st.on{color:var(--on)}.st.risk{color:var(--risk)}.st.off{color:var(--off)}.st.stale{color:var(--muted)}
.counts{display:flex;gap:18px;flex-wrap:wrap}
.sw{display:inline-flex;gap:8px;align-items:center;font-weight:600}.sw i{width:36px;height:22px;border-radius:999px;border:1.6px solid var(--fg);position:relative;flex:none}.sw i:after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:999px;background:var(--fg)}.sw.is-on i{background:var(--fg)}.sw.is-on i:after{left:17px;background:#fff}
.sheet{width:440px;max-width:100%;margin:40px auto;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:20px;display:flex;flex-direction:column;gap:16px}
.note{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px;margin-top:8px}
.top,.tabbar{display:none}
@media (max-width:700px){
 .side{display:none}.app{display:block}main{padding:16px 16px 32px}
 .top{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.top b{display:block}.top span{font-size:12px;color:var(--muted)}.top .f{font-weight:800;font-size:20px}
 .tabbar{display:flex;margin-top:24px;background:var(--surface);border-top:1px solid var(--line);justify-content:space-around;padding:10px 0 14px;font-size:12px;font-weight:600;color:var(--muted)}.tabbar .cur{color:var(--accent-text)}
 h1{font-size:24px;line-height:30px}.head{flex-direction:column;align-items:stretch}.layout{display:block}.menu{display:none}.facts{grid-template-columns:1fr;gap:2px 0}.facts dd{margin-bottom:10px}
 .list li{flex-wrap:wrap}.list .t{flex:1 1 60%}.list .chev{order:2}.list .r.wide{order:3;flex-basis:100%;text-align:left}.list .r.wide:empty{display:none}.phone-only{display:block!important}.desk-only{display:none!important}
}
.phone-only{display:none}
`;

const shape = (k) => ({
  on: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="currentColor"/></svg>',
  risk: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 1.8a5.2 5.2 0 0 0 0 10.4z" fill="currentColor"/></svg>',
  off: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  stale: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2.2"/></svg>',
}[k]);
const st = (k, n) => `<span class="st ${k}">${shape(k)}${n} ${{ on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update' }[k]}</span>`;
const sw = (on) => `<span class="sw ${on ? 'is-on' : ''}"><i></i>${on ? 'On' : 'Off'}</span>`;

const NAV = ['Home', 'Goals', 'Reviews', 'Activity', 'People', 'Data', 'New goal'];
function shell({ title, cur, who = ['AN', 'Amara Nwosu', 'Admin'], body, wide }) {
  return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style>
<div class="top"><span class="f">F</span><div style="flex:1"><b>${title}</b><span>Platform Engineering · week 46</span></div><span class="av">${who[0]}</span></div>
<div class="app"><nav class="side"><div class="brand">Faro</div><div class="wsname"><div><b>Platform Engineering</b><span>Example · Week 46 · Q4</span></div><span class="chev">⌄</span></div>
${NAV.map((n) => `<div class="nav ${n === cur ? 'cur' : ''}"><i></i>${n}</div>`).join('')}
<div class="gap"></div><div class="sep"></div>
${['Workspace', 'Settings', 'Help', 'Feedback'].map((n) => `<div class="nav ${n === cur ? 'cur' : ''}"><i></i>${n}</div>`).join('')}
<div class="me"><span class="av">${who[0]}</span><div><b>${who[1]}</b><div class="hint" style="font-size:12px">${who[2]}</div></div></div></nav>
<main><div class="page ${wide ? 'wide' : ''}">${body}</div></main></div>
<div class="tabbar"><span>Home</span><span>Goals</span><span>Watching</span><span>Reviews</span><span class="cur">More</span></div></html>`;
}
const person = (i, n, role, right = '') => `<li><span class="av sm">${i}</span><span class="t"><b>${n}</b><span>${role}</span></span><span class="r wide">${right}</span><span class="chev">›</span></li>`;
const tabs = (cur) => `<div class="tabs"><span class="${cur === 'People' ? 'cur' : ''}">People · 97</span><span class="${cur === 'Teams' ? 'cur' : ''}">Teams · 14</span></div>`;
const wsMenu = (cur, admin = true) => `<div class="menu">${(admin ? ['About', 'Cycles', 'Access', 'Features', 'Privacy', 'Recently removed'] : ['About', 'Cycles', 'Privacy', 'Recently removed']).map((s) => `<span class="${s === cur ? 'cur' : ''}">${s}</span>`).join('')}</div>`;
const wsMore = (items) => `<div class="phone-only stack"><span class="label">More in Workspace</span><ul class="list">${items.map(([a, b]) => `<li><span class="t"><b>${a}</b><span>${b}</span></span><span class="chev">›</span></li>`).join('')}</ul></div>`;

const SCREENS = {
  '01-people': shell({ title: 'People', cur: 'People', body: `
<div class="head"><div class="stack"><h1>People</h1><p class="hint">Everyone in Platform Engineering, and the teams they are in.</p></div><span class="btn primary">Add a person</span></div>
${tabs('People')}
<div class="row" style="margin-bottom:8px"><span class="input">Find by name, job title or team</span><span class="btn desk-only">Team: every team</span><span class="btn desk-only">Admins only</span></div>
<p class="hint" style="margin:10px 0">97 people, A to Z. Showing 1 to 50.</p>
<ul class="list">
${person('AS', 'Aiko Suzuki', 'Senior Software Engineer · CI/CD', '2 goals')}
${person('AO', 'Akosua Owusu', 'Engineering Manager, Compute &amp; Kubernetes · Infrastructure &amp; Compute', 'Leads the team · 4 goals')}
${person('AN', 'Amara Nwosu', 'VP Platform Engineering · Office of the VP', 'Admin · leads the team · 1 goal')}
${person('AH', 'Amelia Hughes', 'FinOps Engineer · Cloud Cost (FinOps)', '1 goal')}
${person('AK', 'Anya Kowalski', 'Senior Infrastructure Engineer · Infrastructure &amp; Compute', 'No goals')}
${person('AM', 'Arjun Mehta', 'Engineering Manager, Data Platform · Data Platform', 'Leads the team · 3 goals')}
${person('AN', 'Astrid Nilsson', 'Infrastructure Engineer · Infrastructure &amp; Compute', 'No goals')}
</ul>
<div class="row" style="margin-top:14px;justify-content:space-between"><span class="hint">1 to 50 of 97</span><span class="btn">Next 47</span></div>
<p class="note">Wireframe 1. People, as an admin. A member sees the same page without “Add a person”. One flat list, A to Z, 50 a page; the team is on the row, so nothing is grouped and 15,000 people work the same way as 97.</p>` }),

  '02-person': shell({ title: 'Rhea Kapoor', cur: 'People', body: `
<p class="hint" style="margin-bottom:10px">‹ People</p>
<div class="head"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="av" style="width:48px;height:48px;font-size:16px">RK</span><div class="stack" style="gap:2px"><h1>Rhea Kapoor</h1><p class="hint">Engineering Manager, CI/CD</p></div></div><span class="btn primary">See Rhea’s 8 goals</span></div>
<dl class="facts" style="margin-bottom:28px">
<dt>Team</dt><dd><a>CI/CD</a>, which Rhea leads</dd>
<dt>Email</dt><dd>rhea.kapoor@example.com</dd>
<dt>Role here</dt><dd>Member. Admins change people, teams and settings.</dd>
<dt>Goals</dt><dd><div class="counts">${st('on', 4)}${st('risk', 2)}${st('off', 1)}${st('stale', 1)}</div></dd>
<dt>Reviews</dt><dd>Runs the <a>CI/CD weekly</a>; in the <a>Platform leadership weekly</a></dd>
</dl>
<div class="stack" style="gap:12px"><span class="label">For admins</span>
<div class="row"><span class="btn">Change details</span><span class="btn">Make an admin</span><span class="btn">Make an MCP token</span></div>
<div class="row"><span class="btn quiet">Mark as left…</span></div></div>
<p class="note">Wireframe 2. A person’s page, as an admin. Everyone can open it; a member sees everything above “For admins”. Reading a person and changing one are now separate: today a member’s click does nothing and an admin’s opens an edit form.</p>` }),

  '03-teams': shell({ title: 'People', cur: 'People', body: `
<div class="head"><div class="stack"><h1>People</h1><p class="hint">Everyone in Platform Engineering, and the teams they are in.</p></div><span class="btn primary">Add a team</span></div>
${tabs('Teams')}
<div class="row" style="margin-bottom:14px"><span class="input">Find a team or its lead</span></div>
<ul class="list">
<li><span class="t"><b>Build &amp; Release</b><span>Led by Pavel Novák · 7 people</span></span><span class="r wide"><span class="counts">${st('on', 9)}${st('risk', 5)}${st('off', 3)}</span></span><span class="chev">›</span></li>
<li><span class="t"><b>CI/CD</b><span>Led by Rhea Kapoor · 7 people</span></span><span class="r wide"><span class="counts">${st('on', 11)}${st('risk', 4)}${st('off', 2)}</span></span><span class="chev">›</span></li>
<li><span class="t"><b>Cloud Cost (FinOps)</b><span>Led by Ethan Brooks · 4 people</span></span><span class="r wide"><span class="counts">${st('on', 3)}${st('risk', 1)}</span></span><span class="chev">›</span></li>
<li><span class="t"><b>Data Platform</b><span>Led by Arjun Mehta · 8 people</span></span><span class="r wide"><span class="counts">${st('on', 6)}${st('risk', 2)}</span></span><span class="chev">›</span></li>
<li><span class="t"><b>Developer Experience</b><span>Led by Tariq Haddad · 8 people</span></span><span class="r wide"><span class="counts">${st('on', 10)}${st('risk', 3)}${st('off', 2)}</span></span><span class="chev">›</span></li>
<li><span class="t"><b>Developer Portal, Golden Paths &amp; Self-Service Environments</b><span>Led by Camille Laurent · 8 people</span></span><span class="r wide"><span class="counts">${st('on', 8)}${st('risk', 4)}</span></span><span class="chev">›</span></li>
</ul>
<p class="note">Wireframe 3. Teams. A row opens the team; Rename and Remove have left the rows (today: 28 buttons for 14 teams) and live on the team’s page. The rebuild indents this list as the team tree (R6a).</p>` }),

  '04-team': shell({ title: 'CI/CD', cur: 'People', body: `
<p class="hint" style="margin-bottom:10px">‹ Teams</p>
<div class="head"><div class="stack"><h1>CI/CD</h1><p class="hint">Led by <a>Rhea Kapoor</a> · 7 people · 17 goals this year</p></div><span class="btn primary">See its 17 goals</span></div>
<div class="stack" style="gap:28px">
<div class="stack"><span class="label">What it is here to do</span><p>Every change reaches production safely within the hour.</p></div>
<div class="stack"><span class="label">Goals</span><div class="counts">${st('on', 11)}${st('risk', 4)}${st('off', 2)}</div></div>
<div class="stack"><span class="label">People · 7</span><ul class="list">
${person('RK', 'Rhea Kapoor', 'Engineering Manager, CI/CD', 'Leads the team · 8 goals')}
${person('AS', 'Aiko Suzuki', 'Senior Software Engineer', '2 goals')}
${person('DR', 'Diego Ramírez', 'Staff Engineer', '3 goals')}
${person('FA', 'Femi Adebayo', 'Software Engineer', '1 goal')}
</ul><span class="btn quiet" style="align-self:flex-start">Show all 7</span></div>
<div class="stack" style="gap:12px"><span class="label">For admins</span><div class="row"><span class="btn">Change its name, lead or purpose</span><span class="btn quiet">Remove this team…</span></div></div>
</div>
<p class="note">Wireframe 4. A team’s page. Its one action leads to its goals; the counts are the same ones Goals shows “By team”.</p>` }),

  '05-workspace-about-admin': shell({ title: 'Workspace', cur: 'Workspace', wide: true, body: `
<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>
<div class="layout">${wsMenu('About')}<div class="body">
<div class="stack"><span class="label">To sort out · 2</span><ul class="list">
<li><span class="t"><b>3 people have no email</b><span>An email is how two people with one name are told apart.</span></span><span class="btn">Add them</span></li>
<li><span class="t"><b>You’re the only admin</b><span>Make a second, so the workspace isn’t stuck when you’re away.</span></span><span class="btn">Choose someone</span></li>
</ul></div>
<div class="stack"><div class="row" style="justify-content:space-between"><h2>About this workspace</h2><span class="btn">Rename</span></div>
<dl class="facts">
<dt>Name</dt><dd>Platform Engineering <span class="hint">· example data</span></dd>
<dt>People</dt><dd><a>97 people in 14 teams</a></dd>
<dt>Year</dt><dd>2026, week 46 of 53. The wrap-up opens on 14 December. <a>Cycles</a></dd>
<dt>Admins</dt><dd>Amara Nwosu, Grace Achterberg and Hamid Rezaei. <a>Access</a></dd>
<dt>Features</dt><dd>Metric library and Spreadsheets are on. <a>Features</a></dd>
<dt>Recording</dt><dd>Faro records how the app is used here, never what anyone types. <a>Privacy</a></dd>
</dl></div>
${wsMore([['Cycles', '2026, week 46 of 53'], ['Access', '3 admins'], ['Features', '2 of 2 on'], ['Privacy', 'Recording is on'], ['Recently removed', 'Nothing in the last 30 days']])}
<div class="stack" style="gap:12px;border-top:1px solid var(--line);padding-top:20px"><span class="label">Delete</span><p class="hint">Deleting removes its people, goals, check-ins, reviews and history, for everyone. It can’t be undone.</p><span class="btn danger" style="align-self:flex-start">Delete this workspace…</span></div>
</div></div>
<p class="note">Wireframe 5. Workspace, as an admin: what needs an admin first, then the facts. The landing page is the About page; there is no separate Overview and no second list of sections. Leave has moved to Settings; setting up another workspace lives in the switcher only.</p>` }),

  '06-workspace-about-member': shell({ title: 'Workspace', cur: 'Workspace', wide: true, who: ['RK', 'Rhea Kapoor', 'CI/CD'], body: `
<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re a member here</p></div></div>
<div class="layout">${wsMenu('About', false)}<div class="body">
<div class="stack"><h2>About this workspace</h2>
<dl class="facts">
<dt>Name</dt><dd>Platform Engineering <span class="hint">· example data</span></dd>
<dt>People</dt><dd><a>97 people in 14 teams</a></dd>
<dt>Year</dt><dd>2026, week 46 of 53. The wrap-up opens on 14 December. <a>Cycles</a></dd>
<dt>Admins</dt><dd>Amara Nwosu, Grace Achterberg and Hamid Rezaei. Ask one of them to add someone, change a team or change a setting.</dd>
<dt>Features</dt><dd>Metric library and Spreadsheets are on.</dd>
<dt>Recording</dt><dd>Faro records how the app is used here, never what anyone types. <a>Privacy</a></dd>
</dl></div>
${wsMore([['Cycles', '2026, week 46 of 53'], ['Privacy', 'Recording is on'], ['Recently removed', 'Nothing of yours in the last 30 days']])}
</div></div>
<p class="note">Wireframe 6. Workspace, as a member (Rhea or Oskar): the same facts, no actions, and who to ask. Nothing for admins is listed and then refused.</p>` }),

  '07-access': shell({ title: 'Access', cur: 'Workspace', wide: true, body: `
<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>
<div class="layout">${wsMenu('Access')}<div class="body">
<div class="stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>Admins · 3</h2><p class="hint">Admins add people, change teams and settings, and make MCP tokens. There is always at least one.</p></div><span class="btn primary">Add an admin</span></div>
<ul class="list">
<li><span class="av sm">AN</span><span class="t"><b>Amara Nwosu</b><span>VP Platform Engineering · you</span></span><span class="btn quiet">Stop being an admin</span></li>
<li><span class="av sm">GA</span><span class="t"><b>Grace Achterberg</b><span>Engineering Operations Manager</span></span><span class="btn quiet">Remove as admin</span></li>
<li><span class="av sm">HR</span><span class="t"><b>Hamid Rezaei</b><span>Engineering Operations Administrator</span></span><span class="btn quiet">Remove as admin</span></li>
</ul></div>
<div class="stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>MCP tokens · 2</h2><p class="hint">A token lets Claude or another AI tool act as one person here, with that person’s rights. Every change it makes is logged as theirs, marked “via MCP”.</p></div><span class="btn">Make a token</span></div>
<ul class="list">
<li><span class="t"><b>Claude on Rhea’s laptop</b><span>Acts as Rhea Kapoor · made 3 weeks ago · last used yesterday</span></span><span class="btn quiet">Revoke</span></li>
<li><span class="t"><b>Weekly brief</b><span>Acts as Amara Nwosu · made 2 days ago · not used yet</span></span><span class="btn quiet">Revoke</span></li>
</ul></div>
</div></div>
<p class="note">Wireframe 7. Access, admins only. Admins are added and removed here, where they are listed; today the list is read-only and the change is a tick box inside a person’s edit form.</p>` }),

  '08-cycles': shell({ title: 'Cycles', cur: 'Workspace', wide: true, body: `
<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>
<div class="layout">${wsMenu('Cycles')}<div class="body">
<div class="stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>Cycles</h2><p class="hint">A cycle is a goal year: its goals, plans and check-ins.</p></div></div>
<ul class="list">
<li style="align-items:flex-start"><span class="t"><b>2026 · running</b><span>Week 46 of 53 · 22 Dec 2025 to 27 Dec 2026</span><br><span>126 goals · 5,347 check-ins</span><br><span>The wrap-up opens in week 52, on 14 December. The next cycle starts from it.</span></span><span class="btn">See the wrap-up</span></li>
<li style="align-items:flex-start"><span class="t"><b>2025 · over</b><span>23 Dec 2024 to 21 Dec 2025</span><br><span>118 goals · 4,902 check-ins</span></span><span class="btn quiet">See its goals</span></li>
</ul></div>
</div></div>
<p class="note">Wireframe 8. Cycles: where the year stands and what happens next. “Delete” appears only on a cycle nobody has checked in to, with its reason; the page no longer opens with the deletion rule.</p>` }),

  '09-features-privacy': shell({ title: 'Features', cur: 'Workspace', wide: true, body: `
<div class="head"><div class="stack"><h1>Workspace</h1><p class="hint">Platform Engineering · you’re an admin here</p></div></div>
<div class="layout">${wsMenu('Features')}<div class="body">
<div class="stack"><div class="stack" style="gap:2px"><h2>Features</h2><p class="hint">The optional parts of Faro, for everyone here. Switching one off hides it and keeps what it saved.</p></div>
<ul class="list">
<li style="align-items:flex-start"><span class="t"><b>Metric library</b><span>Define each number goals are measured by once, and say which metric measures a goal.</span></span>${sw(true)}</li>
<li style="align-items:flex-start"><span class="t"><b>Spreadsheets</b><span>Download the goals as Excel or CSV, and load changes back from a spreadsheet.</span></span>${sw(true)}</li>
</ul></div>
<div class="stack" style="border-top:1px solid var(--line);padding-top:24px"><div class="stack" style="gap:2px"><h2>Privacy <span class="hint" style="font-weight:400">(its own page; drawn here to save a picture)</span></h2><p class="hint">What Faro records about how the app is used in Platform Engineering.</p></div>
<ul class="list"><li style="align-items:flex-start"><span class="t"><b>Record how the app is used here</b><span>Pages opened, buttons pressed, errors and slow pages. Never anything anyone types. Kept 90 days, then daily totals. Only the people who build Faro can read it.</span></span>${sw(true)}</li></ul>
<p class="hint"><a>What’s recorded, exactly</a></p></div>
</div></div>
<p class="note">Wireframe 9. Features, and the Privacy page’s one block. Each switch says On or Off in words; a member sees the same Privacy text with “Recording is on. Admins change it.” in place of the switch.</p>` }),

  '10-settings': shell({ title: 'Settings', cur: 'Settings', who: ['RK', 'Rhea Kapoor', 'CI/CD'], body: `
<div class="head"><div class="stack"><h1>Settings</h1><p class="hint">Your own choices. Nobody else sees them.</p></div></div>
<div class="stack" style="gap:28px">
<div class="stack"><h2>You</h2><ul class="list">
<li><span class="av sm">RK</span><span class="t"><b>Rhea Kapoor</b><span>Engineering Manager, CI/CD · CI/CD · member of Platform Engineering</span></span><span class="btn">Your page</span></li></ul>
<p class="hint">An admin changes your name, job title or team: Amara Nwosu, Grace Achterberg or Hamid Rezaei.</p></div>
<div class="stack"><h2>Appearance</h2><p class="hint">Light or dark, accent colour and the sidebar. Kept in this browser.</p><div class="row"><span class="btn">System</span><span class="btn">Light</span><span class="btn">Dark</span></div></div>
<div class="stack"><h2>Your MCP tokens · 1</h2><ul class="list"><li><span class="t"><b>Claude on Rhea’s laptop</b><span>Made 3 weeks ago · last used yesterday</span></span><span class="btn quiet">Revoke</span></li></ul><p class="hint">An admin makes a token for you.</p></div>
<div class="stack" style="gap:12px;border-top:1px solid var(--line);padding-top:20px"><h2>Leave Platform Engineering</h2><p class="hint">Someone takes over your goals and open asks, and your history stays. An admin can bring you back for 30 days.</p><span class="btn" style="align-self:flex-start">Leave this workspace…</span></div>
</div>
<p class="note">Wireframe 10. Settings is about you: who you are here, how the app looks, your own tokens, and leaving. The long “What the app records” block has gone to Workspace, Privacy; making tokens has gone to Workspace, Access.</p>` }),

  '11-switcher': `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Switcher</title><style>${CSS}main{padding:16px}</style><main>
<div class="sheet"><div class="row" style="justify-content:space-between"><h2>Workspaces</h2><span class="chev">✕</span></div>
<span class="input">Find a workspace</span>
<ul class="list">
<li><span class="t"><b>Platform Engineering</b><span>Example data · you’re an admin</span></span><span class="hint">Open now</span></li>
<li><span class="t"><b>Field Operations</b><span>You’re a member</span></span><span class="chev">›</span></li>
</ul>
<div class="stack" style="gap:4px"><span class="btn quiet" style="justify-content:flex-start">About Platform Engineering</span><span class="btn quiet" style="justify-content:flex-start">Set up a new workspace</span></div>
</div>
<p class="note" style="max-width:440px;margin:0 auto">Wireframe 11. The switcher does two things: switch, and start a new one. Your role is on each row instead of in a sentence above; “Find a workspace” appears from six workspaces up.</p></main></html>`,
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, html] of Object.entries(SCREENS)) {
    const file = path.join(here, name + '.html');
    fs.writeFileSync(file, html);
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w > 700 ? 1 : 2 });
      await page.goto('file://' + file);
      await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
      await page.close();
    }
  }
  await browser.close();
  console.log('Rendered', Object.keys(SCREENS).length, 'screens at 1440 and 390 into', path.relative(process.cwd(), out));
})();
