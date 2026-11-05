import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp, type AppState } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { attentionList, attentionOrder, splitAttention } from '../domain/attention';
import { dashboard, groupWatched, type Dashboard } from '../domain/home';
import { daysToReview, onTimeStreak, weekProgress, WEEKDAY } from '../domain/progress';
import { agendaOf, openQuestions, reviewSession, watchedGoals } from '../domain/review';
import { daysSince, weekDates } from '../domain/plan';
import { wrapUpOpen } from '../domain/cycle';
import { isUpdateAsk, liveNotes } from '../domain/updateAsks';
import { periodWord, shortPeriod } from '../domain/year';
import { LABEL } from '../domain/status';
import { statusChange } from '../domain/tree';
import { openForPerson } from '../domain/requests';
import type { Change, HelpRequest } from '../domain/types';
import { AttentionCard, Avatar, ProgressRing, StatusShape, timeAgo } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { saveReviewOrder } from './Inspect';
import { GoalRow } from '../ui/goalRows';
import { HandledGroup } from '../ui/HandledGroup';
import { FirstReports } from '../ui/FirstReports';
import { RespondSheet } from './Respond';
import { HomeNews } from './Help';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function reviewWhen(app: AppState, late = false) {
  const days = daysToReview(app.cycle, app.week, app.today);
  const day = WEEKDAY[app.cycle.reviewDay];
  if (late && days < 0) return <span className="tone-off">Due before {day}’s review · {-days === 1 ? '1 day' : -days + ' days'} late</span>;
  return days > 1 ? `${day}’s review is in ${days} days` : days === 1 ? `${day}’s review is tomorrow` : days === 0 ? `${day}’s review is today` : `This week’s review was ${day}`;
}

function Streak({ weeks }: { weeks: number }) {
  if (weeks < 2) return null;
  return <span className="streak" title="Weeks in a row with every check-in in before the review"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8.5 1.5c.4 2.2-1.6 3.4-2.6 5C5 8 5.3 10 6.6 10.6 5.8 8.7 7.6 7.8 8 6.5c1.4 1.4 2.9 3 2.4 5.2-.3 1.6-1.7 2.8-3.4 2.8A4.4 4.4 0 0 1 2.6 10c0-3.6 3.7-5.2 5.9-8.5z" fill="currentColor" /></svg>{weeks}-week on-time streak</span>;
}

/**
 * The week's one main action comes first. What's addressed to you (`side`) follows it on a narrow screen and sits beside
 * it on a wide one; then your goals and what changed (`after`).
 */
function MyWeek({ side, after }: { side?: ReactNode; after?: ReactNode }) {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const streak = onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const att = attentionList(app.snapshot, app.cycle, app.today, { goals: mine });
  // Needs attention is new information; a goal someone has looked at since its latest check-in is being handled.
  const { needs, handled } = splitAttention(att);
  const rest = mine.filter((g) => !att.some((a) => a.goal.id === g.id));
  const wrapLeft = wrapUpOpen(app.cycle, app.week) ? mine.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)) : [];
  const myReview = app.snapshot.reviews.filter((r) => r.people.includes(app.viewer.id)).map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week)).find((s) => s.week === Math.max(1, app.week) && s.done < s.total);
  const resuming = p.due.some((g) => hasDraft(checkInDraftKey(app.ws.id, g.id, app.week)));
  const minutes = Math.max(1, Math.round(p.due.length * 0.75));
  const allIn = p.goals.length > 0 && !p.due.length && p.done.length >= p.goals.length;
  return (
    <>
      <section className="hero home-hero split-a">
        {p.goals.length > 0 && !(myReview && !p.due.length && !wrapLeft.length)
          ? <ProgressRing done={p.done.length} total={p.goals.length} size={56} label={`${p.done.length} of ${p.goals.length} check-ins done this week`} />
          : myReview ? <ProgressRing done={myReview.done} total={myReview.total} size={56} label={`${myReview.done} of ${myReview.total} goals covered in ${myReview.review.name}`} /> : null}
        <div className="hero-body">
          {p.due.length ? (
            <>
              <span className="eyebrow">{reviewWhen(app, true)}</span>
              <h2 className="hero-title">{p.due.length === 1 ? '1 check-in to do' : `${p.due.length} check-ins to do`}</h2>
              <span className="muted">About {minutes} min · {p.due.map((g) => g.title).join(', ')}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <Link className="btn primary big-btn" to="/check-in">{resuming ? 'Pick up where you left off' : 'Start check-in'}</Link>
              </div>
              {p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <Link className="linkish small" to="/quick-check-in">Or type all your numbers in one table</Link>}
            </>
          ) : wrapLeft.length ? (
            <>
              <span className="eyebrow">{app.week >= app.cycle.weeks ? `The ${periodWord(app.cycle)} has ended` : `The ${periodWord(app.cycle)} ends next week`}</span>
              <h2 className="hero-title">Wrap up {wrapLeft.length === 1 ? 'your goal' : `your ${wrapLeft.length} goals`}</h2>
              <span className="muted">How each one landed, one thing you learned, and whether it carries on. About a minute each.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to={`/retro/${wrapLeft[0]!.id}`}>Start the wrap-up</Link></div>
            </>
          ) : myReview ? (
            <>
              {/* Every check-in posted: said plainly before the review takes over as the week's one action. */}
              {allIn && <span className="hero-allset"><Icon name="check-circle" size={14} />{p.goals.length === 1 ? `Your check-in is posted for week ${app.week}` : `All ${p.goals.length} check-ins posted for week ${app.week}`}</span>}
              <span className="eyebrow">{myReview.review.name}</span>
              {/* The same agenda as the review itself: what needs judgment, and what can be covered together (product review, 3 Nov). */}
              {(() => {
                const { discuss, healthy } = agendaOf(myReview);
                const next = discuss[0] ?? healthy[0];
                const resume = myReview.done > 0 && discuss.length > 0;
                return (
                  <>
                    <h2 className="hero-title">{discuss.length ? `${discuss.length} ${discuss.length === 1 ? 'goal' : 'goals'} to discuss` : `${healthy.length} on track to mark reviewed`}</h2>
                    <span className="muted">{mine.length && !allIn ? 'Your check-ins are in. ' : ''}{discuss.length && healthy.length ? `${healthy.length} more ${healthy.length === 1 ? 'is' : 'are'} on track with nothing flagged: mark them together at the end.` : 'Worst and stalest first, one at a time.'}</span>
                    <div className="row" style={{ marginTop: 8 }}>
                      {resume && next
                        ? <Link className="btn primary big-btn" to={`/goals/${next.goal.id}?review=${myReview.review.id}`} onClick={() => saveReviewOrder(app.ws.id, myReview.review.id, myReview.week, discuss.map((a) => a.goal.id))}>Continue: {next.goal.title}</Link>
                        : <Link className="btn primary big-btn" to={`/reviews/${myReview.review.id}`}>{myReview.done ? 'Continue the review' : 'Open the review'}</Link>}
                    </div>
                  </>
                );
              })()}
            </>
          ) : mine.length && app.week < 1 ? (
            <>
              <span className="eyebrow">The {periodWord(app.cycle)} starts this week</span>
              <h2 className="hero-title">Your first check-in is next week</h2>
              <span className="muted">{mine.length === 1 ? 'Your goal is' : `Your ${mine.length} goals are`} set. Check in on {mine.length === 1 ? 'it' : 'each'} in week 1, before {WEEKDAY[app.cycle.reviewDay]}’s review.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/goals?show=mine">See your goals</Link></div>
            </>
          ) : mine.length ? (
            <>
              <span className="eyebrow">{reviewWhen(app)}</span>
              <h2 className="hero-title">You’re all set for week {app.week}</h2>
              <span className="muted">Every goal you own is checked in. It’s in the review as you wrote it.</span>
              <div className="row" style={{ marginTop: 8 }}><Streak weeks={streak} /><Link className="btn" to="/goals">See all goals</Link></div>
            </>
          ) : (
            <>
              <span className="eyebrow">{shortPeriod(app.cycle, app.week)}</span>
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
        <FirstReports />
        {mine.length > 0 && (
          <section className="block home-mine">
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
            <HandledGroup list={handled} folded />
            {rest.length > 0 && (
              <div className="home-sub">
                {att.length > 0 && <h3 className="need-group-title">Nothing flagged <span className="count-pill">· {rest.length}</span></h3>}
                <div className="glist">{rest.map((g) => <GoalRow key={g.id} g={g} density="line" />)}</div>
              </div>
            )}
          </section>
        )}
        {after}
      </div>
    </>
  );
}

type AskKind = 'question' | 'request' | 'action' | 'comment';
type Ask = { key: string; kind: AskKind; who: string; what: string; quote?: string; meta: string; to: string; action: string; at: string; request?: HelpRequest };
/** Each kind of ask is named once, in its group's heading, so every item leads with the goal it's about. */
const ASK_GROUP: Record<AskKind, string> = { question: 'Questions for you', request: 'Decisions or help needed', action: 'Actions for you', comment: 'On your goals' };

/**
 * Needs your response: things addressed to you. Each says what it's about, what's needed, who asked and by when, and has
 * one specific action.
 */
function NeedsYou() {
  const app = useApp();
  const [responding, setResponding] = useState<HelpRequest | null>(null);
  const me = app.viewer;
  const first = (id: string) => app.person(id)?.name.split(' ')[0] ?? 'Someone';
  const reviewDay = WEEKDAY[app.cycle.reviewDay];
  const items: Ask[] = [];
  for (const d of openQuestions(me.id, app.snapshot)) {
    const r = app.snapshot.reviews.find((x) => x.id === d.reviewId);
    items.push({ key: d.id, kind: 'question', who: d.byId, what: app.goal(d.goalId)?.title ?? '', quote: d.note, meta: `${first(d.byId)} asked you${r ? ` in ${r.name}` : ''}. Before ${reviewDay}’s review.`, to: `/goals/${d.goalId}?tab=comments`, action: 'Answer', at: d.at });
  }
  // Open requests for a decision or help addressed to you: once each, however many goals are waiting on it.
  for (const r of openForPerson(me.id, app.snapshot)) {
    const goals = r.goalIds.map((id) => app.goal(id)).filter((g) => !!g);
    if (!goals.length) continue;
    items.push({ key: 'req-' + r.id, kind: 'request', who: r.askedBy, what: goals.length > 1 ? `${goals[0]!.title}, and ${goals.length - 1} more ${goals.length === 2 ? 'goal' : 'goals'} waiting on it` : goals[0]!.title, quote: r.ask, meta: `Asked by ${first(r.askedBy)} ${timeAgo(r.createdAt, app.today)}; open until you answer`, to: `/goals/${goals[0]!.id}`, action: 'Respond', at: r.createdAt, request: r });
  }
  // Actions from reviews assigned to you that are due from this week on (or undated and recent).
  for (const d of app.snapshot.decisions) {
    if (d.kind !== 'action' || (d.assigneeId ?? app.goal(d.goalId)?.ownerId) !== me.id || d.byId === me.id && !d.assigneeId) continue;
    const due = d.dueWeek;
    if (due != null ? due < app.week : daysSince(d.at, app.today) > 14) continue;
    const from = app.snapshot.reviews.find((r) => r.id === d.reviewId)?.name ?? 'a review';
    items.push({ key: d.id, kind: 'action', who: d.byId, what: app.goal(d.goalId)?.title ?? '', quote: d.note, meta: `From ${from}. ${due != null ? (due === app.week ? `Due this week (${weekDates(app.cycle, due)})` : `Due week ${due} (${weekDates(app.cycle, due)})`) : 'No date set'}`, to: `/goals/${d.goalId}`, action: 'Open the goal', at: d.at });
  }
  const mine = new Set(app.snapshot.goals.filter((g) => g.ownerId === me.id).map((g) => g.id));
  // An ask for an update is done once they've checked in since.
  const answeredAsk = (c: Change) => isUpdateAsk(c) && app.snapshot.checkIns.some((x) => x.goalId === c.goalId && x.postedAt > c.at);
  for (const c of liveNotes(app.snapshot.changes).filter((c) => c.goalId && mine.has(c.goalId) && c.actorId !== me.id && daysSince(c.at, app.today) <= 7 && !answeredAsk(c)).slice(-3)) {
    items.push({ key: c.id, kind: 'comment', who: c.actorId, what: app.goal(c.goalId!)?.title ?? '', quote: c.diffs[0]?.to, meta: `${isUpdateAsk(c) ? `${first(c.actorId)} asked for an update` : `${first(c.actorId)} commented`} ${timeAgo(c.at, app.today)}`, ...(isUpdateAsk(c) ? { to: `/check-in/${c.goalId}`, action: 'Check in' } : { to: `/goals/${c.goalId}?tab=comments`, action: 'Reply' }), at: c.at });
  }
  if (!items.length) return null;
  items.sort((a, b) => b.at.localeCompare(a.at));
  const shown = items.slice(0, 5);
  const groups = [...new Set(shown.map((x) => x.kind))].map((k) => [k, shown.filter((x) => x.kind === k)] as const);
  const done = responding && !openForPerson(me.id, app.snapshot).some((r) => r.id === responding.id);
  return (
    <section className="block needs-you">
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
                  <span className="need-meta">{x.meta}</span>
                  <span className="need-action">
                    {x.request ? <button type="button" className="btn sm" onClick={() => setResponding(x.request!)}>{x.action}</button> : <Link className="btn sm" to={x.to}>{x.action}</Link>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {responding && !done && <RespondSheet request={responding} onClose={() => setResponding(null)} />}
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
  const exceptions = [...groups.needs, ...groups.quiet];
  const worse = exceptions.filter((a) => { const moved = statusChange(a.goal, app.snapshot.checkIns); return moved?.worse && moved.week >= app.week - 1; }).length;
  // Nothing new needs attention: the first few you watch, with how fresh they are, so Home still shows them.
  const shown = exceptions.length ? exceptions.slice(0, 4) : groups.fine.slice(0, 3);
  const parts = [
    groups.needs.length ? `${groups.needs.length} need${groups.needs.length === 1 ? 's' : ''} attention` : 'Nothing new needs attention',
    groups.handled.length ? `${groups.handled.length} being handled` : '',
    groups.quiet.length ? `${groups.quiet.length} with no recent update` : '',
    groups.fine.length ? `${groups.fine.length} on track or done` : '',
  ].filter(Boolean);
  return (
    <section className="block home-watch">
      <div className="row between">
        <h2 className="block-title">Goals you watch <span className="count-pill">{watched.length}</span></h2>
        <Link className="small linkish" to="/watching">All you’re watching</Link>
      </div>
      <p className="hint">{parts.join(' · ')}.{worse ? ` ${worse} got worse this week.` : ''}</p>
      {shown.length > 0 && (
        <ul className="tree">
          {/* Each row says itself when it got worse ("Was on track in week 43") or went quiet. */}
          {shown.map((a) => <li key={a.goal.id}><GoalRow g={a.goal} /></li>)}
        </ul>
      )}
      {exceptions.length > shown.length && <Link className="small linkish" to="/watching">{exceptions.length - shown.length} more in Watching</Link>}
      <HandledGroup list={groups.handled} folded />
    </section>
  );
}

/** For admins: the one setup step still missing. */
function AdminCard() {
  const app = useApp();
  if (!app.viewer.admin) return null;
  const own = app.workspaces.filter((w) => w.kind === 'own');
  if (wrapUpOpen(app.cycle, app.week)) {
    const left = app.snapshot.goals.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)).length;
    return (
      <section className="block note-card">
        <span className="stack" style={{ gap: 'var(--s1)' }}><strong>The {periodWord(app.cycle)} is ending</strong><span className="hint">{left ? `${left} ${left === 1 ? 'goal' : 'goals'} still to wrap up. ` : 'Every goal is wrapped up. '}Start the next {periodWord(app.cycle)} when you’re ready.</span></span>
        <Link className="btn" to="/retro">See the wrap-up</Link>
      </section>
    );
  }
  if (app.mode === 'demo' && app.ws.kind === 'example' && !own.length) {
    return (
      <section className="block note-card">
        <span className="stack" style={{ gap: 'var(--s1)' }}><strong>Try it with your own team</strong><span className="hint">Set up a workspace from a template or a pasted list. About 3 minutes; the example stays here.</span></span>
        <Link className="btn" to="/workspace/new">Set one up</Link>
      </section>
    );
  }
  if (app.snapshot.people.length < 3) {
    return (
      <section className="block note-card">
        <span className="stack" style={{ gap: 'var(--s1)' }}><strong>Add your people</strong><span className="hint">Goal owners need to be here to check in.</span></span>
        <Link className="btn" to="/workspace">Add people</Link>
      </section>
    );
  }
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
 * on-time streak, the goals you watch that need attention, and your next review. One row on a desktop, two by two on a
 * phone; plain cells divided by hairlines, no tinted tiles.
 */
function DashStrip({ d }: { d: Dashboard }) {
  const when = d.next ? (d.next.days === 0 ? 'today' : d.next.days === 1 ? 'tomorrow' : `in ${d.next.days} days`) : '';
  const w = d.watching;
  return (
    <section className="dash" aria-label="Your week at a glance">
      <Link className="dash-cell dash-goals" to={d.scope === 'mine' ? '/goals?show=mine' : '/goals'}>
        <span className="dash-label">{d.scope === 'mine' ? 'Your goals' : 'All goals'} · {d.total}</span>
        <span className="dash-counts">
          {d.counts.map((c) => <span key={c.status} className={'dash-count tone-' + c.status}><StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}</span>)}
        </span>
      </Link>
      {d.streak != null && (
        <div className="dash-cell dash-streak">
          <span className="dash-label">On-time streak</span>
          <span className="dash-value">{d.streak} {d.streak === 1 ? 'week' : 'weeks'}</span>
          <span className="dash-sub">{d.streak ? 'All in before the review' : 'Check in before the review to start one'}</span>
        </div>
      )}
      <Link className="dash-cell dash-watch" to="/watching">
        <span className="dash-label">Watching{w ? ` · ${w.all.length}` : ''}</span>
        <span className="dash-value">{!w ? 'Nothing yet' : w.needs.length ? `${w.needs.length} need${w.needs.length === 1 ? 's' : ''} attention` : 'Nothing new'}</span>
        <span className="dash-sub">{!w ? 'Follow the goals you care about' : [w.handled.length ? `${w.handled.length} being handled` : '', w.quiet.length ? `${w.quiet.length} gone quiet` : ''].filter(Boolean).join(' · ') || 'Nothing behind or quiet'}</span>
      </Link>
      <Link className="dash-cell dash-review" to={d.next ? `/reviews/${d.next.id}` : '/reviews'}>
        <span className="dash-label">Next review{d.next && <span className="dash-label-when"> · {d.next.weekday}</span>}</span>
        <span className="dash-value" title={d.next ? `${d.next.name}, ${d.next.weekday} ${when}` : undefined}>{d.next ? d.next.name : 'None you’re in'}</span>
        <span className="dash-sub">{d.next ? `${d.next.weekday} · ${when}` : 'See every review'}</span>
      </Link>
    </section>
  );
}

export function Home() {
  const app = useApp();
  const first = app.viewer.name.split(' ')[0];
  return (
    <div className="page home">
      <div className="page-head">
        <h1 className="title-xl">{greeting(app.today)}, {first}</h1>
        <span className="muted small home-where">{app.ws.name} · {shortPeriod(app.cycle, app.week).replace(/^Week/, 'week')}</span>
        <HomeNews at="head" />
      </div>
      <DashStrip d={dashboard(app.viewer.id, app.snapshot, app.cycle, app.week, app.today)} />
      <div className="home-grid split">
        <MyWeek side={<><NeedsYou /><AdminCard /></>} after={<WatchedGoals />} />
      </div>
      {/* On a phone the first screen is the week's work, so the line waits at the foot of Home (the dot on More says it too). */}
      <HomeNews at="foot" />
    </div>
  );
}
