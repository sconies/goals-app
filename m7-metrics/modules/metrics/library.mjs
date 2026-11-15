// The library's saves: each one changes the module's rows (and, for a hold or a relabel, the goals' own fields) in one
// go, logs it, and returns an undo that puts every row back as it was just before. Shared by the screens and the AI
// tools, so the same rules hold at every door.
import * as L from './rules.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
let seq = 1;
const newId = (name) => `metric_${L.fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'm'}-${Date.now().toString(36)}${seq++}`;

export function rows(W) {
  W.modules = W.modules || {};
  W.modules.metrics = W.modules.metrics || {};
  W.modules.metrics.metrics = W.modules.metrics.metrics || [];
  W.modules.metrics.metricLinks = W.modules.metrics.metricLinks || [];
  return W.modules.metrics;
}
const isAdmin = (W, id) => !!(W.people || []).find((p) => p.id === id)?.admin;
const nameOf = (W, id) => (W.people || []).find((p) => p.id === id)?.name || 'no one';
const liveGoal = (g) => g && !g.removedAt && !g.stoppedAt;
/** Every row a save may touch, as it is now: one undo puts them all back. */
function snapshot(W) {
  const M = rows(W);
  return { metrics: clone(M.metrics), links: clone(M.metricLinks), goals: (W.goals || []).map((g) => [g.id, clone({ unmeasuredSince: g.unmeasuredSince ?? null, unit: g.unit })]), changes: (W.changes || []).length };
}
function undoTo(W, snap) {
  return () => {
    const M = rows(W);
    M.metrics.splice(0, M.metrics.length, ...clone(snap.metrics));
    M.metricLinks.splice(0, M.metricLinks.length, ...clone(snap.links));
    const by = new Map(snap.goals);
    for (const g of W.goals || []) if (by.has(g.id)) { const b = by.get(g.id); if (b.unmeasuredSince) g.unmeasuredSince = b.unmeasuredSince; else delete g.unmeasuredSince; g.unit = b.unit; }
    (W.changes = W.changes || []).unshift({ id: `chg_u${seq++}`, at: new Date().toISOString(), by: null, what: 'Undone' });
  };
}
function log(W, ctx, what, extra = {}) { (W.changes = W.changes || []).unshift({ id: `chg_m${seq++}`, at: ctx.now, by: ctx.actor, via: ctx.via || null, what, ...extra }); }
export function linkedGoals(W, metricId) {
  const M = rows(W);
  return M.metricLinks.filter((l) => l.metricId === metricId && !l.removedAt).map((l) => (W.goals || []).find((g) => g.id === l.goalId)).filter((g) => g && !g.removedAt);
}

// ---------- holds (rule 11): the library fills in the goal's own field; the core's rule reads it ----------
export function rework(W, ctx, goalIds, on = true) {
  const M = rows(W);
  for (const id of goalIds) {
    const g = (W.goals || []).find((x) => x.id === id);
    if (!g || g.kind === 'milestone') continue;
    const l = M.metricLinks.find((x) => x.goalId === id && !x.removedAt);
    const m = l && M.metrics.find((x) => x.id === l.metricId);
    const hold = on && liveGoal(g) && !!m && !m.removedAt && !m.retiredAt && L.measurementOf(m) === 'gap';
    if (hold && !g.unmeasuredSince) { g.unmeasuredSince = ctx.now; log(W, ctx, `Held to no number until “${m.name}” is measured`, { goalId: id }); }
    else if (!hold && g.unmeasuredSince) {
      delete g.unmeasuredSince;
      log(W, ctx, !on ? 'Held to its plan again, as the metric library is switched off' : m && !m.retiredAt ? `Held to its plan again, as “${m.name}” is measured` : 'Held to its plan again', { goalId: id });
    }
  }
}

// ---------- add or change a metric ----------
const FIELDS = ['name', 'meaning', 'unit', 'decimals', 'direction', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats', 'measurement', 'measurementNote', 'parentId', 'level', 'confidence', 'gaming'];
const LABEL = { name: 'Name', meaning: 'What it means', unit: 'Unit', decimals: 'Decimal places', direction: 'Which way is better', source: 'Where the number comes from', sourceOwner: 'Who owns that source', refresh: 'How often it refreshes', ownerId: 'Owner', caveats: 'Caveats', measurement: 'Measured', measurementNote: 'What’s missing', parentId: 'Where it sits', level: 'How it relates', confidence: 'Confidence', gaming: 'How it could be gamed' };
const trimmed = (d) => { const o = {}; for (const f of FIELDS) if (d[f] !== undefined) o[f] = typeof d[f] === 'string' ? d[f].trim() : d[f]; return o; };
export function formerNames(W) {
  const out = {};
  for (const c of W.changes || []) for (const df of c.diffs || []) if (c.metricId && df[0] === 'Name' && df[1] && df[1] !== '—') out[df[1]] = c.metricId;
  return out;
}
/** The questions (Checks) a draft raises, answered or not. */
export function checksFor(W, draft, before = null) {
  const M = rows(W);
  const out = [];
  if (!before || draft.name !== before.name) for (const c of L.nameChecks(draft.name || '', { metrics: M.metrics, links: M.metricLinks, people: W.people || [], selfId: before?.id, formerNames: formerNames(W) }).slice(0, 1)) out.push({ field: 'name', ...c });
  if (!before || draft.unit !== before.unit) {
    const units = [...new Set(M.metrics.filter((m) => L.inUse(m) && m.id !== before?.id).map((m) => m.unit))];
    for (const c of L.unitChecks(draft.unit, units)) out.push({ field: 'unit', ...c });
  }
  if (!before || draft.meaning !== before.meaning || draft.unit !== before.unit) for (const c of L.meaningChecks(draft)) out.push({ field: 'meaning', ...c });
  return out;
}
const answered = (c, answers = {}) => {
  const a = answers[c.field];
  if (!a) return false;
  if (c.field === 'name') return /^keep/.test(a) || /^use/.test(a);
  if (c.field === 'unit') return a === 'keep' || a === 'use';
  if (c.field === 'meaning') return a === 'as-written';
  return false;
};
export function saveMetric(W, ctx, input, opt = {}) {
  const M = rows(W);
  const before = input.id ? M.metrics.find((m) => m.id === input.id && !m.removedAt) : null;
  if (input.id && !before) return { ok: false, refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (before && !(before.ownerId === ctx.actor || isAdmin(W, ctx.actor))) return { ok: false, refused: `Only ${nameOf(W, before.ownerId)} or an admin can change this metric.` };
  if (before && before.retiredAt) return { ok: false, refused: `“${before.name}” is retired. Bring it back before changing it.` };
  const draft = { ...(before ? clone(before) : { decimals: 0, ownerId: ctx.actor, refresh: null, meaning: '', source: '', sourceOwner: '', caveats: '' }), ...trimmed(input) };
  if (draft.decimals === '' || draft.decimals === undefined || draft.decimals === null) draft.decimals = 0;
  draft.decimals = Number(draft.decimals);
  if (draft.refresh === '') draft.refresh = null;
  for (const f of ['parentId', 'level', 'confidence', 'gaming']) if (draft[f] === '' || draft[f] === null) delete draft[f];
  const probs = L.metricProblems(draft, { metrics: M.metrics, people: W.people || [], selfId: before?.id });
  if (probs.length) return { ok: false, refused: probs.map((p) => p.text).join(' '), problems: probs };
  const answers = opt.answers || {};
  const checks = opt.skipChecks ? [] : checksFor(W, draft, before);
  const open = checks.filter((c) => !answered(c, answers));
  if (open.length) return { ok: false, checks: open, refused: `Answer these questions first: ${open.map((c) => c.text).join(' ')}` };
  if (answers.name && /^use/.test(answers.name)) return { ok: false, refused: 'Nothing saved: use that metric instead.', use: answers.name.slice(4) };
  if (answers.unit === 'use') { const u = checks.find((c) => c.field === 'unit'); if (u) draft.unit = u.use; }
  let kinds = ['words'];
  const goals = before ? linkedGoals(W, before.id) : [];
  if (before) {
    kinds = L.changeKinds(before, draft, goals, { relabel: !!opt.relabel });
    if (kinds.includes('none')) return { ok: true, nothing: true, message: 'nothing to save' };
    if (kinds.includes('scale')) return { ok: false, refused: `${goals.length} ${goals.length === 1 ? 'goal is' : 'goals are'} measured by ${before.name} in ${before.unit}. A metric in ${draft.unit} is a different number: add it as a new metric and move goals to it, or retire this one. If “${draft.unit}” is only a new label for the same numbers, say so (relabel).` };
    if ((kinds.includes('relabel') || kinds.includes('direction')) && !opt.confirm && !opt.relabel && !(kinds.includes('direction') && opt.reason)) return { ok: false, asks: true, refused: `${goals.length} ${goals.length === 1 ? 'goal uses' : 'goals use'} it. Confirm the change first.` };
    if (kinds.includes('direction') && !String(opt.reason || '').trim()) return { ok: false, refused: 'Say why the direction changes, in a line. Every goal measured by it will show this.' };
    if (kinds.includes('meaning') && opt.comparable === undefined) return { ok: false, asks: true, refused: 'Say whether it is still the same number.' };
    if (kinds.includes('meaning') && opt.comparable === false && !String(opt.reason || '').trim()) return { ok: false, refused: 'Say why, in a line. Every goal measured by it will show this.' };
    if (String(opt.reason || '').length > 300) return { ok: false, refused: 'Keep the reason to 300 characters or fewer.' };
  }
  const snap = snapshot(W);
  const now = ctx.now;
  if (!before) {
    const m = { id: newId(draft.name), ...draft, createdBy: ctx.actor, createdAt: now, updatedAt: now };
    if (!m.measurement || m.measurement === 'measured') { delete m.measurement; delete m.measurementNote; }
    M.metrics.push(m);
    log(W, ctx, `Added the metric “${m.name}”`, { metricId: m.id, diffs: FIELDS.filter((f) => m[f] !== undefined && m[f] !== '' && m[f] !== null).map((f) => [LABEL[f], '—', String(m[f])]) });
    return { ok: true, metric: m, message: `Added the metric “${m.name}”`, still: L.stillToSay(m, W.people || []), undo: undoTo(W, snap) };
  }
  const m = before;
  const diffs = FIELDS.filter((f) => String(draft[f] ?? '') !== String(m[f] ?? '')).map((f) => [LABEL[f], String(m[f] ?? '—') || '—', String(draft[f] ?? '—') || '—']);
  const marks = [];
  if (kinds.includes('direction')) marks.push({ kind: 'direction', why: opt.reason, was: m.direction, now: draft.direction });
  if (kinds.includes('meaning') && opt.comparable === false) marks.push({ kind: 'definition', why: opt.reason, was: m.meaning, now: draft.meaning });
  const wasMeas = L.measurementOf(m);
  Object.assign(m, draft, { updatedAt: now });
  if (L.measurementOf(m) === 'measured') { delete m.measurement; m.measurementNote = ''; }
  for (const f of ['parentId', 'level', 'confidence', 'gaming']) if (input[f] === '' || input[f] === null) delete m[f];
  if (marks.length) m.marks = [...(m.marks || []), ...marks.map((mk) => ({ week: ctx.week, at: now, by: ctx.actor, ...mk }))];
  if (kinds.includes('relabel')) for (const g of goals) g.unit = m.unit;
  log(W, ctx, `Changed the metric “${m.name}”`, { metricId: m.id, diffs });
  for (const mk of marks) for (const g of goals) log(W, ctx, `${L.markLabel({ ...mk, week: ctx.week })}: ${mk.why}`, { goalId: g.id, metricId: m.id });
  if (wasMeas !== L.measurementOf(m) || L.measurementOf(m) === 'gap') rework(W, ctx, M.metricLinks.filter((l) => l.metricId === m.id && !l.removedAt).map((l) => l.goalId));
  return { ok: true, metric: m, kinds, message: `Changed the metric “${m.name}”`, still: L.stillToSay(m, W.people || []), moreDecimals: kinds.includes('decimals') ? goals.filter((g) => (g.decimals || 0) > m.decimals).map((g) => g.key) : [], undo: undoTo(W, snap) };
}

// ---------- remove, restore, retire, bring back, merge ----------
const mayChange = (W, actor, m) => m.ownerId === actor || isAdmin(W, actor);
export function removeMetric(W, ctx, id) {
  const M = rows(W);
  const m = M.metrics.find((x) => x.id === id && !x.removedAt);
  if (!m) return { ok: false, refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (!mayChange(W, ctx.actor, m)) return { ok: false, refused: `Only ${nameOf(W, m.ownerId)} or an admin can remove this metric.` };
  if (L.everUsed(m.id, M.metricLinks)) return { ok: false, refused: `${m.name} has measured goals, so it can’t be deleted. Retire it instead.` };
  const snap = snapshot(W);
  m.removedAt = ctx.now; m.removedBy = ctx.actor;
  log(W, ctx, `Removed the metric “${m.name}”`, { metricId: m.id });
  return { ok: true, message: `Removed the metric “${m.name}”`, undo: undoTo(W, snap) };
}
export function restoreMetric(W, ctx, id) {
  const M = rows(W);
  const m = M.metrics.find((x) => x.id === id && x.removedAt);
  if (!m) return { ok: false, refused: 'There’s nothing removed with that ID.' };
  if (M.metrics.some((x) => !x.removedAt && L.fold(x.name) === L.fold(m.name))) return { ok: false, refused: `Another metric is called ${m.name} now. Rename it first.` };
  const snap = snapshot(W);
  m.removedAt = null; m.removedBy = null;
  log(W, ctx, `Restored the metric “${m.name}”`, { metricId: m.id });
  return { ok: true, message: `Restored the metric “${m.name}”`, undo: undoTo(W, snap) };
}
export function retireMetric(W, ctx, id, why, replacedBy = null) {
  const M = rows(W);
  const m = M.metrics.find((x) => x.id === id && !x.removedAt);
  if (!m) return { ok: false, refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (!mayChange(W, ctx.actor, m)) return { ok: false, refused: `Only ${nameOf(W, m.ownerId)} or an admin can retire or bring back this metric.` };
  if (m.retiredAt) return { ok: false, refused: `“${m.name}” is already retired.` };
  if (!String(why || '').trim()) return { ok: false, refused: 'Say why it is retired, in a line. Its goals will show this.' };
  if (why.length > 300) return { ok: false, refused: 'Keep the reason to 300 characters or fewer.' };
  if (replacedBy) {
    const r = M.metrics.find((x) => x.id === replacedBy);
    if (!r || r.removedAt || r.retiredAt) return { ok: false, refused: 'The metric it is replaced by must be one in use.' };
    if (r.unit !== m.unit) return { ok: false, refused: `${m.name} is in ${m.unit} and ${r.name} is in ${r.unit}. It can only be replaced by a metric in the same unit.` };
  }
  const snap = snapshot(W);
  Object.assign(m, { retiredAt: ctx.now, retiredBy: ctx.actor, retiredWhy: why.trim(), replacedBy: replacedBy || null });
  log(W, ctx, `Retired the metric “${m.name}”: ${why.trim()}`, { metricId: m.id });
  const gs = linkedGoals(W, m.id);
  for (const g of gs) log(W, ctx, `Its metric “${m.name}” was retired: ${why.trim()}`, { goalId: g.id });
  rework(W, ctx, gs.map((g) => g.id));
  return { ok: true, message: `Retired the metric “${m.name}”: ${why.trim()} / Its metric “${m.name}” was retired: ${why.trim()}`, undo: undoTo(W, snap) };
}
export function unretireMetric(W, ctx, id) {
  const M = rows(W);
  const m = M.metrics.find((x) => x.id === id && !x.removedAt);
  if (!m) return { ok: false, refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (!mayChange(W, ctx.actor, m)) return { ok: false, refused: `Only ${nameOf(W, m.ownerId)} or an admin can retire or bring back this metric.` };
  if (!m.retiredAt) return { ok: false, refused: `“${m.name}” isn’t retired.` };
  const snap = snapshot(W);
  Object.assign(m, { retiredAt: null, retiredBy: null, retiredWhy: '', replacedBy: null });
  log(W, ctx, `Brought back the metric “${m.name}”`, { metricId: m.id });
  rework(W, ctx, linkedGoals(W, m.id).map((g) => g.id));
  return { ok: true, message: `Brought back the metric “${m.name}”`, undo: undoTo(W, snap) };
}
export function mergeMetrics(W, ctx, fromId, intoId, why) {
  const M = rows(W);
  if (!isAdmin(W, ctx.actor)) return { ok: false, refused: 'Only admins can merge metrics: it changes what other people’s goals are measured by.' };
  const a = M.metrics.find((x) => x.id === fromId && !x.removedAt), b = M.metrics.find((x) => x.id === intoId && !x.removedAt);
  if (!a || !b) return { ok: false, refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (a.id === b.id) return { ok: false, refused: 'Choose another metric to merge it into.' };
  if (a.retiredAt) return { ok: false, refused: `“${a.name}” is already retired.` };
  if (b.retiredAt) return { ok: false, refused: `“${b.name}” is retired. Bring it back first, or merge into another.` };
  if (a.unit !== b.unit) return { ok: false, refused: `${a.name} is in ${a.unit} and ${b.name} is in ${b.unit}. Only metrics in the same unit can be merged.` };
  const w = String(why || '').trim() || `The same number as ${b.name}.`;
  if (w.length > 300) return { ok: false, refused: 'Keep the reason to 300 characters or fewer.' };
  const snap = snapshot(W);
  const moved = [];
  for (const l of M.metricLinks.filter((x) => x.metricId === a.id && !x.removedAt)) {
    l.metricId = b.id; moved.push(l.goalId);
    log(W, ctx, `Measured by “${b.name}”: ${a.name} was merged into it`, { goalId: l.goalId, diffs: [['Measured by', a.name, b.name]] });
  }
  Object.assign(a, { retiredAt: ctx.now, retiredBy: ctx.actor, retiredWhy: w, replacedBy: b.id });
  log(W, ctx, `Merged the metric “${a.name}” into “${b.name}”`, { metricId: a.id });
  rework(W, ctx, moved);
  return { ok: true, moved, message: `Merged “${a.name}” into “${b.name}”: ${moved.length} ${moved.length === 1 ? 'goal moves' : 'goals move'}.`, undo: undoTo(W, snap) };
}

// ---------- link and unlink a goal ----------
export function linkGoal(W, ctx, { goalId, metricId, teamId = null, part = '', reason = '', answers = {} }) {
  const M = rows(W);
  const goal = (W.goals || []).find((g) => g.id === goalId && !g.removedAt);
  if (!goal) return { ok: false, refused: 'There’s no goal with that ID.' };
  const metric = M.metrics.find((m) => m.id === metricId);
  const lp = L.linkProblems({ goal, metric, teamId, part, actor: ctx.actor, people: W.people || [], teams: W.teams || [] });
  if (lp.refused) return { ok: false, refused: lp.refused };
  part = String(part || '').trim();
  const cur = M.metricLinks.find((l) => l.goalId === goalId && !l.removedAt);
  if (cur && cur.metricId === metricId && (cur.teamId ?? null) === (teamId ?? null) && (cur.part || '') === part) return { ok: true, nothing: true, message: 'nothing to save', warnings: lp.warnings };
  const last = M.metricLinks.filter((l) => l.goalId === goalId).slice(-1)[0];
  const hasCk = (W.checkIns || []).some((c) => c.goalId === goalId && !c.removedAt);
  const differs = last && (last.metricId !== metricId || (last.teamId ?? null) !== (teamId ?? null) || (last.part || '') !== part);
  if (hasCk && differs && !String(reason || '').trim()) return { ok: false, field: 'why', refused: 'Say why this goal is measured differently now.' };
  if (String(reason || '').length > 300) return { ok: false, refused: 'Keep the reason to 300 characters or fewer.' };
  const checks = [];
  const live = new Set((W.goals || []).filter(liveGoal).map((g) => g.id));
  const twin = M.metricLinks.find((l) => !l.removedAt && l.goalId !== goalId && live.has(l.goalId) && l.metricId === metricId && (l.teamId ?? null) === (teamId ?? null) && L.partKey(l.part || '') === L.partKey(part));
  if (twin && answers.others !== 'carry-on') {
    const tg = W.goals.find((g) => g.id === twin.goalId);
    checks.push({ field: 'others', text: `Another goal already measures this for ${L.sliceWords({ teamId, part }, W.teams || []).replace(' · ', ', ')}: “${tg.title}” (${tg.key}, ${nameOf(W, tg.ownerId)}). Two goals on one number is unusual.`, answers: ['Carry on'] });
  }
  if (!twin && part) {
    const close = L.closePart(part, L.partsOf(metricId, M.metricLinks, live));
    if (close && !answers.part) checks.push({ field: 'part', use: close, text: `${metric.name} already has a part called “${close}”.`, answers: [`Use “${close}”`, `Keep “${part}”`] });
    if (close && answers.part === `use:${close}`) part = close;
  }
  if (checks.length) return { ok: false, checks, refused: `Answer these questions first: ${checks.map((c) => c.text).join(' ')}` };
  const snap = snapshot(W);
  const sliceW = L.sliceWords({ teamId, part }, W.teams || []);
  const diffs = [];
  if (!cur || cur.metricId !== metricId) diffs.push(['Measured by', cur ? M.metrics.find((m) => m.id === cur.metricId)?.name : '—', metric.name]);
  if (!cur || (cur.teamId ?? null) !== (teamId ?? null)) diffs.push(['Slice', cur ? L.sliceWords({ teamId: cur.teamId }, W.teams || []) : '—', L.sliceWords({ teamId }, W.teams || [])]);
  if ((cur?.part || '') !== part) diffs.push(['Which part', cur?.part || '—', part || '—']);
  const idx = M.metricLinks.findIndex((l) => l.goalId === goalId);
  const link = { id: goalId, goalId, metricId, teamId: teamId ?? null, ...(part ? { part } : {}), linkedBy: ctx.actor, linkedAt: ctx.now, removedAt: null, removedBy: null };
  if (idx >= 0) M.metricLinks[idx] = link; else M.metricLinks.push(link);
  const what = `Measured by “${metric.name}” for ${sliceW.replace('The whole company', 'the whole company')}${reason ? `: ${String(reason).trim()}` : ''}`;
  log(W, ctx, what, { goalId, metricId, diffs });
  rework(W, ctx, [goalId]);
  return { ok: true, message: what, warnings: lp.warnings, undo: undoTo(W, snap) };
}
export function unlinkGoal(W, ctx, goalId) {
  const M = rows(W);
  const goal = (W.goals || []).find((g) => g.id === goalId);
  const cur = M.metricLinks.find((l) => l.goalId === goalId && !l.removedAt);
  if (!goal || !cur) return { ok: true, nothing: true, message: 'nothing to save' };
  if (!(goal.ownerId === ctx.actor || isAdmin(W, ctx.actor))) return { ok: false, refused: 'Only the goal’s owner or an admin can choose what measures it.' };
  const snap = snapshot(W);
  cur.removedAt = ctx.now; cur.removedBy = ctx.actor;
  const m = M.metrics.find((x) => x.id === cur.metricId);
  log(W, ctx, `No longer measured by “${m?.name}”`, { goalId, diffs: [['Measured by', m?.name, '—']] });
  rework(W, ctx, [goalId]);
  return { ok: true, message: `No longer measured by “${m?.name}”`, undo: undoTo(W, snap) };
}
/** Starting the next year (U152): each carried goal's link goes to its copy, the same metric, team and part. */
export function carryLinks(W, ctx, pairs) {
  const M = rows(W);
  for (const [fromId, toId] of pairs) {
    const l = M.metricLinks.find((x) => x.goalId === fromId && !x.removedAt);
    if (l) M.metricLinks.push({ ...clone(l), id: toId, goalId: toId, linkedBy: ctx.actor, linkedAt: ctx.now });
  }
}
