import { backTo, litItem, litTab, menuGroups, menuRows, menuViews, moreFor, pageName, phoneTabs, placeName, type PlaceNames } from './navigation';

/** The demo's names, as the rules read them. */
const GOALS: Record<string, { title: string; parent?: string }> = { 'G-1': { title: 'Lead time for changes' }, 'G-7': { title: 'Merge-to-deploy time', parent: 'G-1' }, 'G-2': { title: 'Change failure rate' }, 'G-3': { title: 'Deploy frequency' }, 'G-4': { title: 'Pipeline queue wait (p90)' }, 'G-5': { title: 'Flaky test rate' } };
const names: PlaceNames = {
  goal: (id) => GOALS[id]?.title ?? null,
  parent: (id) => GOALS[id]?.parent ?? null,
  review: (id) => (id === 'weekly' ? 'Platform leadership weekly' : null),
  view: (sp) => (sp.get('view') === 'v1' ? 'My goals by status' : null),
  article: (id) => (id === 'goals' ? 'Goals: every goal, filtered and sorted' : null),
  person: (id) => (id === 'rhea' ? 'Rhea Kapoor' : null),
  team: (id) => (id === 'cicd' ? 'CI/CD' : null),
  section: (id) => (id === 'access' ? 'Access' : null),
  cycle: () => '2026',
  module: (p) => (p === '/metrics/lead-time' ? 'Lead time for changes (metric)' : p === '/metrics' ? 'Metrics' : null),
};

describe('the menu, the lit item and a page’s name (AR2, NV1)', () => {
  it('groups the menu: your work, look up, make, this workspace and you; Check-in only for someone with a goal to check in on', () => {
    expect(menuGroups(true)).toEqual({ work: ['home', 'checkin', 'goals', 'reviews'], lookup: ['people', 'activity', 'data'], make: ['new'], you: ['workspace', 'settings', 'help', 'feedback'] });
    expect(menuGroups(false).work).toEqual(['home', 'goals', 'reviews']);
  });
  it('places a module’s items by their group, in the order they register', () => {
    const g = menuGroups(false, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }, { id: 'plan', to: '/plan', label: 'Plan', group: 'work' }]);
    expect(g.work).toEqual(['home', 'goals', 'reviews', 'module:plan']);
    expect(g.lookup).toEqual(['people', 'module:metrics', 'activity', 'data']);
  });
  it('gives a phone four tabs and puts the rest in More, in its groups', () => {
    expect(phoneTabs(true)).toEqual(['home', 'checkin', 'goals', 'reviews']);
    expect(phoneTabs(false)).toEqual(['home', 'goals', 'reviews', 'people']);
    expect(moreFor(menuGroups(false, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }]), phoneTabs(false))).toEqual({ lookup: ['module:metrics', 'activity', 'data'], make: ['new'], you: ['workspace', 'settings', 'help', 'feedback'] });
  });
  it('lists up to four saved views: pinned A to Z, then yours, the latest opened first', () => {
    const v = (id: string, pinned: boolean, createdAt = '2026-11-01') => ({ id, name: id, pinned, mine: !pinned, createdAt });
    expect(menuViews([v('b', true), v('a', true), v('m1', false, '2026-11-02'), v('m2', false, '2026-11-03'), v('m3', false, '2026-11-04')], ['m1']).map((x) => x.id)).toEqual(['a', 'b', 'm1', 'm3']);
  });
  it('lights one item for an address (rule 3)', () => {
    const items = menuRows(menuGroups(true, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }]));
    const mods = [{ id: 'metrics', to: '/metrics', label: 'Metrics' }];
    const lit = (a: string) => { const [p = '/', q = ''] = a.split('?'); return litItem(p, q, items, mods, [{ id: 'v1', params: 'scope=mine&group=none' }]) ?? 'none'; };
    expect(['/', '/check-in', '/check-in/x', '/quick-check-in', '/goals?scope=mine&group=none', '/goals?scope=all', '/goals/G-1', '/goals/G-1/edit', '/goals/G-1/print', '/retro', '/retro/G-1', '/goals/G-1?review=weekly', '/goals/new', '/goals/new/measure', '/reviews/weekly', '/people/rhea', '/teams/cicd', '/metrics/lead-time', '/activity', '/data', '/workspace/access', '/workspace/new', '/settings', '/help/goals', '/whats-new', '/feedback', '/ready', '/research'].map(lit))
      .toEqual(['home', 'checkin', 'checkin', 'checkin', 'view:v1', 'goals', 'goals', 'goals', 'goals', 'goals', 'goals', 'reviews', 'new', 'new', 'reviews', 'people', 'people', 'module:metrics', 'activity', 'data', 'workspace', 'none', 'settings', 'help', 'help', 'feedback', 'none', 'none']);
  });
  it('lights the tab that holds the lit row, or More', () => {
    expect([litTab('goals', phoneTabs(true)), litTab('view:v1', phoneTabs(true)), litTab('people', phoneTabs(true)), litTab('people', phoneTabs(false)), litTab(null, phoneTabs(true))]).toEqual(['goals', 'goals', 'more', 'people', null]);
  });
  it('names a page (rule 2)', () => {
    const n = (a: string) => { const [p = '/', q = ''] = a.split('?'); return pageName(p, q, names); };
    expect(['/', '/goals', '/goals?scope=watching', '/watching', '/goals/G-1', '/goals/G-1/edit', '/goals/G-1/print', '/goals/G-1?review=weekly', '/goals/new/measure', '/check-in', '/check-in/G-1', '/quick-check-in', '/reviews/weekly', '/people/rhea', '/teams/cicd', '/metrics/lead-time', '/workspace/access', '/help/goals', '/retro', '/goals/G-99', '/nowhere'].map(n))
      .toEqual(['Home', 'Goals', 'Goals', 'Goals', 'Lead time for changes', 'Change Lead time for changes', 'Lead time for changes, to print', 'Lead time for changes · Platform leadership weekly', 'New goal: how it’s measured', 'Check-in', 'Check in: Lead time for changes', 'Check-in, all in one table', 'Platform leadership weekly', 'Rhea Kapoor', 'CI/CD', 'Lead time for changes (metric)', 'Access · Workspace', 'Goals: every goal, filtered and sorted', 'Wrap up 2026', 'Goal not found', 'Page not found']);
  });
  it('gives six goals six names', () => {
    expect(new Set(['G-1', 'G-2', 'G-3', 'G-4', 'G-5', 'G-7'].map((g) => pageName('/goals/' + g, '', names))).size).toBe(6);
  });
  it('says where a Back link leads, in the navigation’s words', () => {
    const plain = { ...names, goal: (id: string) => (id === 'g1' ? 'Lead time' : null), review: () => 'Platform weekly', view: () => null, article: () => 'Checking in on a goal', team: () => null };
    expect(['/', '/goals?show=mine', '/goals/g1', '/goals/zz', '/goals/g1?review=w', '/reviews/w', '/help/check-in', '/data', '/nowhere', '/people/rhea', '/teams/zz'].map((p) => placeName(p, plain)))
      .toEqual(['Home', 'your goals', 'Lead time', 'the last page', 'Platform weekly', 'Platform weekly', 'Checking in on a goal', 'Data', 'the last page', 'Rhea Kapoor', 'the last page']);
  });
  it('gives the back link (rule 4)', () => {
    const b = (path: string, trail: string[]) => { const [p = '/', q = ''] = path.split('?'); const x = backTo(p, q, [...trail, path].map((t) => ({ path: t })), names, ['/metrics']); return x ? `${x.label} ${x.steps ? `-${x.steps}` : x.to}` : 'none'; };
    expect([
      b('/goals/G-1', ['/goals?scope=mine']),
      b('/goals/G-1', ['/goals?scope=all', '/goals/G-1', '/goals/G-1/edit']),
      b('/goals/G-7', []),
      b('/goals/G-1', []),
      b('/settings', ['/goals/G-1']),
      b('/people/rhea', ['/']),
      b('/people/rhea', []),
      b('/goals/G-4?review=weekly', ['/reviews/weekly', '/goals/G-1?review=weekly']),
      b('/goals/G-4?review=weekly', []),
      b('/goals/G-1/edit', []),
      b('/reviews/weekly/summary', []),
      b('/help/goals', []),
      b('/quick-check-in', []),
      b('/metrics/lead-time', []),
      b('/metrics', ['/']),
      b('/workspace/access', []),
    ]).toEqual(['your goals -1', 'Goals -3', 'Lead time for changes /goals/G-1', 'Goals /goals', 'none', 'Home -1', 'People /people', 'Platform leadership weekly -2', 'Platform leadership weekly /reviews/weekly', 'Lead time for changes /goals/G-1', 'Platform leadership weekly /reviews/weekly', 'Help /help', 'Check-in /check-in', 'Metrics /metrics', 'none', 'Workspace /workspace']);
  });
});
