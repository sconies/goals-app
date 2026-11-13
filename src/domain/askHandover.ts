/* Asks follow a goal's owner (Lane, 13 Nov; build review of #310): when a goal changes owner, the open asks waiting on
   the old owner about it go to the new owner, who sees them on Home as "Asked of {old owner}, now yours", and the change
   is logged on each ask, where whoever asked sees it. Answered, done and withdrawn asks stay as they were, and so does
   an ask the old owner must still answer about another goal they keep. One rule, used by goal edit (domain/goalEntry)
   and by the change engine (domain/changeset: Import, Data's tables, bulk edit and MCP). Pure. */
import type { Ask, Change, Diff, Goal, Id, Person } from './types';

export interface AskHandover {
  /** The asks as they are now: each one's `recipientId` is the goal's new owner. */
  requests: Ask[];
  /** One change on each ask, "Asked of" from the old owner to the new. */
  changes: Change[];
  /** For each goal whose owner changed, how many of its open asks moved. */
  moved: Map<Id, number>;
}

/** The open asks that move when `after` replaces the goals of the same id in `s` (its goals, people and every ask, `asksOf`). */
export function asksFollowOwner(
  s: { goals: readonly Goal[]; people: readonly Pick<Person, 'id' | 'name'>[]; asks: readonly Ask[] },
  after: readonly Goal[],
  x: { actorId: Id; now: string; newId: (prefix: string) => string },
): AskHandover {
  const before = new Map(s.goals.map((g) => [g.id, g]));
  const changed = after.filter((g) => { const b = before.get(g.id); return !!b && b.ownerId !== g.ownerId; });
  const out: AskHandover = { requests: [], changes: [], moved: new Map() };
  if (!changed.length) return out;
  const owner = new Map(s.goals.map((g) => [g.id, g.ownerId]));
  for (const g of after) owner.set(g.id, g.ownerId);
  const name = (id: Id | null) => s.people.find((p) => p.id === id)?.name ?? 'Someone';
  for (const r of s.asks) {
    if (r.status !== 'open' || !r.recipientId) continue;
    const g = changed.find((c) => r.goalIds.includes(c.id) && before.get(c.id)!.ownerId === r.recipientId);
    // Asked of the old owner about this goal, and they own none of the ask's goals now.
    if (!g || r.goalIds.some((id) => owner.get(id) === r.recipientId)) continue;
    const from = r.recipientId;
    out.requests.push({ ...r, recipientId: g.ownerId, updatedAt: x.now });
    out.moved.set(g.id, (out.moved.get(g.id) ?? 0) + 1);
    out.changes.push({
      id: x.newId('chg'), at: x.now, actorId: x.actorId, goalId: g.id, entity: 'request', entityId: r.id, action: 'edited',
      summary: `${name(r.askedBy)}’s ask now goes to ${name(g.ownerId)}, who owns ${g.title} now`,
      diffs: [{ field: 'Asked of', from: name(from), to: name(g.ownerId) }],
    });
  }
  return out;
}

/** On the goal's own change: "Open asks (2): Tunde Bakare → Sam Patel". */
export const openAsksDiff = (n: number, moved: Change): Diff => ({ field: `Open asks (${n})`, from: moved.diffs[0]!.from, to: moved.diffs[0]!.to });

/** Who an open ask was asked of before it came to its person with a goal's ownership, if it did: the latest such change. */
export function handedFrom(askId: Id, recipientName: string, changes: readonly Change[]): string | null {
  let last: Change | null = null;
  for (const c of changes) if (c.entity === 'request' && c.entityId === askId && c.diffs.some((v) => v.field === 'Asked of') && (!last || c.at >= last.at)) last = c;
  const d = last?.diffs.find((v) => v.field === 'Asked of');
  return d && d.to === recipientName ? d.from : null;
}
