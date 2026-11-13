/* Reviews' rows in the conformance data (RS1, RS2: docs/design/round-4/reviews-switch/spec.md 4):
   spec/conformance/reviews.csv. What dueWords gives for each week of the demo up to `builtFor`, with Reviews on and off,
   and what the read-back before switching it off counts. src/spec/conformance.ts reads this through the module registry
   and writes the file; its test recomputes it from workspace.json; the drill scores it when asked (`"also": ["reviews"]`). */
import { currentWeek } from '../../domain/plan';
import { dueWords } from '../../domain/progress';
import { heldOnDueDay } from '../../domain/review';
import { switchOffReadBack } from '../../domain/reviewsOff';
import { asksOf } from '../../domain/asks';
import type { ConformanceWorkspace, ModuleConformance } from '../../spec/conformance';
import type { Snapshot } from '../../domain/types';

export const HEADER = ['rule', 'week', 'reviews', 'held', 'by', 'after', 'on_time', 'flag', 'risks', 'due_day'];

/** Rule RS1 for every week from 1 to the week of `builtFor`, Reviews on then off; then rule RS2's two counts. */
export function reviewRowsOf(w: ConformanceWorkspace, asOf: (w: ConformanceWorkspace, moment: Date) => Snapshot): string[][] {
  const moment = new Date(w.builtFor);
  const s = asOf(w, moment);
  const blank = (cols: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => cols[h] ?? '');
  const yes = (b: boolean) => (b ? 'yes' : 'no');
  const out: string[][] = [];
  for (let week = 1; week <= currentWeek(w.cycle, moment); week++) {
    const held = heldOnDueDay(s.reviews, w.cycle, week);
    for (const on of [true, false]) {
      const d = dueWords(on, w.cycle, week, held);
      out.push(blank({ rule: 'due', week: String(week), reviews: on ? 'on' : 'off', held: yes(held), by: d.by, after: d.after, on_time: d.onTime, flag: d.flag }));
    }
  }
  const r = switchOffReadBack({ people: s.people, reviews: s.reviews, changes: s.changes, asks: asksOf(s), decisions: s.decisions, goals: s.goals, dueDay: dueWords(false, w.cycle, 1).day });
  out.push(blank({ rule: 'readback', risks: String(r.risks), due_day: r.dueDay }));
  return out;
}

const files: ModuleConformance[] = [{
  file: 'reviews',
  header: HEADER,
  keys: ['rule', 'week', 'reviews'],
  about: 'Reviews’ rules for its switch ([Reviews](../modules/reviews/README.md)), not part of stage 1, scored when asked (`"also": ["reviews"]`). Made on the workspace as it stood at `builtFor` (the same `asOf`). Two kinds of row, by `rule`: **due** (rule RS1, one phrase for the clock), for each week from 1 to the week of `builtFor`, a row with Reviews `on` and one `off`: `held` is `yes` when a review is held on the week’s due day (its weekday is the cycle’s due day and the week is one of its sessions: a multiple of its `everyWeeks`), and `by`, `after`, `on_time` and `flag` are dueWords’ words (“before Thursday’s review” only with Reviews on and a review held that day, else “by Thursday”; the flag “Due by Thu 5 Nov.” either way); **readback** (rule RS2), one row: `risks` the risks a review accepted on goals not removed (notes, not removed, whose words start “We accept the risk: ”) and `due_day` the due day’s name. Every other column is empty.',
  rows: (w, kit) => reviewRowsOf(w, kit.asOf),
}];

export default files;
