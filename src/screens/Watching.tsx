/* Watching (one Watching, 5 Nov): a scope of Goals, /goals?show=watching, with the full toolbar (filters, sort,
   layouts, export, saved views). In the list it reads the goals you follow: what needs attention (new since anyone
   looked), what's being handled, what has gone quiet, what's fine, with what changed this week beside them. The Level
   filter narrows it as it does any scope. /watching stays as the way in, and its nav label. */
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { groupWatched } from '../domain/home';
import { ATTENTION, LABEL } from '../domain/vocabulary';
import { weekDate, weekDates } from '../domain/plan';
import type { Goal, Level, Watch } from '../domain/types';
import { Icon } from '../ui/Icon';
import { ChangeItem } from '../ui/ChangeItem';
import { GoalRow } from '../ui/goalRows';
import { HandledGroup } from '../ui/HandledGroup';

const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** /watching: the Watching scope of Goals, keeping anything else the link carried (a pinned day, say). */
export function Watching() {
  const { search } = useLocation();
  const p = new URLSearchParams(search);
  p.set('show', 'watching');
  return <Navigate to={'/goals?' + p.toString()} replace />;
}

/** The goals you watch (as Goals has them: filtered, worst first) in Watching's groups, with what changed this week. */
export function WatchingBody({ goals }: { goals: Goal[] }) {
  const app = useApp();
  const [managing, setManaging] = useState(false);
  const mine = app.snapshot.watches.filter((w) => w.personId === app.viewer.id);
  const ids = new Set(goals.map((g) => g.id));
  // Needs attention is new information; what someone has looked at since its latest check-in is being handled.
  const groups = groupWatched(goals.map((g) => app.attentionOf(g)));
  const bad = groups.needs.map((a) => a.goal);
  const quiet = groups.quiet.length;
  const fine = groups.fine.map((a) => a.goal);
  // "This week" is the app's week (the same one check-ins and reviews use), not the last seven days.
  const since = weekDate(app.cycle, Math.max(0, app.week));
  const recent = app.snapshot.changes.filter((c) => c.goalId && ids.has(c.goalId) && c.at.slice(0, 10) >= since && c.actorId !== app.viewer.id).slice().reverse();

  if (!mine.length) return <StartWatching />;

  return (
    <>
      <p className="lede">{summary(goals.length, bad.length, groups.handled.length, quiet, recent.length)}</p>
      <div className="split">
      {/* Nothing needs attention: no empty column taking a gap of its own. */}
      {bad.length + groups.handled.length > 0 && (
        <div className="split-a">
          {/* The one Needs attention rule (domain/attention.ts): each row says why, a goal with no recent update included. */}
          <Group title={ATTENTION.needs.label} hint={ATTENTION.needs.meaning} goals={bad} />
          <HandledGroup list={groups.handled} />
        </div>
      )}
      <aside className="split-side" aria-label="What changed">
      {recent.length > 0 && (
        <section className="block" data-part="What changed this week">
          <h2 className="block-title">What changed this week <span className="hint">· week {app.week}, {weekDates(app.cycle, Math.max(0, app.week))}</span></h2>
          <ol className="changes">{recent.slice(0, 6).map((c) => <ChangeItem key={c.id} c={c} showGoal />)}</ol>
          {recent.length > 6 && <Link className="small linkish" to={`/activity?watching=all&since=${since}`}>{recent.length - 6} more in Activity</Link>}
        </section>
      )}
      </aside>
      <div className="split-b">
      <Group title={bad.length || groups.handled.length ? 'Nothing flagged' : 'Nothing flagged in what you watch'} goals={fine} collapsed={fine.length > 6} />
      <section className="block" data-part="What you watch">
        <div className="row between">
          <h2 className="block-title">What you watch</h2>
          <button className="linkish small" onClick={() => setManaging((m) => !m)} aria-expanded={managing}>{managing ? 'Done' : 'Change'}</button>
        </div>
        <WatchList watches={mine} managing={managing} />
        {managing && <LevelPills />}
      </section>
      </div>
      </div>
    </>
  );
}

function summary(n: number, bad: number, handled: number, quiet: number, changed: number) {
  const parts = [`${n} ${n === 1 ? 'goal' : 'goals'}`];
  if (bad) parts.push(`${bad} need${bad === 1 ? 's' : ''} attention${quiet ? ` (${quiet} with ${LABEL.stale.toLowerCase()})` : ''}`);
  if (handled) parts.push(`${handled} ${ATTENTION.handled.label.toLowerCase()}`);
  if (changed) parts.push(`${changed} ${changed === 1 ? 'change' : 'changes'} this week`);
  if (!bad) parts.push('nothing needs you');
  return parts.join(' · ') + '.';
}

function Group({ title, hint, goals, collapsed }: { title: string; hint?: string; goals: Goal[]; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  if (!goals.length) return null;
  const shown = open ? goals : goals.slice(0, 5);
  return (
    <section className="block" data-part={title}>
      <div className="stack" style={{ gap: 'var(--s1)' }}>
        <h2 className="block-title">{title} <span className="hint">· {goals.length}</span></h2>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <ul className="tree">{shown.map((g) => <li key={g.id}><GoalRow g={g} /></li>)}</ul>
      {!open && <button className="linkish small" onClick={() => setOpen(true)}>Show all {goals.length}</button>}
    </section>
  );
}

function WatchList({ watches, managing }: { watches: Watch[]; managing: boolean }) {
  const app = useApp();
  const label = (w: Watch) => w.kind === 'level' ? `Every ${LEVEL_LABEL[w.ref as Level]} goal` : w.kind === 'tree' ? `${app.goal(w.ref)?.title ?? 'A goal'} and everything feeding it` : app.goal(w.ref)?.title ?? 'A goal that was removed';
  const order = { level: 0, tree: 1, goal: 2 } as const;
  return (
    <div className="optlist">
      {watches.slice().sort((a, b) => order[a.kind] - order[b.kind]).map((w) => (
        <div key={w.id} className="opt static">
          {w.kind === 'level' ? <span>{label(w)}</span> : <Link className="linkish" to={'/goals/' + w.ref}>{label(w)}</Link>}
          {managing
            ? <button className="btn sm" onClick={() => void app.unwatch(w.id)} aria-label={`Stop watching ${label(w)}`}>Stop</button>
            : <span className="hint">{w.kind === 'level' ? 'Level' : w.kind === 'tree' ? 'Tree' : 'Goal'}</span>}
        </div>
      ))}
    </div>
  );
}

function LevelPills() {
  const app = useApp();
  const watching = (l: Level) => app.snapshot.watches.some((w) => w.personId === app.viewer.id && w.kind === 'level' && w.ref === l);
  const avail = LEVELS.filter((l) => !watching(l) && app.snapshot.goals.some((g) => g.level === l));
  if (!avail.length) return null;
  return (
    <div className="field" style={{ marginTop: 'var(--s3)' }}><span className="field-label">Watch a whole level</span>
      {/* The same chip as Activity's filters: a plus, the level and how many goals it holds. */}
      <div className="level-chips">{avail.map((l) => (
        <button key={l} type="button" className="filter-chip" onClick={async () => { await app.watch('level', l); app.toast(`Watching every ${LEVEL_LABEL[l]} goal`); }}>
          <Icon name="plus" size={12} />Watch {LEVEL_LABEL[l]}<span className="tabcount">{app.snapshot.goals.filter((g) => g.level === l).length}</span>
        </button>
      ))}</div>
    </div>
  );
}

/** Nothing watched yet: the quickest ways in. One primary choice (the SVP goals, where there are any), the rest beside it. */
function StartWatching() {
  const app = useApp();
  const counts = LEVELS.map((l) => [l, app.snapshot.goals.filter((g) => g.level === l).length] as const).filter(([l, n]) => n && l !== 'team');
  const main = counts.find(([l]) => l === 'svp')?.[0] ?? counts[0]?.[0];
  const watchLevel = async (l: Level) => { await app.watch('level', l); app.toast(`Watching every ${LEVEL_LABEL[l]} goal`); };
  return (
    <section className="card watch-empty">
      <h2 className="h3">You’re not watching anything yet</h2>
      <p className="muted">Watching puts the goals you care about in one place: what’s slipping, what has had no recent update, what changed.</p>
      <div className="watch-empty-actions">
        {counts.map(([l, n]) => (
          <button key={l} type="button" className={'btn' + (l === main ? ' primary' : '')} onClick={() => watchLevel(l)}>Watch every {LEVEL_LABEL[l]} goal ({n})</button>
        ))}
        <Link className={'btn' + (main ? '' : ' primary')} to="/goals">Pick goals from the list</Link>
      </div>
    </section>
  );
}
