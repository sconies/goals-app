import { Link } from 'react-router';
import { useApp } from '../app/state';
import { fmt, gapText, targetText } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessPosted, LABEL, worst } from '../domain/status';
import type { Goal } from '../domain/types';
import { Chip, Empty, Header } from '../ui/bits';
import { MetricChart, RangeChart, StageSpark } from '../ui/charts';

function GoalRow({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const st = app.statusOf(goal);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const gap = gapText(goal, a);
  const series = valueSeries(app.checkInsOf(goal));
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || goal.kind === 'milestone' ? '—' : fmt(a.actual, goal);
  const plan = a.kind === 'metric' && goal.kind === 'metric' ? 'plan ' + fmt(a.plan, goal) : a.kind === 'milestone' ? a.dueCount + ' due by now' : 'limit ' + targetText(goal);
  return (
    <Link to={'/goals/' + goal.id} className="rowbtn">
      <span style={{ flex: '0 0 96px' }}><Chip k={st.status} /></span>
      <span className="stack" style={{ gap: 2, flex: '1 1 240px', minWidth: 0 }}>
        <span className="strong" style={{ color: 'var(--fg)' }}>{goal.title}</span>
        <span className="tiny muted">{app.person(goal.ownerId)?.name}{goal.guardrail ? ' · guardrail' : ''}{st.greener ? ' · greener than calculated' : ''}</span>
      </span>
      <span className="stack metricbox" style={{ gap: 2, flex: '0 0 150px' }}>
        <span className="small" style={{ color: 'var(--fg-2)' }}>{now} · {plan}</span>
        <span className={'tiny strong tone-' + gap.tone}>{gap.short}</span>
      </span>
      <span className="spark" style={{ flex: '0 0 120px' }} aria-hidden="true">
        {goal.kind === 'metric' && <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={null} mini />}
        {goal.kind === 'range' && <RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} mini />}
        {a.kind === 'milestone' && <StageSpark a={a} />}
      </span>
    </Link>
  );
}

export function GoalsScreen() {
  const app = useApp();
  const { goals, teams } = app.snapshot;
  const headlines = goals.filter((g) => g.headline);
  const statuses = goals.map((g) => app.statusOf(g).status);
  const counts = (['off', 'risk', 'stale', 'on', 'done'] as const).map((k) => [k, statuses.filter((s) => s === k).length] as const).filter(([, n]) => n);
  return (
    <>
      <Header
        eyebrow={`Week ${app.week} of ${app.cycle.weeks} · ${app.cycle.name}`}
        title="Goals"
        sub={counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(' · ')}
        actions={<Link className="btn primary" to="/goals/new">New goal</Link>}
      />
      {!goals.length && <div className="split"><div className="main"><Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Create the first goal</Link></Empty></div></div>}
      {headlines.map((h) => (
        <section key={h.id} aria-label="Headline goal" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="row" style={{ padding: '14px 24px 0' }}><span className="label">Headline goal</span></div>
          <GoalRow goal={h} />
        </section>
      ))}
      {teams.map((t) => {
        const mine = goals.filter((g) => g.teamId === t.id && !g.headline);
        if (!mine.length) return null;
        const teamStatus = worst(mine.map((g) => app.statusOf(g).status));
        return (
          <section key={t.id} aria-label={t.name}>
            <div className="row between" style={{ padding: '16px 24px 6px' }}>
              <span className="stack" style={{ gap: 0 }}>
                <span className="h3">{t.name}</span>
                <span className="small muted">{t.objective} · lead {app.person(t.leadId)?.name}</span>
              </span>
              <Chip k={teamStatus} />
            </div>
            {mine.map((g) => <GoalRow key={g.id} goal={g} />)}
          </section>
        );
      })}
    </>
  );
}
