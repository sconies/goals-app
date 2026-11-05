/* What a change set will do before it's saved: its problems, a reason when plans change, every change by goal, and Save.
   Import and Data both use it, so a change looks the same whichever way it comes in. */
import { useRef, useState } from 'react';
import { useApp } from '../app/state';
import { describe, type ChangeSet, type Item } from '../domain/changeset';
import { fmt } from '../domain/format';
import { planAt } from '../domain/plan';
import type { Diff, Goal } from '../domain/types';
import { Icon } from './Icon';

/** What a change set will do, its problems, and Save. Used by Import and Data. */
export function Preview({ cs, name, reason, setReason, busy, onApply, onAgain, againLabel = 'Choose another file', fixHint = 'Fix these in the file, then load it again.' }: { cs: ChangeSet; name: string; reason: string; setReason: (s: string) => void; busy: boolean; onApply: () => void; onAgain: () => void; againLabel?: string; fixHint?: string }) {
  const app = useApp();
  // The reason field is only marked once someone tries to save without it.
  const [tried, setTried] = useState(false);
  const why = useRef<HTMLTextAreaElement>(null);
  const errors = cs.issues.filter((i) => i.severity === 'error');
  const warnings = cs.issues.filter((i) => i.severity === 'warning');
  const groups = new Map<string, Item[]>();
  for (const it of cs.items) groups.set(it.goal, [...(groups.get(it.goal) ?? []), it]);
  const total = cs.items.length;
  // Only a missing reason stands in the way: Save stays pressable and says what's missing.
  const onlyReason = !cs.commit && !errors.length && cs.needsReason && total > 0;
  const save = () => { if (onlyReason) { setTried(true); why.current?.focus(); } else onApply(); };
  return (
    <div className="change-review">
      <section className="block">
        <span className="hint">{name}</span>
        <p className="lede">{total ? describe(cs) + '.' : errors.length ? `${errors.length} ${errors.length === 1 ? 'row has' : 'rows have'} a problem, so the file can’t be checked yet. Nothing has been saved.` : 'Nothing in this file changes anything.'}{cs.unchanged ? ` ${cs.unchanged} ${cs.unchanged === 1 ? 'row is' : 'rows are'} the same as now.` : ''}</p>
      </section>

      {errors.length > 0 && (
        <section className="block problems" aria-label="Problems to fix">
          <h2 className="block-title tone-off">{errors.length} {errors.length === 1 ? 'row needs' : 'rows need'} fixing first</h2>
          <p className="hint">Nothing is saved until every row is right. {fixHint}</p>
          <ul className="issue-list">{errors.map((x, i) => <li key={i}><span className="label">{x.sheet}, row {x.row}{x.goal ? ` · ${x.goal}` : ''}</span><span>{x.message}</span></li>)}</ul>
        </section>
      )}

      {cs.items.some((x) => x.needsReason) && (
        <label className="field">
          <span className="field-label">Why are these plans changing?</span>
          <span className="hint">Say why to save: check-ins have started on {cs.items.filter((x) => x.needsReason).length === 1 ? 'this goal' : 'these goals'}, so the change log keeps the reason with the old and new plan. A Reason column in the file is used first.</span>
          <textarea ref={why} className={'input' + (tried && cs.needsReason ? ' invalid' : '')} aria-invalid={tried && cs.needsReason ? true : undefined} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}

      {warnings.length > 0 && (
        <section className="block">
          <h2 className="block-title tone-risk">Check before saving</h2>
          <ul className="issue-list">{warnings.map((x, i) => <li key={i}><span className="label">{x.sheet}, row {x.row}{x.goal ? ` · ${x.goal}` : ''}</span><span>{x.message}</span></li>)}</ul>
        </section>
      )}

      {total > 0 && (
        <section className="block">
          <h2 className="block-title">What will change <span className="hint">· {total}</span></h2>
          <div className="glist">
            {[...groups].map(([goal, list]) => (
              <details key={goal} className="change-goal">
                <summary><Icon name="chevron-right" className="change-chev" /><span className="strong">{goal}</span><span className="hint">{list.map((x) => KIND[x.kind] + (x.backfilled ? ' (past week)' : '')).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · {list.length}</span></summary>
                <ul className="changes">
                  {list.map((x, i) => (
                    <li key={i} className="stack" style={{ gap: 2 }}>
                      <span className="small strong">{x.summary}</span>
                      {x.diffs.filter((d) => d.field !== 'Via').map((d) => (d.field === 'Plan numbers' && planWeeks(d.to).length
                        ? <PlanDiff key={d.field} d={d} goal={app.goal(x.goalId)} weeks={app.cycle.weeks} />
                        : <span key={d.field} className="small"><span className="muted">{d.field}:</span> {d.from !== '—' ? <><s>{d.from}</s> → </> : null}{d.to}</span>))}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}

      {!cs.commit && total > 0 && <p className={'hint preview-hint' + (tried && onlyReason ? ' tone-off' : '')} role="status">{errors.length ? 'Fix the rows above to save.' : cs.needsReason ? 'Say why the plans are changing to save.' : ''}</p>}
      <div className="foot-row import-foot">
        <button type="button" className="btn big-btn preview-again" onClick={onAgain}>{againLabel}</button>
        <button type="button" className="btn primary big-btn" disabled={(!cs.commit && !onlyReason) || busy} aria-disabled={onlyReason || undefined} onClick={save}>{busy ? 'Saving…' : total ? `Save ${total} ${total === 1 ? 'change' : 'changes'}` : 'Nothing to save'}</button>
      </div>
    </div>
  );
}

/** "wk 3: 12, wk 4: 14" as weeks and values. */
const planWeeks = (s: string) => [...s.matchAll(/wk (\d+): ([^,]+)/g)].map((m) => ({ week: Number(m[1]), value: m[2]!.trim() }));

/** A plan change as a table: each week whose number changes, what it was and what it will be. */
function PlanDiff({ d, goal, weeks }: { d: Diff; goal?: Goal; weeks: number }) {
  const was = new Map(planWeeks(d.from).map((x) => [x.week, x.value]));
  const rows = planWeeks(d.to).map((x) => ({ ...x, was: was.get(x.week) ?? (goal?.kind === 'metric' ? fmt(planAt(goal.plan, x.week, weeks), goal) : '—') })).filter((x) => x.was !== x.value);
  if (!rows.length) return null;
  return (
    <div className="plan-diff">
      <span className="small"><span className="muted">Plan numbers:</span> {rows.length} {rows.length === 1 ? 'week changes' : 'weeks change'}</span>
      <div className="plan-diff-scroll">
        <table className="plan-diff-table">
          <thead><tr><th scope="col" className="num">Week</th><th scope="col" className="num">Was</th><th scope="col" className="num">Now</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.week}><td className="num">{x.week}</td><td className="num">{x.was}</td><td className="num">{x.value}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

const KIND: Record<Item['kind'], string> = { 'new goal': 'New goal', goal: 'Details', plan: 'Plan', 'check-in': 'Check-in', 'replaces check-in': 'Replaces a check-in', person: 'Person' };
