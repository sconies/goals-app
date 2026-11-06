/* The builder inbox, for a builder's AI assistant: list markups, open one (with a picture link that works for ten
   minutes, when the server can sign one) and change one (its status, its GitHub issue, the What's new entry that fixed
   it). Builders only: they need a builder token, which only a builder signed in to the inbox can make, so an ordinary
   token (which an admin can make for anyone) isn't enough. The same operations as the inbox (src/markup/ops.ts),
   through the database's functions for builder tokens (migration 0024): no secret beyond the token. */
import { MOOD_WORD, STATUS_WORD, STATUSES, namedParts, partText, placeOf, problemText, stepText, type MarkupStatus } from '../markup/model';
import type { MarkupOps } from '../markup/ops';
import type { McpContext, ToolDef, ToolResult } from './tools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;

/** The inbox, when this request may use it; otherwise why not, for the assistant to say. */
function inbox(ctx: McpContext): MarkupOps {
  if (!ctx.markups) throw new Error('Only builders (the people building Faro) can read markups, with a builder token: sign in to the inbox on Workspace and make one there.');
  return ctx.markups;
}

export const MARKUP_TOOLS: ToolDef[] = [
  {
    name: 'list_markups',
    title: 'List markups',
    description: 'Builders: markups people sent (a picture of a screen with a drawing and a line saying what should change), newest first, from every workspace and the demo. Filter by status or workspace.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Only markups with this status.', { enum: STATUSES }),
      workspace: str('Only this workspace’s (its id).'),
      limit: { type: 'integer', description: 'At most this many (default 50).' },
    } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const list = await inbox(ctx).list({ ...(a.workspace ? { workspaceId: String(a.workspace) } : {}), ...(a.status ? { status: a.status as MarkupStatus } : {}), limit: Number(a.limit ?? 50) });
      const rows = list.map((m) => ({ id: m.id, status: m.status, line: m.line, place: placeOf(m), route: m.route, from: m.demo ? 'the demo' : m.workspaceName, by: m.personName, at: m.createdAt, issueUrl: m.issueUrl, fixedIn: m.fixedIn }));
      return { data: { markups: rows }, text: rows.length ? rows.map((r) => `${r.id} · ${STATUS_WORD[r.status]} · “${r.line}” · ${r.place} · ${r.by}, ${r.from}, ${r.at.slice(0, 10)}`).join('\n') : 'No markups.' };
    },
  },
  {
    name: 'get_markup',
    title: 'Open a markup',
    description: 'Builders: one markup in full: its line, the named screen parts under the drawing, the notes, where it was sent from (page, goal or review, screen size, theme, accent, app version), the steps before it and the errors on that visit, with links to its pictures that work for ten minutes.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('The markup’s id (mk_…), from list_markups.') } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const m = await inbox(ctx).open(String(a.id ?? ''));
      const notes = m.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [`${s.n}. ${s.text}`] : []));
      const text = [
        `${m.id} · ${STATUS_WORD[m.status]} · “${m.line}”`,
        `From ${m.personName || 'someone'} in ${m.demo ? 'the demo' : m.workspaceName}, ${m.createdAt}${m.mood ? `, saying ${MOOD_WORD[m.mood]}` : ''}.`,
        `Page ${m.path} (${m.route})${m.goalId ? `, goal ${m.goalId}` : ''}${m.reviewId ? `, review ${m.reviewId}` : ''}. Screen ${m.context.viewport.w}×${m.context.viewport.h}, ${m.context.theme}, accent ${m.context.accent}, version ${m.context.appVersion}.`,
        `Parts: ${namedParts(m).map(partText).join('; ') || 'none named'}.`,
        ...(notes.length ? [`Notes: ${notes.join(' ')}`] : []),
        `Steps: ${m.steps.length ? m.steps.map(stepText).join(' | ') : 'not included'}.`,
        `Errors: ${m.errors.length ? m.errors.map(problemText).join(' | ') : 'none'}.`,
        ...(m.issueUrl ? [`Issue: ${m.issueUrl}`] : []),
        ...(m.fixedIn ? [`Fixed in What’s new entry ${m.fixedIn}.`] : []),
        ...(m.wontFixReason ? [`Won’t fix: ${m.wontFixReason}`] : []),
        m.urls.marked || m.urls.screen ? `Picture (works for ten minutes): ${m.urls.marked ?? m.urls.screen}` : 'Picture: open it in Faro’s inbox (Workspace, signed in as a builder). This server can’t sign picture links without the database’s service role key.',
      ].join('\n');
      return { data: { markup: m }, text };
    },
  },
  {
    name: 'update_markup',
    title: 'Change a markup',
    description: 'Builders: set a markup’s status (new, in-hand, fixed with the What’s new entry id that has the fix, or wont-fix with a reason), and keep its GitHub issue’s address.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: {
      id: str('The markup’s id (mk_…).'),
      status: str('Its new status.', { enum: STATUSES }),
      fixed_in: str('With fixed: the What’s new entry’s id that has the fix.'),
      reason: str('With wont-fix: why it won’t be fixed.'),
      issue_url: str('The GitHub issue’s address, https://github.com/owner/repo/issues/123.'),
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx): Promise<ToolResult> {
      const ops = inbox(ctx);
      const id = String(a.id ?? '');
      if (!a.status && !a.issue_url) return { isError: true, text: 'Give a status, an issue_url, or both.' };
      let m = a.issue_url ? await ops.setIssueUrl(id, String(a.issue_url)) : null;
      if (a.status) m = await ops.setStatus(id, { status: a.status as MarkupStatus, fixedIn: a.fixed_in as string | undefined, reason: a.reason as string | undefined, by: `${ctx.actor.name} via AI assistant (MCP)` });
      return { data: { markup: m }, text: `${id} is ${STATUS_WORD[m!.status]}${m!.fixedIn ? `, fixed in ${m!.fixedIn}` : ''}${m!.issueUrl ? `, issue ${m!.issueUrl}` : ''}.` };
    },
  },
];
