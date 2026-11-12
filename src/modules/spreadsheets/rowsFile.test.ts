/* The rows-to-fix download (import spec 2.3): the file's own headers, a near header's column kept as written (#199 review). */
import { describe, expect, it } from 'vitest';
import { readTables } from '../../domain/sheets';
import { rowsSheets } from './rowsFile';

describe('rows to fix', () => {
  it('keeps a column whose header is one letter out', () => {
    const read = readTables([{ name: 'Goals', rows: [['Goal', 'Owner', 'Targett'], ['Lead time', 'Rhea Kapoor', '3']] }]);
    const out = rowsSheets(read, read.tables, [{ sheet: 'Goals', row: 2, problem: 'Check the target.' }]);
    expect(out[0]!.rows).toEqual([['Problem', 'Goal', 'Owner', 'Targett'], ['Check the target.', 'Lead time', 'Rhea Kapoor', '3']]);
  });
});
