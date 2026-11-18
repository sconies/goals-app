/* A goal where goals are listed: one row component at three densities, the trees built from it, the card at the top of
   a tree, and the Watch button. Every row leads with its status as a shape and a word, says its number the same way
   ("No value yet" when there isn't one), and never repeats it as the gap. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { watchingOn } from '../app/reads';
import { useModules } from '../core/app';
import { fmt, gapBeside, nowText } from '../domain/format';
import { readingFrom } from '../domain/reading';
import { isEveryday, levelName } from '../domain/levels';
import { coveringWatches, watchOf } from '../domain/review';
import { assessPosted, LABEL, projects } from '../domain/status';
import { descendants, forecastText, type TreeNode } from '../domain/tree';
import { feederHead } from '../domain/feeder';
import { rollup } from '../domain/rollup';
import type { Goal, Watch } from '../domain/types';
import { Chip, LevelTag, Sheet, StatusWord, TitleTell, WarnMark } from './bits';
import { freshnessOf, rowParts, type RowAction, type RowFacts, type RowPlace } from '../domain/goalRow';
import { Icon } from './Icon';

type App = ReturnType<typeof useApp>;

/** "Checked in 2 days ago", "No check-in for 24 days", "No check-in yet", "No check-in yet · starts week 50". */
export function freshness(g: Goal, app: App): { text: string; stale: boolean } {
  return freshnessOf(g, app.statusOf(g).status, app.snapshot.checkIns, app.cycle, app.today, app.week);
}

/** The facts a row reads, from the app (domain/goalRow's rowParts is pure). */
export function rowFacts(app: App, g: Goal, extra: Partial<RowFacts> = {}): RowFacts {
  return { checkIns: app.snapshot.checkIns, people: app.snapshot.people, asks: app.snapshot.requests ?? [], cycle: app.cycle, today: app.today, week: app.week, viewerId: app.viewer.id, tell: app.goalTell(g), ...extra };
}

/**
 * One goal in a list (GOAL-ROW; docs/design/patterns/spec.md section 1). The same slots in the same order in every list:
 * status (shape and word), the value and its gap, the name, then why it is in this list, an optional second line, and
 * one button where the list is something to do. The place picks what fills the reason; it never moves a slot.
 * Links open things and buttons act: a row with no action is one link; a row with an action links only its name.
 */
export function GoalRow({ g, place = 'goals-list', showOwner = true, sayOwner, queue, act, to: href, linkState, className }: {
  g: Goal;
  place?: RowPlace;
  showOwner?: boolean;
  /** Say whose goal it is first in the reason, on goals that aren't the viewer's. */
  sayOwner?: boolean;
  /** The check-in queue: a draft kept, or this week's check-in already posted. */
  queue?: RowFacts['queue'];
  /** A button the place offers whatever the rule says (Home with no set rhythm: every goal not checked in this week). */
  act?: RowAction;
  /** Where the action goes (the check-in, or correcting it). */
  to?: string;
  linkState?: unknown;
  className?: string;
}) {
  const app = useApp();
  const parts = rowParts(g, app.attentionOf(g), place, rowFacts(app, g, { showOwner, sayOwner, queue }));
  const p = act ? { ...parts, action: act } : parts;
  // On a review's agenda, where a confirmed number came from, after it in the quiet ink (NR 2.4); a typed number says nothing.
  const from = place === 'agenda' && g.kind !== 'milestone' ? readingFrom(app.checkInsOf(g).filter((c) => c.week <= app.week).at(-1), g.decimals) : null;
  const to = '/goals/' + g.id;
  const cls = 'grow' + (p.action ? ' has-act' : '') + (className ? ' ' + className : '');
  const name = <><span className="grow-title">{p.title}</span>{p.tell && <span className="gkey title-tell" title="Another goal has this title">{p.tell}</span>}<LevelTag level={g.level} /></>;
  const body = (
    <>
      {/* Status is always a shape and a word, first, in a slot of its own so they line up down a list. */}
      <StatusWord k={p.status} className="grow-status" wordClass="grow-word" />
      {/* The number, how it stands against the plan, which week it is from, and a finished goal's result. */}
      <span className="grow-value">
        <span className="grow-num">{p.value}{from && <span className="muted grow-from"> · from {from}</span>}</span>
        {p.gap && <span className={'grow-gap tone-' + p.gap.tone}>{p.gap.text}</span>}
        {p.asOf && <span className="grow-asof">{p.asOf}</span>}
        {p.result && <span className={'result-tag result-' + p.result.kind}>{p.result.text}</span>}
      </span>
      {p.action ? <Link className="grow-name" to={to}>{name}</Link> : <span className="grow-name">{name}</span>}
      {/* One reason; the whole sentence is in the title when a wide row clamps it. */}
      {/* The title is the reason in its own words, as the goal's page says it; the owner's name is said before it. */}
      {p.reason && <span className="grow-why" title={p.reasonOwner ? p.reason.slice(p.reasonOwner.length + 2) : p.reason}>{p.reasonIsFlag && <WarnMark />}{p.reason}</span>}
      {p.context && <span className="grow-context">{p.contextIsFlag && <WarnMark />}{p.context}</span>}
      {!isEveryday(app.cycle, g.level) && <span className="sr">{levelName(app.cycle, g.level)} level</span>}
    </>
  );
  if (!p.action) return <Link to={to} className={cls} data-tone={p.status} data-place={place}>{body}</Link>;
  return (
    <div className={cls} data-tone={p.status} data-place={place}>
      {body}
      <Link className={'btn grow-act' + (p.action === 'Correct it' ? ' ghost' : '')} to={href ?? '/check-in/' + g.id} state={linkState} aria-label={`${p.action}: ${g.title}`}>{p.action}</Link>
    </div>
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
  const fc = projects(g, st.status) ? forecastText(g, a, app.cycle.weeks, app.cycle) : null;
  const feed = descendants(node);
  // The one roll-up, shared with the map's nodes (domain/map.ts).
  const counts = rollup(g, app.snapshot.goals, (x) => app.statusOf(x).status)?.counts ?? [];
  return (
    <Link to={'/goals/' + g.id} className="outcome-card">
      <span className="outcome-title">{g.title}<TitleTell goal={g} /><LevelTag level={g.level} /></span>
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
          <span className="hint">{feederHead('tree', feed.length)}: {counts.map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`).join(', ')}</span>
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

/**
 * Watch (goal spec, 2.5; GT3): the button opens a sheet that says what watching does before you choose: what you'll see
 * and where, that your name is listed, and that Faro sends no email. With feeders, this goal or it and everything feeding
 * it. Watching, the sheet has Done and Stop watching. Each says what it did, with Undo.
 */
export function WatchButton({ goal, primary }: { goal: Goal; primary?: boolean }) {
  const app = useApp();
  const watchingHere = watchingOn(useModules().on);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'goal' | 'tree'>('goal');
  const w = watchOf(app.viewer.id, goal, app.snapshot);
  const covers = coveringWatches(app.viewer.id, goal, app.snapshot);
  const coverText = (x: Watch) => x.kind === 'level' ? `every ${levelName(app.cycle, x.ref)} goal` : `${app.goal(x.ref)?.title ?? 'a goal'} and what feeds it`;
  const feeding = descendantsOf(goal, app).length;
  const label = w === null ? 'Watch' : w !== 'via' && w.kind === 'tree' ? 'Watching all' : 'Watching';
  const doWatch = async (kind: 'goal' | 'tree') => {
    try {
      const c = await app.run('watch', { kind, ref: goal.id });
      if (kind === 'tree' && w && w !== 'via' && w.kind === 'goal') await app.unwatch(w.id);
      const made = c?.watches?.[0]?.id;
      app.toast(kind === 'tree' ? `Watching ${goal.title} and everything feeding it` : `Watching ${goal.title}`, 'success', made ? { label: 'Undo', run: () => { void app.run('unwatch', { watchId: made }).catch(() => undefined); } } : undefined);
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
  // Watching switched off (SW1): no Watch button anywhere.
  if (!watchingHere) return null;
  return (
    <>
      <button className={'btn' + (w ? ' watching' : primary ? ' primary' : '')} aria-pressed={!!w} onClick={() => { setScope('goal'); setOpen(true); }}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg>{label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={w ? `You’re watching ${goal.title}` : `Watch ${goal.title}`}>
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          <p className="watch-says">Its check-ins, changes of status and new asks show on your Home and under Watching in Goals. Your name is listed under “Watched by” on this page. Faro sends no email.</p>
          {covers.length > 0 && <p className="hint">You’re watching it as part of {covers.map(coverText).join(' and ')}.</p>}
          {w === null && feeding > 0 && (
            <div className="optlist" role="radiogroup" aria-label="What to watch">
              <button type="button" role="radio" className="opt" aria-checked={scope === 'goal'} onClick={() => setScope('goal')}><span>This goal</span></button>
              <button type="button" role="radio" className="opt" aria-checked={scope === 'tree'} onClick={() => setScope('tree')}><span>It and the {feeding} {feeding === 1 ? 'goal' : 'goals'} feeding it</span></button>
            </div>
          )}
          {w && w !== 'via' && w.kind === 'goal' && feeding > 0 && <button type="button" className="linkish small" onClick={() => void doWatch('tree')}>Also watch the {feeding} {feeding === 1 ? 'goal' : 'goals'} feeding it</button>}
          {covers.map((c) => <button key={c.id} type="button" className="linkish small" onClick={() => void stop(c)}>Stop watching {coverText(c)}</button>)}
          <div className="foot-row">
            {w === null
              ? <><button type="button" className="btn ghost big-btn" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn primary big-btn" onClick={() => void doWatch(scope)}>Watch</button></>
              : <>{w !== 'via' && <button type="button" className="btn ghost big-btn" onClick={() => void stop(w)}>Stop watching</button>}<button type="button" className="btn primary big-btn" onClick={() => setOpen(false)}>Done</button></>}
          </div>
        </div>
      </Sheet>
    </>
  );
}
