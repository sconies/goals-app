import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { attentionList } from '../domain/attention';
import { worst } from '../domain/status';
import { AttentionCard, Chip, Empty } from '../ui/bits';
import { GoalLine } from './Home';

type Show = 'attention' | 'all' | 'mine';

export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const att = attentionList(app.snapshot, app.cycle, app.today);
  const mineCount = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id).length;
  const show: Show = (params.get('show') as Show) || (att.length ? 'attention' : 'all');
  const tabs: [Show, string, number][] = [['attention', 'Needs attention', att.length], ['all', 'All goals', app.snapshot.goals.length], ...(mineCount ? [['mine', 'Mine', mineCount] as [Show, string, number]] : [])];
  const goals = show === 'mine' ? app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id) : app.snapshot.goals;
  const head = goals.find((g) => g.headline);

  return (
    <div className="page">
      <div className="page-head row between">
        <span className="stack" style={{ gap: 2 }}>
          <h1 className="title-xl">Goals</h1>
          <span className="small muted">Week {app.week} of {app.cycle.weeks} · {app.cycle.name}</span>
        </span>
        <Link className="btn primary" to="/goals/new">New goal</Link>
      </div>
      <div className="seg tabs" role="tablist" aria-label="Show">
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={show === k} onClick={() => setParams(k === 'attention' && att.length ? {} : { show: k }, { replace: true })}>
            {l}<span className="tabcount">{n}</span>
          </button>
        ))}
      </div>

      {show === 'attention' ? (
        att.length ? <div className="acards">{att.map((a) => <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id} />)}</div>
          : <div className="calm"><span aria-hidden="true">✓</span> Nothing is off track, stale or slipping.</div>
      ) : (
        <>
          {!goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
          {head && (
            <section className="block">
              <h2 className="block-title">Headline goal</h2>
              <div className="glist"><GoalLine g={head} /></div>
            </section>
          )}
          {app.snapshot.teams.map((t) => {
            const list = goals.filter((g) => g.teamId === t.id && !g.headline);
            if (!list.length) return null;
            const st = worst(list.map((g) => app.statusOf(g).status));
            return (
              <section key={t.id} className="block" aria-label={t.name}>
                <div className="row between nowrap">
                  <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                    <h2 className="block-title">{t.name}</h2>
                    {t.objective && <span className="small muted ellipsis">{t.objective}</span>}
                  </span>
                  <Chip k={st} />
                </div>
                <div className="glist">{list.map((g) => <GoalLine key={g.id} g={g} />)}</div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
