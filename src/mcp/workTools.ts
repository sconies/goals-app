/* The rest of what a person can do, for their AI assistant: requests, asks for an update, reviews, watching, people,
   wrap-ups and the next cycle, saved views, tokens and feedback, plus what needs them and the activity log. Each write
   is a shared action (domain/actions.ts), so the assistant meets exactly the rules the person does in the app, and every
   change it makes is logged as that person, via the AI assistant. Check-ins, goals and plans are in tools.ts. */
import type { Commit } from '../data/store';
import * as A from '../domain/actions';
import { activityFilter, parseActivity } from '../domain/activity';
import { attentionList } from '../domain/attention';
import { wrapUpOpen } from '../domain/cycle';
import { askText, openForPerson, requestsOf } from '../domain/requests';
import { agendaOf, answerOf, openQuestions, reviewSession, watchedGoals } from '../domain/review';
import { checkInsFor } from '../domain/status';
import { toCsv, workbook } from '../domain/export';
import { choosableColumns, isDataTable, isTableView, layoutProblems, MAX_WIDTH, parseLayout, shownTable, TABLE_ORDER, TABLES, type DataTable, type TableLayout } from '../domain/tableLayout';
import { findGoal, isKey } from '../domain/goalKey';
import type { Level, Retro, Review, Watch } from '../domain/types';
import { isUpdateAsk, liveNotes } from '../domain/updateAsks';
import { hashToken, newToken } from './protocol';
import type { McpContext, ToolDef, ToolResult } from './tools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const int = (description: string) => ({ type: 'integer', description });
const bool = (description: string) => ({ type: 'boolean', description });
const ids = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const LEVELS: Level[] = ['north-star', 'svp', 'team'];
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const VIA = { field: 'Via', from: '—', to: 'AI assistant (MCP)' };

const ax = (ctx: McpContext): A.ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId });

/** Saves what an action returned, marked as done through the assistant. Null: nothing to save. */
async function save(ctx: McpContext, c: Commit | null, done: string, nothing: string): Promise<ToolResult> {
  if (!c) return { text: nothing };
  await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
  return { text: `${done} (as ${ctx.actor.name}).` };
}

const name = (ctx: McpContext, id: string | null | undefined) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? '—';
/** A goal by its ID or its key (G-12). */
const goalOf = (ctx: McpContext, id: unknown) => {
  const g = findGoal(ctx.snapshot.goals, String(id ?? ''));
  if (!g) throw new Error(`There’s no goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};
const goalIds = (ctx: McpContext, v: unknown) => (v as string[] | undefined)?.map((id) => goalOf(ctx, id).id);
const requestOf = (ctx: McpContext, id: unknown) => {
  const r = requestsOf(ctx.snapshot).find((x) => x.id === id);
  if (!r) throw new Error(`There’s no request with ID ${String(id)}. Use list_requests to get IDs.`);
  return r;
};
const reviewOf = (ctx: McpContext, id: unknown) => {
  const r = ctx.snapshot.reviews.find((x) => x.id === id);
  if (!r) throw new Error(`There’s no review with ID ${String(id)}. Use list_reviews to get IDs.`);
  return r;
};
/** A person by ID or by name (whole or the start of it), for tools that name someone. */
const personOf = (ctx: McpContext, ref: unknown) => {
  const t = String(ref ?? '').trim().toLowerCase();
  const p = ctx.snapshot.people.find((x) => x.id === ref) ?? ctx.snapshot.people.find((x) => x.name.toLowerCase() === t) ?? ctx.snapshot.people.filter((x) => x.name.toLowerCase().startsWith(t)).at(0);
  if (!t || !p) throw new Error(`There’s no one called ${String(ref)} in this workspace. Use list_people.`);
  return p;
};
const teamOf = (ctx: McpContext, ref: unknown) => {
  if (ref === '' || ref === null) return null;
  const t = String(ref).trim().toLowerCase();
  const team = ctx.snapshot.teams.find((x) => x.id === ref || x.name.toLowerCase() === t);
  if (!team) throw new Error(`There’s no team called ${String(ref)}. Teams: ${ctx.snapshot.teams.map((x) => x.name).join(', ')}.`);
  return team.id;
};
const levelsOf = (v: unknown): Level[] => {
  const list = ((v as string[] | undefined) ?? []).map((l) => l.toLowerCase().replace(/\s+/g, '-'));
  const bad = list.filter((l) => !LEVELS.includes(l as Level));
  if (bad.length) throw new Error(`Levels are north-star, svp and team (not ${bad.join(', ')}).`);
  return list as Level[];
};
const requestData = (ctx: McpContext, r: ReturnType<typeof requestOf>) => ({
  id: r.id, ask: askText(r, ctx.snapshot.people), status: r.status, askedBy: name(ctx, r.askedBy), askedOf: r.recipientId ? name(ctx, r.recipientId) : 'anyone',
  goals: r.goalIds.map((g) => { const x = ctx.snapshot.goals.find((y) => y.id === g); return { id: g, key: x?.key ?? null, title: x?.title ?? g }; }), raisedAt: r.createdAt,
  answer: r.answer, answeredBy: r.answeredBy ? name(ctx, r.answeredBy) : null, youCanAnswer: r.status === 'open' && (!r.recipientId || r.recipientId === ctx.actor.id || ctx.actor.admin),
});
const lines = (l: string[], none: string) => (l.length ? l.join('\n') : none);

/** A data table's sheet, from the same workbook the Data screen and the exports use. */
const sheetOf = (ctx: McpContext, t: DataTable) => workbook({ ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today }).find((x) => x.name === TABLES[t].sheet)!;
const headOf = (ctx: McpContext, t: DataTable) => (sheetOf(ctx, t).rows[0] ?? []).map((c) => String(c ?? ''));
/** A table layout from a tool's arguments: a saved table view by name, or a table with columns, widths and a query. */
function layoutFrom(ctx: McpContext, a: Record<string, unknown>): TableLayout {
  if (a.view != null) {
    const v = (ctx.snapshot.views ?? []).find((x) => !x.deletedAt && isTableView(x) && (x.pinned || x.personId === ctx.actor.id) && x.name.toLowerCase() === String(a.view).toLowerCase());
    const l = v ? parseLayout(v.params) : null;
    if (!l) throw new Error(`There’s no table view called “${String(a.view)}” that you can see. Use list_views.`);
    return l;
  }
  if (!isDataTable(a.table)) throw new Error(`Say which table: ${TABLE_ORDER.join(', ')}.`);
  const parsed = parseLayout(`table=${a.table}&${String(a.query ?? '').replace(/^.*\?/, '')}`)!;
  const widths = (a.widths ?? {}) as Record<string, number>;
  const layout: TableLayout = { ...parsed, cols: (a.columns as string[] | undefined)?.length ? (a.columns as string[]) : null, widths: Object.fromEntries(Object.entries(widths).map(([c, w]) => [c, Number(w)])) };
  const problems = layoutProblems(layout, headOf(ctx, layout.table));
  if (problems.length) throw new Error(`${problems.join(' ')} Its columns: ${choosableColumns(layout.table, headOf(ctx, layout.table)).join(', ')}.`);
  return layout;
}

export const WORK_TOOLS: ToolDef[] = [
  /* ---------- Reading ---------- */
  {
    name: 'get_my_work',
    title: 'What needs me',
    description: 'What needs the person this week, as their Home shows it: their goals with no check-in yet this week or that need attention, requests for a decision or help waiting on them, questions from reviews on their goals, asks for an update, actions they agreed to, and the reviews they’re in.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const s = ctx.snapshot, me = ctx.actor.id;
      const mine = s.goals.filter((g) => g.ownerId === me);
      const due = mine.filter((g) => !checkInsFor(g, s.checkIns).some((c) => c.week === ctx.week)).map((g) => ({ id: g.id, title: g.title }));
      const attention = attentionList(s, ctx.cycle, ctx.today, { goals: mine }).filter((a) => a.flags.length).map((a) => ({ id: a.goal.id, title: a.goal.title, status: a.status.status, why: a.flags.map((f) => f.detail) }));
      const requests = openForPerson(me, s).map((r) => requestData(ctx, r));
      const questions = openQuestions(me, s).map((d) => ({ id: d.id, goalId: d.goalId, goal: s.goals.find((g) => g.id === d.goalId)?.title, question: d.note, by: name(ctx, d.byId) }));
      const asks = liveNotes(s.changes).filter((c) => isUpdateAsk(c) && mine.some((g) => g.id === c.goalId))
        .filter((c) => { const last = checkInsFor(mine.find((g) => g.id === c.goalId)!, s.checkIns).at(-1); return !last || c.at > last.postedAt; })
        .map((c) => ({ goalId: c.goalId, by: name(ctx, c.actorId), at: c.at }));
      const actions = s.decisions.filter((d) => d.kind === 'action' && d.assigneeId === me).map((d) => ({ id: d.id, goalId: d.goalId, action: d.note, dueWeek: d.dueWeek ?? null }));
      const reviews = s.reviews.filter((r) => r.people.includes(me)).map((r) => { const x = reviewSession(r, s, ctx.cycle, ctx.today, ctx.week); return { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total }; });
      const data = { week: ctx.week, checkInsDue: due, needsAttention: attention, requestsForYou: requests, questionsOnYourGoals: questions, asksForAnUpdate: asks, yourActions: actions, yourReviews: reviews, wrapUpOpen: wrapUpOpen(ctx.cycle, ctx.week) };
      const text = [
        `Week ${ctx.week} for ${ctx.actor.name}.`,
        `Check-ins to post: ${due.length ? due.map((g) => `${g.title} (${g.id})`).join(', ') : 'none'}.`,
        `Requests waiting on you: ${requests.length ? requests.map((r) => `${r.ask} (${r.id})`).join('; ') : 'none'}.`,
        `Questions on your goals: ${questions.length ? questions.map((q) => `${q.goal}: ${q.question}`).join('; ') : 'none'}.`,
        `Asked for an update: ${asks.length ? asks.map((x) => `${s.goals.find((g) => g.id === x.goalId)?.title} by ${x.by}`).join('; ') : 'none'}.`,
        `Your goals needing attention: ${attention.length ? attention.map((g) => `${g.title}: ${g.why.join(' ')}`).join('; ') : 'none'}.`,
      ].join('\n');
      return { data, text };
    },
  },
  {
    name: 'list_requests',
    title: 'Requests for a decision or help',
    description: 'Requests raised in check-ins for a decision or help: open ones by default. Filter to those waiting on you, or one goal’s.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Which requests.', { enum: ['open', 'answered', 'withdrawn', 'all'] }),
      for_me: bool('Only requests asked of you (or of anyone).'),
      goal_id: str('Only requests a goal is waiting on (its ID or key).'),
    } },
    annotations: READ,
    async run(a, ctx) {
      const st = (a.status as string | undefined) ?? 'open';
      const list = requestsOf(ctx.snapshot)
        .filter((r) => st === 'all' || r.status === st)
        .filter((r) => !a.for_me || !r.recipientId || r.recipientId === ctx.actor.id)
        .filter((r) => !a.goal_id || r.goalIds.includes(goalOf(ctx, a.goal_id).id))
        .map((r) => requestData(ctx, r));
      return { data: { requests: list }, text: lines(list.map((r) => `${r.id} · ${r.status} · ${r.ask} · asked by ${r.askedBy} of ${r.askedOf} · ${r.goals.map((g) => g.title).join(', ')}${r.answer ? ` · answer: ${r.answer}` : ''}`), 'No requests match.') };
    },
  },
  {
    name: 'list_reviews',
    title: 'Reviews',
    description: 'Every review in the workspace: its cadence, the goals it walks and who’s in it, with this session’s progress.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = ctx.snapshot.reviews.map((r) => {
        const x = reviewSession(r, ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
        return { id: r.id, name: r.name, everyWeeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people.map((p) => name(ctx, p)), sessionWeek: x.week, sessionDate: x.date, reviewed: x.done, of: x.total, youreIn: r.people.includes(ctx.actor.id) };
      });
      return { data: { reviews: list }, text: lines(list.map((r) => `${r.id} · ${r.name} · every ${r.everyWeeks} wk · ${r.of} goals, ${r.reviewed} reviewed this session (week ${r.sessionWeek})`), 'No reviews yet.') };
    },
  },
  {
    name: 'get_review',
    title: 'A review’s agenda',
    description: 'One review’s current session: the goals to discuss (worst first, with why), the healthy ones, and what has been said so far: notes, questions for owners (with any answers) and actions.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id'], properties: { review_id: str('The review’s ID, from list_reviews.') } },
    annotations: READ,
    async run(a, ctx) {
      const r = reviewOf(ctx, a.review_id);
      const x = reviewSession(r, ctx.snapshot, ctx.cycle, ctx.today, ctx.week);
      const ag = agendaOf(x);
      const item = (g: (typeof ag.discuss)[number]) => ({ id: g.goal.id, title: g.goal.title, owner: name(ctx, g.goal.ownerId), status: g.status.status, why: g.flags.map((f) => f.detail) });
      const said = x.said.map((d) => ({ id: d.id, goalId: d.goalId, kind: d.kind, note: d.note, by: name(ctx, d.byId), ...(d.kind === 'action' ? { who: name(ctx, d.assigneeId ?? null), dueWeek: d.dueWeek ?? null } : {}), ...(d.kind === 'ask' ? { answer: answerOf(d, ctx.snapshot)?.text ?? null } : {}) }));
      const data = { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total, toDiscuss: ag.discuss.map(item), healthy: ag.healthy.map(item), said };
      return { data, text: `${r.name}, week ${x.week} (${x.date}): ${x.done} of ${x.total} reviewed.\nTo discuss:\n${lines(data.toDiscuss.map((g) => `- ${g.title} (${g.id}), ${g.owner}: ${g.status}. ${g.why.join(' ')}`), '- nothing')}\nHealthy: ${data.healthy.map((g) => g.title).join(', ') || 'none'}.` };
    },
  },
  {
    name: 'list_watching',
    title: 'What you watch',
    description: 'Your watches (a goal, a goal and everything feeding it, or a whole level) and the goals they cover.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const watches = ctx.snapshot.watches.filter((w) => w.personId === ctx.actor.id).map((w) => ({ id: w.id, kind: w.kind, ref: w.ref, what: w.kind === 'level' ? `every ${w.ref} goal` : ctx.snapshot.goals.find((g) => g.id === w.ref)?.title ?? w.ref }));
      const goals = watchedGoals(ctx.actor.id, ctx.snapshot).map((g) => ({ id: g.id, title: g.title }));
      return { data: { watches, goals }, text: watches.length ? `${watches.map((w) => `${w.id} · ${w.kind} · ${w.what}`).join('\n')}\n${goals.length} goals watched.` : 'You’re not watching anything yet.' };
    },
  },
  {
    name: 'list_people',
    title: 'People and teams',
    description: 'Everyone in the workspace with their job title, team and whether they’re an admin, and the teams.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const team = (id: string | null) => ctx.snapshot.teams.find((t) => t.id === id)?.name ?? null;
      const people = ctx.snapshot.people.map((p) => ({ id: p.id, name: p.name, jobTitle: p.role, team: team(p.teamId), admin: p.admin, goals: ctx.snapshot.goals.filter((g) => g.ownerId === p.id).length }));
      const teams = ctx.snapshot.teams.map((t) => ({ id: t.id, name: t.name, lead: name(ctx, t.leadId) }));
      return { data: { people, teams }, text: people.map((p) => `${p.id} · ${p.name}${p.jobTitle ? `, ${p.jobTitle}` : ''} · ${p.team ?? 'no team'}${p.admin ? ' · admin' : ''}`).join('\n') };
    },
  },
  {
    name: 'get_activity',
    title: 'The activity log',
    description: 'Every saved change, newest first: who made it, when, and what changed. Filter with the same query as the Activity page, e.g. "who=maya&kind=checkins,plans&when=this-week". Keys: q (words), who (person IDs), goal (a goal’s ID or key; add tree=1 for what feeds it), team (IDs), level (north-star, svp, team), kind (checkins, plans, goals, reviews, comments, people, imports, ai, cycle), when (this-week, last-week, quarter, custom with from and to as yyyy-mm-dd).',
    inputSchema: { type: 'object', additionalProperties: false, properties: { query: str('An Activity link’s query string.'), limit: int('How many changes, newest first (default 50, at most 500).') } },
    annotations: READ,
    async run(a, ctx) {
      const q = parseActivity(new URLSearchParams(String(a.query ?? '').replace(/^.*\?/, '')));
      if (q.goal) q.goal = goalOf(ctx, q.goal).id;
      const keep = activityFilter(q, { snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, watched: null });
      const n = Math.min(500, Math.max(1, Number(a.limit ?? 50)));
      const list = ctx.snapshot.changes.filter(keep).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, n)
        .map((c) => ({ at: c.at, by: name(ctx, c.actorId), goal: c.goalId ? ctx.snapshot.goals.find((g) => g.id === c.goalId)?.title ?? c.goalId : null, summary: c.summary, changes: c.diffs.map((d) => ({ field: d.field, from: d.from, to: d.to })) }));
      return { data: { changes: list }, text: lines(list.map((c) => `${c.at.slice(0, 16).replace('T', ' ')} · ${c.by} · ${c.goal ? c.goal + ': ' : ''}${c.summary}`), 'No changes match.') };
    },
  },
  {
    name: 'list_views',
    title: 'Saved views',
    description: 'Your saved views and the ones pinned for everyone: views of the Goals screen, with each one’s query (use it with find_goals), and table views of the data tables, with their columns in order and widths (use them with export_table).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = (ctx.snapshot.views ?? []).filter((v) => !v.deletedAt && (v.pinned || v.personId === ctx.actor.id)).map((v) => {
        const l = isTableView(v) ? parseLayout(v.params) : null;
        return { id: v.id, name: v.name, of: l ? `the ${TABLES[l.table].label} data table` : 'the Goals screen', ...(l ? { table: l.table, columns: l.cols, widths: l.widths } : {}), query: v.params, pinned: v.pinned, owner: name(ctx, v.personId) };
      });
      return { data: { views: list }, text: lines(list.map((v) => `${v.id} · ${v.name}${v.pinned ? ' (pinned)' : ''} · of ${v.of} · ${v.query}`), 'No saved views.') };
    },
  },
  {
    name: 'list_tokens',
    title: 'AI assistant tokens',
    description: 'Tokens that let an AI assistant act as someone: every live one for an admin, otherwise your own. Never the token itself.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = (ctx.snapshot.tokens ?? []).filter((t) => !t.revokedAt && (ctx.actor.admin || t.personId === ctx.actor.id)).map((t) => ({ id: t.id, name: t.name, person: name(ctx, t.personId), createdAt: t.createdAt, lastUsedAt: t.lastUsedAt }));
      return { data: { tokens: list }, text: lines(list.map((t) => `${t.id} · ${t.name} · acts as ${t.person}`), 'No live tokens.') };
    },
  },
  {
    name: 'list_feedback',
    title: 'Feedback about the app',
    description: 'Admins: what people said through the feedback button, newest first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      if (!ctx.actor.admin) return { isError: true, text: 'Only admins can read the feedback.' };
      const list = [...(ctx.snapshot.feedback ?? [])].sort((x, y) => (x.at < y.at ? 1 : -1)).map((f) => ({ at: f.at, by: name(ctx, f.personId), mood: f.mood, screen: f.path, text: f.text }));
      return { data: { feedback: list }, text: lines(list.map((f) => `${f.at.slice(0, 10)} · ${f.by} · ${f.mood} · ${f.screen} · ${f.text}`), 'No feedback yet.') };
    },
  },
  {
    name: 'get_wrap_up',
    title: 'The cycle’s wrap-up',
    description: 'At the end of a cycle: which goals are wrapped up (result, what was learned, carry on or stop) and which are still to do.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const retros = ctx.snapshot.retros ?? [];
      const list = ctx.snapshot.goals.map((g) => { const r = retros.find((x) => x.goalId === g.id); return { id: g.id, title: g.title, owner: name(ctx, g.ownerId), wrappedUp: !!r, result: r?.result ?? null, learned: r?.learned ?? null, next: r?.next ?? null }; });
      const open = wrapUpOpen(ctx.cycle, ctx.week);
      return { data: { open, opensWeek: ctx.cycle.weeks - 1, goals: list }, text: `${open ? 'Wrap-up is open.' : `Wrap-up opens in week ${ctx.cycle.weeks - 1}.`} ${list.filter((g) => g.wrappedUp).length} of ${list.length} goals wrapped up.` };
    },
  },

  /* ---------- Requests and asks ---------- */
  {
    name: 'answer_request',
    title: 'Answer a request',
    description: 'Answer a request for a decision or help. One answer covers every goal waiting on it. Only the person asked, or an admin, can answer (anyone, for a request to no one in particular).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id', 'answer'], properties: { request_id: str('The request’s ID, from list_requests or get_my_work.'), answer: str('The decision or the help offered.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.answerRequest(ax(ctx), requestOf(ctx, a.request_id), String(a.answer ?? '')), 'Answered the request', ''); },
  },
  {
    name: 'link_request',
    title: 'Wait on the same request',
    description: 'Say a goal waits on a request already raised for another goal, so the person asked sees it once. Its own open request to the same person is withdrawn. The goal’s owner or an admin.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id', 'goal_id'], properties: { request_id: str('The request’s ID.'), goal_id: str('The goal that waits on it (its ID or key).') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.linkRequest(ax(ctx), requestOf(ctx, a.request_id), goalOf(ctx, a.goal_id)), 'Linked the goal to the request', ''); },
  },
  {
    name: 'withdraw_request',
    title: 'Withdraw a request',
    description: 'Withdraw a goal’s request between check-ins, or stop the goal waiting on a request raised for another goal. The goal’s owner or an admin.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id', 'goal_id'], properties: { request_id: str('The request’s ID.'), goal_id: str('The goal withdrawing it (its ID or key).') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.withdrawRequest(ax(ctx), requestOf(ctx, a.request_id), goalOf(ctx, a.goal_id)), 'Withdrew the request', ''); },
  },
  {
    name: 'ask_for_update',
    title: 'Ask the owner for an update',
    description: 'Ask a goal’s owner to post an update: it shows on their Home until they check in. Asking twice before they do does nothing more.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) { const g = goalOf(ctx, a.goal_id); return save(ctx, A.askForUpdate(ax(ctx), g), `Asked ${name(ctx, g.ownerId)} for an update on ${g.title}`, 'Already asked: it’s on their Home until they check in.'); },
  },
  {
    name: 'undo_update_ask',
    title: 'Undo an ask for an update',
    description: 'Take back an ask for an update: whoever asked, or an admin. It drops off the owner’s Home; the log keeps both.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.undoUpdateAsk(ax(ctx), goalOf(ctx, a.goal_id)), 'Undid the ask for an update', 'There’s no open ask for an update on that goal.'); },
  },

  /* ---------- Reviews ---------- */
  {
    name: 'review_call',
    title: 'Say something in a review',
    description: 'In a review, about one goal: mark it reviewed (acknowledge), add a note, ask the owner a question, or agree an action (who and by when). Logged in this session of the review.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['review_id', 'goal_id', 'kind'], properties: {
      review_id: str('The review’s ID.'), goal_id: str('The goal’s ID or its key, e.g. G-12.'),
      kind: str('What it is.', { enum: ['acknowledge', 'note', 'ask', 'action'] }),
      text: str('The note, question or action. Optional when acknowledging.'),
      who: str('Actions: who does it (name or ID). Defaults to the goal’s owner.'),
      due_week: int('Actions: the week it’s due by.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const r = reviewOf(ctx, a.review_id), g = goalOf(ctx, a.goal_id);
      const kind = a.kind as A.CallKind;
      if (!['acknowledge', 'note', 'ask', 'action'].includes(kind)) throw new Error('kind is acknowledge, note, ask or action.');
      const assigneeId = kind === 'action' && a.who ? personOf(ctx, a.who).id : undefined;
      return save(ctx, A.reviewCall(ax(ctx), g, r, kind, String(a.text ?? ''), { assigneeId, dueWeek: a.due_week as number | undefined }), `${({ acknowledge: 'Marked reviewed', note: 'Added a note', ask: 'Asked the owner', action: 'Agreed an action' } as const)[kind]}: ${g.title} in ${r.name}`, '');
    },
  },
  {
    name: 'edit_call',
    title: 'Correct something said in a review',
    description: 'Correct a note, question or action said in a review: whoever said it, or an admin. The log keeps the before and after.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['call_id', 'text'], properties: { call_id: str('Its ID, from get_review.'), text: str('The new wording.'), who: str('Actions: who does it.'), due_week: int('Actions: the week it’s due by (0 for none).') } },
    annotations: WRITE,
    async run(a, ctx) {
      const d = ctx.snapshot.decisions.find((x) => x.id === a.call_id);
      if (!d) throw new Error(`There’s nothing said with ID ${String(a.call_id)}. Use get_review.`);
      const extra = d.kind === 'action' ? { assigneeId: a.who ? personOf(ctx, a.who).id : d.assigneeId ?? null, dueWeek: a.due_week === undefined ? d.dueWeek ?? null : Number(a.due_week) || null } : undefined;
      return save(ctx, A.editCall(ax(ctx), d, String(a.text ?? ''), extra), 'Corrected it', 'Nothing to change: it already says that.');
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

  /* ---------- Watching ---------- */
  {
    name: 'watch',
    title: 'Watch goals',
    description: 'Watch a goal, a goal and everything feeding it, or every goal at a level. Watched goals are on the Watching page and in get_my_work.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['kind', 'ref'], properties: { kind: str('What to watch.', { enum: ['goal', 'tree', 'level'] }), ref: str('A goal’s ID or key (G-12), or a level (north-star, svp, team).') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const ref = a.kind === 'level' ? String(a.ref ?? '') : goalOf(ctx, a.ref).id;
      return save(ctx, A.watch(ax(ctx), a.kind as Watch['kind'], ref), `Watching ${a.kind === 'level' ? `every ${ref} goal` : goalOf(ctx, ref).title}`, 'Already watching that.');
    },
  },
  {
    name: 'unwatch',
    title: 'Stop watching',
    description: 'Stop one of your watches: the goals it covered leave your Watching page.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['watch_id'], properties: { watch_id: str('The watch’s ID, from list_watching.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.unwatch(ax(ctx), String(a.watch_id ?? '')), 'Stopped watching', ''); },
  },

  /* ---------- People ---------- */
  {
    name: 'save_person',
    title: 'Add or change a person',
    description: 'Admins: add someone to the workspace, or change their name, job title, team or admin rights. There’s always at least one admin. Without person_id it adds a new person.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      person_id: str('The person to change. Leave out to add someone.'),
      name: str('Their full name.'), job_title: str('Their job title.'), team: str('Their team (name or ID); empty string for none.'), admin: bool('Whether they’re an admin.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const before = a.person_id ? personOf(ctx, a.person_id) : null;
      const nm = a.name !== undefined ? String(a.name).trim() : before?.name ?? '';
      const p = { id: before?.id ?? ctx.newId('p'), name: nm, role: a.job_title !== undefined ? String(a.job_title).trim() : before?.role ?? '', initials: before && before.name === nm ? before.initials : A.initialsOf(nm), teamId: a.team !== undefined ? teamOf(ctx, a.team) : before?.teamId ?? ctx.actor.teamId ?? null, admin: a.admin !== undefined ? !!a.admin : before?.admin ?? false };
      const out = await save(ctx, A.savePerson(ax(ctx), p, before), before ? `Changed ${p.name}` : `Added ${p.name} (ID ${p.id})`, 'Nothing to change: it already says that.');
      return { ...out, data: { id: p.id } };
    },
  },

  /* ---------- The end of the cycle ---------- */
  {
    name: 'wrap_up_goal',
    title: 'Wrap up a goal',
    description: 'In the last two weeks of a cycle, the goal’s owner (or an admin) says how it landed, what was learned, and whether it carries on into the next cycle. Can be changed until the next cycle starts.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'result', 'learned', 'next'], properties: {
      goal_id: str('The goal’s ID or its key, e.g. G-12.'), result: str('How it landed.', { enum: ['hit', 'partly', 'missed'] }), learned: str('One thing worth knowing next time (a sentence).'), next: str('Next cycle.', { enum: ['carry', 'stop'] }),
    } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const g = goalOf(ctx, a.goal_id);
      if (!['hit', 'partly', 'missed'].includes(String(a.result))) throw new Error('result is hit, partly or missed.');
      if (!['carry', 'stop'].includes(String(a.next))) throw new Error('next is carry or stop.');
      return save(ctx, A.saveRetro(ax(ctx), g, { result: a.result as Retro['result'], learned: String(a.learned ?? ''), next: a.next as Retro['next'] }), `Wrapped up ${g.title}`, '');
    },
  },
  {
    name: 'start_next_cycle',
    title: 'Start the next cycle',
    description: 'Admins, in the last two weeks of a cycle: start the next one with the goals that carry on (stopped goals stay in this cycle’s history). Ask the person first: everyone moves to the new cycle.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: bool('True, once the person has said to start it.') } },
    annotations: { ...WRITE, destructiveHint: true },
    async run(a, ctx) {
      if (a.confirm !== true) return { isError: true, text: 'Ask the person first, then call again with confirm: true.' };
      const out = A.startNextCycle(ax(ctx));
      const r = await save(ctx, out.commit, `Started ${out.name}`, '');
      return { ...r, data: { name: out.name } };
    },
  },

  /* ---------- Saved views ---------- */
  {
    name: 'save_view',
    title: 'Save a view of the goals',
    description: 'Save a search, filters and sort of the Goals screen under a name (the same query find_goals takes), or rename or change one of yours. Without view_id it saves a new one. For a data table’s layout, use save_table_view.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name', 'query'], properties: { view_id: str('The view to change.'), name: str('Its name.'), query: str('The Goals query, e.g. "status=off,risk&sort=gap".') } },
    annotations: WRITE,
    async run(a, ctx) {
      const out = A.saveView(ax(ctx), { id: a.view_id as string | undefined, name: String(a.name ?? ''), params: String(a.query ?? '').replace(/^.*\?/, '') });
      const r = await save(ctx, out.commit, `Saved the view “${String(a.name).trim()}” (ID ${out.id})`, '');
      return { ...r, data: { id: out.id } };
    },
  },
  {
    name: 'save_table_view',
    title: 'Save a data table’s layout',
    description: 'Save a layout of one of the data tables (goals, checkIns, plan, requests, people) as a named table view, as the Data screen does: the columns to show, in order (the table’s name column always comes first), their widths in pixels, and its search, filters and sort. Without view_id it saves a new one; with it, it changes one of yours. Open it in the app from Data, or export it with export_table.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name', 'table'], properties: {
      view_id: str('The table view to change.'), name: str('Its name.'), table: str('Which data table.', { enum: TABLE_ORDER }),
      columns: ids('The columns to show, in order, by their names as the table heads them (e.g. "Key", "Owner", "Status"). Leave out for the usual columns.'),
      widths: { type: 'object', additionalProperties: { type: 'number' }, description: `Column widths in pixels by column name, e.g. {"Owner": 200}. Kept between each column’s least width (56 to 120) and ${MAX_WIDTH}.` },
      query: str('Search, filters and sort as the Data link carries them, e.g. "q=pipeline&f=Owner~is~Maya Chen&s=Week~desc". Filter conditions: is, isNot, contains, notContains, eq, ne, gt, gte, lt, lte, empty, notEmpty; several values for is or isNot separated by |.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const layout = layoutFrom(ctx, a);
      const out = A.saveTableView(ax(ctx), { id: a.view_id as string | undefined, name: String(a.name ?? ''), layout }, headOf(ctx, layout.table));
      const r = await save(ctx, out.commit, `Saved the table view “${String(a.name).trim()}” (ID ${out.id})`, '');
      return { ...r, data: { id: out.id } };
    },
  },
  {
    name: 'export_table',
    title: 'Export a data table as shown',
    description: 'One of the data tables (goals, checkIns, plan, requests, people) exactly as a layout shows it: its columns in order and the rows that pass its search and filters, sorted. Give a saved table view by name, or the table with columns and a query. CSV by default, or rows as JSON.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      view: str('The name of a saved table view: one of yours, or one pinned for everyone.'),
      table: str('Which data table, when not using a view.', { enum: TABLE_ORDER }),
      columns: ids('The columns, in order. Leave out for the usual columns.'),
      query: str('Search, filters and sort, as for save_table_view.'),
      format: str('CSV text, or rows as JSON.', { enum: ['csv', 'json'] }),
    } },
    annotations: READ,
    async run(a, ctx) {
      const layout = layoutFrom(ctx, a);
      const rows = shownTable(sheetOf(ctx, layout.table), layout);
      const [head = [], ...body] = rows;
      const what = `${TABLES[layout.table].label}: ${body.length} ${body.length === 1 ? 'row' : 'rows'}, ${head.length} columns`;
      if (a.format === 'json') return { data: { table: layout.table, columns: head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [String(h), r[i] ?? null]))) }, text: what };
      return { data: { table: layout.table, columns: head, count: body.length }, text: toCsv(rows) };
    },
  },
  {
    name: 'delete_view',
    title: 'Delete a saved view',
    description: 'Delete one of your views; an admin can also delete a pinned one.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['view_id'], properties: { view_id: str('The view’s ID, from list_views.') } },
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    async run(a, ctx) { return save(ctx, A.deleteView(ax(ctx), String(a.view_id ?? '')), 'Deleted the view', 'That view is already gone.'); },
  },
  {
    name: 'pin_view',
    title: 'Pin a view for everyone',
    description: 'Admins: show a saved view to everyone in the workspace, or stop.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['view_id', 'pinned'], properties: { view_id: str('The view’s ID.'), pinned: bool('True to pin it for everyone, false to stop.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) { return save(ctx, A.pinView(ax(ctx), String(a.view_id ?? ''), !!a.pinned), a.pinned ? 'Pinned the view for everyone' : 'Unpinned the view', 'It already is.'); },
  },

  /* ---------- Tokens and feedback ---------- */
  {
    name: 'create_token',
    title: 'Make an AI assistant token',
    description: 'Admins: make a personal token for an AI assistant to act as someone (with exactly their rights). The token is returned once; only its hash is kept. Give it to that person privately.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['person', 'name'], properties: { person: str('Who it acts as (name or ID).'), name: str('What it’s for, e.g. "Claude on Maya’s laptop".') } },
    annotations: WRITE,
    async run(a, ctx) {
      const p = personOf(ctx, a.person);
      const token = newToken();
      const r = await save(ctx, A.createToken(ax(ctx), p.id, String(a.name ?? ''), await hashToken(token)), `Made a token for ${p.name}`, '');
      return { ...r, text: `${r.text} Here it is, shown once: ${token}`, data: { token } };
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
  {
    name: 'send_feedback',
    title: 'Send feedback about the app',
    description: 'Feedback about the app itself, for the people who build it: how it felt and what happened.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['mood', 'text'], properties: { mood: str('How it felt.', { enum: ['good', 'meh', 'bad'] }), text: str('What happened, or what would help.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.sendFeedback(ax(ctx), a.mood as 'good' | 'meh' | 'bad', String(a.text ?? ''), 'mcp'), 'Sent the feedback', ''); },
  },
  {
    name: 'delete_workspace',
    title: 'Delete the workspace',
    description: 'Admins: delete this workspace and everything in it, for everyone. It can’t be undone. Ask the person first, and give the workspace’s exact name to confirm.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['confirm_name'], properties: { confirm_name: str('The workspace’s exact name.') } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      A.canDeleteWorkspace(ctx.actor, ctx.ws.kind ?? 'own', ctx.ws.name, String(a.confirm_name ?? ''));
      if (!ctx.deleteWorkspace) return { isError: true, text: 'This server can’t delete workspaces.' };
      await ctx.deleteWorkspace();
      return { text: `Deleted ${ctx.ws.name} and everything in it.` };
    },
  },
];

/** The tools that only read, by name: used by the parity check and the docs. */
export const READ_TOOLS = WORK_TOOLS.filter((t) => t.annotations.readOnlyHint).map((t) => t.name);
