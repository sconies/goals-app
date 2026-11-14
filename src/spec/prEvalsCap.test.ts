// @vitest-environment node
/* PR CI's cap (Lane, 14 Nov): when a pull request's files touch more than 25 journeys and checks beyond the core ones,
   its CI runs the core ones and the 25 the files name most directly; the full suite after the merge runs the rest.
   Checks count too (planning, 14 Nov, after #465's smoke job ran out of time). */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { touches, capJourneys, PR_JOURNEY_CAP } = require('../../evals/touches.cjs') as {
  touches: (files: string[]) => { ids: string[]; score: Map<string, number> };
  capJourneys: (journeys: string[], core: string[], score: Map<string, number>, cap?: number) => { run: string[]; left: string[] };
  PR_JOURNEY_CAP: number;
};
const CORE = ['U1', 'U2', 'U3', 'U5', 'U16', 'U33'];

describe('PR CI’s journey and check cap', () => {
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

  it('counts checks as well as journeys, and never drops a core check', () => {
    const core = [...CORE, 'P6'];
    const journeys = Array.from({ length: 15 }, (_, i) => `U${200 + i}`);
    const checks = Array.from({ length: 15 }, (_, i) => `N${40 + i}`);
    const score = new Map([...journeys.map((id) => [id, 1] as const), ...checks.map((id, i) => [id, i < 10 ? 2 : 0] as const)]);
    const { run, left } = capJourneys([...core, ...journeys, ...checks], core, score);
    expect(run).toEqual(expect.arrayContaining(core));
    expect(run.length).toBe(core.length + 25);
    expect(run.filter((id) => id.startsWith('N')).length).toBe(10);
    expect(left).toEqual(['N50', 'N51', 'N52', 'N53', 'N54']);
  });

  it('scores a file whose rule names one journey above a file whose rule names many', () => {
    const t = touches(['src/app/tours.ts', 'evals/finish/7-something.cjs']);
    expect(t.score.get('F7')).toBe(1);
    expect(t.score.get('U27')).toBeCloseTo(1 / 5);
  });
});
