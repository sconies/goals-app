import { useState } from 'react';
import { useApp } from '../app/state';
import type { Change } from '../domain/types';
import { ChangeItem } from './GoalScreen';

type Filter = 'all' | 'check-in' | 'goal' | 'decision' | 'mine';
const FILTERS: [Filter, string][] = [['all', 'Everything'], ['check-in', 'Check-ins'], ['goal', 'Goal changes'], ['decision', 'Review notes'], ['mine', 'Mine']];

function dayLabel(iso: string, today: Date) {
  const d = new Date(iso);
  const days = Math.round((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

/** The change log: every save, by whom and when, newest first. Drafts never appear here. */
export function Activity() {
  const app = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(40);
  const all = app.snapshot.changes.slice().reverse();
  const match = (c: Change) => filter === 'all' || (filter === 'mine' ? c.actorId === app.viewer.id : filter === 'goal' ? c.entity === 'goal' || c.entity === 'workspace' : c.entity === filter);
  const list = all.filter(match);
  const shown = list.slice(0, limit);
  const groups: [string, Change[]][] = [];
  for (const c of shown) {
    const k = dayLabel(c.at, app.today);
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(c);
    else groups.push([k, [c]]);
  }
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Activity</h1>
        <span className="small muted">Every saved change, who made it and when. Drafts aren’t logged; anything posted or saved is, and the log can’t be edited.</span>
      </div>
      <div className="seg tabs scroll" role="tablist" aria-label="Show">
        {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => { setFilter(k); setLimit(40); }}>{l}<span className="tabcount">{all.filter((c) => k === 'all' || (k === 'mine' ? c.actorId === app.viewer.id : k === 'goal' ? c.entity === 'goal' || c.entity === 'workspace' : c.entity === k)).length}</span></button>)}
      </div>
      {groups.length ? groups.map(([day, items]) => (
        <section key={day} className="block">
          <h2 className="label">{day}</h2>
          <ol className="changes">{items.map((c) => <ChangeItem key={c.id} c={c} showGoal />)}</ol>
        </section>
      )) : <div className="calm">Nothing here yet.</div>}
      {list.length > shown.length && <button className="btn" onClick={() => setLimit((n) => n + 40)}>Show more ({list.length - shown.length} older)</button>}
    </div>
  );
}
