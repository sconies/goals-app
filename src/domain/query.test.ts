// @vitest-environment node
import { seed } from '../data/seed';
import { currentWeek } from './plan';
import { applyQuery, describeQuery, EMPTY_QUERY, filters, parseQuery, queryEntries, without, type GoalQuery } from './query';
import { summariseAll } from './summary';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const sums = summariseAll(s.goals, s, cycle, today, week);
const ctx = { goals: s.goals, cycle, week };
const run = (q: Partial<GoalQuery>) => applyQuery(sums, { ...EMPTY_QUERY, ...q }, ctx).map((x) => x.goal.id);
const id = (title: string) => s.goals.find((g) => g.title === title)!.id;

describe('searching, filtering and sorting goals', () => {
  it('round-trips through a link, ignoring anything it doesn’t know', () => {
    const q: GoalQuery = { ...EMPTY_QUERY, q: 'brain', status: ['off', 'risk'], level: ['svp'], needs: ['slipped'], due: 'quarter', quiet: 2, quarter: 'missed', result: ['open'], feeds: 'head', helps: true, sort: 'gap', dir: -1 };
    expect(parseQuery(new URLSearchParams(queryEntries(q)))).toEqual(q);
    expect(parseQuery(new URLSearchParams('status=nope,off&sort=sideways&due=-3&quiet=x'))).toEqual({ ...EMPTY_QUERY, status: ['off'] });
    expect(filters({ ...EMPTY_QUERY, sort: 'title' })).toBe(false);
  });
  it('finds goals by every word, in titles, owners, teams and the owner’s reasons', () => {
    expect(run({ q: 'brain' })).toEqual(expect.arrayContaining([id('Repo-access controls for the Brain'), id('Brain data model and AI infrastructure live')]));
    expect(run({ q: 'kofi alerts' })).toEqual([id('Alerts auto-triaged by AIOps')]);
    expect(run({ q: 'vendor' })).toContain(id('Repo-access controls for the Brain'));
    expect(run({ q: 'nothing like this' })).toEqual([]);
  });
  it('filters by status, level, team, owner and type', () => {
    expect(run({ status: ['stale'] })).toEqual([id('Self-service environments in under 1 hour')]);
    expect(run({ status: ['off'], level: ['svp'] })).toEqual([id('Repo-access controls for the Brain')]);
    const sam = s.people.find((p) => p.name === 'Sam Patel')!.id;
    expect(run({ owner: [sam] }).sort()).toEqual([id('Lead time for changes'), id('PRs with AI code review')].sort());
    expect(run({ kind: ['milestone'] }).every((g) => s.goals.find((x) => x.id === g)!.kind === 'milestone')).toBe(true);
  });
  it('finds what needs someone: a decision, a slipped date', () => {
    expect(run({ needs: ['decision'] })).toEqual(expect.arrayContaining([id('Intake-to-delivery time'), id('Repo-access controls for the Brain')]));
    expect(run({ needs: ['slipped'] }).sort()).toEqual([id('Change failure rate'), id('Idle environments shut down within 2 hours')].sort());
  });
  it('filters by time and results', () => {
    expect(run({ quiet: 2 })).toEqual([id('Self-service environments in under 1 hour')]);
    expect(run({ due: 42 })).toEqual([id('Repo-access controls for the Brain')]);
    expect(run({ result: ['missed'] })).toEqual([id('Repo-access controls for the Brain')]);
    expect(run({ quarter: 'missed' })).toEqual(expect.arrayContaining([id('Alerts auto-triaged by AIOps'), id('Lead time for changes')]));
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
    expect(due[0]!.goal.id).toBe(id('Repo-access controls for the Brain'));
    const names = applyQuery(sums, { ...EMPTY_QUERY, sort: 'title', dir: -1 }, ctx).map((x) => x.goal.title);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
  });
  it('says each filter in words, and can drop one', () => {
    const q: GoalQuery = { ...EMPTY_QUERY, status: ['off', 'risk'], due: 'quarter', needs: ['decision'] };
    expect(describeQuery(q, { team: (x) => x, person: (x) => x, goal: (x) => x }).map((c) => c.text)).toEqual(['Off track or At risk', 'Decision or help needed', 'Due this quarter']);
    expect(without(q, 'due').due).toBeNull();
  });
});
