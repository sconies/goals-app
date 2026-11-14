/* "Before this review" and "The last 8 weeks" (habit spec 2.3; HB2): how many of a set's goals were checked in before
   the review, how many without being asked, and one row of weeks. On a review's page for its goals, and on a team's
   page for the team's. Weeks, not people: nothing here names anyone (rule 4), and a set with fewer than three owners
   draws nothing. Loaded with Reviews' and People's chunks, never Home's. */
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { beforeReview, weekWords, type HabitWeek } from '../domain/habit';
import type { Goal } from '../domain/types';

/** A square mark for a week (never a circle: a circle is a goal's status). */
function WeekMark({ mark }: { mark: HabitWeek['mark'] }) {
  if (mark === 'nothing-due') return <span className="habit-mark is-empty" aria-hidden="true" />;
  return (
    <svg className={'habit-mark is-' + mark} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="1.5" className="habit-sq" />
      {mark === 'all' && <rect x="1" y="1" width="10" height="10" rx="1.5" className="habit-fill" />}
      {mark === 'some' && <path d="M1 11V2.5A1.5 1.5 0 0 1 2.5 1H6v10z" className="habit-fill" />}
    </svg>
  );
}

/**
 * The panel and the row for `goals` in `week`. `link` is the Goals parameter that names the set (`inreview=…` or
 * `team=…`), so each count opens exactly its goals. `heading` is the panel's label. `held`: the deadline is a review
 * (app/reads heldForGoals; a review's own page leaves it true), so the words name one only then (RS1).
 */
export function BeforeReview({ goals, week, link, heading, held = true }: { goals: Goal[]; week: number; link: string; heading: string; held?: boolean }) {
  const app = useApp();
  const b = beforeReview(goals, week, { checkIns: app.snapshot.checkIns, asks: app.snapshot.requests ?? [] }, app.cycle, app.today, app.viewer.id, held);
  if (!b) return null;
  const h = b.counts, row = b.weeks;
  const to = (v: string) => `/goals?${link}&checkedin=${v}&sort=worst`;
  return (
    <section className="block habit" data-part={heading} aria-labelledby="habit-head">
      <span className="field-label" id="habit-head">{heading}</span>
      <p className="habit-sum">{b.says}</p>
      {/* Goals' checkedin= reads this week, so the links are offered only for it (a past session's counts stand alone). */}
      {week === app.week && (h.asked > 0 || h.none > 0) && (
        <p className="small habit-links">
          {h.asked > 0 && <Link className="linkish" data-n={h.asked} to={to('asked')}>{h.asked} came in after an ask</Link>}
          {h.asked > 0 && h.none > 0 && <span className="muted" aria-hidden="true"> · </span>}
          {h.none > 0 && <Link className="linkish" data-n={h.none} to={to('no')}>{h.none} {h.none === 1 ? 'has' : 'have'} no check-in for week {week} yet</Link>}
        </p>
      )}
      {row.length > 0 && (
        <>
          <h3 className="field-label habit-row-head">The last {row.length} weeks</h3>
          <ol className="habit-weeks">
            {row.map((x) => (
              <li key={x.week} className="habit-week">
                <span className="tiny muted">Week {x.week}</span>
                <span className="habit-cell"><WeekMark mark={x.mark} /><span className="small">{weekWords(x)}</span></span>
              </li>
            ))}
          </ol>
          <p className="tiny muted">“All in” means every goal due that week was checked in {b.words.review ? b.words.onTime : `by its ${b.words.day}`}. Weeks, not people: nobody is named here.</p>
        </>
      )}
    </section>
  );
}
