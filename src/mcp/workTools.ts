/* The rest of what a person can do, for their AI assistant: requests, asks for an update, reviews, watching, people,
   wrap-ups and the next cycle, saved views, tokens and feedback, plus what needs them and the activity log. Each write
   is a shared action (domain/actions.ts), so the assistant meets exactly the rules the person does in the app, and every
   change it makes is logged as that person, via MCP. Check-ins, goals and plans are in tools.ts. */
import { MODULE_RECORDS } from '../core/records';
import { levelIds } from '../domain/levels';
import type { Commit } from '../data/store';
import * as A from '../domain/actions';
import { activityFilter, parseActivity } from '../domain/activity';
import { attentionList, splitAttention } from '../domain/attention';
import { cycleDates, cycleState, dayWithYear, wrapUpOpenOn } from '../domain/cycle';
import { dashboard, longDay } from '../domain/home';
import { askWaiting, homeAsks } from '../app/reads';
import { ASK_STATUS, ATTENTION, choices, HANDLED_LINE, codeFrom, LABEL, lower, STATUS, withCode } from '../domain/vocabulary';
import type { Change, DisplayStatus } from '../domain/types';
import type { HistoryKey } from '../ports/store';
import { HISTORY_MAX } from '../ports/window';

/** A status as the assistant reads it: the words people see, with the code beside them. */
export const said = (k: DisplayStatus) => withCode(STATUS[k]);
/** An ask's state the same way, overdue included: "Open (open), Overdue (overdue)". */
import { ASK_KIND_LABEL, askText, asksOf, canAnswer, canMarkDone, isOverdue, openForPerson, openUpdateAsk } from '../domain/asks';
import { reviewSession, watchedGoals } from '../domain/review';
import { receiptFacts, receiptText, reviewOnDueDay, WEEKDAY, weekCompletion, weekProgress } from '../domain/progress';
import { rhythmOf } from '../domain/thresholds';
import { checkInList, setRhythm, rhythmFact, rhythmReadBack, rhythmReadBackLines, rhythmToast } from '../domain/rhythm';
import { workbook } from '../domain/export';
import { choosableColumns, isDataTable, isTableView, layoutProblems, MAX_WIDTH, parseLayout, TABLE_ORDER, TABLES, type DataTable, type TableLayout } from '../domain/tableLayout';
import { findGoal, isKey } from '../domain/goalKey';
import { proposalAsks, withProposed } from '../domain/proposed';
import type { Ask, AskKind, Level, Retro, Watch } from '../domain/types';
import { ARTICLES, GROUPS, articleById, articleText, searchGuide, type Article } from '../help/guide';
import { newsSince } from '../help/whatsNew';
import { canUndoImport, importUndone } from '../domain/removal';
import { startPage, startPageText } from '../domain/startYear';
import type { McpContext, ToolDef, ToolResult } from './tools';
import { listed } from './listed';
import { MODULES, modulesOn } from '../core/registry';
import { reviewsOn } from '../app/reads';
import { RULE_PAGES, systemOverview } from '../spec/overview';
import { VIA_MCP } from '../domain/via';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const int = (description: string) => ({ type: 'integer', description });
const bool = (description: string) => ({ type: 'boolean', description });
const ids = (description: string) => ({ type: 'array', items: { type: 'string' }, description });
const LEVELS: Level[] = levelIds(null);
export const READ = { readOnlyHint: true, openWorldHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const VIA = VIA_MCP;

export const ax = (ctx: McpContext): A.ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}), ...(ctx.full ? { full: ctx.full } : {}), records: MODULE_RECORDS });

/** Saves what an action returned, marked as done through the assistant. Null: nothing to save. */
export async function save(ctx: McpContext, c: Commit | null, done: string, nothing: string): Promise<ToolResult> {
  if (!c) return { text: nothing };
  await ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
  return { text: `${done} (as ${ctx.actor.name}).` };
}

export const name = (ctx: McpContext, id: string | null | undefined) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? '—';
/** A goal by its ID or its key (G-12). */
export const goalOf = (ctx: McpContext, id: unknown) => {
  const g = findGoal(withProposed(ctx.snapshot), String(id ?? ''));
  if (!g) throw new Error(`There’s no goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};
export const goalIds = (ctx: McpContext, v: unknown) => (v as string[] | undefined)?.map((id) => goalOf(ctx, id).id);
const requestOf = (ctx: McpContext, id: unknown) => {
  const r = asksOf(ctx.snapshot).find((x) => x.id === id);
  if (!r) throw new Error(`There’s no ask with ID ${String(id)}. Use list_requests to get IDs.`);
  return r;
};
export const reviewOf = (ctx: McpContext, id: unknown) => {
  const r = ctx.snapshot.reviews.find((x) => x.id === id);
  if (!r) throw new Error(`There’s no review with ID ${String(id)}. Use list_reviews to get IDs.`);
  return r;
};
/** A person by ID or by name (whole or the start of it), for tools that name someone. */
export const personOf = (ctx: McpContext, ref: unknown) => {
  const t = String(ref ?? '').trim().toLowerCase();
  // By ID, by email (exact), by full name, then by the start of a name.
  const p = ctx.snapshot.people.find((x) => x.id === ref) ?? ctx.snapshot.people.find((x) => !!t && (x.email ?? '').toLowerCase() === t) ?? ctx.snapshot.people.find((x) => x.name.toLowerCase() === t) ?? ctx.snapshot.people.filter((x) => x.name.toLowerCase().startsWith(t)).at(0);
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
export const levelsOf = (v: unknown): Level[] => {
  const list = ((v as string[] | undefined) ?? []).map((l) => l.toLowerCase().replace(/\s+/g, '-'));
  const bad = list.filter((l) => !LEVELS.includes(l as Level));
  if (bad.length) throw new Error(`Levels are ${LEVELS.join(', ')} (not ${bad.join(', ')}).`);
  return list as Level[];
};
// The one lateness rule (review of #369, medium 5): list_requests reads `late` as get_my_work and Home do (app/reads
// askWaiting), where a question past its session is late, not only one past its due week. Only an open ask can be late.
const askLate = (ctx: McpContext, r: Ask): boolean => (r.status === 'open' ? (askWaiting(r, r.recipientId ?? ctx.actor.id, ctx.snapshot, ctx.cycle, ctx.week, ctx.today, reviewsOn(modulesOn(ctx.ws).on))?.late ?? isOverdue(r, ctx.week)) : false);
const requestData = (ctx: McpContext, r: ReturnType<typeof requestOf>) => ({
  id: r.id, kind: r.kind, ask: r.kind === 'decision' ? askText(r, ctx.snapshot.people) : r.ask, status: r.status, statusLabel: ASK_STATUS[r.status].label, dueWeek: r.dueWeek, overdue: askLate(ctx, r), review: ctx.snapshot.reviews.find((v) => v.id === r.reviewId)?.name ?? null, askedBy: name(ctx, r.askedBy), askedOf: r.recipientId ? name(ctx, r.recipientId) : 'anyone',
  goals: r.goalIds.map((g) => { const x = withProposed(ctx.snapshot).find((y) => y.id === g); return { id: g, key: x?.key ?? null, title: x?.title ?? g }; }), raisedAt: r.createdAt,
  answer: r.answer, answeredBy: r.answeredBy ? name(ctx, r.answeredBy) : null, youCanAnswer: r.status === 'open' && canAnswer(r, ctx.actor), youCanMarkDone: r.status === 'open' && canMarkDone(r, ctx.actor),
});
export const lines = (l: string[], none: string) => (l.length ? l.join('\n') : none);

/** A data table's sheet, from the same workbook the Data screen and the exports use. */
/** A Data table's sheet of the workbook, for this context (the spreadsheets module's export_table reads it too). */
export const sheetOf = (ctx: McpContext, t: DataTable) => workbook({ ws: ctx.ws, snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, today: ctx.today }).find((x) => x.name === TABLES[t].sheet)!;
const headOf = (ctx: McpContext, t: DataTable) => (sheetOf(ctx, t).rows[0] ?? []).map((c) => String(c ?? ''));
/** A table layout from a tool's arguments: a saved table view by name, or a table with columns, widths and a query. */
export function layoutFrom(ctx: McpContext, a: Record<string, unknown>): TableLayout {
  if (a.view != null) {
    const v = (ctx.snapshot.views ?? []).find((x) => !x.deletedAt && isTableView(x) && (x.pinned || x.personId === ctx.actor.id) && x.name.toLowerCase() === String(a.view).toLowerCase());
    const l = v ? parseLayout(v.params) : null;
    if (!l) throw new Error(`There’s no saved layout called “${String(a.view)}” that you can see. Use list_views.`);
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

/** What a switched-off module's tool answers (callTool's sentence), for a core tool that is partly Reviews' (FT2). */
const offSentence = (ctx: McpContext, tool: string) => `Reviews is switched off in ${ctx.ws.name}, so ${tool} can't be used there. An admin can switch it on in Workspace, under Features.`;

/** A sentence as part of a longer line: without its closing full stop, so the line never ends in two. */
const clause = (t: string) => t.trim().replace(/\.+$/, '');

/** The newest n changes that pass `keep`. A whole snapshot (the server loads whole today) already holds every entry, so
    they are read from it; only a windowed one (Snapshot.history) pages back through the store's history, 100 at a time
    (AX5 part 2b). */
export async function activityPages(ctx: McpContext, keep: (c: Change) => boolean, n: number): Promise<Change[]> {
  if (!ctx.history || !ctx.snapshot.history) return ctx.snapshot.changes.filter(keep).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, n);
  const out: Change[] = [];
  let before: HistoryKey | null | undefined;
  do {
    const page = await ctx.history({ before, size: HISTORY_MAX });
    for (const c of page.changes) if (keep(c) && out.push(c) >= n) return out;
    before = page.next;
  } while (before);
  return out;
}

export const WORK_TOOLS: ToolDef[] = [
  /* ---------- Reading ---------- */
  {
    name: 'get_my_work',
    title: 'What needs me',
    description: `What needs the person this week, as their Home shows it: their goals with a check-in due this week or that need attention (${ATTENTION.needs.meaning.replace(/\.$/, '').toLowerCase()}), those behind but already ${lower(ATTENTION.handled)}, every open ask waiting on them (decisions or help, questions, asks for an update, actions, grouped by kind, each in Home’s order with Home’s line for how long it has waited or when it is due, whether it is late, and who it was asked of when it came with a goal they now own), and the reviews they’re in. Statuses are said as people see them, with the code: “${said('off')}”.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const s = ctx.snapshot, me = ctx.actor.id;
      const mine = s.goals.filter((g) => g.ownerId === me);
      // Check-ins due as Home counts them (one rule): goals still to post this week, never a goal that is done.
      const due = weekProgress(me, s, ctx.cycle, ctx.week, ctx.today).due.map((g) => ({ id: g.id, title: g.title }));
      // Needs attention is new information; a goal someone has looked at since its latest check-in is being handled.
      const split = splitAttention(attentionList(s, ctx.cycle, ctx.today, { goals: mine }));
      const attention = split.needs.map((a) => ({ id: a.goal.id, title: a.goal.title, status: a.status.status, statusLabel: LABEL[a.status.status], why: a.flags.map((f) => f.detail), because: a.flags.map((f) => withCode({ label: f.label, code: f.kind })) }));
      const handled = split.handled.map((a) => ({ id: a.goal.id, title: a.goal.title, status: a.status.status, statusLabel: LABEL[a.status.status], inHand: a.handled!.text, said: a.handled!.said || null, why: a.flags.map((f) => f.detail) }));
      // Every open ask waiting on them: one way to ask, so each kind is the same record with its own state.
      // How long each has waited, when it is due and whether it is late are Home's (rule 3, one rule), in Home's order.
      const home = homeAsks(me, s, ctx.cycle, ctx.week, ctx.today, reviewsOn(modulesOn(ctx.ws).on));
      const at = new Map(home.map((w, i) => [w.askId, { i, w }]));
      const waiting = openForPerson(me, s).filter((r) => at.has(r.id)).sort((a, b) => at.get(a.id)!.i - at.get(b.id)!.i)
        .map((r) => { const w = at.get(r.id)!.w; const { overdue: _, ...d } = requestData(ctx, r); void _; return { ...d, waiting: w.line, late: w.late, handedFrom: w.was }; });
      const ofKind = (k: AskKind) => waiting.filter((r) => r.kind === k);
      const requests = ofKind('decision');
      const questions = ofKind('question').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, goal: r.goals[0]?.title, question: r.ask, by: r.askedBy, review: r.review, waiting: r.waiting, late: r.late, handedFrom: r.handedFrom }));
      const asks = ofKind('update').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, by: r.askedBy, at: r.raisedAt, waiting: r.waiting, late: r.late, handedFrom: r.handedFrom }));
      const actions = ofKind('action').map((r) => ({ id: r.id, goalId: r.goals[0]?.id, action: r.ask, dueWeek: r.dueWeek, waiting: r.waiting, late: r.late, agreedBy: r.askedBy, handedFrom: r.handedFrom }));
      const when = (x: { waiting: string; handedFrom: string | null }) => ` · ${x.waiting}${x.handedFrom ? ` · asked of ${x.handedFrom}, now yours` : ''}`;
      // Proposed goals asked of them, as Home's "Proposed goals" lists them (goal entry rule 14; build review of #319):
      // one proposed for them by someone else, and one of theirs proposed 8 weeks ago or more. What they opened is kept
      // per browser, so the tools list every one proposed for them.
      const proposedForYou = proposalAsks(s.proposed ?? [], ctx.actor, ctx.today, { opened: new Set(), putOff: new Map() }, (id) => s.people.find((p) => p.id === id)?.name ?? 'Someone')
        .map((a) => ({ id: a.goal.id, key: a.goal.key ?? null, title: a.goal.title, kind: a.kind, says: a.says }));
      // With Reviews switched off (FT2) no review is listed, here or as the next one.
      const reviewsHere = reviewsOn(modulesOn(ctx.ws).on);
      const reviews = !reviewsHere ? [] : s.reviews.filter((r) => r.people.includes(me)).map((r) => { const x = reviewSession(r, s, ctx.cycle, ctx.today, ctx.week); return { id: r.id, name: r.name, week: x.week, date: x.date, reviewed: x.done, of: x.total }; });
      // The strip at the top of Home: their goals by status, their on-time streak, what they watch, their next review.
      const d = dashboard(me, s, ctx.cycle, ctx.week, ctx.today, { reviews: reviewsHere });
      const wp = weekProgress(me, s, ctx.cycle, ctx.week, ctx.today);
      const rf = weekCompletion(wp).complete ? receiptFacts(wp, me, s, ctx.cycle, ctx.week, reviewOnDueDay(s.reviews, me, ctx.cycle, reviewsHere)) : null;
      const weekReceipt = rf ? { ...receiptText({ ...rf, nextDue: rf.nextDue ? longDay(rf.nextDue) : null }), forgivenWeek: rf.forgiven } : null;
      const glance = {
        goals: { whose: d.scope, total: d.total, byStatus: d.counts.map((c) => ({ status: c.status, statusLabel: LABEL[c.status], n: c.n })) },
        onTimeStreakWeeks: d.streak,
        // The check-in's receipt, once every check-in of the week is in (habit spec 2.1): the same two sentences.
        weekReceipt,
        watching: d.watching ? { goals: d.watching.all.length, needAttention: d.watching.needs.map((a) => a.goal.title), beingHandled: d.watching.handled.map((a) => ({ title: a.goal.title, inHand: a.handled!.text })), noRecentUpdate: d.watching.quiet.length } : null,
        ...(reviewsHere ? { nextReview: d.next ? { id: d.next.id, name: d.next.name, date: d.next.date, day: d.next.weekday } : null } : {}),
      };
      // With no set rhythm (FT1) nothing is due: say so, and list the goals with no check-in this week instead.
      const rhythm = rhythmOf(ctx.cycle);
      const list = rhythm ? null : checkInList(ctx.actor.id, s.goals, s.checkIns, ctx.week);
      const noCheckInThisWeek = list ? list.waiting.map((r) => ({ id: r.goalId, title: s.goals.find((g) => g.id === r.goalId)?.title ?? r.goalId, lastWeek: r.lastWeek })) : null;
      const data = { week: ctx.week, ...(rhythm ? {} : { rhythm: 'none' as const, noCheckInThisWeek }), atAGlance: glance, checkInsDue: due, needsAttention: attention, beingHandled: handled, requestsForYou: requests, questionsOnYourGoals: questions, asksForAnUpdate: asks, yourActions: actions, proposedGoals: proposedForYou, ...(reviewsHere ? { yourReviews: reviews } : {}), wrapUpOpen: wrapUpOpenOn(ctx.cycle, ctx.today) };
      const text = [
        `Week ${ctx.week} for ${ctx.actor.name}.`,
        `${d.scope === 'mine' ? 'Your goals' : 'All goals'}: ${d.counts.map((c) => `${c.n} ${LABEL[c.status].toLowerCase()}`).join(', ') || 'none'}.${d.streak != null ? ` On-time streak: ${d.streak} ${d.streak === 1 ? 'week' : 'weeks'}.` : ''}${d.watching ? ` Watching ${d.watching.all.length}: ${d.watching.needs.length} need attention, ${d.watching.handled.length} ${lower(ATTENTION.handled)}.` : ''}${d.next ? ` Next review: ${d.next.name}, ${d.next.weekday} ${d.next.date}.` : ''}`,
        ...(weekReceipt ? [[weekReceipt.first, weekReceipt.second].filter(Boolean).join(' ')] : []),
        rhythm ? `Check-ins to post: ${due.length ? due.map((g) => `${g.title} (${g.id})`).join(', ') : 'none'}.`
          : `No set check-in rhythm: nothing is due. No check-in this week: ${noCheckInThisWeek!.length ? noCheckInThisWeek!.map((g) => `${g.title} (${g.id})`).join(', ') : 'none'}.`,
        `Decisions or help waiting on you: ${requests.length ? requests.map((r) => `${r.ask}${when(r)} (${r.id})`).join('; ') : 'none'}.`,
        `Questions for you: ${questions.length ? questions.map((q) => `${q.goal}: ${q.question}${when(q)} (${q.id})`).join('; ') : 'none'}.`,
        `Asked for an update: ${asks.length ? asks.map((x) => `${withProposed(s).find((g) => g.id === x.goalId)?.title} by ${x.by}${when(x)} (${x.id})`).join('; ') : 'none'}.`,
        `Proposed goals for you: ${proposedForYou.length ? proposedForYou.map((x) => `${x.says} (${x.key ?? x.id})`).join(' ') : 'none'}.`,
        `Your actions: ${actions.length ? actions.map((x) => `${x.action}${x.dueWeek ? ` by week ${x.dueWeek}` : ''}${when(x)} (${x.id})`).join('; ') : 'none'}.`,
        // Each reason is a sentence with its own full stop: joined into one line, only the line's last one stays.
        `Your goals that need attention: ${attention.length ? attention.map((g) => `${g.title}, ${said(g.status)}: ${g.why.map(clause).join('. ')}`).join('; ') : 'none'}.`,
        `${ATTENTION.handled.label} (${HANDLED_LINE.replace(/\.$/, '')}): ${handled.length ? handled.map((g) => `${g.title} (${said(g.status)}): ${clause(g.inHand)}`).join('; ') : 'none'}.`,
      ].join('\n');
      return { data, text };
    },
  },
  {
    name: 'list_requests',
    title: 'Asks: decisions or help, updates, questions, actions',
    description: 'Every ask (one way to ask): a decision or help an owner needs, an update asked of an owner, a question for an owner, an action someone agreed to do. Each is open until it’s answered (an action: done) or withdrawn. Open ones by default; filter by kind, to those waiting on you, or to one goal’s.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      status: str(`Which asks: the words or the code, any of ${choices(ASK_STATUS, ['open', 'answered', 'done', 'withdrawn'])}, or all.`),
      kind: str('Only one kind.', { enum: ['decision', 'update', 'question', 'action'] }),
      for_me: bool('Only asks waiting on you (or asked of anyone).'),
      goal_id: str('Only asks on a goal (its ID or key).'),
    } },
    annotations: READ,
    async run(a, ctx) {
      const st = a.status == null || String(a.status).toLowerCase() === 'all' ? (a.status == null ? 'open' : 'all') : codeFrom(ASK_STATUS, a.status);
      if (!st || st === 'overdue') throw new Error(`“${String(a.status)}” isn’t where an ask can stand. Use one of: ${choices(ASK_STATUS, ['open', 'answered', 'done', 'withdrawn'])}, or all.`);
      const list = asksOf(ctx.snapshot)
        .filter((r) => st === 'all' || r.status === st)
        .filter((r) => !a.kind || r.kind === a.kind)
        .filter((r) => !a.for_me || !r.recipientId || r.recipientId === ctx.actor.id)
        .filter((r) => !a.goal_id || r.goalIds.includes(goalOf(ctx, a.goal_id).id))
        .map((r) => requestData(ctx, r));
      return listed({ requests: list });
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
      return listed({ watches, goals });
    },
  },
  {
    name: 'list_people',
    title: 'People and teams',
    description: 'Everyone in the workspace with their email, job title, team and whether they’re an admin, and the teams.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const team = (id: string | null) => ctx.snapshot.teams.find((t) => t.id === id)?.name ?? null;
      const people = ctx.snapshot.people.map((p) => ({ id: p.id, name: p.name, email: p.email ?? null, jobTitle: p.role, team: team(p.teamId), admin: p.admin, goals: ctx.snapshot.goals.filter((g) => g.ownerId === p.id).length }));
      const teams = ctx.snapshot.teams.map((t) => { const m = A.teamMembers(ax(ctx), t.id); return { id: t.id, name: t.name, lead: name(ctx, t.leadId), people: m.people.length, goals: m.current.length }; });
      return listed({ people, teams });
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
      const list = (await activityPages(ctx, keep, n))
        .map((c) => ({
          at: c.at, by: name(ctx, c.actorId), goal: c.goalId ? ctx.snapshot.goals.find((g) => g.id === c.goalId)?.title ?? c.goalId : null, summary: c.summary, changes: c.diffs.map((d) => ({ field: d.field, from: d.from, to: d.to })),
          // An import or bulk edit: its ID, for undo_import, and whether this person can undo it now.
          ...(c.action === 'imported' ? { importId: c.entityId, canUndo: canUndoImport(ctx.snapshot, c, ctx.actor), undone: importUndone(ctx.snapshot, c.entityId) } : {}),
        }));
      return listed({ changes: list });
    },
  },
  {
    name: 'list_views',
    title: 'Saved views',
    description: 'Your saved views and the ones pinned for everyone: views of the Goals screen, with each one’s query (use it with find_goals), and saved layouts of Data’s tables, with their columns in order and widths (use them with export_table).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const list = (ctx.snapshot.views ?? []).filter((v) => !v.deletedAt && (v.pinned || v.personId === ctx.actor.id)).map((v) => {
        const l = isTableView(v) ? parseLayout(v.params) : null;
        return { id: v.id, name: v.name, of: l ? `the ${TABLES[l.table].label} data table` : 'the Goals screen', ...(l ? { table: l.table, columns: l.cols, widths: l.widths } : {}), query: v.params, pinned: v.pinned, owner: name(ctx, v.personId) };
      });
      return listed({ views: list });
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
      return listed({ tokens: list });
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
      // The wrap-up's days (cycle-end rule 1): it opens two weeks before the last day and closes four weeks after it.
      const open = wrapUpOpenOn(ctx.cycle, ctx.today);
      const d = cycleDates(ctx.cycle), state = cycleState(ctx.cycle, ctx.today);
      const when = state === 'closed' ? `The wrap-up closed on ${dayWithYear(d.wrapUpCloses)}.` : open ? `Wrap-up is open until ${dayWithYear(d.wrapUpCloses)}.` : `Wrap-up opens on ${dayWithYear(d.wrapUpOpens)}.`;
      return { data: { open, opensWeek: ctx.cycle.weeks - 1, opens: d.wrapUpOpens, lastDay: d.lastDay, closes: d.wrapUpCloses, goals: list }, text: `${when} ${list.filter((g) => g.wrappedUp).length} of ${list.length} goals wrapped up.` };
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
    async run(a, ctx) {
      const brief = (x: Article) => ({ id: x.id, title: x.title, summary: x.summary, group: GROUPS.find((g) => g.id === x.group)?.title ?? x.group, path: `/help/${x.id}` });
      // As Help does (screens/Help.tsx): a switched-off module's articles aren't offered (module map F3).
      const on = modulesOn(ctx.ws).on;
      const shown = (x: Article | undefined): x is Article => !!x && (!x.module || on.has(x.module));
      if (a.id) {
        const x = articleById(String(a.id));
        if (x?.module && !on.has(x.module)) return { isError: true, text: `${MODULES.find((m) => m.id === x.module)?.name ?? x.module} is switched off in ${ctx.ws.name}, so its Help isn’t shown there. An admin can switch it on in Workspace, under Features.` };
        if (!x) return { isError: true, text: `There’s no help article with id ${String(a.id)}. Articles: ${ARTICLES.filter(shown).map((y) => y.id).join(', ')}.` };
        return { data: { ...brief(x), sections: x.sections, routes: x.routes, related: x.related.map(articleById).filter(shown).map(brief) }, text: articleText(x) };
      }
      // A list answers as every list does (listed, #249's review): the same keys every time, and why when it's empty.
      const list = (a.search ? searchGuide(String(a.search)) : ARTICLES).filter(shown);
      return listed({ articles: list.map(brief), why: list.length ? null : `No help article matches “${String(a.search)}”. Try fewer or plainer words.` });
    },
  },
  {
    name: 'describe_system',
    title: 'What Faro is: an overview for an AI',
    description: 'What Faro is and how it is built, in one page: the core (goals, weekly check-ins, the status rules and their numbers, flags and the change engine), its feature modules, and where the generated spec says the rest (the data model, every rule with worked examples, the vocabulary, the screens, the journeys and requirements, and the conformance data a rebuild proves itself against). The same text as llms.txt at the root of the repository. Paths are relative to that root.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    annotations: READ,
    async run(_a, ctx) {
      // Which modules are on in this workspace: one switched off (Reviews, say) isn't said to be on (FT2).
      const on = modulesOn(ctx.ws).on;
      const off = MODULES.filter((m) => !on.has(m.id)).map((m) => m.name);
      return { data: { rulePages: RULE_PAGES.map(([id, title]) => ({ title, path: `spec/core/rules/${id}.md` })), modules: MODULES.map((m) => ({ id: m.id, name: m.name, on: on.has(m.id), path: `spec/modules/${m.id}/README.md` })) }, text: systemOverview() + (off.length ? `\n\nSwitched off in ${ctx.ws.name}: ${off.join(', ')}.` : '') };
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
      return listed({ entries: list, why: list.length ? null : since ? `Nothing new since ${since}.` : 'Nothing yet.' });
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
    description: 'Ask a goal’s owner a question. It’s open on their Home until they answer it (a comment doesn’t), or you withdraw it.',
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

  {
    name: 'add_action',
    title: 'Add a next step to a goal',
    description: 'Agree a next step on a goal: what, who does it and the week it’s due by. An action is an ask: open until it’s marked done (mark_action_done) or withdrawn; overdue once its week has passed. Change one with edit_call.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'text', 'who'], properties: { goal_id: str('The goal’s ID or its key, e.g. G-12.'), text: str('What needs doing.'), who: str('Who does it (name or ID).'), due_week: int('The week it’s due by.') } },
    annotations: WRITE,
    async run(a, ctx) {
      const g = goalOf(ctx, a.goal_id);
      return save(ctx, A.addAction(ax(ctx), g, String(a.text ?? ''), { assigneeId: personOf(ctx, a.who).id, dueWeek: a.due_week == null ? null : Number(a.due_week) }), `Agreed a next step on ${g.title}`, '');
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
      // A note said in a review is Reviews': refused while it is off, as its own tools are (FT2). An ask's words aren't.
      if (!('goalIds' in d) && !reviewsOn(modulesOn(ctx.ws).on)) return { isError: true, text: offSentence(ctx, 'edit_call') };
      const action = 'goalIds' in d ? d.kind === 'action' : d.kind === 'action';
      const was = 'goalIds' in d ? { who: d.recipientId, due: d.dueWeek } : { who: d.assigneeId ?? null, due: d.dueWeek ?? null };
      const extra = action ? { assigneeId: a.who ? personOf(ctx, a.who).id : was.who, dueWeek: a.due_week === undefined ? was.due : Number(a.due_week) || null } : undefined;
      return save(ctx, A.editCall(ax(ctx), d, String(a.text ?? ''), extra), 'Corrected it', 'Nothing to change: it already says that.');
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
    description: 'Admins: add someone to the workspace, or change their name, email, job title, team or admin rights. There’s always at least one admin. Without person_id it adds a new person, who needs an email.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      person_id: str('The person to change (their ID or email). Leave out to add someone.'),
      name: str('Their full name.'), email: str('Their email: required for someone new.'), job_title: str('Their job title.'), team: str('Their team (name or ID); empty string for none.'), admin: bool('Whether they’re an admin.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const before = a.person_id ? personOf(ctx, a.person_id) : null;
      const nm = a.name !== undefined ? String(a.name).trim() : before?.name ?? '';
      const email = a.email !== undefined ? String(a.email).trim().toLowerCase() : before?.email ?? '';
      const p = { id: before?.id ?? ctx.newId('p'), name: nm, role: a.job_title !== undefined ? String(a.job_title).trim() : before?.role ?? '', initials: before && before.name === nm ? before.initials : A.initialsOf(nm), teamId: a.team !== undefined ? teamOf(ctx, a.team) : before?.teamId ?? ctx.actor.teamId ?? null, admin: a.admin !== undefined ? !!a.admin : before?.admin ?? false, ...(email ? { email } : {}) };
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
    description: 'Admins, from the day the wrap-up opens: set up the next cycle with the goals that carry on. Nobody moves into it until the current cycle’s last day, and it can be undone (undo_start_cycle) until someone uses it. Without confirm (a dry run, the default) it changes nothing and returns what would carry on, finish and stop, in counts that add up to every goal. Ask the person first, then call again with confirm: true.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { dry_run: bool('True (the default): only say what starting would do.'), confirm: bool('True, once the person has said to start it.') } },
    annotations: { ...WRITE, destructiveHint: true },
    async run(a, ctx) {
      if (a.confirm !== true || a.dry_run === true) {
        const page = startPage(ctx.full ?? ctx.snapshot, ctx.cycle, ctx.today);
        const rb = page.readBack;
        return { text: `${startPageText(page)}\n\nNothing has changed. Ask the person first, then call again with confirm: true.`, data: { next: page.next, canStart: page.canStart, whyNot: page.whyNot, counts: page.counts, ...(rb ? { carried: rb.carried, total: rb.total } : {}) } };
      }
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
    description: 'Save a layout of one of Data’s tables (goals, checkIns, plan, requests, people) as a named saved layout, as the Data screen does: the columns to show, in order (the table’s name column always comes first), their widths in pixels, and its search, filters and sort. Without view_id it saves a new one; with it, it changes one of yours. Open it in the app from Data, or export it with export_table.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name', 'table'], properties: {
      view_id: str('The saved layout to change.'), name: str('Its name.'), table: str('Which data table.', { enum: TABLE_ORDER }),
      columns: ids('The columns to show, in order, by their names as the table heads them (e.g. "Key", "Owner", "Status"). Leave out for the usual columns.'),
      widths: { type: 'object', additionalProperties: { type: 'number' }, description: `Column widths in pixels by column name, e.g. {"Owner": 200}. Kept between each column’s least width (56 to 120) and ${MAX_WIDTH}.` },
      query: str('Search, filters and sort as the Data link carries them, e.g. "q=pipeline&f=Owner~is~Maya Chen&s=Week~desc". Filter conditions: is, isNot, contains, notContains, eq, ne, gt, gte, lt, lte, empty, notEmpty; several values for is or isNot separated by |.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const layout = layoutFrom(ctx, a);
      const out = A.saveTableView(ax(ctx), { id: a.view_id as string | undefined, name: String(a.name ?? ''), layout }, headOf(ctx, layout.table));
      const r = await save(ctx, out.commit, `Saved the layout “${String(a.name).trim()}” (ID ${out.id})`, '');
      return { ...r, data: { id: out.id } };
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
    name: 'set_feature',
    title: 'Switch a feature on or off',
    description: `Admins: switch one of Faro's optional features (its modules) on or off in this workspace. Off, it leaves every screen: no page, menu or tool of its own, here or for assistants; anything that needs it goes off with it. Nothing it saved is deleted, and switching it back on brings it all back. The change is logged. The features: ${MODULES.map((m) => `${m.id} (${m.name}: ${m.summary})`).join('; ') || 'none in this build'}.`,
    inputSchema: { type: 'object', additionalProperties: false, required: ['feature', 'on'], properties: { feature: str('The feature’s id.', { enum: MODULES.map((m) => m.id) }), on: bool('true to switch it on, false to switch it off.') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      if (typeof a.on !== 'boolean') throw new Error('Say on: true to switch it on, or on: false to switch it off.');
      const id = String(a.feature ?? '');
      const m = MODULES.find((x) => x.id === id);
      const res = await save(ctx, A.setModule(ax(ctx), ctx.ws, MODULES, id, a.on), `${a.on ? 'Switched on' : 'Switched off'} ${m?.name ?? id} in ${ctx.ws.name}`, `Nothing to change: ${m?.name ?? id} is already ${a.on ? 'on' : 'off'}.`);
      const r = modulesOn(ctx.ws);
      return { ...res, data: { on: [...r.on], off: [...r.off.keys()] } };
    },
  },
  {
    name: 'set_rhythm',
    title: 'Choose the check-in rhythm',
    description: 'Admins: how often every goal is expected to have a check-in in this workspace. every: "week" (due by a weekday, due_by; a goal with none for two check-ins’ time reads No recent update) or "none" (no set rhythm: owners check in when there’s news, and nothing is due or late for want of a check-in). Without confirm: true it changes nothing and says what would change, counted. With it, the change is made and logged; switching a rhythm on counts from today, so nothing is late that day.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['every'], properties: {
      every: str('“week” or “none”.', { enum: ['week', 'none'] }), due_by: str('With every week: the weekday check-ins are due by. Leave out to keep it.', { enum: WEEKDAY }),
      confirm: bool('true to make the change; leave out to see what it would do first.'),
    } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const weeks = a.every === 'none' ? 0 : a.every === 'week' ? 1 : -1;
      if (weeks < 0) throw new Error('Say every: "week" or every: "none".');
      const dueDay = a.due_by === undefined || a.due_by === null ? ctx.cycle.reviewDay : WEEKDAY.indexOf(String(a.due_by));
      if (dueDay < 0) throw new Error('Choose a day of the week.');
      const to = { weeks, dueDay };
      if (a.confirm !== true) {
        if (!ctx.actor.admin) throw new Error('Only admins can change the check-in rhythm.');
        const lines = rhythmReadBackLines(ctx.cycle, to, rhythmReadBack(ctx.snapshot.goals, ctx.snapshot.checkIns, ctx.cycle, to, ctx.today), ctx.today);
        const text = lines.length ? `Nothing is changed yet. What changes for everyone here:\n${lines.map((l) => `- ${l.strong}${l.rest}`).join('\n')}\nCall set_rhythm again with confirm: true to make the change.` : `Nothing to change: ${rhythmFact(ctx.cycle)}`;
        return { data: { changed: false, rhythm: rhythmFact(ctx.cycle), wouldChange: lines.map((l) => l.strong + l.rest) }, text };
      }
      const res = await save(ctx, setRhythm(ax(ctx), ctx.cycle, to), rhythmToast(ctx.cycle, to), `Nothing to change: ${rhythmFact(ctx.cycle)}`);
      return { ...res, data: { rhythm: weeks ? 'every week' : 'none', dueBy: weeks ? WEEKDAY[dueDay] : null } };
    },
  },
  {
    name: 'save_team',
    title: 'Add or change a team',
    description: 'Admins: add a team, or rename one, change its lead or say what it is here to do. Without team it adds a new team. Team names are unique. Use list_people for the teams and their IDs.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['name'], properties: {
      team: str('The team to change (name or ID). Leave out to add a team.'), name: str('The team’s name.'), lead: str('The team lead (a person’s name or ID); empty string for none.'),
      purpose: str('What the team is here to do, in a sentence or two; empty string to clear it. Leave out to keep it.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      const id = a.team !== undefined ? teamOf(ctx, a.team) ?? undefined : undefined;
      const leadId = a.lead === undefined ? undefined : a.lead === '' || a.lead === null ? null : personOf(ctx, a.lead).id;
      const out = A.saveTeam(ax(ctx), { id, name: String(a.name ?? ''), ...(leadId !== undefined ? { leadId } : {}), ...(a.purpose !== undefined && a.purpose !== null ? { objective: String(a.purpose) } : {}) });
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
