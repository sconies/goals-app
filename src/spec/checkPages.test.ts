import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDoc } from './checkPages';

const r = { root: path.resolve(__dirname, '../..') };

describe('the F and N checks in words (drill 11: F6, F7, F8, F17, N5 had no steps)', () => {
  it('reads what each opens and every failure it can report, in the script’s words', () => {
    const f6 = checkDoc(r, 'F6', 'evals/finish/6-map-reviews.cjs', 'Fit and finish, map-reviews');
    expect(f6.opens).toContain('1440 × 900, as amara, at `/goals?scope=all&view=map`');
    expect(f6.fails.map((x) => x.text)).toContain('Map: Delete/Backspace on a goal took the map from {before.length} goals to {after.length}');
    for (const [id, file] of [['F7', 'evals/finish/7-data-workspace.cjs'], ['F8', 'evals/finish/8-sheets.cjs'], ['F17', 'evals/finish/17-import.cjs'], ['N5', 'evals/notes/5-data-ids.cjs']] as const) {
      expect(checkDoc(r, id, file, id).fails.length, id).toBeGreaterThan(0);
    }
  });
});
