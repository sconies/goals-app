// Stage 2: the change engine (planChanges), from spec/core/rules/change-engine.md, import-levels.md,
// import-issues.md, export-format.md and goal-entry.md. Writes changes.csv and import.csv.
import fs from 'node:fs';
import path from 'node:path';

// ---------- words ----------
const Q = (s) => `“${s}”`;
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const part = (s) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, '-');
const vpart = (s) => fold(s).replace(/ /g, '-');
export const groupId = (kind, sheet, column, value) => `${kind}:${part(sheet)}:${part(column)}:${vpart(value)}`;

export function editDistance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// near(typed, candidates): { exact } | { near } | {}   candidates: [{ key, names: [..] }]
export function near(typed, cands) {
  const f = fold(typed);
  const exact = cands.filter((c) => c.names.some((n) => fold(n) === f));
  if (exact.length === 1) return { exact: exact[0] };
  if (exact.length > 1) return { many: exact };
  if (f.length <= 2) return {};
  const lim = f.length >= 8 ? 2 : 1;
  const within = [];
  for (const c of cands) {
    let best = null;
    for (const n of c.names) { const d = editDistance(f, fold(n)); if (d <= lim && (!best || d < best.d)) best = { d, name: n }; }
    if (best) within.push({ c, name: best.name });
  }
  if (within.length === 1) return { near: within[0].c, as: within[0].name };
  return {};
}

const groupDigits = (s) => { const neg = s.startsWith('-'); const t = neg ? s.slice(1) : s; const [i, f] = t.split('.'); return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : ''); };
const fixed = (v, d) => groupDigits(Number(v).toFixed(d ?? 0));
const withUnit = (s, unit) => (!unit ? s : unit === '%' ? `${s}%` : `${s} ${unit}`);
const numWords = (v, unit, d) => withUnit(fixed(v, d), unit);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const placesWords = (n) => (n === 0 ? 'whole numbers' : plural(n, 'decimal place', 'decimal places'));
const exampleNumber = (d) => ['29', '29.4', '29.45', '29.453'][Math.max(0, Math.min(3, d ?? 1))];
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const listOr = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const typedDecimals = (s) => { const t = String(s).trim(); const m = t.match(/[.,](\d+)$/); return m ? m[1].replace(/0+$/, '').length : 0; };

// ---------- the one format: columns per sheet ----------
const SHEETS = {
  goals: { name: 'Goals', cols: ['Key', 'ID', 'Goal', 'Action', 'Ref', 'Level', 'Team', 'Owner', 'Owner email', 'Owner ID', 'Type', 'State', 'Unit', 'Decimals', 'Start', 'Baseline period', 'Baseline is', 'Target', 'Plan', 'From', 'Plan from week', 'To', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages', 'Feeds into', 'Feeds into key', 'Feeds into ID', 'Feeds into ref', 'Why it helps', 'Effect', 'Source', 'Definition', 'Reason',
    'Status', 'Since', 'Now', 'Plan this week', 'Gap', 'Last check-in week', 'Forecast', 'Why it’s off', 'Recovery plan', 'By when', 'Needs', 'Next step', 'Warnings', 'Result', 'Q1', 'Q2', 'Q3', 'Q4'],
    also: { Goal: ['goal name', 'title', 'objective'], Level: ['goal level'], Team: ['team name'], Owner: ['owner name'], 'Owner email': ['owner e-mail', 'owner email address'], Type: ['goal type'], Unit: ['units'], Start: ['baseline'], 'Baseline period': ['baseline covers', 'baseline window'], 'Baseline is': ['provisional'], Target: ['target value', 'goal value'], From: ['from week'], To: ['to week'], 'Due week': ['due', 'deadline week'], Reason: ['reason for change'] } },
  plan: { name: 'Plan', cols: ['Key', 'ID', 'Goal', 'Unit', 'Start'], also: {} },
  checkIns: { name: 'Check-ins', cols: ['ID', 'Goal key', 'Goal ID', 'Goal', 'Goal ref', 'Week', 'Week starting', 'Value', 'Number from', 'Source’s number', 'Measured at', 'Reason for a different number', 'Stages', 'Call', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step', 'Next', 'Calculated', 'Plan that week', 'Posted at', 'Posted by', 'Posted by email', 'Backfilled'], also: {} },
  people: { name: 'People', cols: ['Email', 'ID', 'Name', 'Action', 'Job title', 'Team', 'Admin', 'Team objective', 'Takes over'], also: {} },
};
const SHEET_ORDER = ['goals', 'plan', 'checkIns', 'people'];

const WORDS = {
  Level: [['north-star', 'north star', ['northstar', 'headline', 'north star goal']], ['svp', 'svp', ['senior vp', 'senior']], ['team', 'team', []]],
  Type: [['metric', 'metric', ['move a number', 'number']], ['range', 'range', ['keep a number in range', 'keep in range']], ['milestone', 'milestone', ['hit dated stages', 'stages']]],
  Plan: [['straight', 'straight', ['linear', 'straight line']], ['back', 'back-loaded', ['back', 'backloaded', 'back loaded']], ['stepped', 'stepped', ['steps', 'step']]],
  'Must stay': [['atMost', 'at most', ['atmost', 'max', 'maximum', '<=', '≤', 'below']], ['atLeast', 'at least', ['atleast', 'min', 'minimum', '>=', '≥', 'above']], ['between', 'between', []]],
  Admin: [[true, 'yes', ['y', 'true', '1', 'x', 'admin']], [false, 'no', ['n', 'false', '0']]],
  Call: [['on', 'On track', ['green']], ['risk', 'At risk', ['amber', 'yellow']], ['off', 'Off track', ['red']], ['done', 'Done', []]],
  Cause: [['aggressive', 'Plan too aggressive', []], ['slower', 'Delivery slower', []], ['blocked', 'Blocked by a dependency', []], ['external', 'External factor', []], ['data', 'Data problem', []], ['other', 'Something else', []], ['cautious', 'Plan too cautious', []], ['early', 'Change landed early', []], ['oneoff', 'One-off, won’t last', []]],
  Recovery: [['plan', 'Plan', []], ['investigating', 'Still investigating', []], ['help', 'Needs a decision or help', ['help']], ['target', 'Target should change', ['target']]],
  State: [['active', 'active', []], ['proposed', 'proposed', []]],
  'Baseline is': [[true, 'provisional', []], [false, 'firm', []]],
  GoalAction: [['stop', 'Stop', ['stopped']], ['delete', 'Delete', ['deleted', 'remove']], ['example', 'Example', []]],
  PersonAction: [['left', 'Left', ['leave', 'leaving', 'mark as left']], ['example', 'Example', []]],
};
const LEVEL_NAME = { 'north-star': 'North star', svp: 'SVP', team: 'Team' };
const LEVEL_RANK = { 'north-star': 3, svp: 2, team: 1 };
const TYPE_WORD = { metric: 'Move a number', range: 'Keep a number in range', milestone: 'Hit dated stages' };
const SHAPE_WORD = { straight: 'Straight line', back: 'Back-loaded', stepped: 'Three steps' };
const CALL_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' };
const CAUSE_WORD = Object.fromEntries(WORDS.Cause.map(([c, w]) => [c, w]));
const RECOVERY_WORD = Object.fromEntries(WORDS.Recovery.map(([c, w]) => [c, w]));

const MUST = new Set(['required-empty', 'not-a-number', 'formula', 'precision', 'impossible-number', 'unknown-word', 'unknown-ref', 'ambiguous-ref', 'conflicting-refs', 'bad-key', 'duplicate', 'type-unclear', 'plan-order', 'stage-format', 'week-wrong', 'checkin-incomplete', 'cant-change', 'not-allowed', 'removal-refused', 'loop']);
const NOTE = new Set(['by-name', 'default', 'date-as-week', 'folded', 'same-name', 'left-alone', 'replaces', 'as-recorded', 'example']);
const levelOf = (k) => (MUST.has(k) ? 'must' : NOTE.has(k) ? 'note' : 'check');
// questions that leave their row out until answered
const HOLDS_ROW = new Set(['near-ref', 'near-word', 'other-goal', 'totals-row']);

// ---------- one run of the engine ----------
export function planChanges(ctx, input) {
  const { S1, W } = ctx;
  const create = input.given?.mode === 'create';
  const now = input.given?.at ?? W.builtFor;
  const cyc = W.cycle;
  const START = S1.START, WEEKS = S1.WEEKS;
  const ended = S1.dayNum(now) > S1.LAST_DAY;
  const week = S1.currentWeek(now);
  const yearName = cyc.name;
  const answers = input.answers || {};
  const stoppedKeys = new Set(input.given?.stopped || []);

  // the workspace's records (as it stood at builtFor)
  const people = W.people.filter((p) => !p.removedAt).map((p) => ({ ...p }));
  const teams = W.teams.map((t) => ({ ...t }));
  const goals = W.goals.filter((g) => !g.removedAt).map((g) => (stoppedKeys.has(g.key) ? { ...g, stoppedAt: now } : g));
  const checkIns = W.checkIns.filter((c) => !c.removedAt);
  const ckByGoal = new Map();
  for (const c of checkIns) { if (!ckByGoal.has(c.goalId)) ckByGoal.set(c.goalId, []); ckByGoal.get(c.goalId).push(c); }
  const personById = new Map(people.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const goalByKey = new Map(goals.map((g) => [g.key, g]));
  const actor = personById.get(input.actor);
  const isAdmin = create || !!actor?.admin;

  let counter = 0;
  const newId = (prefix) => `${prefix}_c${++counter}`;

  const issues = [];
  let seq = 0;
  const raise = (sheet, row, kind, column, value, message, extra = {}) => {
    const iss = { sheet, row, kind, level: levelOf(kind), group: groupId(kind, SHEETS[sheet].name, column ?? '', value ?? ''), message, seq: seq++, ...extra };
    const a = answers[iss.group];
    if (iss.level === 'check' && a !== undefined && a !== 'leave') { iss.answered = true; return iss; }
    issues.push(iss);
    return iss;
  };
  const answerOf = (iss) => answers[iss.group];

  // ---------- the sheets in the file ----------
  const tables = {};
  tables[input.sheet] = input.rows;
  for (const [k, v] of Object.entries(input.given?.sheets || {})) tables[k] = v;

  // headers: lower case, matched exactly, by another name, or near
  const read = {};
  for (const sk of SHEET_ORDER) {
    if (!tables[sk]) continue;
    const def = SHEETS[sk];
    const headers = [];
    for (const r of tables[sk]) for (const h of Object.keys(r)) if (!headers.includes(h)) headers.push(h);
    const cands = def.cols.map((c) => ({ key: c, names: [c, ...(def.also[c] || [])] }));
    const map = new Map(); // column -> [header]
    const nearHeaders = [];
    for (const h of headers) {
      const lh = h.toLowerCase().trim();
      const n = near(lh, cands);
      if (n.exact) { if (!map.has(n.exact.key)) map.set(n.exact.key, []); map.get(n.exact.key).push(h); }
      else if (n.near) nearHeaders.push({ h, lh, col: n.near.key });
    }
    const colOf = {};
    for (const nh of nearHeaders) {
      const iss = raise(sk, 1, 'near-header', 'Header', nh.lh, `A column on ${def.name} is called ${Q(nh.lh)}. Read it as ${nh.col}?`);
      const a = answerOf(iss);
      if (a === 'use' || a === 'read') { if (!map.has(nh.col)) map.set(nh.col, []); map.get(nh.col).push(nh.h); }
      else colOf[`waits:${nh.col}`] = true;
    }
    for (const [col, hs] of map) {
      if (hs.length > 1) {
        const lhs = hs.map((h) => h.toLowerCase().trim());
        const iss = raise(sk, 1, 'two-columns', 'Header', col, `Two columns on ${def.name} are read as ${col}: ${lhs.map(Q).join(' and ')}. Which should be read?`);
        const a = answerOf(iss);
        if (a && typeof a === 'object' && a.value) colOf[col] = hs.find((h) => h.toLowerCase().trim() === a.value) ?? null;
        else colOf[`waits:${col}`] = true;
      } else colOf[col] = hs[0];
    }
    // the sheet is known by the columns read: rows of a sheet that can't be known aren't read
    const got = (col) => !!colOf[col];
    const known = sk === 'goals' ? (got('Goal') || got('Key')) && ['Owner', 'Owner email', 'Type', 'Target', 'Level', 'Action'].some(got)
      : sk === 'checkIns' ? got('Week') && ['Value', 'Stages', 'Call'].some(got)
      : sk === 'people' ? got('Email') || (got('Name') && ['Team', 'Job title', 'Admin', 'ID'].some(got)) : true;
    const unread = false; // the case names its sheet
    if (Object.keys(colOf).some((k) => k.startsWith('waits:'))) colOf.waiting = true;
    read[sk] = { colOf, rows: unread ? [] : tables[sk].map((r, i) => ({ line: i + 2, raw: r })) };
  }
  const cellOf = (sk, r, col) => {
    const h = read[sk].colOf[col];
    if (!h) return undefined;
    const v = r.raw[h];
    return v === undefined || v === null ? undefined : String(v);
  };
  const has = (sk, r, col) => cellOf(sk, r, col) !== undefined;
  const waits = (sk, col) => !!read[sk]?.colOf[`waits:${col}`];

  // ---------- reading numbers, words, weeks ----------
  const unitSame = (word, unit) => {
    const norm = (u) => { const x = fold(u).replace(/ /g, ''); const m = { min: 'min', mins: 'min', minute: 'min', minutes: 'min', day: 'day', days: 'day', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', ms: 'ms', week: 'week', weeks: 'week' }; return m[x] ?? x; };
    if (!unit) return false;
    if (word === '%') return unit.trim() === '%';
    return norm(word) === norm(unit);
  };
  // { value } | { formula } | { notNumber } | { hasWords, value } ; comma decimal flagged
  function parseNumber(cell, unit) {
    let t = String(cell).trim().replace(/^'/, '');
    if (t.startsWith('=')) return { formula: true };
    const m = t.match(/^([+-]?[0-9][0-9.,]*)\s*(.*)$/);
    if (!m) return { notNumber: true };
    let digits = m[1];
    const rest = m[2].trim();
    let comma = false;
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits)) digits = digits.replace(/,/g, '');
    else if (/^[+-]?\d+,\d+$/.test(digits)) { digits = digits.replace(',', '.'); comma = true; }
    if (!/^[+-]?\d+(\.\d+)?$/.test(digits)) return { notNumber: true };
    const value = Number(digits);
    if (rest && !unitSame(rest, unit)) return { hasWords: true, value, digits: m[1] };
    return { value, comma, places: typedDecimals(m[1]) };
  }
  const yearsOf = () => {
    // goal years by ISO week date: cycle week w <-> the Monday START + 7w
    const isoOf = (dayN) => { const dow = (((dayN + 3) % 7) + 7) % 7; const th = dayN - dow + 3; const y = new Date(th * 86400000).getUTCFullYear(); const jan1 = Math.floor(Date.UTC(y, 0, 1) / 86400000); return { y, w: 1 + Math.floor((th - jan1) / 7) }; };
    const weeksIn = (y) => { const d = new Date(Date.UTC(y, 11, 28)); return isoOf(Math.floor(d.getTime() / 86400000)).w; };
    const mondayOf = (y, w) => { const jan4 = Date.UTC(y, 0, 4); const dow = (new Date(jan4).getUTCDay() + 6) % 7; return Math.floor(jan4 / 86400000) - dow + 7 * (w - 1); };
    return { isoOf, weeksIn, mondayOf };
  };
  const Y = yearsOf();
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayParts = (n) => { const d = new Date(n * 86400000); return { d: d.getUTCDate(), m: MON[d.getUTCMonth()], y: d.getUTCFullYear() }; };
  const weekDates = (w) => {
    const a = dayParts(START + 7 * w), b = dayParts(START + 7 * w + 6);
    if (a.y !== b.y) return `${a.d} ${a.m} ${a.y}–${b.d} ${b.m} ${b.y}`;
    if (a.m !== b.m) return `${a.d} ${a.m}–${b.d} ${b.m} ${b.y}`;
    return `${a.d}–${b.d} ${b.m} ${b.y}`;
  };
  const cycleYear = Y.isoOf(START + 7 * 1).y;
  const weekInSentence = (w) => { const iso = Y.isoOf(START + 7 * w); return iso.y === cycleYear ? `week ${w}, ${weekDates(w)}` : `week ${iso.w} of ${iso.y}, ${weekDates(w)}`; };
  const weekWord = (w) => `Week ${w}`;
  // a week cell: { week } | { error } ; date read as week gives { week, date: true }
  function parseWeek(cell, field) {
    const t = String(cell).trim();
    let m;
    if ((m = t.match(/^(\d{4})-W(\d{1,2})$/i))) {
      const y = +m[1], w = +m[2];
      const n = Y.weeksIn(y);
      if (w < 1 || w > n) return { error: `${y} has ${n} weeks. Use ${y}-W${String(n).padStart(2, '0')}, or ${y + 1}-W01.` };
      return { week: Math.round((Y.mondayOf(y, w) - START) / 7) };
    }
    if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
      const dn = S1.dayNum(t);
      if (dn < START || dn > S1.LAST_DAY) return { error: `${Q(t)} isn’t in ${yearName}, which runs ${dayParts(START).d} ${dayParts(START).m} ${dayParts(START).y} to ${dayParts(S1.LAST_DAY).d} ${dayParts(S1.LAST_DAY).m} ${dayParts(S1.LAST_DAY).y}.` };
      return { week: Math.floor((dn - START) / 7), date: true };
    }
    if (/^-?\d+$/.test(t)) return { week: Number(t), bare: true };
    return { error: `${field} says ${Q(t)}. Write a year and a week, like ${cycleYear}-W${String(Y.isoOf(START + 7 * week).w).padStart(2, '0')}, or the week’s number.` };
  }
  function readWord(sk, line, column, cell, list) {
    const t = String(cell).trim();
    const cands = list.map(([code, word, also]) => ({ key: code, word, names: [word, ...also] }));
    const n = near(t, cands);
    if (n.exact) return { code: n.exact.key };
    if (n.near) {
      const iss = raise(sk, line, 'near-word', column, t, `${column} says ${Q(t)}. Read it as ${n.as}?`);
      const a = answerOf(iss);
      if (a === 'use') return { code: n.near.key };
      return { held: true };
    }
    const words = list.map(([, w]) => w);
    raise(sk, line, 'unknown-word', column, t, `${column} says ${Q(t)}. Use ${listOr(words)}.`);
    return { bad: true };
  }

  // people and teams, to read names by
  const allPeople = () => people.filter((p) => !p.leftAt);
  const personCands = () => allPeople().map((p) => ({ key: p.id, names: [p.name] }));
  const teamCands = () => teams.map((t) => ({ key: t.id, names: [t.name] }));
  function readTeam(sk, line, column, cell) {
    const t = String(cell).trim();
    if (t === '—' || t === '') return { none: true };
    const n = near(t, teamCands());
    if (n.exact) return { id: n.exact.key };
    if (n.near) {
      const iss = raise(sk, line, 'near-ref', column, t, `There’s no team called ${Q(t)}. Did you mean ${teamById.get(n.near.key).name}?`);
      const a = answerOf(iss);
      if (a === 'use') return { id: n.near.key };
      return { held: true };
    }
    raise(sk, line, 'unknown-ref', column, t, `There’s no team called ${Q(t)}.${isAdmin ? '' : ' Ask an admin to add it, or check the spelling.'}`);
    return { bad: true };
  }

  // ---------- People sheet first (IDs: a team the row adds, then the person) ----------
  const peopleRows = [];
  const fileEmails = new Map();
  if (read.people) {
    for (const r of read.people.rows) {
      const email = cellOf('people', r, 'Email');
      if (email) fileEmails.set(email.trim().toLowerCase(), r);
    }
  }
  const newPeople = []; // { id, name, email, teamId, admin, line }
  const personItems = [];
  let adminsMade = 0;
  let removalRows = { stop: 0, delete: 0, left: 0 };
  if (read.people) {
    for (const r of read.people.rows) {
      const line = r.line;
      const pr = { line, issues: [] };
      const email = cellOf('people', r, 'Email')?.trim();
      const idCell = cellOf('people', r, 'ID')?.trim();
      const name = cellOf('people', r, 'Name')?.trim();
      let person = null;
      if (idCell) {
        person = personById.get(idCell);
        if (!person) { raise('people', line, 'bad-key', 'ID', idCell, `There’s no person with ID ${idCell}. Leave ID empty to add someone.`); pr.stop = true; }
      } else if (email) person = people.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase()) || null;
      if (pr.stop) { peopleRows.push(pr); continue; }
      if (!person) {
        // someone new
        if (!isAdmin) { raise('people', line, 'not-allowed', '', '', 'Only an admin can add people.'); peopleRows.push(pr); continue; }
        if (!name) { raise('people', line, 'required-empty', 'Name', '', 'Add their name.'); }
        if (!email) { raise('people', line, 'required-empty', 'Email', '', name ? `Add ${name}’s email: everyone new needs one.` : 'Add their email.'); }
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) raise('people', line, 'unknown-word', 'Email', '', `${Q(email)} doesn’t look like an email.`);
        let teamId = null;
        const teamCell = cellOf('people', r, 'Team');
        if (teamCell && teamCell.trim()) {
          const t = readTeam('people', line, 'Team', teamCell);
          if (t.id) teamId = t.id; else if (!t.none) pr.stop = true;
        }
        if (name) {
          const n = near(name, personCands());
          if (n.exact || n.near) {
            const p = personById.get((n.exact || n.near).key);
            const tell = p.teamId ? teamById.get(p.teamId)?.name : p.email;
            if (create) raise('people', line, 'same-name', '', '', `${p.name}${tell ? ` (${tell})` : ''} is already here. That’s fine: their email tells you apart, and Faro shows a team or job title beside the name.`);
            else raise('people', line, 'same-person', 'Name', `${name} ${email ?? ''}`, `${Q(name)} (${email}) looks like ${p.name}${tell ? ` (${tell})` : ''}, who is already here.`);
          }
        }
        const adminCell = cellOf('people', r, 'Admin');
        let admin = false;
        if (adminCell && adminCell.trim()) { const w = readWord('people', line, 'Admin', adminCell, WORDS.Admin); if (w.code !== undefined) admin = w.code; }
        if (admin) adminsMade++;
        const np = { id: newId('p'), name, email: email?.toLowerCase(), teamId, admin, line };
        newPeople.push(np);
        if (email) fileEmails.set(email.toLowerCase(), np);
        const diffs = [['Person', '—', name], ...(email ? [['Email', '—', email.toLowerCase()]] : [])];
        personItems.push({ sheet: 'People', line, target: '', name, kind: 'new person', diffs, row: pr, record: () => ({ id: np.id, name, role: '', initials: name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(), teamId, admin, email: np.email ?? null }) });
        pr.newPerson = np;
      } else {
        if (!isAdmin) { raise('people', line, 'not-allowed', '', '', 'Only an admin can change people.'); peopleRows.push(pr); continue; }
        const diffs = [];
        const after = { ...person };
        if (name !== undefined && name && name !== person.name) { diffs.push(['Name', person.name, name]); after.name = name; }
        if (email !== undefined && email && email.toLowerCase() !== (person.email ?? '')) { diffs.push(['Email', person.email || '—', email.toLowerCase()]); after.email = email.toLowerCase(); }
        const job = cellOf('people', r, 'Job title');
        if (job !== undefined && job.trim() !== (person.role ?? '')) { diffs.push(['Job title', person.role || '—', job.trim() || '—']); after.role = job.trim(); }
        const teamCell = cellOf('people', r, 'Team');
        if (teamCell !== undefined) {
          const t = teamCell.trim() ? readTeam('people', line, 'Team', teamCell) : { none: true };
          const tid = t.id ?? (t.none ? null : undefined);
          if (tid === undefined) pr.stop = true;
          else if (tid !== (person.teamId ?? null)) { diffs.push(['Team', person.teamId ? teamById.get(person.teamId).name : '—', tid ? teamById.get(tid).name : '—']); after.teamId = tid; }
        }
        const adminCell = cellOf('people', r, 'Admin');
        if (adminCell !== undefined && adminCell.trim()) {
          const w = readWord('people', line, 'Admin', adminCell, WORDS.Admin);
          if (w.code !== undefined && w.code !== !!person.admin) {
            if (!w.code && person.admin && people.filter((p) => p.admin && !p.leftAt).length === 1) raise('people', line, 'cant-change', 'Admin', '', 'The only admin stays one: make someone else an admin first.');
            diffs.push(['Admin', person.admin ? 'Yes' : 'No', w.code ? 'Yes' : 'No']); after.admin = w.code;
            if (w.code) adminsMade++;
          } else if (w.code === undefined) pr.stop = true;
        }
        if (!pr.stop && diffs.length) personItems.push({ sheet: 'People', line, target: '', name: person.name, kind: 'person', diffs, row: pr, before: person, record: () => after });
        else if (!pr.stop) pr.unchanged = true;
      }
      peopleRows.push(pr);
    }
    if (adminsMade >= 3) raise('people', read.people.rows[0].line, 'many-admins', 'Admin', '', `${adminsMade} people would become admins. Is that right?`);
  }
  const findPersonByEmail = (e) => {
    const l = e.toLowerCase();
    return people.find((p) => p.email && p.email.toLowerCase() === l) || newPeople.find((p) => p.email === l) || null;
  };
  const nameOf = (id) => personById.get(id)?.name ?? newPeople.find((p) => p.id === id)?.name ?? id;
  const teamOfPerson = (id) => personById.get(id)?.teamId ?? newPeople.find((p) => p.id === id)?.teamId ?? null;

  // ---------- Goals sheet ----------
  const goalRows = [];
  const goalItems = [];
  const removalItems = [];
  if (read.goals) {
    const rs = read.goals.rows;
    // duplicates found before any row is read: the same key, ID, Ref, or name and Team cell
    const dupLines = new Map();
    const seen = (label, keyOf, message) => {
      const m = new Map();
      for (const r of rs) { const k = keyOf(r); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(r); } }
      for (const [k, list] of m) if (list.length > 1) for (const r of list) {
        if (!dupLines.has(r.line)) dupLines.set(r.line, []);
        dupLines.get(r.line).push({ label, k, lines: list.map((x) => x.line), message: message(k, list) });
      }
    };
    const rowsWords = (list) => listAnd(list.map((x) => String(x.line)));
    seen('Key', (r) => cellOf('goals', r, 'Key')?.trim() || null, (k, l) => `Key ${k} is on rows ${rowsWords(l)}. Give each goal one row.`);
    seen('ID', (r) => (!cellOf('goals', r, 'Key')?.trim() && cellOf('goals', r, 'ID')?.trim()) || null, (k, l) => `${Q(k)} is on rows ${rowsWords(l)}. Give each goal one row.`);
    seen('Ref', (r) => cellOf('goals', r, 'Ref')?.trim() || null, (k, l) => `Ref ${Q(k)} is on rows ${rowsWords(l)}. Give each row its own Ref.`);
    seen('Goal', (r) => (!cellOf('goals', r, 'Key')?.trim() && !cellOf('goals', r, 'ID')?.trim() && cellOf('goals', r, 'Goal')?.trim()) ? `${fold(cellOf('goals', r, 'Goal'))}|${fold(cellOf('goals', r, 'Team') ?? '')}` : null,
      (k, l) => `${Q(cellOf('goals', l[0], 'Goal').trim())} is on rows ${rowsWords(l)}. Give each goal one row.`);

    for (const r of rs) {
      const line = r.line;
      const gr = { line, r, issuesStart: issues.length };
      goalRows.push(gr);
      const c = (col) => cellOf('goals', r, col);
      if (dupLines.has(line)) {
        for (const d of dupLines.get(line)) raise('goals', line, 'duplicate', d.label, d.label === 'Ref' ? d.k : '', d.message);
        gr.stop = true; continue;
      }
      // key, ID and Action
      let goal = null;
      const keyCell = c('Key')?.trim();
      const idCell = c('ID')?.trim();
      if (keyCell) {
        if (!/^G-[1-9]\d*$/i.test(keyCell)) { raise('goals', line, 'bad-key', 'Key', keyCell, `Key ${Q(keyCell)} should look like G-12.`); gr.stop = true; continue; }
        goal = goalByKey.get(keyCell.toUpperCase());
        if (!goal) { raise('goals', line, 'bad-key', 'Key', keyCell, `There’s no goal with key ${keyCell} in ${yearName}. Leave Key and ID empty to add a new goal.`); gr.stop = true; continue; }
      } else if (idCell) {
        goal = goalById.get(idCell);
        if (!goal) { raise('goals', line, 'bad-key', 'ID', idCell, `There’s no goal with ID ${idCell} in ${yearName}. Leave ID empty to add a new goal.`); gr.stop = true; continue; }
      }
      const actionCell = c('Action')?.trim();
      let action = null;
      if (actionCell) {
        const w = readWord('goals', line, 'Action', actionCell, WORDS.GoalAction);
        if (w.code === undefined) { gr.stop = true; continue; }
        action = w.code;
        if (action === 'example') { gr.example = true; continue; }
      }
      if (goal && goal.stoppedAt) {
        raise('goals', line, 'left-alone', '', '', `${Q(goal.title)} is stopped, so its rows are left as they are.`);
        gr.leftAlone = true; continue;
      }
      if (action) {
        gr.action = action;
        removalRows[action]++;
        const reason = c('Reason')?.trim() ?? '';
        const nameCell = c('Goal')?.trim();
        if (create) { raise('goals', line, 'removal-refused', 'Action', '', `${actionCell} is for a goal already in a workspace; leave Action empty when setting one up.`); gr.stop = true; continue; }
        if (!goal) { raise('goals', line, 'removal-refused', 'Action', '', `${actionCell} needs the goal’s Key, to say which goal. To add ${Q(nameCell ?? '')} instead, leave Action empty.`); gr.stop = true; continue; }
        const changing = ['Goal', 'Level', 'Team', 'Owner', 'Owner email', 'Type', 'Unit', 'Start', 'Target', 'Limit', 'Stages', 'Feeds into', 'Feeds into key'].some((col) => { const v = c(col); return v !== undefined && v.trim() !== '' && !(col === 'Goal' && v.trim() === goal.title); });
        if (changing) { raise('goals', line, 'cant-change', 'Action', '', `A row that says ${actionCell} can’t also change the goal. Make the change, or the ${actionCell}, on its own.`); gr.stop = true; continue; }
        const cks = ckByGoal.get(goal.id) || [];
        const mayRemove = isAdmin || goal.ownerId === input.actor;
        if (action === 'stop') {
          if (!mayRemove) raise('goals', line, 'removal-refused', 'Action', '', 'Only the goal’s owner or an admin can stop it.');
          else if (!cks.length) raise('goals', line, 'removal-refused', 'Action', '', 'It has no check-ins yet: delete it instead.');
          else if (reason.length < 10) raise('goals', line, 'removal-refused', 'Action', '', 'Say why it’s stopping, in a sentence (10 characters or more).');
          else removalItems.push({ sheet: 'Goals', line, target: goal.id, name: goal.title, kind: 'stop goal', diffs: [['Status', '—', 'Stopped'], ['Why', '—', reason]], row: gr, before: goal, record: () => ({ ...goal, stoppedAt: now, stoppedBy: input.actor, stopReason: reason }) });
        } else {
          if (!mayRemove) raise('goals', line, 'removal-refused', 'Action', '', 'Only the goal’s owner or an admin can delete it.');
          else if (cks.length) raise('goals', line, 'removal-refused', 'Action', '', 'It has check-ins: stop it instead, with a reason, so its history stays.');
          else removalItems.push({ sheet: 'Goals', line, target: goal.id, name: goal.title, kind: 'delete goal', diffs: [['Goal', goal.title, '—']], row: gr, before: goal, record: () => ({ ...goal, removedAt: now, removedBy: input.actor }) });
        }
        continue;
      }
      gr.goal = goal;
      if (!goal && waits('goals', 'Goal')) { gr.stop = true; continue; } // its name waits for the header question
      const nameCell = c('Goal')?.trim();
      if (!goal && !nameCell) { raise('goals', line, 'required-empty', 'Goal', '', 'Name the goal in the Goal column.'); gr.stop = true; continue; }
      // another goal? a totals row? a goal already here?
      const ownerGiven = ['Owner', 'Owner email', 'Owner ID'].some((col) => c(col)?.trim());
      if (goal && nameCell && fold(nameCell) !== fold(goal.title)) {
        const ownerOther = true, teamOther = true;
        const iss = raise('goals', line, 'other-goal', 'Key', goal.key, `${goal.key} is ${Q(goal.title)} here, owned by ${nameOf(goal.ownerId)}. Row ${line} calls it ${Q(nameCell)}${ownerGiven && ownerOther && teamOther && c('Team')?.trim() ? ', with another owner and team' : ''}. Is it the same goal?`);
        const a = answerOf(iss);
        if (a === 'goal') { goal = null; gr.goal = null; }
        else if (a !== 'same' && a !== 'change' && a !== 'yes') { gr.held = true; continue; }
      }
      if (!goal && nameCell && /^(total|totals|sum)$/i.test(fold(nameCell)) && !ownerGiven) {
        const iss = raise('goals', line, 'totals-row', 'Goal', nameCell, `Row ${line} is called ${Q(nameCell)} and has no owner. It looks like a totals row.`);
        if (answerOf(iss) !== 'goal') { gr.held = true; continue; }
      }
      const teamCellRaw = c('Team')?.trim();
      let sameGoal = null;
      if (!goal && nameCell) {
        const fname = fold(nameCell);
        const twins = goals.filter((g) => fold(g.title) === fname);
        gr.twins = twins;
        let teamIdGuess = null;
        if (teamCellRaw) { const n = near(teamCellRaw, teamCands()); if (n.exact) teamIdGuess = n.exact.key; }
        sameGoal = twins.find((g) => (teamIdGuess ? g.teamId === teamIdGuess : false));
        if (sameGoal) {
          const iss = raise('goals', line, 'same-goal', 'Goal', nameCell, `A goal called ${Q(sameGoal.title)} is already here (${sameGoal.key}, ${teamById.get(sameGoal.teamId)?.name}). Is this a new goal, or the same one?`);
          const a = answerOf(iss);
          if (a === 'same') { goal = sameGoal; gr.goal = goal; }
        }
      }
      const isNew = !goal;
      gr.isNew = isNew;
      // the draft: start from the goal, or blank
      const d = goal ? JSON.parse(JSON.stringify(goal)) : { id: null, title: '', ownerId: null, teamId: null, level: 'team', io: 'input', guardrail: false, parentId: null, effect: null, source: '', definition: '', kind: null };
      gr.draft = d;
      let ownerOk = true;
      // owner
      const ownerEmail = c('Owner email')?.trim();
      const ownerName = c('Owner')?.trim();
      const ownerIdCell = c('Owner ID')?.trim();
      const found = [];
      if (ownerEmail) {
        const p = findPersonByEmail(ownerEmail);
        if (p) found.push({ col: 'Owner email', id: p.id });
        else {
          const ppl = allPeople().filter((x) => x.email);
          const local = ownerEmail.split('@')[0], dom = ownerEmail.split('@')[1];
          const n = near(local, ppl.filter((x) => x.email.split('@')[1] === dom).map((x) => ({ key: x.id, names: [x.email.split('@')[0]] })));
          if (n.near) { raise('goals', line, 'near-ref', 'Owner email', ownerEmail, `No one here has ${ownerEmail}. Did you mean ${personById.get(n.near.key).email}?`); gr.held = true; }
          else raise('goals', line, 'unknown-ref', 'Owner email', ownerEmail, `No one here has the email ${ownerEmail}. Add them on the People sheet, or check it.`);
          ownerOk = false;
        }
      }
      if (ownerIdCell) {
        const p = personById.get(ownerIdCell) || newPeople.find((x) => x.id === ownerIdCell);
        if (p) found.push({ col: 'Owner ID', id: p.id });
        else { raise('goals', line, 'bad-key', 'Owner ID', ownerIdCell, `There’s no person with ID ${ownerIdCell}.`); ownerOk = false; }
      }
      let byNameNote = null;
      if (ownerName && ownerName !== '—') {
        const cands = [...personCands(), ...newPeople.map((p) => ({ key: p.id, names: [p.name] }))];
        const n = near(ownerName, cands);
        if (n.exact) { found.push({ col: 'Owner', id: n.exact.key, byName: true }); }
        else if (n.many) { raise('goals', line, 'ambiguous-ref', 'Owner', ownerName, `${n.many.length} people are called ${Q(ownerName)}. Use their email instead (${n.many.map((x) => personById.get(x.key)?.email ?? '').join(' or ')}).`); ownerOk = false; }
        else if (!ownerEmail && !ownerIdCell) {
          if (n.near) {
            const iss = raise('goals', line, 'near-ref', 'Owner', ownerName, `${Q(ownerName)} isn’t here. Did you mean ${nameOf(n.near.key)}?`);
            if (answerOf(iss) === 'use') found.push({ col: 'Owner', id: n.near.key, byName: true }); else { gr.held = true; ownerOk = false; }
          } else { raise('goals', line, 'unknown-ref', 'Owner', ownerName, `${Q(ownerName)} isn’t in this workspace. Add them on the People sheet, or check the spelling.`); ownerOk = false; }
        }
      }
      const ids = [...new Set(found.map((f) => f.id))];
      if (ids.length > 1) {
        const ord = ['Owner', 'Owner email', 'Owner ID'];
        const fs2 = [...found].sort((a, b) => ord.indexOf(a.col) - ord.indexOf(b.col));
        raise('goals', line, 'conflicting-refs', 'Owner', '', `${listAnd(fs2.map((f) => f.col))} name different people (${listAnd([...new Set(fs2.map((f) => f.id))].map(nameOf))}). Change just one of them.`);
        ownerOk = false;
      } else if (ids.length === 1) {
        if (found.length === 1 && found[0].byName) byNameNote = raise('goals', line, 'by-name', '', '', `${Q(ownerName)} matched by name: ${nameOf(ids[0])}. An email column is exact.`);
        d.ownerId = ids[0];
      } else if (isNew && ownerOk && !ownerEmail && !ownerName && !ownerIdCell) {
        raise('goals', line, 'required-empty', 'Owner', '', 'A new goal needs an owner: Owner email, or Owner.');
        ownerOk = false;
      }
      const ended2 = () => gr.held || issues.some((i) => i.sheet === 'goals' && i.row === line && i.level === 'must');
      if (ended2()) { gr.stop = true; continue; }
      // team
      let teamOk = true;
      if (teamCellRaw !== undefined && teamCellRaw !== '' ) {
        const t = readTeam('goals', line, 'Team', teamCellRaw);
        if (t.id) d.teamId = t.id; else if (t.none) d.teamId = isNew ? null : d.teamId; else { teamOk = false; if (t.held) gr.held = true; }
      } else if (isNew && d.ownerId) {
        const tid = teamOfPerson(d.ownerId);
        if (tid) { d.teamId = tid; raise('goals', line, 'default', 'Team', '', `Team: ${teamById.get(tid).name} (the owner’s team; the row gave none).`); }
      }
      if (ended2()) { gr.stop = true; continue; }
      // level
      const levelCell = c('Level')?.trim();
      if (levelCell) { const w = readWord('goals', line, 'Level', levelCell, WORDS.Level); if (w.code) d.level = w.code; else { gr.bad = true; if (w.held) gr.held = true; } }
      if (ended2()) { gr.stop = true; continue; }
      // type
      const typeCell = c('Type')?.trim();
      let kind = goal ? goal.kind : null;
      if (typeCell) {
        const w = readWord('goals', line, 'Type', typeCell, WORDS.Type);
        if (w.code) {
          if (goal && w.code !== goal.kind) { raise('goals', line, 'cant-change', 'Type', '', 'A goal’s type can’t change. Add a new goal instead.'); gr.bad = true; }
          kind = w.code;
        } else { gr.bad = true; if (w.held) gr.held = true; }
      } else if (isNew) {
        const filled = [];
        if (c('Start')?.trim() || c('Target')?.trim()) filled.push(['metric', 'Start and Target']);
        if (c('Limit')?.trim()) filled.push(['range', 'Limit']);
        if (c('Stages')?.trim()) filled.push(['milestone', 'Stages']);
        if (filled.length === 1) { kind = filled[0][0]; raise('goals', line, 'default', 'Type', '', `Type: ${kind} (from ${filled[0][1]}; the row gave none).`); }
        else if (filled.length === 0) { raise('goals', line, 'type-unclear', 'Type', '', 'Type is empty and the row has no Start and Target, Limit or Stages. Add them, or say the type.'); gr.bad = true; }
        else { raise('goals', line, 'type-unclear', 'Type', '', `Type is empty and the row has ${filled.map((f) => f[1]).join(', and ')}. Say metric, range or milestone.`); gr.bad = true; }
      }
      if (isNew) d.kind = kind;
      if (ended2()) { gr.stop = true; continue; }
      // unit
      const unitCell = c('Unit');
      if (unitCell !== undefined) d.unit = unitCell.trim();
      if ((kind === 'metric' || kind === 'range') && !gr.bad) {
        if ((isNew && !d.unit) || (!isNew && unitCell !== undefined && !unitCell.trim() && goal.unit)) {
          if (!ctx.noUnitAsked) { ctx.noUnitAsked = true; }
          raise('goals', line, 'no-unit', 'Unit', '', 'This number has no unit. Is it a plain count?');
        }
      }
      // numbers
      const numCols = kind === 'metric' ? ['Start', 'Target'] : kind === 'range' ? ['Limit', 'Margin'] : [];
      const nums = {};
      let numBad = false;
      const decCell = c('Decimals')?.trim();
      let decimals = goal ? goal.decimals : null;
      if (decCell) { if (/^[0-3]$/.test(decCell)) decimals = +decCell; else { raise('goals', line, 'unknown-word', 'Decimals', '', `Decimals says ${Q(decCell)}. Use 0, 1, 2 or 3.`); numBad = true; } }
      const typedPlaces = [];
      for (const col of [...numCols, 'Effect']) {
        const cell = c(col);
        if (cell === undefined || !cell.trim()) continue;
        if (col === 'Limit') {
          const parts = cell.trim().split(/\s*(?:–|—|\bto\b|(?<=\d)\s*-\s*(?=\d))\s*/).filter(Boolean);
          const vals = [];
          for (const p of parts) { const pn = parseNumber(p, d.unit); if (pn.value === undefined || pn.hasWords) { raise('goals', line, 'not-a-number', 'Limit', '', `${Q(cell.trim())} isn’t a number. Type digits only, like ${exampleNumber(decimals ?? 1)}.`); numBad = true; break; } vals.push(pn.value); typedPlaces.push(pn.places ?? 0); }
          nums.Limit = vals;
          continue;
        }
        const pn = parseNumber(cell, d.unit);
        if (pn.formula) { raise('goals', line, 'formula', col, '', `${col} holds a formula (${Q(cell.trim())}), not a number. In Excel, copy the column and paste it as values.`); numBad = true; continue; }
        if (pn.notNumber) { raise('goals', line, 'not-a-number', col, '', `${Q(cell.trim())} isn’t a number. Type digits only, like ${exampleNumber(col === 'Effect' ? 1 : decimals ?? typedPlaces.reduce((a, b) => Math.max(a, b), 0))}.`); numBad = true; continue; }
        if (pn.hasWords) { raise('goals', line, 'not-a-number', col, '', `${Q(cell.trim())} has words in it. Type the number only, like ${pn.digits}; ${d.unit ? `this goal counts ${d.unit}` : 'the unit goes in Unit'}.`); numBad = true; continue; }
        if (pn.comma) raise('goals', line, 'decimal-comma', '', '', `${Q(cell.trim())} was read as ${pn.value}: a comma as the decimal mark.`);
        nums[col] = pn.value;
        if (col !== 'Effect' && col !== 'Margin') typedPlaces.push(pn.places);
        nums[`${col}:places`] = pn.places;
      }
      if (decimals === null || decimals === undefined) decimals = Math.min(3, typedPlaces.reduce((a, b) => Math.max(a, b), 0));
      if (kind === 'metric' || kind === 'range') d.decimals = decimals;
      for (const col of ['Start', 'Target', 'Margin']) {
        if (nums[col] === undefined) continue;
        if (nums[`${col}:places`] > decimals) {
          const shown = fixed(nums[col], decimals);
          raise('goals', line, 'precision', col, '', `${c(col).trim()} has ${placesWords(nums[`${col}:places`])}, but this goal keeps ${placesWords(decimals)}, so it would show as ${shown}. Type ${shown}, or keep ${placesWords(nums[`${col}:places`])} for this goal.`);
          numBad = true;
        }
      }
      if (ended2()) { gr.stop = true; continue; }
      // weeks: From / Plan from week, To / Due week
      let fromW = null, toW = null, weeksBad = false;
      const weekPair = (a, b, cur) => {
        const ca = c(a)?.trim(), cb = c(b)?.trim();
        const ra = ca ? parseWeek(ca, a) : null, rb = cb ? parseWeek(cb, b) : null;
        for (const [col, rr, cell] of [[a, ra, ca], [b, rb, cb]]) {
          if (!rr) continue;
          if (rr.error) { raise('goals', line, 'week-wrong', col, '', rr.error); weeksBad = true; return undefined; }
          if (rr.date) raise('goals', line, 'date-as-week', '', '', `${Q(cell)} was read as week ${rr.week}.`);
        }
        if (ra && rb && ra.week !== rb.week) {
          const da = ra.week !== cur, db = rb.week !== cur;
          if (da && db) { raise('goals', line, 'week-wrong', a, '', `${a} says ${ca} and ${b} says ${cb}. Change just one of them.`); weeksBad = true; return undefined; }
          return da ? ra.week : rb.week;
        }
        return ra ? ra.week : rb ? rb.week : null;
      };
      if (kind === 'metric') {
        const curFrom = goal?.plan?.fromWeek ?? 0, curTo = goal?.plan?.endWeek ?? WEEKS;
        const f = weekPair('From', 'Plan from week', curFrom);
        const t = weekPair('To', 'Due week', curTo);
        fromW = f; toW = t;
      }
      // stages
      let stages = null;
      const stagesCell = kind === 'milestone' ? c('Stages')?.trim() : undefined;
      if (stagesCell) {
        stages = [];
        const bits = stagesCell.split(';').map((s) => s.trim()).filter(Boolean);
        for (const b of bits) {
          const at = b.lastIndexOf('@');
          if (at < 0) { raise('goals', line, 'stage-format', 'Stages', '', `${Q(b)} has no week. Write it as Name@week, like Pilot@52.`); stages = null; break; }
          const nm = b.slice(0, at).trim(); const wk = b.slice(at + 1).trim();
          if (!nm) { raise('goals', line, 'stage-format', 'Stages', '', 'Every stage needs a name.'); stages = null; break; }
          const pw = parseWeek(wk, 'Stages');
          if (pw.error) { raise('goals', line, 'stage-format', 'Stages', '', `${Q(b)}: ${pw.error}`); stages = null; break; }
          if (pw.date) raise('goals', line, 'date-as-week', '', '', `${Q(wk)} was read as week ${pw.week}.`);
          if (pw.week < 1 || pw.week > WEEKS) { raise('goals', line, 'stage-format', 'Stages', '', `${Q(nm)} needs a due week between 1 and ${WEEKS}: it says ${Q(wk)}.`); stages = null; break; }
          stages.push({ name: nm, dueWeek: pw.week });
        }
        if (stages) {
          for (let i = 0; stages && i < stages.length; i++) for (let j = i + 1; stages && j < stages.length; j++) if (fold(stages[i].name) === fold(stages[j].name)) {
            raise('goals', line, 'stage-format', 'Stages', '', `Two stages are called ${Q(stages[i].name)}. Give each its own name, such as ${Q(`${stages[j].name} review`)}.`); stages = null; break;
          }
        }
        if (!stages) numBad = true;
      }
      if (ended2()) { gr.stop = true; continue; }
      // past stages
      let pastDone = null;
      if (stages && isNew) {
        const past = stages.filter((s) => s.dueWeek < week);
        if (past.length) {
          const list = past.map((s) => `${s.name}@${s.dueWeek}`).join(', ');
          const n = past.length;
          const msg = create
            ? `${plural(n, 'stage', 'stages')} of ${Q(nameCell)} ${n === 1 ? 'is' : 'are'} due before this week (week ${week}): ${list}, so it would start late.`
            : `${plural(n, 'stage', 'stages')} of ${Q(nameCell)} ${n === 1 ? 'is' : 'are'} due before this week (week ${week}): ${list}. ${n === 1 ? 'Is it' : 'Are they'} done?`;
          const iss = raise('goals', line, 'past-stage', 'Stages', '', msg);
          const a = answerOf(iss);
          if (a === 'from-now') {
            const latest = Math.max(...stages.map((s) => s.dueWeek));
            const scale = Math.min(1, (WEEKS - week) / latest);
            for (const s of stages) s.dueWeek = Math.min(WEEKS, week + Math.max(1, Math.round(s.dueWeek * scale)));
          } else if (a === 'done') pastDone = past;
        }
      }
      if (ended2()) { gr.stop = true; continue; }
      // state
      const stateCell = c('State')?.trim();
      let state = goal ? (goal.proposedAt ? 'proposed' : 'active') : null;
      if (stateCell) { const w = readWord('goals', line, 'State', stateCell, WORDS.State); if (w.code) state = w.code; else gr.bad = true; }
      if (isNew && !stateCell && !create && !isAdmin && d.ownerId && d.ownerId !== input.actor) {
        const iss = raise('goals', line, 'for-someone-else', 'State', 'for-someone-else', `${Q(nameCell)} is for ${nameOf(d.ownerId)} and would start as active. Is that what you mean?`);
        const a = answerOf(iss);
        state = a === 'proposed' || a === 'no' ? 'proposed' : 'active';
      }
      if (isNew && !state) state = 'active';
      d.state = state;
      // baseline
      const bpCell = c('Baseline period');
      const biCell = c('Baseline is')?.trim();
      let baseline = goal?.baseline ?? null;
      if (bpCell !== undefined && bpCell.trim()) {
        if (bpCell.trim().length > 60) { raise('goals', line, 'impossible-number', 'Start', '', 'The baseline’s period can be at most 60 characters.'); numBad = true; }
        else baseline = { ...(baseline || {}), period: bpCell.trim(), provisional: baseline?.provisional ?? false };
      }
      if (biCell) {
        const w = readWord('goals', line, 'Baseline is', biCell, WORDS['Baseline is']);
        if (w.code !== undefined) { if (baseline) baseline.provisional = w.code; } else numBad = true;
      }
      if (ended2()) { gr.stop = true; continue; }
      // the goal form's Must fix
      if (!waits('goals', 'Goal')) {
        if (isNew && !nameCell) raise('goals', line, 'required-empty', 'Goal', '', 'Name the goal in the Goal column.');
        else if (nameCell !== undefined && nameCell.length < 3) raise('goals', line, 'required-empty', 'Goal', '', 'Give the goal a name of at least three characters.');
        else if (nameCell && nameCell.length > 80) raise('goals', line, 'required-empty', 'Goal', '', `Keep the name to 80 characters or fewer: it has ${nameCell.length}.`);
      }
      if (nameCell) d.title = nameCell;
      if (isNew && d.ownerId && !d.teamId && teamOk && !teamCellRaw) raise('goals', line, 'required-empty', 'Team', '', `${nameOf(d.ownerId)} isn’t in a team. Choose the team this goal is for.`);
      if (kind === 'metric' && !numBad) {
        const startCell = c('Start'), targetCell = c('Target');
        const start = nums.Start !== undefined ? nums.Start : startCell !== undefined && !startCell.trim() ? null : goal?.plan?.start ?? null;
        let target = nums.Target !== undefined ? nums.Target : targetCell !== undefined && !targetCell.trim() ? null : goal ? (goal.targetUnset ? null : goal.plan?.target) : null;
        if (start === null && !waits('goals', 'Start')) { raise('goals', line, 'required-empty', 'Start', '', isNew ? 'Enter where it starts today.' : 'Enter where it starts.'); numBad = true; }
        if (target === null && !waits('goals', 'Target')) {
          if (state === 'proposed') d.targetUnset = true;
          else { raise('goals', line, 'required-empty', 'Target', '', 'Enter the target.'); numBad = true; }
        }
        if (start !== null && target !== null && start === target) { raise('goals', line, 'impossible-number', 'Target', '', `The target is the same as today (${numWords(start, d.unit, decimals)}). To hold a number where it is, make this a number to keep in range.`); numBad = true; }
        const fromWeek = fromW === undefined ? undefined : fromW ?? (goal ? goal.plan?.fromWeek : (create ? 0 : week));
        const endWeek = toW === undefined ? undefined : toW ?? (goal ? goal.plan?.endWeek : undefined);
        if (!weeksBad && fromWeek !== undefined && endWeek !== undefined && endWeek !== null && endWeek <= (fromWeek ?? 0)) {
          const toCol = 'Due week';
          raise('goals', line, 'plan-order', toCol, '', `To (${weekInSentence(endWeek)}) isn’t after From (${weekInSentence(fromWeek ?? 0)}). The plan has to run forwards.`);
          numBad = true;
        }
        if (!numBad && !weeksBad) {
          const shapeCell = c('Plan')?.trim();
          let shape = goal?.plan?.shape ?? 'straight';
          if (shapeCell) { const w = readWord('goals', line, 'Plan', shapeCell, WORDS.Plan); if (w.code) shape = w.code; else numBad = true; }
          d.plan = { ...(goal?.plan || {}), start, target: target ?? start, shape };
          if (fromWeek !== null && fromWeek !== undefined) d.plan.fromWeek = fromWeek;
          if (endWeek !== null && endWeek !== undefined) d.plan.endWeek = endWeek; else if (toW === null && goal) { /* keep */ }
          if (baseline) d.baseline = { value: start, period: baseline.period, provisional: baseline.provisional };
        }
      }
      if (kind === 'range' && !numBad) {
        const lim = nums.Limit ?? (goal ? null : undefined);
        const mustCell = c('Must stay')?.trim();
        let bound = goal?.range?.bound ?? 'atMost';
        if (mustCell) { const w = readWord('goals', line, 'Must stay', mustCell, WORDS['Must stay']); if (w.code) bound = w.code; else numBad = true; }
        if (isNew && (!lim || !lim.length)) { raise('goals', line, 'required-empty', 'Limit', '', 'Enter the limit.'); numBad = true; }
        const margin = nums.Margin ?? goal?.range?.margin ?? 0;
        if (margin < 0) { raise('goals', line, 'impossible-number', 'Margin', '', 'Enter a warning margin of zero or more, or leave it empty.'); numBad = true; }
        if (!numBad) {
          const r = { ...(goal?.range || {}), bound, margin };
          if (lim && lim.length === 2) { r.bound = 'between'; r.lower = Math.min(...lim); r.limit = Math.max(...lim); }
          else if (lim && lim.length === 1) r.limit = lim[0];
          d.range = r;
        }
      }
      if (kind === 'milestone') {
        if (isNew && !stagesCell && !numBad) { raise('goals', line, 'required-empty', 'Stages', '', 'Add at least one stage.'); numBad = true; }
        if (stages) d.stagesDraft = stages;
      }
      if (c('Effect') !== undefined) d.effect = nums.Effect ?? null;
      for (const [col, f] of [['Why it helps', 'whyHelps'], ['Source', 'source'], ['Definition', 'definition']]) { const v = c(col); if (v !== undefined) d[f] = v.trim(); }
      // same name elsewhere: said
      if (isNew && nameCell && gr.twins?.length) {
        const t = gr.twins[0];
        raise('goals', line, 'same-name', '', '', `Another goal is called ${Q(t.title)} (${t.key}, ${teamById.get(t.teamId)?.name}). That’s allowed; Faro shows each one’s key beside the title so people can tell them apart.`);
      }
      // the form's questions
      if (kind === 'metric' && !numBad && d.plan) {
        const { start, target } = d.plan;
        const unit = d.unit;
        const time = /^(days?|hours?|hrs?|mins?|minutes?|weeks?|secs?|seconds?|ms)$/i.test(unit || '');
        const money = /usd|gbp|eur|\$|£|€/i.test(unit || '');
        for (const [col, v, word] of [['Start', start, 'start'], ['Target', d.targetUnset ? null : target, 'target']]) {
          if (v === null || nums[col] === undefined) continue;
          if (v < 0 && (unit === '%' || time || money)) ask(col, 'below-zero', `${numWords(v, unit, decimals)} is below zero. That’s fine for a change or a balance. Is it right here?`);
        }
        for (const [col, v, word] of [['Start', start, 'start'], ['Target', d.targetUnset ? null : target, 'target']]) {
          if (v === null || nums[col] === undefined) continue;
          if (unit === '%' && v > 100) ask(col, 'over-100', `The ${word} is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is ${fixed(v, decimals)}% right?`);
        }
        if (!d.targetUnset && start && target && Math.sign(start) === Math.sign(target) && (nums.Start !== undefined || nums.Target !== undefined)) {
          const ratio = target / start;
          if (ratio >= 100 || ratio <= 0.01) ask('Target', 'hundredfold', `The target (${numWords(target, unit, decimals)}) is ${ratio >= 100 ? 'over 100 times' : 'under a hundredth of'} where it starts (${numWords(start, unit, decimals)}). Is that right?`);
        }
        for (const [col, v] of [['Start', start], ['Target', d.targetUnset ? null : target]]) {
          if (v === null || nums[col] === undefined) continue;
          if (Math.abs(v) >= 1e9) ask(col, 'billion', `${numWords(v, unit, decimals)} is a billion or more. Is it right?`);
        }
        if (isNew && !create && d.plan.endWeek !== undefined && d.plan.endWeek < week && !weeksBad) {
          ask2('past-plan', 'Due week', '', `${Q(d.title)} has a plan that ended in week ${d.plan.endWeek}; it’s week ${week}.`);
        }
      }
      if (kind === 'range' && !numBad && d.range) {
        const { limit, margin } = d.range;
        if (margin > 0 && margin >= limit) ask('Margin', 'margin-wide', `With a limit of ${numWords(limit, d.unit, decimals)} and a warning ${numWords(margin, d.unit, decimals)} away, it would almost always read at risk. Is ${fixed(margin, decimals)} right?`);
      }
      function ask(col, value, message) { const iss = raise('goals', line, 'odd-number', col, value, message); if (!answered(iss)) gr.asked = true; }
      function ask2(kind2, col, value, message) { const iss = raise('goals', line, kind2, col, value, message); if (!answered(iss)) gr.asked = true; }
      gr.numBad = numBad || weeksBad;
      gr.pastDone = pastDone;
      gr.nameCell = nameCell;
    }
  }
  function answered(iss) { const a = answerOf(iss); return a !== undefined && a !== 'leave'; }

  // ---------- links, once every Goals row is read ----------
  const refRows = new Map();
  for (const gr of goalRows) { const ref = gr.r && cellOf('goals', gr.r, 'Ref')?.trim(); if (ref) { if (!refRows.has(ref)) refRows.set(ref, []); refRows.get(ref).push(gr); } }
  const rowMakesItem = (gr) => gr.draft && !gr.stop && !gr.held && !gr.bad && !gr.numBad && !rowHasMust(gr);
  function rowHasMust(gr) { return issues.some((i) => i.sheet === 'goals' && i.row === gr.line && i.level === 'must' && !i.late); }
  const newGoalNames = () => goalRows.filter((gr) => gr.isNew && gr.draft && gr.nameCell);
  for (const gr of goalRows) {
    if (!gr.draft) continue;
    const line = gr.line, c = (col) => cellOf('goals', gr.r, col);
    const d = gr.draft;
    const links = [];
    const refCell = c('Feeds into ref')?.trim(), keyCell = c('Feeds into key')?.trim(), idCell = c('Feeds into ID')?.trim(), nameCell = c('Feeds into')?.trim();
    const late = { late: true };
    if (refCell) {
      const rows = refRows.get(refCell) || [];
      if (!rows.length) { raise('goals', line, 'bad-key', 'Feeds into ref', refCell, `Feeds into ref: No row on Goals has the Ref ${Q(refCell)}.`, late); gr.linkBad = true; }
      else if (rows.length > 1) { raise('goals', line, 'bad-key', 'Feeds into ref', refCell, `Feeds into ref: Ref ${Q(refCell)} is on more than one row on Goals.`, late); gr.linkBad = true; }
      else if (!rowMakesItem(rows[0])) { raise('goals', line, 'bad-key', 'Feeds into ref', refCell, `Feeds into ref: Ref ${Q(refCell)} names Goals row ${rows[0].line}, which isn’t saved: fix that row first.`, late); gr.linkBad = true; }
      else links.push({ col: 'Feeds into ref', to: { row: rows[0] } });
    }
    if (keyCell && keyCell !== '—') {
      const g = goalByKey.get(keyCell.toUpperCase());
      if (!g) { raise('goals', line, 'bad-key', 'Feeds into key', keyCell, `Feeds into key ${keyCell} isn’t a goal in ${yearName}.`, late); gr.linkBad = true; }
      else links.push({ col: 'Feeds into key', to: { goal: g } });
    }
    if (idCell && idCell !== '—') {
      const g = goalById.get(idCell);
      if (!g) { raise('goals', line, 'bad-key', 'Feeds into ID', idCell, `Feeds into ID ${idCell} isn’t a goal in ${yearName}.`, late); gr.linkBad = true; }
      else links.push({ col: 'Feeds into ID', to: { goal: g } });
    }
    if (nameCell && nameCell !== '—') {
      const cands = [...goals.filter((g) => !g.stoppedAt).map((g) => ({ key: g.id, names: [g.title], goal: g })), ...newGoalNames().filter((x) => x !== gr).map((x) => ({ key: `row:${x.line}`, names: [x.nameCell], row: x }))];
      const n = near(nameCell, cands);
      if (n.exact) links.push({ col: 'Feeds into', to: n.exact.goal ? { goal: n.exact.goal } : { row: n.exact.row } });
      else if (n.many) { raise('goals', line, 'ambiguous-ref', 'Feeds into', nameCell, `Several goals are called ${Q(nameCell)}. Use Feeds into key to say which.`, late); gr.linkBad = true; }
      else if (n.near) {
        const iss = raise('goals', line, 'near-ref', 'Feeds into', nameCell, `${Q(nameCell)} isn’t a goal here. Did you mean ${Q(n.near.names[0])}${n.near.goal ? ` (${n.near.goal.key})` : ''}?`, late);
        if (answerOf(iss) === 'use') links.push({ col: 'Feeds into', to: n.near.goal ? { goal: n.near.goal } : { row: n.near.row } });
        else gr.linkHeld = true;
      } else { raise('goals', line, 'unknown-ref', 'Feeds into', nameCell, `${Q(d.title)} feeds into ${Q(nameCell)}, which isn’t a goal in ${yearName}.`, late); gr.linkBad = true; }
    }
    const targets = links.map((l) => (l.to.goal ? l.to.goal.id : `row:${l.to.row.line}`));
    if (new Set(targets).size > 1) { raise('goals', line, 'conflicting-refs', links[0].col, '', `${links[0].col} and ${links[1].col} name different goals. Change just one of them.`, late); gr.linkBad = true; continue; }
    if (links.length) {
      const to = links[0].to;
      const toGoal = to.goal;
      if (toGoal && gr.goal && toGoal.id === gr.goal.id) { raise('goals', line, 'loop', 'Feeds into', '', 'A goal can’t feed into itself.', late); gr.linkBad = true; continue; }
      if (toGoal && gr.goal) {
        let p = toGoal, hops = 0;
        while (p && hops++ < 1000) { if (p.parentId === gr.goal.id) break; p = goalById.get(p.parentId); }
        if (p && p.parentId === gr.goal.id) { raise('goals', line, 'loop', 'Feeds into', '', `That link would make a loop: ${Q(toGoal.title)} already feeds into this goal.`, late); gr.linkBad = true; continue; }
      }
      gr.link = to;
      const toLevel = toGoal ? toGoal.level : to.row.draft.level;
      const toTitle = toGoal ? toGoal.title : to.row.draft.title;
      if (LEVEL_RANK[d.level] > LEVEL_RANK[toLevel]) {
        const cap = { 'north-star': 'A north star', svp: 'An SVP goal', team: 'A Team goal' }[d.level];
        const feeds = { 'north-star': 'nothing', svp: 'a north star', team: 'an SVP goal or a north star' }[d.level];
        const aLevel = { 'north-star': 'a north star', svp: 'an SVP goal', team: 'a Team goal' }[toLevel];
        const iss = raise('goals', line, 'feeds-lower', 'Feeds into', `${d.level}>${toLevel}`, `${cap} usually feeds ${feeds}, and ${Q(toTitle)} is ${aLevel}. Is this link right?`, late);
        if (!answered(iss)) gr.asked = true;
      }
    } else if ([refCell, keyCell, idCell, nameCell].some((x) => x !== undefined) && [refCell, keyCell, idCell, nameCell].every((x) => !x || x === '—') && !gr.linkBad && !gr.linkHeld) {
      gr.link = null; // cleared
    }
  }

  // ---------- each goal's change as a whole ----------
  const cmpNum = (a, b, dd) => (a === null || a === undefined || b === null || b === undefined ? a === b : Number(a).toFixed(dd) === Number(b).toFixed(dd));
  let needsReasonPlan = false;
  const fileReason = input.given?.reason?.trim() || '';
  for (const gr of goalRows) {
    if (!gr.draft || gr.stop || gr.held || gr.bad || gr.numBad || read.goals.colOf.waiting) continue;
    if (issues.some((i) => i.sheet === 'goals' && i.row === gr.line && i.level === 'must' && !i.late)) continue;
    const d = gr.draft, g = gr.goal, line = gr.line, c = (col) => cellOf('goals', gr.r, col);
    // where it feeds
    let parentId = g ? g.parentId : null, parentTitle = null;
    if (gr.link) { parentId = gr.link.goal ? gr.link.goal.id : `row:${gr.link.row.line}`; parentTitle = gr.link.goal ? gr.link.goal.title : gr.link.row.draft.title; }
    else if (gr.link === null) parentId = null;
    else if (g && g.parentId) parentTitle = goalById.get(g.parentId)?.title;
    d.parentId = parentId; d.parentTitle = parentTitle;
    if (!g) { gr.change = { isNew: true }; continue; }
    // changed fields
    const changed = [];
    const plan = [];
    if (d.title !== g.title) changed.push('Name');
    if (d.state !== (g.proposedAt ? 'proposed' : 'active')) changed.push('State');
    if (d.teamId !== g.teamId) changed.push('Team');
    if (d.ownerId && d.ownerId !== g.ownerId) changed.push('Owner');
    if ((d.parentId ?? null) !== (g.parentId ?? null)) changed.push('Feeds into');
    if ((d.whyHelps ?? '') !== (g.whyHelps ?? '')) changed.push('Why it helps');
    if (d.level !== g.level) changed.push('Level');
    if (!cmpNum(d.effect, g.effect, 6)) changed.push('Estimated effect');
    if ((d.source ?? '') !== (g.source ?? '')) changed.push('Data source');
    if ((d.definition ?? '') !== (g.definition ?? '')) changed.push('Definition');
    if (g.kind !== 'milestone') {
      if ((d.unit ?? '') !== (g.unit ?? '')) changed.push('Unit');
      if (d.decimals !== g.decimals) changed.push('Decimals');
    }
    if (g.kind === 'metric' && d.plan) {
      const dd = g.decimals;
      if (!cmpNum(d.plan.start, g.plan.start, dd)) plan.push('Start');
      if (!d.targetUnset !== !g.targetUnset || !cmpNum(d.plan.target, g.plan.target, dd)) plan.push('Target');
      if (d.plan.shape !== g.plan.shape) plan.push('Plan shape');
      if ((d.plan.fromWeek ?? 0) !== (g.plan.fromWeek ?? 0)) plan.push('Plan from week');
      if ((d.plan.endWeek ?? WEEKS) !== (g.plan.endWeek ?? WEEKS)) plan.push('Target due');
    }
    if (g.kind === 'range' && d.range) {
      if (d.range.bound !== g.range.bound || !cmpNum(d.range.limit, g.range.limit, 6) || !cmpNum(d.range.lower ?? null, g.range.lower ?? null, 6)) plan.push('Limit');
      if (!cmpNum(d.range.margin, g.range.margin, 6)) plan.push('Warning margin');
    }
    if (g.kind === 'milestone' && d.stagesDraft) {
      const a = d.stagesDraft.map((s) => `${s.name}@${s.dueWeek}`).join(';'), b = [...g.stages].sort((x, y) => x.dueWeek - y.dueWeek).map((s) => `${s.name}@${s.dueWeek}`).join(';');
      if (a !== b) plan.push('Stages');
    }
    if (!changed.length && !plan.length) { gr.unchanged = true; continue; }
    // who may
    if (!isAdmin && g.ownerId !== input.actor) {
      raise('goals', line, 'not-allowed', '', '', `Only ${nameOf(g.ownerId)} (its owner) or an admin can change ${Q(g.title)}.`, { late: true });
      gr.notAllowed = true; continue;
    }
    const cks = ckByGoal.get(g.id) || [];
    const planChanged = plan.length > 0;
    const reason = c('Reason')?.trim() || fileReason;
    const needs = planChanged && cks.length > 0;
    if (needs && !reason) needsReasonPlan = true;
    // the plan question
    if (planChanged && g.kind === 'metric' && d.plan) {
      const { start, target } = d.plan, os = g.plan.start, ot = g.plan.target;
      const dirOld = Math.sign(ot - os), dirNew = Math.sign(target - start);
      if (dirOld && dirNew && dirOld !== dirNew) {
        const better = dirNew > 0 ? 'higher' : 'lower';
        const iss = raise('goals', line, 'plan-question', '', 'direction', `This makes ${better} better: the target (${numWords(target, g.unit, g.decimals)}) is now ${dirNew > 0 ? 'above' : 'below'} the start (${numWords(start, g.unit, g.decimals)}). It was ${numWords(os, g.unit, g.decimals)} to ${numWords(ot, g.unit, g.decimals)}, ${dirOld > 0 ? 'higher' : 'lower'} is better.`, { late: true });
        if (!answered(iss)) gr.asked = true;
      } else {
        const w = Math.abs(ot - os), lo = Math.min(os, ot), hi = Math.max(os, ot);
        for (const [v, word] of [[start, 'start'], [target, 'target']]) {
          if (v < lo - 2 * w || v > hi + 2 * w) {
            const iss = raise('goals', line, 'plan-question', '', 'far', `The ${word} of ${numWords(v, g.unit, g.decimals)} is far outside the plan it replaces (${numWords(os, g.unit, g.decimals)} to ${numWords(ot, g.unit, g.decimals)}). Status, progress and the forecast will all be judged against it.`, { late: true });
            if (!answered(iss)) gr.asked = true;
            break;
          }
        }
      }
    }
    gr.change = { changed, plan, planChanged, needs, reason };
  }

  // ---------- Check-ins sheet ----------
  const ckRows = [];
  const ckItems = [];
  let othersReplaced = 0;
  let needsReasonCorrect = false;
  if (read.checkIns) {
    for (const r of read.checkIns.rows) {
      const line = r.line, c = (col) => cellOf('checkIns', r, col);
      const cr = { line, r };
      ckRows.push(cr);
      // the goal
      let goal = null, newRow = null;
      const ref = c('Goal ref')?.trim(), gkey = c('Goal key')?.trim(), gid = c('Goal ID')?.trim(), gname = c('Goal')?.trim();
      if (ref) {
        const rows = refRows.get(ref) || [];
        if (!rows.length) { raise('checkIns', line, 'bad-key', 'Goal ref', ref, `Goal ref: No row on Goals has the Ref ${Q(ref)}.`); continue; }
        if (rows.length > 1) { raise('checkIns', line, 'bad-key', 'Goal ref', ref, `Goal ref: Ref ${Q(ref)} is on more than one row on Goals.`); continue; }
        if (!rowMakesItem(rows[0])) { raise('checkIns', line, 'bad-key', 'Goal ref', ref, `Goal ref: Ref ${Q(ref)} names Goals row ${rows[0].line}, which isn’t saved: fix that row first.`); continue; }
        if (rows[0].goal) goal = rows[0].goal; else newRow = rows[0];
      } else if (gkey) {
        goal = goalByKey.get(gkey.toUpperCase());
        if (!goal) { raise('checkIns', line, 'bad-key', 'Goal key', gkey, `There’s no goal with key ${gkey}.`); continue; }
      } else if (gid) {
        goal = goalById.get(gid);
        if (!goal) { raise('checkIns', line, 'bad-key', 'Goal ID', gid, `There’s no goal with ID ${gid}.`); continue; }
      } else if (gname) {
        const cands = [...goals.map((g) => ({ key: g.id, names: [g.title], goal: g })), ...newGoalNames().map((x) => ({ key: `row:${x.line}`, names: [x.nameCell], row: x }))];
        const n = near(gname, cands);
        if (n.exact) { if (n.exact.goal) goal = n.exact.goal; else newRow = n.exact.row; }
        else if (n.many) { raise('checkIns', line, 'ambiguous-ref', 'Goal', gname, `There’s no goal called ${Q(gname)} that only one goal has. Add the Goal key column to be exact.`); continue; }
        else if (n.near) { raise('checkIns', line, 'near-ref', 'Goal', gname, `${Q(gname)} isn’t a goal here. Did you mean ${Q(n.near.names[0])}${n.near.goal ? ` (${n.near.goal.key})` : ''}?`); continue; }
        else { raise('checkIns', line, 'unknown-ref', 'Goal', gname, `There’s no goal called ${Q(gname)}. Add the Goal key column to be exact.`); continue; }
      } else { raise('checkIns', line, 'required-empty', 'Goal key', '', 'Say which goal: Goal key, or Goal.'); continue; }
      const gd = goal || newRow.draft;
      if (goal && goal.stoppedAt) { raise('checkIns', line, 'left-alone', '', '', `${Q(goal.title)} is stopped, so its rows are left as they are.`); continue; }
      if (goal && goal.proposedAt) { raise('checkIns', line, 'cant-change', 'Goal key', '', 'This goal is proposed, so there is nothing to check in. Make it active first.'); continue; }
      // the week
      const wcell = c('Week')?.trim();
      if (!wcell) { raise('checkIns', line, 'required-empty', 'Week', '', 'Week should be a whole number from 1, counted from the start of the year.'); continue; }
      const pw = parseWeek(wcell, 'Week');
      if (pw.error) { raise('checkIns', line, 'week-wrong', 'Week', '', pw.error); continue; }
      if (pw.date) raise('checkIns', line, 'date-as-week', '', '', `${Q(wcell)} was read as week ${pw.week}.`);
      const wk = pw.week;
      if (wk === 0) { raise('checkIns', line, 'week-wrong', 'Week', '', 'Check-ins start in week 1; week 0 is the start of the year.'); continue; }
      if (wk < 0 || !Number.isInteger(wk)) { raise('checkIns', line, 'week-wrong', 'Week', '', 'Week should be a whole number from 1, counted from the start of the year.'); continue; }
      if (wk > week) { raise('checkIns', line, 'week-wrong', 'Week', '', `Week ${wk} hasn’t happened yet; it’s week ${week}.`); continue; }
      // the check-in it replaces
      const saved = goal ? (ckByGoal.get(goal.id) || []) : [];
      let existing = null;
      const cid = c('ID')?.trim();
      if (cid) {
        existing = saved.find((x) => x.id === cid) || null;
        if (!existing) { raise('checkIns', line, 'bad-key', 'ID', cid, `There’s no check-in with ID ${cid} on this goal. Leave ID empty to add a check-in.`); continue; }
        if (existing.week !== wk) { raise('checkIns', line, 'cant-change', 'Week', '', `Check-in ${cid} is for week ${existing.week}; a check-in’s week can’t change.`); continue; }
      } else {
        const ofWeek = S1.sortCk(saved.filter((x) => x.week === wk));
        existing = ofWeek.length ? ofWeek[ofWeek.length - 1] : null;
      }
      // the draft: the row, else what the saved check-in says
      const kind = gd.kind;
      const draft = existing ? JSON.parse(JSON.stringify(existing)) : { goalId: goal?.id, week: wk, value: null, stages: null, status: null, cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '' };
      let bad = false;
      const vcell = c('Value');
      if (vcell !== undefined && kind !== 'milestone') {
        if (!vcell.trim()) draft.value = null;
        else {
          const pn = parseNumber(vcell, gd.unit);
          const dec = gd.decimals ?? 0;
          if (pn.formula) { raise('checkIns', line, 'formula', 'Value', '', `Value holds a formula (${Q(vcell.trim())}), not a number. In Excel, copy the column and paste it as values.`); bad = true; }
          else if (pn.notNumber || pn.hasWords) { raise('checkIns', line, 'not-a-number', 'Value', '', `Week ${wk}: ${Q(vcell.trim())} isn’t a number. Type digits only, like ${exampleNumber(dec)}.`); bad = true; }
          else {
            if (pn.comma) raise('checkIns', line, 'decimal-comma', '', '', `${Q(vcell.trim())} was read as ${pn.value}: a comma as the decimal mark.`);
            if (pn.places > dec) {
              const shown = fixed(pn.value, dec);
              raise('checkIns', line, 'precision', 'Value', '', `Week ${wk}: ${vcell.trim()} has ${placesWords(pn.places)}, but this goal keeps ${placesWords(dec)}, so it would show as ${shown}. Type ${shown}, or set the goal’s Decimals to ${pn.places}.`); bad = true;
            } else {
              const gg = goal || { ...gd, plan: gd.plan };
              if (pn.value < 0 && (S1.usuallyPositive(gg) || S1.isCount(gg, wk))) {
                const cnt = S1.isCount(gg, wk) && !S1.usuallyPositive(gg);
                raise('checkIns', line, 'impossible-number', 'Value', '', `Week ${wk}: It can’t be below zero${gd.unit ? ` ${gd.unit}` : ''}${cnt ? ': this goal counts things' : ''}.`); bad = true;
              } else if (pn.value > 100 && S1.isShare(gg, wk)) { raise('checkIns', line, 'impossible-number', 'Value', '', `Week ${wk}: It can’t be over 100%: this goal measures a share of something.`); bad = true; }
              else draft.value = pn.value;
            }
          }
        }
      }
      if (bad) continue;
      const callCell = c('Call')?.trim();
      let call = null;
      if (callCell) { const w = readWord('checkIns', line, 'Call', callCell, WORDS.Call); if (w.code) call = w.code; else continue; }
      const causeCell = c('Cause');
      if (causeCell !== undefined) { if (!causeCell.trim()) draft.cause = null; else { const w = readWord('checkIns', line, 'Cause', causeCell, WORDS.Cause); if (w.code) draft.cause = w.code; else continue; } }
      for (const [col, f] of [['Why', 'why'], ['Why greener', 'greenerWhy']]) { const v = c(col); if (v !== undefined) draft[f] = v.trim(); }
      const nextCell = c('Next step') ?? c('Next');
      if (nextCell !== undefined) draft.next = nextCell.trim();
      const pathCell = c('Path to green'), recCell = c('Recovery'), byCell = c('Back on plan by week'), needsCell = c('Needs');
      if ([pathCell, recCell, byCell, needsCell].some((x) => x !== undefined)) {
        const p = draft.pathToGreen ? { ...draft.pathToGreen } : { what: '', byWeek: null, needs: '', state: 'plan' };
        if (pathCell !== undefined) p.what = pathCell.trim();
        if (needsCell !== undefined) p.needs = needsCell.trim();
        if (recCell !== undefined && recCell.trim() && p.what) { const w = readWord('checkIns', line, 'Recovery', recCell, WORDS.Recovery); if (w.code) p.state = w.code; else continue; }
        if (byCell !== undefined) {
          if (!byCell.trim()) p.byWeek = null;
          else { const bw = parseWeek(byCell, 'Back on plan by week'); if (bw.error || !bw.bare && !bw.week) { raise('checkIns', line, 'week-wrong', 'Back on plan by week', '', `Back on plan by week: ${Q(byCell.trim())} isn’t a week.`); continue; } p.byWeek = bw.week; if (recCell === undefined || !recCell.trim()) p.state = 'plan'; }
        }
        draft.pathToGreen = p.what || p.needs || p.byWeek !== null ? p : null;
      }
      // the same as saved?
      if (existing) {
        const same = (call === null || call === existing.status) && cmpNum(draft.value, existing.value, gd.decimals ?? 0)
          && (draft.cause ?? null) === (existing.cause ?? null) && (draft.why ?? '') === (existing.why ?? '') && (draft.greenerWhy ?? '') === (existing.greenerWhy ?? '')
          && JSON.stringify(draft.pathToGreen ?? null) === JSON.stringify(existing.pathToGreen ?? null) && (draft.next ?? '') === (existing.next ?? '')
          && JSON.stringify(draft.stages ?? null) === JSON.stringify(existing.stages ?? null);
        if (same) { cr.unchanged = true; continue; }
        if (ended) { raise('checkIns', line, 'cant-change', '', '', `${yearName} has ended, so its check-ins can’t be corrected.`); continue; }
      }
      // who may
      const ownerId = goal ? goal.ownerId : gd.ownerId;
      if (!isAdmin && ownerId !== input.actor) { raise('checkIns', line, 'not-allowed', '', '', `Only ${nameOf(ownerId)} (its owner) can check in on ${Q(gd.title)}.`); continue; }
      // judged as a new check-in would be, in its own week
      if (kind !== 'milestone' && (draft.value === null || draft.value === undefined)) { raise('checkIns', line, 'required-empty', 'Value', '', `Week ${wk} needs a Value.`); continue; }
      const all = saved.filter((x) => x !== existing);
      const gJudge = goal || { ...gd, plan: gd.plan };
      const ev = S1.evaluate(gJudge, { ...draft, week: wk, status: call ?? 'on' }, all);
      const theCall = call ?? ev.calc;
      const ev2 = S1.evaluate(gJudge, { ...draft, week: wk, status: theCall }, all);
      const missing = [];
      for (const code of ev2.missingCall) {
        if (code === 'greener-why' && (draft.greenerWhy ?? '').length >= 10) continue;
        if ((code === 'reason-behind' || code === 'reason-ahead') && draft.cause && (draft.why ?? '').length >= 10) continue;
        if (code === 'path' && draft.pathToGreen && (draft.pathToGreen.what ?? '').length >= 8 && (draft.pathToGreen.state !== 'plan' || (draft.pathToGreen.byWeek > wk && draft.pathToGreen.byWeek <= WEEKS))) continue;
        missing.push(code);
      }
      const asRecorded = create && wk < week && missing.length;
      if (missing.length && !asRecorded) {
        const words = { 'value-not-number': 'a number in Value', value: 'a Value', 'value-precision': 'a Value at the goal’s decimal places', 'value-impossible': 'a possible Value', 'greener-why': `Why greener (the call is ${CALL_WORD[theCall].toLowerCase()})`, 'reason-ahead': 'a Cause and a Why of 10 characters or more (it’s ahead of plan)', 'reason-behind': 'a Cause and a Why of 10 characters or more (it’s behind plan)', path: `a Path to green and, if it’s a plan, Back on plan by week (after week ${wk}, by week ${WEEKS})`, 'story-unchanged': 'whether what you said last time is still true', target: 'a proposed target beyond the current one' };
        const parts = missing.map((m) => words[m]).join('; ');
        raise('checkIns', line, 'checkin-incomplete', '', parts, `Week ${wk} needs ${parts}.`);
        cr.must = true;
      }
      if (asRecorded) raise('checkIns', line, 'as-recorded', '', '', `Week ${wk} is taken as it was recorded.`);
      // a correction?
      const corrects = existing && ((isAdmin && !create && ownerId !== input.actor && wk === week) || (ended));
      if (corrects) {
        const rs = fileReason;
        const ok = rs.length >= 10 && rs.length <= 500 && (rs.match(/\p{L}/gu) || []).length >= 3;
        if (!ok && !cr.must) { needsReasonCorrect = true; cr.needsReason = true; }
        cr.whyCorrected = ok ? rs : null;
      }
      if (cr.must) continue;
      if (existing && existing.authorId !== input.actor && !create) {
        othersReplaced++;
        raise('checkIns', line, 'replaces', '', '', `Replaces ${nameOf(existing.authorId)}’s check-in for week ${wk}.`);
      }
      draft.status = theCall;
      draft.calculated = ev.calc;
      cr.item = { goal, newRow, gd, existing, draft, wk, author: existing ? existing.authorId : input.actor, line };
    }
    if (othersReplaced >= 10) raise('checkIns', read.checkIns.rows[read.checkIns.rows.length - 1].line, 'replaces-others', '', '', `${othersReplaced} rows replace check-ins other people posted.`);
  }

  // ---------- removals on People: big removals on Goals ----------
  const removals = removalRows.stop + removalRows.delete;
  if (removals >= 5 && read.goals) {
    const what = [];
    if (removalRows.stop) what.push(`stops ${plural(removalRows.stop, 'goal', 'goals')}`);
    if (removalRows.delete) what.push(`deletes ${plural(removalRows.delete, 'goal', 'goals')}`);
    const first = goalRows.find((g) => g.action);
    raise('goals', first.line, 'big-removal', 'Action', '', `This file ${what.join(' and ')}. Is that right?`);
  }

  // ---------- which rows are left out, and what blocks ----------
  const leaveRow = new Set();
  for (const i of issues) if (answerOf(i) === 'leave') leaveRow.add(`${i.sheet}:${i.row}`);
  const live = issues.filter((i) => !leaveRow.has(`${i.sheet}:${i.row}`));
  const blocking = live.filter((i) => i.level === 'must' || (i.level === 'check' && !answered(i)));

  // ---------- a goal as it would be saved ----------
  let nextKey = Math.max(0, ...goals.map((g) => Number(String(g.key).replace(/^G-/, '')) || 0));
  function goalRecord(g, d, id, change) {
    const r = g ? JSON.parse(JSON.stringify(g)) : { id, key: `G-${++nextKey}`, cycleId: cyc.id, createdAt: now, originalPlan: null, rebaselinedWeek: null };
    Object.assign(r, { title: d.title, teamId: d.teamId, ownerId: d.ownerId, level: d.level, io: d.io ?? 'input', guardrail: !!d.guardrail, parentId: d.parentId ?? null, effect: d.effect ?? null, source: d.source ?? '', definition: d.definition ?? '', kind: d.kind });
    if (d.whyHelps) r.whyHelps = d.whyHelps;
    if (d.kind === 'metric' || d.kind === 'range') { r.unit = d.unit ?? ''; r.decimals = d.decimals ?? 0; }
    if (d.kind === 'metric') { r.plan = d.plan; if (d.targetUnset) r.targetUnset = true; else delete r.targetUnset; if (d.baseline) r.baseline = d.baseline; }
    if (d.kind === 'range') r.range = d.range;
    if (d.kind === 'milestone' && d.stagesDraft) r.stages = d.stagesDraft.map((s2) => ({ id: s2.id ?? newId('s'), name: s2.name, dueWeek: s2.dueWeek }));
    if (d.state === 'proposed' && !r.proposedAt) { r.proposedAt = now; r.proposedBy = input.actor; }
    if (d.state === 'active') { r.proposedAt = null; r.proposedBy = null; }
    if (g && change?.planChanged && change.needs && g.kind === 'metric') r.planHistory = [...(g.planHistory || []), { untilWeek: week, plan: g.plan }];
    return r;
  }

  // ---------- the items ----------
  const items = [];
  const via = 'Spreadsheet';
  const goalWords = (g, d) => {
    // fields of a goal, in order, in words
    const kind = d.kind;
    const f = [];
    f.push(['Name', d.title]);
    f.push(['State', d.state === 'proposed' ? 'Proposed' : '—']);
    f.push(['Type', TYPE_WORD[kind]]);
    f.push(['Team', d.teamId ? teamById.get(d.teamId)?.name ?? '—' : '—']);
    f.push(['Owner', d.ownerId ? nameOf(d.ownerId) : '—']);
    f.push(['Feeds into', d.parentTitle ?? (d.parentId ? goalById.get(d.parentId)?.title : 'Nothing')]);
    f.push(['Why it helps', d.parentId && d.whyHelps ? d.whyHelps : '—']);
    f.push(['Also helps', d.alsoHelps?.length ? d.alsoHelps.map((id) => goalById.get(id)?.title).join(', ') : '—']);
    f.push(['Guarded by', d.guards?.length ? d.guards.map((x) => goalById.get(x.goal)?.title).join(', ') : '—']);
    f.push(['Level', LEVEL_NAME[d.level]]);
    f.push(['Role', d.io === 'output' ? 'Output' : 'Input']);
    f.push(['Guardrail', d.guardrail ? 'Yes' : 'No']);
    f.push(['Estimated effect', d.effect === null || d.effect === undefined ? '—' : String(d.effect)]);
    f.push(['Data source', d.source || '—']);
    f.push(['Definition', d.definition || '—']);
    if (kind === 'metric' || kind === 'range') { f.push(['Unit', d.unit || '—']); f.push(['Decimals', String(d.decimals ?? 0)]); }
    if (kind === 'metric') {
      const p = d.plan;
      f.push(['Start', numWords(p.start, d.unit, d.decimals)]);
      f.push(['Target', d.targetUnset ? 'Not set' : numWords(p.target, d.unit, d.decimals)]);
      f.push(['Plan shape', SHAPE_WORD[p.shape]]);
      f.push(['Plan from week', p.fromWeek === undefined || p.fromWeek === null ? '—' : weekWord(p.fromWeek)]);
      f.push(['Target due', p.endWeek === undefined || p.endWeek === null ? '—' : weekWord(p.endWeek)]);
      f.push(['Plan numbers', p.points?.length ? p.points.map((q) => `wk ${q.week}: ${numWords(q.value, d.unit, d.decimals)}`).join(', ') : '—']);
      f.push(['Baseline', d.baseline ? `Baseline, ${d.baseline.period}${d.baseline.provisional ? ', provisional' : ''}` : '—']);
    }
    if (kind === 'range') {
      const r = d.range;
      const lim = r.bound === 'between' ? `Between ${numWords(r.lower, d.unit, d.decimals)} and ${numWords(r.limit, d.unit, d.decimals)}` : `${r.bound === 'atMost' ? 'At most' : 'At least'} ${numWords(r.limit, d.unit, d.decimals)}`;
      f.push(['Limit', lim]);
      f.push(['Warning margin', r.margin ? numWords(r.margin, d.unit, d.decimals) : '—']);
    }
    if (kind === 'milestone') {
      const st = [...(d.stagesDraft || d.stages || [])].sort((a, b) => a.dueWeek - b.dueWeek);
      f.push(['Stages', st.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ') || '—']);
    }
    return f;
  };
  let goalIdOf = new Map();
  for (const gr of goalRows) {
    if (!gr.change) continue;
    const d = gr.draft, g = gr.goal;
    const blocked = blocking.some((i) => i.sheet === 'goals' && i.row === gr.line && (i.level === 'must' && !i.late || (HOLDS_ROW.has(i.kind) && !i.late)));
    if (blocked || leaveRow.has(`goals:${gr.line}`)) continue;
    if (gr.change.isNew) {
      if (d.stagesDraft) d.stagesDraft = d.stagesDraft.map((s) => ({ id: newId('s'), ...s }));
      const id = newId('goal');
      goalIdOf.set(gr.line, id);
      d.id = id;
      const diffs = goalWords(null, d).filter(([, v]) => v !== '—').map(([k, v]) => [k, '—', v]);
      items.push({ sheet: 'Goals', line: gr.line, target: id, name: d.title, kind: 'new goal', diffs, gr, order: 0, record: () => goalRecord(null, d, id) });
    } else {
      const before = goalWords(g, { ...g, state: g.proposedAt ? 'proposed' : 'active', parentTitle: g.parentId ? goalById.get(g.parentId)?.title : null });
      const after = goalWords(g, { ...d, kind: g.kind });
      const diffs = [];
      for (let i = 0; i < after.length; i++) if (before[i][1] !== after[i][1]) diffs.push([after[i][0], before[i][1], after[i][1]]);
      if (gr.change.planChanged && gr.change.reason) diffs.push(['Why', '—', gr.change.reason]);
      items.push({ sheet: 'Goals', line: gr.line, target: g.id, name: g.title, kind: gr.change.planChanged ? 'plan' : 'goal', diffs, gr, needsReason: gr.change.needs, order: 0, before: g, record: () => goalRecord(g, d, g.id, gr.change) });
    }
  }
  // parent ids of new goals named by row
  for (const it of items) { const d = it.gr?.draft; if (d && typeof d.parentId === 'string' && d.parentId.startsWith('row:')) d.parentId = goalIdOf.get(+d.parentId.slice(4)); }
  // a new goal's past stages, done
  for (const gr of goalRows) {
    if (!gr.pastDone || !goalIdOf.has(gr.line)) continue;
    const d = gr.draft;
    const st = d.stagesDraft.map((s) => `${s.name}: ${gr.pastDone.some((p) => p.name === s.name) ? `done wk ${s.dueWeek}` : 'on schedule'}`).join('; ');
    items.push({ sheet: 'Goals', line: gr.line, target: d.id, name: d.title, kind: 'check-in', diffs: [['Status call', '—', 'On track'], ['Stages', '—', st]], author: d.ownerId, ck: { week, goalId: d.id }, order: 1 });
  }
  // check-ins, by goal ID then week
  const ckList = ckRows.filter((cr) => cr.item && !leaveRow.has(`checkIns:${cr.line}`));
  ckList.sort((a, b) => {
    const ia = a.item.goal ? a.item.goal.id : goalIdOf.get(a.item.newRow.line) ?? '';
    const ib = b.item.goal ? b.item.goal.id : goalIdOf.get(b.item.newRow.line) ?? '';
    return ia.localeCompare(ib) || a.item.wk - b.item.wk;
  });
  const ckWords = (gd, c) => {
    const f = [];
    f.push(['Status call', c.status ? CALL_WORD[c.status] : '—']);
    if (gd.kind !== 'milestone') f.push(['Value', c.value === null || c.value === undefined ? '—' : numWords(c.value, gd.unit, gd.decimals)]);
    f.push(['Cause', c.cause ? CAUSE_WORD[c.cause] : '—']);
    f.push(['Note', c.why || '—']);
    f.push(['Why greener', c.greenerWhy || '—']);
    const p = c.pathToGreen;
    f.push(['Path to green', p && p.what ? `${p.what} (${p.state === 'plan' || !p.state ? (p.byWeek ? `by week ${p.byWeek}` : 'plan') : RECOVERY_WORD[p.state].toLowerCase()})` : '—']);
    f.push(['Needs', p && p.needs ? p.needs : '—']);
    f.push(['Proposed target', c.proposeTarget === null || c.proposeTarget === undefined ? '—' : numWords(c.proposeTarget, gd.unit, gd.decimals)]);
    f.push(['Next step', c.next || '—']);
    if (gd.kind === 'milestone') f.push(['Stages', '—']);
    return f;
  };
  for (const cr of ckList) {
    const it = cr.item;
    const target = it.goal ? it.goal.id : goalIdOf.get(it.newRow.line);
    const after = ckWords(it.gd, it.draft);
    let diffs;
    if (it.existing) {
      const before = ckWords(it.gd, it.existing);
      diffs = [];
      for (let i = 0; i < after.length; i++) if (before[i][1] !== after[i][1]) diffs.push([after[i][0], before[i][1], after[i][1]]);
      if (cr.whyCorrected) diffs.unshift(['Why corrected', '—', cr.whyCorrected]);
    } else diffs = after.filter(([, v]) => v !== '—').map(([k, v]) => [k, '—', v]);
    items.push({ sheet: 'Check-ins', line: cr.line, target, name: it.gd.title, kind: it.existing ? 'replaces check-in' : 'check-in', diffs, author: it.author, needsReason: !!cr.needsReason, ck: { week: it.wk, replaces: !!it.existing }, order: 2, before: it.existing,
      record: () => ({ ...it.draft, id: it.existing ? it.existing.id : newId('ci'), goalId: target, week: it.wk, authorId: it.author, postedAt: it.existing ? it.existing.postedAt : it.wk < week ? S1.weekMoment(it.wk) : now, ...(it.wk < week && !it.existing ? { backfilled: true } : {}) }) });
  }
  for (const p of personItems) if (!leaveRow.has(`people:${p.line}`)) items.push({ ...p, order: 3 });
  for (const r of removalItems) if (!leaveRow.has(`goals:${r.line}`)) items.push({ ...r, order: 5 });
  items.sort((a, b) => a.order - b.order);
  for (const it of items) it.diffs.push(['Via', '—', via]);

  // ---------- counts ----------
  const counts = { newGoals: 0, goals: 0, plans: 0, checkIns: 0, backfilled: 0, replaced: 0, people: 0, newPeople: 0, teams: 0, stopped: 0, deleted: 0, left: 0 };
  for (const it of items) {
    if (it.kind === 'new goal') counts.newGoals++;
    else if (it.kind === 'goal') counts.goals++;
    else if (it.kind === 'plan') counts.plans++;
    else if (it.kind === 'check-in' || it.kind === 'replaces check-in') { counts.checkIns++; if (it.ck.week < week) counts.backfilled++; if (it.ck.replaces) counts.replaced++; }
    else if (it.kind === 'person') counts.people++;
    else if (it.kind === 'new person') counts.newPeople++;
    else if (it.kind === 'team') counts.teams++;
    else if (it.kind === 'stop goal') counts.stopped++;
    else if (it.kind === 'delete goal') counts.deleted++;
    else if (it.kind === 'person left') counts.left++;
  }
  const unchanged = goalRows.filter((g) => g.unchanged || g.leftAlone).length + ckRows.filter((c) => c.unchanged).length + peopleRows.filter((p) => p.unchanged).length;
  const needsReason = needsReasonPlan || needsReasonCorrect;
  const saves = !create && !blocking.length && !needsReason && items.length > 0;

  // ---------- issues in the file's order ----------
  const ordered = [...issues].sort((a, b) => SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet) || a.row - b.row || a.seq - b.seq);
  // ---------- the commit: one save, and one summary entry that can undo all of it ----------
  let commit = null;
  if (saves) {
    const importId = newId('imp');
    commit = { goals: [], checkIns: [], people: [], changes: [], expect: { goals: [] } };
    const undo = { goals: [], checkIns: [], people: [] };
    for (const it of items) {
      if (!it.record) continue;
      const rec = it.record();
      const kindKey = it.sheet === 'People' ? 'people' : it.sheet === 'Check-ins' || it.kind === 'check-in' ? 'checkIns' : 'goals';
      commit[kindKey].push(rec);
      undo[kindKey].push({ id: rec.id, before: it.before ? JSON.parse(JSON.stringify(it.before)) : null });
      if (kindKey === 'goals' && it.before) commit.expect.goals.push({ id: it.before.id, version: it.before.version ?? 0 });
      commit.changes.push({ id: newId('chg'), at: now, actorId: input.actor, goalId: kindKey === 'people' ? null : (rec.goalId ?? rec.id), entity: kindKey === 'people' ? 'person' : kindKey === 'checkIns' ? 'checkIn' : 'goal', entityId: rec.id, action: it.kind, summary: `${it.kind}: ${it.name}`, diffs: it.diffs.map(([field, from, to]) => ({ field, from, to })), importId });
    }
    const k = counts, bits = [];
    if (k.newPeople) bits.push(plural(k.newPeople, 'new person', 'new people'));
    if (k.people) bits.push(`${plural(k.people, 'person', 'people')} changed`);
    if (k.teams) bits.push(`${plural(k.teams, 'team', 'teams')} changed`);
    if (k.newGoals) bits.push(plural(k.newGoals, 'new goal', 'new goals'));
    if (k.goals) bits.push(`${plural(k.goals, 'goal', 'goals')} changed`);
    if (k.plans) bits.push(`${plural(k.plans, 'plan', 'plans')} changed`);
    if (k.checkIns) bits.push(`${plural(k.checkIns, 'check-in', 'check-ins')}${k.backfilled ? ` (${k.backfilled} for past weeks)` : ''}`);
    if (k.replaced) bits.push(`${k.replaced} replaced`);
    if (k.stopped) bits.push(`${plural(k.stopped, 'goal', 'goals')} stopped`);
    if (k.deleted) bits.push(`${plural(k.deleted, 'goal', 'goals')} deleted`);
    if (k.left) bits.push(`${plural(k.left, 'person', 'people')} marked as left`);
    const describe = bits.join(', ') || 'No changes';
    commit.changes.push({ id: newId('chg'), at: now, actorId: input.actor, goalId: null, entity: 'workspace', entityId: importId, action: 'imported', summary: `Loaded a spreadsheet: ${describe}`, importId, undo,
      diffs: [{ field: 'Via', from: '—', to: 'Spreadsheet' }, { field: 'Rows', from: '—', to: `${items.length} changed, ${unchanged} unchanged` }] });
  }
  return { items, issues: ordered, counts, unchanged, needsReason, saves, commit };
}

// ---------- the drill's files ----------
export function runCases({ W, cases, outDir, S1 }) {
  const csv = S1.csvCell;
  const imp = [['case', 'actor', 'sheet', 'rows', 'answers', 'given', 'kind', 'level', 'group', 'message', 'must', 'questions', 'saves', 'kinds']];
  const chg = [['case', 'row', 'actor', 'sheet', 'line', 'rows', 'answers', 'given', 'target', 'name', 'kind', 'diffs', 'counts', 'unchanged', 'needs_reason', 'saves', 'author']];
  const IMPORT_CASES = 70;
  cases.forEach((cs, idx) => {
    const ctx = { W, S1 };
    const res = planChanges(ctx, cs);
    const rowsJ = JSON.stringify(cs.rows), ansJ = cs.answers ? JSON.stringify(cs.answers) : '', givJ = cs.given ? JSON.stringify(cs.given) : '';
    const yn = (b) => (b ? 'yes' : 'no');
    if (idx < IMPORT_CASES) {
      const first = res.issues.find((i) => i.level !== 'note');
      const groups = (lv) => new Set(res.issues.filter((i) => i.level === lv).map((i) => i.group)).size;
      const kinds = [];
      for (const i of [...res.issues].sort((a, b) => a.seq - b.seq)) if (!kinds.includes(i.kind)) kinds.push(i.kind);
      const kindsOrdered = [];
      for (const i of res.issues) if (!kindsOrdered.includes(i.kind)) kindsOrdered.push(i.kind);
      imp.push([cs.case, cs.actor, cs.sheet, rowsJ, ansJ, givJ, first?.kind ?? '', first?.level ?? '', first?.group ?? '', first?.message ?? '', groups('must'), groups('check'), yn(res.saves), kindsOrdered.join(' ')]);
    }
    const counts = Object.entries(res.counts).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');
    chg.push([cs.case, 0, cs.actor, cs.sheet, '', rowsJ, ansJ, givJ, '', '', '', '', counts, res.unchanged, yn(res.needsReason), yn(res.saves), '']);
    res.items.forEach((it, i) => {
      chg.push([cs.case, i + 1, '', it.sheet, it.line, '', '', '', it.target ?? '', it.name ?? '', it.kind, it.diffs.map(([f, a, b]) => `${f}: ${a} → ${b}`).join(' | '), '', '', it.needsReason ? 'yes' : 'no', '', it.author ?? '']);
    });
  });
  const write = (name, rows) => fs.writeFileSync(path.join(outDir, `${name}.csv`), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
  write('import', imp);
  write('changes', chg);
}
