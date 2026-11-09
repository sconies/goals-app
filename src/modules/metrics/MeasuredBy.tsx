/* "Measured by" in New goal and goal edit (the goal.measure place): pick a metric from the library, those in the goal's
   unit first, or create one in place; pick the slice (the goal's team, or the whole company); see the link's problems as
   you go. The form saves the pick straight after the goal (src/core/app.tsx). The rules are src/domain/metrics.ts. */
import { useState } from 'react';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { newId } from '../../data/store';
import { canLinkGoal, COMPANY, DIRECTION_LABEL, linkProblems, liveMetrics, measureOf, metricFrom, metricProblems, sliceName } from '../../domain/metrics';
import type { Goal, MetricDirection } from '../../domain/types';
import { FieldError } from '../../ui/GoalFields';

const NEW = '__new';

export function MeasuredBy({ goal, kind, unit, teamId, onChange }: PlaceProps['goal.measure']) {
  const app = useApp();
  const now = goal ? measureOf(app.snapshot, goal) : null;
  const [metricId, setMetricId] = useState(now?.metric.id ?? '');
  const [slice, setSlice] = useState<string | null>(now ? now.link.teamId : teamId || null);
  const [draft, setDraft] = useState<{ name: string; unit: string; direction: MetricDirection | '' }>({ name: '', unit, direction: '' });
  const [tried, setTried] = useState(false);
  if (kind === 'milestone') return null;
  if (goal && !canLinkGoal(app.viewer, goal)) return null;

  const u = unit.trim().toLowerCase();
  const all = liveMetrics(app.snapshot);
  const metrics = [...all.filter((m) => m.unit.trim().toLowerCase() === u), ...all.filter((m) => m.unit.trim().toLowerCase() !== u)];
  const picked = all.find((m) => m.id === metricId);
  // The goal as typed: a new one has only its kind and unit so far, so only the unit can be checked yet.
  const asTyped = (goal ? { ...goal, unit } : { kind: 'metric', unit, decimals: 0, plan: { start: 0, target: 0 } }) as Goal;
  const problems = picked ? linkProblems(asTyped, picked) : { errors: [] as string[], warnings: [] as string[] };
  const say = (id: string, s: string | null) => {
    const m = all.find((v) => v.id === id);
    if (!id) onChange(now ? null : undefined);
    else if (m && !linkProblems(asTyped, m).errors.length) onChange({ metricId: id, teamId: s });
    else onChange(undefined);
  };
  const choose = (id: string) => { setMetricId(id); if (id !== NEW) say(id, slice); else onChange(undefined); };
  const chooseSlice = (s: string | null) => { setSlice(s); say(metricId === NEW ? '' : metricId, s); };

  const newProblems = metricProblems(metricFrom({ name: draft.name, unit: draft.unit, direction: (draft.direction || undefined) as MetricDirection }, null, { actor: app.viewer, now: app.stamp(), newId }), app.snapshot);
  const create = async () => {
    setTried(true);
    if (newProblems.length) return;
    try {
      const id = await app.saveMetric({ name: draft.name, unit: draft.unit, direction: draft.direction as MetricDirection });
      app.toast(`Added ${draft.name.trim()} to the metrics`);
      setTried(false);
      setDraft({ name: '', unit, direction: '' });
      setMetricId(id);
      onChange({ metricId: id, teamId: slice });
    } catch { /* the rule's message is shown; the form stays open */ }
  };

  return (
    <div className="field measured-by">
      <label className="field"><span className="field-label">Measured by <span className="muted" style={{ fontWeight: 400 }}>· optional</span></span>
        <select className="input" value={metricId} onChange={(e) => choose(e.target.value)}>
          <option value="">No metric</option>
          {metrics.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
          <option value={NEW}>Create a new metric…</option>
        </select>
        <span className="hint">A metric from the library says exactly what the number means, so every goal on it reads it the same way.</span>
      </label>
      {picked?.meaning && <p className="small muted">{picked.meaning}</p>}
      {metricId === NEW && (
        <div className="stack measured-new" role="group" aria-label="New metric">
          <label className="field"><span className="field-label">Metric name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Deploy frequency" />
          </label>
          <label className="field"><span className="field-label">Metric unit</span>
            <input className="input" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          </label>
          <div className="field"><span className="field-label" id="mb-dir">Which way is better</span>
            <div className="seg" role="group" aria-labelledby="mb-dir">
              {(['higher', 'lower'] as const).map((v) => <button key={v} type="button" aria-pressed={draft.direction === v} onClick={() => setDraft({ ...draft, direction: v })}>{DIRECTION_LABEL[v]}</button>)}
            </div>
          </div>
          {tried && newProblems.map((p) => <FieldError key={p}>{p}</FieldError>)}
          <div><button type="button" className="btn" onClick={() => void create()}>Add this metric</button></div>
          <span className="hint">More about it (its meaning, source and owner) can be added later on Data, Metrics.</span>
        </div>
      )}
      {picked && (
        <div className="field"><span className="field-label" id="mb-slice">For</span>
          <div className="seg" role="group" aria-labelledby="mb-slice">
            {[...new Set([teamId, slice].filter((t): t is string => !!t))].map((t) => <button key={t} type="button" aria-pressed={slice === t} onClick={() => chooseSlice(t)}>{sliceName(app.snapshot, t)}</button>)}
            <button type="button" aria-pressed={slice === null} onClick={() => chooseSlice(null)}>{COMPANY}</button>
          </div>
        </div>
      )}
      {problems.errors.map((p) => <FieldError key={p}>{p}</FieldError>)}
      {problems.warnings.map((p) => <span key={p} className="hint tone-risk" role="status">{p}</span>)}
    </div>
  );
}
