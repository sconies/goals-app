import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { countWords } from '../domain/format';
import { periodNow, wrapUpOpenOn } from '../domain/cycle';
import { attentionGroup, attentionList, splitAttention } from '../domain/attention';
import { levelIds, levelName } from '../domain/levels';
import { LABEL, worst } from '../domain/status';
import { outcomeTrees } from '../domain/tree';
import { AttentionCard, Chip, Empty, Sheet, StatusShape } from '../ui/bits';
import { GoalRow, TreeCard, TreeRows } from '../ui/goalRows';
import { statusCounts, worstFirst, worstGroupsFirst } from '../domain/order';
import { HandledGroup } from '../ui/HandledGroup';
import { WatchingBody } from './Watching';
import { watchedGoals } from '../domain/review';
import type { Goal } from '../domain/types';
import type { TreeNode } from '../domain/tree';
import { forgetGoneLayout, GONE_LAYOUT, GONE_LAYOUT_NOTE, LAYOUTS, LayoutMenu, layoutLine, layoutName, layoutsOn, MAP_OFF_NOTE, useLayout, type Layout, type ViewGroup } from './GoalViews';
import { GoalTable } from './GoalTable';
import { GoalBoard } from './GoalBoard';
import { HistoryGrid } from './GoalHistory';
import { StatusLegend } from '../ui/StatusLegend';
import { Place, useModules } from '../core/app';
import { FilterBar, useGoalQuery, useLatestParams, useViewActions } from './GoalFilters';
import { MenuButton } from '../ui/MenuButton';
import { EMPTY_QUERY, filters, SORT_OPTIONS } from '../domain/query';
import { useGoalCounts, useGoalList } from '../app/goals';
import { NoneFound } from '../ui/ListBar';
import { usePrefs } from '../app/search';
import { goalMapOn, scopeFacts, watchingOn, wrapUpOn } from '../app/reads';
import { goalsLine, GROUPS, movedGoals, ownGroup, scopesFor, type Group, type Scope } from '../domain/goalsPage';

const GOAL_WORDS = { thing: 'goal', things: 'goals' };
import { withAncestors } from '../domain/map';
import { FirstReports } from '../ui/FirstReports';
import { ATTENTION, HANDLED_LINE } from '../domain/vocabulary';

// The map loads only when someone opens it, so the rest of the app stays small.
const GoalMap = lazy(() => import('./GoalMap').then((m) => ({ default: m.GoalMap })));
// Proposed goals (GE10) are listed only with the State filter on: loaded then.
const ProposedList = lazy(() => import('./ProposedList').then((m) => ({ default: m.ProposedList })));
const StoppedList = lazy(() => import('./StoppedList').then((m) => ({ default: m.StoppedList })));

type Show = 'outcomes' | 'attention' | 'levels' | 'teams' | 'mine' | 'watching';

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
  // The facts the scope rule reads, from the one place find_goals reads them too.
  const facts = useMemo(() => scopeFacts(app.snapshot, app.viewer), [app.snapshot, app.viewer]);
  const modules = useModules();
  const mapHere = goalMapOn(modules.on);
  const { tabs: drawnTabs, every: everyScope, opens } = scopesFor(facts, prefs.get<Scope>(app.ws.id, app.viewer.id, 'goals-scope'), { watching: watchingOn(modules.on) });
  // Every address still opens (SM1): a tab that waits is drawn while it is the one open, except My team, which goes to
  // All when it isn't drawn (it is the same list).
  const hasScope = (x: Scope) => (x === 'team' ? drawnTabs : everyScope).some((t) => t.id === x);
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
    // The Goal map switched off (SW1, spec 2.6): a link or saved view that asked for the Map opens the List, said once.
    else if (next.get('view') === 'map' && !mapHere) { next.delete('view'); said.push(MAP_OFF_NOTE); }
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
    // Only while the page is still Goals: under load this effect can run after Back has already left it, and rewriting
    // the address then would pull the browser back to Goals (U20 and U58 on a phone, in a four-shard run).
    if (!/^(\/demo)?\/goals\/?$/.test(window.location.pathname)) return;
    if (said.length) setMoved({ text: said.join(' '), at: next.toString(), from: params.toString() });
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, opens, loaded, mapHere]);
  const scope: Scope = hasScope(params.get('scope') as Scope) ? (params.get('scope') as Scope) : opens;
  useEffect(() => { if (params.get('scope')) prefs.set(app.ws.id, app.viewer.id, 'goals-scope', scope); }, [scope, params, prefs, app.ws.id, app.viewer.id]);
  const scopeTab = everyScope.find((t) => t.id === scope)!;
  const scopeTabs = drawnTabs.some((t) => t.id === scope) ? drawnTabs : everyScope.filter((t) => t.id === scope || drawnTabs.includes(t));
  const inScope = useMemo(() => new Set(scopeTab.ids), [scopeTab]);
  const group: Group = (GROUPS.some(([k]) => k === params.get('group')) ? params.get('group') : ownGroup(scope)) as Group;
  const switchOn = params.get('attention') === '1' || !!params.get('needs');
  const show: Show = switchOn ? 'attention' : group === 'tree' ? 'outcomes' : group === 'team' ? 'teams' : group === 'level' ? 'levels' : scope === 'watching' ? 'watching' : 'mine';
  const { trees, loose } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  const [layout, setLayout] = useLayout(mapHere);
  const flat = (n: TreeNode, depth = 0): { goal: Goal; depth: number }[] => [{ goal: n.goal, depth }, ...n.children.flatMap((c) => flat(c, depth + 1))];
  const one = (key: string, title: string, goals: Goal[]): ViewGroup => ({ key, title, rows: goals.map((goal) => ({ goal, depth: 0 })) });
  // Built once per change to the goals, so the views' summaries aren't recomputed on every render.
  const grouped: ViewGroup[] = useMemo(() => show === 'outcomes'
    ? [...trees.map((t) => ({ key: t.goal.id, title: t.goal.title, rows: flat(t) })), ...(loose.length ? [{ ...one('loose', 'Not linked', loose), hint: 'These don’t feed another goal yet.' }] : [])]
    : show === 'attention' ? [one('attention', ATTENTION.needs.label, att.map((a) => a.goal)), ...(handled.length ? [{ ...one('handled', ATTENTION.handled.label, handled.map((a) => a.goal)), hint: HANDLED_LINE }] : [])]
    : show === 'levels' ? levelIds(app.cycle).map((l) => one(l, levelName(app.cycle, l), app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app)))).filter((g) => g.rows.length)
    : show === 'teams' ? teamsWorstFirst(app).map(({ team: t, goals }) => one(t.id, t.name, goals))
    : show === 'mine' ? [one('mine', scopeTab.label, app.snapshot.goals.filter((g) => inScope.has(g.id)).sort(worstFirst(app)))]
    : [one('watching', 'Watching', watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app)))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show, app.snapshot, app.viewer.id, att, handled, inScope]);
  // Search, filters and sort apply on top of the grouping, in every layout and in exports.
  const [query, setQuery] = useGoalQuery();
  const narrowed = filters(query);
  const refined = narrowed || !!query.sort || scope !== 'all';
  // Watching nothing, with nothing narrowed: the empty Watching page (small workspaces 2.4), never "No goals match".
  const watchingNothing = scope === 'watching' && !narrowed && !app.snapshot.watches.some((w) => w.personId === app.viewer.id);
  const attentionOn = query.attention || query.needs.length > 0;
  // A search that finds nothing tries a near miss (find rule 5): the goals that match it are shown, and said so.
  // Through the query port (AX5): the scope's goals that match, in the query's order, or its near miss's.
  const found = useGoalList(refined ? { query, scope } : null);
  const ranked = refined ? (found?.rows.map((r) => r.goal.id) ?? []) : null;
  const near = found?.near ?? null;
  // Saved views and what can be done with this one: the Views menu, or the phone's View sheet (goals spec, 2.1, 2.4).
  const actions = useViewActions();
  const { views, active: activeView } = actions;
  const [sheetOpen, setSheetOpen] = useState(false);
  // On the Map, the bar's search goes to a goal (goals spec, 2.3): the Map is told which, each time anew.
  const [goTo, setGoTo] = useState<{ id: string; n: number } | null>(null);
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
  const rowsInScope = useGoalList({ query: EMPTY_QUERY, scope })?.rows ?? [];
  const switchCount = useGoalCounts({ query, scope })?.attention ?? 0;
  const shownIds = new Set(shown.map((g) => g.id));
  const line = goalsLine(rowsInScope.filter((x) => shownIds.has(x.goal.id)), narrowed, query.sort ? (SORT_OPTIONS.find(([k]) => k === query.sort)?.[1] ?? '').toLowerCase() : group === 'tree' ? 'as trees' : 'worst first', switchOn);
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
  const groupWord = GROUPS.find(([k]) => k === group)![1];
  const onMap = layout === 'map';
  // The Group menu: the four, or why there's nothing to choose (the switch has its own two groups; the Map is the trees).
  const groupOff = onMap ? MAP_IS_TREES : switchOn ? `${ATTENTION.needs.label} has its own two groups` : null;
  const switchButton = <button type="button" className="btn attention-switch" aria-pressed={switchOn} onClick={toggleSwitch}>{ATTENTION.needs.label} · {switchCount}</button>;
  // The phone's one button for how the goals are seen: "View: List, as trees"; "View: Board"; "View: Map".
  const viewSays = `View: ${layoutName(layout)}${!onMap && !switchOn && group !== 'none' ? `, ${groupWord.toLowerCase()}` : ''}`;
  const viewItems = views.map((v) => ({ label: v.name + (v.pinned ? ' · pinned' : ''), current: activeView?.id === v.id, onClick: () => openView(v) }));
  // Proposed goals (GE10): never among these, counted apart in the count line, and listed with the State filter on.
  // Proposed and stopped goals (GE10) sit beside the list, never in it: each scope takes its own, as it takes goals.
  const scoped = (g: Goal) => scope === 'all' || (scope === 'mine' ? g.ownerId === app.viewer.id
    : scope === 'team' ? facts.teams.some((t) => t.id === g.teamId) : watchedGoals(app.viewer.id, { ...app.snapshot, goals: [...app.snapshot.goals, g] }).some((w) => w.id === g.id));
  const proposedHere = (app.snapshot.proposed ?? []).filter(scoped);
  const stateOn = params.get('state') === 'proposed';
  // "State: Stopped": this cycle's stopped goals, listed in every layout (they are on no Board or Map).
  if (params.get('state') === 'stopped') return (
    <div className="page goals-page" data-part="Goals">
      <div className="page-head row between goals-head">
        <span className="goals-title"><h1 className="title-xl">Goals</h1><span className="hint goals-period">{periodNow(app.cycle, app.today)}</span></span>
        <span className="actions"><Link className="btn ghost sm new-goal-quiet" to="/goals/new">New goal</Link></span>
      </div>
      <Suspense fallback={null}><StoppedList goals={(app.snapshot.archive?.goals ?? []).filter(scoped)} onRemove={() => { const p = latest(); p.delete('state'); setParams(p); }} /></Suspense>
    </div>
  );
  const setState = (on: boolean) => { const p = latest(); if (on) p.set('state', 'proposed'); else p.delete('state'); setParams(p); };
  const proposedLink = proposedHere.length > 0 ? <> · <a className="linkish proposed-count" href="?state=proposed" onClick={(e) => { e.preventDefault(); setState(true); }}>{proposedHere.length} proposed</a></> : null;
  // On the Map, each proposed goal is drawn in its tree, with the goals above it for context (GE10, 2.15).
  const proposedMap = stateOn && layout === 'map' ? (() => {
    const all = [...app.snapshot.goals, ...proposedHere];
    const keep = withAncestors(all, new Set(proposedHere.map((g) => g.id)));
    const ids = new Set(proposedHere.map((g) => g.id));
    return <Suspense fallback={<MapWait />}><GoalMap goals={all.filter((g) => keep.has(g.id))} matches={ids} proposed={ids} /></Suspense>;
  })() : null;
  if (stateOn) return (
    <div className={(layout === 'map' ? 'page full' : layout === 'board' ? 'page wide' : 'page') + ' goals-page'} data-part="Goals">
      <div className="page-head row between goals-head">
        <span className="goals-title"><h1 className="title-xl">Goals</h1><span className="hint goals-period">{periodNow(app.cycle, app.today)}</span></span>
        <span className="actions"><Link className="btn ghost sm new-goal-quiet" to="/goals/new">New goal</Link></span>
      </div>
      <Suspense fallback={null}><ProposedList goals={proposedHere} onRemove={() => setState(false)} layout={layout} map={proposedMap} /></Suspense>
    </div>
  );
  return (
    <div className={frame} data-part={show === 'watching' ? 'Watching' : 'Goals'}>
      {/* A phone draws no title (its top bar names the page); this one is for screen readers there. */}
      <h1 className="sr goals-sr-title">{show === 'watching' ? 'Watching' : 'Goals'}</h1>
      {/* The head and the bar stay where they are, the same width in every layout (goals spec, 2.1, G8): only what's
          under the count line changes width. */}
      <div className="goals-top">
      <div className="page-head row between goals-head" data-part="Views, search and filters">
        <span className="goals-title">
          <h1 className="title-xl">{show === 'watching' ? 'Watching' : 'Goals'}</h1>
          {/* The week line breaks only between its parts, never inside one. */}
          <span className="hint goals-period">{periodNow(app.cycle, app.today).split(' · ').map((part, i) => <Fragment key={i}>{i > 0 && ' · '}<span className="nb">{part}</span></Fragment>)}</span>
        </span>
        {/* New goal is a quiet link here (Lane, 9 Nov): people seldom make one, so it isn't the page's big button. The sidebar's New goal is one step from anywhere. */}
        <span className="actions">{wrapUpOn(modules.on) && wrapUpOpenOn(app.cycle, app.today) && <Link className="btn" to="/retro">Wrap up</Link>}<Link className="btn ghost sm new-goal-quiet" to="/goals/new">New goal</Link></span>
      </div>
      {/* Whose goals, as tabs; at the right of the same row, the Views menu (one meaning on every width). */}
      <div className="goals-toolbar">
        <div className="goals-tabs">
          <div className="seg tabs one-row" role="tablist" aria-label="Whose goals" ref={tabRow}>
            {scopeTabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={scope === t.id && !activeView} onClick={() => pickScope(t.id)}>
                {t.label}{/* A nought isn't printed (small workspaces rule 2). */}{countWords(t.ids.length) && <span className="tabcount">{countWords(t.ids.length)}</span>}
              </button>
            ))}
            {/* A saved view is a tab only while it's open; the rest wait in the Views menu. */}
            {activeView && (
              <button role="tab" className="view-tab" aria-selected title={activeView.pinned ? 'Pinned for everyone' : 'Your saved view'} onClick={() => openView(activeView)}>
                {activeView.name}
              </button>
            )}
          </div>
        </div>
        {app.snapshot.goals.length > 0 && (
          <MenuButton className="views-menu" label="Views" markCurrent
            items={[
              ...viewItems,
              ...(actions.canSave ? [{ label: 'Save this view…', onClick: actions.save }] : []),
              { label: 'Copy link', onClick: () => void actions.copyLink() },
              ...actions.manage,
            ].map((it, i) => (i === views.length && views.length > 0 ? { ...it, rule: true } : it))}
            extra={<Place name="goals.tools" goals={shown} viewName={viewName} inMenu />} />
        )}
      </div>

      {/* The list bar: search, the Needs attention switch, Filters, Sort, Group, Layout (goals spec, 2.1); then the count line. */}
      {app.snapshot.goals.length > 0 && <FilterBar
        lead={switchButton}
        find={onMap ? { goals: mapGoals, onFind: (g) => setGoTo((cur) => ({ id: g.id, n: (cur?.n ?? 0) + 1 })) } : undefined}
        sortOff={onMap ? MAP_IS_TREES : undefined}
        trail={<>
          <MenuButton className="group-menu" label="Group" summary="" markCurrent display={switchOn && !onMap ? 'Group: needs attention first' : `Group: ${onMap ? GROUPS.find(([k]) => k === 'tree')![1] : groupWord}`}
            items={groupOff ? [{ label: groupOff, note: true }] : GROUPS.map(([k, l]) => ({ label: l, hint: GROUP_LINE[k], current: group === k, onClick: () => pickGroup(k) }))} />
          <LayoutMenu layout={layout} onChange={setLayout} layouts={layoutsOn(mapHere)} />
        </>}
        after={<>
          {/* On a phone (goals spec, 2.4): the switch at the left, how the goals are seen at the right, in one sheet. */}
          <div className="goals-phone-switch">
            {switchButton}
            <button type="button" className="btn view-open" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>{viewSays}</button>
          </div>
          {/* The one count line (rule 4); the filter line follows it. */}
          {(line || proposedLink) && <p className="small goals-line" role="status">{line}{proposedLink}</p>}
        </>} />}
      </div>
      {actions.sheets}
      {sheetOpen && <ViewSheet layouts={layoutsOn(mapHere)} layout={layout} onLayout={setLayout} group={group} groupOff={groupOff} onGroup={pickGroup} items={viewItems}
        canSave={actions.canSave} onSave={() => { setSheetOpen(false); actions.save(); }} onCopy={() => void actions.copyLink()}
        manage={actions.manage} tools={<Place name="goals.tools" goals={shown} viewName={viewName} inMenu />} onClose={() => setSheetOpen(false)} />}

      {linkNote && <p className="hint link-note" role="status">{linkNote}</p>}
      {/* Until every goal has had its first check-in, the switch says how far that has got (goals spec, 2.1, item 6). */}
      {switchOn && <FirstReports />}
      {refined && !watchingNothing && (shown.length === 0 || near) && <NoneFound things={GOAL_WORDS} q={query.q} filtered={filters({ ...query, q: '' })} near={near} onClearSearch={() => setQuery((cur) => ({ ...cur, q: '' }))} onClearFilters={() => setQuery((cur) => ({ ...EMPTY_QUERY, q: cur.q, sort: cur.sort, dir: cur.dir }))} />}
      {!app.snapshot.goals.length && <Empty title="No goals yet"><Link className="btn primary sm" to="/goals/new">Set up the first goal</Link></Empty>}
      {alt && (!refined || watchingNothing) && app.snapshot.goals.length > 0 && !shown.length && (show === 'watching' ? <WatchingBody goals={shown} /> : <div className="calm"><Icon name="check-circle" size={15} /> {show === 'attention' ? 'Nothing is off track, stale or slipping.' : 'No goals here.'}</div>)}
      {alt && shown.length > 0 && layout === 'table' && <GoalTable groups={groups} />}
      {alt && shown.length > 0 && layout === 'board' && <GoalBoard groups={groups} />}
      {alt && shown.length > 0 && layout === 'history' && <HistoryGrid groups={groups} />}
      {alt && shown.length > 0 && layout === 'map' && <Suspense fallback={<MapWait />}><GoalMap goals={mapGoals} matches={narrowed ? new Set(shown.map((g) => g.id)) : undefined} goTo={goTo} /></Suspense>}

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

      {!alt && !refined && show === 'levels' && levelIds(app.cycle).map((l) => {
        const list = app.snapshot.goals.filter((g) => g.level === l).sort(worstFirst(app));
        if (!list.length) return null;
        return (
          <section key={l} className="block" aria-label={levelName(app.cycle, l)} data-part={levelName(app.cycle, l)}>
            <div className="row between nowrap">
              <h2 className="block-title">{levelName(app.cycle, l)} <span className="hint">· {list.length}</span></h2>
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

      {watchingList && (shown.length > 0 || !refined || watchingNothing) && <WatchingBody goals={shown} />}

      {!alt && !refined && show === 'mine' && <ul className="tree">{[...mine].sort(worstFirst(app)).map((g) => <li key={g.id}><GoalRow g={g} showOwner={false} /></li>)}</ul>}
      {/* The key sits after the goals: every row already shows its status in words. */}
      {app.snapshot.goals.length > 0 && shown.length > 0 && layout !== 'map' && <StatusLegend />}
      {/* A phone has no page title (its top bar says Goals), so New goal closes the page. */}
      <p className="row goals-phone-end"><Link className="btn ghost sm" to="/goals/new">New goal</Link></p>
    </div>
  );
}



/** Why Group and Sort can't be used on the Map (goals spec, 2.3). */
const MAP_IS_TREES = 'The Map is always the trees.';
/** Each group in one line (goals spec, 2.1, item 3.4). */
const GROUP_LINE: Record<Group, string> = {
  tree: 'Each top goal, then what feeds it',
  team: 'Teams worst first, each with its counts',
  level: 'North stars, then SVP, then team goals',
  none: 'One list',
};

/**
 * The phone's View sheet (goals spec, 2.4): Layout, Group (not on the Map), Saved views, then saving, the link and the
 * modules' tools. Each choice applies at once; Done closes it.
 */
function ViewSheet({ layouts = LAYOUTS, layout, onLayout, group, groupOff, onGroup, items, canSave, onSave, onCopy, manage, tools, onClose }: {
  layouts?: [Layout, string][]; layout: Layout; onLayout: (l: Layout) => void; group: Group; groupOff: string | null; onGroup: (g: Group) => void;
  items: { label: string; current: boolean; onClick: () => void }[]; canSave: boolean; onSave: () => void; onCopy: () => void;
  manage: { label: string; onClick?: () => void }[]; tools: React.ReactNode; onClose: () => void;
}) {
  return (
    <Sheet open onClose={onClose} title="View">
      <div className="view-sheet stack">
        <fieldset className="filter-group"><legend className="field-label">Layout</legend>
          {layouts.map(([k, l]) => (
            <label key={k} className="check view-choice"><input type="radio" name="view-layout" checked={layout === k} onChange={() => onLayout(k)} />
              <span className="menu-text"><span>{l}</span><span className="hint">{layoutLine(k)}</span></span></label>
          ))}
        </fieldset>
        {layout !== 'map' && (
          <fieldset className="filter-group"><legend className="field-label">Group</legend>
            {groupOff ? <span className="hint">{groupOff}</span> : GROUPS.map(([k, l]) => (
              <label key={k} className="check view-choice"><input type="radio" name="view-group" checked={group === k} onChange={() => onGroup(k)} />
                <span className="menu-text"><span>{l}</span><span className="hint">{GROUP_LINE[k]}</span></span></label>
            ))}
          </fieldset>
        )}
        {items.length > 0 && (
          <fieldset className="filter-group"><legend className="field-label">Saved views</legend>
            {items.map((v) => (
              <label key={v.label} className="check view-choice"><input type="radio" name="view-saved" checked={v.current} onChange={v.onClick} /> <span>{v.label}</span></label>
            ))}
          </fieldset>
        )}
        <div className="view-sheet-actions">
          {canSave && <button type="button" className="btn" onClick={onSave}>Save this view…</button>}
          <button type="button" className="btn" onClick={onCopy}>Copy link</button>
          {manage.map((m) => <button key={m.label} type="button" className="btn" onClick={() => { onClose(); m.onClick?.(); }}>{m.label}</button>)}
          <div className="view-sheet-tools">{tools}</div>
        </div>
      </div>
      <div className="sheet-foot"><button type="button" className="btn primary" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

/** The teams that have goals, worst first (domain/order.ts worstGroupsFirst), each with its goals worst first (U24). */
function teamsWorstFirst(app: ReturnType<typeof useApp>) {
  const teams = app.snapshot.teams.map((team) => ({ team, goals: app.snapshot.goals.filter((g) => g.teamId === team.id).sort(worstFirst(app)) })).filter((t) => t.goals.length);
  return worstGroupsFirst(teams, (t) => t.goals.map((g) => app.statusOf(g).status), (t) => t.team.name);
}

/** How long the map may take before it says it is drawing: a wait shorter than this is not worth a message. */
const MAP_WAIT_MS = 300;

/**
 * While the map's code loads: an empty space the map's size, and "Drawing the map…" only once it has taken a noticeable
 * time (review of 12 Nov: the line flashed for a moment on every switch to Map).
 */
function MapWait() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), MAP_WAIT_MS); return () => clearTimeout(t); }, []);
  return slow ? <div className="map-wait" role="status">Drawing the map…</div> : <div style={{ minHeight: '50vh' }} aria-hidden="true" />;
}
