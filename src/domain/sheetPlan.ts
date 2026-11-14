/* A module's own loaded sheet in the change engine (MI; docs/design/metrics-2/spec.md section 7, the `sheets` point):
   a module whose sheet loads back (Metrics) gives a planner, and the engine runs it beside the core's sheets, so its rows
   get the same preview, questions, leaving out, one commit and one Undo as any import. The planner says what each row
   would do with the module's own rules; the engine owns the questions' words of level, the answers and the undo. Pure:
   no screen, network or database code. */
import type { ActionContext } from './actions';
import type { Commit } from './commit';
import type { Answer, Choice, IssueKind } from './problemLevels';
import type { Rec } from './sheets';
import type { Diff } from './types';

/** What a question or problem on a row carries, as the engine's own (changeset `Extra`). */
export interface SheetPlanExtra { column?: string; found?: string; suggest?: string; answers?: Choice[]; value?: string }

export interface SheetPlanApi {
  /** The sheet's name, as its issues and items say it. */
  sheet: string;
  /** Its rows to read: not blank, not an example, each with its row number in the file. */
  rows: { r: Rec; row: number }[];
  /** The workspace as the planner may change it: actor, now, ids, the snapshot as the core rows before it left it. */
  x: ActionContext;
  /** A cell, trimmed; whether the file has the column at all (an absent column leaves a field as it is). */
  val: (r: Rec, column: string) => string;
  has: (r: Rec, column: string) => boolean;
  /** A Must fix (or a note), by its kind. */
  raise: (kind: IssueKind, row: number, name: string, message: string, extra?: SheetPlanExtra) => void;
  /** A Check: its answer, 'leave' when the row is left out, or null while it is unanswered (it is raised). */
  ask: (kind: IssueKind, row: number, name: string, message: string, extra: SheetPlanExtra) => Answer | 'leave' | null;
  /** A row that says what's already there. */
  same: () => void;
}

/** One row's change, as the preview lists it. */
export interface SheetPlanItem { row: number; name: string; act: 'added' | 'changed' | 'retired' | 'back'; summary: string; diffs: Diff[] }

export interface SheetPlanResult {
  items: SheetPlanItem[];
  /** The module's rows and the change log, as one commit (merged into the import's). */
  commit: Pick<Commit, 'modules' | 'changes' | 'goals'>;
  /** What each row was before, so the import's Undo puts it back (null: it was added). */
  undo: { module: string; key: string; rows: { id: string; before: unknown }[] }[];
  /** How the counts say one and many of what it changes ("metric", "metrics"). */
  noun: [string, string];
}

export type SheetPlanner = (api: SheetPlanApi) => SheetPlanResult;
