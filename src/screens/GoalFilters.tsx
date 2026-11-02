/* Search, filters, sort and saved views for the Goals screen. Every setting lives in the URL, so a view is a link you
   can share; saving a view keeps that link under a name. What each filter means is in domain/query.ts. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import {
  describeQuery, EMPTY_QUERY, filters, KIND_OPTIONS, NEED_OPTIONS, parseQuery, QUERY_KEYS, queryEntries, RESULT_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, without,
  type GoalQuery, type SortKey,
} from '../domain/query';
import type { Level, SavedView } from '../domain/types';
import { Sheet } from '../ui/bits';

/** The params a view is made of: which goals and how they're grouped (show), the layout (view), and the query. */
const VIEW_KEYS = ['show', 'view', ...QUERY_KEYS];
export const viewParams = (p: URLSearchParams) => new URLSearchParams([...p].filter(([k]) => VIEW_KEYS.includes(k)).sort(([a], [b]) => VIEW_KEYS.indexOf(a) - VIEW_KEYS.indexOf(b))).toString();

/** The query in the URL, and a way to change it that keeps everything else (grouping, layout, the demo's date). */
/** The URL a change has asked for but the screen hasn't shown yet: the next change builds on it, not on the old one. */
let pending: string | null = null;

export function useGoalQuery(): [GoalQuery, (change: GoalQuery | ((q: GoalQuery) => GoalQuery)) => void] {
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => parseQuery(params), [params]);
  // Once a URL has rendered it's the truth again.
  useEffect(() => { pending = null; }, [params]);
  // Two quick changes (tick a filter, then pick a sort) must not undo each other: build on the latest asked-for URL.
  const set = (change: GoalQuery | ((q: GoalQuery) => GoalQuery)) => {
    const base = new URLSearchParams(pending ?? params.toString());
    const next = typeof change === 'function' ? change(parseQuery(base)) : change;
    const out = new URLSearchParams([...[...base].filter(([k]) => !QUERY_KEYS.includes(k)), ...queryEntries(next)]);
    pending = out.toString();
    setParams(out, { replace: true });
  };
  return [q, set];
}

/** The views this person sees: their own and the ones an admin pinned for everyone. */
export function useViews(): SavedView[] {
  const app = useApp();
  return (app.snapshot.views ?? []).filter((v) => !v.deletedAt && (v.pinned || v.personId === app.viewer.id)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));
}

/** Search, filters and sort, with the active filters as words you can remove one by one. */
export function FilterBar({ count, total }: { count: number; total: number }) {
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
  const chips = describeQuery(q, names);
  const narrowed = filters(q);
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${current}`;
    try { await navigator.clipboard.writeText(url); app.toast('Link copied. Anyone in the workspace who opens it sees these goals the same way.'); }
    catch { app.toast('Couldn’t copy the link. Copy it from the address bar.', 'error'); }
  };
  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <label className="filter-search"><span className="sr">Search goals</span>
          <input className="input" type="search" placeholder="Search goals, owners, teams, reasons" value={q.q} onChange={(e) => setQ((cur) => ({ ...cur, q: e.target.value }))} />
        </label>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Filters{narrowed ? ` · ${chips.filter((c) => c.key !== 'q').length}` : ''}</button>
        {/* The most common question in a weekly scan, one press away. */}
        <button type="button" className="btn quick-filter" aria-pressed={q.needs.includes('decision')} onClick={() => setQ((cur) => ({ ...cur, needs: cur.needs.includes('decision') ? cur.needs.filter((n) => n !== 'decision') : [...cur.needs, 'decision'] }))}>{NEED_OPTIONS.find(([k]) => k === 'decision')![1]}</button>
        <label className="filter-sort inline-sort"><span className="sr">Sort</span>
          <select className="input" value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ((cur) => ({ ...cur, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 })); }}>
            <option value="">Sort: as grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>Sort: {l}, reversed</option>)}
          </select>
        </label>
      </div>
      {/* Saving and sharing only appear once there's something to save or share. */}
      {(narrowed || q.sort || active) && (
        <div className="filter-chips" aria-label="Active filters">
          {active && <span className="small strong">{active.name}{active.pinned ? ' · pinned for everyone' : ''}</span>}
          {narrowed && <span className="small" role="status">{count} of {total} {total === 1 ? 'goal' : 'goals'}</span>}
          {chips.map((c) => <button key={c.key} type="button" className="filter-chip" aria-label={`Remove filter: ${c.text}`} onClick={() => setQ((cur) => without(cur, c.key))}>{c.text}<span aria-hidden="true"> ✕</span></button>)}
          {!narrowed && q.sort && !active && <span className="small">{SORT_OPTIONS.find(([k]) => k === q.sort)?.[1]}{q.dir === -1 ? ', reversed' : ''}</span>}
          {narrowed && <button type="button" className="linkish small" onClick={() => setQ((cur) => ({ ...EMPTY_QUERY, sort: cur.sort, dir: cur.dir }))}>Clear filters</button>}
          <span className="filter-chip-actions">
            {!active && <button type="button" className="btn sm" onClick={() => setSaving(true)}>Save view</button>}
            <button type="button" className="btn ghost sm" onClick={() => void copyLink()}>Copy link</button>
            {active && <ViewActions view={active} />}
          </span>
        </div>
      )}
      {open && <FilterSheet onClose={() => setOpen(false)} />}
      {saving && <SaveViewSheet params={current} onClose={() => setSaving(false)} />}
    </div>
  );
}

/** On a saved view: rename, pin (admins), delete, kept in one small menu so they don't sit beside the filters. */
function ViewActions({ view }: { view: SavedView }) {
  const app = useApp();
  const [, setParams] = useSearchParams();
  const [renaming, setRenaming] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const mine = view.personId === app.viewer.id;
  const canRename = mine || app.viewer.admin;
  const canDelete = mine || (app.viewer.admin && view.pinned);
  if (!canRename && !app.viewer.admin && !canDelete) return null;
  const close = () => { if (menu.current) menu.current.open = false; };
  return (
    <>
      <details className="view-menu" ref={menu}>
        <summary className="btn ghost sm">Manage view</summary>
        <div className="view-menu-list" role="group" aria-label={`Manage ${view.name}`}>
          {canRename && <button type="button" className="menuitem" onClick={() => { close(); setRenaming(true); }}>Rename</button>}
          {app.viewer.admin && <button type="button" className="menuitem" onClick={() => { close(); void app.pinView(view.id, !view.pinned).then(() => app.toast(view.pinned ? 'Unpinned' : 'Pinned for everyone')); }}>{view.pinned ? 'Unpin' : 'Pin for everyone'}</button>}
          {canDelete && <button type="button" className="menuitem" onClick={() => { close(); void app.deleteView(view.id).then(() => { setParams({}, { replace: true }); app.toast('View deleted'); }); }}>Delete</button>}
        </div>
      </details>
      {renaming && <SaveViewSheet params={view.params} view={view} onClose={() => setRenaming(false)} />}
    </>
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

/** Every filter, changing the goals behind it as you go. */
function FilterSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [q, setQ] = useGoalQuery();
  const [owner, setOwner] = useState('');
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  type ListKey = 'status' | 'needs' | 'level' | 'team' | 'kind' | 'result';
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
        {checks('Needs attention', NEED_OPTIONS, 'needs')}
        {checks('Level', levels, 'level')}
        {checks('Team', app.snapshot.teams.map((t) => [t.id, t.name] as [string, string]), 'team')}
        <fieldset className="filter-group"><legend className="field-label">Owner</legend>
          <span className="filter-options">{q.owner.map((id) => <button key={id} type="button" className="filter-chip" aria-label={`Remove owner ${app.person(id)?.name}`} onClick={() => setQ((cur) => ({ ...cur, owner: cur.owner.filter((x) => x !== id) }))}>{app.person(id)?.name}<span aria-hidden="true"> ✕</span></button>)}</span>
          <input className="input" type="search" placeholder="Find an owner" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Find an owner" />
          {match.length > 0 && <span className="filter-options">{match.map((p) => <button key={p.id} type="button" className="btn sm" onClick={() => { setQ((cur) => ({ ...cur, owner: [...cur.owner, p.id] })); setOwner(''); }}>{p.name}</button>)}</span>}
        </fieldset>
        {checks('Type', KIND_OPTIONS, 'kind')}
        <fieldset className="filter-group"><legend className="field-label">Due</legend>
          <select className="input" aria-label="Due" value={q.due == null ? '' : String(q.due)} onChange={(e) => setQ((cur) => ({ ...cur, due: e.target.value === '' ? null : e.target.value === 'quarter' ? 'quarter' : Number(e.target.value) }))}>
            <option value="">Any time</option>
            <option value="quarter">This quarter</option>
            {[app.week + 2, app.week + 4, app.week + 8].filter((w) => w <= app.cycle.weeks).map((w) => <option key={w} value={w}>By week {w}</option>)}
          </select>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Last check-in</legend>
          <select className="input" aria-label="Last check-in" value={q.quiet == null ? '' : String(q.quiet)} onChange={(e) => setQ((cur) => ({ ...cur, quiet: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">Any time</option>
            <option value="2">2 or more weeks ago</option>
            <option value="4">4 or more weeks ago</option>
          </select>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Last quarter</legend>
          <select className="input" aria-label="Last quarter" value={q.quarter ?? ''} onChange={(e) => setQ((cur) => ({ ...cur, quarter: (e.target.value || null) as GoalQuery['quarter'] }))}>
            <option value="">Met or missed</option><option value="met">Met its plan</option><option value="missed">Missed its plan</option>
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
      <div className="row between" style={{ marginTop: 'var(--s4)' }}>
        <button type="button" className="linkish small" onClick={() => setQ((cur) => ({ ...EMPTY_QUERY, q: cur.q, sort: cur.sort, dir: cur.dir }))}>Clear filters</button>
        <button type="button" className="btn primary" onClick={onClose}>Show the goals</button>
      </div>
    </Sheet>
  );
}
