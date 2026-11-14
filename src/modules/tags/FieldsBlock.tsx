/* A goal's Fields block (TG1, docs/design/round-4/tags/spec.md 2.2), in About after its facts (the goal.sections place):
   one line per live field, "Stage · Build" or "Stage · Not set". The goal's owner or an admin changes one in place: a
   select for a list, a text field of up to 80 characters for free text. The change goes through setGoalFields, and
   History says "Stage: Discover → Build". No reason is asked: a field is not the plan. Nothing shows while the
   workspace has no field. Loaded with the goal's About, never with the first download. */
import { useState } from 'react';
import type { PlaceProps } from '../../core/app';
import { useApp } from '../../app/state';
import { canSetFields, liveFields, valueOf, type SavedField } from './fields';
import { FIELD_LIMITS } from './rules';
import './tags.css';

export function FieldsBlock({ goal }: PlaceProps['goal.sections']) {
  const app = useApp();
  const s = app.full ?? app.snapshot;
  const fields = liveFields(s);
  const [open, setOpen] = useState<string | null>(null);
  if (!fields.length) return null;
  const may = canSetFields(app.viewer, goal) && !goal.stoppedAt;
  return (
    <section className="stack fields-block" aria-labelledby="g-fields" data-part="Fields">
      <h3 className="label" id="g-fields">Fields</h3>
      <ul className="fields-lines">
        {fields.map((f) => {
          const v = valueOf(s, goal.id, f.id);
          return (
            <li key={f.id} className="fields-line">
              {open === f.id
                ? <FieldEdit field={f} value={v} goalId={goal.id} onDone={() => setOpen(null)} />
                : <>
                    <span><span className="fields-name">{f.name}</span> · {v ? <span>{v}</span> : <span className="muted">Not set</span>}</span>
                    {may && <button type="button" className="linkish small" onClick={() => setOpen(f.id)} aria-label={`Change ${f.name}`}>Change</button>}
                  </>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One field changed in place: a select saves as soon as a value is chosen; free text saves with Save (or Enter). */
function FieldEdit({ field: f, value, goalId, onDone }: { field: SavedField; value: string; goalId: string; onDone: () => void }) {
  const app = useApp();
  const [typed, setTyped] = useState(value);
  const [busy, setBusy] = useState(false);
  const save = async (v: string) => {
    if (busy) return;
    if (v.trim() === value) { onDone(); return; }
    setBusy(true);
    try { await app.run('setGoalFields', { goalId, values: { [f.id]: v } }); onDone(); } catch { setBusy(false); }
  };
  // A value the list no longer offers (its values changed since) is kept, and offered, until it is changed.
  const choices = f.kind === 'list' ? (value && !f.options.includes(value) ? [...f.options, value] : f.options) : [];
  return f.kind === 'list' ? (
    <span className="fields-edit">
      <label className="fields-edit">
        <span className="fields-name">{f.name}</span>
        <select autoFocus disabled={busy} value={value} onChange={(e) => void save(e.target.value)}>
          <option value="">Not set</option>
            {choices.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <button type="button" className="btn sm ghost" disabled={busy} onClick={onDone}>Cancel</button>
    </span>
  ) : (
    <form className="fields-edit" onSubmit={(e) => { e.preventDefault(); void save(typed); }}>
      <label className="fields-edit">
        <span className="fields-name">{f.name}</span>
        <input autoFocus maxLength={FIELD_LIMITS.value} value={typed} disabled={busy} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }} />
      </label>
      <button type="submit" className="btn sm" disabled={busy}>Save</button>
      <button type="button" className="btn sm ghost" disabled={busy} onClick={onDone}>Cancel</button>
    </form>
  );
}
