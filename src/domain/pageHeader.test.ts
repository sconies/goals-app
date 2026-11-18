import { describe, expect, it } from 'vitest';
import { headerButtons, pageKind, phoneTitleShown, taskLine, topBarSays } from './pageHeader';

describe('one page header (PAGE-HEADER)', () => {
  it('knows a list, a detail page and a focused task by its address', () => {
    expect(['/goals', '/check-in', '/reviews', '/people', '/activity', '/goals/lead-mq', '/people/rhea', '/teams/cicd', '/reviews/weekly', '/data/imports/i1', '/check-in/lead-mq', '/goals/new', '/goals/lead-mq/edit', '/reviews/new', '/quick-check-in'].map((p) => pageKind(p)))
      .toEqual(['list', 'list', 'list', 'list', 'list', 'detail', 'detail', 'detail', 'detail', 'detail', 'task', 'task', 'task', 'task', 'task']);
  });
  it('treats a module’s focus page as a task', () => {
    expect(pageKind('/metrics/m1/edit', '', ['/metrics/:metricId/edit'])).toBe('task');
    expect(pageKind('/metrics/m1')).toBe('detail');
  });
  it('says a task’s name, with where you are only when there is more than one', () => {
    expect(taskLine('Week 46 check-in', 2, 7)).toBe('Week 46 check-in · 2 of 7');
    expect(taskLine('Week 46 check-in', 1, 1)).toBe('Week 46 check-in');
    expect(taskLine('Change a goal')).toBe('Change a goal');
    expect(taskLine('Week 46 check-in', 9, 7)).toBe('Week 46 check-in · 7 of 7');
  });
  it('keeps one filled button on a list, one filled and one plain on a detail page, none on a task', () => {
    const b = [{ label: 'Check in again', filled: true }, { label: 'Watch' }, { label: 'Share' }, { label: 'New goal', filled: true }];
    expect(headerButtons('detail', b).shown.map((x) => x.label)).toEqual(['Check in again', 'Watch']);
    expect(headerButtons('detail', b).more.map((x) => x.label)).toEqual(['Share', 'New goal']);
    expect(headerButtons('list', b).shown.map((x) => x.label)).toEqual(['Check in again']);
    expect(headerButtons('task', b).shown).toEqual([]);
  });
  it('names the page in the phone’s top bar only once the title has scrolled away', () => {
    expect(topBarSays('list', 'Goals', 'Platform', true)).toBe('Platform');
    expect(topBarSays('list', 'Goals', 'Platform', false)).toBe('Goals');
    expect(topBarSays('task', 'Goals', 'Platform', false)).toBeNull();
    // Goals and Watching keep their title for screen readers on a phone, so the bar names them at once.
    expect(phoneTitleShown('/goals?scope=mine')).toBe(false);
    expect(phoneTitleShown('/watching')).toBe(false);
    expect(pageKind('/metrics/baselines')).toBe('list');
    expect(phoneTitleShown('/goals/lead-mq')).toBe(true);
    expect(phoneTitleShown('/people')).toBe(true);
  });
});
