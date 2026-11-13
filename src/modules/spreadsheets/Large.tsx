/* Large files on the preview (import spec 2.2 and 2.8; backlog IM6): the Reading panel while the worker checks a file
   (after 400 ms, with progress and Stop), and, in place of Save, the block for a file that would change more rows
   than Faro saves at once, with the file in parts to download. */
import { useEffect, useState } from 'react';
import { saveAndSay, type SheetOut } from '../../app/files';
import type { PlanProgress } from '../../domain/changeset';
import { toCsv } from '../../domain/export';
import { CHANGES_SAVE_MAX, count } from '../../domain/importLimits';
import type { ReadTables, TableKey, Tables } from '../../domain/sheets';
import { partName, splitTables } from '../../domain/splitFile';
import { WarnMark } from '../../ui/bits';
import { rowsIn } from './importPlan';
import { baseName } from './rowsFile';

/** How long a check runs before the Reading panel shows (spec 2.2). */
export const READING_AFTER_MS = 400;

const plural = (k: number, one: string, many = one + 's') => `${count(k)} ${k === 1 ? one : many}`;

/** Re-draws once when the Reading panel is due. */
export function useReadingDue(started: number, running: boolean): boolean {
  const [, tick] = useState(0);
  const left = READING_AFTER_MS - (performance.now() - started);
  useEffect(() => {
    if (!running || left <= 0) return;
    const t = setTimeout(() => tick((x) => x + 1), left);
    return () => clearTimeout(t);
  }, [running, left]);
  return running && left <= 0;
}

/** 2.2: "Reading {name}", what has been read, how far the check has got, and Stop. */
export function Reading({ name, read, progress, onStop }: { name: string; read: ReadTables; progress: PlanProgress | null; onStop: () => void }) {
  const rows = rowsIn(read.tables);
  const done = progress?.done ?? 0;
  const pct = rows ? Math.min(100, Math.floor((done / rows) * 100)) : 0;
  return (
    <div className="page narrow import-check import-reading">
      <div className="page-head">
        <h1 className="title-xl">Reading {name}</h1>
        <span className="hint">You can keep using Faro in another tab. Nothing is saved until you say so.</span>
      </div>
      <div className="card stack import-progress" role="status" aria-live="polite">
        <p>Read the file · {plural(read.read.length, 'sheet')}, {plural(rows, 'row')} — Done</p>
        <p>Checking each row · {count(done)} of {count(rows)} — {pct}%</p>
        <progress className="import-bar" max={rows || 1} value={done} aria-label="Checking each row" />
        {progress && <p className="small">So far: {count(progress.added)} would be added, {count(progress.changed)} changed, {count(progress.mustFix)} must be fixed.</p>}
      </div>
      <button type="button" className="linkish tap" onClick={onStop}>Stop</button>
    </div>
  );
}

/** The parts' files: one sheet read as a CSV stays a CSV; a workbook stays a workbook with the same sheets. */
function partFiles(read: ReadTables, tables: Tables) {
  const keys = (Object.keys(tables) as (TableKey)[]).filter((k) => tables[k]);
  const csv = read.read.length === 1 && /\.(csv|tsv|txt)$/i.test(read.read[0]!.name);
  return (part: Tables) => {
    const sheets: SheetOut[] = keys.flatMap((k) => {
      const recs = part[k] ?? [];
      const head = read.headers[k] ?? Object.keys(recs[0] ?? {}).filter((h) => h !== '__row');
      const name = read.read.find((x) => x.kind === k)?.name.replace(/\.(csv|tsv|txt)$/i, '') ?? k;
      return [{ name, rows: [head, ...recs.map((r) => head.map((h) => r[h.toLowerCase()] ?? r[h] ?? ''))] }];
    });
    return csv ? { kind: 'csv' as const, text: toCsv(sheets[0]!.rows) } : { kind: 'xlsx' as const, sheets };
  };
}

/** 2.8: a file that would change more rows than one import saves. Checked, not saved; offered in parts. */
export function TooManyChanges({ changes, name, read, tables, workspace, today, toast, onChoose }: { changes: number; name: string; read: ReadTables; tables: Tables; workspace: string; today: Date; toast: (t: string, tone?: 'error') => void; onChoose: () => void }) {
  const parts = splitTables(tables, CHANGES_SAVE_MAX);
  const k = parts.length;
  const download = async () => {
    const file = partFiles(read, tables);
    const base = baseName(name);
    for (const [i, p] of parts.entries()) {
      const as = partName(base, i + 1, k);
      const ok = await saveAndSay(() => {}, { workspace, what: as, date: today, as }, file(p), '');
      if (!ok) { toast(`Couldn’t save part ${i + 1} of ${k}.`, 'error'); return; }
    }
    toast(`Saved ${k} files`);
  };
  return (
    <>
      <div className="level-block level-check import-too-many" role="group" aria-labelledby="too-many">
        <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
        <strong id="too-many" className="level-q">This file would change {count(changes)} rows. Faro saves up to {count(CHANGES_SAVE_MAX)} at a time.</strong>
        <span className="hint">Faro is a model, and it checks and saves in your browser. Split the file by team or by sheet and import each part; every part has its own Undo.</span>
      </div>
      <div className="foot-row import-foot">
        <button type="button" className="btn big-btn preview-again" onClick={onChoose}>Choose another file</button>
        <button type="button" className="btn primary big-btn" onClick={() => void download()}>Download as {plural(k, 'file')} of {count(CHANGES_SAVE_MAX)} rows</button>
      </div>
    </>
  );
}
