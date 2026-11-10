import { litItem, menuFor, pageName, placeName, sideFor, tabsFor } from './navigation';

describe('the menu, the lit item and a page’s name (AR2)', () => {
  it('gives Check-in only to someone who owns a goal, on the sidebar and the phone’s tabs', () => {
    expect(sideFor(true)).toEqual(['home', 'checkin', 'goals', 'reviews', 'activity', 'data', 'new', 'workspace']);
    expect(sideFor(false)).not.toContain('checkin');
    expect(tabsFor(true)).toEqual(['home', 'checkin', 'goals', 'reviews']);
    expect(tabsFor(false)).toEqual(['home', 'goals', 'watching', 'reviews']);
  });
  it('places a module’s items by their group', () => {
    expect(menuFor(false, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }, { id: 'plan', to: '/plan', label: 'Plan', group: 'work' }]))
      .toEqual(['home', 'goals', 'reviews', 'module:plan', 'activity', 'data', 'module:metrics', 'new', 'workspace']);
  });
  it('lights one item for an address', () => {
    const items = menuFor(true, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }]);
    expect(litItem('/goals/lead-mq', items)).toBe('goals');
    expect(litItem('/goals/new', items)).toBe('new');
    expect(litItem('/metrics/m1', items, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }])).toBe('module:metrics');
    expect(litItem('/settings', items)).toBeNull();
    expect(litItem('/watching', ['home', 'goals'], [], ['home', 'goals'])).toBe('goals');
  });
  it('names a page', () => {
    expect(pageName('/goals', 'watching', sideFor(true))).toBe('Watching');
    expect(pageName('/reviews/weekly', null, sideFor(true))).toBe('Reviews');
    expect(pageName('/help/check-in', null, sideFor(true))).toBe('Help');
    expect(pageName('/check-in/ns-lead', null, sideFor(false))).toBe('Check-in');
    expect(pageName('/metrics/m1', null, sideFor(true), 'Lead time for changes')).toBe('Lead time for changes');
  });
  it('says where a Back link leads', () => {
    const names = { goal: (id: string) => (id === 'g1' ? 'Lead time' : null), review: () => 'Platform weekly', view: () => null, article: () => 'Checking in on a goal' };
    expect(['/', '/goals?show=mine', '/goals/g1', '/goals/zz', '/goals/g1?review=w', '/reviews/w', '/help/check-in', '/data', '/nowhere'].map((p) => placeName(p, names)))
      .toEqual(['Home', 'your goals', 'Lead time', 'the goal', 'Platform weekly', 'Platform weekly', 'Checking in on a goal', 'Data', 'the last page']);
  });
});
