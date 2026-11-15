// The metric library's rules (spec/modules/metrics/rules.md): pure functions over plain rows. No files, no screens.
// ctx = { W, S1, now } ; the library's rows are W.modules.metrics.{metrics, metricLinks}.
import { fold, words, matches } from '../../screens.mjs';

export const DIR_WORDS = { lower: 'lower is better', higher: 'higher is better' };
export const REFRESH = ['live', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly'];
export const MEASUREMENT = ['measured', 'partly', 'gap'];
export const MEASUREMENT_WORDS = { measured: 'Measured', partly: 'Partly', gap: 'Gap' };
export const LEVELS = ['component', 'driver', 'control', 'breakdown'];
export const LEVEL_WORDS = { component: 'A component of', driver: 'A driver of', control: 'A control on', breakdown: 'A breakdown of' };
export const CONFIDENCE = ['high', 'medium', 'low'];
export const PART_MAX = 60, REASON_MAX = 300, GAMING_MAX = 500, TEXT_MAX = 2000;
export const READING_MAX_DAYS = 7, READING_WEEKS = 8;
export const READING_WHY = { behind: 'The source is behind: I have a newer number', 'other-count': 'The source counts something else', wrong: 'The source is wrong this week', else: 'Something else' };
const DAY = 86400000;

export const lib = (W) => { W.modules = W.modules || {}; W.modules.metrics = W.modules.metrics || { metrics: [], metricLinks: [] }; const L = W.modules.metrics; L.metrics = L.metrics || []; L.metricLinks = L.metricLinks || []; return L; };
export const metricSlug = (m) => String(m.id).replace(/^metric_/, '');
export const findMetric = (W, ref) => lib(W).metrics.find((m) => m.id === ref || metricSlug(m) === ref || m.id === `metric_${ref}`);
export const isRetired = (m) => !!m.retiredAt;
export const liveMetrics = (W) => lib(W).metrics.filter((m) => !m.removedAt && !isRetired(m));
export const inUseMetrics = (W) => lib(W).metrics.filter((m) => !m.removedAt);
const person = (W, id) => (W.people || []).find((p) => p.id === id);
const hasLeft = (p) => !!(p && (p.leftAt || p.left));
export const ownerName = (W, m) => { const p = person(W, m.ownerId); return p && !hasLeft(p) ? p.name : null; };
const team = (W, id) => (W.teams || []).find((t) => t.id === id);
export const sliceWords = (W, teamId, part) => `${teamId ? (team(W, teamId)?.name || 'A removed team') : 'The whole company'}${part ? ` · ${part}` : ''}`;
export const forWords = (W, teamId) => (teamId ? `for ${team(W, teamId)?.name || 'a removed team'}` : 'for the whole company');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- numbers, as the scorecard writes them ----------
const group = (s) => { const neg = s.startsWith('-'); const [i, f] = (neg ? s.slice(1) : s).split('.'); return `${neg ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f !== undefined ? `.${f}` : ''}`; };
export const n = (v, d) => group(Number(v).toFixed(d ?? 0));
export function fmt(v, unit, d) {
  const s = n(v, d);
  if (!unit) return s;
  if (unit === '%') return `${s}%`;
  const u = s === '1' && /^[a-z][a-z-]+[^s]s$/.test(unit) ? unit.slice(0, -1) : unit;
  return `${s} ${u}`;
}
export function amount(v, unit, d) {
  const s = n(Math.abs(v), d);
  const one = Number(s.replace(/,/g, '')) === 1;
  if (unit === '%') return `${s} ${one ? 'pt' : 'pts'}`;
  if (!unit) return s;
  const u = one && /^[a-z][a-z-]*[^s]s$/i.test(unit) ? unit.slice(0, -1) : unit;
  return `${s} ${u}`;
}
export const decimalsWords = (d) => (!d ? 'whole numbers' : d === 1 ? '1 decimal place' : `${d} decimal places`);

// ---------- live goals and links in force ----------
export function liveGoalIds(ctx) {
  const ws = ctx.S1.asOf(ctx.now);
  return new Set(ws.goals.map((g) => g.id));
}
export function liveLinks(ctx, live = liveGoalIds(ctx)) { return lib(ctx.W).metricLinks.filter((l) => !l.removedAt && live.has(l.goalId)); }
export const everUsed = (W, m) => lib(W).metricLinks.some((l) => l.metricId === m.id);
export const linkOf = (W, goalId) => lib(W).metricLinks.find((l) => l.goalId === goalId && !l.removedAt);
export function measureOf(W, goalId) {
  const l = linkOf(W, goalId);
  if (!l) return null;
  const m = lib(W).metrics.find((x) => x.id === l.metricId);
  return m ? { metric: m, link: l } : null;
}

// ---------- rule 3 / rule 11: what a metric needs ----------
export function measurementOf(m) { return MEASUREMENT.includes(m.measurement) ? m.measurement : 'measured'; }
export function metricNeeds(ctx, m, live) {
  const W = ctx.W, out = [];
  const links = liveLinks(ctx, live).filter((l) => l.metricId === m.id);
  const ms = measurementOf(m);
  if (ms === 'gap') out.push({ code: 'gap', words: links.length ? `Not measured yet: ${plural(links.length, 'goal', 'goals')} held to no number` : 'Not measured yet', button: 'Say how it’s measured', field: 'measurement' });
  if (ms === 'partly') out.push({ code: 'partly', words: 'Only partly measured', button: 'Say how it’s measured', field: 'measurement' });
  const p = person(W, m.ownerId);
  if (!p || hasLeft(p)) out.push({ code: 'no-owner', words: p ? 'Its owner has left' : 'It has no owner', button: 'Choose an owner', field: 'owner' });
  if (!String(m.meaning || '').trim()) out.push({ code: 'no-meaning', words: 'No meaning yet', button: 'Say what it means', field: 'meaning' });
  if (!String(m.source || '').trim()) out.push({ code: 'no-source', words: 'No source named', button: 'Say where the number comes from', field: 'source' });
  if (!links.length && Date.parse(ctx.now) - Date.parse(m.createdAt) > 14 * DAY) out.push({ code: 'unused', words: 'No goal uses it', button: `See goals in ${m.unit}`, href: `/goals?q=${encodeURIComponent(m.unit)}` });
  return out;
}
export const needsLine = (needs) => (needs.length ? `${needs[0].words}${needs.length > 1 ? ` and ${needs.length - 1} more` : ''}` : '');

// ---------- rule 1: finding metrics ----------
export function metricWords(W, m) { return [m.name, m.unit, DIR_WORDS[m.direction] || '', ownerName(W, m) || '', m.meaning || '', m.source || ''].flatMap(words); }
const az = (a, b) => (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0);
export function findMetrics(ctx, ask = {}) {
  const W = ctx.W, live = liveGoalIds(ctx), links = liveLinks(ctx, live);
  const count = (m) => links.filter((l) => l.metricId === m.id).length;
  let rows = (ask.retired ? inUseMetrics(W).filter(isRetired) : liveMetrics(W));
  if (ask.q && String(ask.q).trim()) rows = rows.filter((m) => matches(metricWords(W, m), ask.q));
  if (ask.unit) rows = rows.filter((m) => fold(m.unit) === fold(ask.unit));
  if (ask.teamId) rows = rows.filter((m) => links.some((l) => l.metricId === m.id && (ask.teamId === 'company' ? !l.teamId : l.teamId === ask.teamId)));
  if (ask.ownerId) rows = rows.filter((m) => m.ownerId === ask.ownerId);
  if (ask.dir) rows = rows.filter((m) => m.direction === ask.dir);
  if (ask.unused) rows = rows.filter((m) => !count(m));
  if (ask.sortout) rows = rows.filter((m) => metricNeeds(ctx, m, live).length);
  rows = [...rows].sort(az);
  if (ask.sort === 'goals') rows.sort((a, b) => count(b) - count(a) || az(a, b));
  else if (ask.sort === 'changed') rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : az(a, b)));
  const size = 50, pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, Number(ask.page) || 1), pages);
  return { total: rows.length, all: rows, rows: rows.slice((page - 1) * size, page * size), page, pages, count };
}

// ---------- a goal's summary words (rule 2 reads them; never worked out again) ----------
export function goalSummary(ctx, g) {
  const { S1, now } = ctx;
  const ws = S1.asOf(now);
  const w = S1.currentWeek(now);
  const posted = ws.ckByGoal.get(g.id) || [];
  const st = S1.flagsFor(g, ws, now).st;
  const d = g.decimals ?? 0, unit = g.unit || '';
  const a = S1.assessPosted(g, posted, w, true);
  const actual = a.latest && a.latest.value !== null && a.latest.value !== undefined ? a.latest.value : null;
  const out = { status: st.status, now: actual === null ? 'No value yet' : fmt(actual, unit, d), nowValue: actual, unit, decimals: d };
  const by = (due) => (due >= S1.WEEKS ? (S1.WEEKS >= 48 ? 'by year end' : 'by cycle end') : `by week ${due}`);
  if (g.kind === 'metric') {
    const p = S1.planAsOf(g, w);
    out.target = `${fmt(p.target, unit, d)} ${by(S1.planEnd(p))}`;
    out.targetValue = p.target;
    if (actual === null) out.vsPlan = 'No value yet';
    else {
      const better = p.target >= p.start ? 1 : -1;
      const diff = S1.rd((actual - a.plan) * better, d);
      out.vsPlan = diff === 0 ? 'On plan' : `${amount(diff, unit, d)} ${diff > 0 ? 'ahead of' : 'behind'} plan`;
    }
  } else if (g.kind === 'range') {
    const r = g.range;
    const lim = r.bound === 'between' ? `${fmt(r.lower, unit, d)} to ${fmt(r.limit, unit, d)}` : fmt(r.limit, unit, d);
    out.target = `${r.bound === 'atMost' ? '≤ ' : r.bound === 'atLeast' ? '≥ ' : ''}${lim} ${by(S1.WEEKS)}`;
    out.targetValue = r.limit;
    if (actual === null) out.vsPlan = 'No value yet';
    else {
      const out_ = r.bound === 'atMost' ? actual > r.limit : r.bound === 'atLeast' ? actual < r.limit : actual > r.limit || actual < r.lower;
      const near = r.bound === 'atMost' ? actual > r.limit - (r.margin || 0) : r.bound === 'atLeast' ? actual < r.limit + (r.margin || 0) : actual > r.limit - (r.margin || 0) || actual < r.lower + (r.margin || 0);
      out.vsPlan = `${out_ ? 'Outside' : near ? 'Near' : 'Inside'} the ${lim} limit`;
    }
  } else { out.target = ''; out.vsPlan = ''; }
  out.owner = person(ctx.W, g.ownerId)?.name || '';
  return out;
}

// ---------- rule 2: a metric's goals ----------
const RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };
export function metricGoals(ctx, m, live = liveGoalIds(ctx)) {
  const W = ctx.W;
  const rows = liveLinks(ctx, live).filter((l) => l.metricId === m.id).map((l) => {
    const g = W.goals.find((x) => x.id === l.goalId);
    const s = goalSummary(ctx, g);
    return { goal: g, link: l, slice: sliceWords(W, l.teamId, l.part), ...s };
  });
  rows.sort((a, b) => (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3) || (fold(a.slice) < fold(b.slice) ? -1 : fold(a.slice) > fold(b.slice) ? 1 : 0) || (fold(a.goal.title) < fold(b.goal.title) ? -1 : 1));
  return rows;
}
export function summaryLine(rows) {
  const withNum = rows.filter((r) => r.nowValue !== null);
  if (withNum.length < 2) return '';
  if (!withNum.every((r) => r.unit === withNum[0].unit && r.decimals === withNum[0].decimals)) return '';
  const bySlice = (a, b) => (fold(a.slice) < fold(b.slice) ? -1 : fold(a.slice) > fold(b.slice) ? 1 : 0);
  const lo = [...withNum].sort((a, b) => a.nowValue - b.nowValue || bySlice(a, b))[0];
  const hi = [...withNum].sort((a, b) => b.nowValue - a.nowValue || bySlice(a, b))[0];
  return `Lowest now: ${lo.slice}, ${lo.now}. Highest: ${hi.slice}, ${hi.now}.`;
}
export function goalsByStatus(rows) {
  const c = new Map();
  for (const r of [...rows].sort((a, b) => (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3))) c.set(r.status, (c.get(r.status) || 0) + 1);
  return [...c.entries()];
}

// ---------- rule 6: still to say ----------
export function stillToSay(W, m) {
  const miss = [];
  if (!String(m.meaning || '').trim()) miss.push('what it means');
  if (!String(m.source || '').trim()) miss.push('where the number comes from');
  if (!String(m.sourceOwner || '').trim()) miss.push('who owns that source');
  if (!m.refresh) miss.push('how often it refreshes');
  const p = person(W, m.ownerId);
  const left = !p || hasLeft(p);
  if (!miss.length) return left ? 'Its owner has left.' : 'Fully defined';
  return `Still to say: ${miss.join(', ')}.${left ? ' Its owner has left.' : ''}`;
}

// ---------- rule 7: parts ----------
export const partKey = (p) => fold(p).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => (w.length >= 4 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');
export function partsOf(ctx, m, live) {
  const by = new Map();
  for (const l of liveLinks(ctx, live).filter((x) => x.metricId === m.id && x.part)) {
    const k = partKey(l.part);
    if (!by.has(k)) by.set(k, { n: 0, spell: new Map(), first: by.size });
    const e = by.get(k); e.n++; e.spell.set(l.part, (e.spell.get(l.part) || 0) + 1);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.first - b.first).map((e) => [...e.spell.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}
export function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
export function closePart(typed, inUse) {
  const k = partKey(typed);
  if (!k || k.length <= 2) return null;
  const nums = (s) => (s.match(/\d+/g) || []).join(',');
  for (const p of inUse) {
    const pk = partKey(p);
    if (p === typed) continue;
    if (pk === k) return p;
    if (pk.length > 2 && nums(pk) === nums(k) && editDistance(pk, k) <= 1) return p;
  }
  return null;
}

// ---------- rule 4 and 6: close names, units, out of what ----------
const STOP = new Set(['the', 'of', 'per', 'for', 'in', 'a', 'rate', 'time']);
export const nameWords = (s) => new Set(fold(s).replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));
const flat = (s) => fold(s).replace(/[^\p{L}\p{N}]/gu, '');
export function closeNames(W, typed, exceptId) {
  if (String(typed).trim().length < 4) return [];
  const a = nameWords(typed);
  if (!a.size) return [];
  const out = [];
  for (const m of inUseMetrics(W)) {
    if (m.id === exceptId || fold(m.name) === fold(typed)) continue;
    const b = nameWords(m.name);
    if (!b.size) continue;
    const onlyA = [...a].filter((x) => !b.has(x)).length, onlyB = [...b].filter((x) => !a.has(x)).length;
    const shared = [...a].filter((x) => b.has(x)).length;
    if (onlyA === 0 || onlyB === 0 || (shared >= 2 && onlyA <= 1 && onlyB <= 1)) out.push({ m, apart: onlyA + onlyB });
  }
  return out.sort((x, y) => x.apart - y.apart || az(x.m, y.m)).slice(0, 2).map((x) => x.m);
}
export function formerNames(W) {
  const out = [];
  for (const c of W.changes || []) if (c.entity === 'metric') for (const d of c.diffs || []) if (d.field === 'Name' && d.from && d.from !== '—') out.push({ name: d.from, id: c.entityId });
  return out;
}
const describe = (W, m, live) => `${m.unit}, ${DIR_WORDS[m.direction]}, owned by ${ownerName(W, m) || 'no one'}`;
export function nameChecks(ctx, typed, exceptId) {
  const W = ctx.W, t = String(typed || '').trim();
  if (!t) return [];
  const f = flat(t);
  for (const x of formerNames(W)) {
    const m = findMetric(W, x.id);
    if (m && !m.removedAt && m.id !== exceptId && flat(x.name) === f && fold(m.name) !== fold(t)) return [{ field: 'name', kind: 'former', other: m, question: `“${t}” is now called “${m.name}”.`, answers: [`Use ${m.name}`, `Add “${t}” as a new metric`] }];
  }
  if (t.length > 4) {
    const live = liveGoalIds(ctx);
    for (const m of inUseMetrics(W).filter((x) => x.id !== exceptId).sort(az)) {
      const o = flat(m.name);
      if (o === f || o.length <= 4) continue;
      const limit = Math.max(o.length, f.length) <= 12 ? 1 : 2;
      if (editDistance(o, f) <= limit) {
        const k = liveLinks(ctx, live).filter((l) => l.metricId === m.id).length;
        return [{ field: 'name', kind: 'letters', other: m, question: `This is one letter from “${m.name}” (${describe(W, m)}, ${plural(k, 'goal', 'goals')}).`, answers: ['Use that one', 'Mine is different: keep it'] }];
      }
    }
  }
  const close = closeNames(W, t, exceptId);
  if (close.length) return [{ field: 'name', kind: 'words', other: close[0], question: `This looks like “${close[0].name}” (${describe(W, close[0])}). Use that one, or carry on if yours is different.`, answers: ['Use that one', 'Mine is different: keep it'] }];
  return [];
}
const UNIT_SPELL = { percent: '%', pct: '%', 'per cent': '%', mins: 'min', minutes: 'min', minute: 'min', hrs: 'hours', hr: 'hours', hour: 'hours', secs: 's', seconds: 's', sec: 's', dollars: 'USD', $: 'USD' };
export function unitChecks(W, typed, exceptId) {
  const t = String(typed || '').trim();
  if (!t) return [];
  const units = [...new Set(inUseMetrics(W).filter((m) => m.id !== exceptId).map((m) => m.unit))];
  if (units.includes(t)) return [];
  const norm = (u) => u.toLowerCase().replace(/[s.]$/, '');
  const known = UNIT_SPELL[t.toLowerCase()] || UNIT_SPELL[t.toLowerCase().replace(/\.$/, '')];
  const u = units.find((x) => norm(x) === norm(t)) || (known && units.includes(known) ? known : null);
  return u ? [{ field: 'unit', kind: 'unit', use: u, question: `Other metrics here use “${u}”. Use “${u}”, or keep “${t}”?`, answers: [`Use “${u}”`, `Keep “${t}”`] }] : [];
}
const TIME_UNITS = /^(s|sec|secs|seconds|ms|min|mins|minutes|hours?|hrs?|days?|weeks?)$/i;
export function meaningChecks(input) {
  const unit = String(input.unit || '').trim(), name = fold(input.name || ''), meaning = String(input.meaning || '').trim();
  if (!meaning) return [];
  const share = unit === '%' || (/\b(rate|share|ratio)\b/.test(name) && !TIME_UNITS.test(unit) && !/\/|per /.test(unit));
  if (!share) return [];
  const m = fold(meaning);
  if (['out of', 'share of', 'of all', 'of every', 'divided by', 'per ', '÷', '/', 'percentage of', 'proportion of', 'fraction of'].some((x) => m.includes(x))) return [];
  return [{ field: 'meaning', kind: 'out-of-what', question: 'This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.', answers: ['It’s right as written'] }];
}
export function countLine(musts, checks) { const p = []; if (musts) p.push(`${musts} to fix`); if (checks) p.push(`${checks} to check`); return p.length ? `${p.join(', ')}.` : ''; }

// ---------- rule 12: structure ----------
export function makesLoop(W, id, parentId) {
  let cur = parentId; const seen = new Set();
  while (cur && !seen.has(cur)) { if (cur === id) return true; seen.add(cur); cur = findMetric(W, cur)?.parentId; }
  return false;
}
export function structureProblems(W, m) {
  const out = [];
  if (m.level && !LEVELS.includes(m.level)) out.push('Choose how it relates: a component, a driver, a control or a breakdown.');
  if (m.level && !m.parentId) out.push(`Say what it is ${({ component: 'a component of', driver: 'a driver of', control: 'a control on', breakdown: 'a breakdown of' })[m.level] || 'under'}: choose its parent, or leave the level empty.`);
  if (m.parentId) {
    const p = findMetric(W, m.parentId);
    if (m.parentId === m.id) out.push('A metric can’t be its own parent.');
    else if (!p || p.removedAt) out.push('Choose a parent that is in the library.');
    else if (makesLoop(W, m.id, m.parentId)) out.push('Choose another parent: it’s already under this one.');
  }
  if (m.confidence && !CONFIDENCE.includes(m.confidence)) out.push('Say how far to trust it: high, medium or low.');
  if (m.gaming && m.gaming.length > GAMING_MAX) out.push(`Keep how it could be gamed to ${GAMING_MAX} characters or fewer.`);
  return out;
}
export const placeWords = (W, m) => { if (!m.parentId) return ''; const p = findMetric(W, m.parentId); return p ? `${m.level ? LEVEL_WORDS[m.level] : 'Under'} ${p.name}.` : ''; };
export const childrenOf = (W, m) => liveMetrics(W).filter((x) => x.parentId === m.id).sort(az);

// ---------- rule (library 1): what a metric must say ----------
export function metricProblems(W, m, exceptId) {
  const out = [];
  const name = String(m.name || '').trim();
  if (!name) out.push({ field: 'name', message: 'Give it a name.' });
  else if (name.length < 3 || name.length > 120) out.push({ field: 'name', message: 'A name has 3 to 120 characters.' });
  else {
    const same = inUseMetrics(W).find((x) => x.id !== exceptId && flat(x.name) === flat(name) && fold(x.name).replace(/\s+/g, ' ') === fold(name).replace(/\s+/g, ' '));
    if (same) out.push({ field: 'name', message: isRetired(same) ? `There’s already a metric called ${same.name}, retired. Bring it back, or give this one a different name.` : `There’s already a metric called ${same.name}. Use it, or give this one a different name.` });
  }
  if (!String(m.unit || '').trim()) out.push({ field: 'unit', message: 'Say its unit: %, min, hours, USD, deploys…' });
  else if (String(m.unit).trim().length > 20) out.push({ field: 'unit', message: 'Keep the unit to 20 characters or fewer.' });
  if (!DIR_WORDS[m.direction]) out.push({ field: 'direction', message: 'Say which way is better: higher or lower.' });
  if (m.decimals !== undefined && m.decimals !== null && m.decimals !== '' && !(Number.isInteger(Number(m.decimals)) && m.decimals >= 0 && m.decimals <= 4)) out.push({ field: 'decimals', message: 'Decimals are 0 to 4.' });
  if (m.refresh && !REFRESH.includes(m.refresh)) out.push({ field: 'refresh', message: 'Say how often it refreshes: live, hourly, daily, weekly, monthly or quarterly.' });
  if (m.ownerId && !person(W, m.ownerId)) out.push({ field: 'owner', message: 'Choose an owner in this workspace.' });
  for (const f of ['meaning', 'source', 'sourceOwner', 'caveats']) if (String(m[f] || '').length > TEXT_MAX) out.push({ field: f, message: `Keep it to ${TEXT_MAX.toLocaleString('en-GB')} characters or fewer.` });
  if (m.measurement && !MEASUREMENT.includes(m.measurement)) out.push({ field: 'measurement', message: 'Say whether it is measured: measured, partly or a gap.' });
  if (String(m.measurementNote || '').length > 300) out.push({ field: 'measurement', message: 'Keep what’s missing to 300 characters or fewer.' });
  for (const s of structureProblems(W, m)) out.push({ field: 'parent', message: s });
  return out;
}
export const mayChange = (W, actor, m) => m.ownerId === actor || !!person(W, actor)?.admin;
export const mayLink = (W, actor, g) => g.ownerId === actor || !!person(W, actor)?.admin;
export const changeRefusal = (W, m) => `Only ${person(W, m.ownerId)?.name || 'its owner'} or an admin can change this metric.`;

// ---------- rule 8: what kind of change ----------
export function linkedGoals(W, m) { return lib(W).metricLinks.filter((l) => l.metricId === m.id && !l.removedAt).map((l) => W.goals.find((g) => g.id === l.goalId)).filter((g) => g && !g.removedAt); }
export function changeKinds(before, after, goals, { relabel = false } = {}) {
  const k = [];
  const same = ['name', 'meaning', 'unit', 'decimals', 'direction', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats', 'measurement', 'measurementNote', 'parentId', 'level', 'confidence', 'gaming'].every((f) => (before[f] ?? '') === (after[f] ?? ''));
  if (same) return ['none'];
  if (!goals.length) return ['words'];
  if (before.unit !== after.unit) k.push(relabel ? 'relabel' : 'scale');
  if (before.direction !== after.direction) k.push('direction');
  if ((before.meaning || '') !== (after.meaning || '') || (before.source || '') !== (after.source || '')) k.push('meaning');
  if ((after.decimals ?? 0) < (before.decimals ?? 0) && goals.some((g) => (g.decimals ?? 0) > (after.decimals ?? 0))) k.push('decimals');
  return k.length ? k : ['words'];
}
export const markLabel = (mk) => `${mk.kind === 'direction' ? 'Direction' : 'Definition'} changed, week ${mk.week}`;
export function marksFor(W, S1, m, link) {
  const since = link.linkedAt;
  const end = `${S1.isoOfDay(S1.LAST_DAY + 1)}T00:00:00.000Z`;
  return (m.marks || []).filter((mk) => mk.at >= since && mk.at >= W.cycle.startDate && mk.at < end);
}

// ---------- linking ----------
export function linkProblems(ctx, actor, g, m, teamId, { part = '', answers = {}, reason = '' } = {}) {
  const W = ctx.W, musts = [], checks = [], warnings = [];
  if (!mayLink(W, actor, g)) return { refused: 'Only the goal’s owner or an admin can choose what measures it.' };
  if (!m || m.removedAt) return { refused: 'There’s no metric like that in the library.' };
  if (isRetired(m)) return { refused: `${m.name} is retired, so it can’t measure a new goal.` };
  if (g.kind === 'milestone') return { refused: 'A goal with dated stages has no number, so a metric can’t measure it.' };
  if (fold(g.unit || '') !== fold(m.unit)) return { refused: `The goal is in ${g.unit || 'no unit'} and the metric is in ${m.unit}. Use the same unit for both.` };
  if (teamId && !team(W, teamId)) return { refused: 'There’s no team like that here.' };
  if (String(part).length > PART_MAX) musts.push({ field: 'part', message: `Keep which part to ${PART_MAX} characters or fewer.` });
  const last = [...lib(W).metricLinks].filter((l) => l.goalId === g.id).sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))[0];
  const hasCk = (W.checkIns || []).some((c) => c.goalId === g.id && !c.removedAt);
  const differs = last && (last.metricId !== m.id || (last.teamId || null) !== (teamId || null) || (last.part || '') !== (part || ''));
  if (hasCk && differs && !String(reason).trim()) musts.push({ field: 'why', message: 'Say why this goal is measured differently now.' });
  if (String(reason).length > REASON_MAX) musts.push({ field: 'why', message: `Keep why to ${REASON_MAX} characters or fewer.` });
  const live = liveGoalIds(ctx);
  const other = liveLinks(ctx, live).find((l) => l.goalId !== g.id && l.metricId === m.id && (l.teamId || null) === (teamId || null) && partKey(l.part || '') === partKey(part || ''));
  if (other && answers.others !== 'carry-on') {
    const og = W.goals.find((x) => x.id === other.goalId);
    checks.push({ field: 'others', question: `Another goal already measures this for ${sliceWords(W, teamId, part).replace(' · ', ', ')}: “${og.title}” (${og.key}, ${person(W, og.ownerId)?.name}). Two goals on one number is unusual.`, answers: ['Carry on'] });
  } else if (!other && part && !answers.part) {
    const cp = closePart(part, partsOf(ctx, m, live));
    if (cp) checks.push({ field: 'part', question: `${m.name} already has a part called “${cp}”.`, answers: [`Use “${cp}”`, `Keep “${part}”`], use: cp });
  }
  const aims = g.kind === 'metric' ? (g.plan.target > g.plan.start ? 'higher' : g.plan.target < g.plan.start ? 'lower' : null) : g.kind === 'range' ? (g.range.bound === 'atLeast' ? 'higher' : g.range.bound === 'atMost' ? 'lower' : null) : null;
  if (aims && aims !== m.direction) warnings.push(g.kind === 'metric' ? `The goal aims ${aims === 'higher' ? 'up' : 'down'}, but for ${m.name} ${DIR_WORDS[m.direction]}. Check it’s meant.` : `The goal keeps it at ${aims === 'higher' ? 'least' : 'most'} a level, but for ${m.name} ${DIR_WORDS[m.direction]}. Check it’s meant.`);
  if ((g.decimals ?? 0) > (m.decimals ?? 0)) warnings.push(`The goal keeps ${decimalsWords(g.decimals)} and ${m.name} ${decimalsWords(m.decimals ?? 0)}. Check which is meant.`);
  return { musts, checks, warnings, last, hasCk };
}

// ---------- the number sources (NR): the demo's seeded series ----------
// Each slice follows one goal's numbers by week, continued one week by the mean step of its last four numbers,
// measured at 09:00 UTC on its week's review day. Release pipelines has no reading in the last week.
export const DEMO_SERIES = [
  { source: 'CI analytics', metricId: 'metric_ci-time', teamId: null, part: '', goal: 'ns-ci', add: 0, short: 0 },
  { source: 'CI runner metrics', metricId: 'metric_queue-wait', teamId: 'cicd', part: 'main branch pipelines', goal: 'lead-ci-time', add: 0, short: 0 },
  { source: 'CI runner metrics', metricId: 'metric_queue-wait', teamId: 'release', part: 'release pipelines', goal: 'lead-ci-time', add: 0, short: 1 },
];
export function demoSources(W, S1, seedCheckIns = W.checkIns) {
  const series = DEMO_SERIES.map((s) => {
    const byWeek = new Map();
    for (const c of [...seedCheckIns].filter((c) => c.goalId === s.goal && !c.removedAt && c.value !== null && c.value !== undefined).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))) byWeek.set(c.week, c.value);
    const weeks = [...byWeek.keys()].sort((a, b) => a - b);
    const pts = weeks.map((w) => ({ w, v: byWeek.get(w) }));
    if (pts.length) {
      const last4 = pts.slice(-5);
      const steps = last4.slice(1).map((p, i) => p.v - last4[i].v);
      const step = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : 0;
      pts.push({ w: pts[pts.length - 1].w + 1, v: pts[pts.length - 1].v + step });
    }
    const kept = pts.map((p) => ({ value: p.v + s.add, at: `${S1.isoOfDay(S1.START + 7 * p.w + S1.REVIEW_DAY)}T09:00:00.000Z` }));
    return { ...s, points: s.short ? kept.slice(0, -s.short) : kept };
  });
  const sources = new Map();
  for (const s of series) {
    if (!sources.has(s.source)) sources.set(s.source, { name: s.source, slices: [] });
    sources.get(s.source).slices.push(s);
  }
  return [...sources.values()].map((src) => ({
    name: src.name,
    reads: (metricId) => src.slices.some((x) => x.metricId === metricId),
    read(metricId, at, slice) {
      const sl = src.slices.find((x) => x.metricId === metricId && (x.teamId || null) === (slice.teamId || null) && partKey(x.part || '') === partKey(slice.part || ''));
      if (!sl) return { noSlice: true };
      const pts = sl.points.filter((p) => p.at <= at);
      return pts.length ? pts[pts.length - 1] : null;
    },
  }));
}
export function sourceFor(sources, metricId) { return sources.find((s) => s.reads(metricId)) || null; }
export function askSource(src, metricId, at, slice) {
  try { const r = src.read(metricId, at, slice); if (r && r.noSlice) return { state: 'no-slice' }; if (!r) return { state: 'missing' }; if (!Number.isFinite(r.value) || Number.isNaN(Date.parse(r.at)) || r.at > at) return { state: 'unreachable' }; return { reading: r }; } catch { return { state: 'unreachable' }; }
}
export function readingState(asked, lastReading, lastValue, now, typed, decimals = 0) {
  if (asked.state) return asked.state;
  const r = asked.reading;
  if (Date.parse(now) - Date.parse(r.at) > READING_MAX_DAYS * DAY) return 'old';
  if (lastReading && lastReading.at >= r.at) return 'same';
  if (lastValue !== null && lastValue !== undefined) {
    const a = Math.abs(r.value), b = Math.abs(lastValue);
    if (b === 0 ? a >= 10 : a >= 10 * b || a <= b / 10) return 'jump';
  }
  if (typed !== null && typed !== undefined && typed !== '' && Number(Number(typed).toFixed(decimals)) !== Number(Number(r.value).toFixed(decimals))) return 'changed';
  return 'fresh';
}
export function readingProblem(reading, value, now) {
  if (!reading) return null;
  if (!String(reading.source || '').trim()) return 'Say which source the number came from.';
  if (!Number.isFinite(Number(reading.value))) return 'The source’s number isn’t a number.';
  const t = Date.parse(reading.at);
  if (Number.isNaN(t) || t > Date.parse(now) + DAY || t < Date.parse(now) - READING_MAX_DAYS * DAY) return 'The source’s reading is too old, or its time doesn’t parse.';
  const differs = Number(value) !== Number(reading.value);
  if (differs && !reading.why) return `${reading.source} said ${reading.value}. Say why your number is different.`;
  if (differs && reading.why && reading.why.kind === 'else' && String(reading.why.text || '').trim().length < 10) return `Say more about why your number is different from what ${reading.source} said, in at least 10 characters.`;
  if (reading.why && String(reading.why.text || '').length > 500) return 'Keep why to 500 characters or fewer.';
  return null;
}
export const recordReading = (src, r, typed, why) => ({ source: src, value: r.value, at: r.at, ...(why && Number(typed) !== Number(r.value) ? { why } : {}) });
