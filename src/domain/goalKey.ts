/* Readable goal keys: G-1, G-2 … per workspace, given in the order goals are created and never used twice. A key is
   permanent: editing a goal never changes it, and a goal carried into the next cycle keeps its key there, so "G-12"
   names the same goal from year to year. Within one cycle no two goals share a key. Anywhere a goal's ID is accepted
   (links, imports, the bulk-change engine, the AI assistant's tools) its key is accepted too. */
import type { Goal } from './types';

export const KEY_PREFIX = 'G-';

/** "G-12" → 12; anything else → null. Lower case and a missing dash are forgiven ("g12"). */
export function keyNumber(ref: string | null | undefined): number | null {
  const m = /^\s*g-?(\d{1,9})\s*$/i.exec(ref ?? '');
  return m ? Number(m[1]) : null;
}
export const formatKey = (n: number) => `${KEY_PREFIX}${n}`;
/** Does this look like a goal key rather than an ID? */
export const isKey = (ref: string | null | undefined) => keyNumber(ref) != null;
/** "g12" → "G-12"; not a key → null. */
export const normalKey = (ref: string | null | undefined) => { const n = keyNumber(ref); return n == null ? null : formatKey(n); };

/** The highest key number among these goals (0 when none has one). */
export function lastKey(goals: readonly Goal[], floor = 0): number {
  let max = floor;
  for (const g of goals) { const n = keyNumber(g.key); if (n != null && n > max) max = n; }
  return max;
}

/** A goal by its ID, or else by its key. The goals are one cycle's, so a key names one goal. */
export function findGoal<G extends Goal>(goals: readonly G[], ref: string | null | undefined): G | undefined {
  if (!ref) return undefined;
  const byId = goals.find((g) => g.id === ref);
  if (byId) return byId;
  const k = normalKey(ref);
  return k ? goals.find((g) => g.key === k) : undefined;
}

/** The oldest first, as the goals were created; ties keep the order they're listed in. */
const creationOrder = (goals: readonly Goal[]) => goals.map((g, i) => ({ g, i })).sort((a, b) => (a.g.createdAt || '').localeCompare(b.g.createdAt || '') || a.i - b.i).map((x) => x.g);

/**
 * Every goal with a key: goals that have one keep it; the rest get the next numbers, oldest first. Stable, so data from
 * before keys existed gets the same keys every time it's read. A goal carried into a later cycle with no key takes
 * the key of the goal it continues when there is one (same title, the cycle before).
 */
export function withKeys(goals: Goal[], floor = 0): Goal[] {
  if (goals.every((g) => g.key)) return goals;
  let next = lastKey(goals, floor);
  // Every goal's key so far, and the keys each cycle already uses.
  const keyOf = new Map(goals.filter((g) => g.key).map((g) => [g.id, g.key!]));
  const taken = new Set(goals.filter((g) => g.key).map((g) => g.cycleId + ':' + g.key));
  const ordered = creationOrder(goals);
  for (const g of ordered) {
    if (keyOf.has(g.id)) continue;
    // The same goal in another cycle (carried on before keys existed): keep its key.
    const same = ordered.find((x) => x.cycleId !== g.cycleId && x.title === g.title && keyOf.has(x.id) && !taken.has(g.cycleId + ':' + keyOf.get(x.id)));
    const key = same ? keyOf.get(same.id)! : formatKey(++next);
    keyOf.set(g.id, key);
    taken.add(g.cycleId + ':' + key);
  }
  return goals.map((g) => (g.key ? g : { ...g, key: keyOf.get(g.id)! }));
}

/**
 * Goals about to be saved, settled against what's stored: a goal already stored keeps its stored key (keys never
 * change); a new goal keeps the key it came with unless another goal in its cycle already has it, or it has none, and
 * then takes the next number. Run by every store on save, so two people adding goals at once can't share a key.
 */
export function settleKeys(stored: readonly Goal[], incoming: Goal[]): Goal[] {
  let next = lastKey(stored);
  const byId = new Map(stored.map((g) => [g.id, g]));
  const taken = new Set(stored.filter((g) => g.key).map((g) => g.cycleId + ':' + g.key));
  // In order, so the first goal to claim a free key keeps it.
  const out: Goal[] = [];
  // The highest key a new goal brings counts too, so a goal that has to move lands after it.
  const brought = lastKey(incoming.filter((g) => !byId.get(g.id)?.key));
  for (const g of incoming) {
    const old = byId.get(g.id);
    if (old?.key) { out.push(g.key === old.key ? g : { ...g, key: old.key }); continue; }
    const k = normalKey(g.key);
    const free = k && !taken.has(g.cycleId + ':' + k);
    const key = free ? k! : formatKey(Math.max(next, brought) + 1);
    next = Math.max(next, keyNumber(key)!);
    taken.add(g.cycleId + ':' + key);
    out.push(g.key === key ? g : { ...g, key });
  }
  return out;
}

/** The key the next new goal gets: one more than any key given in the workspace (in any cycle), so none is used twice. */
export function nextKey(goals: readonly Goal[], issued = 0): string {
  return formatKey(lastKey(goals, issued) + 1);
}
