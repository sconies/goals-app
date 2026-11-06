/* Goal reviews: the list, setting one up, and a review's session: its agenda, start or continue, and what was said.
   Once a session is held, its page leads with what was said. Walking the goals happens on the goal pages themselves
   (see Inspect). */
import { useMemo, useState } from 'react';
import { useDraft } from '../app/drafts';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { weekDates } from '../domain/plan';
import { WEEKDAY } from '../domain/progress';
import { answerOf, dayText, goalsIn, isHealthy, lastHeld, nextSessionWeek, openActions, reviewSession, sessionDate, sessionState, sessionStateText, type ReviewSession, type SessionState } from '../domain/review';
import { outcomeTrees } from '../domain/tree';
import type { Goal, Level, Review as ReviewT } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Chip, Empty, ProgressRing } from '../ui/bits';
import { saveReviewOrder } from './Inspect';
import { GoalRow } from '../ui/goalRows';
import { worstFirst } from '../domain/order';
import { Icon } from '../ui/Icon';
import { EndedReview, EndReview } from '../ui/RemoveControls';

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
  const facts: [string, string][] = st.kind === 'held'
    ? [['Next', dayText(sessionDate(s.review, app.cycle, nextSessionWeek(s.review, s.week)))], ['Open actions', String(actions)]]
    : [['Session', dayText(s.date)], ['Last held', last ? dayText(last.on) : 'Not yet'], ['Open actions', String(actions)]];
  return (
    <Link className="arow rv-line" to={`/reviews/${s.review.id}`}>
      <SessionStateWord st={st} />
      <span className="rv-name">{s.review.name}</span>
      <span className="rv-facts">{facts.map(([k, v]) => <span key={k} className="rv-fact"><span className="rv-fact-k">{k}</span> <span className="rv-fact-v">{v}</span></span>)}</span>
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
            <li key={d.id}><span className="strong">{d.note}</span><span className="hint">{app.person(d.assigneeId ?? app.goal(d.goalId)?.ownerId ?? '')?.name ?? 'Someone'} · {d.dueWeek ? `by week ${d.dueWeek}, ${weekDates(app.cycle, d.dueWeek)}` : 'no date'} · {goalLink(d.goalId)}</span>{d.ask && <span className={'small' + (d.ask.status === 'open' && d.ask.dueWeek != null && d.ask.dueWeek < app.week ? ' tone-risk' : '')}>{d.ask.status === 'done' ? <><strong>Done</strong>{d.ask.answer ? `: ${d.ask.answer}` : ''}</> : d.ask.dueWeek != null && d.ask.dueWeek < app.week ? 'Open, past its week' : 'Open'}</span>}</li>
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
  // An ended review keeps its page: what it was, that it ended, and (for its owner or an admin) Reopen.
  const ended = !review ? app.snapshot.archive?.reviews.find((r) => r.id === reviewId) : undefined;
  if (ended) return <EndedReview review={ended} />;
  if (!review) return <div className="page narrow"><Empty title="That review doesn’t exist"><Link className="btn" to="/reviews">All reviews</Link></Empty></div>;
  const s = reviewSession(review, app.snapshot, app.cycle, app.today, app.week);
  const st = sessionState(s);
  // The walk is the exceptions, one at a time; healthy goals are acknowledged together below, or walked if you choose.
  const exceptions = s.items.filter((a) => !isHealthy(a));
  const healthy = s.items.filter(isHealthy);
  const walk = walkAll || !exceptions.length ? s.items : exceptions;
  const first = walk.find((a) => !s.covered.has(a.goal.id));
  const start = () => {
    saveReviewOrder(app.ws.id, review.id, s.week, walk.map((a) => a.goal.id));
    if (first) nav(`/goals/${first.goal.id}?review=${review.id}`);
  };
  const healthyLeft = healthy.filter((a) => !s.covered.has(a.goal.id));
  const ackHealthy = async () => {
    setBusy(true);
    // Marking these finishes the session when they're all that's left: then this page leads with what was said.
    try {
      for (const a of healthyLeft) await app.reviewCall(a.goal, review, s.week, 'acknowledge', '');
      app.toast(`${goalsN(healthyLeft.length)} on track marked reviewed`);
    } catch { /* the save already said what went wrong */ }
    setBusy(false);
  };
  const done = st.kind === 'held';
  const people = review.people.map((id) => app.person(id)).filter((p) => !!p);
  const inIt = review.people.includes(app.viewer.id);
  const canChange = inIt || app.viewer.admin;
  const join = async () => {
    try { await app.saveReview({ ...review, people: [...review.people, app.viewer.id] }, review); app.toast(`You’re in ${review.name}`); } catch { /* the save already said what went wrong */ }
  };
  const remaining = walk.filter((a) => !s.covered.has(a.goal.id));
  const reviewedItems = s.items.filter((a) => s.covered.has(a.goal.id));
  // One terse line under the name: the date and what's on, or where it got to.
  const line = done
    ? `${sessionStateText(st)} · next ${dayText(sessionDate(review, app.cycle, nextSessionWeek(review, s.week)))}`
    : st.kind === 'in-progress'
      ? `${dayText(s.date)} · ${s.done} of ${s.total} reviewed`
      : [dayText(s.date), exceptions.length ? `${exceptions.length} to discuss` : '', healthy.length ? `${healthy.length} on track` : ''].filter(Boolean).join(' · ');

  return (
    <div className="page narrow review-home" data-part="Review">
      <nav aria-label="Breadcrumb" className="crumbs"><Link to="/reviews">Reviews</Link></nav>
      <section className="hero">
        <ProgressRing done={s.done} total={Math.max(1, s.total)} size={56} label={`${s.done} of ${s.total} goals reviewed`} />
        <div className="hero-body">
          <span className="eyebrow">{cadence(review)}</span>
          <h1 className="title-xl">{review.name}</h1>
          <span className="muted review-line">{line}</span>
          <div className="actions" style={{ marginTop: 'var(--s2)' }}>
            {inIt && !done && first && <button className="btn primary big-btn" onClick={start}>{s.done ? `Continue review · ${goalsN(remaining.length)} left` : `Start review · ${goalsN(walk.length)}`}</button>}
            {inIt && !done && !first && healthyLeft.length > 0 && <button className="btn primary big-btn" disabled={busy} onClick={() => void ackHealthy()}>Mark {goalsN(healthyLeft.length)} on track reviewed</button>}
            {!inIt && <button className="btn primary big-btn" onClick={() => void join()}>Join this review</button>}
            {canChange && <Link className="btn" to={`/reviews/${review.id}/edit`}>Edit review setup</Link>}
            <Link className="btn ghost print-link" to={`/reviews/${review.id}/print`}><Icon name="print" /><span className="print-link-label">Print or save as PDF</span></Link>
          </div>
        </div>
      </section>
      {/* Held: what was said comes first, with every goal reviewed. */}
      {done && <SessionRecord s={s} title="What was said" reviewed="open" />}
      {!done && remaining.length > 0 && (
        <section className="block" data-part="Still to review">
          <h2 className="block-title">Still to review · {remaining.length}</h2>
          <Agenda goals={remaining.map((a) => a.goal)} />
        </section>
      )}
      {!done && !walkAll && exceptions.length > 0 && healthyLeft.length > 0 && (
        <section className="block healthy-group" data-part="On track, nothing new">
          <div className="healthy-head">
            <h2 className="block-title">On track, nothing new · {healthyLeft.length}</h2>
            {inIt && first && <button className="btn" disabled={busy} onClick={() => void ackHealthy()}>Mark {goalsN(healthyLeft.length)} reviewed</button>}
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
          <div className="optlist" role="group" aria-labelledby="ppl-h">
            {app.snapshot.people.map((p) => <button key={p.id} type="button" role="checkbox" className="opt" aria-checked={r.people.includes(p.id)} disabled={!!existing && p.id === existing.createdBy && r.people.includes(p.id) && app.viewer.id !== existing.createdBy && !app.viewer.admin} onClick={() => set({ people: toggle(r.people, p.id) })}><Picked on={r.people.includes(p.id)}><Avatar p={p} size="sm" />{p.name}</Picked><span className="hint">{app.team(p.teamId ?? '')?.name ?? ''}</span></button>)}
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
