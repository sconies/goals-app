/* Watching: a curated read of the goals you follow. What needs attention (new since anyone looked), what's being
   handled, what has gone quiet, what changed, what's fine. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import type { GoalAttention } from '../domain/attention';
import { fmt, gapText, LEVEL_LABEL } from '../domain/format';
import { groupWatched } from '../domain/home';
import { weekDate, weekDates } from '../domain/plan';
import { watchedGoals } from '../domain/review';
import { assessPosted, LABEL } from '../domain/status';
import type { Goal, Level, Watch } from '../domain/types';
import { LevelTag, StatusShape } from '../ui/bits';
import { Icon } from '../ui/Icon';
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
  // Needs attention is new information; what someone has looked at since its latest check-in is being handled.
  const groups = groupWatched(goals.map((g) => app.attentionOf(g)));
  const bad = groups.needs.map((a) => a.goal);
  const quiet = groups.quiet.map((a) => a.goal);
  const fine = groups.fine.map((a) => a.goal);
  // "This week" is the app's week (the same one check-ins and reviews use), not the last seven days.
  const since = weekDate(app.cycle, Math.max(0, app.week));
  const recent = app.snapshot.changes.filter((c) => c.goalId && ids.has(c.goalId) && c.at.slice(0, 10) >= since && c.actorId !== app.viewer.id).slice().reverse();

  if (!mine.length) return <StartWatching />;

  return (
    <>
      <p className="lede">{summary(goals.length, bad.length, groups.handled.length, quiet.length, recent.length)}</p>
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
      {/* Nothing needs attention: no empty column taking a gap of its own. */}
      {bad.length + quiet.length + groups.handled.length > 0 && (
        <div className="split-a">
          <Group title="Needs attention" hint={groups.handled.length ? 'Behind, with something new since anyone last looked.' : undefined} goals={bad} />
          <HandledGroup list={groups.handled} />
          <Group title="No recent update" hint="No check-in for two weeks or more, so the status can’t be trusted." goals={quiet} />
        </div>
      )}
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
      <Group title={bad.length || quiet.length || groups.handled.length ? 'On track or done' : 'All on track or done'} goals={fine} collapsed={fine.length > 6} />
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

function summary(n: number, bad: number, handled: number, quiet: number, changed: number) {
  const parts = [`${n} ${n === 1 ? 'goal' : 'goals'}`];
  if (bad) parts.push(`${bad} need${bad === 1 ? 's' : ''} attention`);
  if (handled) parts.push(`${handled} being handled`);
  if (quiet) parts.push(`${quiet} with no recent update`);
  if (changed) parts.push(`${changed} ${changed === 1 ? 'change' : 'changes'} this week`);
  if (!bad && !quiet) parts.push('nothing needs you');
  return parts.join(' · ') + '.';
}

/**
 * Behind, but someone has looked since the latest check-in and nothing new has come up: the status (shape and word)
 * and what's in hand, e.g. "Action: Maya, due week 47". On Home it starts folded away.
 */
export function HandledGroup({ list, folded }: { list: GoalAttention[]; folded?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const rows = <ul className="tree handled-list">{list.map((a) => <li key={a.goal.id}><HandledRow a={a} /></li>)}</ul>;
  if (folded) {
    // The rows are drawn only once it's opened, so nothing hidden sits in the page.
    return (
      <details className="disclose handled-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><Icon name="chevron-down" size={14} />Being handled · {list.length}<span className="handled-fold-hint">· behind, but someone has looked since the latest check-in</span></summary>
        {open && rows}
      </details>
    );
  }
  return (
    <section className="block handled-block">
      <div className="stack" style={{ gap: 'var(--s1)' }}>
        <h2 className="block-title">Being handled <span className="hint">· {list.length}</span></h2>
        <span className="hint">Behind, but someone has looked since the latest check-in. Back under Needs attention when there’s a new check-in or a new warning.</span>
      </div>
      {rows}
    </section>
  );
}

export function HandledRow({ a }: { a: GoalAttention }) {
  const app = useApp();
  const g = a.goal, st = a.status.status, h = a.handled!;
  const p = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, p);
  const now = p.kind === 'milestone' ? `${p.doneCount} of ${p.stages.length} stages` : p.actual == null || g.kind === 'milestone' ? '—' : fmt(p.actual, g);
  const flag = a.flags.find((f) => f.kind !== 'due');
  const said = h.said || flag?.detail || '';
  return (
    <Link to={'/goals/' + g.id} className="trow handled-row" data-tone={st}>
      <span className={'trow-icon tone-' + st}><StatusShape k={st} /><span className="trow-status">{LABEL[st]}</span></span>
      <span className="trow-main">
        <span className="trow-title"><span className="trow-name">{g.title}</span><LevelTag level={g.level} /></span>
        <span className="trow-why" title={`${h.text}${said ? '. ' + said : ''}`}><span className="handled-what">{h.text}</span>{said ? ` · ${said}` : ''}</span>
      </span>
      <span className="trow-now"><span>{now}</span><span className={'tone-' + gap.tone}>{gap.short}</span></span>
      {g.level !== 'team' && <span className="sr">{LEVEL_LABEL[g.level]} level</span>}
    </Link>
  );
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
