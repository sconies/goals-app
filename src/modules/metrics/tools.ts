/* The metric library's AI tools (backlog 0b): list and read the metrics, add, change or remove one, and say which
   metric measures a goal. Every rule is domain/metrics.ts's, so an assistant meets exactly the rules a person does,
   and every change is logged as that person, via the AI assistant. A removed metric comes back with restore_removed
   (kind metric). In a workspace that has switched the metric library off, these say so instead of running. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal, isKey } from '../../domain/goalKey';
import * as M from '../../domain/metrics';
import type { Metric, MetricDirection, MetricRefresh } from '../../domain/types';
import type { McpContext, ToolDef, ToolResult } from '../../mcp/tools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const VIA = { field: 'Via', from: '—', to: 'AI assistant (MCP)' };

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
    measures: M.goalsMeasuredBy(ctx.snapshot, m.id).map((g) => {
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
    description: 'Every metric in the library, by name: its unit, which way is better, its owner and how many goals it measures. Give a search to narrow it by name, meaning or source. get_metric has one in full.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { search: str('Words to look for in the name, meaning or source.') } },
    annotations: READ,
    async run(a, ctx) {
      const q = String(a.search ?? '').trim().toLowerCase();
      const list = M.liveMetrics(ctx.snapshot).filter((m) => !q || [m.name, m.meaning, m.source].some((t) => t.toLowerCase().includes(q)));
      const rows = list.map((m) => ({ id: m.id, name: m.name, unit: m.unit, direction: m.direction, owner: name(ctx, m.ownerId), goals: M.goalsMeasuredBy(ctx.snapshot, m.id).length }));
      return { data: { metrics: rows }, text: rows.length ? rows.map((r) => `${r.id} · ${r.name} (${r.unit}, ${M.DIRECTION_LABEL[r.direction].toLowerCase()}) · owner ${r.owner ?? '—'} · measures ${r.goals} ${r.goals === 1 ? 'goal' : 'goals'}`).join('\n') : q ? `No metric matches “${q}”.` : 'The metric library is empty. Add one with save_metric.' };
    },
  },
  {
    name: 'get_metric',
    title: 'Read a metric',
    description: 'One metric in full, by ID or name: what it means and how it’s calculated, unit, decimals, direction, source and its owner, refresh, owner, caveats, and every goal it measures with its slice (a team, or the whole company) and the goal’s target.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: { metric: str('The metric’s ID or name.') } },
    annotations: READ,
    async run(a, ctx) {
      return ruled(async () => {
        const d = metricData(ctx, metricOf(ctx, a.metric));
        const lines = [
          `${d.name} (${d.id})`, `Unit: ${d.unit}, ${d.decimals} decimals · ${d.directionLabel}`, `Meaning: ${d.meaning || '—'}`,
          `Source: ${d.source || '—'} (owned by ${d.sourceOwner || '—'}) · refresh: ${d.refresh ?? 'not said'}`, `Owner: ${d.owner ?? '—'}`, `Caveats: ${d.caveats || '—'}`,
          d.measures.length ? `Measures: ${d.measures.map((x) => `${x.key ?? x.goalId} ${x.goal} (${x.slice})`).join('; ')}` : 'Measures no goal yet.',
        ];
        return { data: d, text: lines.join('\n') };
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
    description: 'Remove a metric from the library: its owner or an admin. Every goal it measures is unlinked by the same save; the goals themselves don’t change. It can be restored for 30 days with restore_removed (kind metric), without its old links.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: { metric: str('The metric’s ID or name.') } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      return ruled(async () => {
        const c = M.removeMetric(ax(ctx), metricOf(ctx, a.metric).id);
        await save(ctx, c);
        return { data: { removed: true, unlinked: (c.metricLinks ?? []).map((l) => l.goalId) }, text: `${c.changes[0]!.summary} (as ${ctx.actor.name}). It can be restored for 30 days: restore_removed, or an admin on Workspace → Recently removed.` };
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
