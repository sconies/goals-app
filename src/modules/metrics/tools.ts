/* The metric library's AI tools (backlog 0b): list and read the metrics, add, change or remove one, and say which
   metric measures a goal. Every rule is rules.ts's, so an assistant meets exactly the rules a person does,
   and every change is logged as that person, via the AI assistant. A removed metric comes back with restore_removed
   (kind metric). In a workspace that has switched the metric library off, these say so instead of running. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { findGoal, isKey } from '../../domain/goalKey';
import * as M from './rules';
import { linkGoalMetric, linkReads } from './rulesLink';
import { linkedGoals, mergeMetrics, retireMetric, unretireMetric } from './rulesChange';
import * as L from './rulesLibrary';
import { goalsOfMetric, libraryReads, lineOf, proposedOfMetric } from './reads';
import { answersFrom } from './rulesDefine';
import { openChecks, saveMetricAsked } from './rulesSave';
import { forWords, linkChecks, partsOf, type LinkCheck } from './rulesParts';
import { goalStatus } from '../../domain/status';
import { LABEL } from '../../domain/vocabulary';
import type { DisplayStatus } from '../../domain/types';
import type { Metric, MetricDirection, MetricRefresh } from './types';
import type { McpContext, ToolDef, ToolResult } from '../../mcp/tools';
import { listed } from '../../mcp/listed';
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
    retired: m.retiredAt ? { at: m.retiredAt, by: name(ctx, m.retiredBy ?? ''), why: m.retiredWhy ?? '', replacedBy: m.replacedBy ?? null } : null,
    marks: (m.marks ?? []).map((k) => ({ week: k.week, at: k.at, kind: k.kind, why: k.why, was: k.was, now: k.now, by: name(ctx, k.by) })),
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
      retired: { type: 'boolean', description: 'Retired metrics only (left out otherwise).' },
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
          dir: a.direction === 'higher' || a.direction === 'lower' ? a.direction : undefined, unused: a.unused === true, sortout: a.sort_out === true, retired: a.retired === true,
          sort: a.sort === 'goals' || a.sort === 'changed' ? a.sort : 'name', page: typeof a.page === 'number' ? a.page : 1,
        };
        const found = L.findMetrics(libraryReads(ctx.snapshot, ctx.now), ask);
        const statusOf = (id: string) => { const g = ctx.snapshot.goals.find((x) => x.id === id); return g ? goalStatus(g, ctx.cycle, ctx.snapshot.checkIns, ctx.today).status : null; };
        const rows = found.rows.map(({ metric: m, owner, goalIds, needs }) => {
          const byStatus = L.goalsByStatus(goalIds.map(statusOf).filter((s): s is DisplayStatus => !!s));
          return { id: m.id, name: m.name, unit: m.unit, direction: m.direction, owner, goals: goalIds.length, goalsByStatus: byStatus.map((c) => ({ status: c.status, count: c.n, label: LABEL[c.status] })), needs: M.canEditMetric(ctx.actor, m) ? needs.map((x) => ({ id: x.id, sentence: x.sentence })) : [] };
        });
        return listed({ total: found.total, page: found.page, pages: found.pages, metrics: rows });
      });
    },
  },
  {
    name: 'get_metric',
    title: 'Read a metric',
    description: 'One metric in full, by ID or name, as its page shows it: what it means and how it’s calculated, unit, decimals, direction, source and its owner, refresh, owner, caveats; every goal it measures, worst first, with its status, slice (a team, or the whole company), latest number, target with its week, where it stands against plan and owner (rule 2 of the library), and the lowest and highest now; the parts its goals use (`parts`, most used first); the proposed goals that name it, apart and with no numbers; and, for its owner and admins, what it still needs (rule 3).',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: { metric: str('The metric’s ID or name.') } },
    annotations: READ,
    async run(a, ctx) {
      return ruled(async () => {
        const m = metricOf(ctx, a.metric);
        const d = metricData(ctx, m);
        const side = goalsOfMetric(ctx.snapshot, ctx.cycle, ctx.today, ctx.week, m.id);
        const goals = side.map((r) => ({ goalId: r.goal.id, key: r.goal.key ?? null, goal: r.goal.title, status: r.status, statusLabel: LABEL[r.status], slice: r.slice, now: r.now, target: r.target, vsPlan: r.vsPlan, owner: r.owner }));
        const summary = L.summaryLine(side);
        // Proposed goals (GE10) that name it: apart, with no numbers, in no comparison.
        const proposed = proposedOfMetric(ctx.snapshot, m.id).map((g) => ({ goalId: g.id, key: g.key ?? null, goal: g.title, owner: ctx.snapshot.people.find((p) => p.id === g.ownerId)?.name ?? null }));
        // The parts goals on it use (MT2), as the goal form offers them: link_goal_metric points here.
        const parts = partsOf(M.linksOf(ctx.snapshot).filter((l) => l.metricId === m.id));
        const needs = M.canEditMetric(ctx.actor, m) ? L.metricNeeds(m, libraryReads(ctx.snapshot, ctx.now)).map((x) => ({ id: x.id, sentence: x.sentence })) : [];
        // Rule 1's line: words, never a score.
        const still = lineOf(ctx.snapshot, m);
        const stillToSay = { full: still.full, missing: still.missing, ownerLeft: still.ownerLeft, line: still.line };
        const lines = [
          `${d.name} (${d.id})`, still.line, `Unit: ${d.unit}, ${L.decimalsWords(d.decimals)} · ${d.directionLabel}`, `Meaning: ${d.meaning || '—'}`,
          `Source: ${d.source || '—'} (owned by ${d.sourceOwner || '—'}) · refresh: ${d.refresh ?? 'not said'}`, `Owner: ${d.owner ?? '—'}`, `Caveats: ${d.caveats || '—'}`,
          goals.length ? `Goals measured by it (${goals.length}):\n${goals.map((x) => `- ${x.statusLabel} · ${x.key ?? x.goalId} ${x.goal} · for ${x.slice} · now ${x.now} · target ${x.target} · ${x.vsPlan} · ${x.owner}`).join('\n')}` : 'Measures no goal yet.',
          ...(summary ? [summary] : []),
          ...(parts.length ? [`Parts in use: ${parts.join(', ')}`] : []),
          ...(proposed.length ? [`Proposed (${proposed.length}), not judged: ${proposed.map((x) => `${x.key ?? x.goalId} ${x.goal}${x.owner ? ` (${x.owner})` : ''}`).join('; ')}`] : []),
          ...(needs.length ? [`To sort out: ${needs.map((x) => x.sentence).join('; ')}`] : []),
        ];
        // History (spec 2.4): the change log's entries for this metric, newest first, 20.
        const history = ctx.snapshot.changes.filter((c) => c.entity === 'metric' && c.entityId === m.id && !c.goalId).slice(-20).reverse().map((c) => ({ at: c.at, by: name(ctx, c.actorId), action: c.action, summary: c.summary }));
        if (d.retired) lines.splice(1, 0, `Retired on ${d.retired.at.slice(0, 10)} by ${d.retired.by ?? '—'}: “${d.retired.why}”${d.retired.replacedBy ? ` Replaced by ${M.metricsOf(ctx.snapshot).find((x) => x.id === d.retired!.replacedBy)?.name ?? d.retired.replacedBy}.` : ''}`);
        if (d.marks.length) lines.push(`Marks on its goals: ${d.marks.map((k) => `${k.kind === 'direction' ? 'direction' : 'definition'} changed in week ${k.week}: ${k.why}`).join('; ')}`);
        return { data: { ...d, stillToSay, goals, parts, proposed, summary, needs, history }, text: lines.join('\n') };
      });
    },
  },
  {
    name: 'save_metric',
    title: 'Add or change a metric',
    description: 'Add a metric to the library (anyone; you own it unless you name an owner), or change one by giving its id (its owner or an admin). A new metric needs a name, a unit and a direction; everything else is optional. Fields left out keep their value. Saving it unchanged saves nothing. Changing the unit or direction of a metric goals use is refused with a question: ask the person, then call again with confirm: true. A likely mistake is questioned before anything is saved (a name one letter or a word from another metric’s, or one a metric used to have; a unit spelt differently from one in use; a percentage whose meaning doesn’t say out of what): the call returns `checks`, each with its question and answers, and saves nothing. Ask the person, then call again with `answers`. The result says what the metric still needs to say (“Fully defined”, or “Still to say: …”); it is never a score.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { id: str('The metric to change, by ID or name. Leave out to add one.'), ...FIELDS, confirm: { type: 'boolean', description: 'Kept for older callers; the questions below replace it.' }, comparable: { type: 'boolean', description: 'When the meaning or source of a metric goals use changes: true if it is still the same number (better words; nothing is marked), false if the number itself changes from this week (its goals’ charts and History say so; give reason).' }, reason: { type: 'string', description: 'Why, in a line (up to 300 characters): required when the number itself changes (comparable false) or the direction changes. Every goal measured by it shows this.' }, relabel: { type: 'boolean', description: 'When the unit of a metric goals use changes: true if the new unit is only a new label for the same numbers (its goals’ unit changes too). A different scale is refused: add a new metric instead.' }, answers: { type: 'object', additionalProperties: false, description: 'The person’s answers to the checks a previous call returned.', properties: { name: str('“keep:<id>” (mine is different from that metric), or “use:<id>” to use that metric instead (nothing is saved), with the id the question gave.'), unit: str('“keep” the unit as typed, or “use” the one in use.', { enum: ['keep', 'use'] }), meaning: str('“as-written”: the meaning is right as written.', { enum: ['as-written'] }) } } } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const input: M.MetricInput & { id?: string; confirm?: boolean; comparable?: boolean; reason?: string; relabel?: boolean } = {
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
          ...(a.confirm === true ? { confirm: true } : {}),
          ...(typeof a.comparable === 'boolean' ? { comparable: a.comparable } : {}),
          ...(typeof a.reason === 'string' ? { reason: a.reason } : {}),
          ...(a.relabel === true ? { relabel: true } : {}),
        };
        // Rule 1's questions first, after the rights: a Check left unanswered saves nothing and returns the questions.
        const answers = answersFrom(a.answers);
        if (answers.name?.startsWith('use:')) { const use = metricOf(ctx, answers.name.slice(4)); return { data: { saved: false, use: use.id }, text: `Nothing saved: use ${use.name} (${use.id}) instead.` }; }
        const { open } = openChecks(ax(ctx), { ...input, answers });
        if (open.length) {
          const checks = open.map((c) => ({ field: c.field, question: c.words, answers: c.answers.map((x) => ({ answer: x.choice, label: x.label })) }));
          return { data: { saved: false, checks }, text: `Nothing saved yet. Ask the person, then call again with answers:\n${checks.map((c) => `- ${c.field}: ${c.question} (${c.answers.map((x) => `${x.answer}: ${x.label}`).join('; ')})`).join('\n')}` };
        }
        const x = ax(ctx);
        const was = input.id ? M.metricsOf(x.snapshot).find((m) => m.id === input.id) : undefined;
        const { commit, metric } = saveMetricAsked(x, { ...input, answers });
        if (!commit) return { data: { saved: false, id: metric.id }, text: `Nothing changed: ${metric.name} already says that.` };
        await save(ctx, commit);
        const still = lineOf(ctx.snapshot, metric).line;
        // Fewer decimal places: the goals that show more keep theirs, as the form's read-back says (#351 review).
        const more = was && metric.decimals < was.decimals ? linkedGoals(x.full ?? x.snapshot, metric.id).filter((g) => g.decimals > metric.decimals) : [];
        const places = more.length ? ` ${more.length === 1 ? '1 goal shows' : `${more.length} goals show`} more decimal places than ${metric.name} now does: ${more.map((g) => g.title).join(', ')}. They keep theirs until their owners change them.` : '';
        return { data: { saved: true, id: metric.id, changes: commit.changes[0]!.diffs, stillToSay: still, ...(more.length ? { moreDecimals: more.map((g) => g.id) } : {}) }, text: `${commit.changes[0]!.summary} (as ${ctx.actor.name}). Its ID is ${metric.id}. ${still}${places}` };
      });
    },
  },
  {
    name: 'remove_metric',
    title: 'Delete a metric no goal has used',
    description: 'Delete a metric that has never measured a goal: its owner or an admin. One that has measured a goal is refused: retire it instead (retire_metric). It can be restored for 30 days with restore_removed (kind metric).',
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
    name: 'retire_metric',
    title: 'Retire a metric, or bring one back',
    description: 'Retire a metric (its owner or an admin), with a reason: it leaves the pickers and the library’s list, its goals keep their numbers and plans and say it was retired, and nothing is lost. Name replaced_by (a metric in the same unit) to offer its goals’ owners another. Or give bring_back true to bring a retired metric back as it was.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['metric'], properties: {
      metric: str('The metric’s ID or name.'),
      why: str('Why it is retired, in a line (up to 300 characters). Required unless bringing it back.'),
      replaced_by: str('The metric its goals’ owners are offered instead, by ID or name: one in use, in the same unit.'),
      bring_back: { type: 'boolean', description: 'Bring a retired metric back.' },
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const m = metricOf(ctx, a.metric);
        const c = a.bring_back === true ? unretireMetric(ax(ctx), m.id) : retireMetric(ax(ctx), m.id, String(a.why ?? ''), a.replaced_by ? metricOf(ctx, a.replaced_by).id : null);
        await save(ctx, c);
        const goals = c.changes.filter((x) => x.goalId).length;
        return { data: { saved: true, retired: a.bring_back !== true, goals }, text: `${c.changes[0]!.summary} (as ${ctx.actor.name}).${a.bring_back === true ? '' : ` ${goals} ${goals === 1 ? 'goal stays' : 'goals stay'} measured by it and say so. Bring it back with bring_back true.`}` };
      });
    },
  },
  {
    name: 'merge_metrics',
    title: 'Merge one metric into another',
    description: 'Merge a metric into another in the same unit (admins only): every goal it measures moves to the other, keeping its slice and part, and it is retired pointing to the other. One save; Undo in the app takes it all back.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['from', 'into'], properties: {
      from: str('The metric to merge away, by ID or name.'),
      into: str('The metric to keep, by ID or name: one in use, in the same unit.'),
      why: str('Why, in a line. “The same number as {into}.” when left out.'),
    } },
    annotations: WRITE,
    async run(a, ctx) {
      return ruled(async () => {
        const c = mergeMetrics(ax(ctx), metricOf(ctx, a.from).id, metricOf(ctx, a.into).id, String(a.why ?? ''));
        await save(ctx, c);
        return { data: { saved: true, moved: c.changes.filter((x) => x.goalId).map((x) => x.goalId) }, text: `${c.changes[0]!.summary} (as ${ctx.actor.name}).` };
      });
    },
  },
  {
    name: 'link_goal_metric',
    title: 'Say which metric measures a goal',
    description: 'Measure a goal by a metric, for a slice: a team’s number (team) or the whole company’s (team left out), and optionally one part of it (part). A first call that raises a question saves nothing and returns `checks`; call again with `answers`. Or give unlink true to stop measuring it by one. The goal’s owner or an admin. The goal must have a number (not dated stages) in the metric’s unit; its own target is the target in that metric. A goal aiming the other way from the metric’s better direction is allowed, with a warning. Linking again the same way changes nothing.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal'], properties: {
      goal: str('The goal’s ID or key (G-12).'),
      metric: str('The metric’s ID or name. Required unless unlinking.'),
      team: str('The slice: a team by ID or name. Leave out for the whole company.'),
      part: str('Which part of that number, up to 60 characters (“tier-1 services”, a region). Leave out or empty for all of it. Reuse a part other goals on the metric use: get_metric lists them under parts.'),
      reason: str('Why the goal is measured differently now. Required when a goal with check-ins is measured differently from its last link (another metric, team or part, even after unlinking); it shows in the goal’s History.'),
      answers: { type: 'object', additionalProperties: false, description: 'Answers to the checks a first call returned: part ("keep" or "use:<part>"), others ("carry-on": another goal already measures the same number).', properties: { part: { type: 'string' }, others: { type: 'string' } } },
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
        const ans = (a.answers ?? {}) as Record<string, string>;
        const typed = typeof a.part === 'string' ? a.part.trim() : '';
        const part = ans.part?.startsWith('use:') ? ans.part.slice(4) : typed;
        const reason = typeof a.reason === 'string' ? a.reason : '';
        const { warnings } = M.linkProblems(g, m);
        // The questions rule 2 asks about the part (a Must fix refuses in linkGoalMetric; aim and decimals stay warnings).
        const answered = (c: LinkCheck) => (/already measures/.test(c.words) ? ans.others === 'carry-on' : !!ans.part);
        const all = linkChecks(g, m, { teamId, part }, { errors: M.linkProblems(g, m).errors, warnings: [] }, linkReads(ax(ctx), g, m.id), reason);
        // A Must fix refuses first (linkGoalMetric says it); questions are asked only of a link that could be saved.
        const open = all.some((c) => c.kind === 'fix') ? [] : all.filter((c) => c.kind === 'check' && !answered(c));
        if (open.length) return { data: { saved: false, checks: open.map(({ field, words, answers }) => ({ field, words, answers: answers.map((x) => x.choice) })) }, text: ['Nothing saved yet. Answer these, then call again with answers:', ...open.map((c) => `${c.field}: ${c.words} (${c.answers.map((x) => x.choice).join(' / ')})`)].join('\n') };
        const c = linkGoalMetric(ax(ctx), g, m.id, teamId, part, reason);
        if (!c) return { data: { saved: false, warnings }, text: `${g.title} is already measured by ${m.name} for ${forWords(M.sliceName(ctx.snapshot, teamId), part)}.` };
        await save(ctx, c);
        return { data: { saved: true, warnings }, text: [`${g.title}: ${c.changes[0]!.summary.charAt(0).toLowerCase()}${c.changes[0]!.summary.slice(1)} (as ${ctx.actor.name}).`, ...warnings.map((w) => `Warning: ${w}`)].join('\n') };
      });
    },
  },
];

export default tools;
