/* Removing, archiving and undoing, for an AI assistant: the same rules and permissions as the app (domain/removal), so
   an assistant can mark someone as left, stop or delete a goal, delete a check-in, end a review, edit or remove a
   comment, undo an import, and list and restore what was removed, exactly as the person it acts for could. Every change
   is logged as that person, via the AI assistant. */
import type { Commit } from '../data/store';
import { editCall, type ActionContext } from '../domain/actions';
import { findGoal, isKey } from '../domain/goalKey';
import * as R from '../domain/removal';
import { checkInsFor } from '../domain/status';
import type { McpContext, ToolDef, ToolResult } from './tools';
import { COMMENT_REMOVED, ENDED, NOTE_REMOVED } from '../domain/vocabulary';
import { VIA_MCP } from '../domain/changeset';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const int = (description: string) => ({ type: 'integer', description });
const REMOVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const VIA = VIA_MCP;
const KINDS = Object.keys(R.REMOVED_LABEL) as R.RemovedKind[];

const ax = (ctx: McpContext): ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}), ...(ctx.full ? { full: ctx.full } : {}) });
async function save(ctx: McpContext, c: Commit, done: string): Promise<ToolResult> {
  await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
  return { text: `${done} (as ${ctx.actor.name}). It can be restored for 30 days: restore_removed, or an admin on Workspace → Recently removed.` };
}
const goalOf = (ctx: McpContext, id: unknown) => {
  const g = findGoal(ctx.snapshot.goals, String(id ?? ''));
  if (!g) throw new Error(`There’s no live goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};
/** A person here now, by ID or by name. */
const personOf = (ctx: McpContext, ref: unknown) => {
  const t = String(ref ?? '').trim().toLowerCase();
  const p = ctx.snapshot.people.find((x) => x.id === ref) ?? ctx.snapshot.people.find((x) => x.name.toLowerCase() === t) ?? ctx.snapshot.people.filter((x) => x.name.toLowerCase().startsWith(t)).at(0);
  if (!t || !p) throw new Error(`There’s no one called ${String(ref)} in this workspace. Use list_people.`);
  return p;
};
const optPerson = (ctx: McpContext, ref: unknown) => (ref == null || ref === '' ? null : personOf(ctx, ref).id);

export const REMOVE_TOOLS: ToolDef[] = [
  {
    name: 'list_removed',
    title: 'Recently removed',
    description: 'Everything removed in the last 30 days, newest first: people who left or were deleted, deleted and stopped goals, deleted check-ins, ended and deleted reviews, removed comments and review notes, deleted saved views, stopped watches and deleted cycles. Admins see everything; anyone else sees what they removed. Each has a kind and an ID for restore_removed.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(_a, ctx) {
      const all = R.recentlyRemoved(ctx.full ?? ctx.snapshot, ctx.today).filter((r) => R.canRestore(ctx.actor, r));
      const who = (id: string | null) => (ctx.full ?? ctx.snapshot).people.find((p) => p.id === id)?.name ?? '—';
      const list = all.map((r) => ({ kind: r.kind, label: R.REMOVED_LABEL[r.kind], id: r.id, name: r.name, removedBy: who(r.by), at: r.at }));
      return { data: { removed: list }, text: list.length ? list.map((r) => `${r.kind} · ${r.id} · ${r.label}: ${r.name} · by ${r.removedBy}, ${r.at.slice(0, 10)}`).join('\n') : 'Nothing removed in the last 30 days.' };
    },
  },
  {
    name: 'restore_removed',
    title: 'Restore something removed',
    description: 'Bring back something from list_removed: an admin, or whoever removed it. It comes back as it was; what was handed over or moved when it went stays where it is now.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: { kind: str('Its kind, from list_removed.', { enum: KINDS }), id: str('Its ID, from list_removed.') } },
    annotations: WRITE,
    async run(a, ctx) {
      if (!KINDS.includes(a.kind as R.RemovedKind)) throw new Error(`kind is one of ${KINDS.join(', ')}.`);
      const c = R.restoreRemoved(ax(ctx), a.kind as R.RemovedKind, String(a.id ?? ''));
      await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
      return { text: `${c.changes[0]?.summary ?? 'Restored'} (as ${ctx.actor.name}).` };
    },
  },
  {
    name: 'mark_person_left',
    title: 'Mark someone as left',
    description: 'Admins: mark someone as left the workspace. Their goals in this cycle go to goals_to and the open asks they raised or must answer go to asks_to (both required when they have any); they leave their reviews, and teams they led pass to goals_to. They vanish from pickers, counts, reviews and Home; history keeps their name as “Name (left)”. Someone with no history at all is deleted instead: use delete_person.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['person'], properties: { person: str('Their ID or full name.'), goals_to: str('Who takes over their goals: an ID or full name.'), asks_to: str('Who takes over their open asks: an ID or full name.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const p = personOf(ctx, a.person);
      return save(ctx, R.markPersonLeft(ax(ctx), p.id, { goalsTo: optPerson(ctx, a.goals_to), asksTo: optPerson(ctx, a.asks_to) }), `Marked ${p.name} as left`);
    },
  },
  {
    name: 'delete_person',
    title: 'Delete someone with no history',
    description: 'Admins: delete someone who has no history here (no goals, check-ins, notes or asks), say someone added by mistake. Anyone with history is marked as left instead (mark_person_left).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['person'], properties: { person: str('Their ID or full name.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const p = personOf(ctx, a.person);
      return save(ctx, R.deletePerson(ax(ctx), p.id), `Deleted ${p.name}`);
    },
  },
  {
    name: 'stop_goal',
    title: 'Stop a goal',
    description: 'The goal’s owner or an admin: stop a goal that has check-ins, mid-cycle, with a reason. It leaves stats, reviews, Home, Watching and attention lists, but stays in its history, on its page (marked Stopped), in exports and in Activity. The goals feeding it move up to what it fed; its open asks are withdrawn with a note. A goal with no check-ins is deleted instead (delete_goal).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'reason'], properties: { goal_id: str('The goal’s ID or key, e.g. G-12.'), reason: str('Why it’s stopping, in a sentence (10 characters or more).') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const g = goalOf(ctx, a.goal_id);
      return save(ctx, R.stopGoal(ax(ctx), g.id, String(a.reason ?? '')), `Stopped ${g.title}`);
    },
  },
  {
    name: 'delete_goal',
    title: 'Delete a goal with no check-ins',
    description: 'The goal’s owner or an admin: delete a goal that has no check-ins (set up by mistake). The goals feeding it move up to what it fed; its open asks are withdrawn. A goal with check-ins is stopped instead (stop_goal), so its history stays.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or key, e.g. G-12.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const g = goalOf(ctx, a.goal_id);
      return save(ctx, R.deleteGoal(ax(ctx), g.id), `Deleted ${g.title}`);
    },
  },
  {
    name: 'delete_check_in',
    title: 'Delete a check-in',
    description: 'Whoever posted it, or an admin: delete a goal’s latest check-in. Once a newer one is posted it can only be corrected (post_check_in for that week). The status is worked out again from the one before. Give the check-in’s ID (from get_goal), or the goal and the week.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { check_in_id: str('The check-in’s ID, from get_goal.'), goal_id: str('Or: the goal’s ID or key…'), week: int('…and the week of its latest check-in.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      let id = a.check_in_id ? String(a.check_in_id) : '';
      if (!id) {
        const g = goalOf(ctx, a.goal_id);
        const c = checkInsFor(g, ctx.snapshot.checkIns).filter((x) => a.week == null || x.week === Number(a.week)).at(-1);
        if (!c) throw new Error(`${g.title} has no check-in${a.week != null ? ` for week ${String(a.week)}` : ''}.`);
        id = c.id;
      }
      const c = ctx.snapshot.checkIns.find((x) => x.id === id);
      return save(ctx, R.deleteCheckIn(ax(ctx), id), `Deleted the check-in for week ${c?.week ?? '?'}`);
    },
  },
  {
    name: 'end_review',
    title: 'End a review',
    description: 'Whoever set up the review, or an admin: end it. It keeps its notes and actions and stops showing as due. A review that was never held is deleted instead.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id'], properties: { review_id: str('The review’s ID, from list_reviews.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const r = ctx.snapshot.reviews.find((x) => x.id === a.review_id);
      const out = R.endReview(ax(ctx), String(a.review_id ?? ''));
      return save(ctx, out.commit, `${out.deleted ? 'Deleted (it was never held)' : ENDED} the review “${r?.name ?? ''}”`);
    },
  },
  {
    name: 'delete_review',
    title: 'Delete a review never held',
    description: 'Whoever set up the review, or an admin: delete a review that has never been held. One that has been held is ended instead (end_review), so its notes and actions stay.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id'], properties: { review_id: str('The review’s ID, from list_reviews.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const r = ctx.snapshot.reviews.find((x) => x.id === a.review_id);
      return save(ctx, R.deleteReview(ax(ctx), String(a.review_id ?? '')), `Deleted the review “${r?.name ?? ''}”`);
    },
  },
  {
    name: 'edit_comment',
    title: 'Edit a comment or review note',
    description: 'Correct the words of a comment (only whoever wrote it) or of a note said in a review (whoever said it, or an admin). It then shows as edited. Comment IDs are in get_goal’s comments; review notes’ IDs in get_review.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['comment_id', 'text'], properties: { comment_id: str('The comment’s or note’s ID.'), text: str('The corrected words.') } },
    annotations: WRITE,
    async run(a, ctx) {
      const id = String(a.comment_id ?? '');
      const note = ctx.snapshot.decisions.find((d) => d.id === id);
      if (note) {
        const c = editCall(ax(ctx), note, String(a.text ?? ''));
        if (!c) return { text: 'Nothing to change: it already says that.' };
        await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
        return { text: `Corrected the note (as ${ctx.actor.name}).` };
      }
      const c = R.editComment(ax(ctx), id, String(a.text ?? ''));
      if (!c) return { text: 'Nothing to change: it already says that.' };
      await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
      return { text: `Edited the comment (as ${ctx.actor.name}).` };
    },
  },
  {
    name: 'delete_comment',
    title: 'Remove a comment or review note',
    description: `Remove a comment, or a note said in a review: whoever wrote it, or an admin. Its place in the thread then says “${COMMENT_REMOVED}” (or “${NOTE_REMOVED}”), so the thread still reads.`,
    inputSchema: { type: 'object', additionalProperties: false, required: ['comment_id'], properties: { comment_id: str('The comment’s or note’s ID.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const id = String(a.comment_id ?? '');
      if (ctx.snapshot.decisions.some((d) => d.id === id)) return save(ctx, R.deleteNote(ax(ctx), id), 'Removed the note');
      return save(ctx, R.deleteComment(ax(ctx), id), 'Removed the comment');
    },
  },
  {
    name: 'delete_cycle',
    title: 'Delete a cycle',
    description: 'Admins: delete a cycle no one has checked in to yet (started by mistake, say), and with it its goals. Not the only cycle.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['cycle_id'], properties: { cycle_id: str('The cycle’s ID.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const c = (ctx.full ?? ctx.snapshot).cycles.find((x) => x.id === a.cycle_id);
      return save(ctx, R.deleteCycle(ax(ctx), String(a.cycle_id ?? '')), `Deleted the cycle ${c?.name ?? ''}`);
    },
  },
  {
    name: 'undo_import',
    title: 'Undo an import or bulk edit',
    description: 'Whoever made it, or an admin: put every row an import, bulk edit or bulk_change wrote back as it was. Goals and check-ins it added are deleted; ones it changed get their earlier version back. Rows changed since are skipped and listed. Import IDs are in get_activity (kind=imports).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['import_id'], properties: { import_id: str('The import’s ID (imp_…), from get_activity.') } },
    annotations: REMOVE,
    async run(a, ctx) {
      const out = R.undoImport(ax(ctx), String(a.import_id ?? ''));
      await ctx.save({ ...out.commit, changes: out.commit.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
      return { data: { restored: out.restored, skipped: out.skipped }, text: `Undid the import (as ${ctx.actor.name}): ${out.restored} ${out.restored === 1 ? 'row' : 'rows'} put back.${out.skipped.length ? ` Skipped, as changed since: ${out.skipped.join('; ')}.` : ''}` };
    },
  },
];
