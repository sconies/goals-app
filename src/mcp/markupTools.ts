/* The inbox, for an AI assistant: list markups, open one (its picture comes back inside the answer, as an image),
   review what's new in one step (review_inbox: new markups and feedback, grouped by screen part, with pictures) and
   change one (its status, its GitHub issue, the What's new entry that fixed it). Any token works: Faro's inbox is open
   to anyone on purpose (backlog O, Lane, 8 Nov; the internal app keeps its own restricted, spec R1 rule 6). The same
   operations as the inbox (src/markup/ops.ts), through the database's functions for tokens (migration 0031): no
   secret beyond the token. A change is recorded as the token's person, via the assistant. */
import type { InboxFeedback } from '../markup/feedback';
import { ADMINS_TRIAGE, mayTriage, MarkupError, MOOD_WORD, STATUS_WORD, STATUSES, groupMarkups, namedParts, partText, placeOf, problemText, sentFrom, stepText, type Markup, type MarkupStatus } from '../markup/model';
import { issueUrlOf, PICTURES_UNREADABLE, type MarkupOps, type MarkupPicture } from '../markup/ops';
import type { McpContext, ToolDef, ToolImage, ToolResult } from './tools';
import { listed } from './listed';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;

/** Which picture get_markup sends: the screen with the drawing on it (default), the screen alone, or none. */
const PICTURE_NAMES: Record<string, string[]> = { marked: ['marked.jpg', 'screen.png'], screen: ['screen.png', 'marked.jpg'], none: [] };
/** The most picture bytes one answer carries, so it stays well inside what the server can send back. */
const PICTURE_BUDGET = 3_000_000;

/** A markup's picture as an image, or the plain reason there isn't one (no key, or none kept). */
async function pictureOf(ops: MarkupOps, m: Pick<Markup, 'id' | 'pictures'>, names: string[]): Promise<{ image: ToolImage | null; picture: MarkupPicture | null; note: string | null }> {
  if (!names.length) return { image: null, picture: null, note: null };
  try {
    const p = await ops.picture(m, names);
    return p ? { image: { data: p.data, mimeType: p.mimeType }, picture: p, note: null } : { image: null, picture: null, note: 'It has no picture.' };
  } catch (e) {
    if (e instanceof MarkupError) return { image: null, picture: null, note: e.message };
    return { image: null, picture: null, note: 'Its picture couldn’t be read just now.' };
  }
}

/** The inbox, when this request may use it; otherwise why not, for the assistant to say. */
function inbox(ctx: McpContext): MarkupOps {
  if (!ctx.markups) throw new Error('This server has no inbox to read.');
  return ctx.markups;
}

export const MARKUP_TOOLS: ToolDef[] = [
  {
    name: 'list_markups',
    title: 'List markups',
    description: 'Markups people sent (a picture of a screen with a drawing and a line saying what should change), newest first, from every workspace and the demo. Filter by status or workspace.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Only markups with this status.', { enum: STATUSES }),
      workspace: str('Only this workspace’s (its id).'),
      limit: { type: 'integer', description: 'At most this many (default 50).' },
    } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const list = await inbox(ctx).list({ ...(a.workspace ? { workspaceId: String(a.workspace) } : {}), ...(a.status ? { status: a.status as MarkupStatus } : {}), limit: Number(a.limit ?? 50) });
      const rows = list.map((m) => ({ id: m.id, status: m.status, line: m.line, place: placeOf(m), route: m.route, from: sentFrom(m), by: m.personName, at: m.createdAt, issueUrl: m.issueUrl, fixedIn: m.fixedIn }));
      return listed({ markups: rows });
    },
  },
  {
    name: 'get_markup',
    title: 'Open a markup',
    description: 'One markup in full: its line, the named screen parts under the drawing, the notes, where it was sent from (page, goal or review, screen size, theme, accent, app version, the demo or a preview build), the steps before it and the errors on that visit. Its picture (the screen with the drawing on it) comes back in the answer as an image.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: {
      id: str('The markup’s id (mk_…), from list_markups or review_inbox.'),
      picture: str('Which picture to send: marked (the screen with the drawing, the default), screen (the screen alone) or none.', { enum: Object.keys(PICTURE_NAMES) }),
    } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const ops = inbox(ctx);
      const m = await ops.open(String(a.id ?? ''));
      const pic = await pictureOf(ops, m, PICTURE_NAMES[String(a.picture ?? 'marked')] ?? PICTURE_NAMES.marked!);
      const notes = m.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [`${s.n}. ${s.text}`] : []));
      const text = [
        `${m.id} · ${STATUS_WORD[m.status]} · “${m.line}”`,
        `From ${m.personName || 'someone'} in ${sentFrom(m)}, ${m.createdAt}${m.mood ? `, saying ${MOOD_WORD[m.mood]}` : ''}.`,
        `Page ${m.path} (${m.route})${m.goalId ? `, goal ${m.goalId}` : ''}${m.reviewId ? `, review ${m.reviewId}` : ''}. Screen ${m.context.viewport.w}×${m.context.viewport.h}, ${m.context.theme}, accent ${m.context.accent}, version ${m.context.appVersion}.`,
        `Parts: ${namedParts(m).map(partText).join('; ') || 'none named'}.`,
        ...(notes.length ? [`Notes: ${notes.join(' ')}`] : []),
        `Steps: ${m.steps.length ? m.steps.map(stepText).join(' | ') : 'not included'}.`,
        `Errors: ${m.errors.length ? m.errors.map(problemText).join(' | ') : 'none'}.`,
        ...(m.issueUrl ? [`Issue: ${m.issueUrl}`] : []),
        ...(m.fixedIn ? [`Fixed in What’s new entry ${m.fixedIn}.`] : []),
        ...(m.wontFixReason ? [`Won’t fix: ${m.wontFixReason}`] : []),
        pic.picture ? `Picture: ${pic.picture.name === 'marked.jpg' ? 'the screen with the drawing on it' : 'the screen'}, below.` : pic.note ? `Picture: ${pic.note}` : 'Picture: not asked for.',
      ].join('\n');
      const { urls, ...rest } = m;
      return { data: { markup: { ...rest, picture: pic.picture ? { name: pic.picture.name, mimeType: pic.picture.mimeType, bytes: pic.picture.bytes } : null, ...(pic.note ? { pictureNote: pic.note } : {}) }, urls }, text, ...(pic.image ? { images: [pic.image] } : {}) };
    },
  },
  {
    name: 'review_inbox',
    title: 'Review the inbox',
    description: 'Everything new in the inbox in one step, ready to triage: new markups grouped by the screen part they are about (newest first, with a count), each with its line, notes, who sent it and from where, and new feedback grouped by page. The newest markup of each group comes with its picture as an image. Then use update_markup and update_feedback.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Review markups and feedback with this status instead of new.', { enum: STATUSES }),
      workspace: str('Only this workspace’s (its id).'),
      pictures: { type: 'integer', description: 'How many groups get a picture (default 6, at most 12; 0 for none).' },
    } },
    annotations: READ,
    async run(a, ctx): Promise<ToolResult> {
      const ops = inbox(ctx);
      const status = (a.status as MarkupStatus | undefined) ?? 'new';
      const ws = a.workspace ? { workspaceId: String(a.workspace) } : {};
      const [markups, feedback] = await Promise.all([
        ops.list({ ...ws, status, limit: 200 }),
        ctx.feedback ? ctx.feedback.list(200, { ...ws, status }) : Promise.resolve([] as InboxFeedback[]),
      ]);
      const groups = groupMarkups(markups);
      const want = Math.min(Math.max(Number(a.pictures ?? 6), 0), 12);
      const images: ToolImage[] = [];
      let budget = PICTURE_BUDGET;
      let pictureNote: string | null = null;
      const out: string[] = [`${STATUS_WORD[status]} in the inbox: ${markups.length} markup${markups.length === 1 ? '' : 's'} on ${groups.length} part${groups.length === 1 ? '' : 's'}, ${feedback.length} piece${feedback.length === 1 ? '' : 's'} of feedback.`];
      const rows = [];
      for (const [i, g] of groups.entries()) {
        const where = g.part ? partText(g.part) : `${g.route || 'Somewhere in the app'} (no named part)`;
        let shown: string | null = null;
        if (i < want && !pictureNote) {
          const pic = await pictureOf(ops, g.markups[0]!, PICTURE_NAMES.marked!);
          if (pic.picture && pic.picture.bytes <= budget) { images.push(pic.image!); budget -= pic.picture.bytes; shown = g.markups[0]!.id; }
          else if (pic.note && pic.note === PICTURES_UNREADABLE) pictureNote = pic.note;
        }
        out.push('', `## ${where} · ${g.route} · ${g.markups.length} markup${g.markups.length === 1 ? '' : 's'}${shown ? ` · picture ${images.length} is ${shown}` : ''}`);
        for (const m of g.markups) {
          const notes = m.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [`${s.n}. ${s.text}`] : []));
          out.push(`- ${m.id} · “${m.line}”${notes.length ? ` · notes: ${notes.join(' ')}` : ''} · ${m.personName || 'someone'}, ${sentFrom(m)}, ${m.createdAt.slice(0, 16).replace('T', ' ')}${m.mood ? ` · ${MOOD_WORD[m.mood]}` : ''}${m.issueUrl ? ` · ${m.issueUrl}` : ''}`);
        }
        rows.push({ part: g.part, route: g.route, picture: shown, markups: g.markups.map((m) => ({ id: m.id, line: m.line, by: m.personName, from: sentFrom(m), at: m.createdAt, notes: m.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [s.text] : [])) })) });
      }
      const byPage = new Map<string, InboxFeedback[]>();
      for (const f of feedback) byPage.set(f.path || '/', [...(byPage.get(f.path || '/') ?? []), f]);
      for (const [page, fs] of byPage) {
        out.push('', `## Feedback on ${page} · ${fs.length}`);
        for (const f of fs) out.push(`- ${f.id} · ${MOOD_WORD[f.mood]} · “${f.text || '(no words)'}” · ${f.personName || f.personId}, ${f.workspaceName || f.workspaceId}, ${f.at.slice(0, 10)}`);
      }
      if (!ctx.feedback) out.push('', 'Feedback: this server can’t read feedback.');
      if (pictureNote) out.push('', `Pictures: ${pictureNote}`);
      else if (groups.length > images.length && want > 0) out.push('', 'For a picture not shown here, use get_markup with the markup’s id.');
      if (!markups.length && !feedback.length) out.push('', 'Nothing to review.');
      else out.push('', 'Next: update_markup and update_feedback (in-hand, fixed with fixed_in, or wont-fix with a reason).');
      return {
        data: { status, groups: rows, feedback: feedback.map((f) => ({ id: f.id, mood: f.mood, text: f.text, page: f.path, by: f.personName, from: f.workspaceName, at: f.at })), ...(pictureNote ? { pictureNote } : {}) },
        text: out.join('\n'), ...(images.length ? { images } : {}),
      };
    },
  },
  {
    name: 'update_markup',
    title: 'Change a markup',
    description: 'Set a markup’s status (admins only: new, in-hand, fixed with the What’s new entry id that has the fix, or wont-fix with a reason), and keep its GitHub issue’s address.',
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
      // Everything that can refuse is asked before anything is saved, so a refused call changes nothing: the address,
      // then the status (it refuses a member, and a fix with no entry), and only then the address is kept.
      if (a.issue_url) issueUrlOf(String(a.issue_url));
      if (a.issue_url && !mayTriage(ctx.actor)) throw new MarkupError(ADMINS_TRIAGE);
      let m = a.status ? await ops.setStatus(id, { status: a.status as MarkupStatus, fixedIn: a.fixed_in as string | undefined, reason: a.reason as string | undefined, by: `${ctx.actor.name} via MCP`, admin: !!ctx.actor.admin }) : null;
      if (a.issue_url) m = await ops.setIssueUrl(id, String(a.issue_url), !!ctx.actor.admin);
      return { data: { markup: m }, text: `${id} is ${STATUS_WORD[m!.status]}${m!.fixedIn ? `, fixed in ${m!.fixedIn}` : ''}${m!.issueUrl ? `, issue ${m!.issueUrl}` : ''}.` };
    },
  },
];
