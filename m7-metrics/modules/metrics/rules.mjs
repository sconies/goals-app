// The metric library's rules (stage 7), as pure functions over plain rows: no screens, no store, no network.
// Every function takes the module's rows (metrics, links), the core's rows it needs (goals, people, teams, check-ins)
// and a moment. Words are the kit's (spec/modules/metrics/rules.md).

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DAY = 86400000;
const dayNum = (iso) => Math.floor(Date.parse(iso) / DAY);

// ---------- words of a row (finding things, rule 1) ----------
export function wordsOf(text) {
  const s = fold(text);
  const out = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === '.' || ch === ',') && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) { cur += ch; continue; }
    if (/[\s\/\-,.:()]/.test(ch)) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const matchesAll = (rowWords, q) => wordsOf(q).every((w) => rowWords.some((rw) => rw.startsWith(w)));

// ---------- numbers as the scorecard writes them ----------
export function n(v, d = 0) {
  const s = Number(v).toFixed(d);
  const neg = s.startsWith('-');
  const [i, f] = s.replace('-', '').split('.');
  return `${neg ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? `.${f}` : ''}`;
}
export function fmt(v, unit, d = 0) {
  if (v === null || v === undefined) return 'No value yet';
  const s = n(v, d);
  if (!unit) return s;
  if (unit === '%') return `${s}%`;
  const u = s === '1' && /^[a-z][a-z-]+[^s]s$/.test(unit) ? unit.slice(0, -1) : unit;
  return `${s} ${u}`;
}
export function amount(v, unit, d = 0) {
  const s = n(Math.abs(v), d);
  const one = Number(s) === 1;
  if (unit === '%') return `${s} ${one ? 'pt' : 'pts'}`;
  if (!unit) return s;
  return `${s} ${one && /^[a-z][a-z-]*[^s]s$/i.test(unit) ? unit.slice(0, -1) : unit}`;
}
export const decimalsWords = (d) => (!d ? 'whole numbers' : d === 1 ? '1 decimal place' : `${d} decimal places`);
export const dirWords = (dir) => (dir === 'lower' ? 'lower is better' : 'higher is better');

// ---------- the library's rows ----------
export const inUse = (m) => !m.removedAt;
export const isRetired = (m) => !!m.retiredAt;
export const liveMetrics = (metrics) => metrics.filter((m) => inUse(m) && !isRetired(m));
export const liveLinks = (links, liveGoalIds) => links.filter((l) => !l.removedAt && liveGoalIds.has(l.goalId));
export const metricSlug = (id) => String(id).replace(/^metric_/, '');
export const everUsed = (metricId, links) => links.some((l) => l.metricId === metricId);
export function findMetric(metrics, ref) {
  if (!ref) return null;
  const r = String(ref);
  return metrics.find((m) => inUse(m) && (m.id === r || m.id === `metric_${r}` || metricSlug(m.id) === r))
    || metrics.find((m) => inUse(m) && fold(m.name) === fold(r)) || null;
}
const personName = (people, id) => people.find((p) => p.id === id)?.name || '';
const hasLeft = (p) => !!(p && (p.leftAt || p.left));
const az = (a, b) => (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0);

// ---------- rule 3: what a metric needs ----------
export const NEED_WORDS = {
  gap: (k) => (k === null ? 'Not measured yet' : `Not measured yet: ${k} ${k === 1 ? 'goal' : 'goals'} held to no number`),
  partly: () => 'Only partly measured',
  'no-owner': (left) => (left ? 'Its owner has left' : 'It has no owner'),
  'no-meaning': () => 'No meaning yet',
  'no-source': () => 'No source named',
  unused: () => 'No goal uses it',
};
export const NEED_BUTTON = { gap: 'Say how it’s measured', partly: 'Say how it’s measured', 'no-owner': 'Choose an owner', 'no-meaning': 'Say what it means', 'no-source': 'Say where the number comes from' };
export const NEED_FIELD = { gap: 'measurement', partly: 'measurement', 'no-owner': 'owner', 'no-meaning': 'meaning', 'no-source': 'source' };
export function metricNeeds(m, { links, liveGoalIds, people, moment }) {
  const out = [];
  const inForce = liveLinks(links, liveGoalIds).filter((l) => l.metricId === m.id);
  const meas = measurementOf(m);
  if (meas === 'gap') out.push({ code: 'gap', words: NEED_WORDS.gap(inForce.length || null) });
  if (meas === 'partly') out.push({ code: 'partly', words: NEED_WORDS.partly() });
  const owner = people.find((p) => p.id === m.ownerId);
  if (!owner || hasLeft(owner)) out.push({ code: 'no-owner', words: NEED_WORDS['no-owner'](!!owner) });
  if (!String(m.meaning || '').trim()) out.push({ code: 'no-meaning', words: NEED_WORDS['no-meaning']() });
  if (!String(m.source || '').trim()) out.push({ code: 'no-source', words: NEED_WORDS['no-source']() });
  if (!inForce.length && dayNum(moment) - dayNum(m.createdAt) > 14) out.push({ code: 'unused', words: NEED_WORDS.unused(), button: `See goals in ${m.unit}` });
  return out.map((x) => ({ ...x, button: x.button || NEED_BUTTON[x.code], field: NEED_FIELD[x.code] || null }));
}
export function needsLine(needs) { return needs.length ? `${needs[0].words}${needs.length > 1 ? ` and ${needs.length - 1} more` : ''}` : ''; }

// ---------- rule 1: finding metrics ----------
export function findMetrics(ask, { metrics, links, liveGoalIds, people, moment }) {
  const inForce = liveLinks(links, liveGoalIds);
  let list = metrics.filter(inUse).filter((m) => (ask.retired ? isRetired(m) : !isRetired(m)));
  if (ask.q && ask.q.trim()) list = list.filter((m) => matchesAll(wordsOf([m.name, m.unit, dirWords(m.direction), personName(people, m.ownerId), m.meaning, m.source].join(' ')), ask.q));
  if (ask.unit) list = list.filter((m) => fold(m.unit) === fold(ask.unit));
  if (ask.teamId) list = list.filter((m) => inForce.some((l) => l.metricId === m.id && (ask.teamId === 'company' ? l.teamId === null : l.teamId === ask.teamId)));
  if (ask.ownerId) list = list.filter((m) => m.ownerId === ask.ownerId);
  if (ask.dir) list = list.filter((m) => m.direction === ask.dir);
  if (ask.unused) list = list.filter((m) => !inForce.some((l) => l.metricId === m.id));
  if (ask.sortout) list = list.filter((m) => metricNeeds(m, { links, liveGoalIds, people, moment }).length);
  const goalsOf = (m) => inForce.filter((l) => l.metricId === m.id).length;
  const sort = ask.sort || 'name';
  list.sort((a, b) => (sort === 'goals' ? goalsOf(b) - goalsOf(a) : sort === 'changed' ? (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0) : 0) || az(a, b));
  const pages = Math.max(1, Math.ceil(list.length / 50));
  const page = Math.min(Math.max(1, Number(ask.page) || 1), pages);
  return { total: list.length, all: list, rows: list.slice((page - 1) * 50, page * 50), page, pages };
}

// ---------- rule 2: a metric's goals ----------
// summaryOf(goal) is the core's own summary of a goal: { status, now, target, vsPlan, owner, value, unit, decimals }.
export const STATUS_RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };
export function sliceWords(link, teams) {
  const t = link.teamId === null || link.teamId === undefined ? 'The whole company' : teams.find((x) => x.id === link.teamId)?.name || 'A removed team';
  return link.part ? `${t} · ${link.part}` : t;
}
export function metricGoals(metricId, { links, liveGoalIds, goals, teams, summaryOf }) {
  const rows = liveLinks(links, liveGoalIds).filter((l) => l.metricId === metricId).map((l) => {
    const g = goals.find((x) => x.id === l.goalId);
    const s = summaryOf(g);
    return { goal: g, link: l, slice: sliceWords(l, teams), ...s };
  });
  rows.sort((a, b) => (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3) || (fold(a.slice) < fold(b.slice) ? -1 : fold(a.slice) > fold(b.slice) ? 1 : 0) || (fold(a.goal.title) < fold(b.goal.title) ? -1 : 1));
  return rows;
}
export function summaryLine(rows) {
  const withNum = rows.filter((r) => r.value !== null && r.value !== undefined);
  if (withNum.length < 2) return '';
  if (!withNum.every((r) => r.unit === withNum[0].unit && r.decimals === withNum[0].decimals)) return '';
  const by = [...withNum].sort((a, b) => a.value - b.value || (fold(a.slice) < fold(b.slice) ? -1 : 1));
  const lo = by[0];
  const hi = [...withNum].sort((a, b) => b.value - a.value || (fold(a.slice) < fold(b.slice) ? -1 : 1))[0];
  return `Lowest now: ${lo.slice}, ${lo.now}. Highest: ${hi.slice}, ${hi.now}.`;
}

// ---------- rule 4 and rule 6: close names, still to say, the three questions ----------
const FILLER = new Set(['the', 'of', 'per', 'for', 'in', 'a', 'rate', 'time']);
export function nameWords(name) {
  return new Set(fold(name).replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !FILLER.has(w)));
}
export function closeWords(a, b) {
  if (fold(a).trim() === fold(b).trim()) return null;
  if (fold(a).trim().length < 4) return null;
  const A = nameWords(a), B = nameWords(b);
  if (!A.size || !B.size) return null;
  const inter = [...A].filter((w) => B.has(w)).length;
  const apart = A.size + B.size - 2 * inter;
  if (inter === A.size || inter === B.size) return apart;
  if (inter >= 2 && Math.max(A.size - inter, B.size - inter) <= 1) return apart;
  return null;
}
export function closeNames(typed, metrics) {
  return metrics.filter(inUse).map((m) => ({ m, d: closeWords(typed, m.name) })).filter((x) => x.d !== null)
    .sort((a, b) => a.d - b.d || az(a.m, b.m)).slice(0, 2).map((x) => x.m);
}
export function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const plain = (s) => fold(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
export function stillToSay(m, people) {
  const miss = [];
  if (!String(m.meaning || '').trim()) miss.push('what it means');
  if (!String(m.source || '').trim()) miss.push('where the number comes from');
  if (!String(m.sourceOwner || '').trim()) miss.push('who owns that source');
  if (!m.refresh) miss.push('how often it refreshes');
  const owner = people.find((p) => p.id === m.ownerId);
  const left = !!owner && hasLeft(owner);
  const noOwner = !owner;
  if (!miss.length && !left && !noOwner) return 'Fully defined';
  if (!miss.length) return left ? 'Its owner has left.' : 'Fully defined';
  return `Still to say: ${miss.join(', ')}.${left ? ' Its owner has left.' : ''}`;
}
// formerNames: { name: metricId } from the change log (renames).
export function nameChecks(typed, { metrics, links, people, selfId = null, formerNames = {} }) {
  const t = plain(typed);
  if (!t) return [];
  const others = metrics.filter((m) => inUse(m) && m.id !== selfId);
  if (others.some((m) => fold(m.name).trim() === fold(typed).trim())) return [];
  const out = [];
  for (const [old, id] of Object.entries(formerNames)) {
    const m = others.find((x) => x.id === id);
    if (m && plain(old) === t) out.push({ kind: 'former', metric: m, text: `“${typed}” is now called “${m.name}”.`, answers: [`Use ${m.name}`, `Add “${typed}” as a new metric`] });
  }
  const desc = (m) => { const k = links.filter((l) => !l.removedAt && l.metricId === m.id).length; return `(${m.unit}, ${dirWords(m.direction)}, owned by ${personName(people, m.ownerId) || 'no one'}, ${k} ${k === 1 ? 'goal' : 'goals'})`; };
  const letters = others.filter((m) => {
    const o = plain(m.name);
    if (o === t || t.length <= 4 || o.length <= 4) return false;
    const lim = Math.max(o.length, t.length) > 12 ? 2 : 1;
    return editDistance(o, t) <= lim;
  }).sort((a, b) => editDistance(plain(a.name), t) - editDistance(plain(b.name), t) || az(a, b));
  for (const m of letters) out.push({ kind: 'letters', metric: m, text: `This is one letter from “${m.name}” ${desc(m)}.`, answers: ['Use that one', 'Mine is different: keep it'] });
  for (const m of closeNames(typed, others)) if (!out.some((x) => x.metric.id === m.id)) out.push({ kind: 'words', metric: m, text: `This looks like “${m.name}” (${m.unit}, ${dirWords(m.direction)}, owned by ${personName(people, m.ownerId) || 'no one'}). Use that one, or carry on if yours is different.`, answers: ['Use that one', 'Mine is different: keep it'] });
  return out.slice(0, 2);
}
const UNIT_ALIASES = { percent: '%', pct: '%', 'per cent': '%', mins: 'min', minutes: 'min', minute: 'min', hrs: 'hours', hr: 'hours', hour: 'hours', secs: 's', seconds: 's', sec: 's', dollars: 'USD', $: 'USD' };
export function unitChecks(typed, unitsInUse) {
  const t = String(typed || '').trim();
  if (!t || unitsInUse.includes(t)) return [];
  const norm = (u) => fold(u).trim().replace(/[s.]$/, '');
  const alias = UNIT_ALIASES[fold(t).trim()];
  const hit = unitsInUse.find((u) => (alias && u === alias) || norm(u) === norm(t));
  return hit && hit !== t ? [{ kind: 'unit', use: hit, text: `Other metrics here use “${hit}”. Use “${hit}”, or keep “${t}”?`, answers: [`Use “${hit}”`, `Keep “${t}”`] }] : [];
}
const OUT_OF = ['out of', 'share of', 'of all', 'of every', 'divided by', 'per ', '÷', '/', 'percentage of', 'proportion of', 'fraction of'];
const TIME_OR_RATE = /^(s|ms|min|mins|minutes?|hours?|hrs?|days?|weeks?)$|\/|per /i;
export function meaningChecks(m) {
  const meaning = String(m.meaning || '').trim();
  if (!meaning) return [];
  const share = m.unit === '%' || (/\b(rate|share|ratio)\b/i.test(m.name || '') && !TIME_OR_RATE.test(m.unit || ''));
  if (!share) return [];
  const low = fold(meaning);
  if (OUT_OF.some((w) => low.includes(w))) return [];
  return [{ kind: 'out-of-what', text: 'This is a percentage, and the words don’t say out of what. For example: “production deploys with no rollback or hotfix, out of all production deploys, over 28 days”.', answers: ['It’s right as written'] }];
}
export const countLine = (fix, check) => [fix ? `${fix} to fix` : '', check ? `${check} to check` : ''].filter(Boolean).join(', ') + (fix || check ? '.' : '');

// ---------- the metric library: what a metric must say ----------
export const REFRESH = ['live', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly'];
export function metricProblems(d, { metrics, people, selfId = null }) {
  const out = [];
  const name = String(d.name ?? '').trim(), unit = String(d.unit ?? '').trim();
  if (!name) out.push({ field: 'name', text: 'Give it a name.' });
  else if (name.length < 3 || name.length > 120) out.push({ field: 'name', text: 'A name is 3 to 120 characters.' });
  else {
    const same = metrics.find((m) => inUse(m) && m.id !== selfId && fold(m.name).trim() === fold(name));
    if (same) out.push({ field: 'name', text: isRetired(same) ? `There’s a retired metric called ${same.name}. Bring it back, or give this one a different name.` : `There’s already a metric called ${same.name}. Use it, or give this one a different name.` });
  }
  if (!unit) out.push({ field: 'unit', text: 'Say its unit: %, min, hours, USD, deploys…' });
  else if (unit.length > 20) out.push({ field: 'unit', text: 'Keep the unit to 20 characters or fewer.' });
  if (d.direction !== 'higher' && d.direction !== 'lower') out.push({ field: 'direction', text: 'Say which way is better: higher or lower.' });
  const dec = d.decimals === undefined || d.decimals === null || d.decimals === '' ? 0 : Number(d.decimals);
  if (!Number.isInteger(dec) || dec < 0 || dec > 4) out.push({ field: 'decimals', text: 'Decimal places are 0 to 4.' });
  if (d.refresh && !REFRESH.includes(d.refresh)) out.push({ field: 'refresh', text: 'Say how often: live, hourly, daily, weekly, monthly or quarterly.' });
  if (d.ownerId && !people.some((p) => p.id === d.ownerId)) out.push({ field: 'owner', text: 'Its owner must be someone in this workspace.' });
  for (const f of ['meaning', 'source', 'sourceOwner', 'caveats']) if (String(d[f] ?? '').trim().length > 2000) out.push({ field: f, text: 'Keep it to 2,000 characters or fewer.' });
  if (d.measurementNote && String(d.measurementNote).trim().length > 300) out.push({ field: 'measurementNote', text: 'Keep what’s missing to 300 characters or fewer.' });
  if (d.measurement && !['measured', 'partly', 'gap'].includes(d.measurement)) out.push({ field: 'measurement', text: 'Say measured, partly or gap.' });
  for (const p of structureProblems(d, { metrics, selfId })) out.push(p);
  return out;
}
export const refusalOf = (probs) => `refused: ${probs.map((p) => p.text).join(' ')}`;

// ---------- rule 11: measured, partly or a gap ----------
export const measurementOf = (m) => m.measurement || 'measured';
export const MEASUREMENT_WORD = { measured: 'Measured', partly: 'Partly', gap: 'Gap' };

// ---------- rule 12: where it sits ----------
export const LEVEL_WORDS = { component: 'A component of', driver: 'A driver of', control: 'A control on', breakdown: 'A breakdown of' };
export const LEVEL_NOUN = { component: 'component', driver: 'driver', control: 'control', breakdown: 'breakdown' };
export const CONFIDENCE_WORDS = { high: 'High', medium: 'Medium', low: 'Low' };
export function makesLoop(selfId, parentId, metrics) {
  let cur = parentId; const seen = new Set();
  while (cur && !seen.has(cur)) { if (cur === selfId) return true; seen.add(cur); cur = metrics.find((m) => m.id === cur)?.parentId; }
  return false;
}
export function structureProblems(d, { metrics, selfId }) {
  const out = [];
  if (d.level && !['component', 'driver', 'control', 'breakdown'].includes(d.level)) out.push({ field: 'level', text: 'Say component, driver, control or breakdown.' });
  if (d.level && !d.parentId) out.push({ field: 'parent', text: `Say what it is a ${LEVEL_NOUN[d.level] || 'part'} ${d.level === 'control' ? 'on' : 'of'}: choose its parent, or leave the level empty.` });
  if (d.parentId) {
    const p = metrics.find((m) => m.id === d.parentId);
    if (!p || p.removedAt) out.push({ field: 'parent', text: 'Choose a parent from the library.' });
    else if (selfId && p.id === selfId) out.push({ field: 'parent', text: 'A metric can’t be its own parent.' });
    else if (selfId && makesLoop(selfId, d.parentId, metrics)) out.push({ field: 'parent', text: 'Choose another parent: it’s already under this one.' });
  }
  if (d.confidence && !['high', 'medium', 'low'].includes(d.confidence)) out.push({ field: 'confidence', text: 'Say high, medium or low.' });
  if (d.gaming && String(d.gaming).length > 500) out.push({ field: 'gaming', text: 'Keep how it could be gamed to 500 characters or fewer.' });
  return out;
}
export function placeWords(m, metrics) {
  if (!m.parentId) return '';
  const p = metrics.find((x) => x.id === m.parentId);
  if (!p) return '';
  return m.level ? `${LEVEL_WORDS[m.level]} ${p.name}.` : `Under ${p.name}.`;
}
export const childrenOf = (id, metrics) => liveMetrics(metrics).filter((m) => m.parentId === id).sort(az);

// ---------- rule 7: parts ----------
export function partKey(p) {
  return fold(p).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => (w.length >= 4 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');
}
export function partsOf(metricId, links, liveGoalIds) {
  const by = new Map();
  for (const l of liveLinks(links, liveGoalIds)) {
    if (l.metricId !== metricId || !String(l.part || '').trim()) continue;
    const k = partKey(l.part);
    if (!by.has(k)) by.set(k, { n: 0, spell: new Map() });
    const e = by.get(k); e.n++; e.spell.set(l.part, (e.spell.get(l.part) || 0) + 1);
  }
  return [...by.values()].sort((a, b) => b.n - a.n).map((e) => [...e.spell.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}
export function closePart(typed, inUseParts) {
  const t = String(typed || '').trim();
  if (!t) return null;
  const tk = partKey(t);
  const digits = (s) => (s.match(/\d+/g) || []).join(',');
  for (const p of inUseParts) {
    if (p === t) return null;
    const pk = partKey(p);
    if (pk === tk) return p;
    if (tk.length <= 2 || pk.length <= 2) continue;
    if (digits(pk) !== digits(tk)) continue;
    if (editDistance(pk, tk) <= 1) return p;
  }
  return null;
}

// ---------- the link: what measures a goal ----------
export function fromTheMetric(m) {
  let s = `${m.unit}, ${decimalsWords(m.decimals || 0)}, ${dirWords(m.direction)}.`;
  if (m.source) s += ` From ${m.source}${m.refresh ? `, refreshed ${m.refresh}` : ''}.`;
  return s;
}
const goalAimsUp = (g) => (g.kind === 'metric' && g.plan ? g.plan.target > g.plan.start : g.kind === 'range' ? g.range.bound === 'atLeast' : null);
export function linkProblems({ goal, metric, teamId, part, actor, people, teams }) {
  const me = people.find((p) => p.id === actor);
  if (!(goal.ownerId === actor || me?.admin)) return { refused: 'Only the goal’s owner or an admin can choose what measures it.' };
  if (!metric || metric.removedAt) return { refused: 'There’s no metric with that ID. Use list_metrics, or the Metrics page, to find it.' };
  if (metric.retiredAt) return { refused: `${metric.name} is retired, so no new goal can be measured by it.` };
  if (goal.kind === 'milestone') return { refused: 'A goal with dated stages has no number, so a metric can’t measure it.' };
  if (fold(goal.unit || '').trim() !== fold(metric.unit).trim()) return { refused: `The goal is in ${goal.unit || 'no unit'} and the metric is in ${metric.unit}. Use the same unit for both.` };
  if (teamId !== null && teamId !== undefined && !teams.some((t) => t.id === teamId)) return { refused: 'There’s no such team here.' };
  if (part && String(part).trim().length > 60) return { refused: 'Keep the part to 60 characters or fewer.' };
  const warnings = [];
  const up = goalAimsUp(goal);
  if (up !== null && (up ? 'higher' : 'lower') !== metric.direction) warnings.push(`The goal aims ${up ? 'up' : 'down'}, but for ${metric.name} ${dirWords(metric.direction)}. Check it’s meant.`);
  if ((goal.decimals || 0) > (metric.decimals || 0)) warnings.push(`The goal keeps ${decimalsWords(goal.decimals)} and ${metric.name} ${decimalsWords(metric.decimals || 0)}. Check which is meant.`);
  return { refused: null, warnings };
}
export function goalTarget(goal) {
  if (goal.kind === 'metric' && goal.plan) return goal.plan.target;
  if (goal.kind === 'range' && goal.range) return goal.range.limit;
  return null;
}
export function measureOf(goalId, { links, metrics, teams }) {
  const l = links.find((x) => x.goalId === goalId && !x.removedAt);
  if (!l) return null;
  const m = metrics.find((x) => x.id === l.metricId);
  return m ? { metric: m, link: l, slice: sliceWords(l, teams) } : null;
}

// ---------- rule 8: what kind of change ----------
export function changeKinds(before, after, linkedGoals, { relabel = false } = {}) {
  const kinds = [];
  const used = linkedGoals.length > 0;
  if (used && after.unit !== undefined && after.unit !== before.unit) kinds.push(relabel ? 'relabel' : 'scale');
  if (used && after.direction !== undefined && after.direction !== before.direction) kinds.push('direction');
  if (used && ((after.meaning !== undefined && String(after.meaning).trim() !== String(before.meaning || '').trim()) || (after.source !== undefined && String(after.source).trim() !== String(before.source || '').trim()))) kinds.push('meaning');
  if (used && after.decimals !== undefined && Number(after.decimals) < (before.decimals || 0) && linkedGoals.some((g) => (g.decimals || 0) > Number(after.decimals))) kinds.push('decimals');
  if (kinds.length) return kinds;
  const fields = ['name', 'meaning', 'unit', 'decimals', 'direction', 'source', 'sourceOwner', 'refresh', 'ownerId', 'caveats', 'measurement', 'measurementNote', 'parentId', 'level', 'confidence', 'gaming'];
  return fields.some((f) => after[f] !== undefined && String(after[f] ?? '') !== String(before[f] ?? '')) ? ['words'] : ['none'];
}
export const markLabel = (mk) => `${mk.kind === 'direction' ? 'Direction' : 'Definition'} changed, week ${mk.week}`;

// ---------- a reading in a check-in (NR) ----------
export const READING_MAX_DAYS = 7;
export const READING_WHY = { behind: 'the source is behind: I have a newer number', 'other-count': 'the source counts something else', wrong: 'the source is wrong this week', else: 'something else' };
export function readingState({ reading, noSlice = false, unreachable = false, lastReading = null, lastValue = null, now, typed = null, decimals = 0 }) {
  if (noSlice) return 'no-slice';
  if (unreachable) return 'unreachable';
  if (!reading) return 'missing';
  if (Date.parse(now) - Date.parse(reading.at) > READING_MAX_DAYS * DAY) return 'old';
  if (lastReading && Date.parse(lastReading.at) >= Date.parse(reading.at)) return 'same';
  if (lastValue !== null && lastValue !== undefined) {
    const a = Math.abs(reading.value), b = Math.abs(lastValue);
    if (b === 0 ? a >= 10 : a >= 10 * b || a <= b / 10) return 'jump';
  }
  if (typed !== null && typed !== undefined && typed !== '' && Number(Number(typed).toFixed(decimals)) !== Number(Number(reading.value).toFixed(decimals))) return 'changed';
  return 'fresh';
}
export function readingProblem(reading, value, { now, decimals = 0 } = {}) {
  if (!reading) return null;
  if (!reading.source) return 'A reading needs its source’s name.';
  if (!Number.isFinite(reading.value)) return 'The source’s number isn’t a number.';
  const at = Date.parse(reading.at);
  if (Number.isNaN(at) || (now && (at > Date.parse(now) + DAY || at < Date.parse(now) - READING_MAX_DAYS * DAY))) return 'The reading’s time isn’t one Faro can use.';
  const differs = Number(Number(value).toFixed(decimals)) !== Number(Number(reading.value).toFixed(decimals));
  if (differs && !reading.why) return `${reading.source} said ${n(reading.value, decimals)}. Say why your number is different.`;
  if (differs && reading.why?.kind === 'else' && String(reading.why.text || '').trim().length < 10) return `Say more about why your number is different from what ${reading.source} said, in at least 10 characters.`;
  if (reading.why?.text && reading.why.text.length > 500) return 'Keep the reason to 500 characters or fewer.';
  return null;
}
export function keptReading(reading, value, decimals = 0) {
  if (!reading) return null;
  const differs = Number(Number(value).toFixed(decimals)) !== Number(Number(reading.value).toFixed(decimals));
  const r = { source: reading.source, value: reading.value, at: reading.at };
  if (differs && reading.why) r.why = reading.why.kind === 'else' ? { kind: 'else', text: reading.why.text } : { kind: reading.why.kind };
  return r;
}
export function readingLine(ck, unit, sayWhen) {
  const r = ck.reading; if (!r) return '';
  const u = (v) => fmt(v, unit, 0);
  if (!r.why) return `${u(ck.value)}, from ${r.source}, read ${sayWhen(r.at)}. Confirmed by you.`;
  const why = r.why.kind === 'else' ? r.why.text : READING_WHY[r.why.kind];
  const w = String(why); return `${u(ck.value)}, typed. ${r.source} said ${u(r.value)}: ${w[0].toLowerCase()}${w.slice(1)}.`;
}
