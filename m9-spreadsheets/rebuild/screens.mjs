// Stage 3: the screens' rules (navigation, finding, Home, the read-back), from spec/ alone.
// Pure functions over the workspace and stage 1's rules (S1). The app (app/) and the drill both call these.
import { modulesOn, MODULE_IDS } from './platform.mjs';

// ---------- levels ----------
export const DEFAULT_LEVELS = [
  { id: 'north-star', name: 'North star', article: 'a north star' },
  { id: 'svp', name: 'SVP', article: 'an SVP goal' },
  { id: 'team', name: 'Team', article: 'a Team goal' },
];
export const levelsOf = (W) => (W.cycle && W.cycle.levels && W.cycle.levels.length ? W.cycle.levels : DEFAULT_LEVELS);
export const levelName = (W, id) => (levelsOf(W).find((l) => l.id === id) || { name: id }).name;

export const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };
export const STATUS_RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };

// ---------- navigation (rules/navigation.md) ----------
export const CORE_GROUPS = [
  ['home', 'checkin', 'goals', 'reviews'],
  ['people', '@modules', 'activity', 'data'],
  ['new'],
  ['workspace', 'settings', 'help', 'feedback'],
];
// items that belong to a module: shown only while it is on
const ITEM_MODULE = { reviews: 'reviews', feedback: 'feedback' };

export function menuFor({ ownsGoals, on, modules = [], views = [] }) {
  const groups = CORE_GROUPS.map((g) => {
    const out = [];
    for (const it of g) {
      if (it === '@modules') { for (const m of modules) if (on(m.id) && (m.group || 'lookup') === 'lookup') out.push(`module:${m.id}`); continue; }
      if (it === 'checkin' && !ownsGoals) continue;
      if (ITEM_MODULE[it] && !on(ITEM_MODULE[it])) continue;
      out.push(it);
      if (it === 'goals') for (const v of views.slice(0, 4)) out.push(`view:${v.id}`);
      if (it === 'reviews' || (it === 'goals' && !on('reviews') && g.includes('reviews'))) {
        if (it === 'reviews') for (const m of modules) if (on(m.id) && m.group === 'work') out.push(`module:${m.id}`);
      }
    }
    if (g.includes('reviews') && !on('reviews')) for (const m of modules) if (on(m.id) && m.group === 'work') out.push(`module:${m.id}`);
    return out;
  });
  return groups;
}
export function tabsFor({ ownsGoals, on }) {
  if (on('reviews')) return ownsGoals ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'reviews', 'people'];
  return ownsGoals ? ['home', 'checkin', 'goals', 'people'] : ['home', 'goals', 'people', 'activity'];
}

function splitAddress(address) {
  const [p, qs = ''] = address.split('?');
  const q = new URLSearchParams(qs);
  const parts = p.split('/').filter(Boolean);
  return { path: p, parts, q };
}

// which item an address belongs to (before checking it is in the viewer's menu)
export function placeOf(address, { on, modules = [], views = [] }) {
  const { path, parts, q } = splitAddress(address);
  const view = views.find((v) => v.address === address);
  if (view) return `view:${view.id}`;
  for (const m of modules) if (path === m.to || path.startsWith(m.to + '/')) return `module:${m.id}`;
  if (path === '/') return 'home';
  const [a, b, c] = parts;
  if (a === 'goals') {
    if (b === 'new') return 'new';
    if (b && q.get('review') && on('reviews')) return 'reviews';
    return 'goals';
  }
  if (a === 'retro' || a === 'watching') return 'goals';
  if (a === 'check-in' || a === 'quick-check-in') return 'checkin';
  if (a === 'reviews') return 'reviews';
  if (a === 'people' || a === 'teams') return 'people';
  if (a === 'activity') return 'activity';
  if (a === 'data') return 'data';
  if (a === 'workspace') return b === 'new' ? null : 'workspace';
  if (a === 'settings') return 'settings';
  if (a === 'help' || a === 'whats-new') return 'help';
  if (a === 'feedback') return 'feedback';
  return null;
}
export function litFor(address, ctx, menu) {
  const p = placeOf(address, ctx);
  if (!p) return '';
  return menu.flat().includes(p) ? p : '';
}
export function litTab(lit, tabs) {
  if (!lit) return '';
  return tabs.includes(lit) ? lit : 'more';
}

const FIXED = { '/': 'Home', '/goals': 'Goals', '/watching': 'Goals', '/goals/new': 'New goal', '/check-in': 'Check-in', '/quick-check-in': 'Check-in, all in one table',
  '/reviews': 'Reviews', '/reviews/new': 'New review', '/people': 'People', '/teams': 'Teams', '/activity': 'Activity', '/data': 'Data', '/workspace': 'Workspace',
  '/workspace/new': 'Set up a workspace', '/settings': 'Settings', '/help': 'Help', '/whats-new': 'What’s new', '/feedback': 'Feedback', '/research': 'Research', '/ready': 'Ready to start' };
export const NEW_GOAL_STEPS = { what: 'What do you want to achieve?', who: 'Who and where', measure: 'How it’s measured', check: 'Check and publish' };

export function findGoal(W, ref) {
  if (!ref) return null;
  const goals = W.goals || [];
  return goals.find((g) => g.id === ref && !g.removedAt) || goals.find((g) => !g.removedAt && keyNorm(g.key) === keyNorm(ref)) || null;
}
const keyNorm = (k) => { const m = /^g-?(\d+)$/i.exec(String(k).trim()); return m ? `G-${Number(m[1])}` : String(k); };

// rule 2: a page's name. `on` only matters for a module's own addresses being Page not found
export function pageName(W, address, { modules = [], on = () => true, sections = {} } = {}) {
  const { path, parts, q } = splitAddress(address);
  for (const m of modules) if (path === m.to || path.startsWith(m.to + '/')) return on(m.id) ? (m.pageName ? m.pageName(W, path) : m.label) : 'Page not found';
  if (FIXED[path]) return FIXED[path];
  const [a, b, c] = parts;
  const goal = (id) => findGoal(W, id);
  if (a === 'goals' && b) {
    if (b === 'new') return NEW_GOAL_STEPS[c] || 'New goal';
    const g = goal(b);
    if (!g) return 'Goal not found';
    if (c === 'edit') return `Change ${g.title}`;
    if (c === 'print') return `${g.title}, to print`;
    const rv = q.get('review');
    if (rv) { const r = (W.reviews || []).find((x) => x.id === rv); if (r) return `${g.title} · ${r.name}`; }
    return g.title;
  }
  if (a === 'check-in' && b) { const g = goal(b); return g ? `Check in: ${g.title}` : 'Goal not found'; }
  if (a === 'retro') { if (!b) return 'Wrap up'; if (/^\d{4}$/.test(b)) return `Wrap up ${b}`; const g = goal(b); return g ? `Wrap up: ${g.title}` : 'Goal not found'; }
  if (a === 'reviews' && b) {
    const r = (W.reviews || []).find((x) => x.id === b);
    if (!r) return 'Review not found';
    if (c === 'edit') return `Change ${r.name}`;
    if (c === 'summary') return `${r.name}: summary`;
    if (c === 'print') return `${r.name}, to print`;
    return r.name;
  }
  if (a === 'people' && b) { const p = (W.people || []).find((x) => x.id === b); return p ? p.name : 'Person not found'; }
  if (a === 'teams' && b) { const t = (W.teams || []).find((x) => x.id === b); return t ? t.name : 'Team not found'; }
  if (a === 'workspace' && b) {
    if (b === 'cycles' && c === 'next') return 'Start the next year · Workspace';
    if (b === 'new') return 'Set up a workspace';
    return sections[b] ? `${sections[b]} · Workspace` : 'Workspace';
  }
  if (a === 'help' && b) return 'Help';
  return 'Page not found';
}
export const browserTitle = (name, wsName) => `${name} · ${wsName} · Faro`;

// rule 4: the back link. history: earlier addresses in this tab, oldest first (not including this one)
const FIRST_PAGES = new Set(['/', '/check-in', '/goals', '/reviews', '/people', '/teams', '/activity', '/data', '/workspace', '/settings', '/help', '/feedback', '/watching']);
export const isForm = (address) => {
  const { path, parts } = splitAddress(address);
  return parts[0] === 'check-in' || path === '/quick-check-in' || path.startsWith('/goals/new') || /\/edit$/.test(path) || path.startsWith('/workspace/new') || parts[0] === 'retro' || path === '/reviews/new';
};
export function backLink(W, address, history = [], ctx = {}) {
  const { path, parts, q } = splitAddress(address);
  if (FIRST_PAGES.has(path) || isForm(address)) return null;
  for (const m of ctx.modules || []) if (path === m.to) return null;
  const same = (a) => {
    if (a === address) return true;
    const rv = q.get('review');
    if (rv && parts[0] === 'goals') { const s = splitAddress(a); return s.parts[0] === 'goals' && s.q.get('review') === rv && s.parts.length === 2; }
    return false;
  };
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (isForm(h) || same(h)) continue;
    return { label: backWords(W, h, ctx), steps: history.length - i };
  }
  const parent = parentOf(W, address, ctx);
  return { label: backWords(W, parent, ctx), to: parent };
}
function parentOf(W, address, ctx) {
  const { parts, q } = splitAddress(address);
  const [a, b, c] = parts;
  for (const m of ctx.modules || []) if (address.startsWith(m.to + '/')) return m.to;
  if (a === 'goals' && b) {
    const g = findGoal(W, b);
    if (q.get('review')) return `/reviews/${q.get('review')}`;
    if (c === 'print' && g) return `/goals/${g.id}`;
    if (g && g.parentId && findGoal(W, g.parentId)) return `/goals/${g.parentId}`;
    return '/goals';
  }
  if (a === 'reviews') return b && c === 'summary' ? `/reviews/${b}` : '/reviews';
  if (a === 'people') return '/people';
  if (a === 'teams') return '/teams';
  if (a === 'help' || a === 'whats-new') return '/help';
  if (a === 'workspace') return '/workspace';
  return '/';
}
function backWords(W, address, ctx) {
  const { path, q } = splitAddress(address);
  if (path === '/goals' && q.get('scope') === 'mine') return 'your goals';
  const v = (ctx.views || []).find((x) => x.address === address);
  if (v) return v.name;
  const n = pageName(W, address, ctx);
  return n;
}

// ---------- finding things (rules/finding.md) ----------
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function words(text) {
  const s = fold(text);
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const brk = /[\s/\-,.:()]/.test(ch);
    if (brk && (ch === '.' || ch === ',') && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) { cur += ch; continue; }
    if (brk) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
export const matches = (rowWords, q) => words(q).every((t) => rowWords.some((w) => w.startsWith(t)));
export const keyOfSearch = (q) => { const m = /^\s*(?:g-?)?(\d+)\s*$/i.exec(q || ''); return m ? `G-${Number(m[1])}` : null; };

function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff = [];
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
    return false;
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0, j = 0, skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; } else { if (skipped) return false; skipped = true; j++; }
  }
  return true;
}
export function nearMiss(rowsWords, q) {
  if (keyOfSearch(q)) return null;
  const counts = new Map();
  for (const ws of rowsWords) for (const w of ws) counts.set(w, (counts.get(w) || 0) + 1);
  const all = [...counts.keys()];
  const typed = words(q);
  let changed = false;
  const out = [];
  for (const t of typed) {
    if (all.some((w) => w.startsWith(t))) { out.push(t); continue; }
    if (t.length < 4) return null;
    let best = null;
    for (const w of all) if (oneEdit(t, w) && (!best || counts.get(w) > counts.get(best))) best = w;
    if (!best) return null;
    out.push(best); changed = true;
  }
  return changed ? out.join(' ') : null;
}

// the Search port's browser adapter: search(rows, ask)
export function searchRows(rows, ask, { order, keyOf } = {}) {
  const q = ask.q || '';
  const size = Math.min(ask.size || 50, 200);
  let found;
  const key = keyOfSearch(q);
  const byKey = key && keyOf ? rows.filter((r) => keyOf(r) === key) : [];
  if (byKey.length) found = byKey;
  else found = rows.filter((r) => matches(r.words, q));
  let near = null;
  if (!found.length && q.trim()) {
    near = nearMiss(rows.map((r) => r.words), q);
    if (near) found = rows.filter((r) => matches(r.words, near));
  }
  if (order) found = order(found, q);
  const start = ask.after ? found.findIndex((r) => r.id === ask.after) + 1 : 0;
  const page = found.slice(start, start + size);
  const next = start + size < found.length ? page[page.length - 1].id : null;
  return { total: found.length, rows: page, all: found, next, near };
}

const cmpTitle = (a, b) => (fold(a) < fold(b) ? -1 : fold(a) > fold(b) ? 1 : 0);
export function makeIndex(W, S1, moment) {
  const ws = S1.asOf(moment);
  const people = new Map((W.people || []).map((p) => [p.id, p]));
  const teams = new Map((W.teams || []).map((t) => [t.id, t]));
  const goalRows = ws.goals.map((g) => {
    const posted = ws.ckByGoal.get(g.id) || [];
    const st = S1.goalStatus(g, posted, moment);
    const latest = st.latest;
    const owner = people.get(g.ownerId), team = teams.get(g.teamId);
    const text = [g.title, g.key, owner && owner.name, team && team.name, levelName(W, g.level), STATUS_WORD[st.status],
      latest && latest.why, latest && latest.pathToGreen && latest.pathToGreen.what, latest && latest.pathToGreen && latest.pathToGreen.needs, g.definition, g.source, g.unit].filter(Boolean).join(' ');
    return { id: g.id, kind: 'goal', goal: g, status: st.status, st, words: words(text), title: g.title, line: `${g.key} · ${owner ? owner.name : ''} · ${team ? team.name : ''}` };
  });
  const personRows = (W.people || []).map((p) => {
    const team = teams.get(p.teamId);
    return { id: p.id, kind: 'person', person: p, left: !!p.leftAt, title: p.left || p.leftAt ? `${p.name} (left)` : p.name, words: words([p.name, p.jobTitle, team && team.name].filter(Boolean).join(' ')), line: [p.jobTitle, team && team.name].filter(Boolean).join(' · ') };
  });
  const teamRows = (W.teams || []).map((t) => {
    const lead = people.get(t.leadId);
    const n = (W.people || []).filter((p) => p.teamId === t.id && !p.leftAt).length;
    return { id: t.id, kind: 'team', team: t, title: t.name, words: words([t.name, lead && lead.name].filter(Boolean).join(' ')), line: `${lead ? `Led by ${lead.name}` : 'No lead'} · ${n} ${n === 1 ? 'person' : 'people'}` };
  });
  const goalOrder = (rs) => [...rs].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || cmpTitle(a.title, b.title));
  const personOrder = (rs, q) => {
    const t = fold(q).trim();
    return [...rs].sort((a, b) => (b.left ? 0 : 0) || (!!a.left - !!b.left) || ((t && !fold(b.person.name).startsWith(t)) - (t && !fold(a.person.name).startsWith(t))) || cmpTitle(a.person.name, b.person.name));
  };
  const teamOrder = (rs) => [...rs].sort((a, b) => cmpTitle(a.title, b.title));
  return {
    ws, goalRows, personRows, teamRows,
    search(kind, ask, { forPicker = true } = {}) {
      if (kind === 'goal') return searchRows(goalRows, ask, { order: goalOrder, keyOf: (r) => keyNorm(r.goal.key) });
      if (kind === 'person') return searchRows(forPicker ? personRows.filter((r) => !r.left) : personRows, ask, { order: personOrder });
      if (kind === 'team') return searchRows(teamRows, ask, { order: teamOrder });
      throw new Error(`No kind ${kind}`);
    },
  };
}

// Find from anywhere (rule 8): groups of three
export function findAnywhere(index, q, extraKinds = []) {
  const groups = [];
  for (const kind of ['goal', 'person', 'team']) {
    const r = index.search(kind, { q, size: 3 }, { forPicker: kind !== 'person' });
    if (r.total) groups.push({ kind, total: r.total, rows: r.rows, near: r.near });
  }
  for (const k of extraKinds) { const r = k.search({ q, size: 3 }); if (r.total) groups.push({ kind: k.kind, label: k.label, total: r.total, rows: r.rows, near: r.near }); }
  return groups;
}

// the list bar's words
export function countLine(n, thing, things, order, { narrowed = false, from = 0, size = 50 } = {}) {
  if (!n) return '';
  if (narrowed) return n === 1 ? `1 ${thing} matches.` : `${n} ${things} match.`;
  let s = n === 1 ? `1 ${thing}.` : `${n} ${things}, ${order}.`;
  if (n > size) s += ` Showing ${from + 1} to ${Math.min(n, from + size)}.`;
  return s;
}
export const filterLine = (filters) => (filters.length ? `Filtered by: ${filters.map((f) => `${f.label} ${f.values.join(' or ')}`).join(' · ')}` : '');
export function nothingLine(thing, things, q, near, hasFilters) {
  if (q && near) return `No ${thing} matches “${q}”. Showing ${things} that match “${near}”.`;
  if (q) return `No ${thing} matches “${q}”.${hasFilters ? ' with these filters.' : ''}`.replace('”. with', '” with');
  return `No ${things} match these filters.`;
}

export { MODULE_IDS, modulesOn };
