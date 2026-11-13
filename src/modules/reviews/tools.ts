/* Reviews' AI tools (FT2): list the reviews and read one's agenda, say something in a review, set one up or change it,
   end one and delete one never held. Their rules are still the core's (src/domain/actions.ts, removal.ts, review.ts)
   until FT3 moves them here; being this module's tools, the core's callTool refuses them with its switched-off sentence
   while Reviews is off in the workspace, as for any module's. Every change is logged as the person, via the assistant. */
import * as A from '../../domain/actions';
import * as R from '../../domain/removal';
import { agendaOf, answerOf, lastHeld, openActions, reviewSession, sessionState, sessionStateText, sessionWeek } from '../../domain/review';
import { ASK_STATUS, ATTENTION, ENDED, LABEL } from '../../domain/vocabulary';
import { beforeReview, weekWords } from '../../domain/habit';
import type { Review } from '../../domain/types';
import type { ToolDef } from '../../mcp/tools';
import { listed } from '../../mcp/listed';
import { ax, goalIds, goalOf, levelsOf, lines, name, personOf, READ, reviewOf, said, save, WRITE } from '../../mcp/workTools';
import { ax as axRemove, REMOVE, save as saveRemoved } from '../../mcp/removeTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const int = (description: string) => ({ type: 'integer', description });
const ids = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

const tools: ToolDef[] = [
  {
    name: 'list_reviews',
    title: 'Reviews',
    description: 'Every review in the workspace: its cadence, the goals it walks and who’s in it, with this session’s progress.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = ctx.snapshot.reviews.map((r) => {
        const x = reviewSession(r, ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
        const held = lastHeld(r, ctx.snapshot, x.week);
        return { id: r.id, name: r.name, everyWeeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people.map((p) => name(ctx, p)), sessionWeek: x.week, sessionDate: x.date, reviewed: x.done, of: x.total, state: sessionStateText(sessionState(x)), lastHeld: held?.on ?? null, openActions: openActions(r, ctx.snapshot).length, youreIn: r.people.includes(ctx.actor.id) };
      });
      return listed({ reviews: list });
    },
  },
  {
    name: 'get_review',
    title: 'A review’s agenda',
    description: 'One review’s current session: the goals to discuss (new information first, worst first, with why; those already being handled say what’s in hand), the healthy ones, and what has been said so far: notes, questions for owners (with any answers) and actions.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id'], properties: { review_id: str('The review’s ID, from list_reviews.') } },
    annotations: READ,
    async run(a, ctx) {
      const r = reviewOf(ctx, a.review_id);
      const x = reviewSession(r, ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
      const ag = agendaOf(x);
      const item = (g: (typeof ag.discuss)[number]) => ({ id: g.goal.id, title: g.goal.title, owner: name(ctx, g.goal.ownerId), status: g.status.status, statusLabel: LABEL[g.status.status], why: g.flags.map((f) => f.detail), beingHandled: g.handled?.text ?? null });
      const saidHere = x.said.map((d) => ({ id: d.id, goalId: d.goalId, kind: d.kind, note: d.note, by: name(ctx, d.byId), ...(d.kind === 'action' ? { who: name(ctx, d.assigneeId ?? null), dueWeek: d.dueWeek ?? null } : {}), ...(d.ask ? { status: d.ask.status, statusLabel: ASK_STATUS[d.ask.status].label, answer: answerOf(d)?.text ?? null } : {}) }));
      // Before this review (habit spec 2.3): weeks, not people; absent for a set with fewer than three owners (rule 4).
      const b = beforeReview(x.items.map((i) => i.goal), x.week, { checkIns: ctx.snapshot.checkIns, asks: ctx.snapshot.requests ?? [] }, ctx.cycle, ctx.today, ctx.actor.id);
      const before = b ? { says: b.says, due: b.counts.due, inTime: b.counts.inTime, withoutAsking: b.counts.unasked, afterAnAsk: b.counts.asked, after: b.counts.after, noCheckIn: b.counts.none, lastWeeks: b.weeks.map((w) => ({ week: w.week, mark: w.mark, says: weekWords(w) })) } : null;
      const data = { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total, beforeThisReview: before, toDiscuss: ag.discuss.map(item), healthy: ag.healthy.map(item), said: saidHere };
      return { data, text: `${r.name}, week ${x.week} (${x.date}): ${x.done} of ${x.total} reviewed.${before ? ` Before this review: ${before.says} Last ${before.lastWeeks.length} weeks: ${before.lastWeeks.map((w) => `week ${w.week} ${w.says.toLowerCase()}`).join(', ')}.` : ''}\nTo discuss:\n${lines(data.toDiscuss.map((g) => `- ${g.title} (${g.id}), ${g.owner}: ${said(g.status)}.${g.beingHandled ? ` ${ATTENTION.handled.label}: ${g.beingHandled}.` : ''} ${g.why.join(' ')}`), '- nothing')}\nNothing flagged: ${data.healthy.map((g) => g.title).join(', ') || 'none'}.` };
    },
  },
  {
    name: 'review_call',
    title: 'Say something in a review',
    description: 'In a review, about one goal: mark it reviewed (acknowledge), add a note, ask the owner a question, agree an action (who and by when), or accept the risk on a goal behind (accept, with the reason as text). A goal off track or at risk leaves a review with a decision: an action with who and due_week, or accept. Logged in this session of the review. Only someone in the review, or an admin, can, and only about a goal the review covers (its goals, trees and levels). A question or an action is an ask: open until it’s answered (answer_request) or done (mark_action_done), or withdrawn.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id', 'goal_id', 'kind'], properties: {
      review_id: str('The review’s ID.'), goal_id: str('The goal’s ID or its key, e.g. G-12.'),
      kind: str('What it is.', { enum: ['acknowledge', 'note', 'ask', 'action', 'accept'] }),
      text: str('The note, question or action, or (accept) why the review accepts the risk. Optional when acknowledging.'),
      who: str('Actions: who does it (name or ID). Defaults to the goal’s owner.'),
      due_week: int('Actions: the week it’s due by.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const r = reviewOf(ctx, a.review_id), g = goalOf(ctx, a.goal_id);
      if (a.kind === 'accept') return save(ctx, A.acceptRisk(ax(ctx), g, r, String(a.text ?? ''), sessionWeek(r, ctx.week, ctx.cycle)), `Accepted the risk: ${g.title} in ${r.name}`, '');
      const kind = a.kind as A.CallKind;
      if (!['acknowledge', 'note', 'ask', 'action'].includes(kind)) throw new Error('kind is acknowledge, note, ask, action or accept.');
      const assigneeId = kind === 'action' && a.who ? personOf(ctx, a.who).id : undefined;
      return save(ctx, A.reviewCall(ax(ctx), g, r, kind, String(a.text ?? ''), { assigneeId, dueWeek: a.due_week as number | undefined }), `${({ acknowledge: 'Marked reviewed', note: 'Added a note', ask: 'Asked the owner', action: 'Agreed an action' } as const)[kind]}: ${g.title} in ${r.name}`, '');
    },
  },
  {
    name: 'unmark_reviewed',
    title: 'Undo marking goals reviewed',
    description: 'Undo marking one or more goals reviewed in a review (review_call with acknowledge): they go back on the agenda. Whoever marked them, or an admin. The log keeps both.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['call_ids'], properties: { call_ids: { type: 'array', items: { type: 'string' }, description: 'The marks’ IDs (kind acknowledge), from get_review.' } } },
    annotations: WRITE,
    async run(a, ctx) {
      const ids = ((a.call_ids as unknown[] | undefined) ?? []).map(String);
      const marks = ctx.snapshot.decisions.filter((d) => ids.includes(d.id));
      if (!marks.length) throw new Error('There’s no mark with those IDs. Use get_review.');
      return save(ctx, R.unmarkReviewed(ax(ctx), marks), `Undone: ${marks.length === 1 ? 'back' : `${marks.length} goals back`} on the agenda`, '');
    },
  },
  {
    name: 'save_review',
    title: 'Set up or change a review',
    description: 'Set up a review (anyone can), or change one (someone in it, whoever set it up, or an admin): its name, how often, the weekday, the goals it walks (goals, goals with everything feeding them, or whole levels) and who’s in it. Without review_id it sets up a new one.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      review_id: str('The review to change. Leave out to set up a new one.'),
      name: str('Its name, e.g. "Platform weekly review".'),
      every_weeks: int('Held every 1, 2 or 4 weeks.'),
      weekday: str('The weekday.', { enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }),
      goals: ids('Goal IDs or keys it walks.'), trees: ids('Goal IDs or keys it walks with everything feeding them.'), levels: ids('Levels it walks: north-star, svp, team.'),
      people: ids('Who’s in it (names or IDs). New reviews include you.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const day = a.weekday === undefined ? undefined : DAYS.indexOf(String(a.weekday).toLowerCase());
      if (day === -1) throw new Error('weekday is Monday to Friday.');
      const people = a.people ? [...new Set([...(a.people as string[]).map((p) => personOf(ctx, p).id)])] : undefined;
      if (a.review_id) {
        const before = reviewOf(ctx, a.review_id);
        const scope = { goals: goalIds(ctx, a.goals) ?? before.scope.goals, trees: goalIds(ctx, a.trees) ?? before.scope.trees, levels: a.levels ? levelsOf(a.levels) : before.scope.levels };
        const after: Review = { ...before, name: a.name !== undefined ? String(a.name).trim() : before.name, everyWeeks: a.every_weeks !== undefined ? Number(a.every_weeks) : before.everyWeeks, weekday: day ?? before.weekday, scope, people: people ?? before.people };
        return save(ctx, A.saveReview(ax(ctx), after, before), `Changed the review “${after.name}”`, '');
      }
      const r = A.newReview(ax(ctx), { name: String(a.name ?? ''), everyWeeks: Number(a.every_weeks ?? 1), weekday: day ?? ctx.cycle.reviewDay, goals: goalIds(ctx, a.goals), trees: goalIds(ctx, a.trees), levels: levelsOf(a.levels), people: people ? [...new Set([ctx.actor.id, ...people])] : undefined });
      const out = await save(ctx, A.saveReview(ax(ctx), r, null), `Set up the review “${r.name}” (ID ${r.id})`, '');
      return { ...out, data: { id: r.id } };
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
      const out = R.endReview(axRemove(ctx), String(a.review_id ?? ''));
      return saveRemoved(ctx, out.commit, `${out.deleted ? 'Deleted (it was never held)' : ENDED} the review “${r?.name ?? ''}”`);
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
      return saveRemoved(ctx, R.deleteReview(axRemove(ctx), String(a.review_id ?? '')), `Deleted the review “${r?.name ?? ''}”`);
    },
  },
];

export default tools;
