// reviews.csv (spec/conformance/README.md, "reviews.csv"): RS1 for every week, on and off, and RS2's read-back row.
import fs from 'node:fs';
import path from 'node:path';
import { heldOnDueDay, dueWords, switchOffReadBack } from './rules.mjs';

export function writeDrill({ W, S1, outDir }) {
  const last = S1.currentWeek(W.builtFor);
  const rows = [];
  for (let w = 1; w <= last; w++) {
    const held = heldOnDueDay(W, S1, w);
    for (const on of [true, false]) {
      const d = dueWords(on, S1, w, held);
      rows.push(['due', w, on ? 'on' : 'off', held ? 'yes' : 'no', d.by, d.after, d.label, d.flag, '', '']);
    }
  }
  const rb = switchOffReadBack(W, S1);
  rows.push(['readback', '', '', '', '', '', '', '', rb.risks, rb.dueDay]);
  const head = ['rule', 'week', 'reviews', 'held', 'by', 'after', 'on_time', 'flag', 'risks', 'due_day'];
  fs.writeFileSync(path.join(outDir, 'reviews.csv'), [head, ...rows].map((r) => r.map(S1.csvCell).join(',')).join('\n') + '\n');
}
