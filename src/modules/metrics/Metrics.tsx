/* The Metrics page, under Data (backlog 0b): every metric in use, by name, with its unit, which way is better, its
   owner, how many goals it measures and which teams use it. Search by name. One primary action: Add a metric. A row
   opens the metric: its definition, the goals it measures, and Edit and Remove for its owner or an admin. The same
   form adds and changes (MetricForm). ?new opens a new one; ?m=<id> opens one; &edit changes it. */
import { Link, useSearchParams } from 'react-router';
import { useState } from 'react';
import { useApp } from '../../app/state';
import { BackLink } from '../../ui/BackLink';
import { DIRECTION_LABEL, REFRESH_LABEL, canEditMetric, findMetric, goalsMeasuredBy, liveMetrics, sliceName } from '../../domain/metrics';
import type { Metric, Snapshot } from '../../domain/types';
import { MetricForm } from './MetricForm';

/** The teams a metric's goals belong to, by name: who uses it. */
export function teamsUsing(s: Snapshot, metricId: string): string[] {
  const names = new Set(goalsMeasuredBy(s, metricId).map((g) => s.teams.find((t) => t.id === g.teamId)?.name).filter((n): n is string => !!n));
  return [...names].sort((a, b) => a.localeCompare(b));
}

const goalsText = (n: number) => (n === 0 ? 'No goals' : n === 1 ? '1 goal' : `${n} goals`);

export function Metrics() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const open = params.get('m') ? findMetric(app.snapshot, params.get('m')!) : undefined;
  const go = (p: Record<string, string>) => setParams(p);

  if (params.has('new')) {
    return (
      <div className="page narrow metrics-page">
        <BackLink to="/data/metrics" label="Metrics" />
        <div className="page-head"><h1 className="title-xl">Add a metric</h1><span className="hint">A name, a unit and which way is better is enough to start. Anyone can add one; you own it unless you say otherwise.</span></div>
        <MetricForm metric={null} onSaved={(id) => go({ m: id })} onCancel={() => go({})} />
      </div>
    );
  }
  if (open && params.has('edit') && canEditMetric(app.viewer, open)) {
    return (
      <div className="page narrow metrics-page">
        <BackLink to={`/data/metrics?m=${open.id}`} label={open.name} />
        <div className="page-head"><h1 className="title-xl">Change {open.name}</h1><span className="hint">Every change goes in the change log, field by field.</span></div>
        <MetricForm metric={open} onSaved={(id) => go({ m: id })} onCancel={() => go({ m: open.id })} />
      </div>
    );
  }
  if (open) return <MetricPage m={open} onEdit={() => go({ m: open.id, edit: '1' })} onRemoved={() => go({})} />;

  const all = liveMetrics(app.snapshot);
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((m) => m.name.toLowerCase().includes(needle)) : all;
  return (
    <div className="page metrics-page">
      <BackLink to="/data" label="Data" />
      <div className="page-head row">
        <div className="stack"><h1 className="title-xl">Metrics</h1><span className="hint">Each number goals are measured by, defined once: what it means, its unit, which way is better and who owns it.</span></div>
        <button type="button" className="btn primary" onClick={() => go({ new: '1' })}>Add a metric</button>
      </div>
      <label className="field metrics-search"><span className="sr">Search metrics by name</span>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search metrics by name" />
      </label>
      {shown.length === 0 ? (
        <p className="muted">{all.length === 0 ? 'No metrics yet. Add the first one.' : `No metric’s name has “${q.trim()}” in it.`}</p>
      ) : (
        <table className="metrics-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Unit</th><th scope="col">Better</th><th scope="col">Owner</th><th scope="col">Goals</th><th scope="col">Teams using it</th></tr></thead>
          <tbody>
            {shown.map((m) => {
              const n = goalsMeasuredBy(app.snapshot, m.id).length;
              const teams = teamsUsing(app.snapshot, m.id);
              return (
                <tr key={m.id}>
                  <th scope="row"><button type="button" className="linkish strong" onClick={() => go({ m: m.id })}>{m.name}</button></th>
                  <td data-label="Unit">{m.unit}</td>
                  <td data-label="Better">{DIRECTION_LABEL[m.direction]}</td>
                  <td data-label="Owner">{app.personName(m.ownerId)}</td>
                  <td data-label="Goals">{goalsText(n)}</td>
                  <td data-label="Teams using it" className="muted">{teams.length ? teams.join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="hint">{shown.length === all.length ? `${all.length} ${all.length === 1 ? 'metric' : 'metrics'}` : `${shown.length} of ${all.length} metrics`}</p>
    </div>
  );
}

/** One metric: its definition, the goals it measures (with their slice and target), and Edit and Remove for those who may. */
function MetricPage({ m, onEdit, onRemoved }: { m: Metric; onEdit: () => void; onRemoved: () => void }) {
  const app = useApp();
  const goals = goalsMeasuredBy(app.snapshot, m.id);
  const may = canEditMetric(app.viewer, m);
  const remove = async () => { try { await app.removeMetric(m.id); onRemoved(); } catch { /* the rule's message is shown */ } };
  const facts: [string, string][] = [
    ['Unit', m.unit],
    ['Which way is better', DIRECTION_LABEL[m.direction]],
    ['Decimals', String(m.decimals)],
    ['Owner', app.personName(m.ownerId)],
    ['Source', m.source || 'Not said'],
    ['Who owns the source', m.sourceOwner || 'Not said'],
    ['Refreshed', m.refresh ? REFRESH_LABEL[m.refresh] : 'Not said'],
    ['Teams using it', teamsUsing(app.snapshot, m.id).join(', ') || 'None yet'],
  ];
  return (
    <div className="page narrow metrics-page">
      <BackLink to="/data/metrics" label="Metrics" />
      <div className="page-head row">
        <div className="stack"><h1 className="title-xl">{m.name}</h1><span className="hint">{m.meaning || 'No meaning written yet.'}</span></div>
        {may && <button type="button" className="btn" onClick={onEdit}>Edit</button>}
      </div>
      <dl className="metric-facts">{facts.map(([k, v]) => <div key={k}><dt className="small muted">{k}</dt><dd>{v}</dd></div>)}</dl>
      {m.caveats && <section><h2 className="small strong">Caveats</h2><p>{m.caveats}</p></section>}
      <section>
        <h2 className="small strong">Goals it measures</h2>
        {goals.length === 0 ? <p className="muted">None yet. A goal’s owner picks it under “Measured by” when they edit the goal.</p> : (
          <ul className="metric-goals">
            {goals.map((g) => {
              const link = app.snapshot.metricLinks?.find((l) => l.goalId === g.id && !l.removedAt);
              return <li key={g.id}><Link className="strong" to={`/goals/${g.id}`}>{g.title}</Link><span className="muted small"> · {sliceName(app.snapshot, link?.teamId ?? null)} · {app.personName(g.ownerId)}</span></li>;
            })}
          </ul>
        )}
      </section>
      {may && <div><button type="button" className="btn ghost" onClick={() => void remove()}>Remove this metric</button><span className="hint"> {goals.length ? `It stops measuring ${goalsText(goals.length).toLowerCase()}. Undo puts it all back.` : 'Undo puts it back.'}</span></div>}
    </div>
  );
}
