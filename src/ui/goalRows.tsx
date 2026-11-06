/* A goal where goals are listed: one row component at three densities, the trees built from it, the card at the top of
   a tree, and the Watch button. Every row leads with its status as a shape and a word, says its number the same way
   ("No value yet" when there isn't one), and never repeats it as the gap. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { fmt, gapBeside, LEVEL_LABEL, nowText } from '../domain/format';
import { daysSince } from '../domain/plan';
import { coveringWatches, watchOf } from '../domain/review';
import { assessPosted, checkInsFor, LABEL } from '../domain/status';
import { goalResult, RESULT_TEXT } from '../domain/story';
import { descendants, forecastText, statusChange, type TreeNode } from '../domain/tree';
import type { Goal, Level, Watch } from '../domain/types';
import { Spark, StageSpark } from './charts';
import { Chip, LevelTag, Sheet, StatusWord } from './bits';
import { Icon } from './Icon';
import { valueSeries } from '../domain/plan';

type App = ReturnType<typeof useApp>;

/** "Checked in 2 days ago", "No check-in for 24 days", "No check-in yet". */
export function freshness(g: Goal, app: App): { text: string; stale: boolean } {
  const own = checkInsFor(g, app.snapshot.checkIns);
  const last = own[own.length - 1];
  if (!last) return { text: 'No check-in yet', stale: app.week > 1 };
  const d = daysSince(last.postedAt, app.today);
  const stale = app.statusOf(g).status === 'stale';
  return { text: stale ? `No check-in for ${d} days` : d < 1 ? 'Checked in today' : d === 1 ? 'Checked in yesterday' : `Checked in ${d} days ago`, stale };
}

/**
 * One goal in a list.
 * - `full` (the default): status, name and level, why it's listed (what changed, a flag, or the owner and how fresh it
 *   is), and its number over the gap, with a missed result in words.
 * - `line` (Home's own goals): status, name, the number and gap on one line, and a sparkline.
 * - `brief` (a review's agenda): status, name and level, the number and gap. No reasons: the walk shows them.
 */
export function GoalRow({ g, density = 'full', showOwner = true, why, whyTitle, className }: {
  g: Goal;
  density?: 'full' | 'line' | 'brief';
  showOwner?: boolean;
  /** In place of the usual reason line (`full` only), such as what's in hand for a goal being handled. */
  why?: ReactNode;
  whyTitle?: string;
  className?: string;
}) {
  const app = useApp();
  // Only the full row says why a goal is listed, so only it needs the goal's attention; the others need its status.
  const att = density === 'full' ? app.attentionOf(g) : null;
  const st = att?.status ?? app.statusOf(g);
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapBeside(g, a);
  const now = nowText(g, a);
  const stale = st.status === 'stale';
  const asOf = stale && st.latest ? `as of week ${st.latest.week}` : null;
  const to = '/goals/' + g.id;

  if (density === 'line') {
    return (
      <Link to={to} className={'gline' + (className ? ' ' + className : '')}>
        <StatusWord k={st.status} className="gline-status" />
        <span className="gline-title">{g.title}</span>
        <span className="gline-now">{now}{(stale || gap) && <span className={'tone-' + (stale ? 'stale' : gap!.tone)}> · {stale ? 'no recent update' : gap!.short}</span>}</span>
        <span className="gline-spark">
          {g.kind !== 'milestone' ? <Spark goal={g} weeks={app.cycle.weeks} series={valueSeries(app.checkInsOf(g))} /> : a.kind === 'milestone' ? <StageSpark a={a} /> : null}
        </span>
      </Link>
    );
  }

  if (density === 'brief') {
    return (
      <Link to={to} className={'agenda-row' + (className ? ' ' + className : '')} data-tone={st.status}>
        <StatusWord k={st.status} className="agenda-status" />
        <span className="agenda-name"><span className="agenda-title">{g.title}</span><LevelTag level={g.level} /></span>
        <span className="agenda-now">
          <span className="agenda-num">{now}</span>
          {stale ? (asOf ? <span className="agenda-gap muted">{asOf}</span> : null) : gap && <span className={'agenda-gap tone-' + gap.tone}>{gap.short}</span>}
        </span>
      </Link>
    );
  }

  const flag = att!.flags.find((f) => f.kind !== 'due');
  const moved = statusChange(g, app.snapshot.checkIns);
  const owner = app.person(g.ownerId);
  const fresh = freshness(g, app);
  const result = goalResult(g, app.cycle, app.snapshot.checkIns, app.week);
  const reason = flag ? flag.detail : `${showOwner && owner ? owner.name + '. ' : ''}${fresh.text}.`;
  const title = whyTitle ?? `${moved?.worse ? `Was ${LABEL[moved.from].toLowerCase()} in week ${moved.week}. ` : ''}${reason}`;
  return (
    <Link to={to} className={'trow' + (className ? ' ' + className : '')} data-tone={st.status}>
      {/* Status is always a shape and a word, in a slot of its own so they line up down a list. */}
      <StatusWord k={st.status} className="trow-icon" wordClass="trow-status" />
      <span className="trow-main">
        <span className="trow-title"><span className="trow-name">{g.title}</span><LevelTag level={g.level} /></span>
        {/* The whole reason is in the title when a wide row clamps it to three lines. */}
        <span className="trow-why" title={title}>
          {why ?? <>
            {moved?.worse && <span className="tone-risk">Was {LABEL[moved.from].toLowerCase()} in week {moved.week}. </span>}
            {reason}
          </>}
        </span>
      </span>
      {/* The value, how it stands against the plan, and a missed result in words under them. A goal gone quiet says when
          its number is from, rather than repeating "no recent update". */}
      <span className="trow-now">
        <span>{now}</span>
        {stale ? (asOf ? <span className="trow-asof">{asOf}</span> : null) : gap && <span className={'tone-' + gap.tone}>{gap.short}</span>}
        {result && <span className={'result-tag result-' + result.kind}>{RESULT_TEXT[result.kind]}</span>}
      </span>
      {g.level !== 'team' && <span className="sr">{LEVEL_LABEL[g.level]} level</span>}
    </Link>
  );
}

/** A tree of goals as rows, each indented under the goal it feeds. */
export function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={depth ? 'tree sub' : 'tree'}>
      {nodes.map((n) => <li key={n.goal.id}><GoalRow g={n.goal} />{n.children.length > 0 && <TreeRows nodes={n.children} depth={depth + 1} />}</li>)}
    </ul>
  );
}

/** A goal at the top of a tree: its number, target, forecast and how the goals feeding it are doing. */
export function TreeCard({ node }: { node: TreeNode }) {
  const app = useApp();
  const g = node.goal;
  const st = app.statusOf(g);
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapBeside(g, a);
  const fc = forecastText(g, a, app.cycle.weeks, app.cycle);
  const feed = descendants(node);
  const counts = (['off', 'risk', 'stale', 'on', 'done', 'planned'] as const).map((k) => [k, feed.filter((c) => app.statusOf(c).status === k).length] as const).filter(([, n]) => n);
  return (
    <Link to={'/goals/' + g.id} className="outcome-card">
      <span className="outcome-title">{g.title}<LevelTag level={g.level} /></span>
      <span className="outcome-now">
        <Chip k={st.status} />
        <span className="big">{nowText(g, a)}</span>
        {g.kind === 'metric' && <span className="hint">target {fmt(g.plan.target, g)}</span>}
        {st.status !== 'stale' && gap && <span className={'small strong tone-' + gap.tone}>{gap.short}</span>}
      </span>
      {fc && <span className={fc.warn ? 'forecast small' : 'hint'}>{fc.warn && <Icon name="trend-down" />}{fc.text}</span>}
      {feed.length > 0 && (
        <span className="stack" style={{ gap: 'var(--s2)' }}>
          <span className="mix" role="img" aria-label={counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}>
            {counts.map(([k, n]) => <i key={k} className={'mix-' + k} style={{ flexGrow: n }} />)}
          </span>
          <span className="hint">{feed.length} {feed.length === 1 ? 'goal feeds' : 'goals feed'} it: {counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}</span>
        </span>
      )}
    </Link>
  );
}

function descendantsOf(goal: Goal, app: App): Goal[] {
  const out: Goal[] = [];
  const walk = (id: string) => { for (const c of app.snapshot.goals.filter((g) => g.parentId === id)) { if (out.includes(c) || c.id === goal.id) continue; out.push(c); walk(c.id); } };
  walk(goal.id);
  return out;
}

/** Watch this goal, or it and everything feeding it; or stop. Says what else is covering it. */
export function WatchButton({ goal, primary }: { goal: Goal; primary?: boolean }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const w = watchOf(app.viewer.id, goal, app.snapshot);
  const covers = coveringWatches(app.viewer.id, goal, app.snapshot);
  const coverText = (x: Watch) => x.kind === 'level' ? `every ${LEVEL_LABEL[x.ref as Level]} goal` : `${app.goal(x.ref)?.title ?? 'a goal'} and what feeds it`;
  const feeding = descendantsOf(goal, app).length;
  const label = w === null ? 'Watch' : w !== 'via' && w.kind === 'tree' ? 'Watching all' : 'Watching';
  const doWatch = async (kind: 'goal' | 'tree') => {
    try {
      await app.watch(kind, goal.id);
      if (kind === 'tree' && w && w !== 'via' && w.kind === 'goal') await app.unwatch(w.id);
      app.toast(kind === 'tree' ? `Watching ${goal.title} and everything feeding it` : `Watching ${goal.title}`);
      setOpen(false);
    } catch { /* the save already said what went wrong */ }
  };
  const stop = async (x: Watch) => {
    try {
      // The message says what stopped, with Undo (domain/removal); the sheet already said what else covers it.
      await app.unwatch(x.id);
      setOpen(false);
    } catch { /* the save already said what went wrong */ }
  };
  return (
    <>
      <button className={'btn' + (w ? ' watching' : primary ? ' primary' : '')} aria-pressed={!!w} onClick={() => (w === null && !feeding ? void doWatch('goal') : setOpen(true))}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg>{label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={goal.title}>
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          {covers.length > 0 && <p className="hint">You’re watching it as part of {covers.map(coverText).join(' and ')}.</p>}
          <div className="optlist">
            {w === null && <button className="opt" onClick={() => void doWatch('goal')}><span>Watch this goal</span><span className="hint">See its changes on Watching</span></button>}
            {feeding > 0 && !(w && w !== 'via' && w.kind === 'tree') && <button className="opt" onClick={() => void doWatch('tree')}><span>{w ? 'Also watch everything feeding it' : 'Watch it and everything feeding it'}</span><span className="hint">{feeding} more {feeding === 1 ? 'goal' : 'goals'}</span></button>}
            {w && w !== 'via' && <button className="opt" onClick={() => void stop(w)}><span>Stop watching {w.kind === 'tree' ? 'it and what feeds it' : 'this goal'}</span></button>}
            {covers.map((c) => <button key={c.id} className="opt" onClick={() => void stop(c)}><span>Stop watching {coverText(c)}</span></button>)}
          </div>
        </div>
      </Sheet>
    </>
  );
}
