// Finding things (spec/core/rules/finding.md): one search per kind, a key, a near miss, Find from anywhere.

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Words break at spaces and / - , . : ( ), except a point or comma between two digits.
export function wordsOf(text) {
  const t = fold(text);
  const out = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    const sep = /[\s/\-,.:()]/.test(ch);
    if (sep && (ch === '.' || ch === ',') && /\d/.test(t[i - 1] ?? '') && /\d/.test(t[i + 1] ?? '')) { cur += ch; continue; }
    if (sep) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function matches(rowWords, q) {
  const qs = wordsOf(q);
  return qs.every((w) => rowWords.some((rw) => rw.startsWith(w)));
}

// A whole search that is one key: "G-48", "g48", "g-48", "48".
export function keyOf(q) {
  const m = String(q).trim().match(/^(?:g-?)?(\d+)$/i);
  return m ? `G-${Number(m[1])}` : null;
}

function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff = [];
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0, j = 0, skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; } else { if (skipped) return false; skipped = true; j++; }
  }
  return true;
}

// The near miss: only when nothing matches. rowsWords: array of word arrays.
export function nearMiss(rowsWords, q) {
  if (keyOf(q)) return null;
  const typed = wordsOf(q);
  if (!typed.length) return null;
  const count = new Map();
  for (const ws of rowsWords) for (const w of ws) count.set(w, (count.get(w) || 0) + 1);
  const all = [...count.keys()];
  let changed = false;
  const fixed = [];
  for (const w of typed) {
    if (all.some((x) => x.startsWith(w))) { fixed.push(w); continue; }
    if (w.length < 4) return null;
    let best = null;
    for (const x of all) {
      if (!oneEdit(w, x)) continue;
      const n = count.get(x);
      if (!best || n > best.n || (n === best.n && x < best.x)) best = { x, n };
    }
    if (!best) return null;
    fixed.push(best.x); changed = true;
  }
  return changed ? fixed.join(' ') : null;
}

// search(rows, q): rows are [{ id, words, ... }] already in the kind's order. Returns { total, ids, near, rows }.
export function search(rows, q, { keyRow } = {}) {
  if (keyRow !== undefined) {
    const k = keyOf(q);
    if (k) {
      const hit = rows.find((r) => r.key === k);
      if (hit) return { total: 1, rows: [hit], near: null };
    }
  }
  const found = rows.filter((r) => matches(r.words, q));
  if (found.length || !String(q).trim()) return { total: found.length, rows: found, near: null };
  const near = nearMiss(rows.map((r) => r.words), q);
  if (!near) return { total: 0, rows: [], near: null };
  const again = rows.filter((r) => matches(r.words, near));
  return { total: again.length, rows: again, near };
}

export const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };
export const STATUS_RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };
export const LEVEL_WORD = { 'north-star': 'North star', svp: 'SVP', team: 'Team' };
export const byTitle = (a, b) => { const x = fold(a.title), y = fold(b.title); return x < y ? -1 : x > y ? 1 : 0; };
export const worstFirst = (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || byTitle(a, b);

// Goal rows: { id, key, title, status, words }. ctx gives people/teams by id; states: [{ g, status, latest }]
export function goalRows(states, { personById, teamById }) {
  return states.map(({ g, status, latest }) => {
    const owner = personById.get(g.ownerId), team = teamById.get(g.teamId);
    const text = [g.title, g.key, owner?.name, team?.name, LEVEL_WORD[g.level] ?? g.level, STATUS_WORD[status],
      latest?.why, latest?.pathToGreen?.what, latest?.pathToGreen?.needs, g.definition, g.source, g.unit].filter(Boolean).join(' ');
    return { id: g.id, key: g.key, title: g.title, status, words: wordsOf(text), g };
  }).sort(worstFirst);
}

export function personRows(people, teamById, q = '') {
  const live = people.filter((p) => !p.leftAt && !p.removedAt);
  const rows = live.map((p) => ({ id: p.id, name: p.name, words: wordsOf([p.name, p.role, teamById.get(p.teamId)?.name].filter(Boolean).join(' ')), p }));
  const qs = fold(q).trim();
  const starts = (r) => (qs && fold(r.name).startsWith(qs) ? 0 : 1);
  return rows.sort((a, b) => starts(a) - starts(b) || (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0));
}

export function teamRows(teams, personById) {
  return teams.filter((t) => !t.removedAt).map((t) => ({ id: t.id, name: t.name, words: wordsOf([t.name, personById.get(t.leadId)?.name].filter(Boolean).join(' ')), t }))
    .sort((a, b) => (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0));
}

// The count line and the nothing-found words (the list bar).
export function countLine(n, thing, things, order, narrowed, page) {
  if (!n) return '';
  if (narrowed) return n === 1 ? `1 ${thing} matches.` : `${n} ${things} match.`;
  const base = n === 1 ? `1 ${thing}.` : `${n} ${things}, ${order}.`;
  return page && n > page.size ? `${base} Showing ${page.from} to ${Math.min(n, page.from + page.size - 1)}.` : base;
}
export function nothingLine(thing, things, q, filtered, near) {
  if (near) return `No ${thing} matches “${q}”. Showing ${things} that match “${near}”.`;
  if (q && filtered) return `No ${thing} matches “${q}” with these filters.`;
  if (q) return `No ${thing} matches “${q}”.`;
  return filtered ? `No ${things} match these filters.` : '';
}
