/* Wireframes for Home, every week (docs/design/home/README.md, spec.md section 2).
   Usage: node docs/design/home/mockups/build.cjs
   Drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat, hairline rows, status as a
   shape plus a word, no edge stripes, quote bars, emoji or pill badges. Numbers are illustrative. */
const kit = require('../../_shared/kit.cjs');
const { st, warn, shell, note } = kit;

const CSS = `<style>
.hd{margin-bottom:26px}.hd .hint{margin-top:4px}
.hgrid{display:flex;gap:44px;align-items:flex-start}
.hmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:30px}
.hside{width:360px;flex:none;display:flex;flex-direction:column;gap:30px}
.lead{display:flex;gap:18px;align-items:flex-start}
.lead .eb{font-size:13px;line-height:18px;font-weight:600;color:var(--muted)}
.lead .lt{font-size:24px;line-height:30px}.lead .qt{font-size:20px;line-height:28px}
.lead .ln{color:var(--fg-2)}
.ring{width:64px;height:64px;border-radius:999px;border:5px solid var(--line);border-top-color:var(--accent);border-right-color:var(--accent);flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.ring b{font-size:16px}.ring span{font-size:10px;color:var(--muted);margin-top:3px}
.btn.big{min-height:46px;padding:0 20px;font-size:16px}
.blk{display:flex;flex-direction:column;gap:10px}
.blk h2 .cnt{font-weight:400;color:var(--muted)}
.blk .door{font-size:14px;font-weight:600;white-space:nowrap}
.cl{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:14px}.cl a{text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}
.sub{font-size:13px;line-height:18px;font-weight:600;color:var(--muted);margin-top:4px}.sub a{font-weight:600}
.rows{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin:0;padding:0;list-style:none}
.rows li{display:flex;gap:14px;align-items:flex-start;padding:12px 16px}.rows li+li{border-top:1px solid var(--line-2)}
.rows .s{width:152px;flex:none}.rows .t{flex:1;min-width:0;display:flex;flex-direction:column}.rows .t b{font-weight:600}.rows .t span{color:var(--muted);font-size:14px;line-height:20px}
.rows .v{width:150px;flex:none;text-align:right;font-size:14px;color:var(--muted)}.rows .v b{display:block;color:var(--fg);font-size:15px}
.rows .a{flex:none}
.ask{align-items:flex-start}.ask .t .said{color:var(--fg)!important;font-size:15px!important;line-height:22px!important;margin-top:2px}.ask .t .meta{margin-top:2px}
.glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.glance div{padding:12px 16px;display:flex;flex-direction:column;gap:1px}.glance div+div{border-left:1px solid var(--line-2)}
.glance .l{font-size:12px;font-weight:600;color:var(--muted)}.glance b{font-weight:650}.glance .s2{font-size:13px;color:var(--muted)}
.teams td:first-child{font-weight:600}.teams .cl{font-size:14px;gap:4px 12px}
.one{display:flex;gap:14px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px 16px}
.one p{flex:1;min-width:0}
.foot{font-size:14px;color:var(--muted)}
.state{margin-bottom:40px}.state>.label{display:block;margin-bottom:12px}
.pane{border:1px solid var(--line);border-radius:12px;background:var(--bg);padding:20px;display:flex;flex-direction:column;gap:22px}
.four{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1380px}
.phones{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start}
.phone{width:100%;max-width:390px;height:844px;overflow:hidden;border:1px solid var(--line);border-radius:26px;background:var(--bg);position:relative;display:flex;flex-direction:column}
.phone .ptop{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.phone .ptop b{display:block}.phone .ptop span.w{font-size:12px;color:var(--muted)}
.phone .pf{font-weight:800;font-size:20px}.phone .tf{font-size:13px;font-weight:600;color:var(--accent-text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--surface);min-height:44px;display:inline-flex;align-items:center}
.phone .pbody{padding:16px;display:flex;flex-direction:column;gap:22px;flex:1;overflow:hidden}
.phone .ptab{display:flex;justify-content:space-around;background:var(--surface);border-top:1px solid var(--line);padding:10px 0 14px;font-size:12px;font-weight:600;color:var(--muted)}.phone .ptab .cur{color:var(--accent-text)}
.phone h1{font-size:22px;line-height:28px}.phone .lead{flex-direction:column;gap:10px}.phone .lead .lt{font-size:22px;line-height:28px}.phone .btn.big{width:100%}
.phone .rows li{flex-wrap:wrap}.phone .rows .s{width:100%}.phone .rows .v{width:100%;text-align:left}.phone .rows .v b{display:inline;margin-right:6px}
.phone .glance{grid-template-columns:1fr}.phone .glance div+div{border-left:0;border-top:1px solid var(--line-2)}
.cap{font-size:13px;color:var(--muted);max-width:390px;margin-top:10px}
@media (max-width:1100px){.four{grid-template-columns:1fr}}
@media (max-width:700px){
 .hgrid{flex-direction:column;gap:26px}.hmain,.hside{display:contents}
 .hgrid>*>*{order:5;width:100%}.hgrid .o1{order:1}.hgrid .o2{order:2}.hgrid .o3{order:3}.hgrid .o8{order:8}.hgrid .o9{order:9}
 .lead{flex-direction:column;gap:10px}.lead .lt{font-size:22px;line-height:28px}.btn.big{width:100%}
 .rows li{flex-wrap:wrap}.rows .s{width:100%}.rows .v{width:100%;text-align:left}.rows .v b{display:inline;margin-right:6px}.rows .a{width:100%}.rows .a .btn{min-height:44px}
 .ask .btn{min-height:44px}
 .glance{grid-template-columns:1fr}.glance div+div{border-left:0;border-top:1px solid var(--line-2)}
 .one{flex-direction:column;align-items:stretch}.one .btn{min-height:44px}
 .pane{padding:14px}.phones{gap:28px}
}
</style>`;

/* The parts of Home. */
const head = (name, line = 'Platform Engineering · week 46, 9 to 15 Nov 2026') => `<div class="hd"><h1>Good morning, ${name}</h1><p class="hint">${line}</p></div>`;
const lead = ({ eb, title, line, btn, link, ring, extra = '' }) => `<section class="lead o1">${ring ? `<span class="ring"><b>${ring[0]}</b><span>${ring[1]}</span></span>` : ''}<div class="stack" style="gap:6px;flex:1;min-width:0">${eb ? `<span class="eb">${eb}</span>` : ''}<h2 class="lt">${title}</h2>${line ? `<p class="ln">${line}</p>` : ''}${btn || link ? `<div class="row" style="margin-top:8px;gap:16px">${btn ? `<span class="btn primary big">${btn}</span>` : ''}${link ? `<a>${link}</a>` : ''}</div>` : ''}${extra}</div></section>`;
const quiet = (title, line, btn) => `<section class="lead o1"><div class="stack" style="gap:6px;flex:1;min-width:0"><h2 class="qt">${title}</h2>${line ? `<p class="ln">${line}</p>` : ''}${btn ? `<div class="row" style="margin-top:6px"><span class="btn">${btn}</span></div>` : ''}</div></section>`;
const blk = (title, n, door, inner, cls = '') => `<section class="blk ${cls}"><div class="row between" style="align-items:baseline"><h2>${title}${n != null && n !== '' ? ` <span class="cnt">· ${n}</span>` : ''}</h2>${door ? `<a class="door">${door}</a>` : ''}</div>${inner}</section>`;
const counts = (pairs) => `<p class="cl">${pairs.map(([k, n]) => `<a>${st(k, n)}</a>`).join('')}</p>`;
const sub = (t) => `<p class="sub">${t}</p>`;
const grow = (k, title, line, value = '', gap = '', btn = '') => `<li class="${k === 'off' ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${line}</span></span>${btn ? `<span class="a"><span class="btn sm">${btn}</span></span>` : `<span class="v"><b class="num">${value}</b>${gap}</span>`}</li>`;
const rows = (...r) => `<ul class="rows">${r.join('')}</ul>`;
const ask = (av, what, said, meta, btn, mark = '') => `<li class="ask"><span class="av sm">${av}</span><span class="t"><b>${what}</b><span class="said">${said}</span><span class="meta">${mark ? warn(mark) + ' · ' : ''}${meta}</span><span style="margin-top:8px"><span class="btn sm">${btn}</span></span></span></li>`;
const glance = (...cells) => `<section class="glance o3">${cells.map(([l, v, s]) => `<div><span class="l">${l}</span><b>${v}</b><span class="s2">${s}</span></div>`).join('')}</section>`;
const moved = (k, title, line) => `<li><span class="t"><b>${title}</b><span>${st(k)} · ${line}</span></span></li>`;
const one = (says, why, btn) => `<div class="one"><p><b>${says}</b><br><span class="hint">${why}</span></p><span class="btn sm">${btn}</span></div>`;
const news = `<p class="foot o9">New in Faro: Goals counts once, and says its filters in words. <a>See what’s new</a></p>`;

const SCREENS = {};

/* 1. The owner on a due day */
const tundeGoals = (btn) => blk('Your goals', 2, 'See them in Goals', `${counts([['risk', 1], ['on', 1]])}${rows(
  grow('risk', 'Contract tests between the top 40 service pairs', 'Getting worse: fewer changes landed than planned. No next step yet.', '31 pairs', '4 behind plan', btn),
  grow('on', 'One-click rollback for every deployable service', 'Checked in on Tuesday', '3 of 4 stages', 'On schedule'))}`);
const tundeWatch = blk('Watching', 1, 'See it in Goals', `<p class="hint">Nothing in it needs attention.</p>${rows(grow('on', 'Production deploys per day', 'North star · Pavel Novák · checked in on Monday', '106 deploys', '3 ahead of plan'))}`);

SCREENS['01-owner-due-day'] = shell({ title: 'Home', cur: 'Home', who: 'tunde', width: 'wide', counts: { 'Check-in': 1 }, body: `${CSS}
${head('Tunde')}
<div class="hgrid"><div class="hmain">
${lead({ ring: ['1/2', 'check-ins'], eb: 'Check-ins are due by Thursday 12 Nov, tomorrow', title: '1 check-in to do', line: 'Contract tests between the top 40 service pairs. About a minute.', btn: 'Start check-in' })}
${tundeGoals('Check in')}
${tundeWatch}
${news}
</div></div>
${note('Wireframe 1. The owner on a due day (Tunde, Wednesday 11 Nov). What is asked comes first and is the page’s one primary action; “Your goals · 2” is said once, its counts are links to exactly those goals, and the row that is due carries the same action as a plain button. Nothing waits on him and nothing he follows moved, so there is no side column. Today the same morning shows his two goals three times above the fold, a streak twice, and “Next review: None you’re in” (H3, H7, H8).')}` });

/* 2. The owner on quiet days */
SCREENS['02-owner-quiet-day'] = shell({ title: 'Home', cur: 'Home', who: 'tunde', width: 'wide', counts: { 'Check-in': 2 }, body: `${CSS}
<div class="state"><span class="label">(a) Monday 9 Nov: nothing is asked today</span>
${head('Tunde')}
<div class="hgrid"><div class="hmain">
${quiet('Nothing is asked of you today.', 'Check-ins for week 46 are due by Thursday 12 Nov. You have 2 to do.', 'Check in early')}
${tundeGoals('')}
${tundeWatch}
</div></div></div>
<div class="state"><span class="label">(b) Thursday 12 Nov, both posted: the same place says so, and when the next is due</span>
<div class="pane">${quiet('Both check-ins are in for week 46.', 'That is 5 weeks in a row on time. The next are due by Thursday 19 Nov.')}</div></div>
<div class="state"><span class="label">(c) Friday 13 Nov, both posted on time: the deadline that has passed is not said again</span>
<div class="pane">${quiet('Both check-ins are in for week 46.', 'The next are due by Thursday 19 Nov.')}</div></div>
<div class="state"><span class="label">(d) Friday 13 Nov, one not posted: late is said once, plainly, and is the primary action</span>
<div class="pane">${lead({ ring: ['1/2', 'check-ins'], eb: 'Check-ins were due on Thursday 12 Nov', title: '1 check-in still to do', line: 'Contract tests between the top 40 service pairs. It counts for week 46 until Sunday.', btn: 'Start check-in' })}</div></div>
${note('Wireframe 2. Quiet days look quiet. On Monday the check-in is not yet asked, so it is a sentence and a plain button, and the page has no primary action. Once everything is in, one sentence says so and names the next date; the streak is a clause of that sentence, shown from two weeks and never as “0 weeks”. Today Monday is as loud as Thursday, “You’re all set” sits under “This week’s check-ins were due Thursday”, and the button offered is “See all goals”, which opens his own two (H2, H6, H7).')}` });

/* 3. The manager on review day */
const rheaAsks = (due) => blk('Needs your response', 1, '', rows(ask('DO', 'Pipeline queue wait (p90)', '“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”', 'Daniel asked in Developer Productivity fortnightly on Tue 3 Nov.', 'Answer', due)), 'o2');
const rheaGoals = blk('Your goals', 8, 'See them in Goals', `${counts([['off', 2], ['risk', 2], ['none', 1], ['on', 2], ['done', 1]])}
${sub('<a>4 need attention</a>')}${rows(
  grow('off', 'Lead time for changes', 'Decision or help needed: waiting on Amara since 4 Aug', '', '', 'Check in'),
  grow('off', 'Pipeline queue wait (p90)', 'Decision or help needed: blocked on Infrastructure &amp; Compute', '', '', 'Check in'),
  grow('risk', 'Flaky test rate in the main pipelines', 'Recovering: on the planned pace for three weeks', '', '', 'Check in'),
  grow('risk', 'Manual release sign-offs replaced by quality gates', 'The fix landed; expected back on plan in a few weeks', '', '', 'Check in'))}
<p class="hint"><a>Show the 4 with nothing flagged</a></p>`);
const rheaTeam = blk('Your team', 'CI/CD · 17 goals', 'See them in Goals', `${counts([['off', 2], ['risk', 4], ['stale', 1], ['on', 10]])}
${sub('<a>3 need attention that aren’t yours</a>')}${rows(
  grow('risk', 'Merge queue on the web monorepo', 'Lukas Meyer · slipped a week, new date Mon 23 Nov', '60%', '15 pts behind plan'),
  grow('stale', 'Runner image cache hit rate', 'Sofia Rossi · no check-in for 16 days', '71%', 'as of week 44'),
  grow('risk', 'Pipeline templates adopted', 'Lukas Meyer · getting worse for two weeks', '22 of 40', '3 behind plan'))}`);
const rheaWatch = blk('Watching', 12, 'See them in Goals', `${sub('<a>4 need attention</a>')}${rows(
  grow('off', 'Container images rebuilt within 7 days of a base image fix', 'SVP · Ingrid Holm · two people were pulled onto a release', '68%', '14 pts behind plan'),
  grow('off', 'Data pipeline template on the portal', 'Jun Tanaka · blocked on Data Platform', '1 of 3 stages', 'Late'))}
<p class="hint"><a>2 more need attention</a></p>`);
const rheaChanged = blk('Changed since Friday 6 Nov', '', '', `<p class="cl"><a>2 got worse</a><a>1 recovered</a><a>1 went quiet</a></p>${rows(
  moved('risk', 'Pipeline templates adopted', 'was on track · your team'),
  moved('off', 'Data pipeline template on the portal', 'was at risk · watching'),
  moved('on', 'Test suites split into parallel shards', 'was at risk · yours'),
  moved('stale', 'Portal searches that find the right page first time', 'last checked in week 40 · watching'))}`, 'o8');

SCREENS['03-manager-review-day'] = shell({ title: 'Home', cur: 'Home', who: 'rhea', width: 'wide', counts: { 'Check-in': 6, Reviews: 1 }, body: `${CSS}
<div class="state"><span class="label">(a) Tuesday 10 Nov, morning: her review is today and reads check-ins she hasn’t posted</span>
${head('Rhea')}
<div class="hgrid"><div class="hmain">
${lead({ ring: ['1/7', 'check-ins'], eb: 'Developer Productivity fortnightly is today', title: '6 check-ins to do before it', line: 'The review reads them as you post them. The workspace’s own deadline is Thursday 12 Nov. About 5 minutes.', btn: 'Start check-in', link: 'Or type all your numbers in one table' })}
${glance(['Review today', 'Developer Productivity fortnightly', '14 to discuss · 21 with nothing flagged · Open it'])}
${rheaGoals}
${rheaTeam}
${rheaWatch}
${news}
</div><div class="hside">
${rheaAsks('Due before today’s session')}
${rheaChanged}
</div></div></div>
<div class="state"><span class="label">(b) The same day, once her check-ins are in: the review is the one primary action</span>
<div class="pane">${lead({ ring: ['0/35', 'reviewed'], eb: 'Developer Productivity fortnightly is today · your 7 check-ins are in', title: '14 goals to discuss', line: '21 more have nothing flagged: mark them together at the end.', btn: 'Open the review' })}</div></div>
<div class="state"><span class="label">(c) Wednesday 11 Nov, the session not held: said once, where the action is</span>
<div class="pane">${lead({ ring: ['0/35', 'reviewed'], eb: warn('Not held yet') + ' · Developer Productivity fortnightly was on Tuesday 10 Nov', title: '14 goals to discuss', line: 'Hold it now, or it closes when next week starts and these carry to Tuesday 24 Nov.', btn: 'Open the review' })}</div></div>
${note('Wireframe 3. The manager on review day (Rhea). The lead is the one thing true today: her check-ins while the review will read them, then the review. The review is otherwise one cell and a door. Her question is marked due today; “Your goals”, “Your team” and “Watching” each open the same scope of Goals with the same counts; what moved since her last visit is in the side column. Today the review on its own day is a tile with no number, the question’s date silently moves two weeks the day after, the streak reads “0 weeks”, and her team is not on Home at all (H1, H4, H7, H9).')}` });

/* 4. The leader */
const teamRow = (t, n, cs, mv) => `<tr><td><a>${t}</a></td><td><a>${n} need attention</a></td><td>${counts(cs)}</td><td class="hint">${mv}</td></tr>`;
const amaraTeams = blk('Watching', '56 goals in 9 teams', 'See them in Goals', `${counts([['off', 9], ['risk', 14], ['stale', 3], ['on', 26], ['done', 4]])}
${sub('<a>20 need attention</a> · teams worst first')}
<table class="teams stackable"><thead><tr><th>Team</th><th>Needs attention</th><th>Its goals you watch</th><th>Since Thu 5 Nov</th></tr></thead><tbody>
${teamRow('CI/CD', 5, [['off', 2], ['risk', 2], ['on', 3]], '1 got worse')}
${teamRow('Security Engineering', 4, [['off', 2], ['risk', 1], ['stale', 1], ['on', 2]], '1 went quiet')}
${teamRow('Developer Experience', 3, [['off', 1], ['risk', 2], ['on', 4]], '1 recovered')}
${teamRow('Build &amp; Release', 3, [['off', 1], ['risk', 2], ['on', 3]], 'No change')}
${teamRow('Data Platform', 2, [['off', 1], ['risk', 2], ['stale', 1], ['on', 2]], '1 got worse')}
</tbody></table>
<p class="hint"><a>4 more teams, 3 need attention</a></p>`);
const amaraChanged = blk('Changed since Thursday 5 Nov', '', '', `<p class="cl"><a>3 got worse</a><a>2 recovered</a><a>3 went quiet</a><a>1 done</a></p>${rows(
  moved('off', 'Merge-to-deploy time (median)', 'was at risk · CI/CD'),
  moved('risk', 'Critical and high vulnerabilities fixed within SLA', 'was on track · called early by its owner'),
  moved('on', 'Services that start locally with one command', 'was at risk · Developer Experience'),
  moved('done', 'Superseded pipeline runs cancelled automatically', 'reached 95% · CI/CD'))}
<p class="hint"><a>All 9 in Goals</a></p>`, 'o8');
const amaraAsks = blk('Also needs your response', 1, '', rows(ask('AN', 'Lead time for changes', '“Take the runner budget to the finance review.”', 'A next step you agreed in Platform leadership weekly on 22 Oct. Due week 47 (16 to 22 Nov).', 'Mark done')), 'o2');
const amaraLead = lead({ eb: 'Needs your response · waiting since 4 Aug, 14 weeks', title: 'Rhea needs a decision', line: '“approve the extra CI runner budget for Q4”. 3 goals are waiting on it: Lead time for changes, and 2 more.', btn: 'Respond' });
const amaraGlance = glance(['Review tomorrow, Thu 12 Nov', 'Platform leadership weekly', '20 to discuss · 36 with nothing flagged'], ['Checked in for week 46', '98 of 118 goals', 'Due by Thu 12 Nov']);

SCREENS['04-leader'] = shell({ title: 'Home', cur: 'Home', who: 'amara', width: 'wide', counts: { Reviews: 1 }, body: `${CSS}
${head('Amara')}
<div class="hgrid"><div class="hmain">
${amaraLead}
${amaraGlance}
${amaraTeams}
${news}
</div><div class="hside">
${amaraAsks}
${amaraChanged}
<section class="blk o9"><h2>Platform Engineering</h2>${one('3 things to sort out', '12 people have no email, and 2 more.', 'See them')}</section>
</div></div>
${note('Wireframe 4. The leader (Amara, Wednesday 11 Nov; she owns no goal, watches 56 and is an admin). The lead is what has waited on her longest, not a review that is tomorrow. Under it: tomorrow’s review and how the week’s check-ins stand, each a door; then the goals she follows as teams, worst first, every count a link to exactly those goals; what moved since her last visit beside it. Teams and goals are ranked, never people. Today her Home opens on all 126 goals’ counts, makes “Open the review” the primary three days early, and cannot say which teams are worst or what changed (H1, H2, H5, H11).')}` });

/* 5. The watcher */
SCREENS['05-watcher'] = shell({ title: 'Home', cur: 'Home', who: 'oskar', width: 'wide', counts: {}, body: `${CSS}
${head('Oskar')}
<div class="hgrid"><div class="hmain">
${quiet('Nothing is asked of you today.', '')}
${blk('Watching', 3, 'See them in Goals', `${counts([['risk', 1], ['on', 2]])}${sub('<a>1 needs attention</a>')}${rows(
  grow('risk', 'Services that start locally with one command', 'Isabel Moreno · the changes are working; the number lags by a week or two', '69%', '3 pts behind plan'),
  grow('on', 'Pull requests with AI-assisted review', 'North star · Tariq Haddad · checked in on Tuesday', '72%', '1 pt ahead of plan'),
  grow('on', 'Time from pull request opened to first review', 'SVP · Tariq Haddad · checked in on Tuesday', '8.1 hours', '0.3 hours behind plan'))}`)}
<p class="foot">You don’t own a goal. <a>Set one up</a></p>
${news}
</div><div class="hside">
${blk('Changed since Friday 6 Nov', '', '', `<p class="cl"><a>1 got worse</a></p>${rows(moved('risk', 'Services that start locally with one command', 'was on track · watching'))}`, 'o8')}
</div></div>
${note('Wireframe 5. Someone who only watches (Oskar). No lead and no button: nothing is asked. The three goals he chose are all on the page, with what moved beside them. Today his first block is the whole company’s counts (“All goals · 126”), the headline is “No check-ins or reviews due”, and the primary action every day is “Find goals to watch”, though he already watches three (H12).')}` });

/* 6. The admin's line, and someone with nothing */
SCREENS['06-admin-and-nothing'] = shell({ title: 'Home', cur: 'Home', who: 'amara', width: 'wide', counts: {}, body: `${CSS}
<div class="state"><span class="label">(a) An admin who owns nothing and isn’t in this week’s reviews (Grace): the workspace’s line, in the side column</span>
${head('Grace')}
<div class="hgrid"><div class="hmain">
${quiet('Nothing is asked of you today.', '')}
${blk('Watching', 12, 'See them in Goals', `${counts([['off', 1], ['risk', 4], ['on', 7]])}${sub('<a>5 need attention</a>')}${rows(
  grow('off', 'Lead time for changes', 'North star · Rhea Kapoor · waiting on a decision since 4 Aug', '37 hours', '9 hours behind plan'),
  grow('risk', 'Developer satisfaction, rolling pulse score', 'North star · Daniel Okafor · waiting on a next step', '72 pts', '1 pt behind plan'),
  grow('risk', 'Change failure rate', 'North star · Pavel Novák · the number lags the fix', '13.9%', 'Near the 15.0% limit'),
  grow('risk', 'Critical and high vulnerabilities fixed within SLA', 'North star · Farah Siddiqui · needs a change from CI/CD', '89%', '3 pts behind plan'))}
<p class="hint"><a>1 more needs attention</a></p>`)}
</div><div class="hside">
<section class="blk o2"><h2>Platform Engineering</h2>${one('3 things to sort out', '12 people have no email, and 2 more.', 'See them')}</section>
</div></div></div>
<div class="state"><span class="label">(b) The same line in the last weeks of the year (week 52 of 53)</span>
<div class="pane" style="max-width:420px"><section class="blk"><h2>Platform Engineering</h2>${one('The wrap-up is open', '31 of 126 goals are wrapped up. 2026 ends on Sunday 3 Jan.', 'See the wrap-up')}${one('3 things to sort out', '12 people have no email, and 2 more.', 'See them')}</section></div></div>
<div class="state"><span class="label">(c) Someone with nothing: owns none, watches none, in no review</span>
<div class="pane" style="max-width:760px">
${quiet('Nothing is asked of you today.', 'You don’t own or watch a goal in Platform Engineering yet.')}
<div class="row"><span class="btn">See the goals</span><span class="btn">Set up a goal</span></div></div></div>
${note('Wireframe 6. An admin’s things to sort out are one line on Home that opens Workspace, About, where the list lives; it is never the lead, and it is absent when there is nothing. In the last weeks of the year the same block carries the wrap-up’s count and door. Someone with nothing gets one sentence and two plain ways in. Today an admin’s Home never mentions the workspace until the year ends, and Grace, who watches 12 goals, is told to “Find goals to watch” (H12, H13).')}` });

/* 7. The phone's first screen: owner and leader */
const phone = (title, who, tabs, body) => `<div><div class="phone"><div class="ptop"><span class="pf">F</span><div style="flex:1;min-width:0"><b>${title}</b><span class="w">Platform Engineering · week 46</span></div><span class="tf">Find</span><span class="av">${who}</span></div><div class="pbody">${body}</div><div class="ptab">${tabs.map((t, i) => `<span class="${i === 0 ? 'cur' : ''}">${t}</span>`).join('')}</div></div></div>`;
SCREENS['07-phone-first-screens'] = shell({ bare: true, title: 'Home on a phone', body: `${CSS}
<div class="phones">
<div>${phone('Home', 'TB', ['Home', 'Check-in · 1', 'Goals', 'Reviews', 'More'], `<h1>Good morning, Tunde</h1>
${lead({ ring: ['1/2', 'check-ins'], eb: 'Check-ins are due by Thursday 12 Nov, tomorrow', title: '1 check-in to do', line: 'Contract tests between the top 40 service pairs. About a minute.', btn: 'Start check-in' })}
${blk('Your goals', 2, 'See them', `${counts([['risk', 1], ['on', 1]])}${rows(
  grow('risk', 'Contract tests between the top 40 service pairs', 'Getting worse. No next step yet.', '31 pairs', '4 behind plan'),
  grow('on', 'One-click rollback for every deployable service', 'Checked in on Tuesday', '3 of 4 stages', 'On schedule'))}`)}`)}
<p class="cap">(a) The owner on a due day, 390 by 844. In the first screen: what is asked and its button, and both his goals with their status.</p></div>
<div>${phone('Home', 'AN', ['Home', 'Goals', 'Reviews · 1', 'People', 'More'], `<h1>Good morning, Amara</h1>
${amaraLead}
${blk('Also needs your response', 1, '', rows(ask('AN', 'Lead time for changes', '“Take the runner budget to the finance review.”', 'You agreed it on 22 Oct. Due week 47 (16 to 22 Nov).', 'Mark done')))}
${amaraGlance}`)}
<p class="cap">(b) The leader, 390 by 844. In the first screen: the decision waiting on her and the other thing asked; tomorrow’s review starts at the fold, and her teams, worst first, are the next screen.</p></div>
<div>${phone('Home', 'TB', ['Home', 'Check-in · 2', 'Goals', 'Reviews', 'More'], `<h1>Good morning, Tunde</h1>
${quiet('Nothing is asked of you today.', 'Check-ins for week 46 are due by Thursday 12 Nov. You have 2 to do.', 'Check in early')}
${tundeGoals('')}
${tundeWatch}`)}
<p class="cap">(c) The owner on a quiet Monday: everything he owns and watches fits the first screen.</p></div>
</div>
${note('Wireframe 7. The phone’s first screen. The order is the same as on a computer, in one column: what is asked, what else waits on you, this week’s dates, your goals, your team, Watching, what changed. The greeting is one line and the workspace is in the top bar, so the lead starts 120 px down. Today the owner’s first screen spends its top 150 px on a strip that repeats his goals, a streak and “None you’re in”, and “What’s new” sits between his goals (H3, H14).')}` });

/* 8. No set rhythm, Reviews off, and modules off */
const rheaTop = `<h1 style="font-size:22px;line-height:28px">Good morning, Rhea</h1>`;
const rheaGoalsShort = (extra = '', stale = false) => blk('Your goals', 8, 'See them in Goals', `${counts([['off', 2], ['risk', 2], ['none', 1], ['on', 2], ['done', 1]])}${extra}${rows(
  grow('off', 'Lead time for changes', `Decision or help needed${stale ? ' · as of week 44' : ''}`, '', '', stale ? 'Check in' : 'Check in'),
  grow('off', 'Pipeline queue wait (p90)', 'Blocked on Infrastructure &amp; Compute', '', '', 'Check in'))}<p class="hint"><a>Show the other 6</a></p>`);
SCREENS['08-four-ways'] = shell({ bare: true, title: 'Home four ways', body: `${CSS}
<div class="four">
<div class="pane"><span class="label">(a) No set rhythm, Reviews on · Tuesday 10 Nov</span>${rheaTop}
${lead({ ring: ['0/35', 'reviewed'], eb: 'Developer Productivity fortnightly is today', title: '14 goals to discuss', line: '21 more have nothing flagged: mark them together at the end.', btn: 'Open the review' })}
${rheaAsks('Due before today’s session')}
${rheaGoalsShort(sub('2 have a check-in this week. CI cost per pipeline run has none yet.'), true)}
<p class="hint">Gone: “due by”, late, the streak, “no recent update”. A check-in is offered on each row and never asked for.</p></div>
<div class="pane"><span class="label">(b) Every week, Reviews off · Tuesday 10 Nov</span>${rheaTop}
${quiet('Nothing is asked of you today.', 'Check-ins for week 46 are due by Thursday 12 Nov. You have 6 to do.', 'Check in early')}
${blk('Needs your response', 1, '', rows(ask('DO', 'Pipeline queue wait (p90)', '“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?”', 'Daniel asked on Tue 3 Nov.', 'Answer')))}
${rheaGoalsShort()}
<p class="hint">Gone: the review as a lead, its cell, and “in Developer Productivity fortnightly… before its session” on the question.</p></div>
<div class="pane"><span class="label">(c) No set rhythm, Reviews off · any day</span>${rheaTop}
${lead({ eb: 'Needs your response · waiting since Tue 3 Nov', title: 'Daniel asked a question', line: '“If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?” About Pipeline queue wait (p90).', btn: 'Answer' })}
${rheaGoalsShort(sub('2 have a check-in this week. CI cost per pipeline run has none yet.'), true)}
<p class="hint">What is left is the core: what is asked of you, your goals, what you follow, what changed. An ask a week old is the lead; with none, there is no lead.</p></div>
<div class="pane"><span class="label">(d) Every week, Reviews on; Watching and Metrics switched off · Wednesday 11 Nov</span>${rheaTop}
${lead({ ring: ['2/7', 'check-ins'], eb: 'Check-ins are due by Thursday 12 Nov, tomorrow', title: '5 check-ins to do', line: 'Flaky test rate in the main pipelines, and 4 more. About 4 minutes.', btn: 'Start check-in', link: 'Or type all your numbers in one table' })}
${rheaAsks('')}
${rheaGoalsShort()}
${blk('Your team', 'CI/CD · 17 goals', 'See them in Goals', `${counts([['off', 2], ['risk', 4], ['stale', 1], ['on', 10]])}${sub('<a>3 need attention that aren’t yours</a>')}`)}
<p class="hint">Gone: the “Watching” block and its goals in “Changed since”; the cell “3 numbers have arrived from their sources”. No empty block, no sentence about either.</p></div>
</div>
${note('Wireframe 8. The same Home four ways and with modules off, as Rhea. One rule decides the lead from the facts that exist: with no set rhythm a check-in is never asked, so it is never the lead (this changes round 2’s wireframe 3, where “Check in on a goal” was the primary); with Reviews off a review can’t be. Blocks are places a module fills, so a module that is off leaves nothing behind.')}` });

/* 9. The last weeks of the year, and the first week's hand-over */
SCREENS['09-year-end-and-first-week'] = shell({ title: 'Home', cur: 'Home', who: 'tunde', width: 'wide', counts: { 'Check-in': 2 }, body: `${CSS}
<div class="state"><span class="label">(a) An owner in the last week of a quarter that isn’t the year’s end (Monday 21 Sep, week 39): a date and a door, nothing asked yet</span>
<div class="pane">${quiet('Nothing is asked of you today.', 'Check-ins for week 39 are due by Thursday 24 Sep. You have 2 to do.', 'Check in early')}
${glance(['Q3 ends on Sunday 27 Sep', '1 of your goals is due by then', 'One-click rollback for every deployable service · 3 of 4 stages'])}</div></div>
<div class="state"><span class="label">(b) An owner in the year’s last two weeks (Monday 21 Dec, week 52 of 53), this week’s check-ins posted: the wrap-up is the lead</span>
<div class="pane">${lead({ ring: ['0/2', 'wrapped'], eb: '2026 ends on Sunday 3 Jan', title: 'Wrap up your 2 goals', line: 'How each one landed, one thing you learned, and whether it carries on. About a minute each.', btn: 'Start the wrap-up' })}</div></div>
<div class="state"><span class="label">(c) The same week, check-ins not yet posted: the check-in leads, and the wrap-up is a cell with its door</span>
<div class="pane">${lead({ ring: ['0/2', 'check-ins'], eb: 'Check-ins are due by Thursday 24 Dec, tomorrow', title: '2 check-ins to do', line: 'The last numbers of 2026 but one. About 2 minutes.', btn: 'Start check-in' })}
${glance(['2026 ends on Sunday 3 Jan', 'Wrap up your 2 goals', 'Open from today · about a minute each'])}</div></div>
<div class="state"><span class="label">(d) “Your first week”, as Ben on Thursday 19 Nov, his first due day: the block’s first row is the lead, in the everyday lead’s place</span>
<div class="pane">${lead({ eb: 'Your first week · Ana Silva set up Field Operations on 11 Nov and gave you 1 goal', title: 'Post your first check-in', line: 'It’s due today, Thursday 19 Nov.', btn: 'Start check-in' })}
${glance(['Review today', 'Weekly review', 'The first one, and you’re in it · Open it'])}</div></div>
<div class="state"><span class="label">(e) Ben on Monday 23 Nov: his first check-in is in, so the everyday Home has taken over, eleven days after he arrived</span>
<div class="pane">${quiet('Nothing is asked of you today.', 'Check-ins for week 48 are due by Thursday 26 Nov. You have 1 to do.', 'Check in early')}</div></div>
${note('Wireframe 9. The end of a quarter and of the year, and the first week. Home says one line and gives a door; the wrap-up’s own screens belong to the cycle’s end. The first week is not a second Home: its rows are candidates for the same lead and the same cells, with first-week words, and each person’s hand-over is the moment their own first check-in is in (or 14 days, as round 2 has it). Today the wrap-up lead appears only after check-ins and the admin’s card is the one place Home mentions the year (read from the code: the demo cannot reach these weeks).')}` });

kit.render(__dirname, SCREENS);
