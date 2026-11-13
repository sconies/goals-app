/* Export (the spreadsheets module; import spec 2.9): one sheet, one button. The Excel workbook (every sheet of the one
   format) is the primary; the other formats (zipped CSVs, one sheet as a CSV, JSON, a brief for an AI chat) are behind
   "Other formats". Everything in the cycle, or just what's shown. It opens from Goals' "Export these goals" (the
   goals.tools place, ExportButton.tsx) and from Data's Export menu, "Everything…" (DataMenu.tsx). */
import { useMemo, useState } from 'react';
import { useApp } from '../../app/state';
import { fileName, saveFile, saveFailed, type FileContent } from '../../app/files';
import { sheetNamesWith } from '../../domain/columns';
import { MODULE_SHEETS } from '../../core/records';
import { aiBrief, csvFiles, everythingCounts, sheetNamed, toCsv, toJson, workbook, type ExportInput } from '../../domain/export';
import type { Goal } from '../../domain/types';
import { Sheet } from '../../ui/bits';

/** Every sheet's name after Start here: the core's, then each module's (the metric library's Metrics). */
const SHEET_NAMES = sheetNamesWith(MODULE_SHEETS).slice(1);

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export function ExportSheet({ goals, viewName, onClose }: { goals: Goal[]; viewName: string; onClose: () => void }) {
  const app = useApp();
  const all = app.snapshot.goals;
  const partial = goals.length < all.length;
  // Filtered, the export starts from what's shown; everything is one click away (round 3 review).
  const [scope, setScope] = useState<'all' | 'view'>(partial ? 'view' : 'all');
  const [busy, setBusy] = useState<string | null>(null);
  const [others, setOthers] = useState(false);
  // One table on its own, as a CSV.
  const [one, setOne] = useState<string>('Goals');
  const input: ExportInput = { ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, goals: scope === 'view' ? goals : undefined, sheets: MODULE_SHEETS };
  // Every file is named the same way (spec 2.9): workspace, what it holds, which goals (`all` or the view's name), the day.
  // `all` means everything: a filtered All tab is `as-shown`, never `all`.
  const which = viewName && viewName.trim().toLowerCase() !== 'all' ? viewName : 'as-shown';
  const name = (what: string) => ({ workspace: app.ws.name, what, scope: scope === 'view' ? which : 'all', date: app.today });
  const save = (what: string, content: FileContent) => saveFile(name(what), content);
  const run = async (key: string, f: () => Promise<string | void> | void, done?: string) => {
    setBusy(key);
    try { const file = await f(); app.toast(done ?? `Exported ${file}`); } catch (e) { app.toast(key === 'md-copy' ? 'Couldn’t copy: ' + (e instanceof Error ? e.message : String(e)) : saveFailed(e), 'error'); }
    setBusy(null);
  };
  // What "Everything" holds, row for row as the workbook writes it: stopped and proposed goals too.
  const whole = useMemo(() => everythingCounts(app.snapshot), [app.snapshot]);
  const xlsx = fileName(name('goals'), 'xlsx');
  return (
    <Sheet open onClose={onClose} title="Export">
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        {partial && (
          <fieldset className="field">
            <legend className="field-label">Which goals</legend>
            <div className="optlist">
              <label className="opt"><span className="row" style={{ gap: 'var(--s2)' }}><input type="radio" name="scope" checked={scope === 'view'} onChange={() => setScope('view')} />The {goals.length.toLocaleString('en-GB')} shown now: {viewName}</span></label>
              <label className="opt"><span className="stack" style={{ gap: 2 }}><span className="row" style={{ gap: 'var(--s2)' }}><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />Everything in {app.cycle.name}</span><span className="hint export-counts">{count(whole.goals, 'goal', 'goals')}, {count(whole.checkIns, 'check-in', 'check-ins')}, {count(whole.people, 'person', 'people')}</span></span></label>
            </div>
          </fieldset>
        )}
        <p>An Excel workbook: Goals, Plan, Check-ins and People, which load back, and Results, Asks, Notes and Metrics for reading. Its first sheet says what each column means and which are required.</p>
        <div>
          <button type="button" className="linkish tap export-others" aria-expanded={others} onClick={() => setOthers(!others)}>{others ? 'Fewer formats' : 'Other formats'}</button>
        </div>
        {/* Every other format the same way: what it is on the left, its buttons on the right. */}
        {others && (
          <div className="optlist export-list">
            <div className="opt static">
              <span className="stack" style={{ gap: 2 }}><span className="strong">CSV files, zipped</span><span className="hint">The same sheets, one CSV each with the same headers. Each loads back like the workbook.</span></span>
              <span className="export-actions">
                <button type="button" className="btn sm" aria-label="Save .zip: every sheet as a CSV" disabled={!!busy} onClick={() => void run('zip', () => save('goals-csv', { kind: 'zip', files: csvFiles(workbook(input)) }))}>{busy === 'zip' ? 'Saving…' : 'Save .zip'}</button>
              </span>
            </div>
            <div className="opt static">
              <span className="stack" style={{ gap: 2 }}><span className="strong">One sheet as CSV</span>
                <span className="row" style={{ gap: 'var(--s2)' }}><label className="hint" htmlFor="export-one">Sheet</label>
                  <select id="export-one" className="input sm" value={one} onChange={(e) => setOne(e.target.value)}>{SHEET_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}</select></span></span>
              <span className="export-actions">
                <button type="button" className="btn sm" aria-label={`Save .csv: ${one}`} disabled={!!busy} onClick={() => void run('csv', () => save(one, { kind: 'csv', text: toCsv(sheetNamed(workbook(input), one).rows) }))}>Save .csv</button>
              </span>
            </div>
            <div className="opt static">
              <span className="stack" style={{ gap: 2 }}><span className="strong">JSON</span><span className="hint">Everything, with each goal’s plan and check-ins inside it. For scripts and AI tools.</span></span>
              <span className="export-actions">
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('json', () => save('goals', { kind: 'json', text: JSON.stringify(toJson(input), null, 2) }))}>Save .json</button>
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
        )}
      </div>
      <div className="sheet-foot export-foot">
        <button type="button" className="btn primary" disabled={!!busy} onClick={() => void run('xlsx', () => save('goals', { kind: 'xlsx', sheets: workbook(input) }))}>{busy === 'xlsx' ? 'Exporting…' : 'Export .xlsx'}</button>
        <p className="hint export-note"><span className="export-file">{xlsx}</span>. Exports hold names and owners’ reasons. Share them as you would the app.</p>
      </div>
    </Sheet>
  );
}
