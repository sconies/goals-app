// The AI tools' server (module-platform.md, "The AI tools' server and its door"): JSON-RPC 2.0 over HTTP POST,
// the core's tools and every installed module's, a personal token by its SHA-256 hash, batches, refusals and dry runs.
import crypto from 'node:crypto';
import { words } from './platform.mjs';
import { goalRows, search, STATUS_WORD } from '../s3/finding.mjs';
import { homeFor } from '../s3/home.mjs';
import { HELP } from './help.mjs';
import { WHATS_NEW } from './whatsnew.mjs';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const R = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const C_ = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const D_ = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const obj = (properties = {}, required = []) => ({ type: 'object', additionalProperties: false, ...(required.length ? { required } : {}), properties });
const s = (description, extra = {}) => ({ type: 'string', description, ...extra });
const b = (description) => ({ type: 'boolean', description });

// The core's tools built in stage 3 (a subset of spec/core/tools.md; the rest are listed in GAPS.md).
function coreTools(state) {
  const statusWord = (st) => `${STATUS_WORD[st] ?? st} (${st})`;
  const fmtGoal = (C, st) => `${st.g.key} ${st.g.title}: ${statusWord(st.status)}, owned by ${C.personById.get(st.g.ownerId)?.name}`;
  const act = (actor, name, input, dry) => { const r = state.dispatch(actor, name, input, { dryRun: dry, via: 'MCP' }); return r.error ? { error: r.error } : { text: r.message, data: r }; };
  return [
    { name: 'get_overview', title: 'Overview of the goals', annotations: R, description: 'How the goals stand: counts by status and what needs attention.', inputSchema: obj(),
      call: ({ C, m }) => { const st = C.goalStates(m); const by = {}; for (const x of st) by[x.status] = (by[x.status] || 0) + 1; const need = st.filter((x) => x.needs).length; return { text: `${st.length} goals. ${Object.entries(by).map(([k, n]) => `${n} ${statusWord(k)}`).join(', ')}. ${need} need attention.`, data: { total: st.length, byStatus: by, needAttention: need } }; } },
    { name: 'find_goals', title: 'Find goals', annotations: R, description: 'Find goals by words, key, owner or team, worst first.', inputSchema: obj({ q: s('Words, a key like G-48, an owner or a team.'), status: s('A status code.'), limit: { type: 'integer', description: 'At most this many (50).' } }),
      call: ({ C, m, args }) => { let st = C.goalStates(m); if (args.status) st = st.filter((x) => x.status === args.status); const r = search(goalRows(st, C), args.q || '', { keyRow: true }); const rows = r.rows.slice(0, Math.min(200, args.limit || 50)); return { text: `${r.total} goals${r.near ? ` (none matched; showing “${r.near}”)` : ''}.\n${rows.map((x) => `${x.key} ${x.title}: ${statusWord(x.status)}`).join('\n')}`, data: { total: r.total, near: r.near, goals: rows.map((x) => ({ id: x.id, key: x.key, title: x.title, status: x.status })) } }; } },
    { name: 'get_goal', title: 'One goal in full', annotations: R, description: 'One goal: its status, owner, plan and recent check-ins.', inputSchema: obj({ goal: s('The goal’s id or key.') }, ['goal']),
      call: ({ C, m, args }) => { const g = C.findGoal(args.goal); if (!g || g.removedAt) return { error: `There’s no goal ${args.goal}.` }; const st = C.stateOf(g.id, m); return { text: st ? fmtGoal(C, st) : `${g.key} ${g.title}`, data: { goal: g, status: st?.status ?? null, flags: st?.flags ?? [], checkIns: (st?.posted || []).slice(-5) } }; } },
    { name: 'get_my_work', title: 'What needs me', annotations: R, description: 'What Home asks of the token’s person today.', inputSchema: obj(),
      call: ({ C, m, actor }) => { const h = homeFor(C, actor, m, { workspaceName: state.wsName() }); return { text: h.lead ? `${h.lead.kind}: ${h.lead.title}` : h.quiet, data: { lead: h.lead, quiet: h.quiet, run: h.run } }; } },
    { name: 'list_people', title: 'People and teams', annotations: R, description: 'Everyone here, with their team.', inputSchema: obj({ q: s('A name or team.') }),
      call: ({ C, args }) => { const ps = C.W.people.filter((p) => !p.leftAt && (!args.q || `${p.name} ${C.teamById.get(p.teamId)?.name}`.toLowerCase().includes(args.q.toLowerCase()))); return { text: ps.map((p) => `${p.name} · ${C.teamById.get(p.teamId)?.name ?? 'no team'}${p.admin ? ' · admin' : ''}`).join('\n'), data: { people: ps.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId, admin: !!p.admin })) } }; } },
    { name: 'get_activity', title: 'The activity log', annotations: R, description: 'The latest changes, newest first.', inputSchema: obj({ limit: { type: 'integer', description: 'How many (20).' } }),
      call: ({ d, args }) => { const ch = [...(d.changes || [])].sort((a, b2) => (a.at < b2.at ? 1 : -1)).slice(0, args.limit || 20); return { text: ch.map((c) => `${c.at.slice(0, 10)} ${c.summary}${c.via ? ` (via ${c.via})` : ''}`).join('\n'), data: { changes: ch } }; } },
    { name: 'get_help', title: 'Help: what the app does', annotations: R, description: 'A Help article by its id, or the list of them.', inputSchema: obj({ article: s('The article’s id.') }),
      call: ({ args, on }) => {
        const mod = state.platform.helpArticles(new Set(state.platform.mods.map((x) => x.id)));
        if (!args.article) return { text: [...HELP, ...mod.filter((a) => on.has(a.module))].map((a) => `${a.id}: ${a.title}`).join('\n') };
        const own = mod.find((a) => a.id === args.article);
        if (own && !on.has(own.module)) return { error: words.help(state.platform.byId.get(own.module).name, state.wsName()), plain: true };
        const a = own || HELP.find((x) => x.id === args.article);
        return a ? { text: `${a.title}\n\n${a.body.join('\n')}` } : { error: `There’s no Help article called ${args.article}.` };
      } },
    { name: 'whats_new', title: 'What’s new in the app', annotations: R, description: 'The releases, newest first.', inputSchema: obj(),
      call: () => ({ text: WHATS_NEW.map((e) => `${e.date}: ${e.title}`).join('\n'), data: { entries: WHATS_NEW } }) },
    { name: 'post_check_in', title: 'Post a check-in', annotations: C_, description: 'Check in on one of your goals for this week. dry_run: true says what it would save.', inputSchema: obj({ goal: s('The goal’s id or key.'), value: { type: 'number', description: 'This week’s number.' }, call: s('on, risk, off or done.', { enum: ['on', 'risk', 'off', 'done'] }), why: s('Why.'), why_greener: s('Why greener.'), path_to_green: s('How it gets back.'), dry_run: b('Only say what it would save.'), confirm: b('Yes to its questions.') }, ['goal']),
      call: ({ actor, args }) => act(actor, 'postCheckIn', { goalId: args.goal, value: args.value, call: args.call, why: args.why, greenerWhy: args.why_greener, path: args.path_to_green, confirm: args.confirm }, args.dry_run) },
    { name: 'create_goal', title: 'Add a goal', annotations: C_, description: 'Add a goal through the same rules as New goal. dry_run: true says what it would save.', inputSchema: obj({ title: s('Its name.'), owner: s('Its owner’s id.'), team: s('Its team’s id.'), kind: s('metric, range or milestone.', { enum: ['metric', 'range', 'milestone'] }), unit: s('Its unit.'), start: s('Where it starts.'), target: s('Its target.'), limit: s('A range’s limit.'), feeds: s('The goal it feeds, by id or key.'), level: s('north-star, svp or team.'), dry_run: b('Only say what it would save.'), confirm: b('Yes to its questions.') }, ['title']),
      call: ({ actor, args }) => act(actor, 'saveGoal', { draft: { title: args.title, ownerId: args.owner || actor, teamId: args.team || state.data().people.find((p) => p.id === (args.owner || actor))?.teamId, kind: args.kind || 'metric', unit: args.unit, start: args.start, target: args.target, limit: args.limit, parentId: args.feeds, level: args.level }, confirm: args.confirm }, args.dry_run) },
    { name: 'stop_goal', title: 'Stop a goal', annotations: D_, description: 'Stop a goal with check-ins, with a reason.', inputSchema: obj({ goal: s('The goal’s id or key.'), reason: s('Why, in a sentence.') }, ['goal', 'reason']),
      call: ({ actor, args }) => act(actor, 'stopGoal', { goalId: args.goal, reason: args.reason }) },
    { name: 'delete_goal', title: 'Delete a goal with no check-ins', annotations: D_, description: 'Delete a goal set up by mistake.', inputSchema: obj({ goal: s('The goal’s id or key.') }, ['goal']),
      call: ({ actor, args }) => act(actor, 'deleteGoal', { goalId: args.goal }) },
    { name: 'list_removed', title: 'Recently removed', annotations: R, description: 'What was removed in the last 30 days.', inputSchema: obj(),
      call: () => { const l = state.removed(); return { text: l.length ? l.map((r) => `${r.kind} ${r.id}: ${r.name}`).join('\n') : 'Nothing was removed in the last 30 days.', data: { removed: l } }; } },
    { name: 'restore_removed', title: 'Restore something removed', annotations: C_, description: 'Admins: restore something removed in the last 30 days.', inputSchema: obj({ kind: s('Its kind, as list_removed gives it.'), id: s('Its id.') }, ['kind', 'id']),
      call: ({ actor, args }) => (state.isAdmin(actor) ? act(actor, 'restoreRemoved', { kind: args.kind, id: args.id }) : { error: 'Only an admin can restore what was removed.', rule: true }) },
    { name: 'set_feature', title: 'Switch a feature on or off', annotations: { ...C_, idempotentHint: true }, description: 'Admins: switch one of the optional features (modules) on or off in this workspace. Nothing it saved is deleted.', inputSchema: obj({ feature: s('The feature’s id.', { enum: state.platform.mods.map((x) => x.id) }), on: b('true to switch it on, false to switch it off.') }, ['feature', 'on']),
      call: ({ actor, args }) => { if (typeof args.on !== 'boolean') return { error: 'Say on: true to switch it on, or on: false to switch it off.' }; const r = state.dispatch(actor, 'setModule', { id: args.feature, on: args.on }, { via: 'MCP' }); if (r.error) return { error: r.error, rule: true }; const on = [...state.view().on]; return { text: r.message, data: { on, off: state.platform.mods.map((x) => x.id).filter((x) => !on.includes(x)) } }; } },
    { name: 'start_next_cycle', title: 'Start the next cycle', annotations: D_, description: 'Admins, from the day the wrap-up opens: set up the next cycle. Without confirm (a dry run, the default) it changes nothing.', inputSchema: obj({ dry_run: b('True (the default): only say what starting would do.'), confirm: b('True, once the person has said to start it.') }),
      call: ({ actor, args }) => { const r = state.dispatch(actor, 'startNextCycle', { confirm: args.confirm === true && args.dry_run !== true }, { via: 'MCP' }); if (r.error) return { error: r.error, rule: true }; return { text: r.preview ? `${r.counts.map((c) => `${c.n} ${c.says}`).join(', ')}.${r.whyNot ? ` ${r.whyNot}` : ''}` : r.message, data: r }; } },
    { name: 'save_view', title: 'Save a view of the goals', annotations: C_, description: 'Save a Goals address under a name.', inputSchema: obj({ name: s('Its name, 1 to 80 characters.'), address: s('The Goals address, such as /goals?scope=all&status=off.') }, ['name', 'address']),
      call: ({ actor, args }) => act(actor, 'saveView', { name: args.name, address: args.address }) },
    { name: 'list_views', title: 'Saved views', annotations: R, description: 'Your saved views.', inputSchema: obj(),
      call: ({ d, actor }) => { const vs = (d.views || []).filter((v) => !v.removedAt && (v.ownerId === actor || v.pinned)); return { text: vs.map((v) => `${v.name}: ${v.address}`).join('\n') || 'No saved views.', data: { views: vs } }; } },
  ];
}

export function createMcp(state) {
  const core = coreTools(state);
  const listAll = () => [...core.map((t) => ({ ...t, module: null })), ...state.platform.tools()];
  const describe = (t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations });
  const result = (id, r) => ({ jsonrpc: '2.0', id, result: r });
  const errorOf = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  function callTool(name, args, actor) {
    const t = listAll().find((x) => x.name === name);
    if (!t) return { rpcError: [-32602, `Unknown tool: ${name}`] };
    const v = state.view();
    if (t.module && !v.on.has(t.module)) return { content: [{ type: 'text', text: words.tool(state.platform.byId.get(t.module).name, state.wsName(), name) }], isError: true };
    // the schema: no argument outside it
    const props = t.inputSchema.properties || {};
    for (const k of Object.keys(args || {})) if (!(k in props)) return { content: [{ type: 'text', text: `${name} takes no argument called ${k}.` }], isError: true };
    for (const k of t.inputSchema.required || []) if (args?.[k] === undefined) return { content: [{ type: 'text', text: `${name} needs ${k}.` }], isError: true };
    const h = { findGoal: (x) => v.core.findGoal(x), goalTitle: (id) => v.core.goalById.get(id)?.title ?? id,
      runAction: (n, input, dry) => { const r = state.dispatch(actor, n, input, { dryRun: dry, via: 'MCP' }); return r.error ? { error: r.error } : { text: r.message, data: r }; } };
    let r;
    try { r = t.call({ args: args || {}, actor, C: v.core, m: state.moment(), d: v.d, data: v.d, on: v.on, h }); } catch (e) { return { rpcError: [-32603, `Internal error: ${e.message}`] }; }
    if (r.error) {
      const p = state.data().people.find((x) => x.id === actor);
      const who = r.plain ? '' : ` This token acts as ${p.name}, who ${p.admin ? 'is an admin' : 'isn’t an admin'}.`;
      return { content: [{ type: 'text', text: `${r.error}${who}` }], isError: true };
    }
    return { content: [{ type: 'text', text: r.text }], ...(r.data ? { structuredContent: JSON.parse(JSON.stringify(r.data)) } : {}), isError: false };
  }

  function one(msg, actor) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return errorOf(msg?.id ?? null, -32600, 'Invalid request');
    const hasId = 'id' in msg;
    const id = hasId ? msg.id : null;
    const answeredAnyway = ['initialize', 'tools/list', 'prompts/list', 'prompts/get', 'tools/call'];
    if (!hasId && !answeredAnyway.includes(msg.method)) return null;
    switch (msg.method) {
      case 'initialize': {
        const asked = msg.params?.protocolVersion;
        return result(id, { protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: 'goals', title: 'Faro', version: '1.0.0' }, instructions: `Faro’s goals for ${state.wsName()}. Every change is logged as the token’s person, via MCP.` });
      }
      case 'ping': return result(id, {});
      case 'tools/list': return result(id, { tools: listAll().map(describe) });
      case 'prompts/list': return result(id, { prompts: [] });
      case 'prompts/get': return errorOf(id, -32602, `Unknown prompt: ${msg.params?.name}`);
      case 'tools/call': {
        const r = callTool(msg.params?.name, msg.params?.arguments, actor);
        return r.rpcError ? errorOf(id, ...r.rpcError) : result(id, r);
      }
      default:
        if (msg.method.startsWith('notifications/')) return null;
        return errorOf(id, -32601, `Method not found: ${msg.method}`);
    }
  }

  // The door: method, token, body. Returns { status, headers, body }.
  function handle({ method, auth, tokenParam, raw }) {
    if (method !== 'POST') return { status: 405, headers: { Allow: 'GET, POST, OPTIONS' }, body: errorOf(null, -32001, 'This MCP server answers POST requests only (no event stream).') };
    const token = (auth || '').replace(/^Bearer\s+/i, '') || tokenParam || '';
    if (!token) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer' }, body: errorOf(null, -32001, 'Add your personal token: Authorization: Bearer gk_… An admin makes one under Workspace → Access → MCP access.') };
    const rec = (state.data().tokens || []).find((t) => t.hash === hashToken(token) && !t.revokedAt);
    if (!/^gk_[A-Za-z0-9]{40}$/.test(token) || !rec) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' }, body: errorOf(null, -32001, 'That token isn’t valid or has been revoked. Ask an admin for a new one.') };
    let msg;
    try { msg = JSON.parse(raw); } catch { return { status: 400, body: errorOf(null, -32700, 'Parse error') }; }
    const person = state.data().people.find((p) => p.id === rec.personId && !p.leftAt && !p.removedAt);
    if (!person) return { status: 500, body: errorOf(null, -32603, 'The person this token belongs to is no longer in the workspace.') };
    const aiOff = state.platform.byId.has('ai-access') && !state.view().on.has('ai-access');
    const run = (m) => (aiOff && !['initialize', 'tools/list'].includes(m?.method) && !String(m?.method).startsWith('notifications/') ? errorOf(m?.id ?? null, -32001, words.aiShut(state.wsName())) : one(m, person.id));
    if (Array.isArray(msg)) { const out = msg.map(run).filter(Boolean); return out.length ? { status: 200, body: out } : { status: 202, body: null }; }
    const out = run(msg);
    return out ? { status: 200, body: out } : { status: 202, body: null };
  }
  return { handle, callTool, listAll };
}

// A token record as AI access would make one (stage 3 has no screen that makes one): gk_ and 40 letters or digits.
export function newToken() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(40);
  return `gk_${[...bytes].map((x) => abc[x % abc.length]).join('')}`;
}
