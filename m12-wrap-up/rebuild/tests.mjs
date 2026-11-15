// Hand checks for stage 2's exit criteria the drill doesn't score (2–6). Usage: node tests.mjs <workspace.json> [change-cases.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Store } from './store.mjs';
import { planChanges } from './engine.mjs';

const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cases = JSON.parse(fs.readFileSync(process.argv[3] ?? new URL('../spec/conformance/change-cases.json', import.meta.url), 'utf8'));
const { S1 } = await import('./s1.mjs').then((m) => m.load(process.argv[2]));
const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); } };

// The workspace as records by kind (the store's snapshot); cycle is one record of `cycles`.
const snapshotOf = (w) => {
  const { about, builtFor, cycle, zone, ...rest } = JSON.parse(JSON.stringify(w));
  return { ...rest, cycles: [cycle], changes: [] };
};
const WS = { id: 'ws_demo', name: 'Platform Engineering', kind: 'own', createdAt: '2025-12-17T00:00:00.000Z' };
const fresh = () => { const s = new Store(); s.createWorkspace(WS, snapshotOf(W)); return s; };

// Undo of an import: every record put back as it was before (a record it added is removed), one entry saying so.
function undoImport(store, wsId, importId, actorId, at) {
  const d = store.load(wsId);
  const sum = d.changes.find((c) => c.importId === importId && c.action === 'imported');
  if (!sum) throw new Error('No such import');
  const commit = { changes: [] };
  for (const [kind, list] of Object.entries(sum.undo)) {
    commit[kind] = list.map(({ id, before }) => {
      if (before) return { ...before, version: undefined };
      const now = (d[kind] || []).find((r) => r.id === id);
      return { ...now, removedAt: at, removedBy: actorId };
    });
  }
  commit.changes.push({ id: `chg_undo_${importId}`, at, actorId, goalId: null, entity: 'workspace', entityId: importId, action: 'undone', importId, summary: `Undid ${sum.summary}`, diffs: [{ field: 'Import', from: sum.summary, to: 'Undone' }] });
  store.commit(wsId, commit);
}
const strip = (r) => { if (!r) return r; const { version, ...x } = r; return x; };

// 3. Every record in workspace.json loads into the store and reads back the same.
check('3: every record loads into the store and reads back the same', () => {
  const s = fresh();
  const back = s.load(WS.id);
  const snap = snapshotOf(W);
  for (const k of Object.keys(snap)) assert.deepEqual(back[k], snap[k], `kind ${k}`);
  assert.equal(back.goals.length, 126); assert.equal(back.checkIns.length, 5249);
  assert.deepEqual(back.modules, W.modules);
});

const run = (name) => { const c = cases.find((x) => x.case === name); return planChanges({ W, S1 }, c); };

// 4. A change set that blocks saves nothing; one that saves is undone by one undo.
check('4a: a change set that blocks has no commit, and the store is unchanged', () => {
  for (const name of ['duplicate', 'not-allowed', 'checkin-incomplete', 'over-100-and-hundredfold', 'unknown-owner-setup']) {
    const r = run(name);
    assert.equal(r.saves, false, name); assert.equal(r.commit, null, name);
  }
});
for (const name of ['saves-plan-with-reason', 'saves-new-goal', 'saves-check-in', 'saves-person', 'saves-stop', 'saves-tree-by-ref', 'corrects-keeps-author', 'over-100-answered']) {
  check(`4b: ${name} saves whole, and one undo puts everything back`, () => {
    const s = fresh();
    const before = s.load(WS.id);
    const r = run(name);
    assert.ok(r.commit, 'it saves');
    s.commit(WS.id, r.commit);
    const after = s.load(WS.id);
    for (const kind of ['goals', 'checkIns', 'people']) for (const rec of r.commit[kind]) assert.deepEqual(strip(after[kind].find((x) => x.id === rec.id)), strip(rec), `${kind} ${rec.id} saved`);
    const imp = r.commit.changes.find((c) => c.action === 'imported');
    undoImport(s, WS.id, imp.importId, 'amara', '2026-11-05T13:00:00.000Z');
    const undone = s.load(WS.id);
    for (const kind of ['goals', 'checkIns', 'people']) {
      for (const rec of r.commit[kind]) {
        const was = before[kind].find((x) => x.id === rec.id);
        const now = undone[kind].find((x) => x.id === rec.id);
        if (was) assert.deepEqual(strip(now), strip(was), `${kind} ${rec.id} put back`);
        else assert.ok(now.removedAt, `${kind} ${rec.id} added, now removed`);
      }
    }
    assert.ok(s.load(WS.id).changes.some((c) => c.action === 'undone'), 'one undo entry');
  });
}
check('4c: the plan change keeps the old plan, and says why in its log entry', () => {
  const r = run('saves-plan-with-reason');
  const g = r.commit.goals[0];
  assert.equal(g.plan.target, 23); assert.equal(g.planHistory.at(-1).plan.target, 24);
  assert.ok(r.commit.changes[0].diffs.some((x) => x.field === 'Why' && x.to === 'Agreed at the quarterly review'));
});
check('4d: a save based on an older version of a goal is refused as stale, and saves nothing', () => {
  const s = fresh();
  const r1 = run('saves-plan-with-reason'); s.commit(WS.id, r1.commit);
  const r2 = run('saves-plan-with-reason');
  const before = s.load(WS.id);
  assert.throws(() => s.commit(WS.id, r2.commit));
  assert.deepEqual(s.load(WS.id), before);
});

// 5. A save to one workspace never changes another's records.
check('5: a save naming a record kept under another workspace is refused whole; the other is unchanged', () => {
  const s = fresh();
  const other = { id: 'ws_other', name: 'Other', kind: 'own', createdAt: WS.createdAt };
  s.createWorkspace(other, { people: [{ id: 'o-1', name: 'Olu', role: '', initials: 'O', teamId: 't-o', admin: true, email: 'olu@example.com' }], teams: [{ id: 't-o', name: 'Other team', leadId: 'o-1', objective: '' }], cycles: [], goals: [], checkIns: [], changes: [] });
  const r = run('saves-new-goal');
  const g = { ...r.commit.goals[0], ownerId: 'o-1' };
  const beforeMine = s.load(WS.id), beforeOther = s.load(other.id);
  assert.throws(() => s.commit(WS.id, { ...r.commit, goals: [g] }));
  assert.throws(() => s.commit(WS.id, { people: [{ id: 'o-1', name: 'Taken over' }], changes: [] }));
  assert.deepEqual(s.load(WS.id), beforeMine, 'nothing saved in part');
  assert.deepEqual(s.load(other.id), beforeOther, 'the other workspace as it was');
});

// 6. A module's records ride in the same save; rows of a module the build leaves out stay.
check('6: module rows ride in the same save, all or nothing; an unknown module’s rows load, save and stay', () => {
  const s = new Store();
  const snap = snapshotOf(W);
  snap.modules = { ...snap.modules, ghost: { things: [{ id: 'gh1', goalId: 'ns-lead', what: 'kept untouched' }] } };
  s.createWorkspace(WS, snap);
  const r = run('saves-plan-with-reason');
  const link = { id: 'ml_new', goalId: 'ns-lead', metricId: 'metric_lead-time', slice: 'company' };
  s.commit(WS.id, { ...r.commit, modules: { metrics: { metricLinks: [link] } } });
  let d = s.load(WS.id);
  assert.ok(d.modules.metrics.metricLinks.some((x) => x.id === 'ml_new'));
  assert.equal(d.modules.metrics.metrics.length, W.modules.metrics.metrics.length, 'other metric rows stay');
  assert.equal(d.goals.find((g) => g.id === 'ns-lead').plan.target, 23);
  assert.deepEqual(d.modules.ghost, snap.modules.ghost);
  // a stale save with module rows saves neither
  const before = s.load(WS.id);
  assert.throws(() => s.commit(WS.id, { ...run('saves-plan-with-reason').commit, modules: { metrics: { metricLinks: [{ ...link, id: 'ml_never' }] } } }));
  d = s.load(WS.id);
  assert.deepEqual(d, before);
  // the engine itself loads a workspace with a module it doesn't know, and plans as usual
  const r2 = planChanges({ W: { ...W, modules: snap.modules }, S1 }, cases.find((x) => x.case === 'saves-new-goal'));
  assert.equal(r2.saves, true);
});

// 2. The change engine's worked examples (those the kit's words let me set up).
check('2: Tariq changes ns-ai to a target of 90 with no reason: needs a reason; nothing to save', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'tariq', sheet: 'goals', rows: [{ ID: 'ns-ai', Target: '90' }] });
  assert.equal(r.needsReason, true); assert.equal(r.saves, false);
});
check('2: the same change by Mateo: not-allowed in the engine’s words', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'mateo', sheet: 'goals', rows: [{ ID: 'ns-ai', Target: '90' }] });
  const i = r.issues.find((x) => x.level === 'must');
  assert.equal(i.message, 'Only Tariq Haddad (its owner) or an admin can change “Pull requests with AI-assisted review”.');
});
check('2: Amara loads one new stages goal for Rhea (Design@50; Pilot@51; Live@52): goal_c4', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Stages for Rhea', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Design@50; Pilot@51; Live@52' }] });
  assert.equal(r.items[0].target, 'goal_c4');
});
check('2: Next step for week 40 of lead-flaky (row 2) and ci-docker (row 3): ci-docker first', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal ID': 'lead-flaky', Week: '40', 'Next step': 'Something next' }, { 'Goal ID': 'ci-docker', Week: '40', 'Next step': 'Something next' }] });
  assert.deepEqual(r.items.map((i) => `${i.target} (row ${i.line})`), ['ci-docker (row 3)', 'lead-flaky (row 2)']);
});
check('2: lead-ci-time week 45 with a Value of 6 and no Call: Off track → At risk, 8 min → 6 min', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'amara', sheet: 'checkIns', rows: [{ 'Goal ID': 'lead-ci-time', Week: '45', Value: '6' }], given: { reason: 'The tracker had last week’s number in it' } });
  const d = r.items[0].diffs.map(([f, a, b]) => `${f}: ${a} → ${b}`).filter((x) => !x.startsWith('Why corrected'));
  assert.deepEqual(d, ['Status call: Off track → At risk', 'Value: 8 min → 6 min', 'Via: — → Spreadsheet']);
});
check('2: Draft@2; Agreed@6; Live@50 counted from week 45: Draft@46; Agreed@46; Live@53', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'Rota agreed', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Draft@2; Agreed@6; Live@50' }], answers: { 'past-stage:goals:stages:': 'from-now' } });
  assert.match(r.items[0].diffs.find(([f]) => f === 'Stages')[2], /Draft \(wk 46\), Agreed \(wk 46\), Live \(wk 53\)/);
});
check('2: a goal feeding “Flaky test rate in the main pipeline” (one letter out): near-ref, listed, Feeds into Nothing', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'amara', sheet: 'goals', rows: [{ Goal: 'A new goal', Owner: 'Rhea Kapoor', Unit: '%', Start: '10', Target: '50', 'Feeds into': 'Flaky test rate in the main pipeline' }] });
  assert.equal(r.issues.find((i) => i.level === 'check').kind, 'near-ref');
  assert.ok(r.items[0].diffs.some(([f, , b]) => f === 'Feeds into' && b === 'Nothing'));
});
check('2: G-11’s Limit 2 → 3 with no reason: a plan item that needs a reason', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'rhea', sheet: 'goals', rows: [{ Key: 'G-11', Limit: '3' }] });
  assert.equal(r.items[0].kind, 'plan'); assert.equal(r.items[0].needsReason, true);
});
check('2: Rhea replaces G-11 week 45 with reason “ab12345678” then “abc1234567”', () => {
  // the MCP door isn't built here: the spreadsheet door only corrects an admin's row on someone else's goal
  results.push(['SKIP', 'MCP and Data tables doors are not built (no door parameter in the drill’s cases)']);
});
check('2: Rhea loads G-22 week 45 from rhea.csv: the summary says “Loaded a spreadsheet: 1 check-in”', () => {
  const r = planChanges({ W, S1 }, { case: 'x', actor: 'rhea', sheet: 'checkIns', rows: [{ 'Goal key': 'G-22', Week: '45', Value: '85' }] });
  assert.equal(r.commit.changes.find((c) => c.action === 'imported').summary, 'Loaded a spreadsheet: 1 check-in');
});

for (const r of results) console.log(r.join('  '));
const fails = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.filter((r) => r[0] === 'PASS').length} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
