import { askChange, isUpdateAsk, liveNotes, openUpdateAsk, undoAskChange, updateAskText } from './updateAsks';
import type { Change } from './types';

const ask = askChange('env', updateAskText('Jonas', 40), 'elena', '2026-11-02T10:00:00Z', { change: 'c1', note: 'n1' });
const comment: Change = { id: 'c2', at: '2026-11-02T11:00:00Z', actorId: 'sam', goalId: 'env', entity: 'note', entityId: 'n2', action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: 'Looks good' }] };

describe('asking for an update', () => {
  it('is open until the owner checks in, or until it is undone', () => {
    expect(updateAskText('Jonas', 40)).toBe('Jonas, could you post an update? The last check-in was week 40.');
    expect(openUpdateAsk('env', { changes: [ask, comment] }, '2026-10-30T09:00:00Z')?.id).toBe('c1');
    expect(openUpdateAsk('env', { changes: [ask] }, '2026-11-03T09:00:00Z')).toBeNull();
    const undo = undoAskChange(ask, 'elena', '2026-11-02T10:05:00Z', 'c3');
    expect(undo).toMatchObject({ entity: 'note', entityId: 'n1', action: 'withdrawn' });
    expect(openUpdateAsk('env', { changes: [ask, undo] }, null)).toBeNull();
  });
  it('an undone ask leaves the comments people see, but stays in the log', () => {
    const undo = undoAskChange(ask, 'elena', '2026-11-02T10:05:00Z', 'c3');
    expect(liveNotes([ask, comment, undo]).map((c) => c.id)).toEqual(['c2']);
    expect(isUpdateAsk(ask)).toBe(true);
    expect(isUpdateAsk(comment)).toBe(false);
    // An ask made before asks had their own summary is still recognised by its words.
    expect(isUpdateAsk({ ...ask, summary: 'Commented' })).toBe(true);
  });
});
