// @vitest-environment node
/* The import's worker is sent plain data (backlog IM6): the engine's input crosses threads without its functions, and
   the change set the worker makes is the one the page would. */
import { planChanges, type ChangeInput } from '../../domain/changeset';
import { currentWeek } from '../../domain/plan';
import { buildPlatformOrg } from '../../data/platformOrg';
import { requestOf } from './checkRun';
import { inputOf } from './workerInput';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;

describe('the worker’s input', () => {
  it('survives being copied between threads, and checks to the same change set', () => {
    const goals = Array.from({ length: 600 }, (_, i) => ({ __row: String(i + 2), goal: `Worker goal ${i}`, owner: s.people[0]!.name, type: 'metric', unit: '%', start: '10', target: '90' }));
    const input: ChangeInput = { tables: { goals }, snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.admin)!, now: today.toISOString(), newId: (p) => `${p}_${Math.random().toString(36).slice(2)}`, via: 'spreadsheet', full: s };
    const copied = structuredClone(requestOf(input));
    const there = planChanges(inputOf(copied));
    const here = planChanges(input);
    expect(there.counts).toEqual(here.counts);
    expect(there.groups).toEqual(here.groups);
    expect(() => structuredClone(there)).not.toThrow();
  });
});
