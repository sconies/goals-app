// @vitest-environment node
/* PR CI's cap (Lane, 14 Nov): when a pull request's files touch more than 25 journeys beyond the core ones, its CI runs
   the core journeys and the 25 the files name most directly; the full suite after the merge runs the rest. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { touches, capJourneys, PR_JOURNEY_CAP } = require('../../evals/touches.cjs') as {
  touches: (files: string[]) => { ids: string[]; score: Map<string, number> };
  capJourneys: (journeys: string[], core: string[], score: Map<string, number>, cap?: number) => { run: string[]; left: string[] };
  PR_JOURNEY_CAP: number;
};
const CORE = ['U1', 'U2', 'U3', 'U5', 'U16', 'U33'];

describe('PR CI’s journey cap', () => {
  it('is 25 beyond the core journeys', () => expect(PR_JOURNEY_CAP).toBe(25));

  it('runs everything at or under the cap', () => {
    const journeys = [...CORE, ...Array.from({ length: 25 }, (_, i) => `U${200 + i}`)];
    expect(capJourneys(journeys, CORE, new Map())).toEqual({ run: journeys, left: [] });
  });

  it('over it, keeps every core journey and the ones named most directly, and lists the rest for after the merge', () => {
    const others = Array.from({ length: 30 }, (_, i) => `U${200 + i}`);
    const score = new Map(others.map((id, i) => [id, i]));
    const { run, left } = capJourneys([...CORE, ...others], CORE, score);
    expect(run.filter((id) => CORE.includes(id))).toEqual(CORE);
    expect(run.length).toBe(CORE.length + 25);
    expect(left).toEqual(['U200', 'U201', 'U202', 'U203', 'U204']);
  });

  it('scores a file whose rule names one journey above a file whose rule names many', () => {
    const t = touches(['src/app/tours.ts', 'evals/finish/7-something.cjs']);
    expect(t.score.get('F7')).toBe(1);
    expect(t.score.get('U27')).toBeCloseTo(1 / 5);
  });
});
