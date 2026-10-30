import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApp } from '../app/state';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, gapText, kindLabel, weekLabel } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL, worst } from '../domain/status';
import type { Change, Goal } from '../domain/types';
import { Avatar, Chip, Empty, FlagPill, Tag, timeAgo } from '../ui/bits';
import { MetricChart, MetricLegend, RangeChart, StageList } from '../ui/charts';
import { GoalLine } from './Home';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  return <GoalView key={goal.id} goal={goal} />;
}

export function ChangeItem({ c, showGoal }: { c: Change; showGoal?: boolean }) {
  const app = useApp();
  const who = app.person(c.actorId);
  const [open, setOpen] = useState(false);
  const goal = c.goalId ? app.goal(c.goalId) : undefined;
  const diffs = c.diffs.filter((d) => d.field !== 'Note' || c.entity === 'decision');
  return (
    <li className={'change change-' + c.entity}>
      <Avatar p={who ?? { name: c.actorId, initials: '?' }} size="sm" />
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <span className="small"><strong>{who?.name ?? c.actorId}</strong> {c.summary.charAt(0).toLowerCase() + c.summary.slice(1)}{showGoal && goal ? <> · <Link className="linkish" to={'/goals/' + goal.id}>{goal.title}</Link></> : null}</span>
        <span className="tiny muted">{timeAgo(c.at, app.today)} · {new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        {diffs.length > 0 && (
          <>
            <button className="linkish tiny" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide changes' : `Show ${diffs.length === 1 ? 'the change' : diffs.length + ' changes'}`}</button>
            {open && (
              <dl className="diffs">
                {diffs.map((d) => (
                  <div key={d.field} className="diff">
                    <dt>{d.field}</dt>
                    <dd>{d.from !== '—' && <del>{d.from}</del>}{d.from !== '—' && <span aria-hidden="true"> → </span>}<ins>{d.to}</ins></dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const att = app.attentionOf(goal);
  const st = att.status;
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
  const due = att.flags.some((f) => f.kind === 'due');
  const changes = app.snapshot.changes.filter((c) => c.goalId === goal.id).slice().reverse();
  const [tab, setTab] = useState<'activity' | 'check-ins' | 'details'>('activity');
  const flags = att.flags.filter((f) => f.kind !== 'due');
  const lastBy = latest ? app.person(latest.authorId) : undefined;

  const headlineNumber = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages done` : a.actual == null || goal.kind === 'milestone' ? 'No value yet' : fmt(a.actual, goal);

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/goals">Goals</Link>
        {parent && <><span aria-hidden="true">›</span><Link to={'/goals/' + parent.id}>{parent.title}</Link></>}
      </nav>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="stack" style={{ gap: 6, minWidth: 0 }}>
          <h1 className="title-xl">{goal.title}</h1>
          <span className="row" style={{ gap: 6 }}>
            <Tag>{kindLabel(goal)}</Tag>
            <span className="row small muted" style={{ gap: 6 }}><Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" />{owner?.name}{team ? ' · ' + team.name : ''}</span>
          </span>
        </span>
        <div className="actions">
          {isOwner && week > 0 && <Link className={'btn' + (due || flags.length ? ' primary' : '')} to={'/check-in/' + goal.id}>{due ? 'Check in · due' : 'Check in'}</Link>}
          <Link className="btn" to={`/goals/${goal.id}/edit`}>Edit</Link>
        </div>
      </div>

      <section className={'story tone-edge-' + (st.status === 'off' ? 'off' : st.status === 'risk' ? 'risk' : st.status === 'stale' ? 'stale' : 'on')}>
        <div className="row" style={{ gap: 10 }}>
          <Chip k={st.status} />
          <span className="big">{headlineNumber}</span>
          <span className={'strong tone-' + gap.tone}>{st.status === 'stale' ? 'Stale' : gap.short}</span>
        </div>
        <span className="small">{st.status === 'stale' ? `No owner check-in for ${st.daysSinceCheckIn ?? 14}+ days, so the status can’t be trusted.` : gap.long + (a.kind === 'metric' && goal.kind === 'metric' && latest ? ` · plan for week ${a.week} was ${fmt(a.plan, goal)}` : '')}.</span>
        <span className="tiny muted">{latest ? <>Last updated by {lastBy?.name} · {timeAgo(latest.postedAt, app.today)}{st.greener ? ' · owner’s call is greener than the numbers' : ''}</> : 'No check-ins yet'}</span>
      </section>

      {flags.length > 0 && (
        <section className="flags" aria-label="Needs attention">
          {flags.map((f) => (
            <div key={f.kind} className={'flagrow tone-edge-' + f.tone}><FlagPill f={f} /><span className="small">{f.detail}</span></div>
          ))}
        </section>
      )}

      {ptg && (
        <section className="owner-says path">
          <span className="label">Path to green · back on plan by {weekLabel(ptg.byWeek, cycle.weeks)}{ptg.byWeek < week && (st.status === 'risk' || st.status === 'off') ? ' · missed' : ''}</span>
          <p>{ptg.what}</p>
          {ptg.needs && <p className="needs"><strong>Needs:</strong> {ptg.needs}</p>}
        </section>
      )}
      {latest?.why && latest.why !== 'On plan.' && (
        <section className="owner-says">
          <span className="label">{owner?.name.split(' ')[0]} says · week {latest.week}{latest.cause ? ' · ' + causeLabel(latest.cause) : ''}</span>
          <p>{latest.why}</p>
        </section>
      )}

      <section className="block">
        {goal.kind === 'metric' && a.kind === 'metric' && (
          <figure className="card" style={{ margin: 0 }}>
            <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={a.forecast} ptgBy={ptg?.byWeek ?? null} />
            <MetricLegend goal={goal} forecast={a.forecast != null} ptg={!!ptg && ptg.byWeek > (series[series.length - 1]?.week ?? 0)} />
            {goal.originalPlan && <figcaption className="tiny muted">Target changed in week {goal.rebaselinedWeek}: {fmt(goal.originalPlan.target, goal)} → {fmt(goal.plan.target, goal)}. The original plan is dotted.</figcaption>}
          </figure>
        )}
        {goal.kind === 'range' && <figure className="card" style={{ margin: 0 }}><RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} /></figure>}
        {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
      </section>

      {children.length > 0 && (
        <section className="block">
          <div className="row between"><h2 className="block-title">Feeding this goal</h2><Chip k={worst(children.map((c) => app.statusOf(c).status))} label={'Worst: ' + LABEL[worst(children.map((c) => app.statusOf(c).status))]} /></div>
          <div className="mix" role="img" aria-label={(['on', 'risk', 'off', 'stale', 'done'] as const).map((k) => `${children.filter((c) => app.statusOf(c).status === k).length} ${LABEL[k].toLowerCase()}`).join(', ')}>
            {(['on', 'risk', 'off', 'stale', 'done'] as const).map((k) => { const n = children.filter((c) => app.statusOf(c).status === k).length; return n ? <i key={k} className={'mix-' + k} style={{ flexGrow: n }} /> : null; })}
          </div>
          <div className="glist">{children.map((c) => <GoalLine key={c.id} g={c} />)}</div>
        </section>
      )}

      <section className="block">
        <div className="seg tabs" role="tablist" aria-label="More about this goal">
          {([['activity', 'Activity', changes.length], ['check-ins', 'Check-ins', own.length], ['details', 'Details', 0]] as const).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className="tabcount">{n}</span> : null}</button>
          ))}
        </div>
        {tab === 'activity' && (changes.length ? <ol className="changes">{changes.map((c) => <ChangeItem key={c.id} c={c} />)}</ol> : <p className="small muted">No changes yet.</p>)}
        {tab === 'check-ins' && (own.length ? (
          <ol className="cilist">
            {[...own].reverse().map((c) => (
              <li key={c.id}>
                <span className="strong">Week {c.week}</span>
                <span>{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
                <Chip k={c.status} />
                {c.why && c.why !== 'On plan.' && <span className="small cilist-why">{c.why}</span>}
              </li>
            ))}
          </ol>
        ) : <p className="small muted">No check-ins yet.</p>)}
        {tab === 'details' && (
          <dl className="details">
            {goal.definition && <><dt>Definition</dt><dd>{goal.definition}</dd></>}
            {goal.kind === 'metric' && <><dt>Measure</dt><dd>{fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)} by week {cycle.weeks}, {directionLabel(goal)}</dd><dt>Plan</dt><dd>{goal.plan.shape === 'back' ? 'Back-loaded' : goal.plan.shape === 'stepped' ? 'Three steps' : 'Straight line'}</dd></>}
            {goal.kind === 'range' && <><dt>Measure</dt><dd>{directionLabel(goal)}, warning margin {fmt(goal.range.margin, goal)}</dd></>}
            {goal.kind === 'milestone' && <><dt>Stages</dt><dd>{goal.stages.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ')}</dd></>}
            <dt>Feeds into</dt><dd>{goal.headline ? 'This is the headline goal' : parent ? parent.title + (goal.effect != null ? ` · estimated effect ${goal.effect}` : '') : 'Nothing'}</dd>
            <dt>Data source</dt><dd>{goal.source || 'Entered by the owner'}</dd>
            <dt>Rules</dt><dd>{goal.kind === 'metric' ? 'On track at 95% of planned progress or more; at risk from 80%. Reason needed when behind or 20% ahead.' : goal.kind === 'range' ? 'At risk inside the margin or after one breach; off track after two weeks out.' : 'Up to 2 weeks late is at risk; more is off track.'}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}
