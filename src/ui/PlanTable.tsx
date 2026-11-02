/* The plan as numbers, not just a line: one row per checkpoint with its week, dates and planned value.
   Editable when setting up or changing a goal (the shape fills the defaults; any number can be typed over),
   and read-only on the goal page, with the actual number beside each plan. */
import { useApp } from '../app/state';
import { fmt } from '../domain/format';
import { planAt, planCheckpoints, planEnd, weekDates } from '../domain/plan';
import type { CheckIn, MetricPlan } from '../domain/types';
import { isYear, quarters } from '../domain/year';

interface Numeric { unit: string; decimals: number }

export function PlanTable({ plan, unit, typed, onType, onReset, actuals, label = 'Plan by week' }: {
  /** The plan from the shape, without hand-set numbers (editing), or the saved plan (read-only). */
  plan: MetricPlan;
  unit: Numeric;
  /** Editing: numbers typed by hand, by week. */
  typed?: Record<string, string>;
  onType?: (week: number, value: string) => void;
  onReset?: () => void;
  /** Read-only: check-ins to show beside the plan. */
  actuals?: CheckIn[];
  label?: string;
}) {
  const { cycle, week } = useApp();
  const from = plan.fromWeek ?? 0;
  const end = planEnd(plan, cycle.weeks);
  const rows = planCheckpoints(from, end);
  const editing = !!onType;
  const edited = editing && Object.values(typed ?? {}).some((v) => v.trim() !== '');
  const raw = (v: number) => Number(v.toFixed(unit.decimals)).toString();
  const qEnd = (w: number) => (isYear(cycle) ? quarters(cycle).find((q) => q.to === w && w !== end) : undefined);
  return (
    <div className="plantable">
      <div className="row between">
        <span className="field-label">{label}{end > cycle.weeks ? ` · to week ${end}` : ''}</span>
        {edited && onReset && <button type="button" className="linkish small" onClick={onReset}>Use the shape’s numbers again</button>}
      </div>
      {editing && <span className="hint">Filled in from the shape. Type over any week to set it yourself; the plan then runs straight between the numbers you see.</span>}
      <table>
        <thead><tr><th scope="col">Week</th><th scope="col">Dates</th><th scope="col" className="num">Plan</th>{actuals && <th scope="col" className="num">Actual</th>}</tr></thead>
        <tbody>
          <tr className="muted-row"><td>{from <= 0 ? 'Start' : `Week ${from}`}</td><td>{from > 0 ? weekDates(cycle, from) : ''}</td><td className="num">{fmt(plan.start, unit)}</td>{actuals && <td />}</tr>
          {rows.map((w) => {
            const isEnd = w === end;
            const def = planAt(plan, w, cycle.weeks);
            const hand = typed?.[String(w)] ?? '';
            const actual = actuals?.find((c) => c.week === w)?.value;
            return (
              <tr key={w} className={(w === week ? 'now-row ' : '') + (qEnd(w) ? 'quarter-row ' : '') + (w === cycle.weeks && end > cycle.weeks ? 'cycle-end-row' : '')}>
                <td>{isEnd ? `Week ${w} · target` : `Week ${w}`}{qEnd(w) ? <span className="hint"> · end of {qEnd(w)!.label}</span> : null}{w === week ? <span className="hint"> · now</span> : null}{w === cycle.weeks && end > cycle.weeks ? <span className="hint"> · cycle end</span> : null}</td>
                <td>{weekDates(cycle, w)}</td>
                <td className="num">
                  {editing && !isEnd
                    ? <input className={'input plan-input' + (hand.trim() ? ' edited' : '')} inputMode="decimal" value={hand} placeholder={raw(def)} aria-label={`Plan for week ${w}`} onChange={(e) => onType!(w, e.target.value)} />
                    : <strong>{fmt(isEnd ? plan.target : def, unit)}</strong>}
                </td>
                {actuals && <td className="num">{actual != null ? fmt(actual, unit) : w <= week ? '—' : ''}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
