/* Goal reviews: the list, setting one up, and a review's session: its agenda, start or continue, and what was said.
   Once a session is held, its page leads with what was said. Walking the goals happens on the goal pages themselves
   (see Inspect). */
import { useMemo, useState } from 'react';
import { useDraft } from '../app/drafts';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { weekDates } from '../domain/plan';
import { WEEKDAY } from '../domain/progress';
import { answerOf, dayText, daysPast, goalsIn, lastHeld, nextSessionDate, nextWhen, openActions, pastText, reviewedLabel, reviewedText, reviewSession, sessionPlan, sessionState, sessionStateText, sessionWhen, walkOrder, type ReviewSession, type SessionState } from '../domain/review';
import { outcomeTrees } from '../domain/tree';
import type { Goal, Level, Review as ReviewT } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Chip, Empty, ProgressRing, Sheet, WarnMark } from '../ui/bits';
import { byDay, CarriedState, saveReviewOrder } from './Inspect';
import { lastTime, sessionDecisions } from '../domain/decide';
import { canMarkDone } from '../domain/asks';
import { GoalRow } from '../ui/goalRows';
import { worstFirst } from '../domain/order';
import { Icon } from '../ui/Icon';
import { EndedReview, EndReview } from '../ui/RemoveControls';
import { ASK_STATUS, DECIDED, lower } from '../domain/vocabulary';

const cadence = (r: ReviewT) => `${r.everyWeeks === 1 ? 'Every week' : `Every ${r.everyWeeks} weeks`}, ${WEEKDAY[r.weekday]}s`;
const goalsN = (n: number) => `${n} ${n === 1 ? 'goal' : 'goals'}`;
const firstName = (n: string) => n.split(' ')[0];

/** The old single review now lives on the reviews page. */
export function ReviewRedirect() {
  return <Navigate to="/reviews" replace />;
}

/**
 * A session's state as a shape and a word. Square shapes, so they never read as a goal's status (those are circles):
 * an empty square for not started, half filled for in progress, filled with a tick for held.
 */
function SessionShape({ k }: { k: SessionState['kind'] }) {
  return (
    <svg className="session-shape" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {k === 'held'
        ? <><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="currentColor" /><path d="m4.8 8.2 2.2 2.2 4.2-4.6" fill="none" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>
        : <><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />{k === 'in-progress' && <path d="M2.25 8h11.5v3.75a2 2 0 0 1-2 2h-7.5a2 2 0 0 1-2-2z" fill="currentColor" />}</>}
    </svg>
  );
}

export function SessionStateWord({ st }: { st: SessionState }) {
  return <span className="session-state" data-state={st.kind}><SessionShape k={st.kind} /><span>{sessionStateText(st)}</span></span>;
}

export function Reviews() {
  const app = useApp();
  const sessions = app.snapshot.reviews.map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week));
  // A session under way comes first: it's the one to pick up.
  const underWay = (s: ReviewSession) => (sessionState(s).kind === 'in-progress' ? 0 : 1);
  const mine = sessions.filter((s) => s.review.people.includes(app.viewer.id)).sort((a, b) => underWay(a) - underWay(b));
  const others = sessions.filter((s) => !s.review.people.includes(app.viewer.id));
  return (
    <div className="page narrow reviews-list" data-part="Reviews">
      <div className="page-head row between">
        <span className="stack" style={{ gap: 2 }}>
          <h1 className="title-xl">Reviews</h1>
          <span className="hint">Walk a set of goals together on a cadence. Anyone can set one up.</span>
        </span>
        <Link className="btn" to="/reviews/new">Set up a review</Link>
      </div>
      {!sessions.length && <Empty title="No reviews yet"><span className="muted">A review walks a set of goals, worst and stalest first, and keeps what was said.</span><Link className="btn primary" to="/reviews/new">Set up the first review</Link></Empty>}
      {mine.length > 0 && <section className="block" data-part="You’re in"><h2 className="block-title">You’re in</h2><div className="alist">{mine.map((s) => <ReviewLine key={s.review.id} s={s} />)}</div></section>}
      {others.length > 0 && <section className="block" data-part="Other reviews"><h2 className="block-title">Other reviews</h2><div className="alist">{others.map((s) => <ReviewLine key={s.review.id} s={s} />)}</div></section>}
    </div>
  );
}

/** One review: where this session stands, its date, when it was last held, its open actions and its people. */
function ReviewLine({ s }: { s: ReviewSession }) {
  const app = useApp();
  const st = sessionState(s);
  const last = lastHeld(s.review, app.snapshot, s.week);
  const actions = openActions(s.review, app.snapshot).length;
  const people = s.review.people.map((id) => app.person(id)).filter((p) => !!p);
  const past = daysPast(s, app.today);
  const next = nextSessionDate(s, app.cycle, app.week, app.today);
  // A session past its date is outstanding, and the next one is named beside it, not instead (review F07).
  const facts: [string, string][] = st.kind === 'held'
    ? [['Next', next ? dayText(next) : 'None this cycle'], ['Open actions', String(actions)]]
    : past > 0
      ? [['Outstanding from', dayText(s.date)], ...(next ? [['Next', dayText(next)] as [string, string]] : []), ['Open actions', String(actions)]]
      : [['Session', dayText(s.date)], ['Last held', last ? dayText(last.on) : 'Not yet'], ['Open actions', String(actions)]];
  return (
    <Link className="arow rv-line" to={`/reviews/${s.review.id}`}>
      <SessionStateWord st={st} />
      <span className="rv-name">{s.review.name}</span>
      <span className="rv-facts">{facts.map(([k, v]) => <span key={k} className="rv-fact"><span className="rv-fact-k">{k}</span> <span className="rv-fact-v">{v}</span>{k === 'Outstanding from' && <span className="rv-past"><WarnMark />{pastText(past)}</span>}</span>)}</span>
      <span className="rv-people"><span className="rv-fact-k">People</span> <span className="rv-names">{people.map((p) => firstName(p.name)).join(', ')}</span></span>
    </Link>
  );
}

function Agenda({ goals }: { goals: Goal[] }) {
  // A review's agenda: the shared goal row at its briefest. No reasons: the walk shows them on each goal's page.
  return <ul className="agenda">{goals.map((g) => <li key={g.id}><GoalRow g={g} density="brief" /></li>)}</ul>;
}

/** What was said in a session: actions (who, by when), questions for owners (with any answer), notes, and the goals reviewed. */
function SessionRecord({ s, title, reviewed }: { s: ReviewSession; title: string; reviewed: 'open' | 'folded' | 'none' }) {
  const app = useApp();
  const asks = s.said.filter((d) => d.kind === 'ask');
  const actions = s.said.filter((d) => d.kind === 'action');
  const notes = s.said.filter((d) => d.kind === 'note');
  const covered = s.items.filter((a) => s.covered.has(a.goal.id)).map((a) => a.goal);
  const goalLink = (id: string) => <Link className="linkish" to={`/goals/${id}`}>{app.goal(id)?.title}</Link>;
  if (!asks.length && !actions.length && !notes.length && (reviewed === 'none' || !covered.length)) return null;
  return (
    <section className="block session-record" data-part="What was said">
      <h2 className="block-title">{title}</h2>
      {actions.length > 0 && (
        <div className="stack" style={{ gap: 'var(--s1)' }}>
          <h3 className="field-label">Actions · {actions.length}</h3>
          <ul className="record">{actions.map((d) => (
            <li key={d.id}><span className="strong">{d.note}</span><span className="hint">{app.person(d.assigneeId ?? app.goal(d.goalId)?.ownerId ?? '')?.name ?? 'Someone'} · {d.dueWeek ? `by week ${d.dueWeek}, ${weekDates(app.cycle, d.dueWeek)}` : 'no date'} · {goalLink(d.goalId)}</span>{d.ask && <span className={'small' + (d.ask.status === 'open' && d.ask.dueWeek != null && d.ask.dueWeek < app.week ? ' tone-risk' : '')}>{d.ask.status === 'done' ? <><strong>{ASK_STATUS.done.label}</strong>{d.ask.answer ? `: ${d.ask.answer}` : ''}</> : d.ask.dueWeek != null && d.ask.dueWeek < app.week ? `${ASK_STATUS.open.label}, ${lower(ASK_STATUS.overdue)}` : ASK_STATUS.open.label}</span>}</li>
          ))}</ul>
        </div>
      )}
      {asks.length > 0 && (
        <div className="stack" style={{ gap: 'var(--s1)' }}>
          <h3 className="field-label">Questions for owners · {asks.filter((d) => !answerOf(d)).length} waiting</h3>
          <ul className="record">{asks.map((d) => {
            const ans = answerOf(d);
            const g = app.goal(d.goalId);
            return (
              <li key={d.id}>
                <span className="strong">{d.note}</span>
                <span className="hint">For {firstName(app.person(g?.ownerId ?? '')?.name ?? 'the owner')} · {goalLink(d.goalId)}</span>
                {ans ? <span className="small"><strong>Answered:</strong> {ans.text}</span> : <span className="hint tone-risk">Waiting for an answer</span>}
              </li>
            );
          })}</ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="stack" style={{ gap: 'var(--s1)' }}>
          <h3 className="field-label">Notes · {notes.length}</h3>
          <ul className="record">{notes.map((d) => (
            <li key={d.id}><span>{d.note}</span><span className="hint">{firstName(app.person(d.byId)?.name ?? '')} · {goalLink(d.goalId)}</span></li>
          ))}</ul>
        </div>
      )}
      {reviewed === 'open' && covered.length > 0 && (
        <div className="stack" style={{ gap: 'var(--s1)' }}>
          <h3 className="field-label">Reviewed · {covered.length}</h3>
          <Agenda goals={covered} />
        </div>
      )}
      {reviewed === 'folded' && covered.length > 0 && (
        <details className="disclose"><summary>Reviewed · {covered.length}</summary><Agenda goals={covered} /></details>
      )}
    </section>
  );
}

/** A review: this session's agenda, start or continue, and what was said so far. Once held, it leads with what was said. */
export function ReviewHome() {
  const app = useApp();
  const nav = useNavigate();
  const { reviewId } = useParams();
  const review = app.snapshot.reviews.find((r) => r.id === reviewId);
  const [walkAll, setWalkAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listHealthy, setListHealthy] = useState(false);
  // Marking the goals with nothing flagged asks first (deep review T3): 'mark' while goals to discuss are left, 'finish'
  // when it is the last step and so ends the session.
  const [confirming, setConfirming] = useState<'mark' | 'finish' | null>(null);
  // The walk's last goal comes here to finish (`?finish=<goal>`), so the summary of what was decided is said in one place.
  const [params, setParams] = useSearchParams();
  const finishFrom = params.get('finish');
  // An ended review keeps its page: what it was, that it ended, and (for its owner or an admin) Reopen.
  const ended = !review ? app.snapshot.archive?.reviews.find((r) => r.id === reviewId) : undefined;
  if (ended) return <EndedReview review={ended} />;
  if (!review) return <div className="page narrow"><Empty title="That review doesn’t exist"><Link className="btn" to="/reviews">All reviews</Link></Empty></div>;
  const s = reviewSession(review, app.snapshot, app.cycle, app.today, app.week);
  const st = sessionState(s);
  // The walk is the exceptions, one at a time; healthy goals are acknowledged together below, or walked if you choose.
  // Which is which, and the order, are fixed as the session started, so walking it never reshuffles it (deep review T3).
  const plan = sessionPlan(s, app.snapshot, app.cycle, app.today);
  const exceptions = plan.discuss;
  const healthy = plan.healthy;
  const order = walkOrder(plan, walkAll);
  const walk = order.map((id) => s.items.find((a) => a.goal.id === id)!).filter(Boolean);
  const first = walk.find((a) => !s.covered.has(a.goal.id));
  const start = () => {
    saveReviewOrder(app.ws.id, review.id, s.week, order);
    if (first) nav(`/goals/${first.goal.id}?review=${review.id}`);
  };
  const healthyLeft = healthy.filter((a) => !s.covered.has(a.goal.id));
  const done = st.kind === 'held';
  // Finishing marks every goal not yet reviewed (the ones with nothing flagged, or the walk's last goal) and so holds the
  // session; marking the healthy goals while goals to discuss are left doesn't.
  const finishOpen = confirming === 'finish' || (!!finishFrom && !done);
  const toMark = finishOpen ? s.items.filter((a) => !s.covered.has(a.goal.id)) : healthyLeft;
  const closeSheet = () => { setConfirming(null); if (finishFrom) setParams({}, { replace: true }); };
  const ackHealthy = async () => {
    setBusy(true);
    // One save, with Undo on its message.
    try {
      await app.markReviewed(toMark.map((a) => a.goal), review, s.week, finishOpen ? `Finished ${review.name}` : undefined);
      closeSheet();
    } catch { /* the save already said what went wrong */ }
    setBusy(false);
  };
  const decided = sessionDecisions(s);
  const last = !done ? lastTime(review, app.snapshot, s.week, app.week) : null;
  const firstName2 = (id: string) => app.person(id)?.name.split(' ')[0] ?? 'Someone';
  const people = review.people.map((id) => app.person(id)).filter((p) => !!p);
  const inIt = review.people.includes(app.viewer.id);
  const canChange = inIt || app.viewer.admin;
  const join = async () => {
    try { await app.saveReview({ ...review, people: [...review.people, app.viewer.id] }, review); app.toast(`You’re in ${review.name}`); } catch { /* the save already said what went wrong */ }
  };
  const remaining = walk.filter((a) => !s.covered.has(a.goal.id));
  const reviewedItems = s.items.filter((a) => s.covered.has(a.goal.id));
  // One terse line under the name: the date and what's on, or where it got to.
  // A session past its date says "Outstanding from …", and the next one is named apart from it (review F07).
  const next = nextWhen(s, app.cycle, app.week, app.today);
  const line = (done
    ? [sessionStateText(st), next]
    : st.kind === 'in-progress'
      ? [sessionWhen(s, app.today), reviewedText(s), next]
      : [sessionWhen(s, app.today), exceptions.length ? `${exceptions.length} to discuss` : '', healthy.length ? `${healthy.length} with nothing flagged` : '', next]).filter(Boolean).join(' · ');

  return (
    <div className="page narrow review-home" data-part="Review">
      <nav aria-label="Breadcrumb" className="crumbs"><Link to="/reviews">Reviews</Link></nav>
      <section className="hero">
        <ProgressRing done={s.done} total={Math.max(1, s.total)} size={64} counts="reviewed" label={reviewedLabel(s)} />
        <div className="hero-body">
          <span className="eyebrow">{cadence(review)}</span>
          <h1 className="title-xl">{review.name}</h1>
          <span className="muted review-line">{line}</span>
          <div className="actions" style={{ marginTop: 'var(--s2)' }}>
            {inIt && !done && first && <button className="btn primary big-btn" onClick={start}>{s.done ? `Continue review · ${goalsN(remaining.length)} left` : `Start review · ${goalsN(walk.length)}`}</button>}
            {inIt && !done && !first && healthyLeft.length > 0 && <button className="btn primary big-btn" disabled={busy} onClick={() => setConfirming('finish')}>Finish review</button>}
            {!inIt && <button className="btn primary big-btn" onClick={() => void join()}>Join this review</button>}
            {canChange && <Link className="btn" to={`/reviews/${review.id}/edit`}>Edit review setup</Link>}
            <Link className="btn ghost print-link" to={`/reviews/${review.id}/print`}><Icon name="print" /><span className="print-link-label">Print or save as PDF</span></Link>
          </div>
        </div>
      </section>
      {/* What the last session agreed, and how each stands, first, before the agenda (deep review P2, backlog L(2)). */}
      {last && (
        <section className="block last-time" data-part="Last time">
          <h2 className="block-title">Last time · {dayText(last.on)}</h2>
          <ul className="record">{last.actions.map((a) => (
            <li key={a.ask.id}>
              <span className="strong">{firstName2(a.who)} agreed: {a.ask.ask}</span>
              <span className="hint">{a.dueWeek ? `${byDay(app.cycle, a.dueWeek)} · ` : ''}<Link className="linkish" to={`/goals/${a.goalId}`}>{app.goal(a.goalId)?.title}</Link></span>
              <span className="small row" style={{ gap: 'var(--s3)' }}><CarriedState state={a.state} />{a.state !== 'done' && canMarkDone(a.ask, app.viewer) && <button type="button" className="linkish small" onClick={() => void app.markActionDone(a.ask).then(() => app.toast('Marked done')).catch(() => undefined)}>Done?</button>}</span>
            </li>
          ))}</ul>
        </section>
      )}
      {/* Held: what was said comes first, with every goal reviewed. */}
      {done && <SessionRecord s={s} title="What was said" reviewed="open" />}
      {!done && remaining.length > 0 && (
        <section className="block" data-part="Still to review">
          <h2 className="block-title">Still to review · {remaining.length}</h2>
          <Agenda goals={remaining.map((a) => a.goal)} />
        </section>
      )}
      {!done && !walkAll && exceptions.length > 0 && healthyLeft.length > 0 && (
        <section className="block healthy-group" data-part="Nothing flagged">
          <div className="healthy-head">
            <h2 className="block-title">Nothing flagged · {healthyLeft.length}</h2>
            {inIt && first && <button className="btn" disabled={busy} onClick={() => setConfirming('mark')}>Mark {goalsN(healthyLeft.length)} reviewed</button>}
          </div>
          {/* Folded, and the rows exist only once opened, so a folded group doesn't hide unlabelled status shapes. */}
          <details className="disclose" onToggle={(e) => setListHealthy(e.currentTarget.open)}><summary>Show {goalsN(healthyLeft.length)}</summary>
            {listHealthy && (
              <div className="stack" style={{ gap: 'var(--s2)' }}>
                <Agenda goals={healthyLeft.map((a) => a.goal)} />
                {inIt && <button type="button" className="linkish small" onClick={() => setWalkAll(true)}>Walk them one at a time instead</button>}
              </div>
            )}
          </details>
        </section>
      )}
      {!done && <SessionRecord s={s} title="Said so far" reviewed="none" />}
      {!done && reviewedItems.length > 0 && (
        <details className="disclose"><summary>Reviewed · {reviewedItems.length}</summary><Agenda goals={reviewedItems.map((a) => a.goal)} /></details>
      )}
      {!s.items.length && <p className="hint">No goals match this review yet. <Link className="linkish" to={`/reviews/${review.id}/edit`}>Pick some</Link></p>}
      <section className="block">
        <h2 className="block-title">People</h2>
        <div className="people">{people.map((p) => <span key={p.id} className="person"><Avatar p={p} size="sm" />{p.name}</span>)}</div>
      </section>
      <EndReview review={review} />
      {/* Asked first, said plainly, with Undo on the message after (deep review T3). Only Finish ends the session. */}
      <Sheet open={!!confirming || finishOpen} onClose={closeSheet} title={finishOpen ? `Finish ${review.name}?` : `Mark ${goalsN(healthyLeft.length)} reviewed?`}>
        <div className="stack finish-summary" style={{ gap: 'var(--s4)' }}>
          {finishOpen ? (
            <>
              {/* What was decided and who owns what, said before the session is recorded (deep review P2). */}
              {(decided.byOwner.length > 0 || decided.accepted.length > 0) ? (
                <div className="stack" style={{ gap: 'var(--s2)' }}>
                  <h3 className="field-label">Decided</h3>
                  <ul className="record">
                    {decided.byOwner.map((o) => <li key={o.who}><span className="strong">{app.person(o.who)?.name ?? 'Someone'}</span>{o.steps.map((d) => <span key={d.id} className="small">{d.note}{d.dueWeek ? `, ${byDay(app.cycle, d.dueWeek)}` : ''} · {app.goal(d.goalId)?.title}</span>)}</li>)}
                    {decided.accepted.map((a) => <li key={a.goalId}><span className="strong">{DECIDED['accept-risk'].label}: {app.goal(a.goalId)?.title}</span><span className="small">{a.reason}</span></li>)}
                  </ul>
                </div>
              ) : <p className="muted">No next steps or accepted risks were recorded in this session.</p>}
              {decided.questions.length > 0 && <p className="small">{decided.questions.length === 1 ? '1 question for an owner stays' : `${decided.questions.length} questions for owners stay`} open until answered.</p>}
              <p>{toMark.length ? `${goalsN(toMark.length)} ${toMark.length === 1 ? 'is' : 'are'} marked reviewed${healthyLeft.length && toMark.length === healthyLeft.length ? ' (nothing flagged)' : ''}, ` : ''}and the session is recorded as held today. This page then leads with what was said.</p>
            </>
          ) : <p>{`The ${goalsN(healthyLeft.length)} with nothing flagged ${healthyLeft.length === 1 ? 'is' : 'are'} marked reviewed. The ${goalsN(remaining.length)} to discuss stay${remaining.length === 1 ? 's' : ''} open, and the review carries on.`}</p>}
          <p className="hint">You can undo it from the message that follows.</p>
          <div className="foot-row"><button className="btn ghost big-btn" onClick={closeSheet}>Not yet</button><button className="btn primary big-btn" disabled={busy} onClick={() => void ackHealthy()}>{busy ? 'Saving…' : finishOpen ? 'Finish the review' : `Mark ${goalsN(healthyLeft.length)} reviewed`}</button></div>
        </div>
      </Sheet>
    </div>
  );
}

/** The old end-of-session summary: a held review's own page now leads with what was said, so this goes there. */
export function ReviewSummary() {
  const { reviewId } = useParams();
  return <Navigate to={`/reviews/${reviewId ?? ''}`} replace />;
}

const WEEKS = [1, 2, 4] as const;
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Set up or change a review, on one screen: name, when, which goals, who. */
export function ReviewEdit() {
  const app = useApp();
  const nav = useNavigate();
  const { reviewId } = useParams();
  const existing = reviewId ? app.snapshot.reviews.find((r) => r.id === reviewId) ?? null : null;
  // Kept as you type, like a goal's draft, so a refresh or a wrong turn doesn't lose a half-set-up review.
  const [r, setDraft, clearDraft, restored] = useDraft<ReviewT>(`${app.ws.id}:review:${reviewId ?? 'new'}`, () => existing ?? { id: newId('rev'), name: '', everyWeeks: 1, weekday: app.cycle.reviewDay, scope: { goals: [], trees: [], levels: [] }, people: [app.viewer.id], createdBy: app.viewer.id, createdAt: app.stamp() });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const set = (p: Partial<ReviewT>) => setDraft(p);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const covered = useMemo(() => goalsIn(r.scope, app.snapshot.goals), [r.scope, app.snapshot.goals]);
  const tops = outcomeTrees(app.snapshot.goals, worstFirst(app)).trees.map((t) => t.goal);
  const found = app.snapshot.goals.filter((g) => q.trim() && g.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const ok = r.name.trim().length > 0 && covered.length > 0 && r.people.length > 0;
  const save = async () => {
    setTried(true);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await app.saveReview({ ...r, name: r.name.trim() }, existing);
      clearDraft();
      app.toast(existing ? 'Review saved' : `Set up ${r.name.trim()}`);
      nav(`/reviews/${r.id}`);
    } catch { setBusy(false); }
  };
  const problem = !r.name.trim() ? 'Give the review a name.' : !covered.length ? 'Pick at least one goal, tree or level.' : 'Add at least one person.';
  return (
    <div className="focus review-edit">
      <div className="focus-top">
        <h1 className="focus-title">{existing ? 'Change review' : 'Set up a review'}</h1>
        <button className="iconbtn" onClick={() => { clearDraft(); nav(existing ? `/reviews/${existing.id}` : '/reviews'); }} aria-label="Close without saving"><Icon name="close" /></button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        {restored && <p className="hint">Picked up where you left off. Close to throw these changes away.</p>}
        <label className="field"><span className="field-label">Name</span>
          <input className={'input' + (tried && !r.name.trim() ? ' invalid' : '')} autoFocus={!existing} value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Platform monthly" />
        </label>
        <section className="stack" style={{ gap: 'var(--s3)' }} aria-labelledby="when-h">
          <h2 className="block-title" id="when-h">When</h2>
          <div className="stack" style={{ gap: 'var(--s3)' }}>
            <div className="field"><span className="field-label" id="every-l">How often</span>
              <div className="seg full" role="group" aria-labelledby="every-l">{WEEKS.map((n) => <button key={n} type="button" aria-pressed={r.everyWeeks === n} onClick={() => set({ everyWeeks: n })}>{n === 1 ? 'Every week' : `Every ${n} weeks`}</button>)}</div>
            </div>
            <label className="field" style={{ maxWidth: 260 }}><span className="field-label">On</span>
              <select className="input" value={r.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>{WEEKDAY.slice(0, 5).map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </label>
          </div>
        </section>
        <section className="stack" style={{ gap: 'var(--s3)' }} aria-labelledby="goals-h">
          <div className="stack" style={{ gap: 'var(--s1)' }}>
            <h2 className="block-title" id="goals-h">Which goals</h2>
            <span className="hint">{goalsN(covered.length)} so far. Mix levels, whole trees and single goals.</span>
          </div>
          <div className="field"><span className="field-label" id="lv-l">Every goal at a level</span>
            <div className="row" role="group" aria-labelledby="lv-l">{LEVELS.map((l) => <button key={l} type="button" className="pill" aria-pressed={r.scope.levels.includes(l)} onClick={() => set({ scope: { ...r.scope, levels: toggle(r.scope.levels, l) } })}>{r.scope.levels.includes(l) && <Icon name="check" />}{LEVEL_LABEL[l]}</button>)}</div>
          </div>
          {tops.length > 0 && (
            <div className="field"><span className="field-label" id="tr-l">A goal and everything feeding it</span>
              <div className="optlist" role="group" aria-labelledby="tr-l">
                {tops.map((g) => <button key={g.id} type="button" role="checkbox" className="opt" aria-checked={r.scope.trees.includes(g.id)} onClick={() => set({ scope: { ...r.scope, trees: toggle(r.scope.trees, g.id) } })}><Picked on={r.scope.trees.includes(g.id)}>{g.title}</Picked><span className="hint">{goalsN(goalsIn({ goals: [], trees: [g.id], levels: [] }, app.snapshot.goals).length)}</span></button>)}
              </div>
            </div>
          )}
          <div className="field"><span className="field-label">Single goals</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a goal by name" aria-label="Find a goal by name" />
            {found.length > 0 && <div className="optlist">{found.map((g) => <button key={g.id} type="button" role="checkbox" className="opt" aria-checked={r.scope.goals.includes(g.id)} onClick={() => set({ scope: { ...r.scope, goals: toggle(r.scope.goals, g.id) } })}><Picked on={r.scope.goals.includes(g.id)}>{g.title}</Picked><Chip k={app.statusOf(g).status} /></button>)}</div>}
            {r.scope.goals.length > 0 && <span className="hint">Picked: {r.scope.goals.map((id) => app.goal(id)?.title).filter(Boolean).join(', ')}</span>}
          </div>
        </section>
        <section className="stack" style={{ gap: 'var(--s3)' }} aria-labelledby="ppl-h">
          <h2 className="block-title" id="ppl-h">Who takes part</h2>
          {/* Found by name or team, as the goals are (re-review, 8 Nov, backlog T); whoever is picked stays listed. */}
          <input className="input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Find a person by name or team" aria-label="Find a person by name or team" />
          <span className="hint">{r.people.length === 1 ? '1 person' : `${r.people.length} people`} so far{r.people.length ? `: ${r.people.map((id) => app.person(id)?.name).filter(Boolean).join(', ')}` : ''}.</span>
          <div className="optlist" role="group" aria-labelledby="ppl-h">
            {app.snapshot.people.filter((p) => !who.trim() || r.people.includes(p.id) || `${p.name} ${app.team(p.teamId ?? '')?.name ?? ''}`.toLowerCase().includes(who.trim().toLowerCase())).map((p) => <button key={p.id} type="button" role="checkbox" className="opt" aria-checked={r.people.includes(p.id)} disabled={!!existing && p.id === existing.createdBy && r.people.includes(p.id) && app.viewer.id !== existing.createdBy && !app.viewer.admin} onClick={() => set({ people: toggle(r.people, p.id) })}><Picked on={r.people.includes(p.id)}><Avatar p={p} size="sm" />{p.name}</Picked><span className="hint">{app.team(p.teamId ?? '')?.name ?? ''}</span></button>)}
          </div>
        </section>
        <div className="focus-foot">
          {tried && !ok && <span className="hint tone-off" role="alert">{problem}</span>}
          <div className="foot-row"><button className="btn primary big-btn" type="submit" disabled={busy}>{existing ? 'Save changes' : 'Set up the review'}</button></div>
        </div>
      </form>
    </div>
  );
}

/** A choice in the set-up: a tick in a slot of its own when it's in, so the selection is a mark and a word, not a tint. */
function Picked({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className="picked"><span className="picked-mark">{on && <Icon name="check" />}</span>{children}</span>;
}
