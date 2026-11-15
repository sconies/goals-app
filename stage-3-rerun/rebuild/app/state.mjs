// The app's state: one workspace in the stage 2 store, the stage 1 rules over it, the module platform, and the
// one dispatcher every save goes through (the screens, the AI tools' server and the test door alike).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Store } from '../store.mjs';
import { load as loadS1 } from '../s1.mjs';
import { makeCore } from '../s3/core.mjs';
import { planChanges } from '../engine.mjs';
import { createPlatform, words } from './platform.mjs';
import { startReadBack, carryKind, cycleDays } from '../s3/year.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
export const KIT = path.resolve(here, '../../spec/conformance');
export const WS_ID = 'ws_demo';
const clone = (x) => JSON.parse(JSON.stringify(x));
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export async function createState({ installed, modulesOff = [], today = '2026-11-05' }) {
  const wsPath = path.join(KIT, 'workspace.json');
  const W0 = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
  const extra = JSON.parse(fs.readFileSync(path.join(KIT, 'demo-extra.json'), 'utf8'));
  const { S1 } = await loadS1(wsPath);
  const platform = createPlatform(installed);
  const store = new Store();
  let seq = 0;
  const ids = (prefix) => `${prefix}_${Date.now().toString(36)}${(++seq).toString(36)}`;

  function seed(off) {
    const byId = new Map(extra.people.map((p) => [p.id, p]));
    const people = W0.people.map((p) => ({ ...p, role: byId.get(p.id)?.role ?? '', email: byId.get(p.id)?.email ?? null }));
    const { about, builtFor, cycle, zone, modules, ...rest } = clone(W0);
    const snapshot = { ...rest, people, cycles: [cycle], changes: clone(extra.changes), modules: modules || {}, views: [], tokens: [], retros: [],
      settings: { name: 'Platform Engineering', modulesOff: off, rhythm: cycle.checkInWeeks ?? 1 } };
    if (store.ws.has(WS_ID)) store.deleteWorkspace(WS_ID);
    store.createWorkspace({ id: WS_ID, name: 'Platform Engineering', kind: 'demo', createdAt: '2025-12-17T00:00:00.000Z' }, snapshot);
    version++;
  }
  let version = 0, cached = null;
  seed(modulesOff);

  const data = () => store.load(WS_ID);
  // The workspace as the rules read it, and the core's read model, rebuilt once per version.
  function view() {
    if (cached && cached.version === version) return cached;
    const d = data();
    const live = (d.cycles || []).filter((c) => !c.removedAt);
    const cycle = live[0];
    const W = { ...d, cycle, builtFor: `${state.today}T12:00:00.000Z`, modulesOff: d.settings.modulesOff, retros: d.retros || [] };
    S1.setData(W);
    const core = makeCore(W, S1);
    const on = platform.resolve(d.settings.modulesOff);
    core.isOn = (id) => on.has(id);
    cached = { version, d, W, core, on };
    return cached;
  }
  const wsName = () => data().settings.name;
  const moment = () => `${state.today}T23:00:00.000Z`; // judged at the end of the demo's day; saves are made at noon on
  let tick = 0;
  const now = () => new Date(Date.parse(`${state.today}T12:00:00.000Z`) + (++tick) * 1000).toISOString();

  // One commit with its change entries, each keeping what it changed so Undo can put it back.
  let currentVia = null; // set by the dispatcher for the door a save came through (the AI tools: "MCP")
  function save(actor, commit, change, { via = currentVia } = {}) {
    const d = data();
    const before = [];
    for (const [kind, rows] of Object.entries(commit)) {
      if (kind === 'expect' || kind === 'changes' || !Array.isArray(rows) && kind !== 'modules' && kind !== 'settings') continue;
      if (kind === 'modules') { for (const [m, keys] of Object.entries(rows)) for (const [key, list] of Object.entries(keys)) for (const r of list) before.push({ kind: `modules.${m}.${key}`, id: r.id, record: ((d.modules?.[m]?.[key]) || []).find((x) => x.id === r.id) ?? null }); continue; }
      if (kind === 'settings') { before.push({ kind: 'settings', record: clone(d.settings) }); continue; }
      for (const r of rows) before.push({ kind, id: r.id, record: (d[kind] || []).find((x) => x.id === r.id) ?? null });
    }
    const at = now();
    const entries = (Array.isArray(change) ? change : [change]).filter(Boolean).map((c) => ({ id: ids('chg'), at, actorId: actor, goalId: null, diffs: [], ...c, ...(via ? { via } : {}) }));
    if (entries.length) entries[0].undo = { before };
    const body = { ...commit, changes: [...(commit.changes || []), ...entries] };
    if (body.settings) body.settings = { ...d.settings, ...body.settings };
    store.commit(WS_ID, body);
    version++;
    return entries[0] || null;
  }

  // Undo: puts back every record the entry's save touched; an added record is removed.
  function undo(actor, changeId) {
    const d = data();
    const ch = (d.changes || []).find((c) => c.id === changeId);
    if (!ch || !ch.undo) return { error: 'There’s nothing to undo.' };
    if (ch.undoneAt) return { error: 'That was undone already.' };
    if (!isAdmin(actor) && ch.actorId !== actor) return { error: 'Only whoever made the change, or an admin, can undo it.' };
    const commit = {};
    const at = now();
    for (const b of ch.undo.before) {
      if (b.kind === 'settings') { commit.settings = b.record; continue; }
      const cur = b.kind.startsWith('modules.') ? (() => { const [, m, key] = b.kind.split('.'); return ((d.modules?.[m]?.[key]) || []).find((x) => x.id === b.id); })() : (d[b.kind] || []).find((x) => x.id === b.id);
      const rec = b.record ? clone(b.record) : { ...cur, removedAt: at, removedBy: actor, removedByUndo: true };
      if (b.kind.startsWith('modules.')) { const [, m, key] = b.kind.split('.'); commit.modules = commit.modules || {}; commit.modules[m] = commit.modules[m] || {}; (commit.modules[m][key] = commit.modules[m][key] || []).push(rec); }
      else (commit[b.kind] = commit[b.kind] || []).push(rec);
    }
    if (commit.settings) commit.settings = { ...d.settings, ...commit.settings };
    commit.changes = [{ ...ch, undoneAt: at, undoneBy: actor }, { id: ids('chg'), at, actorId: actor, goalId: ch.goalId, entity: ch.entity, entityId: ch.entityId, action: 'undone', summary: `Undid: ${ch.summary}`, diffs: [] }];
    store.commit(WS_ID, commit);
    version++;
    return { ok: true, message: ch.undoWords || 'Undone.' };
  }

  const isAdmin = (id) => !!data().people.find((p) => p.id === id && p.admin && !p.leftAt);
  const findGoal = (x) => view().core.findGoal(x);
  const personName = (id) => data().people.find((p) => p.id === id)?.name ?? id;

  // ---------- the core's actions ----------
  const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', done: 'Done' };
  const core = {
    // A check-in through the change engine's one door (postCheckIn), new for this week.
    postCheckIn(actor, input, { dryRun = false } = {}) {
      const { W, core: C } = view();
      const g = findGoal(input.goalId);
      if (!g || g.removedAt) return { error: 'There’s no such goal.' };
      if (g.ownerId !== actor) return { error: `Only ${personName(g.ownerId)} checks in on this goal.` };
      const w = S1.currentWeek(moment());
      for (const r of platform.hook('beforeCheckIn', view().on, { goal: g, week: w, input })) if (r && r.error) return { error: r.error };
      const row = { 'Goal key': g.key, Week: String(w) };
      if (input.value !== undefined && input.value !== '') row.Value = String(input.value);
      if (input.call) row.Call = STATUS_WORD[input.call] ?? input.call;
      if (input.why) row.Why = input.why;
      if (input.greenerWhy) row['Why greener'] = input.greenerWhy;
      if (input.cause) row.Cause = input.cause;
      if (input.path) row['Path to green'] = input.path;
      if (input.byWeek) row['Back on plan by week'] = String(input.byWeek);
      if (input.next) row['Next step'] = input.next;
      const res = planChanges({ W: { ...W, builtFor: now() }, S1 }, { actor, sheet: 'checkIns', rows: [row], answers: input.answers, door: 'form', ids, given: { at: now() } });
      const must = res.issues.filter((i) => i.level === 'must');
      const checks = res.issues.filter((i) => i.level === 'check');
      if (must.length || checks.length && !input.confirm || !res.saves) return { error: (must[0] || checks[0])?.message || (res.needsReason ? 'Say why, in a sentence.' : 'Nothing to save.'), issues: res.issues };
      if (dryRun) return { ok: true, dryRun: true, message: `Would check in week ${w} on ${g.title}.`, items: res.items };
      const { changes, expect, ...rest } = res.commit;
      const ck = rest.checkIns[0];
      const entry = save(actor, rest, { goalId: g.id, entity: 'checkIn', entityId: ck.id, action: 'checked in', summary: `Checked in for week ${w}: ${ck.value ?? ''}${ck.value !== null && ck.value !== undefined && g.unit ? (g.unit === '%' ? '%' : ` ${g.unit}`) : ''}`.trim(), diffs: res.items[0].diffs.map(([field, from, to]) => ({ field, from, to })) });
      return { ok: true, message: `Checked in for week ${w}.`, changeId: entry.id, checkIn: ck };
    },
    // New goal: the form's draft as a Goals row, saved through the change engine (saveGoal).
    saveGoal(actor, input, { dryRun = false } = {}) {
      const { W } = view();
      const d = input.draft || input;
      const row = { Goal: d.title, Owner: personName(d.ownerId), Team: W.teams.find((t) => t.id === d.teamId)?.name ?? '', Level: { 'north-star': 'North star', svp: 'SVP', team: 'Team' }[d.level] ?? 'Team' };
      if (d.kind === 'range') { row.Type = 'Keep in range'; row.Limit = d.limit; if (d.unit) row.Unit = d.unit; }
      else if (d.kind === 'milestone') { row.Type = 'Dated stages'; row.Stages = (d.stages || []).filter((s) => s.name).map((s) => `${s.name}@${s.dueWeek}`).join('; '); }
      else { row.Unit = d.unit; row.Start = d.start; row.Target = d.target; if (d.fromWeek) row['Plan from week'] = String(d.fromWeek); if (d.endWeek) row['Due week'] = String(d.endWeek); }
      if (d.parentId) row['Feeds into key'] = findGoal(d.parentId)?.key ?? '';
      if (d.definition) row.Definition = d.definition;
      const res = planChanges({ W: { ...W, builtFor: now() }, S1 }, { actor, sheet: 'goals', rows: [row], answers: input.answers, door: 'form', ids, given: { at: now() } });
      const must = res.issues.filter((i) => i.level === 'must');
      if (must.length) return { error: must[0].message, issues: res.issues };
      const checks = res.issues.filter((i) => i.level === 'check');
      if (checks.length && !input.confirm) return { error: `Not saved. Check with the person first: ${checks.map((c) => c.message).join(' ')}`, issues: res.issues };
      if (!res.commit && !(checks.length && input.confirm)) return { error: 'Nothing to save.', issues: res.issues };
      if (dryRun) return { ok: true, dryRun: true, message: `Would add “${d.title}”.`, items: res.items };
      const { changes, expect, ...rest } = res.commit || {};
      const goal = rest.goals[0];
      if (d.guardrail) goal.guardrail = true;
      if (d.alsoHelps?.length) goal.alsoHelps = d.alsoHelps;
      if (d.shape && goal.plan) goal.plan.shape = d.shape;
      const entry = save(actor, rest, { goalId: goal.id, entity: 'goal', entityId: goal.id, action: 'created', summary: `Created the goal “${goal.title}”`, diffs: res.items[0].diffs.map(([field, from, to]) => ({ field, from, to })) });
      platform.hook('afterGoalSaved', view().on, { goal, input });
      return { ok: true, message: `“${goal.title}” is published.`, changeId: entry.id, goal };
    },
    // Change a goal: the edit page's Save changes, through the change engine's Goals row (an edit that changes nothing saves nothing).
    editGoal(actor, input) {
      const { W } = view();
      const g = findGoal(input.goalId);
      if (!g) return { error: 'There’s no such goal.' };
      if (!isAdmin(actor) && g.ownerId !== actor) return { error: `Only ${personName(g.ownerId)} or an admin can change it.` };
      const row = { Key: g.key };
      if (input.title !== undefined) row.Goal = input.title;
      const res = planChanges({ W: { ...W, builtFor: now() }, S1 }, { actor, sheet: 'goals', rows: [row], door: 'form', ids, given: { at: now() }, answers: { [`other-goal:goals:key:${g.key.toLowerCase()}`]: 'same' } });
      const must = res.issues.filter((i) => i.level === 'must');
      if (must.length) return { error: must[0].message };
      if (!res.commit) return { ok: true, message: 'Nothing changed.' };
      const { changes, expect, ...rest } = res.commit;
      const e = save(actor, rest, { goalId: g.id, entity: 'goal', entityId: g.id, action: 'changed', summary: `Changed “${g.title}”`, diffs: res.items[0].diffs.map(([field, from, to]) => ({ field, from, to })) });
      return { ok: true, message: 'Saved.', changeId: e.id };
    },
    stopGoal(actor, { goalId, reason }) {
      const g = findGoal(goalId);
      if (!g) return { error: 'There’s no such goal.' };
      if (!isAdmin(actor) && g.ownerId !== actor) return { error: 'Only the goal’s owner or an admin can stop it.' };
      if (!reason || reason.trim().length < 10) return { error: 'Say why it’s stopping, in a sentence (10 characters or more).' };
      const at = now();
      const e = save(actor, { goals: [{ ...g, stoppedAt: at, stoppedBy: actor, stopReason: reason.trim() }] }, { goalId: g.id, entity: 'goal', entityId: g.id, action: 'stopped', summary: `Stopped “${g.title}”`, diffs: [{ field: 'Status', from: '—', to: 'Stopped' }, { field: 'Why', from: '—', to: reason.trim() }], undoWords: `“${g.title}” is back.` });
      return { ok: true, message: `“${g.title}” is stopped.`, changeId: e.id };
    },
    deleteGoal(actor, { goalId }) {
      const g = findGoal(goalId);
      if (!g) return { error: 'There’s no such goal.' };
      if (!isAdmin(actor) && g.ownerId !== actor) return { error: 'Only the goal’s owner or an admin can delete it.' };
      if (data().checkIns.some((c) => c.goalId === g.id && !c.removedAt)) return { error: 'It has check-ins: stop it instead, with a reason, so its history stays.' };
      const e = save(actor, { goals: [{ ...g, removedAt: now(), removedBy: actor }] }, { goalId: g.id, entity: 'goal', entityId: g.id, action: 'deleted', summary: `Deleted “${g.title}”`, diffs: [{ field: 'Goal', from: g.title, to: '—' }], undoWords: `“${g.title}” is back.` });
      return { ok: true, message: `“${g.title}” is deleted.`, changeId: e.id };
    },
    restoreRemoved(actor, { kind, id }) {
      const d = data();
      const list = kind.startsWith('modules.') ? (() => { const [, m, key] = kind.split('.'); return d.modules?.[m]?.[key] || []; })() : d[kind] || [];
      const r = list.find((x) => x.id === id && x.removedAt);
      if (!r) return { error: 'There’s nothing removed with that id.' };
      if (kind.startsWith('modules.')) {
        const [, m] = kind.split('.');
        if (!view().on.has(m)) return { error: words.action(platform.byId.get(m)?.name ?? m, wsName()) }; // writesWhenOff
      }
      const back = { ...r }; delete back.removedAt; delete back.removedBy; delete back.removedByUndo;
      const commit = kind.startsWith('modules.') ? (() => { const [, m, key] = kind.split('.'); return { modules: { [m]: { [key]: [back] } } }; })() : { [kind]: [back] };
      const name = r.title || r.name || r.text || r.id;
      const e = save(actor, commit, { goalId: r.goalId ?? (kind === 'goals' ? r.id : null), entity: kind, entityId: id, action: 'restored', summary: `Restored “${name}”`, diffs: [] });
      return { ok: true, message: `“${name}” is back.`, changeId: e.id };
    },
    setModule(actor, { id, on }) {
      const d = data();
      const r = platform.setModule({ actor, isAdmin: isAdmin(actor), modulesOff: d.settings.modulesOff, id, on, wsName: wsName() });
      if (r.error) return r;
      if (r.nothing) return { ok: true, message: on ? words.switchedOn(platform.byId.get(id).name, wsName()) : words.switchedOff(platform.byId.get(id).name, wsName()), nothing: true };
      const extraCommit = r.onSwitch ? r.onSwitch({ on, data: d }) || {} : {};
      const e = save(actor, { settings: { modulesOff: r.modulesOff }, ...extraCommit }, { entity: 'workspace', entityId: WS_ID, action: on ? 'switched on' : 'switched off', summary: r.summary, diffs: r.diffs, undoWords: on ? words.undoneOff(r.module.name) : words.undoneOn(r.module.name) });
      return { ok: true, message: r.message, changeId: e.id };
    },
    saveView(actor, { name, address, id }) {
      const n = String(name || '').trim();
      if (n.length < 1 || n.length > 80) return { error: 'Give the view a name of 1 to 80 characters.' };
      const vid = id || ids('view');
      const e = save(actor, { views: [{ id: vid, name: n, address, ownerId: actor, pinned: false, openedAt: now(), createdAt: now() }] }, { entity: 'view', entityId: vid, action: 'saved', summary: `Saved the view “${n}”`, diffs: [{ field: 'View', from: '—', to: n }] });
      return { ok: true, message: `Saved “${n}”.`, changeId: e.id, id: vid };
    },
    deleteView(actor, { id }) {
      const v = (data().views || []).find((x) => x.id === id && !x.removedAt);
      if (!v) return { error: 'There’s no such view.' };
      if (v.ownerId !== actor && !isAdmin(actor)) return { error: 'Only whoever saved it, or an admin, can delete it.' };
      const e = save(actor, { views: [{ ...v, removedAt: now(), removedBy: actor }] }, { entity: 'view', entityId: id, action: 'deleted', summary: `Deleted the view “${v.name}”`, diffs: [] });
      return { ok: true, message: `Deleted “${v.name}”.`, changeId: e.id };
    },
    setAdmin(actor, { personId, admin }) {
      if (!isAdmin(actor)) return { error: 'Only an admin can change who is an admin.' };
      const p = data().people.find((x) => x.id === personId);
      if (!p) return { error: 'There’s no such person.' };
      if (!admin && p.admin && data().people.filter((x) => x.admin && !x.leftAt).length === 1) return { error: 'The only admin stays one: make someone else an admin first.' };
      if (!!p.admin === !!admin) return { ok: true, message: admin ? `${p.name} is an admin already.` : `${p.name} isn’t an admin.` };
      const e = save(actor, { people: [{ ...p, admin: !!admin }] }, { entity: 'person', entityId: p.id, action: admin ? 'made admin' : 'removed as admin', summary: admin ? `Made ${p.name} an admin` : `${p.name} is no longer an admin`, diffs: [{ field: 'Admin', from: p.admin ? 'Yes' : 'No', to: admin ? 'Yes' : 'No' }], undoWords: admin ? `${p.name} isn’t an admin.` : `${p.name} is an admin again.` });
      return { ok: true, message: admin ? `${p.name} is an admin.` : `${p.name} is no longer an admin.`, changeId: e.id };
    },
    leaveWorkspace(actor) {
      const p = data().people.find((x) => x.id === actor);
      if (p.admin && data().people.filter((x) => x.admin && !x.leftAt).length === 1) return { error: 'You’re the only admin: make someone else an admin first.' };
      const e = save(actor, { people: [{ ...p, leftAt: now() }] }, { entity: 'person', entityId: p.id, action: 'left', summary: `${p.name} left the workspace`, diffs: [{ field: 'Left', from: '—', to: 'Yes' }] });
      return { ok: true, message: `You have left ${wsName()}.`, changeId: e.id };
    },
    // Start {next year}: admins, from the day the wrap-up opens; once; the change keeps what it added, so Undo removes it.
    startNextCycle(actor, { confirm = false } = {}) {
      const { core: C, d, on } = view();
      const m = moment();
      const rb = startReadBack(C, m, { wrapUpOn: on.has('wrap-up') });
      const days = cycleDays(C);
      const started = (d.cycles || []).find((c) => c.startedFrom === d.cycles[0].id && !c.removedAt);
      const whyNot = !isAdmin(actor) ? 'Only an admin can start the next year.' : started ? `${rb.next} was started by ${personName(started.startedBy)} on ${started.createdAt.slice(0, 10)}.` : C.dayNum(m) < days.opens ? `${rb.next} can be started from ${C.fmtDay(days.opens)}, when the wrap-up opens.` : null;
      const out = { total: rb.total, next: rb.next, canStart: !whyNot, whyNot, counts: rb.lines.map((l) => ({ n: l.n, says: l.says, sub: l.sub })) };
      if (!confirm || whyNot) return { ok: !whyNot || !confirm, preview: true, ...out, error: confirm ? whyNot : undefined };
      const cyc = d.cycles[0];
      const startDate = C.isoOfDay(days.start + 7 * cyc.weeks);
      const newCycle = { id: ids('cycle'), name: rb.next, startDate, weeks: 52, reviewDay: cyc.reviewDay, checkInWeeks: cyc.checkInWeeks, startedFrom: cyc.id, startedBy: actor, createdAt: now() };
      let key = Math.max(...d.goals.map((g) => Number(String(g.key).replace(/\D/g, '')) || 0));
      const copies = [];
      for (const s of C.goalStates(m)) {
        const k = rb.kinds.get(s.g.id);
        if (k !== 'carries' && k !== 'keeps') continue;
        const g = clone(s.g);
        const last = S1.sortCk(s.posted.filter((c) => c.value !== null && c.value !== undefined)).pop();
        const copy = { ...g, id: ids('goal'), key: `G-${++key}`, cycleId: newCycle.id, createdAt: now(), carriedFrom: g.id, version: 0 };
        if (g.kind === 'metric' && k === 'carries') copy.plan = { start: last ? last.value : g.plan.start, target: g.plan.target, shape: g.plan.shape || 'straight', fromWeek: 0 };
        copies.push(copy);
      }
      const e = save(actor, { cycles: [newCycle], goals: copies }, { entity: 'cycle', entityId: newCycle.id, action: 'started', summary: `Started ${rb.next}: ${copies.length} goals carry on`, diffs: [{ field: 'Cycle', from: '—', to: rb.next }], undoWords: `${rb.next} is undone. Everyone is in ${cyc.name}.` });
      return { ok: true, message: `${rb.next} is set up. Everyone stays in ${cyc.name} until ${C.fmtDay(days.last + 1)}.`, changeId: e.id, ...out, carried: copies.length };
    },
  };

  // The one dispatcher: core actions by name, else a module's action through the platform (refused while it is off).
  function dispatch(actor, name, input = {}, opts = {}) {
    currentVia = opts.via || null;
    try { return dispatchIn(actor, name, input, opts); } finally { currentVia = null; }
  }
  function dispatchIn(actor, name, input, opts) {
    if (core[name]) return core[name](actor, input, opts);
    const { d, on } = view();
    const r = platform.runAction(name, on, wsName(), { actor, input, data: d, ids, now: now() });
    if (r.error || !r.commit) return r;
    if (opts.dryRun) return { ok: true, dryRun: true, message: `Would save: ${r.change.summary}` };
    const e = save(actor, r.commit, r.change);
    return { ok: true, message: r.message, changeId: e.id };
  }

  // Recently removed: what was removed in the last 30 days, newest first.
  function removed() {
    const d = data();
    const since = Date.parse(`${state.today}T00:00:00Z`) - 30 * 86400000;
    const out = [];
    for (const kind of ['goals', 'checkIns', 'views']) for (const r of d[kind] || []) if (r.removedAt && Date.parse(r.removedAt) >= since) out.push({ kind, id: r.id, name: r.title || r.name || `Week ${r.week} check-in`, removedAt: r.removedAt, removedBy: r.removedBy });
    for (const [m, keys] of Object.entries(d.modules || {})) for (const [key, rows] of Object.entries(keys || {})) for (const r of rows || []) if (r.removedAt && Date.parse(r.removedAt) >= since) out.push({ kind: `modules.${m}.${key}`, id: r.id, name: r.text || r.name || r.id, removedAt: r.removedAt, removedBy: r.removedBy, module: m });
    return out.sort((a, b) => (a.removedAt < b.removedAt ? 1 : -1));
  }

  const state = { today, S1, store, platform, view, data, dispatch, undo, removed, isAdmin, findGoal, personName, wsName, moment, now, ids, save, seed,
    reset: (off = []) => { seed(off); }, version: () => version };
  return state;
}
