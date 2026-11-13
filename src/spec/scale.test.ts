// @vitest-environment node
/* The scale budget (backlog AX4; architecture readiness review, findings 6 and 8): the demo workspace made ten times
   bigger, as a large division or the demo after a few years would be. What it weighs loaded, and how long the rules take
   to summarise every goal, stay under stated limits, and the cost per goal doesn't grow with the workspace. Lower the
   limits as the load and the rules get leaner; never raise them to make a change pass. */
import { buildExample } from '../data/examples';
import { currentWeek } from '../domain/plan';
import { summariseAll } from '../domain/summary';
import { attentionFor } from '../domain/attention';
import { scaleWorkspace, TURN } from './scale';

/** The 10x workspace as JSON, at most (50 MB on 11 Nov 2026: the history is most of it). */
export const LOADED_MB = 55;
/** Summarising every goal of the 10x workspace, at most (0.4 s on 11 Nov 2026 after AX4, from 1.0 to 2.1 s before). */
export const SUMMARISE_MS = 1500;
/** The cost per goal at 10x against 1x, at most: about 1 when the rules index what they look up. */
export const GROWTH = 3;

const today = new Date('2026-11-05T12:00:00Z');
/** The quicker of two runs, so a pause elsewhere on the machine doesn't count. */
function timed(run: () => void): number {
  let best = Infinity;
  for (let i = 0; i < 2; i++) { const t = performance.now(); run(); best = Math.min(best, performance.now() - t); }
  return best;
}

describe('the scale budget: the demo workspace, ten times over', () => {
  it('copies the workspace whole, with ids of its own per copy', async () => {
    const one = await buildExample(today);
    const ten = scaleWorkspace(one, 10);
    expect(ten.goals.length).toBe(one.goals.length * 10);
    expect(ten.checkIns.length).toBe(one.checkIns.length * 10);
    expect(new Set(ten.goals.map((g) => g.id)).size).toBe(ten.goals.length);
    // Each copy's goals point at their own copy's people.
    const people = new Set(ten.people.map((p) => p.id));
    expect(ten.goals.every((g) => people.has(g.ownerId))).toBe(true);
  });

  it(`loads at most ${LOADED_MB} MB, and summarises every goal within ${SUMMARISE_MS} ms, at a steady cost per goal`, async () => {
    const one = await buildExample(today);
    const ten = scaleWorkspace(one, 10);
    expect(JSON.stringify(ten).length / 1e6).toBeLessThan(LOADED_MB);
    const cycle = one.cycles[one.cycles.length - 1]!;
    const week = currentWeek(cycle, today);
    const small = timed(() => summariseAll(one.goals, one, cycle, today, week));
    const big = timed(() => summariseAll(ten.goals, ten, cycle, today, week));
    expect(big).toBeLessThan(SUMMARISE_MS);
    expect((big / ten.goals.length) / (small / one.goals.length)).toBeLessThan(GROWTH);
  }, 60_000);

  it(`works out the week's turn for ${TURN.goals.toLocaleString('en-GB')} goals within ${TURN.rulesSeconds} s of rule time, projected from the ten-times workspace`, async () => {
    const one = await buildExample(today);
    const ten = scaleWorkspace(one, 10);
    const cycle = one.cycles[one.cycles.length - 1]!;
    const week = currentWeek(cycle, today);
    // A summary row is the summary and the goal's flags, needs attention and being handled (R4, rule 2).
    const big = timed(() => { summariseAll(ten.goals, ten, cycle, today, week); for (const g of ten.goals) attentionFor(g, ten, cycle, today); });
    expect((big / ten.goals.length) * TURN.goals / 1000).toBeLessThan(TURN.rulesSeconds);
  }, 60_000);
});
