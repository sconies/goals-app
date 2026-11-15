// The AI access module (spec/rebuild/stage-4-module-ai-access.md): personal MCP tokens, their screens and AI tools,
// and the switch. It registers into the core's module platform; the core never names it, except the door and
// set_feature's last words, which the kit keeps as the core's (module-platform.md, "The AI tools' server and its door").
import fs from 'node:fs';
import path from 'node:path';
import * as R from './rules.mjs';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const kitDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../spec');
const at = (app) => app.now || app.W.builtFor;
const person = (app, id) => app.W.people.find((p) => p.id === id);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

// The secret is shown once: kept here, in memory, until the maker's next page draws it.
const fresh = new Map();

// Its Help article, from the kit's guide (spec/core/help-guide.md, "AI access", `ai`).
function guideArticle() {
  const guide = fs.readFileSync(path.join(kitDir, 'core/help-guide.md'), 'utf8');
  const part = guide.split(/\n### /).find((x) => x.startsWith('AI access\n')) || '';
  const body = part.split('\n').slice(1).join('\n').replace(/^`ai`[^\n]*\n/m, '').replace(/^Routes:.*$/m, '').split(/\n## /)[0].trim();
  return { id: 'ai', after: 'workspace-access', title: 'AI access', body };
}

const tokenRow = (app, t, { back, mine = false } = {}) => {
  const p = person(app, t.personId);
  const used = t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : 'not used yet';
  const state = t.revokedAt
    ? `<span class="state"><span class="shape" aria-hidden="true">■</span> Revoked ${day(t.revokedAt)}</span>`
    : `<form method="post" action="/act/ai.revokeToken" class="inline"><input type="hidden" name="tokenId" value="${h(t.id)}">${back ? `<input type="hidden" name="back" value="${h(back)}">` : ''}<button aria-label="Revoke ${h(t.name)}">Revoke</button></form>`;
  return `<li class="token" data-token="${h(t.id)}"><span class="tname">${h(t.name)}${t.builder ? ' <span class="tag">builder token</span>' : ''}</span> <span class="tline">${mine ? '' : `acts as ${h(p?.name)} · `}made ${day(t.createdAt)} · ${used}</span> ${state}</li>`;
};

function freshDialog(viewer) {
  const f = fresh.get(viewer.id);
  if (!f) return '';
  fresh.delete(viewer.id);
  return `<dialog id="new-token" aria-label="Your new token"><h2>The token for “${h(f.name)}”</h2>
    <p>Copy it now: it isn’t shown again. Give it to ${h(f.personName)} privately.</p>
    <label>Token <input readonly aria-label="Token" value="${h(f.secret)}"></label>
    <label>Claude Code command <input readonly aria-label="Claude Code command" data-mcp-command="${h(f.secret)}" value=""></label>
    <button type="button" class="primary" data-close-dialog>Done</button></dialog>
    <script>{const d=document.getElementById('new-token');const c=d.querySelector('[data-mcp-command]');c.value='claude mcp add --transport http faro '+location.origin+'/api/mcp --header "Authorization: Bearer '+c.dataset.mcpCommand+'"';d.addEventListener('close',()=>d.remove());d.showModal();}</script>`;
}

// the Make a token dialog: who it acts as (find-and-pick), what it's for; Make the token waits for both
function makeDialog(app, viewer, { id = 'make-token', fixed = null, back }) {
  const who = fixed || viewer;
  return `<dialog id="${id}" aria-label="Make a token"><form method="post" action="/act/ai.createToken" class="make-token">
    <h2>Make a token</h2><input type="hidden" name="back" value="${h(back)}">
    <div class="picker" data-kind="person"><button type="button" class="who" ${fixed ? 'disabled' : 'data-change-who'}>Who it acts as: <span class="chosen">${h(who.name)}</span>${fixed ? '' : ' Change'}</button>
      <input type="search" aria-label="Find a person" data-pick="person" hidden><input type="hidden" name="personId" value="${h(who.id)}"></div>
    <label>What it’s for <input name="name" aria-label="What it’s for" maxlength="120" placeholder="Claude on my laptop" required></label>
    <p>It acts as that person, with exactly their rights. You see it once.</p>
    <button class="primary" disabled data-make>Make the token</button> <button type="button" data-close-dialog>Cancel</button>
  </form></dialog>
  <script>{const f=document.querySelector('#${id} form');const n=f.querySelector('[name=name]');const b=f.querySelector('[data-make]');n.addEventListener('input',()=>{b.disabled=!n.value.trim();});const w=f.querySelector('[data-change-who]');if(w)w.addEventListener('click',()=>{const s=f.querySelector('[data-pick]');s.hidden=false;s.focus();});}</script>`;
}

function sectionPage(app, viewer) {
  const list = R.tokensNewestFirst(app.W);
  return `<h1>AI access</h1><p>The MCP tokens that let an AI tool act as someone here.</p>
    <section class="access-tokens" aria-label="MCP tokens">
      <p>A token lets Claude or another AI tool act as one person here, with exactly their rights. Every change it makes is logged as theirs, marked “via MCP” in Activity.</p>
      <button type="button" class="primary" data-dialog="make-token">Make a token</button>
      ${list.length ? `<ul class="tokens">${list.map((t) => tokenRow(app, t, { back: '/workspace/ai' })).join('')}</ul>` : '<p>No tokens yet.</p>'}
      <p><a href="/help/ai">Help on AI access</a></p>
    </section>${makeDialog(app, viewer, { back: '/workspace/ai' })}${freshDialog(viewer)}`;
}

// the read-back before the switch, both ways, only with a live token (aiAccessAsks)
function switchReadBack(app, on, viewer) {
  const rb = R.aiAccessReadBack(app.W);
  if (!R.aiAccessAsks(rb)) return null;
  const isOff = (app.W.modulesOff || []).includes(R.MODULE_ID);
  if (on && !isOff) return null;
  if (!on && isOff) return null;
  const lines = on ? R.aiAccessOnLines(rb) : R.aiAccessOffLines(rb);
  return `<section class="readback" role="region" aria-label="${on ? 'Before AI access goes back on' : 'Before AI access goes off'}">
    <h2>${on ? 'Switch AI access back on?' : 'Switch AI access off?'}</h2>
    ${lines.map(([a, b]) => `<p><strong>${h(a)}</strong>${h(b)}</p>`).join('')}
    <details><summary>See the tokens</summary><ul class="tokens">${rb.tokens.map((t) => tokenRow(app, t, { back: '/workspace/features' })).join('')}</ul></details>
    <form method="post" action="/act/setFeature"><input type="hidden" name="id" value="${R.MODULE_ID}"><input type="hidden" name="on" value="${on}"><input type="hidden" name="confirm" value="1">
    <button class="primary">${on ? 'Switch AI access on' : 'Switch AI access off'}</button> <a href="/workspace/features">Keep it ${on ? 'off' : 'on'}</a></form></section>`;
}

const findPerson = (app, q) => {
  const s = String(q || '').trim().toLowerCase();
  const live = app.W.people.filter((p) => !p.leftAt && !p.removedAt);
  return live.find((p) => p.id.toLowerCase() === s) || live.find((p) => p.name.toLowerCase() === s) || (() => { const m = live.filter((p) => p.name.toLowerCase().includes(s)); return s && m.length === 1 ? m[0] : null; })();
};
const asWho = (err, me) => (/^Only admins/.test(err) ? `${err} This token acts as ${me.name}, who isn’t an admin.` : err);
const meta = (app, t) => ({ id: t.id, name: t.name, personId: t.personId, person: person(app, t.personId)?.name, createdBy: t.createdBy, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt, ...(t.builder ? { builder: true } : {}) });

export const module = {
  id: R.MODULE_ID, name: R.NAME, group: 'beyond', needs: [],
  summary: 'Personal tokens so an AI assistant can act as you.',
  sections: [{ id: 'ai', name: 'AI access', after: 'access', admins: true, help: 'ai', page: sectionPage }],
  help: [guideArticle()],
  featureLine: (app) => R.featureLine(app.W),
  switchReadBack,
  places: {
    'settings.you': ({ app, person: me }) => {
      const mine = R.tokensNewestFirst(app.W).filter((t) => t.personId === me.id);
      return `<section class="ai-block" id="tokens" aria-label="Your MCP tokens"><h2>Your MCP tokens</h2>
        <p>The tokens that act as you, which you can revoke. An admin makes them, on Workspace, Access or from your page.</p>
        ${mine.length ? `<ul class="tokens">${mine.map((t) => tokenRow(app, t, { back: '/settings', mine: true })).join('')}</ul>` : '<p>You have no MCP tokens.</p>'}</section>`;
    },
    'people.person': ({ app, person: p, viewer }) => {
      if (!viewer?.admin || p.leftAt || p.removedAt) return '';
      return `<section aria-label="For admins" class="for-admins"><h2>For admins</h2><button type="button" data-dialog="make-token-p">Make an MCP token</button></section>${makeDialog(app, viewer, { id: 'make-token-p', fixed: p, back: `/people/${p.id}` })}${freshDialog(viewer)}`;
    },
  },
  actions: {
    'ai.createToken': { whileOff: true, run: (app, actor, input) => {
      const r = R.createToken(app.W, { actor, on: app.on(R.MODULE_ID), wsName: app.wsName, at: at(app), personId: input.personId, name: input.name });
      if (r.error) return r;
      app.W.tokens.push(r.token);
      fresh.set(actor, { secret: r.secret, name: r.token.name, personName: person(app, r.token.personId).name });
      return { ok: true, entity: 'token', entityId: r.token.id, summary: r.summary, diffs: r.diffs, secret: r.secret, token: r.token };
    } },
    'ai.revokeToken': { whileOff: true, run: (app, actor, input) => {
      const r = R.revokeToken(app.W, { actor, tokenId: input.tokenId, at: at(app) });
      if (r.error) return r;
      if (r.unchanged) return { ok: true, unchanged: true, token: r.token };
      r.token.revokedAt = r.revokedAt;
      return { ok: true, entity: 'token', entityId: r.token.id, summary: r.summary, diffs: r.diffs, token: r.token };
    } },
  },
  aiTools: [
    { name: 'list_tokens', title: 'AI assistant tokens', description: 'Tokens that let an AI assistant act as someone: every live one for an admin, otherwise your own. Never the token itself.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
      run: (app, me) => {
        const list = R.tokensNewestFirst(app.W).filter((t) => !t.revokedAt && (me.admin || t.personId === me.id));
        return { text: list.length ? list.map((t) => `${t.id}: “${t.name}”${t.builder ? ' (builder token)' : ''}, acts as ${person(app, t.personId)?.name}, made ${day(t.createdAt)}, ${t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : 'not used yet'}`).join('\n') : 'No live tokens.', structured: { tokens: list.map((t) => meta(app, t)) } };
      } },
    { name: 'create_token', title: 'Make an MCP token', description: 'Admins: make a personal MCP token, so an AI tool can act as someone (with exactly their rights). The token is returned once; only its hash is kept. Give it to that person privately.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['person', 'name'], properties: { person: { type: 'string', description: 'Who it acts as (name or ID).' }, name: { type: 'string', description: 'What it’s for, e.g. "Claude on Maya’s laptop".' } } },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: (app, me, a) => {
        const p = findPerson(app, a.person);
        if (!p) return { error: `There’s no one called ${a.person} in this workspace. Use list_people.` };
        const r = app.run(me.id, 'ai.createToken', { personId: p.id, name: a.name }, 'mcp');
        if (r.error) return { error: asWho(r.error, me) };
        fresh.delete(me.id);
        return { text: `Made “${r.token.name}” for ${p.name}. The token, shown once: ${r.secret}\nGive it to ${p.name} privately; only its hash is kept.`, structured: { token: r.secret } };
      } },
    { name: 'revoke_token', title: 'Revoke a token', description: 'Stop a token working: an admin, or the token’s person. Revoking the token this assistant uses ends its access.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['token_id'], properties: { token_id: { type: 'string', description: 'The token’s ID, from list_tokens.' } } },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      run: (app, me, a, ctx) => {
        const r = app.run(me.id, 'ai.revokeToken', { tokenId: a.token_id }, 'mcp');
        if (r.error) return { error: r.error };
        const own = ctx?.token && ctx.token.id === a.token_id;
        return { text: `${r.unchanged ? 'It was already revoked.' : `Revoked “${r.token.name}”.`}${own ? ' That is the token this assistant uses: its access ends now.' : ''}`, structured: { revoked: true } };
      } },
  ],
};
