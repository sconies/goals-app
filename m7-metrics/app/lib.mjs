// Shared helpers for the screens: HTML, status shapes, the shell (menu, lit item, page name, back link, Find), CSS.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };

export function shape(status, size = 14) {
  const s = size, c = s / 2, r = s / 2 - 1.5;
  const base = `width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true" class="shape shape-${status}"`;
  switch (status) {
    case 'on': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="currentColor"/></svg>`;
    case 'risk': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M${c} ${c - r} A${r} ${r} 0 0 0 ${c} ${c + r} Z" fill="currentColor"/></svg>`;
    case 'off': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
    case 'stale': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.2 2"/></svg>`;
    case 'unmeasured': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="${c}" cy="${c}" r="1.6" fill="currentColor"/></svg>`;
    case 'done': return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="currentColor"/><path d="M${c - 3} ${c} l2.2 2.2 l4 -4.4" fill="none" stroke="var(--bg)" stroke-width="1.6"/></svg>`;
    default: return `<svg ${base}><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1 2"/></svg>`;
  }
}
export const status = (code) => `<span class="status status-shape st-${code}" data-status="${code}">${shape(code)}<span class="st-word">${esc(STATUS_WORD[code] || code)}</span></span>`;
export const warnMark = `<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" class="warn"><path d="M7 1.5 L13 12.5 H1 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 5.5v3.2M7 10.3v.6" stroke="currentColor" stroke-width="1.4"/></svg>`;

const MENU_LABEL = { home: 'Home', checkin: 'Check-in', goals: 'Goals', reviews: 'Reviews', people: 'People', activity: 'Activity', data: 'Data', new: 'New goal', workspace: 'Workspace', settings: 'Settings', help: 'Help', feedback: 'Feedback', 'module:example': 'Example' };
const MENU_HREF = { home: '/', checkin: '/check-in', goals: '/goals', reviews: '/reviews', people: '/people', activity: '/activity', data: '/data', new: '/goals/new', workspace: '/workspace', settings: '/settings', help: '/help', feedback: '/feedback', 'module:example': '/example' };
const GROUP_NAMES = ['Your work', 'Look up', 'Make', 'This workspace and you'];
/** A module's menu item (core/modules.mjs): the `module:<id>` slot after People. */
export function registerMenuItem(id, label, href) { MENU_LABEL[`module:${id}`] = label; MENU_HREF[`module:${id}`] = href; }
export const menuLabel = (id) => MENU_LABEL[id];
export const menuHref = (id) => MENU_HREF[id];
export const FIRST_PAGES = new Set(['/', '/check-in', '/goals', '/reviews', '/people', '/teams', '/activity', '/data', '/workspace', '/settings', '/help', '/feedback', '/watching']);

export const CSS = `
:root{--bg:#fbfaf7;--panel:#ffffff;--ink:#17262b;--muted:#5b6a6e;--line:#e3e0d9;--accent:#1d6f6a;--on:#1f6b4a;--risk:#9a5a00;--off:#b3261e;--stale:#5b6a6e;--off-wash:#fbefed;--focus:#1d6f6a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#141a1c;--panel:#1b2326;--ink:#e8ecea;--muted:#a3b0b2;--line:#2c3739;--accent:#6cc3bb;--on:#6cc39a;--risk:#e2a54a;--off:#f08a80;--off-wash:#2a1d1c}}
*{box-sizing:border-box}html{font-size:100%}body{margin:0;background:var(--bg);color:var(--ink);font:1rem/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.app{display:flex;min-height:100vh}
.side{width:236px;flex:none;border-right:1px solid var(--line);padding:16px 12px;position:sticky;top:0;height:100vh;overflow:auto}
.side .brand{font-weight:700;font-size:1.25rem;margin:0 8px 4px}.side .ws{margin:0 8px 12px;font-size:.85rem;color:var(--muted)}
.side nav ul{list-style:none;margin:0;padding:0}.side nav ul+ul{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}
.side nav a{display:flex;justify-content:space-between;padding:8px 10px;border-radius:8px;color:var(--ink);text-decoration:none;min-height:40px;align-items:center}
.side nav a[aria-current="page"]{background:var(--panel);font-weight:600;outline:1px solid var(--line)}
.side .you{margin:12px 8px 0;font-size:.85rem;color:var(--muted)}
.count{font-size:.75rem;border:1px solid var(--line);border-radius:999px;padding:0 7px}
.findbtn{width:100%;text-align:left;margin-bottom:10px}
main{flex:1;min-width:0;padding:24px 32px 96px;max-width:1100px}
main.narrow{max-width:680px}
.topbar{display:none}
h1{font-size:1.75rem;line-height:1.2;margin:4px 0 6px}h2{font-size:1.2rem;margin:28px 0 8px}h3{font-size:1rem;margin:16px 0 6px}
.sub{color:var(--muted);margin:0 0 16px}
.back{display:inline-block;margin-bottom:4px;text-decoration:none;min-height:24px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;text-decoration:none;cursor:pointer}
.btn.primary{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600}
.btn.link{border:none;background:none;color:var(--accent);padding:0 4px;min-height:44px}
.rows{border:1px solid var(--line);border-radius:10px;background:var(--panel);margin:8px 0}
.rows>*{border-top:1px solid var(--line);padding:12px 16px;display:block}.rows>*:first-child{border-top:none}
.row-off{background:var(--off-wash)}
.status{display:inline-flex;gap:6px;align-items:center;white-space:nowrap}.st-on{color:var(--on)}.st-risk{color:var(--risk)}.st-off{color:var(--off)}.st-stale,.st-none,.st-planned,.st-unmeasured{color:var(--stale)}.st-done{color:var(--on)}
.status .st-word{font-weight:600}
.meta{color:var(--muted);font-size:.9rem}
.warn{color:var(--risk);vertical-align:-2px}
label{display:block;font-weight:600;margin:14px 0 4px}label .opt{font-weight:400;color:var(--muted)}
input[type=text],input[type=search],input[type=number],textarea,select{font:inherit;min-height:44px;width:100%;max-width:520px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink)}
textarea{min-height:88px}
.err{color:var(--off);margin:4px 0}.check{border:1px solid var(--risk);border-radius:8px;padding:10px 12px;margin:8px 0;max-width:560px}
.listbar{margin:8px 0 12px}.listbar form{display:flex;gap:8px;flex-wrap:wrap}.listbar input[type=search]{max-width:420px}
.countline{color:var(--muted);margin:6px 0}.filterline{margin:4px 0}
.goal-row{display:grid!important;grid-template-columns:150px 1fr auto;gap:4px 16px;align-items:start;text-decoration:none;color:inherit}
.goal-row .t{font-weight:600}.goal-row .m{grid-column:2}
.hero{display:flex;gap:20px;align-items:center;padding:16px 0}
.ring{width:72px;height:72px;flex:none}
.home-counts{display:flex;flex-wrap:wrap;gap:4px 16px;margin:6px 0}.home-counts a{text-decoration:none;color:var(--ink);min-height:32px;display:inline-flex;align-items:center;gap:6px}
.grid2{display:grid;grid-template-columns:1fr 360px;gap:32px}
.goal-bar{border:1px solid var(--line);border-radius:10px;padding:16px;background:var(--panel)}
.goal-bar.is-off{background:var(--off-wash)}
.bar-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.big{font-size:1.6rem;font-weight:700}
.chart{width:100%;max-width:640px;height:auto}
.tabbar{display:none}
.diffs del{color:var(--muted)}.diffs ins{text-decoration:none;font-weight:600}
dialog{border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);max-width:560px;width:calc(100% - 32px)}
dialog::backdrop{background:rgba(0,0,0,.25)}
.findres a{display:block;padding:8px 6px;text-decoration:none;color:var(--ink);border-top:1px solid var(--line)}.findres a[aria-selected="true"]{outline:2px solid var(--focus)}
.findres h3{margin:12px 0 4px;font-size:.9rem;color:var(--muted)}
.picker .chosen{display:flex;gap:8px;align-items:center}.picker ul{list-style:none;margin:4px 0;padding:0;border:1px solid var(--line);border-radius:8px;max-width:520px;background:var(--panel)}
.picker li{padding:8px 10px;cursor:pointer;min-height:44px}.picker li[aria-selected="true"]{outline:2px solid var(--focus)}
.small-caps{font-variant:small-caps;letter-spacing:.03em}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.focus{max-width:640px;margin:0 auto;padding:24px 16px 96px}
.focus .closer{display:flex;justify-content:space-between;align-items:center}
.demo{margin-top:16px;border:1px dashed var(--line);border-radius:8px;padding:8px;font-size:.85rem}
@media (max-width:760px){
 .side{display:none}.app{display:block}main{padding:12px 16px 120px}
 .topbar{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5}
 .tabbar{display:flex;position:fixed;bottom:0;left:0;right:0;background:var(--bg);border-top:1px solid var(--line);z-index:5}
 .tabbar a,.tabbar button{flex:1;text-align:center;padding:10px 0;min-height:56px;color:var(--ink);text-decoration:none;background:none;border:none;font:inherit}
 .tabbar [aria-current="page"]{font-weight:700;color:var(--accent)}
 .grid2{display:block}.goal-row{grid-template-columns:1fr}.goal-row .m{grid-column:1}
 h1{font-size:1.4rem}
}`;

// The back link, kept in the tab: each page says its name, whether it is a form, and its parent.
export const BACK_JS = `
(function(){
 var me=document.body.dataset; try{ if(sessionStorage.getItem('reloadOnShow')&&me.form!=='1'){ sessionStorage.removeItem('reloadOnShow'); var nt=(performance.getEntriesByType('navigation')[0]||{}).type; } }catch(e){}
 window.addEventListener('pageshow',function(ev){ if(ev.persisted){ try{ if(sessionStorage.getItem('reloadOnShow')){ sessionStorage.removeItem('reloadOnShow'); location.reload(); } }catch(e){} } }); var key='trail'; var t=[]; try{t=JSON.parse(sessionStorage.getItem(key)||'[]')}catch(e){}
 var here=location.pathname+location.search; var nav=(performance.getEntriesByType('navigation')[0]||{}).type;
 var at=-1; for(var i=t.length-1;i>=0;i--){ if(t[i].u===here){at=i;break;} }
 if(nav==='back_forward' && me.form==='1'){ var prev=null; try{prev=sessionStorage.getItem('trailPos')}catch(e){} var cameFromLater = prev!==null && at>=0 && Number(prev)>at; if(cameFromLater||at<0){ history.back(); } else { history.forward(); } return; }
 if(nav==='back_forward' && at>=0){ t=t.slice(0,at+1); } else if(nav==='reload' && at===t.length-1){} else { t.push({u:here,n:me.name,f:me.form==='1',p:location.pathname,g:me.group||''}); }
 if(t.length>60) t=t.slice(-60); try{sessionStorage.setItem(key,JSON.stringify(t)); sessionStorage.setItem('trailPos', String(t.length-1));}catch(e){}
 var slot=document.getElementById('backslot'); if(!slot||me.first==='1'||me.form==='1') return;
 var cur=t.length-1, target=-1;
 for(var j=cur-1;j>=0;j--){ var e=t[j]; if(e.f) continue; if(e.p===location.pathname) continue; if(me.group&&e.g===me.group) continue; target=j; break; }
 var a=document.createElement('a'); a.className='back backlink';
 if(target>=0){ var steps=cur-target; a.href=t[target].u; a.textContent='\\u2039 '+t[target].n; a.onclick=function(ev){ev.preventDefault(); history.go(-steps);}; }
 else if(me.parentHref){ a.href=me.parentHref; a.textContent='\\u2039 '+me.parentName; }
 else return;
 slot.appendChild(a);
 window.addEventListener('pageshow',function(ev){ if(ev.persisted && me.form==='1'){ } });
})();
`;

// Find from anywhere (Ctrl K) and the find-and-pick control.
export const FIND_JS = `
(function(){
 var dlg=document.getElementById('find'); if(!dlg) return; var box=dlg.querySelector('input'); var res=dlg.querySelector('.findres'); var sel=-1; var links=[];
 function open(){ if(!dlg.open) dlg.showModal(); box.value=''; draw(''); box.focus(); }
 document.querySelectorAll('[data-find]').forEach(function(b){ b.addEventListener('click',function(e){e.preventDefault(); open();}); });
 document.addEventListener('keydown',function(e){ if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); open(); } });
 var timer; box.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(function(){draw(box.value)},80); });
 box.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'){sel=Math.min(links.length-1,sel+1);mark();e.preventDefault();}
  else if(e.key==='ArrowUp'){sel=Math.max(0,sel-1);mark();e.preventDefault();}
  else if(e.key==='Enter'){ var l=links[sel<0?0:sel]; if(l){ e.preventDefault(); location.href=l.href; } }
 });
 function mark(){ links.forEach(function(l,i){ l.setAttribute('aria-selected', i===sel?'true':'false'); }); }
 function draw(q){ fetch('/api/find?q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){ if(box.value!==q) return; res.innerHTML=d.html; links=[].slice.call(res.querySelectorAll('a[data-row]')); sel=-1; mark(); }).catch(function(){ res.innerHTML='<p role="alert">Couldn’t search just now. <button type="button" class="btn">Try again</button></p>'; }); }
 dlg.querySelector('.close').addEventListener('click',function(){dlg.close()});
})();
(function(){
 document.querySelectorAll('.picker').forEach(function(p){
  var kind=p.dataset.kind, hidden=p.querySelector('input[type=hidden]'), box=p.querySelector('input[type=search]'), list=p.querySelector('ul'), chosen=p.querySelector('.chosen'), sel=-1, items=[];
  var change=p.querySelector('.change'); if(change) change.addEventListener('click',function(){ chosen.hidden=true; box.hidden=false; box.focus(); draw(''); });
  box.addEventListener('focus',function(){ draw(box.value); });
  box.addEventListener('input',function(){ draw(box.value); });
  box.addEventListener('keydown',function(e){
   if(e.key==='ArrowDown'){sel=Math.min(items.length-1,sel+1);mark();e.preventDefault();}
   else if(e.key==='ArrowUp'){sel=Math.max(0,sel-1);mark();e.preventDefault();}
   else if(e.key==='Enter'){ e.preventDefault(); var it=items[sel<0?0:sel]; if(it) pick(it); }
   else if(e.key==='Escape'){ list.hidden=true; }
  });
  function mark(){ items.forEach(function(l,i){ l.setAttribute('aria-selected', i===sel?'true':'false'); }); }
  function pick(li){ if(li.dataset.href){ location.href=li.dataset.href; return; } if(li.dataset.refuse){ var m=p.querySelector('.pickerr'); if(m) m.textContent=li.dataset.refuse; return; } hidden.value=li.dataset.id; chosen.querySelector('.name').textContent=li.dataset.label; chosen.hidden=false; box.hidden=true; list.hidden=true; hidden.dispatchEvent(new Event('change',{bubbles:true})); }
  function draw(q){ fetch('/api/pick?kind='+kind+'&q='+encodeURIComponent(q)+'&for='+encodeURIComponent(p.dataset.for||'')).then(function(r){return r.json()}).then(function(d){ if(box.value!==q) return; list.innerHTML=d.html; list.hidden=false; items=[].slice.call(list.querySelectorAll('li')); items.forEach(function(li){ li.addEventListener('click',function(){pick(li)}); }); sel=-1; mark(); var c=p.querySelector('.pickcount'); if(c) c.textContent=d.count; }); }
 });
})();
`;

export function layout(ctx, o) {
  const { R, viewer, W } = ctx;
  const owns = R.ownsToCheckIn(viewer, ctx.moment);
  const opt = { owns, reviewsOn: ctx.reviewsOn !== false, feedbackOn: ctx.feedbackOn !== false, modules: ctx.navModules || [], moduleOf: ctx.moduleOf };
  const groups = R.menuGroups(viewer, opt);
  const lit = (() => { const l = R.litItem(o.address, opt); return groups.flat().includes(l) ? l : ''; })();
  const page = o.page || R.pageName(o.address, opt);
  const me = R.person.get(viewer);
  const dueN = owns ? R.homeFor(viewer, ctx.moment).toDo.length : 0;
  const views = (ctx.views || []).filter((v) => v.pinned || v.by === viewer).slice(0, 4);
  const items = groups.map((g, i) => `<ul aria-label="${GROUP_NAMES[i]}">${g.map((id) => `<li><a href="${MENU_HREF[id]}"${lit === id ? ' aria-current="page"' : ''}><span>${MENU_LABEL[id]}</span>${id === 'checkin' && dueN ? `<span class="count" aria-label="${dueN} due">${dueN}</span>` : ''}</a>${id === 'goals' && views.length ? `<ul>${views.map((v) => `<li><a href="${esc(v.href)}">${esc(v.name)}</a></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`).join('');
  const tabs = R.phoneTabs(viewer, opt);
  const tabLit = tabs.includes(lit) ? lit : lit ? 'more' : '';
  const team = R.team.get(me?.teamId);
  const sidebar = `<aside class="side" aria-label="Menu"><div class="brand">Faro</div><div class="ws">${esc(ctx.wsName)}<br>2026 · week ${ctx.week}</div>
<button class="btn findbtn" data-find type="button">Find <span class="meta">Ctrl K</span></button>
<nav aria-label="Main">${items}</nav>
<div class="you">${esc(me?.name)}<br>${me?.admin ? `Admin · ${esc(team?.name)}` : esc(team?.name)}</div>
<div class="demo"><strong>Demo</strong> · <a href="/demo">Switch person</a></div></aside>`;
  const tabbar = `<nav class="tabbar" aria-label="Tabs">${tabs.map((id) => `<a href="${MENU_HREF[id]}"${tabLit === id ? ' aria-current="page"' : ''}>${MENU_LABEL[id]}</a>`).join('')}<a href="/more"${tabLit === 'more' ? ' aria-current="page"' : ''}>More</a></nav>`;
  const top = `<header class="topbar"><strong>${esc(String(page).split(' · ')[0])}</strong><button class="btn" data-find type="button">Find</button></header>`;
  const findDlg = `<dialog id="find" aria-label="Find"><div class="focus" style="padding:8px"><div class="closer"><strong>Find</strong><button type="button" class="btn close">Close</button></div><input type="search" aria-label="Find a goal, a person or a team" placeholder="A name, a few words or a goal’s key"><div class="findres"></div></div></dialog>`;
  const data = `data-name="${esc(o.navName || page)}" data-form="${o.form ? 1 : 0}" data-first="${FIRST_PAGES.has(o.address.split('?')[0]) ? 1 : 0}"${o.parent ? ` data-parent-href="${esc(o.parent[0])}" data-parent-name="${esc(o.parent[1])}"` : ''}${o.group ? ` data-group="${esc(o.group)}"` : ''}`;
  const head = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(page)} · ${esc(ctx.wsName)} · Faro</title><style>${CSS}</style></head>`;
  if (o.form) {
    return `${head}<body ${data}><main class="focus" id="main">${o.body}</main><script>${BACK_JS}</script><script>${FIND_JS}</script></body></html>`;
  }
  return `${head}<body ${data}><a href="#main" class="back" style="position:absolute;left:-999px">Skip to content</a><div class="app">${sidebar}<div style="flex:1;min-width:0">${top}<main id="main" class="${o.narrow ? 'narrow' : ''}"><div id="backslot"></div>${o.body}</main></div></div>${tabbar}${findDlg}<script>${BACK_JS}</script><script>${FIND_JS}</script></body></html>`;
}

export function picker(name, kind, value, label, opt = {}) {
  return `<div class="picker" data-kind="${kind}"${opt.for ? ` data-for="${esc(opt.for)}"` : ''}><input type="hidden" name="${name}" value="${esc(value || '')}">
<div class="chosen"${value ? '' : ' hidden'}><span class="name">${esc(label || '')}</span> <button type="button" class="btn link change">Change</button></div>
<input type="search"${opt.id ? ` id="${opt.id}"` : ''} aria-label="${esc(opt.aria || 'Find')}" placeholder="Type a name"${value ? ' hidden' : ''} autocomplete="off"><span class="pickcount meta" aria-live="polite"></span><ul role="listbox" hidden></ul><p class="pickerr err" role="alert"></p></div>`;
}
