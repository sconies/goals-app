/* "Measured by" in New goal and goal edit (the goal.measure place, backlog 0b): pick the metric that measures the goal,
   or make one in place, and the slice it's for (the goal's team, or the whole company). Those in the form's unit come
   first. The rule's errors and warnings (domain/metrics linkProblems) show under the field as you pick; the form saves
   the pick straight after the goal. Once the goal has check-ins, changing or removing its metric asks why, as a plan
   change does (linkNeedsReason). Not offered for goals with dated stages, or to someone who can't link the goal. */
import { useEffect, useState } from 'react';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { MIN_REASON } from '../../domain/checkin';
import { COMPANY, DIRECTION_LABEL, canLinkGoal, findMetric, linkNeedsReason, linkProblems, liveMetrics, measureOf } from '../../domain/metrics';
import type { Goal } from '../../domain/types';
import { MetricForm } from './MetricForm';

const SHOWN = 6;

export function MeasuredBy({ goal, kind, unit, teamId, onChange }: PlaceProps['goal.measure']) {
  const app = useApp();
  const current = goal ? measureOf(app.snapshot, goal) : null;
  const [metricId, setMetricId] = useState<string>(current?.metric.id ?? '');
  const [company, setCompany] = useState<boolean>(current ? current.link.teamId == null : false);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(false);

  const sliceTeam = company ? null : current && metricId === current.metric.id && current.link.teamId != null ? current.link.teamId : teamId || null;
  const changed = current ? metricId !== current.metric.id || sliceTeam !== current.link.teamId : metricId !== '';
  const askWhy = !!goal && !!current && changed && linkNeedsReason(app.snapshot, goal);

  useEffect(() => {
    if (!changed) onChange(undefined);
    else if (metricId === '') onChange({ metricId: null, teamId: null, ...(askWhy ? { reason: reason.trim() } : {}) });
    else onChange({ metricId, teamId: sliceTeam, ...(askWhy ? { reason: reason.trim() } : {}) });
    // onChange is the form's setter; the pick is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId, sliceTeam, reason, changed, askWhy]);

  if (kind === 'milestone') return null;
  if (goal && !canLinkGoal(app.viewer, goal)) {
    return current ? <div className="field measured-by"><span className="field-label">Measured by</span><span>{current.metric.name} · {current.slice}</span><span className="hint">Only the goal’s owner or an admin can change it.</span></div> : null;
  }

  const picked = metricId ? findMetric(app.snapshot, metricId) : undefined;
  const u = unit.trim().toLowerCase();
  const needle = q.trim().toLowerCase();
  const all = liveMetrics(app.snapshot);
  const ordered = [...all.filter((m) => m.unit.trim().toLowerCase() === u), ...all.filter((m) => m.unit.trim().toLowerCase() !== u)];
  const list = (needle ? ordered.filter((m) => m.name.toLowerCase().includes(needle)) : ordered).slice(0, SHOWN);
  // A new goal has no plan yet: check the unit (and the rest, once there is a goal) with the rule itself.
  const asGoal = (goal ? { ...goal, kind, unit } : { kind, unit, decimals: 0, plan: { start: 0, target: 0 }, range: { bound: 'atMost' } }) as Goal;
  const problems = picked ? linkProblems(asGoal, picked) : { errors: [], warnings: [] };
  const team = teamId ? app.team(teamId) : undefined;

  return (
    <div className="field measured-by" role="group" aria-label="Measured by">
      <span className="field-label">Measured by <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
      {picked ? (
        <div className="measured-pick">
          <span><span className="strong">{picked.name}</span><span className="muted"> · {picked.unit} · {DIRECTION_LABEL[picked.direction]}</span></span>
          <button type="button" className="linkish small" onClick={() => setMetricId('')}>{current && picked.id === current.metric.id ? 'Remove' : 'Choose another'}</button>
        </div>
      ) : making ? (
        <MetricForm metric={null} unit={unit} compact onSaved={(id) => { setMaking(false); setMetricId(id); }} onCancel={() => setMaking(false)} />
      ) : (
        <>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the metrics by name" aria-label="Search the metrics by name" />
          {list.length > 0 && (
            <ul className="measured-list">
              {list.map((m) => (
                <li key={m.id}><button type="button" className="measured-option" onClick={() => { setMetricId(m.id); setQ(''); }}>
                  <span className="strong">{m.name}</span><span className="muted small"> · {m.unit} · {DIRECTION_LABEL[m.direction]}</span>
                </button></li>
              ))}
            </ul>
          )}
          {needle && list.length === 0 && <span className="hint">No metric’s name has “{q.trim()}” in it.</span>}
          <button type="button" className="linkish small" onClick={() => setMaking(true)}>Add a new metric</button>
        </>
      )}
      {picked && (
        <div className="measured-slice" role="radiogroup" aria-label="For">
          <span className="small muted">For</span>
          {team && <label className="small"><input type="radio" name="measure-slice" checked={!company} onChange={() => setCompany(false)} /> {app.team(sliceTeam ?? teamId)?.name ?? team.name}</label>}
          <label className="small"><input type="radio" name="measure-slice" checked={company || !team} onChange={() => setCompany(true)} /> {COMPANY}</label>
        </div>
      )}
      {problems.errors.map((e) => <span key={e} className="hint tone-off" role="alert">{e}</span>)}
      {problems.warnings.map((w) => <span key={w} className="hint tone-risk" role="status">{w}</span>)}
      {askWhy && (
        <label className="field reason-field">
          <span className="field-label">Why change what measures it?</span>
          <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The team now reads it from the new pipeline" aria-label="Why change what measures it?" />
          <span className="hint">{reason.trim().length >= MIN_REASON ? 'It goes in the goal’s activity for everyone watching.' : 'This goal has check-ins, so say why, in a sentence, as for a plan change.'}</span>
        </label>
      )}
    </div>
  );
}
