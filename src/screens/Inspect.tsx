/* Looking across goals: trees of goals, watching, and walking a review one goal at a time.
   A review is the goal pages themselves in a fixed order, with next and previous and a bar for what's said. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { fmt, gapText, LEVEL_LABEL } from '../domain/format';
import { daysSince } from '../domain/plan';
import { coveringWatches, reviewSession, watchOf } from '../domain/review';
import { assessPosted, checkInsFor, LABEL, RANK } from '../domain/status';
import { descendants, forecastText, statusChange, type TreeNode } from '../domain/tree';
import type { Goal, Level, Watch } from '../domain/types';
import { Chip, LevelTag, Sheet, StatusShape } from '../ui/bits';

/* ---------- review order: fixed when a session starts, so moving between goals doesn't reshuffle it ---------- */
const orderKey = (ws: string, review: string, week: number) => `goals-app-review:${ws}:${review}:${week}`;
export function saveReviewOrder(ws: string, review: string, week: number, ids: string[]) {
  try { sessionStorage.setItem(orderKey(ws, review, week), JSON.stringify(ids)); } catch { /* private mode: the live order is used */ }
}
function loadReviewOrder(ws: string, review: string, week: number): string[] | null {
  try { const v = sessionStorage.getItem(orderKey(ws, review, week)); return v ? (JSON.parse(v) as string[]) : null; } catch { return null; }
}

/** Where this goal sits in the review being walked (from `?review=<id>`), and how to move on. */
export function useReview(goalId: string) {
  const app = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const review = app.snapshot.reviews.find((r) => r.id === params.get('review'));
  const session = review ? reviewSession(review, app.snapshot, app.cycle, app.today, app.week) : null;
  const order = review && session ? loadReviewOrder(app.ws.id, review.id, session.week) ?? session.items.map((a) => a.goal.id) : [];
  const index = order.indexOf(goalId);
  const go = (id: string | undefined) => nav(id && review ? `/goals/${id}?review=${review.id}` : `/reviews/${review?.id ?? ''}`);
  const open = (id: string) => !!session && !session.covered.has(id);
  return {
    review, session, index, total: order.length,
    active: !!review && !!session && index >= 0,
    done: session ? order.filter((id) => !open(id)).length : 0,
    prev: () => { if (index > 0) go(order[index - 1]); },
    next: () => go(order[index + 1]),
    /** After saying something: the next goal not yet covered, or the summary. */
    afterCall: () => go(order.slice(index + 1).find((id) => id !== goalId && open(id)) ?? order.slice(0, Math.max(0, index)).find((id) => id !== goalId && open(id))),
  };
}

export function ReviewBar({ goalId }: { goalId: string }) {
  const rv = useReview(goalId);
  const nav = useNavigate();
  if (!rv.active || !rv.review) return null;
  return (
    <div className="reviewbar" role="navigation" aria-label={rv.review.name}>
      <span className="small strong ellipsis">{rv.review.name}</span>
      <span className="hint">{rv.index + 1} of {rv.total}</span>
      <div className="bar ok" aria-hidden="true"><i style={{ width: `${rv.total ? (rv.done / rv.total) * 100 : 100}%` }} /></div>
      <button className="iconbtn" aria-label="Previous goal" disabled={rv.index <= 0} onClick={rv.prev}>‹</button>
      <button className="iconbtn" aria-label="Next goal" onClick={rv.next}>›</button>
      <button className="iconbtn" aria-label="Close the review" onClick={() => nav(`/reviews/${rv.review!.id}`)}>✕</button>
    </div>
  );
}

/** What someone in the review says about this goal. Saying anything covers it and moves on. */
export function ReviewCallBar({ goal }: { goal: Goal }) {
  const app = useApp();
  const rv = useReview(goal.id);
  const [mode, setMode] = useState<null | 'note' | 'ask' | 'action'>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  if (!rv.active || !rv.review || !rv.session) return null;
  if (!rv.review.people.includes(app.viewer.id)) {
    return <div className="decide"><span className="hint">You’re looking at {rv.review.name}. Join it from the review’s page to say something.</span><div className="row decide-buttons"><button className="btn big-btn" onClick={rv.next}>Next goal</button></div></div>;
  }
  const own = goal.ownerId === app.viewer.id;
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const said = rv.session.said.filter((d) => d.goalId === goal.id);
  const call = async (kind: 'acknowledge' | 'note' | 'ask' | 'action') => {
    if (kind !== 'acknowledge' && text.trim().length < 3) { setTried(true); return; }
    setBusy(true);
    try {
      await app.reviewCall(goal, rv.review!, rv.session!.week, kind, kind === 'acknowledge' ? '' : text);
      app.toast(kind === 'ask' ? `Question sent to ${owner}` : kind === 'action' ? 'Action saved' : kind === 'note' ? 'Note saved' : 'Marked as seen');
      rv.afterCall();
    } catch {
      setBusy(false);
    }
  };
  const label = { note: 'Note', ask: `Question for ${owner}`, action: 'Action' } as const;
  return (
    <div className="decide">
      {said.length > 0 && <span className="calm small">✓ Covered: {said.map((d) => d.note || 'seen').join('; ')}</span>}
      {mode && (
        <form onSubmit={(e) => { e.preventDefault(); void call(mode); }}>
        <label className="field"><span className="field-label">{label[mode]}</span>
          <input className={'input' + (tried && text.trim().length < 3 ? ' invalid' : '')} autoFocus value={text} onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'ask' ? 'e.g. What would it take to land the interim scope by week 8?' : mode === 'action' ? 'Who does what, by when' : 'What the review said'} />
          {tried && text.trim().length < 3 && <span className="hint tone-off" role="alert">Write a few words first.</span>}
        </label>
        </form>
      )}
      <div className="row decide-buttons">
        {mode ? (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => void call(mode)}>{mode === 'ask' ? 'Send question' : mode === 'action' ? 'Save action' : 'Save note'}</button>
            <button className="btn big-btn" disabled={busy} onClick={() => { setMode(null); setText(''); setTried(false); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn primary big-btn" disabled={busy} onClick={() => void call('acknowledge')}>Seen, next</button>
            <button className="btn big-btn" disabled={busy} onClick={() => setMode('note')}>Add a note</button>
          </>
        )}
      </div>
      {!mode && (
        <div className="quiet-links">
          {!own && <button type="button" className="linkish" onClick={() => setMode('ask')}>Ask {owner}</button>}
          <button type="button" className="linkish" onClick={() => setMode('action')}>Add an action</button>
          <button type="button" className="linkish" onClick={rv.next}>Skip for now</button>
        </div>
      )}
    </div>
  );
}

/* ---------- watching ---------- */
function descendantsOf(goal: Goal, app: ReturnType<typeof useApp>): Goal[] {
  const out: Goal[] = [];
  const walk = (id: string) => { for (const c of app.snapshot.goals.filter((g) => g.parentId === id)) { if (out.includes(c) || c.id === goal.id) continue; out.push(c); walk(c.id); } };
  walk(goal.id);
  return out;
}

/** Watch this goal, or it and everything feeding it; or stop. Says what else is covering it. */
export function WatchButton({ goal }: { goal: Goal }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const w = watchOf(app.viewer.id, goal, app.snapshot);
  const covers = coveringWatches(app.viewer.id, goal, app.snapshot);
  const coverText = (x: Watch) => x.kind === 'level' ? `every ${LEVEL_LABEL[x.ref as Level]} goal` : `${app.goal(x.ref)?.title ?? 'a goal'} and what feeds it`;
  const feeding = descendantsOf(goal, app).length;
  const label = w === null ? 'Watch' : w !== 'via' && w.kind === 'tree' ? 'Watching all' : 'Watching';
  const doWatch = async (kind: 'goal' | 'tree') => {
    await app.watch(kind, goal.id);
    if (kind === 'tree' && w && w !== 'via' && w.kind === 'goal') await app.unwatch(w.id);
    app.toast(kind === 'tree' ? `Watching ${goal.title} and everything feeding it` : `Watching ${goal.title}`);
    setOpen(false);
  };
  const stop = async (x: Watch) => {
    await app.unwatch(x.id);
    const still = covers.filter((c) => c.id !== x.id);
    app.toast(still.length ? `Stopped. Still watching it as part of ${coverText(still[0]!)}.` : `Stopped watching ${goal.title}`);
    setOpen(false);
  };
  return (
    <>
      <button className={'btn' + (w ? ' watching' : '')} aria-pressed={!!w} onClick={() => (w === null && !feeding ? void doWatch('goal') : setOpen(true))}>
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

/* ---------- trees ---------- */
/** A goal at the top of a tree: its number, target, forecast and how the goals feeding it are doing. */
export function TreeCard({ node }: { node: TreeNode }) {
  const app = useApp();
  const g = node.goal;
  const st = app.statusOf(g);
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, a);
  const fc = forecastText(g, a, app.cycle.weeks);
  const feed = descendants(node);
  const counts = (['off', 'risk', 'stale', 'on', 'done', 'planned'] as const).map((k) => [k, feed.filter((c) => app.statusOf(c).status === k).length] as const).filter(([, n]) => n);
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? 'No value yet' : fmt(a.actual, g);
  return (
    <Link to={'/goals/' + g.id} className="outcome-card">
      <span className="outcome-title">{g.title}<LevelTag level={g.level} /></span>
      <span className="outcome-now">
        <Chip k={st.status} />
        <span className="big">{now}</span>
        {g.kind === 'metric' && <span className="hint">target {fmt(g.plan.target, g)}</span>}
        {st.status !== 'stale' && <span className={'small strong tone-' + gap.tone}>{gap.short}</span>}
      </span>
      {fc && <span className={fc.warn ? 'forecast small' : 'hint'}>{fc.warn && <span aria-hidden="true">↘ </span>}{fc.text}</span>}
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

/** Worst first: what needs attention, then the status, then the name. */
export function worstFirst(app: ReturnType<typeof useApp>) {
  return (x: Goal, y: Goal) => app.attentionOf(y).weight - app.attentionOf(x).weight || RANK[app.statusOf(y).status] - RANK[app.statusOf(x).status] || x.title.localeCompare(y.title);
}

export function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={depth ? 'tree sub' : 'tree'}>
      {nodes.map((n) => <li key={n.goal.id}><TreeRow g={n.goal} />{n.children.length > 0 && <TreeRows nodes={n.children} depth={depth + 1} />}</li>)}
    </ul>
  );
}

/** "Checked in 2 days ago", "No check-in for 24 days", "No check-in yet". */
export function freshness(g: Goal, app: ReturnType<typeof useApp>): { text: string; stale: boolean } {
  const own = checkInsFor(g, app.snapshot.checkIns);
  const last = own[own.length - 1];
  if (!last) return { text: 'No check-in yet', stale: app.week > 1 };
  const d = daysSince(last.postedAt, app.today);
  const stale = app.statusOf(g).status === 'stale';
  return { text: stale ? `No check-in for ${d} days` : d < 1 ? 'Checked in today' : d === 1 ? 'Checked in yesterday' : `Checked in ${d} days ago`, stale };
}

export function TreeRow({ g, showOwner = true }: { g: Goal; showOwner?: boolean }) {
  const app = useApp();
  const att = app.attentionOf(g);
  const st = att.status;
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, a);
  const flag = att.flags.find((f) => f.kind !== 'due');
  const moved = statusChange(g, app.snapshot.checkIns);
  const owner = app.person(g.ownerId);
  const fresh = freshness(g, app);
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? '—' : fmt(a.actual, g);
  return (
    <Link to={'/goals/' + g.id} className="trow" data-tone={st.status}>
      <span className={'trow-icon tone-' + st.status} aria-hidden="true"><StatusShape k={st.status} /></span>
      <span className="trow-main">
        <span className="trow-title">{g.title}<LevelTag level={g.level} /></span>
        <span className="trow-why">
          {moved?.worse && <span className="tone-risk">Was {LABEL[moved.from].toLowerCase()} in week {moved.week}. </span>}
          {flag ? flag.detail : `${showOwner && owner ? owner.name + '. ' : ''}${fresh.text}.`}
        </span>
      </span>
      <span className="trow-now"><span>{now}</span><span className={'tone-' + (st.status === 'stale' ? 'stale' : gap.tone)}>{st.status === 'stale' ? 'Stale' : gap.short}</span></span>
      <span className="sr">{LABEL[st.status]}{g.level !== 'team' ? `, ${LEVEL_LABEL[g.level]} level` : ''}</span>
    </Link>
  );
}
