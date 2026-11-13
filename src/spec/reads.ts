/* What each action and each summary reads (KT gap 9; ports-at-scale.md, "which records each action and rule actually
   reads isn't listed anywhere"). Worked out by running them, not by reading the code: every list in the workspace is
   wrapped so that each field a rule reads off a record is noted. A record whose only fields read are keys (`id`, or a
   field ending in `Id` or `Ids`) was only looked past, as a database index would; a record with any other field read
   was used, and is what the server has to fetch. So each list gets: how many records were used, how many it holds, and
   the keys the rest were looked past by. Used for spec/rebuild/reads.md (src/spec/readsPage.ts). No database, screens
   or network. */
import type { Snapshot } from '../domain/types';

/** A key: what an index answers without fetching the record. */
export const isKey = (field: string) => field === 'id' || /Ids?$/.test(field);

/** Fields read off each record, per list: list → record id → fields. */
export type ReadLog = Map<string, Map<string, Set<string>>>;

/** What a run did with one list. */
export interface ListReads {
  list: string;
  /** Records with a field other than a key read. */
  used: number;
  /** Records in the list. */
  total: number;
  /** The keys the records not used were looked past by. */
  by: string[];
  /** The ids of the records used. */
  ids: string[];
}

interface Tracker { log: ReadLog; wrap<T extends object>(rec: T, list: string): T }

function tracker(): Tracker {
  const log: ReadLog = new Map();
  const cache = new WeakMap<object, object>();
  const note = (list: string, id: string, field: string) => {
    let l = log.get(list);
    if (!l) log.set(list, (l = new Map()));
    let f = l.get(id);
    if (!f) l.set(id, (f = new Set()));
    f.add(field);
  };
  function wrap<T extends object>(rec: T, list: string): T {
    const hit = cache.get(rec);
    if (hit) return hit as T;
    const id = String((rec as { id?: unknown }).id ?? '?');
    const p = new Proxy(rec, {
      get(t, key, r) {
        if (typeof key === 'string' && key !== 'toJSON') note(list, id, key);
        return Reflect.get(t, key, r);
      },
      ownKeys(t) { note(list, id, '*'); return Reflect.ownKeys(t); },
    });
    cache.set(rec, p);
    return p;
  }
  return { log, wrap };
}

/** A list whose records note every field read off them. */
function trackList<T extends object>(rows: T[], list: string, t: Tracker): T[] {
  return new Proxy(rows, {
    get(target, key, r) {
      const v = Reflect.get(target, key, r);
      return typeof key === 'string' && /^\d+$/.test(key) && v && typeof v === 'object' ? t.wrap(v as object, list) : v;
    },
  });
}

/** Every list in a snapshot, tracked; the rest as it is. Module lists are named `modules.<module>.<kind>`. */
function trackSnapshot(s: Snapshot, t: Tracker, lists: Map<string, unknown[]>): Snapshot {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (Array.isArray(v) && k !== 'cycles') { out[k] = trackList(v as object[], k, t); lists.set(k, v); }
    else out[k] = v;
  }
  if (s.modules) {
    out.modules = Object.fromEntries(Object.entries(s.modules).map(([m, kinds]) => [m, Object.fromEntries(Object.entries(kinds).map(([k, rows]) => {
      if (!Array.isArray(rows)) return [k, rows];
      lists.set(`modules.${m}.${k}`, rows);
      return [k, trackList(rows as object[], `modules.${m}.${k}`, t)];
    }))]));
  }
  return out as unknown as Snapshot;
}

/**
 * Runs `fn` on tracked copies of `snapshot` (this cycle's records) and `full` (every cycle's), and gives back what it
 * read from each list. A record read through either counts once, under its list's name. `fn` may throw: what it read
 * before it did still counts.
 */
export function readsOf(snapshot: Snapshot, full: Snapshot | null, fn: (s: Snapshot, full: Snapshot | null) => unknown): { reads: ListReads[]; error: unknown } {
  const t = tracker();
  const lists = new Map<string, unknown[]>();
  const fullLists = new Map<string, unknown[]>();
  const s = trackSnapshot(snapshot, t, lists);
  const f = full ? trackSnapshot(full, t, fullLists) : null;
  let error: unknown = null;
  try { fn(s, f); } catch (e) { error = e; }
  // The size of a list: the larger of this cycle's and every cycle's, as a record read through either counts once.
  const total = (k: string) => Math.max(lists.get(k)?.length ?? 0, fullLists.get(k)?.length ?? 0);
  const reads: ListReads[] = [];
  for (const [list, recs] of [...t.log].sort(([a], [b]) => a.localeCompare(b))) {
    const used = [...recs].filter(([, fields]) => [...fields].some((f) => !isKey(f)));
    const passed = [...recs].filter(([, fields]) => ![...fields].some((f) => !isKey(f)));
    const by = [...new Set(passed.flatMap(([, fields]) => [...fields]))].sort();
    reads.push({ list, used: used.length, total: total(list), by, ids: used.map(([id]) => id).sort() });
  }
  return { reads, error };
}

/** Whether a run used every record of a list that has more than one: the reads a server can't narrow. */
export const wholeList = (r: ListReads) => r.total > 1 && r.used === r.total;
