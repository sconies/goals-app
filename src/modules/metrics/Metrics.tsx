/* The Metrics page under Data (the metrics module, at /data/metrics): every metric in the library, with its unit, which
   way is better, its owner, how many goals it measures and which teams use it, searchable by name. The same route adds
   (?new), shows (?m=<id>) and edits (?m=<id>&edit) one, so there is one Help article for all of it. The rules are in
   src/domain/metrics.ts; this page only calls them. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../../app/state';
import { newId } from '../../data/store';
import {
  canEditMetric, DIRECTION_LABEL, findMetric, goalsMeasuredBy, liveMetrics, METRIC_LIMITS, metricFrom, metricProblems, REFRESH_LABEL, REFRESHES, sliceName,
  type MetricInput,
} from '../../domain/metrics';
import type { Metric, MetricDirection, MetricRefresh, Snapshot } from '../../domain/types';
import { BackLink } from '../../ui/BackLink';
import { FieldError } from '../../ui/GoalFields';
import './metrics.css';

/** Which teams use a metric: each link's slice, a company-wide link counting as the whole company. */
export function slicesUsing(s: Snapshot, metricId: string): string[] {
  const goals = new Set(goalsMeasuredBy(s, metricId).map((g) => g.id));
  const names = (s.metricLinks ?? []).filter((l) => l.metricId === metricId && !l.removedAt && goals.has(l.goalId)).map((l) => sliceName(s, l.teamId));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export function Metrics() {
  const app = useApp();
  const [params] = useSearchParams();
  const id = params.get('m');
  const metric = id ? findMetric(app.snapshot, id) : undefined;
  if (params.has('new')) return <MetricForm before={null} />;
  if (metric && params.has('edit') && canEditMetric(app.viewer, metric)) return <MetricForm before={metric} />;
  if (metric) return <MetricPage metric={metric} />;
  return <MetricList />;
}

function MetricList() {
  const app = useApp();
  const [q, setQ] = useState('');
  const all = liveMetrics(app.snapshot);
  const shown = all.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="page narrow metrics-page">
      <BackLink to="/data" label="Data" />
      <div className="page-head row">
        <div className="stack">
          <h1 className="title-xl">Metrics</h1>
          <p className="muted">Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing.</p>
        </div>
        <Link className="btn primary" to="/data/metrics?new">Add a metric</Link>
      </div>
      <label className="field"><span className="sr">Search metrics by name</span>
        <input className="input" type="search" placeholder="Search metrics by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <p className="hint" role="status">{q.trim() ? `${shown.length} of ${all.length} metrics` : `${all.length} ${all.length === 1 ? 'metric' : 'metrics'}`}</p>
      {shown.length === 0 ? (
        <p className="muted">{all.length ? 'No metric has that name.' : 'No metrics yet. Add the first one.'}</p>
      ) : (
        <ul className="metric-rows" aria-label="Metrics">
          {shown.map((m) => {
            const n = goalsMeasuredBy(app.snapshot, m.id).length;
            const teams = slicesUsing(app.snapshot, m.id);
            return (
              <li key={m.id} className="metric-row">
                <Link className="metric-name strong" to={'/data/metrics?m=' + encodeURIComponent(m.id)}>{m.name}</Link>
                <span className="small muted">{m.unit} · {DIRECTION_LABEL[m.direction]} · {app.person(m.ownerId)?.name ?? 'No owner'} · {n === 0 ? 'No goals' : `${n} ${n === 1 ? 'goal' : 'goals'}`}</span>
                {teams.length > 0 && <span className="small">Used by {teams.join(', ')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MetricPage({ metric: m }: { metric: Metric }) {
  const app = useApp();
  const goals = goalsMeasuredBy(app.snapshot, m.id);
  const teams = slicesUsing(app.snapshot, m.id);
  const can = canEditMetric(app.viewer, m);
  const rows: [string, string][] = [
    ['What it means and how it’s calculated', m.meaning || 'Not described yet'],
    ['Unit', m.unit],
    ['Decimals', String(m.decimals)],
    ['Which way is better', DIRECTION_LABEL[m.direction]],
    ['Source', m.source || '—'],
    ['Source’s owner', m.sourceOwner || '—'],
    ['Refresh', m.refresh ? REFRESH_LABEL[m.refresh] : '—'],
    ['Owner', app.person(m.ownerId)?.name ?? '—'],
    ['Caveats', m.caveats || '—'],
  ];
  return (
    <div className="page narrow metrics-page">
      <BackLink to="/data/metrics" label="Metrics" />
      <div className="page-head row">
        <div className="stack"><h1 className="title-xl">{m.name}</h1></div>
        {can && <Link className="btn primary" to={'/data/metrics?m=' + encodeURIComponent(m.id) + '&edit'}>Edit</Link>}
      </div>
      <dl className="metric-facts">
        {rows.map(([k, v]) => <div key={k}><dt className="field-label">{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <section className="block" aria-labelledby="mt-goals">
        <h2 className="block-title" id="mt-goals">Goals it measures</h2>
        <p className="small muted">{teams.length ? `Used by ${teams.join(', ')}` : 'No team uses it yet.'}</p>
        {goals.length > 0 && (
          <ul className="metric-rows">
            {goals.map((g) => <li key={g.id} className="metric-row"><Link to={'/goals/' + g.id}>{g.title}</Link></li>)}
          </ul>
        )}
      </section>
      {can && (
        <p><button type="button" className="btn danger" onClick={() => void app.removeMetric(m.id).catch(() => undefined)}>Remove this metric</button></p>
      )}
      {!can && <p className="hint">Only {app.person(m.ownerId)?.name ?? 'its owner'} or an admin can change it.</p>}
    </div>
  );
}

type Draft = { name: string; meaning: string; unit: string; decimals: string; direction: MetricDirection | ''; source: string; sourceOwner: string; refresh: MetricRefresh | ''; ownerId: string; caveats: string };

function MetricForm({ before }: { before: Metric | null }) {
  const app = useApp();
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(() => ({
    name: before?.name ?? '', meaning: before?.meaning ?? '', unit: before?.unit ?? '', decimals: String(before?.decimals ?? 0),
    direction: before?.direction ?? '', source: before?.source ?? '', sourceOwner: before?.sourceOwner ?? '', refresh: before?.refresh ?? '',
    ownerId: before?.ownerId ?? app.viewer.id, caveats: before?.caveats ?? '',
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setD((v) => ({ ...v, ...p }));
  const input: MetricInput = {
    name: d.name, meaning: d.meaning, unit: d.unit, decimals: d.decimals.trim() === '' ? 0 : Number(d.decimals), direction: (d.direction || undefined) as MetricDirection,
    source: d.source, sourceOwner: d.sourceOwner, refresh: d.refresh || null, ownerId: d.ownerId, caveats: d.caveats,
  };
  const problems = useMemo(() => metricProblems(metricFrom(input, before, { actor: app.viewer, now: app.stamp(), newId }), app.snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, before, app.snapshot]);
  const people = app.snapshot.people.filter((p) => !p.leftAt || p.id === d.ownerId).sort((a, b) => a.name.localeCompare(b.name));
  const back = before ? '/data/metrics?m=' + encodeURIComponent(before.id) : '/data/metrics';
  const save = async () => {
    setTried(true);
    if (problems.length) return;
    setBusy(true);
    try {
      const id = await app.saveMetric(before ? { ...input, id: before.id } : input);
      app.toast(before ? `Saved ${input.name?.trim()}` : `Added ${input.name?.trim()}`);
      nav('/data/metrics?m=' + encodeURIComponent(id));
    } catch { setBusy(false); }
  };
  const opt = <span className="muted" style={{ fontWeight: 400 }}> · optional</span>;
  return (
    <div className="page narrow metrics-page">
      <BackLink to={back} label={before ? before.name : 'Metrics'} />
      <form className="stack metric-form" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <h1 className="title-xl">{before ? `Edit ${before.name}` : 'Add a metric'}</h1>
        <label className="field"><span className="field-label">Name</span>
          <input className="input" value={d.name} maxLength={METRIC_LIMITS.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Deploy frequency" />
        </label>
        <label className="field"><span className="field-label">What it means and how it’s calculated{opt}</span>
          <textarea className="input" rows={3} value={d.meaning} onChange={(e) => set({ meaning: e.target.value })} placeholder="What is counted, over what period, and what is left out" />
        </label>
        <div className="metric-pair">
          <label className="field"><span className="field-label">Unit</span>
            <input className="input" value={d.unit} maxLength={METRIC_LIMITS.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%, min, deploys…" />
          </label>
          <label className="field"><span className="field-label">Decimals{opt}</span>
            <input className="input" inputMode="numeric" value={d.decimals} onChange={(e) => set({ decimals: e.target.value })} />
          </label>
        </div>
        <div className="field"><span className="field-label" id="mt-dir">Which way is better</span>
          <div className="seg" role="group" aria-labelledby="mt-dir">
            {(['higher', 'lower'] as const).map((v) => <button key={v} type="button" aria-pressed={d.direction === v} onClick={() => set({ direction: v })}>{DIRECTION_LABEL[v]}</button>)}
          </div>
        </div>
        <div className="metric-pair">
          <label className="field"><span className="field-label">Source{opt}</span>
            <input className="input" value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder="A dashboard, a tool or a query" />
          </label>
          <label className="field"><span className="field-label">Source’s owner{opt}</span>
            <input className="input" value={d.sourceOwner} onChange={(e) => set({ sourceOwner: e.target.value })} placeholder="A team or a person" />
          </label>
        </div>
        <div className="metric-pair">
          <label className="field"><span className="field-label">How often it refreshes{opt}</span>
            <select className="input" value={d.refresh} onChange={(e) => set({ refresh: e.target.value as MetricRefresh | '' })}>
              <option value="">Not said</option>
              {REFRESHES.map((r) => <option key={r} value={r}>{REFRESH_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Owner</span>
            <select className="input" value={d.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span className="field-label">Caveats{opt}</span>
          <textarea className="input" rows={2} value={d.caveats} onChange={(e) => set({ caveats: e.target.value })} placeholder="What to watch out for when reading it" />
        </label>
        {tried && problems.map((p) => <FieldError key={p}>{p}</FieldError>)}
        <div className="row metric-actions">
          <button type="submit" className="btn primary" disabled={busy}>{before ? 'Save' : 'Add the metric'}</button>
          <Link className="btn" to={back}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
