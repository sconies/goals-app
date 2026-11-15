// The core's extension points for feature modules (added for stage 4; see modules/ai-access/CORE-CHANGES.md).
// A module is a folder modules/<id>/ with index.mjs exporting { id, name, group, about, ... hooks }.
// The core asks isOn(id) (the workspace's modulesOff) and draws each module's parts only while it is on.
// Also here, because the core had none: Workspace's sections (About, Cycles, Access, Features, ...), the
// Features page with setModule and its read-back, and the MCP server (JSON-RPC over HTTP, bearer token).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const GROUPS = [['together', 'Working together'], ['tools', 'Tools'], ['beyond', 'Beyond this workspace']];
export const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

export async function loadModules(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, d, 'index.mjs');
    if (fs.existsSync(f)) out.push((await import(pathToFileURL(f).href)).default);
  }
  return out;
}

export function makeExt(core) {
  const { W, mods, esc, layout, notFound, wsName } = core;
  const R = () => core.getR();
  const nameOf = (id) => R().person.get(id)?.name ?? '—';
  const isOn = (id) => !(W.modulesOff || []).includes(id);
  const mod = (id) => mods.find((m) => m.id === id);
  const onMods = () => mods.filter((m) => isOn(m.id));
  const isAdmin = (v) => !!R().person.get(v)?.admin;
  const offSentence = (m) => `${m.name} is switched off in ${wsName}. An admin can switch it on in Workspace, Features.`;
  const api = { W, R, esc, layout, nameOf, isOn, isAdmin, wsName, sha256, log: core.log, newId: core.newId, bump: core.bump, notFound };

  // ---------- setModule (the core rule) ----------
  function setModule(ctx, moduleId, on, via) {
    if (!isAdmin(ctx.viewer)) return { error: 'Only admins can switch features on or off.' };
    const m = mod(moduleId);
    if (!m) return { error: `There’s no feature called ${moduleId}.` };
    const off = new Set(W.modulesOff || []);
    if (on === !off.has(moduleId)) return { ok: true, same: true, m };
    if (on) off.delete(moduleId); else off.add(moduleId);
    W.modulesOff = [...off];
    core.log(ctx, `switched ${m.name} ${on ? 'on' : 'off'}`, { entity: 'workspace', entityId: 'workspace', action: 'edited', via });
    return { ok: true, m };
  }

  // ---------- Workspace and its sections ----------
  const CORE_SECTIONS = [
    { id: '', label: 'About', admin: false },
    { id: 'cycles', label: 'Cycles', admin: false },
    { id: 'access', label: 'Access', admin: true },
    { id: 'features', label: 'Features', admin: true },
    { id: 'privacy', label: 'Privacy', admin: false },
    { id: 'removed', label: 'Recently removed', admin: false },
  ];
  function sections(viewer) {
    const list = CORE_SECTIONS.slice();
    for (const m of onMods()) for (const s of m.workspaceSections || []) {
      const i = list.findIndex((x) => x.id === s.after);
      list.splice(i < 0 ? list.length : i + 1, 0, { ...s, mod: m });
    }
    return list.filter((s) => !s.admin || isAdmin(viewer));
  }
  const sectionNav = (ctx, cur) => `<nav aria-label="More in Workspace" class="ws-sections"><h2>More in Workspace</h2><div class="rows">${sections(ctx.viewer).map((s) => `<a href="/workspace${s.id ? `/${s.id}` : ''}"${s.id === cur ? ' aria-current="page"' : ''}>${esc(s.label)}</a>`).join('')}</div></nav>`;
  const wsPage = (ctx, url, cur, body) => layout(ctx, { address: url.pathname, body: body + sectionNav(ctx, cur), narrow: true, parent: cur ? ['/workspace', 'Workspace'] : null });

  function featuresBody(ctx, url, panel = '') {
    const did = url.searchParams.get('did');
    let msg = '';
    if (did) {
      const [id, st] = did.split(':');
      const m = mod(id);
      if (m) msg = `<div class="toast" role="status"><p>${esc(m.name)} is ${st} in ${esc(wsName)}.</p><form method="post" action="/workspace/features" style="display:inline"><input type="hidden" name="module" value="${esc(id)}"><input type="hidden" name="confirm" value="1">${st === 'off' ? '<input type="hidden" name="on" value="1">' : ''}<button class="btn" type="submit">Undo</button></form></div>`;
    }
    const admin = isAdmin(ctx.viewer);
    const groups = GROUPS.map(([g, label]) => {
      const ms = mods.filter((m) => m.group === g);
      if (!ms.length) return '';
      return `<section aria-label="${esc(label)}"><h2>${esc(label)}</h2><div class="rows">${ms.map((m) => {
        const on = isOn(m.id);
        const line = on && m.featureLine ? m.featureLine(ctx, api) : '';
        return `<form method="post" action="/workspace/features" class="feature"><input type="hidden" name="module" value="${esc(m.id)}"><label style="display:flex;gap:10px;align-items:flex-start;font-weight:400"><input type="checkbox" name="on" value="1"${on ? ' checked' : ''}${admin ? '' : ' disabled'} onchange="this.form.submit()" style="width:24px;height:24px;margin-top:2px"><span><strong>${esc(m.name)}</strong> <span class="meta">${on ? 'On' : 'Off'}</span><br><span class="meta">${esc(m.about)}</span>${line ? `<br><span class="meta">${esc(line)}</span>` : ''}</span></label></form>`;
      }).join('')}</div></section>`;
    }).join('');
    return `<h1>Features</h1>${msg}${panel}<p class="sub">Goals, check-ins and people are the core and always on. ${admin ? 'Switch a part on or off for everyone here.' : 'An admin switches these.'}</p>${groups}`;
  }
  function readBackPanel(m, on, rb) {
    const verb = on ? 'on' : 'off';
    return `<section class="readback" aria-label="Before you switch ${esc(m.name)} ${verb}" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin:0 0 16px"><h2>Switch ${esc(m.name)} ${verb}?</h2>${rb.lines.map((l) => `<p>${l}</p>`).join('')}<form method="post" action="/workspace/features"><input type="hidden" name="module" value="${esc(m.id)}"><input type="hidden" name="confirm" value="1">${on ? '<input type="hidden" name="on" value="1">' : ''}<p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Switch ${verb} ${esc(m.name)}</button><a class="btn" href="/workspace/features">Cancel</a></p></form>${rb.extra || ''}</section>`;
  }

  function aboutBody(ctx) {
    const admins = W.people.filter((p) => p.admin && !p.leftAt && !p.removedAt);
    const onNames = mods.filter((m) => isOn(m.id)).map((m) => m.name);
    return `<h1>Workspace</h1><p class="sub">${esc(wsName)}: one plan for the division, checked in every week.</p><section aria-label="About"><h2>About</h2><div class="rows"><a href="/workspace/people">${W.people.length} people</a><a href="/teams">${W.teams.length} teams</a><a href="/goals?scope=all">${R().standing(ctx.moment).ws.goals.length} goals</a><a href="/workspace/access">${admins.length === 1 ? 'One admin' : `${admins.length} admins`}: ${admins.map((a) => esc(a.name)).join(', ')}</a><a href="/workspace/cycles">2026 · week ${ctx.week} of ${R().WEEKS} · check-ins due on ${R().dayLong(R().dueDay(ctx.week)).split(' ')[0]}s</a>${mods.length ? `<a href="/workspace/features">Features on: ${onNames.length ? esc(onNames.join(', ')) : 'none'}</a>` : ''}</div></section>`;
  }

  // GET /workspace[/section] -> html or null (null: the core's own fallback)
  function workspaceGet(ctx, url, P) {
    const id = P[1] || '';
    if (id === 'new') return null;
    const core = CORE_SECTIONS.find((s) => s.id === id);
    const modSec = mods.flatMap((m) => (m.workspaceSections || []).map((s) => ({ ...s, mod: m }))).find((s) => s.id === id);
    if (modSec && !isOn(modSec.mod.id)) return { code: 404, html: notFound(ctx, url, 'Page not found').replace('<p>There is nothing at this address.', `<p>${esc(offSentence(modSec.mod))}</p><p>There is nothing at this address.`) };
    if ((core?.admin || modSec?.admin) && !isAdmin(ctx.viewer)) return { code: 200, html: wsPage(ctx, url, id, `<h1>${esc((core || modSec).label)}</h1><p>Only admins see this section.</p>`) };
    if (modSec) return { code: 200, html: wsPage(ctx, url, id, modSec.render(ctx, url, api)) };
    if (!core) return id === 'people' ? null : { code: 404, html: notFound(ctx, url, 'Page not found') };
    if (id === '') return { code: 200, html: wsPage(ctx, url, '', aboutBody(ctx)) };
    if (id === 'access') {
      const admins = W.people.filter((p) => p.admin && !p.leftAt && !p.removedAt).sort((a, b) => a.name.localeCompare(b.name));
      return { code: 200, html: wsPage(ctx, url, id, `<h1>Access</h1><p class="sub">Who the admins are. An admin is made on a person’s page, and taken back there.</p><h2>Admins <span class="meta">${admins.length}</span></h2><div class="rows">${admins.map((a) => `<a href="/people/${a.id}">${esc(a.name)}${admins.length === 1 ? ' <span class="meta">· The only admin</span>' : ''}</a>`).join('')}</div>`) };
    }
    if (id === 'features') return { code: 200, html: wsPage(ctx, url, id, featuresBody(ctx, url)) };
    const words = { cycles: ['Cycles', `2026 · week ${ctx.week} of ${R().WEEKS}. Check-ins: every week.`], privacy: ['What the app records', 'The app records how it is used, never what you type.'], removed: ['Recently removed', 'Nothing removed in the last 30 days.'] }[id];
    return { code: 200, html: wsPage(ctx, url, id, `<h1>${esc(words[0])}</h1><p>${esc(words[1])}</p>`) };
  }

  // POST /workspace/features
  function featuresPost(ctx, url, f) {
    const m = mod(f.module);
    const on = f.on === '1';
    if (!m) return { code: 404, html: notFound(ctx, url) };
    if (!isAdmin(ctx.viewer)) return { code: 403, html: wsPage(ctx, url, 'features', featuresBody(ctx, url, `<p class="err" role="alert">Only admins can switch features on or off.</p>`)) };
    if (on === isOn(m.id)) return { redirect: '/workspace/features' };
    if (!f.confirm && m.readBack) {
      const rb = m.readBack(ctx, on, api);
      if (rb.asks) return { code: 200, html: wsPage(ctx, url, 'features', featuresBody(ctx, url, readBackPanel(m, on, rb))) };
    }
    const r = setModule(ctx, m.id, on, 'form');
    if (r.error) return { code: 403, html: wsPage(ctx, url, 'features', featuresBody(ctx, url, `<p class="err" role="alert">${esc(r.error)}</p>`)) };
    return { redirect: `/workspace/features?did=${m.id}:${on ? 'on' : 'off'}` };
  }

  // ---------- places on core screens ----------
  const settingsBlocks = (ctx) => onMods().flatMap((m) => (m.settingsBlocks || []).map((b) => b(ctx, api))).join('');
  const personActions = (ctx, p) => onMods().flatMap((m) => (m.personActions || []).map((b) => b(ctx, p, api))).join('');
  const hiddenHelp = () => new Set(mods.filter((m) => !isOn(m.id)).flatMap((m) => m.helpIds || []));
  function modulePost(ctx, url, P, f) {
    for (const m of mods) for (const r of m.postRoutes || []) { const out = r(ctx, url, P, f, api); if (out) return out; }
    return null;
  }
  function moduleGet(ctx, url, P) {
    for (const m of mods) for (const r of m.getRoutes || []) { const out = r(ctx, url, P, api); if (out) return out; }
    return null;
  }

  // ---------- the MCP server: JSON-RPC 2.0 over HTTP with a bearer token ----------
  const actsAs = (v) => `This token acts as ${nameOf(v)}, who ${isAdmin(v) ? 'is' : 'isn’t'} an admin.`;
  const text = (t, data = {}) => ({ content: [{ type: 'text', text: t }], structuredContent: data });
  const refuse = (t) => ({ content: [{ type: 'text', text: t }], isError: true });
  const CORE_TOOLS = [
    { name: 'get_overview', title: 'Overview of the goals', description: 'How the goals stand this week.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: (mc) => { const { ws, st } = R().standing(mc.ctx.moment); const n = {}; for (const g of ws.goals) { const s = st.get(g.id).status; n[s] = (n[s] || 0) + 1; } return text(`${ws.goals.length} goals in ${wsName}, week ${mc.ctx.week}: ${Object.entries(n).map(([k, c]) => `${c} ${k}`).join(', ')}.`, { counts: n }); } },
    { name: 'list_people', title: 'People and teams', description: 'Everyone here.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: () => { const ps = W.people.filter((p) => !p.removedAt && !p.leftAt); return text(ps.map((p) => `${p.name} (${p.id})${p.admin ? ', admin' : ''}`).join('\n'), { items: ps.map((p) => ({ id: p.id, name: p.name, admin: !!p.admin })), total: ps.length }); } },
    { name: 'add_comment', title: 'Comment on a goal', description: 'Add a comment to a goal, as the token’s person.', inputSchema: { type: 'object', additionalProperties: false, required: ['goal', 'text'], properties: { goal: { type: 'string' }, text: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: (mc, a) => { const g = R().findGoal(a.goal); if (!g) return refuse(`There’s no goal ${a.goal}.`); if (!String(a.text || '').trim()) return refuse('Say something in the comment.'); W.comments.unshift({ id: core.newId('cm'), goalId: g.id, by: mc.ctx.viewer, text: a.text, at: mc.ctx.nowIso() }); core.log(mc.ctx, `commented on ${g.title}`, { goalId: g.id, kind: 'comment', via: 'mcp' }); core.bump(); return text(`Comment added to ${g.title}.`, { goalId: g.id }); } },
    { name: 'set_feature', title: 'Switch a feature on or off', description: 'Admins: switch one of Faro’s optional features (its modules) on or off in this workspace.', inputSchema: { type: 'object', additionalProperties: false, required: ['feature', 'on'], properties: { feature: { type: 'string', description: 'The feature’s id.', enum: mods.map((m) => m.id) }, on: { type: 'boolean', description: 'true to switch it on, false to switch it off.' } } }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      run: (mc, a) => {
        if (typeof a.on !== 'boolean') return refuse('Say on: true to switch it on, or on: false to switch it off.');
        const r = setModule(mc.ctx, a.feature, a.on, 'mcp');
        if (r.error) return refuse(`${r.error} ${actsAs(mc.ctx.viewer)}`);
        const data = { on: mods.filter((m) => isOn(m.id)).map((m) => m.id), off: [...(W.modulesOff || [])] };
        const last = !a.on && r.m.lastWords ? r.m.lastWords(mc.ctx, api) : null;
        return text(last || `${r.m.name} is ${a.on ? 'on' : 'off'} in ${wsName}.`, data);
      } },
  ];
  const allTools = () => [...CORE_TOOLS.map((t) => ({ ...t, mod: null })), ...mods.flatMap((m) => (m.mcpTools || []).map((t) => ({ ...t, mod: m })))];
  const listed = (t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations });
  function checkArgs(t, a) {
    const s = t.inputSchema;
    for (const k of Object.keys(a)) if (!(s.properties || {})[k]) return `${t.name} takes no argument called ${k}.`;
    for (const k of s.required || []) if (a[k] === undefined) return `${t.name} needs ${k}.`;
    return null;
  }
  function handleOne(mc, msg) {
    const isNote = msg.id === undefined || msg.id === null;
    for (const m of mods) {
      if (!m.mcpDoor) continue;
      const shut = m.mcpDoor(mc, msg, api);
      if (shut) return isNote ? null : { jsonrpc: '2.0', id: msg.id, error: shut };
    }
    if (isNote) return null;
    mc.used = true;
    const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    if (msg.method === 'initialize') return ok({ protocolVersion: msg.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'faro', version: 'rebuild' } });
    if (msg.method === 'ping') return ok({});
    if (msg.method === 'tools/list') return ok({ tools: allTools().map(listed) });
    if (msg.method === 'tools/call') {
      const name = msg.params?.name;
      const a = msg.params?.arguments || {};
      const t = allTools().find((x) => x.name === name);
      if (!t) return ok(refuse(`There’s no tool called ${name}.`));
      if (t.mod && !isOn(t.mod.id)) return ok(refuse(`${t.mod.name} is switched off in ${wsName}, so ${name} can’t be used there. An admin can switch it on in Workspace, under Features.`));
      const bad = checkArgs(t, a);
      if (bad) return ok(refuse(bad));
      return ok(t.run(mc, a, api));
    }
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `There’s no method called ${msg.method}.` } };
  }
  // POST /api/mcp -> { code, json }
  function mcp(ctxFor, req, raw) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    const hash = m ? sha256(m[1]) : '';
    const tok = (W.tokens || []).find((t) => t.tokenHash === hash && !t.revokedAt);
    if (!tok) return { code: 401, json: { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'That token isn’t valid or has been revoked.' } } };
    let body;
    try { body = JSON.parse(raw); } catch { return { code: 400, json: { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'That isn’t JSON.' } } }; }
    const mc = { ctx: ctxFor(tok.personId), token: tok, used: false };
    const msgs = Array.isArray(body) ? body : [body];
    const out = msgs.map((x) => handleOne(mc, x)).filter(Boolean);
    if (mc.used && !mc.noUse && !tok.revokedAt) tok.lastUsedAt = mc.ctx.nowIso(); // a refused request is no use of the token
    if (!out.length) return { code: 202, json: null };
    return { code: 200, json: Array.isArray(body) ? out : out[0] };
  }

  return { isOn, mods, sections, workspaceGet, featuresPost, settingsBlocks, personActions, hiddenHelp, modulePost, moduleGet, mcp, setModule, api };
}
