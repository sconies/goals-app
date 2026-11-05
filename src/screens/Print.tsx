/* One page to print or save as PDF: a goal, or a review's session. On screen it's a preview with one action (Print or
   save as PDF); on paper it's A4 portrait, black on white, with no navigation and status still a shape and a word.
   What it says comes from domain/onePager, which gathers what the app already works out. */
import { Link, useParams } from 'react-router';
import { useApp } from '../app/state';
import { goalSheet, reviewSheet, type Fact, type Said } from '../domain/onePager';
import { valueSeries } from '../domain/plan';
import { assessPosted } from '../domain/status';
import { periodLabel, quarterOf } from '../domain/year';
import { Chip, Empty, LevelTag } from '../ui/bits';
import { MetricChart, QuarterMark, quarterWords, RangeChart, StageList } from '../ui/charts';
import { Icon } from '../ui/Icon';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** On screen only: back to where you came from, and the one action. */
function PrintBar({ back, label, pages = 'One A4 page.' }: { back: string; label: string; pages?: string }) {
  return (
    <div className="print-bar">
      <Link className="linkish small print-back" to={back}><Icon name="chevron-left" />{label}</Link>
      <span className="hint print-how">{pages} To keep it as a PDF, choose Save as PDF in the print dialogue.</span>
      <button type="button" className="btn primary print-go" onClick={() => window.print()}><Icon name="print" />Print or save as PDF</button>
    </div>
  );
}

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="ps-facts">
      {facts.map((f, i) => <div key={i} className="ps-fact"><dt>{f.label}</dt><dd>{f.text}</dd></div>)}
    </dl>
  );
}

function SaidList({ said, showReview }: { said: Said[]; showReview?: boolean }) {
  return (
    <ul className="ps-said">
      {said.map((d) => (
        <li key={d.id}>
          <span className="ps-said-kind">{d.label}{showReview && d.review ? `, ${d.review}` : ''}, week {d.week}</span>
          <span>{d.note}</span>
          <span className="hint">
            {d.kind === 'action' ? `${d.who}${d.dueWeek ? `, by week ${d.dueWeek}` : ', no date'}` : d.by}
            {d.kind === 'ask' && (d.answer ? <>. <strong>Answered:</strong> {d.answer}</> : '. Waiting for an answer')}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GoalPrint() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  const sh = goalSheet(goal, app.snapshot, app.cycle, app.week, app.today);
  const s = sh.summary;
  const a = assessPosted(goal, app.cycle, app.snapshot.checkIns, app.week);
  const stale = s.status === 'stale';
  const series = valueSeries(s.checkIns);
  const ptgBy = s.checkIns.at(-1)?.pathToGreen?.byWeek ?? null;
  const nowQ = quarterOf(app.cycle, app.week);
  return (
    <div className="page narrow print-page">
      <PrintBar back={`/goals/${goal.id}`} label="Back to the goal" />
      <article className="print-sheet" aria-label={`${goal.title}, one page`}>
        <header className="ps-head">
          <span className="ps-eyebrow">{app.ws.name.replace(/^Example:\s*/, '')} · {periodLabel(app.cycle, app.week)}</span>
          <h1 className="ps-title">{goal.title}</h1>
          <span className="ps-meta">{s.owner}{s.team !== '—' ? `, ${s.team}` : ''} · <LevelTag level={goal.level} always /> · {s.type}</span>
          {sh.feeds && <span className="ps-meta">Feeds {sh.feeds.title}{sh.feeds.why ? `: ${sh.feeds.why}` : ''}</span>}
        </header>

        <section className="ps-status" aria-label="Status">
          <Chip k={s.status} />
          {s.story.result && <span className={'ps-result tone-' + (s.story.result.kind === 'missed' ? 'off' : 'on')}>{s.story.result.text}</span>}
          <span className="ps-now">{stale ? 'Current performance unknown' : s.now}</span>
          <span className="ps-numbers">
            {s.planThen && <span>Plan {s.planThen}</span>}
            <span>Target {s.target}{goal.kind === 'metric' && !/by week/.test(s.target) ? ` by week ${s.dueWeek}` : ''}</span>
            {!stale && <span className={'tone-' + s.gapTone}>{s.gap}</span>}
            {s.story.since && <span>{s.story.since}</span>}
          </span>
        </section>

        <Facts facts={sh.facts} />

        <section className="ps-block ps-chart" aria-label="Chart">
          {goal.kind === 'metric' && a.kind === 'metric' && <MetricChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} forecast={stale ? null : a.forecast} projection={stale ? null : a.projection} ptgBy={stale ? null : ptgBy} height={170} />}
          {goal.kind === 'range' && <RangeChart goal={goal} weeks={app.cycle.weeks} week={app.week} series={series} height={150} />}
          {a.kind === 'milestone' && <StageList a={a} />}
        </section>

        <div className="ps-cols">
          <section className="ps-block" aria-label="Latest check-in">
            <h2 className="ps-h">Latest check-in</h2>
            {sh.latest ? (
              <div className="stack" style={{ gap: 2 }}>
                <span className="ps-line"><Chip k={sh.latest.c.status} /> <strong>Week {sh.latest.c.week}: {sh.latest.value}</strong>. {sh.latest.by}, {day(sh.latest.c.postedAt)}.</span>
                {sh.latest.reason && <span>{sh.latest.reason}</span>}
                {sh.latest.c.next && <span className="hint">Next: {sh.latest.c.next}</span>}
                {sh.latest.c.greenerWhy && <span className="hint">Called greener than the numbers: {sh.latest.c.greenerWhy}</span>}
              </div>
            ) : <span className="hint">No check-ins yet.</span>}
          </section>
          <section className="ps-block" aria-label="Requests">
            <h2 className="ps-h">Decisions or help needed</h2>
            {sh.open.map((r, i) => (
              <div key={i} className="stack" style={{ gap: 2 }}>
                <span><strong>{r.ask}</strong></span>
                <span className="hint">From {r.to}. Asked by {r.from}, {day(r.createdAt)}{r.waiting > 1 ? `; ${r.waiting} goals waiting on it` : ''}. Open until answered.</span>
              </div>
            ))}
            {sh.answered && (
              <div className="stack" style={{ gap: 2 }}>
                <span><strong>Answered by {sh.answered.by}:</strong> {sh.answered.answer}</span>
                <span className="hint">The request: {sh.answered.ask}</span>
              </div>
            )}
            {!sh.open.length && !sh.answered && <span className="hint">None open.</span>}
          </section>
        </div>

        <section className="ps-block" aria-label="From reviews">
          <h2 className="ps-h">From reviews</h2>
          {sh.said.length ? <SaidList said={sh.said} showReview /> : <span className="hint">No actions, questions or notes yet.</span>}
        </section>

        {sh.quarters.length > 0 && (
          <section className="ps-block" aria-label="This year by quarter">
            <h2 className="ps-h">This year by quarter</h2>
            <ol className="ps-quarters">
              {sh.quarters.map((q) => (
                <li key={q.quarter.n}>
                  <span className="ps-q-head"><strong>{q.quarter.label}</strong><span className="q-result"><QuarterMark kind={q.kind} done={q.quarter.n === nowQ.n ? (app.week - nowQ.from + 1) / (nowQ.to - nowQ.from + 1) : 0} />{q.kind === 'met' ? 'Met' : q.kind === 'missed' ? 'Missed' : q.kind === 'open' ? (q.quarter.n === nowQ.n ? 'Now' : 'To come') : 'None due'}</span></span>
                  {q.kind !== 'none' && <span className="small">{quarterWords(q.text)}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {sh.contributing.length > 0 && (
          <section className="ps-block" aria-label="Contributing goals">
            <h2 className="ps-h">Contributing goals, worst first</h2>
            <ul className="ps-rows">
              {sh.contributing.slice(0, 6).map((c) => <li key={c.goal.id}><Chip k={c.status} /><span className="ps-row-title">{c.goal.title}</span><span className="hint">{c.now} · {c.gap}</span></li>)}
            </ul>
            {sh.contributing.length > 6 && <span className="hint">And {sh.contributing.length - 6} more.</span>}
          </section>
        )}

        <footer className="ps-foot">Printed {longDay(app.today)}. Week {app.week} of {app.cycle.weeks}. Status is the owner’s call from their latest check-in.</footer>
      </article>
    </div>
  );
}

export function ReviewPrint() {
  const app = useApp();
  const { reviewId } = useParams();
  const review = app.snapshot.reviews.find((r) => r.id === reviewId);
  if (!review) return <div className="page narrow"><Empty title="That review doesn’t exist"><Link className="btn" to="/reviews">All reviews</Link></Empty></div>;
  const sh = reviewSheet(review, app.snapshot, app.cycle, app.week, app.today);
  const date = new Date(sh.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const healthy = sh.items.filter((i) => i.healthy && !i.said.length && !i.earlier.length);
  const walked = sh.items.filter((i) => !healthy.includes(i));
  return (
    <div className="page narrow print-page">
      <PrintBar back={`/reviews/${review.id}`} label="Back to the review" pages="A4 portrait, a page or two." />
      <article className="print-sheet" aria-label={`${review.name}, one page`}>
        <header className="ps-head">
          <span className="ps-eyebrow">{app.ws.name.replace(/^Example:\s*/, '')} · {sh.cadence}</span>
          <h1 className="ps-title">{review.name}</h1>
          <span className="ps-meta">Week {sh.week}, {date}. {sh.done} of {sh.total} goals reviewed. Worst and stalest first.</span>
          <span className="ps-meta">{sh.people.join(', ')}</span>
        </header>
        {walked.map((i) => (
          <section key={i.goal.id} className="ps-goal" aria-label={i.goal.title}>
            <div className="ps-goal-head">
              <Chip k={i.status} />
              <span className="ps-row-title">{i.goal.title}</span>
              <span className="hint">{i.owner}{i.covered ? ' · Reviewed' : ''}</span>
            </div>
            {/* One paragraph per goal, so a whole session fits a page or two. */}
            <p className="ps-inline">{i.facts.map((f, k) => <span key={k}><strong>{f.label}:</strong> {f.text} </span>)}</p>
            {i.said.length > 0 && <div className="ps-said-wrap"><span className="ps-label">Said in this session</span><SaidList said={i.said} /></div>}
            {!i.said.length && i.earlier.length > 0 && <div className="ps-said-wrap"><span className="ps-label">Said last time, in week {i.earlier[0]!.week}</span><SaidList said={i.earlier} /></div>}
          </section>
        ))}
        {healthy.length > 0 && (
          <section className="ps-block" aria-label="On track, nothing new">
            <h2 className="ps-h">On track, nothing new · {healthy.length}</h2>
            <ul className="ps-rows">
              {healthy.map((i) => <li key={i.goal.id} className="ps-row-2"><Chip k={i.status} /><span className="ps-row-body"><span className="ps-row-title">{i.goal.title}</span><span className="hint">{i.owner}{i.covered ? ' · Reviewed' : ''} · {fmtWhere(i.facts)}</span></span></li>)}
            </ul>
          </section>
        )}
        {!sh.items.length && <p className="hint">No goals match this review yet.</p>}
        <footer className="ps-foot">Printed {longDay(app.today)}. Reviewing a goal records that someone looked at it; its own status doesn’t change.</footer>
      </article>
    </div>
  );
}

/** The first sentence of where a goal stands, for a one-line row. */
const fmtWhere = (facts: Fact[]) => (facts[0]?.text ?? '').split(/(?<=\.)\s/)[0] ?? '';
