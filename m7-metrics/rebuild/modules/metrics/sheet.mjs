// The Metrics sheet (MI, METRIC-SHEET; spec/core/export-format.md, "Metrics"): out as rows, back through a planner the
// module gives its sheet, with the library's own rules and words. planMetricsSheet is pure: it says what would change
// and every problem; applyMetricsPlan saves it all at once (one Undo: the app keeps the rows it replaced).
import { fold } from '../../screens.mjs';
import * as R from './rules.mjs';

export const SHEET_COLS = ['ID', 'Metric', 'Action', 'Meaning', 'Unit', 'Decimals', 'Direction', 'Source', 'Source owner', 'Refresh', 'Owner', 'Owner email', 'Caveats', 'Part of', 'How it relates', 'Confidence', 'How it could be gamed', 'Reason', 'Still to say', 'Retired on', 'Measures', 'Goal keys'];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const DIRS = { 'higher is better': 'higher', 'lower is better': 'lower', higher: 'higher', lower: 'lower' };

export function metricsSheetRows(ctx) {
  const W = ctx.W, live = R.liveGoalIds(ctx);
  return R.inUseMetrics(W).sort((a, b) => (fold(a.name) < fold(b.name) ? -1 : 1)).map((m) => {
    const links = R.liveLinks(ctx, live).filter((l) => l.metricId === m.id);
    const goals = links.map((l) => W.goals.find((g) => g.id === l.goalId));
    const owner = (W.people || []).find((p) => p.id === m.ownerId);
    const parent = m.parentId ? R.findMetric(W, m.parentId) : null;
    return {
      ID: m.id, Metric: m.name, Action: '', Meaning: m.meaning || '', Unit: m.unit, Decimals: String(m.decimals ?? 0), Direction: cap(R.DIR_WORDS[m.direction]),
      Source: m.source || '', 'Source owner': m.sourceOwner || '', Refresh: cap(m.refresh || ''), Owner: owner?.name || '', 'Owner email': owner?.email || '', Caveats: m.caveats || '',
      'Part of': parent ? parent.name : '', 'How it relates': cap(m.level || ''), Confidence: cap(m.confidence || ''), 'How it could be gamed': m.gaming || '', Reason: '',
      'Still to say': R.stillToSay(W, m), 'Retired on': m.retiredAt ? m.retiredAt.slice(0, 10) : '',
      Measures: links.map((l, i) => `${goals[i].title} (${R.sliceWords(W, l.teamId, l.part)})`).join('; '), 'Goal keys': goals.map((g) => g.key).join(' '),
    };
  });
}

const has = (row, col) => Object.prototype.hasOwnProperty.call(row, col);
const cell = (row, col) => String(row[col] ?? '').trim();

export function planMetricsSheet(ctx, actor, rows, { answers = {}, now } = {}) {
  const W = ctx.W;
  const issues = [], items = [];
  const must = (line, message) => issues.push({ level: 'must', line, message });
  const check = (line, message, key) => issues.push({ level: 'check', line, message, key });
  const planned = new Map(); // id → the metric as it would be, rows in order
  const names = new Map(); // folded name → first row line
  const live = R.liveGoalIds(ctx);
  rows.forEach((row, i) => {
    const line = i + 2;
    if (/^example$/i.test(cell(row, 'Action'))) return;
    const id = cell(row, 'ID');
    let before = null;
    if (id) {
      before = planned.get(id) || R.lib(W).metrics.find((m) => m.id === id && !m.removedAt);
      if (!before) return must(line, `ID “${id}” isn’t a metric in this workspace. Leave ID empty to add a new metric, or use an ID from an export.`);
    } else if (cell(row, 'Metric')) {
      before = R.inUseMetrics(W).find((m) => fold(m.name) === fold(cell(row, 'Metric'))) || null;
    }
    const n = before ? { ...before } : { id: `metric_new${i + 1}`, name: '', meaning: '', unit: '', decimals: 0, direction: '', source: '', sourceOwner: '', refresh: null, ownerId: actor, caveats: '', createdBy: actor, createdAt: now, updatedAt: now, isNew: true };
    const bad = [];
    const take = (col, f, conv = (v) => v) => { if (has(row, col) && cell(row, col) !== '') n[f] = conv(cell(row, col)); };
    take('Metric', 'name'); take('Meaning', 'meaning'); take('Unit', 'unit'); take('Source', 'source'); take('Source owner', 'sourceOwner'); take('Caveats', 'caveats'); take('How it could be gamed', 'gaming');
    if (has(row, 'Decimals') && cell(row, 'Decimals') !== '') { const d = Number(cell(row, 'Decimals')); if (!Number.isInteger(d) || d < 0 || d > 4) bad.push(`Decimals says “${cell(row, 'Decimals')}”. Use a whole number from 0 to 4.`); else n.decimals = d; }
    if (has(row, 'Direction') && cell(row, 'Direction') !== '') { const d = DIRS[cell(row, 'Direction').toLowerCase()]; if (!d) bad.push(`Direction says “${cell(row, 'Direction')}”. Use Higher is better or Lower is better.`); else n.direction = d; }
    if (has(row, 'Refresh') && cell(row, 'Refresh') !== '') { const r = cell(row, 'Refresh').toLowerCase(); if (!R.REFRESH.includes(r)) bad.push(`Refresh says “${cell(row, 'Refresh')}”. Use Live, Hourly, Daily, Weekly, Monthly or Quarterly, or leave it empty.`); else n.refresh = r; }
    const email = cell(row, 'Owner email'), oname = cell(row, 'Owner');
    if (email) { const p = (W.people || []).find((x) => fold(x.email) === fold(email)); if (!p) bad.push(`Owner email “${email}” isn’t anyone in this workspace.`); else n.ownerId = p.id; }
    else if (oname) { const p = (W.people || []).find((x) => fold(x.name) === fold(oname)); if (!p) bad.push(`Owner “${oname}” isn’t anyone in this workspace.`); else n.ownerId = p.id; }
    if (has(row, 'How it relates') && cell(row, 'How it relates') !== '') { const l = cell(row, 'How it relates').toLowerCase(); if (!R.LEVELS.includes(l)) bad.push(`How it relates says “${cell(row, 'How it relates')}”. Use Component, Driver, Control or Breakdown, or leave it empty.`); else n.level = l; }
    if (has(row, 'Confidence') && cell(row, 'Confidence') !== '') { const c = cell(row, 'Confidence').toLowerCase(); if (!R.CONFIDENCE.includes(c)) bad.push(`Confidence says “${cell(row, 'Confidence')}”. Use High, Medium or Low, or leave it empty.`); else n.confidence = c; }
    if (has(row, 'Part of') && cell(row, 'Part of') !== '') {
      const ref = cell(row, 'Part of');
      const p = [...planned.values()].find((x) => x.id === ref || fold(x.name) === fold(ref)) || R.inUseMetrics(W).find((x) => x.id === ref || fold(x.name) === fold(ref));
      if (!p) bad.push(`Part of says “${ref}”, which isn’t a metric in this workspace. Give the name or ID of a metric in the library or on an earlier row, or leave it empty.`);
      else n.parentId = p.id;
    }
    const action = cell(row, 'Action').toLowerCase(), reason = cell(row, 'Reason');
    if (action === 'retire') {
      if (!before) bad.push('Retire: there’s no metric on this row to retire.');
      else if (R.isRetired(before)) bad.push(`Retire: ${before.name} is already retired.`);
      else if (!reason) bad.push('Say why it is retired, in the Reason column. Its goals will show this.');
      else if (reason.length > R.REASON_MAX) bad.push(`Keep the Reason to ${R.REASON_MAX} characters or fewer.`);
      else Object.assign(n, { retiredAt: now, retiredBy: actor, retiredWhy: reason });
    } else if (action === 'bring back') {
      if (!before || !R.isRetired(before)) bad.push(`Bring back: ${before ? before.name : 'this metric'} isn’t retired.`);
      else Object.assign(n, { retiredAt: null, retiredBy: null, retiredWhy: '', replacedBy: null });
    } else if (action) bad.push(`Action says “${cell(row, 'Action')}”. Use Retire or Bring back, or leave it empty.`);
    if (bad.length) return bad.forEach((b) => must(line, b));
    // the library's own rules, in its words
    const k = fold(n.name);
    if (names.has(k) && n.name) { must(line, `Rows ${names.get(k)} and ${line} are both called “${n.name}”. A metric’s name is used once.`); return; }
    if (n.name) names.set(k, line);
    const others = { ...W, modules: { ...W.modules, metrics: { ...R.lib(W), metrics: [...R.lib(W).metrics.filter((m) => !planned.has(m.id)), ...planned.values()] } } };
    const probs = R.metricProblems(others, n, n.id).filter((p) => p.field !== 'parent');
    if (probs.length) return probs.forEach((p) => must(line, p.message));
    const ws2 = { ...others, modules: { ...others.modules, metrics: { ...R.lib(others), metrics: [...R.lib(others).metrics.filter((m) => m.id !== n.id), n] } } };
    const sp = R.structureProblems(ws2, n);
    if (sp.length) return sp.forEach((s) => must(line, s));
    if (before && !before.isNew && !R.mayChange(W, actor, before)) return must(line, R.changeRefusal(W, before));
    if (before && !before.isNew) {
      const goals = R.linkedGoals(W, before).filter((g) => live.has(g.id) || g.stoppedAt);
      const kinds = changeKindsSafe(before, n, goals);
      if (kinds.includes('scale')) return must(line, `It is in ${before.unit} and ${goals.length === 1 ? '1 goal is' : `${goals.length} goals are`} measured by it. A file can’t change its unit: change it on the metric’s page, where its goals are shown first.`);
      if (kinds.includes('direction') && !reason) return must(line, 'Say why which way is better changes, in the Reason column. Every goal measured by it will show this.');
      if (kinds.includes('meaning')) {
        const a = answers[`meaning:${before.id}`];
        if (!a) { check(line, `${before.name}: ${goals.length === 1 ? '1 goal is' : `${goals.length} goals are`} measured by it. Is it still the same number?`, `meaning:${before.id}`); return; }
        if (a === 'changed' && !reason) return must(line, 'Say why, in a line. Every goal measured by it will show this.');
        if (a === 'changed') n._mark = { kind: 'definition', why: reason, was: before.meaning, now: n.meaning };
      }
      if (kinds.includes('direction')) n._mark = { kind: 'direction', why: reason, was: before.direction, now: n.direction };
      if (kinds[0] === 'none' && !action) return;
    } else {
      for (const c of [...R.nameChecks(ctx, n.name), ...R.unitChecks(W, n.unit), ...R.meaningChecks(n)]) {
        const key = `${c.field}:${line}`;
        if (!answers[key]) check(line, c.question, key);
      }
      if (issues.some((x) => x.line === line && x.level === 'check')) return;
    }
    if (before && !before.isNew) n.updatedAt = now;
    planned.set(n.id, n);
    items.push({ kind: before && !before.isNew ? 'change' : 'add', line, id: n.id, before: before && !before.isNew ? before : null, after: n });
  });
  const adds = items.filter((x) => x.kind === 'add').length, changes = items.filter((x) => x.kind === 'change').length;
  const parts = [];
  if (adds) parts.push(`${adds} new ${adds === 1 ? 'metric' : 'metrics'}`);
  if (changes) parts.push(`${changes} ${changes === 1 ? 'metric' : 'metrics'} changed`);
  return { items, issues, summary: parts.length ? parts.join(', ') : 'No changes', saves: !issues.some((x) => x.level === 'must' || x.level === 'check') && items.length > 0, nothing: !items.length && !issues.length };
}
function changeKindsSafe(before, after, goals) { return R.changeKinds(before, after, goals); }

// Saves a plan (or only its rows with no problem, when the rest is left out). Returns what it replaced, for one Undo.
export function applyMetricsPlan(W, S1, plan, actor, now) {
  const L = R.lib(W);
  const was = [];
  const idMap = new Map();
  for (const it of plan.items) {
    const m = { ...it.after };
    delete m.isNew;
    const mark = m._mark; delete m._mark;
    if (it.kind === 'add') { const id = `metric_${String(m.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'new'}`; const unique = L.metrics.some((x) => x.id === id) ? `${id}-${L.metrics.length + 1}` : id; idMap.set(m.id, unique); m.id = unique; }
    if (m.parentId && idMap.has(m.parentId)) m.parentId = idMap.get(m.parentId);
    if (mark) m.marks = [...(m.marks || []), { week: S1.currentWeek(now), at: now, by: actor, ...mark }];
    const i = L.metrics.findIndex((x) => x.id === m.id);
    was.push(i >= 0 ? { ...L.metrics[i] } : { id: m.id, added: true });
    if (i >= 0) L.metrics[i] = m; else L.metrics.push(m);
  }
  return was;
}
