/* "Measured by" in the goal forms (ML2, docs/design/metrics/spec.md 2.4): the module's part of the goal.measure place on
   New goal's measure step and on Change a goal's "What it is". Find-and-pick for a metric ("No metric" first; metrics in
   the form's unit offered first; "Add “…” as a new metric" last), then what was chosen: its meaning, the unit, decimals
   and direction it fills in (rule 5), and "For": the goal's team or the whole company. What to save goes back to the
   form as one of the module's actions (linkGoalMetric or unlinkGoalMetric), run after the goal. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { MeasurePick, PlaceProps } from '../../core/app';
import { parseNumber } from '../../domain/checkin';
import { PickOne } from '../../ui/Pick';
import { canLinkGoal, DIRECTION_LABEL, linkOf, metricsOf, type Metric, type MetricDirection } from './rules';
import { metricPath } from './rulesLibrary';
import { measureDefaults, measuredBySays, measureFormProblems } from './rulesMeasure';
import './metrics.css';

/** A metric being added in place, from what was typed in the picker. */
interface Adding { name: string; unit: string; direction: MetricDirection | ''; meaning: string }

export function MeasuredBy({ goal, kind, unit, decimals, teamId, untouched, onChange, fill, onNone }: PlaceProps['goal.measure']) {
  const app = useApp();
  const link = goal ? linkOf(app.snapshot, goal.id) : undefined;
  const [metricId, setMetricId] = useState<string | null>(link?.metricId ?? null);
  // "For": the goal's team, or the whole company. A goal already measured keeps the slice it has.
  const [company, setCompany] = useState(link ? link.teamId == null : false);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [addErr, setAddErr] = useState('');
  const [busy, setBusy] = useState(false);
  // What the form held before a metric filled it, so "No metric" gives it back (rule 5); null when nothing was filled.
  const before = useRef<{ unit: string; decimals: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  const metric: Metric | undefined = metricsOf(app.snapshot).find((m) => m.id === metricId);
  const team = app.team(teamId);
  const slice = company || !team ? null : team.id;
  const dp = parseNumber(decimals) ?? 0;
  const problems = metric ? measureFormProblems(metric, { kind, unit, decimals: dp }) : { errors: [], warnings: [] };

  // What to save with the goal, said back to the form whenever the choice, the slice or the form's unit changes.
  useEffect(() => {
    let pick: MeasurePick | undefined;
    if (metric) {
      const same = link && link.metricId === metric.id && link.teamId === slice;
      pick = same ? undefined : {
        action: 'linkGoalMetric', input: (g) => ({ goalId: g.id, metricId: metric.id, teamId: slice }),
        // Check's row is labelled "Measured by" already: its value is the rest of the sentence.
        says: measuredBySays(metric, slice ? team?.name ?? null : null).replace(/^Measured by /, ''), blocks: problems.errors[0],
        metric: { name: metric.name, direction: metric.direction },
      };
    } else if (link) pick = { action: 'unlinkGoalMetric', input: (g) => ({ goalId: g.id }) };
    onChange(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric?.id, slice, problems.errors[0], team?.name]);

  if (kind === 'milestone' || (goal && !canLinkGoal(app.viewer, goal))) return null;

  const choose = (id: string | null) => pickMetric(metricsOf(app.snapshot).find((x) => x.id === id));
  const pickMetric = (m: Metric | undefined) => {
    setMetricId(m?.id ?? null);
    onNone?.(!m);
    if (!fill) return;
    if (m) {
      // A new goal's own unit and decimals (or ones a metric filled and nobody changed since) take the new metric's.
      const d = measureDefaults(m, { isNew: !goal, untouched: !!untouched || hidden, unit, decimals: dp });
      if (d.set) {
        if (!before.current) before.current = { unit, decimals };
        fill({ unit: d.set.unit, decimals: String(d.set.decimals), hidden: true });
        setHidden(true);
      }
    } else if (before.current) {
      // "No metric" after a metric: the fields come back with what they held.
      fill({ ...before.current, hidden: false });
      before.current = null;
      setHidden(false);
    }
  };
  const different = () => {
    if (!metric || !fill) return;
    fill({ unit: metric.unit, decimals: String(metric.decimals), hidden: false });
    before.current = null;
    setHidden(false);
  };

  const addIt = async () => {
    if (!adding || busy) return;
    setBusy(true); setAddErr('');
    try {
      const out = await app.run('saveMetric', { name: adding.name, unit: adding.unit, direction: (adding.direction || undefined) as MetricDirection, meaning: adding.meaning, decimals: dp, ownerId: app.viewer.id }) as { metric: Metric };
      setAdding(null);
      app.toast(`Added ${out.metric.name}. Say more about it on its page when you can.`);
      pickMetric(out.metric);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : 'It couldn’t be added just now.');
    } finally { setBusy(false); }
  };

  // Metrics in the unit the form already has, offered first (find spec, rule 6), when someone typed it.
  const inUnit = !untouched && unit.trim() ? metricsOf(app.snapshot).filter((m) => !m.removedAt && m.unit.trim().toLowerCase() === unit.trim().toLowerCase()).slice(0, 3) : [];

  return (
    <div className="stack measured-by" style={{ gap: 'var(--s2)' }} id="measured-by">
      <PickOne kind="metric" label="Measured by" none="No metric" value={metricId} onChange={choose}
        hint={metric ? undefined : 'A metric says exactly what the number means. Choose one, add one, or say there isn’t one.'}
        first={inUnit.map((m) => ({ id: m.id, note: `in ${m.unit}` }))} invalid={problems.errors.length > 0}
        add={{ label: (q) => `Add “${q}” as a new metric`, onAdd: (q) => { setAddErr(''); setAdding({ name: q, unit: untouched ? '' : unit, direction: '', meaning: '' }); } }} />

      {adding && (
        <div className="metric-add-here stack" role="group" aria-labelledby="metric-add-h" style={{ gap: 'var(--s3)' }}>
          <h3 className="label" id="metric-add-h">A new metric</h3>
          <label className="field"><span className="field-label">Name</span><input className="input" value={adding.name} maxLength={120} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></label>
          <label className="field"><span className="field-label">Unit</span><input className="input" value={adding.unit} maxLength={20} onChange={(e) => setAdding({ ...adding, unit: e.target.value })} /><span className="hint">As it follows a number: hours, %, USD, deploys</span></label>
          <div className="field"><span className="field-label" id="metric-add-dir">Which way is better</span>
            <div className="seg" role="group" aria-labelledby="metric-add-dir">
              {(['lower', 'higher'] as const).map((k) => <button key={k} type="button" aria-pressed={adding.direction === k} onClick={() => setAdding({ ...adding, direction: k })}>{DIRECTION_LABEL[k]}</button>)}
            </div>
          </div>
          <label className="field"><span className="field-label">What it means <span className="hint">optional</span></span><input className="input" value={adding.meaning} maxLength={2000} onChange={(e) => setAdding({ ...adding, meaning: e.target.value })} /></label>
          {addErr && <span className="hint tone-off" role="alert">{addErr}</span>}
          <div className="row"><button type="button" className="btn" disabled={busy} onClick={() => void addIt()}>{busy ? 'Adding…' : 'Add this metric'}</button><button type="button" className="btn ghost" onClick={() => setAdding(null)}>Cancel</button></div>
        </div>
      )}

      {metric && (
        <div className="stack measured-chosen" style={{ gap: 'var(--s2)' }}>
          {metric.meaning
            ? <p className="small measured-meaning">{metric.meaning} <Link to={metricPath(metric)} target="_blank" rel="noopener">Read more</Link></p>
            : <p className="small hint">Its meaning hasn’t been written yet.</p>}
          {hidden && <p className="small">{measureDefaults(metric, { isNew: true, untouched: true, unit, decimals: dp }).line} <button type="button" className="linkish" onClick={different}>Use different ones</button></p>}
          <div className="field"><span className="field-label" id="measured-for">For</span>
            <div className="seg" role="group" aria-labelledby="measured-for">
              {team && <button type="button" aria-pressed={!company} onClick={() => setCompany(false)}>{team.name}</button>}
              <button type="button" aria-pressed={company || !team} onClick={() => setCompany(true)}>The whole company</button>
            </div>
            {!team && <span className="hint">Choose the goal’s team to measure it for that team.</span>}
          </div>
          {problems.errors.map((p) => <span key={p} className="hint tone-off" role="alert">{p}</span>)}
          {problems.warnings.map((p) => <span key={p} className="hint tone-risk" role="status">{p}</span>)}
        </div>
      )}
    </div>
  );
}
