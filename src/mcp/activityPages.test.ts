import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { appWindow, windowed } from '../ports/window';
import type { HistoryAsk } from '../ports/store';
import type { McpContext } from './tools';
import { activityPages } from './workTools';

/* get_activity's reader (build review of #358): a whole snapshot is read as it is; only a windowed one pages the store. */
describe('activityPages', () => {
  const today = new Date('2026-11-05T12:00:00Z');
  const whole = buildPlatformOrg(today);
  const asked: HistoryAsk[] = [];
  const history = async (a: HistoryAsk) => { asked.push(a); return { changes: [], next: null }; };
  const goal = whole.changes.find((c) => c.goalId)!.goalId!;
  const keep = (c: { goalId?: string | null }) => c.goalId === goal;

  it('reads a whole snapshot without asking the store, however few entries match', async () => {
    asked.length = 0;
    const out = await activityPages({ snapshot: whole, history } as unknown as McpContext, keep, 100);
    expect(asked).toEqual([]);
    expect(out.length).toBe(Math.min(100, whole.changes.filter(keep).length));
  });

  it('pages the store for a windowed snapshot', async () => {
    asked.length = 0;
    await activityPages({ snapshot: windowed(whole, appWindow(today)), history } as unknown as McpContext, keep, 5);
    expect(asked.length).toBe(1);
  });
});
