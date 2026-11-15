// The Wrap-up's rules against the kit's worked examples (spec/modules/wrap-up/rules.md, spec/core/rules/year-end.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './rules.mjs';

const C2026 = { id: 'cycle', name: '2026', startDate: '2025-12-22', weeks: 53 };
const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

test('a year’s end: the wrap-up opens on 21 Dec 2026 and closes on 31 Jan 2027', () => {
  const d = R.wrapUpDays(C2026);
  assert.equal(`first ${iso(d.first)}, last ${iso(d.last)}, wrap-up ${iso(d.opens)} to ${iso(d.closes)}`, 'first 2025-12-29, last 2027-01-03, wrap-up 2026-12-21 to 2027-01-31');
  assert.deepEqual(['2026-12-20', '2026-12-21', '2027-01-31', '2027-02-01'].map((t) => R.wrapUpOpen(C2026, t)), [false, true, true, false]);
  const d27 = R.wrapUpDays({ name: '2027', startDate: '2026-12-28', weeks: 52 });
  assert.equal(`${iso(d27.first)} ${iso(d27.last)} ${iso(d27.opens)} ${iso(d27.closes)}`, '2027-01-04 2028-01-02 2027-12-20 2028-01-30');
});

test('wrapUpOffReadBack: week 52, the wrap-up open, 5 goals, one stopped, one removed', () => {
  const goals = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }, { id: 'g4', stoppedAt: 'x' }, { id: 'g5', removedAt: 'x' }].map((g) => ({ cycleId: 'cycle', ...g }));
  const retros = [{ goalId: 'g1', cycleId: 'cycle', next: 'carry' }, { goalId: 'g2', cycleId: 'cycle', next: 'stop' }, { goalId: 'g5', cycleId: 'cycle', next: 'stop' }];
  assert.equal(R.wrapUpOffLines(R.wrapUpOffReadBack({ goals, retros, cycle: C2026, open: true })),
    'The wrap-up leaves Home, Goals and Cycles. Owners aren’t asked how their goals landed. 1 goal is not wrapped up yet and won’t be asked for. | 2 wrap-ups already written stay in each goal’s History. | 1 goal was marked “Stop” at its wrap-up, and it stops when 2027 starts. | The year still ends. Results are worked out as before, and an admin starts 2027 from Cycles.');
});

test('wrapUpOffReadBack: week 45, nothing written and not open, acts at once', () => {
  assert.equal(R.wrapUpOffLines(R.wrapUpOffReadBack({ goals: [{ id: 'g1', cycleId: 'cycle' }], retros: [], cycle: C2026, open: false })), 'no: it acts at once');
});

test('saveRetro refuses in the action’s words', () => {
  const goal = { id: 'g1', ownerId: 'mateo' };
  const ok = { result: 'hit', learned: 'A sentence long enough.', next: 'carry' };
  assert.equal(R.retroRefusal({ goal, actor: { id: 'rhea' }, cycle: C2026, todayIso: '2026-12-22', input: ok }), 'Only the goal’s owner or an admin can wrap it up.');
  assert.equal(R.retroRefusal({ goal, actor: { id: 'mateo' }, cycle: C2026, todayIso: '2026-11-05', input: ok }), '2026’s wrap-up opens on Mon 21 Dec 2026.');
  assert.equal(R.retroRefusal({ goal, actor: { id: 'mateo' }, cycle: C2026, todayIso: '2027-02-05', input: ok }), '2026’s wrap-up closed on Sun 31 Jan 2027.');
  assert.equal(R.retroRefusal({ goal, actor: { id: 'mateo' }, cycle: C2026, todayIso: '2026-12-22', input: { ...ok, learned: 'short' } }), 'Say what was learned, in a sentence (10 characters or more).');
  assert.equal(R.retroRefusal({ goal, actor: { id: 'mateo' }, cycle: C2026, todayIso: '2026-12-22', input: { ...ok, next: 'stop' }, copyUsedIn: '2027' }), 'It already has check-ins in 2027. Stop it there instead.');
  assert.equal(R.retroRefusal({ goal, actor: { id: 'amara', admin: true }, cycle: C2026, todayIso: '2026-12-22', input: ok }), null);
});
