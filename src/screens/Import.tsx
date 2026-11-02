/* Load changes from a spreadsheet: goals, plan numbers and check-ins, including past weeks.
   Every row is checked with the app's own rules and shown before anything is saved; then all of it saves, or none. */
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { downloadWorkbook, readChanges } from '../app/spreadsheet';
import { describe, type ChangeSet, type Item, type Tables } from '../domain/changeset';
import { workbook } from '../domain/export';

export function Import() {
  const app = useApp();
  const nav = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<Tables | null>(null);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const cs = useMemo(() => (tables ? app.previewChanges(tables, 'spreadsheet', reason) : null), [tables, reason, app]);

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
  const template = () => downloadWorkbook(workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today }), `${app.ws.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-goals-to-edit.xlsx`);

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Load changes from a spreadsheet</h1>
        <span className="hint">Add or change goals, set plan numbers, or add check-ins, including past weeks. You’ll see every change before anything is saved.</span>
      </div>

      {!cs && (
        <>
          <ol className="steps-list">
            <li><span className="strong">Download the workbook.</span> It has every goal in {app.cycle.name}, its plan by week and its check-ins, with an ID on each goal.
              <div><button type="button" className="btn sm" onClick={() => void template()}>Download the workbook</button></div></li>
            <li><span className="strong">Change it in Excel.</span> Edit cells, add rows for new goals (leave ID empty) or past weeks on the Check-ins sheet. The README sheet explains each column.</li>
            <li><span className="strong">Load it here.</span> {app.viewer.admin ? 'As an admin you can change any goal.' : 'You can change the goals you own.'}</li>
          </ol>
          <input ref={file} type="file" accept=".xlsx,.csv,.tsv,.txt" className="sr" aria-label="Choose a spreadsheet" onChange={(e) => void pick(e.target.files?.[0])} />
          <div className="foot-row"><Link className="btn ghost big-btn" to="/goals">Cancel</Link><button type="button" className="btn primary big-btn" onClick={() => file.current?.click()}>Choose a file</button></div>
          {problem && <p className="hint tone-off" role="alert">{problem}</p>}
        </>
      )}

      {cs && <Preview cs={cs} name={name} reason={reason} setReason={setReason} busy={busy} onApply={() => void apply()} onAgain={() => { setTables(null); setReason(''); if (file.current) file.current.value = ''; }} />}
    </div>
  );
}

function Preview({ cs, name, reason, setReason, busy, onApply, onAgain }: { cs: ChangeSet; name: string; reason: string; setReason: (s: string) => void; busy: boolean; onApply: () => void; onAgain: () => void }) {
  const errors = cs.issues.filter((i) => i.severity === 'error');
  const warnings = cs.issues.filter((i) => i.severity === 'warning');
  const groups = new Map<string, Item[]>();
  for (const it of cs.items) groups.set(it.goal, [...(groups.get(it.goal) ?? []), it]);
  const total = cs.items.length;
  return (
    <>
      <section className="block">
        <span className="hint">{name}</span>
        <p className="lede">{total ? describe(cs) + '.' : 'Nothing in this file changes anything.'}{cs.unchanged ? ` ${cs.unchanged} ${cs.unchanged === 1 ? 'row is' : 'rows are'} the same as now.` : ''}</p>
      </section>

      {errors.length > 0 && (
        <section className="block problems" aria-label="Problems to fix">
          <h2 className="block-title tone-off">{errors.length} {errors.length === 1 ? 'row needs' : 'rows need'} fixing first</h2>
          <p className="hint">Nothing is saved until every row is right. Fix these in the file, then load it again.</p>
          <ul className="issue-list">{errors.map((x, i) => <li key={i}><span className="label">{x.sheet}, row {x.row}{x.goal ? ` · ${x.goal}` : ''}</span><span>{x.message}</span></li>)}</ul>
        </section>
      )}

      {cs.items.some((x) => x.needsReason) && (
        <label className="field">
          <span className="field-label">Why are these plans changing?</span>
          <span className="hint">Check-ins have started on {cs.items.filter((x) => x.needsReason).length === 1 ? 'this goal' : 'these goals'}, so the change log keeps the reason with the old and new plan. A Reason column in the file is used first.</span>
          <textarea className={'input' + (cs.needsReason ? ' invalid' : '')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}

      {warnings.length > 0 && (
        <section className="block">
          <h2 className="block-title tone-risk">Check before saving</h2>
          <ul className="issue-list">{warnings.map((x, i) => <li key={i}><span className="label">{x.sheet}, row {x.row}{x.goal ? ` · ${x.goal}` : ''}</span><span>{x.message}</span></li>)}</ul>
        </section>
      )}

      {total > 0 && (
        <section className="block">
          <h2 className="block-title">What will change <span className="hint">· {total}</span></h2>
          <div className="glist">
            {[...groups].map(([goal, list]) => (
              <details key={goal} className="change-goal">
                <summary><span className="strong">{goal}</span><span className="hint">{list.map((x) => KIND[x.kind] + (x.backfilled ? ' (past week)' : '')).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · {list.length}</span></summary>
                <ul className="changes">
                  {list.map((x, i) => (
                    <li key={i} className="stack" style={{ gap: 2 }}>
                      <span className="small strong">{x.summary}</span>
                      {x.diffs.filter((d) => d.field !== 'Via').map((d) => <span key={d.field} className="small"><span className="muted">{d.field}:</span> {d.from !== '—' ? <><s>{d.from}</s> → </> : null}{d.to}</span>)}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="foot-row">
        <button type="button" className="btn ghost big-btn" onClick={onAgain}>Choose another file</button>
        <button type="button" className="btn primary big-btn" disabled={!cs.commit || busy} onClick={onApply}>{busy ? 'Saving…' : total ? `Save ${total} ${total === 1 ? 'change' : 'changes'}` : 'Nothing to save'}</button>
      </div>
      {!cs.commit && total > 0 && <p className="hint" role="status">{errors.length ? 'Fix the rows above to save.' : cs.needsReason ? 'Say why the plans are changing to save.' : ''}</p>}
    </>
  );
}

const KIND: Record<Item['kind'], string> = { 'new goal': 'New goal', goal: 'Details', plan: 'Plan', 'check-in': 'Check-in', 'replaces check-in': 'Replaces a check-in' };
