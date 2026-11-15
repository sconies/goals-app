// Markup helpers, the look (spec/core/design-rules.md) and the navigation shell.
import { menuGroups, phoneTabs, litItem, litTab, docTitle, GROUP_NAMES } from '../s3/navigation.mjs';
import { STATUS_WORD } from '../s3/finding.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Status: always a shape and a word together.
export function shape(status) {
  const s = 14, c = 7, r = 5.5;
  const svg = (inner) => `<svg class="shape" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true" focusable="false">${inner}</svg>`;
  switch (status) {
    case 'on': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="var(--on)"/>`);
    case 'risk': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--risk)" stroke-width="1.5"/><path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="var(--risk)"/>`);
    case 'off': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--off)" stroke-width="2"/>`);
    case 'stale': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="2.2 1.8"/>`);
    case 'unmeasured': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--muted)" stroke-width="1.5"/><circle cx="7" cy="7" r="1.6" fill="var(--muted)"/>`);
    case 'done': return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="var(--ink)"/><path d="M4.4 7.2 6.3 9 9.8 5.2" fill="none" stroke="var(--bg)" stroke-width="1.6"/>`);
    default: return svg(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="1 1.6"/>`);
  }
}
export const statusTag = (status) => `<span class="status" data-status="${esc(status)}">${shape(status)}<span class="sw">${esc(STATUS_WORD[status] ?? status)}</span></span>`;
export const warnMark = '<svg class="warn" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5 13 12.5H1Z" fill="none" stroke="var(--risk)" stroke-width="1.4"/><path d="M7 5.5v3.4M7 10.3v.6" stroke="var(--risk)" stroke-width="1.4"/></svg>';

export const CSS = `
:root{--bg:#fbfaf7;--ink:#1d1f22;--muted:#6a6f76;--line:#e3e0d8;--on:#2f7d4f;--risk:#b7791f;--off:#b3412f;--off-wash:#fbefec;--accent:#24507a;--side:#f3f1ec}
@media (prefers-color-scheme: dark){:root{--bg:#16181b;--ink:#ecebe7;--muted:#a3a7ad;--line:#2d3035;--on:#5fb884;--risk:#e0a64b;--off:#ef7f6b;--off-wash:#2b1d1a;--accent:#8db7e0;--side:#1d2024}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}h1{font-size:1.6rem;line-height:1.25;margin:.2rem 0 .6rem}h2{font-size:1.15rem;margin:1.6rem 0 .5rem}h3{font-size:1rem;margin:1.2rem 0 .3rem}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--bg);padding:6px}
.app{display:flex;min-height:100vh}.side{width:232px;flex:none;background:var(--side);padding:16px 12px;position:sticky;top:0;height:100vh;overflow:auto}
.side .brand{font-weight:700;font-size:1.2rem;margin:0 8px 12px;display:block;text-decoration:none;color:var(--ink)}
.side ul{list-style:none;margin:0;padding:6px 0;border-top:1px solid var(--line)}.side ul:first-of-type{border-top:0}
.side a.item{display:flex;justify-content:space-between;padding:7px 10px;border-radius:6px;text-decoration:none;color:var(--ink);min-height:36px;align-items:center}
.side a.item[aria-current=page]{background:var(--bg);outline:1px solid var(--line);font-weight:600}
.side .you{margin-top:12px;padding:8px 10px;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
.findbtn{display:block;width:100%;text-align:left;margin:0 0 8px;min-height:40px}
main{flex:1;min-width:0;padding:20px 28px 96px;max-width:1040px}main.wide{max-width:1760px}main.narrow{max-width:640px}
.top{display:flex;align-items:center;gap:12px;min-height:28px}.back{text-decoration:none;font-size:.95rem}
.tabbar{display:none}
button,.btn{font:inherit;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:6px;padding:8px 14px;min-height:44px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
button.primary,.btn.primary{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600}
button.plain,.btn.plain{border:0;background:none;color:var(--accent);padding:6px 4px;min-height:36px}
input,select,textarea{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px 10px;min-height:44px;max-width:100%}
label{display:block;margin:.6rem 0 .2rem}label.inline{display:inline-flex;gap:8px;align-items:center;margin:0}
.rows{list-style:none;margin:0;padding:0}.rows>li{border-top:1px solid var(--line);padding:10px 2px}.rows>li:last-child{border-bottom:1px solid var(--line)}
.row-off{background:var(--off-wash)}
.status{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.shape{flex:none}.sw{font-size:.92rem}
.gkey{color:var(--muted);font-size:.9rem}.quiet{color:var(--muted)}.lede{color:var(--muted);margin-top:0}
.hero{padding:14px 0 18px;border-bottom:1px solid var(--line)}.eyebrow{color:var(--muted);font-size:.92rem;margin:0}.hero .big{font-size:1.5rem;font-weight:650;margin:.2rem 0 .7rem}
.ring{width:56px;height:56px;float:right}
.toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:8px;display:flex;gap:12px;align-items:center;z-index:5}
.toast button{background:none;color:var(--bg);border-color:var(--bg);min-height:36px}
.msg-error{color:var(--off)}.field-error{color:var(--off);font-size:.92rem;margin:.2rem 0}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.listbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.listbar input[type=search]{flex:1;min-width:180px}
.countline,.filterline{color:var(--muted);margin:.3rem 0}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:8px 0}.tabs a{padding:8px 12px;text-decoration:none;color:var(--ink);min-height:44px;display:inline-flex;align-items:center}.tabs a[aria-current=page]{font-weight:700;outline:1px solid var(--line);border-radius:6px 6px 0 0}
dialog{border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);width:min(640px,94vw);padding:16px}
dialog [role=option]{display:block;padding:8px 6px;text-decoration:none;color:var(--ink);border-radius:6px}dialog [role=option][aria-selected=true]{outline:2px solid var(--accent)}
.facts{list-style:none;padding:0;margin:0}.facts li{padding:6px 0;border-top:1px solid var(--line)}
.mod-part{margin:12px 0}.sheet{border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.chart{width:100%;max-width:560px;height:auto}
.more-list a{display:block;padding:10px 4px;min-height:44px}
@media (max-width: 899px){.side{display:none}main{padding:12px 16px 110px}
 .tabbar{display:flex;position:fixed;bottom:0;left:0;right:0;background:var(--side);border-top:1px solid var(--line);z-index:4}
 .tabbar a{flex:1;text-align:center;padding:10px 0;min-height:56px;text-decoration:none;color:var(--ink);font-size:.85rem;display:flex;align-items:center;justify-content:center}
 .tabbar a[aria-current=page]{font-weight:700}.phone-find{display:inline-flex}}
@media (min-width: 900px){.phone-only{display:none}}
`;

const ITEM_LABEL = { home: 'Home', checkin: 'Check-in', goals: 'Goals', reviews: 'Reviews', people: 'People', activity: 'Activity', data: 'Data', new: 'New goal', workspace: 'Workspace', settings: 'Settings', help: 'Help', feedback: 'Feedback', more: 'More' };
const ITEM_TO = { home: '/', checkin: '/check-in', goals: '/goals', reviews: '/reviews', people: '/people', activity: '/activity', data: '/data', new: '/goals/new', workspace: '/workspace', settings: '/settings', help: '/help', feedback: '/feedback', more: '/more' };
export const itemLabel = (id, mods) => (id.startsWith('module:') ? mods.find((m) => `module:${m.id}` === id)?.label : ITEM_LABEL[id]);
export const itemTo = (id, mods) => (id.startsWith('module:') ? mods.find((m) => `module:${m.id}` === id)?.to : ITEM_TO[id]);

const CLIENT = `
(function(){
const dlg=document.getElementById('find');const box=dlg&&dlg.querySelector('[role=combobox]');const out=dlg&&dlg.querySelector('.find-out');let sel=-1;
function opts(){return [...out.querySelectorAll('[role=option]')]}
function mark(){opts().forEach((o,i)=>o.setAttribute('aria-selected',i===sel?'true':'false'))}
let seq=0;async function run(){const q=box.value;const n=++seq;const r=await fetch('/api/find?q='+encodeURIComponent(q));const t=await r.text();if(n!==seq)return;out.innerHTML=t;sel=opts().length?0:-1;mark()}
function openFind(){if(!dlg)return;dlg.showModal();box.value='';run();box.focus()}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openFind()}});
document.querySelectorAll('[data-open-find]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();openFind()}));
if(box){box.addEventListener('input',run);box.addEventListener('keydown',e=>{const os=opts();if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(os.length-1,sel+1);mark()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);mark()}else if(e.key==='Enter'){e.preventDefault();const o=os[sel>=0?sel:0];if(o)location.href=o.getAttribute('href')}else if(e.key==='Escape'){dlg.close()}})}
document.querySelectorAll('form[data-confirm-leave]').forEach(f=>{let dirty=false;f.addEventListener('input',()=>dirty=true);f.querySelectorAll('[data-close]').forEach(a=>a.addEventListener('click',e=>{if(dirty&&!confirm('Throw away what you typed?'))e.preventDefault()}))});
document.querySelectorAll('form[data-once]').forEach(f=>f.addEventListener('submit',e=>{if(f.dataset.sent){e.preventDefault();return}f.dataset.sent='1'}));
const t=document.querySelector('.toast');if(t)setTimeout(()=>t.remove(),10000);
// The tab's own history: the back link names the last earlier page that isn't a form or this page, and goes back that many entries.
(function(){const mn=document.getElementById('main');if(!mn)return;let st=[],pos=-1;try{st=JSON.parse(sessionStorage.getItem('tab')||'[]');pos=+(sessionStorage.getItem('pos')??-1)}catch(e){}
const here=location.pathname+location.search;const nav=(performance.getEntriesByType('navigation')[0]||{}).type;const me={a:here,n:mn.dataset.label,f:mn.dataset.form==='1'};
const last=+(sessionStorage.getItem('lastPos')??-1);
if(nav==='back_forward'){let i=-1;for(let k=Math.min(pos,st.length-1);k>=0;k--)if(st[k].a===here){i=k;break}if(i<0)for(let k=pos+1;k<st.length;k++)if(st[k].a===here){i=k;break}if(i>=0){pos=i}else{st=st.slice(0,pos+1);st.push(me);pos=st.length-1}
 if(me.f&&pos<last&&pos>0){sessionStorage.setItem('pos',String(pos));sessionStorage.setItem('lastPos',String(pos));history.go(-1);return}}
else if(nav==='reload'&&st[pos]&&st[pos].a===here){}else{st=st.slice(0,pos+1);st.push(me);pos=st.length-1}
st[pos]=me;sessionStorage.setItem('tab',JSON.stringify(st.slice(-50)));sessionStorage.setItem('pos',String(pos));sessionStorage.setItem('lastPos',String(pos));
const a=document.querySelector('a.backlink');if(!a)return;const same=(x)=>x.a.split('?')[0]===here.split('?')[0];
for(let k=pos-1;k>=0;k--){const e=st[k];if(e.f||same(e))continue;const n=pos-k;a.textContent='‹ '+e.n;a.setAttribute('aria-label','Back to '+e.n);a.dataset.back=String(n);a.href=e.a;break}
a.addEventListener('click',ev=>{const n=+a.dataset.back;if(n){ev.preventDefault();history.go(-n)}})})();
document.querySelectorAll('form[data-save-back]').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();await fetch(f.action,{method:'POST',body:new URLSearchParams(new FormData(f))});history.back()}));
})();`;

// The shell: menu, tabs, title, back link, Find, the message with Undo.
export function page({ title, page: pageNameText, body, ctx, wide = false, narrow = false, focused = false, back = null, status = 200 }) {
  const { navOpts, address, mods, wsName, viewerName, viewerLine, flash } = ctx;
  const groups = menuGroups(navOpts);
  const lit = litItem(address, navOpts, ctx.views || []);
  const tabLit = litTab(address, navOpts);
  const counts = ctx.menuCounts || {};
  const menu = groups.map((g, i) => `<ul aria-label="${GROUP_NAMES[i]}">${g.map((id) => `<li><a class="item" href="${esc(itemTo(id, mods))}"${lit === id ? ' aria-current="page"' : ''}><span>${esc(itemLabel(id, mods))}</span>${counts[id] ? `<span class="count">${counts[id]}</span>` : ''}</a></li>`).join('')}${i === 0 ? (ctx.views || []).slice(0, 4).map((v) => `<li><a class="item sub" href="${esc(v.address)}"${lit === `view:${v.id}` ? ' aria-current="page"' : ''}>${esc(v.name)}</a></li>`).join('') : ''}</ul>`).join('');
  const tabs = [...phoneTabs(navOpts), 'more'].map((id) => `<a href="${esc(itemTo(id, mods))}"${tabLit === id ? ' aria-current="page"' : ''}>${esc(itemLabel(id, mods))}</a>`).join('');
  const backLink = back ? `<a class="back backlink" href="${esc(back.to || '#')}" aria-label="Back to ${esc(back.label)}" data-parent="${esc(back.to || '')}" data-parent-label="${esc(back.label)}">‹ ${esc(back.label)}</a>` : '';
  const toast = flash ? `<div class="toast" role="status"><span>${esc(flash.message)}</span>${flash.undo ? `<form method="post" action="/undo"><input type="hidden" name="id" value="${esc(flash.undo)}"><button type="submit">Undo</button></form>` : ''}</div>` : '';
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(docTitle(title, wsName))}</title><style>${CSS}</style></head>
<body><a class="skip" href="#main">Skip to the page</a><div class="app">
${focused ? '' : `<nav class="side" aria-label="Menu"><a class="brand" href="/">Faro</a><button class="findbtn" type="button" data-open-find aria-keyshortcuts="Control+K">Find</button>${menu}<div class="you">${esc(viewerName)}<br>${esc(viewerLine)}</div></nav>`}
<main id="main" data-form="${ctx.isForm ? '1' : ''}" data-first="${ctx.isFirst ? '1' : ''}" data-page="${esc(title)}" data-label="${esc(ctx.placeLabel || title)}" class="${wide ? 'wide' : narrow || focused ? 'narrow' : ''}"><div class="top">${backLink}${focused ? '' : '<button class="plain phone-only phone-find" type="button" data-open-find>Find</button>'}</div>
${body}</main></div>
${focused ? '' : `<nav class="tabbar" aria-label="Tabs">${tabs}</nav>`}
<dialog id="find" aria-label="Find"><label for="findq">Find goals, people and teams</label><input id="findq" role="combobox" aria-expanded="true" aria-controls="findout" autocomplete="off" placeholder="A name, a key like G-48, or a few words"><div id="findout" class="find-out" role="listbox" aria-label="Results"></div><p><button type="button" onclick="this.closest('dialog').close()">Close</button></p></dialog>
${toast}<script>${CLIENT}</script></body></html>`;
  return { status, html };
}
