/* Feedback's AI tools (SW1): the builders' inbox (markups and feedback: list, read, review, change a status) and
   send_feedback. Their code is still src/mcp/markupTools.ts and feedbackTools.ts, and the rule src/domain/actions.ts
   sendFeedback, until SW4 moves them here; being this module's tools, the core's callTool refuses them with its
   switched-off sentence while Feedback is off in the workspace. What was sent stays in the builders' inbox. */
import * as A from '../../domain/actions';
import type { ToolDef } from '../../mcp/tools';
import { MARKUP_TOOLS } from '../../mcp/markupTools';
import { FEEDBACK_TOOLS } from '../../mcp/feedbackTools';
import { ax, save, WRITE } from '../../mcp/workTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });

const tools: ToolDef[] = [
  ...MARKUP_TOOLS,
  ...FEEDBACK_TOOLS,
  {
    name: 'send_feedback',
    title: 'Send feedback about the app',
    description: 'Feedback about the app itself, for the people who build it: how it felt and what happened.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['mood', 'text'], properties: { mood: str('How it felt.', { enum: ['good', 'meh', 'bad'] }), text: str('What happened, or what would help.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.sendFeedback(ax(ctx), a.mood as 'good' | 'meh' | 'bad', String(a.text ?? ''), 'mcp'), 'Sent the feedback', ''); },
  },
];

export default tools;
