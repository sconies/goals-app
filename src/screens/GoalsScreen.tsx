import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { attentionList } from '../domain/attention';
import { reviewQueue } from '../domain/review';
import { worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty } from '../ui/bits';
import { GoalLine } from './Home';
import { OutcomeCard, TreeRows, worstFirst } from './Inspect';

type Show = 'outcomes' | 'attention' | 'teams' | 'mine';

/** Goals, starting from the outcomes: each headline goal, then what feeds it, worst first. */
export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const att = attentionList(app.snapshot, app.cycle, app.today);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const show: Show = (params.get('show') as Show) || 'outcomes';
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const q = reviewQueue(app.snapshot, app.cycle, app.today, app.week);
  const open = q.total - q.done;
  const isSponsor = app.viewer.profile === 'sponsor';
  const tabs: [Show, string, number | null][] = [
    ['outcomes', trees.length > 1 ? `Outcomes` : 'Outcome', trees.length > 1 ? trees.length : null],
    ['attention', 'Needs attention', att.length],
    ['teams', 'By team', null],
    ...(mine.length ? [['mine', 'Mine', mine.length] as [Show, string, number]] : []),
  ];

  return (
    <div className="page">
      <div className="page-head row between">
        <span className="stack" style={{ gap: 2 }}>
          <h1 className="title-xl">Goals</h1>
          <span className="hint">Week {app.week} of {app.cycle.weeks}, {app.cycle.name.charAt(0).toLowerCase() + app.cycle.name.slice(1)}</span>
        </span>
        {isSponsor
          ? open > 0 && <Link className="btn primary" to="/review">Review {open} that need a call</Link>
          : app.viewer.profile !== 'contributor' && <Link className="btn" to="/goals/new">New goal</Link>}
      </div>
      <div className="seg tabs" role="tablist" aria-label="Show">
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={show === k} onClick={() => setParams(k === 'outcomes' ? {} : { show: k }, { replace: true })}>
            {l}{n != null && <span className="tabcount">{n}</span>}
          </button>
        ))}
      </div>

      {show === 'outcomes' && (
        <>
          {!app.snapshot.goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
          {trees.map((t) => (
            <section key={t.goal.id} className="outcome" aria-label={t.goal.title}>
              <OutcomeCard node={t} />
              <TreeRows nodes={t.children} />
            </section>
          ))}
          {loose.length > 0 && (
            <section className="block">
              <div className="stack" style={{ gap: 'var(--s1)' }}>
                <h2 className="block-title">Not linked to an outcome</h2>
                <span className="hint">These don’t feed a headline goal yet. Link them from Edit, under Feeds into.</span>
              </div>
              <TreeRows nodes={loose.map((g) => ({ goal: g, children: [] }))} />
            </section>
          )}
        </>
      )}

      {show === 'attention' && (att.length
        ? <div className="alist">{att.map((a) => <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id} />)}</div>
        : <div className="calm"><span aria-hidden="true">✓</span> Nothing is off track, stale or slipping.</div>)}

      {show === 'teams' && app.snapshot.teams.map((t) => {
        const list = app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app));
        if (!list.length) return null;
        const st = worst(list.map((g) => app.statusOf(g).status));
        return (
          <section key={t.id} className="block" aria-label={t.name}>
            <div className="row between nowrap">
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <h2 className="block-title">{t.name}</h2>
                {t.objective && <span className="hint ellipsis">{t.objective}</span>}
              </span>
              <Chip k={st} />
            </div>
            <div className="glist">{list.map((g) => <GoalLine key={g.id} g={g} />)}</div>
          </section>
        );
      })}

      {show === 'mine' && <div className="glist">{mine.map((g) => <GoalLine key={g.id} g={g} />)}</div>}
    </div>
  );
}
