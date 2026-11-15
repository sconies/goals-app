// The metric library's AI tools (spec/core/tools.md: list_metrics, get_metric, save_metric, remove_metric,
// retire_metric, merge_metrics, link_goal_metric). Each acts as the person, under the same rules as the screens.
import * as L from './rules.mjs';
import * as B from './library.mjs';
import { goalSummary } from './summary.mjs';

const err = (text) => ({ isError: true, text });
const ok = (data) => ({ isError: false, data });
const metricRef = (api, ref) => {
  const m = L.findMetric(B.rows(api.W).metrics, ref);
  return m || null;
};
const noMetric = (ref) => err(`There’s no metric called or with the ID ${ref}. Use list_metrics.`);
const personRef = (api, ref) => api.W.people.find((p) => p.id === ref || L.fold(p.name) === L.fold(ref) || (p.email && L.fold(p.email) === L.fold(ref)));
const live = (api) => new Set(api.R.standing(api.ctx.moment || api.W.builtFor).ws.goals.filter((g) => !g.stoppedAt && !g.removedAt).map((g) => g.id));
const moment = (api) => api.ctx.moment || api.W.builtFor;
const ctxOf = (api) => ({ actor: api.ctx.actor, now: api.ctx.now, week: api.ctx.week, via: 'MCP' });
const summary = (api, m) => ({ id: m.id, name: m.name, unit: m.unit, decimals: m.decimals || 0, direction: m.direction, owner: api.nameOf(m.ownerId), measurement: L.measurementOf(m), retired: !!m.retiredAt });

export const tools = {
  list_metrics: { kind: 'reads', title: 'List the metric library', run(api, a) {
    const W = api.W; const team = a.team ? (a.team === 'company' ? 'company' : W.teams.find((t) => t.id === a.team || L.fold(t.name) === L.fold(a.team))?.id) : '';
    if (a.team && !team) return err(`There’s no team called ${a.team}. Leave team out for the whole company. Teams: ${W.teams.map((t) => t.name).join(', ')}.`);
    const owner = a.owner ? personRef(api, a.owner) : null;
    if (a.owner && !owner) return err(`There’s no one called ${a.owner} in this workspace. Use list_people.`);
    const rctx = { metrics: B.rows(W).metrics, links: B.rows(W).metricLinks, liveGoalIds: live(api), people: W.people, moment: moment(api) };
    const r = L.findMetrics({ q: a.search, unit: a.unit, teamId: team, ownerId: owner?.id, dir: a.direction, unused: !!a.unused, sortout: !!a.sort_out, retired: !!a.retired, sort: a.sort, page: a.page }, rctx);
    const me = api.ctx.actor; const admin = !!api.R.person.get(me)?.admin;
    return ok({ total: r.total, page: r.page, pages: r.pages, metrics: r.rows.map((m) => ({ ...summary(api, m), ...(m.ownerId === me || admin ? { needs: L.metricNeeds(m, rctx).map((n) => n.words) } : {}) })) });
  } },
  get_metric: { kind: 'reads', title: 'Read one metric in full', run(api, a) {
    const m = metricRef(api, a.metric); if (!m) return noMetric(a.metric);
    const W = api.W; const lv = live(api);
    const goals = L.metricGoals(m.id, { links: B.rows(W).metricLinks, liveGoalIds: lv, goals: W.goals, teams: W.teams, summaryOf: (g) => goalSummary(g, api.S1, api.R, moment(api)) });
    return ok({ ...summary(api, m), meaning: m.meaning, source: m.source, sourceOwner: m.sourceOwner, refresh: m.refresh, caveats: m.caveats, stillToSay: L.stillToSay(m, W.people), measurementNote: m.measurementNote || '',
      parent: m.parentId ? B.rows(W).metrics.find((x) => x.id === m.parentId)?.name : null, level: m.level || null, confidence: m.confidence || null, gaming: m.gaming || null,
      children: L.childrenOf(m.id, B.rows(W).metrics).map((c) => c.name), parts: L.partsOf(m.id, B.rows(W).metricLinks, lv),
      goals: goals.map((g) => ({ key: g.goal.key, title: g.goal.title, status: g.status, for: g.slice, now: g.now, target: g.target, vsPlan: g.vsPlan, owner: g.owner })) });
  } },
  save_metric: { kind: 'changes', title: 'Add or change a metric', run(api, a) {
    const W = api.W; let id = null;
    if (a.id) { const m = metricRef(api, a.id); if (!m) return noMetric(a.id); id = m.id; }
    const input = { id };
    for (const [k, f] of [['name', 'name'], ['meaning', 'meaning'], ['unit', 'unit'], ['decimals', 'decimals'], ['direction', 'direction'], ['source', 'source'], ['source_owner', 'sourceOwner'], ['refresh', 'refresh'], ['caveats', 'caveats'], ['measurement', 'measurement'], ['measurement_note', 'measurementNote'], ['level', 'level'], ['confidence', 'confidence'], ['gaming', 'gaming']]) if (a[k] !== undefined) input[f] = a[k];
    if (a.owner !== undefined) { const p = personRef(api, a.owner); if (!p) return err(`There’s no one called ${a.owner} in this workspace. Use list_people.`); input.ownerId = p.id; }
    if (a.parent !== undefined) { if (a.parent === '') input.parentId = ''; else { const pm = metricRef(api, a.parent); if (!pm) return noMetric(a.parent); input.parentId = pm.id; } }
    const answers = {};
    for (const [k, v] of Object.entries(a.answers || {})) {
      if (!['name', 'unit', 'meaning'].includes(k)) return err(`There’s no question about “${k}”: answers are for name, unit or meaning.`);
      answers[k] = v;
    }
    const r = B.saveMetric(W, ctxOf(api), input, { answers, comparable: a.comparable, reason: a.reason, relabel: a.relabel, confirm: a.confirm || a.relabel !== undefined || a.reason !== undefined || a.comparable !== undefined });
    if (!r.ok && r.checks) return ok({ saved: false, checks: r.checks.map((c) => ({ about: c.field, question: c.text, answers: c.field === 'name' ? [`keep:${c.metric.id}`, `use:${c.metric.id}`] : c.field === 'unit' ? ['keep', 'use'] : ['as-written'] })) });
    if (!r.ok) return err(r.refused);
    return ok({ saved: !r.nothing, message: r.message, id: r.metric?.id, stillToSay: r.still, moreDecimals: r.moreDecimals || [] });
  } },
  remove_metric: { kind: 'changes', title: 'Remove a metric', run(api, a) {
    const m = metricRef(api, a.metric); if (!m) return noMetric(a.metric);
    const r = B.removeMetric(api.W, ctxOf(api), m.id); return r.ok ? ok({ message: r.message }) : err(r.refused);
  } },
  retire_metric: { kind: 'changes', title: 'Retire or bring back a metric', run(api, a) {
    const m = metricRef(api, a.metric); if (!m) return noMetric(a.metric);
    let rep = null; if (a.replaced_by) { const x = metricRef(api, a.replaced_by); if (!x) return noMetric(a.replaced_by); rep = x.id; }
    const r = a.bring_back ? B.unretireMetric(api.W, ctxOf(api), m.id) : B.retireMetric(api.W, ctxOf(api), m.id, a.why || '', rep);
    return r.ok ? ok({ message: r.message }) : err(r.refused);
  } },
  merge_metrics: { kind: 'changes', title: 'Merge one metric into another', run(api, a) {
    if (!api.R.person.get(api.ctx.actor)?.admin) return err('Only admins can merge metrics: it changes what other people’s goals are measured by.');
    const x = metricRef(api, a.from), y = metricRef(api, a.into); if (!x) return noMetric(a.from); if (!y) return noMetric(a.into);
    const r = B.mergeMetrics(api.W, ctxOf(api), x.id, y.id, a.why); return r.ok ? ok({ message: r.message, moved: r.moved }) : err(r.refused);
  } },
  link_goal_metric: { kind: 'changes', title: 'Say which metric measures a goal', run(api, a) {
    const g = api.R.findGoal(a.goal); if (!g) return err(`There’s no goal called or with the key ${a.goal}.`);
    if (!a.metric) { const r = B.unlinkGoal(api.W, ctxOf(api), g.id); return r.ok ? ok({ message: r.message }) : err(r.refused); }
    const m = metricRef(api, a.metric); if (!m) return noMetric(a.metric);
    const team = a.team && a.team !== 'company' ? api.W.teams.find((t) => t.id === a.team || L.fold(t.name) === L.fold(a.team))?.id : null;
    if (a.team && a.team !== 'company' && !team) return err(`There’s no team called ${a.team}. Leave team out for the whole company.`);
    const r = B.linkGoal(api.W, ctxOf(api), { goalId: g.id, metricId: m.id, teamId: team, part: a.part || '', reason: a.reason || '', answers: a.answers || {} });
    if (!r.ok && r.checks) return ok({ saved: false, checks: r.checks.map((c) => ({ about: c.field, question: c.text, answers: c.field === 'others' ? ['carry-on'] : ['keep', `use:${c.use}`] })) });
    return r.ok ? ok({ saved: !r.nothing, message: r.message, warnings: r.warnings || [] }) : err(r.refused);
  } },
};
