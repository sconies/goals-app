/* Export (the spreadsheets module): the goals as a workbook (every sheet of the one format, the default), the same sheets
   as zipped CSVs, one table as a CSV, JSON or a brief for an AI chat. Everything in the cycle, or just what's shown.
   It opens from Goals' quiet "Export these goals" (the goals.tools place); everything else about spreadsheets is on
   Data (DataMenu.tsx). */
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../app/state';
import { saveFile, saveFailed, type FileContent } from '../../app/files';
import { andList, SHEETS } from '../../domain/columns';
import { aiBrief, csvFiles, sheetNamed, toCsv, toJson, workbook, type ExportInput } from '../../domain/export';
import type { Goal } from '../../domain/types';
import { Sheet } from '../../ui/bits';

/** Goals' one way out (the goals.tools place): an item in the Views menu, or the phone's View sheet. Import and the rest are on Data. */
export function ExportTheseGoals({ goals, viewName, inMenu }: { goals: Goal[]; viewName: string; inMenu?: boolean }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const item = useRef<HTMLButtonElement>(null);
  if (!app.snapshot.goals.length) return null;
  // It's an item in Goals' Views menu on every width (goals spec, 2.1; GL2), and in the phone's View sheet. The sheet opens in the page, outside the menu, which
  // closes as it opens: the same place as the button's sheet, so it's laid out the same.
  if (inMenu) return (
    <>
      <button type="button" className="menuitem export-these-item" ref={item} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" /></svg>Export these goals
      </button>
      {open && createPortal(<ExportSheet goals={goals} viewName={viewName} onClose={() => setOpen(false)} />, item.current?.closest('.page') ?? document.body)}
    </>
  );
  return (
    <>
      <button type="button" className="btn ghost sm export-these" aria-label="Export these goals" title="Export these goals" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" /></svg><span className="btn-label">Export these goals</span>
      </button>
      {open && <ExportSheet goals={goals} viewName={viewName} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExportSheet({ goals, viewName, onClose }: { goals: Goal[]; viewName: string; onClose: () => void }) {
  const app = useApp();
  const all = app.snapshot.goals;
  const partial = goals.length < all.length;
  // Filtered, the export starts from what's shown; everything is one click away (round 3 review).
  const [scope, setScope] = useState<'all' | 'view'>(partial ? 'view' : 'all');
  const [busy, setBusy] = useState<string | null>(null);
  // One table on its own, as a CSV.
  const [one, setOne] = useState<string>('Goals');
  const input: ExportInput = { ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, goals: scope === 'view' ? goals : undefined };
  // Every file is named the same way: workspace, what it holds, which goals (the view, or the whole cycle), the day.
  const name = (what: string) => ({ workspace: app.ws.name, what, scope: scope === 'view' ? viewName : app.cycle.name, date: app.today });
  const save = (what: string, content: FileContent) => saveFile(name(what), content).then(() => undefined);
  const run = async (key: string, f: () => Promise<void> | void, done: string) => {
    setBusy(key);
    try { await f(); app.toast(done); } catch (e) { app.toast(key === 'md-copy' ? 'Couldn’t copy: ' + (e instanceof Error ? e.message : String(e)) : saveFailed(e), 'error'); }
    setBusy(null);
  };
  const n = scope === 'view' ? goals.length : all.length;
  // The footnote stays at the foot of the sheet; when the sheet scrolls, a line sets it apart from what passes under it.
  const note = useRef<HTMLParagraphElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const box = note.current?.closest<HTMLElement>('.sheet');
    if (!box) return;
    const check = () => setScrolls(box.scrollHeight > box.clientHeight + 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [partial]);
  return (
    <Sheet open onClose={onClose} title="Export goals">
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        {partial && (
          <fieldset className="field">
            <legend className="field-label">Which goals</legend>
            <div className="optlist">
              <label className="opt"><span className="row" style={{ gap: 'var(--s2)' }}><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />Everything in {app.cycle.name}</span><span className="hint">{all.length}</span></label>
              <label className="opt"><span className="row" style={{ gap: 'var(--s2)' }}><input type="radio" name="scope" checked={scope === 'view'} onChange={() => setScope('view')} />What’s shown now: {viewName}</span><span className="hint">{goals.length}</span></label>
            </div>
          </fieldset>
        )}
        {/* Every format the same way: what it is on the left, its buttons in one column on the right. */}
        <div className="optlist export-list">
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">Excel workbook</span><span className="hint">Every sheet: {andList(SHEETS.map((x) => x.name))}, and a first sheet, Start here, that says what each column means and which a new row must have. Edit it and load it back from Data.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" aria-label="Save .xlsx: Excel workbook" disabled={!!busy} onClick={() => void run('xlsx', () => save('goals', { kind: 'xlsx', sheets: workbook(input) }), 'Workbook saved')}>{busy === 'xlsx' ? 'Saving…' : 'Save .xlsx'}</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">CSV files</span><span className="hint">The same sheets as CSVs, one file each with the same headers, in a zip. Or one table on its own. Each loads back like the workbook.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" aria-label="Save .zip: every sheet as a CSV" disabled={!!busy} onClick={() => void run('zip', () => save('goals-csv', { kind: 'zip', files: csvFiles(workbook(input)) }), 'CSV files saved')}>{busy === 'zip' ? 'Saving…' : 'Save .zip'}</button>
              <label className="sr" htmlFor="export-one">One table</label>
              <select id="export-one" className="input sm" value={one} onChange={(e) => setOne(e.target.value)}>{SHEETS.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</select>
              <button type="button" className="btn sm" aria-label={`Save .csv: ${one}`} disabled={!!busy} onClick={() => void run('csv', () => save(one, { kind: 'csv', text: toCsv(sheetNamed(workbook(input), one).rows) }), `${one} saved as CSV`)}>Save .csv</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">JSON</span><span className="hint">Everything, with each goal’s plan and check-ins inside it. For scripts and AI tools.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('json', () => save('goals', { kind: 'json', text: JSON.stringify(toJson(input), null, 2) }), 'JSON saved')}>Save .json</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">Brief for an AI chat</span><span className="hint">A short summary: what’s off and why, every goal by what it feeds, open questions and the weekly numbers.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('md-copy', () => navigator.clipboard.writeText(aiBrief(input)), 'Brief copied. Paste it into any AI chat')}>Copy</button>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('md', () => save('ai-brief', { kind: 'md', text: aiBrief(input) }), 'Brief saved')}>Save .md</button>
            </span>
          </div>
        </div>
        <p ref={note} className={'hint export-note' + (scrolls ? ' scrolls' : '')}>{n} {n === 1 ? 'goal' : 'goals'}, as of week {app.week}. Exports include names and the owners’ reasons, so share them as you would the app.</p>
      </div>
    </Sheet>
  );
}
