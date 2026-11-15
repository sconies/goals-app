// The builders' inbox: every markup and piece of feedback sent, from every workspace and the demo, and the one status rule
// the page, the batch and the AI tools all go through. Pure over the store it is given: no screens, no network.
// It belongs to no workspace: switching Feedback off in one leaves all of it here.

export const STATUSES = ['new', 'in-hand', 'fixed', 'wont-fix'];
export const WORD = { new: 'New', 'in-hand': 'In hand', fixed: 'Fixed', 'wont-fix': 'Won’t fix' };
export const TAB_OF = { new: 'new', 'in-hand': 'in-hand', fixed: 'closed', 'wont-fix': 'closed' };
export const TABS = [['new', 'New'], ['in-hand', 'In hand'], ['closed', 'Closed']];
export const MOODS = { good: 'It works well', meh: 'It’s OK', bad: 'It gets in the way' };
export const PAGE_SIZE = 25;

export function makeStore() {
  return { markups: [], feedback: [], seq: 0, undo: new Map(), pictures: new Map(), pictureReads: [] };
}
export const newId = (store, kind) => `${kind === 'markup' ? 'mk' : 'fb'}_${(++store.seq).toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 8)}`;
export const all = (store) => [...store.markups, ...store.feedback];
export const byId = (store, id) => all(store).find((x) => x.id === id);

// what a markup is about: the first named part its marks cover, as a path (Goal page › Scorecard), else its page
export const partOf = (m) => {
  const path = (m.parts || []).flat().sort((a, b) => b.length - a.length)[0];
  return path && path.length ? path.join(' › ') : '';
};
export const foldKey = (m) => (m.kind === 'markup' && partOf(m) ? `${m.route}|${partOf(m)}` : null);
export const said = (x) => (x.kind === 'markup' ? x.line : x.text);
export const fromWhere = (x) => (x.demo ? 'the demo' : x.workspaceName || 'a workspace');

// The one status rule. Returns { error } or { changed, before } (before: what Undo puts back).
export function setStatus(item, { status, fixedIn, reason }, by, at, via = 'app') {
  if (!STATUSES.includes(status)) return { error: 'Status is new, in-hand, fixed or wont-fix.' };
  if (status === 'fixed' && !String(fixedIn || '').trim()) return { error: 'Say which What’s new entry has the fix.' };
  if (status === 'wont-fix' && !String(reason || '').trim()) return { error: 'Say why it won’t be fixed.' };
  const before = snapshot(item);
  if (item.status === status && (status !== 'fixed' || item.fixedIn === fixedIn) && (status !== 'wont-fix' || item.reason === reason.trim())) return { changed: false, before };
  item.status = status;
  item.fixedIn = status === 'fixed' ? String(fixedIn).trim() : null;
  item.reason = status === 'wont-fix' ? String(reason).trim() : null;
  item.statusBy = by; item.statusAt = at; item.statusVia = via;
  item.history.push({ status, by, at, via, fixedIn: item.fixedIn, reason: item.reason });
  return { changed: true, before };
}
export const snapshot = (x) => ({ id: x.id, status: x.status, fixedIn: x.fixedIn, reason: x.reason, statusBy: x.statusBy, statusAt: x.statusAt, statusVia: x.statusVia, issueUrl: x.issueUrl });
// Undo puts back what a change replaced, through the same rule's record (the history says it was undone)
export function restore(item, before, by, at) {
  Object.assign(item, { status: before.status, fixedIn: before.fixedIn, reason: before.reason, statusBy: before.statusBy, statusAt: before.statusAt, statusVia: before.statusVia, issueUrl: before.issueUrl });
  item.history.push({ status: before.status, by, at, undo: true });
}
export const ISSUE_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;

// ---------- the list: filters, tabs, folding, pages ----------
export function matches(x, { q = '', kind = 'all', who = '' } = {}) {
  if (kind === 'markups' && x.kind !== 'markup') return false;
  if (kind === 'feedback' && x.kind !== 'feedback') return false;
  if (who && !String(x.personName || '').toLowerCase().startsWith(who.toLowerCase()) && x.personName !== who) return false;
  if (q) {
    const hay = [said(x), partOf(x), x.route, x.path, x.pageName, x.personName, ...(x.strokes || []).map((s) => s.text || '')].join(' ').toLowerCase();
    if (!q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}
const hash = (s) => { let h = 5381; for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
// rows: markups on the same part of the same page fold into one, newest first
export function rowsOf(items) {
  const rows = [], byKey = new Map();
  for (const x of [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1))) {
    const k = foldKey(x);
    if (k && byKey.has(k)) { byKey.get(k).items.push(x); continue; }
    const row = { key: k ? `p_${hash(k)}` : x.id, items: [x] };
    if (k) byKey.set(k, row);
    rows.push(row);
  }
  return rows;
}
export function view(store, Q) {
  const filtered = all(store).filter((x) => matches(x, Q));
  const counts = Object.fromEntries(TABS.map(([t]) => [t, filtered.filter((x) => TAB_OF[x.status] === t).length]));
  const rows = rowsOf(filtered.filter((x) => TAB_OF[x.status] === Q.tab));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Q.page || 1), pages);
  return { counts, rows, page, pages, shown: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}
