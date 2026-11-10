/* The shared kit for the redesign's wireframes (docs/design/README.md).
   Each area's mockups/build.cjs describes its screens with these helpers; render() writes one HTML mock-up per screen
   beside it and a picture of each at 1440 and 390 into ../wireframes/.
   These are drawings of layout, order and wording, not app code. They follow docs/design-rules.md: flat surfaces,
   hairline rows, status as a shape plus a word, no edge stripes, quote bars, emoji or pill badges.
   The look matches docs/design/workspace/mockups/build.cjs (PR #81), so the whole set reads as one app. */
const fs = require('fs');
const path = require('path');

const CSS = `
:root{--bg:#F6F5F1;--surface:#fff;--surface-2:#FAF9F6;--line:#E4E1D9;--line-2:#EBE8E1;--fg:#183638;--fg-2:#2F4A4C;--muted:#465759;--faint:#9AA3A1;--accent:#21968E;--accent-text:#136F78;--on:#1D7F5F;--risk:#93450A;--off:#B42318;--off-wash:#FFF6F5}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/22px Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent-text);text-decoration:underline;text-underline-offset:2px}h1{font-size:28px;line-height:34px;margin:0;font-weight:650;letter-spacing:-.01em}h2{font-size:17px;line-height:24px;margin:0;font-weight:650}h3{font-size:15px;line-height:22px;margin:0;font-weight:650}
p{margin:0}.hint{color:var(--muted);font-size:14px;line-height:20px}.label{font-size:12px;line-height:16px;font-weight:600;color:var(--muted)}.strong{font-weight:650}.num{font-variant-numeric:tabular-nums}
.app{display:flex;min-height:100vh}.side{width:236px;flex:none;border-right:1px solid var(--line);padding:18px 12px;display:flex;flex-direction:column;gap:2px}
.brand{font-weight:800;font-size:20px;padding:0 10px 10px}.wsname{padding:6px 10px 12px;display:flex;justify-content:space-between;gap:8px}.wsname b{display:block}.wsname span{font-size:12px;color:var(--muted)}
.find{display:flex;justify-content:space-between;align-items:center;min-height:38px;margin:0 0 10px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--muted);font-size:14px}.kbd{font-size:12px;border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--muted)}
.nav{display:flex;gap:12px;align-items:center;padding:8px 10px;border-radius:8px;color:var(--fg-2)}.nav.cur{background:var(--surface);font-weight:650;color:var(--fg)}.nav.sub{padding-left:38px;font-size:14px;padding-top:5px;padding-bottom:5px}
.nav i{width:16px;height:16px;border:1.6px solid currentColor;border-radius:4px;flex:none;opacity:.7}.nav .n{margin-left:auto;font-size:13px;font-weight:600;color:var(--muted)}.gap{flex:1}.sep{height:1px;background:var(--line);margin:8px 10px}
.me{display:flex;gap:10px;align-items:center;padding:10px}.av{width:32px;height:32px;border-radius:999px;background:var(--fg);color:var(--bg);font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none}.av.sm{width:26px;height:26px;font-size:10px}
main{flex:1;min-width:0;padding:32px 32px 64px}.page{max-width:880px}.page.wide{max-width:1120px}.page.narrow{max-width:620px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.head .stack{gap:4px}
.stack{display:flex;flex-direction:column;gap:8px}.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}.nowrap{flex-wrap:nowrap}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600;color:var(--fg);white-space:nowrap}
.btn.primary{background:var(--fg);border-color:var(--fg);color:#fff}.btn.quiet{border-color:transparent;background:transparent;color:var(--accent-text);padding:0 4px}.btn.danger{color:var(--off);border-color:#F0A39C}.btn.sm{min-height:32px;padding:0 10px;font-size:14px}.btn.on{border-color:var(--fg);box-shadow:inset 0 0 0 1px var(--fg)}
.tabs{display:flex;gap:24px;border-bottom:1px solid var(--line);margin-bottom:16px;overflow:hidden}.tabs span{padding:10px 0;color:var(--muted);font-weight:600;white-space:nowrap}.tabs .cur{color:var(--fg);box-shadow:0 2px 0 var(--fg)}.tabs em{font-style:normal;font-weight:400;color:var(--muted);margin-left:5px}
.input{display:flex;align-items:center;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--faint);flex:1;min-width:180px}.input.filled{color:var(--fg)}.input.focus{outline:2px solid var(--fg);outline-offset:1px}.input.bad{outline:2px solid var(--off);outline-offset:1px}
.field{display:flex;flex-direction:column;gap:6px}.field>b{font-weight:600}.err{color:var(--off);font-size:14px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.bar .input{flex:1 1 260px}
.countline{color:var(--muted);font-size:14px;margin:6px 0 12px}.countline b{color:var(--fg)}
.filters{font-size:14px;color:var(--muted);margin:0 0 10px}.filters u{color:var(--accent-text);text-underline-offset:2px}
.list{border:1px solid var(--line);border-radius:10px;background:var(--surface);margin:0;padding:0;list-style:none}.list li{display:flex;gap:12px;align-items:center;padding:12px 16px;min-height:56px}.list li+li{border-top:1px solid var(--line-2)}
.list .t{flex:1;min-width:0}.list .t b{display:block;font-weight:600}.list .t span{color:var(--muted);font-size:14px}.list .r{color:var(--muted);font-size:14px;text-align:right}.chev{color:var(--faint)}
.list li.grp{min-height:0;padding:8px 16px;background:var(--surface-2);font-size:12px;font-weight:600;color:var(--muted)}.list li.cur{outline:2px solid var(--fg);outline-offset:-2px;border-radius:8px}
.offwash{background:var(--off-wash)}
.goal{align-items:flex-start!important}.goal .s{width:150px;flex:none}.goal .v{width:170px;flex:none;text-align:right;font-size:14px;color:var(--muted)}.goal .v b{display:block;color:var(--fg);font-size:15px}.goal.d1 .s{margin-left:22px;width:128px}.goal.d2 .s{margin-left:44px;width:106px}
.layout{display:flex;gap:40px;align-items:flex-start}.menu{width:196px;flex:none;display:flex;flex-direction:column;gap:2px}.menu span{padding:9px 10px;border-radius:8px;color:var(--fg-2)}.menu .cur{background:var(--surface);font-weight:650;color:var(--fg)}
.body{flex:1;min-width:0;display:flex;flex-direction:column;gap:28px}.aside{width:340px;flex:none;display:flex;flex-direction:column;gap:24px}
.facts{margin:0;display:grid;grid-template-columns:150px 1fr;gap:10px 16px}.facts dt{color:var(--muted)}.facts dd{margin:0}
.st{display:inline-flex;gap:6px;align-items:center;font-weight:600;white-space:nowrap}.st svg{flex:none}.st.on,.st.done{color:var(--on)}.st.risk{color:var(--risk)}.st.off{color:var(--off)}.st.stale,.st.none{color:var(--muted)}
.warn{display:inline-flex;gap:6px;align-items:center;color:var(--risk);font-weight:600}
.counts{display:flex;gap:18px;flex-wrap:wrap}
.panel{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:10px}
.score{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;background:var(--surface)}.score div{padding:14px 16px}.score div+div{border-left:1px solid var(--line-2)}.score b{display:block;font-size:22px;line-height:28px}.score span{font-size:13px;color:var(--muted)}
.chart{height:200px;border:1px solid var(--line);border-radius:10px;background:var(--surface);position:relative;overflow:hidden}.chart svg{position:absolute;inset:0;width:100%;height:100%}
.sheet{width:480px;max-width:100%;margin:32px auto;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:20px;display:flex;flex-direction:column;gap:14px}
.steps{display:flex;gap:18px;font-size:13px;color:var(--muted);margin-bottom:18px;flex-wrap:wrap}.steps .cur{color:var(--fg);font-weight:650}
table{border-collapse:collapse;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;font-size:14px}th{font-size:12px;color:var(--muted);text-align:left;font-weight:600;padding:10px 12px;border-bottom:1px solid var(--line)}td{padding:10px 12px;border-bottom:1px solid var(--line-2);vertical-align:top}tr:last-child td{border-bottom:0}
.sw{display:inline-flex;gap:8px;align-items:center;font-weight:600}.sw i{width:36px;height:22px;border-radius:999px;border:1.6px solid var(--fg);position:relative;flex:none}.sw i:after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:999px;background:var(--fg)}.sw.is-on i{background:var(--fg)}.sw.is-on i:after{left:17px;background:#fff}
.note{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px;margin-top:22px}
.sticky{display:flex;gap:20px;font-size:14px;color:var(--muted);border-bottom:1px solid var(--line);padding:8px 0;margin-bottom:18px;overflow:hidden;white-space:nowrap}.sticky .cur{color:var(--fg);font-weight:650}
.top,.tabbar{display:none}.phone-only{display:none}
@media (max-width:700px){
 .side{display:none}.app{display:block}main{padding:16px 16px 32px}
 .top{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--bg)}.top b{display:block}.top span{font-size:12px;color:var(--muted)}.top .f{font-weight:800;font-size:20px}.top .tf{font-size:13px;font-weight:600;color:var(--accent-text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--surface);min-height:44px;display:inline-flex;align-items:center}
 .tabbar{display:flex;margin-top:24px;background:var(--surface);border-top:1px solid var(--line);justify-content:space-around;padding:10px 0 14px;font-size:12px;font-weight:600;color:var(--muted)}.tabbar .cur{color:var(--accent-text)}
 h1{font-size:24px;line-height:30px}.head{flex-direction:column;align-items:stretch}.layout{display:block}.menu{display:none}.aside{width:auto;margin-top:24px}.facts{grid-template-columns:1fr;gap:2px 0}.facts dd{margin-bottom:10px}
 .list li{flex-wrap:wrap}.list .t{flex:1 1 60%}.list .chev{order:2}.list .r.wide{order:3;flex-basis:100%;text-align:left}.list .r.wide:empty{display:none}
 .goal .s{width:100%!important;margin-left:0!important}.goal .v{width:100%;text-align:left}.goal .v b{display:inline;margin-right:6px}.goal.d1,.goal.d2{padding-left:30px}
 .score{grid-template-columns:1fr 1fr}.score div:nth-child(3){border-left:0}.score div:nth-child(n+3){border-top:1px solid var(--line-2)}
 .tabs{gap:18px}.phone-only{display:block!important}.desk-only{display:none!important}.btn.block{width:100%}
 table.stackable thead{display:none}table.stackable td{display:block;border-bottom:0;padding:4px 12px}table.stackable tr{display:block;border-bottom:1px solid var(--line-2);padding:8px 0}
}
`;

const shape = (k) => ({
  on: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="currentColor"/></svg>',
  risk: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 1.8a5.2 5.2 0 0 0 0 10.4z" fill="currentColor"/></svg>',
  off: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  stale: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2.2"/></svg>',
  none: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="7" cy="7" r="1.6" fill="currentColor"/></svg>',
  done: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="currentColor"/><path d="M4 7.2l2 2 4-4.2" fill="none" stroke="#fff" stroke-width="1.6"/></svg>',
}[k]);
const WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', done: 'Done' };
/** A status: its shape and its word, always together. With n, a count ("3 Off track"). */
const st = (k, n) => `<span class="st ${k}">${shape(k)}${n == null ? '' : n + ' '}${n == null ? WORD[k] : WORD[k].toLowerCase()}</span>`;
/** The warning mark (a flag that isn't a status), 14 px, with its words. */
const warn = (t) => `<span class="warn"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5 13 12.5H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 6v3" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="10.8" r=".8" fill="currentColor"/></svg>${t}</span>`;
const sw = (on) => `<span class="sw ${on ? 'is-on' : ''}"><i></i>${on ? 'On' : 'Off'}</span>`;

/** One app, one navigation (docs/design/navigation). cur names the current item; sub the current saved view. */
const MAIN = ['Home', 'Check-in', 'Goals', 'Reviews'];
const LOOK = ['People', 'Metrics', 'Activity', 'Data'];
const LOWER = ['Workspace', 'Settings', 'Help', 'Feedback'];
const WHO = { amara: ['AN', 'Amara Nwosu', 'Admin'], rhea: ['RK', 'Rhea Kapoor', 'CI/CD'], tunde: ['TB', 'Tunde Bakare', 'Build &amp; Release'], oskar: ['OL', 'Oskar Lindgren', 'Developer Experience'] };
function shell({ title, cur, who = 'rhea', body, width = '', tab, counts = { 'Check-in': 5, Reviews: 1 }, views = false, bare = false }) {
  const w = WHO[who];
  const owner = who !== 'oskar' && who !== 'amara';
  const main = MAIN.filter((n) => n !== 'Check-in' || owner);
  const item = (n) => `<div class="nav ${n === cur ? 'cur' : ''}"><i></i>${n}${counts[n] && (n !== 'Check-in' || owner) ? `<span class="n">${counts[n]}</span>` : ''}</div>`;
  const tabsBar = owner ? ['Home', 'Check-in', 'Goals', 'Reviews', 'More'] : ['Home', 'Goals', 'Reviews', 'People', 'More'];
  const curTab = tab ?? (tabsBar.includes(cur) ? cur : 'More');
  const head = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style>`;
  if (bare) return `${head}<main style="padding:16px">${body}</main></html>`;
  return `${head}
<div class="top"><span class="f">F</span><div style="flex:1;min-width:0"><b>${title}</b><span>Platform Engineering · week 46</span></div><span class="tf">Find</span><span class="av">${w[0]}</span></div>
<div class="app"><nav class="side"><div class="brand">Faro</div><div class="wsname"><div><b>Platform Engineering</b><span>Example data · week 46 · Q4</span></div><span class="chev">⌄</span></div>
<div class="find"><span>Find</span><span class="kbd">/</span></div>
${main.map(item).join('')}${views && cur === 'Goals' ? views.map((v) => `<div class="nav sub ${v[1] ? 'cur' : ''}">${v[0]}</div>`).join('') : ''}
<div class="sep"></div>
${LOOK.map(item).join('')}
<div class="sep"></div><div class="nav ${cur === 'New goal' ? 'cur' : ''}"><i></i>New goal</div>
<div class="gap"></div><div class="sep"></div>
${LOWER.map(item).join('')}
<div class="me"><span class="av">${w[0]}</span><div><b>${w[1]}</b><div class="hint" style="font-size:12px">${w[2]}</div></div></div></nav>
<main><div class="page ${width}">${body}</div></main></div>
<div class="tabbar">${tabsBar.map((t) => `<span class="${t === curTab ? 'cur' : ''}">${t}</span>`).join('')}</div></html>`;
}

/** A goal row: status first (shape and word), then the title and one line of why, then the number over its gap. */
const goal = (k, title, why, value, gap, { depth = 0, wash = k === 'off', key = '' } = {}) =>
  `<li class="goal d${depth} ${wash ? 'offwash' : ''}"><span class="s">${st(k)}</span><span class="t"><b>${title}</b><span>${why}</span></span><span class="v"><b class="num">${value}</b>${gap}</span></li>`;
const person = (i, n, role, right = '') => `<li><span class="av sm">${i}</span><span class="t"><b>${n}</b><span>${role}</span></span><span class="r wide">${right}</span><span class="chev">›</span></li>`;
const note = (t) => `<p class="note">${t}</p>`;
/** The list bar (docs/design/find): search, then filters, sort and layout; the count line in words under it. */
const listBar = ({ search = 'Find', filled = '', extra = '', phone = 'Filter and sort' }) =>
  `<div class="bar"><span class="input ${filled ? 'filled' : ''}">${filled || search}</span><span class="row desk-only" style="gap:8px">${extra}</span><span class="btn phone-only">${phone}</span></div>`;

async function render(here, screens) {
  const { chromium } = require('playwright');
  const out = path.join(here, '..', 'wireframes');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, html] of Object.entries(screens)) {
    const file = path.join(here, name + '.html');
    fs.writeFileSync(file, html);
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.goto('file://' + file);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) console.warn('  scrolls sideways:', name, w);
      await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
      await page.close();
    }
  }
  await browser.close();
  console.log('Rendered', Object.keys(screens).length, 'screens at 1440 and 390 into', path.relative(process.cwd(), out));
}

module.exports = { CSS, shape, st, warn, sw, shell, goal, person, note, listBar, render, WORD };
