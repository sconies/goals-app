/* The metric library on core pages (ML1, docs/design/metrics/spec.md 2.6 and 2.7), through the places the core offers
   (src/core/app.tsx): a line in a goal's summary (goal.facts), a block on a goal's page (goal.sections), and the metrics
   a person owns or a team's goals use (people.person, people.team). Each says nothing when there is nothing to say. */
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { PlaceProps } from '../../core/app';
import { cycleUntil } from '../../domain/records';
import { canLinkGoal, linkProblems, measureOf, metricsOf } from './rules';
import { markLabel, marksFor, onDay } from './rulesChange';
import { WarnMark } from '../../ui/bits';
import { decimalsWords, directionWords, findMetrics, liveLinks, metricPath, type LibraryRow } from './rulesLibrary';
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
      <p className="goal-measured-by small">Measured by <Link to={metricPath(m.metric)}>{m.metric.name}</Link>{m.retired ? `, retired ${onDay(m.retired.at)}` : ''} · {m.metric.unit}, {directionWords(m.metric.direction)}</p>
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
  // "{source} ({source owner}), refreshed {refresh}", each part left out when empty (MT2, spec 2.7).
  const where = [m.metric.source.trim() ? `${m.metric.source.trim()}${m.metric.sourceOwner.trim() ? ` (${m.metric.sourceOwner.trim()})` : ''}` : '', m.metric.refresh ? `refreshed ${m.metric.refresh}` : ''].filter(Boolean).join(', ');
  // The goal's own definition, only when it says something the metric's meaning doesn't.
  const squash = (t: string) => t.toLowerCase().replace(/\s+/g, '');
  const own = goal.definition?.trim() && squash(goal.definition) !== squash(m.metric.meaning) ? goal.definition.trim() : '';
  // MT3: a retired metric says so, with its reason and what replaces it; the marks its changes left on this goal.
  const r = m.retired;
  const other = r?.replacedBy ? metricsOf(app.snapshot).find((v) => v.id === r.replacedBy && !v.removedAt && !v.retiredAt) : undefined;
  const sameUnit = !!other && other.unit.trim().toLowerCase() === m.metric.unit.trim().toLowerCase();
  const may = canLinkGoal(app.viewer, goal) && !goal.stoppedAt;
  const marks = marksFor(m.metric, m.link, app.cycle.startDate, cycleUntil(app.cycle));
  const useOther = async () => { try { await app.run('linkGoalMetric', { goalId: goal.id, metricId: other!.id, teamId: m.link.teamId, part: m.part, reason: `${m.metric.name} was retired.` }); } catch { /* the rule's message is shown */ } };
  return (
    <section className="stack metric-block" aria-labelledby="g-metric" data-part="Measured by">
      <h3 className="label" id="g-metric">Measured by <Link to={metricPath(m.metric)}>{m.metric.name}</Link>{r ? `, retired ${onDay(r.at)}` : ''}</h3>
      {r && (
        <div className="small stack" style={{ gap: 'var(--s1)' }}>
          <span>{app.person(r.by ?? '')?.name ?? 'Someone'} retired it: “{r.why}”. This goal keeps its numbers and its plan.{other && <> Replaced by <Link to={metricPath(other)}>{other.name}</Link>.</>}</span>
          {may && <span className="row">{sameUnit && <button type="button" className="btn sm" onClick={() => void useOther()}>Measure it by {other!.name}</button>}<Link className="btn sm ghost" to={`/goals/${encodeURIComponent(goal.id)}/edit#definition`}>Choose another</Link></span>}
        </div>
      )}
      {marks.length > 0 && (
        <ul className="metric-marks small">
          {marks.map((k) => <li key={k.at}><WarnMark /> <strong>{markLabel(k)}</strong>: {app.person(k.by)?.name ?? 'Someone'} changed {k.kind === 'direction' ? `which way is better for ${m.metric.name}` : `what ${m.metric.name} means`}: “{k.why}” {k.kind === 'definition' ? `Weeks before ${k.week} were measured the old way.` : ''} <Link to={`${metricPath(m.metric)}#history`}>See both definitions</Link></li>)}
        </ul>
      )}
      <dl className="metric-facts">
        <dt>For</dt><dd>{m.slice}{m.part ? ` · ${m.part}` : ''}</dd>
        <dt>What it means</dt><dd>{m.metric.meaning || <span className="hint">Its meaning hasn’t been written yet.</span>}</dd>
        <dt>From the metric</dt><dd>{m.metric.unit}, {decimalsWords(m.metric.decimals)}, {directionWords(m.metric.direction)}</dd>
        {where && <><dt>Where the number comes from</dt><dd>{where}</dd></>}
        {m.metric.caveats && <><dt>Caveats</dt><dd>{m.metric.caveats}</dd></>}
        {m.targetText && <><dt>This goal’s own</dt><dd>{m.targetText}</dd></>}
        {own && <><dt>For this goal</dt><dd>{own}</dd></>}
      </dl>
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
