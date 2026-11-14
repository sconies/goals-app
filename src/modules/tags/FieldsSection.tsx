/* Workspace → Fields (TG1, docs/design/round-4/tags/spec.md 2.1): the workspace's own fields on goals, in their order.
   Admins add, rename, reorder, retire and bring back a field; everyone else reads them. Each row says the field's name,
   its kind ("A list: Discover, Build, Run" or "Free text") and how many of this cycle's goals have a value. "Add a field"
   is the page's one primary action. Every change goes through the module's actions (actions.ts), and so through its
   rules. Loaded when the section is first opened, never with the first download. */
import { useState } from 'react';
import { useApp } from '../../app/state';
import { SectionHead } from '../../screens/Workspace';
import { EmptyResult, Sheet } from '../../ui/bits';
import { FixLine } from '../../ui/Levels';
import { fieldsOf, goalsWith, kindWords, liveFields, type SavedField } from './fields';
import { FIELD_LIMITS, fieldProblem, type GoalField } from './rules';
import './tags.css';

const goalsSaid = (n: number) => (n === 0 ? 'No goal has a value' : n === 1 ? '1 goal has a value' : `${n} goals have a value`);

export function FieldsSection() {
  const app = useApp();
  const admin = app.viewer.admin;
  const s = app.full ?? app.snapshot;
  const live = liveFields(s);
  const retired = fieldsOf(s).filter((f) => f.retiredAt);
  const ids = new Set(app.snapshot.goals.filter((g) => !g.removedAt).map((g) => g.id));
  const [editing, setEditing] = useState<SavedField | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const full = live.length >= FIELD_LIMITS.fields;
  const act = async (name: string, input: unknown) => {
    setBusy(true);
    try { await app.run(name, input); } catch { /* the rule's message is shown */ } finally { setBusy(false); }
  };
  const add = admin && live.length > 0
    ? <button type="button" className="btn primary" disabled={full} onClick={() => setEditing('new')}>Add a field</button>
    : null;
  return (
    <>
      <SectionHead id="fields" action={add}>
        Fields a team tracks that Faro has no column for, such as a stage or a programme. {admin ? `Up to ${FIELD_LIMITS.fields}.` : 'Admins add and change them.'}
      </SectionHead>
      {admin && full && <p className="hint">This workspace has {FIELD_LIMITS.fields} fields, the most it can have. Retire one to add another.</p>}
      {!live.length ? (
        <EmptyResult title="No fields yet" action={admin ? <button type="button" className="btn" onClick={() => setEditing('new')}>Add a field</button> : undefined}>
          Add one when a team tracks something Faro has no column for, such as a stage or a programme. It isn’t read by any rule: it’s for finding and sorting.
        </EmptyResult>
      ) : (
        <section className="block" aria-label="Fields">
          <ul className="removed-list fields-list" aria-label="Fields">
            {live.map((f, i) => (
              <li key={f.id} className="removed-row field-row">
                <span className="removed-text">
                  <span className="removed-name">{f.name}</span>
                  <span className="small">{kindWords(f)}</span>
                  <span className="hint">{goalsSaid(goalsWith(s, f.id, ids))}</span>
                </span>
                {admin && (
                  <span className="team-actions">
                    <button type="button" className="btn sm ghost" disabled={busy || i === 0} onClick={() => void act('moveField', { fieldId: f.id, by: -1 })} aria-label={`Move ${f.name} up`}>Up</button>
                    <button type="button" className="btn sm ghost" disabled={busy || i === live.length - 1} onClick={() => void act('moveField', { fieldId: f.id, by: 1 })} aria-label={`Move ${f.name} down`}>Down</button>
                    <button type="button" className="btn sm" onClick={() => setEditing(f)} aria-label={`Change ${f.name}`}>Change</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {retired.length > 0 && (
        <section className="block" aria-labelledby="fields-retired">
          <h3 className="label" id="fields-retired">Retired</h3>
          <p className="hint">Goals keep their values, and History its changes. A field brought back shows them again.</p>
          <ul className="removed-list fields-list" aria-labelledby="fields-retired">
            {retired.map((f) => (
              <li key={f.id} className="removed-row field-row">
                <span className="removed-text">
                  <span className="removed-name">{f.name}</span>
                  <span className="small">{kindWords(f)}</span>
                  <span className="hint">{goalsSaid(goalsWith(s, f.id, ids))}</span>
                </span>
                {admin && <span className="team-actions"><button type="button" className="btn sm" disabled={busy || full} onClick={() => void act('bringBackField', { fieldId: f.id })} aria-label={`Bring ${f.name} back`}>Bring back</button></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && <FieldSheet field={editing === 'new' ? null : editing} fields={fieldsOf(s)} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Add a field, or change one: its name and a list's values, one per line. Changing one also offers Retire. */
function FieldSheet({ field, fields, onClose }: { field: SavedField | null; fields: SavedField[]; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState(field?.name ?? '');
  const [kind, setKind] = useState<GoalField['kind']>(field?.kind ?? 'list');
  const [values, setValues] = useState((field?.options ?? []).join('\n'));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const options = kind === 'list' ? values.split('\n').map((v) => v.trim()).filter(Boolean) : [];
  // The module's rule, as the action will run it: said under the form once Save is pressed.
  const problem = fieldProblem({ id: field?.id ?? 'new', name, kind, options, retiredAt: null }, fields);
  const save = async () => {
    setTried(true);
    if (problem || busy) return;
    setBusy(true);
    try {
      if (field) await app.run('changeField', { fieldId: field.id, name, options });
      else await app.run('addField', { name, kind, options });
      app.toast(field ? `${name.trim()} saved` : `${name.trim()} added`, 'success');
      onClose();
    } catch { setBusy(false); }
  };
  const retire = async () => {
    setBusy(true);
    try { await app.run('retireField', { fieldId: field!.id }); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={field ? `Change ${field.name}` : 'Add a field'}>
      <form className="stack field-sheet" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} maxLength={FIELD_LIMITS.name + 10} placeholder="Stage" onChange={(e) => setName(e.target.value)} />
        </label>
        {!field ? (
          <fieldset className="field">
            <legend className="field-label">Kind</legend>
            <label className="check"><input type="radio" name="field-kind" checked={kind === 'list'} onChange={() => setKind('list')} /> A list of values</label>
            <label className="check"><input type="radio" name="field-kind" checked={kind === 'text'} onChange={() => setKind('text')} /> Free text</label>
          </fieldset>
        ) : <p className="small">{field.kind === 'list' ? 'A list of values.' : 'Free text, up to 80 characters on each goal.'}</p>}
        {kind === 'list' && (
          <label className="field">
            <span className="field-label">Values</span>
            <span className="hint">One per line, in the order they’re offered. Up to {FIELD_LIMITS.values}.{field ? ' Goals keep the value they have.' : ''}</span>
            <textarea rows={5} value={values} onChange={(e) => setValues(e.target.value)} placeholder={'Discover\nBuild\nRun'} />
          </label>
        )}
        {tried && problem && <FixLine>{problem}</FixLine>}
        <div className="foot-row">
          {field && <button type="button" className="btn ghost big-btn" disabled={busy} onClick={() => void retire()}>Retire it</button>}
          <button type="submit" className="btn primary big-btn" disabled={busy}>{field ? 'Save changes' : 'Add the field'}</button>
        </div>
        {field && <p className="hint">Retiring keeps every goal’s value and its History. It can be brought back.</p>}
      </form>
    </Sheet>
  );
}
