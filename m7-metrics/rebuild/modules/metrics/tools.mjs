// The library's AI tools: the same rules and saves as the form (ops.mjs), as the person the token acts for, logged “via MCP”.
// The core's server refuses each with the module-off sentence while the library is off.
import * as R from './rules.mjs';
import * as O from './ops.mjs';
import * as RD from './reading.mjs';

const obj = (props, req = []) => ({ type: 'object', properties: props, required: req });
const S = { type: 'string' }, I = { type: 'integer' }, B = { type: 'boolean' }, N = { type: 'number' }, OB = { type: 'object' }, A = { type: 'array' };
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const rw = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const ctxOf = (app) => ({ W: app.W, S1: app.S1, now: app.now || app.W.builtFor });
function saved(app, me, r, action) {
  if (r.error) return { error: r.error, structured: { checks: r.checks || [], ask: r.ask || null } };
  if (r.nothing || r.use) return { text: r.text, structured: { saved: false, use: r.use || null } };
  app.log(me.id, { entity: 'module', module: 'metrics', action, entityId: r.entityId, summary: r.summary, diffs: r.diffs || [] }, 'mcp');
  O.logLines(app, me.id, r.lines || [], 'mcp');
  return { text: `${r.summary}${r.warnings && r.warnings.length ? ` Warning: ${r.warnings.join(' ')}` : ''}${r.still ? ` ${r.still}` : ''}`, structured: { saved: true, warnings: r.warnings || [], stillToSay: r.still || null, id: r.entityId } };
}
const metricOut = (app, m) => {
  const ctx = ctxOf(app), live = R.liveGoalIds(ctx);
  return { id: m.id, name: m.name, unit: m.unit, decimals: m.decimals, direction: m.direction, meaning: m.meaning, source: m.source, sourceOwner: m.sourceOwner, refresh: m.refresh, owner: R.ownerName(app.W, m), caveats: m.caveats,
    measurement: R.measurementOf(m), measurementNote: m.measurementNote || '', parent: m.parentId || null, level: m.level || null, confidence: m.confidence || null, gaming: m.gaming || null, retired: !!m.retiredAt,
    stillToSay: R.stillToSay(app.W, m), parts: R.partsOf(ctx, m, live), children: R.childrenOf(app.W, m).map((c) => ({ id: c.id, name: c.name, level: c.level || null })),
    goals: R.metricGoals(ctx, m, live).map((x) => ({ key: x.goal.key, title: x.goal.title, status: x.status, slice: x.slice, now: x.now, target: x.target, vsPlan: x.vsPlan, owner: x.owner })) };
};
export const TOOLS = [
  { name: 'list_metrics', title: 'List metrics', description: 'The metric library: find by words, unit, team (or company), owner, direction, unused or something to sort out; sort by name, goals or latest change.', annotations: ro,
    inputSchema: obj({ q: S, unit: S, team_id: S, owner_id: S, direction: S, unused: B, sort_out: B, sort: S, page: I }),
    run: (app, me, a) => { const ctx = ctxOf(app); const r = R.findMetrics(ctx, { q: a.q, unit: a.unit, teamId: a.team_id, ownerId: a.owner_id, dir: a.direction, unused: a.unused, sortout: a.sort_out, sort: a.sort, page: a.page });
      const live = R.liveGoalIds(ctx);
      return { text: `${r.total} ${r.total === 1 ? 'metric' : 'metrics'}.\n${r.rows.map((m) => `${m.name} (${m.id}) · ${m.unit} · ${R.DIR_WORDS[m.direction]} · ${R.ownerName(app.W, m) || 'no owner'}${R.mayChange(app.W, me.id, m) && R.metricNeeds(ctx, m, live).length ? ` · needs: ${R.needsLine(R.metricNeeds(ctx, m, live))}` : ''}`).join('\n')}`, structured: { total: r.total, metrics: r.rows.map((m) => ({ id: m.id, name: m.name, unit: m.unit, direction: m.direction })) } }; } },
  { name: 'get_metric', title: 'Get a metric', description: 'One metric in full: what it means, its source, what is still to say, and every goal it measures side by side.', annotations: ro, inputSchema: obj({ metric_id: S }, ['metric_id']),
    run: (app, me, a) => { const m = R.findMetric(app.W, a.metric_id); if (!m || m.removedAt) return { error: `There’s no metric ${a.metric_id}.` }; const o = metricOut(app, m);
      const src = R.sourceFor(R.demoSources(app.W, app.S1), m.id); if (src) o.differentNumbers = RD.differentWords(app.W, app.S1, m, src.name, app.now || app.W.builtFor);
      return { text: `${m.name}: ${m.meaning || 'No meaning yet.'}\n${o.stillToSay}\n${o.goals.map((g) => `${g.key} ${g.title} · ${g.slice} · ${g.now} · ${g.target} · ${g.vsPlan}`).join('\n') || 'No goals.'}`, structured: o }; } },
  { name: 'save_metric', title: 'Add or change a metric', description: 'Adds a metric (no metric_id) or changes one (its owner or an admin). Returns checks to answer first; answers: name keep|use:<id>, unit keep|use, meaning as-written.', annotations: rw,
    inputSchema: obj({ metric_id: S, name: S, meaning: S, unit: S, decimals: I, direction: S, source: S, source_owner: S, refresh: S, owner_id: S, caveats: S, measurement: S, measurement_note: S, parent: S, level: S, confidence: S, gaming: S, answers: OB, comparable: B, reason: S, relabel: B, confirm: B }),
    run: (app, me, a) => saved(app, me, O.saveMetric(app, me.id, { id: a.metric_id, name: a.name, meaning: a.meaning, unit: a.unit, decimals: a.decimals, direction: a.direction, source: a.source, sourceOwner: a.source_owner, refresh: a.refresh, ownerId: a.owner_id, caveats: a.caveats, measurement: a.measurement, measurementNote: a.measurement_note, parentId: a.parent, level: a.level, confidence: a.confidence, gaming: a.gaming }, { answers: a.answers || {}, comparable: a.comparable, reason: a.reason, relabel: a.relabel, confirm: a.confirm }), 'save') },
  { name: 'link_goal_metric', title: 'Measure a goal by a metric', description: 'Says which metric measures a goal, for a team (team_id) or the whole company, and optionally which part. The goal’s owner or an admin. answers: part keep|use:<part>, others carry-on.', annotations: rw,
    inputSchema: obj({ goal_id: S, metric_id: S, team_id: S, part: S, reason: S, answers: OB }, ['goal_id', 'metric_id']),
    run: (app, me, a) => saved(app, me, O.linkGoal(app, me.id, { goalId: a.goal_id, metricId: a.metric_id, teamId: a.team_id || null, part: a.part, reason: a.reason, answers: a.answers || {} }), 'link') },
  { name: 'unlink_goal_metric', title: 'Stop measuring a goal by its metric', description: 'The goal’s owner or an admin.', annotations: rw, inputSchema: obj({ goal_id: S }, ['goal_id']),
    run: (app, me, a) => saved(app, me, O.unlinkGoal(app, me.id, a.goal_id), 'unlink') },
  { name: 'remove_metric', title: 'Remove a metric', description: 'Deletes a metric no goal has ever been measured by (one that has is retired instead). Restorable.', annotations: { ...rw, destructiveHint: true }, inputSchema: obj({ metric_id: S }, ['metric_id']),
    run: (app, me, a) => saved(app, me, O.removeMetric(app, me.id, a.metric_id), 'remove') },
  { name: 'restore_metric', title: 'Restore a removed metric', description: 'Brings back a metric from Recently removed.', annotations: rw, inputSchema: obj({ metric_id: S }, ['metric_id']),
    run: (app, me, a) => saved(app, me, O.restoreMetric(app, me.id, a.metric_id), 'restore') },
  { name: 'retire_metric', title: 'Retire or bring back a metric', description: 'Retires a metric with a reason (and optionally the metric replacing it), or brings it back (bring_back: true).', annotations: rw, inputSchema: obj({ metric_id: S, reason: S, replaced_by: S, bring_back: B }, ['metric_id']),
    run: (app, me, a) => saved(app, me, a.bring_back ? O.unretireMetric(app, me.id, a.metric_id) : O.retireMetric(app, me.id, a.metric_id, a.reason, a.replaced_by), 'retire') },
  { name: 'merge_metrics', title: 'Merge one metric into another', description: 'Admins: every goal moves to the second, in the same unit; the first is retired pointing to it.', annotations: rw, inputSchema: obj({ from_id: S, into_id: S }, ['from_id', 'into_id']),
    run: (app, me, a) => saved(app, me, O.mergeMetrics(app, me.id, a.from_id, a.into_id), 'merge') },
  { name: 'load_metrics_sheet', title: 'Load Metrics sheet rows', description: 'Rows with the Metrics sheet’s columns (ID, Metric, Unit, Direction, …), through the library’s rules; dry_run plans without saving.', annotations: rw, inputSchema: obj({ rows: A, answers: OB, dry_run: B, leave_out: B }, ['rows']),
    run: (app, me, a) => { const r = O.loadSheet(app, me.id, a.rows || [], { answers: a.answers || {}, dryRun: a.dry_run, leaveOut: a.leave_out });
      if (a.dry_run) return { text: `${r.plan.summary}. ${r.plan.issues.map((x) => `${x.level === 'must' ? 'Must fix' : 'Check'}: ${x.message}`).join(' ')} Nothing was saved (dry run).`, structured: { summary: r.plan.summary, issues: r.plan.issues } };
      return saved(app, me, r, 'sheet'); } },
  { name: 'read_metric_number', title: 'What a goal’s source says', description: 'The latest reading from the number source of the metric measuring a goal, and its state for a check-in.', annotations: ro, inputSchema: obj({ goal_id: S, value: N }, ['goal_id']),
    run: (app, me, a) => { const g = app.goal(a.goal_id); if (!g) return { error: `There’s no goal ${a.goal_id}.` }; const x = RD.readingFor(app, g, a.value ?? null); if (!x) return { text: 'No source can be read for this goal.', structured: { state: 'none' } };
      return { text: x.asked.reading ? `${x.src.name} said ${x.asked.reading.value} at ${x.asked.reading.at}: ${x.state}.` : `${x.src.name}: ${x.state}.`, structured: { source: x.src.name, reading: x.asked.reading || null, state: x.state } }; } },
];
