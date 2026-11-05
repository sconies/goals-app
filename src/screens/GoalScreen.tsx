import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt, gapBeside, kindLabel, LEVEL_LABEL, NO_VALUE } from '../domain/format';
import { valueSeries } from '../domain/plan';
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import { answeredSince, askText, canAnswer, openFor } from '../domain/requests';
import type { CheckIn, DisplayStatus, Goal, HelpRequest, MetricGoal } from '../domain/types';
import { summaryFacts } from '../domain/summaryFacts';
import { storyOf } from '../domain/story';
import { planHistoryOf } from '../domain/goal';
import { Avatar, Chip, Empty, FlagPill, LevelTag, Sheet, timeAgo, StatusShape } from '../ui/bits';
import { MetricChart, QuarterMark, quarterWords, RangeChart, StageList } from '../ui/charts';
import { PlanTable } from '../ui/PlanTable';
import { isYear, quarterOf, quarterResults } from '../domain/year';
import { openUpdateAsk } from '../domain/updateAsks';
import { weekDates } from '../domain/plan';
import { ReviewBar, ReviewCallBar, useReview } from './Inspect';
import { GoalRow, TreeRows, WatchButton } from '../ui/goalRows';
import { ChangeItem, whenText } from '../ui/ChangeItem';
import { worstFirst } from '../domain/order';
import { RespondSheet } from './Respond';
import { criticalPath } from '../domain/map';
import { ancestors, outcomeTrees, type TreeNode } from '../domain/tree';
import { Icon } from '../ui/Icon';
import { GoalBack } from '../ui/BackLink';
import { CountNumber } from '../ui/Count';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  return <GoalView key={goal.id} goal={goal} />;
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const att = app.attentionOf(goal);
  const st = att.status;
  const own = app.checkInsOf(goal);
  const latest = st.latest;
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  // The gap beside the number, left out when it would only say "No value yet" again.
  const gap = gapBeside(goal, a);
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
  const series = valueSeries(own);
  const ptg = latest?.pathToGreen ?? null;
  const isOwner = app.viewer.id === goal.ownerId;
  const due = att.flags.some((f) => f.kind === 'due');
  const changes = app.snapshot.changes.filter((c) => c.goalId === goal.id).slice().reverse();
  const [params, setParams] = useSearchParams();
  const published = params.get("published") === "1";
  const [tab, setTab] = useState<'activity' | 'check-ins' | 'details'>(params.get('tab') === 'comments' ? 'activity' : 'check-ins');
  const [allChanges, setAllChanges] = useState(false);
  const flags = att.flags.filter((f) => f.kind !== 'due');
  // The status line already says off track or at risk, and the owner's note follows: show only flags that add something.
  const notes = flags.filter((f) => !['off', 'risk', 'stale'].includes(f.kind));
  const canEdit = isOwner || app.viewer.admin;
  // In a review, what was said in this session is listed by the review bar; don't show it twice.
  const asks = app.snapshot.decisions.filter((d) => d.goalId === goal.id && (d.kind === 'ask' || d.kind === 'action') && !(rv.active && d.reviewId === rv.review?.id && d.week === rv.session?.week)).slice(-3).reverse();

  const stale = st.status === 'stale';
  const behind = st.status === 'risk' || st.status === 'off';
  const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  // The four facts the page leads with, and the owner's path to green: worked out once, in the domain.
  const summary = summaryFacts(goal, cycle, app.snapshot.checkIns, week, stale);
  const story = storyOf(goal, app.snapshot, cycle, week, app.today);
  const source = summary.source;
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
  const headlineNumber = a.kind === 'milestone' ? `${a.doneCount} of ${a.stages.length} stages done` : a.actual == null || goal.kind === 'milestone' ? NO_VALUE : fmt(a.actual, goal);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ownerSays = latest?.why && latest.why !== 'On plan.' ? latest : null;

  const chart = (
    <>
      {goal.kind === 'metric' && a.kind === 'metric' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={stale ? null : a.forecast} ptgBy={stale ? null : ptg?.byWeek ?? null} />
          {goal.originalPlan && <PlanChanges goal={goal} />}
        </figure>
      )}
      {goal.kind === 'range' && <figure className="card goal-chart" style={{ margin: 0 }}><RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} /></figure>}
      {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
    </>
  );

  return (
    <div className="page goal-page">
      <ReviewBar goalId={goal.id} />
      <GoalBack />
      {/* Once the title scrolls away, a slim header keeps the goal, its status and its actions on screen. */}
      <StickyHead watch={titleRef} title={goal.title} status={st.status} number={stale ? 'Current performance unknown' : headlineNumber}
        actions={compact ? null : <>{canEdit && <Link className="btn sm" to={`/goals/${goal.id}/edit`}>Edit</Link>}{!isOwner && <WatchButton goal={goal} />}</>} />
      {!compact && <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/goals">Goals</Link>
        {path.map((p) => <span key={p.id} className="row"><Icon name="chevron-right" className="muted" /><Link to={'/goals/' + p.id}>{p.title}</Link></span>)}
      </nav>}
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="stack" style={{ gap: 6, minWidth: 0 }}>
          <h1 className="title-xl" ref={titleRef}>{goal.title}</h1>
          <span className="row hint" style={{ gap: 'var(--s2)' }}>
            <Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" />{owner?.name}{team ? `, ${team.name}` : ''}
            <LevelTag level={goal.level} />
            {goal.key && <span className="gkey" title={`This goal’s key: it never changes, and /goals/${goal.key} opens it`}>{goal.key}</span>}
          </span>
        </span>
        {!compact && <div className="actions">
          {isOwner && week > 0 && <Link className={'btn' + (due && !(published && own.length === 0) ? ' primary' : '')} to={'/check-in/' + goal.id}>{due ? `Check in for week ${week}` : 'Check in now'}</Link>}
          {canEdit && <Link className="btn" to={`/goals/${goal.id}/edit`}>Edit</Link>}
          {!isOwner && <WatchButton goal={goal} />}
          <Link className="btn ghost print-link" to={`/goals/${goal.id}/print`}><Icon name="print" /><span className="print-link-label">Print or save as PDF</span></Link>
        </div>}
      </div>

      {/* What it feeds, how many feed it, and how its number is measured: right under the title. */}
      <GoalContext goal={goal} parent={parent} feeding={children.length} canEdit={canEdit && !compact} />

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

      {/* Status first; then, on a wide screen, the evidence on the left and what needs a response beside it. */}
      <div className="goal-grid split">
      <div className="goal-head split-a">
      <section className="story" data-tone={st.status} aria-label="Where it stands">
        <div className="statusline">
          <Chip k={st.status} />
          {stale ? <span className="big">Current performance unknown</span> : <span className="big">{a.kind !== 'milestone' && a.actual != null && goal.kind !== 'milestone' ? <CountNumber value={a.actual} from={own.at(-2)?.value} format={(n) => fmt(n, goal)} memo={'goal:' + goal.id} /> : headlineNumber}</span>}
          {!stale && gap && <span className={'strong tone-' + gap.tone}>{gap.short}</span>}
        </div>
        {stale && <span className="small">{latest ? `Last reported: ${headlineNumber} in week ${latest.week} (${dateText(latest.postedAt)}), ${st.daysSinceCheckIn} days ago.` : 'Nothing reported yet.'} Without a newer check-in, the status and any projection can’t be trusted.</span>}
        {stale && !isOwner && (asked
          ? <span className="small asked-line" role="status"><span className="strong">Asked {ownerFirst} for an update {timeAgo(asked.at, app.today)}{asked.actorId !== app.viewer.id ? ` (${app.person(asked.actorId)?.name.split(' ')[0] ?? 'someone'})` : ''}.</span> It’s on their Home until they check in.{asked.actorId === app.viewer.id && <> <button type="button" className="linkish" disabled={asking} onClick={() => void undoAsk()}>Undo</button></>}</span>
          : <div className="row" style={{ gap: 'var(--s3)' }}><button type="button" className="btn sm" disabled={asking} onClick={() => void askForUpdate()}>Ask {ownerFirst} for an update</button><span className="small" role="status">{undone ? 'Undone. It’s off their Home.' : ''}</span></div>)}
        {summary.facts.length > 0 && (
          <dl className="facts">
            {summary.facts.map((f) => (
              <div key={f.key} className="fact" data-key={f.key} data-tone={f.tone}>
                <dt>{f.label}</dt>
                <dd><span className="fact-value">{f.value}</span>{f.detail && <span className="fact-detail">{f.detail}</span>}</dd>
              </div>
            ))}
          </dl>
        )}
        <span className="hint fact-source">{source ? <>Week {source.week} check-in · {app.person(source.authorId)?.name ?? 'someone'} · {timeAgo(source.postedAt, app.today)}</> : 'No check-ins yet.'}</span>
        {/* The way back, in the main column where it's read with the numbers (Lane's notes, 5 Nov). */}
        {behind && latest && (
          <section className="ptg" aria-label="Path to green">
            <h2 className="ptg-title">Path to green</h2>
            {story.doing
              ? <p className="ptg-what">{story.doing}</p>
              : <p className="ptg-what muted">{isOwner ? 'You haven’t said how it gets back on plan yet. Say so in your next check-in.' : `${ownerFirst} hasn’t said how it gets back on plan yet.`}</p>}
            {(story.byWhen || story.needs || ptg?.needs || story.next) && (
              <dl className="ptg-facts">
                {story.byWhen && <><dt>When</dt><dd>{story.byWhen}{ptg?.byWeek != null && ptg.byWeek < week ? ' (missed)' : ''}</dd></>}
                {(story.needs || ptg?.needs) && <><dt>Needs</dt><dd>{story.needs ?? ptg?.needs}</dd></>}
                {story.next && <><dt>Next step</dt><dd>{story.next}</dd></>}
              </dl>
            )}
          </section>
        )}
      </section>
      </div>
      {/* The side column comes before the evidence in the page's order, so a request is reached (and, on a phone, seen) first.
          Grouped under small headings, and only the groups with something in them. */}
      <div className="goal-rail split-side">

      {/* Requests for a decision or help: open until answered or withdrawn, answered once for every goal waiting on it. */}
      <Requests goal={goal} compact={compact} behind={behind} since={latest?.postedAt ?? null} />

      {(ownerSays || (!behind && latest?.next)) && (
        <section className="why rail-group" aria-labelledby="g-owner">
          <h2 className="rail-head" id="g-owner">What the owner says</h2>
          {ownerSays && (
            <div className="quote-block">
              <span className="field-label">{owner?.name.split(' ')[0]} said in week {ownerSays.week}</span>
              <p>{ownerSays.cause && <strong>{causeLabel(ownerSays.cause)}. </strong>}{ownerSays.why}</p>
            </div>
          )}
          {!behind && latest?.next && (
            <div className="quote-block">
              <span className="field-label">Next step</span>
              <p>{latest.next}</p>
            </div>
          )}
        </section>
      )}

      {notes.length > 0 && (
        <section className="why rail-group" aria-labelledby="g-signals">
          <h2 className="rail-head" id="g-signals">Signals</h2>
          {notes.map((f) => (
            <p key={f.kind} className="note-line" data-tone={f.tone}><FlagPill f={f} /> <span>{f.detail}</span></p>
          ))}
        </section>
      )}

      {asks.length > 0 && (
        <section className="why rail-group" aria-labelledby="g-reviews">
          <h2 className="rail-head" id="g-reviews">Said in reviews</h2>
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
      </div>
      <div className="goal-evidence split-b">
      {threats.length > 0 && (
        <section className="block threats" aria-label="Most likely to make it miss">
          <div className="row between"><h2 className="block-title">Most likely to make it miss</h2><span className="hint">{needy.length} of {children.length} contributing {children.length === 1 ? 'goal needs' : 'goals need'} attention</span></div>
          {/* The row already says what's wrong; the line under it says only why it's on this list. */}
          <ul className="tree">{threats.map((g) => <li key={g.id} className="threat"><GoalRow g={g} /><span className="hint threat-why">Why it’s here: {threatWhy(g)}</span></li>)}</ul>
          {children.length > threats.length && <Link className="linkish small" to={`/goals?feeds=${goal.id}`}>See all {children.length} contributing goals</Link>}
        </section>
      )}

      {/* In a review the chart and the latest check-ins are open: that's what a reviewer looks at first (Lane's notes, 5 Nov). */}
      {compact
        ? <section className="block review-evidence" aria-labelledby="g-chart"><h2 className="block-title" id="g-chart">Chart and recent check-ins</h2>{chart}<CheckInRows goal={goal} limit={4} /></section>
        : <section className="block">{chart}</section>}

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
            {subtree.children.map((n) => <li key={n.goal.id} className={threatIds.has(n.goal.id) ? 'listed-above' : undefined}><GoalRow g={n.goal} />{n.children.length > 0 && <TreeRows nodes={n.children} depth={1} />}</li>)}
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
        {tab === 'check-ins' && <CheckInRows goal={goal} limit={8} dated />}
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

/** Under the title: what this goal feeds (with that goal's status), how many goals feed it, and how its number is measured. */
function GoalContext({ goal, parent, feeding, canEdit }: { goal: Goal; parent: Goal | undefined; feeding: number; canEdit: boolean }) {
  const app = useApp();
  const measured = goal.kind !== 'milestone';
  const def = goal.definition.trim(), src = goal.source.trim();
  if (!parent && !feeding && !(measured && (def || src || canEdit))) return null;
  return (
    <div className="goal-context">
      {(parent || feeding > 0) && (
        <p className="ctx-line ctx-feeds">
          {parent && <><span className="ctx-label">Feeds into:</span> <Link className="ctx-parent" to={'/goals/' + parent.id}>{parent.title}</Link> <span aria-hidden="true">·</span> <Chip k={app.statusOf(parent).status} /></>}
          {parent && feeding > 0 && <span aria-hidden="true" className="ctx-sep">·</span>}
          {feeding > 0 && <Link className="linkish ctx-feeding" to={`/goals?feeds=${goal.id}`}>{feeding === 1 ? '1 goal feeds this one' : `${feeding} goals feed this one`}</Link>}
        </p>
      )}
      {parent && goal.whyHelps && <p className="small muted why-helps">{goal.whyHelps}</p>}
      {measured && (def || src) && (
        <p className="ctx-line ctx-measure"><span className="ctx-label">How it’s measured:</span> {def || 'Not described yet'}{src ? <span className="muted"> (source: {src})</span> : null}{!def && canEdit && <> <Link className="linkish" to={`/goals/${goal.id}/edit`}>Describe it</Link></>}</p>
      )}
      {measured && !def && !src && canEdit && (
        <p className="ctx-line ctx-measure"><span className="ctx-label">How it’s measured:</span> <span className="muted">not described yet.</span> <Link className="linkish" to={`/goals/${goal.id}/edit`}>Add how it’s measured</Link></p>
      )}
    </div>
  );
}

/**
 * The slim header that takes over once the title has scrolled away: title, status and number, with Edit and Watch.
 * It sits under whatever already sticks to the top (the phone's top bar, or the review bar in a review).
 */
function StickyHead({ watch, title, status, number, actions }: { watch: RefObject<HTMLElement | null>; title: string; status: DisplayStatus; number: string; actions: ReactNode }) {
  const [shown, setShown] = useState(false);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const el = watch.current;
    if (!el) return;
    // What already sticks to the top of the window, so this header goes under it rather than behind it.
    const above = () => {
      let y = 0;
      for (const e of document.querySelectorAll<HTMLElement>('.mtop, .goal-page > .reviewbar')) {
        if (!e.getClientRects().length) continue;
        const pos = getComputedStyle(e).position;
        if (pos === 'sticky' || pos === 'fixed') y = Math.max(y, Math.round(e.getBoundingClientRect().bottom));
      }
      return y;
    };
    const check = () => {
      const t = above();
      setTop(t);
      setShown(el.getBoundingClientRect().bottom < t);
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [watch]);
  return (
    <div className="goal-sticky" style={{ top }} data-shown={shown || undefined}>
      {shown && (
        <div className="goal-sticky-bar" role="region" aria-label="This goal">
          <span className="goal-sticky-title">{title}</span>
          <span className="goal-sticky-status"><Chip k={status} /><span className="strong goal-sticky-number">{number}</span></span>
          {actions && <span className="goal-sticky-actions">{actions}</span>}
        </div>
      )}
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

/**
 * The goal's check-ins, newest first: one row each (week, number, the call, the reason), and each row opens to the whole
 * check-in. Used on the goal page's Check-ins tab and, open, in a review.
 */
function CheckInRows({ goal, limit, dated }: { goal: Goal; limit: number; dated?: boolean }) {
  const app = useApp();
  const own = app.checkInsOf(goal);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  if (!own.length) return <p className="small muted">No check-ins yet.</p>;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <ol className="cilist ci-open">
        {[...own].reverse().slice(0, all ? undefined : limit).map((c) => {
          const isOpen = open.has(c.id);
          return (
            <li key={c.id} className={isOpen ? 'is-open' : undefined}>
              <button type="button" className="ci-row" aria-expanded={isOpen} aria-controls={'ci-' + c.id} onClick={() => toggle(c.id)}>
                <span className="strong ci-week"><span className="nowrap">Week {c.week}</span>{dated && own.filter((x) => x.week === c.week).length > 1 ? <span className="hint ci-date">{new Date(c.postedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span> : null}</span>
                <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
                <Chip k={c.status} />
                <span className="ci-tail">{c.why && c.why !== 'On plan.' ? <span className="small cilist-why">{c.why}</span> : <span className="small muted cilist-why">On plan</span>}<Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" /></span>
              </button>
              {isOpen && <CheckInFull goal={goal} c={c} id={'ci-' + c.id} />}
            </li>
          );
        })}
      </ol>
      {own.length > limit && !all && <button type="button" className="linkish small show-all" onClick={() => setAll(true)}>Show all {own.length} check-ins</button>}
    </>
  );
}

/** One check-in in full: the call and what the rules calculated, the cause and why, the path to green, needs, next step, who and when. */
function CheckInFull({ goal, c, id }: { goal: Goal; c: CheckIn; id: string }) {
  const app = useApp();
  const who = app.person(c.authorId);
  const ptg = c.pathToGreen;
  const m = goal.kind === 'milestone' ? assessMilestone(goal, c.week, c.stages) : null;
  return (
    <dl className="ci-full" id={id}>
      <dt>Call</dt>
      <dd>{c.status === c.calculated ? <>{LABEL[c.status]}, as the numbers say</> : <>Called {LABEL[c.status].toLowerCase()}; the numbers said {LABEL[c.calculated].toLowerCase()}</>}</dd>
      {m && <><dt>Stages</dt><dd><ul className="ci-stages">{m.stages.map((s) => <li key={s.id}>{s.name}: {s.kind === 'done' ? `done week ${s.doneWeek}` : `due week ${s.dueWeek}${s.expectedWeek > s.dueWeek ? `, expected week ${s.expectedWeek}` : ''}`}</li>)}</ul></dd></>}
      {c.cause && <><dt>Cause</dt><dd>{causeLabel(c.cause)}</dd></>}
      {c.why && <><dt>Why</dt><dd>{c.why}</dd></>}
      {c.greenerWhy && <><dt>Why greener</dt><dd>{c.greenerWhy}</dd></>}
      {ptg && <><dt>Path to green</dt><dd>{ptg.what}{ptg.byWeek != null ? <span className="muted"> · back on plan by week {ptg.byWeek}</span> : ptg.state === 'investigating' ? <span className="muted"> · still investigating</span> : null}</dd></>}
      {ptg?.needs && <><dt>Needs</dt><dd>{ptg.needs}</dd></>}
      {c.proposeTarget != null && goal.kind !== 'milestone' && <><dt>Proposed target</dt><dd>{fmt(c.proposeTarget, goal)}</dd></>}
      {c.next && <><dt>Next step</dt><dd>{c.next}</dd></>}
      <dt>Checked in</dt>
      <dd>{who?.name ?? 'Someone'}, {whenText(c.postedAt, app.today)}{c.backfilled ? ' (loaded later)' : ''}</dd>
    </dl>
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
  // "Asked of you" when one is waiting on the viewer; otherwise just "Requests".
  const mine = open.some((r) => r.recipientId === app.viewer.id);
  return (
    <section className="rail-group requests-group" aria-labelledby="g-requests">
      <h2 className="rail-head" id="g-requests">{mine ? 'Asked of you' : 'Requests'}</h2>
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
    </section>
  );
}
