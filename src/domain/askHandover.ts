/* Asks follow a goal's owner (Lane, 13 Nov; build review of #310): when a goal changes owner, the open asks put to its
   owner by role (an update asked for, a question) go to the new owner, who sees them on Home as "Asked of {old owner},
   now yours", and the change is logged on each ask, where whoever asked sees it. An ask put to a person by name (a next
   step, a decision or help) stays with that person; one the new owner asked closes (withdrawn), since nobody answers
   their own ask (Lane, 13 Nov; review of #369, medium 3). Answered, done and withdrawn asks stay as they were, and so does an ask the
   old owner must still answer about another goal they keep. One rule, used by goal edit (domain/goalEntry) and by the
   change engine (domain/changeset: Import, Data's tables, bulk edit and MCP), proposed goals included. Pure. */
import type { Ask, Change, Diff, Goal, Id, Person } from './types';

export interface AskHandover {
  /** The asks as they are now: moved (`recipientId` is the goal's new owner) or closed (withdrawn: the new owner asked it). */
  requests: Ask[];
  /** One change on each ask: "Asked of" from the old owner to the new, or to "—" when it closed. */
  changes: Change[];
  /** For each goal whose owner changed, how many of its open asks moved or closed. */
  moved: Map<Id, number>;
}

/** The kinds put to a goal's owner by role, which follow the goal (Lane, 13 Nov): the rest are asked of a person by name. */
export const FOLLOWS_OWNER: readonly Ask['kind'][] = ['update', 'question'];

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
    if (r.status !== 'open' || !r.recipientId || !FOLLOWS_OWNER.includes(r.kind)) continue;
    const g = changed.find((c) => r.goalIds.includes(c.id) && before.get(c.id)!.ownerId === r.recipientId);
    // Asked of the old owner about this goal, and they own none of the ask's goals now.
    if (!g || r.goalIds.some((id) => owner.get(id) === r.recipientId)) continue;
    const from = r.recipientId;
    out.moved.set(g.id, (out.moved.get(g.id) ?? 0) + 1);
    const base = { id: x.newId('chg'), at: x.now, actorId: x.actorId, goalId: g.id, entity: 'request' as const, entityId: r.id, action: 'edited' as const };
    // History reads "{actor} moved …": each summary starts with a verb (review of #369, medium 7).
    if (r.askedBy === g.ownerId) {
      out.requests.push({ ...r, status: 'withdrawn', updatedAt: x.now });
      out.changes.push({ ...base, summary: `Closed ${name(r.askedBy)}’s ask, since ${name(g.ownerId)} owns ${g.title} now`, diffs: [{ field: 'Asked of', from: name(from), to: '—' }] });
      continue;
    }
    out.requests.push({ ...r, recipientId: g.ownerId, updatedAt: x.now });
    out.changes.push({ ...base, summary: `Moved ${name(r.askedBy)}’s ask to ${name(g.ownerId)}, who owns ${g.title} now`, diffs: [{ field: 'Asked of', from: name(from), to: name(g.ownerId) }] });
  }
  return out;
}

/** On the goal's own change: "Open asks (2): Tunde Bakare → Sam Patel" (an ask the new owner asked closes: "→ —"). */
export const openAsksDiff = (n: number, moved: Change): Diff => {
  const d = moved.diffs.find((v) => v.field === 'Asked of')!;
  return { field: `Open asks (${n})`, from: d.from, to: d.to };
};

/** Who an open ask was asked of before it came to its person with a goal's ownership, if it did: the latest such change. */
export function handedFrom(askId: Id, recipientName: string, changes: readonly Change[]): string | null {
  let last: Change | null = null;
  for (const c of changes) if (c.entity === 'request' && c.entityId === askId && c.diffs.some((v) => v.field === 'Asked of') && (!last || c.at >= last.at)) last = c;
  const d = last?.diffs.find((v) => v.field === 'Asked of');
  return d && d.to === recipientName ? d.from : null;
}
