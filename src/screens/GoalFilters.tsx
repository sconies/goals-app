/* Search, filters, sort and saved views for the Goals screen. Every setting lives in the URL, so a view is a link you
   can share; saving a view keeps that link under a name. What each filter means is in domain/query.ts. */
import { isTableView } from '../domain/tableLayout';
import { movedGoals } from '../domain/goalsPage';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import {
  describeQuery, EMPTY_QUERY, filters, KIND_OPTIONS, NEED_OPTIONS, parseQuery, QUERY_KEYS, queryEntries, RESULT_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, without,
  type GoalQuery, type SortKey,
} from '../domain/query';
import type { Level, SavedView } from '../domain/types';
import { Sheet } from '../ui/bits';
import { ATTENTION, QUARTER } from '../domain/vocabulary';
import { Icon } from '../ui/Icon';
import { MenuButton, type MenuItem } from '../ui/MenuButton';

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
export function FilterBar({ count, total, lead, trail }: {
  count: number; total: number;
  /** After the search: the Needs attention switch (goals spec, 2.1). */
  lead?: ReactNode;
  /** After Sort: the Group menu. */
  trail?: ReactNode;
}) {
  const app = useApp();
  const [q, setQ] = useGoalQuery();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [params] = useSearchParams();
  const views = useViews();
  const current = viewParams(params);
  const active = views.find((v) => v.params === current);
  const names = {
    team: (id: string) => app.team(id)?.name ?? 'a team',
    person: (id: string) => app.person(id)?.name ?? 'someone',
    goal: (id: string) => app.goal(id)?.title ?? 'a goal',
  };
  // The Needs attention switch sits on the view bar (goals spec, 2.1); it isn't a filter, so it isn't in the line.
  const chips = describeQuery(q, names).filter((c) => c.key !== 'needs' || q.needs.length > 0);
  const narrowed = filters({ ...q, attention: false });
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${current}`;
    try { await navigator.clipboard.writeText(url); app.toast('Link copied. Anyone in the workspace who opens it sees these goals the same way.'); }
    catch { app.toast('Couldn’t copy the link. Copy it from the address bar.', 'error'); }
  };
  const viewMenu = useViewMenu(active);
  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <SearchBox value={q.q} onSearch={(text) => setQ((cur) => ({ ...cur, q: text }))} />
        {lead}
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Filters{chips.some((c) => c.key !== 'q') ? ` · ${chips.filter((c) => c.key !== 'q').length}` : ''}</button>
        <label className="filter-sort inline-sort"><span className="sr">Sort</span>
          <select className="input" value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ((cur) => ({ ...cur, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 })); }}>
            <option value="">Sort: as grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>Sort: {l}, reversed</option>)}
          </select>
        </label>
        {trail}
      </div>
      {/* Saving and sharing only appear once there's something to save or share. On a phone this is one row: the
          count, the filters scrolling sideways, and one View menu for saving and sharing. */}
      {(narrowed || q.sort || active) && (
        <div className="filter-chips" aria-label="Active filters">
          {active && <span className="small strong filter-view-name">{active.name}{active.pinned ? ' · pinned for everyone' : ''}</span>}
          {narrowed && <span className="small filter-count" role="status">{count} of {total} {total === 1 ? 'goal' : 'goals'}</span>}
          <span className="filter-chip-scroll">
            {chips.map((c) => <button key={c.key} type="button" className="filter-chip" aria-label={`Remove filter: ${c.text}`} onClick={() => setQ((cur) => without(cur, c.key))}>{c.text}<Icon name="close" size={12} className="chip-x" /></button>)}
            {!narrowed && q.sort && !active && <span className="small filter-sorted">{SORT_OPTIONS.find(([k]) => k === q.sort)?.[1]}{q.dir === -1 ? ', reversed' : ''}</span>}
            {narrowed && <button type="button" className="linkish small filter-clear" onClick={() => setQ((cur) => ({ ...EMPTY_QUERY, sort: cur.sort, dir: cur.dir }))}>Clear filters</button>}
          </span>
          <span className="filter-chip-actions">
            {!active && <button type="button" className="btn sm" onClick={() => setSaving(true)}>Save view</button>}
            <button type="button" className="btn ghost sm" onClick={() => void copyLink()}>Copy link</button>
            {active && viewMenu.items.length > 0 && <MenuButton label="Manage view" items={viewMenu.items} />}
          </span>
          <MenuButton className="filter-view-menu" label="View" items={[...(!active ? [{ label: 'Save view', onClick: () => setSaving(true) }] : []), { label: 'Copy link', onClick: () => void copyLink() }, ...viewMenu.items]} />
        </div>
      )}
      {viewMenu.sheet}
      {open && <FilterSheet onClose={() => setOpen(false)} />}
      {saving && <SaveViewSheet params={current} onClose={() => setSaving(false)} />}
    </div>
  );
}

/**
 * The search box (outside review, 9 Nov). What's typed is the box's own, so it never loses or moves a character
 * however fast someone types or pastes; the address follows a moment later. The address writes back through the router
 * after the keystroke, and its value is trimmed, so a box read straight from it dropped letters and spaces. A change to
 * the address that isn't one of the box's own writes (Back, a removed filter, Clear) puts its words in the box.
 */
export const SEARCH_SETTLE_MS = 150;
function SearchBox({ value, onSearch }: { value: string; onSearch: (text: string) => void }) {
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
  return (
    <label className="filter-search"><span className="sr">Find a goal</span>
      <input className="input" type="search" placeholder="Find by name, owner, team or key" title="Find goals by the words on them: name, key, owner, team, status or reason" maxLength={200} value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => flush(t), SEARCH_SETTLE_MS);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') flush(e.currentTarget.value); }} />
    </label>
  );
}

/** On a saved view: rename, pin (admins), delete, kept in one small menu so they don't sit beside the filters. */
function useViewMenu(view: SavedView | undefined): { items: MenuItem[]; sheet: React.ReactNode } {
  const app = useApp();
  const [, setParams] = useSearchParams();
  const [renaming, setRenaming] = useState(false);
  if (!view) return { items: [], sheet: null };
  const mine = view.personId === app.viewer.id;
  const canRename = mine || app.viewer.admin;
  // An admin can delete anyone's view; deleting shows Undo for 10 seconds (domain/removal).
  const canDelete = mine || app.viewer.admin;
  const items: MenuItem[] = [
    ...(canRename ? [{ label: 'Rename', onClick: () => setRenaming(true) }] : []),
    ...(app.viewer.admin ? [{ label: view.pinned ? 'Unpin' : 'Pin for everyone', onClick: () => void app.pinView(view.id, !view.pinned).then(() => app.toast(view.pinned ? 'Unpinned' : 'Pinned for everyone')) }] : []),
    ...(canDelete ? [{ label: 'Delete', onClick: () => void app.deleteView(view.id).then(() => setParams({}, { replace: true })) }] : []),
  ];
  return { items, sheet: renaming ? <SaveViewSheet params={view.params} view={view} onClose={() => setRenaming(false)} /> : null };
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

/** Every filter, changing the goals behind it as you go. */
function FilterSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [q, setQ] = useGoalQuery();
  const [owner, setOwner] = useState('');
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  type ListKey = 'status' | 'level' | 'team' | 'kind' | 'result';
  const checks = <T extends string>(legend: string, opts: [T, string][], key: ListKey) => (
    <fieldset className="filter-group"><legend className="field-label">{legend}</legend>
      <span className="filter-options">{opts.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={(q[key] as string[]).includes(k)} onChange={() => setQ((cur) => ({ ...cur, [key]: toggle(cur[key] as string[], k) }))} /> {l}</label>)}</span>
    </fieldset>
  );
  const levels: [Level, string][] = (['north-star', 'svp', 'team'] as Level[]).map((l) => [l, LEVEL_LABEL[l]]);
  const people = app.snapshot.people.filter((p) => app.snapshot.goals.some((g) => g.ownerId === p.id));
  const match = people.filter((p) => owner.trim() && p.name.toLowerCase().includes(owner.trim().toLowerCase()) && !q.owner.includes(p.id)).slice(0, 6);
  const tops = app.snapshot.goals.filter((g) => app.snapshot.goals.some((c) => c.parentId === g.id));
  return (
    <Sheet open onClose={onClose} title="Filter goals" wide>
      <div className="filter-sheet">
        <fieldset className="filter-group"><legend className="field-label">Sort</legend>
          <select className="input" aria-label="Sort" value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ((cur) => ({ ...cur, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 })); }}>
            <option value="">As grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>{l}, reversed</option>)}
          </select>
        </fieldset>
        {checks('Status', STATUS_OPTIONS, 'status')}
        {/* The one Needs attention rule (domain/attention.ts), as Home, Watching and the map have it; narrowed by why, if you like. */}
        <fieldset className="filter-group"><legend className="field-label">{ATTENTION.needs.label}</legend>
          <label className="check"><input type="checkbox" checked={q.attention} onChange={(e) => { const on = e.target.checked; setQ((cur) => ({ ...cur, attention: on, needs: on ? cur.needs : [] })); }} /> Only goals that need attention, with those {ATTENTION.handled.label.toLowerCase()} below them</label>
          <span className="hint">Because… (any of these; leave them all clear for any reason)</span>
          <span className="filter-options">{NEED_OPTIONS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={q.needs.includes(k)} onChange={() => setQ((cur) => { const needs = toggle(cur.needs, k); return { ...cur, needs, attention: cur.attention || needs.length > 0 }; })} /> {l}</label>)}</span>
        </fieldset>
        {checks('Level', levels, 'level')}
        {checks('Team', app.snapshot.teams.map((t) => [t.id, t.name] as [string, string]), 'team')}
        <fieldset className="filter-group"><legend className="field-label">Owner</legend>
          <span className="filter-options">{q.owner.map((id) => <button key={id} type="button" className="filter-chip" aria-label={`Remove owner ${app.person(id)?.name}`} onClick={() => setQ((cur) => ({ ...cur, owner: cur.owner.filter((x) => x !== id) }))}>{app.person(id)?.name}<Icon name="close" size={12} className="chip-x" /></button>)}</span>
          <input className="input" type="search" placeholder="Find an owner" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Find an owner" />
          {match.length > 0 && <span className="filter-options">{match.map((p) => <button key={p.id} type="button" className="btn sm" onClick={() => { setQ((cur) => ({ ...cur, owner: [...cur.owner, p.id] })); setOwner(''); }}>{p.name}</button>)}</span>}
        </fieldset>
      </div>
      {/* Used less often: folded, and open when one of them is set. */}
      <details className="disclose filter-more" open={!!(q.kind.length || q.due != null || q.quiet != null || q.quarter || q.result.length || q.feeds || q.helps)}>
        <summary>More filters: type, due date, no update for, last quarter, result, links</summary>
      <div className="filter-sheet">
        {checks('Type', KIND_OPTIONS, 'kind')}
        <fieldset className="filter-group"><legend className="field-label">Due</legend>
          <select className="input" aria-label="Due" value={q.due == null ? '' : String(q.due)} onChange={(e) => setQ((cur) => ({ ...cur, due: e.target.value === '' ? null : e.target.value === 'quarter' ? 'quarter' : Number(e.target.value) }))}>
            <option value="">Any time</option>
            <option value="quarter">This quarter</option>
            {[app.week + 2, app.week + 4, app.week + 8].filter((w) => w <= app.cycle.weeks).map((w) => <option key={w} value={w}>By week {w}</option>)}
          </select>
        </fieldset>
        {/* Counted as the No recent update rule counts: days since the latest check-in was posted, in weeks. */}
        <fieldset className="filter-group"><legend className="field-label">No update for</legend>
          <select className="input" aria-label="No update for" value={q.quiet == null ? '' : String(q.quiet)} onChange={(e) => setQ((cur) => ({ ...cur, quiet: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">Any time</option>
            <option value="2">2 weeks or more</option>
            <option value="4">4 weeks or more</option>
          </select>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Last quarter</legend>
          <select className="input" aria-label="Last quarter" value={q.quarter ?? ''} onChange={(e) => setQ((cur) => ({ ...cur, quarter: (e.target.value || null) as GoalQuery['quarter'] }))}>
            <option value="">Any</option><option value="met">{QUARTER.met.label}</option><option value="missed">{QUARTER.missed.label}</option>
          </select>
        </fieldset>
        {checks('Result', RESULT_OPTIONS, 'result')}
        <fieldset className="filter-group"><legend className="field-label">Links</legend>
          <select className="input" aria-label="In the tree of" value={q.feeds ?? ''} onChange={(e) => setQ((cur) => ({ ...cur, feeds: e.target.value || null }))}>
            <option value="">Any tree</option>
            {tops.map((g) => <option key={g.id} value={g.id}>In the tree of {g.title}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={q.helps} onChange={(e) => setQ((cur) => ({ ...cur, helps: e.target.checked }))} /> With “also helps” links</label>
        </fieldset>
      </div>
      </details>
      {/* Always in view at the bottom of the sheet, however long it is. */}
      <div className="sheet-foot">
        <button type="button" className="linkish small" onClick={() => setQ((cur) => ({ ...EMPTY_QUERY, q: cur.q, sort: cur.sort, dir: cur.dir }))}>Clear filters</button>
        <button type="button" className="btn primary" onClick={onClose}>Show the goals</button>
      </div>
    </Sheet>
  );
}
