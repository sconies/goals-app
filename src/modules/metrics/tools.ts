/* The metric library's AI tools (backlog 0b): list and read the metrics, add, change or remove one, and say which
   metric measures a goal. Every rule is rules.ts's, so an assistant meets exactly the rules a person does,
   and every change is logged as that person, via the AI assistant. A removed metric comes back with restore_removed
   (kind metric). In a workspace that has switched the metric library off, these say so instead of running. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal, isKey } from '../../domain/goalKey';
import * as M from './rules';
import * as L from './rulesLibrary';
import { goalsOfMetric, libraryReads } from './reads';
import { goalStatus } from '../../domain/status';
import { LABEL } from '../../domain/vocabulary';
import type { DisplayStatus } from '../../domain/types';
import type { Metric, MetricDirection, MetricRefresh } from './types';
import type { McpContext, ToolDef, ToolResult } from '../../mcp/tools';
import { VIA_MCP } from '../../domain/via';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const VIA = VIA_MCP;

const ax = (ctx: McpContext): ActionContext => ({ snapshot: ctx.snapshot, cycle: ctx.cycle, week: ctx.week, actor: ctx.actor, now: ctx.now, newId: ctx.newId, ...(ctx.allGoals ? { allGoals: ctx.allGoals } : {}), ...(ctx.full ? { full: ctx.full } : {}) });
const save = (ctx: McpContext, c: Commit) => ctx.save({ ...c, changes: c.changes.map((x) => ({ ...x, diffs: [...x.diffs, VIA] })) });
/** A rule that says no is the assistant's to fix, so it reads as an error result, not a crash. */
async function ruled(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try { return await run(); } catch (e) { if (e instanceof NotAllowed) return { isError: true, text: e.message }; throw e; }
}

const metricOf = (ctx: McpContext, ref: unknown) => {
  const m = M.findMetric(ctx.snapshot, String(ref ?? ''));
  if (!m) throw new NotAllowed(`There’s no metric called or with the ID ${String(ref)}. Use list_metrics.`);
  return m;
};
const goalOf = (ctx: McpContext, id: unknown) => {
  const g = findGoal(ctx.snapshot.goals, String(id ?? ''));
  if (!g) throw new NotAllowed(`There’s no live goal with ${isKey(String(id ?? '')) ? 'key' : 'ID'} ${String(id)} in ${ctx.cycle.name}. Use find_goals to get IDs and keys.`);
  return g;
};
/** A person here now, by ID, email or name. */
const personOf = (ctx: McpContext, ref: unknown) => {
  const t = String(ref ?? '').trim().toLowerCase();
  const p = ctx.snapshot.people.find((x) => x.id === ref) ?? ctx.snapshot.people.find((x) => !!t && (x.email ?? '').toLowerCase() === t) ?? ctx.snapshot.people.find((x) => x.name.toLowerCase() === t);
  if (!t || !p) throw new NotAllowed(`There’s no one called ${String(ref)} in this workspace. Use list_people.`);
  return p.id;
};
/** A slice: a team by ID or name, or the whole company (left out, empty, null or "company"). */
const sliceOf = (ctx: McpContext, ref: unknown): string | null => {
  if (ref == null || ref === '' || /^(the )?(whole )?company$/i.test(String(ref).trim())) return null;
  const t = String(ref).trim().toLowerCase();
  const team = ctx.snapshot.teams.find((x) => x.id === ref || x.name.toLowerCase() === t);
  if (!team) throw new NotAllowed(`There’s no team called ${String(ref)}. Leave team out for the whole company. Teams: ${ctx.snapshot.teams.map((x) => x.name).join(', ')}.`);
  return team.id;
};
const name = (ctx: McpContext, id: string) => ctx.snapshot.people.find((p) => p.id === id)?.name ?? null;

/** A metric as the tools return it: its definition, in words and codes, and the goals it measures. */
function metricData(ctx: McpContext, m: Metric) {
  return {
    id: m.id, name: m.name, meaning: m.meaning, unit: m.unit, decimals: m.decimals,
    direction: m.direction, directionLabel: M.DIRECTION_LABEL[m.direction], source: m.source, sourceOwner: m.sourceOwner,
    refresh: m.refresh, owner: name(ctx, m.ownerId), ownerId: m.ownerId, caveats: m.caveats, updatedAt: m.updatedAt,
    youCanChange: M.canEditMetric(ctx.actor, m),
    measures: M.goalsMeasuredBy(ctx.snapshot, ctx.snapshot.goals, m.id).map((g) => {
      const me = M.measureOf(ctx.snapshot, g)!;
      return { goalId: g.id, key: g.key ?? null, goal: g.title, owner: name(ctx, g.ownerId), slice: me.slice, target: me.target, targetText: me.targetText };
    }),
  };
}

const FIELDS = {
  name: str('Its name, e.g. “Build time (p90)”. Required for a new metric; no two metrics share one.'),
  meaning: str('What it means and how it’s calculated: what is counted, over what period, what is left out.'),
  unit: str('Its unit: %, min, hours, USD, deploys… Required for a new metric. A goal it measures must use the same unit.'),
  decimals: { type: 'integer', minimum: 0, maximum: 4, description: 'Places after the decimal point it’s shown with (0 to 4; 0 when left out).' },
  direction: str('Which way is better. Required for a new metric.', { enum: ['higher', 'lower'] }),
  source: str('Where the number comes from: a dashboard, a tool, a query.'),
  source_owner: str('Who owns that source: a team or a person, as text.'),
  refresh: str('How often the source refreshes. Empty for not said.', { enum: [...M.REFRESHES, ''] }),
  owner: str('Who answers for the definition, by ID, email or name. Whoever adds it, when left out.'),
  caveats: str('What to watch out for when reading it.'),
};

const tools: ToolDef[] = [
  {
    name: 'list_metrics',
    title: 'List the metric library',
    description: 'The metric library as its page lists it (rule 1 of the library): every metric in use, A to Z, with its unit, which way is better, its owner, its goals by status, worst first, and (for its owner and admins) what it still needs. Narrow it as the page does: words to find (name, unit, “lower is better”, owner, meaning, source), a unit, the team or the whole company a goal measures it for, an owner, a direction, unused ones, or those with something to sort out; sort A to Z, by most goals or by the latest change. get_metric has one in full.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      search: str('Words to find, each starting a word of the name, unit, “lower is better” or “higher is better”, the owner’s name, the meaning or the source.'),
      unit: str('Only metrics in this unit (any case).'),
      team: str('Only metrics a goal measures for this team (ID or name), or “company” for the whole company.'),
      owner: str('Only metrics this person owns, by ID, email or name.'),
      direction: str('Only metrics where this way is better.', { enum: ['higher', 'lower'] }),
      unused: { type: 'boolean', description: 'Only metrics no live goal uses.' },
      sort_out: { type: 'boolean', description: 'Only metrics with something to sort out: no owner (or one who has left), no meaning, no source, or no goal after 14 days.' },
      sort: str('A to Z (name, the default), most goals first (goals), or the latest change first (changed).', { enum: ['name', 'goals', 'changed'] }),
      page: { type: 'integer', minimum: 1, description: 'Which page of 50.' },
    } },
    annotations: READ,
    async run(a, ctx) {
      return ruled(async () => {
        const team = a.team == null || a.team === '' ? undefined : /^(the )?(whole )?company$/i.test(String(a.team).trim()) ? 'company' : sliceOf(ctx, a.team) ?? undefined;
        const ask: L.LibraryAsk = {
          q: String(a.search ?? ''), unit: a.unit ? String(a.unit) : undefined, teamId: team, ownerId: a.owner ? personOf(ctx, a.owner) : undefined,
          dir: a.direction === 'higher' || a.direction === 'lower' ? a.direction : undefined, unused: a.unused === true, sortout: a.sort_out === true,
          sort: a.sort === 'goals' || a.sort === 'changed' ? a.sort : 'name', page: typeof a.page === 'number' ? a.page : 1,
        };
        const found = L.findMetrics(libraryReads(ctx.snapshot, ctx.now), ask);
        const statusOf = (id: string) => { const g = ctx.snapshot.goals.find((x) => x.id === id); return g ? goalStatus(g, ctx.cycle, ctx.snapshot.checkIns, ctx.today).status : null; };
        const rows = found.rows.map(({ metric: m, owner, goalIds, needs }) => {
          const byStatus = L.goalsByStatus(goalIds.map(statusOf).filter((s): s is DisplayStatus => !!s));
          return { id: m.id, name: m.name, unit: m.unit, direction: m.direction, owner, goals: goalIds.length, goalsByStatus: byStatus.map((c) => ({ status: c.status, count: c.n, label: LABEL[c.status] })), needs: M.canEditMetric(ctx.actor, m) ? needs.map((x) => ({ id: x.id, sentence: x.sentence })) : [] };
        });
        const words = (r: (typeof rows)[number]) => `${r.id} · ${r.name} (${r.unit}, ${L.directionWords(r.direction)}) · ${r.owner ? `owner ${r.owner}` : 'no owner'} · ${r.goalsByStatus.length ? r.goalsByStatus.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ') : 'no goals yet'}${r.needs.length ? ` · to sort out: ${r.needs.map((x) => x.sentence).join('; ')}` : ''}`;
        const head = found.total > found.rows.length ? `${found.from} to ${found.to} of ${found.total} metrics.\n` : '';
        return { data: { total: found.total, page: found.page, pages: found.pages, metrics: rows }, text: rows.length ? head + rows.map(words).join('\n') : M.liveMetrics(ctx.snapshot).length ? 'No metric matches.' : 'The metric library is empty. Add one with save_metric.' };
      });
    },
  },
  {
    name: 'get_metric',
    title: 'Read a metric',
    description: 'One metric in full, by ID or name, as its page shows it: what it means and how it’s calculated, unit, decimals, direction, source and its owner, refresh, owner, caveats; every goal it measures, worst first, with its status, slice (a team, or the whole company), latest number, target with its week, where it stands against plan and owner (rule 2 of the library), and the lowest and highest now; and, for its owner and admins, what it still needs (rule 3).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: { metric: str('The metric’s ID or name.') } },
    annotations: READ,
    async run(a, ctx) {
      return ruled(async () => {
        const m = metricOf(ctx, a.metric);
        const d = metricData(ctx, m);
        const side = goalsOfMetric(ctx.snapshot, ctx.cycle, ctx.today, ctx.week, m.id);
        const goals = side.map((r) => ({ goalId: r.goal.id, key: r.goal.key ?? null, goal: r.goal.title, status: r.status, statusLabel: LABEL[r.status], slice: r.slice, now: r.now, target: r.target, vsPlan: r.vsPlan, owner: r.owner }));
        const summary = L.summaryLine(side);
        const needs = M.canEditMetric(ctx.actor, m) ? L.metricNeeds(m, libraryReads(ctx.snapshot, ctx.now)).map((x) => ({ id: x.id, sentence: x.sentence })) : [];
        const lines = [
          `${d.name} (${d.id})`, `Unit: ${d.unit}, ${L.decimalsWords(d.decimals)} · ${d.directionLabel}`, `Meaning: ${d.meaning || '—'}`,
          `Source: ${d.source || '—'} (owned by ${d.sourceOwner || '—'}) · refresh: ${d.refresh ?? 'not said'}`, `Owner: ${d.owner ?? '—'}`, `Caveats: ${d.caveats || '—'}`,
          goals.length ? `Goals measured by it (${goals.length}):\n${goals.map((x) => `- ${x.statusLabel} · ${x.key ?? x.goalId} ${x.goal} · for ${x.slice} · now ${x.now} · target ${x.target} · ${x.vsPlan} · ${x.owner}`).join('\n')}` : 'Measures no goal yet.',
          ...(summary ? [summary] : []),
          ...(needs.length ? [`To sort out: ${needs.map((x) => x.sentence).join('; ')}`] : []),
        ];
        return { data: { ...d, goals, summary, needs }, text: lines.join('\n') };
      });
    },
  },
  {
    name: 'save_metric',
    title: 'Add or change a metric',
    description: 'Add a metric to the library (anyone; you own it unless you name an owner), or change one by giving its id (its owner or an admin). A new metric needs a name, a unit and a direction; everything else is optional. Fields left out keep their value. Saving it unchanged saves nothing.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { id: str('The metric to change, by ID or name. Leave out to add one.'), ...FIELDS } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const input: M.MetricInput & { id?: string } = {
          ...(a.id != null && a.id !== '' ? { id: metricOf(ctx, a.id).id } : {}),
          ...(a.name !== undefined ? { name: String(a.name) } : {}),
          ...(a.meaning !== undefined ? { meaning: String(a.meaning) } : {}),
          ...(a.unit !== undefined ? { unit: String(a.unit) } : {}),
          ...(a.decimals !== undefined ? { decimals: Number(a.decimals) } : {}),
          ...(a.direction !== undefined ? { direction: String(a.direction).toLowerCase() as MetricDirection } : {}),
          ...(a.source !== undefined ? { source: String(a.source) } : {}),
          ...(a.source_owner !== undefined ? { sourceOwner: String(a.source_owner) } : {}),
          ...(a.refresh !== undefined ? { refresh: a.refresh ? (String(a.refresh).toLowerCase() as MetricRefresh) : null } : {}),
          ...(a.owner !== undefined ? { ownerId: personOf(ctx, a.owner) } : {}),
          ...(a.caveats !== undefined ? { caveats: String(a.caveats) } : {}),
        };
        const { commit, metric } = M.saveMetric(ax(ctx), input);
        if (!commit) return { data: { saved: false, id: metric.id }, text: `Nothing changed: ${metric.name} already says that.` };
        await save(ctx, commit);
        return { data: { saved: true, id: metric.id, changes: commit.changes[0]!.diffs }, text: `${commit.changes[0]!.summary} (as ${ctx.actor.name}). Its ID is ${metric.id}.` };
      });
    },
  },
  {
    name: 'remove_metric',
    title: 'Remove a metric',
    description: 'Remove a metric from the library: its owner or an admin. Every goal it measures is unlinked by the same save; the goals themselves don’t change. It can be restored for 30 days with restore_removed (kind metric), with the links it had.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: { metric: str('The metric’s ID or name.') } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      return ruled(async () => {
        const c = M.removeMetric(ax(ctx), metricOf(ctx, a.metric).id);
        await save(ctx, c);
        return { data: { removed: true, unlinked: M.linksOf(c).map((l) => l.goalId) }, text: `${c.changes[0]!.summary} (as ${ctx.actor.name}). It can be restored for 30 days: restore_removed, or an admin on Workspace → Recently removed.` };
      });
    },
  },
  {
    name: 'link_goal_metric',
    title: 'Say which metric measures a goal',
    description: 'Measure a goal by a metric, for a slice: a team’s number (team) or the whole company’s (team left out). Or give unlink true to stop measuring it by one. The goal’s owner or an admin. The goal must have a number (not dated stages) in the metric’s unit; its own target is the target in that metric. A goal aiming the other way from the metric’s better direction is allowed, with a warning. Linking again the same way changes nothing.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal'], properties: {
      goal: str('The goal’s ID or key (G-12).'),
      metric: str('The metric’s ID or name. Required unless unlinking.'),
      team: str('The slice: a team by ID or name. Leave out for the whole company.'),
      unlink: { type: 'boolean', description: 'Stop measuring the goal by its metric.' },
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const g = goalOf(ctx, a.goal);
        if (a.unlink === true) {
          const c = M.unlinkGoalMetric(ax(ctx), g);
          if (!c) return { data: { saved: false }, text: `${g.title} isn’t measured by a metric.` };
          await save(ctx, c);
          return { data: { saved: true }, text: `${g.title}: ${c.changes[0]!.summary.charAt(0).toLowerCase()}${c.changes[0]!.summary.slice(1)} (as ${ctx.actor.name}).` };
        }
        if (a.metric == null || a.metric === '') return { isError: true, text: 'Say which metric, by ID or name, or give unlink true.' };
        const m = metricOf(ctx, a.metric);
        const teamId = sliceOf(ctx, a.team);
        const { warnings } = M.linkProblems(g, m);
        const c = M.linkGoalMetric(ax(ctx), g, m.id, teamId);
        if (!c) return { data: { saved: false, warnings }, text: `${g.title} is already measured by ${m.name} for ${M.sliceName(ctx.snapshot, teamId)}.` };
        await save(ctx, c);
        return { data: { saved: true, warnings }, text: [`${g.title}: ${c.changes[0]!.summary.charAt(0).toLowerCase()}${c.changes[0]!.summary.slice(1)} (as ${ctx.actor.name}).`, ...warnings.map((w) => `Warning: ${w}`)].join('\n') };
      });
    },
  },
];

export default tools;
