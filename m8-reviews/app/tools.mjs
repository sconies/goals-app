// The core's AI tools (a small subset of spec/core/tools.md), as the person calling them, through the same save.
import { MODULES, isOn } from '../modules.mjs';

const askOut = (W, a) => {
  const r = a.reviewId && isOn(W, 'reviews') ? (W.reviews || []).find((x) => x.id === a.reviewId) : null;
  return { id: a.id, kind: a.kind, ask: a.ask, goals: a.goalIds, askedBy: a.askedBy, recipient: a.recipientId, status: a.status, dueWeek: a.dueWeek, ...(r ? { review: r.name } : {}) };
};

export const CORE_TOOLS = {
  describe_system(ctx) {
    const { W } = ctx;
    return { workspace: ctx.wsName, modules: MODULES.map((m) => ({ id: m.id, name: m.label, on: isOn(W, m.id) })), says: MODULES.filter((m) => !isOn(W, m.id)).map((m) => `${m.label} is off here.`).join(' ') };
  },
  get_goal(ctx, { goal }) {
    const { W, R } = ctx;
    const g = R.findGoal(goal);
    if (!g) return { error: `No goal ${goal}.` };
    const s = ctx.core.goalInfo(ctx, g);
    const out = { id: g.id, key: g.key, title: g.title, owner: g.ownerId, status: s.status, asks: (W.requests || []).filter((a) => a.goalIds.includes(g.id) && a.status === 'open').map((a) => askOut(W, a)) };
    // What was said in reviews is Reviews': left out while it is off (the JSON export does the same).
    if (isOn(W, 'reviews')) out.notes = (W.decisions || []).filter((d) => d.goalId === g.id && d.kind === 'note' && !d.removedAt).map((d) => ({ id: d.id, review: d.reviewId, week: d.week, by: d.byId, note: d.note }));
    return out;
  },
  list_requests(ctx) {
    const { W } = ctx;
    return { asks: (W.requests || []).filter((a) => a.status === 'open' && a.recipientId === ctx.viewer).map((a) => askOut(W, a)) };
  },
  // Correct the words of something said: a note (a decision) or an ask. Whoever said it, or an admin.
  edit_call(ctx, { id, text }) {
    const { W } = ctx;
    const d = (W.decisions || []).find((x) => x.id === id);
    const a = (W.requests || []).find((x) => x.id === id);
    const rec = d || a;
    if (!rec) return { error: `Nothing with the id ${id}.` };
    if (!String(text || '').trim()) return { error: 'Write a few words.' };
    const by = d ? d.byId : a.askedBy;
    if (by !== ctx.viewer && !ctx.isAdmin) return { error: 'Only whoever said it, or an admin, can correct it.' };
    const commit = d ? { decisions: [{ ...d, note: text, editedAt: ctx.nowIso() }], changes: [{ what: `corrected a note on ${ctx.R.goalById.get(d.goalId)?.title}`, entity: 'note', goalId: d.goalId }] }
      : { requests: [{ ...a, ask: text, updatedAt: ctx.nowIso() }], changes: [{ what: `corrected an ask on ${ctx.R.goalById.get(a.goalIds[0])?.title}`, entity: 'request', goalId: a.goalIds[0] }] };
    const r = ctx.core.save(ctx, commit);
    if (r.error) return r;
    return { ok: true, saved: id };
  },
  export_json(ctx) { return ctx.core.exportJson(ctx); },
};
