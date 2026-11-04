/* Looking across goals: trees of goals, watching, and walking a review one goal at a time.
   A review is the goal pages themselves in a fixed order, with next and previous and a bar for what's said. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { fmt, gapText, LEVEL_LABEL } from '../domain/format';
import { daysSince, weekDates } from '../domain/plan';
import { coveringWatches, reviewSession, watchOf } from '../domain/review';
import { assessPosted, checkInsFor, LABEL, RANK } from '../domain/status';
import { descendants, forecastText, statusChange, type TreeNode } from '../domain/tree';
import { goalResult, RESULT_TEXT } from '../domain/story';
import type { Decision, Goal, Level, Watch } from '../domain/types';
import { Chip, LevelTag, Sheet, StatusShape } from '../ui/bits';
import { Icon } from '../ui/Icon';

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
      <span className="stack" style={{ gap: 0, minWidth: 0 }}>
        <span className="small strong ellipsis">{rv.review.name}</span>
        <span className="hint">Goal {rv.index + 1} of {rv.total} · {rv.done} reviewed</span>
      </span>
      <div className="bar ok" aria-hidden="true"><i style={{ width: `${rv.total ? (rv.done / rv.total) * 100 : 100}%` }} /></div>
      <button className="iconbtn" aria-label="Previous goal" disabled={rv.index <= 0} onClick={rv.prev}><Icon name="chevron-left" /></button>
      <button className="iconbtn" aria-label="Next goal, without reviewing this one" onClick={rv.next}><Icon name="chevron-right" /></button>
      <button className="iconbtn" aria-label="Close the review" onClick={() => nav(`/reviews/${rv.review!.id}`)}><Icon name="close" /></button>
    </div>
  );
}

type Say = 'note' | 'ask' | 'action';

/**
 * What someone in the review says about this goal. Adding a note, question or action saves it here and
 * stays on this goal; "Reviewed & next" is the one thing that moves on.
 */
export function ReviewCallBar({ goal }: { goal: Goal }) {
  const app = useApp();
  const rv = useReview(goal.id);
  const [mode, setMode] = useState<Say | null>(null);
  const [editing, setEditing] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  if (!rv.active || !rv.review || !rv.session) return null;
  if (!rv.review.people.includes(app.viewer.id)) {
    return <div className="decide"><span className="hint">You’re looking at {rv.review.name}. Join it from the review’s page to say something.</span><div className="row decide-buttons"><button className="btn big-btn" onClick={rv.next}>Next goal</button></div></div>;
  }
  const own = goal.ownerId === app.viewer.id;
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const said = rv.session.said.filter((d) => d.goalId === goal.id && d.kind !== 'acknowledge');
  const reviewed = rv.session.covered.has(goal.id);
  const next = async () => {
    setBusy(true);
    try {
      // Saying something already counts as reviewing it; otherwise record that it was looked at.
      if (!reviewed) await app.reviewCall(goal, rv.review!, rv.session!.week, 'acknowledge', '');
      rv.afterCall();
    } catch { setBusy(false); }
  };
  const label = { note: 'note', ask: 'question', action: 'action' } as const;
  return (
    <div className="decide">
      {said.length > 0 && (
        <ul className="said">
          {said.map((d) => <li key={d.id}>{d.byId === app.viewer.id && <button type="button" className="linkish small said-edit" onClick={() => { setEditing(d); setMode(d.kind as Say); }} aria-label={`Edit this ${d.kind === 'ask' ? 'question' : d.kind}`}>Edit</button>}<span className="field-label">{d.kind === 'ask' ? `Question for ${owner}` : d.kind === 'action' ? `Action · ${app.person(d.assigneeId ?? goal.ownerId)?.name.split(' ')[0] ?? owner}${d.dueWeek ? `, by week ${d.dueWeek}` : ''}` : 'Note'}</span><span className="small">{d.note}</span></li>)}
        </ul>
      )}
      <div className="row decide-buttons">
        <button className="btn primary big-btn" disabled={busy} onClick={() => void next()}>{rv.session.done + (reviewed ? 0 : 1) >= rv.session.total ? 'Reviewed & finish' : rv.done + (reviewed ? 0 : 1) >= rv.total ? 'Reviewed & back to the review' : 'Reviewed & next'}</button>
        <button className="btn big-btn" disabled={busy} onClick={() => setMode('note')}>Add a note</button>
      </div>
      <div className="quiet-links">
        {!own && <button type="button" className="linkish" onClick={() => setMode('ask')}>Ask {owner} a question</button>}
        <button type="button" className="linkish" onClick={() => setMode('action')}>Add an action</button>
        {!reviewed && <button type="button" className="linkish" onClick={rv.next}>Skip for now</button>}
      </div>
      {mode && <SayComposer goal={goal} mode={mode} existing={editing} onClose={() => { setMode(null); setEditing(null); }} onSaved={() => { setMode(null); setEditing(null); app.toast(`${label[mode][0]!.toUpperCase() + label[mode].slice(1)} saved on ${goal.title}`); }} />}
    </div>
  );
}

/** A focused composer that names the goal and the review, with Save right under the field so it stays in reach with the keyboard open. */
function SayComposer({ goal, mode, existing, onClose, onSaved }: { goal: Goal; mode: Say; existing?: Decision | null; onClose: () => void; onSaved: () => void }) {
  const app = useApp();
  const rv = useReview(goal.id);
  const [text, setText] = useState(existing?.note ?? '');
  const [who, setWho] = useState(existing?.assigneeId ?? goal.ownerId);
  const [due, setDue] = useState<number | null>(existing?.dueWeek ?? null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const title = { note: 'Add a note', ask: `Ask ${owner}`, action: 'Add an action' }[mode];
  const save = async () => {
    if (text.trim().length < 3) { setTried(true); return; }
    setBusy(true);
    try {
      if (existing) await app.editCall(existing, text, mode === 'action' ? { assigneeId: who, dueWeek: due } : undefined);
      else await app.reviewCall(goal, rv.review!, rv.session!.week, mode, text, mode === 'action' ? { assigneeId: who, dueWeek: due } : undefined);
      onSaved();
    } catch { setBusy(false); } // the draft stays, and so do you
  };
  const weeks = Array.from({ length: Math.max(0, app.cycle.weeks - app.week + 1) }, (_, k) => app.week + k);
  return (
    <Sheet open onClose={onClose} title={`${title}: ${goal.title}`}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">In {rv.review?.name}. {mode === 'ask' ? `${owner} sees it on Home and on the goal.` : 'It stays on this goal and in the review’s record.'}</span>
        <label className="field"><span className="sr">{title}</span>
          <textarea className={'input' + (tried && text.trim().length < 3 ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send"
            placeholder={mode === 'ask' ? 'e.g. What would it take to land the interim scope by week 8?' : mode === 'action' ? 'What needs doing' : 'What the review said'} aria-label={title} />
          {tried && text.trim().length < 3 && <span className="hint tone-off" role="alert">Write a few words first.</span>}
        </label>
        {mode === 'action' && (
          <div className="pair">
            <label className="field"><span className="field-label">Who</span>
              <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="field"><span className="field-label">By <span className="hint">optional</span></span>
              <select className="input" value={due ?? ''} onChange={(e) => setDue(e.target.value ? Number(e.target.value) : null)}><option value="">No date</option>{weeks.map((w) => <option key={w} value={w}>{w === app.week ? 'This week' : `Week ${w}`} · {weekDates(app.cycle, w)}</option>)}</select>
            </label>
          </div>
        )}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : `Save ${mode === 'ask' ? 'question' : mode}`}</button></div>
      </form>
    </Sheet>
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
    try {
      await app.watch(kind, goal.id);
      if (kind === 'tree' && w && w !== 'via' && w.kind === 'goal') await app.unwatch(w.id);
      app.toast(kind === 'tree' ? `Watching ${goal.title} and everything feeding it` : `Watching ${goal.title}`);
      setOpen(false);
    } catch { /* the save already said what went wrong */ }
  };
  const stop = async (x: Watch) => {
    try {
      await app.unwatch(x.id);
      const still = covers.filter((c) => c.id !== x.id);
      app.toast(still.length ? `Stopped. Still watching it as part of ${coverText(still[0]!)}.` : `Stopped watching ${goal.title}`);
      setOpen(false);
    } catch { /* the save already said what went wrong */ }
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
  const result = goalResult(g, app.cycle, app.snapshot.checkIns, app.week);
  const why = `${moved?.worse ? `Was ${LABEL[moved.from].toLowerCase()} in week ${moved.week}. ` : ''}${flag ? flag.detail : `${showOwner && owner ? owner.name + '. ' : ''}${fresh.text}.`}`;
  return (
    <Link to={'/goals/' + g.id} className="trow" data-tone={st.status}>
      {/* Status is always a shape and a word, in a slot of its own so they line up down a list. */}
      <span className={'trow-icon tone-' + st.status}><StatusShape k={st.status} /><span className="trow-status">{LABEL[st.status]}</span></span>
      <span className="trow-main">
        <span className="trow-title"><span className="trow-name">{g.title}</span><LevelTag level={g.level} /></span>
        {/* The whole reason is in the title when a wide row clamps it to three lines. */}
        <span className="trow-why" title={why}>
          {moved?.worse && <span className="tone-risk">Was {LABEL[moved.from].toLowerCase()} in week {moved.week}. </span>}
          {flag ? flag.detail : `${showOwner && owner ? owner.name + '. ' : ''}${fresh.text}.`}
        </span>
      </span>
      {/* The value, how it stands against the plan, and a missed result in words under them. A goal gone quiet says when
          its number is from, rather than repeating "no recent update". */}
      <span className="trow-now">
        <span>{now}</span>
        {st.status === 'stale'
          ? (st.latest ? <span className="trow-asof">as of week {st.latest.week}</span> : null)
          : <span className={'tone-' + gap.tone}>{gap.short}</span>}
        {result && <span className={'result-tag result-' + result.kind}>{RESULT_TEXT[result.kind]}</span>}
      </span>
      {g.level !== 'team' && <span className="sr">{LEVEL_LABEL[g.level]} level</span>}
    </Link>
  );
}
