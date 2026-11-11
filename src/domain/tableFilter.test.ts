// @vitest-environment node
import { applyTable, columnKind, describeFilter, filterEntries, parseFilters, parseSort, passes, type PropFilter } from './tableFilter';

const head = ['ID', 'Goal', 'Owner', 'Week', 'Why'];
const row = (...cells: string[]) => ({ cells });
const rows = [
  row('a', 'Lead time', 'Sam Patel', '40', 'Cache misses'),
  row('b', 'PR review', 'Sam Patel', '42', ''),
  row('c', 'Alerts', 'Kofi Boateng', '41', 'Model needed labels'),
  row('d', 'Build cache', 'Kofi Boateng', '9', 'On plan'),
];

describe('property filters on a data table', () => {
  it('tells numbers, a fixed set of values and free text apart', () => {
    expect(columnKind(rows.map((r) => r.cells[3]!))).toBe('number');
    expect(columnKind(['Sam Patel', 'Sam Patel', 'Kofi Boateng', 'Kofi Boateng', 'Kofi Boateng'])).toBe('choice');
    expect(columnKind(Array.from({ length: 14 }, (_, i) => `A different reason, number ${i}`))).toBe('text');
    // A long name that repeats down a table is still a set of values: a goal's name on each of its check-ins.
    const long = 'Brain data model and AI infrastructure live, across every team';
    expect(columnKind([...Array(20).fill(long), ...Array(20).fill('Lead time for changes')])).toBe('choice');
  });
  it('matches each condition', () => {
    expect(passes('Sam Patel', { col: 'Owner', op: 'is', value: 'Kofi Boateng|sam patel' })).toBe(true);
    expect(passes('Sam Patel', { col: 'Owner', op: 'isNot', value: 'Sam Patel' })).toBe(false);
    expect(passes('Cache misses', { col: 'Why', op: 'contains', value: 'CACHE' })).toBe(true);
    expect(passes('', { col: 'Why', op: 'empty', value: '' })).toBe(true);
    expect(passes('9', { col: 'Week', op: 'gte', value: '40' })).toBe(false);
    expect(passes('41', { col: 'Week', op: 'gte', value: '40' })).toBe(true);
    expect(passes('', { col: 'Week', op: 'lt', value: '40' })).toBe(false);
  });
  it('combines search, every filter and a sort (numbers as numbers, empty last)', () => {
    const f: PropFilter[] = [{ col: 'Week', op: 'gte', value: '40' }];
    expect(applyTable(rows, head, '', f, { col: 'Week', dir: -1 }).map((r) => r.cells[0])).toEqual(['b', 'c', 'a']);
    expect(applyTable(rows, head, 'kofi', [], { col: 'Week', dir: 1 }).map((r) => r.cells[0])).toEqual(['d', 'c']);
    expect(applyTable(rows, head, '', [{ col: 'Owner', op: 'is', value: 'Sam Patel' }, { col: 'Why', op: 'notEmpty', value: '' }], null).map((r) => r.cells[0])).toEqual(['a']);
    expect(applyTable(rows, head, '', [], { col: 'Why', dir: 1 }).map((r) => r.cells[0]).at(-1)).toBe('b');
  });
  it('keeps filters and the sort in the link, and says them in words', () => {
    const f: PropFilter[] = [{ col: 'Owner', op: 'is', value: 'Sam Patel|Kofi Boateng' }, { col: 'Why', op: 'contains', value: 'a~b' }];
    const p = new URLSearchParams(filterEntries(f, { col: 'Back on plan by week', dir: -1 }));
    expect(parseFilters(p)).toEqual(f);
    expect(parseSort(p)).toEqual({ col: 'back on plan by week', dir: -1 });
    expect(p.get('sort')).toBe('back on plan by week.desc');
    // The older form still opens: s=Column~asc|desc.
    expect(parseSort(new URLSearchParams('s=Team~asc'))).toEqual({ col: 'team', dir: 1 });
    expect(parseSort(new URLSearchParams('sort=team'))).toEqual({ col: 'team', dir: 1 });
    expect(describeFilter(f[0]!)).toBe('Owner is any of Sam Patel or Kofi Boateng');
    expect(describeFilter({ col: 'Week', op: 'gte', value: '40' })).toBe('Week ≥ 40');
  });
});
