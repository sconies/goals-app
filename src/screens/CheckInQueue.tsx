/* Check-in: the queue (docs/design/navigation/spec.md, 2.4; NV3). Check-in opens on the week's list, not straight into
   the first form: what's due, in the order the walk takes them, each with what it last said; what's done; and the table.
   "Start with …" walks them all as before (/check-in?start=1, which Home's Start check-in also opens); any row opens
   that goal's form on its own. Not focus mode: the sidebar stays. */
import { GoalRow } from '../ui/goalRows';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { daysToReview, firstDueWeek, reviewDate, WEEKDAY, weekProgress } from '../domain/progress';
import { checkInList, type CheckInRow } from '../domain/rhythm';
import { rhythmOf } from '../domain/thresholds';
import { weekDates } from '../domain/plan';
import { summarise } from '../domain/summary';
import type { Goal } from '../domain/types';
import { StatusWord } from '../ui/bits';
import { STATUS } from '../domain/vocabulary';
import { PageHeader } from '../ui/PageHeader';

/** Where a form opened from here goes back to when it's closed: the queue, not Home. */
export const FROM_QUEUE = { from: 'queue' } as const;

export function CheckInQueue() {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const owns = app.snapshot.goals.some((g) => g.ownerId === app.viewer.id && !g.stoppedAt);
  const days = daysToReview(app.cycle, app.week, app.today);
  const day = WEEKDAY[app.cycle.reviewDay] ?? '';
  const head = (
    <PageHeader className="ciq-head" title="Check-in" line={app.week >= 1 && app.week <= app.cycle.weeks ? (
        <p className="hint ciq-when">Week {app.week}, {weekDates(app.cycle, app.week)}. {days < 0 ? `Check-ins were due by ${day}.` : `Check-ins are due by ${day}${days === 1 ? ', tomorrow' : days === 0 ? ', today' : ''}.`}</p>
      ) : null} />
  );
  // Nothing of yours to check in on (an address typed by hand: the menu has no Check-in for someone who owns no goal).
  if (!owns) return (
    <div className="page checkin-queue" data-part="Check-in">
      {head}
      <p className="ciq-empty">You don’t own a goal in {app.ws.name}, so there’s nothing to check in.</p>
      <p className="row ciq-links"><Link className="linkish" to="/goals?scope=watching">See the goals you watch</Link><Link className="linkish" to="/goals/new">Set up a goal</Link></p>
    </div>
  );
  if (app.week > app.cycle.weeks) return (
    <div className="page checkin-queue" data-part="Check-in">
      {head}
      <p className="ciq-empty">{app.cycle.name} has ended. Check-ins start again with the next cycle.</p>
    </div>
  );
  if (!rhythmOf(app.cycle)) return <NoRhythmList />;
  const first = p.due[0];
  const upcoming = !p.due.length && !p.done.length && p.upcoming.length > 0;
  // The first check-ins' deadline, on day one: the review day of the earliest week any of them is due.
  const firstDue = upcoming ? (() => {
    const w = Math.max(1, Math.min(...p.upcoming.map((g) => firstDueWeek(g, app.cycle))));
    const d = new Date(reviewDate(app.cycle, w) + 'T00:00:00Z');
    return `${WEEKDAY[(d.getUTCDay() + 6) % 7]} ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
  })() : '';
  return (
    <div className="page checkin-queue" data-part="Check-in">
      {head}
      {first && (
        <p className="row ciq-start">
          <Link className="btn primary big-btn" to="/check-in?start=1" state={FROM_QUEUE}>{p.due.length === 1 ? `Check in on ${first.title}` : `Start with ${first.title}`}</Link>
        </p>
      )}
      {/* The table, offered near the top as well as under the list, as a quiet link: one by one stays the one primary
          action (K8: the table was slower for goals that are behind). With seven goals the link under the list was below
          the fold even on a 390×844 phone (usability study F02; Lane, 17 Nov). */}
      {first && p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <p className="small ciq-table-top"><Link className="linkish" to="/quick-check-in">Or type all your numbers in one table</Link></p>}
      {!first && (upcoming
        ? <p className="ciq-empty">Nothing to check in yet. The first check-ins are due by {firstDue}.</p>
        : <p className="ciq-empty">You’re all set for week {app.week}.</p>)}
      {p.due.length > 0 && (
        <section className="block ciq-block" aria-label="To do this week" data-part="To do this week">
          <h2 className="block-title">To do this week <span className="hint">· {p.due.length}</span></h2>
          <ul className="ciq-list">
            {/* The shared row (GOAL-ROW): status, last week's number and gap, the name, what last week's check-in said, and
                the one button. A draft kept says so and the button carries on. */}
            {p.due.map((g) => {
              const kept = hasDraft(checkInDraftKey(app.ws.id, g.id, app.week));
              return <li key={g.id} className="ciq-row"><GoalRow g={g} place="checkin-queue" queue={{ draft: kept }} to={`/check-in/${g.id}`} linkState={FROM_QUEUE} /></li>;
            })}
          </ul>
        </section>
      )}
      {p.done.length > 0 && (
        <section className="block ciq-block" aria-label="Done this week" data-part="Done this week">
          <h2 className="block-title">Done this week <span className="hint">· {p.done.length}</span></h2>
          <ul className="ciq-list">
            {p.done.map((g) => {
              const c = [...app.checkInsOf(g)].reverse().find((x) => x.week === app.week);
              const on = c ? WEEKDAY[(new Date(c.postedAt).getUTCDay() + 6) % 7] : '';
              return <li key={g.id} className="ciq-row"><GoalRow g={g} place="checkin-queue" queue={{ done: true, postedDay: on }} to={`/check-in/${g.id}?correct=1`} linkState={FROM_QUEUE} /></li>;
            })}
          </ul>
        </section>
      )}
      {p.due.some((g) => g.kind !== 'milestone') && <p className="ciq-table"><Link className="linkish" to="/quick-check-in">Or type all your numbers in one table</Link></p>}
    </div>
  );
}

/**
 * Check-in with no set rhythm (FT1, spec 4.6): "Check in on a goal", the person's live goals in two groups from
 * checkInList, those with no check-in this week first. Nothing is due, so there is no primary button, no count of what's
 * left and no streak: each row has its own button.
 */
function NoRhythmList() {
  const app = useApp();
  const goals = app.snapshot.goals;
  const l = checkInList(app.viewer.id, goals, app.snapshot.checkIns, app.week);
  const goal = (r: CheckInRow) => goals.find((g) => g.id === r.goalId)!;
  const sum = (g: Goal) => summarise(g, app.snapshot, app.cycle, app.today, app.week);
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const row = (r: CheckInRow, now: boolean) => {
    const g = goal(r);
    const s = sum(g);
    const said = now ? `Checked in ${day(r.lastPostedAt!)} · ${s.now}` : r.lastWeek == null ? STATUS.none.label : `Last check-in week ${r.lastWeek} · ${s.now}`;
    const label = now ? 'Check in again' : r.lastWeek == null ? 'Post the first check-in' : 'Check in';
    return (
      <li key={g.id} className="ciq-row">
        <StatusWord k={s.status} className="ciq-status" />
        <span className="ciq-text">
          <span className="ciq-title">{g.title}</span>
          <span className="hint ciq-said">{said}</span>
        </span>
        <Link className="btn ciq-go" to={`/check-in/${g.id}`} state={FROM_QUEUE} aria-label={`${label}: ${g.title}`}>{label}</Link>
      </li>
    );
  };
  const live = [...l.waiting, ...l.thisWeek];
  return (
    <div className="page checkin-queue" data-part="Check-in">
      <PageHeader className="ciq-head" title="Check in on a goal" line={<p className="hint ciq-when">Week {app.week}. Check in when there’s news; nothing is due.</p>} />
      {!live.length && <p className="ciq-empty">You don’t own any goals this year.</p>}
      {l.waiting.length > 0 && (
        <section className="block ciq-block" aria-label="No check-in this week" data-part="No check-in this week">
          <h2 className="block-title">No check-in this week <span className="hint">· {l.waiting.length}</span></h2>
          <ul className="ciq-list">{l.waiting.map((r) => row(r, false))}</ul>
        </section>
      )}
      {l.thisWeek.length > 0 && (
        <section className="block ciq-block" aria-label="Checked in this week" data-part="Checked in this week">
          <h2 className="block-title">Checked in this week <span className="hint">· {l.thisWeek.length}</span></h2>
          <ul className="ciq-list">{l.thisWeek.map((r) => row(r, true))}</ul>
        </section>
      )}
      {live.filter((r) => goal(r).kind !== 'milestone').length >= 2 && <p className="ciq-table"><Link className="linkish" to="/quick-check-in">Or type all your numbers in one table</Link></p>}
    </div>
  );
}
