/* The one form that adds and changes a metric (backlog 0b): the Metrics page uses it whole, and "Measured by" uses it to
   make one in place. Required first (name, unit, which way is better), then the optional definition. The rule's own
   messages (domain/metrics metricProblems) show once someone has tried to save; the save itself checks them again. */
import { useState } from 'react';
import { useApp } from '../../app/state';
import { DIRECTION_LABEL, METRIC_LIMITS, REFRESHES, REFRESH_LABEL, metricFrom, metricProblems, type MetricInput } from '../../domain/metrics';
import type { Metric, MetricDirection, MetricRefresh } from '../../domain/types';

interface Draft { name: string; unit: string; direction: MetricDirection | ''; meaning: string; decimals: string; source: string; sourceOwner: string; refresh: MetricRefresh | ''; ownerId: string; caveats: string }

const draftOf = (m: Metric | null, viewerId: string, unit = ''): Draft => ({
  name: m?.name ?? '', unit: m?.unit ?? unit, direction: m?.direction ?? '', meaning: m?.meaning ?? '', decimals: String(m?.decimals ?? 0),
  source: m?.source ?? '', sourceOwner: m?.sourceOwner ?? '', refresh: m?.refresh ?? '', ownerId: m?.ownerId ?? viewerId, caveats: m?.caveats ?? '',
});

const inputOf = (d: Draft): MetricInput => ({
  name: d.name, unit: d.unit, direction: (d.direction || undefined) as MetricDirection, meaning: d.meaning,
  decimals: d.decimals.trim() === '' ? 0 : Number(d.decimals), source: d.source, sourceOwner: d.sourceOwner,
  refresh: d.refresh || null, ownerId: d.ownerId, caveats: d.caveats,
});

/**
 * Add a metric (`metric` null) or change one. `compact` keeps to the required fields with the rest behind "More about
 * it" (making one in place on a goal). Calls `onSaved(id)` once saved; `onCancel` closes it.
 */
export function MetricForm({ metric, unit, compact, onSaved, onCancel }: { metric: Metric | null; unit?: string; compact?: boolean; onSaved: (id: string) => void; onCancel: () => void }) {
  const app = useApp();
  const [d, setD] = useState<Draft>(() => draftOf(metric, app.viewer.id, unit));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(!compact);
  const set = (p: Partial<Draft>) => setD((v) => ({ ...v, ...p }));
  const problems = metricProblems(metricFrom(inputOf(d), metric, { actor: app.viewer, now: app.stamp(), newId: () => 'new-metric' }), app.snapshot);
  const people = app.snapshot.people.filter((p) => !p.leftAt || p.id === metric?.ownerId);
  const id = metric?.id ?? 'new';

  const save = async () => {
    setTried(true);
    if (problems.length || saving) return;
    setSaving(true);
    try {
      const out = await app.saveMetric({ ...inputOf(d), ...(metric ? { id: metric.id } : {}) });
      onSaved(out);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="metric-form" role="group" aria-label={metric ? `Change ${metric.name}` : 'New metric'}>
      <label className="field"><span className="field-label">Name</span>
        <input className="input" value={d.name} maxLength={METRIC_LIMITS.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Change failure rate" />
      </label>
      <div className="metric-form-pair">
        <label className="field"><span className="field-label">Unit</span>
          <input className="input" value={d.unit} maxLength={METRIC_LIMITS.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%, min, deploys…" />
        </label>
        <label className="field"><span className="field-label">Which way is better</span>
          <select className="input" value={d.direction} onChange={(e) => set({ direction: e.target.value as MetricDirection | '' })}>
            <option value="">Choose…</option>
            {(['higher', 'lower'] as const).map((v) => <option key={v} value={v}>{DIRECTION_LABEL[v]}</option>)}
          </select>
        </label>
      </div>
      {!more && <button type="button" className="linkish small" onClick={() => setMore(true)}>More about it (optional)</button>}
      {more && (
        <>
          <label className="field"><span className="field-label">What it means and how it’s worked out <span className="muted">· optional</span></span>
            <textarea className="input" rows={3} value={d.meaning} onChange={(e) => set({ meaning: e.target.value })} placeholder="What counts, over what period, and anything left out" />
          </label>
          <div className="metric-form-pair">
            <label className="field"><span className="field-label">Decimals <span className="muted">· optional</span></span>
              <input className="input" inputMode="numeric" value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} />
            </label>
            <label className="field"><span className="field-label">Refreshed <span className="muted">· optional</span></span>
              <select className="input" value={d.refresh} onChange={(e) => set({ refresh: e.target.value as MetricRefresh | '' })}>
                <option value="">Not said</option>
                {REFRESHES.map((r) => <option key={r} value={r}>{REFRESH_LABEL[r]}</option>)}
              </select>
            </label>
          </div>
          <div className="metric-form-pair">
            <label className="field"><span className="field-label">Source <span className="muted">· optional</span></span>
              <input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Deploy pipeline" />
            </label>
            <label className="field"><span className="field-label">Who owns the source <span className="muted">· optional</span></span>
              <input className="input" value={d.sourceOwner} onChange={(e) => set({ sourceOwner: e.target.value })} placeholder="A person or team" />
            </label>
          </div>
          <label className="field"><span className="field-label">Owner of the definition</span>
            <select className="input" value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              {people.map((p) => <option key={p.id} value={p.id}>{app.personName(p.id)}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Caveats <span className="muted">· optional</span></span>
            <textarea className="input" rows={2} value={d.caveats} onChange={(e) => set({ caveats: e.target.value })} placeholder="What to watch out for when reading it" />
          </label>
        </>
      )}
      {tried && problems.length > 0 && <div role="alert" id={`metric-problems-${id}`}><ul className="metric-problems small tone-off">{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>}
      <div className="metric-form-actions">
        <button type="button" className={compact ? 'btn' : 'btn primary'} onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : metric ? 'Save the metric' : 'Add the metric'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
