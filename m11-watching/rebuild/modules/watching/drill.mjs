// watching.csv (spec/conformance/README.md): covers, one row per person who watches; readback, one row.
import fs from 'node:fs';
import path from 'node:path';
import { liveWatches, watchedIds, watchingOffReadBack } from './rules.mjs';

export function writeDrillFiles({ W, S1, outDir }) {
  const goals = S1.allGoals; // goals not removed
  const live = liveWatches(W, { onlyHere: false });
  const people = [...new Set(live.map((w) => w.personId))].sort();
  const rows = [['rule', 'person', 'watches', 'covers', 'people', 'see_through']];
  for (const p of people) rows.push(['covers', p, live.filter((w) => w.personId === p).length, watchedIds(goals, live, p).size, '', '']);
  const rb = watchingOffReadBack(W);
  rows.push(['readback', '', rb.watches, '', rb.people, rb.seeThrough]);
  fs.writeFileSync(path.join(outDir, 'watching.csv'), rows.map((r) => r.map(S1.csvCell).join(',')).join('\n') + '\n');
}
