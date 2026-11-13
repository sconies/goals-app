/* Walking a review one goal at a time. A review is the goal pages themselves in a fixed order, with next and previous
   and a bar for what's said. (The rows, trees and Watch button that used to live here are in ui/goalRows.) */
import { lazy, Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { weekDates } from '../domain/plan';
import { canSpeakFor, dayText, joinLine, reviewedText, reviewSession, sessionPlan, sessionWhen, walkOrder } from '../domain/review';
import { acceptedReason, acceptNote, decisionFor, lastTime, MIN_ACCEPT_REASON, needsDecision } from '../domain/decide';
import { canMarkDone } from '../domain/asks';
import { reviewDate } from '../domain/progress';
import type { Decision, Goal } from '../domain/types';
import { Sheet, WarnMark } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { PersonPick } from '../ui/PersonPick';
import { ASK_STATUS, DECIDED, EDITED, LABEL } from '../domain/vocabulary';
import { loadReviewOrder, saveReviewOrder } from './reviewOrder';

/* "Propose a new goal" (GE10, decision 15): its sheet loads only when opened. */
const ProposeInReview = lazy(() => import('../ui/ProposeInReview').then((m) => ({ default: m.ProposeInReview })));

/* ---------- review order: fixed when a session starts (reviewOrder.ts) ---------- */
export { saveReviewOrder };

/** Where this goal sits in the review being walked (from `?review=<id>`), and how to move on. */
export function useReview(goalId: string) {
  const app = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const review = app.snapshot.reviews.find((r) => r.id === params.get('review'));
  const session = review ? reviewSession(review, app.snapshot, app.cycle, app.today, app.week) : null;
  // The order fixed when the session started. Opened from a goal's own address (or a new tab), it is the agenda's own
  // walk as the session started, kept from then on, so saving an action never reshuffles it (deep review T3).
  const saved = review && session ? loadReviewOrder(app.ws.id, review.id, session.week) : null;
  let order: string[] = saved ?? [];
  if (review && session && (!saved || !saved.includes(goalId))) {
    const plan = sessionPlan(session, app.snapshot, app.cycle, app.today);
    order = walkOrder(plan);
    if (!order.includes(goalId)) order = walkOrder(plan, true);
    saveReviewOrder(app.ws.id, review.id, session.week, order);
  }
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

type Say = 'note' | 'ask' | 'action' | 'accept';

/** "by Thu 19 Nov": the day a week's check-ins are due, for an action due that week. */
export const byDay = (cycle: Parameters<typeof reviewDate>[0], week: number) => `by ${dayText(reviewDate(cycle, week))}`;

/**
 * What someone in the review says about this goal. Adding a note, question or action saves it here and
 * stays on this goal; "Reviewed & next" is the one thing that moves on. A goal off track or at risk asks first
 * "What happens next, who, by when?": a next step with an owner and a week, or "We accept the risk" with a reason
 * (decide.ts; deep review P2). The last goal of the session goes to the review's Finish, which says what was decided.
 */
export function ReviewCallBar({ goal }: { goal: Goal }) {
  const app = useApp();
  const nav = useNavigate();
  const rv = useReview(goal.id);
  const [mode, setMode] = useState<Say | null>(null);
  const [proposing, setProposing] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  if (!rv.active || !rv.review || !rv.session) return null;
  if (!canSpeakFor(rv.review, app.viewer)) {
    return <div className="decide"><span className="hint">You’re looking at {rv.review.name}. {joinLine(rv.review, (id) => app.person(id)?.name ?? null).replace('You’re not in this review. ', '')} Only people in it, or an admin, speak for it.</span><div className="row decide-buttons"><button className="btn big-btn" onClick={rv.next}>Next goal</button></div></div>;
  }
  const own = goal.ownerId === app.viewer.id;
  const first = (id: string | null | undefined) => app.person(id ?? '')?.name.split(' ')[0] ?? 'Someone';
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const said = rv.session.said.filter((d) => d.goalId === goal.id && d.kind !== 'acknowledge');
  const reviewed = rv.session.covered.has(goal.id);
  const status = app.attentionOf(goal).status.status;
  const decided = decisionFor(goal, rv.session, app.snapshot, app.cycle, app.week, app.today);
  const mustDecide = needsDecision(status) && !decided && !reviewed;
  // The last goal still to review finishes the session: that happens on the review's page, which says what was decided.
  const finishing = !reviewed && rv.session.done + 1 >= rv.session.total;
  const carried = (lastTime(rv.review, app.snapshot, rv.session.week, app.week)?.actions ?? []).filter((a) => a.goalId === goal.id);
  const next = async () => {
    if (finishing) { nav(`/reviews/${rv.review!.id}?finish=${goal.id}`); return; }
    setBusy(true);
    try {
      // Saying something already counts as reviewing it; otherwise record that it was looked at.
      if (!reviewed) await app.reviewCall(goal, rv.review!, rv.session!.week, 'acknowledge', '');
      rv.afterCall();
    } catch { setBusy(false); }
  };
  const label = { note: 'note', ask: 'question', action: 'action', accept: 'decision' } as const;
  const sayLabel = (d: Decision) => {
    const reason = d.kind === 'note' ? acceptedReason(d.note) : null;
    if (reason != null) return DECIDED['accept-risk'].label;
    return d.kind === 'ask' ? `Question for ${owner}` : d.kind === 'action' ? `Action · ${app.person(d.assigneeId ?? goal.ownerId)?.name.split(' ')[0] ?? owner}${d.dueWeek ? `, ${byDay(app.cycle, d.dueWeek)}` : ''}` : 'Note';
  };
  return (
    <div className="decide">
      {carried.length > 0 && (
        <ul className="said carried" aria-label="Last time">
          {carried.map((a) => <li key={a.ask.id}><span className="field-label">Last time, {first(a.who)} agreed{a.dueWeek ? ` (${byDay(app.cycle, a.dueWeek)})` : ''}</span><span className="small">{a.ask.ask} · <CarriedState state={a.state} /></span>{a.state !== 'done' && canMarkDone(a.ask, app.viewer) && <button type="button" className="linkish small said-edit" onClick={() => void app.markActionDone(a.ask).then(() => app.toast('Marked done')).catch(() => undefined)}>Mark done</button>}</li>)}
        </ul>
      )}
      {said.length > 0 && (
        <ul className="said">
          {said.map((d) => <li key={d.id}>{d.byId === app.viewer.id && <button type="button" className="linkish small said-edit" onClick={() => { setEditing(d); setMode(d.kind === 'note' && acceptedReason(d.note) != null ? 'accept' : d.kind as Say); }} aria-label={`Edit this ${d.kind === 'ask' ? 'question' : d.kind}`}>Edit</button>}{d.kind === 'note' && (d.byId === app.viewer.id || app.viewer.admin) && <button type="button" className="linkish small said-edit" onClick={() => void app.deleteNote(d.id).catch(() => undefined)} aria-label="Remove this note">Remove</button>}<span className="field-label">{sayLabel(d)}</span><span className="small">{d.kind === 'note' ? acceptedReason(d.note) ?? d.note : d.note}{d.editedAt && <span className="hint edited-mark"> · {EDITED}</span>}</span></li>)}
        </ul>
      )}
      {mustDecide ? (
        <section className="decide-next" aria-labelledby="decide-q">
          <h2 className="decide-q" id="decide-q">What happens next, who, by when?</h2>
          <span className="hint">It’s {LABEL[status as 'off' | 'risk'].toLowerCase()}. Agree a next step with an owner and a date, or say why the review accepts the risk.</span>
          <div className="row decide-buttons">
            <button className="btn primary big-btn" disabled={busy} onClick={() => setMode('action')}>Add the next step</button>
            <button className="btn big-btn" disabled={busy} onClick={() => setMode('accept')}>{DECIDED['accept-risk'].label}</button>
          </div>
        </section>
      ) : (
        <div className="row decide-buttons">
          <button className="btn primary big-btn" disabled={busy} onClick={() => void next()}>{finishing ? 'Reviewed & finish' : rv.done + (reviewed ? 0 : 1) >= rv.total ? 'Reviewed & back to the review' : 'Reviewed & next'}</button>
          <button className="btn big-btn" disabled={busy} onClick={() => setMode('note')}>Add a note</button>
        </div>
      )}
      <div className="quiet-links">
        {mustDecide && <button type="button" className="linkish" onClick={() => setMode('note')}>Add a note</button>}
        {!own && <button type="button" className="linkish" onClick={() => setMode('ask')}>Ask {owner} a question</button>}
        {!mustDecide && <button type="button" className="linkish" onClick={() => setMode('action')}>Add an action</button>}
        <button type="button" className="linkish propose-now" onClick={() => setProposing(true)}>Propose a new goal</button>
        {/* On a phone the review bar's next arrow does this; the row keeps to what the review says. */}
        {!reviewed && <button type="button" className="linkish skip-now" onClick={rv.next}>Skip for now</button>}
      </div>
      {proposing && <Suspense fallback={null}><ProposeInReview goal={goal} review={rv.review} onClose={() => setProposing(false)} /></Suspense>}
      {mode && <SayComposer goal={goal} mode={mode} existing={editing} needDate={needsDecision(status)} onPropose={() => { setMode(null); setEditing(null); setProposing(true); }} onClose={() => { setMode(null); setEditing(null); }} onSaved={() => { const m = mode; setMode(null); setEditing(null); app.toast(m === 'accept' ? `The review accepts the risk on ${goal.title}` : `${label[m][0]!.toUpperCase() + label[m].slice(1)} saved on ${goal.title}`); }} />}
    </div>
  );
}

/** How an action agreed last time stands: a shape and a word. */
export function CarriedState({ state }: { state: 'open' | 'done' | 'overdue' }) {
  return <span className={'action-state state-' + state}>{state === 'done' ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : state === 'overdue' ? <WarnMark /> : <span className="open-mark" aria-hidden="true" />}{ASK_STATUS[state].label}</span>;
}

/** A focused composer that names the goal and the review, with Save right under the field so it stays in reach with the keyboard open. */
function SayComposer({ goal, mode, existing, needDate, onClose, onSaved, onPropose }: { goal: Goal; mode: Say; existing?: Decision | null; needDate: boolean; onClose: () => void; onSaved: () => void; onPropose?: () => void }) {
  const app = useApp();
  const rv = useReview(goal.id);
  const [text, setText] = useState(existing ? (mode === 'accept' ? acceptedReason(existing.note) ?? '' : existing.note) : '');
  const [who, setWho] = useState(existing?.assigneeId ?? goal.ownerId);
  const [due, setDue] = useState<number | null>(existing?.dueWeek ?? null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const title = { note: 'Add a note', ask: `Ask ${owner}`, action: needDate ? 'The next step' : 'Add an action', accept: DECIDED['accept-risk'].label }[mode];
  const min = mode === 'accept' ? MIN_ACCEPT_REASON : 3;
  // A next step for a goal behind needs a date: it is what "Being handled" reads (attention.ts).
  const missingDate = mode === 'action' && needDate && due == null;
  const save = async () => {
    if (text.trim().length < min || missingDate) { setTried(true); return; }
    setBusy(true);
    try {
      if (mode === 'accept') {
        if (existing) await app.editCall(existing, acceptNote(text));
        else await app.acceptRisk(goal, rv.review!, rv.session!.week, text);
      } else if (existing) await app.editCall(existing, text, mode === 'action' ? { assigneeId: who, dueWeek: due } : undefined);
      else await app.reviewCall(goal, rv.review!, rv.session!.week, mode, text, mode === 'action' ? { assigneeId: who, dueWeek: due } : undefined);
      onSaved();
    } catch { setBusy(false); } // the draft stays, and so do you
  };
  const weeks = Array.from({ length: Math.max(0, app.cycle.weeks - app.week + 1) }, (_, k) => app.week + k);
  return (
    <Sheet open onClose={onClose} title={`${title}: ${goal.title}`}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">In {rv.review?.name}. {mode === 'ask' ? `${owner} sees it on Home and on the goal, open until they answer it.` : mode === 'action' ? 'Whoever does it sees it on Home and on the goal, open until it’s marked done.' : mode === 'accept' ? 'No action for now. The reason stays on the goal and in the review’s record, and the goal still needs attention.' : 'It stays on this goal and in the review’s record.'}</span>
        <label className="field"><span className="field-label composer-label">{mode === 'ask' ? `Your question for ${owner}` : mode === 'action' ? 'What happens next' : mode === 'accept' ? 'Why the review accepts the risk' : 'Your note'}</span>
          <textarea className={'input' + (tried && text.trim().length < min ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send"
            placeholder={mode === 'ask' ? 'e.g. What would it take to land the interim scope by week 8?' : mode === 'action' ? 'What needs doing' : mode === 'accept' ? 'e.g. The vendor’s fix lands in their next release; nothing we can do sooner.' : 'What the review said'} />
          {tried && text.trim().length < min && <span className="hint tone-off" role="alert">{mode === 'accept' ? 'Say why, in a few words.' : 'Write a few words first.'}</span>}
        </label>
        {mode === 'action' && (
          <div className="pair">
            <PersonPick value={who} onChange={setWho} label="Who" />
            <label className="field"><span className="field-label">By{!needDate && <> <span className="hint">optional</span></>}</span>
              <select className={'input' + (tried && missingDate ? ' invalid' : '')} value={due ?? ''} onChange={(e) => setDue(e.target.value ? Number(e.target.value) : null)}><option value="">{needDate ? 'Choose a week' : 'No date'}</option>{weeks.map((w) => <option key={w} value={w}>{w === app.week ? 'This week' : `Week ${w}`} · {weekDates(app.cycle, w)}</option>)}</select>
              {tried && missingDate && <span className="hint tone-off" role="alert">Choose the week it’s due by.</span>}
            </label>
          </div>
        )}
        {/* A new goal the room agrees on is proposed, not an action (GE10, decision 15): here too, so a phone has it. */}
        {mode === 'action' && !existing && onPropose && <button type="button" className="linkish small" onClick={onPropose}>Propose a new goal instead</button>}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : mode === 'accept' ? 'Save the decision' : mode === 'action' && needDate ? 'Save the next step' : `Save ${mode === 'ask' ? 'question' : mode}`}</button></div>
      </form>
    </Sheet>
  );
}
