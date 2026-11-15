// The AI access module: registers into the core's extension points (app/modules.mjs).
import crypto from 'node:crypto';
import { ID, NAME, createToken, revokeToken, aiAccessAsks, aiAccessReadBack, aiAccessOffLines, aiAccessOnLines, featureLine, door, lastWords, makeOff, plain } from './rules.mjs';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function secret() { let s = 'gk_'; while (s.length < 43) { const b = crypto.randomBytes(1)[0]; if (b < 248) s += ABC[b % 62]; } return s; }
const tokId = () => `tok_${crypto.randomBytes(8).toString('hex')}`;
const bold = (esc, l) => esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const tokensOf = (W) => (W.tokens = W.tokens || []);

// Make one: the rule, then the secret, kept only as its hash. Gives { secret, token } or { error }.
function make(ctx, api, personId, name) {
  const r = createToken(api.W, ctx.viewer, { personId, name }, { off: !api.isOn(ID), ws: api.wsName, id: tokId(), at: ctx.nowIso() });
  if (r.error) return r;
  const s = secret();
  const t = { ...r.token, tokenHash: api.sha256(s) };
  tokensOf(api.W).push(t);
  api.log(ctx, `made an MCP token “${t.name}” for ${api.nameOf(t.personId)}`, { entity: 'person', entityId: t.personId, action: 'created', via: ctx.via });
  return { secret: s, token: t };
}
function revoke(ctx, api, tokenId) {
  const r = revokeToken(api.W, ctx.viewer, tokenId);
  if (r.error || r.same) return r;
  r.token.revokedAt = ctx.nowIso();
  api.log(ctx, `revoked the MCP token “${r.token.name}” of ${api.nameOf(r.token.personId)}`, { entity: 'person', entityId: r.token.personId, action: 'removed', via: ctx.via });
  return r;
}

function tokenRow(ctx, api, t, { who = true } = {}) {
  const { esc } = api;
  const label = t.builder ? ' <span class="meta">· Builder token, made before the inbox opened</span>' : '';
  const state = t.revokedAt ? `<span class="meta">Revoked ${day(t.revokedAt)}</span>` : `<form method="post" action="/workspace/ai/revoke" style="display:inline"><input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="back" value="${esc(ctx.address || '/workspace/ai')}"><button class="btn" type="submit" aria-label="Revoke ${esc(t.name)}">Revoke</button></form>`;
  return `<div class="token"><p><strong>${esc(t.name)}</strong>${label}<br><span class="meta">${who ? `Acts as ${esc(api.nameOf(t.personId))} · ` : ''}made ${day(t.createdAt)} by ${esc(api.nameOf(t.createdBy))} · ${t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : 'not used yet'}</span></p>${state}</div>`;
}

function makeDialog(ctx, url, api, err = '') {
  const { esc, W } = api;
  const p = url.searchParams;
  const who = api.R().person.get(p.get('who') || '') ? p.get('who') : ctx.viewer;
  const name = p.get('name') || '';
  const people = W.people.filter((x) => !x.leftAt && !x.removedAt).sort((a, b) => a.name.localeCompare(b.name));
  const picking = p.get('pick') === '1';
  const pick = picking ? `<label for="who-q">Find someone</label><input type="search" id="who-q" placeholder="A name" oninput="var q=this.value.toLowerCase();document.querySelectorAll('[role=option]').forEach(function(o){o.hidden=q&&o.textContent.toLowerCase().indexOf(q)<0})"><div role="listbox" aria-label="People" style="max-height:40vh;overflow:auto">${people.map((x) => `<a role="option" aria-selected="${x.id === who}" href="/workspace/ai?make=1&who=${x.id}" style="display:block;padding:10px 4px">${esc(x.name)}</a>`).join('')}</div>` : `<p><button class="btn" type="button" onclick="location.href='/workspace/ai?make=1&pick=1&who=${esc(who)}'">Who it acts as: ${esc(api.nameOf(who))} · Change</button></p>`;
  return `<dialog open aria-label="Make a token" style="position:fixed;inset:0;margin:auto;z-index:20"><h2>Make a token</h2><p class="meta">It lets an AI tool act as one person here, with exactly their rights.</p>${pick}<form method="post" action="/workspace/ai/make"><input type="hidden" name="who" value="${esc(who)}"><label for="tok-name">What it’s for</label><input type="text" id="tok-name" name="name" maxlength="120" value="${esc(name)}" placeholder="Claude on Mateo’s laptop" oninput="document.getElementById('tok-go').disabled=this.value.trim().length<2">${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}<p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="tok-go" type="submit"${name.trim().length < 2 ? ' disabled' : ''}>Make the token</button><a class="btn" href="/workspace/ai">Cancel</a></p></form></dialog>`;
}
function shownOnce(api, made, host) {
  const { esc } = api;
  return `<dialog open aria-label="Your new token" style="position:fixed;inset:0;margin:auto;z-index:20"><h2>The token for ${esc(api.nameOf(made.token.personId))}</h2><p>Copy it now: it isn’t shown again. Only its hash is kept.</p><p><code style="word-break:break-all">${esc(made.secret)}</code></p><p class="meta">Add it to Claude Code:</p><p><code style="word-break:break-all">claude mcp add --transport http faro ${esc(host)}/api/mcp --header "Authorization: Bearer ${esc(made.secret)}"</code></p><p><a class="btn primary" role="button" href="/workspace/ai">Done</a></p></dialog>`;
}

function section(ctx, url, api, extra = '') {
  const { esc, W } = api;
  ctx.address = '/workspace/ai';
  const toks = tokensOf(W).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const did = url.searchParams.get('did');
  const msg = did ? `<p role="status" class="toast">${esc(did)}</p>` : '';
  const dlg = url.searchParams.get('make') === '1' ? makeDialog(ctx, url, api) : '';
  return `<h1>AI access</h1><p class="sub">The MCP tokens that let an AI tool act as someone here. Each acts as one person, with exactly their rights; every change it makes is logged as theirs, “via MCP”.</p>${msg}<p><a class="btn primary" role="button" href="/workspace/ai?make=1">Make a token</a></p><h2>Tokens <span class="meta">${toks.filter((t) => !t.revokedAt).length} in use</span></h2><div class="rows">${toks.map((t) => tokenRow(ctx, api, t)).join('') || '<p class="meta">No tokens yet.</p>'}</div>${dlg}${extra}`;
}

export default {
  id: ID,
  name: NAME,
  group: 'beyond',
  about: 'Let Claude or another AI tool read and act here through MCP, as one person, with that person’s rights.',
  helpIds: ['ai-access', 'mcp-access'],
  workspaceSections: [{ id: 'ai', label: 'AI access', after: 'access', admin: true, render: (ctx, url, api) => section(ctx, url, api) }],
  featureLine: (ctx, api) => featureLine(api.W),
  readBack: (ctx, on, api) => {
    ctx.address = '/workspace/features';
    const live = aiAccessReadBack(api.W).tokens;
    return { asks: aiAccessAsks(api.W), lines: (on ? aiAccessOnLines : aiAccessOffLines)(api.W, api.nameOf).map((l) => bold(api.esc, l)), extra: `<details><summary class="btn">See the tokens</summary><div class="rows">${live.map((t) => tokenRow(ctx, api, t)).join('')}</div></details>` };
  },
  lastWords: (ctx, api) => lastWords(api.wsName),
  settingsBlocks: [(ctx, api) => {
    const mine = tokensOf(api.W).filter((t) => t.personId === ctx.viewer);
    ctx.address = '/settings';
    return `<section aria-label="Your MCP tokens" id="tokens"><h2>Your MCP tokens</h2><p class="meta">The tokens that act as you. An admin makes them, on Workspace, AI access or from your page; you can revoke yours.</p><div class="rows">${mine.map((t) => tokenRow(ctx, api, t, { who: false })).join('') || '<p class="meta">No token acts as you.</p>'}</div></section>`;
  }],
  personActions: [(ctx, p, api) => (api.isAdmin(ctx.viewer) && !p.leftAt && !p.removedAt ? `<p><a class="btn" role="button" href="/workspace/ai?make=1&who=${api.esc(p.id)}">Make an MCP token</a></p>` : '')],
  postRoutes: [(ctx, url, P, f, api) => {
    if (P[0] !== 'workspace' || P[1] !== 'ai') return null;
    if (P[2] === 'make') {
      const r = make({ ...ctx, via: 'form' }, api, f.who, f.name);
      if (r.error) {
        const u = new URL(`/workspace/ai?make=1&who=${encodeURIComponent(f.who || '')}&name=${encodeURIComponent(f.name || '')}`, 'http://x');
        if (!api.isOn(ID)) return { code: 403, html: api.layout(ctx, { address: '/workspace/ai', narrow: true, body: `<h1>AI access</h1><p class="err" role="alert">${api.esc(r.error)}</p>` }) };
        return { code: 400, html: api.layout(ctx, { address: '/workspace/ai', narrow: true, body: section(ctx, new URL('/workspace/ai', 'http://x'), api).replace(/<dialog[\s\S]*<\/dialog>/, '') + makeDialog(ctx, u, api, r.error) }) };
      }
      return { code: 200, html: api.layout(ctx, { address: '/workspace/ai', narrow: true, body: section(ctx, new URL('/workspace/ai', 'http://x'), api, shownOnce(api, r, ctx.host || 'http://localhost:4173')) }) };
    }
    if (P[2] === 'revoke') {
      const r = revoke({ ...ctx, via: 'form' }, api, f.id);
      if (r.error) return { code: 403, html: api.layout(ctx, { address: '/workspace/ai', narrow: true, body: `<h1>AI access</h1><p class="err" role="alert">${api.esc(r.error)}</p>` }) };
      const back = /^\/(settings|workspace\/ai|workspace\/features)$/.test(f.back || '') ? f.back : '/workspace/ai';
      if (back === '/settings') return { redirect: '/settings#tokens' };
      if (back === '/workspace/features') return { redirect: '/workspace/features' };
      return { redirect: `/workspace/ai?did=${encodeURIComponent(`Revoked “${r.token.name}”.`)}` };
    }
    return null;
  }],
  getRoutes: [(ctx, url, P, api) => (P[0] === '__tokens' ? { json: tokensOf(api.W).map(({ tokenHash, ...t }) => ({ ...t, hashed: /^[0-9a-f]{64}$/.test(tokenHash || '') })) } : null)],
  mcpDoor: (mc, msg, api) => {
    const shut = door(!api.isOn(ID), msg.method, api.wsName);
    if (!api.isOn(ID)) mc.noUse = true;
    return shut;
  },
  mcpTools: [
    { name: 'list_tokens', title: 'AI assistant tokens', description: 'Tokens that let an AI assistant act as someone: every live one for an admin, otherwise your own. Never the token itself.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: (mc, a, api) => { const v = mc.ctx.viewer; const ts = tokensOf(api.W).filter((t) => !t.revokedAt && (api.isAdmin(v) || t.personId === v)); return { content: [{ type: 'text', text: ts.length ? ts.map((t) => `${t.id}: “${t.name}”, acts as ${api.nameOf(t.personId)}, ${t.lastUsedAt ? `last used ${t.lastUsedAt.slice(0, 10)}` : 'not used yet'}`).join('\n') : 'No live tokens.' }], structuredContent: { items: ts.map(({ tokenHash, ...t }) => t), total: ts.length } }; } },
    { name: 'create_token', title: 'Make an MCP token', description: 'Admins: make a personal MCP token, so an AI tool can act as someone (with exactly their rights). The token is returned once; only its hash is kept. Give it to that person privately.', inputSchema: { type: 'object', additionalProperties: false, required: ['person', 'name'], properties: { person: { type: 'string', description: 'Who it acts as (name or ID).' }, name: { type: 'string', description: 'What it’s for, e.g. "Claude on Maya’s laptop".' } } }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: (mc, a, api) => {
        const q = String(a.person).trim().toLowerCase();
        const p = api.W.people.find((x) => !x.removedAt && (x.id === a.person || x.name.toLowerCase() === q));
        if (!p) return { content: [{ type: 'text', text: `There’s no one called ${a.person} in this workspace. Use list_people.` }], isError: true };
        const r = make({ ...mc.ctx, via: 'mcp' }, api, p.id, a.name);
        if (r.error) return { content: [{ type: 'text', text: `${r.error} This token acts as ${api.nameOf(mc.ctx.viewer)}, who ${api.isAdmin(mc.ctx.viewer) ? 'is' : 'isn’t'} an admin.` }], isError: true };
        return { content: [{ type: 'text', text: `Made “${r.token.name}” for ${p.name}. The token, shown once: ${r.secret}` }], structuredContent: { token: r.secret } };
      } },
    { name: 'revoke_token', title: 'Revoke a token', description: 'Stop a token working: an admin, or the token’s person. Revoking the token this assistant uses ends its access.', inputSchema: { type: 'object', additionalProperties: false, required: ['token_id'], properties: { token_id: { type: 'string', description: 'The token’s ID, from list_tokens.' } } }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      run: (mc, a, api) => {
        const r = revoke({ ...mc.ctx, via: 'mcp' }, api, a.token_id);
        if (r.error) return { content: [{ type: 'text', text: `${r.error} This token acts as ${api.nameOf(mc.ctx.viewer)}, who ${api.isAdmin(mc.ctx.viewer) ? 'is' : 'isn’t'} an admin.` }], isError: true };
        return { content: [{ type: 'text', text: r.same ? `“${r.token.name}” was already revoked.` : `Revoked “${r.token.name}”.${r.token.id === mc.token.id ? ' This connection stops working now.' : ''}` }], structuredContent: {} };
      } },
  ],
  _rules: { makeOff, plain },
};
