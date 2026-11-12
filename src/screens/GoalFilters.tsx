/* Search, filters, sort and saved views for the Goals screen. Every setting lives in the URL, so a view is a link you
   can share; saving a view keeps that link under a name. What each filter means is in domain/query.ts. */
import { isTableView } from '../domain/tableLayout';
import { movedGoals } from '../domain/goalsPage';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { useGoalColumns } from '../core/app';
import {
  EMPTY_QUERY, parseQuery, QUERY_KEYS, queryEntries, queryParts, SORT_OPTIONS, without,
  type GoalQuery, type SortKey,
} from '../domain/query';
import type { Goal, SavedView } from '../domain/types';
import { findOnMap } from '../domain/map';
import { Sheet } from '../ui/bits';
import type { MenuItem } from '../ui/MenuButton';
import { FilterLine } from '../ui/ListBar';

/** The params a view is made of: which goals and how they're grouped (show), the layout (view), and the query. */
const VIEW_KEYS = ['scope', 'group', 'show', 'view', 'weeks', 'hist', ...QUERY_KEYS];
// view=list is the list said out loud (GoalViews' useLayout), the same view as no layout at all.
export const viewParams = (p: URLSearchParams) => new URLSearchParams([...p].filter(([k, v]) => VIEW_KEYS.includes(k) && !(k === 'view' && v === 'list')).sort(([a], [b]) => VIEW_KEYS.indexOf(a) - VIEW_KEYS.indexOf(b))).toString();

/**
 * The address as it is now, to build a change on. The router hands a screen its search params once it has drawn them,
 * a moment after each change, so a change built on those can undo the one before it: a tab pressed just after the
 * search box was emptied brought the old words back (outside review, 9 Nov). The browser's address is already the
 * latest. Under a router that isn't the browser's (a test's), the router's params are all there is.
 */
export function useLatestParams(): () => URLSearchParams {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  return () => (typeof window !== 'undefined' && window.location.pathname.endsWith(pathname) ? new URLSearchParams(window.location.search) : new URLSearchParams(params));
}

/** The query in the URL, and a way to change it that keeps everything else (grouping, layout, the demo's date). */
export function useGoalQuery(): [GoalQuery, (change: GoalQuery | ((q: GoalQuery) => GoalQuery), opts?: { push?: boolean }) => void] {
  const [params, setParams] = useSearchParams();
  const latest = useLatestParams();
  const q = useMemo(() => parseQuery(params), [params]);
  // Two quick changes (tick a filter, then pick a sort) must not undo each other: each builds on the latest address.
  // A choice that changes what the page is (the Needs attention switch) is a step Back undoes: it pushes.
  const set = (change: GoalQuery | ((q: GoalQuery) => GoalQuery), opts?: { push?: boolean }) => {
    const base = latest();
    const next = typeof change === 'function' ? change(parseQuery(base)) : change;
    const out = new URLSearchParams([...[...base].filter(([k]) => !QUERY_KEYS.includes(k)), ...queryEntries(next)]);
    if (out.toString() !== base.toString()) setParams(out, { replace: !opts?.push });
  };
  return [q, set];
}

/** The views this person sees: their own and the ones an admin pinned for everyone. Data's saved layouts are kept apart. */
export function useViews(): SavedView[] {
  const app = useApp();
  // A view saved in the Cards layout is the same view in List (Lane, 9 Nov): opening it says so once (GoalsScreen).
  // A view saved in the old form (show=…, no scope) is read in the new one (goals spec, rule 6); the record isn't rewritten.
  const fresh = (params: string) => viewParams(new URLSearchParams(movedGoals(params, 'all', () => true)?.search ?? params));
  return (app.snapshot.views ?? []).filter((v) => !v.deletedAt && !isTableView(v) && (v.pinned || v.personId === app.viewer.id))
    .map((v) => (new URLSearchParams(v.params).get('view') === 'cards' ? { ...v, params: fresh(viewParams(new URLSearchParams([...new URLSearchParams(v.params)].filter(([k]) => k !== 'view')))) } : { ...v, params: fresh(v.params) })).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));
}

/** Search, filters and sort, with the active filters as words you can remove one by one. */
export function FilterBar({ lead, trail, after, find, sortOff }: {
  /** Under the bar, before the filter line: the phone's row (the switch and View) and the count line. */
  after?: ReactNode;
  /** After the search: the Needs attention switch (goals spec, 2.1). */
  lead?: ReactNode;
  /** After Sort: the Group and Layout menus. */
  trail?: ReactNode;
  /** On the Map, the search finds a goal and goes to it instead of narrowing as you type (goals spec, 2.3). */
  find?: { goals: Goal[]; onFind: (g: Goal) => void };
  /** Why Sort can't be used just now (the Map is always the trees); it is then drawn but disabled. */
  sortOff?: string;
}) {
  const app = useApp();
  const [q, setQ] = useGoalQuery();
  const [open, setOpen] = useState(false);
  const { col } = useGoalColumns();
  // The sheet's code arrives a moment after Goals opens, not in the first download, so Filters opens at once.
  useEffect(() => { const t = window.setTimeout(() => { void loadSheet(); }, 0); return () => window.clearTimeout(t); }, []);
  const names = {
    team: (id: string) => app.team(id)?.name ?? 'a team',
    person: (id: string) => app.person(id)?.name ?? 'someone',
    goal: (id: string) => app.goal(id)?.title ?? 'a goal',
    col,
  };
  // The filters in words (find rule 3). The Needs attention switch isn't a filter, and a search never is.
  const parts = queryParts(q, names);
  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <SearchBox value={q.q} onSearch={(text) => setQ((cur) => ({ ...cur, q: text }))} find={find} />
        {lead}
        {/* On a phone Sort is in the same sheet as the filters, so the button says both (goals spec, 2.4). */}
        <button type="button" className="btn filters-open" aria-haspopup="dialog" onPointerEnter={() => void loadSheet()} onClick={() => setOpen(true)}><span className="filters-wide">Filters</span><span className="filters-phone">Filter and sort</span>{parts.length ? ` · ${parts.length}` : ''}</button>
        <label className="filter-sort inline-sort" title={sortOff}><span className="sr">Sort</span>
          <select className="input" disabled={!!sortOff} aria-description={sortOff} value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ((cur) => ({ ...cur, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 })); }}>
            <option value="">Sort: as grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>Sort: {l}, reversed</option>)}
          </select>
        </label>
        {trail}
      </div>
      {after}
      {/* Rule 3's filter line (the find spec): each filter in words with Remove; the search and the switch aren't
          filters. The count is the page's one count line (goals spec, rule 4), not said again here. Saving and sharing
          are in the Views menu (or the phone's View sheet), the same on every width (GL2). */}
      <FilterLine parts={parts} onRemove={(k) => setQ((cur) => without(cur, k))} onClear={() => setQ((cur) => ({ ...EMPTY_QUERY, q: cur.q, attention: cur.attention, sort: cur.sort, dir: cur.dir }))} />
      {open && <Suspense fallback={null}><FilterSheet onClose={() => setOpen(false)} /></Suspense>}
    </div>
  );
}

/**
 * What can be done with the view on screen, for the Views menu and the phone's View sheet (goals spec, 2.1): save it,
 * copy its link, and, when a saved view is open, rename, pin or delete it. The sheets it opens are drawn by `sheets`.
 */
export function useViewActions() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const views = useViews();
  const current = viewParams(params);
  const active = views.find((v) => v.params === current);
  // Something to save: more than a bare scope, and not already a saved view.
  const canSave = !active && [...new URLSearchParams(current).keys()].some((k) => k !== 'scope');
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${current}`;
    try { await navigator.clipboard.writeText(url); app.toast('Link copied. Anyone in the workspace who opens it sees these goals the same way.'); }
    catch { app.toast('Couldn’t copy the link. Copy it from the address bar.', 'error'); }
  };
  const manage: MenuItem[] = [];
  if (active) {
    const mine = active.personId === app.viewer.id;
    // An admin can rename or delete anyone's view; deleting shows Undo for 10 seconds (domain/removal).
    if (mine || app.viewer.admin) manage.push({ label: 'Rename…', onClick: () => setRenaming(true) });
    if (app.viewer.admin) manage.push({ label: active.pinned ? 'Stop pinning' : 'Pin for everyone', onClick: () => void app.pinView(active.id, !active.pinned).then(() => app.toast(active.pinned ? 'Unpinned' : 'Pinned for everyone')) });
    if (mine || app.viewer.admin) manage.push({ label: 'Delete this view…', onClick: () => void app.deleteView(active.id).then(() => setParams({}, { replace: true })) });
  }
  const sheets = <>
    {saving && <SaveViewSheet params={current} onClose={() => setSaving(false)} />}
    {renaming && active && <SaveViewSheet params={active.params} view={active} onClose={() => setRenaming(false)} />}
  </>;
  return { views, active, canSave, save: () => setSaving(true), copyLink, manage, sheets };
}

/**
 * The search box (outside review, 9 Nov). What's typed is the box's own, so it never loses or moves a character
 * however fast someone types or pastes; the address follows a moment later. The address writes back through the router
 * after the keystroke, and its value is trimmed, so a box read straight from it dropped letters and spaces. A change to
 * the address that isn't one of the box's own writes (Back, a removed filter, Clear) puts its words in the box.
 */
export const SEARCH_SETTLE_MS = 150;
function SearchBox({ value, onSearch, find }: { value: string; onSearch: (text: string) => void; find?: { goals: Goal[]; onFind: (g: Goal) => void } }) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The words the box has written that the address hasn't shown yet, oldest first. */
  const sent = useRef<string[]>([]);
  const latest = useRef(value);
  latest.current = value;
  const write = useRef(onSearch);
  write.current = onSearch;
  // Back and Forward always set the box from the address, even when the words are the ones it last saw: a search
  // written and then gone back over at once can reach the screen as one change, with no new words in between.
  const [params] = useSearchParams();
  const nav = useNavigationType();
  const seen = useRef(value);
  useEffect(() => {
    const own = sent.current.indexOf(value);
    if (own >= 0) { sent.current = sent.current.slice(own + 1); seen.current = value; return; }
    if (value === seen.current && nav !== 'POP') return;
    // From somewhere else: it wins over anything still waiting to be written.
    seen.current = value;
    sent.current = [];
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setText((t) => (t.trim() === value ? t : value));
  }, [value, params, nav]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flush = (t: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const words = t.trim().slice(0, 200);
    if (words === latest.current) return;
    sent.current.push(words);
    write.current(words);
  };
  // On the Map (goals spec, 2.3): typing lists the goals it finds under the field, as a combobox; choosing one goes to it
  // on the Map without narrowing it. Enter with nothing chosen narrows, as on every other layout, so a link with ?q=
  // means the same goals everywhere.
  const [listOpen, setListOpen] = useState(false);
  const [at, setAt] = useState(-1);
  const hits = useMemo(() => (find && listOpen ? findOnMap(find.goals, text, 8) : []), [find, listOpen, text]);
  const mapMode = !!find;
  // Moving to or from the Map, the field says the address's words again: nothing half-typed is left in it.
  useEffect(() => { setListOpen(false); setAt(-1); setText(latest.current); }, [mapMode]);
  const choose = (g: Goal | undefined) => { if (!g || !find) return; find.onFind(g); setListOpen(false); setAt(-1); setText(latest.current); };
  const listId = 'bar-find-list';
  const showList = mapMode && listOpen && text.trim() !== '';
  return (
    <label className="filter-search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setListOpen(false); }}><span className="sr">Find a goal</span>
      <input className="input" type="search" maxLength={200} value={text}
        placeholder={mapMode ? 'Find a goal or key, and go to it' : 'Find by name, owner, team or key'}
        title={mapMode ? 'Find a goal by its name or key, and go to it on the Map. Enter shows only the goals that match.' : 'Find goals by the words on them: name, key, owner, team, status or reason'}
        role={mapMode ? 'combobox' : undefined} aria-expanded={mapMode ? showList && hits.length > 0 : undefined} aria-controls={mapMode ? listId : undefined} aria-autocomplete={mapMode ? 'list' : undefined}
        aria-activedescendant={showList && at >= 0 && hits[at] ? `bar-find-${hits[at]!.id}` : undefined}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          if (mapMode) { setListOpen(true); setAt(-1); return; }
          timer.current = setTimeout(() => flush(t), SEARCH_SETTLE_MS);
        }}
        onKeyDown={(e) => {
          if (mapMode && showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) { e.preventDefault(); setAt((i) => (e.key === 'ArrowDown' ? Math.min(hits.length - 1, i + 1) : Math.max(-1, i - 1))); return; }
          if (mapMode && e.key === 'Escape' && listOpen) { e.preventDefault(); setListOpen(false); return; }
          if (e.key !== 'Enter') return;
          if (mapMode && showList && at >= 0) { e.preventDefault(); choose(hits[at]); return; }
          setListOpen(false);
          flush(e.currentTarget.value);
        }} />
      {showList && (
        <ul className="bar-find-list" id={listId} role="listbox" aria-label="Goals found">
          {hits.length ? hits.map((g, i) => (
            <li key={g.id} id={`bar-find-${g.id}`} role="option" aria-selected={i === at} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setAt(i)} onClick={() => choose(g)}>
              {g.key && <span className="bar-find-key">{g.key}</span>}<span className="bar-find-title">{g.title}</span>
            </li>
          )) : <li className="bar-find-none" role="option" aria-selected={false} aria-disabled>No goal by that name or key. Enter shows any that mention it.</li>}
        </ul>
      )}
    </label>
  );
}

function SaveViewSheet({ params, view, onClose }: { params: string; view?: SavedView; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState(view?.name ?? '');
  const [pin, setPin] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setTried(true);
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await app.saveView({ id: view?.id, name, params });
      if (pin && !view) await app.pinView(id, true);
      app.toast(view ? 'View renamed' : pin ? `Saved and pinned “${name.trim()}” for everyone` : `Saved “${name.trim()}”`);
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={view ? 'Rename the view' : 'Save this view'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <label className="field"><span className="field-label">Name</span>
          <input className={'input' + (tried && !name.trim() ? ' invalid' : '')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 at risk in Platform" aria-invalid={tried && !name.trim()} />
          {tried && !name.trim() && <span className="hint tone-off" role="alert">Give the view a name.</span>}
        </label>
        {!view && <span className="hint">It keeps the search, filters, sort, grouping and layout. It’s yours; share it with Copy link.</span>}
        {!view && app.viewer.admin && <label className="check"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> Pin it for everyone in {app.ws.name}</label>}
        <div className="row"><button type="submit" className="btn primary" disabled={busy}>{view ? 'Rename' : 'Save view'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Sheet>
  );
}

// The sheet with every filter loads when first opened.
const loadSheet = () => import('./GoalFilterSheet');
const FilterSheet = lazy(() => loadSheet().then((m) => ({ default: m.FilterSheet })));
