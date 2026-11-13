// @vitest-environment node
/* Reviews switched off, in the spreadsheets (RS, docs/design/round-4/reviews-switch/spec.md 5): the workbook leaves out
   the Notes sheet and the Review column on Asks; a workbook that has them is not refused, and the preview says once that
   they were not read. */
import { workbook, type Table } from './export';
import { readLine, readTables, reviewsOffReadLine } from './sheets';
import { currentWeek } from './plan';
import { buildPlatformOrg } from '../data/platformOrg';

const today = new Date('2026-11-12T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const input = { ws: { id: 'ws', name: 'Platform Engineering' }, snapshot: s, cycle, week: currentWeek(cycle, today), today };
const grids = (book: Table[]) => book.map((t) => ({ name: t.name, rows: t.rows.map((r) => r.map((c) => (c == null ? '' : String(c)))) }));

describe('the workbook with Reviews off', () => {
  it('has the Notes sheet and the Review column on Asks with Reviews on', () => {
    const book = workbook(input);
    expect(book.map((t) => t.name)).toContain('Notes');
    expect(book.find((t) => t.name === 'Asks')!.rows[0]).toContain('Review');
  });

  it('leaves out the Notes sheet and the Review column on Asks with Reviews off, and Start here doesn’t describe them', () => {
    const book = workbook({ ...input, reviews: false });
    expect(book.map((t) => t.name)).not.toContain('Notes');
    const asks = book.find((t) => t.name === 'Asks')!;
    expect(asks.rows[0]).not.toContain('Review');
    expect(asks.rows.slice(1).every((r) => r.length === asks.rows[0]!.length)).toBe(true);
    const start = book.find((t) => t.name === 'Start here')!.rows.map((r) => r.join(' ')).join('\n');
    expect(start).not.toMatch(/The Notes sheet/);
  });
});

describe('importing a workbook with Reviews’ parts while Reviews is off', () => {
  const read = readTables(grids(workbook(input)));

  it('is not refused: the loaded sheets are read as usual, and the file is marked as having Reviews’ parts', () => {
    expect(read.read.map((x) => x.kind)).toEqual(['goals', 'plan', 'checkIns', 'people']);
    expect(read.reviews).toBe(true);
  });

  it('says once that the Notes sheet and the Review column were not read, and leaves Notes out of the sheets for reading', () => {
    const line = readLine(read, 0, { reviewsOff: 'Platform Engineering' });
    expect(line).toContain('Reviews is off in Platform Engineering: the Notes sheet and the Review column were not read.');
    expect(line.split('Reviews is off').length).toBe(2);
    expect(line).toMatch(/Not read: Results and Asks \(for reading only\)\./);
    expect(reviewsOffReadLine('Platform Engineering')).toBe('Reviews is off in Platform Engineering: the Notes sheet and the Review column were not read.');
  });

  it('with Reviews on, or a file without them, says nothing about Reviews', () => {
    expect(readLine(read)).not.toMatch(/Reviews is off/);
    const without = readTables(grids(workbook({ ...input, reviews: false })));
    expect(without.reviews).toBeFalsy();
    expect(readLine(without, 0, { reviewsOff: 'Platform Engineering' })).not.toMatch(/Reviews is off/);
  });
});
