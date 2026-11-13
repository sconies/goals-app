/* The import's preview (backlog IM3; docs/design/import/spec.md 2.3), at /data/import/check: what the file is and what
   was read, counts by sheet, then what must be fixed, then the questions, then what will be saved, and Save. Nothing is
   saved until every Must fix is fixed (or its rows left out) and every Check is answered; one answer covers every row
   in its group. The file is held in memory (importStore): a reload comes back to Import. */
import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import { readChanges } from '../../app/spreadsheet';
import { MODULE_SHEETS } from '../../core/records';
import { describe, sheetCounts, type ChangeSet } from '../../domain/changeset';
import { workbook } from '../../domain/export';
import { leaveOut } from '../../domain/leaveOut';
import { questionsLine, type Answer, type IssueGroup, type Sheet } from '../../domain/problemLevels';
import { CHANGES_SAVE_MAX, tooLarge } from '../../domain/importLimits';
import { headerRowsLine, parseDelimited, readLine, readTables, type ReadTables, type Tables } from '../../domain/sheets';
import { workedOutEdits } from '../../domain/workedOut';
import { useMark } from '../../telemetry/react';
import { Sheet as SheetBox, WarnMark } from '../../ui/bits';
/* The group block is shared with set-up. It is imported here, not lazily: a lazy Answered suspends on its first render,
   so the focus that follows an answer found nothing and fell to the page (#336 review). */
import { Answered as AnsweredLine, IssueGroup as SharedGroup } from '../../ui/IssueGroup';
import type { Snapshot } from '../../domain/types';
import { isNewIn, useImportPlan } from './importPlan';
import { stopCheck } from './checkRun';
import { importStore } from './importStore';
import { Reading, TooManyChanges, useReadingDue } from './Large';
import { baseName, leftRowsOf, rowsSheets, type RowProblem } from './rowsFile';
import './import.css';


const SHEETS: Sheet[] = ['Goals', 'Plan', 'Check-ins', 'People'];
const KEY: Record<Sheet, keyof Tables> = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;
const blank = (r: Record<string, string>) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());
/** While a save runs, the page that asked for it: the plan worked out again against what was just saved would flash
    "Nothing would change" and "Nothing has been saved" before Imported opens (IM4 review). */
const SAVING = 'Saving…';
const rowKey = (x: { sheet: string; row: number }) => `${x.sheet}:${x.row}`;
const uniqueRows = <T extends { sheet: Sheet; row: number }>(list: readonly T[]) => [...new Map(list.map((x) => [rowKey(x), x])).values()];


/** Reads tables into the import, or says why not: nothing that looks like a Faro sheet, or too many rows. */
function take(got: ReadTables, name: string, onProblem: (text: string, template?: boolean) => void): boolean {
  if (!got.read.length) {
    const heads = got.firstHeaders.length ? ` Its first sheet’s headers are ${got.firstHeaders.join(', ')}…` : '';
    onProblem(`Nothing in ${name} looks like a Faro sheet.${heads} Faro looks for Goal and Owner (goals), Goal key and Week (check-ins), or Name and Email (people). The template has the right headers.`, true);
    return false;
  }
  const big = tooLarge(name, { rows: got.rowCount });
  if (big) { onProblem(big); return false; }
  importStore.chose(got, name);
  return true;
}

/** Reads a chosen file into the import, staying on the preview. Shared by Import and the preview's own "Choose…". */
export async function chooseFile(f: File | undefined, onProblem: (text: string, template?: boolean) => void): Promise<boolean> {
  if (!f) return false;
  const big = tooLarge(f.name, { bytes: f.size });
  if (big) { onProblem(big); return false; }
  let got: ReadTables;
  try { got = await readChanges(f); } catch {
    onProblem(`Faro can’t read ${f.name}. Save it as .xlsx or .csv and try again.`);
    return false;
  }
  return take(got, f.name, onProblem);
}

/** Rows pasted from a spreadsheet (tab-separated, the header row first), read as a file called “Pasted rows”. */
export function choosePaste(text: string, onProblem: (text: string) => void): boolean {
  // Blank lines stay, so the rows keep the numbers they had where they were copied from (IM5 review).
  const got = readTables([{ name: 'Pasted rows', rows: parseDelimited(text, { keepBlank: true }) }]);
  if (!got.read.length) { onProblem('The first row should be the headers (Goal, Owner, Start…). Copy them from here:'); return false; }
  return take(got, 'Pasted rows', onProblem);
}

export function Check() {
  const app = useApp();
  const nav = useNavigate();
  const plan = useImportPlan();
  const { st, base, left, otherWorkspace, toSave, run, tables } = plan;
  const [saving, setSaving] = useState<ChangeSet | null>(null);
  const cs = saving ?? plan.cs;
  const due = useReadingDue(run?.started ?? 0, !!run?.running && !run.cs);
  const file = useRef<HTMLInputElement>(null);
  const why = useRef<HTMLTextAreaElement>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useMark(cs ? 'import.read' : null);

  const choose = () => { if (file.current) file.current.value = ''; file.current?.click(); };
  const picker = <input ref={file} type="file" accept=".xlsx,.zip,.csv,.tsv,.txt" className="sr" tabIndex={-1} aria-label="Choose a spreadsheet" onChange={(e) => void chooseFile(e.target.files?.[0], setProblem).then((ok) => ok && setProblem(''))} />;

  // A reload loses the file (it was only ever in memory): back to Import, which says so.
  if (!st.read || !base) return <Navigate to="/data/import" replace state={{ lost: true }} />;
  const read = st.read;

  if (otherWorkspace) {
    const from = read.origin!.workspaceName ? `“${read.origin!.workspaceName}”` : 'another workspace';
    return (
      <div className="page narrow import-check">
        <div className="page-head"><h1 className="title-xl">Check this import</h1><span className="hint">Nothing has been saved.</span></div>
        <p className="small">{st.name} · {readLine(read)}</p>
        <div className="level-block level-check" role="group" aria-labelledby="other-ws">
          <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
          <strong id="other-ws" className="level-q">This file was exported from {from}, not from {app.ws.name}. Its keys and IDs belong there.</strong>
          <span className="level-actions">
            <button type="button" className="btn" onClick={() => importStore.set({ asNew: true })}>Add its rows as new goals</button>
            <button type="button" className="btn" onClick={() => { importStore.reset(); nav('/data/import'); }}>Cancel</button>
          </span>
        </div>
      </div>
    );
  }
  if (!cs) {
    // A large file, still being checked in the worker (spec 2.2), or a check that failed.
    const stopIt = () => { stopCheck(); importStore.reset(false, true); };
    if (run?.error) {
      return (
        <div className="page narrow import-check">
          {picker}
          <div className="page-head"><h1 className="title-xl">Check this import</h1><span className="hint">Nothing has been saved.</span></div>
          <p className="hint tone-off" role="alert">Faro couldn’t check {st.name}: {run.error}. Split it and import each part.</p>
          <div className="foot-row import-foot"><button type="button" className="btn primary big-btn" onClick={choose}>Choose another file</button></div>
        </div>
      );
    }
    return due ? <Reading name={st.name} read={read} progress={run?.progress ?? null} onStop={stopIt} /> : null;
  }
  const rechecking = !!run?.running;

  // While a large file is checked again after an answer, the change set on screen is the one before it: a group just
  // answered closes at once, as it does for a small file.
  const waiting = (id: string) => rechecking && !!st.answers[id];
  const must = cs.groups.filter((g) => g.level === 'must' && !waiting(g.id));
  const checks = cs.groups.filter((g) => g.level === 'check' && !waiting(g.id));
  const mustIssues = cs.issues.filter((i) => i.level === 'must');
  const mustRows = uniqueRows(mustIssues);
  const answered = Object.keys(st.answers).filter((id) => st.said[id] && (waiting(id) || !cs.groups.some((g) => g.id === id)));
  const answeredChecks = answered.filter((id) => st.said[id]!.level === 'check');
  const answeredMust = answered.filter((id) => st.said[id]!.level === 'must');
  const total = cs.items.length;
  const nothing = !total && !must.length && !checks.length;
  const onlyReason = !cs.commit && !must.length && !checks.length && cs.needsReason && total > 0;
  const leftCount = cs.leftOut.length + left.length;

  const save = async () => {
    if (onlyReason && !st.reason.trim()) { setTried(true); why.current?.focus(); return; }
    const final = toSave();
    if (!final?.commit) { setTried(true); return; }
    setBusy(true);
    setSaving(cs);
    try {
      const importId = final.commit.changes.find((c) => c.action === 'imported')?.entityId;
      await app.applyChanges(final);
      // The file is forgotten when Import next opens: emptied here, the open preview would send the person back to Import.
      // Imported reads the import from the change log; the rows left out stay in memory for its download.
      if (importId) importStore.set({ done: { importId, tables: base, rows: leftRows } });
      else app.toast(`Saved: ${describe(cs).toLowerCase()}`);
      nav(importId ? `/data/import/done/${importId}` : '/goals');
    } catch (e) {
      setProblem(`Nothing was saved: ${e instanceof Error ? e.message : String(e)}. Try again.`);
      setBusy(false);
      setSaving(null);
    }
  };
  const download = (rows: RowProblem[], what: string, done: string) => saveAndSay(app.toast, { workspace: app.ws.name, what, date: app.today, as: `${baseName(st.name)}-${what}` }, { kind: 'xlsx', sheets: rowsSheets(read, base, rows) }, done);
  const leftRows = leftRowsOf(left);
  const toFix: RowProblem[] = mustIssues.map((i) => ({ sheet: i.sheet, row: i.row, problem: i.message }));

  return (
    <div className="page narrow import-check">
      {picker}
      <div className="page-head">
        <h1 className="title-xl">Check this import</h1>
        <span className="hint">{saving ? SAVING : 'Nothing has been saved.'}</span>
      </div>

      <p className="small import-file-line"><span className="strong">{st.name}</span> · {[readLine(read, cs.examples), headerRowsLine(read)].filter(Boolean).join(' ')}</p>
      {st.carried > 0 && <p className="small">Your {n(st.carried, 'answer')} still {st.carried === 1 ? 'applies' : 'apply'}.</p>}
      {problem && <p className="hint tone-off" role="alert">{problem}</p>}

      <Counts cs={cs} base={base} read={read.read} />

      {(must.length > 0 || answeredMust.length > 0) && (
        <section className="stack import-section" aria-labelledby="must-fix">
          <h2 className="h2" id="must-fix">Must fix</h2>
          {must.length > 0 && <p className="hint">{n(mustRows.length, 'row')}, {n(new Set(must.map((g) => g.kind)).size, 'kind')} of problem</p>}
          {must.map((g) => <GroupBlock key={g.id} g={g} cs={cs} prior={st.answers[g.id]} />)}
          {answeredMust.map((id) => <Answered key={id} id={id} />)}
          {mustRows.length > 0 && (
            <div className="import-fix-actions">
              <button type="button" className="btn" onClick={() => void download(toFix, 'rows-to-fix', 'Rows to fix saved')}>Download the {n(mustRows.length, 'row')} to fix</button>
              <button type="button" className="linkish tap" onClick={() => setLeaving(true)}>{mustRows.length === 1 ? 'Leave this row out and save the rest' : `Leave these ${n(mustRows.length, 'row')} out and save the rest`}</button>
            </div>
          )}
        </section>
      )}

      {(checks.length > 0 || answeredChecks.length > 0) && (
        <section className="stack import-section" aria-labelledby="checks">
          <h2 className="h2" id="checks">Check</h2>
          <p className="hint">{checks.length ? `${questionsLine(checks)}.` : ''}{answeredChecks.length ? ` ${answeredChecks.length} of ${checks.length + answeredChecks.length} answered.` : ''}</p>
          {checks.map((g) => <GroupBlock key={g.id} g={g} cs={cs} prior={st.answers[g.id]} />)}
          {answeredChecks.map((id) => <Answered key={id} id={id} />)}
        </section>
      )}

      {nothing ? (
        <Nothing cs={cs} base={base} names={Object.fromEntries(read.read.map((x) => [x.kind, x.name]))} />
      ) : (
        <section className="stack import-section" aria-labelledby="will-save">
          <h2 className="h2" id="will-save">What will be saved</h2>
          <p>{total ? describe(cs) : 'Nothing yet'}.{cs.unchanged ? ` ${n(cs.unchanged, 'row is', 'rows are')} unchanged.` : ''}{leftCount ? ` ${n(leftCount, 'row is', 'rows are')} left out.` : ''}</p>
          {total > 0 && <Link className="linkish tap import-show" to="/data/import/check/changes">Show the {n(total, 'change')}</Link>}
          {left.length > 0 && (
            <p className="small">{n(left.length, 'row was', 'rows were')} left out at your choice. <button type="button" className="linkish tap" onClick={() => void download(leftRows, 'left-out', 'Rows left out saved')}>Download them</button> · <button type="button" className="linkish tap" onClick={() => importStore.set({ leftOut: [] })}>Put them back</button></p>
          )}
        </section>
      )}

      {cs.items.some((x) => x.needsReason) && (
        <label className="field">
          <span className="field-label">Why are these plans changing?</span>
          <span className="hint">Say why to save: check-ins have started on {cs.items.filter((x) => x.needsReason).length === 1 ? 'this goal' : 'these goals'}, so the change log keeps the reason with the old and new plan. A Reason column in the file is used first.</span>
          <textarea ref={why} className={'input' + (tried && cs.needsReason ? ' invalid' : '')} aria-invalid={tried && cs.needsReason ? true : undefined} rows={2} value={st.reason} onChange={(e) => importStore.set({ reason: e.target.value })} />
        </label>
      )}

      {rechecking && <p className="hint preview-hint" role="status">Checking your answers…</p>}
      {total > CHANGES_SAVE_MAX && tables
        ? <TooManyChanges changes={total} name={st.name} read={read} tables={tables} workspace={app.ws.name} today={app.today} toast={app.toast} onChoose={choose} />
        : <Foot mustRows={mustRows.length} questions={checks.length} total={total} nothing={nothing} ready={!rechecking && (!!cs.commit || (onlyReason && !!st.reason.trim()))} onlyReason={onlyReason && !st.reason.trim()} tried={tried} busy={busy} onSave={() => void save()} onChoose={choose} />}

      <LeaveSheet open={leaving} onClose={() => setLeaving(false)} rows={mustRows.map((i) => ({ sheet: i.sheet, row: i.row, name: i.name, problem: i.message }))} onDownload={() => void download(toFix, 'left-out', 'Rows left out saved')}
        dependants={leaving ? leaveOut(base, [...st.leftOut, ...mustRows.map((i) => ({ sheet: i.sheet, row: i.row }))], isNewIn(app.snapshot)).also.filter((x) => !left.some((y) => rowKey(y) === rowKey(x))) : []}
        onLeave={() => { importStore.set({ leftOut: [...st.leftOut, ...mustRows.map((i) => ({ sheet: i.sheet, row: i.row }))] }); setLeaving(false); focusOn('.import-foot .btn.primary'); }} />
    </div>
  );
}

/** Counts by sheet (2.3, item 2; domain/changeset sheetCounts): a table from 700 px; below, one sentence per sheet with
    the zero parts left out. */
function Counts({ cs, base, read }: { cs: ChangeSet; base: Tables; read: { name: string; kind: string }[] }) {
  const rows = SHEETS.filter((sh) => read.some((r) => r.kind === KEY[sh])).map((sh) => ({
    sheet: read.find((r) => r.kind === KEY[sh])!.name,
    read: (base[KEY[sh]] ?? []).filter((r) => !blank(r)).length,
    ...sheetCounts(cs, sh),
  }));
  const sentence = (r: (typeof rows)[number]) => {
    const parts = [r.added && `${r.added.toLocaleString('en-GB')} added`, r.changed && `${r.changed.toLocaleString('en-GB')} changed`, r.stopped && `${r.stopped.toLocaleString('en-GB')} stopped or left`, r.unchanged && `${r.unchanged.toLocaleString('en-GB')} unchanged`, r.must && `${r.must.toLocaleString('en-GB')} must be fixed`, r.check && `${r.check.toLocaleString('en-GB')} to check`].filter(Boolean);
    return `${r.sheet}: ${n(r.read, 'row')} read${parts.length ? `; ${parts.join(', ')}` : ''}.`;
  };
  return (
    <section className="import-counts" aria-label="Counts by sheet">
      <table className="import-counts-table">
        <thead><tr><th scope="col">Sheet</th><th scope="col" className="num">Rows read</th><th scope="col" className="num">Added</th><th scope="col" className="num">Changed</th><th scope="col" className="num">Stopped or left</th><th scope="col" className="num">Unchanged</th><th scope="col" className="num">Must fix</th><th scope="col" className="num">Check</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.sheet}><th scope="row">{r.sheet}</th>{[r.read, r.added, r.changed, r.stopped, r.unchanged, r.must, r.check].map((v, i) => <td key={i} className="num">{v.toLocaleString('en-GB')}</td>)}</tr>)}</tbody>
      </table>
      <ul className="import-counts-lines">{rows.map((r) => <li key={r.sheet}>{sentence(r)}</li>)}</ul>
    </section>
  );
}

/** "Nothing would change" (2.3), with the worked-out cells that differ from today's, when there are any. */
function Nothing({ cs, base, names }: { cs: ChangeSet; base: Tables; names: Partial<Record<keyof Tables, string>> }) {
  const app = useApp();
  const edits = useMemo(() => workedOutEdits(base, workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, sheets: MODULE_SHEETS }), names), [base, app, names]);
  const rows = edits.reduce((k, e) => k + e.rows.length, 0);
  const cols = [...new Set(edits.flatMap((e) => e.columns))];
  return (
    <section className="import-nothing" aria-labelledby="nothing">
      <h2 className="h2" id="nothing">Nothing would change</h2>
      {(() => { const k = Object.values(cs.unchangedBy).reduce((a, b) => a + b, 0); return <p>{k ? `All ${n(k, 'row says', 'rows say')} what Faro already says.` : 'The file has its headers but no rows.'}</p>; })()}
      {rows > 0 && <p className="small">On {n(rows, 'row')}, {cols.length === 1 ? cols[0] : `${cols.slice(0, -1).join(', ')} and ${cols.at(-1)}`} {cols.length === 1 ? 'differs' : 'differ'} from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.</p>}
    </section>
  );
}

/** After an answer closes its block, or rows are left out, the focus goes on: to the next open question, else to
    `then` (an answered line, the Save button), never to the page itself (#191 review). */
const focusOn = (then: string) => requestAnimationFrame(() => {
  const next = document.querySelector<HTMLElement>('.import-group input[type=radio]');
  (next ?? document.querySelector<HTMLElement>(then))?.focus();
});

/** A question answered: what was asked and the answer, with Change. */
function Answered({ id }: { id: string }) {
  const said = importStore.get().said[id]!;
  return <AnsweredLine id={id} title={said.title} label={said.label} onChange={() => importStore.answer(id, null)} />;
}

/** The cell an answer reads as: a team's name, a person's email (or name), a goal's key. */
function valueOf(s: Snapshot, kind: 'team' | 'person' | 'goal', id: string): string {
  if (kind === 'team') return s.teams.find((t) => t.id === id)?.name ?? '';
  if (kind === 'person') { const p = s.people.find((x) => x.id === id); return p?.email || p?.name || ''; }
  const g = s.goals.find((x) => x.id === id);
  return g?.key ?? g?.id ?? '';
}

/** One group (rule 6), answered into the import (src/ui/IssueGroup). */
function GroupBlock({ g, cs, prior }: { g: IssueGroup; cs: ChangeSet; prior?: Answer }) {
  const app = useApp();
  return (
    <SharedGroup g={g} rows={cs.issues.filter((i) => i.group === g.id)} prior={prior} valueOf={(kind, id) => valueOf(app.snapshot, kind, id)}
      onAnswer={(x) => { importStore.answer(g.id, x.answer, { title: x.title, label: x.label, level: x.level }); focusOn(`[id="answered-${g.id}"]`); }} />
  );
}

/** The foot (2.3, item 7): what still stands in the way, and the one primary action. */
function Foot({ mustRows, questions, total, nothing, ready, onlyReason, tried, busy, onSave, onChoose }: { mustRows: number; questions: number; total: number; nothing: boolean; ready: boolean; onlyReason: boolean; tried: boolean; busy: boolean; onSave: () => void; onChoose: () => void }) {
  const saveLabel = busy ? 'Saving…' : `Save ${n(total, 'change')}`;
  if (nothing) return <div className="foot-row import-foot"><button type="button" className="btn primary big-btn" onClick={onChoose}>Choose another file</button></div>;
  if (mustRows) {
    return (
      <>
        <p className="hint preview-hint" role="status">{n(mustRows, 'row')} must be fixed{questions ? ` and ${n(questions, 'question')} answered` : ''} before this can be saved.</p>
        <div className="foot-row import-foot"><button type="button" className="btn primary big-btn" onClick={onChoose}>Choose the corrected file</button></div>
      </>
    );
  }
  return (
    <>
      {questions > 0 && <p className="hint preview-hint" role="status">Answer {n(questions, 'question')} to save.</p>}
      {onlyReason && <p className={'hint preview-hint' + (tried ? ' tone-off' : '')} role="status">Say why the plans are changing to save.</p>}
      <div className="foot-row import-foot">
        <button type="button" className="btn big-btn preview-again" onClick={onChoose}>Choose another file</button>
        <button type="button" className="btn primary big-btn" disabled={(!ready && !onlyReason) || busy} aria-disabled={onlyReason || undefined} onClick={onSave}>{saveLabel}</button>
      </div>
    </>
  );
}

/** Leaving rows out (2.3, decision 1): what goes, what goes with it, and the choice. */
function LeaveSheet({ open, onClose, rows, dependants, onDownload, onLeave }: { open: boolean; onClose: () => void; rows: (RowProblem & { name: string })[]; dependants: { sheet: Sheet; row: number; because: string }[]; onDownload: () => void; onLeave: () => void }) {
  const what = SHEETS.map((sh) => { const k = dependants.filter((d) => d.sheet === sh).length; return k ? n(k, sh === 'Check-ins' ? 'check-in' : sh === 'People' ? 'person' : sh === 'Plan' ? 'plan row' : 'goal', sh === 'People' ? 'people' : undefined) : ''; }).filter(Boolean).join(' and ');
  return (
    <SheetBox open={open} onClose={onClose} title={`Leave ${n(rows.length, 'row')} out?`}>
      <p>These {n(rows.length, 'row')} won’t be saved{dependants.length ? `, nor will ${n(dependants.length, 'row')} that depend on them (${what})` : ''}. Everything else will.</p>
      <ul className="issue-list import-leave-list">
        {rows.slice(0, 50).map((x) => <li key={rowKey(x)}><span className="label">{x.sheet}, row {x.row}{x.name ? ` · ${x.name}` : ''}</span><span>{x.problem}</span></li>)}
        {dependants.slice(0, 50).map((x) => <li key={rowKey(x)}><span className="label">{x.sheet}, row {x.row}</span><span>Goes with them: {x.because}.</span></li>)}
      </ul>
      <div className="foot-row">
        <button type="button" className="linkish tap" onClick={onDownload}>Download these rows</button>
        <span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" onClick={onLeave}>Leave them out</button>
      </div>
    </SheetBox>
  );
}
