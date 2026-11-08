// @vitest-environment node
/* The inbox's list (backlog W): tabs, folding markups on the same part, filters and search, counts, pages of 25, and
   which row opens next once one is handled. */
import type { InboxFeedback } from './feedback';
import { filterChoices, filterItems, inboxItems, itemFor, itemIds, itemLine, nextAfter, NO_FILTER, pageOf, stepKey, tabCounts, tabOf, newCount, PAGE_SIZE } from './inboxList';
import type { Markup, MarkupStatus } from './model';

const markup = (id: string, o: Partial<Markup> & { part?: string[] } = {}): Markup => ({
  id, workspaceId: 'w', workspaceName: 'Acme', demo: false, personId: 'p', personName: o.personName ?? 'Rhea Kapoor', line: o.line ?? `Line ${id}`, mood: null,
  route: o.route ?? '/', path: o.route ?? '/', goalId: null, reviewId: null, parts: [[o.part ?? ['Home', 'Week strip']]], strokes: [], context: { viewport: { w: 1, h: 1, dpr: 1 }, theme: 'light', themeChoice: 'light', accent: 'teal', appVersion: 'v', sessionId: 's' },
  steps: [], errors: [], pictures: [], status: o.status ?? 'new', issueUrl: null, fixedIn: null, wontFixReason: null, statusBy: null, statusAt: null, createdAt: o.createdAt ?? '2026-11-05T09:00:00.000Z',
});
const fb = (id: string, o: Partial<InboxFeedback> = {}): InboxFeedback => ({
  id, workspaceId: 'w', workspaceName: 'Acme', personId: 'p', personName: o.personName ?? 'Mateo Silva', path: o.path ?? '/check-in', mood: o.mood ?? 'meh', text: o.text ?? `Said ${id}`,
  at: o.at ?? '2026-11-04T09:00:00.000Z', status: o.status ?? 'new', fixedIn: null, wontFixReason: null, statusBy: null, statusAt: null,
});

describe('The inbox’s list', () => {
  it('puts each status in its tab: New, In hand, and Closed for fixed and won’t fix', () => {
    expect((['new', 'in-hand', 'fixed', 'wont-fix'] as MarkupStatus[]).map(tabOf)).toEqual(['new', 'in-hand', 'closed', 'closed']);
  });

  it('folds markups on the same part of the same page into one row, newest first, within a tab', () => {
    const items = inboxItems([
      markup('a', { createdAt: '2026-11-05T08:00:00Z' }), markup('b', { createdAt: '2026-11-05T09:00:00Z' }), markup('c', { createdAt: '2026-11-05T07:00:00Z', status: 'in-hand' }),
      markup('d', { part: ['Goal page', 'Scorecard'], route: '/goals/:goalId', createdAt: '2026-11-03T09:00:00Z' }),
    ], [fb('f', { at: '2026-11-04T09:00:00Z' })]);
    const news = filterItems(items, { ...NO_FILTER, tab: 'new' });
    expect(news.map((i) => i.key.slice(0, 1) + ':' + itemIds(i).join(','))).toEqual(['m:b,a', 'f:f', 'm:d']);
    expect(itemLine(news[0]!)).toBe('Line b');
    // The one in hand is a row of its own, in its own tab.
    expect(filterItems(items, { ...NO_FILTER, tab: 'in-hand' }).map(itemIds)).toEqual([['c']]);
  });

  it('counts every piece in each tab, a folded row counting each markup, and the New count beside Inbox', () => {
    const ms = [markup('a'), markup('b'), markup('c', { status: 'fixed' })];
    const fs = [fb('f'), fb('g', { status: 'wont-fix' }), fb('h', { status: 'in-hand' })];
    expect(tabCounts(inboxItems(ms, fs))).toEqual({ new: 3, 'in-hand': 1, closed: 2 });
    expect(newCount(ms, fs)).toBe(3);
  });

  it('filters by kind, page and person, and finds every word typed in what was said, the part, the page or who', () => {
    const items = inboxItems([markup('a', { line: 'The week strip is unclear' }), markup('b', { part: ['Data', 'Toolbar'], route: '/data', personName: 'Jun Park' })], [fb('f', { text: 'The reason box is small', path: '/demo/check-in?x=1' })]);
    const keys = (f: Partial<typeof NO_FILTER>) => filterItems(items, { ...NO_FILTER, ...f, tab: 'new' }).map((i) => itemIds(i)[0]);
    expect(keys({ kind: 'feedback' })).toEqual(['f']);
    expect(keys({ kind: 'markup' }).sort()).toEqual(['a', 'b']);
    expect(keys({ page: '/check-in' })).toEqual(['f']);
    expect(keys({ person: 'Jun Park' })).toEqual(['b']);
    expect(keys({ q: 'toolbar jun' })).toEqual(['b']);
    expect(keys({ q: 'WEEK strip' })).toEqual(['a']);
    expect(keys({ q: 'nothing like this' })).toEqual([]);
    expect(filterChoices(items).pages).toEqual(['/', '/check-in', '/data']);
    // Counts follow the filter.
    expect(tabCounts(items, { ...NO_FILTER, kind: 'markup' }).new).toBe(2);
  });

  it('shows 25 rows a page, and a page past the end shows the last', () => {
    const rows = Array.from({ length: 61 }, (_, i) => i);
    expect(PAGE_SIZE).toBe(25);
    expect(pageOf(rows, 0)).toMatchObject({ pages: 3, from: 1, to: 25 });
    expect(pageOf(rows, 2)).toMatchObject({ from: 51, to: 61 });
    expect(pageOf(rows, 9)).toMatchObject({ page: 2, from: 51 });
    expect(pageOf([], 0)).toMatchObject({ pages: 1, from: 0, to: 0 });
  });

  it('opens the next row once one is handled, or the one before when it was the last', () => {
    const rows = ['a', 'b', 'c'].map((key) => ({ key }));
    expect(nextAfter(rows, rows.filter((r) => r.key !== 'b'), 'b')).toBe('c');
    expect(nextAfter(rows, rows.filter((r) => r.key !== 'c'), 'c')).toBe('b');
    expect(nextAfter(rows, [], 'a')).toBeNull();
    // Still there (its status stayed in this tab): it stays open.
    expect(nextAfter(rows, rows, 'b')).toBe('b');
  });

  it('moves with J and K, staying put at either end', () => {
    const rows = ['a', 'b'].map((key) => ({ key }));
    expect(stepKey(rows, 'a', 1)).toBe('b');
    expect(stepKey(rows, 'b', 1)).toBe('b');
    expect(stepKey(rows, 'a', -1)).toBe('a');
    expect(stepKey(rows, null, 1)).toBe('a');
    expect(stepKey([], null, 1)).toBeNull();
  });

  it('finds the row an address names, by any markup in it or the feedback', () => {
    const items = inboxItems([markup('a'), markup('b')], [fb('f')]);
    expect(itemIds(itemFor(items, 'a')!).sort()).toEqual(['a', 'b']);
    expect(itemFor(items, 'f')?.kind).toBe('feedback');
    expect(itemFor(items, 'zz')).toBeUndefined();
  });
});
