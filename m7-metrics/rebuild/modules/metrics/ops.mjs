// The library's saves, one door for the form, the AI tools and the sheet: each checks rules.mjs, writes the module's own
// rows (and a goal's unmeasuredSince, the core's field the library fills in), and says what to log. Every save keeps a
// snapshot first, so one Undo puts it back.
import * as R from './rules.mjs';
import { planMetricsSheet, applyMetricsPlan } from './sheet.mjs';

const ctxOf = (app) => ({ W: app.W, S1: app.S1, now: app.now || app.W.builtFor });
const nowOf = (app) => app.now || app.W.builtFor;
const FIELDS = [['name', 'Name'], ['meaning', 'Meaning'], ['unit', 'Unit'], ['decimals', 'Decimals'], ['direction', 'Direction'], ['source', 'Source'], ['sourceOwner', 'Source owner'], ['refresh', 'Refresh'], ['ownerId', 'Owner'], ['caveats', 'Caveats'], ['measurement', 'Measured'], ['measurementNote', 'What’s missing'], ['parentId', 'Part of'], ['level', 'How it relates'], ['confidence', 'Confidence'], ['gaming', 'How it could be gamed']];
const shown = (W, f, v) => (v === undefined || v === null || v === '' ? '—' : f === 'ownerId' ? (W.people.find((p) => p.id === v)?.name || v) : f === 'direction' ? R.DIR_WORDS[v] : f === 'parentId' ? (R.findMetric(W, v)?.name || v) : String(v));

// ---------- one Undo per save ----------
function snapshot(app) {
  return { lib: JSON.parse(JSON.stringify(R.lib(app.W))), holds: app.W.goals.map((g) => [g.id, g.unmeasuredSince ?? null, g.unit]), readings: app.W.checkIns.filter((c) => c.reading).map((c) => [c.id, c.reading]) };
}
function remember(app, actor, summary, snap) { app._metricsUndo = app._metricsUndo || []; app._metricsUndo.push({ actor, summary, snap }); }
export function undoLast(app, actor) {
  const st = app._metricsUndo || [];
  for (let i = st.length - 1; i >= 0; i--) if (st[i].actor === actor) {
    const { snap, summary } = st.splice(i, 1)[0];
    app.W.modules.metrics = snap.lib;
    const by = new Map(snap.holds.map(([id, h, u]) => [id, [h, u]]));
    for (const g of app.W.goals) if (by.has(g.id)) { const [h, u] = by.get(g.id); if (h) g.unmeasuredSince = h; else delete g.unmeasuredSince; g.unit = u; }
    app.rebind();
    return { ok: true, summary: `Undid: ${summary}`, diffs: [] };
  }
  return { error: 'There’s nothing of yours to undo here.' };
}

// ---------- held to no number (rule 11) ----------
function setHolds(app, actor, metric, lines, { off = false } = {}) {
  const W = app.W, ctx = ctxOf(app), live = R.liveGoalIds(ctx);
  const gap = !off && !metric.removedAt && !R.isRetired(metric) && R.measurementOf(metric) === 'gap';
  for (const l of R.lib(W).metricLinks.filter((x) => x.metricId === metric.id && !x.removedAt)) holdGoal(app, W.goals.find((g) => g.id === l.goalId), gap, metric, lines, live);
}
function holdGoal(app, g, gap, metric, lines, live) {
  if (!g || g.removedAt || g.stoppedAt || g.kind === 'milestone') return;
  if (gap && !g.unmeasuredSince) { g.unmeasuredSince = nowOf(app); lines.push({ goalId: g.id, summary: `Held to no number until “${metric.name}” is measured` }); }
  if (!gap && g.unmeasuredSince) { delete g.unmeasuredSince; lines.push({ goalId: g.id, summary: metric ? `Held to its plan again, as “${metric.name}” is measured` : 'Held to its plan again' }); }
}
const logLines = (app, actor, lines, via) => { for (const x of lines) app.log(actor, { entity: 'goal', goalId: x.goalId, entityId: x.goalId, module: 'metrics', action: 'measured', summary: x.summary, diffs: x.diffs || [] }, via); };

// ---------- add or change a metric ----------
const clean = (v) => (typeof v === 'string' ? v.trim() : v);
export function saveMetric(app, actor, input, opts = {}) {
  const W = app.W, ctx = ctxOf(app), now = nowOf(app);
  const before = input.id ? R.findMetric(W, input.id) : null;
  if (input.id && (!before || before.removedAt)) return { error: 'There’s no metric like that in the library.' };
  if (before && !R.mayChange(W, actor, before)) return { error: R.changeRefusal(W, before) };
  const next = before ? { ...before } : { id: '', name: '', meaning: '', unit: '', decimals: 0, direction: '', source: '', sourceOwner: '', refresh: null, ownerId: actor, caveats: '', createdBy: actor, createdAt: now, updatedAt: now };
  for (const [f] of FIELDS) if (input[f] !== undefined) next[f] = clean(input[f]);
  if (input.decimals !== undefined && input.decimals !== '') next.decimals = Number(input.decimals);
  if (next.refresh === '') next.refresh = null;
  for (const f of ['measurement', 'level', 'parentId', 'confidence', 'gaming']) if (next[f] === '' || next[f] === null) delete next[f];
  if (R.measurementOf(next) === 'measured') next.measurementNote = '';
  const probs = R.metricProblems(W, next, before?.id);
  if (probs.length) return { error: probs.map((p) => p.message).join(' '), problems: probs };
  // the questions, answered once (rule 6): adding asks all three; changing only about a field that changed
  const answers = opts.answers || {};
  let checks = [];
  if (!before || before.name !== next.name) checks.push(...R.nameChecks(ctx, next.name, before?.id));
  if (!before || before.unit !== next.unit) checks.push(...R.unitChecks(W, next.unit, before?.id));
  if (!before || before.meaning !== next.meaning || before.unit !== next.unit) checks.push(...R.meaningChecks(next));
  if (answers.name && String(answers.name).startsWith('use:')) return { use: answers.name.slice(4), text: `Nothing was saved: use ${R.findMetric(W, answers.name.slice(4))?.name}.` };
  const c = checks.find((x) => x.field === 'unit');
  if (c && answers.unit === 'use') { next.unit = c.use; checks = checks.filter((x) => x !== c); }
  const open = checks.filter((x) => !((x.field === 'name' && answers.name === 'keep') || (x.field === 'unit' && answers.unit === 'keep') || (x.field === 'meaning' && answers.meaning === 'as-written')));
  if (open.length) return { error: `Answer these questions first: ${open.map((x) => x.question).join(' ')}`, checks: open };
  // what kind of change (rule 8)
  const goals = before ? R.linkedGoals(W, before) : [];
  let mark = null;
  if (before) {
    const kinds = R.changeKinds(before, next, goals, { relabel: !!opts.relabel });
    if (kinds[0] === 'none') return { nothing: true, text: 'Nothing to save: it already says that.' };
    if (kinds.includes('scale')) return { error: `${goals.length === 1 ? '1 goal is' : `${goals.length} goals are`} measured by it in ${before.unit}. A different scale is a new metric; if only the label changes, say it is a new label.`, ask: 'relabel' };
    if ((kinds.includes('relabel') || kinds.includes('direction')) && !opts.confirm) return { error: `${goals.length === 1 ? '1 goal uses' : `${goals.length} goals use`} it: ${goals.slice(0, 6).map((g) => g.title).join(', ')}${goals.length > 6 ? ` and ${goals.length - 6} more` : ''}. Their numbers and plans don’t change. Confirm to save.`, ask: 'confirm' };
    if (kinds.includes('direction')) { if (!String(opts.reason || '').trim()) return { error: 'Say why which way is better changes, in a line. Every goal measured by it will show this.' }; mark = { kind: 'direction', was: before.direction, now: next.direction }; }
    if (kinds.includes('meaning')) {
      if (opts.comparable === undefined || opts.comparable === null || opts.comparable === '') return { error: `${goals.length === 1 ? '1 goal is' : `${goals.length} goals are`} measured by it. Is it still the same number?`, ask: 'comparable' };
      if (opts.comparable === false || opts.comparable === 'false') { if (!String(opts.reason || '').trim()) return { error: 'Say why, in a line. Every goal measured by it will show this.' }; mark = mark || { kind: 'definition', was: before.meaning, now: next.meaning }; }
    }
    if (String(opts.reason || '').length > R.REASON_MAX) return { error: `Keep why to ${R.REASON_MAX} characters or fewer.` };
    if (kinds.includes('relabel')) for (const g of goals) g.unit = next.unit;
  }
  const snap = snapshot(app);
  if (!before) next.id = uniqueId(W, next.name);
  next.updatedAt = now;
  if (mark) next.marks = [...(before.marks || []), { week: app.S1.currentWeek(now), at: now, by: actor, ...mark, why: String(opts.reason).trim() }];
  const L = R.lib(W);
  if (before) L.metrics[L.metrics.indexOf(before)] = next; else L.metrics.push(next);
  const diffs = FIELDS.filter(([f]) => (before ? before[f] : undefined) !== next[f] && !(before === null && (next[f] === '' || next[f] === null || next[f] === undefined))).map(([f, label]) => ({ field: label, from: before ? shown(W, f, before[f]) : '—', to: shown(W, f, next[f]) }));
  const lines = [];
  if (!before || R.measurementOf(before) !== R.measurementOf(next)) setHolds(app, actor, next, lines);
  if (mark) for (const g of goals) lines.push({ goalId: g.id, summary: `${R.markLabel(next.marks[next.marks.length - 1])}: ${String(opts.reason).trim()}` });
  const summary = `${before ? 'Changed' : 'Added'} the metric “${next.name}”`;
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, metric: next, summary, diffs, lines, still: R.stillToSay(W, next), entityId: next.id };
}
function uniqueId(W, name) {
  const base = `metric_${String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'new'}`;
  let id = base, i = 2;
  while (R.lib(W).metrics.some((m) => m.id === id)) id = `${base}-${i++}`;
  return id;
}

// ---------- remove, restore, retire, bring back, merge ----------
export function removeMetric(app, actor, id) {
  const W = app.W, m = R.findMetric(W, id);
  if (!m || m.removedAt) return { error: 'There’s no metric like that in the library.' };
  if (!R.mayChange(W, actor, m)) return { error: `Only ${W.people.find((p) => p.id === m.ownerId)?.name || 'its owner'} or an admin can remove this metric.` };
  if (R.everUsed(W, m)) return { error: `${m.name} has measured goals, so it can’t be deleted. Retire it instead.` };
  const snap = snapshot(app);
  Object.assign(m, { removedAt: nowOf(app), removedBy: actor });
  const summary = `Removed the metric “${m.name}”`;
  remember(app, actor, summary, snap);
  return { ok: true, summary, diffs: [{ field: 'Removed', from: '—', to: 'Yes' }], entityId: m.id };
}
export function restoreMetric(app, actor, id) {
  const W = app.W, m = R.findMetric(W, id);
  if (!m || !m.removedAt) return { error: 'That metric isn’t in Recently removed.' };
  if (!R.mayChange(W, actor, m)) return { error: R.changeRefusal(W, m) };
  if (R.inUseMetrics(W).some((x) => x.id !== m.id && x.name.toLowerCase() === m.name.toLowerCase())) return { error: `Another metric is called ${m.name} now, so this one can’t come back under that name.` };
  const snap = snapshot(app);
  Object.assign(m, { removedAt: null, removedBy: null });
  const summary = `Restored the metric “${m.name}”`;
  remember(app, actor, summary, snap);
  return { ok: true, summary, diffs: [{ field: 'Removed', from: 'Yes', to: '—' }], entityId: m.id };
}
export function retireMetric(app, actor, id, why, replacedBy) {
  const W = app.W, m = R.findMetric(W, id);
  if (!m || m.removedAt) return { error: 'There’s no metric like that in the library.' };
  if (!R.mayChange(W, actor, m)) return { error: R.changeRefusal(W, m) };
  if (R.isRetired(m)) return { error: `${m.name} is already retired.` };
  if (!String(why || '').trim()) return { error: 'Say why it is retired, in a line. Its goals will show this.' };
  if (String(why).length > R.REASON_MAX) return { error: `Keep why to ${R.REASON_MAX} characters or fewer.` };
  const rep = replacedBy ? R.findMetric(W, replacedBy) : null;
  if (replacedBy && (!rep || rep.removedAt || R.isRetired(rep) || rep.unit !== m.unit || rep.id === m.id)) return { error: 'Choose a metric in use in the same unit to take its place, or none.' };
  const snap = snapshot(app);
  Object.assign(m, { retiredAt: nowOf(app), retiredBy: actor, retiredWhy: String(why).trim(), replacedBy: rep ? rep.id : null });
  const lines = R.linkedGoals(W, m).map((g) => ({ goalId: g.id, summary: `Its metric “${m.name}” was retired: ${m.retiredWhy}` }));
  if (R.measurementOf(m) === 'gap') setHolds(app, actor, m, lines, { off: true });
  const summary = `Retired the metric “${m.name}”: ${m.retiredWhy}`;
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, lines, diffs: [{ field: 'Retired', from: '—', to: m.retiredWhy }], entityId: m.id };
}
export function unretireMetric(app, actor, id) {
  const W = app.W, m = R.findMetric(W, id);
  if (!m || !R.isRetired(m)) return { error: `${m ? m.name : 'That metric'} isn’t retired.` };
  if (!R.mayChange(W, actor, m)) return { error: R.changeRefusal(W, m) };
  const snap = snapshot(app);
  Object.assign(m, { retiredAt: null, retiredBy: null, retiredWhy: '', replacedBy: null });
  const lines = [];
  setHolds(app, actor, m, lines);
  const summary = `Brought back the metric “${m.name}”`;
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, lines, diffs: [{ field: 'Retired', from: 'Yes', to: '—' }], entityId: m.id };
}
export function mergeMetrics(app, actor, fromId, toId) {
  const W = app.W, a = R.findMetric(W, fromId), b = R.findMetric(W, toId);
  if (!W.people.find((p) => p.id === actor)?.admin) return { error: 'Only admins can merge metrics: it changes what other people’s goals are measured by.' };
  if (!a || !b || a.removedAt || b.removedAt || R.isRetired(a) || R.isRetired(b) || a.id === b.id) return { error: 'Choose two different metrics in use.' };
  if (a.unit !== b.unit) return { error: `${a.name} is in ${a.unit} and ${b.name} in ${b.unit}. Only metrics in the same unit can be merged.` };
  const snap = snapshot(app);
  const lines = [];
  const live = R.liveGoalIds(ctxOf(app));
  for (const l of R.lib(W).metricLinks.filter((x) => x.metricId === a.id && !x.removedAt && live.has(x.goalId))) {
    l.metricId = b.id; l.linkedAt = nowOf(app); l.linkedBy = actor;
    lines.push({ goalId: l.goalId, summary: `Measured by “${b.name}”: “${a.name}” was merged into it` });
    holdGoal(app, W.goals.find((g) => g.id === l.goalId), R.measurementOf(b) === 'gap', b, lines, live);
  }
  Object.assign(a, { retiredAt: nowOf(app), retiredBy: actor, retiredWhy: `Merged into ${b.name}`, replacedBy: b.id });
  const summary = `Merged the metric “${a.name}” into “${b.name}”`;
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, lines, diffs: [{ field: 'Merged into', from: '—', to: b.name }], entityId: a.id };
}

// ---------- link and unlink a goal ----------
export function linkGoal(app, actor, { goalId, metricId, teamId = null, part = '', reason = '', answers = {} }) {
  const W = app.W, ctx = ctxOf(app);
  const g = app.goal(goalId);
  if (!g) return { error: 'There’s no goal like that.' };
  const m = R.findMetric(W, metricId);
  teamId = teamId === 'company' || teamId === '' ? null : teamId;
  part = String(part || '').trim();
  const p = R.linkProblems(ctx, actor, g, m, teamId, { part, answers, reason });
  if (p.refused) return { error: p.refused };
  if (p.musts.length) return { error: p.musts.map((x) => x.message).join(' '), problems: p.musts };
  if (answers.part && answers.part.startsWith('use:')) part = answers.part.slice(4);
  if (p.checks.length) return { error: `Answer these questions first: ${p.checks.map((x) => x.question).join(' ')}`, checks: p.checks, warnings: p.warnings };
  const cur = R.linkOf(W, g.id);
  if (cur && cur.metricId === m.id && (cur.teamId || null) === teamId && (cur.part || '') === part) return { nothing: true, text: 'Nothing to save: it is measured so already.' };
  const snap = snapshot(app);
  const L = R.lib(W);
  const row = { id: g.id, goalId: g.id, metricId: m.id, teamId, ...(part ? { part } : cur && cur.part !== undefined ? { part: '' } : {}), linkedBy: actor, linkedAt: nowOf(app), removedAt: null, removedBy: null };
  const old = L.metricLinks.findIndex((l) => l.goalId === g.id);
  if (old >= 0) L.metricLinks[old] = row; else L.metricLinks.push(row);
  const lines = [];
  holdGoal(app, g, R.measurementOf(m) === 'gap', m, lines, R.liveGoalIds(ctx));
  const slice = R.sliceWords(W, teamId, part);
  const summary = reason ? `Measured by “${m.name}” for ${slice}: ${String(reason).trim()}` : `Measured by “${m.name}” ${R.forWords(W, teamId)}${part ? ` · ${part}` : ''}`;
  const prev = p.last ? R.findMetric(W, p.last.metricId) : null;
  const diffs = [];
  if (!p.last || p.last.metricId !== m.id || p.last.removedAt) diffs.push({ field: 'Measured by', from: prev && !p.last.removedAt ? prev.name : '—', to: m.name });
  if (!p.last || (p.last.teamId || null) !== teamId) diffs.push({ field: 'Slice', from: p.last ? R.sliceWords(W, p.last.teamId) : '—', to: R.sliceWords(W, teamId) });
  if ((p.last?.part || '') !== part) diffs.push({ field: 'Which part', from: p.last?.part || '—', to: part || '—' });
  lines.unshift({ goalId: g.id, summary, diffs });
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, diffs, lines, warnings: p.warnings, goalLog: g.id, entityId: g.id };
}
export function unlinkGoal(app, actor, goalId) {
  const W = app.W, g = app.goal(goalId);
  if (!g) return { error: 'There’s no goal like that.' };
  if (!R.mayLink(W, actor, g)) return { error: 'Only the goal’s owner or an admin can choose what measures it.' };
  const l = R.linkOf(W, g.id);
  if (!l) return { nothing: true, text: 'Nothing to save: no metric measures it.' };
  const snap = snapshot(app);
  const m = R.findMetric(W, l.metricId);
  Object.assign(l, { removedAt: nowOf(app), removedBy: actor });
  const lines = [];
  if (g.unmeasuredSince) { delete g.unmeasuredSince; lines.push({ goalId: g.id, summary: 'Held to its plan again' }); }
  const summary = `No longer measured by “${m.name}”`;
  lines.unshift({ goalId: g.id, summary, diffs: [{ field: 'Measured by', from: m.name, to: '—' }] });
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, lines, diffs: [{ field: 'Measured by', from: m.name, to: '—' }], goalLog: g.id, entityId: g.id };
}

// ---------- switching the library off and on (rule 11) ----------
export function onSwitch(app, actor, on) {
  const lines = [];
  for (const m of R.inUseMetrics(app.W)) if (R.measurementOf(m) === 'gap' && !R.isRetired(m)) {
    for (const l of R.lib(app.W).metricLinks.filter((x) => x.metricId === m.id && !x.removedAt)) {
      const g = app.W.goals.find((x) => x.id === l.goalId);
      if (!g || g.removedAt || g.stoppedAt || g.kind === 'milestone') continue;
      if (!on && g.unmeasuredSince) { delete g.unmeasuredSince; lines.push({ goalId: g.id, summary: 'Held to its plan again, as the metric library is switched off' }); }
      if (on && !g.unmeasuredSince) { g.unmeasuredSince = nowOf(app); lines.push({ goalId: g.id, summary: `Held to no number until “${m.name}” is measured` }); }
    }
  }
  logLines(app, actor, lines, 'app');
  app.rebind();
}

// ---------- the Metrics sheet ----------
export function loadSheet(app, actor, rows, { answers = {}, leaveOut = false, dryRun = false } = {}) {
  const ctx = ctxOf(app);
  let plan = planMetricsSheet(ctx, actor, rows, { answers, now: nowOf(app) });
  if (dryRun) return { plan };
  if (!plan.saves && !(leaveOut && plan.items.length && !plan.issues.some((x) => x.level === 'check'))) return { error: plan.issues.map((x) => `${x.level === 'must' ? 'Must fix' : 'Check'}: row ${x.line}: ${x.message}`).join(' ') || 'Nothing to save.', plan };
  const snap = snapshot(app);
  applyMetricsPlan(app.W, app.S1, plan, actor, nowOf(app));
  const lines = [];
  for (const it of plan.items) { const m = R.findMetric(app.W, it.after.id) || R.lib(app.W).metrics[R.lib(app.W).metrics.length - 1]; if (it.before && R.measurementOf(it.before) !== R.measurementOf(m)) setHolds(app, actor, m, lines); }
  const summary = `Loaded the Metrics sheet: ${plan.summary}`;
  remember(app, actor, summary, snap);
  app.rebind();
  return { ok: true, summary, plan, lines, diffs: plan.items.map((x) => ({ field: x.after.name, from: x.kind === 'add' ? '—' : 'Was', to: x.kind === 'add' ? 'Added' : 'Changed' })) };
}
export { logLines };
