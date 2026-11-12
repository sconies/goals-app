/* The import in progress, worked out (backlog IM3): the file's tables (as new rows, when it came from another
   workspace; without the rows left out), and the change set the engine makes of them with the answers given. Shared by
   the preview and the changes list, so both say the same. */
import { useMemo } from 'react';
import { useApp } from '../../app/state';
import type { ChangeSet } from '../../domain/changeset';
import { leaveOut, type DependentRow, type IsNew, type RowRef } from '../../domain/leaveOut';
import { normalEmail } from '../../domain/people';
import type { Rec, Tables } from '../../domain/sheets';
import type { Snapshot } from '../../domain/types';
import { useImport, type ImportState } from './importStore';

const drop = (rows: Rec[] | undefined, cols: string[]) => rows?.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !cols.includes(k))) as Rec);
/** A file from another workspace, its rows added as new (other-workspace, "Add its rows as new goals"): keys and IDs go. */
export const asNewTables = (t: Tables): Tables => ({
  ...(t.goals ? { goals: drop(t.goals, ['key', 'id', 'feeds into key']) } : {}),
  ...(t.checkIns ? { checkIns: drop(t.checkIns, ['id', 'goal key', 'goal id']) } : {}),
  ...(t.people ? { people: drop(t.people, ['id']) } : {}),
});

/** Which rows add a record here: a goal with no Key or ID, a person no one here is (by ID or email). */
export const isNewIn = (s: Snapshot): IsNew => (sheet, r) => {
  if (sheet === 'Goals') return !(r.key ?? '').trim() && !(r.id ?? '').trim();
  if (sheet !== 'People') return false;
  const id = (r.id ?? '').trim(), email = normalEmail(r.email ?? '');
  return !(id && s.people.some((p) => p.id === id)) && !(email && s.people.some((p) => normalEmail(p.email) === email));
};

export interface ImportPlan {
  st: ImportState;
  /** The file's tables before any row is left out. */
  base: Tables | null;
  /** Every row left out: those chosen, then the rows that depend on them. */
  left: (RowRef & { because?: string })[];
  also: DependentRow[];
  cs: ChangeSet | null;
  /** The file came from another workspace, and that question isn't answered yet. */
  otherWorkspace: boolean;
}

export function useImportPlan(): ImportPlan {
  const app = useApp();
  const st = useImport();
  const otherWorkspace = !!st.read?.origin && st.read.origin.workspaceId !== app.ws.id && !st.asNew;
  const base = useMemo(() => (st.read ? (st.asNew ? asNewTables(st.read.tables) : st.read.tables) : null), [st.read, st.asNew]);
  const out = useMemo(() => (base && st.leftOut.length ? leaveOut(base, st.leftOut, isNewIn(app.snapshot)) : null), [base, st.leftOut, app.snapshot]);
  const tables = out?.tables ?? base;
  const left = [...st.leftOut, ...(out?.also ?? [])];
  const cs = useMemo(() => (tables && !otherWorkspace ? app.previewChanges(tables, 'spreadsheet', st.reason, false, st.answers, { name: st.name, leftOut: left.length }) : null), [tables, otherWorkspace, st.reason, st.answers, st.name, left.length, app]);
  return { st, base, left, also: out?.also ?? [], cs, otherWorkspace };
}
