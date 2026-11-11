/* Wireframes for workspace set-up, round 2 (docs/design/setup/README.md, spec.md section 2).
   Usage: node docs/design/setup/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note } = kit;

const CSS = `<style>
.frame{max-width:620px;margin:0 auto;padding:8px 0 24px}
.frame.wide{max-width:760px}
.fhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.fhead .steps{margin:0;flex-direction:column;gap:2px}.fhead .steps b{color:var(--fg);font-size:15px}
.ffoot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:28px}
.fstack{display:flex;flex-direction:column;gap:20px}
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:10px}
.boxed{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px}
.rrow{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rrow.sel{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.rrow .hint{display:block}.rrow b{font-weight:600}.rrow>span:last-child{flex:1;min-width:0}
.rd{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:999px;flex:none;position:relative;margin-top:1px}.rd.y:after{content:"";position:absolute;inset:3px;border-radius:999px;background:var(--fg)}
.pl{display:flex;flex-direction:column;gap:6px}
.inl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.sel2{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600}
.sel2:after{content:"";width:7px;height:7px;border-right:1.6px solid var(--muted);border-bottom:1.6px solid var(--muted);transform:rotate(45deg);margin-top:-4px;flex:none}
.q{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:10px}
.sect{display:flex;flex-direction:column;gap:8px;padding:18px 0;border-top:1px solid var(--line)}
.sect:first-child{border-top:0;padding-top:0}
.sect>.top2{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.door{display:flex;gap:14px;align-items:center;min-height:64px;padding:12px 4px;border-top:1px solid var(--line-2)}
.door:first-child{border-top:0}.door .t{flex:1;min-width:0}.door .t b{display:block;font-weight:600}.door .t span{color:var(--muted);font-size:14px;line-height:20px;display:block}
.doors{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.ppl{border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.pr{display:grid;grid-template-columns:1.1fr 1.4fr 1fr 64px;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line-2)}
.pr:first-child{border-top:0}.pr.h{font-size:12px;font-weight:600;color:var(--muted);padding-top:8px;padding-bottom:8px}
.pr .input{min-width:0;min-height:40px}
.pr .msg{grid-column:1/-1;display:flex;gap:10px 16px;align-items:center;flex-wrap:wrap;font-size:14px}
.pr.mf{background:var(--off-wash)}.pr.mf .msg{color:var(--off)}
.pr .msg .warn{font-weight:600}.pr.ck .msg .warn{color:var(--muted)}
.mfw{display:inline-flex;gap:6px;align-items:center;color:var(--off);font-weight:600}
.ckw{display:inline-flex;gap:6px;align-items:center;color:var(--muted);font-weight:600}
.tk{width:20px;height:20px;border:1.6px solid var(--fg);border-radius:4px;display:inline-block;position:relative;background:var(--surface)}.tk.y{background:var(--fg)}.tk.y:after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(40deg)}
.crow{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line-2)}.crow:first-child{border-top:0}
.crow .t{flex:1;min-width:0}.crow .t>b{display:block;font-weight:600}.crow .t>span{color:var(--muted);font-size:14px;display:block}.crow .t>span.inl{display:flex;gap:6px 18px}.crow .mfw,.crow .ckw{margin-right:6px}
.hrow{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--line-2)}
.hrow:first-of-type{border-top:0}.hrow p{flex:1 1 280px}
.msgbox{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px 16px;white-space:pre-line}
.brandbig{font-weight:800;font-size:34px;letter-spacing:-.02em;margin-bottom:22px}
.lead{font-size:17px;line-height:26px;color:var(--fg-2)}
.ta{border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:12px;min-height:150px;white-space:pre-line;color:var(--fg)}
.gl{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line-2)}.gl:first-child{border-top:0}
.gl .t{flex:1;min-width:0}.gl .t b{display:block;font-weight:600}.gl .t span{color:var(--muted);font-size:14px;display:block}.gl .a{display:flex;gap:14px;flex:none}
.only-phone{display:none}
@media (max-width:700px){
 .top,.tabbar{display:none}
 .app .top,.withbar .tabbar{display:flex}
 .fhead .btn{width:100%}.ffoot .btn{flex:1}.hrow .btn{width:100%}
 .boxed{padding:14px}
 .pr{grid-template-columns:1fr 64px;gap:6px 10px}.pr.h{display:none}
 .pr>.c1{grid-column:1}.pr>.c2{grid-column:1}.pr>.c3{grid-column:1}.pr>.c4{grid-column:2;grid-row:1;justify-self:end}
 .gl{flex-wrap:wrap}.gl .a{flex-basis:100%}
 .only-phone{display:block}.not-phone{display:none}
 .sect>.top2{flex-wrap:wrap}
}
</style>`;

const SCREENS = {};
const rad = (t, on, hint, extra = '') => `<div class="rrow ${on ? 'sel' : ''}"><span class="rd ${on ? 'y' : ''}"></span><span><b>${t}</b>${hint ? `<span class="hint">${hint}</span>` : ''}${extra}</span></div>`;
const fl = (t, inner, o = '') => `<div class="field"><b>${t}${o ? ` <span class="hint" style="font-weight:400">· ${o}</span>` : ''}</b>${inner}</div>`;
const head = (n, name) => `<div class="fhead"><div class="steps"><b>Set up a workspace</b><span>Step ${n} of 5 · ${name}</span></div><span class="btn sm">Close and keep the draft</span></div>`;
const foot = (next = 'Continue', back = true) => `<div class="ffoot">${back ? '<span class="btn">Back</span>' : '<span></span>'}<span class="btn primary">${next}</span></div>`;
const sel = (t) => `<span class="sel2">${t}</span>`;
const mf = (t) => `<span class="mfw">${warn('').replace('class="warn"', 'style="display:inline-flex;color:var(--off)"')}Must fix</span> <span>${t}</span>`;
const ck = (t) => `<span class="ckw">${warn('').replace('class="warn"', 'style="display:inline-flex;color:var(--muted)"')}Check</span> <span style="color:var(--fg)">${t}</span>`;
const bare = (title, body) => shell({ bare: true, title, body: CSS + body });

/** The app's frame, as a workspace made at set-up shows it: its own name, its own people, and no item that is switched off. */
function app({ title, cur, who, body, off = [], counts = {}, width = 'narrow', owner = true }) {
  let h = shell({ title, cur, who: owner ? 'rhea' : 'oskar', body: CSS + body, width, counts });
  h = h.replace(/Platform Engineering · week 46/g, 'Field Operations · week 46').replace(/<b>Platform Engineering<\/b><span>Example data · week 46 · Q4<\/span>/, '<b>Field Operations</b><span>Week 46 · Q4</span>');
  const [ini, name, team] = who;
  h = h.replace(/>(RK|OL)</g, `>${ini}<`).replace(/<b>(Rhea Kapoor|Oskar Lindgren)<\/b><div class="hint" style="font-size:12px">[^<]*<\/div>/, `<b>${name}</b><div class="hint" style="font-size:12px">${team}</div>`);
  for (const n of off) h = h.replace(new RegExp(`<div class="nav[^"]*"><i></i>${n}(<span class="n">\\d+</span>)?</div>`), '').replace(new RegExp(`<span class="[^"]*">${n}</span>`), '');
  return h.replace('<div class="tabbar">', '<div class="tabbar" style="display:var(--tb,none)">').replace('</style>', '@media (max-width:700px){:root{--tb:flex}.top{display:flex!important}}</style>');
}

/* 1. Welcome */
const doors = (rows) => `<div class="doors">${rows.map(([t, s, a]) => `<div class="door"><span class="t"><b>${t}</b><span>${s}</span></span>${a || '<span class="chev">›</span>'}</div>`).join('')}</div>`;
SCREENS['01-welcome'] = bare('Welcome', `
<div class="state"><span class="label">(a) Someone with nothing on this device · /welcome</span>
<div class="frame boxed" style="padding:32px 28px">
<div class="brandbig">Faro</div>
<h1 style="margin-bottom:14px">Run the company on outcomes, and manage by exception</h1>
<p class="lead">Faro keeps each outcome and the goals that move it in one place, each with an owner, a measure and a plan.</p>
<p class="lead" style="margin-bottom:24px">Owners keep them current. What’s slipping comes to you, with why and what’s being done about it.</p>
<div class="stack" style="gap:8px;margin-bottom:28px"><div><span class="btn primary" style="min-height:48px;padding:0 20px">Set up a workspace</span></div><span class="hint">About 5 minutes. Nothing is saved until the last step.</span></div>
${doors([['Open the example', 'A division of about 100 people with a year of goals. It’s kept in this browser, so change anything.'], ['Join a workspace you were invited to', 'Open the link you were sent, or paste it here.']])}
<p class="hint" style="margin-top:22px">Faro is a prototype: a working model of a goals app, built to be copied and rebuilt inside a company. It isn’t a product, and nothing here is for sale.</p>
</div></div>
<div class="state"><span class="label">(b) Someone who has been here before, with a set-up they didn’t finish</span>
<div class="frame boxed" style="padding:32px 28px">
<div class="brandbig">Faro</div>
<h1 style="margin-bottom:18px">Welcome back</h1>
<span class="label">On this device</span>
<div class="doors" style="margin:8px 0 22px">
<div class="door"><span class="t"><b>Field Operations</b><span>You’re Ana Silva here · week 46</span></span><span class="btn primary">Open</span></div>
<div class="door"><span class="t"><b>“Depot North”, a set-up you didn’t finish</b><span>Stopped at step 3 of 5, People, on 9 Nov. Nothing is saved yet.</span></span><span class="row nowrap" style="gap:14px"><a>Discard</a><span class="btn">Carry on</span></span></div>
</div>
${doors([['Set up another workspace', 'About 5 minutes.'], ['Open the example', 'About 100 people and a year of goals, kept in this browser.'], ['Join a workspace you were invited to', 'Open the link you were sent, or paste it here.']])}
</div></div>
${note('Wireframe 1. Welcome, at its own address. One primary action for someone with nothing: set up a workspace; the example and an invitation are the two doors under it. Today the root shows this page only while the shared database holds no workspace at all, the primary button is “Try the demo”, and there is no door for an invited person (W1, W2). A returning person sees what this device remembers first, a draft included.')}`);

/* 2. How you'll work */
SCREENS['02-how-you-work'] = bare('Set up: how you’ll work', `
<div class="frame">${head(2, 'How you’ll work')}
<h1 style="margin-bottom:8px">How will you work?</h1>
<p class="hint" style="margin-bottom:22px">These suit most teams, so you can just continue. An admin can change each one later in Workspace.</p>
<div>
<div class="sect"><div class="top2"><h2>The goal year</h2><a>Change</a></div>
<p>January to December. This is week 46 of 53.</p>
<div class="q" role="status"><p>${ck('2026 has 7 weeks left: it ends on Sunday 3 January.')}</p><div class="pl">${rad('Start now, in 2026', true, 'Goals set up today run to 3 January unless you give them another date.')}${rad('Start with 2027', false, 'Set goals up now. Nothing is due until the week of 4 January.')}</div></div></div>
<div class="sect"><h2>Check-ins</h2>
<div class="pl">${rad('Every week', true, 'Each owner posts a number or a line once a week. Faro says what’s due, and what’s late.', `<span class="inl"><span>Due by</span>${sel('Thursday')}<span class="hint" style="display:inline">The first are due Thursday 19 Nov.</span></span>`)}${rad('No set rhythm', false, 'Owners update a goal when something changes. Nothing is due or late; each goal says when it was last updated.')}</div></div>
<div class="sect"><h2>Reviews</h2>
<div class="pl">${rad('Hold a review', true, 'A meeting that walks the goals needing attention, worst first.', `<span class="inl">${sel('Every week')}<span>on</span>${sel('Thursday')}</span><span class="hint">The first is Thursday 19 Nov, for everyone.</span>`)}${rad('No reviews', false, 'Reviews stays out of the menu. Switch it on later in Workspace, Features.')}</div></div>
<div class="sect"><div class="top2"><h2>Recording</h2><a>Change</a></div><p>Off. Faro records nothing about how the app is used here.</p></div>
</div>${foot()}</div>
${note('Wireframe 2. “How you’ll work”, one step with nothing required. Each choice says what it means in one sentence and shows its first date. Today the year and “Weekly review on” hide behind one “Change” link on the name step, the day can never be changed afterwards, and a workspace set up on a Wednesday has its first check-ins due the next day (W5, W6, W7). The question about the year shows only when eight weeks or fewer are left.')}`);

/* 3. People */
const pr = (cls, n, e, t, adm, msg = '') => `<div class="pr ${cls}"><span class="input filled c1 ${cls === 'mf' ? '' : ''}">${n}</span><span class="input filled c2 ${cls === 'mf' ? 'bad' : ''}">${e}</span><span class="input filled c3">${t}</span><span class="c4"><span class="tk ${adm ? 'y' : ''}"></span></span>${msg ? `<div class="msg">${msg}</div>` : ''}</div>`;
SCREENS['03-people'] = bare('Set up: people', `
<div class="state"><span class="label">(a) Six people pasted, one to fix and two to check</span>
<div class="frame wide">${head(3, 'People')}
<h1 style="margin-bottom:8px">Who’s on it?</h1>
<p class="hint" style="margin-bottom:16px">Type them, paste rows from a spreadsheet or the To line of an email, or upload a file. You can add people later from People.</p>
<p class="countline" role="status"><b>6 people</b> in <b>3 teams</b>: Field Ops 3, Dispatch 2, Depot 1. <b>1 must be fixed</b>, <b>2 to check</b>. <a>Show only those</a></p>
<div class="ppl">
<div class="pr h"><span>Name</span><span>Email</span><span>Team</span><span>Admin</span></div>
${pr('', 'Ana Silva · you', 'ana@example.com', 'Field Ops', true)}
${pr('', 'Ben Carter', 'ben@example.com', 'Field Ops', false)}
${pr('', 'Cara Diaz', 'cara@example.com', 'Dispatch', false)}
${pr('mf', 'Dev Osei', 'ben@example.com', 'Dispatch', false, mf('Ben Carter already has ben@example.com. Each person needs their own email.'))}
${pr('ck', 'Ben Carter', 'b.carter@example.com', 'Depot', false, `${ck('There’s already a Ben Carter, in Field Ops.')}<a>Yes, two people</a><a>Remove this row</a>`)}
${pr('ck', 'Elif Kaya', 'elif@example.com', 'Feild Ops', false, `${ck('“Feild Ops” is one letter from Field Ops.')}<a>Use Field Ops</a><a>It’s a new team</a>`)}
</div>
<div class="row" style="margin-top:14px"><span class="btn">Add a person</span><span class="btn">Paste people</span><span class="btn">Upload a file</span></div>
<p class="hint" style="margin-top:14px">Admins add people and change settings. You’re one; tick anyone else who should be. Nobody is made a team lead here: choose leads later, on Teams.</p>
<p class="hint">People in a spreadsheet with your goals? Leave this as it is: importing it on the next step adds them.</p>
${foot()}</div></div>
<div class="state"><span class="label">(b) “Paste people”, the way in on a phone</span>
<div class="sheet" style="margin:0 auto"><h2>Paste people</h2><p class="hint">One person on each line: name, email, then team. Commas or tabs both work, and so does a list of addresses copied from an email.</p>
<div class="ta">Ben Carter, ben@example.com, Field Ops
Cara Diaz &lt;cara@example.com&gt;
Dev Osei	dev@example.com	Dispatch</div>
<p class="hint" role="status">3 people read. 1 has no team: they’ll join yours, Field Ops.</p>
<div class="row between"><span class="btn">Cancel</span><span class="btn primary">Add 3 people</span></div></div></div>
${note('Wireframe 3. People, with round 2’s three levels. A count line says how many people and teams this makes and how many rows need attention, so sixty pasted people are not sixteen phone screens to scroll (W10). A second person with someone’s email is Must fix, with a wash on the whole row; a second Ben Carter and a team one letter from another are Checks with their two answers. Today the first is said and the other two differ in kind for no reason: the shared name is a note nobody answers, the near-miss team blocks (W11).')}`);

/* 4. Goals: the four doors, and the list they come back to */
SCREENS['04-goals-doors'] = bare('Set up: goals', `
<div class="state"><span class="label">(a) No goals yet: four ways to start</span>
<div class="frame">${head(4, 'Goals')}
<h1 style="margin-bottom:8px">What are you working towards?</h1>
<p class="hint" style="margin-bottom:18px">Pick how to start. You can mix them: begin from an example, then add your own.</p>
<div class="pl">
${rad('Start from an example', true, 'An outcome and three goals that usually feed it, with example numbers to change.', `<span class="inl">${sel('Engineering platform')}</span>`)}
${rad('Add your own', false, 'One goal at a time, with the same form as New goal. About two minutes each.')}
${rad('Import a spreadsheet', false, 'Goals, and the people who own them, from Faro’s template or a workbook exported from another workspace. You see every row before it’s kept.', `<span class="inl"><a>Download the template</a></span>`)}
${rad('Later', false, 'Finish with no goals. Each owner adds theirs from New goal, and nothing is due until they do.')}
</div>${foot()}</div></div>
<div class="state"><span class="label">(b) Back from a door: the goals so far</span>
<div class="frame">${head(4, 'Goals')}
<h1 style="margin-bottom:8px">4 goals so far</h1>
<p class="hint" style="margin-bottom:6px">Example numbers. Change them to yours, or leave them and correct them at the first check-in.</p>
<p class="hint" style="margin-bottom:14px" role="status">2 have no owner yet. Give a teammate one, so they have something to check in on.</p>
<div class="panel" style="gap:0;padding:4px 16px">
<div class="gl"><span class="t"><b>Lead time from commit to production</b><span>North star · 5 → 2 days · Ana Silva</span></span><span class="a"><a>Change</a><a>Remove</a></span></div>
<div class="gl"><span class="t"><b>Deploys per week</b><span>Feeds the north star · 12 → 30 deploys · Ben Carter</span></span><span class="a"><a>Change</a><a>Remove</a></span></div>
<div class="gl"><span class="t"><b>Change failure rate</b><span>Feeds the north star · 18 → 10% · <a>Choose an owner</a></span></span><span class="a"><a>Change</a><a>Remove</a></span></div>
<div class="gl"><span class="t"><b>Self-service environments live</b><span>Feeds the north star · 3 stages, the last due week 53 · <a>Choose an owner</a></span></span><span class="a"><a>Change</a><a>Remove</a></span></div>
</div>
<div class="row" style="margin-top:14px"><span class="btn">Add another</span><a>Import a spreadsheet</a></div>
<p class="hint" style="margin-top:12px">Three to five is plenty for a first week. Anyone can add more from New goal afterwards.</p>
${foot()}</div></div>
${note('Wireframe 4. The Goals step. Four doors in one group, with Continue as the one primary action; whichever is used, set-up comes back to one list of the goals so far, where each can be changed in the goal-entry form or removed, and “Add another” is always there. Today the choice is a step of its own, the spreadsheet door appears on it only after a file was uploaded two steps earlier on the people step, and an example’s four goals are two steps of 21 fields, 2,165 px tall on a phone (W8, W12).')}`);

/* 5. The import, as set-up frames it */
SCREENS['05-import-in-setup'] = bare('Set up: import', `
<div class="frame wide">${head(4, 'Goals · import')}
<h1 style="margin-bottom:8px">goals-2026.xlsx</h1>
<p class="countline" role="status">Would add <b>14 goals</b> and <b>9 people</b> in <b>2 new teams</b>. <b>1 must be fixed</b>, <b>2 to check</b>. Nothing is saved until the last step of set-up.</p>
<div class="panel" style="gap:0;padding:4px 16px">
<div class="crow offwash" style="margin:0 -16px;padding:12px 16px"><span class="t"><b>${mf('Goals sheet, row 4: “Deploys rolled back”')}</b><span style="color:var(--fg)">Owner email says “zed.nobody@example.com”. Nobody here or on the People sheet has it.</span><span class="inl" style="margin-top:6px"><a>Give it to someone here</a><a>Add Zed Nobody as a person</a></span></span></div>
<div class="crow"><span class="t"><b>${ck('“Platfrom” isn’t a team yet')}</b><span style="color:var(--fg)">It’s one letter from Platform. 3 goals use it: rows 3, 4 and 9.</span><span class="inl" style="margin-top:6px"><a>Use Platform for all 3</a><a>Add Platfrom as a team</a></span></span></div>
<div class="crow"><span class="t"><b>${ck('2 goals have stages dated before this week')}</b><span style="color:var(--fg)">“Canary releases live” and “Runbooks rewritten” would start out late: Design was due in week 2, and this is week 46.</span><span class="inl" style="margin-top:6px"><a>Count their stages from this week</a><a>Keep the weeks as typed</a></span></span></div>
</div>
<div class="sect" style="border-top:0;padding-bottom:0"><h2>What set-up adds to an import</h2>
<p class="hint">Every row is new, so there is nothing to change or stop. The 9 people on the People sheet join the 3 you typed; 1 was already there and isn’t added twice. The rest of this screen is the import’s own preview (docs/design/import).</p></div>
<div class="ffoot"><span class="btn">Choose another file</span><span class="btn primary">Use these 14 goals</span></div></div>
${note('Wireframe 5. The import inside set-up. The preview belongs to the import area; this shows only what set-up adds: it is the first import, the file may bring the people, and the answers are given here. Today the same three mistakes are found only after “Create workspace” is pressed, one at a time, with no row number and no fix on the screen, while Check has already listed “2 goals” from a file of three (W3).')}`);

/* 6. Check: the read-back */
const cr = (t, s, c = 'Change') => `<div class="crow"><span class="t"><b>${t}</b>${s.map((x) => `<span>${x}</span>`).join('')}</span>${c ? `<a>${c}</a>` : ''}</div>`;
SCREENS['06-check'] = bare('Set up: check', `
<div class="frame">${head(5, 'Check')}
<h1 style="margin-bottom:8px">Create Field Operations?</h1>
<p class="hint" style="margin-bottom:16px">Nothing is saved yet. This is what pressing the button makes.</p>
<span class="label">What will exist</span>
<div class="panel" style="gap:0;padding:4px 16px;margin:8px 0 20px">
${cr('3 people in 2 teams', ['Ana Silva (you), Ben Carter and Cara Diaz. Field Ops 2, Dispatch 1.', 'You’re the only admin. No team has a lead.'])}
${cr('4 goals', ['1 north star and 3 that feed it, from the Engineering platform example.', 'You own 1 and Ben Carter 1. 2 have no owner yet: they start as yours, and Home will ask you to choose.'])}
${cr('Check-ins every week, by Thursday', ['The first are due Thursday 19 Nov.'])}
${cr('A weekly review on Thursdays', ['For everyone, every goal. The first is Thursday 19 Nov.'])}
${cr('The goal year 2026', ['January to December. You join it in week 46 of 53; it ends on 3 January.'])}
${cr('Recording off', ['Nothing about how the app is used here is recorded.'])}
</div>
<span class="label">What nobody has been told</span>
<div class="panel" style="margin:8px 0 0"><p>Faro sends no email. Ben Carter and Cara Diaz won’t know about this until you send them the link, which is the next screen.</p></div>
<div class="ffoot"><span class="btn">Back</span><span class="btn primary">Create workspace</span></div></div>
${note('Wireframe 6. The read-back: what will exist, in counts and sentences, then what nobody has been told. Every “Change” opens its step and comes straight back here. Today “Change name or year” goes to step 1 and the way back is “Next” six times, a spreadsheet’s rejected rows are simply missing from the count, and the last word on people is that they are in the list (W3, W9).')}`);

/* 7. The hand-off */
SCREENS['07-ready-invite'] = bare('Ready', `
<div class="state"><span class="label">(a) /ready, with teammates to tell</span>
<div class="frame">
<div class="stack" style="gap:6px;margin-bottom:20px"><h1>Field Operations is set up</h1><p class="hint">3 people, 4 goals. Week 46 of 2026.</p></div>
<h2 style="margin-bottom:6px">Now tell Ben and Cara</h2>
<p class="hint" style="margin-bottom:10px">Faro doesn’t send email. Copy this and send it yourself; change the words if you like.</p>
<div class="msgbox">I’ve set up Field Operations in Faro, where we’ll keep our goals.
Open it and pick your name: goals-app.example/join/ws_n0g3rv
Your first check-in is due by Thursday 19 Nov.</div>
<div class="row" style="margin-top:14px"><span class="btn primary">Copy the invitation</span><a>Copy only the link</a></div>
<div class="sect" style="margin-top:22px;padding-bottom:0"><p>Then <a>go to Home</a>, where your first week is laid out.</p>
<p class="hint">Made by mistake? <a>Undo: delete it and go back to the last step</a>. This stays possible until someone else opens it or a check-in is posted.</p></div>
</div></div>
<div class="state"><span class="label">(b) Set up alone, or as a copy kept in this browser</span>
<div class="frame">
<div class="stack" style="gap:6px;margin-bottom:20px"><h1>Solo Lab is set up</h1><p class="hint">1 person, no goals yet. Week 46 of 2026.</p></div>
<p style="margin-bottom:14px">Nothing is due until there are goals.</p>
<div><span class="btn primary">Go to Home</span></div>
<p class="hint" style="margin-top:14px">This copy is kept in this browser only, so there’s no link to send: nobody else can open it.</p>
</div></div>
${note('Wireframe 7. The hand-off. With teammates, the one primary action is copying an invitation that says what this is, where to go and what is due; Home is the link after it. Today the primary button is “Check in on your 3 goals”, the invitation is a text link under a hint, the link is the bare address, and a copy kept in one browser still offers a link nobody else can open (W4, W14). Undo is here while nothing depends on the workspace.')}`);

/* 8. The invited person's arrival */
const who = (i, n, t) => `<li><span class="av sm">${i}</span><span class="t"><b>${n}</b><span>${t}</span></span><span class="chev">›</span></li>`;
SCREENS['08-arrival'] = bare('Welcome to Field Operations', `
<div class="state"><span class="label">(a) /join/ws_n0g3rv, opened from the invitation</span>
<div class="frame">
<div class="brandbig" style="font-size:22px;margin-bottom:16px">Faro</div>
<h1 style="margin-bottom:10px">Welcome to Field Operations</h1>
<p class="lead" style="margin-bottom:6px">Ana Silva set this up on 11 Nov to keep the team’s goals in one place: 3 people, 4 goals.</p>
<p class="hint" style="margin-bottom:22px">Each goal has an owner who keeps it current. You’ll see yours, and what’s due, as soon as you’re in.</p>
<h2 style="margin-bottom:8px">Which one are you?</h2>
<ul class="list"><li class="grp">Field Ops</li>${who('AS', 'Ana Silva', 'Set this up · admin')}${who('BC', 'Ben Carter', 'Owns 1 goal')}<li class="grp">Dispatch</li>${who('CD', 'Cara Diaz', 'No goals yet')}</ul>
<p class="hint" style="margin-top:14px">This device remembers your answer. Signing in with your company login replaces this step in the internal app.</p>
<p style="margin-top:10px">Not on the list? <a>Ask Ana Silva to add you</a>.</p>
</div></div>
<div class="state"><span class="label">(b) A link that opens nothing</span>
<div class="frame">
<div class="brandbig" style="font-size:22px;margin-bottom:16px">Faro</div>
<h1 style="margin-bottom:10px">This invitation doesn’t open a workspace</h1>
<p style="margin-bottom:18px">The workspace may have been deleted, or the link was cut short when it was copied. Ask whoever sent it for a new one.</p>
<div><span class="btn">Go to Welcome</span></div>
</div></div>
${note('Wireframe 8. What an invited person meets: whose workspace this is, what it is for, then their name. Choosing a name is the one action; a person who isn’t listed is told who to ask. Today the link opens a bare “Who are you?”, the line for someone not listed shows only when a search finds nothing (and there is no search under nine people), and a link to a workspace that has gone opens a different workspace without a word (W4, W13).')}`);

/* 9. Home on day one, the creator */
const fw = (rows, hide = true) => `<div class="panel" style="gap:0"><h2 style="margin-bottom:6px">Your first week</h2>${rows.map(([p, b, pri]) => `<div class="hrow"><p>${p}</p>${b ? `<span class="btn ${pri ? 'primary' : ''}">${b}</span>` : ''}</div>`).join('')}${hide ? '<div style="padding-top:10px"><a class="hint">Hide this</a></div>' : ''}</div>`;
const mine = (rows, t = 'Your goals') => `<h2 style="margin:26px 0 8px">${t}</h2><ul class="list">${rows.map(([k, a, b, v]) => `<li class="goal"><span class="s">${st(k)}</span><span class="t"><b>${a}</b><span>${b}</span></span><span class="v">${v}</span></li>`).join('')}</ul>`;
SCREENS['09-home-day-one-creator'] = app({ title: 'Home', cur: 'Home', who: ['AS', 'Ana Silva', 'Admin · Field Ops'], counts: { 'Check-in': 3 }, body: `
<div class="state"><span class="label">(a) Ana, who set it up, on Wednesday 11 Nov (day one)</span>
<h1 style="margin-bottom:4px">Good afternoon, Ana</h1><p class="hint" style="margin-bottom:18px">Field Operations · week 46</p>
${fw([['Post your first check-ins: 3 goals. They’re due by Thursday 19 Nov.', 'Start check-in', true], ['Give 2 goals an owner. They’re yours until you do.', 'Choose owners'], ['Ben and Cara haven’t opened Field Operations yet.', 'Copy the invitation'], ['The first review is on Thursday 19 Nov.', '']])}
${mine([['none', 'Lead time from commit to production', 'North star · starts at 5 days', ''], ['none', 'Change failure rate', 'No owner chosen yet · starts at 18%', ''], ['none', 'Self-service environments live', 'No owner chosen yet · 3 stages', '']])}
</div>
<div class="state"><span class="label">(b) The same block on Thursday 19 Nov, the first check-in and review day</span>
${fw([['Post your first check-in: 1 goal. It’s due today.', 'Start check-in', true], ['3 of 4 first check-ins are in. Waiting on you.', ''], ['The first review is today. It walks the goals that need attention.', 'Open the review']])}
</div>
${note('Wireframe 9. Home on day one for whoever set the workspace up, and the same block on the first check-in day. The block is headed “Your first week”; its first row is the page’s one primary action; dates are said in full, so “due by Thursday” is never read on a Friday; the invitation row follows who has actually arrived. Today the block’s buttons are all plain and “Start check-in” appears again below as the primary, an on-time streak of “0 weeks” shows on day one, a 45-word paragraph explains a count, and after 14 days “Give 2 goals an owner” disappears undone (W15, W16).')}` });

/* 10. Home on day one, a teammate */
SCREENS['10-home-day-one-teammate'] = app({ title: 'Home', cur: 'Home', who: ['BC', 'Ben Carter', 'Field Ops'], counts: { 'Check-in': 1 }, body: `
<div class="state"><span class="label">(a) Ben, who owns a goal, on his first visit (Thursday 12 Nov)</span>
<h1 style="margin-bottom:4px">Good afternoon, Ben</h1><p class="hint" style="margin-bottom:18px">Field Operations · week 46</p>
${fw([['Ana Silva set up Field Operations on 11 Nov and gave you 1 goal.', ''], ['Post your first check-in. It’s due by Thursday 19 Nov.', 'Start check-in', true], ['The first review is on Thursday 19 Nov, and you’re in it.', '']])}
${mine([['none', 'Deploys per week', 'Feeds Lead time from commit to production · starts at 12 deploys', '']], 'Your goal')}
</div>
<div class="state"><span class="label">(b) Cara, who owns none</span>
${fw([['Ana Silva set up Field Operations on 11 Nov.', ''], ['See what Field Operations is working towards.', 'See the goals', true], ['Watch the goals you care about, and they’ll show here.', 'Find goals to watch'], ['Set up a goal of your own, in about 3 minutes.', 'New goal'], ['The first review is on Thursday 19 Nov, and you’re in it.', '']])}
</div>
${note('Wireframe 10. A teammate’s first Home. It differs from round 1’s wireframe 5 in three things: the heading, the full date, and the first review said once as a sentence. Under the block the page shows the goal and nothing else until something has happened. Today a teammate who owns nothing is given “Open the review: 4 with nothing flagged to mark reviewed” as the main action, and “Reviews 1 to do” in the menu, before anyone has checked in (W17).')}` });

/* 11. Rhythm and reviews off */
SCREENS['11-home-no-rhythm'] = app({ title: 'Home', cur: 'Home', who: ['BC', 'Ben Carter', 'Field Ops'], off: ['Reviews'], counts: {}, body: `
<div class="state"><span class="label">(a) Ben’s first visit, in a workspace with no rhythm and no reviews</span>
<h1 style="margin-bottom:4px">Good afternoon, Ben</h1><p class="hint" style="margin-bottom:18px">Field Operations · week 46</p>
${fw([['Ana Silva set up Field Operations on 11 Nov and gave you 1 goal.', ''], ['Post a first check-in on it, so everyone can see where it starts. There’s no date to meet.', 'Check in', true]])}
${mine([['none', 'Deploys per week', 'Feeds Lead time from commit to production · starts at 12 deploys', '']], 'Your goal')}
</div>
<div class="state"><span class="label">(b) Ana, who set it up with goals “later”</span>
${fw([['Ben and Cara haven’t opened Field Operations yet.', 'Copy the invitation', true], ['Set up the first goal.', 'New goal']])}
<p class="hint" style="margin-top:18px">No goals yet. They’ll show here once you own or watch one.</p>
</div>
${note('Wireframe 11. With the rhythm off and reviews off, nothing says “due”, “late” or “review”, Check-in carries no count, and the menu has no Reviews: off means absent. An empty workspace gives its creator two things to do and one line about why Home is empty, in place of today’s “Set up the first goal” twice and a “Next review: Thursday, tomorrow” for a workspace with nothing to review (W18).')}` });

/* 12. About, straight after set-up */
SCREENS['12-about-after-setup'] = app({ title: 'Workspace', cur: 'Workspace', who: ['AS', 'Ana Silva', 'Admin · Field Ops'], counts: { 'Check-in': 3 }, width: '', body: `
<h1 style="margin-bottom:4px">Workspace</h1><p class="hint" style="margin-bottom:18px">Field Operations · you’re an admin here</p>
<div class="layout"><div class="menu"><span class="cur">About</span><span>Cycles</span><span>Access</span><span>Features</span><span>Privacy</span><span>Recently removed</span></div>
<div class="body">
<div><span class="label">To sort out · 1</span>
<ul class="list" style="margin-top:8px"><li><span class="t"><b>2 goals from set-up have no owner chosen</b><span>They’re yours until you choose. Change failure rate, Self-service environments live.</span></span><span class="btn">Choose owners</span></li></ul></div>
<div><h2 style="margin-bottom:12px">About this workspace</h2>
<dl class="facts">
<dt>Name</dt><dd>Field Operations · <a>Rename</a></dd>
<dt>Set up</dt><dd>By Ana Silva on 11 Nov 2026, from the Engineering platform example.</dd>
<dt>People</dt><dd>3 people in 2 teams. 1 hasn’t opened it yet: Cara Diaz. <a>Copy the invitation</a></dd>
<dt>Year</dt><dd>2026, week 46 of 53. The wrap-up opens on 21 Dec 2026. <a>Cycles</a></dd>
<dt>How you work</dt><dd>Check-ins every week, by Thursday. A weekly review on Thursdays. <a>Change</a></dd>
<dt>Admins</dt><dd>Ana Silva. <a>Access</a></dd>
<dt>Features</dt><dd>Reviews, Metric library and Spreadsheets are on. <a>Features</a></dd>
<dt>Recording</dt><dd>Nothing about how the app is used here is recorded. <a>Privacy</a></dd>
</dl></div>
</div></div>
${note('Wireframe 12. Workspace, About, straight after set-up. It agrees with what set-up asked: a “How you work” fact repeats the two answers in the same words, “Set up” says who and when, and People says who has yet to arrive. “To sort out” carries what set-up left open, so it does not vanish when “Your first week” retires; nothing here tells an admin off for a choice set-up never offered. Today About has no line for the review day or the rhythm, and nowhere lets an admin change the day (W6).')}` });

kit.render(__dirname, SCREENS);
