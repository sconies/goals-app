/* Feedback about the app, for an AI assistant, and its triage, as the markup tools triage markups (backlog 5). Any
   token (Faro's inbox is open on purpose, backlog O) lists every workspace's feedback with its status, opens one and
   changes its status: New, In hand, Fixed (naming the What's new entry with the fix) or Won't fix (with a reason). The
   same operations and rules as the inbox (src/markup/feedback.ts feedbackOps, model.ts statusPatch), through the
   database's functions for tokens (migrations 0028 and 0031): no secret beyond the token. A server with no inbox
   (tests) falls back to the workspace's own feedback, for admins. */
import { MOOD_WORD, STATUS_WORD, STATUSES, type MarkupStatus } from '../markup/model';
import type { FeedbackOps, InboxFeedback } from '../markup/feedback';
import type { McpContext, ToolDef, ToolResult } from './tools';
import { listed } from './listed';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const NO_INBOX = 'This server has no inbox to triage feedback in.';

/** The inbox's feedback operations, when this server has them; otherwise why not, for the assistant to say. */
function triage(ctx: McpContext): FeedbackOps {
  if (!ctx.feedback) throw new Error(NO_INBOX);
  return ctx.feedback;
}

const outcome = (f: Pick<InboxFeedback, 'status' | 'fixedIn' | 'wontFixReason'>) => `${STATUS_WORD[f.status]}${f.fixedIn ? `, fixed in ${f.fixedIn}` : ''}${f.wontFixReason ? `: ${f.wontFixReason}` : ''}`;

export const FEEDBACK_TOOLS: ToolDef[] = [
  {
    name: 'list_feedback',
    title: 'Feedback about the app',
    description: 'What people said through Send feedback (a mood and a few words), newest first, from every workspace, each with its status (new, in-hand, fixed, wont-fix); filter by status or workspace.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Only feedback with this status.', { enum: STATUSES }),
      workspace: str('Only this workspace’s (its id).'),
      limit: { type: 'integer', description: 'At most this many (default 50).' },
    } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      if (ctx.feedback) {
        const list = await ctx.feedback.list(Number(a.limit ?? 50), { ...(a.workspace ? { workspaceId: String(a.workspace) } : {}), ...(a.status ? { status: a.status as MarkupStatus } : {}) });
        const rows = list.map((f) => ({ id: f.id, status: f.status, mood: f.mood, text: f.text, screen: f.path, by: f.personName, from: f.workspaceName, at: f.at, fixedIn: f.fixedIn, wontFixReason: f.wontFixReason }));
        return listed({ feedback: rows });
      }
      if (a.status || a.workspace) return { isError: true, text: `${NO_INBOX} An admin’s token lists this workspace’s feedback, without statuses.` };
      if (!ctx.actor.admin) return { isError: true, text: 'Only admins can read the feedback.' };
      const who = (id: string) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? '—';
      const list = [...(ctx.snapshot.feedback ?? [])].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, a.limit ? Number(a.limit) : undefined).map((f) => ({ id: f.id, at: f.at, by: who(f.personId), mood: f.mood, screen: f.path, text: f.text }));
      return listed({ feedback: list });
    },
  },
  {
    name: 'get_feedback',
    title: 'Open a piece of feedback',
    description: 'One piece of feedback in full: its words and mood, the screen it was sent from, who sent it from which workspace and when, and its status (with the What’s new entry that fixed it, or why it won’t be fixed, and who said so).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('The feedback’s id, from list_feedback.') } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const f = await triage(ctx).open(String(a.id ?? ''));
      const text = [
        `${f.id} · ${outcome(f)}`,
        `“${f.text || '(no words)'}”, saying ${MOOD_WORD[f.mood]}.`,
        `From ${f.personName || f.personId || 'someone'} in ${f.workspaceName || f.workspaceId}, ${f.at}, on ${f.path || '/'}.`,
        ...(f.statusBy ? [`Status set by ${f.statusBy}${f.statusAt ? `, ${f.statusAt}` : ''}.`] : []),
      ].join('\n');
      return { data: { feedback: f }, text };
    },
  },
  {
    name: 'update_feedback',
    title: 'Change a piece of feedback',
    description: 'Set a piece of feedback’s status (admins only), with the inbox’s rules: new, in-hand, fixed (with fixed_in, the What’s new entry id that has the fix; its sender then sees “You raised this” there) or wont-fix (with a reason).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id', 'status'], properties: {
      id: str('The feedback’s id.'),
      status: str('Its new status.', { enum: STATUSES }),
      fixed_in: str('With fixed: the What’s new entry’s id that has the fix.'),
      reason: str('With wont-fix: why it won’t be fixed.'),
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx): Promise<ToolResult> {
      const ops = triage(ctx);
      const id = String(a.id ?? '');
      const t = await ops.setStatus(id, { status: a.status as MarkupStatus, fixedIn: a.fixed_in as string | undefined, reason: a.reason as string | undefined, by: `${ctx.actor.name} via MCP`, admin: !!ctx.actor.admin });
      return { data: { feedback: { id, ...t } }, text: `${id} is ${outcome(t)}`.replace(/([^.])$/, '$1.') };
    },
  },
];
