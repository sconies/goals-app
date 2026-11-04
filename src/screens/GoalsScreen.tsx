import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { periodLabel } from '../domain/year';
import { attentionList } from '../domain/attention';
import { LEVEL_LABEL } from '../domain/format';
import { wrapUpOpen } from '../domain/cycle';
import type { Level } from '../domain/types';
import { worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty, StatusShape } from '../ui/bits';
import { TreeCard, TreeRow, TreeRows, worstFirst } from './Inspect';
import { WatchingBody } from './Watching';
import { useNavMode } from '../app/navMode';
import { watchedGoals } from '../domain/review';
import type { Goal } from '../domain/types';
import type { TreeNode } from '../domain/tree';
import { GoalBoard, GoalCards, GoalTable, HistoryGrid, LayoutSwitch, StatusLegend, useLayout, type ViewGroup } from './GoalViews';
import { ExportButton, ExportSheet } from './Export';
import { FilterBar, MenuButton, useGoalQuery, useViews, viewParams } from './GoalFilters';
import { applyQuery, filters } from '../domain/query';
import { summariseAll } from '../domain/summary';
import { withAncestors } from '../domain/map';
import { firstReports } from '../domain/progress';

/** The map's "Only what needs attention": the statuses a leader acts on, as an ordinary status filter. */
const ATTENTION = ['off', 'risk', 'stale'] as const;
// The map loads only when someone opens it, so the rest of the app stays small.
const GoalMap = lazy(() => import('./GoalMap').then((m) => ({ default: m.GoalMap })));

type Show = 'outcomes' | 'attention' | 'levels' | 'teams' | 'mine' | 'watching';
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Goals, starting from the trees: each top goal, then what feeds it, worst first. */
export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const att = useMemo(() => attentionList(app.snapshot, app.cycle, app.today), [app.snapshot, app.cycle, app.today]);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const navMode = useNavMode();
  const show: Show = (params.get('show') as Show) || 'outcomes';
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const [layout, setLayout] = useLayout();
  const flat = (n: TreeNode, depth = 0): { goal: Goal; depth: number }[] => [{ goal: n.goal, depth }, ...n.children.flatMap((c) => flat(c, depth + 1))];
  const one = (key: string, title: string, goals: Goal[]): ViewGroup => ({ key, title, rows: goals.map((goal) => ({ goal, depth: 0 })) });
  // Built once per change to the goals, so the views' summaries aren't recomputed on every render.
  const grouped: ViewGroup[] = useMemo(() => show === 'outcomes'
    ? [...trees.map((t) => ({ key: t.goal.id, title: t.goal.title, rows: flat(t) })), ...(loose.length ? [{ ...one('loose', 'Not linked', loose), hint: 'These don’t feed another goal yet.' }] : [])]
    : show === 'attention' ? [one('attention', 'Needs attention', att.map((a) => a.goal))]
    : show === 'levels' ? LEVELS.map((l) => one(l, LEVEL_LABEL[l], app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'teams' ? app.snapshot.teams.map((t) => one(t.id, t.name, app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'mine' ? [one('mine', 'Mine', [...mine].sort(worstFirst(app)))]
    : [one('watching', 'Watching', watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app)))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show, app.snapshot, app.viewer.id, att]);
  // Search, filters and sort apply on top of the grouping, in every layout and in exports.
  const [query, setQuery] = useGoalQuery();
  const narrowed = filters(query);
  const refined = narrowed || !!query.sort;
  const ranked = useMemo(() => {
    if (!refined) return null;
    const sums = summariseAll(app.snapshot.goals, app.snapshot, app.cycle, app.today, app.week);
    return applyQuery(sums, query, { goals: app.snapshot.goals, cycle: app.cycle, week: app.week }).map((x) => x.goal.id);
  }, [refined, query, app.snapshot, app.cycle, app.today, app.week]);
  const views = useViews();
  const activeView = views.find((v) => v.params === viewParams(params));
  const groups: ViewGroup[] = useMemo(() => {
    if (!ranked) return grouped;
    const pos = new Map(ranked.map((id, i) => [id, i]));
    return grouped.map((g) => {
      const rows = g.rows.filter((r) => pos.has(r.goal.id));
      if (query.sort) return { ...g, rows: rows.map((r) => ({ ...r, depth: 0 })).sort((a, b) => pos.get(a.goal.id)! - pos.get(b.goal.id)!) };
      // Sorted, a group is a flat list in that order; filtered only, it keeps its tree shape. A goal whose parent is
      // filtered out isn't indented under a goal that isn't there: it sits one step in from the nearest shown ancestor.
      const depthOf = new Map<string, number>();
      const byId = new Map(g.rows.map((r) => [r.goal.id, r.goal]));
      return { ...g, rows: rows.map((r) => {
        let up = r.goal.parentId ? byId.get(r.goal.parentId) : undefined;
        while (up && !depthOf.has(up.id)) up = up.parentId ? byId.get(up.parentId) : undefined;
        const depth = up && r.depth > 0 ? depthOf.get(up.id)! + 1 : 0;
        depthOf.set(r.goal.id, depth);
        return { ...r, depth };
      }) };
    }).filter((g) => g.rows.length);
  }, [grouped, ranked, query.sort]);
  const shown = [...new Map(groups.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  const everyone = [...new Map(grouped.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  // On the map, a filtered goal keeps the goals it feeds into, so it isn't cut off from its tree.
  const mapGoals = narrowed ? (() => { const keep = withAncestors(app.snapshot.goals, new Set(shown.map((g) => g.id))); return app.snapshot.goals.filter((g) => keep.has(g.id)); })() : shown;
  const alt = layout !== 'list';
  const tabs: [Show, string, number | null][] = [
    ['outcomes', 'Trees', null],
    ['attention', 'Needs attention', att.length],
    ['levels', 'By level', null],
    ['teams', 'By team', null],
    ...(mine.length ? [['mine', 'Mine', mine.length] as [Show, string, number]] : []),
    ...(navMode === 'four' ? [['watching', 'Watching', null] as [Show, string, null]] : []),
  ];

  // Each kind of view gets the room it needs: a list reads best narrow, a table or board wants width, the map wants everything.
  const frame = (!alt ? 'page' : layout === 'map' ? 'page full' : 'page wide') + ' goals-page';
  const openView = (v: { params: string }) => { const p = new URLSearchParams(v.params); for (const k of ['today', 'store']) { const x = params.get(k); if (x) p.set(k, x); } setParams(p, { replace: true }); };
  const viewName = tabs.find(([k]) => k === show)?.[1] ?? 'Goals';
  const [exporting, setExporting] = useState(false);
  // The selected tab is always in view, even when it's past the edge of a row that scrolls sideways.
  const tabRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.offsetLeft, right = left + tab.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left - 4);
    else if (right > row.scrollLeft + row.clientWidth - 24) row.scrollLeft = right - row.clientWidth + 24;
  }, [show, activeView?.id]);
  return (
    <div className={frame}>
      {/* A short header, so the goals start near the top: the title and the one creating action, then one toolbar. */}
      <div className="page-head row between goals-head">
        <span className="goals-title">
          <h1 className="title-xl">Goals</h1>
          {/* The week line breaks only between its parts, never inside one. */}
          <span className="hint goals-period">{periodLabel(app.cycle, app.week).split(' · ').map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className="nb">{part}</span></Fragment>)}</span>
        </span>
        <span className="actions">{wrapUpOpen(app.cycle, app.week) && <Link className="btn" to="/retro">Wrap up</Link>}<Link className="btn" to="/goals/new">New goal</Link></span>
      </div>
      {/* One toolbar: which goals on the left, how to see them on the right. It wraps on a narrow screen. */}
      <div className="goals-toolbar">
        <div className="goals-tabs">
          <div className="seg tabs one-row" role="tablist" aria-label="Show" ref={tabRow}>
            {tabs.map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={show === k && !activeView} onClick={() => { const p = new URLSearchParams(params); if (k === 'outcomes') p.delete('show'); else p.set('show', k); setParams(p, { replace: true }); }}>
                {l}{n != null && <span className="tabcount">{n}</span>}
              </button>
            ))}
            {/* A saved view is a tab only while it's open; the rest wait in the Views menu. */}
            {activeView && (
              <button role="tab" className="view-tab" aria-selected title={activeView.pinned ? 'Pinned for everyone' : 'Your saved view'} onClick={() => openView(activeView)}>
                {activeView.name}
              </button>
            )}
          </div>
          {views.length > 0 && <MenuButton className="views-menu" label="Views" items={views.map((v) => ({ label: v.name + (v.pinned ? ' (pinned)' : ''), current: activeView?.id === v.id, onClick: () => openView(v) }))} />}
        </div>
        {app.snapshot.goals.length > 0 && (
          <div className="row view-bar">
            <LayoutSwitch layout={layout} onChange={setLayout} />
            <span className="row io-buttons" style={{ gap: 'var(--s2)' }}>
              <Link className="btn sm import-btn" to="/import"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 10V2m0 0 3 3M8 2 5 5M3 12.5h10" /></svg><span className="btn-label">Import</span></Link>
              <ExportButton goals={shown} viewName={viewName} />
            </span>
            {/* The smallest phones: Import and Export share one button, so the layouts and tools stay one row. */}
            <MenuButton className="io-menu" label="Import or export" icon={<Icon name="more" size={16} />} summary="" items={[{ label: 'Import', to: '/import' }, { label: 'Export', onClick: () => setExporting(true) }]} />
            {exporting && <ExportSheet goals={shown} viewName={viewName} onClose={() => setExporting(false)} />}
          </div>
        )}
      </div>

      {app.snapshot.goals.length > 0 && <FilterBar count={shown.length} total={everyone.length} />}
      <FirstReports />
      {refined && shown.length === 0 && <div className="empty-result"><span>No goals match. Remove a filter above, or clear them.</span><button type="button" className="btn" onClick={() => { const p = new URLSearchParams(); for (const k of ['today', 'store', 'view']) { const x = params.get(k); if (x) p.set(k, x); } setParams(p, { replace: true }); }}>Clear search and filters</button></div>}
      {!app.snapshot.goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
      {alt && !refined && app.snapshot.goals.length > 0 && !shown.length && (show === 'watching' ? <WatchingBody /> : <div className="calm"><StatusShape k="done" /> {show === 'attention' ? 'Nothing is off track, stale or slipping.' : 'No goals here.'}</div>)}
      {alt && shown.length > 0 && layout === 'table' && <GoalTable groups={groups} />}
      {alt && shown.length > 0 && layout === 'board' && <GoalBoard groups={groups} />}
      {alt && shown.length > 0 && layout === 'history' && <HistoryGrid groups={groups} />}
      {alt && shown.length > 0 && layout === 'cards' && <GoalCards groups={groups} />}
      {alt && shown.length > 0 && layout === 'map' && <Suspense fallback={<div className="skeleton" />}><GoalMap goals={mapGoals} matches={narrowed ? new Set(shown.map((g) => g.id)) : undefined} attention={ATTENTION.every((k) => query.status.includes(k)) && query.status.length === ATTENTION.length} onAttention={(on) => setQuery((cur) => ({ ...cur, status: on ? [...ATTENTION] : [] }))} /></Suspense>}

      {/* Filtered or sorted, the list is each group's matching goals, in order. */}
      {!alt && refined && groups.map((g) => (
        <section key={g.key} className="block" aria-label={g.title}>
          <h2 className="block-title">{g.title} <span className="hint">· {g.rows.length}</span></h2>
          <ul className="tree">{g.rows.map((r) => <li key={r.goal.id}><TreeRow g={r.goal} /></li>)}</ul>
        </section>
      ))}

      {!alt && !refined && show === 'outcomes' && (
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

      {!alt && !refined && show === 'attention' && (att.length
        ? <div className="alist">{att.map((a) => <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id} />)}</div>
        : <div className="calm"><StatusShape k="done" /> Nothing is off track, stale or slipping.</div>)}

      {!alt && !refined && show === 'levels' && LEVELS.map((l) => {
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

      {!alt && !refined && show === 'teams' && app.snapshot.teams.map((t) => {
        const list = app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app));
        if (!list.length) return null;
        const st = worst(list.map((g) => app.statusOf(g).status));
        return (
          <section key={t.id} className="block" aria-label={t.name}>
            <div className="row between nowrap">
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <h2 className="block-title">{t.name}</h2>
                {t.objective && <span className="hint team-objective">{t.objective}</span>}
              </span>
              <Chip k={st} />
            </div>
            {/* The same row as every other tab: shape and word, the title and reason, the number over its gap. */}
            <ul className="tree">{list.map((g) => <li key={g.id}><TreeRow g={g} /></li>)}</ul>
          </section>
        );
      })}

      {!alt && !refined && show === 'watching' && <WatchingBody />}

      {!alt && !refined && show === 'mine' && <ul className="tree">{[...mine].sort(worstFirst(app)).map((g) => <li key={g.id}><TreeRow g={g} showOwner={false} /></li>)}</ul>}
      {/* The key sits after the goals: every row already shows its status in words. */}
      {app.snapshot.goals.length > 0 && shown.length > 0 && layout !== 'map' && <StatusLegend />}
    </div>
  );
}

/** While goals are still waiting for their first check-in: how many are in, and who hasn't reported yet. */
export function FirstReports() {
  const app = useApp();
  const f = firstReports(app.snapshot, app.cycle, app.week);
  if (!f) return null;
  const names = f.waiting.map((w) => app.person(w.ownerId)?.name.split(' ')[0] ?? 'someone');
  const date = new Date(f.due + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <p className="first-reports small" role="status">
      <strong>{f.reported} of {f.total} goals have had their first check-in.</strong> Until they have, “nothing needs attention” only means nobody has reported.
      {' '}Waiting on {names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ')}; this week’s are due {date}.
    </p>
  );
}
