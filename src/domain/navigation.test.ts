import { litItem, menuGroups, menuRows, menuViews, moreFor, pageName, phoneTabs, placeName } from './navigation';

const rows = (o: boolean) => menuRows(menuGroups(o)).filter((x) => !x.startsWith('module:')) as Parameters<typeof pageName>[2];

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
  it('lights one item for an address', () => {
    const items = menuRows(menuGroups(true, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }]));
    const mods = [{ id: 'metrics', to: '/metrics', label: 'Metrics' }];
    expect(['/goals/lead-mq', '/goals/new', '/check-in/x', '/quick-check-in', '/teams/cicd', '/whats-new', '/workspace/access', '/workspace/new', '/metrics/m1', '/research'].map((p) => litItem(p, items, mods) ?? 'none'))
      .toEqual(['goals', 'new', 'checkin', 'checkin', 'people', 'help', 'workspace', 'none', 'module:metrics', 'none']);
  });
  it('names a page', () => {
    expect(pageName('/goals', 'watching', rows(true))).toBe('Watching');
    expect(pageName('/reviews/weekly', null, rows(true))).toBe('Reviews');
    expect(pageName('/help/check-in', null, rows(true))).toBe('Help');
    expect(pageName('/check-in/ns-lead', null, rows(false))).toBe('Check-in');
    expect(pageName('/metrics/m1', null, rows(true), 'Lead time for changes')).toBe('Lead time for changes');
  });
  it('says where a Back link leads', () => {
    const names = { goal: (id: string) => (id === 'g1' ? 'Lead time' : null), review: () => 'Platform weekly', view: () => null, article: () => 'Checking in on a goal', person: () => 'Rhea Kapoor', team: () => null };
    expect(['/', '/goals?show=mine', '/goals/g1', '/goals/zz', '/goals/g1?review=w', '/reviews/w', '/help/check-in', '/data', '/nowhere', '/people/rhea', '/teams/zz'].map((p) => placeName(p, names)))
      .toEqual(['Home', 'your goals', 'Lead time', 'the goal', 'Platform weekly', 'Platform weekly', 'Checking in on a goal', 'Data', 'the last page', 'Rhea Kapoor', 'Teams']);
  });
});
