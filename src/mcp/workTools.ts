/* The rest of what a person can do, for their AI assistant: requests, asks for an update, reviews, watching, people,
   wrap-ups and the next cycle, saved views, tokens and feedback, plus what needs them and the activity log. Each write
   is a shared action (domain/actions.ts), so the assistant meets exactly the rules the person does in the app, and every
   change it makes is logged as that person, via the AI assistant. Check-ins, goals and plans are in tools.ts. */
import type { Commit } from '../data/store';
import * as A from '../domain/actions';
import { activityFilter, parseActivity } from '../domain/activity';
import { attentionList, splitAttention } from '../domain/attention';
import { wrapUpOpen } from '../domain/cycle';
import { dashboard } from '../domain/home';
import { LABEL } from '../domain/status';
import { ASK_KIND_LABEL, askText, asksOf, canAnswer, canMarkDone, isOverdue, openForPerson, openUpdateAsk } from '../domain/asks';
import { agendaOf, answerOf, lastHeld, openActions, reviewSession, sessionState, sessionStateText, watchedGoals } from '../domain/review';
import { weekProgress } from '../domain/progress';
import { toCsv, workbook } from '../domain/export';
import { choosableColumns, isDataTable, isTableView, layoutProblems, MAX_WIDTH, parseLayout, shownTable, TABLE_ORDER, TABLES, type DataTable, type TableLayout } from '../domain/tableLayout';
import { findGoal, isKey } from '../domain/goalKey';
import type { AskKind, Level, Retro, Review, Watch } from '../domain/types';
import { ARTICLES, GROUPS, articleById, articleText, searchGuide, type Article } from '../help/guide';
import { newsDate, newsSince } from '../help/whatsNew';
import type { McpContext, ToolDef, ToolResult } from './tools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const int = (description: string) => ({ type: 'integer', description });
const bool = (description: string) => ({ type: 'boolean', description });
const ids = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const LEVELS: Level[] = ['north-star', 'svp', 'team'];
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const VIA = { field: 'Via', from: '—', to: 'AI assistant (MCP)' };

const ax = (ctx: McpContext): A.ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}) });

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
  const r = asksOf(ctx.snapshot).find((x) => x.id === id);
  if (!r) throw new Error(`There’s no ask with ID ${String(id)}. Use list_requests to get IDs.`);
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
  id: r.id, kind: r.kind, ask: r.kind === 'decision' ? askText(r, ctx.snapshot.people) : r.ask, status: r.status, dueWeek: r.dueWeek, overdue: isOverdue(r, ctx.week), review: ctx.snapshot.reviews.find((v) => v.id === r.reviewId)?.name ?? null, askedBy: name(ctx, r.askedBy), askedOf: r.recipientId ? name(ctx, r.recipientId) : 'anyone',
  goals: r.goalIds.map((g) => { const x = ctx.snapshot.goals.find((y) => y.id === g); return { id: g, key: x?.key ?? null, title: x?.title ?? g }; }), raisedAt: r.createdAt,
  answer: r.answer, answeredBy: r.answeredBy ? name(ctx, r.answeredBy) : null, youCanAnswer: r.status === 'open' && canAnswer(r, ctx.actor), youCanMarkDone: r.status === 'open' && canMarkDone(r, ctx.actor),
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

/** A sentence as part of a longer line: without its closing full stop, so the line never ends in two. */
const clause = (t: string) => t.trim().replace(/\.+$/, '');

export const WORK_TOOLS: ToolDef[] = [
  /* ---------- Reading ---------- */
  {
    name: 'get_my_work',
    title: 'What needs me',
    description: 'What needs the person this week, as their Home shows it: their goals with no check-in yet this week or that need attention (new since anyone looked), those behind but already being handled, every open ask waiting on them (decisions or help, questions, asks for an update, actions, grouped by kind, overdue ones marked), and the reviews they’re in.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const s = ctx.snapshot, me = ctx.actor.id;
      const mine = s.goals.filter((g) => g.ownerId === me);
      // Check-ins due as Home counts them (one rule): goals still to post this week, never a goal that is done.
      const due = weekProgress(me, s, ctx.cycle, ctx.week, ctx.today).due.map((g) => ({ id: g.id, title: g.title }));
      // Needs attention is new information; a goal someone has looked at since its latest check-in is being handled.
      const split = splitAttention(attentionList(s, ctx.cycle, ctx.today, { goals: mine }).filter((a) => a.flags.length));
      const attention = split.needs.map((a) => ({ id: a.goal.id, title: a.goal.title, status: a.status.status, why: a.flags.map((f) => f.detail) }));
      const handled = split.handled.map((a) => ({ id: a.goal.id, title: a.goal.title, status: a.status.status, inHand: a.handled!.text, said: a.handled!.said || null, why: a.flags.map((f) => f.detail) }));
      // Every open ask waiting on them: one way to ask, so each kind is the same record with its own state.
      const waiting = openForPerson(me, s).filter((r) => r.goalIds.some((id) => s.goals.some((g) => g.id === id))).map((r) => requestData(ctx, r));
      const ofKind = (k: AskKind) => waiting.filter((r) => r.kind === k);
      const requests = ofKind('decision');
      const questions = ofKind('question').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, goal: r.goals[0]?.title, question: r.ask, by: r.askedBy, review: r.review }));
      const asks = ofKind('update').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, by: r.askedBy, at: r.raisedAt }));
      const actions = ofKind('action').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, action: r.ask, dueWeek: r.dueWeek, overdue: r.overdue, agreedBy: r.askedBy }));
      const reviews = s.reviews.filter((r) => r.people.includes(me)).map((r) => { const x = reviewSession(r, s, ctx.cycle, ctx.today, ctx.week); return { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total }; });
      // The strip at the top of Home: their goals by status, their on-time streak, what they watch, their next review.
      const d = dashboard(me, s, ctx.cycle, ctx.week, ctx.today);
      const glance = {
        goals: { whose: d.scope, total: d.total, byStatus: d.counts.map((c) => ({ status: LABEL[c.status], n: c.n })) },
        onTimeStreakWeeks: d.streak,
        watching: d.watching ? { goals: d.watching.all.length, needAttention: d.watching.needs.map((a) => a.goal.title), beingHandled: d.watching.handled.map((a) => ({ title: a.goal.title, inHand: a.handled!.text })), noRecentUpdate: d.watching.quiet.length } : null,
        nextReview: d.next ? { id: d.next.id, name: d.next.name, date: d.next.date, day: d.next.weekday } : null,
      };
      const data = { week: ctx.week, atAGlance: glance, checkInsDue: due, needsAttention: attention, beingHandled: handled, requestsForYou: requests, questionsOnYourGoals: questions, asksForAnUpdate: asks, yourActions: actions, yourReviews: reviews, wrapUpOpen: wrapUpOpen(ctx.cycle, ctx.week) };
      const text = [
        `Week ${ctx.week} for ${ctx.actor.name}.`,
        `${d.scope === 'mine' ? 'Your goals' : 'All goals'}: ${d.counts.map((c) => `${c.n} ${LABEL[c.status].toLowerCase()}`).join(', ') || 'none'}.${d.streak != null ? ` On-time streak: ${d.streak} ${d.streak === 1 ? 'week' : 'weeks'}.` : ''}${d.watching ? ` Watching ${d.watching.all.length}: ${d.watching.needs.length} need attention, ${d.watching.handled.length} being handled.` : ''}${d.next ? ` Next review: ${d.next.name}, ${d.next.weekday} ${d.next.date}.` : ''}`,
        `Check-ins to post: ${due.length ? due.map((g) => `${g.title} (${g.id})`).join(', ') : 'none'}.`,
        `Decisions or help waiting on you: ${requests.length ? requests.map((r) => `${r.ask} (${r.id})`).join('; ') : 'none'}.`,
        `Questions for you: ${questions.length ? questions.map((q) => `${q.goal}: ${q.question} (${q.id})`).join('; ') : 'none'}.`,
        `Asked for an update: ${asks.length ? asks.map((x) => `${s.goals.find((g) => g.id === x.goalId)?.title} by ${x.by} (${x.id})`).join('; ') : 'none'}.`,
        `Your actions: ${actions.length ? actions.map((x) => `${x.action}${x.dueWeek ? ` by week ${x.dueWeek}${x.overdue ? ', overdue' : ''}` : ''} (${x.id})`).join('; ') : 'none'}.`,
        // Each reason is a sentence with its own full stop: joined into one line, only the line's last one stays.
        `Your goals needing attention: ${attention.length ? attention.map((g) => `${g.title}: ${g.why.map(clause).join('. ')}`).join('; ') : 'none'}.`,
        `Being handled (behind, but someone has looked since the latest check-in): ${handled.length ? handled.map((g) => `${g.title} (${g.status === 'off' ? 'off track' : 'at risk'}): ${clause(g.inHand)}`).join('; ') : 'none'}.`,
      ].join('\n');
      return { data, text };
    },
  },
  {
    name: 'list_requests',
    title: 'Asks: decisions or help, updates, questions, actions',
    description: 'Every ask (one way to ask): a decision or help an owner needs, an update asked of an owner, a question for an owner, an action someone agreed to do. Each is open until it’s answered (an action: done) or withdrawn. Open ones by default; filter by kind, to those waiting on you, or to one goal’s.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str('Which asks.', { enum: ['open', 'answered', 'done', 'withdrawn', 'all'] }),
      kind: str('Only one kind.', { enum: ['decision', 'update', 'question', 'action'] }),
      for_me: bool('Only asks waiting on you (or asked of anyone).'),
      goal_id: str('Only asks on a goal (its ID or key).'),
    } },
    annotations: READ,
    async run(a, ctx) {
      const st = (a.status as string | undefined) ?? 'open';
      const list = asksOf(ctx.snapshot)
        .filter((r) => st === 'all' || r.status === st)
        .filter((r) => !a.kind || r.kind === a.kind)
        .filter((r) => !a.for_me || !r.recipientId || r.recipientId === ctx.actor.id)
        .filter((r) => !a.goal_id || r.goalIds.includes(goalOf(ctx, a.goal_id).id))
        .map((r) => requestData(ctx, r));
      return { data: { requests: list }, text: lines(list.map((r) => `${r.id} · ${ASK_KIND_LABEL[r.kind]} · ${r.status}${r.overdue ? ' (overdue)' : ''} · ${r.ask} · asked by ${r.askedBy} of ${r.askedOf} · ${r.goals.map((g) => g.title).join(', ')}${r.answer ? ` · answer: ${r.answer}` : ''}`), 'No asks match.') };
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
        const held = lastHeld(r, ctx.snapshot, x.week);
        return { id: r.id, name: r.name, everyWeeks: r.everyWeeks, weekday: r.weekday, scope: r.scope, people: r.people.map((p) => name(ctx, p)), sessionWeek: x.week, sessionDate: x.date, reviewed: x.done, of: x.total, state: sessionStateText(sessionState(x)), lastHeld: held?.on ?? null, openActions: openActions(r, ctx.snapshot).length, youreIn: r.people.includes(ctx.actor.id) };
      });
      return { data: { reviews: list }, text: lines(list.map((r) => `${r.id} · ${r.name} · every ${r.everyWeeks} wk · ${r.state} (session ${r.sessionDate}) · last held ${r.lastHeld ?? 'never'} · ${r.openActions} open actions`), 'No reviews yet.') };
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
      const item = (g: (typeof ag.discuss)[number]) => ({ id: g.goal.id, title: g.goal.title, owner: name(ctx, g.goal.ownerId), status: g.status.status, why: g.flags.map((f) => f.detail), beingHandled: g.handled?.text ?? null });
      const said = x.said.map((d) => ({ id: d.id, goalId: d.goalId, kind: d.kind, note: d.note, by: name(ctx, d.byId), ...(d.kind === 'action' ? { who: name(ctx, d.assigneeId ?? null), dueWeek: d.dueWeek ?? null } : {}), ...(d.ask ? { status: d.ask.status, answer: answerOf(d)?.text ?? null } : {}) }));
      const data = { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total, toDiscuss: ag.discuss.map(item), healthy: ag.healthy.map(item), said };
      return { data, text: `${r.name}, week ${x.week} (${x.date}): ${x.done} of ${x.total} reviewed.\nTo discuss:\n${lines(data.toDiscuss.map((g) => `- ${g.title} (${g.id}), ${g.owner}: ${g.status}.${g.beingHandled ? ` Being handled: ${g.beingHandled}.` : ''} ${g.why.join(' ')}`), '- nothing')}\nHealthy: ${data.healthy.map((g) => g.title).join(', ') || 'none'}.` };
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
      const teams = ctx.snapshot.teams.map((t) => { const m = A.teamMembers(ax(ctx), t.id); return { id: t.id, name: t.name, lead: name(ctx, t.leadId), people: m.people.length, goals: m.goals.length }; });
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

  {
    name: 'get_help',
    title: 'Help: what the app does',
    description: 'The app’s own guide, the same as its Help pages: one article per screen or feature, saying what it is for, how to use it and who can. Give an article’s id for the whole article, or a search for the articles that match; with neither, every article’s id, title and summary.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      id: str('An article’s id, e.g. "check-in", "reviews" or "data".'),
      search: str('Words to look for, e.g. "plan change reason". Every word must appear.'),
    } },
    annotations: READ,
    async run(a) {
      const brief = (x: Article) => ({ id: x.id, title: x.title, summary: x.summary, group: GROUPS.find((g) => g.id === x.group)?.title ?? x.group, path: `/help/${x.id}` });
      if (a.id) {
        const x = articleById(String(a.id));
        if (!x) return { isError: true, text: `There’s no help article with id ${String(a.id)}. Articles: ${ARTICLES.map((y) => y.id).join(', ')}.` };
        return { data: { ...brief(x), sections: x.sections, routes: x.routes, related: x.related.map((r) => brief(articleById(r)!)) }, text: articleText(x) };
      }
      const list = a.search ? searchGuide(String(a.search)) : ARTICLES;
      return { data: { articles: list.map(brief) }, text: lines(list.map((x) => `${x.id} · ${x.title}: ${x.summary}`), `No help article matches “${String(a.search)}”.`) };
    },
  },
  {
    name: 'whats_new',
    title: 'What’s new in the app',
    description: 'The app’s release notes, newest first, as its What’s new page shows them: each entry’s date, title, a few plain lines and the help articles that explain it. Optionally only those since a date.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      since: str('Only entries on or after this date (yyyy-mm-dd).'),
      limit: int('How many entries, newest first (default all).'),
    } },
    annotations: READ,
    async run(a) {
      const since = a.since ? String(a.since) : undefined;
      if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return { isError: true, text: `Give the date as yyyy-mm-dd (not ${since}).` };
      const n = a.limit ? Math.max(1, Number(a.limit)) : Infinity;
      const list = newsSince(since).slice(0, n).map((e) => ({ id: e.id, date: e.date, title: e.title, points: e.points, articles: e.articles }));
      return { data: { entries: list }, text: lines(list.map((e) => `${newsDate(e.date)}: ${e.title}\n${e.points.map((p) => `- ${p}`).join('\n')}`), since ? `Nothing new since ${since}.` : 'Nothing yet.') };
    },
  },

  /* ---------- Asks (one way to ask) ---------- */
  {
    name: 'answer_request',
    title: 'Answer an ask',
    description: 'Answer an ask: a decision or help, a question, or an ask for an update (an action is marked done instead, with mark_action_done). One answer covers every goal it applies to and closes it. Only the person asked, or an admin, can answer (anyone, for an ask to no one in particular). A comment never answers an ask.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id', 'answer'], properties: { request_id: str('The ask’s ID, from list_requests or get_my_work.'), answer: str('The answer, decision or help offered.') } },
    annotations: WRITE,
    async run(a, ctx) { const r = requestOf(ctx, a.request_id); return save(ctx, A.answerRequest(ax(ctx), r, String(a.answer ?? '')), `Answered the ${ASK_KIND_LABEL[r.kind].toLowerCase()}`, ''); },
  },
  {
    name: 'mark_action_done',
    title: 'Mark an action done',
    description: 'Mark an action done, with an optional note. Whoever does it, whoever agreed it, or an admin. It stays open (and shows as overdue past its week) until it’s marked done or withdrawn.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id'], properties: { request_id: str('The action’s ID, from list_requests (kind action) or get_my_work.'), note: str('Optional: what was done.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.markActionDone(ax(ctx), requestOf(ctx, a.request_id), String(a.note ?? '')), 'Marked the action done', ''); },
  },
  {
    name: 'ask_question',
    title: 'Ask a goal’s owner a question',
    description: 'Ask a goal’s owner a question. It’s open on their Home until they answer it (a comment doesn’t), or you withdraw it. In a review, use review_call with kind ask instead, so it’s part of the session.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'question'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), question: str('The question.') } },
    annotations: WRITE,
    async run(a, ctx) { const g = goalOf(ctx, a.goal_id); return save(ctx, A.askQuestion(ax(ctx), g, String(a.question ?? '')), `Asked ${name(ctx, g.ownerId)} a question on ${g.title}`, ''); },
  },
  {
    name: 'link_request',
    title: 'Wait on the same request',
    description: 'Say a goal waits on a decision or help already raised for another goal, so the person asked sees it once. Its own open request to the same person is withdrawn. The goal’s owner or an admin.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id', 'goal_id'], properties: { request_id: str('The request’s ID.'), goal_id: str('The goal that waits on it (its ID or key).') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.linkRequest(ax(ctx), requestOf(ctx, a.request_id), goalOf(ctx, a.goal_id)), 'Linked the goal to the request', ''); },
  },
  {
    name: 'withdraw_request',
    title: 'Withdraw an ask',
    description: 'Withdraw an ask of any kind: whoever asked, or an admin (for a decision or help, also the owner of the goal it was raised on). With goal_id for a goal linked to another goal’s request, that goal stops waiting on it and the request stays open for the rest.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['request_id'], properties: { request_id: str('The ask’s ID.'), goal_id: str('Optional: the goal withdrawing it (its ID or key). Defaults to the goal it was raised on.') } },
    annotations: WRITE,
    async run(a, ctx) { const r = requestOf(ctx, a.request_id); return save(ctx, A.withdrawRequest(ax(ctx), r, a.goal_id ? goalOf(ctx, a.goal_id) : undefined), `Withdrew the ${ASK_KIND_LABEL[r.kind].toLowerCase()}`, ''); },
  },
  {
    name: 'ask_for_update',
    title: 'Ask the owner for an update',
    description: 'Ask a goal’s owner to post an update: an ask that’s open on their Home until they check in (or answer it), or it’s withdrawn. Asking twice while it’s open does nothing more.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) { const g = goalOf(ctx, a.goal_id); return save(ctx, A.askForUpdate(ax(ctx), g), `Asked ${name(ctx, g.ownerId)} for an update on ${g.title}`, `Already asked: it’s open on their Home (${openUpdateAsk(g.id, ctx.snapshot)?.id ?? 'ask'}) until they check in.`); },
  },
  {
    name: 'undo_update_ask',
    title: 'Withdraw an ask for an update',
    description: 'Withdraw the open ask for an update on a goal: whoever asked, or an admin. It drops off the owner’s Home; the log keeps both.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.undoUpdateAsk(ax(ctx), goalOf(ctx, a.goal_id)), 'Withdrew the ask for an update', 'There’s no open ask for an update on that goal.'); },
  },

  /* ---------- Reviews ---------- */
  {
    name: 'review_call',
    title: 'Say something in a review',
    description: 'In a review, about one goal: mark it reviewed (acknowledge), add a note, ask the owner a question, or agree an action (who and by when). Logged in this session of the review. A question or an action is an ask: open until it’s answered (answer_request) or done (mark_action_done), or withdrawn.',
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
    description: 'Correct a note, question or action said in a review (or any open ask’s words): whoever said it, or an admin. An answered or done ask stays as it was. The log keeps the before and after.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['call_id', 'text'], properties: { call_id: str('Its ID, from get_review.'), text: str('The new wording.'), who: str('Actions: who does it.'), due_week: int('Actions: the week it’s due by (0 for none).') } },
    annotations: WRITE,
    async run(a, ctx) {
      const d = ctx.snapshot.decisions.find((x) => x.id === a.call_id) ?? asksOf(ctx.snapshot).find((x) => x.id === a.call_id);
      if (!d) throw new Error(`There’s nothing said with ID ${String(a.call_id)}. Use get_review.`);
      const action = 'goalIds' in d ? d.kind === 'action' : d.kind === 'action';
      const was = 'goalIds' in d ? { who: d.recipientId, due: d.dueWeek } : { who: d.assigneeId ?? null, due: d.dueWeek ?? null };
      const extra = action ? { assigneeId: a.who ? personOf(ctx, a.who).id : was.who, dueWeek: a.due_week === undefined ? was.due : Number(a.due_week) || null } : undefined;
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
  {
    name: 'send_feedback',
    title: 'Send feedback about the app',
    description: 'Feedback about the app itself, for the people who build it: how it felt and what happened.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['mood', 'text'], properties: { mood: str('How it felt.', { enum: ['good', 'meh', 'bad'] }), text: str('What happened, or what would help.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.sendFeedback(ax(ctx), a.mood as 'good' | 'meh' | 'bad', String(a.text ?? ''), 'mcp'), 'Sent the feedback', ''); },
  },
  {
    name: 'rename_workspace',
    title: 'Rename the workspace',
    description: 'Admins: give the workspace a new name (up to 80 characters). Everyone sees the new name; the change is logged.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: str('The new name.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const from = ctx.ws.name;
      return save(ctx, A.renameWorkspace(ax(ctx), ctx.ws, String(a.name ?? '')), `Renamed the workspace from “${from}” to “${String(a.name ?? '').trim().replace(/\s+/g, ' ')}”`, 'Nothing to change: it already has that name.');
    },
  },
  {
    name: 'set_recording',
    title: 'Turn recording on or off',
    description: 'Admins: turn on or off recording of how the app is used in this workspace: the pages people open, the actions they take, where they stop in a flow, errors and slow loads. Never anything anyone types. Off, nothing is recorded or sent for the workspace, from the app or from assistants. Everyone is recorded by default; the change is logged. get_help with "recording" says exactly what is recorded.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['on'], properties: { on: bool('true to record how the app is used here, false to stop.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      if (typeof a.on !== 'boolean') throw new Error('Say on: true to record, or on: false to stop.');
      const on = a.on;
      const res = await save(ctx, A.setRecording(ax(ctx), ctx.ws, on), on ? 'Turned recording back on for this workspace' : 'Turned recording off for this workspace: nothing more is recorded or sent', `Nothing to change: recording is already ${on ? 'on' : 'off'}.`);
      return { ...res, data: { recording: ctx.ws.recording !== false } };
    },
  },
  {
    name: 'save_team',
    title: 'Add or change a team',
    description: 'Admins: add a team, or rename one or change its lead. Without team it adds a new team. Team names are unique. Use list_people for the teams and their IDs.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name'], properties: {
      team: str('The team to change (name or ID). Leave out to add a team.'), name: str('The team’s name.'), lead: str('The team lead (a person’s name or ID); empty string for none.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const id = a.team !== undefined ? teamOf(ctx, a.team) ?? undefined : undefined;
      const leadId = a.lead === undefined ? undefined : a.lead === '' || a.lead === null ? null : personOf(ctx, a.lead).id;
      const out = A.saveTeam(ax(ctx), { id, name: String(a.name ?? ''), ...(leadId !== undefined ? { leadId } : {}) });
      const res = await save(ctx, out.commit, id ? `Saved the team ${String(a.name ?? '').trim()}` : `Added the team ${String(a.name ?? '').trim()} (ID ${out.id})`, 'Nothing to change: the team already says that.');
      return { ...res, data: { id: out.id } };
    },
  },
  {
    name: 'remove_team',
    title: 'Remove a team',
    description: 'Admins: remove a team. A team that still has people or goals (in any cycle) needs move_to, another team: they all move there in the same save, and each goal’s history says so. Ask the person which team first.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['team'], properties: { team: str('The team to remove (name or ID).'), move_to: str('Where its people and goals go (a team’s name or ID).') } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      const id = teamOf(ctx, a.team);
      if (!id) throw new Error('Name the team to remove.');
      const name = ctx.snapshot.teams.find((t) => t.id === id)!.name;
      const to = a.move_to !== undefined && a.move_to !== '' ? teamOf(ctx, a.move_to) : null;
      return save(ctx, A.removeTeam(ax(ctx), id, to), `Removed the team ${name}`, '');
    },
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
