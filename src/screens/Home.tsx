import { Link } from 'react-router';
import { useApp, type AppState } from '../app/state';
import { checkInDraftKey, hasDraft } from '../app/drafts';
import { attentionList } from '../domain/attention';
import { fmt, gapText } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { daysToReview, onTimeStreak, weekProgress, WEEKDAY } from '../domain/progress';
import { reviewQueue } from '../domain/review';
import { assessPosted } from '../domain/status';
import type { Goal, Profile } from '../domain/types';
import { AttentionCard, Dot, PROFILE_LABEL, ProgressRing } from '../ui/bits';
import { Spark, StageSpark } from '../ui/charts';
import { outcomeTrees } from '../domain/tree';
import { OutcomeCard, worstFirst } from './Inspect';

const ROLE_PURPOSE: Record<Profile, string> = {
  lead: 'Your check-ins, and anything in your area that needs you.',
  sponsor: 'Your weekly review, and the calls only you can make.',
  coach: 'Setting people up, and keeping the weekly rhythm going.',
  contributor: 'How your team’s goals are doing, and what they feed.',
};

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

function LeadHome() {
  const app = useApp();
  const p = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today);
  const streak = onTimeStreak(app.viewer.id, app.snapshot, app.cycle, app.week);
  const mine = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id);
  const teamGoals = app.snapshot.goals.filter((g) => g.teamId === app.viewer.teamId);
  const att = attentionList(app.snapshot, app.cycle, app.today, { goals: [...new Set([...mine, ...teamGoals])] });
  const resuming = p.due.some((g) => hasDraft(checkInDraftKey(app.ws.id, g.id, app.week)));
  const minutes = Math.max(1, Math.round(p.due.length * 0.75));
  return (
    <>
      <section className="hero">
        <ProgressRing done={p.done.length} total={p.goals.length} size={56} label={`${p.done.length} of ${p.goals.length} check-ins done this week`} />
        <div className="hero-body">
          {p.due.length ? (
            <>
              <span className="eyebrow">{reviewWhen(app, true)}</span>
              <h2 className="hero-title">{p.due.length === 1 ? '1 check-in to do' : `${p.due.length} check-ins to do`}</h2>
              <span className="muted">About {minutes} min · {p.due.map((g) => g.title).join(', ')}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <Link className="btn primary big-btn" to="/check-in">{resuming ? 'Pick up where you left off' : 'Start check-in'} →</Link>
                <Streak weeks={streak} />
              </div>
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
              <h2 className="hero-title">You don’t own a goal yet</h2>
              <span className="muted">Set one up in about 3 minutes. It feeds the headline goal straight away.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to="/goals/new">Set up a goal →</Link></div>
            </>
          )}
        </div>
      </section>
      <AttentionSection list={att} empty="Nothing in your area needs attention. Nice." />
      {mine.length > 0 && (
        <section className="block">
          <h2 className="block-title">Your goals</h2>
          <div className="glist">{mine.map((g) => <GoalLine key={g.id} g={g} />)}</div>
        </section>
      )}
    </>
  );
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

function SponsorHome() {
  const app = useApp();
  const q = reviewQueue(app.snapshot, app.cycle, app.today, app.week);
  const all = app.snapshot.goals;
  const checkedIn = all.filter((g) => app.checkInsOf(g).some((c) => c.week === app.week)).length;
  const left = q.total - q.done;
  return (
    <>
      <section className="hero">
        <ProgressRing done={q.done} total={q.total} size={56} label={`${q.done} of ${q.total} review items handled`} />
        <div className="hero-body">
          <span className="eyebrow">{reviewWhen(app)} · {checkedIn} of {all.length} goals checked in</span>
          {left ? (
            <>
              <h2 className="hero-title">{left === 1 ? '1 thing needs you' : `${left} things need you`}</h2>
              <span className="muted">About {Math.max(1, Math.round(left * 0.75))} min · worst first, one at a time</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to="/review">{q.done ? 'Continue review' : 'Start review'} →</Link></div>
            </>
          ) : (
            <>
              <h2 className="hero-title">Review done for week {app.week}</h2>
              <span className="muted">{q.total ? `You handled all ${q.total}. Owners can see your calls.` : 'Nothing needed you this week.'}</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/activity">See this week’s activity</Link></div>
            </>
          )}
        </div>
      </section>
      <Outcomes />
    </>
  );
}

/** Every outcome at a glance, each linking to its tree. */
function Outcomes() {
  const app = useApp();
  const { trees } = outcomeTrees(app.snapshot.goals, worstFirst(app));
  if (!trees.length) return null;
  return (
    <section className="block">
      <div className="row between">
        <h2 className="block-title">{trees.length === 1 ? 'Outcome' : 'Outcomes'}</h2>
        <Link className="small linkish" to="/goals">See the goals feeding {trees.length === 1 ? 'it' : 'them'}</Link>
      </div>
      {trees.map((t) => <OutcomeCard key={t.goal.id} node={t} />)}
    </section>
  );
}

function CoachHome() {
  const app = useApp();
  const all = app.snapshot.goals;
  const done = all.filter((g) => app.checkInsOf(g).some((c) => c.week === app.week)).length;
  const att = attentionList(app.snapshot, app.cycle, app.today);
  const stale = att.filter((a) => a.flags.some((f) => f.kind === 'stale'));
  const own = app.workspaces.filter((w) => w.kind === 'own');
  return (
    <>
      <section className="hero">
        <ProgressRing done={done} total={all.length} size={56} label={`${done} of ${all.length} goals checked in this week`} />
        <div className="hero-body">
          <span className="eyebrow">{reviewWhen(app)} · {done} of {all.length} goals checked in</span>
          {app.ws.kind === 'example' && !own.length ? (
            <>
              <h2 className="hero-title">Load your own data</h2>
              <span className="muted">Type, paste or upload your people; goals can come later. About 3 min, and the example stays here to compare.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to="/workspace/new">Load your data →</Link></div>
            </>
          ) : stale.length ? (
            <>
              <h2 className="hero-title">{stale.length === 1 ? '1 goal has gone quiet' : `${stale.length} goals have gone quiet`}</h2>
              <span className="muted">No owner check-in for 14 days or more. A word before the review usually fixes it.</span>
              <div className="row" style={{ marginTop: 8 }}><Link className="btn primary big-btn" to={'/goals/' + stale[0]!.goal.id}>Start with {stale[0]!.goal.title} →</Link></div>
            </>
          ) : (
            <>
              <h2 className="hero-title">The rhythm is healthy</h2>
              <span className="muted">No goal has gone quiet.</span>
            </>
          )}
        </div>
      </section>
      <AttentionSection list={att} empty="Nothing is off track, stale or slipping." />
    </>
  );
}

function ContributorHome() {
  const app = useApp();
  const team = app.team(app.viewer.teamId ?? '');
  const goals = app.snapshot.goals.filter((g) => g.teamId === app.viewer.teamId);
  return (
    <>
      <section className="hero">
        <div className="hero-body">
          <span className="eyebrow">{team ? team.name : 'Your team'} · week {app.week} of {app.cycle.weeks}</span>
          <h2 className="hero-title">{team?.objective || 'Your team’s goals'}</h2>
          <span className="muted">{goals.length ? `${goals.filter((g) => ['on', 'done'].includes(app.statusOf(g).status)).length} of ${goals.length} goals on track. Your work feeds these.` : 'Your team has no goals yet.'}</span>
        </div>
      </section>
      {goals.length > 0 && <section className="block"><h2 className="block-title">Your team’s goals</h2><div className="glist">{goals.map((g) => <GoalLine key={g.id} g={g} />)}</div></section>}
      <Outcomes />
    </>
  );
}

export function Home() {
  const app = useApp();
  const first = app.viewer.name.split(' ')[0];
  return (
    <div className="page narrow">
      <div className="page-head">
        <span className="eyebrow role-eyebrow" data-profile={app.viewer.profile}>{PROFILE_LABEL[app.viewer.profile]} view</span>
        <h1 className="title-xl">{greeting(app.today)}, {first}</h1>
        <span className="muted small">{ROLE_PURPOSE[app.viewer.profile]}</span>
      </div>
      {app.viewer.profile === 'sponsor' ? <SponsorHome /> : app.viewer.profile === 'coach' ? <CoachHome /> : app.viewer.profile === 'contributor' ? <ContributorHome /> : <LeadHome />}
    </div>
  );
}

