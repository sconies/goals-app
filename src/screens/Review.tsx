import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { openProposal, pendingSummary, type GoalAttention } from '../domain/attention';
import { causeLabel } from '../domain/checkin';
import { fmt, gapText, weekLabel } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { DECISION_LABEL, reviewQueue } from '../domain/review';
import { assessPosted, LABEL } from '../domain/status';
import type { Decision } from '../domain/types';
import { Avatar, Chip, Empty, FlagPill, ProgressRing, Tag } from '../ui/bits';
import { MetricChart, MetricLegend, RangeChart, StageList } from '../ui/charts';

/** The sponsor's weekly review: work the queue to zero, one goal at a time, worst first. */
export function Review() {
  const app = useApp();
  const nav = useNavigate();
  const q = reviewQueue(app.snapshot, app.cycle, app.today, app.week);
  // Fix the order when the review opens, so handled items don't jump around.
  const [order] = useState(() => q.items.map((a) => a.goal.id));
  const items = order.map((id) => q.items.find((a) => a.goal.id === id) ?? null).filter((a): a is GoalAttention => !!a);
  const [params] = useSearchParams();
  const asked = items.findIndex((a) => a.goal.id === params.get('goal'));
  const firstOpen = items.findIndex((a) => !q.handled.has(a.goal.id));
  const [index, setIndex] = useState(asked >= 0 ? asked : firstOpen < 0 ? items.length : firstOpen);
  const current = items[index];

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

  // Next open item after this one, then any skipped earlier; the summary only when nothing is left.
  const open = (a: GoalAttention) => !q.handled.has(a.goal.id) && a.goal.id !== current?.goal.id;
  const advance = () => {
    const after = items.findIndex((a, i) => i > index && open(a));
    const before = items.findIndex((a, i) => i < index && open(a));
    setIndex(after >= 0 ? after : before >= 0 ? before : items.length);
  };
  const skipped = items.filter((a) => !q.handled.has(a.goal.id));

  return (
    <div className="review">
      <aside className="review-rail" aria-label="Review queue">
        <div className="row between nowrap" style={{ padding: '4px 4px 10px' }}>
          <span className="stack" style={{ gap: 0 }}><span className="strong">Week {app.week} review</span><span className="tiny muted">{q.done} of {q.total} handled</span></span>
          <ProgressRing done={q.done} total={q.total} size={40} />
        </div>
        {items.map((a, i) => (
          <button key={a.goal.id} className="rail-item" aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)}>
            <span className={'rail-mark ' + (q.handled.has(a.goal.id) ? 'done' : a.flags[0]?.tone)} aria-hidden="true">{q.handled.has(a.goal.id) ? '✓' : ''}</span>
            <span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="ellipsis strong">{a.goal.title}</span><span className="tiny muted">{a.flags.filter((f) => f.kind !== 'due').map((f) => f.label).slice(0, 2).join(' · ')}</span></span>
          </button>
        ))}
      </aside>
      <div className="review-main">
        <div className="focus-top">
          <span className="small strong">Review · {Math.min(q.done + (current && !q.handled.has(current.goal.id) ? 1 : 0), q.total)} of {q.total}</span>
          <div className="bar ok" style={{ flex: 1, maxWidth: 240 }} aria-hidden="true"><i style={{ width: `${q.total ? (q.done / q.total) * 100 : 100}%` }} /></div>
          <button className="iconbtn" onClick={() => nav('/')} aria-label="Close review">✕</button>
        </div>
        {current ? <ReviewCard key={current.goal.id} a={current} handled={q.handled.has(current.goal.id)} onDone={advance} onSkip={() => setIndex((i) => Math.min(items.length, i + 1))} />
          : skipped.length ? (
            <div className="celebrate" role="status">
              <h1 className="title-xl">{skipped.length} still open</h1>
              <p className="muted">You skipped {skipped.length === 1 ? 'one goal' : `${skipped.length} goals`}. Each needs a call before the review is done.</p>
              <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary big-btn" onClick={() => setIndex(items.indexOf(skipped[0]!))}>Back to {skipped[0]!.goal.title}</button></div>
            </div>
          ) : <ReviewDone />}
      </div>
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
          {mine.map((d) => <li key={d.id}><span className="strong">{app.goal(d.goalId)?.title}</span><span className="small muted">{DECISION_LABEL[d.kind]}{d.note ? ` · “${d.note}”` : ''}</span></li>)}
        </ul>
      )}
      <div className="row" style={{ justifyContent: 'center' }}><Link ref={ref} className="btn primary big-btn" to="/">Back to home</Link><Link className="btn" to="/goals">See all goals</Link></div>
    </div>
  );
}

function ReviewCard({ a, handled, onDone, onSkip }: { a: GoalAttention; handled: boolean; onDone: () => void; onSkip: () => void }) {
  const app = useApp();
  const g = a.goal;
  const st = a.status;
  const latest = st.latest;
  const owner = app.person(g.ownerId);
  const assessment = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
  const gap = gapText(g, assessment);
  const proposal = openProposal(g, app.snapshot.checkIns, app.snapshot.decisions);
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const decisions = app.snapshot.decisions.filter((d) => d.goalId === g.id && d.week === app.week);
  const series = valueSeries(app.checkInsOf(g));
  const ptg = latest?.pathToGreen;
  const top = a.flags.find((f) => f.kind !== 'due');
  // A proposed plan change has its own section below, so the lede doesn't repeat it.
  const planChangeOnly = top?.kind === 'proposal' && !!g.pending && !proposal;

  const decide = async (kind: Decision['kind']) => {
    if (busy) return;
    if (kind === 'ask' && note.trim().length < 3) { setAsking(true); return; }
    setBusy(true);
    try {
      await app.decide(g, kind, note, proposal && (kind === 'approve-target' || kind === 'decline-target') ? proposal : latest);
      app.toast(kind === 'ask' ? `Question sent to ${owner?.name}` : DECISION_LABEL[kind]);
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <article className="review-card">
      <div className="row" style={{ gap: 6 }}>{a.flags.filter((f) => f.kind !== 'due').map((f) => <FlagPill key={f.kind} f={f} />)}</div>
      <h1 className="title-xl">{g.title}</h1>
      <span className="row small muted" style={{ gap: 8 }}><Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" />{owner?.name} · {app.team(g.teamId)?.name}{latest ? ` · checked in week ${latest.week}` : ''}</span>
      <p className="lede">{planChangeOnly ? `${app.person(g.pending!.byId)?.name.split(' ')[0] ?? 'The owner'} wants to change the plan. It’s ${LABEL[st.status].toLowerCase()} today.` : top?.detail}</p>

      {g.pending && !proposal && (
        <section className="owner-says path">
          <span className="label">{app.person(g.pending.byId)?.name.split(' ')[0] ?? 'The owner'} proposes a plan change · week {g.pending.week}</span>
          <p><strong>{pendingSummary(g)}</strong></p>
          <p>“{g.pending.reason}”</p>
          <span className="tiny muted">Approving re-baselines the plan from this week. The original stays on the chart.</span>
        </section>
      )}

      <div className="numbers">
        <div><span className="tiny muted">Status</span><Chip k={st.status} />{assessment.calc !== st.status && st.status !== 'stale' && <span className="tiny muted">Numbers say {LABEL[assessment.calc].toLowerCase()}</span>}</div>
        <div><span className="tiny muted">{assessment.kind === 'milestone' ? 'Stages' : 'Latest'}</span><span className="big">{assessment.kind === 'milestone' ? `${assessment.doneCount} of ${assessment.stages.length}` : assessment.actual == null || g.kind === 'milestone' ? '—' : fmt(assessment.actual, g)}</span></div>
        <div><span className="tiny muted">Against plan</span><span className={'big tone-' + gap.tone}>{gap.short}</span></div>
      </div>

      <details className="disclose" open={g.kind !== 'milestone'}>
        <summary>Chart and stages</summary>
        {g.kind === 'metric' && assessment.kind === 'metric' && <figure style={{ margin: 0 }}><MetricChart goal={g} weeks={app.cycle.weeks} week={app.week} series={series} forecast={assessment.forecast} ptgBy={ptg?.byWeek ?? null} height={180} /><MetricLegend goal={g} forecast={assessment.forecast != null} ptg={!!ptg} /></figure>}
        {g.kind === 'range' && <RangeChart goal={g} weeks={app.cycle.weeks} week={app.week} series={series} height={170} />}
        {assessment.kind === 'milestone' && <StageList a={assessment} />}
      </details>

      {latest && latest.why && latest.why !== 'On plan.' && latest.why !== a.flags.find((f) => f.kind !== 'due')?.detail && (
        <section className="owner-says">
          <span className="label">{owner?.name.split(' ')[0]} says{latest.cause ? ` · ${causeLabel(latest.cause)}` : ''}</span>
          <p>{latest.why}</p>
          {latest.greenerWhy && <p className="small"><strong>Why greener:</strong> {latest.greenerWhy}</p>}
        </section>
      )}
      {ptg && (
        <section className="owner-says path">
          <span className="label">Path to green · back on plan by {weekLabel(ptg.byWeek, app.cycle.weeks)}{ptg.byWeek < app.week ? ' · missed' : ''}</span>
          <p>{ptg.what}</p>
          {ptg.needs && <p className="needs"><strong>Needs you:</strong> {ptg.needs}</p>}
        </section>
      )}


      {decisions.length > 0 && <div className="note-good small">{decisions.map((d) => DECISION_LABEL[d.kind] + (d.note ? `: “${d.note}”` : '')).join(' · ')}</div>}

      <div className="decide">
        {(asking || note) ? (
          <label className="field"><span className="small strong">{asking ? `Your question for ${owner?.name.split(' ')[0]}` : 'Note for the owner'}</span>
            <input className="input" autoFocus value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={asking ? 'e.g. What would it take to land the interim scope by week 8?' : 'Optional'} />
          </label>
        ) : <button type="button" className="linkish small" onClick={() => setNote(' ')} style={{ alignSelf: 'flex-start' }}>+ Add a note for the owner</button>}
        <div className="row decide-buttons">
          {proposal && g.kind === 'metric' ? (
            <>
              <button className="btn primary big-btn" disabled={busy} onClick={() => decide('approve-target')}>Approve {fmt(proposal.proposeTarget as number, g)}</button>
              <button className="btn big-btn" disabled={busy} onClick={() => decide('decline-target')}>Keep {fmt(g.plan.target, g)}</button>
            </>
          ) : g.pending ? (
            <>
              <button className="btn primary big-btn" disabled={busy} onClick={() => decide('approve-change')}>Approve change</button>
              <button className="btn big-btn" disabled={busy} onClick={() => decide('decline-change')}>Keep as is</button>
            </>
          ) : (
            <button className="btn primary big-btn" disabled={busy} onClick={() => decide('acknowledge')}>{handled ? 'Seen again' : 'Seen · no action'}</button>
          )}
          <button className="btn big-btn" disabled={busy} onClick={() => decide('ask')}>{asking ? 'Send question' : 'Ask a question'}</button>
          <button className="btn ghost" onClick={onSkip}>Skip for now</button>
        </div>
        <Link className="small linkish" to={'/goals/' + g.id}>Open the full goal page</Link>
      </div>
      {g.guardrail && <Tag>Guardrail</Tag>}
    </article>
  );
}
