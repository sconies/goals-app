/* The records extension point (AS part 2; docs/design/architecture.md 1.3): a feature module brings records of its own,
   kept, saved, scoped, removed and restored by the core without the core knowing what they are.

   The core's own records (people, teams, cycles, goals, check-ins and the rest of types.ts) are closed: a module never
   adds a field or a table to them. A module declares its records instead, in its module.json (`records`: name, table,
   key, removable) and in its records.ts, which default-exports a `ModuleRecords`: for each record, the row mappers each
   way, what a new cycle carries over, what happens when a goal or person a row points to is removed, and how a removed
   row is named and restored; and, if it keeps that, what measures a goal (`measures`, read by goal entry's questions).
   The workspace as loaded, and a commit, hold every module's rows under `modules`:

     modules: { [moduleId]: { [key]: rows } }

   Store, both database adapters, the browser store, removal, restore, cycle scoping and export iterate over what the
   modules declare. A module left out of a build declares nothing, so its rows are neither read nor written, and none
   are deleted: the workspace keeps them for when it comes back.

   Plain TypeScript, like the rest of src/domain: no database, screen or network code. */
import type { Commit } from './commit';
import type { ActionContext } from './actions';
import type { Cell, Ctx, ExportInput, SheetSpec } from './columns';
import type { Cycle, Goal } from './types';

/** Every module's rows, by module id and then by the key its records are filed under. */
export type ModuleRows = { [moduleId: string]: { [key: string]: unknown[] } };

/** What every module record has: an id (the row's key in its table), and when and by whom it was removed, if it can be. */
export interface ModuleRow { id: string; removedAt?: string | null; removedBy?: string | null }

/** A table row: what a database adapter writes and reads. Every row carries the workspace it belongs to. */
export type DbRow = { workspace_id: string; id: string } & Record<string, unknown>;

/** What a new cycle's scope reads when it decides which rows to carry: the goals in it, and the whole workspace's rows. */
export interface CarryScope {
  /** The live goals of the cycle being opened (not stopped, not removed). */
  goalIds: ReadonlySet<string>;
  /** Every module's rows in the whole workspace, unscoped (another record of the same module, say). */
  modules: ModuleRows;
}

/** One kind of record a module keeps. */
export interface RecordDef<T extends ModuleRow = ModuleRow> {
  /** What one row is, in the singular: "metric". On Recently removed this is its kind (restore_removed's `kind`). */
  name: string;
  /** Where its rows are filed: `modules[moduleId][key]`, in the workspace and in a commit. */
  key: string;
  /** The database table it is kept in (listed in module.json `tables`, made by the module's migration). */
  table: string;
  /** Whether a row can be removed and restored (it has removedAt and removedBy). */
  removable: boolean;
  /** A row as its table holds it. */
  toRow(ws: string, r: T): DbRow;
  /** A row read back from its table. */
  fromRow(row: DbRow): T;
  /** The order rows are kept in once loaded (a database returns them by id). Optional: by id. */
  order?(a: T, b: T): number;
  /**
   * What a new cycle carries over: the rows the open cycle shows. Optional: every row not removed. A row pointing to a
   * goal outside the cycle, or a removed one, is left out here and is back when the goal is: removing a goal or a
   * person changes none of a module's rows, unless `onRemoved` says otherwise.
   */
  carry?(rows: T[], scope: CarryScope): T[];
  /** Rows that come with goals copied into the next cycle (cycle-end rule 6): given old goal id → copy id, the new
      rows for the copies. A record without it stays with the old goal only. */
  follow?(rows: T[], copies: ReadonlyMap<string, string>, newId: (prefix: string) => string): T[];
  /** The one goal a row belongs to, for records that belong to a goal: a copy that leaves takes its rows with it. */
  goalOf?(row: T): string | null;
  /** Recently removed (removable records): what a removed row is called there, and how it comes back. */
  removed?: {
    /** How the kind reads on Recently removed: "Metric". */
    label: string;
    /** The row in words: a metric's name. */
    name(r: T): string;
    /** Bring it back: the commit to save, or NotAllowed with the reason. */
    restore(x: ActionContext, r: T): Commit;
  };
}

/** A sheet a module adds to the workbook (domain/export), after the core's and before the README. For reading only. */
export interface ModuleSheet<C = unknown> {
  spec: SheetSpec<C, string>;
  /** The columns that say which record a row is (always written by a table from Data). */
  keys: string[];
  /** Its rows: what the export carries, for the goals it exports. */
  rows(x: ExportInput, c: Ctx, goalIds: ReadonlySet<string>): C[];
}

/**
 * The demo workspace as it is being built (src/data/platformOrg/generate.ts), for a module to add its own rows the way
 * the app would: through its rules, as people in the demo, at moments in the year. Each commit it saves is kept at
 * once (its rows and its change-log entries), so each later rule sees it.
 */
export interface DemoBuild {
  /** Keep a commit's module rows and change-log entries in the demo workspace. */
  save(c: Commit): void;
  /** When the goal year starts (week 0). */
  start: Date;
  /** The rules' context for one of the demo's people acting at a moment, with ids made by `newId`. */
  act(personId: string, at: Date, newId: (prefix: string) => string): ActionContext;
  /** A goal of the demo, by the id its description gives it, and when it was set up. */
  goal(id: string): { goal: Goal; createdAt: string };
}

/** What a module's records.ts default-exports. */
export interface ModuleRecords {
  /** The module's id: set by the registry from its folder. */
  module: string;
  records: RecordDef<any>[];
  /** The workbook's sheets it adds, if any. */
  sheets?: ModuleSheet<any>[];
  /** The columns it adds to Goals' rows, by their address parameter (?metric=): what each goal holds, from the open
      workspace. The app's Goals filter (core/app ModuleFilter) and the AI's find_goals read the same ones. */
  goalColumns?: { param: string; fill: (s: import('./types').Snapshot) => (g: Goal) => string | null }[];
  /** What measures a goal, when the module keeps that (the metric library's link): its name and which way is better, for
      goal entry's wrong-side question (rule 3) at the doors that don't draw the module's own field (a file, the AI tools). */
  measures?(s: { modules?: ModuleRows }, goalId: string): GoalMeasure | null;
  /** Marks a goal's chart and History show for the module (the metric library's “Definition changed, week 46”, MT3's
      `goal.marks`): each a week of the cycle and its label, made in the goal's own cycle: since `since` (its start,
      yyyy-mm-dd) and before `until` (the day after its last week), so a change made next year never marks this year's goals. */
  goalMarks?(s: { modules?: ModuleRows }, goalId: string, since: string, until: string): GoalMark[];
  /** What the core's own records need when the module is switched off or on, in the same save as the switch: the
      metric library lets go of the goals it held to no number, and holds them again (MS). Null when nothing. */
  switched?(x: ActionContext, on: boolean): Pick<Commit, 'goals' | 'changes'> | null;
}

/** A module's mark on a goal's chart: a dashed hairline at a week, its label beside it. The core knows nothing more. */
export interface GoalMark { week: number; label: string }

/** The day after a cycle's last week (yyyy-mm-dd): a goal's marks are made before it. */
export const cycleUntil = (cycle: Pick<Cycle, 'startDate' | 'weeks'>): string => new Date(Date.parse(cycle.startDate + 'T00:00:00Z') + (cycle.weeks + 1) * 7 * 86_400_000).toISOString().slice(0, 10);

/** The most marks a chart draws: the latest, so a metric changed every week doesn't bury the goal's line. */
export const MAX_GOAL_MARKS = 3;

/**
 * Every module's marks for a goal in its own cycle, in week order: two in the same week drawn as one line with both
 * labels (“Definition changed, week 6 · Direction changed, week 6”), and only the latest MAX_GOAL_MARKS weeks.
 */
export function goalMarksOf(records: readonly ModuleRecords[] | undefined, s: { modules?: ModuleRows }, goalId: string, cycle: Pick<Cycle, 'startDate' | 'weeks'>): GoalMark[] {
  const until = cycleUntil(cycle);
  const byWeek = new Map<number, string[]>();
  for (const m of (records ?? []).flatMap((r) => r.goalMarks?.(s, goalId, cycle.startDate, until) ?? [])) {
    const labels = byWeek.get(m.week) ?? [];
    if (!labels.includes(m.label)) labels.push(m.label);
    byWeek.set(m.week, labels);
  }
  return [...byWeek].sort(([a], [b]) => a - b).slice(-MAX_GOAL_MARKS).map(([week, labels]) => ({ week, label: labels.join(' · ') }));
}

/** What measures a goal, for goal entry's questions: a name, and which way is better. */
export interface GoalMeasure { name: string; direction: 'lower' | 'higher' }

/** What measures a goal, from the first module in this build that says: null when none does. */
export function goalMeasureOf(records: readonly ModuleRecords[] | undefined, s: { modules?: ModuleRows }, goalId: string): GoalMeasure | null {
  for (const m of records ?? []) { const got = m.measures?.(s, goalId); if (got) return got; }
  return null;
}

/* ---------- reading and writing a module's rows ---------- */

/** One module's rows of one record, from a workspace or a commit: empty when there are none. */
export function moduleRows<T>(s: { modules?: ModuleRows } | null | undefined, module: string, key: string): T[] {
  return (s?.modules?.[module]?.[key] ?? []) as T[];
}

/** A commit's `modules` part for one module's rows: `{ modules: { [module]: { [key]: rows } } }`, or nothing when empty. */
export function withModuleRows(module: string, rows: { [key: string]: unknown[] | undefined }): Pick<Commit, 'modules'> {
  const kept = Object.fromEntries(Object.entries(rows).filter(([, v]) => v?.length)) as { [key: string]: unknown[] };
  return Object.keys(kept).length ? { modules: { [module]: kept } } : {};
}

/** Whether a set of module rows holds anything at all. */
export const hasModuleRows = (m: ModuleRows | undefined) => !!m && Object.values(m).some((k) => Object.values(k).some((v) => v.length));

/** Rows added to or changed in a list, by id: the later one wins, new ones go at the end. */
function upsert(list: unknown[], items: unknown[]): unknown[] {
  const ids = new Set(items.map((x) => (x as ModuleRow).id));
  return [...list.filter((x) => !ids.has((x as ModuleRow).id)), ...items];
}

/** A commit's module rows applied to the workspace's: every module and key, by id. Modules the commit doesn't name stay as they are. */
export function applyModuleRows(s: ModuleRows | undefined, c: ModuleRows | undefined): ModuleRows | undefined {
  if (!c) return s;
  const out: ModuleRows = { ...(s ?? {}) };
  for (const [mod, keys] of Object.entries(c)) {
    const mine = { ...(out[mod] ?? {}) };
    for (const [key, rows] of Object.entries(keys)) if (rows.length || mine[key]) mine[key] = upsert(mine[key] ?? [], rows);
    out[mod] = mine;
  }
  return out;
}

/** Two commits' module rows together, in order (a goal's save and its link, made in one form). */
export function mergeModuleRows(a: ModuleRows | undefined, b: ModuleRows | undefined): ModuleRows | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: ModuleRows = { ...a };
  for (const [mod, keys] of Object.entries(b)) {
    const mine = { ...(out[mod] ?? {}) };
    for (const [key, rows] of Object.entries(keys)) mine[key] = [...(mine[key] ?? []), ...rows];
    out[mod] = mine;
  }
  return out;
}

/** A record a module declares, by module and key. */
export const recordOf = (records: readonly ModuleRecords[], module: string, key: string) => records.find((m) => m.module === module)?.records.find((r) => r.key === key);

/* ---------- what the core does with them ---------- */

/**
 * What the open cycle keeps of every module's rows (domain/cycle scopeToCycle): each declared record's `carry`, or its
 * rows not removed. Rows of a module this build doesn't have stay exactly as they are: nothing is read into them, and
 * nothing is lost.
 */
export function carryModules(all: ModuleRows, goalIds: ReadonlySet<string>, records: readonly ModuleRecords[]): ModuleRows {
  const out: ModuleRows = {};
  for (const [mod, keys] of Object.entries(all)) {
    out[mod] = {};
    for (const [key, rows] of Object.entries(keys)) {
      const def = recordOf(records, mod, key);
      out[mod][key] = !def ? rows : def.carry ? def.carry(rows as ModuleRow[], { goalIds, modules: all }) : (rows as ModuleRow[]).filter((r) => !r.removedAt);
    }
  }
  return out;
}

/** Every removed module row, for Recently removed: its kind (the record's name), its label and its name in words. */
export function removedModuleRows(full: { modules?: ModuleRows }, records: readonly ModuleRecords[]): { kind: string; label: string; id: string; name: string; by: string | null | undefined; at: string }[] {
  return records.flatMap((m) => m.records.flatMap((def) => {
    if (!def.removable || !def.removed) return [];
    return moduleRows<ModuleRow>(full, m.module, def.key).filter((r) => r.removedAt).map((r) => ({ kind: def.name, label: def.removed!.label, id: r.id, name: def.removed!.name(r), by: r.removedBy, at: r.removedAt! }));
  }));
}

/** A removed module row and how it comes back, by its kind (the record's name) and id. */
export function restorableModuleRow(full: { modules?: ModuleRows }, records: readonly ModuleRecords[], kind: string, id: string): { row: ModuleRow; restore: (x: ActionContext, r: ModuleRow) => Commit } | null {
  for (const m of records) for (const def of m.records) {
    if (def.name !== kind || !def.removed) continue;
    const row = moduleRows<ModuleRow>(full, m.module, def.key).find((r) => r.id === id);
    if (row) return { row, restore: def.removed.restore };
  }
  return null;
}

/**
 * The fields the stores write only when a record has them (data/rows `set`): a removal's (removed, left, stopped with its
 * reason, ended or deleted, and by whom), and a person's email. Missing, the database keeps what it had.
 */
const REMOVAL_FIELD = /^(?:(?:removed|left|stopped|ended|deleted)(?:At|By)|stopReason|email)$/;

/**
 * A row as it was before a removal or an import, to save back on Undo. Every such field set since that the row before
 * didn't have is null, not missing: a store writes only the columns a row carries, so a missing one kept the removal's time and
 * the record was removed again on the next load (build review: Undo on the database stores).
 */
export function asBefore<T extends object>(removed: T, before: T): T {
  const cleared = Object.entries(removed).filter(([k, v]) => REMOVAL_FIELD.test(k) && v != null && (before as Record<string, unknown>)[k] == null);
  return cleared.length ? { ...before, ...Object.fromEntries(cleared.map(([k]) => [k, null])) } : before;
}

/** Undo for module rows (domain/removal undoRemoval): every row a removal changed, as it was just before. */
export function moduleRowsBefore(removal: ModuleRows | undefined, before: { modules?: ModuleRows }): ModuleRows | undefined {
  if (!removal) return undefined;
  const out: ModuleRows = {};
  for (const [mod, keys] of Object.entries(removal)) {
    for (const [key, rows] of Object.entries(keys)) {
      const was = moduleRows<ModuleRow>(before, mod, key);
      const back = (rows as ModuleRow[]).flatMap((r) => { const b = was.find((v) => v.id === r.id); return b ? [asBefore(r, b)] : []; });
      if (back.length) (out[mod] ??= {})[key] = back;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** A module sheet's rows, header first (domain/export). */
export const moduleSheetRows = (sheet: ModuleSheet, x: ExportInput, c: Ctx, goalIds: ReadonlySet<string>): Cell[][] =>
  [sheet.spec.columns.map((col) => col.header), ...sheet.rows(x, c, goalIds).map((it) => sheet.spec.columns.map((col) => col.write(it)))];

/** Where a module's rows are filed, and which of them: what a start added, so Undo can take them back out. */
export interface ModuleRowIds { module: string; key: string; ids: string[] }

/**
 * What comes with goals copied into the next cycle, from every module that says (`follow`): the new rows, and their
 * ids for Undo. Rows of a record that doesn't follow stay with the old goal.
 */
export function followCopies(all: ModuleRows | undefined, copies: ReadonlyMap<string, string>, records: readonly ModuleRecords[], newId: (prefix: string) => string): { modules: ModuleRows; ids: ModuleRowIds[] } {
  const modules: ModuleRows = {};
  const ids: ModuleRowIds[] = [];
  for (const m of records) for (const def of m.records) {
    if (!def.follow) continue;
    const rows = ((all?.[m.module]?.[def.key] ?? []) as ModuleRow[]).filter((r) => !r.removedAt);
    const made = def.follow(rows, copies, newId);
    if (!made.length) continue;
    (modules[m.module] ??= {})[def.key] = made;
    ids.push({ module: m.module, key: def.key, ids: made.map((r) => r.id) });
  }
  return { modules, ids };
}

/** The live rows that belong to these goals (`goalOf`), marked removed: a copy that leaves takes them with it. */
export function rowsLeaving(all: ModuleRows | undefined, goalIds: ReadonlySet<string>, records: readonly ModuleRecords[], gone: { removedAt: string; removedBy: string }): ModuleRows {
  const modules: ModuleRows = {};
  for (const m of records) for (const def of m.records) {
    if (!def.goalOf) continue;
    const rows = ((all?.[m.module]?.[def.key] ?? []) as ModuleRow[]).filter((r) => !r.removedAt && goalIds.has(def.goalOf!(r) ?? ''));
    if (rows.length) (modules[m.module] ??= {})[def.key] = rows.map((r) => ({ ...r, ...gone }));
  }
  return modules;
}

/** The rows a start added (by id), marked removed: Undo takes them back out, whichever module they belong to. */
export function rowsUndone(all: ModuleRows | undefined, added: readonly ModuleRowIds[], gone: { removedAt: string; removedBy: string }): ModuleRows {
  const modules: ModuleRows = {};
  for (const a of added) {
    const want = new Set(a.ids);
    const rows = ((all?.[a.module]?.[a.key] ?? []) as ModuleRow[]).filter((r) => want.has(r.id) && !r.removedAt);
    if (rows.length) (modules[a.module] ??= {})[a.key] = rows.map((r) => ({ ...r, ...gone }));
  }
  return modules;
}
