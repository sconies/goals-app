/* The import in progress (backlog IM3; import spec, section 1): the file read, the answers given, the rows left out and
   the reason, kept in memory while someone moves between Import, the preview (/data/import/check) and the changes
   (/data/import/check/changes). Nothing is stored: a reload starts again at /data/import, and says nothing was saved. */
import { useSyncExternalStore } from 'react';
import type { ChangeSet, PlanProgress } from '../../domain/changeset';
import type { Answer, Answers, IssueLevel } from '../../domain/problemLevels';
import type { RowRef } from '../../domain/leaveOut';
import type { ReadTables, Tables } from '../../domain/sheets';
import type { Snapshot } from '../../domain/types';
import type { RowProblem } from './rowsFile';

/** What an answered question said, so its closed line reads "{what was asked}: {answer}" after its group has gone. */
export interface Said { title: string; label: string; level: IssueLevel }

export interface ImportState {
  read: ReadTables | null;
  name: string;
  answers: Answers;
  said: Record<string, Said>;
  reason: string;
  /** Rows left out at the person's choice (decision 1), and the rows that went with them. */
  leftOut: RowRef[];
  /** The file was exported from another workspace and its rows are to be added as new (other-workspace). */
  asNew: boolean;
  /** Answers carried over from the file chosen before: "Your {k} answers still apply." */
  carried: number;
  /** Why the preview isn't there: a reload lost the file. */
  lost: boolean;
  /** Or Stop ended the check of a large file (spec 2.2): "Stopped. Nothing was saved." */
  stopped: boolean;
  /** The import just saved, while the file is still in memory: Imported offers its left-out rows as a download. */
  done: { importId: string; tables: Tables; rows: RowProblem[] } | null;
  /** The check of a large file, run in the worker (backlog IM6; ./checkRun.ts): kept here, so the preview and the
      changes list share it and moving between them doesn't check the file again. */
  run: CheckRun;
}

/** What a check was made for: when any of it changes, the file is checked again. */
export interface RunFor { tables: Tables; answers: Answers; name: string; left: number; snapshot: Snapshot }

export interface CheckRun {
  for: RunFor | null;
  /** The change set, once checked. While an answer is re-checked, the one before it, with `running` set. */
  cs: ChangeSet | null;
  progress: PlanProgress | null;
  /** When the check started (performance.now()): the Reading panel waits 400 ms (spec 2.2). */
  started: number;
  running: boolean;
  error: string;
}

export const NO_RUN: CheckRun = { for: null, cs: null, progress: null, started: 0, running: false, error: '' };
/** Ends a check in progress (set by ./checkRun.ts): a new file, or none, ends the old one's. */
let cancelRun: () => void = () => {};
export const onCancelRun = (f: () => void) => { cancelRun = f; };

const EMPTY: ImportState = { read: null, name: '', answers: {}, said: {}, reason: '', leftOut: [], asNew: false, carried: 0, lost: false, stopped: false, done: null, run: NO_RUN };
let state: ImportState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const importStore = {
  get: () => state,
  set(patch: Partial<ImportState>) { state = { ...state, ...patch }; emit(); },
  /** A file read: answers given to the last file stay (a corrected file keeps them), everything else starts afresh. */
  chose(read: ReadTables, name: string) {
    cancelRun();
    const kept = Object.keys(state.answers).length;
    state = { ...EMPTY, read, name, answers: state.answers, said: state.said, carried: state.read ? kept : 0 };
    emit();
  },
  answer(id: string, a: Answer | null, said?: Said) {
    const answers = { ...state.answers };
    const s = { ...state.said };
    if (a) { answers[id] = a; if (said) s[id] = said; } else { delete answers[id]; delete s[id]; }
    state = { ...state, answers, said: s };
    emit();
  },
  /** Back to the way in, forgetting the file (answers too). */
  reset(lost = false, stopped = false) { cancelRun(); state = { ...EMPTY, lost, stopped }; emit(); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export const useImport = (): ImportState => useSyncExternalStore(importStore.subscribe, importStore.get, importStore.get);
