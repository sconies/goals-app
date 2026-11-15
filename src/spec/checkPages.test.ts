import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDoc, checkPage } from './checkPages';
import { checks } from './sources';

const r = { root: path.resolve(__dirname, '../..') };
const FN = () => checks(r).filter((x) => /^evals\/(finish|notes)\//.test(x.file));
const doc = (id: string) => { const x = FN().find((c) => c.id === id)!; return checkDoc(r, x.id, x.file, x.title); };

describe('the F and N checks in words (drill 11: F6, F7, F8, F17, N5 had no steps)', () => {
  it('reads what each opens and every failure it can report, in the script’s words', () => {
    const f6 = checkDoc(r, 'F6', 'evals/finish/6-map-reviews.cjs', 'Fit and finish, map-reviews');
    expect(f6.opens).toContain('1440 × 900, as amara, at `/goals?scope=all&view=map`');
    expect(f6.fails.map((x) => x.text)).toContain('Map: Delete/Backspace on a goal took the map from {before.length} goals to {after.length} (its test: `before.length > 0`)');
    for (const [id, file] of [['F7', 'evals/finish/7-data-workspace.cjs'], ['F8', 'evals/finish/8-sheets.cjs'], ['F17', 'evals/finish/17-import.cjs'], ['N5', 'evals/notes/5-data-ids.cjs']] as const) {
      expect(checkDoc(r, id, file, id).fails.length, id).toBeGreaterThan(0);
    }
  });

  it('lists the places a loop opens, each width and viewer it takes, and a touch screen apart from the address (build review of #547)', () => {
    const f11 = doc('F11');
    expect(f11.opens).toEqual(['390 × 844, as rhea, at `/reviews/new`', '1440 × 900, as rhea, at `/reviews/new`', '390 × 844, as tunde, at `/settings`']);
    const f1 = doc('F1');
    expect(f1.opens).toContain('390 × 844, as tunde, at `/`, on a touch screen');
    expect(f1.opens).toContain('2560 × 900, as rhea, at `/watching`');
    expect(f1.opens).toContain('360 × 900, as amara, at `/activity`, on a touch screen');
    expect(f1.opens.some((o) => /\{\w+\}|, true|when `/.test(o))).toBe(false);
  });

  it('gives every check a where, and every failure it reports through a helper (build review of #547)', () => {
    const n12 = doc('N12');
    expect(n12.opens).toEqual(['1440 × 900, at `/people?store=browser&today=2026-11-05`, then inside the app (as a link moves) at `/people`, `/teams`, `/goals/g40/edit`, `/data`, `/activity`, `/help`, `/feedback`, `/reviews/new`, `/workspace/access`']);
    const all = FN().map((x) => checkDoc(r, x.id, x.file, x.title));
    expect(all.filter((d) => !d.opens.length).map((d) => d.id)).toEqual([]);
    expect(all.filter((d) => !d.fails.length).map((d) => d.id)).toEqual([]);
    for (const d of all) expect(checkPage(d, '../../', 'the core'), d.id).toContain('## Where it looks');
  });

  it('keeps a limit that is only in a failure’s test (F7’s 64px bar; build review of #547)', () => {
    expect(doc('F7').fails.map((x) => x.text)).toContain('[D1] 360 changes bar is {Math.round(foot.f.h)}px over more than one row (its test: `foot.f.h > 64`)');
  });

  it('claims every failure below must not happen only when it lists some', () => {
    const none = { id: 'X1', file: 'evals/x.cjs', title: 'x', about: '', opens: [], fails: [] };
    const page = checkPage(none, '../../', 'the core');
    expect(page).not.toContain('every failure below must not happen');
    expect(page).not.toContain('## What it reports as wrong');
  });
});
