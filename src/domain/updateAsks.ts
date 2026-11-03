/* Asking a goal's owner for an update (Senior UX review, finding 9). The ask is a comment on the goal, so the owner
   sees it on Home; it stays shown as "Asked … ago" until their next check-in, and whoever asked can undo it. Undoing
   is logged, never deleted: the comment is marked withdrawn and drops off the owner's Home. These are the only rules
   for update asks: the goal page, Home and the review use them. */
import type { Change, Snapshot } from './types';

export const UPDATE_ASK = 'Asked for an update';

/** Comments marked withdrawn, by the comment's id. */
export const withdrawnNotes = (changes: Change[]) => new Set(changes.filter((c) => c.entity === 'note' && c.action === 'withdrawn').map((c) => c.entityId));

/** Comments still standing: written, and not withdrawn since. */
export function liveNotes(changes: Change[]): Change[] {
  const gone = withdrawnNotes(changes);
  return changes.filter((c) => c.entity === 'note' && c.action === 'noted' && !gone.has(c.entityId));
}

/** A comment that asks for an update (older ones are recognised by their words). */
export const isUpdateAsk = (c: Change) => c.entity === 'note' && c.action === 'noted' && (c.summary === UPDATE_ASK || (c.diffs[0]?.to ?? '').includes('could you post an update'));

/** The open ask for an update on a goal: the latest one since its last check-in that hasn't been undone. */
export function openUpdateAsk(goalId: string, s: Pick<Snapshot, 'changes'>, lastCheckInAt: string | null): Change | null {
  return liveNotes(s.changes).filter((c) => c.goalId === goalId && isUpdateAsk(c) && (!lastCheckInAt || c.at > lastCheckInAt)).pop() ?? null;
}

/** The words of an ask for an update. */
export const updateAskText = (ownerFirstName: string | undefined, lastWeek: number | null) =>
  `${ownerFirstName ?? 'Hi'}, could you post an update? ${lastWeek != null ? `The last check-in was week ${lastWeek}.` : 'There’s no check-in yet.'}`;

/** The log entries for asking, and for undoing an ask. */
export function askChange(goalId: string, text: string, actorId: string, at: string, ids: { change: string; note: string }): Change {
  return { id: ids.change, at, actorId, goalId, entity: 'note', entityId: ids.note, action: 'noted', summary: UPDATE_ASK, diffs: [{ field: 'Comment', from: '—', to: text }] };
}
export function undoAskChange(ask: Change, actorId: string, at: string, id: string): Change {
  return { id, at, actorId, goalId: ask.goalId, entity: 'note', entityId: ask.entityId, action: 'withdrawn', summary: 'Withdrew the request for an update', diffs: [{ field: 'Comment', from: ask.diffs[0]?.to ?? '', to: 'Withdrawn' }] };
}
