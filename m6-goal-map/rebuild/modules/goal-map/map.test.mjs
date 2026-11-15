// The map rule's worked examples (spec/core/rules/map.md), against map.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './map.mjs';
const G = (id, key, title, status, parentId = null) => ({ id, key, title, status, parentId, effect: null });
const goals = [G('t', 'G-1', 'Lead time', 'on'), G('a', 'G-2', 'Merge to deploy', 'off', 't'), G('c', 'G-4', 'Merge queue live', 'on', 'a'), G('b', 'G-3', 'Review time', 'risk', 't'), G('d', 'G-5', 'Cloud cost', 'on'), G('e', 'G-6', 'Idle machines off', 'done', 'd')];
test('the critical path', () => assert.equal(M.criticalPath(goals).map((p) => p.join(', ')).join('; '), 't, a'));
test('folded, opened, shut', () => {
  assert.equal(M.shownOnMap(goals).join(', '), 't, a, d');
  assert.equal(M.shownOnMap(goals, { opened: new Set(['t']) }).join(', '), 't, a, c, b, d');
  assert.equal(M.shownOnMap(goals, { shut: new Set(['t']) }).join(', '), 't, d');
});
test('what is under', () => {
  const r = M.rollup(goals, 't'), s = M.rollup(goals, 'd');
  assert.equal(`${r.status}: ${r.text}; ${s.status}: ${s.text}`, 'off: 1 off track, 1 at risk; done: All 1 done');
  const two = (x) => [G('p', 'G-9', 'P', 'on'), G('q', 'G-10', 'Q', 'on', 'p'), G('r', 'G-11', 'R', x, 'p')];
  assert.equal(`${M.rollupText(two('done'), 'p')}; ${M.rollupText(two('stale'), 'p')}`, 'None behind: on track; 1 no recent update');
});
test('trees in trouble', () => assert.equal([...M.troubled(goals)].join(', '), 't'));
test('finding', () => assert.equal(['g4', 'G-2', 'merge', 'queue merge'].map((q) => M.findOnMap(goals, q).map((g) => g.id).join(', ')).join('; '), 'c; a; c, a; c'));
test('Fit all shows every goal', () => { const all = goals.map((g) => g.id); const L = M.layout(goals, all, { width: 1440, height: 700 }); assert.equal(L.pos.size, all.length); });
