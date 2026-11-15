// AI access's rules, pure (no screens, no server): who may make and revoke a token, and the switch's read-backs.
// From spec/modules/ai-access/rules.md and spec/core/actions.md (createToken, revokeToken).

export const ID = 'ai-access';
export const NAME = 'AI access';

const here = (p) => p && !p.leftAt && !p.removedAt;
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1);

export const doorShut = (ws) => `AI access is switched off in ${ws}. An admin can switch it on in Faro, under Workspace, Features.`;
export const makeOff = (ws) => `AI access is off in ${ws}.`;
export const lastWords = (ws) => `AI access is off in ${ws}. This connection stops working now. An admin switches it back on in Faro.`;

// createToken: admins only; someone here; what it's for, 2 to 120 characters. Gives the row (without a secret).
export function createToken(W, by, input, { off = false, ws = '', id, at } = {}) {
  if (off) return { error: makeOff(ws) };
  const people = new Map(W.people.map((p) => [p.id, p]));
  if (!people.get(by)?.admin) return { error: 'Only admins can make tokens.' };
  const p = people.get(input.personId);
  if (!p || p.removedAt) return { error: 'There’s no one with that ID in this workspace.' };
  const name = String(input.name ?? '').trim();
  if (name.length > 120) return { error: 'Keep what it’s for to 120 characters.' };
  if (name.length < 2) return { error: 'Say what the token is for, e.g. “Claude on my laptop”.' };
  return { token: { id, personId: p.id, name, createdBy: by, createdAt: at, lastUsedAt: null, revokedAt: null } };
}

// revokeToken: an admin, or the token's person; works whether AI access is on or off. null: already revoked.
export function revokeToken(W, by, tokenId) {
  const t = (W.tokens || []).find((x) => x.id === tokenId);
  if (!t) return { error: 'There’s no token with that ID.' };
  const me = W.people.find((p) => p.id === by);
  if (t.personId !== by && !me?.admin) return { error: 'Only an admin or the token’s person can revoke it.' };
  if (t.revokedAt) return { same: true, token: t };
  return { token: t };
}

// aiAccessReadBack: the live tokens of people still here, newest first, and the changes made through MCP.
export function aiAccessReadBack(W) {
  const people = new Map(W.people.map((p) => [p.id, p]));
  const tokens = (W.tokens || []).filter((t) => !t.revokedAt && here(people.get(t.personId))).sort(newestFirst);
  const viaMcp = (W.changes || []).filter((c) => c.via === 'mcp').length;
  return { tokens, viaMcp };
}
export const aiAccessAsks = (W) => aiAccessReadBack(W).tokens.length > 0;

const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export function tokenNames(tokens, nameOf) {
  const shown = tokens.slice(0, 5).map((t) => `${nameOf(t.personId)}’s “${t.name}”`);
  const more = tokens.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${more} more` : list(shown);
}
const nTokens = (n) => `${n} token${n === 1 ? '' : 's'}`;

export function aiAccessOffLines(W, nameOf) {
  const { tokens, viaMcp } = aiAccessReadBack(W);
  return [
    `**${nTokens(tokens.length)} ${tokens.length === 1 ? 'stops' : 'stop'} working at once**: ${tokenNames(tokens, nameOf)}.`,
    '**They are kept, not revoked.** Switch AI access back on and they work again. To end one for good, revoke it first.',
    `**What AI tools already changed stays**, marked “via MCP” in Activity: ${viaMcp} change${viaMcp === 1 ? '' : 's'}.`,
    '**An AI tool can’t switch this back on.** An admin does, here.',
  ];
}
export function aiAccessOnLines(W, nameOf) {
  const { tokens } = aiAccessReadBack(W);
  return [
    `**${nTokens(tokens.length)} made before will work again at once**: ${tokenNames(tokens, nameOf)}.`,
    'Each acts as its person, with their rights, and every change is logged as theirs via MCP.',
    'To stop one for good, revoke it first.',
  ];
}
export const plain = (l) => l.replace(/\*\*/g, '');

// Features' third line.
export function featureLine(W) {
  const n = aiAccessReadBack(W).tokens.length;
  return n ? `${n === 1 ? '1 token is' : `${n} tokens are`} in use.` : '';
}

// The door: every message but initialize and tools/list is refused while off; notifications have no answer.
export function door(off, method, ws) {
  if (!off) return null;
  if (method === 'initialize' || method === 'tools/list') return null;
  return { code: -32001, message: doorShut(ws) };
}
