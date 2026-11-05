import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, gapText, kindLabel, LEVEL_LABEL, weekLabel } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import { answeredSince, askText, canAnswer, openFor } from '../domain/requests';
import type { Change, Goal, HelpRequest, MetricGoal } from '../domain/types';
import { planHistoryOf } from '../domain/goal';
import { Avatar, Chip, Empty, FlagPill, LevelTag, Sheet, timeAgo, StatusShape } from '../ui/bits';
import { MetricChart, QuarterMark, quarterWords, RangeChart, StageList } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { isYear, quarterOf, quarterResults } from '../domain/year';
import { openUpdateAsk } from '../domain/updateAsks';
import { weekDates } from '../domain/plan';
import { ReviewBar, ReviewCallBar, TreeRow, TreeRows, useReview, WatchButton, worstFirst } from './Inspect';
import { RespondSheet } from './Respond';
import { criticalPath } from '../domain/map';
import { ancestors, forecastText, outcomeTrees, type TreeNode } from '../domain/tree';
import { Icon } from '../ui/Icon';
import { GoalBack } from '../ui/BackLink';

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
        {/* What was said in a review, said in place: the action, question or note, with who and by when (visual review 2). */}
        {c.entity === 'decision' && (() => {
          const said = c.diffs.find((d) => d.field === 'Action' || d.field === 'Question' || d.field === 'Note')?.to;
          const who = c.diffs.find((d) => d.field === 'Who')?.to;
          const due = c.diffs.find((d) => d.field === 'Due')?.to;
          return said ? <p className="note-text">{said}{who ? <span className="hint"> · {who}{due ? `, by ${due}` : ''}</span> : null}</p> : null;
        })()}
        <span className="tiny muted">{whenText(c.at, app.today)}</span>
        {diffs.length > 0 && c.entity !== 'note' && (
          <>
            <button className="linkish tiny" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide changes' : `Show ${diffs.length === 1 ? 'the change' : diffs.length + ' changes'}`}</button>
            {open && (
              <dl className="diffs">
                {diffs.map((d) => (
                  <div key={d.field} className="diff">
                    <dt>{d.field}</dt>
                    <dd>{d.from !== '—' && <del>{d.from}</del>}{d.from !== '—' && <span aria-hidden="true"> → </span>}{(() => {
                      // A status call is a status: its shape and word, in its own colour (design rules).
                      const k = d.field === 'Status call' ? (Object.keys(LABEL) as (keyof typeof LABEL)[]).find((x) => LABEL[x] === d.to) : undefined;
                      return k ? <ins className={'diff-status tone-' + k}><StatusShape k={k} />{d.to}</ins> : <ins>{d.to}</ins>;
                    })()}</dd>
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
  // What threatens this goal: its inputs that need attention, the one on the critical path first. Shown under the status.
  const needy = children.filter((c) => ['off', 'risk', 'stale'].includes(app.statusOf(c).status));
  const onPath = needy.length ? criticalPath(app.snapshot.goals, (g) => app.statusOf(g).status) : new Set<string>();
  const threats = [...needy].sort((a, b) => Number(onPath.has(b.id)) - Number(onPath.has(a.id)) || worstFirst(app)(a, b)).slice(0, 3);
  const threatIds = new Set(threats.map((g) => g.id));
  /** Why a goal is on the threats list, without repeating the reason its row already gives. */
  const threatWhy = (g: Goal) => {
    const at = app.attentionOf(g);
    const f = at.flags.find((x) => x.kind !== 'due');
    return [onPath.has(g.id) ? 'On the critical path' : '', at.status.status === 'stale' ? 'Last result unknown' : f ? f.label : LABEL[at.status.status]].filter(Boolean).join('. ') + '.';
  };
  const rv = useReview(goal.id);
  const fc = forecastText(goal, a, cycle.weeks);
  const series = valueSeries(own);
  const ptg = latest?.pathToGreen ?? null;
  const isOwner = app.viewer.id === goal.ownerId;
  const due = att.flags.some((f) => f.kind === 'due');
  const changes = app.snapshot.changes.filter((c) => c.goalId === goal.id).slice().reverse();
  const [params, setParams] = useSearchParams();
  const published = params.get("published") === "1";
  const [tab, setTab] = useState<'activity' | 'check-ins' | 'details'>(params.get('tab') === 'comments' ? 'activity' : 'check-ins');
  const [allCheckIns, setAllCheckIns] = useState(false);
  const [allChanges, setAllChanges] = useState(false);
  const flags = att.flags.filter((f) => f.kind !== 'due');
  // The status line already says off track or at risk, and the owner's note follows: show only flags that add something.
  const notes = flags.filter((f) => !['off', 'risk', 'stale'].includes(f.kind));
  const canEdit = isOwner || app.viewer.admin;
  // In a review, what was said in this session is listed by the review bar; don't show it twice.
  const asks = app.snapshot.decisions.filter((d) => d.goalId === goal.id && (d.kind === 'ask' || d.kind === 'action') && !(rv.active && d.reviewId === rv.review?.id && d.week === rv.session?.week)).slice(-3).reverse();
  const lastBy = latest ? app.person(latest.authorId) : undefined;

  const stale = st.status === 'stale';
  const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  // A request for an update stays visible ("Asked 2 hours ago") until the next check-in, rather than a passing toast.
  // Whoever asked can undo it (Senior UX review, finding 9); it's logged, and drops off the owner's Home.
  const asked = openUpdateAsk(goal.id, app.snapshot, latest?.postedAt ?? null);
  const [asking, setAsking] = useState(false);
  // Asking and undoing confirm the same way: in place, where the button was (not one inline and one as a toast).
  const [undone, setUndone] = useState(false);
  const askForUpdate = async () => {
    if (asking) return;
    setAsking(true); setUndone(false);
    try { await app.askForUpdate(goal); } catch { /* the save already said what went wrong */ } finally { setAsking(false); }
  };
  const undoAsk = async () => {
    if (asking) return;
    setAsking(true);
    try { await app.undoUpdateAsk(goal); setUndone(true); } catch { /* the save already said what went wrong */ } finally { setAsking(false); }
  };
  const ownerFirst = owner?.name.split(' ')[0] ?? 'the owner';
  // In a review, the page is compact: result, what changed, what's needed; the rest folds away.
  const compact = rv.active;
  const headlineNumber = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages done` : a.actual == null || goal.kind === 'milestone' ? 'No value yet' : fmt(a.actual, goal);

  return (
    <div className="page goal-page">
      <ReviewBar goalId={goal.id} />
      <GoalBack />
      {!compact && <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/goals">Goals</Link>
        {path.map((p) => <span key={p.id} className="row"><Icon name="chevron-right" className="muted" /><Link to={'/goals/' + p.id}>{p.title}</Link></span>)}
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
          {isOwner && week > 0 && <Link className={'btn' + (due && !(published && own.length === 0) ? ' primary' : '')} to={'/check-in/' + goal.id}>{due ? `Check in for week ${week}` : 'Check in now'}</Link>}
          {canEdit && <Link className="btn" to={`/goals/${goal.id}/edit`}>Edit</Link>}
          {!isOwner && <WatchButton goal={goal} />}
        </div>}
      </div>

      {published && own.length === 0 && (
        <section className="first-checkin" aria-label="First check-in">
          <span className="strong">“{goal.title}” is published.</span>
          {week < 1
            ? <span>Its first check-in is due in week 1, when the year starts.</span>
            : isOwner
              ? <><span>Post its first check-in now, so everyone can see where it stands from today.</span>
                  <span className="row"><Link className="btn primary" to={'/check-in/' + goal.id}>Post the first check-in</Link><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>
              : <><span>{owner?.name.split(' ')[0] ?? 'The owner'} posts its check-ins. Ask for the first one now?</span>
                  <span className="row"><button type="button" className="btn" disabled={asking} onClick={() => void askForUpdate().then(() => { app.toast(`Asked ${ownerFirst}. It’s on their Home until they check in.`); setParams({}, { replace: true }); })}>Ask {ownerFirst}</button><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>}
        </section>
      )}

      {parent && goal.whyHelps && <p className="small muted why-helps">Feeds “{parent.title}”: {goal.whyHelps}</p>}

      {/* Status first; then, on a wide screen, the evidence on the left and the owner's account beside it. */}
      <div className="goal-grid split">
      <div className="goal-head split-a">
      <section className="story" data-tone={st.status}>
        <div className="statusline">
          <Chip k={st.status} />
          {stale ? <span className="big">Current performance unknown</span> : <span className="big">{headlineNumber}</span>}
          {!stale && <span className={'strong tone-' + gap.tone}>{gap.short}</span>}
        </div>
        {stale
          ? <span className="small">{latest ? `Last reported: ${headlineNumber} in week ${latest.week} (${dateText(latest.postedAt)}), ${st.daysSinceCheckIn} days ago.` : 'Nothing reported yet.'} Without a newer check-in, the status and any projection can’t be trusted.</span>
          : a.kind === 'metric' && goal.kind === 'metric' && latest ? <span className="hint">{gap.long}.</span> : null}
        {stale && !isOwner && (asked
          ? <span className="small asked-line" role="status"><span className="strong">Asked {ownerFirst} for an update {timeAgo(asked.at, app.today)}{asked.actorId !== app.viewer.id ? ` (${app.person(asked.actorId)?.name.split(' ')[0] ?? 'someone'})` : ''}.</span> It’s on their Home until they check in.{asked.actorId === app.viewer.id && <> <button type="button" className="linkish" disabled={asking} onClick={() => void undoAsk()}>Undo</button></>}</span>
          : <div className="row" style={{ gap: 'var(--s3)' }}><button type="button" className="btn sm" disabled={asking} onClick={() => void askForUpdate()}>Ask {ownerFirst} for an update</button><span className="small" role="status">{undone ? 'Undone. It’s off their Home.' : ''}</span></div>)}
        {fc && !stale && <span className={fc.warn ? 'forecast small' : 'hint'}>{fc.warn && <Icon name="trend-down" />}{fc.warn && (st.status === 'on' || st.status === 'done') ? 'On track means on plan this week. ' : ''}{fc.text}</span>}
        {!stale && <span className="hint">{latest ? `From the week ${latest.week} check-in, checked in by ${lastBy?.name} ${timeAgo(latest.postedAt, app.today)}.` : 'No check-ins yet.'}</span>}
      </section>
      </div>
      {/* The side column comes before the threats in the page's order, so a request is reached (and, on a phone, seen) first. */}
      <div className="goal-rail split-side">

      {/* Requests for a decision or help: open until answered or withdrawn, answered once for every goal waiting on it. */}
      <Requests goal={goal} compact={compact} behind={st.status === 'risk' || st.status === 'off'} since={latest?.postedAt ?? null} />

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
              <span className="field-label">{ptg.byWeek != null ? <>Owner’s date: back on plan by {weekLabel(ptg.byWeek, cycle.weeks)}{ptg.state === 'help' ? ', once the decision or help arrives' : ''}{ptg.byWeek < week && (st.status === 'risk' || st.status === 'off') ? ' (missed)' : ''}</> : ptg.state === 'investigating' ? 'Still investigating; no recovery date yet' : ptg.state === 'help' ? 'No date until the decision or help arrives' : ptg.state === 'target' ? 'The owner thinks the target should change' : 'No recovery date yet'}</span>
              {/* A decision request is shown once, above; here it's the date that matters. */}
              <p>{ptg.state === 'help' && openFor(goal.id, app.snapshot).length > 0 && (st.status === 'risk' || st.status === 'off') ? 'Waiting on the decision or help above.' : ptg.what}</p>
            </div>
          )}
        </section>
      )}
      </div>
      <div className="goal-evidence split-b">
      {threats.length > 0 && (
        <section className="block threats" aria-label="Most likely to make it miss">
          <div className="row between"><h2 className="block-title">Most likely to make it miss</h2><span className="hint">{needy.length} of {children.length} contributing {children.length === 1 ? 'goal needs' : 'goals need'} attention</span></div>
          {/* The row already says what's wrong; the line under it says only why it's on this list. */}
          <ul className="tree">{threats.map((g) => <li key={g.id} className="threat"><TreeRow g={g} /><span className="hint threat-why">Why it’s here: {threatWhy(g)}</span></li>)}</ul>
          {children.length > threats.length && <Link className="linkish small" to={`/goals?feeds=${goal.id}`}>See all {children.length} contributing goals</Link>}
        </section>
      )}

      {(() => { const chart = (<section className="block">
        {goal.kind === 'metric' && a.kind === 'metric' && (
          <figure className="card goal-chart" style={{ margin: 0 }}>
            <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={stale ? null : a.forecast} ptgBy={stale ? null : ptg?.byWeek ?? null} />
            {goal.originalPlan && <PlanChanges goal={goal} />}
          </figure>
        )}
        {goal.kind === 'range' && <figure className="card goal-chart" style={{ margin: 0 }}><RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} /></figure>}
        {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
      </section>);
        return compact ? <details className="disclose"><summary>Chart and check-ins</summary>{chart}<CheckInList goal={goal} /></details> : chart; })()}

      {!compact && isYear(cycle) && <QuarterStrip goal={goal} />}

      {children.length > 0 && compact && (
        <details className="disclose"><summary>Contributing goals · {children.length}{children.some((c) => ['off', 'risk', 'stale'].includes(app.statusOf(c).status)) ? ` · ${children.filter((c) => ['off', 'risk', 'stale'].includes(app.statusOf(c).status)).length} need attention` : ''}</summary><TreeRows nodes={subtree.children} /></details>
      )}
      {children.length > 0 && !compact && (
        <section className="block">
          <h2 className="block-title">Contributing goals</h2>
          {/* How they stand, in words with their shapes, not a bar of colour. */}
          <div className="row between contrib-counts">
            <span className="status-counts">
              {(['off', 'risk', 'stale', 'on', 'done', 'planned'] as const).map((k) => { const n = children.filter((c) => app.statusOf(c).status === k).length; return n ? <span key={k} className={'status-count tone-' + k}><StatusShape k={k} />{n} {LABEL[k]}</span> : null; })}
            </span>
            <span className="hint">Worst first</span>
          </div>
          {/* The ones already listed as most likely to make it miss are marked, not described twice. */}
          <ul className="tree">
            {subtree.children.map((n) => <li key={n.goal.id} className={threatIds.has(n.goal.id) ? 'listed-above' : undefined}><TreeRow g={n.goal} />{n.children.length > 0 && <TreeRows nodes={n.children} depth={1} />}</li>)}
          </ul>
        </section>
      )}

      {!compact && <section className="block">
        <div className="seg tabs" role="tablist" aria-label="More about this goal">
          {([['check-ins', 'Check-ins', own.length], ['activity', 'Comments and changes', changes.length], ['details', 'Details', 0]] as const).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className="tabcount">{n}</span> : null}</button>
          ))}
        </div>
        {tab === 'activity' && <NoteComposer goal={goal} />}
        {tab === 'activity' && (changes.length ? <>
          <ol className="changes">{changes.slice(0, allChanges ? undefined : 8).map((c) => <ChangeItem key={c.id} c={c} />)}</ol>
          {changes.length > 8 && !allChanges && <button type="button" className="linkish small show-all" onClick={() => setAllChanges(true)}>Show all {changes.length}</button>}
        </> : <p className="small muted">No changes yet.</p>)}
        {tab === 'check-ins' && (own.length ? (<>
          <ol className="cilist">
            {[...own].reverse().slice(0, allCheckIns ? undefined : 8).map((c) => (
              <li key={c.id}>
                <span className="strong ci-week"><span className="nowrap">Week {c.week}</span>{own.filter((x) => x.week === c.week).length > 1 ? <span className="hint ci-date">{new Date(c.postedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span> : null}</span>
                <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
                <Chip k={c.status} />
                {c.why && c.why !== 'On plan.' && <span className="small cilist-why">{c.why}</span>}
              </li>
            ))}
          </ol>
          {own.length > 8 && !allCheckIns && <button type="button" className="linkish small show-all" onClick={() => setAllCheckIns(true)}>Show all {own.length} check-ins</button>}
        </>) : <p className="small muted">No check-ins yet.</p>)}
        {tab === 'details' && goal.kind === 'metric' && <PlanTable plan={goal.plan} unit={goal} actuals={own} label="Plan and actual by week" />}
        {tab === 'details' && (
          <dl className="details">
            <dt>Kind</dt><dd>{kindLabel(goal)}</dd>
            {goal.definition && <><dt>Definition</dt><dd>{goal.definition}</dd></>}
            {goal.kind === 'metric' && <><dt>Measure</dt><dd>{fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)} by week {goal.plan.endWeek ?? cycle.weeks} ({weekDates(cycle, goal.plan.endWeek ?? cycle.weeks)}){(goal.plan.endWeek ?? 0) > cycle.weeks ? ', past this cycle' : ''}, {directionLabel(goal)}</dd><dt>Plan</dt><dd>{goal.plan.points?.length ? 'Numbers set by hand' : goal.plan.shape === 'back' ? 'Back-loaded' : goal.plan.shape === 'stepped' ? 'Three steps' : 'Straight line'}</dd></>}
            {goal.kind === 'range' && <><dt>Measure</dt><dd>{directionLabel(goal)}, warning margin {fmt(goal.range.margin, goal)}</dd></>}
            {goal.kind === 'milestone' && <><dt>Stages</dt><dd>{goal.stages.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ')}</dd></>}
            <dt>Level</dt><dd>{LEVEL_LABEL[goal.level]}{goal.level !== 'team' ? ', reported at major reviews' : ''}</dd>
            <dt>Feeds into</dt><dd>{parent ? parent.title + (goal.effect != null ? `, estimated effect ${goal.effect}` : '') : children.length ? 'Nothing: it sits at the top of its tree' : 'Nothing yet (not linked)'}</dd>
            <dt>Data source</dt><dd>{goal.source || 'Entered by the owner'}</dd>
            <dt>Rules</dt><dd>{goal.kind === 'metric' ? 'On track at 95% of planned progress or more; at risk from 80%. Reason needed when behind or 20% ahead.' : goal.kind === 'range' ? 'At risk inside the margin or after one breach; off track after two weeks out.' : 'Up to 2 weeks late is at risk; more is off track.'}</dd>
          </dl>
        )}
      </section>}
      </div>
      </div>
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
        <textarea id={'note-' + goal.id} className="input" rows={text ? 2 : 1} value={text} onChange={(e) => setText(e.target.value)} placeholder={app.viewer.id === goal.ownerId ? 'Say why something changed' : 'Comment or ask a question'} aria-label="Add a comment" />
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
          <span className="strong ci-week"><span className="nowrap">Week {c.week}</span></span>
          <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
          <Chip k={c.status} />
          {c.why && c.why !== 'On plan.' && <span className="small cilist-why">{c.why}</span>}
        </li>
      ))}
    </ol>
  );
}

/** The year by quarter: each quarter's plan for this goal, and whether it was met. */
function QuarterStrip({ goal }: { goal: Goal }) {
  const app = useApp();
  const now = quarterOf(app.cycle, app.week).n;
  const rs = quarterResults(goal, app.cycle, app.snapshot.checkIns, app.week);
  if (rs.every((r) => r.kind === 'none')) return null;
  return (
    <section className="block" aria-label="This year by quarter">
      <h2 className="block-title">This year by quarter</h2>
      <ol className="quarters">
        {rs.map((r) => (
          <li key={r.quarter.n} className={'q-' + r.kind + (r.quarter.n === now ? ' q-now' : '')}>
            <span className="q-head"><span className="strong">{r.quarter.label} <span className="hint nowrap">{r.quarter.months}</span></span>
              <span className="q-result"><QuarterMark kind={r.kind} done={r.quarter.n === now ? (app.week - r.quarter.from + 1) / (r.quarter.to - r.quarter.from + 1) : 0} />{r.kind === 'met' ? 'Met' : r.kind === 'missed' ? 'Missed' : r.kind === 'open' ? (r.quarter.n === now ? 'Now' : 'To come') : 'None due'}</span></span>
            {r.kind !== 'none' && <span className="small">{quarterWords(r.text)}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Under the chart: the latest plan change, and where the target started if it has changed more than once. */
function PlanChanges({ goal }: { goal: MetricGoal }) {
  const history = planHistoryOf(goal);
  const last = history.at(-1);
  if (!last) return null;
  const what = last.plan.target !== goal.plan.target ? `Target changed in week ${last.untilWeek}: ${fmt(last.plan.target, goal)} → ${fmt(goal.plan.target, goal)}.` : `Plan changed in week ${last.untilWeek}.`;
  const first = history.length > 1 ? ` It was first set at ${fmt(history[0]!.plan.target, goal)}, and has changed ${history.length} times.` : '';
  return <figcaption className="tiny muted">{what}{first} The original plan is dotted; earlier weeks and closed quarters are judged against the plan of their day.</figcaption>;
}

/**
 * The goal's requests for a decision or help: each with who asked whom and when, Respond for the person asked (and
 * admins), Withdraw for the owner, the answer once given, and, for an owner whose goal is behind, a way to say it's
 * waiting on a request already raised for another goal.
 */
function Requests({ goal, compact, behind, since }: { goal: Goal; compact: boolean; behind: boolean; since: string | null }) {
  const app = useApp();
  const [responding, setResponding] = useState<HelpRequest | null>(null);
  const [linking, setLinking] = useState(false);
  const open = openFor(goal.id, app.snapshot);
  const answered = answeredSince(goal.id, since, app.snapshot);
  const isOwner = goal.ownerId === app.viewer.id;
  const others = (app.snapshot.requests ?? []).filter((r) => r.status === 'open' && !r.goalIds.includes(goal.id));
  if (!open.length && !answered && !(isOwner && behind && others.length)) return null;
  const first = (id: string | null) => (id ? app.person(id)?.name.split(' ')[0] ?? 'someone' : 'anyone');
  return (
    <>
      {open.map((r) => {
        const linked = r.goalIds[0] !== goal.id;
        return (
          <section key={r.id} className="request-block" aria-label="Decision or help needed">
            <span className="field-label">Decision or help needed{r.recipientId ? ` from ${app.person(r.recipientId)?.name ?? 'someone'}` : ''}</span>
            <p className="strong">{r.ask}</p>
            <span className="hint">{linked ? <>The same request as <Link className="linkish" to={'/goals/' + r.goalIds[0]}>{app.goal(r.goalIds[0]!)?.title}</Link>, asked by {first(r.askedBy)} </> : <>Asked by {first(r.askedBy)} </>}{timeAgo(r.createdAt, app.today)}. Open until it’s answered{r.goalIds.length > 1 ? `; ${r.goalIds.length} goals are waiting on it` : ''}.</span>
            {(canAnswer(r, app.viewer) || (!compact && (isOwner || app.viewer.admin))) && (
              <div className="row request-actions">
                {canAnswer(r, app.viewer) && <button type="button" className="btn sm" onClick={() => setResponding(r)}>Respond</button>}
                {!compact && (isOwner || app.viewer.admin) && <button type="button" className="btn sm" onClick={() => void app.withdrawRequest(r, goal).then(() => app.toast(linked ? 'No longer waiting on that request' : 'Request withdrawn'))}>{linked ? 'Not waiting on it any more' : 'Withdraw'}</button>}
              </div>
            )}
          </section>
        );
      })}
      {answered && (
        <section className="request-block answered" aria-label="Request answered">
          <span className="field-label">Answered by {app.person(answered.answeredBy ?? '')?.name ?? 'someone'} {timeAgo(answered.answeredAt ?? '', app.today)}</span>
          <p className="strong">{answered.answer}</p>
          <span className="hint">The request: “{answered.ask}”. {isOwner ? 'Your next check-in says what it changes.' : 'The owner’s next check-in says what it changes.'}</span>
        </section>
      )}
      {isOwner && behind && !compact && others.length > 0 && <button type="button" className="linkish small" style={{ alignSelf: 'flex-start' }} onClick={() => setLinking(true)}>Waiting on a decision already asked for another goal?</button>}
      {responding && <RespondSheet request={responding} onClose={() => setResponding(null)} />}
      {linking && (
        <Sheet open onClose={() => setLinking(false)} title="Waiting on the same decision">
          <div className="stack" style={{ gap: 'var(--s3)' }}>
            <span className="hint">Link {goal.title} to a request already raised, so it’s asked and answered once. Any open request of yours to the same person is withdrawn.</span>
            <div className="optlist">{others.map((r) => (
              <button key={r.id} type="button" className="opt" onClick={() => void app.linkRequest(r, goal).then(() => { setLinking(false); app.toast('Linked: one answer will cover both goals'); })}>
                <span className="stack" style={{ gap: 2 }}><span className="strong">{askText(r, app.snapshot.people)}</span><span className="hint">For {r.goalIds.map((id) => app.goal(id)?.title).filter(Boolean).join(', ')} · asked by {first(r.askedBy)} {timeAgo(r.createdAt, app.today)}</span></span>
              </button>
            ))}</div>
          </div>
        </Sheet>
      )}
    </>
  );
}
