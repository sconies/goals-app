/* Import from a spreadsheet: goals, plan numbers and check-ins, including past weeks.
   Every row is checked with the app's own rules and shown before anything is saved; then all of it saves, or none. */
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { readChanges } from '../app/spreadsheet';
import { saveAndSay } from '../app/files';
import { describe, type Tables } from '../domain/changeset';
import { workbook } from '../domain/export';
import { useMark } from '../telemetry/react';
import { Preview } from '../ui/Preview';

export function Import() {
  const app = useApp();
  const nav = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<Tables | null>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const cs = useMemo(() => (tables ? app.previewChanges(tables, 'spreadsheet', reason) : null), [tables, reason, app]);
  // A file read and its changes shown: the import flow's middle step (src/help/flows.ts).
  useMark(tables ? 'import.read' : null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setProblem('');
    try {
      const { tables: t, sheets } = await readChanges(f);
      if (!sheets.length) { setProblem('That file has no Goals, Plan or Check-ins sheet. Start from the workbook below, which has the right columns.'); return; }
      setTables(t);
      setName(f.name);
    } catch (e) {
      setProblem('Couldn’t read that file: ' + (e instanceof Error ? e.message : String(e)) + '. Save it as .xlsx or .csv and try again.');
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

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Import from a spreadsheet</h1>
        <span className="hint">Add or change goals, set plan numbers, or add check-ins, including past weeks. You’ll see every change before anything is saved.</span>
      </div>

      {!cs && (
        <>
          {/* Three short steps side by side, then one clear place to put the file. */}
          <ol className="steps-list import-steps">
            <li><span className="strong">Download the workbook</span><span className="hint">Every goal in {app.cycle.name}, its plan by week and its check-ins.</span>
              <button type="button" className="btn sm" onClick={() => void template()}>Download the workbook</button></li>
            <li><span className="strong">Change it in Excel</span><span className="hint">Edit cells; add rows for new goals (no ID) or past weeks. The README sheet explains each column.</span></li>
            <li><span className="strong">Load it here</span><span className="hint">{app.viewer.admin ? 'As an admin you can change any goal.' : 'Rows for other people’s goals are fine if you leave them as they are.'}</span></li>
          </ol>
          <input ref={file} type="file" accept=".xlsx,.csv,.tsv,.txt" className="sr" aria-label="Choose a spreadsheet" onChange={(e) => void pick(e.target.files?.[0])} />
          <div className={'dropzone' + (over ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files?.[0]); }}>
            <span className="strong">Drop the workbook here</span>
            <span className="hint">An .xlsx, .csv or tab-separated file. Every change is shown before anything is saved.</span>
            <button type="button" className="btn primary big-btn" onClick={() => file.current?.click()}>Choose a file</button>
          </div>
          {problem && <p className="hint tone-off" role="alert">{problem}</p>}
          <div><Link className="btn ghost edge-ghost" to="/goals">Cancel</Link></div>
        </>
      )}

      {cs && <Preview cs={cs} name={name} reason={reason} setReason={setReason} busy={busy} onApply={() => void apply()} onAgain={() => { setTables(null); setReason(''); if (file.current) file.current.value = ''; setTimeout(() => file.current?.click(), 0); }} />}
    </div>
  );
}

