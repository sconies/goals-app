// @vitest-environment node
/* What each action and summary reads (KT gap 9, spec/rebuild/reads.md): every action has a sample to run, the tracker
   tells a record used from one looked past, and every goal's summary row is the same from its own records as from the
   whole workspace, so a server can work it out from them. */
import { actionNames, loadEngine } from '../app/actions';
import { readsOf } from './reads';
import { actionReads, sliceProof } from './readsRun';
import { SAMPLES } from './readsSamples';
import type { Snapshot } from '../domain/types';

describe('what each action and summary reads', () => {
  it('has a sample for every action, and none for an action that has gone', async () => {
    await loadEngine();
    expect(Object.keys(SAMPLES).sort()).toEqual(actionNames().sort());
  });

  it('counts a record used when a field other than a key is read, and looked past when only keys are', () => {
    const s = { goals: [{ id: 'a', ownerId: 'p', title: 'A' }, { id: 'b', ownerId: 'q', title: 'B' }], people: [] } as unknown as Snapshot;
    const { reads } = readsOf(s, null, (t) => t.goals.find((g) => g.ownerId === 'q')!.title);
    expect(reads).toEqual([{ list: 'goals', used: 1, total: 2, by: ['ownerId'], ids: ['b'] }]);
  });

  it('works out every goal’s summary row the same from its own records as from the whole workspace', () => {
    const differ = sliceProof().filter((p) => !p.same).map((p) => p.goalId);
    expect(differ).toEqual([]);
  }, 60_000);

  it('runs every action’s sample and notes what it read', async () => {
    const all = await actionReads();
    expect(all.map((a) => a.action).sort()).toEqual(actionNames().sort());
    // Most run to the end on the demo; the rest are refused by its date or records, with their words on the page.
    expect(all.filter((a) => a.outcome !== 'refused').length).toBeGreaterThan(all.length * 0.75);
  }, 60_000);
});
