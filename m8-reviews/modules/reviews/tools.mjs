// Reviews' AI tools: the same rules as the screens, as the person calling them. While Reviews is off the core's
// dispatcher answers each with the switched-off sentence before any of these runs.
import * as RV from './rules.mjs';
import { where } from './pages.mjs';

const byId = (W, id) => (W.reviews || []).find((r) => (r.id === id || r.name === id) && !r.removedAt);
const out = (ctx, r) => { const x = where(ctx, r); return { id: r.id, name: r.name, cadence: RV.cadenceWords(r), people: r.people, goals: x.gl.length, session: RV.stateWords(x.st), reviewed: x.reviewed, openActions: RV.openActions(ctx.W, r), ended: !!r.endedAt }; };

export const tools = {
  list_reviews: (ctx) => ({ reviews: (ctx.W.reviews || []).filter((r) => !r.removedAt).map((r) => out(ctx, r)) }),
  get_review(ctx, { review }) {
    const r = byId(ctx.W, review);
    if (!r) return { error: `No review ${review}.` };
    const x = where(ctx, r);
    return { ...out(ctx, r), agenda: x.ordered.exceptions.map((g) => ({ id: g.id, title: g.title, reviewed: x.marked.has(g.id) })), nothingFlagged: x.ordered.healthy.length, said: x.week !== null ? RV.saidIn(ctx.W, r, x.week) : [] };
  },
  // Say something in a review: reviewed, a note, a question, a next step, or the risk accepted.
  review_call(ctx, { review, goal, kind = 'reviewed', text = '', who = null, week = null }) {
    const { W, R, core } = ctx;
    const r = byId(W, review);
    if (!r) return { error: `No review ${review}.` };
    if (!RV.canSpeakFor(W, r, ctx.viewer)) return { error: RV.speakRefusal(r) };
    const g = R.findGoal(goal);
    if (!g) return { error: `No goal ${goal}.` };
    const x = where(ctx, r);
    if (!x.gl.some((y) => y.id === g.id)) return { error: RV.scopeRefusal(r, g) };
    if (kind === 'risk' && String(text).trim().length < 5) return { error: 'Say why the review accepts the risk.' };
    if (x.week === null) return { error: 'No session of this review is under way.' };
    const dec = (k, note = '') => ({ id: core.newId('dec'), goalId: g.id, checkInId: null, reviewId: r.id, week: x.week, kind: k, byId: ctx.viewer, at: ctx.nowIso(), note });
    let commit;
    if (kind === 'reviewed') {
      const s = x.now.st.get(g.id);
      if (RV.needsDecision(s.status) && !RV.decisionFor(W, r, x.week, g, s.latest, ctx.week)) return { error: 'What happens next, who, by when? Add a next step or accept the risk first.' };
      commit = { decisions: [dec('acknowledge')], changes: [{ what: `marked ${g.title} reviewed in ${r.name} via MCP`, entity: 'review', goalId: g.id }] };
    } else if (kind === 'note' || kind === 'risk') {
      if (kind === 'risk' && text.trim().length < 5) return { error: 'Say why the review accepts the risk.' };
      if (!text.trim()) return { error: 'Write a few words.' };
      commit = { decisions: [dec('note', kind === 'risk' ? RV.ACCEPT + text.trim() : text.trim())], changes: [{ what: `${kind === 'risk' ? 'accepted the risk' : 'noted'} on ${g.title} in ${r.name} via MCP`, entity: 'note', goalId: g.id }] };
    } else if (kind === 'question' || kind === 'step') {
      if (!text.trim()) return { error: 'Write a few words.' };
      if (kind === 'step' && !(who && week)) return { error: 'Say who does it and the week it’s due by.' };
      commit = { requests: [{ id: core.newId('ask'), kind: kind === 'question' ? 'question' : 'action', goalIds: [g.id], askedBy: ctx.viewer, recipientId: kind === 'question' ? g.ownerId : who, ask: text.trim(), status: 'open', dueWeek: kind === 'step' ? Number(week) : null, reviewId: r.id, week: x.week, checkInId: null, createdAt: ctx.nowIso(), updatedAt: ctx.nowIso(), answer: null, answeredBy: null, answeredAt: null }], changes: [{ what: `${kind === 'question' ? 'asked a question' : 'agreed a next step'} on ${g.title} in ${r.name} via MCP`, entity: 'request', goalId: g.id }] };
    } else return { error: `No kind ${kind}.` };
    const res = core.save(ctx, commit);
    return res.error ? res : { ok: true };
  },
  unmark_reviewed(ctx, { review, goal }) {
    const { W, R, core } = ctx;
    const r = byId(W, review); const g = R.findGoal(goal);
    if (!r || !g) return { error: 'No such review or goal.' };
    if (!RV.canSpeakFor(W, r, ctx.viewer)) return { error: RV.speakRefusal(r) };
    const x = where(ctx, r);
    const recs = (W.decisions || []).filter((d) => d.reviewId === r.id && d.week === x.week && d.goalId === g.id && d.kind === 'acknowledge' && !d.removedAt).map((d) => ({ ...d, removedAt: ctx.nowIso(), removedBy: ctx.viewer }));
    const res = core.save(ctx, { decisions: recs, changes: [{ what: `unmarked ${g.title} in ${r.name} via MCP`, entity: 'review', goalId: g.id }] });
    return res.error ? res : { ok: true, unmarked: recs.length };
  },
  save_review(ctx, { review = null, name, everyWeeks = 1, weekday = 3, scope = { goals: [], trees: [], levels: [] }, people = [] }) {
    const old = review ? byId(ctx.W, review) : null;
    if (!String(name || old?.name || '').trim()) return { error: 'Give the review a name.' };
    if (!(everyWeeks >= 1 && everyWeeks <= 13) || !(weekday >= 0 && weekday <= 4)) return { error: 'Every 1 to 13 weeks, on a weekday.' };
    const rec = { ...(old || { id: `rv_mcp_${Date.now() % 1e6}`, createdBy: ctx.viewer, createdAt: ctx.nowIso() }), name: name || old.name, everyWeeks, weekday, scope, people: [...new Set([...(people || []), ...(old ? [] : [ctx.viewer])])], version: (old?.version || 0) + 1 };
    const res = ctx.core.save(ctx, { reviews: [rec], changes: [{ what: `${old ? 'changed' : 'set up'} the review ${rec.name} via MCP`, entity: 'review' }] });
    return res.error ? res : { ok: true, id: rec.id };
  },
  end_review(ctx, { review }) {
    const r = byId(ctx.W, review);
    if (!r) return { error: `No review ${review}.` };
    if (r.createdBy !== ctx.viewer && !ctx.isAdmin) return { error: 'Only whoever set it up, or an admin, can end it.' };
    const res = ctx.core.save(ctx, { reviews: [{ ...r, endedAt: ctx.nowIso(), endedBy: ctx.viewer }], changes: [{ what: `ended the review ${r.name} via MCP`, entity: 'review' }] });
    return res.error ? res : { ok: true };
  },
  delete_review(ctx, { review }) {
    const r = byId(ctx.W, review);
    if (!r) return { error: `No review ${review}.` };
    if ((ctx.W.decisions || []).some((d) => d.reviewId === r.id)) return { error: `${r.name} has been held, so it can be ended, not deleted.` };
    const res = ctx.core.save(ctx, { reviews: [{ ...r, removedAt: ctx.nowIso(), removedBy: ctx.viewer }], changes: [{ what: `deleted the review ${r.name} via MCP`, entity: 'review' }] });
    return res.error ? res : { ok: true };
  },
};
