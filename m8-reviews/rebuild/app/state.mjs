// The app's state: one workspace in memory (the demo), its change log, and the actions every door runs through.
// Saves go through the change engine (stage 2) so nothing it would refuse is saved, at every door.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeS1 } from '../rules.mjs';
import { planChanges } from '../engine.mjs';
import { INSTALLED, resolveModules, setModule, makeRegistry, W_ } from '../platform.mjs';
import { exampleModule } from './modules/example.mjs';
import { reviewsModule } from '../modules/reviews/module.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
export const KIT = path.resolve(here, '../../spec');

export function installedModules(without = process.env.FARO_WITHOUT ? process.env.FARO_WITHOUT.split(',') : []) {
  const code = [exampleModule, reviewsModule];
  // a module with code replaces its fact row from the installed table
  const fact = (m) => ({ id: m.id, name: m.name, group: m.group, summary: m.summary, needs: m.needs || [] });
  const facts = [...INSTALLED.map((f) => { const m = code.find((x) => x.id === f.id); return m ? fact(m) : f; }), ...code.filter((m) => !INSTALLED.some((f) => f.id === m.id)).map(fact)];
  return { facts: facts.filter((m) => !without.includes(m.id)), code: code.filter((m) => !without.includes(m.id)) };
}

export class App {
  constructor(wsFile = path.join(KIT, 'conformance/workspace.json')) {
    this.wsFile = wsFile;
    this.reset();
  }
  reset() {
    this.W = JSON.parse(fs.readFileSync(this.wsFile, 'utf8'));
    this.W.name = this.W.name || 'Platform Engineering';
    this.W.changes = this.W.changes || [];
    this.W.modules = this.W.modules || {};
    this.W.tokens = this.W.tokens || [];
    // FARO_OFF=reviews starts the workspace with those modules switched off (for running the core's journeys with a module off)
    if (process.env.FARO_OFF) this.W.modulesOff = [...new Set([...(this.W.modulesOff || []), ...process.env.FARO_OFF.split(',')])];
    this.mods = installedModules();
    this.registry = makeRegistry(this.mods.code);
    this.rebind();
    // a demo token for the AI tools, per person (only its hash is kept)
    this.demoTokens = {};
    for (const p of this.W.people.slice(0, 200)) {
      const t = 'gk_' + crypto.createHash('sha256').update('demo:' + p.id).digest('hex').slice(0, 40);
      this.demoTokens[p.id] = t;
      this.W.tokens.push({ id: `tok_${p.id}`, personId: p.id, hash: crypto.createHash('sha256').update(t).digest('hex'), revokedAt: null, lastUsedAt: null });
    }
    this.seq = 0;
  }
  rebind() { this.S1 = makeS1(this.W); this.on = resolveModules(this.mods.facts, this.W.modulesOff); }
  get wsName() { return this.W.name; }
  person(id) { return this.W.people.find((p) => p.id === id); }
  goal(id) { return this.W.goals.find((g) => (g.id === id || g.key.toLowerCase() === String(id).toLowerCase()) && !g.removedAt); }
  log(actor, entry, via) { const c = { id: `chg_${++this.seq}_${Date.now()}`, at: this.now || this.W.builtFor, actorId: actor, via: via || 'app', ...entry }; this.W.changes.push(c); return c; }

  // run the engine on rows and commit when it saves
  engine(actor, sheet, rows, { answers = {}, apply = true, at } = {}) {
    const res = planChanges({ W: this.W, S1: this.S1 }, { actor, sheet, rows, answers, idTag: apply ? `a${++this.seq}x` : 'dry', given: { at: at || this.now || this.W.builtFor } });
    if (apply && res.saves && res.commit) {
      for (const kind of ['goals', 'checkIns', 'people']) for (const rec of res.commit[kind]) {
        const list = this.W[kind];
        const i = list.findIndex((x) => x.id === rec.id);
        if (i >= 0) list[i] = { ...rec, version: (list[i].version || 0) + 1 }; else list.push(rec);
      }
      for (const c of res.commit.changes) this.W.changes.push({ ...c, action: c.action === 'check-in' ? 'posted' : c.action === 'new goal' ? 'created' : c.action, via: rows.via || 'app' });
      this.rebind();
    }
    return res;
  }

  // the one dispatcher: core actions and modules' actions
  run(actor, action, input = {}, via = 'app') {
    const acts = this.registry.actions();
    if (acts[action]) {
      const m = acts[action].module;
      if (!this.on(m.id)) return { error: W_.action(m.name, this.wsName) };
      const r = acts[action].run(this, actor, input);
      if (r && !r.error) this.log(actor, { entity: r.entity || 'module', module: m.id, action: r.logAction || action, entityId: r.id, goalId: r.goalId, summary: r.summary || action, diffs: r.diffs || [] }, via);
      return r;
    }
    // a core action that would save a switched-off module's records is refused with that module's sentence
    for (const m of this.mods.code) if (m.writesWhenOff && !this.on(m.id) && m.writesWhenOff(this, action, input)) return { error: W_.action(m.name, this.wsName) };
    if (action === 'setFeature') {
      const r = setModule(this.W, this.mods.facts, actor, input.id, input.on);
      if (r.error) return r;
      if (!r.saved) return { ok: true, unchanged: true };
      this.W.modulesOff = r.modulesOff;
      this.log(actor, { entity: 'workspace', action: 'feature', summary: r.change.what, diffs: r.change.diffs.map((d) => { const [f, rest] = d.split(': '); const [a, b] = rest.split(' → '); return { field: f, from: a, to: b }; }) }, via);
      this.rebind();
      const m = this.mods.facts.find((x) => x.id === input.id);
      return { ok: true, message: input.on ? W_.switchedOn(m.name, this.wsName) : W_.switchedOff(m.name, this.wsName) };
    }
    if (action === 'answerAsk' || action === 'withdrawAsk') {
      const a = this.W.requests.find((x) => x.id === input.askId);
      if (!a || a.status !== 'open') return { error: 'That ask isn’t open any more.' };
      if (action === 'answerAsk') {
        if (a.recipientId !== actor) return { error: 'Only the person it was asked of can answer it.' };
        if (!String(input.answer || '').trim()) return { error: 'Write your answer first.' };
        Object.assign(a, { status: a.kind === 'action' ? 'done' : 'answered', answer: input.answer.trim(), answeredBy: actor, answeredAt: this.now || this.W.builtFor, updatedAt: this.now || this.W.builtFor });
      } else {
        if (a.askedBy !== actor) return { error: 'Only the person who asked can withdraw it.' };
        Object.assign(a, { status: 'withdrawn', updatedAt: this.now || this.W.builtFor });
      }
      this.log(actor, { entity: 'ask', goalId: a.goalIds[0], entityId: a.id, action: action === 'answerAsk' ? 'answered' : 'withdrawn', summary: action === 'answerAsk' ? `Answered ${this.person(a.askedBy)?.name}’s ask` : 'Withdrew an ask', diffs: [{ field: 'Status', from: 'Open', to: action === 'answerAsk' ? 'Answered' : 'Withdrawn' }] }, via);
      this.rebind();
      return { ok: true };
    }
    if (action === 'stopGoal') {
      const g = this.goal(input.goalId);
      if (!g) return { error: 'There’s no goal like that.' };
      if (g.ownerId !== actor && !this.person(actor)?.admin) return { error: `Only ${this.person(g.ownerId)?.name.split(' ')[0]} or an admin can stop this goal.` };
      if (String(input.reason || '').trim().length < 10) return { error: 'Say why it is stopping, in 10 characters or more.' };
      Object.assign(g, { stoppedAt: this.now || this.W.builtFor, stoppedBy: actor, stopReason: input.reason.trim() });
      this.log(actor, { entity: 'goal', goalId: g.id, entityId: g.id, action: 'stopped', summary: `Stopped ${g.title}`, diffs: [{ field: 'Status', from: '—', to: 'Stopped' }, { field: 'Why', from: '—', to: g.stopReason }] }, via);
      this.rebind();
      return { ok: true, message: `Stopped ${g.title}` };
    }
    if (action === 'comment') {
      const g = this.goal(input.goalId);
      if (!g || !String(input.text || '').trim()) return { error: 'Write a comment first.' };
      const d = { id: `dec_c${++this.seq}`, goalId: g.id, checkInId: null, reviewId: null, week: this.S1.currentWeek(this.now || this.W.builtFor), kind: 'comment', byId: actor, at: this.now || this.W.builtFor, note: input.text.trim() };
      this.W.decisions.push(d);
      this.log(actor, { entity: 'goal', goalId: g.id, entityId: g.id, action: 'comment', summary: `Commented on ${g.title}`, diffs: [{ field: 'Comment', from: '—', to: d.note }] }, via);
      return { ok: true };
    }
    if (action === 'checkIn') {
      const g = this.goal(input.goalId);
      if (!g) return { error: 'There’s no goal like that.' };
      if (g.ownerId !== actor) return { error: `Only ${this.person(g.ownerId)?.name.split(' ')[0]} or an admin can check in on this goal.` };
      if (input.stages) row.Stages = input.stages;
      const row = { 'Goal key': g.key, Week: String(input.week), Call: input.call || '', Why: input.why || '' };
      if (g.kind !== 'milestone') row.Value = String(input.value ?? '');
      if (input.cause) row.Cause = input.cause;
      if (input.path) row['Path to green'] = input.path;
      if (input.byWeek) row['Back on plan by week'] = String(input.byWeek);
      if (input.whyGreener) row['Why greener'] = input.whyGreener;
      if (input.next) row.Next = input.next;
      const rows = [row]; rows.via = via;
      const res = this.engine(actor, 'checkIns', rows, { answers: input.answers || {}, apply: !input.dryRun });
      return { ok: res.saves, saves: res.saves, issues: res.issues.filter((i) => i.level !== 'note'), items: res.items };
    }
    if (action === 'saveGoal') {
      const rows = [input.row]; rows.via = via;
      const res = this.engine(actor, 'goals', rows, { answers: input.answers || {}, apply: !input.dryRun });
      const id = res.commit?.goals?.[0]?.id;
      return { ok: res.saves, saves: res.saves, issues: res.issues.filter((i) => i.level !== 'note'), items: res.items, id };
    }
    return { error: `There’s no action ${action}.` };
  }
}
