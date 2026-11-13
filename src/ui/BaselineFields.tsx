/* The baseline's period and whether it is provisional (BL, domain/baseline), under a number goal's Baseline: the same on
   New goal and Change a goal. Giving the period makes the Baseline a figure of its own, shown as the goal's number until
   its first check-in; Provisional says it may still be firmed up, which then isn't a plan change. New goal shows it
   only once its link on the plan's line is chosen (a step must fit two phone screens); `focus` then puts the cursor in. */
import { BASELINE_PERIOD_MAX } from '../domain/baseline';

export function BaselineFields({ period, provisional, onChange, invalid, focus }: {
  period: string; provisional: boolean; invalid?: boolean; focus?: boolean;
  onChange: (next: { baselinePeriod: string; baselineProvisional: boolean }) => void;
}) {
  const has = period.trim() !== '';
  return (
    <div className="stack" style={{ gap: 'var(--s2)' }}>
      <label className="field">
        <span className="field-label">Period the baseline covers <span className="muted">(optional)</span></span>
        <input className="input" data-field="baselinePeriod" maxLength={BASELINE_PERIOD_MAX + 20} placeholder="e.g. June to September 2026" value={period} aria-invalid={invalid} autoFocus={focus}
          onChange={(e) => onChange({ baselinePeriod: e.target.value, baselineProvisional: e.target.value.trim() ? provisional : false })} />
      </label>
      {has && <label className="check"><input type="checkbox" data-field="baselineProvisional" checked={provisional} onChange={(e) => onChange({ baselinePeriod: period, baselineProvisional: e.target.checked })} /><span>Provisional: it may still be firmed up</span></label>}
      <p className="hint">{has ? 'Shown as the goal’s number until its first check-in.' : 'For a figure you already have: it is then shown until the first check-in.'}</p>
    </div>
  );
}
