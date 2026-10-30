import { Link, useParams } from 'react-router';
import { useApp } from '../app/state';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, gapText, kindLabel, targetText, weekLabel } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessPosted, assessMilestone, LABEL, RULES, worst } from '../domain/status';
import type { CheckIn, Goal } from '../domain/types';
import { Chip, Dot, Empty, Header, Tag } from '../ui/bits';
import { MetricChart, MetricLegend, RangeChart, StageList } from '../ui/charts';

/** The calculated reading of one posted check-in, for the history table. */
function readingOf(goal: Goal, c: CheckIn): string {
  if (goal.kind === 'milestone') {
    const a = assessMilestone(goal, c.week, c.stages);
    return `${a.doneCount} of ${a.stages.length} stages`;
  }
  return c.value == null ? '—' : fmt(c.value, goal);
}

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) {
    return (
      <>
        <Header title="Goal not found" />
        <div className="split"><div className="main"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div></div>
      </>
    );
  }
  return <GoalView key={goal.id} goal={goal} />;
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const st = app.statusOf(goal);
  const own = app.checkInsOf(goal);
  const latest = st.latest;
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const gap = gapText(goal, a);
  const owner = app.person(goal.ownerId);
  const team = app.team(goal.teamId);
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const children = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  const series = valueSeries(own);
  const ptg = latest?.pathToGreen ?? null;
  const isOwner = app.viewer.id === goal.ownerId;
  const behind = st.status === 'risk' || st.status === 'off' || a.calc === 'risk' || a.calc === 'off';

  let stripTiles;
  if (a.kind === 'metric' && goal.kind === 'metric') {
    stripTiles = (
      <>
        <div><span className="tiny muted">Actual</span><span className="big">{a.actual == null ? '—' : fmt(a.actual, goal)}</span><span className="tiny muted">{latest ? 'Week ' + a.week : 'No check-in yet'}</span></div>
        <div><span className="tiny muted">Plan for week {a.week}</span><span className="big">{fmt(a.plan, goal)}</span><span className="tiny muted">{goal.plan.shape === 'back' ? 'Back-loaded plan' : goal.plan.shape === 'stepped' ? 'Stepped plan' : 'Straight-line plan'}</span></div>
        <div><span className="tiny muted">Against plan</span><span className={'big tone-' + gap.tone}>{gap.short}</span><span className="tiny" style={{ color: 'var(--fg-2)' }}>{gap.long}</span></div>
        <div><span className="tiny muted">Forecast at week {cycle.weeks}</span><span className={'big' + (a.forecastMisses ? ' tone-off' : '')}>{a.forecast == null ? '—' : fmt(a.forecast, goal)}</span><span className="tiny muted">Target {fmt(a.target, goal)}</span></div>
      </>
    );
  } else if (a.kind === 'range' && goal.kind === 'range') {
    stripTiles = (
      <>
        <div><span className="tiny muted">Latest</span><span className="big">{a.actual == null ? '—' : fmt(a.actual, goal)}</span><span className="tiny muted">{latest ? 'Week ' + a.week : 'No check-in yet'}</span></div>
        <div><span className="tiny muted">Limit</span><span className="big">{targetText(goal)}</span><span className="tiny muted">Warning margin {fmt(goal.range.margin, goal)}</span></div>
        <div><span className="tiny muted">Against the limit</span><span className={'big tone-' + gap.tone}>{gap.short}</span><span className="tiny" style={{ color: 'var(--fg-2)' }}>{gap.long}</span></div>
      </>
    );
  } else if (a.kind === 'milestone') {
    stripTiles = (
      <>
        <div><span className="tiny muted">Stages done</span><span className="big">{a.doneCount} of {a.stages.length}</span><span className="tiny muted">{a.dueCount} due by week {week}</span></div>
        <div><span className="tiny muted">Against plan</span><span className={'big tone-' + gap.tone}>{gap.short}</span><span className="tiny" style={{ color: 'var(--fg-2)' }}>{gap.long}</span></div>
        <div><span className="tiny muted">Target</span><span className="big">{targetText(goal)}</span></div>
      </>
    );
  }

  return (
    <>
      <header className="hdr" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <nav aria-label="Breadcrumb" className="row small muted" style={{ gap: 6 }}>
          <Link className="linkish" style={{ color: 'var(--muted)', fontWeight: 400 }} to="/goals">Goals</Link>
          {parent && <><span aria-hidden="true">›</span><Link className="linkish" style={{ color: 'var(--muted)', fontWeight: 400 }} to={'/goals/' + parent.id}>{parent.title}</Link></>}
          {!goal.headline && team && <><span aria-hidden="true">›</span><span>{team.objective}</span></>}
        </nav>
        <div className="row between">
          <h1 className="title-xl">{goal.title}</h1>
          <div className="actions">
            <Link className="btn" to={`/goals/${goal.id}/edit`}>Edit goal</Link>
            {isOwner && week > 0 && <Link className="btn primary" to={'/check-in/' + goal.id}>Check in</Link>}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Tag>{kindLabel(goal)}</Tag>
          <Tag>{goal.io === 'input' ? 'Input' : 'Output'}{goal.guardrail ? ' · guardrail' : ''}</Tag>
          <Tag>Owner {owner?.name}</Tag>
          {team && <Tag>{team.name}</Tag>}
        </div>
      </header>

      <div className="strip">
        <div>
          <span className="tiny muted">Status · owner’s call</span>
          <Chip k={st.status} />
          <span className={'tiny ' + (st.greener && st.status !== 'stale' ? 'tone-off strong' : 'muted')}>
            {st.status === 'stale' ? `No owner check-in for ${st.daysSinceCheckIn ?? RULES.staleDays}+ days` : `Calculated: ${LABEL[a.calc]}`}
          </span>
        </div>
        {stripTiles}
      </div>

      <div className="split">
        <div className="main">
          <div className="row" style={{ alignItems: 'stretch', gap: 14 }}>
            <section className="card stack" style={{ flex: '1 1 300px', gap: 8 }}>
              <h2 className="h3">{!latest ? 'Latest note' : latest.cause && ['cautious', 'early', 'oneoff'].includes(latest.cause) && latest.calculated === 'on' ? 'Why it’s ahead of plan' : latest.cause ? 'Why it’s off plan' : 'Latest note'}</h2>
              {latest?.cause && <Tag>{causeLabel(latest.cause)}</Tag>}
              <p>{latest ? latest.why || 'No note.' : 'No check-ins yet.'}</p>
              {latest && <span className="tiny muted">{app.person(latest.authorId)?.name} · week {latest.week}{st.status === 'stale' ? ' · stale' : ''}</span>}
              {st.greener && latest?.greenerWhy && <div className="note-bad"><strong>Owner’s call is greener than calculated.</strong> {latest.greenerWhy}</div>}
            </section>
            {ptg ? (
              <section className="card focus stack" style={{ flex: '1 1 340px', gap: 10 }}>
                <div className="row between"><h2 className="h3">Path to green</h2><span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Back on plan by {weekLabel(ptg.byWeek, cycle.weeks)}</span></div>
                <p>{ptg.what}</p>
                {ptg.needs && <span className="small"><strong>Needs:</strong> {ptg.needs}</span>}
                <span className="tiny muted">{ptg.byWeek < week ? 'This checkpoint has passed: the review flags the path as missed unless it’s back on plan.' : 'If the checkpoint passes still behind, the review flags the path as missed.'}</span>
              </section>
            ) : behind ? (
              <section className="card warn stack" style={{ flex: '1 1 300px', gap: 8 }}>
                <h2 className="h3">Path to green</h2>
                <p>Missing. {owner?.name} owes one at the next check-in: it’s required for At risk and Off track.</p>
                {isOwner && week > 0 && <div><Link className="btn primary sm" to={'/check-in/' + goal.id}>Check in now</Link></div>}
              </section>
            ) : (
              <section className="card stack" style={{ flex: '1 1 300px', gap: 8 }}>
                <h2 className="h3">Path to green</h2>
                <p className="muted">Not needed while {LABEL[st.status].toLowerCase()}.</p>
              </section>
            )}
          </div>

          <section className="stack">
            <div className="row between">
              <h2 className="h3">{goal.kind === 'milestone' ? 'Stages' : 'Plan, actuals and the path back'}</h2>
              {goal.kind === 'metric' && goal.originalPlan && <span className="tiny muted">Plan re-baselined in week {goal.rebaselinedWeek}: target {fmt(goal.originalPlan.target, goal)} → {fmt(goal.plan.target, goal)}. Original dotted.</span>}
            </div>
            {a.kind === 'milestone' ? (
              <div className="card" style={{ padding: '4px 12px' }}><StageList a={a} /></div>
            ) : goal.kind === 'metric' && a.kind === 'metric' ? (
              <figure className="card" style={{ margin: 0, padding: 12 }}>
                <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={a.forecast} ptgBy={ptg?.byWeek ?? null} />
                <MetricLegend goal={goal} forecast={a.forecast != null} ptg={!!ptg && ptg.byWeek > (series[series.length - 1]?.week ?? 0)} />
              </figure>
            ) : goal.kind === 'range' ? (
              <figure className="card" style={{ margin: 0, padding: 12 }}><RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} /></figure>
            ) : null}
          </section>

          <section className="stack">
            <h2 className="h3">Check-in history</h2>
            {own.length ? (
              <div className="tablewrap" tabIndex={0} role="region" aria-label="Check-in history table">
                <table>
                  <thead><tr><th scope="col">Week</th><th scope="col">Value</th><th scope="col">Owner’s call</th><th scope="col">Calculated</th><th scope="col">Note</th></tr></thead>
                  <tbody>
                    {[...own].reverse().map((c) => (
                      <tr key={c.id}>
                        <td className="strong">{c.week}</td>
                        <td>{readingOf(goal, c)}</td>
                        <td><Chip k={c.status} /></td>
                        <td className="small muted">{LABEL[c.calculated]}</td>
                        <td className="small" style={{ minWidth: 220 }}>
                          {c.why}
                          {c.pathToGreen && <span className="tiny muted" style={{ display: 'block' }}>Path to green by {weekLabel(c.pathToGreen.byWeek, cycle.weeks)}: {c.pathToGreen.what}</span>}
                          {c.proposeTarget != null && goal.kind === 'metric' && <span className="tiny strong tone-ahead" style={{ display: 'block' }}>Proposed target {fmt(c.proposeTarget, goal)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted small">No check-ins yet.</p>}
          </section>
        </div>

        <aside className="aside" aria-label="About this goal">
          {children.length > 0 && <InputsPanel goal={goal} children={children} />}
          <section className="stack">
            <h2 className="h3">Details</h2>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: '8px 12px' }} className="small">
              {details(goal, cycle.weeks, parent).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}><dt className="muted">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function details(goal: Goal, weeks: number, parent: Goal | undefined): [string, string][] {
  const rows: [string, string][] = [];
  if (goal.definition) rows.push(['Definition', goal.definition]);
  if (goal.kind === 'metric') {
    rows.push(['Measure', `${fmt(goal.plan.start, goal)} → ${fmt(goal.plan.target, goal)} by week ${weeks}, ${directionLabel(goal)}`]);
    rows.push(['Plan', (goal.plan.shape === 'back' ? 'Back-loaded' : goal.plan.shape === 'stepped' ? 'Three steps' : 'Straight line') + ', weekly checkpoints']);
    rows.push(['Rules', 'On track at 95% of planned progress or more; at risk 80–95%. A reason is needed when behind, or more than 20% ahead.']);
  } else if (goal.kind === 'range') {
    rows.push(['Measure', `${directionLabel(goal)}, warning margin ${fmt(goal.range.margin, goal)}`]);
    rows.push(['Rules', 'At risk inside the margin or after one breach; off track after two weeks out of range.']);
  } else {
    rows.push(['Stages', goal.stages.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ')]);
    rows.push(['Rules', 'A stage up to 2 weeks late is at risk; more is off track.']);
  }
  rows.push(['Drives', goal.headline ? 'The cycle’s headline outcome' : parent ? `${parent.title}${goal.effect != null && parent.kind !== 'milestone' ? ` (${goal.effect} ${parent.kind === 'metric' || parent.kind === 'range' ? parent.unit : ''} estimated)` : ''}` : 'Nothing linked']);
  rows.push(['Data source', goal.source || 'Entered by the owner']);
  return rows;
}

function InputsPanel({ goal, children }: { goal: Goal; children: Goal[] }) {
  const app = useApp();
  const statuses = children.map((c) => app.statusOf(c).status);
  const totalEffect = children.reduce((s, c) => s + (c.effect ?? 0), 0);
  const needed = goal.kind === 'metric' ? Math.abs(goal.plan.target - goal.plan.start) : null;
  const counts = (['on', 'risk', 'off', 'stale', 'done', 'none'] as const).map((k) => [k, statuses.filter((s) => s === k).length] as const).filter(([, n]) => n);
  return (
    <section className="stack">
      <div className="row between"><h2 className="h3">Inputs that drive it</h2><Chip k={worst(statuses)} label={'Worst: ' + LABEL[worst(statuses)]} /></div>
      <div className="mix" role="img" aria-label={counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}>
        {counts.map(([k, n]) => <i key={k} className={'mix-' + k} style={{ flexGrow: n }} />)}
      </div>
      {needed != null && goal.kind === 'metric' && (
        <span className="small muted">Estimated effects add up to {fmt(totalEffect, goal)} of the {fmt(needed, goal)} needed{totalEffect < needed ? ' — short of the target' : ''}.</span>
      )}
      <div className="stack" style={{ gap: 4 }}>
        {children.map((c) => {
          const s = app.statusOf(c);
          return (
            <Link key={c.id} to={'/goals/' + c.id} className="item" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: '8px 10px' }}>
              <Dot k={s.status} />
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 500 }}>{c.title}</span>
                <span className="tiny muted">{app.team(c.teamId)?.name} · {LABEL[s.status]}{c.effect != null ? ` · effect ${c.effect}` : ''}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
