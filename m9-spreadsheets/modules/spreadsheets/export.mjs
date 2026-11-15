// Export: every sheet of the one format, made from format.json (the kit's export-format.md), and the
// Start here sheet and the template made from the same field table.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeXlsx, writeCsv, zip } from './xlsx.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FORMAT = JSON.parse(fs.readFileSync(path.join(here, 'format.json'), 'utf8'));
export const SHEET = Object.fromEntries(FORMAT.map((s) => [s.name, s]));
export const LOADS_BACK = ['Goals', 'Plan', 'Check-ins', 'People'];
export const READING_ONLY = ['Results', 'Asks', 'Notes', 'Metrics'];
const WORKED = (s, c) => /^Worked out/.test(c.need);
// columns a person fills in (the template): not worked out, not "For reading"
export const fillIn = (sheet) => SHEET[sheet].cols.filter((c) => !WORKED(sheet, c) && c.need !== 'For reading' && c.col !== 'Week N');
// the template's Plan: its columns, then a column per week (Week 1 … Week 53)
const planWeeks = (n) => Array.from({ length: n }, (_, i) => `Week ${i + 1}`);

export const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };
const LEVEL = { 'north-star': 'north star', svp: 'svp', team: 'team' };
const SHAPE = { straight: 'straight', back: 'back-loaded', stepped: 'stepped' };
const BOUND = { atMost: 'at most', atLeast: 'at least', between: 'between' };
const CALL = { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' };
const CAUSE = { aggressive: 'Plan too aggressive', slower: 'Delivery slower', blocked: 'Blocked by a dependency', external: 'External factor', data: 'Data problem', other: 'Something else', cautious: 'Plan too cautious', early: 'Change landed early', oneoff: 'One-off, won’t last' };
const RECOVERY = { plan: 'Plan', investigating: 'Still investigating', help: 'Needs a decision or help', target: 'Target should change' };
const ASK_KIND = { decision: 'Decision or help', help: 'Decision or help', update: 'Update', question: 'Question', action: 'Action' };
const ASK_STATUS = { open: 'Open', answered: 'Answered', done: 'Done', withdrawn: 'Withdrawn' };

// ISO year-week of a cycle week (week 0 is the start's Monday)
export function isoWeek(S1, w) {
  const dayN = S1.START + 7 * w;
  const dow = (((dayN + 3) % 7) + 7) % 7; const th = dayN - dow + 3;
  const y = new Date(th * 86400000).getUTCFullYear(); const jan1 = Math.floor(Date.UTC(y, 0, 1) / 86400000);
  return `${y}-W${String(1 + Math.floor((th - jan1) / 7)).padStart(2, '0')}`;
}
const dateOf = (S1, w) => new Date((S1.START + 7 * w) * 86400000).toISOString().slice(0, 10);
const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));

// ---------- the sheets' rows ----------
export function sheetRows(ctx, opt = {}) {
  const { W, S1, R } = ctx;
  const week = ctx.week;
  const people = W.people.filter((p) => !p.removedAt);
  const person = new Map(W.people.map((p) => [p.id, p]));
  const team = new Map(W.teams.map((t) => [t.id, t]));
  const allGoals = W.goals.filter((g) => !g.removedAt);
  const goalById = new Map(allGoals.map((g) => [g.id, g]));
  const goals = opt.goals ? allGoals.filter((g) => opt.goals.has(g.id)) : allGoals;
  const st = R.standing(ctx.moment).st;
  const modulesOff = new Set(W.modulesOff || []);
  const cks = W.checkIns.filter((c) => !c.removedAt && goalById.has(c.goalId) && (!opt.goals || opt.goals.has(c.goalId)));
  const ckBy = new Map();
  for (const c of cks) { if (!ckBy.has(c.goalId)) ckBy.set(c.goalId, []); ckBy.get(c.goalId).push(c); }
  const out = {};
  const row = (sheet, vals) => SHEET[sheet].cols.filter((c) => c.col !== 'Week N').map((c) => vals[c.col] ?? '');
  const hdr = (sheet) => SHEET[sheet].cols.filter((c) => c.col !== 'Week N').map((c) => c.col);

  // Goals
  out.Goals = [hdr('Goals')];
  for (const g of goals) {
    const s = st.get(g.id) || { status: 'none', flags: [], latest: null };
    const owner = person.get(g.ownerId);
    const parent = g.parentId ? goalById.get(g.parentId) : null;
    const latest = s.latest;
    const v = {
      Key: g.key, ID: g.id, Goal: g.title, Level: LEVEL[g.level] || g.level, Team: team.get(g.teamId)?.name ?? '', Owner: owner?.name ?? '', 'Owner email': owner?.email ?? '',
      Type: g.kind, State: g.proposedAt ? 'proposed' : 'active', 'Feeds into': parent?.title ?? '', 'Feeds into key': parent?.key ?? '', 'Why it helps': g.whyHelps ?? '', Effect: num(g.effect), Source: g.source ?? '', Definition: g.definition ?? '',
    };
    if (g.kind !== 'milestone') { v.Unit = g.unit ?? ''; v.Decimals = num(g.decimals ?? 0); }
    if (g.kind === 'metric' && g.plan) {
      const p = g.plan;
      Object.assign(v, { Start: num(p.start), Target: num(p.target), Plan: SHAPE[p.shape] || p.shape });
      if (p.fromWeek !== undefined && p.fromWeek !== null) { v.From = isoWeek(S1, p.fromWeek); v['Plan from week'] = p.fromWeek; }
      if (p.endWeek !== undefined && p.endWeek !== null) { v.To = isoWeek(S1, p.endWeek); v['Due week'] = p.endWeek; }
      if (g.baseline) { v['Baseline period'] = g.baseline.period; v['Baseline is'] = g.baseline.provisional ? 'provisional' : 'firm'; }
    }
    if (g.kind === 'range' && g.range) {
      const r = g.range;
      v.Limit = r.bound === 'between' ? `${r.lower}–${r.limit}` : num(r.limit);
      v['Must stay'] = BOUND[r.bound]; v.Margin = num(r.margin ?? 0);
    }
    if (g.kind === 'milestone') v.Stages = [...(g.stages || [])].sort((a, b) => a.dueWeek - b.dueWeek).map((x) => `${x.name}@${x.dueWeek}`).join('; ');
    // worked out
    v.Status = g.proposedAt ? 'Proposed' : g.stoppedAt ? 'Stopped' : STATUS_WORD[s.status] || s.status;
    if (latest) {
      v['Last check-in week'] = latest.week;
      if (g.kind === 'milestone') { const done = (latest.stages || []).filter((x) => x.doneWeek !== null && x.doneWeek !== undefined).length; v.Now = `${done} of ${(g.stages || []).length} stages`; }
      else if (latest.value !== null && latest.value !== undefined) v.Now = latest.value;
      v['Why it’s off'] = latest.why || '';
      v['Recovery plan'] = latest.pathToGreen?.what || '';
      v['By when'] = latest.pathToGreen?.byWeek ? `Week ${latest.pathToGreen.byWeek}` : '';
      v['Next step'] = latest.next || '';
      v.Needs = latest.pathToGreen?.needs || '';
    }
    if (g.kind === 'metric' && g.plan) { try { v['Plan this week'] = Number(S1.planAt(S1.planAsOf(g, week), week).toFixed(g.decimals ?? 0)); } catch { /* no plan */ } }
    v.Warnings = (s.flags || []).join(', ');
    out.Goals.push(row('Goals', v));
  }
  // Plan: one row per number goal, a column per week
  const planWeeks = Array.from({ length: S1.WEEKS }, (_, i) => i + 1);
  out.Plan = [[...hdr('Plan'), ...planWeeks.map((w) => `Week ${w}`)]];
  for (const g of goals) {
    if (g.kind !== 'metric' || !g.plan) continue;
    const p = g.plan; const from = p.fromWeek ?? 0, to = p.endWeek ?? S1.WEEKS;
    const weeks = planWeeks.map((w) => { if (w <= from || w > to) return ''; try { return Number(S1.planAt(S1.planAsOf(g, w), w).toFixed(g.decimals ?? 0)); } catch { return ''; } });
    out.Plan.push([...row('Plan', { Key: g.key, ID: g.id, Goal: g.title, Unit: g.unit ?? '', Start: num(p.start) }), ...weeks]);
  }
  // Check-ins
  out['Check-ins'] = [hdr('Check-ins')];
  const sorted = [...cks].sort((a, b) => (goalById.get(a.goalId).key || '').localeCompare(goalById.get(b.goalId).key || '', 'en', { numeric: true }) || a.week - b.week || (a.postedAt < b.postedAt ? -1 : 1));
  for (const c of sorted) {
    const g = goalById.get(c.goalId);
    const au = person.get(c.authorId);
    const v = { ID: c.id, 'Goal key': g.key, 'Goal ID': g.id, Goal: g.title, Week: c.week, 'Week starting': dateOf(S1, c.week), Value: g.kind === 'milestone' ? '' : num(c.value),
      Call: CALL[c.status] || '', Cause: CAUSE[c.cause] || '', Why: c.why || '', 'Why greener': c.greenerWhy || '',
      'Path to green': c.pathToGreen?.what || '', Recovery: c.pathToGreen?.what ? RECOVERY[c.pathToGreen.state || 'plan'] : '', 'Back on plan by week': num(c.pathToGreen?.byWeek), Needs: c.pathToGreen?.needs || '', 'Next step': c.next || '',
      Calculated: STATUS_WORD[c.calculated] || '', 'Posted at': c.postedAt || '', 'Posted by': au?.name || '', 'Posted by email': au?.email || '', Backfilled: c.backfilled ? 'yes' : '' };
    if (g.kind === 'milestone' && Array.isArray(c.stages)) {
      const name = new Map((g.stages || []).map((s) => [s.id, s.name]));
      v.Stages = c.stages.map((s) => `${name.get(s.stageId) ?? s.stageId}: ${s.doneWeek !== null && s.doneWeek !== undefined ? `done week ${s.doneWeek}` : s.forecastWeek ? `expected week ${s.forecastWeek}` : `due week ${(g.stages || []).find((x) => x.id === s.stageId)?.dueWeek ?? ''}`}`).join('; ');
    }
    if (g.kind === 'metric' && g.plan) { try { v['Plan that week'] = Number(S1.planAt(S1.planAsOf(g, c.week), c.week).toFixed(g.decimals ?? 0)); } catch { /* none */ } }
    out['Check-ins'].push(row('Check-ins', v));
  }
  // People
  out.People = [hdr('People')];
  for (const p of people) {
    const t = team.get(p.teamId);
    out.People.push(row('People', { Email: p.email ?? '', ID: p.id, Name: p.name, 'Job title': p.role ?? '', Team: t?.name ?? '', Admin: p.admin ? 'yes' : 'no', 'Team objective': t && t.leadId === p.id ? t.objective ?? '' : '' }));
  }
  // Results (reading only)
  out.Results = [hdr('Results')];
  for (const g of goals) {
    const s = st.get(g.id) || { status: 'none' }; const owner = person.get(g.ownerId);
    out.Results.push(row('Results', { Key: g.key, ID: g.id, Goal: g.title, Level: LEVEL[g.level], Team: team.get(g.teamId)?.name ?? '', Owner: owner?.name ?? '', 'Owner email': owner?.email ?? '', Target: g.plan ? num(g.plan.target) : g.range ? num(g.range.limit) : '', 'Due week': g.plan?.endWeek ?? S1.WEEKS, Status: STATUS_WORD[s.status] || s.status, Now: s.latest?.value ?? '' }));
  }
  // Asks
  out.Asks = [hdr('Asks')];
  for (const a of W.requests || []) {
    const gs = (a.goalIds || []).map((id) => goalById.get(id)).filter(Boolean);
    if (opt.goals && !gs.some((g) => opt.goals.has(g.id))) continue;
    const r = { ID: a.id, Kind: ASK_KIND[a.kind] || a.kind, Ask: a.ask, Goals: gs.map((g) => g.title).join('; '), 'Goal keys': gs.map((g) => g.key).join('; '), 'Goal IDs': gs.map((g) => g.id).join('; '), 'Asked by': person.get(a.askedBy)?.name ?? '', 'Asked of': person.get(a.recipientId)?.name ?? '', Status: ASK_STATUS[a.status] || a.status, 'Due week': num(a.dueWeek), 'Asked at': a.createdAt ?? '', Answer: a.answer ?? '', 'Answered by': person.get(a.answeredBy)?.name ?? '', 'Answered at': a.answeredAt ?? '' };
    if (!modulesOff.has('reviews')) r.Review = (W.reviews || []).find((x) => x.id === a.reviewId)?.name ?? '';
    out.Asks.push(row('Asks', r));
  }
  // Notes (reviews' module sheet)
  if (!modulesOff.has('reviews')) {
    out.Notes = [hdr('Notes')];
    for (const d of W.decisions || []) {
      const g = goalById.get(d.goalId); if (!g || (opt.goals && !opt.goals.has(g.id))) continue;
      out.Notes.push(row('Notes', { 'Goal key': g.key, 'Goal ID': g.id, Goal: g.title, Week: d.week, Kind: d.kind, 'Said by': person.get(d.byId)?.name ?? '', Text: d.note ?? d.text ?? '', Who: person.get(d.whoId)?.name ?? '', 'Due week': num(d.dueWeek), Review: (W.reviews || []).find((x) => x.id === d.reviewId)?.name ?? '', Answer: d.answer ?? '', At: d.at ?? '' }));
    }
  }
  // Metrics (the metric library's module sheet)
  if (!modulesOff.has('metrics')) {
    out.Metrics = [hdr('Metrics')];
    for (const m of W.modules?.metrics?.metrics || []) {
      if (m.removedAt) continue;
      const links = (W.modules?.metrics?.links || []).filter((l) => l.metricId === m.id && !l.removedAt);
      const gs = links.map((l) => goalById.get(l.goalId)).filter(Boolean);
      out.Metrics.push(row('Metrics', { ID: m.id, Metric: m.name, Meaning: m.meaning ?? '', Unit: m.unit ?? '', Decimals: num(m.decimals), Direction: m.direction === 'lower' ? 'Lower is better' : 'Higher is better', Source: m.source ?? '', 'Source owner': m.sourceOwner ?? '', Refresh: m.refresh ? m.refresh[0].toUpperCase() + m.refresh.slice(1) : '', Owner: person.get(m.ownerId)?.name ?? '', 'Owner email': person.get(m.ownerId)?.email ?? '', Caveats: m.caveats ?? '', Measures: gs.map((g) => g.title).join('; '), 'Goal keys': gs.map((g) => g.key).join('; ') }));
    }
  }
  return out;
}

// ---------- Start here: the field table, and where the file came from ----------
export function startHere(ctx) {
  const rows = [['Faro: Start here'], ['File of', ctx.wsId || 'demo', ctx.W.cycle?.id || 'cycle', ctx.wsName], [],
    ['Each sheet is known by its header row. Columns can be in any order. A column left out keeps what the record says.'], []];
  for (const sh of LOADS_BACK) {
    rows.push([sh], [`A new row needs: ${SHEET[sh].needs || (sh === 'Plan' ? 'Key (or ID).' : '')}`]);
    rows.push(['Column', 'A new row', 'Format', 'Example', 'If it’s left empty', 'What it means']);
    for (const c of SHEET[sh].cols) rows.push([c.col, c.need, c.format ?? '', c.example ?? '', c.empty ?? '', c.means]);
    rows.push([]);
  }
  rows.push(['Status words']);
  for (const [, w] of Object.entries(STATUS_WORD)) rows.push([w]);
  return rows;
}

const greyOf = (header, sheet) => new Set(header.map((h, i) => [h, i]).filter(([h]) => { const c = SHEET[sheet]?.cols.find((x) => x.col === h); return c && (WORKED(sheet, c) || c.need === 'For reading' || READING_ONLY.includes(sheet)); }).map(([, i]) => i));

export function workbook(ctx, opt = {}) {
  const rows = sheetRows(ctx, opt);
  const sheets = [{ name: 'Start here', rows: startHere(ctx) }];
  for (const [name, r] of Object.entries(rows)) sheets.push({ name, rows: r, grey: greyOf(r[0], name) });
  return writeXlsx(sheets);
}
export function csvZip(ctx, opt = {}) {
  const rows = sheetRows(ctx, opt);
  return zip(Object.entries(rows).map(([name, r]) => ({ name: `${name}.csv`, data: writeCsv(r) })));
}
export function oneCsv(ctx, sheet, opt = {}) { return writeCsv(sheetRows(ctx, opt)[sheet] || [[]]); }

// ---------- the template: Start here, then the fill-in columns, required headers in bold, example rows ----------
export const EXAMPLE_ROWS = {
  Goals: [{ Goal: 'Deploy lead time', Action: 'Example', Owner: 'Ben Ortiz', 'Owner email': 'ben.ortiz@example.com', Team: 'Platform', Unit: 'days', Start: '5', Target: '1', Plan: 'back-loaded' },
    { Goal: 'Error budget kept', Action: 'Example', Owner: 'Ben Ortiz', Limit: '5', 'Must stay': 'at most', Unit: '%' },
  ],
  People: [{ Email: 'ana.silva@example.com', Name: 'Ana Silva', Action: 'Example', Team: 'Platform' }],
};
export function template(ctx) {
  const sheets = [{ name: 'Start here', rows: startHere(ctx) }];
  for (const sh of LOADS_BACK) {
    const cols = [...fillIn(sh).map((c) => c.col), ...(sh === 'Plan' ? planWeeks(ctx.S1.WEEKS) : [])];
    const bold = new Set(cols.map((c, i) => [c, i]).filter(([c]) => /^Required/.test(SHEET[sh].cols.find((x) => x.col === c)?.need || "")).map(([, i]) => i));
    const rows = [cols];
    for (const ex of EXAMPLE_ROWS[sh] || []) rows.push(cols.map((c) => ex[c] ?? ''));
    sheets.push({ name: sh, rows, bold });
  }
  return writeXlsx(sheets);
}

// ---------- names ----------
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function fileName(ctx, what, scope, ext) { return `${slug(ctx.wsName)}-${what}-${slug(scope)}-${ctx.todayIso}.${ext}`; }

// ---------- JSON and the brief: for reading ----------
export function asJson(ctx, opt = {}) {
  const { W, S1, R } = ctx;
  const st = R.standing(ctx.moment).st;
  const person = new Map(W.people.map((p) => [p.id, p]));
  const team = new Map(W.teams.map((t) => [t.id, t]));
  const goals = W.goals.filter((g) => !g.removedAt && (!opt.goals || opt.goals.has(g.id)));
  return {
    format: 'goals-app.export', version: 1, exportedAt: ctx.nowIso(), about: 'Every goal in the cycle, each with its plan by week and its check-ins inside it. Codes never change; the words beside them are the vocabulary’s.',
    words: { status: Object.fromEntries(Object.entries(STATUS_WORD).map(([k, v]) => [k, { label: v }])) },
    workspace: { id: ctx.wsId || 'demo', name: ctx.wsName },
    cycle: { id: W.cycle.id, name: W.cycle.name, startDate: W.cycle.startDate, weeks: W.cycle.weeks, currentWeek: ctx.week },
    people: W.people.filter((p) => !p.removedAt).map((p) => ({ id: p.id, name: p.name, email: p.email ?? null, jobTitle: p.role ?? '', team: team.get(p.teamId)?.name ?? '', admin: !!p.admin })),
    teams: W.teams.map((t) => ({ id: t.id, name: t.name, objective: t.objective ?? '' })),
    goals: goals.map((g) => {
      const s = st.get(g.id) || { status: 'none' };
      const o = { id: g.id, key: g.key, title: g.title, level: g.level, type: g.kind, team: team.get(g.teamId)?.name ?? '', owner: person.get(g.ownerId)?.name ?? '', ownerId: g.ownerId, ownerEmail: person.get(g.ownerId)?.email ?? null, feedsIntoId: g.parentId ?? null, whyItHelps: g.whyHelps ?? '', source: g.source ?? '', definition: g.definition ?? '' };
      if (g.kind !== 'milestone') { o.unit = g.unit ?? ''; o.decimals = g.decimals ?? 0; }
      if (g.plan) o.plan = { ...g.plan, byWeek: Array.from({ length: S1.WEEKS }, (_, i) => i + 1).map((w) => { try { return { week: w, value: S1.planAt(S1.planAsOf(g, w), w) }; } catch { return null; } }).filter(Boolean) };
      if (g.range) o.range = { mustStay: g.range.bound, lower: g.range.lower, limit: g.range.limit, margin: g.range.margin ?? 0 };
      if (g.stages) o.stages = g.stages;
      if (g.stoppedAt) o.stopped = { at: g.stoppedAt, by: g.stoppedBy ?? null, reason: g.stopReason ?? '' };
      o.now = { status: s.status, statusLabel: STATUS_WORD[s.status], value: s.latest?.value ?? null, lastCheckInWeek: s.latest?.week ?? null };
      o.needsAttention = { needs: (s.flags || []).length > 0, flags: (s.flags || []).map((k) => ({ kind: k })) };
      o.checkIns = W.checkIns.filter((c) => c.goalId === g.id && !c.removedAt).map((c) => ({ id: c.id, week: c.week, value: c.value, stages: c.stages, call: c.status, calculated: c.calculated, cause: c.cause, why: c.why, whyGreener: c.greenerWhy || null, pathToGreen: c.pathToGreen, next: c.next, postedAt: c.postedAt, postedBy: person.get(c.authorId)?.name ?? '', backfilled: !!c.backfilled }));
      return o;
    }),
  };
}
export function brief(ctx, opt = {}) {
  const j = asJson(ctx, opt);
  const counts = {};
  for (const g of j.goals) counts[g.now.statusLabel] = (counts[g.now.statusLabel] || 0) + 1;
  const lines = [`# ${ctx.wsName}: goals, week ${ctx.week} of ${j.cycle.name}`, '', `${j.goals.length} goals: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}.`, '', '## Needs attention', ''];
  for (const g of j.goals.filter((x) => x.needsAttention.needs)) {
    const last = g.checkIns[g.checkIns.length - 1];
    lines.push(`- ${g.key} ${g.title} (${g.owner}): ${g.now.statusLabel}.${last?.why ? ` Why: ${last.why}` : ''}${last?.pathToGreen?.what ? ` Path to green: ${last.pathToGreen.what}` : ''}`);
  }
  lines.push('', '## Every goal, by what it feeds', '');
  const kids = new Map();
  for (const g of j.goals) { const k = g.feedsIntoId ?? ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(g); }
  const walk = (id, depth) => { for (const g of kids.get(id) || []) { lines.push(`${'  '.repeat(depth)}- ${g.key} ${g.title}: ${g.now.statusLabel}${g.now.value !== null ? `, ${g.now.value}${g.unit ? ` ${g.unit}` : ''}` : ''}`); walk(g.id, depth + 1); } };
  walk('', 0);
  return lines.join('\n') + '\n';
}
