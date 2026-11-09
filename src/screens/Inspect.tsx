/* Walking a review one goal at a time. A review is the goal pages themselves in a fixed order, with next and previous
   and a bar for what's said. (The rows, trees and Watch button that used to live here are in ui/goalRows.) */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { weekDates } from '../domain/plan';
import { reviewedText, reviewSession, sessionWhen } from '../domain/review';
import type { Decision, Goal } from '../domain/types';
import { Sheet } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { EDITED } from '../domain/vocabulary';

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
    /**
     * After reviewing this goal: the next goal not yet covered. With none left in the walk, back to the review, which
     * leads with what was said once every goal in it is reviewed, or shows the ones on track still to mark.
     */
    afterCall: () => {
      const nextId = order.slice(index + 1).find((id) => id !== goalId && open(id)) ?? order.slice(0, Math.max(0, index)).find((id) => id !== goalId && open(id));
      if (nextId || !review || !session) return go(nextId);
      nav(`/reviews/${review.id}`);
    },
  };
}

export function ReviewBar({ goalId }: { goalId: string }) {
  const app = useApp();
  const rv = useReview(goalId);
  const nav = useNavigate();
  if (!rv.active || !rv.review) return null;
  return (
    <div className="reviewbar" role="navigation" aria-label={rv.review.name}>
      <span className="stack" style={{ gap: 0, minWidth: 0 }}>
        <span className="small strong ellipsis">{rv.review.name}</span>
        {/* The walk is the goals to discuss; the review covers more (those with nothing flagged), so both are named
            and "reviewed" counts the whole review, as its page and ring do (demo review, 8 Nov, item 7). */}
        {/* Which session this is, on a line of its own so a phone's bar keeps its width (review F07). */}
        {rv.session && <span className="reviewbar-when small muted ellipsis">{sessionWhen(rv.session, app.today)}</span>}
        <span className="hint">Goal {rv.index + 1} of {rv.total}{rv.session && rv.total < rv.session.total ? ' to discuss' : ''} · {rv.session ? reviewedText(rv.session) : `${rv.done} reviewed`}</span>
      </span>
      <div className="bar ok reviewbar-track" aria-hidden="true"><i style={{ width: `${rv.total ? (rv.done / rv.total) * 100 : 100}%` }} /></div>
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
          {said.map((d) => <li key={d.id}>{d.byId === app.viewer.id && <button type="button" className="linkish small said-edit" onClick={() => { setEditing(d); setMode(d.kind as Say); }} aria-label={`Edit this ${d.kind === 'ask' ? 'question' : d.kind}`}>Edit</button>}{d.kind === 'note' && (d.byId === app.viewer.id || app.viewer.admin) && <button type="button" className="linkish small said-edit" onClick={() => void app.deleteNote(d.id).catch(() => undefined)} aria-label="Remove this note">Remove</button>}<span className="field-label">{d.kind === 'ask' ? `Question for ${owner}` : d.kind === 'action' ? `Action · ${app.person(d.assigneeId ?? goal.ownerId)?.name.split(' ')[0] ?? owner}${d.dueWeek ? `, by week ${d.dueWeek}` : ''}` : 'Note'}</span><span className="small">{d.note}{d.editedAt && <span className="hint edited-mark"> · {EDITED}</span>}</span></li>)}
        </ul>
      )}
      <div className="row decide-buttons">
        <button className="btn primary big-btn" disabled={busy} onClick={() => void next()}>{rv.session.done + (reviewed ? 0 : 1) >= rv.session.total ? 'Reviewed & finish' : rv.done + (reviewed ? 0 : 1) >= rv.total ? 'Reviewed & back to the review' : 'Reviewed & next'}</button>
        <button className="btn big-btn" disabled={busy} onClick={() => setMode('note')}>Add a note</button>
      </div>
      <div className="quiet-links">
        {!own && <button type="button" className="linkish" onClick={() => setMode('ask')}>Ask {owner} a question</button>}
        <button type="button" className="linkish" onClick={() => setMode('action')}>Add an action</button>
        {/* On a phone the review bar's next arrow does this; the row keeps to what the review says. */}
        {!reviewed && <button type="button" className="linkish skip-now" onClick={rv.next}>Skip for now</button>}
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
        <span className="hint">In {rv.review?.name}. {mode === 'ask' ? `${owner} sees it on Home and on the goal, open until they answer it.` : mode === 'action' ? 'Whoever does it sees it on Home and on the goal, open until it’s marked done.' : 'It stays on this goal and in the review’s record.'}</span>
        <label className="field"><span className="field-label composer-label">{mode === 'ask' ? `Your question for ${owner}` : mode === 'action' ? 'The action' : 'Your note'}</span>
          <textarea className={'input' + (tried && text.trim().length < 3 ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send"
            placeholder={mode === 'ask' ? 'e.g. What would it take to land the interim scope by week 8?' : mode === 'action' ? 'What needs doing' : 'What the review said'} />
          {tried && text.trim().length < 3 && <span className="hint tone-off" role="alert">Write a few words first.</span>}
        </label>
        {mode === 'action' && (
          <div className="pair">
            <label className="field"><span className="field-label">Who</span>
              <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>{app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{app.personName(p.id)}</option>)}</select>
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
