import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { periodLabel } from '../domain/year';
import { attentionGroup, attentionList, splitAttention } from '../domain/attention';
import { LEVEL_LABEL } from '../domain/format';
import { wrapUpOpen } from '../domain/cycle';
import type { Level } from '../domain/types';
import { worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty, EmptyResult } from '../ui/bits';
import { GoalRow, TreeCard, TreeRows } from '../ui/goalRows';
import { worstFirst } from '../domain/order';
import { HandledGroup } from '../ui/HandledGroup';
import { WatchingBody } from './Watching';
import { watchedGoals } from '../domain/review';
import type { Goal } from '../domain/types';
import type { TreeNode } from '../domain/tree';
import { forgetGoneLayout, GONE_LAYOUT, GONE_LAYOUT_NOTE, LAYOUT_ABOUT, LAYOUTS, LayoutMenu, LayoutSwitch, useLayout, type ViewGroup } from './GoalViews';
import { GoalTable } from './GoalTable';
import { GoalBoard } from './GoalBoard';
import { HistoryGrid } from './GoalHistory';
import { StatusLegend } from '../ui/StatusLegend';
import { Place } from '../core/app';
import { FilterBar, useGoalQuery, useLatestParams, useViews, viewParams } from './GoalFilters';
import { MenuButton } from '../ui/MenuButton';
import { applyQuery, EMPTY_QUERY, filters, SORT_OPTIONS } from '../domain/query';
import { summariseAll } from '../domain/summary';
import { withAncestors } from '../domain/map';
import { FirstReports } from '../ui/FirstReports';
import { HealthLine } from '../ui/HealthLine';
import { ATTENTION, ATTENTION_FLAGS, STATUS, STATUS_ORDER } from '../domain/vocabulary';
import type { GoalAttention } from '../domain/attention';

// The map loads only when someone opens it, so the rest of the app stays small.
const GoalMap = lazy(() => import('./GoalMap').then((m) => ({ default: m.GoalMap })));

type Show = 'outcomes' | 'attention' | 'levels' | 'teams' | 'mine' | 'watching';
const SHOWS: Show[] = ['outcomes', 'attention', 'levels', 'teams', 'mine', 'watching'];
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Goals, starting from the trees: each top goal, then what feeds it, worst first. */
export function GoalsScreen() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const latest = useLatestParams();
  // Needs attention is new information; what someone has looked at since its latest check-in is being handled.
  const { needs: att, handled } = useMemo(() => splitAttention(attentionList(app.snapshot, app.cycle, app.today)), [app.snapshot, app.cycle, app.today]);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  // A tab the address names that isn't one (a mistyped or old link) is Trees, with a line saying so (badLinks, below).
  const asked = params.get('show');
  const show: Show = asked && SHOWS.includes(asked as Show) && (asked !== 'mine' || mine.length > 0) ? (asked as Show) : 'outcomes';
  const watchedCount = useMemo(() => watchedGoals(app.viewer.id, app.snapshot).length, [app.viewer.id, app.snapshot]);
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const [layout, setLayout] = useLayout();
  const flat = (n: TreeNode, depth = 0): { goal: Goal; depth: number }[] => [{ goal: n.goal, depth }, ...n.children.flatMap((c) => flat(c, depth + 1))];
  const one = (key: string, title: string, goals: Goal[]): ViewGroup => ({ key, title, rows: goals.map((goal) => ({ goal, depth: 0 })) });
  // Built once per change to the goals, so the views' summaries aren't recomputed on every render.
  const grouped: ViewGroup[] = useMemo(() => show === 'outcomes'
    ? [...trees.map((t) => ({ key: t.goal.id, title: t.goal.title, rows: flat(t) })), ...(loose.length ? [{ ...one('loose', 'Not linked', loose), hint: 'These don’t feed another goal yet.' }] : [])]
    : show === 'attention' ? [one('attention', ATTENTION.needs.label, att.map((a) => a.goal)), ...(handled.length ? [{ ...one('handled', ATTENTION.handled.label, handled.map((a) => a.goal)), hint: ATTENTION.handled.meaning }] : [])]
    : show === 'levels' ? LEVELS.map((l) => one(l, LEVEL_LABEL[l], app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'teams' ? app.snapshot.teams.map((t) => one(t.id, t.name, app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'mine' ? [one('mine', 'Mine', [...mine].sort(worstFirst(app)))]
    : [one('watching', 'Watching', watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app)))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show, app.snapshot, app.viewer.id, att, handled]);
  // Search, filters and sort apply on top of the grouping, in every layout and in exports.
  const [query, setQuery] = useGoalQuery();
  const narrowed = filters(query);
  const refined = narrowed || !!query.sort;
  const attentionOn = query.attention || query.needs.length > 0;
  const ranked = useMemo(() => {
    if (!refined) return null;
    const sums = summariseAll(app.snapshot.goals, app.snapshot, app.cycle, app.today, app.week);
    return applyQuery(sums, query, { goals: app.snapshot.goals, cycle: app.cycle, week: app.week }).map((x) => x.goal.id);
  }, [refined, query, app.snapshot, app.cycle, app.today, app.week]);
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
      { key: 'handled', title: ATTENTION.handled.label, rows: of('handled'), hint: ATTENTION.handled.meaning },
    ].filter((g) => g.rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitted, ranked, query.sort, attentionOn, show, app.snapshot]);
  const shown = [...new Map(groups.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  const everyone = [...new Map(grouped.flatMap((g) => g.rows.map((r) => [r.goal.id, r.goal] as const))).values()];
  // On the map, a filtered goal keeps the goals it feeds into, so it isn't cut off from its tree.
  const mapGoals = narrowed ? (() => { const keep = withAncestors(app.snapshot.goals, new Set(shown.map((g) => g.id))); return app.snapshot.goals.filter((g) => keep.has(g.id)); })() : shown;
  const alt = layout !== 'list';
  const tabs: [Show, string, number | null][] = [
    ['outcomes', 'Trees', null],
    ['attention', ATTENTION.needs.label, att.length],
    ['levels', 'By level', null],
    ['teams', 'By team', null],
    ...(mine.length ? [['mine', 'Mine', mine.length] as [Show, string, number]] : []),
    ['watching', 'Watching', watchedCount],
  ];

  const linkNote = useBadLinks(asked, show, mine.length);

  // Each kind of view gets the room it needs: a list reads best narrow, a table or board wants width, the map wants everything.
  const frame = (!alt ? 'page' : layout === 'map' ? 'page full' : 'page wide') + ' goals-page' + (show === 'watching' && !alt ? ' watching' : '');
  // Watching is a scope of Goals (one Watching, 5 Nov): the same toolbar, filters and layouts, and in the list its own
  // groups beside what changed this week. Sorted, it's a plain list in that order, like any other scope.
  const watchingList = show === 'watching' && !alt && !query.sort;
  // A view saved in Cards opens with its old address, so the line that says Cards has gone is said once (useBadLinks).
  const openView = (v: { id: string; params: string }) => { const now = latest(), p = new URLSearchParams(app.snapshot.views?.find((x) => x.id === v.id)?.params ?? v.params); for (const k of ['today', 'store']) { const x = now.get(k); if (x) p.set(k, x); } setParams(p); };
  const pickTab = (k: Show) => { if (show === k && !activeView) return; const p = latest(); if (k === 'outcomes') p.delete('show'); else p.set('show', k); setParams(p); };
  const viewName = tabs.find(([k]) => k === show)?.[1] ?? 'Goals';
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
    <div className={frame} data-part={show === 'watching' ? 'Watching' : 'Goals'}>
      {/* A short header, so the goals start near the top: the title and the one creating action, then one toolbar. */}
      <div className="page-head row between goals-head" data-part="Views, search and filters">
        <span className="goals-title">
          <h1 className="title-xl">{show === 'watching' ? 'Watching' : 'Goals'}</h1>
          {/* The week line breaks only between its parts, never inside one. */}
          <span className="hint goals-period">{periodLabel(app.cycle, app.week).split(' · ').map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className="nb">{part}</span></Fragment>)}</span>
        </span>
        <span className="actions">{wrapUpOpen(app.cycle, app.week) && <Link className="btn" to="/retro">Wrap up</Link>}<Link className="btn" to="/goals/new">New goal</Link></span>
      </div>
      {/* On a phone, the goals come first (backlog G, Lane's markup, 9 Nov): which goals and how to see them are two
          choices on one line, instead of two rows of tabs, a row of layouts and a row for the download. The Views menu
          says the open view and its count, and holds the views, the saved views and Export these goals. */}
      {app.snapshot.goals.length > 0 && (
        <div className="goals-phonebar" data-part="Views and layout">
          <MenuButton className="views-menu show-menu" label="Views" summary=""
            display={<><span className="sr">Views: </span><span className="show-name">{activeView?.name ?? viewName}</span><span className="sr">, </span><span className="tabcount">{!refined && !activeView ? tabs.find(([k]) => k === show)?.[2] ?? shown.length : shown.length}</span><span className="sr"> goals</span></>}
            items={[
              ...tabs.map(([k, l, n]) => ({ section: 'Show', label: l, count: n, current: show === k && !activeView, onClick: () => pickTab(k) })),
              ...views.map((v) => ({ section: 'Saved views', label: v.name + (v.pinned ? ' (pinned)' : ''), current: activeView?.id === v.id, onClick: () => openView(v) })),
            ]}
            extra={<Place name="goals.tools" goals={shown} viewName={viewName} inMenu />} />
          <LayoutMenu layout={layout} onChange={setLayout} />
        </div>
      )}
      {/* One toolbar: which goals on the left, how to see them on the right. It wraps on a narrow screen. */}
      <div className="goals-toolbar">
        <div className="goals-tabs">
          <div className="seg tabs one-row" role="tablist" aria-label="Show" ref={tabRow}>
            {tabs.map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={show === k && !activeView} onClick={() => pickTab(k)}>
                {l}{n != null && <span className="tabcount" title={k === 'attention' ? attentionBadge(att.length, handled.length) : undefined}>{n}</span>}
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

      {/* What the open layout is, and the health of the goals shown (backlog GP), on one line so the goals stay high. */}
      {app.snapshot.goals.length > 0 && (
        <div className="goals-about">
          <p className="hint layout-about" aria-live="polite"><span className="strong">{LAYOUTS.find(([k]) => k === layout)?.[1]}</span>: {LAYOUT_ABOUT[layout]}</p>
          {shown.length > 0 && <HealthLine goals={shown} />}
        </div>
      )}
      {app.snapshot.goals.length > 0 && <FilterBar count={shown.length} total={everyone.length} />}
      {linkNote && <p className="hint link-note" role="status">{linkNote}</p>}
      {show === 'attention' && !activeView && att.length + handled.length > 0 && <p className="hint attention-counts">{attentionCounts(att, handled)}</p>}
      <FirstReports />
      {refined && shown.length === 0 && <EmptyResult title="No goals match" action={<button type="button" className="btn" onClick={() => setQuery((cur) => ({ ...EMPTY_QUERY, sort: cur.sort, dir: cur.dir }))}>Clear search and filters</button>}>Remove a filter above, or clear them all.</EmptyResult>}
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

      {!alt && !refined && show === 'teams' && app.snapshot.teams.map((t) => {
        const list = app.snapshot.goals.filter((g) => g.teamId === t.id).sort(worstFirst(app));
        if (!list.length) return null;
        const st = worst(list.map((g) => app.statusOf(g).status));
        return (
          <section key={t.id} className="block" aria-label={t.name} data-part={t.name}>
            <div className="row between nowrap">
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <h2 className="block-title">{t.name}</h2>
                {t.objective && <span className="hint team-objective">{t.objective}</span>}
              </span>
              <Chip k={st} />
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
    </div>
  );
}

/**
 * A link with a tab, team, owner or tree this workspace doesn't have (outside review, 9 Nov) used to draw the page with
 * no goals and no word why, or a filter called only "a team" that matched nothing. The address drops what it can't
 * use, and one short line says what was dropped, until the next change.
 */
function useBadLinks(asked: string | null, show: Show, mineCount: number): string | null {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [note, setNote] = useState<{ text: string; at: string } | null>(null);
  const loaded = app.snapshot.people.length > 0;
  useEffect(() => {
    if (note && params.toString() !== note.at) setNote(null);
    if (!loaded) return;
    const said: string[] = [];
    const next = new URLSearchParams(params);
    if (asked !== null && show !== asked) {
      next.delete('show');
      said.push(asked === 'mine' && !mineCount ? 'You don’t own any goals here, so there’s no Mine tab: these are the trees.' : `There’s no “${asked}” tab, so these are the trees.`);
    }
    const keep = (key: string, known: (id: string) => boolean, what: string) => {
      const ids = (params.get(key) ?? '').split(',').filter(Boolean);
      const gone = ids.filter((id) => !known(id));
      if (!gone.length) return;
      const left = ids.filter(known);
      if (left.length) next.set(key, left.join(',')); else next.delete(key);
      said.push(`No ${what} “${gone.join('”, “')}” in ${app.ws.name}, so that filter is off.`);
    };
    // Cards went on 9 Nov (Lane): a link or saved view that names it, or a remembered choice of it, opens the list.
    if (params.get('view') === GONE_LAYOUT) { next.delete('view'); said.push(GONE_LAYOUT_NOTE); }
    else if (forgetGoneLayout()) said.push(GONE_LAYOUT_NOTE);
    keep('team', (id) => !!app.team(id), 'team');
    keep('owner', (id) => !!app.person(id), 'person');
    keep('feeds', (id) => !!app.goal(id), 'goal');
    if (!said.length) return;
    setNote({ text: said.join(' '), at: next.toString() });
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loaded]);
  return note?.text ?? null;
}

/** What the Needs attention tab's count counts, on the count itself (Lane, 9 Nov): the first group, not the second. */
export function attentionBadge(needs: number, handled: number): string {
  return `${needs} ${needs === 1 ? 'needs' : 'need'} attention${handled ? `; ${handled} ${ATTENTION.handled.label.toLowerCase()} are listed below them and not counted` : ''}.`;
}

/**
 * What the Needs attention count counts, in words (demo review, 8 Nov, item 5): the Board groups the same goals by
 * status, so a goal flagged while on track (getting worse, a missed date, an ask waiting) is said too. The goals being
 * handled are listed below, in every layout, but not in the count (Lane, 9 Nov, backlog GP: the tab said 40 and the
 * rows 64), so the line says how many and why, and that Home's strip counts every goal by its status instead.
 */
function attentionCounts(att: GoalAttention[], handled: GoalAttention[]): string {
  const by = new Map<string, number>();
  for (const a of att) by.set(a.status.status, (by.get(a.status.status) ?? 0) + 1);
  // The statuses that are themselves a reason for attention, in the order the vocabulary gives them.
  const behind = ATTENTION_FLAGS.filter((k): k is 'off' | 'risk' | 'stale' => k in STATUS && k !== 'greener').sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
  const named = behind.filter((k) => by.get(k)).map((k) => `${by.get(k)} ${STATUS[k].label.toLowerCase()}`);
  const rest = att.length - behind.reduce((n, k) => n + (by.get(k) ?? 0), 0);
  const parts = [...named, ...(rest ? [`${rest} on track but flagged for something else (getting worse, a missed date, an ask waiting)`] : [])];
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  const first = att.length ? `${att.length} ${att.length === 1 ? 'goal needs' : 'goals need'} attention, flagged for something new that nobody has picked up yet: ${list}.` : 'Nothing new needs attention.';
  const also = handled.length ? ` Below them, ${handled.length} ${ATTENTION.handled.label.toLowerCase()}: behind, but someone has looked since the latest check-in. The count on the tab leaves those out; the list shows all ${att.length + handled.length}.` : '';
  return `${first}${also} Home counts goals by status.`;
}
