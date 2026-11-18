/* Data's filters: the sheet that adds one (the list bar's "Another column": a column, a condition, a value). */
import { useRef, useState } from 'react';
import { FieldError } from '../ui/GoalFields';
import { focusEl } from '../ui/FixSummary';
import { NO_VALUE, OP_LABEL, OPS, SEP, type ColumnKind, type Op, type PropFilter } from '../domain/tableFilter';
import { Sheet } from '../ui/bits';
import { FormFooter } from '../ui/FormFooter';

/** Add or change one filter: a column, a condition that suits it, and a value. */
export function FilterEditor({ head, kinds, values, start, onSave, onClose }: { head: string[]; kinds: Record<string, ColumnKind>; values: (col: string) => string[]; start?: PropFilter; onSave: (f: PropFilter) => void; onClose: () => void }) {
  const [col, setCol] = useState(start?.col ?? head.find((c) => kinds[c] === 'choice') ?? head[0] ?? '');
  const kind = kinds[col] ?? 'text';
  const [op, setOp] = useState<Op>(start?.op ?? OPS[kind][0]!);
  const [value, setValue] = useState(start?.value ?? '');
  const pickCol = (c: string) => { setCol(c); setOp(OPS[kinds[c] ?? 'text'][0]!); setValue(''); };
  const picked = value.split(SEP).filter(Boolean);
  const multi = op === 'is' || op === 'isNot';
  const ready = NO_VALUE.includes(op) || value.trim() !== '';
  const [noValue, setNoValue] = useState(false);
  const valueRef = useRef<HTMLDivElement>(null);
  return (
    <Sheet open onClose={onClose} title={start ? 'Change the filter' : 'Add a filter'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); if (!ready) { setNoValue(true); focusEl(valueRef.current); return; } onSave({ col, op, value: NO_VALUE.includes(op) ? '' : value }); }}>
        <div className="prop-row">
          <label className="field"><span className="field-label">Property</span>
            <select className="input" value={col} onChange={(e) => pickCol(e.target.value)}>{head.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <label className="field"><span className="field-label">Condition</span>
            <select className="input" value={op} onChange={(e) => { const next = e.target.value as Op; if ((next === 'is' || next === 'isNot') !== multi) setValue(''); setOp(next); }}>{OPS[kind].map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select>
          </label>
        </div>
        {/* Pressed with no value: said here and focused (patterns spec 3.3.1), never a disabled button. */}
        {noValue && !ready && <FieldError id="filter-value-err">Choose or type a value first.</FieldError>}
        <div ref={valueRef}>{!NO_VALUE.includes(op) && (multi && kind !== 'number'
          ? (
            <fieldset className="filter-group"><legend className="field-label">Value</legend>
              <span className="filter-options prop-values">{values(col).map((v) => (
                <label key={v} className="check"><input type="checkbox" checked={picked.includes(v)} onChange={() => setValue((picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]).join(SEP))} /> {v}</label>
              ))}</span>
            </fieldset>
          )
          : <label className="field"><span className="field-label">Value</span><input className="input" autoFocus inputMode={kind === 'number' ? 'decimal' : undefined} value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'number' ? 'A number' : 'Some text'} /></label>)}</div>
        <FormFooter sheet>
          <button type="button" className="linkish small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" >{start ? 'Change filter' : 'Add filter'}</button>
        </FormFooter>
      </form>
    </Sheet>
  );
}
