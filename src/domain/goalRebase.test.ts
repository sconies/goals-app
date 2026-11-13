/* A goal form open while someone else saves the goal (AX6 review, finding 4): "check it and try again" keeps only what
   the person changed, on the goal as it is now, so saving again doesn't put back the other person's change. */
import { draftFor, rebaseDraft } from './goal';
import { contractWorkspace } from '../ports/contracts/store';

describe('rebaseDraft', () => {
  const g = contractWorkspace('rb').goals.find((x) => x.kind === 'metric')!;

  it('keeps the person’s fields and takes the latest for the rest', () => {
    const base = draftFor(g);
    const mine = { ...base, title: 'My title', reason: 'why' };
    const latest = draftFor({ ...g, ownerId: 'someone-else', definition: 'Their definition' });
    const out = rebaseDraft(mine, base, latest);
    expect(out.title).toBe('My title');
    expect(out.ownerId).toBe('someone-else');
    expect(out.definition).toBe('Their definition');
    expect(out.reason).toBe('why');
  });

  it('keeps the person’s value where both changed the same field', () => {
    const base = draftFor(g);
    const out = rebaseDraft({ ...base, title: 'Mine' }, base, draftFor({ ...g, title: 'Theirs' }));
    expect(out.title).toBe('Mine');
  });

  it('gives the latest goal’s draft when the person changed nothing', () => {
    const base = draftFor(g);
    const latest = draftFor({ ...g, title: 'Theirs', plan: { ...(g as Extract<typeof g, { kind: 'metric' }>).plan, target: 999 } });
    expect(rebaseDraft(base, base, latest)).toEqual(latest);
  });
});
