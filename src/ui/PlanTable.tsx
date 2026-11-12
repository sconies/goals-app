/* The plan as numbers, not just a line: one row per checkpoint with its week, dates and planned value.
   Editable when setting up or changing a goal (the shape fills the defaults; any number can be typed over),
   and read-only on the goal page, with the actual number beside each plan. */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { fmt } from '../domain/format';
import { planAt, planCheckpoints, planEnd, weekDates } from '../domain/plan';
import type { CheckIn, MetricPlan } from '../domain/types';
import { isYear, quarters } from '../domain/year';
import { planNote } from '../domain/newGoal';

interface Numeric { unit: string; decimals: number }

/** The unit after a number, as fmt writes it: "90%", "4.0 days". */
const unitAfter = (unit: string) => (!unit ? '' : unit === '%' ? '%' : ' ' + unit);

/** One week's plan number: shows the real number (the shape's, or the one typed), in the goal's decimals. */
function PlanInput({ week, shaped, hand, decimals, onType }: { week: number; shaped: number; hand: string; decimals: number; onType: (week: number, value: string) => void }) {
  const def = shaped.toFixed(decimals);
  const [text, setText] = useState(hand.trim() ? hand : def);
  const focused = useRef(false);
  // A reset, a new shape or new decimals from outside: show them, unless the person is typing here.
  useEffect(() => { if (!focused.current) setText(hand.trim() ? hand : def); }, [hand, def]);
  return (
    <input
      className={'input plan-input' + (hand.trim() ? ' edited' : '')}
      inputMode="decimal"
      value={text}
      aria-label={`Plan for week ${week}`}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; if (!text.trim()) setText(def); }}
      // The shape's own number typed back is not a number set by hand.
      onChange={(e) => { setText(e.target.value); onType(week, e.target.value.trim() === def ? '' : e.target.value); }}
    />
  );
}

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
  // One sentence with this goal's own next quarter end (onboarding spec, rule 5).
  const note = planNote(cycle, week);
  const from = plan.fromWeek ?? 0;
  const end = planEnd(plan, cycle.weeks);
  const rows = planCheckpoints(from, end);
  const editing = !!onType;
  const edited = editing && Object.values(typed ?? {}).some((v) => v.trim() !== '');
  const qEnd = (w: number) => (isYear(cycle) ? quarters(cycle).find((q) => q.to === w && w !== end) : undefined);
  return (
    <div className={'plantable' + (editing ? ' editing' : '')}>
      <div className="row between">
        <span className="field-label">{label}{end > cycle.weeks ? ` · to week ${end}` : ''}</span>
        {edited && onReset && <button type="button" className="linkish small" onClick={onReset}>Use the shape’s numbers again</button>}
      </div>
      {note && <span className="hint">{note}</span>}
      {editing && <span className="hint">Filled in from the shape. Type over any week to set it yourself; the plan then runs straight between the numbers you see.</span>}
      <table>
        <thead><tr><th scope="col">Week</th><th scope="col">Checked in</th><th scope="col" className="num">Plan</th>{actuals && <th scope="col" className="num">Actual</th>}</tr></thead>
        <tbody>
          <tr className="muted-row"><td>{from <= 0 ? 'Start' : `Week ${from}`}</td><td className="pt-date">{from > 0 ? weekDates(cycle, from) : ''}</td><td className="num">{fmt(plan.start, unit)}</td>{actuals && <td />}</tr>
          {rows.map((w) => {
            const isEnd = w === end;
            const def = planAt(plan, w, cycle.weeks);
            const hand = typed?.[String(w)] ?? '';
            const actual = actuals?.find((c) => c.week === w)?.value;
            return (
              <tr key={w} className={(w === week ? 'now-row ' : '') + (qEnd(w) ? 'quarter-row ' : '') + (w === cycle.weeks && end > cycle.weeks ? 'cycle-end-row' : '')}>
                <td><span className="pt-week">{`Week ${w}`}</span>{qEnd(w) ? <span className="hint"> · closes {qEnd(w)!.label} ({qEnd(w)!.months})</span> : null}{w === week ? <span className="hint"> · now</span> : null}{w === cycle.weeks && end > cycle.weeks ? <span className="hint"> · cycle end</span> : null}{editing && hand.trim() && !isEnd ? <span className="hint"> · set by you</span> : null}</td>
                <td className="pt-date">{weekDates(cycle, w)}</td>
                <td className="num">
                  {editing && !isEnd
                    ? <span className="plan-cell"><PlanInput week={w} shaped={def} hand={hand} decimals={unit.decimals} onType={onType!} />{unit.unit && <span className="plan-unit">{unitAfter(unit.unit).trim()}</span>}</span>
                    : <strong>{isEnd ? 'Target ' + fmt(plan.target, unit) : fmt(def, unit)}</strong>}
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
