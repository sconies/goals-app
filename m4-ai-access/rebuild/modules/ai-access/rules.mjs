// AI access's rules (spec/modules/ai-access/rules.md, spec/core/actions.md createToken and revokeToken):
// pure functions over a workspace's records, with no screen, store or network.
import crypto from 'node:crypto';

export const MODULE_ID = 'ai-access';
export const NAME = 'AI access';

const here = (p) => p && !p.leftAt && !p.removedAt;
const personOf = (W, id) => (W.people || []).find((p) => p.id === id);
// A token a person made in the app has a name ("what it's for"); the core's own unnamed demo tokens are the harness's, not anyone's.
export const isNamed = (t) => typeof t.name === 'string' && t.name.length > 0;
const order = (W) => (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : (W.tokens.indexOf(b) - W.tokens.indexOf(a)));

// Every token made here, newest first (what Workspace, AI access lists).
export function tokensNewestFirst(W) { return (W.tokens || []).filter(isNamed).sort(order(W)); }
// The live ones: not revoked, whose person is still here.
export function liveTokens(W) { return tokensNewestFirst(W).filter((t) => !t.revokedAt && here(personOf(W, t.personId))); }

export function listJoin(xs) { return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`; }
// The first five as Person's "name", then "and {k} more"
export function tokenNames(W, list) {
  const named = list.slice(0, 5).map((t) => `${personOf(W, t.personId)?.name}’s “${t.name}”`);
  if (list.length > 5) return `${named.join(', ')} and ${list.length - 5} more`;
  return listJoin(named);
}

export function aiAccessReadBack(W) {
  const tokens = liveTokens(W);
  const mcpChanges = (W.changes || []).filter((c) => c.via === 'mcp').length;
  return { tokens, names: tokenNames(W, tokens), mcpChanges };
}
export const aiAccessAsks = (rb) => rb.tokens.length > 0;
const nTokens = (n) => `${n} ${n === 1 ? 'token' : 'tokens'}`;

// Each line is [bold lead, the rest]: a screen bolds the lead, a test joins them.
export function aiAccessOffLines(rb) {
  const n = rb.tokens.length, m = rb.mcpChanges;
  return [
    [`${nTokens(n)} ${n === 1 ? 'stops' : 'stop'} working at once`, `: ${rb.names}.`],
    ['They are kept, not revoked.', ' Switch AI access back on and they work again. To end one for good, revoke it first.'],
    ['What AI tools already changed stays', `, marked “via MCP” in Activity: ${m} ${m === 1 ? 'change' : 'changes'}.`],
    ['An AI tool can’t switch this back on.', ' An admin does, here.'],
  ];
}
export function aiAccessOnLines(rb) {
  const n = rb.tokens.length;
  return [
    [`${nTokens(n)} made before will work again at once`, `: ${rb.names}.`],
    ['Each acts as its person', ', with their rights, and every change it makes is logged as theirs, via MCP.'],
    ['To stop one for good, revoke it first.', ''],
  ];
}
export const lineText = (lines) => lines.map(([a, b]) => a + b).join(' | ');
// Features' third line
export function featureLine(W) { const n = liveTokens(W).length; return n === 0 ? '' : n === 1 ? '1 token is in use.' : `${n} tokens are in use.`; }

export const offWords = (ws) => `AI access is off in ${ws}.`;
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function newSecret() { const b = crypto.randomBytes(40); return 'gk_' + [...b].map((x) => ALNUM[x % ALNUM.length]).join(''); }

// createToken: admins; refused while AI access is off. Gives the secret once; only its hash is kept.
export function createToken(W, { actor, on, wsName, at, personId, name, secret = newSecret() }) {
  if (!on) return { error: offWords(wsName) };
  if (!personOf(W, actor)?.admin) return { error: 'Only admins can make tokens.' };
  const p = personOf(W, personId);
  if (!here(p)) return { error: 'There’s no one with that ID in this workspace.' };
  const what = String(name || '').trim();
  if (!what) return { error: 'Say what the token is for, e.g. “Claude on my laptop”.' };
  if (what.length > 120) return { error: 'Keep what it’s for to 120 characters.' };
  const token = { id: `tok_${crypto.randomBytes(6).toString('hex')}`, personId: p.id, name: what, tokenHash: sha256(secret), createdBy: actor, createdAt: at, lastUsedAt: null, revokedAt: null };
  return { token, secret, summary: `Made an MCP token for ${p.name}`, diffs: [{ field: 'MCP token', from: '—', to: `“${what}”, acting as ${p.name}` }] };
}
// revokeToken: an admin or the token's person, whether AI access is on or off. Revoking a revoked one changes nothing.
export function revokeToken(W, { actor, tokenId, at }) {
  const t = (W.tokens || []).find((x) => x.id === tokenId && isNamed(x));
  if (!t) return { error: 'There’s no token with that ID.' };
  if (!(personOf(W, actor)?.admin || t.personId === actor)) return { error: 'Only an admin or the token’s person can revoke it.' };
  if (t.revokedAt) return { unchanged: true, token: t };
  return { token: t, revokedAt: at, summary: `Revoked the MCP token “${t.name}”`, diffs: [{ field: 'MCP token', from: 'Works', to: 'Revoked' }] };
}
