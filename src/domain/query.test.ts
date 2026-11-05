// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { applyQuery, describeQuery, EMPTY_QUERY, filters, parseQuery, queryEntries, without, type GoalQuery } from './query';
import { summariseAll } from './summary';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const sums = summariseAll(s.goals, s, cycle, today, week);
const ctx = { goals: s.goals, cycle, week };
const run = (q: Partial<GoalQuery>) => applyQuery(sums, { ...EMPTY_QUERY, ...q }, ctx).map((x) => x.goal.id);
const id = (title: string) => s.goals.find((g) => g.title === title)!.id;

describe('searching, filtering and sorting goals', () => {
  it('round-trips through a link, ignoring anything it doesn’t know', () => {
    const q: GoalQuery = { ...EMPTY_QUERY, q: 'merge queue', status: ['off', 'risk'], level: ['svp'], needs: ['slipped'], due: 'quarter', quiet: 2, quarter: 'missed', result: ['open'], feeds: 'ns-lead', helps: true, sort: 'gap', dir: -1 };
    expect(parseQuery(new URLSearchParams(queryEntries(q)))).toEqual(q);
    expect(parseQuery(new URLSearchParams('status=nope,off&sort=sideways&due=-3&quiet=x'))).toEqual({ ...EMPTY_QUERY, status: ['off'] });
    expect(filters({ ...EMPTY_QUERY, sort: 'title' })).toBe(false);
  });
  it('finds goals by every word, in titles, owners, teams and the owner’s reasons', () => {
    expect(run({ q: 'merge queue' })).toEqual(expect.arrayContaining([id('Lead time for changes'), id('Merge queue live for every monorepo')]));
    expect(run({ q: 'rhea flaky' })).toEqual([id('Lead time for changes'), id('Flaky test rate in the main pipelines')]);
    expect(run({ q: 'MergeFlow' })).toContain(id('Merge queue live for every monorepo'));
    expect(run({ q: 'nothing like this' })).toEqual([]);
  });
  it('filters by status, level, team, owner and type', () => {
    expect(run({ status: ['stale'] }).sort()).toEqual([id('Object storage on the right lifecycle tier'), id('Portal searches that find the right page first time')].sort());
    expect(run({ status: ['off'], level: ['svp'] })).toEqual(expect.arrayContaining([id('Pipeline queue wait (p90)'), id('Container images rebuilt within 7 days of a base image fix')]));
    const tariq = s.people.find((p) => p.name === 'Tariq Haddad')!.id;
    expect(run({ owner: [tariq] }).sort()).toEqual([id('Pull requests with AI-assisted review'), id('Time from pull request opened to first review'), id('Hours a week developers lose to tooling friction')].sort());
    expect(run({ kind: ['milestone'] }).every((g) => s.goals.find((x) => x.id === g)!.kind === 'milestone')).toBe(true);
  });
  it('finds what needs someone: a decision, a slipped date', () => {
    expect(run({ needs: ['decision'] })).toEqual(expect.arrayContaining([id('Lead time for changes'), id('Pipeline queue wait (p90)'), id('Kafka moved to the managed service')]));
    expect(run({ needs: ['slipped'] })).toEqual(expect.arrayContaining([id('Change failure rate'), id('Merge queue live for every monorepo')]));
    expect(run({ needs: ['slipped'] })).not.toContain(id('Pull requests with AI-assisted review'));
  });
  it('filters by time and results', () => {
    expect(run({ quiet: 2 })).toEqual(expect.arrayContaining([id('Object storage on the right lifecycle tier'), id('Portal searches that find the right page first time')]));
    expect(run({ due: week - 1 })).toEqual(expect.arrayContaining([id('Merge queue live for every monorepo'), id('Kafka moved to the managed service')]));
    expect(run({ result: ['missed'] })).toEqual(expect.arrayContaining([id('Merge queue live for every monorepo'), id('Automatic halt when a canary burns its error budget')]));
    expect(run({ quarter: 'missed' })).toEqual(expect.arrayContaining([id('Lead time for changes'), id('Pipeline queue wait (p90)')]));
  });
  it('narrows to a goal’s tree, or to goals with “also helps” links', () => {
    const cloud = s.goals.find((g) => g.level === 'north-star' && g.title.startsWith('Cloud'))!;
    const tree = run({ feeds: cloud.id });
    expect(tree).toContain(cloud.id);
    expect(tree.every((g) => { let x = s.goals.find((y) => y.id === g); while (x && x.id !== cloud.id) x = s.goals.find((y) => y.id === x!.parentId); return !!x; })).toBe(true);
    expect(run({ helps: true }).length).toBeGreaterThanOrEqual(3);
  });
  it('sorts, with worst first breaking ties', () => {
    const due = applyQuery(sums, { ...EMPTY_QUERY, sort: 'due' }, ctx);
    expect(due[0]!.goal.id).toBe(id('Security approval for the AI reviewer on regulated repositories'));
    const names = applyQuery(sums, { ...EMPTY_QUERY, sort: 'title', dir: -1 }, ctx).map((x) => x.goal.title);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
  });
  it('says each filter in words, and can drop one', () => {
    const q: GoalQuery = { ...EMPTY_QUERY, status: ['off', 'risk'], due: 'quarter', needs: ['decision'] };
    expect(describeQuery(q, { team: (x) => x, person: (x) => x, goal: (x) => x }).map((c) => c.text)).toEqual(['Off track or At risk', 'Decision or help needed', 'Due this quarter']);
    expect(without(q, 'due').due).toBeNull();
  });
});
