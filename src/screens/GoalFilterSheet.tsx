/* Every filter on Goals, in one sheet (goals spec, 2.4): loaded when it is first opened, as a first visit doesn't need
   it (the bundle budget, scripts/check-bundle.mjs). What each filter means is in domain/query.ts. */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { useGoalColumns } from '../core/app';
import { levelIds, levelName } from '../domain/levels';
import { EMPTY_QUERY, KIND_OPTIONS, NEED_OPTIONS, RESULT_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, type GoalQuery, type SortKey } from '../domain/query';
import type { Level } from '../domain/types';
import { ATTENTION, QUARTER, STOPPED } from '../domain/vocabulary';
import { Sheet } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { PickOne } from '../ui/Pick';
import { useGoalQuery } from './GoalFilters';

/** Every filter, changing the goals behind it as you go. */
export function FilterSheet({ open = true, onClose, sortOff }: { open?: boolean; onClose: () => void; sortOff?: string }) {
  const app = useApp();
  const [q, setQ] = useGoalQuery();
  const { filters: modFilters, families } = useGoalColumns();
  // A module's family of filters (Fields: one row per live list field), each ticked as Status is: any of them.
  const tick = (f: (typeof families)[number], param: string, v: string) => setQ((cur) => {
    const was = f.picked(app.snapshot, param, cur.cols[param] ?? '');
    const text = f.text(app.snapshot, param, was.includes(v) ? was.filter((x) => x !== v) : [...was, v]);
    const { [param]: _, ...cols } = cur.cols;
    return { ...cur, cols: text ? { ...cols, [param]: text } : cols };
  });
  const [owner, setOwner] = useState('');
  const [params, setParams] = useSearchParams();
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  type ListKey = 'status' | 'level' | 'team' | 'kind' | 'result';
  const checks = <T extends string>(legend: string, opts: [T, string][], key: ListKey) => (
    <fieldset className="filter-group"><legend className="field-label">{legend}</legend>
      <span className="filter-options">{opts.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={(q[key] as string[]).includes(k)} onChange={() => setQ((cur) => ({ ...cur, [key]: toggle(cur[key] as string[], k) }))} /> {l}</label>)}</span>
    </fieldset>
  );
  const levels: [Level, string][] = levelIds(app.cycle).map((l) => [l, levelName(app.cycle, l)]);
  const people = app.snapshot.people.filter((p) => app.snapshot.goals.some((g) => g.ownerId === p.id));
  const match = people.filter((p) => owner.trim() && p.name.toLowerCase().includes(owner.trim().toLowerCase()) && !q.owner.includes(p.id)).slice(0, 6);
  return (
    <Sheet open={open} onClose={onClose} title="Filter goals" wide>
      <div className="filter-sheet">
        {/* On the Map there is no sort (it is always the trees), so the sheet doesn't offer one (goals spec, 2.3). */}
        {!sortOff && <fieldset className="filter-group"><legend className="field-label">Sort</legend>
          <select className="input" aria-label="Sort" value={q.sort ? `${q.sort}${q.dir === -1 ? '.desc' : ''}` : ''} onChange={(e) => { const [k, d] = e.target.value.split('.'); setQ((cur) => ({ ...cur, sort: (k || null) as SortKey | null, dir: d === 'desc' ? -1 : 1 })); }}>
            <option value="">As grouped</option>
            {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            {SORT_OPTIONS.filter(([k]) => k === 'title' || k === 'due').map(([k, l]) => <option key={k + '.desc'} value={k + '.desc'}>{l}, reversed</option>)}
          </select>
        </fieldset>}
        {/* State (GE10): active goals by default; proposed and stopped goals are listed apart, never mixed with them. */}
        <fieldset className="filter-group"><legend className="field-label">State</legend>
          <span className="filter-options">{([['', 'Active'], ['proposed', 'Proposed'], ['stopped', STOPPED]] as const).map(([k, l]) => (
            <label key={k} className="check"><input type="radio" name="goal-state" checked={(params.get('state') ?? '') === k} onChange={() => setParams((p) => { if (k) p.set('state', k); else p.delete('state'); return p; })} /> {l}</label>
          ))}</span>
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
        {families.flatMap((f) => f.rows(app.snapshot).map((row) => {
          const picked = f.picked(app.snapshot, row.param, q.cols[row.param] ?? '');
          return (
            <fieldset key={row.param} className="filter-group"><legend className="field-label">{row.label}</legend>
              <span className="filter-options">{row.options.map((o) => <label key={o} className="check"><input type="checkbox" checked={picked.includes(o)} onChange={() => tick(f, row.param, o)} /> {o}</label>)}</span>
            </fieldset>
          );
        }))}
      </div>
      {/* Used less often: folded, and open when one of them is set. */}
      <details className="disclose filter-more" open={!!(q.kind.length || q.due != null || q.quiet != null || q.quarter || q.result.length || q.feeds || q.helps || Object.keys(q.cols).length)}>
        <summary>More filters: type, due date, no update for, last quarter, result, links</summary>
      <div className="filter-sheet">
        {checks('Type', KIND_OPTIONS, 'kind')}
        {/* A module's filters (Measured by): each chosen by find-and-pick, as the module's kind is found anywhere. */}
        {modFilters.map((f) => (
          <fieldset key={f.id} className="filter-group"><legend className="sr">{f.label}</legend>
            <PickOne kind={f.pick} label={f.label} none="Any" value={q.cols[f.param] ?? null}
              onChange={(id) => setQ((cur) => { const { [f.param]: _, ...cols } = cur.cols; return { ...cur, cols: id ? { ...cols, [f.param]: id } : cols }; })} />
          </fieldset>
        ))}
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
          {/* Any goal: its tree is the goal and everything that feeds it (find-and-pick, never a list of every goal). */}
          <PickOne kind="goal" label="In the tree of" none="Any tree" value={q.feeds} onChange={(id) => setQ((cur) => ({ ...cur, feeds: id }))} />
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
