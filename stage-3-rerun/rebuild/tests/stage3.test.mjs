// Stage 3's own checks that the drill doesn't score: the rules' worked examples, the year, Undo and Recently removed,
// saved views, a check-in through the change engine with its receipt, What's new and Help. In process, on the demo workspace.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../app/state.mjs';
import { example, exampleTwo } from '../app/modules/example.mjs';
import { menuGroups, phoneTabs, litItem, pageName, backTo } from '../s3/navigation.mjs';
import { wordsOf, matches, nearMiss, keyOf, countLine, nothingLine } from '../s3/finding.mjs';
import { readBack } from '../s3/readback.mjs';
import { goalResult, resultWords, cycleState, startReadBack } from '../s3/year.mjs';
import { receiptText } from '../s3/home.mjs';
import { WHATS_NEW } from '../app/whatsnew.mjs';
import { HELP } from '../app/help.mjs';

let state;
before(async () => { state = await createState({ installed: [example, exampleTwo] }); });
const at = (day) => { state.today = day; return state.view(); };

test('navigation: the menu, the tabs, the lit item, a page’s name and the back link (navigation.md worked examples)', () => {
  const mods = [{ id: 'metrics', label: 'Metrics', group: 'lookup', to: '/metrics' }];
  assert.equal(menuGroups({ checkin: true, mods }).map((g) => g.join(' ')).join(' | '), 'home checkin goals reviews | people module:metrics activity data | new | workspace settings help feedback');
  assert.equal(phoneTabs({ checkin: false }).join(' '), 'home goals reviews people');
  assert.equal(phoneTabs({ checkin: true, reviewsOn: false }).join(' '), 'home checkin goals people');
  assert.equal(phoneTabs({ checkin: false, reviewsOn: false }).join(' '), 'home goals people activity');
  const opts = { checkin: true };
  assert.deepEqual(['/goals/lead-mq', '/goals/lead-mq?review=weekly', '/goals/new', '/retro', '/teams/cicd', '/whats-new', '/research'].map((a) => litItem(a, opts) || 'none'), ['goals', 'reviews', 'new', 'goals', 'people', 'help', 'none']);
  const { core } = at('2026-11-05');
  const names = { ...core.names() };
  assert.equal(pageName('/goals/ns-lead?review=weekly', names), 'Lead time for changes · Platform leadership weekly');
  assert.equal(pageName('/workspace/access', names), 'Access · Workspace');
  assert.equal(pageName('/goals/nope', names), 'Goal not found');
  assert.deepEqual(backTo('/goals/lead-merge', [], names), { label: 'Lead time for changes', to: '/goals/ns-lead' });
  assert.equal(backTo('/settings', ['/goals/ns-lead'], names), null);
  assert.deepEqual(backTo('/people/rhea', ['/'], names), { label: 'Home', back: 1 });
});

test('finding: words, keys and near misses (finding.md worked examples)', () => {
  const row = wordsOf('Rollback in under five minutes G-48 Tunde Bakare Build & Release Team Off track');
  assert.deepEqual(['rollback', 'roll min', 'back', 'off track'].map((q) => matches(row, q)), [true, true, false, true]);
  assert.equal(wordsOf('Down to 12.5, from 1,200. Then 3.').join(' '), 'down to 12.5 from 1,200 then 3');
  assert.ok(matches(wordsOf('Lucía Romero Staff Engineer CI/CD'), 'lucia ci'));
  const list = [['rollback'], ['kafka'], ['pipeline']];
  assert.deepEqual(['rolback', 'kafak', 'piplin', 'rolbak'].map((q) => nearMiss(list, q)), ['rollback', 'kafka', null, null]);
  assert.equal(nearMiss([['queue'], ['wait']], 'qeue wait'), 'queue wait');
  assert.deepEqual(['G-48', 'g48', '48', 'rollback'].map(keyOf), ['G-48', 'G-48', 'G-48', null]);
  assert.equal(countLine(126, 'goal', 'goals', 'worst first', false), '126 goals, worst first.');
  assert.equal(countLine(97, 'person', 'people', 'A to Z', false, { from: 1, size: 50 }), '97 people, A to Z. Showing 1 to 50.');
  assert.equal(countLine(1, 'person', 'people', 'A to Z', true), '1 person matches.');
  assert.equal(nothingLine('goal', 'goals', 'rolback', false, 'rollback'), 'No goal matches “rolback”. Showing goals that match “rollback”.');
});

test('the read-back on Wednesday 11 Nov (read-back.md worked example)', () => {
  const { core } = at('2026-11-11');
  const draft = { kind: 'metric', title: 'Signed artifacts in staging', ownerId: 'tunde', teamId: 'build', parentId: 'ns-mttr', unit: '%', start: '40', target: '90', decimals: '', fromWeek: '', endWeek: '', shape: 'straight', alsoHelps: [], guardrail: false, definition: '', stages: [] };
  const r = readBack(core, draft, 'tunde', '2026-11-11T12:00:00.000Z', { workspaceName: 'Platform Engineering' });
  assert.equal(r.rows[0][1], 'A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.');
  assert.equal(r.after[0], 'Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.');
});

test('a goal’s result: Met, Met late, Not met (year-end.md)', () => {
  const { core } = at('2026-11-05');
  const g = { id: 'x', kind: 'metric', plan: { start: 10, target: 50, endWeek: 40 } };
  const ck = (week, value, status = 'on') => ({ week, value, status, postedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(resultWords(goalResult(core, g, [ck(39, 50)], '2026-11-05T12:00:00.000Z')), 'Met in week 39');
  assert.equal(resultWords(goalResult(core, g, [ck(40, 30), ck(42, 51)], '2026-11-05T12:00:00.000Z')), 'Met late: week 42, due week 40');
  assert.equal(resultWords(goalResult(core, g, [ck(40, 30)], '2026-11-05T12:00:00.000Z')), 'Not met: due week 40');
  assert.equal(goalResult(core, { ...g, plan: { ...g.plan, endWeek: 50 } }, [ck(44, 50)], '2026-11-05T12:00:00.000Z'), null, 'touching the target early is no result yet');
  assert.deepEqual(['2025-12-23', '2026-11-05', '2026-12-22', '2027-01-05', '2027-02-10'].map((d) => cycleState(core, `${d}T12:00:00.000Z`)), ['before', 'running', 'ending', 'ended', 'closed']);
});

test('start the next year: refused before the wrap-up opens; started from it, counted once, and undone', () => {
  state.reset([]);
  at('2026-11-05');
  const early = state.dispatch('amara', 'startNextCycle', { confirm: true });
  assert.equal(early.error, '2027 can be started from Monday 21 Dec, when the wrap-up opens.');
  const { core } = at('2026-12-22');
  const rb = startReadBack(core, state.moment());
  assert.equal(rb.counts.carries + rb.counts.keeps + rb.counts.finishes + rb.counts.stops, rb.total, 'every goal counted once');
  assert.equal(state.dispatch('rhea', 'startNextCycle', { confirm: true }).error, 'Only an admin can start the next year.');
  const r = state.dispatch('amara', 'startNextCycle', { confirm: true });
  assert.ok(r.ok, r.error);
  assert.equal(r.carried, rb.counts.carries + rb.counts.keeps);
  assert.equal(state.data().cycles.filter((c) => !c.removedAt).length, 2);
  assert.match(state.dispatch('amara', 'startNextCycle', { confirm: true }).error, /^2027 was started by Amara Nwosu/);
  const u = state.undo('amara', r.changeId);
  assert.ok(u.ok);
  assert.equal(state.data().cycles.filter((c) => !c.removedAt).length, 1);
  assert.equal(state.data().goals.filter((g) => g.carriedFrom && !g.removedAt).length, 0);
  state.reset([]);
});

test('Undo and Recently removed: a goal published, deleted, restored; a stop undone', () => {
  state.reset([]);
  at('2026-11-05');
  const made = state.dispatch('tunde', 'saveGoal', { draft: { kind: 'metric', title: 'Set up by mistake', ownerId: 'tunde', teamId: 'build', level: 'team', unit: '%', start: '10', target: '20' }, confirm: true });
  assert.ok(made.ok, made.error);
  const del = state.dispatch('tunde', 'deleteGoal', { goalId: made.goal.id });
  assert.ok(del.ok);
  assert.ok(state.removed().some((r) => r.id === made.goal.id && r.name === 'Set up by mistake'));
  assert.ok(state.dispatch('amara', 'restoreRemoved', { kind: 'goals', id: made.goal.id }).ok);
  assert.ok(!state.data().goals.find((g) => g.id === made.goal.id).removedAt);
  const stop = state.dispatch('rhea', 'stopGoal', { goalId: 'ci-docker', reason: 'short' });
  assert.equal(stop.error, 'Say why it’s stopping, in a sentence (10 characters or more).');
  const s2 = state.dispatch('rhea', 'stopGoal', { goalId: 'ci-docker', reason: 'The platform team took base images over in October.' });
  assert.ok(s2.ok);
  assert.ok(state.data().goals.find((g) => g.id === 'ci-docker').stoppedAt);
  assert.equal(state.undo('tunde', s2.changeId).error, 'Only whoever made the change, or an admin, can undo it.');
  assert.ok(state.undo('rhea', s2.changeId).ok);
  assert.ok(!state.data().goals.find((g) => g.id === 'ci-docker').stoppedAt);
  const log = state.data().changes.map((c) => c.action);
  for (const a of ['created', 'deleted', 'restored', 'stopped', 'undone']) assert.ok(log.includes(a), a);
  state.reset([]);
});

test('saved views: saved with its address and name, deleted by whoever saved it', () => {
  state.reset([]);
  at('2026-11-05');
  assert.equal(state.dispatch('rhea', 'saveView', { name: '', address: '/goals' }).error, 'Give the view a name of 1 to 80 characters.');
  const v = state.dispatch('rhea', 'saveView', { name: 'CI/CD off track', address: '/goals?scope=all&team=cicd&status=off' });
  assert.ok(v.ok);
  assert.equal(state.data().views[0].address, '/goals?scope=all&team=cicd&status=off');
  assert.equal(state.dispatch('tunde', 'deleteView', { id: v.id }).error, 'Only whoever saved it, or an admin, can delete it.');
  assert.ok(state.dispatch('rhea', 'deleteView', { id: v.id }).ok);
  state.reset([]);
});

test('a check-in goes through the change engine, and the receipt says it in the habit’s words', () => {
  state.reset([]);
  const { core } = at('2026-11-11');
  const refused = state.dispatch('rhea', 'postCheckIn', { goalId: 'cfr-contract', value: '5', call: 'on' });
  assert.equal(refused.error, 'Only Tunde Bakare checks in on this goal.');
  const before = core.goalStates(state.moment()).find((s) => s.g.id === 'cfr-contract');
  const r = state.dispatch('tunde', 'postCheckIn', { goalId: 'cfr-contract', value: String(before.latest.value), call: before.latest.calculated, why: 'Steady this week, as planned.', cause: 'Delivery slower', path: 'More contract tests in the merge queue', byWeek: 50, confirm: true });
  assert.ok(r.ok, r.error);
  assert.equal(r.checkIn.week, 46);
  assert.equal(r.checkIn.authorId, 'tunde');
  const again = state.dispatch('tunde', 'postCheckIn', { goalId: 'cfr-contract', value: '1', call: 'on' });
  assert.ok(again.error, 'the engine’s Must fix refuses an incomplete check-in');
  assert.equal(receiptText(core, { total: 2, after: 0, byDay: 'Thursday', held: true, run: 5, forgiven: { week: 45, how: 'late' }, week: 46 }), 'Both of your check-ins are in before Thursday’s review. That is 5 weeks in a row. Week 45 came in late; one late week doesn’t break a run.');
  assert.equal(receiptText(core, { total: 1, after: 1, byDay: 'Thursday', held: false, run: 0, forgiven: null, week: 46 }), 'Your check-in is in. It came after Thursday. The next is due by Thursday 19 Nov.');
  state.reset([]);
});

test('What’s new: each release with a stable id, a date, a title, two to six lines, its Help articles and what it fixes; Help has every core screen', () => {
  const ids = new Set();
  for (const e of WHATS_NEW) {
    assert.ok(e.id && !ids.has(e.id)); ids.add(e.id);
    assert.ok(e.date && e.title);
    assert.ok(e.lines.length >= 2 && e.lines.length <= 6);
    assert.ok(Array.isArray(e.help) && Array.isArray(e.fixes));
    for (const h of e.help) assert.ok(HELP.some((a) => a.id === h), `${h} is an article`);
  }
  for (const id of ['home', 'check-in', 'goals', 'goal-page', 'new-goal', 'people', 'activity', 'data', 'workspace', 'features', 'cycles', 'removed', 'settings', 'whats-new']) assert.ok(HELP.some((a) => a.id === id), id);
});
