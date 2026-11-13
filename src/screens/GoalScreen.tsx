/* A goal's page: the app's flagship (approved by Lane, 5 Nov). It answers, in order: what is this goal and who owns
   it; how is it doing; if badly, why; what is being done and how those actions are going; where it's heading; what has
   happened, and what was said the last time it was discussed. Each fact has one home (Lane, 5 Nov, on a phone: "the
   target four times, the trend three times"): the bar carries the status, the number and the scorecard (vs plan, vs
   last week, to target, will it hit); the chart marks those numbers where they are; Why opens with the owner's reason;
   What feeds it opens with how the goals feeding it stand; and every section says in one line what it answers.
   The words come from the domain (domain/goalPage and the modules it asks); this file lays them out. */
import { Place } from '../core/app';
import { MODULE_RECORDS } from '../core/records';
import { goalMarksOf } from '../domain/records';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { useOlderChanges } from '../app/history';
import { useSeen } from '../app/goalSeen';
import { useDraft } from '../app/drafts';
import { causeLabel } from '../domain/checkin';
import { directionLabel, fmt } from '../domain/format';
import { isEveryday, levelName } from '../domain/levels';
import { notStarted, planHistoryOf, resultWeek, valueSeries, weekDates } from '../domain/plan';
import { weekSays } from '../domain/weeks';
import { planSays } from '../domain/weekChoices';

const capitalFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
import { assessMilestone, assessPosted, LABEL } from '../domain/status';
import { moment, MOMENT_RESULT } from '../domain/habit';
import { goalScorecard, projects, type ScoreCell, type Scorecard } from '../domain/scorecard';
import { criticalPath } from '../domain/map';
import { isYear, quarterLabel, quarterOf, quarterResults } from '../domain/year';
import { ASK_KIND_LABEL, asksOf, canWithdraw, openUpdateAsk } from '../domain/asks';
import { goalsIn, watchOf, watchScope } from '../domain/review';
import { NextStepSheet } from '../ui/NextStepSheet';
import {
  askedOf, asksOnGoal, commentReach, goalHistory, HISTORY_FILTERS, HISTORY_LABEL, barFigures, feedingOrder, feedsLine, lastTalked, pathCheck, planFor, postedLine,
  primaryAction, sameReasonText, sinceLooked, standingAction, stepsAndAsks, updatedLine, whyLine, whyPointer,
  type AskedItem, type HistoryEntry, type HistoryFilter, type StepRow, type StepsAndAsks, type StreamItem,
} from '../domain/goalPage';
import type { CheckIn, DisplayStatus, Goal, MetricGoal } from '../domain/types';
import { Avatar, Chip, Empty, LevelTag, Sheet, StatusShape, timeAgo, WarnMark } from '../ui/bits';
import { MetricChart, QuarterMark, quarterWords, StageList, type Scrub } from '../ui/charts';
import { RangeChart } from '../ui/rangeChart';
import { PlanTable } from '../ui/PlanTable';
import { ReviewBar, ReviewCallBar, useReview } from './Inspect';
import { GoalRow, WatchButton } from '../ui/goalRows';
import { ChangeItem, whenText } from '../ui/ChangeItem';
import { RespondForm } from './Respond';
import { Icon } from '../ui/Icon';
import { GoalBack } from '../ui/BackLink';
import { CountNumber } from '../ui/Count';
import { MenuButton } from '../ui/MenuButton';
import { useShellTop } from '../ui/shellTop';
import { useWidth } from '../ui/useWidth';
import { MOTION_MS, reducedMotion, STORY_MS } from '../ui/motion';
import { effectOn, landedMoment, openMotionLab, storyOn, storyPace } from '../app/appearance';
import { copyGoalLink, shareGoalImage } from './goalShare';
import { ArchivedGoalScope } from '../app/state';
import { isProposed } from '../domain/proposed';

const ProposedGoal = lazy(() => import('./ProposedGoal').then((m) => ({ default: m.ProposedGoal })));
import { canDeleteCheckIn, importUndone } from '../domain/removal';
import { DeleteCheckIn, StoppedNote } from '../ui/RemoveControls';
import { BackToProposedSheet, goalRemoveLabel, RemoveGoalSheet } from '../ui/RemoveSheets';
import { LifeMark } from '../ui/LifeMark';
import { NO_REASON } from '../domain/checkin';
import { ASK_STATUS, GAP, LABEL as WORD_OF, lower, STATUS } from '../domain/vocabulary';

export function GoalScreen() {
  const app = useApp();
  const { goalId } = useParams();
  const goal = goalId ? app.goal(goalId) : undefined;
  // The Motion lab's "Replay this page" plays the story again by mounting the page afresh.
  const [replay, setReplay] = useState(0);
  useEffect(() => { const on = () => setReplay((n) => n + 1); window.addEventListener('goals-replay', on); return () => window.removeEventListener('goals-replay', on); }, []);
  if (!goal) return <div className="page narrow"><Empty title="This goal doesn’t exist"><Link className="btn sm" to="/goals">All goals</Link></Empty></div>;
  // A proposed goal has its own page (GE10): no status, no scorecard, no chart; loaded only when one is opened.
  if (isProposed(goal)) return <Suspense fallback={null}><ProposedGoal key={goal.id + ':' + app.viewer.id} goal={goal} /></Suspense>;
  // A stopped goal keeps its page, as it stood, marked Stopped (domain/removal). Always inside the scope, so stopping
  // the goal or undoing it carries on with the same page rather than mounting a new one.
  return <ArchivedGoalScope goalId={goal.id}><GoalView key={goal.id + ':' + app.viewer.id + ':' + replay} goal={goal} /></ArchivedGoalScope>;
}

/** Where the page's two columns start: as the shared side-column layout does (styles.css, `.split`). */
const WIDE = 960;

/** Five quick taps on a goal's status open the Motion lab (an Easter egg). */
const taps: number[] = [];
function secretTap() {
  const now = Date.now();
  taps.push(now);
  while (taps.length && now - taps[0]! > 2000) taps.shift();
  if (taps.length >= 5) { taps.length = 0; openMotionLab(); }
}

function GoalView({ goal }: { goal: Goal }) {
  const app = useApp();
  const { cycle, week } = app;
  const att = app.attentionOf(goal);
  const st = att.status;
  const status = st.status;
  const stale = status === 'stale';
  const own = app.checkInsOf(goal);
  const owner = app.person(goal.ownerId);
  const ownerFirst = owner?.name.split(' ')[0] ?? 'the owner';
  const isOwner = app.viewer.id === goal.ownerId;
  const canEdit = isOwner || app.viewer.admin;
  const rv = useReview(goal.id);
  const review = rv.active;
  const [params, setParams] = useSearchParams();
  const [page, width] = useWidth<HTMLDivElement>();
  const wide = width >= WIDE;

  // How the person arrived: to answer something (?ask=<id>; ?respond=<id> and the older ?tab=comments from Home's
  // links), just after posting a check-in (?posted=1), just after publishing (?published=1), or to look.
  const respondId = params.get('ask') ?? params.get('respond');
  const tabComments = params.get('tab') === 'comments';
  const [posted] = useState(() => params.get('posted') === '1');
  const published = params.get('published') === '1' && own.length === 0;
  const seen = useSeen(app.ws.id, app.viewer.id, goal.id, status, app.stamp);
  const firstVisit = !seen;

  // Everything asked and agreed on the goal, one list (domain/goalPage stepsAndAsks), and what of it waits on the viewer.
  const steps = stepsAndAsks({ goal, viewer: app.viewer, week, cycle, status, asks: asksOnGoal(goal.id, app.snapshot), people: [...app.snapshot.people, ...(app.snapshot.archive?.people ?? [])], reviews: app.snapshot.reviews });
  const asked = askedOf(goal, app.snapshot, app.viewer, respondId);
  // ?tab=comments was Home's old Answer link: an owner's open question is what it meant; otherwise the comment box.
  const alias = tabComments && !respondId ? asked.find((x) => x.kind === 'question')?.id ?? null : null;
  const inList = (id: string | null) => !!id && [...steps.forYou, ...steps.open].some((x) => x.id === id);
  const target = respondId && (inList(respondId) || asked.some((x) => x.id === respondId)) ? respondId : alias;
  const [openAsk, setOpenAsk] = useState<string | null>(target);
  const [focusAsk, setFocusAsk] = useState(!!target);
  const stepsRef = useRef<HTMLElement>(null);
  const done = (id: string) => {
    setOpenAsk((x) => (x === id ? null : x));
    if (respondId === id) setParams((p) => { p.delete('respond'); p.delete('ask'); return p; }, { replace: true });
  };

  const children = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const updateAsk = openUpdateAsk(goal.id, app.snapshot);
  const due = att.flags.some((f) => f.kind === 'due');
  const watching = !isOwner && watchOf(app.viewer.id, goal, app.snapshot) !== null;
  const openSteps = [...steps.forYou, ...steps.open].filter((x) => x.kind === 'action').length;
  const primary = primaryAction({ goal, viewer: app.viewer, owner, status, due, week, asked, updateAsked: !!updateAsk, openSteps, firstDue: own.length === 0 });
  const standing = standingAction({ goal, viewer: app.viewer, primary, watching, status });

  const figures = barFigures(goal, app.snapshot, cycle, week, stale);
  const card = goalScorecard(goal, cycle, app.snapshot.checkIns, week, stale);
  const why = whyLine(goal, app.snapshot, att);
  const feeds = feedsLine(children, (g) => app.statusOf(g).status);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const hit = goal.kind === 'metric' && a.kind === 'metric' && a.actual != null && !stale && (a.actual - goal.plan.target) * (Math.sign(goal.plan.target - goal.plan.start) || 1) >= 0;

  // The context line: just posted, or what's new since the last look, or (first time) what the number is.
  const postedText = posted ? postedLine(goal, app.snapshot, cycle, week) : null;
  // Since you looked: only when something has changed; nothing new says nothing (Lane, 5 Nov).
  const looked = !posted && seen ? sinceLooked(goal, app.snapshot, seen, status, app.today) : null;
  const since = looked && (looked.checkIns + looked.comments + looked.changes > 0 || looked.statusFrom) ? looked : null;
  const statusMoved = !!since?.statusFrom || (!!postedText?.from && postedText.from !== postedText.to);

  // Asking a quiet goal's owner for an update stays visible ("Asked 2 hours ago") until the next check-in; whoever asked
  // can undo it (Senior UX review, finding 9).
  const [asking, setAsking] = useState(false);
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

  const openAskedItem = (id: string | null) => {
    setOpenAsk(id); setFocusAsk(true);
    requestAnimationFrame(() => stepsRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }));
  };
  const [adding, setAdding] = useState(false);

  /* ---------- the bar's primary action, the standing button beside it, and the "…" menu ---------- */
  const stopped = !!goal.stoppedAt;
  const [removing, setRemoving] = useState(false);
  const [unactivating, setUnactivating] = useState(false);
  const aboutWanted = params.get('about') === '1' || (typeof window !== 'undefined' && window.location.hash === '#about');
  const [aboutOpen, setAboutOpen] = useState<boolean | null>(aboutWanted ? true : null);
  const aboutRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const on = () => { if (window.location.hash === '#about') setAboutOpen(true); }; window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  // Opened at a section (/goals/G-1#history; an old #activity link lands on History): scrolled there once it's drawn.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!/^(now|next|why|chart|feeds|history|activity|about)$/.test(id)) return;
    // Once drawn, and again after the shell has put a new page at its top (which can come later on a slow load).
    const go = () => document.getElementById(id === 'activity' ? 'history' : id)?.scrollIntoView({ block: 'start' });
    const t = [60, 400, 900].map((ms) => setTimeout(go, ms));
    return () => t.forEach(clearTimeout);
  }, []);
  const share = useShare(goal, figures.now, figures.against, why.text ?? '', status);
  const menu = (
    <MenuButton label="More about this goal" className="bar-menu" icon={<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg>}
      items={[
        { label: 'Share image', onClick: () => void share.image() },
        { label: 'Copy link', onClick: () => void share.link() },
        { label: 'Print or save as PDF', to: `/goals/${goal.id}/print` },
        // No "Check in for …": only the owner checks in (OWNER-ONLY); their buttons are on the bar.
        ...(!stopped && canEdit ? [{ label: 'Change this goal', to: `/goals/${goal.id}/edit` }] : []),
        // Stop a goal with history (with a reason), or delete one set up by mistake: its owner or an admin.
        // An active goal with no check-ins can go back to proposed (GE10); with one, the edit page says to stop it instead.
        ...(!stopped && canEdit && !own.length ? [{ label: 'Make it proposed again', onClick: () => setUnactivating(true) }] : []),
        ...(!stopped && canEdit ? [{ label: goalRemoveLabel(own.length > 0), onClick: () => setRemoving(true) }] : []),
      ]} />
  );
  const showPrimary = !stopped && !review && !published && !(primary.targetId && openAsk === primary.targetId);
  const mainAction: ReactNode = !showPrimary || !primary.kind ? null
    : primary.kind === 'check-in' || primary.kind === 'first-check-in' ? <Link className="btn primary" to={'/check-in/' + goal.id}>{primary.label}</Link>
    : primary.kind === 'ask-update' ? <button type="button" className="btn primary" disabled={asking} onClick={() => void askForUpdate()}>{primary.label}</button>
    : primary.kind === 'add-step' ? <button type="button" className="btn primary" onClick={() => setAdding(true)}>{primary.label}</button>
    : <button type="button" className="btn primary" onClick={() => openAskedItem(primary.targetId)}>{primary.label}</button>;
  const standingButton: ReactNode = review || !standing.kind ? null
    : standing.kind === 'check-in-again' ? <Link className="btn" to={'/check-in/' + goal.id}>{standing.label}</Link>
    : <WatchButton goal={goal} />;
  const actions = review ? null : (
    <>
      {mainAction}
      {standingButton}
      {menu}
    </>
  );
  const askedLine = stopped ? <StoppedNote goal={goal} /> : !isOwner && stale && !review && (updateAsk
    ? <span className="small asked-line" role="status"><span className="strong">Asked {ownerFirst} for an update {timeAgo(updateAsk.createdAt, app.today)}{updateAsk.askedBy !== app.viewer.id ? ` (${app.person(updateAsk.askedBy)?.name.split(' ')[0] ?? 'someone'})` : ''}.</span> It’s open on their Home until they check in or answer it.{canWithdraw(updateAsk, app.viewer, goal) && <> <button type="button" className="linkish" disabled={asking} onClick={() => void undoAsk()}>Undo</button></>}</span>
    : undone ? <span className="small" role="status">Withdrawn. It’s off their Home.</span> : null);

  /* ---------- the parts of the page, in one order at every width (goal spec, 2.1) ---------- */
  // What the number measures is said once, in About (open on a first visit), not here as well (goal spec, N15).
  const contextLine = (postedText || since) && !review && (
    <p key="context" className={'context-line' + (postedText ? ' posted' : '')} role={postedText ? 'status' : undefined}>
      {postedText ? <>
        {postedText.text.replace(/ · \d+ weeks on time$/, '')}
        {postedText.streak >= 2 && <> · <CountNumber value={postedText.streak} from={postedText.streak - 1} format={(n) => `${Math.round(n)} weeks on time`} className="streak-count" duration={600} /></>}
      </> : since ? <>{since.text}{(since.checkIns + since.comments + since.changes) > 0 && <> <a className="linkish" href="#history">See them</a></>}</> : null}
    </p>
  );
  const whyShown = !review && whyShows(goal, app);
  const links = !review && <SectionLinks key="links" open={steps.openCount} why={whyShown} feeds={children.length > 0 || !!parent} />;
  const chart = <GoalChart key="chart" goal={goal} status={status} landed={posted} hit={hit} card={card} />;
  const whySection = whyShown && <WhySection key="why" goal={goal} why={why} />;
  const nextSteps = !review && (
    <NextStepsSection key="next" goal={goal} steps={steps} asked={asked} open={openAsk} focus={focusAsk} sectionRef={stepsRef}
      showAll={params.get('steps') === 'all'} onShowAll={() => setParams((p) => { p.set('steps', 'all'); return p; }, { replace: true })}
      onOpen={(id) => { setOpenAsk(id); setFocusAsk(true); }} onDone={done} onAdd={() => setAdding(true)} />
  );
  const talked = <TalkedSection key="talked" goal={goal} />;
  const feeding = !review && (children.length > 0 || !!parent) && <FeedsSection key="feeds" feeding={children} feeds={feeds} parent={parent} />;
  const quarters = !review && isYear(cycle) && <QuarterStrip key="quarters" goal={goal} />;
  const activity = !review && <HistorySection key="history" goal={goal} focusComposer={tabComments && !alias} />;
  const about = !review && <AboutSection key="about" goal={goal} detailsRef={aboutRef} open={aboutOpen ?? firstVisit} onToggle={setAboutOpen} />;
  const evidence = review && (
    <section key="evidence" className="block review-evidence" aria-labelledby="g-chart" data-part="Chart and recent check-ins"><h2 className="block-title" id="g-chart">Chart and recent check-ins</h2>{chart}<CheckInRows goal={goal} limit={4} /></section>
  );

  const main = review ? [evidence] : [whySection, chart, feeding, quarters, activity, about];
  const side = review ? [talked] : [contextLine, nextSteps, talked];
  const phone = review ? [evidence, talked] : [contextLine, nextSteps, whySection, chart, talked, feeding, quarters, activity, about];

  return (
    <div className={'page goal-page' + (review ? ' in-review' : '')} ref={page} data-part="Goal page">
      <ReviewBar goalId={goal.id} />
      <GoalBack />
      <GoalBar goal={goal} status={status} figures={figures} card={card} actions={actions} askedLine={askedLine} firstDue={own.length === 0}
        statusMoved={statusMoved} hit={hit} countFrom={effectOn('count') ? own.filter((c) => c.value != null).at(-2)?.value ?? null : null} />

      {published && (
        <section className="first-checkin" aria-label="First check-in">
          <span className="strong">“{goal.title}” is published.</span>
          {week < 1
            ? <span>Its first check-in is due in week 1, when the year starts.</span>
            : isOwner
              ? <><span>Post its first check-in now, so everyone can see where it stands from today.</span>
                  <span className="row"><Link className="btn primary" to={'/check-in/' + goal.id}>Post the first check-in</Link><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>
              : <><span>{ownerFirst} posts its check-ins. Ask for the first one now?</span>
                  <span className="row"><button type="button" className="btn" disabled={asking} onClick={() => void askForUpdate().then(() => { app.toast(`Asked ${ownerFirst}. It’s on their Home until they check in.`); setParams({}, { replace: true }); })}>Ask {ownerFirst}</button><button type="button" className="btn ghost" onClick={() => setParams({}, { replace: true })}>Later</button></span></>}
        </section>
      )}

      {links}
      {wide
        ? <div className="goal-grid split"><div className="split-a goal-main">{main}</div><aside className="split-side goal-side" aria-label="Next steps and asks">{side}</aside></div>
        : <div className="goal-col">{phone}</div>}
      {review && <ReviewCallBar goal={goal} />}
      {removing && <RemoveGoalSheet goal={goal} onClose={() => setRemoving(false)} />}
      {unactivating && <BackToProposedSheet goal={goal} onClose={() => setUnactivating(false)} />}
      {adding && <NextStepSheet goal={goal} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Links to the page's sections, under the summary: "Now", "Next steps and asks · 2", "Why", "Chart", … (goal spec, 2.1). */
function SectionLinks({ open, why, feeds }: { open: number; why: boolean; feeds: boolean }) {
  const items: [string, string][] = [
    ['now', 'Now'], ['next', `Next steps and asks${open ? ` · ${open}` : ''}`], ...(why ? [['why', 'Why'] as [string, string]] : []), ['chart', 'Chart'],
    ...(feeds ? [['feeds', 'What feeds it'] as [string, string]] : []), ['history', 'History'], ['about', 'About'],
  ];
  return (
    <nav className="goal-links" aria-label="On this page" data-part="Section links">
      {items.map(([id, label]) => <a key={id} className="goal-link" href={'#' + id}>{label}</a>)}
    </nav>
  );
}

/* ---------------------------------------------------------------------------------------------------- the bar */

/**
 * The summary bar: a two-second read. The goal and its owner; its status and the number; then the scorecard, four
 * labelled cells that answer how it stands against plan, what changed since last week, what's left to the target and
 * whether it will get there (domain/scorecard). The reason and the goals feeding it have their own sections below, said
 * once there. Once the bar scrolls away it shrinks to one line at the top, a solid panel with a rule under it: status,
 * number and the gap to plan, and the "…" menu (the same element, not a copy). On a phone it is the page's header, with
 * the app header's Demo tag and person button at its right.
 */
function GoalBar({ goal, status, figures, card, actions, askedLine, statusMoved, hit, countFrom, firstDue }: {
  goal: Goal; status: DisplayStatus; figures: ReturnType<typeof barFigures>; card: Scorecard;
  actions: ReactNode; askedLine: ReactNode; statusMoved: boolean; hit: boolean; countFrom: number | null; firstDue: boolean;
}) {
  const app = useApp();
  const owner = app.person(goal.ownerId);
  const team = app.team(goal.teamId);
  const me = useShellTop();
  const slot = useRef<HTMLDivElement>(null);
  const c = useCompact(slot);
  // When it was last updated: the latest check-in's date, beside its week.
  const updated = updatedLine(goal, app.snapshot);
  const num = figures.nowValue != null && goal.kind !== 'milestone'
    ? <CountNumber value={figures.nowValue} from={countFrom} format={(n) => fmt(n, goal)} memo={'goal:' + goal.id} duration={storyOn() ? STORY_MS * storyPace() : MOTION_MS} onLanded={storyOn() ? landedMoment : undefined} land={storyOn()} />
    : figures.now;
  return (
    <div className="goal-bar-slot" id="now" ref={slot} style={c.on ? { height: c.height } : undefined}>
      <header className={'goal-bar' + (c.on ? ' compact' : '') + (hit ? ' hit' : '') + (goal.stoppedAt ? ' stopped' : '')} data-part="Summary bar" data-tone={goal.stoppedAt ? 'stopped' : status} style={c.on ? { position: 'fixed', top: c.top, left: c.left, width: c.width } : undefined} aria-label="This goal">
        <div className="bar-1">
          <h1 className="bar-title">{goal.title}</h1>
          {me && <span className="bar-me">{me}</span>}
        </div>
        <div className="bar-who">
          <Avatar p={owner ?? { name: '?', initials: '?' }} size="sm" /><span>{owner?.name ?? 'No owner'}{team ? `, ${team.name}` : ''}</span>
          <LevelTag level={goal.level} />
          {goal.key && <span className="gkey" title={`This goal’s key: it never changes, and /goals/${goal.key} opens it`}>{goal.key}</span>}
          {updated && <span className="bar-updated hint">{updated}</span>}
        </div>
        {/* A fact a module adds, such as what measures it (the goal.facts place). */}
        <Place name="goal.facts" goal={goal} />
        <div className="bar-2">
          {goal.stoppedAt ? <LifeMark k="stopped" className="bar-status bar-life" /> : <span className="bar-status-tap" onClick={secretTap}><Chip k={status} className={'bar-status' + (statusMoved ? ' moved' : '')} /></span>}
          <span className="bar-dot" aria-hidden="true">·</span>
          <span className="bar-now">{num}</span>
          {/* Only in the one-line bar: the gap to plan, which the scorecard says in full. */}
          {card.gap && <span className="bar-gap"><span aria-hidden="true">· </span>{card.gap}</span>}
        </div>
        {firstDue && !goal.stoppedAt ? <p className="small muted sc-none" data-part="Scorecard">The scorecard starts with the first check-in.</p> : card.cells.length > 0 && <ScoreGrid cells={card.cells} />}
        {askedLine && <div className="bar-note">{askedLine}</div>}
        {actions && <div className="bar-actions">{actions}</div>}
      </header>
    </div>
  );
}

/** The scorecard: a label, a value and one muted line per cell; two by two on a phone, in a row on a wider screen. */
function ScoreGrid({ cells }: { cells: ScoreCell[] }) {
  return (
    <dl className={'scorecard cells-' + cells.length} aria-label="Scorecard" data-part="Scorecard">
      {cells.map((c) => (
        <div key={c.key} className={'sc-cell sc-' + c.key} data-part={c.label}>
          <dt className="sc-label">{c.label}</dt>
          <dd className={'sc-value tone-' + c.tone}>{c.move && <MoveMark up={c.move === 'up'} />}{c.value}</dd>
          <dd className="sc-sub">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Which way the number moved: a small drawn triangle (the app's own shape, not a glyph). */
const MoveMark = ({ up }: { up: boolean }) => (
  <svg className="sc-move" viewBox="0 0 10 10" aria-hidden="true"><path d={up ? 'M5 1.5 9 8.5H1z' : 'M1 1.5h8L5 8.5z'} fill="currentColor" /></svg>
);

/** A section's heading and one muted line saying what it answers (Lane, 5 Nov: "say what each part is for"). */
function SectionHead({ id, title, purpose, children }: { id?: string; title: string; purpose: ReactNode; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="block-title" id={id}>{title}</h2>
      <p className="section-purpose">{purpose}</p>
      {children}
    </div>
  );
}

/** Whether the bar has scrolled away, and where its one-line form sits: under anything already stuck to the top. */
function useCompact(slot: RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState({ on: false, top: 0, left: 0, width: 0, height: 0 });
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const above = () => {
      let y = 0;
      for (const e of document.querySelectorAll<HTMLElement>('.mtop, .goal-page > .reviewbar')) {
        if (!e.getClientRects().length) continue;
        const pos = getComputedStyle(e).position;
        if (pos === 'sticky' || pos === 'fixed') y = Math.max(y, Math.round(e.getBoundingClientRect().bottom));
      }
      return y;
    };
    let full = el.offsetHeight;
    const check = () => {
      const t = above();
      const r = el.getBoundingClientRect();
      const on = r.bottom < t + 4;
      setS((p) => {
        if (!p.on) full = el.offsetHeight;
        const next = { on, top: t, left: Math.round(r.left), width: Math.round(r.width), height: full };
        return p.on === next.on && p.top === next.top && p.left === next.left && p.width === next.width && p.height === next.height ? p : next;
      });
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [slot]);
  return s;
}

/** Share: a PNG of the summary bar and a small chart, with the goal's link; or the link alone (`./goalShare.ts`). */
function useShare(goal: Goal, now: string, against: string[], why: string, status: DisplayStatus) {
  const app = useApp();
  return { link: () => copyGoalLink(app, goal), image: () => shareGoalImage(app, goal, now, against, why, status) };
}

/* ---------------------------------------------------------------------------------------------------- next steps and asks */

/**
 * Next steps and asks: everything asked and agreed on the goal, one list, shown once (goal spec, 2.1 section 3; rule 2).
 * What waits on the viewer comes first, "For you"; then the other open rows; then the last three answered or done. Each
 * row has at most one button, and Respond, Answer and Mark done open the one Respond panel in the row, in place.
 */
function NextStepsSection({ goal, steps, asked, open, focus, onOpen, onDone, onAdd, sectionRef, showAll, onShowAll }: {
  goal: Goal; steps: StepsAndAsks; asked: AskedItem[]; open: string | null; focus: boolean; onOpen: (id: string) => void; onDone: (id: string) => void;
  onAdd: () => void; sectionRef: RefObject<HTMLElement | null>; showAll: boolean; onShowAll: () => void;
}) {
  const app = useApp();
  const isOwner = app.viewer.id === goal.ownerId;
  const ownerFirst = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const [asking, setAsking] = useState(false);
  const live = !goal.stoppedAt && app.attentionOf(goal).status.status !== 'done';
  // A comment is no obligation: it's here only when someone came to reply to it (Home's link).
  const reply = asked.find((x) => x.kind === 'comment');
  const done = showAll ? steps.done : steps.done.slice(0, 3);
  const row = (x: StepRow) => <StepRowItem key={x.id} goal={goal} x={x} open={open === x.id} focus={focus} onOpen={() => onOpen(x.id)} onDone={() => onDone(x.id)} />;
  return (
    <section className="block next-steps goal-section" id="next" aria-labelledby="g-next" ref={sectionRef} data-part="Next steps and asks">
      <SectionHead id="g-next" title={`Next steps and asks${steps.openCount ? ` · ${steps.openCount} open` : ''}`} purpose="Who is doing what, by when, and what has been asked." />
      {steps.gap && live && <p className="steps-gap"><WarnMark /><span>No next step yet. Nobody has said what happens next, who does it and by when.</span></p>}
      {reply && (
        <div className="asked-item is-open">
          <span className="field-label">{reply.fromFirst} commented <span className="hint">· {timeAgo(reply.at, app.today)}</span></span>
          <p className="asked-text">{cap(reply.text)}</p>
          <ReplyBox goal={goal} item={reply} focus={focus} onDone={() => onDone(reply.id)} />
        </div>
      )}
      {steps.forYou.length > 0 && <><h3 className="steps-label">For you</h3><ul className="steps-list">{steps.forYou.map(row)}</ul></>}
      {steps.open.length > 0 && <ul className="steps-list">{steps.open.map(row)}</ul>}
      {steps.done.length > 0 && <><h3 className="steps-label">Done lately</h3><ul className="steps-list">{done.map(row)}</ul></>}
      {steps.done.length > done.length && <button type="button" className="linkish small show-all" onClick={onShowAll}>Show all {steps.done.length}</button>}
      {!steps.openCount && !steps.done.length && <p className="muted small">{goal.stoppedAt ? 'Nothing was open when the goal stopped.' : 'No next steps or asks yet.'}</p>}
      {live && (
        <div className="row steps-do">
          <button type="button" className="btn add-next-step" onClick={onAdd}>Add a next step</button>
          {!isOwner && <button type="button" className="btn" onClick={() => setAsking(true)}>Ask {ownerFirst} a question</button>}
          {isOwner && app.week > 0 && <Link className="btn" to={`/check-in/${goal.id}?need=1`}>Ask for a decision or help</Link>}
        </div>
      )}
      {asking && <AskQuestionSheet goal={goal} onClose={() => setAsking(false)} />}
    </section>
  );
}

/** One row of Next steps and asks: the kind and the text, who and when, its state, and its one button. */
function StepRowItem({ goal, x, open, focus, onOpen, onDone }: { goal: Goal; x: StepRow; open: boolean; focus: boolean; onOpen: () => void; onDone: () => void }) {
  const app = useApp();
  const r = asksOf(app.snapshot).find((a) => a.id === x.id);
  const [changing, setChanging] = useState(false);
  // An open next step's words, who and when can be changed by whoever agreed it, or an admin (actions.editCall).
  const canChange = !!r && r.kind === 'action' && r.status === 'open' && (r.askedBy === app.viewer.id || app.viewer.admin);
  const withdraw = () => {
    if (!r) return;
    const linked = r.kind === 'decision' && r.goalIds[0] !== goal.id;
    const run = r.kind === 'update' ? app.undoUpdateAsk(goal) : app.withdrawRequest(r, goal);
    void run.then(() => app.toast(linked ? 'No longer waiting on that request' : `${ASK_KIND_LABEL[r.kind]} withdrawn`)).catch(() => { /* the save already said what went wrong */ });
  };
  const button = !x.button || open ? null
    : x.button === 'Check in' ? <Link className="btn sm" to={'/check-in/' + goal.id}>Check in</Link>
    : x.button === 'Withdraw' ? <button type="button" className="btn sm ghost" onClick={withdraw}>Withdraw</button>
    : <button type="button" className="btn sm" onClick={onOpen}>{x.button}</button>;
  return (
    <li className={'step-row' + (open ? ' is-open' : '') + (x.settled ? ' is-settled' : '')} data-ask={x.id}>
      <span className="step-body">
        <span className="step-text">{x.text}</span>
        <span className="hint step-line">{x.line}{canChange && <> · <button type="button" className="linkish small" onClick={() => setChanging(true)}>Change</button></>}</span>
        {x.answer && <span className="small step-answer">{x.answer}</span>}
      </span>
      <span className={'step-state' + (x.overdue ? ' is-overdue' : '')}>{x.overdue && <WarnMark />}{x.state}</span>
      {button && <span className="step-do">{button}</span>}
      {open && r && <section className="step-panel" aria-label="Respond"><RespondForm ask={r} focus={focus} onClose={onDone} /></section>}
      {changing && r && <NextStepSheet goal={goal} existing={r} onClose={() => setChanging(false)} />}
    </li>
  );
}

/** Ask the owner a question (goal spec, 2.6): an ask that stays open on their Home until it's answered. */
export function AskQuestionSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const app = useApp();
  const ownerFirst = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const bad = text.trim().length < 2;
  const save = async () => {
    setTried(true);
    if (bad || busy) return;
    setBusy(true);
    try { await app.askQuestion(goal, text); app.toast(`Asked ${ownerFirst}. It’s open on their Home until they answer.`); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Ask ${ownerFirst} a question about ${goal.title}`}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <label className="field"><span className="field-label">Your question</span>
          <textarea className={'input' + (tried && bad ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          {tried && bad && <span className="hint tone-off" role="alert">Type the question.</span>}
        </label>
        <span className="hint">It stays open on {ownerFirst}’s Home and in Next steps and asks until it’s answered. Everyone in {app.ws.name} can read it.</span>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Asking…' : 'Ask'}</button></div>
      </form>
    </Sheet>
  );
}

/** Replying to a comment, in place: a comment of your own. It answers nothing, because a comment asks nothing. */
function ReplyBox({ goal, item, focus, onDone }: { goal: Goal; item: AskedItem; focus: boolean; onDone: () => void }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!focus) return;
    box.current?.focus({ preventScroll: true });
    // After the page has settled at the top (the shell scrolls a new page there once it's drawn).
    const t = setTimeout(() => form.current?.scrollIntoView?.({ block: 'nearest' }), 80);
    return () => clearTimeout(t);
  }, [focus]);
  const post = async () => {
    setTried(true);
    if (text.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await app.addNote(goal, text);
      app.toast(`Reply posted for ${item.fromFirst}`);
      onDone();
    } catch { setBusy(false); }
  };
  return (
    <form ref={form} className="stack reply-form" style={{ gap: 'var(--s2)' }} onSubmit={(e) => { e.preventDefault(); void post(); }} noValidate>
      <label className="field"><span className="field-label">Your reply</span>
        <textarea ref={box} className={'input' + (tried && text.trim().length < 2 ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <span className="field-msg" role="alert">{tried && text.trim().length < 2 && <><Icon name="alert" size={16} />Write a few words.</>}</span>
      </label>
      <div className="sheet-foot respond-foot">
        <button type="button" className="linkish small" onClick={onDone}>Not now</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Posting…' : 'Post your reply'}</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------------- the chart */

function GoalChart({ goal, status, landed, hit, card }: { goal: Goal; status: DisplayStatus; landed: boolean; hit: boolean; card: Scorecard }) {
  const stale = status === 'stale';
  const app = useApp();
  const { cycle, week } = app;
  const own = app.checkInsOf(goal);
  const series = valueSeries(own);
  const a = assessPosted(goal, cycle, app.snapshot.checkIns, week);
  const latest = own[own.length - 1] ?? null;
  const ptg = latest?.pathToGreen ?? null;
  // The chart is drawn in its final state at once; it draws itself in only when the story is switched on (Motion lab).
  const draw = !reducedMotion() && storyOn();
  // Drag along the chart to read any week: its number, the plan that week, and the reason given.
  const scrub: Scrub = {
    read: (w) => {
      const c = [...own].reverse().find((x) => x.week === w);
      const plan = planFor(goal, cycle, w);
      const parts = [`Week ${w} (${weekDates(cycle, w)})`];
      if (c && c.value != null && goal.kind !== 'milestone') parts.push(fmt(c.value, goal));
      else if (!c) parts.push('no check-in');
      if (plan != null && goal.kind === 'metric') parts.push(`plan ${fmt(plan, goal)}`);
      if (c) parts.push(LABEL[c.status].toLowerCase());
      return parts.join(' · ') + (c && c.why && c.why !== NO_REASON ? `. ${c.cause ? causeLabel(c.cause) + ': ' : ''}${c.why}` : '');
    },
  };
  // Under the chart, one small footnote: where the likely end comes from. The numbers are the scorecard's, marked on the chart.
  const projected = card.cells.some((c) => c.key === 'hit' && c.likelihood);
  // A stopped goal makes no forecast, and says nothing about one.
  const ahead = projects(goal, status);
  const foot = goal.stoppedAt || status === 'done' ? null : stale ? 'No projection: the last check-in is too old to project from.'
    : projected ? (goal.kind === 'metric' ? 'Likely end projected from the last eight weeks, not the owner’s date.' : 'Likely end projected from the last eight weeks.')
    : null;
  const caption = foot ? <span className="chart-say chart-foot">{foot}</span> : null;
  return (
    <section className="block goal-chart-block" id="chart" aria-label="Chart" data-part="Chart">
      {goal.kind === 'metric' && a.kind === 'metric' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <MetricChart goal={goal} weeks={cycle.weeks} week={week} series={series} forecast={ahead ? a.forecast : null} projection={ahead ? a.projection : null} ptgBy={ahead ? ptg?.byWeek ?? null : null} scrub={scrub} draw={draw} landed={landed && !reducedMotion()} hit={hit} marks={stale ? null : card.marks} notes={goalMarksOf(MODULE_RECORDS, app.snapshot, goal.id, cycle.startDate)} />
          {(caption || goal.originalPlan) && <figcaption className="small">{caption}{goal.originalPlan ? <PlanChanges goal={goal} /> : null}</figcaption>}
        </figure>
      )}
      {goal.kind === 'range' && (
        <figure className="card goal-chart" style={{ margin: 0 }}>
          <RangeChart goal={goal} weeks={cycle.weeks} week={week} series={series} scrub={scrub} draw={draw} landed={landed && !reducedMotion()} />
          {caption && <figcaption className="small">{caption}</figcaption>}
        </figure>
      )}
      {a.kind === 'milestone' && <div className="card"><StageList a={a} /></div>}
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
  return <span className="muted plan-changes">{what}{first} The original plan is dotted; earlier weeks and closed quarters are judged against the plan of their day.</span>;
}

/* ---------------------------------------------------------------------------------------------------- why */

/** Whether Why has anything to say: behind, gone quiet, a reason or next word given, or a flag the status doesn't say. */
function whyShows(goal: Goal, app: ReturnType<typeof useApp>): boolean {
  const att = app.attentionOf(goal);
  const status = att.status.status;
  const latest = att.status.latest;
  const behind = status === 'off' || status === 'risk';
  if (!latest || behind || status === 'stale') return true;
  const reason = !!latest && !!latest.why && latest.why !== NO_REASON;
  return reason || !!latest?.next || att.flags.some((f) => !['due', 'off', 'risk', 'stale', 'trend'].includes(f.kind));
}

/**
 * Why, with what's being done about it (goal spec, 2.1 section 4): the owner's reason opens it, then where the reason
 * came from and since when, anything the numbers would otherwise hide, and the owner's path to green and its date. An
 * open decision or help is pointed to, never repeated: its words live in Next steps and asks. On plan, the same place
 * carries the owner's latest word; gone quiet, how long since anyone said anything.
 */
function WhySection({ goal, why }: { goal: Goal; why: ReturnType<typeof whyLine> }) {
  const app = useApp();
  const att = app.attentionOf(goal);
  const latest = att.status.latest;
  const status = att.status.status;
  const behind = status === 'off' || status === 'risk';
  const stale = status === 'stale';
  // What else flags it, in full. The status's own reason is the text above; a worsening trend is said here only while the
  // status doesn't already say it's behind. Waiting on a decision is the pointer below, not the ask's words.
  const signals = att.flags.filter((f) => !['due', 'off', 'risk', 'stale', 'decision'].includes(f.kind) && !(f.kind === 'trend' && (behind || stale)));
  const pointer = whyPointer(goal, asksOnGoal(goal.id, app.snapshot), app.snapshot.people);
  const reason = !!latest && !!latest.why && latest.why !== NO_REASON;
  const onlySignals = !behind && !stale && !reason && !latest?.next;
  const own = app.checkInsOf(goal);
  let k = own.length - 1;
  while (k > 0 && latest && own[k - 1]!.why === latest.why && own[k - 1]!.cause === latest.cause) k--;
  const runFrom = own[k]?.week;
  const by = latest ? app.person(latest.authorId)?.name.split(' ')[0] ?? 'The owner' : null;
  const when = latest ? (latest.week === app.week ? 'this week’s check-in' : `the week ${latest.week} check-in`) : null;
  const path = behind ? pathCheck(goal, app.snapshot, app.cycle, app.week, latest) : null;
  const ptgState = latest?.pathToGreen?.state ?? 'plan';
  const isOwner = app.viewer.id === goal.ownerId;
  const ownerFirst = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'The owner';
  // A check-in an admin loaded (a workbook, or a correction in Data) is said as theirs, by name: not as the owner's.
  const sayer = latest && latest.authorId !== goal.ownerId ? app.person(latest.authorId)?.name ?? 'Someone else' : null;
  const [title, purpose] = !latest ? ['Why', 'Nothing said yet. The first check-in will say where it stands.']
    : stale ? [`Why it has ${lower(STATUS.stale)}`, `When ${sayer ?? 'the owner'} last said where it stands.`]
    : behind ? [`Why it ${STATUS[status].short}`, `${sayer ? `${sayer}’s` : 'The owner’s'} reason, from ${when ?? 'their check-in'}.`]
    : onlySignals ? ['Worth knowing', 'What the numbers flag that the status doesn’t say.']
    : ['The latest word', when ? `What ${sayer ?? 'the owner'} said in ${when}.` : 'What the owner has said so far.'];
  return (
    <section className="block why-block goal-section" id="why" aria-labelledby="g-why" data-part="Why">
      <SectionHead id="g-why" title={title} purpose={purpose} />
      {latest && why.text && (behind || stale || reason || !!latest?.next) && <p className="why-text">{why.text}{stale ? '. Without a newer check-in, the status and any projection can’t be trusted.' : ''}</p>}
      {why.handledText && <p className={'why-handled ' + (why.handled === 'handled' ? 'is-handled' : 'not-handled')}>{cap(why.handledText)}.</p>}
      {behind && latest && reason && (
        <p className="why-by">
          {latest.cause ? <><strong>{causeLabel(latest.cause)}</strong>, from </> : 'From '}{by}’s check-in in week {latest.week}{runFrom != null && runFrom < latest.week ? `; the same reason since week ${runFrom}` : ''}.
        </p>
      )}
      {pointer && <p className="why-pointer"><a className="linkish" href="#next">{pointer}</a></p>}
      {signals.length > 0 && (
        <ul className="signal-tags" aria-label="Also worth knowing">
          {signals.map((f) => (
            <li key={f.kind} className="signal-tag">
              <WarnMark /><span><span className="signal-label">{f.label}</span>{/path/.test(f.kind) ? null : <>: <span className="signal-detail">{f.detail}</span></>}</span>
            </li>
          ))}
        </ul>
      )}
      {behind && latest && (path ? (
        <div className="ptg" data-part="Path to green">
          <span className="field-label">Path to green</span>
          <p className="ptg-what">{path.what}</p>
          <p className="small ptg-when">
            {path.byWeek != null ? <>Owner’s date: back on plan by week {path.byWeek} ({weekDates(app.cycle, path.byWeek)}){ptgState === 'help' ? ', once the decision or help arrives' : ''}. </> : ptgState === 'investigating' ? 'No date yet: still working out what’s wrong. ' : ptgState === 'help' ? 'No date until the decision or help arrives. ' : ptgState === 'target' ? 'The owner says the target should change. ' : ''}
            {path.check && <span className={path.reaches === false || path.missed ? 'tone-risk' : 'muted'}>{path.check}</span>}
          </p>
        </div>
      ) : <p className="muted ptg-none">{isOwner ? 'You haven’t said how it gets back on plan yet. Say so in your next check-in.' : `${ownerFirst} hasn’t said how it gets back on plan yet.`}</p>)}
    </section>
  );
}

/** A request typed after "Elena:" starts in lower case; it leads its own line here. */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const STATE_WORD = { open: ASK_STATUS.open.label, done: ASK_STATUS.done.label, overdue: ASK_STATUS.overdue.label } as const;

/* ---------------------------------------------------------------------------------------------------- last time we talked */

const dayOf = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function TalkedSection({ goal }: { goal: Goal }) {
  const app = useApp();
  const talkedAll = lastTalked(goal, app.snapshot, app.cycle, app.week, app.today);
  // A question or next step agreed in the review is a row in Next steps and asks: here, only what was noted.
  const t = talkedAll.held ? { ...talkedAll, held: { ...talkedAll.held, said: talkedAll.held.said.filter((d) => d.kind !== 'ask' && d.kind !== 'action') } } : talkedAll;
  // A stopped goal isn't in any review now.
  const nextText = t.next && !goal.stoppedAt ? `${t.next.review}, ${t.next.date === app.today.toISOString().slice(0, 10) ? 'today' : `${t.next.weekday} ${dayOf(t.next.date).replace(/^\w+ /, '')}`}` : null;
  const owner = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'the owner';
  return (
    <section className="block talked goal-section" aria-labelledby="g-talked" data-part="Review notes">
      <SectionHead id="g-talked" title="Last time we talked" purpose="What the last review said about it." />
      {t.held ? (
        <>
          <p className="small"><span className="strong">{t.held.review}</span>, {dayOf(t.held.on)} (week {t.held.week}){t.held.said.length || talkedAll.held!.said.length ? '' : ': reviewed, nothing added.'}</p>
          {t.held.said.length > 0 && (
            <ul className="talked-list">
              {t.held.said.map((d) => (
                <li key={d.id}>
                  <span className="field-label">{d.kind === 'ask' ? `${d.by} asked ${owner}` : d.kind === 'action' ? `Agreed: ${app.person(d.who ?? '')?.name.split(' ')[0] ?? owner}${d.due ? `, by week ${d.due}` : ''}` : `${d.by} noted`}{d.state && <span className={'action-state state-' + d.state}> · {d.kind === 'ask' ? (d.state === 'done' ? ASK_STATUS.answered.label : 'Not answered yet') : STATE_WORD[d.state]}</span>}</span>
                  <span className="small">{d.note}</span>
                </li>
              ))}
            </ul>
          )}
          {nextText && <p className="hint">Next: {nextText}.</p>}
        </>
      ) : <p className="small">Not discussed yet.{nextText ? ` Next review: ${nextText}.` : ' It isn’t in a review.'}</p>}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- what feeds it */

function FeedsSection({ feeding, feeds, parent }: { feeding: Goal[]; feeds: ReturnType<typeof feedsLine>; parent?: Goal }) {
  const app = useApp();
  const [all, setAll] = useState(false);
  const onPath = criticalPath(app.snapshot.goals, (g) => app.statusOf(g).status);
  const { pinned, rest } = feedingOrder(feeding, (g) => app.attentionOf(g), onPath);
  const shown = all ? rest : rest.slice(0, pinned ? 2 : 3);
  return (
    <section className="block feeds goal-section" id="feeds" aria-labelledby="g-feeds" data-part="What feeds it">
      <SectionHead id="g-feeds" title="What feeds it" purpose={feeding.length ? 'The goals that move this number, worst first.' : 'What this goal feeds into.'}>
        {parent && <p className="feeds-into">Feeds into <Link className="linkish" to={'/goals/' + parent.id}>{parent.title}</Link> <span className={'nowrap tone-' + app.statusOf(parent).status}><StatusShape k={app.statusOf(parent).status} />{LABEL[app.statusOf(parent).status]}</span></p>}
        {/* How they stand, said once: "Directly feeding it (four goals): 2 off track, 1 at risk". */}
        {feeds && (
          <p className="feeds-sum">
            {feeds.head}{feeds.counts.length > 0 ? <>: {feeds.counts.map((x, i) => <span key={x.status} className={'feeds-count tone-' + x.status}>{i ? ', ' : ''}<StatusShape k={x.status} />{x.n} {LABEL[x.status].toLowerCase()}</span>)}</> : ', none behind'}
          </p>
        )}
      </SectionHead>
      {feeding.length > 0 && <ul className="tree">
        {pinned && <li className="pinned"><GoalRow g={pinned.goal} /><span className="hint pinned-why"><span className="strong">Most likely to make it miss:</span> {pinned.why}</span></li>}
        {shown.map((g) => <li key={g.id}><GoalRow g={g} /></li>)}
      </ul>}
      {rest.length > shown.length && <button type="button" className="linkish small show-all" onClick={() => setAll(true)}>Show the other {rest.length - shown.length}</button>}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- quarters */

/** The year by quarter: each quarter's plan for this goal, and whether it was met. The tiles fill in turn. */
function QuarterStrip({ goal }: { goal: Goal }) {
  const app = useApp();
  const now = quarterOf(app.cycle, app.week).n;
  const rs = quarterResults(goal, app.cycle, app.snapshot.checkIns, resultWeek(app.cycle, app.today));
  if (rs.every((r) => r.kind === 'none')) return null;
  return (
    <section className="block goal-section" aria-labelledby="g-quarters" data-part="Quarters">
      <SectionHead id="g-quarters" title="This year by quarter" purpose="Whether each quarter met its plan." />
      <ol className="quarters">
        {rs.map((r) => (
          <li key={r.quarter.n} className={'q-' + r.kind + (r.quarter.n === now ? ' q-now' : '')}>
            <span className="q-head"><span className="strong">{r.quarter.label} <span className="hint nowrap">{r.quarter.months}</span></span>
              <span className="q-result"><QuarterMark kind={r.kind} done={r.quarter.n === now ? (app.week - r.quarter.from + 1) / (r.quarter.to - r.quarter.from + 1) : 0} />{quarterLabel(r, now)}</span></span>
            {r.kind !== 'none' || r.before ? <span className="small">{quarterWords(r.text)}</span> : r.doneWeek != null && <span className="small">{STATUS.done.label} in week {r.doneWeek}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------------- activity */

/**
 * History (goal spec, 2.2; GT2): every week, checked in or not, what was said and what changed, newest first. Four
 * filters with counts; the filter, Show all, a search and a week are in the address (?history=, ?all=1, ?hq=, ?week=).
 */
function HistorySection({ goal, focusComposer }: { goal: Goal; focusComposer: boolean }) {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const raw = params.get('history');
  const filter: HistoryFilter = HISTORY_FILTERS.includes(raw as HistoryFilter) ? (raw as HistoryFilter) : 'all';
  const all = params.get('all') === '1';
  const q = params.get('hq') ?? '';
  const weekWanted = Number(params.get('week')) || null;
  // The load holds about a year of changes (AX5 part 2b). A goal whose year began near or before that (set up up to a
  // quarter ahead) may have older entries: they are paged in on request.
  const older = useOlderChanges(goal.id);
  const from = app.full.history?.from;
  const year = app.full.cycles.find((c) => c.id === goal.cycleId);
  const reaches = !!from && !!year && Date.parse(year.startDate) - 91 * 86_400_000 < Date.parse(from);
  const goalChanges = app.snapshot.changes.filter((c) => c.goalId === goal.id);
  const input = { goal, checkIns: app.checkInsOf(goal), changes: older.older.length ? [...[...older.older].reverse(), ...goalChanges].sort((x, y) => Date.parse(x.at) - Date.parse(y.at)) : goalChanges, cycle: app.cycle, week: app.week, asks: asksOf(app.snapshot).filter((r) => r.goalIds.includes(goal.id)) };
  const h = goalHistory(input, filter, q);
  const whole = goalHistory(input);
  const shown = all || q || weekWanted ? h.entries : h.entries.slice(0, 12);
  // One history entry per choice (find spec, rule 4): a filter, a search or a week replaces nothing else in the address.
  const set = (k: string, v: string | null) => setParams((p) => { if (v == null || v === '') p.delete(k); else p.set(k, v); p.delete('all'); return p; }, { replace: k === 'hq' });
  const latest = app.checkInsOf(goal).at(-1) ?? null;
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (focusComposer) { ref.current?.scrollIntoView({ block: 'start' }); document.getElementById('note-' + goal.id)?.focus({ preventScroll: true }); } }, [focusComposer, goal.id]);
  // Opened at a week (?week=): scrolled to its entry.
  useEffect(() => { if (weekWanted) document.getElementById(`hist-week-${weekWanted}`)?.scrollIntoView({ block: 'center' }); }, [weekWanted]);
  const weeksWithEntries = [...new Set(whole.entries.flatMap((x) => (x.kind === 'checkin' ? [x.checkIn.week] : x.kind === 'checkins' ? x.checkIns.map((c) => c.week) : x.kind === 'missed' ? [x.to] : [])))].sort((a, b) => b - a);
  const none: Record<HistoryFilter, string> = { all: 'Nothing here yet.', checkins: 'No check-ins yet.', comments: 'No comments yet.', reviews: 'Nothing was said in a review yet.', changes: 'Nothing has been changed since it was set up.' };
  return (
    <section className="block activity history goal-section" id="history" aria-labelledby="g-history" ref={ref} data-part="History">
      <span id="activity" className="anchor-alias" aria-hidden="true" />
      <SectionHead id="g-history" title="History" purpose="Every week, what was said, and what changed, newest first." />
      <NoteComposer goal={goal} startOpen={focusComposer} />
      <nav className="history-filters" aria-label="Show">
        {HISTORY_FILTERS.map((k) => (
          <a key={k} className="history-filter" href={`?history=${k}`} aria-current={filter === k ? 'true' : undefined}
            onClick={(e) => { e.preventDefault(); set('history', k === 'all' ? null : k); }}>{HISTORY_LABEL[k]} <span className="history-count">{whole.counts[k]}</span></a>
        ))}
      </nav>
      {whole.counts.all > 30 && (
        <div className="row history-find">
          <input className="input history-search" type="search" placeholder="Find in this goal’s history" aria-label="Find in this goal’s history" value={q} onChange={(e) => set('hq', e.target.value)} />
          <select className="input history-week" aria-label="Go to week" value={weekWanted ?? ''} onChange={(e) => set('week', e.target.value || null)}>
            <option value="">Go to week…</option>
            {weeksWithEntries.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>
      )}
      {shown.length ? (
        <ol className="stream">
          {shown.map((x) => <HistoryRow key={x.kind === 'checkin' ? x.checkIn.id : x.kind === 'checkins' ? 'g-' + x.checkIns[0]!.id : x.kind === 'missed' ? `m-${x.from}-${x.to}` : x.change.id} goal={goal} x={x} latestId={latest?.id ?? null} latestWeek={latest?.week} />)}
        </ol>
      ) : q ? <p className="small muted">Nothing in this goal’s history matches “{q}”. <button type="button" className="linkish" onClick={() => set('hq', null)}>Clear the search</button></p>
        : <p className="small muted">{none[filter]}</p>}
      {h.entries.length > shown.length && <a className="linkish small show-all" href="?all=1" onClick={(e) => { e.preventDefault(); setParams((p) => { p.set('all', '1'); return p; }); }}>Show all {h.entries.length}</a>}
      {reaches && older.more && h.entries.length <= shown.length && <button type="button" className="linkish small show-all" disabled={older.loading} onClick={() => { older.next(); setParams((p) => { p.set('all', '1'); return p; }); }}>{older.loading ? 'Fetching older changes…' : 'Show older changes'}</button>}
    </section>
  );
}

/** One entry of History: a week (its check-in, or "No check-in"), a comment, what a review said, or a change. */
function HistoryRow({ goal, x, latestId, latestWeek }: { goal: Goal; x: HistoryEntry; latestId: string | null; latestWeek?: number }) {
  if (x.kind === 'missed') {
    return (
      <li className="stream-missed" id={`hist-week-${x.to}`}>
        <span className="strong">{x.from === x.to ? `Week ${x.from}` : `Weeks ${x.from} to ${x.to}`}</span>
        <span className="small muted"> · {x.yet ? STATUS.none.label : x.from === x.to ? 'No check-in' : `No check-ins (${x.weeks} weeks)`}</span>
      </li>
    );
  }
  // This week's reason, when it is the one Why shows, is pointed to rather than said twice.
  if (x.kind === 'checkin') return <li className="stream-ci" id={`hist-week-${x.checkIn.week}`}><ol className="cilist ci-open"><CheckInRow goal={goal} c={x.checkIn} sameAs={x.sameAs} sameAsWhere={x.sameAsWhere} above={x.checkIn.id === latestId} latestWeek={latestWeek} /></ol></li>;
  return <StreamRow goal={goal} x={x} />;
}

function StreamRow({ goal, x }: { goal: Goal; x: StreamItem }) {
  const [open, setOpen] = useState(false);
  if (x.kind === 'comment') return <ChangeItem c={x.change} manage />;
  if (x.kind === 'change') return <ChangeItem c={x.change} />;
  if (x.kind === 'checkin') return <li className="stream-ci"><ol className="cilist ci-open"><CheckInRow goal={goal} c={x.checkIn} sameAs={x.sameAs} sameAsWhere={x.sameAsWhere} /></ol></li>;
  return (
    <li className="stream-group">
      <button type="button" className="group-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="strong">Weeks {x.from}–{x.to}</span>
        <span className="small group-why">{x.sameAs != null ? <span className="muted">{sameReasonText(x.sameAs, x.sameAsWhere)}</span> : x.why}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" />
      </button>
      {open && <ol className="cilist ci-open">{x.checkIns.map((c) => <CheckInRow key={c.id} goal={goal} c={c} quiet />)}</ol>}
    </li>
  );
}

/**
 * A comment: why something changed, anything worth knowing that isn't a check-in. Anyone can comment; it's logged and asks
 * nothing of anyone. Someone who needs the owner to respond asks a question instead: the same words, as an ask that stays
 * open on the owner's Home until they answer it (one way to ask).
 */
export function NoteComposer({ goal, startOpen }: { goal: Goal; startOpen?: boolean }) {
  const app = useApp();
  // What's typed is kept as a draft: Cancel closes the box and keeps it, as other drafts are kept (goal spec, 2.2).
  const [draft, keep, clear] = useDraft<{ text: string }>(`${app.ws.id}:comment:${goal.id}`, () => ({ text: '' }));
  const text = draft.text;
  const [open, setOpen] = useState(() => !!startOpen || !!text.trim());
  const [saving, setSaving] = useState(false);
  const ownerFirst = app.person(goal.ownerId)?.name.split(' ')[0] ?? 'The owner';
  const watcherIds = app.snapshot.people.filter((p) => goalsIn(watchScope(p.id, app.snapshot.watches), app.snapshot.goals).some((g) => g.id === goal.id)).map((p) => p.id);
  const reach = commentReach({ goal, viewerId: app.viewer.id, ownerFirst, watcherIds, workspace: app.ws.name.replace(/^Example:\s*/, '') });
  const post = async () => {
    if (text.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      await app.addNote(goal, text); app.toast('Comment posted');
      clear(); setOpen(false);
    } catch { /* the save already said what went wrong */ } finally {
      setSaving(false);
    }
  };
  if (!open) return <button type="button" className="btn note-open" onClick={() => { setOpen(true); requestAnimationFrame(() => document.getElementById('note-' + goal.id)?.focus()); }}>Add a comment</button>;
  return (
    <form className="note-compose" onSubmit={(e) => { e.preventDefault(); void post(); }}>
      <label className="field"><span className="sr">Add a comment</span>
        <textarea id={'note-' + goal.id} className="input" rows={3} value={text} onChange={(e) => keep({ text: e.target.value })} placeholder="Say what you think, or what you know" aria-label="Add a comment" />
      </label>
      <p className="hint note-reach">{reach}</p>
      <span className="row note-compose-actions" style={{ gap: 'var(--s2)' }}>
        <button className="btn" type="submit" disabled={saving || text.trim().length < 2}>{saving ? 'Posting…' : 'Post comment'}</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </span>
    </form>
  );
}

/** One check-in as a row (week, number, the call, the reason) that opens to the whole check-in. `quiet` leaves the
 *  reason out, inside a group that says it once; `sameAs` points to the newer week that already said it. */
function CheckInRow({ goal, c, quiet, sameAs, sameAsWhere, above, latestWeek }: { goal: Goal; c: CheckIn; quiet?: boolean; sameAs?: number; sameAsWhere?: 'above' | 'below'; above?: boolean; latestWeek?: number }) {
  const [isOpen, setOpen] = useState(false);
  const app = useApp();
  // A corrected check-in says so on its row (check-in spec 2.7): the engine's own summary and the reason given.
  // A correction that was undone no longer says so: the week reads as it was (review of #225, medium 2).
  const fix = [...app.snapshot.changes].reverse().find((x) => x.entity === 'check-in' && x.entityId === c.id && x.diffs.some((d) => d.field === 'Why corrected') && !(x.importId && importUndone(app.snapshot, x.importId)));
  const why = fix?.diffs.find((d) => d.field === 'Why corrected')?.to;
  // The moment it made (habit rule 3), in small capitals beside its status: never on a correction or an import.
  const imported = app.snapshot.changes.some((x) => x.entity === 'check-in' && x.entityId === c.id && x.importId);
  const m = moment(app.checkInsOf(goal).filter((x) => x.id !== c.id), c, goal, !fix && !imported);
  return (
    <li className={isOpen ? 'is-open' : undefined}>
      <button type="button" className="ci-row" aria-expanded={isOpen} aria-controls={'ci-' + c.id} onClick={() => setOpen(!isOpen)}>
        <span className="strong ci-week"><span className="nowrap">Week {c.week}</span></span>
        <span className="ci-value num">{goal.kind === 'milestone' ? `${assessMilestone(goal, c.week, c.stages).doneCount} of ${goal.stages.length} stages` : c.value == null ? '—' : fmt(c.value, goal)}</span>
        <span className="ci-call"><Chip k={c.status} />{m && <span className={'ci-result ' + (m.kind === 'reached' ? 'is-done' : 'is-on')}>{MOMENT_RESULT[m.kind]}</span>}</span>
        <span className="ci-tail">{above && c.why && c.why !== NO_REASON ? <span className="small muted cilist-why">The reason is above, under Why.</span> : quiet ? <span className="small muted cilist-why">Same reason</span> : sameAs != null ? <span className="small muted cilist-why">{sameAs === latestWeek ? `The same reason as week ${sameAs}, under Why` : sameReasonText(sameAs, sameAsWhere)}</span> : c.why && c.why !== NO_REASON ? <span className="small cilist-why">{c.why}</span> : <span className="small muted cilist-why">{GAP['on-plan'].label}</span>}<Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="muted ci-chev" /></span>
      </button>
      {fix && <span className="small muted ci-corrected" style={{ display: 'block', gridColumn: '1 / -1', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{fix.summary}, by {app.person(fix.actorId)?.name ?? 'someone'}{why ? `: “${why}”` : ''}</span>}
      {isOpen && <CheckInFull goal={goal} c={c} id={'ci-' + c.id} />}
    </li>
  );
}

/** The goal's latest check-ins, newest first, each opening to the whole check-in: open in a review. */
function CheckInRows({ goal, limit }: { goal: Goal; limit: number }) {
  const app = useApp();
  const own = app.checkInsOf(goal);
  const [all, setAll] = useState(false);
  if (!own.length) return <p className="small muted">No check-ins yet.</p>;
  return (
    <>
      <ol className="cilist ci-open">{[...own].reverse().slice(0, all ? undefined : limit).map((c, i, list) => {
        // A reason the newer week already gave is pointed to, not said again.
        const newer = c.why && c.why !== NO_REASON ? list.slice(0, i).reverse().find((x) => x.why === c.why) : undefined;
        return <CheckInRow key={c.id} goal={goal} c={c} sameAs={newer ? list.slice(0, i).find((x) => x.why === c.why)!.week : undefined} />;
      })}</ol>
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
      {!goal.stoppedAt && canDeleteCheckIn(app.snapshot, goal, c, app.viewer) && <dd className="ci-remove"><DeleteCheckIn c={c} /></dd>}
    </dl>
  );
}

/* ---------------------------------------------------------------------------------------------------- about */

/** About this goal: open on a first visit, folded after. The definition and changing the goal live here, one step away. */
function AboutSection({ goal, open, onToggle, detailsRef }: { goal: Goal; open: boolean; onToggle: (open: boolean) => void; detailsRef: RefObject<HTMLDetailsElement | null> }) {
  const app = useApp();
  const { cycle } = app;
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const team = app.team(goal.teamId);
  const fed = app.snapshot.goals.filter((g) => g.parentId === goal.id).length;
  const canEdit = goal.ownerId === app.viewer.id || app.viewer.admin;
  const watchers = app.snapshot.people.filter((p) => p.id !== goal.ownerId && goalsIn(watchScope(p.id, app.snapshot.watches), app.snapshot.goals).some((g) => g.id === goal.id));
  const history = goal.kind === 'metric' ? planHistoryOf(goal) : [];
  const own = app.checkInsOf(goal);
  return (
    <details className="block about goal-section" id="about" data-part="About this goal" ref={detailsRef} open={open} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}>
      <summary><span className="section-head"><h2 className="block-title">About this goal</h2><span className="section-purpose">Its definition, its plan week by week, and who watches it.</span></span></summary>
      <dl className="details">
        {goal.kind !== 'milestone' && <><dt>What it measures</dt><dd>{goal.definition || <><span className="muted">Not described yet.</span>{canEdit && !goal.stoppedAt && <> <Link className="linkish" to={`/goals/${goal.id}/edit#definition`}>Describe it</Link></>}</>}{goal.source ? <span className="muted"> Source: {goal.source}.</span> : null}</dd></>}
        {goal.kind === 'metric' && <><dt>Measure</dt><dd>{capitalFirst(planSays(cycle, goal.plan.fromWeek ?? 0, goal.plan.endWeek ?? cycle.weeks, fmt(goal.plan.start, goal), fmt(goal.plan.target, goal)))}{(goal.plan.endWeek ?? 0) > cycle.weeks ? ', past this cycle' : ''}, {directionLabel(goal)}{notStarted(goal, app.week) ? `. It starts in ${weekSays(cycle, goal.plan.fromWeek!, 'sentence')}; nothing is due until then` : ''}</dd></>}
        {goal.kind === 'range' && <><dt>Measure</dt><dd>{directionLabel(goal)}, warning margin {fmt(goal.range.margin, goal)}{goal.source ? '' : ''}</dd></>}
        {goal.kind === 'milestone' && <><dt>Stages</dt><dd>{goal.stages.map((s) => `${s.name} (week ${s.dueWeek})`).join(', ')}{goal.source ? <span className="muted">. Source: {goal.source}.</span> : null}</dd></>}
        <dt>Level</dt><dd>{levelName(app.cycle, goal.level)}{!isEveryday(app.cycle, goal.level) ? ', reported at major reviews' : ''}</dd>
        <dt>Team</dt><dd>{team?.name ?? '—'}</dd>
        <dt>Feeds into</dt><dd>{parent ? <><Link className="linkish" to={'/goals/' + parent.id}>{parent.title}</Link>{goal.whyHelps ? <span className="muted">. {goal.whyHelps}</span> : null}</> : fed ? 'Nothing: it sits at the top of its tree' : 'Nothing yet (not linked)'}</dd>
        {fed > 0 && <><dt>Fed by</dt><dd><Link className="linkish" to={`/goals?feeds=${goal.id}`}>{fed === 1 ? '1 goal' : `${fed} goals`}</Link></dd></>}
        <dt>Watched by</dt><dd>{watchers.length ? watchers.map((p) => p.name).join(', ') : 'Nobody yet'}{goal.ownerId === app.viewer.id && <span className="muted block-line">You own this goal, so it is always on your Home. Owners don’t need to watch their own goals.</span>}</dd>
        {goal.key && <><dt>Key</dt><dd><span className="gkey-plain">{goal.key}</span> <span className="muted">· it never changes, and /goals/{goal.key} opens it</span></dd></>}
        {history.length > 0 && goal.kind === 'metric' && <><dt>Plan changes</dt><dd><ul className="plan-history">{history.map((v, i) => <li key={i}>Until week {v.untilWeek}: {fmt(v.plan.start, goal)} → {fmt(v.plan.target, goal)}</li>)}<li>Since: {fmt(goal.plan.start, goal)} → {fmt(goal.plan.target, goal)}</li></ul></dd></>}
      </dl>
      {/* Modules' sections (the goal.sections place: what measures it, say) are part of About, after its facts (goal spec, 5). */}
      <Place name="goal.sections" goal={goal} />
      {goal.kind === 'metric' && <PlanTable plan={goal.plan} unit={goal} actuals={own} label="Plan and actual by week" />}
      <p className="small">How the status is worked out: <Link className="linkish" to="/help/status">{WORD_OF.on}, {lower(STATUS.risk)} and {lower(STATUS.off)}, explained</Link>.</p>
      {canEdit && !goal.stoppedAt && <p className="about-change" id="change-goal"><Link className="linkish" to={`/goals/${goal.id}/edit`}>Change this goal</Link></p>}
    </details>
  );
}
