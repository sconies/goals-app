/* Goal reviews: the list, setting one up, and a review's session (start or continue, progress, what was said).
   Walking the goals happens on the goal pages themselves (see Inspect). */
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { WEEKDAY } from '../domain/progress';
import { answerOf, goalsIn, reviewSession, type ReviewSession } from '../domain/review';
import { outcomeTrees } from '../domain/tree';
import type { Level, Review as ReviewT } from '../domain/types';
import { newId } from '../data/store';
import { Avatar, Chip, Empty, ProgressRing } from '../ui/bits';
import { saveReviewOrder, TreeRow, worstFirst } from './Inspect';

const dateText = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const cadence = (r: ReviewT) => `${r.everyWeeks === 1 ? 'Every week' : `Every ${r.everyWeeks} weeks`}, ${WEEKDAY[r.weekday]}s`;
const goalsN = (n: number) => `${n} ${n === 1 ? 'goal' : 'goals'}`;

/** The old single review now lives on the reviews page. */
export function ReviewRedirect() {
  return <Navigate to="/reviews" replace />;
}

export function Reviews() {
  const app = useApp();
  const sessions = app.snapshot.reviews.map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week));
  const mine = sessions.filter((s) => s.review.people.includes(app.viewer.id));
  const others = sessions.filter((s) => !s.review.people.includes(app.viewer.id));
  return (
    <div className="page narrow">
      <div className="page-head row between">
        <span className="stack" style={{ gap: 2 }}>
          <h1 className="title-xl">Reviews</h1>
          <span className="hint">Walk a set of goals together on a cadence. Anyone can set one up.</span>
        </span>
        <Link className="btn" to="/reviews/new">Set up a review</Link>
      </div>
      {!sessions.length && <Empty title="No reviews yet"><span className="muted">A review walks a set of goals, worst and stalest first, and keeps what was said.</span><Link className="btn primary" to="/reviews/new">Set up the first review</Link></Empty>}
      {mine.length > 0 && <section className="block"><h2 className="block-title">You’re in</h2><div className="alist">{mine.map((s) => <ReviewLine key={s.review.id} s={s} />)}</div></section>}
      {others.length > 0 && <section className="block"><h2 className="block-title">Other reviews</h2><div className="alist">{others.map((s) => <ReviewLine key={s.review.id} s={s} />)}</div></section>}
    </div>
  );
}

function ReviewLine({ s }: { s: ReviewSession }) {
  const app = useApp();
  const thisWeek = s.week === Math.max(1, app.week);
  return (
    <Link className="arow" to={`/reviews/${s.review.id}`} data-tone={thisWeek && s.done < s.total ? 'info' : undefined}>
      <span className="arow-main">
        <span className="arow-title">{s.review.name}</span>
        <span className="arow-why">{cadence(s.review)}. {goalsN(s.total)}, {s.review.people.length} {s.review.people.length === 1 ? 'person' : 'people'}.</span>
        <span className="arow-why">{thisWeek ? (s.done >= s.total ? `Done this week (${dateText(s.date)})` : `This week, ${dateText(s.date)}: ${s.done} of ${s.total} covered`) : `Next on ${dateText(s.date)}`}</span>
      </span>
    </Link>
  );
}

/** A review: this session's progress, start or continue, the goals in order, and what was said. */
export function ReviewHome() {
  const app = useApp();
  const nav = useNavigate();
  const { reviewId } = useParams();
  const review = app.snapshot.reviews.find((r) => r.id === reviewId);
  if (!review) return <div className="page narrow"><Empty title="That review doesn’t exist"><Link className="btn" to="/reviews">All reviews</Link></Empty></div>;
  const s = reviewSession(review, app.snapshot, app.cycle, app.today, app.week);
  const thisWeek = s.week === Math.max(1, app.week);
  const first = s.items.find((a) => !s.covered.has(a.goal.id));
  const start = () => {
    saveReviewOrder(app.ws.id, review.id, s.week, s.items.map((a) => a.goal.id));
    if (first) nav(`/goals/${first.goal.id}?review=${review.id}`);
  };
  const done = s.total > 0 && s.done >= s.total;
  const people = review.people.map((id) => app.person(id)).filter((p) => !!p);
  const inIt = review.people.includes(app.viewer.id);
  const canChange = inIt || app.viewer.admin;
  const join = async () => { await app.saveReview({ ...review, people: [...review.people, app.viewer.id] }, review); app.toast(`You’re in ${review.name}`); };
  const asks = s.said.filter((d) => d.kind === 'ask');
  const actions = s.said.filter((d) => d.kind === 'action');
  const notes = s.said.filter((d) => d.kind === 'note');
  const seen = s.said.filter((d) => d.kind === 'acknowledge');
  return (
    <div className="page narrow">
      <nav aria-label="Breadcrumb" className="crumbs"><Link to="/reviews">Reviews</Link></nav>
      <section className="hero">
        <ProgressRing done={s.done} total={Math.max(1, s.total)} size={56} label={`${s.done} of ${s.total} goals covered`} />
        <div className="hero-body">
          <span className="eyebrow">{cadence(review)}</span>
          <h1 className="hero-title">{review.name}</h1>
          <span className="muted">{done ? `Done for ${dateText(s.date)}: ${goalsN(s.done)} covered${asks.length ? `, ${asks.length} ${asks.length === 1 ? 'question' : 'questions'}` : ''}${actions.length ? `, ${actions.length} ${actions.length === 1 ? 'action' : 'actions'}` : ''}.` : `${thisWeek ? 'This week' : 'Next'}: ${dateText(s.date)}. ${goalsN(s.total)}, worst and stalest first.${thisWeek ? '' : ' You can start early; it counts for that session.'}`}</span>
          <div className="actions" style={{ marginTop: 'var(--s2)' }}>
            {inIt && !done && first && <button className="btn primary big-btn" onClick={start}>{s.done ? 'Continue the review' : 'Start the review'}</button>}
            {!inIt && <button className="btn primary big-btn" onClick={() => void join()}>Join this review</button>}
            {canChange && <Link className="btn" to={`/reviews/${review.id}/edit`}>Change it</Link>}
          </div>
        </div>
      </section>
      {s.said.length > 0 && (
        <section className="block">
          <h2 className="block-title">What was said</h2>
          {[['Questions for owners', asks], ['Actions', actions], ['Notes', notes]].map(([title, list]) => (list as typeof asks).length > 0 && (
            <div key={title as string} className="stack" style={{ gap: 'var(--s1)' }}>
              <span className="field-label">{title as string}</span>
              <ul className="changes">
                {(list as typeof asks).map((d) => {
                  const ans = d.kind === 'ask' ? answerOf(d, app.snapshot) : null;
                  const g = app.goal(d.goalId);
                  return (
                    <li key={d.id} className="change">
                      <Avatar p={app.person(d.byId) ?? { name: '?', initials: '?' }} size="sm" />
                      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <span className="small"><Link className="linkish" to={`/goals/${d.goalId}`}>{g?.title}</Link>{d.kind === 'ask' && g ? <span className="muted"> · for {app.person(g.ownerId)?.name.split(' ')[0]}</span> : null}</span>
                        {d.note && <span className="note-text">{d.note}</span>}
                        {d.kind === 'ask' && (ans ? <span className="small"><strong>{app.person(ans.byId)?.name.split(' ')[0]} answered:</strong> {ans.text}</span> : <span className="hint">Not answered yet</span>)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {seen.length > 0 && <p className="hint">Seen with nothing to add: {seen.map((d) => app.goal(d.goalId)?.title).filter(Boolean).join(', ')}.</p>}
        </section>
      )}
      <section className="block">
        <h2 className="block-title">Goals in this review</h2>
        {s.items.length ? (
          <ul className="tree">{s.items.map((a) => <li key={a.goal.id} className={s.covered.has(a.goal.id) ? 'covered' : ''}><TreeRow g={a.goal} /></li>)}</ul>
        ) : <p className="hint">No goals match this review yet. <Link className="linkish" to={`/reviews/${review.id}/edit`}>Pick some</Link></p>}
      </section>
      <section className="block">
        <h2 className="block-title">People</h2>
        <div className="people">{people.map((p) => <span key={p.id} className="person"><Avatar p={p} size="sm" />{p.name}</span>)}</div>
      </section>
    </div>
  );
}

const WEEKS = [1, 2, 4] as const;
const LEVELS: Level[] = ['north-star', 'svp', 'team'];

/** Set up or change a review, on one screen: name, when, which goals, who. */
export function ReviewEdit() {
  const app = useApp();
  const nav = useNavigate();
  const { reviewId } = useParams();
  const existing = reviewId ? app.snapshot.reviews.find((r) => r.id === reviewId) ?? null : null;
  const [r, setR] = useState<ReviewT>(() => existing ?? { id: newId('rev'), name: '', everyWeeks: 1, weekday: app.cycle.reviewDay, scope: { goals: [], trees: [], levels: [] }, people: [app.viewer.id], createdBy: app.viewer.id, createdAt: app.stamp() });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const set = (p: Partial<ReviewT>) => setR((x) => ({ ...x, ...p }));
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
      app.toast(existing ? 'Review saved' : `Set up ${r.name.trim()}`);
      nav(`/reviews/${r.id}`);
    } catch { setBusy(false); }
  };
  const problem = !r.name.trim() ? 'Give the review a name.' : !covered.length ? 'Pick at least one goal, tree or level.' : 'Add at least one person.';
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">{existing ? 'Change review' : 'Set up a review'}</span>
        <span />
        <button className="iconbtn" onClick={() => nav(existing ? `/reviews/${existing.id}` : '/reviews')} aria-label="Close without saving">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
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
            <div className="row" role="group" aria-labelledby="lv-l">{LEVELS.map((l) => <button key={l} type="button" className="pill" aria-pressed={r.scope.levels.includes(l)} onClick={() => set({ scope: { ...r.scope, levels: toggle(r.scope.levels, l) } })}>{LEVEL_LABEL[l]}</button>)}</div>
          </div>
          {tops.length > 0 && (
            <div className="field"><span className="field-label" id="tr-l">A goal and everything feeding it</span>
              <div className="optlist" role="group" aria-labelledby="tr-l">
                {tops.map((g) => <button key={g.id} type="button" role="checkbox" className="opt" aria-checked={r.scope.trees.includes(g.id)} onClick={() => set({ scope: { ...r.scope, trees: toggle(r.scope.trees, g.id) } })}><span>{g.title}</span><span className="hint">{goalsN(goalsIn({ goals: [], trees: [g.id], levels: [] }, app.snapshot.goals).length)}</span></button>)}
              </div>
            </div>
          )}
          <div className="field"><span className="field-label">Single goals</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a goal by name" aria-label="Find a goal by name" />
            {found.length > 0 && <div className="optlist">{found.map((g) => <button key={g.id} type="button" role="checkbox" className="opt" aria-checked={r.scope.goals.includes(g.id)} onClick={() => set({ scope: { ...r.scope, goals: toggle(r.scope.goals, g.id) } })}><span>{g.title}</span><Chip k={app.statusOf(g).status} /></button>)}</div>}
            {r.scope.goals.length > 0 && <span className="hint">Picked: {r.scope.goals.map((id) => app.goal(id)?.title).filter(Boolean).join(', ')}</span>}
          </div>
        </section>
        <section className="stack" style={{ gap: 'var(--s3)' }} aria-labelledby="ppl-h">
          <h2 className="block-title" id="ppl-h">Who takes part</h2>
          <div className="optlist" role="group" aria-labelledby="ppl-h">
            {app.snapshot.people.map((p) => <button key={p.id} type="button" role="checkbox" className="opt" aria-checked={r.people.includes(p.id)} disabled={!!existing && p.id === existing.createdBy && r.people.includes(p.id) && app.viewer.id !== existing.createdBy && !app.viewer.admin} onClick={() => set({ people: toggle(r.people, p.id) })}><span className="row" style={{ gap: 'var(--s2)' }}><Avatar p={p} size="sm" />{p.name}</span><span className="hint">{app.team(p.teamId ?? '')?.name ?? ''}</span></button>)}
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
