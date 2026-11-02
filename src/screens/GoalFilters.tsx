/* Search, filters, sort and saved views for the Goals screen. Every setting lives in the URL, so a view is a link you
   can share; saving a view keeps that link under a name. What each filter means is in domain/query.ts. */
import { useMemo, useState } from 'react';
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
export function useGoalQuery(): [GoalQuery, (q: GoalQuery) => void] {
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => parseQuery(params), [params]);
  const set = (next: GoalQuery) => {
    const keep = [...params].filter(([k]) => !QUERY_KEYS.includes(k));
    setParams(new URLSearchParams([...keep, ...queryEntries(next)]), { replace: true });
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
          <input className="input" type="search" placeholder="Search goals, owners, teams, reasons" value={q.q} onChange={(e) => setQ({ ...q, q: e.target.value })} />
        </label>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Filters{narrowed ? ` · ${chips.filter((c) => c.key !== 'q').length}` : ''}</button>
        <label className="filter-sort"><span className="sr">Sort</span>
          <select className="input" value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ({ ...q, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 }); }}>
            <option value="">Sort: as grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>Sort: {l}, reversed</option>)}
          </select>
        </label>
        <span className="filterbar-actions">
          {(narrowed || q.sort) && !active && <button type="button" className="btn" onClick={() => setSaving(true)}>Save view</button>}
          <button type="button" className="btn ghost" onClick={() => void copyLink()}>Copy link</button>
        </span>
      </div>
      {(narrowed || active) && (
        <div className="filter-chips" aria-label="Active filters">
          {active && <span className="small strong">{active.name}{active.pinned ? ' · pinned for everyone' : ''}</span>}
          {narrowed && <span className="small" role="status">{count} of {total} {total === 1 ? 'goal' : 'goals'}</span>}
          {chips.map((c) => <button key={c.key} type="button" className="filter-chip" aria-label={`Remove filter: ${c.text}`} onClick={() => setQ(without(q, c.key))}>{c.text}<span aria-hidden="true"> ✕</span></button>)}
          {narrowed && <button type="button" className="linkish small" onClick={() => setQ({ ...EMPTY_QUERY, sort: q.sort, dir: q.dir })}>Clear filters</button>}
          {active && <ViewActions view={active} />}
        </div>
      )}
      {open && <FilterSheet onClose={() => setOpen(false)} />}
      {saving && <SaveViewSheet params={current} onClose={() => setSaving(false)} />}
    </div>
  );
}

/** On a saved view: rename, pin (admins), delete. */
function ViewActions({ view }: { view: SavedView }) {
  const app = useApp();
  const [, setParams] = useSearchParams();
  const [renaming, setRenaming] = useState(false);
  const mine = view.personId === app.viewer.id;
  return (
    <span className="row" style={{ gap: 'var(--s2)', marginLeft: 'auto' }}>
      {(mine || app.viewer.admin) && <button type="button" className="linkish small" onClick={() => setRenaming(true)}>Rename</button>}
      {app.viewer.admin && <button type="button" className="linkish small" onClick={() => void app.pinView(view.id, !view.pinned).then(() => app.toast(view.pinned ? 'Unpinned' : 'Pinned for everyone'))}>{view.pinned ? 'Unpin' : 'Pin for everyone'}</button>}
      {(mine || (app.viewer.admin && view.pinned)) && <button type="button" className="linkish small" onClick={() => void app.deleteView(view.id).then(() => { setParams({}, { replace: true }); app.toast('View deleted'); })}>Delete</button>}
      {renaming && <SaveViewSheet params={view.params} view={view} onClose={() => setRenaming(false)} />}
    </span>
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
  const checks = <T extends string>(legend: string, opts: [T, string][], value: T[], set: (v: T[]) => void) => (
    <fieldset className="filter-group"><legend className="field-label">{legend}</legend>
      <span className="filter-options">{opts.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={value.includes(k)} onChange={() => set(toggle(value, k))} /> {l}</label>)}</span>
    </fieldset>
  );
  const levels: [Level, string][] = (['north-star', 'svp', 'team'] as Level[]).map((l) => [l, LEVEL_LABEL[l]]);
  const people = app.snapshot.people.filter((p) => app.snapshot.goals.some((g) => g.ownerId === p.id));
  const match = people.filter((p) => owner.trim() && p.name.toLowerCase().includes(owner.trim().toLowerCase()) && !q.owner.includes(p.id)).slice(0, 6);
  const tops = app.snapshot.goals.filter((g) => app.snapshot.goals.some((c) => c.parentId === g.id));
  return (
    <Sheet open onClose={onClose} title="Filter goals" wide>
      <div className="filter-sheet">
        {checks('Status', STATUS_OPTIONS, q.status, (status) => setQ({ ...q, status }))}
        {checks('Needs someone', NEED_OPTIONS, q.needs, (needs) => setQ({ ...q, needs }))}
        {checks('Level', levels, q.level, (level) => setQ({ ...q, level }))}
        {checks('Team', app.snapshot.teams.map((t) => [t.id, t.name] as [string, string]), q.team, (team) => setQ({ ...q, team }))}
        <fieldset className="filter-group"><legend className="field-label">Owner</legend>
          <span className="filter-options">{q.owner.map((id) => <button key={id} type="button" className="filter-chip" aria-label={`Remove owner ${app.person(id)?.name}`} onClick={() => setQ({ ...q, owner: q.owner.filter((x) => x !== id) })}>{app.person(id)?.name}<span aria-hidden="true"> ✕</span></button>)}</span>
          <input className="input" type="search" placeholder="Find an owner" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Find an owner" />
          {match.length > 0 && <span className="filter-options">{match.map((p) => <button key={p.id} type="button" className="btn sm" onClick={() => { setQ({ ...q, owner: [...q.owner, p.id] }); setOwner(''); }}>{p.name}</button>)}</span>}
        </fieldset>
        {checks('Type', KIND_OPTIONS, q.kind, (kind) => setQ({ ...q, kind }))}
        <fieldset className="filter-group"><legend className="field-label">Due</legend>
          <select className="input" aria-label="Due" value={q.due == null ? '' : String(q.due)} onChange={(e) => setQ({ ...q, due: e.target.value === '' ? null : e.target.value === 'quarter' ? 'quarter' : Number(e.target.value) })}>
            <option value="">Any time</option>
            <option value="quarter">This quarter</option>
            {[app.week + 2, app.week + 4, app.week + 8].filter((w) => w <= app.cycle.weeks).map((w) => <option key={w} value={w}>By week {w}</option>)}
          </select>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Last check-in</legend>
          <select className="input" aria-label="Last check-in" value={q.quiet == null ? '' : String(q.quiet)} onChange={(e) => setQ({ ...q, quiet: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Any time</option>
            <option value="2">2 or more weeks ago</option>
            <option value="4">4 or more weeks ago</option>
          </select>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Last quarter</legend>
          <select className="input" aria-label="Last quarter" value={q.quarter ?? ''} onChange={(e) => setQ({ ...q, quarter: (e.target.value || null) as GoalQuery['quarter'] })}>
            <option value="">Met or missed</option><option value="met">Met its plan</option><option value="missed">Missed its plan</option>
          </select>
        </fieldset>
        {checks('Result', RESULT_OPTIONS, q.result, (result) => setQ({ ...q, result }))}
        <fieldset className="filter-group"><legend className="field-label">Links</legend>
          <select className="input" aria-label="In the tree of" value={q.feeds ?? ''} onChange={(e) => setQ({ ...q, feeds: e.target.value || null })}>
            <option value="">Any tree</option>
            {tops.map((g) => <option key={g.id} value={g.id}>In the tree of {g.title}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={q.helps} onChange={(e) => setQ({ ...q, helps: e.target.checked })} /> With “also helps” links</label>
        </fieldset>
      </div>
      <div className="row between" style={{ marginTop: 'var(--s4)' }}>
        <button type="button" className="linkish small" onClick={() => setQ({ ...EMPTY_QUERY, q: q.q, sort: q.sort, dir: q.dir })}>Clear filters</button>
        <button type="button" className="btn primary" onClick={onClose}>Show the goals</button>
      </div>
    </Sheet>
  );
}
