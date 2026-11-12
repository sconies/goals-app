/* The metric library on core pages (ML1, docs/design/metrics/spec.md 2.6 and 2.7), through the places the core offers
   (src/core/app.tsx): a line in a goal's summary (goal.facts), a block on a goal's page (goal.sections), and the metrics
   a person owns or a team's goals use (people.person, people.team). Each says nothing when there is nothing to say. */
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { canLinkGoal, linkProblems, measureOf } from './rules';
import { WarnMark } from '../../ui/bits';
import { directionWords, findMetrics, liveLinks, metricPath, type LibraryRow } from './rulesLibrary';
import { libraryReads } from './reads';
import './metrics.css';

/** How many metrics a person's or a team's page lists before "See all". */
const SHOWN = 5;
const firstOf = (name: string) => name.split(/\s+/)[0] ?? name;

/** goal.facts: "Measured by {metric} · {unit}, {lower|higher} is better", the name a link to the metric. */
export function GoalMeasuredBy({ goal }: PlaceProps['goal.facts']) {
  const app = useApp();
  const m = measureOf(app.snapshot, goal);
  if (!m) return null;
  // The metric changed after the goal was linked (its unit or direction): the goal says so, with what differs.
  const p = linkProblems(goal, m.metric);
  const differ = [...p.errors, ...p.warnings];
  return (
    <>
      <p className="goal-measured-by small">Measured by <Link to={metricPath(m.metric)}>{m.metric.name}</Link> · {m.metric.unit}, {directionWords(m.metric.direction)}</p>
      {differ.length > 0 && <p className="small metric-differs" role="note"><WarnMark /> {differ.join(' ')}</p>}
    </>
  );
}

/** goal.sections: the metric that measures the goal, for which slice, what it means, and the other goals it measures.
    The place sits inside About this goal (after its facts), so this is a part of About with its own small heading, not
    a section of the page with a rule of its own. */
export function GoalMetric({ goal }: PlaceProps['goal.sections']) {
  const app = useApp();
  const m = measureOf(app.snapshot, goal);
  if (!m) {
    // Not linked: a quiet line for whoever may link a number goal; nothing for anyone else.
    if (goal.kind === 'milestone' || goal.stoppedAt || !canLinkGoal(app.viewer, goal)) return null;
    return <p className="hint goal-no-metric">No metric yet. <Link to={`/goals/${encodeURIComponent(goal.id)}/edit#definition`}>Choose one</Link></p>;
  }
  const others = liveLinks(libraryReads(app.snapshot, app.stamp()), m.metric.id).filter((l) => l.goalId !== goal.id).length;
  return (
    <section className="stack metric-block" aria-labelledby="g-metric" data-part="Measured by">
      <h3 className="label" id="g-metric">Measured by {m.metric.name}, for {m.slice === 'The whole company' ? 'the whole company' : m.slice}</h3>
      {m.metric.meaning ? <p>{m.metric.meaning}</p> : <p className="hint">Its meaning hasn’t been written yet.</p>}
      {m.metric.source && <p className="small">Where the number comes from: {m.metric.source}</p>}
      {m.metric.caveats && <p className="small">Caveats: {m.metric.caveats}</p>}
      {others > 0 && <p className="small"><Link to={`${metricPath(m.metric)}#goals`}>See the {others} other {others === 1 ? 'goal' : 'goals'} measured by it</Link></p>}
    </section>
  );
}

/** A short list of metrics on a person's or a team's page: name, then unit and how many goals; "See all" past five. */
function MetricList({ id, title, rows, total, all }: { id: string; title: string; rows: LibraryRow[]; total: number; all: string }) {
  if (!total) return null;
  return (
    <section className="stack" style={{ gap: 'var(--s2)' }} aria-labelledby={id}>
      <h2 className="label" id={id}>{title} · {total}</h2>
      <ul className="metric-mini">
        {rows.slice(0, SHOWN).map((r) => <li key={r.metric.id}><Link to={metricPath(r.metric)}>{r.metric.name}</Link><span className="hint">{r.metric.unit} · {r.goalIds.length} {r.goalIds.length === 1 ? 'goal' : 'goals'}</span></li>)}
      </ul>
      {total > SHOWN && <p><Link to={all}>See all {total}</Link></p>}
    </section>
  );
}

/** people.person: "Metrics {first name} owns". */
export function PersonMetrics({ person }: PlaceProps['people.person']) {
  const app = useApp();
  const found = findMetrics(libraryReads(app.snapshot, app.stamp()), { ownerId: person.id, size: SHOWN });
  const you = person.id === app.viewer.id;
  return <MetricList id="person-metrics" title={you ? 'Metrics you own' : `Metrics ${firstOf(person.name)} owns`} rows={found.rows} total={found.total} all={`/metrics?owner=${encodeURIComponent(person.id)}`} />;
}

/** people.team: "Metrics its goals use". */
export function TeamMetrics({ team }: PlaceProps['people.team']) {
  const app = useApp();
  const found = findMetrics(libraryReads(app.snapshot, app.stamp()), { teamId: team.id, size: SHOWN });
  return <MetricList id="team-metrics" title="Metrics its goals use" rows={found.rows} total={found.total} all={`/metrics?team=${encodeURIComponent(team.id)}`} />;
}
