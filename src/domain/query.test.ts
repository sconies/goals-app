// @vitest-environment node
import { buildPlatformOrg } from '../data/platformOrg';
import { currentWeek } from './plan';
import { applyQuery, describeQuery, EMPTY_QUERY, filters, parseQuery, queryEntries, queryParts, without, type GoalQuery } from './query';
import { filterText } from './find';
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
    const q: GoalQuery = { ...EMPTY_QUERY, q: 'merge queue', status: ['off', 'risk'], level: ['svp'], attention: true, needs: ['slipped'], due: 'quarter', quiet: 2, quarter: 'missed', result: ['open'], feeds: 'ns-lead', helps: true, sort: 'gap', dir: -1 };
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
  it('finds a goal by its key, however it is typed: “G-48”, “g48”, “48” (U28)', () => {
    const g = s.goals.find((x) => x.key === 'G-48')!;
    expect(g).toBeTruthy();
    for (const typed of ['G-48', 'g48', 'g-48', ' 48 ', '48']) expect(run({ q: typed })).toContain(g.id);
    expect(run({ q: 'G-48' })).toEqual([g.id]);
    expect(run({ q: 'G-4' })).not.toContain(g.id);
    expect(run({ q: 'G-99999' })).toEqual([]);
  });
  it('counts no done goal as quiet, and the pinned view uses the no-recent-update threshold (demo review, 8 Nov)', () => {
    const quiet = applyQuery(sums, { ...EMPTY_QUERY, quiet: 2 }, ctx);
    expect(quiet.length).toBeGreaterThan(0);
    expect(quiet.filter((x) => x.status === 'done')).toEqual([]);
    expect(sums.some((x) => x.status === 'done' && x.quietDays >= 14)).toBe(true);
    const views = s.views ?? [];
    expect(views.filter((v) => /quiet=/.test(v.params)).map((v) => v.params)).toEqual(['quiet=2&sort=last']);
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
    const q: GoalQuery = { ...EMPTY_QUERY, status: ['off', 'risk'], due: 'quarter', attention: true, needs: ['decision'] };
    expect(describeQuery(q, { team: (x) => x, person: (x) => x, goal: (x) => x }).map((c) => c.text)).toEqual(['Off track or At risk', 'Needs attention because: decision or help needed', 'Due this quarter']);
    expect(describeQuery({ ...EMPTY_QUERY, attention: true, quiet: 2, quarter: 'missed' }, { team: (x) => x, person: (x) => x, goal: (x) => x }).map((c) => c.text)).toEqual(['Needs attention', 'No update for 2+ weeks', 'Not met last quarter']);
    expect(without(q, 'needs')).toMatchObject({ attention: false, needs: [] });
    expect(without(q, 'due').due).toBeNull();
  });
});

describe('queryParts (find rule 3, on Goals)', () => {
  const names = { team: (id: string) => (id === 'cicd' ? 'CI/CD' : id), person: (id: string) => (id === 'rhea' ? 'Rhea Kapoor' : id), goal: (id: string) => id };
  it('says each filter as its label and values, never the search or the switch', () => {
    const q = { ...EMPTY_QUERY, q: 'queue', attention: true, status: ['off', 'risk'], owner: ['rhea'], team: ['cicd'] } as GoalQuery;
    expect(queryParts(q, names).map(filterText)).toEqual(['Status Off track or At risk', 'Team CI/CD', 'Owner Rhea Kapoor']);
  });
  it('says the reasons for needing attention when they narrow it', () => {
    const q = { ...EMPTY_QUERY, attention: true, needs: ['slipped'] } as GoalQuery;
    expect(queryParts(q, names).map(filterText)).toEqual(['Needs attention because date slipped']);
  });
});

describe('a module’s filter, declared as a column (architecture 4.2)', () => {
  it('reads its parameter once added, compares the column, words it and removes it', async () => {
    const q = await import('./query');
    q.addColumnParams(['measuredby']);
    const parsed = q.parseQuery(new URLSearchParams('measuredby=m1&status=off'));
    expect(parsed.cols).toEqual({ measuredby: 'm1' });
    expect(q.queryEntries(parsed)).toContainEqual(['measuredby', 'm1']);
    expect(q.filters(parsed)).toBe(true);
    const names = { team: () => '', person: () => '', goal: () => '', col: (k: string, v: string) => (k === 'measuredby' ? { label: 'Measured by', value: v.toUpperCase() } : null) };
    expect(q.queryParts({ ...q.EMPTY_QUERY, cols: { measuredby: 'm1' } }, names)).toEqual([{ key: 'measuredby', label: 'Measured by', values: ['M1'] }]);
    expect(q.without(parsed, 'measuredby').cols).toEqual({});
  });

  it('reads a family’s parameters by their start (Fields’ f.<field id>), and a column’s test picks several values', async () => {
    const q = await import('./query');
    q.addColumnPrefixes(['fam.']);
    const parsed = q.parseQuery(new URLSearchParams('fam.stage=Build,Run&fam.=x&status=off'));
    expect(parsed.cols).toEqual({ 'fam.stage': 'Build,Run' });
    expect(q.isQueryKey('fam.stage')).toBe(true);
    expect(q.isQueryKey('fam.')).toBe(false);
    expect(q.queryEntries(parsed)).toContainEqual(['fam.stage', 'Build,Run']);
    const col: import('./query').ColumnFill = Object.assign((g: { id: string }) => (g.id === 'a' ? 'Build' : 'Discover'), { test: (g: { id: string }, picked: string) => picked.split(',').includes(g.id === 'a' ? 'Build' : 'Discover') });
    expect(q.columnPasses(col, { id: 'a' } as never, 'Build,Run')).toBe(true);
    expect(q.columnPasses(col, { id: 'b' } as never, 'Build,Run')).toBe(false);
    expect(q.without(parsed, 'fam.stage').cols).toEqual({});
  });
});
