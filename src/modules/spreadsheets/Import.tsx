/* Import (the spreadsheets module, at /data/import; old /import links come here; backlog IM5, import spec 2.1): the way
   in. A file dropped or chosen, or rows pasted from a spreadsheet (?paste=1 opens the box); the template to start from
   nothing and the workbook to change what's here; what a new row must have, from the field table; and the newest past
   imports. Every row is checked with the app's own rules and shown before anything is saved (the preview, Check.tsx). */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import { fieldTable, isFillIn, requiredLine, specOf, type FillKind } from '../../domain/columns';
import { workbook } from '../../domain/export';
import { importCounts, importName, pastImports } from '../../domain/removal';
import { BackLink } from '../../ui/BackLink';
import { MenuButton } from '../../ui/MenuButton';
import { whenText } from '../../ui/ChangeItem';
import { saveTemplate } from './template';
import { limitLine } from '../../domain/importLimits';
import { MODULE_SHEETS } from '../../core/records';
import { chooseFile, choosePaste } from './Check';
import { importStore } from './importStore';
import './import.css';

/** The fill-in headers of a sheet, tab-separated: what "Copy the Goals headers" puts on the clipboard. */
const headersOf = (kind: FillKind) => fieldTable(kind).filter(isFillIn).map((c) => c.header).filter((h) => h !== 'Week N').join('\t');
/** Up to three admins by name, then "or another admin". */
function adminsWho(names: string[]): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en-GB'));
  if (sorted.length <= 3) return sorted.length < 2 ? sorted.join('') : `${sorted.slice(0, -1).join(', ')} or ${sorted[sorted.length - 1]}`;
  return `${sorted.slice(0, 3).join(', ')} or another admin`;
}

export function Import() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [stopped] = useState(() => importStore.get().stopped);
  const lost = !!(useLocation().state as { lost?: boolean } | null)?.lost && !stopped;
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<{ text: string; template?: boolean; headers?: boolean } | null>(null);
  const [pasted, setPasted] = useState('');
  const pasting = params.get('paste') === '1';
  // Import is the way in: a file read before (saved, or left) is forgotten here, answers and all.
  useEffect(() => importStore.reset(), []);

  // A file read goes to the preview (/data/import/check); a new file starts afresh (answers to the last one still apply).
  const pick = async (f: File | undefined) => {
    setProblem(null);
    if (await chooseFile(f, (text, template) => setProblem({ text, template }))) nav('/data/import/check');
  };
  const paste = () => {
    setProblem(null);
    if (choosePaste(pasted, (text) => setProblem({ text, headers: true }))) nav('/data/import/check');
  };
  // The same file as Export's "Everything", by the same name and with the same toast (spec 2.9; #248 review).
  const workbookFile = () => saveAndSay(app.toast, { workspace: app.ws.name, what: 'goals', scope: 'all', date: app.today }, { kind: 'xlsx', sheets: workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, sheets: MODULE_SHEETS }) }, (f) => `Exported ${f}`);
  const copy = (kind: FillKind) => {
    void navigator.clipboard?.writeText(headersOf(kind)).then(() => app.toast(`Copied the ${specOf(kind).name} headers`), () => app.toast('Copying didn’t work here. The template has the headers.', 'error'));
  };
  const copyMenu = <MenuButton className="import-copy" label="Copy the Goals headers" summary="" items={(['goals', 'checkIns', 'people'] as FillKind[]).map((k) => ({ label: specOf(k).name, onClick: () => copy(k) }))} />;
  const past = pastImports(app.snapshot.changes);
  const admins = app.snapshot.people.filter((p) => p.admin && !p.leftAt).map((p) => p.name);

  return (
    <div className="page narrow import-page">
      <BackLink />
      <div className="page-head">
        <h1 className="title-xl">Import</h1>
        <span className="hint">Add or change goals, plans, check-ins and people from a spreadsheet. You see every change before anything is saved, and one Undo takes a whole import back.</span>
        {!app.viewer.admin && <span className="hint">You can add and change your own goals and their check-ins. Rows for other people’s goals are fine if you leave them as they are. {adminsWho(admins)} can change anyone’s, and add people.</span>}
      </div>

      {lost && <p className="hint" role="status">Choose the file again: nothing was saved.</p>}
      {stopped && <p className="hint" role="status">Stopped. Nothing was saved.</p>}
      {/* Reached by Choose a file, not by Tab (it is 1 px); emptied once read, so the same file can be chosen again after
          a problem is fixed (IM5 review). */}
      <input ref={file} type="file" accept=".xlsx,.zip,.csv,.tsv,.txt" className="sr" tabIndex={-1} aria-label="Choose a spreadsheet" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f); }} />
      {pasting ? (
        <section className="stack import-paste" aria-labelledby="paste-h">
          <label className="field"><span className="field-label" id="paste-h">Paste rows from a spreadsheet</span>
            <textarea className="input" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} autoFocus />
          </label>
          <span className="hint">Copy the cells in Excel or Sheets, the header row included, and paste them here. {copyMenu}</span>
          <div className="import-fix-actions">
            <button type="button" className="btn primary big-btn" disabled={!pasted.trim()} onClick={paste}>Check these rows</button>
            <button type="button" className="linkish tap" onClick={() => { setParams({}, { replace: true }); setProblem(null); }}>Or choose a file</button>
          </div>
        </section>
      ) : (
        <div className={'dropzone' + (over ? ' over' : '')} role="group" aria-label="Drop a file here, or choose one"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files?.[0]); }}>
          <span className="strong">Drop a file here</span>
          <span className="hint">An Excel workbook (.xlsx), a .csv, or a .zip of CSVs. {limitLine()}</span>
          <button type="button" className="btn primary big-btn" onClick={() => file.current?.click()}>Choose a file</button>
          <button type="button" className="linkish tap" onClick={() => { setParams({ paste: '1' }, { replace: true }); setProblem(null); }}>or paste rows from a spreadsheet</button>
        </div>
      )}
      {problem && (
        // A div, not a paragraph: Copy the headers is a menu (IM5 review).
        <div className="hint tone-off import-problem" role="alert">{problem.text}
          {problem.template && <> <button type="button" className="linkish tap" onClick={() => void saveTemplate(app)}>Download the template</button></>}
          {problem.headers && <> {copyMenu}</>}
        </div>
      )}

      <div className="import-starts">
        <section className="stack" aria-labelledby="start-nothing">
          <h2 className="h3" id="start-nothing">Starting from nothing</h2>
          <span className="hint">The template has every column, says which are required, and carries two example rows that are never imported.</span>
          <div><button type="button" className="btn" onClick={() => void saveTemplate(app)}>Download the template</button></div>
        </section>
        <section className="stack import-workbook" aria-labelledby="start-here">
          <h2 className="h3" id="start-here">Changing what’s here</h2>
          <span className="hint">The workbook is every goal, plan, check-in and person as they are now. Change cells, add rows, load it back.</span>
          <div><button type="button" className="btn" onClick={() => void workbookFile()}>Download the workbook</button></div>
        </section>
      </div>

      {/* What a new row must have, from the field table (domain/columns, rule 2). */}
      <section className="stack" aria-labelledby="import-needs" style={{ gap: 'var(--s2)' }}>
        <h2 className="h2" id="import-needs">What a new row must have</h2>
        <ul className="help-points">
          <li><span className="strong">A goal</span>: {requiredLine('goals')}</li>
          <li><span className="strong">A check-in</span>: {requiredLine('checkIns')}</li>
          <li><span className="strong">A person</span>: {requiredLine('people')}</li>
        </ul>
        <span className="hint"><Link className="import-link" to="/help/columns">Every column, with its format and an example</Link></span>
      </section>

      {past.length > 0 && (
        <section className="stack" aria-labelledby="import-past" style={{ gap: 'var(--s2)' }}>
          <h2 className="h2" id="import-past">Past imports</h2>
          <ul className="removed-list">
            {past.slice(0, 3).map(({ entry, undone }) => (
              <li key={entry.id} className="removed-row">
                <span className="removed-text">
                  <Link className="removed-name linkish" to={`/data/import/done/${entry.entityId}`}>{importName(entry)}</Link>
                  <span className="small muted">{app.person(entry.actorId)?.name ?? 'Someone'} · {whenText(entry.at, app.today)} · {importCounts(entry)}{undone ? ' · Undone' : ''}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link className="small import-link" to="/data/imports">{past.length === 1 ? 'Open Past imports' : `All ${past.length} past imports`}</Link>
        </section>
      )}
    </div>
  );
}
