// Stage 2: the goals store, in memory. From spec/conformance/contracts/store.json's ops and
// spec/rebuild/stage-2-core-data.md ("What to build"). Any database or none: this one keeps JSON.
import crypto from 'node:crypto';

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const REF_FIELDS = ['teamId', 'ownerId', 'cycleId', 'parentId', 'goalId', 'personId', 'authorId', 'leadId', 'recipientId', 'askedBy', 'byId'];
const VERSIONED = new Set(['goals', 'reviews']);
const DAY = 86400000;
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const lastDayOf = (c) => dayNum(c.startDate) + (c.weeks + 1) * 7 - 1;
const byNewest = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const isAnchor = (ch) => ['note', 'comment', 'ask', 'request', 'cycle'].includes(ch.entity) || ['imported', 'undone'].includes(ch.action) || ch.undo !== undefined;

export class Store {
  constructor() { this.ws = new Map(); } // id -> { workspace, data: { kind: rows[] | value, modules: { m: { key: rows[] } } } }

  workspaces() { return [...this.ws.values()].map(({ workspace: w }) => ({ id: w.id, name: w.name, kind: w.kind, createdAt: w.createdAt })); }

  createWorkspace(workspace, snapshot) {
    if (this.ws.has(workspace.id)) throw new Error(`There’s already a workspace ${workspace.id}.`);
    const data = clone(snapshot) || {};
    data.modules = data.modules || {};
    this.ws.set(workspace.id, { workspace: clone(workspace), data });
    this.#checkApart(workspace.id, data);
  }

  deleteWorkspace(id) { this.ws.delete(id); }

  #get(id) { const w = this.ws.get(id); if (!w) throw new Error(`No workspace ${id}.`); return w; }

  // every id kept under each workspace, by kind
  #ids(data) {
    const s = new Set();
    for (const [k, v] of Object.entries(data)) {
      if (k === 'modules') { for (const m of Object.values(v || {})) for (const rows of Object.values(m || {})) for (const r of rows || []) if (r?.id) s.add(r.id); continue; }
      if (Array.isArray(v)) for (const r of v) if (r?.id) s.add(r.id);
    }
    return s;
  }

  // a save whose records name a record kept under another workspace is refused whole
  #checkApart(wsId, commitData, own = null) {
    const mine = own ?? this.#ids(this.#get(wsId).data);
    for (const id of this.#ids(commitData)) mine.add(id);
    const others = new Set();
    for (const [id, w] of this.ws) if (id !== wsId) for (const x of this.#ids(w.data)) others.add(x);
    const rows = [];
    for (const [k, v] of Object.entries(commitData)) {
      if (k === 'modules') { for (const m of Object.values(v || {})) for (const rs of Object.values(m || {})) rows.push(...(rs || [])); continue; }
      if (Array.isArray(v) && k !== 'changes') rows.push(...v);
    }
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      if (r.id && others.has(r.id) && !this.#ids(this.#get(wsId).data).has(r.id)) throw new Error(`${r.id} is kept under another workspace: nothing was saved.`);
      for (const f of REF_FIELDS) { const v = r[f]; if (typeof v === 'string' && others.has(v) && !mine.has(v)) throw new Error(`${f} ${v} names a record kept under another workspace: nothing was saved.`); }
    }
  }

  commit(wsId, commit) {
    const w = this.#get(wsId);
    const c = clone(commit) || {};
    // stale: a goal or review it expects has moved on
    for (const [kind, list] of Object.entries(c.expect || {})) {
      for (const e of list || []) {
        const cur = (w.data[kind] || []).find((r) => r.id === e.id);
        if (cur && (cur.version ?? 0) !== (e.version ?? 0)) throw new Error(`Someone else changed ${e.id} since you opened it. Reload to see the latest.`);
      }
    }
    const body = { ...c }; delete body.expect;
    this.#checkApart(wsId, body);
    // all checks passed: apply on a copy, then swap (whole or not at all)
    const next = clone(w.data);
    for (const [kind, val] of Object.entries(body)) {
      if (kind === 'modules') {
        for (const [m, keys] of Object.entries(val || {})) {
          next.modules[m] = next.modules[m] || {};
          for (const [key, rows] of Object.entries(keys || {})) next.modules[m][key] = upsert(next.modules[m][key] || [], rows || [], false);
        }
        continue;
      }
      if (kind === 'changes') { next.changes = upsert(next.changes || [], val || [], false); continue; }
      if (!Array.isArray(val)) { next[kind] = val; continue; }
      next[kind] = upsert(next[kind] || [], val, VERSIONED.has(kind));
    }
    w.data = next;
  }

  issueToken(wsId, commit) {
    const c = clone(commit);
    for (const t of c.tokens || []) { delete t.secret; delete t.token; }
    this.commit(wsId, c);
    return crypto.randomBytes(24).toString('base64url');
  }

  load(wsId, window) {
    const d = clone(this.#get(wsId).data);
    if (!window) return d;
    const from = window.from, fromDay = dayNum(from);
    const cycles = d.cycles || [];
    const goalCycle = new Map((d.goals || []).map((g) => [g.id, g.cycleId]));
    const newestTwo = new Set([...cycles].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)).slice(0, 2).map((c) => c.id));
    const keepCycle = new Set(cycles.filter((c) => lastDayOf(c) >= fromDay || newestTwo.has(c.id)).map((c) => c.id));
    const withCk = new Set();
    for (const ck of d.checkIns || []) { const cy = goalCycle.get(ck.goalId); if (cy) withCk.add(cy); }
    d.checkIns = (d.checkIns || []).filter((ck) => keepCycle.has(goalCycle.get(ck.goalId)));
    d.changes = (d.changes || []).filter((ch) => ch.at >= from || isAnchor(ch));
    d.history = { from, checkInCycles: [...withCk].sort() };
    return d;
  }

  history(wsId, { before, goalId, size } = {}) {
    const n = Math.min(100, Math.max(1, size ?? 50));
    let list = [...(this.#get(wsId).data.changes || [])].sort(byNewest);
    if (goalId) list = list.filter((c) => c.goalId === goalId);
    if (before) list = list.filter((c) => c.at < before.at || (c.at === before.at && c.id < before.id));
    const page = list.slice(0, n);
    const next = list.length > n ? { at: page[page.length - 1].at, id: page[page.length - 1].id } : null;
    return { changes: clone(page), next };
  }
}

// each row replaces the stored row with its id, or is added; every other row stays as it is
function upsert(rows, incoming, versioned) {
  const out = [...rows];
  for (const r of incoming) {
    const i = out.findIndex((x) => x.id === r.id);
    const row = clone(r);
    if (versioned) row.version = (i >= 0 ? out[i].version ?? 0 : 0) + 1;
    if (i >= 0) out[i] = row; else out.push(row);
  }
  return out;
}
