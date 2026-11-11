/* Import from a spreadsheet (the spreadsheets module, at /data/import; old /import links come here): people, goals, plan
   numbers and check-ins, including past weeks, and a row's Action (stop or delete a goal, mark someone as left). Any
   file the app exports loads back: the workbook, the zipped CSVs, one CSV. Every row is checked with the app's own
   rules and shown before anything is saved; then all of it saves, or none. Set-up has its own upload (Onboarding). */
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../../app/state';
import { readChanges } from '../../app/spreadsheet';
import { saveAndSay } from '../../app/files';
import { describe, type Tables } from '../../domain/changeset';
import { andList, requiredLine } from '../../domain/columns';
import { templateWorkbook, workbook } from '../../domain/export';
import type { ReadTables } from '../../domain/sheets';
import { useMark } from '../../telemetry/react';
import { Preview } from '../../ui/Preview';

export function Import() {
  const app = useApp();
  const nav = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [read, setRead] = useState<ReadTables | null>(null);
  const tables: Tables | null = read?.tables ?? null;
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const cs = useMemo(() => (tables ? app.previewChanges(tables, 'spreadsheet', reason, confirmed) : null), [tables, reason, confirmed, app]);
  // A file read and its changes shown: the import flow's middle step (src/help/flows.ts).
  useMark(tables ? 'import.read' : null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setProblem('');
    try {
      const got = await readChanges(f);
      if (!got.read.length) { setProblem('That file has no Goals, Plan, Check-ins or People sheet this app recognises: each is known by its header row. Start from the workbook below, which has the right headers.'); return; }
      setRead(got);
      setName(f.name);
    } catch (e) {
      setProblem('Couldn’t read that file: ' + (e instanceof Error ? e.message : String(e)) + '. Save it as .xlsx, .zip or .csv and try again.');
    }
  };
  const apply = async () => {
    if (!cs?.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(cs);
      app.toast(`Saved: ${describe(cs).toLowerCase()}`);
      nav('/goals');
    } catch { setBusy(false); }
  };
  const template = () => saveAndSay(app.toast, { workspace: app.ws.name, what: 'goals-to-edit', scope: app.cycle.name, date: app.today }, { kind: 'xlsx', sheets: workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today }) }, 'Workbook saved');
  const starter = () => saveAndSay(app.toast, { workspace: app.ws.name, what: 'template', date: app.today }, { kind: 'xlsx', sheets: templateWorkbook({ ws: app.ws, cycle: app.cycle, week: app.week, today: app.today }) }, 'Template saved');
  // Which sheets were read, and which were left out: so a file that changed nothing says why. Example rows (the
  // template's, whose Action says Example) are never imported, and said.
  const examples = cs?.examples ?? 0;
  const sheetsLine = read ? `Read ${andList(read.read.map((x) => x.name))}.${read.skipped.length ? ` Not loaded back: ${andList(read.skipped.map((x) => x.name))}.` : ''}${examples ? ` ${examples} example ${examples === 1 ? 'row' : 'rows'} left out.` : ''}` : '';

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Import from a spreadsheet</h1>
        <span className="hint">Add or change goals, people, plan numbers and check-ins, including past weeks, or stop a goal. You’ll see every change before anything is saved.</span>
      </div>

      {!cs && (
        <>
          {/* Three short steps side by side, then one clear place to put the file. */}
          <ol className="steps-list import-steps">
            <li><span className="strong">Download the workbook</span><span className="hint">Every goal in {app.cycle.name}, its plan by week, its check-ins and the people.</span>
              <button type="button" className="btn sm" onClick={() => void template()}>Download the workbook</button></li>
            <li><span className="strong">Change it in Excel</span><span className="hint">Edit cells; add rows for new goals, people or past weeks. To stop a goal, say Stop in its Action column. The Start here sheet explains each column.</span></li>
            <li><span className="strong">Load it here</span><span className="hint">{app.viewer.admin ? 'As an admin you can change any goal and anyone.' : 'Rows for other people’s goals are fine if you leave them as they are.'}</span></li>
          </ol>
          <input ref={file} type="file" accept=".xlsx,.zip,.csv,.tsv,.txt" className="sr" aria-label="Choose a spreadsheet" onChange={(e) => void pick(e.target.files?.[0])} />
          <div className={'dropzone' + (over ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files?.[0]); }}>
            <span className="strong">Drop the workbook here</span>
            <span className="hint">An .xlsx workbook, a .zip of CSVs, or one .csv or tab-separated file. Every change is shown before anything is saved.</span>
            <button type="button" className="btn primary big-btn" onClick={() => file.current?.click()}>Choose a file</button>
          </div>
          {problem && <p className="hint tone-off" role="alert">{problem}</p>}
          {/* What a new row must have, from the field table (domain/columns), and the template to start from nothing. */}
          <section className="stack" aria-labelledby="import-needs" style={{ gap: 'var(--s2)' }}>
            <h2 className="h2" id="import-needs">What a new row must have</h2>
            <ul className="help-points">
              <li><span className="strong">A goal</span>: {requiredLine('goals')}</li>
              <li><span className="strong">A check-in</span>: {requiredLine('checkIns')}</li>
              <li><span className="strong">A person</span>: {requiredLine('people')}</li>
            </ul>
            <span className="hint"><Link to="/help/columns">Every column, with its format and an example</Link>. Starting from nothing? <button type="button" className="linkish tap" onClick={() => void starter()}>Download the template</button>: every column, the required ones in bold, and example rows that are never imported.</span>
          </section>
          <div><Link className="btn ghost edge-ghost" to="/data">Cancel</Link></div>
        </>
      )}

      {cs && <Preview cs={cs} name={`${name} · ${sheetsLine}`} reason={reason} setReason={setReason} onConfirm={() => setConfirmed(true)} busy={busy} onApply={() => void apply()} onAgain={() => { setRead(null); setReason(''); setConfirmed(false); if (file.current) file.current.value = ''; setTimeout(() => file.current?.click(), 0); }} />}
    </div>
  );
}
