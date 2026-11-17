/* Shared patterns (docs/design/patterns/spec.md): one goal row, one page header, one form footer.
   Drawn with the shared kit and rendered at 1440 and 360 px (the smallest phone, design-rules.md).
   Run: node docs/design/patterns/mockups/build.cjs. Drawings of layout, order and wording, not app code. */
const fs = require('fs');
const path = require('path');
const { CSS, st, warn, shell } = require('../../_shared/kit.cjs');

const EXTRA = `
.grows{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.grows>li+li{border-top:1px solid var(--line-2)}
.grow{display:grid;grid-template-columns:140px minmax(0,1fr) 168px auto;column-gap:16px;padding:12px 16px;align-items:start}
.grow .s{grid-column:1;grid-row:1}.grow .n{grid-column:2;grid-row:1;font-weight:600}.grow .n a{color:var(--fg);text-decoration:none}
.grow .why{grid-column:2;grid-row:2;color:var(--muted);font-size:14px;line-height:20px;margin-top:2px}
.grow .ctx{grid-column:2;grid-row:3;font-size:14px;line-height:20px;margin-top:4px}
.grow .v{grid-column:3;grid-row:1/span 2;text-align:right;font-size:14px;color:var(--muted)}.grow .v b{display:block;color:var(--fg);font-size:15px;font-variant-numeric:tabular-nums}
.grow .act{grid-column:4;grid-row:1/span 2}.grow .act:empty{display:none}
.grow .gap-off{color:var(--off)}.grow .gap-risk{color:var(--risk)}.grow .gap-on{color:var(--on)}
.grow .sc{font-variant:small-caps;letter-spacing:.04em;font-weight:650;color:var(--risk)}
.grow .warn{font-weight:400;color:var(--muted)}.grow .warn svg{color:var(--risk)}
.grow .ctx .warn{color:var(--fg)}
.grow .warn{align-items:flex-start}.grow .warn svg{flex:none;margin-top:3px}
.lvl{font-weight:400;color:var(--muted);font-size:13px;margin-left:8px}
.sechead{display:flex;align-items:baseline;gap:8px;margin:22px 0 8px}.sechead h2{margin:0}.sechead span{color:var(--muted)}
.callout{font-size:13px;color:var(--muted);margin:6px 0 0}
.slots{display:grid;grid-template-columns:140px minmax(0,1fr) 168px 96px;column-gap:16px;font-size:12px;font-weight:600;color:var(--muted);padding:0 16px 6px}
.slots span:nth-child(3){text-align:right}
.ph-status{display:none}
.taskbar{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:12px 24px;background:var(--bg)}
.taskbar span{color:var(--muted);font-size:14px}
.taskpage{max-width:620px;margin:0 auto;padding:28px 24px 0}
.foot{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--line);margin-top:28px;padding:12px 0 16px}
.foot .line{font-size:14px;color:var(--muted);margin-bottom:10px}.foot .line a{margin-right:8px}
.foot .btns{display:flex;justify-content:space-between;align-items:center;gap:12px}.foot .btns .btn.primary{margin-left:auto}
.field.bad .input{outline:2px solid var(--off);outline-offset:-1px;border-color:var(--off)}
.field .err{margin-top:-2px}
.dhead .sline{margin-bottom:6px}.dhead .meta{color:var(--muted);font-size:14px;margin-top:6px}
.dhead .acts{display:flex;gap:8px;align-items:center;flex:none}
.dgrid{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px}.dgrid h1{grid-column:1;grid-row:1}.dgrid .meta{grid-column:1;grid-row:2}.dgrid .acts{grid-column:2;grid-row:1;align-self:start}
.sheetnote{font-size:13px;color:var(--muted);margin:28px 0 8px;font-weight:600}
@media (max-width:700px){
 .grow{grid-template-columns:minmax(0,1fr) auto;row-gap:2px;padding:12px}
 .grow .s{grid-column:1;grid-row:1;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
 .grow .v{display:none}.ph-status{display:inline;font-size:14px;color:var(--muted)}.ph-status b{color:var(--fg);font-variant-numeric:tabular-nums}
 .grow .act{grid-column:2;grid-row:1}
 .grow .n{grid-column:1/span 2;grid-row:2}.grow .why{grid-column:1/span 2;grid-row:3}.grow .ctx{grid-column:1/span 2;grid-row:4}
 .slots{display:none}
 .taskbar{padding:12px 16px}.taskpage{padding:20px 16px 0}
 .dhead .acts{flex-wrap:wrap}.dgrid{display:block}.dgrid .acts{margin-top:12px}
 .taskbar{flex-wrap:wrap;row-gap:6px}.taskbar span:first-child{order:2;flex-basis:100%}.taskbar .btn{order:1;margin-left:auto}
 .foot .btns{flex-wrap:wrap}.foot .btns .btn.primary{width:100%;order:2}.foot .btns .back{order:1}
}`;

/* One goal row (spec 1.2): status, name, reason, context; value right; an action where the row is a task. */
const row = ({ k, name, level = '', value, gap = '', gapTone = '', why = '', ctx = '', act = '', wash = k === 'off' }) => {
  const gapHtml = gap ? `<span class="${gapTone ? 'gap-' + gapTone : ''}">${gap}</span>` : '';
  return `<li class="grow ${wash ? 'offwash' : ''}">
  <span class="s">${st(k)}<span class="ph-status"><b>${value}</b>${gap ? ' · ' + gapHtml : ''}</span></span>
  <span class="n"><a href="#">${name}</a>${level ? `<span class="lvl">${level}</span>` : ''}</span>
  ${why ? `<span class="why">${why}</span>` : ''}
  ${ctx ? `<span class="ctx">${ctx}</span>` : ''}
  <span class="v"><b>${value}</b>${gapHtml}</span>
  <span class="act">${act}</span>
</li>`;
};

const HARD = [
  row({ k: 'off', name: 'Lead time for changes on the main monorepo pipeline', level: 'Team', value: '36 hours', gap: '12 behind plan', gapTone: 'off',
    why: 'The runner pool is saturated at peak; builds queue for 40 minutes.',
    ctx: warn('Waiting on Amara: a decision on the second runner pool, since week 44.') }),
  row({ k: 'stale', name: 'Flaky test rate', level: 'Team', value: '4.1%', gap: 'as of week 9',
    why: warn('No check-in for 23 days; the last was week 9 (at risk).') }),
  row({ k: 'risk', name: 'Move builds to the new runners', level: 'Team', value: 'Stage 2 of 5', gap: '1 week late', gapTone: 'risk',
    why: 'Stage 3, Pilot with two teams, was due week 44.' }),
  row({ k: 'on', name: 'Pull requests with AI-assisted review', level: 'Group', value: '64%', gap: '2 pts ahead', gapTone: 'on',
    why: warn('Getting worse: On track today, but the recent trend heads for 61–66% by week 13, against a target of 70%.') }),
].join('');

const screens = {};

screens['01-goal-row'] = shell({ title: 'Goals', cur: 'Goals', who: 'amara', width: 'wide', body: `
<div class="head"><div class="stack"><h1>Goals</h1><p class="hint">Q4, week 46 of 13. Watching: the 9 goals you follow.</p></div><span class="btn primary">New goal</span></div>
<div class="tabs"><span>Mine</span><span>My team</span><span class="cur">Watching</span><span>All</span></div>
<div class="sechead"><h2>Needs attention</h2><span>4</span></div>
<div class="slots"><span>Status</span><span>Name · reason · context</span><span>Value · gap</span><span></span></div>
<ul class="grows">${HARD}</ul>
<p class="callout">Spec 1.5: the hard cases. The count is said once, in the heading (F07). One reason each; an open ask takes the context line because it changes what the reader does.</p>
<div class="sechead"><h2>Being handled</h2><span>1</span></div>
<ul class="grows">${row({ k: 'risk', name: 'Deploy frequency, Payments', level: 'Team', value: '3.2 a day', gap: '0.4 behind plan', gapTone: 'risk', why: 'Next step: Pavel, due week 47. Agreed in Platform weekly.' })}</ul>
<div class="sechead"><h2>The rest</h2><span>4</span></div>
<ul class="grows">${row({ k: 'on', name: 'Change failure rate', level: 'Group', value: '6%', gap: 'on plan', gapTone: 'on', why: 'Rhea Kapoor. Checked in Monday.' })}${row({ k: 'done', name: 'Retire the old artefact store', level: 'Team', value: '<span class="sc">Completed late</span>', why: 'Finished week 11; the target was week 10.' })}</ul>
` });

screens['02-row-places'] = shell({ title: 'Check-in', cur: 'Check-in', who: 'rhea', body: `
<div class="head"><div class="stack"><h1>Check-in</h1><p class="hint">Week 46, 10–16 Nov. Check-ins are due by Friday.</p></div><span class="btn primary">Start with Lead time for changes</span></div>
<div class="sechead"><h2>To do this week</h2><span>3</span></div>
<ul class="grows">
${row({ k: 'off', name: 'Lead time for changes on the main monorepo pipeline', value: '36 hours', gap: '12 behind plan', gapTone: 'off', why: 'Last week: 36 hours · 12 behind plan', act: '<span class="btn">Check in</span>' })}
${row({ k: 'risk', name: 'Move builds to the new runners', value: 'Stage 2 of 5', gap: '1 week late', gapTone: 'risk', why: 'Last week: Stage 2 · 1 week late', ctx: 'Draft kept', act: '<span class="btn">Carry on</span>' })}
${row({ k: 'none', name: 'Build cache hit rate', value: 'No number yet', why: 'No check-in yet', act: '<span class="btn">Check in</span>' })}
</ul>
<p class="callout">The check-in queue: the same row with an action. The name opens the goal; the button opens its check-in. On a phone the action shares line 1 with the status and value.</p>
<p class="sheetnote">The same row on a review's agenda (reason: the reviews spec's agendaReason)</p>
<ul class="grows">
${row({ k: 'off', name: 'Lead time for changes on the main monorepo pipeline', value: '36 hours', gap: '12 behind plan', gapTone: 'off', why: warn('On the agenda because: off track for 3 weeks, and its own date (week 44) has passed.') })}
${row({ k: 'on', name: 'Pull requests with AI-assisted review', value: '64%', gap: '2 pts ahead', gapTone: 'on', why: warn('On the agenda because: getting worse; heads for 61–66% against 70%.') })}
</ul>
<p class="sheetnote">And on Home, Your goals (reason: the top flag, or when it's due)</p>
<ul class="grows">
${row({ k: 'on', name: 'Change failure rate', value: '6%', gap: 'on plan', gapTone: 'on', why: 'Check-in due by Friday.', act: '<span class="btn">Check in</span>' })}
</ul>
` });

screens['03-page-headers'] = shell({ title: 'Lead time for changes on the main monorepo pipeline', cur: 'Goals', who: 'rhea', body: `
<p class="sheetnote" style="margin-top:0">A list page</p>
<div class="head"><div class="stack"><h1>Reviews</h1><p class="hint">6 reviews. The next is Platform weekly, Thursday.</p></div><span class="btn primary">New review</span></div>
<p class="callout">No back link (a place's first page). Title, one line, at most one filled action. Counts live in the count line, not here.</p>

<p class="sheetnote">A detail page: a goal with a long title</p>
<div class="dhead offwash" style="padding:16px;border-radius:10px">
  <a href="#">‹ Goals</a>
  <div class="sline" style="margin-top:10px">${st('off')} <span class="hint">· <b class="num" style="color:var(--fg)">36 hours</b> · 12 behind plan</span></div>
  <div class="dgrid"><h1>Lead time for changes on the main monorepo pipeline</h1>
  <p class="meta">Rhea Kapoor, CI/CD · Team goal · G-14 · Updated 14 Nov</p>
  <div class="acts"><span class="btn primary">Check in again</span><span class="btn">More</span></div></div>
</div>
<p class="callout">Status first, then the title on its own full-width line on a phone. Find, Demo and you stay in the shell's bar, never here (F03). One filled button, at most one standing button, then More.</p>

<p class="sheetnote">A focused task (focus mode: no sidebar)</p>
<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)">
  <div class="taskbar"><span>Check-in · 2 of 7 · Draft from Tuesday</span><span class="btn">Close and keep the draft</span></div>
  <div style="padding:20px 24px"><h1 style="font-size:22px;line-height:28px">How is Move builds to the new runners?</h1><p class="hint" style="margin-top:6px">Last week: Stage 2 of 5, 1 week late.</p></div>
</div>
<p class="callout">The exit is the only control at the top (U72). No primary here: it is in the footer.</p>
` });

const formPage = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Check-in</title><style>${CSS}${EXTRA}</style>
<div class="taskbar"><span>Check-in · 1 of 7</span><span class="btn">Close and keep the draft</span></div>
<div class="taskpage">
  <p class="sheetnote" style="margin-top:0">A step: the primary names the next step; Back only after step 1</p>
  <h1 style="font-size:24px;line-height:30px">How is Lead time for changes?</h1>
  <p class="hint" style="margin:6px 0 18px">Last week: 36 hours, 12 behind plan. Lower is better.</p>
  <div class="field bad"><b>This week's number</b><span class="err">Type this week's number, in hours.</span><span class="input" aria-invalid="true">hours</span></div>
  <div class="foot"><div class="btns"><span class="btn primary">Next: why it's behind</span></div></div>

  <p class="sheetnote">The last step: the status line says what the primary does</p>
  <div class="foot" style="position:static"><div class="line">Goes on record for week 46. The 3 people watching see it on Home.</div>
  <div class="btns"><span class="btn quiet back">‹ Back</span><span class="btn primary">Post check-in</span></div></div>

  <p class="sheetnote">Two errors, one out of view: a summary with links to the fields</p>
  <div class="foot" style="position:static"><div class="line"><span style="color:var(--off);font-weight:600">2 things to fix:</span> <a href="#">Why it's behind</a><a href="#">Back on plan by</a></div>
  <div class="btns"><span class="btn quiet back">‹ Back</span><span class="btn primary">Post check-in</span></div></div>

  <p class="sheetnote">The table check-in: counts in the status line; no Cancel (the exit is at the top)</p>
  <div class="foot" style="position:static"><div class="line">5 ready. <a href="#">2 need a reason</a> before they can post.</div>
  <div class="btns"><span class="btn primary">Post 5 check-ins</span></div></div>

  <p class="sheetnote">A sheet (no header exit): the one footer with Cancel</p>
  <div class="foot" style="position:static"><div class="btns"><span class="btn quiet back">Cancel</span><span class="btn primary">Add next step</span></div></div>
</div></html>`;
screens['04-form-footer'] = formPage;

async function main() {
  const here = __dirname;
  const out = path.join(here, '..', 'wireframes');
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const [name, raw] of Object.entries(screens)) {
    const html = (raw.includes(EXTRA) ? raw : raw.replace('</style>', EXTRA + '</style>'))
      .replace(/(<div class="top"><span class="f">F<\/span><div[^>]*>)<b>[^<]*<\/b><span>[^<]*<\/span>/, '$1<b>Platform Engineering</b><span>Example data · week 46</span>');
    const file = path.join(here, name + '.html');
    fs.writeFileSync(file, html);
    for (const [w, h] of [[1440, 900], [360, 780]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.goto('file://' + file);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) console.warn('  scrolls sideways:', name, w);
      await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
      await page.close();
    }
  }
  await browser.close();
  console.log('Rendered', Object.keys(screens).length, 'sheets at 1440 and 360 into', path.relative(process.cwd(), out));
}
main();
