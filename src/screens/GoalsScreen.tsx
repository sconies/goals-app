import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { attentionList } from '../domain/attention';
import { LEVEL_LABEL } from '../domain/format';
import { wrapUpOpen } from '../domain/cycle';
import type { Level } from '../domain/types';
import { worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty } from '../ui/bits';
import { GoalLine } from './Home';
import { TreeCard, TreeRow, TreeRows, worstFirst } from './Inspect';
import { WatchingBody } from './Watching';
import { useNavMode } from '../app/navMode';
import { watchedGoals } from '../domain/review';
import type { Goal } from '../domain/types';
import type { TreeNode } from '../domain/tree';
import { GoalBoard, GoalCards, GoalTable, HistoryGrid, LayoutSwitch, useLayout, type ViewGroup } from './GoalViews';
import { ExportButton } from './Export';

type Show = 'outcomes' | 'attention' | 'levels' | 'teams' | 'mine' | 'watching';
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Goals, starting from the trees: each top goal, then what feeds it, worst first. */
export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const att = attentionList(app.snapshot, app.cycle, app.today);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const navMode = useNavMode();
  const show: Show = (params.get('show') as Show) || 'outcomes';
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const [layout, setLayout] = useLayout();
  const flat = (n: TreeNode, depth = 0): { goal: Goal; depth: number }[] => [{ goal: n.goal, depth }, ...n.children.flatMap((c) => flat(c, depth + 1))];
  const one = (key: string, title: string, goals: Goal[]): ViewGroup => ({ key, title, rows: goals.map((goal) => ({ goal, depth: 0 })) });
  const groups: ViewGroup[] = show === 'outcomes'
    ? [...trees.map((t) => ({ key: t.goal.id, title: t.goal.title, rows: flat(t) })), ...(loose.length ? [{ ...one('loose', 'Not linked', loose), hint: 'These don’t feed another goal yet.' }] : [])]
    : show === 'attention' ? [one('attention', 'Needs attention', att.map((a) => a.goal))]
    : show === 'levels' ? LEVELS.map((l) => one(l, LEVEL_LABEL[l], app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'teams' ? app.snapshot.teams.map((t) => one(t.id, t.name, app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'mine' ? [one('mine', 'Mine', [...mine].sort(worstFirst(app)))]
    : [one('watching', 'Watching', watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app)))];
  const shown = [...new Map(groups.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  const alt = layout !== 'list';
  const tabs: [Show, string, number | null][] = [
    ['outcomes', 'Trees', null],
    ['attention', 'Needs attention', att.length],
    ['levels', 'By level', null],
    ['teams', 'By team', null],
    ...(mine.length ? [['mine', 'Mine', mine.length] as [Show, string, number]] : []),
    ...(navMode === 'four' ? [['watching', 'Watching', null] as [Show, string, null]] : []),
  ];

  return (
    <div className="page">
      <div className="page-head row between">
        <span className="stack" style={{ gap: 2 }}>
          <h1 className="title-xl">Goals</h1>
          <span className="hint">Week {app.week} of {app.cycle.weeks}, {app.cycle.name}</span>
        </span>
        <span className="actions">{wrapUpOpen(app.cycle, app.week) && <Link className="btn" to="/retro">Wrap up</Link>}<Link className="btn" to="/goals/new">New goal</Link></span>
      </div>
      <div className="seg tabs" role="tablist" aria-label="Show">
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={show === k} onClick={() => setParams(k === 'outcomes' ? {} : { show: k }, { replace: true })}>
            {l}{n != null && <span className="tabcount">{n}</span>}
          </button>
        ))}
      </div>
      {app.snapshot.goals.length > 0 && (
        <div className="row between view-bar">
          <LayoutSwitch layout={layout} onChange={setLayout} />
          <span className="row" style={{ gap: 'var(--s2)' }}>
            <Link className="btn sm" to="/import">Import</Link>
            <ExportButton goals={shown} viewName={tabs.find(([k]) => k === show)?.[1] ?? 'Goals'} />
          </span>
        </div>
      )}

      {!app.snapshot.goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
      {alt && app.snapshot.goals.length > 0 && !shown.length && (show === 'watching' ? <WatchingBody /> : <div className="calm"><span aria-hidden="true">✓</span> {show === 'attention' ? 'Nothing is off track, stale or slipping.' : 'No goals here.'}</div>)}
      {alt && shown.length > 0 && layout === 'table' && <GoalTable groups={groups} />}
      {alt && shown.length > 0 && layout === 'board' && <GoalBoard groups={groups} />}
      {alt && shown.length > 0 && layout === 'history' && <HistoryGrid groups={groups} />}
      {alt && shown.length > 0 && layout === 'cards' && <GoalCards groups={groups} />}

      {!alt && show === 'outcomes' && (
        <>
          {trees.map((t) => (
            <section key={t.goal.id} className="outcome" aria-label={t.goal.title}>
              <TreeCard node={t} />
              <TreeRows nodes={t.children} />
            </section>
          ))}
          {loose.length > 0 && (
            <section className="block">
              <div className="stack" style={{ gap: 'var(--s1)' }}>
                <h2 className="block-title">Not linked</h2>
                <span className="hint">These don’t feed another goal yet. Their owners can link them from Edit, under Feeds into.</span>
              </div>
              <TreeRows nodes={loose.map((g) => ({ goal: g, children: [] }))} />
            </section>
          )}
        </>
      )}

      {!alt && show === 'attention' && (att.length
        ? <div className="alist">{att.map((a) => <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id} />)}</div>
        : <div className="calm"><span aria-hidden="true">✓</span> Nothing is off track, stale or slipping.</div>)}

      {!alt && show === 'levels' && LEVELS.map((l) => {
        const list = app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app));
        if (!list.length) return null;
        return (
          <section key={l} className="block" aria-label={LEVEL_LABEL[l]}>
            <div className="row between nowrap">
              <h2 className="block-title">{LEVEL_LABEL[l]} <span className="hint">· {list.length}</span></h2>
              <Chip k={worst(list.map((g) => app.statusOf(g).status))} />
            </div>
            <ul className="tree">{list.map((g) => <li key={g.id}><TreeRow g={g} /></li>)}</ul>
          </section>
        );
      })}

      {!alt && show === 'teams' && app.snapshot.teams.map((t) => {
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

      {!alt && show === 'watching' && <WatchingBody />}

      {!alt && show === 'mine' && <div className="glist">{mine.map((g) => <GoalLine key={g.id} g={g} />)}</div>}
    </div>
  );
}
