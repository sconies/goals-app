// Saving an import (the engine's commit applied to the workspace, in one go), Past imports, and Undo
// with the rows changed since kept (core rule: undoing an import).
const clone = (x) => JSON.parse(JSON.stringify(x));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayWords = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const KIND = { goals: 'goals', checkIns: 'checkIns', people: 'people' };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// apply: every record replaced or added at once; one summary entry in the change log, every row under it
export function saveImport(ctx, res, info) {
  const { W } = ctx;
  const c = res.commit;
  if (!c) throw new Error('Nothing to save.');
  // a goal someone changed since the preview was made: refuse, nothing saved
  for (const e of c.expect?.goals || []) { const cur = W.goals.find((g) => g.id === e.id); if (cur && (cur.version ?? 0) !== (e.version ?? 0)) throw new Error('Someone else changed one of these goals since the file was checked. Check it again to see the latest.'); }
  const importId = `imp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const at = ctx.nowIso();
  const written = { goals: [], checkIns: [], people: [] };
  const undo = { goals: [], checkIns: [], people: [] };
  for (const kind of Object.keys(KIND)) {
    for (const rec of c[kind] || []) {
      const list = W[kind];
      const i = list.findIndex((r) => r.id === rec.id);
      const before = i >= 0 ? clone(list[i]) : null;
      const after = clone(rec);
      if (kind === 'goals') after.version = (before?.version ?? 0) + 1;
      if (i >= 0) list[i] = after; else list.push(after);
      written[kind].push(clone(after));
      undo[kind].push({ id: rec.id, before });
    }
  }
  const rows = res.items.length;
  const summary = { id: `chg_${importId}`, at, by: ctx.viewer, kind: 'import', importId, what: `imported ${info.file}`, file: info.file, via: info.via || 'Spreadsheet',
    describe: info.describe, rowsLine: `${rows} changed, ${res.unchanged} unchanged${info.leftOut ? `, ${info.leftOut} left out` : ''}`, saved: rows, unchanged: res.unchanged, leftOut: info.leftOut || 0, leftRows: info.leftRows || [], undo, written };
  const rowEntries = res.items.map((it, n) => ({ id: `chg_${importId}_${n}`, at, by: ctx.viewer, kind: 'import-row', importId, goalId: it.sheet === 'People' ? null : it.target, what: `${it.kind}: ${it.name}`, diffs: it.diffs }));
  W.changes.unshift(summary, ...rowEntries);
  return summary;
}

export const pastImports = (W) => W.changes.filter((c) => c.kind === 'import');
export const canUndo = (ctx, imp) => !imp.undoneAt && (imp.by === ctx.viewer || !!ctx.W.people.find((p) => p.id === ctx.viewer)?.admin);

// what Undo would do: { restores, skipped: [{ kind, id, name, why }] }
export function undoPreview(ctx, imp) {
  const { W } = ctx;
  const person = (id) => W.people.find((p) => p.id === id)?.name ?? id;
  const restores = [], skipped = [];
  const ownCk = new Set((imp.written.checkIns || []).map((c) => c.id));
  for (const kind of Object.keys(KIND)) {
    imp.written[kind].forEach((w, i) => {
      const cur = W[kind].find((r) => r.id === w.id);
      const name = kind === 'checkIns' ? `${W.goals.find((g) => g.id === w.goalId)?.title ?? w.goalId}, week ${w.week}` : kind === 'goals' ? w.title : w.name;
      let why = null;
      if (cur && !same(cur, w)) {
        const changed = Object.keys({ ...cur, ...w }).filter((k) => !same(cur[k], w[k]) && !['version'].includes(k));
        why = kind === 'checkIns' ? `The check-in was corrected on ${dayWords(cur.updatedAt || cur.postedAt)}` : `Its ${changed[0] || 'record'} was changed since`;
      }
      if (!why && kind === 'goals' && !imp.undo.goals[i].before) {
        const since = W.checkIns.filter((c) => c.goalId === w.id && !c.removedAt && !ownCk.has(c.id)).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))[0];
        if (since) why = `${person(since.authorId)} posted a check-in for week ${since.week} on ${dayWords(since.postedAt)}`;
      }
      if (why) skipped.push({ kind, id: w.id, name, why });
      else restores.push({ kind, id: w.id, name, before: imp.undo[kind][i].before });
    });
  }
  return { restores, skipped };
}

export function undoImport(ctx, imp) {
  const { W } = ctx;
  if (!canUndo(ctx, imp)) throw new Error('Only whoever made the import, or an admin, can undo it.');
  const p = undoPreview(ctx, imp);
  if (!p.restores.length) throw new Error(imp.saved ? 'Nothing left to undo: every row has changed since.' : 'Nothing to undo: it changed no rows.');
  for (const r of p.restores) {
    const list = W[r.kind];
    const i = list.findIndex((x) => x.id === r.id);
    if (r.before) { if (i >= 0) list[i] = { ...clone(r.before), version: (list[i].version ?? 0) + 1 }; else list.push(clone(r.before)); }
    else if (i >= 0) {
      if (r.kind === 'goals') { const g = list[i]; for (const k of W.goals) if (k.parentId === g.id) k.parentId = g.parentId ?? null; }
      list.splice(i, 1);
    }
  }
  imp.undoneAt = ctx.nowIso(); imp.undoneBy = ctx.viewer; imp.undoneRows = p.restores.length; imp.kept = p.skipped;
  W.changes.unshift({ id: `chg_undo_${imp.importId}`, at: imp.undoneAt, by: ctx.viewer, kind: 'import-undone', importId: imp.importId, what: `undid the import of ${imp.file}: ${p.restores.length} row${p.restores.length === 1 ? '' : 's'} put back${p.skipped.length ? `, ${p.skipped.length} kept` : ''}` });
  return p;
}
