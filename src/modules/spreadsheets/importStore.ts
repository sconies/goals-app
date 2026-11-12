/* The import in progress (backlog IM3; import spec, section 1): the file read, the answers given, the rows left out and
   the reason, kept in memory while someone moves between Import, the preview (/data/import/check) and the changes
   (/data/import/check/changes). Nothing is stored: a reload starts again at /data/import, and says nothing was saved. */
import { useSyncExternalStore } from 'react';
import type { Answer, Answers, IssueLevel } from '../../domain/problemLevels';
import type { RowRef } from '../../domain/leaveOut';
import type { ReadTables } from '../../domain/sheets';

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
}

const EMPTY: ImportState = { read: null, name: '', answers: {}, said: {}, reason: '', leftOut: [], asNew: false, carried: 0, lost: false };
let state: ImportState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const importStore = {
  get: () => state,
  set(patch: Partial<ImportState>) { state = { ...state, ...patch }; emit(); },
  /** A file read: answers given to the last file stay (a corrected file keeps them), everything else starts afresh. */
  chose(read: ReadTables, name: string) {
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
  reset(lost = false) { state = { ...EMPTY, lost }; emit(); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export const useImport = (): ImportState => useSyncExternalStore(importStore.subscribe, importStore.get, importStore.get);
