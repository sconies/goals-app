// @vitest-environment node
/* Small workspaces, rule 1 (SM1): a module's menu row waits for its first live record. */
import { rowDrawn } from './navigation';

describe('rule 1: rowDrawn', () => {
  it.each([
    ['a module that names nothing to wait for (Spreadsheets)', undefined, undefined, true],
    ['Metrics on, no metric', 'metrics', [], false],
    ['Metrics on, the collection not loaded', 'metrics', undefined, false],
    ['the first metric saved', 'metrics', [{ id: 'm1' }], true],
    ['every metric removed', 'metrics', [{ id: 'm1', removedAt: '2026-11-13T10:00:00Z' }], false],
  ] as const)('%s', (_, waitsFor, rows, drawn) => { expect(rowDrawn(waitsFor, rows)).toBe(drawn); });
});
