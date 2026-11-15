// The AI tools' server (module-platform.md, "The AI tools' server and its door"): JSON-RPC 2.0 over POST,
// the core's own tools and every installed module's, refusals as isError results, dry runs, batches.
import crypto from 'node:crypto';
import { W_ } from '../platform.mjs';
import { makeIndex, STATUS_WORD } from '../screens.mjs';
import { homeFor } from '../home.mjs';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req });
const S = { type: 'string' }, N = { type: 'number' }, I = { type: 'integer' }, B = { type: 'boolean' };
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const rw = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const goalLine = (app, g) => {
  const st = app.S1.goalStatus(g, app.S1.asOf(app.now).ckByGoal.get(g.id) || [], app.now).status;
  return `${g.key} ${g.title} — ${STATUS_WORD[st]} (owner ${app.person(g.ownerId)?.name})`;
};
export const CORE_TOOLS = [
  { name: 'get_my_work', title: 'My work', description: 'What needs you this week: the lead on your Home and your goals.', inputSchema: obj({}), annotations: ro,
    run: (app, me) => { const h = homeFor(app.W, app.S1, me.id, app.now, { on: app.on, wsName: app.wsName }); const mine = app.S1.asOf(app.now).goals.filter((g) => g.ownerId === me.id);
      return { text: `${h.lead ? `${h.lead.eyebrow}: ${h.lead.title}` : h.quiet}\n\nYour goals:\n${mine.map((g) => goalLine(app, g)).join('\n') || 'None.'}`, structured: { lead: h.lead ? { kind: h.lead.kind, title: h.lead.title } : null, quiet: h.quiet, goals: mine.map((g) => g.key) } }; } },
  { name: 'find_goals', title: 'Find goals', description: 'Search goals by words, key, owner or team, worst first.', inputSchema: obj({ q: S, limit: I }), annotations: ro,
    run: (app, me, a) => { const r = makeIndex(app.W, app.S1, app.now).search('goal', { q: a.q || '', size: Math.min(a.limit || 50, 200) });
      return { text: `${r.total} ${r.total === 1 ? 'goal' : 'goals'}${r.near ? ` (no goal matches “${a.q}”; showing goals that match “${r.near}”)` : ''}.\n${r.rows.map((x) => goalLine(app, x.goal)).join('\n')}`, structured: { total: r.total, near: r.near, goals: r.rows.map((x) => ({ id: x.id, key: x.goal.key, title: x.title, status: x.status })) } }; } },
  { name: 'get_goal', title: 'Get a goal', description: 'One goal in full: its status, plan, latest check-in and history.', inputSchema: obj({ goal_id: S }, ['goal_id']), annotations: ro,
    run: (app, me, a) => { const g = app.goal(a.goal_id); if (!g) return { error: `There’s no goal ${a.goal_id}.` };
      const ck = (app.S1.asOf(app.now).ckByGoal.get(g.id) || []); const last = app.S1.latestPosted(app.S1.sortCk(ck));
      return { text: `${goalLine(app, g)}\n${last ? `Latest check-in, week ${last.week}: ${last.value ?? ''} ${last.why || ''}` : 'No check-in yet.'}`, structured: { goal: g, latest: last || null } }; } },
  { name: 'post_check_in', title: 'Post a check-in', description: 'Post the number for one goal for a week. The goal’s owner only. dry_run checks without saving.', annotations: rw,
    inputSchema: obj({ goal_id: S, week: I, value: N, stages: S, call: S, cause: S, why: S, why_greener: S, path_to_green: S, back_on_plan_by_week: I, needs: S, dry_run: B, confirm: B }, ['goal_id']),
    run: (app, me, a) => { const g = app.goal(a.goal_id); if (!g) return { error: `There’s no goal ${a.goal_id}.` };
      if (g.ownerId !== me.id) return { error: `Only ${app.person(g.ownerId)?.name} can check in on ${g.key}. This token acts as ${me.name}.` };
      const r = app.run(me.id, 'checkIn', { goalId: g.id, week: a.week ?? app.S1.currentWeek(app.now), value: a.value, call: a.call, cause: a.cause, why: a.why, whyGreener: a.why_greener, path: a.path_to_green, byWeek: a.back_on_plan_by_week, dryRun: !!a.dry_run }, 'mcp');
      if (!r.saves) return { error: `Not saved. ${r.issues.map((i) => i.message).join(' ') || 'Nothing to save.'}` };
      return { text: a.dry_run ? `Would save: ${r.items.map((i) => `${i.kind} for ${i.name}`).join('; ')}. Nothing was saved (dry run).` : `Saved: ${r.items.map((i) => `${i.kind} for ${i.name}`).join('; ')}.`, structured: { saved: !a.dry_run, items: r.items.map((i) => ({ kind: i.kind, diffs: i.diffs })) } }; } },
  { name: 'add_comment', title: 'Add a comment', description: 'Comment on a goal.', inputSchema: obj({ goal_id: S, text: S }, ['goal_id', 'text']), annotations: rw,
    run: (app, me, a) => { const r = app.run(me.id, 'comment', { goalId: a.goal_id, text: a.text }, 'mcp'); return r.error ? { error: r.error } : { text: 'Comment added.' }; } },
  { name: 'list_people', title: 'List people', description: 'Find people by name or team.', inputSchema: obj({ q: S }), annotations: ro,
    run: (app, me, a) => { const r = makeIndex(app.W, app.S1, app.now).search('person', { q: a.q || '', size: 200 }); return { text: `${r.total} ${r.total === 1 ? 'person' : 'people'}.\n${r.rows.map((x) => `${x.title} (${x.id}) · ${x.line}`).join('\n')}` }; } },
  { name: 'set_feature', title: 'Switch a feature', description: 'Admins: switch one of the workspace’s optional features (its modules) on or off.', inputSchema: obj({ feature: S, on: B }, ['feature', 'on']), annotations: rw,
    run: (app, me, a, ctx) => { const r = app.run(me.id, 'setFeature', { id: a.feature, on: a.on }, 'mcp');
      if (r.error) return { error: r.error === 'Only admins can switch features on or off.' ? `${r.error} This token acts as ${me.name}, who isn’t an admin.` : r.error };
      if (a.feature === 'ai-access' && !a.on) { ctx.last = true; return { text: W_.aiLast(app.wsName) }; }
      return { text: r.unchanged ? 'Nothing changed: it was already so.' : r.message }; } },
  { name: 'get_help', title: 'Get Help', description: 'One of Faro’s Help articles, by its id, or the list.', inputSchema: obj({ article: S }), annotations: ro,
    run: (app, me, a, ctx) => { const arts = ctx.help(); if (!a.article) return { text: arts.map((x) => `${x.id}: ${x.title}`).join('\n') };
      const mod = app.mods.code.find((m) => (m.help || []).some((x) => x.id === a.article)); if (mod && !app.on(mod.id)) return { error: W_.help(mod.name, app.wsName) };
      const x = arts.find((y) => y.id === a.article); return x ? { text: `${x.title}\n\n${x.body}` } : { error: `There’s no Help article ${a.article}.` }; } },
];

export function mcpHandler(app, helpArticles) {
  const aiShut = () => app.mods.facts.some((m) => m.id === 'ai-access') && !app.on('ai-access');
  const tools = () => [...CORE_TOOLS, ...app.registry.tools()];
  const listed = () => tools().map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }));
  const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
  async function one(msg, me, ctx) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id, -32600, 'Invalid request');
    const { id, method, params = {} } = msg;
    const answered = ['initialize', 'tools/list', 'prompts/list', 'prompts/get', 'tools/call'];
    if (id === undefined && !answered.includes(method)) return null;
    if (!['initialize', 'tools/list'].includes(method) && aiShut()) return err(id, -32001, W_.aiShut(app.wsName));
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (method === 'initialize') return { jsonrpc: '2.0', id: id ?? null, result: { protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: 'goals', title: 'Faro', version: '1.0.0' }, instructions: `You act as ${me.name} in ${app.wsName}.` } };
    if (method === 'tools/list') return { jsonrpc: '2.0', id: id ?? null, result: { tools: listed() } };
    if (method === 'prompts/list') return { jsonrpc: '2.0', id: id ?? null, result: { prompts: [] } };
    if (method === 'prompts/get') return err(id, -32602, `Unknown prompt: ${params.name}`);
    if (method === 'tools/call') {
      const t = tools().find((x) => x.name === params.name);
      if (!t) return err(id, -32602, `Unknown tool: ${params.name}`);
      if (t.module && !app.on(t.module.id)) return { jsonrpc: '2.0', id: id ?? null, result: { content: [{ type: 'text', text: W_.tool(t.module.name, app.wsName, t.name) }], isError: true } };
      const r = t.run(app, me, params.arguments || {}, ctx);
      if (r.error) return { jsonrpc: '2.0', id: id ?? null, result: { content: [{ type: 'text', text: r.error }], isError: true } };
      return { jsonrpc: '2.0', id: id ?? null, result: { content: [{ type: 'text', text: r.text }], ...(r.structured ? { structuredContent: r.structured } : {}), isError: false } };
    }
    if (id === undefined) return null;
    return err(id, -32601, `Method not found: ${method}`);
  }
  return async function handle(req, body, url) {
    if (req.method === 'GET' && url.searchParams.has('check')) return { status: 200, json: { ok: true, database: true, pictures: false, problems: [] } };
    if (req.method !== 'POST') return { status: 405, headers: { Allow: 'GET, POST, OPTIONS' }, json: err(null, -32001, 'This MCP server answers POST requests only (no event stream).') };
    const auth = req.headers.authorization || '';
    const token = /^Bearer\s+(\S+)/.exec(auth)?.[1] || url.searchParams.get('token');
    if (!token) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer' }, json: err(null, -32001, 'Add your personal token: Authorization: Bearer gk_… An admin makes one under Workspace → Access → MCP access.') };
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const tok = app.W.tokens.find((t) => (t.tokenHash || t.hash) === hash && !t.revokedAt);
    if (!tok) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' }, json: err(null, -32001, 'That token isn’t valid or has been revoked. Ask an admin for a new one.') };
    let parsed;
    try { parsed = JSON.parse(body); } catch { return { status: 400, json: err(null, -32700, 'Parse error') }; }
    const me = app.person(tok.personId);
    if (!me || me.leftAt || me.removedAt) return { status: 500, json: err(null, -32603, 'The person this token belongs to is no longer in the workspace.') };
    const ctx = { help: helpArticles, token: tok };
    if (!aiShut()) tok.lastUsedAt = new Date().toISOString();
    if (Array.isArray(parsed)) {
      const out = [];
      for (const m of parsed) { const r = await one(m, me, ctx); if (r) out.push(r); }
      return out.length ? { status: 200, json: out } : { status: 202 };
    }
    const r = await one(parsed, me, ctx);
    return r ? { status: 200, json: r } : { status: 202 };
  };
}
