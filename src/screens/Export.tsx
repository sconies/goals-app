/* Export: the goals as a workbook, CSV, JSON or a brief for an AI chat. Everything in the cycle, or just what's shown. */
import { useState } from 'react';
import { useApp } from '../app/state';
import { downloadText, downloadWorkbook } from '../app/spreadsheet';
import { aiBrief, toCsv, toJson, workbook, type ExportInput } from '../domain/export';
import type { Goal } from '../domain/types';
import { Sheet } from '../ui/bits';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'goals';

export function ExportButton({ goals, viewName }: { goals: Goal[]; viewName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" /></svg><span className="btn-label">Export</span>
      </button>
      {open && <ExportSheet goals={goals} viewName={viewName} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportSheet({ goals, viewName, onClose }: { goals: Goal[]; viewName: string; onClose: () => void }) {
  const app = useApp();
  const all = app.snapshot.goals;
  const partial = goals.length < all.length;
  const [scope, setScope] = useState<'all' | 'view'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const input: ExportInput = { ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, goals: scope === 'view' ? goals : undefined };
  const base = `${slug(app.ws.name)}-${slug(app.cycle.name)}${scope === 'view' ? '-' + slug(viewName) : ''}-${app.today.toISOString().slice(0, 10)}`;
  const run = async (key: string, f: () => Promise<void> | void, done: string) => {
    setBusy(key);
    try { await f(); app.toast(done); } catch (e) { app.toast('Couldn’t export: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
    setBusy(null);
  };
  const n = scope === 'view' ? goals.length : all.length;
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
            <span className="stack" style={{ gap: 2 }}><span className="strong">Excel workbook</span><span className="hint">Goals, the plan by week, every check-in, notes and actions, and people. You can edit it and load it back.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" aria-label="Save .xlsx: Excel workbook" disabled={!!busy} onClick={() => void run('xlsx', () => downloadWorkbook(workbook(input), base + '.xlsx'), 'Workbook saved')}>{busy === 'xlsx' ? 'Saving…' : 'Save .xlsx'}</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">CSV</span><span className="hint">One table per file, for other tools.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('csv-g', () => downloadText(toCsv(workbook(input)[0]!.rows), base + '-goals.csv', 'text/csv;charset=utf-8'), 'Goals saved as CSV')}>Goals</button>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('csv-c', () => downloadText(toCsv(workbook(input)[2]!.rows), base + '-check-ins.csv', 'text/csv;charset=utf-8'), 'Check-ins saved as CSV')}>Check-ins</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">JSON</span><span className="hint">Everything, with each goal’s plan and check-ins inside it. For scripts and AI tools.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('json', () => downloadText(JSON.stringify(toJson(input), null, 2), base + '.json', 'application/json'), 'JSON saved')}>Save .json</button>
            </span>
          </div>
          <div className="opt static">
            <span className="stack" style={{ gap: 2 }}><span className="strong">Brief for an AI chat</span><span className="hint">A short summary: what’s off and why, every goal by what it feeds, open questions and the weekly numbers.</span></span>
            <span className="export-actions">
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('md-copy', () => navigator.clipboard.writeText(aiBrief(input)), 'Brief copied. Paste it into any AI chat')}>Copy</button>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => void run('md', () => downloadText(aiBrief(input), base + '.md', 'text/markdown;charset=utf-8'), 'Brief saved')}>Save .md</button>
            </span>
          </div>
        </div>
        <p className="hint">{n} {n === 1 ? 'goal' : 'goals'}, as of week {app.week}. Exports include names and the owners’ reasons, so share them as you would the app.</p>
      </div>
    </Sheet>
  );
}
