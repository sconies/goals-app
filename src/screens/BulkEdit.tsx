/* Bulk actions on the goals ticked in the table: change their owner or level, or watch them. Changes go through the
   bulk-change engine, so the same rules, rights and change log apply as for Import and Data. Exporting is Goals' own
   "Export these goals" (the spreadsheets module), which starts from what's shown. */
import { LEVEL_WORDS } from '../domain/levels';
import { useState } from 'react';
import { useApp } from '../app/state';
import { describe, type ChangeSet } from '../domain/changeset';
import { levelIds, levelName } from '../domain/levels';
import type { Goal, Level } from '../domain/types';
import { PickOne } from '../ui/Pick';
import { Sheet } from '../ui/bits';
import { MenuButton } from '../ui/MenuButton';

export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const app = useApp();
  const [sheet, setSheet] = useState<'owner' | 'level' | null>(null);
  const goals = ids.map((id) => app.goal(id)).filter((g): g is Goal => !!g);
  const watch = async () => {
    for (const g of goals) await app.watch('goal', g.id);
    app.toast(`Watching ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`);
  };
  return (
    <div className="selbar" role="region" aria-label="Selected goals">
      <span className="strong selbar-count">{goals.length} selected</span>
      {/* Wide enough, each action is a button; on a phone they share one Actions menu, so the bar stays one row. */}
      <span className="selbar-actions">
        <button type="button" className="btn sm" onClick={() => setSheet('owner')}>Change owner</button>
        <button type="button" className="btn sm" onClick={() => setSheet('level')}>Change level</button>
        <button type="button" className="btn sm" onClick={() => void watch()}>Watch</button>
      </span>
      <MenuButton className="selbar-menu" label="Actions" summary="" items={[
        { label: 'Change owner', onClick: () => setSheet('owner') },
        { label: 'Change level', onClick: () => setSheet('level') },
        { label: 'Watch', onClick: () => void watch() },
      ]} />
      <button type="button" className="btn ghost sm" onClick={onClear}>Clear</button>
      {(sheet === 'owner' || sheet === 'level') && <BulkSheet kind={sheet} goals={goals} onClose={() => setSheet(null)} onDone={onClear} />}
    </div>
  );
}

function BulkSheet({ kind, goals, onClose, onDone }: { kind: 'owner' | 'level'; goals: Goal[]; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const [value, setValue] = useState('');
  const [cs, setCs] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const levels: Level[] = levelIds(app.cycle);
  const save = async () => {
    if (!value) return;
    // The owner goes by their ID, so two people with the same name can't be confused.
    const res = app.previewChanges({ goals: goals.map((g, i) => ({ __row: String(i + 2), id: g.id, ...(kind === 'owner' ? { 'owner id': value } : { level: LEVEL_WORDS.word[value] ?? value }) })) }, 'bulk');
    setCs(res);
    if (!res.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(res);
      app.toast(`Saved: ${describe(res).toLowerCase()}`);
      onDone();
      onClose();
    } catch { setBusy(false); }
  };
  const errors = cs?.issues.filter((x) => x.severity === 'error') ?? [];
  return (
    <Sheet open onClose={onClose} title={`${kind === 'owner' ? 'Change the owner of' : 'Change the level of'} ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {kind === 'owner' ? (
          <PickOne kind="person" label="New owner" value={value || null} onChange={(id) => { setValue(id ?? ''); setCs(null); }} />
        ) : (
          <label className="field"><span className="field-label">Level</span>
            <select className="input" value={value} onChange={(e) => { setValue(e.target.value); setCs(null); }}>
              <option value="">Choose…</option>
              {levels.map((l) => <option key={l} value={l}>{levelName(app.cycle, l)}</option>)}
            </select>
          </label>
        )}
        <span className="hint">{app.viewer.admin ? 'As an admin you can change any goal.' : 'You can change the goals you own. Leave others out of the selection.'} Each change is logged on its goal.</span>
        {errors.length > 0 && (
          <ul className="issue-list" role="alert">{errors.map((x, i) => <li key={i}><span className="label">{x.goal}</span><span>{x.message}</span></li>)}</ul>
        )}
        {cs && !cs.items.length && !errors.length && <span className="hint" role="status">Nothing changes: they already have that {kind}.</span>}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={!value || busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Sheet>
  );
}
