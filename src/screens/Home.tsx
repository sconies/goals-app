import { Link } from 'react-router';
import { useApp, type AppState } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { attentionList } from '../domain/attention';
import { fmt, gapText } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { daysToReview, onTimeStreak, weekProgress, WEEKDAY } from '../domain/progress';
import { openQuestions, reviewSession, watchedGoals } from '../domain/review';
import { daysSince, weekDates } from '../domain/plan';
import { wrapUpOpen } from '../domain/cycle';
import { periodWord, shortPeriod } from '../domain/year';
import { assessPosted, LABEL } from '../domain/status';
import { statusChange } from '../domain/tree';
import type { Goal } from '../domain/types';
import { AttentionCard, Avatar, Dot, ProgressRing } from '../ui/bits';
import { Spark, StageSpark } from '../ui/charts';
import { TreeRow, worstFirst } from './Inspect';

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

/** One line per goal: status, name, the number that matters. Low density on purpose. */
export function GoalLine({ g }: { g: Goal }) {
  const app = useApp();
  const st = app.statusOf(g);
  const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, a);
  const now = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages` : a.actual == null || g.kind === 'milestone' ? 'No value yet' : fmt(a.actual, g);
  return (
    <Link to={'/goals/' + g.id} className="gline">
      <Dot k={st.status} />
      <span className="gline-title">{g.title}</span>
      <span className="gline-now">{now}<span className={'tone-' + gap.tone}> · {st.status === 'stale' ? 'Stale' : gap.short}</span></span>
      <span className="gline-spark">
        {g.kind !== 'milestone' ? <Spark goal={g} weeks={app.cycle.weeks} series={valueSeries(app.checkInsOf(g))} /> : a.kind === 'milestone' ? <StageSpark a={a} /> : null}
      </span>
    </Link>
  );
}

function MyWeek() {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const streak = onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const att = attentionList(app.snapshot, app.cycle, app.today, { goals: mine });
  const rest = mine.filter((g) => !att.some((a) => a.goal.id === g.id));
  const wrapLeft = wrapUpOpen(app.cycle, app.week) ? mine.filter((g) => !app.snapshot.retros.some((r) => r.goalId === g.id)) : [];
  const myReview = app.snapshot.reviews.filter((r) => r.people.includes(app.viewer.id)).map((r) => reviewSession(r, app.snapshot, app.cycle, app.today, app.week)).find((s) => s.week === Math.max(1, app.week) && s.done < s.total);
  const resuming = p.due.some((g) => hasDraft(checkInDraftKey(app.ws.id, g.id, app.week)));
  const minutes = Math.max(1, Math.round(p.due.length * 0.75));
  return (
    <>
      <section className="hero">
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
                <Link className="btn primary big-btn" to="/check-in">{resuming ? 'Pick up where you left off' : 'Start check-in'} →</Link>
              </div>
              {p.due.filter((g) => g.kind !== 'milestone').length >= 2 && <Link className="linkish small" to="/quick-check-in">Or type all your numbers in one table</Link>}
            </>
          ) : wrapLeft.length ? (
            <>
              <span className="eyebrow">{app.week >= app.cycle.weeks ? `The ${periodWord(app.cycle)} has ended` : `The ${periodWord(app.cycle)} ends next week`}</span>
              <h2 className="hero-title">Wrap up {wrapLeft.length === 1 ? 'your goal' : `your ${wrapLeft.length} goals`}</h2>
              <span className="muted">How each one landed, one thing you learned, and whether it carries on. About a minute each.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to={`/retro/${wrapLeft[0]!.id}`}>Start the wrap-up →</Link></div>
            </>
          ) : myReview ? (
            <>
              <span className="eyebrow">{myReview.review.name}</span>
              <h2 className="hero-title">{myReview.total - myReview.done === 1 ? '1 goal to review' : `${myReview.total - myReview.done} goals to review`}</h2>
              <span className="muted">{mine.length ? 'Your check-ins are in. ' : ''}Worst and stalest first, one at a time.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to={`/reviews/${myReview.review.id}`}>{myReview.done ? 'Continue the review' : 'Open the review'} →</Link></div>
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
      {mine.length > 0 && att.length > 0 && <AttentionSection list={att} empty="" title="Your goals that need you" />}
      {rest.length > 0 && (
        <section className="block">
          <h2 className="block-title">{att.length ? 'Your other goals' : 'Your goals'}</h2>
          <div className="glist">{rest.map((g) => <GoalLine key={g.id} g={g} />)}</div>
        </section>
      )}
    </>
  );
}

type Ask = { key: string; who: string; why: string; what: string; quote?: string; when?: string; to: string; action: string; at: string };

/**
 * Needs your response: things addressed to you. Each says why you're seeing it, what's needed,
 * by when, and has one specific action.
 */
function NeedsYou() {
  const app = useApp();
  const me = app.viewer;
  const first = (id: string) => app.person(id)?.name.split(' ')[0] ?? 'Someone';
  const reviewDay = WEEKDAY[app.cycle.reviewDay];
  const items: Ask[] = [];
  for (const d of openQuestions(me.id, app.snapshot)) {
    const r = app.snapshot.reviews.find((x) => x.id === d.reviewId);
    items.push({ key: d.id, who: d.byId, why: `${first(d.byId)} asked you${r ? ` in ${r.name}` : ''}`, what: `About ${app.goal(d.goalId)?.title}`, quote: d.note, when: `Before ${reviewDay}’s review`, to: `/goals/${d.goalId}?tab=comments`, action: 'Answer', at: d.at });
  }
  // Help or a decision the owner named you for in their latest check-in, while the goal is behind.
  for (const g of app.snapshot.goals) {
    const st = app.statusOf(g);
    const needs = st.latest?.pathToGreen?.needs ?? '';
    if (g.ownerId !== me.id && needs.startsWith(me.name + ':') && (st.status === 'risk' || st.status === 'off')) {
      items.push({ key: 'need-' + g.id, who: g.ownerId, why: `${first(g.ownerId)} needs a decision or help from you`, what: g.title, quote: needs.slice(me.name.length + 1).trim(), when: `Raised in week ${st.latest!.week}`, to: `/goals/${g.id}?tab=comments`, action: 'Respond', at: st.latest!.postedAt });
    }
  }
  // Actions from reviews assigned to you that are due from this week on (or undated and recent).
  for (const d of app.snapshot.decisions) {
    if (d.kind !== 'action' || (d.assigneeId ?? app.goal(d.goalId)?.ownerId) !== me.id || d.byId === me.id && !d.assigneeId) continue;
    const due = d.dueWeek;
    if (due != null ? due < app.week : daysSince(d.at, app.today) > 14) continue;
    items.push({ key: d.id, who: d.byId, why: `Action for you from ${app.snapshot.reviews.find((r) => r.id === d.reviewId)?.name ?? 'a review'}`, what: app.goal(d.goalId)?.title ?? '', quote: d.note, when: due != null ? (due === app.week ? `Due this week (${weekDates(app.cycle, due)})` : `Due week ${due} (${weekDates(app.cycle, due)})`) : 'No date set', to: `/goals/${d.goalId}`, action: 'Open the goal', at: d.at });
  }
  const mine = new Set(app.snapshot.goals.filter((g) => g.ownerId === me.id).map((g) => g.id));
  for (const c of app.snapshot.changes.filter((c) => c.entity === 'note' && c.goalId && mine.has(c.goalId) && c.actorId !== me.id && daysSince(c.at, app.today) <= 7).slice(-3)) {
    items.push({ key: c.id, who: c.actorId, why: `${first(c.actorId)} commented on your goal`, what: app.goal(c.goalId!)?.title ?? '', quote: c.diffs[0]?.to, to: `/goals/${c.goalId}?tab=comments`, action: 'Reply', at: c.at });
  }
  if (!items.length) return null;
  items.sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="block">
      <h2 className="block-title">Needs your response <span className="count-pill">{items.length}</span></h2>
      <ul className="needs-list">
        {items.slice(0, 5).map((x) => (
          <li key={x.key} className="need">
            <Avatar p={app.person(x.who) ?? { name: '?', initials: '?' }} size="sm" />
            <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
              <span className="small strong">{x.why}</span>
              <span className="small">{x.what}</span>
              {x.quote && <span className="note-text">“{x.quote}”</span>}
              {x.when && <span className="hint">{x.when}</span>}
            </span>
            <Link className="btn sm" to={x.to}>{x.action}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Important changes: what got worse this week in goals you watch or own, and why you're seeing it. */
function ImportantChanges() {
  const app = useApp();
  const watched = watchedGoals(app.viewer.id, app.snapshot).filter((g) => g.ownerId !== app.viewer.id);
  const ids = new Set(watched.map((g) => g.id));
  const changed = watched.map((g) => {
    const st = app.statusOf(g);
    const moved = statusChange(g, app.snapshot.checkIns);
    const reason = moved?.worse && moved.week >= app.week - 1 ? `Was ${LABEL[moved.from].toLowerCase()} in week ${moved.week}` : st.status === 'stale' ? 'Gone quiet' : app.attentionOf(g).flags.some((f) => f.kind === 'trend') ? 'Trend getting worse' : null;
    return { g, reason };
  }).filter((x) => x.reason);
  if (!watched.length) return null;
  const rest = watched.filter((g) => !changed.some((c) => c.g.id === g.id)).sort(worstFirst(app));
  const bad = watched.filter((g) => ['off', 'risk', 'stale'].includes(app.statusOf(g).status)).length;
  return (
    <section className="block">
      <div className="row between">
        <h2 className="block-title">Important changes</h2>
        <Link className="small linkish" to="/watching">All {watched.length} you’re watching</Link>
      </div>
      <p className="hint">{changed.length ? `In goals you watch: ${changed.length} got worse or went quiet.` : `Nothing got worse this week in the goals you watch.`} {bad ? `${bad} of ${ids.size} need attention.` : ''}</p>
      <ul className="tree">
        {changed.slice(0, 4).map(({ g, reason }) => <li key={g.id}><span className="change-reason">{reason}</span><TreeRow g={g} /></li>)}
        {!changed.length && rest.slice(0, 3).map((g) => <li key={g.id}><TreeRow g={g} /></li>)}
      </ul>
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

function AttentionSection({ list, empty, limit = 3, title = 'Needs attention' }: { list: ReturnType<typeof attentionList>; empty: string; limit?: number; title?: string }) {
  const app = useApp();
  return (
    <section className="block">
      <div className="row between">
        <h2 className="block-title">{title}{list.length ? <span className="count-pill">{list.length}</span> : null}</h2>
        {list.length > limit && <Link className="small linkish" to="/goals?show=attention">Show all {list.length}</Link>}
      </div>
      {list.length ? (
        <div className="alist">
          {list.slice(0, limit).map((a) => (
            <AttentionCard key={a.goal.id} a={a} to={'/goals/' + a.goal.id}
              action={a.goal.ownerId === app.viewer.id && a.flags.some((f) => f.kind === 'due' || f.kind === 'stale' || f.kind === 'no-path' || f.kind === 'missed-path')
                ? <Link className="btn sm" to={'/check-in/' + a.goal.id}>Check in</Link>
                : <Link className="btn sm" to={'/goals/' + a.goal.id}>Open</Link>} />
          ))}
        </div>
      ) : <div className="calm"><span aria-hidden="true">✓</span> {empty}</div>}
    </section>
  );
}

export function Home() {
  const app = useApp();
  const first = app.viewer.name.split(' ')[0];
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">{greeting(app.today)}, {first}</h1>
        <span className="muted small">{app.ws.name} · {shortPeriod(app.cycle, app.week).toLowerCase()}</span>
      </div>
      <NeedsYou />
      <MyWeek />
      <AdminCard />
      <ImportantChanges />
    </div>
  );
}
