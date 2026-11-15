// Export (EXPORT, FIELD-TABLE, SPREADSHEETS-ON-DATA): every sheet of the one format, made from the workspace,
// the field table on Start here, the template, zipped CSVs, one CSV, JSON, the brief, and a table as shown.
import { FORMAT } from './fields.mjs';
import { writeWorkbook, writeCsv, zip } from './book.mjs';
import { STATUS_WORD } from '../../screens.mjs';

export const LOADS_BACK = ['Goals', 'Plan', 'Check-ins', 'People'];
export const ALL_SHEETS = ['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics'];
const LEVEL = { 'north-star': 'north star', svp: 'svp', team: 'team' };
const SHAPE = { straight: 'straight', back: 'back-loaded', stepped: 'stepped' };
const BOUND = { atMost: 'at most', atLeast: 'at least', between: 'between' };
const CALL = { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' };
const CAUSE = { aggressive: 'Plan too aggressive', slower: 'Delivery slower', blocked: 'Blocked by a dependency', external: 'External factor', data: 'Data problem', other: 'Something else', cautious: 'Plan too cautious', early: 'Change landed early', oneoff: 'One-off, won’t last' };
const RECOVERY = { plan: 'Plan', investigating: 'Still investigating', help: 'Needs a decision or help', target: 'Target should change' };
const ASK_KIND = { decision: 'Decision or help', help: 'Decision or help', update: 'Update', question: 'Question', action: 'Action' };
const ASK_STATUS = { open: 'Open', answered: 'Answered', done: 'Done', withdrawn: 'Withdrawn' };

export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'faro';
export const today = (app) => String(app.now || app.W.builtFor).slice(0, 10);
// {workspace}-{what}-{scope}-{date}.{ext}
export const fileName = (app, what, scope, ext) => `${slug(app.wsName)}-${what}-${slug(scope)}-${today(app)}.${ext}`;
export const cols = (sheet) => FORMAT[sheet].cols.map((c) => c.col).filter((c) => c !== 'Week N');
const workedOut = (sheet) => new Set(FORMAT[sheet].cols.filter((c) => c.need === 'Worked out').map((c) => c.col));
const fills = (sheet) => FORMAT[sheet].cols.filter((c) => c.need !== 'Worked out' && c.need !== 'For reading').map((c) => c.col).filter((c) => c !== 'Week N');

// ---------- the records as rows, by column name ----------
function context(app) {
  const W = app.W, S1 = app.S1;
  const people = new Map(W.people.map((p) => [p.id, p]));
  const teams = new Map(W.teams.map((t) => [t.id, t]));
  const goals = W.goals.filter((g) => !g.removedAt);
  const byId = new Map(goals.map((g) => [g.id, g]));
  const ws = S1.asOf(app.now || W.builtFor);
  const week = S1.currentWeek(app.now || W.builtFor);
  return { W, S1, people, teams, goals, byId, ws, week };
}
const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));

function goalRow(cx, g) {
  const { people, teams, byId, S1, W } = cx;
  const o = people.get(g.ownerId);
  const parent = g.parentId ? byId.get(g.parentId) : null;
  const posted = S1.sortCk(W.checkIns.filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= (cx.now || W.builtFor)));
  const st = S1.goalStatus(g, posted, cx.nowIso);
  const last = S1.latestPosted(posted);
  const r = {
    Key: g.key, ID: g.id, Goal: g.title, Action: '', Ref: '', Level: LEVEL[g.level] || g.level, Team: teams.get(g.teamId)?.name || '—',
    Owner: o?.name || '', 'Owner email': o?.email || '', Type: g.kind, State: g.proposedAt ? 'proposed' : 'active',
    'Feeds into': parent ? parent.title : '', 'Feeds into key': parent ? parent.key : '', 'Feeds into ref': '',
    'Why it helps': g.whyHelps || '', Effect: num(g.effect), Source: g.source || '', Definition: g.definition || '', Reason: '',
    Status: g.proposedAt ? 'Proposed' : STATUS_WORD[st.status] || '', Since: st.days !== undefined && st.days !== null ? `${st.days} days` : '',
    Now: last ? (g.kind === 'milestone' ? `${(last.stages || []).filter((s) => s.doneWeek !== null && s.doneWeek !== undefined).length} of ${(g.stages || []).length} stages done` : num(last.value)) : '',
    'Last check-in week': last ? last.week : '', 'Why it’s off': last && (last.status === 'off' || last.status === 'risk') ? last.why || '' : '',
    'Recovery plan': last?.pathToGreen?.what || '', 'By when': last?.pathToGreen?.byWeek ? `week ${last.pathToGreen.byWeek}` : '', 'Next step': last?.next || '',
  };
  if (g.kind === 'metric' || g.kind === 'range') { r.Unit = g.unit || ''; r.Decimals = g.decimals ?? 0; }
  if (g.kind === 'metric') {
    const p = g.plan || {};
    r.Start = num(p.start); r.Target = num(p.target); r.Plan = SHAPE[p.shape] || 'straight';
    r['Plan from week'] = p.fromWeek ?? ''; r['Due week'] = p.endWeek ?? '';
    if (g.baseline) { r['Baseline period'] = g.baseline.period || ''; r['Baseline is'] = g.baseline.provisional ? 'provisional' : 'firm'; }
    const pw = S1.planAt ? S1.planAt(p, cx.week) : null;
    if (pw !== null && pw !== undefined && Number.isFinite(pw)) r['Plan this week'] = Number(pw.toFixed(Math.min(3, (g.decimals ?? 0) + 1)));
  }
  if (g.kind === 'range') {
    const rg = g.range || {};
    r.Limit = rg.bound === 'between' ? `${rg.lower}–${rg.limit}` : num(rg.limit);
    r['Must stay'] = BOUND[rg.bound] || 'at most'; r.Margin = num(rg.margin ?? 0);
  }
  if (g.kind === 'milestone') r.Stages = (g.stages || []).map((s) => `${s.name}@${s.dueWeek}`).join('; ');
  return r;
}
function checkInRow(cx, c) {
  const g = cx.byId.get(c.goalId);
  const a = cx.people.get(c.authorId);
  const r = { ID: c.id, 'Goal key': g?.key || '', 'Goal ID': c.goalId, Goal: g?.title || '', 'Goal ref': '', Week: c.week,
    'Week starting': cx.S1.isoOfDay ? cx.S1.isoOfDay(cx.S1.START + 7 * c.week) : '',
    Value: c.value === null || c.value === undefined ? '' : Number(c.value),
    Stages: g?.kind === 'milestone' ? (c.stages || []).map((s) => { const st = (g.stages || []).find((x) => x.id === s.stageId); if (!st) return null; return s.doneWeek !== null && s.doneWeek !== undefined ? `${st.name}: done week ${s.doneWeek}` : s.forecastWeek !== null && s.forecastWeek !== undefined ? `${st.name}: expected week ${s.forecastWeek}` : `${st.name}: due week ${st.dueWeek}`; }).filter(Boolean).join('; ') : '',
    Call: CALL[c.status] || '', Cause: c.cause ? CAUSE[c.cause] || c.cause : '', Why: c.why || '', 'Why greener': c.greenerWhy || '',
    'Path to green': c.pathToGreen?.what || '', Recovery: c.pathToGreen ? RECOVERY[c.pathToGreen.state] || '' : '', 'Back on plan by week': c.pathToGreen?.byWeek ?? '',
    Needs: c.pathToGreen?.needs || '', 'Next step': c.next || '', Calculated: STATUS_WORD[c.calculated] || '', 'Posted at': c.postedAt || '', 'Posted by': a?.name || '', 'Posted by email': a?.email || '', Backfilled: c.backfilled ? 'yes' : '' };
  return r;
}
function personRow(cx, p) {
  const t = cx.teams.get(p.teamId);
  return { Email: p.email || '', ID: p.id, Name: p.name, Action: '', 'Job title': p.jobTitle || p.role || '', Team: t?.name || '', Admin: p.admin ? 'yes' : 'no', 'Team objective': t && t.leadId === p.id ? t.objective || '' : '', 'Takes over': '' };
}

// every sheet as [{ name, header, rows (objects) }] for the goals given (all by default)
export function sheetsFor(app, goalIds = null) {
  const cx = context(app);
  cx.nowIso = app.now || app.W.builtFor; cx.now = cx.nowIso;
  const goals = cx.goals.filter((g) => !goalIds || goalIds.has(g.id)).sort((a, b) => Number(a.key.slice(2)) - Number(b.key.slice(2)));
  const gset = new Set(goals.map((g) => g.id));
  const metricGoals = goals.filter((g) => g.kind === 'metric');
  const lastWeek = cx.S1.WEEKS;
  const planCols = ['Key', 'ID', 'Goal', 'Unit', 'Start', ...Array.from({ length: lastWeek }, (_, i) => `Week ${i + 1}`)];
  const planRows = metricGoals.map((g) => {
    const p = g.plan || {};
    const r = { Key: g.key, ID: g.id, Goal: g.title, Unit: g.unit || '', Start: num(p.start) };
    if (p.points?.length) for (const q of p.points) r[`Week ${q.week}`] = num(q.value);
    return r;
  });
  const cks = app.W.checkIns.filter((c) => gset.has(c.goalId) && !c.removedAt && c.postedAt <= cx.nowIso).sort((a, b) => (a.goalId < b.goalId ? -1 : a.goalId > b.goalId ? 1 : a.week - b.week));
  const people = app.W.people.filter((p) => !p.removedAt && !p.leftAt);
  const asks = (app.W.requests || []).filter((a) => (a.goalIds || []).some((id) => gset.has(id)));
  const notes = (app.W.decisions || []).filter((d) => gset.has(d.goalId) && d.reviewId);
  const reviews = new Map((app.W.reviews || []).map((r) => [r.id, r]));
  const out = [
    { name: 'Goals', header: cols('Goals'), rows: goals.map((g) => goalRow(cx, g)) },
    { name: 'Plan', header: planCols, rows: planRows },
    { name: 'Check-ins', header: cols('Check-ins'), rows: cks.map((c) => checkInRow(cx, c)) },
    { name: 'People', header: cols('People'), rows: people.map((p) => personRow(cx, p)) },
    { name: 'Results', header: cols('Results'), rows: goals.map((g) => { const r = goalRow(cx, g); return { Key: r.Key, ID: r.ID, Goal: r.Goal, Level: r.Level, Team: r.Team, Owner: r.Owner, 'Owner email': r['Owner email'], Target: r.Target ?? r.Limit ?? '', 'Due week': r['Due week'] || cx.S1.WEEKS, Status: r.Status, Now: r.Now }; }) },
    { name: 'Asks', header: cols('Asks'), rows: asks.map((a) => ({ ID: a.id, Kind: ASK_KIND[a.kind] || a.kind, Ask: a.ask, Goals: a.goalIds.map((id) => cx.byId.get(id)?.title).filter(Boolean).join('; '), 'Goal keys': a.goalIds.map((id) => cx.byId.get(id)?.key).filter(Boolean).join('; '), 'Goal IDs': a.goalIds.join('; '), 'Asked by': cx.people.get(a.askedBy)?.name || '', 'Asked of': cx.people.get(a.recipientId)?.name || '', Status: ASK_STATUS[a.status] || a.status, 'Due week': a.dueWeek ?? '', Review: reviews.get(a.reviewId)?.name || '', 'Asked at': a.createdAt || '', Answer: a.answer || '', 'Answered by': cx.people.get(a.answeredBy)?.name || '', 'Answered at': a.answeredAt || '' })) },
    { name: 'Notes', header: cols('Notes'), rows: notes.map((d) => ({ 'Goal key': cx.byId.get(d.goalId)?.key, 'Goal ID': d.goalId, Goal: cx.byId.get(d.goalId)?.title, Week: d.week, Kind: d.kind, 'Said by': cx.people.get(d.byId)?.name || '', Text: d.note || '', Review: reviews.get(d.reviewId)?.name || '', At: d.at })) },
    { name: 'Metrics', header: cols('Metrics'), rows: [] },
  ];
  // what's off isn't written: Reviews' Notes sheet, the Metric library's Metrics sheet
  return out.filter((s) => !(s.name === 'Notes' && !app.on('reviews')) && !(s.name === 'Metrics' && !app.on('metrics')));
}

// ---------- Start here: where the file came from, then the field table ----------
export const fileOf = (app) => ['File of', app.W.id || `ws_${slug(app.wsName)}`, app.W.cycle?.id || '', app.wsName];
export function startHere(app, { template = false } = {}) {
  const rows = [['Start here', `Faro, ${app.wsName}`, `As of week ${app.S1.currentWeek(app.now || app.W.builtFor)}, ${today(app)}`], fileOf(app), []];
  rows.push([template ? 'Fill in the columns on each sheet. A header in bold is one a new row must have. Rows whose Action says Example are never imported.' : 'Every column on the sheets after this one: what a new row needs, its format, an example, and what an empty cell does. Grey columns are worked out by Faro and never read.']);
  for (const sheet of template ? LOADS_BACK : ALL_SHEETS) {
    const f = FORMAT[sheet];
    rows.push([]);
    rows.push([sheet, f.intro || '']);
    if (f.needs) rows.push(['', f.needs]);
    rows.push(f.cols[0].format !== undefined ? ['Column', 'A new row', 'Format', 'Example', 'If it’s left empty', 'What it means'] : ['Column', 'Kind', 'What it means']);
    for (const c of f.cols) {
      if (template && (c.need === 'Worked out' || c.need === 'For reading')) continue;
      rows.push(c.format !== undefined ? [c.col, c.need, c.format, c.example, c.empty, c.means] : [c.col, c.need, c.means]);
    }
  }
  if (!template) {
    rows.push([]); rows.push(['Status words']);
    for (const [k, w] of Object.entries(STATUS_WORD)) rows.push([w, k]);
  }
  return rows;
}

const asGrid = (s) => [s.header, ...s.rows.map((r) => s.header.map((h) => (r[h] === undefined ? '' : r[h])))];
export function workbook(app, goalIds = null) {
  const sheets = sheetsFor(app, goalIds);
  return writeWorkbook([{ name: 'Start here', rows: startHere(app), bold: new Set([0]) }, ...sheets.map((s) => {
    const wo = workedOut(s.name);
    return { name: s.name, rows: asGrid(s), bold: new Set(s.header.map((_, i) => i)), grey: new Set(s.header.map((h, i) => (wo.has(h) ? i : -1)).filter((i) => i >= 0)) };
  })]);
}
export function csvZip(app, goalIds = null) {
  return zip(sheetsFor(app, goalIds).map((s) => ({ name: `${s.name}.csv`, data: writeCsv(asGrid(s)) })));
}
export function oneCsv(app, sheet, goalIds = null) {
  const s = sheetsFor(app, goalIds).find((x) => x.name === sheet) || sheetsFor(app, goalIds)[0];
  return writeCsv(asGrid(s));
}

// ---------- the template ----------
const EX = {
  Goals: [{ Goal: 'Deploy lead time', Action: 'Example', Level: 'team', Team: 'Platform', Owner: 'Ben Ortiz', Type: 'metric', Unit: 'days', Start: 5, Target: 1 }, { Goal: 'Pager noise', Action: 'Example', Owner: 'Ben Ortiz', Type: 'range', Unit: 'pages', Limit: 20, 'Must stay': 'at most' }],
  'Check-ins': [{ 'Goal key': 'G-12', Week: 46, Value: 6, Call: 'At risk', Cause: 'Plan too aggressive', Why: 'Runner pool was halved for the migration', 'Path to green': 'Add 20 runners by week 48' }],
  People: [{ Email: 'ana.silva@example.com', Name: 'Ana Silva', Action: 'Example', 'Job title': 'Platform lead', Team: 'Platform', Admin: 'no' }],
};
export function template(app) {
  // example rows in this workspace's own names, so a row is plainly an example and nothing in it is unknown
  const admin = app.W.people.find((p) => p.admin) || app.W.people[0];
  const team = app.W.teams.find((t) => t.id === admin?.teamId)?.name || '';
  const EXAMPLES = { Goals: EX.Goals.map((r) => ({ ...r, Owner: admin?.name || r.Owner, Team: team || r.Team })), People: EX.People.map((r) => ({ ...r, Team: team || r.Team })), 'Check-ins': EX['Check-ins'] };
  const need = (sheet) => new Set(FORMAT[sheet].cols.filter((c) => /^Required/.test(c.need) && !/^Required (for|when|with)/.test(c.need)).map((c) => c.col));
  const sheets = [{ name: 'Start here', rows: startHere(app, { template: true }), bold: new Set([0]) }];
  for (const name of LOADS_BACK) {
    const header = name === 'Plan' ? ['Key', 'ID', 'Start', 'Week 1', 'Week 2'] : fills(name);
    const ex = (EXAMPLES[name] || []).map((r) => header.map((h) => r[h] ?? ''));
    // a check-in can't say Example: its example is a row for a goal key that only the example shows; Action isn't on Check-ins
    const rows = name === 'Check-ins' ? [] : ex;
    const nb = need(name);
    sheets.push({ name, rows: [header, ...rows], bold: new Set(header.map((h, i) => (nb.has(h) ? i : -1)).filter((i) => i >= 0)) });
  }
  return writeWorkbook(sheets);
}

// ---------- a table as shown (Data, export_table) ----------
export function tableAsShown(app, table) {
  const sheet = table.sheet || 'Goals';
  const always = FORMAT[sheet].always;
  const added = always.filter((c) => !table.columns.includes(c));
  const header = [...table.columns, ...added];
  const rows = table.rows.map((r) => header.map((h) => r[h] ?? ''));
  return { header, rows, added, grey: new Set(added.map((c) => header.indexOf(c))) };
}

// ---------- JSON and the brief ----------
export function jsonExport(app, goalIds = null) {
  const cx = context(app);
  const now = app.now || app.W.builtFor;
  const goals = cx.goals.filter((g) => !goalIds || goalIds.has(g.id));
  const words = { status: Object.fromEntries(Object.entries(STATUS_WORD).map(([k, v]) => [k, { label: v, meaning: v }])) };
  return {
    format: 'goals-app.export', version: 1, exportedAt: now, about: 'Every goal in the cycle, each with its plan by week and its check-ins inside it. Codes never change; the words beside them are the vocabulary’s.', words,
    workspace: { id: fileOf(app)[1], name: app.wsName },
    cycle: { id: app.W.cycle.id, name: app.W.cycle.name, startDate: app.W.cycle.startDate, weeks: cx.S1.WEEKS, currentWeek: cx.week },
    people: app.W.people.map((p) => ({ id: p.id, name: p.name, email: p.email || null, jobTitle: p.jobTitle || '', team: cx.teams.get(p.teamId)?.name || '', admin: !!p.admin })),
    teams: app.W.teams.map((t) => ({ id: t.id, name: t.name, objective: t.objective || '' })),
    goals: goals.map((g) => {
      const posted = cx.S1.sortCk(app.W.checkIns.filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= now));
      const st = cx.S1.goalStatus(g, posted, now);
      const o = { id: g.id, key: g.key, title: g.title, level: g.level, type: g.kind, team: cx.teams.get(g.teamId)?.name || '', owner: cx.people.get(g.ownerId)?.name || '', ownerId: g.ownerId, ownerEmail: cx.people.get(g.ownerId)?.email || null, feedsIntoId: g.parentId || null, whyItHelps: g.whyHelps || '', source: g.source || '', definition: g.definition || '' };
      if (g.kind !== 'milestone') { o.unit = g.unit || ''; o.decimals = g.decimals ?? 0; }
      if (g.kind === 'metric') o.plan = { start: g.plan.start, target: g.plan.target, shape: g.plan.shape, fromWeek: g.plan.fromWeek ?? 0, dueWeek: g.plan.endWeek ?? cx.S1.WEEKS, setByHand: !!g.plan.points?.length, byWeek: Array.from({ length: cx.S1.WEEKS }, (_, i) => ({ week: i + 1, value: cx.S1.planAt(g.plan, i + 1) })) };
      if (g.kind === 'range') o.range = { mustStay: g.range.bound, lower: g.range.lower, limit: g.range.limit, margin: g.range.margin ?? 0 };
      if (g.kind === 'milestone') o.stages = g.stages;
      o.now = { status: st.status, statusLabel: STATUS_WORD[st.status] };
      o.checkIns = posted.map((c) => ({ id: c.id, week: c.week, value: c.value, stages: c.stages, call: c.status, callLabel: STATUS_WORD[c.status], calculated: c.calculated, cause: c.cause, why: c.why, whyGreener: c.greenerWhy || null, pathToGreen: c.pathToGreen, next: c.next, postedAt: c.postedAt, postedBy: c.authorId, backfilled: !!c.backfilled }));
      return o;
    }),
  };
}
export function brief(app, goalIds = null) {
  const j = jsonExport(app, goalIds);
  const by = {};
  for (const g of j.goals) by[g.now.statusLabel] = (by[g.now.statusLabel] || 0) + 1;
  const lines = [`# ${app.wsName}: goals as of week ${j.cycle.currentWeek}`, '', '## How to read the status', '', ...Object.entries(STATUS_WORD).map(([k, w]) => `- **${w}** (${k})`), '', '## Counts', '', ...Object.entries(by).map(([w, n]) => `- ${w}: ${n}`), '', '## Needs attention', ''];
  for (const g of j.goals.filter((x) => x.now.status === 'off' || x.now.status === 'risk')) {
    const last = g.checkIns[g.checkIns.length - 1];
    lines.push(`### ${g.key} ${g.title} (${g.now.statusLabel})`, '', `- **Owner:** ${g.owner}`, `- **Why it’s off:** ${last?.why || '—'}`, `- **Recovery plan:** ${last?.pathToGreen?.what || '—'}`, `- **Needs:** ${last?.pathToGreen?.needs || '—'}`, '');
  }
  lines.push('## Every goal', '', ...j.goals.map((g) => `- ${g.key} ${g.title}: ${g.now.statusLabel}`));
  return lines.join('\n') + '\n';
}
