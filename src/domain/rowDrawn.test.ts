// @vitest-environment node
/* Small workspaces, rule 1 (SM1): a module's menu row waits for its first live record. */
import { rowDrawn, waitingWayIn } from './navigation';

describe('rule 1: rowDrawn', () => {
  it.each([
    ['a module that names nothing to wait for (Spreadsheets)', undefined, undefined, true],
    ['Metrics on, no metric', 'metrics', [], false],
    ['Metrics on, the collection not loaded', 'metrics', undefined, false],
    ['the first metric saved', 'metrics', [{ id: 'm1' }], true],
    ['every metric removed', 'metrics', [{ id: 'm1', removedAt: '2026-11-13T10:00:00Z' }], false],
  ] as const)('%s', (_, waitsFor, rows, drawn) => { expect(rowDrawn(waitsFor, rows)).toBe(drawn); });
});

describe('rule 1: Features is the way in while the row waits (waitingWayIn)', () => {
  const metrics = { routes: ['/metrics', '/metrics/new', '/metrics/:metricId'], menu: { waitsFor: 'metrics' } };
  it('a fresh workspace (Metrics on, no metric) is offered /metrics', () => { expect(waitingWayIn(metrics, undefined)).toBe('/metrics'); expect(waitingWayIn(metrics, [])).toBe('/metrics'); });
  it('every metric removed: /metrics again', () => { expect(waitingWayIn(metrics, [{ id: 'm1', removedAt: '2026-11-13T10:00:00Z' }])).toBe('/metrics'); });
  it('once there is a metric the menu has the row, so nothing', () => { expect(waitingWayIn(metrics, [{ id: 'm1' }])).toBeNull(); });
  it('a module that waits for nothing: nothing', () => { expect(waitingWayIn({ routes: ['/map'] }, undefined)).toBeNull(); });
});
