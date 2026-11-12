/* A file too large to save in one go, in parts (import spec 2.8; backlog IM6): "Download as {k} files of 5,000 rows".
   Each part is imported on its own, with its own Undo, so the split keeps together what one row needs from another:
   a goal's Plan and Check-ins rows go with its Goals row, people come first (a goal can name its owner from the same
   file), and a goal goes in the same part as the goal it feeds into or a later one, never an earlier one. A goal with
   more rows than a part holds is a part of its own. Plain TypeScript: no browser code. */
import { normalKey } from './goalKey';
import { fold } from './problemLevels';
import type { Rec, Tables } from './sheets';

const val = (r: Rec, k: string) => (r[k] ?? '').trim();
const blank = (r: Rec) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());

type Unit = { goals: Rec[]; plan: Rec[]; checkIns: Rec[]; people: Rec[] };
const size = (u: Unit) => u.goals.length + u.plan.length + u.checkIns.length + u.people.length;
const empty = (): Unit => ({ goals: [], plan: [], checkIns: [], people: [] });

/** The refs a goal row is known by: its key, its ID and its folded name. */
const refsOf = (r: Rec): string[] => [normalKey(val(r, 'key')) && `k:${normalKey(val(r, 'key'))}`, val(r, 'id') && `i:${val(r, 'id')}`, val(r, 'goal') && `t:${fold(val(r, 'goal'))}`].filter((x): x is string => !!x);

/** The one ref a row uses to name its goal: by key, then ID, then name (the engine's order). */
function goalRef(key: string, id: string, title: string): string | null {
  const k = normalKey(key);
  if (k) return `k:${k}`;
  if (id) return `i:${id}`;
  if (title) return `t:${fold(title)}`;
  return null;
}

/**
 * The file's rows in parts of at most `max` rows each (one goal's rows are never split): people first, then each goal
 * with its plan and check-ins, parents before the goals that feed into them, then rows for goals the file doesn't
 * add. Blank rows are dropped. One part when the file fits.
 */
export function splitTables(t: Tables, max: number): Tables[] {
  const units: Unit[] = [];
  for (const r of t.people ?? []) if (!blank(r)) units.push({ ...empty(), people: [r] });

  // Goals, in the file's order, then parents before children.
  const goalUnits: { u: Unit; parent: string | null; refs: string[] }[] = [];
  const byRef = new Map<string, Unit>();
  for (const r of t.goals ?? []) {
    if (blank(r)) continue;
    const u = { ...empty(), goals: [r] };
    const refs = refsOf(r);
    for (const ref of refs) if (!byRef.has(ref)) byRef.set(ref, u);
    goalUnits.push({ u, parent: goalRef(val(r, 'feeds into key'), val(r, 'feeds into id'), val(r, 'feeds into')), refs });
  }
  // Rows for goals not in this file, gathered by the goal they name (in the order they first appear).
  const others = new Map<string, Unit>();
  const home = (ref: string | null): Unit => {
    const known = ref ? byRef.get(ref) : undefined;
    if (known) return known;
    const k = ref ?? '';
    let u = others.get(k);
    if (!u) { u = empty(); others.set(k, u); }
    return u;
  };
  for (const r of t.plan ?? []) if (!blank(r)) home(goalRef(val(r, 'key'), val(r, 'id'), val(r, 'goal'))).plan.push(r);
  for (const r of t.checkIns ?? []) if (!blank(r)) home(goalRef(val(r, 'goal key'), val(r, 'goal id'), val(r, 'goal'))).checkIns.push(r);

  // Depth-first: a goal's parent (when the file adds it) is placed before it; a loop is broken where it closes.
  const placed = new Set<Unit>();
  const visiting = new Set<Unit>();
  const parentOf = new Map(goalUnits.map((g) => [g.u, g.parent]));
  const place = (u: Unit) => {
    if (placed.has(u) || visiting.has(u)) return;
    visiting.add(u);
    const p = parentOf.get(u);
    const pu = p ? byRef.get(p) : undefined;
    if (pu && pu !== u) place(pu);
    visiting.delete(u);
    placed.add(u);
    units.push(u);
  };
  for (const g of goalUnits) place(g.u);
  units.push(...others.values());

  // Packed in order, a part at a time.
  const parts: Unit[] = [];
  let cur = empty();
  for (const u of units) {
    if (size(cur) && size(cur) + size(u) > max) { parts.push(cur); cur = empty(); }
    cur.goals.push(...u.goals); cur.plan.push(...u.plan); cur.checkIns.push(...u.checkIns); cur.people.push(...u.people);
  }
  if (size(cur) || !parts.length) parts.push(cur);
  return parts.map((u) => ({
    ...(t.goals ? { goals: u.goals } : {}),
    ...(t.plan ? { plan: u.plan } : {}),
    ...(t.checkIns ? { checkIns: u.checkIns } : {}),
    ...(t.people ? { people: u.people } : {}),
  }));
}

/** A part's file name (spec 2.8): "{original}-part-{i}-of-{k}". */
export const partName = (base: string, i: number, k: number) => `${base}-part-${i}-of-${k}`;
