/* The demo's number source (backlog 8c): "CI analytics", which fills in the demo workspace's build-time metric, CI
   pipeline time on main (p90), as if the CI system sent it. In the demo, CI's numbers are the series the example was
   built with, so a reading is the value of the goal that metric measures, as last checked in at or before the moment
   asked. Real sources (a warehouse, a dashboard's API, a monitoring tool) are the internal team's: each is a
   NumberSource that passes src/ports/contracts/numbers.ts. Nothing on screen uses it yet. */
import { goalsMeasuredBy } from '../../domain/metrics';
import type { Metric, Snapshot } from '../../domain/types';
import type { NumberSource } from '../../ports';

export const DEMO_SOURCE = 'CI analytics';

export function demoNumbers(snapshot: () => Snapshot): NumberSource {
  return {
    name: DEMO_SOURCE,
    reads: (m: Metric) => m.source === DEMO_SOURCE && !m.removedAt,
    async read(m, at) {
      if (m.source !== DEMO_SOURCE || m.removedAt) return null;
      const s = snapshot();
      const goals = new Set(goalsMeasuredBy(s, m.id).map((g) => g.id));
      const latest = s.checkIns
        .filter((c) => goals.has(c.goalId) && c.value != null && Date.parse(c.postedAt) <= at.getTime())
        .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
        .at(-1);
      return latest ? { value: latest.value!, at: new Date(latest.postedAt).toISOString() } : null;
    },
  };
}
