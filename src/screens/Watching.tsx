/* Watching: a curated read of the goals you follow. What needs attention, what changed, what's fine. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { weekDate, weekDates } from '../domain/plan';
import { watchedGoals } from '../domain/review';
import type { Goal, Level, Watch } from '../domain/types';
import { Empty } from '../ui/bits';
import { ChangeItem } from './GoalScreen';
import { TreeRow, worstFirst } from './Inspect';

const LEVELS: Level[] = ['north-star', 'svp', 'team'];
type Filter = 'all' | Level;

/** The watching content, used on its own page and, in the 4-tab trial, as a tab in Goals. */
export function Watching() {
  return <div className="page watching"><WatchHead /><WatchingBody /></div>;
}

export function WatchingBody() {
  const app = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [managing, setManaging] = useState(false);
  const mine = app.snapshot.watches.filter((w) => w.personId === app.viewer.id);
  const all = watchedGoals(app.viewer.id, app.snapshot).sort(worstFirst(app));
  const levels = LEVELS.filter((l) => all.some((g) => g.level === l));
  const goals = filter === 'all' ? all : all.filter((g) => g.level === filter);
  const ids = new Set(goals.map((g) => g.id));
  const bad = goals.filter((g) => ['off', 'risk'].includes(app.statusOf(g).status));
  const quiet = goals.filter((g) => app.statusOf(g).status === 'stale');
  const fine = goals.filter((g) => !bad.includes(g) && !quiet.includes(g));
  // "This week" is the app's week (the same one check-ins and reviews use), not the last seven days.
  const since = weekDate(app.cycle, Math.max(0, app.week));
  const recent = app.snapshot.changes.filter((c) => c.goalId && ids.has(c.goalId) && c.at.slice(0, 10) >= since && c.actorId !== app.viewer.id).slice().reverse();

  if (!mine.length) return <StartWatching />;

  return (
    <>
      <p className="lede">{summary(goals.length, bad.length, quiet.length, recent.length)}</p>
      {levels.length > 1 && (
        <div className="seg tabs" role="tablist" aria-label="Level">
          {(['all', ...levels] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : LEVEL_LABEL[f]}<span className="tabcount">{f === 'all' ? all.length : all.filter((g) => g.level === f).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="split">
      <div className="split-a">
        <Group title="Needs attention" goals={bad} />
        <Group title="No recent update" hint="No check-in for two weeks or more, so the status can’t be trusted." goals={quiet} />
      </div>
      <aside className="split-side" aria-label="What changed">
      {recent.length > 0 && (
        <section className="block">
          <h2 className="block-title">What changed this week <span className="hint">· week {app.week}, {weekDates(app.cycle, Math.max(0, app.week))}</span></h2>
          <ol className="changes">{recent.slice(0, 6).map((c) => <ChangeItem key={c.id} c={c} showGoal />)}</ol>
          {recent.length > 6 && <Link className="small linkish" to={`/activity?watching=${filter}&since=${since}`}>{recent.length - 6} more in Activity</Link>}
        </section>
      )}
      </aside>
      <div className="split-b">
      <Group title={bad.length || quiet.length ? 'On track or done' : 'All on track or done'} goals={fine} collapsed={fine.length > 6} />
      <section className="block">
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

function WatchHead() {
  return (
    <div className="page-head">
      <h1 className="title-xl">Watching</h1>
      <span className="hint">The goals you follow. Watch one from its page, a whole tree, or a level.</span>
    </div>
  );
}

function summary(n: number, bad: number, quiet: number, changed: number) {
  const parts = [`${n} ${n === 1 ? 'goal' : 'goals'}`];
  if (bad) parts.push(`${bad} need${bad === 1 ? 's' : ''} attention`);
  if (quiet) parts.push(`${quiet} with no recent update`);
  if (changed) parts.push(`${changed} ${changed === 1 ? 'change' : 'changes'} this week`);
  if (!bad && !quiet) parts.push('nothing needs you');
  return parts.join(' · ') + '.';
}

function Group({ title, hint, goals, collapsed }: { title: string; hint?: string; goals: Goal[]; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  if (!goals.length) return null;
  const shown = open ? goals : goals.slice(0, 5);
  return (
    <section className="block">
      <div className="stack" style={{ gap: 'var(--s1)' }}>
        <h2 className="block-title">{title} <span className="hint">· {goals.length}</span></h2>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <ul className="tree">{shown.map((g) => <li key={g.id}><TreeRow g={g} /></li>)}</ul>
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
            ? <button className="btn sm" onClick={async () => { await app.unwatch(w.id); app.toast('Stopped watching'); }} aria-label={`Stop watching ${label(w)}`}>Stop</button>
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
      <div className="row">{avail.map((l) => <button key={l} className="pill" onClick={async () => { await app.watch('level', l); app.toast(`Watching every ${LEVEL_LABEL[l]} goal`); }}>+ {LEVEL_LABEL[l]} <span className="hint">{app.snapshot.goals.filter((g) => g.level === l).length}</span></button>)}</div>
    </div>
  );
}

/** Nothing watched yet: the quickest ways in. */
function StartWatching() {
  const app = useApp();
  const counts = LEVELS.map((l) => [l, app.snapshot.goals.filter((g) => g.level === l).length] as const).filter(([l, n]) => n && l !== 'team');
  return (
    <Empty title="You’re not watching anything yet">
      <span className="muted">Watching puts the goals you care about in one place: what’s slipping, what has had no recent update, what changed.</span>
      <div className="stack" style={{ gap: 'var(--s2)', width: '100%', maxWidth: 360 }}>
        {counts.map(([l, n]) => (
          <button key={l} className="btn" onClick={async () => { await app.watch('level', l); app.toast(`Watching every ${LEVEL_LABEL[l]} goal`); }}>Watch every {LEVEL_LABEL[l]} goal ({n})</button>
        ))}
        <Link className="btn ghost" to="/goals">Pick goals from the list</Link>
      </div>
    </Empty>
  );
}
