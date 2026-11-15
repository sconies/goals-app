/* AI access's AI tools (SW2): list, make and revoke MCP tokens. Their rules are still the core's (src/domain/actions.ts
   createToken and revokeToken) until SW7 moves them here. While AI access is off the MCP server shuts its door to every
   token of the workspace (server/mcp.ts), so none of these is reached; in the app, making a token is refused and
   revoking one never is. Every change is logged as the person, via MCP. */
import * as A from '../../domain/actions';
import { VIA_MCP } from '../../domain/via';
import type { ToolDef } from '../../mcp/tools';
import { listed } from '../../mcp/listed';
import { ax, name, personOf, READ, save, WRITE } from '../../mcp/workTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const VIA = VIA_MCP;

const tools: ToolDef[] = [
  {
    name: 'list_tokens',
    title: 'AI assistant tokens',
    description: 'Tokens that let an AI assistant act as someone: every live one for an admin, otherwise your own. Never the token itself.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = (ctx.snapshot.tokens ?? []).filter((t) => !t.revokedAt && (ctx.actor.admin || t.personId === ctx.actor.id)).map((t) => ({ id: t.id, name: t.name, person: name(ctx, t.personId), createdAt: t.createdAt, lastUsedAt: t.lastUsedAt }));
      return listed({ tokens: list });
    },
  },
  {
    name: 'create_token',
    title: 'Make an MCP token',
    description: 'Admins: make a personal MCP token, so an AI tool can act as someone (with exactly their rights). The token is returned once; only its hash is kept. Give it to that person privately.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['person', 'name'], properties: { person: str('Who it acts as (name or ID).'), name: str('What it’s for, e.g. "Claude on Maya’s laptop".') } },
    annotations: WRITE,
    async run(a, ctx) {
      const p = personOf(ctx, a.person);
      const c = A.createToken(ax(ctx), p.id, String(a.name ?? ''));
      // The secret is made where the token is kept (the database), and only its hash is stored.
      const token = await ctx.issueToken({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
      return { text: `Made a token for ${p.name} (as ${ctx.actor.name}). Here it is, shown once: ${token}`, data: { token } };
    },
  },
  {
    name: 'revoke_token',
    title: 'Revoke a token',
    description: 'Stop a token working: an admin, or the token’s person. Revoking the token this assistant uses ends its access.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['token_id'], properties: { token_id: str('The token’s ID, from list_tokens.') } },
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    async run(a, ctx) { return save(ctx, A.revokeToken(ax(ctx), String(a.token_id ?? '')), 'Revoked the token', 'That token is already revoked.'); },
  },
];

export default tools;
