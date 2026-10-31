import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { DECISION_LABEL, reviewQueue } from '../domain/review';
import { Empty } from '../ui/bits';
import { saveReviewOrder } from './Inspect';

/**
 * The sponsor's weekly review: the goals that need a call, worst first, inspected one at a time on
 * their own pages. This page starts it (fixing the order) and sums it up when nothing is left.
 */
export function Review() {
  const app = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const q = reviewQueue(app.snapshot, app.cycle, app.today, app.week);
  const open = q.items.filter((a) => !q.handled.has(a.goal.id));

  if (app.viewer.profile !== 'sponsor') {
    return (
      <div className="page narrow">
        <Empty title="The weekly review is the sponsor’s">
          <span className="muted">Switch to the sponsor’s profile to run it, or see every goal and its status on the Goals page.</span>
          <div className="row"><Link className="btn primary" to="/goals">See all goals</Link></div>
        </Empty>
      </div>
    );
  }
  if (open.length && !params.get('from')) {
    saveReviewOrder(app.ws.id, app.week, q.items.map((a) => a.goal.id));
    return <Navigate to={`/goals/${open[0]!.goal.id}?review=1`} replace />;
  }
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Weekly review</span>
        <button className="iconbtn" onClick={() => nav('/')} aria-label="Close the review">✕</button>
      </div>
      {open.length ? (
        <div className="celebrate" role="status">
          <h1 className="title-xl">{open.length} still open</h1>
          <p className="muted">You skipped {open.length === 1 ? 'one goal' : `${open.length} goals`}. Each needs a call before the review is done.</p>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary big-btn" to={`/goals/${open[0]!.goal.id}?review=1`}>Back to {open[0]!.goal.title}</Link></div>
        </div>
      ) : <ReviewDone />}
    </div>
  );
}

function ReviewDone() {
  const app = useApp();
  const mine = app.snapshot.decisions.filter((d) => d.week === app.week && d.byId === app.viewer.id);
  const onTrack = app.snapshot.goals.filter((g) => ['on', 'done'].includes(app.statusOf(g).status)).length;
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="celebrate" role="status">
      <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
      <h1 className="title-xl">Review done for week {app.week}</h1>
      <p className="muted">{mine.length ? `${mine.length} ${mine.length === 1 ? 'call' : 'calls'} recorded. Owners see them on their goals.` : 'Nothing needed a call.'} {onTrack} of {app.snapshot.goals.length} goals are on track.</p>
      {mine.length > 0 && (
        <ul className="summary-list">
          {mine.map((d) => <li key={d.id}><span className="strong">{app.goal(d.goalId)?.title}</span><span className="small muted">{DECISION_LABEL[d.kind]}{d.note ? `: “${d.note}”` : ''}</span></li>)}
        </ul>
      )}
      <div className="row" style={{ justifyContent: 'center' }}><Link ref={ref} className="btn primary big-btn" to="/">Back to home</Link><Link className="btn" to="/goals">See all goals</Link></div>
    </div>
  );
}

