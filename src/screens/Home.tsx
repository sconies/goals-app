import { Place } from '../core/app';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { usePrefs } from '../app/search';
import { gettingStarted, type DayOneFacts } from '../domain/dayOne';
import { workspaceName } from '../domain/workspaceAttention';
import { dayOneRows } from '../app/reads';
import { useApp, type AppState } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { attentionList, attentionOrder, splitAttention } from '../domain/attention';
import { dashboard, groupWatched, type Dashboard } from '../domain/home';
import { daysToReview, onTimeStreak, reviewDate, weekCompletion, weekProgress, WEEKDAY } from '../domain/progress';
import { agendaOf, dayText, daysPast, nextSessionWeek, pastText, reviewedLabel, reviewSession, sessionDate, sessionToDo, sessionPlan, upcomingSessionWeek, walkOrder, watchedGoals } from '../domain/review';
import { hasEnded, weekDates } from '../domain/plan';
import { beforeStartLine, cycleDates, cycleState, dayWithYear, laterCycle, nextCycleShape, placeLine, wrapUpOpenOn } from '../domain/cycle';
import { isOverdue, openForPerson } from '../domain/asks';
import { periodWord } from '../domain/year';
import { ATTENTION, LABEL } from '../domain/vocabulary';
import { statusChange } from '../domain/tree';
import type { AskKind, Review } from '../domain/types';
import { AttentionCard, Avatar, ProgressRing, StatusShape, timeAgo, WarnMark } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { saveReviewOrder } from './Inspect';
import { GoalRow } from '../ui/goalRows';
import { HandledGroup } from '../ui/HandledGroup';
import { FirstReports } from '../ui/FirstReports';
import { HomeNews } from '../ui/HelpLinks';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * When this week's check-ins are due: the workspace's deadline, its review day. Said as a deadline, never as "the review"
 * (deep review T4, 10 Nov): the person may be in a review on another day, or in none. A review is named only where it
 * is one they're in (the strip's Next review, a review's own agenda).
 */
function dueWhen(app: AppState, late = false) {
  const days = daysToReview(app.cycle, app.week, app.today);
  const day = WEEKDAY[app.cycle.reviewDay];
  if (late && days < 0) return <span className="tone-off">Check-ins were due {day} · {-days === 1 ? '1 day' : -days + ' days'} late</span>;
  return days > 1 ? `Check-ins are due by ${day}, in ${days} days` : days === 1 ? `Check-ins are due by ${day}, tomorrow` : days === 0 ? `Check-ins are due today, ${day}` : `This week’s check-ins were due ${day}`;
}

/**
 * What the on-time streak counts, said where it reads 0 (setup review, 8 Nov): weeks with every check-in in before the
 * review, counted once a review day has passed. A check-in posted after this week's review, or before any check-in is
 * due, explains why it is still 0.
 */
function streakNote(app: AppState): string {
  if (onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week)) return 'All in on time';
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const day = WEEKDAY[app.cycle.reviewDay];
  if (hasEnded(app.cycle, app.today)) return `${app.cycle.name} has ended: nothing more is due`;
  if (p.upcoming.length && !p.due.length) return `Starts with your first check-ins, due by ${day}`;
  if (p.goals.length && !p.due.length && daysToReview(app.cycle, app.week, app.today) < 0) return `This week’s came after ${day}’s deadline: it starts again next week`;
  return `Weeks with every check-in in by ${day}`;
}

function Streak({ weeks }: { weeks: number }) {
  if (weeks < 2) return null;
  return <span className="streak" title="Weeks in a row with every check-in in on time"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8.5 1.5c.4 2.2-1.6 3.4-2.6 5C5 8 5.3 10 6.6 10.6 5.8 8.7 7.6 7.8 8 6.5c1.4 1.4 2.9 3 2.4 5.2-.3 1.6-1.7 2.8-3.4 2.8A4.4 4.4 0 0 1 2.6 10c0-3.6 3.7-5.2 5.9-8.5z" fill="currentColor" /></svg>{weeks}-week on-time streak</span>;
}

/**
 * The week's one main action comes first. What's addressed to you (`side`) follows it on a narrow screen and sits beside
 * it on a wide one; then your goals and what changed (`after`).
 */
function MyWeek({ side, after, news }: { side?: ReactNode; after?: ReactNode; news?: ReactNode }) {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const streak = onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const att = attentionList(app.snapshot, app.cycle, app.today, { goals: mine });
  // Needs attention is new information; a goal someone has looked at since its latest check-in is being handled.
  const { needs, handled } = splitAttention(att);
  const rest = mine.filter((g) => !att.some((a) => a.goal.id === g.id));
  const wrapLeft = wrapUpOpenOn(app.cycle, app.today) ? mine.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)) : [];
  const myReview = app.snapshot.reviews.filter((r) => r.people.includes(app.viewer.id)).map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week)).find((s) => sessionToDo(s, app.snapshot, app.week, app.today));
  const resuming = p.due.some((g) => hasDraft(checkInDraftKey(app.ws.id, g.id, app.week)));
  const minutes = Math.max(1, Math.round(p.due.length * 0.75));
  // The same reading as the check-in's confirmation (domain/progress weekCompletion).
  const allIn = weekCompletion(p).complete;
  return (
    <>
      <section className="hero home-hero split-a" data-part="This week’s main action">
        {p.goals.length > 0 && !(myReview && (allIn || !p.done.length) && !p.due.length && !wrapLeft.length) && !(p.upcoming.length && !p.due.length && !p.done.length)
          ? <ProgressRing done={p.done.length} total={p.goals.length} size={64} counts="check-ins" label={`${p.done.length} of ${p.goals.length} check-ins done this week`} />
          : myReview ? <ProgressRing done={myReview.done} total={myReview.total} size={64} counts="reviewed" label={reviewedLabel(myReview, myReview.review.name)} /> : null}
        <div className="hero-body">
          {p.due.length ? (
            <>
              <span className="eyebrow">{dueWhen(app, true)}</span>
              <h2 className="hero-title">{p.due.length === 1 ? '1 check-in to do' : `${p.due.length} check-ins to do`}</h2>
              <span className="muted">About {minutes} min · {p.due.map((g) => g.title).join(', ')}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <Link className="btn primary big-btn" to="/check-in?start=1">{resuming ? 'Pick up where you left off' : 'Start check-in'}</Link>
              </div>
              {p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <Link className="linkish small" to="/quick-check-in">Or type all your numbers in one table</Link>}
            </>
          ) : wrapLeft.length ? (
            <>
              <span className="eyebrow">{`${app.cycle.name} ${cycleState(app.cycle, app.today) === 'ending' ? 'ends' : 'ended'} on ${dayWithYear(cycleDates(app.cycle).lastDay)}`}</span>
              <h2 className="hero-title">Wrap up {wrapLeft.length === 1 ? 'your goal' : `your ${wrapLeft.length} goals`}</h2>
              <span className="muted">How each one landed, one thing you learned, and whether it carries on. About a minute each.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to={`/retro/${wrapLeft[0]!.id}`}>Start the wrap-up</Link></div>
            </>
          ) : myReview ? (
            <>
              {/* Every check-in posted: said plainly before the review takes over as the week's one action. */}
              {allIn && <span className="hero-allset"><Icon name="check-circle" size={14} />{p.goals.length === 1 ? `Your check-in is posted for week ${app.week}` : `All ${p.goals.length} check-ins posted for week ${app.week}`}</span>}
              <span className="eyebrow">{myReview.review.name}{daysPast(myReview, app.today) ? ` · ${dayText(myReview.date)}, ${pastText(daysPast(myReview, app.today))}` : ''}</span>
              {/* The same agenda as the review itself: what needs judgment, and what can be covered together (product review, 3 Nov). */}
              {(() => {
                const { discuss, healthy } = agendaOf(myReview);
                // Continue picks up the walk in the order the session started with, as the review's page does (deep review T3).
                const order = walkOrder(sessionPlan(myReview, app.snapshot, app.cycle, app.today));
                const nextId = order.find((id) => !myReview.covered.has(id));
                const next = myReview.items.find((a) => a.goal.id === nextId) ?? discuss[0] ?? healthy[0];
                const resume = myReview.done > 0 && discuss.length > 0;
                return (
                  <>
                    <h2 className="hero-title">{discuss.length ? `${discuss.length} ${discuss.length === 1 ? 'goal' : 'goals'} to discuss` : `${healthy.length} with nothing flagged to mark reviewed`}</h2>
                    <span className="muted">{mine.length && !allIn ? 'Your check-ins are in. ' : ''}{discuss.length && healthy.length ? `${healthy.length} more ${healthy.length === 1 ? 'has' : 'have'} nothing flagged: mark them together at the end.` : 'Worst and stalest first, one at a time.'}</span>
                    <div className="row" style={{ marginTop: 8 }}>
                      {resume && next
                        ? <Link className="btn primary big-btn" to={`/goals/${next.goal.id}?review=${myReview.review.id}`} onClick={() => saveReviewOrder(app.ws.id, myReview.review.id, myReview.week, order)}>Continue: {next.goal.title}</Link>
                        : <Link className="btn primary big-btn" to={`/reviews/${myReview.review.id}`}>{myReview.done ? 'Continue the review' : 'Open the review'}</Link>}
                    </div>
                  </>
                );
              })()}
            </>
          ) : mine.length && beforeStartLine(app.cycle, app.today) ? (
            <>
              {/* Before the year's week 1 nothing is due, and it says when it starts (cycle-end 2.10). */}
              <span className="eyebrow">{placeLine(app.cycle, app.today)}</span>
              <h2 className="hero-title">Nothing is due yet</h2>
              <span className="muted">{beforeStartLine(app.cycle, app.today, true)}</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/goals?show=mine">See your goals</Link></div>
            </>
          ) : mine.length && (app.week < 1 || (p.upcoming.length && !p.done.length)) ? (
            <>
              {/* Set up after this week's review (or before the year starts): nothing is due yet (setup review, 8 Nov). */}
              <span className="eyebrow">{app.week < 1 ? `The ${periodWord(app.cycle)} starts this week` : 'Set up this week'}</span>
              <h2 className="hero-title">Your first check-in is next week</h2>
              <span className="muted">{mine.length === 1 ? 'Your goal is' : `Your ${mine.length} goals are`} set. Check in on {mine.length === 1 ? 'it' : 'each'} in week {Math.max(1, app.week + 1)}, by {WEEKDAY[app.cycle.reviewDay]} {dayText(reviewDate(app.cycle, Math.max(1, app.week + 1))).slice(4)}.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/goals?show=mine">See your goals</Link></div>
            </>
          ) : mine.length && hasEnded(app.cycle, app.today) ? (
            <>
              {/* The year has ended and the wrap-up is done or closed: nothing is due (cycle-end rule 2). */}
              <span className="eyebrow">{`${app.cycle.name} ended on ${dayWithYear(cycleDates(app.cycle).lastDay)}`}</span>
              <h2 className="hero-title">Nothing is due</h2>
              <span className="muted">{app.cycle.name} has ended. Each goal keeps its last check-in, and its page says how it ended.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/goals?show=mine">See your goals</Link></div>
            </>
          ) : mine.length ? (
            <>
              <span className="eyebrow">{dueWhen(app)}</span>
              <h2 className="hero-title">You’re all set for week {app.week}</h2>
              <span className="muted">Every goal you own is checked in. Anyone reviewing it sees it as you wrote it.</span>
              <div className="row" style={{ marginTop: 8 }}><Streak weeks={streak} /><Link className="btn" to="/goals">See all goals</Link></div>
            </>
          ) : (
            <>
              <span className="eyebrow">{placeLine(app.cycle, app.today)}</span>
              <h2 className="hero-title">No check-ins or reviews due</h2>
              <span className="muted">You don’t own a goal. Watch the ones you care about, or set one up in about 3 minutes.</span>
              <div className="row" style={{ marginTop: 8 }}>{app.snapshot.goals.length
                ? <><Link className="btn primary" to="/goals">Find goals to watch</Link><Link className="btn" to="/goals/new">Set up a goal</Link></>
                : <Link className="btn primary" to="/goals/new">Set up the first goal</Link>}</div>
            </>
          )}
        </div>
      </section>
      <aside className="home-side split-side" aria-label="For you">{side}</aside>
      <div className="home-main split-b">
        {mine.length > 0 && (
          <section className="block home-mine" data-part="Your goals">
            <div className="row between">
              <h2 className="block-title">Your goals <span className="count-pill">{mine.length}</span></h2>
              {mine.length > 1 && <Link className="small linkish" to="/goals?show=mine">See them in Goals</Link>}
            </div>
            {needs.length > 0 && (
              <div className="home-sub">
                <h3 className="need-group-title">Need attention <span className="count-pill">· {needs.length}</span></h3>
                <AttentionList list={needs} />
              </div>
            )}
            {/* What's new on a phone: after the goals that need you, so the first screen stays the week's work (U2). */}
            {news}
            <HandledGroup list={handled} folded />
            {rest.length > 0 && (
              <div className="home-sub">
                {att.length > 0 && <h3 className="need-group-title">Nothing flagged <span className="count-pill">· {rest.length}</span></h3>}
                <div className="glist">{rest.map((g) => <GoalRow key={g.id} g={g} density="line" />)}</div>
              </div>
            )}
          </section>
        )}
        {/* After your own goals, so what needs you comes first on a phone (U2). It qualifies an empty attention list, so it
            shows only while a goal Home lists (yours, or one you watch) is still waiting for its first check-in: someone
            who owns none sees the goals they watch on the first screen (U9). */}
        <FirstReports among={[...mine, ...watchedGoals(app.viewer.id, app.snapshot)].map((g) => g.id)} />
        {after}
        {/* Someone who owns no goal: after the goals they watch, the first screen's work (U9). */}
        {mine.length === 0 && news}
      </div>
    </>
  );
}

/** Each kind of ask is named once, in its group's heading, so every item leads with the goal it's about. */
const ASK_GROUP: Record<AskKind, string> = { question: 'Questions for you', decision: 'Decisions or help needed', update: 'Updates asked for', action: 'Actions for you' };
const ASK_BUTTON: Record<AskKind, string> = { question: 'Answer', decision: 'Respond', update: 'Check in', action: 'Mark done' };
const GROUP_ORDER: AskKind[] = ['decision', 'question', 'update', 'action'];

/**
 * Needs your response: every open ask waiting on you (one way to ask), once each however many goals it covers, grouped
 * by kind. Each says what it's about, what was asked, who asked and by when, and has one action that opens it in the
 * goal's Respond panel. Asks stay until they're answered, done or withdrawn; comments ask nothing, so they aren't here.
 */
function NeedsYou() {
  const app = useApp();
  const me = app.viewer;
  const first = (id: string) => app.person(id)?.name.split(' ')[0] ?? 'Someone';
  // A question raised in a review is due before that review's next session, not "the review" (deep review T4).
  const questionDue = (rv: Review, raisedWeek: number | null) => {
    const w = Math.max(upcomingSessionWeek(rv, app.cycle, app.week, app.today), raisedWeek != null ? nextSessionWeek(rv, raisedWeek) : 0);
    return w <= app.cycle.weeks ? `Before its next session, ${dayText(sessionDate(rv, app.cycle, w))}` : 'Open until you answer';
  };
  const items = openForPerson(me.id, app.snapshot).flatMap((r) => {
    const goals = r.goalIds.map((id) => app.goal(id)).filter((g) => !!g);
    if (!goals.length) return [];
    const askedIn = app.snapshot.reviews.find((v) => v.id === r.reviewId);
    const where = askedIn?.name;
    const due = r.dueWeek != null
      ? isOverdue(r, app.week) ? `Was due week ${r.dueWeek} (${weekDates(app.cycle, r.dueWeek)})` : r.dueWeek === app.week ? `Due this week (${weekDates(app.cycle, r.dueWeek)})` : `Due week ${r.dueWeek} (${weekDates(app.cycle, r.dueWeek)})`
      : r.kind === 'question' && askedIn ? questionDue(askedIn, r.week) : r.kind === 'action' ? 'No date set' : 'Open until you answer';
    const who = r.askedBy === me.id ? 'You agreed it' : `${first(r.askedBy)} ${r.kind === 'action' ? 'agreed it' : 'asked'}`;
    const goal = r.kind === 'update' ? goals[0]!.id : null;
    return [{
      key: r.id, kind: r.kind, who: r.askedBy, overdue: isOverdue(r, app.week),
      what: goals.length > 1 ? `${goals[0]!.title}, and ${goals.length - 1} more ${goals.length === 2 ? 'goal' : 'goals'} waiting on it` : goals[0]!.title,
      quote: r.ask, meta: `${who}${where ? ` in ${where}` : ''} ${timeAgo(r.createdAt, app.today)}. ${due}.`,
      // An ask for an update is answered by checking in; everything else opens in the goal's Respond panel.
      to: goal ? `/check-in/${goal}` : `/goals/${goals[0]!.id}?respond=${r.id}`, at: r.createdAt,
    }];
  });
  if (!items.length) return null;
  // Overdue first, then newest first, within each kind.
  items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.at.localeCompare(a.at));
  const groups = GROUP_ORDER.map((k) => [k, items.filter((x) => x.kind === k)] as const).filter(([, l]) => l.length);
  return (
    <section className="block needs-you" data-part="Needs your response">
      <h2 className="block-title">Needs your response <span className="count-pill">{items.length}</span></h2>
      {groups.map(([k, list]) => (
        <div key={k} className="need-group">
          <h3 className="need-group-title">{ASK_GROUP[k]} <span className="count-pill">· {list.length}</span></h3>
          <ul className="needs-list">
            {list.map((x) => (
              <li key={x.key} className="need">
                <Avatar p={app.person(x.who) ?? { name: '?', initials: '?' }} size="sm" />
                <span className="need-body">
                  <span className="need-what">{x.what}</span>
                  {x.quote && <span className="need-quote">“{x.quote}”</span>}
                  <span className="need-meta">{x.overdue && <WarnMark />}{x.meta}</span>
                  <span className="need-action">
                    {/* Each opens the goal with this ask open and its box ready (the flagship goal page, 5 Nov). */}
                    <Link className="btn sm" to={x.to}>{ASK_BUTTON[x.kind]}</Link>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * The goals you watch and don't own: what needs attention first (with what got worse this week), then what has gone
 * quiet; what's being handled is folded away; the rest is a count with a way to Watching.
 */
function WatchedGoals() {
  const app = useApp();
  const watched = watchedGoals(app.viewer.id, app.snapshot).filter((g) => g.ownerId !== app.viewer.id);
  if (!watched.length) return null;
  const groups = groupWatched(watched.map((g) => app.attentionOf(g)).sort(attentionOrder));
  const exceptions = groups.needs;
  const worse = exceptions.filter((a) => { const moved = statusChange(a.goal, app.snapshot.checkIns); return moved?.worse && moved.week >= app.week - 1; }).length;
  // Nothing new needs attention: the first few you watch, with how fresh they are, so Home still shows them.
  const shown = exceptions.length ? exceptions.slice(0, 4) : groups.fine.slice(0, 3);
  const parts = [
    groups.needs.length ? `${groups.needs.length} need${groups.needs.length === 1 ? 's' : ''} attention${groups.quiet.length ? ` (${groups.quiet.length} with ${LABEL.stale.toLowerCase()})` : ''}` : 'Nothing new needs attention',
    groups.handled.length ? `${groups.handled.length} ${ATTENTION.handled.label.toLowerCase()}` : '',
    groups.fine.length ? `${groups.fine.length} with nothing flagged` : '',
  ].filter(Boolean);
  return (
    <section className="block home-watch" data-part="Goals you watch">
      <div className="row between">
        <h2 className="block-title">Goals you watch <span className="count-pill">{watched.length}</span></h2>
        <Link className="small linkish" to="/goals?show=watching">All you’re watching</Link>
      </div>
      <p className="hint">{parts.join(' · ')}.{worse ? ` ${worse} got worse this week.` : ''}</p>
      {shown.length > 0 && (
        <ul className="tree">
          {/* Each row says itself when it got worse ("Was on track in week 43") or went quiet. */}
          {shown.map((a) => <li key={a.goal.id}><GoalRow g={a.goal} /></li>)}
        </ul>
      )}
      {exceptions.length > shown.length && <Link className="small linkish" to="/goals?show=watching">{exceptions.length - shown.length} more in Watching</Link>}
      <HandledGroup list={groups.handled} folded />
    </section>
  );
}

/** For admins: the one setup step still missing. */
function AdminCard() {
  const app = useApp();
  if (!app.viewer.admin) return null;
  const later = laterCycle(app.full.cycles, app.cycle);
  const over = hasEnded(app.cycle, app.today);
  if (wrapUpOpenOn(app.cycle, app.today) || (over && !later)) {
    const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
    const next = later?.name ?? nextCycleShape(app.cycle).name;
    const lastDay = dayWithYear(cycleDates(app.cycle).lastDay);
    // The next year is prepared, not moved into: it opens for everyone on its week 1's Monday (cycle-end 2.9).
    const nextLine = later ? `${next} is ready. It opens for everyone on ${dayWithYear(cycleDates(later).firstDay)}.`
      : over ? `Start ${next}: it opens for everyone as soon as you start it.`
      : `${next} isn’t set up yet. It can be started now; everyone stays in ${app.cycle.name} until ${lastDay}.`;
    return (
      <section className="block note-card">
        <span className="stack" style={{ gap: 'var(--s1)' }}><strong>{over ? `${app.cycle.name} ended on ${lastDay}` : `The ${periodWord(app.cycle)} is ending`}</strong><span className="hint">{wrapUpOpenOn(app.cycle, app.today) ? (left ? `${left} ${left === 1 ? 'goal' : 'goals'} still to wrap up. ` : 'Every goal is wrapped up. ') : ''}{nextLine}</span></span>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          {wrapUpOpenOn(app.cycle, app.today) && <Link className="btn" to="/retro">See the wrap-up</Link>}
          <Link className="btn" to={later ? '/workspace/cycles' : '/workspace/cycles/next'}>{later ? 'See Cycles' : `Start ${next}`}</Link>
        </span>
      </section>
    );
  }
  // Adding people is Getting started's row now, said only while it's true (OB3).
  return null;
}

/** Your goals that need attention, each with its one action: check in when that's what it needs, otherwise open it. */
function AttentionList({ list }: { list: ReturnType<typeof attentionList> }) {
  const app = useApp();
  return (
    <div className="alist">
      {list.map((a) => (
        <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id}
          action={a.goal.ownerId === app.viewer.id && a.flags.some((f) => f.kind === 'due' || f.kind === 'stale' || f.kind === 'no-path' || f.kind === 'missed-path')
            ? <Link className="btn sm" to={'/check-in/' + a.goal.id}>Check in</Link>
            : <Link className="btn sm" to={'/goals/' + a.goal.id}>Open</Link>} />
      ))}
    </div>
  );
}

/**
 * The week at a glance, above everything else (Lane's notes, 5 Nov): your goals by status (shape and word), your
 * on-time streak and your next review (the goals you watch have one block of their own, below). One row on a desktop, two by two on a
 * phone; plain cells divided by hairlines, no tinted tiles.
 */
function DashStrip({ d, streakNote }: { d: Dashboard; streakNote: string }) {
  const when = d.next ? (d.next.days === 0 ? 'today' : d.next.days === 1 ? 'tomorrow' : `in ${d.next.days} days`) : '';
  return (
    <section className="dash" aria-label="Your week at a glance" data-part="Week at a glance">
      {/* Each count opens its own goals: "11 off track" lists the 11 (U23). The label opens them all. */}
      <div className="dash-cell dash-goals">
        <Link className="dash-label dash-all" to={d.scope === 'mine' ? '/goals?show=mine' : '/goals'}>{d.scope === 'mine' ? 'Your goals' : 'All goals'} · {d.total}</Link>
        <span className="dash-counts">
          {d.counts.map((c) => (
            <Link key={c.status} className={'dash-count tone-' + c.status} to={`/goals?${d.scope === 'mine' ? 'show=mine&' : ''}status=${c.status}`} aria-label={`${c.n} ${LABEL[c.status].toLowerCase()}: show ${c.n === 1 ? 'it' : 'them'}`}>
              <StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}
            </Link>
          ))}
        </span>
      </div>
      {d.streak != null && (
        <div className="dash-cell dash-streak">
          <span className="dash-label">On-time streak</span>
          <span className="dash-value">{d.streak} {d.streak === 1 ? 'week' : 'weeks'}</span>
          <span className="dash-sub">{streakNote}</span>
        </div>
      )}
      {d.missed[0] ? (
        // A session past its date and not held comes first: the next one mustn't hide it (re-review, 8 Nov, backlog T).
        <Link className="dash-cell dash-review dash-missed" to={`/reviews/${d.missed[0].id}`}>
          <span className="dash-label"><WarnMark />Not held yet{d.missed.length > 1 ? ` · ${d.missed.length} reviews` : ''}</span>
          <span className="dash-value" title={`${d.missed[0].name}, ${dayText(d.missed[0].date)}, ${pastText(d.missed[0].daysPast)}`}>{d.missed[0].name}</span>
          <span className="dash-sub">{dayText(d.missed[0].date)} · {pastText(d.missed[0].daysPast)}</span>
        </Link>
      ) : (
      <Link className="dash-cell dash-review" to={d.next ? `/reviews/${d.next.id}` : '/reviews'}>
        <span className="dash-label">Next review{d.next && <span className="dash-label-when"> · {d.next.weekday}</span>}</span>
        <span className="dash-value" title={d.next ? `${d.next.name}, ${d.next.weekday} ${when}` : undefined}>{d.next ? d.next.name : 'None you’re in'}</span>
        <span className="dash-sub">{d.next ? `${d.next.weekday} · ${when}` : 'See every review'}</span>
      </Link>
      )}
    </section>
  );
}

export function Home() {
  const app = useApp();
  const first = app.viewer.name.split(' ')[0];
  return (
    <div className="page home" data-part="Home">
      <div className="page-head">
        <h1 className="title-xl">{greeting(app.today)}, {first}</h1>
        <span className="muted small home-where">{app.ws.name} · {placeLine(app.cycle, app.today)}</span>
        <HomeNews at="head" />
      </div>
      <GettingStarted />
      <DashStrip d={dashboard(app.viewer.id, app.snapshot, app.cycle, app.week, app.today)} streakNote={streakNote(app)} />
      <div className="home-grid split">
        <MyWeek news={<HomeNews at="phone" />} side={<><NeedsYou /><AdminCard /></>} after={<><WatchedGoals />{/* Modules' blocks (the home.blocks place). */}<Place name="home.blocks" /></>} />
      </div>
    </div>
  );
}

/**
 * Day one (OB3, docs/design/onboarding/spec.md 2.9): for the first two weeks a person is in a workspace, what is true
 * and what to do first, the second person included. The rows are rule 7's (src/domain/dayOne.ts); what each person
 * has done is kept per person and workspace behind the Prefs port. Every button is a plain one: Home keeps its one
 * main action.
 */
function GettingStarted() {
  const app = useApp();
  const prefs = usePrefs();
  const key = [app.ws.id, app.viewer.id, 'day-one'] as const;
  const [facts, setFacts] = useState<DayOneFacts>(() => prefs.get<DayOneFacts>(...key) ?? { firstSeenAt: null });
  // The first visit starts the two weeks.
  useEffect(() => {
    if (facts.firstSeenAt || app.ws.kind === 'example') return;
    const next = { ...facts, firstSeenAt: app.today.toISOString() };
    prefs.set(...key, next); setFacts(next);
  }, [facts, app.ws.kind, app.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (p: Partial<DayOneFacts>) => { const next = { ...facts, ...p }; prefs.set(...key, next); setFacts(next); };
  const rows = gettingStarted(app.viewer.id, { ...dayOneRows(app.snapshot), ended: hasEnded(app.cycle, app.today) }, { name: workspaceName(app.ws, app.mode).name, kind: app.ws.kind, createdAt: app.ws.createdAt }, facts, app.today, WEEKDAY[app.cycle.reviewDay] ?? 'the review');
  if (!rows.length) return null;
  const invite = `${location.origin}${app.mode === 'demo' ? '/demo' : ''}/?workspace=${encodeURIComponent(app.ws.id)}`;
  return (
    <section className="block getting-started" aria-labelledby="getting-started" data-part="Getting started">
      <h2 className="block-title" id="getting-started">Getting started</h2>
      <ul className="gs-list">
        {rows.map((r) => (
          <li key={r.id} className="gs-row" data-row={r.id}>
            <span className="gs-says">{r.says}</span>
            {r.id === 'invite'
              ? <button type="button" className="btn sm" onClick={() => { void navigator.clipboard?.writeText(invite).then(() => app.toast('Link copied'), () => undefined); save({ inviteCopied: true }); }}>{r.action}</button>
              : r.to && <Link className="btn sm" to={r.to} onClick={() => { if (r.id === 'see-goals') save({ sawGoals: true }); }}>{r.action}</Link>}
          </li>
        ))}
      </ul>
      <button type="button" className="linkish small gs-hide" onClick={() => save({ hidden: true })}>Hide this</button>
    </section>
  );
}

