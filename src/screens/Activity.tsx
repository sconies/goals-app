import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { watchedGoals } from '../domain/review';
import type { Change, Level } from '../domain/types';
import { Avatar } from '../ui/bits';
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
  // Arriving from Watching keeps its scope: the goals you watch (at a level, if one was picked), since a date.
  const [params, setParams] = useSearchParams();
  const watching = params.get('watching');
  const since = params.get('since');
  const level = watching && watching !== 'all' ? (watching as Level) : null;
  const scoped = watching != null || since != null;
  const watchedIds = watching != null ? new Set(watchedGoals(app.viewer.id, app.snapshot).filter((g) => !level || g.level === level).map((g) => g.id)) : null;
  const inScope = (c: Change) => (!watchedIds || (!!c.goalId && watchedIds.has(c.goalId))) && (!since || c.at.slice(0, 10) >= since);
  const all = app.snapshot.changes.filter(inScope).reverse();
  const scopeText = [watching != null ? `Goals you watch${level ? ` (${LEVEL_LABEL[level]})` : ''}` : '', since ? `since ${new Date(since + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''].filter(Boolean).join(' · ');
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
      {scoped && (
        <p className="row" style={{ gap: 'var(--s2)' }}>
          <span className="small strong">Showing: {scopeText}</span>
          <button type="button" className="linkish small" onClick={() => { setParams({}); setLimit(40); }}>Show all activity</button>
        </p>
      )}
      <div className="seg tabs scroll" role="tablist" aria-label="Show">
        {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => { setFilter(k); setLimit(40); }}>{l}<span className="tabcount">{all.filter((c) => k === 'all' || (k === 'mine' ? c.actorId === app.viewer.id : k === 'goal' ? c.entity === 'goal' || c.entity === 'workspace' : c.entity === k)).length}</span></button>)}
      </div>
      {groups.length ? groups.map(([day, items]) => (
        <section key={day} className="block">
          <h2 className="label">{day}</h2>
          <ol className="changes">{runs(items).map((r) => (r.length >= 3
            ? <ReviewedRun key={r[0]!.id} run={r} />
            : r.map((c) => <ChangeItem key={c.id} c={c} showGoal />)))}</ol>
        </section>
      )) : <div className="calm">Nothing here yet.</div>}
      {list.length > shown.length && <button className="btn" onClick={() => setLimit((n) => n + 40)}>Show more ({list.length - shown.length} older)</button>}
    </div>
  );
}

/**
 * Runs of routine review coverage ("looked at it") by one person in one review, kept together so they don't push the
 * real changes down the page. Every record is still there, one click away (visual review 2).
 */
function runs(items: Change[]): Change[][] {
  const out: Change[][] = [];
  for (const c of items) {
    const last = out[out.length - 1];
    const routine = c.entity === 'decision' && c.action === 'acknowledged';
    if (routine && last && last[0]!.action === 'acknowledged' && last[0]!.entity === 'decision' && last[0]!.actorId === c.actorId && last[0]!.summary === c.summary) last.push(c);
    else out.push([c]);
  }
  return out;
}

function ReviewedRun({ run }: { run: Change[] }) {
  const app = useApp();
  const who = app.person(run[0]!.actorId);
  const where = run[0]!.summary.replace(/^Looked at it\s*/, '');
  const [open, setOpen] = useState(false);
  return (
    <li className="change change-run">
      <Avatar p={who ?? { name: run[0]!.actorId, initials: '?' }} size="sm" />
      <details className="disclose" style={{ flex: 1, minWidth: 0 }} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="small"><strong>{who?.name ?? run[0]!.actorId}</strong> reviewed {run.length} goals {where}, nothing to add</summary>
        {open && <ol className="changes">{run.map((c) => <ChangeItem key={c.id} c={c} showGoal />)}</ol>}
      </details>
    </li>
  );
}
