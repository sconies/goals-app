import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { periodLabel } from '../domain/year';
import { attentionGroup, attentionList, splitAttention } from '../domain/attention';
import { LEVEL_LABEL } from '../domain/format';
import { wrapUpOpen } from '../domain/cycle';
import type { Level } from '../domain/types';
import { LABEL, worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty, StatusShape } from '../ui/bits';
import { GoalRow, TreeCard, TreeRows } from '../ui/goalRows';
import { statusCounts, worstFirst, worstGroupsFirst } from '../domain/order';
import { HandledGroup } from '../ui/HandledGroup';
import { WatchingBody } from './Watching';
import { watchedGoals } from '../domain/review';
import type { Goal } from '../domain/types';
import type { TreeNode } from '../domain/tree';
import { forgetGoneLayout, GONE_LAYOUT, GONE_LAYOUT_NOTE, LayoutMenu, LayoutSwitch, useLayout, type ViewGroup } from './GoalViews';
import { GoalTable } from './GoalTable';
import { GoalBoard } from './GoalBoard';
import { HistoryGrid } from './GoalHistory';
import { StatusLegend } from '../ui/StatusLegend';
import { Place } from '../core/app';
import { FilterBar, useGoalQuery, useLatestParams, useViews, viewParams } from './GoalFilters';
import { MenuButton } from '../ui/MenuButton';
import { applyQuery, EMPTY_QUERY, filters, SORT_OPTIONS } from '../domain/query';
import { goalWords, nearMiss } from '../domain/find';
import { NoneFound } from '../ui/ListBar';
import { usePrefs } from '../app/search';
import { attentionCount, goalsLine, GROUPS, movedGoals, ownGroup, scopesFor, type Group, type Scope } from '../domain/goalsPage';

const GOAL_WORDS = { thing: 'goal', things: 'goals' };
import { summariseAll } from '../domain/summary';
import { withAncestors } from '../domain/map';
import { FirstReports } from '../ui/FirstReports';
import { ATTENTION, HANDLED_LINE } from '../domain/vocabulary';

// The map loads only when someone opens it, so the rest of the app stays small.
const GoalMap = lazy(() => import('./GoalMap').then((m) => ({ default: m.GoalMap })));

type Show = 'outcomes' | 'attention' | 'levels' | 'teams' | 'mine' | 'watching';
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Goals, starting from the trees: each top goal, then what feeds it, worst first. */
export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const latest = useLatestParams();
  // Needs attention is new information; what someone has looked at since its latest check-in is being handled.
  const { needs: att, handled } = useMemo(() => splitAttention(attentionList(app.snapshot, app.cycle, app.today)), [app.snapshot, app.cycle, app.today]);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  // Whose goals (the scope), how they're arranged (the group) and the Needs attention switch (goals spec, rules 1–3).
  const prefs = usePrefs();
  const scopeFacts = useMemo(() => ({
    goals: app.snapshot.goals.filter((g) => !g.stoppedAt).map((g) => ({ id: g.id, ownerId: g.ownerId, teamId: g.teamId })),
    viewerId: app.viewer.id,
    teams: app.snapshot.teams.filter((t) => t.id === app.viewer.teamId || t.leadId === app.viewer.id).map((t) => ({ id: t.id, name: t.name })),
    watched: new Set(watchedGoals(app.viewer.id, app.snapshot).map((g) => g.id)),
  }), [app.snapshot, app.viewer.id, app.viewer.teamId]);
  const { tabs: scopeTabs, opens } = scopesFor(scopeFacts, prefs.get<Scope>(app.ws.id, app.viewer.id, 'goals-scope'));
  const hasScope = (x: Scope) => scopeTabs.some((t) => t.id === x);
  // Old addresses (show=…, a filter with no scope, a bare /goals) say what they meant, replacing the entry (rule 6).
  // A filter naming a team, person or goal the workspace doesn't have is dropped, and the page says so (spec 2.1, item 7).
  const [moved, setMoved] = useState<{ text: string; at: string; from: string } | null>(null);
  const loaded = app.snapshot.people.length > 0;
  useEffect(() => {
    // Said until the address moves on from the one it fixed (or the one it came from, before the fix lands).
    if (moved && params.toString() !== moved.at && params.toString() !== moved.from) setMoved(null);
    if (!loaded) return;
    const said: string[] = [];
    let next = latest();
    // Cards has gone: a link or a remembered layout that says it opens in List, said once.
    if (next.get('view') === GONE_LAYOUT) { next.delete('view'); said.push(GONE_LAYOUT_NOTE); }
    else if (forgetGoneLayout()) said.push(GONE_LAYOUT_NOTE);
    const old = movedGoals(next.toString(), opens, hasScope);
    if (old) { next = new URLSearchParams(old.search); if (old.note) said.push(old.note); }
    const keep = (key: string, known: (id: string) => boolean, what: string) => {
      const ids = (next.get(key) ?? '').split(',').filter(Boolean);
      const gone = ids.filter((id) => !known(id));
      if (!gone.length) return;
      const left = ids.filter(known);
      if (left.length) next.set(key, left.join(',')); else next.delete(key);
      said.push(`No ${what} “${gone.join('”, “')}” in ${app.ws.name}, so that filter is off.`);
    };
    keep('team', (id) => !!app.team(id), 'team');
    keep('owner', (id) => !!app.person(id), 'person');
    keep('feeds', (id) => !!app.goal(id), 'goal');
    if (next.toString() === params.toString() && !said.length) return;
    if (said.length) setMoved({ text: said.join(' '), at: next.toString(), from: params.toString() });
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, opens, loaded]);
  const scope: Scope = hasScope(params.get('scope') as Scope) ? (params.get('scope') as Scope) : opens;
  useEffect(() => { if (params.get('scope')) prefs.set(app.ws.id, app.viewer.id, 'goals-scope', scope); }, [scope, params, prefs, app.ws.id, app.viewer.id]);
  const scopeTab = scopeTabs.find((t) => t.id === scope)!;
  const inScope = useMemo(() => new Set(scopeTab.ids), [scopeTab]);
  const group: Group = (GROUPS.some(([k]) => k === params.get('group')) ? params.get('group') : ownGroup(scope)) as Group;
  const switchOn = params.get('attention') === '1' || !!params.get('needs');
  const show: Show = switchOn ? 'attention' : group === 'tree' ? 'outcomes' : group === 'team' ? 'teams' : group === 'level' ? 'levels' : scope === 'watching' ? 'watching' : 'mine';
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const [layout, setLayout] = useLayout();
  const flat = (n: TreeNode, depth = 0): { goal: Goal; depth: number }[] => [{ goal: n.goal, depth }, ...n.children.flatMap((c) => flat(c, depth + 1))];
  const one = (key: string, title: string, goals: Goal[]): ViewGroup => ({ key, title, rows: goals.map((goal) => ({ goal, depth: 0 })) });
  // Built once per change to the goals, so the views' summaries aren't recomputed on every render.
  const grouped: ViewGroup[] = useMemo(() => show === 'outcomes'
    ? [...trees.map((t) => ({ key: t.goal.id, title: t.goal.title, rows: flat(t) })), ...(loose.length ? [{ ...one('loose', 'Not linked', loose), hint: 'These don’t feed another goal yet.' }] : [])]
    : show === 'attention' ? [one('attention', ATTENTION.needs.label, att.map((a) => a.goal)), ...(handled.length ? [{ ...one('handled', ATTENTION.handled.label, handled.map((a) => a.goal)), hint: HANDLED_LINE }] : [])]
    : show === 'levels' ? LEVELS.map((l) => one(l, LEVEL_LABEL[l], app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'teams' ? teamsWorstFirst(app).map(({ team: t, goals }) => one(t.id, t.name, goals))
    : show === 'mine' ? [one('mine', scopeTab.label, app.snapshot.goals.filter((g) => inScope.has(g.id)).sort(worstFirst(app)))]
    : [one('watching', 'Watching', watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app)))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show, app.snapshot, app.viewer.id, att, handled, inScope]);
  // Search, filters and sort apply on top of the grouping, in every layout and in exports.
  const [query, setQuery] = useGoalQuery();
  const narrowed = filters(query);
  const refined = narrowed || !!query.sort || scope !== 'all';
  const attentionOn = query.attention || query.needs.length > 0;
  // A search that finds nothing tries a near miss (find rule 5): the goals that match it are shown, and said so.
  const [ranked, near] = useMemo((): [string[] | null, string | null] => {
    if (!refined) return [null, null];
    const sums = summariseAll(app.snapshot.goals.filter((g) => inScope.has(g.id)), app.snapshot, app.cycle, app.today, app.week);
    const ctx = { goals: app.snapshot.goals, cycle: app.cycle, week: app.week };
    const ids = applyQuery(sums, query, ctx).map((x) => x.goal.id);
    if (ids.length || !query.q.trim()) return [ids, null];
    const fix = nearMiss(query.q, sums.map(goalWords));
    const again = fix ? applyQuery(sums, { ...query, q: fix }, ctx).map((x) => x.goal.id) : [];
    return again.length ? [again, fix] : [ids, null];
  }, [refined, query, app.snapshot, app.cycle, app.today, app.week, inScope]);
  const views = useViews();
  const activeView = views.find((v) => v.params === viewParams(params));
  // The saved views, once for both places the Views menu sits: beside the tabs, or on a phone beside New goal.
  const viewItems = views.map((v) => ({ label: v.name + (v.pinned ? ' (pinned)' : ''), current: activeView?.id === v.id, onClick: () => openView(v) }));
  const fitted: ViewGroup[] = useMemo(() => {
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
  const groups: ViewGroup[] = useMemo(() => {
    let list = fitted;
    // Sorted, the trees are one list across every tree (outside review, 9 Nov, backlog GP): worst first means the
    // worst goals anywhere, not the worst of each tree. Clear the sort and they are trees again.
    if (ranked && query.sort && show === 'outcomes' && list.length) {
      const pos = new Map(ranked.map((id, i) => [id, i]));
      const rows = list.flatMap((g) => g.rows).sort((a, b) => pos.get(a.goal.id)! - pos.get(b.goal.id)!);
      const by = SORT_OPTIONS.find(([k]) => k === query.sort)?.[1] ?? '';
      list = [{ key: 'all', title: 'Every tree', rows, hint: `${by}, across every tree. Clear the sort to see them as trees.` }];
    }
    // Filtered to Needs attention, any tab lists the goals that need attention first and those being handled below
    // them, as the Needs attention tab does (Lane, 9 Nov): nothing is hidden, and nothing is counted twice.
    if (!attentionOn || show === 'attention') return list;
    const rows = [...new Map(list.flatMap((g) => g.rows).map((r) => [r.goal.id, { goal: r.goal, depth: 0 }] as const)).values()];
    const of = (k: 'needs' | 'handled') => rows.filter((r) => attentionGroup(app.attentionOf(r.goal)) === k);
    return [
      { key: 'attention', title: ATTENTION.needs.label, rows: of('needs') },
      { key: 'handled', title: ATTENTION.handled.label, rows: of('handled'), hint: HANDLED_LINE },
    ].filter((g) => g.rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitted, ranked, query.sort, attentionOn, show, app.snapshot]);
  const shown = [...new Map(groups.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  // On the map, a filtered goal keeps the goals it feeds into, so it isn't cut off from its tree.
  const mapGoals = narrowed ? (() => { const keep = withAncestors(app.snapshot.goals, new Set(shown.map((g) => g.id))); return app.snapshot.goals.filter((g) => keep.has(g.id)); })() : shown;
  const alt = layout !== 'list';
  // The switch's count (rule 3): the scope's goals needing attention, after the search and filters.
  const sumsInScope = useMemo(() => summariseAll(app.snapshot.goals.filter((g) => inScope.has(g.id)), app.snapshot, app.cycle, app.today, app.week), [app.snapshot, inScope, app.cycle, app.today, app.week]);
  const switchCount = useMemo(() => attentionCount(sumsInScope, query, { goals: app.snapshot.goals, cycle: app.cycle, week: app.week }), [sumsInScope, query, app.snapshot.goals, app.cycle, app.week]);
  const shownIds = new Set(shown.map((g) => g.id));
  const line = goalsLine(sumsInScope.filter((x) => shownIds.has(x.goal.id)), narrowed, query.sort ? (SORT_OPTIONS.find(([k]) => k === query.sort)?.[1] ?? '').toLowerCase() : group === 'tree' ? 'as trees' : 'worst first', switchOn);
  const linkNote = moved?.text ?? null;
  // Each kind of view gets the room it needs: a list reads best narrow, a table or board wants width, the map wants everything.
  const frame = (!alt ? 'page' : layout === 'map' ? 'page full' : 'page wide') + ' goals-page' + (show === 'watching' && !alt ? ' watching' : '');
  // Watching is a scope of Goals (one Watching, 5 Nov): the same toolbar, filters and layouts, and in the list its own
  // groups beside what changed this week. Sorted, it's a plain list in that order, like any other scope.
  const watchingList = show === 'watching' && !alt && !query.sort;
  // A view saved in Cards opens with its old address, so the line that says Cards has gone is said once (useBadLinks).
  const openView = (v: { id: string; params: string }) => { const now = latest(), p = new URLSearchParams(app.snapshot.views?.find((x) => x.id === v.id)?.params ?? v.params); for (const k of ['today', 'store']) { const x = now.get(k); if (x) p.set(k, x); } setParams(p); };
  // A choice adds a history entry (find spec, rule 4). Choosing a scope keeps the search and filters; its own group returns.
  const pickScope = (k: Scope) => { if (scope === k && !activeView) return; const p = latest(); p.set('scope', k); p.delete('group'); p.delete('show'); setParams(p); };
  const pickGroup = (k: Group) => { const p = latest(); if (k === ownGroup(scope)) p.delete('group'); else p.set('group', k); setParams(p); };
  const toggleSwitch = () => setQuery((cur) => (cur.attention || cur.needs.length ? { ...cur, attention: false, needs: [] } : { ...cur, attention: true }), { push: true });
  const viewName = scopeTab.label;
  // The selected tab is always in view, even when it's past the edge of a row that scrolls sideways.
  const tabRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.offsetLeft, right = left + tab.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left - 4);
    else if (right > row.scrollLeft + row.clientWidth - 24) row.scrollLeft = right - row.clientWidth + 24;
  }, [scope, activeView?.id]);
  return (
    <div className={frame} data-part={show === 'watching' ? 'Watching' : 'Goals'}>
      {/* A short header, so the goals start near the top: the title and the one creating action, then one toolbar. */}
      {/* A phone draws no title (its top bar names the page); this one is for screen readers there. */}
      <h1 className="sr goals-sr-title">{show === 'watching' ? 'Watching' : 'Goals'}</h1>
      <div className="page-head row between goals-head" data-part="Views, search and filters">
        <span className="goals-title">
          <h1 className="title-xl">{show === 'watching' ? 'Watching' : 'Goals'}</h1>
          {/* The week line breaks only between its parts, never inside one. */}
          <span className="hint goals-period">{periodLabel(app.cycle, app.week).split(' · ').map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className="nb">{part}</span></Fragment>)}</span>
        </span>
        {/* New goal is a quiet link here (Lane, 9 Nov): people seldom make one, so it isn't the page's big button. The sidebar's New goal is one step from anywhere. */}
        <span className="actions">{wrapUpOpen(app.cycle, app.week) && <Link className="btn" to="/retro">Wrap up</Link>}<Link className="btn ghost sm new-goal-quiet" to="/goals/new">New goal</Link></span>
      </div>
      {/* On a phone, the goals come first (backlog G, Lane's markup, 9 Nov): which goals and how to see them are two
          choices on one line, instead of two rows of tabs, a row of layouts and a row for the download. The Views menu
          says the open view and its count, and holds the views, the saved views and Export these goals. */}
      {app.snapshot.goals.length > 0 && (
        <div className="goals-phonebar" data-part="Views and layout">
          <MenuButton className="views-menu show-menu" label="Views" summary=""
            display={<><span className="sr">Views: </span><span className="show-name">{activeView?.name ?? viewName}</span><span className="sr">, </span><span className="tabcount">{refined || activeView ? shown.length : scopeTab.ids.length}</span><span className="sr"> goals</span></>}
            items={[
              ...scopeTabs.map((t) => ({ section: 'Whose goals', label: t.label, count: t.ids.length, current: scope === t.id && !activeView, onClick: () => pickScope(t.id) })),
              ...(layout !== 'map' && !switchOn ? GROUPS.map(([k, l]) => ({ section: 'Group', label: l, current: group === k, onClick: () => pickGroup(k) })) : []),
              ...views.map((v) => ({ section: 'Saved views', label: v.name + (v.pinned ? ' (pinned)' : ''), current: activeView?.id === v.id, onClick: () => openView(v) })),
            ]}
            extra={<Place name="goals.tools" goals={shown} viewName={viewName} inMenu />} />
          <LayoutMenu layout={layout} onChange={setLayout} />
        </div>
      )}
      {/* One toolbar: which goals on the left, how to see them on the right. It wraps on a narrow screen. */}
      <div className="goals-toolbar">
        <div className="goals-tabs">
          <div className="seg tabs one-row" role="tablist" aria-label="Whose goals" ref={tabRow}>
            {scopeTabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={scope === t.id && !activeView} onClick={() => pickScope(t.id)}>
                {t.label}<span className="tabcount">{t.ids.length}</span>
              </button>
            ))}
            {/* A saved view is a tab only while it's open; the rest wait in the Views menu. */}
            {activeView && (
              <button role="tab" className="view-tab" aria-selected title={activeView.pinned ? 'Pinned for everyone' : 'Your saved view'} onClick={() => openView(activeView)}>
                {activeView.name}
              </button>
            )}
          </div>
          {views.length > 0 && <MenuButton className="views-menu views-menu-wide" label="Views" items={viewItems} />}
        </div>
        {app.snapshot.goals.length > 0 && (
          <div className="row view-bar">
            <LayoutSwitch layout={layout} onChange={setLayout} />
            {/* Modules' tools for these goals (the goals.tools place): the spreadsheets module's quiet Export these goals. */}
            <span className="row io-buttons" style={{ gap: 'var(--s2)' }}>
              <Place name="goals.tools" goals={shown} viewName={viewName} />
            </span>
          </div>
        )}
      </div>

      {/* The list bar: search, the Needs attention switch, Filters, Sort, Group (goals spec, 2.1); then the count line. */}
      {app.snapshot.goals.length > 0 && <FilterBar
        lead={<button type="button" className="btn attention-switch" aria-pressed={switchOn} onClick={toggleSwitch}>{ATTENTION.needs.label} · {switchCount}</button>}
        trail={layout !== 'map' && <MenuButton className="group-menu" label="Group" display={switchOn ? 'Group: needs attention first' : `Group: ${GROUPS.find(([k]) => k === group)![1]}`}
          items={switchOn ? [{ label: `${ATTENTION.needs.label} has its own two groups` }] : GROUPS.map(([k, l]) => ({ label: l, current: group === k, onClick: () => pickGroup(k) }))} />}
        after={<>
          {/* On a phone the switch has a row of its own under the search (goals spec, 2.4); in the bar it's hidden there. */}
          <div className="goals-phone-switch"><button type="button" className="btn attention-switch" aria-pressed={switchOn} onClick={toggleSwitch}>{ATTENTION.needs.label} · {switchCount}</button></div>
          {/* The one count line (rule 4); the filter line follows it. */}
          {line && <p className="small goals-line" role="status">{line}</p>}
        </>} />}

      {linkNote && <p className="hint link-note" role="status">{linkNote}</p>}
      {/* Until every goal has had its first check-in, the switch says how far that has got (goals spec, 2.1, item 6). */}
      {switchOn && <FirstReports />}
      {refined && (shown.length === 0 || near) && <NoneFound things={GOAL_WORDS} q={query.q} filtered={filters({ ...query, q: '' })} near={near} onClearSearch={() => setQuery((cur) => ({ ...cur, q: '' }))} onClearFilters={() => setQuery((cur) => ({ ...EMPTY_QUERY, q: cur.q, sort: cur.sort, dir: cur.dir }))} />}
      {!app.snapshot.goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
      {alt && !refined && app.snapshot.goals.length > 0 && !shown.length && (show === 'watching' ? <WatchingBody goals={shown} /> : <div className="calm"><Icon name="check-circle" size={15} /> {show === 'attention' ? 'Nothing is off track, stale or slipping.' : 'No goals here.'}</div>)}
      {alt && shown.length > 0 && layout === 'table' && <GoalTable groups={groups} />}
      {alt && shown.length > 0 && layout === 'board' && <GoalBoard groups={groups} />}
      {alt && shown.length > 0 && layout === 'history' && <HistoryGrid groups={groups} />}
      {alt && shown.length > 0 && layout === 'map' && <Suspense fallback={<div className="map-wait" role="status">Drawing the map…</div>}><GoalMap goals={mapGoals} matches={narrowed ? new Set(shown.map((g) => g.id)) : undefined} attention={query.attention} onAttention={(on) => setQuery((cur) => ({ ...cur, attention: on, needs: on ? cur.needs : [] }))} /></Suspense>}

      {/* Filtered or sorted, the list is each group's matching goals, in order. */}
      {!alt && refined && !watchingList && groups.map((g) => (
        <section key={g.key} className="block" aria-label={g.title} data-part={g.title}>
          <h2 className="block-title">{g.title} <span className="hint">· {g.rows.length}</span></h2>
          {g.hint && <p className="hint group-hint">{g.hint}</p>}
          <ul className="tree">{g.rows.map((r) => <li key={r.goal.id}><GoalRow g={r.goal} /></li>)}</ul>
        </section>
      ))}

      {!alt && !refined && show === 'outcomes' && (
        <>
          {trees.map((t) => (
            <section key={t.goal.id} className="outcome" aria-label={t.goal.title} data-part={t.goal.title}>
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
        : <div className="calm"><Icon name="check-circle" size={15} /> Nothing new is off track, stale or slipping.</div>)}
      {!alt && !refined && show === 'attention' && <HandledGroup list={handled} />}

      {!alt && !refined && show === 'levels' && LEVELS.map((l) => {
        const list = app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app));
        if (!list.length) return null;
        return (
          <section key={l} className="block" aria-label={LEVEL_LABEL[l]} data-part={LEVEL_LABEL[l]}>
            <div className="row between nowrap">
              <h2 className="block-title">{LEVEL_LABEL[l]} <span className="hint">· {list.length}</span></h2>
              <Chip k={worst(list.map((g) => app.statusOf(g).status))} />
            </div>
            <ul className="tree">{list.map((g) => <li key={g.id}><GoalRow g={g} /></li>)}</ul>
          </section>
        );
      })}

      {/* Teams worst first, each with its goals counted by status, shape and word (U24): which team needs a word is
          the first thing a leader reads, not something to work out from fourteen headers. */}
      {!alt && !refined && show === 'teams' && teamsWorstFirst(app).map(({ team: t, goals: list }) => {
        const counts = statusCounts(list.map((g) => app.statusOf(g).status));
        return (
          <section key={t.id} className="block" aria-label={t.name} data-part={t.name}>
            <div className="stack team-head" style={{ gap: 2, minWidth: 0 }}>
              <h2 className="block-title">{t.name} <span className="hint">· {list.length}</span></h2>
              <span className="team-counts" aria-label={`${t.name}: ${counts.map((c) => `${c.n} ${LABEL[c.status].toLowerCase()}`).join(', ')}`}>
                {counts.map((c) => <span key={c.status} className={'team-count tone-' + c.status}><StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}</span>)}
              </span>
              {t.objective && <span className="hint team-objective">{t.objective}</span>}
            </div>
            {/* The same row as every other tab: shape and word, the title and reason, the number over its gap. */}
            <ul className="tree">{list.map((g) => <li key={g.id}><GoalRow g={g} /></li>)}</ul>
          </section>
        );
      })}

      {watchingList && (shown.length > 0 || !refined) && <WatchingBody goals={shown} />}

      {!alt && !refined && show === 'mine' && <ul className="tree">{[...mine].sort(worstFirst(app)).map((g) => <li key={g.id}><GoalRow g={g} showOwner={false} /></li>)}</ul>}
      {/* The key sits after the goals: every row already shows its status in words. */}
      {app.snapshot.goals.length > 0 && shown.length > 0 && layout !== 'map' && <StatusLegend />}
      {/* A phone has no page title (its top bar says Goals), so New goal closes the page. */}
      <p className="row goals-phone-end"><Link className="btn ghost sm" to="/goals/new">New goal</Link></p>
    </div>
  );
}



/** The teams that have goals, worst first (domain/order.ts worstGroupsFirst), each with its goals worst first (U24). */
function teamsWorstFirst(app: ReturnType<typeof useApp>) {
  const teams = app.snapshot.teams.map((team) => ({ team, goals: app.snapshot.goals.filter((g) => g.teamId === team.id).sort(worstFirst(app)) })).filter((t) => t.goals.length);
  return worstGroupsFirst(teams, (t) => t.goals.map((g) => app.statusOf(g).status), (t) => t.team.name);
}
