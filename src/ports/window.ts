/* The narrower load's selection rules (AX5 part 2), in one place: which check-ins and change-log entries a windowed
   load keeps (ports/store LoadWindow), and how Store.history pages through older entries. The browser store runs these
   functions as they are; the Supabase and plain-Postgres stores (src/adapters/) put the same rules in their queries,
   built from the constants here where they can be, and point back to this file. Change a rule here and there together;
   the store contract (src/ports/contracts/store.ts) checks all three agree. */
import { cycleDates } from '../domain/cycle';
import type { Change, CheckIn, Cycle, Goal, Snapshot } from '../domain/types';
import type { HistoryAsk, HistoryPage, LoadWindow } from './store';

/** Entries of these kinds are anchors: kept at any age, because rules read them whatever their age (comments, asks, a
    cycle's "created" entry). */
export const ANCHOR_ENTITIES = ['note', 'request', 'cycle'] as const satisfies readonly Change['entity'][];
/** Import and bulk-edit summaries (and their undoing) are anchors too: past imports and "Undo this import" read them. */
export const ANCHOR_ACTIONS = ['imported', 'undone'] as const satisfies readonly Change['action'][];

/** An entry a windowed load keeps whatever its age: a note, an ask, a cycle's entry, or an import's summary (action
    imported or undone, or carrying what the import replaced). */
export const isAnchor = (c: Change): boolean =>
  (ANCHOR_ENTITIES as readonly string[]).includes(c.entity) || (ANCHOR_ACTIONS as readonly string[]).includes(c.action) || c.undo != null;

/** The day (yyyy-mm-dd, UTC) a window starts on. */
export const windowDay = (w: LoadWindow) => new Date(w.from).toISOString().slice(0, 10);

/** A cycle overlaps the window when its last day (domain/cycle cycleDates) is on or after the window's first day.
    In SQL: start_date + ((weeks + 1) * 7 - 1) >= the window's day. */
export const overlaps = (c: Pick<Cycle, 'startDate' | 'weeks'>, w: LoadWindow) => cycleDates(c).lastDay >= windowDay(w);

/** An entry a windowed load keeps: one from `from` on, or an anchor. */
export const keepsChange = (c: Change, w: LoadWindow) => Date.parse(c.at) >= Date.parse(w.from) || isAnchor(c);

/** Every cycle with any check-in (removed ones too), sorted: the snapshot's `history.checkInCycles`. */
export function checkInCycles(goals: Pick<Goal, 'id' | 'cycleId'>[], checkIns: Pick<CheckIn, 'goalId'>[]): string[] {
  const cycleOf = new Map(goals.map((g) => [g.id, g.cycleId]));
  return [...new Set(checkIns.flatMap((c) => { const id = cycleOf.get(c.goalId); return id ? [id] : []; }))].sort();
}

/** A whole workspace narrowed to a window, as every store's windowed load gives it. */
export function windowed(s: Snapshot, w: LoadWindow): Snapshot {
  const open = new Set(s.cycles.filter((c) => overlaps(c, w)).map((c) => c.id));
  const kept = new Set(s.goals.filter((g) => open.has(g.cycleId)).map((g) => g.id));
  return {
    ...s,
    checkIns: s.checkIns.filter((c) => kept.has(c.goalId)),
    changes: s.changes.filter((c) => keepsChange(c, w)),
    history: { from: w.from, checkInCycles: checkInCycles(s.goals, s.checkIns) },
  };
}

/** A page of history is 50 entries unless asked otherwise, and never more than 100. */
export const HISTORY_SIZE = 50;
export const HISTORY_MAX = 100;
export const historySize = (ask: HistoryAsk) => Math.max(1, Math.min(HISTORY_MAX, Math.floor(ask.size ?? HISTORY_SIZE)));

/** Newest first: by time, then by id, both descending. In SQL: order by at desc, id desc. */
export const newestFirst = (a: Pick<Change, 'at' | 'id'>, b: Pick<Change, 'at' | 'id'>) =>
  Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** One page of history from a whole change log: entries strictly older than `before` (in SQL, the keyset
    (at, id) < (before.at, before.id)), narrowed to a goal when asked, newest first, and where the next page starts. */
export function historyPage(changes: Change[], ask: HistoryAsk): HistoryPage {
  const size = historySize(ask);
  const b = ask.before ?? null;
  const older = changes
    .filter((c) => (ask.goalId ? c.goalId === ask.goalId : true) && (!b || newestFirst(b, c) < 0))
    .sort(newestFirst);
  const page = older.slice(0, size);
  const last = page.at(-1);
  return { changes: page, next: older.length > size && last ? { at: last.at, id: last.id } : null };
}
