import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, gapText, kindLabel, LEVEL_LABEL, weekLabel } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import type { Change, Goal } from '../domain/types';
import { Avatar, Chip, Empty, FlagPill, LevelTag, timeAgo } from '../ui/bits';
import { MetricChart, MetricLegend, RangeChart, StageList } from '../ui/charts';
import { ReviewBar, ReviewCallBar, TreeRows, useReview, WatchButton, worstFirst } from './Inspect';
import { ancestors, forecastText, outcomeTrees, type TreeNode } from '../domain/tree';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  return <GoalView key={goal.id} goal={goal} />;
}

/** "3 h ago (30 Oct, 18:02)" for recent changes; just the date and time for older ones. */
function whenText(iso: string, now: Date) {
  const abs = new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rel = timeAgo(iso, now);
  return /ago|now|yesterday/.test(rel) ? `${rel} (${abs})` : abs;
}

export function ChangeItem({ c, showGoal }: { c: Change; showGoal?: boolean }) {
  const app = useApp();
  const who = app.person(c.actorId);
  const [open, setOpen] = useState(false);
  const goal = c.goalId ? app.goal(c.goalId) : undefined;
  const diffs = c.diffs.filter((d) => d.field !== 'Note' || c.entity === 'decision');
  return (
    <li className={'change change-' + c.entity}>
      <Avatar p={who ?? { name: c.actorId, initials: '?' }} size="sm" />
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <span className="small"><strong>{who?.name ?? c.actorId}</strong> {c.summary.charAt(0).toLowerCase() + c.summary.slice(1)}{showGoal && goal ? <> on <Link className="linkish" to={'/goals/' + goal.id}>{goal.title}</Link></> : null}</span>
        {c.entity === 'note' && <p className="note-text">{c.diffs[0]?.to}</p>}
        <span className="tiny muted">{whenText(c.at, app.today)}</span>
        {diffs.length > 0 && c.entity !== 'note' && (
          <>
            <button className="linkish tiny" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide changes' : `Show ${diffs.length === 1 ? 'the change' : diffs.length + ' changes'}`}</button>
            {open && (
              <dl className="diffs">
                {diffs.map((d) => (
                  <div key={d.field} className="diff">
                    <dt>{d.field}</dt>
                    <dd>{d.from !== '—' && <del>{d.from}</del>}{d.from !== '—' && <span aria-hidden="true"> → </span>}<ins>{d.to}</ins></dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const att = app.attentionOf(goal);
  const st = att.status;
  const own = app.checkInsOf(goal);
  const latest = st.latest;
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const gap = gapText(goal, a);
  const owner = app.person(goal.ownerId);
  const team = app.team(goal.teamId);
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const path = ancestors(goal, app.snapshot.goals);
  const subtree = outcomeTrees(app.snapshot.goals, worstFirst(app)).trees.flatMap(function find(n): TreeNode[] { return n.goal.id === goal.id ? [n] : n.children.flatMap(find); })[0]
    ?? { goal, children: app.snapshot.goals.filter((g) => g.parentId === goal.id).map((c) => ({ goal: c, children: [] })) };
  const children = subtree.children.map((n) => n.goal);
  const rv = useReview(goal.id);
  const fc = forecastText(goal, a, cycle.weeks);
  const series = valueSeries(own);
  const ptg = latest?.pathToGreen ?? null;
  const isOwner = app.viewer.id === goal.ownerId;
  const due = att.flags.some((f) => f.kind === 'due');
  const changes = app.snapshot.changes.filter((c) => c.goalId === goal.id).slice().reverse();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'activity' | 'check-ins' | 'details'>(params.get('tab') === 'comments' ? 'activity' : 'check-ins');
  const flags = att.flags.filter((f) => f.kind !== 'due');
  // The status line already says off track or at risk, and the owner's note follows: show only flags that add something.
  const notes = flags.filter((f) => !['off', 'risk', 'stale'].includes(f.kind));
  const canEdit = isOwner || app.viewer.admin;
  const asks = app.snapshot.decisions.filter((d) => d.goalId === goal.id && (d.kind === 'ask' || d.kind === 'action')).slice(-3).reverse();
  const lastBy = latest ? app.person(latest.authorId) : undefined;

  const stale = st.status === 'stale';
  const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const askForUpdate = async () => {
    await app.addNote(goal, `${owner?.name.split(' ')[0] ?? 'Hi'}, could you post an update? The last check-in was week ${latest?.week ?? '–'}.`);
    app.toast(`Asked ${owner?.name.split(' ')[0] ?? 'the owner'}. It’s on their Home under For you.`);
  };
  // In a review, the page is compact: result, what changed, what's needed; the rest folds away.
  const compact = rv.active;
  const headlineNumber = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages done` : a.actual == null || goal.kind === 'milestone' ? 'No value yet' : fmt(a.actual, goal);

  return (
    <div className="page">
      <ReviewBar goalId={goal.id} />
      {!compact && <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/goals">Goals</Link>
        {path.map((p) => <span key={p.id} className="row" style={{ gap: 'var(--s1)' }}><span aria-hidden="true">›</span><Link to={'/goals/' + p.id}>{p.title}</Link></span>)}
      </nav>}
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="stack" style={{ gap: 6, minWidth: 0 }}>
          <h1 className="title-xl">{goal.title}</h1>
          <span className="row hint" style={{ gap: 'var(--s2)' }}>
            <Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" />{owner?.name}{team ? `, ${team.name}` : ''}
            <LevelTag level={goal.level} />
          </span>
        </span>
        {!compact && <div className="actions">
          {isOwner && week > 0 && <Link className={'btn' + (due ? ' primary' : '')} to={'/check-in/' + goal.id}>{due ? `Check in for week ${week}` : 'Post an update'}</Link>}
          {canEdit && <Link className="btn" to={`/goals/${goal.id}/edit`}>Edit</Link>}
          {!isOwner && <WatchButton goal={goal} />}
        </div>}
      </div>

      <section className="story" data-tone={st.status}>
        <div className="statusline">
          <Chip k={st.status} />
          {stale ? <span className="big">Current performance unknown</span> : <span className="big">{headlineNumber}</span>}
          {!stale && <span className={'strong tone-' + gap.tone}>{gap.short}</span>}
        </div>
        {stale
          ? <span className="small">{latest ? `Last reported: ${headlineNumber} in week ${latest.week} (${dateText(latest.postedAt)}), ${st.daysSinceCheckIn} days ago.` : 'Nothing reported yet.'} Without a newer check-in, the status and any projection can’t be trusted.</span>
          : a.kind === 'metric' && goal.kind === 'metric' && latest ? <span className="hint">{gap.long}.</span> : null}
        {stale && !isOwner && <div><button type="button" className="btn sm" onClick={() => void askForUpdate()}>Ask {owner?.name.split(' ')[0] ?? 'the owner'} for an update</button></div>}
        {fc && !stale && <span className={fc.warn ? 'forecast small' : 'hint'}>{fc.warn && <span aria-hidden="true">↘ </span>}{fc.text}</span>}
        {!stale && <span className="hint">{latest ? `From the week ${latest.week} check-in, checked in by ${lastBy?.name} ${timeAgo(latest.postedAt, app.today)}.` : 'No check-ins yet.'}</span>}
      </section>

      {ptg?.needs && !stale && (st.status === 'risk' || st.status === 'off') && (
        <section className="request-block" aria-label="Decision or help needed">
          <span className="field-label">Decision or help needed</span>
          <p className="strong">{ptg.needs}</p>
          <span className="hint">From {owner?.name.split(' ')[0]}’s week {latest?.week} check-in.</span>
        </section>
      )}

      {asks.length > 0 && (
        <section className="why" aria-label="From reviews">
          {asks.map((d) => {
            const r = app.snapshot.reviews.find((x) => x.id === d.reviewId);
            return (
              <div key={d.id} className="quote-block" data-tone="info">
                <span className="field-label">{d.kind === 'ask' ? 'Question' : 'Action'} from {r?.name ?? 'a review'}, {app.person(d.byId)?.name.split(' ')[0]}</span>
                <p>{d.note}</p>
                {isOwner && d.kind === 'ask' && <span className="hint">Answer with a comment below, or in your next check-in.</span>}
              </div>
            );
          })}
        </section>
      )}

      {(notes.length > 0 || (latest?.why && latest.why !== 'On plan.') || ptg) && (
        <section className="why" aria-label="What’s going on">
          {notes.map((f) => (
            <p key={f.kind} className="note-line" data-tone={f.tone}><FlagPill f={f} /> <span>{f.detail}</span></p>
          ))}
          {latest?.why && latest.why !== 'On plan.' && (
            <div className="quote-block">
              <span className="field-label">{owner?.name.split(' ')[0]} said in week {latest.week}</span>
              <p>{latest.cause && <strong>{causeLabel(latest.cause)}. </strong>}{latest.why}</p>
            </div>
          )}
          {ptg && (
            <div className="quote-block">
              <span className="field-label">{ptg.byWeek != null ? <>Back on plan by {weekLabel(ptg.byWeek, cycle.weeks)}{ptg.byWeek < week && (st.status === 'risk' || st.status === 'off') ? ' (missed)' : ''}</> : ptg.state === 'investigating' ? 'Still investigating; no recovery date yet' : ptg.state === 'help' ? 'Needs a decision or help before there’s a date' : ptg.state === 'target' ? 'The owner thinks the target should change' : 'No recovery date yet'}</span>
              <p>{ptg.what}</p>
            </div>
          )}
        </section>
      )}

      {(() => { const chart = (<section className="block">
        {goal.kind === 'metric' && a.kind === 'metric' && (
          <figure className="card" style={{ margin: 0 }}>
            <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={stale ? null : a.forecast} ptgBy={stale ? null : ptg?.byWeek ?? null} />
            <MetricLegend goal={goal} forecast={!stale && a.forecast != null} ptg={!!ptg && ptg.byWeek != null && ptg.byWeek > (series[series.length - 1]?.week ?? 0)} />
            {goal.originalPlan && <figcaption className="tiny muted">Target changed in week {goal.rebaselinedWeek}: {fmt(goal.originalPlan.target, goal)} → {fmt(goal.plan.target, goal)}. The original plan is dotted.</figcaption>}
          </figure>
        )}
        {goal.kind === 'range' && <figure className="card" style={{ margin: 0 }}><RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} /></figure>}
        {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
      </section>);
        return compact ? <details className="disclose"><summary>Chart and check-ins</summary>{chart}<CheckInList goal={goal} /></details> : chart; })()}

      {children.length > 0 && compact && (
        <details className="disclose"><summary>Contributing goals · {children.length}{children.some((c) => ['off', 'risk', 'stale'].includes(app.statusOf(c).status)) ? ` · ${children.filter((c) => ['off', 'risk', 'stale'].includes(app.statusOf(c).status)).length} need attention` : ''}</summary><TreeRows nodes={subtree.children} /></details>
      )}
      {children.length > 0 && !compact && (
        <section className="block">
          <div className="row between"><h2 className="block-title">Feeding this goal</h2><span className="hint">Worst first</span></div>
          <div className="mix" role="img" aria-label={(['off', 'risk', 'stale', 'on', 'done'] as const).map((k) => `${children.filter((c) => app.statusOf(c).status === k).length} ${LABEL[k].toLowerCase()}`).join(', ')}>
            {(['off', 'risk', 'stale', 'on', 'done'] as const).map((k) => { const n = children.filter((c) => app.statusOf(c).status === k).length; return n ? <i key={k} className={'mix-' + k} style={{ flexGrow: n }} /> : null; })}
          </div>
          <TreeRows nodes={subtree.children} />
        </section>
      )}

      {!compact && <section className="block">
        <div className="seg tabs" role="tablist" aria-label="More about this goal">
          {([['check-ins', 'Check-ins', own.length], ['activity', 'Comments and changes', changes.length], ['details', 'Details', 0]] as const).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className="tabcount">{n}</span> : null}</button>
          ))}
        </div>
        {tab === 'activity' && <NoteComposer goal={goal} />}
        {tab === 'activity' && (changes.length ? <ol className="changes">{changes.map((c) => <ChangeItem key={c.id} c={c} />)}</ol> : <p className="small muted">No changes yet.</p>)}
        {tab === 'check-ins' && (own.length ? (
          <ol className="cilist">
            {[...own].reverse().map((c) => (
              <li key={c.id}>
                <span className="strong">Week {c.week}</span>
                <span>{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
                <Chip k={c.status} />
                {c.why && c.why !== 'On plan.' && <span className="small cilist-why">{c.why}</span>}
              </li>
            ))}
          </ol>
        ) : <p className="small muted">No check-ins yet.</p>)}
        {tab === 'details' && (
          <dl className="details">
            <dt>Kind</dt><dd>{kindLabel(goal)}</dd>
            {goal.definition && <><dt>Definition</dt><dd>{goal.definition}</dd></>}
            {goal.kind === 'metric' && <><dt>Measure</dt><dd>{fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)} by week {cycle.weeks}, {directionLabel(goal)}</dd><dt>Plan</dt><dd>{goal.plan.shape === 'back' ? 'Back-loaded' : goal.plan.shape === 'stepped' ? 'Three steps' : 'Straight line'}</dd></>}
            {goal.kind === 'range' && <><dt>Measure</dt><dd>{directionLabel(goal)}, warning margin {fmt(goal.range.margin, goal)}</dd></>}
            {goal.kind === 'milestone' && <><dt>Stages</dt><dd>{goal.stages.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ')}</dd></>}
            <dt>Level</dt><dd>{LEVEL_LABEL[goal.level]}{goal.level !== 'team' ? ', reported at major reviews' : ''}</dd>
            <dt>Feeds into</dt><dd>{parent ? parent.title + (goal.effect != null ? `, estimated effect ${goal.effect}` : '') : children.length ? 'Nothing: it sits at the top of its tree' : 'Nothing yet (not linked)'}</dd>
            <dt>Data source</dt><dd>{goal.source || 'Entered by the owner'}</dd>
            <dt>Rules</dt><dd>{goal.kind === 'metric' ? 'On track at 95% of planned progress or more; at risk from 80%. Reason needed when behind or 20% ahead.' : goal.kind === 'range' ? 'At risk inside the margin or after one breach; off track after two weeks out.' : 'Up to 2 weeks late is at risk; more is off track.'}</dd>
          </dl>
        )}
      </section>}
      {rv.active && <ReviewCallBar goal={goal} />}
    </div>
  );
}

/** A comment: why something changed, a question, anything worth knowing that isn't a check-in. Anyone can comment; it's logged. */
function NoteComposer({ goal }: { goal: Goal }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const post = async () => {
    if (text.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      await app.addNote(goal, text);
      setText('');
      app.toast('Comment posted');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="note-compose" onSubmit={(e) => { e.preventDefault(); void post(); }}>
      <label className="field"><span className="sr">Add a comment</span>
        <textarea className="input" rows={text ? 2 : 1} value={text} onChange={(e) => setText(e.target.value)} placeholder={app.viewer.id === goal.ownerId ? 'Say why something changed' : 'Comment or ask a question'} aria-label="Add a comment" />
      </label>
      {text.trim() && <button className="btn" type="submit" disabled={saving}>{saving ? 'Posting…' : 'Post comment'}</button>}
    </form>
  );
}

/** The goal's check-ins, newest first, for the folded-away history in a review. */
function CheckInList({ goal }: { goal: Goal }) {
  const app = useApp();
  const own = app.checkInsOf(goal);
  if (!own.length) return <p className="small muted">No check-ins yet.</p>;
  return (
    <ol className="cilist">
      {[...own].reverse().map((c) => (
        <li key={c.id}>
          <span className="strong">Week {c.week}</span>
          <span>{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
          <Chip k={c.status} />
          {c.why && c.why !== 'On plan.' && <span className="small cilist-why">{c.why}</span>}
        </li>
      ))}
    </ol>
  );
}
