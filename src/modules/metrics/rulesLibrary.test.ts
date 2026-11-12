// @vitest-environment node
/* The metric library as a place (ML1, docs/design/metrics/spec.md section 4): rule 1 (finding metrics), rule 2 (a
   metric's goals side by side), rule 3 (what a metric needs) and where the old addresses lead, each with the spec's
   worked examples, in the Platform Engineering demo (13 metrics, 12 measuring a goal) as built for 5 Nov 2026. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { currentCycle, scopeToCycle } from '../../domain/cycle';
import { currentWeek } from '../../domain/plan';
import type { Goal } from '../../domain/types';
import RECORDS from './records';
import { MODULE } from './rules';
import * as L from './rulesLibrary';
import { goalsOfMetric, libraryReads } from './reads';
import type { Metric, MetricLink } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle, [{ ...RECORDS, module: MODULE }]);
const week = currentWeek(cycle, today);
const r = libraryReads(s, today.toISOString());
const names = (a: L.LibraryAsk) => L.findMetrics(r, a).rows.map((x) => x.metric.name);
const metric = (id: string) => r.metrics.find((m) => m.id === `metric_${id}`)!;

describe('rule 1: finding metrics', () => {
  it('lists the 13, A to Z, ignoring case and accents, when nothing is asked', () => {
    const page = L.findMetrics(r);
    expect(page.total).toBe(13);
    expect(page.rows[0]!.metric.name).toBe('Change failure rate');
    expect(page.rows.map((x) => x.metric.name)).toEqual([...page.rows.map((x) => x.metric.name)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });
  it('finds by unit and direction, by owner, by unit alone, and by the team or the whole company a goal measures it for', () => {
    expect(names({ q: 'min lower' })).toEqual(['CI pipeline time on main (p90)', 'Mean time to detect', 'Mean time to restore (P1 and P2)', 'Pipeline queue wait (p90)']);
    expect(names({ q: 'rhea' })).toEqual(['Flaky test rate', 'Lead time for changes', 'Pipeline queue wait (p90)', 'Remote build cache hit rate']);
    expect(names({ unit: '%' })).toEqual(['Change failure rate', 'Flaky test rate', 'Remote build cache hit rate']);
    expect(names({ teamId: 'cicd' })).toEqual(['Flaky test rate', 'Pipeline queue wait (p90)', 'Remote build cache hit rate']);
    expect(names({ teamId: 'company' })).toHaveLength(7);
  });
  it('keeps those no goal uses, and those with something to sort out', () => {
    expect(names({ unused: true })).toEqual(['CI compute cost per pipeline run']);
    expect(names({ sortout: true })).toEqual(['CI compute cost per pipeline run']);
    expect(names({ ownerId: 'ethan' })).toEqual(['CI compute cost per pipeline run']);
    expect(names({ dir: 'higher' })).toEqual(['Developer satisfaction (pulse)', 'Production deploys per day', 'Remote build cache hit rate']);
  });
  it('sorts by most goals first (one with none last), and by the latest change', () => {
    expect(names({ sort: 'goals' }).at(-1)).toBe('CI compute cost per pipeline run');
    const changed = L.findMetrics({ ...r, metrics: r.metrics.map((m) => (m.id === 'metric_mttd' ? { ...m, updatedAt: '2026-11-04T09:00:00.000Z' } : m)) }, { sort: 'changed' });
    expect(changed.rows[0]!.metric.name).toBe('Mean time to detect');
  });
  it('never lists a removed metric, and pages 50 at a time', () => {
    const gone = { ...r, metrics: r.metrics.map((m) => (m.id === 'metric_cfr' ? { ...m, removedAt: '2026-11-01T00:00:00.000Z' } : m)) };
    expect(L.findMetrics(gone).total).toBe(12);
    const page = L.findMetrics(r, { size: 5, page: 3 });
    expect([page.pages, page.from, page.to, page.rows.length]).toEqual([3, 11, 13, 3]);
  });
  it('counts a goal only while it is live in the running cycle', () => {
    const without = { ...r, goalIds: new Set([...r.goalIds].filter((id) => id !== 'ns-lead')) };
    expect(L.findMetrics(without, { unused: true }).rows.map((x) => x.metric.name)).toEqual(['CI compute cost per pipeline run', 'Lead time for changes']);
  });
});

describe('rule 2: a metric’s goals', () => {
  it('Lead time for changes: one row, off track, for the whole company, and no summary line', () => {
    const rows = goalsOfMetric(s, cycle, today, week, 'metric_lead-time');
    expect(rows.map((x) => [x.status, x.goal.title, x.slice, x.now, x.target, x.vsPlan, x.owner])).toEqual([['off', 'Lead time for changes', 'The whole company', '37 hours', '24 hours by year end', '9 hours behind plan', 'Rhea Kapoor']]);
    expect(L.summaryLine(rows)).toBeNull();
  });
  it('a keep-in-range goal says its room to the limit', () => {
    const [row] = goalsOfMetric(s, cycle, today, week, 'metric_flaky-rate');
    expect([row!.slice, row!.target, row!.vsPlan]).toEqual(['CI/CD', '≤ 2.0% by year end', 'Near the 2.0% limit']);
  });
  it('CI compute cost per pipeline run has no rows', () => {
    expect(goalsOfMetric(s, cycle, today, week, 'metric_ci-cost')).toEqual([]);
  });

  /** A small world: one metric two teams' goals use (at 7 and 4 min), a third with no value yet, and one stopped. */
  const goal = (id: string, unit = 'min', decimals = 0, stopped = false) => ({ id, title: id, kind: 'metric', unit, decimals, stoppedAt: stopped ? '2026-10-01T00:00:00Z' : null }) as unknown as Goal;
  const row = (id: string, status: 'on' | 'off' | 'risk', now: string, nowValue: number | null, g = goal(id)): L.GoalRow => ({ goal: g, status, now, nowValue, target: '3 min', dueWeek: 53, gap: '', owner: 'Rhea Kapoor' });
  const link = (goalId: string, teamId: string | null, removed = false): MetricLink => ({ id: goalId, goalId, metricId: 'm', teamId, linkedBy: 'rhea', linkedAt: '', removedAt: removed ? '2026-10-02T00:00:00Z' : null });
  const teams = [{ id: 'cicd', name: 'CI/CD' }, { id: 'build', name: 'Build & Release' }];
  it('two teams’ goals at 7 and 4 min: worst status first, and the lowest and highest now', () => {
    const rows = L.metricGoals('m', [link('a', 'build'), link('b', 'cicd')], [row('a', 'on', '4 min', 4), row('b', 'off', '7 min', 7)], teams, cycle);
    expect(rows.map((x) => [x.status, x.slice])).toEqual([['off', 'CI/CD'], ['on', 'Build & Release']]);
    expect(L.summaryLine(rows)).toBe('Lowest now: Build & Release, 4 min. Highest: CI/CD, 7 min.');
  });
  it('a goal with no check-in yet says No value yet and is left out of the line; a stopped goal or an unlinked one is not listed', () => {
    const rows = L.metricGoals('m', [link('a', 'build'), link('b', 'cicd'), link('c', null), link('d', null), link('e', null, true)],
      [row('a', 'on', '4 min', 4), row('b', 'off', '7 min', 7), row('c', 'on', 'No value yet', null), row('d', 'on', '5 min', 5, goal('d', 'min', 0, true)), row('e', 'on', '5 min', 5)], teams, cycle);
    expect(rows.map((x) => x.goal.id)).toEqual(['b', 'a', 'c']);
    expect(rows.find((x) => x.goal.id === 'c')!.now).toBe('No value yet');
    expect(L.summaryLine(rows)).toBe('Lowest now: Build & Release, 4 min. Highest: CI/CD, 7 min.');
  });
  it('says no line when the goals keep different decimals', () => {
    const rows = L.metricGoals('m', [link('a', 'build'), link('b', 'cicd')], [row('a', 'on', '4 min', 4), row('b', 'on', '7.0 min', 7, goal('b', 'min', 1))], teams, cycle);
    expect(L.summaryLine(rows)).toBeNull();
  });
  it('counts by status, worst first, only the statuses there are', () => {
    expect(L.goalsByStatus(['on', 'off', 'on'])).toEqual([{ status: 'off', n: 1 }, { status: 'on', n: 2 }]);
  });
});

describe('rule 3: what a metric needs', () => {
  const ids = (m: Metric, reads = r) => L.metricNeeds(m, reads).map((n) => n.id);
  const fresh = (over: Partial<Metric> = {}): Metric => ({ ...metric('lead-time'), id: 'metric_runner-wait', meaning: '', source: '', createdAt: '2026-11-05T09:00:00.000Z', ...over });
  const linked = { ...r, links: [...r.links, { id: 'ci-shard', goalId: 'ci-shard', metricId: 'metric_runner-wait', teamId: 'cicd', linkedBy: 'rhea', linkedAt: '' }] };
  it('Lead time for changes needs nothing; CI compute cost, added in the seed and unused, needs a goal', () => {
    expect(ids(metric('lead-time'))).toEqual([]);
    expect(L.metricNeeds(metric('ci-cost'), r)).toEqual([{ id: 'unused', sentence: 'No goal uses it', button: 'See goals in USD', to: '/goals?scope=all&q=USD' }]);
  });
  it('one added today in a goal form, linked, with only a name, unit and direction: a meaning and a source', () => {
    expect(ids(fresh(), linked)).toEqual(['no-meaning', 'no-source']);
    expect(L.metricNeeds(fresh(), linked)[0]).toEqual({ id: 'no-meaning', sentence: 'No meaning yet', button: 'Say what it means', to: '/metrics/runner-wait/edit?field=meaning' });
  });
  it('the same with its owner marked as left: the owner first; with no owner at all, said so', () => {
    const left = { ...linked, people: linked.people.map((p) => (p.id === 'rhea' ? { ...p, leftAt: '2026-11-01T00:00:00Z' } : p)) };
    expect(ids(fresh(), left)).toEqual(['no-owner', 'no-meaning', 'no-source']);
    expect(L.metricNeeds(fresh(), left)[0]!.sentence).toBe('Its owner has left');
    expect(L.metricNeeds(fresh({ ownerId: 'nobody' }), linked)[0]!.sentence).toBe('It has no owner');
  });
  it('one added yesterday, not yet linked, has 14 days’ grace before No goal uses it', () => {
    expect(ids(fresh({ createdAt: '2026-11-04T12:00:00.000Z', meaning: 'x', source: 'y' }))).toEqual([]);
    expect(ids(fresh({ createdAt: '2026-10-20T12:00:00.000Z', meaning: 'x', source: 'y' }))).toEqual(['unused']);
  });
  it('a row says the first, and how many more', () => {
    expect(L.needsLine(L.metricNeeds(fresh(), linked))).toBe('No meaning yet, and 1 more');
    expect(L.needsLine([])).toBe('');
  });
});

describe('words and addresses', () => {
  it('says decimals and direction in words', () => {
    expect([0, 1, 2].map(L.decimalsWords)).toEqual(['whole numbers', 'to 1 decimal place', 'to 2 decimal places']);
    expect(L.directionWords('lower')).toBe('lower is better');
  });
  it('names a metric in its address by its slug, and finds it by slug or id', () => {
    expect(L.metricPath(metric('lead-time'))).toBe('/metrics/lead-time');
    expect(L.metricAt(r.metrics, 'lead-time')?.name).toBe('Lead time for changes');
    expect(L.metricAt(r.metrics, 'metric_lead-time')?.name).toBe('Lead time for changes');
    expect(L.metricAt(r.metrics, 'nope')).toBeUndefined();
  });
  it('leads Wednesday’s addresses to the library’s, row by row, keeping the rest of the query', () => {
    expect(L.movedMetrics('/data/metrics')).toBe('/metrics');
    expect(L.movedMetrics('/data/metrics', '?m=metric_lead-time')).toBe('/metrics/lead-time');
    expect(L.movedMetrics('/data/metrics', '?m=metric_lead-time&edit')).toBe('/metrics/lead-time/edit');
    expect(L.movedMetrics('/data/metrics', '?new')).toBe('/metrics/new');
    expect(L.movedMetrics('/metrics', '?m=metric_cfr&today=2026-11-05')).toBe('/metrics/cfr?today=2026-11-05');
    expect(L.movedMetrics('/metrics', '?q=rhea')).toBeNull();
    expect(L.movedMetrics('/goals')).toBeNull();
  });
  it('lists the units in use, A to Z', () => {
    expect(L.unitsInUse(r.metrics)).toEqual(['%', 'deploys', 'hours', 'min', 'pts', 'USD']);
  });
});
